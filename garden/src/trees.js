import * as THREE from 'three';
import { GRID, POND, SPIGOT, TREES, WOOD_DROP } from './config.js';
import { G, rand, randi, dist2 } from './state.js';
import { makeTree } from './models.js';
import { sfx } from './audio.js';
import { spawnPickup } from './world.js';

const AXIS = new THREE.Vector3();

// Trees along the edges of the garden. While one stands its cell is type 'tree' (no tilling, weeds
// or gadgets; gnomes bump into its trunk). Felled, it leaves a stump (type 'stump') that grows back
// into a tree a few days later, at dawn.
export class Tree {
  constructor(cell) {
    this.cell = cell;
    this.kind = 'tree';
    this.pos = new THREE.Vector3(cell.x + rand(-0.3, 0.3), 0, cell.z + rand(-0.3, 0.3));
    this.radius = TREES.hit;
    this.model = makeTree(Math.random() < 0.55);
    this.model.group.position.copy(this.pos);
    this.model.group.rotation.y = rand(0, Math.PI * 2);
    this.model.group.scale.setScalar(rand(0.8, 1.0));
    this.model.group.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
    G.scene.add(this.model.group);
    this.standing = true; this.regrowDay = 0;
    this.fall = null; // { t, dir } while tipping over
    this.grow = 1; // 0..1 while growing back
    cell.type = 'tree';
    cell.tree = this;
  }

  // One Axe chop: the tree tips over away from the gnome and drops its wood.
  chop(from) {
    if (!this.standing) return;
    this.standing = false;
    this.cell.type = 'stump';
    this.regrowDay = G.day + randi(TREES.regrow[0], TREES.regrow[1]);
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    this.fall = { t: 0, dir: Math.atan2(dx / l, dz / l) };
    for (let i = 0; i < WOOD_DROP; i++) spawnPickup('wood', 1, this.pos.x + (dx / l) * (1 + i * 0.9), this.pos.z + (dz / l) * (1 + i * 0.9));
    G.fx.burst({ x: this.pos.x, y: 1.2, z: this.pos.z }, 0xe0b97a, 16, { speed: 4 });
    G.fx.burst({ x: this.pos.x, y: 3, z: this.pos.z }, 0x4a8f3a, 14, { speed: 3, grav: 4 });
    sfx('thump');
  }

  regrow() {
    if (this.standing) return;
    this.standing = true;
    this.cell.type = 'tree';
    this.grow = 0;
    this.model.top.visible = true;
    this.model.top.rotation.set(0, 0, 0);
  }

  update(dt) {
    const top = this.model.top;
    if (this.fall) {
      // tip over around the stump (rotate in the fall direction), then vanish
      const f = this.fall;
      f.t += dt;
      const a = Math.min(Math.PI / 2, f.t * f.t * 3.2);
      const d = f.dir - this.model.group.rotation.y; // fall direction in the tree's own frame
      top.setRotationFromAxisAngle(AXIS.set(Math.cos(d), 0, -Math.sin(d)), a);
      if (f.t > 1.2) { top.visible = false; this.fall = null; }
    } else if (this.grow < 1) {
      this.grow = Math.min(1, this.grow + dt * 0.5);
      top.scale.setScalar(0.2 + 0.8 * this.grow);
    }
  }
}

// Plant TREES.count trees on free grass along the east, west and south edges, away from the pond,
// the spigot and the market, and spread apart.
export function plantTrees() {
  const w = G.world;
  const spots = [];
  for (const c of w.cells) {
    const edge = c.i === 2 || c.i === GRID - 3 || c.j === GRID - 3;
    if (!edge || c.type !== 'grass' || c.z < -8) continue;
    if (Math.hypot(c.x - POND.x, c.z - POND.z) < POND.r + 3 || Math.hypot(c.x - SPIGOT.x, c.z - SPIGOT.z) < 3) continue;
    spots.push(c);
  }
  spots.sort(() => Math.random() - 0.5);
  const trees = [];
  for (const c of spots) {
    if (trees.length >= TREES.count) break;
    if (trees.some((t) => dist2(t.cell, c) < 4.5)) continue;
    if (c.weed) w.removeWeed(c);
    trees.push(new Tree(c));
  }
  return trees;
}

// At dawn, stumps whose time has come grow back (unless someone's standing right on it).
export function regrowTrees() {
  for (const t of G.trees) {
    if (t.standing || G.day < t.regrowDay) continue;
    if (G.slots.some((p) => p && p.active && dist2(p.pos, t.pos) < 1)) continue;
    t.regrow();
  }
}
