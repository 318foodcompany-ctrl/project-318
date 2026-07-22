(function () {
  "use strict";

  const quotePanel = document.getElementById("leadsPanel");
  const quoteTableWrap = document.getElementById("quoteTableWrap");
  const quoteManagerMessage = document.getElementById("quoteManagerMessage");
  const quoteSearch = document.getElementById("quoteSearch");
  const quoteStatusFilter = document.getElementById("quoteStatusFilter");
  const quoteMonthFilter = document.getElementById("quoteMonthFilter");
  const quoteEventTypeFilter = document.getElementById("quoteEventTypeFilter");
  const quoteSort = document.getElementById("quoteSort");
  const quoteDetailModal = document.getElementById("quoteDetailModal");
  const quoteDetailContent = document.getElementById("quoteDetailContent");
  const quoteDetailClose = document.getElementById("quoteDetailClose");
  const statuses = ["New", "Contacted", "Proposal Sent", "Booked", "Closed", "Cancelled"];
  const pipelineColumns = [
    { key: "New", label: "Quote Requested", help: "New requests waiting for first contact." },
    { key: "Contacted", label: "Contacted", help: "You have started the conversation." },
    { key: "Proposal Sent", label: "Proposal Sent", help: "Waiting for the customer to decide." },
    { key: "Booked", label: "Booked", help: "Won business ready for booking management." },
    { key: "Closed", label: "Closed", help: "Finished or no longer active." },
    { key: "Cancelled", label: "Cancelled", help: "Cancelled opportunities." }
  ];
  let quotes = [];
  let quoteView = localStorage.getItem("318-quote-view") === "table" ? "table" : "pipeline";
  let noteSaveTimer;
  let noteSaveInFlight = null;
  let activeNoteState = null;

  if (!quotePanel || !quoteTableWrap) return;

  injectPipelineStyles();
  installViewControls();

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function displayStatus(status) {
    if (status === "Quote Sent") return "Proposal Sent";
    if (status === "Lost") return "Closed";
    return statuses.includes(status) ? status : "New";
  }

  function currency(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "—";
  }

  function dateText(value, includeTime = false) {
    if (!value) return "—";
    const date = includeTime ? new Date(value) : new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", includeTime
      ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" });
  }

  function ageText(value) {
    const created = new Date(value || 0);
    if (Number.isNaN(created.getTime())) return "Age unknown";
    const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
    if (days === 0) return "Today";
    if (days === 1) return "1 day old";
    return `${days} days old`;
  }

  function setMessage(message, isError = false) {
    if (!quoteManagerMessage) return;
    quoteManagerMessage.textContent = message;
    quoteManagerMessage.style.color = isError ? "#b42318" : "#16794b";
  }

  function statusOptions(current) {
    const normalized = displayStatus(current);
    return statuses.map((status) =>
      `<option value="${escapeHTML(status)}" ${status === normalized ? "selected" : ""}>${escapeHTML(status)}</option>`
    ).join("");
  }

  function installViewControls() {
    const card = quoteTableWrap.closest(".card");
    const toolbar = card?.querySelector(".quote-toolbar");
    if (!card || !toolbar || document.getElementById("quoteViewSwitcher")) return;
    const switcher = document.createElement("div");
    switcher.id = "quoteViewSwitcher";
    switcher.className = "quote-view-switcher";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Quote management view");
    switcher.innerHTML = `
      <div><strong>Sales Pipeline</strong><span>Move leads through your sales process.</span></div>
      <div class="quote-view-buttons">
        <button type="button" data-quote-view="pipeline">Pipeline</button>
        <button type="button" data-quote-view="table">Table</button>
      </div>`;
    toolbar.before(switcher);
    switcher.querySelectorAll("[data-quote-view]").forEach((button) => {
      button.addEventListener("click", () => {
        quoteView = button.dataset.quoteView;
        localStorage.setItem("318-quote-view", quoteView);
        renderQuotes();
      });
    });
  }

  function updateViewControls() {
    document.querySelectorAll("[data-quote-view]").forEach((button) => {
      const active = button.dataset.quoteView === quoteView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateSummary() {
    const month = new Date().toISOString().slice(0, 7);
    document.getElementById("quoteTotalCount").textContent = quotes.length;
    document.getElementById("quoteNewCount").textContent = quotes.filter((quote) => displayStatus(quote.status) === "New").length;
    document.getElementById("quoteBookedCount").textContent = quotes.filter((quote) => displayStatus(quote.status) === "Booked").length;
    document.getElementById("quoteMonthCount").textContent = quotes.filter((quote) => String(quote.created_at || "").startsWith(month)).length;
  }

  function populateFilters() {
    const selectedStatus = quoteStatusFilter.value;
    const selectedEventType = quoteEventTypeFilter.value;
    quoteStatusFilter.innerHTML = `<option value="">All statuses</option>${statuses.map((status) => `<option value="${escapeHTML(status)}">${escapeHTML(status)}</option>`).join("")}`;
    quoteStatusFilter.value = selectedStatus;
    const eventTypes = [...new Set(quotes.map((quote) => String(quote.event_type || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    quoteEventTypeFilter.innerHTML = `<option value="">All event types</option>${eventTypes.map((type) => `<option value="${escapeHTML(type)}">${escapeHTML(type)}</option>`).join("")}`;
    quoteEventTypeFilter.value = selectedEventType;
  }

  function filteredQuotes() {
    const search = quoteSearch.value.trim().toLowerCase();
    const status = quoteStatusFilter.value;
    const month = quoteMonthFilter.value;
    const eventType = quoteEventTypeFilter.value;
    const filtered = quotes.filter((quote) => {
      const searchable = [quote.name, quote.email, quote.phone, quote.company].join(" ").toLowerCase();
      return (!search || searchable.includes(search))
        && (!status || displayStatus(quote.status) === status)
        && (!month || String(quote.event_date || "").startsWith(month))
        && (!eventType || quote.event_type === eventType);
    });
    return filtered.sort((a, b) => {
      if (quoteSort.value === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (quoteSort.value === "event-date") return String(a.event_date || "9999-12-31").localeCompare(String(b.event_date || "9999-12-31"));
      if (quoteSort.value === "customer") return String(a.name || "").localeCompare(String(b.name || ""));
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }

  function renderQuotes() {
    updateViewControls();
    if (quoteView === "table") renderTable();
    else renderPipeline();
  }

  function renderTable() {
    const rows = filteredQuotes();
    if (!rows.length) {
      quoteTableWrap.innerHTML = `<div class="quote-empty">No quotes match the selected search and filters.</div>`;
      return;
    }
    quoteTableWrap.innerHTML = `<table class="quote-table"><thead><tr><th>Customer</th><th>Company</th><th>Phone</th><th>Email</th><th>Event Date</th><th>Guests</th><th>Event Type</th><th>Budget</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${rows.map((quote) => `<tr data-quote-id="${escapeHTML(quote.id)}"><td><button class="quote-row-button" type="button" data-view-quote="${escapeHTML(quote.id)}">${escapeHTML(quote.name || "Unnamed customer")}</button></td><td>${escapeHTML(quote.company || "—")}</td><td><a href="tel:${escapeHTML(String(quote.phone || "").replace(/[^+\d]/g, ""))}">${escapeHTML(quote.phone || "—")}</a></td><td><a href="mailto:${escapeHTML(quote.email || "")}">${escapeHTML(quote.email || "—")}</a></td><td>${escapeHTML(dateText(quote.event_date))}</td><td>${escapeHTML(quote.guests ?? "—")}</td><td>${escapeHTML(quote.event_type || "—")}</td><td>${escapeHTML(currency(quote.budget))}</td><td>${escapeHTML(dateText(quote.created_at, true))}</td><td><select class="quote-status" data-status-id="${escapeHTML(quote.id)}" aria-label="Status for ${escapeHTML(quote.name || "quote")}">${statusOptions(quote.status)}</select></td></tr>`).join("")}</tbody></table>`;
    bindQuoteInteractions();
  }

  function renderPipeline() {
    const rows = filteredQuotes();
    const totalValue = rows.reduce((sum, quote) => sum + (Number(quote.budget) || 0), 0);
    quoteTableWrap.innerHTML = `
      <div class="quote-pipeline-summary"><span><strong>${rows.length}</strong> visible opportunities</span><span><strong>${escapeHTML(currency(totalValue))}</strong> pipeline value</span><span>Drag cards or use the stage menu.</span></div>
      <div class="quote-pipeline" aria-label="Sales pipeline">${pipelineColumns.map((column) => {
        const columnQuotes = rows.filter((quote) => displayStatus(quote.status) === column.key);
        const value = columnQuotes.reduce((sum, quote) => sum + (Number(quote.budget) || 0), 0);
        return `<section class="quote-pipeline-column status-${column.key.toLowerCase().replaceAll(" ", "-")}" data-pipeline-status="${escapeHTML(column.key)}"><header><div><h3>${escapeHTML(column.label)}</h3><p>${escapeHTML(column.help)}</p></div><span>${columnQuotes.length}</span></header><div class="quote-pipeline-value">${escapeHTML(currency(value))}</div><div class="quote-pipeline-cards">${columnQuotes.length ? columnQuotes.map(pipelineCard).join("") : `<div class="quote-pipeline-empty">Drop a lead here</div>`}</div></section>`;
      }).join("")}</div>`;
    bindQuoteInteractions();
    bindPipelineDragDrop();
  }

  function pipelineCard(quote) {
    const missingContact = !quote.email && !quote.phone;
    const oldLead = displayStatus(quote.status) === "New" && (Date.now() - new Date(quote.created_at || 0).getTime()) > 86400000;
    return `<article class="quote-pipeline-card ${oldLead ? "needs-attention" : ""}" draggable="true" data-quote-id="${escapeHTML(quote.id)}"><button type="button" class="quote-card-open" data-view-quote="${escapeHTML(quote.id)}"><span class="quote-card-title">${escapeHTML(quote.company || quote.name || "Unnamed customer")}</span><span class="quote-card-contact">${escapeHTML(quote.company ? quote.name || "No contact name" : quote.event_type || "Catering request")}</span></button><div class="quote-card-facts"><span>📅 ${escapeHTML(dateText(quote.event_date))}</span><span>👥 ${escapeHTML(quote.guests ?? "—")}</span><span>💰 ${escapeHTML(currency(quote.budget))}</span></div><div class="quote-card-flags">${oldLead ? `<span class="warning">Follow up</span>` : ""}${missingContact ? `<span class="warning">Missing contact</span>` : ""}<span>${escapeHTML(ageText(quote.created_at))}</span></div><label class="quote-card-stage">Move to<select data-status-id="${escapeHTML(quote.id)}" aria-label="Move ${escapeHTML(quote.name || "quote")} to another stage">${statusOptions(quote.status)}</select></label></article>`;
  }

  function bindQuoteInteractions() {
    quoteTableWrap.querySelectorAll("[data-view-quote]").forEach((button) => button.addEventListener("click", () => openQuote(button.dataset.viewQuote)));
    quoteTableWrap.querySelectorAll("[data-status-id]").forEach((select) => select.addEventListener("change", () => saveStatus(select.dataset.statusId, select.value, select)));
    quoteTableWrap.querySelectorAll("tr[data-quote-id]").forEach((row) => row.addEventListener("click", (event) => { if (!event.target.closest("button, select, a")) openQuote(row.dataset.quoteId); }));
  }

  function bindPipelineDragDrop() {
    let draggedId = null;
    quoteTableWrap.querySelectorAll(".quote-pipeline-card").forEach((card) => {
      card.addEventListener("dragstart", () => { draggedId = card.dataset.quoteId; card.classList.add("dragging"); });
      card.addEventListener("dragend", () => { draggedId = null; card.classList.remove("dragging"); quoteTableWrap.querySelectorAll(".drag-over").forEach((column) => column.classList.remove("drag-over")); });
    });
    quoteTableWrap.querySelectorAll("[data-pipeline-status]").forEach((column) => {
      column.addEventListener("dragover", (event) => { event.preventDefault(); column.classList.add("drag-over"); });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", async (event) => {
        event.preventDefault();
        column.classList.remove("drag-over");
        if (!draggedId) return;
        const quote = quotes.find((item) => String(item.id) === String(draggedId));
        const nextStatus = column.dataset.pipelineStatus;
        if (!quote || displayStatus(quote.status) === nextStatus) return;
        await saveStatus(draggedId, nextStatus, null);
      });
    });
  }

  async function saveStatus(id, status, control) {
    if (control) control.disabled = true;
    setMessage("Saving quote status…");
    try {
      if (!window.quoteStatusService) throw new Error("Quote status service is unavailable.");
      const updatedQuote = await window.quoteStatusService.update(supabaseClient, id, status);
      const quote = quotes.find((item) => String(item.id) === String(updatedQuote.id));
      if (quote) quote.status = updatedQuote.status;
      updateSummary();
      renderQuotes();
      setMessage("Quote status saved.");
      return true;
    } catch (error) {
      console.error("Quote status save failed:", error);
      setMessage(`Status save failed: ${error.message}`, true);
      renderQuotes();
      return false;
    } finally {
      if (control) control.disabled = false;
    }
  }

  function detailItem(label, value) {
    return `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value ?? "—")}</strong></div>`;
  }

  async function loadQuoteAttribution(quoteId) {
    const container = document.getElementById("quoteAttributionDetails");
    if (!container) return;
    const { data, error } = await supabaseClient.rpc("marketing_quote_attribution", { p_quote_id: quoteId });
    if (error) { console.error("Quote attribution load failed:", error); container.textContent = "Attribution is unavailable."; return; }
    const attribution = Array.isArray(data) ? data[0] : data;
    if (!attribution || !attribution.first_source) { container.textContent = "No marketing attribution was captured for this quote."; return; }
    container.innerHTML = `<div class="quote-detail-grid">${detailItem("First source", attribution.first_source)}${detailItem("First medium", attribution.first_medium)}${detailItem("First campaign", attribution.first_campaign || "—")}${detailItem("First landing page", attribution.first_landing_path || "—")}${detailItem("Last source", attribution.last_source || attribution.first_source)}${detailItem("Last medium", attribution.last_medium || attribution.first_medium)}${detailItem("Last campaign", attribution.last_campaign || "—")}${detailItem("Last landing page", attribution.last_landing_path || "—")}</div>`;
  }

  function openBookingFromQuote(quote, isSnapshot = false) {
    if (isSnapshot) return window.bookingCalendar.openFromQuote(quote);
    return window.bookingCalendar.openFromQuote({ ...quote });
  }

  function openQuote(id) {
    const quote = quotes.find((item) => String(item.id) === String(id));
    if (!quote) return;
    const canCreateBooking = ["Proposal Sent", "Booked"].includes(displayStatus(quote.status));
    const internalNotesValue = String(quote.internal_notes || "");
    activeNoteState = { quote, currentValue: internalNotesValue, savedValue: internalNotesValue };
    quoteDetailContent.innerHTML = `<h2 id="quoteDetailTitle">${escapeHTML(quote.name || "Quote details")}</h2><p>${escapeHTML(quote.company || "No company provided")}</p><div class="quote-detail-grid">${detailItem("Customer", quote.name || "—")}${detailItem("Company", quote.company || "—")}${detailItem("Phone", quote.phone || "—")}${detailItem("Email", quote.email || "—")}${detailItem("Event date", dateText(quote.event_date))}${detailItem("Guest count", quote.guests ?? "—")}${detailItem("Event type", quote.event_type || "—")}${detailItem("Menu", quote.menu || "—")}${detailItem("Budget", currency(quote.budget))}${detailItem("Submitted", dateText(quote.created_at, true))}<div><span>Current status</span><select id="quoteDetailStatus">${statusOptions(quote.status)}</select></div></div><div class="quote-detail-notes"><label>Customer Request Details</label><div class="quote-customer-notes">${escapeHTML(quote.notes || "No additional details were submitted.")}</div></div><div class="quote-detail-notes"><label>Marketing Attribution</label><div id="quoteAttributionDetails" class="quote-customer-notes">Loading attribution…</div></div><div class="quote-detail-notes"><label for="quoteInternalNotes">Private Internal Notes</label><textarea id="quoteInternalNotes" placeholder="Add private follow-up notes for this quote…">${escapeHTML(internalNotesValue)}</textarea><p id="quoteNoteSaveState" class="quote-save-state" role="status" aria-live="polite"></p></div>${quote.customer_id ? `<div class="quote-booking-action"><button id="quoteOpenCustomerButton" class="crm-secondary-button" type="button">Open Customer Record</button></div><div class="quote-booking-action"><button id="quoteCreateInvoiceButton" class="crm-secondary-button" type="button">Create Invoice</button><p>Create or open the accounting invoice linked to this quote.</p></div>` : ""}${canCreateBooking ? `<div class="quote-booking-action"><button id="quoteCreateBookingButton" class="save-button" type="button">Create Booking</button><p>Create a linked calendar booking using this quote’s customer and event details.</p></div>` : ""}`;
    quoteDetailModal.hidden = false;
    loadQuoteAttribution(quote.id);
    document.getElementById("quoteDetailStatus").addEventListener("change", async (event) => saveStatus(quote.id, event.target.value, event.target));
    const internalNotes = document.getElementById("quoteInternalNotes");
    internalNotes.addEventListener("input", () => scheduleNoteSave(internalNotes.value));
    internalNotes.addEventListener("blur", () => flushInternalNotes());
    document.getElementById("quoteOpenCustomerButton")?.addEventListener("click", async () => { const closed = await closeQuote(); if (closed && window.customerCRM) { showPanel("customersPanel"); window.customerCRM.openCustomer(quote.customer_id); } });
    document.getElementById("quoteCreateBookingButton")?.addEventListener("click", async () => { if (!window.bookingCalendar) { setNoteSaveState("Booking Calendar is still loading. Try again in a moment.", true); return; } const bookingQuote = { ...quote }; const closed = await closeQuote(); if (closed) openBookingFromQuote(bookingQuote, true); });
    document.getElementById("quoteCreateInvoiceButton")?.addEventListener("click", async () => { if (!window.invoiceManager) { setNoteSaveState("Invoice management is still loading. Try again in a moment.", true); return; } const closed = await closeQuote(); if (closed) window.invoiceManager.openFromQuote({ ...quote }); });
  }

  function setNoteSaveState(message, isError = false) {
    const state = document.getElementById("quoteNoteSaveState");
    if (!state) return;
    state.textContent = message;
    state.style.color = isError ? "#b42318" : message === "Private notes saved." ? "#16794b" : "#6b6b6b";
  }

  function scheduleNoteSave(internalNotes) {
    if (!activeNoteState) return;
    activeNoteState.currentValue = internalNotes;
    clearTimeout(noteSaveTimer);
    if (activeNoteState.currentValue === activeNoteState.savedValue) { setNoteSaveState("Private notes saved."); return; }
    setNoteSaveState("Unsaved changes…");
    noteSaveTimer = setTimeout(() => flushInternalNotes(), 700);
  }

  async function flushInternalNotes() {
    clearTimeout(noteSaveTimer);
    const noteState = activeNoteState;
    if (!noteState || noteState.currentValue === noteState.savedValue) return true;
    if (noteSaveInFlight) { const succeeded = await noteSaveInFlight; if (!succeeded) return false; if (activeNoteState !== noteState || noteState.currentValue === noteState.savedValue) return true; return flushInternalNotes(); }
    const valueToSave = noteState.currentValue;
    setNoteSaveState("Saving notes…");
    noteSaveInFlight = (async () => {
      const { error } = await supabaseClient.from("leads").update({ internal_notes: valueToSave }).eq("id", noteState.quote.id);
      if (error) { console.error("Internal note save failed:", error); const missingColumn = `${error.code || ""} ${error.message || ""}`.includes("internal_notes"); setNoteSaveState(missingColumn ? "Private notes require the Supabase quote-internal-notes migration before they can be saved." : `Notes save failed: ${error.message}`, true); return false; }
      noteState.savedValue = valueToSave;
      noteState.quote.internal_notes = valueToSave;
      setNoteSaveState(noteState.currentValue === valueToSave ? "Private notes saved." : "Unsaved changes…");
      return true;
    })();
    const saveSucceeded = await noteSaveInFlight;
    noteSaveInFlight = null;
    if (!saveSucceeded) return false;
    if (activeNoteState === noteState && noteState.currentValue !== noteState.savedValue) return flushInternalNotes();
    return true;
  }

  async function closeQuote() {
    const notesSaved = await flushInternalNotes();
    if (!notesSaved) return false;
    activeNoteState = null;
    quoteDetailModal.hidden = true;
    quoteDetailContent.innerHTML = "";
    return true;
  }

  async function loadQuotes() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    setMessage("Loading quote requests…");
    const { data, error } = await supabaseClient.from("leads").select("*").order("created_at", { ascending: false });
    if (error) { console.error("Quote load failed:", error); setMessage(`Could not load quotes: ${error.message}`, true); quoteTableWrap.innerHTML = `<div class="quote-empty">Quote requests could not be loaded.</div>`; return; }
    quotes = data || [];
    populateFilters();
    updateSummary();
    renderQuotes();
    setMessage(quotes.length ? "" : "No quote requests have been submitted yet.");
  }

  function injectPipelineStyles() {
    if (document.getElementById("quotePipelineStyles")) return;
    const style = document.createElement("style");
    style.id = "quotePipelineStyles";
    style.textContent = `.quote-view-switcher{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 18px;margin-bottom:14px;border:1px solid #e4e4e0;border-radius:16px;background:linear-gradient(135deg,#fff 0%,#fff7f7 100%)}.quote-view-switcher strong,.quote-view-switcher span{display:block}.quote-view-switcher span{margin-top:3px;color:#6b6b6b;font-size:13px}.quote-view-buttons{display:flex;padding:4px;border-radius:12px;background:#ededeb}.quote-view-buttons button{border:0;border-radius:9px;padding:9px 14px;background:transparent;font-weight:800}.quote-view-buttons button.active{background:#111;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.16)}.quote-pipeline-summary{display:flex;flex-wrap:wrap;gap:18px;padding:0 2px 14px;color:#6b6b6b;font-size:13px}.quote-pipeline-summary strong{color:#111}.quote-pipeline{display:grid;grid-template-columns:repeat(6,minmax(245px,1fr));gap:14px;overflow-x:auto;padding:2px 2px 18px;scroll-snap-type:x proximity}.quote-pipeline-column{min-height:430px;padding:12px;border:1px solid #e1e1dd;border-radius:18px;background:#f4f4f1;scroll-snap-align:start;transition:.18s ease}.quote-pipeline-column.drag-over{border-color:#e21b23;background:#fff1f1;transform:translateY(-2px)}.quote-pipeline-column header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.quote-pipeline-column h3{margin:0;font-size:16px}.quote-pipeline-column header p{margin:5px 0 0;color:#707070;font-size:12px;line-height:1.35}.quote-pipeline-column header>span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:999px;background:#fff;font-weight:900}.quote-pipeline-value{margin:10px 0 12px;color:#555;font-size:13px;font-weight:800}.quote-pipeline-cards{display:grid;gap:10px}.quote-pipeline-card{padding:14px;border:1px solid #deded9;border-radius:15px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.06);transition:.18s ease}.quote-pipeline-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.1)}.quote-pipeline-card.dragging{opacity:.45}.quote-pipeline-card.needs-attention{border-left:4px solid #e21b23}.quote-card-open{display:block;width:100%;padding:0;border:0;background:transparent;text-align:left}.quote-card-title,.quote-card-contact{display:block}.quote-card-title{font-weight:900;font-size:15px}.quote-card-contact{margin-top:3px;color:#666;font-size:12px}.quote-card-facts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0;color:#444;font-size:12px}.quote-card-flags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.quote-card-flags span{padding:4px 7px;border-radius:999px;background:#efefec;color:#555;font-size:11px;font-weight:800}.quote-card-flags .warning{background:#fff0d9;color:#8a4b00}.quote-card-stage{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px;color:#666;font-size:11px;font-weight:800;text-transform:uppercase}.quote-card-stage select{width:100%;padding:8px;border:1px solid #d0d0cc;border-radius:9px;background:#fff;text-transform:none}.quote-pipeline-empty{display:grid;place-items:center;min-height:78px;border:2px dashed #d6d6d1;border-radius:13px;color:#92928d;font-size:12px}@media(max-width:800px){.quote-view-switcher{align-items:flex-start;flex-direction:column}.quote-view-buttons{width:100%}.quote-view-buttons button{flex:1}.quote-pipeline{grid-template-columns:repeat(6,minmax(82vw,1fr))}}@media(prefers-reduced-motion:reduce){.quote-pipeline-column,.quote-pipeline-card{transition:none}}`;
    document.head.appendChild(style);
  }

  [quoteSearch, quoteStatusFilter, quoteMonthFilter, quoteEventTypeFilter, quoteSort].forEach((control) => control.addEventListener(control === quoteSearch ? "input" : "change", renderQuotes));
  quoteDetailClose.addEventListener("click", () => closeQuote());
  quoteDetailModal.addEventListener("click", (event) => { if (event.target === quoteDetailModal) closeQuote(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !quoteDetailModal.hidden) closeQuote(); });
  loadQuotes();
})();
