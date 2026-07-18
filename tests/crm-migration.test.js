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
  "crm_quote_activity",
  "crm_booking_activity",
  "alter table public.bookings alter column customer_id set not null",
  "revoke all on public.customers, public.customer_activities from anon"
]) assert.ok(migration.toLowerCase().includes(required.toLowerCase()), `migration contains ${required}`);

assert.ok(!migration.includes("using (true)"), "CRM policies are not unconditional");
assert.ok(!migration.includes("with check (true)"), "CRM write policies are not unconditional");
assert.ok(migration.includes("length(v_phone_search) > 0"), "text searches cannot degenerate into a match-all phone search");
assert.ok(migration.includes("crm_protect_booking_customer_link"), "booking customer links enforce administrator authorization");
assert.ok(migration.includes("crm_protect_lead_customer_link"), "quote customer links enforce administrator authorization");
assert.ok(rollback.includes("drop table if exists public.customer_activities"), "rollback removes CRM activities");
assert.ok(rollback.includes("alter table public.bookings drop column if exists customer_id"), "rollback preserves bookings while unlinking CRM");

console.log("crm-migration tests passed");
