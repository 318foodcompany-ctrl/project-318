(function(){
  "use strict";
  const button=document.getElementById("approveAllWaiting");
  if(!button)return;
  button.addEventListener("click",async()=>{
    const count=Number(document.getElementById("queueCount")?.textContent||0);
    if(!count)return;
    if(!window.confirm(`Approve all ${count} waiting AI drafts? This will not publish or send anything.`))return;
    button.disabled=true;
    const prior=button.textContent;button.textContent="Approving…";
    try{
      const session=(await window.supabaseClient.auth.getSession()).data?.session;
      if(!session)throw new Error("Session expired.");
      const response=await fetch("/api/admin-marketing-autopilot-bulk",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"approve_all_ready"})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"Bulk approval failed.");
      const message=document.getElementById("autopilotMessage");
      if(message){message.textContent=`Approved ${payload.approved||0} drafts. Nothing was published or sent.`;message.className="message ok";}
      document.getElementById("refreshQueue")?.click();
    }catch(error){
      const message=document.getElementById("autopilotMessage");
      if(message){message.textContent=`Bulk approval failed: ${error.message}`;message.className="message error";}
    }finally{button.disabled=false;button.textContent=prior;}
  });
})();
