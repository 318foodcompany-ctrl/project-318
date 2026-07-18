"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const draft=require("../js/quote-draft.js");

function storage(initial={}){
  const values=new Map(Object.entries(initial));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    has:key=>values.has(key)
  };
}

test("quote drafts expire after seven days",()=>{
  const now=1_000_000_000;
  const expired=storage({[draft.STORAGE_KEY]:JSON.stringify({savedAt:now-draft.MAX_AGE_MS-1,values:{eventType:"Wedding"}})});
  assert.equal(draft.readDraft(expired,now),null);
  assert.equal(expired.has(draft.STORAGE_KEY),false);
});

test("current quote drafts are restored",()=>{
  const now=1_000_000_000;
  const value={savedAt:now-1000,values:{eventType:"Corporate Lunch",guestCount:"50",addons:["Drinks"]}};
  const active=storage({[draft.STORAGE_KEY]:JSON.stringify(value)});
  assert.deepEqual(draft.readDraft(active,now),value);
});

test("only non-sensitive planning fields are eligible for draft storage",()=>{
  assert.deepEqual(draft.SAFE_FIELDS,["eventType","guestCount","menu","eventDate","eventTime"]);
  ["name","email","phone","company","eventAddress","notes","marketingOptIn"].forEach(field=>assert.equal(draft.SAFE_FIELDS.includes(field),false));
});

test("event planner loads recovery assets",()=>{
  const html=fs.readFileSync(path.join(__dirname,"..","quote-builder.html"),"utf8");
  assert.match(html,/css\/quote-draft\.css/);
  assert.match(html,/js\/quote-draft\.js/);
});
