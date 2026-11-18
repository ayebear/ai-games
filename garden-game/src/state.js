// Global mutable game state, shared by all modules.
export const G = {
  // engine (set in main)
  scene: null, camera: null, renderer: null, input: null, fx: null, world: null, hud: null, director: null,
  // flow
  state: 'title', // title | playing | paused | gameover | victory
  time: 0, // seconds into the current day/night cycle
  day: 1,
  phase: 'day', // day | night
  sun: 1, // current sunlight 0..1
  night: 0, // 0..1 darkness
  weather: 'clear', // clear | rain | heat
  hotItem: 'daisy',
  money: 0,
  upgrades: new Set(),
  endless: false,
  // entities
  slots: [null, null, null, null], // Player objects (persist across leave/rejoin)
  plants: [],
  enemies: [],
  pickups: [],
  placeables: [],
  projectiles: [],
  flashes: [], // temporary light/stun sources {x,z,r,t}
  heart: null,
  boss: null,
  stats: null,
};

export const activePlayers = () => G.slots.filter((p) => p && p.active);

export function newStats() {
  return {
    moneyEarned: 0, moneySpent: 0, moneyStolen: 0,
    harvested: {}, plantsLost: 0, planted: 0,
    biggest: null, // {type, size, value}
    kills: {}, mites: 0, weeds: 0,
    nights: 0,
  };
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const lerp = (a, b, t) => a + (b - a) * t;
