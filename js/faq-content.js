(function faqContentModule(globalScope) {
  "use strict";
  const fallback = [
    { category: "Planning", question: "How far in advance should I request catering?", answer: "Send your request as soon as your date is known. We will confirm availability after reviewing your event details." },
    { category: "Menus", question: "What is the catering minimum?", answer: "Most catering packages begin with a 15-person minimum." },
    { category: "Service", question: "Do you offer delivery and setup?", answer: "Delivery and setup options are available based on the event location, schedule, and service needs." }
  ];

  function appendAnswer(details, value) {
    const lines = String(value || "").replace(/\r\n?/g, "\n").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    lines.forEach((line) => {
      const heading = line.match(/^#{2,4}\s+(.+)$/) || line.match(/^\*\*(.+)\*\*$/);
      const element = document.createElement(heading ? "h4" : "p");
      element.textContent = heading ? heading[1] : line;
      details.appendChild(element);
    });
  }

  function render(items) {
    const host = document.querySelector("[data-faq-list]");
    const search = document.querySelector("[data-faq-search]");
    if (!host) return;
    const draw = (query = "") => {
      host.replaceChildren();
      const normalized = query.trim().toLowerCase();
      items.filter((item) => !normalized || `${item.category} ${item.question} ${item.answer}`.toLowerCase().includes(normalized))
        .forEach((item) => {
          const details = document.createElement("details");
          details.className = "faq-item";
          const summary = document.createElement("summary");
          summary.textContent = item.question;
          const category = document.createElement("span");
          category.className = "faq-category";
          category.textContent = item.category;
          details.append(summary, category);
          appendAnswer(details, item.answer);
          host.appendChild(details);
        });
      if (!host.children.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No questions match your search.";
        host.appendChild(empty);
      }
    };
    search?.addEventListener("input", () => draw(search.value));
    draw();
    const schema = document.getElementById("faqStructuredData") || document.createElement("script");
    schema.id = "faqStructuredData";
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question", name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    });
    if (!schema.parentNode) document.head.appendChild(schema);
  }

  async function load() {
    let items = fallback;
    if (globalScope.supabaseClient) {
      const result = await globalScope.supabaseClient.from("faq_items")
        .select("category,question,answer,sort_order").eq("status", "published")
        .order("category").order("sort_order");
      if (!result.error && result.data?.length) items = result.data;
      else if (result.error) console.error("FAQ load failed:", result.error);
    }
    render(items);
  }

  const api = { fallback, appendAnswer, render, load };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
    else load();
  }
})(typeof window !== "undefined" ? window : globalThis);

