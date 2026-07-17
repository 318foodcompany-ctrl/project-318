(function () {
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
  const internalNotesMarker = "--- INTERNAL NOTES ---";
  let quotes = [];
  let noteSaveTimer;

  if (!quotePanel || !quoteTableWrap) return;

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

  function splitNotes(value) {
    const notes = String(value || "");
    const markerIndex = notes.indexOf(internalNotesMarker);
    if (markerIndex < 0) return { customer: notes.trim(), internal: "" };
    return {
      customer: notes.slice(0, markerIndex).trim(),
      internal: notes.slice(markerIndex + internalNotesMarker.length).trim()
    };
  }

  function combineNotes(customerNotes, internalNotes) {
    const customer = String(customerNotes || "").trim();
    const internal = String(internalNotes || "").trim();
    if (!internal) return customer;
    return `${customer}${customer ? "\n\n" : ""}${internalNotesMarker}\n${internal}`;
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

    const eventTypes = [...new Set(quotes.map((quote) => String(quote.event_type || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
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
    const rows = filteredQuotes();
    if (!rows.length) {
      quoteTableWrap.innerHTML = `<div class="quote-empty">No quotes match the selected search and filters.</div>`;
      return;
    }

    quoteTableWrap.innerHTML = `
      <table class="quote-table">
        <thead><tr>
          <th>Customer</th><th>Company</th><th>Phone</th><th>Email</th><th>Event Date</th>
          <th>Guests</th><th>Event Type</th><th>Budget</th><th>Submitted</th><th>Status</th>
        </tr></thead>
        <tbody>${rows.map((quote) => `
          <tr data-quote-id="${escapeHTML(quote.id)}">
            <td><button class="quote-row-button" type="button" data-view-quote="${escapeHTML(quote.id)}">${escapeHTML(quote.name || "Unnamed customer")}</button></td>
            <td>${escapeHTML(quote.company || "—")}</td>
            <td><a href="tel:${escapeHTML(String(quote.phone || "").replace(/[^+\d]/g, ""))}">${escapeHTML(quote.phone || "—")}</a></td>
            <td><a href="mailto:${escapeHTML(quote.email || "")}">${escapeHTML(quote.email || "—")}</a></td>
            <td>${escapeHTML(dateText(quote.event_date))}</td>
            <td>${escapeHTML(quote.guests ?? "—")}</td>
            <td>${escapeHTML(quote.event_type || "—")}</td>
            <td>${escapeHTML(currency(quote.budget))}</td>
            <td>${escapeHTML(dateText(quote.created_at, true))}</td>
            <td><select class="quote-status" data-status-id="${escapeHTML(quote.id)}" aria-label="Status for ${escapeHTML(quote.name || "quote")}">${statusOptions(quote.status)}</select></td>
          </tr>`).join("")}
        </tbody>
      </table>`;

    quoteTableWrap.querySelectorAll("[data-view-quote]").forEach((button) => {
      button.addEventListener("click", () => openQuote(button.dataset.viewQuote));
    });
    quoteTableWrap.querySelectorAll("[data-status-id]").forEach((select) => {
      select.addEventListener("change", () => saveStatus(select.dataset.statusId, select.value, select));
    });
    quoteTableWrap.querySelectorAll("tr[data-quote-id]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (!event.target.closest("button, select, a")) openQuote(row.dataset.quoteId);
      });
    });
  }

  async function saveStatus(id, status, control) {
    if (control) control.disabled = true;
    setMessage("Saving quote status…");
    const { error } = await supabaseClient.from("leads").update({ status }).eq("id", id);
    if (control) control.disabled = false;

    if (error) {
      console.error("Quote status save failed:", error);
      setMessage(`Status save failed: ${error.message}`, true);
      renderQuotes();
      return false;
    }

    const quote = quotes.find((item) => String(item.id) === String(id));
    if (quote) quote.status = status;
    updateSummary();
    renderQuotes();
    setMessage("Quote status saved.");
    return true;
  }

  function detailItem(label, value) {
    return `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value ?? "—")}</strong></div>`;
  }

  function openQuote(id) {
    const quote = quotes.find((item) => String(item.id) === String(id));
    if (!quote) return;
    const noteParts = splitNotes(quote.notes);

    quoteDetailContent.innerHTML = `
      <h2 id="quoteDetailTitle">${escapeHTML(quote.name || "Quote details")}</h2>
      <p>${escapeHTML(quote.company || "No company provided")}</p>
      <div class="quote-detail-grid">
        ${detailItem("Customer", quote.name || "—")}
        ${detailItem("Company", quote.company || "—")}
        ${detailItem("Phone", quote.phone || "—")}
        ${detailItem("Email", quote.email || "—")}
        ${detailItem("Event date", dateText(quote.event_date))}
        ${detailItem("Guest count", quote.guests ?? "—")}
        ${detailItem("Event type", quote.event_type || "—")}
        ${detailItem("Menu", quote.menu || "—")}
        ${detailItem("Budget", currency(quote.budget))}
        ${detailItem("Submitted", dateText(quote.created_at, true))}
        <div><span>Current status</span><select id="quoteDetailStatus">${statusOptions(quote.status)}</select></div>
      </div>
      <div class="quote-detail-notes">
        <label>Customer Request Details</label>
        <div class="quote-customer-notes">${escapeHTML(noteParts.customer || "No additional details were submitted.")}</div>
      </div>
      <div class="quote-detail-notes">
        <label for="quoteInternalNotes">Private Internal Notes</label>
        <textarea id="quoteInternalNotes" placeholder="Add private follow-up notes for this quote…">${escapeHTML(noteParts.internal)}</textarea>
        <p id="quoteNoteSaveState" class="quote-save-state" role="status" aria-live="polite"></p>
      </div>`;

    quoteDetailModal.hidden = false;
    const detailStatus = document.getElementById("quoteDetailStatus");
    const internalNotes = document.getElementById("quoteInternalNotes");
    detailStatus.addEventListener("change", async () => {
      await saveStatus(quote.id, detailStatus.value, detailStatus);
    });
    internalNotes.addEventListener("input", () => scheduleNoteSave(quote, noteParts.customer, internalNotes.value));
    internalNotes.addEventListener("blur", () => saveInternalNotes(quote, noteParts.customer, internalNotes.value));
  }

  function scheduleNoteSave(quote, customerNotes, internalNotes) {
    clearTimeout(noteSaveTimer);
    const state = document.getElementById("quoteNoteSaveState");
    if (state) {
      state.textContent = "Unsaved changes…";
      state.style.color = "#6b6b6b";
    }
    noteSaveTimer = setTimeout(() => saveInternalNotes(quote, customerNotes, internalNotes), 700);
  }

  async function saveInternalNotes(quote, customerNotes, internalNotes) {
    clearTimeout(noteSaveTimer);
    const state = document.getElementById("quoteNoteSaveState");
    const combinedNotes = combineNotes(customerNotes, internalNotes);
    if (combinedNotes === String(quote.notes || "")) return;
    if (state) state.textContent = "Saving notes…";

    const { error } = await supabaseClient.from("leads").update({ notes: combinedNotes }).eq("id", quote.id);
    if (error) {
      console.error("Internal note save failed:", error);
      if (state) {
        state.textContent = `Notes save failed: ${error.message}`;
        state.style.color = "#b42318";
      }
      return;
    }

    quote.notes = combinedNotes;
    if (state) {
      state.textContent = "Private notes saved.";
      state.style.color = "#16794b";
    }
  }

  function closeQuote() {
    clearTimeout(noteSaveTimer);
    quoteDetailModal.hidden = true;
    quoteDetailContent.innerHTML = "";
  }

  async function loadQuotes() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    setMessage("Loading quote requests…");
    const { data, error } = await supabaseClient.from("leads").select("*").order("created_at", { ascending: false });

    if (error) {
      console.error("Quote load failed:", error);
      setMessage(`Could not load quotes: ${error.message}`, true);
      quoteTableWrap.innerHTML = `<div class="quote-empty">Quote requests could not be loaded.</div>`;
      return;
    }

    quotes = data || [];
    populateFilters();
    updateSummary();
    renderQuotes();
    setMessage(quotes.length ? "" : "No quote requests have been submitted yet.");
  }

  [quoteSearch, quoteStatusFilter, quoteMonthFilter, quoteEventTypeFilter, quoteSort].forEach((control) => {
    control.addEventListener(control === quoteSearch ? "input" : "change", renderQuotes);
  });
  quoteDetailClose.addEventListener("click", closeQuote);
  quoteDetailModal.addEventListener("click", (event) => {
    if (event.target === quoteDetailModal) closeQuote();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !quoteDetailModal.hidden) closeQuote();
  });

  loadQuotes();
})();
