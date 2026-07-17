(function () {
  async function loadAboutPageContent() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    const { data, error } = await supabaseClient
      .from("website_content")
      .select("content_key, content_value")
      .eq("page", "about");

    if (error) {
      console.error("Could not load About page content:", error);
      return;
    }

    const content = Object.fromEntries((data || []).map((item) => [item.content_key, item.content_value]));
    document.querySelectorAll("[data-about-content]").forEach((element) => {
      const value = content[element.dataset.aboutContent];
      if (typeof value === "string" && value.trim()) element.textContent = value;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAboutPageContent, { once: true });
  } else {
    loadAboutPageContent();
  }
})();
