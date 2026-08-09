"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Release 2 migration is additive, rerunnable, private, and administrator controlled", () => {
  const sql = read("supabase/release-2-conversion-content.sql");
  assert.match(sql, /^begin;/m);
  assert.match(sql, /commit;\s*$/);
  for (const table of ["conversion_items","gallery_items","gallery_categories","faq_items","event_types"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /status = ''published'' or public\.crm_is_admin\(\)/);
  assert.match(sql, /for all to authenticated using \(public\.crm_is_admin\(\)\)/);
  assert.match(sql, /revoke all on public\.conversion_items[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(sql, /drop table|truncate|delete from/);
  const rollback = read("supabase/release-2-conversion-content-rollback.sql");
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/);
});

test("homepage conversion trust content has safe fallbacks and configurable response promise", () => {
  const homepage = read("index.html");
  const script = read("js/conversion-content.js");
  for (const type of ["testimonial","review","client_logo","statistic","trust_badge"]) {
    assert.match(homepage, new RegExp(`data-conversion-list="${type}"`));
    assert.match(script, new RegExp(`${type}:`));
  }
  assert.match(homepage, /Request My Catering Quote/);
  assert.match(homepage, /data-response-promise/);
  assert.match(script, /response_promise/);
});

test("dynamic gallery supports categories, featured images, publication, ordering, and accessible metadata", () => {
  const migration = read("supabase/release-2-conversion-content.sql");
  const page = read("gallery.html");
  const script = read("js/gallery-content.js");
  for (const category of ["Corporate","Weddings","Schools","Parties","Pizza","Pasta","Desserts"]) {
    assert.match(script, new RegExp(category));
  }
  assert.match(migration, /featured boolean/);
  assert.match(migration, /create table if not exists public\.gallery_categories/);
  assert.match(migration, /alt_text text not null/);
  assert.match(migration, /caption text/);
  assert.match(page, /data-dynamic-gallery/);
  assert.doesNotMatch(page, /data-gallery-image=/);
});

test("FAQ is searchable, expandable, dynamic, and emits FAQ structured data", () => {
  const page = read("faq.html");
  const script = read("js/faq-content.js");
  assert.match(page, /data-faq-search/);
  assert.match(page, /data-faq-list/);
  assert.match(script, /createElement\("details"\)/);
  assert.match(script, /FAQPage/);
  assert.match(script, /acceptedAnswer/);
  assert.match(script, /appendAnswer/);
  assert.match(script, /createElement\(heading \? "h4" : "p"\)/);
});

test("event types include required conversion categories and editable SEO metadata", () => {
  const script = read("js/event-types-content.js");
  const migration = read("supabase/release-2-conversion-content.sql");
  for (const name of ["Corporate Lunches","Employee Appreciation","School Events","Weddings","Birthday Parties","Graduations","Church Events","Holiday Parties","Food Truck Events"]) {
    assert.match(script, new RegExp(name));
  }
  assert.match(migration, /seo_title text not null/);
  assert.match(migration, /seo_description text not null/);
  assert.match(read("event-types.html"), /data-event-types/);
});

test("admin conversion manager supports draft, publish, delete, reorder, preview, and safe uploads", () => {
  const html = read("admin.html");
  const script = read("js/admin-conversion-content.js");
  assert.equal((html.match(/js\/admin-conversion-content\.js/g) || []).length, 1);
  assert.match(html, /conversionPanel/);
  for (const behavior of ["draft","published","delete","draggable","Preview"]) assert.match(script, new RegExp(behavior, "i"));
  const manager = require("../js/admin-conversion-content.js");
  assert.equal(manager.validateUpload({ type: "image/svg+xml", size: 100 }), "Choose a JPG, PNG, or WebP image.");
  assert.equal(manager.validateUpload({ type: "image/jpeg", size: 11 * 1024 * 1024 }), "Choose an image smaller than 10 MB.");
  assert.equal(manager.validateUpload({ type: "image/webp", size: 1024 }), "");
});

test("local SEO includes public routes and organization, local business, catering service, and breadcrumbs", () => {
  const seo = require("../js/technical-seo.js");
  assert.equal(seo.PUBLIC_PATHS.has("/faq.html"), true);
  assert.equal(seo.PUBLIC_PATHS.has("/event-types.html"), true);
  const graph = seo.businessSchema("https://www.318foodco.com/event-types.html");
  const serialized = JSON.stringify(graph);
  for (const type of ["Organization","LocalBusiness","Caterer","Service"]) assert.match(serialized, new RegExp(type));
  assert.equal(seo.breadcrumbSchema("/", "Home"), null);
  assert.equal(seo.breadcrumbSchema("/faq.html", "FAQ | 318 Food Co.").itemListElement.length, 2);
  const sitemap = read("sitemap.xml");
  assert.match(sitemap, /faq\.html/);
  assert.match(sitemap, /event-types\.html/);
});

test("conversion UX adds a mobile CTA, improved thank-you suggestions, and a dismissible reminder", () => {
  assert.match(read("script.js"), /Request Catering Quote/);
  const quote = read("quote-builder.html");
  assert.match(quote, /While you wait/);
  assert.match(quote, /faq\.html/);
  const reminder = read("js/conversion-ux.js");
  assert.match(reminder, /sessionStorage/);
  assert.match(reminder, /clientY <= 0/);
  assert.match(read("index.html"), /data-exit-reminder/);
});

