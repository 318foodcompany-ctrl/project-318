(function siteContentLoaderModule(globalScope) {
  "use strict";
  function safeText(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 10000 ? trimmed : "";
  }
  function safeLink(value) {
    const link = safeText(value);
    if (!link || link.length > 1000) return "";
    return /^(?:https?:\/\/|mailto:|tel:|#|[a-z0-9._/-]+\.html(?:#[a-z0-9_-]+)?$)/i.test(link) ? link : "";
  }
  async function load(options) {
    const client = globalScope.supabaseClient;
    if (!client || !options?.page || !options?.attribute) return { loaded: 0, fallback: true };
    const { data, error } = await client.from("website_content")
      .select("content_key, content_value, updated_at").eq("page", options.page);
    if (error) {
      console.error(`Could not load ${options.page} page content:`, error);
      return { loaded: 0, fallback: true, error };
    }
    const values = Object.fromEntries((data || []).map(row => [row.content_key, row.content_value]));
    let loaded = 0;
    document.querySelectorAll(`[${options.attribute}]`).forEach(element => {
      const value = safeText(values[element.getAttribute(options.attribute)]);
      if (!value) return;
      element.textContent = value;
      loaded += 1;
    });
    document.querySelectorAll(`[${options.linkAttribute || "data-content-link"}]`).forEach(element => {
      const value = safeLink(values[element.getAttribute(options.linkAttribute || "data-content-link")]);
      if (value) element.setAttribute("href", value);
    });
    return { loaded, fallback: false };
  }
  function loadWhenReady(options) {
    const run = () => load(options);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
  }
  const api = { safeText, safeLink, load, loadWhenReady };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.Project318SiteContent = api;
})(typeof window !== "undefined" ? window : globalThis);
