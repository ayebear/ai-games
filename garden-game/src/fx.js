import * as THREE from 'three';
import { SPH, mat, glow } from './models.js';
import { rand } from './state.js';

const MAX = 500;
const v = new THREE.Vector3();

export class FX {
  constructor(scene, camera, layer) {
    this.scene = scene; this.camera = camera; this.layer = layer;
    this.parts = [];
    this.free = [];
    this.texts = [];
    this.toastEl = document.getElementById('toasts');
  }

  _part(color, emissive) {
    let p = this.free.pop();
    const m = emissive ? glow(color, 2) : mat(color);
    if (!p) {
      if (this.parts.length >= MAX) return null;
      const mesh = new THREE.Mesh(SPH(6, 4), m);
      mesh.castShadow = false;
      this.scene.add(mesh);
      p = { mesh, vel: new THREE.Vector3(), life: 0, max: 1, size: 0.1, grav: 0, alive: false };
      this.parts.push(p);
    }
    p.mesh.material = m;
    p.mesh.visible = true;
    p.alive = true;
    return p;
  }

  burst(pos, color, n = 8, { speed = 3, life = 0.6, size = 0.1, grav = 9, up = 2, emissive = false, spread = 0.2 } = {}) {
    for (let i = 0; i < n; i++) {
      const p = this._part(color, emissive);
      if (!p) return;
      p.mesh.position.set(pos.x + rand(-spread, spread), (pos.y ?? 0.5) + rand(-spread, spread), pos.z + rand(-spread, spread));
      p.vel.set(rand(-1, 1), rand(0, 1) + up / Math.max(speed, 0.01), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.5, 1));
      p.life = p.max = life * rand(0.7, 1.2);
      p.size = size * rand(0.7, 1.3);
      p.grav = grav;
    }
  }

  stream(from, dir, color, { speed = 9, spread = 0.12, size = 0.07, life = 0.45 } = {}) {
    const p = this._part(color, false);
    if (!p) return;
    p.mesh.position.copy(from);
    p.vel.copy(dir).add(v.set(rand(-spread, spread), rand(-spread, spread) + 0.15, rand(-spread, spread))).normalize().multiplyScalar(speed * rand(0.85, 1.1));
    p.life = p.max = life;
    p.size = size;
    p.grav = 12;
  }

  update(dt) {
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; p.mesh.visible = false; this.free.push(p); continue; }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.02) { p.mesh.position.y = 0.02; p.vel.multiplyScalar(0.5); }
      p.mesh.scale.setScalar(p.size * Math.min(1, (p.life / p.max) * 2));
    }
    // floating texts
    for (const t of this.texts) {
      t.t += dt;
      t.pos.y += dt * 1.4;
      this.place(t.el, t.pos);
      t.el.style.opacity = String(Math.max(0, 1 - t.t / t.dur));
      if (t.t >= t.dur) { t.el.remove(); t.dead = true; }
    }
    if (this.texts.some((t) => t.dead)) this.texts = this.texts.filter((t) => !t.dead);
  }

  place(el, pos) {
    v.copy(pos).project(this.camera);
    if (v.z > 1) { el.style.display = 'none'; return false; }
    el.style.display = '';
    el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
    return true;
  }

  text(pos, str, color = '#fff', size = 18, dur = 1.1) {
    const el = document.createElement('div');
    el.className = 'ftext';
    el.textContent = str;
    el.style.color = color;
    el.style.fontSize = size + 'px';
    this.layer.appendChild(el);
    const t = { el, pos: new THREE.Vector3(pos.x, (pos.y ?? 0) + 1.5, pos.z), t: 0, dur };
    this.place(el, t.pos);
    this.texts.push(t);
  }

  toast(title, sub = '', cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = `<div class="tt">${title}</div>${sub ? `<div class="ts">${sub}</div>` : ''}`;
    this.toastEl.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4200);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild.remove();
  }

  clear() {
    for (const t of this.texts) t.el.remove();
    this.texts = [];
    for (const p of this.parts) { p.alive = false; p.mesh.visible = false; }
    this.free = this.parts.slice();
    this.toastEl.innerHTML = '';
  }
}
