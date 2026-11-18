import * as THREE from 'three';
import { DAY_LEN, NIGHT_LEN, PLAYER_CSS, PLAYER_NAMES, TOOLS, BAGS, PLANTS, SOIL, ENEMIES, GOAL_DAYS, WEATHER, itemInfo, SPRAY_CAP } from './config.js';
import { G, activePlayers, attackedThings } from './state.js';
import { glyphsFor, padBtn, keyBtn } from './input.js';
import { STAGE_NAMES } from './plants.js';
import { iconHTML, invIconHTML } from './icons.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const setHTML = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const v = new THREE.Vector3();
const q = (x) => Math.round(Math.max(0, Math.min(1, x)) * 50) / 50; // quantize to limit DOM churn
// An icon on an opaque disc, wrapped in a radial progress ring. `ticks` = angles (deg) for target-range marks.
const ring = (icon, p, color, cls = '', label = '', ticks = []) =>
  `<div class="ring ${cls}" style="--p:${q(p)};--c:${color}">${ticks.map((a) => `<i class="tick" style="--a:${a}deg"></i>`).join('')}<span>${icon}</span>${label ? `<em>${label}</em>` : ''}</div>`;
// ideal water is 30–90% of a 0–125% scale → 24%..72% of the ring
const WATER_TICKS = [0.24 * 360, 0.72 * 360];

// Day/night wheel: day takes this many degrees of the dial, night the rest.
const DAY_DEG = (360 * DAY_LEN) / (DAY_LEN + NIGHT_LEN);
// Where the dial points right now (degrees clockwise from the top), continuous across the cycle.
const clockDeg = () => (G.phase === 'day' ? (G.time / DAY_LEN) * DAY_DEG : DAY_DEG + (G.time / NIGHT_LEN) * (360 - DAY_DEG));

// First-day checklist, shown at the bottom of the screen. Each item ticks off as soon as it's done
// (in any order) and stays ticked; the list goes away once everything is checked.
// s = totals over all gnomes.
const GOALS = [
  { text: '🌿 Pull weeds and sell them at the 💰 Quick Sell kiosk', done: (s) => s.sold > 0 },
  { text: '🌼 Buy Daisy seeds at the 🌱 Seeds shop', done: (s) => s.seeds > 0 },
  { text: '🟫 Plant them in a dug plot near the Heart', done: () => G.stats.planted > 0 },
  { text: '💧 Get dew from the drops or the pond', done: (s) => s.dew || G.stats.plantWater > 0 },
  { text: '🌱 Water your plant', done: () => G.stats.plantWater > 0 },
];
function goalSums() {
  const s = { sold: 0, seeds: 0, dew: false };
  for (const p of G.slots) {
    if (!p) continue;
    s.sold += p.stats.sold;
    if (p.stack('dew')) s.dew = true;
    for (const k in p.stats.bought) if (k.startsWith('seed:')) s.seeds++;
  }
  return s;
}

export class HUD {
  constructor() {
    this.top = $('top');
    this.panels = [0, 1, 2, 3].map((i) => $('p' + i));
    this.labels = $('labels');
    this.screen = $('screen');
    this.prompts = [0, 1, 2, 3].map(() => this.mk('prompt'));
    this.cards = [0, 1, 2, 3].map(() => this.mk('pcard'));
    this.badges = new Map();
    this.alarms = new Map(); // ⚠️ markers over attacked gadgets / heart / coin jar
    this.wheel = this.buildWheel();
    this.buildTop();
    this.goals = $('goals');
  }

  // Top bar: built once. Every field has a fixed width and only its own text changes per frame,
  // so nothing in the bar ever moves or resizes.
  buildTop() {
    this.top.innerHTML = `
      <div class="tb">
        <div class="clockw"><div class="wslot"></div><div class="dl"><div class="day"><span data-f="phase"></span> <b data-f="day"></b><small>/${GOAL_DAYS}</small></div><small data-f="left"></small></div></div>
        <div class="money">💰 <b data-f="money"></b></div>
        <div class="heart">🌸<div class="hcol"><div class="bar hb"><i data-f="hpbar"></i></div><small data-f="hp"></small></div><span class="hicon" data-f="hicon"></span></div>
        <div class="info"><div data-f="wx"></div><div data-f="extra"></div></div>
      </div>
      <div data-f="boss"></div>`;
    this.top.querySelector('.wslot').appendChild(this.wheel);
    this.f = Object.fromEntries([...this.top.querySelectorAll('[data-f]')].map((el) => [el.dataset.f, el]));
  }

  // The day/night wheel: a half dial (day arc with the sun, night arc with the moon) turning under a
  // fixed pointer at the top, with today's weather in the hub. Only its rotation changes per frame.
  buildWheel() {
    const el = document.createElement('div');
    el.className = 'wheel';
    const D = DAY_DEG;
    el.style.setProperty('--sky', `conic-gradient(#f6a98a 0deg, #8fd3ff 26deg, #8fd3ff ${D - 26}deg, #f0855a ${D}deg, #1d2a5c ${D + 20}deg, #1d2a5c ${340}deg, #f6a98a 360deg)`);
    el.innerHTML = `<div class="dial"><i style="--a:${D / 2}deg">☀️</i><i style="--a:${D + (360 - D) / 2}deg">🌙</i></div><div class="hub"><span></span></div><b class="ptr"></b>`;
    return el;
  }
  updateWheel() {
    this.wheel.style.setProperty('--t', `${clockDeg().toFixed(2)}deg`);
    const W = WEATHER[G.weather];
    const icon = G.weather === 'clear' && G.night > 0.5 ? '✨' : W.icon;
    const hub = this.wheel.querySelector('.hub span');
    if (hub.textContent !== icon) { hub.textContent = icon; hub.parentNode.title = W.name; }
  }

  // The first-day checklist (bottom center). The first unchecked item is highlighted.
  updateGoals(playing) {
    if (this.goalStats !== G.stats) { this.goalStats = G.stats; this.goalDone = GOALS.map(() => false); }
    const all = this.goalDone.every(Boolean);
    if (!playing || all) { this.goals.style.display = 'none'; return; }
    const s = goalSums();
    GOALS.forEach((g, i) => { if (!this.goalDone[i] && g.done(s)) { this.goalDone[i] = true; sfx('coin'); } });
    if (this.goalDone.every(Boolean)) {
      G.fx.toast('🌸 You\'re all set!', 'Keep the garden growing, and get ready for the night.');
      this.goals.style.display = 'none';
      return;
    }
    const next = this.goalDone.indexOf(false);
    const n = this.goalDone.filter(Boolean).length;
    this.goals.style.display = '';
    setHTML(this.goals, `<div class="gh">Getting started <small>${n}/${GOALS.length}</small></div>${GOALS.map((g, i) =>
      `<div class="gi ${this.goalDone[i] ? 'done' : i === next ? 'next' : ''}"><b>${this.goalDone[i] ? '✔' : ''}</b><span>${g.text}</span></div>`).join('')}`);
  }
  mk(cls) { const el = document.createElement('div'); el.className = cls; el.style.display = 'none'; this.labels.appendChild(el); return el; }

  // below = hang the element under the point instead of above it
  project(pos, y, el, below = false) {
    v.set(pos.x, y, pos.z).project(G.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.transform = `translate(-50%,${below ? '12px' : '-100%'}) translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
  }

  update() {
    const playing = G.state === 'playing' || G.state === 'paused';
    this.top.style.display = playing ? '' : 'none';
    if (playing) this.updateTop();
    this.updateGoals(G.state === 'playing' || G.state === 'paused');
    for (let i = 0; i < 4; i++) this.updatePanel(i, playing);
    this.updateWorldLabels(playing);
  }

  updateTop() {
    const f = this.f;
    const night = G.phase === 'night';
    const left = night ? NIGHT_LEN - G.time : DAY_LEN - G.time;
    const h = G.heart;
    const hr = Math.max(0, h.hp / h.maxHp);
    const pests = G.enemies.filter((e) => !e.dead && !e.fleeing).length + (night ? G.director.queue.length : 0);
    const W = WEATHER[G.weather];
    const text = (el, t) => { if (el.textContent !== t) el.textContent = t; };
    text(f.phase, night ? 'Night' : 'Day');
    f.phase.parentNode.classList.toggle('n', night);
    text(f.day, String(G.day));
    text(f.left, `${night ? 'dawn' : 'dusk'} in ${fmtT(Math.max(0, left))}`);
    text(f.money, `$${Math.floor(G.money)}`);
    const hw = `${(hr * 100).toFixed(1)}%`;
    if (f.hpbar.style.width !== hw) { f.hpbar.style.width = hw; f.hpbar.style.background = hr > 0.5 ? '#ff6fa8' : hr > 0.25 ? '#ffa040' : '#ff3030'; }
    text(f.hp, `${Math.ceil(h.hp)}/${h.maxHp} · 💧${Math.round(h.water * 100)}%`);
    setHTML(f.hicon, waterIcon(h.waterState));
    text(f.wx, `${W.icon} ${W.name} · Hot ${PLANTS[G.hotItem].icon}×2`);
    setHTML(f.extra, `${night || pests ? `🐛 ${pests} · ` : ''}${padBtn('start')}<small>/</small>${keyBtn('Esc')} pause`);
    setHTML(f.boss, G.boss && !G.boss.dead ? `<div class="boss"><span>🌙 MOON STAG</span><div class="bar"><i style="width:${(G.boss.hp / G.boss.maxHp) * 100}%"></i></div></div>` : '');
    this.updateWheel();
  }

  updatePanel(i, playing) {
    const el = this.panels[i];
    const p = G.slots[i];
    if (!playing) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.setProperty('--pc', PLAYER_CSS[i]);
    if (!p || !p.active) {
      el.className = `panel p${i} empty`;
      setHTML(el, `<div class="join">Press ${padBtn('start')} to join</div>`);
      return;
    }
    el.className = `panel p${i}`;
    const g = glyphsFor(p.device);
    const tool = p.tool;
    let meter = '';
    if (tool === 'can' || p.canT > 0) meter = this.meter('💧', p.can / p.canCap, '#4fc3f7');
    if (tool === 'spray' || (tool !== 'can' && p.sprayT > 0)) meter = this.meter('🧼', p.spray / SPRAY_CAP, '#f48fb1');
    if (tool === 'mgun') meter = this.meter(p.overheat ? '🔥' : '🌡️', p.heat || 0, p.overheat ? '#ff5252' : '#ffb74d');
    const h = p.held;
    const name = h.kind === 'hands' ? TOOLS.hands.name : itemInfo(h.kind).name;
    const worth = h.kind.startsWith('produce:') ? ` <small>$${p.priceOf([h])}</small>` : '';
    const lr = p.loadRatio;
    const lcol = lr >= 1 ? '#ff5252' : lr >= 0.7 ? '#ffb74d' : '#9ccc65';
    const bagIcon = p.bag ? iconHTML('bag:' + p.bag) : '👖';
    const heavy = p.loadSlow > 0.02 ? '<span class="heavy">🏋️</span>' : '';
    const load = `<div class="load">${bagIcon}<div class="bar"><i style="width:${Math.min(1, lr) * 100}%;background:${lcol}"></i></div><b class="${lr >= 1 ? 'full' : ''}">${lr >= 1 ? 'FULL' : `${p.load}/${p.capacity}`}</b>${heavy}</div>`;
    const leaving = p.leaveT > 0.1 ? `<div class="leave">Leaving… ${Math.round((p.leaveT / 1) * 100)}%</div>` : '';
    setHTML(el, `
      <div class="pname"><span class="dot"></span>P${i + 1} ${PLAYER_NAMES[i]} <small>${p.device.startsWith('gp') ? '🎮' : '⌨️'}</small></div>
      <div class="inv">${g.lb}<div class="istrip">${invStrip(p)}</div>${g.rb}</div>
      <div class="tname">${name}${worth}</div>
      ${meter}${load}${leaving}`);
  }
  meter(icon, f, col) {
    return `<div class="meter">${icon}<div class="bar"><i style="width:${Math.max(0, Math.min(1, f)) * 100}%;background:${col}"></i></div></div>`;
  }

  updateWorldLabels(playing) {
    // daylight 0..1 drives ring contrast (dark backing plates by day, airy at night)
    const day = Math.round((1 - (G.night ?? 0)) * 20) / 20;
    if (day !== this._day) { this._day = day; this.labels.style.setProperty('--day', day); }
    const shown = new Set();
    for (let i = 0; i < 4; i++) {
      const p = G.slots[i];
      const pr = this.prompts[i], card = this.cards[i];
      if (!playing || G.state === 'paused' || !p || !p.active) { pr.style.display = 'none'; card.style.display = 'none'; continue; }
      // browsing a market stall: one card over the stall with buy / sell prompts
      if (p.ctx && p.ctx.stall) {
        pr.style.display = 'none';
        const st = p.ctx.stall;
        const stacked = [...shown].filter((o) => o === st).length;
        shown.add(st);
        setHTML(card, G.market.cardHTML(p, st).replace('class="stall"', `class="stall" data-k="${stacked}"`));
        card.style.setProperty('--pc', PLAYER_CSS[i]);
        this.project(st.pos, 3.0 + stacked * 1.6, card);
        continue;
      }
      const g = glyphsFor(p.device);
      const parts = [];
      if (p.ctx) {
        const hold = p.ctx.hold ? `<div class="hold"><i style="width:${(p.holdT / p.ctx.hold) * 100}%"></i></div>` : '';
        parts.push(`<div class="${p.ctx.off ? 'off' : ''}">${g.a} ${p.ctx.hold ? 'Hold: ' : ''}${p.ctx.label}${hold}</div>`);
      }
      if (p.xLabel && p.tool !== 'hands') parts.push(`<div class="x ${p.xOff ? 'off' : ''}">${g.x} ${p.xLabel}</div>`);
      setHTML(pr, parts.join(''));
      pr.style.borderColor = PLAYER_CSS[i];
      if (parts.length) this.project(p.pos, 3.0, pr); else pr.style.display = 'none';
      // plant info card
      const pl = p.plantInFront();
      if (pl && !shown.has(pl)) {
        shown.add(pl);
        setHTML(card, this.plantCard(pl));
        this.project(pl.pos, pl.topY + 0.5, card);
      } else card.style.display = 'none';
    }
    // badges for plants needing attention
    for (const [pl, el] of this.badges) if (pl.dead || !playing) { el.remove(); this.badges.delete(pl); }
    if (!playing) return;
    for (const pl of G.plants) {
      if (pl.dead) continue;
      let el = this.badges.get(pl);
      if (shown.has(pl)) { if (el) el.style.display = 'none'; continue; }
      if (!el) { el = this.mk('badge'); this.badges.set(pl, el); }
      // one danger alert (most urgent first), plus the water icon when water isn't healthy
      let alert = '';
      if (G.clock - (pl.attackedAt ?? -99) < 1.5) alert = '⚔️';
      else if (pl.mites >= 1) alert = '🐛';
      else if (pl.hp < pl.maxHp * 0.4) alert = '💔';
      const main = pl.bloomed ? ring(pl.def.icon, 1, '#ffd54f', 'ready') : ring(pl.def.icon, pl.growth, '#9ccc65');
      // health ring whenever the plant is hurt at all
      const hp = pl.hp / pl.maxHp;
      const hpRing = hp < 1 ? ring('❤️', hp, hp < 0.4 ? '#ff5252' : '#ef5350', 'hp') : '';
      setHTML(el, `<div class="mini">${main}${alert ? `<div class="alert"><span>${alert}</span></div>` : ''}${hpRing}${waterIcon(pl.waterState)}</div>`);
      this.project(pl.pos, pl.topY + 0.5, el);
    }
    // water icon over the Heart Bloom when it's thirsty
    const hs = playing && !G.heart.dead ? G.heart.waterState : 'ok';
    if (!this.heartWater) this.heartWater = this.mk('badge');
    if (hs === 'ok') this.heartWater.style.display = 'none';
    else {
      setHTML(this.heartWater, `<div class="mini">${waterIcon(hs, true)}</div>`);
      this.project(G.heart.pos, 4.6, this.heartWater);
    }
    // alarm markers over attacked non-plant things
    const hot = new Set(G.state === 'playing' ? attackedThings().filter((t) => t.kind !== 'plant') : []);
    for (const [t, el] of this.alarms) if (!hot.has(t)) { el.remove(); this.alarms.delete(t); }
    for (const t of hot) {
      let el = this.alarms.get(t);
      if (!el) {
        el = this.mk('badge');
        el.innerHTML = `<div class="alarm">⚠️ <span>${t.kind === 'jar' ? 'Coin jar!' : t.kind === 'heart' ? 'Heart Bloom!' : t.def?.name ?? ''}</span></div>`;
        this.alarms.set(t, el);
      }
      this.project(t.pos, t.kind === 'heart' ? 5.5 : 2.6, el);
    }
  }

  // Minimal plant readout (no panel): opaque icon discs wrapped in radial progress rings.
  plantCard(pl) {
    const w = pl.water;
    const wcol = w < 0.1 ? '#ff5252' : w < 0.3 ? '#ffb74d' : w <= 0.9 ? '#4fc3f7' : '#b388ff';
    const hp = pl.hp / pl.maxHp;
    const grow = pl.stage === 4
      ? ring(pl.def.icon, (pl.size - 1) / Math.max(0.01, pl.def.maxSize - 1), '#ffd54f', 'ready', `×${pl.size.toFixed(1)}`)
      : ring(pl.def.icon, pl.growth, '#9ccc65');
    const warn = [
      pl.mites >= 1 ? `🐛${Math.ceil(pl.mites)}` : '',
      pl.cell.weed ? '🌿' : '',
      { none: '<b>no water</b>', low: 'low water', soggy: '<b>soggy</b>' }[pl.waterState] ?? '',
    ].filter(Boolean).join(' ');
    const perks = [pl.hive ? '🐝' : '', pl.marigoldNear ? '🏵️' : '', pl.ladybugs ? '🐞' : ''].join('');
    return `<div class="rings">${grow}${ring('💧', w / 1.25, wcol, 'water', '', WATER_TICKS)}${ring('☀️', pl.sunNow, '#ffd54f')}${ring('❤️', hp, hp < 0.4 ? '#ff5252' : '#ef5350')}</div>
      <div class="tags"><i class="soil s${pl.cell.soil}" title="${SOIL[pl.cell.soil].name}"></i>${perks}${warn ? ` <span class="warn">${warn}</span>` : ''}</div>`;
  }

  // ───────────── Screens ─────────────
  hideScreen() { this.screen.style.display = 'none'; this.screen._h = ''; }

  showTitle() {
    this.screen.style.display = '';
    this.screen.className = 'title';
    const slots = G.slots.map((p, i) => {
      if (p && p.active) return `<div class="slot on" style="--pc:${PLAYER_CSS[i]}"><div class="gn">🧙</div><b>P${i + 1} ${PLAYER_NAMES[i]}</b><small>${p.device.startsWith('gp') ? '🎮 Gamepad' : '⌨️ Keyboard'}</small></div>`;
      return `<div class="slot" style="--pc:${PLAYER_CSS[i]}"><div class="gn">＋</div><b>Press START</b><small>to join</small></div>`;
    }).join('');
    const any = activePlayers().length > 0;
    setHTML(this.screen, `
      <div class="logo">BLOOM <span>&amp;</span> DOOM</div>
      <div class="tag">Grow and defend your garden from dangerous pests!</div>
      <div class="slots">${slots}</div>
      <div class="go ${any ? '' : 'dim'}">${any ? `Press ${padBtn('a')} / ${keyBtn('Space')} to begin!` : `Press ${padBtn('start')} on a controller (or ${keyBtn('Enter')} / ${keyBtn('R-Shift')}) to join`}</div>
      <div class="how">
        <div>🌱 Grow flowers, sell them, buy better gear.</div>
        <div>🌙 Pests attack at night. Keep the <b>Heart Bloom</b> alive for ${GOAL_DAYS} days!</div>
      </div>
      <div class="keys">
        <div><b>🎮 Gamepad</b> — Stick move · ${padBtn('a')} interact · ${padBtn('x')}/${padBtn('rt')} use item · ${padBtn('b')} drop · ${padBtn('y')} throw · ${padBtn('lb')}${padBtn('rb')} switch item · hold ${padBtn('start')} leave · ${padBtn('back')} pause</div>
        <div><b>⌨️ P1</b> — WASD · Space interact · J use · K drop · L throw · Q/E switch · Enter join (hold: leave) · Esc pause</div>
        <div><b>⌨️ P2</b> — Arrows · . interact · , use · / drop · ; throw · M/' switch · Right Shift join</div>
      </div>`);
  }

  showPause() {
    this.screen.style.display = '';
    this.screen.className = 'pause';
    const none = activePlayers().length === 0;
    const players = G.slots.filter(Boolean);
    const cards = players.map((p) => `<div class="pc" style="--pc:${PLAYER_CSS[p.idx]}"><div class="pn">P${p.idx + 1} ${PLAYER_NAMES[p.idx]}</div>${purchases(p)}</div>`).join('');
    setHTML(this.screen, `<div class="logo small">${none ? 'Waiting for gnomes…' : 'Paused'}</div>
      ${players.length ? `<div class="tag">Shopping so far</div><div class="pcs">${cards}</div>` : ''}
      <div class="go">${none ? `Press ${padBtn('start')} to join` : `Press ${padBtn('back')} / ${keyBtn('Esc')} to resume`}</div>`);
  }

  showEnd(victory) {
    this.screen.style.display = '';
    this.screen.className = 'end';
    const S = G.stats;
    const kills = Object.entries(S.kills).map(([k, n]) => `<span>${ENEMIES[k].icon} ${n}</span>`).join('') || '<span>none</span>';
    const harv = Object.entries(S.harvested).map(([k, n]) => `<span>${PLANTS[k].icon} ${n}</span>`).join('') || '<span>none</span>';
    const totalKills = Object.values(S.kills).reduce((a, b) => a + b, 0);
    const big = S.biggest ? `${PLANTS[S.biggest.type].icon} ${PLANTS[S.biggest.type].name} ×${S.biggest.size.toFixed(2)} ($${S.biggest.value})` : '—';
    const players = G.slots.filter(Boolean);
    const titles = assignTitles(players);
    const cards = players.map((p) => `
      <div class="pc" style="--pc:${PLAYER_CSS[p.idx]}">
        <div class="pn">P${p.idx + 1} ${PLAYER_NAMES[p.idx]}</div>
        <div class="ti">${titles.get(p)}</div>
        <div class="ps">🌾 ${p.stats.harvests} harvests · 🌱 ${p.stats.planted} planted<br>⚔️ ${p.stats.kills} pests · 🌿 ${p.stats.weeds} weeds<br>💧 ${p.stats.water.toFixed(1)} water · 💰 $${Math.round(p.stats.earned)} earned · 🏷️ ${p.stats.sold} sold</div>
        ${purchases(p)}
      </div>`).join('');
    setHTML(this.screen, `
      <div class="logo small ${victory ? '' : 'sad'}">${victory ? '🌸 THE GARDEN THRIVES 🌸' : '🥀 The Heart Bloom has fallen'}</div>
      <div class="tag">${victory ? `You protected the garden for ${GOAL_DAYS} days!` : `Your garden survived <b>${G.day - 1}</b> day${G.day - 1 === 1 ? '' : 's'} (${S.nights} night${S.nights === 1 ? '' : 's'} cleared)`}</div>
      <div class="stats">
        <div><small>Money earned</small><b>$${Math.round(S.moneyEarned)}</b></div>
        <div><small>Money spent</small><b>$${Math.round(S.moneySpent)}</b></div>
        <div><small>Stolen by raccoons</small><b>$${S.moneyStolen}</b></div>
        <div><small>Seeds planted</small><b>${S.planted}</b></div>
        <div><small>Plants lost</small><b>${S.plantsLost}</b></div>
        <div><small>Weeds pulled</small><b>${S.weeds}</b></div>
        <div><small>Mites cleared</small><b>${Math.round(S.mites)}</b></div>
        <div><small>Pests defeated</small><b>${totalKills}</b></div>
        <div class="wide"><small>Biggest plant</small><b>${big}</b></div>
        <div class="wide"><small>Harvests</small><b class="row">${harv}</b></div>
        <div class="wide"><small>Pests by type</small><b class="row">${kills}</b></div>
      </div>
      <div class="pcs">${cards}</div>
      <div class="go">${victory ? `Press ${padBtn('y')} / ${keyBtn('L')} to keep playing (endless) · ` : ''}Press ${padBtn('a')} / ${keyBtn('Space')} for a new garden</div>`);
  }
}

// The inventory strip: the stack in your hands and its neighbors, turning like a carousel so the one
// in your hands is always in the middle (and bigger). Counts sit tight against the icon: "5×🌿".
const INV_SHOWN = 3;
function invStrip(p) {
  const n = p.inv.length, m = Math.min(n, INV_SHOWN);
  const start = p.sel - Math.floor((m - 1) / 2);
  let out = '';
  for (let k = 0; k < m; k++) {
    const idx = (((start + k) % n) + n) % n;
    const s = p.inv[idx];
    out += `<span class="islot${idx === p.sel ? ' on' : ''}">${s.count > 1 ? `<i class="q">${s.count}×</i>` : ''}${invIconHTML(s.kind)}</span>`;
  }
  return out;
}

// Per-player shopping receipt: every item bought, how many, and what it cost.
function purchases(p) {
  const list = Object.values(p.stats.bought).sort((a, b) => b.spent - a.spent);
  if (!list.length) return '<div class="buys"><div class="bh">🛍️ Bought nothing</div></div>';
  const rows = list.map((r) => `<div class="br"><span>${iconHTML(r.icon)} ${r.name}${r.n > 1 ? ` <b>×${r.n}</b>` : ''}</span><span>$${r.spent}</span></div>`).join('');
  return `<div class="buys"><div class="bh">🛍️ Bought ${list.reduce((s, r) => s + r.n, 0)} items · <b>$${Math.round(p.stats.spent)}</b></div>${rows}</div>`;
}

function assignTitles(players) {
  const cats = [
    ['kills', 'The Exterminator'], ['harvests', 'Green Thumb'], ['water', 'Water Bearer'], ['weeds', 'Weed Whacker'],
    ['earned', 'Merchant'], ['spent', 'Big Spender'], ['tilled', 'Groundbreaker'], ['planted', 'Seed Slinger'],
  ];
  const out = new Map();
  const used = new Set();
  for (const p of players) {
    let best = null, bs = 0;
    for (const [k, name] of cats) {
      const max = Math.max(...players.map((q) => q.stats[k]));
      if (!max) continue;
      const s = p.stats[k] / max - (used.has(name) ? 0.5 : 0);
      if (s > bs) { bs = s; best = name; }
    }
    best = best || 'Garden Gnome';
    used.add(best);
    out.set(p, best);
  }
  return out;
}

// Water status icon: nothing when healthy; soggy (overwatered), low, or none (a crossed-out drop).
// Same look on plant badges, the Heart Bloom and the top bar.
export function waterIcon(state, big = false) {
  if (state === 'ok') return '';
  const glyph = state === 'soggy' ? '🌊' : '💧';
  return `<div class="wico ${state}${big ? ' big' : ''}" title="${{ soggy: 'Soggy', low: 'Low water', none: 'No water' }[state]}"><span>${glyph}</span></div>`;
}
