const contactContentEditor = document.getElementById("contactContentEditor");
const saveContactContentButton = document.getElementById("saveContactContentButton");
const contactContentMessage = document.getElementById("contactContentMessage");

const contactContentFields = [
  { group: "Hero", key: "hero_heading", label: "Hero Heading", fallback: "Request a Quote", required: true },
  { key: "hero_subheading", label: "Hero Subheading", fallback: "Tell us about your event and get a quick starting estimate. Submitting opens a ready-to-send email on your device.", multiline: true, required: true },
  { group: "Introduction", key: "intro_heading", label: "Introduction Heading", fallback: "Let’s Plan Your Event", required: true },
  { key: "intro_text", label: "Introduction Body Text", fallback: "Share a few details about your event and we’ll help you choose a catering option that fits your guests, schedule, and budget.", multiline: true, required: true },
  { group: "Quote Form", key: "form_heading", label: "Form Section Heading", fallback: "Tell Us What You Need", required: true },
  { key: "form_text", label: "Form Supporting Text", fallback: "Complete the form below to create your catering quote request.", multiline: true, required: true },
  { group: "Service Details", key: "service_area_text", label: "Service-Area Text", fallback: "Proudly serving Northwest Louisiana and surrounding communities.", multiline: true, required: true },
  { key: "response_time_text", label: "Response-Time Text", fallback: "We respond to catering requests as quickly as possible, typically within one business day.", multiline: true, required: true },
  { group: "Call to Action", key: "cta_heading", label: "Call-to-Action Heading", fallback: "Need Help Planning Your Menu?", required: true },
  { key: "cta_text", label: "Call-to-Action Body Text", fallback: "Use our guided event planner to explore options and build a package for your group.", multiline: true, required: true },
  { key: "cta_button", label: "Call-to-Action Button Text", fallback: "Plan My Event", required: true }
];

function setContactContentMessage(message, isError = false) {
  if (!contactContentMessage) return;
  contactContentMessage.textContent = message;
  contactContentMessage.style.color = isError ? "#b42318" : "#16794b";
}

function renderContactContent(values = {}) {
  if (!contactContentEditor) return;
  contactContentEditor.innerHTML = "";

  contactContentFields.forEach((field) => {
    if (field.group) {
      const heading = document.createElement("h3");
      heading.textContent = field.group;
      heading.style.margin = "30px 0 18px";
      contactContentEditor.appendChild(heading);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "editor-field";
    const label = document.createElement("label");
    label.htmlFor = `contact-content-${field.key}`;
    label.textContent = field.required ? `${field.label} *` : field.label;
    const input = document.createElement(field.multiline ? "textarea" : "input");
    input.id = `contact-content-${field.key}`;
    input.value = values[field.key] ?? field.fallback;
    input.dataset.contentKey = field.key;
    input.dataset.required = field.required ? "true" : "false";
    wrapper.append(label, input);
    contactContentEditor.appendChild(wrapper);
  });
}

async function loadContactContent() {
  if (!contactContentEditor || typeof supabaseClient === "undefined" || !supabaseClient) return;
  setContactContentMessage("Loading Contact page content…");

  const { data, error } = await supabaseClient
    .from("website_content")
    .select("content_key, content_value")
    .eq("page", "contact");

  if (error) {
    console.error("Contact content load failed:", error);
    renderContactContent();
    setContactContentMessage(`Could not load Contact content: ${error.message}`, true);
    return;
  }

  const values = Object.fromEntries((data || []).map((item) => [item.content_key, item.content_value]));
  renderContactContent(values);
  setContactContentMessage("");
}

async function saveContactContent() {
  if (!contactContentEditor || !saveContactContentButton || typeof supabaseClient === "undefined" || !supabaseClient) return;
  const fields = [...contactContentEditor.querySelectorAll("input, textarea")];
  const blankRequired = fields.find((field) => field.dataset.required === "true" && !field.value.trim());

  if (blankRequired) {
    blankRequired.focus();
    setContactContentMessage("Complete every field marked with an asterisk before saving.", true);
    return;
  }

  const updates = fields.map((field) => ({
    page: "contact",
    content_key: field.dataset.contentKey,
    content_value: field.value.trim(),
    updated_at: new Date().toISOString()
  }));

  saveContactContentButton.disabled = true;
  setContactContentMessage("Saving Contact page content…");
  const { error } = await supabaseClient
    .from("website_content")
    .upsert(updates, { onConflict: "page,content_key" });
  saveContactContentButton.disabled = false;

  if (error) {
    console.error("Contact content save failed:", error);
    setContactContentMessage(`Save failed: ${error.message}`, true);
    return;
  }

  setContactContentMessage("Contact page content saved successfully.");
}

if (saveContactContentButton) saveContactContentButton.addEventListener("click", saveContactContent);
loadContactContent();
