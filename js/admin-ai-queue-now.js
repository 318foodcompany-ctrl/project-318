(function(){
  "use strict";
  const $=s=>document.querySelector(s);
  async function session(){const s=(await window.supabaseClient.auth.getSession()).data.session;if(!s)throw new Error("Session expired.");return s;}
  function addButtons(){
    document.querySelectorAll("[data-setting]").forEach(section=>{
      if(section.querySelector("[data-queue-now]"))return;
      const type=section.getAttribute("data-setting"),actions=section.querySelector(".actions");
      if(!type||!actions)return;
      const button=document.createElement("button");button.type="button";button.className="secondary";button.dataset.queueNow=type;button.textContent="Generate 1 Draft Now";actions.appendChild(button);
    });
  }
  async function queue(type,button){
    try{
      button.disabled=true;button.textContent="Queueing…";
      const s=await session(),r=await fetch("/api/admin-marketing-autopilot-queue",{method:"POST",headers:{Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({content_type:type,count:1})}),payload=await r.json();
      if(!r.ok)throw new Error(payload.error||"Queue failed.");
      button.textContent="Queued ✓";
      const message=$("#autopilotMessage");if(message){message.textContent=`${payload.queued||1} ${String(type).replaceAll("_"," ")} draft queued. It will generate on the next scheduler run and still require approval.`;message.className="message ok";}
      setTimeout(()=>{button.disabled=false;button.textContent="Generate 1 Draft Now";},1800);
    }catch(error){button.disabled=false;button.textContent="Generate 1 Draft Now";const message=$("#autopilotMessage");if(message){message.textContent=`Could not queue draft: ${error.message}`;message.className="message error";}}
  }
  document.addEventListener("click",e=>{const button=e.target.closest("[data-queue-now]");if(button)queue(button.dataset.queueNow,button);});
  const observer=new MutationObserver(addButtons);const root=$("#settingsList");if(root)observer.observe(root,{childList:true,subtree:true});addButtons();
})();
