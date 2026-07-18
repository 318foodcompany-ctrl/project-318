"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validPixelId,
  cleanParameters,
  STANDARD_EVENTS
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
  assert.equal(STANDARD_EVENTS.page_view, "PageView");
  assert.equal(STANDARD_EVENTS.quote_submitted, "Lead");
  assert.equal(STANDARD_EVENTS.phone_click, "Contact");
  assert.equal(STANDARD_EVENTS.email_click, "Contact");
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
