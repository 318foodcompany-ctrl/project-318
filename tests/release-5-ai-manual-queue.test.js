"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("manual queue endpoint is administrator-only and queues drafts without publishing",()=>{
  const source=read("server/api/admin-marketing-autopilot-queue.js");
  assert.match(source,/adminContext/);
  assert.match(source,/marketing_ai_tasks/);
  assert.match(source,/status:\"queued\"/);
  assert.match(source,/priority:80/);
  assert.match(source,/publication_actions:0,send_actions:0/);
  assert.match(source,/published:false,sent:false/);
  assert.doesNotMatch(source,/sendTransactionalEmail|facebook\.com|instagram\.com|googleapis\.com|publish_post|ad_spend/i);
});

test("manual queue is bounded and supports every Autopilot draft type",()=>{
  const source=read("server/api/admin-marketing-autopilot-queue.js");
  assert.match(source,/Math\.max\(1,Math\.min\(5/);
  for(const type of ["blog_draft","faq_draft","seo_recommendation","facebook_post","instagram_caption","linkedin_post","google_business_post","email_newsletter","promotional_email","landing_page","seasonal_campaign","holiday_campaign","analytics_summary","growth_recommendation"])assert.match(source,new RegExp(type));
});

test("Autopilot settings expose Generate Draft Now without schedule changes",()=>{
  const html=read("ai-autopilot.html"),ui=read("js/admin-ai-queue-now.js");
  assert.match(html,/admin-ai-queue-now\.js/);
  assert.match(html,/queue one draft immediately without changing the schedule/);
  assert.match(ui,/Generate 1 Draft Now/);
  assert.match(ui,/admin-marketing-autopilot-queue/);
  assert.match(ui,/ready for approval/);
});

test("Generate Draft Now securely runs queued work for an administrator",()=>{
  const endpoint=read("server/api/admin-marketing-autopilot-run-now.js"),router=read("api/admin-marketing.js"),ui=read("js/admin-ai-queue-now.js"),vercel=read("vercel.json");
  assert.match(endpoint,/adminContext/);
  assert.match(endpoint,/AI_AUTOPILOT_CRON_SECRET/);
  assert.match(endpoint,/marketing-autopilot-run/);
  assert.match(router,/autopilot-run-now/);
  assert.match(vercel,/admin-marketing-autopilot-run-now/);
  assert.match(ui,/admin-marketing-autopilot-run-now/);
  assert.match(ui,/ready for approval/);
});

