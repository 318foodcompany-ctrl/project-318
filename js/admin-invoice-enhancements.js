(function () {
  "use strict";

  const panel = document.getElementById("invoicesPanel");
  if (!panel) return;

  function moneyNumber(text) {
    const value = Number(String(text || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? value : 0;
  }

  function addStyles() {
    if (document.getElementById("invoiceEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "invoiceEnhancementStyles";
    style.textContent = `
      .invoice-workspace-note{margin:-8px 0 18px;padding:14px 16px;border:1px solid #e4e4e1;border-radius:14px;background:linear-gradient(135deg,#fff,#fafaf7);color:#555}
      .invoice-workspace-note strong{display:block;margin-bottom:4px;color:#111}
      .invoice-card-grid{display:grid;gap:12px}.invoice-visual-card{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(160px,.7fr) minmax(180px,.8fr) auto;gap:16px;align-items:center;padding:17px;border:1px solid #e4e4e1;border-radius:16px;background:#fff;box-shadow:0 7px 22px rgba(0,0,0,.045);transition:transform .16s ease,box-shadow .16s ease}
      .invoice-visual-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.08)}.invoice-visual-card.overdue{border-color:#f0b4ae;background:#fffafa}.invoice-card-title{display:flex;align-items:center;gap:9px}.invoice-card-title button{font-size:15px;text-decoration:none}.invoice-card-meta{margin-top:6px;color:#666;font-size:12px}.invoice-card-amount strong{display:block;font-size:20px}.invoice-card-amount span{display:block;margin-top:4px;color:#777;font-size:12px}
      .invoice-progress{height:8px;overflow:hidden;border-radius:999px;background:#ececea}.invoice-progress span{display:block;height:100%;border-radius:inherit;background:#2b8a57}.invoice-progress-label{display:flex;justify-content:space-between;margin-top:6px;color:#666;font-size:11px}.invoice-card-action{border:0;border-radius:10px;padding:10px 12px;background:#111;color:#fff;font-weight:800}.invoice-preview-button{padding:12px 16px;border:1px solid #ccc;border-radius:10px;background:#fff;font-weight:800}.invoice-preview-sheet{margin-top:18px;padding:28px;border:1px solid #ddd;border-radius:16px;background:#fff}.invoice-preview-sheet h2{margin:0}.invoice-preview-head{display:flex;justify-content:space-between;gap:20px;padding-bottom:18px;border-bottom:2px solid #111}.invoice-preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.invoice-preview-total{margin-top:18px;padding:16px;border-radius:12px;background:#f5f5f3;text-align:right}.invoice-preview-total strong{font-size:24px}.invoice-preview-sheet[hidden]{display:none}
      @media(max-width:850px){.invoice-visual-card{grid-template-columns:1fr 1fr}.invoice-card-action{width:100%}}@media(max-width:560px){.invoice-visual-card{grid-template-columns:1fr}.invoice-preview-grid{grid-template-columns:1fr}.invoice-preview-head{display:block}}
      @media(prefers-reduced-motion:reduce){.invoice-visual-card{transition:none}}
      @media print{body *{visibility:hidden}.invoice-preview-sheet,.invoice-preview-sheet *{visibility:visible}.invoice-preview-sheet{position:absolute;inset:0;margin:0;border:0}.invoice-modal-close,.invoice-form-actions,.invoice-payment-section,.invoice-reason-prompt,.invoice-preview-button{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function addIntro() {
    if (panel.querySelector(".invoice-workspace-note")) return;
    const heading = panel.querySelector(".invoice-panel-heading");
    if (!heading) return;
    heading.insertAdjacentHTML("afterend", '<div class="invoice-workspace-note"><strong>Money workspace</strong>See what is paid, what is still owed, and what needs attention without opening every invoice.</div>');
  }

  function transformTable() {
    const wrap = document.getElementById("invoiceTableWrap");
    const table = wrap?.querySelector("table.invoice-table");
    if (!table || wrap.dataset.visualized === "true") return;
    const rows = [...table.querySelectorAll("tbody tr")];
    if (!rows.length) return;
    const cards = rows.map((row) => {
      const cells = [...row.cells];
      if (cells.length < 10) return "";
      const open = cells[0].querySelector("[data-invoice-id]");
      const id = open?.dataset.invoiceId || "";
      const total = moneyNumber(cells[6].textContent);
      const paid = moneyNumber(cells[7].textContent);
      const balance = moneyNumber(cells[8].textContent);
      const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((paid / total) * 100))) : 0;
      const status = cells[9].textContent.trim();
      const overdue = status.toLowerCase().includes("overdue");
      return `<article class="invoice-visual-card ${overdue ? "overdue" : ""}">
        <div><div class="invoice-card-title"><button class="invoice-open" type="button" data-enhanced-invoice="${id}">${cells[0].textContent.trim()}</button>${cells[9].innerHTML}</div><div class="invoice-card-meta">${cells[1].textContent.trim()}${cells[2].textContent.trim() !== "—" ? ` · ${cells[2].textContent.trim()}` : ""}<br>${cells[3].textContent.trim()} · Due ${cells[5].textContent.trim()}</div></div>
        <div class="invoice-card-amount"><strong>${cells[8].textContent.trim()}</strong><span>remaining of ${cells[6].textContent.trim()}</span></div>
        <div><div class="invoice-progress" aria-label="${percent}% paid"><span style="width:${percent}%"></span></div><div class="invoice-progress-label"><span>${cells[7].textContent.trim()} paid</span><span>${percent}%</span></div></div>
        <button class="invoice-card-action" type="button" data-enhanced-invoice="${id}">${balance > 0 ? "Manage" : "View"}</button>
      </article>`;
    }).join("");
    wrap.innerHTML = `<div class="invoice-card-grid">${cards}</div>`;
    wrap.dataset.visualized = "true";
    wrap.querySelectorAll("[data-enhanced-invoice]").forEach((button) => button.addEventListener("click", () => {
      const original = rowButtonProxy(button.dataset.enhancedInvoice);
      original?.click();
    }));
  }

  function rowButtonProxy(id) {
    const proxy = document.createElement("button");
    proxy.hidden = true;
    document.body.appendChild(proxy);
    proxy.addEventListener("click", () => window.invoiceManager?.openInvoice(id), { once: true });
    setTimeout(() => proxy.remove(), 0);
    return proxy;
  }

  function enhanceModal() {
    const modalCard = document.querySelector(".invoice-modal-card");
    const actions = modalCard?.querySelector(".invoice-form-actions");
    if (!modalCard || !actions || modalCard.querySelector(".invoice-preview-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "invoice-preview-button";
    button.textContent = "Preview Customer Invoice";
    actions.appendChild(button);
    const sheet = document.createElement("section");
    sheet.className = "invoice-preview-sheet";
    sheet.hidden = true;
    modalCard.appendChild(sheet);
    button.addEventListener("click", () => {
      const title = document.getElementById("invoiceModalTitle")?.textContent || "Invoice";
      const customer = document.getElementById("invoiceCustomerSearch")?.value || "Customer";
      const due = document.getElementById("invoiceDueDate")?.value || "—";
      const total = document.getElementById("invoiceTotal")?.textContent || "$0.00";
      const paid = document.getElementById("invoicePaid")?.textContent || "$0.00";
      const balance = document.getElementById("invoiceBalance")?.textContent || total;
      const lineRows = [...document.querySelectorAll("#invoiceLineItems .invoice-line")].map((row) => {
        const description = row.querySelector(".line-description")?.value || "Service";
        const quantity = row.querySelector(".line-quantity")?.value || "1";
        const price = Number(row.querySelector(".line-price")?.value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
        return `<div class="invoice-preview-grid"><span>${description}</span><strong>${quantity} × ${price}</strong></div>`;
      }).join("");
      sheet.innerHTML = `<div class="invoice-preview-head"><div><p>318 Food Co.</p><h2>${title}</h2></div><div><strong>Bill to</strong><br>${customer}<br>Due ${due}</div></div>${lineRows}<div class="invoice-preview-total"><span>Total ${total} · Paid ${paid}</span><br><strong>Balance ${balance}</strong></div><p>Thank you for choosing 318 Food Co.</p><button type="button" class="invoice-preview-button" data-print-invoice>Print / Save PDF</button>`;
      sheet.hidden = false;
      sheet.querySelector("[data-print-invoice]").addEventListener("click", () => window.print());
      sheet.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  addStyles();
  addIntro();
  const observer = new MutationObserver(() => {
    const wrap = document.getElementById("invoiceTableWrap");
    if (wrap?.querySelector("table")) wrap.dataset.visualized = "false";
    transformTable();
    enhanceModal();
  });
  observer.observe(panel, { childList: true, subtree: true });
  transformTable();
  enhanceModal();
})();