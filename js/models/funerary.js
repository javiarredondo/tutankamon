// Modelos procedurales de las nueve estructuras funerarias.
// Ejes: X = largo (puertas de los santuarios hacia +X, el «este»; cabeza del rey hacia −X, el «oeste»),
// Y = altura, Z = ancho. Unidades en metros. Las medidas de cada pieza están en /data/structures.js.
import * as THREE from 'three';
import { Structure } from './structure.js';
import { M, worldUV, faienceMaps, incisedMaps, maskCollarMaps, braidMaps } from '../core/materials.js';
import { coffinMaps } from '../core/coffinTextures.js';
import { inlaidMaterial, stripeMaps } from '../core/inlay.js';
import { swapInMaskModel } from './externalMask.js';

const T = 0.07; // grosor esquemático de los paneles de madera

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function mesh(geo, mat) { return new THREE.Mesh(geo, mat); }

// ======================================================================= SANTUARIOS
class Shrine extends Structure {
  applyOpen(t) {
    const a = THREE.MathUtils.degToRad(108) * t;
    if (this.doorL) this.doorL.rotation.y = -a;
    if (this.doorR) this.doorR.rotation.y = a;
  }
}

/**
 * Santuario: caja sin fondo con puertas dobles en el extremo +X.
 * roof: 'flat' (esquemático) o 'sloping' (forma per-wer, tejado inclinado hacia atrás).
 */
function buildShrine(def) {
  const s = new Shrine(def);
  const { L, W, H } = def.dims;
  const maps = def.decoration === 'faience' ? faienceMaps() : incisedMaps(def.index + 3);
  const mat = inlaidMaterial(maps, { normalScale: 0.7 });
  const tile = def.decoration === 'faience' ? 2.6 : 2.0;
  const copper = M.copper();
  const rise = def.roof === 'sloping' ? Math.min(0.32, H * 0.13) : 0;
  const doorH = (H - rise) * 0.84;
  const opt = { edges: true };

  // paredes laterales con perfil trapezoidal (tejado inclinado)
  const shape = new THREE.Shape();
  shape.moveTo(-L / 2, 0); shape.lineTo(L / 2, 0); shape.lineTo(L / 2, H); shape.lineTo(-L / 2, H - rise); shape.closePath();
  for (const side of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
    g.translate(0, 0, side > 0 ? W / 2 - T : -W / 2);
    s.add(mesh(worldUV(g, tile), mat), s.root, opt);
  }
  // pared trasera
  { const g = box(T, H - rise, W - 2 * T); g.translate(-L / 2 + T / 2, (H - rise) / 2, 0); s.add(mesh(worldUV(g, tile), mat), s.root, opt); }
  // dintel sobre las puertas
  { const g = box(T, H - doorH, W - 2 * T); g.translate(L / 2 - T / 2, doorH + (H - doorH) / 2, 0); s.add(mesh(worldUV(g, tile), mat), s.root, opt); }
  // tejado
  {
    const len = Math.hypot(L, rise);
    const g = box(len + 0.12, T, W + 0.12);
    const roofMat = def.decoration === 'faience' ? inlaidMaterial(incisedMaps(11), { normalScale: 0.6 }) : mat;
    const m = mesh(worldUV(g, 2.0), roofMat);
    m.position.set(0, H - rise / 2 + T / 2, 0);
    m.rotation.z = Math.atan2(rise, L);
    s.add(m, s.root, opt);
    if (def.roof === 'flat') { // cornisa esquemática
      const c = box(L + 0.22, 0.16, W + 0.22); c.translate(0, H + T + 0.08, 0);
      s.add(mesh(worldUV(c, 2.0), roofMat), s.root, opt);
    }
  }
  // banda de cobre en el borde inferior (documentada en los cuatro santuarios)
  {
    const band = 0.06;
    const parts = [box(L, band, 0.012), box(L, band, 0.012), box(0.012, band, W)];
    parts[0].translate(0, band / 2, W / 2 + 0.006);
    parts[1].translate(0, band / 2, -W / 2 - 0.006);
    parts[2].translate(-L / 2 - 0.006, band / 2, 0);
    for (const p of parts) { const m = mesh(p, copper); m.userData.noShadow = true; s.add(m); }
  }
  // puertas dobles (esquemáticas: una hoja por lado, bisagra en el canto exterior)
  const leafW = W / 2 - T;
  const mkDoor = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(L / 2 - T / 2, 0, side * (W / 2 - T));
    s.root.add(pivot);
    const g = box(T * 0.8, doorH, leafW - 0.004);
    g.translate(0, doorH / 2, -side * leafW / 2);
    s.add(mesh(worldUV(g, tile), mat), pivot, opt);
    // tirador / cerrojo esquemático
    const k = new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12);
    k.rotateZ(Math.PI / 2); k.translate(0.07, doorH * 0.55, -side * (leafW - 0.09));
    s.add(mesh(k, M.wood()), pivot);
    return pivot;
  };
  s.doorL = mkDoor(1);
  s.doorR = mkDoor(-1);

  // sello intacto en las puertas del segundo santuario (documentado por Carter)
  if (def.sealed) {
    const seal = new THREE.Group();
    const clay = mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.9 }));
    clay.scale.set(0.6, 1, 1);
    const rope = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), new THREE.MeshStandardMaterial({ color: 0xa48a5d, roughness: 1 }));
    rope.rotation.x = Math.PI / 2;
    seal.add(clay, rope);
    seal.position.set(L / 2 + 0.09, doorH * 0.55, 0);
    for (const c of [clay, rope]) { c.userData.structure = s; c.userData.infoId = def.id; }
    s.root.add(seal);
    s.fadeOnOpen.push(seal);
  }
  return s;
}

/** Armazón del palio con su paño (entre el primer y el segundo santuario). Se añade al santuario 2. */
function addPall(s, pallDims) {
  const { L, W, H } = pallDims;
  const wood = M.wood();
  const cloth = M.pall();
  cloth.userData = {};
  const r = 0.04;
  const opt = { infoId: 'palio' };
  for (const x of [-L / 2, L / 2]) for (const z of [-W / 2, W / 2]) {
    const g = new THREE.CylinderGeometry(r, r, H, 8); g.translate(x, H / 2, z);
    s.add(mesh(g, wood), s.root, opt);
  }
  for (const z of [-W / 2, W / 2]) { const g = new THREE.CylinderGeometry(r * 0.8, r * 0.8, L, 8); g.rotateZ(Math.PI / 2); g.translate(0, H, z); s.add(mesh(g, wood), s.root, opt); }
  for (const x of [-L / 2, 0, L / 2]) { const g = new THREE.CylinderGeometry(r * 0.8, r * 0.8, W, 8); g.rotateX(Math.PI / 2); g.translate(x, H, 0); s.add(mesh(g, wood), s.root, opt); }
  // paño de lino: lámina superior con leve caída y faldones laterales
  const top = new THREE.PlaneGeometry(L + 0.1, W + 0.1, 24, 12);
  top.rotateX(-Math.PI / 2);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (L / 2), z = p.getZ(i) / (W / 2);
    p.setY(i, H + 0.03 - 0.05 * (1 - x * x) * (1 - z * z));
  }
  top.computeVertexNormals();
  s.add(mesh(top, cloth), s.root, opt);
  for (const z of [-1, 1]) {
    const d = new THREE.PlaneGeometry(L + 0.1, 0.55, 24, 4);
    const q = d.attributes.position;
    for (let i = 0; i < q.count; i++) q.setZ(i, 0.025 * Math.sin(q.getX(i) * 7));
    d.translate(0, H - 0.25, z * (W / 2 + 0.06));
    s.add(mesh(d, cloth), s.root, opt);
  }
}

// ======================================================================= SARCÓFAGO
class Sarcophagus extends Structure {
  applyOpen(t) {
    // representación explicativa: la tapa se eleva y se desplaza a un lado
    this.lid.position.y = this.lidY + 0.7 * t;
    this.lid.position.z = 0.25 * t;
  }
}

function buildSarcophagus(def) {
  const s = new Sarcophagus(def);
  const { L, W, bodyH, lidH } = def.dims;
  const q = M.stone('quartzite');
  const gr = M.stone('granite');
  const wall = 0.13, floor = 0.12;
  const parts = [
    [box(L, floor, W), 0, floor / 2, 0],
    [box(L, bodyH - floor, wall), 0, floor + (bodyH - floor) / 2, W / 2 - wall / 2],
    [box(L, bodyH - floor, wall), 0, floor + (bodyH - floor) / 2, -W / 2 + wall / 2],
    [box(wall, bodyH - floor, W - 2 * wall), L / 2 - wall / 2, floor + (bodyH - floor) / 2, 0],
    [box(wall, bodyH - floor, W - 2 * wall), -L / 2 + wall / 2, floor + (bodyH - floor) / 2, 0],
    [box(L + 0.06, 0.07, W + 0.06), 0, bodyH - 0.035, 0], // cornisa
  ];
  for (const [g, x, y, z] of parts) { g.translate(x, y, z); s.add(mesh(worldUV(g, 1.2), q), s.root, { edges: true }); }

  // diosas protectoras en las esquinas: placas esquemáticas con alas extendidas
  const goldWing = M.gold(null, { rough: 0.45 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const fig = box(0.05, bodyH * 0.72, 0.05); fig.translate(sx * (L / 2 + 0.02), bodyH * 0.45, sz * (W / 2 + 0.02));
    s.add(mesh(fig, q), s.root);
    for (const along of ['x', 'z']) {
      const len = along === 'x' ? L * 0.32 : W * 0.32;
      const wg = box(along === 'x' ? len : 0.012, 0.09, along === 'x' ? 0.012 : len);
      wg.translate(
        along === 'x' ? sx * (L / 2 - len / 2) : sx * (L / 2 + 0.008),
        bodyH * 0.62,
        along === 'x' ? sz * (W / 2 + 0.008) : sz * (W / 2 - len / 2));
      const wm = mesh(wg, goldWing); wm.userData.noShadow = true;
      s.add(wm, s.root);
    }
  }
  // tapa de granito (con la grieta reparada, sugerida por una línea)
  s.lid = new THREE.Group();
  s.lidY = bodyH;
  s.lid.position.y = bodyH;
  s.root.add(s.lid);
  const lg = box(L + 0.06, lidH * 0.6, W + 0.06); lg.translate(0, lidH * 0.3, 0);
  s.add(mesh(worldUV(lg, 1.2), gr), s.lid, { edges: true });
  const ridge = new THREE.CylinderGeometry(W / 2 + 0.03, W / 2 + 0.03, L + 0.06, 32, 1, false, -Math.PI / 2, Math.PI);
  ridge.rotateZ(Math.PI / 2); ridge.scale(1, (lidH * 0.4) / (W / 2 + 0.03), 1); ridge.translate(0, lidH * 0.6, 0);
  s.add(mesh(ridge, gr), s.lid);
  const crack = box(0.02, lidH * 0.62, W + 0.07); crack.translate(L * 0.08, lidH * 0.3, 0);
  s.add(mesh(crack, new THREE.MeshStandardMaterial({ color: 0x5a2c24, roughness: 1 })), s.lid);
  return s;
}

// ======================================================================= ATAÚDES
// Perfil longitudinal de un ataúd antropomorfo (t: 0 = pies, 1 = cabeza; r: radio relativo).
const COFFIN_PROFILE = [
  [0, 0], [0.005, 0.45], [0.03, 0.62], [0.07, 0.6], [0.13, 0.55], [0.25, 0.6], [0.4, 0.72],
  [0.55, 0.86], [0.66, 0.96], [0.74, 1.0], [0.8, 0.97], [0.86, 0.92], [0.92, 0.86], [0.96, 0.74], [0.99, 0.45], [1, 0],
];
const MUMMY_PROFILE = [
  [0, 0], [0.006, 0.4], [0.04, 0.55], [0.12, 0.5], [0.25, 0.55], [0.4, 0.7], [0.55, 0.82], [0.68, 0.95],
  [0.76, 0.98], [0.82, 0.72], [0.85, 0.6], [0.9, 0.7], [0.95, 0.66], [0.985, 0.4], [1, 0],
];

function sampleProfile(profile, n = 72) {
  const curve = new THREE.SplineCurve(profile.map(([t, r]) => new THREE.Vector2(r, t)));
  return curve.getSpacedPoints(n);
}
function radiusAt(pts, t) {
  for (let i = 1; i < pts.length; i++) if (pts[i].y >= t) {
    const a = pts[i - 1], b = pts[i]; const k = (t - a.y) / Math.max(1e-6, b.y - a.y);
    return a.x + (b.x - a.x) * k;
  }
  return 0;
}

/**
 * Geometría de media envolvente antropomorfa. Tras la rotación, la cabeza queda en −X
 * y la mitad «lid» mira hacia +Y.
 */
export function coffinHalf(L, R, half, profile = COFFIN_PROFILE, segments = 40) {
  const pts = sampleProfile(profile).map((v) => new THREE.Vector2(Math.max(v.x * R, 1e-4), v.y * L - L / 2));
  const phiStart = half === 'lid' ? 0 : half === 'base' ? Math.PI : 0;
  const phiLen = half === 'full' ? Math.PI * 2 : Math.PI;
  const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLen);
  // v = posición real a lo largo del cuerpo (0 pies → 1 cabeza), para que la textura pintada caiga en su sitio
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) + L / 2) / L);
  g.rotateZ(Math.PI / 2);
  return g;
}

class Coffin extends Structure {
  applyOpen(t) {
    // representación explicativa: la tapa se eleva verticalmente
    this.lid.position.y = this.lidRise * t;
  }
}

/** Ataúd antropomorfo con tapa y caja; `variant`: 'outer' | 'middle' | 'inner'. */
export function buildCoffinParts(def, register) {
  const { L, W, H } = def.dims;
  const R = W / 2, sy = H / W;
  const variant = def.variant;
  // decoración pintada en el espacio UV de cada mitad (ver core/coffinTextures.js)
  const lidMat = inlaidMaterial(coffinMaps(variant, 'lid'), { normalScale: variant === 'outer' ? 0.9 : 0.6 });
  const baseMat = inlaidMaterial(coffinMaps(variant, 'base'), { normalScale: variant === 'outer' ? 0.9 : 0.6 });
  const pts = sampleProfile(COFFIN_PROFILE);
  const lid = new THREE.Group();
  const base = new THREE.Group();

  const lidMesh = mesh(coffinHalf(L, R, 'lid', COFFIN_PROFILE, 64), lidMat); lidMesh.scale.y = sy;
  const baseMesh = mesh(coffinHalf(L, R, 'base', COFFIN_PROFILE, 64), baseMat); baseMesh.scale.y = sy;
  register(baseMesh, base);
  register(lidMesh, lid);

  // posición a lo largo del eje: t (0 pies → 1 cabeza) ⇒ x = L/2 − tL
  const xAt = (t) => L / 2 - t * L;
  const topAt = (t) => radiusAt(pts, t) * R * sy;
  const gold = M.solidGold(variant === 'inner' ? 0.22 : 0.3);
  // rostro (hacia +Y); el tocado, las lengüetas y el collar están pintados en la textura
  const face = mesh(new THREE.SphereGeometry(R * 0.3, 32, 20), gold);
  face.scale.set(1.25, 0.62, 0.95);
  face.position.set(xAt(0.875), topAt(0.875) * 1.0, 0);
  register(face, lid);
  // rasgos del rostro: ojos perfilados, cejas y nariz (muy simplificados)
  const fx = xAt(0.875), fy = topAt(0.875) + R * 0.3 * 0.62;
  for (const sd of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(R * 0.05, 12, 8), M.quartz());
    eye.scale.set(0.55, 0.35, 1.4); eye.position.set(fx - R * 0.07, fy - R * 0.035, sd * R * 0.11);
    register(eye, lid);
    const pupil = mesh(new THREE.SphereGeometry(R * 0.022, 10, 8), M.obsidian());
    pupil.position.set(fx - R * 0.07, fy - R * 0.02, sd * R * 0.11);
    register(pupil, lid);
    const brow = mesh(new THREE.BoxGeometry(R * 0.025, R * 0.02, R * 0.13), M.lapis());
    brow.position.set(fx - R * 0.14, fy - R * 0.04, sd * R * 0.11);
    register(brow, lid);
  }
  const nose = mesh(new THREE.ConeGeometry(R * 0.035, R * 0.09, 10), gold);
  nose.position.set(fx + R * 0.02, fy, 0);
  register(nose, lid);
  // barba ceremonial bajo el mentón
  const beard = new THREE.CylinderGeometry(R * 0.06, R * 0.08, L * 0.055, 10);
  beard.rotateZ(Math.PI / 2);
  const bm = mesh(beard, inlaidMaterial(stripeMaps('beardC', 'gold', 'lapis', 10, true)));
  bm.position.set(xAt(0.81), topAt(0.81) + R * 0.04, 0);
  register(bm, lid);
  // brazos cruzados sobre el pecho; cada puño sujeta una insignia: cayado (heka) y flagelo (nejaja)
  const P = (t, zf, lift) => {
    const rr = Math.max(radiusAt(pts, t) * R, 1e-3), z = zf * R;
    const ySurf = topAt(t) * Math.sqrt(Math.max(0, 1 - (z / rr) ** 2));
    return new THREE.Vector3(xAt(t), ySurf + lift * R, z);
  };
  const limb = (a, b, r0, r1, mat) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(r1, r0, dir.length(), 14);
    const m = mesh(g, mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    m.position.copy(a).add(b).multiplyScalar(0.5);
    register(m, lid);
    return m;
  };
  for (const sd of [-1, 1]) {
    // antebrazo que sale del costado (en relieve) y cruza el pecho hasta el puño contrario
    const elbow = P(0.585, sd * 0.6, -0.08), fist = P(0.74, -sd * 0.26, 0.12);
    limb(elbow, fist, R * 0.17, R * 0.14, gold);
    const f = mesh(new THREE.SphereGeometry(R * 0.18, 18, 14), gold);
    f.scale.set(1.25, 0.8, 1); f.position.copy(fist);
    register(f, lid);
  }
  const insignia = inlaidMaterial(stripeMaps('insignia', 'gold', 'lapis', 16, false));
  // cayado: el mango atraviesa el puño derecho y el gancho se curva junto al hombro
  const crookPath = new THREE.CatmullRomCurve3([
    P(0.55, 0.38, 0.2), P(0.74, -0.26, 0.2), P(0.82, -0.52, 0.2),
    P(0.855, -0.62, 0.2), P(0.875, -0.5, 0.2), P(0.862, -0.36, 0.2),
  ]);
  register(mesh(new THREE.TubeGeometry(crookPath, 90, R * 0.04, 10), insignia), lid);
  // flagelo: mango por el puño izquierdo y tres ramales de cuentas que caen sobre el pecho
  const top = P(0.82, 0.52, 0.24);
  register(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([P(0.55, -0.38, 0.2), P(0.74, 0.26, 0.24), top]), 40, R * 0.04, 10), insignia), lid);
  const beadMats = [gold, M.glassBlue(), M.carnelian()];
  for (let k = -1; k <= 1; k++) {
    for (let i = 0; i < 7; i++) {
      const p = P(0.81 - i * 0.014, 0.56 + i * 0.04 + k * 0.06, 0.16);
      const bead = mesh(new THREE.SphereGeometry(R * 0.036, 8, 6), beadMats[i % 3]);
      bead.scale.set(1.3, 1, 1); bead.position.copy(p);
      register(bead, lid);
    }
  }
  return { lid, base, R, sy };
}

function buildCoffin(def) {
  const s = new Coffin(def);
  const reg = (m, parent) => s.add(m, parent);
  const { lid, base } = buildCoffinParts(def, reg);
  s.root.add(base, lid);
  s.lid = lid;
  s.lidRise = def.lidRise;
  return s;
}

// ======================================================================= MÁSCARA
/**
 * Máscara funeraria esquemática. Espacio local: rostro hacia +Z, arriba +Y, altura ≈ 0,54 m.
 * Composición simplificada: no reproduce las proporciones ni la iconografía exactas del original.
 */
export function buildMask(register) {
  const g = new THREE.Group();
  const gold = M.solidGold(0.2);
  const stripes = inlaidMaterial(stripeMaps('nemesMask', 'gold', 'lapis', 22, true), { normalScale: 0.5 });
  const add = (m) => { register(m, g); return m; };

  // tocado nemes: casquete, faldón que se abre hacia los hombros y lengüetas delanteras
  const cap = add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52), stripes));
  cap.scale.set(1.04, 0.92, 1.0); cap.position.set(0, 0.07, -0.04);
  const skirt = add(new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.215, 0.24, 64, 1, true, 0.66, Math.PI * 2 - 1.32), stripes));
  skirt.position.set(0, -0.045, -0.04);
  // cinta frontal (solo delante)
  const fband = add(new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.006, 8, 32, Math.PI * 0.7), gold));
  fband.rotation.set(Math.PI / 2, 0, Math.PI * 0.15); fband.position.set(0, 0.075, -0.04);
  for (const s of [-1, 1]) {
    const lap = add(new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.21, 0.016), stripes));
    lap.position.set(s * 0.118, -0.115, 0.07); lap.rotation.z = s * 0.06;
  }
  // coleta anillada en la nuca
  const queue = add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.11, 20), inlaidMaterial(stripeMaps('queue', 'gold', 'lapis', 14, true))));
  queue.position.set(0, -0.11, -0.27);
  // rostro
  const face = add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 40, 28), gold));
  face.scale.set(0.82, 1.08, 0.62); face.position.set(0, 0.02, 0.06);
  // orejas
  for (const s of [-1, 1]) {
    const ear = add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.008, 8, 16), gold));
    ear.position.set(s * 0.086, 0.02, 0.04); ear.rotation.y = s * Math.PI / 2;
  }
  // ojos: cuarzo y obsidiana, perfilados en azul
  const quartz = M.quartz(), obs = M.obsidian(), lapis = M.lapis();
  for (const s of [-1, 1]) {
    const w = add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10), quartz));
    w.scale.set(1.45, 0.5, 0.45); w.position.set(s * 0.034, 0.045, 0.116);
    const p = add(new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), obs));
    p.position.set(s * 0.034, 0.045, 0.121);
    // perfilado de kohl en lapislázuli, con la línea alargada hacia la sien
    const lid = add(new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0022, 6, 24), lapis));
    lid.scale.set(1, 0.42, 1); lid.position.set(s * 0.034, 0.045, 0.117);
    const ext = add(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.003, 0.004), lapis));
    ext.position.set(s * 0.062, 0.046, 0.108); ext.rotation.y = s * -0.6;
    const brow = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.006), lapis));
    brow.position.set(s * 0.035, 0.07, 0.118); brow.rotation.z = -s * 0.08;
  }
  // nariz y boca sugeridas
  const nose = add(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 10), gold));
  nose.position.set(0, 0.018, 0.122); nose.rotation.x = 0.35;
  const lips = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.026, 4, 8), gold));
  lips.rotation.z = Math.PI / 2; lips.position.set(0, -0.02, 0.112);
  // buitre y cobra sobre la frente (insignias de Nekhbet y Wadjet), muy simplificados
  const vulture = add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), gold));
  vulture.position.set(-0.012, 0.1, 0.104);
  const cobra = add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.035, 8), M.carnelian()));
  cobra.position.set(0.012, 0.104, 0.102);
  // barba trenzada
  const beard = add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.12, 16), inlaidMaterial(braidMaps(), { normalScale: 0.8 })));
  beard.position.set(0, -0.1, 0.105); beard.rotation.x = -0.2;
  // collar ancho (wesekh)
  const col = new THREE.RingGeometry(0.07, 0.25, 64, 1, Math.PI, Math.PI);
  const collar = add(new THREE.Mesh(col, inlaidMaterial(maskCollarMaps(), { normalScale: 0.7 })));
  collar.position.set(0, -0.12, 0.035); collar.rotation.x = -1.05;
  // terminales de halcón del collar (esquemáticos)
  for (const s of [-1, 1]) {
    const t = add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), gold));
    t.scale.set(1, 0.6, 0.4); t.position.set(s * 0.25, -0.12, 0.035);
  }
  return g;
}

// ======================================================================= MOMIA + MÁSCARA
function buildMummy(def) {
  const s = new Structure(def);
  const { L, W, H } = def.dims;
  const body = new THREE.Mesh(coffinHalf(L, W / 2, 'full', MUMMY_PROFILE, 36), M.linen());
  body.scale.y = H / W;
  s.add(body, s.root, { infoId: def.id });
  const maskReg = (m, parent) => s.add(m, parent, { infoId: 'mascara' });
  const procedural = buildMask(maskReg);
  const mask = new THREE.Group();
  mask.add(procedural);
  mask.rotation.set(-Math.PI / 2, Math.PI / 2, 0, 'YXZ'); // rostro → +Y, coronilla → −X
  mask.scale.setScalar(0.9);
  mask.position.set(-L / 2 + L * 0.14, H * 0.42, 0);
  s.root.add(mask);
  s.mask = mask;
  // cuando el modelo 3D de la máscara esté listo, sustituye a la versión procedural
  const procMeshes = [];
  procedural.traverse((o) => { if (o.isMesh) procMeshes.push(o); });
  swapInMaskModel(mask).then((m) => {
    if (!m) return;
    const procMats = new Set(procMeshes.map((o) => o.material));
    s.meshes = s.meshes.filter((o) => !procMeshes.includes(o));
    s.materials = s.materials.filter((mt) => !procMats.has(mt));
    m.traverse((o) => { if (o.isMesh) s.add(o, o.parent, { infoId: 'mascara' }); });
    s.applyVisual();
  });
  return s;
}

// ======================================================================= ENSAMBLAJE
/** Construye las nueve estructuras en su posición anidada. */
export function buildFunerarySet(defs) {
  const list = [];
  for (const def of defs) {
    let s;
    if (def.kind === 'shrine') s = buildShrine(def);
    else if (def.kind === 'sarcophagus') s = buildSarcophagus(def);
    else if (def.kind === 'coffin') s = buildCoffin(def);
    else s = buildMummy(def);
    if (def.pall) addPall(s, def.pall);
    s.nestedPos.set(0, def.baseY || 0, 0);
    s.root.position.copy(s.nestedPos);
    s.applyVisual();
    list.push(s);
  }
  return list;
}
