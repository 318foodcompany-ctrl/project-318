(function(){
  'use strict';
  const scene=document.querySelector('[data-scene]'),journey=document.querySelector('.cin-journey');
  const phases=[...document.querySelectorAll('[data-phase]')],route=[...document.querySelectorAll('.cin-route i')];
  const current=document.querySelector('[data-route-current]');
  let raf=0,lastActive=-2,currentProgress=0,targetProgress=0,lastWidth=innerWidth;
  const clamp=value=>Math.max(0,Math.min(1,value));
  function readProgress(){if(!journey)return 0;const distance=Math.max(1,journey.offsetHeight-document.documentElement.clientHeight);return clamp((scrollY-journey.offsetTop)/distance)}
  function render(){
    raf=0;
    const touch=matchMedia('(max-width:1100px)').matches;
    if(touch){currentProgress+=(targetProgress-currentProgress)*.16;if(Math.abs(targetProgress-currentProgress)<.00015)currentProgress=targetProgress}else currentProgress=targetProgress;
    const progress=currentProgress,phase=progress*4.7;
    const active=phase<.55?-1:Math.min(3,Math.floor((phase-.55)/1.05));
    const focus=active<0?0:Math.max(0,1-Math.abs(phase-(1.05+active*1.05))/.55);
    if(scene){scene.style.transform=touch?`translate3d(${-progress*62}%,0,0)`:`translate3d(${-progress*61}%,0,0) scale(${1+focus*.13})`;scene.style.transformOrigin=touch?'center 63%':`${16+Math.max(0,active)*24}% 63%`}
    if(active!==lastActive){lastActive=active;phases.forEach(el=>el.classList.toggle('visible',Number(el.dataset.phase)===active));route.forEach((el,i)=>el.classList.toggle('on',i<=active));if(current)current.textContent=active<0?'00':`0${active+1}`}
    if(touch&&currentProgress!==targetProgress)raf=requestAnimationFrame(render);
  }
  function update(){targetProgress=readProgress();if(!raf)raf=requestAnimationFrame(render)}
  addEventListener('scroll',update,{passive:true});
  addEventListener('resize',()=>{if(innerWidth===lastWidth)return;lastWidth=innerWidth;currentProgress=targetProgress=readProgress();update()},{passive:true});
  currentProgress=targetProgress=readProgress();render();
  document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>{const distance=Math.max(1,journey.offsetHeight-document.documentElement.clientHeight);scrollTo({top:journey.offsetTop+distance*(.22+Number(button.dataset.jump)*.22),behavior:'smooth'})}));
  const menu=document.querySelector('.cin-menu'),mobile=document.querySelector('.cin-mobile-nav');
  menu?.addEventListener('click',()=>{const open=mobile.hasAttribute('hidden');mobile.toggleAttribute('hidden',!open);menu.setAttribute('aria-expanded',String(open))});
})();
