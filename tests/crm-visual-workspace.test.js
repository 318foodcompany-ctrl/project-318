const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.resolve(__dirname, "..");
const workspace = fs.readFileSync(path.join(root, "js", "crm-visual-workspace.js"), "utf8");
const utils = fs.readFileSync(path.join(root, "js", "crm-utils.js"), "utf8");
const customers = fs.readFileSync(path.join(root, "js", "admin-customers.js"), "utf8");

assert(utils.includes('script.src = "js/crm-visual-workspace.js"'), "CRM utilities must load the visual workspace in the browser.");
assert(workspace.includes("Recommended next action"), "Customer workspace must show an owner-friendly next action.");
assert(workspace.includes('data-crm-tab="${group.id}"'), "Customer workspace must provide accessible visual tabs.");
assert(workspace.includes("Relationship") && workspace.includes("Money") && workspace.includes("Timeline"), "Workspace must organize relationship, financial, and activity information.");
assert(workspace.includes('href="tel:') && workspace.includes('href="mailto:'), "Workspace must provide call and email quick actions.");
assert(workspace.includes('data-crm-open="leadsPanel"') && workspace.includes('data-crm-open="bookingsPanel"') && workspace.includes('data-crm-open="invoicesPanel"'), "Workspace must link to quotes, bookings, and invoices.");
assert(workspace.includes("prefers-reduced-motion"), "Workspace must respect reduced-motion preferences.");
assert(workspace.includes("@media(max-width:700px)"), "Workspace must provide a mobile customer-card layout.");
assert(customers.includes("window.invoiceService.customerInvoices"), "Existing customer invoice integration must remain intact.");
assert(customers.includes("window.customerCRM = { openCustomer, refresh: loadCustomers, toast }"), "Existing customer CRM public API must remain intact.");

console.log("CRM visual workspace regression checks passed.");