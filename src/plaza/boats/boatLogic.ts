/**
 * 廣場西側海面：膠筏的純邏輯（不碰 three.js／DOM，方便測試）。
 * 座標、距離門檻和伺服器 StatsServer/Plaza/PlazaWorld.Boats.cs 一致（客戶端提示略嚴一點，免得按了被拒）。
 * 船頭方向 h：前進向量 = (-sin h, -cos h)，跟出海採蚵同一套。
 */
import { SEA } from '../../sea/seaLogic';

/** 調整用數字（改這裡就好） */
export const PB = {
  count: 20, seats: 4,
  /** 岸線 x（再往西是海）；碼頭從岸線往西伸 */
  shoreX: -24, pierX0: -24, pierX1: -55, pierHalfW: 1.2,
  /** 廣場西緣可以上岸的 z 範圍 */
  shoreZ: 11,
  sea: { x0: -140, x1: -25, z0: -75, z1: 75 },
  /** 水面高度（廣場地面＝0，碼頭甲板＝0） */
  waterY: -0.42,
  // 操作手感：沿用出海採蚵的極速／加速／轉向（空船不載蚵）
  maxSpd: SEA.maxSpd, rev: SEA.rev, accel: SEA.accel, turn: SEA.turn,
  /** 船身＝前後兩個圓（同出海採蚵） */
  hullR: SEA.boatR, hullHalf: SEA.boatHalf,
  /** 碰撞：速度 ×bump，撞到碼頭 ×0.4 */
  bump: SEA.bump, pierBump: 0.4,
  /** 客戶端提示距離（量船中心；伺服器：上船 4.6、下船 5.2、救人 3.6／船速 2.5） */
  boardR: 4.3, landR: 4.6, rescueR: 3.0, rescueMaxV: 2.0,
  /** 撞船：撞人那艘要多快（m/s）才會把對方撞下水（伺服器同值） */
  ramSpeed: 4.0, ramCd: 2.5,
  /** 游泳：速度、倒退、轉向、上岸距離 */
  swimSpd: 1.35, swimRev: 0.5, swimTurn: 2.2, climbR: 1.6,
  /** 被殼打中：船晃秒數 */
  swayT: 1.1,
  /** 網路：駕駛回報頻率、游泳回報頻率 */
  driveHz: 10, swimHz: 5,
  /** 遠處船改用低模（公尺） */
  lodFar: 34,
} as const;

/** 碼頭排位：偶數在北側（船頭朝北 h=0）、奇數在南側（h=π），船尾靠碼頭。與伺服器 DockSlot 一致 */
export function dockSlot(i: number) {
  const side = i % 2 === 0 ? -1 : 1, k = Math.floor(i / 2);
  return { x: -27.5 - k * 2.9, z: side * 4.2, h: side < 0 ? 0 : Math.PI };
}

/** 船上的座位（船身座標）：0＝船尾駕駛座、1＝冰桶上、2／3＝甲板 */
export const SEATS: readonly { x: number; y: number; z: number; pose: 'drive' | 'sit' | 'deck' }[] = [
  { x: -0.4, y: 0.59, z: 1.72, pose: 'drive' },
  { x: 0.55, y: 0.71, z: 0.9, pose: 'sit' },
  { x: -0.45, y: 0.28, z: -0.1, pose: 'deck' },
  { x: 0.42, y: 0.28, z: -0.75, pose: 'deck' },
];

export type Hull = { x: number; z: number; h: number; v: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fwd = (h: number) => [-Math.sin(h), -Math.cos(h)] as const;

/** 開船一步（跟出海採蚵同手感，不載蚵、沒有淺灘）；slow＝被打中暫時減速倍率 */
export function stepPlazaBoat(b: Hull, thr: number, steer: number, dt: number, slow = 1) {
  const maxV = PB.maxSpd * slow;
  const target = thr >= 0 ? thr * maxV : thr * maxV * PB.rev;
  const dv = target - b.v, step = PB.accel * dt;
  b.v += Math.abs(dv) <= step ? dv : Math.sign(dv) * step;
  // 沒油門時水的阻力讓船慢慢停
  if (thr === 0) b.v *= Math.exp(-0.6 * dt);
  const turnK = PB.turn * Math.min(1, Math.abs(b.v) / 2.5 + 0.25);
  b.h -= steer * turnK * dt * (b.v < -0.05 ? -1 : 1);
  const [fx, fz] = fwd(b.h);
  b.x += fx * b.v * dt; b.z += fz * b.v * dt;
}

/** 點到碼頭矩形的最近點 */
function pierNearest(x: number, z: number) {
  return { x: clamp(x, PB.pierX1, PB.pierX0), z: clamp(z, -PB.pierHalfW, PB.pierHalfW) };
}
export function distToPier(x: number, z: number) {
  const q = pierNearest(x, z); return Math.hypot(x - q.x, z - q.z);
}
/** 到可上岸地方（碼頭或廣場西緣）的距離 */
export function distToLand(x: number, z: number) {
  const shore = Math.abs(z) <= PB.shoreZ ? Math.max(0, PB.shoreX - x) : 999;
  return Math.min(shore, distToPier(x, z));
}
/** 站得住的岸上位置（碼頭上或廣場裡） */
export function onLand(x: number, z: number) {
  return x >= PB.shoreX - 0.05 || (x >= PB.pierX1 - 0.05 && Math.abs(z) <= PB.pierHalfW + 0.05);
}
/** 從船／水裡上岸的落點：碼頭上（離邊 0.35）或廣場西緣；太遠回 null */
export function landSpot(x: number, z: number, maxD: number = PB.landR): { x: number; z: number } | null {
  const m = 0.35;
  const pier = { x: clamp(x, PB.pierX1 + m, PB.pierX0 - m), z: clamp(z, -PB.pierHalfW + m, PB.pierHalfW - m) };
  const dp = distToPier(x, z);
  const ds = Math.abs(z) <= PB.shoreZ ? Math.max(0, PB.shoreX - x) : 999;
  if (Math.min(dp, ds) > maxD) return null;
  if (dp <= ds) return pier;
  return { x: PB.shoreX + 0.6, z: clamp(z, -PB.shoreZ + 0.5, PB.shoreZ - 0.5) };
}

/** 船身兩個圓心 */
export function hullPts(o: { x: number; z: number; h: number }) {
  const [fx, fz] = fwd(o.h), k = PB.hullHalf;
  return [[o.x + fx * k, o.z + fz * k], [o.x - fx * k, o.z - fz * k]] as const;
}

/** 推出碼頭／岸線／海面範圍；回傳有沒有撞到（撞到會減速） */
export function pushStatic(b: Hull) {
  const r = PB.hullR; let hit = false;
  for (let it = 0; it < 2; it++) for (const [px, pz] of hullPts(b)) {
    // 岸線（整條西緣都是護岸）
    if (px > PB.shoreX - r) { b.x -= px - (PB.shoreX - r); hit = true; }
    // 碼頭
    const q = pierNearest(px, pz), dx = px - q.x, dz = pz - q.z, d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-4) { const k = (r - d) / d; b.x += dx * k; b.z += dz * k; }
      else { const s = pz >= 0 ? 1 : -1; b.z += s * (PB.pierHalfW + r - Math.abs(pz)); }
      hit = true;
    }
  }
  const S = PB.sea;
  b.x = clamp(b.x, S.x0, S.x1); b.z = clamp(b.z, S.z0, S.z1);
  if (hit) b.v *= PB.pierBump;
  return hit;
}

/** 自己的船撞到別艘（別艘不動）：把自己推開；回傳撞擊方向（null＝沒撞） */
export function pushFromBoat(me: Hull, o: { x: number; z: number; h: number }): { ux: number; uz: number } | null {
  const m = PB.hullR * 2; let hit: { ux: number; uz: number } | null = null;
  for (let it = 0; it < 2; it++) for (const [ax, az] of hullPts(me)) for (const [bx, bz] of hullPts(o)) {
    const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz);
    if (d >= m) continue;
    const ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0;
    me.x += ux * (m - d); me.z += uz * (m - d);
    hit = { ux: -ux, uz: -uz };
  }
  return hit;
}

/** 撞得夠猛（撞人那艘的速度）才會讓對方落水 */
export const isHardRam = (v: number) => Math.abs(v) >= PB.ramSpeed;

export type Swimmer = { x: number; z: number; h: number };
/** 游泳一步：坦克式（前後＋轉向），不能游進碼頭、不能游上岸（上岸要按鈕） */
export function stepSwim(s: Swimmer, thr: number, steer: number, dt: number) {
  s.h -= steer * PB.swimTurn * dt;
  const sp = thr >= 0 ? thr * PB.swimSpd : thr * PB.swimSpd * PB.swimRev;
  const [fx, fz] = fwd(s.h);
  s.x += fx * sp * dt; s.z += fz * sp * dt;
  const q = pierNearest(s.x, s.z), dx = s.x - q.x, dz = s.z - q.z, d = Math.hypot(dx, dz), r = 0.45;
  if (d < r) { if (d > 1e-4) { s.x = q.x + dx / d * r; s.z = q.z + dz / d * r; } else s.z = (s.z >= 0 ? 1 : -1) * (PB.pierHalfW + r); }
  if (s.x > PB.shoreX - 0.4) s.x = PB.shoreX - 0.4;
  const S = PB.sea;
  s.x = clamp(s.x, S.x0, S.x1); s.z = clamp(s.z, S.z0, S.z1);
}

/** 第一個空的乘客位（1～3）；沒有回 -1 */
export const freePassengerSeat = (seats: readonly string[]) => { for (let i = 1; i < PB.seats; i++) if (!seats[i]) return i; return -1; };
export const boatEmpty = (seats: readonly string[]) => seats.every(s => !s);

/** 落水位置：沿撞擊方向甩出、左右錯開（伺服器同公式） */
export function knockSpot(t: { x: number; z: number }, ux: number, uz: number, k: number) {
  const side = (k % 2 === 0 ? 1 : -1) * (0.8 + 0.5 * k);
  return { x: clamp(t.x + ux * 2.6 - uz * side, PB.sea.x0, PB.sea.x1), z: clamp(t.z + uz * 2.6 + ux * side, PB.sea.z0, PB.sea.z1) };
}

/** 船身擺動（跟出海採蚵的 placeRaft 一致）：回傳 y 偏移、rx、rz */
export function boatBob(x: number, z: number, t: number, v: number, sway = 0) {
  const y = PB.waterY + 0.05 + Math.sin(t * 2.1 + x) * 0.05;
  const rx = Math.sin(t * 1.7 + z) * 0.03 - Math.min(0.06, Math.abs(v) * 0.008);
  const rz = Math.sin(t * 1.3 + x * 0.3) * 0.04 + sway * Math.sin(t * 14) * 0.16;
  return { y, rx, rz };
}

/** 夜晚程度 0→1（17:30 開始暗、19:30 全夜；05:00 開始亮、06:30 全亮） */
export function nightK(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 19.5 || h < 5) return 1;
  if (h >= 17.5) return (h - 17.5) / 2;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  return 0;
}
