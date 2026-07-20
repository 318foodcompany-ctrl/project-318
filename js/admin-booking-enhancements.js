(function () {
  "use strict";

  const calendar = document.getElementById("bookingCalendar");
  const switcher = document.querySelector(".booking-view-switcher");
  const modal = document.getElementById("bookingModal");
  if (!calendar || !switcher || !modal) return;

  let records = [];
  let agendaActive = false;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const money = (value) => Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Date TBD";
  const formatTime = (value) => {
    if (!value) return "Time TBD";
    const [hour, minute] = String(value).split(":").map(Number);
    return new Date(2000, 0, 1, hour, minute || 0).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  function injectStyles() {
    if (document.getElementById("bookingEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "bookingEnhancementStyles";
    style.textContent = `
      .booking-event{position:relative;overflow:hidden;box-shadow:0 4px 12px rgba(17,17,17,.06);transition:transform .16s ease,box-shadow .16s ease}.booking-event:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(17,17,17,.11)}
      .booking-event-meta{display:flex!important;flex-wrap:wrap;gap:4px 8px;margin-top:5px!important;opacity:.82}.booking-event-meta span{white-space:nowrap}
      .booking-agenda{display:grid;gap:12px}.booking-agenda-day{border:1px solid #e2e2df;border-radius:18px;background:#fff;overflow:hidden}.booking-agenda-date{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#f7f7f5}.booking-agenda-date h4{margin:0}.booking-agenda-date span{color:#6b6b6b;font-size:12px;font-weight:700}
      .booking-agenda-list{display:grid;gap:0}.booking-agenda-item{display:grid;grid-template-columns:90px minmax(0,1fr) auto;gap:14px;align-items:center;padding:15px 16px;border:0;border-top:1px solid #ececea;background:#fff;text-align:left}.booking-agenda-item:hover{background:#fffafa}.booking-agenda-time{font-weight:800}.booking-agenda-main strong,.booking-agenda-main span{display:block}.booking-agenda-main span{margin-top:4px;color:#6b6b6b;font-size:12px}.booking-agenda-side{text-align:right}.booking-agenda-side strong,.booking-agenda-side small{display:block}.booking-agenda-side small{margin-top:4px;color:#6b6b6b}
      .booking-status-pill{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase}.booking-status-pill.pending{background:#fff1c7;color:#714600}.booking-status-pill.confirmed{background:#e6f0ff;color:#174a91}.booking-status-pill.completed{background:#e4f6ec;color:#17603a}.booking-status-pill.cancelled{background:#ececee;color:#555}
      .booking-record-links{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px;padding:12px;border-radius:14px;background:#f7f7f5}.booking-record-links button,.booking-record-links a{padding:9px 11px;border:1px solid #d9d9d6;border-radius:10px;background:#fff;color:#111;text-decoration:none;font-weight:700}.booking-record-links button:hover,.booking-record-links a:hover{border-color:#e21b23}
      @media(max-width:640px){.booking-agenda-item{grid-template-columns:1fr}.booking-agenda-side{text-align:left}.booking-agenda-time{font-size:12px}.booking-view-switcher{overflow-x:auto}.booking-view-switcher button{white-space:nowrap}}
      @media(prefers-reduced-motion:reduce){.booking-event{transition:none}}
    `;
    document.head.appendChild(style);
  }

  async function loadRecords() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    const { data, error } = await supabaseClient.from("bookings").select("*").order("event_date", { ascending: true });
    if (!error) records = data || [];
  }

  function activeRecords() {
    const search = String(document.getElementById("bookingSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("bookingStatusFilter")?.value || "";
    const type = document.getElementById("bookingEventTypeFilter")?.value || "";
    const month = document.getElementById("bookingMonthFilter")?.value || "";
    return records.filter((item) => {
      const haystack = [item.customer_name, item.company_name, item.event_title, item.venue_name].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) && (!status || item.status === status) && (!type || item.event_type === type) && (!month || String(item.event_date || "").startsWith(month));
    });
  }

  function renderAgenda() {
    agendaActive = true;
    switcher.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.bookingView === "agenda"));
    const today = new Date().toISOString().slice(0, 10);
    const rows = activeRecords().filter((item) => item.event_date >= today && item.status !== "Cancelled");
    const grouped = rows.reduce((map, item) => {
      (map[item.event_date] ||= []).push(item);
      return map;
    }, {});
    const dates = Object.keys(grouped).sort();
    calendar.innerHTML = dates.length ? `<div class="booking-agenda">${dates.map((date) => `
      <section class="booking-agenda-day">
        <div class="booking-agenda-date"><h4>${esc(formatDate(date))}</h4><span>${grouped[date].length} event${grouped[date].length === 1 ? "" : "s"}</span></div>
        <div class="booking-agenda-list">${grouped[date].map((item) => `
          <button class="booking-agenda-item" type="button" data-agenda-id="${esc(item.id)}">
            <div class="booking-agenda-time">${esc(formatTime(item.start_time))}</div>
            <div class="booking-agenda-main"><strong>${esc(item.event_title || "Catering event")}</strong><span>${esc(item.company_name || item.customer_name || "Customer")} · ${esc(item.guest_count ?? "—")} guests${item.venue_name ? ` · ${esc(item.venue_name)}` : ""}</span></div>
            <div class="booking-agenda-side"><span class="booking-status-pill ${esc(String(item.status || "pending").toLowerCase())}">${esc(item.status || "Pending")}</span><small>${money(item.quote_amount)}</small></div>
          </button>`).join("")}</div>
      </section>`).join("")}</div>` : `<div class="booking-empty"><div><strong>No upcoming bookings match these filters.</strong><br>Clear the filters or create a new booking.</div></div>`;
    calendar.querySelectorAll("[data-agenda-id]").forEach((button) => button.addEventListener("click", () => window.bookingCalendar?.openBooking(button.dataset.agendaId)));
  }

  function enrichCards() {
    if (agendaActive) return;
    calendar.querySelectorAll("[data-booking-id]").forEach((button) => {
      if (button.querySelector(".booking-event-meta")) return;
      const item = records.find((record) => String(record.id) === String(button.dataset.bookingId));
      if (!item) return;
      const meta = document.createElement("small");
      meta.className = "booking-event-meta";
      meta.innerHTML = `<span>${esc(item.guest_count ?? "—")} guests</span>${item.venue_name ? `<span>${esc(item.venue_name)}</span>` : ""}${item.quote_amount != null ? `<span>${money(item.quote_amount)}</span>` : ""}`;
      button.appendChild(meta);
    });
  }

  function enhanceModal() {
    if (modal.hidden) return;
    const card = modal.querySelector(".booking-modal-card");
    if (!card || card.querySelector(".booking-record-links")) return;
    const customerId = document.getElementById("bookingCustomerId")?.value;
    const quoteId = document.getElementById("bookingQuoteId")?.value;
    const email = document.getElementById("bookingEmail")?.value;
    const phone = document.getElementById("bookingPhone")?.value;
    if (!customerId && !quoteId && !email && !phone) return;
    const links = document.createElement("div");
    links.className = "booking-record-links";
    links.innerHTML = `${customerId ? '<button type="button" data-booking-link="customer">Open Customer</button>' : ""}${quoteId ? '<button type="button" data-booking-link="quote">Open Quote Pipeline</button>' : ""}${email ? `<a href="mailto:${esc(email)}">Email Customer</a>` : ""}${phone ? `<a href="tel:${esc(String(phone).replace(/[^+\d]/g, ""))}">Call Customer</a>` : ""}`;
    const form = document.getElementById("bookingForm");
    form?.insertBefore(links, form.firstChild);
    links.querySelector('[data-booking-link="customer"]')?.addEventListener("click", () => {
      document.getElementById("bookingModalClose")?.click();
      window.showPanel?.("customersPanel");
      window.customerCRM?.openCustomer(customerId);
    });
    links.querySelector('[data-booking-link="quote"]')?.addEventListener("click", () => {
      document.getElementById("bookingModalClose")?.click();
      window.showPanel?.("leadsPanel");
    });
  }

  injectStyles();
  const agendaButton = document.createElement("button");
  agendaButton.type = "button";
  agendaButton.dataset.bookingView = "agenda";
  agendaButton.textContent = "Agenda";
  agendaButton.addEventListener("click", async () => { await loadRecords(); renderAgenda(); });
  switcher.appendChild(agendaButton);

  switcher.querySelectorAll('button:not([data-booking-view="agenda"])').forEach((button) => button.addEventListener("click", () => { agendaActive = false; setTimeout(enrichCards, 0); }));
  ["bookingSearch", "bookingStatusFilter", "bookingEventTypeFilter", "bookingMonthFilter", "clearBookingFilters"].forEach((id) => document.getElementById(id)?.addEventListener(id === "bookingSearch" ? "input" : "change", () => { if (agendaActive) renderAgenda(); }));
  document.getElementById("clearBookingFilters")?.addEventListener("click", () => { if (agendaActive) setTimeout(renderAgenda, 0); });

  const observer = new MutationObserver(() => { enrichCards(); enhanceModal(); });
  observer.observe(calendar, { childList: true, subtree: true });
  observer.observe(modal, { attributes: true, childList: true, subtree: true, attributeFilter: ["hidden"] });
  loadRecords().then(enrichCards);
  document.addEventListener("booking-calendar-ready", () => loadRecords().then(enrichCards));
})();