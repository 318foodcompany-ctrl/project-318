const film = document.querySelector('[data-delivery-film]');

if (film) {
  const van = film.querySelector('.delivery-van');
  const wheels = film.querySelectorAll('.wheel');
  const crews = film.querySelectorAll('.crew');
  const table = film.querySelector('.event-table');
  const city = film.querySelector('.film-city');
  const clouds = film.querySelectorAll('.film-sky i');
  const progressBar = film.querySelector('.film-progress span');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ticking = false;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const range = (value, start, end) => clamp((value - start) / (end - start));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  function updateFilm() {
    ticking = false;
    if (reduced) {
      film.dataset.scene = '3';
      return;
    }

    const rect = film.getBoundingClientRect();
    const travel = Math.max(film.offsetHeight - window.innerHeight, 1);
    const p = clamp(-rect.top / travel);
    progressBar.style.height = `${p * 100}%`;

    const drive = ease(range(p, 0.02, 0.36));
    const brake = range(p, 0.29, 0.39);
    const unload = ease(range(p, 0.36, 0.67));
    const serve = ease(range(p, 0.64, 0.93));

    const vanX = lerp(-112, 24, drive) - brake * 2;
    const vanBob = Math.sin(p * 70) * (1 - drive) * 2 + Math.sin(p * 36) * (1 - unload) * 0.7;
    van.style.transform = `translate3d(${vanX}vw, ${vanBob}px, 0) rotate(${(1 - drive) * -1.2 + brake * 0.4}deg)`;
    wheels.forEach((wheel) => { wheel.style.transform = `rotate(${drive * 1440}deg)`; });

    city.style.transform = `translate3d(${-drive * 8}vw,0,0)`;
    clouds.forEach((cloud, index) => {
      cloud.style.transform = `translateX(${p * (24 + index * 9)}vw) scale(${[.7,.45,.56][index]})`;
    });

    crews.forEach((crew, index) => {
      const local = ease(range(unload, index * 0.09, 0.45 + index * 0.09));
      const run = ease(range(p, 0.48 + index * 0.025, 0.78 + index * 0.025));
      const direction = index === 1 ? 1 : -1;
      crew.style.opacity = `${clamp(local * 1.7)}`;
      crew.style.transform = `translate3d(${lerp(-12, 28 + index * 15, run)}vw, ${Math.abs(Math.sin(run * Math.PI * 8)) * -9}px, 0) scale(${lerp(.72, .9, local)}) rotate(${Math.sin(run * Math.PI * 8) * direction * 2}deg)`;
      crew.querySelector('.leg-a').style.transform = `rotate(${Math.sin(run * Math.PI * 8) * 34}deg)`;
      crew.querySelector('.leg-b').style.transform = `rotate(${-Math.sin(run * Math.PI * 8) * 34}deg)`;
    });

    table.style.right = `${lerp(-58, 4, serve)}vw`;
    table.style.transform = `translateY(${lerp(24, 0, serve)}px) scale(${lerp(.92, 1, serve)})`;

    if (p < .34) film.dataset.scene = '1';
    else if (p < .68) film.dataset.scene = '2';
    else film.dataset.scene = '3';
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateFilm);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  updateFilm();
}
