import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const host = document.querySelector('[data-award-canvas]');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection?.saveData;

function initReveals() {
  const items = document.querySelectorAll('.reveal-award');
  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });
  items.forEach((item) => observer.observe(item));
}

initReveals();

if (!host || reduced || saveData) {
  host?.setAttribute('hidden', '');
} else {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0806, 0.08);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 8.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const textureLoader = new THREE.TextureLoader();
  const textures = [
    'assets/images/pizza-professional.jpg',
    'assets/images/taco-professional.jpg',
    'assets/images/bbq-professional.jpg',
    'assets/images/pasta-professional.jpg',
    'assets/images/fajita-professional.jpg'
  ];

  const geometry = new THREE.PlaneGeometry(3.15, 4.1, 18, 18);
  const cards = [];
  textures.forEach((src, index) => {
    const texture = textureLoader.load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.96, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    const angle = (index - 2) * 0.47;
    mesh.position.set(Math.sin(angle) * 4.6, (index % 2 ? -0.35 : 0.35), -Math.abs(index - 2) * 1.25);
    mesh.rotation.y = -angle * 0.72;
    mesh.rotation.z = (index - 2) * -0.025;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.phase = index * 0.75;
    group.add(mesh);
    cards.push(mesh);
  });

  const particleCount = 260;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = -Math.random() * 10;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particlesGeometry,
    new THREE.PointsMaterial({ color: 0xff9b72, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false })
  );
  scene.add(particles);

  const glowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; void main(){float d=distance(vUv,vec2(.5)); float a=smoothstep(.52,.05,d); vec3 c=mix(vec3(.9,.12,.05),vec3(1.,.48,.18),.5+.5*sin(uTime*.25)); gl_FragColor=vec4(c,a*.22);}`
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), glowMaterial);
  glow.position.z = -4.5;
  scene.add(glow);

  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let scroll = 0;
  let active = true;

  function onPointer(event) {
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  function onScroll() {
    scroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1.4);
  }

  function resize() {
    const { clientWidth, clientHeight } = host;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
    const mobile = clientWidth < 700;
    camera.position.z = mobile ? 10.8 : 8.8;
    group.scale.setScalar(mobile ? 0.72 : 1);
    group.position.y = mobile ? 0.7 : 0;
  }

  const observer = new IntersectionObserver(([entry]) => { active = entry.isIntersecting; }, { threshold: 0.02 });
  observer.observe(host);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  resize();
  onScroll();

  const clock = new THREE.Clock();
  function render() {
    requestAnimationFrame(render);
    if (!active) return;
    const time = clock.getElapsedTime();
    pointerX += (targetX - pointerX) * 0.045;
    pointerY += (targetY - pointerY) * 0.045;
    group.rotation.y = pointerX * 0.08;
    group.rotation.x = -pointerY * 0.035;
    group.position.z = scroll * 1.4;
    group.position.x = -scroll * 0.65;
    cards.forEach((card, index) => {
      card.position.y = card.userData.baseY + Math.sin(time * 0.48 + card.userData.phase) * 0.12;
      card.rotation.z += Math.sin(time * 0.25 + index) * 0.00018;
    });
    particles.rotation.y = time * 0.012;
    particles.rotation.x = pointerY * 0.025;
    glowMaterial.uniforms.uTime.value = time;
    renderer.render(scene, camera);
  }
  render();
}