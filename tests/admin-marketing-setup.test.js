"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const marketing = require("../js/admin-marketing.js");

test("providerStatus validates configured provider IDs", () => {
  const result = marketing.providerStatus({
    ga4MeasurementId: "G-ABC12345",
    metaPixelId: "123456789012345"
  });
  assert.equal(result.ga4.configured, true);
  assert.equal(result.meta.configured, true);
});

test("providerStatus rejects missing or malformed provider IDs", () => {
  const result = marketing.providerStatus({
    ga4MeasurementId: "UA-123",
    metaPixelId: "pixel-123"
  });
  assert.equal(result.ga4.configured, false);
  assert.equal(result.meta.configured, false);
});

test("statusMarkup escapes provider details", () => {
  const markup = marketing.statusMarkup("Provider", false, '<script>alert("x")</script>');
  assert.equal(markup.includes("<script>"), false);
  assert.equal(markup.includes("&lt;script&gt;"), true);
  assert.equal(markup.includes("Needs setup"), true);
});
