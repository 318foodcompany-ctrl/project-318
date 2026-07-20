const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const quotes = fs.readFileSync(path.join(root, "js", "admin-quotes.js"), "utf8");

assert.ok(quotes.includes('localStorage.getItem("318-quote-view")'), "pipeline/table preference is remembered");
assert.ok(quotes.includes('data-quote-view="pipeline"'), "pipeline view switch is rendered");
assert.ok(quotes.includes('data-quote-view="table"'), "table view remains available");
assert.ok(quotes.includes('class="quote-pipeline"'), "visual pipeline is rendered");
assert.ok(quotes.includes('draggable="true"'), "pipeline cards support drag and drop");
assert.ok(quotes.includes('data-pipeline-status'), "pipeline columns expose their destination status");
assert.ok(quotes.includes('data-status-id'), "accessible stage menus remain available");
assert.ok(quotes.includes('window.quoteStatusService.update'), "stage changes persist through the existing status service");
assert.ok(quotes.includes('renderTable()'), "searchable table workflow is preserved");
assert.ok(quotes.includes('openQuote(button.dataset.viewQuote)'), "pipeline cards open the existing quote detail workflow");
assert.ok(quotes.includes('window.bookingCalendar.openFromQuote({ ...quote })'), "booking creation receives a stable quote snapshot");
assert.ok(quotes.includes('window.invoiceManager.openFromQuote({ ...quote })'), "invoice creation receives a stable quote snapshot");
assert.ok(quotes.includes('@media(prefers-reduced-motion:reduce)'), "reduced motion is respected");

console.log("quote pipeline tests passed");
