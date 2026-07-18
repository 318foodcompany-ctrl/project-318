"use strict";

const DEFAULT_BASE_URL = "https://www.318foodco.com";

const CHECKS = [
  { path: "/", name: "Homepage", mustInclude: ["318 Food Co", "quote-builder.html"] },
  { path: "/catering.html", name: "Catering page", mustInclude: ["Catering", "quote-builder.html"] },
  { path: "/corporate.html", name: "Corporate page", mustInclude: ["Corporate", "quote-builder.html"] },
  { path: "/about.html", name: "About page", mustInclude: ["About"] },
  { path: "/gallery.html", name: "Gallery page", mustInclude: ["Gallery"] },
  { path: "/contact.html", name: "Contact page", mustInclude: ["318FoodCompany@gmail.com", "3185720137"] },
  { path: "/quote-builder.html", name: "Quote builder", mustInclude: ["quote", "318"] },
  { path: "/privacy.html", name: "Privacy policy", mustInclude: ["Privacy"] },
  { path: "/sitemap.xml", name: "Sitemap", contentType: "xml", mustInclude: ["318foodco.com", "quote-builder.html"] },
  { path: "/robots.txt", name: "Robots file", contentType: "text", mustInclude: ["Sitemap:", "Disallow: /admin.html"] },
  { path: "/api/runtime-config", name: "Runtime configuration", contentType: "javascript", mustInclude: ["supabaseUrl", "supabaseAnonKey"] }
];

function normalizeBaseUrl(value) {
  const candidate = String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  const parsed = new URL(candidate);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Base URL must use HTTP or HTTPS.");
  return parsed.toString().replace(/\/$/, "");
}

function evaluateResponse(check, response, body) {
  const failures = [];
  if (!response || !response.ok) failures.push(`HTTP ${response ? response.status : "error"}`);
  const lowerBody = String(body || "").toLowerCase();
  for (const expected of check.mustInclude || []) {
    if (!lowerBody.includes(String(expected).toLowerCase())) failures.push(`missing \"${expected}\"`);
  }
  if (check.contentType) {
    const header = response && response.headers && typeof response.headers.get === "function"
      ? String(response.headers.get("content-type") || "").toLowerCase()
      : "";
    if (check.contentType === "xml" && !header.includes("xml")) failures.push("unexpected content type");
    if (check.contentType === "javascript" && !header.includes("javascript")) failures.push("unexpected content type");
  }
  return { ok: failures.length === 0, failures };
}

async function runChecks(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || process.env.PROJECT318_BASE_URL);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");

  const results = [];
  for (const check of CHECKS) {
    const url = `${baseUrl}${check.path}`;
    try {
      const response = await fetchImpl(url, { redirect: "follow", headers: { "user-agent": "Project318LaunchSmoke/1.0" } });
      const body = await response.text();
      results.push({ ...check, url, status: response.status, ...evaluateResponse(check, response, body) });
    } catch (error) {
      results.push({ ...check, url, status: null, ok: false, failures: [error.message || "request failed"] });
    }
  }
  return results;
}

function summarize(results) {
  const total = results.length;
  const passed = results.filter(result => result.ok).length;
  return { total, passed, failed: total - passed, ready: passed === total };
}

async function main() {
  const results = await runChecks();
  for (const result of results) {
    const icon = result.ok ? "PASS" : "FAIL";
    console.log(`${icon} ${result.name} ${result.url}${result.ok ? "" : ` — ${result.failures.join(", ")}`}`);
  }
  const summary = summarize(results);
  console.log(`\n${summary.passed}/${summary.total} checks passed.`);
  if (!summary.ready) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_BASE_URL, CHECKS, normalizeBaseUrl, evaluateResponse, runChecks, summarize };
