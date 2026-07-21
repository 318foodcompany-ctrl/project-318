import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const host = document.querySelector('[data-webgl-food]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection?.saveData;

if (host && !saveData) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.35, 8.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.scale.y = 0.34;
  shadow.position.set(0, -2.05, -0.7);
  shadow.rotation.x = -Math.PI / 2;
  world.add(shadow);

  const pizza = new THREE.Group();
  pizza.rotation.set(-0.83, 0.08, -0.14);
  pizza.position.set(0.3, -0.05, 0);
  world.add(pizza);

  const crustMaterial = new THREE.MeshStandardMaterial({ color: 0xc36f2d, roughness: 0.72, metalness: 0.02 });
  const crustInnerMaterial = new THREE.MeshStandardMaterial({ color: 0xe3a35f, roughness: 0.78 });
  const sauceMaterial = new THREE.MeshStandardMaterial({ color: 0xa71912, roughness: 0.72 });
  const cheeseMaterial = new THREE.MeshStandardMaterial({ color: 0xffcf69, roughness: 0.56 });
  const pepperoniMaterial = new THREE.MeshStandardMaterial({ color: 0x9c1e17, roughness: 0.63 });
  const basilMaterial = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.68, side: THREE.DoubleSide });

  const crust = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.42, 0.36, 72), crustMaterial);
  crust.castShadow = true;
  crust.receiveShadow = true;
  pizza.add(crust);

  const inner = new THREE.Mesh(new THREE.CylinderGeometry(2.28, 2.25, 0.39, 72), crustInnerMaterial);
  inner.position.y = 0.06;
  pizza.add(inner);

  const sauce = new THREE.Mesh(new THREE.CylinderGeometry(2.18, 2.15, 0.08, 72), sauceMaterial);
  sauce.position.y = 0.275;
  pizza.add(sauce);

  const cheese = new THREE.Mesh(new THREE.CylinderGeometry(2.08, 2.04, 0.09, 72), cheeseMaterial);
  cheese.position.y = 0.34;
  pizza.add(cheese);

  const toppings = [
    [-1.05, 0.75, 0.00], [-0.2, 1.15, 0.14], [0.82, 0.92, -0.16], [1.22, 0.15, 0.2],
    [0.48, -0.7, -0.12], [-0.62, -0.82, 0.17], [-1.28, -0.08, -0.14], [0.05, 0.2, 0.08]
  ];

  toppings.forEach(([x, z, rotation], index) => {
    const pepperoni = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.055, 28), pepperoniMaterial);
    pepperoni.position.set(x, 0.43 + (index % 2) * 0.015, z);
    pepperoni.rotation.y = rotation;
    pepperoni.castShadow = true;
    pizza.add(pepperoni);
  });

  [[-0.55, 0.52, 0.5], [0.62, 0.32, -0.8], [0.02, -1.0, 0.2]].forEach(([x, z, r]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 10), basilMaterial);
    leaf.scale.set(1.45, 0.08, 0.62);
    leaf.position.set(x, 0.5, z);
    leaf.rotation.y = r;
    pizza.add(leaf);
  });

  const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xff4a3d, emissive: 0x3a0502, roughness: 0.38, metalness: 0.25 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.035, 12, 160), ringMaterial);
  ring.rotation.x = 1.12;
  ring.rotation.z = -0.35;
  world.add(ring);

  const ingredientGroup = new THREE.Group();
  world.add(ingredientGroup);

  const tomatoMaterial = new THREE.MeshStandardMaterial({ color: 0xe13b2d, roughness: 0.58 });
  const cheeseCubeMaterial = new THREE.MeshStandardMaterial({ color: 0xffd575, roughness: 0.5 });
  const oliveMaterial = new THREE.MeshStandardMaterial({ color: 0x2d211a, roughness: 0.62 });

  for (let i = 0; i < 24; i += 1) {
    let mesh;
    if (i % 3 === 0) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13 + Math.random() * 0.08, 16, 12), tomatoMaterial);
    } else if (i % 3 === 1) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), cheeseCubeMaterial);
    } else {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 18), oliveMaterial);
    }
    const angle = (i / 24) * Math.PI * 2;
    const radius = 3.05 + Math.random() * 1.25;
    mesh.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 4.8, Math.sin(angle) * radius * 0.48);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.userData.speed = 0.22 + Math.random() * 0.55;
    mesh.userData.offset = Math.random() * Math.PI * 2;
    mesh.castShadow = true;
    ingredientGroup.add(mesh);
  }

  const glowMaterial = new THREE.PointsMaterial({ color: 0xff8a52, size: 0.045, transparent: true, opacity: 0.65, depthWrite: false });
  const glowGeometry = new THREE.BufferGeometry();
  const points = [];
  for (let i = 0; i < 180; i += 1) {
    points.push((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4);
  }
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const glow = new THREE.Points(glowGeometry, glowMaterial);
  world.add(glow);

  scene.add(new THREE.HemisphereLight(0xffedd8, 0x22110c, 1.85));
  const key = new THREE.DirectionalLight(0xfff2db, 5.2);
  key.position.set(-3, 5, 6);
  key.castShadow = true;
  scene.add(key);
  const red = new THREE.PointLight(0xff2a1d, 16, 14, 2);
  red.position.set(4.2, 0.5, 3.2);
  scene.add(red);
  const amber = new THREE.PointLight(0xffa33d, 10, 12, 2);
  amber.position.set(-4, -1.4, 2.5);
  scene.add(amber);

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  window.addEventListener('pointermove', (event) => {
    target.x = (event.clientX / window.innerWidth - 0.5) * 2;
    target.y = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function resize() {
    const { clientWidth, clientHeight } = host;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
    const mobile = clientWidth < 640;
    camera.position.z = mobile ? 9.5 : 8.4;
    world.scale.setScalar(mobile ? 0.82 : 1);
    world.position.y = mobile ? -0.15 : 0;
  }
  resize();
  new ResizeObserver(resize).observe(host);

  let active = true;
  new IntersectionObserver(([entry]) => { active = entry.isIntersecting; }, { threshold: 0.02 }).observe(host);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    if (!active) return;
    const t = clock.getElapsedTime();
    pointer.x += (target.x - pointer.x) * 0.035;
    pointer.y += (target.y - pointer.y) * 0.035;

    if (!reducedMotion) {
      world.rotation.y = pointer.x * 0.14 + Math.sin(t * 0.25) * 0.05;
      world.rotation.x = -pointer.y * 0.08 + Math.sin(t * 0.32) * 0.025;
      pizza.rotation.z = -0.14 + Math.sin(t * 0.55) * 0.045;
      pizza.position.y = -0.05 + Math.sin(t * 0.75) * 0.11;
      ring.rotation.z = -0.35 + t * 0.08;
      ingredientGroup.children.forEach((mesh, index) => {
        mesh.rotation.x += 0.004 * mesh.userData.speed;
        mesh.rotation.y += 0.006 * mesh.userData.speed;
        mesh.position.y += Math.sin(t * mesh.userData.speed + mesh.userData.offset) * 0.0009 * (index % 2 ? 1 : -1);
      });
      glow.rotation.y = t * 0.015;
    }

    renderer.render(scene, camera);
  }
  animate();
} else if (host) {
  host.classList.add('webgl-disabled');
}
