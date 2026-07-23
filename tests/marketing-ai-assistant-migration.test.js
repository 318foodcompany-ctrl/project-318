"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "marketing-ai-assistant.sql"), "utf8");
const rollback = fs.readFileSync(path.join(__dirname, "..", "supabase", "marketing-ai-assistant-rollback.sql"), "utf8");

test("marketing assistant migration is transactional and rerunnable", () => {
  assert.match(sql, /\bbegin;/i);
  assert.match(sql, /create table if not exists public\.marketing_ai_audit/i);
  assert.match(sql, /drop policy if exists/i);
  assert.match(sql, /create or replace function public\.marketing_ai_review/i);
  assert.match(sql, /security definer\s+set search_path = public/i);
  assert.match(sql, /commit;\s*$/i);
});

test("marketing assistant audit data is administrator-only", () => {
  assert.match(sql, /public\.crm_is_admin\(\)/i);
  assert.match(sql, /revoke all on public\.marketing_ai_audit from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant .*anon/i);
  assert.match(sql, /review_status[^;]+draft/i);
});

test("rollback refuses to destroy existing audit history", () => {
  assert.match(rollback, /and exists \(select 1 from public\.marketing_ai_audit limit 1\)/i);
  assert.match(rollback, /preserve or export them before rollback/i);
});
