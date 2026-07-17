const menuContainer = document.querySelector("[data-menu-container]");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeLink(value = "") {
  const link = String(value).trim();
  return /^(?:[a-z0-9./_-]+\.html(?:#[a-z0-9_-]+)?|#[a-z0-9_-]+)$/i.test(link)
    ? link
    : "contact.html#quote";
}

function menuImageUrl(fileName) {
  return `${SUPABASE_URL}/storage/v1/object/public/website-images/${encodeURIComponent(fileName)}?v=${Date.now()}`;
}

async function loadMenuItems() {
  if (!menuContainer) return;

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("Menu load failed:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.warn("No active catering menu items were found.");
    return;
  }

  menuContainer.innerHTML = data
    .map((item, index) => {
      const slug = escapeHtml(item.slug);
      const imageFile = item.image_file || `menu-${item.slug}.jpg`;
      const buttonText = item.button_text || `Request ${item.name}`;

      return `
        <section class="catering-package${index % 2 ? " alt-package" : ""}" id="${slug}">
          <div class="wrap package-grid">
            <div class="package-photo">
              <img
                src="${menuImageUrl(imageFile)}"
                alt="${escapeHtml(item.name)} catering package"
                loading="lazy"
              >
            </div>

            <div class="package-copy">
              <span class="menu-number">${String(index + 1).padStart(2, "0")}</span>
              <p class="kicker">${escapeHtml(item.subtitle)}</p>
              <h2>${escapeHtml(item.name)}</h2>
              <p class="package-price">${escapeHtml(item.price)}</p>
              <a class="btn" href="${safeLink(item.button_link)}">
                ${escapeHtml(buttonText)}
              </a>
            </div>
          </div>
        </section>
      `;
    })
    .join("");
}

loadMenuItems();
