(function analyticsEventsModule(globalScope) {
  "use strict";

  const EVENT_PREFIX = "318:";
  const VALID_EVENT = /^[a-z][a-z0-9_]{1,63}$/;
  const MAX_TEXT = 160;

  function safeText(value, maximum = MAX_TEXT) {
    return String(value == null ? "" : value).trim().slice(0, maximum);
  }

  function cleanProperties(properties) {
    const clean = {};
    if (!properties || typeof properties !== "object") return clean;
    Object.entries(properties).forEach(([key, value]) => {
      const cleanKey = safeText(key, 64).replace(/[^a-zA-Z0-9_]/g, "_");
      if (!cleanKey || value == null) return;
      if (typeof value === "number" && Number.isFinite(value)) clean[cleanKey] = value;
      else if (typeof value === "boolean") clean[cleanKey] = value;
      else clean[cleanKey] = safeText(value);
    });
    return clean;
  }

  function eventName(name) {
    const normalized = safeText(name, 64).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    return VALID_EVENT.test(normalized) ? normalized : "site_interaction";
  }

  function linkKind(anchor) {
    const href = safeText(anchor && anchor.getAttribute ? anchor.getAttribute("href") : "", 1000).toLowerCase();
    if (href.startsWith("tel:")) return "phone_click";
    if (href.startsWith("mailto:")) return "email_click";
    if (/\.(pdf|docx?|xlsx?)(\?|#|$)/.test(href)) return "file_download";
    if (href.includes("maps.google") || href.includes("google.com/maps")) return "directions_click";
    return "cta_click";
  }

  function createEventId(cryptoObject) {
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") return cryptoObject.randomUUID();
    return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }

  function createTracker(win) {
    const doc = win.document;
    const sentScrollDepths = new Set();
    const sentOnceKeys = new Set();
    let quoteStarted = false;

    function analyticsAllowed() {
      return Boolean(win.Project318Consent && win.Project318Consent.permits("analytics"));
    }

    function track(name, properties = {}, options = {}) {
      const normalizedName = eventName(name);
      const onceKey = safeText(options.onceKey, 200);
      if (onceKey && sentOnceKeys.has(onceKey)) return false;
      if (onceKey) sentOnceKeys.add(onceKey);
      const detail = {
        event: normalizedName,
        event_id: safeText(options.eventId, 100) || createEventId(win.crypto),
        page_path: safeText(win.location && win.location.pathname, 500) || "/",
        page_title: safeText(doc.title, 160),
        ...cleanProperties(properties)
      };
      win.dispatchEvent(new win.CustomEvent(`${EVENT_PREFIX}analytics-event`, { detail: { ...detail } }));
      if (!analyticsAllowed()) return false;
      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push(detail);
      return true;
    }

    function trackLink(anchor) {
      const kind = linkKind(anchor);
      return track(kind, {
        link_text: safeText(anchor.textContent || anchor.getAttribute("aria-label"), 120),
        link_url: safeText(anchor.getAttribute("href"), 500),
        location: safeText(anchor.dataset.analyticsLocation || anchor.closest("header,main,footer")?.tagName || "page", 40).toLowerCase()
      });
    }

    function onClick(event) {
      const anchor = event.target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      const isTrackedCta = anchor.matches(".btn, [data-analytics-event]") || href.startsWith("tel:") || href.startsWith("mailto:") || /\.(pdf|docx?|xlsx?)(\?|#|$)/i.test(href) || href.includes("maps.google") || href.includes("google.com/maps");
      if (!isTrackedCta) return;
      const customEvent = anchor.dataset.analyticsEvent;
      track(customEvent || linkKind(anchor), {
        link_text: safeText(anchor.textContent || anchor.getAttribute("aria-label"), 120),
        link_url: safeText(href, 500),
        location: safeText(anchor.dataset.analyticsLocation || anchor.closest("header,main,footer")?.tagName || "page", 40).toLowerCase()
      });
    }

    function bindQuoteForms() {
      doc.querySelectorAll("form").forEach((form) => {
        const quoteForm = form.id === "quoteForm" || /quote/i.test(form.id || "") || /quote/i.test(form.getAttribute("aria-label") || "");
        if (!quoteForm) return;
        form.addEventListener("input", () => {
          if (quoteStarted) return;
          quoteStarted = true;
          track("quote_started", { form_id: form.id || "quote_form" });
        }, { once: true });
        form.addEventListener("submit", () => track("quote_attempted", { form_id: form.id || "quote_form" }));
      });
    }

    function onScroll() {
      const root = doc.documentElement;
      const maximum = Math.max(1, root.scrollHeight - win.innerHeight);
      const percentage = Math.min(100, Math.round((win.scrollY / maximum) * 100));
      [25, 50, 75, 90].forEach((depth) => {
        if (percentage >= depth && !sentScrollDepths.has(depth)) {
          sentScrollDepths.add(depth);
          track("scroll_depth", { percent_scrolled: depth });
        }
      });
    }

    function initialize() {
      doc.addEventListener("click", onClick);
      bindQuoteForms();
      win.addEventListener("scroll", onScroll, { passive: true });
      win.addEventListener("318:consent-changed", (event) => {
        if (event.detail && event.detail.analytics === true) track("analytics_consent_granted");
      });
      track("page_view");
    }

    const api = Object.freeze({ track, trackLink, analyticsAllowed });
    win.Project318Analytics = api;
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
    return api;
  }

  const api = { safeText, cleanProperties, eventName, linkKind, createEventId, createTracker };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document) createTracker(globalScope);
})(typeof window !== "undefined" ? window : globalThis);
