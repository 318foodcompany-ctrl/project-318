(function () {
  "use strict";
  const panel = document.getElementById("invoicesPanel");
  if (!panel || !window.invoiceService || !window.invoiceUtils || !window.crmService) return;

  const $ = (id) => document.getElementById(id);
  const tableWrap = $("invoiceTableWrap");
  const managerMessage = $("invoiceManagerMessage");
  const search = $("invoiceSearch");
  const statusFilter = $("invoiceStatusFilter");
  const overdueOnly = $("invoiceOverdueOnly");
  const sort = $("invoiceSort");
  const pageSize = $("invoicePageSize");
  const previous = $("invoicePreviousPage");
  const next = $("invoiceNextPage");
  const pageText = $("invoicePageText");
  const modal = $("invoiceModal");
  const form = $("invoiceForm");
  const linesWrap = $("invoiceLineItems");
  const customerSearch = $("invoiceCustomerSearch");
  const customerMatches = $("invoiceCustomerMatches");
  const paymentSection = $("invoicePaymentSection");
  const paymentForm = $("invoicePaymentForm");
  const reasonPrompt = $("invoiceReasonPrompt");
  const reasonInput = $("invoiceReasonInput");
  const reasonConfirm = $("invoiceReasonConfirm");
  const utils = window.invoiceUtils;
  const escapeHTML = window.crmUtils.escapeHTML;
  let page = 1;
  let total = 0;
  let loading = false;
  let saving = false;
  let currentDetail = null;
  let pendingReasonAction = null;
  let searchTimer;
  let customerTimer;
  let previousFocus = null;

  function setMessage(element, text, error = false) {
    element.textContent = text;
    element.classList.toggle("error", error);
  }

  function effectiveStatus(invoice) {
    return utils.effectiveStatus(invoice);
  }

  function statusBadge(status) {
    return `<span class="invoice-status status-${escapeHTML(status)}">${escapeHTML(utils.effectiveLabel(status))}</span>`;
  }

  async function loadDashboard() {
    if (loading) return;
    loading = true;
    tableWrap.innerHTML = `<div class="invoice-loading">Loading invoices…</div>`;
    setMessage(managerMessage, "Loading invoices…");
    try {
      const [result, summary] = await Promise.all([
        window.invoiceService.dashboard({ search: search.value, status: statusFilter.value, overdueOnly: overdueOnly.checked, sort: sort.value, page, pageSize: Number(pageSize.value) }),
        window.invoiceService.summary()
      ]);
      total = result.total;
      renderTable(result.rows);
      $("invoiceTotalInvoiced").textContent = utils.currency(summary.total_invoiced);
      $("invoiceTotalPaid").textContent = utils.currency(summary.total_paid);
      $("invoiceOutstanding").textContent = utils.currency(summary.outstanding_balance);
      $("invoiceOverdueCount").textContent = Number(summary.overdue_count || 0);
      $("invoiceDraftCount").textContent = Number(summary.draft_count || 0);
      setMessage(managerMessage, result.rows.length ? "" : "No invoices match the selected filters.");
    } catch (error) {
      console.error("Invoice dashboard load failed:", error);
      tableWrap.innerHTML = `<div class="invoice-empty">Invoices could not be loaded. Confirm the invoicing migration has been applied.</div>`;
      setMessage(managerMessage, `Could not load invoices: ${error.message}`, true);
    } finally { loading = false; }
  }

  function renderTable(rows) {
    const count = Math.max(1, Math.ceil(total / Number(pageSize.value)));
    previous.disabled = page <= 1;
    next.disabled = page >= count;
    pageText.textContent = `Page ${page} of ${count} · ${total} invoice${total === 1 ? "" : "s"}`;
    if (!rows.length) { tableWrap.innerHTML = `<div class="invoice-empty">No invoices found.</div>`; return; }
    tableWrap.innerHTML = `<table class="invoice-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Company</th><th>Source</th><th>Issued</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows.map((invoice) => `<tr><td><button class="invoice-open" type="button" data-invoice-id="${escapeHTML(invoice.id)}">${escapeHTML(invoice.invoice_number || "Draft")}</button></td><td>${escapeHTML(invoice.customer_name || "—")}</td><td>${escapeHTML(invoice.company || "—")}</td><td>${invoice.booking_id ? `Booking #${escapeHTML(invoice.booking_id)}` : invoice.quote_id ? `Quote #${escapeHTML(invoice.quote_id)}` : "Manual"}</td><td>${escapeHTML(utils.dateText(invoice.issue_date))}</td><td>${escapeHTML(utils.dateText(invoice.due_date))}</td><td>${escapeHTML(utils.currency(invoice.total_amount))}</td><td>${escapeHTML(utils.currency(invoice.paid_amount))}</td><td>${escapeHTML(utils.currency(invoice.balance_due))}</td><td>${statusBadge(invoice.status)}</td></tr>`).join("")}</tbody></table>`;
    tableWrap.querySelectorAll("[data-invoice-id]").forEach((button) => button.addEventListener("click", () => openInvoice(button.dataset.invoiceId)));
  }

  function addDays(value, days) {
    const date = value ? new Date(`${value}T12:00:00`) : new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function lineMarkup(line = {}) {
    return `<div class="invoice-line"><label>Position<input class="line-position" type="number" min="1" step="1" value="${escapeHTML(line.position || linesWrap.children.length + 1)}"></label><label>Description<input class="line-description" value="${escapeHTML(line.description || "")}" required></label><label>Quantity<input class="line-quantity" type="number" min="0.001" step="0.001" value="${escapeHTML(line.quantity ?? 1)}" required></label><label>Unit price<input class="line-price" type="number" min="0" step="0.01" value="${escapeHTML(line.unit_price ?? 0)}" required></label><label class="invoice-taxable"><input class="line-taxable" type="checkbox" ${line.taxable === false ? "" : "checked"}> Taxable</label><button class="invoice-line-remove" type="button" aria-label="Remove line item">×</button></div>`;
  }

  function addLine(line) {
    linesWrap.insertAdjacentHTML("beforeend", lineMarkup(line));
    const row = linesWrap.lastElementChild;
    row.querySelector(".invoice-line-remove").addEventListener("click", () => { row.remove(); renumberLines(); updateEstimate(); });
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateEstimate));
  }

  function renumberLines() {
    [...linesWrap.children].forEach((row, index) => { row.querySelector(".line-position").value = index + 1; });
  }

  function collectLines() {
    return [...linesWrap.querySelectorAll(".invoice-line")].map((row) => ({
      position: Number(row.querySelector(".line-position").value),
      description: row.querySelector(".line-description").value,
      quantity: row.querySelector(".line-quantity").value,
      unit_price: row.querySelector(".line-price").value,
      taxable: row.querySelector(".line-taxable").checked
    }));
  }

  function updateEstimate() {
    const estimated = utils.estimate(collectLines(), $("invoiceDiscount").value, $("invoiceTaxRate").value);
    $("invoiceSubtotal").textContent = utils.currency(estimated.subtotal);
    $("invoiceDiscountDisplay").textContent = utils.currency(estimated.discount);
    $("invoiceTaxDisplay").textContent = utils.currency(estimated.tax);
    $("invoiceTotal").textContent = utils.currency(estimated.total);
    if (!currentDetail) $("invoiceBalance").textContent = utils.currency(estimated.total);
  }

  function resetModal(prefill = {}) {
    form.reset();
    currentDetail = null;
    setEditable(true);
    $("invoiceId").value = ""; $("invoiceVersion").value = "";
    $("invoiceCustomerId").value = prefill.customer_id || "";
    $("invoiceQuoteId").value = prefill.quote_id || "";
    $("invoiceBookingId").value = prefill.booking_id || "";
    customerSearch.value = prefill.customer_name || "";
    $("invoiceDueDate").value = prefill.due_date || addDays(null, 14);
    $("invoiceTaxRate").value = prefill.tax_rate ?? 0;
    $("invoiceDiscount").value = prefill.discount_amount ?? 0;
    $("invoiceDepositRequired").value = prefill.required_deposit_amount ?? 0;
    $("invoiceCustomerNotes").value = prefill.customer_notes || "";
    $("invoiceInternalNotes").value = prefill.internal_notes || "";
    $("invoiceTerms").value = prefill.terms || "Payment is due by the invoice due date.";
    linesWrap.innerHTML = "";
    (prefill.line_items?.length ? prefill.line_items : [{ description: "", quantity: 1, unit_price: 0, taxable: true }]).forEach(addLine);
    $("invoiceModalTitle").textContent = "New Invoice";
    $("invoiceModalSubtitle").textContent = prefill.source_label || "Create a draft invoice.";
    $("invoiceModalStatus").className = "invoice-status status-draft";
    $("invoiceModalStatus").textContent = "Draft";
    $("invoiceSaveButton").hidden = false; $("invoiceIssueButton").hidden = true; $("invoiceVoidButton").hidden = true;
    paymentSection.hidden = true;
    setMessage($("invoiceFormMessage"), "");
    $("invoicePaid").textContent = utils.currency(0);
    updateEstimate();
  }

  function openModal() { previousFocus = document.activeElement; modal.hidden = false; $("invoiceModalClose").focus(); }
  function closeModal() { closeReasonPrompt(); modal.hidden = true; customerMatches.hidden = true; currentDetail = null; if (previousFocus) previousFocus.focus(); }

  function payload() {
    return {
      customer_id: $("invoiceCustomerId").value,
      quote_id: $("invoiceQuoteId").value || null,
      booking_id: $("invoiceBookingId").value || null,
      due_date: $("invoiceDueDate").value || null,
      discount_amount: utils.money($("invoiceDiscount").value),
      tax_rate: utils.decimal($("invoiceTaxRate").value, 0),
      required_deposit_amount: utils.money($("invoiceDepositRequired").value),
      customer_notes: $("invoiceCustomerNotes").value.trim(),
      internal_notes: $("invoiceInternalNotes").value.trim(),
      terms: $("invoiceTerms").value.trim(),
      line_items: collectLines()
    };
  }

  function validate(data) {
    if (!data.customer_id) return "Select an existing customer.";
    const lineError = utils.validateLines(data.line_items, { required: true });
    if (lineError) return lineError;
    const estimate = utils.estimate(data.line_items, data.discount_amount, data.tax_rate);
    if (data.discount_amount > estimate.subtotal) return "Discount cannot exceed the subtotal.";
    if (data.required_deposit_amount > estimate.total) return "Required deposit cannot exceed the total.";
    return "";
  }

  async function saveDraft(event) {
    if (event) event.preventDefault();
    if (saving) return null;
    const data = payload();
    const validation = validate(data);
    if (validation) { setMessage($("invoiceFormMessage"), validation, true); return null; }
    saving = true; $("invoiceSaveButton").disabled = true; setMessage($("invoiceFormMessage"), "Saving draft…");
    try {
      const saved = $("invoiceId").value
        ? await window.invoiceService.updateDraft($("invoiceId").value, Number($("invoiceVersion").value), data)
        : await window.invoiceService.createInvoice(data);
      await openInvoice(saved.id, { preserveFocus: true });
      await loadDashboard();
      setMessage($("invoiceFormMessage"), "Draft saved successfully.");
      return saved;
    } catch (error) {
      console.error("Invoice draft save failed:", error);
      setMessage($("invoiceFormMessage"), `Save failed: ${error.message}`, true);
      return null;
    } finally { saving = false; $("invoiceSaveButton").disabled = false; }
  }

  function setEditable(editable) {
    form.querySelectorAll("input:not([type=hidden]),textarea").forEach((control) => { control.disabled = !editable; });
    $("invoiceAddLine").hidden = !editable;
    linesWrap.querySelectorAll("button").forEach((button) => { button.hidden = !editable; });
    customerSearch.disabled = !editable;
    $("invoiceSaveButton").hidden = !editable;
  }

  async function openInvoice(id, { preserveFocus = false } = {}) {
    if (!preserveFocus) { previousFocus = document.activeElement; modal.hidden = false; }
    setMessage($("invoiceFormMessage"), "Loading invoice…");
    try {
      const detail = await window.invoiceService.getInvoice(id);
      currentDetail = detail;
      const invoice = detail.invoice;
      const customer = await window.crmService.getCustomer(invoice.customer_id);
      $("invoiceId").value = invoice.id; $("invoiceVersion").value = invoice.version; $("invoiceCustomerId").value = invoice.customer_id;
      $("invoiceQuoteId").value = invoice.quote_id || ""; $("invoiceBookingId").value = invoice.booking_id || "";
      customerSearch.value = window.crmUtils.displayName(customer);
      $("invoiceDueDate").value = invoice.due_date || ""; $("invoiceTaxRate").value = invoice.tax_rate; $("invoiceDiscount").value = invoice.discount_amount;
      $("invoiceDepositRequired").value = invoice.required_deposit_amount; $("invoiceCustomerNotes").value = invoice.customer_notes; $("invoiceInternalNotes").value = invoice.internal_notes; $("invoiceTerms").value = invoice.terms;
      linesWrap.innerHTML = ""; detail.lineItems.forEach(addLine);
      const status = effectiveStatus(invoice);
      $("invoiceModalTitle").textContent = invoice.invoice_number || "Draft Invoice";
      $("invoiceModalSubtitle").textContent = [invoice.quote_id ? `Quote #${invoice.quote_id}` : "", invoice.booking_id ? `Booking #${invoice.booking_id}` : ""].filter(Boolean).join(" · ") || "Manual invoice";
      $("invoiceModalStatus").className = `invoice-status status-${status}`; $("invoiceModalStatus").textContent = utils.effectiveLabel(status);
      $("invoiceSubtotal").textContent = utils.currency(invoice.subtotal); $("invoiceDiscountDisplay").textContent = utils.currency(invoice.discount_amount); $("invoiceTaxDisplay").textContent = utils.currency(invoice.tax_amount); $("invoiceTotal").textContent = utils.currency(invoice.total_amount); $("invoicePaid").textContent = utils.currency(invoice.paid_amount); $("invoiceBalance").textContent = utils.currency(invoice.balance_due);
      setEditable(invoice.lifecycle_status === "draft");
      $("invoiceIssueButton").hidden = invoice.lifecycle_status !== "draft";
      $("invoiceVoidButton").hidden = invoice.lifecycle_status === "void";
      paymentSection.hidden = invoice.lifecycle_status !== "sent";
      setMessage($("paymentMessage"), "");
      renderPayments(detail.payments);
      setMessage($("invoiceFormMessage"), "");
      modal.hidden = false;
    } catch (error) {
      console.error("Invoice load failed:", error);
      setMessage($("invoiceFormMessage"), `Invoice could not be loaded: ${error.message}`, true);
    }
  }

  function renderPayments(payments) {
    const wrap = $("invoicePaymentHistory");
    if (!payments.length) { wrap.innerHTML = `<div class="invoice-empty">No payments recorded.</div>`; return; }
    const reversibleIds = utils.reversiblePaymentIds(payments);
    wrap.innerHTML = `<div class="invoice-payment-history">${payments.map((payment) => `<div class="invoice-payment-row"><div><strong>${escapeHTML(utils.effectiveLabel(payment.entry_type))} · ${escapeHTML(utils.currency(payment.amount))}</strong><div>${escapeHTML(payment.payment_method)}${payment.reference_number ? ` · ${escapeHTML(payment.reference_number)}` : ""}</div><small>${escapeHTML(utils.dateText(payment.payment_date))}</small></div><span>${escapeHTML(payment.notes || "")}</span>${reversibleIds.has(payment.id) ? `<button class="crm-secondary-button" type="button" data-reverse-payment="${escapeHTML(payment.id)}">Reverse</button>` : ["payment","deposit"].includes(payment.entry_type) ? '<span class="invoice-reversed-label">Reversed</span>' : ""}</div>`).join("")}</div>`;
    wrap.querySelectorAll("[data-reverse-payment]").forEach((button) => button.addEventListener("click", () => reversePayment(button.dataset.reversePayment)));
  }

  async function issueInvoice() {
    const saved = await saveDraft();
    if (!saved) return;
    const issueDate = new Date().toISOString().slice(0, 10);
    try {
      setMessage($("invoiceFormMessage"), "Issuing invoice…");
      const issued = await window.invoiceService.issueInvoice(saved.id, issueDate, $("invoiceDueDate").value);
      await Promise.all([openInvoice(issued.id, { preserveFocus: true }), loadDashboard()]);
      setMessage($("invoiceFormMessage"), `Invoice ${issued.invoice_number} issued successfully.`);
    } catch (error) { setMessage($("invoiceFormMessage"), `Issue failed: ${error.message}`, true); }
  }

  function openReasonPrompt(action) {
    pendingReasonAction = action;
    $("invoiceReasonTitle").textContent = action.type === "void" ? "Void invoice" : "Reverse payment";
    $("invoiceReasonDescription").textContent = action.type === "void"
      ? "Enter the accounting reason for voiding this invoice."
      : "Enter the accounting reason for reversing this payment.";
    reasonInput.value = "";
    setMessage($("invoiceReasonMessage"), "");
    reasonPrompt.hidden = false;
    reasonInput.focus();
  }

  function closeReasonPrompt() {
    pendingReasonAction = null;
    reasonPrompt.hidden = true;
    reasonInput.value = "";
    reasonConfirm.disabled = false;
    setMessage($("invoiceReasonMessage"), "");
  }

  function voidInvoice() {
    if (currentDetail) openReasonPrompt({ type: "void" });
  }

  async function recordPayment(event) {
    event.preventDefault();
    if (!currentDetail) return;
    const data = { entry_type: $("paymentEntryType").value, amount: utils.money($("paymentAmount").value), payment_date: $("paymentDate").value, payment_method: $("paymentMethod").value, reference_number: $("paymentReference").value.trim(), notes: $("paymentNotes").value.trim() };
    if (!Number.isFinite(data.amount) || data.amount <= 0) { setMessage($("paymentMessage"), "Enter an amount greater than zero.", true); return; }
    $("paymentSaveButton").disabled = true; setMessage($("paymentMessage"), "Recording payment…");
    try {
      await window.invoiceService.recordPayment(currentDetail.invoice.id, data);
      paymentForm.reset(); $("paymentDate").value = new Date().toISOString().slice(0, 10);
      await Promise.all([openInvoice(currentDetail.invoice.id, { preserveFocus: true }), loadDashboard()]);
      setMessage($("paymentMessage"), "Payment recorded successfully.");
    } catch (error) { setMessage($("paymentMessage"), `Payment failed: ${error.message}`, true); }
    finally { $("paymentSaveButton").disabled = false; }
  }

  function reversePayment(id) {
    if (currentDetail) openReasonPrompt({ type: "reverse", paymentId: id });
  }

  async function confirmReasonAction() {
    if (!pendingReasonAction || !currentDetail) return;
    const action = pendingReasonAction;
    const invoiceId = currentDetail.invoice.id;
    const reason = reasonInput.value.trim();
    if (!reason) {
      setMessage($("invoiceReasonMessage"), "Enter a reason before continuing.", true);
      return;
    }
    reasonConfirm.disabled = true;
    setMessage($("invoiceReasonMessage"), "Saving accounting action…");
    try {
      if (action.type === "void") await window.invoiceService.voidInvoice(invoiceId, reason);
      else await window.invoiceService.reversePayment(action.paymentId, reason);
      closeReasonPrompt();
      await Promise.all([openInvoice(invoiceId, { preserveFocus: true }), loadDashboard()]);
      setMessage(
        action.type === "void" ? $("invoiceFormMessage") : $("paymentMessage"),
        action.type === "void"
          ? "Invoice voided. Accounting history was preserved."
          : "Payment reversal recorded."
      );
    } catch (error) {
      reasonConfirm.disabled = false;
      setMessage($("invoiceReasonMessage"), `${action.type === "void" ? "Void" : "Reversal"} failed: ${error.message}`, true);
    }
  }

  function renderCustomerMatches(matches) {
    customerMatches.hidden = false; customerSearch.setAttribute("aria-expanded", "true");
    customerMatches.innerHTML = matches.length ? matches.map((customer) => `<button class="crm-match-button" type="button" data-invoice-customer="${escapeHTML(customer.id)}"><strong>${escapeHTML(window.crmUtils.displayName(customer))}</strong><small>${escapeHTML([customer.company,customer.email,customer.phone].filter(Boolean).join(" / "))}</small></button>`).join("") : `<div class="crm-empty">No matching customer found.</div>`;
    customerMatches.querySelectorAll("[data-invoice-customer]").forEach((button) => button.addEventListener("click", () => { const customer=matches.find((item)=>item.id===button.dataset.invoiceCustomer); if(!customer)return; $("invoiceCustomerId").value=customer.id; customerSearch.value=window.crmUtils.displayName(customer); customerMatches.hidden=true; customerSearch.setAttribute("aria-expanded","false"); setMessage($("invoiceFormMessage"),"Customer selected."); }));
  }

  async function searchCustomers() {
    $("invoiceCustomerId").value = "";
    if (customerSearch.value.trim().length < 2) { customerMatches.hidden = true; return; }
    try { renderCustomerMatches(await window.crmService.searchCustomers(customerSearch.value)); }
    catch (error) { setMessage($("invoiceFormMessage"), `Customer search failed: ${error.message}`, true); }
  }

  async function openFromQuote(quote) {
    showPanel("invoicesPanel");
    if (!quote.customer_id) { setMessage(managerMessage, "Link this quote to a customer before creating an invoice.", true); return; }
    try {
      const existing = await window.invoiceService.findBySource({ quoteId: quote.id });
      if (existing) { await openInvoice(existing.id); setMessage(managerMessage, "The existing invoice for this quote was opened."); return; }
      const guests = Number(quote.guests || 0); const amount = Number(quote.budget || 0);
      resetModal({ customer_id: quote.customer_id, customer_name: quote.company || quote.name, quote_id: quote.id, due_date: addDays(null,14), source_label:`Quote #${quote.id}`, customer_notes: quote.notes || "", line_items:[{description:quote.menu || quote.event_type || "Catering services",quantity:guests>0?guests:1,unit_price:guests>0&&amount>0?amount/guests:amount,taxable:true}] }); openModal();
    } catch (error) { setMessage(managerMessage, `Could not create invoice from quote: ${error.message}`, true); }
  }

  async function openFromBooking(booking) {
    showPanel("invoicesPanel");
    if (!booking.customer_id) { setMessage(managerMessage, "Link this booking to a customer before creating an invoice.", true); return; }
    try {
      const existing = await window.invoiceService.findBySource({ bookingId: booking.id, quoteId: booking.quote_id });
      if (existing) { await openInvoice(existing.id); setMessage(managerMessage, "The existing invoice for this booking or its linked quote was opened."); return; }
      const guests=Number(booking.guest_count||0); const amount=Number(booking.quote_amount||0);
      resetModal({customer_id:booking.customer_id,customer_name:booking.company_name||booking.customer_name,quote_id:booking.quote_id,booking_id:booking.id,due_date:addDays(booking.event_date||null,0),source_label:`Booking #${booking.id}`,line_items:[{description:booking.event_title||"Catering services",quantity:guests>0?guests:1,unit_price:guests>0&&amount>0?amount/guests:amount,taxable:true}]}); openModal();
    } catch(error){setMessage(managerMessage,`Could not create invoice from booking: ${error.message}`,true);}
  }

  $("newInvoiceButton").addEventListener("click",()=>{resetModal();openModal();});
  $("invoiceAddLine").addEventListener("click",()=>addLine());
  form.addEventListener("submit",saveDraft); $("invoiceIssueButton").addEventListener("click",issueInvoice); $("invoiceVoidButton").addEventListener("click",voidInvoice); $("invoiceCancelButton").addEventListener("click",closeModal); $("invoiceModalClose").addEventListener("click",closeModal); paymentForm.addEventListener("submit",recordPayment);
  reasonConfirm.addEventListener("click", confirmReasonAction);
  $("invoiceReasonCancel").addEventListener("click", closeReasonPrompt);
  [$("invoiceDiscount"),$("invoiceTaxRate")].forEach((input)=>input.addEventListener("input",updateEstimate));
  [statusFilter,overdueOnly,sort,pageSize].forEach((control)=>control.addEventListener("change",()=>{page=1;loadDashboard();}));
  search.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=1;loadDashboard();},250);});
  customerSearch.addEventListener("input",()=>{clearTimeout(customerTimer);customerTimer=setTimeout(searchCustomers,250);});
  previous.addEventListener("click",()=>{if(page>1){page-=1;loadDashboard();}}); next.addEventListener("click",()=>{page+=1;loadDashboard();});
  modal.addEventListener("click",(event)=>{if(event.target===modal)closeModal();}); document.addEventListener("keydown",(event)=>{if(event.key==="Escape"&&!modal.hidden)closeModal();});
  $("paymentDate").value=new Date().toISOString().slice(0,10);

  window.invoiceManager={openFromQuote,openFromBooking,openInvoice,refresh:loadDashboard};
  document.dispatchEvent(new CustomEvent("invoice-manager-ready"));
  loadDashboard();
})();
