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

export const COUNTER = { x: 0, z: -16.6 }; // shop counter / coin jar
export const SPIGOT = { x: 7.6, z: -18.4 };
export const POND = { x: -19.5, z: 19.5, r: 4.3 };
export const HOSE_LEN = 26;
export const HEART_R = 2.3;

export const SOIL = [
  { name: 'Dirt', mult: 0.6, color: 0x7a5534 },
  { name: 'Loam', mult: 1.0, color: 0x5a3820 },
  { name: 'Rich', mult: 1.4, color: 0x3b2414 },
  { name: 'Magic', mult: 1.9, color: 0x4a2a55 },
];

// ───────────────────────── Plants ─────────────────────────
export const PLANTS = {
  daisy: { name: 'Daisy', icon: '🌼', cost: 3, grow: 38, value: 9, hp: 20, maxSize: 1.6, unlock: 1, desc: 'Cheap & quick. Hardy starter crop.' },
  marigold: { name: 'Marigold', icon: '🏵️', cost: 6, grow: 48, value: 13, hp: 25, maxSize: 1.5, unlock: 1, aura: 4.5, desc: 'Grown marigolds repel flies & kill mites nearby.' },
  tomato: { name: 'Tomato', icon: '🍅', cost: 10, grow: 60, value: 7, hp: 30, maxSize: 1.8, unlock: 2, regrow: true, desc: 'Fruits again after harvest. Throw tomatoes at pests!' },
  sunflower: { name: 'Sunflower', icon: '🌻', cost: 14, grow: 80, value: 30, hp: 30, maxSize: 2.2, unlock: 2, sunNeed: 1.8, desc: 'Sun-hungry. Harvest drops a free Sun Jar.' },
  flytrap: { name: 'Flytrap', icon: '🪴', cost: 18, grow: 55, value: 12, hp: 35, maxSize: 1.5, unlock: 3, eats: 3.4, desc: 'Living turret: snaps flies & moths that come close.' },
  rose: { name: 'Rose', icon: '🌹', cost: 24, grow: 75, value: 45, hp: 40, maxSize: 1.8, unlock: 4, thorns: 4, desc: 'Valuable. Thorns hurt pests that chew on it.' },
  pumpkin: { name: 'Giant Pumpkin', icon: '🎃', cost: 40, grow: 160, value: 80, hp: 70, maxSize: 4.5, unlock: 5, thirsty: 1.5, desc: 'Slow & thirsty. Grows ENORMOUS with care.' },
};

// ───────────────────────── Tools (per player) ─────────────────────────
export const TOOLS = {
  hands: { name: 'Hands', icon: '✋', cost: 0, unlock: 1, desc: 'Pull weeds, carry, harvest. Weak punch.' },
  shovel: { name: 'Shovel', icon: '⛏️', cost: 10, unlock: 1, desc: 'Till grass into plots, dig weeds, bonk pests. Hits moles underground.' },
  can: { name: 'Watering Can', icon: '🚿', cost: 14, unlock: 1, desc: 'Fill at pond/barrel, hold to water. Splashes flies.' },
  swatter: { name: 'Fly Swatter', icon: '🏓', cost: 8, unlock: 1, weapon: true, desc: 'One-swat flies & moths. Scatters crows, knocks off mites.' },
  spray: { name: 'Soap Sprayer', icon: '🧴', cost: 16, unlock: 2, desc: 'Kills mites, burns slugs. Refill with water.' },
  slingshot: { name: 'Slingshot', icon: '🪃', cost: 20, unlock: 1, weapon: true, desc: 'Quick pebble shots. Great for picking off flies & crows at range.' },
  gun: { name: 'Spud Gun', icon: '🥔', cost: 45, unlock: 3, weapon: true, desc: 'Long-range potato cannon. The deer stopper.' },
  mgun: { name: 'Machine Gun', icon: '🔫', cost: 200, unlock: 5, weapon: true, desc: 'Hold to spray seed-bullets. Overheats, so fire in bursts!' },
  hose: { name: 'Garden Hose', icon: '🌊', cost: 60, unlock: 3, desc: 'Endless water from the spigot. Blasts pests back. Can overwater!' },
};
export const CAN_CAP = 3;
export const SPRAY_CAP = 25;

// ───────────────────────── Placeables (shared) ─────────────────────────
export const PLACEABLES = {
  fence: { name: 'Fence', icon: '🧱', cost: 5, hp: 45, blocks: true, unlock: 1, desc: 'Blocks deer, raccoons & gnomes. Slugs slip under.' },
  beertrap: { name: 'Beer Trap', icon: '🍺', cost: 8, hp: 20, radius: 5.5, uses: 4, unlock: 1, desc: 'Lures and drowns slugs (4 uses).' },
  barrel: { name: 'Rain Barrel', icon: '🛢️', cost: 18, hp: 50, blocks: true, unlock: 1, desc: 'Refill station for cans & sprayers.' },
  compost: { name: 'Compost Bin', icon: '♻️', cost: 20, hp: 50, blocks: true, unlock: 1, desc: 'Feed it 4 weeds → get 1 free Soil Bag.' },
  scarecrow: { name: 'Scarecrow', icon: '👒', cost: 25, hp: 60, blocks: true, radius: 8, unlock: 2, desc: "Crows won't land nearby." },
  lamp: { name: 'Sun Lamp', icon: '💡', cost: 30, hp: 40, blocks: true, radius: 5.5, unlock: 2, desc: 'Plants grow at night. Deer fear it. Moths LOVE it.' },
  sprinkler: { name: 'Sprinkler', icon: '⛲', cost: 35, hp: 30, radius: 4.3, unlock: 3, desc: 'Auto-waters nearby. Wet soil lures slugs!' },
  ladybugs: { name: 'Ladybug House', icon: '🐞', cost: 40, hp: 40, blocks: true, radius: 6, unlock: 3, desc: 'Ladybugs devour mites nearby.' },
  zapper: { name: 'Bug Zapper', icon: '⚡', cost: 50, hp: 40, blocks: true, radius: 5.5, unlock: 4, desc: 'Zaps flies & moths in range.' },
  beehive: { name: 'Beehive', icon: '🐝', cost: 60, hp: 50, blocks: true, radius: 7, unlock: 5, desc: '+25% size & value nearby. Bees sting flies.' },
};

// ───────────────────────── Supplies ─────────────────────────
export const SUPPLIES = {
  soil: { name: 'Soil Bag', icon: '🟫', cost: 7, unlock: 1, desc: "Upgrade a plot's soil one level." },
  fertilizer: { name: 'Fertilizer', icon: '🧪', cost: 10, unlock: 2, desc: 'Instant growth spurt for one plant.' },
  sunjar: { name: 'Sun Jar', icon: '☀️', cost: 15, unlock: 2, desc: 'Use on a plant to boost it, or THROW at night to stun pests.' },
};

// ───────────────────────── Upgrades (shared, one-time) ─────────────────────────
export const UPGRADES = {
  pockets: { name: 'Big Pockets', icon: '👖', cost: 25, unlock: 1, desc: 'Bag capacity 5 → 10.' },
  backpack: { name: 'Backpack', icon: '🎒', cost: 60, unlock: 3, requires: 'pockets', desc: 'Bag capacity 10 → 16.' },
  wheelbarrow: { name: 'Wheelbarrow', icon: '🛒', cost: 120, unlock: 6, requires: 'backpack', desc: 'Bag capacity 16 → 25. Haul pumpkins with ease.' },
  strongback: { name: 'Strong Back', icon: '💪', cost: 40, unlock: 2, desc: 'No more slowdown when your bag is heavy.' },
  shoes: { name: 'Running Shoes', icon: '👟', cost: 30, unlock: 2, desc: 'All gnomes move 25% faster.' },
  bigcan: { name: 'Golden Can', icon: '🏆', cost: 40, unlock: 2, desc: 'Cans hold double and pour faster.' },
  sharp: { name: 'Sharp Shovels', icon: '🗡️', cost: 35, unlock: 3, desc: 'Shovels hit twice as hard and swing faster.' },
  soaphose: { name: 'Soap Mixer', icon: '🧼', cost: 40, unlock: 3, desc: 'Hose spray kills mites & burns slugs.' },
  lanterns: { name: 'Bright Lanterns', icon: '🏮', cost: 45, unlock: 3, desc: 'Gnome lanterns shine wider and scare deer.' },
  mulch: { name: 'Heart Mulch', icon: '❤️', cost: 60, unlock: 4, desc: 'Heart Bloom +150 max HP & heals faster.' },
  potato: { name: 'Hot Potatoes', icon: '🔥', cost: 70, unlock: 6, desc: 'Spud gun hits harder and pierces.' },
};

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
    case 'seed': return { name: `${PLANTS[sub].name} Seeds`, icon: '🌱', sub: PLANTS[sub].icon };
    case 'produce': return { name: PLANTS[sub].name, icon: PLANTS[sub].icon, produce: true };
    case 'kit': return { name: PLACEABLES[sub].name, icon: PLACEABLES[sub].icon };
    case 'tool': return { name: TOOLS[sub].name, icon: TOOLS[sub].icon };
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
export const itemWeight = (kind) => (kind === 'produce:pumpkin' ? 3 : kind.startsWith('kit:') || kind === 'soil' ? 2 : 1);
