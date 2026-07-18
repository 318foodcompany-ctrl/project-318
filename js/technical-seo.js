(function technicalSeoModule(globalScope) {
  "use strict";

  const SITE_ORIGIN = "https://www.318foodco.com";
  const PUBLIC_PATHS = new Set([
    "/",
    "/index.html",
    "/catering.html",
    "/corporate.html",
    "/about.html",
    "/gallery.html",
    "/contact.html",
    "/quote-builder.html",
    "/privacy.html"
  ]);

  function canonicalPath(pathname) {
    const path = String(pathname || "/").split("?")[0].split("#")[0];
    if (path === "/index.html") return "/";
    return PUBLIC_PATHS.has(path) ? path : "/";
  }

  function canonicalUrl(pathname) {
    return `${SITE_ORIGIN}${canonicalPath(pathname)}`;
  }

  function upsertMeta(doc, selector, attributes) {
    let element = doc.head.querySelector(selector);
    if (!element) {
      element = doc.createElement("meta");
      doc.head.appendChild(element);
    }
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  }

  function businessSchema(url) {
    return {
      "@context": "https://schema.org",
      "@type": ["FoodEstablishment", "Caterer"],
      "@id": `${SITE_ORIGIN}/#business`,
      name: "318 Food Co.",
      url: SITE_ORIGIN,
      telephone: "+1-318-572-0137",
      email: "318FoodCompany@gmail.com",
      image: `${SITE_ORIGIN}/assets/images/logo.jpeg`,
      priceRange: "$$",
      areaServed: [
        { "@type": "City", name: "Shreveport" },
        { "@type": "City", name: "Bossier City" },
        { "@type": "AdministrativeArea", name: "Northwest Louisiana" }
      ],
      servesCuisine: ["American", "Pizza", "Barbecue", "Mexican", "Italian"],
      sameAs: [],
      mainEntityOfPage: url
    };
  }

  function apply(win) {
    const doc = win.document;
    if (!doc || !doc.head || /\/(admin|login)\.html$/i.test(win.location.pathname || "")) return null;

    const canonical = canonicalUrl(win.location.pathname);
    let canonicalLink = doc.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = doc.createElement("link");
      canonicalLink.rel = "canonical";
      doc.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;

    const title = String(doc.title || "318 Food Co.").trim();
    const description = doc.head.querySelector('meta[name="description"]')?.content ||
      "Fresh catering for groups across Shreveport, Bossier City and Northwest Louisiana.";

    upsertMeta(doc, 'meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta(doc, 'meta[property="og:site_name"]', { property: "og:site_name", content: "318 Food Co." });
    upsertMeta(doc, 'meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta(doc, 'meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta(doc, 'meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta(doc, 'meta[property="og:image"]', { property: "og:image", content: `${SITE_ORIGIN}/assets/images/logo.jpeg` });
    upsertMeta(doc, 'meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta(doc, 'meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta(doc, 'meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta(doc, 'meta[name="robots"]', { name: "robots", content: "index,follow,max-image-preview:large" });

    if (!doc.getElementById("project318-business-schema")) {
      const schema = doc.createElement("script");
      schema.id = "project318-business-schema";
      schema.type = "application/ld+json";
      schema.textContent = JSON.stringify(businessSchema(canonical));
      doc.head.appendChild(schema);
    }

    return canonical;
  }

  const api = { SITE_ORIGIN, PUBLIC_PATHS, canonicalPath, canonicalUrl, businessSchema, apply };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document) apply(globalScope);
})(typeof window !== "undefined" ? window : globalThis);
