const settingsEditor = document.getElementById("settingsEditor");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const settingsMessage = document.getElementById("settingsMessage");

const websiteSettingFields = [
  { key: "business_name", label: "Business Name", fallback: "318 Food Co." },
  { key: "phone", label: "Phone Number", type: "tel", fallback: "(318) 572-0137" },
  { key: "email", label: "Email Address", type: "email", fallback: "318FoodCompany@gmail.com" },
  { key: "address", label: "Business Address", fallback: "Northwest Louisiana" },
  { key: "hours", label: "Business Hours", multiline: true, fallback: "By appointment" },
  { key: "facebook_url", label: "Facebook Link", type: "url", placeholder: "https://www.facebook.com/..." },
  { key: "instagram_url", label: "Instagram Link", type: "url", placeholder: "https://www.instagram.com/..." }
];

function setSettingsMessage(message, isError = false) {
  if (!settingsMessage) return;
  settingsMessage.textContent = message;
  settingsMessage.style.color = isError ? "#b42318" : "#16794b";
}

function isMissingSettingsTable(error) {
  const message = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return message.includes("pgrst205") || message.includes("website_settings") && message.includes("not find");
}

async function loadSettingsRows() {
  const primary = await supabaseClient
    .from("website_settings")
    .select("setting_key, setting_value");

  if (!primary.error || !isMissingSettingsTable(primary.error)) return primary;

  const fallback = await supabaseClient
    .from("website_content")
    .select("content_key, content_value")
    .eq("page", "settings");

  return {
    data: (fallback.data || []).map((item) => ({
      setting_key: item.content_key,
      setting_value: item.content_value
    })),
    error: fallback.error,
    usingFallback: true
  };
}

function renderSettings(values = {}) {
  if (!settingsEditor) return;
  settingsEditor.innerHTML = "";

  websiteSettingFields.forEach((field) => {
    const wrapper = document.createElement("div");
    wrapper.className = "editor-field";

    const label = document.createElement("label");
    label.htmlFor = `setting-${field.key}`;
    label.textContent = field.label;

    const input = document.createElement(field.multiline ? "textarea" : "input");
    input.id = `setting-${field.key}`;
    input.dataset.settingKey = field.key;
    input.value = values[field.key] ?? field.fallback ?? "";
    if (field.type) input.type = field.type;
    if (field.placeholder) input.placeholder = field.placeholder;

    wrapper.append(label, input);
    settingsEditor.appendChild(wrapper);
  });
}

async function loadWebsiteSettings() {
  if (!settingsEditor || !supabaseClient) return;
  setSettingsMessage("Loading website settings…");

  const { data, error } = await loadSettingsRows();

  if (error) {
    console.error("Website settings load failed:", error);
    renderSettings();
    setSettingsMessage(`Could not load settings: ${error.message}`, true);
    return;
  }

  const values = Object.fromEntries(
    (data || []).map((item) => [item.setting_key, item.setting_value])
  );
  renderSettings(values);
  setSettingsMessage("");
}

async function saveWebsiteSettings() {
  if (!settingsEditor || !saveSettingsButton || !supabaseClient) return;

  const inputs = [...settingsEditor.querySelectorAll("[data-setting-key]")];
  const phone = inputs.find((input) => input.dataset.settingKey === "phone")?.value.trim();
  const email = inputs.find((input) => input.dataset.settingKey === "email")?.value.trim();

  if (!phone || phone.replace(/\D/g, "").length < 7) {
    setSettingsMessage("Enter a valid phone number.", true);
    return;
  }

  if (!email || !email.includes("@")) {
    setSettingsMessage("Enter a valid email address.", true);
    return;
  }

  const invalidSocialLink = inputs.find((input) =>
    ["facebook_url", "instagram_url"].includes(input.dataset.settingKey) &&
    input.value.trim() &&
    !/^https?:\/\//i.test(input.value.trim())
  );

  if (invalidSocialLink) {
    setSettingsMessage("Social media links must begin with http:// or https://.", true);
    return;
  }

  const rows = inputs.map((input) => ({
    setting_key: input.dataset.settingKey,
    setting_value: input.value.trim(),
    updated_at: new Date().toISOString()
  }));

  saveSettingsButton.disabled = true;
  setSettingsMessage("Saving website settings…");

  let { error } = await supabaseClient
    .from("website_settings")
    .upsert(rows, { onConflict: "setting_key" });

  if (error && isMissingSettingsTable(error)) {
    const fallbackRows = rows.map((row) => ({
      page: "settings",
      content_key: row.setting_key,
      content_value: row.setting_value,
      updated_at: row.updated_at
    }));

    ({ error } = await supabaseClient
      .from("website_content")
      .upsert(fallbackRows, { onConflict: "page,content_key" }));
  }

  saveSettingsButton.disabled = false;

  if (error) {
    console.error("Website settings save failed:", error);
    setSettingsMessage(`Save failed: ${error.message}`, true);
    return;
  }

  setSettingsMessage("Website settings saved successfully.");
}

if (saveSettingsButton) {
  saveSettingsButton.addEventListener("click", saveWebsiteSettings);
}

loadWebsiteSettings();
