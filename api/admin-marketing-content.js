"use strict";
const { validateInput,generateMarketingContent }=require("../server/marketing-ai-provider.js");
function json(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_error){body=text;}if(!response.ok){const error=new Error("Database request failed.");error.status=response.status;throw error;}return body;}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Method not allowed."});}
  if(Number(req.headers["content-length"]||0)>24576)return json(res,413,{error:"Request is too large."});
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),anon=String(process.env.PUBLIC_SUPABASE_ANON_KEY||"");
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
  if(!base||!anon||!token)return json(res,401,{error:"Authentication required."});
  try{
    const user=await request(`${base}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
    const admin=await request(`${base}/rest/v1/rpc/crm_is_admin`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:"{}"});
    if(!user?.id||admin!==true)return json(res,403,{error:"Administrator access required."});
    const raw=typeof req.body==="string"?JSON.parse(req.body):req.body,input=validateInput(raw);
    const campaignId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(raw?.campaign_id||""))?raw.campaign_id:null;
    const tags=String(raw?.tags||"").split(",").map(value=>value.trim().slice(0,80)).filter(Boolean).slice(0,20);
    const generated=await generateMarketingContent(input);
    const rows=await request(`${base}/rest/v1/marketing_ai_content`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({
      campaign_id:campaignId,content_type:input.content_type,title:generated.output.title,generation_input:input,structured_output:generated.output,tags,
      provider:generated.provider,model:generated.model,input_tokens:generated.usage.input_tokens||null,output_tokens:generated.usage.output_tokens||null,status:"draft"
    })});
    if(!rows?.[0]?.id)throw new Error("Draft was not saved.");
    return json(res,200,{id:rows[0].id,status:"draft",output:generated.output,usage:generated.usage});
  }catch(error){
    console.error("Marketing content generation failed.",{code:error.code||"GENERATION_FAILED"});
    const status=error.status===401?401:error.status===403?403:error.code==="AI_NOT_CONFIGURED"?503:error.message?.includes("Unsupported")||error.message?.includes("required")?400:502;
    return json(res,status,{error:status===400?error.message:"Marketing content could not be generated.",code:error.code||"GENERATION_FAILED"});
  }
}
module.exports=handler;
