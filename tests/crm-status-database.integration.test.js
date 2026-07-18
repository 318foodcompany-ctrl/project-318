const assert = require("node:assert/strict");
const test = require("node:test");

const url = process.env.CRM_TEST_SUPABASE_URL;
const anonKey = process.env.CRM_TEST_ANON_KEY;
const adminToken = process.env.CRM_TEST_ADMIN_TOKEN;

if (!url || !anonKey || !adminToken) {
  test("CRM quote-status policy and timeline flow", {
    skip: "Set CRM_TEST_SUPABASE_URL, CRM_TEST_ANON_KEY, and CRM_TEST_ADMIN_TOKEN"
  }, () => {});
} else {
  async function request(path, { method = "GET", token = adminToken, body } = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return { response, data: text ? JSON.parse(text) : null };
  }

  test("CRM quote-status policy and timeline flow", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `crm-status-${suffix}@example.invalid`;
    let quoteId;
    let customerId;
    try {
      const submitted = await request("rpc/submit_quote_with_customer", {
        method: "POST",
        token: anonKey,
        body: {
          p_name: "CRM Status Test",
          p_company: `CRM Status ${suffix}`,
          p_email: email,
          p_phone: `31888${String(Date.now()).slice(-6)}`,
          p_event_date: new Date().toISOString().slice(0, 10),
          p_guests: 25,
          p_menu: "Taco Bar",
          p_event_type: "Corporate",
          p_budget: 500,
          p_notes: "Status policy integration test"
        }
      });
      assert.equal(submitted.response.ok, true, JSON.stringify(submitted.data));

      const quotes = await request(`leads?email=eq.${encodeURIComponent(email)}&select=id,customer_id,status`);
      assert.equal(quotes.data.length, 1);
      ({ id: quoteId, customer_id: customerId } = quotes.data[0]);

      const anonymousUpdate = await request(`leads?id=eq.${quoteId}`, {
        method: "PATCH",
        token: anonKey,
        body: { status: "Booked" }
      });
      assert.equal(anonymousUpdate.response.ok, false);

      const adminUpdate = await request(`leads?id=eq.${quoteId}&select=id,status`, {
        method: "PATCH",
        body: { status: "Booked" }
      });
      assert.equal(adminUpdate.response.ok, true, JSON.stringify(adminUpdate.data));
      assert.equal(adminUpdate.data.length, 1);
      assert.equal(adminUpdate.data[0].status, "Booked");

      const persisted = await request(`leads?id=eq.${quoteId}&select=status`);
      assert.deepEqual(persisted.data, [{ status: "Booked" }]);

      const activities = await request(
        `customer_activities?customer_id=eq.${customerId}&quote_id=eq.${quoteId}&activity_type=eq.quote_status_changed&select=id`
      );
      assert.equal(activities.data.length, 1);
    } finally {
      if (quoteId) await request(`leads?id=eq.${quoteId}`, { method: "DELETE" });
      if (customerId) await request(`customers?id=eq.${customerId}`, { method: "DELETE" });
    }
  });
}
