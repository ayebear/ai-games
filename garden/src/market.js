// The walk-in market. Items are grouped into shops by category (see SHOPS in config.js). Every
// shop is a row of stalls under one menu board: a colored header with the shop's name, and one
// panel per item with its icon, price and name. Walk up to a stall: A buys, X sells that item back.
// The Quick Sell kiosk in the middle buys anything.
import * as THREE from 'three';
import {
  TOOLS, BAGS, DEFS, SPRAY_CAP, STALLS, SHOPS, MARKET, CELL, HALF, toolBase,
} from './config.js';
import { G, dist2 } from './state.js';
import { P, mat, glow, BOX, CYL, CONE, PLANE, makeTool, makeItem, makePlaceable, makePlantModel, makeBag } from './models.js';
import { glyphsFor } from './input.js';
import { drawIcon, iconHTML, stallIconId } from './icons.js';
import { sfx } from './audio.js';

const SHOP = Object.fromEntries(SHOPS.map((s) => [s.id, s]));
const cellX = (i) => i * CELL - HALF + CELL / 2;
const halfPrice = (n) => Math.max(1, Math.floor(n / 2));
// The carried-item kind a purchase gives you.
const carryKind = (it) => (it.kind === 'seed' ? 'seed:' + it.key : it.kind === 'kit' ? 'kit:' + it.key : it.key);
// Carried kinds a stall buys back: a seed stall also buys that plant's produce.
const buysBack = (it) => (it.kind === 'seed' ? ['produce:' + it.key, 'seed:' + it.key] : it.kind === 'kit' || it.kind === 'supply' ? [carryKind(it)] : []);

const TABLE_Y = 0.9;
// Menu board geometry (per stall panel, and the shop header above the panels).
// Tilted well back toward the camera and kept low, so gnomes in the aisle behind stay visible.
const BOARD = { y: 1.5, z: -0.62, w: 1.98, h: 1.04, tilt: -0.72 };
const HEADER_H = 0.46;
const PANEL_PX = { w: 300, h: 158 };
const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

// What a stall sells.
function stallItem(s) {
  const def = DEFS[s.kind][s.key];
  return {
    kind: s.kind, key: s.key, def, cost: def.cost, unlock: def.unlock ?? 1, desc: def.desc,
    icon: stallIconId(s.kind, s.key),
    name: def.name, // on the board
    fullName: s.kind === 'seed' ? `${def.name} Seeds` : def.name, // on the card and receipts
  };
}

// The tool or bag a gnome already has in this item's slot (same tool base, or any bag), or null.
// `better`: what they have is this item or a better version, so there's nothing to buy.
function ownedLike(p, it) {
  if (it.kind === 'tool') {
    const slot = p.tools.findIndex((t) => toolBase(t) === toolBase(it.key));
    if (slot < 0) return null;
    const key = p.tools[slot];
    return { key, slot, def: TOOLS[key], better: key === it.key || !!TOOLS[key].base };
  }
  if (it.kind === 'bag' && p.bag) return { key: p.bag, def: BAGS[p.bag], better: BAGS[p.bag].cap >= it.def.cap };
  return null;
}

export class Market {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.refreshT = 0;
    this.stalls = STALLS.map((s, n) => this.buildStall(s, n));
    this.headers = SHOPS.map((shop) => this.buildShopFrame(shop));
    for (const st of this.stalls) this.headers.find((h) => h.shop === st.shopDef).stalls.push(st);
    this.buildGrounds();
  }

  // ───────────── Building ─────────────
  buildStall(s, n) {
    const shop = SHOP[s.shop];
    const g = new THREE.Group();
    g.position.set(cellX(s.i), 0, cellX(s.j));
    // table: wooden crate with a cloth in the shop's color
    P(g, BOX(), mat(0x9a6a3a), [0, 0.4, 0.05], [1.6, 0.8, 1.1]);
    P(g, BOX(), mat(shop.color), [0, 0.84, 0.05], [1.72, 0.08, 1.24]);
    P(g, BOX(), mat(shop.color), [0, 0.66, 0.68], [1.72, 0.3, 0.04]);
    // this item's panel on the shop's menu board
    const cv = document.createElement('canvas');
    cv.width = PANEL_PX.w; cv.height = PANEL_PX.h;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const boardMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
    P(g, PLANE(), boardMat, [0, BOARD.y, BOARD.z], [BOARD.w, BOARD.h, 1], [BOARD.tilt, 0, 0], false);
    // "NEW" tag that floats above the board until a gnome has looked at the item
    const top = BOARD.h / 2 + HEADER_H;
    const newTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: newTagTex(), toneMapped: false, depthTest: false }));
    newTag.position.set(0, BOARD.y + top * Math.cos(BOARD.tilt) + 0.45, BOARD.z + top * Math.sin(BOARD.tilt));
    newTag.userData.y0 = newTag.position.y;
    newTag.scale.set(1.0, 0.42, 1);
    newTag.renderOrder = 5;
    newTag.visible = false;
    g.add(newTag);
    // the display item, spinning slowly on the table
    const spin = new THREE.Group();
    spin.position.set(0, TABLE_Y, 0.12);
    g.add(spin);
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.scene.add(g);
    const st = {
      id: n, ...s, item: stallItem(s), shopDef: shop, group: g, spin, canvas: cv, tex, boardMat, newTag, boardKey: '',
      pos: new THREE.Vector3(g.position.x, 0, g.position.z), phase: Math.random() * 6,
    };
    spin.add(displayFor(s.kind, s.key));
    return st;
  }

  // Posts and the shop-name header that sit on top of the shop's row of panels.
  buildShopFrame(shop) {
    const n = shop.items.length;
    const x0 = cellX(shop.at) - CELL / 2, x1 = cellX(shop.at + n - 1) + CELL / 2;
    const z = cellX(shop.row);
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, 0, z);
    const w = x1 - x0 - 0.04;
    const cos = Math.cos(BOARD.tilt), sin = Math.sin(BOARD.tilt);
    // the header sits right above the panels, on the same tilted plane
    const up = BOARD.h / 2 + HEADER_H / 2;
    const hy = BOARD.y + up * cos, hz = BOARD.z + up * sin;
    const top = BOARD.h / 2 + HEADER_H;
    // wooden frame behind the whole board (shifted up along the board by half the header and
    // back along its normal), and two posts
    const fh = BOARD.h + HEADER_H + 0.12, fc = HEADER_H / 2, back = 0.04;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85, transparent: true });
    P(g, BOX(), wood, [0, BOARD.y + fc * cos + back * sin, BOARD.z + fc * sin - back * cos], [w + 0.14, fh, 0.05], [BOARD.tilt, 0, 0]);
    for (const sx of [-1, 1]) P(g, CYL(6), wood, [sx * (w / 2 + 0.02), (BOARD.y + top * cos) / 2, BOARD.z + top * sin], [0.07, BOARD.y + top * cos, 0.07]);
    const cv = document.createElement('canvas');
    cv.width = Math.round(PANEL_PX.w * n * (w / (n * BOARD.w)));
    cv.height = Math.round(PANEL_PX.w * (HEADER_H / BOARD.w));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const headMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
    P(g, PLANE(), headMat, [0, hy, hz], [w, HEADER_H, 1], [BOARD.tilt, 0, 0], false);
    this.scene.add(g);
    const h = { shop, canvas: cv, tex, key: '', mats: [wood, headMat], x0, x1, z, fade: 1, stalls: [] };
    drawHeader(h, false, 0);
    return h;
  }

  buildGrounds() {
    const sc = this.scene;
    const z0 = cellX(MARKET.j0) - CELL / 2, z1 = cellX(MARKET.j1) + CELL / 2;
    // cobblestone floor
    const floorTex = cobbleTexture();
    floorTex.repeat.set(13, 2.6);
    const floor = P(sc, PLANE(), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }), [0, 0.02, (z0 + z1) / 2], [53, z1 - z0 + 0.4, 1], [-Math.PI / 2, 0, 0], false);
    floor.receiveShadow = true;
    // plain back fence
    const fz = z0 - 0.3;
    for (let x = -26; x <= 26.01; x += 2) P(sc, BOX(), mat(0x8d6e4b), [x, 0.7, fz], [0.16, 1.4, 0.16]);
    P(sc, BOX(), mat(0xb08850), [0, 0.5, fz], [52.2, 0.14, 0.1], [0, 0, 0], false);
    P(sc, BOX(), mat(0xb08850), [0, 1.1, fz], [52.2, 0.14, 0.1], [0, 0, 0], false);
    this.buildKiosk();
  }

  // The Quick Sell kiosk: front center of the market, sells anything, holds the coin jar.
  buildKiosk() {
    const k = MARKET.kiosk;
    const x0 = cellX(k.i0) - CELL / 2, x1 = cellX(k.i1) + CELL / 2, z0 = cellX(k.j0) - CELL / 2, z1 = cellX(k.j1) + CELL / 2;
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const w = x1 - x0 - 0.2, d = z1 - z0 - 0.2;
    P(g, BOX(), mat(0xf3e5c8), [0, 1.3, -0.5], [w, 2.6, d - 1]);
    P(g, BOX(), mat(0x8d6e4b), [0, 0.55, d / 2 - 0.4], [w, 1.1, 0.7]); // counter
    P(g, BOX(), mat(0xa1887f), [0, 1.15, d / 2 - 0.4], [w + 0.2, 0.1, 0.9]);
    const roof = P(g, CONE(4), mat(0xffb300, { flat: true }), [0, 3.4, 0], [1, 1.4, 1], [0, Math.PI / 4, 0]);
    roof.scale.set(w * 0.78, 1.4, d * 0.78);
    for (let i = 0; i < 5; i++) P(g, BOX(), mat(i % 2 ? 0xffffff : 0xffb300), [-w / 2 + (i + 0.5) * (w / 5), 2.55, d / 2 - 0.1], [w / 5, 0.1, 1.0], [0.4, 0, 0]);
    for (const sx of [-1, 1]) P(g, BOX(), mat(0x5d4037), [sx * (w / 2 - 0.1), 1.3, d / 2 - 0.05], [0.12, 2.6, 0.12]);
    // coin jar (raccoons are after this)
    P(g, CYL(12), mat(0xe0f7fa, { transparent: true, opacity: 0.45, roughness: 0.05 }), [0.95, 1.6, d / 2 - 0.4], [0.3, 0.7, 0.3]);
    P(g, CYL(12), glow(0xffd54f, 0.4), [0.95, 1.45, d / 2 - 0.4], [0.26, 0.4, 0.26]);
    G.jar.pos = { x: g.position.x + 0.95, z: g.position.z + d / 2 - 0.4 };
    // scale
    P(g, CYL(10), mat(0x9aa3ab, { metalness: 0.6, roughness: 0.4 }), [-0.9, 1.25, d / 2 - 0.4], [0.35, 0.06, 0.35]);
    P(g, CYL(6), mat(0x9aa3ab, { metalness: 0.6, roughness: 0.4 }), [-0.9, 1.45, d / 2 - 0.4], [0.05, 0.4, 0.05]);
    // sign: same look as the shop headers
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 150;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffb300'; roundRect(x, 0, 0, 512, 150, 18); x.fill();
    x.fillStyle = '#3e2723'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `bold 64px ${FONT}`; x.fillText('💰 QUICK SELL', 256, 58);
    x.font = `bold 30px ${FONT}`; x.fillText('Sell anything here', 256, 118);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    P(g, BOX(), mat(0x3e2723), [0, 3.0, d / 2 + 0.25], [3.5, 1.08, 0.1], [-0.25, 0, 0]);
    P(g, PLANE(), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [0, 3.0, d / 2 + 0.31], [3.4, 1.0, 1], [-0.25, 0, 0], false);
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.scene.add(g);
  }

  // ───────────── Per-frame ─────────────
  update(dt) {
    this.t += dt;
    for (const st of this.stalls) {
      st.spin.rotation.y += dt * 0.7;
      st.spin.position.y = TABLE_Y + Math.sin(this.t * 2 + st.phase) * 0.04;
      if (st.newTag.visible) st.newTag.position.y = st.newTag.userData.y0 + Math.sin(this.t * 3 + st.phase) * 0.08;
    }
    // a board fades out while a gnome stands in the aisle right behind it
    const gnomes = G.slots.filter((p) => p && p.active);
    for (const h of this.headers) {
      const behind = gnomes.some((p) => p.pos.x > h.x0 - 0.6 && p.pos.x < h.x1 + 0.6 && p.pos.z < h.z - 0.6 && p.pos.z > h.z - 3.4);
      const want = behind ? 0.28 : 1;
      if (Math.abs(h.fade - want) < 0.01) continue;
      h.fade += (want - h.fade) * Math.min(1, dt * 8);
      for (const m of h.mats) m.opacity = h.fade;
      for (const st of h.stalls) st.boardMat.opacity = h.fade;
    }
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = 0.2;
    const closed = this.closed();
    for (const h of this.headers) drawHeader(h, closed, h.stalls.filter((st) => this.isNew(st)).length);
    for (const st of this.stalls) {
      const b = this.board(st);
      // locked items aren't on display yet: the table stays empty
      st.spin.visible = !b.locked;
      st.newTag.visible = this.isNew(st) && !closed;
      if (b.key === st.boardKey) continue;
      st.boardKey = b.key;
      drawPanel(st, b);
      st.tex.needsUpdate = true;
    }
  }

  closed() { return G.phase === 'night' && G.state !== 'title'; }

  // NEW = unlocked after day 1 and no gnome has browsed it yet (G.seen, reset each game).
  isNew(st) {
    const it = st.item;
    return G.state !== 'title' && it.unlock > 1 && G.day >= it.unlock && !G.seen.has(it.kind + ':' + it.key);
  }

  // What a stall's panel shows (the same for everyone).
  board(st) {
    const it = st.item;
    if (G.day < it.unlock) return { key: 'lock' + it.unlock, locked: true, price: `Day ${it.unlock}`, col: '#9e9e9e' };
    const closed = this.closed();
    const afford = G.money >= it.cost;
    const hot = it.kind === 'seed' && G.hotItem === it.key;
    const fresh = this.isNew(st);
    return { key: `${it.key}|${it.cost}|${afford}|${hot}|${closed}|${fresh}`, price: `$${it.cost}`, col: afford ? '#ffe082' : '#ff8a65', hot, fresh, dim: closed };
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
    if (G.day < it.unlock) return { ok: false, reason: `Arrives day ${it.unlock}` };
    const own = ownedLike(p, it);
    if (own && own.key === it.key) return { ok: false, reason: 'You have this', owned: true };
    if (own && own.better) return { ok: false, reason: `You have ${own.def.name}`, owned: true };
    if (this.closed()) return { ok: false, reason: 'Closed till dawn' };
    if (G.money < it.cost) return { ok: false, reason: `Need $${it.cost - Math.floor(G.money)} more` };
    if (['seed', 'kit', 'supply'].includes(it.kind) && !p.canTake(carryKind(it))) return { ok: false, reason: p.fullWhy(carryKind(it)) };
    return { ok: true };
  }

  // What X sells back at this stall for player p, or null.
  sellOption(p, st) {
    if (this.closed()) return null;
    const it = st.item, c = p.carry;
    if (c && buysBack(it).includes(c.kind)) {
      const price = p.sellPrice();
      return { label: `Sell ×${c.count} +$${price}`, run: () => p.sell(st.pos) };
    }
    if ((it.kind === 'tool' && p.tools.includes(it.key)) || (it.kind === 'bag' && p.bag === it.key)) {
      const price = halfPrice(it.cost);
      return { label: `Sell yours +$${price}`, run: () => this.sellGear(p, st, price) };
    }
    return null;
  }

  // Sell back the tool or bag this stall sells.
  sellGear(p, st, price) {
    if (!removeGear(p, st.item.kind, st.item.key)) return;
    this.pay(p, price, st.pos);
  }

  pay(p, price, pos) {
    G.money += price;
    G.stats.moneyEarned += price;
    p.stats.earned += price;
    p.stats.sold++;
    G.fx.text({ x: pos.x, y: 2, z: pos.z }, `+$${price}`, '#ffd54f', 20);
    sfx('coin');
  }

  buy(p, st) {
    const it = st.item;
    const s = this.status(p, st);
    if (!s.ok) { sfx('error'); return; }
    G.money -= it.cost;
    G.stats.moneySpent += it.cost;
    p.stats.spent += it.cost;
    const rec = (p.stats.bought[it.kind + ':' + it.key] ??= { icon: it.icon, name: it.fullName, n: 0, spent: 0 });
    rec.n++;
    rec.spent += it.cost;
    // a better tool or bag trades in the one you have, half price back
    const old = ownedLike(p, it);
    if (old) {
      removeGear(p, it.kind, old.key, true);
      this.pay(p, halfPrice(old.def.cost), { x: st.pos.x, z: st.pos.z + 0.8 });
    }
    switch (it.kind) {
      case 'seed': case 'kit': case 'supply':
        p.give(carryKind(it));
        break;
      case 'tool': {
        // a trade-in puts the new tool in the old one's slot
        const at = old ? old.slot : p.tools.length;
        p.tools.splice(at, 0, it.key);
        p.toolIdx = at;
        if (toolBase(it.key) === 'can') p.can = p.canCap;
        if (it.key === 'spray') p.spray = SPRAY_CAP;
        break;
      }
      case 'bag':
        p.bag = it.key;
        break;
    }
    G.fx.text({ x: st.pos.x, y: 2, z: st.pos.z }, `-$${it.cost}`, '#ffcc80', 18);
    G.fx.burst({ x: st.pos.x, y: 1.4, z: st.pos.z }, st.shopDef.color, 10, { speed: 3 });
    sfx('buy');
  }

  // Detail card floating over the stall a gnome is browsing. Same layout for every item:
  // header (icon, name, price) · what it does · facts · what A and X do here.
  cardHTML(p, st) {
    const g = glyphsFor(p.device);
    const it = st.item;
    const fresh = this.isNew(st);
    if (G.day >= it.unlock) G.seen.add(it.kind + ':' + it.key); // looked at: no longer new
    const s = this.status(p, st);
    const sell = this.sellOption(p, st);
    const price = s.owned ? '✔' : `$${it.cost}`;
    const facts = [];
    if (it.kind === 'seed') {
      const d = it.def;
      facts.push(`Sells $${d.value}${d.regrow ? ' per harvest' : ''}`);
      if (G.hotItem === it.key) facts.push('🔥 ×2 today');
      if (d.regrow) facts.push('♻️ Regrows');
      facts.push(d.grow < 55 ? 'Fast' : d.grow < 90 ? 'Medium' : 'Slow');
    } else if (it.kind === 'tool' || it.kind === 'bag') {
      facts.push('Each gnome needs one');
      const old = ownedLike(p, it);
      if (old && !old.better) facts.push(`Trade in ${old.def.name} +$${halfPrice(old.def.cost)}`);
    } else if (it.kind === 'kit') facts.push('Place in the garden');
    else if (it.key === 'mulch') facts.push('Use at the Heart Bloom');
    else facts.push('Use on a plant or plot');
    // the A line is always there; greyed out with the reason when you can't buy
    const lines = [s.ok ? `<div class="sa">${g.a} Buy</div>` : `<div class="sa off">${g.a} ${s.reason}</div>`];
    if (sell) lines.push(`<div class="sa sell">${g.x} ${sell.label}</div>`);
    return `<div class="stall" style="--sc:${st.shopDef.css}">
      <div class="sh">${iconHTML(it.icon, 'si')}<b>${it.fullName}${fresh ? ' <i class="new">NEW</i>' : ''}</b><span class="sp ${s.ok || s.owned ? '' : 'no'}">${price}</span></div>
      <div class="sd">${it.desc}</div>
      <div class="sf">${facts.map((f) => `<span>${f}</span>`).join('')}</div>${lines.join('')}</div>`;
  }
}


// ───────────── Display models ─────────────
function displayFor(kind, key) {
  const holder = new THREE.Group();
  let obj, size = 0.8;
  switch (kind) {
    case 'seed': {
      obj = makePlantModel(key, 4).group;
      size = 0.95;
      const pk = makeItem('seed:' + key);
      pk.scale.setScalar(1.3);
      pk.position.set(0.5, 0, 0.25);
      holder.add(pk);
      break;
    }
    case 'tool': {
      const reel = toolBase(key) === 'hose';
      obj = makeTool(key, { reel }); obj.rotation.z = reel ? 0 : -0.5; size = 1.0; break;
    }
    case 'bag': obj = makeBag(key); size = 0.9; break;
    case 'kit': obj = makePlaceable(key).group; size = 1.0; break;
    case 'supply': obj = makeItem(key); size = 0.6; break;
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

// Take a tool or bag off a gnome. Returns false if they don't have it. `keepSlot` leaves the tool
// index alone (a trade-in puts the new tool back in the same slot).
function removeGear(p, kind, key, keepSlot = false) {
  if (kind === 'bag') {
    if (p.bag !== key) return false;
    p.bag = null;
    return true;
  }
  const i = p.tools.indexOf(key);
  if (i < 0) return false;
  p.tools.splice(i, 1);
  if (!keepSlot) p.toolIdx = Math.min(p.toolIdx, p.tools.length - 1);
  return true;
}

function roundRect(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}

// Shop header: the shop's icon and name on its color. At night it says CLOSED.
function drawHeader(h, closed, fresh) {
  const key = `${closed}|${fresh}`;
  if (h.key === key) return;
  h.key = key;
  const { shop, canvas: cv } = h;
  const x = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  x.clearRect(0, 0, W, H);
  x.fillStyle = closed ? '#455a64' : shop.css;
  x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(0,0,0,0.18)';
  x.fillRect(0, H - 6, W, 6);
  x.textBaseline = 'middle';
  x.textAlign = 'center';
  const label = `${shop.icon} ${shop.name.toUpperCase()}${closed ? ' · CLOSED' : fresh ? `  ★ ${fresh} NEW` : ''}`;
  let fs = Math.round(H * 0.62);
  x.font = `bold ${fs}px ${FONT}`;
  while (x.measureText(label).width > W - 24 && fs > 14) { fs -= 2; x.font = `bold ${fs}px ${FONT}`; }
  x.fillStyle = '#1b1b1b';
  x.fillText(label, W / 2 + 2, H / 2 + 2);
  x.fillStyle = '#fff';
  x.fillText(label, W / 2, H / 2);
  h.tex.needsUpdate = true;
}

// One item's panel on the menu board: icon and price on top, name underneath.
function drawPanel(st, b) {
  const x = st.canvas.getContext('2d');
  const W = PANEL_PX.w, H = PANEL_PX.h;
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#26352c';
  x.fillRect(0, 0, W, H);
  // thin dividers between neighboring panels
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.fillRect(0, 0, 3, H); x.fillRect(W - 3, 0, 3, H);
  x.globalAlpha = b.locked ? 0.25 : b.dim ? 0.5 : 1;
  // light disc behind the icon so dark tools read on the dark board
  x.fillStyle = 'rgba(255,255,255,0.16)';
  x.beginPath(); x.arc(72, 64, 54, 0, Math.PI * 2); x.fill();
  drawIcon(x, st.item.icon, 72, 64, 108);
  x.globalAlpha = b.dim ? 0.6 : 1;
  x.textBaseline = 'middle';
  x.textAlign = 'center';
  x.fillStyle = b.col;
  x.font = `bold ${b.price.length > 4 ? 46 : 60}px ${FONT}`;
  x.fillText(b.price, 210, 64);
  x.fillStyle = b.locked ? '#9e9e9e' : '#fff';
  let fs = 30;
  x.font = `bold ${fs}px ${FONT}`;
  while (x.measureText(st.item.name).width > W - 20 && fs > 16) { fs -= 2; x.font = `bold ${fs}px ${FONT}`; }
  x.fillText(st.item.name, W / 2, 136);
  x.globalAlpha = 1;
  if (b.hot && !b.dim) {
    x.fillStyle = '#ff6d00';
    roundRect(x, W - 92, 6, 86, 34, 10); x.fill();
    x.fillStyle = '#fff';
    x.font = `bold 22px ${FONT}`;
    x.fillText('🔥 ×2', W - 49, 24);
  }
}

let newTex = null;
function newTagTex() {
  if (newTex) return newTex;
  const cv = document.createElement('canvas');
  cv.width = 240; cv.height = 100;
  const x = cv.getContext('2d');
  x.fillStyle = '#ffd600';
  roundRect(x, 6, 6, 228, 88, 40); x.fill();
  x.strokeStyle = '#3e2723'; x.lineWidth = 6;
  roundRect(x, 6, 6, 228, 88, 40); x.stroke();
  x.fillStyle = '#3e2723';
  x.font = `bold 58px ${FONT}`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('★ NEW', 120, 54);
  newTex = new THREE.CanvasTexture(cv);
  newTex.colorSpace = THREE.SRGBColorSpace;
  return newTex;
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
      const v = 172 + Math.floor(Math.random() * 14);
      x.fillStyle = `rgb(${v},${v - 10},${v - 28})`;
      for (const dx of [0, -128]) { roundRect(x, ox + dx + 2, oy + 2, 28, 28, 8); x.fill(); }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
