"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const leadApi = require("../api/lead-submit.js");
const email = require("../server/transactional-email.js");
const content = require("../js/site-content-loader.js");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const savedEnvironment = { ...process.env };

function responseObject(status, payload) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
}

async function invokeHandler(body, overrides = {}) {
  const request = {
    method: "POST",
    headers: {
      "content-length": String(Buffer.byteLength(JSON.stringify(body))),
      "idempotency-key": overrides.idempotencyKey || "00000000-0000-4000-8000-000000000099",
      "x-forwarded-for": "192.0.2.10"
    },
    body,
    socket: {}
  };
  return new Promise(resolve => {
    const response = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(value) { resolve({ status: this.statusCode, body: JSON.parse(value), headers: this.headers }); }
    };
    leadApi.handler(request, response);
  });
}

function validPayload(source = "guided_quote") {
  return {
    source, name: "Test Customer", company: "Example Co",
    email: "customer@example.test", phone: "318-555-0100",
    eventDate: "2026-09-01", eventTime: "18:00", guests: 40,
    menu: "Taco Bar", eventType: "Corporate Lunch", budget: 800,
    address: "100 Test Street", notes: "Test request only",
    marketingConsent: true, attribution: { visitor_id: "00000000-0000-4000-8000-000000000001" }
  };
}

test("validates guided quote and contact submissions while rejecting invalid input", () => {
  assert.deepEqual(leadApi.validatePayload(validPayload()).errors, []);
  assert.deepEqual(leadApi.validatePayload(validPayload("contact_form")).errors, []);
  assert.match(leadApi.validatePayload({ source: "contact_form" }).errors.join(" "), /Name|email|phone/);
});

test("unified server handler persists a lead and records both accepted emails", async () => {
  Object.assign(process.env, {
    PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
    LEAD_RATE_LIMIT_SECRET: "01234567890123456789012345678901",
    TRANSACTIONAL_EMAIL_PROVIDER: "test",
    NODE_ENV: "test",
    LEAD_NOTIFICATION_TO: "owner@example.test"
  });
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url, body: options?.body ? JSON.parse(options.body) : null });
    if (String(url).includes("submit_release1_lead")) return responseObject(200, [{ lead_id: 42, deduplicated: false }]);
    if (String(url).includes("record_lead_email_delivery")) return responseObject(200, null);
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const result = await invokeHandler(validPayload());
    assert.equal(result.status, 201);
    assert.equal(result.body.code, "LEAD_SAVED_EMAILS_ACCEPTED");
    assert.equal(calls.filter(call => call.url.includes("record_lead_email_delivery")).length, 2);
    assert.equal(calls[0].body.p_marketing_consent, true);
    assert.equal(calls[0].body.p_submission_source, "guided_quote");
  } finally {
    global.fetch = originalFetch;
    process.env = { ...savedEnvironment };
  }
});

test("idempotent retry returns the original result without sending duplicate emails", async () => {
  Object.assign(process.env, {
    PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
    LEAD_RATE_LIMIT_SECRET: "01234567890123456789012345678901",
    TRANSACTIONAL_EMAIL_PROVIDER: "test",
    NODE_ENV: "test",
    LEAD_NOTIFICATION_TO: "owner@example.test"
  });
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).includes("submit_release1_lead")) return responseObject(200, [{ lead_id: 42, deduplicated: true }]);
    if (String(url).includes("/leads?")) return responseObject(200, [{ customer_confirmation_status: "accepted", owner_notification_status: "accepted" }]);
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const result = await invokeHandler(validPayload());
    assert.equal(result.status, 200);
    assert.equal(result.body.code, "DUPLICATE_RECOGNIZED");
    assert.equal(calls.some(url => url.includes("record_lead_email_delivery")), false);
  } finally {
    global.fetch = originalFetch;
    process.env = { ...savedEnvironment };
  }
});

test("missing server credentials and honeypot submissions fail closed", async () => {
  process.env = { ...savedEnvironment };
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  let result = await invokeHandler(validPayload());
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "LEAD_SERVICE_NOT_CONFIGURED");

  Object.assign(process.env, {
    PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
    LEAD_RATE_LIMIT_SECRET: "01234567890123456789012345678901"
  });
  result = await invokeHandler({ ...validPayload(), website: "spam.example" });
  assert.equal(result.status, 422);
  assert.equal(result.body.code, "SUSPECTED_SPAM");
  process.env = { ...savedEnvironment };
});

test("honest result messaging distinguishes every email outcome", () => {
  assert.equal(leadApi.publicResult(1, false, "accepted", "accepted").code, "LEAD_SAVED_EMAILS_ACCEPTED");
  assert.equal(leadApi.publicResult(1, false, "failed", "accepted").code, "LEAD_SAVED_CUSTOMER_EMAIL_FAILED");
  assert.equal(leadApi.publicResult(1, false, "accepted", "failed").code, "LEAD_SAVED_OWNER_EMAIL_FAILED");
  assert.equal(leadApi.publicResult(1, false, "failed", "failed").code, "LEAD_SAVED_EMAILS_FAILED");
  assert.equal(leadApi.publicResult(1, true, "accepted", "accepted").code, "DUPLICATE_RECOGNIZED");
});

test("transactional provider supports safe test mode and plain text", async () => {
  const configuration = email.emailConfiguration({ TRANSACTIONAL_EMAIL_PROVIDER: "test", NODE_ENV: "test" });
  const result = await email.sendTransactionalEmail({
    to: "customer@example.test", subject: "Test", html: "<p>Test</p>", text: "Test", messageKey: "lead-1-customer"
  }, { configuration });
  assert.equal(result.status, "accepted");
  const body = leadApi.emailBody("Title", "Intro", validPayload(), "Not a booking.");
  assert.match(body.html, /<!doctype html>/i);
  assert.match(body.text, /Not a booking/);
});

test("provider absence and timeout return safe retry states without secrets", async () => {
  assert.equal(email.emailConfiguration({}).mode, "manual_setup");
  const timeout = await email.sendTransactionalEmail({
    to: "customer@example.test", subject: "Test", html: "Test", text: "Test", messageKey: "timeout"
  }, {
    configuration: { mode: "send", provider: "resend", apiKey: "never-log-this", from: "sender@example.test" },
    fetchImpl: async () => { const error = new Error("timeout"); error.name = "AbortError"; throw error; }
  });
  assert.deepEqual(timeout, {
    status: "failed", provider: "resend", reference: "", failureCode: "PROVIDER_TIMEOUT"
  });
  assert.doesNotMatch(JSON.stringify(timeout), /never-log-this/);
});

test("Release 1 migration is transactional, rerunnable, private, and service-only", () => {
  const sql = read("supabase/release-1-lead-automation.sql");
  assert.match(sql, /\bbegin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.equal((sql.match(/create table if not exists/g) || []).length, 4);
  assert.match(sql, /lead_submission_idempotency/);
  assert.match(sql, /lead_rate_limit_events/);
  assert.match(sql, /marketing_consent_history/);
  assert.match(sql, /lead_email_deliveries/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /revoke all on function public\.submit_release1_lead[\s\S]*from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /create policy[^;]+to anon/is);
  assert.match(sql, /on conflict|for update/i);
  assert.equal((sql.match(/pg_advisory_xact_lock/g) || []).length, 2);
  assert.match(sql, /return query select v_existing\.lead_id, true/);
});

test("consent history is append-only in the public submission path", () => {
  const sql = read("supabase/release-1-lead-automation.sql");
  assert.match(sql, /insert into public\.marketing_consent_history/);
  assert.doesNotMatch(sql, /update public\.marketing_consent_history/i);
  assert.match(sql, /p_disclosure_version/);
  assert.match(sql, /p_disclosure_text/);
});

test("both forms use one endpoint with honeypot, idempotency, source, and explicit consent", () => {
  const quote = read("quote-builder.html");
  const contact = read("contact.html");
  const client = read("js/lead-submission.js");
  for (const page of [quote, contact]) {
    assert.match(page, /name="website"/);
    assert.match(page, /name="marketingOptIn"/);
    assert.match(page, /js\/lead-submission\.js/);
  }
  assert.match(client, /Idempotency-Key/);
  assert.match(read("js/quote-live.js"), /source:\s*"guided_quote"/);
  assert.match(read("js/contact-live.js"), /source:\s*"contact_form"/);
  assert.doesNotMatch(read("script.js"), /location\.href\s*=\s*`mailto:/);
});

test("successful submissions retire their idempotency key while failed attempts retain it", () => {
  const service = require("../js/lead-submission.js");
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
  const form = { id: "contact-form" };
  const first = service.idempotencyKey(form, storage);
  assert.equal(service.idempotencyKey(form, storage), first);
  service.complete(form, storage);
  assert.notEqual(service.idempotencyKey(form, storage), first);
  assert.match(read("js/quote-live.js"), /service\.complete\(form\)/);
  assert.match(read("js/contact-live.js"), /service\.complete\(form\)/);
});

test("homepage editor fields all map to public homepage targets", () => {
  const admin = read("js/admin-content.js");
  const homepage = read("index.html");
  const fieldBlock = admin.match(/const homepageContentFields = \[([\s\S]*?)\n\];/)?.[1] || "";
  const keys = [...fieldBlock.matchAll(/key:\s*"([^"]+)"/g)].map(match => match[1]);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(homepage, new RegExp(`data-content(?:-link)?="${escaped}"`), `${key} must have a public target`);
  }
});

test("public content loaders publish safe text with hard-coded fallback behavior", () => {
  assert.equal(content.safeText(" Updated heading "), "Updated heading");
  assert.equal(content.safeText(""), "");
  assert.equal(content.safeLink("javascript:alert(1)"), "");
  assert.equal(content.safeLink("quote-builder.html"), "quote-builder.html");
  for (const [page, loader] of [["index.html", "site-content.js"], ["about.html", "site-about-content.js"], ["contact.html", "site-contact-content.js"]]) {
    const html = read(page);
    assert.equal((html.match(/js\/site-content-loader\.js/g) || []).length, 1);
    assert.equal((html.match(new RegExp(`js/${loader.replace(".", "\\.")}`, "g")) || []).length, 1);
  }
  assert.match(read("js/site-corporate-content.js"), /loadCorporatePageContent/);
});

test("an administrator-saved content value appears publicly and failures retain fallback", async () => {
  const originalDocument = global.document;
  const originalClient = global.supabaseClient;
  const heading = {
    textContent: "Hard-coded fallback",
    getAttribute(name) { return name === "data-content" ? "hero_heading" : ""; },
    setAttribute() {}
  };
  global.document = {
    querySelectorAll(selector) {
      if (selector === "[data-content]") return [heading];
      return [];
    }
  };
  global.supabaseClient = {
    from() {
      return {
        select() {
          return { eq: async () => ({ data: [{ content_key: "hero_heading", content_value: "Published heading" }], error: null }) };
        }
      };
    }
  };
  try {
    const result = await content.load({ page: "home", attribute: "data-content" });
    assert.equal(result.loaded, 1);
    assert.equal(heading.textContent, "Published heading");
    global.supabaseClient = {
      from() {
        return { select() { return { eq: async () => ({ data: null, error: new Error("offline") }) }; } };
      }
    };
    heading.textContent = "Hard-coded fallback";
    const failed = await content.load({ page: "home", attribute: "data-content" });
    assert.equal(failed.fallback, true);
    assert.equal(heading.textContent, "Hard-coded fallback");
  } finally {
    global.document = originalDocument;
    global.supabaseClient = originalClient;
  }
});

test("misleading specials placeholder and preview PIN routes are removed", () => {
  assert.doesNotMatch(read("admin.html"), /specialsPanel|Specials Manager/);
  assert.equal(fs.existsSync(path.join(root, "dashboard.html")), false);
  assert.equal(fs.existsSync(path.join(root, "OPEN-DASHBOARD.html")), false);
  assert.equal(fs.existsSync(path.join(root, "phase2.js")), false);
  assert.doesNotMatch(read("quote-builder.html"), /phase2\.js/);
});

test("admin quote detail exposes safe delivery, consent, source, and review state", () => {
  const adminQuotes = read("js/admin-quotes.js");
  for (const field of ["submission_source", "customer_confirmation_status", "owner_notification_status", "marketing_consent_status", "deduplicated", "abuse_review_required"]) {
    assert.match(adminQuotes, new RegExp(field));
  }
  assert.doesNotMatch(adminQuotes, /RESEND_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});
