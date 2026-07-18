"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dashboard = require("../js/admin-marketing.js");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "marketing-funnel-reporting.sql"), "utf8");

test("summarizeFunnel totals quote stages and budget values", () => {
  const summary = dashboard.summarizeFunnel([
    { quote_count: 4, contacted_count: 1, proposal_count: 2, booked_count: 1, closed_count: 1, cancelled_count: 0, quoted_budget: 2500, booked_budget: 900 },
    { quote_count: 2, contacted_count: 1, proposal_count: 0, booked_count: 1, closed_count: 0, cancelled_count: 1, quoted_budget: 1200, booked_budget: 600 }
  ]);
  assert.deepEqual(summary, {
    quotes: 6,
    contacted: 2,
    proposals: 2,
    booked: 2,
    closed: 1,
    cancelled: 1,
    quotedBudget: 3700,
    bookedBudget: 1500
  });
});

test("percent safely formats conversion rates", () => {
  assert.equal(dashboard.percent(2, 8), "25.0%");
  assert.equal(dashboard.percent(0, 0), "0.0%");
});

test("funnel migration is administrator-only and validates attribution model", () => {
  assert.match(migration, /crm_is_admin\(\)/);
  assert.match(migration, /p_model not in \('first', 'last_non_direct'\)/);
  assert.match(migration, /revoke all on function public\.marketing_quote_funnel\(date,date,text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.marketing_quote_funnel\(date,date,text\) to authenticated/);
});

test("funnel migration groups legacy and current quote statuses", () => {
  assert.match(migration, /'Proposal Sent', 'Quote Sent'/);
  assert.match(migration, /'Closed', 'Lost'/);
  assert.match(migration, /l\.status = 'Booked'/);
});
