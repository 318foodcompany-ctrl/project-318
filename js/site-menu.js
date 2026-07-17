async function loadMenuItems() {
  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error("Menu load failed:", error);
    return;
  }

  console.log("Menu items:", data);
}

loadMenuItems();