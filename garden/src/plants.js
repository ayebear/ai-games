import * as THREE from 'three';
import { PLANTS, SOIL, HEART_R, REGROW_AT } from './config.js';
import { G, clamp, dist2, rand } from './state.js';
import { makePlantModel, makeHeart, P, SPH, mat } from './models.js';
import { sfx } from './audio.js';
import { spawnPickup } from './world.js';

export function sunAt(x, z) {
  let s = G.sun;
  for (const pl of G.placeables) {
    if (pl.type === 'lamp' && !pl.dead && Math.hypot(pl.pos.x - x, pl.pos.z - z) < pl.def.radius) s = Math.max(s, 0.85);
  }
  return s;
}

export const PLANT_SCALE = 1.55;
const stageOf = (g) => (g < 0.12 ? 0 : g < 0.32 ? 1 : g < 0.62 ? 2 : g < 1 ? 3 : 4);
// A plant with no water loses HP so that it dies this many seconds after drying out (from full HP),
// whatever its size. A flat rate made cheap starter crops die in about 20 s.
const DRY_DEATH = 90;
export const STAGE_NAMES = ['Seed', 'Sprout', 'Growing', 'Budding', 'Bloom'];

export class Plant {
  constructor(type, cell) {
    this.type = type;
    this.def = PLANTS[type];
    this.cell = cell;
    this.kind = 'plant';
    this.pos = new THREE.Vector3(cell.x, 0, cell.z);
    this.growth = 0; this.stage = 0; this.size = 1;
    this.water = 0.45; this.hp = this.def.hp; this.maxHp = this.def.hp;
    this.mites = 0; this.spreadT = 0; this.dead = false; this.radius = 0.7;
    this.hive = false; this.ladybugs = false; this.marigoldNear = false; this.checkT = 0;
    this.bite = 0; this.snapT = 0; this.snapCd = 0; this.t = Math.random() * 10;
    this.sunNow = 0; this.waterF = 1;
    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    G.scene.add(this.root);
    this.mitesGroup = new THREE.Group();
    this.root.add(this.mitesGroup);
    for (let i = 0; i < 8; i++) {
      const m = P(this.mitesGroup, SPH(5, 3), mat(0xff1744, { emissive: 0x550000 }), [rand(-0.3, 0.3), rand(0.1, 0.6), rand(-0.3, 0.3)], 0.05, [0, 0, 0], false);
      m.visible = false;
    }
    this.model = null;
    this.rebuild();
    cell.plant = this;
  }

  get bloomed() { return this.stage === 4; }
  get topY() { return (this.model?.height ?? 0.5) * this.root.scale.y; }

  rebuild() {
    if (this.model) this.root.remove(this.model.group);
    this.model = makePlantModel(this.type, this.stage);
    this.root.add(this.model.group);
  }

  addWater(a) {
    this.water = clamp(this.water + a, 0, 1.25);
  }
  // none (dried out: hurts the plant) · low (grows at half speed) · ok · soggy (overwatered: slow)
  get waterState() { const w = this.water; return w < 0.1 ? 'none' : w < 0.3 ? 'low' : w <= 0.9 ? 'ok' : 'soggy'; }

  update(dt) {
    const d = this.def;
    this.t += dt;
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.8 + Math.random() * 0.4;
      this.hive = G.placeables.some((p) => p.type === 'beehive' && !p.dead && dist2(p.pos, this.pos) < p.def.radius);
      this.ladybugs = G.placeables.some((p) => p.type === 'ladybugs' && !p.dead && dist2(p.pos, this.pos) < p.def.radius);
      this.marigoldNear = G.plants.some((q) => q.type === 'marigold' && q.stage >= 3 && !q.dead && dist2(q.pos, this.pos) < PLANTS.marigold.aura);
    }
    const sun = sunAt(this.pos.x, this.pos.z);
    this.sunNow = sun;
    let drain = 0.005 + 0.011 * G.sun * (G.weather === 'heat' ? 2 : 1);
    if (this.cell.weed) drain *= 1.6;
    if (d.thirsty) drain *= d.thirsty;
    if (G.weather === 'rain') this.water += 0.012 * dt;
    this.water = clamp(this.water - drain * dt, 0, 1.25);
    const wf = { none: 0, low: 0.5, ok: 1, soggy: 0.45 }[this.waterState];
    this.waterF = wf;
    const sf = d.sunNeed ? Math.pow(sun, d.sunNeed) * 1.5 : sun;
    const rate = wf * sf * SOIL[this.cell.soil].mult * (this.hive ? 1.25 : 1) * (this.mites > 5 ? 0.6 : 1);
    if (this.stage < 4) this.growth += (dt / d.grow) * rate;
    else if (this.size < d.maxSize) this.size = Math.min(d.maxSize, this.size + (dt * rate * (d.maxSize - 1)) / (d.grow * 1.6));

    if (wf === 0) {
      this.hp -= (dt * this.maxHp) / DRY_DEATH; // any plant lasts DRY_DEATH s from full HP once dry
      if (this.stage === 4) this.size = Math.max(1, this.size - dt * 0.01);
    } else if (wf === 1 && this.mites < 1) this.hp = Math.min(this.maxHp, this.hp + dt * 0.7);

    // Mites: multiply, chew, spread
    if (this.mites > 0) {
      if (this.marigoldNear) this.mites -= dt * 2;
      if (this.ladybugs) this.mites -= dt * 2.5;
      this.mites = Math.min(24, this.mites + dt * 0.18 * (1 + G.day * 0.02));
      this.hp -= this.mites * 0.1 * dt;
      if (this.mites > 8) {
        this.spreadT += dt;
        if (this.spreadT > 6) {
          this.spreadT = 0;
          const n = G.plants.find((q) => q !== this && !q.dead && q.mites < 4 && dist2(q.pos, this.pos) < 3.2);
          if (n) n.mites += 2;
        }
      }
      if (this.mites < 0.2) this.mites = 0;
    }
    if (this.hp <= 0) { this.die(); return; }

    const ns = stageOf(this.growth);
    if (ns !== this.stage) {
      this.stage = ns;
      this.rebuild();
      if (ns === 4) {
        G.fx.burst({ x: this.pos.x, y: 1, z: this.pos.z }, 0xfff59d, 14, { speed: 3, emissive: true, grav: 2 });
        sfx('bloom', 0.2);
      }
    }

    // Flytrap: snap at flies & moths
    if (this.type === 'flytrap' && this.stage >= 3) {
      this.snapCd -= dt;
      if (this.snapCd <= 0) {
        const e = G.enemies.find((e) => !e.dead && (e.type === 'fly' || e.type === 'moth') && dist2(e.pos, this.pos) < d.eats);
        if (e) {
          e.die(null, 'eaten');
          this.snapCd = this.stage === 4 ? 1.2 : 2;
          this.snapT = 0.35;
          sfx('snap');
        }
      }
    }
    this.animate(dt);
  }

  animate(dt) {
    const m = this.model;
    const grow01 = this.stage === 4 ? 1 : clamp((this.growth - [0, 0.12, 0.32, 0.62][this.stage]) / [0.12, 0.2, 0.3, 0.38][this.stage], 0, 1);
    // PLANT_SCALE makes everything chunkier; young plants get an extra boost so they read at a glance.
    let s = (0.75 + grow01 * 0.25) * PLANT_SCALE * (this.stage <= 1 ? 1.2 : 1);
    if (!this.def.bigFruit) s *= 1 + (this.size - 1) * 0.45;
    this.bite = Math.max(0, this.bite - dt);
    const squash = this.bite > 0 ? 1 + Math.sin(this.bite * 40) * 0.06 : 1;
    this.root.scale.set(s * squash, s / squash, s * squash);
    if (m.fruit) m.fruit.scale.setScalar(Math.min(3, this.size));
    const droop = this.water < 0.1 ? 0.45 : this.water < 0.2 ? 0.2 : 0;
    m.group.rotation.x += (droop - m.group.rotation.x) * Math.min(1, dt * 3);
    m.group.rotation.z = Math.sin(this.t * 1.3 + this.pos.x) * 0.04;
    if (m.head && this.type === 'sunflower') m.head.rotation.y = Math.sin(G.time / 50) * 0.5;
    this.snapT = Math.max(0, this.snapT - dt);
    for (const tr of m.traps) tr.rotation.x = this.snapT > 0 ? 0 : -0.6 + Math.sin(this.t * 2) * 0.1;
    // mite specks
    const shown = Math.ceil(this.mites / 3);
    this.mitesGroup.children.forEach((c, i) => {
      c.visible = i < shown;
      if (c.visible) { c.position.x += Math.sin(this.t * 7 + i) * dt * 0.3; c.position.z += Math.cos(this.t * 6 + i) * dt * 0.3; c.position.x = clamp(c.position.x, -0.35, 0.35); c.position.z = clamp(c.position.z, -0.35, 0.35); }
    });
  }

  damage(n, src = null, dt = 0) {
    if (this.dead) return;
    this.attackedAt = G.clock;
    this.hp -= n;
    this.bite = 0.25;
    if (this.def.thorns && this.stage >= 2 && src && src.hit && dt > 0) src.hit(this.def.thorns * dt, null, 0, 0, true);
    if (this.hp <= 0) this.die();
  }

  harvest() {
    if (!this.bloomed) return null;
    const d = this.def;
    const value = Math.round(d.value * this.size * (1 + 0.12 * this.cell.soil) * (this.hive ? 1.25 : 1));
    const S = G.stats;
    S.harvested[this.type] = (S.harvested[this.type] || 0) + 1;
    if (!S.biggest || this.size > S.biggest.size) S.biggest = { type: this.type, size: this.size, value };
    G.fx.burst({ x: this.pos.x, y: 0.8, z: this.pos.z }, 0xfff59d, 16, { speed: 4, emissive: true });
    if (this.type === 'sunflower') spawnPickup('sunjar', 1, this.pos.x, this.pos.z);
    this.cell.soil = Math.max(0, this.cell.soil - 1);
    G.world.refreshPlot(this.cell);
    if (d.regrow) {
      // back to the Growing stage; each new crop starts at normal size
      this.growth = REGROW_AT;
      this.stage = stageOf(REGROW_AT);
      this.size = 1;
      this.rebuild();
    } else {
      this.remove();
    }
    return { kind: 'produce:' + this.type, value };
  }

  remove() {
    this.dead = true;
    if (this.cell.plant === this) this.cell.plant = null;
    G.scene.remove(this.root);
  }

  die() {
    if (this.dead) return;
    G.stats.plantsLost++;
    G.fx.burst({ x: this.pos.x, y: 0.5, z: this.pos.z }, 0x8d6e63, 14, { speed: 3 });
    G.fx.text(this.pos, `${this.def.name} lost!`, '#ff8a80', 16);
    sfx('hurt');
    this.remove();
  }
}

const HEART_THIRST = 2; // HP per second the Heart Bloom loses while it has no water

export class Heart {
  constructor() {
    this.model = makeHeart();
    G.scene.add(this.model.group);
    this.model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.pos = new THREE.Vector3(0, 0, 0);
    this.kind = 'heart';
    this.radius = HEART_R;
    this.hp = 400; this.water = 0.6;
    this.dead = false; this.bite = 0; this.t = 0; this.hurtT = 0;
  }
  get maxHp() { return 400; }
  addWater(a) { this.water = clamp(this.water + a, 0, 1.2); }
  // none (bone dry: the Heart loses HP) · low (stops healing) · ok. The Heart can't be overwatered.
  get waterState() { return this.water <= 0.01 ? 'none' : this.water < 0.15 ? 'low' : 'ok'; }

  update(dt) {
    this.t += dt;
    this.water = clamp(this.water - dt * 0.004 * (G.weather === 'heat' ? 2 : 1) + (G.weather === 'rain' ? 0.01 * dt : 0), 0, 1.2);
    const ws = this.waterState;
    if (ws === 'none' && this.hp > 0) {
      this.hp -= dt * HEART_THIRST;
      if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    } else if (G.phase === 'day' && ws === 'ok' && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + dt * 1.2);
    this.hurtT = Math.max(0, this.hurtT - dt);
    const m = this.model;
    const ratio = this.hp / this.maxHp;
    const s = 1 + Math.min(G.day, 100) * 0.006;
    this.bite = Math.max(0, this.bite - dt);
    const shake = this.bite > 0 ? Math.sin(this.t * 60) * 0.03 : 0;
    m.group.scale.setScalar(s);
    m.group.rotation.z = shake + Math.sin(this.t * 0.7) * 0.015;
    for (const p of m.petals) p.rotation.z += (0.35 - (1 - ratio) * 1.1 - p.rotation.z) * Math.min(1, dt * 2);
    m.head.rotation.y += dt * 0.08;
    m.core.material.emissiveIntensity = 0.5 + Math.sin(this.t * 2) * 0.2 + G.night * 0.8;
  }

  damage(n, src = null) {
    if (this.dead) return;
    this.attackedAt = G.clock;
    // the ancient bloom shrugs off small pests; big beasts hurt it for real
    const big = src && (src.type === 'deer' || src.type === 'stag' || src.type === 'raccoon');
    this.hp -= big ? n : n * 0.5;
    this.bite = 0.2;
    if (this.hurtT <= 0) { this.hurtT = 1.2; sfx('hurt', 0.5); }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
}
