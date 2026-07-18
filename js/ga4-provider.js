(function ga4ProviderModule(globalScope) {
  "use strict";

  const MEASUREMENT_PATTERN = /^G-[A-Z0-9]{6,20}$/;
  const SCRIPT_ID = "project318-ga4-script";

  function validMeasurementId(value) {
    return MEASUREMENT_PATTERN.test(String(value || "").trim().toUpperCase());
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
    const measurementId = String(win.__APP_CONFIG__?.ga4MeasurementId || "").trim().toUpperCase();
    let initialized = false;
    let loading = null;

    function analyticsAllowed() {
      return Boolean(win.Project318Consent && win.Project318Consent.permits("analytics"));
    }

    function configure() {
      if (initialized || !validMeasurementId(measurementId)) return false;
      win.dataLayer = win.dataLayer || [];
      win.gtag = win.gtag || function gtag() { win.dataLayer.push(arguments); };
      win.gtag("js", new Date());
      win.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      initialized = true;
      return true;
    }

    function load() {
      if (!validMeasurementId(measurementId) || !analyticsAllowed()) return Promise.resolve(false);
      if (initialized) return Promise.resolve(true);
      if (loading) return loading;

      loading = new Promise((resolve, reject) => {
        const existing = doc.getElementById(SCRIPT_ID);
        if (existing) {
          existing.addEventListener("load", () => resolve(configure()), { once: true });
          existing.addEventListener("error", reject, { once: true });
          return;
        }
        const script = doc.createElement("script");
        script.id = SCRIPT_ID;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.onload = () => resolve(configure());
        script.onerror = reject;
        doc.head.appendChild(script);
      }).catch((error) => {
        loading = null;
        console.error("GA4 could not be loaded:", error);
        return false;
      });

      return loading;
    }

    async function send(detail) {
      if (!detail || !detail.event || !analyticsAllowed()) return false;
      const ready = await load();
      if (!ready || typeof win.gtag !== "function") return false;
      win.gtag("event", detail.event, cleanParameters(detail));
      return true;
    }

    function onAnalyticsEvent(event) {
      send(event.detail);
    }

    function onConsentChanged(event) {
      if (event.detail?.analytics !== true) return;
      load().then((ready) => {
        if (!ready) return;
        send({
          event: "page_view",
          page_path: win.location?.pathname || "/",
          page_title: doc.title
        });
      });
    }

    win.addEventListener("318:analytics-event", onAnalyticsEvent);
    win.addEventListener("318:consent-changed", onConsentChanged);
    if (analyticsAllowed()) load();

    const api = Object.freeze({ load, send, analyticsAllowed, measurementId });
    win.Project318GA4 = api;
    return api;
  }

  const api = { validMeasurementId, cleanParameters, createProvider };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document) createProvider(globalScope);
})(typeof window !== "undefined" ? window : globalThis);
