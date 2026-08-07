"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("Release 3 migration is transactional, dependency-safe, and administrator-only",()=>{
  const sql=read("supabase/release-3-sales-platform.sql");
  assert.match(sql,/^begin;/m);assert.match(sql,/commit;\s*$/);
  assert.match(sql,/to_regprocedure\('public\.crm_is_admin\(\)'\)/);
  assert.ok((sql.match(/public\.crm_is_admin\(\)/g)||[]).length>=8);
  assert.match(sql,/revoke all on public\.%I from anon/);
  assert.doesNotMatch(sql,/drop table public\./i);
});
test("pipeline has all required stages and immutable stage history",()=>{
  const sql=read("supabase/release-3-sales-platform.sql");
  for(const stage of ["new_lead","contacted","proposal_sent","waiting_on_customer","booked","completed","lost"])assert.ok(sql.includes(`'${stage}'`));
  assert.match(sql,/create table if not exists public\.sales_stage_history/);
  assert.match(sql,/revoke insert,update,delete on public\.sales_stage_history from authenticated/);
});
test("proposal totals are server calculated and versions are controlled",()=>{
  const sql=read("supabase/release-3-sales-platform.sql");
  assert.match(sql,/create or replace function public\.sales_save_proposal/);
  assert.match(sql,/jsonb_array_elements\(p_items\)/);
  assert.match(sql,/discount cannot exceed subtotal/i);
  assert.match(sql,/revoke insert,update,delete on public\.proposal_versions from authenticated/);
});
test("portal is token-scoped and excludes private fields",()=>{
  const sql=read("supabase/release-3-sales-platform.sql");
  assert.match(sql,/digest\(coalesce\(p_token,''\),'sha256'\)/);
  assert.match(sql,/revoked_at is null and expires_at>now\(\)/);
  const snapshot=sql.slice(sql.indexOf("create or replace function public.sales_portal_snapshot"),sql.indexOf("create or replace function public.sales_portal_respond"));
  assert.doesNotMatch(snapshot,/'internal_notes'/);
  assert.doesNotMatch(snapshot,/to_jsonb\(b\)/);
  assert.match(sql,/grant execute on function public\.sales_portal_snapshot\(text\) to anon/);
});
test("rollback refuses to destroy Release 3 business records",()=>{
  const sql=read("supabase/release-3-sales-platform-rollback.sql");
  assert.match(sql,/Rollback refused: Release 3 business records exist/);
  assert.match(sql,/exists\(select 1 from public\.proposals limit 1\)/);
});
test("admin and portal scripts load exactly once",()=>{
  const admin=read("admin.html"),portal=read("portal.html");
  for(const script of ["sales-platform-utils.js","sales-platform-service.js","admin-sales-platform.js"])assert.equal((admin.match(new RegExp(script.replace(".","\\."),"g"))||[]).length,1);
  assert.equal((portal.match(/customer-portal\.js/g)||[]).length,1);
  assert.match(admin,/data-panel="salesPlatformPanel"/);
});
test("sales utility calculates totals and safely exports CSV",()=>{
  const utils=require("../js/sales-platform-utils.js");
  const totals=utils.proposalTotals([{quantity:10,unit_price:12,taxable:true},{quantity:1,unit_price:20,taxable:false}],10,10);
  assert.deepEqual(totals,{subtotal:140,discount:10,tax:11,total:141});
  const output=utils.csv([{first_name:'A "quoted"',company:"318, Inc.",archived:false}]);
  assert.match(output,/"A ""quoted"""/);assert.match(output,/"318, Inc\."/);
});
test("PDF endpoint requires scoped authorization and returns valid PDF bytes",()=>{
  const source=read("api/proposal-pdf.js");
  assert.match(source,/crm_is_admin/);assert.match(source,/sales_portal_snapshot/);
  assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source,/service_role[^A-Z_]/i);
  const {pdf}=require("../api/proposal-pdf.js");
  assert.equal(pdf(["318 FOOD CO.","Test"]).subarray(0,8).toString(),"%PDF-1.4");
});
test("follow-up execution is secret-protected, deduplicated, and consent aware",()=>{
  const sql=read("supabase/release-3-sales-platform.sql"),runner=read("api/follow-up-run.js");
  assert.match(sql,/create or replace function public\.sales_schedule_due_followups/);
  assert.ok((sql.match(/on conflict\(idempotency_key\) do nothing/g)||[]).length>=3);
  assert.ok((sql.match(/marketing_consent_status='granted'/g)||[]).length>=2);
  assert.match(sql,/o\.stage not in \('booked','completed','lost'\)/);
  assert.match(runner,/FOLLOW_UP_CRON_SECRET/);
  assert.match(runner,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(runner,/["'][A-Za-z0-9_-]{80,}["']/);
});
test("portal document uploads are private, bounded, and token scoped",()=>{
  const sql=read("supabase/release-3-sales-platform.sql"),endpoint=read("api/portal-document.js"),portal=read("js/customer-portal.js");
  assert.match(sql,/values\('customer-documents','customer-documents',false,4194304/);
  assert.match(endpoint,/sales_portal_snapshot/);
  assert.match(endpoint,/bytes\.length>4194304/);
  assert.match(endpoint,/application\/pdf/);
  assert.match(endpoint,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(portal,/file\.size>4194304/);
});
