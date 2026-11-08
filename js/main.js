// Punto de entrada: crea las dos escenas (cámara funeraria y galería), conecta la interfaz,
// la selección con ratón/táctil y el bucle de render bajo demanda.
//
// Todo el estado de la app está en máquinas explícitas (inventario en docs/state-machines.md):
//   arranque (BOOT), modo (MODES), capas y vistas (LayerSystem), ficha (InfoPanel),
//   giro automático (AutoRotate), vuelos de cámara (canal en tween.js), calidad (QUALITY)
//   y descargas (assetStatus). `appState()` las reúne en una foto, que también se refleja en
//   atributos data-* de #app y en window.__tut.state().
import * as THREE from 'three';
import { createRenderer, createTombStage, createGalleryStage, createControls, createLabelRenderer, stopFlight } from './core/scene.js';
import { updateTweens, tweensRunning, setBaseSpeed } from './core/tween.js';
import { buildFunerarySet } from './models/funerary.js';
import { LayerSystem } from './layers/layerSystem.js';
import { Gallery } from './gallery/gallery.js';
import { AutoRotate } from './gallery/autoRotate.js';
import { InfoPanel } from './ui/infoPanel.js';
import { STRUCTURES, EXTRA_INFO } from './data/structures.js';
import { GALLERY } from './data/gallery.js';
import { createComposer, defaultQuality, saveQuality, QUALITY } from './core/postfx.js';
import { assetStatus } from './core/assets.js';

const $ = (id) => document.getElementById(id);

/** Arranque: loading ──primer fotograma──► ready;  loading ──WebGL o init fallan──► error. */
const BOOT = Object.freeze({ LOADING: 'loading', READY: 'ready', ERROR: 'error' });
let boot = BOOT.LOADING;
function setBoot(state, message) {
  boot = state;
  const app = $('app');
  if (app) app.dataset.boot = state;
  if (state !== BOOT.LOADING) $('loading')?.classList.add('done');
  if (state === BOOT.ERROR) { const err = $('error'); if (err) { err.hidden = false; err.textContent = message; } }
}

/**
 * Modos de la app (pestañas superiores). Cualquier modo puede pasar a cualquier otro;
 * cada uno declara aquí lo que cambia en la interfaz, y setMode() solo aplica esta tabla.
 */
const MODES = Object.freeze({
  discovery: {
    scene: 'tomb', compactGuide: false, layerJump: false, keys: true,
    hint: 'Arrastra para girar · rueda o pellizco para acercar · toca una pieza para ver su ficha',
  },
  free: {
    scene: 'tomb', compactGuide: true, layerJump: true, keys: true,
    hint: 'Toca cualquier pieza visible para ver su ficha · usa la lista de capas para saltar',
  },
  gallery: {
    scene: 'gallery', compactGuide: false, layerJump: false, keys: false,
    hint: 'Arrastra para girar la pieza · rueda o pellizco para acercar',
  },
});

function infoById(id) {
  return STRUCTURES.find((s) => s.id === id) || EXTRA_INFO[id] || GALLERY.find((g) => g.id === id && g.nombre);
}

function init() {
  const canvas = $('view');
  let renderer;
  try { renderer = createRenderer(canvas); }
  catch (e) {
    setBoot(BOOT.ERROR, 'Este navegador no ha podido iniciar WebGL, necesario para la escena 3D. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari, o activa la aceleración por hardware.');
    return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setBaseSpeed(2.2);

  // ------------------------------------------------------------ escenas
  const tomb = createTombStage(renderer);
  const tombControls = createControls(tomb.camera, canvas);
  const structures = buildFunerarySet(STRUCTURES);
  const labelRenderer = createLabelRenderer($('labels'));

  const gal = createGalleryStage(renderer);
  const galControls = createControls(gal.camera, canvas);
  galControls.enabled = false;
  galControls.maxPolarAngle = Math.PI * 0.6;
  // si el visitante toma la cámara, se detiene el vuelo automático en curso en vez de pelear con él
  tombControls.addEventListener('start', () => stopFlight(tomb.camera));
  galControls.addEventListener('start', () => stopFlight(gal.camera));

  const panel = new InfoPanel($('panel'), $('panel-body'), $('panel-close'));
  panel.onStateChange = () => publishState();
  let selected = null;

  const ui = {
    mode: 'discovery',
    guide: $('guide'), step: $('guide-step'), title: $('guide-title'), text: $('guide-text'), progress: $('guide-progress'),
    next: $('btn-next'), prev: $('btn-prev'), info: $('btn-info'),
    list: $('layer-list'), layersBox: $('layers'), count: $('layers-count'), note: $('layers-note'),
  };

  const layers = new LayerSystem({
    scene: tomb.scene, camera: tomb.camera, controls: tombControls, structures,
    onChange: (type) => { refreshUI(); dirty = true; if (type === 'opened' && ui.mode === 'discovery') pulseGuide(); },
  });

  const gallery = new Gallery({
    stage: gal, controls: galControls, items: GALLERY,
    resolveInfo: (item) => (item.ref ? STRUCTURES.find((s) => s.id === item.ref) : item),
  });

  // ------------------------------------------------------------ interfaz de capas
  STRUCTURES.forEach((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'layer' + (i > 0 && STRUCTURES[i - 1].group !== s.group ? ' group-start' : '');
    b.id = `layer-${i}`;
    b.innerHTML = `<span class="n">${i + 1}</span><span>${s.short}</span>`;
    b.addEventListener('click', () => {
      if (!MODES[ui.mode].layerJump) return;
      // si había otra orden en curso, goTo no hace nada y tampoco se abre la ficha
      layers.goTo(i).then((done) => done && select(structures[i], s.id));
    });
    li.appendChild(b);
    ui.list.appendChild(li);
  });
  for (let i = 0; i < STRUCTURES.length; i++) ui.progress.appendChild(document.createElement('i'));

  function refreshUI() {
    const n = layers.opened, total = STRUCTURES.length;
    const cur = STRUCTURES[Math.min(n, total - 1)];
    [...ui.list.querySelectorAll('.layer')].forEach((b, i) => {
      b.classList.toggle('opened', i < n);
      b.classList.toggle('current', i === n);
      b.setAttribute('aria-current', i === n ? 'step' : 'false');
      b.title = i < n ? 'Abierta' : i === n ? 'Etapa actual' : 'Por descubrir';
    });
    [...ui.progress.children].forEach((el, i) => { el.className = i < n ? 'on' : i === n ? 'cur' : ''; });
    const left = total - 1 - n;
    ui.count.textContent = `${n + 1}/${total}`;
    ui.note.textContent = left > 0
      ? `Quedan ${left} ${left === 1 ? 'capa' : 'capas'} por descubrir.`
      : 'Has llegado al núcleo del enterramiento.';
    ui.step.textContent = `Etapa ${n + 1} de ${total} · ${cur.group}`;
    ui.title.textContent = cur.nombre;
    ui.text.textContent = n < total - 1
      ? `${cur.narracion} Protege a: ${cur.protege}.`
      : `${cur.narracion} Usa «Capas separadas» para ver cómo encajan las nueve envolturas, o abre la galería.`;
    ui.next.textContent = layers.openable ? `Abrir ${lower(cur.short)} ›` : 'Fin de la secuencia';
    ui.prev.textContent = n > 0 ? `‹ Cerrar ${lower(STRUCTURES[n - 1].short)}` : '‹ Cerrar anterior';
    const busy = layers.busy;
    ui.next.disabled = busy || !layers.openable;
    ui.prev.disabled = busy || n === 0;
    ui.info.disabled = busy;
    for (const id of ['btn-overview', 'btn-explode', 'btn-reset']) $(id).disabled = busy;
    $('btn-overview').setAttribute('aria-pressed', String(layers.xray));
    $('btn-explode').setAttribute('aria-pressed', String(layers.exploded));
    ui.layersBox.classList.toggle('interactive', MODES[ui.mode].layerJump && !busy);
    // si la ficha abierta es de una estructura, refrescar sus acciones
    if (panel.isOpen && selected && selected.structure) showStructureInfo(selected.structure, selected.infoId, false);
    publishState();
  }
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  function pulseGuide() {
    ui.guide.animate?.([{ borderTopColor: 'var(--gold)' }, { borderTopColor: 'var(--gold-deep)' }], { duration: 900 });
  }

  ui.next.addEventListener('click', () => layers.next());
  ui.prev.addEventListener('click', () => layers.prev());
  ui.info.addEventListener('click', () => {
    const s = layers.current;
    select(s, s.def.id);
  });
  $('btn-overview').addEventListener('click', () => layers.toggleXray());
  $('btn-explode').addEventListener('click', () => layers.toggleExploded());
  $('btn-reset').addEventListener('click', () => { clearSelection(); panel.hide(); layers.reset(); });

  window.addEventListener('keydown', (e) => {
    if (!MODES[ui.mode].keys || e.target.closest?.('input,textarea')) return;
    if (e.key === 'ArrowRight') layers.next();
    if (e.key === 'ArrowLeft') layers.prev();
  });

  // ------------------------------------------------------------ selección
  function clearSelection() {
    if (selected?.structure) selected.structure.setHighlight(false);
    selected = null; dirty = true;
  }

  function showStructureInfo(s, infoId, reframe = true) {
    const item = infoById(infoId) || s.def;
    const actions = [];
    if (infoId !== 'mascara' && infoId !== 'palio') {
      if (s.index === layers.opened && layers.openable) actions.push({ label: `Abrir ${lower(s.def.short)}`, primary: true, disabled: layers.busy, run: () => layers.next() });
      if (s.index === layers.opened - 1) actions.push({ label: 'Volver a cerrar', disabled: layers.busy, run: () => layers.prev() });
      if (s.index > layers.opened && MODES[ui.mode].layerJump) actions.push({ label: 'Ir a esta capa', disabled: layers.busy, run: () => layers.goTo(s.index) });
    }
    if (infoId === 'mascara') actions.push({ label: 'Ver en la galería', run: () => { setMode('gallery'); showGalleryItem('mascara', { info: true }); } });
    if (s.index === 7) actions.push({ label: 'Ver en la galería', run: () => { setMode('gallery'); showGalleryItem('ataud-interior', { info: true }); } });
    actions.push({ label: 'Centrar vista', disabled: layers.busy, run: () => layers.frameStructure(s.index) });
    panel.show(item, actions);
    if (reframe) dirty = true;
  }

  function select(structure, infoId) {
    clearSelection();
    selected = { structure, infoId };
    structure.setHighlight(true);
    showStructureInfo(structure, infoId);
  }
  panel.onClose = () => clearSelection();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (MODES[ui.mode].scene !== 'tomb') return;
    raycaster.setFromCamera(ndc, tomb.camera);
    const hits = raycaster.intersectObject(layers.group, true).filter((h) => {
      const s = h.object.userData.structure;
      return s && h.object.visible && (layers.exploded || layers.xray || s.opacity > 0.5);
    });
    if (!hits.length) return;
    // en la vista general se elige la pieza más interior atravesada por el rayo
    const hit = layers.xray
      ? hits.reduce((a, b) => (b.object.userData.structure.index > a.object.userData.structure.index ? b : a))
      : hits[0];
    select(hit.object.userData.structure, hit.object.userData.infoId);
  });

  // ------------------------------------------------------------ galería
  const chips = $('gallery-chips');
  GALLERY.forEach((g) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.id = `chip-${g.id}`; b.role = 'option';
    b.textContent = g.short;
    b.addEventListener('click', () => showGalleryItem(g.id));
    chips.appendChild(b);
  });
  const isNarrow = () => window.matchMedia('(max-width: 760px)').matches;
  function showGalleryInfo(id) {
    const item = GALLERY.find((g) => g.id === id);
    panel.show(gallery.resolveInfo(item), [{ label: 'Restablecer vista', run: () => gallery.show(id) }]);
  }
  function showGalleryItem(id, { info = !isNarrow() } = {}) {
    [...chips.children].forEach((c) => c.setAttribute('aria-selected', String(c.id === `chip-${id}`)));
    gallery.show(id);
    // en pantallas estrechas la ficha se abre con el botón «Ficha» para no tapar la pieza
    if (info) showGalleryInfo(id); else panel.hide();
    dirty = true;
  }
  $('btn-gallery-info').addEventListener('click', () => gallery.current && showGalleryInfo(gallery.current.id));
  // giro automático: se pausa mientras el visitante manipula la pieza y se reanuda 2,5 s después
  const autoRotate = new AutoRotate(galControls, {
    onChange: () => {
      $('btn-autorotate').setAttribute('aria-pressed', String(autoRotate.enabled));
      dirty = true;
      publishState();
    },
  });
  $('btn-autorotate').addEventListener('click', () => autoRotate.toggle());
  $('btn-gallery-reset').addEventListener('click', () => gallery.current && gallery.show(gallery.current.id));

  // ------------------------------------------------------------ modos
  function setMode(mode) {
    const cfg = MODES[mode];
    if (!cfg) throw new Error(`Modo desconocido: ${mode}`);
    ui.mode = mode;
    for (const b of document.querySelectorAll('.mode')) b.setAttribute('aria-selected', String(b.dataset.mode === mode));
    const isGallery = cfg.scene === 'gallery';
    tombControls.enabled = !isGallery;
    galControls.enabled = isGallery;
    $('tomb-tools').hidden = isGallery;
    $('gallery-tools').hidden = !isGallery;
    $('layers').hidden = isGallery;
    ui.guide.hidden = isGallery;
    $('gallery-bar').hidden = !isGallery;
    $('labels').hidden = isGallery;
    ui.guide.classList.toggle('compact', cfg.compactGuide);
    panel.hide();
    clearSelection();
    if (isGallery) showGalleryItem((gallery.current || GALLERY[0]).id);
    $('hint').textContent = cfg.hint;
    refreshUI();
    dirty = true;
  }
  for (const b of document.querySelectorAll('.mode')) b.addEventListener('click', () => setMode(b.dataset.mode));

  // ------------------------------------------------------------ render
  let dirty = true;
  tombControls.addEventListener('change', () => { dirty = true; });
  galControls.addEventListener('change', () => { dirty = true; });
  window.addEventListener('tut:redraw', () => { dirty = true; });

  // calidad: «alta» añade oclusión ambiental (posprocesado); se crea solo al usarse
  let quality = defaultQuality(); // QUALITY.HIGH | QUALITY.NORMAL
  const fx = { tomb: null, gal: null };
  function composerFor(which) {
    if (!fx[which]) {
      fx[which] = which === 'tomb'
        ? createComposer(renderer, tomb.scene, tomb.camera, { radius: 0.4 })
        : createComposer(renderer, gal.scene, gal.camera, { radius: 0.08 });
      fx[which].setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    }
    return fx[which];
  }
  function refreshQuality() {
    const high = quality === QUALITY.HIGH;
    for (const b of document.querySelectorAll('.btn-quality')) {
      b.textContent = high ? 'Calidad: alta' : 'Calidad: normal';
      b.setAttribute('aria-pressed', String(high));
      b.title = high ? 'Sombreado de relieves activado (más exigente)' : 'Modo ligero para tabletas y equipos modestos';
    }
  }
  function setQuality(q) {
    if (!Object.values(QUALITY).includes(q)) throw new Error(`Calidad desconocida: ${q}`);
    quality = q;
    saveQuality(quality);
    refreshQuality();
    publishState();
    dirty = true;
  }
  for (const b of document.querySelectorAll('.btn-quality')) b.addEventListener('click', () => {
    setQuality(quality === QUALITY.HIGH ? QUALITY.NORMAL : QUALITY.HIGH);
  });
  refreshQuality();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    for (const cam of [tomb.camera, gal.camera]) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    labelRenderer.setSize(w, h);
    for (const k of ['tomb', 'gal']) fx[k] && fx[k].setSize(w, h);
    dirty = true;
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ estado observable
  /** Foto serializable de todas las máquinas de estado (para pruebas, depuración y agentes). */
  function appState() {
    return {
      boot, mode: ui.mode,
      layers: layers.snapshot(),
      panel: panel.state,
      selection: selected ? selected.infoId : null,
      gallery: { item: gallery.current?.id ?? null, autoRotate: autoRotate.state },
      quality,
      assets: { ...assetStatus },
    };
  }
  // reflejo en el DOM: <div id="app" data-mode="free" data-view="nested" data-activity="idle" …>
  const appEl = $('app');
  function publishState() {
    const st = appState(), d = appEl.dataset;
    d.boot = st.boot; d.mode = st.mode;
    d.opened = st.layers.opened; d.view = st.layers.view; d.activity = st.layers.activity;
    d.panel = st.panel; d.autorotate = st.gallery.autoRotate; d.quality = st.quality;
  }
  window.addEventListener('tut:asset', () => publishState());

  layers.updateLabels();
  layers.frameCurrent(0);
  refreshUI();

  const clock = new THREE.Clock();
  let first = true;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const animating = tweensRunning();
    updateTweens(dt);
    const isGallery = MODES[ui.mode].scene === 'gallery';
    const ctl = isGallery ? galControls : tombControls;
    const moved = ctl.update(dt);
    if (!(dirty || animating || moved || (isGallery && autoRotate.rotating))) return;
    dirty = false;
    const high = quality === QUALITY.HIGH;
    if (isGallery) {
      if (high) composerFor('gal').render(); else renderer.render(gal.scene, gal.camera);
    } else {
      if (high) composerFor('tomb').render(); else renderer.render(tomb.scene, tomb.camera);
      labelRenderer.render(tomb.scene, tomb.camera);
    }
    if (first) { first = false; setBoot(BOOT.READY); publishState(); }
  }
  frame();

  // acceso para pruebas automáticas y agentes (ver AGENTS.md)
  window.__tut = {
    state: appState, layers, gallery, autoRotate, panel, structures,
    setMode, setQuality, select, showGalleryItem, setBaseSpeed,
  };
}

try { init(); }
catch (e) {
  console.error(e);
  setBoot(BOOT.ERROR, 'No se ha podido iniciar la escena: ' + e.message);
}
