document.addEventListener('DOMContentLoaded', () => {
  if (typeof SUPABASE_URL === 'undefined') return;

  const bucket = 'website-images';
  const cacheVersion = Date.now();

  function photoUrl(fileName) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}?v=${cacheVersion}`;
  }

  function loadRemote(fileName, onLoad) {
    if (!fileName) return;
    const url = photoUrl(fileName);
    const testImage = new Image();
    testImage.onload = () => onLoad(url);
    testImage.src = url;
  }

  function replaceImageWhenAvailable(image, fileName) {
    if (!image || !fileName) return;
    loadRemote(fileName, (url) => {
      image.src = url;
    });
  }

  function setHeroWhenAvailable(section, fileName) {
    if (!section || !fileName) return;
    loadRemote(fileName, (url) => {
      section.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${url}")`;
      section.style.backgroundSize = 'cover';
      section.style.backgroundPosition = 'center';
    });
  }

  setHeroWhenAvailable(document.querySelector('.hero'), 'hero.jpg');

  document.querySelectorAll('[data-photo-hero]').forEach((section) => {
    setHeroWhenAvailable(section, section.dataset.photoHero);
  });

  document.querySelectorAll('[data-photo-image]').forEach((image) => {
    replaceImageWhenAvailable(image, image.dataset.photoImage);
  });

  const aboutImage = document.querySelector('.feature-photo:not([data-photo-image])');
  replaceImageWhenAvailable(aboutImage, 'about.jpg');

  document.querySelectorAll('[data-gallery-image]').forEach((image, index) => {
    replaceImageWhenAvailable(image, `gallery${index + 1}.jpg`);
  });

  document.querySelectorAll('.brand img, .footer img').forEach((logo) => {
    replaceImageWhenAvailable(logo, 'logo.jpg');
  });

  loadRemote('favicon.png', (url) => {
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = url;
  });
});