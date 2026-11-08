// Ruta de los archivos binarios (máscara glTF, entorno EXR), relativa a la página.
// En la versión empaquetada (dist/, usada en el artifact) el alojamiento solo sirve tipos web
// estándar, así que build-artifact.mjs copia cada binario también en base64 (`*.b64.txt`) y
// define __ASSETS_B64__; aquí se decodifica y se entrega como URL blob a los cargadores.
/* global __ASSETS_B64__ */
const B64 = typeof __ASSETS_B64__ !== 'undefined' && __ASSETS_B64__;

export async function assetURL(path) {
  const url = new URL(path, document.baseURI).href;
  if (!B64) return url;
  const res = await fetch(url + '.b64.txt');
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const bin = atob((await res.text()).trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes]));
}

/**
 * Estado de las descargas en segundo plano. Cada recurso pasa por
 *   loading ──► ready      (se sustituye la versión provisional)
 *          └──► failed     (se queda la provisional: entorno neutro o máscara procedural)
 * Ninguno bloquea la escena. Cada cambio emite el evento `tut:asset` en window.
 */
export const ASSET = Object.freeze({ LOADING: 'loading', READY: 'ready', FAILED: 'failed' });
export const assetStatus = {};

/** Registra `promise` como la carga del recurso `name` y devuelve la misma Promise. */
export function trackAsset(name, promise) {
  const set = (state) => {
    assetStatus[name] = state;
    window.dispatchEvent(new CustomEvent('tut:asset', { detail: { name, state } }));
  };
  set(ASSET.LOADING);
  promise.then(() => set(ASSET.READY), () => set(ASSET.FAILED));
  return promise;
}
