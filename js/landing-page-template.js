(function (scope) {
  "use strict";
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function sectionMedia(media) {
    if (!media) return "";
    const helper=scope.Project318MediaPath || (typeof require==="function" && require("./website-media-path.js"));
    const url=helper && helper.path(media.id);
    if (!url) return "";
    const label=escape(media.label || "Catering information");
    if (media.kind==="image") return '<img class="section-media" loading="lazy" alt="'+label+'" src="'+url+'">';
    if (media.kind==="video") return '<video class="section-media" aria-label="'+label+'" controls preload="metadata" src="'+url+'"></video>';
    if (media.kind==="document") return '<a href="'+url+'">'+label+' (PDF)</a>';
    return "";
  }
  function render(page, slug, live = false) {
    const path = "/pages/" + encodeURIComponent(slug);
    const theme = page.theme === "light" ? "light" : "classic";
    const sections = page.sections.filter(section => !section.hidden).map(section =>
      '<section><h2>' + escape(section.heading) + '</h2><p>' + escape(section.body) + '</p>' + sectionMedia(section.media) + '</section>'
    ).join("");
    const targets = { quote:"/quote-builder.html", menu:"/catering.html", contact:"/contact.html" };
    const target = Object.hasOwn(targets,page.destination) ? targets[page.destination] : targets.quote;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      escape(page.title) + ' | 318 Food Co.</title><meta name="description" content="' + escape(page.description) +
      '"><meta name="robots" content="' + (page.indexed === true ? "index,follow" : "noindex,follow") +
      '"><link rel="canonical" href="https://www.318foodco.com' + path + '"><link rel="stylesheet" href="/css/landing-page.css"></head><body class="' +
      theme + '"><header><a href="/">318 Food Co.</a><nav data-website-menu aria-label="Catering"><a href="/catering.html">Menus</a><a href="/contact.html">Contact</a></nav></header><main><div class="intro"><h1>' +
      escape(page.title) + '</h1><p>' + escape(page.description) + '</p><a class="cta" href="' + target + '">' +
      escape(page.button || "Request a quote") + '</a></div>' + sections + '</main><footer><a href="/">318 Food Co.</a> · <a href="/privacy.html">Privacy</a></footer>' + (live ? '<script src="/api/runtime-config"></script><script src="/js/public-tracking.js"></script><script src="/js/website-navigation.js" data-public-menu></script>' : '') + '</body></html>';
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { render };
  else scope.Project318LandingPage = { render };
})(typeof window !== "undefined" ? window : globalThis);
