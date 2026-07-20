const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const experience = fs.readFileSync(path.join(root, "js", "admin-experience.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "js", "quote-status.js"), "utf8");

assert(loader.includes('"js/admin-experience.js"'), "admin experience enhancement must load");
assert(experience.includes("admin-mobile-bar"), "mobile navigation must be present");
assert(experience.includes("adminGlobalSearch"), "global admin search must be present");
assert(experience.includes("adminQuickMenu"), "persistent quick-add menu must be present");
assert(experience.includes("Recently viewed"), "recently viewed navigation must be present");
assert(experience.includes("prefers-reduced-motion"), "reduced motion support must be present");
assert(experience.includes("admin-skip-link"), "skip navigation must be present");
assert(experience.includes("aria-live"), "accessible live feedback must be present");
assert(experience.includes("window.adminExperience"), "public admin experience API must be preserved");
assert(experience.includes("newBookingButton"), "booking quick action must use the existing workflow");
assert(experience.includes("newInvoiceButton"), "invoice quick action must use the existing workflow");
assert(experience.includes("newCustomerButton"), "customer quick action must use the existing workflow");

console.log("Admin experience regression checks passed.");