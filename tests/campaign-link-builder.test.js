"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const builder=require("../js/admin-campaign-links.js");

test("cleanToken normalizes campaign labels",()=>{
  assert.equal(builder.cleanToken(" Office Catering July "),"office_catering_july");
  assert.equal(builder.cleanToken("Video #1 / A"),"video_1_a");
});

test("buildCampaignUrl creates encoded UTM links",()=>{
  const result=builder.buildCampaignUrl({
    destination:"/quote.html?existing=yes",
    source:"Facebook",
    medium:"Paid Social",
    campaign:"Office Catering July",
    content:"Video 1"
  },"https://www.318foodco.com");
  const url=new URL(result);
  assert.equal(url.origin,"https://www.318foodco.com");
  assert.equal(url.pathname,"/quote.html");
  assert.equal(url.searchParams.get("existing"),"yes");
  assert.equal(url.searchParams.get("utm_source"),"facebook");
  assert.equal(url.searchParams.get("utm_medium"),"paid_social");
  assert.equal(url.searchParams.get("utm_campaign"),"office_catering_july");
  assert.equal(url.searchParams.get("utm_content"),"video_1");
});

test("buildCampaignUrl requires core attribution fields",()=>{
  assert.throws(()=>builder.buildCampaignUrl({destination:"/quote.html",source:"facebook",medium:"social",campaign:""}),/required/);
});

test("validDestination rejects unsafe protocols",()=>{
  assert.equal(builder.validDestination("javascript:alert(1)"),null);
  assert.equal(builder.validDestination("data:text/html,test"),null);
});

test("campaign builder defaults to the live quote route",()=>{
  const source=fs.readFileSync(path.join(__dirname,"../js/admin-campaign-links.js"),"utf8");
  assert.match(source,/value="\/quote-builder\.html"/);
  assert.doesNotMatch(source,/value="\/quote\.html"/);
});
