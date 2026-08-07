(function contactLiveModule(globalScope) {
  "use strict";

  function currencyValue(text) {
    const value = Number(String(text || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  function payload(form) {
    const data = new FormData(form);
    return {
      source: "contact_form", name: data.get("Name"), company: data.get("Company"),
      email: data.get("Email"), phone: data.get("Phone"),
      eventDate: data.get("Event Date") || null, eventTime: data.get("Event Time") || "",
      guests: Number(data.get("Guest Count")), menu: data.get("Menu"),
      eventType: data.get("Service Style") || "Catering inquiry",
      budget: currencyValue(document.getElementById("estimateTotal")?.textContent),
      address: data.get("Event Address") || "",
      notes: [`Add-on estimate: ${data.get("Add-On Estimate") || "0"}`, data.get("Details") || ""].filter(Boolean).join("\n"),
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
      status.classList.add("error");
      status.textContent = error.message || "Your request was not saved. Please try again or call 318 Food Co.";
      button.disabled = false;
    }
  }

  function initialize() {
    const form = document.getElementById("quoteForm");
    if (!form || form.dataset.liveSubmissionReady === "true") return;
    form.dataset.liveSubmissionReady = "true";
    form.addEventListener("submit", handleSubmit, true);
  }

  const api = { currencyValue, payload, handleSubmit, initialize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    if (globalScope.document.readyState === "loading") globalScope.document.addEventListener("DOMContentLoaded", initialize);
    else initialize();
  }
})(typeof window !== "undefined" ? window : globalThis);
