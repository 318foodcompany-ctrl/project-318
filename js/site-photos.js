document.addEventListener("DOMContentLoaded", () => {
  const bucket = "website-images";

  const heroUrl =
    `${SUPABASE_URL}/storage/v1/object/public/${bucket}/hero.jpg`;

  const testImage = new Image();

  testImage.onload = () => {
    const heroSection = document.querySelector(".hero");

    if (heroSection) {
      heroSection.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${heroUrl}")`;
    }
  };

  testImage.src = `${heroUrl}?v=${Date.now()}`;
});