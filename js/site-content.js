document.addEventListener("DOMContentLoaded", async () => {
  const { data, error } = await supabaseClient
    .from("website_content")
    .select("content_key, content_value")
    .eq("page", "home");

  if (error) {
    console.error("Could not load website content:", error);
    return;
  }

  const content = Object.fromEntries(
    data.map((item) => [item.content_key, item.content_value])
  );

  const heroHeading = document.querySelector("[data-content='hero_heading']");
  const heroText = document.querySelector("[data-content='hero_text']");
  const heroButton = document.querySelector("[data-content='hero_button']");

  if (heroHeading && content.hero_heading) {
    heroHeading.textContent = content.hero_heading;
  }

  if (heroText && content.hero_text) {
    heroText.textContent = content.hero_text;
  }

  if (heroButton && content.hero_button) {
    heroButton.textContent = content.hero_button;
  }
});