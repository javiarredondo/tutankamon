// Mapas pintados para los ataúdes antropomorfos, en el espacio UV de la geometría de torno:
//   u: 0 → 1 rodea media sección (tapa: de un costado al otro pasando por el centro, u = 0,5)
//   v: 0 = pies, 1 = cabeza (en el canvas, la cabeza queda arriba)
// Composición aproximada tomada de fotografías como referencia: tocado nemes a franjas,
// lengüetas, collar ancho, alas de buitre cruzadas sobre el cuerpo, plumaje rishi y
// columna central de inscripción. Las «inscripciones» son marcas genéricas, no texto real.
import { inlayMaps, goldGrain, feather, pseudoGlyphs, TEX_SCALE } from './inlay.js';

const PALETTES = {
  // ataúd exterior: madera dorada con plumaje en relieve (casi sin color)
  outer: { cells: ['goldMid', 'goldDark', 'gold'], wings: ['goldMid', 'goldDark', 'gold'], stripes: ['gold', 'goldMid'], cloison: 'goldLight', lw: 1.6 },
  // ataúd intermedio: plumaje de vidrio en tonos claros (referencia: fotos del GEM)
  middle: { cells: ['orange', 'turq', 'sky'], wings: ['red', 'turq', 'lapis'], stripes: ['gold', 'lapis'], cloison: 'gold', lw: 2.2 },
  // ataúd de oro: plumaje cincelado en oro; color en alas y collar (cloisonné)
  inner: { cells: ['goldMid', 'gold', 'goldMid'], wings: ['red', 'lapis', 'turq'], stripes: ['gold', 'lapis'], cloison: 'goldLight', lw: 2.4 },
};

function featherField(g, pal, P, x0, y0, x1, y1, cw, ch, s) {
  const lw = P.lw * s;
  let row = 0;
  for (let y = y0; y < y1; y += ch * 0.72, row++) {
    const off = (row % 2) * cw / 2;
    let col = 0;
    for (let x = x0 - cw + off; x < x1 + cw; x += cw, col++) feather(g, x, y, cw, ch, pal[P.cells[(row + col) % 3]], pal[P.cloison], lw);
  }
}

/** Ala de buitre: plumas largas en tres hileras, recortada al polígono del ala. */
function wing(g, pal, P, poly, angle, origin, len, s, mirror = false) {
  g.save();
  g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.clip();
  g.fillStyle = pal[P.cloison]; g.fill();
  g.translate(origin[0], origin[1]); if (mirror) g.scale(-1, 1); g.rotate(angle);
  const tiers = [{ h: 30, w: 18 }, { h: 50, w: 20 }, { h: 220, w: 24 }];
  let y = -10 * s;
  tiers.forEach((t, ti) => {
    const rows = ti === 2 ? 1 : 2;
    for (let r = 0; r < rows; r++) {
      for (let x = -40 * s; x < len; x += t.w * s) {
        const fill = pal[P.wings[(ti + r + Math.floor(x / (t.w * s))) % 3]];
        feather(g, x, y, t.w * s, t.h * s, fill, pal[P.cloison], P.lw * s);
      }
      y += t.h * s * 0.7;
    }
  });
  g.restore();
  // contorno del ala
  g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.strokeStyle = pal.goldLight; g.lineWidth = 3 * s; g.stroke();
}

function stripesH(g, pal, P, x, y, w, h, n) {
  const sh = h / n;
  for (let i = 0; i < n; i++) { g.fillStyle = pal[P.stripes[i % 2]]; g.fillRect(x, y + i * sh, w, sh); }
  g.fillStyle = pal.goldLight;
  for (let i = 0; i <= n; i++) g.fillRect(x, y + i * sh - 1, w, 2);
}

function paintLid(g, pal, W, H, P) {
  const s = W / 1024;
  const X = (u) => u * W, Y = (v) => (1 - v) * H;
  goldGrain(g, pal, W, H);
  // plumaje rishi en todo el cuerpo
  featherField(g, pal, P, 0, Y(0.87), W, Y(0.035), 26 * s, 20 * s, s);
  // alas de buitre cruzadas sobre el abdomen (una desde cada costado)
  for (const side of [0, 1]) {
    const m = (u) => (side ? 1 - u : u);
    const poly = [[X(m(0)), Y(0.6)], [X(m(0.56)), Y(0.49)], [X(m(0.56)), Y(0.43)], [X(m(0)), Y(0.4)]];
    wing(g, pal, P, poly, 0.38, [X(m(0)), Y(0.6)], W * 0.75, s, side === 1);
  }
  // columna central de inscripción (marcas genéricas)
  const cx0 = X(0.455), cw = X(0.09);
  g.fillStyle = pal.gold; g.fillRect(cx0, Y(0.4), cw, Y(0.045) - Y(0.4));
  g.strokeStyle = pal.goldDark; g.lineWidth = 2 * s; g.strokeRect(cx0, Y(0.4), cw, Y(0.045) - Y(0.4));
  pseudoGlyphs(g, pal, cx0, Y(0.4), cw, Y(0.045) - Y(0.4), true, 1.2 * s);
  // collar ancho: filas de cuentas en arcos alrededor del cuello
  const ccx = X(0.5), ccy = Y(0.86);
  const rows = [['gold', 0.012], [P.wings[0], 0.012], ['gold', 0.005], [P.wings[1], 0.011], ['gold', 0.005], [P.wings[2], 0.012], ['gold', 0.005], [P.wings[0], 0.016]];
  let r0 = 0.035 * H;
  for (const [c, dv] of rows) {
    const r1 = r0 + dv * H;
    g.beginPath(); g.arc(ccx, ccy, r1, 0, Math.PI); g.arc(ccx, ccy, r0, Math.PI, 0, true); g.closePath();
    g.fillStyle = pal[c]; g.fill();
    if (c !== 'gold') { // separadores de cuentas
      g.strokeStyle = pal[P.cloison]; g.lineWidth = 1.6 * s;
      const n = Math.round((Math.PI * r1) / (14 * s));
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI;
        g.beginPath(); g.moveTo(ccx + Math.cos(a) * r0, ccy + Math.sin(a) * r0); g.lineTo(ccx + Math.cos(a) * r1, ccy + Math.sin(a) * r1); g.stroke();
      }
    }
    r0 = r1;
  }
  // lengüetas del nemes a ambos lados del rostro
  for (const u0 of [0.25, 0.64]) stripesH(g, pal, P, X(u0), Y(0.885), X(0.11), Y(0.76) - Y(0.885), 9);
  // tocado nemes (cabeza)
  stripesH(g, pal, P, 0, 0, W, Y(0.885), 10);
  // rostro y cuello: oro liso
  g.fillStyle = pal.gold;
  g.beginPath(); g.ellipse(X(0.5), Y(0.875), X(0.12), (Y(0.83) - Y(0.92)) / 2, 0, 0, Math.PI * 2); g.fill();
  // banda de los pies
  g.fillStyle = pal.gold; g.fillRect(0, Y(0.035), W, H - Y(0.035));
}

function paintBase(g, pal, W, H, P) {
  const s = W / 1024;
  const X = (u) => u * W, Y = (v) => (1 - v) * H;
  goldGrain(g, pal, W, H);
  featherField(g, pal, P, 0, Y(0.87), W, Y(0.035), 26 * s, 20 * s, s);
  // extremos de las alas que envuelven los costados
  for (const side of [0, 1]) {
    const m = (u) => (side ? 1 - u : u);
    const poly = [[X(m(0)), Y(0.6)], [X(m(0.3)), Y(0.5)], [X(m(0.3)), Y(0.44)], [X(m(0)), Y(0.4)]];
    wing(g, pal, P, poly, 0.3, [X(m(0)), Y(0.6)], W * 0.4, s, side === 1);
  }
  // banda de inscripción en el borde superior de la caja
  for (const u0 of [0, 0.962]) {
    g.fillStyle = pal.gold; g.fillRect(X(u0), Y(0.86), X(0.038), Y(0.04) - Y(0.86));
    pseudoGlyphs(g, pal, X(u0), Y(0.86), X(0.038), Y(0.04) - Y(0.86), true, 1 * s);
  }
  stripesH(g, pal, P, 0, 0, W, Y(0.87), 10);
  g.fillStyle = pal.gold; g.fillRect(0, Y(0.035), W, H - Y(0.035));
}

/** Mapas {map, ormMap, normalMap} para una mitad ('lid' | 'base') de un ataúd. */
export function coffinMaps(variant, half) {
  const W = Math.round(1024 * TEX_SCALE), H = W * 2;
  const P = PALETTES[variant];
  return inlayMaps(`coffin-${variant}-${half}`, W, H,
    (g, pal, w, h) => (half === 'lid' ? paintLid : paintBase)(g, pal, w, h, P),
    { normal: variant === 'outer' ? 4 : 2.5, seed: variant.length * 7 + (half === 'lid' ? 1 : 2) });
}
