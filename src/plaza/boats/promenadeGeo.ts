/**
 * CR-38 西南／西北角海堤步道＋白色兩層觀景台的外觀（北側是南側對 z＝0 的鏡像）。
 * 步道沿護岸一路走到盡頭；觀景台坐落在中段，兩端都有樓梯，陸側人行道可以繞過去。
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
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return tint(g, hex);
};

const WHITE = 0xf1f0ea, WHITE_D = 0xd9d7cf, RAIL_WOOD = 0x4a3324, GRAVEL = 0x9c9b95, GRAVEL_D = 0x8b8a84;
const PAVE = [0xbdb3a2, 0xa99f8e, 0xc8bfae], GROUT = 0x8c8476, STEP = 0xc9c3b6, CURB = 0x8f897c, CURB_D = 0x7d776b;
const CONC = [0xbcb9b0, 0xaeaba2, 0xc6c3ba], DECK = 0xd8d3c6, DECK_D = 0xc6c0b2;

/**
 * 一段欄杆（a→b 水平直線，底在 y）：柱、白色直條、下橫條、上扶手。
 * wood＝上扶手用深色木頭（步道那種）；否則全白（觀景台那種）。
 */
function rail(out: THREE.BufferGeometry[], ax: number, az: number, bx: number, bz: number, y: number, wood: boolean, gap = 0.42) {
  const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) return;
  const ry = Math.atan2(bz - az, bx - ax);
  const H = 0.95, put = (w: number, h: number, d: number, t: number, yy: number, hex: number) => {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateY(-ry); g.translate(ax + (bx - ax) * t, yy, az + (bz - az) * t); out.push(tint(g, hex));
  };
  put(L + 0.08, 0.07, wood ? 0.11 : 0.07, 0.5, y + H, wood ? RAIL_WOOD : WHITE);
  put(L, 0.05, 0.05, 0.5, y + 0.14, WHITE);
  const nPost = Math.max(1, Math.round(L / 2));
  for (let i = 0; i <= nPost; i++) put(0.1, H, 0.1, i / nPost, y + H / 2, WHITE);
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

/** z0＝樓梯底部（步道）、z1＝頂部（上層）；南側數字，再用 Z／side 鏡像 */
function stairs(
  out: THREE.BufferGeometry[], side: 1 | -1, x0: number, x1: number,
  z0: number, z1: number, y0: number, y1: number,
) {
  const Z = (z: number) => z * side;
  const n = 12, rise = (y1 - y0) / n, run = (z1 - z0) / n;
  for (let i = 0; i < n; i++) out.push(blk(x0, x1 - 0.08, y0, y0 + rise * (i + 1), Z(z0 + run * i), Z(z0 + run * (i + 1)), i % 2 ? WHITE : WHITE_D));
  const dz = z1 - z0;
  const len = Math.hypot(dz, y1 - y0);
  const ang = Math.atan2(y1 - y0, Math.abs(dz)) * side * Math.sign(dz || 1);
  const my = (y0 + y1) / 2, mz = Z((z0 + z1) / 2);
  for (const [w, h, dy] of [[0.07, 0.07, 0.95], [0.1, 0.4, 0.05]] as const) {
    const g = new THREE.BoxGeometry(w, h, len); g.rotateX(-ang); g.translate(x1 - 0.05, my + dy, mz); out.push(tint(g, WHITE));
  }
  for (let i = 0; i <= 4; i++) {
    const t = i / 4, z = z0 + dz * t, y = y0 + (y1 - y0) * t;
    out.push(blk(x1 - 0.1, x1, y, y + 0.95, Z(z) - 0.05, Z(z) + 0.05, WHITE));
  }
}

/** 步道＋觀景台所有零件（南北兩側，給 boatScene 合進碼頭 mesh） */
export function promenadeParts(): THREE.BufferGeometry[] {
  return [...promenadePartsSide(1), ...promenadePartsSide(-1)];
}
function promenadePartsSide(side: 1 | -1): THREE.BufferGeometry[] {
  const Z = (z: number) => z * side;
  const out: THREE.BufferGeometry[] = [];
  const P = PROM, Q = PLAT;
  const zA = P.z0 + P.rampL;

  // ---------- 步道（一路到海堤盡頭） ----------
  out.push(tile(P.seaX, P.landX + 0.42, 0.004, Z(P.z0 - 1.3), Z(P.z0), PAVE[1]));
  out.push(blk(P.stepX1, P.landX, -0.12, 0.005, Z(P.z0), Z(P.zEnd), GROUT));
  { const nx = 2, w = (P.landX - P.stepX1) / nx, d = 1.1, nz = Math.round((P.zEnd - P.z0) / d);
    for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) {
      const off = (i % 2) * w * 0.5, x0 = Math.max(P.stepX1, P.stepX1 + j * w - off) + 0.03, x1 = Math.min(P.landX, P.stepX1 + (j + 1) * w - off) - 0.03;
      if (x1 - x0 < 0.08) continue;
      out.push(tile(x0, x1, 0.012, Z(P.z0 + i * d + 0.03), Z(P.z0 + (i + 1) * d - 0.03), PAVE[(i * 2 + j) % 3]));
    }
    for (let i = 1; i < nz; i += 2) out.push(tile(P.landX - w * 0.5 + 0.03, P.landX - 0.03, 0.012, Z(P.z0 + i * d + 0.03), Z(P.z0 + (i + 1) * d - 0.03), PAVE[(i + 2) % 3]));
  }
  const hy = P.pathY / 2;
  out.push(blk((P.gravelX1 + P.stepX1) / 2, P.stepX1, -0.1, hy, Z(zA), Z(P.zEnd), STEP));
  out.push(blk(P.gravelX1, (P.gravelX1 + P.stepX1) / 2, -0.1, P.pathY, Z(zA), Z(P.zEnd), STEP));
  out.push(blk(P.seaX, P.gravelX1, -0.25, P.pathY, Z(zA), Z(P.zEnd), GRAVEL));
  for (let z = zA + 0.8, i = 0; z < P.zEnd - 1; z += 2.4, i++) out.push(tile(P.seaX + 0.25 + (i % 3) * 0.3, P.seaX + 0.85 + (i % 3) * 0.3, P.pathY + 0.004, Z(z), Z(z + 1.0 + (i % 2) * 0.4), GRAVEL_D));
  // 近廣場進場台階
  out.push(blk(P.seaX, P.stepX1, -0.1, hy, Z(P.z0), Z(P.z0 + P.rampL / 2), STEP));
  out.push(blk(P.seaX, P.stepX1, -0.1, P.pathY, Z(P.z0 + P.rampL / 2), Z(zA), STEP));
  // 陸側石墩、海側欄杆、盡頭欄杆
  for (let z = P.z0 + 0.1, i = 0; z < P.zEnd - 0.3; z += 1.2, i++) out.push(blk(P.landX, P.landX + 0.42, -0.05, 0.32 + (i % 2) * 0.03, Z(z), Z(z + 1.05), i % 2 ? CURB : CURB_D));
  rail(out, P.seaX + 0.06, Z(P.z0 + 0.05), P.seaX + 0.06, Z(P.zEnd - 0.05), P.pathY, true);
  rail(out, P.seaX + 0.06, Z(P.zEnd - 0.05), P.landX, Z(P.zEnd - 0.05), P.pathY, true);
  // 消波塊：欄杆外兩排，間隔稍寬以控制三角形數
  for (let z = P.z0 + 0.6, i = 0; z < P.zEnd - 0.4; z += 1.55, i++) {
    tetrapod(out, P.seaX - 0.5, -0.2, Z(z), i * 1.3, i * 2.1, i * 0.7, 1.0, CONC[i % 3]);
    tetrapod(out, P.seaX - 1.2, -0.55, Z(z + 0.7), i * 0.9 + 1, i * 1.7, i * 1.1, 1.05, CONC[(i + 1) % 3]);
  }

  // ---------- 觀景台（坐落在步道中段，兩端樓梯） ----------
  // 下層：凸出海面的甲板＋前後連接（人行道在東側繼續穿過）
  out.push(blk(Q.x0, Q.upX1, Q.lowY - 0.26, Q.lowY, Z(Q.z0), Z(Q.z1), DECK));
  out.push(blk(Q.x0, Q.upX1, Q.lowY - 0.34, Q.lowY - 0.26, Z(Q.z0), Z(Q.z1), DECK_D));
  for (const [x, z] of [[Q.x0 + 0.25, Q.z0 + 0.25], [Q.x0 + 0.25, (Q.z0 + Q.z1) / 2], [Q.x0 + 0.25, Q.z1 - 0.25], [P.seaX - 0.5, Q.z0 + 0.25], [P.seaX - 0.5, Q.z1 - 0.25]] as const)
    out.push(blk(x - 0.16, x + 0.16, -1.4, Q.lowY - 0.3, Z(z) - 0.16, Z(z) + 0.16, WHITE_D));
  // 上層底下：內縮的淺灰牆＋白柱
  out.push(blk(Q.upX0 + 0.15, Q.upX1 - 0.15, Q.lowY, Q.topY - 0.2, Z(Q.upZ0 + 0.15), Z(Q.upZ1 - 0.15), WHITE_D));
  for (const x of [Q.upX0 + 0.15, (Q.upX0 + Q.upX1) / 2, Q.upX1 - 0.15]) for (const z of [Q.upZ0 + 0.15, Q.upZ1 - 0.15])
    out.push(blk(x - 0.17, x + 0.17, Q.lowY, Q.topY - 0.2, Z(z) - 0.17, Z(z) + 0.17, WHITE));
  out.push(blk(Q.upX0 + 0.15 - 0.17, Q.upX0 + 0.15 + 0.17, Q.lowY, Q.topY - 0.2, Z((Q.upZ0 + Q.upZ1) / 2) - 0.17, Z((Q.upZ0 + Q.upZ1) / 2) + 0.17, WHITE));
  // 上層地板＋東側樓梯頂平台
  out.push(blk(Q.upX0 - 0.1, Q.upX1, Q.topY - 0.22, Q.topY, Z(Q.upZ0 - 0.1), Z(Q.upZ1 + 0.1), WHITE));
  out.push(blk(Q.upX1, Q.stairX1, Q.topY - 0.22, Q.topY, Z(Q.upZ0), Z(Q.upZ1), WHITE));
  // 近端、遠端樓梯
  stairs(out, side, Q.upX1, Q.stairX1, Q.nearZ0, Q.nearZ1, Q.lowY, Q.topY);
  stairs(out, side, Q.upX1, Q.stairX1, Q.farZ1, Q.farZ0, Q.lowY, Q.topY);
  // 下層欄杆：凸出甲板的西、近、遠緣（東側留給步道穿過）
  rail(out, Q.x0 + 0.05, Z(Q.z0 + 0.05), Q.x0 + 0.05, Z(Q.z1 - 0.05), Q.lowY, false);
  rail(out, Q.x0 + 0.05, Z(Q.z0 + 0.05), P.seaX + 0.06, Z(Q.z0 + 0.05), Q.lowY, false);
  rail(out, Q.x0 + 0.05, Z(Q.z1 - 0.05), P.seaX + 0.06, Z(Q.z1 - 0.05), Q.lowY, false);
  // 上層欄杆：西、近、遠緣；東側只在兩座樓梯之間（樓梯口不擋）
  rail(out, Q.upX0 - 0.05, Z(Q.upZ0 - 0.05), Q.upX0 - 0.05, Z(Q.upZ1 + 0.05), Q.topY, false);
  rail(out, Q.upX0 - 0.05, Z(Q.upZ0 - 0.05), Q.upX1, Z(Q.upZ0 - 0.05), Q.topY, false);
  rail(out, Q.upX0 - 0.05, Z(Q.upZ1 + 0.05), Q.upX1, Z(Q.upZ1 + 0.05), Q.topY, false);
  rail(out, Q.stairX1 - 0.05, Z(Q.upZ0), Q.stairX1 - 0.05, Z(Q.upZ1), Q.topY, false);
  // 花架
  { const x0 = Q.upX0 + 0.1, x1 = Q.upX1 - 0.1, z0 = Z(Q.upZ0 + 0.1), z1 = Z(Q.upZ1 - 0.1), top = Q.pergolaY;
    for (const x of [x0, x1]) for (const z of [z0, z1]) out.push(blk(x - 0.1, x + 0.1, Q.topY, top, z - 0.1, z + 0.1, WHITE));
    for (const z of [z0, z1]) out.push(blk(x0 - 0.25, x1 + 0.25, top - 0.18, top, z - 0.07, z + 0.07, WHITE));
    for (const x of [x0, x1]) out.push(blk(x - 0.07, x + 0.07, top - 0.18, top, z0 - 0.25, z1 + 0.25, WHITE));
    const n = 6;
    for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * (i + 0.5) / n; out.push(blk(x0 - 0.35, x1 + 0.35, top, top + 0.1, z - 0.04, z + 0.04, WHITE)); }
  }
  return out;
}
