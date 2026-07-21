import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const host=document.querySelector('[data-coin-stage]');
const finale=document.querySelector('[data-coin-finale]');
const progressBar=document.querySelector('.coin-progress span');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData=navigator.connection?.saveData;

if(!host||reduced||saveData){host?.setAttribute('hidden','');finale?.classList.add('is-live');}
else{
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x080706,.035);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);
  camera.position.set(0,.15,9.2);

  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.3;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff1df,0x1b0905,1.35));
  const key=new THREE.SpotLight(0xffead7,135,30,Math.PI/5,.48,1.1);key.position.set(-4.7,6.8,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const rim=new THREE.PointLight(0xff321d,82,18,2);rim.position.set(4,-.3,4);scene.add(rim);
  const cool=new THREE.PointLight(0xc8dcff,34,14,2);cool.position.set(-5,1,-2);scene.add(cool);

  const coin=new THREE.Group();scene.add(coin);
  const metal=new THREE.MeshStandardMaterial({color:0xbcb5ab,metalness:.99,roughness:.13});
  const edgeDark=new THREE.MeshStandardMaterial({color:0x211e1b,metalness:.9,roughness:.2});
  const profile=[];const radius=2.08,half=.23,round=.13;
  profile.push(new THREE.Vector2(0,-half),new THREE.Vector2(radius-round,-half));
  for(let i=0;i<=10;i++){const a=-Math.PI/2+(Math.PI/2)*(i/10);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,-half+round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(radius,half-round));
  for(let i=0;i<=10;i++){const a=(Math.PI/2)*(i/10);profile.push(new THREE.Vector2(radius-round+Math.cos(a)*round,half-round+Math.sin(a)*round));}
  profile.push(new THREE.Vector2(0,half));
  const body=new THREE.Mesh(new THREE.LatheGeometry(profile,160),metal);body.rotation.x=Math.PI/2;body.castShadow=true;body.receiveShadow=true;coin.add(body);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(2.045,2.045,.31,160,1,true),edgeDark);band.rotation.x=Math.PI/2;coin.add(band);
  for(let i=-3;i<=3;i++){const groove=new THREE.Mesh(new THREE.TorusGeometry(2.055,.011,8,180),new THREE.MeshStandardMaterial({color:i%2?0x5c5750:0xd8d2c8,metalness:1,roughness:.16}));groove.position.z=i*.045;coin.add(groove);}

  new THREE.TextureLoader().load('assets/images/logo.jpeg',(imgTex)=>{
    const img=imgTex.image,c=document.createElement('canvas');c.width=c.height=1024;
    const x=c.getContext('2d');x.clearRect(0,0,1024,1024);x.save();x.beginPath();x.arc(512,512,505,0,Math.PI*2);x.clip();
    const crop=.91,sw=img.width*crop,sh=img.height*crop,sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    x.drawImage(img,sx,sy,sw,sh,0,0,1024,1024);x.restore();
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    const faceMat=new THREE.MeshStandardMaterial({map:t,metalness:.28,roughness:.29});
    const faceGeo=new THREE.CircleGeometry(1.99,180);
    const front=new THREE.Mesh(faceGeo,faceMat);front.position.z=.235;front.castShadow=true;coin.add(front);
    const back=new THREE.Mesh(faceGeo,faceMat.clone());back.position.z=-.235;back.rotation.y=Math.PI;back.castShadow=true;coin.add(back);
    [1.83,1.49].forEach((r)=>{const m=new THREE.MeshStandardMaterial({color:0xf0ebe1,metalness:.97,roughness:.15});const a=new THREE.Mesh(new THREE.TorusGeometry(r,.035,14,180),m);a.position.z=.248;coin.add(a);const b=a.clone();b.position.z=-.248;b.rotation.y=Math.PI;coin.add(b);});
  });

  const floorMat=new THREE.MeshStandardMaterial({color:0x090705,metalness:.12,roughness:.68});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(34,34,1,1),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-2.22;floor.receiveShadow=true;scene.add(floor);

  // Soft dust texture, used on layered transparent sprites rather than pixel points.
  const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=128;
  const dc=dustCanvas.getContext('2d');const dg=dc.createRadialGradient(64,64,4,64,64,64);
  dg.addColorStop(0,'rgba(225,191,150,.82)');dg.addColorStop(.28,'rgba(186,139,96,.46)');dg.addColorStop(.72,'rgba(110,72,44,.16)');dg.addColorStop(1,'rgba(60,34,20,0)');dc.fillStyle=dg;dc.fillRect(0,0,128,128);
  const dustTexture=new THREE.CanvasTexture(dustCanvas);
  const dustCloud=new THREE.Group();scene.add(dustCloud);
  const dustSprites=[];
  for(let i=0;i<190;i++){
    const material=new THREE.SpriteMaterial({map:dustTexture,color:i%4===0?0xd7b58d:0xa77b55,transparent:true,opacity:0,depthWrite:false});
    const sprite=new THREE.Sprite(material);
    const angle=Math.random()*Math.PI*2;
    sprite.userData={angle,radial:.3+Math.random()*4.7,rise:.5+Math.random()*3.8,depth:(Math.random()-.5)*1.8,scale:.45+Math.random()*1.45,phase:Math.random()};
    dustCloud.add(sprite);dustSprites.push(sprite);
  }

  // Physical dirt and stone fragments used for the impact, matching the reference instead of glowing sparks.
  const debris=new THREE.Group();scene.add(debris);
  const debrisPieces=[];
  const dirtMaterials=[
    new THREE.MeshStandardMaterial({color:0x6b4932,roughness:.94,metalness:0}),
    new THREE.MeshStandardMaterial({color:0x8b6243,roughness:.96,metalness:0}),
    new THREE.MeshStandardMaterial({color:0x3d3027,roughness:.9,metalness:.02})
  ];
  for(let i=0;i<86;i++){
    const geo=i%3===0?new THREE.DodecahedronGeometry(.07+Math.random()*.13,0):new THREE.TetrahedronGeometry(.055+Math.random()*.11,0);
    const rock=new THREE.Mesh(geo,dirtMaterials[i%3]);
    const a=Math.random()*Math.PI*2;
    rock.userData={a,range:.65+Math.random()*4.6,lift:.25+Math.random()*2.1,spinX:(Math.random()-.5)*10,spinY:(Math.random()-.5)*10,spinZ:(Math.random()-.5)*10,baseScale:.55+Math.random()*1.35};
    rock.scale.setScalar(0);rock.castShadow=true;debris.add(rock);debrisPieces.push(rock);
  }

  const groundScatter=new THREE.Group();scene.add(groundScatter);
  for(let i=0;i<95;i++){
    const pebble=new THREE.Mesh(new THREE.DodecahedronGeometry(.025+Math.random()*.065,0),dirtMaterials[i%3]);
    const a=Math.random()*Math.PI*2,r=.8+Math.random()*4.8;
    pebble.position.set(Math.cos(a)*r,-2.18,Math.sin(a)*r*.34+.3);pebble.scale.y=.5;pebble.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);pebble.castShadow=true;groundScatter.add(pebble);
  }

  let scroll=0,target=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(t)=>t*t*(3-2*t);
  function updateScroll(){const max=document.documentElement.scrollHeight-innerHeight;target=max>0?scrollY/max:0;progressBar.style.height=`${target*100}%`;}
  function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();const mobile=host.clientWidth<760;camera.position.z=mobile?10.35:9.2;}
  addEventListener('scroll',updateScroll,{passive:true});addEventListener('resize',resize);resize();updateScroll();

  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);clock.getDelta();scroll+=(target-scroll)*.075;
    const mobile=host.clientWidth<760;
    const spinPhase=clamp(scroll/.53,0,1);
    const tipPhase=smooth(clamp((scroll-.38)/.24,0,1));
    const impactPhase=smooth(clamp((scroll-.57)/.16,0,1));
    const settled=clamp((scroll-.73)/.1,0,1);
    const spin=spinPhase*Math.PI*20;

    coin.rotation.y=spin;
    coin.rotation.z=Math.sin(spinPhase*Math.PI*8)*.085*(1-tipPhase);
    coin.rotation.x=-.04+(Math.sin(spinPhase*Math.PI*7)*.08)*(1-tipPhase)+(-Math.PI/2+.035)*tipPhase;
    coin.position.x=Math.sin(spinPhase*Math.PI*2.1)*.28*(1-tipPhase);
    coin.position.y=.08-tipPhase*1.98+Math.sin(tipPhase*Math.PI)*.42;
    coin.position.z=.05+tipPhase*.55;
    const baseScale=mobile?.82:1.08;
    coin.scale.setScalar(baseScale*(1+Math.sin(spinPhase*Math.PI)*.035));

    rim.intensity=76+Math.sin(clock.elapsedTime*1.7)*9;
    key.intensity=128+Math.sin(clock.elapsedTime*.8)*7;

    const life=Math.sin(clamp((impactPhase-.04)/.96,0,1)*Math.PI);
    dustCloud.position.set(coin.position.x,-2.08,coin.position.z);
    dustSprites.forEach((sprite)=>{
      const d=sprite.userData;
      const t=impactPhase;
      const spread=d.radial*(.18+t*1.15);
      sprite.position.set(Math.cos(d.angle)*spread,d.rise*t-2.7*t*t,d.depth+Math.sin(d.angle)*spread*.24);
      const s=d.scale*(.25+life*1.5)*(1+d.phase*.45);sprite.scale.set(s*1.7,s,1);
      sprite.material.opacity=Math.pow(life,.72)*(.18+d.phase*.34);
      sprite.material.rotation=d.angle*.15+t*(d.phase-.5);
    });

    debris.position.set(coin.position.x,0,coin.position.z);
    debrisPieces.forEach((rock)=>{
      const d=rock.userData,t=impactPhase;
      const horizontal=d.range*(t*.9);
      rock.position.set(Math.cos(d.a)*horizontal,-2.12+d.lift*t-3.05*t*t,Math.sin(d.a)*horizontal*.32);
      rock.rotation.set(d.spinX*t,d.spinY*t,d.spinZ*t);
      const visible=Math.sin(clamp(t*1.18,0,1)*Math.PI)*d.baseScale;
      rock.scale.setScalar(Math.max(0,visible));
    });

    groundScatter.visible=impactPhase>.08;
    if(settled>.25)finale?.classList.add('is-live');else finale?.classList.remove('is-live');
    renderer.render(scene,camera);
  }
  animate();
}