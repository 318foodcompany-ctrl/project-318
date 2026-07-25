(function quoteBuilderUi(globalScope) {
  "use strict";
  const form = document.getElementById("quoteBuilder");
  if (!form) return;
  const money = value => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const estimate = () => globalScope.Project318QuoteLive?.calculateEstimate(form) || 0;
  let step = 1;
  const steps = [...document.querySelectorAll(".builder-step")];
  const totalSteps = steps.length;
  const next = document.getElementById("nextStep");
  const previous = document.getElementById("prevStep");
  const submit = document.getElementById("submitQuote");

  function review() {
    const data = new FormData(form);
    const addons = data.getAll("addons").join(", ") || "None";
    document.getElementById("reviewCard").innerHTML = [
      ["Event", data.get("eventType")],
      ["Guests", data.get("guestCount")],
      ["Menu", data.get("menu")],
      ["Add-ons", addons],
      ["Date & time", `${data.get("eventDate") || ""} ${data.get("eventTime") || ""}`],
      ["Contact", `${data.get("name") || ""} · ${data.get("phone") || ""}`],
      ["Planning estimate", money(estimate())]
    ].map(([label, value], index) =>
      `<div class="review-row${index === 6 ? " review-total" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    ).join("");
  }
  function valid() {
    const active = steps[step - 1];
    for (const control of active.querySelectorAll("[required]")) {
      if (control.type === "radio") {
        if (!active.querySelector(`input[name="${control.name}"]:checked`)) return false;
      } else if (!control.value) {
        control.focus();
        return false;
      }
    }
    return true;
  }
  function show() {
    steps.forEach(item => item.classList.toggle("active", Number(item.dataset.step) === step));
    document.getElementById("stepLabel").textContent = `Step ${step} of ${totalSteps}`;
    const percent = Math.round(step / totalSteps * 100);
    document.getElementById("progressPercent").textContent = `${percent}%`;
    document.getElementById("progressBar").style.width = `${percent}%`;
    previous.hidden = step === 1;
    next.hidden = step === totalSteps;
    submit.hidden = step !== totalSteps;
    if (step === totalSteps) review();
  }
  next.addEventListener("click", () => { if (valid() && step < totalSteps) { step += 1; show(); } });
  previous.addEventListener("click", () => { if (step > 1) { step -= 1; show(); } });
  document.getElementById("minusGuest").addEventListener("click", () => {
    const input = document.getElementById("guestCount");
    input.value = Math.max(15, Number(input.value) - 5);
  });
  document.getElementById("plusGuest").addEventListener("click", () => {
    const input = document.getElementById("guestCount");
    input.value = Number(input.value) + 5;
  });
  document.querySelectorAll("[data-count]").forEach(button => button.addEventListener("click", () => {
    document.getElementById("guestCount").value = button.dataset.count;
  }));
  show();
})(typeof window !== "undefined" ? window : globalThis);
