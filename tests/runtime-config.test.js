"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const runtimeConfigHandler = require("../api/runtime-config.js");

const STAGING_REF = "owsxnyxkgzplvrxaijop";
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PUBLIC_TEST_KEY = "public-anon-test-key";

function invokeHandler(environment) {
  const originalEnvironment = process.env;
  const headers = {};
  let body = "";

  process.env = { ...environment };
  const response = {
    statusCode: 200,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    end(value) {
      body = String(value || "");
    }
  };

  try {
    runtimeConfigHandler({}, response);
  } finally {
    process.env = originalEnvironment;
  }

  return { body, headers, statusCode: response.statusCode };
}

test("staging runtime configuration contains only staging public values", () => {
  const response = invokeHandler({
    PUBLIC_SUPABASE_URL: STAGING_URL,
    PUBLIC_SUPABASE_ANON_KEY: PUBLIC_TEST_KEY,
    SUPABASE_SERVICE_ROLE_KEY: "must-not-leak",
    DATABASE_PASSWORD: "must-not-leak",
    ACCESS_TOKEN: "must-not-leak"
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, new RegExp(STAGING_REF));
  assert.match(response.body, new RegExp(PUBLIC_TEST_KEY));
  assert.doesNotMatch(response.body, /must-not-leak/);
  assert.doesNotMatch(response.body, /service[_-]?role|database.password|access.token/i);
  assert.equal(response.headers["cache-control"], "no-store, max-age=0");
});

test("production configuration remains environment-controlled and separate", () => {
  const productionUrl = "https://productionexample.supabase.co";
  const staging = invokeHandler({
    PUBLIC_SUPABASE_URL: STAGING_URL,
    PUBLIC_SUPABASE_ANON_KEY: PUBLIC_TEST_KEY
  });
  const production = invokeHandler({
    PUBLIC_SUPABASE_URL: productionUrl,
    PUBLIC_SUPABASE_ANON_KEY: "production-public-key"
  });

  assert.match(staging.body, new RegExp(STAGING_REF));
  assert.doesNotMatch(staging.body, /productionexample/);
  assert.match(production.body, /productionexample/);
  assert.doesNotMatch(production.body, new RegExp(STAGING_REF));
});

test("runtime configuration fails closed when public configuration is missing", () => {
  const response = invokeHandler({});

  assert.equal(response.statusCode, 503);
  assert.match(response.body, /__APP_CONFIG_ERROR__/);
  assert.doesNotMatch(response.body, /__APP_CONFIG__\s*=/);
});

test("browser initializer uses runtime configuration and exposes the client", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "js", "supabase.js"),
    "utf8"
  );
  const calls = [];
  const document = {
    body: {},
    addEventListener() {},
    getElementById() {
      return null;
    }
  };
  const window = {
    __APP_CONFIG__: {
      supabaseUrl: STAGING_URL,
      supabaseAnonKey: PUBLIC_TEST_KEY
    },
    supabase: {
      createClient(url, key) {
        calls.push({ key, url });
        return { key, url };
      }
    }
  };

  vm.runInNewContext(source, { console, document, window });

  assert.deepEqual(calls, [{ key: PUBLIC_TEST_KEY, url: STAGING_URL }]);
  assert.equal(window.supabaseClient.url, STAGING_URL);
  assert.equal(window.supabaseConfigError, null);
});

test("browser initializer contains no hard-coded Supabase project", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "js", "supabase.js"),
    "utf8"
  );

  assert.doesNotMatch(source, /https:\/\/[a-z0-9]+\.supabase\.co/i);
  assert.doesNotMatch(source, /qanetxmyoxpqnwsntmqz/i);
});

test("every Supabase-enabled page loads runtime configuration exactly once and first", () => {
  const root = path.join(__dirname, "..");
  const htmlFiles = fs.readdirSync(root).filter((file) => file.endsWith(".html"));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const supabaseLoader = 'src="js/supabase.js"';
    if (!html.includes(supabaseLoader)) continue;

    const runtimeMatches = html.match(/src="\/api\/runtime-config"/g) || [];
    assert.equal(runtimeMatches.length, 1, `${file} runtime config count`);
    assert.ok(
      html.indexOf('src="/api/runtime-config"') < html.indexOf(supabaseLoader),
      `${file} must load runtime configuration before js/supabase.js`
    );
  }
});
