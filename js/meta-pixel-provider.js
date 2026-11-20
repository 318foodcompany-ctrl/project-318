(function metaPixelProviderModule(globalScope) {
  "use strict";

  const PIXEL_PATTERN = /^\d{5,20}$/;
  const SCRIPT_ID = "project318-meta-pixel-script";
  const EVENT_MAP = Object.freeze({
    page_view: { standard: ["PageView"] },
    quote_started: { custom: ["QuoteStarted"] },
    quote_submitted: { standard: ["Lead"], custom: ["QuoteSubmitted"] },
    phone_click: { standard: ["Contact"] },
    email_click: { standard: ["Contact"] }
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
    const deliveredEventIds = new Set();
    let initialized = false;
    let loading = null;
    let consentVersion = 0;
    let lastConsent = advertisingAllowed();

    function advertisingAllowed() {
      return Boolean(win.Project318Consent && win.Project318Consent.permits("advertising"));
    }

    function installQueue() {
      if (!win.fbq) {
        const fbq = function fbq() { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = [];
        win.fbq = fbq;
        win._fbq = fbq;
      }
    }

    function configure() {
      if (!advertisingAllowed()) return false;
      if (initialized) return true;
      win.fbq("init", pixelId);
      initialized = true;
      return true;
    }

    function load() {
      if (!validPixelId(pixelId) || !advertisingAllowed()) return Promise.resolve(false);
      if (initialized) return Promise.resolve(true);
      if (loading) return loading.then(ready => ready && configure());

      installQueue();
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
        doc.getElementById(SCRIPT_ID)?.remove();
        loading = null;
        console.error("Meta Pixel could not be loaded:", error);
        return false;
      });
      return loading.then(ready => ready && configure());
    }

    async function send(detail) {
      if (!detail || !detail.event || !advertisingAllowed()) return false;
      const eventId = String(detail.event_id || "").trim();
      if (eventId && deliveredEventIds.has(eventId)) return false;
      if (eventId) deliveredEventIds.add(eventId);
      const version = consentVersion;
      const ready = await load();
      if (!ready || version !== consentVersion || !advertisingAllowed() || typeof win.fbq !== "function") {
        if (eventId) deliveredEventIds.delete(eventId);
        return false;
      }
      const mapping = EVENT_MAP[detail.event];
      const parameters = cleanParameters(detail);
      const options = eventId ? { eventID: eventId } : undefined;
      if (mapping) {
        (mapping.standard || []).forEach((name) => win.fbq("track", name, parameters, options));
        (mapping.custom || []).forEach((name) => win.fbq("trackCustom", name, parameters, options));
      } else win.fbq("trackCustom", detail.event, parameters, options);
      return true;
    }

    function onAnalyticsEvent(event) { send(event.detail); }
    function onConsentChanged() {
      const allowed = advertisingAllowed();
      if (allowed === lastConsent) return;
      lastConsent = allowed;
      consentVersion++;
      if (win.fbq) win.fbq("consent", allowed ? "grant" : "revoke");
      if (allowed) send({ event: "page_view", page_path: win.location?.pathname || "/" });
    }

    win.addEventListener("318:analytics-event", onAnalyticsEvent);
    win.addEventListener("318:consent-changed", onConsentChanged);
    if (advertisingAllowed()) load();

    const api = Object.freeze({ load, send, advertisingAllowed, pixelId });
    win.Project318MetaPixel = api;
    return api;
  }

  const api = { validPixelId, cleanParameters, createProvider, EVENT_MAP };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document) createProvider(globalScope);
})(typeof window !== "undefined" ? window : globalThis);
