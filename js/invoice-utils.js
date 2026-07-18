(function () {
  "use strict";

  function decimal(value, fallback = 0) {
    const normalized = String(value ?? "").replace(/[$,\s]/g, "");
    if (normalized === "") return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function money(value) {
    const parsed = decimal(value, 0);
    return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : NaN;
  }

  function currency(value) {
    const parsed = money(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "—";
  }

  function dateText(value) {
    if (!value) return "—";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function normalizeLine(line, index) {
    return {
      position: index + 1,
      description: String(line.description || "").trim(),
      quantity: decimal(line.quantity, NaN),
      unit_price: money(line.unit_price),
      taxable: line.taxable !== false
    };
  }

  function validateLines(lines, { required = false } = {}) {
    if (!Array.isArray(lines)) return "Invoice line items are invalid.";
    if (required && lines.length === 0) return "Add at least one line item.";
    for (const [index, source] of lines.entries()) {
      const line = normalizeLine(source, index);
      if (!line.description) return `Line ${index + 1} requires a description.`;
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) return `Line ${index + 1} requires a quantity greater than zero.`;
      if (!Number.isFinite(line.unit_price) || line.unit_price < 0) return `Line ${index + 1} requires a valid non-negative price.`;
    }
    return "";
  }

  function normalizeLines(lines) {
    return lines.map(normalizeLine);
  }

  function estimate(lines, discountAmount = 0, taxRate = 0) {
    const normalized = normalizeLines(lines);
    const subtotal = money(normalized.reduce((sum, line) => sum + line.quantity * line.unit_price, 0));
    const taxable = money(normalized.filter((line) => line.taxable).reduce((sum, line) => sum + line.quantity * line.unit_price, 0));
    const discount = Math.max(money(discountAmount) || 0, 0);
    const rate = Math.max(decimal(taxRate, 0) || 0, 0);
    const taxableDiscount = subtotal > 0 ? money(discount * (taxable / subtotal)) : 0;
    const tax = money(Math.max(taxable - taxableDiscount, 0) * rate / 100);
    return { subtotal, discount, tax, total: money(Math.max(subtotal - discount + tax, 0)) };
  }

  function effectiveLabel(status) {
    return String(status || "draft")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  window.invoiceUtils = {
    currency,
    dateText,
    decimal,
    effectiveLabel,
    estimate,
    money,
    normalizeLines,
    validateLines
  };
})();
