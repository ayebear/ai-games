const DEAD = 0.2;
function dz(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}
const EDGES = ['a', 'b', 'start', 'back', 'left', 'right'];

/**
 * Polls every connected gamepad (standard mapping) plus one keyboard "pad".
 * Keyboard: WASD move, IJKL aim, Space jump, Q suck, E blast, Enter join/leave, Esc pause.
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this.prev = new Map();
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  poll() {
    const out = [];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const b = (i) => gp.buttons[i] || { pressed: false, value: 0 };
      const trig = (i) => Math.max(b(i).value || 0, b(i).pressed ? 1 : 0);
      const [lx, ly] = dz(gp.axes[0] || 0, gp.axes[1] || 0);
      const [rx, ry] = dz(gp.axes[2] || 0, gp.axes[3] || 0);
      out.push(this.edge('gp' + gp.index, {
        lx: lx + (b(15).pressed ? 1 : 0) - (b(14).pressed ? 1 : 0),
        ly: ly + (b(13).pressed ? 1 : 0) - (b(12).pressed ? 1 : 0),
        rx, ry,
        lt: trig(6) > 0.06 ? trig(6) : 0,
        rt: trig(7) > 0.06 ? trig(7) : 0,
        a: b(0).pressed, b: b(1).pressed,
        start: b(9).pressed, back: b(8).pressed,
        left: b(14).pressed || lx < -0.7, right: b(15).pressed || lx > 0.7,
        name: gp.id,
      }));
    }
    const k = (c) => this.keys.has(c);
    let mx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), my = (k('KeyS') ? 1 : 0) - (k('KeyW') ? 1 : 0);
    let m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    let ax = (k('KeyL') ? 1 : 0) - (k('KeyJ') ? 1 : 0), ay = (k('KeyK') ? 1 : 0) - (k('KeyI') ? 1 : 0);
    m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
    out.push(this.edge('kb', {
      lx: mx, ly: my, rx: ax, ry: ay,
      lt: k('KeyQ') || k('ShiftLeft') ? 1 : 0,
      rt: k('KeyE') ? 1 : 0,
      a: k('Space'), b: k('Backspace'),
      start: k('Enter'), back: k('Escape') || k('KeyP'),
      left: k('ArrowLeft'), right: k('ArrowRight'),
      name: 'Keyboard',
    }));
    return out;
  }

  edge(id, raw) {
    const p = this.prev.get(id) || {};
    raw.id = id;
    for (const key of EDGES) raw[key + 'P'] = raw[key] && !p[key];
    const snap = {};
    for (const key of EDGES) snap[key] = raw[key];
    this.prev.set(id, snap);
    return raw;
  }
}
