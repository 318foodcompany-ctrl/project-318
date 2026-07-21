(function () {
  "use strict";

  if (!/\/admin\.html$/i.test(window.location.pathname || "")) return;

  async function waitForSession() {
    if (!window.supabaseClient) return null;
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    if (data?.session) return data.session;

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        subscription?.unsubscribe();
        resolve(null);
      }, 5000);
      const { data: listener } = window.supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (!session) return;
        window.clearTimeout(timeout);
        listener?.subscription?.unsubscribe();
        resolve(session);
      });
      var subscription = listener?.subscription;
    });
  }

  function displayedQuoteCount() {
    const value = Number(document.getElementById("quoteTotalCount")?.textContent || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function quoteManagerNeedsRefresh(databaseCount) {
    const message = document.getElementById("quoteManagerMessage")?.textContent || "";
    const tableText = document.getElementById("quoteTableWrap")?.textContent || "";
    return databaseCount > displayedQuoteCount()
      || /could not load|couldn't load|unavailable|no quote requests/i.test(`${message} ${tableText}`);
  }

  function reloadQuoteManager() {
    const panel = document.getElementById("leadsPanel");
    if (!panel || panel.dataset.authRefreshed === "true") return;

    const replacement = panel.cloneNode(true);
    replacement.dataset.authRefreshed = "true";
    replacement.querySelector("#quoteViewSwitcher")?.remove();
    panel.replaceWith(replacement);

    const script = document.createElement("script");
    script.src = `js/admin-quotes.js?auth-sync=${Date.now()}`;
    script.dataset.adminQuotesAuthReload = "";
    script.addEventListener("error", () => {
      const message = document.getElementById("quoteManagerMessage");
      if (message) {
        message.textContent = "Quotes were saved, but the dashboard could not refresh. Reload this page and try again.";
        message.style.color = "#b42318";
      }
    }, { once: true });
    document.body.appendChild(script);
  }

  async function synchronizeQuotes() {
    try {
      const session = await waitForSession();
      if (!session) return;

      const { count, error } = await window.supabaseClient
        .from("leads")
        .select("id", { count: "exact", head: true });

      if (error) throw error;
      if (quoteManagerNeedsRefresh(Number(count || 0))) reloadQuoteManager();
    } catch (error) {
      console.error("Authenticated quote dashboard sync failed:", error);
      const message = document.getElementById("quoteManagerMessage");
      if (message && !message.textContent) {
        message.textContent = `Could not verify saved quotes: ${error.message}`;
        message.style.color = "#b42318";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", synchronizeQuotes, { once: true });
  } else {
    synchronizeQuotes();
  }
})();