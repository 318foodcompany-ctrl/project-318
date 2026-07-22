(function () {
  "use strict";

  const PAGE_RULES = [
    { id: "title", label: "Page title", weight: 20, test: (doc) => Boolean(doc.title && doc.title.trim().length >= 30 && doc.title.trim().length <= 65) },
    { id: "description", label: "Meta description", weight: 15, test: (doc) => {
      const value = doc.querySelector('meta[name="description"]')?.content?.trim() || "";
      return value.length >= 70 && value.length <= 170;
    } },
    { id: "canonical", label: "Canonical URL", weight: 15, test: (doc) => Boolean(doc.querySelector('link[rel="canonical"]')?.href) },
    { id: "h1", label: "Single H1", weight: 10, test: (doc) => doc.querySelectorAll("h1").length === 1 },
    { id: "open-graph", label: "Open Graph tags", weight: 10, test: (doc) => ["og:title", "og:description", "og:url", "og:type"].every((property) => Boolean(doc.querySelector(`meta[property="${property}"]`)?.content)) },
    { id: "twitter", label: "Twitter tags", weight: 5, test: (doc) => ["twitter:card", "twitter:title", "twitter:description"].every((name) => Boolean(doc.querySelector(`meta[name="${name}"]`)?.content)) },
    { id: "images", label: "Image alt text", weight: 10, test: (doc) => Array.from(doc.images).every((image) => image.hasAttribute("alt") && image.alt.trim().length > 2) },
    { id: "schema", label: "Structured data", weight: 10, test: (doc) => Boolean(doc.querySelector('script[type="application/ld+json"]')) },
    { id: "local", label: "Local market signals", weight: 5, test: (doc) => /Shreveport|Bossier City|Northwest Louisiana/i.test(doc.body?.textContent || "") }
  ];

  function auditDocument(doc, url) {
    const checks = PAGE_RULES.map((rule) => ({
      id: rule.id,
      label: rule.label,
      weight: rule.weight,
      passed: Boolean(rule.test(doc))
    }));
    const score = checks.reduce((total, check) => total + (check.passed ? check.weight : 0), 0);
    return {
      url,
      title: doc.title || url,
      score,
      checks,
      recommendations: checks.filter((check) => !check.passed).map((check) => check.label)
    };
  }

  async function auditUrl(url) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to audit ${url}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return auditDocument(doc, url);
  }

  async function auditSite(urls) {
    const results = [];
    for (const url of urls) {
      try {
        results.push(await auditUrl(url));
      } catch (error) {
        results.push({ url, title: url, score: 0, checks: [], recommendations: [error.message], error: true });
      }
    }
    return results;
  }

  window.Project318SeoAudit = { auditDocument, auditUrl, auditSite, rules: PAGE_RULES };
})();
