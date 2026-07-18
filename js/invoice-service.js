(function () {
  "use strict";

  function client() {
    if (!window.supabaseClient) throw new Error("Supabase is unavailable.");
    return window.supabaseClient;
  }

  async function rpc(name, parameters) {
    const { data, error } = await client().rpc(name, parameters);
    if (error) throw error;
    return data;
  }

  async function dashboard({ search = "", status = "", overdueOnly = false, sort = "created_desc", page = 1, pageSize = 20 } = {}) {
    const data = await rpc("invoicing_dashboard", {
      p_search: search,
      p_status: status,
      p_overdue_only: overdueOnly,
      p_sort: sort,
      p_page: page,
      p_page_size: pageSize
    });
    return { rows: data || [], total: Number(data?.[0]?.total_count || 0) };
  }

  async function createInvoice(payload) {
    return rpc("invoicing_create_invoice", {
      p_customer_id: payload.customer_id,
      p_quote_id: payload.quote_id || null,
      p_booking_id: payload.booking_id || null,
      p_due_date: payload.due_date || null,
      p_discount_amount: payload.discount_amount || 0,
      p_tax_rate: payload.tax_rate || 0,
      p_required_deposit_amount: payload.required_deposit_amount || 0,
      p_customer_notes: payload.customer_notes || "",
      p_internal_notes: payload.internal_notes || "",
      p_terms: payload.terms || "",
      p_line_items: window.invoiceUtils.normalizeLines(payload.line_items || [])
    });
  }

  async function updateDraft(id, version, payload) {
    return rpc("invoicing_update_draft", {
      p_invoice_id: id,
      p_expected_version: version,
      p_due_date: payload.due_date || null,
      p_discount_amount: payload.discount_amount || 0,
      p_tax_rate: payload.tax_rate || 0,
      p_required_deposit_amount: payload.required_deposit_amount || 0,
      p_customer_notes: payload.customer_notes || "",
      p_internal_notes: payload.internal_notes || "",
      p_terms: payload.terms || "",
      p_line_items: window.invoiceUtils.normalizeLines(payload.line_items || [])
    });
  }

  async function issueInvoice(id, issueDate, dueDate) {
    return rpc("invoicing_issue_invoice", { p_invoice_id: id, p_issue_date: issueDate, p_due_date: dueDate });
  }

  async function voidInvoice(id, reason) {
    return rpc("invoicing_void_invoice", { p_invoice_id: id, p_reason: reason });
  }

  async function recordPayment(id, payment) {
    return rpc("invoicing_record_payment", {
      p_invoice_id: id,
      p_amount: payment.amount,
      p_payment_date: payment.payment_date,
      p_payment_method: payment.payment_method,
      p_reference_number: payment.reference_number || "",
      p_entry_type: payment.entry_type || "payment",
      p_notes: payment.notes || ""
    });
  }

  async function reversePayment(id, reason) {
    return rpc("invoicing_reverse_payment", { p_payment_id: id, p_reason: reason });
  }

  async function getInvoice(id) {
    const [invoiceResult, lineResult, paymentResult] = await Promise.all([
      client().from("invoices").select("*").eq("id", id).single(),
      client().from("invoice_line_items").select("*").eq("invoice_id", id).order("position"),
      client().from("payments").select("*").eq("invoice_id", id).order("created_at", { ascending: false })
    ]);
    const failed = [invoiceResult, lineResult, paymentResult].find((result) => result.error);
    if (failed) throw failed.error;
    return { invoice: invoiceResult.data, lineItems: lineResult.data || [], payments: paymentResult.data || [] };
  }

  async function customerSummary(customerId) {
    const data = await rpc("invoicing_customer_summary", { p_customer_id: customerId });
    return data?.[0] || { total_invoiced: 0, total_paid: 0, outstanding_balance: 0, overdue_count: 0, last_payment_date: null };
  }

  async function customerInvoices(customerId) {
    const { data, error } = await client().from("invoices").select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function findBySource({ quoteId = null, bookingId = null } = {}) {
    const sourceQueries = [];
    if (bookingId) sourceQueries.push(["booking_id", bookingId]);
    if (quoteId) sourceQueries.push(["quote_id", quoteId]);
    for (const [column, value] of sourceQueries) {
      const { data, error } = await client()
        .from("invoices")
        .select("id,lifecycle_status,quote_id,booking_id")
        .neq("lifecycle_status", "void")
        .eq(column, value)
        .limit(1);
      if (error) throw error;
      if (data?.[0]) return data[0];
    }
    return null;
  }

  async function summary() {
    const data = await rpc("invoicing_summary", {});
    return data?.[0] || { total_invoiced: 0, total_paid: 0, outstanding_balance: 0, overdue_count: 0, draft_count: 0 };
  }

  window.invoiceService = {
    createInvoice,
    customerInvoices,
    customerSummary,
    dashboard,
    findBySource,
    getInvoice,
    issueInvoice,
    recordPayment,
    reversePayment,
    summary,
    updateDraft,
    voidInvoice
  };
  document.dispatchEvent(new CustomEvent("invoice-service-ready"));
})();
