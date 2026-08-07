"use strict";
function json(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Method not allowed."});}
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),anon=String(process.env.PUBLIC_SUPABASE_ANON_KEY||"");
  const token=String(req.body?.token||req.query?.token||""); const scope=req.body?.scope==="campaign"?"campaign":"global";
  if(!base||!anon)return json(res,503,{error:"Unsubscribe service is unavailable."});
  if(!/^[a-f0-9]{64}$/i.test(token))return json(res,400,{error:"This unsubscribe link is invalid or expired."});
  try{
    const response=await fetch(`${base}/rest/v1/rpc/marketing_unsubscribe`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${anon}`,"Content-Type":"application/json"},body:JSON.stringify({p_token:token,p_scope:scope,p_campaign_id:req.body?.campaign_id||null}),signal:AbortSignal.timeout(10000)});
    const text=await response.text();let result;try{result=JSON.parse(text);}catch(_error){result=false;}
    if(!response.ok||result!==true)return json(res,400,{error:"This unsubscribe link is invalid or expired."});
    return json(res,200,{ok:true,message:"You have been unsubscribed from marketing email. Transactional messages about active requests or events may still be sent."});
  }catch(error){console.error("Unsubscribe failed.",{message:error.message});return json(res,503,{error:"Unsubscribe could not be completed. Please try again."});}
}
module.exports=handler;
