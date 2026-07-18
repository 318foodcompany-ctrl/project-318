(function initializeSupabaseClient() {
  const config = window.__APP_CONFIG__;
  const configError = window.__APP_CONFIG_ERROR__;
  const validUrl =
    config &&
    /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(config.supabaseUrl || "");
  const validAnonKey =
    config &&
    typeof config.supabaseAnonKey === "string" &&
    config.supabaseAnonKey.trim().length > 0;

  function showConfigurationError(message) {
    window.supabaseClient = null;
    window.supabaseConfigError = message;
    console.error(message);

    const render = () => {
      if (document.getElementById("appConfigurationError")) return;

      const alert = document.createElement("div");
      alert.id = "appConfigurationError";
      alert.setAttribute("role", "alert");
      alert.style.cssText =
        "position:relative;z-index:10000;padding:14px 20px;background:#7f1d1d;color:#fff;text-align:center;font:700 15px/1.4 Arial,sans-serif";
      alert.textContent = message;
      document.body.prepend(alert);
    };

    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
  }

  if (configError || !validUrl || !validAnonKey) {
    showConfigurationError(
      configError ||
        "Website configuration is missing or invalid. Please contact 318 Food Co."
    );
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    showConfigurationError(
      "Website services could not be loaded. Please refresh and try again."
    );
    return;
  }

  const supabaseClient = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );

  // Preserve the public URL global used by the existing image loaders while
  // sourcing it from the deployment-specific runtime configuration.
  window.SUPABASE_URL = config.supabaseUrl;
  window.supabaseClient = supabaseClient;
  window.supabaseConfigError = null;

  const canLoadAdminDashboard =
    typeof document !== "undefined" &&
    window.location &&
    /\/admin\.html$/i.test(window.location.pathname || "") &&
    !document.querySelector('script[data-admin-marketing]');

  if (canLoadAdminDashboard) {
    const script = document.createElement("script");
    script.src = "js/admin-marketing.js";
    script.defer = true;
    script.dataset.adminMarketing = "";
    document.head.appendChild(script);
  }
})();