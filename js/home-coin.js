import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const host=document.querySelector('[data-coin-stage]');
const finale=document.querySelector('[data-coin-finale]');
const progressBar=document.querySelector('.coin-progress span');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData=navigator.connection?.saveData;

if(!host||reduced||saveData){host?.setAttribute('hidden','');finale?.classList.add('is-live');}
else{
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x070707,.032);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);
  camera.position.set(0,.12,9.25);

  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xf4f1eb,0x111111,1.18));
  const key=new THREE.SpotLight(0xfff7ed,105,30,Math.PI/5,.52,1.15);key.position.set(-4.8,6.4,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const rim=new THREE.PointLight(0xe8c49f,34,18,2);rim.position.set(4.2,.2,4.8);scene.add(rim);
  const cool=new THREE.PointLight(0xc9d2dd,24,14,2);cool.position.set(-5,1,-2.5);scene.add(cool);

  const coin=new THREE.Group();scene.add(coin);
  const metal=new THREE.MeshStandardMaterial({color:0xc8c3ba,metalness:.98,roughness:.2});
  const edgeDark=new THREE.MeshStandardMaterial({color:0x262523,metalness:.86,roughness:.3});
  const profile=[];const radius=2.08,half=.23,round=.13;
  profile.push(new THREE.Vector2(0,-half),new THREE.Vector2(radius-round,-half));
  for(let i=0;i<=10;i++){const a=-Math.PI/2+(Math.PI/2)*(i/10);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,-half+round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(radius,half-round));
  for(let i=0;i<=10;i++){const a=(Math.PI/2)*(i/10);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,half-round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(0,half));
  const body=new THREE.Mesh(new THREE.LatheGeometry(profile,160),metal);body.rotation.x=Math.PI/2;body.castShadow=true;body.receiveShadow=true;coin.add(body);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(2.045,2.045,.31,160,1,true),edgeDark);band.rotation.x=Math.PI/2;coin.add(band);
  for(let i=-3;i<=3;i++){const groove=new THREE.Mesh(new THREE.TorusGeometry(2.055,.011,8,180),new THREE.MeshStandardMaterial({color:i%2?0x68645e:0xe1ddd5,metalness:1,roughness:.22}));groove.position.z=i*.045;coin.add(groove);}

  new THREE.TextureLoader().load('assets/images/logo.jpeg',(imgTex)=>{
    const img=imgTex.image,c=document.createElement('canvas');c.width=c.height=1024;
    const x=c.getContext('2d');x.clearRect(0,0,1024,1024);x.save();x.beginPath();x.arc(512,512,505,0,Math.PI*2);x.clip();
    const crop=.91,sw=img.width*crop,sh=img.height*crop,sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    x.drawImage(img,sx,sy,sw,sh,0,0,1024,1024);x.restore();
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    const faceMat=new THREE.MeshStandardMaterial({map:t,metalness:.18,roughness:.38});
    const faceGeo=new THREE.CircleGeometry(1.99,180);
    const front=new THREE.Mesh(faceGeo,faceMat);front.position.z=.235;front.castShadow=true;coin.add(front);
    const back=new THREE.Mesh(faceGeo,faceMat.clone());back.position.z=-.235;back.rotation.y=Math.PI;back.castShadow=true;coin.add(back);
    [1.83,1.49].forEach((r)=>{const m=new THREE.MeshStandardMaterial({color:0xeeeae2,metalness:.94,roughness:.23});const a=new THREE.Mesh(new THREE.TorusGeometry(r,.035,14,180),m);a.position.z=.248;coin.add(a);const b=a.clone();b.position.z=-.248;b.rotation.y=Math.PI;coin.add(b);});
  });

  const floorY=-2.22;
  const floorMat=new THREE.MeshStandardMaterial({color:0x090909,metalness:.08,roughness:.78});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(34,34),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=floorY;floor.receiveShadow=true;scene.add(floor);

  const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=128;
  const dc=dustCanvas.getContext('2d');const dg=dc.createRadialGradient(64,64,4,64,64,64);
  dg.addColorStop(0,'rgba(220,205,184,.72)');dg.addColorStop(.3,'rgba(164,142,115,.4)');dg.addColorStop(.72,'rgba(91,75,58,.13)');dg.addColorStop(1,'rgba(50,42,34,0)');dc.fillStyle=dg;dc.fillRect(0,0,128,128);
  const dustTexture=new THREE.CanvasTexture(dustCanvas);

  const spinDust=new THREE.Group();scene.add(spinDust);const spinDustSprites=[];
  for(let i=0;i<95;i++){
    const material=new THREE.SpriteMaterial({map:dustTexture,color:i%3===0?0xd0b999:0x8f765e,transparent:true,opacity:0,depthWrite:false});
    const sprite=new THREE.Sprite(material);const phase=Math.random();
    sprite.userData={phase,side:Math.random()<.5?-1:1,trail:.25+Math.random()*2.8,lift:.08+Math.random()*.55,depth:(Math.random()-.5)*.55,scale:.18+Math.random()*.55};
    spinDust.add(sprite);spinDustSprites.push(sprite);
  }

  const impactDust=new THREE.Group();scene.add(impactDust);const impactDustSprites=[];
  for(let i=0;i<260;i++){
    const material=new THREE.SpriteMaterial({map:dustTexture,color:i%4===0?0xd5c4ac:0x9c866d,transparent:true,opacity:0,depthWrite:false});
    const sprite=new THREE.Sprite(material);const angle=Math.random()*Math.PI*2;
    sprite.userData={angle,radial:.4+Math.random()*6.2,rise:.6+Math.random()*5.1,depth:(Math.random()-.5)*2.4,scale:.55+Math.random()*1.9,phase:Math.random()};
    impactDust.add(sprite);impactDustSprites.push(sprite);
  }

  const dirtMaterials=[new THREE.MeshStandardMaterial({color:0x5d5145,roughness:.98}),new THREE.MeshStandardMaterial({color:0x756656,roughness:.98}),new THREE.MeshStandardMaterial({color:0x37332e,roughness:.94})];
  const spinDebris=new THREE.Group();scene.add(spinDebris);const spinPieces=[];
  for(let i=0;i<34;i++){
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.025+Math.random()*.055,0),dirtMaterials[i%3]);
    rock.userData={phase:Math.random(),side:Math.random()<.5?-1:1,trail:.35+Math.random()*2.6,lift:.12+Math.random()*.72,spin:(Math.random()-.5)*9,scale:.45+Math.random()*.8};
    rock.scale.setScalar(0);rock.castShadow=true;spinDebris.add(rock);spinPieces.push(rock);
  }

  const impactDebris=new THREE.Group();scene.add(impactDebris);const impactPieces=[];
  for(let i=0;i<125;i++){
    const geo=i%3===0?new THREE.DodecahedronGeometry(.07+Math.random()*.15,0):new THREE.TetrahedronGeometry(.055+Math.random()*.13,0);
    const rock=new THREE.Mesh(geo,dirtMaterials[i%3]);const a=Math.random()*Math.PI*2;
    rock.userData={a,range:.8+Math.random()*6,lift:.35+Math.random()*2.8,spinX:(Math.random()-.5)*12,spinY:(Math.random()-.5)*12,spinZ:(Math.random()-.5)*12,baseScale:.6+Math.random()*1.5};
    rock.scale.setScalar(0);rock.castShadow=true;impactDebris.add(rock);impactPieces.push(rock);
  }

  const groundScatter=new THREE.Group();scene.add(groundScatter);
  for(let i=0;i<140;i++){
    const pebble=new THREE.Mesh(new THREE.DodecahedronGeometry(.025+Math.random()*.075,0),dirtMaterials[i%3]);
    const a=Math.random()*Math.PI*2,r=.8+Math.random()*5.8;
    pebble.position.set(Math.cos(a)*r,floorY+.04,Math.sin(a)*r*.34+.3);pebble.scale.y=.48;pebble.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);pebble.castShadow=true;groundScatter.add(pebble);
  }

  let scroll=0,target=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(t)=>t*t*(3-2*t);
  function updateScroll(){const max=document.documentElement.scrollHeight-innerHeight;target=max>0?scrollY/max:0;progressBar.style.height=`${target*100}%`;}
  function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();camera.position.z=host.clientWidth<760?10.35:9.25;}
  addEventListener('scroll',updateScroll,{passive:true});addEventListener('resize',resize);resize();updateScroll();

  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);clock.getDelta();scroll+=(target-scroll)*.06;
    const mobile=host.clientWidth<760;
    const spinPhase=clamp(scroll/.62,0,1);
    const tipPhase=smooth(clamp((scroll-.48)/.24,0,1));
    const impactPhase=smooth(clamp((scroll-.67)/.13,0,1));
    const settled=clamp((scroll-.80)/.08,0,1);
    const precession=spinPhase*Math.PI*6.2;
    const wobble=(1-tipPhase)*(.07+spinPhase*.06);
    const tilt=-.07-Math.sin(precession*.95)*wobble-((Math.PI/2)-.035)*tipPhase;

    coin.rotation.y=precession;
    coin.rotation.z=Math.sin(precession*.58)*wobble;
    coin.rotation.x=tilt;
    const verticalExtent=radius*Math.abs(Math.cos(tilt))+half*Math.abs(Math.sin(tilt));
    coin.position.x=Math.sin(precession*.2)*.18*(1-tipPhase);
    coin.position.y=floorY+verticalExtent+.01+Math.sin(tipPhase*Math.PI)*.08;
    coin.position.z=.05+tipPhase*.52;
    coin.scale.setScalar(mobile?.82:1.08);

    const contactX=coin.position.x+Math.sin(precession)*radius*.08*(1-tipPhase);
    const contactZ=coin.position.z+.08;
    const spinEnergy=(1-tipPhase)*(.35+.65*Math.abs(Math.sin(precession*.7)));
    spinDust.position.set(contactX,floorY+.06,contactZ);
    spinDustSprites.forEach((sprite)=>{
      const d=sprite.userData,p=(spinPhase*8+d.phase)%1,fade=Math.sin(p*Math.PI);
      sprite.position.set(-d.side*d.trail*p,d.lift*Math.sin(p*Math.PI)*.42,d.depth+d.side*p*.16);
      const s=d.scale*(.35+fade*.9);sprite.scale.set(s*1.8,s,1);
      sprite.material.opacity=spinEnergy*fade*(.08+d.phase*.18);
    });
    spinDebris.position.set(contactX,0,contactZ);
    spinPieces.forEach((rock)=>{
      const d=rock.userData,p=(spinPhase*7+d.phase)%1,fade=Math.sin(p*Math.PI);
      rock.position.set(-d.side*d.trail*p,floorY+.08+d.lift*Math.sin(p*Math.PI)-.55*p*p,d.side*p*.16);
      rock.rotation.set(d.spin*p,d.spin*.7*p,d.spin*.4*p);
      rock.scale.setScalar(Math.max(0,spinEnergy*fade*d.scale));
    });

    rim.intensity=31+Math.sin(clock.elapsedTime*1.4)*3;
    key.intensity=104+Math.sin(clock.elapsedTime*.65)*4;

    const life=Math.sin(clamp((impactPhase-.02)/.98,0,1)*Math.PI);
    impactDust.position.set(coin.position.x,floorY+.08,coin.position.z);
    impactDustSprites.forEach((sprite)=>{
      const d=sprite.userData,t=impactPhase,spread=d.radial*(.12+t*1.28);
      sprite.position.set(Math.cos(d.angle)*spread,d.rise*t-3.1*t*t,d.depth+Math.sin(d.angle)*spread*.28);
      const s=d.scale*(.18+life*1.95)*(1+d.phase*.5);sprite.scale.set(s*1.95,s,1);
      sprite.material.opacity=Math.pow(life,.58)*(.22+d.phase*.42);
      sprite.material.rotation=d.angle*.12+t*(d.phase-.5);
    });

    impactDebris.position.set(coin.position.x,0,coin.position.z);
    impactPieces.forEach((rock)=>{
      const d=rock.userData,t=impactPhase,horizontal=d.range*t;
      rock.position.set(Math.cos(d.a)*horizontal,floorY+.1+d.lift*t-3.35*t*t,Math.sin(d.a)*horizontal*.36);
      rock.rotation.set(d.spinX*t,d.spinY*t,d.spinZ*t);
      const visible=Math.sin(clamp(t*1.14,0,1)*Math.PI)*d.baseScale;rock.scale.setScalar(Math.max(0,visible));
    });

    groundScatter.visible=impactPhase>.06;
    if(settled>.25)finale?.classList.add('is-live');else finale?.classList.remove('is-live');
    renderer.render(scene,camera);
  }
  animate();
}