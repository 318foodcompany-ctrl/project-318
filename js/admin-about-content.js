const aboutContentEditor = document.getElementById("aboutContentEditor");
const saveAboutContentButton = document.getElementById("saveAboutContentButton");
const aboutContentMessage = document.getElementById("aboutContentMessage");

const aboutContentFields = [
  { group: "Hero", key: "hero_heading", label: "Hero Heading", fallback: "About 318 Food Co.", required: true },
  { key: "hero_subheading", label: "Hero Subheading", fallback: "Fresh food, dependable service, and catering designed around your event.", multiline: true, required: true },
  { group: "Main Story", key: "story_eyebrow", label: "Story Eyebrow", fallback: "Our Story" },
  { key: "story_heading", label: "Main Story Heading", fallback: "Catering Made Simple", required: true },
  { key: "story_paragraph_1", label: "Main Story Paragraph 1", fallback: "318 Food Co. helps businesses, families, and organizations serve memorable meals without the stress of handling every detail themselves.", multiline: true, required: true },
  { key: "story_paragraph_2", label: "Main Story Paragraph 2", fallback: "From office lunches and corporate meetings to weddings, celebrations, and community events, we focus on fresh food, clear communication, and dependable service.", multiline: true, required: true },
  { key: "story_paragraph_3", label: "Main Story Paragraph 3", fallback: "Every event is different. We work with you to choose the right menu, portions, presentation, and service options for your guests and budget.", multiline: true, required: true },
  { key: "story_button", label: "Story Button Wording", fallback: "Request a Catering Quote", required: true },
  { group: "Mission", key: "mission_heading", label: "Mission Section Heading", fallback: "Our Mission", required: true },
  { key: "mission_text", label: "Mission Section Text", fallback: "Make catering simple with fresh food, dependable service, and a plan built around every customer’s occasion.", multiline: true, required: true },
  { group: "Values", key: "value_1_heading", label: "Value 1 Heading", fallback: "Fresh Food", required: true },
  { key: "value_1_text", label: "Value 1 Description", fallback: "Prepared with care", multiline: true, required: true },
  { key: "value_2_heading", label: "Value 2 Heading", fallback: "Dependable Service", required: true },
  { key: "value_2_text", label: "Value 2 Description", fallback: "Clear and professional", multiline: true, required: true },
  { key: "value_3_heading", label: "Value 3 Heading", fallback: "Any Occasion", required: true },
  { key: "value_3_text", label: "Value 3 Description", fallback: "Business or celebration", multiline: true, required: true },
  { key: "value_4_heading", label: "Value 4 Heading", fallback: "Local Experience", required: true },
  { key: "value_4_text", label: "Value 4 Description", fallback: "Serving the 318 area", multiline: true, required: true },
  { group: "Call to Action", key: "cta_heading", label: "Call-to-Action Heading", fallback: "Ready to Plan Your Event?", required: true },
  { key: "cta_text", label: "Call-to-Action Text", fallback: "Tell us what you need and we’ll help build the right catering plan.", multiline: true, required: true },
  { key: "cta_button", label: "Call-to-Action Button Wording", fallback: "Plan My Event", required: true }
];

function setAboutContentMessage(message, isError = false) {
  if (!aboutContentMessage) return;
  aboutContentMessage.textContent = message;
  aboutContentMessage.style.color = isError ? "#b42318" : "#16794b";
}

function renderAboutContent(values = {}) {
  if (!aboutContentEditor) return;
  aboutContentEditor.innerHTML = "";

  aboutContentFields.forEach((field) => {
    if (field.group) {
      const heading = document.createElement("h3");
      heading.textContent = field.group;
      heading.style.margin = "30px 0 18px";
      aboutContentEditor.appendChild(heading);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "editor-field";
    const label = document.createElement("label");
    label.htmlFor = `about-content-${field.key}`;
    label.textContent = field.required ? `${field.label} *` : field.label;
    const input = document.createElement(field.multiline ? "textarea" : "input");
    input.id = `about-content-${field.key}`;
    input.value = values[field.key] ?? field.fallback;
    input.dataset.contentKey = field.key;
    input.dataset.required = field.required ? "true" : "false";
    wrapper.append(label, input);
    aboutContentEditor.appendChild(wrapper);
  });
}

async function loadAboutContent() {
  if (!aboutContentEditor || !supabaseClient) return;
  setAboutContentMessage("Loading About page content…");
  const { data, error } = await supabaseClient
    .from("website_content")
    .select("content_key, content_value")
    .eq("page", "about");

  if (error) {
    console.error("About content load failed:", error);
    renderAboutContent();
    setAboutContentMessage(`Could not load About content: ${error.message}`, true);
    return;
  }

  const values = Object.fromEntries((data || []).map((item) => [item.content_key, item.content_value]));
  renderAboutContent(values);
  setAboutContentMessage("");
}

async function saveAboutContent() {
  if (!aboutContentEditor || !saveAboutContentButton || !supabaseClient) return;
  const fields = [...aboutContentEditor.querySelectorAll("input, textarea")];
  const blankRequired = fields.find((field) => field.dataset.required === "true" && !field.value.trim());

  if (blankRequired) {
    blankRequired.focus();
    setAboutContentMessage("Complete every field marked with an asterisk before saving.", true);
    return;
  }

  const updates = fields.map((field) => ({
    page: "about",
    content_key: field.dataset.contentKey,
    content_value: field.value.trim(),
    updated_at: new Date().toISOString()
  }));

  saveAboutContentButton.disabled = true;
  setAboutContentMessage("Saving About page content…");
  const { error } = await supabaseClient.from("website_content").upsert(updates, { onConflict: "page,content_key" });
  saveAboutContentButton.disabled = false;

  if (error) {
    console.error("About content save failed:", error);
    setAboutContentMessage(`Save failed: ${error.message}`, true);
    return;
  }
  setAboutContentMessage("About page content saved successfully.");
}

if (saveAboutContentButton) saveAboutContentButton.addEventListener("click", saveAboutContent);
loadAboutContent();
