(function leadSubmissionModule(globalScope) {
  "use strict";

  function createId(cryptoObject = globalScope.crypto) {
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") return cryptoObject.randomUUID();
    const values = new Uint8Array(16);
    if (cryptoObject && typeof cryptoObject.getRandomValues === "function") cryptoObject.getRandomValues(values);
    else for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 256);
    values[6] = (values[6] & 15) | 64;
    values[8] = (values[8] & 63) | 128;
    const hex = [...values].map(value => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function idempotencyKey(form, storage = globalScope.sessionStorage) {
    const key = `p318_lead_submission_${form.id || "form"}`;
    try {
      const saved = storage.getItem(key);
      if (saved) return saved;
      const created = createId();
      storage.setItem(key, created);
      return created;
    } catch (_error) {
      return createId();
    }
  }

  function complete(form, storage = globalScope.sessionStorage) {
    const key = `p318_lead_submission_${form.id || "form"}`;
    try {
      storage.removeItem(key);
    } catch (_error) {
      // A completed request remains valid even when browser storage is unavailable.
    }
  }

  async function submit(payload, options = {}) {
    const fetchImpl = options.fetchImpl || globalScope.fetch;
    if (typeof fetchImpl !== "function") throw new Error("Submission service is unavailable.");
    const response = await fetchImpl("/api/lead-submit-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": options.idempotencyKey },
      body: JSON.stringify({ ...payload, idempotencyKey: options.idempotencyKey })
    });
    const result = await response.json().catch(() => ({
      ok: false, code: "INVALID_SERVER_RESPONSE",
      message: "The server returned an invalid response. Please call 318 Food Co."
    }));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || "Your request could not be submitted.");
      error.code = result.code || "LEAD_SUBMISSION_FAILED";
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function statusElement(form) {
    let element = form.querySelector("[data-lead-submit-status]");
    if (!element) {
      element = form.ownerDocument.createElement("p");
      element.dataset.leadSubmitStatus = "";
      element.className = "quote-submit-message";
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
      form.appendChild(element);
    }
    return element;
  }

  const api = { createId, idempotencyKey, complete, submit, statusElement };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.Project318LeadSubmission = api;
})(typeof window !== "undefined" ? window : globalThis);
