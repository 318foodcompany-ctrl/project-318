"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assistant = require("../api/admin-marketing-assistant.js");

function responseRecorder() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
}

test("sanitizes customer identity and credential-shaped context", () => {
  assert.deepEqual(assistant.sanitizeContext({
    source: "google",
    email: "person@example.com",
    api_key: "secret",
    nested: { phone: "3185550100", sessions: 12 }
  }), { source: "google", nested: { sessions: 12 } });
});

test("accepts only structured draft recommendations", () => {
  const draft = assistant.validateDraft({ summary: "Opportunity found", suggestions: [{ title: "Improve title", rationale: "It is vague", proposed_value: "Catering", confidence: "high" }] });
  assert.equal(draft.suggestions[0].confidence, "high");
  assert.throws(() => assistant.validateDraft({ summary: "No actions", suggestions: [] }));
});

test("non-administrators cannot reach the AI provider", { concurrency: false }, async () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const calls = [];
  process.env.PUBLIC_SUPABASE_URL = "https://staging.supabase.co";
  process.env.PUBLIC_SUPABASE_ANON_KEY = "public-anon";
  process.env.MARKETING_AI_API_URL = "https://provider.example/v1/chat";
  process.env.MARKETING_AI_API_KEY = "server-secret";
  process.env.MARKETING_AI_MODEL = "test-model";
  global.fetch = async (url) => {
    calls.push(String(url));
    const body = String(url).includes("/auth/v1/user") ? { id: "user-1" } : false;
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  try {
    const response = responseRecorder();
    await assistant({ method: "POST", headers: { authorization: "Bearer user-token" }, body: { analysis_type: "seo", context: {} } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error, "Administrator access required.");
    assert.equal(calls.some(url => url.startsWith("https://provider.example")), false);
  } finally {
    global.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("assistant credentials remain server-only and admin script loads once", () => {
  const root = path.join(__dirname, "..");
  const runtime = fs.readFileSync(path.join(root, "api", "runtime-config.js"), "utf8");
  const supabaseLoader = fs.readFileSync(path.join(root, "js", "supabase.js"), "utf8");
  assert.doesNotMatch(runtime, /MARKETING_AI_(API_KEY|API_URL|MODEL)/);
  assert.equal((supabaseLoader.match(/admin-marketing-assistant\.js/g) || []).length, 1);
});
