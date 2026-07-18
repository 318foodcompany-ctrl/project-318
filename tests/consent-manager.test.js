"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const consent = require("../js/consent-manager.js");

function storage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(consent.STORAGE_KEY, initial);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    value() { return values.get(consent.STORAGE_KEY); }
  };
}

const NOW = new Date("2026-07-18T20:00:00.000Z");

test("defaults optional consent to denied", () => {
  assert.deepEqual(consent.readConsent(storage(), NOW), consent.DEFAULTS);
  assert.deepEqual(consent.consentSignals(consent.DEFAULTS), {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });
});

test("builds a versioned consent record with a 180 day expiration", () => {
  const value = consent.buildConsent({ analytics: true, advertising: false }, NOW);
  assert.equal(value.version, consent.CONSENT_VERSION);
  assert.equal(value.analytics, true);
  assert.equal(value.advertising, false);
  assert.equal(value.decided, true);
  assert.equal(value.updatedAt, NOW.toISOString());
  assert.equal(Date.parse(value.expiresAt) - NOW.getTime(), 180 * 86400000);
});

test("accepts a valid current consent record", () => {
  const value = consent.buildConsent({ analytics: true, advertising: true }, NOW);
  const later = new Date("2026-07-19T20:00:00.000Z");
  assert.deepEqual(consent.readConsent(storage(JSON.stringify(value)), later), value);
});

test("expired consent is reset and must be requested again", () => {
  const value = consent.buildConsent({ analytics: true, advertising: true }, NOW);
  const afterExpiry = new Date(Date.parse(value.expiresAt) + 1);
  assert.deepEqual(consent.readConsent(storage(JSON.stringify(value)), afterExpiry), consent.DEFAULTS);
});

test("older policy versions are reset", () => {
  const value = consent.buildConsent({ analytics: true, advertising: true }, NOW);
  value.version = "2025-01-01";
  assert.deepEqual(consent.readConsent(storage(JSON.stringify(value)), NOW), consent.DEFAULTS);
});

test("malformed storage fails closed", () => {
  assert.deepEqual(consent.readConsent(storage("{not-json"), NOW), consent.DEFAULTS);
});

test("category permissions never grant unknown categories", () => {
  const value = consent.buildConsent({ analytics: true, advertising: false }, NOW);
  assert.equal(consent.permits(value, "necessary"), true);
  assert.equal(consent.permits(value, "analytics"), true);
  assert.equal(consent.permits(value, "advertising"), false);
  assert.equal(consent.permits(value, "unknown"), false);
});

test("Google Consent Mode signals reflect saved choices", () => {
  const value = consent.buildConsent({ analytics: true, advertising: false }, NOW);
  assert.deepEqual(consent.consentSignals(value), {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 0
  });
});
