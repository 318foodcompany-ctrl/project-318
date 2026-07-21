(()=>{
  const body=document.body;
  const finale=document.querySelector('[data-coin-finale]');
  const resetAt=80;
  let unlocked=false;

  const sync=()=>{
    if(window.scrollY<=resetAt){
      unlocked=false;
      body.classList.remove('final-cta-active');
      return;
    }

    if(finale?.classList.contains('is-live')) unlocked=true;
    body.classList.toggle('final-cta-active',unlocked);
  };

  const observer=finale?new MutationObserver(sync):null;
  observer?.observe(finale,{attributes:true,attributeFilter:['class']});
  window.addEventListener('scroll',sync,{passive:true});
  window.addEventListener('pageshow',sync);
  sync();
})();