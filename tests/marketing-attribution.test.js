"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const attribution = require("../js/marketing-attribution.js");

function location(search = "", pathname = "/", hostname = "www.318foodco.com") {
  return { search, pathname, hostname };
}

function storage() {
  const values = new Map();
  return { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, value); } };
}

function cryptoIds() {
  let sequence = 0;
  return { randomUUID() { sequence += 1; return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`; } };
}

test("captures complete UTM attribution without storing the query string", () => {
  const touch = attribution.classifyTouch(location("?utm_source=google&utm_medium=cpc&utm_campaign=office+lunch&utm_id=cmp-7&utm_term=catering&utm_content=red-ad&gclid=click-1", "/corporate.html"), "", "2026-07-18T12:00:00.000Z");
  assert.deepEqual({ source: touch.source, medium: touch.medium, campaign: touch.campaign, campaign_id: touch.campaign_id, gclid: touch.gclid, landing_path: touch.landing_path }, { source: "google", medium: "cpc", campaign: "office lunch", campaign_id: "cmp-7", gclid: "click-1", landing_path: "/corporate.html" });
  assert.equal(JSON.stringify(touch).includes("utm_source"), false);
});

test("classifies Google and Facebook click identifiers", () => {
  const google = attribution.classifyTouch(location("?gclid=g-1&gbraid=gb-1&wbraid=wb-1"), "", new Date().toISOString());
  assert.deepEqual({ source: google.source, medium: google.medium }, { source: "google", medium: "cpc" });
  assert.deepEqual({ gclid: google.gclid, gbraid: google.gbraid, wbraid: google.wbraid }, { gclid: "g-1", gbraid: "gb-1", wbraid: "wb-1" });
  const facebook = attribution.classifyTouch(location("?fbclid=f-1"), "", new Date().toISOString());
  assert.deepEqual({ source: facebook.source, medium: facebook.medium }, { source: "facebook", medium: "paid_social" });
  assert.equal(facebook.fbclid, "f-1");
});

test("bounds oversized values and deterministically uses the first duplicated parameter", () => {
  const touch = attribution.classifyTouch(location(`?utm_source=first&utm_source=second&utm_campaign=${"x".repeat(800)}&gclid=${"g".repeat(800)}`), "", new Date().toISOString());
  assert.equal(touch.source, "first");
  assert.equal(touch.campaign.length, 500);
  assert.equal(touch.gclid.length, 500);
});

test("handles malformed encoded campaign parameters without throwing", () => {
  const touch = attribution.classifyTouch(location("?utm_source=%E0%A4%A&utm_medium=cpc&utm_campaign=%"), "", new Date().toISOString());
  assert.equal(touch.medium, "cpc");
  assert.equal(typeof touch.source, "string");
  assert.equal(typeof touch.campaign, "string");
  assert.equal(touch.source.length <= 255, true);
  assert.equal(touch.campaign.length <= 500, true);
});

test("classifies external referrers and ignores same-site referrers", () => {
  const referral = attribution.classifyTouch(location(), "https://example.org/article", new Date().toISOString());
  assert.deepEqual({ source: referral.source, medium: referral.medium }, { source: "example.org", medium: "referral" });
  assert.equal(attribution.classifyTouch(location(), "https://www.318foodco.com/about.html", new Date().toISOString()).source, "direct");
});

test("preserves first touch and updates the last non-direct touch", () => {
  const stateStorage = storage();
  const ids = cryptoIds();
  const first = attribution.initialize({ storage: stateStorage, crypto: ids, location: location("?utm_source=google&utm_medium=cpc", "/corporate.html"), referrer: "", now: new Date("2026-07-18T12:00:00Z") });
  const second = attribution.initialize({ storage: stateStorage, crypto: ids, location: location("?utm_source=facebook&utm_medium=paid_social", "/catering.html"), referrer: "", now: new Date("2026-07-18T12:10:00Z") });
  assert.equal(second.visitor_id, first.visitor_id);
  assert.equal(second.session_id, first.session_id);
  assert.equal(second.first_touch.source, "google");
  assert.equal(second.last_non_direct_touch.source, "facebook");
});

test("direct return does not overwrite last non-direct attribution", () => {
  const stateStorage = storage();
  const ids = cryptoIds();
  attribution.initialize({ storage: stateStorage, crypto: ids, location: location("?utm_source=google&utm_medium=cpc"), referrer: "", now: new Date("2026-07-18T12:00:00Z") });
  const direct = attribution.initialize({ storage: stateStorage, crypto: ids, location: location("", "/quote-builder.html"), referrer: "", now: new Date("2026-07-18T12:10:00Z") });
  assert.equal(direct.last_non_direct_touch.source, "google");
});

test("starts a new session after thirty minutes while retaining visitor and first touch", () => {
  const stateStorage = storage();
  const ids = cryptoIds();
  const first = attribution.initialize({ storage: stateStorage, crypto: ids, location: location("?utm_source=google"), referrer: "", now: new Date("2026-07-18T12:00:00Z") });
  const later = attribution.initialize({ storage: stateStorage, crypto: ids, location: location(), referrer: "", now: new Date("2026-07-18T12:31:00Z") });
  assert.equal(later.visitor_id, first.visitor_id);
  assert.notEqual(later.session_id, first.session_id);
  assert.equal(later.first_touch.source, "google");
});
