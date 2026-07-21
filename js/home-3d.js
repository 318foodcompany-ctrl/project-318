(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('[data-food-stage]');
  const cards = [...document.querySelectorAll('[data-depth-card]')];

  if (stage && cards.length && !reduceMotion) {
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const render = () => {
      frame = 0;
      cards.forEach((card, index) => {
        const depth = Number(card.dataset.depth || 1);
        const direction = index % 2 === 0 ? 1 : -1;
        card.style.setProperty('--tilt-x', `${pointerY * -4 * depth}deg`);
        card.style.setProperty('--tilt-y', `${pointerX * 5 * depth}deg`);
        card.style.setProperty('--mx', `${pointerX * 12 * depth * direction}px`);
        card.style.setProperty('--my', `${pointerY * 9 * depth}px`);
      });
    };

    const updatePointer = (clientX, clientY) => {
      const rect = stage.getBoundingClientRect();
      pointerX = ((clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((clientY - rect.top) / rect.height - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(render);
    };

    stage.addEventListener('pointermove', event => updatePointer(event.clientX, event.clientY), { passive: true });
    stage.addEventListener('pointerleave', () => {
      pointerX = 0;
      pointerY = 0;
      if (!frame) frame = requestAnimationFrame(render);
    });

    if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
      window.addEventListener('deviceorientation', event => {
        if (event.gamma == null || event.beta == null) return;
        pointerX = Math.max(-1, Math.min(1, event.gamma / 30));
        pointerY = Math.max(-1, Math.min(1, (event.beta - 45) / 45));
        if (!frame) frame = requestAnimationFrame(render);
      }, { passive: true });
    }
  }

  const revealItems = [...document.querySelectorAll('.reveal-3d')];
  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealItems.forEach(item => item.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  revealItems.forEach(item => observer.observe(item));
})();