// ───────────────────────── World layout ─────────────────────────
export const CELL = 2;
export const GRID = 30;
export const HALF = (GRID * CELL) / 2; // 30
export const FOREST = 2; // forest border thickness in cells
export const DAY_LEN = 150;
export const NIGHT_LEN = 80;
export const GOAL_DAYS = 100;
export const MAX_PLAYERS = 4;

export const PLAYER_COLORS = [0xe8453c, 0x3b8fe0, 0xf2c230, 0x3fbf5f];
export const PLAYER_CSS = ['#ff5a4f', '#4aa3ff', '#ffd23f', '#4fd672'];
export const PLAYER_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];

export const SPIGOT = { x: 7, z: -13 };
export const POND = { x: -19.5, z: 19.5, r: 4.3 };
export const HOSE_LEN = 26;
export const HEART_R = 2.3; // reach: how close counts as "at the Heart" (watering, pests biting it)
export const HEART_HIT = 0.9; // what gnomes bump into: the stem and leaves (grows with the Heart)
export const SPIGOT_HIT = 0.35;

// ───────────────────────── Weather ─────────────────────────
// One weather per day, picked at dawn (weight = how often). It fades in over WEATHER_FADE seconds,
// and every effect below is blended by how far it has faded in, so nothing switches abruptly.
// Multipliers (1 = no change): sun = sunlight, drain = how fast water dries up, grow = growth
// speed, dew = morning dew. rain = water falling from the sky (0..1).
export const WEATHER_FADE = 12;
export const WEATHER = {
  clear: { name: 'Clear', icon: '🌤️', weight: 55, desc: 'Clear skies' },
  rain: { name: 'Rain', icon: '🌧️', weight: 16, sun: 0.5, dew: 0, rain: 1, desc: 'Plants drink, half sun, no dew' },
  heat: { name: 'Heatwave', icon: '🔥', weight: 11, drain: 1.8, desc: 'Water dries up twice as fast' },
  fog: { name: 'Fog', icon: '🌫️', weight: 10, sun: 0.7, dew: 2, desc: 'Hard to see, soft sun, double dew' },
  snow: { name: 'Snow', icon: '❄️', weight: 8, sun: 0.6, drain: 0.3, grow: 0.6, dew: 0, desc: 'Cold: slow growth, but plants barely dry out' },
};

export const SOIL = [
  { name: 'Dirt', mult: 0.6, color: 0x7a5534 },
  { name: 'Loam', mult: 1.0, color: 0x5a3820 },
  { name: 'Rich', mult: 1.4, color: 0x3b2414 },
  { name: 'Magic', mult: 1.9, color: 0x4a2a55 },
];

// ───────────────────────── Plant economy ─────────────────────────
// Sale value of a bloom (size ×1, Dirt) = seed cost × TIER_MULT[tier]. The multiplier grows
// exponentially with how hard a plant is to grow and keep alive, so tier-1 starters pay 3× and
// tier-5 giants pay 10× (before size, soil, hive and Hot Item bonuses).
export const TIER_MULT = [0, 3, 4.05, 5.5, 7.4, 10];
// Helper plants also do a job in the garden (repel, eat, sting, drop sun jars) so they pay less.
export const HELPER_K = 0.8;
// Regrowing plants go back to the Growing stage after harvest (REGROW_AT) and pay part of the
// single-harvest profit each time, so per-day profit matches a single crop without replanting.
export const REGROW_AT = 0.4;
export const REGROW_K = 0.7;
export function plantValue(d) {
  const v = d.cost * TIER_MULT[d.tier] * (d.role === 'helper' ? HELPER_K : 1);
  return Math.round(d.regrow ? REGROW_K * (v - d.cost) : v);
}

// grow = seconds to bloom at Loam in full sun with good water. tier = difficulty 1..5.
// role: crop (grown for money) or helper (does something useful too).
const PLANT_DEFS = {
  daisy: { name: 'Daisy', icon: '🌼', tier: 1, role: 'crop', cost: 3, grow: 36, hp: 20, maxSize: 1.5, unlock: 1, desc: 'Cheap and quick. The starter crop.' },
  strawberry: { name: 'Strawberry', icon: '🍓', tier: 1, role: 'crop', cost: 6, grow: 50, hp: 18, maxSize: 1.4, unlock: 1, regrow: true, desc: 'Fruits again after every harvest.' },
  carrot: { name: 'Carrot', icon: '🥕', tier: 2, role: 'crop', cost: 8, grow: 55, hp: 28, maxSize: 1.7, unlock: 2, desc: 'Sturdy root. Reliable money.' },
  marigold: { name: 'Marigold', icon: '🏵️', tier: 2, role: 'helper', cost: 10, grow: 50, hp: 25, maxSize: 1.5, unlock: 2, aura: 4.5, desc: 'Repels flies and kills mites nearby.' },
  tomato: { name: 'Tomato', icon: '🍅', tier: 3, role: 'crop', cost: 20, grow: 70, hp: 30, maxSize: 1.6, unlock: 3, regrow: true, desc: 'Fruits again. Throw tomatoes at pests.' },
  sunflower: { name: 'Sunflower', icon: '🌻', tier: 3, role: 'helper', cost: 18, grow: 80, hp: 30, maxSize: 2.0, unlock: 3, sunNeed: 1.8, desc: 'Needs lots of sun. Drops a free Sun Jar.' },
  flytrap: { name: 'Flytrap', icon: '🪴', tier: 3, role: 'helper', cost: 25, grow: 60, hp: 35, maxSize: 1.5, unlock: 4, eats: 3.4, desc: 'Snaps up flies and moths nearby.' },
  corn: { name: 'Corn', icon: '🌽', tier: 4, role: 'crop', cost: 35, grow: 105, hp: 35, maxSize: 2.0, unlock: 5, sunNeed: 1.4, desc: 'Tall and sun-hungry. Sells well.' },
  rose: { name: 'Rose', icon: '🌹', tier: 4, role: 'helper', cost: 45, grow: 90, hp: 40, maxSize: 1.8, unlock: 6, thorns: 4, desc: 'Thorns hurt anything that bites it.' },
  watermelon: { name: 'Watermelon', icon: '🍉', tier: 5, role: 'crop', cost: 60, grow: 130, hp: 60, maxSize: 2.6, unlock: 7, thirsty: 1.3, bigFruit: true, desc: 'Thirsty. Keeps swelling with care.' },
  pumpkin: { name: 'Giant Pumpkin', icon: '🎃', tier: 5, role: 'crop', cost: 90, grow: 170, hp: 70, maxSize: 3.5, unlock: 9, thirsty: 1.5, bigFruit: true, desc: 'Slow and thirsty. Grows enormous.' },
};
for (const d of Object.values(PLANT_DEFS)) d.value = plantValue(d);
export const PLANTS = PLANT_DEFS;

// ───────────────────────── Tools (per player) ─────────────────────────
// Garden tools grow things; pest control (weapon: true) fights things. A better version of a tool
// names its `base`: it works like the base tool but stronger, and buying it trades in the one you
// have (half price back). A gnome only ever holds one tool of each base. Tools sit in your bag
// with everything else, so their `weight` counts toward your capacity (and slows you down).
export const TOOLS = {
  hands: { name: 'Hands', icon: '✋', weight: 0, cost: 0, unlock: 1, desc: 'Pull weeds, carry, harvest. Weak punch.' },
  shovel: { name: 'Shovel', icon: '⛏️', weight: 1, cost: 10, unlock: 1, desc: 'Till plots, dig weeds, bonk pests and moles.' },
  can: { name: 'Watering Can', icon: '🚿', weight: 1, cost: 12, unlock: 1, desc: 'Refills itself at the pond and soaks up dew. Hold to water.' },
  steelshovel: { name: 'Steel Shovel', icon: '🗡️', weight: 1, base: 'shovel', cost: 45, unlock: 4, model: { sharp: true }, desc: 'A Shovel that hits 2× harder and swings faster.' },
  goldcan: { name: 'Golden Can', icon: '🏆', weight: 1, base: 'can', cost: 50, unlock: 4, model: { gold: true }, cap: 2.5, desc: 'A Watering Can that holds 2.5× and pours faster.' },
  hose: { name: 'Garden Hose', icon: '🌊', weight: 2, cost: 90, unlock: 4, desc: 'Endless water from the spigot. Pushes pests back.' },
  soaphose: { name: 'Soap Hose', icon: '🧼', weight: 2, base: 'hose', cost: 160, unlock: 6, model: { soap: true }, desc: 'A Garden Hose whose spray also kills mites and burns slugs.' },
  swatter: { name: 'Fly Swatter', icon: '🏓', weight: 1, cost: 6, unlock: 1, weapon: true, desc: 'One-hit flies and moths. Scares crows.' },
  spray: { name: 'Soap Sprayer', icon: '🧴', weight: 1, cost: 25, unlock: 2, weapon: true, desc: 'Kills mites, burns slugs. Refills itself at the pond and soaks up dew.' },
  slingshot: { name: 'Slingshot', icon: '🪃', weight: 1, cost: 30, unlock: 3, weapon: true, desc: 'Quick pebbles. Picks off flies and crows.' },
  axe: { name: 'Axe', icon: '🪓', weight: 2, cost: 60, unlock: 3, weapon: true, desc: 'Fells a tree in one chop. Slow, but one-hits almost any pest.' },
  gun: { name: 'Spud Gun', icon: '🥔', weight: 2, cost: 60, unlock: 3, weapon: true, desc: 'Long-range potatoes. The deer stopper.' },
  mgun: { name: 'Seed Blaster', icon: '🔫', weight: 3, cost: 350, unlock: 6, weapon: true, desc: 'Hold to spray seeds. Overheats: fire in bursts.' },
  hotgun: { name: 'Hot Spud Gun', icon: '🔥', weight: 2, base: 'gun', cost: 150, unlock: 5, weapon: true, model: { hot: true }, desc: 'A Spud Gun with flaming spuds that hit harder and pierce.' },
};
export const toolBase = (key) => TOOLS[key]?.base ?? key;
// Watering can capacity in water units (a dew drop is DEW_WATER). A can's `cap` multiplies it.
export const CAN_CAP = 4;
export const DEW_WATER = 0.3;
export const SPRAY_CAP = 25;
// Soap Sprayer shots one dew drop is worth (the sprayer fills from the pond and dew like the can).
export const DEW_SPRAY = 4;

// ───────────────────────── Bags (per player, worn) ─────────────────────────
// Every gnome starts with pockets that hold BASE_CAP. A bag replaces the one you wear (half price
// back for the old one). Capacity is in weight units (see itemWeight), and tools count too.
export const BASE_CAP = 8;
export const BAGS = {
  satchel: { name: 'Satchel', icon: '👜', cost: 15, unlock: 1, cap: 14, desc: 'Carry 14 instead of 8.' },
  backpack: { name: 'Backpack', icon: '🎒', cost: 40, unlock: 3, cap: 22, desc: 'Carry 22.' },
  wheelbarrow: { name: 'Wheelbarrow', icon: '🛒', cost: 200, unlock: 7, cap: 32, noSlow: true, desc: 'Carry 32, and a full load never slows you down.' },
};

// ───────────────────────── Gadgets (shared, placed on the grid) ─────────────────────────
// blocks: gnomes can't walk through it (hit = its shape: a circle radius, or a [w, d] box) and
// fenced pests (deer, raccoons) can't enter its cell.
export const PLACEABLES = {
  fence: { name: 'Fence', icon: '🧱', cost: 4, hp: 45, blocks: true, hit: [2.0, 0.36], unlock: 1, desc: 'Blocks deer and raccoons. Slugs slip under.' },
  beertrap: { name: 'Beer Trap', icon: '🍺', cost: 6, hp: 20, radius: 5.5, uses: 4, unlock: 1, desc: 'Lures and drowns slugs. 4 uses.' },
  barrel: { name: 'Rain Barrel', icon: '🛢️', cost: 20, hp: 50, blocks: true, hit: 0.6, unlock: 2, desc: 'Refill cans and sprayers here.' },
  compost: { name: 'Compost Bin', icon: '♻️', cost: 25, hp: 50, blocks: true, hit: [1.3, 1.3], unlock: 2, desc: 'Feed it 4 weeds, get 1 Soil Bag.' },
  scarecrow: { name: 'Scarecrow', icon: '👒', cost: 30, hp: 60, blocks: true, hit: 0.3, radius: 8, unlock: 3, desc: "Crows won't land nearby." },
  lamp: { name: 'Sun Lamp', icon: '💡', cost: 40, hp: 40, blocks: true, hit: 0.32, radius: 5.5, unlock: 3, desc: 'Plants grow at night. Scares deer. Draws moths.' },
  sprinkler: { name: 'Sprinkler', icon: '⛲', cost: 50, hp: 30, radius: 4.3, unlock: 4, desc: 'Waters nearby plants. Wet soil draws slugs.' },
  ladybugs: { name: 'Ladybug House', icon: '🐞', cost: 60, hp: 40, blocks: true, hit: 0.32, radius: 6, unlock: 4, desc: 'Ladybugs eat mites nearby.' },
  zapper: { name: 'Bug Zapper', icon: '⚡', cost: 90, hp: 40, blocks: true, hit: 0.32, radius: 5.5, unlock: 5, desc: 'Zaps flies and moths in range.' },
  beehive: { name: 'Beehive', icon: '🐝', cost: 150, hp: 50, blocks: true, hit: [1.0, 0.85], radius: 7, unlock: 6, desc: 'Nearby plants +25% size and value.' },
  sellbox: { name: 'Sell Stand', icon: '🏷️', cost: 250, hp: 60, blocks: true, hit: [1.5, 1.1], unlock: 7, desc: 'Sell anything right in your garden.' },
};

// ───────────────────────── Trees ─────────────────────────
// A few trees grow along the edges of the garden. One Axe chop fells a tree into WOOD_DROP pieces
// of wood; the stump grows back into a tree TREES.regrow (min, max) days later (at dawn).
export const TREES = { count: 12, hit: 0.5, regrow: [2, 4] };
export const WOOD_DROP = 3;
export const WOOD_SELL = 30;

// ───────────────────────── Weeds ─────────────────────────
// New weeds pick tilled plots WEED_PLOT_BIAS× as often as grass. A plot can't be planted with a weed
// within WEED_NEAR of its center. A weed growing in a plant's plot chokes it: WEED_CHOKE of the
// plant's max HP per second, and the plant can't heal while it's there.
export const WEED_PLOT_BIAS = 4;
export const WEED_NEAR = 1.9;
export const WEED_CHOKE = 1 / 200;

// ───────────────────────── Plant care (consumables) ─────────────────────────
export const SUPPLIES = {
  soil: { name: 'Soil Bag', icon: '🟫', cost: 6, unlock: 1, desc: 'Upgrade a plot one soil level.' },
  fertilizer: { name: 'Fertilizer', icon: '🧪', cost: 10, unlock: 2, desc: 'Instant growth spurt for one plant.' },
  sunjar: { name: 'Sun Jar', icon: '☀️', cost: 20, unlock: 3, desc: 'Boost a plant, or throw it to stun pests.' },
  mulch: { name: 'Heart Mulch', icon: '🌸', cost: 40, unlock: 5, desc: 'Heals the Heart Bloom 150 HP.' },
};
export const MULCH_HEAL = 150;

// Every buyable item, by stall kind.
export const DEFS = { seed: PLANTS, supply: SUPPLIES, tool: TOOLS, bag: BAGS, kit: PLACEABLES };

// ───────────────────────── Market (walk-in store) ─────────────────────────
// The market is one big flower. The Quick Sell kiosk is its center and each of the five shops is
// a petal fanning out from it. Every item floats in the air over its spot: starter items sit
// at the petal's base (near the kiosk) and later, better ones toward its tip (sorted by unlock day,
// then price). Nothing blocks: gnomes walk freely between the items, and the one you stand at is
// the item you're browsing.
export const MARKET = { j0: 2, j1: 7, kiosk: { i0: 14, i1: 15, j0: 7, j1: 7 }, plaza: { i0: 13, i1: 16, j: 8 } };
const cx = (i) => i * CELL - HALF + CELL / 2;
export const COUNTER = { x: 0, z: cx(MARKET.plaza.j) - 0.4 }; // where you stand to quick sell
export const FLOWER = { x: 0, z: -15.2 }; // the flower's center (the kiosk)
// Petal shape: distance of the first row from the center, spacing along and across the petal,
// and how many pads each row holds (base → tip).
export const PETAL = { r0: 4.3, step: 2.35, across: 2.35, rows: [1, 2, 2, 2, 2, 2] };

// stock: which items the shop sells, as [kind, filter?] pairs. angle: the petal's direction in
// degrees (0 = east, 90 = north, 180 = west).
export const SHOPS = [
  { id: 'seeds', name: 'Seeds', icon: '🌱', color: 0x43a047, css: '#7cc554', angle: 172, stock: [['seed']] },
  { id: 'gear', name: 'Garden Gear', icon: '🧰', color: 0xb5793a, css: '#e0a46a', angle: 136, stock: [['tool', (d) => !d.weapon], ['bag']] },
  { id: 'care', name: 'Plant Care', icon: '🧪', color: 0x8e5bb5, css: '#c39be0', angle: 90, stock: [['supply']] },
  { id: 'pest', name: 'Pest Control', icon: '🎯', color: 0xd84336, css: '#ff8a7a', angle: 44, stock: [['tool', (d) => d.weapon]] },
  { id: 'gadgets', name: 'Gadgets', icon: '⛲', color: 0x2f86d6, css: '#74b9f0', angle: 8, stock: [['kit']] },
];
for (const shop of SHOPS) {
  shop.items = shop.stock
    .flatMap(([kind, ok = () => true]) => Object.entries(DEFS[kind]).filter(([, d]) => d.cost > 0 && ok(d)).map(([key, d]) => ({ kind, key, d })))
    .sort((a, b) => a.d.unlock - b.d.unlock || a.d.cost - b.d.cost)
    .map(({ kind, key }) => [kind, key]);
}
// One stall (pad) per item, laid out row by row along each petal.
export const STALLS = [];
for (const shop of SHOPS) {
  const a = (shop.angle * Math.PI) / 180;
  const along = { x: Math.cos(a), z: -Math.sin(a) }, side = { x: Math.sin(a), z: Math.cos(a) };
  const at = (r, s) => ({ x: FLOWER.x + along.x * r + side.x * s, z: FLOWER.z + along.z * r + side.z * s });
  let n = 0, row = 0;
  while (n < shop.items.length) {
    const width = Math.min(PETAL.rows[Math.min(row, PETAL.rows.length - 1)], shop.items.length - n);
    const r = PETAL.r0 + row * PETAL.step;
    for (let k = 0; k < width; k++, n++) {
      const [kind, key] = shop.items[n];
      STALLS.push({ shop: shop.id, kind, key, row, ...at(r, (k - (width - 1) / 2) * PETAL.across) });
    }
    row++;
  }
  // the shop's sign floats just past the petal's tip; its petal-shaped floor patch spans the rows
  shop.rows = row;
  shop.sign = at(PETAL.r0 + (row - 0.4) * PETAL.step, 0);
  shop.sign.z = Math.max(shop.sign.z, -25.2); // keep it inside the market fence
  shop.patch = { ...at(PETAL.r0 + ((row - 1) * PETAL.step) / 2, 0), len: (row - 1) * PETAL.step + 2.6, angle: a };
}

// ───────────────────────── Enemies ─────────────────────────
export const ENEMIES = {
  fly: { name: 'Fly', icon: '🪰', hp: 1, speed: 5, dmg: 1.5, reward: 1, flying: true, radius: 0.45 },
  crow: { name: 'Crow', icon: '🐦', hp: 3, speed: 7, dmg: 1, reward: 3, flying: true, radius: 0.7 },
  mole: { name: 'Mole', icon: '🐀', hp: 3, speed: 3.2, dmg: 4, reward: 4, radius: 0.7 },
  slug: { name: 'Slug', icon: '🐌', hp: 4, speed: 1.2, dmg: 2.5, reward: 2, night: true, radius: 0.6 },
  moth: { name: 'Moth', icon: '🦋', hp: 1, speed: 4, dmg: 1.2, reward: 1, night: true, flying: true, radius: 0.55 },
  deer: { name: 'Deer', icon: '🦌', hp: 16, speed: 4, dmg: 7, reward: 8, night: true, radius: 1.1, fenced: true },
  raccoon: { name: 'Raccoon', icon: '🦝', hp: 7, speed: 3.6, dmg: 6, reward: 5, night: true, radius: 0.8, fenced: true },
  stag: { name: 'Moon Stag', icon: '🌙', hp: 160, speed: 3, dmg: 12, reward: 100, night: true, radius: 2.0, boss: true },
};

// ───────────────────────── Item kinds ─────────────────────────
export function itemInfo(kind) {
  const [k, sub] = kind.split(':');
  switch (k) {
    case 'weed': return { name: 'Weeds', icon: '🌿', sell: 1 };
    case 'junk': return { name: 'Old Junk', icon: '🥾', sell: 3 };
    case 'wood': return { name: 'Wood', icon: '🪵', sell: WOOD_SELL };
    case 'dew': return { name: 'Dew Drop', icon: '💧' };
    case 'coin': return { name: 'Coins', icon: '🪙' };
    case 'seed': return { name: `${PLANTS[sub].name} Seeds`, icon: PLANTS[sub].icon, sub: PLANTS[sub].icon };
    case 'produce': return { name: PLANTS[sub].name, icon: PLANTS[sub].icon, produce: true };
    case 'kit': return { name: PLACEABLES[sub].name, icon: PLACEABLES[sub].icon };
    case 'tool': return { name: TOOLS[sub].name, icon: TOOLS[sub].icon };
    case 'bag': return { name: BAGS[sub].name, icon: BAGS[sub].icon };
    default: return SUPPLIES[k] ? { name: SUPPLIES[k].name, icon: SUPPLIES[k].icon } : { name: kind, icon: '?' };
  }
}
// Everything you can pick up can be sold, except dew (the pond has endless dew). Shop-bought goods
// sell back at half price.
export const isSellable = (kind) => kind !== 'coin' && kind !== 'dew' && kind !== 'hands';
// Garden goods: what the Quick Sell kiosk sells all at once.
export const isLoot = (kind) => kind === 'weed' || kind === 'junk' || kind === 'wood' || kind.startsWith('produce:');
export function sellEach(kind) {
  const [k, sub] = kind.split(':');
  switch (k) {
    case 'weed': return 1;
    case 'junk': return 3;
    case 'wood': return WOOD_SELL;
    case 'seed': return Math.max(1, Math.floor(PLANTS[sub].cost / 2));
    case 'kit': return Math.max(1, Math.floor(PLACEABLES[sub].cost / 2));
    case 'tool': return Math.max(1, Math.floor(TOOLS[sub].cost / 2));
    default: return SUPPLIES[k] ? Math.max(1, Math.floor(SUPPLIES[k].cost / 2)) : 0;
  }
}

// Bag weight per item. Capacity is measured in weight, not item count. Hands weigh nothing.
export function itemWeight(kind) {
  if (kind === 'hands') return 0;
  if (kind.startsWith('tool:')) return TOOLS[kind.slice(5)].weight ?? 1;
  return kind === 'produce:pumpkin' || kind === 'produce:watermelon' ? 3 : kind.startsWith('kit:') || kind === 'soil' ? 2 : 1;
}
