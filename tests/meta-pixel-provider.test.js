"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validPixelId,
  cleanParameters,
  EVENT_MAP
} = require("../js/meta-pixel-provider.js");
const runtimeConfig = require("../api/runtime-config.js");

test("validPixelId accepts numeric Meta Pixel IDs", () => {
  assert.equal(validPixelId("123456789012345"), true);
  assert.equal(validPixelId(" 12345 "), true);
});

test("validPixelId rejects unsafe or malformed values", () => {
  assert.equal(validPixelId(""), false);
  assert.equal(validPixelId("abc123"), false);
  assert.equal(validPixelId("1234"), false);
  assert.equal(validPixelId("12345<script>"), false);
});

test("cleanParameters keeps only primitive event values", () => {
  assert.deepEqual(cleanParameters({
    event: "quote_submitted",
    page_path: "/quote",
    guests: 25,
    accepted: true,
    nested: { ignored: true },
    empty: null
  }), {
    page_path: "/quote",
    guests: 25,
    accepted: true
  });
});

test("standard event mapping uses conservative Meta events", () => {
  assert.deepEqual(EVENT_MAP.page_view.standard, ["PageView"]);
  assert.deepEqual(EVENT_MAP.quote_submitted.standard, ["Lead"]);
  assert.deepEqual(EVENT_MAP.quote_submitted.custom, ["QuoteSubmitted"]);
  assert.deepEqual(EVENT_MAP.quote_started.custom, ["QuoteStarted"]);
  assert.deepEqual(EVENT_MAP.phone_click.standard, ["Contact"]);
  assert.deepEqual(EVENT_MAP.email_click.standard, ["Contact"]);
});

test("runtime config exposes only a valid Meta Pixel ID", () => {
  const base = {
    PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    PUBLIC_SUPABASE_ANON_KEY: "anon-key"
  };
  assert.equal(runtimeConfig.publicConfigFromEnvironment({
    ...base,
    PUBLIC_META_PIXEL_ID: "123456789012345"
  }).metaPixelId, "123456789012345");
  assert.equal(runtimeConfig.publicConfigFromEnvironment({
    ...base,
    PUBLIC_META_PIXEL_ID: "not-a-pixel"
  }).metaPixelId, undefined);
});

test("Meta suppresses concurrent duplicate event IDs", async () => {
  const calls = [];
  const document = { getElementById: () => null, createElement: () => ({ dataset: {} }), head: { appendChild(script) { script.onload(); } } };
  const win = { document, __APP_CONFIG__: { metaPixelId: "123456789012345" }, Project318Consent: { permits: () => true }, fbq(...args) { calls.push(args); }, addEventListener() {} };
  const instance = require("../js/meta-pixel-provider.js").createProvider(win);
  const [first, second] = await Promise.all([
    instance.send({ event: "quote_submitted", event_id: "quote-1" }),
    instance.send({ event: "quote_submitted", event_id: "quote-1" })
  ]);
  assert.deepEqual([first, second].sort(), [false, true]);
  assert.equal(calls.filter(args => args[0] === "track" && args[1] === "Lead").length, 1);
  assert.equal(calls.filter(args => args[0] === "trackCustom" && args[1] === "QuoteSubmitted").length, 1);
});
