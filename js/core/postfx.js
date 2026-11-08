// Calidad «alta»: oclusión ambiental (GTAO) para dar sombra de contacto a relieves y juntas.
// Se elige por defecto en escritorio y se puede cambiar con el botón «Calidad» (se recuerda).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const KEY = 'tut-calidad';

export function defaultQuality() {
  const qs = new URLSearchParams(location.search);
  if (qs.has('lite')) return 'normal';
  if (qs.get('calidad') === 'alta' || qs.get('calidad') === 'normal') return qs.get('calidad');
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'alta' || v === 'normal') return v;
  } catch (e) { /* almacenamiento no disponible */ }
  const desktop = window.matchMedia('(pointer: fine)').matches && Math.min(window.innerWidth, window.innerHeight) >= 700;
  return desktop ? 'alta' : 'normal';
}

export function saveQuality(q) {
  try { localStorage.setItem(KEY, q); } catch (e) { /* almacenamiento no disponible */ }
}

export function createComposer(renderer, scene, camera, { radius = 0.35 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, size.x, size.y);
  ao.output = GTAOPass.OUTPUT.Default;
  ao.blendIntensity = 0.85;
  ao.updateGtaoMaterial({ radius, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  // las siluetas translúcidas y las aristas no deben proyectar oclusión
  const render = ao.render.bind(ao);
  const hidden = [];
  ao.render = (...args) => {
    scene.traverse((o) => {
      if (!o.visible) return;
      const m = o.material;
      if (o.isLineSegments || o.isLine || (m && !Array.isArray(m) && m.transparent && m.opacity < 0.6)) {
        o.visible = false; hidden.push(o);
      }
    });
    try { render(...args); }
    finally { for (const o of hidden) o.visible = true; hidden.length = 0; }
  };
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  return {
    composer,
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
    render() { composer.render(); },
  };
}
