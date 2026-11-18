// Item icons. Tools, bags, gadgets and supplies get an icon rendered from their own 3D
// model (once, at startup), so the icon in the shop/HUD is exactly what you see in the world.
// Plants and the rest keep their emoji, which already read clearly.
//
// Icon ids match carried-item kinds: 'tool:shovel', 'kit:fence', 'soil', 'seed:daisy',
// 'produce:daisy', 'weed', 'junk', plus 'bag:<key>' for bags.
import * as THREE from 'three';
import { TOOLS, BAGS, PLACEABLES, SUPPLIES, PLANTS, itemInfo, toolBase } from './config.js';
import { makeTool, makePlaceable, makeItem, makeBag } from './models.js';

const SIZE = 128;
const icons = new Map(); // id -> { url, canvas }

// What each rendered icon is built from.
function builders() {
  const b = {};
  for (const k of Object.keys(TOOLS)) {
    const reel = toolBase(k) === 'hose';
    if (k !== 'hands') b['tool:' + k] = () => tilt(makeTool(k, { reel }), reel ? 0 : toolBase(k) === 'can' ? -0.3 : -0.75);
  }
  for (const k of Object.keys(BAGS)) b['bag:' + k] = () => makeBag(k);
  for (const k of Object.keys(PLACEABLES)) b['kit:' + k] = () => makePlaceable(k).group;
  for (const k of Object.keys(SUPPLIES)) b[k] = () => makeItem(k);
  b.junk = () => makeItem('junk');
  b.wood = () => makeItem('wood');
  // seed packets, for the inventory (seeds and produce share the plant's emoji)
  for (const k of Object.keys(PLANTS)) b['packet:' + k] = () => makeItem('seed:' + k);
  return b;
}
function tilt(obj, z) {
  const g = new THREE.Group();
  obj.rotation.z = z;
  g.add(obj);
  return g;
}

export function buildIcons() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 6);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const dir = new THREE.Vector3(0.55, 0.6, 1).normalize();

  for (const [id, build] of Object.entries(builders())) {
    const obj = build();
    scene.add(obj);
    obj.updateMatrixWorld(true);
    // frame the bounding box tightly (a sphere fit leaves thin tools tiny)
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const size = box.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z * 0.6) * 0.68;
    const dist = extent / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) + sphere.radius * 0.5;
    cam.position.copy(sphere.center).addScaledVector(dir, dist);
    cam.lookAt(sphere.center);
    renderer.render(scene, cam);
    const cv = sticker(renderer.domElement);
    icons.set(id, { canvas: cv, url: cv.toDataURL() });
    scene.remove(obj);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}

// A white outline around the render (sticker style), so thin or dark items read on any background.
function sticker(src) {
  const sil = document.createElement('canvas');
  sil.width = sil.height = SIZE;
  const s = sil.getContext('2d');
  s.drawImage(src, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#fff';
  s.fillRect(0, 0, SIZE, SIZE);
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const x = cv.getContext('2d');
  for (let a = 0; a < 16; a++) x.drawImage(sil, Math.cos(a * Math.PI / 8) * 4, Math.sin(a * Math.PI / 8) * 4);
  x.drawImage(src, 0, 0);
  return cv;
}

// The emoji used when there's no rendered icon.
export function iconEmoji(id) {
  const [k, sub] = id.split(':');
  if (k === 'plant') return PLANTS[sub]?.icon ?? '?';
  return itemInfo(id).icon;
}

// Icon id for a market stall item.
export const stallIconId = (kind, key) => (kind === 'supply' ? key : `${kind}:${key}`);

// Inline HTML for an icon (an <img> for rendered icons, the emoji otherwise).
export function iconHTML(id, cls = '') {
  const ic = icons.get(id);
  return ic ? `<img class="ico ${cls}" src="${ic.url}" alt="">` : `<span class="ico e ${cls}">${iconEmoji(id)}</span>`;
}

// Inline HTML for an inventory stack's icon: Hands, a seed packet for seeds, else the item's icon.
export function invIconHTML(kind, cls = '') {
  if (kind === 'hands') return `<span class="ico e ${cls}">${TOOLS.hands.icon}</span>`;
  return iconHTML(kind.startsWith('seed:') ? 'packet:' + kind.slice(5) : kind, cls);
}

// Draw an icon centered at (x, y) on a 2D canvas.
export function drawIcon(ctx, id, x, y, size) {
  const ic = icons.get(id);
  if (ic) { ctx.drawImage(ic.canvas, x - size / 2, y - size / 2, size, size); return; }
  ctx.save();
  ctx.font = `${Math.round(size * 0.8)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(iconEmoji(id), x, y + size * 0.05);
  ctx.restore();
}
