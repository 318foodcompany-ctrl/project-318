const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const baseline = fs.readFileSync(path.join(root, "supabase", "baseline-schema.sql"), "utf8").toLowerCase();
const crm = fs.readFileSync(path.join(root, "supabase", "customer-crm.sql"), "utf8").toLowerCase();
const statusFix = fs.readFileSync(path.join(root, "supabase", "customer-crm-status-fix.sql"), "utf8").toLowerCase();
const hardening = fs.readFileSync(path.join(root, "supabase", "website-settings-admin-hardening.sql"), "utf8").toLowerCase();

for (const table of ["leads", "website_content", "menu_items"]) {
  assert.ok(baseline.includes(`create table if not exists public.${table}`));
  assert.ok(baseline.includes(`alter table public.${table} enable row level security`));
}

assert.ok(baseline.includes("generated always as identity primary key"));
assert.ok(baseline.includes("website_content_page_content_key_key unique (page, content_key)"));
assert.ok(baseline.includes("menu_items_slug_key unique (slug)"));
assert.ok(baseline.includes('create policy "anyone can insert leads"'));
assert.ok(baseline.includes('create policy "authenticated users can view leads"'));
assert.ok(baseline.includes('create policy "public can read website content"'));
assert.ok(baseline.includes('create policy "public can read menu items"'));
assert.ok(baseline.includes("grant select, insert, references on public.leads to anon"));
assert.ok(baseline.includes("grant select, insert, update, references on public.leads to authenticated"));
assert.ok(baseline.includes("grant all on public.leads to service_role"));
assert.ok(baseline.includes("grant usage on sequence public.leads_id_seq to anon, authenticated, service_role"));

for (const laterObject of [
  "customer_id uuid",
  "leads_customer_id_fkey",
  "leads_customer_id_idx",
  "crm administrators can update quote status",
  "crm_protect_lead_customer_link",
  "crm_quote_activity",
  "crm_is_admin",
  "submit_quote_with_customer"
]) assert.equal(baseline.includes(laterObject), false, `${laterObject} stays out of the baseline`);

assert.ok(crm.includes("alter table public.leads add column if not exists customer_id uuid"));
assert.ok(crm.includes("leads_customer_id_fkey"));
assert.ok(crm.includes("leads_customer_id_idx"));
assert.ok(crm.includes("crm_protect_lead_customer_link"));
assert.ok(crm.includes("crm_quote_activity"));
assert.ok(crm.includes("submit_quote_with_customer"));
assert.ok(statusFix.includes('create policy "crm administrators can update quote status"'));

assert.ok(hardening.includes('drop policy if exists "authenticated users can manage website settings"'));
assert.ok(hardening.includes("using (public.crm_is_admin())"));
assert.ok(hardening.includes("with check (public.crm_is_admin())"));
assert.equal(hardening.includes("using (true)"), false);
assert.equal(hardening.includes("with check (true)"), false);

console.log("baseline migration tests passed");
