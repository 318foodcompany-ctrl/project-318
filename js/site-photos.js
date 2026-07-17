document.addEventListener('DOMContentLoaded', () => {
  if (typeof SUPABASE_URL === 'undefined') {
    return;
  }

  const bucket = 'website-images';
  const cacheVersion = Date.now();

  function photoUrl(fileName) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(fileName)}?v=${cacheVersion}`;
  }

  function whenImageLoads(fileName, onLoad) {
    if (!fileName) return;

    const nextSrc = photoUrl(fileName);
    const testImage = new Image();

    testImage.onload = () => {
      onLoad(nextSrc);
    };

    testImage.src = nextSrc;
  }

  function replaceImageWhenAvailable(image, fileName) {
    if (!image) return;

    whenImageLoads(fileName, (nextSrc) => {
      image.src = nextSrc;
    });
  }

  function replaceBackgroundWhenAvailable(element, fileName, overlay) {
    if (!element) return;

    whenImageLoads(fileName, (nextSrc) => {
      element.style.backgroundImage = overlay
        ? `${overlay}, url("${nextSrc}")`
        : `url("${nextSrc}")`;
      element.style.backgroundSize = 'cover';
      element.style.backgroundPosition = 'center';
    });
  }

  document.querySelectorAll('[data-photo-hero]').forEach((element) => {
    replaceBackgroundWhenAvailable(
      element,
      element.getAttribute('data-photo-hero'),
      'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45))'
    );
  });

  document.querySelectorAll('[data-photo-image]').forEach((image) => {
    replaceImageWhenAvailable(image, image.getAttribute('data-photo-image'));
  });

  replaceBackgroundWhenAvailable(
    document.querySelector('.hero'),
    'hero.jpg',
    'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45))'
  );

  replaceImageWhenAvailable(document.querySelector('.feature-photo:not([data-photo-image])'), 'about.jpg');

  const cateringPhotos = document.querySelectorAll('.package-photo img');
  const cateringFiles = [
    'catering.jpg',
    'gallery1.jpg',
    'gallery2.jpg',
    'gallery3.jpg',
  ];

  cateringPhotos.forEach((image, index) => {
    if (cateringFiles[index]) {
      replaceImageWhenAvailable(image, cateringFiles[index]);
    }
  });

  document.querySelectorAll('[data-gallery-image]').forEach((image, index) => {
    replaceImageWhenAvailable(image, `gallery${index + 1}.jpg`);
  });

  document.querySelectorAll('.brand img, footer img').forEach((image) => {
    replaceImageWhenAvailable(image, 'logo.jpg');
  });

  whenImageLoads('favicon.png', (nextSrc) => {
    let favicon = document.querySelector('link[rel="icon"]');

    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }

    favicon.href = nextSrc;
  });
});
