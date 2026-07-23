(function campaignLinkBuilderModule(globalScope){
  "use strict";

  const ALLOWED_PROTOCOLS=new Set(["http:","https:"]);

  function cleanToken(value){
    return String(value||"").trim().toLowerCase().replace(/[^a-z0-9._~-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,100);
  }

  function validDestination(value,origin="https://www.318foodco.com"){
    try{
      const url=new URL(String(value||"/"),origin);
      return ALLOWED_PROTOCOLS.has(url.protocol)?url:null;
    }catch{return null;}
  }

  function buildCampaignUrl(options={},origin="https://www.318foodco.com"){
    const url=validDestination(options.destination,origin);
    if(!url) throw new Error("Enter a valid website destination.");
    const source=cleanToken(options.source);
    const medium=cleanToken(options.medium);
    const campaign=cleanToken(options.campaign);
    if(!source||!medium||!campaign) throw new Error("Source, medium, and campaign are required.");
    url.searchParams.set("utm_source",source);
    url.searchParams.set("utm_medium",medium);
    url.searchParams.set("utm_campaign",campaign);
    const content=cleanToken(options.content);
    const term=cleanToken(options.term);
    if(content) url.searchParams.set("utm_content",content); else url.searchParams.delete("utm_content");
    if(term) url.searchParams.set("utm_term",term); else url.searchParams.delete("utm_term");
    return url.toString();
  }

  function createBuilder(win){
    const doc=win.document;
    const panel=doc&&doc.getElementById("marketingPanel");
    if(!panel||doc.getElementById("campaignLinkBuilder")) return;

    const stylesheet=doc.createElement("link");
    stylesheet.rel="stylesheet";
    stylesheet.href="css/admin-campaign-links.css";
    doc.head.appendChild(stylesheet);

    const section=doc.createElement("div");
    section.id="campaignLinkBuilder";
    section.className="card campaign-link-builder";
    section.innerHTML=`
      <div class="marketing-card-heading"><div><h3>Campaign link builder</h3><p>Create trackable links for Facebook posts, ads, email, flyers, and QR codes.</p></div></div>
      <div class="campaign-link-grid">
        <label class="wide">Destination page<input id="campaignDestination" value="/quote-builder.html" placeholder="/quote-builder.html"></label>
        <label>Source<input id="campaignSource" value="facebook" placeholder="facebook"></label>
        <label>Medium<input id="campaignMedium" value="social" placeholder="paid_social"></label>
        <label>Campaign<input id="campaignName" placeholder="office_catering_july"></label>
        <label>Content (optional)<input id="campaignContent" placeholder="video_1"></label>
        <label>Term (optional)<input id="campaignTerm" placeholder="corporate_lunch"></label>
      </div>
      <div class="campaign-link-actions"><button id="campaignBuild" type="button">Build link</button><button id="campaignCopy" type="button" class="secondary" disabled>Copy link</button></div>
      <label class="campaign-result-label">Trackable link<textarea id="campaignResult" readonly rows="3" aria-live="polite"></textarea></label>
      <p id="campaignLinkMessage" class="message" role="status" aria-live="polite"></p>`;

    const toolbar=panel.querySelector(".marketing-toolbar");
    toolbar?.before(section);
    const byId=id=>doc.getElementById(id);

    function build(){
      const message=byId("campaignLinkMessage");
      try{
        const result=buildCampaignUrl({
          destination:byId("campaignDestination").value,
          source:byId("campaignSource").value,
          medium:byId("campaignMedium").value,
          campaign:byId("campaignName").value,
          content:byId("campaignContent").value,
          term:byId("campaignTerm").value
        },win.location?.origin||"https://www.318foodco.com");
        byId("campaignResult").value=result;
        byId("campaignCopy").disabled=false;
        message.textContent="Trackable campaign link is ready.";
        return result;
      }catch(error){
        byId("campaignResult").value="";
        byId("campaignCopy").disabled=true;
        message.textContent=error.message;
        return "";
      }
    }

    async function copy(){
      const value=byId("campaignResult").value;
      if(!value) return;
      try{
        await win.navigator.clipboard.writeText(value);
        byId("campaignLinkMessage").textContent="Campaign link copied.";
      }catch{
        byId("campaignResult").focus();
        byId("campaignResult").select();
        byId("campaignLinkMessage").textContent="Link selected. Press Ctrl+C to copy.";
      }
    }

    byId("campaignBuild").addEventListener("click",build);
    byId("campaignCopy").addEventListener("click",copy);
  }

  const api={cleanToken,validDestination,buildCampaignUrl,createBuilder};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(globalScope&&globalScope.document){
    if(globalScope.document.readyState==="loading") globalScope.document.addEventListener("DOMContentLoaded",()=>createBuilder(globalScope));
    else createBuilder(globalScope);
  }
})(typeof window!=="undefined"?window:globalThis);
