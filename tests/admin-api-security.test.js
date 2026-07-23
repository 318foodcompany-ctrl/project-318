"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const quoteHandler = require("../api/admin-quotes.js");
const runtimeHandler = require("../api/runtime-config.js");
const quoteSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "api", "admin-quotes.js"), "utf8");

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(body = "") { this.body = body; }
  };
}

function fetchResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  });
}

test("quote recovery rejects authenticated non-administrators before querying leads", async () => {
  const originalFetch = global.fetch;
  const originalEnvironment = process.env;
  const calls = [];
  process.env = {
    ...originalEnvironment,
    PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    PUBLIC_SUPABASE_ANON_KEY: "anon-key"
  };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return fetchResponse({ id: "user-1" });
    if (url.endsWith("/rest/v1/rpc/crm_is_admin")) return fetchResponse(false);
    throw new Error("Lead recovery must not run for non-administrators.");
  };

  try {
    const response = responseRecorder();
    await quoteHandler({ method: "GET", headers: { authorization: "Bearer user-token" } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).error, "Administrator access required.");
    assert.equal(calls.length, 2);
    assert.equal(calls.some(call => call.options.headers.Authorization === "Bearer service-key"), false);
  } finally {
    global.fetch = originalFetch;
    process.env = originalEnvironment;
  }
});

test("quote recovery queries through administrator RLS after verification", async () => {
  const originalFetch = global.fetch;
  const originalEnvironment = process.env;
  process.env = {
    ...originalEnvironment,
    PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    PUBLIC_SUPABASE_ANON_KEY: "anon-key"
  };
  global.fetch = async (url, options) => {
    if (url.endsWith("/auth/v1/user")) return fetchResponse({ id: "admin-1" });
    if (url.endsWith("/rest/v1/rpc/crm_is_admin")) return fetchResponse(true);
    if (url.includes("/rest/v1/leads?")) {
      assert.equal(options.headers.apikey, "anon-key");
      assert.equal(options.headers.Authorization, "Bearer admin-token");
      return fetchResponse([{ id: 7 }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const response = responseRecorder();
    await quoteHandler({ method: "GET", headers: { authorization: "Bearer admin-token" } }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body).quotes, [{ id: 7 }]);
  } finally {
    global.fetch = originalFetch;
    process.env = originalEnvironment;
  }
});

test("runtime configuration rejects unsupported methods", () => {
  const response = responseRecorder();
  runtimeHandler({ method: "POST" }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "GET, HEAD");
  assert.match(response.body, /Method not allowed/);
});

test("quote recovery does not depend on service-role credentials", () => {
  assert.doesNotMatch(quoteSource, /service[_-]?role|serviceKey/i);
});
