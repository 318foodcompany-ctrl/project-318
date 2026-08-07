"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("learning schema records administrator feedback without autonomous brand mutation",()=>{
  const sql=read("supabase/release-5-ai-learning.sql");
  for(const value of ["marketing_ai_feedback_signals","approved","edited","rejected","regenerated","before_output","after_output","reason"])assert.match(sql,new RegExp(value));
  assert.match(sql,/grant select on public\.marketing_ai_feedback_signals to authenticated/);
  assert.match(sql,/grant insert on public\.marketing_ai_feedback_signals to service_role/);
  assert.doesNotMatch(sql,/update\s+public\.marketing_ai_brand_brain/i);
  assert.doesNotMatch(sql,/grant\s+(?:select|insert|update|delete|all)[^;]*\bto\s+anon\b/i);
});

test("approval actions emit explicit feedback signals",()=>{
  const source=read("api/admin-marketing-autopilot-action.js");
  assert.match(source,/marketing_ai_feedback_signals/);
  for(const type of ["approved","edited","rejected","regenerated"])assert.match(source,new RegExp(`feedback\\(ctx,task,\\"${type}\\"`));
  assert.match(source,/before_output/);assert.match(source,/after_output/);
});

test("feedback summary exposes aggregate learning data only",()=>{
  const sql=read("supabase/release-5-ai-learning.sql");
  assert.match(sql,/marketing_ai_feedback_summary/);
  assert.match(sql,/by_content_type/);assert.match(sql,/recent_reasons/);
  assert.doesNotMatch(sql,/customer_name|email_address|phone_number|physical_address/i);
  assert.match(sql,/grant execute on function public\.marketing_ai_feedback_summary\(integer\) to service_role/);
});
