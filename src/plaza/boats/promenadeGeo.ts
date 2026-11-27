/**
 * CR-38 西南角海堤步道＋白色兩層觀景台的外觀。
 * 全部做成頂點色幾何，跟碼頭／護岸合成同一個 mesh（不多 draw call、不多材質、不加燈光陰影）。
 * 座標與可走範圍見 ../promenade.ts。
 */
import * as THREE from 'three';
import { PROM, PLAT } from '../promenade';

const _c = new THREE.Color();
/** 非索引、只留 position／normal，填頂點色（跟 boatScene 的 tint 同格式才能合併） */
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
/** 方塊：用左右前後上下界（x0..x1, y0..y1, z0..z1） */
const blk = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, hex: number) => {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return tint(g, hex);
};
/** 朝上的薄片（地磚紋路用，2 個三角形） */
const tile = (x0: number, x1: number, y: number, z0: number, z1: number, hex: number) => {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return tint(g, hex);
};

const WHITE = 0xf1f0ea, WHITE_D = 0xd9d7cf, RAIL_WOOD = 0x4a3324, GRAVEL = 0x9c9b95, GRAVEL_D = 0x8b8a84;
const PAVE = [0xbdb3a2, 0xa99f8e, 0xc8bfae], GROUT = 0x8c8476, STEP = 0xc9c3b6, CURB = 0x8f897c, CURB_D = 0x7d776b;
const CONC = [0xbcb9b0, 0xaeaba2, 0xc6c3ba], DECK = 0xd8d3c6, DECK_D = 0xc6c0b2;

/**
 * 一段欄杆（a→b 水平直線，底在 y）：柱、白色直條、下橫條、上扶手。
 * wood＝上扶手用深色木頭（步道那種）；否則全白（觀景台那種）。
 */
function rail(out: THREE.BufferGeometry[], ax: number, az: number, bx: number, bz: number, y: number, wood: boolean, gap = 0.38) {
  const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) return;
  const ry = Math.atan2(bz - az, bx - ax);
  const H = 0.95, put = (w: number, h: number, d: number, t: number, yy: number, hex: number) => {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateY(-ry); g.translate(ax + (bx - ax) * t, yy, az + (bz - az) * t); out.push(tint(g, hex));
  };
  // 上扶手、下橫條（整段一根）
  put(L + 0.08, 0.07, wood ? 0.11 : 0.07, 0.5, y + H, wood ? RAIL_WOOD : WHITE);
  put(L, 0.05, 0.05, 0.5, y + 0.14, WHITE);
  // 柱（約每 2 m）
  const nPost = Math.max(1, Math.round(L / 2));
  for (let i = 0; i <= nPost; i++) put(0.1, H, 0.1, i / nPost, y + H / 2, WHITE);
  // 直條
  const nP = Math.max(1, Math.round(L / gap));
  for (let i = 1; i < nP; i++) { if (i % Math.round(nP / nPost) === 0 && nPost > 1) continue; put(0.035, H - 0.12, 0.035, i / nP, y + 0.12 + (H - 0.12) / 2, WHITE); }
}

/** 消波塊：中心往四個四面體方向伸出四隻粗腳（5 邊柱、不封頂，一顆 40 個三角形） */
const TETRA_DIRS = [[0, 1, 0], [0.943, -0.333, 0], [-0.471, -0.333, 0.816], [-0.471, -0.333, -0.816]] as const;
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _e = new THREE.Euler(), _qr = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
function tetrapod(out: THREE.BufferGeometry[], x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number, hex: number) {
  _e.set(rx, ry, rz); _qr.setFromEuler(_e);
  for (const d of TETRA_DIRS) {
    const g = new THREE.CylinderGeometry(0.09 * s, 0.25 * s, 0.68 * s, 5, 1, true);
    g.translate(0, 0.34 * s, 0);
    _v.set(d[0], d[1], d[2]).normalize(); _q.setFromUnitVectors(_up, _v); _q.premultiply(_qr);
    _p.set(x, y, z); _m.compose(_p, _q, _s); g.applyMatrix4(_m);
    out.push(tint(g, hex));
  }
}

/** 步道＋觀景台所有零件（給 boatScene 合進碼頭 mesh） */
export function promenadeParts(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const P = PROM, Q = PLAT;
  const zA = P.z0 + P.rampL, zB = P.z1 - P.rampL; // 碎石步道北端台階後、人行道南端台階前

  // ---------- 步道 ----------
  // 潮間帶南緣到步道北端的鋪面（接起廣場地面）
  out.push(tile(P.seaX, P.landX + 0.42, 0.004, P.z0 - 1.3, P.z0, PAVE[1]));
  // 石紋人行道：底板（縫的顏色）＋交錯三色石板
  out.push(blk(P.stepX1, P.landX, -0.12, 0.005, P.z0, P.z1, GROUT));
  { const nx = 2, w = (P.landX - P.stepX1) / nx, d = 0.8, nz = Math.round((zB - P.z0) / d);
    for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) {
      const off = (i % 2) * w * 0.5, x0 = Math.max(P.stepX1, P.stepX1 + j * w - off) + 0.03, x1 = Math.min(P.landX, P.stepX1 + (j + 1) * w - off) - 0.03;
      out.push(tile(x0, x1, 0.012, P.z0 + i * d + 0.03, P.z0 + (i + 1) * d - 0.03, PAVE[(i * 2 + j) % 3]));
    }
    // 右半剩下那條（錯縫）
    for (let i = 1; i < nz; i += 2) out.push(tile(P.landX - w * 0.5 + 0.03, P.landX - 0.03, 0.012, P.z0 + i * d + 0.03, P.z0 + (i + 1) * d - 0.03, PAVE[(i + 2) % 3]));
  }
  // 兩階（人行道 → 碎石步道）
  const hy = P.pathY / 2;
  out.push(blk((P.gravelX1 + P.stepX1) / 2, P.stepX1, -0.1, hy, zA, P.z1, STEP));
  out.push(blk(P.gravelX1, (P.gravelX1 + P.stepX1) / 2, -0.1, P.pathY, zA, P.z1, STEP));
  // 碎石步道＋深色碎石斑
  out.push(blk(P.seaX, P.gravelX1, -0.25, P.pathY, zA, P.z1, GRAVEL));
  for (let z = zA + 0.7, i = 0; z < P.z1 - 0.8; z += 1.9, i++) out.push(tile(P.seaX + 0.25 + (i % 3) * 0.3, P.seaX + 0.85 + (i % 3) * 0.3, P.pathY + 0.004, z, z + 0.9 + (i % 2) * 0.4, GRAVEL_D));
  // 北端進場台階（廣場 → 碎石步道）
  out.push(blk(P.seaX, P.stepX1, -0.1, hy, P.z0, P.z0 + P.rampL / 2, STEP));
  out.push(blk(P.seaX, P.stepX1, -0.1, P.pathY, P.z0 + P.rampL / 2, zA, STEP));
  // 南端台階（人行道 → 觀景台下層）
  out.push(blk(P.stepX1, P.landX, -0.1, hy, zB, zB + P.rampL / 2, STEP));
  out.push(blk(P.stepX1, P.landX, -0.1, P.pathY, zB + P.rampL / 2, P.z1, STEP));
  // 陸側石墩
  for (let z = P.z0 + 0.1, i = 0; z < P.z1 - 0.3; z += 1.0, i++) out.push(blk(P.landX, P.landX + 0.42, -0.05, 0.32 + (i % 2) * 0.03, z, z + 0.9, i % 2 ? CURB : CURB_D));
  // 海側欄杆（白色直條＋深色木扶手）
  rail(out, P.seaX + 0.06, P.z0 + 0.05, P.seaX + 0.06, P.z1, P.pathY, true);
  // 消波塊：欄杆外兩排，往海斜下去
  for (let z = P.z0 + 0.5, i = 0; z < P.z1 - 0.3; z += 1.15, i++) {
    tetrapod(out, P.seaX - 0.5, -0.2, z, i * 1.3, i * 2.1, i * 0.7, 1.0, CONC[i % 3]);
    tetrapod(out, P.seaX - 1.2, -0.55, z + 0.55, i * 0.9 + 1, i * 1.7, i * 1.1, 1.05, CONC[(i + 1) % 3]);
  }

  // ---------- 觀景台 ----------
  // 下層地板：連接走道＋凸出海面的甲板（下面接到水裡的樁）
  out.push(blk(Q.x0, Q.stairX1, Q.lowY - 0.26, Q.lowY, Q.z0, Q.upZ0, DECK));
  out.push(blk(Q.x0, Q.upX0, Q.lowY - 0.26, Q.lowY, Q.upZ0, Q.z1, DECK));
  out.push(blk(Q.x0, Q.stairX1, Q.lowY - 0.34, Q.lowY - 0.26, Q.z0, Q.z1, DECK_D));
  for (const [x, z] of [[Q.x0 + 0.25, Q.z0 + 0.25], [Q.x0 + 0.25, (Q.z0 + Q.z1) / 2], [Q.x0 + 0.25, Q.z1 - 0.25], [P.seaX - 0.6, Q.z0 + 0.25], [P.seaX - 0.6, Q.z1 - 0.25]] as const)
    out.push(blk(x - 0.16, x + 0.16, -1.4, Q.lowY - 0.3, z - 0.16, z + 0.16, WHITE_D));
  // 上層底下：內縮的淺灰牆＋白柱
  out.push(blk(Q.upX0 + 0.15, Q.upX1 - 0.15, Q.lowY, Q.topY - 0.2, Q.upZ0 + 0.15, Q.z1 - 0.15, WHITE_D));
  for (const x of [Q.upX0 + 0.15, (Q.upX0 + Q.upX1) / 2, Q.upX1 - 0.15]) for (const z of [Q.upZ0 + 0.15, Q.z1 - 0.15])
    out.push(blk(x - 0.17, x + 0.17, Q.lowY, Q.topY - 0.2, z - 0.17, z + 0.17, WHITE));
  out.push(blk(Q.upX0 + 0.15 - 0.17, Q.upX0 + 0.15 + 0.17, Q.lowY, Q.topY - 0.2, (Q.upZ0 + Q.z1) / 2 - 0.17, (Q.upZ0 + Q.z1) / 2 + 0.17, WHITE));
  // 上層地板（含樓梯頂平台）
  out.push(blk(Q.upX0 - 0.1, Q.upX1, Q.topY - 0.22, Q.topY, Q.upZ0 - 0.1, Q.z1 + 0.1, WHITE));
  out.push(blk(Q.upX1, Q.stairX1, Q.topY - 0.22, Q.topY, Q.stairZ1, Q.z1 + 0.1, WHITE));
  // 樓梯：一階一塊實心台階＋外側白牆
  { const n = 12, rise = (Q.topY - Q.lowY) / n, run = (Q.stairZ1 - Q.upZ0) / n;
    for (let i = 0; i < n; i++) out.push(blk(Q.upX1, Q.stairX1 - 0.08, Q.lowY, Q.lowY + rise * (i + 1), Q.upZ0 + run * i, Q.upZ0 + run * (i + 1), i % 2 ? WHITE : WHITE_D));
  }
  // 下層欄杆：凸出甲板的西、北、南緣；連接走道東端
  rail(out, Q.x0 + 0.05, Q.z0 + 0.05, Q.x0 + 0.05, Q.z1 - 0.05, Q.lowY, false);
  rail(out, Q.x0 + 0.05, Q.z0 + 0.05, P.seaX, Q.z0 + 0.05, Q.lowY, false);
  rail(out, Q.x0 + 0.05, Q.z1 - 0.05, Q.upX0, Q.z1 - 0.05, Q.lowY, false);
  rail(out, Q.stairX1 - 0.05, Q.z0 + 0.05, Q.stairX1 - 0.05, Q.upZ0, Q.lowY, false);
  // 樓梯外側：斜側板＋斜扶手＋幾根立柱
  { const len = Math.hypot(Q.stairZ1 - Q.upZ0, Q.topY - Q.lowY), ang = Math.atan2(Q.topY - Q.lowY, Q.stairZ1 - Q.upZ0);
    const my = (Q.lowY + Q.topY) / 2, mz = (Q.upZ0 + Q.stairZ1) / 2;
    for (const [w, h, dy] of [[0.07, 0.07, 0.95], [0.1, 0.4, 0.05]] as const) {
      const g = new THREE.BoxGeometry(w, h, len); g.rotateX(-ang); g.translate(Q.stairX1 - 0.05, my + dy, mz); out.push(tint(g, WHITE));
    }
    for (let i = 0; i <= 4; i++) { const t = i / 4, z = Q.upZ0 + (Q.stairZ1 - Q.upZ0) * t, y = Q.lowY + (Q.topY - Q.lowY) * t; out.push(blk(Q.stairX1 - 0.1, Q.stairX1, y, y + 0.95, z - 0.05, z + 0.05, WHITE)); }
  }
  // 上層欄杆：西、北、南緣；東側（樓梯旁）到樓梯頂；樓梯頂平台南、東緣
  rail(out, Q.upX0 - 0.05, Q.upZ0 - 0.05, Q.upX0 - 0.05, Q.z1 + 0.05, Q.topY, false);
  rail(out, Q.upX0 - 0.05, Q.upZ0 - 0.05, Q.upX1, Q.upZ0 - 0.05, Q.topY, false);
  rail(out, Q.upX0 - 0.05, Q.z1 + 0.05, Q.stairX1, Q.z1 + 0.05, Q.topY, false);
  rail(out, Q.upX1 - 0.05, Q.upZ0 - 0.05, Q.upX1 - 0.05, Q.stairZ1, Q.topY, false);
  rail(out, Q.stairX1 - 0.05, Q.stairZ1, Q.stairX1 - 0.05, Q.z1 + 0.05, Q.topY, false);
  // 花架：四根白柱＋外框＋橫條
  { const x0 = Q.upX0 + 0.1, x1 = Q.upX1 - 0.1, z0 = Q.upZ0 + 0.1, z1 = Q.z1 - 0.1, top = Q.pergolaY;
    for (const x of [x0, x1]) for (const z of [z0, z1]) out.push(blk(x - 0.1, x + 0.1, Q.topY, top, z - 0.1, z + 0.1, WHITE));
    for (const z of [z0, z1]) out.push(blk(x0 - 0.25, x1 + 0.25, top - 0.18, top, z - 0.07, z + 0.07, WHITE));
    for (const x of [x0, x1]) out.push(blk(x - 0.07, x + 0.07, top - 0.18, top, z0 - 0.25, z1 + 0.25, WHITE));
    const n = 7;
    for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * (i + 0.5) / n; out.push(blk(x0 - 0.35, x1 + 0.35, top, top + 0.1, z - 0.04, z + 0.04, WHITE)); }
  }
  return out;
}
