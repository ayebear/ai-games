import * as THREE from 'three';
import { CELL, GRID, HALF, FOREST, POND, SOIL, HEART_R } from './config.js';
import { G, rand, clamp } from './state.js';
import { makeWeed, makeItem, mat, BOX, P } from './models.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.cells = [];
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const x = i * CELL - HALF + CELL / 2, z = j * CELL - HALF + CELL / 2;
        let type = 'grass';
        if (i < FOREST || j < FOREST || i >= GRID - FOREST || j >= GRID - FOREST) type = 'forest';
        else if (i >= 12 && i <= 17 && j >= 2 && j <= 5) type = 'solid'; // shop
        else if (i === 18 && j === 5) type = 'solid'; // spigot
        else if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.4) type = 'water';
        else if ((i === 14 || i === 15) && (j === 14 || j === 15)) type = 'solid'; // heart bloom
        this.cells.push({ i, j, x, z, type, soil: 0, wet: 0, plant: null, placeable: null, weed: null, plot: null });
      }
    }
  }

  cell(i, j) { return i < 0 || j < 0 || i >= GRID || j >= GRID ? null : this.cells[j * GRID + i]; }
  cellAt(x, z) { return this.cell(Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)); }

  // Can a gnome stand at x,z (with radius r)?
  walkable(x, z, r = 0.4) {
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
      const c = this.cellAt(x + dx, z + dz);
      if (!c || c.type === 'forest' || c.type === 'solid' || c.type === 'water') return false;
      if (c.placeable && c.placeable.def.blocks) return false;
    }
    if (Math.hypot(x, z) < HEART_R - 0.2) return false;
    return true;
  }

  // ── Plots ──
  till(c, soil = 0) {
    c.type = 'plot';
    c.soil = soil;
    const m = P(this.scene, BOX(), new THREE.MeshStandardMaterial({ color: SOIL[soil].color, roughness: 1 }), [c.x, 0.05, c.z], [1.86, 0.14, 1.86], [0, 0, 0], false);
    m.receiveShadow = true;
    // little furrows
    for (const dz of [-0.45, 0, 0.45]) P(m, BOX(), mat(0x3b2414), [0, 0.5, dz], [0.95, 0.3, 0.06], [0, 0, 0], false);
    c.plot = m;
    this.refreshPlot(c);
  }

  refreshPlot(c) {
    if (!c.plot) return;
    const col = new THREE.Color(SOIL[c.soil].color);
    col.multiplyScalar(1 - c.wet * 0.45);
    c.plot.material.color.copy(col);
  }

  // ── Weeds ──
  addWeed(c) {
    if (c.weed || c.placeable || (c.type !== 'grass' && c.type !== 'plot')) return false;
    const m = makeWeed();
    const ox = c.plant ? rand(-0.7, -0.5) : rand(-0.4, 0.4), oz = c.plant ? rand(0.5, 0.7) : rand(-0.4, 0.4);
    m.position.set(c.x + ox, 0, c.z + oz);
    m.scale.setScalar(0.1);
    this.scene.add(m);
    c.weed = { mesh: m, grow: 0 };
    return true;
  }
  removeWeed(c) {
    if (!c.weed) return;
    this.scene.remove(c.weed.mesh);
    c.weed = null;
  }

  randomCell(filter, tries = 200) {
    for (let k = 0; k < tries; k++) {
      const c = this.cells[Math.floor(Math.random() * this.cells.length)];
      if (filter(c)) return c;
    }
    return null;
  }

  update(dt) {
    for (const c of this.cells) {
      if (c.weed && c.weed.grow < 1) {
        c.weed.grow = Math.min(1, c.weed.grow + dt * 1.5);
        c.weed.mesh.scale.setScalar(0.1 + c.weed.grow * 0.9);
      }
      if (c.type === 'plot') {
        const before = c.wet;
        const rain = G.weather === 'rain' ? 0.03 : 0;
        c.wet = clamp(c.wet - dt * (G.weather === 'heat' ? 0.03 : 0.015) + rain * dt, 0, 1);
        if (c.plant) c.wet = Math.max(c.wet, clamp((c.plant.water - 0.3) * 1.2, 0, 1));
        if (Math.abs(before - c.wet) > 0.002 || Math.random() < 0.01) this.refreshPlot(c);
      }
    }
  }
}

// ───────────────────────── Ground pickups ─────────────────────────
export function spawnPickup(kind, count, x, z, value = 0, pop = true) {
  const mesh = makeItem(kind);
  mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.scene.add(mesh);
  const p = {
    kind, count, value, mesh,
    pos: new THREE.Vector3(x, pop ? 0.5 : 0, z),
    vel: pop ? new THREE.Vector3(rand(-2, 2), 5, rand(-2, 2)) : new THREE.Vector3(),
    t: Math.random() * 10, life: kind === 'coin' ? 90 : Infinity, dead: false, noPick: pop ? 0.35 : 0,
  };
  // keep inside play area
  p.pos.x = clamp(p.pos.x, -HALF + 4.5, HALF - 4.5);
  p.pos.z = clamp(p.pos.z, -HALF + 4.5, HALF - 4.5);
  G.pickups.push(p);
  return p;
}

export function removePickup(p) {
  p.dead = true;
  G.scene.remove(p.mesh);
}

export function updatePickups(dt) {
  for (const p of G.pickups) {
    if (p.dead) continue;
    p.t += dt;
    p.noPick = Math.max(0, p.noPick - dt);
    if (p.vel.lengthSq() > 0 || p.pos.y > 0) {
      p.vel.y -= 18 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y <= 0) {
        p.pos.y = 0;
        if (Math.abs(p.vel.y) > 2) { p.vel.y *= -0.35; p.vel.x *= 0.5; p.vel.z *= 0.5; }
        else p.vel.set(0, 0, 0);
      }
      const c = G.world.cellAt(p.pos.x, p.pos.z);
      if (!c || c.type === 'water' || c.type === 'solid' || c.type === 'forest' || Math.hypot(p.pos.x, p.pos.z) < HEART_R) {
        p.pos.x -= p.vel.x * dt * 2; p.pos.z -= p.vel.z * dt * 2;
        p.vel.x *= -0.5; p.vel.z *= -0.5;
      }
    }
    const bob = p.kind === 'dew' || p.kind === 'coin' ? Math.sin(p.t * 3) * 0.08 + 0.1 : 0;
    p.mesh.position.set(p.pos.x, p.pos.y + bob, p.pos.z);
    p.mesh.rotation.y += dt * (p.kind === 'coin' ? 3 : 0.8);
    if (p.kind === 'dew' && G.phase === 'day' && G.time > 75) {
      // dew evaporates after mid-day
      p.mesh.scale.multiplyScalar(1 - dt * 0.6);
      if (p.mesh.scale.x < 0.1) removePickup(p);
    }
    p.life -= dt;
    if (p.life <= 0) removePickup(p);
  }
  if (G.pickups.some((p) => p.dead)) G.pickups = G.pickups.filter((p) => !p.dead);
}
