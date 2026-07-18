const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "quote-status.js"), "utf8");
const adminQuotes = fs.readFileSync(path.join(root, "js", "admin-quotes.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "quote-status.js" });

function clientReturning(data, error = null) {
  const chain = {
    update() { return chain; },
    eq() { return chain; },
    async select() { return { data, error }; }
  };
  return { from(table) { assert.equal(table, "leads"); return chain; } };
}

(async () => {
  const saved = await sandbox.window.quoteStatusService.update(
    clientReturning([{ id: 42, status: "Booked" }]),
    42,
    "Booked"
  );
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), { id: 42, status: "Booked" });

  await assert.rejects(
    sandbox.window.quoteStatusService.update(clientReturning([]), 42, "Booked"),
    /Quote status was not saved/
  );

  assert.ok(adminQuotes.includes("window.quoteStatusService.update"));
  assert.ok(adminQuotes.includes("quote.status = updatedQuote.status"));
  assert.ok(adminQuotes.includes("Status save failed:"));
  assert.ok(
    adminQuotes.indexOf('setMessage("Quote status saved.")') >
      adminQuotes.indexOf("await window.quoteStatusService.update")
  );

  const scriptMatches = admin.match(/src=["'][^"']*quote-status\.js["']/g) || [];
  assert.equal(scriptMatches.length, 1, "quote-status.js loads exactly once");
  assert.ok(
    admin.indexOf('src="js/quote-status.js"') < admin.indexOf('src="js/admin-quotes.js"'),
    "quote status service loads before Quote Management"
  );

  console.log("quote-status tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
