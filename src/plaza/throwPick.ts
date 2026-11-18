/**
 * 廣場丟殼選目標（純函式，方便測試）。
 *
 * 舊做法只看「頭」投影到螢幕離準心多近，而且框很大（約 1/3 螢幕寬、半個螢幕高），
 * 不管遠近：瞄對面玩家身體時，後面較遠的阿婆頭部投影更靠近地平線／準心，就被選走；
 * 沒瞄阿婆、但她在大框內也會被丟中。
 *
 * 新做法：從鏡頭沿準心方向打一條射線，每個人當成一段直立的身體（頭頂到腰下）：
 * 1. 射線真的穿過身體 → 取「最近」的那個（前面的人擋住後面的）。
 * 2. 都沒穿過 → 小範圍輔助瞄準，選角度偏差最小的；阿婆的輔助範圍較小，
 *    且玩家優先（沒真的瞄到阿婆就不會丟中她）。
 */
export type V3 = { x: number; y: number; z: number };

export type ThrowPickCand<T> = {
  item: T;
  head: V3;
  isNpc: boolean;
  /** 站著／走動：身體從頭往下延伸較長（頭到大腿），預設用坐姿 */
  standing?: boolean;
};

export type ThrowPickOpts = {
  /** 身體半徑（公尺）：射線離身體中軸這麼近就算直接瞄中 */
  bodyR?: number;
  /** 頭頂高出頭中心多少 */
  headTop?: number;
  /** 身體往下延伸多少（坐姿：頭到大腿） */
  bodyDown?: number;
  /** 站姿身體往下延伸多少（頭到大腿） */
  standDown?: number;
  /** 輔助瞄準最大角度（弧度）：玩家 */
  assistPlayer?: number;
  /** 輔助瞄準最大角度（弧度）：阿婆（較嚴） */
  assistNpc?: number;
  /** 最遠可丟距離 */
  maxDist?: number;
};

const D: Required<ThrowPickOpts> = {
  bodyR: 0.22,
  headTop: 0.12,
  bodyDown: 0.55,
  standDown: 0.85,
  assistPlayer: 0.1,
  assistNpc: 0.035,
  maxDist: 30,
};

/** 射線（origin + dir*t, t>=0）與線段 a-b 的最近距離與射線參數 t */
export function raySegmentDist(o: V3, d: V3, a: V3, b: V3): { dist: number; t: number } {
  const ux = d.x, uy = d.y, uz = d.z;
  const vx = b.x - a.x, vy = b.y - a.y, vz = b.z - a.z;
  const wx = o.x - a.x, wy = o.y - a.y, wz = o.z - a.z;
  const A = ux * ux + uy * uy + uz * uz;
  const B = ux * vx + uy * vy + uz * vz;
  const C = vx * vx + vy * vy + vz * vz;
  const Dd = ux * wx + uy * wy + uz * wz;
  const E = vx * wx + vy * wy + vz * wz;
  const den = A * C - B * B;
  let s: number, t: number;
  if (den < 1e-9) { s = 0; t = C > 1e-9 ? E / C : 0; }
  else { s = (B * E - C * Dd) / den; t = (A * E - B * Dd) / den; }
  // s：射線參數（>=0），t：線段參數（0..1）
  if (t < 0) t = 0; else if (t > 1) t = 1;
  // 依夾住的線段點重算射線參數
  const px = a.x + vx * t, py = a.y + vy * t, pz = a.z + vz * t;
  s = A > 1e-9 ? ((px - o.x) * ux + (py - o.y) * uy + (pz - o.z) * uz) / A : 0;
  if (s < 0) s = 0;
  // 依射線點再回投線段一次，求更精確的最近點
  const qx = o.x + ux * s, qy = o.y + uy * s, qz = o.z + uz * s;
  let t2 = C > 1e-9 ? ((qx - a.x) * vx + (qy - a.y) * vy + (qz - a.z) * vz) / C : 0;
  if (t2 < 0) t2 = 0; else if (t2 > 1) t2 = 1;
  const rx = a.x + vx * t2 - qx, ry = a.y + vy * t2 - qy, rz = a.z + vz * t2 - qz;
  return { dist: Math.hypot(rx, ry, rz), t: s * Math.sqrt(A) };
}

/** 從準心射線選丟殼目標；沒有就回 null（丟地上）。 */
export function pickThrowTarget<T>(origin: V3, dir: V3, cands: ThrowPickCand<T>[], opts: ThrowPickOpts = {}): T | null {
  const o = { ...D, ...opts };
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (!(len > 1e-9)) return null;
  const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
  let direct: T | null = null, directT = Infinity;
  let assist: T | null = null, assistScore = Infinity;
  for (const c of cands) {
    const h = c.head;
    if (!h || ![h.x, h.y, h.z].every(Number.isFinite)) continue;
    const top = { x: h.x, y: h.y + o.headTop, z: h.z };
    const bot = { x: h.x, y: h.y - (c.standing ? o.standDown : o.bodyDown), z: h.z };
    const { dist, t } = raySegmentDist(origin, d, top, bot);
    if (!(t > 0.05) || t > o.maxDist) continue; // 在鏡頭後面／太遠
    if (dist <= o.bodyR) {
      if (t < directT) { direct = c.item; directT = t; }
      continue;
    }
    const ang = Math.atan2(dist - o.bodyR, t);
    const lim = c.isNpc ? o.assistNpc : o.assistPlayer;
    if (ang > lim) continue;
    // 同樣接近時玩家優先
    const score = ang / lim + (c.isNpc ? 0.5 : 0);
    if (score < assistScore) { assist = c.item; assistScore = score; }
  }
  return direct ?? assist;
}
