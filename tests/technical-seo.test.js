"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const seo = require("../js/technical-seo.js");

const root = path.join(__dirname, "..");
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("canonical URLs normalize the homepage and reject unknown paths", () => {
  assert.equal(seo.canonicalUrl("/index.html"), "https://www.318foodco.com/");
  assert.equal(seo.canonicalUrl("/catering.html?utm_source=facebook"), "https://www.318foodco.com/catering.html");
  assert.equal(seo.canonicalUrl("/admin.html"), "https://www.318foodco.com/");
});

test("business schema contains stable public business information", () => {
  const schema = seo.businessSchema("https://www.318foodco.com/catering.html");
  assert.equal(schema.name, "318 Food Co.");
  assert.equal(schema.telephone, "+1-318-572-0137");
  assert.equal(schema.email, "318FoodCompany@gmail.com");
  assert.ok(schema["@type"].includes("Caterer"));
  assert.equal(schema.mainEntityOfPage, "https://www.318foodco.com/catering.html");
});

test("robots file protects administrator routes and declares sitemap", () => {
  assert.match(robots, /Disallow: \/admin\.html/);
  assert.match(robots, /Disallow: \/login\.html/);
  assert.match(robots, /Sitemap: https:\/\/www\.318foodco\.com\/sitemap\.xml/);
});

test("sitemap includes core public conversion pages and excludes admin", () => {
  assert.match(sitemap, /https:\/\/www\.318foodco\.com\/catering\.html/);
  assert.match(sitemap, /https:\/\/www\.318foodco\.com\/quote-builder\.html/);
  assert.doesNotMatch(sitemap, /admin\.html|login\.html/);
});

test("public script loads technical SEO metadata", () => {
  assert.match(script, /js\/technical-seo\.js/);
  assert.match(script, /project318-technical-seo-script/);
});
