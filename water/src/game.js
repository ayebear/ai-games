import * as THREE from 'three';
import { River } from './river.js';
import { World, Confetti } from './world.js';
import { Raft, RAFT_HX, RAFT_HZ } from './raft.js';
import { Player, R as PR } from './player.js';
import { Water } from './water.js';
import { Input } from './input.js';
import { Hud, fmt } from './hud.js';
import { Sound } from './audio.js';

const STEP = 1 / 120;
const SLOTS = [[-0.55, -0.5], [0.55, -0.5], [-1.5, -0.5], [1.5, -0.5]];
const store = {
  get(k, d) { try { const v = localStorage.getItem('jetraft.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('jetraft.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export class Game {
  constructor(container) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);
    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });

    this.world = new World(this.scene);
    this.raft = new Raft(this.scene);
    this.water = new Water(this.scene);
    this.confetti = new Confetti(this.scene);
    this.input = new Input();
    this.hud = new Hud();
    this.sound = new Sound();
    this.players = [];
    this.paused = false;
    this.t = 0;
    this.shake = 0;
    this.camF = [0, 1]; this.camR = [-1, 0];
    this.camDir = new THREE.Vector2(1, 0);

    this.unlocked = store.get('unlocked', 1);
    const q = new URLSearchParams(location.search);
    const ql = parseInt(q.get('level'), 10);
    if (ql > 0) this.unlocked = Math.max(this.unlocked, ql);
    this.level = ql > 0 ? ql : this.unlocked;
    this.loadLevel(this.level);
    this.state = 'title';
    this.snapCamera();

    // debug / testing hooks
    window.game = this;
    this.bots = q.has('bot');
    if (q.has('autojoin')) {
      const n = Math.min(4, parseInt(q.get('autojoin'), 10) || 1);
      for (let i = 0; i < n; i++) this.addPlayer('auto' + i);
      if (q.has('play')) this.startCountdown();
    }

    this.last = performance.now();
    this.acc = 0;
    renderer.setAnimationLoop((now) => this.frame(now));
  }

  bestTime(l) { return store.get('best.' + l, null); }

  // ----------------------------------------------------------- level flow
  loadLevel(L) {
    if (this.river) { this.scene.remove(this.river.group); this.river.dispose(); }
    this.level = L;
    this.river = new River(L);
    this.scene.add(this.river.buildMesh());
    this.world.buildDecor(this.river);
    this.checkpoint = this.river.startIndex;
    this.nextCheckpoint = 0;
    this.time = 0;
    this.resetToCheckpoint();
  }

  resetToCheckpoint() {
    this.water.clear();
    this.raft.placeAt(this.river, this.checkpoint);
    this.players.forEach((p, k) => {
      const [lx, lz] = SLOTS[p.slot];
      p.placeOnRaft(this.raft, lx, lz);
      p.hint = this.raft.hint;
      p.tank = Math.max(p.tank, 0.6);
      p.group.visible = true;
    });
  }

  startCountdown(sec = 3) {
    this.state = 'countdown';
    this.cd = sec;
    this.cdShown = Math.ceil(sec) + 1;
  }

  addPlayer(device) {
    if (this.players.length >= 4) return;
    let slot = 0;
    while (this.players.some((p) => p.slot === slot)) slot++;
    const p = new Player(slot, device, this.scene);
    p.hint = this.raft.hint;
    this.players.push(p);
    this.players.sort((a, b) => a.slot - b.slot);
    if (this.state === 'title' || this.state === 'countdown') {
      p.placeOnRaft(this.raft, SLOTS[slot][0], SLOTS[slot][1]);
      p.squash = 0.8;
    } else p.dropIn(this.raft);
    this.hud.showToast(`<span style="color:${p.color}">${p.name}</span> joined!`);
    this.sound.join();
  }

  removePlayer(p) {
    this.water.splash(p.x, p.y + 0.5, p.z, 20, 4);
    p.dispose();
    this.players = this.players.filter((q) => q !== p);
    this.sound.setPlayer(p.slot, 0, 0);
    this.hud.showToast(`<span style="color:${p.color}">${p.name}</span> left`);
    this.sound.leave();
    if (this.players.length === 0 && this.state !== 'title') this.toTitle();
  }

  toTitle() {
    this.paused = false;
    this.state = 'title';
    this.confetti.clear();
    this.loadLevel(this.level);
    this.sound.silence();
  }

  changeLevel(d) {
    const L = Math.max(1, Math.min(this.unlocked, this.level + d));
    if (L === this.level) return;
    this.loadLevel(L);
    this.snapCamera();
    this.sound.blip(600 + L * 20, 0.08, 'triangle', 0.15);
  }

  win() {
    this.state = 'win';
    this.winT = 0;
    const best = this.bestTime(this.level);
    const newBest = !best || this.time < best;
    if (newBest) store.set('best.' + this.level, this.time);
    if (this.level + 1 > this.unlocked) { this.unlocked = this.level + 1; store.set('unlocked', this.unlocked); }
    this.hud.showCenter(`<div class="big">Level ${this.level} cleared!</div><div>${fmt(this.time)}${newBest ? ' · <b>New best!</b>' : ''}</div><div class="small">Press A for the next river</div>`, 999, 'win');
    this.sound.win();
    const r = this.raft;
    this.confetti.burst(r.x, r.y + 3, r.z, 250);
  }

  onPlayerFell(p) {
    this.hud.showToast(`<span style="color:${p.color}">${p.name}</span> fell off the sky river! ☁`);
    this.sound.fall();
  }

  // ----------------------------------------------------------- input
  handleInput() {
    const devs = this.input.poll();
    for (const dev of devs) {
      const p = this.players.find((q) => q.device === dev.id);
      if (dev.startP) {
        if (this.paused) this.paused = false;
        else if (p) { this.removePlayer(p); continue; }
        else if (this.players.length < 4) { this.addPlayer(dev.id); continue; }
      }
      if (this.paused) {
        if (dev.aP) this.paused = false;
        else if (dev.bP) this.toTitle();
        continue;
      }
      if (dev.backP && p && this.state !== 'title') { this.paused = true; continue; }
      if (this.state === 'title') {
        if (dev.leftP) this.changeLevel(-1);
        if (dev.rightP) this.changeLevel(1);
        if (dev.aP && this.players.length) { this.startCountdown(); dev.aP = false; this.sound.init(); }
      } else if (this.state === 'win') {
        if (dev.aP && this.winT > 1.2 && p) {
          this.hud.center.classList.remove('show');
          this.confetti.clear();
          this.loadLevel(this.level + 1);
          this.snapCamera();
          this.startCountdown();
          dev.aP = false;
        }
      }
      if (p) p.control(dev, this.camF, this.camR, this.state !== 'title');
    }
    // test bots (?autojoin=N&bot): blast forward, refill at the edges
    for (const p of this.players) {
      if (!p.device.startsWith('auto')) continue;
      const bot = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, aP: false };
      if (this.bots) {
        if (p.botRefill) {
          const side = p.lx > 0 ? -1 : 1; // local +x is screen-left
          bot.lx = side; bot.rx = side; bot.lt = 1;
          if (p.tank > 0.9) p.botRefill = false;
        } else {
          bot.ry = -1; bot.rt = 1;
          if (p.tank < 0.1) p.botRefill = true;
        }
      }
      p.control(bot, this.camF, this.camR, false);
    }
  }

  // ----------------------------------------------------------- simulation
  step(dt) {
    const raft = this.raft, st = this.state;
    const mode = st === 'title' || st === 'countdown' ? 'held' : st === 'win' ? 'brake' : 'free';
    raft.step(dt, this.river, mode);
    for (const p of this.players) p.step(dt, this);
    this.collidePlayers();
    this.water.step(dt, this);

    if (raft.landing > 0) {
      const v = raft.landing;
      raft.landing = 0;
      for (const p of this.players) {
        if (p.state !== 'raft') continue;
        const a = Math.random() * Math.PI * 2, s = v * (0.15 + Math.random() * 0.25);
        p.rvx += Math.cos(a) * s; p.rvz += Math.sin(a) * s;
        p.knock = 0.35; p.squash = 0.9;
      }
      this.shake = Math.min(1, v / 10);
      this.water.splash(raft.x, raft.y, raft.z, 40, 6);
      this.sound.splash(1);
    }
    if (raft.bump > 0.4) { this.sound.bonk(raft.bump / 3); this.shake = Math.max(this.shake, Math.min(0.5, raft.bump / 8)); }
    raft.bump = 0;

    // cosmetic tilt from where everyone stands
    let tx = 0, tz = 0;
    for (const p of this.players) if (p.state === 'raft') { tx += p.lz; tz -= p.lx; }
    raft.tiltX += (tx * 0.012 - raft.tiltX) * Math.min(1, dt * 4);
    raft.tiltZ += (tz * 0.012 - raft.tiltZ) * Math.min(1, dt * 4);

    if (st === 'countdown') {
      this.cd -= dt;
      const show = Math.ceil(this.cd);
      if (show !== this.cdShown) {
        this.cdShown = show;
        if (show > 0) { this.hud.showCenter(`<div class="count">${show}</div>`, 0.9); this.sound.tick(); }
      }
      if (this.cd <= 0) {
        this.state = 'play';
        this.hud.showCenter('<div class="count go">GO!</div>', 0.9);
        this.sound.tick(true);
      }
    } else if (st === 'play') {
      this.time += dt;
      if (raft.state === 'fall') {
        this.state = 'fail';
        this.failT = 0;
        this.hud.showCenter('<div class="big">Whoooaaa!</div><div>The raft fell off the sky river</div>', 2.4, 'fail');
        this.sound.fail();
      } else {
        const s = raft.info.s;
        const cps = this.river.checkpoints;
        while (this.nextCheckpoint < cps.length && s >= cps[this.nextCheckpoint]) {
          this.checkpoint = cps[this.nextCheckpoint];
          this.nextCheckpoint++;
          this.hud.showCenter('<div class="big">Checkpoint!</div>', 1.5);
          this.sound.checkpoint();
          this.confetti.burst(raft.x, raft.y + 2, raft.z, 60);
        }
        if (s >= this.river.endS) this.win();
      }
    } else if (st === 'fail') {
      this.failT += dt;
      if (this.failT > 2.4) {
        this.resetToCheckpoint();
        this.snapCamera();
        this.startCountdown(2);
      }
    } else if (st === 'win') {
      this.winT += dt;
      if (Math.random() < dt * 3) this.confetti.burst(raft.x + (Math.random() - 0.5) * 8, raft.y + 5, raft.z + (Math.random() - 0.5) * 8, 20);
    }
  }

  collidePlayers() {
    const ps = this.players;
    for (let a = 0; a < ps.length; a++) {
      const p = ps[a];
      if (p.state === 'respawn') continue;
      for (let b = a + 1; b < ps.length; b++) {
        const q = ps[b];
        if (q.state === 'respawn') continue;
        const dx = q.x - p.x, dz = q.z - p.z, dy = q.y - p.y;
        if (Math.abs(dy) > 0.9) continue;
        const d = Math.hypot(dx, dz), min = PR * 2;
        if (d >= min || d < 1e-5) continue;
        const nx = dx / d, nz = dz / d, push = (min - d) / 2;
        this.nudge(p, -nx * push, -nz * push);
        this.nudge(q, nx * push, nz * push);
      }
    }
  }

  nudge(p, dx, dz) {
    p.x += dx; p.z += dz;
    if (p.state === 'raft') {
      [p.lx, p.lz] = this.raft.toLocal(p.x, p.z);
      p.lx = Math.max(-RAFT_HX, Math.min(RAFT_HX, p.lx));
      p.lz = Math.max(-RAFT_HZ, Math.min(RAFT_HZ, p.lz));
      [p.x, p.z] = this.raft.toWorld(p.lx, p.lz);
    }
  }

  // ----------------------------------------------------------- camera / render
  cameraTarget() {
    const r = this.raft, river = this.river;
    const i0 = r.hint;
    let dx = 0, dz = 0;
    for (let i = i0; i < Math.min(river.n, i0 + 14); i++) { dx += river.tx[i]; dz += river.tz[i]; }
    const l = Math.hypot(dx, dz) || 1;
    let fx = r.x, fy = r.y, fz = r.z, spread = 0;
    const live = this.players.filter((p) => p.state !== 'respawn' && p.y > r.y - 6);
    if (live.length) {
      let ax = 0, az = 0;
      for (const p of live) { ax += p.x; az += p.z; spread = Math.max(spread, Math.hypot(p.x - r.x, p.z - r.z)); }
      ax /= live.length; az /= live.length;
      fx = r.x * 0.7 + ax * 0.3; fz = r.z * 0.7 + az * 0.3;
    }
    if (r.state === 'fall') fy = Math.max(r.y, this.fallY ?? r.y);
    return { dx: dx / l, dz: dz / l, fx, fy, fz, spread };
  }

  snapCamera() {
    const t = this.cameraTarget();
    this.camDir.set(t.dx, t.dz);
    this.camFocus = new THREE.Vector3(t.fx, t.fy, t.fz);
    this.camDist = 1;
    this.placeCamera(0);
  }

  placeCamera(dt) {
    const t = this.cameraTarget();
    const k = dt ? Math.min(1, dt * 1.6) : 1;
    this.camDir.x += (t.dx - this.camDir.x) * k;
    this.camDir.y += (t.dz - this.camDir.y) * k;
    this.camDir.normalize();
    const kf = dt ? Math.min(1, dt * 5) : 1;
    this.camFocus.x += (t.fx - this.camFocus.x) * kf;
    this.camFocus.y += (t.fy - this.camFocus.y) * kf;
    this.camFocus.z += (t.fz - this.camFocus.z) * kf;
    const wantDist = Math.min(1.5, 1 + Math.max(0, t.spread - 3) * 0.05);
    this.camDist += (wantDist - this.camDist) * (dt ? Math.min(1, dt * 2) : 1);
    const d = this.camDist;
    const title = this.state === 'title';
    const back = (title ? 10 : 11) * d, up = (title ? 6.5 : 8.5) * d;
    const f = this.camFocus, cd = this.camDir;
    const cam = this.camera;
    cam.position.set(f.x - cd.x * back, f.y + up, f.z - cd.y * back);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.6;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    cam.lookAt(f.x + cd.x * 5, f.y + (title ? 2.4 : 0), f.z + cd.y * 5);
    this.camF = [cd.x, cd.y];
    this.camR = [-cd.y, cd.x];
  }

  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    this.handleInput();
    if (!this.paused) {
      this.t += dt;
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 10) { this.step(STEP); this.acc -= STEP; n++; }
      if (n >= 10) this.acc = 0;
      if (this.raft.state !== 'fall') this.fallY = this.raft.y;
    }
    for (const p of this.players) this.sound.setPlayer(p.slot, this.paused ? 0 : p.blast, this.paused ? 0 : p.sipping ? p.suck : p.suck * 0.4);

    if (this.bots && this.t - (this.lastLog || 0) > 2) {
      this.lastLog = this.t;
      const r = this.raft;
      console.log(`[dbg] t=${this.t.toFixed(1)} st=${this.state} s=${r.info.s.toFixed(1)}/${this.river.endS} lat=${r.info.lat.toFixed(2)} hw=${r.info.hw.toFixed(1)} v=${Math.hypot(r.vx, r.vz).toFixed(2)} drops=${this.water.count} ` +
        this.players.map((p) => `${p.name}:${p.state}/${p.tank.toFixed(2)}${p.botRefill ? 'R' : ''}${p.state === 'air' ? `(y${(p.y - r.y).toFixed(1)},vy${p.vy.toFixed(1)},lat${p.info.lat?.toFixed(1)},i${p.hint})` : ''}`).join(' '));
    }
    const t = this.t;
    this.placeCamera(dt);
    this.raft.render(t);
    for (const p of this.players) p.render(t, dt, this);
    this.water.render();
    this.confetti.update(this.paused ? 0 : dt);
    this.river.update(t);
    this.world.update(this.paused ? 0 : dt, t, this.camera, this.raft, this.river);
    this.hud.update(dt, this);
    this.renderer.render(this.scene, this.camera);
  }
}
