import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RNG } from './rng.js';
import { waterMaterial, skirtMaterial } from './shaders.js';
import { toon, colored, jitter } from './materials.js';

export const STEP = 1;
export const MIN_WIDTH = 5.8;

const ADJ = ['Giggly', 'Twisty', 'Bubbly', 'Sparkle', 'Wobbly', 'Misty', 'Rumbly', 'Zippy', 'Dizzy', 'Frothy',
  'Sneaky', 'Tumbly', 'Breezy', 'Whirly', 'Cloudy', 'Rainbow', 'Puffy', 'Snoozy', 'Dreamy', 'Wiggly'];
const NOUN = ['Brook', 'Rapids', 'Ribbon', 'Stream', 'Creek', 'Torrent', 'Run', 'Flume', 'Channel', 'Cascade',
  'Current', 'Squiggle', 'Sluice', 'Noodle'];

const ss = (t) => t * t * (3 - 2 * t);

function smooth(arr, r, passes = 1) {
  let a = arr.slice();
  for (let p = 0; p < passes; p++) {
    const b = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const j = i + k;
        if (j >= 0 && j < a.length) { s += a[j]; c++; }
      }
      b[i] = s / c;
    }
    a = b;
  }
  return a;
}

/**
 * A procedurally generated sky river. Fully determined by the level number,
 * so replaying a level always gives the same course.
 */
export class River {
  constructor(level) {
    this.level = level;
    const rng = new RNG(level * 7919 + 1337);
    const lvl = level - 1;
    const d = Math.min(1, lvl / 12);
    this.diff = d;
    this.name = rng.pick(ADJ) + ' ' + rng.pick(NOUN);

    const length = Math.min(1600, 280 + lvl * 70);
    const baseW = Math.max(8.2, 14 - lvl * 0.5);
    const baseSpeed = Math.min(6.2, 2.6 + lvl * 0.28);
    const kmax = Math.min(0.16, 0.045 + lvl * 0.011);
    const rockDensity = level === 1 ? 0.5 : Math.min(7, 0.5 + lvl * 0.65); // per 100 units
    const railCover = Math.max(0, 1 - lvl * 0.3);
    this.baseSpeed = baseSpeed;

    // ---- build per-sample control arrays from a list of segments ----
    const K = [], WF = [], SF = [], FOAM = [], DY = [], ZONE = [];
    let theta = 0;
    const add = (len, fn) => {
      for (let k = 0; k < len; k++) {
        const t = (k + 0.5) / len;
        const o = fn(t, k, len) || {};
        K.push(o.k || 0);
        WF.push(o.w ?? 1);
        SF.push(o.s ?? 1);
        FOAM.push(o.f || 0);
        DY.push(o.dy || 0);
        ZONE.push(o.z || 0);
        theta += (o.k || 0) * STEP;
      }
    };
    const pickSign = () => (theta > 0.5 ? -1 : theta < -0.5 ? 1 : rng.sign());

    add(36, () => ({ w: 1.3, s: 0.8 }));
    while (K.length < length - 50) {
      const weights = [
        ['straight', 0.22],
        ['bend', 0.36],
        ['scurve', 0.2],
        ['drop', level >= 2 ? 0.09 : 0],
        ['narrow', level >= 3 ? 0.08 : 0],
        ['rapids', level >= 2 ? 0.08 : 0],
      ];
      let tot = 0;
      for (const w of weights) tot += w[1];
      let r = rng.next() * tot, type = 'straight';
      for (const w of weights) { if ((r -= w[1]) <= 0) { type = w[0]; break; } }

      if (type === 'straight') {
        add(Math.round(rng.range(10, 30 - 14 * d)), () => ({}));
      } else if (type === 'bend' || type === 'rapids') {
        const len = Math.round(rng.range(18, 40));
        let pk = pickSign() * kmax * rng.range(0.55, 1);
        const maxTurn = 1.0 + 0.5 * d;
        const turn = (Math.abs(pk) * len * 2) / Math.PI;
        if (turn > maxTurn) pk *= maxTurn / turn;
        const rap = type === 'rapids';
        add(len, (t) => ({ k: pk * Math.sin(Math.PI * t), s: rap ? 1.5 : 1, f: rap ? 0.6 : 0, z: rap ? 3 : 0 }));
      } else if (type === 'scurve') {
        const len = Math.round(rng.range(26, 46));
        const pk = pickSign() * kmax * rng.range(0.5, 0.9);
        add(len, (t) => ({ k: pk * Math.sin(2 * Math.PI * t) }));
      } else if (type === 'drop') {
        const H = rng.range(2.5, 3.5 + 3 * d);
        add(8, () => ({ z: 1 }));
        add(6, (t, k, len) => ({ dy: -H * (ss((k + 1) / len) - ss(k / len)), f: 1, s: 1.7, z: 1 }));
        add(12, (t) => ({ f: 1 - t, s: 1.4, z: 1 }));
      } else if (type === 'narrow') {
        const len = Math.round(rng.range(18, 30));
        add(len, (t) => ({ w: 1 - 0.5 * Math.sin(Math.PI * t), s: 1.15, z: 2 }));
      }
    }
    add(50, () => ({ w: 1.25 }));

    const n = K.length;
    this.n = n;
    const Ks = smooth(K, 3, 2);
    const Ws = smooth(WF, 6, 2);
    const Ss = smooth(SF, 6, 2);
    const Fs = smooth(FOAM, 2, 1);

    const px = (this.px = new Float32Array(n));
    const py = (this.py = new Float32Array(n));
    const pz = (this.pz = new Float32Array(n));
    const tx = (this.tx = new Float32Array(n));
    const tz = (this.tz = new Float32Array(n));
    const w = (this.w = new Float32Array(n));
    const sp = (this.sp = new Float32Array(n));
    const kk = (this.k = new Float32Array(n));
    const foam = (this.foam = new Float32Array(n));
    this.zone = Uint8Array.from(ZONE);
    const ph = rng.range(0, 6.28);
    let x = 0, y = 0, z = 0, th = 0;
    for (let i = 0; i < n; i++) {
      th += Ks[i] * STEP;
      px[i] = x; py[i] = y; pz[i] = z;
      tx[i] = Math.cos(th); tz[i] = Math.sin(th);
      kk[i] = Ks[i];
      w[i] = Math.max(MIN_WIDTH, baseW * Ws[i] * (1 + 0.1 * Math.sin(i * 0.045 + ph)));
      const ramp = Math.min(1, 0.55 + i / 70);
      sp[i] = Math.min(baseSpeed * 1.6, 8.2, baseSpeed * Ss[i] * Math.pow(baseW / w[i], 0.4)) * ramp;
      foam[i] = Math.min(1, Fs[i]);
      x += tx[i] * STEP;
      z += tz[i] * STEP;
      y += -0.02 * STEP + DY[i];
    }

    this.startIndex = 16;
    this.endIndex = n - 34;
    this.endS = this.endIndex * STEP;

    // ---- guard rails (lots on early levels, gone later) ----
    this.railL = new Uint8Array(n);
    this.railR = new Uint8Array(n);
    for (const rail of [this.railL, this.railR]) {
      for (let c = 0; c < n; c += 30) {
        const on = railCover >= 1 || rng.chance(railCover);
        for (let i = c; i < Math.min(n, c + 30); i++) rail[i] = on ? 1 : 0;
      }
      for (let i = 0; i < 34; i++) rail[i] = 1;
      for (let i = n - 34; i < n; i++) rail[i] = 1;
    }

    // ---- rocks ----
    this.rocks = [];
    const RAFT_GAP = 4.6;
    for (let i = 45; i < n - 45; i++) {
      let nearDrop = false;
      for (let k = -7; k <= 7; k++) if (this.zone[i + k] === 1) nearDrop = true;
      if (nearDrop) continue;
      const p = (rockDensity / 100) * (this.zone[i] === 3 ? 2.5 : 1) * (this.zone[i] === 2 ? 0.3 : 1);
      if (!rng.chance(p)) continue;
      const hw = w[i] / 2;
      const r = rng.range(0.7, 1.2 + 0.6 * d);
      const lat = rng.range(-hw + r * 0.6, hw - r * 0.6);
      const rx = px[i] - tz[i] * lat, rz = pz[i] + tx[i] * lat;
      // keep a passage open: gather intervals across the river from nearby rocks
      const ivs = [[lat - r, lat + r]];
      let ok = true;
      for (const o of this.rocks) {
        if (Math.abs(o.i - i) > 6) continue;
        if (Math.hypot(o.x - rx, o.z - rz) < o.r + r + 1.2) { ok = false; break; }
        ivs.push([o.lat - o.r, o.lat + o.r]);
      }
      if (!ok) continue;
      ivs.sort((a, b) => a[0] - b[0]);
      let cur = -hw, maxGap = 0;
      for (const [a, b] of ivs) { maxGap = Math.max(maxGap, a - cur); cur = Math.max(cur, b); }
      maxGap = Math.max(maxGap, hw - cur);
      if (maxGap < RAFT_GAP) continue;
      this.rocks.push({ i, s: i * STEP, lat, r, x: rx, z: rz, y: py[i], h: rng.range(0.9, 1.6) });
    }

    // ---- checkpoints ----
    this.checkpoints = [];
    if (n > 330) {
      const count = n > 900 ? 3 : 2;
      for (let c = 1; c <= count; c++) {
        let i = Math.round((n * c) / (count + 1));
        while (i < n - 60 && (this.zone[i] === 1 || this.zone[i + 5] === 1 || this.zone[i - 5] === 1)) i++;
        this.checkpoints.push(i);
      }
    }

    this.minY = Infinity;
    for (let i = 0; i < n; i++) this.minY = Math.min(this.minY, py[i]);
  }

  d2(i, x, z) {
    const dx = x - this.px[i], dz = z - this.pz[i];
    return dx * dx + dz * dz;
  }

  /** Find river frame info for a world xz point. `hint` = last known sample index. */
  locate(x, z, hint, o = {}) {
    const n = this.n;
    let i;
    if (hint == null || hint < 0 || hint >= n) {
      i = 0;
      let best = Infinity;
      for (let k = 0; k < n; k += 3) {
        const dd = this.d2(k, x, z);
        if (dd < best) { best = dd; i = k; }
      }
    } else i = hint;
    let d = this.d2(i, x, z);
    for (;;) {
      if (i < n - 1) { const dn = this.d2(i + 1, x, z); if (dn < d) { d = dn; i++; continue; } }
      if (i > 0) { const dp = this.d2(i - 1, x, z); if (dp < d) { d = dp; i--; continue; } }
      break;
    }
    const t = (x - this.px[i]) * this.tx[i] + (z - this.pz[i]) * this.tz[i];
    let j, f;
    if (t >= 0) { if (i < n - 1) { j = i; f = t / STEP; } else { j = n - 2; f = 1 + t / STEP; } }
    else { if (i > 0) { j = i - 1; f = 1 + t / STEP; } else { j = 0; f = t / STEP; } }
    const fc = f < 0 ? 0 : f > 1 ? 1 : f;
    const a = 1 - fc;
    const cx = this.px[j] + (this.px[j + 1] - this.px[j]) * f;
    const cz = this.pz[j] + (this.pz[j + 1] - this.pz[j]) * f;
    let ttx = this.tx[j] * a + this.tx[j + 1] * fc;
    let ttz = this.tz[j] * a + this.tz[j + 1] * fc;
    const tl = Math.hypot(ttx, ttz) || 1;
    ttx /= tl; ttz /= tl;
    const nx = -ttz, nz = ttx;
    o.i = i;
    o.s = (j + f) * STEP;
    o.x = cx; o.z = cz;
    o.y = this.py[j] * a + this.py[j + 1] * fc;
    o.tx = ttx; o.tz = ttz; o.nx = nx; o.nz = nz;
    o.lat = (x - cx) * nx + (z - cz) * nz;
    o.hw = 0.5 * (this.w[j] * a + this.w[j + 1] * fc);
    o.speed = this.sp[j] * a + this.sp[j + 1] * fc;
    o.k = this.k[j] * a + this.k[j + 1] * fc;
    o.railL = this.railL[i];
    o.railR = this.railR[i];
    o.beyond = (i === 0 && t < 0) || (i === n - 1 && t > 0);
    return o;
  }

  /** Water velocity at a located point. Bends push you toward the outer edge! */
  flow(o) {
    const out = -o.k * o.speed * 1.8;
    return [o.tx * o.speed + o.nx * out, o.tz * o.speed + o.nz * out];
  }

  // =============================== visuals ===============================
  buildMesh() {
    const g = new THREE.Group();
    const n = this.n, M = 8;
    const { px, py, pz, tx, tz, w } = this;

    // --- water surface ribbon ---
    const vc = n * (M + 1);
    const pos = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
    const aSpeed = new Float32Array(vc), aFoam = new Float32Array(vc);
    for (let i = 0; i < n; i++) {
      const nx = -tz[i], nz = tx[i], hw = w[i] / 2;
      for (let a = 0; a <= M; a++) {
        const u = a / M, lat = hw * (1 - 2 * u), v = i * (M + 1) + a;
        pos[v * 3] = px[i] + nx * lat;
        pos[v * 3 + 1] = py[i];
        pos[v * 3 + 2] = pz[i] + nz * lat;
        uv[v * 2] = u;
        uv[v * 2 + 1] = i * STEP;
        aSpeed[v] = this.sp[i];
        aFoam[v] = this.foam[i];
      }
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      for (let a = 0; a < M; a++) {
        const v0 = i * (M + 1) + a, v1 = v0 + 1, v2 = v0 + M + 1, v3 = v2 + 1;
        idx.push(v0, v1, v2, v1, v3, v2);
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    wg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    wg.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
    wg.setAttribute('aFoam', new THREE.BufferAttribute(aFoam, 1));
    wg.setIndex(idx);
    wg.computeBoundingSphere();
    this.waterMat = waterMaterial();
    const water = new THREE.Mesh(wg, this.waterMat);
    water.renderOrder = 1;
    g.add(water);

    // --- spill skirts on both edges ---
    this.skirtMat = skirtMaterial();
    for (const side of [1, -1]) {
      const sp = new Float32Array(n * 2 * 3), su = new Float32Array(n * 2 * 2);
      for (let i = 0; i < n; i++) {
        const nx = -tz[i] * side, nz = tx[i] * side, hw = w[i] / 2;
        const ex = px[i] + nx * hw, ez = pz[i] + nz * hw;
        sp.set([ex, py[i] - 0.01, ez, ex + nx * 0.5, py[i] - 2.4, ez + nz * 0.5], i * 6);
        su.set([i * STEP * 0.4, 0, i * STEP * 0.4, 1], i * 4);
      }
      const si = [];
      for (let i = 0; i < n - 1; i++) {
        const a = i * 2, b = a + 1, c = a + 2, dd = a + 3;
        si.push(a, b, c, b, dd, c);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      sg.setAttribute('uv', new THREE.BufferAttribute(su, 2));
      sg.setIndex(si);
      const skirt = new THREE.Mesh(sg, this.skirtMat);
      skirt.renderOrder = 2;
      g.add(skirt);
    }

    // --- rocks + rail posts (merged, vertex coloured) ---
    const solid = [];
    const rockCols = ['#a7a3c4', '#9aa7bd', '#b3a9c9'];
    this.rocks.forEach((r, k) => {
      const rg = new THREE.DodecahedronGeometry(r.r, 1);
      jitter(rg, r.r * 0.25, k + 3);
      rg.scale(1, r.h / r.r * 0.7, 1);
      rg.translate(r.x, r.y + 0.05, r.z);
      solid.push(colored(rg, rockCols[k % 3]));
      const moss = new THREE.SphereGeometry(r.r * 0.55, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      moss.scale(1, 0.45, 1);
      moss.translate(r.x, r.y + 0.05 + r.h * 0.62, r.z);
      solid.push(colored(moss, '#7fd38b'));
    });
    const bandPos = [], bandIdx = [];
    const railRun = (rail, side) => {
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          const base = bandPos.length / 3;
          for (const i of run) {
            const nx = -tz[i] * side, nz = tx[i] * side, hw = w[i] / 2 + 0.15;
            const ex = px[i] + nx * hw, ez = pz[i] + nz * hw;
            bandPos.push(ex, py[i] + 0.25, ez, ex, py[i] + 0.75, ez);
          }
          for (let k = 0; k < run.length - 1; k++) {
            const a = base + k * 2;
            bandIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        }
        run = [];
      };
      for (let i = 0; i < n; i++) {
        if (rail[i]) {
          run.push(i);
          if (i % 3 === 0) {
            const nx = -tz[i] * side, nz = tx[i] * side, hw = w[i] / 2 + 0.15;
            const post = new THREE.OctahedronGeometry(0.17, 0);
            post.scale(1, 3, 1);
            post.translate(px[i] + nx * hw, py[i] + 0.5, pz[i] + nz * hw);
            solid.push(colored(post, i % 6 === 0 ? '#ff9ff3' : '#a29bfe'));
          }
        } else flush();
      }
      flush();
    };
    railRun(this.railL, 1);
    railRun(this.railR, -1);

    // --- checkpoint + goal arches ---
    const archAt = (i, colors, r0) => {
      const hw = w[i] / 2 + 0.6;
      const ry = Math.atan2(-tx[i], -tz[i]); // local X -> river normal
      colors.forEach((c, k) => {
        const tg = new THREE.TorusGeometry(hw + r0 - k * 0.34, 0.17, 6, 28, Math.PI);
        tg.rotateY(ry);
        tg.translate(px[i], py[i], pz[i]);
        solid.push(colored(tg, c));
      });
    };
    for (const c of this.checkpoints) archAt(c, ['#ffe066', '#ffa94d'], 0.3);
    archAt(this.endIndex, ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'], 1.4);

    if (solid.length) {
      const sm = new THREE.Mesh(mergeGeometries(solid), toon('#ffffff', { vertexColors: true }));
      sm.castShadow = true;
      sm.receiveShadow = true;
      g.add(sm);
    }
    if (bandIdx.length) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(bandPos, 3));
      bg.setIndex(bandIdx);
      const band = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({
        color: '#ffb8f5', transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false,
      }));
      band.renderOrder = 3;
      g.add(band);
    }

    // foam rings around rocks
    const ringGeos = this.rocks.map((r) => {
      const rg = new THREE.RingGeometry(r.r * 0.95, r.r * 1.45, 18);
      rg.rotateX(-Math.PI / 2);
      rg.translate(r.x, r.y + 0.04, r.z);
      return rg;
    });
    if (ringGeos.length) {
      this.ringMesh = new THREE.Mesh(mergeGeometries(ringGeos), new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false,
      }));
      this.ringMesh.renderOrder = 2;
      g.add(this.ringMesh);
    }

    // FINISH banner
    g.add(this.banner(this.endIndex, 'FINISH!', '#ff6b9d', w[this.endIndex] / 2 + 1.6));
    this.checkpoints.forEach((c) => g.add(this.banner(c, 'CHECKPOINT', '#ffa94d', w[c] / 2 + 0.6)));

    this.group = g;
    return g;
  }

  banner(i, text, color, height) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = color;
    const r = 40;
    c.beginPath();
    c.roundRect(8, 8, 496, 112, r);
    c.fill();
    c.lineWidth = 8; c.strokeStyle = '#ffffff'; c.stroke();
    c.fillStyle = '#fff';
    c.font = 'bold 72px Fredoka, "Arial Rounded MT Bold", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(this.px[i], this.py[i] + height - 0.9, this.pz[i]);
    // face upstream (towards the camera)
    m.rotation.y = Math.atan2(-this.tx[i], -this.tz[i]);
    return m;
  }

  update(t) {
    if (this.waterMat) this.waterMat.uniforms.uTime.value = t;
    if (this.skirtMat) this.skirtMat.uniforms.uTime.value = t;
    if (this.ringMesh) this.ringMesh.material.opacity = 0.55 + 0.2 * Math.sin(t * 4);
  }

  dispose() {
    if (!this.group) return;
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}
