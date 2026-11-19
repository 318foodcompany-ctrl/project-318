"use strict";

const crypto = require("node:crypto");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function configuration(environment = process.env) {
  const propertyId = String(environment.GA4_PROPERTY_ID || "").trim();
  const clientEmail = String(environment.GOOGLE_ANALYTICS_CLIENT_EMAIL || "").trim();
  const privateKey = String(environment.GOOGLE_ANALYTICS_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  return {
    configured: /^\d{5,20}$/.test(propertyId) && /^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail) && privateKey.includes("BEGIN PRIVATE KEY"),
    propertyId,
    clientEmail,
    privateKey
  };
}

function serviceAccountAssertion(config, now = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: config.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), config.privateKey).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function accessToken(config, fetchImpl = fetch) {
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountAssertion(config) }),
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`Google authorization failed (${response.status}).`);
  return body.access_token;
}

async function runReport(config, token, request, fetchImpl = fetch) {
  const response = await fetchImpl(`${DATA_API}/properties/${config.propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Google Analytics report failed (${response.status}).`);
  return body;
}

function rows(report) {
  const dimensions = (report.dimensionHeaders || []).map(item => item.name);
  const metrics = (report.metricHeaders || []).map(item => item.name);
  return (report.rows || []).map(row => ({
    ...Object.fromEntries(dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value || ""])),
    ...Object.fromEntries(metrics.map((name, index) => [name, Number(row.metricValues?.[index]?.value || 0)]))
  }));
}

async function dashboard(environment = process.env, fetchImpl = fetch) {
  const config = configuration(environment);
  if (!config.configured) return { configured: false, propertyId: config.propertyId || null };
  const token = await accessToken(config, fetchImpl);
  const dateRanges = [{ startDate: "30daysAgo", endDate: "yesterday", name: "current" }, { startDate: "60daysAgo", endDate: "31daysAgo", name: "previous" }];
  const [summary, acquisition, pages, events] = await Promise.all([
    runReport(config, token, { dateRanges, metrics: ["activeUsers", "sessions", "screenPageViews", "engagedSessions", "keyEvents"] .map(name => ({ name })) }, fetchImpl),
    runReport(config, token, { dateRanges: [dateRanges[0]], dimensions: ["sessionSourceMedium", "sessionCampaignName"].map(name => ({ name })), metrics: ["sessions", "activeUsers", "engagedSessions", "keyEvents"].map(name => ({ name })), orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 20 }, fetchImpl),
    runReport(config, token, { dateRanges: [dateRanges[0]], dimensions: [{ name: "landingPagePlusQueryString" }], metrics: ["sessions", "screenPageViews", "engagedSessions", "keyEvents"].map(name => ({ name })), orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 15 }, fetchImpl),
    runReport(config, token, { dateRanges: [dateRanges[0]], dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 30 }, fetchImpl)
  ]);
  return {
    configured: true,
    propertyId: config.propertyId,
    generatedAt: new Date().toISOString(),
    summary: rows(summary),
    acquisition: rows(acquisition),
    landingPages: rows(pages),
    events: rows(events)
  };
}

module.exports = { configuration, serviceAccountAssertion, accessToken, runReport, rows, dashboard };
