"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const ai=require("../server/marketing-ai-provider.js");
const email=require("../server/marketing-email.js");
const webhook=require("../api/email-webhook.js");
const contentApi=require("../api/admin-marketing-content.js");

const validInput={content_type:"promotional_email",campaign_goal:"Book corporate lunches",target_audience:"Local office managers",offer:"Free brownies",event_type:"Corporate lunch",tone:"professional",length:"medium",important_details:"Orders require 15 guests.",call_to_action:"Request a Quote"};

test("AI generation validates supported content, tone, and input limits",()=>{
  assert.equal(ai.validateInput(validInput).content_type,"promotional_email");
  assert.throws(()=>ai.validateInput({...validInput,tone:"reckless"}),/tone/i);
  assert.throws(()=>ai.validateInput({...validInput,important_details:"x".repeat(30000)}),/large/i);
});
test("AI provider test mode never calls a live provider",async()=>{
  let called=false;
  const result=await ai.generateMarketingContent(ai.validateInput(validInput),{configuration:{mode:"test",provider:"test",model:"test-model"},fetchImpl:async()=>{called=true;}});
  assert.equal(called,false);assert.equal(result.provider,"test");assert.match(result.output.body,/test-mode/i);
});
test("AI test mode deterministically covers every supported draft type",async()=>{
  const required=["facebook_post","instagram_caption","google_business_post","promotional_email","blog_draft","google_ads","meta_ads","executive_summary"];
  for(const content_type of required){
    let called=false;
    const input=ai.validateInput({...validInput,content_type});
    const first=await ai.generateMarketingContent(input,{configuration:{mode:"test",provider:"test",model:"test-model"},fetchImpl:async()=>{called=true;}});
    const second=await ai.generateMarketingContent(input,{configuration:{mode:"test",provider:"test",model:"test-model"},fetchImpl:async()=>{called=true;}});
    assert.equal(called,false);assert.deepEqual(first,second);assert.match(first.output.body,/not sent or published/i);
  }
});
test("AI provider fails safely when credentials are absent",async()=>{
  await assert.rejects(()=>ai.generateMarketingContent(ai.validateInput(validInput),{configuration:{mode:"unconfigured"}}),error=>error.code==="AI_NOT_CONFIGURED");
});
test("AI provider aborts a timed-out request with a safe error",async()=>{
  const fetchImpl=(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener("abort",()=>reject(Object.assign(new Error("aborted"),{name:"AbortError"}))));
  await assert.rejects(()=>ai.generateMarketingContent(ai.validateInput(validInput),{configuration:{mode:"send",provider:"openai",key:"test",model:"test",timeoutMs:5,maxTokens:300},fetchImpl}),error=>error.code==="AI_TIMEOUT");
});
test("AI endpoint rejects unauthenticated and oversized requests before provider access",async()=>{
  const invoke=async request=>{
    const result={statusCode:0,headers:{},body:"",setHeader(key,value){this.headers[key]=value;},end(body){this.body=body;}};
    await contentApi(request,result);
    return result;
  };
  assert.equal((await invoke({method:"POST",headers:{},body:validInput})).statusCode,401);
  assert.equal((await invoke({method:"POST",headers:{"content-length":"24577"},body:validInput})).statusCode,413);
});
test("AI output rejects invalid or unstructured provider content",()=>{
  assert.throws(()=>ai.validateOutput("not an object"),/structured/i);
  assert.throws(()=>ai.validateOutput({title:"Only a title"}),/required/i);
});
test("AI configuration never exposes keys and disables test mode in production",()=>{
  const configured=ai.config({AI_PROVIDER:"openai",OPENAI_API_KEY:"secret",AI_MODEL:"model"});
  assert.equal(configured.mode,"send");assert.equal(configured.key,"secret");
  assert.equal(ai.config({AI_PROVIDER:"test",VERCEL_ENV:"production"}).mode,"unconfigured");
  assert.doesNotMatch(read("js/admin-release-4-marketing.js"),/OPENAI_API_KEY|MARKETING_AI_API_KEY/);
});
test("structured templates replace allowlisted variables and escape HTML",()=>{
  const html=email.renderBlocks([{type:"headline",text:"Hi {{first_name}}"},{type:"text",text:"<script>{{unknown}}</script>"},{type:"button",text:"Open",url:"javascript:alert(1)"}],{first_name:"A&B"});
  assert.match(html,/A&amp;B/);assert.doesNotMatch(html,/<script>/);assert.match(html,/href="#"/);
});
test("plain text fallback removes image-only blocks and missing variables",()=>{
  assert.equal(email.plainText([{type:"image",url:"https://example.com/a.jpg"},{type:"text",text:"Hello {{first_name}} {{company_name}}"}],{first_name:"Jordan"}),"Hello Jordan");
});
test("transactional email supports a safe reply-to without changing test behavior",()=>{
  const source=read("server/transactional-email.js");
  assert.match(source,/reply_to/);assert.match(source,/EMAIL_PATTERN\.test/);
  assert.match(source,/List-Unsubscribe/);assert.match(source,/List-Unsubscribe-Post/);
});
test("webhook signatures validate payload, timestamp, and secret",()=>{
  const raw=JSON.stringify({type:"email.delivered"}),timestamp=String(Math.floor(Date.now()/1000)),id="evt_1";
  const key=crypto.randomBytes(32),secret=`whsec_${key.toString("base64")}`;
  const signature=crypto.createHmac("sha256",key).update(`${id}.${timestamp}.${raw}`).digest("base64");
  assert.equal(webhook.verifySignature(raw,{"svix-id":id,"svix-timestamp":timestamp,"svix-signature":`v1,${signature}`},secret),true);
  assert.equal(webhook.verifySignature(`${raw}x`,{"svix-id":id,"svix-timestamp":timestamp,"svix-signature":`v1,${signature}`},secret),false);
});
test("webhook maps delivery events and rejects unsupported events",()=>{
  for(const [provider,expected] of Object.entries({"email.sent":"sent","email.delivered":"delivered","email.opened":"opened","email.clicked":"clicked","email.delivery_delayed":"deferred","email.bounced":"bounced","email.complained":"complained","email.failed":"failed"}))assert.equal(webhook.eventType(provider),expected);
  assert.equal(webhook.eventType("contact.updated"),"");
  assert.deepEqual(webhook.config,{api:{bodyParser:false}});
});
test("campaign schema supports lifecycle, AI drafts, tags, and attribution",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql");
  for(const value of ["marketing_campaigns","marketing_ai_content","draft','scheduled','running','paused','completed','cancelled','archived","campaign_id"])assert.match(sql,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});
test("email schema supports templates, sequences, conditions, enrollment, and ordering",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql");
  for(const value of ["marketing_email_templates","marketing_email_sequences","marketing_email_sequence_steps","marketing_email_enrollments","delay_minutes","conditions","marketing_reorder_step"])assert.match(sql,new RegExp(value));
  assert.match(sql,/foreach t in array[\s\S]*?end loop;\s*end;\s*\$\$;/);
  assert.match(sql,/unique\(sequence_id,customer_id,trigger_key\)/);
  for(const condition of ["customer_not_replied","proposal_not_viewed","proposal_viewed","proposal_not_approved","customer_booked","customer_not_booked","corporate_lead","repeat_customer","event_not_passed"])assert.match(sql,new RegExp(condition));
});
test("automatic triggers cover required lead, proposal, booking, and timed events",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql");
  for(const value of ["marketing_lead_enrollment","marketing_proposal_enrollment","marketing_booking_enrollment","marketing_schedule_time_enrollments","proposal_not_viewed","proposal_expired","event_approaching","customer_inactive"])assert.match(sql,new RegExp(value));
  assert.match(sql,/Does not enroll existing customers/i);
});
test("marketing consent and suppression are rechecked immediately before send",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql"),runner=read("api/follow-up-run.js");
  assert.match(sql,/marketing_validate_claim/);assert.match(sql,/marketing_has_consent/);assert.match(sql,/marketing_is_suppressed/);
  assert.match(sql,/marketing_email_sequences s[\s\S]*s\.status<>'active'/);
  assert.match(sql,/marketing_campaigns c[\s\S]*c\.status<>'running'/);
  assert.match(runner,/rpc\/marketing_validate_claim/);assert.ok(runner.indexOf("marketing_validate_claim")<runner.indexOf("const delivery=await sendTransactionalEmail"));
});
test("unsubscribe is tokenized, public-only by RPC, and preserves prior consent history",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql"),page=read("unsubscribe.html");
  assert.match(sql,/gen_random_bytes\(32\)/);assert.match(sql,/token_hash=encode\(digest/);
  assert.match(sql,/grant execute on function public\.marketing_unsubscribe\(text,text,uuid\) to anon/);
  assert.match(sql,/marketing_consent_audit/);assert.match(sql,/marketing_consent_history_preserved/);
  assert.doesNotMatch(page,/customer_id/i);
});
test("marketing email delivery uses unsubscribe links, retry limits, and exponential delay",()=>{
  const runner=read("api/follow-up-run.js");
  assert.match(runner,/PUBLIC_SITE_URL/);assert.match(runner,/marketing_create_unsubscribe_token/);
  assert.match(runner,/max_retries/);assert.match(runner,/2\*\*\(retryCount-1\)/);assert.match(runner,/processing_started_at:null/);
});
test("campaign reporting labels only recorded provider events",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql"),ui=read("js/admin-release-4-marketing.js");
  assert.match(sql,/marketing_campaign_report/);assert.match(sql,/count\(\*\)/);
  for(const filter of ["p_sequence_id","p_audience","p_source","p_status"])assert.match(sql,new RegExp(filter));
  for(const result of ["leads_generated","quotes_generated","bookings_attributed","revenue_attributed"])assert.match(sql,new RegExp(result));
  assert.match(ui,/not perfectly accurate/i);assert.doesNotMatch(sql,/random\(\).*revenue|fabricat/i);
});
test("campaign and template admin actions cover required lifecycle operations",()=>{
  const script=read("js/admin-release-4-marketing.js");
  for(const action of ["Preview","Duplicate","Pause","Resume","Archive","data-r4-archive-template","r4MobilePreview","r4TestEmail"])assert.match(script,new RegExp(action,"i"));
});
test("sequence admin supports manual enrollment, cancellation, ordering, removal, and test-safe conditions",()=>{
  const script=read("js/admin-release-4-marketing.js"),sql=read("supabase/release-4-ai-marketing.sql");
  for(const action of ["Manually Enroll Customer","marketing_enroll_customer","data-r4-cancel-enrollment","marketing_cancel_enrollment","marketing_reorder_step","data-r4-remove-step"])assert.match(script,new RegExp(action));
  assert.match(sql,/marketing_cancel_enrollment/);assert.match(sql,/'cancel:'\|\|v_message\.id,'cancelled'/);
  assert.match(sql,/position<v_step\.position[\s\S]*order by position desc/);
  assert.match(sql,/position>v_step\.position[\s\S]*order by position asc/);
});
test("executive AI summary is manual, aggregate-only, and saved through draft generation",()=>{
  const script=read("js/admin-release-4-marketing.js");
  assert.match(script,/r4ExecutiveSummary/);assert.match(script,/aggregate_counts/);assert.match(script,/period_days:30/);
  assert.doesNotMatch(script,/setInterval\([^)]*generateExecutiveSummary|customer.*email.*important_details/i);
});
test("Release 4 data allows only RLS-filtered anonymous reads",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql");
  const anonymousReadTables=[
    "marketing_campaigns","marketing_ai_content","marketing_email_templates",
    "marketing_email_sequences","marketing_email_enrollments","marketing_suppressions",
    "marketing_email_events"
  ];
  assert.match(sql,/using \(public\.crm_is_admin\(\)\) with check \(public\.crm_is_admin\(\)\)/);
  assert.match(sql,/revoke all on public\.%I from public,anon,authenticated/);
  const grant=sql.match(/grant select on table([\s\S]*?)to anon;/i);
  assert.ok(grant,"anonymous SELECT grant must exist");
  const granted=[...grant[1].matchAll(/public\.([a-z_]+)/g)].map(match=>match[1]).sort();
  assert.deepEqual(granted,[...anonymousReadTables].sort());
  assert.doesNotMatch(sql,/grant\s+(?:all|insert|update|delete|truncate|references|trigger)[^;]*\bto\s+anon\b/i);
  assert.doesNotMatch(sql,/grant\s+usage[^;]*sequence[^;]*\bto\s+anon\b/i);
  assert.match(sql,/revoke insert,update,delete on public\.marketing_email_events from authenticated/);
  assert.match(sql,/revoke insert,update,delete on public\.marketing_consent_audit from authenticated/);
});
test("rollback refuses to destroy business or compliance history",()=>{
  const sql=read("supabase/release-4-ai-marketing-rollback.sql");
  assert.match(sql,/Rollback refused/);assert.match(sql,/marketing_suppressions/);assert.match(sql,/marketing_consent_audit/);assert.match(sql,/marketing_email_events/);
  assert.match(sql,/marketing_campaign_report\(date,date,uuid,uuid,text,text,text\)/);
});
test("forward migration is transaction-wrapped and rerunnable without duplicate report definitions",()=>{
  const sql=read("supabase/release-4-ai-marketing.sql");
  assert.match(sql,/^\s*begin;/m);assert.match(sql,/\bcommit;\s*$/);
  assert.doesNotMatch(sql,/return query\s+return query/);
  for(const pattern of [/create table if not exists/g,/create index if not exists/g,/drop trigger if exists/g,/create or replace function/g])assert.ok((sql.match(pattern)||[]).length>0);
});
test("admin UI is wired once and includes all Release 4 workspaces",()=>{
  const html=read("admin.html"),script=read("js/admin-release-4-marketing.js");
  assert.equal((html.match(/js\/admin-release-4-marketing\.js/g)||[]).length,1);
  assert.equal((html.match(/id="marketingAiPanel"/g)||[]).length,1);
  for(const value of ["AI Content","Campaigns","Templates","Sequences","Reporting"])assert.match(script,new RegExp(value,"i"));
});
test("public unsubscribe script is included once and handles timeout errors",()=>{
  const html=read("unsubscribe.html"),script=read("js/unsubscribe.js");
  assert.equal((html.match(/js\/unsubscribe\.js/g)||[]).length,1);assert.match(script,/AbortSignal\.timeout/);assert.match(html,/noindex,nofollow/);
});
test("required Release 4 environment variables are placeholders only",()=>{
  const env=read(".env.test.example");
  for(const name of ["AI_PROVIDER","AI_MODEL","OPENAI_API_KEY","AI_REQUEST_TIMEOUT_MS","AI_MAX_OUTPUT_TOKENS","MARKETING_EMAIL_FROM","MARKETING_EMAIL_REPLY_TO","EMAIL_WEBHOOK_SECRET","FOLLOW_UP_CRON_SECRET","ADMIN_BASE_URL","PUBLIC_SITE_URL"])assert.match(env,new RegExp(`^${name}=$`,"m"));
  assert.doesNotMatch(env,/sk-[A-Za-z0-9]|whsec_[A-Za-z0-9+/]{10}/);
});
