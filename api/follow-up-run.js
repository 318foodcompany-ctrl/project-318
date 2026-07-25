"use strict";
const { sendTransactionalEmail }=require("../server/transactional-email.js");
function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function db(base,key,path,options={}){const response=await fetch(`${base}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(options.headers||{})}});const text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok)throw new Error(body?.message||`Database request failed (${response.status}).`);return body;}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  const secret=String(process.env.FOLLOW_UP_CRON_SECRET||""),provided=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
  if(secret.length<32||provided!==secret)return reply(res,401,{error:"Unauthorized."});
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  if(!base||!key)return reply(res,503,{error:"Follow-up service is not configured."});
  try{
    await db(base,key,"rpc/sales_schedule_due_followups",{method:"POST",body:"{}"});
    const queued=await db(base,key,"follow_up_messages?status=eq.queued&scheduled_for=lte.now()&order=scheduled_for.asc&limit=25&select=*");
    let sent=0,failed=0;
    for(const message of queued){
      const delivery=await sendTransactionalEmail({to:message.recipient,subject:message.subject,text:message.body,html:`<p>${String(message.body).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll("\n","<br>")}</p>`,messageKey:message.idempotency_key});
      const status=delivery.status==="accepted"?"sent":"failed";
      await db(base,key,`follow_up_messages?id=eq.${message.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status,sent_at:status==="sent"?new Date().toISOString():null,provider_message_id:delivery.reference||"",error_message:delivery.failureCode||""})});
      if(status==="sent")sent++;else failed++;
    }
    reply(res,200,{ok:true,processed:queued.length,sent,failed});
  }catch(error){console.error("Follow-up runner failed.",{message:error.message});reply(res,500,{error:"Follow-up processing failed."});}
}
module.exports=handler;module.exports.db=db;
