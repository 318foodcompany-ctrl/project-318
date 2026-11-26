(() => {
  'use strict';

  function ensureStylesheet(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(src, id, readyCheck) {
    if (typeof readyCheck === 'function' && readyCheck()) return Promise.resolve(true);
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === 'true') return Promise.resolve(true);
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve(true);
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
  }

  ensureScript('js/public-performance.js', 'project318-performance-script', () => Boolean(window.Project318Performance))
    .catch((error) => console.error('Website performance tools could not be loaded:', error));

  ensureStylesheet('css/accessibility.css', 'project318-accessibility-styles');
  ensureScript('js/accessibility.js', 'project318-accessibility-script', () => Boolean(window.Project318Accessibility))
    .catch((error) => console.error('Website accessibility tools could not be loaded:', error));

  ensureScript('js/technical-seo.js', 'project318-technical-seo-script', () => Boolean(window.Project318TechnicalSEO))
    .catch((error) => console.error('Website SEO metadata could not be loaded:', error));

  ensureScript('/js/public-tracking.js', 'project318-public-tracking', () => Boolean(window.Project318TrackingStarted))
    .catch(error => console.error('Website tracking tools could not be loaded.', error));
})();

const menuBtn = document.querySelector('.menu-btn');
const links = document.querySelector('.links');

if (menuBtn && links) {
  menuBtn.addEventListener('click', () => {
    links.classList.toggle('open');
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (/\/(?:admin|login)\.html$/i.test(location.pathname) || document.querySelector(".final-book-cta")) return;
  const cta = document.createElement("a");
  cta.className = "final-book-cta";
  cta.href = "quote-builder.html";
  cta.setAttribute("aria-label", "Request a catering quote");
  cta.innerHTML = "<span>Planning an event?</span><strong>Request Catering Quote →</strong>";
  document.body.appendChild(cta);
});
