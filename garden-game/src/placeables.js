import * as THREE from 'three';
import { PLACEABLES } from './config.js';
import { G, dist2 } from './state.js';
import { makePlaceable } from './models.js';
import { sfx } from './audio.js';
import { spawnPickup } from './world.js';

export class Placeable {
  constructor(type, cell, rotY = 0) {
    this.type = type;
    this.def = PLACEABLES[type];
    this.cell = cell;
    this.pos = new THREE.Vector3(cell.x, 0, cell.z);
    this.hp = this.def.hp;
    this.uses = this.def.uses ?? Infinity;
    this.dead = false;
    this.t = Math.random() * 5;
    this.timer = 2;
    this.store = 0; // compost
    this.model = makePlaceable(type);
    this.model.group.position.copy(this.pos);
    this.model.group.rotation.y = rotY;
    this.model.group.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
    G.scene.add(this.model.group);
    this.hitT = 0;
    cell.placeable = this;
    if (cell.weed) G.world.removeWeed(cell);
  }

  update(dt) {
    this.t += dt;
    this.hitT = Math.max(0, this.hitT - dt);
    const m = this.model, r = this.def.radius;
    switch (this.type) {
      case 'sprinkler': {
        m.head.rotation.y += dt * 4;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 5;
          let any = false;
          for (const p of G.plants) if (!p.dead && dist2(p.pos, this.pos) < r) { p.addWater(0.16); any = true; }
          if (dist2(G.heart.pos, this.pos) < r + G.heart.radius) G.heart.addWater(0.1);
          for (const c of G.world.cells) if (c.type === 'plot' && Math.hypot(c.x - this.pos.x, c.z - this.pos.z) < r) c.wet = Math.min(1, c.wet + 0.25);
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            G.fx.stream(new THREE.Vector3(this.pos.x, 0.6, this.pos.z), new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)), 0x81d4fa, { speed: 5, life: 0.6 });
          }
          if (any) sfx('water', 0.3);
        }
        break;
      }
      case 'zapper': {
        this.timer -= dt;
        m.cage.material.emissiveIntensity = 1.2 + Math.sin(this.t * 10) * 0.3;
        if (this.timer <= 0) {
          const e = G.enemies.find((e) => !e.dead && (e.type === 'fly' || e.type === 'moth') && dist2(e.pos, this.pos) < r);
          if (e) {
            this.timer = 0.5;
            G.fx.burst({ x: e.pos.x, y: e.y ?? 1.5, z: e.pos.z }, 0x40c4ff, 10, { speed: 4, emissive: true, grav: 0 });
            e.die(null, 'zapped');
            sfx('zap');
          } else this.timer = 0.2;
        }
        break;
      }
      case 'ladybugs':
        if (Math.random() < dt * 2) {
          const p = G.plants.find((p) => !p.dead && p.mites > 0 && dist2(p.pos, this.pos) < r);
          if (p) G.fx.burst({ x: p.pos.x, y: 0.6, z: p.pos.z }, 0xe53935, 2, { speed: 1.5, grav: 0, size: 0.07 });
        }
        break;
      case 'beehive':
        m.bees.forEach((b, i) => {
          const a = this.t * (1.5 + i * 0.3) + i * 1.7;
          b.position.set(Math.cos(a) * (1.2 + i * 0.4), 1.0 + Math.sin(a * 2) * 0.3, Math.sin(a) * (1.2 + i * 0.4));
        });
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 1;
          const e = G.enemies.find((e) => !e.dead && e.type === 'fly' && dist2(e.pos, this.pos) < r);
          if (e) e.hit(1, null, 0, 0, true);
        }
        break;
    }
  }

  addWeeds(n) {
    this.store += n;
    while (this.store >= 4) {
      this.store -= 4;
      spawnPickup('soil', 1, this.pos.x + 1.2, this.pos.z + 1.2);
      G.fx.burst({ x: this.pos.x, y: 1.2, z: this.pos.z }, 0x8d6e63, 10, { speed: 3 });
      sfx('plant');
    }
  }

  damage(n) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hitT <= 0) {
      this.hitT = 0.4;
      G.fx.burst({ x: this.pos.x, y: 1, z: this.pos.z }, 0xc8a06a, 4, { speed: 2 });
    }
    if (this.hp <= 0) this.destroy(true);
  }

  destroy(broken = false) {
    if (this.dead) return;
    this.dead = true;
    if (this.cell.placeable === this) this.cell.placeable = null;
    G.scene.remove(this.model.group);
    if (broken) {
      G.fx.burst({ x: this.pos.x, y: 0.8, z: this.pos.z }, 0x8d6e4b, 16, { speed: 4 });
      G.fx.text(this.pos, `${this.def.name} broken!`, '#ffab91', 15);
      sfx('hit');
    }
  }
}

export function canPlaceOn(c) {
  return !!c && c.type === 'grass' && !c.placeable && !c.plant && Math.hypot(c.x, c.z) > 3.5;
}
