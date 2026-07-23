(function marketingAssistantModule(globalScope) {
  "use strict";

  const PUBLIC_PAGES = ["/", "/catering.html", "/corporate.html", "/about.html", "/gallery.html", "/contact.html", "/quote-builder.html"];

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
  function dateText(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); }
  function safeNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }

  async function pageSeoContext(win) {
    return Promise.all(PUBLIC_PAGES.map(async path => {
      const response = await win.fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return { path, error: `HTTP ${response.status}` };
      const document = new win.DOMParser().parseFromString(await response.text(), "text/html");
      return {
        path,
        title: document.title.trim().slice(0, 160),
        description: (document.querySelector('meta[name="description"]')?.content || "").trim().slice(0, 320),
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        h1: [...document.querySelectorAll("h1")].map(item => item.textContent.trim().slice(0, 200)),
        h2: [...document.querySelectorAll("h2")].slice(0, 12).map(item => item.textContent.trim().slice(0, 200)),
        internal_links: [...new Set([...document.querySelectorAll('a[href]')].map(item => item.getAttribute("href")).filter(href => href && !/^(?:https?:|mailto:|tel:|#)/i.test(href)))].slice(0, 40),
        images: document.querySelectorAll("img").length,
        images_without_alt: [...document.querySelectorAll("img")].filter(image => !image.hasAttribute("alt")).length
      };
    }));
  }

  async function performanceContext(client, start, end) {
    const args = { p_start: start, p_end: end, p_model: "last_non_direct" };
    const [funnel, revenue, spend] = await Promise.all([
      client.rpc("marketing_quote_funnel", args),
      client.rpc("marketing_revenue_attribution", args),
      client.rpc("marketing_spend_summary", args)
    ]);
    for (const result of [funnel, revenue, spend]) if (result.error) throw result.error;
    const funnelRows = funnel.data || [];
    const revenueRows = revenue.data || [];
    const spendRows = spend.data || [];
    return {
      period: { start, end },
      totals: {
        quotes: funnelRows.reduce((sum, row) => sum + safeNumber(row.quote_count), 0),
        booked: funnelRows.reduce((sum, row) => sum + safeNumber(row.booked_count), 0),
        booked_value: funnelRows.reduce((sum, row) => sum + safeNumber(row.booked_budget), 0),
        revenue: revenueRows.reduce((sum, row) => sum + safeNumber(row.revenue), 0),
        spend: spendRows.reduce((sum, row) => sum + safeNumber(row.spend), 0)
      },
      funnel_by_source: funnelRows.slice(0, 30),
      revenue_by_source: revenueRows.slice(0, 30),
      spend_by_source: spendRows.slice(0, 30)
    };
  }

  function recommendationMarkup(record) {
    const draft = record?.draft || record?.structured_output || {};
    const suggestions = Array.isArray(draft.suggestions) ? draft.suggestions : [];
    return `<article class="marketing-ai-draft" data-ai-record="${escapeHtml(record.id)}"><div class="marketing-ai-draft-head"><div><span>Draft recommendation</span><h4>${escapeHtml(draft.summary || "Marketing analysis")}</h4></div><em>${escapeHtml(record.status || record.review_status || "draft")}</em></div><ol>${suggestions.map(item => `<li><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.confidence || "medium")} confidence</small></div><p>${escapeHtml(item.rationale)}</p>${item.proposed_value ? `<blockquote>${escapeHtml(item.proposed_value)}</blockquote>` : ""}</li>`).join("")}</ol>${(record.status || record.review_status) === "draft" ? `<div class="marketing-ai-actions"><button type="button" data-ai-review="approved">Approve draft</button><button type="button" class="secondary" data-ai-review="rejected">Reject draft</button></div><p class="marketing-ai-note">Approval records your decision. It does not publish content or change advertising accounts.</p>` : ""}</article>`;
  }

  function createAssistant(win) {
    const doc = win.document;
    const client = win.supabaseClient;
    const panel = doc?.getElementById("marketingPanel");
    if (!doc || !client || !panel || doc.getElementById("marketingAiAssistant")) return;

    const stylesheet = doc.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "css/admin-marketing-assistant.css";
    doc.head.appendChild(stylesheet);

    const section = doc.createElement("section");
    section.id = "marketingAiAssistant";
    section.className = "marketing-ai-shell";
    section.innerHTML = `<div class="marketing-section-heading"><div><h3>Marketing &amp; SEO Assistant</h3><p>Administrator-only analysis. Every result is saved as a draft and requires an explicit review decision.</p></div></div><div class="card marketing-ai-controls"><label>Analysis type<select id="marketingAiType"><option value="seo">SEO and page content</option><option value="performance">Analytics and lead sources</option><option value="next_actions">Recommended next actions</option></select></label><button id="marketingAiRun" type="button">Generate draft</button><span id="marketingAiMessage" role="status" aria-live="polite"></span></div><div id="marketingAiCurrent"></div><div class="card marketing-ai-history"><div class="marketing-card-heading"><div><h3>Recommendation audit history</h3><p>Generated drafts and administrator review decisions.</p></div><button id="marketingAiRefresh" type="button">Refresh history</button></div><div id="marketingAiHistory"><div class="marketing-empty">No recommendation records loaded.</div></div></div>`;
    panel.appendChild(section);

    const message = doc.getElementById("marketingAiMessage");
    const current = doc.getElementById("marketingAiCurrent");
    const history = doc.getElementById("marketingAiHistory");

    async function review(id, status) {
      message.textContent = `Saving ${status} decision…`;
      const { data, error } = await client.rpc("marketing_ai_review", { p_audit_id: id, p_status: status });
      if (error) { message.textContent = `Review failed: ${error.message}`; return; }
      message.textContent = status === "approved" ? "Draft approved for manual use. Nothing was published." : "Draft rejected. Nothing was published.";
      current.innerHTML = recommendationMarkup({ ...(Array.isArray(data) ? data[0] : data), draft: (Array.isArray(data) ? data[0] : data)?.structured_output, status });
      bindReviewButtons();
      loadHistory();
    }

    function bindReviewButtons() {
      current.querySelectorAll("[data-ai-review]").forEach(button => button.addEventListener("click", () => review(current.querySelector("[data-ai-record]")?.dataset.aiRecord, button.dataset.aiReview)));
    }

    async function loadHistory() {
      history.innerHTML = '<div class="marketing-empty">Loading recommendation history…</div>';
      const { data, error } = await client.from("marketing_ai_audit").select("id,analysis_type,structured_output,review_status,created_at,reviewed_at").order("created_at", { ascending: false }).limit(20);
      if (error) { history.innerHTML = `<div class="marketing-empty">History unavailable: ${escapeHtml(error.message)}</div>`; return; }
      history.innerHTML = data?.length ? `<div class="marketing-ai-history-list">${data.map(item => `<button type="button" data-ai-history="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.analysis_type.replace("_", " "))}</strong><small>${escapeHtml(item.structured_output?.summary || "Recommendation draft")}</small></span><em>${escapeHtml(item.review_status)} · ${escapeHtml(dateText(item.created_at))}</em></button>`).join("")}</div>` : '<div class="marketing-empty">No recommendation records yet.</div>';
      history.querySelectorAll("[data-ai-history]").forEach(button => button.addEventListener("click", () => { const item = data.find(row => row.id === button.dataset.aiHistory); current.innerHTML = recommendationMarkup({ ...item, draft: item.structured_output, status: item.review_status }); bindReviewButtons(); current.scrollIntoView({ behavior: "smooth", block: "nearest" }); }));
    }

    async function run() {
      const button = doc.getElementById("marketingAiRun");
      const type = doc.getElementById("marketingAiType").value;
      button.disabled = true;
      message.textContent = "Preparing a privacy-safe analysis…";
      try {
        const end = new Date();
        const start = new Date(end); start.setDate(start.getDate() - 90);
        const dateValue = date => date.toISOString().slice(0, 10);
        const context = type === "seo" ? { pages: await pageSeoContext(win) } : await performanceContext(client, dateValue(start), dateValue(end));
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) throw sessionError || new Error("Administrator session expired.");
        const response = await win.fetch("/api/admin-marketing-assistant", { method: "POST", headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ analysis_type: type, context }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
        current.innerHTML = recommendationMarkup(payload);
        bindReviewButtons();
        message.textContent = "Draft generated and saved to the audit history. Review it before use.";
        loadHistory();
      } catch (error) { message.textContent = `Analysis failed: ${error.message}`; }
      finally { button.disabled = false; }
    }

    doc.getElementById("marketingAiRun").addEventListener("click", run);
    doc.getElementById("marketingAiRefresh").addEventListener("click", loadHistory);
    loadHistory();
  }

  const api = { PUBLIC_PAGES, escapeHtml, safeNumber, pageSeoContext, performanceContext, recommendationMarkup, createAssistant };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope?.document) {
    if (globalScope.document.readyState === "loading") globalScope.document.addEventListener("DOMContentLoaded", () => createAssistant(globalScope));
    else createAssistant(globalScope);
  }
})(typeof window !== "undefined" ? window : globalThis);
