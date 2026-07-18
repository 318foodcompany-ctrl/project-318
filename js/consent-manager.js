(function consentModule(globalScope) {
  "use strict";

  const STORAGE_KEY = "318_consent_preferences";
  const CONSENT_VERSION = "2026-07-18";
  const MAX_AGE_DAYS = 180;
  const DAY_MS = 86400000;

  const DEFAULTS = Object.freeze({
    version: CONSENT_VERSION,
    analytics: false,
    advertising: false,
    decided: false,
    updatedAt: null,
    expiresAt: null
  });

  function cloneDefaults() { return { ...DEFAULTS }; }

  function safeParse(value) {
    try { return JSON.parse(value); }
    catch (_error) { return null; }
  }

  function normalize(value, now = new Date()) {
    if (!value || typeof value !== "object") return cloneDefaults();
    const expiresAt = typeof value.expiresAt === "string" ? Date.parse(value.expiresAt) : NaN;
    const expired = !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
    if (expired || value.version !== CONSENT_VERSION) return cloneDefaults();
    return {
      version: CONSENT_VERSION,
      analytics: value.analytics === true,
      advertising: value.advertising === true,
      decided: value.decided === true,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
      expiresAt: value.expiresAt
    };
  }

  function readConsent(storage, now = new Date()) {
    try { return normalize(safeParse(storage.getItem(STORAGE_KEY)), now); }
    catch (_error) { return cloneDefaults(); }
  }

  function buildConsent(preferences, now = new Date()) {
    return {
      version: CONSENT_VERSION,
      analytics: preferences.analytics === true,
      advertising: preferences.advertising === true,
      decided: true,
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + MAX_AGE_DAYS * DAY_MS).toISOString()
    };
  }

  function consentSignals(value) {
    const analytics = value.analytics === true ? "granted" : "denied";
    const advertising = value.advertising === true ? "granted" : "denied";
    return {
      analytics_storage: analytics,
      ad_storage: advertising,
      ad_user_data: advertising,
      ad_personalization: advertising,
      functionality_storage: "granted",
      security_storage: "granted",
      wait_for_update: value.decided ? 0 : 500
    };
  }

  function permits(value, category) {
    if (category === "necessary") return true;
    if (category === "analytics") return value.analytics === true;
    if (category === "advertising") return value.advertising === true;
    return false;
  }

  function createBrowserManager(win) {
    const doc = win.document;
    const storage = win.localStorage;

    function applyConsent(value) {
      const signals = consentSignals(value);
      win.dataLayer = win.dataLayer || [];
      win.gtag = win.gtag || function gtag() { win.dataLayer.push(arguments); };
      win.gtag("consent", value.decided ? "update" : "default", signals);
      doc.documentElement.dataset.analyticsConsent = signals.analytics_storage;
      doc.documentElement.dataset.advertisingConsent = signals.ad_storage;
      return signals;
    }

    function get() { return readConsent(storage); }

    function write(preferences) {
      const value = buildConsent(preferences);
      try { storage.setItem(STORAGE_KEY, JSON.stringify(value)); }
      catch (_error) { /* Current-page consent still applies. */ }
      applyConsent(value);
      win.dispatchEvent(new win.CustomEvent("318:consent-changed", { detail: { ...value } }));
      return value;
    }

    function closePreferences() {
      doc.querySelector("[data-consent-modal]")?.remove();
      doc.body.classList.remove("consent-modal-open");
    }

    function hideBanner() { doc.querySelector("[data-consent-banner]")?.remove(); }

    function saveAndClose(preferences) {
      const value = write(preferences);
      hideBanner();
      closePreferences();
      return value;
    }

    function openPreferences() {
      closePreferences();
      const current = get();
      const overlay = doc.createElement("div");
      overlay.className = "consent-modal-overlay";
      overlay.dataset.consentModal = "";
      overlay.innerHTML = `
        <section class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <button class="consent-close" type="button" aria-label="Close privacy preferences">×</button>
          <p class="consent-kicker">Privacy preferences</p>
          <h2 id="consent-title">Choose how we use data</h2>
          <p>Necessary storage keeps the website working. Optional analytics helps us understand website performance. Advertising storage helps measure and improve paid campaigns.</p>
          <div class="consent-option consent-option-required"><div><strong>Necessary</strong><small>Required for core website functions and security.</small></div><span>Always on</span></div>
          <label class="consent-option"><div><strong>Analytics</strong><small>Anonymous website usage and performance measurement.</small></div><input type="checkbox" name="analytics" ${current.analytics ? "checked" : ""}></label>
          <label class="consent-option"><div><strong>Advertising</strong><small>Advertising measurement, personalization, and campaign reporting.</small></div><input type="checkbox" name="advertising" ${current.advertising ? "checked" : ""}></label>
          <p class="consent-policy-note">You can change or withdraw consent at any time. See our <a href="privacy.html">Privacy Policy</a>.</p>
          <div class="consent-actions"><button class="btn alt" type="button" data-consent-reject>Reject optional</button><button class="btn" type="button" data-consent-save>Save choices</button></div>
        </section>`;
      doc.body.appendChild(overlay);
      doc.body.classList.add("consent-modal-open");
      overlay.querySelector(".consent-close").addEventListener("click", closePreferences);
      overlay.addEventListener("click", event => { if (event.target === overlay) closePreferences(); });
      overlay.addEventListener("keydown", event => { if (event.key === "Escape") closePreferences(); });
      overlay.querySelector("[data-consent-reject]").addEventListener("click", () => saveAndClose({ analytics: false, advertising: false }));
      overlay.querySelector("[data-consent-save]").addEventListener("click", () => saveAndClose({
        analytics: overlay.querySelector('[name="analytics"]').checked,
        advertising: overlay.querySelector('[name="advertising"]').checked
      }));
      overlay.querySelector('[name="analytics"]').focus();
    }

    function showBanner() {
      if (doc.querySelector("[data-consent-banner]")) return;
      const banner = doc.createElement("aside");
      banner.className = "consent-banner";
      banner.dataset.consentBanner = "";
      banner.setAttribute("aria-label", "Privacy choices");
      banner.innerHTML = `<div class="consent-banner-copy"><strong>Your privacy choices</strong><p>We use necessary storage to run this site. With your permission, we may also use analytics and advertising tools. <a href="privacy.html">Learn more</a>.</p></div><div class="consent-banner-actions"><button type="button" class="consent-text-button" data-consent-customize>Customize</button><button type="button" class="btn alt" data-consent-reject>Reject optional</button><button type="button" class="btn" data-consent-accept>Accept all</button></div>`;
      doc.body.appendChild(banner);
      banner.querySelector("[data-consent-customize]").addEventListener("click", openPreferences);
      banner.querySelector("[data-consent-reject]").addEventListener("click", () => saveAndClose({ analytics: false, advertising: false }));
      banner.querySelector("[data-consent-accept]").addEventListener("click", () => saveAndClose({ analytics: true, advertising: true }));
    }

    function addFooterControl() {
      const copyright = doc.querySelector(".footer .copyright");
      if (!copyright || copyright.querySelector("[data-privacy-settings]")) return;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "privacy-settings-link";
      button.dataset.privacySettings = "";
      button.textContent = "Privacy settings";
      button.addEventListener("click", openPreferences);
      copyright.append(doc.createTextNode(" · "), button);
    }

    function loadScript(options) {
      const category = options.category || "necessary";
      const current = get();
      if (!permits(current, category)) return Promise.resolve(false);
      if (options.id && doc.getElementById(options.id)) return Promise.resolve(true);
      return new Promise((resolve, reject) => {
        const script = doc.createElement("script");
        if (options.id) script.id = options.id;
        script.src = options.src;
        script.async = options.async !== false;
        script.onload = () => resolve(true);
        script.onerror = reject;
        doc.head.appendChild(script);
      });
    }

    const initial = get();
    applyConsent(initial);
    const api = Object.freeze({
      get,
      open: openPreferences,
      acceptAll: () => saveAndClose({ analytics: true, advertising: true }),
      rejectOptional: () => saveAndClose({ analytics: false, advertising: false }),
      permits: category => permits(get(), category),
      loadScript,
      version: CONSENT_VERSION
    });
    win.Project318Consent = api;
    doc.addEventListener("DOMContentLoaded", () => {
      addFooterControl();
      if (!initial.decided) showBanner();
    });
    return api;
  }

  const api = { STORAGE_KEY, CONSENT_VERSION, MAX_AGE_DAYS, DEFAULTS, safeParse, normalize, readConsent, buildConsent, consentSignals, permits, createBrowserManager };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document && globalScope.localStorage) createBrowserManager(globalScope);
})(typeof window !== "undefined" ? window : globalThis);
