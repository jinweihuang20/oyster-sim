/**
 * CR-39：碼頭西邊海上的沙洲平台（純邏輯，不碰 three.js，方便測試）。
 *
 * 世界單位＝公尺（開船／游泳速度、碼頭間隔都按公尺寫）。碼頭西端 PierX1＝-40。
 * 往西 100 m 是 x＝-140，剛好是船／海面可行駛範圍的西緣（PB.sea.x0、伺服器 SeaMinX）。
 * 若把沙洲中心放在 -140，西半邊會懸出可走海面、船也繞不過去。
 * 所以中心放在 x＝-132、z＝0（距碼頭西端 92 m）：整座沙洲和東側小棧橋都在海面範圍內，西緣外側還留一點水。
 * 廣場霧遠平面岸上是 64 m、第一人稱鏡頭 far＝90；開船後霧拉到 130、鏡頭 far＝140，從碼頭出發就能看見沙洲。
 *
 * 伺服器 StatsServer/Plaza/PlazaWorld.Islet.cs 用同一組數字（兩邊測試都檢查同一批點）。
 */
export const ISLET = {
  /** 沙洲中心（世界 xz；地面高度另算） */
  cx: -132,
  cz: 0,
  /** 平坦頂半徑、外坡腳半徑（總寬約 9.2 m，大約站得下 10 人） */
  rTop: 3.4,
  r: 4.6,
  /** 平坦頂高度（廣場地面＝0，水面約 -0.42） */
  topY: 0.32,
  /** 東側小木棧橋（朝碼頭，方便停船上岸） */
  jetX0: -127.6,
  jetX1: -124.0,
  jetZ0: -1.0,
  jetZ1: 1.0,
  jetY: 0.14,
  /** 賣魚攤位置、可賣距離（蓋過沙洲和棧橋） */
  sellX: -133.2,
  sellZ: 1.8,
  sellR: 5.8,
} as const;

const M = 0.3;
const walkR = ISLET.r - M;

export type Rect = { x0: number; x1: number; z0: number; z1: number };
export const ISLET_JET_WALK: Rect = { x0: ISLET.jetX0, x1: ISLET.jetX1 - M, z0: ISLET.jetZ0 + M, z1: ISLET.jetZ1 - M };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const inR = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

export const isletDx = (x: number, z: number) => Math.hypot(x - ISLET.cx, z - ISLET.cz);

/** 這一點在沙洲或棧橋的實體上（含坡腳；船／拋竿打到岸上） */
export function onIsletLand(x: number, z: number): boolean {
  if (isletDx(x, z) <= ISLET.r + 0.05) return true;
  return x >= ISLET.jetX0 - 0.05 && x <= ISLET.jetX1 + 0.05 && z >= ISLET.jetZ0 - 0.05 && z <= ISLET.jetZ1 + 0.05;
}

/** 人站得住的地方（平坦頂＋內坡、棧橋，已扣掉邊緣） */
export function onIsletWalk(x: number, z: number): boolean {
  if (isletDx(x, z) <= walkR) return true;
  return inR(ISLET_JET_WALK, x, z);
}

/** 地面高度：沙洲平坦頂、外坡落到接近水面、棧橋；其他地方 0 */
export function isletGroundY(x: number, z: number): number {
  if (x >= ISLET.jetX0 && x <= ISLET.jetX1 && z >= ISLET.jetZ0 && z <= ISLET.jetZ1) return ISLET.jetY;
  const d = isletDx(x, z);
  if (d <= ISLET.rTop) return ISLET.topY;
  if (d >= ISLET.r) return 0;
  const t = (d - ISLET.rTop) / (ISLET.r - ISLET.rTop);
  return ISLET.topY * (1 - t) + 0.04 * t;
}

/** 到沙洲／棧橋實體的距離（在上面＝0） */
export function distToIslet(x: number, z: number): number {
  const d = Math.max(0, isletDx(x, z) - ISLET.r);
  const qx = clamp(x, ISLET.jetX0, ISLET.jetX1), qz = clamp(z, ISLET.jetZ0, ISLET.jetZ1);
  const dj = Math.hypot(x - qx, z - qz);
  return Math.min(d, dj);
}

/** 上岸落點：離沙洲／棧橋 maxD 以內，回可走範圍內最近的一點；太遠回 null */
export function isletLandSpot(x: number, z: number, maxD: number): { x: number; z: number } | null {
  if (distToIslet(x, z) > maxD) return null;
  return isletClampToWalk(x, z);
}

/** 推到最近的可走點（沙洲圓或棧橋） */
export function isletClampToWalk(x: number, z: number): { x: number; z: number } {
  if (onIsletWalk(x, z)) return { x, z };
  const d = isletDx(x, z);
  const toSand = d < 1e-4
    ? { x: ISLET.cx + walkR, z: ISLET.cz }
    : { x: ISLET.cx + (x - ISLET.cx) / d * walkR, z: ISLET.cz + (z - ISLET.cz) / d * walkR };
  const toJet = { x: clamp(x, ISLET_JET_WALK.x0, ISLET_JET_WALK.x1), z: clamp(z, ISLET_JET_WALK.z0, ISLET_JET_WALK.z1) };
  const ds = Math.hypot(toSand.x - x, toSand.z - z), dj = Math.hypot(toJet.x - x, toJet.z - z);
  return ds <= dj ? toSand : toJet;
}

/**
 * 走動夾限：人已經在沙洲上（或上一步在），只准留在可走範圍。
 * 回 true＝這一步歸沙洲管（呼叫端不要再套碼頭夾限，免得沿著碼頭中線走到海裡）。
 */
export function isletWalkClamp(p: { x: number; z: number }, prevX: number, prevZ: number): boolean {
  const near = (x: number, z: number) => x < -118 && Math.abs(z) < 14;
  if (!near(p.x, p.z) && !near(prevX, prevZ) && !onIsletWalk(prevX, prevZ)) return false;
  if (onIsletWalk(p.x, p.z)) return true;
  const q = isletClampToWalk(p.x, p.z);
  // 從海面上一步跨不上來（要靠下船／游上岸）
  if (!onIsletWalk(prevX, prevZ) && !onIsletLand(prevX, prevZ)) return false;
  p.x = q.x; p.z = q.z;
  return true;
}

/** 站在沙洲或棧橋上，四面都是海，可以釣魚 */
export function isletFishable(x: number, z: number): boolean {
  return onIsletWalk(x, z);
}

/** 靠近沙洲賣魚攤（人站在沙洲／棧橋上，或船靠棧橋） */
export function isletSellNear(x: number, z: number, boatR = 7): boolean {
  return Math.hypot(x - ISLET.sellX, z - ISLET.sellZ) <= ISLET.sellR || onIsletWalk(x, z) || distToIslet(x, z) <= boatR;
}

/**
 * 從沙洲下水的落點：往外推到實體外側 1.4 m，仍在海面範圍內。
 * 人要先站在沙洲上。
 */
export function isletDiveSpot(x: number, z: number): { x: number; z: number } | null {
  if (!onIsletWalk(x, z) && !onIsletLand(x, z)) return null;
  const d = isletDx(x, z);
  const dirs: [number, number][] = [];
  if (x >= ISLET.jetX0) dirs.push([1, 0]);
  if (d > 1e-4) dirs.push([(x - ISLET.cx) / d, (z - ISLET.cz) / d]);
  dirs.push([0, 1], [0, -1], [-1, 0], [1, 0]);
  for (const [ux, uz] of dirs) {
    for (let k = 1.2; k <= 5; k += 0.3) {
      const qx = clamp(x + ux * k, -140, -25), qz = clamp(z + uz * k, -75, 75);
      if (onIsletLand(qx, qz)) continue;
      const dd = Math.hypot(qx - x, qz - z);
      if (dd >= 0.8 && dd <= 5.8) return { x: qx, z: qz };
    }
  }
  return null;
}

/** 船／游泳者撞到沙洲或棧橋：推出去。回傳有沒有撞到。不配置。 */
export function isletPushOut(o: { x: number; z: number }, r: number): boolean {
  if (o.x > -118 || Math.abs(o.z) > 16) return false;
  let hit = false;
  const d = isletDx(o.x, o.z), need = ISLET.r + r;
  if (d < need) {
    if (d > 1e-4) { const k = (need - d) / d; o.x += (o.x - ISLET.cx) * k; o.z += (o.z - ISLET.cz) * k; }
    else o.x = ISLET.cx + need;
    hit = true;
  }
  const qx = clamp(o.x, ISLET.jetX0, ISLET.jetX1), qz = clamp(o.z, ISLET.jetZ0, ISLET.jetZ1);
  const dx = o.x - qx, dz = o.z - qz, jd = Math.hypot(dx, dz);
  if (jd < r) {
    if (jd > 1e-4) { const k = (r - jd) / jd; o.x += dx * k; o.z += dz * k; }
    else o.x = ISLET.jetX1 + r;
    hit = true;
  }
  return hit;
}
