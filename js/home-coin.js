import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const host=document.querySelector('[data-coin-stage]');
const finale=document.querySelector('[data-coin-finale]');
const progressBar=document.querySelector('.coin-progress span');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData=navigator.connection?.saveData;

if(!host||reduced||saveData){host?.setAttribute('hidden','');finale?.classList.add('is-live');}
else{
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x080706,.04);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);
  camera.position.set(0,.2,9.25);

  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.28;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff4e9,0x210805,1.5));
  const key=new THREE.SpotLight(0xffead7,125,30,Math.PI/5,.5,1.15);key.position.set(-4.5,6.5,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const rim=new THREE.PointLight(0xff3a20,78,18,2);rim.position.set(4,-.5,4);scene.add(rim);
  const cool=new THREE.PointLight(0xbfd7ff,38,14,2);cool.position.set(-5,1,-2);scene.add(cool);

  const coin=new THREE.Group();scene.add(coin);
  const metal=new THREE.MeshStandardMaterial({color:0xb9b2a8,metalness:.99,roughness:.14});
  const edgeDark=new THREE.MeshStandardMaterial({color:0x24211e,metalness:.9,roughness:.2});
  const profile=[];const radius=2.08,half=.23,round=.13;
  profile.push(new THREE.Vector2(0,-half),new THREE.Vector2(radius-round,-half));
  for(let i=0;i<=8;i++){const a=-Math.PI/2+(Math.PI/2)*(i/8);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,-half+round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(radius,half-round));
  for(let i=0;i<=8;i++){const a=(Math.PI/2)*(i/8);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,half-round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(0,half));
  const body=new THREE.Mesh(new THREE.LatheGeometry(profile,128),metal);body.rotation.x=Math.PI/2;body.castShadow=true;body.receiveShadow=true;coin.add(body);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(2.045,2.045,.31,128,1,true),edgeDark);band.rotation.x=Math.PI/2;coin.add(band);
  for(let i=-3;i<=3;i++){const groove=new THREE.Mesh(new THREE.TorusGeometry(2.055,.012,8,160),new THREE.MeshStandardMaterial({color:i%2?0x55514b:0xd6d0c6,metalness:1,roughness:.18}));groove.position.z=i*.045;coin.add(groove);}

  new THREE.TextureLoader().load('assets/images/logo.jpeg',(imgTex)=>{
    const img=imgTex.image,c=document.createElement('canvas');c.width=c.height=1024;
    const x=c.getContext('2d');x.clearRect(0,0,1024,1024);x.save();x.beginPath();x.arc(512,512,505,0,Math.PI*2);x.clip();
    const crop=.91,sw=img.width*crop,sh=img.height*crop,sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    x.drawImage(img,sx,sy,sw,sh,0,0,1024,1024);x.restore();
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    const faceMat=new THREE.MeshStandardMaterial({map:t,metalness:.28,roughness:.31});
    const faceGeo=new THREE.CircleGeometry(1.99,160);
    const front=new THREE.Mesh(faceGeo,faceMat);front.position.z=.235;front.castShadow=true;coin.add(front);
    const back=new THREE.Mesh(faceGeo,faceMat.clone());back.position.z=-.235;back.rotation.y=Math.PI;back.castShadow=true;coin.add(back);
    [1.83,1.49].forEach((r)=>{const m=new THREE.MeshStandardMaterial({color:0xf0ebe1,metalness:.97,roughness:.16});const a=new THREE.Mesh(new THREE.TorusGeometry(r,.035,14,160),m);a.position.z=.248;coin.add(a);const b=a.clone();b.position.z=-.248;b.rotation.y=Math.PI;coin.add(b);});
  });

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(32,32),new THREE.MeshStandardMaterial({color:0x080706,metalness:.35,roughness:.38}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-2.22;floor.receiveShadow=true;scene.add(floor);

  // Sparks hug the ground and flare from the contact point as the coin spins.
  const sparkCount=520,sparkPos=new Float32Array(sparkCount*3),sparkSeed=[];
  for(let i=0;i<sparkCount;i++){
    const angle=(Math.random()-.5)*1.7,distance=.15+Math.random()*4.8;
    sparkSeed.push({angle,distance,lift:Math.random()*.55,phase:Math.random()*Math.PI*2,speed:.6+Math.random()*1.5});
  }
  const sparkGeo=new THREE.BufferGeometry();sparkGeo.setAttribute('position',new THREE.BufferAttribute(sparkPos,3));
  const sparkMat=new THREE.PointsMaterial({color:0xff6a2b,size:.055,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending});
  const sparks=new THREE.Points(sparkGeo,sparkMat);scene.add(sparks);

  // Large reversible dust cloud for the final impact.
  const dustCount=1300,dustBase=[],dustDir=[],dustPos=new Float32Array(dustCount*3);
  for(let i=0;i<dustCount;i++){
    const a=Math.random()*Math.PI*2,r=Math.pow(Math.random(),.65)*3.2;
    dustBase.push({x:Math.cos(a)*r*.35,y:-2.13,z:Math.sin(a)*r*.22});
    dustDir.push({x:Math.cos(a)*(1.4+Math.random()*4.5),y:1.2+Math.random()*4.8,z:Math.sin(a)*(.7+Math.random()*2.2),drag:.7+Math.random()*.7});
  }
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
  const dustMat=new THREE.PointsMaterial({color:0xd0ad84,size:.13,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending});
  const dust=new THREE.Points(dustGeo,dustMat);scene.add(dust);

  let scroll=0,target=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(t)=>t*t*(3-2*t);
  function updateScroll(){const max=document.documentElement.scrollHeight-innerHeight;target=max>0?scrollY/max:0;progressBar.style.height=`${target*100}%`;}
  function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();const mobile=host.clientWidth<760;camera.position.z=mobile?10.2:9.25;coin.scale.setScalar(mobile?.84:1.1);}
  addEventListener('scroll',updateScroll,{passive:true});addEventListener('resize',resize);resize();updateScroll();

  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033);scroll+=(target-scroll)*.075;
    const pre=clamp(scroll/.78,0,1),fallRaw=clamp((scroll-.78)/.17,0,1),fall=smooth(fallRaw),settle=clamp((scroll-.95)/.05,0,1);
    const spin=pre*Math.PI*18;
    coin.rotation.y=spin;
    coin.rotation.z=Math.sin(pre*Math.PI*6)*.1*(1-fall);
    coin.rotation.x=Math.sin(pre*Math.PI*8)*.12*(1-fall)+(-Math.PI/2)*fall;
    coin.position.x=Math.sin(pre*Math.PI*2.2)*.34*(1-fall);
    coin.position.y=.22+Math.sin(pre*Math.PI*5)*.12*(1-fall)-fall*2.05+Math.sin(fall*Math.PI)*.34;
    coin.position.z=fall*.85;
    coin.scale.setScalar((host.clientWidth<760?.84:1.1)*(1+Math.sin(pre*Math.PI)*.04));

    const sparkArr=sparks.geometry.attributes.position.array;
    const contactX=coin.position.x,contactY=-2.14,contactZ=coin.position.z-.1;
    const sparkStrength=(1-fall)*(.45+.55*Math.abs(Math.sin(spin*.55)));
    for(let i=0;i<sparkCount;i++){
      const s=sparkSeed[i],pulse=(clock.elapsedTime*s.speed+s.phase)%1;
      const spread=s.distance*pulse;
      sparkArr[i*3]=contactX-Math.cos(s.angle)*spread;
      sparkArr[i*3+1]=contactY+Math.sin(pulse*Math.PI)*s.lift*(1-pulse);
      sparkArr[i*3+2]=contactZ+Math.sin(s.angle)*spread*.35;
    }
    sparks.geometry.attributes.position.needsUpdate=true;
    sparkMat.opacity=.95*sparkStrength;
    sparkMat.size=.045+.045*sparkStrength;
    rim.intensity=72+Math.sin(clock.elapsedTime*2.2)*12;

    const impact=clamp((fallRaw-.5)/.5,0,1),life=Math.sin(impact*Math.PI);
    dustMat.opacity=Math.pow(life,.55)*1.0;
    dustMat.size=.12+.11*life;
    const arr=dust.geometry.attributes.position.array;
    for(let i=0;i<dustCount;i++){
      const b=dustBase[i],d=dustDir[i],t=impact;
      arr[i*3]=b.x+d.x*t*d.drag;
      arr[i*3+1]=b.y+d.y*t-3.25*t*t;
      arr[i*3+2]=b.z+d.z*t*d.drag;
    }
    dust.geometry.attributes.position.needsUpdate=true;
    if(fallRaw>.78||settle>0) finale?.classList.add('is-live'); else finale?.classList.remove('is-live');
    renderer.render(scene,camera);
  }
  animate();
}