const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "invoice-utils.js"), "utf8");
const sandbox = { window: {}, Number, String };
vm.runInNewContext(source, sandbox, { filename: "invoice-utils.js" });
const utils = sandbox.window.invoiceUtils;

assert.equal(utils.money("$1,234.567"), 1234.57);
assert.equal(utils.decimal("2.5"), 2.5);
assert.equal(utils.validateLines([], { required: true }), "Add at least one line item.");
assert.match(utils.validateLines([{ description: "", quantity: 1, unit_price: 5 }]), /description/);
assert.match(utils.validateLines([{ description: "Food", quantity: 0, unit_price: 5 }]), /quantity/);
assert.match(utils.validateLines([{ description: "Food", quantity: 1, unit_price: -1 }]), /price/);
assert.equal(utils.validateLines([{ description: " Food ", quantity: 2, unit_price: 10 }]), "");

const normalized = utils.normalizeLines([{ description: " Food ", quantity: "2", unit_price: "$10.00", taxable: false }]);
assert.deepEqual(JSON.parse(JSON.stringify(normalized)), [{ position: 1, description: "Food", quantity: 2, unit_price: 10, taxable: false }]);

const totals = utils.estimate([
  { description: "Food", quantity: 2, unit_price: 50, taxable: true },
  { description: "Delivery", quantity: 1, unit_price: 20, taxable: false }
], 20, 10);
assert.deepEqual(JSON.parse(JSON.stringify(totals)), { subtotal: 120, discount: 20, tax: 8.33, total: 108.33 });
assert.equal(utils.effectiveLabel("partially_paid"), "Partially Paid");
assert.equal(utils.effectiveStatus({ lifecycle_status: "sent", balance_due: 80, paid_amount: 20, due_date: "2026-08-01" }, "2026-07-18"), "partially_paid");
assert.equal(utils.effectiveStatus({ lifecycle_status: "sent", balance_due: 100, paid_amount: 0, due_date: "2026-07-17" }, "2026-07-18"), "overdue");

const reversibleIds = utils.reversiblePaymentIds([
  { id: "payment-open", entry_type: "payment", reverses_payment_id: null },
  { id: "deposit-reversed", entry_type: "deposit", reverses_payment_id: null },
  { id: "reversal", entry_type: "reversal", reverses_payment_id: "deposit-reversed" }
]);
assert.deepEqual([...reversibleIds], ["payment-open"], "already-reversed payments are not offered for reversal");

console.log("invoice-utils tests passed");
