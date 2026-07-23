"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("crawlable public pages include static descriptions and canonical URLs", () => {
  const pages = ["index.html", "about.html", "catering.html", "corporate.html", "contact.html", "gallery.html", "privacy.html", "quote-builder.html"];
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<html[^>]+lang=["']en["']/i, `${page} declares its language`);
    assert.match(html, /<meta[^>]+name=["']description["']/i, `${page} has a static description`);
    assert.match(html, /<link[^>]+rel=["']canonical["']/i, `${page} has a static canonical URL`);
    assert.match(html, /<h1\b/i, `${page} has a primary heading`);
  }
});

test("private and duplicate routes are excluded from search indexing", () => {
  for (const page of ["admin.html", "login.html", "assistant.html", "dashboard.html", "OPEN-DASHBOARD.html", "START-HERE.html"]) {
    assert.match(read(page), /<meta[^>]+name=["']robots["'][^>]+noindex/i, `${page} is noindex`);
  }
});

test("contact and assistant controls have accessible labels", () => {
  const contact = read("contact.html");
  for (const id of ["contactName", "contactCompany", "contactPhone", "contactEmail", "contactEventDate", "contactEventTime", "guests", "menuChoice", "extras", "contactServiceStyle", "contactAddress", "contactDetails"]) {
    assert.match(contact, new RegExp(`<label[^>]+for=["']${id}["']`, "i"), `${id} has a label`);
    assert.match(contact, new RegExp(`<(?:input|select|textarea)[^>]+id=["']${id}["']`, "i"), `${id} identifies its control`);
  }
  const assistant = read("assistant.html");
  assert.match(assistant, /<label[^>]+for="msg"/);
  assert.match(assistant, /<h1\b/);
  assert.match(assistant, /aria-live="polite"/);
});

test("website image storage is bounded and administrator-only for writes", () => {
  const migration = read("supabase/website-images-storage.sql").toLowerCase();
  assert.match(migration, /file_size_limit/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/png/);
  assert.match(migration, /image\/webp/);
  assert.match(migration, /for insert to authenticated/);
  assert.match(migration, /for update to authenticated/);
  assert.match(migration, /for delete to authenticated/);
  assert.match(migration, /public\.crm_is_admin\(\)/);
});

test("website image storage is included in the timestamped migration chain", () => {
  const migration = read("supabase/migrations/20260722200000_website_images_storage.sql").toLowerCase();
  assert.match(migration, /to_regprocedure\('public\.crm_is_admin\(\)'\)/);
  assert.match(migration, /raise exception 'required function public\.crm_is_admin\(\) is missing/);
  assert.match(migration, /on conflict \(id\) do update/);
  assert.match(migration, /file_size_limit = excluded\.file_size_limit/);
  assert.match(migration, /for insert to authenticated/);
  assert.match(migration, /for update to authenticated/);
  assert.match(migration, /for delete to authenticated/);
});

test("timestamped RLS hardening removes authenticated-user admin access", () => {
  const migration = read("supabase/migrations/20260722190000_admin_rls_hardening.sql").toLowerCase();
  assert.match(migration, /drop policy if exists "authenticated users can view leads"/);
  assert.match(migration, /drop policy if exists "anyone can insert leads"/);
  assert.match(migration, /crm administrators can read leads/);
  assert.match(migration, /website administrators can manage website content/);
  assert.match(migration, /website administrators can manage menu items/);
  assert.equal((migration.match(/public\.crm_is_admin\(\)/g) || []).length >= 7, true);
  assert.match(migration, /revoke all on public\.leads from anon, authenticated/);
});

test("production deployment applies baseline security headers", () => {
  const config = JSON.parse(read("vercel.json"));
  const headers = new Map(config.headers[0].headers.map(header => [header.key.toLowerCase(), header.value]));
  for (const name of ["content-security-policy", "referrer-policy", "permissions-policy", "x-content-type-options", "x-frame-options", "strict-transport-security"]) {
    assert.ok(headers.has(name), `${name} is configured`);
  }
  assert.match(headers.get("content-security-policy"), /object-src 'none'/);
  assert.match(headers.get("content-security-policy"), /frame-ancestors 'self'/);
});

test("database-backed menu images do not interpolate inline event handlers", () => {
  const menu = read("js/site-menu.js");
  assert.doesNotMatch(menu, /onerror\s*=/i);
  assert.match(menu, /data-fallback-src/);
  assert.match(menu, /addEventListener\("error"/);
});
