(function(){
  "use strict";
  const TYPES=["blog_draft","faq_draft","seo_recommendation","facebook_post","instagram_caption","linkedin_post","google_business_post","email_newsletter","promotional_email","landing_page","seasonal_campaign","holiday_campaign","analytics_summary","growth_recommendation"];
  const AUTO_PUBLISHABLE=new Set(["blog_draft","faq_draft"]);
  const state={settings:[],tasks:[],content:new Map(),brain:null,audit:[]};
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function client(){if(!window.supabaseClient)throw new Error("Supabase is unavailable.");return window.supabaseClient;}
  function msg(text,error=false){const el=$("autopilotMessage");el.textContent=text;el.className=`message ${error?"error":"ok"}`;}
  async function unwrap(p){const r=await p;if(r.error)throw r.error;return r.data||[];}
  function pretty(type){return String(type||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
  function nextDefault(){const d=new Date();d.setMinutes(0,0,0);d.setHours(d.getHours()+1);return d.toISOString();}
  function defaultSetting(type){return {automation_type:type,enabled:false,cadence:type==="analytics_summary"?"daily":"weekly",interval_minutes:null,day_of_week:1,day_of_month:1,preferred_hour:8,items_per_run:["facebook_post","instagram_caption"].includes(type)?3:1,approval_required:true,tone:"professional",target_audience:"Local catering customers and qualified prospects",campaign_goal:"Increase qualified catering demand and profitable bookings",custom_instructions:"",next_run_at:nextDefault()};}
  function renderSettings(){
    const byType=new Map(state.settings.map(x=>[x.automation_type,x]));
    $("settingsList").innerHTML=TYPES.map(type=>{const s=byType.get(type)||defaultSetting(type);return `<section class="setting" data-setting="${type}"><div class="switchline"><div><strong>${esc(pretty(type))}</strong><div class="muted">${s.enabled?"Enabled":"Paused"}${s.next_run_at?` · next ${new Date(s.next_run_at).toLocaleString()}`:""}</div></div><label><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Enabled</label></div><div class="row"><label class="field">Cadence<select name="cadence"><option value="daily" ${s.cadence==="daily"?"selected":""}>Daily</option><option value="weekly" ${s.cadence==="weekly"?"selected":""}>Weekly</option><option value="monthly" ${s.cadence==="monthly"?"selected":""}>Monthly</option><option value="custom_interval" ${s.cadence==="custom_interval"?"selected":""}>Custom interval</option></select></label><label class="field">Items / run<input name="items_per_run" type="number" min="1" max="20" value="${Number(s.items_per_run||1)}"></label><label class="field">Hour (0-23)<input name="preferred_hour" type="number" min="0" max="23" value="${Number(s.preferred_hour??8)}"></label><label class="field">Custom interval minutes<input name="interval_minutes" type="number" min="60" max="525600" value="${s.interval_minutes||""}"></label></div><div class="row"><label class="field">Tone<select name="tone">${["professional","friendly","corporate","casual","premium","urgent"].map(t=>`<option value="${t}" ${s.tone===t?"selected":""}>${t}</option>`).join("")}</select></label><label class="field">Audience<input name="target_audience" maxlength="500" value="${esc(s.target_audience||"")}"></label></div><label class="field">Goal<input name="campaign_goal" maxlength="500" value="${esc(s.campaign_goal||"")}"></label><label class="field">Instructions<textarea name="custom_instructions" maxlength="4000">${esc(s.custom_instructions||"")}</textarea></label><div class="actions"><button class="primary" type="button" data-save-setting="${type}">Save ${esc(pretty(type))}</button></div></section>`;}).join("");
  }
  function card(task,approved=false){const c=state.content.get(task.ai_content_id)||{},o=c.structured_output||{},publishable=AUTO_PUBLISHABLE.has(task.content_type);return `<article class="task" data-task="${task.id}"><header><div><strong>${esc(c.title||pretty(task.content_type))}</strong><div class="status">${esc(pretty(task.content_type))} · ${approved?"approved":"ready for approval"}</div></div><span class="pill">${new Date(task.created_at).toLocaleString()}</span></header><pre ${approved?"":"contenteditable=\"true\""} data-output="${task.id}" aria-label="${approved?"Approved":"Editable"} AI draft">${esc(JSON.stringify(o,null,2))}</pre><div class="actions">${approved?(publishable?`<button class="approve" data-publish-task="${task.id}">Publish ${task.content_type==="blog_draft"?"Blog":"FAQ"}</button>`:`<button class="secondary" data-copy-task="${task.id}">Copy approved draft</button>`):`<button class="approve" data-action="approve" data-task-id="${task.id}">Approve</button><button class="secondary" data-action="edit" data-task-id="${task.id}">Save edits</button><button class="secondary" data-action="regenerate" data-task-id="${task.id}">Regenerate</button><button class="reject" data-action="reject" data-task-id="${task.id}">Reject</button>`}</div></article>`;}
  function renderQueue(){
    const approval=state.tasks.filter(t=>t.status==="ready_for_approval"),approved=state.tasks.filter(t=>t.status==="approved");
    $("queueCount").textContent=approval.length;
    $("queueList").innerHTML=approval.length?approval.map(t=>card(t,false)).join(""):'<div class="empty">Nothing is waiting for approval.</div>';
    $("approvedList").innerHTML=approved.length?approved.map(t=>card(t,true)).join(""):'<div class="empty">No approved drafts are waiting for use or publication.</div>';
  }
  function renderHistory(){$("historyList").innerHTML=state.audit.length?state.audit.map(a=>`<article class="task"><header><strong>${esc(pretty(a.action))}</strong><span class="pill">${new Date(a.created_at).toLocaleString()}</span></header><div class="muted">Task ${esc(a.task_id||"—")}${a.details?.destination?` · ${esc(a.details.destination)}`:""}</div></article>`).join(""):'<div class="empty">No AI audit history yet.</div>';}
  function renderBrain(){const b=state.brain||{};$("mission").value=b.mission||"";$("businessFacts").value=JSON.stringify(b.business_facts||{},null,2);$("voicePreferences").value=JSON.stringify(b.voice_preferences||{},null,2);$("seasonalRules").value=JSON.stringify(b.seasonal_rules||{},null,2);$("growthPriorities").value=JSON.stringify(b.growth_priorities||[],null,2);$("prohibitedClaims").value=JSON.stringify(b.prohibited_claims||[],null,2);}
  async function load(){
    msg("Loading AI Marketing Autopilot…");
    try{
      const [settings,tasks,brain,audit]=await Promise.all([
        unwrap(client().from("marketing_ai_automation_settings").select("*").order("automation_type")),
        unwrap(client().from("marketing_ai_tasks").select("*").order("created_at",{ascending:false}).limit(100)),
        unwrap(client().from("marketing_ai_brand_brain").select("*").eq("id",1).limit(1)),
        unwrap(client().from("marketing_ai_approval_audit").select("*").order("created_at",{ascending:false}).limit(100))
      ]);
      state.settings=settings;state.tasks=tasks;state.brain=brain[0]||null;state.audit=audit;
      const ids=[...new Set(tasks.map(t=>t.ai_content_id).filter(Boolean))];state.content.clear();
      if(ids.length){const rows=await unwrap(client().from("marketing_ai_content").select("id,title,structured_output,status,content_type").in("id",ids));rows.forEach(r=>state.content.set(r.id,r));}
      renderSettings();renderQueue();renderBrain();renderHistory();msg("");
    }catch(error){msg(`Autopilot could not load: ${error.message}. Confirm Release 5 migrations are applied.`,true);}
  }
  async function saveSetting(type){
    const root=document.querySelector(`[data-setting="${CSS.escape(type)}"]`),existing=state.settings.find(x=>x.automation_type===type),value=defaultSetting(type);
    for(const el of root.querySelectorAll("[name]")){if(el.type==="checkbox")value[el.name]=el.checked;else value[el.name]=el.value;}
    value.items_per_run=Math.max(1,Math.min(20,Number(value.items_per_run||1)));value.preferred_hour=Math.max(0,Math.min(23,Number(value.preferred_hour||8)));value.interval_minutes=value.cadence==="custom_interval"?Math.max(60,Number(value.interval_minutes||60)):null;value.next_run_at=existing?.next_run_at||nextDefault();
    try{if(existing)await unwrap(client().from("marketing_ai_automation_settings").update(value).eq("id",existing.id).select("*"));else await unwrap(client().from("marketing_ai_automation_settings").insert(value).select("*"));msg(`${pretty(type)} automation saved.`);await load();}catch(error){msg(`Could not save automation: ${error.message}`,true);}
  }
  function parsed(id){const raw=document.querySelector(`[data-output="${CSS.escape(id)}"]`)?.textContent||"";return JSON.parse(raw);}
  async function session(){const s=(await client().auth.getSession()).data.session;if(!s)throw new Error("Session expired.");return s;}
  async function action(taskId,action){
    try{const s=await session(),body={task_id:taskId,action};if(action==="edit")body.structured_output=parsed(taskId);if(action==="reject")body.reason="Rejected by administrator";const r=await fetch("/api/admin-marketing-autopilot-action",{method:"POST",headers:{Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(body)}),payload=await r.json();if(!r.ok)throw new Error(payload.error||"Action failed.");msg(action==="approve"?"Approved. Nothing was published or sent.":`${pretty(action)} completed.`);await load();}catch(error){msg(`AI task action failed: ${error.message}`,true);}
  }
  async function publish(taskId){
    try{const s=await session(),r=await fetch("/api/admin-marketing-autopilot-publish",{method:"POST",headers:{Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({task_id:taskId})}),payload=await r.json();if(!r.ok)throw new Error(payload.error||"Publish failed.");msg(`Published successfully to ${payload.destination}.`);await load();}catch(error){msg(`Approved content could not be published: ${error.message}`,true);}
  }
  async function copyTask(taskId){try{await navigator.clipboard.writeText(JSON.stringify(state.content.get(state.tasks.find(t=>t.id===taskId)?.ai_content_id)?.structured_output||{},null,2));msg("Approved draft copied.");}catch(error){msg("Could not copy the approved draft.",true);}}
  async function saveBrain(){
    try{const value={mission:$("mission").value.trim(),business_facts:JSON.parse($("businessFacts").value||"{}"),voice_preferences:JSON.parse($("voicePreferences").value||"{}"),seasonal_rules:JSON.parse($("seasonalRules").value||"{}"),growth_priorities:JSON.parse($("growthPriorities").value||"[]"),prohibited_claims:JSON.parse($("prohibitedClaims").value||"[]")};await unwrap(client().from("marketing_ai_brand_brain").update(value).eq("id",1).select("*"));msg("Business Brain saved.");await load();}catch(error){msg(`Business Brain was not saved: ${error.message}`,true);}
  }
  function tabs(){document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));}));}
  async function protect(){const r=await client().auth.getSession(),s=r.data?.session;if(!s){location.replace("login.html");return false;}const a=await client().rpc("crm_is_admin");if(a.error||a.data!==true){location.replace("login.html?error=unauthorized");return false;}$("signedIn").textContent=s.user.email||"Administrator";return true;}
  document.addEventListener("click",e=>{const setting=e.target.closest("[data-save-setting]");if(setting)saveSetting(setting.dataset.saveSetting);const a=e.target.closest("[data-action]");if(a)action(a.dataset.taskId,a.dataset.action);const p=e.target.closest("[data-publish-task]");if(p)publish(p.dataset.publishTask);const c=e.target.closest("[data-copy-task]");if(c)copyTask(c.dataset.copyTask);});
  $("saveBrain").addEventListener("click",saveBrain);$("refreshQueue").addEventListener("click",load);tabs();protect().then(ok=>ok&&load());
})();