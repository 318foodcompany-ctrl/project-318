"use strict";
const crypto=require("node:crypto");
const { validateInput,generateMarketingContent }=require("../server/marketing-ai-provider.js");

function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function db(base,key,path,options={}){const response=await fetch(`${base}/rest/v1/${path}`,{...options,signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(options.headers||{})}});const text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok){const error=new Error(body?.message||`Database request failed (${response.status}).`);error.status=response.status;throw error;}return body;}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
const MAP={
  faq_draft:"blog_draft",
  seo_recommendation:"executive_summary",
  analytics_summary:"executive_summary",
  growth_recommendation:"executive_summary"
};
const INSTRUCTIONS={
  faq_draft:"Create concise, useful FAQ question-and-answer drafts grounded only in supplied business facts. Do not invent policies, pricing, guarantees, reviews, or services.",
  seo_recommendation:"Create prioritized SEO recommendations with proposed title/meta/internal-link/content changes. Do not claim rankings or search volume unless supplied.",
  analytics_summary:"Create an executive marketing-analysis draft. Separate observed facts from recommendations and do not invent metrics.",
  growth_recommendation:"Create practical growth recommendations prioritized by likely profitable catering impact, effort, risk, and evidence. Do not invent market data."
};
function buildInput(task,brand){
  const raw={...(task.generation_input||{})};
  const original=String(task.content_type||raw.content_type||"");
  raw.content_type=MAP[original]||original;
  raw.campaign_goal=raw.campaign_goal||"Increase qualified catering demand and profitable bookings";
  raw.target_audience=raw.target_audience||"Local catering customers and qualified prospects";
  raw.tone=raw.tone||"professional";
  raw.length=raw.length||"medium";
  raw.call_to_action=raw.call_to_action||"Request a Quote";
  const brandContext={mission:brand?.mission||"",business_facts:brand?.business_facts||{},voice_preferences:brand?.voice_preferences||{},growth_priorities:brand?.growth_priorities||[],prohibited_claims:brand?.prohibited_claims||[],seasonal_rules:brand?.seasonal_rules||{}};
  raw.important_details=[INSTRUCTIONS[original]||"",raw.important_details||"",`Business brain: ${JSON.stringify(brandContext)}`].filter(Boolean).join("\n\n").slice(0,3000);
  return {input:validateInput(raw),originalType:original};
}

async function handler(req,res){
  if(!["GET","POST"].includes(req.method)){res.setHeader("Allow","GET, POST");return reply(res,405,{error:"Method not allowed."});}
  const expected=String(process.env.AI_AUTOPILOT_CRON_SECRET||process.env.CRON_SECRET||process.env.FOLLOW_UP_CRON_SECRET||"");
  const provided=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
  if(expected.length<32||!safeEqual(expected,provided))return reply(res,401,{error:"Unauthorized."});
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  if(!base||!key)return reply(res,503,{error:"AI autopilot service is not configured."});
  try{
    const queuedNow=await db(base,key,"rpc/marketing_ai_queue_due_automation",{method:"POST",body:"{}"});
    const brandRows=await db(base,key,"marketing_ai_brand_brain?id=eq.1&select=mission,business_facts,voice_preferences,growth_priorities,prohibited_claims,seasonal_rules&limit=1");
    const brand=brandRows?.[0]||{};
    let generatedCount=0,failed=0,processed=0;
    for(let i=0;i<10;i++){
      const rows=await db(base,key,"rpc/marketing_ai_claim_due_task",{method:"POST",body:JSON.stringify({p_claim_minutes:15})});
      const task=rows?.[0];
      if(!task)break;
      processed++;
      try{
        await db(base,key,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"generating"})});
        const {input,originalType}=buildInput(task,brand);
        const generated=await generateMarketingContent(input);
        const createdBy=task.created_by||null;
        if(!createdBy)throw new Error("Autopilot task is missing an administrator owner.");
        const contentRows=await db(base,key,"marketing_ai_content",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({
          campaign_id:null,content_type:input.content_type,title:generated.output.title,
          generation_input:{...input,autopilot_type:originalType,autopilot_task_id:task.id},structured_output:generated.output,
          tags:["autopilot",`autopilot:${originalType}`],provider:generated.provider,model:generated.model,
          input_tokens:generated.usage.input_tokens||null,output_tokens:generated.usage.output_tokens||null,status:"draft",created_by:createdBy
        })});
        const content=contentRows?.[0];
        if(!content?.id)throw new Error("Generated draft was not persisted.");
        await db(base,key,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"ready_for_approval",ai_content_id:content.id,completed_at:new Date().toISOString(),claimed_at:null,claim_expires_at:null})});
        await db(base,key,"marketing_ai_approval_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({task_id:task.id,ai_content_id:content.id,action:"generated",actor_id:null,details:{source:"scheduler",content_type:originalType,provider:generated.provider,model:generated.model}})});
        if(task.automation_setting_id)await db(base,key,`marketing_ai_automation_settings?id=eq.${task.automation_setting_id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({last_success_at:new Date().toISOString()})});
        generatedCount++;
      }catch(error){
        failed++;
        const code=String(error.code||"AUTOPILOT_GENERATION_FAILED").slice(0,100);
        await db(base,key,`marketing_ai_tasks?id=eq.${task.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"failed",error_code:code,error_message:"Draft generation failed.",claimed_at:null,claim_expires_at:null})}).catch(()=>null);
        await db(base,key,"marketing_ai_approval_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({task_id:task.id,ai_content_id:null,action:"failed",actor_id:null,details:{source:"scheduler",code}})}).catch(()=>null);
      }
    }
    return reply(res,200,{ok:true,queued:Number(queuedNow||0),processed,generated:generatedCount,failed,publication_actions:0,send_actions:0});
  }catch(error){
    console.error("AI marketing autopilot runner failed.",{message:error.message,code:error.code||"AUTOPILOT_FAILED"});
    return reply(res,500,{error:"AI marketing autopilot processing failed."});
  }
}
module.exports=handler;module.exports.db=db;module.exports.buildInput=buildInput;
