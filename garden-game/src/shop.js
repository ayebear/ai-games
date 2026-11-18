import { PLANTS, TOOLS, PLACEABLES, SUPPLIES, UPGRADES, CAN_CAP, SPRAY_CAP } from './config.js';
import { G } from './state.js';
import { sfx } from './audio.js';
import { glyphsFor } from './input.js';

const list = (obj, kind, prefix = '') => Object.entries(obj).map(([k, d]) => ({
  key: k, kind, name: d.name + prefix, icon: d.icon, cost: d.cost, unlock: d.unlock ?? 1, desc: d.desc, requires: d.requires,
}));

export const TABS = [
  { name: 'Seeds', icon: '🌱', items: list(PLANTS, 'seed', ' Seeds') },
  { name: 'Tools', icon: '⛏️', items: list(TOOLS, 'tool').filter((t) => t.key !== 'hands' && !TOOLS[t.key].weapon) },
  { name: 'Weapons', icon: '⚔️', items: list(TOOLS, 'tool').filter((t) => TOOLS[t.key].weapon) },
  { name: 'Garden', icon: '🏡', items: list(PLACEABLES, 'kit') },
  { name: 'Supplies', icon: '🧪', items: list(SUPPLIES, 'supply') },
  { name: 'Upgrades', icon: '⭐', items: list(UPGRADES, 'upgrade') },
  { name: 'Sell Tools', icon: '💰', sell: true },
];

// The Sell tab is built per player from the tools they own (half price back).
export function tabItems(p, tabIdx) {
  const tab = TABS[tabIdx];
  if (!tab.sell) return tab.items;
  const own = p.tools.filter((t) => t !== 'hands').map((k) => {
    const d = TOOLS[k];
    const price = Math.max(1, Math.floor(d.cost / 2));
    return { key: k, kind: 'selltool', name: d.name, icon: d.icon, cost: price, unlock: 1, desc: `Sell your ${d.name} back for $${price} (half price). You can also hold B to drop it for a teammate.` };
  });
  return own.length ? own : [{ key: 'none', kind: 'none', name: 'No tools to sell', icon: '🤷', cost: 0, unlock: 1, desc: 'Buy tools in the Tools or Weapons tabs.' }];
}

const carryKind = (it) => (it.kind === 'seed' ? 'seed:' + it.key : it.kind === 'kit' ? 'kit:' + it.key : it.key);

export function itemStatus(p, it) {
  if (it.kind === 'selltool') return { ok: true };
  if (it.kind === 'none') return { ok: false, reason: 'Nothing to sell' };
  if (G.day < it.unlock) return { ok: false, reason: `Unlocks day ${it.unlock}`, locked: true };
  if (it.kind === 'tool' && p.tools.includes(it.key)) return { ok: false, reason: 'Owned', owned: true };
  if (it.kind === 'upgrade' && G.upgrades.has(it.key)) return { ok: false, reason: 'Owned', owned: true };
  if (it.requires && !G.upgrades.has(it.requires)) return { ok: false, reason: `Needs ${UPGRADES[it.requires].name} first`, locked: true };
  if (G.money < it.cost) return { ok: false, reason: `Need $${it.cost - G.money} more` };
  if (['seed', 'kit', 'supply'].includes(it.kind) && !p.canTake(carryKind(it))) {
    return { ok: false, reason: p.carry && p.carry.kind !== carryKind(it) ? 'Hands full! Sell or drop first' : `Bag full (${p.load}/${p.capacity})` };
  }
  return { ok: true };
}

export function openShop(p) {
  p.shop = { tab: p.lastTab ?? 0, sel: 0 };
  sfx('pickup');
}
export function closeShop(p) {
  if (!p.shop) return;
  p.lastTab = p.shop.tab;
  p.shop = null;
}

export function shopInput(p, inp) {
  const s = p.shop;
  if (inp.pressed.b || G.phase === 'night') { closeShop(p); sfx('pickup'); return; }
  const dt = (inp.pressed.rb || inp.nav.right ? 1 : 0) - (inp.pressed.lb || inp.nav.left ? 1 : 0);
  if (dt) { s.tab = (s.tab + dt + TABS.length) % TABS.length; s.sel = 0; sfx('pickup'); }
  const items = tabItems(p, s.tab);
  s.sel = Math.min(s.sel, items.length - 1);
  if (inp.nav.up) s.sel = (s.sel - 1 + items.length) % items.length;
  if (inp.nav.down) s.sel = (s.sel + 1) % items.length;
  if (inp.pressed.a) buy(p, items[s.sel]);
}

function buy(p, it) {
  const st = itemStatus(p, it);
  if (!st.ok) { sfx('error'); G.fx.text(p.pos, st.reason, '#ffab91', 14); return; }
  if (it.kind === 'selltool') {
    const i = p.tools.indexOf(it.key);
    p.tools.splice(i, 1);
    p.toolIdx = Math.min(p.toolIdx, p.tools.length - 1);
    G.money += it.cost;
    G.stats.moneyEarned += it.cost;
    p.stats.earned += it.cost;
    p.stats.sold++;
    G.fx.text(p.pos, `+$${it.cost}`, '#ffd54f', 18);
    sfx('coin');
    return;
  }
  G.money -= it.cost;
  G.stats.moneySpent += it.cost;
  p.stats.spent += it.cost;
  const rec = (p.stats.bought[it.kind + ':' + it.key] ??= { icon: it.icon, name: it.name, n: 0, spent: 0 });
  rec.n++;
  rec.spent += it.cost;
  switch (it.kind) {
    case 'seed': case 'kit': case 'supply':
      p.give(carryKind(it));
      break;
    case 'tool':
      p.tools.push(it.key);
      p.toolIdx = p.tools.length - 1;
      if (it.key === 'can') p.can = CAN_CAP;
      if (it.key === 'spray') p.spray = SPRAY_CAP;
      break;
    case 'upgrade':
      G.upgrades.add(it.key);
      if (it.key === 'mulch') G.heart.hp += 150;
      G.fx.toast(`${it.icon} ${it.name}!`, it.desc);
      break;
  }
  sfx('buy');
}

export function renderShop(p) {
  const s = p.shop;
  const g = glyphsFor(p.device);
  const tab = TABS[s.tab];
  const items = tabItems(p, s.tab);
  s.sel = Math.min(s.sel, items.length - 1);
  const start = Math.max(0, Math.min(s.sel - 3, items.length - 7));
  const rows = items.slice(start, start + 7).map((it, k) => {
    const i = start + k;
    const st = itemStatus(p, it);
    const cls = [i === s.sel ? 'sel' : '', st.ok ? '' : 'no', st.locked ? 'locked' : '', st.owned ? 'owned' : ''].join(' ');
    const right = it.kind === 'selltool' ? `<span class="gain">+$${it.cost}</span>` : it.kind === 'none' ? '' : st.owned ? '✔' : st.locked ? (G.day < it.unlock ? `🔒D${it.unlock}` : '🔒') : `$${it.cost}`;
    return `<div class="row ${cls}"><span class="ic">${it.icon}</span><span class="nm">${it.name}</span><span class="pr">${right}</span></div>`;
  }).join('');
  const cur = items[s.sel];
  const st = itemStatus(p, cur);
  return `<div class="shop">
    <div class="tabs">${TABS.map((t, i) => `<span class="${i === s.tab ? 'on' : ''}">${t.icon}</span>`).join('')}</div>
    <div class="tabname">${g.lb} ◀ ${tab.name} ▶ ${g.rb}</div>
    <div class="list">${rows}</div>
    <div class="desc">${cur.desc}${st.ok ? '' : `<div class="why">${st.reason}</div>`}</div>
    <div class="hint">${g.a} ${tab.sell ? 'Sell' : 'Buy'} &nbsp; ${g.b} Close &nbsp; · &nbsp; Bag <b class="${p.loadRatio >= 1 ? 'full' : ''}">${p.load}/${p.capacity}</b></div>
  </div>`;
}
