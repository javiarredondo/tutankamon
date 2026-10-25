// Punto de entrada: crea las dos escenas (cámara funeraria y galería), conecta la interfaz,
// la selección con ratón/táctil y el bucle de render bajo demanda.
import * as THREE from 'three';
import { createRenderer, createTombStage, createGalleryStage, createControls, createLabelRenderer } from './core/scene.js';
import { updateTweens, tweensRunning, setBaseSpeed } from './core/tween.js';
import { buildFunerarySet } from './models/funerary.js';
import { LayerSystem } from './layers/layerSystem.js';
import { Gallery } from './gallery/gallery.js';
import { InfoPanel } from './ui/infoPanel.js';
import { STRUCTURES, EXTRA_INFO } from './data/structures.js';
import { GALLERY } from './data/gallery.js';

const $ = (id) => document.getElementById(id);

function infoById(id) {
  return STRUCTURES.find((s) => s.id === id) || EXTRA_INFO[id] || GALLERY.find((g) => g.id === id && g.nombre);
}

function init() {
  const canvas = $('view');
  let renderer;
  try { renderer = createRenderer(canvas); }
  catch (e) {
    $('loading').classList.add('done');
    const err = $('error'); err.hidden = false;
    err.textContent = 'Este navegador no ha podido iniciar WebGL, necesario para la escena 3D. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari, o activa la aceleración por hardware.';
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
  galControls.autoRotate = true;
  galControls.maxPolarAngle = Math.PI * 0.6;

  const panel = new InfoPanel($('panel'), $('panel-body'), $('panel-close'));
  let selected = null;

  const ui = {
    mode: 'discovery',
    guide: $('guide'), step: $('guide-step'), title: $('guide-title'), text: $('guide-text'), progress: $('guide-progress'),
    next: $('btn-next'), prev: $('btn-prev'), info: $('btn-info'),
    list: $('layer-list'), layersBox: $('layers'), count: $('layers-count'), note: $('layers-note'),
  };

  const layers = new LayerSystem({
    scene: tomb.scene, camera: tomb.camera, controls: tombControls, structures,
    onChange: (kind) => { refreshUI(); dirty = true; if (kind === 'opened' && ui.mode === 'discovery') pulseGuide(); },
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
      if (ui.mode !== 'free') return;
      layers.goTo(i).then(() => select(structures[i], s.id));
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
    ui.layersBox.classList.toggle('interactive', ui.mode === 'free' && !busy);
    // si la ficha abierta es de una estructura, refrescar sus acciones
    if (!panel.root.hidden && selected && selected.structure) showStructureInfo(selected.structure, selected.infoId, false);
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
    if (ui.mode === 'gallery' || e.target.closest?.('input,textarea')) return;
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
      if (s.index > layers.opened && ui.mode === 'free') actions.push({ label: 'Ir a esta capa', disabled: layers.busy, run: () => layers.goTo(s.index) });
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
    if (ui.mode === 'gallery') return;
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
  $('btn-autorotate').addEventListener('click', (e) => {
    galControls.autoRotate = !galControls.autoRotate;
    e.currentTarget.setAttribute('aria-pressed', String(galControls.autoRotate));
  });
  $('btn-gallery-reset').addEventListener('click', () => gallery.current && gallery.show(gallery.current.id));
  // detener el giro automático mientras el usuario manipula la pieza
  galControls.addEventListener('start', () => { galControls._wasAuto = galControls.autoRotate; galControls.autoRotate = false; });
  galControls.addEventListener('end', () => { setTimeout(() => { if (galControls._wasAuto) galControls.autoRotate = true; }, 2500); });

  // ------------------------------------------------------------ modos
  function setMode(mode) {
    ui.mode = mode;
    for (const b of document.querySelectorAll('.mode')) b.setAttribute('aria-selected', String(b.dataset.mode === mode));
    const isGallery = mode === 'gallery';
    tombControls.enabled = !isGallery;
    galControls.enabled = isGallery;
    $('tomb-tools').hidden = isGallery;
    $('gallery-tools').hidden = !isGallery;
    $('layers').hidden = isGallery;
    ui.guide.hidden = isGallery;
    $('gallery-bar').hidden = !isGallery;
    $('labels').hidden = isGallery;
    ui.guide.classList.toggle('compact', mode === 'free');
    panel.hide();
    clearSelection();
    if (isGallery && !gallery.current) showGalleryItem(GALLERY[0].id);
    else if (isGallery) showGalleryItem(gallery.current.id);
    $('hint').textContent = isGallery
      ? 'Arrastra para girar la pieza · rueda o pellizco para acercar'
      : mode === 'free'
        ? 'Toca cualquier pieza visible para ver su ficha · usa la lista de capas para saltar'
        : 'Arrastra para girar · rueda o pellizco para acercar · toca una pieza para ver su ficha';
    refreshUI();
    dirty = true;
  }
  for (const b of document.querySelectorAll('.mode')) b.addEventListener('click', () => setMode(b.dataset.mode));

  // ------------------------------------------------------------ render
  let dirty = true;
  tombControls.addEventListener('change', () => { dirty = true; });
  galControls.addEventListener('change', () => { dirty = true; });
  window.addEventListener('tut:redraw', () => { dirty = true; });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    for (const cam of [tomb.camera, gal.camera]) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    labelRenderer.setSize(w, h);
    dirty = true;
  }
  window.addEventListener('resize', resize);
  resize();

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
    const isGallery = ui.mode === 'gallery';
    const ctl = isGallery ? galControls : tombControls;
    const moved = ctl.update(dt);
    if (!(dirty || animating || moved || (isGallery && galControls.autoRotate))) return;
    dirty = false;
    if (isGallery) renderer.render(gal.scene, gal.camera);
    else { renderer.render(tomb.scene, tomb.camera); labelRenderer.render(tomb.scene, tomb.camera); }
    if (first) { first = false; $('loading').classList.add('done'); }
  }
  frame();

  // acceso para pruebas automáticas
  window.__tut = { layers, gallery, setMode, select, structures, panel, showGalleryItem, setBaseSpeed };
}

try { init(); }
catch (e) {
  console.error(e);
  const err = document.getElementById('error');
  document.getElementById('loading')?.classList.add('done');
  if (err) { err.hidden = false; err.textContent = 'No se ha podido iniciar la escena: ' + e.message; }
}
