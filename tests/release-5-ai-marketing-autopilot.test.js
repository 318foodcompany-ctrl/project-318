"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const runner=require("../api/marketing-autopilot-run.js");
const actions=require("../api/admin-marketing-autopilot-action.js");

test("Release 5 schema is additive, approval-only, and administrator protected",()=>{
  const sql=read("supabase/release-5-ai-marketing-autopilot.sql");
  assert.match(sql,/^\s*begin;/m);assert.match(sql,/\bcommit;\s*$/);
  for(const table of ["marketing_ai_brand_brain","marketing_ai_automation_settings","marketing_ai_tasks","marketing_ai_approval_audit"])assert.match(sql,new RegExp(table));
  assert.match(sql,/approval_required boolean not null default true check \(approval_required = true\)/);
  assert.match(sql,/using \(public\.crm_is_admin\(\)\)/);
  assert.doesNotMatch(sql,/grant\s+(?:select|insert|update|delete|all)[^;]*\bto\s+anon\b/i);
});

test("autopilot exposes all planned configurable draft categories",()=>{
  const sql=read("supabase/release-5-ai-marketing-autopilot.sql");
  for(const type of ["blog_draft","faq_draft","seo_recommendation","facebook_post","instagram_caption","linkedin_post","google_business_post","email_newsletter","promotional_email","landing_page","seasonal_campaign","holiday_campaign","analytics_summary","growth_recommendation"])assert.match(sql,new RegExp(type));
  for(const field of ["enabled","cadence","interval_minutes","preferred_hour","items_per_run","tone","target_audience","campaign_goal","custom_instructions","next_run_at"])assert.match(sql,new RegExp(field));
});

test("service-role queue preserves the administrator owner",()=>{
  const runtime=read("supabase/release-5-ai-marketing-autopilot-runtime.sql");
  assert.match(runtime,/created_by uuid/);
  assert.match(runtime,/50,s\.created_by/);
  assert.match(runtime,/if s\.created_by is null[\s\S]*enabled=false/);
});

test("autopilot runner generates drafts only and has no publication or send path",()=>{
  const source=read("api/marketing-autopilot-run.js");
  assert.match(source,/ready_for_approval/);
  assert.match(source,/status:\"draft\"/);
  assert.match(source,/publication_actions:0,send_actions:0/);
  assert.doesNotMatch(source,/sendTransactionalEmail|facebook\.com|instagram\.com|googleapis\.com|publish_post|ad_spend/i);
});

test("approval API requires an administrator and keeps approval separate from publication",()=>{
  const source=read("api/admin-marketing-autopilot-action.js");
  assert.match(source,/crm_is_admin/);
  assert.match(source,/\[\"approve\",\"reject\",\"regenerate\",\"archive\",\"edit\"\]/);
  assert.match(source,/published:false,sent:false/);
  assert.match(source,/marketing_ai_approval_audit/);
  assert.doesNotMatch(source,/sendTransactionalEmail|publish_post|ad_spend/i);
});

test("approval UI supports editable preferences and complete review actions",()=>{
  const html=read("ai-autopilot.html"),ui=read("js/admin-ai-autopilot.js");
  assert.match(html,/Approval Queue/);assert.match(html,/Automation Settings/);assert.match(html,/Business Brain/);assert.match(html,/Audit History/);
  for(const action of ["approve","edit","regenerate","reject"])assert.match(ui,new RegExp(`data-action=\\"${action}\\"`));
  for(const field of ["cadence","items_per_run","preferred_hour","interval_minutes","tone","target_audience","campaign_goal","custom_instructions"])assert.match(ui,new RegExp(field));
  assert.match(ui,/Nothing was published or sent/);
});

test("business brain defaults optimize profitable growth without unsupported claims",()=>{
  const sql=read("supabase/release-5-ai-marketing-autopilot.sql"),runnerSource=read("api/marketing-autopilot-run.js");
  assert.match(sql,/Increase profitable catering growth/);
  assert.match(sql,/fabricated reviews/);assert.match(sql,/guaranteed outcomes/);assert.match(sql,/services not actually offered/);
  assert.match(runnerSource,/Business brain:/);
  assert.match(runnerSource,/Do not invent market data/);
});

test("scheduler endpoints require long secrets and do not expose credentials to browser code",()=>{
  const runnerSource=read("api/marketing-autopilot-run.js"),ui=read("js/admin-ai-autopilot.js");
  assert.match(runnerSource,/expected\.length<32/);
  assert.doesNotMatch(ui,/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|AI_AUTOPILOT_CRON_SECRET|FOLLOW_UP_CRON_SECRET/);
});

test("autopilot helper maps analytical task types into existing safe AI provider",()=>{
  const brand={mission:"Grow profitably",business_facts:{service_area:"Shreveport"},voice_preferences:{tone:"clear"},growth_priorities:["bookings"],prohibited_claims:["guarantees"],seasonal_rules:{}};
  for(const type of ["faq_draft","seo_recommendation","analytics_summary","growth_recommendation"]){
    const built=runner.buildInput({content_type:type,generation_input:{tone:"professional"}},brand);
    assert.equal(built.originalType,type);assert.ok(built.input.important_details.includes("Business brain:"));
  }
});

test("autopilot admin route remains noindex and admin-authenticated",()=>{
  const html=read("ai-autopilot.html"),ui=read("js/admin-ai-autopilot.js");
  assert.match(html,/noindex,nofollow,noarchive/);
  assert.match(ui,/crm_is_admin/);assert.match(ui,/login\.html\?error=unauthorized/);
});
