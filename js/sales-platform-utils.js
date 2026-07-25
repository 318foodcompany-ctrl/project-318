(function (root) {
  "use strict";
  const stages = [
    ["new_lead", "New Lead"], ["contacted", "Contacted"], ["proposal_sent", "Proposal Sent"],
    ["waiting_on_customer", "Waiting on Customer"], ["booked", "Booked"],
    ["completed", "Completed"], ["lost", "Lost"]
  ];
  function escapeHTML(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function money(value) {
    return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  function proposalTotals(items, discount, taxRate) {
    const subtotal = (items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
    const taxable = (items || []).reduce((sum, item) => sum + (item.taxable === false ? 0 : Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
    const safeDiscount = Math.min(Math.max(Number(discount || 0), 0), subtotal);
    const tax = Math.max(taxable - safeDiscount, 0) * Math.min(Math.max(Number(taxRate || 0), 0), 100) / 100;
    return { subtotal, discount: safeDiscount, tax, total: subtotal - safeDiscount + tax };
  }
  function csv(rows) {
    const headers = ["First Name","Last Name","Company","Email","Phone","Event Address","Archived"];
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    return [headers.map(quote).join(","), ...(rows || []).map((r) => [
      r.first_name,r.last_name,r.company,r.email,r.phone,r.event_address,r.archived
    ].map(quote).join(","))].join("\r\n");
  }
  const api = { stages, escapeHTML, money, proposalTotals, csv };
  root.salesPlatformUtils = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
