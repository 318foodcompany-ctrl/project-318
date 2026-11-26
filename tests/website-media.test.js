"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const media=require("../js/website-media.js");
const route=require("../server/api/website-media.js");
const {render}=require("../js/landing-page-template.js");
const id="f3180000-0000-4000-9000-000000000021";
test("library search, file types, stable paths and landing attachments",async()=>{
  const items=[{title:"November menu",folder:"Seasonal offers",kind:"document"},{title:"Buffet",folder:"Photography",kind:"image"}];
  assert.equal(media.filter(items,"offERS menu","document").length,1);
  assert.equal(media.filter(items,"buffet","video").length,0);
  assert.equal(media.path(id),"/media/"+id);
  assert.equal(media.isPath("/media/"+id),true);
  assert.equal(media.isPath("/media/"+id+"/other"),false);
  assert.equal(await media.prepareFile(new Blob(["%PDF-1.4 sample"],{type:"application/pdf"})).then(b=>b.type),"application/pdf");
  await assert.rejects(media.prepareFile(new Blob(["Example text"],{type:"image/png"})),/format/);
  const base={title:"Menu",sections:[{heading:"Lunch",body:"",media:{id,label:"Catering menu",kind:"document"}}]};
  assert.match(render(base,"lunch"),new RegExp('href="/media/'+id+'"'));
  for(const [kind,tag] of [["image","img"],["video","video"]]) {
    base.sections[0].media.kind=kind;
    assert.match(render(base,"lunch"),new RegExp("<"+tag));
  }
  base.sections[0].hidden=true;
  assert.doesNotMatch(render(base,"lunch"),/class="section-media"/);
});
test("the public file handler uses only the published path and preserves the asset link",async t=>{
  const base="https://example.supabase.co";
  const before=[process.env.PUBLIC_SUPABASE_URL,process.env.PUBLIC_SUPABASE_ANON_KEY];
  process.env.PUBLIC_SUPABASE_URL=base;
  process.env.PUBLIC_SUPABASE_ANON_KEY="fixture-public-key";
  t.after(()=>{for(const [i,k] of ["PUBLIC_SUPABASE_URL","PUBLIC_SUPABASE_ANON_KEY"].entries()){
    if(before[i]===undefined) delete process.env[k];else process.env[k]=before[i];
  }});
  let file=null;
  const calls=[];
  t.mock.method(global,"fetch",async(url,opts)=>{
    calls.push({url,body:JSON.parse(opts.body)});
    if(url.endsWith("published_website_media")) return {ok:true,json:async()=>file};
    assert.equal(url,base+"/storage/v1/object/sign/website-media/"+file);
    return {ok:true,json:async()=>({signedURL:"/object/sign/website-media/"+file+"?token=fixture"})};
  });
  async function request(method="GET",key=id) {
    const res={headers:{},setHeader(name,value){this.headers[name]=value;},end(){}};
    await route({method,query:{id:key}},res);
    return res;
  }
  assert.equal((await request("POST")).statusCode,405);
  assert.equal((await request("GET","missing")).statusCode,404);
  assert.equal(calls.length,0);
  assert.equal((await request()).statusCode,404);
  for(const revision of [1,3,1]) {
    file=id+"/"+revision+".png";
    const response=await request("HEAD");
    assert.equal(response.statusCode,307);
    assert.equal(response.headers.Location,base+"/storage/v1/object/sign/website-media/"+file+"?token=fixture");
    assert.equal(response.headers["Cache-Control"],"no-store");
    assert.deepEqual(calls.at(-1).body,{expiresIn:300});
  }
});
