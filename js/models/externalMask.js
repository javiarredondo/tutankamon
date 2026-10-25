// Carga del modelo 3D de la máscara (glTF de terceros, CC BY 4.0) incrustado en el código.
// Se normaliza al mismo marco que la máscara procedural: rostro hacia +Z, arriba +Y,
// alto ≈ 0,54 m, centro del rostro cerca del origen. Mientras carga (o si falla),
// se sigue mostrando la versión procedural.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import MASK_GLB_B64 from '../assets/maskModel.js';

export const MASK_CREDIT = {
  title: 'Máscara funeraria de Tutankamón',
  author: 'Roberto Domínguez',
  url: 'https://sketchfab.com/3d-models/mascara-funeraria-de-tutankamon-667fa18ffa404a6dac7abc6bcd5c861e',
  license: 'CC BY 4.0',
};

let promise = null;

function decode(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function loadMaskModel() {
  if (!promise) {
    promise = (async () => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.parseAsync(decode(MASK_GLB_B64), '');
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const k = 0.54 / size.y;
      const wrap = new THREE.Group();
      model.scale.setScalar(k);
      const c = box.getCenter(new THREE.Vector3());
      // centrado en X, parte superior a +0,24 m, frente del rostro a ≈ +0,12 m
      model.position.set(-c.x * k, 0.24 - box.max.y * k, 0.12 - box.max.z * k);
      wrap.add(model);
      return wrap;
    })();
  }
  return promise;
}

/** Copia independiente (materiales propios, para poder volverla translúcida o resaltarla). */
export async function maskInstance() {
  const base = await loadMaskModel();
  const inst = base.clone(true);
  inst.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.castShadow = true; o.receiveShadow = true;
    }
  });
  return inst;
}

/** Sustituye los hijos de `holder` por el modelo cuando esté listo. */
export function swapInMaskModel(holder, onMesh) {
  return maskInstance().then((m) => {
    const old = [...holder.children];
    for (const o of old) holder.remove(o);
    holder.add(m);
    if (onMesh) m.traverse((o) => { if (o.isMesh) onMesh(o, old); });
    window.dispatchEvent(new Event('tut:redraw'));
    return m;
  }).catch((e) => { console.warn('No se pudo cargar el modelo de la máscara; se mantiene la versión procedural.', e); });
}
