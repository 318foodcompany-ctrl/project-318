"use strict";
function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch(_e){body=text;}if(!response.ok){const error=new Error("Database request failed.");error.status=response.status;throw error;}return body;}
async function adminContext(req){const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),anon=String(process.env.PUBLIC_SUPABASE_ANON_KEY||""),service=String(process.env.SUPABASE_SERVICE_ROLE_KEY||""),token=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");if(!base||!anon||!service||!token)throw Object.assign(new Error("Authentication required."),{status:401});const user=await request(`${base}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});const admin=await request(`${base}/rest/v1/rpc/crm_is_admin`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:"{}"});if(!user?.id||admin!==true)throw Object.assign(new Error("Administrator access required."),{status:403});return {base,service,user};}
async function db(base,key,path,options={}){return request(`${base}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(options.headers||{})}});}
function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""))?String(value):"";}
function slugify(value){return String(value||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g,"").trim().replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||`post-${Date.now()}`;}
function text(value,max){return String(value==null?"":value).trim().slice(0,max);}
async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  try{
    const ctx=await adminContext(req),raw=typeof req.body==="string"?JSON.parse(req.body):req.body||{},taskId=uuid(raw.task_id);
    if(!taskId)return reply(res,400,{error:"Invalid task."});
    const tasks=await db(ctx.base,ctx.service,`marketing_ai_tasks?id=eq.${taskId}&select=*&limit=1`),task=tasks?.[0];
    if(!task||task.status!=="approved"||!task.ai_content_id)return reply(res,409,{error:"Only approved AI drafts can be published."});
    const prior=await db(ctx.base,ctx.service,`marketing_ai_approval_audit?task_id=eq.${taskId}&action=eq.published&select=details&order=created_at.desc&limit=1`);
    if(prior?.[0])return reply(res,200,{ok:true,published:true,already_published:true,destination:prior[0].details?.destination||""});
    const rows=await db(ctx.base,ctx.service,`marketing_ai_content?id=eq.${task.ai_content_id}&select=*&limit=1`),content=rows?.[0],out=content?.structured_output||{};
    if(!content)return reply(res,404,{error:"Approved AI content was not found."});
    let destination="";
    if(task.content_type==="blog_draft"){
      const title=text(out.title||content.title,300),body=text(out.body||out.primary,50000),excerpt=text(out.description||out.preview_text||out.primary,1000);
      if(!title||!body)return reply(res,400,{error:"Blog draft is missing a title or body."});
      const desired=slugify(raw.slug||title),existing=await db(ctx.base,ctx.service,`blog_posts?source_ai_content_id=eq.${task.ai_content_id}&select=id,slug&limit=1`);
      if(existing?.[0]){await db(ctx.base,ctx.service,`blog_posts?id=eq.${existing[0].id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({title,excerpt,body,seo_title:text(out.headline||title,70),seo_description:text(out.description||excerpt,170),status:"published",published_at:new Date().toISOString()})});destination=`/blog/${existing[0].slug}`;}
      else{let slug=desired;for(let i=0;i<6;i++){const used=await db(ctx.base,ctx.service,`blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);if(!used.length)break;slug=`${desired}-${i+2}`;}const created=await db(ctx.base,ctx.service,"blog_posts",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({source_ai_content_id:task.ai_content_id,slug,title,excerpt,body,seo_title:text(out.headline||title,70),seo_description:text(out.description||excerpt,170),status:"published",published_at:new Date().toISOString(),created_by:ctx.user.id})});destination=`/blog/${created?.[0]?.slug||slug}`;}
    }else if(task.content_type==="faq_draft"){
      const question=text(out.title||out.headline||content.title,500),answer=text(out.body||out.primary,10000),category=text(raw.category||"General",100)||"General";
      if(!question||!answer)return reply(res,400,{error:"FAQ draft is missing a question or answer."});
      await db(ctx.base,ctx.service,"faq_items",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({category,question,answer,status:"published",sort_order:999})});destination="/faq.html";
    }else return reply(res,400,{error:"This approved draft type does not have an automatic publishing connector yet."});
    await db(ctx.base,ctx.service,"marketing_ai_approval_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({task_id:task.id,ai_content_id:task.ai_content_id,action:"published",actor_id:ctx.user.id,details:{destination,content_type:task.content_type}})});
    return reply(res,200,{ok:true,published:true,already_published:false,destination});
  }catch(error){console.error("AI approved publishing failed.",{message:error.message});return reply(res,error.status===401?401:error.status===403?403:500,{error:error.status===401||error.status===403?error.message:"Approved content could not be published."});}
}
module.exports=handler;module.exports.slugify=slugify;
