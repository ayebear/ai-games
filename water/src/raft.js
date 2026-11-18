import * as THREE from 'three';
import { toon } from './materials.js';

export const RAFT_HX = 2.0; // half width  (local x)
export const RAFT_HZ = 1.7; // half length (local z, forward)
export const DECK = 0.5;
const G = 22;
const RAIL_R = 2.3;

export class Raft {
  constructor(scene) {
    this.mass = 10;
    this.I = (this.mass * (RAFT_HX * RAFT_HX + RAFT_HZ * RAFT_HZ)) / 3;
    this.info = {};
    this.group = this.buildModel();
    scene.add(this.group);
    this.x = this.y = this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.yaw = 0; this.w = 0;
    this.fx = this.fz = this.tq = 0;
    this.tiltX = 0; this.tiltZ = 0;
    this.axes();
  }

  placeAt(river, i) {
    this.x = river.px[i]; this.z = river.pz[i]; this.y = river.py[i];
    this.yaw = Math.atan2(river.tx[i], river.tz[i]);
    this.vx = this.vz = this.vy = 0; this.w = 0;
    this.fx = this.fz = this.tq = 0;
    this.state = 'float';
    this.hint = i;
    this.fallT = 0; this.roll = 0; this.rollRate = 0;
    this.landing = 0; this.bump = 0;
    this.axes();
    river.locate(this.x, this.z, this.hint, this.info);
  }

  axes() {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.axX = c; this.axZ = -s; // local +x in world
    this.azX = s; this.azZ = c;  // local +z in world (forward)
  }
  toLocal(px, pz) {
    const dx = px - this.x, dz = pz - this.z;
    return [dx * this.axX + dz * this.axZ, dx * this.azX + dz * this.azZ];
  }
  toWorld(lx, lz) {
    return [this.x + lx * this.axX + lz * this.azX, this.z + lx * this.axZ + lz * this.azZ];
  }
  pointVel(px, pz) {
    return [this.vx + this.w * (pz - this.z), this.vz - this.w * (px - this.x)];
  }
  applyForce(fx, fz, px, pz) {
    this.fx += fx; this.fz += fz;
    this.tq += (pz - this.z) * fx - (px - this.x) * fz;
  }
  applyImpulse(jx, jz, px, pz) {
    this.vx += jx / this.mass; this.vz += jz / this.mass;
    this.w += ((pz - this.z) * jx - (px - this.x) * jz) / this.I;
  }
  get deckY() { return this.y + DECK; }
  inside(lx, lz, m = 0) { return Math.abs(lx) <= RAFT_HX + m && Math.abs(lz) <= RAFT_HZ + m; }

  /** mode: 'held' (pinned at start), 'brake' (slowing after the finish), or 'free' */
  step(dt, river, mode = 'free') {
    if (mode === 'held') {
      this.vx = this.vz = this.vy = this.w = 0;
      this.fx = this.fz = this.tq = 0;
      const inf = river.locate(this.x, this.z, this.hint, this.info);
      this.hint = inf.i;
      this.y = inf.y;
      return;
    }
    if (this.state === 'fall') {
      this.vy -= G * dt;
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      this.yaw += this.w * dt;
      this.roll += this.rollRate * dt;
      this.fallT += dt;
      this.fx = this.fz = this.tq = 0;
      this.axes();
      return;
    }

    let inf = river.locate(this.x, this.z, this.hint, this.info);
    if (mode === 'brake') {
      const d = Math.exp(-1.6 * dt);
      this.vx *= d; this.vz *= d; this.w *= d;
    } else {
      const [fx, fz] = river.flow(inf);
      const k = 0.75;
      this.vx += ((fx - this.vx) * k + this.fx / this.mass) * dt;
      this.vz += ((fz - this.vz) * k + this.fz / this.mass) * dt;
      this.w += (this.tq / this.I) * dt;
      this.w *= Math.exp(-1.1 * dt);
    }
    this.fx = this.fz = this.tq = 0;
    this.x += this.vx * dt; this.z += this.vz * dt; this.yaw += this.w * dt;
    this.axes();

    inf = river.locate(this.x, this.z, this.hint, this.info);
    this.hint = inf.i;

    // vertical: ride the surface, go airborne over waterfalls
    const sy = inf.y;
    if (this.y > sy + 0.001) {
      this.vy -= G * dt;
      this.y += this.vy * dt;
      if (this.y <= sy) {
        if (this.vy < -5) this.landing = -this.vy;
        this.y = sy; this.vy = 0;
      }
    } else { this.y = sy; this.vy = 0; }

    // magic guard rails
    const lat = inf.lat, hw = inf.hw;
    if (inf.railL && lat > hw - RAIL_R) this.railBounce(inf, lat - (hw - RAIL_R), 1);
    if (inf.railR && lat < -(hw - RAIL_R)) this.railBounce(inf, -(hw - RAIL_R) - lat, -1);

    // off the edge of the sky river!
    if (Math.abs(lat) > hw + 0.2 && !inf.beyond) {
      this.state = 'fall';
      this.rollRate = Math.sign(lat) * -1.2;
      this.vy = 0;
      return;
    }

    // rocks
    for (const r of river.rocks) {
      if (Math.abs(r.s - inf.s) > 8) continue;
      this.collideRock(r);
    }
  }

  railBounce(inf, pen, side) {
    const nx = inf.nx * side, nz = inf.nz * side;
    this.x -= nx * pen; this.z -= nz * pen;
    const vn = this.vx * nx + this.vz * nz;
    if (vn > 0) {
      this.vx -= 1.5 * vn * nx; this.vz -= 1.5 * vn * nz;
      this.bump = Math.max(this.bump, vn);
    }
  }

  collideRock(r) {
    const [lx, lz] = this.toLocal(r.x, r.z);
    const cx = Math.max(-RAFT_HX, Math.min(RAFT_HX, lx));
    const cz = Math.max(-RAFT_HZ, Math.min(RAFT_HZ, lz));
    let dx = lx - cx, dz = lz - cz;
    let dist = Math.hypot(dx, dz);
    const rr = r.r * 0.9;
    if (dist >= rr) return;
    if (dist < 1e-4) { dx = 0; dz = lz >= 0 ? 1 : -1; dist = 0; } else { dx /= dist; dz /= dist; }
    // normal (raft -> rock) in world
    const nx = dx * this.axX + dz * this.azX;
    const nz = dx * this.axZ + dz * this.azZ;
    const pen = rr - dist;
    this.x -= nx * pen; this.z -= nz * pen;
    const [wx, wz] = this.toWorld(cx, cz);
    const rx = wx - this.x, rz = wz - this.z;
    const [pvx, pvz] = this.pointVel(wx, wz);
    const vn = pvx * nx + pvz * nz;
    if (vn <= 0) return;
    const cross = rz * nx - rx * nz;
    const j = (1.4 * vn) / (1 / this.mass + (cross * cross) / this.I);
    this.applyImpulse(-nx * j, -nz * j, wx, wz);
    this.bump = Math.max(this.bump, vn);
  }

  render(t) {
    const g = this.group;
    this.bob = Math.sin(t * 2.2) * 0.04;
    g.position.set(this.x, this.y + this.bob, this.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = this.yaw;
    g.rotation.x = this.tiltX;
    g.rotation.z = this.tiltZ + (this.state === 'fall' ? this.roll : 0);
    this.flag.rotation.y = Math.sin(t * 5) * 0.35 - 0.3;
    this.flag.scale.x = 0.9 + Math.sin(t * 7) * 0.1;
  }

  buildModel() {
    const g = new THREE.Group();
    const logCols = ['#d8955a', '#c47f45', '#d08b4f'];
    const logGeo = new THREE.CylinderGeometry(0.33, 0.33, RAFT_HZ * 2 + 0.2, 12);
    logGeo.rotateX(Math.PI / 2);
    const capGeo = new THREE.CircleGeometry(0.27, 12);
    const capMat = toon('#f3c58f');
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x = -RAFT_HX + 0.33 + (i * (RAFT_HX * 2 - 0.66)) / (n - 1);
      const log = new THREE.Mesh(logGeo, toon(logCols[i % 3]));
      log.position.set(x, 0.17, (i % 2) * 0.12 - 0.06);
      log.castShadow = true; log.receiveShadow = true;
      g.add(log);
      for (const s of [1, -1]) {
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(x, 0.17, log.position.z + s * (RAFT_HZ + 0.101));
        cap.rotation.y = s > 0 ? 0 : Math.PI;
        g.add(cap);
      }
    }
    const ropeMat = toon('#f5e6c4');
    for (const z of [-1.15, 1.15]) {
      const rope = new THREE.Mesh(new THREE.BoxGeometry(RAFT_HX * 2 + 0.1, 0.1, 0.22), ropeMat);
      rope.position.set(0, 0.47, z);
      rope.receiveShadow = true;
      g.add(rope);
    }
    // little flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), toon('#8d5a3b'));
    pole.position.set(-RAFT_HX + 0.25, 1.4, -RAFT_HZ + 0.25);
    pole.castShadow = true;
    g.add(pole);
    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.55, 0, 0.85, -0.27, 0], 3));
    flagGeo.computeVertexNormals();
    this.flag = new THREE.Mesh(flagGeo, toon('#ff6b9d', { side: THREE.DoubleSide }));
    this.flag.position.set(-RAFT_HX + 0.25, 2.45, -RAFT_HZ + 0.25);
    g.add(this.flag);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon('#ffe066'));
    knob.position.set(-RAFT_HX + 0.25, 2.52, -RAFT_HZ + 0.25);
    g.add(knob);
    return g;
  }
}
