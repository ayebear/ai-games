// Unified input: up to 4 gamepads + 2 keyboard layouts.
// Each device produces a state: { mx, mz, ax, az, held:{}, pressed:{}, nav:{} }

const BTN = ['a', 'b', 'x', 'y', 'lb', 'rb', 'start', 'back', 'up', 'down', 'left', 'right'];
const DEAD = 0.22;

const KB_LAYOUTS = {
  kb: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    a: ['Space'], x: ['KeyJ'], b: ['KeyK'], y: ['KeyL'], lb: ['KeyQ'], rb: ['KeyE'],
    start: ['Enter'], back: ['Escape'],
  },
  kb2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    a: ['Period'], x: ['Comma'], b: ['Slash'], y: ['Semicolon'], lb: ['KeyM'], rb: ['Quote'],
    start: ['ShiftRight'], back: ['Escape'],
  },
};

// Button badges (HTML). Gamepad face buttons are colored circles, bumpers/start are pills,
// keyboard keys are keycaps. Styled by .btn in style.css.
export const padBtn = (b) => {
  const label = { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', rt: 'RT', start: 'START', back: 'BACK' }[b] ?? b;
  const shape = ['a', 'b', 'x', 'y'].includes(b) ? 'face' : 'pill';
  return `<span class="btn pad ${shape} b-${b}">${label}</span>`;
};
export const keyBtn = (k) => `<span class="btn key">${k}</span>`;

const kbMap = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, keyBtn(v)]));
export const GLYPHS = {
  pad: Object.fromEntries(['a', 'b', 'x', 'y', 'lb', 'rb', 'start'].map((b) => [b, padBtn(b)])),
  kb: kbMap({ a: 'Space', b: 'K', x: 'J', y: 'L', lb: 'Q', rb: 'E', start: 'Enter' }),
  kb2: kbMap({ a: '.', b: '/', x: ',', y: ';', lb: 'M', rb: "'", start: 'R-Shift' }),
};
export const glyphsFor = (dev) => (dev === 'kb' ? GLYPHS.kb : dev === 'kb2' ? GLYPHS.kb2 : GLYPHS.pad);

export class Input {
  constructor() {
    this.keys = new Set();
    this.tapped = new Set(); // keys pressed since the last poll (so quick taps are never missed)
    this.prev = new Map(); // dev -> held map
    this.navT = new Map(); // dev -> repeat timers
    this.devices = new Map();
    this.onGesture = null;
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.tapped.add(e.code);
      this.onGesture?.();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('pointerdown', () => this.onGesture?.());
  }

  poll(dt) {
    const raw = new Map();
    for (const [dev, L] of Object.entries(KB_LAYOUTS)) {
      const held = {};
      for (const b of BTN) held[b] = L[b].some((c) => this.keys.has(c) || this.tapped.has(c));
      let mx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let mz = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const l = Math.hypot(mx, mz);
      if (l > 1) { mx /= l; mz /= l; }
      raw.set(dev, { mx, mz, ax: 0, az: 0, held });
    }
    this.tapped.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const bt = (i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
      const held = {
        a: bt(0), b: bt(1), x: bt(2) || bt(7), y: bt(3), lb: bt(4), rb: bt(5),
        back: bt(8), start: bt(9), up: bt(12), down: bt(13), left: bt(14), right: bt(15),
      };
      let mx = gp.axes[0] || 0, mz = gp.axes[1] || 0;
      let l = Math.hypot(mx, mz);
      if (l < DEAD) { mx = 0; mz = 0; } else { const s = Math.min(1, (l - DEAD) / (1 - DEAD)) / l; mx *= s; mz *= s; }
      // d-pad also moves
      if (mx === 0 && mz === 0) {
        mx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
        mz = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      }
      let ax = gp.axes[2] || 0, az = gp.axes[3] || 0;
      if (Math.hypot(ax, az) < 0.35) { ax = 0; az = 0; }
      raw.set('gp' + gp.index, { mx, mz, ax, az, held, stickX: gp.axes[0] || 0, stickY: gp.axes[1] || 0 });
    }

    this.devices.clear();
    for (const [dev, s] of raw) {
      const prev = this.prev.get(dev) || {};
      const pressed = {};
      for (const b of BTN) pressed[b] = s.held[b] && !prev[b];
      if (Object.values(pressed).some(Boolean)) this.onGesture?.();
      // menu navigation with auto-repeat (d-pad / keys / stick)
      const dir = {
        up: s.held.up || (s.stickY ?? 0) < -0.55,
        down: s.held.down || (s.stickY ?? 0) > 0.55,
        left: s.held.left || (s.stickX ?? 0) < -0.55,
        right: s.held.right || (s.stickX ?? 0) > 0.55,
      };
      const timers = this.navT.get(dev) || { up: 0, down: 0, left: 0, right: 0 };
      const nav = {};
      for (const d of ['up', 'down', 'left', 'right']) {
        if (!dir[d]) { timers[d] = 0; nav[d] = false; continue; }
        if (timers[d] === 0) { nav[d] = true; timers[d] = 0.32; }
        else { timers[d] -= dt; nav[d] = timers[d] <= 0; if (nav[d]) timers[d] = 0.11; }
        if (timers[d] === 0) timers[d] = 0.0001;
      }
      this.navT.set(dev, timers);
      this.prev.set(dev, { ...s.held });
      this.devices.set(dev, { ...s, pressed, nav, dev });
    }
  }

  get(dev) { return this.devices.get(dev) || null; }
}
