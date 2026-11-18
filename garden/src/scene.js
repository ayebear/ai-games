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
    if (inside) c.setHSL(0.27 + n * 0.02, 0.5, 0.42 + n * 0.04);
    else c.setHSL(0.3 + n * 0.02, 0.45, 0.25 + n * 0.04);
    colors.push(c.r, c.g, c.b);
    if (!inside) pos.setY(i, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - HALF) * 0.15) + n * 0.15);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Grass tufts (instanced)
  {
    const tuftGeo = new THREE.ConeGeometry(0.06, 0.35, 3);
    tuftGeo.translate(0, 0.17, 0);
    const N = 2200;
    const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: 0x5f9a35, roughness: 1 }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 56, z = (Math.random() - 0.5) * 56;
      if (Math.hypot(x, z) < 3 || z < -15.8) { i--; continue; } // not on the heart or the market floor
      p.set(x, 0, z);
      e.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4);
      q.setFromEuler(e);
      s.setScalar(0.6 + Math.random() * 0.9);
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
  for (let z = -15; z < -2.5; z += 1.6) P(scene, CYL(8), mat(0xbdb5a6), [Math.sin(z) * 0.3, 0.04, z], [0.5, 0.08, 0.45], [0, z, 0], false).receiveShadow = true;

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

  return { renderer, scene, camera, sun, hemi, stars, rain, fireflies, lampLights, playerLights, heartLight };
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
const SKY = {
  dawn: new THREE.Color(0xf6b38a), day: new THREE.Color(0x8fd3ff), dusk: new THREE.Color(0xf0855a),
  night: new THREE.Color(0x0b1430), rain: new THREE.Color(0x8a9aa8),
};
const tmp = new THREE.Color();
export function updateSky(env, { phase, p, weather, focus }) {
  // p = progress 0..1 within phase
  const { scene, sun, hemi, stars } = env;
  let sky, sunI, hemiI, elev, az, sunColor;
  if (phase === 'day') {
    elev = Math.sin(p * Math.PI);
    az = p;
    const edge = Math.min(p, 1 - p);
    if (edge < 0.12) {
      const k = edge / 0.12;
      tmp.copy(p < 0.5 ? SKY.dawn : SKY.dusk).lerp(SKY.day, k);
    } else tmp.copy(SKY.day);
    sky = tmp;
    sunI = 0.6 + 2.4 * Math.min(1, elev * 1.6);
    hemiI = 0.55 + 0.6 * Math.min(1, elev * 2);
    sunColor = edge < 0.12 ? 0xffc89a : 0xfff4e0;
  } else {
    elev = 0.3 + Math.sin(p * Math.PI) * 0.5;
    az = p;
    const edge = Math.min(p, 1 - p);
    if (edge < 0.1) tmp.copy(p < 0.5 ? SKY.dusk : SKY.dawn).lerp(SKY.night, edge / 0.1);
    else tmp.copy(SKY.night);
    sky = tmp;
    sunI = 0.55;
    hemiI = 0.28;
    sunColor = 0x9fb4ff;
  }
  if (weather === 'rain') { sky = tmp.lerp(SKY.rain, phase === 'day' ? 0.6 : 0.2); sunI *= 0.55; }
  if (weather === 'heat' && phase === 'day') sky = tmp.lerp(new THREE.Color(0xffd28a), 0.25);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  const ang = az * Math.PI;
  sun.position.set(focus.x + Math.cos(ang) * -60, 20 + elev * 55, focus.z + 25);
  sun.target.position.set(focus.x, 0, focus.z);
  sun.intensity = sunI;
  sun.color.setHex(sunColor);
  hemi.intensity = hemiI;
  hemi.color.setHex(phase === 'night' ? 0x4a5a9a : 0xcfe8ff);
  hemi.groundColor.setHex(phase === 'night' ? 0x1a2a20 : 0x5a7a3a);
  const nightK = phase === 'night' ? Math.min(1, Math.min(p, 1 - p) / 0.1) : 0;
  stars.material.opacity = nightK * 0.9;
  return nightK;
}
