const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const enhancement = fs.readFileSync(path.join(root, "js/admin-invoice-enhancements.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "js/quote-status.js"), "utf8");
const invoices = fs.readFileSync(path.join(root, "js/admin-invoices.js"), "utf8");

assert.match(loader, /admin-invoice-enhancements\.js/, "invoice enhancements must load in admin");
assert.match(enhancement, /invoice-card-grid/, "visual invoice cards must be provided");
assert.match(enhancement, /invoice-progress/, "payment progress must be visible");
assert.match(enhancement, /Preview Customer Invoice/, "customer invoice preview must be available");
assert.match(enhancement, /window\.print\(\)/, "invoice preview must support printing or PDF saving");
assert.match(enhancement, /prefers-reduced-motion/, "reduced-motion support must remain available");
assert.match(invoices, /invoiceService\.updateDraft/, "draft version-safe update workflow must remain intact");
assert.match(invoices, /invoiceService\.recordPayment|paymentForm/, "payment recording workflow must remain intact");
assert.match(invoices, /invoiceService\.voidInvoice|invoiceVoidButton/, "void safeguards must remain intact");

console.log("invoice visual workspace regression checks passed");