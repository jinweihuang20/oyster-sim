/**
 * CR-39 碼頭西邊海上沙洲的外觀：矮沙丘、幾顆石頭、東側小木棧橋、簡單賣魚攤。
 * 全部做成頂點色幾何，跟碼頭／護岸合成同一個 mesh（不多 draw call、不多材質、不加燈光陰影）。
 * 座標見 ../islet.ts。
 */
import * as THREE from 'three';
import { ISLET } from '../islet';

const _c = new THREE.Color();
function tint(g: THREE.BufferGeometry, hex: number) {
  const gg = g.index ? g.toNonIndexed() : g;
  if (gg !== g) g.dispose();
  for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
  _c.setHex(hex);
  const n = gg.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  gg.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return gg;
}
const blk = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, hex: number) => {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return tint(g, hex);
};
const cyl = (r: number, h: number, x: number, y: number, z: number, hex: number, seg = 8) => {
  const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y, z); return tint(g, hex);
};

const SAND = 0xe6d2a3, SAND_D = 0xcbb88a, SAND_W = 0xf0e0b8, ROCK = 0x6a6560, ROCK_D = 0x55514c;
const PLANK = 0x8a6a48, PLANK_D = 0x6e5236, POST = 0x4a3a2a, TARP = 0xc45c3a, TARP_D = 0xa44a30, SIGN = 0xd8c9a6;

/** 沙洲＋棧橋＋攤位零件（呼叫端併進碼頭 mesh） */
export function isletParts(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const I = ISLET;
  // 外坡（圓台）＋平坦頂
  {
    const slope = new THREE.CylinderGeometry(I.rTop, I.r, I.topY + 0.5, 12, 1, true);
    slope.translate(I.cx, (I.topY - 0.5) / 2, I.cz);
    out.push(tint(slope, SAND_D));
    const top = new THREE.CylinderGeometry(I.rTop, I.rTop, 0.08, 12);
    top.translate(I.cx, I.topY - 0.04, I.cz);
    out.push(tint(top, SAND));
    // 頂面兩塊稍深的沙紋（低模）
    const a = new THREE.CircleGeometry(1.1, 8); a.rotateX(-Math.PI / 2); a.translate(I.cx - 1.1, I.topY + 0.005, I.cz + 0.6); out.push(tint(a, SAND_W));
    const b = new THREE.CircleGeometry(0.8, 8); b.rotateX(-Math.PI / 2); b.translate(I.cx + 0.9, I.topY + 0.005, I.cz - 0.9); out.push(tint(b, SAND_D));
  }
  // 幾顆石頭
  const rocks: [number, number, number, number, number][] = [
    [-3.6, -2.4, 0.45, 0.38, 0.5],
    [-3.2, 3.1, 0.38, 0.32, 0.42],
    [2.6, 3.3, 0.32, 0.28, 0.36],
    [1.4, -3.5, 0.5, 0.34, 0.4],
    [-1.8, 3.6, 0.28, 0.24, 0.3],
  ];
  rocks.forEach(([dx, dz, sx, sy, sz], i) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.rotateY(i * 0.7);
    g.translate(I.cx + dx, I.topY + sy * 0.3, I.cz + dz);
    out.push(tint(g, i % 2 ? ROCK : ROCK_D));
  });
  // 東側小木棧橋：木板＋邊樑＋樁＋繫船柱
  const planks = Math.round((I.jetX1 - I.jetX0) / 0.4);
  for (let i = 0; i < planks; i++) {
    const x = I.jetX0 + 0.2 + i * 0.4;
    out.push(blk(x - 0.18, x + 0.18, I.jetY - 0.05, I.jetY, I.jetZ0, I.jetZ1, i % 3 === 0 ? PLANK_D : PLANK));
  }
  for (const s of [-1, 1]) out.push(blk(I.jetX0, I.jetX1, I.jetY - 0.12, I.jetY - 0.02, s * 1.0 - 0.07, s * 1.0 + 0.07, PLANK_D));
  for (let x = I.jetX0 + 0.35; x <= I.jetX1 - 0.2; x += 1.15) for (const s of [-1, 1])
    out.push(cyl(0.08, 1.15, x, I.jetY - 0.55, s * 0.85, POST, 6));
  for (const z of [-0.7, 0.7]) out.push(cyl(0.07, 0.28, I.jetX1 - 0.25, I.jetY + 0.14, z, 0x2a2a2a, 6));
  // 賣魚攤：矮桌、四柱、遮棚、木牌（圖案用幾何，不加貼圖／emoji）
  const sx = I.sellX, sz = I.sellZ;
  out.push(blk(sx - 0.7, sx + 0.7, I.topY, I.topY + 0.72, sz - 0.45, sz + 0.45, PLANK));
  for (const dx of [-0.62, 0.62]) for (const dz of [-0.38, 0.38])
    out.push(cyl(0.05, 1.55, sx + dx, I.topY + 0.78, sz + dz, POST, 5));
  out.push(blk(sx - 0.85, sx + 0.85, I.topY + 1.48, I.topY + 1.58, sz - 0.55, sz + 0.55, TARP));
  out.push(blk(sx - 0.85, sx + 0.85, I.topY + 1.42, I.topY + 1.48, sz - 0.55, sz + 0.55, TARP_D));
  // 掛在東面的木牌：外框＋一條魚的簡筆幾何（線條感）
  const boardZ = sz - 0.5, by0 = I.topY + 0.85, by1 = I.topY + 1.35;
  out.push(blk(sx - 0.38, sx + 0.38, by0, by1, boardZ - 0.03, boardZ + 0.03, SIGN));
  out.push(blk(sx - 0.4, sx + 0.4, by0, by0 + 0.05, boardZ - 0.04, boardZ + 0.04, PLANK_D));
  out.push(blk(sx - 0.4, sx + 0.4, by1 - 0.05, by1, boardZ - 0.04, boardZ + 0.04, PLANK_D));
  // 魚身＋尾（深色線條塊）
  out.push(blk(sx - 0.16, sx + 0.14, by0 + 0.18, by0 + 0.32, boardZ + 0.03, boardZ + 0.05, POST));
  out.push(blk(sx + 0.12, sx + 0.26, by0 + 0.14, by0 + 0.25, boardZ + 0.03, boardZ + 0.05, POST));
  out.push(blk(sx + 0.12, sx + 0.26, by0 + 0.25, by0 + 0.36, boardZ + 0.03, boardZ + 0.05, POST));
  out.push(cyl(0.03, 0.04, sx - 0.08, by0 + 0.27, boardZ + 0.05, 0x2a2a2a, 5));
  return out;
}
