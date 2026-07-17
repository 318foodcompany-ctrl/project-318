const menuEditor = document.getElementById("menuEditor");
const saveMenuButton = document.getElementById("saveMenuButton");
const menuMessage = document.getElementById("menuMessage");

async function loadMenuItems() {
  if (!menuEditor) return;

  menuMessage.textContent = "Loading menu items…";

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error(error);
    menuMessage.textContent = `Could not load menu items: ${error.message}`;
    return;
  }

  menuEditor.innerHTML = "";

  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "editor-field";

    card.innerHTML = `
      <label>Menu Name</label>
      <input data-field="name" data-id="${item.id}" value="${item.name || ""}">

      <label>Subtitle</label>
      <input data-field="subtitle" data-id="${item.id}" value="${item.subtitle || ""}">

      <label>Price</label>
      <input data-field="price" data-id="${item.id}" value="${item.price || ""}">

      <label>Button Text</label>
      <input data-field="button_text" data-id="${item.id}" value="${item.button_text || ""}">

      <label>Button Link</label>
      <input data-field="button_link" data-id="${item.id}" value="${item.button_link || ""}">
    `;

    menuEditor.appendChild(card);
  });

  menuMessage.textContent = "";
}

async function saveMenuItems() {
  saveMenuButton.disabled = true;
  menuMessage.textContent = "Saving menu items…";

  const inputs = menuEditor.querySelectorAll("input");
  const updatesById = {};

  inputs.forEach((input) => {
    const id = input.dataset.id;

    if (!updatesById[id]) {
      updatesById[id] = { id };
    }

    updatesById[id][input.dataset.field] = input.value.trim();
  });

  const updates = Object.values(updatesById);

  const { error } = await supabaseClient
    .from("menu_items")
    .upsert(updates);

  saveMenuButton.disabled = false;

  if (error) {
    console.error(error);
    menuMessage.textContent = `Save failed: ${error.message}`;
    return;
  }

  menuMessage.textContent = "Menu changes saved successfully.";
}

if (saveMenuButton) {
  saveMenuButton.addEventListener("click", saveMenuItems);
}

loadMenuItems();