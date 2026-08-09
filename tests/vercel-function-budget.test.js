Exit code: 0
Wall time: 1.3 seconds
Output:
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("Vercel Hobby deployment stays within the 12-function budget", () => {
  const functions = fs.readdirSync(path.join(root, "api"))
    .filter((name) => /\.(?:js|cjs|mjs|ts)$/.test(name));
  assert.ok(functions.length <= 12, `Expected at most 12 functions, found ${functions.length}: ${functions.join(", ")}`);
});

test("consolidated routers preserve all existing marketing and public URLs", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rewrites = new Map(config.rewrites.map(({ source, destination }) => [source, destination]));
  const expected = {
    "/api/admin-marketing-assistant": "/api/admin-marketing?route=assistant",
    "/api/admin-marketing-autopilot-action": "/api/admin-marketing?route=autopilot-action",
    "/api/admin-marketing-autopilot-bulk": "/api/admin-marketing?route=autopilot-bulk",
    "/api/admin-marketing-autopilot-executive": "/api/admin-marketing?route=autopilot-executive",
    "/api/admin-marketing-autopilot-learning": "/api/admin-marketing?route=autopilot-learning",
    "/api/admin-marketing-autopilot-publish": "/api/admin-marketing?route=autopilot-publish",
    "/api/admin-marketing-autopilot-queue": "/api/admin-marketing?route=autopilot-queue",
    "/api/admin-marketing-autopilot-run-now": "/api/admin-marketing?route=autopilot-run-now",
    "/api/admin-marketing-content": "/api/admin-marketing?route=content",
    "/api/admin-marketing-test-email": "/api/admin-marketing?route=test-email",
    "/sitemap.xml": "/api/public-content?route=sitemap",
    "/blog": "/api/public-content?route=blog-index",
    "/blog/:slug": "/api/public-content?route=blog-post&slug=:slug"
  };
  for (const [source, destination] of Object.entries(expected)) {
    assert.equal(rewrites.get(source), destination, `Missing rewrite for ${source}`);
  }
});

test("consolidated routers expose only explicit allowlisted handlers", () => {
  const admin = require("../api/admin-marketing.js");
  const publicContent = require("../api/public-content.js");
  assert.deepEqual(Object.keys(admin.handlers).sort(), [
    "assistant", "autopilot-action", "autopilot-bulk", "autopilot-executive",
    "autopilot-learning", "autopilot-publish", "autopilot-queue", "autopilot-run-now", "content", "test-email"
  ]);
  assert.deepEqual(Object.keys(publicContent.handlers).sort(), ["blog-index", "blog-post", "sitemap"]);
});

