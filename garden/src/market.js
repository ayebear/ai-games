// The walk-in market: one big flower (see SHOPS / STALLS in config.js). The Quick Sell kiosk is the
// center, each shop is a petal, and every item floats in the air with a price tag (icon + price)
// above it. Nothing blocks: stand at an item to browse it, A buys, X sells that item back. Items
// that haven't arrived yet are shown faded out. Each petal has one floating sign with its name.
import * as THREE from 'three';
import {
  TOOLS, BAGS, DEFS, SPRAY_CAP, STALLS, SHOPS, MARKET, FLOWER, CELL, HALF, toolBase,
} from './config.js';
import { G, dist2 } from './state.js';
import { P, mat, glow, BOX, CYL, PLANE, makeTool, makeItem, makePlaceable, makePlantModel, makeBag } from './models.js';
import { glyphsFor } from './input.js';
import { drawIcon, iconHTML, invIconHTML, stallIconId } from './icons.js';
import { sfx } from './audio.js';

const SHOP = Object.fromEntries(SHOPS.map((s) => [s.id, s]));
const cellX = (i) => i * CELL - HALF + CELL / 2;
const halfPrice = (n) => Math.max(1, Math.floor(n / 2));
// The inventory kind a purchase gives you.
const carryKind = (it) => (it.kind === 'seed' ? 'seed:' + it.key : it.kind === 'kit' ? 'kit:' + it.key : it.key);
// Carried kinds a stall buys back: a seed stall also buys that plant's produce.
const buysBack = (it) => (it.kind === 'seed' ? ['produce:' + it.key, 'seed:' + it.key] : it.kind === 'kit' || it.kind === 'supply' ? [carryKind(it)] : []);

const ITEM_Y = 0.22; // items hover just above the floor, right inside their target ring
const ITEM_SCALE = 1.5;
const TAG_Y = 2.3; // price tag
const TAG_PX = { w: 300, h: 112 };
const LOCKED_ALPHA = 0.2; // items that haven't arrived yet
const SIGN_PX = { w: 640, h: 128 };
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
    const s = p.toolLike(it.key);
    if (!s) return null;
    const key = s.kind.slice(5);
    return { key, def: TOOLS[key], better: key === it.key || !!TOOLS[key].base };
  }
  if (it.kind === 'bag' && p.bag) return { key: p.bag, def: BAGS[p.bag], better: BAGS[p.bag].cap >= it.def.cap };
  return null;
}

export class Market {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.refreshT = 0;
    this.stalls = STALLS.map((s, n) => this.buildPad(s, n));
    this.signs = SHOPS.map((shop) => this.buildSign(shop));
    this.buildGrounds();
  }

  // ───────────── Building ─────────────
  // One item floating in the air, spinning slowly, with a price tag over it and a soft spot of the
  // shop's color on the floor under it.
  buildPad(s, n) {
    const shop = SHOP[s.shop];
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    const shadowMat = new THREE.MeshBasicMaterial({ color: shop.color, transparent: true, opacity: 0.3, depthWrite: false });
    P(g, CYL(20), shadowMat, [0, 0.04, 0], [0.85, 0.01, 0.85], [0, 0, 0], false);
    const spin = new THREE.Group();
    spin.position.y = ITEM_Y;
    const model = displayFor(s.kind, s.key);
    model.scale.setScalar(ITEM_SCALE);
    // own copies of the materials, so a not-yet-arrived item can fade out on its own
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData.baseOpacity = o.material.opacity;
      mats.push(o.material);
    });
    spin.add(model);
    g.add(spin);
    // price tag
    const cv = document.createElement('canvas');
    cv.width = TAG_PX.w; cv.height = TAG_PX.h;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthWrite: false }));
    tag.position.y = TAG_Y;
    tag.scale.set(1.7, 1.7 * (TAG_PX.h / TAG_PX.w), 1);
    g.add(tag);
    this.scene.add(g);
    return {
      id: n, ...s, item: stallItem(s), shopDef: shop, group: g, spin, tag, canvas: cv, tex, mats, shadowMat, tagKey: '', faded: null,
      pos: new THREE.Vector3(s.x, 0, s.z), phase: Math.random() * 6,
    };
  }

  // A floating sign past the petal's tip with the shop's name (and CLOSED / ★ NEW).
  buildSign(shop) {
    const cv = document.createElement('canvas');
    cv.width = SIGN_PX.w; cv.height = SIGN_PX.h;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthWrite: false }));
    sp.position.set(shop.sign.x, 3.1, shop.sign.z);
    sp.scale.set(3.6, 3.6 * (SIGN_PX.h / SIGN_PX.w), 1);
    this.scene.add(sp);
    const sign = { shop, sprite: sp, canvas: cv, tex, key: '', stalls: this.stalls.filter((st) => st.shop === shop.id) };
    drawSign(sign, false, 0);
    return sign;
  }

  buildGrounds() {
    const sc = this.scene;
    const z0 = cellX(MARKET.j0) - CELL / 2, z1 = cellX(MARKET.j1) + CELL / 2;
    // cobblestone floor
    const floorTex = cobbleTexture();
    floorTex.repeat.set(13, 2.6);
    const floor = P(sc, PLANE(), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }), [0, 0.02, (z0 + z1) / 2], [53, z1 - z0 + 0.4, 1], [-Math.PI / 2, 0, 0], false);
    floor.receiveShadow = true;
    // the flower drawn on the floor: a golden center under the kiosk and a petal per shop
    P(sc, CYL(32), new THREE.MeshStandardMaterial({ color: 0xffd54f, transparent: true, opacity: 0.45, roughness: 1 }), [FLOWER.x, 0.035, FLOWER.z], [2.3, 0.01, 2.3], [0, 0, 0], false);
    for (const shop of SHOPS) {
      const pt = shop.patch;
      P(sc, CYL(32), new THREE.MeshStandardMaterial({ color: shop.color, transparent: true, opacity: 0.3, roughness: 1 }), [pt.x, 0.03, pt.z], [pt.len / 2, 0.01, 1.85], [0, pt.angle, 0], false);
    }
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
    // a one-cell-deep booth (so the aisle behind it stays open): back wall, counter, striped awning
    P(g, BOX(), mat(0xf3e5c8), [0, 1.3, -d / 2 + 0.2], [w, 2.6, 0.4]);
    P(g, BOX(), mat(0x8d6e4b), [0, 0.55, d / 2 - 0.4], [w, 1.1, 0.7]); // counter
    P(g, BOX(), mat(0xa1887f), [0, 1.15, d / 2 - 0.4], [w + 0.2, 0.1, 0.9]);
    for (let i = 0; i < 5; i++) P(g, BOX(), mat(i % 2 ? 0xffffff : 0xffb300), [-w / 2 + (i + 0.5) * (w / 5), 2.62, 0.05], [w / 5, 0.1, d + 0.1], [0.32, 0, 0]);
    for (const sx of [-1, 1]) P(g, BOX(), mat(0x5d4037), [sx * (w / 2 - 0.1), 1.2, d / 2 - 0.05], [0.12, 2.4, 0.12]);
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
    P(g, BOX(), mat(0x3e2723), [0, 3.45, -d / 2 + 0.3], [3.5, 1.08, 0.1], [-0.25, 0, 0]);
    P(g, PLANE(), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [0, 3.45, -d / 2 + 0.36], [3.4, 1.0, 1], [-0.25, 0, 0], false);
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.scene.add(g);
  }

  // ───────────── Per-frame ─────────────
  update(dt) {
    this.t += dt;
    for (const st of this.stalls) {
      st.spin.rotation.y += dt * 0.7;
      st.spin.position.y = ITEM_Y + Math.sin(this.t * 1.6 + st.phase) * 0.06;
    }
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = 0.2;
    const closed = this.closed();
    for (const sign of this.signs) drawSign(sign, closed, sign.stalls.filter((st) => this.isNew(st)).length);
    for (const st of this.stalls) {
      const b = this.board(st);
      // not here yet: shown, but faded right out (and so is its tag)
      if (st.faded !== !!b.locked) {
        st.faded = !!b.locked;
        for (const m of st.mats) {
          m.transparent = st.faded || m.userData.baseOpacity < 1;
          m.opacity = (m.userData.baseOpacity ?? 1) * (st.faded ? LOCKED_ALPHA : 1);
          m.depthWrite = !st.faded;
          m.needsUpdate = true;
        }
        st.tag.material.opacity = st.faded ? LOCKED_ALPHA : 1;
        st.shadowMat.opacity = st.faded ? 0.08 : 0.3;
      }
      if (b.key === st.tagKey) continue;
      st.tagKey = b.key;
      drawTag(st, b);
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
    if (G.day < it.unlock) return { key: 'lock' + it.unlock, locked: true, price: `$${it.cost}`, col: '#e0e0e0' };
    const closed = this.closed();
    const afford = G.money >= it.cost;
    const hot = it.kind === 'seed' && G.hotItem === it.key;
    const fresh = this.isNew(st);
    return { key: `${it.key}|${it.cost}|${afford}|${hot}|${closed}|${fresh}`, price: `$${it.cost}`, col: afford ? '#ffe082' : '#ff8a65', hot, fresh, dim: closed };
  }

  // ───────────── Interaction ─────────────
  // The item a gnome is standing at or facing (if any).
  stallNear(p) {
    const f = p.front(0.6);
    let best = null, bd = 1.35;
    for (const st of this.stalls) {
      const d = dist2(st.pos, f);
      if (d < bd) { bd = d; best = st; }
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
    if (['seed', 'kit', 'supply'].includes(it.kind) && !p.canTake(carryKind(it))) return { ok: false, reason: 'Bag full' };
    if (it.kind === 'tool' && !p.toolFits(it.key)) return { ok: false, reason: 'Bag full' };
    return { ok: true };
  }

  // What X sells back at this stall for player p, or null.
  sellOption(p, st) {
    if (this.closed()) return null;
    const it = st.item;
    // the matching stack in your hands, or else any matching stack in your bag
    const kinds = buysBack(it);
    const c = kinds.includes(p.held.kind) ? p.held : kinds.map((k) => p.stack(k)).find(Boolean);
    if (c) return { label: `Sell ${c.count}×${invIconHTML(c.kind)} +$${p.priceOf([c])}`, run: () => p.sell([c], st.pos) };
    if ((it.kind === 'tool' && p.hasTool(it.key)) || (it.kind === 'bag' && p.bag === it.key)) {
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
    // a better tool or bag trades in the one you have (it takes the old one's place), half price back
    const old = ownedLike(p, it);
    if (old) this.pay(p, halfPrice(old.def.cost), { x: st.pos.x, z: st.pos.z + 0.8 });
    switch (it.kind) {
      case 'seed': case 'kit': case 'supply':
        p.give(carryKind(it), 1, 0, true);
        break;
      case 'tool':
        p.addTool(it.key);
        if (toolBase(it.key) === 'can') p.can = p.canCap;
        if (it.key === 'spray') p.spray = SPRAY_CAP;
        break;
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

// Take a tool or bag off a gnome. Returns false if they don't have it.
function removeGear(p, kind, key) {
  if (kind === 'bag') {
    if (p.bag !== key) return false;
    p.bag = null;
    return true;
  }
  return p.removeTool(key);
}

function roundRect(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}

// A shop's floating sign: its icon and name on its color. At night it says CLOSED.
function drawSign(sign, closed, fresh) {
  const key = `${closed}|${fresh}`;
  if (sign.key === key) return;
  sign.key = key;
  const { shop, canvas: cv } = sign;
  const x = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  x.clearRect(0, 0, W, H);
  x.fillStyle = closed ? '#455a64' : shop.css;
  roundRect(x, 4, 4, W - 8, H - 8, 40); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 6;
  roundRect(x, 4, 4, W - 8, H - 8, 40); x.stroke();
  x.textBaseline = 'middle';
  x.textAlign = 'center';
  const label = `${shop.icon} ${shop.name.toUpperCase()}${closed ? ' · CLOSED' : fresh ? `  ★${fresh}` : ''}`;
  let fs = 64;
  x.font = `bold ${fs}px ${FONT}`;
  while (x.measureText(label).width > W - 50 && fs > 20) { fs -= 2; x.font = `bold ${fs}px ${FONT}`; }
  x.fillStyle = '#1b1b1b';
  x.fillText(label, W / 2 + 3, H / 2 + 5);
  x.fillStyle = '#fff';
  x.fillText(label, W / 2, H / 2 + 2);
  sign.tex.needsUpdate = true;
}

// An item's price tag: its icon and price, with ★ NEW / 🔥 ×2 badges.
function drawTag(st, b) {
  const x = st.canvas.getContext('2d');
  const W = TAG_PX.w, H = TAG_PX.h;
  x.clearRect(0, 0, W, H);
  x.globalAlpha = b.dim ? 0.6 : 1;
  x.fillStyle = 'rgba(22,32,24,0.88)';
  roundRect(x, 8, 22, W - 16, H - 30, 30); x.fill();
  x.strokeStyle = st.shopDef.css; x.lineWidth = 5;
  roundRect(x, 8, 22, W - 16, H - 30, 30); x.stroke();
  x.textBaseline = 'middle';
  x.textAlign = 'left';
  x.font = `bold ${b.price.length > 4 ? 46 : 54}px ${FONT}`;
  const tw = x.measureText(b.price).width, iw = 62, gap = 10;
  const x0 = (W - (iw + gap + tw)) / 2;
  drawIcon(x, st.item.icon, x0 + iw / 2, 63, iw);
  x.fillStyle = b.col;
  x.fillText(b.price, x0 + iw + gap, 66);
  x.globalAlpha = 1;
  const badge = b.fresh && !b.dim ? ['★ NEW', '#ffd600', '#3e2723'] : b.hot && !b.dim ? ['🔥 ×2', '#ff6d00', '#fff'] : null;
  if (badge) {
    x.textAlign = 'center';
    x.font = `bold 24px ${FONT}`;
    const w = x.measureText(badge[0]).width + 22;
    x.fillStyle = badge[1];
    roundRect(x, W - w - 4, 2, w, 34, 14); x.fill();
    x.fillStyle = badge[2];
    x.fillText(badge[0], W - w / 2 - 4, 20);
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
