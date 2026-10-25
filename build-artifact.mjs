// Genera dist/tutankamon.html: una sola página autocontenida (CSS y JS en línea; Three.js desde CDN).
// Uso: node build-artifact.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = await build({
  entryPoints: ['js/main.js'], bundle: true, format: 'esm', write: false, minify: false,
  external: ['three', 'three/addons/*'], legalComments: 'inline', target: 'es2020',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('css/styles.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const head = html.split('<!--PAGE-START-->')[1].split('<!--HEAD-END-->')[0]
  .replace('<link rel="stylesheet" href="css/styles.css">', `<style>\n${css}\n</style>`);
const body = html.split('<!--BODY-START-->')[1].split('<!--BODY-END-->')[0]
  .replace('<script type="module" src="js/main.js"></script>', `<script type="module">\n${js}\n</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/tutankamon.html', head.trim() + '\n' + body.trim() + '\n');
console.log('dist/tutankamon.html', (head.length + body.length + js.length) / 1024 | 0, 'KB');
