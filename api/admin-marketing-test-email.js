"use strict";
const { emailConfiguration,sendTransactionalEmail }=require("../server/transactional-email.js");
const { renderBlocks,plainText,replaceVariables }=require("../server/marketing-email.js");
function json(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_error){body=text;}if(!response.ok)throw new Error("Authorization check failed.");return body;}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Method not allowed."});}
  const configuration=emailConfiguration();
  if(configuration.mode!=="test")return json(res,409,{error:"Test email is available only when the email provider is explicitly in non-production test mode."});
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),anon=String(process.env.PUBLIC_SUPABASE_ANON_KEY||""),token=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
  try{
    const user=await request(`${base}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
    const admin=await request(`${base}/rest/v1/rpc/crm_is_admin`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:"{}"});
    if(!user?.email||admin!==true)return json(res,403,{error:"Administrator access required."});
    const blocks=Array.isArray(req.body?.blocks)?req.body.blocks:[],sample=req.body?.sample||{};
    const delivery=await sendTransactionalEmail({to:user.email,subject:replaceVariables(req.body?.subject,sample),html:renderBlocks(blocks,sample),text:plainText(blocks,sample),messageKey:`marketing-test-${Date.now()}`},{configuration});
    return json(res,200,{ok:delivery.status==="accepted",status:delivery.status,reference:delivery.reference});
  }catch(error){console.error("Marketing test email failed.",{message:error.message});return json(res,403,{error:"Test email could not be rendered."});}
}
module.exports=handler;
