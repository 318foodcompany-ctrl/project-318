(function () {
  const blockedTestContent = /^(?:318\s*food\s*co\.?\s*)?test(?:ing)?$/i;

  function isSafeContentLink(value) {
    return /^(?:https?:\/\/|mailto:|tel:|#|[a-z0-9._/-]+\.html(?:#[a-z0-9_-]+)?$)/i.test(value);
  }

  function isPublishableContent(value) {
    return typeof value === "string" && value.trim() && !blockedTestContent.test(value.trim());
  }

  async function loadHomepageContent() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;

    const { data, error } = await supabaseClient
      .from("website_content")
      .select("content_key, content_value")
      .eq("page", "home");

    if (error) {
      console.error("Could not load homepage content:", error);
      return;
    }

    const content = Object.fromEntries(
      (data || []).map((item) => [item.content_key, item.content_value])
    );

    document.querySelectorAll("[data-content]").forEach((element) => {
      const value = content[element.dataset.content];
      if (isPublishableContent(value)) element.textContent = value.trim();
    });

    document.querySelectorAll("[data-content-link]").forEach((element) => {
      const value = content[element.dataset.contentLink];
      if (typeof value === "string" && value.trim() && isSafeContentLink(value.trim())) {
        element.href = value.trim();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadHomepageContent, { once: true });
  } else {
    loadHomepageContent();
  }
})();
