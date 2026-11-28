/**
 * CR-38：西岸海堤步道＋白色兩層觀景台（純邏輯，不碰 three.js，方便測試）。
 *
 * 位置：廣場西南角與西北角各一段，沿護岸往外延伸，走到底是觀景台，下層甲板凸出到海面上。
 * 北＝世界 -Z、海＝世界 -X（跟碼頭同一套座標）；廣場地面 y=0。
 * 北側是南側對 z＝0 的鏡像（同一組 x，z 變號）：
 *
 *   南側步道（z 11.5～24）／北側步道（z -11.5～-24）：
 *     靠海側碎石步道（較高）＋兩階＋靠陸側石紋人行道＋陸側石墩；海側白色欄杆＋深色木扶手、欄杆外消波塊。
 *   南側觀景台（z 24～30）／北側觀景台（z -24～-30）：
 *     下層：連接走道＋凸出海面的甲板（x -27.6～-25.2）。
 *     上層：x -25.2～-21.4（底下是白色結構，不能鑽進去），頂上白色花架。
 *     樓梯：東側 x -21.4～-20.2，從上層近廣場那端爬到遠端，再接上層平台。
 *
 * 北側工寮街（|x|≤10.5、z≥-14）在步道東側約 9 m 外，不會擋住走道、店家、NPC 或北側漁船。
 *
 * 伺服器 StatsServer/Plaza/PlazaWorld.Promenade.cs 用同一組數字（兩邊測試都檢查同一批點）。
 */

/** 廣場南緣（跟 layout.ts WALK_BOUND 同值；這裡不 import 避免循環） */
const PLAZA_SOUTH_Z = 11.5;

/** 步道（南側數字；北側 z 變號） */
export const PROM = {
  /** 海側欄杆線（＝岸線 PB.shoreX） */
  seaX: -24,
  /** 陸側石墩內緣 */
  landX: -20.2,
  /** 南北範圍（近廣場那端接廣場南／北緣） */
  z0: PLAZA_SOUTH_Z, z1: 24,
  /** 碎石步道東緣、台階東緣（再往東是石紋人行道） */
  gravelX1: -22.4, stepX1: -21.8,
  /** 碎石步道高度（比人行道高兩階） */
  pathY: 0.34,
  /** 進場台階、人行道接觀景台的台階長度 */
  rampL: 0.6,
  /** 消波塊外緣（再往西才是能開船的水面） */
  tetraX: -25.6,
} as const;

/** 觀景台（南側數字；北側 z 變號） */
export const PLAT = {
  /** 下層甲板凸出海面的西緣 */
  x0: -27.6,
  z0: 24, z1: 30,
  /** 上層（底下白色結構）範圍 */
  upX0: -25.2, upX1: -21.4, upZ0: 25.4,
  /** 樓梯東緣、爬到頂的 z */
  stairX1: -20.2, stairZ1: 29,
  /** 下層、上層地板高度 */
  lowY: 0.34, topY: 2.7,
  /** 上層花架頂 */
  pergolaY: 4.85,
} as const;

/** 欄杆／牆內縮（人的半徑） */
export const PROM_M = 0.25;

export type Rect = { x0: number; x1: number; z0: number; z1: number };
const M = PROM_M;
const flipZ = (r: Rect): Rect => ({ x0: r.x0, x1: r.x1, z0: -r.z1, z1: -r.z0 });

/** 南側可以走的地方（已扣掉欄杆內縮）；彼此重疊的地方才能互通 */
export const PROM_WALK_S: readonly Rect[] = [
  // 步道（往外多 0.3 跟連接走道重疊）
  { x0: PROM.seaX + M, x1: PROM.landX - M, z0: PROM.z0, z1: PROM.z1 + 0.3 },
  // 下層連接走道
  { x0: PLAT.x0 + M, x1: PLAT.stairX1 - M, z0: PLAT.z0 + M, z1: PLAT.upZ0 - M },
  // 下層凸出海面的甲板
  { x0: PLAT.x0 + M, x1: PLAT.upX0 - M, z0: PLAT.z0 + M, z1: PLAT.z1 - M },
  // 樓梯（含頂端平台）
  { x0: PLAT.upX1 + M, x1: PLAT.stairX1 - M, z0: PLAT.z0 + M, z1: PLAT.z1 - M },
  // 樓梯頂端平台接上層
  { x0: PLAT.upX1 - 0.3, x1: PLAT.stairX1 - M, z0: PLAT.stairZ1, z1: PLAT.z1 - M },
  // 上層
  { x0: PLAT.upX0 + M, x1: PLAT.upX1 - M, z0: PLAT.upZ0 + M, z1: PLAT.z1 - M },
];
export const PROM_WALK_N: readonly Rect[] = PROM_WALK_S.map(flipZ);
/** 南北兩側可走範圍 */
export const PROM_WALK: readonly Rect[] = [...PROM_WALK_S, ...PROM_WALK_N];
/** 南側船／游泳撞得到的實心範圍：消波塊帶、凸出海面的觀景台 */
export const PROM_SOLID_S: readonly Rect[] = [
  { x0: PROM.tetraX, x1: PROM.seaX, z0: PROM.z0, z1: PLAT.z0 },
  { x0: PLAT.x0, x1: PROM.seaX, z0: PLAT.z0, z1: PLAT.z1 },
];
export const PROM_SOLID_N: readonly Rect[] = PROM_SOLID_S.map(flipZ);
export const PROM_SOLID: readonly Rect[] = [...PROM_SOLID_S, ...PROM_SOLID_N];
/** 能走到的最南／最北 z（給走動矩形） */
export const PROM_MAX_Z = PLAT.z1 - M;
export const PROM_MIN_Z = -PROM_MAX_Z;

const inR = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/** 地面高度（南側 z≥0 的數字）；北側把 z 取絕對值再算。 */
function promGroundYAt(x: number, z: number): number {
  if (z <= PROM.z0 || z > PLAT.z1 || x < PLAT.x0 || x > PLAT.stairX1) return 0;
  const P = PLAT;
  if (z >= P.upZ0) {
    // 上層（含樓梯頂平台）
    if (x <= P.upX1) return x >= P.upX0 ? P.topY : P.lowY;
    if (z >= P.stairZ1) return P.topY;
    return P.lowY + (P.topY - P.lowY) * clamp01((z - P.upZ0) / (P.stairZ1 - P.upZ0));
  }
  if (z >= P.z0) return P.lowY;
  // 步道：碎石步道高、台階斜、人行道 0；進場台階、接觀景台台階
  if (x > PROM.landX) return 0;
  const raised = x <= PROM.gravelX1 ? 1 : x >= PROM.stepX1 ? 0 : (PROM.stepX1 - x) / (PROM.stepX1 - PROM.gravelX1);
  const near = clamp01((z - PROM.z0) / PROM.rampL);
  const far = clamp01((z - (PROM.z1 - PROM.rampL)) / PROM.rampL);
  return Math.max(PROM.pathY * raised * near, P.lowY * far);
}

/** 地面高度：步道／觀景台；其他地方 0。每幀呼叫，不配置。 */
export function promGroundY(x: number, z: number): number {
  return z < 0 ? promGroundYAt(x, -z) : promGroundYAt(x, z);
}

/** 這一點在步道／觀景台可走範圍內（南北兩側） */
export function onPromenade(x: number, z: number): boolean {
  if (Math.abs(z) <= PROM.z0) return false;
  for (const r of PROM_WALK) if (inR(r, x, z)) return true;
  return false;
}

/** 欄杆／牆最多能一步跨多高（樓梯一格約 0.2 m，一幀走不到 0.3 m 高差） */
export const PROM_STEP_MAX = 0.45;
const _best = { x: 0, z: 0 };
/**
 * 走動夾限（在廣場矩形夾限之後呼叫）：出了廣場南／北緣、又在步道那條西岸帶上，只准在步道／觀景台上。
 * 北側工寮街（更東、z≥-14）不歸這裡管。
 * 走出可走範圍就推回最近、而且高度接得上的地方（沿欄杆滑）；接不上就退回上一步（上層不會一步掉到下層）。
 * 回 true＝這一步歸步道管（呼叫端不要再套碼頭／工寮街夾限）。
 */
export function promWalkClamp(p: { x: number; z: number }, prevX: number, prevZ: number): boolean {
  // 南側：出了廣場南緣都歸這裡管（沙地不能走）。北側：只處理步道這條西岸帶，避免把工寮街的走動搶過來。
  const side = p.z > PROM.z0 || prevZ > PROM.z0 ? 1 : p.z < -PROM.z0 || prevZ < -PROM.z0 ? -1 : 0;
  if (!side) return false;
  const inStrip = (x: number) => x <= PROM.landX + 1 && x >= PLAT.x0 - 1;
  if (side === -1 && !inStrip(p.x) && !inStrip(prevX)) return false;
  const edge = side * PROM.z0;
  const gy0 = promGroundY(prevX, prevZ);
  const leaving = side === 1 ? p.z <= edge : p.z >= edge;
  if (leaving) {
    // 從步道走回廣場：只能從近廣場那端（x ≥ 岸線）
    if (p.x >= PROM.seaX && Math.abs(gy0) <= PROM_STEP_MAX) return false;
  } else if (onPromenade(p.x, p.z) && Math.abs(promGroundY(p.x, p.z) - gy0) <= PROM_STEP_MAX) return true;
  let bd = Infinity, found = false;
  const tryPt = (x: number, z: number) => {
    const d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
    if (d >= bd || Math.abs(promGroundY(x, z) - gy0) > PROM_STEP_MAX) return;
    bd = d; _best.x = x; _best.z = z; found = true;
  };
  const walk = side === 1 ? PROM_WALK_S : PROM_WALK_N;
  for (const r of walk) {
    const z0 = side === 1 ? Math.max(r.z0, edge + 1e-3) : r.z0;
    const z1 = side === 1 ? r.z1 : Math.min(r.z1, edge - 1e-3);
    tryPt(clamp(p.x, r.x0, r.x1), clamp(p.z, z0, z1));
  }
  // 廣場南／北緣（步道近端以外也可以退回廣場）
  if (p.x >= PROM.seaX) tryPt(p.x, edge);
  if (found) { p.x = _best.x; p.z = _best.z; } else { p.x = prevX; p.z = prevZ; }
  return true;
}

/** 站在步道靠海欄杆邊、或觀景台上下層靠海那一側（可以釣魚） */
export const PROM_FISH_X = -23;
export function promFishable(x: number, z: number): boolean {
  const az = Math.abs(z);
  return az > PROM.z0 && az <= PLAT.z1 && x <= PROM_FISH_X && x >= PLAT.x0;
}

/** 船／游泳者撞步道外的消波塊、觀景台：推出去（r＝碰撞半徑）。回傳有沒有撞到。不配置。 */
export function promPushOut(o: { x: number; z: number }, r: number): boolean {
  if (o.x > PROM.seaX + 1) return false;
  const az = Math.abs(o.z);
  if (az < PROM.z0 - r - 1 || az > PLAT.z1 + r + 1) return false;
  let hit = false;
  for (const s of PROM_SOLID) {
    const qx = clamp(o.x, s.x0, s.x1), qz = clamp(o.z, s.z0, s.z1);
    const dx = o.x - qx, dz = o.z - qz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d > 1e-4) { const k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
    else o.x = s.x0 - r; // 在裡面：往海那邊推
    hit = true;
  }
  return hit;
}
/** 拋到這裡算打到岸上（觀景台／消波塊） */
export function promSolidAt(x: number, z: number): boolean {
  for (const s of PROM_SOLID) if (inR(s, x, z)) return true;
  return false;
}
