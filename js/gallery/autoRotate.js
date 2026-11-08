// Giro automático de la galería como máquina de estados explícita.
//
//   off ──toggle──► on ──grab──► paused ──release──► resuming ──(2,5 s)──► on
//    ▲               │             │                   │  └──grab──► paused
//    └───── toggle ──┴─────────────┴───────────────────┘
//
// `grab`/`release` llegan de OrbitControls (`start`/`end`) cuando el visitante manipula la pieza.
// En `off` se ignoran: arrastrar nunca vuelve a encender un giro que el visitante apagó.
// La preferencia del visitante (lo que indica el botón) es `enabled`; si gira ahora mismo, `rotating`.
export const AUTO = Object.freeze({ OFF: 'off', ON: 'on', PAUSED: 'paused', RESUMING: 'resuming' });

const TRANSITIONS = {
  [AUTO.OFF]: { toggle: AUTO.ON },
  [AUTO.ON]: { toggle: AUTO.OFF, grab: AUTO.PAUSED },
  [AUTO.PAUSED]: { toggle: AUTO.OFF, release: AUTO.RESUMING },
  [AUTO.RESUMING]: { toggle: AUTO.OFF, grab: AUTO.PAUSED, timeout: AUTO.ON },
};

export class AutoRotate {
  constructor(controls, { initial = AUTO.ON, resumeDelay = 2500, onChange } = {}) {
    this.controls = controls;
    this.resumeDelay = resumeDelay;
    this.onChange = onChange;
    this.state = initial;
    controls.autoRotate = this.rotating;
    controls.addEventListener('start', () => this.send('grab'));
    controls.addEventListener('end', () => this.send('release'));
  }

  get enabled() { return this.state !== AUTO.OFF; }
  get rotating() { return this.state === AUTO.ON; }

  /** Aplica un evento; devuelve false si no hay transición para él en el estado actual. */
  send(event) {
    const next = TRANSITIONS[this.state][event];
    if (!next) return false;
    clearTimeout(this._timer);
    this.state = next;
    if (next === AUTO.RESUMING) this._timer = setTimeout(() => this.send('timeout'), this.resumeDelay);
    this.controls.autoRotate = this.rotating;
    this.onChange?.(this.state);
    return true;
  }

  toggle() { return this.send('toggle'); }
}
