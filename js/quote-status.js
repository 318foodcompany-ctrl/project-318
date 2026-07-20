(function () {
  "use strict";

  async function update(client, id, status) {
    if (!client) throw new Error("Supabase is unavailable.");

    const { data, error } = await client
      .from("leads")
      .update({ status })
      .eq("id", id)
      .select("id,status");

    if (error) throw error;

    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error(
        "Quote status was not saved. Check administrator permissions and try again."
      );
    }

    return data[0];
  }

  window.quoteStatusService = { update };

  const money = (value) => Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  const normalizedQuoteStatus = (status) => {
    if (status === "Quote Sent") return "Proposal Sent";
    if (status === "Lost") return "Closed";
    return status || "New";
  };

  const effectiveInvoiceStatus = (invoice) => {
    if (invoice.lifecycle_status === "void") return "void";
    if (invoice.lifecycle_status === "draft") return "draft";
    if (Number(invoice.balance_due || 0) === 0) return "paid";
    if (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)) return "overdue";
    if (Number(invoice.paid_amount || 0) > 0) return "partially_paid";
    return "sent";
  };

  function addCommandCenterStyles() {
    if (document.getElementById("commandCenterStyles")) return;
    const style = document.createElement("style");
    style.id = "commandCenterStyles";
    style.textContent = `
      .cc-shell{display:grid;gap:20px}.cc-hero{position:relative;overflow:hidden;padding:28px;border-radius:24px;background:linear-gradient(135deg,#111 0%,#292929 68%,#e21b23 160%);color:#fff;box-shadow:0 18px 48px rgba(17,17,17,.18)}
      .cc-hero:after{content:"";position:absolute;width:240px;height:240px;right:-80px;top:-110px;border-radius:50%;background:rgba(255,255,255,.08)}.cc-hero-row{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.cc-eyebrow{margin:0 0 8px;color:#ffb7ba;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.cc-hero h2{margin:0;font-size:clamp(26px,4vw,40px);letter-spacing:-.04em}.cc-hero-copy{max-width:650px;margin:10px 0 0;color:#ddd;line-height:1.55}.cc-date{white-space:nowrap;padding:10px 13px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.08);font-size:13px;font-weight:700}
      .cc-actions{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.cc-button{border:0;border-radius:12px;padding:11px 14px;font-weight:800}.cc-button-primary{background:#e21b23;color:#fff}.cc-button-light{background:#fff;color:#111}.cc-button-ghost{border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff}
      .cc-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.cc-metric{position:relative;padding:20px;border:1px solid #e4e4e1;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.045);transition:transform .18s ease,box-shadow .18s ease}.cc-metric:hover{transform:translateY(-2px);box-shadow:0 13px 32px rgba(0,0,0,.08)}.cc-metric-label{display:block;color:#666;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.cc-metric-value{display:block;margin-top:8px;font-size:30px;letter-spacing:-.04em}.cc-metric-note{display:block;margin-top:6px;color:#777;font-size:12px}.cc-metric.alert{border-color:#f1c8c8;background:#fffafa}.cc-metric.good{border-color:#cce6d8;background:#fafffc}
      .cc-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:18px}.cc-panel{padding:22px;border:1px solid #e2e2df;border-radius:20px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.045)}.cc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:15px}.cc-panel-head h3{margin:0;font-size:18px}.cc-panel-head button{border:0;background:transparent;color:#b4141b;font-weight:800}.cc-list{display:grid;gap:10px}.cc-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px;border:1px solid #ececea;border-radius:14px;background:#fcfcfb}.cc-item-icon{display:grid;width:40px;height:40px;place-items:center;border-radius:12px;background:#f1f1ef;font-size:18px}.cc-item strong,.cc-item span{display:block}.cc-item span{margin-top:3px;color:#777;font-size:12px}.cc-item button{border:0;border-radius:10px;padding:8px 10px;background:#111;color:#fff;font-size:12px;font-weight:800}.cc-empty{padding:24px;border:1px dashed #d8d8d4;border-radius:14px;color:#777;text-align:center}.cc-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cc-quick{min-height:100px;padding:16px;border:1px solid #e5e5e2;border-radius:16px;background:#fafaf8;text-align:left;transition:.18s ease}.cc-quick:hover{transform:translateY(-2px);border-color:#bbb;background:#fff}.cc-quick b{display:block;margin-top:8px}.cc-quick small{display:block;margin-top:5px;color:#777;line-height:1.35}.cc-loading{padding:28px;border-radius:18px;background:linear-gradient(90deg,#f1f1ef 25%,#fafafa 50%,#f1f1ef 75%);background-size:200% 100%;animation:cc-shimmer 1.2s infinite}@keyframes cc-shimmer{to{background-position:-200% 0}}
      @media(max-width:980px){.cc-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.cc-grid{grid-template-columns:1fr}}@media(max-width:640px){.cc-hero{padding:22px}.cc-hero-row{display:block}.cc-date{display:inline-block;margin-top:14px}.cc-metrics{grid-template-columns:1fr 1fr}.cc-metric{padding:16px}.cc-metric-value{font-size:25px}.cc-item{grid-template-columns:auto minmax(0,1fr)}.cc-item button{grid-column:1/-1;width:100%}.cc-quick-grid{grid-template-columns:1fr}.content{width:min(100% - 24px,1100px)}}
      @media(prefers-reduced-motion:reduce){.cc-metric,.cc-quick{transition:none}.cc-loading{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function openPanel(panelId) {
    if (typeof window.showPanel === "function") window.showPanel(panelId);
    else {
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === panelId));
      document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.panel === panelId));
    }
  }

  function commandItem(icon, title, detail, panelId, buttonText) {
    return `<div class="cc-item"><div class="cc-item-icon" aria-hidden="true">${icon}</div><div><strong>${title}</strong><span>${detail}</span></div><button type="button" data-cc-panel="${panelId}">${buttonText}</button></div>`;
  }

  async function loadCommandCenter() {
    const panel = document.getElementById("dashboardPanel");
    if (!panel || typeof supabaseClient === "undefined" || !supabaseClient) return;
    addCommandCenterStyles();
    panel.innerHTML = `<div class="cc-shell"><div class="cc-loading" aria-label="Loading business command center"></div><div class="cc-loading"></div></div>`;

    const [leadsResult, bookingsResult, invoicesResult] = await Promise.all([
      supabaseClient.from("leads").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("bookings").select("*").order("event_date", { ascending: true }),
      supabaseClient.from("invoices").select("*").order("created_at", { ascending: false })
    ]);

    const leads = leadsResult.data || [];
    const bookings = bookingsResult.data || [];
    const invoices = invoicesResult.data || [];
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const futureKey = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    const currentMonth = todayKey.slice(0, 7);

    const newLeads = leads.filter((lead) => normalizedQuoteStatus(lead.status) === "New");
    const proposals = leads.filter((lead) => normalizedQuoteStatus(lead.status) === "Proposal Sent");
    const openLeads = leads.filter((lead) => !["Booked", "Closed", "Cancelled"].includes(normalizedQuoteStatus(lead.status)));
    const pipelineValue = openLeads.reduce((sum, lead) => sum + Number(lead.budget || 0), 0);
    const upcomingBookings = bookings.filter((booking) => booking.event_date >= todayKey && booking.event_date <= futureKey && booking.status !== "Cancelled");
    const monthBooked = bookings.filter((booking) => String(booking.event_date || "").startsWith(currentMonth) && booking.status !== "Cancelled").reduce((sum, booking) => sum + Number(booking.quote_amount || 0), 0);
    const overdueInvoices = invoices.filter((invoice) => effectiveInvoiceStatus(invoice) === "overdue");
    const outstanding = invoices.filter((invoice) => !["void", "paid", "draft"].includes(effectiveInvoiceStatus(invoice))).reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0);

    const priorityItems = [];
    newLeads.slice(0, 3).forEach((lead) => priorityItems.push(commandItem("✦", lead.name || "New quote request", `${lead.company || "No company"} · ${lead.guests || "—"} guests · ${money(lead.budget)}`, "leadsPanel", "Review")));
    overdueInvoices.slice(0, 2).forEach((invoice) => priorityItems.push(commandItem("!", invoice.invoice_number || "Overdue invoice", `${money(invoice.balance_due)} outstanding · due ${invoice.due_date || "date unavailable"}`, "invoicesPanel", "Open")));
    upcomingBookings.slice(0, 3).forEach((booking) => priorityItems.push(commandItem("◆", booking.event_title || booking.customer_name || "Upcoming booking", `${booking.event_date} · ${booking.guest_count || "—"} guests · ${booking.status}`, "bookingsPanel", "View")));

    const greetingHour = today.getHours();
    const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";
    panel.innerHTML = `
      <div class="cc-shell">
        <section class="cc-hero">
          <div class="cc-hero-row"><div><p class="cc-eyebrow">318 Food Co. Command Center</p><h2>${greeting}. Here’s what needs attention.</h2><p class="cc-hero-copy">Your leads, events, customers, and money are organized into one daily operating view.</p></div><div class="cc-date">${today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div></div>
          <div class="cc-actions"><button class="cc-button cc-button-primary" data-cc-panel="leadsPanel">Open Sales Pipeline</button><button class="cc-button cc-button-light" data-cc-action="new-booking">+ New Booking</button><button class="cc-button cc-button-ghost" data-cc-action="new-invoice">+ New Invoice</button></div>
        </section>
        <section class="cc-metrics" aria-label="Business overview">
          <button class="cc-metric ${newLeads.length ? "alert" : "good"}" data-cc-panel="leadsPanel"><span class="cc-metric-label">New leads</span><strong class="cc-metric-value">${newLeads.length}</strong><span class="cc-metric-note">Waiting for first contact</span></button>
          <button class="cc-metric" data-cc-panel="leadsPanel"><span class="cc-metric-label">Pipeline value</span><strong class="cc-metric-value">${money(pipelineValue)}</strong><span class="cc-metric-note">${openLeads.length} active opportunities</span></button>
          <button class="cc-metric" data-cc-panel="bookingsPanel"><span class="cc-metric-label">Booked this month</span><strong class="cc-metric-value">${money(monthBooked)}</strong><span class="cc-metric-note">${bookings.filter((b) => String(b.event_date || "").startsWith(currentMonth) && b.status !== "Cancelled").length} events</span></button>
          <button class="cc-metric ${overdueInvoices.length ? "alert" : "good"}" data-cc-panel="invoicesPanel"><span class="cc-metric-label">Outstanding</span><strong class="cc-metric-value">${money(outstanding)}</strong><span class="cc-metric-note">${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"}</span></button>
        </section>
        <section class="cc-grid">
          <div class="cc-panel"><div class="cc-panel-head"><h3>Today’s priorities</h3><button type="button" data-cc-panel="leadsPanel">View pipeline →</button></div><div class="cc-list">${priorityItems.length ? priorityItems.join("") : '<div class="cc-empty"><strong>You’re caught up.</strong><br>No urgent leads, bookings, or invoices need attention.</div>'}</div></div>
          <div class="cc-panel"><div class="cc-panel-head"><h3>Quick actions</h3></div><div class="cc-quick-grid">
            <button class="cc-quick" data-cc-panel="leadsPanel"><span aria-hidden="true">▦</span><b>Sales Pipeline</b><small>${proposals.length} proposal${proposals.length === 1 ? "" : "s"} awaiting a decision</small></button>
            <button class="cc-quick" data-cc-action="new-booking"><span aria-hidden="true">＋</span><b>New Booking</b><small>Add an event directly to the calendar</small></button>
            <button class="cc-quick" data-cc-action="new-invoice"><span aria-hidden="true">＄</span><b>New Invoice</b><small>Create a draft and add line items</small></button>
            <button class="cc-quick" data-cc-panel="customersPanel"><span aria-hidden="true">◎</span><b>Find Customer</b><small>Open history, events, and balances</small></button>
            <button class="cc-quick" data-cc-panel="photosPanel"><span aria-hidden="true">▧</span><b>Update Website</b><small>Change photos and public content</small></button>
            <button class="cc-quick" data-cc-action="preview"><span aria-hidden="true">↗</span><b>Preview Site</b><small>See the live customer experience</small></button>
          </div></div>
        </section>
      </div>`;

    panel.addEventListener("click", (event) => {
      const panelButton = event.target.closest("[data-cc-panel]");
      if (panelButton) openPanel(panelButton.dataset.ccPanel);
      const actionButton = event.target.closest("[data-cc-action]");
      if (!actionButton) return;
      if (actionButton.dataset.ccAction === "new-booking") {
        openPanel("bookingsPanel");
        setTimeout(() => document.getElementById("newBookingButton")?.click(), 0);
      } else if (actionButton.dataset.ccAction === "new-invoice") {
        openPanel("invoicesPanel");
        setTimeout(() => document.getElementById("newInvoiceButton")?.click(), 0);
      } else if (actionButton.dataset.ccAction === "preview") {
        window.open("index.html", "_blank", "noopener");
      }
    }, { once: true });
  }

  function startCommandCenter() {
    const waitForClient = setInterval(() => {
      if (typeof supabaseClient !== "undefined" && supabaseClient) {
        clearInterval(waitForClient);
        loadCommandCenter().catch((error) => {
          console.error("Command center failed to load:", error);
          const panel = document.getElementById("dashboardPanel");
          if (panel) panel.innerHTML = '<div class="card"><h2>Dashboard unavailable</h2><p>Refresh the page or open a section from the navigation.</p></div>';
        });
      }
    }, 100);
    setTimeout(() => clearInterval(waitForClient), 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startCommandCenter);
  else startCommandCenter();
})();