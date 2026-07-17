const bucket = "website-images";

const photos = [
  { id: "hero", title: "Homepage Hero", file: "hero.jpg", description: "Main homepage background image." },
  { id: "aboutHero", title: "About Hero", file: "about-hero.jpg", description: "Top banner image for the About page." },
  { id: "about", title: "About Section", file: "about.jpg", description: "Main story image on the About page and homepage About section." },
  { id: "corporateHero", title: "Corporate Hero", file: "corporate-hero.jpg", description: "Top banner image for the Corporate Catering page." },
  { id: "corporateSection", title: "Corporate Section", file: "corporate-section.jpg", description: "Main image beside the Corporate Catering section text." },
  { id: "cateringHero", title: "Catering Hero", file: "catering-hero.jpg", description: "Top banner image for the Catering page." },
  { id: "taco", title: "Taco Bar", file: "menu-taco.jpg", description: "Taco Bar package image." },
  { id: "fajita", title: "Fajita Bar", file: "menu-fajita.jpg", description: "Fajita Bar package image." },
  { id: "bbq", title: "BBQ Bar", file: "menu-bbq.jpg", description: "BBQ Bar package image." },
  { id: "deli", title: "Deli Buffet", file: "menu-deli.jpg", description: "Deli Buffet package image." },
  { id: "pasta", title: "Pasta Bar", file: "menu-pasta.jpg", description: "Pasta Bar package image." },
  { id: "pizza", title: "Pizza & Salad", file: "menu-pizza.jpg", description: "Pizza & Salad package image." },
  { id: "galleryHero", title: "Gallery Hero", file: "gallery-hero.jpg", description: "Top banner image for the Gallery page." },
  { id: "gallery1", title: "Gallery Image 1", file: "gallery1.jpg" },
  { id: "gallery2", title: "Gallery Image 2", file: "gallery2.jpg" },
  { id: "gallery3", title: "Gallery Image 3", file: "gallery3.jpg" },
  { id: "logo", title: "Logo", file: "logo.jpg", description: "Website logo used in page navigation.", previewFit: "contain" },
  { id: "favicon", title: "Favicon", file: "favicon.png", description: "Small browser tab icon. PNG works best.", accept: "image/png,image/*", previewFit: "contain" }
];

function photoUrl(fileName) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}?v=${Date.now()}`;
}

async function loadPhotoManager() {
  const container = document.getElementById("photoManager");
  if (!container) return;

  container.innerHTML = "";

  photos.forEach((photo) => {
    container.innerHTML += `
      <div class="photo-card">
        <h3>${photo.title}</h3>
        ${photo.description ? `<p>${photo.description}</p>` : ""}
        <img
          id="${photo.id}-preview"
          src=""
          alt="${photo.title} preview"
          style="width:100%;border-radius:8px;margin:15px 0;max-height:180px;object-fit:${photo.previewFit || "cover"};background:#f3f3f3;"
        >
        <input type="file" id="${photo.id}" accept="${photo.accept || "image/*"}">
        <button onclick="uploadPhoto('${photo.id}','${photo.file}')">Upload</button>
      </div>
    `;
  });

  loadImages();
}

function loadImages() {
  photos.forEach((photo) => {
    const preview = document.getElementById(`${photo.id}-preview`);
    if (preview) preview.src = photoUrl(photo.file);
  });
}

async function uploadPhoto(id, fileName) {
  const input = document.getElementById(id);

  if (!input || input.files.length === 0) {
    alert("Select an image first.");
    return;
  }

  const file = input.files[0];
  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: "0",
      contentType: file.type || undefined,
      upsert: true
    });

  if (error) {
    alert(error.message);
    return;
  }

  input.value = "";
  loadImages();
  alert("Image Updated!");
}

loadPhotoManager();