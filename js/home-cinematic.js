(function(){
  'use strict';
  const scene=document.querySelector('[data-scene]');
  const phases=[...document.querySelectorAll('[data-phase]')];
  const route=[...document.querySelectorAll('.cin-route i')];
  const current=document.querySelector('[data-route-current]');
  let raf=0,lastActive=-2;
  function update(){
    raf=0;
    const max=document.documentElement.scrollHeight-innerHeight;
    const progress=max?Math.max(0,Math.min(1,scrollY/max)):0;
    const phase=progress*4.7;
    const active=phase<.55?-1:Math.min(3,Math.floor((phase-.55)/1.05));
    const focus=active<0?0:Math.max(0,1-Math.abs(phase-(1.05+active*1.05))/.55);
    const touch=matchMedia('(max-width:1100px)').matches;
    if(scene){
      scene.style.transform=touch?`translate3d(${-progress*62}%,0,0)`:`translate3d(${-progress*61}%,0,0) scale(${1+focus*.13})`;
      scene.style.transformOrigin=touch?'center 63%':`${16+Math.max(0,active)*24}% 63%`;
    }
    if(active===lastActive)return;
    lastActive=active;
    phases.forEach(el=>el.classList.toggle('visible',Number(el.dataset.phase)===active));
    route.forEach((el,i)=>el.classList.toggle('on',i<=active));
    if(current)current.textContent=active<0?'00':`0${active+1}`;
  }
  function requestUpdate(){if(!raf)raf=requestAnimationFrame(update)}
  addEventListener('scroll',requestUpdate,{passive:true});addEventListener('resize',requestUpdate);update();
  document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>{const max=document.documentElement.scrollHeight-innerHeight;scrollTo({top:max*(.22+Number(button.dataset.jump)*.22),behavior:'smooth'})}));
  const menu=document.querySelector('.cin-menu'),mobile=document.querySelector('.cin-mobile-nav');
  menu?.addEventListener('click',()=>{const open=mobile.hasAttribute('hidden');mobile.toggleAttribute('hidden',!open);menu.setAttribute('aria-expanded',String(open))});
})();
