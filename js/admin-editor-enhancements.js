(function () {
  "use strict";

  const pageMap = {
    textPanel: { label: "Homepage", url: "index.html" },
    aboutContentPanel: { label: "About Page", url: "about.html" },
    corporateContentPanel: { label: "Corporate Page", url: "corporate.html" },
    contactContentPanel: { label: "Contact Page", url: "contact.html" },
    menuPanel: { label: "Catering Menu", url: "catering.html" },
    settingsPanel: { label: "Website Settings", url: "index.html" },
    photosPanel: { label: "Website Images", url: "index.html" }
  };

  function addStyles() {
    if (document.getElementById("visualEditorStyles")) return;
    const style = document.createElement("style");
    style.id = "visualEditorStyles";
    style.textContent = `
      .ve-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:0 0 18px;padding:14px 16px;border:1px solid #dededb;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.045)}
      .ve-toolbar strong,.ve-toolbar span{display:block}.ve-toolbar span{margin-top:3px;color:#6b6b6b;font-size:12px}.ve-actions{display:flex;flex-wrap:wrap;gap:8px}.ve-button{padding:10px 13px;border:1px solid #d3d3d0;border-radius:10px;background:#fff;color:#111;font-weight:800}.ve-button.primary{border-color:#111;background:#111;color:#fff}.ve-state{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#f1f1ef;color:#555;font-size:12px;font-weight:800}.ve-state:before{content:"";width:8px;height:8px;border-radius:50%;background:#999}.ve-state.dirty{background:#fff3cf;color:#755400}.ve-state.dirty:before{background:#d99a00}.ve-state.saving{background:#e8f1ff;color:#174a91}.ve-state.saving:before{background:#4b8ce8}.ve-state.saved{background:#e8f7ef;color:#17603a}.ve-state.saved:before{background:#48a578}.ve-state.error{background:#ffe7e5;color:#9e2720}.ve-state.error:before{background:#d92d20}
      .ve-preview-shell{margin-bottom:20px;border:1px solid #dededb;border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.045)}.ve-preview-head{display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid #ececea;background:#fafaf8}.ve-preview-head b{font-size:13px}.ve-preview-frame{width:100%;height:420px;border:0;background:#f5f5f3}.ve-preview-note{padding:10px 14px;color:#6b6b6b;font-size:12px;background:#fafaf8}
      .photo-card{position:relative;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease}.photo-card:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.09)}.photo-card img{aspect-ratio:16/10;max-height:none!important}.photo-card input[type=file]{padding:10px;border:1px dashed #bbb;border-radius:10px;background:#fafaf8}.photo-card button{transition:transform .16s ease,opacity .16s ease}.photo-card button:disabled{opacity:.6;cursor:wait}.ve-photo-status{min-height:20px;margin:8px 0 0;font-size:12px;font-weight:800;color:#6b6b6b}.ve-photo-meta{display:flex;justify-content:space-between;gap:8px;margin-top:8px;color:#777;font-size:11px}.ve-photo-new{outline:3px solid rgba(226,27,35,.18);outline-offset:3px}
      .editor-field{padding:14px;border:1px solid #ececea;border-radius:13px;background:#fcfcfb}.editor-field:focus-within{border-color:#e21b23;box-shadow:0 0 0 3px rgba(226,27,35,.09)}
      @media(max-width:760px){.ve-toolbar,.ve-preview-head{align-items:flex-start;flex-direction:column}.ve-actions{width:100%}.ve-button{flex:1}.ve-preview-frame{height:330px}}
      @media(prefers-reduced-motion:reduce){.photo-card,.photo-card button{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function stateElement(panel) {
    return panel.querySelector(".ve-state");
  }

  function setState(panel, text, kind) {
    const state = stateElement(panel);
    if (!state) return;
    state.textContent = text;
    state.className = `ve-state ${kind || ""}`.trim();
  }

  function addPanelWorkspace(panelId, config) {
    const panel = document.getElementById(panelId);
    if (!panel || panel.querySelector(".ve-toolbar")) return;
    const heading = panel.querySelector(".panel-heading,.booking-panel-heading,.crm-panel-heading,.invoice-panel-heading");
    const toolbar = document.createElement("div");
    toolbar.className = "ve-toolbar";
    toolbar.innerHTML = `<div><strong>${config.label} editor</strong><span>Edit, save, then refresh the preview to verify the public page.</span></div><div class="ve-actions"><span class="ve-state saved">Loaded</span><button type="button" class="ve-button" data-ve-refresh>Refresh Preview</button><button type="button" class="ve-button primary" data-ve-open>Open Live Page</button></div>`;
    if (heading) heading.insertAdjacentElement("afterend", toolbar); else panel.prepend(toolbar);

    const preview = document.createElement("div");
    preview.className = "ve-preview-shell";
    preview.innerHTML = `<div class="ve-preview-head"><b>Live page preview</b><span>Updates appear after saving. Storage images may take a few seconds to refresh.</span></div><iframe class="ve-preview-frame" title="${config.label} public page preview" loading="lazy" src="${config.url}?adminPreview=${Date.now()}"></iframe><div class="ve-preview-note">The preview uses the same public page your customers see. Refresh it after saving to confirm the change.</div>`;
    toolbar.insertAdjacentElement("afterend", preview);

    const frame = preview.querySelector("iframe");
    toolbar.querySelector("[data-ve-refresh]").addEventListener("click", () => {
      frame.src = `${config.url}${config.url.includes("?") ? "&" : "?"}adminPreview=${Date.now()}`;
      setState(panel, "Preview refreshed", "saved");
    });
    toolbar.querySelector("[data-ve-open]").addEventListener("click", () => window.open(config.url, "_blank", "noopener"));

    panel.addEventListener("input", (event) => {
      if (event.target.matches("input,textarea,select")) setState(panel, "Unsaved changes", "dirty");
    });

    const message = panel.querySelector(".message");
    if (message) {
      new MutationObserver(() => {
        const text = message.textContent.trim();
        if (!text) return;
        if (/saving|uploading|publishing/i.test(text)) setState(panel, "Saving…", "saving");
        else if (/failed|error|could not|invalid/i.test(text)) setState(panel, "Needs attention", "error");
        else if (/saved|updated|success/i.test(text)) {
          setState(panel, "Saved", "saved");
          frame.src = `${config.url}${config.url.includes("?") ? "&" : "?"}adminPreview=${Date.now()}`;
        }
      }).observe(message, { childList: true, subtree: true, characterData: true });
    }
  }

  function improvePhotoManager() {
    const manager = document.getElementById("photoManager");
    if (!manager) return;
    const enhance = () => {
      manager.querySelectorAll(".photo-card").forEach((card) => {
        if (card.dataset.enhanced) return;
        card.dataset.enhanced = "true";
        const image = card.querySelector("img");
        const input = card.querySelector('input[type="file"]');
        const button = card.querySelector("button");
        const status = document.createElement("div");
        status.className = "ve-photo-status";
        status.textContent = "Current public image";
        card.appendChild(status);
        const meta = document.createElement("div");
        meta.className = "ve-photo-meta";
        meta.innerHTML = "<span>Select a replacement</span><span>JPG, PNG or WebP</span>";
        input?.insertAdjacentElement("beforebegin", meta);
        input?.addEventListener("change", () => {
          const file = input.files?.[0];
          if (!file) return;
          status.textContent = `${file.name} selected · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
          status.style.color = "#755400";
          if (image) {
            image.src = URL.createObjectURL(file);
            image.classList.add("ve-photo-new");
          }
        });
        button?.addEventListener("click", () => {
          button.disabled = true;
          status.textContent = "Uploading replacement…";
          status.style.color = "#174a91";
          setTimeout(() => { button.disabled = false; }, 5000);
        }, true);
        image?.addEventListener("load", () => {
          if (!input?.files?.length) {
            status.textContent = "Current public image loaded";
            status.style.color = "#17603a";
            image.classList.remove("ve-photo-new");
          }
        });
        image?.addEventListener("error", () => {
          status.textContent = "Image could not be loaded. Upload a replacement or refresh.";
          status.style.color = "#9e2720";
        });
      });
    };
    enhance();
    new MutationObserver(enhance).observe(manager, { childList: true, subtree: true });
  }

  addStyles();
  Object.entries(pageMap).forEach(([id, config]) => addPanelWorkspace(id, config));
  improvePhotoManager();
})();