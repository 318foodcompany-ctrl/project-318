"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const analytics = require("../server/google-analytics.js");
const ui = require("../js/admin-google-analytics.js");

test("sales funnel keeps sibling tools and their drafts during load and filter changes", async () => {
  const vm = require("node:vm");
  const fs = require("node:fs");
  const draft = { value: "Unsaved campaign" };
  const children = [draft];
  const panel = { prepend(node) { children.unshift(node); }, set innerHTML(value) { children.length = 0; } };
  const handlers = {};
  const document = {
    createElement: () => ({}),
    getElementById(id) {
      if (id === "marketingPanel") return panel;
      if (id === "marketingSalesFunnel") return children.find(node => node.id === id);
      return { addEventListener(type, fn) { handlers[id] = fn; } };
    }
  };
  const success = { data: [] };
  const supabaseClient = {
    from: () => ({ select: () => ({ ...success, order: () => success }) }),
    rpc: async () => success
  };
  const source = fs.readFileSync(require.resolve("../js/admin-marketing-dashboard.js"), "utf8");
  vm.runInNewContext(source, { document, supabaseClient, console, localStorage: { getItem: () => null } });
  assert.match(children[0].innerHTML, /Loading/);
  await new Promise(setImmediate);
  assert.match(children[0].innerHTML, /Marketing & Sales Funnel/);
  handlers.mkReset();
  await new Promise(setImmediate);
  assert.equal(children[1], draft);
  assert.equal(draft.value, "Unsaved campaign");
});

test("Google Analytics configuration stays disabled without private credentials", () => {
  assert.deepEqual(analytics.configuration({ GA4_PROPERTY_ID: "546356197" }), {
    configured: false,
    authentication: null,
    propertyId: "546356197",
    clientEmail: "",
    privateKey: "",
    oauthClientId: "",
    oauthClientSecret: "",
    oauthRefreshToken: ""
  });
});

test("OAuth refresh credentials enable reporting without a service-account key", () => {
  const config = analytics.configuration({
    GA4_PROPERTY_ID: "546356197",
    GOOGLE_ANALYTICS_OAUTH_CLIENT_ID: "client-id",
    GOOGLE_ANALYTICS_OAUTH_CLIENT_SECRET: "client-secret",
    GOOGLE_ANALYTICS_OAUTH_REFRESH_TOKEN: "refresh-token"
  });
  assert.equal(config.configured, true);
  assert.equal(config.authentication, "oauth");
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

test("advertising guidance cites report scope and handles missing evidence", () => {
  assert.match(ui.nextMove({}), /no reported sessions/i);
  const report = { acquisition: [{ sessionSourceMedium: "Search", sessions: 12 }], events: [] };
  assert.match(ui.nextMove(report), /Search brought 12 sessions/);
  assert.match(ui.nextMove(report), /returned event list/);
  report.events.push({ eventName: "quote_submitted", eventCount: 2 });
  assert.match(ui.nextMove(report), /2 completed quote events across all sources/);
});

test("production federation uses the selected provider and a ten-minute Analytics-only credential", async () => {
  const provider = "projects/123/locations/global/workloadIdentityPools/my-pool/providers/vercel";
  const config = analytics.configuration({ GA4_PROPERTY_ID:"1234567", GOOGLE_ANALYTICS_WORKLOAD_PROVIDER:provider, GOOGLE_ANALYTICS_CLIENT_EMAIL:"reader@example.iam.gserviceaccount.com" });
  assert.equal(config.authentication,"workload_identity");
  const calls=[];
  const result=await analytics.federatedAccessToken(config,"synthetic-identity",async (url, options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>calls.length===1 ? {access_token:"temporary"} : {accessToken:"reporting"}};
  });
  assert.equal(result,"reporting");
  assert.equal(calls[0].body.audience,"//iam.googleapis.com/"+provider);
  assert.deepEqual(calls[1].body,{scope:["https://www.googleapis.com/auth/analytics.readonly"],lifetime:"600s"});
  await assert.rejects(analytics.federatedAccessToken(config,"",()=>assert.fail("must not fetch")),/unavailable/);
});
