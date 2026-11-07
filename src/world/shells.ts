import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const mat = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, flatShading: false, ...o });

/** 蚵殼：灰色為主，偶爾帶烏（頂點色） */
export function shellPaint(g: THREE.BufferGeometry, seed: number) {
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3); let r = seed * 9301 + 49297;
  const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const blotch = new THREE.Vector3(rn() - 0.5, rn() - 0.5, rn() - 0.5).normalize(), streak = rn() * 6.28, dark = rn() < 0.45;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), v = new THREE.Vector3(x, y, z).normalize();
    let c = 0.9 + rn() * 0.12; if (dark && v.dot(blotch) > 0.6) c *= 0.8; void x; void z; void streak;
    col[i * 3] = c; col[i * 3 + 1] = c * 0.98; col[i * 3 + 2] = c;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}

function shellTex() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d')!;
  let r = 7; const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  c.fillStyle = '#efe7da'; c.fillRect(0, 0, S, S);
  for (let k = 0; k < 34; k++) { const y0 = 40 + k * 5.6, dark = k % 2 === 0 ? rn() < 0.85 : rn() < 0.25;
    c.fillStyle = dark ? (rn() < 0.5 ? `rgb(${80 + rn() * 25 | 0},${64 + rn() * 16 | 0},${58 + rn() * 14 | 0})` : `rgb(${90 + rn() * 20 | 0},${76 + rn() * 14 | 0},${88 + rn() * 16 | 0})`) : `rgb(${196 + rn() * 34 | 0},${182 + rn() * 28 | 0},${152 + rn() * 26 | 0})`;
    c.beginPath(); c.moveTo(0, S); for (let x = 0; x <= S; x += 4) c.lineTo(x, y0 + Math.sin(x * 0.05 + k) * 3 + (rn() - 0.5) * 5); c.lineTo(S, S); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(248,242,232,0.55)'; c.lineWidth = 0.8; c.stroke(); }
  c.fillStyle = '#f4efe6'; c.beginPath(); c.moveTo(0, S); for (let x = 0; x <= S; x += 4) c.lineTo(x, S - 26 + Math.sin(x * 0.2) * 4 + rn() * 4); c.lineTo(S, S); c.closePath(); c.fill();
  c.fillStyle = '#4c4636'; c.fillRect(0, 0, S, 38);
  for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(${40 + rn() * 50 | 0},${38 + rn() * 40 | 0},${30 + rn() * 30 | 0},${0.4 + rn() * 0.5})`; c.beginPath(); c.ellipse(rn() * S, rn() * 52, 2 + rn() * 10, 1 + rn() * 5, 0, 0, 7); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 2; return t;
}

export const SHELL_TEX = shellTex();

export const mkShell = (sy: number, seed: number) => {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.09, 2); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  let r = seed * 7919 + 13; const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280; const ph = rn() * 6.28, ph2 = rn() * 6.28, amp = 0.12 + rn() * 0.1;
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), edge = 1 - Math.abs(y) / 0.09;
    const k = 1 + Math.sin(a * 2 + ph) * 0.14 + Math.sin(a * 3 + ph2) * 0.08 + edge * (Math.sin(a * 7 + ph) * amp * 0.5 + (rn() - 0.5) * 0.12);
    const yk = y > 0 ? 1 + Math.sin(a * 3 + x * 40) * 0.2 + (rn() - 0.5) * 0.3 : 0.6;
    pos.setXYZ(i, x * k * 1.3, y * sy * yk, z * k);
    uv[i * 2] = a / 6.283 + 0.5; uv[i * 2 + 1] = Math.min(1, Math.max(0, (y / 0.09) * 0.5 + 0.5)); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g = g.toNonIndexed(); g.computeVertexNormals(); return shellPaint(g, seed);
};

export const SHELL_GEOS = [0, 1, 2, 3, 4, 5].map(i => mkShell(0.45, i + 1));
export const HALF_GEOS = [0, 1, 2, 3, 4, 5].map(i => mkShell(0.38, i + 11));
export const GREYS = [0xffffff, 0xeae4e0, 0xd6d0cc, 0xc2bab8, 0xa8a0a0];
export const greyPick = () => GREYS[Math.min(4, Math.floor(Math.random() * Math.random() * 6.2))];
export const shellM = (c: number) => { const m = mat(c, { vertexColors: true, roughness: 0.55, metalness: 0, map: SHELL_TEX }); m.emissive.setHex(0x0a0c10); m.emissiveIntensity = 0.15; return m; };
/** 臉盆生蚵：比殼堆略濕亮、偏暖乳白，跟乾灰殼堆一眼可分 */
export const basinShellM = (c: number) => {
  const m = mat(c, { vertexColors: true, roughness: 0.36, metalness: 0.06, map: SHELL_TEX });
  m.emissive.setHex(0x142028);
  m.emissiveIntensity = 0.2;
  return m;
};
/** 盆內難度色（偏暖濕潤，勿用殼堆 GREYS） */
export const BASIN_SHELL_COLS = [0xf7f2e4, 0xebe4d2, 0xd8d0bc, 0xc4bcaa] as const;
