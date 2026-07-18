"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.join(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase", "marketing-attribution.sql"), "utf8");
const quoteClient = fs.readFileSync(path.join(root, "js", "quote-live.js"), "utf8");

test("migration creates normalized attribution and permanent lead links", () => {
  for (const expected of ["marketing_visitors", "marketing_sessions", "marketing_touchpoints", "marketing_first_touchpoint_id", "marketing_last_touchpoint_id"]) assert.match(sql, new RegExp(expected));
  assert.match(sql, /on delete restrict/);
});

test("anonymous users receive RPC access but no direct attribution table access", () => {
  assert.match(sql, /grant execute on function public\.submit_quote_with_attribution[\s\S]*to anon, authenticated/i);
  assert.match(sql, /revoke all on public\.marketing_visitors, public\.marketing_sessions, public\.marketing_touchpoints from anon, authenticated/i);
  assert.doesNotMatch(sql, /create policy[^;]+to anon/is);
});

test("admin reporting RPCs enforce the existing CRM authorization rule", () => {
  assert.equal((sql.match(/if not public\.crm_is_admin\(\)/g) || []).length >= 2, true);
  assert.match(sql, /Marketing administrators can read visitors[\s\S]*public\.crm_is_admin\(\)/);
});

test("public quote submission uses the attribution-aware atomic RPC", () => {
  assert.match(quoteClient, /rpc\('submit_quote_with_attribution'/);
  assert.match(quoteClient, /p_attribution:\s*attribution/);
  assert.match(sql, /v_quote_id := public\.submit_quote_with_customer/);
  assert.match(sql, /perform public\.marketing_attach_quote_attribution/);
});

test("migration is transaction wrapped and uses rerun-safe DDL", () => {
  assert.match(sql, /^--[\s\S]*\bbegin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.equal((sql.match(/create table if not exists/g) || []).length, 3);
  assert.match(sql, /add column if not exists marketing_session_id/);
});

test("revenue attribution follows payments through invoice and quote", () => {
  assert.match(sql, /from public\.payments p[\s\S]*join public\.invoices i on i\.id = p\.invoice_id[\s\S]*left join public\.leads l on l\.id = i\.quote_id/);
  assert.match(sql, /entry_type in \('payment','deposit'\) then p\.amount else -p\.amount/);
});
