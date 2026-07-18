const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const invoiceAdmin = fs.readFileSync(path.join(root, "js", "admin-invoices.js"), "utf8");
const quotes = fs.readFileSync(path.join(root, "js", "admin-quotes.js"), "utf8");
const bookings = fs.readFileSync(path.join(root, "js", "admin-bookings.js"), "utf8");
const customers = fs.readFileSync(path.join(root, "js", "admin-customers.js"), "utf8");

for (const script of ["invoice-utils.js", "invoice-service.js", "admin-invoices.js"]) {
  const matches = admin.match(new RegExp(`src=["'][^"']*${script.replace(".", "\\.")}["']`, "g")) || [];
  assert.equal(matches.length, 1, `${script} loads exactly once`);
}

for (const id of ["invoicesPanel", "invoiceModal", "invoiceForm", "invoicePaymentForm", "bookingCreateInvoiceButton"]) {
  const matches = admin.match(new RegExp(`id=["']${id}["']`, "g")) || [];
  assert.equal(matches.length, 1, `${id} is unique`);
}

assert.ok(admin.indexOf("invoice-utils.js") < admin.indexOf("invoice-service.js"));
assert.ok(admin.indexOf("invoice-service.js") < admin.indexOf("admin-invoices.js"));
assert.ok(invoiceAdmin.includes("openFromQuote"));
assert.ok(invoiceAdmin.includes("openFromBooking"));
assert.ok(invoiceAdmin.includes("recordPayment"));
assert.ok(invoiceAdmin.includes("reversePayment"));
assert.ok(invoiceAdmin.includes("utils.reversiblePaymentIds(payments)"));
assert.ok(invoiceAdmin.includes("bookingId: booking.id, quoteId: booking.quote_id"), "booking invoice creation reuses a linked quote invoice");
assert.ok(quotes.includes("window.invoiceManager.openFromQuote"));
assert.ok(bookings.includes("window.invoiceManager.openFromBooking"));
assert.ok(customers.includes("window.invoiceService.customerSummary"));
assert.ok(customers.includes("Customer invoicing details are unavailable"), "CRM degrades safely before migration deployment");

console.log("invoice integration tests passed");
