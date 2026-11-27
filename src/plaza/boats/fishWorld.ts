/**
 * 釣線的真實世界物理（CR-31）：純邏輯（不碰 three／DOM，方便測試），每幀不配置。
 * 浮標／假魚／上鉤的魚都記「真的世界座標」，加上「放出去的線長」；錨點＝現在人（竿）在哪（船在開就跟著船走）。
 * - 線還鬆（距離 ≤ 線長）：東西留在水裡原地（假魚照常下沉）；船開遠到線拉直：沿著線被拖著走（夾在線長上）。
 * - 船拖得快：深的假魚被水阻抬高一點（還在水面下），浮標一直在水面。
 * - 收線：線長變短，往「現在」的竿子拉過來（不是當初拋竿的位置）。
 * - 拉魚：魚在世界座標裡衝；船開走＝線被拉出去、張力上來；船開過去＝線鬆、距離直接變短。
 * 岸上錨點不動：跟以前的手感一樣。
 */
import { FIGHT_P0, FIGHT_PROG_MIN, fightDistM, yawOf, LURE_PHYS, type Fight, type LureKey, type LureSt } from './fishLogic';

export const FW = {
  /** 船拖假魚：拖速超過 liftV0（m/s）才開始被抬；每 1 m/s 最深只能到 1 − liftK×(v − liftV0)（重的假魚抬得少） */
  liftV0: 0.35, liftK: 0.3, liftTau: 0.5,
  /** 被拖起來最淺到這（0＝水面；假魚還在水面下） */
  liftFloor: 0.06,
  /** 拖速的平滑時間（秒）、拖速超過 wakeV 就在假魚／浮標後面冒水花 */
  dragTau: 0.5, wakeV: 0.9,
  /** 拉魚時船開走：捲線器洩力放出去的比例（其餘把魚拖過來）、每 1 m/s 每秒加多少張力 */
  slip: 0.35, tenK: 0.45,
  /** 線放到底（拉不出去了）時張力倍增 */
  spoolK: 3,
  /** 船開過去線鬆了：鬆超過 0.3 m 開始掉張力（鬆 3 m 以上每秒掉 slackTenK） */
  slackTenK: 0.6,
  /** 線鬆時魚往外游多快（m/s）＝fishV0 + fishVk × 力氣 */
  fishV0: 0.6, fishVk: 2.4,
  /** 魚到竿子這麼近（m）就算拉上來（船開過去、線還鬆時）；最短要拉 landTK × 原本拉扯時間（伺服器最短 0.4 倍） */
  landR: 1.2, landTK: 0.6,
};

/** 浮標／假魚在水裡：世界座標 (x, z)、上一幀錨點、線長（浮標用；假魚用 LureSt.dist）、平滑後的船拖速度 */
export type LineW = { on: boolean; x: number; z: number; ax: number; az: number; len: number; drag: number };
export const newLineW = (): LineW => ({ on: false, x: 0, z: 0, ax: 0, az: 0, len: 0, drag: 0 });

/** 落水那一刻：東西在 (x, z)、人在 (ax, az)、放出去 len 公尺的線（線不會比實際距離短） */
export function lineWStart(w: LineW, x: number, z: number, ax: number, az: number, len: number) {
  w.on = true; w.x = x; w.z = z; w.ax = ax; w.az = az; w.drag = 0;
  w.len = Math.max(len, Math.hypot(x - ax, z - az));
  return w;
}
/** 錨點到東西的真實水平距離 */
export const lineWDist = (w: { x: number; z: number }, ax: number, az: number) => Math.hypot(w.x - ax, w.z - az);
/** 錨點看過去的世界方向（h，跟拋竿方向同一套：前進＝(-sin h, -cos h)）；太近回 fallback */
export function lineWYaw(w: { x: number; z: number }, ax: number, az: number, fallback: number) {
  const dx = w.x - ax, dz = w.z - az;
  return dx * dx + dz * dz < 0.09 ? fallback : yawOf(dx, dz);
}
/** 收線／抽竿之前：鬆掉的線先捲起來（線長不比實際距離長）；回傳收完的線長 */
export const takeSlack = (len: number, w: { x: number; z: number }, ax: number, az: number) => Math.min(len, lineWDist(w, ax, az));

/**
 * 每幀線長約束：錨點移到 (ax, az)；距離 > len 就沿線被拖過去（夾在錨點往東西方向 len 的地方）。
 * reelM＝這幀收線收掉幾公尺（拖動扣掉這段，剩下的才算船拖的）。回傳這幀船拖的速度（m/s）；w.drag 是平滑後的。
 */
export function stepLineW(w: LineW, len: number, ax: number, az: number, dt: number, reelM = 0): number {
  w.ax = ax; w.az = az;
  if (len !== w.len) w.len = len;
  const dx = w.x - ax, dz = w.z - az, r = Math.hypot(dx, dz);
  let v = 0;
  if (r > len && r > 1e-6) {
    const k = Math.max(0, len) / r;
    const nx = ax + dx * k, nz = az + dz * k;
    const moved = Math.hypot(nx - w.x, nz - w.z);
    w.x = nx; w.z = nz;
    if (dt > 0) v = Math.max(0, moved - Math.max(0, reelM)) / dt;
  }
  if (dt > 0) w.drag += (v - w.drag) * (1 - Math.exp(-dt / FW.dragTau));
  return v;
}

/**
 * 船拖假魚的水阻（等魚中、不是拖釣模式）：拖得快＝最深只能到某個水層（越快越淺，重的假魚抬得少，最淺 liftFloor）、
 * （拖著走的速度另外傳給 stepLure 的 drag，算進假魚在游的速度）。波趴一直在水面、拖釣模式另外算，不動。
 */
export function dragLure(s: LureSt, item: LureKey, v: number, dt: number, troll = false) {
  if (troll || dt <= 0 || item === 'popper' || v <= FW.liftV0) return;
  const sink = LURE_PHYS[item]?.sink ?? 1;
  const cap = Math.max(FW.liftFloor, 1 - FW.liftK * (v - FW.liftV0) / Math.max(0.5, sink));
  if (s.depth > cap) s.depth = Math.max(cap, s.depth + (cap - s.depth) * (1 - Math.exp(-dt / FW.liftTau)));
}

// ---------------- 拉魚 ----------------
/** 上鉤的魚：世界座標、上一幀錨點、已經往左右衝了多少（公尺）、上一幀線長、中魚距離 */
export type FightW = { on: boolean; x: number; z: number; ax: number; az: number; lat: number; lastL: number; d0: number };
export const newFightW = (): FightW => ({ on: false, x: 0, z: 0, ax: 0, az: 0, lat: 0, lastL: 0, d0: 8 });
export function fightWStart(w: FightW, x: number, z: number, ax: number, az: number, d0: number) {
  w.on = true; w.x = x; w.z = z; w.ax = ax; w.az = az; w.lat = 0; w.d0 = d0; w.lastL = d0;
  return w;
}
/** 拉扯進度 ↔ 線長（fightDistM 的反函數） */
export const progOfDist = (m: number, d0: number) => 1 - m * (1 - FIGHT_P0) / Math.max(0.01, d0);
/** 這條魚原本拉多久（秒） */
export const fightSecs = (f: Fight) => (1 - FIGHT_P0) / Math.max(1e-6, f.rate);

/**
 * 拉魚每幀（stepFight 之後）：錨點移到 (ax, az)、side＝魚往左右衝的目標偏移（公尺，+＝面向魚時的右邊）。
 * 直接改 f.prog／f.ten 和魚的位置。回傳 'landed'＝魚已經到竿子邊（船開過去、線還鬆的時候）。
 */
export function stepFightW(w: FightW, f: Fight, ax: number, az: number, side: number, dt: number): 'landed' | null {
  if (dt <= 0) return null;
  const vx = (ax - w.ax) / dt, vz = (az - w.az) / dt;
  w.ax = ax; w.az = az;
  let dx = w.x - ax, dz = w.z - az, r = Math.hypot(dx, dz);
  if (r < 1e-4) { dx = 0; dz = -1e-4; r = 1e-4; }
  let ux = dx / r, uz = dz / r;
  // 往左右衝：沿著垂直線的方向游過去（衝回 0 就回到原來的方位）
  const dl = side - w.lat; w.lat = side;
  if (dl !== 0) {
    const x = w.x + -uz * dl, z = w.z + ux * dl;
    dx = x - ax; dz = z - az; const r2 = Math.hypot(dx, dz) || 1e-4;
    ux = dx / r2; uz = dz / r2; r = r2;
  }
  let L = fightDistM(f.prog, w.d0);
  // 船開離魚（沿線往外）的速度
  const va = Math.max(0, -(vx * ux + vz * uz));
  let rn: number;
  if (r > L) {
    // 線拉直：船開走＝捲線器洩一點線、其餘硬拖（張力上來）；收線＝把魚拉過來
    if (va > 0) {
      const p0 = f.prog;
      f.prog = Math.max(FIGHT_PROG_MIN, f.prog - FW.slip * va * dt * (1 - FIGHT_P0) / Math.max(0.01, w.d0));
      const spool = f.prog <= FIGHT_PROG_MIN && p0 <= FIGHT_PROG_MIN + 1e-9 ? FW.spoolK : 1;
      f.ten = Math.min(1, f.ten + FW.tenK * va * dt * (0.5 + f.power) * spool);
      L = fightDistM(f.prog, w.d0);
    }
    rn = L;
  } else {
    // 線鬆（船開過去）：魚不會被拉近，自己往外游把線拉直；魚自己拉線出去就跟著線走
    const grow = Math.max(0, L - w.lastL);
    rn = Math.min(L, r + Math.max((FW.fishV0 + FW.fishVk * f.power) * dt, grow));
    const slack = L - rn;
    if (slack > 0.3) f.ten = Math.max(0, f.ten - FW.slackTenK * Math.min(1, slack / 3) * dt);
  }
  w.lastL = L;
  w.x = ax + ux * rn; w.z = az + uz * rn;
  if (rn <= FW.landR && rn < L - 0.05 && f.t >= FW.landTK * fightSecs(f)) return 'landed';
  return null;
}
