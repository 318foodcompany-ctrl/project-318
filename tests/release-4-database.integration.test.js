"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");

const url=String(process.env.CRM_TEST_SUPABASE_URL||"").replace(/\/$/,"");
const anon=process.env.CRM_TEST_ANON_KEY||"";
const admin=process.env.CRM_TEST_ADMIN_TOKEN||"";
const configured=Boolean(url&&anon&&admin);
const skip="Set CRM_TEST_SUPABASE_URL, CRM_TEST_ANON_KEY, and CRM_TEST_ADMIN_TOKEN for an isolated staging project";

async function request(path,key,options={}){
  const response=await fetch(`${url}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:anon,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(options.headers||{})}
  });
  const text=await response.text();
  let body;try{body=text?JSON.parse(text):null;}catch(_error){body=text;}
  return {response,body};
}

test("Release 4 anonymous management-table access returns no records",configured?{}:{skip},async()=>{
  for(const table of ["marketing_campaigns","marketing_ai_content","marketing_email_templates","marketing_email_sequences","marketing_email_enrollments","marketing_suppressions","marketing_email_events"]){
    const result=await request(`${table}?select=*&limit=1`,anon);
    assert.equal(result.response.status,200,`${table} should be queryable through RLS`);
    assert.deepEqual(result.body,[],`${table} must not expose rows anonymously`);
  }
});

test("Release 4 administrator campaign lifecycle persists safely",configured?{}:{skip},async()=>{
  const marker=`Release 4 integration ${Date.now()}`;
  const created=await request("marketing_campaigns",admin,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({name:marker,status:"draft",goal:"Integration validation"})});
  assert.equal(created.response.status,201);
  const id=created.body?.[0]?.id;assert.match(String(id),/^[0-9a-f-]{36}$/i);
  try{
    for(const status of ["running","paused","archived"]){
      const updated=await request(`marketing_campaigns?id=eq.${id}`,admin,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status})});
      assert.equal(updated.response.status,200);assert.equal(updated.body?.[0]?.status,status);
    }
  }finally{
    const removed=await request(`marketing_campaigns?id=eq.${id}`,admin,{method:"DELETE",headers:{Prefer:"return=minimal"}});
    assert.equal(removed.response.status,204);
  }
});

test("Release 4 reporting RPC rejects anonymous users",configured?{}:{skip},async()=>{
  const result=await request("rpc/marketing_campaign_report",anon,{method:"POST",body:JSON.stringify({p_start:"2020-01-01",p_end:"2020-01-02"})});
  assert.ok([401,403,404].includes(result.response.status),`unexpected status ${result.response.status}`);
});
