import * as THREE from 'three';
import { hash3 } from './rng.js';

let grad = null;
export function gradientMap() {
  if (!grad) {
    const data = new Uint8Array([110, 175, 230, 255]);
    grad = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    grad.minFilter = THREE.NearestFilter;
    grad.magFilter = THREE.NearestFilter;
    grad.generateMipmaps = false;
    grad.needsUpdate = true;
  }
  return grad;
}

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
}

// Faceted, vertex-coloured geometry ready for merging.
export function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  g.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Wobble vertices for a hand-made low-poly look (stable per position).
export function jitter(geo, amt, seed = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = hash3(x, y, z, seed);
    p.setXYZ(i, x + (h[0] - 0.5) * amt, y + (h[1] - 0.5) * amt, z + (h[2] - 0.5) * amt);
  }
  return geo;
}
