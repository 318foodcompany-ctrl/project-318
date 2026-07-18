const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const patch = fs.readFileSync(
  path.join(root, "supabase", "customer-crm-status-fix.sql"),
  "utf8"
).toLowerCase();
const rollback = fs.readFileSync(
  path.join(root, "supabase", "customer-crm-status-fix-rollback.sql"),
  "utf8"
).toLowerCase();
const policy = '"crm administrators can update quote status"';

assert.match(patch, /\bbegin\s*;/);
assert.match(patch, /\bcommit\s*;/);
assert.ok(patch.includes(`drop policy if exists ${policy} on public.leads`));
assert.ok(patch.includes(`create policy ${policy}`));
assert.match(patch, /for\s+update\s+to\s+authenticated/);
assert.match(patch, /using\s*\(public\.crm_is_admin\(\)\)/);
assert.match(patch, /with check\s*\(public\.crm_is_admin\(\)\)/);
assert.match(patch, /revoke\s+update\s+on\s+public\.leads\s+from\s+anon/);
assert.match(patch, /grant\s+update\s*\(status\)\s+on\s+public\.leads\s+to\s+authenticated/);
assert.doesNotMatch(patch, /using\s*\(true\)|with check\s*\(true\)|drop table|truncate/);

assert.match(rollback, /\bbegin\s*;/);
assert.match(rollback, /\bcommit\s*;/);
assert.ok(rollback.includes(`drop policy if exists ${policy} on public.leads`));
assert.doesNotMatch(rollback, /drop table|delete from|truncate|revoke/);

console.log("crm-status migration tests passed");
