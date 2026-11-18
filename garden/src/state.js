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
  market: null,
  clock: 0, // seconds of unpaused play; used to remember what was attacked recently
  // the Trading Post coin jar, as a camera/alert target when raccoons rob it
  jar: { pos: { x: 0, z: -17.6 }, kind: 'jar', dead: false, attackedAt: -99 },
};

// Things the gardeners own that enemies hit in the last few seconds. The camera keeps them in view.
export const ATTACK_MEMORY = 3;
export function attackedThings() {
  const recent = (o) => o && !o.dead && o.attackedAt != null && G.clock - o.attackedAt < ATTACK_MEMORY;
  const out = [];
  for (const p of G.plants) if (recent(p)) out.push(p);
  for (const p of G.placeables) if (recent(p)) out.push(p);
  if (recent(G.heart)) out.push(G.heart);
  if (recent(G.jar)) out.push(G.jar);
  return out;
}

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
