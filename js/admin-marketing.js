(function marketingDashboardModule(globalScope){
  "use strict";

  function currency(value){
    return Number(value||0).toLocaleString("en-US",{style:"currency",currency:"USD"});
  }

  function dateInputValue(date){
    const value=new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  }

  function summarize(rows){
    return (rows||[]).reduce((summary,row)=>{
      const revenue=Number(row.revenue||0);
      summary.revenue+=revenue;
      summary.payments+=Number(row.payment_count||0);
      summary.sources.add(row.source||"unattributed");
      if(revenue>summary.topRevenue){summary.topRevenue=revenue;summary.topSource=row.source||"unattributed";}
      return summary;
    },{revenue:0,payments:0,sources:new Set(),topSource:"—",topRevenue:-Infinity});
  }

  function summarizeFunnel(rows){
    return (rows||[]).reduce((summary,row)=>{
      summary.quotes+=Number(row.quote_count||0);
      summary.contacted+=Number(row.contacted_count||0);
      summary.proposals+=Number(row.proposal_count||0);
      summary.booked+=Number(row.booked_count||0);
      summary.closed+=Number(row.closed_count||0);
      summary.cancelled+=Number(row.cancelled_count||0);
      summary.quotedBudget+=Number(row.quoted_budget||0);
      summary.bookedBudget+=Number(row.booked_budget||0);
      return summary;
    },{quotes:0,contacted:0,proposals:0,booked:0,closed:0,cancelled:0,quotedBudget:0,bookedBudget:0});
  }

  function percent(part,total){
    return total>0?`${((Number(part||0)/Number(total))*100).toFixed(1)}%`:"0.0%";
  }

  function escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  }

  function providerStatus(config={}){
    return {
      ga4:{configured:/^G-[A-Z0-9]{6,20}$/.test(String(config.ga4MeasurementId||"").toUpperCase()),label:"Google Analytics 4"},
      meta:{configured:/^[0-9]{5,30}$/.test(String(config.metaPixelId||"")),label:"Meta Pixel"}
    };
  }

  function statusMarkup(label,configured,detail){
    const state=configured?"Connected":"Needs setup";
    return `<div class="marketing-setup-item"><div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></div><em class="marketing-status ${configured?"ready":"pending"}">${state}</em></div>`;
  }

  function createDashboard(win){
    const doc=win.document;
    const client=win.supabaseClient;
    if(!doc||!client||doc.getElementById("marketingPanel")) return;

    const stylesheet=doc.createElement("link");
    stylesheet.rel="stylesheet";
    stylesheet.href="css/admin-marketing.css";
    doc.head.appendChild(stylesheet);

    const navReference=doc.querySelector('[data-panel="leadsPanel"]');
    const nav=doc.createElement("button");
    nav.className="nav-button";
    nav.dataset.panel="marketingPanel";
    nav.textContent="Marketing Dashboard";
    navReference?.before(nav);

    const dashboardGrid=doc.querySelector("#dashboardPanel .dashboard-grid");
    const dashboardCard=doc.createElement("article");
    dashboardCard.className="dashboard-card";
    dashboardCard.innerHTML='<h3>Marketing Dashboard</h3><p>See lead conversion, attributed revenue, provider setup, and acquisition sources.</p><button data-open-panel="marketingPanel">Open Marketing</button>';
    dashboardGrid?.appendChild(dashboardCard);

    const panel=doc.createElement("section");
    panel.id="marketingPanel";
    panel.className="panel";
    panel.innerHTML=`
      <div class="panel-heading"><h2>Marketing Dashboard</h2><p>Lead funnel, revenue attribution, provider setup, and conversion tracking health.</p></div>
      <div class="marketing-setup-grid">
        <div class="card"><div class="marketing-card-heading"><div><h3>Provider setup</h3><p>Public tracking IDs are read from your deployment settings.</p></div><button id="marketingCheckSetup" type="button">Check setup</button></div><div id="marketingSetupList" class="marketing-setup-list"></div></div>
        <div class="card"><h3>Conversion tracking</h3><div class="marketing-conversion-list">
          <div><strong>Quote submitted</strong><span>GA4 event + Meta Lead</span></div>
          <div><strong>Phone click</strong><span>GA4 event + Meta Contact</span></div>
          <div><strong>Email click</strong><span>GA4 event + Meta Contact</span></div>
          <div><strong>Page view</strong><span>Consent-aware on both providers</span></div>
        </div><p class="marketing-note">No customer names, emails, phone numbers, notes, or form values are sent to advertising providers.</p></div>
      </div>
      <div class="marketing-toolbar card">
        <label>Start date<input id="marketingStart" type="date"></label>
        <label>End date<input id="marketingEnd" type="date"></label>
        <label>Attribution model<select id="marketingModel"><option value="last_non_direct">Last non-direct</option><option value="first">First touch</option></select></label>
        <button id="marketingRefresh" type="button">Refresh</button>
      </div>
      <div class="marketing-section-heading"><div><h3>Lead funnel</h3><p>Quotes submitted during the selected date range.</p></div></div>
      <div class="marketing-summary marketing-funnel-summary">
        <div class="marketing-metric"><span>Quotes</span><strong id="marketingQuotes">0</strong></div>
        <div class="marketing-metric"><span>Proposals Sent</span><strong id="marketingProposals">0</strong></div>
        <div class="marketing-metric"><span>Booked</span><strong id="marketingBooked">0</strong></div>
        <div class="marketing-metric"><span>Quote-to-Booking Rate</span><strong id="marketingBookingRate">0.0%</strong></div>
      </div>
      <div class="card marketing-funnel-card"><div class="marketing-card-heading"><div><h3>Quotes by source</h3><p id="marketingFunnelMessage" class="message" role="status" aria-live="polite"></p></div><div class="marketing-budget"><span>Booked quote value</span><strong id="marketingBookedBudget">$0.00</strong></div></div><div id="marketingFunnelTable"></div></div>
      <div class="marketing-section-heading"><div><h3>Recorded revenue</h3><p>Payments linked to attributed quotes and invoices.</p></div></div>
      <div class="marketing-summary">
        <div class="marketing-metric"><span>Attributed Revenue</span><strong id="marketingRevenue">$0.00</strong></div>
        <div class="marketing-metric"><span>Payments</span><strong id="marketingPayments">0</strong></div>
        <div class="marketing-metric"><span>Revenue Sources</span><strong id="marketingSources">0</strong></div>
        <div class="marketing-metric"><span>Top Source</span><strong id="marketingTopSource">—</strong></div>
      </div>
      <div class="marketing-grid">
        <div class="card"><h3>Revenue by source</h3><p id="marketingMessage" class="message" role="status" aria-live="polite"></p><div id="marketingTable"></div></div>
        <div class="card"><h3>Source mix</h3><div id="marketingSourceList" class="marketing-source-list"></div></div>
      </div>`;
    doc.querySelector(".content")?.appendChild(panel);

    const now=new Date();
    const start=new Date(now.getFullYear(),now.getMonth()-2,1);
    doc.getElementById("marketingStart").value=dateInputValue(start);
    doc.getElementById("marketingEnd").value=dateInputValue(now);

    function showPanel(){
      doc.querySelectorAll(".panel").forEach(item=>item.classList.toggle("active",item.id==="marketingPanel"));
      doc.querySelectorAll(".nav-button").forEach(item=>item.classList.toggle("active",item.dataset.panel==="marketingPanel"));
    }
    nav.addEventListener("click",showPanel);
    dashboardCard.querySelector("button").addEventListener("click",showPanel);

    function checkSetup(){
      const target=doc.getElementById("marketingSetupList");
      const statuses=providerStatus(win.__APP_CONFIG__||{});
      target.innerHTML=statusMarkup(statuses.ga4.label,statuses.ga4.configured,statuses.ga4.configured?"Measurement ID detected":"Add PUBLIC_GA4_MEASUREMENT_ID in Vercel")+
        statusMarkup(statuses.meta.label,statuses.meta.configured,statuses.meta.configured?"Pixel ID detected":"Add PUBLIC_META_PIXEL_ID in Vercel")+
        statusMarkup("Consent controls",true,"Analytics and advertising are denied until the visitor chooses")+
        statusMarkup("First-party attribution",true,"Quote-to-payment revenue attribution is installed");
    }

    function renderFunnel(rows){
      const summary=summarizeFunnel(rows);
      doc.getElementById("marketingQuotes").textContent=String(summary.quotes);
      doc.getElementById("marketingProposals").textContent=String(summary.proposals);
      doc.getElementById("marketingBooked").textContent=String(summary.booked);
      doc.getElementById("marketingBookingRate").textContent=percent(summary.booked,summary.quotes);
      doc.getElementById("marketingBookedBudget").textContent=currency(summary.bookedBudget);
      doc.getElementById("marketingFunnelMessage").textContent=rows.length?`Showing ${rows.length} quote source${rows.length===1?"":"s"}.`:"No quotes were submitted in this date range.";
      doc.getElementById("marketingFunnelTable").innerHTML=rows.length?`<div class="quote-table-wrap"><table class="marketing-table"><thead><tr><th>Source</th><th>Campaign</th><th>Quotes</th><th>Contacted</th><th>Proposals</th><th>Booked</th><th>Booking rate</th><th>Booked value</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.source||"unattributed")}<small>${escapeHtml(row.medium||"(none)")}</small></td><td>${escapeHtml(row.campaign||"—")}</td><td>${Number(row.quote_count||0)}</td><td>${Number(row.contacted_count||0)}</td><td>${Number(row.proposal_count||0)}</td><td>${Number(row.booked_count||0)}</td><td>${percent(row.booked_count,row.quote_count)}</td><td>${currency(row.booked_budget)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="marketing-empty">Lead source performance will appear after quote submissions are recorded.</div>';
    }

    function renderRevenue(rows){
      const summary=summarize(rows);
      doc.getElementById("marketingRevenue").textContent=currency(summary.revenue);
      doc.getElementById("marketingPayments").textContent=String(summary.payments);
      doc.getElementById("marketingSources").textContent=String(summary.sources.size);
      doc.getElementById("marketingTopSource").textContent=summary.topSource;
      doc.getElementById("marketingMessage").textContent=rows.length?`Showing ${rows.length} attributed source${rows.length===1?"":"s"}.`:"No attributed revenue was recorded in this date range.";
      doc.getElementById("marketingTable").innerHTML=rows.length?`<div class="quote-table-wrap"><table class="marketing-table"><thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th>Payments</th><th>Revenue</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.source||"unattributed")}</td><td>${escapeHtml(row.medium||"(none)")}</td><td>${escapeHtml(row.campaign||"—")}</td><td>${Number(row.payment_count||0)}</td><td>${currency(row.revenue)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="marketing-empty">Revenue will appear here after an attributed quote becomes a paid invoice.</div>';
      doc.getElementById("marketingSourceList").innerHTML=rows.length?rows.slice(0,8).map(row=>`<div class="marketing-source-item"><span>${escapeHtml(row.source||"unattributed")}</span><strong>${currency(row.revenue)}</strong></div>`).join(""):'<div class="marketing-empty">No source data yet.</div>';
    }

    async function refresh(){
      const startValue=doc.getElementById("marketingStart").value;
      const endValue=doc.getElementById("marketingEnd").value;
      const model=doc.getElementById("marketingModel").value;
      doc.getElementById("marketingMessage").textContent="Loading revenue results…";
      doc.getElementById("marketingFunnelMessage").textContent="Loading lead funnel…";
      const [revenueResult,funnelResult]=await Promise.all([
        client.rpc("marketing_revenue_attribution",{p_start:startValue,p_end:endValue,p_model:model}),
        client.rpc("marketing_quote_funnel",{p_start:startValue,p_end:endValue,p_model:model})
      ]);
      if(revenueResult.error) doc.getElementById("marketingMessage").textContent=`Unable to load revenue data: ${revenueResult.error.message}`;
      else renderRevenue(revenueResult.data||[]);
      if(funnelResult.error) doc.getElementById("marketingFunnelMessage").textContent=`Unable to load lead funnel: ${funnelResult.error.message}. Confirm the marketing funnel migration has been applied.`;
      else renderFunnel(funnelResult.data||[]);
    }

    doc.getElementById("marketingCheckSetup").addEventListener("click",checkSetup);
    doc.getElementById("marketingRefresh").addEventListener("click",refresh);
    checkSetup();
    refresh();
  }

  const api={currency,dateInputValue,summarize,summarizeFunnel,percent,escapeHtml,providerStatus,statusMarkup,createDashboard};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(globalScope&&globalScope.document){
    if(globalScope.document.readyState==="loading") globalScope.document.addEventListener("DOMContentLoaded",()=>createDashboard(globalScope));
    else createDashboard(globalScope);
  }
})(typeof window!=="undefined"?window:globalThis);
