const contentEditor = document.getElementById("contentEditor");
const saveContentButton = document.getElementById("saveContentButton");
const contentMessage = document.getElementById("contentMessage");

const fieldLabels = {
  hero_eyebrow: "Hero Eyebrow Text",
  hero_heading: "Main Heading",
  hero_text: "Intro Text",
  hero_button: "Main Button Text",
  hero_secondary_button: "Secondary Button Text",
  minimum_order: "Minimum Order Text",

  trust_1_title: "Trust Item 1 Title",
  trust_1_text: "Trust Item 1 Description",
  trust_2_title: "Trust Item 2 Title",
  trust_2_text: "Trust Item 2 Description",
  trust_3_title: "Trust Item 3 Title",
  trust_3_text: "Trust Item 3 Description",
  trust_4_title: "Trust Item 4 Title",
  trust_4_text: "Trust Item 4 Description",

  menu_section_heading: "Menu Section Heading",
  menu_section_text: "Menu Section Description",

  feature_heading: "Feature Section Heading",
  feature_text: "Feature Section Description",

  cta_heading: "Call-to-Action Heading",
  cta_text: "Call-to-Action Text",
  cta_button: "Call-to-Action Button",

  footer_text: "Footer Text"
};

async function loadWebsiteContent() {
  contentMessage.textContent = "Loading website content…";

  const { data, error } = await supabaseClient
    .from("website_content")
    .select("page, content_key, content_value")
    .eq("page", "home")
    .order("content_key");

  if (error) {
    console.error(error);
    contentMessage.textContent = `Could not load content: ${error.message}`;
    return;
  }

  contentEditor.innerHTML = "";

  data.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "editor-field";

    const label = document.createElement("label");
    label.textContent = fieldLabels[item.content_key] || item.content_key;

    const input =
      item.content_key === "hero_text"
        ? document.createElement("textarea")
        : document.createElement("input");

    input.value = item.content_value || "";
    input.dataset.page = item.page;
    input.dataset.contentKey = item.content_key;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    contentEditor.appendChild(wrapper);
  });

  contentMessage.textContent = "";
}

async function saveWebsiteContent() {
  saveContentButton.disabled = true;
  contentMessage.textContent = "Saving changes…";

  const fields = contentEditor.querySelectorAll("input, textarea");

  const updates = Array.from(fields).map((field) => ({
    page: field.dataset.page,
    content_key: field.dataset.contentKey,
    content_value: field.value.trim(),
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabaseClient
    .from("website_content")
    .upsert(updates, {
      onConflict: "page,content_key"
    });

  saveContentButton.disabled = false;

  if (error) {
    console.error(error);
    contentMessage.textContent = `Save failed: ${error.message}`;
    return;
  }

  contentMessage.textContent = "Changes saved successfully.";
}

saveContentButton.addEventListener("click", saveWebsiteContent);

loadWebsiteContent();