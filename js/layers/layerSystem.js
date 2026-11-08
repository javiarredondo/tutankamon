// Sistema de navegación entre capas: abrir/cerrar en orden, saltar a una etapa,
// vista general (rayos X), vista de capas separadas y encuadre automático de la cámara.
//
// Estado (ver docs/state-machines.md):
//   opened    0..8   cuántas capas están abiertas; la «actual» es la siguiente por abrir
//   view      VIEW   cómo se muestra el conjunto: nested | overview | exploded (excluyentes)
//   activity  ACTIVITY  idle o la orden en curso. Mientras no es idle se ignoran órdenes nuevas
//                       (los métodos devuelven false) y la interfaz desactiva los botones.
// `view` y `opened` toman su valor final al EMPEZAR la transición; `activity` dice si aún se anima.
// Entre overview y exploded se pasa siempre por nested; next/prev/goTo/reset vuelven antes a nested.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { tween, tweenNumber, setSpeed, Ease } from '../core/tween.js';
import { flyTo } from '../core/scene.js';

const DIRS = {
  shrine: new THREE.Vector3(1, 0.62, 0.95),
  sarcophagus: new THREE.Vector3(1, 0.95, 0.85),
  coffin: new THREE.Vector3(0.55, 1.35, 0.85),
  mummy: new THREE.Vector3(0.45, 1.5, 0.75),
  overview: new THREE.Vector3(1, 0.75, 1.05),
  exploded: new THREE.Vector3(0.12, 1.05, 1),
};

/** Cómo se muestra el conjunto de capas. */
export const VIEW = Object.freeze({
  NESTED: 'nested',       // cada capa en su sitio; las abiertas, como silueta translúcida
  OVERVIEW: 'overview',   // «Vista general»: todas translúcidas por igual (rayos X)
  EXPLODED: 'exploded',   // «Capas separadas»: las nueve piezas alineadas en dos filas
});

/** Orden en curso. Solo puede haber una a la vez. */
export const ACTIVITY = Object.freeze({
  IDLE: 'idle',
  OPENING: 'opening',         // next()
  CLOSING: 'closing',         // prev()
  JUMPING: 'jumping',         // goTo(): abre o cierra en orden hasta la etapa pedida
  CHANGING_VIEW: 'changing-view', // setView() / toggleXray() / toggleExploded()
  RESETTING: 'resetting',     // reset()
});

/**
 * Avisos a `onChange(type, structure?)`:
 *   'activity'  empieza una orden (activity deja de ser idle)
 *   'opened'    una capa termina de abrirse (llega `structure`); opened ya ha aumentado
 *   'closing'   una capa empieza a cerrarse (llega `structure`); opened ya ha disminuido
 *   'idle'      la orden ha terminado
 */
export class LayerSystem {
  constructor({ scene, camera, controls, structures, onChange }) {
    Object.assign(this, { scene, camera, controls, structures, onChange });
    this.opened = 0;
    this.view = VIEW.NESTED;
    this.activity = ACTIVITY.IDLE;
    this.group = new THREE.Group();
    scene.add(this.group);
    for (const s of structures) this.group.add(s.root);
    this._computeBounds();
    this._computeExplodedLayout();
    this._buildLabels();
    this._buildChamberOutline();
  }

  get count() { return this.structures.length; }
  get current() { return this.structures[Math.min(this.opened, this.count - 1)]; }
  get openable() { return this.opened < this.count - 1; }
  get busy() { return this.activity !== ACTIVITY.IDLE; }
  get xray() { return this.view === VIEW.OVERVIEW; }
  get exploded() { return this.view === VIEW.EXPLODED; }

  /** Foto del estado, serializable (para la interfaz, las pruebas y los agentes). */
  snapshot() {
    return {
      opened: this.opened, total: this.count, current: this.current.def.id,
      openable: this.openable, view: this.view, activity: this.activity,
    };
  }

  _computeBounds() {
    this.bounds = this.structures.map((s) => {
      const box = new THREE.Box3().setFromObject(s.root);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      return { box, sphere };
    });
  }

  /** Dos filas: santuarios detrás, sarcófago, ataúdes y momia delante. */
  _computeExplodedLayout() {
    const rows = [this.structures.slice(0, 4), this.structures.slice(4)];
    const gaps = [1.0, 1.15];
    const zs = [-2.7, 1.55];
    rows.forEach((row, ri) => {
      const lens = row.map((s) => { const b = this.bounds[s.index].box; return b.max.x - b.min.x; });
      const total = lens.reduce((a, b) => a + b, 0) + gaps[ri] * (row.length - 1);
      let x = -total / 2;
      row.forEach((s, i) => {
        const yLift = s.def.kind === 'shrine' ? 0 : -this.bounds[s.index].box.min.y + s.nestedPos.y;
        s.explodedPos.set(x + lens[i] / 2, yLift, zs[ri]);
        x += lens[i] + gaps[ri];
      });
    });
    const all = new THREE.Box3();
    for (const s of this.structures) {
      const b = this.bounds[s.index].box.clone().translate(s.explodedPos.clone().sub(s.nestedPos));
      all.union(b);
    }
    this.explodedSphere = all.getBoundingSphere(new THREE.Sphere());
  }

  _buildLabels() {
    this.labels = this.structures.map((s) => {
      const el = document.createElement('div');
      el.className = 'label3d';
      el.innerHTML = `<b>${s.index + 1}</b>${s.def.short}`;
      const obj = new CSS2DObject(el);
      const b = this.bounds[s.index].box;
      obj.position.set(0, b.max.y - s.nestedPos.y + 0.12, 0);
      obj.visible = false;
      s.root.add(obj);
      return obj;
    });
  }

  _buildChamberOutline() {
    // Planta aproximada de la cámara funeraria (contexto; medidas por verificar).
    const w = 6.37, d = 4.02;
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]].map(([x, z]) => new THREE.Vector3(x, 0.005, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: 0x8a7a62, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.7 }));
    line.computeLineDistances();
    const el = document.createElement('div');
    el.className = 'label3d floor';
    el.textContent = 'Planta aprox. de la cámara funeraria (≈ 6,4 × 4,0 m, por verificar)';
    const lbl = new CSS2DObject(el);
    lbl.position.set(-w / 2, 0.02, d / 2 + 0.3);
    line.add(lbl);
    this.chamber = line;
    this.scene.add(line);
  }

  updateLabels() {
    const showChamber = !this.exploded;
    this.chamber.visible = showChamber;
    this.labels.forEach((l, i) => {
      l.visible = this.exploded || i === Math.min(this.opened, this.count - 1);
    });
  }

  // ---------------------------------------------------------------- cámara
  focusSphereFor(i) {
    const s = this.structures[i];
    const sp = this.bounds[i].sphere.clone();
    sp.center.add(s.root.position.clone().sub(s.nestedPos));
    return sp;
  }
  dirFor(i) { return DIRS[this.structures[i].def.kind].clone(); }

  frameCurrent(duration = 1.4) {
    if (this.exploded) return flyTo(this.camera, this.controls, this.explodedSphere.center.clone().add(new THREE.Vector3(0, -0.6, 0.6)), this.explodedSphere.radius * 0.66, DIRS.exploded, duration);
    if (this.xray) { const b = this.bounds[0].sphere; return flyTo(this.camera, this.controls, b.center, b.radius * 0.95, DIRS.overview, duration); }
    const i = Math.min(this.opened, this.count - 1);
    const sp = this.focusSphereFor(i);
    const r = this.structures[i].def.kind === 'shrine' ? sp.radius * 1.2 : sp.radius * 1.15;
    return flyTo(this.camera, this.controls, sp.center, r, this.dirFor(i), duration);
  }
  frameStructure(i, duration = 1.2) {
    const sp = this.focusSphereFor(i);
    const r = this.exploded ? sp.radius * 1.1 : sp.radius;
    return flyTo(this.camera, this.controls, sp.center, r, this.dirFor(i), duration);
  }

  // ---------------------------------------------------------------- etapas
  /** Ejecuta una orden si no hay otra en curso. Devuelve true si se ejecutó. */
  async _run(activity, fn) {
    if (this.busy) return false;
    this.activity = activity; this.onChange?.('activity');
    try { await fn(); } finally { this.activity = ACTIVITY.IDLE; this.onChange?.('idle'); }
    return true;
  }

  /** Abre la capa actual: puertas o tapa (animación explicativa) y después transparencia gradual. */
  async _openOne() {
    const s = this.structures[this.opened];
    await tweenNumber(0, 1, (v) => s.setOpen(v), { duration: 1.35, ease: Ease.inOut });
    this.opened++;
    this.updateLabels();
    this.onChange?.('opened', s);
    await Promise.all([
      tweenNumber(0, 1, (v) => { s.ghostOpen = v; s.applyVisual(); }, { duration: 1.0, ease: Ease.inOut }),
      this._fadeOlder(),
      this.frameCurrent(1.3),
    ]);
  }

  async _closeOne() {
    const s = this.structures[this.opened - 1];
    this.opened--;
    this.updateLabels();
    this.onChange?.('closing', s);
    await Promise.all([
      tweenNumber(1, 0, (v) => { s.ghostOpen = v; s.applyVisual(); }, { duration: 0.8 }),
      this._fadeOlder(),
      this.frameCurrent(1.1),
    ]);
    await tweenNumber(1, 0, (v) => s.setOpen(v), { duration: 1.1 });
  }

  /** Las capas abiertas más exteriores se atenúan más, para no enturbiar la vista. */
  _fadeOlder(duration = 1.0) {
    const targets = this.structures.map((s, i) => (i < this.opened - 1 ? 0 : 1));
    const from = this.structures.map((s) => s.ghostScale);
    return tween({ duration, onUpdate: (k) => this.structures.forEach((s, i) => {
      if (from[i] === targets[i]) return;
      s.ghostScale = from[i] + (targets[i] - from[i]) * k; s.applyVisual();
    }) });
  }

  /** Vuelve a la vista anidada sin reencuadrar (paso previo a abrir o cerrar capas). */
  async _leaveSpecialViews() {
    if (this.view === VIEW.EXPLODED) await this._setExploded(false, false);
    if (this.view === VIEW.OVERVIEW) await this._setXray(false, false);
  }

  next() {
    if (!this.openable) return Promise.resolve(false);
    return this._run(ACTIVITY.OPENING, async () => { await this._leaveSpecialViews(); await this._openOne(); });
  }
  prev() {
    if (this.opened === 0) return Promise.resolve(false);
    return this._run(ACTIVITY.CLOSING, async () => { await this._leaveSpecialViews(); await this._closeOne(); });
  }

  /** Salta a una etapa abriendo o cerrando en orden, más deprisa (sin desaparecer de golpe). */
  goTo(target) {
    target = THREE.MathUtils.clamp(target, 0, this.count - 1);
    if (target === this.opened) return this._run(ACTIVITY.JUMPING, async () => { await this._leaveSpecialViews(); await this.frameCurrent(1); });
    return this._run(ACTIVITY.JUMPING, async () => {
      await this._leaveSpecialViews();
      const steps = Math.abs(target - this.opened);
      setSpeed(steps > 1 ? 2.6 : 1.4);
      try {
        while (this.opened < target) await this._openOne();
        while (this.opened > target) await this._closeOne();
      } finally { setSpeed(1); }
    });
  }

  // ---------------------------------------------------------------- vistas
  /** Pasa a la vista `target`; entre overview y exploded, a través de nested. */
  setView(target) {
    if (!Object.values(VIEW).includes(target)) throw new Error(`Vista desconocida: ${target}`);
    return this._run(ACTIVITY.CHANGING_VIEW, async () => {
      if (target === this.view) return;
      if (target === VIEW.NESTED) {
        // salir de la vista especial reencuadrando la etapa actual
        if (this.view === VIEW.EXPLODED) await this._setExploded(false);
        else await this._setXray(false);
        return;
      }
      await this._leaveSpecialViews();
      if (target === VIEW.OVERVIEW) await this._setXray(true);
      else await this._setExploded(true);
    });
  }
  toggleXray() { return this.setView(this.view === VIEW.OVERVIEW ? VIEW.NESTED : VIEW.OVERVIEW); }
  toggleExploded() { return this.setView(this.view === VIEW.EXPLODED ? VIEW.NESTED : VIEW.EXPLODED); }

  // Animaciones de vista: cambian `view` al empezar y no comprueban si hay otra orden en curso
  // (eso lo hace quien las llama, siempre desde _run).
  async _setXray(on, reframe = true) {
    this.view = on ? VIEW.OVERVIEW : VIEW.NESTED;
    this.updateLabels();
    const targets = this.structures.map((s, i) => (on && i < this.count - 1 ? 1 : 0));
    const from = this.structures.map((s) => s.xray);
    // en la vista general todas las capas recuperan la misma transparencia
    const gTo = this.structures.map((s, i) => (on || i >= this.opened - 1 ? 1 : 0));
    const gFrom = this.structures.map((s) => s.ghostScale);
    await Promise.all([
      tween({ duration: 1.0, onUpdate: (k) => this.structures.forEach((s, i) => {
        s.xray = from[i] + (targets[i] - from[i]) * k;
        s.ghostScale = gFrom[i] + (gTo[i] - gFrom[i]) * k;
        s.applyVisual();
      }) }),
      reframe ? this.frameCurrent(1.2) : Promise.resolve(),
    ]);
  }
  async _setExploded(on, reframe = true) {
    this.view = on ? VIEW.EXPLODED : VIEW.NESTED;
    this.updateLabels();
    const n = this.count;
    const from = this.structures.map((s) => s.explode);
    await Promise.all([
      tween({
        duration: 1.9, ease: Ease.linear,
        onUpdate: (k) => this.structures.forEach((s, i) => {
          // escalonado: las capas exteriores se mueven primero al separar y últimas al reunir
          const order = on ? i : n - 1 - i;
          const local = THREE.MathUtils.clamp((k - order * 0.05) / (1 - (n - 1) * 0.05), 0, 1);
          const e = Ease.inOut(local);
          s.setExplode(from[i] + ((on ? 1 : 0) - from[i]) * e);
        }),
      }),
      reframe ? this.frameCurrent(1.9) : Promise.resolve(),
    ]);
  }
  reset() {
    return this._run(ACTIVITY.RESETTING, async () => {
      await this._leaveSpecialViews();
      if (this.opened > 0) {
        setSpeed(3);
        try { while (this.opened > 0) await this._closeOne(); } finally { setSpeed(1); }
      }
      await this.frameCurrent(1.2);
    });
  }
}
