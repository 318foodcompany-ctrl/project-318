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

const menuDetails = {
  taco: [
    ["Proteins", ["Seasoned chicken", "Ground beef"]],
    ["Sides", ["Mexican rice", "Refried beans"]],
    ["Toppings", ["Lettuce, tomato and cheese", "Sour cream and salsa"]],
    ["Dessert", ["Cookies or brownies"]]
  ],
  fajita: [
    ["Proteins", ["Chicken fajitas", "Steak fajitas"]],
    ["Sides", ["Mexican rice", "Charro beans"]],
    ["Extras", ["Flour tortillas", "Chips and queso"]],
    ["Dessert", ["Cookies or brownies"]]
  ],
  bbq: [
    ["Entrées", ["Pulled pork", "Smoked sausage"]],
    ["Sides", ["Baked beans", "Potato salad"]],
    ["Dessert", ["Cookies or brownies"]]
  ],
  deli: [
    ["Premium Meats", ["Smoked turkey", "Black Forest ham", "Roast beef"]],
    ["Cheeses", ["American", "Provolone", "Swiss"]],
    ["Fresh Toppings", ["Lettuce, tomatoes and pickles", "Red onion, mayo and mustard"]],
    ["Sides & Dessert", ["Assorted chips", "Pasta salad", "Cookies or brownies"]]
  ],
  pasta: [
    ["Entrées", ["Chicken Alfredo", "Baked ziti"]],
    ["Sides", ["Caesar salad", "Garlic bread"]],
    ["Dessert", ["Cookies or brownies"]]
  ],
  pizza: [
    ["Pizza Selection", ["Pepperoni", "Meat lovers", "Supreme"]],
    ["Sides", ["Caesar salad", "Pasta salad"]],
    ["Dessert", ["Cookies or brownies"]]
  ]
};

function detailsHtml(slug) {
  return (menuDetails[slug] || [])
    .map(([heading, items]) => `
      <div>
        <h3>${escapeHtml(heading)}</h3>
        <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    `)
    .join("");
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
      const fallbackImage = `assets/images/${encodeURIComponent(item.slug)}-professional.jpg`;
      const buttonText = item.button_text || `Request ${item.name}`;

      return `
        <section class="catering-package${index % 2 ? " alt-package" : ""}" id="${slug}">
          <div class="wrap package-grid">
            <div class="package-photo">
              <img
                data-photo-image="${escapeHtml(imageFile)}"
                src="${menuImageUrl(imageFile)}"
                alt="${escapeHtml(item.name)} catering package"
                loading="lazy"
                onerror="this.onerror=null;this.src='${fallbackImage}'"
              >
            </div>

            <div class="package-copy">
              <span class="menu-number">${String(index + 1).padStart(2, "0")}</span>
              <p class="kicker">${escapeHtml(item.subtitle)}</p>
              <h2>${escapeHtml(item.name)}</h2>
              <p class="package-price">Starting at <strong>${escapeHtml(item.price)}</strong></p>
              <div class="package-details">
                ${detailsHtml(item.slug)}
              </div>
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
