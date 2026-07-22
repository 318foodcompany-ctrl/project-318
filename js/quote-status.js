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

  function loadAdminScript(src) {
    if (typeof document === "undefined") return;
    if (document.querySelector(`script[src="${src}"]`)) return;

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  if (typeof window !== "undefined") {
    window.quoteStatusService = { update };
    loadAdminScript("js/admin-command-center.js");
    loadAdminScript("js/admin-editor-enhancements.js");
  }
})();
