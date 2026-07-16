const bucket = "website-images";

const photos = [
  {
    id: "hero",
    title: "Homepage Hero",
    file: "hero.jpg"
  },
  {
    id: "about",
    title: "About Section",
    file: "about.jpg"
  },
  {
    id: "catering",
    title: "Catering Section",
    file: "catering.jpg"
  },
  {
    id: "gallery1",
    title: "Gallery Image 1",
    file: "gallery1.jpg"
  },
  {
    id: "gallery2",
    title: "Gallery Image 2",
    file: "gallery2.jpg"
  },
  {
    id: "gallery3",
    title: "Gallery Image 3",
    file: "gallery3.jpg"
  }
];

async function loadPhotoManager() {

    const container = document.getElementById("photoManager");

    container.innerHTML = "";

    photos.forEach(photo=>{

        container.innerHTML += `
       <div class="photo-card">
            <h3>${photo.title}</h3>

            <img
                id="${photo.id}-preview"
                src=""
                style="width:100%;border-radius:8px;margin:15px 0;max-height:180px;object-fit:cover;"
            >

            <input
                type="file"
                id="${photo.id}"
                accept="image/*"
            >

            <button onclick="uploadPhoto('${photo.id}','${photo.file}')">
                Upload
            </button>

        </div>
        `;
    });

    loadImages();

}

async function loadImages(){

    photos.forEach(photo=>{

        const url =
        `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${photo.file}?${Date.now()}`;

        document.getElementById(photo.id+"-preview").src=url;

    });

}

async function uploadPhoto(id,fileName){

    const input=document.getElementById(id);

    if(input.files.length===0){
        alert("Select an image first.");
        return;
    }

    const file=input.files[0];

   const { error } = await supabaseClient.storage
  .from(bucket)
  .upload(fileName, file, {
    upsert: true
  });

    if(error){
        alert(error.message);
        return;
    }

    loadImages();

    alert("Image Updated!");

}

loadPhotoManager();