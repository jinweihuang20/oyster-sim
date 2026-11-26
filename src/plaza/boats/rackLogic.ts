/**
 * 巡蚵棚收成：純邏輯（不碰 three／DOM），伺服器 PlazaWorld.Racks.cs 的客戶端鏡像。
 * 伺服器送 N＝在 T（伺服器毫秒）時的串數；之後每 growMs 長一串到 max，客戶端自己算現在幾串（不用每串都廣播）。
 */
/** t 在未來＝公共蚵棚冷卻中；a＝私人蚵棚開始算「放太久」的長滿時間（0＝照 n／t 推算） */
export type RackDto = { id: number; x: number; z: number; h: number; n: number; t: number; ok: string; owner: string; max: number; growMs: number; up: number[]; a: number };
export type RackSnap = {
  v: number; racks: RackDto[]; now: number; max: number; growMs: number; price: number; kgPer: number; finePerKg: number;
  cargoMax: number; ownMax: number; me: string; myCargo: number; myCargoVal: number; upCost: number[][];
  /** 私人蚵棚每串賣價、長滿多久後開始變老、多久降到最低、最低幾折（%）、生長速度 Lv1～5 長滿要多久 */
  privPrice: number; ageStartMs: number; ageSpanMs: number; ageFloor: number; upFullMs: number[];
  /** 今天第一次卸貨加碼（%）、今天還沒領 */
  sellBonusPct: number; sellBonusLeft: boolean;
};

export const RACK = {
  /** 船中心到蚵棚：按鈕出現的距離（伺服器 4.6 m，客戶端略嚴）、船速上限 */
  haulR: 3.5, haulMaxV: 2.4,
  /** 按住「拉蚵串」：每幾秒拉一串（伺服器每串至少隔 0.35 秒） */
  haulEvery: 0.45,
  /** 卸貨：船中心到碼頭 */
  sellR: 6,
  /** 放蚵棚：離岸／碼頭、離別的蚵棚（伺服器 10／9，客戶端略嚴） */
  placeLand: 10.5, placeApart: 9.5,
  /** 升級面板：船中心到自己的蚵棚 */
  upR: 4.5,
  /** 畫面：多遠內畫蚵棚、蚵串；熟了的燈多遠看得到（自動警示燈 Lv1～5，只有主人自己看得到加遠的） */
  viewR: 75, strR: 45, ripeR: [40, 70, 95, 120, 150] as readonly number[],
  /** 船撞到蚵棚架子：半徑 */
  hitR: 1.9,
  /** 船貨越重越慢：滿載剩 60% 速度 */
  loadSlow: 0.4,
  /** 雜貨店「蚵棚」組合包 */
  kitPrice: 15_000, kitId: 'rackKit',
};

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const g = (o: any, k: string) => o?.[k] ?? o?.[k[0].toUpperCase() + k.slice(1)];
export function parseUp(s: unknown): number[] {
  const t = String(s ?? '');
  return [0, 1, 2, 3, 4, 5].map(i => { const c = t.charCodeAt(i) - 48; return c >= 1 && c <= 5 ? c : 1; });
}
export function normRack(o: any): RackDto | null {
  const id = num(g(o, 'id'), -1); if (id < 0) return null;
  return {
    id, x: num(g(o, 'x')), z: num(g(o, 'z')), h: num(g(o, 'h')), n: num(g(o, 'n')), t: num(g(o, 't')),
    ok: String(g(o, 'ok') ?? ''), owner: String(g(o, 'owner') ?? ''), max: num(g(o, 'max'), 12), growMs: num(g(o, 'growMs'), 20_000), up: parseUp(g(o, 'up')), a: num(g(o, 'a')),
  };
}
export function normRackSnap(o: any): RackSnap | null {
  if (!o) return null;
  const uc = (g(o, 'upCost') ?? []) as unknown[];
  return {
    v: num(g(o, 'v')), racks: ((g(o, 'racks') ?? []) as any[]).map(normRack).filter((r): r is RackDto => !!r), now: num(g(o, 'now')),
    max: num(g(o, 'max'), 12), growMs: num(g(o, 'growMs'), 20_000), price: num(g(o, 'price'), 250), kgPer: num(g(o, 'kgPer'), 3), finePerKg: num(g(o, 'finePerKg'), 250),
    cargoMax: num(g(o, 'cargoMax'), 24), ownMax: num(g(o, 'ownMax'), 4), me: String(g(o, 'me') ?? ''), myCargo: num(g(o, 'myCargo')), myCargoVal: num(g(o, 'myCargoVal')),
    upCost: Array.isArray(uc) ? uc.map(r => (Array.isArray(r) ? r.map(x => num(x)) : [])) : [],
    privPrice: num(g(o, 'privPrice'), 160), ageStartMs: num(g(o, 'ageStartMs'), 2 * 3600_000), ageSpanMs: num(g(o, 'ageSpanMs'), 2 * 3600_000), ageFloor: num(g(o, 'ageFloor'), 50),
    upFullMs: Array.isArray(g(o, 'upFullMs')) ? (g(o, 'upFullMs') as unknown[]).map(x => num(x)) : [...UP_FULL_MIN.map(m => m * 60_000)],
    sellBonusPct: num(g(o, 'sellBonusPct'), 0), sellBonusLeft: !!g(o, 'sellBonusLeft'),
  };
}

/** 現在幾串（serverNow＝本機換算的伺服器時間） */
export function rackNow(r: RackDto, serverNow: number) {
  return Math.min(r.max, r.n + Math.floor(Math.max(0, serverNow - r.t) / Math.max(1, r.growMs)));
}
export const rackRipe = (r: RackDto, serverNow: number) => rackNow(r, serverNow) >= r.max;
/** 下一串還要幾秒（長滿＝0；公共蚵棚冷卻中＝冷卻剩下＋一串） */
export function rackNextSec(r: RackDto, serverNow: number) {
  if (rackRipe(r, serverNow)) return 0;
  if (r.t > serverNow) return Math.ceil((r.t - serverNow + r.growMs) / 1000);
  const el = Math.max(0, serverNow - r.t) % Math.max(1, r.growMs);
  return Math.ceil((r.growMs - el) / 1000);
}
/** 公共蚵棚剛被拉過、還在冷卻（不會長） */
export const rackCooling = (r: RackDto, serverNow: number) => !isPrivate(r) && r.t > serverNow;
/** 秒數 → 「2 分 05 秒」／「45 秒」 */
export function fmtWait(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return s >= 60 ? `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, '0')} 秒` : `${s} 秒`;
}
/** 私人蚵棚長滿的時間（還沒滿＝0；跟伺服器 RackFullAt 一樣） */
export function rackFullAt(r: RackDto, serverNow: number) {
  if (r.a > 0) return r.a;
  if (r.n >= r.max) return r.t;
  const at = r.t + (r.max - r.n) * r.growMs;
  return at <= serverNow ? at : 0;
}
/** 私人蚵棚放太久的賣價（%）：長滿後 ageStart 內 100，之後 ageSpan 線性降到 floor（伺服器 RackAgePct） */
export function rackAgePct(r: RackDto, serverNow: number, c: { ageStartMs: number; ageSpanMs: number; ageFloor: number }) {
  if (!isPrivate(r)) return 100;
  const fa = rackFullAt(r, serverNow); if (fa <= 0) return 100;
  const over = serverNow - fa - c.ageStartMs; if (over <= 0) return 100;
  return Math.round(100 - (100 - c.ageFloor) * Math.min(1, over / Math.max(1, c.ageSpanMs)));
}
export const isPrivate = (r: RackDto) => r.ok.length > 0;
export const isMine = (r: RackDto, me: string) => !!me && r.ok === me;
/** 船貨越多越慢（回傳速度倍率） */
export const loadSlow = (cargo: number, cargoMax: number) => 1 - RACK.loadSlow * Math.min(1, Math.max(0, cargo) / Math.max(1, cargoMax));
/** 熟了的燈要多近才畫：自己的蚵棚看警示燈等級，別人的一律 Lv1 */
export const ripeViewR = (r: RackDto, me: string) => RACK.ripeR[(isMine(r, me) ? r.up[5] : 1) - 1] ?? RACK.ripeR[0];

export function nearestRack(x: number, z: number, list: readonly RackDto[], pred?: (r: RackDto) => boolean) {
  let best: RackDto | null = null, bd = Infinity;
  for (const r of list) { if (pred && !pred(r)) continue; const d = Math.hypot(r.x - x, r.z - z); if (d < bd) { bd = d; best = r; } }
  return best ? { rack: best, dist: bd } : null;
}

/** 偷拉一串的罰款（防盜等級） */
export const FINE_PCT = [100, 130, 160, 200, 250] as const;
export const stealFine = (r: RackDto, kgPer: number, finePerKg: number) => Math.round(kgPer * finePerKg * FINE_PCT[r.up[3] - 1] / 100);

/** 私人蚵棚：生長速度 Lv1～5 整座長滿要幾分鐘（伺服器 RackUpFull） */
export const UP_FULL_MIN = [30, 27, 24, 21, 19] as const;
/** 升級六條線：名稱、說明、Lv1～5 的效果文字（數值要跟伺服器一樣） */
export const UP_LINES = [
  { key: 'size', n: '棚架大小', fx: (lv: number) => `最多 ${[12, 15, 18, 21, 24][lv - 1]} 串` },
  { key: 'grow', n: '生長速度', fx: (lv: number) => `${UP_FULL_MIN[lv - 1]} 分鐘長滿` },
  { key: 'seed', n: '蚵苗品質', fx: (lv: number) => (lv <= 1 ? '一般賣價' : `賣價 +${[0, 10, 20, 32, 45][lv - 1]}%`) },
  { key: 'lock', n: '防盜', fx: (lv: number) => `罰款 ×${[1, 1.3, 1.6, 2, 2.5][lv - 1]}・偷拉變慢${lv >= 3 ? '・有人想偷先通知你' : ''}` },
  { key: 'wave', n: '抗浪', fx: (lv: number) => (lv <= 1 ? '落水掉一般量的船貨' : `落水少掉 ${[0, 20, 38, 54, 70][lv - 1]}% 船貨`) },
  { key: 'lamp', n: '自動警示燈', fx: (lv: number) => `長滿時 ${[40, 70, 95, 120, 150][lv - 1]} m 外看得到（只有你）` },
] as const;
export const UP_MAX = 5;
/** 升到下一級要多少錢（伺服器給的價目表；沒有＝null） */
export function upCost(upCost: number[][], line: number, lv: number): number | null {
  if (lv >= UP_MAX) return null;
  const c = upCost[line]?.[lv - 1];
  return Number.isFinite(c) && c! > 0 ? c! : null;
}

/**
 * 連按升級：還在等伺服器回覆的那幾下也算進去（等級往上疊、錢先預扣），判斷這一下能不能再排進去。
 * up＝伺服器確認的等級、pending＝這一項還在排隊的次數、pendingCost＝所有排隊中要花的錢。
 */
export function planUpTap(up: readonly number[], pending: number, line: number, money: number, pendingCost: number, costs: number[][]):
  { ok: true; cost: number; lv: number } | { ok: false; err: 'max' | 'money' | 'none' } {
  const lv = (up[line] ?? 1) + Math.max(0, pending);
  if (lv >= UP_MAX) return { ok: false, err: 'max' };
  const c = upCost(costs, line, lv);
  if (c == null) return { ok: false, err: 'none' };
  if (money - pendingCost < c) return { ok: false, err: 'money' };
  return { ok: true, cost: c, lv };
}

/** 蚵棚架子的佔地（半長／半寬，跟 boatScene RACK_GEO 一樣） */
export const RACK_HALF = { len: 2.6, wid: 1.2 };
/** 一次最多推多少（m）：慢慢推出去，不會一下彈飛 */
export const RACK_PUSH_STEP = 0.2;
/**
 * 船撞到蚵棚架子：把船身兩個圓推出架子的矩形外；回 true＝有撞到。
 * - 船身壓在架子裡（例如剛放好的蚵棚、舊資料）：兩個圓都往「船中心那一側」推，方向一致，不會左右拉扯卡住
 * - 每次最多推 RACK_PUSH_STEP，慢慢滑出去
 * - 只有往架子裡開才減速；往外開不減速 → 絕對不會被釘住
 */
export function pushFromRack(b: { x: number; z: number; h: number; v: number }, r: { x: number; z: number; h: number }, pts: readonly (readonly [number, number])[], hullR: number) {
  const c = Math.cos(r.h), s = Math.sin(r.h);
  const L = RACK_HALF.len, Wd = RACK_HALF.wid;
  // 船中心在架子本地座標：決定「壓在裡面」時往哪邊推
  const cdx = b.x - r.x, cdz = b.z - r.z;
  const cl = c * cdx - s * cdz, cw = s * cdx + c * cdz;
  let hit = false, pushX = 0, pushZ = 0;
  for (const [px, pz] of pts) {
    const dx = px - r.x, dz = pz - r.z;
    const lx = c * dx - s * dz, lz = s * dx + c * dz;
    const qx = Math.max(-L, Math.min(L, lx)), qz = Math.max(-Wd, Math.min(Wd, lz));
    const ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
    if (d >= hullR) continue;
    let ux: number, uz: number, pen: number;
    if (d < 1e-4) {
      // 圓心在架子裡：沿船中心那一側推（架子細長，通常往側邊最快出去）
      if (Math.abs(cl) > L) { ux = Math.sign(cl) || 1; uz = 0; pen = L - ux * lx + hullR; }
      else { uz = Math.sign(cw) || 1; ux = 0; pen = Wd - uz * lz + hullR; }
    } else { ux = ox / d; uz = oz / d; pen = hullR - d; }
    // 本地 → 世界；兩個圓取推最多的那個方向量（不疊加，免得推太猛）
    const wx = (c * ux + s * uz) * pen, wz = (-s * ux + c * uz) * pen;
    if (Math.hypot(wx, wz) > Math.hypot(pushX, pushZ)) { pushX = wx; pushZ = wz; }
    hit = true;
  }
  if (!hit) return false;
  const m = Math.hypot(pushX, pushZ), k = m > RACK_PUSH_STEP ? RACK_PUSH_STEP / m : 1;
  b.x += pushX * k; b.z += pushZ * k;
  // 往架子裡開（速度跟推出方向相反）才減速
  const vx = -Math.sin(b.h) * b.v, vz = -Math.cos(b.h) * b.v;
  if (m > 1e-6 && (vx * pushX + vz * pushZ) / m < -0.05) b.v *= 0.6;
  return true;
}
