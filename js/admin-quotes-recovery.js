(function () {
  "use strict";

  if (!/\/admin\.html$/i.test(window.location.pathname || "")) return;

  const escapeHTML = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const currency = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "—";
  };

  const dateText = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-US");
  };

  function renderRecovery(quotes) {
    const panel = document.getElementById("leadsPanel");
    const existing = document.getElementById("quoteRecoveryPanel");
    if (!panel) return;
    if (existing) existing.remove();

    const visibleCount = Number(document.getElementById("quoteTotalCount")?.textContent || 0);
    const shouldShow = quotes.length > visibleCount;
    if (!shouldShow) return;

    const card = document.createElement("section");
    card.id = "quoteRecoveryPanel";
    card.className = "card";
    card.style.marginBottom = "18px";
    card.style.border = "2px solid #e21b23";
    card.innerHTML = `
      <div class="panel-heading">
        <h2>Recovered Quote Records</h2>
        <p>The database contains ${quotes.length} quote request${quotes.length === 1 ? "" : "s"}, but the normal dashboard returned ${visibleCount}. These records were loaded through the secure recovery route.</p>
      </div>
      <div style="overflow-x:auto">
        <table class="quote-table">
          <thead><tr><th>Customer</th><th>Company</th><th>Phone</th><th>Email</th><th>Event</th><th>Guests</th><th>Budget</th><th>Submitted</th><th>Details</th></tr></thead>
          <tbody>${quotes.map((quote) => `
            <tr>
              <td><strong>${escapeHTML(quote.name || "Unnamed customer")}</strong></td>
              <td>${escapeHTML(quote.company || "—")}</td>
              <td>${escapeHTML(quote.phone || "—")}</td>
              <td>${escapeHTML(quote.email || "—")}</td>
              <td>${escapeHTML(quote.event_type || "—")}<br><small>${escapeHTML(quote.event_date || "Date TBD")}</small></td>
              <td>${escapeHTML(quote.guests ?? "—")}</td>
              <td>${escapeHTML(currency(quote.budget))}</td>
              <td>${escapeHTML(dateText(quote.created_at))}</td>
              <td><details><summary>Open</summary><div style="min-width:260px;white-space:pre-wrap;padding-top:8px">${escapeHTML(quote.notes || "No notes submitted.")}</div></details></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>`;

    const heading = panel.querySelector(".panel-heading");
    if (heading) heading.after(card);
    else panel.prepend(card);

    document.getElementById("quoteTotalCount").textContent = String(quotes.length);
    document.getElementById("quoteNewCount").textContent = String(quotes.filter((quote) => !quote.status || quote.status === "New").length);
    document.getElementById("quoteBookedCount").textContent = String(quotes.filter((quote) => quote.status === "Booked").length);
    const month = new Date().toISOString().slice(0, 7);
    document.getElementById("quoteMonthCount").textContent = String(quotes.filter((quote) => String(quote.created_at || "").startsWith(month)).length);
  }

  async function recoverQuotes() {
    if (!window.supabaseClient) return;
    const { data } = await window.supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;

    try {
      const response = await fetch("/api/admin-quotes", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.code === "QUOTE_RECOVERY_NOT_CONFIGURED") {
          console.warn("Quote recovery requires SUPABASE_SERVICE_ROLE_KEY in Vercel.");
          return;
        }
        throw new Error(payload.error || `Quote recovery failed (${response.status}).`);
      }
      renderRecovery(Array.isArray(payload.quotes) ? payload.quotes : []);
    } catch (error) {
      console.error("Quote recovery check failed:", error);
      const message = document.getElementById("quoteManagerMessage");
      if (message && !message.textContent) {
        message.textContent = `Database recovery check failed: ${error.message}`;
        message.style.color = "#b42318";
      }
    }
  }

  window.addEventListener("load", () => setTimeout(recoverQuotes, 1200), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recoverQuotes();
  });
})();
