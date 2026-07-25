(function(){
  "use strict";
  const form=document.getElementById("unsubscribeForm"),message=document.getElementById("unsubscribeMessage");
  const params=new URLSearchParams(location.search),token=params.get("token")||"",campaignId=params.get("campaign")||null;
  if(!/^[a-f0-9]{64}$/i.test(token)){message.textContent="This unsubscribe link is invalid or expired.";form.querySelector("button").disabled=true;return;}
  form.addEventListener("submit",async event=>{
    event.preventDefault();const button=form.querySelector("button");button.disabled=true;message.textContent="Saving your preference…";
    try{
      const scope=new FormData(form).get("scope")==="campaign"&&campaignId?"campaign":"global";
      const response=await fetch("/api/unsubscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,scope,campaign_id:scope==="campaign"?campaignId:null}),signal:AbortSignal.timeout(10000)});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Unsubscribe failed.");
      message.textContent=payload.message;form.querySelectorAll("input,button").forEach(control=>control.disabled=true);
    }catch(error){message.textContent=error.name==="TimeoutError"?"The request took too long. Please try again.":error.message;button.disabled=false;}
  });
})();
