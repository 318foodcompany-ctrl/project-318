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

  ensureStylesheet('css/consent-manager.css', 'project318-consent-styles');
  ensureScript('js/consent-manager.js', 'project318-consent-script', () => Boolean(window.Project318Consent))
    .then(() => Promise.all([
      ensureScript('js/ga4-provider.js', 'project318-ga4-provider-script', () => Boolean(window.Project318GA4)),
      ensureScript('js/meta-pixel-provider.js', 'project318-meta-pixel-provider-script', () => Boolean(window.Project318MetaPixel))
    ]))
    .then(() => ensureScript('js/analytics-events.js', 'project318-analytics-events-script', () => Boolean(window.Project318Analytics)))
    .catch((error) => console.error('Website privacy or analytics tools could not be loaded:', error));
})();

const menuBtn = document.querySelector('.menu-btn');
const links = document.querySelector('.links');

if (menuBtn && links) {
  menuBtn.addEventListener('click', () => {
    links.classList.toggle('open');
  });
}

const quote = document.querySelector('#quoteForm');

if (quote) {
  const prices = {
    'Taco Bar': 15.99,
    'Fajita Bar': 16.99,
    'BBQ Bar': 16.99,
    'Deli Sandwich Buffet': 15.99,
    'Pasta Bar': 15.99,
    'Pizza & Salad Bar': 15.99,
  };

  const guests = document.querySelector('#guests');
  const menu = document.querySelector('#menuChoice');
  const extras = document.querySelector('#extras');
  const total = document.querySelector('#estimateTotal');
  const summary = document.querySelector('#estimateSummary');

  function calc() {
    if (!guests || !menu || !extras || !total || !summary) return;

    const guestCount = Math.max(15, Number(guests.value) || 15);
    const menuPrice = prices[menu.value] || 15.99;
    const extrasPrice = Number(extras.value) || 0;
    const subtotal = guestCount * (menuPrice + extrasPrice);

    total.textContent = subtotal.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    summary.textContent = `Estimated for ${guestCount} guests at $${(menuPrice + extrasPrice).toFixed(2)} per person.`;
  }

  [guests, menu, extras].filter(Boolean).forEach((field) => {
    field.addEventListener('input', calc);
  });

  calc();

  quote.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(quote);
    const lines = ['318 Food Co. Catering Quote Request', ''];

    for (const [key, value] of data.entries()) {
      lines.push(`${key}: ${value}`);
    }

    lines.push(
      '',
      summary ? summary.textContent : '',
      `Estimated subtotal: ${total ? total.textContent : '$0.00'}`,
      'Final price is subject to confirmation, delivery, staffing, taxes, and menu selections.'
    );

    const destinationEmail = window.websiteSettings?.email || '318FoodCompany@gmail.com';
    location.href = `mailto:${destinationEmail}?subject=${encodeURIComponent('Catering Quote Request')}&body=${encodeURIComponent(lines.join('\n'))}`;
  });
}

(() => {
  'use strict';

  const hero = document.querySelector('[data-cinematic-hero]');
  if (!hero) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -40px' });

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 90}ms`;
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const emberField = hero.querySelector('[data-embers]');
  if (emberField && !reducedMotion) {
    const emberCount = window.innerWidth < 700 ? 12 : 22;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < emberCount; index += 1) {
      const ember = document.createElement('span');
      ember.className = 'ember';
      ember.style.left = `${Math.random() * 100}%`;
      ember.style.setProperty('--duration', `${5 + Math.random() * 6}s`);
      ember.style.setProperty('--delay', `${-Math.random() * 9}s`);
      ember.style.setProperty('--drift', `${-45 + Math.random() * 90}px`);
      ember.style.width = `${2 + Math.random() * 3}px`;
      ember.style.height = ember.style.width;
      fragment.appendChild(ember);
    }

    emberField.appendChild(fragment);
  }

  if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    const depthLayers = hero.querySelectorAll('[data-depth]');
    let frameId = 0;
    let targetX = 0;
    let targetY = 0;

    const renderHeroDepth = () => {
      frameId = 0;
      depthLayers.forEach((layer) => {
        const depth = Number(layer.dataset.depth) || 0.08;
        layer.style.transform = `translate3d(${targetX * depth}px, ${targetY * depth}px, 0) scale(1.06)`;
      });
    };

    hero.addEventListener('pointermove', (event) => {
      const bounds = hero.getBoundingClientRect();
      targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 34;
      targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 24;
      if (!frameId) frameId = requestAnimationFrame(renderHeroDepth);
    });

    hero.addEventListener('pointerleave', () => {
      targetX = 0;
      targetY = 0;
      if (!frameId) frameId = requestAnimationFrame(renderHeroDepth);
    });

    document.querySelectorAll('[data-tilt-card]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${y * -5}deg) rotateY(${x * 7}deg) translateY(-3px)`;
      });

      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }
})();
