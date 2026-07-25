(function conversionUxModule(globalScope) {
  "use strict";
  const DISMISS_KEY = "p318_exit_reminder_dismissed";

  function showReminder() {
    const reminder = document.querySelector("[data-exit-reminder]");
    if (!reminder || reminder.dataset.shown === "true") return;
    reminder.dataset.shown = "true";
    reminder.hidden = false;
    reminder.querySelector("a,button")?.focus({ preventScroll: true });
  }

  function initializeExitReminder(storage = globalScope.sessionStorage) {
    const reminder = document.querySelector("[data-exit-reminder]");
    if (!reminder) return;
    try { if (storage.getItem(DISMISS_KEY)) return; } catch (_error) {}
    document.addEventListener("mouseout", (event) => {
      if (event.clientY <= 0 && !event.relatedTarget) showReminder();
    }, { once: true });
    reminder.querySelector("[data-exit-close]")?.addEventListener("click", () => {
      reminder.hidden = true;
      try { storage.setItem(DISMISS_KEY, "true"); } catch (_error) {}
    });
  }

  const api = { DISMISS_KEY, showReminder, initializeExitReminder };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope.document) {
    const run = () => initializeExitReminder();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
  }
})(typeof window !== "undefined" ? window : globalThis);
