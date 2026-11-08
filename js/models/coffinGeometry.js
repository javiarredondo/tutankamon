// Geometría de los ataúdes antropomorfos a partir de la silueta medida (data/coffinShape.js).
// Ejes como en funerary.js: X = largo (cabeza hacia −X), Y = alto, Z = ancho.
import * as THREE from 'three';
import { COFFIN_SHAPE } from '../data/coffinShape.js';

// exponentes de las superelipses de cada sección (tapa más redondeada, caja más plana)
const N_FRONT = 2.4;
const N_BACK = 3.6;
// a partir de aquí la cabeza se cierra en cúpula
const DOME = 0.95;
function sample(arr, t) {
  if (t > DOME) return rawSample(arr, DOME) * Math.sqrt(Math.max(0, 1 - ((t - DOME) / (1 - DOME)) ** 2));
  return rawSample(arr, t);
}
function rawSample(arr, t) {
  const x = THREE.MathUtils.clamp(t, 0, 1) * (arr.length - 1);
  const i = Math.min(Math.floor(x), arr.length - 2), k = x - i;
  return arr[i] * (1 - k) + arr[i + 1] * k;
}
/**
 * Escala la silueta medida a las dimensiones de un ataúd. Con `fitHeight` el alto se ajusta a
 * `dims.H`; si no, se conservan las proporciones medidas.
 */
export function coffinScale(dims, fitHeight = true) {
  const { L, W, H } = dims;
  const maxHW = Math.max(...COFFIN_SHAPE.hw);
  let maxD = 0;
  for (let i = 0; i < COFFIN_SHAPE.front.length; i++) maxD = Math.max(maxD, COFFIN_SHAPE.front[i] + COFFIN_SHAPE.back[i]);
  const kw = W / (2 * maxHW * L);
  const kd = fitHeight && H ? H / (maxD * L) : kw;
  return {
    L,
    W,
    kw,
    kd,
    hw: (t) => sample(COFFIN_SHAPE.hw, t) * L * kw,
    front: (t) => sample(COFFIN_SHAPE.front, t) * L * kd,
    back: (t) => sample(COFFIN_SHAPE.back, t) * L * kd,
    x: (t) => L / 2 - t * L
  };
}
/** Altura de la superficie de la tapa en el punto (t, z). */
export function lidTop(S, t, z) {
  const a = Math.max(S.hw(t), 1e-4), f = S.front(t);
  const r = Math.min(1, Math.abs(z) / a);
  return f * Math.pow(Math.max(0, 1 - Math.pow(r, N_FRONT)), 1 / N_FRONT);
}
/** Media envolvente ('lid' arriba, 'base' abajo) con secciones superelípticas; cabeza hacia −X. */
export function coffinShell(S, half, rows = 160, cols = 56) {
  const lid = half === 'lid';
  const n = lid ? N_FRONT : N_BACK;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const q = i / rows, t = q < 0.9 ? q * (DOME / 0.9) : DOME + (1 - DOME) * Math.sin((q - 0.9) / 0.1 * Math.PI / 2);
    const a = Math.max(S.hw(t), 1e-4);
    const h = Math.max(lid ? S.front(t) : S.back(t), 1e-4);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const th = Math.PI * u;
      const c = Math.cos(th), s = Math.sin(th);
      const z = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = h * Math.pow(Math.abs(s), 2 / n) * (lid ? 1 : -1);
      pos.push(S.x(t), y, lid ? z : -z);
      uv.push(u, t);
    }
  }
  const w = cols + 1;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * w + j, b = a + 1, c = a + w, d = c + 1;
    if (lid) idx.push(a, c, b, b, c, d);
    else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Tapa plana que cierra la envolvente a la altura de los pies. */
export function footCap(S, half, cols = 40) {
  const lid = half === 'lid';
  const n = lid ? N_FRONT : N_BACK;
  const a = S.hw(0.004), h = lid ? S.front(0.004) : S.back(0.004);
  const shape = new THREE.Shape();
  shape.moveTo(-a, 0);
  for (let j = 0; j <= cols; j++) {
    const th = Math.PI * (1 - j / cols);
    const c = Math.cos(th), s = Math.sin(th);
    shape.lineTo(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), h * Math.pow(Math.abs(s), 2 / n) * (lid ? 1 : -1));
  }
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape);
  g.rotateY(Math.PI / 2);
  g.translate(S.x(0.004), 0, 0);
  return g;
}
