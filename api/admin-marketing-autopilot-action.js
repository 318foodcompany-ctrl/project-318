"use strict";
const { validateOutput }=require("../server/marketing-ai-provider.js");

function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok){const error=new Error("Database request failed.");error.status=response.status;throw error;}return body;}
async function adminContext(req){
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),anon=String(process.env.PUBLIC_SUPABASE_ANON_KEY||""),service=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
  if(!base||!anon||!service||!token)throw Object.assign(new Error("Authentication required."),{status:401});
  const user=await request(`${base}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
  const admin=await request(`${base}/rest/v1/rpc/crm_is_admin`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:"{}"});
  if(!user?.id||admin!==true)throw Object.assign(new Error("Administrator access required."),{status:403});
  return {base,service,user};
}
async function db(base,key,path,options={}){return request(`${base}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(options.headers||{})}});}
function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""))?String(value):"";}
async function audit(ctx,task,action,details={}){await db(ctx.base,ctx.service,"marketing_ai_approval_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({task_id:task.id,ai_content_id:task.ai_content_id||null,action,actor_id:ctx.user.id,details})});}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  if(Number(req.headers["content-length"]||0)>65536)return reply(res,413,{error:"Request is too large."});
  try{
    const ctx=await adminContext(req),raw=typeof req.body==="string"?JSON.parse(req.body):req.body||{},taskId=uuid(raw.task_id),action=String(raw.action||"");
    if(!taskId||!["approve","reject","regenerate","archive","edit"].includes(action))return reply(res,400,{error:"Invalid autopilot action."});
    const tasks=await db(ctx.base,ctx.service,`marketing_ai_tasks?id=eq.${taskId}&select=*&limit=1`),task=tasks?.[0];
    if(!task)return reply(res,404,{error:"AI task was not found."});
    const contentId=uuid(task.ai_content_id);

    if(action==="edit"){
      if(!contentId||task.status!=="ready_for_approval")return reply(res,409,{error:"Only approval-ready drafts can be edited."});
      const output=validateOutput(raw.structured_output);
      await db(ctx.base,ctx.service,`marketing_ai_content?id=eq.${contentId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({structured_output:output,title:output.title,status:"draft"})});
      await audit(ctx,task,"edited",{source:"approval_queue"});
      return reply(res,200,{ok:true,status:"ready_for_approval"});
    }

    if(action==="approve"){
      if(!contentId||task.status!=="ready_for_approval")return reply(res,409,{error:"Only approval-ready drafts can be approved."});
      await db(ctx.base,ctx.service,`marketing_ai_content?id=eq.${contentId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"approved"})});
      await db(ctx.base,ctx.service,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"approved",completed_at:new Date().toISOString()})});
      await audit(ctx,task,"approved",{source:"approval_queue",publication_actions:0,send_actions:0});
      return reply(res,200,{ok:true,status:"approved",published:false,sent:false});
    }

    if(action==="reject"){
      if(contentId)await db(ctx.base,ctx.service,`marketing_ai_content?id=eq.${contentId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"archived",archived_at:new Date().toISOString()})});
      await db(ctx.base,ctx.service,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"rejected",completed_at:new Date().toISOString()})});
      await audit(ctx,task,"rejected",{reason:String(raw.reason||"").slice(0,1000)});
      return reply(res,200,{ok:true,status:"rejected"});
    }

    if(action==="archive"){
      if(contentId)await db(ctx.base,ctx.service,`marketing_ai_content?id=eq.${contentId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"archived",archived_at:new Date().toISOString()})});
      await db(ctx.base,ctx.service,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"archived",completed_at:new Date().toISOString()})});
      await audit(ctx,task,"archived",{});
      return reply(res,200,{ok:true,status:"archived"});
    }

    if(action==="regenerate"){
      if(contentId)await db(ctx.base,ctx.service,`marketing_ai_content?id=eq.${contentId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"archived",archived_at:new Date().toISOString()})});
      await db(ctx.base,ctx.service,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"queued",ai_content_id:null,scheduled_for:new Date().toISOString(),claimed_at:null,claim_expires_at:null,completed_at:null,error_code:"",error_message:""})});
      await audit(ctx,{...task,ai_content_id:contentId||null},"regenerated",{source:"approval_queue"});
      return reply(res,200,{ok:true,status:"queued"});
    }
  }catch(error){
    console.error("AI autopilot admin action failed.",{message:error.message});
    return reply(res,error.status===401?401:error.status===403?403:error.status===404?404:500,{error:error.status===401||error.status===403?error.message:"AI autopilot action failed."});
  }
}
module.exports=handler;module.exports.adminContext=adminContext;module.exports.uuid=uuid;