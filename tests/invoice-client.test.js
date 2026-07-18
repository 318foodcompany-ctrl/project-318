const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const service = fs.readFileSync(path.join(__dirname, "..", "js", "invoice-service.js"), "utf8");
for (const rpc of [
  "invoicing_dashboard",
  "invoicing_create_invoice",
  "invoicing_update_draft",
  "invoicing_issue_invoice",
  "invoicing_void_invoice",
  "invoicing_record_payment",
  "invoicing_reverse_payment",
  "invoicing_customer_summary"
]) assert.ok(service.includes(rpc), `service calls ${rpc}`);

assert.ok(service.includes('.from("invoice_line_items")'));
assert.ok(service.includes('.from("payments")'));
assert.ok(service.includes("window.invoiceUtils.normalizeLines"));
assert.ok(service.includes("throw failed.error"));

console.log("invoice-client tests passed");
