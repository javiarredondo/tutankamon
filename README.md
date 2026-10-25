# Cámara de Tutankamón — prototipo 3D interactivo

Experiencia web en Three.js para explorar, capa a capa, el enterramiento de Tutankamón (KV62):
cuatro santuarios dorados, el sarcófago de piedra, tres ataúdes antropomorfos y la momia con la máscara,
más una galería de ocho objetos del ajuar. Textos en español, con cada dato marcado como
**Documentado**, **Interpretación** o **Por verificar**.

> Todos los modelos son **esquemáticos y procedurales**. Mantienen proporciones aproximadas, pero no
> son réplicas ni reconstrucciones arqueológicas de las piezas.

---

## 1. Análisis de complejidad y arquitectura

| Reto | Solución en el prototipo |
|---|---|
| Nueve envolturas anidadas que deben verse sin desaparecer de golpe | Cada capa abierta pasa gradualmente a «silueta» translúcida (7 % de opacidad + aristas doradas) en lugar de ocultarse. |
| Animaciones de apertura sin inventar mecanismos históricos | Puertas que giran y tapas que se elevan, presentadas como **representación explicativa**. La ficha lo indica. |
| Saber en todo momento qué se ve y qué protege a qué | Lista de capas con estado, barra de progreso, etiqueta 3D en la capa actual y cartela con «Protege a: …». |
| Vista general y vista separada | «Vista general»: todas las capas translúcidas en su sitio. «Capas separadas»: las nueve piezas se alinean en dos filas (santuarios detrás; sarcófago, ataúdes y momia delante), numeradas. |
| Rendimiento en portátiles y tabletas | Render bajo demanda (solo cuando algo cambia), pixel ratio limitado, sombras de 1024 px en pantallas pequeñas, texturas generadas con `<canvas>` (sin descargas). Modo `?lite` sin sombras. |
| Rigor histórico | Datos separados del código (`js/data/`), con tipo de afirmación y fuentes por ficha. |

**Por qué sin React:** la interfaz es pequeña (una lista, una cartela, una ficha) y el estado vive en el sistema de capas. Añadir React no aporta y complicaría la sincronización con el bucle de render de Three.js.

### Flujo
```
main.js ──► scene.js (renderer, luces, cámaras, OrbitControls)
        ├─► models/funerary.js ──► Structure (apertura, transparencia, resaltado)
        ├─► layers/layerSystem.js (abrir/cerrar, saltar, vista general, separadas, encuadre)
        ├─► gallery/gallery.js ──► models/galleryModels.js
        ├─► ui/infoPanel.js ◄── data/structures.js, data/gallery.js, data/sources.js
        └─► core/tween.js (todas las transiciones; Promises encadenables)
```

## 2. Estructura de archivos

```
tutankamon/
├── index.html               Página (versión modular para desarrollo local)
├── css/styles.css           Estilos de la interfaz
├── js/
│   ├── main.js              Arranque, modos, selección, bucle de render
│   ├── core/
│   │   ├── scene.js         Renderer, escenas, luces, controles, transición de cámara
│   │   ├── materials.js     Materiales y texturas procedurales (oro, fayenza, piedra, lino…)
│   │   ├── inlay.js         Texturas de taracea: color + rugosidad/metal + relieve
│   │   ├── coffinTextures.js  Decoración pintada de los tres ataúdes
│   │   └── tween.js         Motor de interpolaciones
│   ├── models/
│   │   ├── structure.js     Clase base de cada capa funeraria
│   │   ├── funerary.js      Santuarios, palio, sarcófago, ataúdes, momia, máscara
│   │   └── galleryModels.js Objetos de la galería
│   ├── layers/layerSystem.js  Navegación entre capas y vistas
│   ├── gallery/gallery.js     Galería de objetos
│   ├── ui/infoPanel.js        Ficha histórica
│   └── data/
│       ├── structures.js    Las 9 capas + palio (medidas, textos, datos, fuentes)
│       ├── gallery.js       Los 8 objetos de la galería
│       └── sources.js       Bibliografía y fuentes
├── build-artifact.mjs       Genera dist/tutankamon.html (una sola página)
└── package.json
```

## 3. Ejecutar en local

Los módulos ES necesitan un servidor HTTP (no funciona abriendo el archivo con doble clic).

```bash
cd tutankamon
python3 -m http.server 8000      # o: npx serve .
# abre http://localhost:8000
```

Three.js se carga desde jsDelivr (versión fijada 0.170.0), así que hace falta conexión a internet.
Para trabajar sin conexión: `npm install` y cambia el `importmap` de `index.html` a
`./node_modules/three/build/three.module.js` y `./node_modules/three/examples/jsm/`.

Opciones:
- `http://localhost:8000/?lite` — sin sombras y con menor resolución, para equipos modestos.
- `node build-artifact.mjs` (tras `npm install`) — genera `dist/tutankamon.html`, una sola página con CSS y JS en línea.

### Controles
- Ratón: arrastrar = girar · rueda = acercar · botón derecho o mayús + arrastrar = desplazar.
- Táctil: un dedo = girar · dos dedos = acercar y desplazar.
- Teclado: ← / → cierran y abren capas.

## 4. Recursos externos y licencias

| Recurso | Uso | Licencia |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) 0.170.0 (incluye `OrbitControls`, `RoomEnvironment`, `CSS2DRenderer`) | Render 3D | MIT |
| Google Fonts: Marcellus, Alegreya Sans, IBM Plex Mono | Tipografía | SIL Open Font License 1.1 |
| esbuild 0.24 (solo desarrollo) | Empaquetar la versión de una página | MIT |
| [«Máscara funeraria de Tutankamón»](https://sketchfab.com/3d-models/mascara-funeraria-de-tutankamon-667fa18ffa404a6dac7abc6bcd5c861e) de [Roberto Domínguez](https://sketchfab.com/vmmaniac) | Modelo 3D de la máscara (galería y momia), simplificado a ~174 000 triángulos con glTF-Transform (meshopt + WebP). Archivo: `assets/mask.glb`, incrustado en `js/assets/maskModel.js` | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) — se exige citar al autor |

Salvo la máscara (modelo de terceros, arriba), todos los modelos y texturas se generan en código. El modelo de la máscara no indica si procede de un escaneo del original, de una réplica o de modelado manual.
No hay servicios de pago, claves API ni registro.

## 5. Limitaciones de esta primera versión

### Históricas
- **Medidas.** Solo están contrastadas con fuente institucional las del ataúd exterior (Ministerio de Turismo y Antigüedades) y las del 4.º santuario (ficha del MIT). Las de los santuarios 1–3, el palio, el ataúd intermedio, el ataúd de oro, la máscara y la momia proceden de fuentes secundarias o divulgativas y están marcadas «por verificar». La altura del sarcófago es una estimación del modelo.
- **Contradicción pendiente:** la fuente secundaria da 2,78 m de alto al armazón del palio, más que el propio santuario exterior (2,75 m). El modelo lo reduce para que quepa.
- **Decoración.** Las texturas se pintan por código (con relieve y diferencia oro/vidrio) usando fotografías tomadas en el GEM como referencia visual: hileras de djed y parejas de tyet en el santuario exterior, plumaje rishi, alas cruzadas, collar y tocado en los ataúdes, coleta y franjas en la máscara. Son aproximaciones: el número y la posición de los motivos no son exactos, y las «inscripciones» son marcas genéricas, no textos reales. Las fotos no se incluyen en la aplicación.
- **Formas.** Los tejados, la ensambladura por paneles y las puertas plegables de los santuarios están simplificados (una hoja por lado). Las diosas del sarcófago son placas esquemáticas.
- **Apertura.** Las animaciones (puertas que giran, tapas que se elevan) explican la secuencia; no describen cómo se desmontaron realmente las piezas entre 1923 y 1925.
- **Elementos ausentes:** el lecho funerario con forma de león bajo el ataúd exterior, el contenido entre santuarios (abanicos, bastones, etc.), los más de cien amuletos y joyas de la momia, las pinturas murales de la cámara y el resto de la tumba (antecámara, anexo, tesoro).
- **Planta de la cámara.** El contorno discontinuo usa ≈ 6,4 × 4,0 m, una cifra por verificar.
- **Ubicaciones.** Se indica GEM o KV62 según la información disponible a octubre de 2026; la disposición dentro de las salas del GEM no está verificada.
- Varias referencias de `sources.js` son secundarias; conviene sustituirlas por el registro de Carter del Griffith Institute y por la documentación del Gran Museo Egipcio.

### Visuales y técnicas
- Solo la máscara usa un modelo glTF (`js/models/externalMask.js`, con versión procedural de respaldo mientras carga). El mismo mecanismo serviría para otras piezas si aparecen modelos con licencia adecuada.
- Las piezas translúcidas superpuestas pueden ordenarse de forma imperfecta en algunos ángulos (limitación habitual de la transparencia en tiempo real).
- La galería muestra una pieza cada vez. Los «bastones», «brazaletes» y «amuletos» son conjuntos representativos, no objetos concretos del inventario.
- Sin sonido, sin modo de realidad virtual y sin enlace directo a una etapa concreta.

## 6. Pruebas realizadas
Se probó en Chromium sin pantalla (render por software): carga sin errores de consola, apertura de las
ocho capas en orden, cierre, salto a una etapa, vista general, capas separadas, restablecer,
selección con clic, ficha, los ocho objetos de la galería y el diseño a 390 px de ancho.
