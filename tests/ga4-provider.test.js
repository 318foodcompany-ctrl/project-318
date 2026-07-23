"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const provider = require("../js/ga4-provider.js");
const runtimeConfig = require("../api/runtime-config.js");

test("GA4 measurement IDs are strictly validated", () => {
  assert.equal(provider.validMeasurementId("G-ABC12345"), true);
  assert.equal(provider.validMeasurementId("g-abc12345"), true);
  assert.equal(provider.validMeasurementId("UA-12345-1"), false);
  assert.equal(provider.validMeasurementId("G-123"), false);
  assert.equal(provider.validMeasurementId("javascript:alert(1)"), false);
});

test("GA4 event parameters exclude the event command and complex values", () => {
  assert.deepEqual(provider.cleanParameters({
    event: "quote_submitted",
    page_path: "/quote",
    guests: 40,
    booked: true,
    nested: { unsafe: true },
    empty: null
  }), {
    page_path: "/quote",
    guests: 40,
    booked: true
  });
});

test("runtime config exposes a valid optional GA4 ID", () => {
  const config = runtimeConfig.publicConfigFromEnvironment({
    PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    PUBLIC_GA4_MEASUREMENT_ID: "g-abc12345"
  });
  assert.equal(config.ga4MeasurementId, "G-ABC12345");
});

test("runtime config ignores malformed GA4 values without breaking the site", () => {
  const config = runtimeConfig.publicConfigFromEnvironment({
    PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    PUBLIC_GA4_MEASUREMENT_ID: "not-a-measurement-id"
  });
  assert.equal(config.ga4MeasurementId, undefined);
  assert.equal(config.supabaseAnonKey, "anon-key");
});

test("GA4 suppresses concurrent duplicate event IDs", async () => {
  const listeners = {};
  const document = { title: "Quote", getElementById: () => null, createElement: () => ({ dataset: {} }), head: { appendChild(script) { script.onload(); } } };
  const win = { document, location: { pathname: "/quote-builder.html" }, __APP_CONFIG__: { ga4MeasurementId: "G-ABC12345" }, Project318Consent: { permits: () => true }, addEventListener(name, callback) { listeners[name] = callback; } };
  const instance = provider.createProvider(win);
  const [first, second] = await Promise.all([
    instance.send({ event: "quote_submitted", event_id: "quote-1" }),
    instance.send({ event: "quote_submitted", event_id: "quote-1" })
  ]);
  assert.deepEqual([first, second].sort(), [false, true]);
  assert.equal(win.dataLayer.filter(item => item[0] === "event" && item[1] === "quote_submitted").length, 1);
});
