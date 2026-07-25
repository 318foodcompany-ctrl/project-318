(function () {
  "use strict";
  function client() {
    if (!window.supabaseClient) throw new Error("Supabase is unavailable.");
    return window.supabaseClient;
  }
  async function unwrap(promise) {
    const result = await promise;
    if (result.error) throw result.error;
    return result.data || [];
  }
  async function opportunities() {
    return unwrap(client().from("sales_opportunities")
      .select("*,customers(first_name,last_name,company,email,phone),leads(name,event_type,event_date,guests,budget)")
      .order("updated_at", { ascending: false }));
  }
  async function createOpportunity(values) {
    const rows = await unwrap(client().from("sales_opportunities").insert(values).select("*"));
    return rows[0];
  }
  async function updateOpportunity(id, values) {
    const rows = await unwrap(client().from("sales_opportunities").update(values).eq("id", id).select("*"));
    if (rows.length !== 1) throw new Error("Opportunity update was not persisted.");
    return rows[0];
  }
  async function addComment(opportunityId, body) {
    const rows = await unwrap(client().from("sales_comments").insert({ opportunity_id: opportunityId, body }).select("*"));
    return rows[0];
  }
  async function comments(opportunityId) {
    return unwrap(client().from("sales_comments").select("*").eq("opportunity_id", opportunityId).order("created_at", { ascending: false }));
  }
  async function proposals() {
    return unwrap(client().from("proposals")
      .select("*,customers(first_name,last_name,company),proposal_versions(*)")
      .order("created_at", { ascending: false }));
  }
  async function saveProposal(values) {
    return unwrap(client().rpc("sales_save_proposal", values));
  }
  async function setProposalStatus(id, status) {
    return unwrap(client().rpc("sales_set_proposal_status", { p_proposal_id: id, p_status: status }));
  }
  async function duplicateProposal(proposal) {
    const versions = [...(proposal.proposal_versions || [])].sort((a,b) => b.version_number-a.version_number);
    const version = versions[0];
    const items = await unwrap(client().from("proposal_line_items").select("*").eq("version_id", version.id).order("position"));
    return saveProposal({
      p_proposal_id: null, p_customer_id: proposal.customer_id, p_quote_id: null, p_booking_id: null,
      p_opportunity_id: proposal.opportunity_id, p_title: `${proposal.title} (Copy)`,
      p_expiration_date: proposal.expiration_date, p_introduction: version.introduction, p_terms: version.terms,
      p_discount: version.discount_amount, p_tax_rate: version.tax_rate,
      p_items: items.map(({ item_type,description,quantity,unit_price,taxable }) => ({ item_type,description,quantity,unit_price,taxable }))
    });
  }
  async function rules() { return unwrap(client().from("follow_up_rules").select("*").order("name")); }
  async function saveRule(value) {
    if (value.id) return (await unwrap(client().from("follow_up_rules").update(value).eq("id", value.id).select("*")))[0];
    return (await unwrap(client().from("follow_up_rules").insert(value).select("*")))[0];
  }
  async function customers() { return unwrap(client().from("customers").select("*").order("created_at", { ascending: false })); }
  async function mergeCustomers(keepId, mergeId) {
    return unwrap(client().rpc("sales_merge_customers", { p_keep: keepId, p_merge: mergeId }));
  }
  async function createPortalLink(customerId) {
    const token = await unwrap(client().rpc("sales_create_portal_token", { p_customer_id: customerId }));
    return `${location.origin}/portal.html#token=${encodeURIComponent(token)}`;
  }
  async function financials() {
    const [opps, proposalRows, bookings, invoices, payments] = await Promise.all([
      opportunities(), proposals(), unwrap(client().from("bookings").select("*")),
      unwrap(client().from("invoices").select("*")), unwrap(client().from("payments").select("*"))
    ]);
    return { opportunities: opps, proposals: proposalRows, bookings, invoices, payments };
  }
  window.salesPlatformService = { opportunities,createOpportunity,updateOpportunity,addComment,comments,
    proposals,saveProposal,setProposalStatus,duplicateProposal,rules,saveRule,customers,mergeCustomers,createPortalLink,financials };
  document.dispatchEvent(new CustomEvent("sales-platform-service-ready"));
})();
