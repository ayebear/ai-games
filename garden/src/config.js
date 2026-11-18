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
export const HEART_R = 2.3;

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
// have (half price back). A gnome only ever holds one tool of each base.
export const TOOLS = {
  hands: { name: 'Hands', icon: '✋', cost: 0, unlock: 1, desc: 'Pull weeds, carry, harvest. Weak punch.' },
  shovel: { name: 'Shovel', icon: '⛏️', cost: 10, unlock: 1, desc: 'Till plots, dig weeds, bonk pests and moles.' },
  can: { name: 'Watering Can', icon: '🚿', cost: 12, unlock: 1, desc: 'Fill at the pond or a barrel. Hold to water.' },
  steelshovel: { name: 'Steel Shovel', icon: '🗡️', base: 'shovel', cost: 45, unlock: 4, model: { sharp: true }, desc: 'A Shovel that hits 2× harder and swings faster.' },
  goldcan: { name: 'Golden Can', icon: '🏆', base: 'can', cost: 50, unlock: 4, model: { gold: true }, desc: 'A Watering Can that holds double and pours faster.' },
  hose: { name: 'Garden Hose', icon: '🌊', cost: 90, unlock: 4, desc: 'Endless water from the spigot. Pushes pests back.' },
  soaphose: { name: 'Soap Hose', icon: '🧼', base: 'hose', cost: 160, unlock: 6, model: { soap: true }, desc: 'A Garden Hose whose spray also kills mites and burns slugs.' },
  swatter: { name: 'Fly Swatter', icon: '🏓', cost: 6, unlock: 1, weapon: true, desc: 'One-hit flies and moths. Scares crows.' },
  spray: { name: 'Soap Sprayer', icon: '🧴', cost: 25, unlock: 2, weapon: true, desc: 'Kills mites, burns slugs. Refill with water.' },
  slingshot: { name: 'Slingshot', icon: '🪃', cost: 30, unlock: 3, weapon: true, desc: 'Quick pebbles. Picks off flies and crows.' },
  gun: { name: 'Spud Gun', icon: '🥔', cost: 60, unlock: 3, weapon: true, desc: 'Long-range potatoes. The deer stopper.' },
  mgun: { name: 'Seed Blaster', icon: '🔫', cost: 350, unlock: 6, weapon: true, desc: 'Hold to spray seeds. Overheats: fire in bursts.' },
  hotgun: { name: 'Hot Spud Gun', icon: '🔥', base: 'gun', cost: 150, unlock: 5, weapon: true, model: { hot: true }, desc: 'A Spud Gun with flaming spuds that hit harder and pierce.' },
};
export const toolBase = (key) => TOOLS[key]?.base ?? key;
export const CAN_CAP = 3;
export const SPRAY_CAP = 25;

// ───────────────────────── Bags (per player, worn) ─────────────────────────
// Every gnome starts with pockets that hold BASE_CAP. A bag replaces the one you wear (half price
// back for the old one). Capacity is in weight units (see itemWeight).
export const BASE_CAP = 5;
export const BAGS = {
  satchel: { name: 'Satchel', icon: '👜', cost: 15, unlock: 1, cap: 10, desc: 'Carry 10 instead of 5.' },
  backpack: { name: 'Backpack', icon: '🎒', cost: 40, unlock: 3, cap: 16, desc: 'Carry 16.' },
  wheelbarrow: { name: 'Wheelbarrow', icon: '🛒', cost: 200, unlock: 7, cap: 25, noSlow: true, desc: 'Carry 25, and a full load never slows you down.' },
};

// ───────────────────────── Gadgets (shared, placed on the grid) ─────────────────────────
export const PLACEABLES = {
  fence: { name: 'Fence', icon: '🧱', cost: 4, hp: 45, blocks: true, unlock: 1, desc: 'Blocks deer and raccoons. Slugs slip under.' },
  beertrap: { name: 'Beer Trap', icon: '🍺', cost: 6, hp: 20, radius: 5.5, uses: 4, unlock: 1, desc: 'Lures and drowns slugs. 4 uses.' },
  barrel: { name: 'Rain Barrel', icon: '🛢️', cost: 20, hp: 50, blocks: true, unlock: 2, desc: 'Refill cans and sprayers here.' },
  compost: { name: 'Compost Bin', icon: '♻️', cost: 25, hp: 50, blocks: true, unlock: 2, desc: 'Feed it 4 weeds, get 1 Soil Bag.' },
  scarecrow: { name: 'Scarecrow', icon: '👒', cost: 30, hp: 60, blocks: true, radius: 8, unlock: 3, desc: "Crows won't land nearby." },
  lamp: { name: 'Sun Lamp', icon: '💡', cost: 40, hp: 40, blocks: true, radius: 5.5, unlock: 3, desc: 'Plants grow at night. Scares deer. Draws moths.' },
  sprinkler: { name: 'Sprinkler', icon: '⛲', cost: 50, hp: 30, radius: 4.3, unlock: 4, desc: 'Waters nearby plants. Wet soil draws slugs.' },
  ladybugs: { name: 'Ladybug House', icon: '🐞', cost: 60, hp: 40, blocks: true, radius: 6, unlock: 4, desc: 'Ladybugs eat mites nearby.' },
  zapper: { name: 'Bug Zapper', icon: '⚡', cost: 90, hp: 40, blocks: true, radius: 5.5, unlock: 5, desc: 'Zaps flies and moths in range.' },
  beehive: { name: 'Beehive', icon: '🐝', cost: 150, hp: 50, blocks: true, radius: 7, unlock: 6, desc: 'Nearby plants +25% size and value.' },
  sellbox: { name: 'Sell Stand', icon: '🏷️', cost: 250, hp: 60, blocks: true, unlock: 7, desc: 'Sell anything right in your garden.' },
};

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
// Five shops, each selling one kind of thing. Every item has its own stall, and a shop's stalls
// are always sorted cheapest-first by unlock day, then price, so better items sit further right.
// Three rows, all facing the camera (south), each reached from its south side:
//   front  row (j=6): Seeds, Plant Care       (reached from the garden; the Quick Sell kiosk between)
//   middle row (j=4): Garden Gear, Pest Control  (per-gnome tools and bags)
//   back   row (j=2): Gadgets                  (shared things you place in the garden)
// The aisles are j=3 and j=5.
export const MARKET = { j0: 2, j1: 6, kiosk: { i0: 14, i1: 15, j0: 5, j1: 6 }, plaza: { i0: 13, i1: 16, j: 7 } };
const cx = (i) => i * CELL - HALF + CELL / 2;
export const COUNTER = { x: 0, z: cx(MARKET.plaza.j) - 0.4 }; // where you stand to quick sell

// stock: which items the shop sells, as [kind, filter?] pairs.
export const SHOPS = [
  { id: 'seeds', name: 'Seeds', icon: '🌱', color: 0x43a047, css: '#7cc554', row: 6, at: 2, stock: [['seed']] },
  { id: 'care', name: 'Plant Care', icon: '🧪', color: 0x8e5bb5, css: '#c39be0', row: 6, at: 17, stock: [['supply']] },
  { id: 'gear', name: 'Garden Gear', icon: '🧰', color: 0xb5793a, css: '#e0a46a', row: 4, at: 3, stock: [['tool', (d) => !d.weapon], ['bag']] },
  { id: 'pest', name: 'Pest Control', icon: '🎯', color: 0xd84336, css: '#ff8a7a', row: 4, at: 18, stock: [['tool', (d) => d.weapon]] },
  { id: 'gadgets', name: 'Gadgets', icon: '⛲', color: 0x2f86d6, css: '#74b9f0', row: 2, at: 9, stock: [['kit']] },
];
for (const shop of SHOPS) {
  shop.items = shop.stock
    .flatMap(([kind, ok = () => true]) => Object.entries(DEFS[kind]).filter(([, d]) => d.cost > 0 && ok(d)).map(([key, d]) => ({ kind, key, d })))
    .sort((a, b) => a.d.unlock - b.d.unlock || a.d.cost - b.d.cost)
    .map(({ kind, key }) => [kind, key]);
}
export const STALLS = SHOPS.flatMap((shop) => shop.items.map(([kind, key], n) => ({ shop: shop.id, kind, key, i: shop.at + n, j: shop.row })));

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
// Everything you can pick up can be sold. Shop-bought goods sell back at half price.
export const isSellable = (kind) => kind !== 'coin';
export function sellEach(kind) {
  const [k, sub] = kind.split(':');
  switch (k) {
    case 'weed': case 'dew': return 1;
    case 'junk': return 3;
    case 'seed': return Math.max(1, Math.floor(PLANTS[sub].cost / 2));
    case 'kit': return Math.max(1, Math.floor(PLACEABLES[sub].cost / 2));
    case 'tool': return Math.max(1, Math.floor(TOOLS[sub].cost / 2));
    default: return SUPPLIES[k] ? Math.max(1, Math.floor(SUPPLIES[k].cost / 2)) : 0;
  }
}

// Bag weight per item. Capacity is measured in weight, not item count.
export const itemWeight = (kind) => (kind === 'produce:pumpkin' || kind === 'produce:watermelon' ? 3 : kind.startsWith('kit:') || kind === 'soil' ? 2 : 1);
