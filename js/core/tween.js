// Motor mínimo de interpolaciones (sin dependencias). Cada tween devuelve una Promise
// que se resuelve al terminar, lo que permite encadenar etapas con async/await.

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

export function tween({ duration = 1, delay = 0, ease = Ease.inOut, onUpdate, onComplete } = {}) {
  return new Promise((resolve) => {
    const tw = {
      t: -delay,
      duration: Math.max(1e-4, duration),
      ease,
      onUpdate,
      finish() { onComplete && onComplete(); resolve(); },
    };
    active.add(tw);
  });
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
    if (p >= 1) { active.delete(tw); tw.finish(); }
  }
}

export const tweensRunning = () => active.size > 0;
