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
  const oauthClientId = String(environment.GOOGLE_ANALYTICS_OAUTH_CLIENT_ID || "").trim();
  const oauthClientSecret = String(environment.GOOGLE_ANALYTICS_OAUTH_CLIENT_SECRET || "").trim();
  const oauthRefreshToken = String(environment.GOOGLE_ANALYTICS_OAUTH_REFRESH_TOKEN || "").trim();
  const serviceAccountConfigured = /^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail) && privateKey.includes("BEGIN PRIVATE KEY");
  const provider = String(environment.GOOGLE_ANALYTICS_WORKLOAD_PROVIDER || "").trim();
  const federated = /^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(provider) && /^[a-z0-9._-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(clientEmail);
  const oauthConfigured = Boolean(oauthClientId && oauthClientSecret && oauthRefreshToken);
  return {
    configured: /^\d{5,20}$/.test(propertyId) && (federated || serviceAccountConfigured || oauthConfigured),
    ...(federated ? { provider } : {}),
    authentication: federated ? "workload_identity" : oauthConfigured ? "oauth" : serviceAccountConfigured ? "service_account" : null,
    propertyId,
    clientEmail,
    privateKey,
    oauthClientId,
    oauthClientSecret,
    oauthRefreshToken
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
  const tokenRequest = config.authentication === "oauth"
    ? new URLSearchParams({ client_id: config.oauthClientId, client_secret: config.oauthClientSecret, refresh_token: config.oauthRefreshToken, grant_type: "refresh_token" })
    : new URLSearchParams({ grant_type: "urn:ietf:params:oauth-grant-type:jwt-bearer", assertion: serviceAccountAssertion(config) });
  if (config.authentication !== "oauth") tokenRequest.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenRequest,
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

async function federatedAccessToken(config, identity, fetchImpl) {
  if (typeof identity !== "string" || !identity.trim()) throw new Error("Hosting identity unavailable.");
  const exchange = await fetchImpl("https://sts.googleapis.com/v1/token", {
    method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),
    body:JSON.stringify({
      audience:"//iam.googleapis.com/" + config.provider,
      grantType:"urn:ietf:params:oauth:grant-type:token-exchange",
      requestedTokenType:"urn:ietf:params:oauth:token-type:access_token",
      scope:"https://www.googleapis.com/auth/cloud-platform",
      subjectTokenType:"urn:ietf:params:oauth:token-type:jwt",subjectToken:identity
    })
  });
  if (!exchange.ok) throw new Error("Hosting identity exchange failed (" + exchange.status + ").");
  const grant = await exchange.json();
  if (!grant.access_token) throw new Error("Hosting identity exchange returned no credential.");
  const result = await fetchImpl("https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" + encodeURIComponent(config.clientEmail) + ":generateAccessToken", {
    method:"POST",headers:{Authorization:"Bearer " + grant.access_token,"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),
    body:JSON.stringify({scope:[SCOPE],lifetime:"600s"})
  });
  if (!result.ok) throw new Error("Analytics reader authorization failed (" + result.status + ").");
  const credential = await result.json();
  if (!credential.accessToken) throw new Error("Analytics reader authorization returned no credential.");
  return credential.accessToken;
}

async function dashboard(environment = process.env, fetchImpl = fetch, identity, period) {
  const config = configuration(environment);
  if (!config.configured) return { configured: false, propertyId: config.propertyId || null };
  const token = config.authentication === "workload_identity" ? await federatedAccessToken(config, identity || environment.VERCEL_OIDC_TOKEN, fetchImpl) : await accessToken(config, fetchImpl);
  const dateRanges = period ? [{startDate:period.start,endDate:period.end,name:"current"}] : [{ startDate: "30daysAgo", endDate: "yesterday", name: "current" }, { startDate: "60daysAgo", endDate: "31daysAgo", name: "previous" }];
  const [summary, acquisition, pages, events] = await Promise.all([
    runReport(config, token, { dateRanges, metrics: ["activeUsers", "sessions", "screenPageViews", "engagedSessions", "keyEvents"] .map(name => ({ name })) }, fetchImpl),
    runReport(config, token, { dateRanges: [dateRanges[0]], dimensions: ["sessionSourceMedium", "sessionCampaignName"].map(name => ({ name })), metrics: ["sessions", "activeUsers", "engagedSessions", "keyEvents"].map(name => ({ name })), orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 20 }, fetchImpl),
    runReport(config, token, { dateRanges: [dateRanges[0]], dimensions: [{ name: "landingPage" }], metrics: ["sessions", "screenPageViews", "engagedSessions", "keyEvents"].map(name => ({ name })), orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 15 }, fetchImpl),
    runReport(config, token, { dateRanges: [dateRanges[0]], dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 30 }, fetchImpl)
  ]);
  return {
    configured: true,
    propertyId: config.propertyId,
    generatedAt: new Date().toISOString(),
    summary: period ? rows(summary).map(row => ({...row,dateRange:"current"})) : rows(summary),
    acquisition: rows(acquisition),
    landingPages: rows(pages),
    events: rows(events)
  };
}

module.exports = { configuration, serviceAccountAssertion, accessToken, federatedAccessToken, runReport, rows, dashboard };
