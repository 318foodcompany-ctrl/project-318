import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const host=document.querySelector('[data-coin-stage]');
const finale=document.querySelector('[data-coin-finale]');
const progressBar=document.querySelector('.coin-progress span');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData=navigator.connection?.saveData;
if(!host||reduced||saveData){host?.setAttribute('hidden','');finale?.classList.add('is-live');}
else{
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x080706,.055);
 const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,.35,9.2);
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.prepend(renderer.domElement);
 const ambient=new THREE.HemisphereLight(0xffffff,0x2b0b05,1.7);scene.add(ambient);
 const key=new THREE.SpotLight(0xffefe0,80,30,Math.PI/5,.45,1.2);key.position.set(-4,6,6);key.castShadow=true;scene.add(key);
 const rim=new THREE.PointLight(0xff321f,45,18,2);rim.position.set(5,-1,4);scene.add(rim);
 const coin=new THREE.Group();scene.add(coin);
 const edgeMat=new THREE.MeshStandardMaterial({color:0x77736d,metalness:.96,roughness:.22});
 const darkMat=new THREE.MeshStandardMaterial({color:0x111111,metalness:.7,roughness:.34});
 const body=new THREE.Mesh(new THREE.CylinderGeometry(2.08,2.08,.34,96,1,false),[edgeMat,darkMat,darkMat]);body.rotation.x=Math.PI/2;body.castShadow=true;body.receiveShadow=true;coin.add(body);
 const ring1=new THREE.Mesh(new THREE.TorusGeometry(1.84,.045,16,120),new THREE.MeshStandardMaterial({color:0xd8d4ca,metalness:.9,roughness:.25}));ring1.position.z=.19;coin.add(ring1);
 const ring2=ring1.clone();ring2.scale.setScalar(.78);coin.add(ring2);
 const loader=new THREE.TextureLoader();
 loader.load('assets/images/logo.jpeg',(imgTex)=>{
   const img=imgTex.image;const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');
   x.clearRect(0,0,1024,1024);x.save();x.beginPath();x.arc(512,512,500,0,Math.PI*2);x.clip();
   const crop=.91;const sw=img.width*crop,sh=img.height*crop;const sx=(img.width-sw)/2,sy=(img.height-sh)/2;x.drawImage(img,sx,sy,sw,sh,0,0,1024,1024);x.restore();
   const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
   const face=new THREE.Mesh(new THREE.CircleGeometry(2.01,128),new THREE.MeshStandardMaterial({map:t,metalness:.35,roughness:.42}));face.position.z=.185;face.castShadow=true;coin.add(face);
 });
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x090806,metalness:.12,roughness:.58}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.28;floor.receiveShadow=true;scene.add(floor);
 const dustCount=420;const dustGeo=new THREE.BufferGeometry();const pos=new Float32Array(dustCount*3);const vel=[];
 for(let i=0;i<dustCount;i++){pos[i*3]=(Math.random()-.5)*4;pos[i*3+1]=-2.15;pos[i*3+2]=(Math.random()-.5)*2.2;vel.push({x:(Math.random()-.5)*.045,y:.01+Math.random()*.045,z:(Math.random()-.5)*.035});}
 dustGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xc9aa83,size:.055,transparent:true,opacity:0,depthWrite:false}));scene.add(dust);
 const sparksGeo=new THREE.BufferGeometry();const sp=new Float32Array(180*3);for(let i=0;i<180;i++){sp[i*3]=(Math.random()-.5)*16;sp[i*3+1]=(Math.random()-.5)*10;sp[i*3+2]=-Math.random()*8;}sparksGeo.setAttribute('position',new THREE.BufferAttribute(sp,3));const sparks=new THREE.Points(sparksGeo,new THREE.PointsMaterial({color:0xff4b2f,size:.025,transparent:true,opacity:.5,depthWrite:false}));scene.add(sparks);
 let scroll=0,target=0,last=0,dustTriggered=false;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function updateScroll(){const max=document.documentElement.scrollHeight-innerHeight;target=max>0?scrollY/max:0;progressBar.style.height=`${target*100}%`;}
 function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();const mobile=host.clientWidth<760;camera.position.z=mobile?10.8:9.2;coin.scale.setScalar(mobile?.82:1);}
 addEventListener('scroll',updateScroll,{passive:true});addEventListener('resize',resize);resize();updateScroll();
 const clock=new THREE.Clock();
 function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033);scroll+=(target-scroll)*.065;
   const fall=clamp((scroll-.82)/.18,0,1);const spin=scroll*Math.PI*14;
   coin.rotation.y=spin*(1-fall*.68);coin.rotation.x=Math.sin(scroll*Math.PI*8)*.13*(1-fall)+(-Math.PI/2)*fall;coin.rotation.z=Math.sin(scroll*Math.PI*5)*.09*(1-fall);
   coin.position.y=.25-Math.sin(scroll*Math.PI*5)*.16*(1-fall)-fall*1.62;coin.position.x=Math.sin(scroll*Math.PI*2)*.4*(1-fall);coin.position.z=fall*.7;
   rim.intensity=45+Math.sin(clock.elapsedTime*1.8)*8;sparks.rotation.y+=dt*.018;
   if(fall>.72&&!dustTriggered){dustTriggered=true;dust.material.opacity=.9;finale?.classList.add('is-live');}
   if(dustTriggered){const a=dust.geometry.attributes.position.array;for(let i=0;i<dustCount;i++){a[i*3]+=vel[i].x;a[i*3+1]+=vel[i].y;a[i*3+2]+=vel[i].z;vel[i].y-=.0007;if(a[i*3+1]<-2.2){a[i*3+1]=-2.15;vel[i].y*=.15;}}dust.geometry.attributes.position.needsUpdate=true;dust.material.opacity=Math.max(0,dust.material.opacity-dt*.12);}
   renderer.render(scene,camera);last=scroll;
 }
 animate();
}
