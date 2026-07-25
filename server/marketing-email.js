"use strict";

const VARIABLES = new Set(["customer_name","first_name","company_name","event_date","event_type","proposal_link","portal_link","quote_total","business_phone","business_email","unsubscribe_link"]);
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[character])); }
function safeUrl(value) { try { const url=new URL(String(value)); return ["https:","http:"].includes(url.protocol)?url.href:"#"; } catch (_error) { return "#"; } }
function replaceVariables(value, data = {}) {
  return String(value || "").replace(/\{\{([a-z_]+)\}\}/g, (_match,key) => VARIABLES.has(key) ? String(data[key] ?? "") : "");
}
function renderBlocks(blocks, data = {}) {
  if (!Array.isArray(blocks)) throw new Error("Template blocks must be an array.");
  const html = blocks.slice(0,100).map(block => {
    const type=String(block?.type||""); const text=replaceVariables(block?.text,data);
    if(type==="logo"||type==="image") return `<img src="${escapeHtml(safeUrl(replaceVariables(block.url,data)))}" alt="${escapeHtml(replaceVariables(block.alt,data))}" style="max-width:100%;height:auto">`;
    if(type==="preheader") return `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(text)}</div>`;
    if(type==="headline") return `<h1>${escapeHtml(text)}</h1>`;
    if(type==="text") return `<p>${escapeHtml(text).replace(/\n/g,"<br>")}</p>`;
    if(type==="button") return `<p><a href="${escapeHtml(safeUrl(replaceVariables(block.url,data)))}" style="display:inline-block;padding:12px 20px;background:#e21b23;color:#fff;text-decoration:none;border-radius:8px">${escapeHtml(text)}</a></p>`;
    if(type==="divider") return "<hr>";
    if(type==="testimonial") return `<blockquote>${escapeHtml(text)}</blockquote>`;
    if(type==="contact"||type==="social"||type==="footer") return `<p>${escapeHtml(text).replace(/\n/g,"<br>")}</p>`;
    return "";
  }).join("");
  return `<div style="margin:0 auto;max-width:640px;font-family:Arial,sans-serif;line-height:1.6;color:#111">${html}</div>`;
}
function plainText(blocks, data = {}) {
  return (Array.isArray(blocks)?blocks:[]).filter(block=>!["logo","image","divider"].includes(block?.type))
    .map(block=>replaceVariables(block?.text,data).trim()).filter(Boolean).join("\n\n");
}
module.exports={VARIABLES,escapeHtml,safeUrl,replaceVariables,renderBlocks,plainText};
