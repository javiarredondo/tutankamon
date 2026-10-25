// Materiales y texturas procedurales (generadas con <canvas>, sin archivos externos).
// Las decoraciones son ESQUEMÁTICAS: sugieren el tipo de superficie (oro, fayenza, piedra,
// lino, incrustaciones) pero no reproducen textos ni iconografía real de las piezas.
import * as THREE from 'three';
import { inlayMaps, goldGrain, pseudoGlyphs, normalFromCanvas, TEX_SCALE } from './inlay.js';

const texCache = new Map();

function canvasTexture(key, size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const k = `${key}|${repeat.join('x')}`;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

// pseudoaleatorio determinista: misma textura en cada carga
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function goldGround(g, s, base = '#d6ad55', var1 = 18) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  const r = rng(7);
  for (let i = 0; i < 2600; i++) {
    const v = (r() - 0.5) * var1;
    g.fillStyle = `rgba(${v > 0 ? '255,240,200' : '90,60,20'},${Math.abs(v) / 120})`;
    g.fillRect(r() * s, r() * s, 1 + r() * 6, 1 + r() * 2);
  }
}

/** Oro con paneles de fayenza azul y signos djed / tyet simplificados (santuario exterior). */
export function faienceGoldTexture() {
  return canvasTexture('faience', 512, (g, s) => {
    goldGround(g, s);
    const cell = s / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const px = x * cell + 14, py = y * cell + 14, w = cell - 28, h = cell - 28;
      g.fillStyle = '#1f4f9a'; g.fillRect(px, py, w, h);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(px, py, w, h / 3);
      g.fillStyle = '#e2bb63'; g.strokeStyle = '#e2bb63'; g.lineWidth = 6;
      const cx = px + w / 2;
      if ((x + y) % 2 === 0) { // djed esquemático
        g.fillRect(cx - 7, py + 16, 14, h - 32);
        for (let k = 0; k < 4; k++) g.fillRect(cx - 24, py + 20 + k * 11, 48, 5);
      } else { // tyet esquemático: lazo arriba, brazos caídos y cuerpo largo
        g.beginPath(); g.ellipse(cx, py + 30, 11, 15, 0, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 5;
        g.beginPath(); g.moveTo(cx - 8, py + 46); g.quadraticCurveTo(cx - 20, py + 50, cx - 20, py + 70); g.stroke();
        g.beginPath(); g.moveTo(cx + 8, py + 46); g.quadraticCurveTo(cx + 20, py + 50, cx + 20, py + 70); g.stroke();
        g.beginPath(); g.moveTo(cx - 5, py + 45); g.lineTo(cx - 10, py + h - 14); g.lineTo(cx + 10, py + h - 14); g.lineTo(cx + 5, py + 45); g.fill();
      }
    }
  }, { repeat: [1, 1] });
}

/** Oro con bandas y columnas de incisiones genéricas (santuarios 2-4). No reproduce textos reales. */
export function incisedGoldTexture(seed = 3) {
  return canvasTexture('incised' + seed, 512, (g, s) => {
    goldGround(g, s, '#d2a84f');
    const r = rng(seed);
    g.strokeStyle = 'rgba(95,62,18,0.55)'; g.lineWidth = 2;
    g.strokeRect(14, 14, s - 28, s - 28);
    g.beginPath(); g.moveTo(14, 60); g.lineTo(s - 14, 60); g.stroke();
    for (let col = 0; col < 14; col++) {
      const x = 30 + col * 33;
      g.beginPath(); g.moveTo(x - 6, 70); g.lineTo(x - 6, s - 24); g.stroke();
      for (let yy = 80; yy < s - 34; yy += 14 + r() * 8) {
        g.fillStyle = 'rgba(95,62,18,0.5)';
        const t = r();
        if (t < 0.4) g.fillRect(x, yy, 12, 3);
        else if (t < 0.7) { g.beginPath(); g.arc(x + 6, yy + 3, 4, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(x + 3, yy - 3, 4, 10);
      }
    }
    for (let k = 0; k < 12; k++) { g.fillStyle = 'rgba(95,62,18,0.45)'; g.fillRect(30 + k * 38, 32, 22, 4); }
  });
}

/** Plumas (decoración rishi) en oro; con incrustaciones de color si `inlay`. */
export function featherTexture(inlay = false) {
  return canvasTexture('feather' + inlay, 512, (g, s) => {
    goldGround(g, s, '#d9b05a');
    const cols = ['#24529c', '#b0412b', '#2f8f86'];
    const fw = s / 8, fh = s / 10;
    for (let row = 0; row < 11; row++) for (let col = 0; col < 9; col++) {
      const x = col * fw + (row % 2 ? fw / 2 : 0) - fw / 2, y = row * fh;
      g.beginPath();
      g.moveTo(x, y); g.quadraticCurveTo(x + fw / 2, y + fh * 1.4, x + fw, y);
      if (inlay) { g.fillStyle = cols[(row + col) % 3]; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; }
      g.strokeStyle = inlay ? '#e9c573' : 'rgba(110,72,20,0.65)'; g.lineWidth = inlay ? 4 : 2.5; g.stroke();
    }
  }, { repeat: [2, 2] });
}

/** Franjas alternas oro / lapislázuli (nemes, barba, bastones). */
export function stripeTexture(key = 'nemes', a = '#d8af55', b = '#1f3f86', n = 12, horizontal = true) {
  return canvasTexture('stripe' + key, 256, (g, s) => {
    const w = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? b : a;
      if (horizontal) g.fillRect(0, i * w, s, w); else g.fillRect(i * w, 0, w, s);
    }
  });
}

/** Bandas concéntricas del collar ancho (wesekh), esquemáticas. */
export function collarTexture() {
  return canvasTexture('collar', 512, (g, s) => {
    const c = s / 2;
    const bands = ['#d8af55', '#1f4f9a', '#d8af55', '#2f8f86', '#d8af55', '#b0412b', '#d8af55', '#1f4f9a', '#d8af55', '#2f8f86', '#d8af55'];
    for (let i = bands.length - 1; i >= 0; i--) {
      g.fillStyle = bands[i];
      g.beginPath(); g.arc(c, c, (c * (i + 1)) / bands.length, 0, Math.PI * 2); g.fill();
    }
  });
}

export function stoneTexture(kind = 'quartzite') {
  return canvasTexture('stone' + kind, 512, (g, s) => {
    const base = kind === 'granite' ? '#7a4136' : '#a77f58';
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const r = rng(kind === 'granite' ? 11 : 5);
    const n = kind === 'granite' ? 9000 : 5000;
    for (let i = 0; i < n; i++) {
      const v = r();
      g.fillStyle = kind === 'granite'
        ? (v < 0.5 ? 'rgba(20,10,8,0.5)' : v < 0.85 ? 'rgba(200,150,130,0.35)' : 'rgba(240,220,210,0.5)')
        : (v < 0.5 ? 'rgba(80,50,30,0.25)' : 'rgba(230,200,160,0.22)');
      const sz = kind === 'granite' ? 1 + r() * 3 : 1 + r() * 5;
      g.fillRect(r() * s, r() * s, sz, sz);
    }
  }, { repeat: [1, 1] });
}

export function linenTexture() {
  return canvasTexture('linen', 256, (g, s) => {
    g.fillStyle = '#9c8463'; g.fillRect(0, 0, s, s);
    const r = rng(9);
    for (let y = 0; y < s; y += 3) { g.fillStyle = `rgba(60,40,20,${0.08 + r() * 0.12})`; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 4) { g.fillStyle = `rgba(230,210,170,${0.04 + r() * 0.08})`; g.fillRect(x, 0, 1, s); }
    g.strokeStyle = 'rgba(70,48,26,0.35)'; g.lineWidth = 6;
    for (let k = -s; k < s * 2; k += 46) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + s * 0.6, s); g.stroke(); }
  }, { repeat: [2, 4] });
}

export function pallTexture() {
  return canvasTexture('pall', 512, (g, s) => {
    g.fillStyle = '#2a1d14'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#c9a24a';
    for (let y = 16; y < s; y += 32) for (let x = 16 + ((y / 32) % 2) * 16; x < s; x += 32) {
      g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
    }
  });
}

export function floorTexture() {
  return canvasTexture('floor', 512, (g, s) => {
    g.fillStyle = '#17120e'; g.fillRect(0, 0, s, s);
    const r = rng(21);
    for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '120,96,70'},${r() * 0.12})`; g.fillRect(r() * s, r() * s, 2, 2); }
  }, { repeat: [10, 10] });
}

// ---------------------------------------------------------------- fábricas
// Cada estructura recibe instancias propias para poder volverse translúcida por separado.

export const M = {
  gold(map, { rough = 0.32, color = 0xffffff } = {}) {
    return new THREE.MeshStandardMaterial({ color: map ? color : 0xd8ab4f, map: map || null, metalness: 1, roughness: rough, side: THREE.DoubleSide });
  },
  solidGold(rough = 0.24) { return new THREE.MeshStandardMaterial({ color: 0xe0b45a, metalness: 1, roughness: rough, side: THREE.DoubleSide }); },
  copper() { return new THREE.MeshStandardMaterial({ color: 0x9a5a34, metalness: 0.9, roughness: 0.45 }); },
  wood() { return new THREE.MeshStandardMaterial({ color: 0x6e4a2b, metalness: 0, roughness: 0.8 }); },
  stone(kind) { const t = stoneTexture(kind); return new THREE.MeshStandardMaterial({ map: t, normalMap: bumpFrom(t, 3), metalness: 0, roughness: 0.85, side: THREE.DoubleSide }); },
  linen() { const t = linenTexture(); return new THREE.MeshStandardMaterial({ map: t, normalMap: bumpFrom(t, 2.5), metalness: 0, roughness: 0.95 }); },
  pall() { return new THREE.MeshStandardMaterial({ map: pallTexture(), metalness: 0.2, roughness: 0.85, side: THREE.DoubleSide }); },
  lapis() { return new THREE.MeshStandardMaterial({ color: 0x1d3c88, metalness: 0.1, roughness: 0.35 }); },
  glassBlue() { return new THREE.MeshPhysicalMaterial({ color: 0x2a5bb8, metalness: 0, roughness: 0.12, clearcoat: 1 }); },
  turquoise() { return new THREE.MeshStandardMaterial({ color: 0x3aa49a, metalness: 0, roughness: 0.4 }); },
  carnelian() { return new THREE.MeshPhysicalMaterial({ color: 0xb0381f, metalness: 0, roughness: 0.25, clearcoat: 0.6 }); },
  obsidian() { return new THREE.MeshStandardMaterial({ color: 0x0b0b0e, metalness: 0.2, roughness: 0.15 }); },
  quartz() { return new THREE.MeshStandardMaterial({ color: 0xf2efe6, metalness: 0, roughness: 0.2 }); },
  desertGlass() { return new THREE.MeshPhysicalMaterial({ color: 0xcfc777, metalness: 0, roughness: 0.15, transparent: true, opacity: 0.88, clearcoat: 1 }); },
  rockCrystal() { return new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }); },
  iron() { return new THREE.MeshStandardMaterial({ color: 0x9aa1a6, metalness: 0.85, roughness: 0.33 }); },
  faience(color = 0x2f74b5) { return new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.3 }); },
  greenStone() { return new THREE.MeshStandardMaterial({ color: 0x3f6b4a, metalness: 0, roughness: 0.3 }); },
  redJasper() { return new THREE.MeshStandardMaterial({ color: 0x8e2a1f, metalness: 0, roughness: 0.35 }); },
  textured(map, opts = {}) { return new THREE.MeshStandardMaterial({ map, metalness: opts.metalness ?? 0.6, roughness: opts.roughness ?? 0.35, side: THREE.DoubleSide }); },
};

/**
 * Proyección triplanar simple de UV en metros: cada cara toma las coordenadas del plano
 * más alineado con su normal. Así la textura mantiene la misma escala en todas las piezas.
 */
export function worldUV(geometry, metersPerTile = 1) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / metersPerTile; uv[i * 2 + 1] = v / metersPerTile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ------------------------------------------------------------------ versiones con relieve

/**
 * Santuario exterior: hileras de pilares djed alternando con PAREJAS de nudos tyet,
 * en oro sobre fayenza azul, separadas por bandas de oro (referencia: fotos del GEM).
 */
export function faienceMaps() {
  const S = Math.round(1024 * TEX_SCALE);
  return inlayMaps('faience', S, S, (g, pal, W) => {
    const s = W / 512;
    goldGrain(g, pal, W, W);
    const rowH = W / 4, band = 10 * s;
    for (let r = 0; r < 4; r++) {
      const y0 = r * rowH + band, h = rowH - band * 2;
      g.fillStyle = pal.faience; g.fillRect(0, y0, W, h);
      g.fillStyle = pal.gold; g.strokeStyle = pal.gold;
      // unidad de 128 px: djed (40) + pareja de tyet (88)
      for (let u = 0; u < W; u += 128 * s) {
        // djed
        const dx = u + 20 * s;
        g.fillRect(dx - 6 * s, y0 + 8 * s, 12 * s, h - 16 * s);
        for (let k = 0; k < 4; k++) g.fillRect(dx - 15 * s, y0 + (10 + k * 9) * s, 30 * s, 5 * s);
        g.fillRect(dx - 12 * s, y0 + h - 14 * s, 24 * s, 6 * s);
        // pareja de tyet
        for (const t of [0, 1]) {
          const cx = u + (62 + t * 42) * s;
          g.lineWidth = 6 * s;
          g.beginPath(); g.ellipse(cx, y0 + 24 * s, 10 * s, 14 * s, 0, 0, Math.PI * 2); g.stroke();
          g.lineWidth = 5 * s;
          for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * 7 * s, y0 + 38 * s); g.quadraticCurveTo(cx + d * 18 * s, y0 + 42 * s, cx + d * 18 * s, y0 + 60 * s); g.stroke(); }
          g.beginPath(); g.moveTo(cx - 5 * s, y0 + 38 * s); g.lineTo(cx - 9 * s, y0 + h - 8 * s); g.lineTo(cx + 9 * s, y0 + h - 8 * s); g.lineTo(cx + 5 * s, y0 + 38 * s); g.fill();
        }
      }
    }
  }, { normal: 3 });
}

/** Santuarios 2–4: oro con registros, columnas de marcas genéricas y escenas sugeridas. */
export function incisedMaps(seed = 3) {
  const S = Math.round(1024 * TEX_SCALE);
  return inlayMaps('incised' + seed, S, S, (g, pal, W) => {
    goldGrain(g, pal, W, W);
    const s = W / 512;
    g.strokeStyle = pal.goldDark; g.lineWidth = 2.5 * s;
    g.strokeRect(10 * s, 10 * s, W - 20 * s, W - 20 * s);
    // friso superior y banda horizontal de texto
    for (let k = 0; k < 24; k++) { g.fillStyle = pal.goldMid; g.fillRect((14 + k * 20.5) * s, 16 * s, 12 * s, 26 * s); }
    g.beginPath(); g.moveTo(10 * s, 48 * s); g.lineTo(W - 10 * s, 48 * s); g.moveTo(10 * s, 80 * s); g.lineTo(W - 10 * s, 80 * s); g.stroke();
    pseudoGlyphs(g, pal, 14 * s, 50 * s, W - 28 * s, 28 * s, false, 1.3 * s);
    // columnas de texto
    for (let col = 0; col < 7; col++) {
      const x = (18 + col * 26) * s;
      g.beginPath(); g.moveTo(x, 86 * s); g.lineTo(x, W - 16 * s); g.stroke();
      pseudoGlyphs(g, pal, x, 86 * s, 26 * s, W - 104 * s, true, 1.1 * s);
    }
    // figuras esquemáticas (siluetas genéricas de divinidades en procesión)
    for (let f = 0; f < 4; f++) {
      const fx = (220 + f * 72) * s, base = W - 30 * s;
      g.fillStyle = pal.goldDark;
      g.fillRect(fx - 6 * s, base - 150 * s, 12 * s, 110 * s);          // cuerpo
      g.beginPath(); g.arc(fx, base - 162 * s, 11 * s, 0, Math.PI * 2); g.fill(); // cabeza
      g.fillRect(fx - 10 * s, base - 40 * s, 7 * s, 40 * s); g.fillRect(fx + 3 * s, base - 40 * s, 7 * s, 40 * s); // piernas
      g.fillRect(fx + 6 * s, base - 130 * s, 26 * s, 5 * s);           // brazo extendido
      g.fillStyle = pal.gold; g.fillRect(fx - 3 * s, base - 140 * s, 6 * s, 90 * s);
    }
    g.beginPath(); g.moveTo(200 * s, W - 28 * s); g.lineTo(W - 14 * s, W - 28 * s); g.stroke();
  }, { normal: 3.5, seed });
}

/** Collar ancho de la máscara: filas concéntricas de cuentas y colgantes en gota (UV plano del anillo). */
export function maskCollarMaps() {
  const S = Math.round(1024 * TEX_SCALE);
  return inlayMaps('maskCollar', S, S, (g, pal, W) => {
    const c = W / 2, s = W / 1024;
    g.fillStyle = pal.gold; g.fillRect(0, 0, W, W);
    // radios relativos al anillo (0,07 → 0,25 m ⇒ 0,28 → 1,0 del radio exterior)
    const rows = ['lapis', 'turq', 'red', 'lapis', 'turq', 'red', 'lapis'];
    let r0 = 0.3 * c;
    const dr = (0.88 * c - r0) / rows.length;
    rows.forEach((col, i) => {
      const r1 = r0 + dr;
      const n = Math.round((2 * Math.PI * r1) / (20 * s));
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 0.8) / n) * Math.PI * 2;
        g.beginPath(); g.arc(c, c, r1 - 3 * s, a0, a1); g.arc(c, c, r0 + 3 * s, a1, a0, true); g.closePath();
        g.fillStyle = pal[(i % 2 === 0) ? col : (k % 2 ? col : 'gold')]; g.fill();
      }
      r0 = r1;
    });
    // colgantes en gota
    const n = Math.round((2 * Math.PI * 0.94 * c) / (26 * s));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = c + Math.cos(a) * 0.94 * c, y = c + Math.sin(a) * 0.94 * c;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.ellipse(0, 0, 8 * s, 16 * s, 0, 0, Math.PI * 2);
      g.fillStyle = pal[k % 2 ? 'lapis' : 'red']; g.fill();
      g.strokeStyle = pal.goldLight; g.lineWidth = 3 * s; g.stroke(); g.restore();
    }
  }, { normal: 2.5 });
}

/** Barba trenzada: espiga de oro y lapislázuli. */
export function braidMaps() {
  return inlayMaps('braid', 256, 256, (g, pal, W, H) => {
    g.fillStyle = pal.lapis; g.fillRect(0, 0, W, H);
    g.strokeStyle = pal.gold; g.lineWidth = 5;
    for (let y = -H; y < H * 2; y += 24) {
      for (let x = 0; x < W; x += 64) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 32, y + 18); g.lineTo(x + 64, y); g.stroke();
      }
    }
  }, { repeat: [3, 2], normal: 2 });
}

/** Relieve derivado del propio color (piedra, lino). */
export function bumpFrom(tex, strength = 2) {
  if (tex.userData.normal) return tex.userData.normal;
  const n = new THREE.CanvasTexture(normalFromCanvas(tex.image, strength));
  n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.copy(tex.repeat); n.colorSpace = THREE.NoColorSpace;
  tex.userData.normal = n;
  return n;
}
