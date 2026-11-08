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

/**
 * Desgaste sobre un mapa ORM: manchas y motas que suben la rugosidad (canal G)
 * y arañazos finos que la bajan, para que el oro no parezca un espejo uniforme.
 */
export function addWear(g, W, H, seed = 1) {
  const r = rng(seed * 31 + 7);
  const k = (W * H) / (512 * 512);
  g.save();
  // manchas suaves: se pintan a 1/4 de resolución y se suman ampliadas (son difusas y grandes,
  // así que el resultado es el mismo con 16 veces menos píxeles que rellenar)
  const q = 4, lo = document.createElement('canvas');
  lo.width = Math.ceil(W / q); lo.height = Math.ceil(H / q);
  const lg = ctx2d(lo);
  lg.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70 * k; i++) {
    const x = r() * W, y = r() * H, rad = (20 + r() * 70) * Math.sqrt(k);
    const grd = lg.createRadialGradient(x / q, y / q, 0, x / q, y / q, rad / q);
    grd.addColorStop(0, `rgba(0,${Math.round(6 + r() * 12)},0,1)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = grd;
    lg.fillRect((x - rad) / q, (y - rad) / q, (rad * 2) / q, (rad * 2) / q);
  }
  g.globalCompositeOperation = 'lighter';
  g.drawImage(lo, 0, 0, lo.width * q, lo.height * q);
  // motas de un píxel: se suman directamente al canal G (mucho más rápido que miles de fillRect)
  const img = g.getImageData(0, 0, W, H), px = img.data;
  for (let i = 0; i < 5000 * k; i++) {
    const v = Math.round(r() * 30), x = Math.floor(r() * W), y = Math.floor(r() * H);
    const j = ((y * W + x) << 2) + 1;
    px[j] = Math.min(255, px[j] + v);
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'darken';
  g.strokeStyle = 'rgba(255,40,255,0.6)';
  g.lineWidth = 1;
  // arañazos en un solo trazo (con «darken» el resultado es igual que trazarlos uno a uno)
  g.beginPath();
  for (let i = 0; i < 160 * k; i++) {
    const x = r() * W, y = r() * H, a = r() * Math.PI, l = 6 + r() * 30;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  g.stroke();
  g.restore();
}

/**
 * Contexto 2D para lienzos que luego se leen con getImageData. Con `willReadFrequently` el
 * navegador los mantiene en memoria de CPU: leer un lienzo acelerado por GPU obliga a copiarlo
 * de vuelta, y eso era casi todo el tiempo de arranque (≈ 20 millones de píxeles leídos).
 */
export function ctx2d(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

/** Normal map a partir de la luminancia de un canvas (alto = claro). Bordes con repetición. */
export function normalFromCanvas(src, strength = 2.5) {
  const w = src.width, h = src.height, n = w * h;
  const sd = ctx2d(src).getImageData(0, 0, w, h).data;
  // luminancia ya multiplicada por la intensidad del relieve
  const L = new Float32Array(n);
  const k = strength / 255;
  for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = (sd[j] * 0.3 + sd[j + 1] * 0.59 + sd[j + 2] * 0.11) * k;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const og = out.getContext('2d');
  const img = og.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const row = y * w, up = (y === 0 ? h - 1 : y - 1) * w, dn = (y === h - 1 ? 0 : y + 1) * w;
    for (let x = 0; x < w; x++) {
      const xl = x === 0 ? w - 1 : x - 1, xr = x === w - 1 ? 0 : x + 1;
      // normal = normalize(-dL/dx, dL/dy, 1), codificada en 0..255
      const nx = L[row + xl] - L[row + xr];
      const ny = L[dn + x] - L[up + x];
      const inv = 127.5 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (row + x) << 2;
      d[i] = nx * inv + 127.5; d[i + 1] = ny * inv + 127.5; d[i + 2] = inv + 127.5; d[i + 3] = 255;
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
    const g = ctx2d(c);
    draw(g, { ...pal, rng: rng(seed) }, W, H);
    return c;
  };
  const color = mk(COLOR);
  const orm = mk(ORM);
  addWear(ctx2d(orm), W, H, seed);
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
