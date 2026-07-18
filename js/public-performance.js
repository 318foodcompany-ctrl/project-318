(function publicPerformanceModule(globalScope){
  "use strict";

  function isCriticalImage(image,index){
    if(!image) return false;
    return index===0||image.closest(".hero,.page-hero,.catering-hero")!==null||image.classList.contains("brand-logo");
  }

  function optimizeImages(doc){
    const images=Array.from(doc.querySelectorAll("img"));
    images.forEach((image,index)=>{
      if(!image.hasAttribute("decoding")) image.setAttribute("decoding","async");
      if(isCriticalImage(image,index)){
        image.setAttribute("loading","eager");
        image.setAttribute("fetchpriority","high");
      }else{
        if(!image.hasAttribute("loading")) image.setAttribute("loading","lazy");
        if(!image.hasAttribute("fetchpriority")) image.setAttribute("fetchpriority","low");
      }
    });
    return images.length;
  }

  function addResourceHint(doc,rel,href,crossOrigin){
    if(!href||doc.querySelector(`link[rel="${rel}"][href="${href}"]`)) return false;
    const link=doc.createElement("link");
    link.rel=rel;
    link.href=href;
    if(crossOrigin) link.crossOrigin="anonymous";
    doc.head.appendChild(link);
    return true;
  }

  function configureConnections(doc){
    addResourceHint(doc,"preconnect","https://cdn.jsdelivr.net",true);
    addResourceHint(doc,"preconnect","https://fonts.googleapis.com",true);
    addResourceHint(doc,"preconnect","https://fonts.gstatic.com",true);
  }

  function createPerformanceFoundation(win){
    const doc=win&&win.document;
    if(!doc||doc.documentElement.dataset.performanceReady==="true") return;
    doc.documentElement.dataset.performanceReady="true";
    configureConnections(doc);
    optimizeImages(doc);
  }

  const api={isCriticalImage,optimizeImages,addResourceHint,configureConnections,createPerformanceFoundation};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(globalScope&&globalScope.document){
    if(globalScope.document.readyState==="loading") globalScope.document.addEventListener("DOMContentLoaded",()=>createPerformanceFoundation(globalScope));
    else createPerformanceFoundation(globalScope);
  }
})(typeof window!=="undefined"?window:globalThis);
