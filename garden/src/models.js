// Procedural low-poly models built from cached primitive geometries & materials.
import * as THREE from 'three';
import { PLANTS, TOOLS, toolBase } from './config.js';

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  let m = mats.get(key);
  if (!m) {
    const { flat, ...rest } = opts;
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: !!flat, ...rest });
    mats.set(key, m);
  }
  return m;
}
export const glow = (color, intensity = 1.5) => mat(color, { emissive: color, emissiveIntensity: intensity });

const geos = new Map();
const cg = (key, f) => { let g = geos.get(key); if (!g) { g = f(); geos.set(key, g); } return g; };
export const SPH = (w = 12, h = 8) => cg(`s${w}_${h}`, () => new THREE.SphereGeometry(1, w, h));
export const BOX = () => cg('box', () => new THREE.BoxGeometry(1, 1, 1));
export const CYL = (s = 10, top = 1) => cg(`c${s}_${top}`, () => new THREE.CylinderGeometry(top, 1, 1, s));
export const CONE = (s = 10) => cg(`k${s}`, () => new THREE.ConeGeometry(1, 1, s));
export const ICO = (d = 0) => cg(`i${d}`, () => new THREE.IcosahedronGeometry(1, d));
export const HEMI = () => cg('hemi', () => new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2));
export const DISC = (s = 24) => cg(`d${s}`, () => new THREE.CircleGeometry(1, s));
export const PLANE = () => cg('plane', () => new THREE.PlaneGeometry(1, 1));
export const RING = () => cg('ring', () => new THREE.RingGeometry(0.82, 1, 32));
export const TORUS = () => cg('torus', () => new THREE.TorusGeometry(1, 0.18, 6, 16));

export function P(parent, geo, material, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(pos[0], pos[1], pos[2]);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(scl[0], scl[1], scl[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}
const grp = (parent, pos = [0, 0, 0], rot = [0, 0, 0]) => {
  const g = new THREE.Group();
  g.position.set(...pos); g.rotation.set(...rot);
  parent?.add(g);
  return g;
};

const GREEN = 0x4caf50, DGREEN = 0x2e7d32, STEM = 0x5b9a3c, BROWN = 0x6d4c2f, SKIN = 0xf6c9a4;
const WOOD = 0x9a6a3a, METAL = 0x9aa3ab;
export const PLANT_COLORS = {
  daisy: 0xffffff, strawberry: 0xe5303f, marigold: 0xff9a1f, carrot: 0xff8a1f, tomato: 0xe8302a, sunflower: 0xffd21f,
  flytrap: 0x7bc043, corn: 0xf5d142, rose: 0xd8173a, watermelon: 0x3f9a3a, pumpkin: 0xff7a1a,
};

// ───────────────────────── Gnome (player) ─────────────────────────
export function makeGnome(color) {
  const g = new THREE.Group();
  const leg = (x) => {
    const l = grp(g, [x, 0.42, 0]);
    P(l, CYL(8), mat(0x3a2a1e), [0, -0.2, 0], [0.11, 0.4, 0.11]);
    P(l, BOX(), mat(0x2a1a10), [0, -0.37, 0.06], [0.2, 0.12, 0.32]);
    return l;
  };
  const legL = leg(-0.15), legR = leg(0.15);
  P(g, CYL(12, 0.7), mat(color), [0, 0.72, 0], [0.45, 0.7, 0.45]);
  P(g, CYL(12), mat(0x3a2a1e), [0, 0.55, 0], [0.43, 0.08, 0.43]);
  P(g, BOX(), mat(0xffd34d, { metalness: 0.6, roughness: 0.3 }), [0, 0.55, 0.42], [0.12, 0.1, 0.04]);
  P(g, SPH(), mat(SKIN), [0, 1.22, 0], 0.27);
  P(g, SPH(), mat(0xf08a7a), [0, 1.2, 0.26], 0.085);
  P(g, SPH(6, 4), mat(0x111111), [-0.1, 1.29, 0.22], 0.035);
  P(g, SPH(6, 4), mat(0x111111), [0.1, 1.29, 0.22], 0.035);
  P(g, CONE(10), mat(0xf4f4f4), [0, 0.97, 0.13], [0.24, 0.45, 0.18], [Math.PI, 0, 0]);
  const hat = P(g, CONE(12), mat(color), [0, 1.72, -0.03], [0.32, 0.8, 0.32], [-0.15, 0, 0]);
  const arm = (x) => {
    const a = grp(g, [x, 1.0, 0]);
    P(a, CYL(8), mat(color), [0, -0.2, 0], [0.09, 0.4, 0.09]);
    P(a, SPH(8, 6), mat(SKIN), [0, -0.42, 0], 0.09);
    return a;
  };
  const armL = arm(-0.42), armR = arm(0.42);
  const tool = grp(armR, [0, -0.42, 0], [Math.PI / 2, 0, 0]);
  const lantern = grp(armL, [0, -0.5, 0.05]);
  P(lantern, BOX(), mat(0x333333), [0, -0.1, 0], [0.16, 0.04, 0.16]);
  P(lantern, BOX(), mat(0x333333), [0, 0.1, 0], [0.16, 0.04, 0.16]);
  const flame = P(lantern, SPH(8, 6), glow(0xffc35a, 2.5), [0, 0, 0], 0.07, [0, 0, 0], false);
  lantern.visible = false;
  // held item anchor: out in front, between both hands
  const carry = grp(g, [0, 0.72, 0.5]);
  // selection ring under feet
  const ring = P(g, RING(), mat(color, { emissive: color, emissiveIntensity: 0.6, side: THREE.DoubleSide }), [0, 0.03, 0], 0.7, [-Math.PI / 2, 0, 0], false);
  // facing arrow at the gnome's feet
  P(g, CONE(3), mat(color, { emissive: color, emissiveIntensity: 0.9 }), [0, 0.04, 0.95], [0.22, 0.32, 0.04], [Math.PI / 2, 0, 0], false);
  return { group: g, legL, legR, armL, armR, tool, lantern, flame, hat, carry, ring };
}

// Tools are built along +y (handle at the bottom). A better tool (TOOLS[key].base) is its base
// tool's model with its own look flags (TOOLS[key].model: gold, sharp, hot, soap). opts.reel draws
// a hose as a reel (for icons and the shop table).
export function makeTool(key, opts = {}) {
  const g = new THREE.Group();
  const steel = mat(METAL, { metalness: 0.55, roughness: 0.35 });
  opts = { ...TOOLS[key]?.model, ...opts };
  const hoseCol = opts.soap ? [0xec407a, 0xf48fb1] : [0x388e3c, 0x43a047];
  switch (toolBase(key)) {
    case 'shovel': {
      P(g, CYL(6), mat(WOOD), [0, 0.3, 0], [0.035, 0.95, 0.035]);
      P(g, TORUS(), mat(WOOD), [0, -0.24, 0], [0.09, 0.07, 0.09]); // D-grip
      const blade = opts.sharp ? mat(0xe3f2fd, { metalness: 0.8, roughness: 0.15, emissive: 0x4fc3f7, emissiveIntensity: 0.35 }) : steel;
      P(g, CYL(6), steel, [0, 0.8, 0], [0.05, 0.1, 0.05]);
      P(g, BOX(), blade, [0, 0.95, 0], [0.3, 0.26, 0.035]);
      P(g, CONE(4), blade, [0, 1.13, 0], [0.21, 0.14, 0.025], [0, Math.PI / 4, 0]);
      break;
    }
    case 'can': {
      const c = opts.gold ? mat(0xffc107, { metalness: 0.75, roughness: 0.25 }) : mat(0x3a9a5a);
      P(g, CYL(12), c, [0, 0.16, 0], [0.18, 0.32, 0.18]);
      P(g, TORUS(), c, [0, 0.36, -0.04], [0.13, 0.13, 0.13], [0, Math.PI / 2, 0]); // top handle
      P(g, CYL(6), c, [0, 0.25, 0.27], [0.035, 0.4, 0.035], [0.95, 0, 0]);
      P(g, CYL(8, 1), c, [0, 0.39, 0.44], [0.08, 0.06, 0.08], [0.95, 0, 0]); // rose
      break;
    }
    case 'swatter':
      P(g, CYL(6), mat(0xeeeeee), [0, 0.3, 0], [0.025, 0.65, 0.025]);
      P(g, BOX(), mat(0xe53935), [0, 0.78, 0], [0.36, 0.36, 0.025]);
      for (const k of [-1, 0, 1]) {
        P(g, BOX(), mat(0x9a1a1a), [k * 0.09, 0.78, 0.014], [0.025, 0.36, 0.01]);
        P(g, BOX(), mat(0x9a1a1a), [0, 0.78 + k * 0.09, 0.014], [0.36, 0.025, 0.01]);
      }
      break;
    case 'spray':
      P(g, CYL(12), mat(0xbfe6ff, { transparent: true, opacity: 0.85 }), [0, 0.16, 0], [0.11, 0.32, 0.11]);
      P(g, CYL(12), mat(0xf48fb1), [0, 0.12, 0], [0.1, 0.2, 0.1]); // soap inside
      P(g, CYL(8), mat(0xffffff), [0, 0.35, 0], [0.05, 0.08, 0.05]);
      P(g, BOX(), mat(0xff7eb6), [0, 0.43, 0.04], [0.1, 0.12, 0.22]);
      P(g, CYL(6), mat(0x37474f), [0, 0.45, 0.17], [0.025, 0.08, 0.025], [Math.PI / 2, 0, 0]);
      P(g, BOX(), mat(0xff7eb6), [0, 0.33, 0.1], [0.04, 0.12, 0.03], [0.3, 0, 0]); // trigger
      break;
    case 'slingshot':
      P(g, CYL(6), mat(WOOD), [0, 0.15, 0], [0.04, 0.35, 0.04]);
      P(g, CYL(6), mat(WOOD), [-0.09, 0.42, 0], [0.035, 0.28, 0.035], [0, 0, 0.5]);
      P(g, CYL(6), mat(WOOD), [0.09, 0.42, 0], [0.035, 0.28, 0.035], [0, 0, -0.5]);
      P(g, CYL(4), mat(0x37474f), [-0.09, 0.53, -0.1], [0.012, 0.24, 0.012], [Math.PI / 2 - 0.5, 0, 0.5]);
      P(g, CYL(4), mat(0x37474f), [0.09, 0.53, -0.1], [0.012, 0.24, 0.012], [Math.PI / 2 - 0.5, 0, -0.5]);
      P(g, BOX(), mat(0x795548), [0, 0.52, -0.2], [0.1, 0.05, 0.05]); // pouch
      break;
    case 'gun': {
      // PVC spud cannon: fat chamber, thin barrel, a potato poking out
      const pvc = mat(0xeceff1, { roughness: 0.5 });
      P(g, CYL(10), pvc, [0, 0.05, 0], [0.13, 0.4, 0.13]);
      P(g, CYL(10, 0.55), pvc, [0, 0.3, 0], [0.13, 0.1, 0.13]);
      P(g, CYL(10), pvc, [0, 0.72, 0], [0.075, 0.75, 0.075]);
      P(g, CYL(10), mat(0x90a4ae), [0, 1.08, 0], [0.09, 0.05, 0.09]);
      P(g, BOX(), mat(0xff7043), [0.13, 0.05, 0], [0.06, 0.12, 0.06]); // igniter
      P(g, SPH(8, 6), opts.hot ? glow(0xff7043, 1.2) : mat(0xc49a5a), [0, 1.13, 0], [0.07, 0.06, 0.07]);
      break;
    }
    case 'mgun': {
      const body = mat(0x37474f, { metalness: 0.5, roughness: 0.4 });
      P(g, BOX(), body, [0, 0.15, 0], [0.16, 0.5, 0.2]);
      P(g, CYL(8), mat(0x263238, { metalness: 0.7, roughness: 0.3 }), [0, 0.65, 0], [0.05, 0.6, 0.05]);
      P(g, CYL(8), mat(0xff9800), [0, 0.95, 0], [0.07, 0.05, 0.07]);
      P(g, CYL(14), mat(0xffb300, { metalness: 0.4, roughness: 0.4 }), [0, 0.22, -0.17], [0.17, 0.1, 0.17], [Math.PI / 2, 0, 0]); // seed drum
      P(g, BOX(), body, [0, -0.08, 0.12], [0.08, 0.1, 0.18], [0.5, 0, 0]); // grip
      break;
    }
    case 'hose':
      if (opts.reel) {
        // icon: a reel of green hose with a yellow nozzle
        for (let i = 0; i < 3; i++) P(g, TORUS(), mat(hoseCol[i % 2]), [0, 0.35, -0.06 + i * 0.06], [0.3 - i * 0.02, 0.3 - i * 0.02, 0.35]);
        P(g, CYL(10), mat(0xd84315), [0, 0.35, 0], [0.1, 0.24, 0.1], [Math.PI / 2, 0, 0]);
        P(g, CYL(8), mat(0xffc107), [0.3, 0.1, 0.1], [0.05, 0.25, 0.05], [0, 0, -0.6]);
        P(g, BOX(), mat(0xffc107), [0.22, 0.0, 0.1], [0.06, 0.14, 0.06]);
      } else {
        P(g, CYL(8), mat(0xffc107), [0, 0.22, 0], [0.055, 0.4, 0.055]);
        P(g, BOX(), mat(0xffc107), [0, 0.02, 0.06], [0.06, 0.16, 0.06], [0.4, 0, 0]);
        P(g, CYL(8, 0.6), mat(opts.soap ? 0xc2185b : 0x2e7d32), [0, -0.1, 0], [0.07, 0.24, 0.07]);
        if (opts.soap) P(g, SPH(8, 6), mat(0xf8bbd0, { transparent: true, opacity: 0.8 }), [0.08, 0.3, 0.05], 0.06); // soap bubble
      }
      break;
  }
  return g;
}

// ───────────────────────── Plants ─────────────────────────
function stem(parent, h, r = 0.04, color = STEM) { return P(parent, CYL(6), mat(color), [0, h / 2, 0], [r, h, r]); }
function leaf(parent, y, s, rotY, tilt = 0.4, color = GREEN) {
  const l = grp(parent, [0, y, 0], [0, rotY, 0]);
  P(l, SPH(8, 6), mat(color), [s * 0.45, s * 0.12, 0], [s * 0.5, s * 0.07, s * 0.2], [0, 0, tilt]);
  return l;
}
function petals(parent, n, len, w, color, tilt = 0.25) {
  for (let i = 0; i < n; i++) {
    const p = grp(parent, [0, 0, 0], [0, (i / n) * Math.PI * 2, 0]);
    P(p, SPH(8, 5), mat(color), [len * 0.55, 0, 0], [len * 0.5, 0.035, w], [0, 0, tilt]);
  }
}

export function makePlantModel(type, stage) {
  const g = new THREE.Group();
  const out = { group: g, height: 0.4, traps: [], fruit: null, head: null };
  const tint = PLANT_COLORS[type] ?? 0xffffff;
  if (stage === 0) {
    // freshly planted: a dark mound, a poking shoot and a little marker stake in the plant's color
    P(g, HEMI(), mat(0x3b2414), [0, 0, 0], [0.42, 0.16, 0.42]);
    P(g, CONE(6), mat(0x9be564), [0, 0.2, 0], [0.05, 0.14, 0.05]);
    P(g, CYL(5), mat(0xc8a06a), [0.32, 0.25, -0.2], [0.025, 0.5, 0.025]);
    P(g, BOX(), mat(tint), [0.32, 0.45, -0.2], [0.16, 0.12, 0.02]);
    out.height = 0.4;
    return out;
  }
  if (stage === 1) {
    // seedling: curved stem, two big rounded seed leaves and a first true leaf, plus marker stake
    P(g, HEMI(), mat(0x3b2414), [0, 0, 0], [0.3, 0.08, 0.3]);
    P(g, CYL(6), mat(0x7cc84f), [0, 0.17, 0], [0.035, 0.34, 0.035], [0.12, 0, 0]);
    for (const s of [-1, 1]) P(g, SPH(10, 6), mat(0x9be564), [s * 0.16, 0.36, 0.02], [0.17, 0.04, 0.11], [0, 0, s * -0.35]);
    P(g, SPH(8, 6), mat(0x5fb83a), [0, 0.42, 0.06], [0.06, 0.1, 0.05]);
    P(g, CYL(5), mat(0xc8a06a), [0.32, 0.25, -0.2], [0.025, 0.5, 0.025]);
    P(g, BOX(), mat(tint), [0.32, 0.45, -0.2], [0.16, 0.12, 0.02]);
    out.height = 0.55;
    return out;
  }
  switch (type) {
    case 'daisy': {
      const h = [0, 0, 0.55, 0.8, 0.95][stage];
      stem(g, h);
      leaf(g, 0.12, 0.35, 0.3); leaf(g, 0.22, 0.32, 2.4); leaf(g, 0.35, 0.28, 4.3);
      if (stage === 3) P(g, SPH(8, 6), mat(0xd6f5c0), [0, h, 0], 0.09);
      if (stage === 4) {
        const head = grp(g, [0, h, 0], [0.9, 0, 0]);
        petals(head, 12, 0.3, 0.07, 0xffffff, 0.15);
        P(head, SPH(10, 6), mat(0xffd21f), [0, 0.02, 0], [0.1, 0.05, 0.1]);
        out.head = head;
      }
      out.height = h + 0.3;
      break;
    }
    case 'marigold': {
      for (let i = 0; i < 5; i++) P(g, ICO(0), mat(DGREEN, { flat: true }), [Math.cos(i * 1.3) * 0.18, 0.18 + (i % 2) * 0.12, Math.sin(i * 1.3) * 0.18], 0.18);
      if (stage >= 3) {
        const big = stage === 4;
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1;
          stem(g, 0.5, 0.025);
          P(g, ICO(1), mat(big ? 0xff9a1f : 0x9ccc65, { flat: true }), [Math.cos(a) * 0.15, big ? 0.55 : 0.45, Math.sin(a) * 0.15], big ? 0.17 : 0.08);
        }
      }
      out.height = stage === 4 ? 0.9 : 0.6;
      break;
    }
    case 'tomato': {
      P(g, CYL(6), mat(0x8d6e4b), [0, 0.6, -0.15], [0.025, 1.2, 0.025]);
      const n = stage === 2 ? 3 : 5;
      for (let i = 0; i < n; i++) P(g, ICO(0), mat(i % 2 ? GREEN : DGREEN, { flat: true }), [Math.cos(i * 1.7) * 0.2, 0.25 + i * 0.14, Math.sin(i * 1.7) * 0.2], 0.2);
      if (stage === 3) for (let i = 0; i < 4; i++) P(g, SPH(8, 6), mat(0x9ccc65), [Math.cos(i * 1.6) * 0.28, 0.4 + (i % 2) * 0.25, Math.sin(i * 1.6) * 0.28], 0.07);
      if (stage === 4) for (let i = 0; i < 5; i++) P(g, SPH(10, 8), mat(0xe8302a, { roughness: 0.4 }), [Math.cos(i * 1.3) * 0.3, 0.35 + (i % 3) * 0.2, Math.sin(i * 1.3) * 0.3], 0.11);
      out.height = 1.2;
      break;
    }
    case 'sunflower': {
      const h = [0, 0, 1.1, 1.9, 2.5][stage];
      stem(g, h, 0.07, 0x6a9a3a);
      for (let i = 0; i < 4; i++) leaf(g, 0.3 + i * h * 0.18, 0.55, i * 1.9, 0.3, 0x5a9a3a);
      if (stage === 3) P(g, SPH(10, 8), mat(0x7cb342), [0, h, 0.05], [0.22, 0.18, 0.22]);
      if (stage === 4) {
        const head = grp(g, [0, h, 0.05], [1.25, 0, 0]);
        petals(head, 16, 0.45, 0.1, 0xffd21f, 0.1);
        P(head, CYL(16), mat(0x5a3a1a), [0, 0.03, 0], [0.33, 0.08, 0.33]);
        out.head = head;
      }
      out.height = h + 0.4;
      break;
    }
    case 'flytrap': {
      const n = [0, 0, 2, 3, 5][stage];
      const s = [0, 0, 0.6, 0.8, 1][stage];
      for (let i = 0; i < n; i++) {
        const t = grp(g, [0, 0, 0], [0, (i / n) * Math.PI * 2, 0]);
        const arm = grp(t, [0.08, 0.05, 0], [0, 0, -0.7]);
        P(arm, CYL(5), mat(0x6abf3a), [0, 0.2 * s, 0], [0.025, 0.4 * s, 0.025]);
        const head = grp(arm, [0, 0.42 * s, 0], [0, 0, 0.5]);
        P(head, HEMI(), mat(0x7bc043), [0, 0, 0], [0.18 * s, 0.1 * s, 0.13 * s], [Math.PI, 0, 0]);
        const top = grp(head, [0, 0, 0]);
        P(top, HEMI(), mat(0xc0392b), [0, 0, 0], [0.18 * s, 0.1 * s, 0.13 * s]);
        top.rotation.x = -0.6;
        out.traps.push(top);
      }
      out.height = 0.8;
      break;
    }
    case 'rose': {
      for (let i = 0; i < 6; i++) P(g, ICO(0), mat(i % 2 ? 0x2e6b30 : 0x3a7d3c, { flat: true }), [Math.cos(i * 1.1) * 0.25, 0.25 + (i % 3) * 0.18, Math.sin(i * 1.1) * 0.25], 0.22);
      if (stage >= 3) {
        const big = stage === 4;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26;
          P(g, ICO(0), mat(big ? 0xd8173a : 0x8b1a2b, { flat: true }), [Math.cos(a) * 0.3, 0.55 + (i % 2) * 0.15, Math.sin(a) * 0.3], big ? 0.13 : 0.06);
        }
      }
      out.height = 1.0;
      break;
    }
    case 'strawberry': {
      for (let i = 0; i < 7; i++) P(g, SPH(8, 6), mat(i % 2 ? 0x3f8f3a : 0x4fa646, { flat: true }), [Math.cos(i * 0.9) * 0.24, 0.12 + (i % 3) * 0.06, Math.sin(i * 0.9) * 0.24], [0.17, 0.08, 0.15], [0, i, 0]);
      if (stage === 3) for (let i = 0; i < 4; i++) P(g, ICO(0), mat(0xffffff, { flat: true }), [Math.cos(i * 1.6 + 0.4) * 0.28, 0.3, Math.sin(i * 1.6 + 0.4) * 0.28], 0.06);
      if (stage === 4) {
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + 0.3;
          const b = grp(g, [Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32], [Math.PI + Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]);
          P(b, CONE(8), mat(0xe5303f, { roughness: 0.45 }), [0, 0.06, 0], [0.08, 0.15, 0.08]);
          P(b, CONE(5), mat(0x3f8f3a), [0, -0.03, 0], [0.07, 0.03, 0.07], [Math.PI, 0, 0]);
        }
      }
      out.height = stage === 4 ? 0.45 : 0.35;
      break;
    }
    case 'carrot': {
      const n = [0, 0, 4, 6, 8][stage], h = [0, 0, 0.35, 0.5, 0.65][stage];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        P(g, CONE(5), mat(i % 2 ? 0x5fb83a : 0x4a9a32, { flat: true }), [Math.cos(a) * 0.07, h / 2, Math.sin(a) * 0.07], [0.07, h, 0.07], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]);
      }
      if (stage === 4) P(g, CONE(10), mat(0xff8a1f), [0, 0.02, 0], [0.16, 0.22, 0.16], [Math.PI, 0, 0]);
      out.height = h + 0.15;
      break;
    }
    case 'corn': {
      const h = [0, 0, 0.9, 1.5, 2.0][stage];
      stem(g, h, 0.06, 0x7aa83a);
      for (let i = 0; i < 5; i++) leaf(g, 0.2 + i * h * 0.16, 0.6, i * 2.3, 0.55, i % 2 ? 0x6aa83a : 0x5a9a32);
      if (stage >= 3) P(g, CONE(6), mat(stage === 4 ? 0xd9b65a : 0xb8c86a), [0, h + 0.12, 0], [0.08, 0.3, 0.08]);
      if (stage === 4) {
        for (const s of [-1, 1]) {
          const cob = grp(g, [s * 0.1, h * 0.55, 0.04], [0, 0, s * -0.35]);
          P(cob, CYL(8), mat(0xf5d142, { roughness: 0.5 }), [0, 0.12, 0], [0.07, 0.28, 0.07]);
          P(cob, CONE(6), mat(0x8bc34a), [0, 0.07, 0], [0.09, 0.3, 0.09]);
        }
      }
      out.height = h + 0.3;
      break;
    }
    case 'watermelon': {
      for (let i = 0; i < 6; i++) leaf(g, 0.05, 0.55, i * 1.05 + 0.2, -0.15, i % 2 ? 0x4a8a3a : 0x3f7f34);
      if (stage >= 3) {
        const fruit = grp(g, [0.1, 0, 0.15]);
        const ripe = stage === 4;
        const r = ripe ? 0.38 : 0.16;
        P(fruit, SPH(14, 10), mat(ripe ? 0x3f9a3a : 0x8bc34a, { roughness: 0.4 }), [0, r * 0.7, 0], [r * 1.3, r * 0.75, r]);
        if (ripe) for (let i = 0; i < 5; i++) P(fruit, SPH(10, 8), mat(0x1f5f22, { roughness: 0.4 }), [0, r * 0.7, 0], [r * 1.31, r * 0.755, r * 0.18], [i * 0.62, 0, 0]);
        out.fruit = fruit;
      }
      out.height = stage === 4 ? 0.7 : 0.4;
      break;
    }
    case 'pumpkin': {
      for (let i = 0; i < 5; i++) leaf(g, 0.05, 0.7, i * 1.25 + 0.3, -0.1, 0x4a8a3a);
      if (stage >= 3) {
        const fruit = grp(g, [0.15, 0, 0.2]);
        const ripe = stage === 4;
        const c = ripe ? 0xff7a1a : 0x8bc34a;
        const r = ripe ? 0.45 : 0.18;
        P(fruit, SPH(14, 10), mat(c), [0, r * 0.75, 0], [r, r * 0.78, r]);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          P(fruit, SPH(10, 8), mat(c), [Math.cos(a) * r * 0.42, r * 0.75, Math.sin(a) * r * 0.42], [r * 0.62, r * 0.76, r * 0.62]);
        }
        P(fruit, CYL(6), mat(0x5d4037), [0, r * 1.5, 0], [0.05, 0.2, 0.05], [0.2, 0, 0.1]);
        out.fruit = fruit;
      }
      out.height = stage === 4 ? 1.0 : 0.5;
      break;
    }
  }
  return out;
}

export function makeHeart() {
  const g = new THREE.Group();
  P(g, CYL(10), mat(0x4a8a3a), [0, 1.6, 0], [0.32, 3.2, 0.32]);
  for (let i = 0; i < 5; i++) leaf(g, 0.2 + i * 0.25, 2.2, i * 1.3, 0.25, i % 2 ? 0x3e8a3e : 0x52a447);
  const head = grp(g, [0, 3.3, 0]);
  const petalsArr = [];
  for (let i = 0; i < 12; i++) {
    const p = grp(head, [0, 0, 0], [0, (i / 12) * Math.PI * 2, 0]);
    const pivot = grp(p, [0.3, 0, 0], [0, 0, 0.35]);
    P(pivot, SPH(10, 6), mat(0xff6fa8), [0.85, 0, 0], [0.9, 0.08, 0.38]);
    petalsArr.push(pivot);
  }
  for (let i = 0; i < 8; i++) {
    const p = grp(head, [0, 0.12, 0], [0, (i / 8) * Math.PI * 2 + 0.3, 0]);
    P(p, SPH(10, 6), mat(0xffb3d1), [0.55, 0, 0], [0.55, 0.07, 0.28], [0, 0, 0.6]);
  }
  const core = P(head, SPH(16, 12), mat(0xffd54f, { emissive: 0xffb300, emissiveIntensity: 0.7 }), [0, 0.2, 0], [0.55, 0.35, 0.55]);
  return { group: g, head, petals: petalsArr, core };
}

// ───────────────────────── Enemies ─────────────────────────
const wingMat = () => mat(0xffffff, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });

export function makeEnemy(type) {
  const g = new THREE.Group();
  const o = { group: g, wings: [], legs: [], head: null, body: null, mound: null };
  switch (type) {
    case 'fly': {
      P(g, SPH(8, 6), mat(0x222222), [0, 0, 0], [0.16, 0.14, 0.2]);
      P(g, SPH(6, 4), glow(0xff2222, 0.8), [0.07, 0.04, 0.17], 0.05);
      P(g, SPH(6, 4), glow(0xff2222, 0.8), [-0.07, 0.04, 0.17], 0.05);
      for (const s of [-1, 1]) {
        const w = grp(g, [s * 0.05, 0.1, 0]);
        P(w, PLANE(), wingMat(), [s * 0.17, 0, -0.03], [0.32, 0.16, 1], [Math.PI / 2, 0, 0], false);
        o.wings.push(w);
      }
      break;
    }
    case 'crow': {
      P(g, SPH(10, 8), mat(0x1c1c24), [0, 0, 0], [0.3, 0.28, 0.5]);
      P(g, SPH(10, 8), mat(0x1c1c24), [0, 0.2, 0.42], 0.2);
      P(g, CONE(6), mat(0xffa000), [0, 0.17, 0.68], [0.07, 0.22, 0.07], [Math.PI / 2, 0, 0]);
      P(g, SPH(6, 4), glow(0xffeb3b, 0.6), [0.1, 0.26, 0.55], 0.035);
      P(g, SPH(6, 4), glow(0xffeb3b, 0.6), [-0.1, 0.26, 0.55], 0.035);
      P(g, BOX(), mat(0x1c1c24), [0, 0.05, -0.55], [0.25, 0.04, 0.35], [0.2, 0, 0]);
      for (const s of [-1, 1]) {
        const w = grp(g, [s * 0.22, 0.1, 0]);
        P(w, BOX(), mat(0x24242e), [s * 0.4, 0, 0], [0.8, 0.04, 0.38]);
        o.wings.push(w);
      }
      break;
    }
    case 'mole': {
      o.mound = P(g, HEMI(), mat(0x5d3a1f), [0, 0, 0], [0.55, 0.28, 0.55]);
      const b = grp(g);
      P(b, SPH(10, 8), mat(0x4a3b33), [0, 0.25, 0], [0.38, 0.4, 0.38]);
      P(b, SPH(8, 6), mat(0xff8fa3), [0, 0.35, 0.36], 0.08);
      P(b, SPH(6, 4), mat(0x111111), [0.12, 0.45, 0.3], 0.03);
      P(b, SPH(6, 4), mat(0x111111), [-0.12, 0.45, 0.3], 0.03);
      P(b, BOX(), mat(0xff8fa3), [0.3, 0.2, 0.25], [0.15, 0.05, 0.12]);
      P(b, BOX(), mat(0xff8fa3), [-0.3, 0.2, 0.25], [0.15, 0.05, 0.12]);
      o.body = b;
      break;
    }
    case 'slug': {
      P(g, SPH(12, 8), mat(0xb5a642, { roughness: 0.3 }), [0, 0.17, 0], [0.28, 0.2, 0.7]);
      P(g, SPH(10, 8), mat(0x8d6e2b, { roughness: 0.4 }), [0, 0.32, -0.12], [0.25, 0.22, 0.3]);
      for (const s of [-1, 1]) {
        P(g, CYL(5), mat(0xb5a642), [s * 0.08, 0.38, 0.52], [0.025, 0.25, 0.025], [0.5, 0, s * 0.3]);
        P(g, SPH(6, 4), mat(0x111111), [s * 0.12, 0.5, 0.58], 0.045);
      }
      break;
    }
    case 'moth': {
      P(g, SPH(8, 6), mat(0xd8cfb8), [0, 0, 0], [0.1, 0.1, 0.28]);
      for (const s of [-1, 1]) {
        const w = grp(g, [s * 0.05, 0.03, 0]);
        P(w, DISC(12), mat(0xe8dcc0, { side: THREE.DoubleSide, emissive: 0x332a10, emissiveIntensity: 0.4 }), [s * 0.32, 0, 0], [0.34, 0.26, 1], [Math.PI / 2, 0, 0], false);
        o.wings.push(w);
      }
      break;
    }
    case 'deer':
    case 'stag': {
      const boss = type === 'stag';
      const c = boss ? 0xdce6f5 : 0x9a6a3e;
      const body = grp(g);
      P(body, SPH(12, 8), mat(c), [0, 1.25, 0], [0.45, 0.5, 0.95]);
      for (const [x, z] of [[-0.25, 0.6], [0.25, 0.6], [-0.25, -0.6], [0.25, -0.6]]) {
        const l = grp(body, [x, 1.05, z]);
        P(l, CYL(6), mat(c), [0, -0.5, 0], [0.07, 1.0, 0.07]);
        P(l, BOX(), mat(0x222222), [0, -1.0, 0.02], [0.1, 0.08, 0.12]);
        o.legs.push(l);
      }
      P(body, CYL(8), mat(c), [0, 1.7, 0.8], [0.15, 0.8, 0.15], [0.6, 0, 0]);
      const head = grp(body, [0, 2.05, 1.08]);
      P(head, SPH(10, 8), mat(c), [0, 0, 0.1], [0.22, 0.22, 0.36]);
      P(head, SPH(6, 4), mat(0x111111), [0, -0.02, 0.45], 0.06);
      const eye = boss ? glow(0x80deea, 3) : glow(0xfff59d, 1.2);
      P(head, SPH(6, 4), eye, [0.13, 0.08, 0.22], 0.045);
      P(head, SPH(6, 4), eye, [-0.13, 0.08, 0.22], 0.045);
      for (const s of [-1, 1]) {
        P(head, CONE(5), mat(c), [s * 0.2, 0.18, -0.05], [0.08, 0.22, 0.04], [0, 0, -s * 0.8]);
        const am = boss ? glow(0x80deea, 2) : mat(0xd7c4a3);
        P(head, CYL(5), am, [s * 0.12, 0.38, -0.05], [0.03, 0.45, 0.03], [0, 0, -s * 0.4]);
        P(head, CYL(5), am, [s * 0.26, 0.58, 0.02], [0.025, 0.3, 0.025], [0.4, 0, -s * 0.9]);
        P(head, CYL(5), am, [s * 0.2, 0.62, -0.12], [0.025, 0.25, 0.025], [-0.4, 0, -s * 0.2]);
      }
      P(body, SPH(6, 4), mat(0xffffff), [0, 1.45, -0.95], 0.12);
      o.head = head; o.body = body;
      if (boss) g.scale.setScalar(2.1);
      break;
    }
    case 'raccoon': {
      const body = grp(g);
      P(body, SPH(10, 8), mat(0x7d7d85), [0, 0.45, 0], [0.4, 0.32, 0.6]);
      const head = grp(body, [0, 0.66, 0.55]);
      P(head, SPH(10, 8), mat(0x8d8d95), [0, 0, 0], 0.27);
      P(head, SPH(8, 6), mat(0x1a1a1a), [0, 0.05, 0.08], [0.28, 0.1, 0.24]);
      P(head, CONE(6), mat(0xd9d9d9), [0, -0.05, 0.3], [0.1, 0.2, 0.1], [Math.PI / 2, 0, 0]);
      P(head, SPH(6, 4), mat(0x111111), [0, -0.05, 0.4], 0.04);
      P(head, SPH(6, 4), glow(0xfff59d, 0.8), [0.1, 0.07, 0.22], 0.035);
      P(head, SPH(6, 4), glow(0xfff59d, 0.8), [-0.1, 0.07, 0.22], 0.035);
      for (const s of [-1, 1]) P(head, CONE(4), mat(0x6d6d75), [s * 0.17, 0.25, -0.05], [0.08, 0.15, 0.05]);
      for (let i = 0; i < 5; i++) P(body, CYL(8), mat(i % 2 ? 0x2a2a2a : 0x9a9aa2), [0, 0.5 + i * 0.07, -0.6 - i * 0.12], [0.13 - i * 0.012, 0.13, 0.13 - i * 0.012], [-1.0, 0, 0]);
      for (const [x, z] of [[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]]) {
        const l = grp(body, [x, 0.3, z]);
        P(l, CYL(6), mat(0x3a3a3a), [0, -0.15, 0], [0.07, 0.3, 0.07]);
        o.legs.push(l);
      }
      o.head = head; o.body = body;
      break;
    }
  }
  return o;
}

// ───────────────────────── Placeables ─────────────────────────
export function makePlaceable(type) {
  const g = new THREE.Group();
  const o = { group: g, bulb: null, head: null, cage: null, bees: [] };
  switch (type) {
    case 'fence':
      for (const x of [-0.85, 0, 0.85]) P(g, BOX(), mat(0xc8a06a), [x, 0.6, 0], [0.16, 1.2, 0.16]);
      P(g, BOX(), mat(0xb08850), [0, 0.45, 0], [1.9, 0.14, 0.08]);
      P(g, BOX(), mat(0xb08850), [0, 0.95, 0], [1.9, 0.14, 0.08]);
      break;
    case 'sellbox':
      // little wooden market cart: crate counter, striped canopy, coin pile and a price tag
      P(g, BOX(), mat(0xb08850), [0, 0.45, 0], [1.4, 0.9, 1.0]);
      P(g, BOX(), mat(0x8d6e4b), [0, 0.93, 0], [1.5, 0.08, 1.1]);
      for (const x of [-0.68, 0.68]) P(g, CYL(6), mat(WOOD), [x, 1.45, -0.4], [0.04, 1.1, 0.04]);
      for (let i = 0; i < 4; i++) P(g, BOX(), mat(i % 2 ? 0xffffff : 0xe6a817), [-0.54 + i * 0.36, 2.0, -0.15], [0.36, 0.06, 0.8], [0.3, 0, 0]);
      for (let i = 0; i < 5; i++) P(g, CYL(10), mat(0xffd54f, { metalness: 0.7, roughness: 0.3, emissive: 0x553300 }), [0.35 + (i % 2) * 0.05, 1.0 + i * 0.05, 0.1], [0.12, 0.04, 0.12]);
      P(g, BOX(), mat(0xfff3c4), [-0.35, 1.15, 0.2], [0.35, 0.22, 0.03], [0, 0, 0.3]);
      P(g, SPH(6, 4), mat(0xd84336), [-0.48, 1.2, 0.22], 0.03);
      break;
    case 'scarecrow':
      P(g, CYL(6), mat(WOOD), [0, 1.1, 0], [0.06, 2.2, 0.06]);
      P(g, BOX(), mat(WOOD), [0, 1.55, 0], [1.4, 0.08, 0.08]);
      P(g, BOX(), mat(0xc0392b), [0, 1.35, 0], [0.6, 0.6, 0.3]);
      P(g, BOX(), mat(0xc0392b), [0.45, 1.55, 0], [0.4, 0.18, 0.2]);
      P(g, BOX(), mat(0xc0392b), [-0.45, 1.55, 0], [0.4, 0.18, 0.2]);
      P(g, SPH(10, 8), mat(0xd9c38a), [0, 1.95, 0], 0.24);
      P(g, CYL(14), mat(0xe8c95a), [0, 2.12, 0], [0.45, 0.04, 0.45]);
      P(g, CONE(10), mat(0xe8c95a), [0, 2.3, 0], [0.22, 0.35, 0.22]);
      P(g, SPH(6, 4), mat(0x111111), [0.08, 2.0, 0.21], 0.03);
      P(g, SPH(6, 4), mat(0x111111), [-0.08, 2.0, 0.21], 0.03);
      break;
    case 'lamp':
      P(g, CYL(8), mat(0x37474f), [0, 0.1, 0], [0.3, 0.2, 0.3]);
      P(g, CYL(6), mat(0x455a64), [0, 1.2, 0], [0.06, 2.3, 0.06]);
      P(g, CONE(10), mat(0x37474f), [0, 2.55, 0], [0.38, 0.25, 0.38]);
      o.bulb = P(g, SPH(10, 8), glow(0xfff1a8, 2.5), [0, 2.32, 0], 0.2, [0, 0, 0], false);
      break;
    case 'sprinkler': {
      P(g, CYL(10), mat(0x78909c), [0, 0.1, 0], [0.25, 0.2, 0.25]);
      P(g, CYL(6), mat(0x90a4ae), [0, 0.35, 0], [0.05, 0.3, 0.05]);
      const h = grp(g, [0, 0.5, 0]);
      P(h, BOX(), mat(0xffc107), [0, 0, 0], [0.7, 0.06, 0.08]);
      P(h, SPH(6, 4), mat(0x29b6f6), [0.35, 0.02, 0], 0.06);
      o.head = h;
      break;
    }
    case 'beertrap':
      // a shallow dish of beer with a foamy head, sunk into the ground
      P(g, CYL(14), mat(0x8d6e63), [0, 0.08, 0], [0.45, 0.16, 0.45]);
      P(g, DISC(16), mat(0xffb300, { roughness: 0.15, emissive: 0x553300 }), [0, 0.17, 0], 0.38, [-Math.PI / 2, 0, 0], false);
      for (let i = 0; i < 6; i++) P(g, SPH(6, 4), mat(0xfff8e1), [Math.cos(i * 1.05) * 0.24, 0.18, Math.sin(i * 1.05) * 0.24], [0.1, 0.05, 0.1]);
      break;
    case 'barrel':
      P(g, CYL(12), mat(0x8a5a2c), [0, 0.55, 0], [0.55, 1.1, 0.55]);
      P(g, CYL(12), mat(0x333333), [0, 0.3, 0], [0.57, 0.06, 0.57]);
      P(g, CYL(12), mat(0x333333), [0, 0.85, 0], [0.57, 0.06, 0.57]);
      P(g, DISC(16), mat(0x4fc3f7, { roughness: 0.1 }), [0, 1.08, 0], 0.5, [-Math.PI / 2, 0, 0], false);
      break;
    case 'compost':
      // open slatted wooden bin heaped with green scraps
      for (const [x, z, r] of [[0, 0.55, 0], [0, -0.55, 0], [0.55, 0, 1], [-0.55, 0, 1]]) {
        for (let k = 0; k < 3; k++) P(g, BOX(), mat(k % 2 ? 0x8d6e4b : 0xa1784f), [x, 0.2 + k * 0.3, z], [1.15, 0.22, 0.08], [0, r * Math.PI / 2, 0]);
      }
      for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) P(g, BOX(), mat(0x5d4037), [x, 0.5, z], [0.12, 1.0, 0.12]);
      P(g, HEMI(), mat(0x5d4037), [0, 0.6, 0], [0.5, 0.35, 0.5]);
      for (let i = 0; i < 5; i++) P(g, ICO(0), mat(i % 2 ? 0x7cb342 : 0x9ccc65, { flat: true }), [Math.cos(i * 1.3) * 0.25, 0.8, Math.sin(i * 1.3) * 0.25], 0.13);
      break;
    case 'zapper':
      P(g, CYL(8), mat(0x37474f), [0, 0.1, 0], [0.3, 0.2, 0.3]);
      P(g, CYL(6), mat(0x455a64), [0, 0.8, 0], [0.05, 1.4, 0.05]);
      o.cage = P(g, CYL(10), mat(0x40c4ff, { emissive: 0x40c4ff, emissiveIntensity: 1.5, transparent: true, opacity: 0.7 }), [0, 1.75, 0], [0.28, 0.6, 0.28], [0, 0, 0], false);
      P(g, CONE(10), mat(0x37474f), [0, 2.2, 0], [0.34, 0.25, 0.34]);
      break;
    case 'ladybugs':
      P(g, CYL(6), mat(WOOD), [0, 0.6, 0], [0.06, 1.2, 0.06]);
      P(g, BOX(), mat(0xe53935), [0, 1.35, 0], [0.55, 0.5, 0.45]);
      P(g, CONE(4), mat(0x5d4037), [0, 1.8, 0], [0.48, 0.4, 0.42], [0, Math.PI / 4, 0]);
      P(g, SPH(6, 4), mat(0x111111), [0, 1.35, 0.23], 0.08);
      for (let i = 0; i < 4; i++) P(g, SPH(6, 4), mat(0x111111), [Math.cos(i) * 0.2, 1.2 + (i % 2) * 0.2, 0.23], 0.04);
      break;
    case 'beehive':
      for (let i = 0; i < 3; i++) P(g, BOX(), mat(i % 2 ? 0xf9c74f : 0xf3b13a), [0, 0.3 + i * 0.42, 0], [0.9 - i * 0.04, 0.4, 0.75 - i * 0.04]);
      P(g, BOX(), mat(0xffffff), [0, 1.55, 0], [1.0, 0.1, 0.85]);
      P(g, BOX(), mat(0x3e2723), [0, 0.15, 0.38], [0.3, 0.08, 0.02]);
      for (let i = 0; i < 4; i++) o.bees.push(P(g, SPH(6, 4), mat(0xffd600, { emissive: 0x332200 }), [0, 1, 0], 0.07, [0, 0, 0], false));
      break;
  }
  return o;
}

// ───────────────────────── Items ─────────────────────────
// Emoji painted onto a canvas texture (seed packet pictures).
const emojiTexCache = new Map();
export function emojiTex(icon, bg = null) {
  const key = icon + '|' + bg;
  if (emojiTexCache.has(key)) return emojiTexCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 128, 128); }
  x.font = '92px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(icon, 64, 72);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  emojiTexCache.set(key, t);
  return t;
}

// Bags (worn per gnome). Built standing on y=0.
export function makeBag(key) {
  if (key === 'wheelbarrow') return makeWheelbarrow();
  const g = new THREE.Group();
  if (key === 'satchel') {
    const cloth = mat(0xa1887f);
    P(g, BOX(), cloth, [0, 0.2, 0], [0.42, 0.34, 0.16]);
    P(g, BOX(), mat(0x8d6e63), [0, 0.32, 0.085], [0.43, 0.14, 0.02]); // flap
    P(g, TORUS(), mat(0x6d4c41), [0, 0.42, 0], [0.2, 0.2, 0.2], [0, Math.PI / 2, 0]); // strap
  } else {
    const cloth = mat(0x2e7d6b);
    P(g, BOX(), cloth, [0, 0.3, 0], [0.42, 0.56, 0.26]);
    P(g, SPH(10, 6), cloth, [0, 0.58, 0], [0.21, 0.08, 0.13]);
    P(g, BOX(), mat(0x26a69a), [0, 0.2, 0.15], [0.3, 0.22, 0.08]); // front pocket
    P(g, BOX(), mat(0xffc107), [0, 0.42, 0.135], [0.06, 0.06, 0.02]); // buckle
    for (const sx of [-1, 1]) P(g, BOX(), mat(0x1b5e50), [sx * 0.12, 0.32, -0.15], [0.05, 0.48, 0.03]);
  }
  return g;
}

function makeWheelbarrow() {
  const g = new THREE.Group();
  const red = mat(0xd84336);
  P(g, BOX(), red, [0, 0.45, 0], [0.6, 0.12, 0.8]);
  P(g, BOX(), red, [0, 0.58, 0.38], [0.6, 0.3, 0.06], [0.35, 0, 0]);
  P(g, BOX(), red, [0, 0.58, -0.38], [0.6, 0.3, 0.06], [-0.35, 0, 0]);
  for (const s of [-1, 1]) P(g, BOX(), red, [s * 0.32, 0.58, 0], [0.06, 0.3, 0.8], [0, 0, -s * 0.35]);
  P(g, CYL(14), mat(0x333333), [0, 0.2, 0.62], [0.2, 0.1, 0.2], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) {
    P(g, CYL(6), mat(WOOD), [s * 0.22, 0.42, -0.25], [0.035, 1.2, 0.035], [Math.PI / 2 - 0.25, 0, 0]);
    P(g, CYL(6), mat(0x5d4037), [s * 0.22, 0.2, -0.3], [0.03, 0.4, 0.03]);
  }
  return g;
}

// A soft ring under everything you can pick up. Same marker everywhere = "this is interactable".
export function makePickupRing(color = 0xffffff) {
  const m = new THREE.Mesh(RING(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function makeItem(kind) {
  const g = new THREE.Group();
  const [k, sub] = kind.split(':');
  if (k === 'tool') {
    // a dropped tool lies on the ground on a little glowing pad so it's easy to spot
    P(g, CYL(16), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4, transparent: true, opacity: 0.35 }), [0, 0.02, 0], [0.55, 0.02, 0.55], [0, 0, 0], false);
    const t = makeTool(sub);
    t.rotation.set(Math.PI / 2, 0, 0.4);
    t.position.set(0, 0.15, -0.3);
    g.add(t);
    return g;
  }
  switch (k) {
    case 'weed':
      for (let i = 0; i < 4; i++) P(g, CONE(4), mat(0x7a9a1f, { flat: true }), [Math.cos(i * 1.6) * 0.08, 0.16, Math.sin(i * 1.6) * 0.08], [0.07, 0.34, 0.07], [Math.cos(i * 1.6) * 0.4, 0, Math.sin(i * 1.6) * 0.4]);
      P(g, ICO(0), mat(0xffeb3b, { flat: true }), [0, 0.32, 0], 0.08);
      P(g, SPH(6, 4), mat(0x6d4c2f), [0, 0.03, 0], [0.12, 0.06, 0.12]);
      break;
    case 'junk': {
      // an old boot with a hole in the toe
      const leather = mat(0x6d4c41);
      P(g, BOX(), leather, [0, 0.2, -0.06], [0.2, 0.36, 0.18]);
      P(g, SPH(10, 8), leather, [0, 0.09, 0.12], [0.11, 0.09, 0.2]);
      P(g, BOX(), mat(0x3e2723), [0, 0.015, 0.04], [0.22, 0.03, 0.46]);
      P(g, CYL(10), mat(0x3e2723), [0, 0.38, -0.06], [0.11, 0.03, 0.1]);
      P(g, SPH(6, 4), mat(0xf6c9a4), [0.03, 0.14, 0.3], 0.035);
      break;
    }
    case 'dew': {
      const water = mat(0x7fdcff, { transparent: true, opacity: 0.8, roughness: 0.05, emissive: 0x1a6a8a, emissiveIntensity: 0.7 });
      P(g, SPH(14, 10), water, [0, 0.2, 0], 0.17);
      P(g, CONE(14), water, [0, 0.42, 0], [0.12, 0.2, 0.12]);
      P(g, SPH(6, 4), mat(0xffffff, { emissive: 0xffffff }), [0.06, 0.26, 0.12], 0.035, [0, 0, 0], false);
      break;
    }
    case 'coin':
      P(g, CYL(16), mat(0xffd54f, { metalness: 0.8, roughness: 0.25, emissive: 0x996600, emissiveIntensity: 0.6 }), [0, 0.3, 0], [0.24, 0.06, 0.24], [Math.PI / 2, 0, 0]);
      P(g, BOX(), mat(0xffa000, { metalness: 0.8, roughness: 0.3 }), [0, 0.3, 0.04], [0.06, 0.2, 0.02]);
      break;
    case 'seed': {
      // a seed packet: plant-colored paper with a picture of the plant on the front
      P(g, BOX(), mat(PLANT_COLORS[sub] ?? 0xffffff), [0, 0.24, 0], [0.34, 0.46, 0.05]);
      P(g, BOX(), mat(0xfafafa), [0, 0.46, 0], [0.34, 0.04, 0.055]);
      const pic = new THREE.MeshBasicMaterial({ map: emojiTex(PLANTS[sub]?.icon ?? '🌱', '#fffdf5'), toneMapped: false });
      P(g, PLANE(), pic, [0, 0.22, 0.027], [0.27, 0.27, 1], [0, 0, 0], false);
      P(g, PLANE(), pic, [0, 0.22, -0.027], [0.27, 0.27, 1], [0, Math.PI, 0], false);
      break;
    }
    case 'produce': {
      const c = PLANT_COLORS[sub];
      if (sub === 'sunflower') {
        P(g, CYL(14), mat(0x5a3a1a), [0, 0.25, 0], [0.2, 0.05, 0.2], [Math.PI / 2, 0, 0]);
        P(g, CYL(14), mat(c), [0, 0.25, -0.02], [0.3, 0.03, 0.3], [Math.PI / 2, 0, 0]);
      } else if (sub === 'daisy' || sub === 'rose' || sub === 'marigold') {
        for (let i = 0; i < 3; i++) {
          P(g, CYL(5), mat(STEM), [i * 0.07 - 0.07, 0.15, 0], [0.015, 0.3, 0.015]);
          P(g, ICO(0), mat(c, { flat: true }), [i * 0.07 - 0.07, 0.32, 0], 0.08);
        }
      } else if (sub === 'flytrap') {
        P(g, HEMI(), mat(0x7bc043), [0, 0.1, 0], [0.2, 0.15, 0.15]);
        P(g, HEMI(), mat(0xc0392b), [0, 0.1, 0], [0.2, 0.12, 0.15], [Math.PI, 0, 0]);
      } else if (sub === 'carrot') {
        for (let i = 0; i < 2; i++) {
          P(g, CONE(8), mat(c), [i * 0.12 - 0.06, 0.08, 0], [0.07, 0.3, 0.07], [Math.PI / 2, i * 0.4, 0]);
          P(g, CONE(5), mat(0x5fb83a), [i * 0.12 - 0.06, 0.08, -0.2], [0.06, 0.14, 0.06], [-Math.PI / 2, 0, 0]);
        }
      } else if (sub === 'corn') {
        P(g, CYL(8), mat(c), [0, 0.1, 0], [0.08, 0.36, 0.08], [Math.PI / 2, 0, 0]);
        P(g, CONE(6), mat(0x8bc34a), [0, 0.1, -0.12], [0.1, 0.3, 0.1], [-Math.PI / 2, 0, 0]);
      } else if (sub === 'watermelon') {
        P(g, SPH(12, 8), mat(c, { roughness: 0.4 }), [0, 0.22, 0], [0.34, 0.22, 0.26]);
        for (let i = 0; i < 4; i++) P(g, SPH(10, 6), mat(0x1f5f22, { roughness: 0.4 }), [0, 0.22, 0], [0.345, 0.225, 0.05], [i * 0.8, 0, 0]);
      } else {
        const r = sub === 'pumpkin' ? 0.3 : 0.16;
        P(g, SPH(12, 8), mat(c, { roughness: 0.4 }), [0, r, 0], [r, r * 0.85, r]);
        P(g, CYL(5), mat(0x5d4037), [0, r * 1.9, 0], [0.03, 0.1, 0.03]);
      }
      break;
    }
    case 'soil':
      // a burlap sack, open at the top, full of dark soil
      P(g, SPH(12, 8), mat(0xc8a26a), [0, 0.22, 0], [0.24, 0.26, 0.2]);
      P(g, CYL(12), mat(0xc8a26a), [0, 0.42, 0], [0.18, 0.1, 0.15]);
      P(g, HEMI(), mat(0x3e2723), [0, 0.46, 0], [0.16, 0.08, 0.13]);
      P(g, BOX(), mat(0x6d4c2f), [0, 0.22, 0.2], [0.18, 0.12, 0.01]);
      break;
    case 'fertilizer':
      // a jug of green plant food with a leaf label
      P(g, CYL(12), mat(0xffffff), [0, 0.2, 0], [0.15, 0.4, 0.15]);
      P(g, CYL(12), mat(0x43a047), [0, 0.2, 0], [0.155, 0.16, 0.155]);
      P(g, CYL(8), mat(0x2e7d32), [0, 0.44, 0], [0.07, 0.08, 0.07]);
      P(g, SPH(8, 6), mat(0xaed581), [0, 0.2, 0.15], [0.07, 0.04, 0.02], [0, 0, 0.6]);
      break;
    case 'mulch':
      // a pink sack of petal mulch
      P(g, SPH(12, 8), mat(0xf8bbd0), [0, 0.22, 0], [0.24, 0.26, 0.2]);
      P(g, CYL(12), mat(0xf8bbd0), [0, 0.42, 0], [0.18, 0.1, 0.15]);
      P(g, HEMI(), mat(0x6d4c41), [0, 0.46, 0], [0.16, 0.08, 0.13]);
      for (let i = 0; i < 4; i++) P(g, SPH(6, 4), mat(0xff6fa8), [Math.cos(i * 1.7) * 0.07, 0.5, Math.sin(i * 1.7) * 0.06], [0.04, 0.015, 0.03]);
      break;
    case 'sunjar':
      P(g, CYL(12), mat(0xe0f7fa, { transparent: true, opacity: 0.4, roughness: 0.05 }), [0, 0.2, 0], [0.16, 0.38, 0.16]);
      P(g, SPH(10, 8), glow(0xffd54f, 3), [0, 0.2, 0], 0.12, [0, 0, 0], false);
      P(g, CYL(12), mat(0x8d6e63), [0, 0.41, 0], [0.14, 0.05, 0.14]);
      break;
    case 'kit': {
      // a gadget kit is a mini version of the gadget itself on a little pallet, so you can tell them apart
      P(g, BOX(), mat(0xc8a06a), [0, 0.04, 0], [0.55, 0.08, 0.55]);
      const m = makePlaceable(sub).group;
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m);
      const sz = box.getSize(new THREE.Vector3());
      const sc = 0.5 / Math.max(sz.x, sz.y * 0.8, sz.z, 0.01);
      m.scale.setScalar(sc);
      m.position.y = 0.08 - box.min.y * sc;
      g.add(m);
      break;
    }
  }
  return g;
}

// ───────────────────────── Environment bits ─────────────────────────
// Weeds are dandelions: broad, dark jagged leaves with a bright yellow puff on a tall stem, so they
// read as "pull me" against the short, ground-colored grass.
export function makeWeed() {
  const g = new THREE.Group();
  const n = 5 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    P(g, CONE(3), mat(i % 2 ? 0x8a9a1a : 0x6b7f12, { flat: true }), [Math.cos(a) * 0.2, 0.22, Math.sin(a) * 0.2], [0.14, 0.5 + Math.random() * 0.2, 0.06], [Math.cos(a) * 0.9, -a, Math.sin(a) * 0.9]);
  }
  P(g, CYL(5), mat(0x7a9a2a), [0.04, 0.45, 0], [0.03, 0.9, 0.03]);
  P(g, ICO(1), mat(Math.random() < 0.75 ? 0xffd600 : 0xf5f5f5, { flat: true, emissive: 0x332a00 }), [0.04, 0.92, 0], 0.15);
  return g;
}
