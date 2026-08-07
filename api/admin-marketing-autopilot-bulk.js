"use strict";
const { adminContext }=require("./admin-marketing-autopilot-action.js");

function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok){const error=new Error("Database request failed.");error.status=response.status;throw error;}return body;}
async function db(ctx,path,options={}){return request(`${ctx.base}/rest/v1/${path}`,{...options,headers:{apikey:ctx.service,Authorization:`Bearer ${ctx.service}`,"Content-Type":"application/json",...(options.headers||{})}});}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  try{
    const ctx=await adminContext(req),raw=typeof req.body==="string"?JSON.parse(req.body):req.body||{},action=String(raw.action||"");
    if(action!=="approve_all_ready")return reply(res,400,{error:"Unsupported bulk action."});
    const tasks=await db(ctx,"marketing_ai_tasks?status=eq.ready_for_approval&select=id,ai_content_id,content_type&order=created_at.asc&limit=100");
    let approved=0,skipped=0;
    for(const task of tasks||[]){
      if(!task.ai_content_id){skipped++;continue;}
      await db(ctx,`marketing_ai_content?id=eq.${task.ai_content_id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"approved"})});
      await db(ctx,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"approved",completed_at:new Date().toISOString()})});
      await db(ctx,"marketing_ai_approval_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({task_id:task.id,ai_content_id:task.ai_content_id,action:"approved",actor_id:ctx.user.id,details:{source:"bulk_approval",publication_actions:0,send_actions:0}})});
      await db(ctx,"marketing_ai_feedback_signals",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({task_id:task.id,ai_content_id:task.ai_content_id,content_type:task.content_type,signal_type:"approved",before_output:{},after_output:{},reason:"Bulk approved by administrator",actor_id:ctx.user.id})}).catch(()=>null);
      approved++;
    }
    return reply(res,200,{ok:true,approved,skipped,published:0,sent:0});
  }catch(error){
    console.error("AI autopilot bulk action failed.",{message:error.message});
    const status=[401,403].includes(error.status)?error.status:500;
    return reply(res,status,{error:status<500?error.message:"Bulk approval failed."});
  }
}
module.exports=handler;
