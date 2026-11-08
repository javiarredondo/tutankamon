# Guía para agentes (y personas que automatizan)

Prototipo 3D en Three.js, sin framework ni paso de compilación para desarrollar. Textos y comentarios
en español. Arquitectura en el [README](README.md); estados y transiciones en
[docs/state-machines.md](docs/state-machines.md).

## Ejecutar

- Desarrollo: `python3 -m http.server 8000` y abrir `http://localhost:8000/` (Three.js llega del CDN
  jsDelivr por el importmap de `index.html`).
- Sin acceso al CDN (p. ej. en un contenedor): `npm install && npm run build:dist` y servir `dist/`;
  abrir `tutankamon-local.html`, que lleva Three.js dentro.
- `?lite` quita sombras y baja la resolución (mucho más rápido en Chromium sin GPU).

## Leer el estado

`window.__tut.state()` devuelve una foto serializable de todas las máquinas de estado:

```js
{ boot: 'ready', mode: 'free',
  layers: { opened: 4, total: 9, current: 'sarcofago', openable: true, view: 'nested', activity: 'idle' },
  panel: 'closed', selection: null,
  gallery: { item: null, autoRotate: 'on' },
  quality: 'normal', assets: { hdri: 'ready', mask: 'ready' } }
```

Lo mismo, resumido, en atributos de `#app`: `data-boot`, `data-mode`, `data-opened`, `data-view`,
`data-activity`, `data-panel`, `data-autorotate`, `data-quality`. Sirven para esperar en pruebas:

```js
await page.waitForSelector('#app[data-boot="ready"]');
await page.click('#btn-next');
await page.waitForSelector('#app[data-activity="idle"]');
```

## Actuar

Preferir los botones de la interfaz (ids estables: `btn-next`, `btn-prev`, `btn-overview`,
`btn-explode`, `btn-reset`, `mode-discovery|free|gallery`, `layer-0…8`, `chip-<id>`,
`btn-autorotate`, `btn-quality`). Desde código, `window.__tut`:

- `layers.next()`, `prev()`, `goTo(i)`, `setView('nested'|'overview'|'exploded')`, `reset()`:
  devuelven una Promise que se resuelve con `true` si la orden se ejecutó y `false` si había otra en
  curso (no se encolan).
- `setMode('discovery'|'free'|'gallery')`, `setQuality('alta'|'normal')`,
  `showGalleryItem(id)`, `autoRotate.toggle()`.
- `setBaseSpeed(k)` acelera todas las animaciones (p. ej. 25 en pruebas).

## Reglas al cambiar código

- Un estado nuevo va en su máquina (constantes congeladas `VIEW`, `ACTIVITY`, `PANEL`, `AUTO`,
  `QUALITY`, `MODES`, `BOOT`), no en un booleano suelto; actualiza `docs/state-machines.md` y, si
  es visible, `appState()`/`publishState()` en `js/main.js`.
- Tras tocar `js/` o `css/`, regenera `dist/` con `npm run build:dist` (es lo que se publica en el
  artifact).
- Los modelos de los sarcófagos (`js/models/`) pueden sustituirse por un GLB: no mezclar cambios de
  interacción con cambios de geometría.
