"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const photos = require("../js/admin-photos.js");

test("photo uploads accept bounded raster images", () => {
  assert.equal(photos.validatePhoto({ type: "image/jpeg", size: 1024 }), "");
  assert.equal(photos.validatePhoto({ type: "image/png", size: photos.maxPhotoBytes }), "");
  assert.equal(photos.validatePhoto({ type: "image/webp", size: 2048 }), "");
});

test("photo uploads reject active content and oversized files", () => {
  assert.match(photos.validatePhoto({ type: "image/svg+xml", size: 1024 }), /JPG, PNG, or WebP/);
  assert.match(photos.validatePhoto({ type: "image/jpeg", size: photos.maxPhotoBytes + 1 }), /smaller than 10 MB/);
  assert.match(photos.validatePhoto({ type: "", size: 1024 }), /JPG, PNG, or WebP/);
});
