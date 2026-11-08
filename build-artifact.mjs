// Genera la versión empaquetada en dist/:
//   dist/tutankamon.html        fragmento de página para el artifact (CSS y JS en línea)
//   dist/tutankamon-local.html  la misma página como documento HTML completo
//   dist/assets/                modelos y entorno (mask.glb, hall.exr) y su copia *.b64.txt,
//                               que es la que lee esta versión (el artifact solo sirve tipos web)
// Three.js va dentro del bundle (minificado y sin las partes que no se usan), así que no
// depende de ningún CDN. Los modelos 3D NO se incrustan: se descargan en segundo plano.
// Uso: npm run build   (o: node build-artifact.mjs)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';

const res = await build({
  entryPoints: ['js/main.js'], bundle: true, format: 'esm', write: false, minify: true,
  legalComments: 'none', target: 'es2020',
  // en index.html Three.js llega por importmap; aquí se resuelve desde node_modules
  alias: { 'three/addons': 'three/examples/jsm' },
  // el artifact no sirve .glb ni .exr: los binarios se leen en base64 (ver js/core/assets.js)
  define: { __ASSETS_B64__: 'true' },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('css/styles.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const head = html.split('<!--PAGE-START-->')[1].split('<!--HEAD-END-->')[0]
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
  .replace('<link rel="stylesheet" href="css/styles.css">', () => `<style>\n${css}\n</style>`);
const body = html.split('<!--BODY-START-->')[1].split('<!--BODY-END-->')[0]
  .replace('<script type="module" src="js/main.js"></script>', () => `<script type="module">\n${js}\n</script>`);
const fragment = head.trim() + '\n' + body.trim() + '\n';

mkdirSync('dist', { recursive: true });
writeFileSync('dist/tutankamon.html', fragment);
writeFileSync('dist/tutankamon-local.html',
  '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + head.trim() + '\n</head><body>' + body.trim() + '\n</body></html>\n');
cpSync('assets', 'dist/assets', { recursive: true });
for (const f of readdirSync('assets')) writeFileSync(`dist/assets/${f}.b64.txt`, readFileSync(`assets/${f}`).toString('base64'));
console.log('dist/tutankamon.html', (fragment.length / 1024) | 0, 'KB (JS', (js.length / 1024) | 0, 'KB) + dist/assets/');
