(function conversionContentModule(globalScope) {
  "use strict";

  const fallbacks = {
    testimonial: [
      { title: "Reliable from planning through service", body: "318 Food Co. made feeding our group simple, organized, and delicious.", value_text: "Local catering customer" }
    ],
    review: [
      { title: "A five-star catering experience", body: "Fresh food, clear communication, and a setup our guests loved.", value_text: "Google review highlight" }
    ],
    client_logo: [
      { title: "Local businesses", body: "Corporate lunches and employee events", media_url: "", alt_text: "" },
      { title: "Schools & churches", body: "Dependable meals for groups", media_url: "", alt_text: "" },
      { title: "Families & planners", body: "Celebrations made easier", media_url: "", alt_text: "" }
    ],
    statistic: [
      { title: "Group sizes", value_text: "15–500+", body: "Flexible catering for teams and celebrations" },
      { title: "Service area", value_text: "The 318", body: "Shreveport, Bossier City, and Northwest Louisiana" },
      { title: "Planning", value_text: "Made easy", body: "One clear request starts the conversation" }
    ],
    trust_badge: [
      { title: "Freshly prepared", body: "Crowd-pleasing menus prepared with care." },
      { title: "Professional service", body: "Clear planning, dependable delivery, and organized setup." },
      { title: "Built for your event", body: "Menus and service options matched to your guest count." }
    ],
    response_promise: [
      { title: "We review every request and follow up after confirming availability.", body: "" }
    ]
  };

  function safeUrl(value) {
    const url = String(value || "").trim();
    return /^(?:https:\/\/|assets\/images\/)/i.test(url) ? url : "";
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function renderCards(host, items, type) {
    if (!host) return;
    host.replaceChildren();
    items.forEach((item) => {
      const card = element(type === "testimonial" || type === "review" ? "blockquote" : "article", `conversion-card conversion-${type}`);
      const imageUrl = safeUrl(item.media_url);
      if (imageUrl) {
        const image = element("img", "conversion-logo");
        image.src = imageUrl;
        image.alt = item.alt_text || item.title;
        image.loading = "lazy";
        card.appendChild(image);
      }
      if (item.value_text && type === "statistic") card.appendChild(element("strong", "conversion-value", item.value_text));
      card.appendChild(element("h3", "", item.title));
      if (item.body) card.appendChild(element(type === "testimonial" || type === "review" ? "p" : "p", "", item.body));
      if ((type === "testimonial" || type === "review") && item.value_text) card.appendChild(element("cite", "", item.value_text));
      host.appendChild(card);
    });
  }

  async function load() {
    const client = globalScope.supabaseClient;
    let items = [];
    if (client) {
      const result = await client.from("conversion_items")
        .select("item_type,title,body,media_url,alt_text,link_url,value_text,sort_order")
        .eq("status", "published")
        .order("sort_order");
      if (!result.error) items = result.data || [];
      else console.error("Conversion content load failed:", result.error);
    }
    Object.keys(fallbacks).forEach((type) => {
      const selected = items.filter((item) => item.item_type === type);
      if (type === "response_promise") {
        const promise = (selected[0] || fallbacks.response_promise[0]).title;
        document.querySelectorAll("[data-response-promise]").forEach((node) => { node.textContent = promise; });
        return;
      }
      renderCards(document.querySelector(`[data-conversion-list="${type}"]`), selected.length ? selected : fallbacks[type], type);
    });
  }

  function initialize() {
    load();
  }

  const api = { fallbacks, safeUrl, renderCards, load, initialize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
  }
})(typeof window !== "undefined" ? window : globalThis);
