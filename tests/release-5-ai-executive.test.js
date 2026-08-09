"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const executive=require("../server/api/admin-marketing-autopilot-executive.js");

test("executive pulse uses recorded aggregates and deterministic workflow facts",()=>{
  const pulse=executive.buildExecutivePulse(
    {period_days:30,generated_at:"2026-08-07T18:00:00Z",leads:{total:12},bookings:{total:3,confirmed:2,quoted_value:4200},invoices:{paid_value:2500,outstanding_value:700},content_inventory:{published_blog_count:2,published_faq_count:5}},
    [{status:"ready_for_approval"},{status:"approved"},{status:"approved"}],
    [{enabled:true},{enabled:false}],
    {by_content_type:{blog_draft:{approved:4,rejected:1,edited:2,regenerated:1}}}
  );
  assert.equal(pulse.business.leads,12);assert.equal(pulse.business.bookings,3);assert.equal(pulse.business.paid_value,2500);
  assert.equal(pulse.ai.waiting_for_approval,1);assert.equal(pulse.ai.enabled_automations,1);assert.equal(pulse.ai.approval_rate_percent,80);
  assert.equal(pulse.content.published_blogs,2);assert.equal(pulse.content.published_faqs,5);
  assert.ok(pulse.recommendations.some(x=>/blog library/i.test(x.title)));
});

test("executive pulse does not fabricate a growth score or market data",()=>{
  const source=read("server/api/admin-marketing-autopilot-executive.js"),html=read("ai-autopilot.html"),ui=read("js/admin-ai-executive.js");
  assert.doesNotMatch(source,/growth_score|market share|search volume|random\(/i);
  assert.match(html,/deterministic alerts from recorded aggregate data/i);
  assert.match(ui,/Recorded paid value/);assert.match(ui,/Draft approval rate/);
});

test("executive endpoint remains administrator authenticated and aggregate-only",()=>{
  const source=read("server/api/admin-marketing-autopilot-executive.js");
  assert.match(source,/adminContext/);assert.match(source,/marketing_ai_business_snapshot/);assert.match(source,/marketing_ai_feedback_summary/);
  assert.doesNotMatch(source,/customer_name|email_address|phone|internal_notes|proposal_notes/i);
});

test("AI Autopilot UI exposes executive pulse without weakening approval controls",()=>{
  const html=read("ai-autopilot.html"),autopilot=read("js/admin-ai-autopilot.js");
  assert.match(html,/data-view="executiveView"/);assert.match(html,/id="executiveRecommendations"/);assert.match(html,/js\/admin-ai-executive\.js/);
  assert.match(autopilot,/Nothing was published or sent/);
});
