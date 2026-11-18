// Deterministic seeded RNG so every level is the same each time you play it.
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

// Stable hash of a 3D position, used for jittering low-poly vertices consistently.
export function hash3(x, y, z, seed = 0) {
  const k =
    (Math.round(x * 1000) * 73856093) ^
    (Math.round(y * 1000) * 19349663) ^
    (Math.round(z * 1000) * 83492791) ^
    seed;
  const r = mulberry32(k);
  return [r(), r(), r()];
}
