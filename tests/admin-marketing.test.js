"use strict";

const assert=require("node:assert/strict");
const test=require("node:test");
const marketing=require("../js/admin-marketing.js");

test("formats revenue as US currency",()=>{
  assert.equal(marketing.currency(1234.5),"$1,234.50");
});

test("summarizes attributed revenue and source counts",()=>{
  const summary=marketing.summarize([
    {source:"facebook",revenue:"750.25",payment_count:2},
    {source:"google",revenue:1200,payment_count:3},
    {source:"facebook",revenue:100,payment_count:1}
  ]);
  assert.equal(summary.revenue,2050.25);
  assert.equal(summary.payments,6);
  assert.equal(summary.sources.size,2);
  assert.equal(summary.topSource,"google");
});

test("escapes dashboard text before rendering",()=>{
  assert.equal(marketing.escapeHtml('<script>"x"</script>'),"&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});

test("creates local date input values without UTC shifting",()=>{
  assert.equal(marketing.dateInputValue(new Date(2026,6,18,23,30)),"2026-07-18");
});