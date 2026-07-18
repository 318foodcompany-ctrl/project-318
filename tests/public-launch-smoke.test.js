"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const smoke = require("../scripts/public-launch-smoke.js");

function response(status, contentType = "text/html") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === "content-type" ? contentType : null }
  };
}

test("normalizeBaseUrl removes trailing slashes and rejects unsafe protocols", () => {
  assert.equal(smoke.normalizeBaseUrl("https://www.318foodco.com///"), "https://www.318foodco.com");
  assert.throws(() => smoke.normalizeBaseUrl("javascript:alert(1)"), /HTTP or HTTPS/);
});

test("evaluateResponse reports missing launch requirements", () => {
  const result = smoke.evaluateResponse(
    { mustInclude: ["quote-builder.html", "318 Food Co"] },
    response(200),
    "318 Food Co"
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ['missing "quote-builder.html"']);
});

test("evaluateResponse validates sitemap content type", () => {
  const good = smoke.evaluateResponse(
    { contentType: "xml", mustInclude: ["318foodco.com"] },
    response(200, "application/xml; charset=utf-8"),
    "https://www.318foodco.com"
  );
  assert.equal(good.ok, true);

  const bad = smoke.evaluateResponse(
    { contentType: "xml", mustInclude: [] },
    response(200, "text/html"),
    ""
  );
  assert.equal(bad.ok, false);
});

test("summarize marks launch ready only when all checks pass", () => {
  assert.deepEqual(smoke.summarize([{ ok: true }, { ok: true }]), { total: 2, passed: 2, failed: 0, ready: true });
  assert.deepEqual(smoke.summarize([{ ok: true }, { ok: false }]), { total: 2, passed: 1, failed: 1, ready: false });
});

test("public launch checks include conversion and crawler endpoints", () => {
  const paths = smoke.CHECKS.map(check => check.path);
  assert.ok(paths.includes("/quote-builder.html"));
  assert.ok(paths.includes("/sitemap.xml"));
  assert.ok(paths.includes("/robots.txt"));
  assert.ok(paths.includes("/api/runtime-config"));
});
