// Motor mínimo de interpolaciones (sin dependencias). Cada tween devuelve una Promise
// que se resuelve al terminar, lo que permite encadenar etapas con async/await.
//
// Canales: un tween con `channel` sustituye al que ya ocupaba ese canal (p. ej. la cámara).
// El anterior se detiene donde esté, sin saltar al final, y su Promise se resuelve con
// `false` («interrumpido»); los que terminan con normalidad se resuelven con `true`.
// Así dos vuelos de cámara nunca pelean por el mismo objeto: gana siempre el último.

export const Ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
};

const active = new Set();
let globalSpeed = 1;
let baseSpeed = 1;

/** Velocidad base (p. ej. más rápida si el usuario prefiere menos movimiento). */
export function setBaseSpeed(s) { baseSpeed = s; }

/** Multiplicador global de velocidad (p. ej. saltos rápidos entre etapas). */
export function setSpeed(s) { globalSpeed = s; }
export function getSpeed() { return globalSpeed; }

export function tween({ duration = 1, delay = 0, ease = Ease.inOut, onUpdate, onComplete, channel } = {}) {
  if (channel !== undefined) cancelChannel(channel);
  return new Promise((resolve) => {
    const tw = {
      t: -delay,
      duration: Math.max(1e-4, duration),
      ease,
      onUpdate,
      channel,
      finish(completed) { if (completed) onComplete && onComplete(); resolve(completed); },
    };
    active.add(tw);
  });
}

/** Detiene el tween que ocupa `channel` (si lo hay) donde esté. Devuelve si había alguno. */
export function cancelChannel(channel) {
  let found = false;
  for (const tw of active) {
    if (tw.channel !== channel) continue;
    active.delete(tw); tw.finish(false); found = true;
  }
  return found;
}

/** Interpola un número de `from` a `to` y llama a `set(v)`. */
export function tweenNumber(from, to, set, opts = {}) {
  return tween({ ...opts, onUpdate: (k) => set(from + (to - from) * k) });
}

export function updateTweens(dt) {
  for (const tw of [...active]) {
    tw.t += dt * globalSpeed * baseSpeed;
    if (tw.t < 0) continue;
    const p = Math.min(1, tw.t / tw.duration);
    tw.onUpdate && tw.onUpdate(tw.ease(p));
    if (p >= 1) { active.delete(tw); tw.finish(true); }
  }
}

export const tweensRunning = () => active.size > 0;
