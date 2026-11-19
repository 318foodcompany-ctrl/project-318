(function adminGoogleAnalyticsModule(globalScope) {
  "use strict";

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function percent(value, total) { return total ? `${((number(value) / number(total)) * 100).toFixed(1)}%` : "0.0%"; }
  function change(current, previous) { return previous ? `${current >= previous ? "+" : ""}${(((current - previous) / previous) * 100).toFixed(1)}%` : current ? "New" : "—"; }

  function nextMove(report) {
    const source = (report.acquisition || []).find(row => number(row.sessions) > 0);
    const submits = (report.events || []).find(row => row.eventName === "quote_submitted");
    if (!source) return "There are no reported sessions by source yet. Share a tagged catering link and check back after visitors have used it.";
    const evidence = source.sessionSourceMedium + " brought " + number(source.sessions) + " sessions in the last 30 complete days.";
    if (!submits) return evidence + " The returned event list does not show a completed quote. Check quote tracking and the sales pipeline before increasing ad spend.";
    return evidence + " Google recorded " + number(submits.eventCount) + " completed quote events across all sources. Compare source-level bookings and recorded costs in the sales report before changing your budget.";
  }

  function create(win) {
    const doc = win.document;
    const panel = doc?.getElementById("marketingPanel");
    if (!doc || !panel || doc.getElementById("googleAnalyticsDashboard")) return;
    const section = doc.createElement("section");
    section.id = "googleAnalyticsDashboard";
    section.innerHTML = `<div class="marketing-section-heading"><div><h3>Website Analytics</h3><p>Last 30 complete days, through yesterday. Visitors are counted by Google Analytics after consent.</p></div><button id="googleAnalyticsRefresh" type="button">Refresh analytics</button></div><div id="googleAnalyticsContent" class="card"><div class="marketing-empty">Loading Google Analytics…</div></div>`;
    const assistant = doc.getElementById("marketingAiAssistant");
    panel.insertBefore(section, assistant?.parentNode === panel ? assistant : panel.firstChild);
    const target = doc.getElementById("googleAnalyticsContent");

    async function sessionToken() {
      const result = await win.supabaseClient.auth.getSession();
      if (result.error || !result.data?.session?.access_token) throw result.error || new Error("Administrator session expired.");
      return result.data.session.access_token;
    }

    function render(report) {
      if (!report.configured) {
        target.innerHTML = `<div class="marketing-empty"><strong>Google Analytics connection is ready for credentials.</strong><br>Property ${escapeHtml(report.propertyId || "546356197")} will appear here after the secure Vercel variables are added.</div>`;
        return;
      }
      const current = report.summary?.find(row => row.dateRange === "current");
      const previous = report.summary?.find(row => row.dateRange === "previous");
      if (!current) {
        target.textContent = "Google returned no summary for the last 30 complete days. Refresh later to check again.";
        return;
      }
      const trend = key => previous ? change(number(current[key]), number(previous[key])) + " vs prior 30 days" : "Previous period unavailable";
      const sources = report.acquisition || [];
      const pages = report.landingPages || [];
      const events = report.events || [];
      const conversionEvents = events.filter(row => /quote|cta|phone|email|direction/i.test(row.eventName));
      target.innerHTML = `<div class="marketing-summary">
        <div class="marketing-metric"><span>Visitors</span><strong>${number(current.activeUsers)}</strong><small>${trend("activeUsers")}</small></div>
        <div class="marketing-metric"><span>Sessions</span><strong>${number(current.sessions)}</strong><small>${trend("sessions")}</small></div>
        <div class="marketing-metric"><span>Page views</span><strong>${number(current.screenPageViews)}</strong><small>${trend("screenPageViews")}</small></div>
        <div class="marketing-metric"><span>Engagement rate</span><strong>${percent(current.engagedSessions, current.sessions)}</strong><small>${number(current.engagedSessions)} engaged sessions</small></div>
        <div class="marketing-metric"><span>Key events</span><strong>${number(current.keyEvents)}</strong><small>Google-marked conversions</small></div>
      </div>
      <div class="card"><h4>Your next advertising decision</h4><p>${escapeHtml(nextMove(report))}</p></div>
      <div class="marketing-grid">
        <div><h4>Traffic sources</h4>${sources.length ? `<div class="quote-table-wrap"><table class="marketing-table"><thead><tr><th>Source</th><th>Campaign</th><th>Sessions</th><th>Engaged</th><th>Key events</th></tr></thead><tbody>${sources.slice(0, 10).map(row => `<tr><td>${escapeHtml(row.sessionSourceMedium || "Unattributed")}</td><td>${escapeHtml(row.sessionCampaignName || "—")}</td><td>${number(row.sessions)}</td><td>${number(row.engagedSessions)}</td><td>${number(row.keyEvents)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="marketing-empty">No acquisition data yet.</div>'}</div>
        <div><h4>Top landing pages</h4>${pages.length ? `<div class="quote-table-wrap"><table class="marketing-table"><thead><tr><th>Page</th><th>Sessions</th><th>Views</th><th>Key events</th></tr></thead><tbody>${pages.slice(0, 10).map(row => `<tr><td>${escapeHtml(row.landingPage || "/")}</td><td>${number(row.sessions)}</td><td>${number(row.screenPageViews)}</td><td>${number(row.keyEvents)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="marketing-empty">No landing-page data yet.</div>'}</div>
      </div>
      <h4>Tracked customer actions</h4><div class="marketing-source-list">${conversionEvents.length ? conversionEvents.map(row => `<div class="marketing-source-item"><span>${escapeHtml(row.eventName)}</span><strong>${number(row.eventCount)}</strong></div>`).join("") : '<div class="marketing-empty">Customer actions will appear as visitors interact with the site.</div>'}</div>
      <p class="marketing-note">Updated ${new Date(report.generatedAt).toLocaleString()} · GA4 property ${escapeHtml(report.propertyId)}</p>`;
      win.Project318GoogleAnalyticsReport = report;
    }

    let requestNumber = 0;
    async function load() {
      const request = ++requestNumber;
      win.Project318GoogleAnalyticsReport = null;
      target.innerHTML = '<div class="marketing-empty">Loading Google Analytics…</div>';
      try {
        const response = await win.fetch("/api/admin-marketing-analytics", { headers: { Authorization: `Bearer ${await sessionToken()}` } });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
        if (request === requestNumber) render(payload.report || {});
      } catch (error) {
        if (request !== requestNumber) return;
        target.innerHTML = `<div class="marketing-empty"><strong>Google Analytics could not be loaded.</strong><br>${escapeHtml(error.message)}</div>`;
      }
    }
    doc.getElementById("googleAnalyticsRefresh").addEventListener("click", load);
    load();
  }

  const api = { escapeHtml, number, percent, change, nextMove, create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope?.document) {
    if (globalScope.document.readyState === "loading") globalScope.document.addEventListener("DOMContentLoaded", () => create(globalScope));
    else create(globalScope);
  }
})(typeof window !== "undefined" ? window : globalThis);
