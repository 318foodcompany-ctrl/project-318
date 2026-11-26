(function (scope) {
  "use strict";
  const packageGroups = {
    taco: ["Taco Bar"], fajita: ["Fajita Bar — Chicken", "Fajita Bar — Steak", "Fajita Bar — Chicken & Steak Combo"],
    bbq: ["BBQ Bar"], deli: ["Deli Buffet"], pasta: ["Pasta Bar"], pizza: ["Pizza & Salad"]
  };
  const dollars = cents => (cents / 100).toLocaleString("en-US",{style:"currency",currency:"USD"});
  let pending;
  function published(refresh = false) {
    if (!pending || refresh) {
      pending = Promise.resolve().then(async () => {
        if (!scope.supabaseClient) throw new Error("Pricing is unavailable. Please try again or call 318 Food Co.");
        const {data,error} = await scope.supabaseClient.rpc("catering_current_pricing");
        if (error || !data?.revision || !data.card?.packages) throw new Error("Pricing is unavailable. Please try again or call 318 Food Co.");
        return data;
      }).catch(error => { pending = null; throw error; });
    }
    return pending;
  }
  function startingPrice(card, slug) {
    const names = packageGroups[slug];
    if (!Array.isArray(names) || !card) return null;
    return Math.min(...names.map(name => card.packages[name]));
  }
  function applyToForm(form, pricing) {
    const {card, revision} = pricing;
    form.elements.guestCount.min = card.minimum;
    form.querySelector("[data-guest-minimum]").textContent = "Our catering minimum is " + card.minimum + " people.";
    for (const input of form.querySelectorAll('input[name="menu"],input[name="addons"]')) {
      const isMenu = input.name === "menu";
      const isFlat = Object.hasOwn(card.perOrder,input.value);
      const rates = isMenu ? card.packages : isFlat ? card.perOrder : card.perGuest;
      if (!Object.hasOwn(rates,input.value)) throw new Error("This planner has changed. Reload the page.");
      const cents = rates[input.value];
      input.dataset[isMenu ? "price" : isFlat ? "once" : "flat"] = String(cents / 100);
      input.closest("label").querySelector("small").textContent = dollars(cents) + (isFlat ? " per order" : " per person");
    }
    form.dataset.pricingRevision = revision;
  }
  scope.Project318Pricing = {published,packageGroups,startingPrice,dollars,applyToForm};
  const minimumLabels = scope.document?.querySelectorAll("[data-current-minimum]");
  if (minimumLabels?.length) published().then(({card}) => {
    for (const label of minimumLabels) label.textContent = card.minimum + "-person minimum";
  }).catch(() => { /* The link to the planner remains available. */ });
  if (typeof module !== "undefined" && module.exports) module.exports = scope.Project318Pricing;
})(typeof window === "undefined" ? globalThis : window);
