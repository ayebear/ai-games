import * as THREE from 'three';
import {
  PLANTS, PLACEABLES, TOOLS, BAGS, BASE_CAP, PLAYER_COLORS, COUNTER, SPIGOT, POND, HOSE_LEN, CAN_CAP, SPRAY_CAP, SOIL, HALF, HEART_R,
  MULCH_HEAL, itemInfo, isSellable, isLoot, sellEach, itemWeight, toolBase,
} from './config.js';
import { invIconHTML } from './icons.js';
import { G, clamp, dist2, rand, activePlayers } from './state.js';
import { makeGnome, makeTool, makeItem, CYL, BOX, RING, mat, P } from './models.js';
import { sfx } from './audio.js';
import { spawnPickup, removePickup } from './world.js';
import { Plant } from './plants.js';
import { Placeable, canPlaceOn } from './placeables.js';

const SPAWNS = [[-2, -13], [2, -13], [-2, -10], [2, -10]];
const HANDS = () => ({ kind: 'hands', count: 1, value: 0 });
const isTool = (kind) => kind.startsWith('tool:');
const UP = new THREE.Vector3(0, 1, 0);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Player {
  constructor(idx, device) {
    this.idx = idx;
    this.device = device;
    this.active = true;
    this.color = PLAYER_COLORS[idx];
    this.model = makeGnome(this.color);
    G.scene.add(this.model.group);
    this.pos = new THREE.Vector3(SPAWNS[idx][0], 0, SPAWNS[idx][1]);
    this.facing = 0;
    // The inventory: one list of stacks { kind, count, value }. Hands are always first, then tools
    // and items in the order you got them. `sel` is the one in your hands (LB / RB to switch).
    this.inv = [HANDS()];
    this.sel = 0;
    this.bag = null; // worn bag (BAGS key), null = just pockets
    this.can = 0; this.spray = 0;
    this.swingT = 0; this.cool = 0; this.holdT = 0; this.holdTarget = null; this.holdMax = 1;
    this.stall = null; this.sellAct = null; this.stun = 0; this.kv = new THREE.Vector3(); this.leaveT = 0; this.t = 0;
    this.stats = { harvests: 0, kills: 0, water: 0, weeds: 0, earned: 0, spent: 0, tilled: 0, planted: 0, bought: {}, sold: 0 };
    this.equipped = null; this.ctx = null; this.use = null; this.xLabel = ''; this.streaming = false; this.pouring = false;
    this.msgT = 0;
    this.hose = new THREE.Mesh(CYL(6), mat(0x2e7d32));
    this.hose.visible = false;
    G.scene.add(this.hose);
    // Ground reticle showing exactly what A / X will act on: a square for cells, a ring for things.
    const rm = mat(this.color, { emissive: this.color, emissiveIntensity: 1.2, transparent: true, opacity: 0.9, depthWrite: false });
    this.retSq = new THREE.Group();
    for (const [x, z, sx, sz] of [[0, -0.92, 1.9, 0.1], [0, 0.92, 1.9, 0.1], [-0.92, 0, 0.1, 1.9], [0.92, 0, 0.1, 1.9]]) P(this.retSq, BOX(), rm, [x, 0, z], [sx, 0.04, sz], [0, 0, 0], false);
    this.retRing = new THREE.Mesh(RING(), mat(this.color, { emissive: this.color, emissiveIntensity: 1.2, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
    this.retRing.rotation.x = -Math.PI / 2;
    // shop items: a ring around the item's base with a $ badge on its right side, colored by what
    // you can do there (see SHOP_TARGET)
    this.retShop = new THREE.Group();
    this.shopRingMat = new THREE.MeshBasicMaterial({ color: SHOP_TARGET.buy.color, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    const shopRing = new THREE.Mesh(RING(), this.shopRingMat);
    shopRing.rotation.x = -Math.PI / 2;
    shopRing.scale.setScalar(1.05);
    this.shopBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: dollarTex('buy'), transparent: true, depthWrite: false, toneMapped: false }));
    this.shopBadge.rotation.x = -Math.PI / 2;
    this.shopBadge.position.set(1.12, 0.02, 0.45); // right side, toward the camera: not hidden by a gnome standing in front
    this.retShop.add(shopRing, this.shopBadge);
    G.scene.add(this.retSq, this.retRing, this.retShop);
    this.retSq.visible = this.retRing.visible = this.retShop.visible = false;
  }

  // Ground marker for what A / X will act on: a square for a whole cell (plots, placing, tilling),
  // a ring for round things (plants, weeds, gadgets, pickups; ctx.r sets its size), and a ring with
  // a $ for shop items.
  updateReticle() {
    let at = null, shape = 'ring', r = 0.85;
    if (this.active && G.state === 'playing') {
      if (this.ctx && this.ctx.at) { at = this.ctx.at; shape = this.ctx.stall ? 'shop' : this.ctx.sq ? 'sq' : 'ring'; r = this.ctx.r ?? r; }
      else if (this.use && this.use.at) { at = this.use.at; shape = this.use.sq ? 'sq' : 'ring'; }
      else {
        const t = this.tool;
        if (t === 'shovel') {
          const tc = this.targetCell();
          if (tc && tc.weed) { at = tc.weed.mesh.position; r = 0.5; }
          else if (tc && (tc.type === 'grass' || tc.type === 'plot')) { at = tc; shape = 'sq'; }
        } else if (t === 'can' || t === 'spray' || t === 'swatter' || t === 'hose') at = this.plantInFront();
      }
    }
    this.retSq.visible = !!at && shape === 'sq';
    this.retRing.visible = !!at && shape === 'ring';
    this.retShop.visible = !!at && shape === 'shop';
    if (!at) return;
    const pos = at.pos ?? at;
    if (at.kind === 'plant') r = 0.8; else if (shape === 'ring' && !at.kind && this.ctx?.r == null) r = Math.min(r, 0.55);
    const pulse = 1 + Math.sin(this.t * 6) * 0.06;
    if (shape === 'sq') { this.retSq.position.set(pos.x, 0.17, pos.z); this.retSq.scale.setScalar(pulse); }
    else if (shape === 'shop') {
      // green = A buys it, gold = X sells yours back here, grey = neither right now
      const mode = this.sellAct ? 'sell' : G.market.status(this, this.ctx.stall).ok ? 'buy' : 'none';
      if (this.shopMode !== mode) {
        this.shopMode = mode;
        this.shopRingMat.color.setHex(SHOP_TARGET[mode].color);
        this.shopBadge.material.map = dollarTex(mode);
      }
      this.retShop.position.set(pos.x, 0.06, pos.z);
      this.retShop.scale.setScalar(pulse);
    }
    else { this.retRing.position.set(pos.x, 0.18, pos.z); this.retRing.scale.setScalar(r * pulse); }
  }

  get dir() { return { x: Math.sin(this.facing), z: Math.cos(this.facing) }; }
  front(d = 1.3) { return { x: this.pos.x + Math.sin(this.facing) * d, z: this.pos.z + Math.cos(this.facing) * d }; }
  // Bag capacity (in weight units): pockets, or the bag this gnome wears. Tools count too.
  get capacity() { return this.bag ? BAGS[this.bag].cap : BASE_CAP; }
  get load() { return this.inv.reduce((n, s) => n + s.count * itemWeight(s.kind), 0); }
  get loadRatio() { return this.load / this.capacity; }
  // A heavy bag slows you down (up to -30% when full), except a wheelbarrow.
  get loadSlow() { return this.bag && BAGS[this.bag].noSlow ? 0 : 0.3 * Math.pow(Math.min(1, this.loadRatio), 1.5); }
  // The stack in your hands, and if it's a tool, its key (e.g. 'steelshovel') and what it works as
  // (e.g. 'shovel'). Anything that isn't a tool (or Hands) works as 'item'.
  get held() { return this.inv[this.sel] ?? this.inv[0]; }
  get toolKey() { const k = this.held.kind; return k === 'hands' ? 'hands' : isTool(k) ? k.slice(5) : null; }
  get tool() { const k = this.toolKey; return k ? toolBase(k) : 'item'; }
  get toolKeys() { return this.inv.filter((s) => isTool(s.kind)).map((s) => s.kind.slice(5)); }
  hasTool(key) { return this.inv.some((s) => s.kind === 'tool:' + key); }
  get canCap() { return CAN_CAP * (this.hasTool('goldcan') ? 2 : 1); }

  say(text, color = '#fff') {
    if (this.msgT > 0) return;
    this.msgT = 1.2;
    G.fx.text(this.pos, text, color, 14);
  }

  // ── Inventory ──
  stack(kind) { return this.inv.find((s) => s.kind === kind); }
  // The tool you have of the same kind (e.g. your Shovel when looking at a Steel Shovel).
  toolLike(key) { return this.inv.find((s) => isTool(s.kind) && toolBase(s.kind.slice(5)) === toolBase(key)); }
  roomFor(kind) { return Math.max(0, Math.floor((this.capacity - this.load) / itemWeight(kind))); }
  // A tool fits if there's room for it once the one it replaces is gone.
  toolFits(key) {
    const old = this.toolLike(key);
    return this.capacity - this.load + (old ? itemWeight(old.kind) : 0) >= itemWeight('tool:' + key);
  }
  canTake(kind) { return isTool(kind) ? this.toolFits(kind.slice(5)) : this.roomFor(kind) > 0; }
  // Add items (not tools) to your stack of that kind, or a new stack at the end. A new stack goes
  // into your hands if they were empty (or `select`, e.g. when you buy it). Returns how many didn't fit.
  give(kind, count = 1, value = 0, select = false) {
    const n = Math.min(this.roomFor(kind), count);
    if (n <= 0) return count;
    let s = this.stack(kind);
    if (!s) {
      s = { kind, count: 0, value: 0 };
      this.inv.push(s);
      if (select || this.held.kind === 'hands') this.sel = this.inv.length - 1;
    }
    s.count += n;
    s.value += (count ? value / count : 0) * n;
    return count - n;
  }
  // Take n from a stack (the one in your hands by default).
  take(s = this.held, n = 1) {
    if (!s || s.kind === 'hands') return null;
    const per = s.value / s.count;
    s.count -= n;
    s.value -= per * n;
    if (s.count <= 0) this.removeStack(s);
    return { kind: s.kind, value: per * n };
  }
  // Remove a stack. If it was in your hands, the next one in the list takes its place.
  removeStack(s) {
    const i = this.inv.indexOf(s);
    if (i <= 0) return;
    this.inv.splice(i, 1);
    if (this.sel > i) this.sel--;
    this.sel = Math.min(this.sel, this.inv.length - 1);
  }
  // Add a tool and put it in your hands. A tool of the same kind is replaced in place; returns its key.
  addTool(key) {
    const st = { kind: 'tool:' + key, count: 1, value: 0 };
    const old = this.toolLike(key);
    if (old) { const i = this.inv.indexOf(old); this.inv[i] = st; this.sel = i; }
    else { this.inv.push(st); this.sel = this.inv.length - 1; }
    return old ? old.kind.slice(5) : null;
  }
  removeTool(key) {
    const s = this.stack('tool:' + key);
    if (!s) return false;
    this.removeStack(s);
    return true;
  }
  // B: drop whatever is in your hands (the whole stack, or the tool, so a friend can take it).
  dropHeld() {
    const s = this.held;
    if (s.kind === 'hands') return;
    const f = this.front(0.8);
    spawnPickup(s.kind, s.count, f.x, f.z, s.value);
    this.removeStack(s);
    if (isTool(s.kind)) G.fx.text(this.pos, `Dropped ${TOOLS[s.kind.slice(5)].name}`, '#fff', 14);
    sfx('pickup');
  }
  // Pick up a dropped tool. If you already have one of its kind, yours is left in its place.
  pickUpTool(pk, t) {
    removePickup(pk);
    const old = this.addTool(t);
    if (old) spawnPickup('tool:' + old, 1, pk.pos.x, pk.pos.z, 0, false);
    if (toolBase(t) === 'can') this.can = 0;
    if (t === 'spray') this.spray = 0;
    sfx('pickup');
  }

  knock(vx, vz, stun = 0) {
    this.kv.x += vx * 0.15; this.kv.z += vz * 0.15;
    if (stun > 0 && this.stun <= 0) { this.stun = stun; sfx('hurt'); G.fx.text(this.pos, 'Oof!', '#fff', 15); }
  }

  leave() {
    this.retSq.visible = this.retRing.visible = this.retShop.visible = false;
    this.stall = null; this.sellAct = null;
    this.active = false;
    this.model.group.visible = false;
    this.hose.visible = false;
  }
  rejoin(device) {
    this.device = device;
    this.active = true;
    this.model.group.visible = true;
    this.pos.set(SPAWNS[this.idx][0], 0, SPAWNS[this.idx][1]);
    this.kv.set(0, 0, 0);
    this.stun = 0;
  }
  resetForNewGame() {
    this.inv = [HANDS()]; this.sel = 0; this.bag = null; this.can = 0; this.spray = 0; this.stall = null; this.sellAct = null;
    this.stats = { harvests: 0, kills: 0, water: 0, weeds: 0, earned: 0, spent: 0, tilled: 0, planted: 0, bought: {}, sold: 0 };
    this.pos.set(SPAWNS[this.idx][0], 0, SPAWNS[this.idx][1]);
    this.facing = 0;
  }

  // ── Main update ──
  update(dt, inp) {
    this.t += dt;
    this.cool -= dt; this.swingT -= dt; this.stun -= dt; this.msgT -= dt;
    // machine gun cools off over time; once overheated it must cool well down before firing again
    this.heat = Math.max(0, (this.heat || 0) - dt * 0.45);
    if (this.overheat && this.heat < 0.3) this.overheat = false;
    this.streaming = false; this.pouring = false;

    let mx = inp.mx, mz = inp.mz;
    if (this.stun > 0) { mx = 0; mz = 0; }
    const slow = this.tool === 'hose' && inp.held.x ? 0.6 : 1;
    const speed = 6.5 * slow * (1 - this.loadSlow);
    this.kv.multiplyScalar(Math.exp(-8 * dt));
    this.tryMove((mx * speed + this.kv.x) * dt, (mz * speed + this.kv.z) * dt);
    const mag = Math.hypot(mx, mz);
    if (Math.hypot(inp.ax, inp.az) > 0.3) this.turnTo(Math.atan2(inp.ax, inp.az), dt, 20);
    else if (mag > 0.15) this.turnTo(Math.atan2(mx, mz), dt, 14);

    if (inp.pressed.lb) this.cycle(-1);
    if (inp.pressed.rb) this.cycle(1);

    // A: context action (some are hold-to-complete)
    const c = (this.ctx = this.computeContext());
    if (c && c.off) {
      this.holdT = 0; this.holdTarget = null;
      if (inp.pressed.a) sfx('error');
    } else if (c && c.hold) {
      if (inp.held.a) {
        if (this.holdTarget !== c.id) { this.holdTarget = c.id; this.holdT = 0; }
        this.holdT += dt;
        this.holdMax = c.hold;
        if (this.holdT >= c.hold) { c.run(); this.holdT = 0; this.holdTarget = null; }
      } else { this.holdT = 0; this.holdTarget = null; }
    } else {
      this.holdT = 0; this.holdTarget = null;
      if (c && inp.pressed.a) c.run();
    }
    if (inp.pressed.b) this.dropHeld();
    if (inp.pressed.y && this.tool === 'item') this.throwOne();

    this.useTool(dt, inp);
    this.collectCoins(dt);
    this.animate(dt, mag);
  }

  turnTo(a, dt, rate) { this.facing += angDiff(a, this.facing) * Math.min(1, dt * rate); }

  tryMove(dx, dz) {
    const w = G.world;
    const free = !w.walkable(this.pos.x, this.pos.z, 0.4);
    if (free || w.walkable(this.pos.x + dx, this.pos.z, 0.4)) this.pos.x += dx;
    if (free || w.walkable(this.pos.x, this.pos.z + dz, 0.4)) this.pos.z += dz;
    // slide around round things (Heart, pond, spigot, round gadgets); undo if that hits a wall
    const px = this.pos.x, pz = this.pos.z;
    w.pushOut(this.pos, 0.4);
    if (!free && !w.walkable(this.pos.x, this.pos.z, 0.4)) { this.pos.x = px; this.pos.z = pz; }
    const lim = HALF - 4.4;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
  }

  cycle(d) {
    if (this.inv.length < 2) return;
    this.sel = (this.sel + d + this.inv.length) % this.inv.length;
    sfx('pickup');
  }

  // ── Targeting ──
  targetCell() { const f = this.front(1.3); return G.world.cellAt(f.x, f.z); }
  // Best plant inside a forgiving cone in front of you (distance + angle score), so you don't
  // have to line up perfectly to water/harvest the plant you're looking at.
  plantInFront() {
    let best = null, bs = Infinity;
    for (const p of G.plants) {
      if (p.dead) continue;
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.3) continue;
      const da = d < 0.5 ? 0 : Math.abs(angDiff(Math.atan2(dx, dz), this.facing));
      if (da > 1.05) continue;
      const s = d + da * 1.6;
      if (s < bs) { bs = s; best = p; }
    }
    return best;
  }
  heartNear() { return Math.hypot(this.pos.x, this.pos.z) < HEART_R + 1.7; }
  nearWater() {
    if (Math.hypot(this.pos.x - POND.x, this.pos.z - POND.z) < POND.r + 2.6) return true;
    return G.placeables.some((p) => p.type === 'barrel' && !p.dead && dist2(p.pos, this.pos) < 2.3);
  }
  nearestPickup() {
    const f = this.front(0.7);
    let best = null, bd = 1.4;
    for (const p of G.pickups) {
      if (p.dead || p.kind === 'coin' || p.noPick > 0) continue;
      const d = Math.min(dist2(p.pos, f), dist2(p.pos, this.pos));
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // A: interact with the world in front of you (buy, sell, pick up, scoop dew, harvest, weed, pack up).
  computeContext() {
    const tc = this.targetCell();
    const own = G.world.cellAt(this.pos.x, this.pos.z);
    // Market stall in front of you: A buys, X sells that item back (see useTool).
    this.sellAct = null;
    this.stall = G.market.stallNear(this);
    if (this.stall) {
      const st = this.stall;
      this.sellAct = G.market.sellOption(this, st);
      return { id: 'stall' + st.id, stall: st, at: st.pos, label: `Buy ${st.item.name}`, run: () => G.market.buy(this, st) };
    }
    // Quick sell: the kiosk in the middle of the market, or a Sell Stand in the garden. It sells all
    // your garden goods (weeds, junk, produce) at once; with none, the shop good in your hands.
    const atCounter = Math.hypot(this.pos.x - COUNTER.x, this.pos.z - COUNTER.z) < 3 && this.dir.z < 0.3;
    const stand = !atCounter && G.placeables.find((p) => p.type === 'sellbox' && !p.dead && dist2(p.pos, this.front(1.0)) < 1.4);
    if (atCounter || stand) {
      const where = stand ? stand.pos : { x: COUNTER.x, z: COUNTER.z - 1.2 };
      const at = stand ? stand.pos : null;
      const loot = this.inv.filter((s) => isLoot(s.kind));
      const h = this.held;
      if (loot.length) {
        return { id: 'sell', at, label: `Sell ${loot.map((s) => invIconHTML(s.kind)).join('')} +$${this.priceOf(loot)}`, run: () => this.sell(loot, where) };
      }
      if (isSellable(h.kind) && !isTool(h.kind)) {
        return { id: 'sellheld', at, label: `Sell ${h.count}×${invIconHTML(h.kind)} +$${this.priceOf([h])}`, run: () => this.sell([h], where) };
      }
      if (atCounter) return { id: 'counter', label: 'Nothing to sell', off: true };
    }
    const weeds = this.stack('weed');
    if (weeds) {
      const bin = G.placeables.find((p) => p.type === 'compost' && !p.dead && dist2(p.pos, this.pos) < 2.6);
      if (bin) return { id: 'compost', at: bin.pos, label: `Compost ${weeds.count}×${invIconHTML('weed')} (${bin.store}/4)`, run: () => { bin.addWeeds(weeds.count); this.removeStack(weeds); sfx('plant'); } };
    }
    const pk = this.nearestPickup();
    if (pk && isTool(pk.kind)) {
      const t = pk.kind.slice(5);
      if (this.hasTool(t)) return { id: 'owned', at: pk.pos, label: 'Already have one', off: true };
      if (!this.toolFits(t)) return { id: 'full', at: pk.pos, label: 'Bag full', off: true };
      const mine = this.toolLike(t);
      if (mine) return { id: 'swaptool', at: pk.pos, label: `Swap for ${TOOLS[t].name}`, run: () => this.pickUpTool(pk, t) };
      return { id: 'picktool', at: pk.pos, label: `Pick up ${TOOLS[t].name}`, run: () => this.pickUpTool(pk, t) };
    }
    if (pk && !this.canTake(pk.kind)) return { id: 'full', at: pk.pos, label: 'Bag full', off: true };
    if (pk) {
      const inf = itemInfo(pk.kind);
      return { id: 'pick', at: pk.pos, label: `Pick up ${inf.name}${pk.count > 1 ? ' ×' + pk.count : ''}`, run: () => this.pickUp(pk) };
    }
    // the pond (and rain barrels) never run out of dew
    if (this.nearWater() && this.roomFor('dew') > 0) {
      const n = this.roomFor('dew');
      return { id: 'scoop', label: `Scoop ${n}×${invIconHTML('dew')}`, run: () => this.scoopDew() };
    }
    const plant = this.plantInFront();
    if (plant && plant.bloomed) {
      if (this.canTake('produce:' + plant.type)) return { id: 'harvest', at: plant, label: `Harvest ${plant.def.name}`, run: () => this.harvest(plant) };
      return { id: 'full', at: plant, label: 'Bag full', off: true };
    }
    const wc = tc && tc.weed ? tc : own && own.weed ? own : null;
    if (wc && !this.canTake('weed')) return { id: 'fullw', at: wc.weed.mesh.position, r: 0.5, label: 'Bag full', off: true };
    if (wc) return { id: `weed${wc.i},${wc.j}`, at: wc.weed.mesh.position, r: 0.5, label: 'Pull weed', hold: 0.5, run: () => this.pullWeed(wc) };
    if (tc && tc.placeable && this.canTake('kit:' + tc.placeable.type)) {
      const pl = tc.placeable;
      // a fence is a straight wall: mark its cell; everything else is round-ish
      const mark = pl.type === 'fence' ? { at: tc, sq: true } : { at: pl.pos, r: Math.max(0.6, typeof pl.def.hit === 'number' ? pl.def.hit + 0.3 : 0.9) };
      return { id: `pack${tc.i},${tc.j}`, ...mark, label: `Pack up ${pl.def.name}`, hold: 1.0, run: () => { pl.destroy(); this.give('kit:' + pl.type); sfx('pickup'); } };
    }
    return null;
  }

  // X with an item (not a tool) in your hands: what it does here. Items with no use get thrown.
  itemUse() {
    const [k, sub] = this.held.kind.split(':');
    const tc = this.targetCell();
    const plot = tc && tc.type === 'plot' ? tc : null;
    const plant = this.plantInFront();
    const no = (label) => ({ label, off: true });
    switch (k) {
      case 'seed':
        if (plot && !plot.plant) return { at: plot, sq: true, label: `Plant ${PLANTS[sub].name}`, run: () => this.plantSeed(plot, sub) };
        return no('Face an empty plot');
      case 'soil':
        if (plot && plot.soil < 3) return { at: plot, sq: true, label: `Add soil → ${SOIL[plot.soil + 1].name}`, run: () => this.addSoil(plot) };
        return no(plot ? 'Best soil already' : 'Face a plot');
      case 'fertilizer':
        if (plant && (plant.stage < 4 || plant.size < plant.def.maxSize)) return { at: plant, label: `Fertilize ${plant.def.name}`, run: () => this.boost(plant, 0.25, 0.15) };
        return no(plant ? 'Fully grown' : 'Face a plant');
      case 'sunjar':
        if (plant) return { at: plant, label: `Sun Jar on ${plant.def.name}`, run: () => this.boost(plant, 0.35, 0.25, true) };
        return no('Face a plant');
      case 'dew':
        if (plant) return { at: plant, label: `Water ${plant.def.name}`, run: () => this.dew(plant) };
        if (this.heartNear()) return { label: 'Water the Heart', run: () => this.dew(G.heart) };
        return no('Face a plant');
      case 'mulch':
        if (!this.heartNear()) return no('Use at the Heart');
        if (G.heart.hp >= G.heart.maxHp) return no('Heart is healthy');
        return { label: `Mulch the Heart +${MULCH_HEAL} HP`, run: () => this.mulch() };
      case 'kit':
        if (canPlaceOn(tc) && !(PLACEABLES[sub].blocks && activePlayers().some((p) => G.world.cellAt(p.pos.x, p.pos.z) === tc))) {
          return { at: tc, sq: true, label: `Place ${PLACEABLES[sub].name}`, run: () => this.place(tc, sub) };
        }
        return no("Can't place here");
    }
    return { label: 'Throw', run: () => this.throwOne() };
  }

  // ── Actions ──
  // What a set of stacks sells for (produce by its size value, ×2 if it's the Hot Item).
  priceOf(stacks) {
    let n = 0;
    for (const s of stacks) {
      if (s.kind.startsWith('produce:')) n += Math.round(s.value * (G.hotItem === s.kind.slice(8) ? 2 : 1));
      else n += sellEach(s.kind) * s.count;
    }
    return n;
  }
  sell(stacks, at = { x: COUNTER.x, z: COUNTER.z - 1.2 }) {
    const price = this.priceOf(stacks);
    G.money += price;
    G.stats.moneyEarned += price;
    this.stats.earned += price;
    for (const s of stacks) { this.stats.sold += s.count; this.removeStack(s); }
    G.fx.text({ x: at.x, y: 1.5, z: at.z }, `+$${price}`, '#ffd54f', 24);
    G.fx.burst({ x: at.x, y: 2, z: at.z }, 0xffd54f, 12, { speed: 4, emissive: true });
    sfx('coin');
  }
  plantSeed(tc, type) {
    const p = new Plant(type, tc);
    G.plants.push(p);
    this.take();
    this.stats.planted++;
    G.stats.planted++;
    G.fx.burst({ x: tc.x, y: 0.2, z: tc.z }, 0x6d4c2f, 8, { speed: 2 });
    sfx('plant');
  }
  addSoil(tc) {
    tc.soil++;
    G.world.refreshPlot(tc);
    this.take();
    G.fx.burst({ x: tc.x, y: 0.3, z: tc.z }, 0x4e342e, 12, { speed: 2.5 });
    G.fx.text(tc, SOIL[tc.soil].name + ' soil!', '#d7ccc8', 15);
    sfx('till');
  }
  boost(p, g, s, sunny = false) {
    if (p.stage < 4) p.growth = Math.min(1, p.growth + g); else p.size = Math.min(p.def.maxSize, p.size + s);
    this.take();
    G.fx.burst({ x: p.pos.x, y: 0.8, z: p.pos.z }, sunny ? 0xffeb3b : 0x26a69a, 16, { speed: 3, emissive: sunny });
    sfx('bloom');
  }
  mulch() {
    G.heart.hp = Math.min(G.heart.maxHp, G.heart.hp + MULCH_HEAL);
    this.take();
    G.fx.burst({ x: 0, y: 1.5, z: 0 }, 0xff6fa8, 24, { speed: 4 });
    G.fx.text({ x: 0, y: 3, z: 0 }, `+${MULCH_HEAL} HP`, '#ff8fc0', 20);
    sfx('bloom');
  }
  // Water a plant or the Heart, and count it (the checklist wants a plant watered by a gnome).
  waterIt(target, amt) {
    target.addWater(amt);
    this.stats.water += amt;
    if (target !== G.heart) G.stats.plantWater += amt;
  }
  dew(target) {
    this.waterIt(target, target === G.heart ? 0.2 : 0.3);
    this.take();
    G.fx.burst({ x: target.pos.x, y: 0.6, z: target.pos.z }, 0x4fc3f7, 10, { speed: 2.5 });
    sfx('splash');
  }
  scoopDew() {
    this.give('dew', this.roomFor('dew'));
    G.fx.burst({ x: this.pos.x, y: 0.5, z: this.pos.z }, 0x4fc3f7, 12, { speed: 3 });
    sfx('splash');
  }
  place(tc, type) {
    const d = this.dir;
    const rot = Math.abs(d.x) > Math.abs(d.z) ? Math.PI / 2 : 0;
    G.placeables.push(new Placeable(type, tc, rot));
    this.take();
    G.fx.burst({ x: tc.x, y: 0.3, z: tc.z }, 0xc8a06a, 10, { speed: 3 });
    sfx('thump');
  }
  pickUp(pk) {
    const left = this.give(pk.kind, pk.count, pk.value);
    if (left <= 0) removePickup(pk);
    else { pk.value = (pk.value / pk.count) * left; pk.count = left; }
    sfx('pickup');
  }
  harvest(p) {
    const res = p.harvest();
    if (!res) return;
    const left = this.give(res.kind, 1, res.value);
    if (left > 0) spawnPickup(res.kind, 1, p.pos.x, p.pos.z, res.value);
    this.stats.harvests++;
    G.fx.text(p.pos, `${p.def.icon} worth $${res.value}${p.size > 1.05 ? ` (×${p.size.toFixed(1)})` : ''}`, '#c5e1a5', 16);
    sfx('harvest');
  }
  pullWeed(c) {
    G.world.removeWeed(c);
    const left = this.give('weed', 1, 0);
    if (left > 0) spawnPickup('weed', 1, c.x, c.z);
    this.stats.weeds++;
    G.stats.weeds++;
    G.fx.burst({ x: c.x, y: 0.3, z: c.z }, 0x7cb342, 8, { speed: 3 });
    sfx('pickup');
  }
  throwOne() {
    const it = this.take();
    if (!it) return;
    const mesh = makeItem(it.kind);
    G.scene.add(mesh);
    const d = this.dir;
    G.projectiles.push({
      kind: 'throw', item: it.kind, value: it.value, owner: this, mesh, life: 4,
      pos: new THREE.Vector3(this.pos.x + d.x * 0.5, 1.2, this.pos.z + d.z * 0.5),
      vel: new THREE.Vector3(d.x * 11, 6, d.z * 11),
    });
    sfx('throw');
  }

  // ── Tools ──
  melee(range, arc, dmg, knock, tool) {
    let any = false;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.def.radius * 0.6) continue;
      if (d > 0.6 && Math.abs(angDiff(Math.atan2(dx, dz), this.facing)) > arc) continue;
      if (!e.canBeHitBy(tool)) continue;
      if (e.airborne && e.y > 3.2) continue;
      let dm = dmg;
      if (tool === 'swatter' && (e.type === 'fly' || e.type === 'moth')) dm = 99;
      if (tool === 'shovel' && e.type === 'mole' && e.state === 'tunnel') { e.state = 'surface'; e.timer = 1.5; }
      const l = d || 1;
      e.hit(dm, this, (dx / l) * knock, (dz / l) * knock);
      any = true;
    }
    return any;
  }

  // cone helper: calls fn(entity, kindTag) for things inside the cone
  cone(range, half, fn) {
    const inCone = (p, r = 0) => {
      const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > range + r) return false;
      return d < 0.8 + r || Math.abs(angDiff(Math.atan2(dx, dz), this.facing)) < half + r / Math.max(d, 1);
    };
    for (const e of G.enemies) if (!e.dead && inCone(e.pos, e.def.radius)) fn(e, 'enemy');
    for (const p of G.plants) if (!p.dead && inCone(p.pos, 0.4)) fn(p, 'plant');
    if (inCone(G.heart.pos, G.heart.radius)) fn(G.heart, 'heart');
  }

  toolPos() {
    const d = this.dir;
    return new THREE.Vector3(this.pos.x + d.x * 0.8 + d.z * 0.35, 1.0, this.pos.z + d.z * 0.8 - d.x * 0.35);
  }

  useTool(dt, inp) {
    const tool = this.tool;
    const pressed = inp.pressed.x, held = inp.held.x;
    const tc = this.targetCell();
    // at a market stall X sells that item back instead of using your tool
    this.use = null;
    if (this.sellAct) {
      this.xLabel = this.sellAct.label;
      this.xOff = false;
      if (pressed) this.sellAct.run();
      this.hose.visible = false;
      return;
    }
    if (tool === 'item') {
      const u = (this.use = this.itemUse());
      this.xLabel = u.label;
      this.xOff = !!u.off;
      if (pressed && this.cool <= 0) {
        if (u.off) sfx('error');
        else { u.run(); this.cool = 0.15; }
      }
      this.hose.visible = false;
      return;
    }
    this.xLabel = this.toolLabel(tc);
    this.xOff = this.toolBlocked();
    switch (tool) {
      case 'hands':
        if (pressed && this.cool <= 0) {
          this.cool = 0.35; this.swingT = 0.25; sfx('swing');
          this.melee(1.4, 1.1, 0.5, 5, 'hands');
        }
        break;
      case 'shovel':
        if (pressed && this.cool <= 0) {
          const sharp = this.toolKey === 'steelshovel';
          this.cool = sharp ? 0.28 : 0.42; this.swingT = 0.3;
          sfx('swing');
          if (!this.melee(1.8, 1.0, sharp ? 4 : 2, 8, 'shovel')) {
            if (tc && tc.weed) this.pullWeed(tc);
            else if (tc && tc.type === 'grass' && !tc.placeable && Math.hypot(tc.x, tc.z) > 3.5) {
              G.world.till(tc);
              this.stats.tilled++;
              G.fx.burst({ x: tc.x, y: 0.2, z: tc.z }, 0x6d4c2f, 12, { speed: 3 });
              sfx('till');
            }
          }
        }
        break;
      case 'can':
        if (pressed && this.nearWater()) {
          this.can = this.canCap;
          G.fx.burst({ x: this.pos.x, y: 0.5, z: this.pos.z }, 0x4fc3f7, 12, { speed: 3 });
          this.say('Filled!', '#81d4fa'); sfx('splash');
        } else if (held && !this.nearWater()) {
          if (this.can <= 0) { if (pressed) sfx('error'); break; }
          this.pouring = true;
          const rate = (this.toolKey === 'goldcan' ? 1.0 : 0.6) * dt;
          const amt = Math.min(this.can, rate);
          this.can -= amt;
          const p = this.plantInFront();
          const target = p || (this.heartNear() ? G.heart : null);
          if (target) this.waterIt(target, amt);
          else if (tc && tc.type === 'plot') tc.wet = Math.min(1, tc.wet + amt);
          const tp = this.toolPos();
          const aim = target ? new THREE.Vector3(target.pos.x - tp.x, -1.2, target.pos.z - tp.z) : new THREE.Vector3(this.dir.x * 0.4, -1, this.dir.z * 0.4);
          G.fx.stream(tp, aim, 0x4fc3f7, { speed: 3.5, life: 0.4 });
          sfx('water', 0.25);
          this.cone(1.8, 0.6, (e, k) => { if (k === 'enemy' && (e.type === 'fly' || e.type === 'moth')) e.hit(3 * dt, this, 0, 0, true); });
        }
        break;
      case 'swatter':
        if (pressed && this.cool <= 0) {
          this.cool = 0.26; this.swingT = 0.22; sfx('swing');
          this.melee(2.0, 1.3, 1, 5, 'swatter');
          const p = this.plantInFront();
          if (p && p.mites > 0) { const r = Math.min(p.mites, 1.5); p.mites -= r; G.stats.mites += r; }
        }
        break;
      case 'spray':
        if (pressed && this.nearWater()) {
          this.spray = SPRAY_CAP;
          this.say('Soap refilled!', '#f8bbd0'); sfx('splash');
        } else if (held && this.cool <= 0) {
          if (this.spray <= 0) { if (pressed) sfx('error'); break; }
          this.cool = 0.14; this.spray--;
          const tp = this.toolPos();
          for (let i = 0; i < 4; i++) G.fx.stream(tp, new THREE.Vector3(this.dir.x, 0, this.dir.z), i % 2 ? 0xf8bbd0 : 0xffffff, { speed: 8, spread: 0.25, life: 0.35, size: 0.09 });
          sfx('water', 0.1);
          this.cone(3.6, 0.55, (e, k) => {
            if (k === 'plant') { const r = Math.min(e.mites, 4); e.mites -= r; G.stats.mites += r; }
            else if (k === 'enemy') {
              const dm = e.type === 'slug' ? 2 : e.type === 'fly' || e.type === 'moth' ? 1 : 0.3;
              if (e.canBeHitBy('spray')) e.hit(dm, this, this.dir.x * 1.5, this.dir.z * 1.5, e.type !== 'slug');
            }
          });
        }
        break;
      case 'slingshot':
        if ((pressed || held) && this.cool <= 0) { this.cool = 0.4; this.shoot('slingshot'); }
        break;
      case 'gun':
        if ((pressed || held) && this.cool <= 0) { this.cool = 0.55; this.shoot('gun'); }
        break;
      case 'mgun':
        if (held && !this.overheat && this.cool <= 0) {
          this.cool = 0.085;
          this.heat += 0.075;
          this.shoot('mgun');
          if (this.heat >= 1) { this.overheat = true; this.say('Overheated!', '#ff7043'); sfx('error'); }
        }
        break;
      case 'hose':
        this.hose.visible = true;
        if (held) {
          const dS = Math.hypot(this.pos.x - SPIGOT.x, this.pos.z - SPIGOT.z);
          if (dS > HOSE_LEN) { if (pressed) sfx('error'); break; }
          this.streaming = true;
          const tp = this.toolPos();
          for (let i = 0; i < 3; i++) G.fx.stream(tp, new THREE.Vector3(this.dir.x, 0.15, this.dir.z), 0x4fc3f7, { speed: 12, spread: 0.1, life: 0.45 });
          sfx('water', 0.2);
          const soap = this.toolKey === 'soaphose';
          this.cone(6.5, 0.38, (e, k) => {
            if (k === 'plant' || k === 'heart') { this.waterIt(e, 0.9 * dt); if (soap && k === 'plant' && e.mites > 0) { const r = Math.min(e.mites, 8 * dt); e.mites -= r; G.stats.mites += r; } }
            else if (e.canBeHitBy('hose')) {
              let dm = 0.6 * dt;
              if (e.type === 'fly' || e.type === 'moth') dm = 4 * dt;
              if (soap && e.type === 'slug') dm = 3 * dt;
              e.hit(dm, this, this.dir.x * 35 * dt, this.dir.z * 35 * dt, true);
            }
          });
        }
        break;
    }
    if (tool !== 'hose') this.hose.visible = false;
    if (this.hose.visible) this.updateHoseMesh();
  }

  toolLabel(tc) {
    switch (this.tool) {
      case 'hands': return 'Punch';
      case 'shovel': return tc && tc.weed ? 'Dig weed' : tc && tc.type === 'grass' && !tc.placeable && Math.hypot(tc.x, tc.z) > 3.5 ? 'Till plot' : 'Bonk';
      case 'can': return this.nearWater() ? 'Fill can' : this.can > 0 ? 'Hold: water' : 'Can empty';
      case 'swatter': return 'Swat';
      case 'spray': return this.nearWater() ? 'Refill soap' : this.spray > 0 ? 'Hold: spray' : 'Sprayer empty';
      case 'slingshot': return 'Fling pebble';
      case 'gun': return 'Fire spud';
      case 'mgun': return this.overheat ? 'Overheated' : 'Hold: fire';
      case 'hose': return this.hoseTooFar() ? 'Hose too short' : 'Hold: hose';
    }
    return '';
  }

  // X does nothing right now (shown greyed out).
  toolBlocked() {
    switch (this.tool) {
      case 'can': return !this.nearWater() && this.can <= 0;
      case 'spray': return !this.nearWater() && this.spray <= 0;
      case 'mgun': return !!this.overheat;
      case 'hose': return this.hoseTooFar();
    }
    return false;
  }
  hoseTooFar() { return Math.hypot(this.pos.x - SPIGOT.x, this.pos.z - SPIGOT.z) > HOSE_LEN; }

  shoot(kind = 'gun') {
    const hot = this.toolKey === 'hotgun';
    const W = {
      slingshot: { dmg: 3, speed: 24, life: 0.75, size: 0.35, color: 0x9e9e9e, assist: 0.5, recoil: 1, spread: 0, sound: 'sling', pierce: false },
      gun: { dmg: hot ? 10 : 6, speed: 30, life: 0.85, size: 0.7, color: hot ? 0xff7043 : 0xc49a5a, assist: 0.35, recoil: 6, spread: 0, sound: 'shoot', pierce: hot },
      mgun: { dmg: 1.6, speed: 42, life: 0.55, size: 0.28, color: 0xffd54f, assist: 0.25, recoil: 1.2, spread: 0.08, sound: 'mgun', pierce: false },
    }[kind];
    // light aim assist toward the nearest enemy in a narrow cone
    let a = this.facing, best = W.assist;
    for (const e of G.enemies) {
      if (e.dead || !e.canBeHitBy('gun') || (e.airborne && e.y > 3)) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      if (Math.hypot(dx, dz) > 24) continue;
      const diff = Math.abs(angDiff(Math.atan2(dx, dz), this.facing));
      if (diff < best) { best = diff; a = Math.atan2(dx, dz); }
    }
    a += (Math.random() - 0.5) * 2 * W.spread;
    const mesh = makeItem('produce:tomato');
    mesh.children.forEach((c) => c.material = kind === 'mgun' ? mat(W.color, { emissive: 0xffa000, emissiveIntensity: 1.5 }) : mat(W.color));
    mesh.scale.setScalar(W.size);
    G.scene.add(mesh);
    const tp = this.toolPos();
    G.projectiles.push({
      kind: 'spud', owner: this, mesh, life: W.life, dmg: W.dmg, pierce: W.pierce, hits: new Set(), color: W.color,
      pos: new THREE.Vector3(tp.x, 1.0, tp.z), vel: new THREE.Vector3(Math.sin(a) * W.speed, 0, Math.cos(a) * W.speed),
    });
    this.kv.x -= Math.sin(a) * W.recoil; this.kv.z -= Math.cos(a) * W.recoil;
    if (kind !== 'mgun') this.swingT = 0.12;
    G.fx.burst(tp, kind === 'mgun' ? 0xffcc80 : 0xeeeeee, kind === 'mgun' ? 2 : 5, { speed: 2, grav: 0, emissive: kind === 'mgun' });
    sfx(W.sound, kind === 'mgun' ? 0.07 : 0.04);
  }

  updateHoseMesh() {
    const a = new THREE.Vector3(SPIGOT.x, 0.1, SPIGOT.z), b = new THREE.Vector3(this.pos.x, 0.1, this.pos.z);
    const d = b.clone().sub(a);
    const L = Math.min(d.length(), HOSE_LEN);
    if (L < 0.01) return;
    this.hose.position.copy(a).addScaledVector(d.normalize(), L / 2);
    this.hose.scale.set(0.06, L, 0.06);
    this.hose.quaternion.setFromUnitVectors(UP, d);
  }

  collectCoins(dt) {
    for (const p of G.pickups) {
      if (p.dead || p.kind !== 'coin' || p.noPick > 0) continue;
      const d = dist2(p.pos, this.pos);
      if (d < 3.2) {
        const k = Math.min(1, dt * 8);
        p.pos.x += (this.pos.x - p.pos.x) * k;
        p.pos.z += (this.pos.z - p.pos.z) * k;
      }
      if (d < 0.9) {
        G.money += p.value;
        G.stats.moneyEarned += p.value;
        this.stats.earned += p.value;
        G.fx.text(this.pos, `+$${Math.round(p.value)}`, '#ffd54f', 16);
        removePickup(p);
        sfx('coin');
      }
    }
  }

  // ── Visuals ──
  animate(dt, mag) {
    const m = this.model;
    m.group.position.copy(this.pos);
    m.group.rotation.y = this.facing;
    m.group.rotation.z = this.stun > 0 ? Math.sin(this.t * 25) * 0.15 : 0;
    const w = Math.sin(this.t * 13) * 0.6 * Math.min(1, mag);
    m.legL.rotation.x = w; m.legR.rotation.x = -w;
    m.group.position.y = Math.abs(Math.sin(this.t * 13)) * 0.06 * Math.min(1, mag);
    // what's in your hands: a tool in the right hand, or an item held out in front with both
    const kind = this.held.kind;
    const item = this.tool === 'item';
    if (this.equipped !== kind) {
      this.equipped = kind;
      m.tool.clear();
      m.carry.clear();
      if (isTool(kind)) {
        const t = makeTool(this.toolKey);
        t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        m.tool.add(t);
      } else if (item) {
        const it = makeItem(kind);
        it.scale.setScalar(1.3);
        it.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        m.carry.add(it);
      }
    }
    // right arm: swing / aim / rest
    let ra;
    if (this.swingT > 0) {
      const p = 1 - this.swingT / 0.3;
      ra = -2.6 + Math.min(1, p * 1.4) * 3.0;
    } else if (this.streaming || this.pouring || this.tool === 'gun' || this.tool === 'mgun' || this.tool === 'slingshot' || this.tool === 'spray') ra = -1.35;
    else if (item) ra = -1.1;
    else ra = -0.4 - w * 0.3;
    m.armR.rotation.x += (ra - m.armR.rotation.x) * Math.min(1, dt * (this.swingT > 0 ? 40 : 12));
    m.armL.rotation.x += ((item ? -1.1 : w * 0.3) - m.armL.rotation.x) * Math.min(1, dt * 10);
    m.lantern.visible = G.night > 0.2 && !item;
    m.carry.position.y = 0.72 + Math.sin(this.t * 4) * 0.03;
    m.ring.material.emissiveIntensity = 0.4 + Math.sin(this.t * 4) * 0.2;
    this.updateReticle();
  }
}

// Shop target colors: what A / X do at the item you're standing at. The card's Buy / Sell lines
// use the same colors (style.css .stall .sa).
const SHOP_TARGET = {
  buy: { color: 0x43d36b, css: '#43d36b', text: '$' },
  sell: { color: 0xffb300, css: '#ffb300', text: '+$' },
  none: { color: 0x9e9e9e, css: '#9e9e9e', text: '$' },
};
// The shop target's badge: a disc in the mode's color with a white $ (or +$ when selling).
const dollarTexs = new Map();
function dollarTex(mode) {
  if (dollarTexs.has(mode)) return dollarTexs.get(mode);
  const T = SHOP_TARGET[mode];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = T.css;
  x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 8; x.strokeStyle = '#fff'; x.stroke();
  x.font = `bold ${T.text.length > 1 ? 66 : 84}px "Trebuchet MS", sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#fff';
  x.fillText(T.text, 64, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  dollarTexs.set(mode, t);
  return t;
}
