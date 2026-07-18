const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "invoicing-payments.sql"), "utf8").toLowerCase();
const rollback = fs.readFileSync(path.join(root, "supabase", "invoicing-payments-rollback.sql"), "utf8").toLowerCase();

for (const required of [
  "create table if not exists public.invoices",
  "create table if not exists public.invoice_line_items",
  "create table if not exists public.payments",
  "create table if not exists public.invoice_number_sequences",
  "invoices_active_quote_unique",
  "invoices_active_booking_unique",
  "invoicing_next_number",
  "invoicing_recalculate",
  "invoicing_record_payment",
  "invoicing_reverse_payment",
  "invoicing_customer_summary",
  "invoicing_summary",
  "public.crm_is_admin()",
  "revoke all on public.invoice_number_sequences,public.invoices,public.invoice_line_items,public.payments from anon"
]) assert.ok(migration.includes(required), `migration contains ${required}`);

assert.ok(!migration.includes("using (true)"));
assert.ok(!migration.includes("with check (true)"));
assert.ok(migration.includes("payment history is append-only"));
assert.ok(migration.includes("payment exceeds invoice balance"));
assert.ok(migration.includes("refund exceeds paid amount"));
assert.ok(migration.includes("on conflict (sequence_year) do update"));
assert.ok(migration.includes("greatest(6, length(v_number::text))"), "invoice numbers do not truncate after six digits");
assert.ok(migration.includes("booking is not linked to the supplied quote"), "booking and quote sources must be related");
assert.ok(migration.includes("select customer_id, quote_id into v_source_customer, v_booking_quote"));
assert.ok(migration.includes("create table if not exists"));
assert.ok(migration.includes("drop trigger if exists"));
assert.ok(migration.includes("drop policy if exists"));

assert.ok(rollback.includes("accounting tables and records are intentionally preserved"));
assert.ok(!rollback.includes("drop table"));
assert.ok(!rollback.includes("delete from"));
assert.ok(!rollback.includes("truncate"));

console.log("invoice migration tests passed");
