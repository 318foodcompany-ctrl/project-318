const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const quotePage = fs.readFileSync(path.join(root, "quote-builder.html"), "utf8");
const quoteLive = fs.readFileSync(path.join(root, "js", "quote-live.js"), "utf8");
const bookings = fs.readFileSync(path.join(root, "js", "admin-bookings.js"), "utf8");

for (const script of ["crm-utils.js", "crm-service.js", "admin-customers.js", "quote-status.js"]) {
  const matches = admin.match(new RegExp(`src=["'][^"']*${script.replace(".", "\\.")}["']`, "g")) || [];
  assert.equal(matches.length, 1, `${script} is loaded exactly once`);
}

for (const id of ["customersPanel", "customerDetailModal", "bookingCustomerId", "bookingCustomerSearch"]) {
  const matches = admin.match(new RegExp(`id=["']${id}["']`, "g")) || [];
  assert.equal(matches.length, 1, `${id} is unique`);
}

assert.ok(quotePage.includes('src="js/quote-live.js"'), "quote page loads the CRM submission integration");
assert.ok(
  quoteLive.includes("submit_quote_with_attribution"),
  "public quotes use the attribution-aware transactional CRM RPC"
);
assert.ok(quoteLive.includes("stopImmediatePropagation"), "legacy preview submission cannot report success first");
assert.ok(bookings.includes("findOrCreateCustomer"), "manual bookings resolve a required customer");
assert.ok(bookings.includes("customer_id: fields.customerId.value || null"), "bookings persist the customer foreign key");

console.log("crm-integration tests passed");
