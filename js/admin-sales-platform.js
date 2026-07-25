(function () {
  "use strict";
  const panel = document.getElementById("salesPlatformPanel");
  if (!panel) return;
  const workspace = document.getElementById("salesWorkspace");
  const message = document.getElementById("salesMessage");
  const metrics = document.getElementById("salesMetrics");
  const utils = window.salesPlatformUtils;
  let view = "pipeline";
  let cache = { opportunities: [], proposals: [], bookings: [], invoices: [], payments: [] };
  const esc = utils.escapeHTML;
  const setMessage = (text, error=false) => { message.textContent=text; message.classList.toggle("error",error); };
  function customerName(row) {
    const c=row.customers||{};
    return c.company || `${c.first_name||""} ${c.last_name||""}`.trim() || row.leads?.name || "Customer";
  }
  function renderMetrics() {
    const month = new Date().toISOString().slice(0,7);
    const booked = cache.opportunities.filter(o=>o.stage==="booked"||o.stage==="completed");
    const active = cache.opportunities.filter(o=>!["completed","lost"].includes(o.stage));
    const revenue = cache.payments.filter(p=>p.entry_type!=="reversal"&&String(p.payment_date||"").startsWith(month)).reduce((s,p)=>s+Number(p.amount||0),0);
    const conversion = cache.opportunities.length ? Math.round(booked.length/cache.opportunities.length*100) : 0;
    metrics.innerHTML = [
      ["Quotes this month",cache.opportunities.filter(o=>String(o.created_at).startsWith(month)).length],
      ["Bookings",booked.length],["Conversion",`${conversion}%`],["Revenue this month",utils.money(revenue)],
      ["Average event value",utils.money(booked.length?booked.reduce((s,o)=>s+Number(o.expected_revenue||0),0)/booked.length:0)],
      ["Pending proposals",cache.proposals.filter(p=>["sent","viewed"].includes(p.status)).length],
      ["Upcoming events",cache.bookings.filter(b=>b.event_date>=new Date().toISOString().slice(0,10)&&b.status!=="Cancelled").length],
      ["Pipeline value",utils.money(active.reduce((s,o)=>s+Number(o.expected_revenue||0),0))]
    ].map(x=>`<article><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></article>`).join("");
  }
  function pipeline() {
    workspace.innerHTML=`<div class="sales-kanban">${utils.stages.map(([key,label])=>`<section class="sales-stage" data-stage="${key}">
      <header><h3>${label}</h3><span>${cache.opportunities.filter(o=>o.stage===key).length}</span></header>
      <div class="sales-stage-list">${cache.opportunities.filter(o=>o.stage===key).map(o=>`<article class="sales-opportunity" draggable="true" data-id="${o.id}">
        <div><strong>${esc(customerName(o))}</strong>${o.priority?'<span class="sales-priority">Priority</span>':""}</div>
        <small>${esc(o.leads?.event_type||"Catering")} · ${utils.money(o.expected_revenue)}</small>
        <small>Follow-up: ${esc(o.follow_up_at?new Date(o.follow_up_at).toLocaleDateString():"Not set")}</small>
        <button type="button" data-edit-opportunity="${o.id}">Details</button></article>`).join("")||'<p class="sales-empty">Drop an opportunity here.</p>'}</div>
    </section>`).join("")}</div>`;
    workspace.querySelectorAll(".sales-opportunity").forEach(card=>card.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",card.dataset.id)));
    workspace.querySelectorAll(".sales-stage").forEach(column=>{
      column.addEventListener("dragover",e=>e.preventDefault());
      column.addEventListener("drop",async e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain");await moveStage(id,column.dataset.stage);});
    });
    workspace.querySelectorAll("[data-edit-opportunity]").forEach(b=>b.addEventListener("click",()=>editOpportunity(b.dataset.editOpportunity)));
  }
  async function moveStage(id, stage) {
    const item=cache.opportunities.find(o=>o.id===id); if(!item||item.stage===stage)return;
    let lost_reason=item.lost_reason||"";
    if(stage==="lost"){lost_reason=prompt("Lost reason (required):",lost_reason)||"";if(!lost_reason.trim())return;}
    try { const updated=await window.salesPlatformService.updateOpportunity(id,{stage,lost_reason});Object.assign(item,updated);setMessage("Stage saved.");render(); }
    catch(error){setMessage(`Could not move opportunity: ${error.message}`,true);}
  }
  async function editOpportunity(id) {
    const o=cache.opportunities.find(x=>x.id===id);
    let history=[];try{history=await window.salesPlatformService.comments(id);}catch(_error){}
    const expected=prompt("Expected revenue:",o.expected_revenue); if(expected===null)return;
    const follow=prompt("Follow-up date (YYYY-MM-DD or blank):",o.follow_up_at?.slice(0,10)||""); if(follow===null)return;
    const staff=prompt("Assigned staff member:",o.assigned_staff||""); if(staff===null)return;
    const notes=prompt("Internal opportunity notes:",o.internal_notes||"");if(notes===null)return;
    const recent=history.slice(0,3).map(x=>`• ${x.body}`).join("\n");
    const note=prompt(`Add internal comment (optional):${recent?`\n\nRecent comments:\n${recent}`:""}`,"");
    try {
      Object.assign(o,await window.salesPlatformService.updateOpportunity(id,{expected_revenue:Math.max(Number(expected)||0,0),follow_up_at:follow?`${follow}T09:00:00`:null,assigned_staff:staff,internal_notes:notes,priority:confirm("Mark as priority?")}));
      if(note?.trim())await window.salesPlatformService.addComment(id,note.trim());
      setMessage("Opportunity updated.");render();
    } catch(error){setMessage(`Could not update opportunity: ${error.message}`,true);}
  }
  function proposals() {
    workspace.innerHTML=`<details id="proposalBuilder" class="sales-builder"><summary>Create proposal</summary>
      <form id="salesProposalForm"><div class="sales-form-grid">
        <label>Quote or booking *<select id="proposalOpportunity" required><option value="">Choose source…</option><optgroup label="Sales opportunities">${cache.opportunities.filter(o=>!["completed","lost"].includes(o.stage)).map(o=>`<option value="opportunity:${o.id}">${esc(customerName(o))} · ${esc(o.leads?.event_type||"Catering")}</option>`).join("")}</optgroup><optgroup label="Bookings">${cache.bookings.filter(b=>b.customer_id).map(b=>`<option value="booking:${b.id}">${esc(b.event_title||b.customer_name)} · ${esc(b.event_date)}</option>`).join("")}</optgroup></select></label>
        <label>Proposal title *<input id="proposalTitle" required value="Catering Proposal"></label>
        <label>Expiration date<input id="proposalExpiration" type="date"></label><label>Tax rate %<input id="proposalTax" type="number" min="0" max="100" step=".01" value="0"></label>
        <label>Discount<input id="proposalDiscount" type="number" min="0" step=".01" value="0"></label>
        <label class="wide">Introduction<textarea id="proposalIntroduction">Thank you for considering 318 Food Co. for your event.</textarea></label>
        <label class="wide">Terms<textarea id="proposalTerms">Final guest count and payment are due according to the agreed event schedule.</textarea></label>
      </div><h3>Menu, packages, and add-ons</h3><div id="proposalLines"></div>
      <div class="sales-builder-actions"><button id="proposalAddLine" class="crm-secondary-button" type="button">Add Item</button><strong id="proposalBuilderTotal">$0.00</strong><button class="save-button" type="submit">Save Proposal</button></div></form></details>
      <div class="sales-table-wrap"><table><thead><tr><th>Proposal</th><th>Customer</th><th>Status</th><th>Expires</th><th>Version</th><th>Actions</th></tr></thead><tbody>
      ${cache.proposals.map(p=>`<tr><td>${esc(p.title)}</td><td>${esc(customerName(p))}</td><td><span class="sales-status">${esc(p.status)}</span></td><td>${esc(p.expiration_date||"—")}</td><td>${p.current_version}</td>
      <td><button data-proposal-status="${p.id}" data-status="sent">Send</button><button data-proposal-copy="${p.id}">Duplicate</button><button data-proposal-pdf="${p.id}">PDF</button></td></tr>`).join("")||'<tr><td colspan="6">No proposals yet.</td></tr>'}
      </tbody></table></div>`;
    const lines=document.getElementById("proposalLines");
    const values=()=>[...lines.querySelectorAll(".proposal-line")].map(r=>({item_type:r.querySelector('[data-field="item_type"]').value,description:r.querySelector('[data-field="description"]').value.trim(),quantity:Number(r.querySelector('[data-field="quantity"]').value),unit_price:Number(r.querySelector('[data-field="unit_price"]').value),taxable:r.querySelector('[data-field="taxable"]').checked}));
    function updateTotal(){const t=utils.proposalTotals(values(),document.getElementById("proposalDiscount").value,document.getElementById("proposalTax").value);document.getElementById("proposalBuilderTotal").textContent=utils.money(t.total);}
    const addLine=(item={item_type:"menu",description:"",quantity:1,unit_price:0,taxable:true})=>{const row=document.createElement("div");row.className="proposal-line";row.innerHTML=`<select data-field="item_type"><option value="menu">Menu</option><option value="package">Package</option><option value="addon">Add-on</option><option value="delivery">Delivery</option><option value="setup">Setup</option><option value="other">Other</option></select><input data-field="description" required placeholder="Description" value="${esc(item.description)}"><input data-field="quantity" type="number" min=".001" step=".001" value="${item.quantity}"><input data-field="unit_price" type="number" min="0" step=".01" value="${item.unit_price}"><label><input data-field="taxable" type="checkbox" ${item.taxable?"checked":""}> Taxable</label><button type="button" aria-label="Remove item">×</button>`;row.querySelector('[data-field="item_type"]').value=item.item_type;row.querySelector("button").onclick=()=>{row.remove();updateTotal();};row.querySelectorAll("input,select").forEach(i=>i.addEventListener("input",updateTotal));lines.appendChild(row);updateTotal();};
    addLine();document.getElementById("proposalAddLine").onclick=()=>addLine();document.getElementById("proposalDiscount").oninput=updateTotal;document.getElementById("proposalTax").oninput=updateTotal;
    document.getElementById("salesProposalForm").onsubmit=async e=>{e.preventDefault();const [kind,id]=document.getElementById("proposalOpportunity").value.split(":"),items=values();let opportunity=kind==="opportunity"?cache.opportunities.find(o=>o.id===id):null,booking=kind==="booking"?cache.bookings.find(b=>String(b.id)===id):null;if((!opportunity&&!booking)||!items.length||items.some(i=>!i.description||i.quantity<=0||i.unit_price<0)){setMessage("Choose a source and complete every line item.",true);return;}try{if(!opportunity){opportunity=cache.opportunities.find(o=>String(o.quote_id)===String(booking.quote_id));if(!opportunity)opportunity=await window.salesPlatformService.createOpportunity({customer_id:booking.customer_id,quote_id:booking.quote_id||null,stage:"contacted",expected_revenue:Number(booking.quote_amount||0)});}await window.salesPlatformService.saveProposal({p_proposal_id:null,p_customer_id:opportunity.customer_id,p_quote_id:opportunity.quote_id,p_booking_id:booking?.id||null,p_opportunity_id:opportunity.id,p_title:document.getElementById("proposalTitle").value.trim(),p_expiration_date:document.getElementById("proposalExpiration").value||null,p_introduction:document.getElementById("proposalIntroduction").value,p_terms:document.getElementById("proposalTerms").value,p_discount:Number(document.getElementById("proposalDiscount").value||0),p_tax_rate:Number(document.getElementById("proposalTax").value||0),p_items:items});await load();setMessage("Proposal saved as version 1.");}catch(error){setMessage(error.message,true);}};
    workspace.querySelectorAll("[data-proposal-status]").forEach(b=>b.onclick=async()=>{try{await window.salesPlatformService.setProposalStatus(b.dataset.proposalStatus,b.dataset.status);await load();setMessage("Proposal status saved.");}catch(e){setMessage(e.message,true);}});
    workspace.querySelectorAll("[data-proposal-copy]").forEach(b=>b.onclick=async()=>{try{await window.salesPlatformService.duplicateProposal(cache.proposals.find(p=>p.id===b.dataset.proposalCopy));await load();setMessage("Proposal duplicated.");}catch(e){setMessage(e.message,true);}});
    workspace.querySelectorAll("[data-proposal-pdf]").forEach(b=>b.onclick=async()=>{try{const {data}=await window.supabaseClient.auth.getSession();const response=await fetch(`/api/proposal-pdf?id=${encodeURIComponent(b.dataset.proposalPdf)}`,{headers:{Authorization:`Bearer ${data.session?.access_token||""}`}});if(!response.ok)throw new Error((await response.json()).error);const url=URL.createObjectURL(await response.blob()),a=document.createElement("a");a.href=url;a.download="318-proposal.pdf";a.click();URL.revokeObjectURL(url);}catch(e){setMessage(e.message,true);}});
  }
  function automation() {
    workspace.innerHTML=`<div class="sales-rule-grid">${cache.rules?.map(r=>`<article><h3>${esc(r.name)}</h3><p>${esc(r.trigger_type.replaceAll("_"," "))} · ${r.delay_days} day(s)</p><label><input type="checkbox" data-rule-toggle="${r.id}" ${r.enabled?"checked":""}> Enabled</label></article>`).join("")||'<p>No automation rules configured. Rules are disabled by default and email-only.</p>'}</div>
    <button id="salesAddRule" class="save-button" type="button">Add Follow-up Rule</button>`;
    workspace.querySelectorAll("[data-rule-toggle]").forEach(i=>i.onchange=async()=>{const r=cache.rules.find(x=>x.id===i.dataset.ruleToggle);try{await window.salesPlatformService.saveRule({...r,enabled:i.checked});setMessage("Automation rule saved.");}catch(e){i.checked=!i.checked;setMessage(e.message,true);}});
    document.getElementById("salesAddRule").onclick=async()=>{const name=prompt("Rule name:");if(!name)return;try{await window.salesPlatformService.saveRule({name,trigger_type:"no_response",delay_days:3,channel:"email",subject_template:"Following up on your catering request",body_template:"We would love to help with your event.",enabled:false});await load();}catch(e){setMessage(e.message,true);}};
  }
  function reports() {
    const byStage=utils.stages.map(([key,label])=>[label,cache.opportunities.filter(o=>o.stage===key).length]);
    const packageCounts={};cache.proposals.forEach(p=>(p.proposal_versions||[]).forEach(v=>{packageCounts[p.title]=(packageCounts[p.title]||0)+1;}));
    const maximum=Math.max(...byStage.map(x=>x[1]),1);
    workspace.innerHTML=`<div class="sales-report-grid"><section><h3>Sales funnel</h3>${byStage.map(x=>`<div class="sales-bar"><span>${esc(x[0])}</span><progress value="${x[1]}" max="${maximum}" aria-label="${esc(x[0])}: ${x[1]}">${x[1]}</progress><b>${x[1]}</b></div>`).join("")}</section>
    <section><h3>Revenue by month</h3><p class="sales-report-value">${utils.money(cache.payments.filter(p=>p.entry_type!=="reversal").reduce((s,p)=>s+Number(p.amount||0),0))}</p><small>Recorded lifetime payments</small></section>
    <section><h3>Proposal win rate</h3><p class="sales-report-value">${cache.proposals.length?Math.round(cache.proposals.filter(p=>p.status==="approved").length/cache.proposals.length*100):0}%</p></section>
    <section><h3>Top packages</h3>${Object.entries(packageCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>`<p>${esc(x[0])} <strong>${x[1]}</strong></p>`).join("")||"<p>No proposal data yet.</p>"}</section></div>`;
  }
  function tools() {
    workspace.innerHTML=`<div class="sales-tools"><section><h3>Global customer search</h3><input id="salesCustomerSearch" type="search" placeholder="Name, company, email, phone, or address"><div id="salesCustomerResults"></div></section>
    <section><h3>Merge duplicate customers</h3><p>This preserves history by moving related records to the retained customer and archiving the duplicate.</p><select id="mergeKeep"><option value="">Keep customer…</option>${cache.customers.map(c=>`<option value="${c.id}">${esc(c.company||`${c.first_name} ${c.last_name}`)}</option>`).join("")}</select><select id="mergeRemove"><option value="">Archive duplicate…</option>${cache.customers.map(c=>`<option value="${c.id}">${esc(c.company||`${c.first_name} ${c.last_name}`)}</option>`).join("")}</select><button id="mergeCustomersButton" class="save-button" type="button">Merge Records</button></section>
    <section><h3>Customer portal</h3><select id="portalCustomer"><option value="">Choose customer…</option>${cache.customers.filter(c=>!c.archived).map(c=>`<option value="${c.id}">${esc(c.company||`${c.first_name} ${c.last_name}`)}</option>`).join("")}</select><button id="createPortalButton" class="crm-secondary-button" type="button">Create 30-day Portal Link</button><input id="portalLinkOutput" readonly aria-label="Generated portal link"></section></div>`;
    const search=document.getElementById("salesCustomerSearch"),results=document.getElementById("salesCustomerResults");
    search.oninput=()=>{const q=search.value.toLowerCase();results.innerHTML=cache.customers.filter(c=>JSON.stringify(c).toLowerCase().includes(q)).slice(0,20).map(c=>`<p><strong>${esc(c.company||`${c.first_name} ${c.last_name}`)}</strong> · ${esc(c.email||c.phone)}</p>`).join("");};
    document.getElementById("mergeCustomersButton").onclick=async()=>{const keep=document.getElementById("mergeKeep").value,remove=document.getElementById("mergeRemove").value;if(!keep||!remove||keep===remove){setMessage("Choose two different customers.",true);return;}if(!confirm("Merge and archive the duplicate? This cannot be undone in the admin."))return;try{await window.salesPlatformService.mergeCustomers(keep,remove);await load();setMessage("Customer records merged.");}catch(e){setMessage(e.message,true);}};
    document.getElementById("createPortalButton").onclick=async()=>{const id=document.getElementById("portalCustomer").value;if(!id)return;try{document.getElementById("portalLinkOutput").value=await window.salesPlatformService.createPortalLink(id);setMessage("Portal link created. It is shown only once.");}catch(e){setMessage(e.message,true);}};
  }
  function render() { renderMetrics(); ({pipeline,proposals,automation,reports,tools}[view])();workspace.setAttribute("aria-busy","false"); }
  async function load() {
    workspace.setAttribute("aria-busy","true");setMessage("Loading sales platform…");
    try { cache=await window.salesPlatformService.financials();cache.rules=await window.salesPlatformService.rules();cache.customers=await window.salesPlatformService.customers();render();setMessage(""); }
    catch(error){workspace.innerHTML='<div class="sales-empty-state"><h3>Sales platform unavailable</h3><p>Apply the Release 3 migration to this environment, then try again.</p></div>';setMessage(error.message,true);}
  }
  panel.querySelectorAll("[data-sales-view]").forEach(button=>button.onclick=()=>{view=button.dataset.salesView;panel.querySelectorAll("[data-sales-view]").forEach(b=>b.classList.toggle("active",b===button));render();});
  document.getElementById("salesExportButton").onclick=()=>{const blob=new Blob([utils.csv(cache.customers)],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`318-customers-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);};
  document.getElementById("salesNewProposalButton").onclick=()=>{view="proposals";panel.querySelectorAll("[data-sales-view]").forEach(b=>b.classList.toggle("active",b.dataset.salesView==="proposals"));render();document.getElementById("proposalBuilder").open=true;document.getElementById("proposalOpportunity").focus();};
  document.addEventListener("click",e=>{if(e.target.closest('[data-panel="salesPlatformPanel"],[data-open-panel="salesPlatformPanel"]'))load();});
})();
