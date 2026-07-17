const contentEditor = document.getElementById("contentEditor");
const saveContentButton = document.getElementById("saveContentButton");
const contentMessage = document.getElementById("contentMessage");

const homepageContentFields = [
  { group: "Homepage Hero", key: "hero_eyebrow", label: "Hero Eyebrow Text", fallback: "Fresh Catering" },
  { key: "hero_heading", label: "Hero Headline", fallback: "Catering Made Easy", required: true },
  { key: "hero_text", label: "Hero Subheading", fallback: "From office lunches to weddings and celebrations, 318 Food Co. makes catering simple.", multiline: true, required: true },
  { key: "hero_button", label: "Primary Button Text", fallback: "Plan My Event", required: true },
  { key: "hero_button_link", label: "Primary Button Link", fallback: "quote-builder.html", type: "url-path", required: true },
  { key: "hero_secondary_button", label: "Secondary Button Text", fallback: "View Catering Menus", required: true },
  { key: "hero_secondary_button_link", label: "Secondary Button Link", fallback: "catering.html", type: "url-path", required: true },
  { key: "minimum_order", label: "Minimum Order Text", fallback: "Minimum order: 15 people" },

  { group: "Featured Highlights", key: "trust_1_title", label: "Highlight 1 Heading", fallback: "Delicious Food", required: true },
  { key: "trust_1_text", label: "Highlight 1 Description", fallback: "Made fresh with quality ingredients.", multiline: true, required: true },
  { key: "trust_2_title", label: "Highlight 2 Heading", fallback: "We Come to You", required: true },
  { key: "trust_2_text", label: "Highlight 2 Description", fallback: "Easy delivery and setup for your event.", multiline: true, required: true },
  { key: "trust_3_title", label: "Highlight 3 Heading", fallback: "Any Occasion", required: true },
  { key: "trust_3_text", label: "Highlight 3 Description", fallback: "Corporate, social, and everything in between.", multiline: true, required: true },
  { key: "trust_4_title", label: "Highlight 4 Heading", fallback: "Professional", required: true },
  { key: "trust_4_text", label: "Highlight 4 Description", fallback: "Reliable service from planning to cleanup.", multiline: true, required: true },

  { group: "Featured Catering Options", key: "menu_section_heading", label: "Featured Section Heading", fallback: "Catering Options", required: true },
  { key: "menu_section_text", label: "Featured Section Description", fallback: "Choose from crowd-pleasing favorites for every type of event.", multiline: true, required: true },
  { key: "featured_taco_heading", label: "Taco Card Heading", fallback: "Taco Bar", required: true },
  { key: "featured_taco_text", label: "Taco Card Description", fallback: "Seasoned proteins, classic sides and a full spread of fresh toppings.", multiline: true, required: true },
  { key: "featured_fajita_heading", label: "Fajita Card Heading", fallback: "Fajita Bar", required: true },
  { key: "featured_fajita_text", label: "Fajita Card Description", fallback: "Sizzling chicken and steak fajitas with peppers, onions and sides.", multiline: true, required: true },
  { key: "featured_bbq_heading", label: "BBQ Card Heading", fallback: "BBQ Bar", required: true },
  { key: "featured_bbq_text", label: "BBQ Card Description", fallback: "Pulled pork, smoked sausage and down-home sides.", multiline: true, required: true },
  { key: "featured_deli_heading", label: "Deli Card Heading", fallback: "Deli Buffet", required: true },
  { key: "featured_deli_text", label: "Deli Card Description", fallback: "Premium meats, cheeses, fresh toppings, chips and cookies.", multiline: true, required: true },
  { key: "featured_pasta_heading", label: "Pasta Card Heading", fallback: "Pasta Bar", required: true },
  { key: "featured_pasta_text", label: "Pasta Card Description", fallback: "Comforting pasta entrées with salad, garlic bread, and cookies or brownies.", multiline: true, required: true },
  { key: "featured_pizza_heading", label: "Pizza Card Heading", fallback: "Pizza & Salad", required: true },
  { key: "featured_pizza_text", label: "Pizza Card Description", fallback: "Fresh pizzas, crisp salads, hearty sides, and cookies or brownies.", multiline: true, required: true },

  { group: "Welcome Section", key: "feature_heading", label: "Welcome Section Heading", fallback: "Made for Your Next Event", required: true },
  { key: "feature_text", label: "Welcome Section Body Text", fallback: "Tell us your guest count, budget, and service needs. We will help you build the right catering plan.", multiline: true, required: true },

  { group: "Final Call to Action", key: "cta_heading", label: "Call-to-Action Heading", fallback: "Let Us Cater Your Next Event" },
  { key: "cta_text", label: "Call-to-Action Text", fallback: "Start your request today and our team will follow up with menu and service options.", multiline: true },
  { key: "cta_button", label: "Call-to-Action Button", fallback: "Plan My Event" },
  { key: "footer_text", label: "Footer Text", fallback: "318 Food Co. Catering Made Simple." }
];

function setContentMessage(message, isError = false) {
  if (!contentMessage) return;
  contentMessage.textContent = message;
  contentMessage.style.color = isError ? "#b42318" : "#16794b";
}

function isSafeContentLink(value) {
  return /^(?:https?:\/\/|mailto:|tel:|#|[a-z0-9._/-]+\.html(?:#[a-z0-9_-]+)?$)/i.test(value);
}

function renderHomepageContent(values = {}) {
  if (!contentEditor) return;
  contentEditor.innerHTML = "";

  homepageContentFields.forEach((field) => {
    if (field.group) {
      const heading = document.createElement("h3");
      heading.textContent = field.group;
      heading.style.margin = "30px 0 18px";
      contentEditor.appendChild(heading);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "editor-field";

    const label = document.createElement("label");
    label.htmlFor = `content-${field.key}`;
    label.textContent = field.required ? `${field.label} *` : field.label;

    const input = document.createElement(field.multiline ? "textarea" : "input");
    input.id = `content-${field.key}`;
    input.value = values[field.key] ?? field.fallback;
    input.dataset.page = "home";
    input.dataset.contentKey = field.key;
    input.dataset.required = field.required ? "true" : "false";
    if (field.type) input.dataset.fieldType = field.type;

    wrapper.append(label, input);
    contentEditor.appendChild(wrapper);
  });
}

async function loadWebsiteContent() {
  if (!contentEditor || !supabaseClient) return;
  setContentMessage("Loading homepage content…");

  const { data, error } = await supabaseClient
    .from("website_content")
    .select("content_key, content_value")
    .eq("page", "home");

  if (error) {
    console.error("Homepage content load failed:", error);
    renderHomepageContent();
    setContentMessage(`Could not load content: ${error.message}`, true);
    return;
  }

  const values = Object.fromEntries(
    (data || []).map((item) => [item.content_key, item.content_value])
  );
  renderHomepageContent(values);
  setContentMessage("");
}

async function saveWebsiteContent() {
  if (!contentEditor || !saveContentButton || !supabaseClient) return;

  const fields = [...contentEditor.querySelectorAll("input, textarea")];
  const blankRequired = fields.find((field) =>
    field.dataset.required === "true" && !field.value.trim()
  );

  if (blankRequired) {
    blankRequired.focus();
    setContentMessage("Complete every field marked with an asterisk before saving.", true);
    return;
  }

  const invalidLink = fields.find((field) =>
    field.dataset.fieldType === "url-path" && !isSafeContentLink(field.value.trim())
  );

  if (invalidLink) {
    invalidLink.focus();
    setContentMessage("Button links must be a page link, #section, mailto:, tel:, or an http(s) URL.", true);
    return;
  }

  const updates = fields.map((field) => ({
    page: field.dataset.page,
    content_key: field.dataset.contentKey,
    content_value: field.value.trim(),
    updated_at: new Date().toISOString()
  }));

  saveContentButton.disabled = true;
  setContentMessage("Saving homepage content…");

  const { error } = await supabaseClient
    .from("website_content")
    .upsert(updates, { onConflict: "page,content_key" });

  saveContentButton.disabled = false;

  if (error) {
    console.error("Homepage content save failed:", error);
    setContentMessage(`Save failed: ${error.message}`, true);
    return;
  }

  setContentMessage("Homepage content saved successfully.");
}

if (saveContentButton) {
  saveContentButton.addEventListener("click", saveWebsiteContent);
}

loadWebsiteContent();
