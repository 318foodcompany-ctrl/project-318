document.addEventListener("DOMContentLoaded", () => {
  const bucket = "website-images";
  const cacheVersion = Date.now();

  function photoUrl(fileName) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}?v=${cacheVersion}`;
  }

  function setImageWhenAvailable(image, fileName) {
    if (!image || !fileName) {
      return;
    }

    const imageUrl = photoUrl(fileName);
    const testImage = new Image();

    testImage.onload = () => {
      image.src = imageUrl;
    };

    testImage.src = imageUrl;
  }

  function setHeroWhenAvailable(heroSection, fileName) {
    if (!heroSection || !fileName) {
      return;
    }

    const heroUrl = photoUrl(fileName);
    const testImage = new Image();

    testImage.onload = () => {
      heroSection.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${heroUrl}")`;
      heroSection.style.backgroundSize = "cover";
      heroSection.style.backgroundPosition = "center";
    };

    testImage.src = heroUrl;
  }

  function setFaviconWhenAvailable(fileName) {
    const faviconUrl = photoUrl(fileName);
    const testImage = new Image();

    testImage.onload = () => {
      let favicon = document.querySelector("link[rel='icon']");

      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }

      favicon.href = faviconUrl;
    };

    testImage.src = faviconUrl;
  }

  // Site logo and favicon
  document.querySelectorAll(".brand img, .footer img").forEach((logo) => {
    setImageWhenAvailable(logo, "logo.jpg");
  });

  setFaviconWhenAvailable("favicon.png");

  // Homepage hero
  setHeroWhenAvailable(document.querySelector(".hero"), "hero.jpg");

  // Page-specific hero images
  document.querySelectorAll("[data-photo-hero]").forEach((heroSection) => {
    setHeroWhenAvailable(heroSection, heroSection.dataset.photoHero);
  });

  // Explicit page/section images
  document.querySelectorAll("[data-photo-image]").forEach((image) => {
    setImageWhenAvailable(image, image.dataset.photoImage);
  });

  // Existing About image behavior for pages that have not been marked up yet.
  const aboutImage = document.querySelector(".feature-photo:not([data-photo-image])");

  if (aboutImage) {
    setImageWhenAvailable(aboutImage, "about.jpg");
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
      setImageWhenAvailable(image, cateringFiles[index]);
    }
  });

  // Gallery page
  const galleryImages = document.querySelectorAll("[data-gallery-image]");

  galleryImages.forEach((image, index) => {
    setImageWhenAvailable(image, `gallery${index + 1}.jpg`);
  });
});
