(function () {
  "use strict";

  async function update(client, id, status) {
    if (!client) throw new Error("Supabase is unavailable.");

    const { data, error } = await client
      .from("leads")
      .update({ status })
      .eq("id", id)
      .select("id,status");

    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error("Quote status was not saved. Check administrator permissions and try again.");
    }
    return data[0];
  }

  function loadAdminCommandCenter() {
    if (typeof document === "undefined") return;
    if (document.querySelector('script[src="js/admin-command-center.js"]')) return;

    const script = document.createElement("script");
    script.src = "js/admin-command-center.js";
    script.defer = true;
    document.head.appendChild(script);
  }

  if (typeof window !== "undefined") {
    window.quoteStatusService = { update };
    loadAdminCommandCenter();
  }
})();
