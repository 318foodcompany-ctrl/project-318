const sceneHost=document.querySelector("[data-scene]");
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
const weakDevice=(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||innerWidth<640;
let renderer,scene,camera,table,food,raf=0,visible=true;

async function start(){
  if(reduced||weakDevice||!sceneHost||!window.WebGLRenderingContext)return;
  try{
    const THREE=await import("https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js");
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);
    camera.position.set(0,4.2,10);
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:devicePixelRatio<2,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
    sceneHost.append(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffddaa,1.7));
    const key=new THREE.PointLight(0xff9a4a,85,24);key.position.set(-3,6,4);scene.add(key);
    const rim=new THREE.PointLight(0xff2a18,55,20);rim.position.set(6,1,-3);scene.add(rim);
    table=new THREE.Group();scene.add(table);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(5.2,5.2,.28,64),new THREE.MeshStandardMaterial({color:0x4b160f,roughness:.35,metalness:.08}));top.scale.z=.55;table.add(top);
    food=new THREE.Group();table.add(food);
    const colors=[0xd9471d,0xefb63d,0x628b31,0xf5e1a4,0x8e2719];
    for(let i=0;i<22;i++){const a=(i/22)*Math.PI*2,r=1.2+(i%4)*.62;const mesh=new THREE.Mesh(new THREE.SphereGeometry(.22+(i%3)*.06,18,12),new THREE.MeshStandardMaterial({color:colors[i%colors.length],roughness:.65}));mesh.position.set(Math.cos(a)*r,.32+Math.sin(i)*.08,Math.sin(a)*r*.55);mesh.scale.y=.55;food.add(mesh)}
    const plateMat=new THREE.MeshStandardMaterial({color:0xfff4d8,roughness:.22});
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const plate=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.07,36),plateMat);plate.position.set(Math.cos(a)*3.75,.25,Math.sin(a)*2.05);table.add(plate)}
    table.rotation.x=.14;table.rotation.z=-.08;sceneHost.classList.add("ready");
    render();
  }catch(error){sceneHost.dataset.fallback="true"}
}
function render(){if(!renderer||!visible)return;const t=performance.now()*.00045;food.rotation.y=t;food.children.forEach((item,i)=>item.position.y=.34+Math.sin(t*3+i)*.06);renderer.render(scene,camera);raf=requestAnimationFrame(render)}
function sync(){if(!camera||!table)return;const p=scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);camera.position.x=Math.sin(p*Math.PI*1.25)*2.5;camera.position.y=4.2-p*1.4;camera.lookAt(0,0,0);table.rotation.y=p*Math.PI*1.45}
addEventListener("scroll",sync,{passive:true});addEventListener("resize",()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
document.addEventListener("visibilitychange",()=>{visible=!document.hidden;if(visible&&!raf)render();else if(!visible){cancelAnimationFrame(raf);raf=0}});
const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);if(visible&&!raf)render();else if(!visible){cancelAnimationFrame(raf);raf=0}},{threshold:.01});observer.observe(document.querySelector("main"));
if("requestIdleCallback" in window)requestIdleCallback(start,{timeout:1800});else setTimeout(start,450);
