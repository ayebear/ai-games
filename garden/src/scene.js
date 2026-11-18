import * as THREE from 'three';
import { HALF, SPIGOT, POND, MAX_PLAYERS } from './config.js';
import { P, mat, glow, SPH, BOX, CYL, CONE, ICO, DISC, PLANE } from './models.js';

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);
  scene.fog = new THREE.Fog(0x8fd3ff, 60, 130);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 300);
  camera.position.set(0, 40, 32);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a7a3a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // Point light pools (allocated up-front so shader programs never recompile)
  const lampLights = [];
  for (let i = 0; i < 8; i++) {
    const l = new THREE.PointLight(0xffe7a0, 0, 14, 1.6);
    l.position.set(0, -50, 0);
    scene.add(l); lampLights.push(l);
  }
  const playerLights = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const l = new THREE.PointLight(0xffc56a, 0, 10, 1.6);
    l.position.set(0, -50, 0);
    scene.add(l); playerLights.push(l);
  }
  const heartLight = new THREE.PointLight(0xff7ab8, 0, 14, 1.5);
  heartLight.position.set(0, 4.5, 0);
  scene.add(heartLight);

  // ── Ground ──
  const groundGeo = new THREE.PlaneGeometry(160, 160, 80, 80);
  groundGeo.rotateX(-Math.PI / 2);
  const colors = [];
  const pos = groundGeo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const inside = Math.abs(x) < HALF - 4 && Math.abs(z) < HALF - 4;
    const n = Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.5 + Math.sin(x * 0.11 + z * 0.17) * 0.5;
    if (inside) c.setHSL(0.27 + n * 0.008, 0.48, 0.42 + n * 0.015);
    else c.setHSL(0.3 + n * 0.02, 0.45, 0.25 + n * 0.04);
    colors.push(c.r, c.g, c.b);
    if (!inside) pos.setY(i, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - HALF) * 0.15) + n * 0.15);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Grass tufts (instanced): sparse, short and close to the ground color so they stay in the
  // background. Weeds, pickups and plants are what should catch the eye.
  {
    const tuftGeo = new THREE.ConeGeometry(0.05, 0.22, 3);
    tuftGeo.translate(0, 0.11, 0);
    const N = 550;
    const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: 0x5c9634, roughness: 1 }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 56, z = (Math.random() - 0.5) * 56;
      if (Math.hypot(x, z) < 3 || z < -14) { i--; continue; } // not on the heart or the market floor
      p.set(x, 0, z);
      e.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4);
      q.setFromEuler(e);
      s.setScalar(0.7 + Math.random() * 0.5);
      m.compose(p, q, s);
      tufts.setMatrixAt(i, m);
    }
    scene.add(tufts);
  }

  // ── Forest ring (instanced) ──
  {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2, 6); trunkGeo.translate(0, 1, 0);
    const pineGeo = new THREE.ConeGeometry(1.6, 4.5, 7); pineGeo.translate(0, 4, 0);
    const roundGeo = new THREE.IcosahedronGeometry(1.8, 0); roundGeo.translate(0, 3.4, 0);
    const spots = [];
    for (let i = 0; i < 420 && spots.length < 230; i++) {
      const x = (Math.random() - 0.5) * 110, z = (Math.random() - 0.5) * 110;
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d < HALF - 1.5 || d > 55) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.4)) continue;
      spots.push({ x, z, s: 0.8 + Math.random() * 0.8, pine: Math.random() < 0.55 });
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x6d4c2f), spots.length);
    const pines = new THREE.InstancedMesh(pineGeo, mat(0x2f6b3a, { flat: true }), spots.length);
    const rounds = new THREE.InstancedMesh(roundGeo, mat(0x4a8f3a, { flat: true }), spots.length);
    const m = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    spots.forEach((s, i) => {
      m.makeScale(s.s, s.s, s.s).setPosition(s.x, 0, s.z);
      trunks.setMatrixAt(i, m);
      pines.setMatrixAt(i, s.pine ? m : zero);
      rounds.setMatrixAt(i, s.pine ? zero : m);
    });
    for (const im of [trunks, pines, rounds]) { im.castShadow = true; scene.add(im); }
  }

  // ── Spigot (the market itself is built in market.js) ──
  {
    // spigot
    const sp = new THREE.Group();
    sp.position.set(SPIGOT.x, 0, SPIGOT.z);
    P(sp, CYL(8), mat(0x78909c, { metalness: 0.6, roughness: 0.4 }), [0, 0.5, 0], [0.12, 1.0, 0.12]);
    P(sp, CYL(8), mat(0xd32f2f), [0, 1.05, 0], [0.22, 0.06, 0.22]);
    P(sp, CYL(6), mat(0x78909c), [0, 0.8, 0.15], [0.06, 0.3, 0.06], [Math.PI / 2, 0, 0]);
    scene.add(sp);
  }

  // ── Pond ──
  {
    const pond = new THREE.Group();
    pond.position.set(POND.x, 0, POND.z);
    P(pond, DISC(32), mat(0x2f8fd0, { roughness: 0.1, metalness: 0.1, emissive: 0x0a2a44, emissiveIntensity: 0.4 }), [0, 0.05, 0], POND.r, [-Math.PI / 2, 0, 0], false).receiveShadow = true;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      P(pond, ICO(0), mat(0x9e9e9e, { flat: true }), [Math.cos(a) * (POND.r + 0.2), 0.15, Math.sin(a) * (POND.r + 0.2)], 0.35 + Math.random() * 0.25, [Math.random(), Math.random(), 0]);
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 2.5;
      P(pond, DISC(10), mat(0x66bb6a), [Math.cos(a) * r, 0.08, Math.sin(a) * r], 0.4, [-Math.PI / 2, 0, 0], false);
    }
    for (let i = 0; i < 6; i++) {
      const a = 2.5 + i * 0.25;
      P(pond, CYL(5), mat(0x6d8a3a), [Math.cos(a) * (POND.r + 0.5), 0.7, Math.sin(a) * (POND.r + 0.5)], [0.04, 1.4, 0.04]);
      P(pond, CYL(6), mat(0x5d4037), [Math.cos(a) * (POND.r + 0.5), 1.4, Math.sin(a) * (POND.r + 0.5)], [0.07, 0.3, 0.07]);
    }
    scene.add(pond);
  }

  // Stepping-stone path from shop to heart
  for (let z = -13.4; z < -2.5; z += 1.6) P(scene, CYL(8), mat(0xbdb5a6), [Math.sin(z) * 0.3, 0.04, z], [0.5, 0.08, 0.45], [0, z, 0], false).receiveShadow = true;

  // ── Stars ──
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 900; i++) {
    const t = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.1;
    const r = 140;
    sp.push(Math.cos(t) * Math.sqrt(1 - u * u) * r, u * r, Math.sin(t) * Math.sqrt(1 - u * u) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);

  // ── Rain ──
  const rainN = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(rainN * 6);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.45 }));
  rain.frustumCulled = false;
  rain.visible = false;
  rain.userData.drops = Array.from({ length: rainN }, () => ({ x: (Math.random() - 0.5) * 70, y: Math.random() * 30, z: (Math.random() - 0.5) * 70 }));
  scene.add(rain);

  // ── Snow ──
  const snowN = 700;
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(snowN * 3), 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.32, transparent: true, opacity: 0, depthWrite: false }));
  snow.frustumCulled = false;
  snow.visible = false;
  snow.userData.flakes = Array.from({ length: snowN }, () => ({ x: (Math.random() - 0.5) * 70, y: Math.random() * 28, z: (Math.random() - 0.5) * 70, p: Math.random() * 10, s: 2 + Math.random() * 1.5 }));
  scene.add(snow);

  // Fireflies at night
  const ffGeo = new THREE.BufferGeometry();
  const ffN = 60;
  ffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ffN * 3), 3));
  const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xd4ff6a, size: 0.25, transparent: true, opacity: 0, depthWrite: false }));
  fireflies.userData.seeds = Array.from({ length: ffN }, () => ({ x: (Math.random() - 0.5) * 70, z: (Math.random() - 0.5) * 70, p: Math.random() * 10 }));
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { renderer, scene, camera, sun, hemi, stars, rain, snow, fireflies, lampLights, playerLights, heartLight };
}

export function makeTextTexture(text, fg, bg) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 112;
  const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 112);
  x.fillStyle = fg;
  x.font = 'bold 64px "Trebuchet MS", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 60);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Sky / lighting per time of day ──
// Everything here is a continuous function of the time of day and the weather fade-in weights, so
// there are no jumps at dawn or dusk:
// - `light` runs 0 (deep night) → 0.5 (sunrise / sunset, exactly at the phase change) → 1 (day).
// - The directional light is the sun by day and the moon by night. Each one fades to zero at the
//   horizon, so the swap from sun to moon (which flips the shadow direction) is never visible.
const C = (h) => new THREE.Color(h);
const SKY = { day: C(0x8fd3ff), night: C(0x0b1430), dawn: C(0xf6a98a), dusk: C(0xf0855a) };
const WX_SKY = { rain: C(0x7d8b97), heat: C(0xffd28a), fog: C(0xb9c3c9), snow: C(0xdfe7ee) };
const HEMI = { day: C(0xcfe8ff), night: C(0x4a5a9a), groundDay: C(0x5a7a3a), groundNight: C(0x1a2a20) };
const SUN = { low: C(0xffb27a), high: C(0xfff4e0), moon: C(0x9fb4ff) };
const tmp = new THREE.Color(), tmp2 = new THREE.Color();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const v1 = new THREE.Vector3(), right = new THREE.Vector3(), upv = new THREE.Vector3(), fpos = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// p = progress 0..1 within the phase. wx = weather weights. Returns how dark it is (0..1).
export function updateSky(env, { phase, p, wx, focus }) {
  const { scene, sun, hemi, stars } = env;
  const day = phase === 'day';
  const arc = Math.sin(p * Math.PI); // height of the sun (by day) or the moon (by night)
  const edge = Math.min(p, 1 - p);
  const light = day ? 0.5 + 0.5 * smooth(0, 0.14, edge) : 0.5 - 0.5 * smooth(0, 0.12, edge);
  const twilight = 1 - Math.abs(light * 2 - 1); // 1 right at sunrise/sunset
  const morning = day ? p < 0.5 : p > 0.5;
  const cloud = Math.min(1, (wx.rain ?? 0) + (wx.fog ?? 0) + (wx.snow ?? 0));

  // sky: night → day, warm glow around sunrise/sunset, then weather tint
  tmp.copy(SKY.night).lerp(SKY.day, light).lerp(morning ? SKY.dawn : SKY.dusk, twilight * 0.75 * (1 - cloud * 0.6));
  tmp.lerp(WX_SKY.rain, (wx.rain ?? 0) * lerp(0.2, 0.6, light));
  tmp.lerp(WX_SKY.fog, (wx.fog ?? 0) * lerp(0.15, 0.55, light));
  tmp.lerp(WX_SKY.snow, (wx.snow ?? 0) * lerp(0.15, 0.5, light));
  tmp.lerp(WX_SKY.heat, (wx.heat ?? 0) * 0.25 * light);
  scene.background.copy(tmp);
  scene.fog.color.copy(tmp);

  // directional light: sun or moon, fading out at the horizon
  const lift = smooth(0, 0.3, arc);
  const dim = 1 - 0.45 * (wx.rain ?? 0) - 0.35 * (wx.fog ?? 0) - 0.4 * (wx.snow ?? 0);
  sun.intensity = (day ? 3.0 * lift : 0.55 * lift) * dim;
  sun.color.copy(day ? tmp2.copy(SUN.low).lerp(SUN.high, smooth(0.1, 0.5, arc)) : SUN.moon);
  hemi.intensity = lerp(0.3, 1.15, light) * (1 - 0.15 * cloud);
  hemi.color.copy(HEMI.night).lerp(HEMI.day, light);
  hemi.groundColor.copy(HEMI.groundNight).lerp(HEMI.groundDay, light);

  // light position: an east → west arc, kept centered on the camera focus. The focus is snapped to
  // shadow-map texels (in light space) so shadow edges don't shimmer while the camera moves.
  const ang = p * Math.PI;
  v1.set(Math.cos(ang) * -60, 20 + arc * 55, 25);
  const dir = v1.clone().normalize();
  right.crossVectors(dir, WORLD_UP).normalize();
  upv.crossVectors(right, dir);
  const sc = sun.shadow.camera, texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
  fpos.set(focus.x, 0, focus.z);
  const a = Math.round(fpos.dot(right) / texel) * texel, b = Math.round(fpos.dot(upv) / texel) * texel, c = fpos.dot(dir);
  fpos.copy(right).multiplyScalar(a).addScaledVector(upv, b).addScaledVector(dir, c);
  sun.target.position.copy(fpos);
  sun.position.copy(fpos).add(v1);

  const night = Math.min(1, (0.5 - light) * 2.2);
  stars.material.opacity = Math.max(0, night) * 0.9 * (1 - cloud * 0.85);
  return Math.max(0, night);
}
