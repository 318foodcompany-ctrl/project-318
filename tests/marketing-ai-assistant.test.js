"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assistant = require("../server/api/admin-marketing-assistant.js");

function responseRecorder() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
}

test("sanitizes customer identity and credential-shaped context", () => {
  assert.deepEqual(assistant.sanitizeContext({
    source: "google",
    email: "person@example.com",
    api_key: "secret",
    nested: { phone: "3185550100", sessions: 12 }
  }), { source: "google", nested: { sessions: 12 } });
});

test("accepts only structured draft recommendations", () => {
  const draft = assistant.validateDraft({ summary: "Opportunity found", suggestions: [{ title: "Improve title", rationale: "It is vague", proposed_value: "Catering", confidence: "high" }] });
  assert.equal(draft.suggestions[0].confidence, "high");
  assert.throws(() => assistant.validateDraft({ summary: "No actions", suggestions: [] }));
});

test("non-administrators cannot reach the AI provider", { concurrency: false }, async () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const calls = [];
  process.env.PUBLIC_SUPABASE_URL = "https://staging.supabase.co";
  process.env.PUBLIC_SUPABASE_ANON_KEY = "public-anon";
  process.env.MARKETING_AI_API_URL = "https://provider.example/v1/chat";
  process.env.MARKETING_AI_API_KEY = "server-secret";
  process.env.MARKETING_AI_MODEL = "test-model";
  global.fetch = async (url) => {
    calls.push(String(url));
    const body = String(url).includes("/auth/v1/user") ? { id: "user-1" } : false;
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  try {
    const response = responseRecorder();
    await assistant({ method: "POST", headers: { authorization: "Bearer user-token" }, body: { analysis_type: "seo", context: {} } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error, "Administrator access required.");
    assert.equal(calls.some(url => url.startsWith("https://provider.example")), false);
  } finally {
    global.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("assistant credentials remain server-only and admin script loads once", () => {
  const root = path.join(__dirname, "..");
  const runtime = fs.readFileSync(path.join(root, "api", "runtime-config.js"), "utf8");
  const supabaseLoader = fs.readFileSync(path.join(root, "js", "supabase.js"), "utf8");
  assert.doesNotMatch(runtime, /MARKETING_AI_(API_KEY|API_URL|MODEL)/);
  assert.equal((supabaseLoader.match(/admin-marketing-assistant\.js/g) || []).length, 1);
});

test("the dashboard uses the existing OpenAI account only at its first-party endpoint",()=>{
  const env={AI_PROVIDER:"openai",OPENAI_API_KEY:"fixture",AI_MODEL:"fixture-model"};
  const native=assistant.providerConfig(env);
  assert.equal(native.url,"https://api.openai.com/v1/responses");
  assert.equal(native.key,"fixture");
  assert.equal(assistant.providerConfig({...env,MARKETING_AI_API_URL:"https://example.org"}).key,"");
});

test("performance prompts allow aggregate measures and exclude identifying or free-form fields",()=>{
  const output=assistant.reportingContext({period:{start:"2026-11-01"},totals:{quotes:2,revenue:1200},funnel_by_source:[{source:"name@example.org",quote_count:2,notes:"private"}],google_analytics:{acquisition:[{sessionSourceMedium:"google / organic",sessions:3,sessionCampaignName:"private campaign"}],events:[{eventName:"arbitrary_personal_text"}]}});
  assert.equal(output.google_analytics.acquisition[0].sessions,3);
  assert.equal(output.funnel_by_source[0].source,"Other source");
  assert.equal(output.google_analytics.events.length,0);
  assert.doesNotMatch(JSON.stringify(output),/example.org|private|1200/);
});

test("the authorized OpenAI advisor stores one private draft from aggregate data", {concurrency:false}, async()=>{
  const ga=require("../server/google-analytics.js");
  const previousDashboard=ga.dashboard;
  const originalFetch=global.fetch, previous={...process.env}, requests=[];
  try {
    Object.assign(process.env,{PUBLIC_SUPABASE_URL:"https://fixture.supabase.co",PUBLIC_SUPABASE_ANON_KEY:"public",AI_MODEL:"model",AI_PROVIDER:"openai",OPENAI_API_KEY:"fixture-key"});
    delete process.env.MARKETING_AI_API_URL;
    const expectedPeriod=assistant.completeReportingPeriod();
    ga.dashboard=async (_env,_fetch,_identity,period)=>{assert.deepEqual(period,expectedPeriod);return {configured:true,summary:[{dateRange:"current",sessions:3}]};};
    global.fetch=async(url,options={})=>{
      requests.push({url:String(url),options});
      const value=String(url).endsWith("/user")?{id:"owner"}:String(url).includes("crm_is_admin")?true:
        String(url).includes("/rpc/marketing_quote_funnel")?[{source:"direct",quote_count:1,booked_count:0}]:
        String(url).includes("/rpc/marketing_spend_summary")?[]:
        String(url).startsWith("https://api.openai.com/")?{output:[{content:[{text:JSON.stringify({summary:"Check sources",suggestions:[{title:"Review spending",rationale:"Only three sessions",confidence:"low"}]})}]}]}:
        options.method==="POST"?[{id:"draft"}]:[];
      return {ok:true,status:200,text:async()=>JSON.stringify(value),json:async()=>value};
    };
    const stale=responseRecorder();
    await assistant({method:"POST",headers:{authorization:"Bearer fixture"},body:{analysis_type:"next_actions",context:{period:{start:"2026-08-21",end:"2026-11-19"}}}},stale);
    assert.equal(stale.statusCode,409);
    assert.equal(requests.filter(item=>item.url.startsWith("https://api.openai.com/")).length,0);
    const response=responseRecorder();
    await assistant({method:"POST",headers:{authorization:"Bearer fixture"},body:{analysis_type:"next_actions",context:{customer_name:"private",google_analytics:{summary:[{dateRange:"current",sessions:3},{dateRange:"previous",sessions:99}]}}}},response);
    assert.equal(response.statusCode,200);
    const remote=requests.filter(item=>item.url.startsWith("https://api.openai.com/"));
    assert.equal(remote.length,1);
    assert.equal(JSON.parse(remote[0].options.body).store,false);
    const format = JSON.parse(remote[0].options.body).text.format;
    assert.equal(format.type, "json_schema");
    assert.equal(format.strict, true);
    assert.equal(format.schema.additionalProperties, false);
    assert.deepEqual(format.schema.properties.suggestions.items.required, ["title", "rationale", "proposed_value", "confidence"]);
    assert.doesNotMatch(JSON.parse(remote[0].options.body).input,/private|99/);
    const sent = JSON.parse(JSON.parse(remote[0].options.body).input).context;
    assert.deepEqual(sent.period,expectedPeriod);
    assert.deepEqual(sent.totals,{quotes:1,booked:0,spend:0});
    assert.equal(sent.google_analytics.summary[0].sessions,3);
    assert.equal(requests.filter(r=>r.url.includes("/rpc/marketing_")).every(r=>JSON.parse(r.options.body).p_start===expectedPeriod.start && JSON.parse(r.options.body).p_end===expectedPeriod.end),true);
    assert.equal(response.body.status,"draft");
    assert.equal(requests.filter(item=>item.url.includes("/marketing_ai_audit") && item.options.method==="POST").length,1);
  } finally {ga.dashboard=previousDashboard;global.fetch=originalFetch;process.env=previous;}
});
test("the production window uses completed Chicago calendar days across the daylight-saving transition",()=>{
  assert.deepEqual(assistant.completeReportingPeriod(new Date("2026-11-19T12:00:00Z")),{start:"2026-10-20",end:"2026-11-18"});
  assert.deepEqual(assistant.completeReportingPeriod(new Date("2026-11-19T03:00:00Z")),{start:"2026-10-19",end:"2026-11-17"});
  const ui=require("../js/admin-marketing-assistant.js");
  assert.match(ui.periodNote({analysis_type:"next_actions",report_period:{start:"2026-08-21",end:"2026-11-19"}}),/Exclude this draft/);
});
