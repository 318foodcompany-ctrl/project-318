(function () {
  "use strict";

  const modalBody = document.getElementById("customerDetailBody");
  const tableWrap = document.getElementById("customerTableWrap");
  if (!modalBody || !tableWrap) return;

  function addStyles() {
    if (document.getElementById("crmVisualWorkspaceStyles")) return;
    const style = document.createElement("style");
    style.id = "crmVisualWorkspaceStyles";
    style.textContent = `
      .crm-relationship-bar{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px;padding:14px;border:1px solid #e5e5e1;border-radius:16px;background:linear-gradient(135deg,#fafaf8,#fff)}
      .crm-relationship-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:10px 13px;border:1px solid #d8d8d4;border-radius:11px;background:#fff;color:#111;font-weight:800;text-decoration:none}
      .crm-relationship-action.primary{border-color:#111;background:#111;color:#fff}.crm-relationship-action.accent{border-color:#e21b23;background:#e21b23;color:#fff}
      .crm-next-action{margin:0 0 20px;padding:17px 18px;border-left:5px solid #e21b23;border-radius:14px;background:#fff6f6}.crm-next-action strong,.crm-next-action span{display:block}.crm-next-action span{margin-top:5px;color:#6b6b6b;font-size:13px}
      .crm-visual-tabs{display:flex;gap:8px;overflow-x:auto;margin:22px 0 4px;padding-bottom:4px}.crm-visual-tab{white-space:nowrap;padding:10px 13px;border:1px solid #ddd;border-radius:999px;background:#fff;font-weight:800}.crm-visual-tab.active{border-color:#111;background:#111;color:#fff}
      .crm-visual-section[hidden]{display:none}.crm-visual-section{animation:crmFade .16s ease}@keyframes crmFade{from{opacity:.5;transform:translateY(3px)}to{opacity:1;transform:none}}
      .crm-timeline{position:relative;padding-left:24px}.crm-timeline:before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:2px;background:#ecece8}.crm-timeline li{padding:0 0 18px 20px}.crm-timeline li::before{left:2px;top:5px;width:12px;height:12px;box-shadow:0 0 0 4px #fff}
      .crm-timeline li strong,.crm-timeline li span,.crm-timeline li small{display:block}.crm-timeline li span{margin-top:4px;color:#555}.crm-timeline li small{margin-top:5px;color:#888}
      .crm-table tbody tr{transition:transform .15s ease,box-shadow .15s ease}.crm-table tbody tr:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(0,0,0,.05)}
      .crm-stat{transition:transform .15s ease,box-shadow .15s ease}.crm-stat:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.06)}
      @media(max-width:700px){.crm-relationship-bar{display:grid;grid-template-columns:1fr 1fr}.crm-relationship-action{width:100%}.crm-table-wrap{border:0;overflow:visible}.crm-table{min-width:0}.crm-table thead{display:none}.crm-table,.crm-table tbody,.crm-table tr,.crm-table td{display:block;width:100%}.crm-table tr{margin-bottom:12px;padding:15px;border:1px solid #e3e3df;border-radius:16px;background:#fff}.crm-table td{display:grid;grid-template-columns:105px 1fr;gap:10px;padding:7px 0;border:0}.crm-table td:before{color:#777;font-size:11px;font-weight:800;text-transform:uppercase}.crm-table td:nth-child(1):before{content:"Customer"}.crm-table td:nth-child(2):before{content:"Company"}.crm-table td:nth-child(3):before{content:"Phone"}.crm-table td:nth-child(4):before{content:"Email"}.crm-table td:nth-child(5):before{content:"Quotes"}.crm-table td:nth-child(6):before{content:"Bookings"}.crm-table td:nth-child(7):before{content:"Last activity"}}
      @media(max-width:440px){.crm-relationship-bar{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){.crm-visual-section,.crm-table tbody tr,.crm-stat{animation:none;transition:none}}
    `;
    document.head.appendChild(style);
  }

  function value(name) {
    return modalBody.querySelector(`[name="${name}"]`)?.value?.trim() || "";
  }

  function nextActionText() {
    const stats = [...modalBody.querySelectorAll(".crm-stat")].map((node) => ({
      label: node.querySelector("span")?.textContent || "",
      value: node.querySelector("strong")?.textContent || ""
    }));
    const outstanding = stats.find((item) => item.label === "Outstanding")?.value || "$0.00";
    const upcomingHeading = [...modalBody.querySelectorAll(".crm-section h3")].find((node) => node.textContent === "Upcoming Events");
    const hasUpcoming = upcomingHeading?.parentElement?.querySelector(".crm-list-item");
    const lastContact = stats.find((item) => item.label === "Last Contact")?.value || "—";
    if (outstanding !== "$0.00" && outstanding !== "$0") return ["Collect or follow up on the outstanding balance", `${outstanding} is currently open on this customer.`];
    if (hasUpcoming) return ["Prepare for the next event", "Review the upcoming booking, customer notes, and invoice status."];
    if (lastContact === "—") return ["Make the first follow-up", "This customer does not have a recorded contact activity yet."];
    return ["Keep the relationship active", `Last recorded contact: ${lastContact}.`];
  }

  function buildRelationshipBar() {
    if (modalBody.querySelector(".crm-relationship-bar")) return;
    const heading = modalBody.querySelector(".crm-detail-heading");
    const form = modalBody.querySelector("#customerDetailForm");
    if (!heading || !form) return;

    const email = value("email");
    const phone = value("phone");
    const [actionTitle, actionDetail] = nextActionText();
    const bar = document.createElement("div");
    bar.className = "crm-relationship-bar";
    bar.innerHTML = `
      ${phone ? `<a class="crm-relationship-action primary" href="tel:${phone.replace(/[^+\d]/g, "")}">☎ Call</a>` : ""}
      ${email ? `<a class="crm-relationship-action" href="mailto:${email}">✉ Email</a>` : ""}
      <button class="crm-relationship-action" type="button" data-crm-open="leadsPanel">▦ Quotes</button>
      <button class="crm-relationship-action" type="button" data-crm-open="bookingsPanel">◆ Bookings</button>
      <button class="crm-relationship-action accent" type="button" data-crm-open="invoicesPanel">$ Invoices</button>`;
    heading.insertAdjacentElement("afterend", bar);
    bar.insertAdjacentHTML("afterend", `<div class="crm-next-action"><strong>Recommended next action: ${actionTitle}</strong><span>${actionDetail}</span></div>`);
    bar.querySelectorAll("[data-crm-open]").forEach((button) => button.addEventListener("click", () => {
      const panelId = button.dataset.crmOpen;
      document.getElementById("customerDetailClose")?.click();
      if (typeof window.showPanel === "function") window.showPanel(panelId);
    }));
  }

  function buildTabs() {
    if (modalBody.querySelector(".crm-visual-tabs")) return;
    const form = modalBody.querySelector("#customerDetailForm");
    const sections = [...modalBody.querySelectorAll(":scope > .crm-two-column > .crm-section, :scope > .crm-section")];
    if (!form || !sections.length) return;

    form.classList.add("crm-visual-section");
    form.dataset.crmSection = "profile";
    const groups = [{ id: "profile", label: "Profile", nodes: [form] }];
    const timeline = sections.find((section) => section.querySelector("h3")?.textContent === "Activity Timeline");
    const relationshipNodes = sections.filter((section) => ["Upcoming Events", "Past Events", "All Quotes", "All Bookings"].includes(section.querySelector("h3")?.textContent));
    const financeNodes = sections.filter((section) => section.querySelector("h3")?.textContent === "Invoices & Payments");
    if (relationshipNodes.length) groups.push({ id: "relationship", label: "Relationship", nodes: relationshipNodes });
    if (financeNodes.length) groups.push({ id: "money", label: "Money", nodes: financeNodes });
    if (timeline) groups.push({ id: "timeline", label: "Timeline", nodes: [timeline] });

    groups.forEach((group) => group.nodes.forEach((node) => {
      node.classList.add("crm-visual-section");
      node.dataset.crmSection = group.id;
    }));
    const tabs = document.createElement("div");
    tabs.className = "crm-visual-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.innerHTML = groups.map((group, index) => `<button class="crm-visual-tab${index === 0 ? " active" : ""}" type="button" role="tab" aria-selected="${index === 0}" data-crm-tab="${group.id}">${group.label}</button>`).join("");
    form.insertAdjacentElement("beforebegin", tabs);

    const show = (id) => {
      modalBody.querySelectorAll(".crm-visual-section").forEach((node) => { node.hidden = node.dataset.crmSection !== id; });
      tabs.querySelectorAll("[data-crm-tab]").forEach((button) => {
        const active = button.dataset.crmTab === id;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
    };
    tabs.querySelectorAll("[data-crm-tab]").forEach((button) => button.addEventListener("click", () => show(button.dataset.crmTab)));
    show("profile");
  }

  function enhance() {
    if (!modalBody.querySelector("#customerDetailForm") || modalBody.dataset.visualEnhanced === "true") return;
    modalBody.dataset.visualEnhanced = "true";
    buildRelationshipBar();
    buildTabs();
  }

  addStyles();
  new MutationObserver(() => {
    if (!modalBody.querySelector("#customerDetailForm")) modalBody.dataset.visualEnhanced = "false";
    enhance();
  }).observe(modalBody, { childList: true, subtree: true });
  enhance();
})();