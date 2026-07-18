"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const readiness = require("../js/admin-launch-readiness.js");

const loader = fs.readFileSync(path.join(__dirname, "..", "js", "supabase.js"), "utf8");

test("provider ID validation accepts supported formats", () => {
  assert.equal(readiness.validGa4("G-ABC12345"), true);
  assert.equal(readiness.validGa4("UA-123"), false);
  assert.equal(readiness.validMeta("1234567890"), true);
  assert.equal(readiness.validMeta("pixel-123"), false);
});

test("launch readiness summary separates ready, warning, and blocked checks", () => {
  const summary = readiness.summarizeChecks([
    { status: "ready" },
    { status: "ready" },
    { status: "warning" },
    { status: "blocked" }
  ]);
  assert.deepEqual(summary, { total: 4, ready: 2, warning: 1, blocked: 1 });
  assert.equal(readiness.score(summary), 50);
});

test("status labels remain administrator friendly", () => {
  assert.equal(readiness.statusLabel("ready"), "Ready");
  assert.equal(readiness.statusLabel("warning"), "Needs attention");
  assert.equal(readiness.statusLabel("blocked"), "Blocked");
});

test("admin loader includes launch readiness after marketing tools", () => {
  assert.match(loader, /admin-launch-readiness\.js/);
  assert.match(loader, /data-admin-launch-readiness/);
  assert.match(loader, /admin-campaign-links\.js[\s\S]+admin-launch-readiness\.js/);
});

test("readiness checks cover public endpoints and marketing migrations", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "admin-launch-readiness.js"), "utf8");
  assert.match(source, /marketing_revenue_attribution/);
  assert.match(source, /marketing_quote_funnel/);
  assert.match(source, /marketing_spend_summary/);
  assert.match(source, /\/sitemap\.xml/);
  assert.match(source, /\/robots\.txt/);
  assert.match(source, /\/quote-builder\.html/);
});
