/**
 * 釣魚精彩回放（純數值，可測試；不碰 Three.js）：
 * - 錄影＝環形緩衝：中魚後每秒記 ~25 次（人、竿、魚、線、水花），只留最後 10 秒；預先配置一塊 Float32Array，每幀不配置。
 * - 片段＝釣上來那一刻再收尾 ~1.5 秒（吊出水面、掛在竿尖晃）後拷貝一份（新的一竿會取代上一份）。
 * - 播放＝在任意時間內插（線性；角度走最短路徑；狀態取前一格）；支援 0.5× 慢動作、拖拉時間軸。
 * - 自由視角＝球座標軌道鏡頭（方位 360°、仰角／距離夾住，鏡頭不會跑到水面或地面以下，也不會 NaN）。
 */

/** 每一格的欄位（Float32Array 內的位移） */
export const RF = {
  t: 0,
  /** 人（世界座標、朝向） */
  px: 1, py: 2, pz: 3, pyaw: 4,
  /** 在船上（1／0）＋船的位置朝向 */
  boat: 5, bx: 6, bz: 7, bh: 8,
  /** 竿尖（世界） */
  rx: 9, ry: 10, rz: 11,
  /** 釣竿姿勢（fishPose 的數值） */
  pitch: 12, side: 13, hx: 14, hy: 15, hz: 16, lean: 17, bend: 18, crank: 19, brace: 20, steer: 21, steerK: 22,
  /** 姿勢階段代碼（RP_PHASE）、捲線中、路亞竿 */
  phase: 23, reel: 24, lure: 25,
  /** 魚：中心位置、yaw／pitch／roll、甩尾相位、看得到、狀態（RFISH） */
  fx: 26, fy: 27, fz: 28, fyaw: 29, fpitch: 30, froll: 31, tail: 32, fvis: 33, fst: 34,
  /** 線頭（世界）、張力、下垂量 */
  lx: 35, ly: 36, lz: 37, ten: 38, sag: 39,
  /** 這一格有水花（0＝沒有；>0＝大小） */
  splash: 40,
  /** 魚影透明度 */
  shadow: 41,
  /** 水花的位置（世界 x／z） */
  sx: 42, sz: 43,
} as const;
export const RF_STRIDE = 44;
/** 錄影長度（秒）、取樣頻率、收尾（釣上來後再錄多久） */
export const REPLAY_WIN = 10;
export const REPLAY_HZ = 25;
export const REPLAY_TAIL_S = 2.1;
/** 姿勢階段代碼 */
export const RP_PHASE = ['hold', 'wait', 'fight', 'show'] as const;
export type RpPhase = (typeof RP_PHASE)[number];
export const rpPhaseCode = (p: string) => Math.max(0, (RP_PHASE as readonly string[]).indexOf(p));
/** 魚狀態：0 沒有、1 水裡拉扯、2 吊起來、3 掛在竿尖 */
export const RFISH = { none: 0, water: 1, hoist: 2, hang: 3 } as const;

/** 角度欄位（內插走最短路徑） */
const ANG = new Set<number>([RF.pyaw, RF.bh, RF.fyaw, RF.fpitch, RF.froll, RF.crank]);
/** 狀態欄位（不內插，取前一格） */
const STEP = new Set<number>([RF.boat, RF.phase, RF.reel, RF.lure, RF.fvis, RF.fst, RF.splash, RF.sx, RF.sz]);
const KIND = new Uint8Array(RF_STRIDE).map((_, i) => (ANG.has(i) ? 1 : STEP.has(i) ? 2 : 0));

const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
export function lerpAngle(a: number, b: number, u: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return a + d * u;
}

export type ReplayMeta = { sp: string; name: string; kg: number; tier: number; player: string };

// ---------------- 錄影（環形緩衝） ----------------
export type ReplayRec = {
  buf: Float32Array;
  cap: number;
  /** 最舊那格的位置、目前幾格 */
  head: number; n: number;
  /** 錄影中、經過時間、下一次取樣倒數、還沒寫進去的水花 */
  on: boolean; t: number; acc: number; pendSplash: number; pendX: number; pendZ: number;
  win: number; hz: number;
};
export function newReplayRec(win = REPLAY_WIN, hz = REPLAY_HZ): ReplayRec {
  // 多留幾格：取樣抖動時還是能保住完整 10 秒
  const cap = Math.ceil(win * hz) + 8;
  return { buf: new Float32Array(cap * RF_STRIDE), cap, head: 0, n: 0, on: false, t: 0, acc: 0, pendSplash: 0, pendX: 0, pendZ: 0, win, hz };
}
/** 開始錄（清掉舊的；不重新配置） */
export function recStart(r: ReplayRec) { r.head = 0; r.n = 0; r.on = true; r.t = 0; r.acc = 0; r.pendSplash = 0; return r; }
export function recStop(r: ReplayRec) { r.on = false; return r; }
export function recReset(r: ReplayRec) { r.head = 0; r.n = 0; r.on = false; r.t = 0; r.acc = 0; r.pendSplash = 0; return r; }
/** 記一個水花（下一格寫進去；同一格多個取最大） */
export function recSplash(r: ReplayRec, k: number, x = 0, z = 0) {
  if (!r.on || !(fin(k) > r.pendSplash)) return;
  r.pendSplash = fin(k); r.pendX = fin(x); r.pendZ = fin(z);
}
/** 每幀：時間往前；回 true＝這幀該取樣（第一幀一定取） */
export function recTick(r: ReplayRec, dt: number): boolean {
  if (!r.on) return false;
  dt = clamp(fin(dt), 0, 0.25);
  r.t += dt;
  r.acc -= dt;
  if (r.n === 0 || r.acc <= 0) { r.acc += 1 / r.hz; if (r.acc < 0) r.acc = 0; return true; }
  return false;
}
/** 拿下一格要寫的位置（寫完不用再呼叫別的；會順便丟掉 10 秒以前的格） */
export function recPush(r: ReplayRec, fill: (buf: Float32Array, o: number) => void) {
  let idx: number;
  if (r.n < r.cap) { idx = (r.head + r.n) % r.cap; r.n++; }
  else { idx = r.head; r.head = (r.head + 1) % r.cap; }
  const o = idx * RF_STRIDE;
  fill(r.buf, o);
  r.buf[o + RF.t] = r.t;
  r.buf[o + RF.splash] = r.pendSplash; r.buf[o + RF.sx] = r.pendX; r.buf[o + RF.sz] = r.pendZ; r.pendSplash = 0;
  // 只留最後 win 秒（最舊那格剛好 ≥ 最新－win）
  while (r.n > 1 && r.buf[r.head * RF_STRIDE + RF.t] < r.t - r.win - 1e-4) { r.head = (r.head + 1) % r.cap; r.n--; }
  return o;
}
/** 錄到的時間範圍 */
export function recSpan(r: ReplayRec) {
  if (r.n === 0) return { t0: 0, t1: 0 };
  return { t0: r.buf[r.head * RF_STRIDE + RF.t], t1: r.buf[((r.head + r.n - 1) % r.cap) * RF_STRIDE + RF.t] };
}

// ---------------- 片段 ----------------
export type ReplayClip = { f: Float32Array; n: number; dur: number; meta: ReplayMeta };
/** 拷貝成一段連續的片段（時間從 0 開始）；少於 2 格＝null */
export function recClip(r: ReplayRec, meta: ReplayMeta): ReplayClip | null {
  if (r.n < 2) return null;
  const f = new Float32Array(r.n * RF_STRIDE);
  for (let i = 0; i < r.n; i++) {
    const s = ((r.head + i) % r.cap) * RF_STRIDE;
    f.set(r.buf.subarray(s, s + RF_STRIDE), i * RF_STRIDE);
  }
  const t0 = f[RF.t];
  for (let i = 0; i < r.n; i++) f[i * RF_STRIDE + RF.t] -= t0;
  return { f, n: r.n, dur: f[(r.n - 1) * RF_STRIDE + RF.t], meta: { ...meta } };
}
/** 片段裡第一個 t ≥ 時間的格（二分） */
function seekIdx(c: ReplayClip, t: number) {
  let lo = 0, hi = c.n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c.f[m * RF_STRIDE] < t) lo = m + 1; else hi = m; }
  return lo;
}
/** 任意時間的一格（內插）寫進 out（長度 ≥ RF_STRIDE）；時間會夾在 0～dur */
export function clipSample(c: ReplayClip, t: number, out: Float32Array) {
  t = clamp(fin(t), 0, c.dur);
  const b = seekIdx(c, t), a = Math.max(0, b - 1);
  const oa = a * RF_STRIDE, ob = b * RF_STRIDE;
  const ta = c.f[oa], tb = c.f[ob];
  const u = tb > ta ? clamp((t - ta) / (tb - ta), 0, 1) : 1;
  for (let i = 0; i < RF_STRIDE; i++) {
    const va = c.f[oa + i], vb = c.f[ob + i], k = KIND[i];
    out[i] = k === 1 ? lerpAngle(va, vb, u) : k === 2 ? (u >= 1 ? vb : va) : va + (vb - va) * u;
  }
  out[RF.t] = t;
  // 水花只在播放經過那一格時觸發（clipSplashes），內插的這格不帶
  out[RF.splash] = 0;
  return out;
}
/** 播放從 t0 走到 t1（t0 < t ≤ t1）經過的水花格：回呼格的位移 */
export function clipSplashes(c: ReplayClip, t0: number, t1: number, cb: (o: number, k: number) => void) {
  if (!(t1 > t0)) return 0;
  let n = 0;
  for (let i = seekIdx(c, t0); i < c.n; i++) {
    const o = i * RF_STRIDE, t = c.f[o];
    if (t > t1) break;
    if (t > t0 && c.f[o + RF.splash] > 0) { cb(o, c.f[o + RF.splash]); n++; }
  }
  return n;
}

// ---------------- 播放 ----------------
export type ReplayPlay = { t: number; dur: number; speed: 1 | 0.5; playing: boolean };
export const newReplayPlay = (dur: number): ReplayPlay => ({ t: 0, dur: Math.max(0, fin(dur)), speed: 1, playing: true });
/** 往前走；到尾巴就停在最後（暫停）；回走過的時間 */
export function playStep(p: ReplayPlay, dt: number) {
  if (!p.playing) return 0;
  const t0 = p.t;
  p.t = Math.min(p.dur, p.t + clamp(fin(dt), 0, 0.25) * p.speed);
  if (p.t >= p.dur) p.playing = false;
  return p.t - t0;
}
export function playSeek(p: ReplayPlay, t: number) { p.t = clamp(fin(t, p.t), 0, p.dur); return p.t; }
export function playToggle(p: ReplayPlay) { if (!p.playing && p.t >= p.dur) p.t = 0; p.playing = !p.playing; return p.playing; }
export function playRestart(p: ReplayPlay) { p.t = 0; p.playing = true; return p; }
export function playSpeed(p: ReplayPlay) { p.speed = p.speed === 1 ? 0.5 : 1; return p.speed; }
export const fmtReplayT = (t: number) => `${Math.max(0, fin(t)).toFixed(1)}s`;

// ---------------- 自由視角（軌道鏡頭） ----------------
export type Orbit = { az: number; el: number; r: number };
/** r＝縮放（6＝1×；越大越遠）；實際距離看人和魚隔多遠自動拉（orbitDist） */
export const ORBIT = { elMin: 0.04, elMax: 1.35, rMin: 2.4, rMax: 20, r0: 6, dMin: 1.8, dMax: 30, dragK: 0.008, minAbove: 0.5 };
/** 開場：側面偏後四分之三（看得到人拉竿、也看得到魚破水被吊起） */
export function orbitStart(faceYaw: number): Orbit {
  return orbitClamp({ az: fin(faceYaw) + Math.PI * 0.42, el: 0.3, r: ORBIT.r0 });
}
/** 鏡頭離焦點多遠：人和魚隔 sep 公尺時剛好都框得進來（魚吊到竿尖＝拉近看清楚），再乘上縮放 */
export function orbitDist(o: Orbit, sep: number) {
  const auto = clamp(3.2 + 0.62 * Math.max(0, fin(sep, 4)), 3.4, 18);
  return clamp(auto * (fin(o.r, ORBIT.r0) / ORBIT.r0), ORBIT.dMin, ORBIT.dMax);
}
export function orbitClamp(o: Orbit): Orbit {
  o.az = Number.isFinite(o.az) ? ((o.az % TAU) + TAU) % TAU : 0;
  o.el = clamp(fin(o.el, 0.3), ORBIT.elMin, ORBIT.elMax);
  o.r = clamp(fin(o.r, 8), ORBIT.rMin, ORBIT.rMax);
  return o;
}
/** 拖曳：左右＝方位（繞 360°）、上下＝仰角 */
export function orbitDrag(o: Orbit, dx: number, dy: number) { o.az -= fin(dx) * ORBIT.dragK; o.el += fin(dy) * ORBIT.dragK; return orbitClamp(o); }
/** 縮放：k＞1 拉遠、k＜1 拉近 */
export function orbitZoom(o: Orbit, k: number) { o.r *= clamp(fin(k, 1), 0.2, 5); return orbitClamp(o); }
/**
 * 鏡頭位置＝焦點＋球座標位移；高度不低於 floorY＋minAbove（水面／地面），不夠就把仰角抬起來（不會鑽到水裡）。
 * 回寫的 out 一定是有限數字。
 */
export function orbitPos(o: Orbit, fx: number, fy: number, fz: number, floorY: number, out: { x: number; y: number; z: number }, dist = o.r) {
  orbitClamp(o);
  fx = fin(fx); fy = fin(fy); fz = fin(fz); floorY = fin(floorY, -1e9);
  const r = clamp(fin(dist, o.r), ORBIT.dMin, ORBIT.dMax);
  const minY = floorY + ORBIT.minAbove;
  let el = o.el;
  if (fy + Math.sin(el) * r < minY) {
    const s = clamp((minY - fy) / r, -1, 1);
    el = clamp(Math.asin(s), ORBIT.elMin, ORBIT.elMax);
  }
  const h = Math.cos(el) * r;
  out.x = fx + Math.sin(o.az) * h;
  out.z = fz + Math.cos(o.az) * h;
  out.y = Math.max(minY, fy + Math.sin(el) * r);
  return out;
}
