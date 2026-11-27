/**
 * 中魚到拉出水面（純數學、不碰 three、不配置）：
 * - 拉扯中：真的魚種模型就在線頭的水裡（伺服器中魚時就回了魚種）。離得遠＝沉在水面下，越拉越近越浮上來，
 *   最後幾公尺會一下一下破水翻騰；魚頭朝人（被線拉著嘴），魚往左右衝時身體跟著甩向那邊，尾巴一直擺。
 * - 拉上來：魚從「最後線頭那個水面點」破水出現，沿一條弧線（先往上竄、再收到竿尖下）被吊到竿尖下面，
 *   身體從橫躺慢慢轉成頭朝上掛著，邊吊邊甩尾；線一直接在竿尖→魚嘴。之後才是原本的掛在竿尖晃。
 * 座標：魚模型頭朝 +x、總長 1（mesh.scale＝魚長）；這裡都回「魚嘴」位置，魚身中心＝嘴 − 頭方向 × 魚長／2。
 */
export type V3 = { x: number; y: number; z: number };

/** 從水面吊到竿尖下面要多久（秒） */
export const HOIST_S = 0.6;
/** 吊上來之後掛在竿尖晃多久（秒；跟原本一樣） */
export const HOIST_HANG_S = 1.8;
/** 魚嘴掛在竿尖下面多少（m；跟原本掛魚位置一樣） */
export const HOIST_TIP_DROP = 0.25;
/** 吊到這個進度才跳釣到魚的卡片／聲音（先讓人看到魚破水被拉起來） */
export const HOIST_CARD_U = 0.75;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
const ss = (a: number, b: number, v: number) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

/** 魚長（m）：約 0.45 m × kg^(1/3)（1 kg≈45 cm、100 kg≈2 m） */
export function fishLenM(kg: number) { return clamp(0.45 * Math.cbrt(Math.max(0.05, fin(kg, 0.5))), 0.22, 2.2); }

/** 拉扯中魚離水面多近：0＝遠（沉在水下）、1＝拉到身邊（浮在水面翻騰） */
export function fightCloseK(dist: number) { return 1 - clamp((fin(dist, 10) - 2) / 10, 0, 1); }
/**
 * 拉扯中魚嘴在水面下多深（m，正的＝在水面下；負的＝破水跳出水面）。
 * 遠＝0.45 m 深（只看得到影子／水花），近＝貼著水面，最後幾公尺一下一下破水（張力越大跳越高）。
 */
export function fightFishDepth(dist: number, ten: number, t: number) {
  const k = fightCloseK(dist);
  const base = 0.06 + 0.4 * (1 - k);
  const s = Math.max(0, Math.sin(fin(t) * 2.6));
  const breach = k * k * s * s * s * (0.1 + 0.16 * clamp(fin(ten), 0, 1));
  return base - breach;
}
/** 拉扯中魚頭朝向（yaw，three 的 rotation.y：頭 +x 轉到 (cos, -sin)）：朝人＋往衝的那邊甩＋尾巴擺 */
export function fightFishYaw(toX: number, toZ: number, run: number, t: number, power: number) {
  const base = Math.atan2(-fin(toZ), fin(toX, 1));
  return base + clamp(fin(run), -1, 1) * 0.85 + Math.sin(fin(t) * (9 + 5 * clamp(fin(power), 0, 1))) * 0.32;
}

/** 吊魚狀態：on＝正在吊；t＝已經吊多久；w＝破水那個水面點；yaw＝破水那一刻魚頭朝向 */
export type Hoist = { on: boolean; t: number; dur: number; wx: number; wy: number; wz: number; yaw: number };
export const newHoist = (): Hoist => ({ on: false, t: 0, dur: HOIST_S, wx: 0, wy: 0, wz: 0, yaw: 0 });
export function startHoist(h: Hoist, wx: number, wy: number, wz: number, yaw: number, dur = HOIST_S) {
  h.on = true; h.t = 0; h.dur = Math.max(0.05, fin(dur, HOIST_S));
  h.wx = fin(wx); h.wy = fin(wy); h.wz = fin(wz); h.yaw = fin(yaw);
  return h;
}
/** 魚跑掉／收竿／吊完：清掉 */
export function stopHoist(h: Hoist) { h.on = false; h.t = 0; return h; }
/** 走一步，回傳進度 0～1（沒在吊＝1） */
export function stepHoist(h: Hoist, dt: number) {
  if (!h.on) return 1;
  h.t += Math.max(0, fin(dt));
  return hoistU(h);
}
export const hoistU = (h: Hoist) => (h.on ? clamp(h.t / h.dur, 0, 1) : 1);
export const hoistDone = (h: Hoist) => !h.on || h.t >= h.dur;

/**
 * 吊魚中魚嘴位置：u＝0 在破水點水面 (wx, wy, wz)、u＝1 在竿尖下 HOIST_TIP_DROP 的掛魚點。
 * 垂直先快（一下竄出水面）、水平後跟（smoothstep），所以是一道往上鼓的弧，不會穿進水裡。
 */
export function hoistMouth(wx: number, wy: number, wz: number, tx: number, ty: number, tz: number, u: number, out: V3) {
  u = Number.isNaN(u) ? 0 : clamp(u, 0, 1);
  wx = fin(wx); wy = fin(wy); wz = fin(wz); tx = fin(tx, wx); ty = fin(ty, wy); tz = fin(tz, wz);
  const hy = ty - HOIST_TIP_DROP;
  const sy = 1 - (1 - u) * (1 - u);
  const sh = u * u * (3 - 2 * u);
  out.x = wx + (tx - wx) * sh;
  out.y = wy + (hy - wy) * sy;
  out.z = wz + (tz - wz) * sh;
  if (u >= 1) { out.x = tx; out.y = hy; out.z = tz; }
  return out;
}
/** 吊魚中身體仰角（rotation.z）：橫躺 0 → 頭朝上 π/2，再加甩尾（越吊越小，最後接上掛著晃的 0.12） */
export function hoistPitch(u: number, t: number) {
  u = clamp(fin(u), 0, 1);
  const amp = 0.12 + 0.36 * (1 - u);
  return (Math.PI / 2) * ss(0, 0.6, u) + Math.sin(fin(t) * 15) * amp;
}
/** 吊魚中魚頭左右甩（rotation.y）：從破水朝向出發，慢慢轉 */
export function hoistYaw(yaw0: number, u: number, t: number) {
  u = clamp(fin(u), 0, 1);
  return fin(yaw0) + u * 0.9 + Math.sin(fin(t) * 11) * 0.25 * (1 - u);
}
/** 頭方向（three Euler XYZ、rx＝0：先轉 z 再轉 y） */
export function fishHeadDir(yaw: number, pitch: number, out: V3) {
  const cp = Math.cos(pitch);
  out.x = cp * Math.cos(yaw); out.y = Math.sin(pitch); out.z = -cp * Math.sin(yaw);
  return out;
}
/** 魚身中心＝嘴 − 頭方向 × 魚長／2（直接改 out） */
export function fishCenterFromMouth(mouth: V3, yaw: number, pitch: number, len: number, out: V3) {
  fishHeadDir(yaw, pitch, out);
  const h = Math.max(0, fin(len)) * 0.5;
  out.x = mouth.x - out.x * h; out.y = mouth.y - out.y * h; out.z = mouth.z - out.z * h;
  return out;
}
