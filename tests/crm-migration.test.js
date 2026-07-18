const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "customer-crm.sql"), "utf8");
const rollback = fs.readFileSync(path.join(__dirname, "..", "supabase", "customer-crm-rollback.sql"), "utf8");

for (const required of [
  "create table if not exists public.customers",
  "create table if not exists public.customer_activities",
  "customer_id uuid",
  "customers_email_unique",
  "customers_phone_unique",
  "customers_name_company_unique",
  "app_metadata",
  "submit_quote_with_customer",
  "crm_find_or_create_customer",
  "crm_match_customer_identity",
  "crm_quote_activity",
  "crm_booking_activity",
  "alter table public.bookings alter column customer_id set not null",
  "revoke all on public.customers, public.customer_activities from anon"
]) assert.ok(migration.toLowerCase().includes(required.toLowerCase()), `migration contains ${required}`);

assert.ok(!migration.includes("using (true)"), "CRM policies are not unconditional");
assert.ok(!migration.includes("with check (true)"), "CRM write policies are not unconditional");
assert.ok(migration.includes("length(v_phone_search) > 0"), "text searches cannot degenerate into a match-all phone search");
assert.ok(migration.includes("v_email_id uuid"), "email identity is resolved independently");
assert.ok(migration.includes("v_phone_id uuid"), "phone identity is resolved independently");
assert.ok(migration.includes("v_name_company_id uuid"), "name and company identity is resolved independently");
assert.ok(migration.includes("v_email_id <> v_phone_id"), "conflicting email and phone matches are rejected");
assert.ok(migration.includes("v_email_id <> v_name_company_id"), "conflicting email and name/company matches are rejected");
assert.ok(migration.includes("pg_advisory_xact_lock"), "overlapping simultaneous creations are serialized");
assert.ok(migration.includes("exception when unique_violation"), "unique races are resolved after the database constraint wins");
assert.ok(migration.includes("Unable to submit quote with the supplied contact information"), "anonymous conflicts return a generic error");
assert.ok(!migration.includes("order by archived asc, created_at asc\n  limit 1"), "identity resolution never chooses the first OR match");
assert.ok(migration.includes("crm_protect_booking_customer_link"), "booking customer links enforce administrator authorization");
assert.ok(migration.includes("crm_protect_lead_customer_link"), "quote customer links enforce administrator authorization");
for (const rerunnable of [
  "create table if not exists public.customers",
  "create unique index if not exists customers_email_unique",
  "alter table public.leads add column if not exists customer_id",
  "drop trigger if exists crm_quote_activity",
  "create or replace function public.crm_match_customer_identity"
]) assert.ok(migration.toLowerCase().includes(rerunnable.toLowerCase()), `rerunnable migration contains ${rerunnable}`);
assert.ok(rollback.includes("drop table if exists public.customer_activities"), "rollback removes CRM activities");
assert.ok(rollback.includes("alter table public.bookings drop column if exists customer_id"), "rollback preserves bookings while unlinking CRM");
assert.ok(rollback.includes("drop function if exists public.crm_match_customer_identity"), "rollback removes the identity matcher");

console.log("crm-migration tests passed");
