import * as THREE from 'three';
import { CELL, GRID, HALF, FOREST, POND, SOIL, HEART_R, HEART_HIT, SPIGOT_HIT, MARKET, SPIGOT } from './config.js';
import { G, rand, clamp, wx } from './state.js';
import { makeWeed, makeItem, makePickupRing, mat, BOX, P } from './models.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.cells = [];
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const x = i * CELL - HALF + CELL / 2, z = j * CELL - HALF + CELL / 2;
        let type = 'grass';
        if (i < FOREST || j < FOREST || i >= GRID - FOREST || j >= GRID - FOREST) type = 'forest';
        else if (j >= MARKET.j0 && j <= MARKET.j1) {
          const k = MARKET.kiosk;
          if (i >= k.i0 && i <= k.i1 && j >= k.j0 && j <= k.j1) type = 'solid'; // Quick Sell kiosk
          else type = 'market'; // walkable floor; no tilling, weeds or gadgets
        } else if (i >= MARKET.plaza.i0 && i <= MARKET.plaza.i1 && j === MARKET.plaza.j) type = 'plaza'; // in front of the quick-sell counter
        else if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.4) type = 'water';
        else if ((i === 14 || i === 15) && (j === 14 || j === 15)) type = 'fixture'; // heart bloom (round collider below)
        this.cells.push({ i, j, x, z, type, soil: 0, wet: 0, plant: null, placeable: null, weed: null, plot: null, tree: null });
      }
    }
    this.cellAt(SPIGOT.x, SPIGOT.z).type = 'fixture'; // no tilling or gadgets; round collider below
  }

  cell(i, j) { return i < 0 || j < 0 || i >= GRID || j >= GRID ? null : this.cells[j * GRID + i]; }
  cellAt(x, z) { return this.cell(Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)); }

  // Gnome collision. The grid only blocks the forest and the kiosk; everything else uses its real
  // shape. Boxes block movement (walkable); circles push the gnome out sideways (pushOut), so it
  // slides smoothly around round things instead of snagging on them.
  circles() {
    const out = [
      { x: 0, z: 0, r: HEART_HIT * (G.heart?.model.group.scale.x ?? 1) },
      { x: SPIGOT.x, z: SPIGOT.z, r: SPIGOT_HIT },
      { x: POND.x, z: POND.z, r: POND.r - 0.3 },
    ];
    for (const p of G.placeables) if (!p.dead && p.def.blocks && !Array.isArray(p.def.hit)) out.push({ x: p.pos.x, z: p.pos.z, r: p.def.hit ?? 0.6 });
    for (const t of G.trees) if (t.standing) out.push({ x: t.pos.x, z: t.pos.z, r: t.radius });
    return out;
  }
  walkable(x, z, r = 0.4) {
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
      const c = this.cellAt(x + dx, z + dz);
      if (!c || c.type === 'forest' || c.type === 'solid') return false;
    }
    for (const p of G.placeables) {
      const h = p.def.hit;
      if (p.dead || !p.def.blocks || !Array.isArray(h)) continue;
      if (Math.abs(x - p.pos.x) < h[0] / 2 + r && Math.abs(z - p.pos.z) < h[1] / 2 + r) return false;
    }
    return true;
  }
  // Move pos (a Vector3) out of any circle it overlaps.
  pushOut(pos, r = 0.4) {
    for (const c of this.circles()) {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
      if (d >= min) continue;
      const k = d > 1e-4 ? min / d : 0;
      if (k) { pos.x = c.x + dx * k; pos.z = c.z + dz * k; } else pos.z = c.z + min;
    }
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

  // Shovel on an empty plot: back to grass (its soil upgrades are lost).
  untill(c) {
    if (c.type !== 'plot' || c.plant || c.weed || c.placeable) return false;
    if (c.plot) this.scene.remove(c.plot);
    c.plot = null; c.type = 'grass'; c.soil = 0; c.wet = 0;
    return true;
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

  // The weed closest to (x, z) within r, or null. Weeds sit inside their cell, so only the 3×3
  // block of cells around the point can hold one that close (r ≤ CELL).
  weedNear(x, z, r) {
    const c0 = this.cellAt(x, z);
    if (!c0) return null;
    let best = null, bd = r;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = this.cell(c0.i + di, c0.j + dj);
      if (!c || !c.weed) continue;
      const d = Math.hypot(c.weed.mesh.position.x - x, c.weed.mesh.position.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
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
        c.wet = clamp(c.wet - dt * 0.015 * wx('drain') + 0.03 * wx('rain') * dt, 0, 1);
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
  // tools bring their own glowing pad; everything else gets the shared pickup ring
  const ring = kind.startsWith('tool:') ? null : makePickupRing(kind === 'coin' ? 0xffd54f : 0xffffff);
  if (ring) G.scene.add(ring);
  const p = {
    kind, count, value, mesh, ring,
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
  if (p.ring) G.scene.remove(p.ring);
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
    if (p.ring) {
      p.ring.position.set(p.pos.x, 0.05, p.pos.z);
      p.ring.scale.setScalar(0.5 + Math.sin(p.t * 3) * 0.04);
    }
    p.mesh.rotation.y += dt * (p.kind === 'coin' ? 3 : 0.8);
    if (p.kind === 'dew' && G.phase === 'day' && G.time > 75) {
      // dew evaporates after mid-day
      p.mesh.scale.multiplyScalar(1 - dt * 0.6);
      if (p.ring) p.ring.material.opacity = 0.6 * p.mesh.scale.x;
      if (p.mesh.scale.x < 0.1) removePickup(p);
    }
    p.life -= dt;
    if (p.life <= 0) removePickup(p);
  }
  if (G.pickups.some((p) => p.dead)) G.pickups = G.pickups.filter((p) => !p.dead);
}
