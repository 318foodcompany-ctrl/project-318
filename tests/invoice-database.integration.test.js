const assert = require("node:assert/strict");
const test = require("node:test");

const url = process.env.INVOICE_TEST_SUPABASE_URL;
const anonKey = process.env.INVOICE_TEST_ANON_KEY;
const adminToken = process.env.INVOICE_TEST_ADMIN_TOKEN;
const serviceToken = process.env.INVOICE_TEST_SERVICE_ROLE_KEY;

if (!url || !anonKey || !adminToken || !serviceToken) {
  test("invoice database security and integrity flow", { skip: "Set all INVOICE_TEST_* environment variables for a disposable Supabase project" }, () => {});
} else {
  async function request(path, { method = "GET", token = adminToken, body, prefer = "return=representation" } = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { response, data };
  }

  test("invoice database security and integrity flow", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let customerId; let invoiceId;
    try {
      const customer = await request("customers", { method: "POST", body: { first_name: "Invoice", last_name: `Test ${suffix}`, company: "Project 318 QA", email: `invoice-${suffix}@example.invalid` } });
      assert.equal(customer.response.ok, true, JSON.stringify(customer.data));
      customerId = customer.data[0].id;

      const anonymousRead = await request("invoices?select=id&limit=1", { token: anonKey });
      assert.equal(anonymousRead.response.ok, false);
      const directWrite = await request("invoices", { method: "POST", body: { customer_id: customerId } });
      assert.equal(directWrite.response.ok, false);

      const created = await request("rpc/invoicing_create_invoice", { method: "POST", body: { p_customer_id: customerId, p_due_date: new Date(Date.now() + 1209600000).toISOString().slice(0, 10), p_line_items: [{ position: 1, description: "Catering services", quantity: 1, unit_price: 100, taxable: true }] } });
      assert.equal(created.response.ok, true, JSON.stringify(created.data));
      invoiceId = created.data.id;
      assert.equal(Number(created.data.total_amount), 100);

      const issued = await request("rpc/invoicing_issue_invoice", { method: "POST", body: { p_invoice_id: invoiceId, p_issue_date: new Date().toISOString().slice(0, 10), p_due_date: new Date(Date.now() + 1209600000).toISOString().slice(0, 10) } });
      assert.equal(issued.response.ok, true, JSON.stringify(issued.data));
      assert.match(issued.data.invoice_number, /^318-\d{4}-\d{6}$/);

      const payment = await request("rpc/invoicing_record_payment", { method: "POST", body: { p_invoice_id: invoiceId, p_amount: 40, p_payment_date: new Date().toISOString().slice(0, 10), p_payment_method: "cash", p_entry_type: "deposit" } });
      assert.equal(payment.response.ok, true, JSON.stringify(payment.data));
      const invoice = await request(`invoices?id=eq.${invoiceId}&select=paid_amount,balance_due`);
      assert.equal(Number(invoice.data[0].paid_amount), 40);
      assert.equal(Number(invoice.data[0].balance_due), 60);

      const overpayment = await request("rpc/invoicing_record_payment", { method: "POST", body: { p_invoice_id: invoiceId, p_amount: 61, p_payment_date: new Date().toISOString().slice(0, 10), p_payment_method: "cash", p_entry_type: "payment" } });
      assert.equal(overpayment.response.ok, false);
      const activity = await request(`customer_activities?invoice_id=eq.${invoiceId}&payment_id=eq.${payment.data.id}&activity_type=eq.payment_recorded&select=id`);
      assert.equal(activity.data.length, 1);

      const reversal = await request("rpc/invoicing_reverse_payment", { method: "POST", body: { p_payment_id: payment.data.id, p_reason: "Automated integration test" } });
      assert.equal(reversal.response.ok, true, JSON.stringify(reversal.data));
      const afterReversal = await request(`invoices?id=eq.${invoiceId}&select=paid_amount,balance_due`);
      assert.equal(Number(afterReversal.data[0].paid_amount), 0);
      assert.equal(Number(afterReversal.data[0].balance_due), 100);
    } finally {
      if (invoiceId) {
        await request(`customer_activities?invoice_id=eq.${invoiceId}`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
        await request(`payments?invoice_id=eq.${invoiceId}`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
        await request(`invoices?id=eq.${invoiceId}`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
      }
      if (customerId) await request(`customers?id=eq.${customerId}`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
    }
  });
}
