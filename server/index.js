"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const PORT = Number(process.env.PORT) || 3847;
const BCRYPT_ROUNDS = Math.min(31, Math.max(4, Number(process.env.BCRYPT_ROUNDS) || 10));
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_DAYS = Number(process.env.JWT_EXPIRES_DAYS) || 7;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const TABLE = process.env.NLOGIN_TABLE || "nlogin";
const C = {
  id: process.env.NLOGIN_COL_ID || "ai",
  name: process.env.NLOGIN_COL_NAME || "last_name",
  password: process.env.NLOGIN_COL_PASSWORD || "password",
  address: process.env.NLOGIN_COL_ADDRESS || "last_ip",
  lastlogin: process.env.NLOGIN_COL_LASTLOGIN || "last_seen",
  email: process.env.NLOGIN_COL_EMAIL || "email",
  rank: process.env.NLOGIN_COL_RANK || "rank",
  balance: process.env.NLOGIN_COL_BALANCE || "balance",
};

function q(ident) {
  return "`" + String(ident).replace(/`/g, "``") + "`";
}

const MC_USER = /^[a-zA-Z0-9_]{3,16}$/;
const PASS_MIN = 5;
const PASS_MAX = 32;
const EMAIL_MAX = 254;
const EMAIL_OK =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const rateBuckets = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

function rateLimit(ip) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, b);
  }
  b.count += 1;
  if (b.count > RATE_MAX) return false;
  return true;
}

function clientIp(req) {
  const x = req.headers["x-forwarded-for"];
  if (typeof x === "string" && x.length) return x.split(",")[0].trim();
  return req.socket.remoteAddress || "0.0.0.0";
}

let pool;

async function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "nLogin",
    waitForConnections: true,
    connectionLimit: 10,
  });
  return pool;
}

function corsOptions() {
  if (CORS_ORIGIN === "*") {
    return { origin: true, credentials: true };
  }
  return { origin: CORS_ORIGIN, credentials: true };
}

const app = express();
app.set("trust proxy", 1);
app.use(cors(corsOptions()));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

app.get("/api/health", function (_req, res) {
  res.json({ ok: true, service: "averneth-auth-api" });
});

function requireJwtSecret(req, res, next) {
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    return res.status(503).json({
      ok: false,
      error: "Sunucu yapılandırması eksik: JWT_SECRET ayarlanmalı (en az 16 karakter).",
    });
  }
  next();
}

async function requireAdmin(req, res, next) {
  const raw = req.cookies.averneth_session;
  if (!raw) return res.status(401).json({ ok: false, error: "Yetkisiz erişim." });

  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    const p = await getPool();
    const t = q(TABLE);
    const [rows] = await p.execute(
      "SELECT " + q(C.rank) + " FROM " + t + " WHERE LOWER(" + q(C.name) + ") = ? LIMIT 1",
      [payload.sub]
    );

    if (!rows.length) return res.status(401).json({ ok: false, error: "Kullanıcı bulunamadı." });

    const rank = (rows[0][C.rank] || "Üye").toLowerCase();
    const allowed = ["kurucu", "baş yönetici", "admin"];
    if (!allowed.includes(rank)) {
      return res.status(403).json({ ok: false, error: "Yetkiniz yok." });
    }
    req.user = { ...payload, rank: rows[0][C.rank] };
    next();
  } catch (_e) {
    return res.status(401).json({ ok: false, error: "Geçersiz oturum." });
  }
}

app.post("/api/auth/register", requireJwtSecret, async function (req, res) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return res.status(429).json({ ok: false, error: "Çok fazla istek. Bir süre sonra tekrar deneyin." });
  }

  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const emailRaw = typeof req.body.email === "string" ? req.body.email.trim() : "";
  const emailNorm = emailRaw.toLowerCase();

  if (!MC_USER.test(username)) {
    return res.status(400).json({
      ok: false,
      error: "Oyuncu adı 3–16 karakter olmalı; yalnızca harf, rakam ve alt çizgi kullanılabilir.",
    });
  }
  if (password.length < PASS_MIN || password.length > PASS_MAX) {
    return res.status(400).json({
      ok: false,
      error: "Şifre " + PASS_MIN + "–" + PASS_MAX + " karakter arasında olmalı (nLogin ile uyumlu).",
    });
  }
  if (!emailNorm || emailNorm.length > EMAIL_MAX || !EMAIL_OK.test(emailNorm)) {
    return res.status(400).json({
      ok: false,
      error: "Geçerli bir e-posta adresi girin.",
    });
  }

  const nameLower = username.toLowerCase();

  try {
    const p = await getPool();
    const t = q(TABLE);

    const [dup] = await p.execute(
      "SELECT " + q(C.id) + " FROM " + t + " WHERE LOWER(" + q(C.name) + ") = ? LIMIT 1",
      [nameLower]
    );
    if (dup.length) {
      return res.status(409).json({ ok: false, error: "Bu oyuncu adı zaten kayıtlı." });
    }

    const [emailDup] = await p.execute(
      "SELECT " + q(C.id) + " FROM " + t + " WHERE LOWER(" + q(C.email) + ") = ? LIMIT 1",
      [emailNorm]
    );
    if (emailDup.length) {
      return res.status(409).json({ ok: false, error: "Bu e-posta adresi zaten kayıtlı." });
    }

    let hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    if (hash.startsWith("$2b$")) {
      hash = "$2a$" + hash.slice(4);
    }

    await p.execute(
      "INSERT INTO " + t + " (" + q(C.name) + ", " + q(C.password) + ", " + q(C.address) + ", " + q(C.email) + ") VALUES (?, ?, ?, ?)",
      [username, hash, ip, emailNorm]
    );

    const token = jwt.sign({ sub: nameLower, rn: username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_DAYS + "d",
    });

    res.cookie("averneth_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      ok: true,
      message: "Kayıt tamamlandı. Aynı şifre ile oyunda /login kullanabilirsiniz.",
      username: username,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Veritabanı hatası. Yapılandırmayı kontrol edin." });
  }
});

app.post("/api/auth/login", requireJwtSecret, async function (req, res) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return res.status(429).json({ ok: false, error: "Çok fazla istek. Bir süre sonra tekrar deneyin." });
  }

  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!MC_USER.test(username) || password.length < 1) {
    return res.status(400).json({ ok: false, error: "Geçersiz kullanıcı adı veya şifre." });
  }

  const nameLower = username.toLowerCase();

  try {
    const p = await getPool();
    const t = q(TABLE);

    const [rows] = await p.execute(
      "SELECT " + q(C.id) + ", " + q(C.name) + ", " + q(C.password) +
      " FROM " + t +
      " WHERE LOWER(" + q(C.name) + ") = ? LIMIT 1",
      [nameLower]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, error: "Oyuncu adı veya şifre hatalı." });
    }

    const row = rows[0];
    const stored = row[C.password];
    if (typeof stored !== "string" || !stored.startsWith("$2")) {
      return res.status(503).json({
        ok: false,
        error: "Bu hesap BCrypt ile kayıtlı değil. nLogin şifreleme olarak BCRYPT2A kullanılmalı.",
      });
    }

    const match = await bcrypt.compare(password, stored);
    if (!match) {
      return res.status(401).json({ ok: false, error: "Oyuncu adı veya şifre hatalı." });
    }

    const id = row[C.id];
    await p.execute(
      "UPDATE " + t + " SET " + q(C.address) + " = ? WHERE " + q(C.id) + " = ?",
      [ip, id]
    );

    const token = jwt.sign({ sub: nameLower, rn: username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_DAYS + "d",
    });

    res.cookie("averneth_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      ok: true,
      message: "Giriş başarılı.",
      username: username,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Veritabanı hatası. Yapılandırmayı kontrol edin." });
  }
});

app.post("/api/auth/logout", function (req, res) {
  res.clearCookie("averneth_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", requireJwtSecret, async function (req, res) {
  const raw = req.cookies.averneth_session;
  if (!raw) return res.json({ ok: true, loggedIn: false });
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    const p = await getPool();
    const t = q(TABLE);
    const [rows] = await p.execute(
      "SELECT " + q(C.rank) + " FROM " + t + " WHERE LOWER(" + q(C.name) + ") = ? LIMIT 1",
      [payload.sub]
    );
    const rank = rows.length ? rows[0][C.rank] : "Üye";

    return res.json({
      ok: true,
      loggedIn: true,
      username: payload.rn || payload.sub,
      rank: rank
    });
  } catch (_e) {
    return res.json({ ok: true, loggedIn: false });
  }
});

app.get("/api/admin/users", requireAdmin, async function (req, res) {
  try {
    const p = await getPool();
    const t = q(TABLE);
    const [rows] = await p.execute(
      "SELECT " + q(C.id) + " as id, " + q(C.name) + " as username, " + q(C.email) + " as email, " + q(C.rank) + " as rank, " + q(C.balance) + " as balance FROM " + t
    );
    return res.json({ ok: true, users: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Kullanıcılar yüklenemedi." });
  }
});

app.post("/api/admin/update-user", requireAdmin, async function (req, res) {
  const { id, rank, balance } = req.body;
  if (!id) return res.status(400).json({ ok: false, error: "ID gerekli." });

  try {
    const p = await getPool();
    const t = q(TABLE);
    await p.execute(
      "UPDATE " + t + " SET " + q(C.rank) + " = ?, " + q(C.balance) + " = ? WHERE " + q(C.id) + " = ?",
      [rank, balance, id]
    );
    return res.json({ ok: true, message: "Kullanıcı güncellendi." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Kullanıcı güncellenemedi." });
  }
});

app.listen(PORT, function () {
  console.log("Auth API dinleniyor: http://127.0.0.1:" + PORT);
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    console.warn("[Uyarı] JWT_SECRET tanımlı değil veya çok kısa; kimlik doğrulama çalışmayacak.");
  }
});
