"use strict";
const { adminContext }=require("./admin-marketing-autopilot-action.js");

function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok){const error=new Error("Database request failed.");error.status=response.status;throw error;}return body;}
async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return reply(res,405,{error:"Method not allowed."});}
  try{
    const ctx=await adminContext(req);
    const days=Math.max(7,Math.min(365,Number(req.query?.days||90)));
    const summary=await request(`${ctx.base}/rest/v1/rpc/marketing_ai_feedback_summary`,{method:"POST",headers:{apikey:ctx.service,Authorization:`Bearer ${ctx.service}`,"Content-Type":"application/json"},body:JSON.stringify({p_days:days})});
    return reply(res,200,{ok:true,summary:summary||{period_days:days,by_content_type:{},recent_reasons:[]}});
  }catch(error){
    console.error("AI learning summary failed.",{message:error.message});
    const status=[401,403].includes(error.status)?error.status:500;
    return reply(res,status,{error:status<500?error.message:"AI learning summary could not be loaded."});
  }
}
module.exports=handler;
