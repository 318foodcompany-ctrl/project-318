(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value||0));
  async function session(){const s=(await window.supabaseClient.auth.getSession()).data.session;if(!s)throw new Error("Session expired.");return s;}
  function metric(label,value,detail=""){return `<article class="card"><div class="muted">${esc(label)}</div><div class="metric">${esc(value)}</div>${detail?`<div class="muted">${esc(detail)}</div>`:""}</article>`;}
  function render(pulse){
    const rate=pulse.ai.approval_rate_percent==null?"—":`${pulse.ai.approval_rate_percent}%`;
    $("executiveMetrics").innerHTML=[
      metric("Leads",pulse.business.leads,`${pulse.period_days}-day period`),
      metric("Bookings",pulse.business.bookings,`${pulse.business.confirmed} confirmed`),
      metric("Recorded paid value",money(pulse.business.paid_value),"Database-recorded invoice payments"),
      metric("AI approval queue",pulse.ai.waiting_for_approval,"drafts waiting"),
      metric("Draft approval rate",rate,"approved vs. rejected decisions"),
      metric("Automations enabled",`${pulse.ai.enabled_automations}/${pulse.ai.total_automations}`,"configurable generators"),
      metric("Marketing email",pulse.connections?.email?.connected?"Connected":"Needs setup",pulse.connections?.email?.provider||"provider"),
      metric("Google Business",pulse.connections?.google_business?.connected?"Connected":"Needs authorization","approval-only publishing"),
      metric("Published blogs",pulse.content.published_blogs,"content inventory"),
      metric("Published FAQs",pulse.content.published_faqs,"content inventory")
    ].join("");
    $("executiveRecommendations").innerHTML=pulse.recommendations.length?pulse.recommendations.map(r=>`<article class="task"><header><strong>${esc(r.title)}</strong><span class="pill">${esc(r.priority)}</span></header><p>${esc(r.reason)}</p><div class="muted">Recommended action: ${esc(r.action)}</div></article>`).join(""):'<div class="empty">No rule-based priority alerts were triggered from the current aggregate data.</div>';
    $("executiveUpdated").textContent=`Updated ${new Date(pulse.generated_at).toLocaleString()} · ${pulse.period_days}-day view`;
  }
  async function load(){
    const target=$("executiveMessage");if(!target)return;
    target.textContent="Loading executive pulse…";
    try{const s=await session(),r=await fetch("/api/admin-marketing-autopilot-executive?days=30",{headers:{Authorization:`Bearer ${s.access_token}`}}),payload=await r.json();if(!r.ok)throw new Error(payload.error||"Executive pulse failed.");render(payload.pulse);target.textContent="";}catch(error){target.textContent=`Executive pulse could not load: ${error.message}`;target.className="message error";}
  }
  document.addEventListener("click",e=>{if(e.target.closest("#refreshExecutive"))load();if(e.target.closest('[data-view="executiveView"]'))load();});
  window.addEventListener("load",()=>{if($("executiveView"))load();});
})();
