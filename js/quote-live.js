(function quoteLiveModule(globalScope) {
  "use strict";

  function calculateEstimate(form) {
    const guests = Math.max(15, Number(form.elements.guestCount.value || 15));
    const menu = form.querySelector('input[name="menu"]:checked');
    let total = guests * Number(menu?.dataset.price || 0);
    form.querySelectorAll('input[name="addons"]:checked').forEach(addon => {
      total += guests * Number(addon.dataset.flat || 0);
      total += Number(addon.dataset.once || 0);
    });
    return Math.round(total * 100) / 100;
  }

  function payload(form) {
    const data = new FormData(form);
    const addons = data.getAll("addons");
    return {
      source: "guided_quote", name: data.get("name"), company: data.get("company"),
      email: data.get("email"), phone: data.get("phone"),
      eventDate: data.get("eventDate") || null, eventTime: data.get("eventTime") || "",
      guests: Number(data.get("guestCount")), menu: data.get("menu"),
      eventType: data.get("eventType"), budget: calculateEstimate(form),
      address: data.get("eventAddress") || "",
      notes: [`Add-ons: ${addons.join(", ") || "None"}`, data.get("notes") || ""].filter(Boolean).join("\n"),
      marketingConsent: data.get("marketingOptIn") === "yes",
      website: data.get("website") || "",
      attribution: globalScope.Project318Attribution?.snapshot?.() || {}
    };
  }

  async function handleSubmit(event) {
    const form = event.currentTarget;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    const service = globalScope.Project318LeadSubmission;
    const submitButton = document.getElementById("submitQuote");
    const status = service.statusElement(form);
    submitButton.disabled = true;
    status.classList.remove("error");
    status.textContent = "Securely submitting your request…";
    try {
      const result = await service.submit(payload(form), { idempotencyKey: service.idempotencyKey(form) });
      service.complete(form);
      form.dataset.savedQuoteId = String(result.leadId);
      globalScope.Project318Analytics?.track?.("quote_submitted", {
        form_id: form.id || "quote_builder", submission_source: "guided_quote"
      }, { onceKey: `quote_submitted:${result.leadId}` });
      form.hidden = true;
      document.querySelector(".progress-wrap")?.setAttribute("hidden", "");
      const success = document.getElementById("builderSuccess");
      if (success) {
        success.hidden = false;
        const text = success.querySelector("p");
        if (text) text.textContent = result.message;
      }
      globalScope.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message || "Your request was not saved. Please try again or call 318 Food Co.";
      submitButton.disabled = false;
    }
  }

  function initialize() {
    const form = document.getElementById("quoteBuilder");
    if (!form || form.dataset.liveSubmissionReady === "true") return;
    form.dataset.liveSubmissionReady = "true";
    form.addEventListener("submit", handleSubmit, true);
  }

  const api = { calculateEstimate, payload, handleSubmit, initialize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (globalScope.document.readyState === "loading") globalScope.document.addEventListener("DOMContentLoaded", initialize);
    else initialize();
  }
})(typeof window !== "undefined" ? window : globalThis);
