// Modelos procedurales de la galería de objetos (escala aproximada en metros).
// Todos son ESQUEMÁTICOS: indican tipo de objeto, materiales y composición general.
import * as THREE from 'three';
import { M, stripeTexture } from '../core/materials.js';
import { inlaidMaterial, stripeMaps } from '../core/inlay.js';
import { buildMask, buildCoffinParts } from './funerary.js';
import { swapInMaskModel } from './externalMask.js';
import { STRUCTURES } from '../data/structures.js';

const reg = (m, parent) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

function extrude(shape, depth, bevel = 0.002) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 18 });
  g.center();
  return g;
}

function mask() {
  const g = new THREE.Group();
  g.add(buildMask(reg)); // provisional hasta que carga el modelo 3D
  swapInMaskModel(g);
  return g;
}

function innerCoffin() {
  const g = new THREE.Group();
  const def = STRUCTURES.find((s) => s.id === 'ataud-interior');
  const { lid, base } = buildCoffinParts(def, reg);
  g.add(base, lid);
  return g;
}

function pectoral() {
  const g = new THREE.Group();
  const gold = M.solidGold(0.25);
  // marco trapezoidal
  const outer = new THREE.Shape();
  outer.moveTo(-0.07, 0); outer.lineTo(0.07, 0); outer.lineTo(0.06, 0.11); outer.lineTo(-0.06, 0.11); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.06, 0.008); hole.lineTo(-0.052, 0.102); hole.lineTo(0.052, 0.102); hole.lineTo(0.06, 0.008); hole.closePath();
  outer.holes.push(hole);
  const frame = reg(new THREE.Mesh(extrude(outer, 0.006), gold), g); frame.position.set(0, 0.055, 0);
  // escarabeo central (vidrio del desierto)
  const sc = reg(new THREE.Mesh(new THREE.SphereGeometry(0.022, 32, 20), M.desertGlass()), g);
  sc.scale.set(0.8, 1, 0.55); sc.position.set(0, 0.055, 0.006);
  const head = reg(new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 10), M.desertGlass()), g);
  head.scale.set(1, 0.7, 0.6); head.position.set(0, 0.079, 0.006);
  // alas con franjas de color
  // las coordenadas UV del extruido están en metros: se repite la textura para ver las franjas
  const wingTex = stripeTexture('wing', '#2a5bb8', '#d8af55', 10, false).clone();
  wingTex.repeat.set(22, 22); wingTex.needsUpdate = true;
  for (const s of [-1, 1]) {
    const w = new THREE.Shape();
    w.moveTo(0, 0); w.quadraticCurveTo(s * 0.03, 0.03, s * 0.048, 0.02); w.lineTo(s * 0.05, 0.004); w.quadraticCurveTo(s * 0.025, -0.012, 0, -0.008); w.closePath();
    const wm = reg(new THREE.Mesh(extrude(w, 0.003, 0.001), M.textured(wingTex, { metalness: 0.4 })), g);
    wm.position.set(s * 0.04, 0.06, 0.004);
  }
  // disco solar de cornalina sobre el escarabeo
  const disk = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.005, 32), M.carnelian()), g);
  disk.rotation.x = Math.PI / 2; disk.position.set(0, 0.096, 0.005);
  // flecos colgantes alternos
  const cols = [M.lapis(), M.carnelian(), M.turquoise()];
  for (let i = 0; i < 11; i++) {
    const x = -0.06 + i * 0.012;
    const d = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0025, 0.018, 10), cols[i % 3]), g);
    d.position.set(x, -0.006, 0.002);
  }
  // cadena esquemática
  const chain = new THREE.TorusGeometry(0.075, 0.0025, 6, 48, Math.PI);
  const cm = reg(new THREE.Mesh(chain, gold), g); cm.position.set(0, 0.11, 0);
  return g;
}

function bracelets() {
  const g = new THREE.Group();
  const gold = M.solidGold(0.25);
  const inl = [M.lapis(), M.carnelian(), M.turquoise()];
  for (const [x, rot] of [[-0.06, 0.3], [0.06, -0.2]]) {
    const b = new THREE.Group();
    reg(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 16, 48), gold), b);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const inlay = reg(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.006), inl[i % 3]), b);
      inlay.position.set(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.006); inlay.rotation.z = a;
    }
    const scar = reg(new THREE.Mesh(new THREE.SphereGeometry(0.012, 20, 12), M.lapis()), b);
    scar.scale.set(1, 1.3, 0.6); scar.position.set(0, 0.042, 0.004);
    b.position.set(x, 0.045, 0); b.rotation.set(-0.35, rot, 0);
    g.add(b);
  }
  // anillos
  const ringStones = [M.carnelian(), M.lapis(), M.turquoise()];
  ringStones.forEach((stone, i) => {
    const r = new THREE.Group();
    reg(new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0025, 10, 32), gold), r);
    const bez = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.004, 20), gold), r);
    bez.position.y = 0.013;
    const st = reg(new THREE.Mesh(new THREE.SphereGeometry(0.0055, 16, 10), stone), r);
    st.scale.y = 0.6; st.position.y = 0.0165;
    r.position.set(-0.035 + i * 0.035, 0.012, 0.075); r.rotation.y = i * 0.6;
    g.add(r);
  });
  return g;
}

function sandals() {
  const g = new THREE.Group();
  const gold = M.solidGold(0.3);
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    const L = 0.26;
    sh.moveTo(0, 0);
    sh.bezierCurveTo(0.045, 0, 0.05, 0.06, 0.042, 0.12);
    sh.bezierCurveTo(0.036, 0.18, 0.06, 0.22, 0.04, L);
    sh.bezierCurveTo(0.025, L + 0.02, -0.03, L + 0.02, -0.04, L - 0.01);
    sh.bezierCurveTo(-0.05, 0.2, -0.032, 0.17, -0.036, 0.12);
    sh.bezierCurveTo(-0.044, 0.06, -0.045, 0, 0, 0);
    const geo = extrude(sh, 0.006, 0.001);
    geo.rotateX(-Math.PI / 2);
    const sole = reg(new THREE.Mesh(geo, gold), g);
    sole.scale.x = s; sole.position.set(s * 0.06, 0.004, 0);
    // tira y poste entre los dedos
    const strap = reg(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.004, 8, 24, Math.PI), gold), g);
    strap.position.set(s * 0.06, 0.006, -0.02); strap.rotation.y = Math.PI / 2;
    const post = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 8), gold), g);
    post.position.set(s * 0.06 + s * 0.008, 0.02, 0.08);
    const link = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.11, 8), gold), g);
    link.rotation.x = Math.PI / 2 - 0.25; link.position.set(s * 0.065, 0.03, 0.03);
  }
  return g;
}

function sceptres() {
  const g = new THREE.Group();
  const mat = inlaidMaterial(stripeMaps('sceptre', 'gold', 'lapis', 24, false));
  // cayado (heka)
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.26, 0)));
  path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0.26, 0), new THREE.Vector3(0, 0.33, 0), new THREE.Vector3(-0.065, 0.34, 0), new THREE.Vector3(-0.07, 0.29, 0)));
  const crook = reg(new THREE.Mesh(new THREE.TubeGeometry(path, 64, 0.008, 12), mat), g);
  crook.position.set(-0.05, 0.02, 0); crook.rotation.z = 0.12;
  // flagelo (nejaja)
  const fl = new THREE.Group();
  const rod = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 12), mat), fl); rod.position.y = 0.12;
  const beadMats = [M.solidGold(0.3), M.glassBlue(), M.carnelian()];
  for (let k = -1; k <= 1; k++) {
    for (let i = 0; i < 9; i++) {
      const bead = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.011, 10), beadMats[i % 3]), fl);
      bead.position.set(k * (0.006 + i * 0.002), 0.24 - i * 0.012, 0);
      bead.rotation.z = k * 0.15;
    }
  }
  fl.position.set(0.05, 0.02, 0); fl.rotation.z = -0.12;
  g.add(fl);
  return g;
}

function daggers() {
  const g = new THREE.Group();
  const d = new THREE.Group();
  const blade = new THREE.Shape();
  blade.moveTo(-0.018, 0); blade.lineTo(0.018, 0); blade.quadraticCurveTo(0.016, 0.12, 0, 0.21); blade.quadraticCurveTo(-0.016, 0.12, -0.018, 0);
  const bm = reg(new THREE.Mesh(extrude(blade, 0.004, 0.0015), M.iron()), d); bm.position.y = 0.105;
  const guard = reg(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), M.solidGold(0.3)), d); guard.position.y = 0.0;
  const grip = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.09, 16),
    M.textured(stripeTexture('grip', '#d8af55', '#7b5c22', 18, true), { metalness: 0.9, roughness: 0.35 })), d);
  grip.position.y = -0.05;
  const pommel = reg(new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 14), M.rockCrystal()), d);
  pommel.scale.set(1.2, 0.7, 0.8); pommel.position.y = -0.1;
  d.position.set(-0.035, 0.11, 0); d.rotation.z = 0.05;
  g.add(d);
  // vaina de oro
  const sheath = new THREE.Shape();
  sheath.moveTo(-0.022, 0); sheath.lineTo(0.022, 0); sheath.quadraticCurveTo(0.02, 0.14, 0.006, 0.22); sheath.lineTo(-0.006, 0.22); sheath.quadraticCurveTo(-0.02, 0.14, -0.022, 0);
  const sm = reg(new THREE.Mesh(extrude(sheath, 0.01, 0.002), M.solidGold(0.28)), g);
  sm.rotation.z = Math.PI; sm.position.set(0.04, 0.12, 0);
  return g;
}

function amulets() {
  const g = new THREE.Group();
  // pilar djed
  const djed = new THREE.Group();
  const fa = M.faience(0x2f74b5);
  reg(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.07, 16), fa), djed).position.y = 0.035;
  for (let i = 0; i < 4; i++) reg(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.012), fa), djed).position.y = 0.055 + i * 0.006;
  djed.position.set(-0.09, 0, 0);
  // nudo tyet
  const tyet = new THREE.Group();
  const jas = M.redJasper();
  const loop = reg(new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0045, 10, 24), jas), tyet); loop.position.y = 0.065;
  for (const sd of [-1, 1]) { // brazos caídos, rasgo que distingue el tyet del anj
    const arm = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 8), jas), tyet);
    arm.position.set(sd * 0.014, 0.04, 0); arm.rotation.z = sd * 0.35;
  }
  const body = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 0.045, 12), jas), tyet); body.position.y = 0.024;
  tyet.position.set(-0.03, 0, 0);
  // ojo udjat
  const udjat = new THREE.Group();
  const eye = reg(new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 12), M.faience(0x2f8f86)), udjat);
  eye.scale.set(1.5, 0.75, 0.35); eye.position.y = 0.035;
  reg(new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 8), M.obsidian()), udjat).position.set(0, 0.035, 0.005);
  const brow = reg(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.006), M.obsidian()), udjat); brow.position.set(0, 0.055, 0);
  const tear = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.025, 8), M.obsidian()), udjat); tear.position.set(-0.005, 0.015, 0); tear.rotation.z = 0.2;
  const spiral = reg(new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 20, Math.PI * 1.5), M.obsidian()), udjat); spiral.position.set(0.016, 0.006, 0);
  udjat.position.set(0.03, 0, 0);
  // escarabeo
  const scar = new THREE.Group();
  const base = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 32), M.greenStone()), scar);
  base.scale.z = 1.35; base.position.y = 0.004;
  const shell = reg(new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.greenStone()), scar);
  shell.scale.set(1, 0.7, 1.35); shell.position.y = 0.008;
  reg(new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012, 0.04), M.solidGold(0.3)), scar).position.set(0, 0.016, 0.003);
  scar.position.set(0.095, 0, 0); scar.rotation.y = 0.4;
  g.add(djed, tyet, udjat, scar);
  return g;
}

export const GALLERY_BUILDERS = { mask, innerCoffin, pectoral, bracelets, sandals, sceptres, daggers, amulets };
