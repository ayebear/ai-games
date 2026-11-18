import { WEATHER } from './config.js';

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
  weather: 'clear', // today's weather (a WEATHER key); wx holds how far each one has faded in
  wx: { clear: 1, rain: 0, heat: 0, fog: 0, snow: 0 },
  hotItem: 'daisy',
  money: 0,
  seen: new Set(), // market items a gnome has browsed (anything unlocked and unseen is NEW)
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
  // the Quick Sell coin jar, as a camera/alert target when raccoons rob it (placed by the market)
  jar: { pos: { x: 0, z: -16.8 }, kind: 'jar', dead: false, attackedAt: -99 },
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

// Everything the camera keeps in view besides the gnomes: things under attack, plus anything that
// is being hurt by neglect right now (no water, mites, nearly dead) and a thirsty Heart Bloom.
export function needsAttention(pl) {
  return pl.waterState === 'none' || pl.mites >= 1 || pl.hp < pl.maxHp * 0.4;
}
export function attentionThings() {
  const out = new Set(attackedThings());
  for (const p of G.plants) if (!p.dead && needsAttention(p)) out.add(p);
  if (G.heart && !G.heart.dead && G.heart.waterState !== 'ok') out.add(G.heart);
  return [...out];
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

// A weather effect blended across the current fade-in: 1 + Σ weight·(value − 1). key: sun, drain,
// grow, dew (multipliers, default 1) or rain (amount, default 0).
export function wx(key) {
  const def = key === 'rain' ? 0 : 1;
  let v = def;
  for (const [k, w] of Object.entries(G.wx)) if (w > 0) v += w * ((WEATHER[k][key] ?? def) - def);
  return v;
}
