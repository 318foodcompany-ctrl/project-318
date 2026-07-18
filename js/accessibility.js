(function accessibilityModule(globalScope){
  "use strict";

  function pageName(pathname){
    const value=String(pathname||"").split("/").pop()||"index.html";
    return value.toLowerCase();
  }

  function isCurrentLink(href,pathname){
    if(!href||/^https?:|^mailto:|^tel:|^#/.test(href)) return false;
    const target=pageName(href.split(/[?#]/)[0]);
    return target===pageName(pathname);
  }

  function createAccessibility(win){
    const doc=win&&win.document;
    if(!doc||doc.documentElement.dataset.accessibilityReady==="true") return;
    doc.documentElement.dataset.accessibilityReady="true";

    const main=doc.querySelector("main");
    if(main){
      if(!main.id) main.id="main-content";
      if(!doc.querySelector(".skip-link")){
        const skip=doc.createElement("a");
        skip.className="skip-link";
        skip.href=`#${main.id}`;
        skip.textContent="Skip to main content";
        doc.body.prepend(skip);
      }
      if(!main.hasAttribute("tabindex")) main.setAttribute("tabindex","-1");
    }

    doc.querySelectorAll(".links a").forEach(link=>{
      if(isCurrentLink(link.getAttribute("href"),win.location&&win.location.pathname)) link.setAttribute("aria-current","page");
    });

    const button=doc.querySelector(".menu-btn");
    const navigation=doc.querySelector(".links");
    if(button&&navigation){
      if(!navigation.id) navigation.id="primary-navigation";
      button.setAttribute("aria-controls",navigation.id);
      button.setAttribute("aria-expanded",navigation.classList.contains("open")?"true":"false");
      const sync=()=>button.setAttribute("aria-expanded",navigation.classList.contains("open")?"true":"false");
      button.addEventListener("click",()=>win.setTimeout(sync,0));
      doc.addEventListener("keydown",event=>{
        if(event.key!=="Escape"||!navigation.classList.contains("open")) return;
        navigation.classList.remove("open");
        sync();
        button.focus();
      });
      navigation.addEventListener("click",event=>{
        if(!event.target.closest("a")||!navigation.classList.contains("open")) return;
        navigation.classList.remove("open");
        sync();
      });
    }

    doc.querySelectorAll('a[target="_blank"]').forEach(link=>{
      const values=new Set(String(link.getAttribute("rel")||"").split(/\s+/).filter(Boolean));
      values.add("noopener");
      values.add("noreferrer");
      link.setAttribute("rel",Array.from(values).join(" "));
    });
  }

  const api={pageName,isCurrentLink,createAccessibility};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(globalScope) globalScope.Project318Accessibility=api;
  if(globalScope&&globalScope.document){
    if(globalScope.document.readyState==="loading") globalScope.document.addEventListener("DOMContentLoaded",()=>createAccessibility(globalScope));
    else createAccessibility(globalScope);
  }
})(typeof window!=="undefined"?window:globalThis);
