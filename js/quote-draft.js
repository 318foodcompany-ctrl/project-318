(function quoteDraftModule(globalScope){
  "use strict";

  const STORAGE_KEY="project318_quote_draft_v1";
  const MAX_AGE_MS=7*24*60*60*1000;
  const SAFE_FIELDS=["eventType","guestCount","menu","eventDate","eventTime"];

  function safeStorage(win){
    try{
      const storage=win&&win.localStorage;
      if(!storage) return null;
      const probe="__project318_draft_probe__";
      storage.setItem(probe,"1");
      storage.removeItem(probe);
      return storage;
    }catch(error){
      return null;
    }
  }

  function readDraft(storage,now=Date.now()){
    if(!storage) return null;
    try{
      const value=JSON.parse(storage.getItem(STORAGE_KEY)||"null");
      if(!value||typeof value!=="object"||!Number.isFinite(Number(value.savedAt))) return null;
      if(now-Number(value.savedAt)>MAX_AGE_MS){storage.removeItem(STORAGE_KEY);return null;}
      return value;
    }catch(error){
      storage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function collectDraft(form,now=Date.now()){
    const values={};
    SAFE_FIELDS.forEach(name=>{
      const checked=form.querySelector(`input[name="${name}"]:checked`);
      const field=form.elements&&form.elements[name];
      const value=checked?checked.value:field&&typeof field.value!=="undefined"?field.value:"";
      if(value!=="") values[name]=String(value);
    });
    values.addons=Array.from(form.querySelectorAll('input[name="addons"]:checked')).map(input=>input.value);
    return {savedAt:now,values};
  }

  function restoreDraft(form,draft){
    if(!form||!draft||!draft.values) return false;
    let restored=false;
    SAFE_FIELDS.forEach(name=>{
      const value=draft.values[name];
      if(value==null||value==="") return;
      const radios=Array.from(form.querySelectorAll(`input[name="${name}"]`)).filter(input=>input.type==="radio");
      if(radios.length){
        const target=radios.find(input=>input.value===value);
        if(target){target.checked=true;restored=true;}
        return;
      }
      const field=form.elements&&form.elements[name];
      if(field&&typeof field.value!=="undefined"){field.value=value;restored=true;}
    });
    const addons=new Set(Array.isArray(draft.values.addons)?draft.values.addons:[]);
    form.querySelectorAll('input[name="addons"]').forEach(input=>{input.checked=addons.has(input.value);if(input.checked) restored=true;});
    return restored;
  }

  function createNotice(doc,onDiscard){
    const notice=doc.createElement("div");
    notice.className="quote-draft-notice";
    notice.setAttribute("role","status");
    notice.innerHTML='<span>Your event details were restored from this device.</span><button type="button">Discard saved details</button>';
    notice.querySelector("button").addEventListener("click",onDiscard);
    return notice;
  }

  function initialize(win){
    const doc=win&&win.document;
    const form=doc&&doc.getElementById("quoteBuilder");
    if(!form||form.dataset.draftReady==="true") return;
    form.dataset.draftReady="true";
    const storage=safeStorage(win);
    if(!storage) return;

    const draft=readDraft(storage);
    if(draft&&restoreDraft(form,draft)){
      const shell=form.closest(".builder-shell")||form.parentElement;
      const notice=createNotice(doc,()=>{
        storage.removeItem(STORAGE_KEY);
        notice.remove();
      });
      shell.insertBefore(notice,form);
    }

    let saveTimer=null;
    const save=()=>{
      win.clearTimeout(saveTimer);
      saveTimer=win.setTimeout(()=>{
        const next=collectDraft(form);
        const hasProgress=Object.keys(next.values).some(key=>key!=="addons"&&next.values[key]!=="")||next.values.addons.length>0;
        if(hasProgress) storage.setItem(STORAGE_KEY,JSON.stringify(next));
        else storage.removeItem(STORAGE_KEY);
      },250);
    };
    form.addEventListener("input",save);
    form.addEventListener("change",save);

    const success=doc.getElementById("builderSuccess");
    if(success&&typeof win.MutationObserver==="function"){
      const observer=new win.MutationObserver(()=>{
        if(!success.hidden){storage.removeItem(STORAGE_KEY);observer.disconnect();}
      });
      observer.observe(success,{attributes:true,attributeFilter:["hidden"]});
    }
  }

  const api={STORAGE_KEY,MAX_AGE_MS,SAFE_FIELDS,readDraft,collectDraft,restoreDraft,initialize};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(globalScope&&globalScope.document){
    if(globalScope.document.readyState==="loading") globalScope.document.addEventListener("DOMContentLoaded",()=>initialize(globalScope));
    else initialize(globalScope);
  }
})(typeof window!=="undefined"?window:globalThis);
