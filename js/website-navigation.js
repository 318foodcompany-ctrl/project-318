(function (win) {
  "use strict";

  const key = "primary_navigation";
  const pages = {
    "/": "Home", "/catering.html": "Catering menus", "/corporate.html": "Corporate catering",
    "/event-types.html": "Event types", "/about.html": "About us", "/gallery.html": "Gallery",
    "/faq.html": "FAQ", "/blog": "Catering blog", "/contact.html": "Contact"
  };
  const starter = ["/catering.html", "/corporate.html", "/about.html", "/gallery.html", "/contact.html"]
    .map(path => ({ path, label: pages[path] }));
  const limit = 6;

  function validate(links) {
    if (!Array.isArray(links) || links.length < 1 || links.length > limit) throw Error("Choose one to six menu links.");
    const paths = new Set();
    return links.map(link => {
      if (!link || typeof link.path !== "string" || !Object.hasOwn(pages, link.path)) throw Error("Choose a website page for each link.");
      if (paths.has(link.path)) throw Error("Choose each page only once.");
      paths.add(link.path);
      const label = typeof link.label === "string" ? link.label.trim() : "";
      if (!label || label.length > 24) throw Error("Use a link label of 1 to 24 characters.");
      return { path: link.path, label };
    });
  }

  function read(value) {
    const record = JSON.parse(value);
    if (record?.version !== 1 || !Object.hasOwn(record, "current") || !Object.hasOwn(record, "previous"))
      throw Error("This saved menu could not be opened.");
    return {
      current: record.current === null ? null : validate(record.current),
      previous: record.previous === null ? null : validate(record.previous)
    };
  }

  function show(links) {
    if (!links) return;
    const doc = win.document;
    const headerMenus = doc.querySelectorAll(".topbar .links, .cin-nav nav, .cin-mobile-nav, [data-website-menu]");
    if (!headerMenus.length) return;
    const stylesheet = doc.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/css/website-navigation.css";
    doc.head.append(stylesheet);
    const currentPath = win.location.pathname.replace(/^\/index\.html$/, "/");
    for (const menu of headerMenus) {
      const anchors = links.map(({path, label}) => {
        const a = doc.createElement("a");
        a.href = path;
        a.textContent = label;
        if (path === currentPath) a.setAttribute("aria-current", "page");
        return a;
      });
      const fixed = [...menu.children].filter(el => el.matches('a[href^="tel:"], a[href$="quote-builder.html"]'));
      menu.replaceChildren(...anchors, ...fixed);
      menu.classList.add("managed-navigation");
      if (menu.hasAttribute("data-website-menu")) menu.hidden = false;
      if (menu.tagName !== "NAV") menu.setAttribute("role", "navigation");
      menu.setAttribute("aria-label", "Main menu");
    }
  }

  function apply(value) {
    if (!value) return;
    try { show(read(value).current); }
    catch { /* Keep the built-in links when the stored menu is invalid. */ }
  }

  async function loadPublicMenu() {
    const config = win.__APP_CONFIG__;
    if (!config?.supabaseAnonKey || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(config.supabaseUrl || "")) return;
    const endpoint = new URL("/rest/v1/website_settings", config.supabaseUrl);
    endpoint.searchParams.set("select", "setting_value");
    endpoint.searchParams.set("setting_key", "eq." + key);
    try {
      const response = await win.fetch(endpoint, {
        headers: { apikey: config.supabaseAnonKey }, signal: AbortSignal.timeout(5000)
      });
      if (response.ok) apply((await response.json())[0]?.setting_value);
    } catch { /* Navigation remains available offline. */ }
  }

  win.Project318Navigation = { key, pages, starter, limit, validate, read };
  const script = win.document.currentScript;
  if (script?.hasAttribute("data-use-settings")) {
    if (win.websiteSettings) apply(win.websiteSettings[key]);
    else win.document.addEventListener("website-settings-ready", e => apply(e.detail?.[key]), { once: true });
  } else if (script?.hasAttribute("data-public-menu")) {
    loadPublicMenu();
  }
})(window);
