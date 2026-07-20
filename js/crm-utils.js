(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.crmUtils = api;

  if (typeof document !== "undefined" && !document.querySelector('script[data-crm-visual-workspace]')) {
    const script = document.createElement("script");
    script.src = "js/crm-visual-workspace.js";
    script.defer = true;
    script.dataset.crmVisualWorkspace = "true";
    document.head.appendChild(script);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function splitName(fullName) {
    const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    return { firstName: parts.shift() || "", lastName: parts.join(" ") };
  }

  function displayName(customer) {
    const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim();
    return name || customer?.company || customer?.email || "Unnamed customer";
  }

  function phoneKey(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function dateText(value, includeTime = false) {
    if (!value) return "—";
    const date = includeTime ? new Date(value) : new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", includeTime
      ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" });
  }

  function currency(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "—";
  }

  function validateCustomer(customer) {
    const hasIdentity = [customer.first_name, customer.last_name, customer.company, customer.email, customer.phone]
      .some((value) => String(value || "").trim());
    if (!hasIdentity) return "Enter a name, company, email, or phone number.";
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return "Enter a valid email address.";
    if (customer.phone && phoneKey(customer.phone).length < 7) return "Enter a valid primary phone number.";
    if (customer.secondary_phone && phoneKey(customer.secondary_phone).length < 7) return "Enter a valid secondary phone number.";
    return "";
  }

  return { escapeHTML, splitName, displayName, phoneKey, dateText, currency, validateCustomer };
});