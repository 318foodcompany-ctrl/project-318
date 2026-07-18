(() => {
  'use strict';

  const STORAGE_KEY = '318_consent_preferences';
  const CONSENT_VERSION = '2026-07-18';
  const MAX_AGE_DAYS = 180;

  const DEFAULTS = Object.freeze({
    version: CONSENT_VERSION,
    analytics: false,
    advertising: false,
    decided: false,
    updatedAt: null,
    expiresAt: null
  });

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function normalize(value) {
    if (!value || typeof value !== 'object') return { ...DEFAULTS };
    const expired = !value.expiresAt || Date.parse(value.expiresAt) <= Date.now();
    const wrongVersion = value.version !== CONSENT_VERSION;
    if (expired || wrongVersion) return { ...DEFAULTS };
    return {
      version: CONSENT_VERSION,
      analytics: value.analytics === true,
      advertising: value.advertising === true,
      decided: value.decided === true,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
      expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : null
    };
  }

  function readConsent() {
    try {
      return normalize(safeParse(localStorage.getItem(STORAGE_KEY)));
    } catch (_error) {
      return { ...DEFAULTS };
    }
  }

  function writeConsent(next) {
    const updatedAt = new Date();
    const expiresAt = new Date(updatedAt.getTime() + MAX_AGE_DAYS * 86400000);
    const value = {
      version: CONSENT_VERSION,
      analytics: next.analytics === true,
      advertising: next.advertising === true,
      decided: true,
      updatedAt: updatedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (_error) {
      // Consent still applies for the current page even if storage is unavailable.
    }
    applyConsent(value);
    window.dispatchEvent(new CustomEvent('318:consent-changed', { detail: { ...value } }));
    return value;
  }

  function applyConsent(value) {
    const analytics = value.analytics === true ? 'granted' : 'denied';
    const advertising = value.advertising === true ? 'granted' : 'denied';

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag('consent', value.decided ? 'update' : 'default', {
      analytics_storage: analytics,
      ad_storage: advertising,
      ad_user_data: advertising,
      ad_personalization: advertising,
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: value.decided ? 0 : 500
    });

    document.documentElement.dataset.analyticsConsent = analytics;
    document.documentElement.dataset.advertisingConsent = advertising;
  }

  function closePreferences() {
    document.querySelector('[data-consent-modal]')?.remove();
    document.body.classList.remove('consent-modal-open');
  }

  function hideBanner() {
    document.querySelector('[data-consent-banner]')?.remove();
  }

  function saveAndClose(preferences) {
    writeConsent(preferences);
    hideBanner();
    closePreferences();
  }

  function openPreferences() {
    closePreferences();
    const current = readConsent();
    const overlay = document.createElement('div');
    overlay.className = 'consent-modal-overlay';
    overlay.dataset.consentModal = '';
    overlay.innerHTML = `
      <section class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <button class="consent-close" type="button" aria-label="Close privacy preferences">×</button>
        <p class="consent-kicker">Privacy preferences</p>
        <h2 id="consent-title">Choose how we use data</h2>
        <p>Necessary storage keeps the website working. Optional analytics helps us understand website performance. Advertising storage helps measure and improve paid campaigns.</p>
        <div class="consent-option consent-option-required">
          <div><strong>Necessary</strong><small>Required for core website functions and security.</small></div>
          <span>Always on</span>
        </div>
        <label class="consent-option">
          <div><strong>Analytics</strong><small>Anonymous website usage and performance measurement.</small></div>
          <input type="checkbox" name="analytics" ${current.analytics ? 'checked' : ''}>
        </label>
        <label class="consent-option">
          <div><strong>Advertising</strong><small>Advertising measurement, personalization, and campaign reporting.</small></div>
          <input type="checkbox" name="advertising" ${current.advertising ? 'checked' : ''}>
        </label>
        <p class="consent-policy-note">You can change or withdraw consent at any time. See our <a href="privacy.html">Privacy Policy</a>.</p>
        <div class="consent-actions">
          <button class="btn alt" type="button" data-consent-reject>Reject optional</button>
          <button class="btn" type="button" data-consent-save>Save choices</button>
        </div>
      </section>`;

    document.body.appendChild(overlay);
    document.body.classList.add('consent-modal-open');
    overlay.querySelector('.consent-close').addEventListener('click', closePreferences);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closePreferences();
    });
    overlay.querySelector('[data-consent-reject]').addEventListener('click', () => saveAndClose({ analytics: false, advertising: false }));
    overlay.querySelector('[data-consent-save]').addEventListener('click', () => saveAndClose({
      analytics: overlay.querySelector('[name="analytics"]').checked,
      advertising: overlay.querySelector('[name="advertising"]').checked
    }));
    overlay.querySelector('[name="analytics"]').focus();
  }

  function showBanner() {
    if (document.querySelector('[data-consent-banner]')) return;
    const banner = document.createElement('aside');
    banner.className = 'consent-banner';
    banner.dataset.consentBanner = '';
    banner.setAttribute('aria-label', 'Privacy choices');
    banner.innerHTML = `
      <div class="consent-banner-copy">
        <strong>Your privacy choices</strong>
        <p>We use necessary storage to run this site. With your permission, we may also use analytics and advertising tools. <a href="privacy.html">Learn more</a>.</p>
      </div>
      <div class="consent-banner-actions">
        <button type="button" class="consent-text-button" data-consent-customize>Customize</button>
        <button type="button" class="btn alt" data-consent-reject>Reject optional</button>
        <button type="button" class="btn" data-consent-accept>Accept all</button>
      </div>`;
    document.body.appendChild(banner);
    banner.querySelector('[data-consent-customize]').addEventListener('click', openPreferences);
    banner.querySelector('[data-consent-reject]').addEventListener('click', () => saveAndClose({ analytics: false, advertising: false }));
    banner.querySelector('[data-consent-accept]').addEventListener('click', () => saveAndClose({ analytics: true, advertising: true }));
  }

  function addFooterControl() {
    const copyright = document.querySelector('.footer .copyright');
    if (!copyright || copyright.querySelector('[data-privacy-settings]')) return;
    const separator = document.createTextNode(' · ');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'privacy-settings-link';
    button.dataset.privacySettings = '';
    button.textContent = 'Privacy settings';
    button.addEventListener('click', openPreferences);
    copyright.append(separator, button);
  }

  const initial = readConsent();
  applyConsent(initial);

  window.Project318Consent = Object.freeze({
    get: readConsent,
    open: openPreferences,
    acceptAll: () => saveAndClose({ analytics: true, advertising: true }),
    rejectOptional: () => saveAndClose({ analytics: false, advertising: false }),
    version: CONSENT_VERSION
  });

  document.addEventListener('DOMContentLoaded', () => {
    addFooterControl();
    if (!initial.decided) showBanner();
  });
})();
