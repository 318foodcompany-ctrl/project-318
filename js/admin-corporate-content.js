const corporateContentEditor = document.getElementById("corporateContentEditor");
const saveCorporateContentButton = document.getElementById("saveCorporateContentButton");
const corporateContentMessage = document.getElementById("corporateContentMessage");

const corporateContentFields = [
  { group: "Hero", key: "hero_heading", label: "Hero Heading", fallback: "Corporate Catering", required: true },
  { key: "hero_subheading", label: "Hero Subheading", fallback: "Reliable meals for meetings, training sessions, employee appreciation, grand openings and recurring office lunches.", multiline: true, required: true },
  { group: "Introduction", key: "intro_eyebrow", label: "Intro Eyebrow", fallback: "Feed the team without the stress" },
  { key: "intro_heading", label: "Intro Heading", fallback: "On Time. Organized. Ready to Serve.", required: true },
  { key: "intro_text", label: "Intro Description", fallback: "We understand that business catering has to be dependable. We coordinate timing, quantities and setup so your meeting stays on schedule and your team stays focused.", multiline: true, required: true },
  { key: "intro_button", label: "Intro Button Wording", fallback: "Request a Corporate Quote", required: true },
  { group: "Benefits", key: "benefit_1", label: "Benefit 1", fallback: "Boxed or buffet-style meals", required: true },
  { key: "benefit_2", label: "Benefit 2", fallback: "15-person minimum", required: true },
  { key: "benefit_3", label: "Benefit 3", fallback: "Delivery and setup options", required: true },
  { key: "benefit_4", label: "Benefit 4", fallback: "Recurring lunch programs", required: true },
  { key: "benefit_5", label: "Benefit 5", fallback: "Custom menu planning", required: true },
  { key: "benefit_6", label: "Benefit 6", fallback: "Simple quote process", required: true },
  { group: "Corporate Services", key: "services_heading", label: "Services Section Heading", fallback: "Perfect For", required: true },
  { key: "services_text", label: "Services Section Description", fallback: "Any team. Any workday. Any reason to gather.", multiline: true, required: true },
  { key: "service_1_heading", label: "Service 1 Heading", fallback: "Meetings & Training", required: true },
  { key: "service_1_text", label: "Service 1 Description", fallback: "Easy buffet meals that keep the day moving.", multiline: true, required: true },
  { key: "service_2_heading", label: "Service 2 Heading", fallback: "Employee Appreciation", required: true },
  { key: "service_2_text", label: "Service 2 Description", fallback: "A fresh, memorable meal for the people who make it happen.", multiline: true, required: true },
  { key: "service_3_heading", label: "Service 3 Heading", fallback: "Office & Job Sites", required: true },
  { key: "service_3_text", label: "Service 3 Description", fallback: "Delivery options for offices, schools, healthcare teams and crews.", multiline: true, required: true },
  { group: "Corporate Catering Process", key: "process_heading", label: "Process Section Heading", fallback: "Corporate Catering Made Simple", required: true },
  { key: "process_text", label: "Process Section Description", fallback: "A clear process keeps planning easy and your event on schedule.", multiline: true, required: true },
  { key: "process_1_heading", label: "Process Step 1 Heading", fallback: "Share the Details", required: true },
  { key: "process_1_text", label: "Process Step 1 Description", fallback: "Tell us your date, guest count, location, and service needs.", multiline: true, required: true },
  { key: "process_2_heading", label: "Process Step 2 Heading", fallback: "Choose Your Menu", required: true },
  { key: "process_2_text", label: "Process Step 2 Description", fallback: "We help match a crowd-pleasing package to your team and budget.", multiline: true, required: true },
  { key: "process_3_heading", label: "Process Step 3 Heading", fallback: "We Handle the Rest", required: true },
  { key: "process_3_text", label: "Process Step 3 Description", fallback: "Our team coordinates preparation, delivery, and setup for a smooth meal.", multiline: true, required: true },
  { group: "Call to Action", key: "cta_heading", label: "Call-to-Action Heading", fallback: "Book Your Next Team Meal", required: true },
  { key: "cta_text", label: "Call-to-Action Text", fallback: "Tell us about your next meeting, team lunch, or company event.", multiline: true, required: true },
  { key: "cta_button", label: "Call-to-Action Button Wording", fallback: "Request a Corporate Quote", required: true }
];

function setCorporateContentMessage(message, isError = false) {
  if (!corporateContentMessage) return;
  corporateContentMessage.textContent = message;
  corporateContentMessage.style.color = isError ? "#b42318" : "#16794b";
}

function renderCorporateContent(values = {}) {
  if (!corporateContentEditor) return;
  corporateContentEditor.innerHTML = "";
  corporateContentFields.forEach((field) => {
    if (field.group) {
      const heading = document.createElement("h3");
      heading.textContent = field.group;
      heading.style.margin = "30px 0 18px";
      corporateContentEditor.appendChild(heading);
    }
    const wrapper = document.createElement("div");
    wrapper.className = "editor-field";
    const label = document.createElement("label");
    label.htmlFor = `corporate-content-${field.key}`;
    label.textContent = field.required ? `${field.label} *` : field.label;
    const input = document.createElement(field.multiline ? "textarea" : "input");
    input.id = `corporate-content-${field.key}`;
    input.value = values[field.key] ?? field.fallback;
    input.dataset.contentKey = field.key;
    input.dataset.required = field.required ? "true" : "false";
    wrapper.append(label, input);
    corporateContentEditor.appendChild(wrapper);
  });
}

async function loadCorporateContent() {
  if (!corporateContentEditor || !supabaseClient) return;
  setCorporateContentMessage("Loading Corporate page content…");
  const { data, error } = await supabaseClient
    .from("website_content")
    .select("content_key, content_value")
    .eq("page", "corporate");

  if (error) {
    console.error("Corporate content load failed:", error);
    renderCorporateContent();
    setCorporateContentMessage(`Could not load Corporate content: ${error.message}`, true);
    return;
  }
  const values = Object.fromEntries((data || []).map((item) => [item.content_key, item.content_value]));
  renderCorporateContent(values);
  setCorporateContentMessage("");
}

async function saveCorporateContent() {
  if (!corporateContentEditor || !saveCorporateContentButton || !supabaseClient) return;
  const fields = [...corporateContentEditor.querySelectorAll("input, textarea")];
  const blankRequired = fields.find((field) => field.dataset.required === "true" && !field.value.trim());
  if (blankRequired) {
    blankRequired.focus();
    setCorporateContentMessage("Complete every field marked with an asterisk before saving.", true);
    return;
  }

  const updates = fields.map((field) => ({
    page: "corporate",
    content_key: field.dataset.contentKey,
    content_value: field.value.trim(),
    updated_at: new Date().toISOString()
  }));
  saveCorporateContentButton.disabled = true;
  setCorporateContentMessage("Saving Corporate page content…");
  const { error } = await supabaseClient.from("website_content").upsert(updates, { onConflict: "page,content_key" });
  saveCorporateContentButton.disabled = false;

  if (error) {
    console.error("Corporate content save failed:", error);
    setCorporateContentMessage(`Save failed: ${error.message}`, true);
    return;
  }
  setCorporateContentMessage("Corporate page content saved successfully.");
}

if (saveCorporateContentButton) saveCorporateContentButton.addEventListener("click", saveCorporateContent);
loadCorporateContent();
