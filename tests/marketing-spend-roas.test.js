"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const spend = require("../js/admin-marketing-spend.js");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "marketing-spend-roas.sql"), "utf8");

test("summarize totals spend, revenue, quotes, and bookings", () => {
  assert.deepEqual(spend.summarize([
    { spend: 250, revenue: 1000, quote_count: 8, booked_count: 2 },
    { spend: 100, revenue: 300, quote_count: 3, booked_count: 1 }
  ]), { spend: 350, revenue: 1300, quotes: 11, booked: 3 });
});

test("ratio and money safely format dashboard values", () => {
  assert.equal(spend.ratio(4), "4.00x");
  assert.equal(spend.ratio(null), "—");
  assert.equal(spend.money(125.5), "$125.50");
});

test("spend migration is administrator-only", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /crm_is_admin\(\)/);
  assert.match(migration, /revoke all on public\.marketing_spend from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.marketing_spend to authenticated/);
  assert.match(migration, /revoke all on function public\.marketing_spend_summary\(date,date,text\) from public, anon/);
});

test("ROAS reporting validates model and date range", () => {
  assert.match(migration, /p_model not in \('first', 'last_non_direct'\)/);
  assert.match(migration, /p_end < p_start/);
  assert.match(migration, /marketing_revenue_attribution\(p_start,p_end,p_model\)/);
  assert.match(migration, /marketing_quote_funnel\(p_start,p_end,p_model\)/);
});

test("dashboard escapes user-entered source and campaign values", () => {
  assert.equal(spend.escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});
