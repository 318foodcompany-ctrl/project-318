document.addEventListener('DOMContentLoaded', () => {
  if (typeof SUPABASE_URL === 'undefined') {
    return;
  }

  const bucket = 'website-images';
  const cacheVersion = Date.now();

  function photoUrl(fileName) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}?v=${cacheVersion}`;
  }

  function replaceImageWhenAvailable(image, fileName) {
    if (!image) return;

    const nextSrc = photoUrl(fileName);
    const testImage = new Image();

    testImage.onload = () => {
      image.src = nextSrc;
    };

    testImage.src = nextSrc;
  }

  const heroSection = document.querySelector('.hero');

  if (heroSection) {
    const heroUrl = photoUrl('hero.jpg');
    const testImage = new Image();

    testImage.onload = () => {
      heroSection.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${heroUrl}")`;
    };

    testImage.src = heroUrl;
  }

  replaceImageWhenAvailable(document.querySelector('.feature-photo'), 'about.jpg');

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
});
