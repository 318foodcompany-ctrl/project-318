(function contactLiveModule(globalScope) {
  "use strict";

  function currencyValue(text) {
    const value = Number(String(text || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  async function refreshEstimate(form) {
    const menu = document.getElementById("menuChoice");
    const guests = document.getElementById("guests");
    const extras = document.getElementById("extras");
    const total = document.getElementById("estimateTotal");
    const summary = document.getElementById("estimateSummary");
    form.dataset.loadingRates = "true";
    delete form.dataset.pricingRevision;
    delete form.dataset.estimate;
    form.oninput = null;
    form.onreset = null;
    try {
      const {revision,card} = await globalScope.Project318Pricing.published(true);
      const previous = menu.value;
      const names = Object.values(globalScope.Project318Pricing.packageGroups).flat();
      menu.replaceChildren(...names.map(name => new Option(name,name)));
      if (names.includes(previous)) menu.value = previous;
      guests.min = card.minimum;
      form.dataset.pricingRevision = revision;
      for (const option of extras.options) {
        if (option.value) option.textContent = option.value + " (" + globalScope.Project318Pricing.dollars(card.perGuest[option.value]) + " per guest)";
      }
      function update() {
        delete form.dataset.estimate;
        if (!guests.checkValidity() || !guests.value) {
          total.textContent = "Enter your guest count";
          summary.textContent = "Catering starts at " + card.minimum + " guests.";
          return;
        }
        const rate = card.packages[menu.value] + (card.perGuest[extras.value] || 0);
        const cents = Number(guests.value) * rate;
        total.textContent = globalScope.Project318Pricing.dollars(cents);
        summary.textContent = guests.value + " guests at " + globalScope.Project318Pricing.dollars(rate) + " per guest.";
        form.dataset.estimate = String(cents / 100);
      }
      form.oninput = update;
      form.onreset = () => setTimeout(update,0);
      update();
    } catch (error) {
      total.textContent = "Estimate unavailable";
      summary.textContent = "You can still send an inquiry and ask the team to confirm pricing.";
      guests.min = 1;
      for (const option of extras.options) if (option.value) option.textContent = option.value;
    } finally {
      delete form.dataset.loadingRates;
    }
  }

  function payload(form) {
    const data = new FormData(form);
    return {
      source: "contact_form", name: data.get("Name"), company: data.get("Company"),
      email: data.get("Email"), phone: data.get("Phone"),
      eventDate: data.get("Event Date") || null, eventTime: data.get("Event Time") || "",
      guests: Number(data.get("Guest Count")), menu: data.get("Menu"),
      eventType: data.get("Service Style") || "Catering inquiry",
      budget: form.dataset.estimate === undefined ? null : Number(form.dataset.estimate),
      ...(form.dataset.pricingRevision ? {pricingRevision:Number(form.dataset.pricingRevision), addons:data.get("Add-On Estimate") ? [data.get("Add-On Estimate")] : []} : {}),
      address: data.get("Event Address") || "",
      notes: [`Add-on estimate: ${data.get("Add-On Estimate") || "None"}`, data.get("Details") || ""].filter(Boolean).join("\n"),
      marketingConsent: data.get("marketingOptIn") === "yes",
      website: data.get("website") || "",
      attribution: globalScope.Project318Attribution?.snapshot?.() || {}
    };
  }

  async function handleSubmit(event) {
    const form = event.currentTarget;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (form.dataset.loadingRates || form.dataset.submitting || !form.reportValidity()) return;
    form.dataset.submitting = "true";
    const service = globalScope.Project318LeadSubmission;
    const button = form.querySelector('button[type="submit"]');
    const status = service.statusElement(form);
    button.disabled = true;
    status.classList.remove("error", "success");
    status.textContent = "Securely submitting your request…";
    try {
      const result = await service.submit(payload(form), { idempotencyKey: service.idempotencyKey(form) });
      service.complete(form);
      form.reset();
      status.textContent = result.message;
      status.classList.add("success");
      button.disabled = false;
      globalScope.Project318Analytics?.track?.("quote_submitted", {
        form_id: form.id || "contact_form", submission_source: "contact_form"
      }, { onceKey: `quote_submitted:${result.leadId}` });
    } catch (error) {
      if (error.code === "QUOTE_PRICING_CHANGED") await refreshEstimate(form);
      status.classList.add("error");
      status.textContent = error.message || "Your request was not saved. Please try again or call 318 Food Co.";
      button.disabled = false;
    } finally {
      delete form.dataset.submitting;
    }
  }

  function initialize() {
    const form = document.getElementById("quoteForm");
    if (!form || form.dataset.liveSubmissionReady === "true") return;
    form.dataset.liveSubmissionReady = "true";
    form.addEventListener("submit", handleSubmit, true);
    refreshEstimate(form);
  }

  const api = { currencyValue, payload, handleSubmit, initialize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (globalScope.document.readyState === "loading") globalScope.document.addEventListener("DOMContentLoaded", initialize);
    else initialize();
  }
})(typeof window !== "undefined" ? window : globalThis);
