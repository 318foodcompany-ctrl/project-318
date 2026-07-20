(function () {
  "use strict";

  const STORAGE_KEY = "318-admin-recent";
  const panelLabels = {
    dashboardPanel: "Dashboard",
    leadsPanel: "Quote Management",
    bookingsPanel: "Booking Calendar",
    customersPanel: "Customers",
    invoicesPanel: "Invoices",
    marketingPanel: "Marketing Analytics",
    textPanel: "Homepage Content",
    aboutContentPanel: "About Page",
    corporateContentPanel: "Corporate Page",
    contactContentPanel: "Contact Page",
    menuPanel: "Catering Menu",
    settingsPanel: "Website Settings",
    photosPanel: "Photos",
    specialsPanel: "Specials"
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
  }

  function addStyles() {
    if (document.getElementById("adminExperienceStyles")) return;
    const style = document.createElement("style");
    style.id = "adminExperienceStyles";
    style.textContent = `
      :root{--admin-radius:16px;--admin-shadow:0 10px 30px rgba(17,17,17,.07);--admin-focus:0 0 0 4px rgba(226,27,35,.18)}
      body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.45}
      button,input,select,textarea,a{transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease,background .16s ease}
      button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid #e21b23;outline-offset:2px;box-shadow:var(--admin-focus)}
      button:active{transform:translateY(1px)}
      .card,.dashboard-card,.photo-card,.quote-summary-card,.booking-card,.crm-modal-card,.invoice-modal-card{border-radius:var(--admin-radius);box-shadow:var(--admin-shadow)}
      .admin-mobile-bar{display:none;position:sticky;top:0;z-index:1050;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #ddd;background:rgba(255,255,255,.96);backdrop-filter:blur(12px)}
      .admin-icon-button{display:inline-grid;width:44px;height:44px;place-items:center;border:1px solid #ddd;border-radius:12px;background:#fff;font-size:20px;font-weight:800}
      .admin-mobile-title{font-weight:900}.admin-mobile-title small{display:block;color:#777;font-size:11px;font-weight:700}
      .admin-overlay{position:fixed;inset:0;z-index:1090;background:rgba(0,0,0,.48)}.admin-overlay[hidden]{display:none}
      .admin-search-dialog{position:fixed;z-index:1200;top:8vh;left:50%;width:min(680px,calc(100% - 28px));max-height:84vh;overflow:auto;transform:translateX(-50%);padding:18px;border:1px solid #ddd;border-radius:20px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.3)}
      .admin-search-dialog[hidden]{display:none}.admin-search-head{display:flex;gap:10px}.admin-search-head input{flex:1;padding:14px;border:1px solid #ccc;border-radius:12px}.admin-search-results{display:grid;gap:8px;margin-top:14px}.admin-search-result{display:flex;justify-content:space-between;gap:12px;width:100%;padding:13px;border:1px solid #e5e5e5;border-radius:12px;background:#fafafa;text-align:left}.admin-search-result strong,.admin-search-result span{display:block}.admin-search-result span{color:#777;font-size:12px}.admin-search-empty{padding:24px;color:#777;text-align:center}
      .admin-fab{position:fixed;right:22px;bottom:22px;z-index:900;width:58px;height:58px;border:0;border-radius:50%;background:#e21b23;color:#fff;font-size:28px;box-shadow:0 16px 36px rgba(226,27,35,.35)}
      .admin-quick-menu{position:fixed;right:22px;bottom:90px;z-index:901;display:grid;gap:8px;width:230px;padding:12px;border:1px solid #ddd;border-radius:16px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.2)}.admin-quick-menu[hidden]{display:none}.admin-quick-menu button{padding:12px;border:0;border-radius:10px;background:#f5f5f3;text-align:left;font-weight:800}
      .admin-toast-region{position:fixed;right:18px;top:18px;z-index:2000;display:grid;gap:10px}.admin-toast{min-width:240px;max-width:360px;padding:13px 15px;border-radius:12px;background:#173d2c;color:#fff;box-shadow:0 14px 36px rgba(0,0,0,.22)}
      .admin-recent{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12)}.admin-recent h3{margin:0 0 8px;color:#bbb;font-size:11px;letter-spacing:.08em;text-transform:uppercase}.admin-recent button{display:block;width:100%;padding:8px 0;border:0;background:transparent;color:#ddd;text-align:left;font-size:12px}
      .admin-skip-link{position:fixed;left:12px;top:-80px;z-index:3000;padding:10px 14px;border-radius:8px;background:#111;color:#fff}.admin-skip-link:focus{top:12px}
      .panel.active{animation:admin-panel-in .18s ease}@keyframes admin-panel-in{from{opacity:.2;transform:translateY(4px)}to{opacity:1;transform:none}}
      @media(max-width:800px){.admin-mobile-bar{display:flex}.layout{display:block}.sidebar{position:fixed;inset:0 auto 0 0;z-index:1100;width:min(310px,88vw);overflow:auto;transform:translateX(-105%);transition:transform .2s ease;box-shadow:20px 0 55px rgba(0,0,0,.28)}body.admin-nav-open .sidebar{transform:translateX(0)}.topbar{display:none}.content{width:min(100% - 24px,1100px);margin:18px auto 90px}.admin-fab{right:16px;bottom:16px}.admin-quick-menu{right:16px;bottom:84px}}
      @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
    `;
    document.head.appendChild(style);
  }

  function showPanel(panelId) {
    if (!panelId) return;
    if (typeof window.showPanel === "function") window.showPanel(panelId);
    else {
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === panelId));
      document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.panel === panelId));
    }
    document.body.classList.remove("admin-nav-open");
    document.getElementById("adminNavOverlay")?.setAttribute("hidden", "");
    const title = panelLabels[panelId] || "Admin";
    const mobileTitle = document.getElementById("adminMobileTitle");
    if (mobileTitle) mobileTitle.firstChild.textContent = title;
    history.replaceState(null, "", `#${panelId}`);
    remember({ type: "panel", id: panelId, label: title });
    document.querySelector(`#${CSS.escape(panelId)} h2`)?.setAttribute("tabindex", "-1");
    document.querySelector(`#${CSS.escape(panelId)} h2`)?.focus({ preventScroll: true });
  }

  function remember(item) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const next = [item, ...existing.filter((entry) => !(entry.type === item.type && entry.id === item.id))].slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      renderRecent();
    } catch (_) {}
  }

  function renderRecent() {
    const host = document.getElementById("adminRecent");
    if (!host) return;
    let items = [];
    try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (_) {}
    host.innerHTML = `<h3>Recently viewed</h3>${items.length ? items.map((item) => `<button type="button" data-recent-panel="${esc(item.id)}">${esc(item.label)}</button>`).join("") : '<span style="color:#777;font-size:12px">Your recent areas will appear here.</span>'}`;
    host.querySelectorAll("[data-recent-panel]").forEach((button) => button.addEventListener("click", () => showPanel(button.dataset.recentPanel)));
  }

  function toast(message) {
    const region = document.getElementById("adminToastRegion");
    if (!region) return;
    const node = document.createElement("div");
    node.className = "admin-toast";
    node.setAttribute("role", "status");
    node.textContent = message;
    region.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function buildSearch() {
    const overlay = document.createElement("div");
    overlay.id = "adminSearchOverlay";
    overlay.className = "admin-overlay";
    overlay.hidden = true;
    const dialog = document.createElement("section");
    dialog.id = "adminSearchDialog";
    dialog.className = "admin-search-dialog";
    dialog.hidden = true;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Search admin");
    dialog.innerHTML = `<div class="admin-search-head"><input id="adminGlobalSearch" type="search" placeholder="Search admin areas…" autocomplete="off"><button class="admin-icon-button" type="button" aria-label="Close search">×</button></div><div id="adminSearchResults" class="admin-search-results"></div>`;
    document.body.append(overlay, dialog);

    const input = dialog.querySelector("input");
    const results = dialog.querySelector("#adminSearchResults");
    const choices = Object.entries(panelLabels).map(([id, label]) => ({ id, label }));
    function render() {
      const query = input.value.trim().toLowerCase();
      const matches = choices.filter((choice) => !query || `${choice.label} ${choice.id}`.toLowerCase().includes(query));
      results.innerHTML = matches.length ? matches.map((choice) => `<button class="admin-search-result" type="button" data-search-panel="${choice.id}"><span><strong>${esc(choice.label)}</strong><span>Open this admin area</span></span><b>↵</b></button>`).join("") : '<div class="admin-search-empty">No matching admin areas.</div>';
      results.querySelectorAll("[data-search-panel]").forEach((button) => button.addEventListener("click", () => { close(); showPanel(button.dataset.searchPanel); }));
    }
    function open() { overlay.hidden = false; dialog.hidden = false; render(); setTimeout(() => input.focus(), 0); }
    function close() { overlay.hidden = true; dialog.hidden = true; }
    input.addEventListener("input", render);
    dialog.querySelector("button").addEventListener("click", close);
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); dialog.hidden ? open() : close(); }
      if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) { event.preventDefault(); open(); }
      if (event.key === "Escape" && !dialog.hidden) close();
    });
    window.adminExperienceSearch = open;
  }

  function buildChrome() {
    document.body.insertAdjacentHTML("afterbegin", '<a class="admin-skip-link" href="#adminMainContent">Skip to main content</a>');
    const main = document.querySelector(".main");
    if (main) main.id = "adminMainContent";

    const mobile = document.createElement("div");
    mobile.className = "admin-mobile-bar";
    mobile.innerHTML = `<button id="adminMenuButton" class="admin-icon-button" type="button" aria-label="Open navigation" aria-expanded="false">☰</button><div id="adminMobileTitle" class="admin-mobile-title">Dashboard<small>318 Food Co.</small></div><button id="adminSearchButton" class="admin-icon-button" type="button" aria-label="Search admin">⌕</button>`;
    document.getElementById("adminApp")?.prepend(mobile);

    const navOverlay = document.createElement("div");
    navOverlay.id = "adminNavOverlay";
    navOverlay.className = "admin-overlay";
    navOverlay.hidden = true;
    document.body.appendChild(navOverlay);

    const menuButton = mobile.querySelector("#adminMenuButton");
    function toggleNav(force) {
      const open = force ?? !document.body.classList.contains("admin-nav-open");
      document.body.classList.toggle("admin-nav-open", open);
      navOverlay.hidden = !open;
      menuButton.setAttribute("aria-expanded", String(open));
    }
    menuButton.addEventListener("click", () => toggleNav());
    navOverlay.addEventListener("click", () => toggleNav(false));
    mobile.querySelector("#adminSearchButton").addEventListener("click", () => window.adminExperienceSearch?.());

    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      const recent = document.createElement("section");
      recent.id = "adminRecent";
      recent.className = "admin-recent";
      sidebar.appendChild(recent);
      renderRecent();
    }

    const quick = document.createElement("div");
    quick.id = "adminQuickMenu";
    quick.className = "admin-quick-menu";
    quick.hidden = true;
    quick.innerHTML = `<button type="button" data-quick="booking">＋ New booking</button><button type="button" data-quick="invoice">＄ New invoice</button><button type="button" data-quick="customer">◎ New customer</button><button type="button" data-quick="quote">▦ Open sales pipeline</button>`;
    const fab = document.createElement("button");
    fab.className = "admin-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Quick add");
    fab.setAttribute("aria-expanded", "false");
    fab.textContent = "+";
    document.body.append(quick, fab);
    fab.addEventListener("click", () => { quick.hidden = !quick.hidden; fab.setAttribute("aria-expanded", String(!quick.hidden)); });
    quick.addEventListener("click", (event) => {
      const action = event.target.closest("[data-quick]")?.dataset.quick;
      if (!action) return;
      quick.hidden = true; fab.setAttribute("aria-expanded", "false");
      if (action === "booking") { showPanel("bookingsPanel"); document.getElementById("newBookingButton")?.click(); }
      if (action === "invoice") { showPanel("invoicesPanel"); document.getElementById("newInvoiceButton")?.click(); }
      if (action === "customer") { showPanel("customersPanel"); document.getElementById("newCustomerButton")?.click(); }
      if (action === "quote") showPanel("leadsPanel");
    });

    const toastRegion = document.createElement("div");
    toastRegion.id = "adminToastRegion";
    toastRegion.className = "admin-toast-region";
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
  }

  function improveSemantics() {
    document.documentElement.style.scrollBehavior = "smooth";
    document.querySelectorAll("button:not([type])").forEach((button) => button.type = "button");
    document.querySelectorAll("input,select,textarea").forEach((control) => {
      if (!control.getAttribute("aria-label") && !control.closest("label")) {
        const placeholder = control.getAttribute("placeholder");
        if (placeholder) control.setAttribute("aria-label", placeholder);
      }
    });
    document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => {
      const panelId = button.dataset.panel;
      if (panelId) remember({ type: "panel", id: panelId, label: panelLabels[panelId] || button.textContent.trim() });
    }));
    document.addEventListener("click", (event) => {
      const record = event.target.closest("[data-booking-id],[data-customer-id],[data-invoice-id]");
      if (!record) return;
      const id = record.dataset.bookingId || record.dataset.customerId || record.dataset.invoiceId;
      const label = record.textContent.trim().replace(/\s+/g, " ").slice(0, 60) || `Record ${id}`;
      const panel = record.closest(".panel")?.id;
      if (panel) remember({ type: "panel", id: panel, label });
    });
    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      if (panelLabels[id]) showPanel(id);
    });
    const initial = location.hash.slice(1);
    if (panelLabels[initial]) setTimeout(() => showPanel(initial), 0);
  }

  addStyles();
  buildSearch();
  buildChrome();
  improveSemantics();
  window.adminExperience = { showPanel, toast, remember };
  document.dispatchEvent(new CustomEvent("admin-experience-ready"));
})();