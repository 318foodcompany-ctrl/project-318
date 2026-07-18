"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const performance = require("../js/public-performance.js");

const bootstrap = fs.readFileSync(path.join(__dirname,"..","script.js"),"utf8");

function image({critical=false,first=false}={}){
  const attributes=new Map();
  return {
    closest:selector=>critical&&selector.includes("hero")?{}:null,
    classList:{contains:()=>false},
    hasAttribute:name=>attributes.has(name),
    setAttribute:(name,value)=>attributes.set(name,value),
    getAttribute:name=>attributes.get(name),
    first
  };
}

test("critical images are eager and high priority",()=>{
  const item=image({critical:true});
  assert.equal(performance.isCriticalImage(item,4),true);
});

test("image optimizer prioritizes first image and lazy loads the rest",()=>{
  const images=[image(),image(),image()];
  const doc={querySelectorAll:()=>images};
  assert.equal(performance.optimizeImages(doc),3);
  assert.equal(images[0].getAttribute("loading"),"eager");
  assert.equal(images[0].getAttribute("fetchpriority"),"high");
  assert.equal(images[1].getAttribute("loading"),"lazy");
  assert.equal(images[1].getAttribute("fetchpriority"),"low");
  assert.equal(images[2].getAttribute("decoding"),"async");
});

test("resource hints are not duplicated",()=>{
  const links=[];
  const doc={
    querySelector:selector=>links.find(link=>selector.includes(link.rel)&&selector.includes(link.href))||null,
    createElement:()=>({}),
    head:{appendChild:link=>links.push(link)}
  };
  assert.equal(performance.addResourceHint(doc,"preconnect","https://cdn.jsdelivr.net",true),true);
  assert.equal(performance.addResourceHint(doc,"preconnect","https://cdn.jsdelivr.net",true),false);
  assert.equal(links.length,1);
  assert.equal(links[0].crossOrigin,"anonymous");
});

test("public bootstrap loads performance foundation",()=>{
  assert.match(bootstrap,/js\/public-performance\.js/);
  assert.match(bootstrap,/project318-performance-script/);
});
