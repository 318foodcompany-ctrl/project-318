import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const host=document.querySelector('[data-coin-stage]');
const finale=document.querySelector('[data-coin-finale]');
const progressBar=document.querySelector('.coin-progress span');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData=navigator.connection?.saveData;

if(!host||reduced||saveData){host?.setAttribute('hidden','');finale?.classList.add('is-live');}
else{
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x070707,.03);
  const camera=new THREE.PerspectiveCamera(36,1,.1,100);
  camera.position.set(0,.1,9.4);

  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.06;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xf3f0e9,0x111111,1.05));
  const key=new THREE.SpotLight(0xfff8ef,92,30,Math.PI/5,.58,1.2);key.position.set(-4.6,6.1,6.8);key.castShadow=true;key.shadow.mapSize.set(1536,1536);scene.add(key);
  const rim=new THREE.PointLight(0xe5d3bc,22,18,2);rim.position.set(4.3,.3,4.6);scene.add(rim);
  const cool=new THREE.PointLight(0xc8d0da,18,14,2);cool.position.set(-5,1,-2.4);scene.add(cool);

  function noiseTexture(size=512){
    const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
    const image=x.createImageData(size,size);
    for(let i=0;i<image.data.length;i+=4){const n=118+Math.random()*40;image.data[i]=image.data[i+1]=image.data[i+2]=n;image.data[i+3]=255;}
    x.putImageData(image,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);return t;
  }

  const micro=noiseTexture();
  const coin=new THREE.Group();scene.add(coin);
  const metal=new THREE.MeshStandardMaterial({color:0xc8c3bb,metalness:.96,roughness:.27,roughnessMap:micro,bumpMap:micro,bumpScale:.018});
  const edgeDark=new THREE.MeshStandardMaterial({color:0x292826,metalness:.82,roughness:.36,roughnessMap:micro,bumpMap:micro,bumpScale:.014});
  const profile=[];const radius=2.08,half=.23,round=.14;
  profile.push(new THREE.Vector2(0,-half),new THREE.Vector2(radius-round,-half));
  for(let i=0;i<=14;i++){const a=-Math.PI/2+(Math.PI/2)*(i/14);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,-half+round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(radius,half-round));
  for(let i=0;i<=14;i++){const a=(Math.PI/2)*(i/14);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,half-round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(0,half));
  const body=new THREE.Mesh(new THREE.LatheGeometry(profile,192),metal);body.rotation.x=Math.PI/2;body.castShadow=true;body.receiveShadow=true;coin.add(body);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(2.045,2.045,.31,192,1,true),edgeDark);band.rotation.x=Math.PI/2;band.castShadow=true;coin.add(band);
  for(let i=-4;i<=4;i++){const groove=new THREE.Mesh(new THREE.TorusGeometry(2.055,.009,8,200),new THREE.MeshStandardMaterial({color:i%2?0x625f5a:0xd9d5ce,metalness:.96,roughness:.27}));groove.position.z=i*.036;coin.add(groove);}

  new THREE.TextureLoader().load('assets/images/logo.jpeg',(imgTex)=>{
    const img=imgTex.image,c=document.createElement('canvas');c.width=c.height=1024;
    const x=c.getContext('2d');x.clearRect(0,0,1024,1024);x.save();x.beginPath();x.arc(512,512,505,0,Math.PI*2);x.clip();
    const crop=.91,sw=img.width*crop,sh=img.height*crop,sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    x.drawImage(img,sx,sy,sw,sh,0,0,1024,1024);x.restore();
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    const faceMat=new THREE.MeshStandardMaterial({map:t,metalness:.12,roughness:.43,roughnessMap:micro,bumpMap:micro,bumpScale:.01});
    const faceGeo=new THREE.CircleGeometry(1.99,192);
    const front=new THREE.Mesh(faceGeo,faceMat);front.position.z=.235;front.castShadow=true;coin.add(front);
    const back=new THREE.Mesh(faceGeo,faceMat.clone());back.position.z=-.235;back.rotation.y=Math.PI;back.castShadow=true;coin.add(back);
    [1.83,1.49].forEach((r)=>{const m=new THREE.MeshStandardMaterial({color:0xeeeae2,metalness:.92,roughness:.28});const a=new THREE.Mesh(new THREE.TorusGeometry(r,.032,16,192),m);a.position.z=.248;coin.add(a);const b=a.clone();b.position.z=-.248;b.rotation.y=Math.PI;coin.add(b);});
  });

  const floorY=-2.22;
  const floorNoise=noiseTexture(256);floorNoise.repeat.set(12,12);
  const floorMat=new THREE.MeshStandardMaterial({color:0x0a0908,metalness:.02,roughness:.92,roughnessMap:floorNoise,bumpMap:floorNoise,bumpScale:.035});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(34,34),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=floorY;floor.receiveShadow=true;scene.add(floor);

  const contactShadow=new THREE.Mesh(new THREE.CircleGeometry(2.5,96),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.44,depthWrite:false}));
  contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=floorY+.012;contactShadow.scale.set(1,.38,1);scene.add(contactShadow);

  const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=128;
  const dc=dustCanvas.getContext('2d');const dg=dc.createRadialGradient(64,64,3,64,64,64);
  dg.addColorStop(0,'rgba(223,208,188,.62)');dg.addColorStop(.28,'rgba(159,139,116,.34)');dg.addColorStop(.72,'rgba(88,73,58,.11)');dg.addColorStop(1,'rgba(45,38,32,0)');dc.fillStyle=dg;dc.fillRect(0,0,128,128);
  const dustTexture=new THREE.CanvasTexture(dustCanvas);

  const spinDust=new THREE.Group();scene.add(spinDust);const spinDustSprites=[];
  for(let i=0;i<72;i++){
    const material=new THREE.SpriteMaterial({map:dustTexture,color:i%3===0?0xc8b293:0x88715b,transparent:true,opacity:0,depthWrite:false});
    const sprite=new THREE.Sprite(material);const phase=Math.random();
    sprite.userData={phase,side:Math.random()<.5?-1:1,trail:.2+Math.random()*2.3,lift:.04+Math.random()*.34,depth:(Math.random()-.5)*.5,scale:.16+Math.random()*.44};
    spinDust.add(sprite);spinDustSprites.push(sprite);
  }

  const impactDust=new THREE.Group();scene.add(impactDust);const impactDustSprites=[];
  for(let i=0;i<230;i++){
    const material=new THREE.SpriteMaterial({map:dustTexture,color:i%5===0?0xd2c0a6:0x947e67,transparent:true,opacity:0,depthWrite:false});
    const sprite=new THREE.Sprite(material);const angle=Math.random()*Math.PI*2;
    sprite.userData={angle,radial:.45+Math.random()*5.8,rise:.55+Math.random()*4.4,depth:(Math.random()-.5)*2.2,scale:.5+Math.random()*1.65,phase:Math.random()};
    impactDust.add(sprite);impactDustSprites.push(sprite);
  }

  const dirtMaterials=[new THREE.MeshStandardMaterial({color:0x554a40,roughness:.99}),new THREE.MeshStandardMaterial({color:0x6f6050,roughness:.99}),new THREE.MeshStandardMaterial({color:0x34312d,roughness:.96})];
  const spinDebris=new THREE.Group();scene.add(spinDebris);const spinPieces=[];
  for(let i=0;i<24;i++){
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.022+Math.random()*.05,0),dirtMaterials[i%3]);
    rock.userData={phase:Math.random(),side:Math.random()<.5?-1:1,trail:.25+Math.random()*2.1,lift:.08+Math.random()*.45,spin:(Math.random()-.5)*8,scale:.4+Math.random()*.65};
    rock.scale.setScalar(0);rock.castShadow=true;spinDebris.add(rock);spinPieces.push(rock);
  }

  const impactDebris=new THREE.Group();scene.add(impactDebris);const impactPieces=[];
  for(let i=0;i<96;i++){
    const geo=i%3===0?new THREE.DodecahedronGeometry(.06+Math.random()*.12,0):new THREE.TetrahedronGeometry(.05+Math.random()*.11,0);
    const rock=new THREE.Mesh(geo,dirtMaterials[i%3]);const a=Math.random()*Math.PI*2;
    rock.userData={a,range:.75+Math.random()*5.4,lift:.28+Math.random()*2.25,spinX:(Math.random()-.5)*11,spinY:(Math.random()-.5)*11,spinZ:(Math.random()-.5)*11,baseScale:.55+Math.random()*1.25};
    rock.scale.setScalar(0);rock.castShadow=true;impactDebris.add(rock);impactPieces.push(rock);
  }

  const groundScatter=new THREE.Group();scene.add(groundScatter);
  for(let i=0;i<105;i++){
    const pebble=new THREE.Mesh(new THREE.DodecahedronGeometry(.02+Math.random()*.06,0),dirtMaterials[i%3]);
    const a=Math.random()*Math.PI*2,r=.75+Math.random()*5.2;
    pebble.position.set(Math.cos(a)*r,floorY+.035,Math.sin(a)*r*.32+.3);pebble.scale.y=.45;pebble.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);pebble.castShadow=true;groundScatter.add(pebble);
  }

  let scroll=0,target=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(t)=>t*t*(3-2*t);
  const easeOut=(t)=>1-Math.pow(1-t,3);
  function updateScroll(){const max=document.documentElement.scrollHeight-innerHeight;target=max>0?scrollY/max:0;progressBar.style.height=`${target*100}%`;}
  function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();camera.position.z=host.clientWidth<760?10.35:9.4;}
  addEventListener('scroll',updateScroll,{passive:true});addEventListener('resize',resize);resize();updateScroll();

  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);clock.getDelta();scroll+=(target-scroll)*.055;
    const mobile=host.clientWidth<760;
    const spinPhase=clamp(scroll/.64,0,1);
    const tipRaw=clamp((scroll-.5)/.23,0,1);
    const tipPhase=smooth(tipRaw);
    const impactRaw=clamp((scroll-.69)/.11,0,1);
    const impactPhase=smooth(impactRaw);
    const settled=clamp((scroll-.8)/.08,0,1);

    const decay=1-.72*spinPhase;
    const precession=spinPhase*Math.PI*5.15;
    const wobbleAmp=(.045+.09*spinPhase)*(1-tipPhase);
    const wobble=Math.sin(precession*1.08)*wobbleAmp;
    const tilt=-.055-wobble-((Math.PI/2)-.028)*tipPhase;

    coin.rotation.y=precession;
    coin.rotation.z=Math.sin(precession*.62)*wobbleAmp*.72;
    coin.rotation.x=tilt;
    const verticalExtent=radius*Math.abs(Math.cos(tilt))+half*Math.abs(Math.sin(tilt));
    coin.position.x=Math.sin(precession*.18)*.13*(1-tipPhase);
    coin.position.y=floorY+verticalExtent+.008+Math.sin(tipPhase*Math.PI)*.065;
    coin.position.z=.04+tipPhase*.5;
    coin.scale.setScalar(mobile?.82:1.08);

    contactShadow.position.x=coin.position.x;contactShadow.position.z=coin.position.z+.08;
    contactShadow.scale.set(1.15+.42*tipPhase,.28+.75*tipPhase,1);
    contactShadow.material.opacity=.4+.18*tipPhase;

    const contactX=coin.position.x+Math.sin(precession)*radius*.065*(1-tipPhase);
    const contactZ=coin.position.z+.06;
    const spinEnergy=(1-tipPhase)*(.22+.78*decay);
    spinDust.position.set(contactX,floorY+.05,contactZ);
    spinDustSprites.forEach((sprite)=>{
      const d=sprite.userData,p=(spinPhase*6.5+d.phase)%1,fade=Math.sin(p*Math.PI);
      sprite.position.set(-d.side*d.trail*p,d.lift*Math.sin(p*Math.PI)*.35,d.depth+d.side*p*.12);
      const s=d.scale*(.28+fade*.72);sprite.scale.set(s*1.65,s,1);
      sprite.material.opacity=spinEnergy*fade*(.05+d.phase*.12);
    });
    spinDebris.position.set(contactX,0,contactZ);
    spinPieces.forEach((rock)=>{
      const d=rock.userData,p=(spinPhase*5.8+d.phase)%1,fade=Math.sin(p*Math.PI);
      rock.position.set(-d.side*d.trail*p,floorY+.06+d.lift*Math.sin(p*Math.PI)-.46*p*p,d.side*p*.12);
      rock.rotation.set(d.spin*p,d.spin*.65*p,d.spin*.35*p);
      rock.scale.setScalar(Math.max(0,spinEnergy*fade*d.scale));
    });

    rim.intensity=21+Math.sin(clock.elapsedTime*1.2)*2;
    key.intensity=91+Math.sin(clock.elapsedTime*.55)*3;

    const life=Math.sin(clamp((impactPhase-.015)/.985,0,1)*Math.PI);
    impactDust.position.set(coin.position.x,floorY+.07,coin.position.z);
    impactDustSprites.forEach((sprite)=>{
      const d=sprite.userData,t=impactPhase,spread=d.radial*(.1+easeOut(t)*1.22);
      sprite.position.set(Math.cos(d.angle)*spread,d.rise*t-3.05*t*t,d.depth+Math.sin(d.angle)*spread*.27);
      const s=d.scale*(.16+life*1.72)*(1+d.phase*.4);sprite.scale.set(s*1.85,s,1);
      sprite.material.opacity=Math.pow(life,.62)*(.16+d.phase*.32);
      sprite.material.rotation=d.angle*.1+t*(d.phase-.5);
    });

    impactDebris.position.set(coin.position.x,0,coin.position.z);
    impactPieces.forEach((rock)=>{
      const d=rock.userData,t=impactPhase,horizontal=d.range*easeOut(t);
      rock.position.set(Math.cos(d.a)*horizontal,floorY+.08+d.lift*t-3.15*t*t,Math.sin(d.a)*horizontal*.34);
      rock.rotation.set(d.spinX*t,d.spinY*t,d.spinZ*t);
      const visible=Math.sin(clamp(t*1.12,0,1)*Math.PI)*d.baseScale;rock.scale.setScalar(Math.max(0,visible));
    });

    groundScatter.visible=impactPhase>.05;
    if(settled>.25)finale?.classList.add('is-live');else finale?.classList.remove('is-live');
    renderer.render(scene,camera);
  }
  animate();
}
