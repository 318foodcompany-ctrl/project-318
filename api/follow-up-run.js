"use strict";
const { sendTransactionalEmail }=require("../server/transactional-email.js");
const { renderBlocks,plainText }=require("../server/marketing-email.js");
const crypto=require("node:crypto");
function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function db(base,key,path,options={}){const response=await fetch(`${base}/rest/v1/${path}`,{...options,signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(options.headers||{})}});const text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok)throw new Error(body?.message||`Database request failed (${response.status}).`);return body;}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  const secret=String(process.env.FOLLOW_UP_CRON_SECRET||""),provided=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
  const authorized=secret.length>=32&&provided.length===secret.length&&crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(secret));
  if(!authorized)return reply(res,401,{error:"Unauthorized."});
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  if(!base||!key)return reply(res,503,{error:"Follow-up service is not configured."});
  try{
    await db(base,key,"rpc/sales_schedule_due_followups",{method:"POST",body:"{}"});
    await db(base,key,"rpc/marketing_schedule_time_enrollments",{method:"POST",body:"{}"});
    const queued=await db(base,key,"rpc/sales_claim_due_followups",{method:"POST",body:JSON.stringify({p_limit:25})});
    let sent=0,failed=0;
    for(const message of queued){
      try{
        if(message.classification==="marketing"){
          await db(base,key,"marketing_email_events",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({message_id:message.id,campaign_id:message.campaign_id||null,provider:"internal",provider_event_id:`claim:${message.id}:${Number(message.retry_count||0)}`,provider_message_id:"",event_type:"claimed",occurred_at:new Date().toISOString(),metadata:{retry_count:Number(message.retry_count||0)}})});
          const allowed=await db(base,key,"rpc/marketing_validate_claim",{method:"POST",body:JSON.stringify({p_message_id:message.id})});
          if(allowed!==true)continue;
        }
        let text=message.body,html=message.html_body||`<p>${String(message.body).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll("\n","<br>")}</p>`,listUnsubscribe="";
        if(message.classification==="marketing"){
          if(message.template_id){
            const [templates,customers,bookings,settings]=await Promise.all([
              db(base,key,`marketing_email_templates?id=eq.${message.template_id}&select=subject_template,blocks,plain_text_template,status&limit=1`),
              db(base,key,`customers?id=eq.${message.customer_id}&select=first_name,last_name,company&limit=1`),
              message.booking_id?db(base,key,`bookings?id=eq.${message.booking_id}&select=event_date,event_type&limit=1`):Promise.resolve([]),
              db(base,key,"website_settings?select=setting_key,setting_value")
            ]);
            const template=templates?.[0],customer=customers?.[0]||{},booking=bookings?.[0]||{};
            const business=Object.fromEntries((settings||[]).map(item=>[item.setting_key,item.setting_value]));
            if(!template||template.status!=="active")throw new Error("Marketing template is unavailable.");
            const values={customer_name:[customer.first_name,customer.last_name].filter(Boolean).join(" "),first_name:customer.first_name||"",company_name:customer.company||"",event_date:booking.event_date||"",event_type:booking.event_type||"",proposal_link:"",portal_link:"",quote_total:"",business_phone:business.phone||"",business_email:business.email||"",unsubscribe_link:"{{unsubscribe_link}}"};
            message.subject=plainText([{type:"text",text:template.subject_template}],values);
            text=plainText(template.blocks,values)||plainText([{type:"text",text:template.plain_text_template}],values);
            html=renderBlocks(template.blocks,values);
          }
          const rawToken=await db(base,key,"rpc/marketing_create_unsubscribe_token",{method:"POST",body:JSON.stringify({p_customer_id:message.customer_id,p_days:365})});
          const publicSite=String(process.env.PUBLIC_SITE_URL||"").replace(/\/$/,"");
          if(!/^https:\/\//i.test(publicSite)||!/^[a-f0-9]{64}$/i.test(String(rawToken)))throw new Error("Marketing unsubscribe configuration is invalid.");
          const campaignQuery=message.campaign_id?`&campaign=${encodeURIComponent(message.campaign_id)}`:"";
          const link=`${publicSite}/unsubscribe.html?token=${encodeURIComponent(rawToken)}${campaignQuery}`;
          listUnsubscribe=`${publicSite}/api/unsubscribe?token=${encodeURIComponent(rawToken)}`;
          text=String(text).replaceAll("{{unsubscribe_link}}",link)+`\n\nUnsubscribe: ${link}`;
          html=String(html).replaceAll("{{unsubscribe_link}}",link)+`<p><a href="${link}">Unsubscribe from marketing email</a></p>`;
        }
        const marketingEnvironment=message.classification==="marketing"?{...process.env,TRANSACTIONAL_EMAIL_FROM:process.env.MARKETING_EMAIL_FROM||process.env.TRANSACTIONAL_EMAIL_FROM}:process.env;
        const delivery=await sendTransactionalEmail({to:message.recipient,subject:message.subject,text,html,messageKey:message.idempotency_key,replyTo:message.classification==="marketing"?process.env.MARKETING_EMAIL_REPLY_TO:"",listUnsubscribe},{environment:marketingEnvironment});
        const status=delivery.status==="accepted"?"sent":"failed";
        const retryCount=Number(message.retry_count||0)+1;
        const retry=status==="failed"&&retryCount<=Number(message.max_retries??3);
        await db(base,key,`follow_up_messages?id=eq.${message.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:retry?"queued":status,sent_at:status==="sent"?new Date().toISOString():null,provider_message_id:delivery.reference||"",error_message:delivery.failureCode||"",processing_started_at:null,retry_count:retryCount,last_attempt_at:new Date().toISOString(),scheduled_for:retry?new Date(Date.now()+Math.min(60,5*2**(retryCount-1))*60000).toISOString():message.scheduled_for})});
        if(message.classification==="marketing")await db(base,key,"marketing_email_events",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({message_id:message.id,campaign_id:message.campaign_id||null,provider:delivery.provider||"unknown",provider_event_id:`send:${message.id}:${retryCount}`,provider_message_id:delivery.reference||"",event_type:status,occurred_at:new Date().toISOString(),metadata:{retry_count:retryCount}})});
        if(message.enrollment_id&&!retry){
          const remaining=await db(base,key,`follow_up_messages?enrollment_id=eq.${message.enrollment_id}&status=in.(queued,processing)&select=id&limit=1`);
          if(!remaining.length)await db(base,key,`marketing_email_enrollments?id=eq.${message.enrollment_id}&status=eq.active`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"completed",completed_at:new Date().toISOString()})});
        }
        if(status==="sent")sent++;else failed++;
      }catch(error){
        failed++;
        const retryCount=Number(message.retry_count||0)+1,retry=retryCount<=Number(message.max_retries??3);
        await db(base,key,`follow_up_messages?id=eq.${message.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:retry?"queued":"failed",error_message:"DELIVERY_EXCEPTION",processing_started_at:null,retry_count:retryCount,last_attempt_at:new Date().toISOString(),scheduled_for:retry?new Date(Date.now()+Math.min(60,5*2**(retryCount-1))*60000).toISOString():message.scheduled_for})});
        if(message.enrollment_id&&!retry){
          const remaining=await db(base,key,`follow_up_messages?enrollment_id=eq.${message.enrollment_id}&status=in.(queued,processing)&select=id&limit=1`);
          if(!remaining.length)await db(base,key,`marketing_email_enrollments?id=eq.${message.enrollment_id}&status=eq.active`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"completed",completed_at:new Date().toISOString()})});
        }
      }
    }
    reply(res,200,{ok:true,processed:queued.length,sent,failed});
  }catch(error){console.error("Follow-up runner failed.",{message:error.message});reply(res,500,{error:"Follow-up processing failed."});}
}
module.exports=handler;module.exports.db=db;
