"use strict";
const { adminContext }=require("./admin-marketing-autopilot-action.js");

const TYPES=new Set(["blog_draft","faq_draft","seo_recommendation","facebook_post","instagram_caption","linkedin_post","google_business_post","email_newsletter","promotional_email","landing_page","seasonal_campaign","holiday_campaign","analytics_summary","growth_recommendation"]);
function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok){const reason=body&&typeof body==="object"&&typeof body.message==="string"?body.message:"Database request failed.";console.error("AI queue database request rejected.",{status:response.status,reason});const error=new Error(reason);error.status=response.status;throw error;}return body;}
function bounded(value,max){return String(value==null?"":value).trim().slice(0,max);}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  if(Number(req.headers["content-length"]||0)>32768)return reply(res,413,{error:"Request is too large."});
  try{
    const ctx=await adminContext(req),raw=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
    const type=bounded(raw.content_type,100),count=Math.max(1,Math.min(5,Number(raw.count||1)));
    if(!TYPES.has(type))return reply(res,400,{error:"Unsupported AI draft type."});
    const rows=await request(`${ctx.base}/rest/v1/marketing_ai_automation_settings?automation_type=eq.${encodeURIComponent(type)}&select=id,tone,target_audience,campaign_goal,custom_instructions&limit=1`,{headers:{apikey:ctx.service,Authorization:`Bearer ${ctx.service}`}}),setting=rows?.[0]||null;
    const input={content_type:type,campaign_goal:bounded(setting?.campaign_goal||"Increase qualified catering demand and profitable bookings",500),target_audience:bounded(setting?.target_audience||"Local catering customers and qualified prospects",500),tone:bounded(setting?.tone||"professional",40),important_details:bounded(setting?.custom_instructions||"",4000),autopilot:true,manual_queue:true};
    const tasks=[];
    for(let i=1;i<=count;i++)tasks.push({automation_setting_id:setting?.id||null,content_type:type,status:"queued",scheduled_for:new Date().toISOString(),generation_input:{...input,sequence_number:i},priority:80,created_by:ctx.user.id});
    const created=await request(`${ctx.base}/rest/v1/marketing_ai_tasks`,{method:"POST",headers:{apikey:ctx.service,Authorization:`Bearer ${ctx.service}`,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(tasks)});
    for(const task of created||[])await request(`${ctx.base}/rest/v1/marketing_ai_approval_audit`,{method:"POST",headers:{apikey:ctx.service,Authorization:`Bearer ${ctx.service}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({task_id:task.id,ai_content_id:null,action:"scheduled",actor_id:ctx.user.id,details:{source:"manual_queue",content_type:type,publication_actions:0,send_actions:0}})});
    return reply(res,200,{ok:true,queued:Array.isArray(created)?created.length:count,content_type:type,published:false,sent:false,note:"Queued for the next Autopilot scheduler run."});
  }catch(error){console.error("AI manual queue failed.",{message:error.message});const status=[400,401,403].includes(error.status)?error.status:500;return reply(res,status,{error:status<500?error.message:"AI draft could not be queued."});}
}
module.exports=handler;module.exports.TYPES=TYPES;
