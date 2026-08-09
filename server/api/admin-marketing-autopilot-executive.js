"use strict";
const { adminContext }=require("./admin-marketing-autopilot-action.js");

function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok){const error=new Error("Database request failed.");error.status=response.status;throw error;}return body;}
async function service(ctx,path,options={}){return request(`${ctx.base}/rest/v1/${path}`,{...options,headers:{apikey:ctx.service,Authorization:`Bearer ${ctx.service}`,"Content-Type":"application/json",...(options.headers||{})}});}
function number(value){const n=Number(value);return Number.isFinite(n)?n:0;}
function buildExecutivePulse(snapshot={},tasks=[],settings=[],feedback={}){
  const statusCounts={};for(const task of tasks)statusCounts[task.status]=(statusCounts[task.status]||0)+1;
  const enabled=settings.filter(x=>x.enabled).length,totalSettings=settings.length;
  const byType=feedback.by_content_type||{};let approved=0,rejected=0,edited=0,regenerated=0;
  for(const stats of Object.values(byType)){approved+=number(stats.approved);rejected+=number(stats.rejected);edited+=number(stats.edited);regenerated+=number(stats.regenerated);}
  const decisions=approved+rejected,approvalRate=decisions?Math.round((approved/decisions)*100):null;
  const leads=number(snapshot?.leads?.total),bookings=number(snapshot?.bookings?.total),confirmed=number(snapshot?.bookings?.confirmed),paid=number(snapshot?.invoices?.paid_value),quoted=number(snapshot?.bookings?.quoted_value),outstanding=number(snapshot?.invoices?.outstanding_value);
  const blogCount=number(snapshot?.content_inventory?.published_blog_count),faqCount=number(snapshot?.content_inventory?.published_faq_count);
  const recommendations=[];
  if(number(statusCounts.ready_for_approval)>=10)recommendations.push({priority:"high",title:"Clear the approval backlog",reason:`${statusCounts.ready_for_approval} AI drafts are waiting for review.`,action:"Review the Approval Queue before generating more volume."});
  if(totalSettings&&enabled===0)recommendations.push({priority:"high",title:"Enable at least one automation",reason:"All AI automation preferences are currently paused.",action:"Start with one low-risk draft type such as blogs or FAQs."});
  if(blogCount<3)recommendations.push({priority:"medium",title:"Build the blog library",reason:`Only ${blogCount} published blog post${blogCount===1?" is":"s are"} in the content inventory.`,action:"Approve useful local catering articles that answer real planning questions."});
  if(faqCount<8)recommendations.push({priority:"medium",title:"Expand useful FAQs",reason:`Only ${faqCount} published FAQ item${faqCount===1?" is":"s are"} in the content inventory.`,action:"Add verified answers to common catering questions without inventing policies."});
  if(leads>0&&bookings===0)recommendations.push({priority:"high",title:"Investigate lead-to-booking conversion",reason:`${leads} lead${leads===1?" was":"s were"} recorded in the period but no bookings were created.`,action:"Review follow-up timing, proposal friction, and lead quality."});
  if(outstanding>0)recommendations.push({priority:"medium",title:"Review outstanding invoices",reason:`$${outstanding.toFixed(2)} is recorded as outstanding in the period.`,action:"Confirm invoice follow-up and payment status before treating it as collected revenue."});
  return {
    period_days:number(snapshot?.period_days)||30,
    generated_at:snapshot?.generated_at||new Date().toISOString(),
    business:{leads,bookings,confirmed,quoted_value:quoted,paid_value:paid,outstanding_value:outstanding},
    ai:{waiting_for_approval:number(statusCounts.ready_for_approval),approved_tasks:number(statusCounts.approved),failed_tasks:number(statusCounts.failed),enabled_automations:enabled,total_automations:totalSettings,approval_rate_percent:approvalRate,feedback:{approved,rejected,edited,regenerated}},
    content:{published_blogs:blogCount,published_faqs:faqCount},
    recommendations:recommendations.slice(0,6)
  };
}
async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return reply(res,405,{error:"Method not allowed."});}
  try{
    const ctx=await adminContext(req),days=Math.max(7,Math.min(90,Number(req.query?.days||30)));
    const [snapshot,tasks,settings,feedback]=await Promise.all([
      service(ctx,"rpc/marketing_ai_business_snapshot",{method:"POST",body:JSON.stringify({p_days:days})}),
      service(ctx,"marketing_ai_tasks?select=status,content_type&created_at=gte."+encodeURIComponent(new Date(Date.now()-days*86400000).toISOString())),
      service(ctx,"marketing_ai_automation_settings?select=enabled,automation_type"),
      service(ctx,"rpc/marketing_ai_feedback_summary",{method:"POST",body:JSON.stringify({p_days:Math.max(days,30)})}).catch(()=>({period_days:days,by_content_type:{},recent_reasons:[]}))
    ]);
    return reply(res,200,{ok:true,pulse:buildExecutivePulse(snapshot,tasks||[],settings||[],feedback||{})});
  }catch(error){
    console.error("AI executive pulse failed.",{message:error.message});
    const status=[401,403].includes(error.status)?error.status:500;
    return reply(res,status,{error:status<500?error.message:"AI executive pulse could not be loaded."});
  }
}
module.exports=handler;module.exports.buildExecutivePulse=buildExecutivePulse;
