import * as THREE from 'three';
import { toon } from './materials.js';

const MAX = 4000;
const JET_RATE = 45;          // droplets / second at full blast
const DROP_VOL = 1 / 450;     // tank units per droplet (10 s of full blast per tank)
const JET_SPEED = 13;
const SUCK_RANGE = 4.5;
const SUCK_COS = Math.cos((58 * Math.PI) / 180);
const HIT_K = 0.045;

// kinds
const JET = 0, DECOR = 1, INTAKE = 2;

/**
 * Every water droplet is simulated: jets push players, and pumps can suck
 * droplets out of the air (so water can be chained player to player).
 */
export class Water {
  constructor(scene) {
    this.px = new Float32Array(MAX); this.py = new Float32Array(MAX); this.pz = new Float32Array(MAX);
    this.vx = new Float32Array(MAX); this.vy = new Float32Array(MAX); this.vz = new Float32Array(MAX);
    this.age = new Float32Array(MAX); this.life = new Float32Array(MAX);
    this.owner = new Int8Array(MAX); this.kind = new Uint8Array(MAX);
    this.vol = new Float32Array(MAX); this.hint = new Int32Array(MAX); this.size = new Float32Array(MAX);
    this.count = 0;
    this.info = {};
    const geo = new THREE.IcosahedronGeometry(0.13, 1);
    this.mesh = new THREE.InstancedMesh(geo, toon('#9fe9ff', { emissive: new THREE.Color('#3aa0e0'), emissiveIntensity: 0.35 }), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  clear() { this.count = 0; }

  spawn(kind, x, y, z, vx, vy, vz, owner, vol, life, size, hint) {
    if (this.count >= MAX) return;
    const i = this.count++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.kind[i] = kind; this.owner[i] = owner; this.vol[i] = vol;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size; this.hint[i] = hint;
  }

  kill(i) {
    const j = --this.count;
    if (i === j) return;
    this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
    this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
    this.kind[i] = this.kind[j]; this.owner[i] = this.owner[j]; this.vol[i] = this.vol[j];
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.size[i] = this.size[j]; this.hint[i] = this.hint[j];
  }

  splash(x, y, z, n, spd = 3) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.6);
      this.spawn(DECOR, x, y + 0.05, z, Math.cos(a) * s * 0.6, s * (0.8 + Math.random()), Math.sin(a) * s * 0.6, -1, 0, 0.9, 0.35 + Math.random() * 0.3, -1);
    }
  }

  /** Visual of river water being slurped into the pump. */
  intake(p, nx, nz, dt) {
    p.intakeAcc += dt * 30 * p.suck;
    while (p.intakeAcc >= 1) {
      p.intakeAcc -= 1;
      const r = 0.6 + Math.random() * 1.2, a = (Math.random() - 0.5) * 1.6;
      const fx = p.fwdX, fz = p.fwdZ;
      const ox = fx * Math.cos(a) - fz * Math.sin(a), oz = fz * Math.cos(a) + fx * Math.sin(a);
      const y = p.state === 'water' ? p.y + 0.2 : p.y - 0.45;
      this.spawn(INTAKE, nx + ox * r, y, nz + oz * r, 0, 0, 0, p.slot, 0, 0.5, 0.4 + Math.random() * 0.3, -1);
    }
  }

  /** Fire the rear jet. */
  emit(p, dt, g) {
    if (p.blast <= 0 || p.state === 'respawn') { p.emitAcc = 0; return; }
    p.emitAcc += JET_RATE * p.blast * dt;
    const fx = p.fwdX, fz = p.fwdZ;
    const air = p.state === 'air';
    const dx = air ? -fx * 0.62 : -fx, dy = air ? -0.78 : 0.06, dz = air ? -fz * 0.62 : -fz;
    const [pvx, pvy, pvz] = p.worldVel(g.raft);
    while (p.emitAcc >= 1 && p.tank > 0) {
      p.emitAcc -= 1;
      p.tank = Math.max(0, p.tank - DROP_VOL);
      const sp = JET_SPEED * (0.92 + Math.random() * 0.16);
      const j = 0.7;
      this.spawn(JET,
        p.x - fx * 0.62 + (Math.random() - 0.5) * 0.08, p.y + 0.32 + (Math.random() - 0.5) * 0.08, p.z - fz * 0.62,
        pvx + dx * sp + (Math.random() - 0.5) * j, pvy * 0.5 + dy * sp + (Math.random() - 0.5) * j, pvz + dz * sp + (Math.random() - 0.5) * j,
        p.slot, DROP_VOL, 3.5, 0.85 + Math.random() * 0.35, p.hint);
    }
  }

  step(dt, g) {
    const players = g.players;
    const raft = g.raft, river = g.river;
    for (const p of players) this.emit(p, dt, g);

    const suckers = [];
    for (const p of players) {
      if (p.state === 'respawn' || p.suck < 0.05) continue;
      suckers.push({ p, x: p.x + p.fwdX * 0.65, y: p.y + 0.3, z: p.z + p.fwdZ * 0.65, fx: p.fwdX, fz: p.fwdZ, s: p.suck });
    }
    const live = players.filter((p) => p.state !== 'respawn');
    const raftOK = raft.state !== 'fall';
    const deck = raft.deckY;
    const info = this.info;

    for (let i = this.count - 1; i >= 0; i--) {
      const age = (this.age[i] += dt);
      if (age > this.life[i]) { this.kill(i); continue; }
      const kind = this.kind[i];

      if (kind === INTAKE) {
        const p = players.find((q) => q.slot === this.owner[i]);
        if (!p || p.state === 'respawn') { this.kill(i); continue; }
        const tx = p.x + p.fwdX * 0.7, ty = p.y + 0.32, tz = p.z + p.fwdZ * 0.7;
        const k = Math.min(1, dt * 9);
        this.px[i] += (tx - this.px[i]) * k;
        this.py[i] += (ty - this.py[i]) * k + Math.sin(age * 20) * 0.01;
        this.pz[i] += (tz - this.pz[i]) * k;
        const d = Math.hypot(tx - this.px[i], ty - this.py[i], tz - this.pz[i]);
        if (d < 0.12) this.kill(i);
        continue;
      }

      let vx = this.vx[i], vy = this.vy[i], vz = this.vz[i];
      let x = this.px[i], y = this.py[i], z = this.pz[i];
      vy -= (kind === JET ? 15 : 18) * dt;

      if (kind === JET) {
        // pumps pull in droplets from the air
        let absorbed = false;
        for (const s of suckers) {
          if (s.p.slot === this.owner[i] && age < 0.5) continue;
          const ex = x - s.x, ey = y - s.y, ez = z - s.z;
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 > SUCK_RANGE * SUCK_RANGE) continue;
          const d = Math.sqrt(d2) || 1e-4;
          if (d < 0.5) {
            s.p.tank = Math.min(1, s.p.tank + this.vol[i]);
            absorbed = true;
            break;
          }
          if (ex * s.fx + ez * s.fz < SUCK_COS * d) continue;
          const a = (25 + 70 * (1 - d / SUCK_RANGE)) * s.s * dt;
          vx -= (ex / d) * a; vy -= (ey / d) * a; vz -= (ez / d) * a;
          const damp = Math.exp(-2.5 * dt * s.s);
          vx *= damp; vy *= damp; vz *= damp;
          vy += 15 * dt * s.s; // cancel gravity while in the stream
        }
        if (absorbed) { this.kill(i); continue; }
      }

      const drag = Math.exp(-0.35 * dt);
      vx *= drag; vz *= drag;
      x += vx * dt; y += vy * dt; z += vz * dt;

      if (kind === JET) {
        // hit players
        let hit = false;
        for (const p of live) {
          if (p.slot === this.owner[i] && age < 0.35) continue;
          const ex = x - p.x, ey = y - (p.y + 0.42), ez = z - p.z;
          if (ex * ex + ey * ey + ez * ez < 0.3) {
            const [pvx, pvy, pvz] = p.worldVel(raft);
            p.hit((vx - pvx) * HIT_K, (vy - pvy) * HIT_K * 0.5 + 0.05, (vz - pvz) * HIT_K);
            p.wet = 0.3;
            if (Math.random() < 0.35) this.splash(x, y, z, 1, 2);
            hit = true;
            break;
          }
        }
        if (hit) { this.kill(i); continue; }
      }

      // skim across the raft deck
      if (raftOK && y < deck + 0.02 && y > raft.y - 0.3) {
        const [lx, lz] = raft.toLocal(x, z);
        if (raft.inside(lx, lz)) {
          if (kind === DECOR) { this.kill(i); continue; }
          y = deck + 0.02;
          vy = Math.abs(vy) * 0.15;
          const f = Math.exp(-1.6 * dt);
          vx *= f; vz *= f;
        }
      }

      const inf = river.locate(x, z, this.hint[i], info);
      this.hint[i] = inf.i;
      if (Math.abs(inf.lat) < inf.hw && y < inf.y && y > inf.y - 1.2) {
        if (kind === JET && Math.random() < 0.25) this.splash(x, inf.y, z, 1, 2);
        this.kill(i);
        continue;
      }
      if (y < inf.y - 40) { this.kill(i); continue; }

      this.px[i] = x; this.py[i] = y; this.pz[i] = z;
      this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    }
  }

  render() {
    const arr = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.count; i++) {
      const t = this.age[i] / this.life[i];
      let s = this.size[i];
      if (this.kind[i] === JET) s *= 1 - t * 0.35;
      else if (this.kind[i] === DECOR) s *= 1 - t;
      const o = i * 16;
      arr[o] = s; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = s; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = s; arr[o + 11] = 0;
      arr[o + 12] = this.px[i]; arr[o + 13] = this.py[i]; arr[o + 14] = this.pz[i]; arr[o + 15] = 1;
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
