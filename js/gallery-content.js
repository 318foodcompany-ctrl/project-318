(function galleryContentModule(globalScope) {
  "use strict";
  const categories = ["All", "Corporate", "Weddings", "Schools", "Parties", "Pizza", "Pasta", "Desserts"];
  const fallback = [
    { category: "Pizza", image_url: "assets/images/taco-wordless.jpg", alt_text: "Fresh catering spread", caption: "Fresh catering favorites", featured: true },
    { category: "Parties", image_url: "assets/images/fajita-wordless.jpg", alt_text: "Fajita catering spread", caption: "Built for celebrations", featured: false },
    { category: "Corporate", image_url: "assets/images/bbq-wordless.jpg", alt_text: "Barbecue catering spread", caption: "Professional group catering", featured: false }
  ];

  function safeImage(value) {
    const url = String(value || "").trim();
    return /^(?:https:\/\/|assets\/images\/)/i.test(url) ? url : "";
  }

  function render(items, configuredCategories = categories) {
    const grid = document.querySelector("[data-dynamic-gallery]");
    const filters = document.querySelector("[data-gallery-filters]");
    if (!grid || !filters) return;
    const draw = (category) => {
      grid.replaceChildren();
      items.filter((item) => category === "All" || item.category === category).forEach((item) => {
        const figure = document.createElement("figure");
        figure.className = `gallery-item${item.featured ? " featured" : ""}`;
        const image = document.createElement("img");
        image.src = safeImage(item.image_url) || "assets/images/logo.jpeg";
        image.alt = item.alt_text;
        image.loading = item.featured ? "eager" : "lazy";
        if (item.featured) image.fetchPriority = "high";
        const caption = document.createElement("figcaption");
        caption.textContent = item.caption || item.category;
        figure.append(image, caption);
        grid.appendChild(figure);
      });
    };
    filters.replaceChildren();
    configuredCategories.filter((category) => category === "All" || items.some((item) => item.category === category)).forEach((category, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;
      button.className = index === 0 ? "active" : "";
      button.addEventListener("click", () => {
        filters.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === button));
        draw(category);
      });
      filters.appendChild(button);
    });
    draw("All");
  }

  async function load() {
    let items = fallback;
    let configuredCategories = categories;
    if (globalScope.supabaseClient) {
      const [result, categoryResult] = await Promise.all([
        globalScope.supabaseClient.from("gallery_items")
          .select("category,image_url,alt_text,caption,featured,sort_order")
          .eq("status", "published").order("featured", { ascending: false }).order("sort_order"),
        globalScope.supabaseClient.from("gallery_categories")
          .select("name,sort_order").eq("status", "published").order("sort_order")
      ]);
      if (!result.error && result.data?.length) items = result.data;
      else if (result.error) console.error("Gallery load failed:", result.error);
      if (!categoryResult.error && categoryResult.data?.length) configuredCategories = ["All", ...categoryResult.data.map((item) => item.name)];
      else if (categoryResult.error) console.error("Gallery category load failed:", categoryResult.error);
    }
    render(items, configuredCategories);
  }

  const api = { categories, fallback, safeImage, render, load };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
    else load();
  }
})(typeof window !== "undefined" ? window : globalThis);
