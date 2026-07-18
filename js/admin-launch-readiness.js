(function launchReadinessModule(globalScope){
  "use strict";

  function validGa4(value){return /^G-[A-Z0-9]{6,20}$/.test(String(value||"").toUpperCase());}
  function validMeta(value){return /^[0-9]{5,30}$/.test(String(value||""));}
  function summarizeChecks(checks){
    return (checks||[]).reduce((summary,check)=>{
      summary.total+=1;
      if(check.status==="ready") summary.ready+=1;
      else if(check.status==="warning") summary.warning+=1;
      else summary.blocked+=1;
      return summary;
    },{total:0,ready:0,warning:0,blocked:0});
  }
  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));}
  function score(summary){return summary.total?Math.round((summary.ready/summary.total)*100):0;}
  function statusLabel(status){return status==="ready"?"Ready":status==="warning"?"Needs attention":"Blocked";}
  function result(id,label,status,detail,action=""){return {id,label,status,detail,action};}

  async function checkFetch(win,path,label){
    try{
      const response=await win.fetch(path,{cache:"no-store",credentials:"same-origin"});
      return response.ok?result(path,label,"ready",`${path} returned ${response.status}.`):result(path,label,"blocked",`${path} returned ${response.status}.`);
    }catch(error){return result(path,label,"blocked",`Could not load ${path}: ${error.message}`);}
  }

  async function checkRpc(client,name,args,label){
    try{
      const {error}=await client.rpc(name,args);
      return error?result(name,label,"blocked",error.message,"Apply the required Supabase migration."):result(name,label,"ready","Database function is available.");
    }catch(error){return result(name,label,"blocked",error.message,"Check Supabase connectivity and migration status.");}
  }

  async function runChecks(win){
    const config=win.__APP_CONFIG__||{};
    const client=win.supabaseClient;
    const today=new Date().toISOString().slice(0,10);
    const checks=[
      config.supabaseUrl&&config.supabaseAnonKey?result("runtime","Runtime configuration","ready","Supabase public configuration is present."):result("runtime","Runtime configuration","blocked","Supabase public configuration is missing."),
      client?result("client","Supabase connection","ready","Browser client initialized."):result("client","Supabase connection","blocked","Browser client did not initialize."),
      validGa4(config.ga4MeasurementId)?result("ga4","Google Analytics 4","ready","A valid GA4 measurement ID is configured."):result("ga4","Google Analytics 4","warning","GA4 is installed but no valid measurement ID is configured.","Add PUBLIC_GA4_MEASUREMENT_ID in Vercel."),
      validMeta(config.metaPixelId)?result("meta","Meta Pixel","ready","A valid Meta Pixel ID is configured."):result("meta","Meta Pixel","warning","Meta Pixel is installed but no valid pixel ID is configured.","Add PUBLIC_META_PIXEL_ID in Vercel.")
    ];

    if(client){
      try{
        const {data,error}=await client.auth.getSession();
        checks.push(!error&&data&&data.session?result("session","Administrator session","ready","An authenticated session is active."):result("session","Administrator session","blocked",error?.message||"No authenticated administrator session was found."));
      }catch(error){checks.push(result("session","Administrator session","blocked",error.message));}
      const rpcArgs={p_start:today,p_end:today,p_model:"last_non_direct"};
      const rpcChecks=await Promise.all([
        checkRpc(client,"marketing_revenue_attribution",rpcArgs,"Revenue attribution reporting"),
        checkRpc(client,"marketing_quote_funnel",rpcArgs,"Lead funnel reporting"),
        checkRpc(client,"marketing_spend_summary",rpcArgs,"Ad spend and ROAS reporting")
      ]);
      checks.push(...rpcChecks);
    }

    const publicChecks=await Promise.all([
      checkFetch(win,"/sitemap.xml","XML sitemap"),
      checkFetch(win,"/robots.txt","Crawler rules"),
      checkFetch(win,"/quote-builder.html","Public quote builder")
    ]);
    checks.push(...publicChecks);
    return checks;
  }

  function createDashboard(win){
    const doc=win.document;
    if(!doc||!win.supabaseClient||doc.getElementById("launchReadinessPanel")) return;
    const stylesheet=doc.createElement("link");
    stylesheet.rel="stylesheet";
    stylesheet.href="css/admin-launch-readiness.css";
    doc.head.appendChild(stylesheet);

    const navReference=doc.querySelector('[data-panel="marketingPanel"]')||doc.querySelector('[data-panel="leadsPanel"]');
    const nav=doc.createElement("button");
    nav.className="nav-button";
    nav.dataset.panel="launchReadinessPanel";
    nav.textContent="Launch Readiness";
    navReference?.after(nav);

    const card=doc.createElement("article");
    card.className="dashboard-card";
    card.innerHTML='<h3>Launch Readiness</h3><p>Check production configuration, database features, tracking, and public website endpoints.</p><button type="button">Run Launch Check</button>';
    doc.querySelector("#dashboardPanel .dashboard-grid")?.appendChild(card);

    const panel=doc.createElement("section");
    panel.id="launchReadinessPanel";
    panel.className="panel";
    panel.innerHTML=`<div class="panel-heading"><h2>Launch Readiness</h2><p>Automated production checks for the systems needed to accept, manage, and measure catering leads.</p></div>
      <div class="launch-toolbar card"><div><strong id="launchScore">Checking…</strong><span id="launchSummary">Running launch checks.</span></div><button id="launchRun" type="button">Run checks again</button></div>
      <div id="launchChecks" class="launch-check-grid" aria-live="polite"></div>`;
    doc.querySelector(".content")?.appendChild(panel);

    function showPanel(){
      doc.querySelectorAll(".panel").forEach(item=>item.classList.toggle("active",item.id==="launchReadinessPanel"));
      doc.querySelectorAll(".nav-button").forEach(item=>item.classList.toggle("active",item.dataset.panel==="launchReadinessPanel"));
    }
    nav.addEventListener("click",showPanel);
    card.querySelector("button").addEventListener("click",showPanel);

    async function refresh(){
      const target=doc.getElementById("launchChecks");
      const runButton=doc.getElementById("launchRun");
      runButton.disabled=true;
      target.innerHTML='<div class="card launch-loading">Running production checks…</div>';
      const checks=await runChecks(win);
      const summary=summarizeChecks(checks);
      doc.getElementById("launchScore").textContent=`${score(summary)}% ready`;
      doc.getElementById("launchSummary").textContent=`${summary.ready} ready, ${summary.warning} need attention, ${summary.blocked} blocked.`;
      target.innerHTML=checks.map(check=>`<article class="card launch-check ${check.status}"><div class="launch-check-heading"><h3>${escapeHtml(check.label)}</h3><span>${statusLabel(check.status)}</span></div><p>${escapeHtml(check.detail)}</p>${check.action?`<small>${escapeHtml(check.action)}</small>`:""}</article>`).join("");
      runButton.disabled=false;
    }
    doc.getElementById("launchRun").addEventListener("click",refresh);
    refresh();
  }

  const api={validGa4,validMeta,summarizeChecks,score,statusLabel,result,runChecks,createDashboard};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(globalScope&&globalScope.document){
    if(globalScope.document.readyState==="loading") globalScope.document.addEventListener("DOMContentLoaded",()=>createDashboard(globalScope));
    else createDashboard(globalScope);
  }
})(typeof window!=="undefined"?window:globalThis);
