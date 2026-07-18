(function () {
  const panel = document.getElementById("bookingsPanel");
  const calendar = document.getElementById("bookingCalendar");
  const message = document.getElementById("bookingMessage");
  const rangeHeading = document.getElementById("bookingRangeHeading");
  const searchInput = document.getElementById("bookingSearch");
  const statusFilter = document.getElementById("bookingStatusFilter");
  const eventTypeFilter = document.getElementById("bookingEventTypeFilter");
  const monthFilter = document.getElementById("bookingMonthFilter");
  const clearFiltersButton = document.getElementById("clearBookingFilters");
  const modal = document.getElementById("bookingModal");
  const modalTitle = document.getElementById("bookingModalTitle");
  const modalDescription = document.getElementById("bookingModalDescription");
  const modalClose = document.getElementById("bookingModalClose");
  const form = document.getElementById("bookingForm");
  const formMessage = document.getElementById("bookingFormMessage");
  const conflictWarning = document.getElementById("bookingConflictWarning");
  const saveButton = document.getElementById("bookingSaveButton");
  const deleteButton = document.getElementById("bookingDeleteButton");
  const customerSearch = document.getElementById("bookingCustomerSearch");
  const customerMatches = document.getElementById("bookingCustomerMatches");
  const statuses = ["Pending", "Confirmed", "Completed", "Cancelled"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fields = {
    id: document.getElementById("bookingId"),
    quoteId: document.getElementById("bookingQuoteId"),
    customerId: document.getElementById("bookingCustomerId"),
    customerName: document.getElementById("bookingCustomerName"),
    companyName: document.getElementById("bookingCompanyName"),
    email: document.getElementById("bookingEmail"),
    phone: document.getElementById("bookingPhone"),
    eventTitle: document.getElementById("bookingEventTitle"),
    eventType: document.getElementById("bookingEventType"),
    eventDate: document.getElementById("bookingEventDate"),
    startTime: document.getElementById("bookingStartTime"),
    endTime: document.getElementById("bookingEndTime"),
    guestCount: document.getElementById("bookingGuestCount"),
    venueName: document.getElementById("bookingVenueName"),
    venueAddress: document.getElementById("bookingVenueAddress"),
    quoteAmount: document.getElementById("bookingQuoteAmount"),
    status: document.getElementById("bookingStatus"),
    internalNotes: document.getElementById("bookingInternalNotes")
  };
  let bookings = [];
  let calendarView = "month";
  let cursorDate = startOfDay(new Date());
  let loadingPromise = null;
  let saving = false;
  let deleteArmed = false;
  let deleteResetTimer;
  let conflictApprovalSignature = "";
  let previousFocus = null;
  let customerSearchTimer;

  if (!panel || !calendar || !form) return;
  if (!window.bookingTimeUtils) {
    calendar.innerHTML = `<div class="booking-empty">Booking time utilities could not be loaded.</div>`;
    return;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function startOfWeek(date) {
    return addDays(startOfDay(date), -date.getDay());
  }

  function endOfWeek(date) {
    return addDays(startOfWeek(date), 6);
  }

  function localISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    if (!value) return null;
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(date, options) {
    return date.toLocaleDateString("en-US", options);
  }

  function formatTime(value) {
    if (!value) return "Time TBD";
    const [hours, minutes] = String(value).split(":").map(Number);
    if (Number.isNaN(hours)) return value;
    return new Date(2000, 0, 1, hours, minutes || 0).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function timeRange(booking) {
    return `${formatTime(booking.start_time)}–${formatTime(booking.end_time)}`;
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#b42318" : "#16794b";
  }

  function setFormMessage(text, isError = false) {
    formMessage.textContent = text;
    formMessage.style.color = isError ? "#b42318" : "#16794b";
  }

  function statusClass(status) {
    return `status-${String(status || "Pending").toLowerCase()}`;
  }

  function bookingLabel(booking) {
    const customer = booking.company_name || booking.customer_name;
    return `${booking.status}: ${booking.event_title}, ${customer}, ${timeRange(booking)}`;
  }

  function eventButton(booking) {
    return `<button class="booking-event ${statusClass(booking.status)}" type="button" data-booking-id="${escapeHTML(booking.id)}" aria-label="${escapeHTML(bookingLabel(booking))}">
      <strong>${escapeHTML(booking.event_title)}</strong>
      <small>${escapeHTML(timeRange(booking))} · ${escapeHTML(booking.status)}</small>
      <small>${escapeHTML(booking.company_name || booking.customer_name)}</small>
    </button>`;
  }

  function activeBookings() {
    const search = searchInput.value.trim().toLowerCase();
    return bookings.filter((booking) => {
      const searchable = [booking.customer_name, booking.company_name, booking.event_title, booking.venue_name]
        .join(" ")
        .toLowerCase();
      return (!search || searchable.includes(search))
        && (!statusFilter.value || booking.status === statusFilter.value)
        && (!eventTypeFilter.value || booking.event_type === eventTypeFilter.value)
        && (!monthFilter.value || String(booking.event_date || "").startsWith(monthFilter.value));
    });
  }

  function bookingsForDate(date) {
    const dateValue = localISO(date);
    return activeBookings()
      .filter((booking) => booking.event_date === dateValue)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  }

  function renderSummary() {
    const today = startOfDay(new Date());
    const todayValue = localISO(today);
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const monthPrefix = todayValue.slice(0, 7);
    const notCancelled = bookings.filter((booking) => booking.status !== "Cancelled");
    document.getElementById("bookingTodayCount").textContent = notCancelled.filter((booking) => booking.event_date === todayValue).length;
    document.getElementById("bookingWeekCount").textContent = notCancelled.filter((booking) => {
      const date = parseDate(booking.event_date);
      return date && date >= weekStart && date <= weekEnd;
    }).length;
    document.getElementById("bookingMonthCount").textContent = notCancelled.filter((booking) => String(booking.event_date).startsWith(monthPrefix)).length;
    document.getElementById("bookingPendingCount").textContent = bookings.filter((booking) => booking.status === "Pending").length;
    document.getElementById("bookingConfirmedCount").textContent = bookings.filter((booking) => booking.status === "Confirmed").length;
    document.getElementById("bookingCancelledCount").textContent = bookings.filter((booking) => booking.status === "Cancelled").length;
  }

  function populateFilters() {
    const currentStatus = statusFilter.value;
    const currentType = eventTypeFilter.value;
    statusFilter.innerHTML = `<option value="">All statuses</option>${statuses.map((status) => `<option value="${status}">${status}</option>`).join("")}`;
    statusFilter.value = currentStatus;
    const eventTypes = [...new Set(bookings.map((booking) => String(booking.event_type || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    eventTypeFilter.innerHTML = `<option value="">All event types</option>${eventTypes.map((type) => `<option value="${escapeHTML(type)}">${escapeHTML(type)}</option>`).join("")}`;
    eventTypeFilter.value = currentType;
  }

  function renderMonth() {
    const monthStart = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const todayValue = localISO(new Date());
    rangeHeading.textContent = formatDate(monthStart, { month: "long", year: "numeric" });
    let html = weekdays.map((day) => `<div class="booking-weekday">${day}</div>`).join("");
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(gridStart, index);
      const dateValue = localISO(date);
      const dayBookings = bookingsForDate(date);
      const outside = date.getMonth() !== cursorDate.getMonth();
      html += `<section class="booking-day-cell ${outside ? "outside" : ""} ${dateValue === todayValue ? "today" : ""}" aria-label="${escapeHTML(formatDate(date, { weekday: "long", month: "long", day: "numeric" }))}">
        <div class="booking-day-number"><button type="button" data-booking-date="${dateValue}" aria-label="Open ${escapeHTML(formatDate(date, { month: "long", day: "numeric" }))} in day view">${date.getDate()}</button>${dayBookings.length ? `<span>${dayBookings.length}</span>` : ""}</div>
        ${dayBookings.slice(0, 3).map(eventButton).join("")}
        ${dayBookings.length > 3 ? `<div class="booking-more">+${dayBookings.length - 3} more</div>` : ""}
      </section>`;
    }
    calendar.innerHTML = `<div class="booking-month-grid">${html}</div>`;
  }

  function renderWeek() {
    const start = startOfWeek(cursorDate);
    const end = endOfWeek(cursorDate);
    const todayValue = localISO(new Date());
    rangeHeading.textContent = `${formatDate(start, { month: "short", day: "numeric" })} – ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
    calendar.innerHTML = `<div class="booking-week-grid">${Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const rows = bookingsForDate(date);
      return `<section class="booking-week-column ${localISO(date) === todayValue ? "today" : ""}">
        <h4>${escapeHTML(formatDate(date, { weekday: "short", month: "short", day: "numeric" }))}</h4>
        ${rows.length ? rows.map(eventButton).join("") : `<div class="booking-empty">No bookings</div>`}
      </section>`;
    }).join("")}</div>`;
  }

  function renderDay() {
    const rows = bookingsForDate(cursorDate);
    rangeHeading.textContent = formatDate(cursorDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    calendar.innerHTML = `<section class="booking-day-list">
      <h4>${rows.length} booking${rows.length === 1 ? "" : "s"}</h4>
      ${rows.length ? rows.map(eventButton).join("") : `<div class="booking-empty">No bookings for this day.</div>`}
    </section>`;
  }

  function bindCalendarControls() {
    calendar.querySelectorAll("[data-booking-id]").forEach((button) => {
      button.addEventListener("click", () => openBooking(button.dataset.bookingId));
    });
    calendar.querySelectorAll("[data-booking-date]").forEach((button) => {
      button.addEventListener("click", () => {
        cursorDate = parseDate(button.dataset.bookingDate);
        calendarView = "day";
        renderCalendar();
      });
    });
  }

  function renderCalendar() {
    document.querySelectorAll("[data-booking-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.bookingView === calendarView);
    });
    if (calendarView === "week") renderWeek();
    else if (calendarView === "day") renderDay();
    else renderMonth();
    calendar.setAttribute("aria-busy", "false");
    bindCalendarControls();
  }

  function resetDeleteConfirmation() {
    clearTimeout(deleteResetTimer);
    deleteArmed = false;
    deleteButton.classList.remove("confirming");
    deleteButton.textContent = "Delete Booking";
  }

  function openModal() {
    previousFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => fields.customerName.focus(), 0);
  }

  function closeModal() {
    if (saving) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    conflictWarning.hidden = true;
    resetDeleteConfirmation();
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  function resetForm(dateValue = localISO(cursorDate)) {
    form.reset();
    fields.id.value = "";
    fields.quoteId.value = "";
    fields.customerId.value = "";
    customerSearch.value = "";
    customerMatches.hidden = true;
    fields.eventDate.value = dateValue;
    fields.startTime.value = "11:00";
    fields.endTime.value = "13:00";
    fields.status.value = "Pending";
    conflictApprovalSignature = "";
    conflictWarning.hidden = true;
    setFormMessage("");
    resetDeleteConfirmation();
  }

  function newBooking(prefill = {}) {
    resetForm(prefill.event_date || localISO(cursorDate));
    modalTitle.textContent = "New Booking";
    modalDescription.textContent = prefill.quote_id
      ? "Review the details imported from the quote before saving."
      : "Add the customer and event details below.";
    deleteButton.hidden = true;
    Object.entries({
      quoteId: prefill.quote_id,
      customerId: prefill.customer_id,
      customerName: prefill.customer_name,
      companyName: prefill.company_name,
      email: prefill.email,
      phone: prefill.phone,
      eventTitle: prefill.event_title,
      eventType: prefill.event_type,
      eventDate: prefill.event_date,
      startTime: prefill.start_time,
      endTime: prefill.end_time,
      guestCount: prefill.guest_count,
      venueName: prefill.venue_name,
      venueAddress: prefill.venue_address,
      quoteAmount: prefill.quote_amount,
      status: prefill.status,
      internalNotes: prefill.internal_notes
    }).forEach(([key, value]) => {
      if (value !== undefined && value !== null && fields[key]) fields[key].value = value;
    });
    openModal();
  }

  function openBooking(id) {
    const booking = bookings.find((item) => String(item.id) === String(id));
    if (!booking) return;
    resetForm(booking.event_date);
    modalTitle.textContent = booking.event_title;
    modalDescription.textContent = `Created ${formatDate(new Date(booking.created_at), { month: "short", day: "numeric", year: "numeric" })}`;
    deleteButton.hidden = false;
    fields.id.value = booking.id;
    fields.quoteId.value = booking.quote_id || "";
    fields.customerId.value = booking.customer_id || "";
    fields.customerName.value = booking.customer_name || "";
    fields.companyName.value = booking.company_name || "";
    fields.email.value = booking.email || "";
    fields.phone.value = booking.phone || "";
    fields.eventTitle.value = booking.event_title || "";
    fields.eventType.value = booking.event_type || "";
    fields.eventDate.value = booking.event_date || "";
    fields.startTime.value = String(booking.start_time || "").slice(0, 5);
    fields.endTime.value = String(booking.end_time || "").slice(0, 5);
    fields.guestCount.value = booking.guest_count ?? "";
    fields.venueName.value = booking.venue_name || "";
    fields.venueAddress.value = booking.venue_address || "";
    fields.quoteAmount.value = booking.quote_amount ?? "";
    fields.status.value = booking.status || "Pending";
    fields.internalNotes.value = booking.internal_notes || "";
    openModal();
  }

  function formPayload() {
    return {
      customer_name: fields.customerName.value.trim(),
      company_name: fields.companyName.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      event_title: fields.eventTitle.value.trim(),
      event_type: fields.eventType.value.trim(),
      event_date: fields.eventDate.value,
      start_time: fields.startTime.value,
      end_time: fields.endTime.value,
      guest_count: fields.guestCount.value === "" ? null : Number(fields.guestCount.value),
      venue_name: fields.venueName.value.trim(),
      venue_address: fields.venueAddress.value.trim(),
      quote_id: fields.quoteId.value === "" ? null : Number(fields.quoteId.value),
      customer_id: fields.customerId.value || null,
      quote_amount: fields.quoteAmount.value === "" ? null : Number(fields.quoteAmount.value),
      status: fields.status.value,
      internal_notes: fields.internalNotes.value.trim()
    };
  }

  function validatePayload(payload) {
    if (!form.reportValidity()) return false;
    if (payload.end_time <= payload.start_time) {
      fields.endTime.setCustomValidity("End time must be later than start time.");
      fields.endTime.reportValidity();
      fields.endTime.setCustomValidity("");
      setFormMessage("End time must be later than start time.", true);
      return false;
    }
    if (payload.guest_count !== null && payload.guest_count < 0) {
      setFormMessage("Guest count cannot be negative.", true);
      return false;
    }
    if (payload.quote_amount !== null && payload.quote_amount < 0) {
      setFormMessage("Quote amount cannot be negative.", true);
      return false;
    }
    return true;
  }

  function conflictsFor(payload, currentId) {
    if (payload.status === "Cancelled") return [];
    return bookings.filter((booking) =>
      String(booking.id) !== String(currentId || "")
      && booking.status !== "Cancelled"
      && booking.event_date === payload.event_date
      && payload.start_time < String(booking.end_time).slice(0, 5)
      && payload.end_time > String(booking.start_time).slice(0, 5)
    );
  }

  function conflictSignature(payload, currentId) {
    return JSON.stringify([currentId || "new", payload.event_date, payload.start_time, payload.end_time, payload.status]);
  }

  function showConflicts(conflicts, signature) {
    conflictWarning.hidden = false;
    conflictWarning.innerHTML = `<h3>Schedule conflict warning</h3>
      <p>This time overlaps with ${conflicts.length} existing booking${conflicts.length === 1 ? "" : "s"}:</p>
      <ul>${conflicts.map((booking) => `<li><strong>${escapeHTML(booking.event_title)}</strong> — ${escapeHTML(timeRange(booking))} (${escapeHTML(booking.status)})</li>`).join("")}</ul>
      <p>You can review the schedule or explicitly continue despite the conflict.</p>
      <button id="saveBookingDespiteConflict" class="save-button" type="button">Save Anyway</button>`;
    document.getElementById("saveBookingDespiteConflict").addEventListener("click", () => {
      conflictApprovalSignature = signature;
      form.requestSubmit();
    });
    conflictWarning.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function saveBooking(event) {
    event.preventDefault();
    if (saving) return;
    const payload = formPayload();
    if (!validatePayload(payload)) return;
    const currentId = fields.id.value;
    const signature = conflictSignature(payload, currentId);
    const conflicts = conflictsFor(payload, currentId);
    if (conflicts.length && conflictApprovalSignature !== signature) {
      showConflicts(conflicts, signature);
      setFormMessage("Review the overlap warning before saving.", true);
      return;
    }

    conflictWarning.hidden = true;
    saving = true;
    saveButton.disabled = true;
    setFormMessage("Saving booking…");
    try {
      if (!payload.customer_id) {
        if (!window.crmService || !window.crmUtils) throw new Error("Customer matching is unavailable.");
        const name = window.crmUtils.splitName(payload.customer_name);
        payload.customer_id = await window.crmService.findOrCreateCustomer({
          first_name: name.firstName,
          last_name: name.lastName,
          company: payload.company_name,
          email: payload.email,
          phone: payload.phone,
          event_address: payload.venue_address,
          billing_address: ""
        });
        fields.customerId.value = payload.customer_id;
      }
      const query = currentId
        ? supabaseClient.from("bookings").update(payload).eq("id", currentId).select().single()
        : supabaseClient.from("bookings").insert([payload]).select().single();
      const { data, error } = await query;
      if (error) throw error;
      if (currentId) {
        const index = bookings.findIndex((booking) => String(booking.id) === String(currentId));
        if (index >= 0) bookings[index] = data;
      } else {
        bookings.push(data);
      }
    } catch (error) {
      console.error("Booking save failed:", error);
      const duplicateQuote = error.code === "23505" && String(error.message || "").includes("quote");
      setFormMessage(duplicateQuote ? "A booking already exists for this quote." : `Save failed: ${error.message}`, true);
      return;
    } finally {
      saving = false;
      saveButton.disabled = false;
    }
    populateFilters();
    renderSummary();
    renderCalendar();
    closeModal();
    setMessage(currentId ? "Booking updated successfully." : "Booking created successfully.");
  }

  async function deleteBooking() {
    if (!fields.id.value || saving) return;
    if (!deleteArmed) {
      deleteArmed = true;
      deleteButton.classList.add("confirming");
      deleteButton.textContent = "Confirm Delete Booking";
      setFormMessage("Click Confirm Delete Booking to permanently delete this booking.", true);
      deleteResetTimer = setTimeout(resetDeleteConfirmation, 5000);
      return;
    }

    clearTimeout(deleteResetTimer);
    saving = true;
    deleteButton.disabled = true;
    setFormMessage("Deleting booking…");
    const id = fields.id.value;
    const { error } = await supabaseClient.from("bookings").delete().eq("id", id);
    saving = false;
    deleteButton.disabled = false;
    if (error) {
      console.error("Booking delete failed:", error);
      setFormMessage(`Delete failed: ${error.message}`, true);
      resetDeleteConfirmation();
      return;
    }

    bookings = bookings.filter((booking) => String(booking.id) !== String(id));
    populateFilters();
    renderSummary();
    renderCalendar();
    closeModal();
    setMessage("Booking deleted successfully.");
  }

  function extractNoteValue(notes, label) {
    const match = String(notes || "").match(new RegExp(`^${label}:\\s*(.*)$`, "im"));
    return match ? match[1].trim() : "";
  }

  async function openFromQuote(quote) {
    await ensureBookingsLoaded();
    const existing = bookings.find((booking) => booking.quote_id !== null && String(booking.quote_id) === String(quote.id));
    showPanel("bookingsPanel");
    if (existing) {
      setMessage("A booking already exists for this quote. The existing booking has been opened.", true);
      openBooking(existing.id);
      return;
    }

    const quoteTime = extractNoteValue(quote.notes, "Time");
    const timeRange = window.bookingTimeUtils.safeQuoteTimeRange(quoteTime);
    const address = extractNoteValue(quote.notes, "Address");
    const customerOrCompany = quote.company || quote.name || "Customer";
    newBooking({
      quote_id: quote.id,
      customer_id: quote.customer_id || "",
      customer_name: quote.name || "",
      company_name: quote.company || "",
      email: quote.email || "",
      phone: quote.phone || "",
      event_title: `${quote.event_type || quote.menu || "Catering"} — ${customerOrCompany}`,
      event_type: quote.event_type || "Catering Event",
      event_date: quote.event_date || localISO(cursorDate),
      start_time: timeRange.start,
      end_time: timeRange.end,
      guest_count: quote.guests ?? "",
      venue_address: address,
      quote_amount: quote.budget ?? "",
      status: quote.status === "Booked" ? "Confirmed" : "Pending",
      internal_notes: quote.notes ? `Customer request details:\n${quote.notes}` : ""
    });
  }

  async function loadBookings() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    calendar.setAttribute("aria-busy", "true");
    calendar.innerHTML = `<div class="booking-loading">Loading bookings…</div>`;
    setMessage("Loading bookings…");
    const { data, error } = await supabaseClient.from("bookings").select("*").order("event_date", { ascending: true });
    if (error) {
      console.error("Booking load failed:", error);
      calendar.innerHTML = `<div class="booking-empty">Bookings could not be loaded. Confirm the booking-calendar SQL migration has been run in Supabase.</div>`;
      setMessage(`Could not load bookings: ${error.message}`, true);
      calendar.setAttribute("aria-busy", "false");
      throw error;
    }
    bookings = data || [];
    populateFilters();
    renderSummary();
    renderCalendar();
    setMessage(bookings.length ? "" : "No bookings yet. Select New Booking to schedule the first event.");
  }

  function ensureBookingsLoaded() {
    if (!loadingPromise) loadingPromise = loadBookings().catch(() => null);
    return loadingPromise;
  }

  function renderCustomerMatches(matches) {
    if (!matches.length) {
      customerMatches.innerHTML = `<div class="crm-empty">No matching customer. Saving will create one.</div>`;
      customerMatches.hidden = false;
      customerSearch.setAttribute("aria-expanded", "true");
      return;
    }
    customerMatches.innerHTML = matches.map((customer) => `<button class="crm-match-button" type="button" data-booking-customer="${escapeHTML(customer.id)}"><strong>${escapeHTML(window.crmUtils.displayName(customer))}</strong><small>${escapeHTML([customer.company, customer.email, customer.phone].filter(Boolean).join(" / "))}</small></button>`).join("");
    customerMatches.hidden = false;
    customerSearch.setAttribute("aria-expanded", "true");
    customerMatches.querySelectorAll("[data-booking-customer]").forEach((button) => {
      button.addEventListener("click", () => {
        const customer = matches.find((item) => item.id === button.dataset.bookingCustomer);
        if (!customer) return;
        fields.customerId.value = customer.id;
        fields.customerName.value = window.crmUtils.displayName(customer);
        fields.companyName.value = customer.company || "";
        fields.email.value = customer.email || "";
        fields.phone.value = customer.phone || "";
        if (!fields.venueAddress.value) fields.venueAddress.value = customer.event_address || "";
        customerSearch.value = window.crmUtils.displayName(customer);
        customerMatches.hidden = true;
        customerSearch.setAttribute("aria-expanded", "false");
        setFormMessage("Existing customer selected.");
      });
    });
  }

  async function searchForCustomers() {
    const term = customerSearch.value.trim();
    fields.customerId.value = "";
    if (term.length < 2) {
      customerMatches.hidden = true;
      customerSearch.setAttribute("aria-expanded", "false");
      return;
    }
    try {
      renderCustomerMatches(await window.crmService.searchCustomers(term));
    } catch (error) {
      console.error("Customer search failed:", error);
      setFormMessage(`Customer search failed: ${error.message}`, true);
    }
  }

  fields.status.innerHTML = statuses.map((status) => `<option value="${status}">${status}</option>`).join("");
  document.getElementById("newBookingButton").addEventListener("click", () => newBooking());
  document.getElementById("bookingPrevious").addEventListener("click", () => {
    if (calendarView === "month") cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1);
    else cursorDate = addDays(cursorDate, calendarView === "week" ? -7 : -1);
    renderCalendar();
  });
  document.getElementById("bookingNext").addEventListener("click", () => {
    if (calendarView === "month") cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1);
    else cursorDate = addDays(cursorDate, calendarView === "week" ? 7 : 1);
    renderCalendar();
  });
  document.getElementById("bookingToday").addEventListener("click", () => {
    cursorDate = startOfDay(new Date());
    renderCalendar();
  });
  document.querySelectorAll("[data-booking-view]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarView = button.dataset.bookingView;
      renderCalendar();
    });
  });
  [searchInput, statusFilter, eventTypeFilter, monthFilter].forEach((control) => {
    control.addEventListener(control === searchInput ? "input" : "change", renderCalendar);
  });
  clearFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "";
    eventTypeFilter.value = "";
    monthFilter.value = "";
    renderCalendar();
  });
  customerSearch.addEventListener("input", () => {
    clearTimeout(customerSearchTimer);
    customerSearchTimer = setTimeout(searchForCustomers, 250);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".crm-customer-picker")) {
      customerMatches.hidden = true;
      customerSearch.setAttribute("aria-expanded", "false");
    }
  });
  form.addEventListener("submit", saveBooking);
  document.getElementById("bookingCancelButton").addEventListener("click", closeModal);
  modalClose.addEventListener("click", closeModal);
  deleteButton.addEventListener("click", deleteBooking);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
    if (event.key === "Tab" && !modal.hidden) {
      const focusable = [...modal.querySelectorAll('button:not([hidden]):not([disabled]), input:not([type="hidden"]), select, textarea')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.bookingCalendar = { openFromQuote, refresh: loadBookings };
  document.dispatchEvent(new CustomEvent("booking-calendar-ready"));
  loadingPromise = loadBookings().catch(() => null);
})();
