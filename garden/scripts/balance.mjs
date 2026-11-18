// Prints the plant economy and the market's unlock/price curve so balance changes are made with
// numbers, not guesses. Run: npm run balance
import { PLANTS, SOIL, SHOPS, DEFS, DAY_LEN, REGROW_AT, TIER_MULT } from '../src/config.js';

// Daylight sunlight integral, matching game.js: sun = clamp(1.5·sin(πp), 0, 1). Sun-lovers grow at
// 1.5·sun^need (plants.js). Result: "rate-seconds" of growth per day, before soil.
function sunSeconds(need) {
  let s = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const sun = Math.min(1, Math.max(0, 1.5 * Math.sin(Math.PI * (i + 0.5) / N)));
    s += need ? Math.pow(sun, need) * 1.5 : sun;
  }
  return (s / N) * DAY_LEN;
}

const pad = (v, n) => String(v).padStart(n);
const money = (v) => '$' + Math.round(v);

console.log(`Tier multipliers: ${TIER_MULT.slice(1).map((m, i) => `T${i + 1} ×${m}`).join('  ')}\n`);
console.log('Plant economy (good water, harvested the moment it blooms, size ×1, no Hot Item)');
console.log('per-day numbers count daylight only; Sun Lamps add night growth\n');
console.log(['Plant', 'Day', 'T', 'Role', 'Seed', 'Sells', 'ROI', 'Grow/day@Dirt', '@Loam', 'Profit/plot/day@Dirt', '@Loam', 'Max-size sale'].map((h, i) => i ? pad(h, h.length + 2) : h.padEnd(14)).join(''));
const rows = Object.values(PLANTS).sort((a, b) => a.unlock - b.unlock || a.cost - b.cost);
for (const d of rows) {
  const day = sunSeconds(d.sunNeed);
  // a regrower blooms again after (1 - REGROW_AT) of its grow time; a single crop needs a full grow and a new seed
  const cycle = d.grow * (d.regrow ? 1 - REGROW_AT : 1);
  const perHarvest = d.regrow ? d.value : d.value - d.cost;
  const at = (soil) => {
    const hpd = (day * SOIL[soil].mult) / cycle;
    return { hpd, profit: hpd * perHarvest * (1 + 0.12 * soil) };
  };
  const dirt = at(0), loam = at(1);
  const roi = d.regrow ? `${(d.value / d.cost).toFixed(1)}/h` : `${(d.value / d.cost).toFixed(1)}×`;
  console.log([
    `${d.icon} ${d.name}`.padEnd(14), pad(d.unlock, 5), pad(d.tier, 3), pad(d.regrow ? 'regrow' : d.role, 8), pad(money(d.cost), 6), pad(money(d.value), 7),
    pad(roi, 7), pad(dirt.hpd.toFixed(2), 15), pad(loam.hpd.toFixed(2), 7), pad(money(dirt.profit), 22), pad(money(loam.profit), 7), pad(money(d.value * d.maxSize), 15),
  ].join(''));
}

console.log('\nMarket by unlock day');
const all = SHOPS.flatMap((s) => s.items.map(([kind, key]) => ({ ...DEFS[kind][key], cat: s.id })));
const days = [...new Set(all.map((d) => d.unlock))].sort((a, b) => a - b);
for (const day of days) {
  const list = all.filter((d) => d.unlock === day).sort((a, b) => a.cost - b.cost);
  console.log(`Day ${pad(day, 2)}: ${list.map((d) => `${d.name} ${money(d.cost)}`).join(' · ')}`);
}

console.log('\nShops (left to right)');
for (const s of SHOPS) console.log(`${s.icon} ${s.name.padEnd(13)} ${s.items.map(([kind, key]) => `${DEFS[kind][key].name} d${DEFS[kind][key].unlock} ${money(DEFS[kind][key].cost)}`).join(' · ')}`);
