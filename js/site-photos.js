document.addEventListener("DOMContentLoaded", () => {
  const bucket = "website-images";
  const cacheVersion = Date.now();

  function photoUrl(fileName) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}?v=${cacheVersion}`;
  }

  // Homepage hero
  const heroSection = document.querySelector(".hero");

  if (heroSection) {
    const heroUrl = photoUrl("hero.jpg");
    const testImage = new Image();

    testImage.onload = () => {
      heroSection.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${heroUrl}")`;
    };

    testImage.src = heroUrl;
  }

  // About page
  const aboutImage = document.querySelector(".feature-photo");

  if (aboutImage) {
    aboutImage.src = photoUrl("about.jpg");
  }

  // Catering page
  const cateringPhotos = document.querySelectorAll(".package-photo img");

  const cateringFiles = [
    "catering.jpg",
    "gallery1.jpg",
    "gallery2.jpg",
    "gallery3.jpg"
  ];

  cateringPhotos.forEach((image, index) => {
    if (cateringFiles[index]) {
      image.src = photoUrl(cateringFiles[index]);
    }
  });

  // Gallery page
  const galleryImages = document.querySelectorAll("[data-gallery-image]");

  galleryImages.forEach((image, index) => {
    image.src = photoUrl(`gallery${index + 1}.jpg`);
  });
});