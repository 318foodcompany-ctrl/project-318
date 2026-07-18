const assert = require("node:assert/strict");
const test = require("node:test");

const url = process.env.CRM_TEST_SUPABASE_URL;
const anonKey = process.env.CRM_TEST_ANON_KEY;
const adminToken = process.env.CRM_TEST_ADMIN_TOKEN;

if (!url || !anonKey || !adminToken) {
  test("CRM database identity and concurrency flow", { skip: "Set CRM_TEST_SUPABASE_URL, CRM_TEST_ANON_KEY, and CRM_TEST_ADMIN_TOKEN" }, () => {});
} else {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emailA = `crm-a-${suffix}@example.invalid`;
  const emailB = `crm-b-${suffix}@example.invalid`;
  const sharedEmail = `crm-race-${suffix}@example.invalid`;
  const phoneA = `31855${String(Date.now()).slice(-6)}`;
  const phoneB = `31866${String(Date.now()).slice(-6)}`;
  const sharedPhone = `31877${String(Date.now()).slice(-6)}`;

  async function request(path, { method = "GET", token = adminToken, body, prefer = "return=representation" } = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: prefer
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    return { response, data };
  }

  function quotePayload(email, phone, name = "CRM Race Customer") {
    return {
      p_name: name,
      p_company: `CRM Test ${suffix}`,
      p_email: email,
      p_phone: phone,
      p_event_date: new Date().toISOString().slice(0, 10),
      p_guests: 25,
      p_menu: "Taco Bar",
      p_event_type: "Corporate",
      p_budget: 500,
      p_notes: "Automated CRM database test"
    };
  }

  test("CRM database identity and concurrency flow", async () => {
    const createdCustomerIds = [];
    try {
      const fixture = await request("customers", {
        method: "POST",
        body: [
          { first_name: "Conflict", last_name: "Alpha", company: `Alpha ${suffix}`, email: emailA, phone: phoneA },
          { first_name: "Conflict", last_name: "Beta", company: `Beta ${suffix}`, email: emailB, phone: phoneB }
        ]
      });
      assert.equal(fixture.response.ok, true, JSON.stringify(fixture.data));
      createdCustomerIds.push(...fixture.data.map((customer) => customer.id));

      const beforeCustomers = await request(`customers?id=in.(${createdCustomerIds.join(",")})&select=*`);
      const beforeQuotes = await request(`leads?email=in.(${emailA},${emailB})&select=id`);

      const conflict = await request("rpc/submit_quote_with_customer", {
        method: "POST",
        token: anonKey,
        body: quotePayload(emailA, phoneB, "Anonymous Conflict")
      });
      assert.equal(conflict.response.ok, false);
      assert.equal(conflict.data.message, "Unable to submit quote with the supplied contact information");
      const serializedConflict = JSON.stringify(conflict.data);
      assert.equal(serializedConflict.includes(emailA), false);
      assert.equal(serializedConflict.includes(phoneB), false);
      assert.equal(createdCustomerIds.some((id) => serializedConflict.includes(id)), false);

      const afterCustomers = await request(`customers?id=in.(${createdCustomerIds.join(",")})&select=*`);
      const afterQuotes = await request(`leads?email=in.(${emailA},${emailB})&select=id`);
      assert.deepEqual(afterCustomers.data, beforeCustomers.data);
      assert.deepEqual(afterQuotes.data, beforeQuotes.data);

      const simultaneous = await Promise.all([
        request("rpc/submit_quote_with_customer", { method: "POST", token: anonKey, body: quotePayload(sharedEmail, sharedPhone) }),
        request("rpc/submit_quote_with_customer", { method: "POST", token: anonKey, body: quotePayload(sharedEmail, sharedPhone) })
      ]);
      simultaneous.forEach(({ response, data }) => assert.equal(response.ok, true, JSON.stringify(data)));

      const raceCustomers = await request(`customers?email=eq.${encodeURIComponent(sharedEmail)}&select=id,email`);
      assert.equal(raceCustomers.response.ok, true, JSON.stringify(raceCustomers.data));
      assert.equal(raceCustomers.data.length, 1);
      createdCustomerIds.push(raceCustomers.data[0].id);

      const raceQuotes = await request(`leads?email=eq.${encodeURIComponent(sharedEmail)}&select=id,customer_id`);
      assert.equal(raceQuotes.response.ok, true, JSON.stringify(raceQuotes.data));
      assert.equal(raceQuotes.data.length, 2);
      assert.deepEqual([...new Set(raceQuotes.data.map((quote) => quote.customer_id))], [raceCustomers.data[0].id]);
    } finally {
      await request(`leads?email=in.(${emailA},${emailB},${sharedEmail})`, { method: "DELETE", prefer: "return=minimal" });
      if (createdCustomerIds.length) {
        await request(`customers?id=in.(${createdCustomerIds.join(",")})`, { method: "DELETE", prefer: "return=minimal" });
      }
    }
  });
}
