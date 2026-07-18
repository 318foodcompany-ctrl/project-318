"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const accessibility=require("../js/accessibility.js");

const loader=fs.readFileSync(path.join(__dirname,"..","script.js"),"utf8");
const styles=fs.readFileSync(path.join(__dirname,"..","css","accessibility.css"),"utf8");

test("pageName normalizes root and nested public paths",()=>{
  assert.equal(accessibility.pageName("/"),"index.html");
  assert.equal(accessibility.pageName("/catering.html"),"catering.html");
  assert.equal(accessibility.pageName("/folder/About.HTML"),"about.html");
});

test("isCurrentLink compares local navigation destinations safely",()=>{
  assert.equal(accessibility.isCurrentLink("catering.html#pizza","/catering.html"),true);
  assert.equal(accessibility.isCurrentLink("index.html","/"),true);
  assert.equal(accessibility.isCurrentLink("https://example.com","/index.html"),false);
  assert.equal(accessibility.isCurrentLink("tel:3185720137","/index.html"),false);
});

test("public loader installs accessibility assets",()=>{
  assert.match(loader,/css\/accessibility\.css/);
  assert.match(loader,/js\/accessibility\.js/);
});

test("accessibility styles include keyboard focus, skip navigation, and reduced motion",()=>{
  assert.match(styles,/\.skip-link/);
  assert.match(styles,/:focus-visible/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
  assert.match(styles,/aria-current="page"/);
});
