"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const analytics = require("../server/google-analytics.js");
const ui = require("../js/admin-google-analytics.js");

test("Google Analytics configuration stays disabled without private credentials", () => {
  assert.deepEqual(analytics.configuration({ GA4_PROPERTY_ID: "546356197" }), {
    configured: false,
    propertyId: "546356197",
    clientEmail: "",
    privateKey: ""
  });
});

test("service account assertion is a signed, short-lived JWT", () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const token = analytics.serviceAccountAssertion({ clientEmail: "analytics@test.iam.gserviceaccount.com", privateKey }, 1000);
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  assert.equal(claims.iss, "analytics@test.iam.gserviceaccount.com");
  assert.equal(claims.exp - claims.iat, 3600);
});

test("report rows are converted to named numeric fields", () => {
  assert.deepEqual(analytics.rows({
    dimensionHeaders: [{ name: "eventName" }],
    metricHeaders: [{ name: "eventCount" }],
    rows: [{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "12" }] }]
  }), [{ eventName: "page_view", eventCount: 12 }]);
});

test("dashboard helpers calculate safe display values", () => {
  assert.equal(ui.number("12"), 12);
  assert.equal(ui.number("bad"), 0);
  assert.equal(ui.percent(3, 4), "75.0%");
  assert.equal(ui.change(12, 10), "+20.0%");
});
