(function () {
  async function loadCorporatePageContent() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    const { data, error } = await supabaseClient
      .from("website_content")
      .select("content_key, content_value")
      .eq("page", "corporate");

    if (error) {
      console.error("Could not load Corporate page content:", error);
      return;
    }
    const content = Object.fromEntries((data || []).map((item) => [item.content_key, item.content_value]));
    document.querySelectorAll("[data-corporate-content]").forEach((element) => {
      const value = content[element.dataset.corporateContent];
      if (typeof value === "string" && value.trim()) element.textContent = value;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadCorporatePageContent, { once: true });
  } else {
    loadCorporatePageContent();
  }
})();
