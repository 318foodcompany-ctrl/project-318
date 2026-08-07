"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("AI Autopilot exposes reviewable learning insights without automatic brand mutation",()=>{
  const html=read("ai-autopilot.html"),ui=read("js/admin-ai-autopilot.js"),sql=read("supabase/release-5-ai-learning.sql");
  assert.match(html,/data-view="learningView"/);assert.match(html,/Approval learning/);assert.match(html,/does not silently change brand rules/i);
  assert.match(ui,/admin-marketing-autopilot-learning/);assert.match(ui,/learningByType/);assert.match(ui,/recent_reasons/);
  assert.match(sql,/marketing_ai_feedback_summary/);assert.doesNotMatch(sql,/update\s+public\.marketing_ai_brand_brain/i);
});

test("learning summary endpoint is administrator authenticated and read-only",()=>{
  const api=read("api/admin-marketing-autopilot-learning.js");
  assert.match(api,/adminContext/);assert.match(api,/marketing_ai_feedback_summary/);assert.match(api,/req\.method!=="GET"/);
  assert.doesNotMatch(api,/method:\"POST\"[^\n]*(marketing_ai_brand_brain|marketing_ai_feedback_signals)/i);
});
