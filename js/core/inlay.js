// Texturas «de taracea»: cada dibujo se pinta dos veces con la misma geometría.
//  1) color  → mapa de color (sRGB)
//  2) ORM    → canal G = rugosidad, canal B = metalicidad (oro metálico, vidrio/piedra no)
// El relieve (normal map) se deriva de la luminancia del color: los tabiques de oro
// (cloisons) quedan en resalte y las incrustaciones, rehundidas.
// Los diseños están pintados a mano en código usando fotografías como REFERENCIA visual;
// son aproximaciones, no calcos de las piezas.
import * as THREE from 'three';

const cache = new Map();

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Calidad de textura según el dispositivo (el modo ?lite y las pantallas pequeñas usan la mitad). */
export const TEX_SCALE = (() => {
  const lite = new URLSearchParams(location.search).has('lite');
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  return lite || small ? 0.5 : 1;
})();

const COLOR = {
  isColor: true,
  gold: '#d6ad55', goldLight: '#e8c56e', goldDark: '#86622a', goldMid: '#b88f42',
  lapis: '#1f3d8e', red: '#a5381f', turq: '#258379', sky: '#3a78b8', orange: '#bd5424', obsidian: '#121214', quartz: '#ece8dc',
  faience: '#2066a8', resin: '#1b120c',
};
// rugosidad (G) y metalicidad (B)
const ORM = {
  isColor: false,
  gold: 'rgb(0,80,255)', goldLight: 'rgb(0,70,255)', goldDark: 'rgb(0,150,255)', goldMid: 'rgb(0,105,255)',
  lapis: 'rgb(0,85,0)', red: 'rgb(0,85,0)', turq: 'rgb(0,90,0)', sky: 'rgb(0,90,0)', orange: 'rgb(0,90,0)', obsidian: 'rgb(0,25,0)', quartz: 'rgb(0,40,0)',
  faience: 'rgb(0,95,0)', resin: 'rgb(0,120,0)',
};

/** Normal map a partir de la luminancia de un canvas (alto = claro). */
export function normalFromCanvas(src, strength = 2.5) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (sd[i * 4] * 0.3 + sd[i * 4 + 1] * 0.59 + sd[i * 4 + 2] * 0.11) / 255;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const og = out.getContext('2d');
  const img = og.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const y0 = (y - 1 + h) % h, y1 = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const x0 = (x - 1 + w) % w, x1 = (x + 1) % w;
      const dx = (L[y * w + x1] - L[y * w + x0]) * strength;
      const dy = (L[y1 * w + x] - L[y0 * w + x]) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

function toTex(canvas, srgb, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/**
 * Crea {map, ormMap, normalMap}. `draw(g, pal, W, H)` debe usar solo colores de `pal`
 * y `pal.rng()` para lo aleatorio, de modo que ambas pasadas coincidan.
 */
export function inlayMaps(key, W, H, draw, { repeat = [1, 1], normal = 2.5, seed = 1 } = {}) {
  const k = `${key}|${W}x${H}|${repeat.join(',')}`;
  if (cache.has(k)) return cache.get(k);
  const mk = (pal) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    draw(g, { ...pal, rng: rng(seed) }, W, H);
    return c;
  };
  const color = mk(COLOR);
  const orm = mk(ORM);
  const res = {
    map: toTex(color, true, repeat),
    ormMap: toTex(orm, false, repeat),
    normalMap: toTex(normalFromCanvas(color, normal * TEX_SCALE + normal * 0.5), false, repeat),
  };
  cache.set(k, res);
  return res;
}

/** Material estándar con mapas de taracea (oro metálico + incrustaciones no metálicas). */
export function inlaidMaterial(maps, { normalScale = 0.6, side = THREE.DoubleSide } = {}) {
  return new THREE.MeshStandardMaterial({
    map: maps.map, normalMap: maps.normalMap, normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: maps.ormMap, metalnessMap: maps.ormMap, roughness: 1, metalness: 1, side,
  });
}

// ------------------------------------------------------------------ primitivas de dibujo

/** Grano de pan de oro (solo en la pasada de color). */
export function goldGrain(g, pal, W, H, base = pal.gold, n = 2600) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  if (!pal.isColor) return;
  const r = rng(7);
  const k = (W * H) / (512 * 512);
  for (let i = 0; i < n * k; i++) {
    const v = r() - 0.5;
    g.fillStyle = v > 0 ? `rgba(255,240,200,${v * 0.18})` : `rgba(90,60,20,${-v * 0.2})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 6, 1 + r() * 2);
  }
}

/** Celda de pluma: borde superior recto y punta redondeada abajo. */
export function feather(g, x, y, w, h, fill, stroke, lw) {
  g.beginPath();
  g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.5);
  g.quadraticCurveTo(x + w, y + h, x + w / 2, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h * 0.5);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (lw > 0) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

/** Marcas genéricas tipo inscripción (NO son jeroglíficos reales). */
export function pseudoGlyphs(g, pal, x, y, w, h, vertical = true, scale = 1) {
  const r = pal.rng;
  g.fillStyle = pal.goldDark; g.strokeStyle = pal.goldDark;
  const step = 15 * scale;
  if (vertical) {
    for (let yy = y + 4 * scale; yy < y + h - step; yy += step + r() * 6 * scale) {
      const t = r(), cx = x + w / 2;
      g.lineWidth = 2 * scale;
      if (t < 0.3) g.fillRect(cx - w * 0.3, yy, w * 0.6, 3 * scale);
      else if (t < 0.55) { g.beginPath(); g.arc(cx, yy + 4 * scale, 4 * scale, 0, Math.PI * 2); g.stroke(); }
      else if (t < 0.75) g.fillRect(cx - 1.5 * scale, yy - 2 * scale, 3 * scale, 10 * scale);
      else { g.beginPath(); g.moveTo(cx - w * 0.3, yy + 6 * scale); g.quadraticCurveTo(cx, yy - 2 * scale, cx + w * 0.3, yy + 6 * scale); g.stroke(); }
    }
  } else {
    for (let xx = x + 4 * scale; xx < x + w - step; xx += step + r() * 6 * scale) {
      const t = r(), cy = y + h / 2;
      g.lineWidth = 2 * scale;
      if (t < 0.3) g.fillRect(xx, cy - h * 0.3, 3 * scale, h * 0.6);
      else if (t < 0.55) { g.beginPath(); g.arc(xx + 4 * scale, cy, 4 * scale, 0, Math.PI * 2); g.stroke(); }
      else if (t < 0.75) g.fillRect(xx - 2 * scale, cy - 1.5 * scale, 10 * scale, 3 * scale);
      else { g.beginPath(); g.moveTo(xx, cy + 4 * scale); g.quadraticCurveTo(xx + 5 * scale, cy - 6 * scale, xx + 10 * scale, cy + 4 * scale); g.stroke(); }
    }
  }
}

/** Franjas alternas (nemes, barba, insignias) con filete de oro entre ellas. */
export function stripeMaps(key, colA, colB, n, horizontal = true, size = 256) {
  return inlayMaps('stripe-' + key, size, size, (g, pal, W, H) => {
    const a = pal[colA], b = pal[colB];
    const w = (horizontal ? H : W) / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? b : a;
      if (horizontal) g.fillRect(0, i * w, W, w); else g.fillRect(i * w, 0, w, H);
    }
    // filete fino entre franjas
    g.fillStyle = pal.goldLight;
    for (let i = 0; i <= n; i++) { if (horizontal) g.fillRect(0, i * w - 1, W, 2); else g.fillRect(i * w - 1, 0, 2, H); }
  }, { normal: 2 });
}
