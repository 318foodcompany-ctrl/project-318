(function launchReadinessModule(globalScope) {
  "use strict";

  const EXPECTED_ORIGIN = "https://www.318foodco.com";
  const PAGES = ["/", "/catering.html", "/corporate.html", "/about.html", "/gallery.html", "/contact.html", "/quote-builder.html"];
  const PHONE_DIGITS = "3185720137";
  const EMAIL = "318foodcompany@gmail.com";

  function validGa4(value) { return /^G-[A-Z0-9]{6,20}$/.test(String(value || "").toUpperCase()); }
  function validMeta(value) { return /^\d{5,20}$/.test(String(value || "")); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function result(id, label, status, detail, action = "") { return { id, label, status, detail, action }; }
  function summarizeChecks(checks) {
    return (checks || []).reduce((summary, check) => {
      summary.total += 1;
      summary[check.status] += 1;
      return summary;
    }, { total: 0, ready: 0, warning: 0, blocked: 0 });
  }
  function score(summary) { return summary.total ? Math.round((summary.ready / summary.total) * 100) : 0; }
  function statusLabel(status) { return status === "ready" ? "Ready" : status === "warning" ? "Needs attention" : "Blocked"; }
  function normalizedText(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9@]/g, ""); }

  async function fetchDocument(win, path) {
    const response = await win.fetch(path, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return { text, document: new win.DOMParser().parseFromString(text, "text/html") };
  }

  async function runChecks(win) {
    const config = win.__APP_CONFIG__ || {};
    const checks = [
      config.supabaseUrl && config.supabaseAnonKey
        ? result("runtime", "Runtime configuration", "ready", "Supabase public configuration is present.")
        : result("runtime", "Runtime configuration", "blocked", "Supabase public configuration is missing."),
      win.supabaseClient
        ? result("client", "Supabase connection", "ready", "The browser client initialized.")
        : result("client", "Supabase connection", "blocked", "The browser client did not initialize."),
      validGa4(config.ga4MeasurementId)
        ? result("ga4", "Google Analytics 4", "ready", `${config.ga4MeasurementId} is configured.`)
        : result("ga4", "Google Analytics 4", "warning", "No valid GA4 Measurement ID is configured.", "Add PUBLIC_GA4_MEASUREMENT_ID in Vercel."),
      validMeta(config.metaPixelId)
        ? result("meta", "Meta Pixel", "ready", `${config.metaPixelId} is configured.`)
        : result("meta", "Meta Pixel", "warning", "No valid Meta Pixel ID is configured.", "Add PUBLIC_META_PIXEL_ID in Vercel."),
      win.location.origin === EXPECTED_ORIGIN
        ? result("domain", "Canonical production domain", "ready", EXPECTED_ORIGIN)
        : result("domain", "Canonical production domain", "warning", `Opened at ${win.location.origin}; expected ${EXPECTED_ORIGIN}.`, "Confirm www.318foodco.com as the primary Vercel domain.")
    ];

    if (win.supabaseClient) {
      try {
        const { data, error } = await win.supabaseClient.auth.getSession();
        checks.push(!error && data?.session
          ? result("session", "Administrator session", "ready", "An authenticated administrator session is active.")
          : result("session", "Administrator session", "blocked", error?.message || "No administrator session was found."));
      } catch (error) {
        checks.push(result("session", "Administrator session", "blocked", error.message));
      }

      const today = new Date().toISOString().slice(0, 10);
      const reportingArgs = { p_start: today, p_end: today, p_model: "last_non_direct" };
      const reports = [
        ["marketing_revenue_attribution", "Revenue attribution migration"],
        ["marketing_quote_funnel", "Marketing funnel migration"],
        ["marketing_spend_summary", "Marketing spend migration"]
      ];
      const reportChecks = await Promise.all(reports.map(async ([rpc, label]) => {
        const { error } = await win.supabaseClient.rpc(rpc, reportingArgs);
        return error
          ? result(`rpc:${rpc}`, label, "blocked", error.message, "Apply the required marketing migration in Supabase.")
          : result(`rpc:${rpc}`, label, "ready", `${rpc} is available.`);
      }));
      checks.push(...reportChecks);
    }

    const pageResults = await Promise.all(PAGES.map(async path => {
      try {
        const { document } = await fetchDocument(win, path);
        const title = Boolean(document.title.trim());
        const description = Boolean(document.querySelector('meta[name="description"]')?.content.trim());
        const placeholderLinks = [...document.querySelectorAll('a[href="#"]')].filter(link => !link.hasAttribute("data-setting-social")).length;
        return title && description && !placeholderLinks
          ? result(`page:${path}`, `${path === "/" ? "Home" : path} page`, "ready", "Page loads with title, description, and no active placeholder links.")
          : result(`page:${path}`, `${path === "/" ? "Home" : path} page`, "warning", `${title ? "Title present" : "Title missing"}; ${description ? "description present" : "description missing"}; ${placeholderLinks} placeholder link(s).`, "Review the page before paid traffic.");
      } catch (error) {
        return result(`page:${path}`, `${path} page`, "blocked", error.message, "Check the production deployment.");
      }
    }));
    checks.push(...pageResults);

    const publicFiles = [["/sitemap.xml", "XML sitemap"], ["/robots.txt", "Robots directives"]];
    const publicFileChecks = await Promise.all(publicFiles.map(async ([path, label]) => {
      try {
        const response = await win.fetch(path, { cache: "no-store", credentials: "same-origin" });
        return response.ok
          ? result(`public:${path}`, label, "ready", `${path} is available.`)
          : result(`public:${path}`, label, "blocked", `HTTP ${response.status}`, "Check the production deployment.");
      } catch (error) {
        return result(`public:${path}`, label, "blocked", error.message, "Check the production deployment.");
      }
    }));
    checks.push(...publicFileChecks);

    try {
      const home = await fetchDocument(win, "/");
      const homeText = normalizedText(home.text);
      checks.push(homeText.includes(PHONE_DIGITS)
        ? result("phone", "Business phone", "ready", "(318) 572-0137 is present on the homepage.")
        : result("phone", "Business phone", "blocked", "The expected phone number was not found."));
      checks.push(homeText.includes(EMAIL)
        ? result("email", "Business email", "ready", "318FoodCompany@gmail.com is present on the homepage.")
        : result("email", "Business email", "blocked", "The expected email address was not found."));
    } catch (error) {
      checks.push(result("contact", "Business contact details", "blocked", error.message));
    }

    try {
      const planner = await fetchDocument(win, "/quote-builder.html");
      [["quote-draft.js", "Quote draft recovery"], ["quote-live.js", "Live quote submission"], ["marketing-attribution.js", "First-party attribution"]].forEach(([script, label]) => {
        checks.push(planner.text.includes(script)
          ? result(script, label, "ready", `${script} is loaded.`)
          : result(script, label, "blocked", `${script} is missing.`));
      });
    } catch (error) {
      checks.push(result("planner", "Event planner scripts", "blocked", error.message));
    }
    return checks;
  }

  function createDashboard(win) {
    const doc = win.document;
    if (!doc || doc.getElementById("launchReadinessPanel")) return;
    const stylesheet = doc.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "css/admin-launch-readiness.css";
    doc.head.appendChild(stylesheet);

    const navReference = doc.querySelector('[data-panel="marketingPanel"]') || doc.querySelector('[data-panel="leadsPanel"]');
    const nav = doc.createElement("button");
    nav.className = "nav-button";
    nav.dataset.panel = "launchReadinessPanel";
    nav.textContent = "Launch Readiness";
    navReference?.after(nav);

    const panel = doc.createElement("section");
    panel.id = "launchReadinessPanel";
    panel.className = "panel";
    panel.innerHTML = `<div class="panel-heading"><h2>Launch Readiness</h2><p>Automated production checks plus campaign-link preparation.</p></div>
      <div class="launch-toolbar card"><div><strong id="launchScore">Checking…</strong><span id="launchSummary">Running checks.</span></div><button id="launchRun" type="button">Run checks again</button></div>
      <div id="launchChecks" class="launch-check-grid" aria-live="polite"></div>
      <section class="card launch-campaign"><h3>Facebook campaign link</h3><div class="launch-campaign-grid"><label>Source<input data-utm="source" value="facebook"></label><label>Medium<input data-utm="medium" value="paid_social"></label><label>Campaign<input data-utm="campaign" value="catering_launch"></label><label>Ad name<input data-utm="content" placeholder="office_lunch_video"></label></div><code id="launchCampaignUrl"></code><button id="launchCopyUrl" class="save-button" type="button">Copy campaign link</button><p>GA4 and Meta IDs remain manual because they are account-specific. After adding them in Vercel, verify GA4 Realtime and Meta Test Events.</p></section>`;
    doc.querySelector(".content")?.appendChild(panel);

    const showPanel = () => win.showPanel ? win.showPanel(panel.id) : doc.querySelectorAll(".panel").forEach(item => item.classList.toggle("active", item === panel));
    nav.addEventListener("click", showPanel);

    const updateCampaign = () => {
      const params = new URLSearchParams();
      panel.querySelectorAll("[data-utm]").forEach(input => { if (input.value.trim()) params.set(`utm_${input.dataset.utm}`, input.value.trim()); });
      panel.querySelector("#launchCampaignUrl").textContent = `${EXPECTED_ORIGIN}/quote-builder.html?${params}`;
    };
    panel.querySelectorAll("[data-utm]").forEach(input => input.addEventListener("input", updateCampaign));
    panel.querySelector("#launchCopyUrl").addEventListener("click", async () => {
      await win.navigator.clipboard.writeText(panel.querySelector("#launchCampaignUrl").textContent);
      panel.querySelector("#launchCopyUrl").textContent = "Copied";
      win.setTimeout(() => { panel.querySelector("#launchCopyUrl").textContent = "Copy campaign link"; }, 1400);
    });
    updateCampaign();

    async function refresh() {
      const target = panel.querySelector("#launchChecks");
      const button = panel.querySelector("#launchRun");
      button.disabled = true;
      target.innerHTML = '<div class="card launch-loading">Running production checks…</div>';
      const checks = await runChecks(win);
      const summary = summarizeChecks(checks);
      panel.querySelector("#launchScore").textContent = `${score(summary)}% ready`;
      panel.querySelector("#launchSummary").textContent = `${summary.ready} ready, ${summary.warning} need attention, ${summary.blocked} blocked.`;
      target.innerHTML = checks.map(check => `<article class="card launch-check ${check.status}"><div class="launch-check-heading"><h3>${escapeHtml(check.label)}</h3><span>${statusLabel(check.status)}</span></div><p>${escapeHtml(check.detail)}</p>${check.action ? `<small>${escapeHtml(check.action)}</small>` : ""}</article>`).join("");
      button.disabled = false;
    }
    panel.querySelector("#launchRun").addEventListener("click", refresh);
    refresh();
  }

  const api = { validGa4, validMeta, summarizeChecks, score, statusLabel, result, normalizedText, runChecks, createDashboard };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope?.document) {
    if (globalScope.document.readyState === "loading") globalScope.document.addEventListener("DOMContentLoaded", () => createDashboard(globalScope));
    else createDashboard(globalScope);
  }
})(typeof window !== "undefined" ? window : globalThis);
