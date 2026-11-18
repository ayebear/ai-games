// The walk-in market. Every item in the game has its own stall with a 3D display and a live price
// board. Walk up to a stall: A buys it, X sells that item back (its produce, seeds, kit, supply or
// your own tool). The Trading Post at the front center is the quick-sell counter for anything.
import * as THREE from 'three';
import {
  PLANTS, TOOLS, PLACEABLES, SUPPLIES, UPGRADES, CAN_CAP, SPRAY_CAP, STALLS, SECTIONS, MARKET, CELL, HALF, COUNTER,
  itemInfo, sellEach,
} from './config.js';
import { G, dist2 } from './state.js';
import { P, mat, glow, BOX, CYL, CONE, SPH, HEMI, PLANE, makeTool, makeItem, makePlaceable, makePlantModel } from './models.js';
import { makeTextTexture } from './scene.js';
import { glyphsFor } from './input.js';
import { sfx } from './audio.js';

const DEFS = { seed: PLANTS, tool: TOOLS, kit: PLACEABLES, supply: SUPPLIES, upgrade: UPGRADES };
const cellX = (i) => i * CELL - HALF + CELL / 2;
const halfPrice = (n) => Math.max(1, Math.floor(n / 2));
// The carried-item kind a purchase gives you.
const carryKind = (it) => (it.kind === 'seed' ? 'seed:' + it.key : it.kind === 'kit' ? 'kit:' + it.key : it.key);
// Carried kinds a stall buys back: a seed stall also buys that plant's produce.
const buysBack = (it) => (it.kind === 'seed' ? ['produce:' + it.key, 'seed:' + it.key] : it.kind === 'kit' || it.kind === 'supply' ? [carryKind(it)] : []);

const TABLE_Y = 0.92;

export class Market {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.refreshT = 0;
    this.stalls = STALLS.map((s, n) => this.buildStall(s, n));
    this.buildGrounds();
  }

  // ───────────── Building ─────────────
  buildStall(s, n) {
    const def = DEFS[s.kind][s.key];
    const item = {
      kind: s.kind, key: s.key, icon: def.icon, cost: def.cost, unlock: def.unlock ?? 1, desc: def.desc, requires: def.requires,
      name: s.kind === 'seed' ? `${def.name} Seeds` : def.name,
    };
    const back = s.j === MARKET.j0;
    const sec = SECTIONS[s.section];
    const g = new THREE.Group();
    g.position.set(cellX(s.i), 0, cellX(s.j));
    // table: wooden crate body, section-colored cloth with the section name on the front skirt
    P(g, BOX(), mat(0x9a6a3a), [0, 0.42, 0], [1.55, 0.84, 1.15]);
    P(g, BOX(), mat(sec.hex), [0, 0.87, 0], [1.68, 0.08, 1.28]);
    P(g, BOX(), mat(sec.hex), [0, 0.68, 0.62], [1.68, 0.36, 0.04]);
    P(g, PLANE(), new THREE.MeshBasicMaterial({ map: sectionTex(s.section), transparent: true, toneMapped: false }), [0, 0.68, 0.645], [1.5, 0.3, 1], [0, 0, 0], false);
    // price board on a post behind the display, tilted up toward the camera
    const signY = back ? 2.05 : 1.7;
    P(g, CYL(6), mat(0x5d4037), [0, signY / 2, -0.5], [0.05, signY, 0.05]);
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 200;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const board = P(g, PLANE(), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [0, signY, -0.48], [1.5, 0.94, 1], [-0.28, 0, 0], false);
    P(g, BOX(), mat(0x5d4037), [0, signY, -0.52], [1.6, 1.04, 0.05], [-0.28, 0, 0]);
    // the display item, spinning slowly on the table
    const spin = new THREE.Group();
    spin.position.set(0, TABLE_Y, 0.08);
    g.add(spin);
    spin.add(displayFor(s.kind, s.key, def));
    // a tarp covers items that aren't unlocked yet
    const tarp = P(g, HEMI(), mat(0x8d7b5e, { flat: true }), [0, TABLE_Y, 0.08], [0.6, 0.55, 0.5]);
    P(tarp, SPH(6, 4), mat(0x5d4037), [0, 1.0, 0], [0.1, 0.12, 0.1]);
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.scene.add(g);
    return {
      id: n, ...s, item, sec, group: g, spin, tarp, board, canvas: cv, tex, key: '',
      pos: new THREE.Vector3(g.position.x, 0, g.position.z), phase: Math.random() * 6,
    };
  }

  buildGrounds() {
    const sc = this.scene;
    const z0 = cellX(MARKET.j0) - CELL / 2, z1 = cellX(MARKET.j1) + CELL / 2;
    // cobblestone floor
    const floorTex = cobbleTexture();
    floorTex.repeat.set(13, 2.6);
    const floor = P(sc, PLANE(), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }), [0, 0.02, (z0 + z1) / 2], [53, z1 - z0 + 0.4, 1], [-Math.PI / 2, 0, 0], false);
    floor.receiveShadow = true;
    // back fence with section banners above the back-row stalls
    const fz = z0 - 0.3;
    for (let x = -26; x <= 26.01; x += 2) P(sc, BOX(), mat(0x8d6e4b), [x, 0.9, fz], [0.18, 1.8, 0.18]);
    P(sc, BOX(), mat(0xb08850), [0, 0.6, fz], [52.2, 0.16, 0.1], [0, 0, 0], false);
    P(sc, BOX(), mat(0xb08850), [0, 1.4, fz], [52.2, 0.16, 0.1], [0, 0, 0], false);
    for (const [sec, a, b] of [['seeds', 2, 8], ['supplies', 9, 11], ['garden', 16, 26]]) {
      const x = (cellX(a) + cellX(b)) / 2, w = Math.min(5, (b - a + 1) * 2 - 0.6);
      P(sc, CYL(6), mat(0x5d4037), [x - w / 2 + 0.2, 1.8, fz], [0.07, 3.6, 0.07]);
      P(sc, CYL(6), mat(0x5d4037), [x + w / 2 - 0.2, 1.8, fz], [0.07, 3.6, 0.07]);
      P(sc, PLANE(), new THREE.MeshBasicMaterial({ map: makeTextTexture(SECTIONS[sec].name, '#fff', SECTIONS[sec].css), toneMapped: false }), [x, 3.25, fz + 0.1], [w, w * 112 / 512, 1], [0, 0, 0], false);
    }
    // bunting along the back fence
    const flagGeo = new THREE.ConeGeometry(0.22, 0.42, 3);
    flagGeo.rotateX(Math.PI);
    const cols = [0xe53935, 0xffd54f, 0x43a047, 0x1e88e5, 0xffffff];
    for (let x = -25.5, k = 0; x <= 25.5; x += 0.9, k++) {
      const m = new THREE.Mesh(flagGeo, mat(cols[k % cols.length]));
      m.position.set(x, 2.55 - Math.abs(Math.sin(x * 0.35)) * 0.25, fz + 0.05);
      m.scale.z = 0.15;
      sc.add(m);
    }
    this.buildKiosk();
  }

  // The Trading Post: a small kiosk at the front center of the market. Sell anything here.
  buildKiosk() {
    const k = MARKET.kiosk;
    const x0 = cellX(k.i0) - CELL / 2, x1 = cellX(k.i1) + CELL / 2, z0 = cellX(k.j0) - CELL / 2, z1 = cellX(k.j1) + CELL / 2;
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const w = x1 - x0 - 0.2, d = z1 - z0 - 0.2;
    P(g, BOX(), mat(0xf3e5c8), [0, 1.3, -0.5], [w, 2.6, d - 1]);
    P(g, BOX(), mat(0x8d6e4b), [0, 0.55, d / 2 - 0.4], [w, 1.1, 0.7]); // counter
    P(g, BOX(), mat(0xa1887f), [0, 1.15, d / 2 - 0.4], [w + 0.2, 0.1, 0.9]);
    const roof = P(g, CONE(4), mat(0xc0564a, { flat: true }), [0, 3.4, 0], [1, 1.4, 1], [0, Math.PI / 4, 0]);
    roof.scale.set(w * 0.78, 1.4, d * 0.78);
    for (let i = 0; i < 5; i++) P(g, BOX(), mat(i % 2 ? 0xffffff : 0x43a047), [-w / 2 + (i + 0.5) * (w / 5), 2.55, d / 2 - 0.1], [w / 5, 0.1, 1.0], [0.4, 0, 0]);
    for (const sx of [-1, 1]) P(g, BOX(), mat(0x5d4037), [sx * (w / 2 - 0.1), 1.3, d / 2 - 0.05], [0.12, 2.6, 0.12]);
    // coin jar (raccoons are after this)
    P(g, CYL(12), mat(0xe0f7fa, { transparent: true, opacity: 0.45, roughness: 0.05 }), [0.95, 1.6, d / 2 - 0.4], [0.3, 0.7, 0.3]);
    P(g, CYL(12), glow(0xffd54f, 0.4), [0.95, 1.45, d / 2 - 0.4], [0.26, 0.4, 0.26]);
    // scale
    P(g, CYL(10), mat(0x9aa3ab, { metalness: 0.6, roughness: 0.4 }), [-0.9, 1.25, d / 2 - 0.4], [0.35, 0.06, 0.35]);
    P(g, CYL(6), mat(0x9aa3ab, { metalness: 0.6, roughness: 0.4 }), [-0.9, 1.45, d / 2 - 0.4], [0.05, 0.4, 0.05]);
    P(g, BOX(), mat(0x3e2723), [0, 3.0, d / 2 + 0.25], [3.4, 0.8, 0.12], [-0.25, 0, 0]);
    P(g, PLANE(), new THREE.MeshBasicMaterial({ map: makeTextTexture('QUICK SELL', '#ffe082', '#3e2723'), toneMapped: false }), [0, 3.0, d / 2 + 0.32], [3.2, 0.7, 1], [-0.25, 0, 0], false);
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.scene.add(g);
  }

  // ───────────── Per-frame ─────────────
  update(dt) {
    this.t += dt;
    for (const st of this.stalls) {
      st.spin.rotation.y += dt * 0.7;
      st.spin.position.y = TABLE_Y + Math.sin(this.t * 2 + st.phase) * 0.04;
    }
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = 0.2;
    for (const st of this.stalls) {
      const b = this.board(st);
      if (b.key === st.key) continue;
      st.key = b.key;
      drawBoard(st, b);
      st.tex.needsUpdate = true;
      st.tarp.visible = !!b.lock;
      st.spin.visible = !b.lock && !b.sold;
    }
  }

  // What the shared price board shows (the same for everyone).
  board(st) {
    const it = st.item;
    if (G.phase === 'night' && G.state !== 'title') return { key: 'night', main: 'CLOSED', col: '#ff8a80', sub: 'Back at dawn' };
    if (G.day < it.unlock) return { key: 'lock' + it.unlock, main: `Day ${it.unlock}`, col: '#bdbdbd', lock: true, sub: '🔒 Coming soon' };
    if (it.kind === 'upgrade' && G.upgrades.has(it.key)) return { key: 'sold', main: 'SOLD', col: '#9ccc65', sold: true, sub: '✔ Yours' };
    if (it.requires && !G.upgrades.has(it.requires)) return { key: 'req', main: `$${it.cost}`, col: '#bdbdbd', lock: true, sub: `Needs ${UPGRADES[it.requires].icon} first` };
    const afford = G.money >= it.cost;
    const hot = it.kind === 'seed' && G.hotItem === it.key;
    return { key: `${it.cost}|${afford}|${hot}`, main: `$${it.cost}`, col: afford ? '#ffe082' : '#ff8a65', hot };
  }

  // ───────────── Interaction ─────────────
  // The stall right in front of a gnome (if any).
  stallNear(p) {
    const f = p.front(1.0);
    let best = null, bd = 1.55;
    for (const st of this.stalls) {
      const d = dist2(st.pos, f);
      if (d < bd && dist2(st.pos, p.pos) < 2.6) { bd = d; best = st; }
    }
    return best;
  }

  // Can player p buy this stall's item right now?
  status(p, st) {
    const it = st.item;
    if (G.phase === 'night') return { ok: false, reason: '🌙 Market closed until dawn' };
    if (G.day < it.unlock) return { ok: false, reason: `🔒 Arrives on day ${it.unlock}` };
    if (it.kind === 'tool' && p.tools.includes(it.key)) return { ok: false, reason: '✔ You own this', owned: true };
    if (it.kind === 'upgrade' && G.upgrades.has(it.key)) return { ok: false, reason: '✔ Already bought', owned: true };
    if (it.requires && !G.upgrades.has(it.requires)) return { ok: false, reason: `🔒 Needs ${UPGRADES[it.requires].name} first` };
    if (G.money < it.cost) return { ok: false, reason: `Need $${it.cost - Math.floor(G.money)} more` };
    if (['seed', 'kit', 'supply'].includes(it.kind) && !p.canTake(carryKind(it))) {
      return { ok: false, reason: p.carry && p.carry.kind !== carryKind(it) ? 'Hands full: sell or drop first' : `Bag full (${p.load}/${p.capacity})` };
    }
    return { ok: true };
  }

  // What X sells back at this stall for player p, or null.
  sellOption(p, st) {
    if (G.phase === 'night') return null;
    const it = st.item, c = p.carry;
    if (c && buysBack(it).includes(c.kind)) {
      const price = p.sellPrice();
      return { label: `Sell ${itemInfo(c.kind).name} ×${c.count} +$${price}`, run: () => p.sell(st.pos) };
    }
    if (it.kind === 'tool' && p.tools.includes(it.key)) {
      const price = halfPrice(it.cost);
      return { label: `Sell your ${it.name} +$${price}`, run: () => this.sellTool(p, st, price) };
    }
    return null;
  }

  sellTool(p, st, price) {
    const i = p.tools.indexOf(st.item.key);
    if (i < 0) return;
    p.tools.splice(i, 1);
    p.toolIdx = Math.min(p.toolIdx, p.tools.length - 1);
    G.money += price;
    G.stats.moneyEarned += price;
    p.stats.earned += price;
    p.stats.sold++;
    G.fx.text({ x: st.pos.x, y: 2, z: st.pos.z }, `+$${price}`, '#ffd54f', 20);
    sfx('coin');
  }

  buy(p, st) {
    const it = st.item;
    const s = this.status(p, st);
    if (!s.ok) { sfx('error'); G.fx.text(p.pos, s.reason, '#ffab91', 14); return; }
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
    G.fx.text({ x: st.pos.x, y: 2, z: st.pos.z }, `-$${it.cost}`, '#ffcc80', 18);
    G.fx.burst({ x: st.pos.x, y: 1.4, z: st.pos.z }, st.sec.hex, 10, { speed: 3 });
    sfx('buy');
  }

  // Detail card floating over the stall a gnome is browsing.
  cardHTML(p, st) {
    const g = glyphsFor(p.device);
    const it = st.item;
    const s = this.status(p, st);
    const b = this.board(st);
    const sell = this.sellOption(p, st);
    const price = s.owned ? '✔' : `$${it.cost}`;
    const lines = [];
    if (s.ok) lines.push(`<div class="sa">${g.a} Buy${it.kind === 'tool' || it.kind === 'upgrade' ? '' : ' one'}</div>`);
    else lines.push(`<div class="sa no">${s.reason}</div>`);
    if (sell) lines.push(`<div class="sa sell">${g.x} ${sell.label}</div>`);
    else if (it.kind === 'seed' && G.phase !== 'night') lines.push(`<div class="sa hint">Bring ${PLANTS[it.key].icon} ${PLANTS[it.key].name} here to sell${b.hot ? ' · 🔥 HOT ×2 today' : ''}</div>`);
    return `<div class="stall" style="--sc:${st.sec.css}">
      <div class="sh"><span class="si">${it.icon}</span><b>${it.name}</b><span class="sp ${s.ok ? '' : 'no'}">${price}</span></div>
      <div class="sd">${it.desc}</div>${lines.join('')}</div>`;
  }
}


// ───────────── Display models ─────────────
function displayFor(kind, key, def) {
  const holder = new THREE.Group();
  let obj, size = 0.8;
  switch (kind) {
    case 'seed': {
      obj = makePlantModel(key, 4).group;
      size = 0.95;
      const pk = makeItem('seed:' + key);
      pk.scale.setScalar(1.3);
      pk.position.set(0.45, 0, 0.25);
      holder.add(pk);
      break;
    }
    case 'tool': obj = makeTool(key); size = 1.0; break;
    case 'kit': obj = makePlaceable(key).group; size = 1.0; break;
    case 'supply': obj = makeItem(key); size = 0.6; break;
    case 'upgrade': {
      // a golden pedestal with the upgrade's emblem floating above it
      P(holder, CYL(12), mat(0xe6a817, { metalness: 0.6, roughness: 0.35 }), [0, 0.1, 0], [0.38, 0.2, 0.38]);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(def.icon), toneMapped: false }));
      sp.position.y = 0.65;
      sp.scale.setScalar(0.85);
      holder.add(sp);
      return holder;
    }
  }
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  const k = size / Math.max(s.x, s.y, s.z, 0.01);
  obj.scale.multiplyScalar(k);
  obj.position.y -= box.min.y * k;
  obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  holder.add(obj);
  return holder;
}

function emojiTex(icon) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.font = '96px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(icon, 64, 72);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const secTexCache = {};
function sectionTex(sec) {
  if (secTexCache[sec]) return secTexCache[sec];
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 52;
  const x = cv.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.92)';
  x.font = 'bold 34px "Trebuchet MS", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(SECTIONS[sec].name, 128, 28);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return (secTexCache[sec] = t);
}

function roundRect(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}

// Chalkboard price sign: icon + price big, name small, status line at the bottom.
function drawBoard(st, b) {
  const x = st.canvas.getContext('2d');
  const W = 320, H = 200;
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#2b3d2f';
  roundRect(x, 0, 0, W, H, 18); x.fill();
  x.strokeStyle = st.sec.css; x.lineWidth = 8;
  roundRect(x, 4, 4, W - 8, H - 8, 15); x.stroke();
  const dim = b.lock || b.key === 'night';
  x.globalAlpha = dim ? 0.45 : 1;
  x.textBaseline = 'middle';
  x.textAlign = 'center';
  x.font = '64px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  x.fillText(st.item.icon, 62, 84);
  x.globalAlpha = 1;
  x.fillStyle = b.col;
  x.font = `bold ${b.main.length > 5 ? 50 : 64}px "Trebuchet MS", sans-serif`;
  x.fillText(b.main, 205, 84);
  x.fillStyle = '#fff';
  let fs = 28;
  x.font = `bold ${fs}px "Trebuchet MS", sans-serif`;
  while (x.measureText(st.item.name).width > W - 30 && fs > 16) { fs -= 2; x.font = `bold ${fs}px "Trebuchet MS", sans-serif`; }
  x.fillText(st.item.name, W / 2, 148);
  const sub = b.hot ? '🔥 HOT ×2 today' : b.sub;
  if (sub) {
    x.fillStyle = b.hot ? '#ffab40' : '#cfd8dc';
    x.font = 'bold 20px "Trebuchet MS", sans-serif';
    x.fillText(sub, W / 2, 180);
  }
}

function cobbleTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#8f8576';
  x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const ox = c * 32 + (r % 2) * 16, oy = r * 32;
      const v = 165 + Math.floor(Math.random() * 30);
      x.fillStyle = `rgb(${v},${v - 10},${v - 28})`;
      for (const dx of [0, -128]) { roundRect(x, ox + dx + 2, oy + 2, 28, 28, 8); x.fill(); }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
