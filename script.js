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
    if ((typeof readyCheck === 'function' && readyCheck()) || document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  ensureStylesheet('css/consent-manager.css', 'project318-consent-styles');
  ensureScript('js/consent-manager.js', 'project318-consent-script', () => Boolean(window.Project318Consent));
  ensureScript('js/analytics-events.js', 'project318-analytics-events-script', () => Boolean(window.Project318Analytics));
  ensureScript('js/ga4-provider.js', 'project318-ga4-provider-script', () => Boolean(window.Project318GA4));
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
