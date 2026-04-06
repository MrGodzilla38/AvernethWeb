(function () {
  function apiRoot() {
    var el = document.body;
    var base = (el && el.getAttribute("data-api-base")) || "";
    return base.replace(/\/$/, "");
  }

  function apiUrl(path) {
    var root = apiRoot();
    if (!path.startsWith("/")) path = "/" + path;
    return root + path;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function showMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-visible");
    el.classList.remove("auth-msg--ok", "auth-msg--err");
    el.classList.add(kind === "ok" ? "auth-msg--ok" : "auth-msg--err");
  }

  function hideMsg(el) {
    if (!el) return;
    el.classList.remove("is-visible");
    el.textContent = "";
  }

  function bindForm(formId, msgId, endpoint, extra) {
    var form = $(formId);
    var msg = $(msgId);
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideMsg(msg);

      var fd = new FormData(form);
      var username = (fd.get("username") || "").toString().trim();
      var password = (fd.get("password") || "").toString();

      // Şifre onay kontrolü
      if (formId === "form-register") {
        var confirmPass = $("reg-pass-confirm").value;
        if (password !== confirmPass) {
          showMsg(msg, "Şifreler uyuşmuyor.", "err");
          return;
        }
      }

      var body = { username: username, password: password };
      if (extra && typeof extra.payload === "function") {
        Object.assign(body, extra.payload(fd));
      }

      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
      }

      fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { status: res.status, data: data };
          });
        })
        .then(function (_ref) {
          var status = _ref.status;
          var data = _ref.data;
          if (data && data.ok) {
            showMsg(msg, data.message || "Tamam.", "ok");
            if (typeof extra.onSuccess === "function") extra.onSuccess(data);
            form.reset();
          } else {
            var err = (data && data.error) || "İşlem başarısız.";
            showMsg(msg, err, "err");
          }
        })
        .catch(function () {
          showMsg(
            msg,
            "Sunucuya bağlanılamadı. API adresini (data-api-base) ve çalışan servisi kontrol edin.",
            "err"
          );
        })
        .finally(function () {
          if (btn) {
            btn.disabled = false;
            btn.removeAttribute("aria-busy");
          }
        });
    });
  }

  // Şifre gösterme/gizleme mantığı
  document.querySelectorAll(".password-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = btn.previousElementSibling;
      var isOpen = input.type === "text";
      
      input.type = isOpen ? "password" : "text";
      
      var openPaths = btn.querySelectorAll(".eye-open");
      var closedLine = btn.querySelector(".eye-closed");
      
      if (isOpen) {
        // Gözü aç (çizgiyi gizle)
        openPaths.forEach(function(p) { p.style.display = "block"; });
        if (closedLine) closedLine.style.display = "none";
      } else {
        // Gözü kapat (çizgi göster)
        openPaths.forEach(function(p) { p.style.display = "block"; });
        if (closedLine) closedLine.style.display = "block";
      }
    });
  });

  bindForm("form-login", "msg-login", "/api/auth/login", {
    onSuccess: function () {
      refreshMe();
    },
  });

  bindForm("form-register", "msg-register", "/api/auth/register", {
    payload: function (fd) {
      return { email: (fd.get("email") || "").toString().trim() };
    },
    onSuccess: function () {
      refreshMe();
    },
  });

  function refreshMe() {
    var guestView = $("auth-guest-view");
    var userView = $("auth-user-view");
    var headerLogin = $("header-login");
    var headerRegister = $("header-register");
    var headerProfile = $("header-profile");
    var headerProfileImg = $("header-profile-img");

    fetch(apiUrl("/api/auth/me"), { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var loggedIn = !!(data && data.loggedIn);
        
        if (loggedIn) {
          if (guestView) guestView.style.display = "none";
          if (userView) userView.style.display = "grid";
          
          if (headerLogin) headerLogin.style.display = "none";
          if (headerRegister) headerRegister.style.display = "none";
          if (headerProfile) headerProfile.style.display = "inline-flex";

          // Dashboard verilerini doldur
          var username = data.username || "Oyuncu";
          
          // Header profil resmini güncelle
          if (headerProfileImg) {
            headerProfileImg.src = "https://mc-heads.net/avatar/" + username + "/32";
          }

          var email = data.email || "E-posta yok";
          var balance = data.balance !== undefined ? data.balance : "0.00";
          var regDate = data.createdAt ? new Date(data.createdAt).toLocaleDateString("tr-TR") : "-";
          var rank = data.rank || "Üye";

          // Rol CSS Sınıflarını Uygula
          var rankEl = $("user-display-rank");
          var rankDetailEl = $("user-rank-detail");
          if (rankEl || rankDetailEl) {
            var rLower = rank.toLowerCase("tr-TR");
            var cls = "rank--uye"; // Default

            if (rLower === "kurucu") cls = "rank--kurucu";
            else if (rLower === "baş yönetici" || rLower === "basyonetici") cls = "rank--basyonetici";
            else if (rLower === "admin") cls = "rank--admin";
            else if (rLower === "moderatör" || rLower === "moderator") cls = "rank--moderator";
            else if (rLower === "rehber") cls = "rank--rehber";
            else cls = "rank--uye";

            if (rankEl) {
              rankEl.className = "profile-card__rank " + cls;
              rankEl.textContent = rank;
            }
            if (rankDetailEl) {
              rankDetailEl.className = "details-item__value " + cls;
              rankDetailEl.textContent = rank;
            }
          }

          if ($("user-display-name")) $("user-display-name").textContent = username;
          if ($("user-balance")) $("user-balance").textContent = balance + " ₺";
          if ($("user-email")) $("user-email").textContent = email;
          if ($("user-reg-date")) $("user-reg-date").textContent = regDate;

          // Minecraft kafasını getir
          if ($("user-avatar-img")) {
            $("user-avatar-img").src = "https://mc-heads.net/avatar/" + username + "/64";
          }
          
        } else {
          if (guestView) guestView.style.display = "grid";
          if (userView) userView.style.display = "none";

          if (headerLogin) headerLogin.style.display = "inline-flex";
          if (headerRegister) headerRegister.style.display = "inline-flex";
          if (headerProfile) headerProfile.style.display = "none";
        }
      })
      .catch(function () {
        if (guestView) guestView.style.display = "grid";
        if (userView) userView.style.display = "none";
        if (headerProfile) headerProfile.style.display = "none";
      });
  }

  var sidebarLogout = $("btn-logout-sidebar");
  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", function () {
      fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" })
        .then(function () { refreshMe(); });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  refreshMe();
})();
