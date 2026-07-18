(function metaPixelProviderModule(globalScope) {
  "use strict";

  const PIXEL_PATTERN = /^\d{5,20}$/;
  const SCRIPT_ID = "project318-meta-pixel-script";
  const STANDARD_EVENTS = Object.freeze({
    page_view: "PageView",
    quote_submitted: "Lead",
    phone_click: "Contact",
    email_click: "Contact"
  });

  function validPixelId(value) {
    return PIXEL_PATTERN.test(String(value || "").trim());
  }

  function cleanParameters(detail) {
    const parameters = {};
    Object.entries(detail || {}).forEach(([key, value]) => {
      if (key === "event" || value == null) return;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        parameters[key] = value;
      }
    });
    return parameters;
  }

  function createProvider(win) {
    const doc = win.document;
    const pixelId = String(win.__APP_CONFIG__?.metaPixelId || "").trim();
    let initialized = false;
    let loading = null;

    function advertisingAllowed() {
      return Boolean(win.Project318Consent && win.Project318Consent.permits("advertising"));
    }

    function configure() {
      if (initialized || !validPixelId(pixelId)) return false;
      if (!win.fbq) {
        const fbq = function fbq() { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = [];
        win.fbq = fbq;
        win._fbq = fbq;
      }
      win.fbq("init", pixelId);
      initialized = true;
      return true;
    }

    function load() {
      if (!validPixelId(pixelId) || !advertisingAllowed()) return Promise.resolve(false);
      if (initialized) return Promise.resolve(true);
      if (loading) return loading;

      configure();
      loading = new Promise((resolve, reject) => {
        const existing = doc.getElementById(SCRIPT_ID);
        if (existing) {
          if (existing.dataset.loaded === "true") return resolve(true);
          existing.addEventListener("load", () => resolve(true), { once: true });
          existing.addEventListener("error", reject, { once: true });
          return;
        }
        const script = doc.createElement("script");
        script.id = SCRIPT_ID;
        script.async = true;
        script.src = "https://connect.facebook.net/en_US/fbevents.js";
        script.onload = () => { script.dataset.loaded = "true"; resolve(true); };
        script.onerror = reject;
        doc.head.appendChild(script);
      }).catch((error) => {
        loading = null;
        console.error("Meta Pixel could not be loaded:", error);
        return false;
      });
      return loading;
    }

    async function send(detail) {
      if (!detail || !detail.event || !advertisingAllowed()) return false;
      const ready = await load();
      if (!ready || typeof win.fbq !== "function") return false;
      const standard = STANDARD_EVENTS[detail.event];
      const parameters = cleanParameters(detail);
      if (standard) win.fbq("track", standard, parameters);
      else win.fbq("trackCustom", detail.event, parameters);
      return true;
    }

    function onAnalyticsEvent(event) { send(event.detail); }
    function onConsentChanged(event) {
      if (event.detail?.advertising !== true) return;
      load().then((ready) => {
        if (ready) win.fbq("track", "PageView", { page_path: win.location?.pathname || "/" });
      });
    }

    win.addEventListener("318:analytics-event", onAnalyticsEvent);
    win.addEventListener("318:consent-changed", onConsentChanged);
    if (advertisingAllowed()) load();

    const api = Object.freeze({ load, send, advertisingAllowed, pixelId });
    win.Project318MetaPixel = api;
    return api;
  }

  const api = { validPixelId, cleanParameters, createProvider, STANDARD_EVENTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document) createProvider(globalScope);
})(typeof window !== "undefined" ? window : globalThis);
