(function () {
  "use strict";

  const PAGE_CONFIG = [
    { url: "index.html", label: "Homepage", market: "Shreveport & Bossier City" },
    { url: "catering.html", label: "Catering Menus", market: "Shreveport & Bossier City" },
    { url: "corporate.html", label: "Corporate Catering", market: "Shreveport & Bossier City" },
    { url: "about.html", label: "About", market: "Northwest Louisiana" },
    { url: "gallery.html", label: "Gallery", market: "Shreveport & Bossier City" },
    { url: "contact.html", label: "Contact", market: "Shreveport & Bossier City" },
    { url: "quote-builder.html", label: "Quote Builder", market: "Shreveport & Bossier City" }
  ];

  function getMeta(doc, selector) {
    return doc.querySelector(selector)?.getAttribute("content")?.trim() || "";
  }

  function suggestedTitle(page, doc) {
    const existing = doc.title.trim();
    if (existing.length >= 30 && existing.length <= 65) return existing;
    return `${page.label} in ${page.market} | 318 Food Co.`;
  }

  function suggestedDescription(page, doc) {
    const existing = getMeta(doc, 'meta[name="description"]');
    if (existing.length >= 70 && existing.length <= 170) return existing;
    return `Plan fresh, dependable ${page.label.toLowerCase()} with 318 Food Co. for offices, celebrations and events across ${page.market} and Northwest Louisiana.`;
  }

  function buildSuggestion(page, result, doc) {
    const failed = new Set(result.checks.filter((check) => !check.passed).map((check) => check.id));
    const changes = [];
    if (failed.has("title")) changes.push({ field: "title", value: suggestedTitle(page, doc) });
    if (failed.has("description")) changes.push({ field: "description", value: suggestedDescription(page, doc) });
    if (failed.has("canonical")) changes.push({ field: "canonical", value: `https://www.318foodco.com/${page.url === "index.html" ? "" : page.url}` });
    if (failed.has("open-graph")) changes.push({ field: "openGraph", value: "Add matching Open Graph title, description, URL and type tags." });
    if (failed.has("twitter")) changes.push({ field: "twitter", value: "Add summary-card title and description tags." });
    if (failed.has("schema")) changes.push({ field: "schema", value: "Add page-appropriate JSON-LD structured data." });
    if (failed.has("images")) changes.push({ field: "images", value: "Add descriptive alt text to every content image." });
    if (failed.has("local")) changes.push({ field: "local", value: `Add natural references to ${page.market} and Northwest Louisiana.` });
    return changes;
  }

  async function loadDocument(url) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    return new DOMParser().parseFromString(await response.text(), "text/html");
  }

  function createSuggestionCard(page, result, changes) {
    const card = document.createElement("article");
    card.className = "seo-suggestion-card";
    const items = changes.length
      ? changes.map((change) => `<li><strong>${change.field}</strong><span>${change.value}</span></li>`).join("")
      : "<li><strong>No action needed</strong><span>This page currently passes the configured SEO checks.</span></li>";
    card.innerHTML = `
      <div class="seo-suggestion-heading">
        <div><h3>${page.label}</h3><p>${page.url}</p></div>
        <span class="seo-score-badge">${result.score}/100</span>
      </div>
      <ul>${items}</ul>
      <div class="seo-suggestion-actions">
        <button type="button" data-seo-preview="${page.url}">Preview recommendations</button>
        <button type="button" data-seo-approve="${page.url}" ${changes.length ? "" : "disabled"}>Approve for publishing</button>
      </div>`;
    return card;
  }

  async function renderSuggestions(container) {
    if (!window.Project318SeoAudit) throw new Error("SEO audit engine is unavailable.");
    container.innerHTML = '<p class="seo-loading">Building SEO recommendations…</p>';
    const fragment = document.createDocumentFragment();
    for (const page of PAGE_CONFIG) {
      try {
        const doc = await loadDocument(page.url);
        const result = window.Project318SeoAudit.auditDocument(doc, page.url);
        const changes = buildSuggestion(page, result, doc);
        fragment.appendChild(createSuggestionCard(page, result, changes));
      } catch (error) {
        const card = document.createElement("article");
        card.className = "seo-suggestion-card";
        card.innerHTML = `<h3>${page.label}</h3><p>${error.message}</p>`;
        fragment.appendChild(card);
      }
    }
    container.replaceChildren(fragment);
  }

  function init() {
    const container = document.querySelector("[data-seo-suggestions]");
    if (!container) return;
    renderSuggestions(container).catch((error) => {
      container.textContent = error.message;
    });
    container.addEventListener("click", (event) => {
      const preview = event.target.closest("[data-seo-preview]");
      if (preview) window.open(preview.dataset.seoPreview, "_blank", "noopener");
      const approve = event.target.closest("[data-seo-approve]");
      if (approve) {
        approve.textContent = "Approval recorded";
        approve.disabled = true;
        approve.dataset.approved = "true";
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
