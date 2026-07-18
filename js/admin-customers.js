(function () {
  const panel = document.getElementById("customersPanel");
  if (!panel || !window.crmService || !window.crmUtils) return;

  const tableWrap = document.getElementById("customerTableWrap");
  const message = document.getElementById("customerManagerMessage");
  const search = document.getElementById("customerSearch");
  const archiveFilter = document.getElementById("customerArchiveFilter");
  const sort = document.getElementById("customerSort");
  const pageSize = document.getElementById("customerPageSize");
  const previous = document.getElementById("customerPreviousPage");
  const next = document.getElementById("customerNextPage");
  const pageText = document.getElementById("customerPageText");
  const modal = document.getElementById("customerDetailModal");
  const modalBody = document.getElementById("customerDetailBody");
  const modalClose = document.getElementById("customerDetailClose");
  const newCustomerButton = document.getElementById("newCustomerButton");
  const toastRegion = document.getElementById("crmToastRegion");
  let page = 1;
  let total = 0;
  let loading = false;
  let activeCustomerId = null;
  let searchTimer;
  let previousFocus = null;

  const { escapeHTML, displayName, dateText, currency } = window.crmUtils;

  function setMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("crm-error", error);
  }

  function toast(text, error = false) {
    if (!toastRegion) return;
    const item = document.createElement("div");
    item.className = `crm-toast${error ? " error" : ""}`;
    item.setAttribute("role", "status");
    item.textContent = text;
    toastRegion.appendChild(item);
    setTimeout(() => item.remove(), 3500);
  }

  async function loadCustomers() {
    if (loading) return;
    loading = true;
    tableWrap.innerHTML = `<div class="crm-loading">Loading customers…</div>`;
    setMessage("Loading customers…");
    try {
      const result = await window.crmService.dashboard({
        search: search.value,
        archived: archiveFilter.value === "archived",
        sort: sort.value,
        page,
        pageSize: Number(pageSize.value)
      });
      total = result.total;
      renderTable(result.rows);
      setMessage(result.rows.length ? "" : "No customers match the selected filters.");
    } catch (error) {
      console.error("Customer dashboard load failed:", error);
      tableWrap.innerHTML = `<div class="crm-error">Customers could not be loaded.</div>`;
      setMessage(`Could not load customers: ${error.message}`, true);
    } finally {
      loading = false;
    }
  }

  function renderTable(rows) {
    const size = Number(pageSize.value);
    const pageCount = Math.max(1, Math.ceil(total / size));
    if (page > pageCount) { page = pageCount; loadCustomers(); return; }
    previous.disabled = page <= 1;
    next.disabled = page >= pageCount;
    pageText.textContent = `Page ${page} of ${pageCount} · ${total} customer${total === 1 ? "" : "s"}`;
    if (!rows.length) { tableWrap.innerHTML = `<div class="crm-empty">No customer records found.</div>`; return; }
    tableWrap.innerHTML = `<table class="crm-table"><thead><tr><th>Customer</th><th>Company</th><th>Phone</th><th>Email</th><th>Quotes</th><th>Bookings</th><th>Last Activity</th></tr></thead><tbody>${rows.map((customer) => `<tr><td><button class="crm-customer-button" data-customer-id="${escapeHTML(customer.id)}" type="button">${escapeHTML(displayName(customer))}</button>${customer.archived ? '<span class="crm-archived-badge">Archived</span>' : ""}</td><td>${escapeHTML(customer.company || "—")}</td><td>${customer.phone ? `<a href="tel:${escapeHTML(customer.phone.replace(/[^+\d]/g, ""))}">${escapeHTML(customer.phone)}</a>` : "—"}</td><td>${customer.email ? `<a href="mailto:${escapeHTML(customer.email)}">${escapeHTML(customer.email)}</a>` : "—"}</td><td>${Number(customer.quote_count || 0)}</td><td>${Number(customer.booking_count || 0)}</td><td>${escapeHTML(dateText(customer.last_activity, true))}</td></tr>`).join("")}</tbody></table>`;
    tableWrap.querySelectorAll("[data-customer-id]").forEach((button) => button.addEventListener("click", () => openCustomer(button.dataset.customerId)));
  }

  function detailList(items, kind) {
    if (!items.length) return `<div class="crm-empty">No ${kind.toLowerCase()} found.</div>`;
    return `<div class="crm-list">${items.map((item) => kind === "Quotes"
      ? `<div class="crm-list-item"><strong>Quote #${escapeHTML(item.id)} · ${escapeHTML(item.status || "New")}</strong><span>${escapeHTML(item.event_type || item.menu || "Catering request")}</span><small>${escapeHTML(dateText(item.event_date))} · ${escapeHTML(currency(item.budget))}</small></div>`
      : `<div class="crm-list-item"><strong>${escapeHTML(item.event_title)}</strong><span>${escapeHTML(item.status)} · ${escapeHTML(item.event_type)}</span><small>${escapeHTML(dateText(item.event_date))} · ${escapeHTML(item.start_time || "")}</small></div>`).join("")}</div>`;
  }

  async function openCustomer(id) {
    previousFocus = document.activeElement;
    activeCustomerId = id;
    modal.hidden = false;
    modalBody.innerHTML = `<div class="crm-loading">Loading customer details…</div>`;
    try {
      const detail = await window.crmService.getCustomerDetail(id);
      let financial = { invoices: [], summary: { total_invoiced: 0, total_paid: 0, outstanding_balance: 0, overdue_count: 0, last_payment_date: null } };
      if (window.invoiceService) {
        try {
          const [invoices, summary] = await Promise.all([
            window.invoiceService.customerInvoices(id),
            window.invoiceService.customerSummary(id)
          ]);
          financial = { invoices, summary };
        } catch (invoiceError) {
          console.warn("Customer invoicing details are unavailable:", invoiceError.message);
        }
      }
      renderDetail({ ...detail, financial });
      modalClose.focus();
    } catch (error) {
      console.error("Customer detail load failed:", error);
      modalBody.innerHTML = `<div class="crm-error">Customer details could not be loaded: ${escapeHTML(error.message)}</div>`;
    }
  }

  function newCustomer() {
    previousFocus = document.activeElement;
    activeCustomerId = null;
    modal.hidden = false;
    renderDetail({
      customer: { first_name: "", last_name: "", company: "", email: "", phone: "", secondary_phone: "", billing_address: "", event_address: "", notes: "", archived: false },
      quotes: [], bookings: [], activities: [], financial: { invoices: [], summary: { total_invoiced: 0, total_paid: 0, outstanding_balance: 0, overdue_count: 0, last_payment_date: null } }
    });
    document.getElementById("customerDetailTitle").textContent = "New Customer";
    modalClose.focus();
  }

  function renderDetail({ customer, quotes, bookings, activities, financial = { invoices: [], summary: {} } }) {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = bookings.filter((item) => item.event_date >= today && !["Cancelled", "Completed"].includes(item.status));
    const past = bookings.filter((item) => item.event_date < today || item.status === "Completed");
    const lastBooking = bookings.find((item) => item.status !== "Cancelled");
    const lastContact = activities[0]?.created_at;
    const invoiceList = financial.invoices.length ? `<div class="crm-list">${financial.invoices.map((invoice) => `<div class="crm-list-item"><button class="crm-customer-button" type="button" data-customer-invoice="${escapeHTML(invoice.id)}">${escapeHTML(invoice.invoice_number || "Draft Invoice")}</button><span>${escapeHTML(window.invoiceUtils ? window.invoiceUtils.effectiveLabel(window.invoiceUtils.effectiveStatus(invoice)) : invoice.lifecycle_status)}</span><small>${escapeHTML(currency(invoice.total_amount))} · Balance ${escapeHTML(currency(invoice.balance_due))}</small></div>`).join("")}</div>` : '<div class="crm-empty">No invoices found.</div>';
    modalBody.innerHTML = `<div class="crm-detail-heading"><div><h2 id="customerDetailTitle">${escapeHTML(displayName(customer))}</h2><p>${escapeHTML(customer.company || "Individual customer")}</p></div>${customer.archived ? '<span class="crm-archived-badge">Archived</span>' : ""}</div><div class="crm-stats"><div class="crm-stat"><span>Total Quotes</span><strong>${quotes.length}</strong></div><div class="crm-stat"><span>Total Bookings</span><strong>${bookings.length}</strong></div><div class="crm-stat"><span>Total Invoiced</span><strong>${escapeHTML(currency(financial.summary.total_invoiced || 0))}</strong></div><div class="crm-stat"><span>Total Paid</span><strong>${escapeHTML(currency(financial.summary.total_paid || 0))}</strong></div><div class="crm-stat"><span>Outstanding</span><strong>${escapeHTML(currency(financial.summary.outstanding_balance || 0))}</strong></div><div class="crm-stat"><span>Last Contact</span><strong>${escapeHTML(dateText(lastContact))}</strong></div><div class="crm-stat"><span>Last Booking</span><strong>${escapeHTML(dateText(lastBooking?.event_date))}</strong></div></div><form id="customerDetailForm" data-original-archived="${customer.archived}" novalidate><div class="crm-form-grid"><label><span>First Name</span><input name="first_name" value="${escapeHTML(customer.first_name)}"></label><label><span>Last Name</span><input name="last_name" value="${escapeHTML(customer.last_name)}"></label><label><span>Company</span><input name="company" value="${escapeHTML(customer.company)}"></label><label><span>Email</span><input name="email" type="email" value="${escapeHTML(customer.email)}"></label><label><span>Phone</span><input name="phone" type="tel" value="${escapeHTML(customer.phone)}"></label><label><span>Secondary Phone</span><input name="secondary_phone" type="tel" value="${escapeHTML(customer.secondary_phone)}"></label><label class="wide"><span>Billing Address</span><textarea name="billing_address">${escapeHTML(customer.billing_address)}</textarea></label><label class="wide"><span>Event Address</span><textarea name="event_address">${escapeHTML(customer.event_address)}</textarea></label><label class="wide"><span>Internal Notes</span><textarea name="notes">${escapeHTML(customer.notes)}</textarea></label><label><span>Status</span><select name="archived"><option value="false" ${customer.archived ? "" : "selected"}>Active</option><option value="true" ${customer.archived ? "selected" : ""}>Archived</option></select></label></div><p id="customerFormMessage" class="crm-form-message" role="status" aria-live="polite"></p><div class="crm-detail-actions"><button class="save-button" type="submit">Save Customer</button><button id="customerCancelButton" class="crm-secondary-button" type="button">Close</button></div></form><div class="crm-two-column"><section class="crm-section"><h3>Upcoming Events</h3>${detailList(upcoming, "Bookings")}</section><section class="crm-section"><h3>Past Events</h3>${detailList(past, "Bookings")}</section><section class="crm-section"><h3>All Quotes</h3>${detailList(quotes, "Quotes")}</section><section class="crm-section"><h3>All Bookings</h3>${detailList(bookings, "Bookings")}</section><section class="crm-section"><h3>Invoices & Payments</h3>${invoiceList}</section></div><section class="crm-section"><h3>Activity Timeline</h3>${activities.length ? `<ol class="crm-timeline">${activities.map((activity) => `<li><strong>${escapeHTML(activity.title)}</strong>${activity.details ? `<span>${escapeHTML(activity.details)}</span>` : ""}<small>${escapeHTML(dateText(activity.created_at, true))}</small></li>`).join("")}</ol>` : '<div class="crm-empty">No activity recorded yet.</div>'}</section>`;
    const form = document.getElementById("customerDetailForm");
    form.addEventListener("submit", saveCustomer);
    document.getElementById("customerCancelButton").addEventListener("click", closeModal);
    modalBody.querySelectorAll("[data-customer-invoice]").forEach((button) => button.addEventListener("click", () => {
      if (!window.invoiceManager) return;
      closeModal();
      showPanel("invoicesPanel");
      window.invoiceManager.openInvoice(button.dataset.customerInvoice);
    }));
  }

  async function saveCustomer(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formMessage = document.getElementById("customerFormMessage");
    const data = Object.fromEntries(new FormData(form).entries());
    data.archived = data.archived === "true";
    if (form.dataset.originalArchived === "false" && data.archived && !window.confirm("Archive this customer? Their quotes and bookings will remain available.")) return;
    formMessage.textContent = "Saving customer…";
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      if (!activeCustomerId) {
        activeCustomerId = await window.crmService.findOrCreateCustomer(data);
      }
      await window.crmService.updateCustomer(activeCustomerId, data);
      toast("Customer saved.");
      await Promise.all([openCustomer(activeCustomerId), loadCustomers()]);
    } catch (error) {
      console.error("Customer save failed:", error);
      formMessage.textContent = `Save failed: ${error.message}`;
      formMessage.classList.add("crm-error");
      toast("Customer could not be saved.", true);
    } finally {
      button.disabled = false;
    }
  }

  function closeModal() { modal.hidden = true; modalBody.innerHTML = ""; activeCustomerId = null; if (previousFocus) previousFocus.focus(); }

  search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 1; loadCustomers(); }, 250); });
  [archiveFilter, sort, pageSize].forEach((control) => control.addEventListener("change", () => { page = 1; loadCustomers(); }));
  previous.addEventListener("click", () => { if (page > 1) { page -= 1; loadCustomers(); } });
  next.addEventListener("click", () => { page += 1; loadCustomers(); });
  modalClose.addEventListener("click", closeModal);
  newCustomerButton.addEventListener("click", newCustomer);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") closeModal();
    if (event.key === "Tab") {
      const controls = [...modal.querySelectorAll('button:not([disabled]), input, select, textarea')].filter((control) => !control.hidden);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  window.customerCRM = { openCustomer, refresh: loadCustomers, toast };
  loadCustomers();
})();
