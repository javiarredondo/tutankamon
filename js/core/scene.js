// Renderizador, iluminación de sala de museo, cámaras y controles (ratón y táctil).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { floorTexture } from './materials.js';
import { tween, Ease } from './tween.js';

const BG = 0x0e0b08;

export function createRenderer(canvas) {
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // ?lite: modo ligero (sin sombras, menor resolución) para equipos modestos y pruebas automáticas
  const lite = new URLSearchParams(location.search).has('lite');
  if (lite) renderer.setPixelRatio(0.6);
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** Entorno de reflejos discreto (genera un mapa de entorno sin archivos HDR externos). */
function environment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

function museumLights(scene, { shadowSize = 2048, keyPos = [6, 9, 6], target = [0, 0.8, 0], spread = 0.6, power = 1 } = {}) {
  scene.add(new THREE.HemisphereLight(0x5a4a38, 0x0b0907, 0.55 * power));
  const key = new THREE.SpotLight(0xffd6a0, 900 * power, 0, spread, 0.6, 2);
  key.position.set(...keyPos);
  key.target.position.set(...target);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 2; key.shadow.camera.far = 40;
  scene.add(key, key.target);
  const fill = new THREE.PointLight(0xffb070, 30 * power, 0, 2);
  fill.position.set(-6, 3, -4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8fa3c8, 0.35 * power);
  rim.position.set(-4, 6, 8);
  scene.add(rim);
  return { key, fill, rim };
}

export function createTombStage(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 22, 60);
  scene.environment = environment(renderer);
  scene.environmentIntensity = 0.45;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const lights = museumLights(scene, { shadowSize: small ? 1024 : 2048 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ map: floorTexture(), color: 0xffffff, roughness: 0.92, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 120);
  return { scene, camera, lights, floor };
}

export function createGalleryStage(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.environment = environment(renderer);
  scene.environmentIntensity = 0.55;
  const lights = museumLights(scene, { shadowSize: 1024, keyPos: [1.4, 3.2, 2.2], target: [0, 0.9, 0], spread: 0.45, power: 0.16 });
  lights.key.shadow.camera.near = 0.5; lights.key.shadow.camera.far = 8;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x120e0b, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  // peana
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.9, 64),
    new THREE.MeshStandardMaterial({ color: 0x1f1913, roughness: 0.75, metalness: 0.05 }));
  plinth.position.y = 0.45; plinth.receiveShadow = true; plinth.castShadow = true;
  scene.add(plinth);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.012, 64), new THREE.MeshStandardMaterial({ color: 0x2a221a, roughness: 0.6 }));
  top.position.y = 0.906; top.receiveShadow = true;
  scene.add(top);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 60);
  return { scene, camera, lights, plinthTop: 0.912 };
}

export function createControls(camera, dom) {
  const c = new OrbitControls(camera, dom);
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.screenSpacePanning = true;
  c.maxPolarAngle = Math.PI * 0.495; // no bajar del suelo
  c.rotateSpeed = 0.7;
  c.zoomSpeed = 0.9;
  c.panSpeed = 0.8;
  c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  return c;
}

export function createLabelRenderer(el) {
  const r = new CSS2DRenderer({ element: el });
  return r;
}

/**
 * Mueve la cámara para encuadrar una esfera, manteniendo una dirección de vista dada.
 * Devuelve una Promise que se resuelve al terminar la transición.
 */
export function flyTo(camera, controls, center, radius, dir, duration = 1.4) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const aspectFix = camera.aspect < 1 ? 1 / Math.max(camera.aspect, 0.45) : 1;
  const dist = (radius / Math.sin(fov / 2)) * 1.05 * aspectFix;
  const d = dir.clone().normalize();
  const toPos = center.clone().addScaledVector(d, dist);
  const fromPos = camera.position.clone();
  const fromT = controls.target.clone();
  controls.minDistance = Math.max(0.05, radius * 0.25);
  controls.maxDistance = Math.max(dist * 3, 8);
  if (duration <= 0) { camera.position.copy(toPos); controls.target.copy(center); controls.update(); return Promise.resolve(); }
  return tween({
    duration, ease: Ease.inOut,
    onUpdate: (k) => {
      camera.position.lerpVectors(fromPos, toPos, k);
      controls.target.lerpVectors(fromT, center, k);
    },
  });
}
