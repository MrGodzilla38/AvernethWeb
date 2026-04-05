const apiBase = document.body.hasAttribute("data-api-base") ? document.body.getAttribute("data-api-base") : "http://127.0.0.1:3847";

let currentUserRank = "Üye";

async function checkAuth() {
  try {
    const res = await fetch(`${apiBase}/api/auth/me`, { credentials: "include" });
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = "index.html";
      return false;
    }

    const allowedRoles = ["kurucu", "basyonetici", "admin"];
    const rawRank = (data.rank || "Uye").toLowerCase()
      .trim()
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
      .replace(/\s+/g, "");
    
    // Daha esnek rank kontrolü
    const isAllowed = allowedRoles.some(r => rawRank === r || rawRank.includes(r));

    if (!isAllowed) {
      console.warn("Yetki reddedildi. Client tarafındaki rutbe:", rawRank);
      window.location.href = "index.html";
      return false;
    }

    currentUserRank = rawRank;
    document.getElementById("user-info").innerHTML = `Giriş yapıldı: <span>${data.username}</span> (${data.rank})`;
    document.body.style.display = "block";
    return true;
  } catch (err) {
    console.error("Yetki kontrolü hatası:", err);
    window.location.href = "index.html";
    return false;
  }
}

async function loadUsers() {
  try {
    const res = await fetch(`${apiBase}/api/admin/users`, { credentials: "include" });
    const data = await res.json();
    if (!data.ok) {
      // Sadece admin.html içindeki tablo boş kalmasın diye bir uyarı basabiliriz
      // Ama yönlendirme yapmayalım, checkAuth zaten yönlendirmeyi yönetiyor
      console.error("Kullanıcı yükleme hatası:", data.error);
      return;
    }

    const tbody = document.getElementById("user-table-body");
    tbody.innerHTML = "";
    data.users.forEach(user => {
      const targetRank = (user.rank || "Uye").toLowerCase()
        .trim()
        .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
        .replace(/\s+/g, "");

      let editButton = "";

      // Duzenleme kisitlamasi
      const isTargetHigh = targetRank === "kurucu" || targetRank === "basyonetici";
      const isTargetAdmin = targetRank === "admin";
      
      const isMeHigh = currentUserRank === "kurucu" || currentUserRank === "basyonetici";

      if (currentUserRank === "admin") {
        // Admin; Kurucu, Basyonetici ve diger Adminleri duzenleyemez
        if (isTargetHigh || isTargetAdmin) {
          editButton = `<button class="btn btn--outline btn--sm" disabled title="Bu yetki duzeyini duzenleyemezsiniz">Kisitli</button>`;
        } else {
          editButton = `<button class="btn btn--outline btn--sm" onclick="openEditModal(${user.id}, '${user.rank || 'Uye'}', ${user.balance || 0})">Duzenle</button>`;
        }
      } else if (isMeHigh) {
        // Kurucu ve Basyonetici herkesi duzenleyebilir
        editButton = `<button class="btn btn--outline btn--sm" onclick="openEditModal(${user.id}, '${user.rank || 'Uye'}', ${user.balance || 0})">Duzenle</button>`;
      } else {
        // Diger durumlar (normalde buraya girmemeli)
        editButton = `<button class="btn btn--outline btn--sm" disabled>Yetki Yok</button>`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td><span class="rank-badge ${(user.rank || 'uye').toLowerCase()
          .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
          .replace(/\s+/g, '-')}">${user.rank || 'Uye'}</span></td>
        <td>${user.balance || 0}</td>
        <td>${editButton}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Kullanıcıları yükleme hatası:", err);
    alert("Kullanıcılar yüklenemedi.");
  }
}

function openEditModal(id, rank, balance) {
  document.getElementById("edit-user-id").value = id;
  document.getElementById("edit-user-rank").value = rank;
  document.getElementById("edit-user-balance").value = balance;
  document.getElementById("edit-modal").classList.add("active");
}

function closeModal() {
  document.getElementById("edit-modal").classList.remove("active");
}

document.getElementById("edit-user-form").onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-user-id").value;
  const rank = document.getElementById("edit-user-rank").value;
  const balance = document.getElementById("edit-user-balance").value;

  try {
    const res = await fetch(`${apiBase}/api/admin/update-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rank, balance }),
      credentials: "include"
    });
    const data = await res.json();
    if (data.ok) {
      alert("Kullanıcı başarıyla güncellendi.");
      closeModal();
      loadUsers();
    } else {
      alert(data.error || "Güncelleme hatası.");
    }
  } catch (err) {
    console.error("Güncelleme hatası:", err);
    alert("Kullanıcı güncellenemedi.");
  }
};

document.getElementById("logout-btn").onclick = async () => {
  try {
    await fetch(`${apiBase}/api/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "index.html";
  } catch (err) {
    console.error("Çıkış hatası:", err);
    window.location.href = "index.html";
  }
};

// Başlat
async function init() {
  const isAuth = await checkAuth();
  if (isAuth) {
    loadUsers();
  }
}

init();
