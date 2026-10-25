// Estructura funeraria genérica: agrupa mallas, gestiona su apertura (0 = cerrada, 1 = abierta),
// su transparencia («fantasma») y el resaltado al seleccionarla.
import * as THREE from 'three';

const GHOST_OPACITY = 0.07;      // capa ya abierta: queda como silueta translúcida
const GHOST_EDGE_OPACITY = 0.42;
const HIGHLIGHT = new THREE.Color(0x4a3210);

export class Structure {
  constructor(def) {
    this.def = def;            // datos de /data/structures.js
    this.index = def.index;
    this.root = new THREE.Group();
    this.root.name = def.id;
    this.materials = [];
    this.meshes = [];
    this.edges = [];
    this.fadeOnOpen = [];      // elementos que desaparecen al abrir (p. ej. el sello)
    this.open = 0;
    this.ghostOpen = 0;        // 0..1 debido a haber sido abierta
    this.xray = 0;             // 0..1 por la vista general
    this.ghostScale = 1;       // <1 para capas abiertas hace tiempo: aún más discretas
    this.explode = 0;          // 0..1 vista de capas separadas (anula la transparencia)
    this.nestedPos = new THREE.Vector3();
    this.explodedPos = new THREE.Vector3();
    this._lastOpacity = 1;
  }

  /** Registra una malla como parte de la estructura (seleccionable y con transparencia). */
  add(mesh, parent = this.root, { infoId = null, edges = false, ghostable = true } = {}) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.structure = this;
    mesh.userData.infoId = infoId || this.def.id;
    parent.add(mesh);
    this.meshes.push(mesh);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!this.materials.includes(m)) {
        m.userData.baseOpacity = m.opacity;
        m.userData.baseTransparent = m.transparent;
        m.userData.ghostable = ghostable;
        this.materials.push(m);
      }
    }
    if (edges) {
      const eg = new THREE.EdgesGeometry(mesh.geometry, 25);
      const lm = new THREE.LineBasicMaterial({ color: 0xd9b25c, transparent: true, opacity: 0, depthWrite: false });
      const line = new THREE.LineSegments(eg, lm);
      line.visible = false;
      line.raycast = () => {};
      mesh.add(line);
      this.edges.push(line);
    }
    return mesh;
  }

  /** Transparencia efectiva: la mayor de «abierta» y «rayos X», anulada en vista separada. */
  effectiveGhost() { return Math.max(this.ghostOpen, this.xray) * (1 - this.explode); }

  applyVisual() {
    const g = this.effectiveGhost();
    const op = 1 - g * (1 - GHOST_OPACITY * this.ghostScale);
    for (const m of this.materials) {
      if (!m.userData.ghostable) continue;
      const base = m.userData.baseOpacity ?? 1;
      const target = base * op;
      const wantTransparent = target < 0.999 || m.userData.baseTransparent;
      if (m.transparent !== wantTransparent) { m.transparent = wantTransparent; m.needsUpdate = true; }
      m.opacity = target;
      m.visible = target > 0.004; // capas muy antiguas: solo queda el contorno
      m.depthWrite = op > 0.5;
    }
    const solid = op > 0.5;
    for (const mesh of this.meshes) mesh.castShadow = solid && !mesh.userData.noShadow;
    for (const l of this.edges) { l.visible = g > 0.02; l.material.opacity = GHOST_EDGE_OPACITY * g * (0.3 + 0.7 * this.ghostScale); }
    // el sello y elementos similares se desvanecen al empezar a abrir
    for (const o of this.fadeOnOpen) {
      const k = Math.max(0, 1 - this.open * 3);
      o.visible = k > 0.01;
      o.traverse((c) => { if (c.material) { c.material.transparent = true; c.material.opacity = k * (1 - g * 0.9); } });
    }
    this._lastOpacity = op;
  }

  /** Opacidad actual (para decidir si se puede seleccionar con el ratón). */
  get opacity() { return this._lastOpacity; }

  setOpen(t) { this.open = t; this.applyOpen(t); this.applyVisual(); }
  applyOpen() { /* lo implementa cada tipo */ }

  setHighlight(on) {
    for (const m of this.materials) {
      if (!m.emissive) continue;
      m.emissive.copy(on ? HIGHLIGHT : new THREE.Color(0));
    }
  }

  /** Coloca la raíz entre la posición anidada y la de vista separada. */
  setExplode(t) {
    this.explode = t;
    this.root.position.lerpVectors(this.nestedPos, this.explodedPos, t);
    this.applyVisual();
  }
}
