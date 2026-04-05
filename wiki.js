(function () {
  var yearEl = document.getElementById("year");
  var copyTriggers = document.querySelectorAll("[data-copy-ip]");
  var toast = document.getElementById("toast");
  var navToggle = document.querySelector(".nav__toggle");
  var navMenu = document.getElementById("nav-menu");
  var searchInput = document.getElementById("wiki-search");
  var filterButtons = document.querySelectorAll("[data-wiki-filter]");
  var raceCards = document.querySelectorAll(".race-card");
  var raceChips = document.querySelectorAll("[data-wiki-jump]");
  var activeFilter = "tumu";

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function getIpText() {
    var ipEl = document.getElementById("server-ip");
    if (ipEl) return ipEl.textContent.trim();
    var first = document.querySelector("[data-server-ip]");
    return first ? first.textContent.trim() : "play.averneth.net";
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(function () {
      toast.classList.remove("is-visible");
      window.setTimeout(function () {
        toast.hidden = true;
      }, 400);
    }, 2200);
  }

  function bindCopy(el) {
    el.addEventListener("click", function () {
      var text = getIpText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () {
            showToast("Sunucu adresi kopyalandı.");
          },
          function () {
            fallbackCopy(text);
          }
        );
      } else {
        fallbackCopy(text);
      }
    });
  }

  copyTriggers.forEach(bindCopy);

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Sunucu adresi kopyalandı.");
    } catch (e) {
      showToast("Kopyalanamadı; adresi elle seçin.");
    }
    document.body.removeChild(ta);
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      var open = navMenu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function getApiUrl(path) {
    var el = document.body;
    var base = (el && el.getAttribute("data-api-base")) || "";
    base = base.replace(/\/$/, "");
    if (!path.startsWith("/")) path = "/" + path;
    return base + path;
  }

  function updateAuthUI() {
    var loginBtn = document.getElementById("header-login");
    var registerBtn = document.getElementById("header-register");
    var profileBtn = document.getElementById("header-profile");
    var profileImg = document.getElementById("header-profile-img");

    fetch(getApiUrl("/api/auth/me"), { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.loggedIn) {
          if (loginBtn) loginBtn.style.display = "none";
          if (registerBtn) registerBtn.style.display = "none";
          if (profileBtn) profileBtn.style.display = "inline-flex";
          if (profileImg && data.username) {
            profileImg.src = "https://mc-heads.net/avatar/" + data.username + "/32";
          }
        } else {
          if (loginBtn) loginBtn.style.display = "inline-flex";
          if (registerBtn) registerBtn.style.display = "inline-flex";
          if (profileBtn) profileBtn.style.display = "none";
        }
      })
      .catch(function () {});
  }

  updateAuthUI();

  function cardMatchesFilter(card) {
    if (activeFilter === "tumu") return true;
    var tags = (card.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);
    return tags.indexOf(activeFilter) !== -1;
  }

  function cardMatchesSearch(card, q) {
    if (!q) return true;
    var hay = card.getAttribute("data-search") || "";
    var hayTr = hay.toLocaleLowerCase("tr-TR");
    return hayTr.indexOf(q) !== -1;
  }

  function applyFilters() {
    var q = searchInput ? searchInput.value.trim().toLocaleLowerCase("tr-TR") : "";
    raceCards.forEach(function (card) {
      var ok = cardMatchesFilter(card) && cardMatchesSearch(card, q);
      card.classList.toggle("is-hidden", !ok);
    });
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeFilter = btn.getAttribute("data-wiki-filter") || "tumu";
      filterButtons.forEach(function (b) {
        b.classList.toggle("wiki-filter--active", b === btn);
      });
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      applyFilters();
    });
  }

  raceChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var id = chip.getAttribute("data-wiki-jump");
      if (!id) return;
      var el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("race-card--pulse");
        window.setTimeout(function () {
          el.classList.remove("race-card--pulse");
        }, 1200);
      }
    });
  });
})();
