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
const aboutImage = document.querySelector(".feature-photo");

if (aboutImage) {
    aboutImage.src =
        `${SUPABASE_URL}/storage/v1/object/public/website-images/about.jpg`;
}
const cateringPhotos = document.querySelectorAll(".package-photo img");

const cateringFiles = [
    "catering.jpg",
    "gallery1.jpg",
    "gallery2.jpg",
    "gallery3.jpg"
];

cateringPhotos.forEach((img, index) => {
    if (cateringFiles[index]) {
        img.src =
            `${SUPABASE_URL}/storage/v1/object/public/website-images/${cateringFiles[index]}`;
    }
});