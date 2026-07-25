(function adminConversionContentModule(globalScope) {
  "use strict";

  const definitions = {
    testimonial: { label: "Testimonials", table: "conversion_items", fixed: { item_type: "testimonial" }, fields: [["title","Customer / source","text",true],["body","Testimonial","textarea",true],["value_text","Attribution label","text",false]] },
    review: { label: "Review Highlights", table: "conversion_items", fixed: { item_type: "review" }, fields: [["title","Review heading","text",true],["body","Review excerpt","textarea",true],["value_text","Review source","text",false]] },
    client_logo: { label: "Client Logos", table: "conversion_items", fixed: { item_type: "client_logo" }, media: true, fields: [["title","Client name","text",true],["body","Supporting text","textarea",false],["media_url","Logo URL","url",false],["alt_text","Logo alt text","text",false]] },
    statistic: { label: "Homepage Statistics", table: "conversion_items", fixed: { item_type: "statistic" }, fields: [["title","Statistic label","text",true],["value_text","Statistic value","text",true],["body","Supporting text","textarea",false]] },
    trust_badge: { label: "Trust Badges", table: "conversion_items", fixed: { item_type: "trust_badge" }, fields: [["title","Badge heading","text",true],["body","Badge description","textarea",true]] },
    response_promise: { label: "Response Promise", table: "conversion_items", fixed: { item_type: "response_promise" }, fields: [["title","Response-time message","textarea",true]] },
    gallery: { label: "Gallery", table: "gallery_items", media: true, fields: [["category","Category","select",true],["image_url","Image URL","url",true],["alt_text","Alt text","text",true],["caption","Caption","textarea",false],["featured","Featured image","checkbox",false]] },
    gallery_category: { label: "Gallery Categories", table: "gallery_categories", fields: [["name","Category name","text",true]] },
    faq: { label: "FAQ", table: "faq_items", fields: [["category","Category","text",true],["question","Question","text",true],["answer","Answer","textarea",true]] },
    event_type: { label: "Event Types", table: "event_types", media: true, fields: [["slug","URL slug","text",true],["title","Heading","text",true],["description","Description","textarea",true],["hero_image_url","Hero image URL","url",false],["hero_alt_text","Hero image alt text","text",false],["cta_text","Button text","text",true],["cta_url","Button link","text",true],["seo_title","SEO title","text",true],["seo_description","SEO description","textarea",true]] }
  };
  const galleryCategories = ["Corporate","Weddings","Schools","Parties","Pizza","Pasta","Desserts"];
  const state = { type: "testimonial", rows: [], editingId: "", galleryCategories: [...galleryCategories] };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[character]));
  }
  function message(text, error = false) {
    const node = document.getElementById("conversionManagerMessage");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("error", error);
  }
  function fieldMarkup(field, row = {}) {
    const [key, label, type, required] = field;
    const value = row[key] ?? "";
    if (type === "textarea") return `<label>${esc(label)}${required ? " *" : ""}<textarea data-conversion-field="${key}" ${required ? "required" : ""}>${esc(value)}</textarea></label>`;
    if (type === "select") return `<label>${esc(label)} *<select data-conversion-field="${key}" required>${state.galleryCategories.map((category) => `<option ${category === value ? "selected" : ""}>${esc(category)}</option>`).join("")}</select></label>`;
    if (type === "checkbox") return `<label class="conversion-check"><input data-conversion-field="${key}" type="checkbox" ${value ? "checked" : ""}> ${esc(label)}</label>`;
    return `<label>${esc(label)}${required ? " *" : ""}<input data-conversion-field="${key}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></label>`;
  }
  function renderForm() {
    const definition = definitions[state.type];
    const row = state.rows.find((item) => item.id === state.editingId) || {};
    const host = document.getElementById("conversionEditor");
    host.innerHTML = `<form id="conversionItemForm" class="conversion-admin-form">
      <h3>${state.editingId ? "Edit" : "Add"} ${esc(definition.label)}</h3>
      ${definition.fields.map((field) => fieldMarkup(field, row)).join("")}
      ${definition.media ? '<label>Upload image<input data-conversion-upload type="file" accept="image/jpeg,image/png,image/webp"></label>' : ""}
      <label>Status<select data-conversion-status><option value="draft" ${row.status !== "published" ? "selected" : ""}>Draft</option><option value="published" ${row.status === "published" ? "selected" : ""}>Published</option></select></label>
      <div class="conversion-admin-actions"><button class="save-button" type="submit">${state.editingId ? "Save Changes" : "Add Item"}</button><button class="preview-button" type="button" data-conversion-preview>Preview</button>${state.editingId ? '<button class="preview-button" type="button" data-conversion-cancel>Cancel</button>' : ""}</div>
      <div class="conversion-admin-preview" data-conversion-preview-host hidden></div>
    </form>`;
    host.querySelector("form").addEventListener("submit", save);
    host.querySelector("[data-conversion-preview]").addEventListener("click", preview);
    host.querySelector("[data-conversion-cancel]")?.addEventListener("click", () => { state.editingId = ""; render(); });
  }
  function valuesFromForm(form) {
    const values = {};
    form.querySelectorAll("[data-conversion-field]").forEach((field) => {
      values[field.dataset.conversionField] = field.type === "checkbox" ? field.checked : field.value.trim();
    });
    values.status = form.querySelector("[data-conversion-status]").value;
    return { ...values, ...definitions[state.type].fixed };
  }
  function preview() {
    const form = document.getElementById("conversionItemForm");
    if (!form.reportValidity()) return;
    const values = valuesFromForm(form);
    const host = form.querySelector("[data-conversion-preview-host]");
    host.hidden = false;
    host.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = values.title || values.question || "Preview";
    const body = document.createElement("p");
    body.textContent = values.body || values.answer || values.description || values.caption || values.seo_description || "";
    host.append(title, body);
  }
  function validateUpload(file) {
    if (!file) return "";
    if (!["image/jpeg","image/png","image/webp"].includes(String(file.type || "").toLowerCase())) return "Choose a JPG, PNG, or WebP image.";
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 10 * 1024 * 1024) return "Choose an image smaller than 10 MB.";
    return "";
  }
  async function uploadIfNeeded(form, values) {
    const file = form.querySelector("[data-conversion-upload]")?.files?.[0];
    if (!file) return values;
    const validation = validateUpload(file);
    if (validation) throw new Error(validation);
    const imageField = state.type === "gallery" ? "image_url" : state.type === "event_type" ? "hero_image_url" : "media_url";
    const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `conversion/${state.type}/${crypto.randomUUID()}.${extension}`;
    const result = await globalScope.supabaseClient.storage.from("website-images").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (result.error) throw result.error;
    values[imageField] = globalScope.supabaseClient.storage.from("website-images").getPublicUrl(path).data.publicUrl;
    return values;
  }
  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    message("Saving…");
    try {
      const values = await uploadIfNeeded(form, valuesFromForm(form));
      values.sort_order = state.editingId ? state.rows.find((row) => row.id === state.editingId)?.sort_order || 0 : state.rows.length;
      const query = state.editingId
        ? globalScope.supabaseClient.from(definitions[state.type].table).update(values).eq("id", state.editingId).select()
        : globalScope.supabaseClient.from(definitions[state.type].table).insert(values).select();
      const result = await query;
      if (result.error || result.data?.length !== 1) throw result.error || new Error("The save was not confirmed.");
      state.editingId = "";
      message("Saved successfully.");
      await load();
    } catch (error) { message(`Save failed: ${error.message}`, true); }
  }
  async function remove(id) {
    if (!globalScope.confirm("Delete this item? This cannot be undone.")) return;
    const result = await globalScope.supabaseClient.from(definitions[state.type].table).delete().eq("id", id).select("id");
    if (result.error || result.data?.length !== 1) return message(`Delete failed: ${result.error?.message || "not confirmed"}`, true);
    message("Item deleted.");
    await load();
  }
  async function persistOrder() {
    const cards = [...document.querySelectorAll("[data-conversion-row]")];
    const results = await Promise.all(cards.map((card, index) =>
      globalScope.supabaseClient.from(definitions[state.type].table).update({ sort_order: index }).eq("id", card.dataset.conversionRow).select("id")
    ));
    if (results.some((result) => result.error || result.data?.length !== 1)) message("Ordering could not be saved.", true);
    else { message("Order saved."); await load(); }
  }
  function renderList() {
    const host = document.getElementById("conversionItemList");
    host.replaceChildren();
    state.rows.forEach((row) => {
      const card = document.createElement("article");
      card.className = "conversion-admin-row";
      card.draggable = true;
      card.dataset.conversionRow = row.id;
      const title = row.title || row.question || row.slug;
      card.innerHTML = `<span class="conversion-drag" aria-label="Drag to reorder">⋮⋮</span><div><strong>${esc(title)}</strong><small>${esc(row.status)} · order ${Number(row.sort_order) + 1}</small></div><div><button type="button" data-edit="${row.id}">Edit</button><button type="button" data-delete="${row.id}">Delete</button></div>`;
      card.addEventListener("dragstart", () => card.classList.add("dragging"));
      card.addEventListener("dragend", () => { card.classList.remove("dragging"); persistOrder(); });
      host.appendChild(card);
    });
    if (!state.rows.length) host.innerHTML = '<p class="empty-state">No items yet. Add the first one above.</p>';
    host.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => { state.editingId = button.dataset.edit; renderForm(); }));
    host.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => remove(button.dataset.delete)));
    host.addEventListener("dragover", (event) => {
      event.preventDefault();
      const dragging = host.querySelector(".dragging");
      const target = event.target.closest("[data-conversion-row]");
      if (dragging && target && target !== dragging) host.insertBefore(dragging, target);
    });
  }
  async function load() {
    const definition = definitions[state.type];
    message("Loading…");
    let query = globalScope.supabaseClient.from(definition.table).select("*").order("sort_order");
    if (definition.fixed?.item_type) query = query.eq("item_type", definition.fixed.item_type);
    const result = await query;
    if (result.error) { state.rows = []; message(`Load failed: ${result.error.message}`, true); }
    else { state.rows = result.data || []; message(""); }
    renderForm();
    renderList();
  }
  async function loadGalleryCategories() {
    const result = await globalScope.supabaseClient.from("gallery_categories").select("name").order("sort_order");
    if (!result.error && result.data?.length) state.galleryCategories = result.data.map((item) => item.name);
  }
  function render() { renderForm(); renderList(); }
  function initialize() {
    const tabs = document.getElementById("conversionManagerTabs");
    if (!tabs) return;
    Object.entries(definitions).forEach(([type, definition]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = definition.label;
      button.className = type === state.type ? "active" : "";
      button.addEventListener("click", () => {
        state.type = type; state.editingId = "";
        tabs.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === button));
        load();
      });
      tabs.appendChild(button);
    });
    loadGalleryCategories().finally(load);
  }

  const api = { definitions, galleryCategories, validateUpload, valuesFromForm, initialize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
  }
})(typeof window !== "undefined" ? window : globalThis);
