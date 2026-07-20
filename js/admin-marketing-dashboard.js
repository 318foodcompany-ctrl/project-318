(function () {
  "use strict";

  const panelId = "marketingPanel";
  const money = (value) => Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
  const escapeHTML = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalizedStatus = (status) => status === "Quote Sent" ? "Proposal Sent" : status === "Lost" ? "Closed" : (status || "New");
  let state = { leads: [], bookings: [], revenue: [], start: "", end: "", source: "", campaign: "" };

  function addStyles() {
    if (document.getElementById("marketingDashboardStyles")) return;
    const style = document.createElement("style");
    style.id = "marketingDashboardStyles";
    style.textContent = `
      .mk-shell{display:grid;gap:18px}.mk-hero{padding:26px;border-radius:24px;background:linear-gradient(135deg,#171717,#333);color:#fff;box-shadow:0 16px 42px rgba(0,0,0,.16)}.mk-hero h2{margin:0;font-size:clamp(25px,4vw,38px);letter-spacing:-.04em}.mk-hero p{max-width:720px;margin:9px 0 0;color:#d7d7d7;line-height:1.55}
      .mk-filters{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr)) auto;gap:10px;align-items:end;padding:18px;border:1px solid var(--border);border-radius:18px;background:#fff}.mk-filters label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:800}.mk-filters input,.mk-filters select{width:100%;padding:11px;border:1px solid #ccc;border-radius:10px;background:#fff}.mk-button{padding:11px 14px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:800}
      .mk-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.mk-card{padding:18px;border:1px solid #e3e3df;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.045)}.mk-card span{display:block;color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase}.mk-card strong{display:block;margin-top:8px;font-size:27px;letter-spacing:-.04em}.mk-card small{display:block;margin-top:5px;color:#777}
      .mk-funnel{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:10px;align-items:stretch}.mk-stage{position:relative;padding:20px 16px;border-radius:17px;background:#fff;border:1px solid #e1e1dd;text-align:center}.mk-stage:not(:last-child):after{content:"→";position:absolute;right:-12px;top:50%;z-index:2;display:grid;width:24px;height:24px;place-items:center;border-radius:50%;background:#111;color:#fff;transform:translateY(-50%)}.mk-stage b{display:block;font-size:27px}.mk-stage span{display:block;margin-top:5px;color:#666;font-size:12px;font-weight:800;text-transform:uppercase}.mk-stage small{display:block;margin-top:7px;color:#888}
      .mk-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:18px}.mk-panel{padding:20px;border:1px solid var(--border);border-radius:18px;background:#fff}.mk-panel h3{margin:0 0 14px}.mk-table-wrap{overflow-x:auto}.mk-table{width:100%;border-collapse:collapse;min-width:650px}.mk-table th,.mk-table td{padding:11px 9px;border-bottom:1px solid #eee;text-align:left}.mk-table th{color:#666;font-size:11px;text-transform:uppercase}.mk-bar{height:8px;overflow:hidden;border-radius:999px;background:#eee}.mk-bar i{display:block;height:100%;border-radius:inherit;background:#e21b23}.mk-empty{padding:28px;border:1px dashed #d6d6d1;border-radius:14px;color:#777;text-align:center;line-height:1.5}.mk-note{padding:14px;border-radius:13px;background:#f5f5f2;color:#666;font-size:13px;line-height:1.5}.mk-spend{display:grid;gap:10px}.mk-spend label{display:grid;gap:6px;font-weight:700}.mk-spend input{padding:11px;border:1px solid #ccc;border-radius:10px}.mk-loading{padding:34px;border-radius:16px;background:linear-gradient(90deg,#eee 25%,#fafafa 50%,#eee 75%);background-size:200% 100%;animation:mk-shimmer 1.2s infinite}@keyframes mk-shimmer{to{background-position:-200% 0}}
      @media(max-width:1000px){.mk-metrics{grid-template-columns:repeat(2,1fr)}.mk-funnel{grid-template-columns:1fr}.mk-stage:not(:last-child):after{content:"↓";right:50%;top:auto;bottom:-17px;transform:translateX(50%)}.mk-grid{grid-template-columns:1fr}.mk-filters{grid-template-columns:1fr 1fr}}
      @media(max-width:620px){.mk-metrics,.mk-filters{grid-template-columns:1fr}.mk-card strong{font-size:24px}.mk-hero{padding:22px}}
      @media(prefers-reduced-motion:reduce){.mk-loading{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function installPanel() {
    if (document.getElementById(panelId)) return;
    const customersButton = document.querySelector('[data-panel="customersPanel"]');
    const nav = customersButton?.parentElement;
    if (nav) {
      const button = document.createElement("button");
      button.className = "nav-button";
      button.dataset.panel = panelId;
      button.textContent = "Marketing Analytics";
      nav.insertBefore(button, document.getElementById("logoutButton"));
      button.addEventListener("click", () => window.showPanel ? window.showPanel(panelId) : showPanel(panelId));
    }
    const content = document.querySelector(".content");
    const panel = document.createElement("section");
    panel.id = panelId;
    panel.className = "panel";
    panel.innerHTML = '<div class="mk-loading">Loading marketing dashboard…</div>';
    content.appendChild(panel);
  }

  function dateRangeDefaults() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 90);
    state.start = start.toISOString().slice(0, 10);
    state.end = end.toISOString().slice(0, 10);
  }

  function touch(lead) {
    const item = lead.marketing_last_touchpoint || lead.marketing_first_touchpoint || {};
    return { source: item.source || "unattributed", medium: item.medium || "(none)", campaign: item.campaign || "" };
  }

  function filteredLeads() {
    return state.leads.filter((lead) => {
      const created = String(lead.created_at || "").slice(0, 10);
      const attribution = touch(lead);
      return (!state.start || created >= state.start) && (!state.end || created <= state.end)
        && (!state.source || attribution.source === state.source)
        && (!state.campaign || attribution.campaign === state.campaign);
    });
  }

  function filteredBookings(leads) {
    const ids = new Set(leads.map((lead) => String(lead.id)));
    return state.bookings.filter((booking) => booking.quote_id && ids.has(String(booking.quote_id)));
  }

  function render() {
    const panel = document.getElementById(panelId);
    const leads = filteredLeads();
    const bookings = filteredBookings(leads);
    const proposals = leads.filter((lead) => ["Proposal Sent", "Booked"].includes(normalizedStatus(lead.status)));
    const booked = leads.filter((lead) => normalizedStatus(lead.status) === "Booked");
    const completed = bookings.filter((booking) => booking.status === "Completed");
    const pipelineValue = leads.filter((lead) => !["Booked", "Closed", "Cancelled"].includes(normalizedStatus(lead.status))).reduce((sum, lead) => sum + Number(lead.budget || 0), 0);
    const bookedRevenue = bookings.filter((booking) => booking.status !== "Cancelled").reduce((sum, booking) => sum + Number(booking.quote_amount || 0), 0);
    const conversion = leads.length ? booked.length / leads.length * 100 : 0;
    const sources = [...new Set(state.leads.map((lead) => touch(lead).source))].sort();
    const campaigns = [...new Set(state.leads.map((lead) => touch(lead).campaign).filter(Boolean))].sort();
    const sourceMap = new Map();
    leads.forEach((lead) => {
      const a = touch(lead); const key = `${a.source}|${a.medium}|${a.campaign}`;
      const row = sourceMap.get(key) || { ...a, leads: 0, booked: 0, value: 0 };
      row.leads += 1; row.value += Number(lead.budget || 0); if (normalizedStatus(lead.status) === "Booked") row.booked += 1;
      sourceMap.set(key, row);
    });
    const rows = [...sourceMap.values()].sort((a, b) => b.leads - a.leads);
    const adSpend = Number(localStorage.getItem("318_marketing_spend") || 0);
    const cpl = leads.length && adSpend ? adSpend / leads.length : 0;

    panel.innerHTML = `<div class="mk-shell">
      <section class="mk-hero"><h2>Marketing & Sales Funnel</h2><p>See which sources create quote requests, bookings, and revenue. This view uses your first-party quote attribution and business records.</p></section>
      <section class="mk-filters">
        <label>Start date<input id="mkStart" type="date" value="${escapeHTML(state.start)}"></label>
        <label>End date<input id="mkEnd" type="date" value="${escapeHTML(state.end)}"></label>
        <label>Source<select id="mkSource"><option value="">All sources</option>${sources.map((x) => `<option ${x === state.source ? "selected" : ""}>${escapeHTML(x)}</option>`).join("")}</select></label>
        <label>Campaign<select id="mkCampaign"><option value="">All campaigns</option>${campaigns.map((x) => `<option ${x === state.campaign ? "selected" : ""}>${escapeHTML(x)}</option>`).join("")}</select></label>
        <button id="mkReset" class="mk-button" type="button">Reset</button>
      </section>
      <section class="mk-metrics">
        <div class="mk-card"><span>Quote requests</span><strong>${leads.length}</strong><small>Within the selected period</small></div>
        <div class="mk-card"><span>Booking conversion</span><strong>${pct(conversion)}</strong><small>${booked.length} booked opportunities</small></div>
        <div class="mk-card"><span>Pipeline value</span><strong>${money(pipelineValue)}</strong><small>Open quoted opportunity value</small></div>
        <div class="mk-card"><span>Booked revenue</span><strong>${money(bookedRevenue)}</strong><small>Calendar quote amounts, excluding cancelled</small></div>
      </section>
      <section class="mk-funnel" aria-label="Sales funnel">
        <div class="mk-stage"><b>${leads.length}</b><span>Quotes</span><small>100%</small></div>
        <div class="mk-stage"><b>${proposals.length}</b><span>Proposal reached</span><small>${leads.length ? pct(proposals.length / leads.length * 100) : "0%"}</small></div>
        <div class="mk-stage"><b>${booked.length}</b><span>Booked</span><small>${leads.length ? pct(booked.length / leads.length * 100) : "0%"}</small></div>
        <div class="mk-stage"><b>${completed.length}</b><span>Completed</span><small>${booked.length ? pct(completed.length / booked.length * 100) : "0%"}</small></div>
        <div class="mk-stage"><b>${money(state.revenue.reduce((sum, row) => sum + Number(row.revenue || 0), 0))}</b><span>Collected</span><small>Attributed payments</small></div>
      </section>
      <section class="mk-grid">
        <div class="mk-panel"><h3>Source and campaign performance</h3>${rows.length ? `<div class="mk-table-wrap"><table class="mk-table"><thead><tr><th>Source</th><th>Campaign</th><th>Leads</th><th>Booked</th><th>Conversion</th><th>Quoted value</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHTML(row.source)}</strong><br><small>${escapeHTML(row.medium)}</small></td><td>${escapeHTML(row.campaign || "—")}</td><td>${row.leads}</td><td>${row.booked}</td><td>${pct(row.leads ? row.booked / row.leads * 100 : 0)}</td><td>${money(row.value)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="mk-empty">No attributed quote requests match these filters yet.<br>Use UTM-tagged campaign links to begin separating Facebook, Google, email, and other sources.</div>'}</div>
        <div class="mk-panel"><h3>Ad spend planning</h3><div class="mk-spend"><label>Ad spend for this selected period<input id="mkSpend" type="number" min="0" step="0.01" value="${adSpend || ""}" placeholder="0.00"></label><div class="mk-card"><span>Estimated cost per lead</span><strong>${adSpend && leads.length ? money(cpl) : "—"}</strong><small>Spend ÷ quote requests</small></div></div><div class="mk-note">This spend field is a private browser planning value and is not imported from Meta or Google Ads yet. It does not change accounting records.</div></div>
      </section>
      <div class="mk-note"><strong>What the data means:</strong> first-party attribution is saved when someone submits a quote. Anonymous visitors who never submit are not permanently stored here, so complete visit-to-lead conversion requires GA4. Direct and unattributed leads remain visible instead of being hidden.</div>
    </div>`;

    [["mkStart", "start"], ["mkEnd", "end"], ["mkSource", "source"], ["mkCampaign", "campaign"]].forEach(([id, key]) => document.getElementById(id).addEventListener("change", (event) => { state[key] = event.target.value; loadRevenue().then(render); }));
    document.getElementById("mkReset").addEventListener("click", () => { dateRangeDefaults(); state.source = ""; state.campaign = ""; loadRevenue().then(render); });
    document.getElementById("mkSpend").addEventListener("input", (event) => { localStorage.setItem("318_marketing_spend", event.target.value); const value = Number(event.target.value || 0); event.target.closest(".mk-panel").querySelector(".mk-card strong").textContent = value && leads.length ? money(value / leads.length) : "—"; });
  }

  async function loadRevenue() {
    const { data, error } = await supabaseClient.rpc("marketing_revenue_attribution", { p_start: state.start, p_end: state.end, p_model: "last_non_direct" });
    state.revenue = error ? [] : (data || []);
  }

  async function load() {
    const panel = document.getElementById(panelId);
    panel.innerHTML = '<div class="mk-loading">Loading marketing and sales data…</div>';
    try {
      const [leadResult, bookingResult] = await Promise.all([
        supabaseClient.from("leads").select("id,created_at,status,budget,marketing_first_touchpoint:marketing_first_touchpoint_id(source,medium,campaign),marketing_last_touchpoint:marketing_last_touchpoint_id(source,medium,campaign)").order("created_at", { ascending: false }),
        supabaseClient.from("bookings").select("id,quote_id,status,quote_amount,event_date")
      ]);
      if (leadResult.error) throw leadResult.error;
      if (bookingResult.error) throw bookingResult.error;
      state.leads = leadResult.data || [];
      state.bookings = bookingResult.data || [];
      await loadRevenue();
      render();
    } catch (error) {
      console.error("Marketing dashboard load failed:", error);
      panel.innerHTML = `<div class="mk-empty"><strong>Marketing analytics could not be loaded.</strong><br>${escapeHTML(error.message)}<br><br>Confirm the production marketing-attribution migration is applied.</div>`;
    }
  }

  addStyles();
  installPanel();
  dateRangeDefaults();
  load();
})();