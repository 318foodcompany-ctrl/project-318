(function eventTypesContentModule(globalScope) {
  "use strict";
  const fallback = [
    ["corporate-lunches", "Corporate Lunches", "Keep meetings productive with dependable meals sized for your team."],
    ["employee-appreciation", "Employee Appreciation", "Thank your team with a fresh, crowd-pleasing catering spread."],
    ["school-events", "School Events", "Flexible group meals for staff, teams, and school communities."],
    ["weddings", "Weddings", "Comfortable, memorable food for celebrations of every size."],
    ["birthday-parties", "Birthday Parties", "Easy catering that lets the host enjoy the party."],
    ["graduations", "Graduations", "Celebrate the milestone with food everyone can enjoy."],
    ["church-events", "Church Events", "Dependable meals for fellowship, volunteers, and special gatherings."],
    ["holiday-parties", "Holiday Parties", "Seasonal gatherings made simpler with professional catering."],
    ["food-truck-events", "Food Truck Events", "Bring the 318 Food Co. experience directly to your crowd."]
  ].map(([slug, title, description], index) => ({
    slug, title, description, hero_image_url: "", hero_alt_text: "", cta_text: "Request Catering Quote",
    cta_url: `quote-builder.html?event=${slug}`, seo_title: `${title} Catering | 318 Food Co.`,
    seo_description: `${title} catering in Shreveport, Bossier City, and Northwest Louisiana.`, sort_order: index
  }));

  function safeLink(value) {
    const link = String(value || "").trim();
    return /^(?:https:\/\/|[a-z0-9._/?=&-]+\.html(?:[?#][a-z0-9_=&-]+)?$)/i.test(link) ? link : "quote-builder.html";
  }

  function render(items) {
    const host = document.querySelector("[data-event-types]");
    if (!host) return;
    host.replaceChildren();
    items.forEach((item) => {
      const article = document.createElement("article");
      article.id = item.slug;
      article.className = "event-type-card";
      if (/^(?:https:\/\/|assets\/images\/)/i.test(item.hero_image_url || "")) {
        const image = document.createElement("img");
        image.src = item.hero_image_url;
        image.alt = item.hero_alt_text || item.title;
        image.loading = "lazy";
        article.appendChild(image);
      }
      const copy = document.createElement("div");
      const heading = document.createElement("h2");
      heading.textContent = item.title;
      const description = document.createElement("p");
      description.textContent = item.description;
      const link = document.createElement("a");
      link.className = "btn";
      link.href = safeLink(item.cta_url);
      link.textContent = item.cta_text;
      copy.append(heading, description, link);
      article.appendChild(copy);
      host.appendChild(article);
    });
    const schema = document.getElementById("eventTypesStructuredData") || document.createElement("script");
    schema.id = "eventTypesStructuredData";
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem", position: index + 1,
        url: `https://www.318foodco.com/event-types.html#${item.slug}`,
        name: item.seo_title || item.title,
        description: item.seo_description || item.description
      }))
    });
    if (!schema.parentNode) document.head.appendChild(schema);
  }

  async function load() {
    let items = fallback;
    if (globalScope.supabaseClient) {
      const result = await globalScope.supabaseClient.from("event_types")
        .select("slug,title,description,hero_image_url,hero_alt_text,cta_text,cta_url,seo_title,seo_description,sort_order")
        .eq("status", "published").order("sort_order");
      if (!result.error && result.data?.length) items = result.data;
      else if (result.error) console.error("Event types load failed:", result.error);
    }
    render(items);
  }

  const api = { fallback, safeLink, render, load };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
    else load();
  }
})(typeof window !== "undefined" ? window : globalThis);
