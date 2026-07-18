(function marketingSpendModule(globalScope){
  "use strict";

  function money(value){
    return Number(value||0).toLocaleString("en-US",{style:"currency",currency:"USD"});
  }

  function ratio(value){
    return value==null||value===""?"—":`${Number(value).toFixed(2)}x`;
  }

  function summarize(rows){
    return (rows||[]).reduce((summary,row)=>{
      summary.spend+=Number(row.spend||0);
      summary.revenue+=Number(row.revenue||0);
      summary.quotes+=Number(row.quote_count||0);
      summary.booked+=Number(row.booked_count||0);
      return summary;
    },{spend:0,revenue:0,quotes:0,booked:0});
  }

  function escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  }

  function createSpendDashboard(win){
    const doc=win.document;
    const client=win.supabaseClient;
    const panel=doc&&doc.getElementById("marketingPanel");
    if(!panel||!client||doc.getElementById("marketingSpendSection")) return;

    const section=doc.createElement("div");
    section.id="marketingSpendSection";
    section.innerHTML=`
      <div class="marketing-section-heading"><div><h3>Marketing spend and return</h3><p>Enter advertising costs to calculate cost per lead, cost per booking, and return on ad spend.</p></div></div>
      <div class="marketing-spend-layout">
        <form id="marketingSpendForm" class="card marketing-spend-form">
          <h3>Add marketing spend</h3>
          <div class="marketing-spend-fields">
            <label>Date<input id="marketingSpendDate" type="date" required></label>
            <label>Source<input id="marketingSpendSource" maxlength="255" placeholder="facebook" required></label>
            <label>Medium<input id="marketingSpendMedium" maxlength="255" placeholder="paid_social"></label>
            <label>Campaign<input id="marketingSpendCampaign" maxlength="500" placeholder="summer_office_catering"></label>
            <label>Amount<input id="marketingSpendAmount" type="number" min="0" step="0.01" required></label>
            <label class="wide">Notes<input id="marketingSpendNotes" maxlength="1000" placeholder="Optional invoice or campaign note"></label>
          </div>
          <button type="submit">Save spend</button>
          <p id="marketingSpendFormMessage" class="message" role="status" aria-live="polite"></p>
        </form>
        <div class="marketing-summary marketing-spend-summary">
          <div class="marketing-metric"><span>Total Spend</span><strong id="marketingTotalSpend">$0.00</strong></div>
          <div class="marketing-metric"><span>Attributed Revenue</span><strong id="marketingSpendRevenue">$0.00</strong></div>
          <div class="marketing-metric"><span>ROAS</span><strong id="marketingRoas">—</strong></div>
          <div class="marketing-metric"><span>Cost per Booking</span><strong id="marketingCostPerBooking">—</strong></div>
        </div>
      </div>
      <div class="card"><div class="marketing-card-heading"><div><h3>Return by source</h3><p id="marketingSpendMessage" class="message" role="status" aria-live="polite"></p></div><button id="marketingSpendRefresh" type="button">Refresh return</button></div><div id="marketingSpendTable"></div></div>`;
    panel.appendChild(section);

    const dateInput=doc.getElementById("marketingSpendDate");
    dateInput.value=new Date().toISOString().slice(0,10);

    function reportingValues(){
      return {
        p_start:doc.getElementById("marketingStart").value,
        p_end:doc.getElementById("marketingEnd").value,
        p_model:doc.getElementById("marketingModel").value
      };
    }

    function render(rows){
      const summary=summarize(rows);
      doc.getElementById("marketingTotalSpend").textContent=money(summary.spend);
      doc.getElementById("marketingSpendRevenue").textContent=money(summary.revenue);
      doc.getElementById("marketingRoas").textContent=summary.spend>0?ratio(summary.revenue/summary.spend):"—";
      doc.getElementById("marketingCostPerBooking").textContent=summary.booked>0?money(summary.spend/summary.booked):"—";
      doc.getElementById("marketingSpendMessage").textContent=rows.length?`Showing ${rows.length} source and campaign result${rows.length===1?"":"s"}.`:"No marketing spend or attributed results were recorded in this date range.";
      doc.getElementById("marketingSpendTable").innerHTML=rows.length?`<div class="quote-table-wrap"><table class="marketing-table"><thead><tr><th>Source</th><th>Campaign</th><th>Spend</th><th>Revenue</th><th>Quotes</th><th>Booked</th><th>Cost / Quote</th><th>Cost / Booking</th><th>ROAS</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.source||"unattributed")}<small>${escapeHtml(row.medium||"(none)")}</small></td><td>${escapeHtml(row.campaign||"—")}</td><td>${money(row.spend)}</td><td>${money(row.revenue)}</td><td>${Number(row.quote_count||0)}</td><td>${Number(row.booked_count||0)}</td><td>${row.cost_per_quote==null?"—":money(row.cost_per_quote)}</td><td>${row.cost_per_booking==null?"—":money(row.cost_per_booking)}</td><td>${ratio(row.roas)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="marketing-empty">Add campaign spend to begin measuring return.</div>';
    }

    async function refresh(){
      const message=doc.getElementById("marketingSpendMessage");
      message.textContent="Loading marketing return…";
      const {data,error}=await client.rpc("marketing_spend_summary",reportingValues());
      if(error){
        message.textContent=`Unable to load spend reporting: ${error.message}. Confirm the marketing spend migration has been applied.`;
        return;
      }
      render(data||[]);
    }

    async function save(event){
      event.preventDefault();
      const message=doc.getElementById("marketingSpendFormMessage");
      const payload={
        spend_date:dateInput.value,
        source:doc.getElementById("marketingSpendSource").value.trim().toLowerCase(),
        medium:doc.getElementById("marketingSpendMedium").value.trim().toLowerCase(),
        campaign:doc.getElementById("marketingSpendCampaign").value.trim().toLowerCase(),
        amount:Number(doc.getElementById("marketingSpendAmount").value),
        notes:doc.getElementById("marketingSpendNotes").value.trim()
      };
      if(!payload.spend_date||!payload.source||!Number.isFinite(payload.amount)||payload.amount<0){
        message.textContent="Enter a date, source, and valid amount.";
        return;
      }
      message.textContent="Saving spend…";
      const {error}=await client.from("marketing_spend").insert(payload);
      if(error){message.textContent=`Unable to save spend: ${error.message}`;return;}
      message.textContent="Marketing spend saved.";
      doc.getElementById("marketingSpendAmount").value="";
      doc.getElementById("marketingSpendNotes").value="";
      await refresh();
    }

    doc.getElementById("marketingSpendForm").addEventListener("submit",save);
    doc.getElementById("marketingSpendRefresh").addEventListener("click",refresh);
    doc.getElementById("marketingRefresh").addEventListener("click",refresh);
    refresh();
  }

  const api={money,ratio,summarize,escapeHtml,createSpendDashboard};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(globalScope&&globalScope.document){
    if(globalScope.document.readyState==="loading") globalScope.document.addEventListener("DOMContentLoaded",()=>createSpendDashboard(globalScope));
    else createSpendDashboard(globalScope);
  }
})(typeof window!=="undefined"?window:globalThis);
