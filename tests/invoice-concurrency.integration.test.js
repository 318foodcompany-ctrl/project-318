const assert = require("node:assert/strict");
const test = require("node:test");

const url = process.env.INVOICE_TEST_SUPABASE_URL;
const anonKey = process.env.INVOICE_TEST_ANON_KEY;
const adminToken = process.env.INVOICE_TEST_ADMIN_TOKEN;
const serviceToken = process.env.INVOICE_TEST_SERVICE_ROLE_KEY;

if (!url || !anonKey || !adminToken || !serviceToken) {
  test("invoice number and payment concurrency", { skip: "Set all INVOICE_TEST_* environment variables for a disposable Supabase project" }, () => {});
} else {
  async function request(path, { method = "GET", token = adminToken, body, prefer = "return=representation" } = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { response, data };
  }

  test("invoice number and payment concurrency", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const customerIds = []; const invoiceIds = [];
    try {
      const customers = await request("customers", { method: "POST", body: [1, 2].map((number) => ({ first_name: "Concurrent", last_name: `${number} ${suffix}`, email: `invoice-race-${number}-${suffix}@example.invalid` })) });
      assert.equal(customers.response.ok, true, JSON.stringify(customers.data));
      customerIds.push(...customers.data.map((item) => item.id));
      const due = new Date(Date.now() + 1209600000).toISOString().slice(0, 10);
      for (const customerId of customerIds) {
        const created = await request("rpc/invoicing_create_invoice", { method: "POST", body: { p_customer_id: customerId, p_due_date: due, p_line_items: [{ position: 1, description: "Concurrent service", quantity: 1, unit_price: 100, taxable: false }] } });
        assert.equal(created.response.ok, true, JSON.stringify(created.data)); invoiceIds.push(created.data.id);
      }
      const issued = await Promise.all(invoiceIds.map((id) => request("rpc/invoicing_issue_invoice", { method: "POST", body: { p_invoice_id: id, p_issue_date: new Date().toISOString().slice(0, 10), p_due_date: due } })));
      issued.forEach((result) => assert.equal(result.response.ok, true, JSON.stringify(result.data)));
      assert.equal(new Set(issued.map((result) => result.data.invoice_number)).size, 2);

      const paymentBody = { p_invoice_id: invoiceIds[0], p_amount: 100, p_payment_date: new Date().toISOString().slice(0, 10), p_payment_method: "cash", p_entry_type: "payment" };
      const payments = await Promise.all([request("rpc/invoicing_record_payment", { method: "POST", body: paymentBody }), request("rpc/invoicing_record_payment", { method: "POST", body: paymentBody })]);
      assert.equal(payments.filter((result) => result.response.ok).length, 1);
      assert.equal(payments.filter((result) => !result.response.ok).length, 1);
      const finalInvoice = await request(`invoices?id=eq.${invoiceIds[0]}&select=paid_amount,balance_due`);
      assert.equal(Number(finalInvoice.data[0].paid_amount), 100);
      assert.equal(Number(finalInvoice.data[0].balance_due), 0);
    } finally {
      for (const id of invoiceIds) {
        await request(`customer_activities?invoice_id=eq.${id}`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
        await request(`payments?invoice_id=eq.${id}`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
        await request(`invoices?id=eq.${id}`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
      }
      if (customerIds.length) await request(`customers?id=in.(${customerIds.join(",")})`, { method: "DELETE", token: serviceToken, prefer: "return=minimal" });
    }
  });
}
