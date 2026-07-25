"use strict";
const crypto=require("node:crypto");
function json(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
function signatures(value){return String(value||"").split(" ").map(part=>part.replace(/^v\d+,/,"")).filter(Boolean);}
function verifySignature(raw,headers,secret,now=Date.now()){
  const id=String(headers["svix-id"]||""),timestamp=String(headers["svix-timestamp"]||""),provided=signatures(headers["svix-signature"]);
  if(!id||!/^\d+$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000||!secret.startsWith("whsec_"))return false;
  let key;try{key=Buffer.from(secret.slice(6),"base64");}catch(_error){return false;}
  const expected=crypto.createHmac("sha256",key).update(`${id}.${timestamp}.${raw}`).digest("base64");
  return provided.some(value=>value.length===expected.length&&crypto.timingSafeEqual(Buffer.from(value),Buffer.from(expected)));
}
function eventType(value){const map={"email.sent":"sent","email.delivered":"delivered","email.opened":"opened","email.clicked":"clicked","email.delivery_delayed":"deferred","email.bounced":"bounced","email.complained":"complained","email.failed":"failed"};return map[value]||"";}
async function rawBody(req){if(typeof req.body==="string")return req.body;const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>262144)throw new Error("Webhook payload is too large.");chunks.push(chunk);}return Buffer.concat(chunks).toString("utf8");}
async function request(url,options){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();if(!response.ok)throw new Error(`Webhook database request failed (${response.status}).`);try{return text?JSON.parse(text):null;}catch(_error){return text;}}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Method not allowed."});}
  let raw;try{raw=await rawBody(req);}catch(error){return json(res,413,{error:error.message});}
  const secret=String(process.env.EMAIL_WEBHOOK_SECRET||"");
  if(!verifySignature(raw,req.headers,secret))return json(res,401,{error:"Invalid webhook signature."});
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),service=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  if(!base||!service)return json(res,503,{error:"Webhook storage is unavailable."});
  try{
    const payload=JSON.parse(raw),type=eventType(payload.type),providerId=String(payload.data?.email_id||payload.data?.id||"").slice(0,500);
    if(!type||!providerId)return json(res,202,{ok:true,ignored:true});
    const messages=await request(`${base}/rest/v1/follow_up_messages?provider_message_id=eq.${encodeURIComponent(providerId)}&select=id,campaign_id,customer_id,recipient&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
    const message=messages?.[0]||{};
    await request(`${base}/rest/v1/marketing_email_events`,{method:"POST",headers:{apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({message_id:message.id||null,campaign_id:message.campaign_id||null,provider:"resend",provider_event_id:String(req.headers["svix-id"]).slice(0,500),provider_message_id:providerId,event_type:type,occurred_at:payload.created_at||new Date().toISOString(),metadata:{link:String(payload.data?.click?.link||"").slice(0,1000)}})});
    if(["bounced","complained"].includes(type)&&message.recipient){
      await request(`${base}/rest/v1/marketing_suppressions`,{method:"POST",headers:{apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({customer_id:message.customer_id||null,normalized_email:String(message.recipient).trim().toLowerCase(),scope:"global",reason:type==="bounced"?"bounce":"complaint",source:"resend_webhook"})});
    }
    return json(res,200,{ok:true});
  }catch(error){console.error("Email webhook failed.",{message:error.message});return json(res,500,{error:"Webhook processing failed."});}
}
module.exports=handler;module.exports.config={api:{bodyParser:false}};module.exports.verifySignature=verifySignature;module.exports.eventType=eventType;module.exports.rawBody=rawBody;
