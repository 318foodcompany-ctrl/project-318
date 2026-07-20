const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const enhancement = fs.readFileSync(path.join(root, "js/admin-editor-enhancements.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "js/quote-status.js"), "utf8");
const photos = fs.readFileSync(path.join(root, "js/admin-photos.js"), "utf8");

assert.match(loader, /admin-editor-enhancements\.js/, "visual editor enhancement script must load in admin");
assert.match(enhancement, /Live page preview/, "editor must provide an in-context public-page preview");
assert.match(enhancement, /Unsaved changes/, "editor must communicate dirty state");
assert.match(enhancement, /Saving…/, "editor must communicate saving state");
assert.match(enhancement, /Preview refreshed/, "editor must support explicit preview refresh");
assert.match(enhancement, /Uploading replacement…/, "photo editor must communicate upload progress");
assert.match(enhancement, /prefers-reduced-motion/, "enhancements must respect reduced-motion preferences");
assert.match(photos, /upsert:\s*true/, "photo replacement must preserve safe upsert behavior");
assert.match(photos, /website-images/, "photo editor must preserve the existing storage bucket");

console.log("Admin visual editor regression checks passed.");