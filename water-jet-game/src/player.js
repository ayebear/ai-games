import * as THREE from 'three';
import { toon } from './materials.js';
import { RAFT_HX, RAFT_HZ } from './raft.js';

export const PLAYER_COLORS = ['#ff6b6b', '#4dabf7', '#69db7c', '#ffd43b'];
export const PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];

const G = 22;
const WALK = 4.6;
const WALK_ACC = 24;     // grip on the deck
const KNOCK_ACC = 9;     // grip while being blasted
const AIR_ACC = 7;
const SWIM = 2.4;
const JUMP = 8.6;
const JUMP_WATER = 9.6;
const JET_RAFT = 15;     // force pushed into the raft
const JET_AIR = 24;
const JET_WATER = 12;
const SUCK_RATE = 0.3;   // tank / second when sucking river water
export const R = 0.42;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Player {
  constructor(slot, device, scene) {
    this.slot = slot;
    this.device = device;
    this.color = PLAYER_COLORS[slot];
    this.name = PLAYER_NAMES[slot];
    this.x = this.y = this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.rvx = this.rvz = 0; // velocity relative to raft (world orientation)
    this.lx = this.lz = 0;   // position in raft space while standing on it
    this.yaw = 0;
    this.state = 'air';
    this.tank = 0.6;
    this.blast = 0; this.suck = 0;
    this.inLt = 0; this.inRt = 0;
    this.mx = this.mz = 0; this.ax = this.az = 0; this.moveMag = 0; this.aimMag = 0;
    this.jumpBuf = 0; this.knock = 0;
    this.hint = -1; this.info = {}; this.tmp = {};
    this.emitAcc = 0; this.intakeAcc = 0;
    this.respawnT = 0;
    this.squash = 0; this.walkPhase = 0;
    this.sipping = false;
    this.falls = 0;
    this.scene = scene;
    this.buildModel(scene);
  }

  get fwdX() { return Math.sin(this.yaw); }
  get fwdZ() { return Math.cos(this.yaw); }

  /** Apply controller state (camera-relative). */
  control(dev, camF, camR, allowJump) {
    const mx = camR[0] * dev.lx + camF[0] * -dev.ly;
    const mz = camR[1] * dev.lx + camF[1] * -dev.ly;
    this.mx = mx; this.mz = mz;
    this.moveMag = Math.hypot(dev.lx, dev.ly);
    this.ax = camR[0] * dev.rx + camF[0] * -dev.ry;
    this.az = camR[1] * dev.rx + camF[1] * -dev.ry;
    this.aimMag = Math.hypot(dev.rx, dev.ry);
    this.inLt = dev.lt;
    this.inRt = dev.rt;
    if (dev.aP && allowJump) this.jumpBuf = 0.15;
  }

  placeOnRaft(raft, lx, lz) {
    this.state = 'raft';
    this.lx = lx; this.lz = lz;
    this.rvx = this.rvz = 0;
    [this.x, this.z] = raft.toWorld(lx, lz);
    this.y = raft.deckY;
    this.yaw = raft.yaw;
    this.knock = 0;
  }

  dropIn(raft) {
    this.state = 'air';
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.8;
    [this.x, this.z] = raft.toWorld(Math.cos(a) * r, Math.sin(a) * r);
    this.y = raft.deckY + 7;
    this.vx = raft.vx; this.vz = raft.vz; this.vy = -2;
    this.tank = Math.max(this.tank, 0.5);
    this.yaw = raft.yaw;
    this.hint = raft.hint;
    this.group.visible = true;
  }

  worldVel(raft) {
    if (this.state === 'raft') {
      const [pvx, pvz] = raft.pointVel(this.x, this.z);
      return [this.rvx + pvx, raft.vy, this.rvz + pvz];
    }
    return [this.vx, this.vy, this.vz];
  }

  hit(dx, dy, dz) {
    if (this.state === 'raft') {
      this.rvx += dx; this.rvz += dz;
      this.knock = 0.45;
    } else if (this.state === 'water') {
      this.vx += dx * 0.6; this.vz += dz * 0.6;
    } else if (this.state === 'air') {
      this.vx += dx; this.vy += dy; this.vz += dz;
    }
  }

  leaveRaft(raft, vy) {
    const [pvx, pvz] = raft.pointVel(this.x, this.z);
    this.vx = this.rvx + pvx;
    this.vz = this.rvz + pvz;
    this.vy = raft.vy + vy;
    this.state = 'air';
  }

  step(dt, g) {
    const raft = g.raft, river = g.river;
    this.knock = Math.max(0, this.knock - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.squash *= Math.exp(-8 * dt);

    if (this.state === 'respawn') {
      this.blast = this.suck = 0;
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.dropIn(raft);
      return;
    }

    // facing: right stick aims, otherwise face where you walk
    let tx = null, tz = 0;
    if (this.aimMag > 0.3) { tx = this.ax; tz = this.az; }
    else if (this.moveMag > 0.15) { tx = this.mx; tz = this.mz; }
    if (tx !== null) {
      const target = Math.atan2(tx, tz);
      this.yaw += wrap(target - this.yaw) * Math.min(1, dt * 14);
    }
    const fx = this.fwdX, fz = this.fwdZ;

    this.blast = this.tank > 0.0005 ? this.inRt : 0;
    this.suck = this.inLt;

    if (this.state === 'raft') this.stepRaft(dt, g, fx, fz);
    else if (this.state === 'air') this.stepAir(dt, g, fx, fz);
    else if (this.state === 'water') this.stepWater(dt, g, fx, fz);

    // sucking river water through the front pump
    this.sipping = false;
    if (this.suck > 0.05 && this.state !== 'respawn') {
      const nx = this.x + fx * 0.8, nz = this.z + fz * 0.8;
      let can = this.state === 'water';
      if (this.state === 'raft') {
        const [lx, lz] = raft.toLocal(nx, nz);
        if (!raft.inside(lx, lz, -0.05)) {
          const inf = river.locate(nx, nz, this.hint, this.tmp);
          can = Math.abs(inf.lat) < inf.hw;
        }
      }
      if (can) {
        this.sipping = true;
        this.tank = Math.min(1, this.tank + this.suck * SUCK_RATE * dt);
        g.water.intake(this, nx, nz, dt);
      }
    }
  }

  stepRaft(dt, g, fx, fz) {
    const raft = g.raft;
    const acc = (this.knock > 0 ? KNOCK_ACC : WALK_ACC) * dt;
    const dvx = this.mx * WALK - this.rvx, dvz = this.mz * WALK - this.rvz;
    const m = Math.hypot(dvx, dvz);
    if (m > acc) { this.rvx += (dvx / m) * acc; this.rvz += (dvz / m) * acc; }
    else { this.rvx += dvx; this.rvz += dvz; }

    // move in raft space
    let dlx = this.rvx * raft.axX + this.rvz * raft.axZ;
    let dlz = this.rvx * raft.azX + this.rvz * raft.azZ;
    this.lx += dlx * dt; this.lz += dlz * dt;
    if (this.moveMag > 0.15) this.walkPhase += Math.hypot(this.rvx, this.rvz) * dt * 3.2;

    if (!raft.inside(this.lx, this.lz)) {
      if (this.knock > 0) {
        [this.x, this.z] = raft.toWorld(this.lx, this.lz);
        this.leaveRaft(raft, 1.5);
        return;
      }
      // walking: stop at the edge (you only fall if you get blasted or jump)
      if (Math.abs(this.lx) > RAFT_HX) { this.lx = Math.sign(this.lx) * RAFT_HX; dlx = 0; }
      if (Math.abs(this.lz) > RAFT_HZ) { this.lz = Math.sign(this.lz) * RAFT_HZ; dlz = 0; }
      this.rvx = dlx * raft.axX + dlz * raft.azX;
      this.rvz = dlx * raft.axZ + dlz * raft.azZ;
    }
    [this.x, this.z] = raft.toWorld(this.lx, this.lz);
    this.y = raft.deckY;
    this.hint = raft.hint;

    if (this.blast > 0) raft.applyForce(fx * JET_RAFT * this.blast, fz * JET_RAFT * this.blast, this.x, this.z);

    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      this.leaveRaft(raft, JUMP);
      this.squash = -0.5;
      g.sound.blip(520, 0.08, 'triangle', 0.15);
    }
  }

  stepAir(dt, g, fx, fz) {
    const raft = g.raft, river = g.river;
    this.vy -= G * dt;
    if (this.blast > 0) {
      const a = JET_AIR * this.blast * dt;
      this.vx += fx * a * 0.62; this.vz += fz * a * 0.62; this.vy += a * 0.78;
    }
    this.vx += this.mx * AIR_ACC * dt; this.vz += this.mz * AIR_ACC * dt;
    const drag = Math.exp(-0.35 * dt);
    this.vx *= drag; this.vz *= drag;
    const py = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;

    // land on the raft
    const deck = raft.deckY;
    let [lx, lz] = raft.toLocal(this.x, this.z);
    if (this.vy <= raft.vy && this.y <= deck && py >= deck - 0.4 && raft.inside(lx, lz, 0.05)) {
      this.state = 'raft';
      this.lx = Math.max(-RAFT_HX, Math.min(RAFT_HX, lx));
      this.lz = Math.max(-RAFT_HZ, Math.min(RAFT_HZ, lz));
      const [pvx, pvz] = raft.pointVel(this.x, this.z);
      this.rvx = (this.vx - pvx) * 0.5; this.rvz = (this.vz - pvz) * 0.5;
      this.y = deck;
      this.squash = Math.min(1, -this.vy / 14);
      this.knock = 0;
      return;
    }
    // bonk into the side of the raft
    if (this.y < deck - 0.05 && this.y > raft.y - 0.8) this.pushOutOfRaft(raft);

    const inf = river.locate(this.x, this.z, this.hint, this.info);
    this.hint = inf.i;
    if ((Math.abs(inf.lat) < inf.hw || inf.beyond) && this.y <= inf.y - 0.1 && py > inf.y - 1.5) {
      this.state = 'water';
      g.water.splash(this.x, inf.y, this.z, 14, 4);
      g.sound.splash(0.5);
      return;
    }
    if (this.y < inf.y - 26 || this.y < raft.y - 30) {
      this.state = 'respawn';
      this.respawnT = 1.4;
      this.group.visible = false;
      this.falls++;
      g.onPlayerFell(this);
    }
  }

  stepWater(dt, g, fx, fz) {
    const raft = g.raft, river = g.river;
    const inf = river.locate(this.x, this.z, this.hint, this.info);
    this.hint = inf.i;
    const [wx, wz] = river.flow(inf);
    let ax = (wx + this.mx * SWIM - this.vx) * 1.8;
    let az = (wz + this.mz * SWIM - this.vz) * 1.8;
    if (this.blast > 0) { ax += fx * JET_WATER * this.blast; az += fz * JET_WATER * this.blast; }
    this.vx += ax * dt; this.vz += az * dt;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.vy = 0;
    this.y = inf.y - 0.25;

    const lat = inf.lat, hw = inf.hw;
    if (inf.railL && lat > hw - R) { this.x -= inf.nx * (lat - hw + R); this.z -= inf.nz * (lat - hw + R); }
    if (inf.railR && lat < -(hw - R)) { this.x += inf.nx * (-(hw - R) - lat); this.z += inf.nz * (-(hw - R) - lat); }
    if (Math.abs(lat) > hw + 0.1 && !inf.beyond) {
      this.state = 'air';
      this.vy = 1;
      return;
    }
    if (raft.state !== 'fall') this.pushOutOfRaft(raft);
    for (const r of river.rocks) {
      if (Math.abs(r.s - inf.s) > 4) continue;
      const dx = this.x - r.x, dz = this.z - r.z, d = Math.hypot(dx, dz), min = r.r + R * 0.8;
      if (d < min && d > 1e-4) { this.x += (dx / d) * (min - d); this.z += (dz / d) * (min - d); }
    }
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      this.state = 'air';
      this.vy = JUMP_WATER;
      this.y = inf.y;
      g.water.splash(this.x, inf.y, this.z, 8, 3);
      g.sound.blip(440, 0.08, 'triangle', 0.15);
    }
  }

  pushOutOfRaft(raft) {
    let [lx, lz] = raft.toLocal(this.x, this.z);
    const ex = RAFT_HX + R - Math.abs(lx), ez = RAFT_HZ + R - Math.abs(lz);
    if (ex <= 0 || ez <= 0) return;
    let nx, nz;
    if (ex < ez) { lx = Math.sign(lx || 1) * (RAFT_HX + R); nx = Math.sign(lx) * raft.axX; nz = Math.sign(lx) * raft.axZ; }
    else { lz = Math.sign(lz || 1) * (RAFT_HZ + R); nx = Math.sign(lz) * raft.azX; nz = Math.sign(lz) * raft.azZ; }
    [this.x, this.z] = raft.toWorld(lx, lz);
    const [pvx, pvz] = raft.pointVel(this.x, this.z);
    const rel = (this.vx - pvx) * nx + (this.vz - pvz) * nz;
    if (rel < 0) { this.vx -= rel * nx; this.vz -= rel * nz; }
  }

  // ------------------------------------------------------------ visuals
  buildModel(scene) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    this.group = g; this.body = body;
    const col = new THREE.Color(this.color);
    const light = col.clone().lerp(new THREE.Color('#ffffff'), 0.55);
    const dark = col.clone().multiplyScalar(0.7);
    const mBody = toon(col);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), mBody);
    torso.scale.set(1, 0.92, 0.95);
    torso.position.y = 0.45;
    torso.castShadow = true;
    body.add(torso);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), toon(light));
    belly.scale.set(1, 0.95, 0.5);
    belly.position.set(0, 0.36, 0.25);
    body.add(belly);

    const white = toon('#ffffff'), black = new THREE.MeshBasicMaterial({ color: '#1e1b2e' });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), white);
      eye.position.set(s * 0.15, 0.6, 0.31);
      eye.scale.z = 0.7;
      body.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), black);
      pupil.position.set(s * 0.15, 0.6, 0.385);
      pupil.scale.z = 0.6;
      body.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      shine.position.set(s * 0.15 - 0.022, 0.628, 0.42);
      body.add(shine);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff9fb8' }));
      cheek.scale.set(1, 0.6, 0.3);
      cheek.position.set(s * 0.27, 0.47, 0.31);
      body.add(cheek);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), toon(dark));
      foot.scale.set(1, 0.55, 1.35);
      foot.position.set(s * 0.17, 0.06, 0.06);
      body.add(foot);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.013, 6, 12, Math.PI), black);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 0.5, 0.4);
    body.add(mouth);

    // leaf sprout
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5), toon('#5aa469'));
    stem.position.set(0, 0.88, 0);
    body.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6), toon('#7ee08a'));
    leaf.scale.set(1.7, 0.3, 0.8);
    leaf.position.set(0.1, 0.96, 0);
    leaf.rotation.z = 0.4;
    body.add(leaf);
    this.leaf = leaf;

    // backpack water tank
    const tankGroup = new THREE.Group();
    tankGroup.position.set(0, 0.5, -0.43);
    body.add(tankGroup);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16, 1, true),
      toon('#e8fbff', { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    tankGroup.add(glass);
    const innerGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.46, 16);
    innerGeo.translate(0, 0.23, 0);
    this.waterLevel = new THREE.Mesh(innerGeo, toon('#3fd0ff', { emissive: new THREE.Color('#1580b8'), emissiveIntensity: 0.5 }));
    this.waterLevel.position.y = -0.23;
    tankGroup.add(this.waterLevel);
    const capMat = toon('#9aa0c3');
    for (const y of [0.26, -0.26]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), capMat);
      cap.position.y = y;
      cap.castShadow = true;
      tankGroup.add(cap);
    }
    // rear jet nozzle
    const nozGeo = new THREE.ConeGeometry(0.1, 0.26, 12);
    nozGeo.rotateX(-Math.PI / 2);
    const noz = new THREE.Mesh(nozGeo, toon('#ff9f43'));
    noz.position.set(0, -0.2, -0.2);
    tankGroup.add(noz);
    this.nozzle = noz;

    // front pump funnel
    const funGeo = new THREE.ConeGeometry(0.17, 0.26, 16, 1, true);
    funGeo.rotateX(-Math.PI / 2);
    this.funnel = new THREE.Mesh(funGeo, toon('#c3f0ff', { side: THREE.DoubleSide }));
    this.funnel.position.set(0, 0.3, 0.56);
    body.add(this.funnel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 18), toon('#ff9f43'));
    rim.position.set(0, 0.3, 0.69);
    body.add(rim);
    this.rim = rim;

    // name tag
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = this.color;
    c.beginPath(); c.roundRect(14, 6, 100, 52, 26); c.fill();
    c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 38px Fredoka, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(this.name, 64, 34);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.tag.scale.set(0.7, 0.35, 1);
    this.tag.position.y = 1.35;
    this.tag.renderOrder = 10;
    g.add(this.tag);

    // ground marker (blob shadow + colour ring)
    const mk = new THREE.Group();
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#1e2a4a', transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    mk.add(blob);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    mk.add(ring);
    mk.renderOrder = 4;
    blob.renderOrder = 4; ring.renderOrder = 4;
    this.marker = mk;
    scene.add(g);
    scene.add(mk);
  }

  render(t, dt, g) {
    const raft = g.raft;
    if (this.state === 'respawn') { this.group.visible = false; this.marker.visible = false; return; }
    this.group.visible = true;
    const bob = this.state === 'raft' ? raft.bob : this.state === 'water' ? Math.sin(t * 3 + this.slot) * 0.06 : 0;
    this.group.position.set(this.x, this.y + bob, this.z);
    this.group.rotation.y = this.yaw;

    const walking = this.state === 'raft' && this.moveMag > 0.15;
    const hop = walking ? Math.abs(Math.sin(this.walkPhase)) * 0.09 : 0;
    this.body.position.y = hop;
    this.body.rotation.z = walking ? Math.sin(this.walkPhase) * 0.1 : Math.sin(t * 2 + this.slot) * 0.03;
    let lean = this.blast * 0.28 - (this.sipping ? 0.15 : 0);
    if (this.state === 'air') lean += 0.1;
    this.body.rotation.x += (lean - this.body.rotation.x) * Math.min(1, dt * 10);
    const s = this.squash;
    this.body.scale.set(1 + s * 0.3, 1 - s * 0.4, 1 + s * 0.3);
    this.waterLevel.scale.y = Math.max(0.001, this.tank);
    const pulse = this.suck > 0.05 ? 1 + Math.sin(t * 35) * 0.12 * this.suck : 1;
    this.funnel.scale.setScalar(pulse);
    this.rim.scale.setScalar(pulse);
    this.nozzle.scale.setScalar(1 + this.blast * (0.2 + Math.sin(t * 40) * 0.08));
    this.leaf.rotation.y = Math.sin(t * 4 + this.slot) * 0.4;

    // marker on whatever is beneath us
    let gy = null;
    const [lx, lz] = raft.toLocal(this.x, this.z);
    if (raft.inside(lx, lz) && this.y >= raft.deckY - 0.1) gy = raft.deckY + raft.bob + 0.03;
    else {
      const inf = g.river.locate(this.x, this.z, this.hint, this.tmp);
      if (Math.abs(inf.lat) < inf.hw && this.y >= inf.y - 0.5) gy = inf.y + 0.05;
    }
    if (gy === null || this.state === 'water') this.marker.visible = false;
    else {
      this.marker.visible = true;
      this.marker.position.set(this.x, gy, this.z);
      const h = Math.max(0, this.y - gy);
      this.marker.scale.setScalar(Math.max(0.4, 1 - h * 0.08));
    }
  }

  dispose() {
    for (const o of [this.group, this.marker]) {
      this.scene.remove(o);
      o.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
        if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
      });
    }
  }
}
