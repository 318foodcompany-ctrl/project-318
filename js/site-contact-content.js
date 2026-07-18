(function () {
  function isProductionContent(value) {
    if (typeof value !== "string" || !value.trim()) return false;
    return !/\b(?:test|testing|placeholder|lorem ipsum|sample text)\b/i.test(value);
  }

  async function loadContactPageContent() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;

    const { data, error } = await supabaseClient
      .from("website_content")
      .select("content_key, content_value")
      .eq("page", "contact");

    if (error) {
      console.error("Could not load Contact page content:", error);
      return;
    }

    const content = Object.fromEntries((data || []).map((item) => [item.content_key, item.content_value]));
    document.querySelectorAll("[data-contact-content]").forEach((element) => {
      const value = content[element.dataset.contactContent];
      if (isProductionContent(value)) element.textContent = value.trim();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadContactPageContent, { once: true });
  } else {
    loadContactPageContent();
  }
})();
