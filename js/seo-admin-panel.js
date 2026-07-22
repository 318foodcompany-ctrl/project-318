(function () {
  "use strict";

  const PUBLIC_PAGES = [
    { path: "/", label: "Home" },
    { path: "/about.html", label: "About" },
    { path: "/catering.html", label: "Catering" },
    { path: "/corporate.html", label: "Corporate Catering" },
    { path: "/gallery.html", label: "Gallery" },
    { path: "/contact.html", label: "Contact" },
    { path: "/quote-builder.html", label: "Quote Builder" }
  ];

  function scoreClass(score) {
    if (score >= 85) return "seo-score-good";
    if (score >= 65) return "seo-score-watch";
    return "seo-score-poor";
  }

  function createPanel() {
    const app = document.getElementById("adminApp");
    if (!app || !window.Project318SeoAudit || document.getElementById("seoAuditPanel")) return;

    const panel = document.createElement("section");
    panel.id = "seoAuditPanel";
    panel.className = "card";
    panel.setAttribute("aria-labelledby", "seoAuditHeading");
    panel.innerHTML = `
      <div class="seo-audit-header">
        <div>
          <h2 id="seoAuditHeading">SEO Health</h2>
          <p>Review page scores and prioritized fixes before publishing changes.</p>
        </div>
        <button type="button" id="runSeoAudit" class="save-button">Run SEO Audit</button>
      </div>
      <div id="seoAuditSummary" class="seo-audit-summary" aria-live="polite">Audit not run yet.</div>
      <div id="seoAuditResults" class="seo-audit-results"></div>
    `;

    const target = document.querySelector(".content") || app;
    target.appendChild(panel);

    const style = document.createElement("style");
    style.textContent = `
      #seoAuditPanel { margin-top: 24px; }
      .seo-audit-header { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:18px; }
      .seo-audit-header h2 { margin:0 0 6px; }
      .seo-audit-header p { margin:0; color:var(--muted); }
      .seo-audit-summary { margin-bottom:16px; font-weight:700; }
      .seo-audit-results { display:grid; gap:12px; }
      .seo-page-row { display:grid; grid-template-columns:minmax(170px,1fr) 90px minmax(240px,2fr); gap:14px; align-items:start; padding:15px; border:1px solid var(--border); border-radius:14px; background:#fff; }
      .seo-page-row h3 { margin:0 0 4px; font-size:16px; }
      .seo-page-row small { color:var(--muted); word-break:break-all; }
      .seo-score { display:inline-flex; align-items:center; justify-content:center; min-width:64px; padding:9px 10px; border-radius:999px; font-weight:800; }
      .seo-score-good { background:#e9f7ee; color:#146b35; }
      .seo-score-watch { background:#fff5d9; color:#7a5700; }
      .seo-score-poor { background:#fdeaea; color:#9c1d1d; }
      .seo-recommendations { margin:0; padding-left:18px; color:var(--muted); }
      .seo-recommendations li + li { margin-top:4px; }
      @media (max-width:760px) { .seo-audit-header { align-items:flex-start; flex-direction:column; } .seo-page-row { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);

    document.getElementById("runSeoAudit").addEventListener("click", runAudit);
  }

  async function runAudit() {
    const button = document.getElementById("runSeoAudit");
    const summary = document.getElementById("seoAuditSummary");
    const results = document.getElementById("seoAuditResults");
    if (!button || !summary || !results) return;

    button.disabled = true;
    button.textContent = "Auditing…";
    summary.textContent = "Checking public pages…";
    results.innerHTML = "";

    const audits = await window.Project318SeoAudit.auditSite(PUBLIC_PAGES.map((page) => page.path));
    const average = Math.round(audits.reduce((sum, audit) => sum + audit.score, 0) / Math.max(audits.length, 1));
    const issueCount = audits.reduce((sum, audit) => sum + audit.recommendations.length, 0);
    summary.textContent = `Average SEO score: ${average}/100 · ${issueCount} prioritized improvement${issueCount === 1 ? "" : "s"}`;

    audits.forEach((audit, index) => {
      const page = PUBLIC_PAGES[index];
      const row = document.createElement("article");
      row.className = "seo-page-row";
      const recommendations = audit.recommendations.length
        ? `<ul class="seo-recommendations">${audit.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : `<strong>No critical SEO gaps detected.</strong>`;
      row.innerHTML = `
        <div><h3>${escapeHtml(page.label)}</h3><small>${escapeHtml(audit.url)}</small></div>
        <div><span class="seo-score ${scoreClass(audit.score)}">${audit.score}/100</span></div>
        <div>${recommendations}</div>
      `;
      results.appendChild(row);
    });

    button.disabled = false;
    button.textContent = "Run SEO Audit";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createPanel);
  } else {
    createPanel();
  }
})();
