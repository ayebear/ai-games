import * as THREE from 'three';
import { ENEMIES, HALF, COUNTER, NIGHT_LEN, DAY_LEN, HEART_R } from './config.js';
import { G, rand, dist2, clamp, activePlayers, pick } from './state.js';
import { makeEnemy } from './models.js';
import { sfx } from './audio.js';
import { spawnPickup } from './world.js';

// Is (x,z) lit by something deer fear? Returns the light source position or null.
export function lightAt(x, z) {
  if (G.phase !== 'night') return null;
  for (const p of G.placeables) if (p.type === 'lamp' && !p.dead && Math.hypot(p.pos.x - x, p.pos.z - z) < p.def.radius) return p.pos;
  for (const f of G.flashes) if (Math.hypot(f.x - x, f.z - z) < f.r) return f;
  return null;
}

export function flashAt(x, z, r = 5.5) {
  G.flashes.push({ x, z, r, t: 4 });
  G.fx.burst({ x, y: 1, z }, 0xfff59d, 40, { speed: 9, emissive: true, grav: 1, life: 0.8, size: 0.16 });
  sfx('flash');
  for (const e of G.enemies) {
    if (e.dead || dist2(e.pos, { x, z }) > r + 1) continue;
    e.stun = e.def.boss ? 1.5 : 3.5;
    if (e.type === 'deer') { e.state = 'spooked'; e.timer = 2.5; e.spookFrom = { x, z }; }
  }
  if (G.phase === 'day') {
    for (const p of G.plants) if (!p.dead && dist2(p.pos, { x, z }) < r) {
      if (p.stage < 4) p.growth += 0.15; else p.size = Math.min(p.def.maxSize, p.size + 0.12);
    }
  }
}

const TMP = new THREE.Vector3();
// Flyers circle the Heart Bloom well outside its petals (and low enough to swat).
const heartOrbitR = () => HEART_R * (G.heart?.model.group.scale.x ?? 1) + 1.4;

export class Enemy {
  constructor(type, x, z) {
    this.type = type;
    this.def = ENEMIES[type];
    const d = G.day, np = Math.max(1, activePlayers().length);
    let hp = this.def.hp * (1 + (d - 1) * 0.07);
    if (this.def.boss) hp = this.def.hp * Math.max(1, d / 10) * (1 + 0.35 * (np - 1));
    this.hp = this.maxHp = hp;
    this.dmgMul = 1 + (d - 1) * 0.025;
    this.speed = this.def.speed * rand(0.9, 1.1);
    this.pos = new THREE.Vector3(x, 0, z);
    this.y = this.def.flying ? 6 : 0;
    this.kv = new THREE.Vector3();
    this.model = makeEnemy(type);
    this.model.group.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
    G.scene.add(this.model.group);
    this.state = type === 'mole' ? 'tunnel' : 'approach';
    this.target = null; this.t = rand(0, 10); this.timer = 0; this.hitT = 0; this.stun = 0;
    this.fleeing = false; this.dead = false; this.facing = 0; this.blocker = null;
    this.stolen = 0; this.moving = false; this.eating = false; this.orbit = rand(0, 6.28);
    this.summoned = false; this.chargeT = 6;
  }

  get airborne() { return this.type === 'fly' || this.type === 'moth' || (this.type === 'crow' && this.state !== 'land'); }
  get underground() { return this.type === 'mole' && this.state === 'tunnel'; }

  canBeHitBy(tool) {
    if (this.type === 'mole' && this.state !== 'surface') return tool === 'shovel';
    if (this.airborne) return ['swatter', 'gun', 'hose', 'spray', 'can', 'throw'].includes(tool);
    return true;
  }

  face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    const a = Math.atan2(dx, dz);
    let diff = a - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * 0.25;
  }

  moveTo(tx, tz, dt, stop = 0, mul = 1) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    this.moving = false;
    if (d <= stop) { this.face(dx, dz); return true; }
    const step = Math.min(d - stop, this.speed * mul * dt);
    const nx = this.pos.x + (dx / d) * step, nz = this.pos.z + (dz / d) * step;
    this.face(dx, dz);
    this.moving = true;
    if (this.airborne || this.underground) { this.pos.x = nx; this.pos.z = nz; return false; }
    const c = G.world.cellAt(nx, nz);
    if (c && c.placeable && c.placeable.def.blocks && (this.def.fenced || this.def.boss)) {
      this.blocker = c.placeable;
      this.moving = false;
      return false;
    }
    this.blocker = null;
    const bad = (cc) => !cc || cc.type === 'solid' || cc.type === 'water';
    if (bad(c) && !(this.target === G.heart && Math.hypot(nx, nz) > 2)) {
      if (!bad(G.world.cellAt(nx, this.pos.z))) this.pos.x = nx;
      else if (!bad(G.world.cellAt(this.pos.x, nz))) this.pos.z = nz;
      else { this.pos.x += (-dz / d) * step; this.pos.z += (dx / d) * step; }
      return false;
    }
    this.pos.x = nx; this.pos.z = nz;
    return false;
  }

  pickTarget(weightFn = () => 1, heartChance = 0.15) {
    let best = null, bestS = -1;
    for (const p of G.plants) {
      if (p.dead) continue;
      const w = weightFn(p);
      if (w <= 0) continue;
      const s = (w * rand(0.4, 1)) / (1 + dist2(p.pos, this.pos) * 0.06);
      if (s > bestS) { best = p; bestS = s; }
    }
    if (!best || Math.random() < heartChance) {
      if (weightFn(G.heart) > 0) return G.heart;
      return best;
    }
    return best;
  }

  startFlee() {
    if (this.fleeing) return;
    this.fleeing = true;
    if (this.type === 'mole') this.state = 'tunnel';
    if (this.type === 'crow') this.state = 'startle';
    const { x, z } = this.pos;
    if (Math.abs(x) > Math.abs(z) || z < 0) this.exit = { x: Math.sign(x || 1) * 42, z }; // not north through the market
    else this.exit = { x, z: Math.sign(z || 1) * 42 };
  }

  hit(dmg, src, kx = 0, kz = 0, silent = false) {
    if (this.dead) return;
    this.hp -= dmg;
    const kres = this.def.boss ? 0.15 : this.type === 'deer' ? 0.5 : 1;
    this.kv.x += kx * kres; this.kv.z += kz * kres;
    if (!silent) {
      this.hitT = 0.18;
      G.fx.burst({ x: this.pos.x, y: this.y + 0.5, z: this.pos.z }, 0xffffff, 5, { speed: 3 });
      sfx('hit');
    }
    if (this.hp <= 0) { this.die(src, 'killed'); return; }
    if (this.type === 'crow' && this.state === 'land') { this.state = 'startle'; this.timer = 2.5; }
    if (this.type === 'raccoon' && src && !silent) {
      if (this.stolen > 0) {
        spawnPickup('coin', 1, this.pos.x, this.pos.z, this.stolen);
        G.fx.text(this.pos, `Dropped $${this.stolen}!`, '#ffd54f', 16);
        this.stolen = 0;
      }
      this.state = 'scared'; this.timer = 3;
    }
  }

  die(src, how = 'killed') {
    if (this.dead) return;
    this.dead = true;
    G.scene.remove(this.model.group);
    const reward = this.def.reward + (this.stolen || 0);
    if (reward > 0) spawnPickup('coin', 1, this.pos.x, this.pos.z, reward);
    const S = G.stats;
    S.kills[this.type] = (S.kills[this.type] || 0) + 1;
    if (src && src.stats) src.stats.kills++;
    G.fx.burst({ x: this.pos.x, y: this.y + 0.4, z: this.pos.z }, how === 'zapped' ? 0x40c4ff : 0xeeeeee, this.def.boss ? 60 : 10, { speed: this.def.boss ? 8 : 3.5 });
    if (how === 'eaten') G.fx.text(this.pos, 'CHOMP!', '#aed581', 15);
    sfx('kill');
    if (this.def.boss) {
      G.boss = null;
      G.fx.toast('🌙 The Moon Stag falls!', `+$${this.def.reward} bounty`, 'big');
    }
  }

  remove() { this.dead = true; G.scene.remove(this.model.group); }

  update(dt) {
    this.t += dt;
    this.hitT = Math.max(0, this.hitT - dt);
    // knockback
    if (this.kv.lengthSq() > 0.01) {
      const nx = this.pos.x + this.kv.x * dt, nz = this.pos.z + this.kv.z * dt;
      const c = G.world.cellAt(nx, nz);
      if (this.airborne || (c && c.type !== 'solid' && c.type !== 'water')) { this.pos.x = nx; this.pos.z = nz; }
      this.kv.multiplyScalar(Math.exp(-6 * dt));
    }
    if (this.stun > 0) {
      this.stun -= dt;
      this.moving = false;
      if (this.airborne) this.y = Math.max(0.3, this.y - dt * 2);
      this.render(dt, true);
      return;
    }
    if (this.fleeing) {
      if (this.type === 'crow' || this.type === 'fly' || this.type === 'moth') this.y = Math.min(8, this.y + dt * 3);
      this.moveTo(this.exit.x, this.exit.z, dt, 0, 1.4);
      if (Math.abs(this.pos.x) > HALF + 8 || Math.abs(this.pos.z) > HALF + 8) this.remove();
      this.render(dt);
      return;
    }
    this.eating = false;
    this[this.type](dt);
    this.render(dt);
  }

  bite(target, dt, mul = 1) {
    target.damage(this.def.dmg * this.dmgMul * mul * dt, this, dt);
    this.eating = true;
  }

  // ── Behaviors ──
  fly(dt) {
    this.life = (this.life ?? rand(35, 55)) - dt;
    if (this.life <= 0) { this.startFlee(); return; }
    const fw = (p) => (p.kind === 'heart' ? (G.plants.length ? 0 : 1) : p.marigoldNear ? 0 : 1);
    if (!this.target || this.target.dead) this.target = this.pickTarget(fw, 0);
    if (!this.target) { this.startFlee(); return; }
    if (this.target.marigoldNear && Math.random() < dt) {
      const alt = this.pickTarget(fw, 0);
      if (!alt || alt === this.target) { this.startFlee(); G.fx.text(this.pos, 'Ew, marigolds!', '#ffcc80', 13); return; }
      this.target = alt;
    }
    const tg = this.target;
    const r = tg.kind === 'heart' ? heartOrbitR() : 0.6;
    this.orbit += tg.kind === 'heart' ? (dt * 2.6) / r : dt * 3; // same ~2.6 u/s around the big flower
    const ty = tg.kind === 'heart' ? 1.6 : 0.5 + (tg.topY ?? 0.5) * 0.6;
    this.y += (ty + Math.sin(this.t * 6) * 0.25 - this.y) * Math.min(1, dt * 2);
    this.moveTo(tg.pos.x + Math.cos(this.orbit) * r, tg.pos.z + Math.sin(this.orbit) * r, dt);
    if (dist2(this.pos, tg.pos) < r + 1) this.bite(tg, dt);
  }

  moth(dt) {
    const lamps = G.placeables.filter((p) => p.type === 'lamp' && !p.dead);
    if (lamps.length && (!this.target || this.target.dead || this.target.kind !== 'lamp')) {
      let best = null, bd = Infinity;
      for (const l of lamps) { const d = dist2(l.pos, this.pos); if (d < bd) { bd = d; best = l; } }
      this.target = best; best.kind = 'lamp';
    }
    if (!this.target || this.target.dead) this.target = this.pickTarget(() => 1, 0.2);
    if (!this.target) { this.startFlee(); return; }
    const tg = this.target;
    const isLamp = tg.kind === 'lamp';
    const r = isLamp ? 0.9 : tg.kind === 'heart' ? heartOrbitR() + 0.3 : 0.7;
    this.orbit += tg.kind === 'heart' ? (dt * 2.4) / r : dt * (2.5 + Math.sin(this.t) * 0.5);
    const ty = isLamp ? 2.3 : tg.kind === 'heart' ? 1.9 : 1;
    this.y += (ty + Math.sin(this.t * 4) * 0.3 - this.y) * Math.min(1, dt * 2);
    this.moveTo(tg.pos.x + Math.cos(this.orbit) * r, tg.pos.z + Math.sin(this.orbit) * r, dt);
    if (dist2(this.pos, tg.pos) < r + 1) {
      if (isLamp) { tg.damage(this.def.dmg * this.dmgMul * dt); this.eating = true; }
      else this.bite(tg, dt);
    }
  }

  crow(dt) {
    const scared = (p) => G.placeables.some((s) => s.type === 'scarecrow' && !s.dead && dist2(s.pos, p.pos) < s.def.radius);
    const valid = (p) => (p.kind === 'heart' || scared(p) ? 0 : p.stage >= 3 ? 3 : 1);
    if (this.state === 'startle') {
      this.timer -= dt;
      this.y = Math.min(7, this.y + dt * 5);
      if (this.target) this.moveTo(this.pos.x + (this.pos.x - this.target.pos.x), this.pos.z + (this.pos.z - this.target.pos.z), dt, 0, 1);
      if (this.timer <= 0) { this.state = 'approach'; this.target = null; }
      return;
    }
    if (!this.target || this.target.dead || scared(this.target)) {
      this.target = this.pickTarget(valid, 0);
      if (!this.target || this.target.kind === 'heart') { this.startFlee(); return; }
      this.state = 'approach';
    }
    const tg = this.target;
    // startled by nearby gnomes
    for (const pl of activePlayers()) {
      if (dist2(pl.pos, this.pos) < (this.state === 'land' ? 3.2 : 2.2) && this.y < 4) {
        this.state = 'startle'; this.timer = 2.5;
        G.fx.text(this.pos, 'CAW!', '#cfd8dc', 14);
        return;
      }
    }
    if (this.state === 'approach') {
      const d = dist2(this.pos, tg.pos);
      this.y += ((d < 3 ? 0.5 : 5) - this.y) * Math.min(1, dt * 2);
      if (this.moveTo(tg.pos.x + 0.4, tg.pos.z + 0.4, dt, 0.1) && this.y < 0.8) { this.state = 'land'; this.y = 0.3; }
    } else if (this.state === 'land') {
      this.y = 0.3 + (tg.topY ?? 0) * 0.3;
      this.bite(tg, dt);
      if (tg.stage === 4 && tg.size > 1) tg.size = Math.max(1, tg.size - dt * 0.03);
      if (tg.stage < 4) tg.growth = Math.max(0, tg.growth - dt * 0.004);
    }
  }

  mole(dt) {
    if (!this.target || this.target.dead) {
      this.target = this.pickTarget((p) => (p.kind === 'heart' ? 0 : 1), 0);
      if (!this.target) { this.startFlee(); return; }
      if (this.state === 'surface') this.state = 'tunnel';
    }
    const tg = this.target;
    if (this.state === 'tunnel') {
      if (Math.random() < dt * 8) G.fx.burst({ x: this.pos.x, y: 0.1, z: this.pos.z }, 0x6d4c2f, 1, { speed: 1.5, size: 0.08 });
      if (this.moveTo(tg.pos.x, tg.pos.z, dt, 0.35)) { this.state = 'surface'; this.timer = 3.5; sfx('thump'); }
    } else {
      this.timer -= dt;
      this.bite(tg, dt);
      if (this.timer <= 0) { this.state = 'tunnel'; this.target = this.pickTarget((p) => (p.kind === 'heart' || p === tg ? 0 : 1), 0) || tg; }
    }
  }

  slug(dt) {
    if (this.timer > 0) this.timer -= dt;
    const trap = G.placeables.find((p) => p.type === 'beertrap' && !p.dead && dist2(p.pos, this.pos) < p.def.radius + 2);
    if (trap) {
      if (this.moveTo(trap.pos.x, trap.pos.z, dt, 0.35)) {
        trap.uses--;
        G.fx.burst({ x: trap.pos.x, y: 0.2, z: trap.pos.z }, 0xffb300, 8, { speed: 2 });
        G.fx.text(trap.pos, 'Glug!', '#ffe082', 14);
        if (trap.uses <= 0) trap.destroy(false);
        this.die(null, 'trapped');
      }
      return;
    }
    if (!this.target || this.target.dead || this.timer <= 0) {
      this.timer = 6;
      this.target = this.pickTarget((p) => (p.kind === 'heart' ? 1 : 1 + (p.cell.wet > 0.5 || p.water > 0.9 ? 5 : 0)), 0.1);
    }
    if (!this.target) return;
    const tg = this.target;
    if (this.moveTo(tg.pos.x, tg.pos.z, dt, tg.radius + 0.3)) this.bite(tg, dt);
  }

  deer(dt) {
    if (this.state === 'spooked') {
      this.timer -= dt;
      const f = this.spookFrom || this.pos;
      const dx = this.pos.x - f.x, dz = this.pos.z - f.z, l = Math.hypot(dx, dz) || 1;
      this.moveTo(this.pos.x + (dx / l) * 5, this.pos.z + (dz / l) * 5, dt, 0, 1.4);
      if (this.timer <= 0) { this.state = 'approach'; this.target = null; }
      return;
    }
    const lit = lightAt(this.pos.x, this.pos.z);
    if (lit) {
      this.state = 'spooked'; this.timer = 1.6; this.spookFrom = { x: lit.x, z: lit.z };
      if (Math.random() < 0.3) G.fx.text(this.pos, 'Spooked!', '#fff59d', 14);
      return;
    }
    if (!this.target || this.target.dead || (Math.random() < dt * 0.5 && lightAt(this.target.pos.x, this.target.pos.z))) {
      this.target = this.pickTarget((p) => (lightAt(p.pos.x, p.pos.z) ? 0 : p.kind === 'heart' ? 1 : 1 + p.stage * 0.5 + p.size), 0.15);
    }
    if (!this.target) { this.moveTo(Math.cos(this.t * 0.3) * 20, Math.sin(this.t * 0.3) * 20, dt, 0, 0.5); return; }
    const tg = this.target;
    const arrived = this.moveTo(tg.pos.x, tg.pos.z, dt, tg.radius + 0.9);
    if (this.blocker) { this.blocker.damage(10 * this.dmgMul * dt); this.eating = true; }
    else if (arrived) this.bite(tg, dt);
    this.shove(1.2, 4);
  }

  raccoon(dt) {
    if (this.state === 'scared') {
      this.timer -= dt;
      this.moveTo(this.pos.x * 2, this.pos.z * 2 + 10, dt, 0, 1.3);
      if (this.timer <= 0) this.state = 'approach';
      return;
    }
    const going = G.money > 0 || this.stolen === 0;
    if (G.money <= 0 && this.stolen > 0) { this.startFlee(); G.fx.text(this.pos, 'Heh heh!', '#bdbdbd', 14); return; }
    if (!going) return;
    if (G.money <= 0) {
      // nothing to steal: chew plants instead
      if (!this.target || this.target.dead || this.target === G.heart) this.target = this.pickTarget((p) => (p.kind === 'heart' ? 0 : 1), 0) || G.heart;
      if (this.moveTo(this.target.pos.x, this.target.pos.z, dt, this.target.radius + 0.5)) this.bite(this.target, dt);
      if (this.blocker) this.blocker.damage(6 * dt);
      return;
    }
    const arrived = this.moveTo(COUNTER.x + Math.sin(this.orbit) * 2, COUNTER.z + 0.6, dt, 0.4);
    if (this.blocker) { this.blocker.damage(6 * this.dmgMul * dt); this.eating = true; return; }
    if (arrived) {
      this.eating = true;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0.6;
        const amt = Math.min(G.money, 1 + Math.floor(G.day / 10));
        G.money -= amt; this.stolen += amt;
        G.jar.attackedAt = G.clock;
        G.stats.moneyStolen += amt;
        G.fx.text(this.pos, `-$${amt}`, '#ff5252', 15);
        sfx('steal');
        if (this.stolen >= 12 + G.day) { this.startFlee(); G.fx.toast('🦝 A raccoon escaped with your coins!', `-$${this.stolen}`); }
      }
    }
  }

  stag(dt) {
    this.target = G.heart;
    this.chargeT -= dt;
    let mul = 1;
    if (this.state === 'charge') {
      mul = 3.2; this.timer -= dt;
      if (this.timer <= 0) { this.state = 'approach'; this.chargeT = rand(6, 9); }
    } else if (this.chargeT <= 0 && dist2(this.pos, G.heart.pos) > 8) {
      this.state = 'charge'; this.timer = 1.4; sfx('boss', 1);
      G.fx.text(this.pos, 'CHARGE!', '#80deea', 20);
    }
    const arrived = this.moveTo(0, 0, dt, G.heart.radius + 2.2, mul);
    if (this.blocker) { this.blocker.damage(250 * dt); }
    else if (arrived) this.bite(G.heart, dt);
    this.shove(2.5, this.state === 'charge' ? 14 : 5, this.state === 'charge' ? 1 : 0);
    if (!this.summoned && this.hp < this.maxHp * 0.5) {
      this.summoned = true;
      for (let i = 0; i < 2 + G.day / 20; i++) {
        const e = new Enemy('deer', this.pos.x + rand(-3, 3), this.pos.z + rand(-3, 3));
        G.enemies.push(e);
      }
      G.fx.toast('🌙 The Moon Stag calls the herd!');
    }
  }

  shove(r, force, stun = 0) {
    for (const pl of activePlayers()) {
      const d = dist2(pl.pos, this.pos);
      if (d < r) {
        const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, l = d || 1;
        pl.knock((dx / l) * force, (dz / l) * force, stun);
      }
    }
  }

  render(dt, stunned = false) {
    const m = this.model, g = m.group;
    let y = this.y;
    if (this.type === 'fly' || this.type === 'moth') y += Math.sin(this.t * 9) * 0.05;
    g.position.set(this.pos.x, y, this.pos.z);
    g.rotation.y = this.facing;
    const base = this.def.boss ? 2.1 : 1;
    const sq = this.hitT > 0 ? 1 + this.hitT * 2 : 1;
    g.scale.set(base * sq, (base / sq), base * sq);
    if (stunned) g.rotation.z = Math.sin(this.t * 20) * 0.15; else g.rotation.z = 0;
    const flap = this.type === 'fly' ? 40 : this.type === 'moth' ? 18 : 10;
    m.wings.forEach((w, i) => {
      const s = i === 0 ? -1 : 1;
      if (this.type === 'crow') w.rotation.z = this.state === 'land' ? s * 0.1 : Math.sin(this.t * flap) * 0.7 * s;
      else w.rotation.z = Math.sin(this.t * flap) * 0.8 * s;
    });
    if (m.legs.length) {
      const sp = this.moving ? (this.state === 'charge' ? 22 : 12) : 0;
      m.legs.forEach((l, i) => { l.rotation.x = sp ? Math.sin(this.t * sp + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.5 : 0; });
    }
    if (m.head && (this.type === 'deer' || this.type === 'stag')) {
      const tgt = this.eating ? 0.9 + Math.sin(this.t * 10) * 0.15 : this.state === 'charge' ? 0.6 : 0;
      m.head.rotation.x += (tgt - m.head.rotation.x) * Math.min(1, dt * 6);
    }
    if (this.type === 'mole') {
      const up = this.state === 'surface';
      m.body.visible = up || this.hitT > 0;
      m.body.position.y += ((up ? 0 : -0.5) - m.body.position.y) * Math.min(1, dt * 8);
      m.mound.scale.y = 0.28 + Math.sin(this.t * 10) * 0.04;
    }
    if (this.type === 'slug') g.scale.z = base * (1 + Math.sin(this.t * 4) * 0.08);
  }
}

// ───────────────────────── Director: spawns waves ─────────────────────────
function edgeSpawn() {
  for (let k = 0; k < 20; k++) {
    const side = 1 + Math.floor(Math.random() * 3); // never the north edge: that's the market
    const t = rand(-HALF + 3, HALF - 3);
    const e = HALF - 1.2;
    const [x, z] = side === 0 ? [t, -e] : side === 1 ? [t, e] : side === 2 ? [-e, t] : [e, t];
    if (Math.hypot(x - -19.5, z - 19.5) < 7) continue; // not out of the pond
    return [x, z];
  }
  return [HALF - 1.2, 0];
}

export function spawnEnemy(type) {
  const [x, z] = edgeSpawn();
  const e = new Enemy(type, x, z);
  G.enemies.push(e);
  return e;
}

export class Director {
  constructor() { this.reset(); }
  reset() { this.dayT = 30; this.queue = []; this.nightT = 0; }

  playerMul() { return 1 + 0.4 * (Math.max(1, activePlayers().length) - 1); }

  onDusk() {
    const d = G.day;
    let budget = (3 + d * 2.2 + d * d * 0.025) * this.playerMul();
    const opts = [
      { type: 'slug', cost: 1, w: 3, from: 1, group: 1 },
      { type: 'moth', cost: 1.2, w: 2, from: 2, group: 2 },
      { type: 'deer', cost: 3, w: 2.5, from: 3, group: 1 },
      { type: 'raccoon', cost: 2.5, w: 1, from: 4, group: 1, max: 1 + Math.floor(d / 8) },
    ].filter((o) => d >= o.from);
    const counts = {};
    this.queue = [];
    let guard = 0;
    while (budget > 0.5 && guard++ < 300) {
      const tot = opts.reduce((s, o) => s + o.w, 0);
      let r = Math.random() * tot, o = opts[0];
      for (const op of opts) { r -= op.w; if (r <= 0) { o = op; break; } }
      if (o.max && (counts[o.type] || 0) >= o.max) continue;
      counts[o.type] = (counts[o.type] || 0) + 1;
      budget -= o.cost;
      const t = rand(3, NIGHT_LEN * 0.7);
      for (let i = 0; i < o.group; i++) this.queue.push({ t: t + i * 0.5, type: o.type });
    }
    if (d % 10 === 0) this.queue.push({ t: 8, type: 'stag' });
    this.queue.sort((a, b) => a.t - b.t);
    this.nightT = 0;
    return counts;
  }

  onDawn() { this.dayT = Math.max(10, 30 - G.day); }

  update(dt) {
    if (G.phase === 'day') {
      if (G.day < 2 || G.time > DAY_LEN - 12) return;
      this.dayT -= dt;
      if (this.dayT > 0) return;
      const d = G.day;
      this.dayT = Math.max(5, 22 - d * 0.6) / (1 + 0.25 * (this.playerMul() - 1) / 0.4) * rand(0.7, 1.3);
      const hasPlants = G.plants.some((p) => !p.dead);
      const opts = [{ k: 'fly', w: 3 }];
      if (d >= 3) opts.push({ k: 'crow', w: 2 });
      if (d >= 3 && hasPlants) opts.push({ k: 'mites', w: 2 });
      if (d >= 4 && hasPlants) opts.push({ k: 'mole', w: 1.5 });
      const tot = opts.reduce((s, o) => s + o.w, 0);
      let r = Math.random() * tot, kind = 'fly';
      for (const o of opts) { r -= o.w; if (r <= 0) { kind = o.k; break; } }
      if (kind === 'mites') {
        const p = pick(G.plants.filter((p) => !p.dead));
        if (p) { p.mites += 3 + d * 0.1; G.fx.text(p.pos, 'Mites!', '#ff8a80', 15); }
      } else if (kind === 'fly') {
        const n = Math.min(6, 1 + Math.floor(d / 5) + (Math.random() < 0.5 ? 1 : 0));
        const [x, z] = edgeSpawn();
        for (let i = 0; i < n; i++) G.enemies.push(new Enemy('fly', x + rand(-1, 1), z + rand(-1, 1)));
      } else {
        const n = kind === 'crow' ? 1 + Math.floor(d / 12) : 1;
        for (let i = 0; i < n; i++) spawnEnemy(kind);
      }
    } else {
      this.nightT += dt;
      while (this.queue.length && this.queue[0].t <= this.nightT) {
        const q = this.queue.shift();
        const e = spawnEnemy(q.type);
        if (q.type === 'stag') {
          G.boss = e;
          sfx('boss', 1);
          G.fx.toast('🌙 THE MOON STAG APPROACHES', 'It is heading straight for the Heart Bloom!', 'big danger');
        }
      }
    }
  }
}
