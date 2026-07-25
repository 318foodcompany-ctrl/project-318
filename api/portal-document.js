"use strict";
const crypto=require("node:crypto");
function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const r=await fetch(url,options),text=await r.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!r.ok)throw new Error(body?.message||body?.error||`Storage request failed (${r.status}).`);return body;}
function safeName(value){return String(value||"document").replace(/[^a-zA-Z0-9._-]/g,"-").replace(/-+/g,"-").slice(-120);}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),anon=String(process.env.PUBLIC_SUPABASE_ANON_KEY||""),service=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  if(!base||!anon||!service)return reply(res,503,{error:"Document service is not configured."});
  const token=String(req.headers["x-portal-token"]||""),body=req.body||{},mime=String(body.mimeType||"");
  if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))return reply(res,400,{error:"Upload a PDF, JPG, PNG, or WebP file."});
  let bytes;try{bytes=Buffer.from(String(body.data||""),"base64");}catch(_e){return reply(res,400,{error:"The upload is invalid."});}
  if(!bytes.length||bytes.length>4194304)return reply(res,400,{error:"Files must be smaller than 4 MB."});
  try{
    const snapshot=await request(`${base}/rest/v1/rpc/sales_portal_snapshot`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${anon}`,"Content-Type":"application/json"},body:JSON.stringify({p_token:token})});
    const customerRows=await request(`${base}/rest/v1/customer_portal_tokens?token_hash=eq.${crypto.createHash("sha256").update(token).digest("hex")}&select=customer_id&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
    if(!snapshot?.customer||customerRows.length!==1)throw new Error("Portal access denied.");
    const customerId=customerRows[0].customer_id,name=safeName(body.fileName),path=`${customerId}/${crypto.randomUUID()}-${name}`;
    await request(`${base}/storage/v1/object/customer-documents/${path}`,{method:"POST",headers:{apikey:service,Authorization:`Bearer ${service}`,"Content-Type":mime,"x-upsert":"false"},body:bytes});
    await request(`${base}/rest/v1/customer_documents`,{method:"POST",headers:{apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({customer_id:customerId,proposal_id:body.proposalId||null,file_name:name,storage_path:path,mime_type:mime,size_bytes:bytes.length,uploaded_by_customer:true})});
    reply(res,201,{ok:true,fileName:name});
  }catch(error){console.error("Portal document upload failed.",{message:error.message});reply(res,403,{error:"The document could not be uploaded."});}
}
module.exports=handler;module.exports.safeName=safeName;
