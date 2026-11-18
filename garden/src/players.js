import * as THREE from 'three';
import {
  PLANTS, PLACEABLES, TOOLS, PLAYER_COLORS, COUNTER, SPIGOT, POND, HOSE_LEN, CAN_CAP, SPRAY_CAP, SOIL, HALF, HEART_R,
  itemInfo, isSellable, sellEach, itemWeight,
} from './config.js';
import { G, clamp, dist2, rand, activePlayers } from './state.js';
import { makeGnome, makeTool, makeItem, CYL, BOX, RING, mat, P } from './models.js';
import { sfx } from './audio.js';
import { spawnPickup, removePickup } from './world.js';
import { Plant } from './plants.js';
import { Placeable, canPlaceOn } from './placeables.js';

const SPAWNS = [[-2, -13], [2, -13], [-2, -10], [2, -10]];
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
    this.tools = ['hands'];
    this.toolIdx = 0;
    this.carry = null;
    this.can = 0; this.spray = 0;
    this.swingT = 0; this.cool = 0; this.holdT = 0; this.holdTarget = null; this.holdMax = 1;
    this.stall = null; this.sellAct = null; this.stun = 0; this.kv = new THREE.Vector3(); this.leaveT = 0; this.t = 0;
    this.stats = { harvests: 0, kills: 0, water: 0, weeds: 0, earned: 0, spent: 0, tilled: 0, planted: 0, bought: {}, sold: 0 };
    this.equipped = null; this.carryShown = null; this.ctx = null; this.xLabel = ''; this.streaming = false; this.pouring = false;
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
    G.scene.add(this.retSq, this.retRing);
    this.retSq.visible = this.retRing.visible = false;
  }

  updateReticle() {
    let at = null, sq = false, r = 0.85;
    if (this.active && G.state === 'playing') {
      if (this.ctx && this.ctx.at) { at = this.ctx.at; sq = !!this.ctx.sq; }
      else {
        const t = this.tool;
        if (t === 'shovel') { const tc = this.targetCell(); if (tc && (tc.type === 'grass' || tc.type === 'plot')) { at = tc; sq = true; } }
        else if (t === 'can' || t === 'spray' || t === 'swatter' || t === 'hose') at = this.plantInFront();
      }
    }
    this.retSq.visible = !!at && sq;
    this.retRing.visible = !!at && !sq;
    if (!at) return;
    const pos = at.pos ?? at;
    if (at.kind === 'plant') r = 0.8; else if (!sq && !at.kind) r = 0.55;
    const pulse = 1 + Math.sin(this.t * 6) * 0.06;
    if (sq) { this.retSq.position.set(pos.x, 0.17, pos.z); this.retSq.scale.setScalar(pulse); }
    else { this.retRing.position.set(pos.x, 0.18, pos.z); this.retRing.scale.setScalar(r * pulse); }
  }

  get dir() { return { x: Math.sin(this.facing), z: Math.cos(this.facing) }; }
  front(d = 1.3) { return { x: this.pos.x + Math.sin(this.facing) * d, z: this.pos.z + Math.cos(this.facing) * d }; }
  // Bag capacity (in weight units) grows with the pockets → backpack → wheelbarrow upgrades.
  get capacity() {
    const u = G.upgrades;
    return u.has('wheelbarrow') ? 25 : u.has('backpack') ? 16 : u.has('pockets') ? 10 : 5;
  }
  get load() { return this.carry ? this.carry.count * itemWeight(this.carry.kind) : 0; }
  get loadRatio() { return this.load / this.capacity; }
  // A heavy bag slows you down (up to -30% when full) unless you have a Strong Back.
  get loadSlow() { return G.upgrades.has('strongback') ? 0 : 0.3 * Math.pow(this.loadRatio, 1.5); }
  get tool() { return this.tools[this.toolIdx]; }

  say(text, color = '#fff') {
    if (this.msgT > 0) return;
    this.msgT = 1.2;
    G.fx.text(this.pos, text, color, 14);
  }

  // ── Carry helpers ──
  roomFor(kind) {
    if (this.carry && this.carry.kind !== kind) return 0;
    return Math.floor((this.capacity - this.load) / itemWeight(kind));
  }
  canTake(kind) { return this.roomFor(kind) > 0; }
  give(kind, count = 1, value = 0) {
    if (this.carry && this.carry.kind !== kind) return count;
    const n = Math.min(this.roomFor(kind), count);
    if (!this.carry) this.carry = { kind, count: 0, value: 0 };
    const per = count ? value / count : 0;
    this.carry.count += n;
    this.carry.value += per * n;
    if (this.carry.count <= 0) this.carry = null;
    return count - n;
  }
  take(n = 1) {
    const c = this.carry;
    if (!c) return null;
    const per = c.value / c.count;
    c.count -= n;
    c.value -= per * n;
    const out = { kind: c.kind, value: per * n };
    if (c.count <= 0) this.carry = null;
    return out;
  }
  dropCarry() {
    if (!this.carry) return;
    const f = this.front(0.8);
    spawnPickup(this.carry.kind, this.carry.count, f.x, f.z, this.carry.value);
    this.carry = null;
    sfx('pickup');
  }

  dropTool() {
    const t = this.tool;
    if (t === 'hands') return;
    this.tools.splice(this.toolIdx, 1);
    this.toolIdx = Math.min(this.toolIdx, this.tools.length - 1);
    const f = this.front(0.9);
    spawnPickup('tool:' + t, 1, f.x, f.z);
    G.fx.text(this.pos, `Dropped ${TOOLS[t].name}`, '#fff', 14);
    sfx('pickup');
  }
  pickUpTool(pk, t) {
    this.tools.push(t);
    this.toolIdx = this.tools.length - 1;
    if (t === 'can') this.can = 0;
    if (t === 'spray') this.spray = 0;
    removePickup(pk);
    sfx('pickup');
  }

  knock(vx, vz, stun = 0) {
    this.kv.x += vx * 0.15; this.kv.z += vz * 0.15;
    if (stun > 0 && this.stun <= 0) { this.stun = stun; sfx('hurt'); G.fx.text(this.pos, 'Oof!', '#fff', 15); }
  }

  leave() {
    this.dropCarry();
    this.retSq.visible = this.retRing.visible = false;
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
    this.tools = ['hands']; this.toolIdx = 0; this.carry = null; this.can = 0; this.spray = 0; this.stall = null; this.sellAct = null;
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
    const speed = 6.5 * (G.upgrades.has('shoes') ? 1.25 : 1) * slow * (1 - this.loadSlow);
    this.kv.multiplyScalar(Math.exp(-8 * dt));
    this.tryMove((mx * speed + this.kv.x) * dt, (mz * speed + this.kv.z) * dt);
    const mag = Math.hypot(mx, mz);
    if (Math.hypot(inp.ax, inp.az) > 0.3) this.turnTo(Math.atan2(inp.ax, inp.az), dt, 20);
    else if (mag > 0.15) this.turnTo(Math.atan2(mx, mz), dt, 14);

    if (inp.pressed.lb) this.cycle(-1);
    if (inp.pressed.rb) this.cycle(1);

    // A: context action (some are hold-to-complete)
    const c = (this.ctx = this.computeContext());
    if (c && c.hold) {
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
    if (inp.pressed.b && this.carry) { this.dropCarry(); this.bLock = true; }
    if (!inp.held.b) { this.bLock = false; this.bHold = 0; }
    else if (!this.bLock && this.tool !== 'hands') {
      this.bHold = (this.bHold || 0) + dt;
      if (this.bHold >= 0.6) { this.dropTool(); this.bLock = true; this.bHold = 0; }
    }
    if (inp.pressed.y && this.carry) this.throwOne();

    this.useTool(dt, inp);
    this.collectCoins(dt);
    this.animate(dt, mag);
  }

  turnTo(a, dt, rate) { this.facing += angDiff(a, this.facing) * Math.min(1, dt * rate); }

  tryMove(dx, dz) {
    const w = G.world;
    const closed = G.phase === 'night'; // market aisles are roped off at night
    const free = !w.walkable(this.pos.x, this.pos.z, 0.4, closed);
    if (free || w.walkable(this.pos.x + dx, this.pos.z, 0.4, closed)) this.pos.x += dx;
    if (free || w.walkable(this.pos.x, this.pos.z + dz, 0.4, closed)) this.pos.z += dz;
    const lim = HALF - 4.4;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
  }

  cycle(d) {
    if (this.tools.length < 2) return;
    this.toolIdx = (this.toolIdx + d + this.tools.length) % this.tools.length;
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

  computeContext() {
    const tc = this.targetCell();
    const own = G.world.cellAt(this.pos.x, this.pos.z);
    const carry = this.carry;
    const [ck, sub] = carry ? carry.kind.split(':') : [];
    // Market stall in front of you: A buys, X sells that item back (see useTool).
    this.sellAct = null;
    this.stall = G.market.stallNear(this);
    if (this.stall) {
      const st = this.stall;
      this.sellAct = G.market.sellOption(this, st);
      return { id: 'stall' + st.id, stall: st, at: st.pos, sq: true, label: `Buy ${st.item.name}`, run: () => G.market.buy(this, st) };
    }
    // Quick sell: the Trading Post counter at the market's front, or a Sell Stand in the garden.
    const atCounter = Math.hypot(this.pos.x - COUNTER.x, this.pos.z - COUNTER.z) < 3 && this.dir.z < 0.3;
    const stand = !atCounter && G.placeables.find((p) => p.type === 'sellbox' && !p.dead && dist2(p.pos, this.front(1.0)) < 1.4);
    if (atCounter || stand) {
      if (carry && isSellable(carry.kind)) {
        const price = this.sellPrice();
        const where = stand ? stand.pos : { x: COUNTER.x, z: COUNTER.z - 1.2 };
        return { id: 'sell', at: stand ? stand.pos : null, label: `Sell ${itemInfo(carry.kind).name} ×${carry.count} for $${price}`, run: () => this.sell(where) };
      }
      if (atCounter) return { id: 'counter', label: 'Quick sell: bring anything here', run: () => sfx('error') };
    }
    const plant = this.plantInFront();
    if (carry) {
      switch (ck) {
        case 'seed':
          if (tc && tc.type === 'plot' && !tc.plant) return { id: 'plant', at: tc, sq: true, label: `Plant ${PLANTS[sub].name}`, run: () => this.plantSeed(tc, sub) };
          break;
        case 'soil':
          if (tc && tc.type === 'plot' && tc.soil < 3) return { id: 'soil', at: tc, sq: true, label: `Add soil (${SOIL[tc.soil].name} → ${SOIL[tc.soil + 1].name})`, run: () => this.addSoil(tc) };
          break;
        case 'fertilizer':
          if (plant && (plant.stage < 4 || plant.size < plant.def.maxSize)) return { id: 'fert', at: plant, label: `Fertilize ${plant.def.name}`, run: () => this.boost(plant, 0.25, 0.15) };
          break;
        case 'sunjar':
          if (plant) return { id: 'jar', at: plant, label: `Pour sunshine on ${plant.def.name}`, run: () => this.boost(plant, 0.35, 0.25, true) };
          break;
        case 'dew':
          if (plant) return { id: 'dew', at: plant, label: `Water ${plant.def.name}`, run: () => this.dew(plant) };
          if (this.heartNear()) return { id: 'dewh', label: 'Water the Heart Bloom', run: () => this.dew(G.heart) };
          break;
        case 'weed': {
          const bin = G.placeables.find((p) => p.type === 'compost' && !p.dead && dist2(p.pos, this.pos) < 2.6);
          if (bin) return { id: 'compost', at: bin.pos, label: `Compost weeds (${bin.store}/4)`, run: () => { bin.addWeeds(carry.count); this.carry = null; sfx('plant'); } };
          break;
        }
        case 'kit':
          if (canPlaceOn(tc) && !(PLACEABLES[sub].blocks && activePlayers().some((p) => G.world.cellAt(p.pos.x, p.pos.z) === tc))) {
            return { id: 'place', at: tc, sq: true, label: `Place ${PLACEABLES[sub].name}`, run: () => this.place(tc, sub) };
          }
          break;
      }
    }
    const pk = this.nearestPickup();
    if (pk && pk.kind.startsWith('tool:')) {
      const t = pk.kind.slice(5);
      if (this.tools.includes(t)) return { id: 'owned', at: pk.pos, label: `You already have a ${TOOLS[t].name}`, run: () => sfx('error') };
      return { id: 'picktool', at: pk.pos, label: `Pick up ${TOOLS[t].name}`, run: () => this.pickUpTool(pk, t) };
    }
    if (pk && !this.canTake(pk.kind)) {
      const why = this.carry && this.carry.kind !== pk.kind ? 'Hands full: drop (B) or sell first' : `Bag full (${this.load}/${this.capacity})`;
      return { id: 'full', at: pk.pos, label: why, run: () => { sfx('error'); this.say('Bag full!', '#ffab91'); } };
    }
    if (pk) {
      const inf = itemInfo(pk.kind);
      return { id: 'pick', at: pk.pos, label: `Pick up ${inf.name}${pk.count > 1 ? ' ×' + pk.count : ''}`, run: () => this.pickUp(pk) };
    }
    if (plant && plant.bloomed && this.canTake('produce:' + plant.type)) {
      return { id: 'harvest', at: plant, label: `Harvest ${plant.def.name}`, run: () => this.harvest(plant) };
    }
    if (plant && plant.bloomed && carry) {
      const why = carry.kind === 'produce:' + plant.type ? `Bag full (${this.load}/${this.capacity}): go sell!` : 'Hands full: drop (B) to harvest';
      return { id: 'full', at: plant, label: why, run: () => sfx('error') };
    }
    const wc = tc && tc.weed ? tc : own && own.weed ? own : null;
    if (wc && !this.canTake('weed') && !(tc && tc.plant && tc.plant.bloomed)) return { id: 'fullw', at: wc, sq: true, label: carry && carry.kind !== 'weed' ? 'Hands full: drop (B) to pull weeds' : `Bag full (${this.load}/${this.capacity})`, run: () => sfx('error') };
    if (wc && this.canTake('weed')) return { id: `weed${wc.i},${wc.j}`, at: wc, sq: true, label: 'Pull weed', hold: 0.5, run: () => this.pullWeed(wc) };
    if (!carry && tc && tc.placeable) {
      const pl = tc.placeable;
      return { id: `pack${tc.i},${tc.j}`, at: tc, sq: true, label: `Pack up ${pl.def.name}`, hold: 1.0, run: () => { pl.destroy(); this.give('kit:' + pl.type); sfx('pickup'); } };
    }
    if (carry && !this.ctx) return null;
    return null;
  }

  // ── Actions ──
  sellPrice() {
    const c = this.carry;
    if (!c) return 0;
    if (c.kind.startsWith('produce:')) {
      const t = c.kind.split(':')[1];
      return Math.round(c.value * (G.hotItem === t ? 2 : 1));
    }
    return sellEach(c.kind) * c.count;
  }
  sell(at = { x: COUNTER.x, z: COUNTER.z - 1.2 }) {
    const price = this.sellPrice();
    G.money += price;
    G.stats.moneyEarned += price;
    this.stats.earned += price;
    this.stats.sold += this.carry.count;
    G.fx.text({ x: at.x, y: 1.5, z: at.z }, `+$${price}`, '#ffd54f', 24);
    G.fx.burst({ x: at.x, y: 2, z: at.z }, 0xffd54f, 12, { speed: 4, emissive: true });
    this.carry = null;
    sfx('coin');
  }
  plantSeed(tc, type) {
    const p = new Plant(type, tc);
    G.plants.push(p);
    this.take(1);
    this.stats.planted++;
    G.stats.planted++;
    G.fx.burst({ x: tc.x, y: 0.2, z: tc.z }, 0x6d4c2f, 8, { speed: 2 });
    sfx('plant');
  }
  addSoil(tc) {
    tc.soil++;
    G.world.refreshPlot(tc);
    this.take(1);
    G.fx.burst({ x: tc.x, y: 0.3, z: tc.z }, 0x4e342e, 12, { speed: 2.5 });
    G.fx.text(tc, SOIL[tc.soil].name + ' soil!', '#d7ccc8', 15);
    sfx('till');
  }
  boost(p, g, s, sunny = false) {
    if (p.stage < 4) p.growth = Math.min(1, p.growth + g); else p.size = Math.min(p.def.maxSize, p.size + s);
    this.take(1);
    G.fx.burst({ x: p.pos.x, y: 0.8, z: p.pos.z }, sunny ? 0xffeb3b : 0x26a69a, 16, { speed: 3, emissive: sunny });
    sfx('bloom');
  }
  dew(target) {
    target.addWater(target === G.heart ? 0.2 : 0.3);
    this.stats.water += 0.3;
    this.take(1);
    G.fx.burst({ x: target.pos.x, y: 0.6, z: target.pos.z }, 0x4fc3f7, 10, { speed: 2.5 });
    sfx('splash');
  }
  place(tc, type) {
    const d = this.dir;
    const rot = Math.abs(d.x) > Math.abs(d.z) ? Math.PI / 2 : 0;
    G.placeables.push(new Placeable(type, tc, rot));
    this.take(1);
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
    const it = this.take(1);
    if (!it) return;
    const mesh = makeItem(it.kind);
    G.scene.add(mesh);
    const d = this.dir;
    G.projectiles.push({
      kind: 'throw', item: it.kind, value: it.value, owner: this, mesh, life: 4,
      pos: new THREE.Vector3(this.pos.x + d.x * 0.5, 2.2, this.pos.z + d.z * 0.5),
      vel: new THREE.Vector3(d.x * 11, 5, d.z * 11),
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
    if (this.sellAct) {
      this.xLabel = this.sellAct.label;
      if (pressed) this.sellAct.run();
      this.hose.visible = false;
      return;
    }
    this.xLabel = this.toolLabel(tc);
    switch (tool) {
      case 'hands':
        if (pressed && this.cool <= 0) {
          this.cool = 0.35; this.swingT = 0.25; sfx('swing');
          this.melee(1.4, 1.1, 0.5, 5, 'hands');
        }
        break;
      case 'shovel':
        if (pressed && this.cool <= 0) {
          const sharp = G.upgrades.has('sharp');
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
          this.can = CAN_CAP * (G.upgrades.has('bigcan') ? 2 : 1);
          G.fx.burst({ x: this.pos.x, y: 0.5, z: this.pos.z }, 0x4fc3f7, 12, { speed: 3 });
          this.say('Filled!', '#81d4fa'); sfx('splash');
        } else if (held && !this.nearWater()) {
          if (this.can <= 0) { if (pressed) { this.say('Can is empty!', '#ffab91'); sfx('error'); } break; }
          this.pouring = true;
          const rate = (G.upgrades.has('bigcan') ? 1.0 : 0.6) * dt;
          const amt = Math.min(this.can, rate);
          this.can -= amt;
          const p = this.plantInFront();
          const target = p || (this.heartNear() ? G.heart : null);
          if (target) { target.addWater(amt); this.stats.water += amt; }
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
          if (this.spray <= 0) { if (pressed) { this.say('Sprayer empty!', '#ffab91'); sfx('error'); } break; }
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
          if (dS > HOSE_LEN) { this.say("Hose won't reach!", '#ffab91'); break; }
          this.streaming = true;
          const tp = this.toolPos();
          for (let i = 0; i < 3; i++) G.fx.stream(tp, new THREE.Vector3(this.dir.x, 0.15, this.dir.z), 0x4fc3f7, { speed: 12, spread: 0.1, life: 0.45 });
          sfx('water', 0.2);
          const soap = G.upgrades.has('soaphose');
          this.cone(6.5, 0.38, (e, k) => {
            if (k === 'plant' || k === 'heart') { e.addWater(0.9 * dt); this.stats.water += 0.9 * dt; if (soap && k === 'plant' && e.mites > 0) { const r = Math.min(e.mites, 8 * dt); e.mites -= r; G.stats.mites += r; } }
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
      case 'can': return this.nearWater() ? 'Fill can' : this.can > 0 ? 'Hold: water' : 'Empty!';
      case 'swatter': return 'Swat';
      case 'spray': return this.nearWater() ? 'Refill soap' : this.spray > 0 ? 'Hold: spray' : 'Empty!';
      case 'slingshot': return 'Fling pebble';
      case 'gun': return 'Fire spud';
      case 'mgun': return this.overheat ? 'Cooling down…' : 'Hold: fire';
      case 'hose': return Math.hypot(this.pos.x - SPIGOT.x, this.pos.z - SPIGOT.z) > HOSE_LEN ? 'Too far from spigot' : 'Hold: hose';
    }
    return '';
  }

  shoot(kind = 'gun') {
    const hot = G.upgrades.has('potato');
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
    // tool mesh
    if (this.equipped !== this.tool) {
      this.equipped = this.tool;
      m.tool.clear();
      if (this.tool !== 'hands') {
        const t = makeTool(this.tool);
        t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        m.tool.add(t);
      }
    }
    // right arm: swing / aim / rest
    let ra;
    if (this.swingT > 0) {
      const p = 1 - this.swingT / 0.3;
      ra = -2.6 + Math.min(1, p * 1.4) * 3.0;
    } else if (this.streaming || this.pouring || this.tool === 'gun' || this.tool === 'mgun' || this.tool === 'slingshot' || this.tool === 'spray') ra = -1.35;
    else ra = -0.4 - w * 0.3;
    m.armR.rotation.x += (ra - m.armR.rotation.x) * Math.min(1, dt * (this.swingT > 0 ? 40 : 12));
    // carried item over head (left arm raised)
    const ck = this.carry ? this.carry.kind : null;
    if (ck !== this.carryShown) {
      this.carryShown = ck;
      m.carry.clear();
      if (ck) m.carry.add(makeItem(ck));
    }
    m.armL.rotation.x += ((ck ? -2.9 : w * 0.3) - m.armL.rotation.x) * Math.min(1, dt * 10);
    m.lantern.visible = G.night > 0.2 && !ck;
    m.carry.position.y = 2.3 + Math.sin(this.t * 4) * 0.04;
    m.ring.material.emissiveIntensity = 0.4 + Math.sin(this.t * 4) * 0.2;
    this.updateReticle();
  }
}
