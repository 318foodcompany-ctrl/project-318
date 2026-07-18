(function () {
  if (!window.crmUtils) return;

  function requireClient() {
    if (!window.supabaseClient) throw new Error("Supabase is unavailable.");
    return window.supabaseClient;
  }

  async function dashboard({ search = "", archived = false, sort = "activity_desc", page = 1, pageSize = 20 } = {}) {
    const { data, error } = await requireClient().rpc("crm_customer_dashboard", {
      p_search: search,
      p_archived: archived,
      p_sort: sort,
      p_page: page,
      p_page_size: pageSize
    });
    if (error) throw error;
    return { rows: data || [], total: Number(data?.[0]?.total_count || 0) };
  }

  async function searchCustomers(search, limit = 8) {
    const term = String(search || "").trim();
    if (term.length < 2) return [];
    const { data, error } = await requireClient().rpc("crm_customer_matches", {
      p_search: term,
      p_limit: limit
    });
    if (error) throw error;
    return data || [];
  }

  async function findOrCreateCustomer(profile) {
    const validation = window.crmUtils.validateCustomer(profile);
    if (validation) throw new Error(validation);
    const { data, error } = await requireClient().rpc("crm_find_or_create_customer", {
      p_first_name: String(profile.first_name || "").trim(),
      p_last_name: String(profile.last_name || "").trim(),
      p_company: String(profile.company || "").trim(),
      p_email: String(profile.email || "").trim().toLowerCase(),
      p_phone: String(profile.phone || "").trim(),
      p_event_address: String(profile.event_address || "").trim(),
      p_billing_address: String(profile.billing_address || "").trim()
    });
    if (error) throw error;
    return data;
  }

  async function getCustomer(id) {
    const { data, error } = await requireClient().from("customers").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  async function updateCustomer(id, values) {
    const validation = window.crmUtils.validateCustomer(values);
    if (validation) throw new Error(validation);
    const { data, error } = await requireClient().from("customers").update(values).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function getCustomerDetail(id) {
    const [customerResult, quotesResult, bookingsResult, activitiesResult] = await Promise.all([
      requireClient().from("customers").select("*").eq("id", id).single(),
      requireClient().from("leads").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      requireClient().from("bookings").select("*").eq("customer_id", id).order("event_date", { ascending: false }),
      requireClient().from("customer_activities").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(100)
    ]);
    const failed = [customerResult, quotesResult, bookingsResult, activitiesResult].find((result) => result.error);
    if (failed) throw failed.error;
    return {
      customer: customerResult.data,
      quotes: quotesResult.data || [],
      bookings: bookingsResult.data || [],
      activities: activitiesResult.data || []
    };
  }

  window.crmService = {
    dashboard,
    searchCustomers,
    findOrCreateCustomer,
    getCustomer,
    updateCustomer,
    getCustomerDetail
  };
  document.dispatchEvent(new CustomEvent("crm-service-ready"));
})();
