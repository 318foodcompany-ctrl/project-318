(function attributionModule(globalScope) {
  "use strict";

  const VISITOR_KEY = "p318_marketing_visitor_v1";
  const SESSION_KEY = "p318_marketing_session_v1";
  const FIRST_TOUCH_KEY = "p318_marketing_first_touch_v1";
  const LAST_TOUCH_KEY = "p318_marketing_last_non_direct_v1";
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  function safeText(value, maximum) {
    return String(value || "").trim().slice(0, maximum);
  }

  function createId(cryptoObject) {
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") return cryptoObject.randomUUID();
    const bytes = new Uint8Array(16);
    if (cryptoObject && typeof cryptoObject.getRandomValues === "function") cryptoObject.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  function readJson(storage, key) {
    try {
      const value = JSON.parse(storage.getItem(key));
      return value && typeof value === "object" ? value : null;
    } catch (_error) { return null; }
  }

  function writeJson(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch (_error) { return false; }
  }

  function externalReferrerHost(referrer, currentHost) {
    if (!referrer) return "";
    try {
      const host = new URL(referrer).hostname.toLowerCase();
      return host && host !== String(currentHost || "").toLowerCase() ? host : "";
    } catch (_error) { return ""; }
  }

  function classifyTouch(locationObject, referrer, nowIso) {
    const params = new URLSearchParams(locationObject.search || "");
    const referrerHost = externalReferrerHost(referrer, locationObject.hostname);
    let source = safeText(params.get("utm_source"), 255);
    let medium = safeText(params.get("utm_medium"), 255);
    const gclid = safeText(params.get("gclid"), 500);
    const gbraid = safeText(params.get("gbraid"), 500);
    const wbraid = safeText(params.get("wbraid"), 500);
    const fbclid = safeText(params.get("fbclid"), 500);
    if (!source && (gclid || gbraid || wbraid)) source = "google";
    if (!medium && (gclid || gbraid || wbraid)) medium = "cpc";
    if (!source && fbclid) source = "facebook";
    if (!medium && fbclid) medium = "paid_social";
    if (!source && referrerHost) source = referrerHost;
    if (!medium && referrerHost) medium = "referral";
    if (!source) source = "direct";
    if (!medium) medium = "(none)";
    return {
      occurred_at: nowIso, source, medium,
      campaign: safeText(params.get("utm_campaign"), 500),
      campaign_id: safeText(params.get("utm_id"), 255),
      term: safeText(params.get("utm_term"), 500),
      content: safeText(params.get("utm_content"), 500),
      landing_path: safeText(locationObject.pathname || "/", 1000) || "/",
      referrer_host: safeText(referrerHost, 255), gclid, gbraid, wbraid, fbclid
    };
  }

  function isDirect(touch) { return touch.source === "direct" && touch.medium === "(none)"; }

  function initialize(options) {
    const storage = options.storage;
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const nowIso = now.toISOString();
    const currentTouch = classifyTouch(options.location, options.referrer || "", nowIso);
    let visitor = readJson(storage, VISITOR_KEY);
    let session = readJson(storage, SESSION_KEY);
    let firstTouch = readJson(storage, FIRST_TOUCH_KEY);
    let lastNonDirectTouch = readJson(storage, LAST_TOUCH_KEY);
    if (!visitor || !visitor.id) {
      visitor = { id: createId(options.crypto), first_seen_at: nowIso };
      writeJson(storage, VISITOR_KEY, visitor);
    }
    const lastSeen = session ? Date.parse(session.last_seen_at) : NaN;
    if (!session || !session.id || !Number.isFinite(lastSeen) || now.getTime() - lastSeen > SESSION_TIMEOUT_MS) {
      session = { id: createId(options.crypto), started_at: nowIso, last_seen_at: nowIso, landing_path: currentTouch.landing_path, referrer_host: currentTouch.referrer_host };
    } else session.last_seen_at = nowIso;
    writeJson(storage, SESSION_KEY, session);
    if (!firstTouch) { firstTouch = currentTouch; writeJson(storage, FIRST_TOUCH_KEY, firstTouch); }
    if (!isDirect(currentTouch)) { lastNonDirectTouch = currentTouch; writeJson(storage, LAST_TOUCH_KEY, lastNonDirectTouch); }
    return {
      visitor_id: visitor.id, session_id: session.id, session_started_at: session.started_at,
      landing_path: session.landing_path, referrer_host: session.referrer_host,
      first_touch: firstTouch, last_non_direct_touch: lastNonDirectTouch || firstTouch
    };
  }

  const api = { classifyTouch, createId, initialize, isDirect, SESSION_TIMEOUT_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document && globalScope.location && globalScope.localStorage) {
    const state = initialize({ storage: globalScope.localStorage, location: globalScope.location, referrer: globalScope.document.referrer, crypto: globalScope.crypto, now: new Date() });
    globalScope.Project318Attribution = { snapshot() { return JSON.parse(JSON.stringify(state)); } };
  }
})(typeof window !== "undefined" ? window : globalThis);
