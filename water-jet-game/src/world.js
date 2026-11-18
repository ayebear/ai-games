import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RNG } from './rng.js';
import { toon, colored, jitter } from './materials.js';
import { skyMaterial, cloudSeaMaterial } from './shaders.js';

export const HORIZON = '#f3dcff';
const SUN_OFFSET = new THREE.Vector3(14, 30, 8);

export class World {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(HORIZON);
    scene.fog = new THREE.Fog(HORIZON, 70, 330);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMaterial('#5fb8ff', HORIZON, '#b7a4ff', SUN_OFFSET));
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#d4ecff', '#e2c8ff', 1.25);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);

    this.seaMat = cloudSeaMaterial();
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this.seaMat);
    this.sea.rotation.x = -Math.PI / 2;
    scene.add(this.sea);

    // sparkly magic dust that drips off the river edges
    this.dustMax = 500;
    this.dust = { p: new Float32Array(this.dustMax * 3), v: new Float32Array(this.dustMax * 3), age: new Float32Array(this.dustMax), life: new Float32Array(this.dustMax), n: 0 };
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.dustMax * 3), 3));
    dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.dustMax * 3), 3));
    this.dustPts = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.dustPts.frustumCulled = false;
    scene.add(this.dustPts);
    this.dustAcc = 0;
    this.dustCols = [new THREE.Color('#fff3b0'), new THREE.Color('#ffc8f0'), new THREE.Color('#b8f4ff')];

    this.decor = null;
  }

  buildDecor(river) {
    this.clearDecor();
    const rng = new RNG(river.level * 31 + 7);
    const g = new THREE.Group();
    const land = [], clouds = [];
    const n = river.n;
    this.seaY = river.minY - 55;

    const clearOfRiver = (x, z, r, i0) => {
      for (let i = Math.max(0, i0 - 90); i < Math.min(n, i0 + 90); i += 2) {
        if (Math.hypot(x - river.px[i], z - river.pz[i]) < river.w[i] / 2 + r + 3) return false;
      }
      return true;
    };
    const leafCols = ['#7ee08a', '#ff9fd0', '#8fe0d6', '#b6e86f', '#ffc56e'];
    const island = (x, y, z, R, seed) => {
      const h = R * rng.range(1.1, 1.9);
      const rock = new THREE.ConeGeometry(R, h, 7, 3);
      rock.rotateX(Math.PI);
      jitter(rock, R * 0.22, seed);
      rock.translate(x, y - h / 2 - 0.2, z);
      land.push(colored(rock, rng.pick(['#b49ad6', '#a68cc7', '#c3a3d9'])));
      const dirt = new THREE.CylinderGeometry(R * 1.02, R * 0.98, 0.5, 7);
      dirt.translate(x, y - 0.35, z);
      land.push(colored(dirt, '#c99b7a'));
      const top = new THREE.CylinderGeometry(R * 1.06, R * 1.06, 0.35, 7);
      top.translate(x, y, z);
      land.push(colored(top, '#8ddf8a'));
      const trees = rng.int(0, Math.min(5, Math.floor(R / 2)));
      for (let k = 0; k < trees; k++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(0, R * 0.7);
        const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, s = rng.range(0.8, 1.6);
        const trunk = new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 1.4 * s, 5);
        trunk.translate(tx, y + 0.7 * s, tz);
        land.push(colored(trunk, '#9a6a4a'));
        const leaf = new THREE.IcosahedronGeometry(1.0 * s, 0);
        jitter(leaf, 0.3 * s, seed + k);
        leaf.translate(tx, y + 1.9 * s, tz);
        land.push(colored(leaf, rng.pick(leafCols)));
      }
      if (rng.chance(0.4)) {
        const m = new THREE.IcosahedronGeometry(rng.range(0.4, 0.8), 0);
        m.translate(x + rng.range(-R, R) * 0.5, y + 0.4, z + rng.range(-R, R) * 0.5);
        land.push(colored(m, '#d9d2ee'));
      }
    };
    const cloud = (x, y, z, s) => {
      const puffs = rng.int(4, 7);
      for (let k = 0; k < puffs; k++) {
        const r = s * rng.range(0.6, 1.1);
        const p = new THREE.IcosahedronGeometry(r, 1);
        p.scale(1, 0.7, 1);
        p.translate(x + rng.range(-1.6, 1.6) * s, y + rng.range(-0.2, 0.4) * s, z + rng.range(-0.9, 0.9) * s);
        clouds.push(colored(p, rng.chance(0.2) ? '#ffeaf6' : '#ffffff'));
      }
    };

    for (let i = 0; i < n; i += 14) {
      const nx = -river.tz[i], nz = river.tx[i];
      for (const side of [1, -1]) {
        if (rng.chance(0.42)) {
          const R = rng.range(3, 9);
          const lat = side * (river.w[i] / 2 + R + rng.range(6, 55));
          const x = river.px[i] + nx * lat, z = river.pz[i] + nz * lat;
          if (clearOfRiver(x, z, R, i)) island(x, river.py[i] + rng.range(-22, 6), z, R, i * 3 + side);
        }
        if (rng.chance(0.55)) {
          const lat = side * (river.w[i] / 2 + rng.range(8, 90));
          cloud(river.px[i] + nx * lat, river.py[i] + rng.range(-30, 14), river.pz[i] + nz * lat, rng.range(1.4, 3.5));
        }
      }
      if (rng.chance(0.5)) {
        cloud(river.px[i] + nx * rng.range(-20, 20), river.py[i] - rng.range(10, 30), river.pz[i] + nz * rng.range(-20, 20), rng.range(2, 4));
      }
    }
    // start spring island + finish island
    const s0 = 0, e0 = n - 1;
    island(river.px[s0] - river.tx[s0] * 6, river.py[s0] - 0.4, river.pz[s0] - river.tz[s0] * 6, river.w[s0] / 2 + 6, 99);
    island(river.px[e0] + river.tx[e0] * 6, river.py[e0] - 0.5, river.pz[e0] + river.tz[e0] * 6, river.w[e0] / 2 + 8, 101);

    if (land.length) {
      const m = new THREE.Mesh(mergeGeometries(land), toon('#ffffff', { vertexColors: true }));
      m.receiveShadow = true;
      g.add(m);
    }
    if (clouds.length) {
      this.cloudMesh = new THREE.Mesh(mergeGeometries(clouds), toon('#ffffff', { vertexColors: true, emissive: new THREE.Color('#e9dcff'), emissiveIntensity: 0.35 }));
      g.add(this.cloudMesh);
    }
    this.decor = g;
    this.scene.add(g);
    this.dust.n = 0;
  }

  clearDecor() {
    if (!this.decor) return;
    this.scene.remove(this.decor);
    this.decor.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.decor = null;
  }

  update(dt, t, camera, raft, river) {
    this.sky.position.copy(camera.position);
    this.sea.position.set(camera.position.x, this.seaY ?? -60, camera.position.z);
    this.seaMat.uniforms.uTime.value = t;
    this.sun.position.set(raft.x + SUN_OFFSET.x, raft.y + SUN_OFFSET.y, raft.z + SUN_OFFSET.z);
    this.sun.target.position.set(raft.x, raft.y, raft.z);
    if (this.cloudMesh) this.cloudMesh.position.y = Math.sin(t * 0.3) * 0.6;

    // dust
    const D = this.dust;
    this.dustAcc += dt * 70;
    while (this.dustAcc >= 1 && D.n < this.dustMax) {
      this.dustAcc -= 1;
      const i = Math.min(river.n - 1, Math.max(0, raft.hint + Math.floor(Math.random() * 60 - 15)));
      const side = Math.random() < 0.5 ? 1 : -1;
      const nx = -river.tz[i] * side, nz = river.tx[i] * side, hw = river.w[i] / 2 + 0.3;
      const k = D.n++;
      D.p[k * 3] = river.px[i] + nx * hw; D.p[k * 3 + 1] = river.py[i] - Math.random() * 1.5; D.p[k * 3 + 2] = river.pz[i] + nz * hw;
      D.v[k * 3] = nx * 0.4; D.v[k * 3 + 1] = -0.8 - Math.random() * 1.2; D.v[k * 3 + 2] = nz * 0.4;
      D.age[k] = 0; D.life[k] = 2 + Math.random() * 2;
    }
    this.dustAcc = Math.min(this.dustAcc, 2);
    const pos = this.dustPts.geometry.attributes.position.array;
    const col = this.dustPts.geometry.attributes.color.array;
    for (let k = D.n - 1; k >= 0; k--) {
      D.age[k] += dt;
      if (D.age[k] > D.life[k]) {
        const j = --D.n;
        for (let c = 0; c < 3; c++) { D.p[k * 3 + c] = D.p[j * 3 + c]; D.v[k * 3 + c] = D.v[j * 3 + c]; }
        D.age[k] = D.age[j]; D.life[k] = D.life[j];
        continue;
      }
      for (let c = 0; c < 3; c++) D.p[k * 3 + c] += D.v[k * 3 + c] * dt;
    }
    for (let k = 0; k < D.n; k++) {
      pos[k * 3] = D.p[k * 3]; pos[k * 3 + 1] = D.p[k * 3 + 1]; pos[k * 3 + 2] = D.p[k * 3 + 2];
      const tt = D.age[k] / D.life[k];
      const f = Math.sin(tt * Math.PI) * (0.6 + 0.4 * Math.sin(t * 12 + k));
      const c = this.dustCols[k % 3];
      col[k * 3] = c.r * f; col[k * 3 + 1] = c.g * f; col[k * 3 + 2] = c.b * f;
    }
    this.dustPts.geometry.setDrawRange(0, D.n);
    this.dustPts.geometry.attributes.position.needsUpdate = true;
    this.dustPts.geometry.attributes.color.needsUpdate = true;
  }
}

/** Celebration confetti. */
export class Confetti {
  constructor(scene) {
    this.max = 400;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.p = []; this.dummy = new THREE.Object3D();
    this.cols = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#ff9ff3', '#9775fa'].map((c) => new THREE.Color(c));
  }
  burst(x, y, z, n) {
    for (let k = 0; k < n && this.p.length < this.max; k++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 6;
      this.p.push({ x, y, z, vx: Math.cos(a) * s, vy: 6 + Math.random() * 8, vz: Math.sin(a) * s, r: Math.random() * 6, rs: (Math.random() - 0.5) * 20, life: 4 + Math.random() * 2, c: this.cols[k % this.cols.length] });
    }
  }
  clear() { this.p.length = 0; this.mesh.count = 0; }
  update(dt) {
    const d = this.dummy;
    let k = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.life -= dt;
      if (p.life <= 0) { this.p.splice(i, 1); continue; }
      p.vy -= 9 * dt; p.vy = Math.max(p.vy, -2.5);
      p.vx *= Math.exp(-1.5 * dt); p.vz *= Math.exp(-1.5 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += p.rs * dt;
    }
    for (const p of this.p) {
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.r, p.r * 0.7, p.r * 0.3);
      d.updateMatrix();
      this.mesh.setMatrixAt(k, d.matrix);
      this.mesh.setColorAt(k, p.c);
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
