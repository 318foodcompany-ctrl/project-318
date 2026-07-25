"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("follow-up workers claim rows atomically and recover abandoned claims",()=>{
  const sql=read("supabase/launch-readiness-hardening.sql"),runner=read("api/follow-up-run.js");
  assert.match(sql,/for update skip locked/i);
  assert.match(sql,/set status='processing',processing_started_at=now\(\)/);
  assert.match(sql,/processing_started_at<now\(\)-interval '15 minutes'/);
  assert.match(sql,/revoke all on function public\.sales_claim_due_followups\(integer\) from public,anon,authenticated/);
  assert.match(runner,/rpc\/sales_claim_due_followups/);
  assert.match(runner,/timingSafeEqual/);
  assert.doesNotMatch(runner,/follow_up_messages\?status=eq\.queued/);
});

test("customer uploads validate content signatures, size, type, timeout, and orphan cleanup",()=>{
  const endpoint=require("../api/portal-document.js"),source=read("api/portal-document.js");
  assert.equal(endpoint.validSignature(Buffer.from("%PDF-1.7"),"application/pdf"),true);
  assert.equal(endpoint.validSignature(Buffer.from("<script>"),"application/pdf"),false);
  assert.equal(endpoint.validSignature(Buffer.from("89504e470d0a1a0a","hex"),"image/png"),true);
  assert.equal(endpoint.validSignature(Buffer.from("524946460000000057454250","hex"),"image/webp"),true);
  assert.match(source,/encoded\.length>5592408/);
  assert.match(source,/AbortSignal\.timeout\(10000\)/);
  assert.match(source,/method:"DELETE"/);
});

test("proposal PDF database requests have a bounded timeout",()=>{
  assert.match(read("api/proposal-pdf.js"),/AbortSignal\.timeout\(10000\)/);
});

test("sales pipeline and portal tabs are keyboard and screen-reader operable",()=>{
  const admin=read("admin.html"),sales=read("js/admin-sales-platform.js"),portal=read("portal.html"),portalJs=read("js/customer-portal.js");
  assert.match(admin,/role="tab" aria-selected="true"[^>]+data-sales-view="pipeline"/);
  assert.match(sales,/data-move-opportunity/);
  assert.match(sales,/setAttribute\("aria-selected"/);
  assert.match(portal,/id="portalActionStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.ok((portal.match(/role="tab"/g)||[]).length>=5);
  assert.match(portalJs,/content\.focus/);
});

test("static caching and security response headers are configured safely",()=>{
  const config=JSON.parse(read("vercel.json")),text=JSON.stringify(config);
  assert.match(text,/stale-while-revalidate/);
  assert.match(text,/Cross-Origin-Opener-Policy/);
  assert.match(text,/X-Permitted-Cross-Domain-Policies/);
  assert.match(text,/Cache-Control/);
});

test("friendly 404 and 500 pages are non-indexable and provide recovery actions",()=>{
  for(const file of ["404.html","500.html"]){const html=read(file);assert.match(html,/name="robots" content="noindex"/);assert.match(html,/href="\/"/);}
});

test("required operational guides and safe environment example are present",()=>{
  for(const file of ["PRODUCTION-CHECKLIST.md","DISASTER-RECOVERY.md","BACKUP-RESTORE.md","ADMIN-GUIDE.md"])assert.ok(read(file).length>1000,`${file} should contain operating guidance`);
  const example=read(".env.test.example");
  assert.match(example,/FOLLOW_UP_CRON_SECRET=/);
  assert.doesNotMatch(example,/FOLLOW_UP_CRON_SECRET=.+/);
});
