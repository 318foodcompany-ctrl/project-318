"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("bulk approval is administrator-only and approval-only",()=>{
  const api=read("server/api/admin-marketing-autopilot-bulk.js");
  assert.match(api,/adminContext/);
  assert.match(api,/approve_all_ready/);
  assert.match(api,/status:\"approved\"/);
  assert.match(api,/publication_actions:0,send_actions:0/);
  assert.match(api,/published:0,sent:0/);
  assert.doesNotMatch(api,/sendTransactionalEmail|publish_post|facebook\.com|instagram\.com|googleapis\.com|ad_spend/i);
});

test("bulk approval UI requires an explicit browser confirmation",()=>{
  const html=read("ai-autopilot.html"),ui=read("js/admin-ai-bulk.js");
  assert.match(html,/id=\"approveAllWaiting\"/);
  assert.match(ui,/window\.confirm/);
  assert.match(ui,/will not publish or send anything/i);
  assert.match(ui,/Nothing was published or sent/i);
});
