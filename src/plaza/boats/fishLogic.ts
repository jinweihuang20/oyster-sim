/**
 * 廣場海面釣魚（垂釣／路亞）：純邏輯（不碰 three／DOM，方便測試）。
 * 判定（能不能拋、有沒有魚咬、中魚、魚種重量、賣魚）在伺服器 StatsServer/Plaza/PlazaWorld.Fish.cs；
 * 這裡是客戶端的手感：拋竿力道、等魚／收線狀態機、路亞節奏、拉扯張力。數字集中在 FISH，跟伺服器 Fish* 常數對齊。
 */

import { PLAZA_WALK_SPD } from '../../world/walkSpeed';
import { PB } from './boatLogic';

export type Gear = 'float' | 'lure';
export type BaitKey = 'oyster' | 'shrimp' | 'worm' | 'squid';
export type LureKey = 'minnow' | 'jig' | 'soft' | 'popper' | 'stickbait' | 'trollskirt' | 'slowjig' | 'egi' | 'vib' | 'tairubber' | 'deepcrank' | 'squidjig';
export type ItemKey = BaitKey | LureKey;

export const FISH = {
  /** 釣竿（雜貨店一次買斷）；id＝存檔 meds 的 key */
  rods: {
    float: { id: 'fishRodFloat', n: '垂釣竿', price: 3_000 },
    lure: { id: 'fishRodLure', n: '路亞竿', price: 12_000 },
  } as Record<Gear, { id: string; n: string; price: number }>,
  /** 垂釣的餌（消耗品）：pack＝一包幾個；蚵仔肉免費，每天可以帶 oysterPerDay 塊出海 */
  baits: [
    { k: 'oyster', n: '蚵仔肉', id: '', price: 0, pack: 0 },
    { k: 'shrimp', n: '蝦仔餌', id: 'fishBaitShrimp', price: 50, pack: 10 },
    { k: 'worm', n: '沙蟲', id: 'fishBaitWorm', price: 120, pack: 5 },
    { k: 'squid', n: '魷魚條', id: 'fishBaitSquid', price: 200, pack: 5 },
  ] as readonly { k: BaitKey; n: string; id: string; price: number; pack: number }[],
  /** 路亞假魚（重複用；斷線就沒了） */
  lures: [
    { k: 'minnow', n: '米諾', id: 'fishLureMinnow', price: 1_500 },
    { k: 'jig', n: '鐵板', id: 'fishLureJig', price: 2_500 },
    { k: 'soft', n: '軟蟲', id: 'fishLureSoft', price: 800 },
    { k: 'popper', n: '波趴', id: 'fishLurePopper', price: 2_000 },
    // 進階大物路亞
    { k: 'stickbait', n: '大鉛筆餌', id: 'fishLureStickbait', price: 4_000 },
    { k: 'trollskirt', n: '船拖裙尾假餌', id: 'fishLureTrollSkirt', price: 5_500 },
    { k: 'slowjig', n: '慢搖鐵板', id: 'fishLureSlowJig', price: 4_800 },
    { k: 'egi', n: '大號木蝦', id: 'fishLureEgi', price: 3_200 },
    // 2026-11 新假餌
    { k: 'vib', n: '顫泳餌', id: 'fishLureVib', price: 2_600 },
    { k: 'tairubber', n: '鯛魚頭', id: 'fishLureTaiRubber', price: 3_600 },
    { k: 'deepcrank', n: '深潛胖胖餌', id: 'fishLureDeepCrank', price: 2_400 },
    { k: 'squidjig', n: '小透抽軟餌', id: 'fishLureSquidJig', price: 3_400 },
  ] as readonly { k: LureKey; n: string; id: string; price: number }[],
  oysterPerDay: 20,
  /** 拋竿：最近／最遠（公尺，伺服器同值）、力道條來回一次幾秒、拋出去飛幾秒 */
  castMin: 4, castMax: 24, chargePeriod: 1.6, flyS: 0.55,
  /**
   * 路亞竿：照真實岸拋距離約 1／3 縮小（伺服器 FishLureCastMax 同值）。
   * 真實 8～9 呎岸拋竿：鐵板 50～80 m、波趴 30～60 m、米諾 30～50 m、軟蟲 25～45 m。
   * 2026-11 全部拉長約 1.5 倍（垂釣竿 16→24、浮標拖太遠 22→32）。
   */
  lureCastMin: 5, lureCast: { minnow: 26, soft: 22, popper: 30, jig: 40, stickbait: 34, trollskirt: 28, slowjig: 42, egi: 24, vib: 32, tairubber: 30, deepcrank: 28, squidjig: 26 } as Record<LureKey, number>,
  /** 伺服器：每 2 秒擲一次咬餌、收竿時間窗 0.8 秒 */
  rollS: 2, windowS: 0.8,
  /** 駕駛船速超過就自動收線；拖釣船速範圍（乘客、米諾／鐵板／船拖裙尾假餌／大鉛筆餌） */
  driverMaxV: 0.55, trollMinV: 0.8, trollMaxV: 3.5,
  /** 浮標離人太遠（船漂走）就自動收線 */
  dragR: 32,
  /** 路亞：收線速度（剛按 → 按久）、抽竿往回跳幾公尺、假魚下沉／上浮速度（0 水面～1 貼底）、收回來多近算收完 */
  reelMin: 0.8, reelMax: 3.0, reelRamp: 1.5, jerkM: 0.6, sinkPerS: 0.22, risePerS: 0.3, jerkLift: 0.15, backR: 1.6,
  /** 節奏對了要維持幾秒魚影才會跟上來 */
  followS: 1.0,
  /** 拉扯：張力超過 snapT 持續 snapS 秒斷線；路亞張力低於 slackT 持續 slackS 秒脫鉤；紅區 */
  snapT: 0.95, snapS: 0.35, slackT: 0.06, slackS: 1.6, redT: 0.8,
  /** 魚獲最多幾條（賣魚沒有每日上限） */
  holdMax: 20,
};

export const ITEM_NAME: Record<ItemKey, string> = {
  oyster: '蚵仔肉', shrimp: '蝦仔餌', worm: '沙蟲', squid: '魷魚條', minnow: '米諾', jig: '鐵板', soft: '軟蟲', popper: '波趴',
  stickbait: '大鉛筆餌', trollskirt: '船拖裙尾假餌', slowjig: '慢搖鐵板', egi: '大號木蝦',
  vib: '顫泳餌', tairubber: '鯛魚頭', deepcrank: '深潛胖胖餌', squidjig: '小透抽軟餌',
};
export const LURE_TIP: Record<LureKey, string> = {
  minnow: '一直收線、偶爾抽竿：假魚左右閃，掠食魚會追',
  jig: '先讓它沉幾秒，再用力抽竿：釣深水大魚',
  soft: '慢慢收、收收停停：貼著海底爬，石斑愛吃',
  popper: '抽一下停一下：水面濺水花，只有清晨和黃昏有效',
  stickbait: '中快速收線、每隔一下抽竿：在水面下左右滑，整天都有效',
  trollskirt: '坐船拖釣最強；拋出去就要一直快收',
  slowjig: '讓它沉到深處，輕輕抽一下、停一下，讓它慢慢飄落',
  egi: '抽一下、停一下讓它沉：專釣軟絲、花枝和章魚，別一直快收',
  vib: '先讓它沉到中層，再中快速一直收：不用抽竿，靠震動引魚',
  tairubber: '沉到底，再慢慢等速收：收收停停別抽竿，貼底魚愛吃',
  deepcrank: '按住一直收就會自己潛下去：中速收線最好上手',
  squidjig: '沉到中底層，輕輕抽一下、停一下：專釣軟絲、花枝、章魚，白帶魚也愛',
};
export const LURE_KEYS: readonly LureKey[] = ['minnow', 'jig', 'soft', 'popper', 'stickbait', 'trollskirt', 'slowjig', 'egi', 'vib', 'tairubber', 'deepcrank', 'squidjig'];
export const isLure = (k: string): k is LureKey => (LURE_KEYS as readonly string[]).includes(k);
/** 可以拖釣的假魚（伺服器 FishTrollLures 同一份） */
export const TROLL_LURES: readonly LureKey[] = ['minnow', 'jig', 'trollskirt', 'stickbait', 'vib', 'deepcrank'];
/** 頭足類（中魚時噴墨）：大軟絲、花枝、章魚、大王烏賊 */
export const SQUID_SP: readonly string[] = ['aoriika', 'kouika', 'tako', 'daiouika'];
export const isSquidSp = (sp: string) => SQUID_SP.includes(sp);
/** 這個餌／假魚的拋竿距離範圍（垂釣 4～24 m；路亞看假魚重量） */
export const castRange = (item?: ItemKey) => (item && isLure(item) ? { min: FISH.lureCastMin, max: FISH.lureCast[item] } : { min: FISH.castMin, max: FISH.castMax });
export const castDist = (power: number, item?: ItemKey) => { const r = castRange(item); return r.min + (r.max - r.min) * Math.max(0, Math.min(1, power)); };
/** 力道條：來回擺動（0→1→0） */
export function chargePower(t: number, period: number = FISH.chargePeriod) {
  const p = ((t % period) + period) % period / period;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}
/** 拋竿落點：前進＝(-sin h, -cos h)（跟船、伺服器一樣） */
/** 甩竿時線頭飛出去的拋物線（自己畫面和看別人共用，見 castArc.ts） */
export { castFlyPoint, castFlyDur } from './castArc';
export const castPoint = (x: number, z: number, h: number, power: number, item?: ItemKey) => { const d = castDist(power, item); return { x: x - Math.sin(h) * d, z: z - Math.cos(h) * d }; };
/** 鏡頭朝向（世界方向向量）→ h */
export const yawOf = (dx: number, dz: number) => Math.atan2(-dx, -dz);
/** 拖釣：乘客、米諾／鐵板、船速在範圍內 */
export const trollOk = (seat: number, item: string, v: number) => seat > 0 && (TROLL_LURES as readonly string[]).includes(item) && Math.abs(v) >= FISH.trollMinV && Math.abs(v) <= FISH.trollMaxV;

/** 蚵仔肉：每天 oysterPerDay 塊（day＝台北日期 yyyymmdd） */
export function oysterLeft(day: number, usedDay: number, used: number) { return Math.max(0, FISH.oysterPerDay - (usedDay === day ? used : 0)); }
export function taipeiDay(ms: number) { const d = new Date(ms + 8 * 3600_000); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }

// ---------------- 路亞節奏 ----------------
/** 路亞假魚的狀態：dist＝離人多遠、depth＝0 水面～1 貼底；hold／spd／jerk 是最近幾秒的平滑平均 */
export type LureSt = { dist: number; depth: number; holdS: number; hold: number; spd: number; jerk: number; okT: number; follow: boolean };
export const newLure = (dist: number, item: LureKey): LureSt => ({ dist, depth: item === 'popper' ? 0 : 0.05, holdS: 0, hold: 0, spd: 0, jerk: 0, okT: 0, follow: false });
const ema = (v: number, x: number, dt: number, tau: number) => v + (x - v) * (1 - Math.exp(-dt / tau));

/** 各假餌的目標水層（0＝水面、1＝海底），跟 rhythmOk／HUD 水深條同一份 */
export const LURE_DEPTH: Record<LureKey, { min: number; max: number }> = {
  popper: { min: 0, max: 0.12 },
  stickbait: { min: 0, max: 0.45 },
  trollskirt: { min: 0, max: 0.45 },
  minnow: { min: 0, max: 1 },
  egi: { min: 0.3, max: 1 },
  jig: { min: 0.4, max: 1 },
  slowjig: { min: 0.45, max: 1 },
  soft: { min: 0.55, max: 1 },
  vib: { min: 0.35, max: 0.85 },
  tairubber: { min: 0.65, max: 1 },
  deepcrank: { min: 0.4, max: 0.8 },
  squidjig: { min: 0.45, max: 1 },
};
/**
 * 各假餌在水裡的物理（沒列的用預設）：sink＝不收線時下沉速度倍率、rise＝收線往上浮的倍率、
 * float＝不收線時往上浮（每秒，胖胖餌會浮）、dive＝收線時自己潛到的水層（舌板，越快越深）、vMax＝收線最快（公尺／秒，舌板阻力大）
 */
export const LURE_PHYS: Partial<Record<LureKey, { sink?: number; rise?: number; float?: number; dive?: [number, number]; vMax?: number }>> = {
  // 顫泳餌：重、沉很快，收線時不太浮起來
  vib: { sink: 2, rise: 0.3 },
  // 鯛魚頭：鉛頭沉底快，慢收幾乎貼底
  tairubber: { sink: 1.8, rise: 0.25 },
  // 深潛胖胖餌：本身會浮；收線時大舌板讓它潛到 0.5～0.75；收線最快 1.6 m/s
  deepcrank: { float: 0.1, dive: [0.5, 0.75], vMax: 1.6 },
  // 小透抽軟餌：比木蝦沉一點快
  squidjig: { sink: 1.2 },
};
export const lureDepthZone = (item: LureKey) => LURE_DEPTH[item];
export const inDepthZone = (item: LureKey, depth: number) => {
  const z = LURE_DEPTH[item];
  return depth >= z.min && depth <= z.max;
};

/** 這一刻的節奏對不對（看平滑平均）：軟蟲慢收貼底、米諾快收加抽竿、鐵板沉了再抽、波趴抽停；大鉛筆餌上層收加抽、裙尾快收、慢搖鐵板沉了輕抽停、木蝦抽沉 */
export function rhythmOk(item: LureKey, s: LureSt) {
  if (!inDepthZone(item, s.depth)) return false;
  switch (item) {
    case 'soft': return s.spd > 0.15 && s.spd < 1.3 && s.jerk < 1.2;
    case 'minnow': return s.spd >= 1.5 && s.jerk >= 0.5 && s.jerk <= 3.5;
    case 'jig': return s.jerk >= 0.5 && s.hold < 0.6;
    case 'popper': return s.jerk >= 0.7 && s.jerk <= 3.2 && s.hold < 0.35;
    // 大鉛筆餌：上層、中快速收線＋每隔一下抽竿（S 字滑行）
    case 'stickbait': return s.spd >= 1.0 && s.jerk >= 0.5 && s.jerk <= 3.5;
    // 船拖裙尾假餌：拋投時要一直快收、維持在上層
    case 'trollskirt': return s.spd >= 1.6;
    // 慢搖鐵板：沉深、輕抽加停頓（不能一直收）
    case 'slowjig': return s.jerk >= 0.4 && s.jerk <= 2.5 && s.hold < 0.45;
    // 木蝦：抽一下沉一下（不能一直快收）
    case 'egi': return s.jerk >= 0.4 && s.jerk <= 3 && s.hold < 0.5 && s.spd < 1.6;
    // 顫泳餌：中層以下、中快速一直收（不用抽竿）
    case 'vib': return s.spd >= 1.2;
    // 鯛魚頭：貼底慢慢等速收、不要抽竿
    case 'tairubber': return s.spd >= 0.4 && s.spd <= 1.2 && s.jerk < 0.4;
    // 深潛胖胖餌：中速收線（舌板自己潛到中深層）
    case 'deepcrank': return s.spd >= 0.7 && s.spd <= 1.7;
    // 小透抽軟餌：底層輕抽＋短停
    case 'squidjig': return s.jerk >= 0.3 && s.jerk <= 2.8 && s.hold < 0.55 && s.spd < 1.5;
  }
}

/** 路亞每幀：reel＝按住收線、jerk＝這幀抽竿；troll＝在拖釣（假魚跟在船後、自動算節奏對）。回傳 true＝假魚收回來了 */
export function stepLure(s: LureSt, item: LureKey, reel: boolean, jerk: boolean, dt: number, troll = false): boolean {
  if (troll) {
    s.depth = ema(s.depth, item === 'jig' ? 0.5 : item === 'trollskirt' ? 0.08 : item === 'vib' ? 0.45 : item === 'deepcrank' ? 0.55 : 0.2, dt, 1);
    s.okT += dt; s.follow = s.okT >= FISH.followS;
    s.spd = ema(s.spd, 2, dt, 1); s.hold = ema(s.hold, 0, dt, 2); s.jerk = ema(s.jerk, 1, dt, 3);
    return false;
  }
  s.holdS = reel ? s.holdS + dt : 0;
  const ph = LURE_PHYS[item];
  const vMax = ph?.vMax ?? FISH.reelMax;
  const v = reel ? Math.min(vMax, FISH.reelMin + (FISH.reelMax - FISH.reelMin) * Math.min(1, s.holdS / FISH.reelRamp)) : 0;
  s.dist = Math.max(0, s.dist - v * dt - (jerk ? FISH.jerkM : 0));
  if (item === 'popper') s.depth = 0;
  else {
    // 收線會往上；不動會往下沉；抽竿往上跳一下（舌板假餌收線會潛下去、不收會浮）
    if (ph?.dive && reel) s.depth = ema(s.depth, ph.dive[0] + (ph.dive[1] - ph.dive[0]) * Math.min(1, v / vMax), dt, 1.2);
    else if (ph?.float != null && !reel) s.depth -= ph.float * dt;
    else s.depth += reel ? -FISH.risePerS * (ph?.rise ?? 1) * dt * (v / FISH.reelMax) : FISH.sinkPerS * (ph?.sink ?? 1) * dt;
    if (jerk) s.depth -= FISH.jerkLift;
    s.depth = Math.max(0, Math.min(1, s.depth));
  }
  s.hold = ema(s.hold, reel ? 1 : 0, dt, 2);
  s.spd = ema(s.spd, v, dt, 1.2);
  // 抽竿次數：每次 +1，大約 3 秒衰減（≈ 最近 3 秒抽了幾下）
  s.jerk = s.jerk * Math.exp(-dt / 3) + (jerk ? 1 : 0);
  if (rhythmOk(item, s)) s.okT += dt; else s.okT = Math.max(0, s.okT - dt * 2);
  s.follow = s.okT >= FISH.followS;
  return s.dist <= FISH.backR;
}

// ---------------- 拉扯 ----------------
export type Fight = { prog: number; ten: number; run: number; runT: number; hiT: number; loT: number; t: number; power: number; rate: number; lure: boolean; /** 連續沒收線幾秒 */ offT?: number };
/** fightMs＝伺服器給的拉扯時間（越大隻越久）、power 0～1＝魚的力氣 */
/** 拉扯一開始的進度（0.2＝已經拉近一點）；prog 最低到 FIGHT_PROG_MIN＝大魚把線拉出去（距離最多到中魚時的 1.8 倍） */
export const FIGHT_P0 = 0.2, FIGHT_PROG_MIN = -0.44;
/** 拉扯中魚離人幾公尺：中魚時 d0 公尺，prog 到 1 就是 0 m，被拉出去可以超過 d0（最多 FIGHT_MAX_M） */
export const FIGHT_MAX_M = 60;
export function fightDistM(prog: number, d0: number) {
  return Math.max(0, Math.min(FIGHT_MAX_M, d0 * (1 - prog) / (1 - FIGHT_P0)));
}
/** 大魚程度 0～1：power 0.45 以下＝0（小魚幾乎拉不走線），越大隻越猛（平方） */
export const bigPull = (power: number) => { const k = Math.max(0, (power - 0.45) / 0.55); return Math.min(1, k * k); };
export function newFight(power: number, fightMs: number, lure: boolean): Fight {
  return { prog: FIGHT_P0, ten: 0.25, run: 0, runT: 1, hiT: 0, loT: 0, t: 0, power: Math.max(0.1, Math.min(1, power)), rate: 1.1 / Math.max(1, fightMs / 1000), lure };
}
export type FightEnd = 'landed' | 'snap' | 'unhook' | null;
/**
 * 拉扯一步：reel＝按住收線；dir＝搖桿左右（-1～1）。
 * 垂釣：只管張力別爆。路亞：魚會往左／右衝，搖桿往反方向拉才收得快、張力也比較低；張力太低魚會脫鉤。
 * 大魚：不收線（或魚在衝、方向沒拉對）就會一直把線拉出去（prog 往負的走、距離變遠）；收線＋反方向拉就收得回來。
 * rnd＝0～1 亂數（測試可固定）。
 */
export function stepFight(f: Fight, reel: boolean, dir: number, dt: number, rnd: () => number = Math.random): FightEnd {
  f.t += dt;
  let good = 1, bad = 0;
  if (f.lure) {
    f.runT -= dt;
    if (f.runT <= 0) { const r = rnd(); f.run = r < 0.2 ? 0 : r < 0.6 ? -1 : 1; f.runT = 1.2 + rnd() * 1.6; }
    if (f.run !== 0) { if (dir * f.run < -0.3) good = 1.35; else { good = 0.6; bad = 1; } }
  }
  if (reel) {
    f.ten += (0.15 + 0.75 * f.power) * dt * (bad ? 1.5 : good > 1 ? 0.75 : 1);
    f.prog += f.rate * dt * good;
  } else {
    f.ten -= 0.9 * dt;
    // 不收線：魚往回拉線；大魚放著越久拉得越猛（小魚幾乎不動）。一下一下放線（pump）不太會被拉走，一直放著才會
    f.offT = (f.offT ?? 0) + dt;
    const k = Math.max(0, Math.min(1, (f.offT - 0.35) / 0.8));
    f.prog -= (0.25 * f.power + 1.6 * bigPull(f.power) * k * k * (3 - 2 * k)) * f.rate * dt;
  }
  if (reel) f.offT = 0;
  // 大魚在衝、搖桿沒往反方向拉：就算在收線也會被拉出去
  if (bad) f.prog -= 0.9 * bigPull(f.power) * f.rate * dt;
  // 魚在衝、方向沒拉對：張力自己往上
  if (bad) f.ten += 0.3 * f.power * dt;
  f.ten = Math.max(0, Math.min(1, f.ten)); f.prog = Math.max(FIGHT_PROG_MIN, Math.min(1, f.prog));
  f.hiT = f.ten >= FISH.snapT ? f.hiT + dt : 0;
  f.loT = f.lure && f.t > 1 && f.ten <= FISH.slackT ? f.loT + dt : 0;
  if (f.prog >= 1) return 'landed';
  if (f.hiT >= FISH.snapS) return 'snap';
  if (f.loT >= FISH.slackS) return 'unhook';
  return null;
}

// ---------------- 狀態機 ----------------
/**
 * off：沒在釣；idle：竿子準備好；charge：按住拋竿在蓄力；cast：等伺服器確認；fly：線在飛；wait：等魚（路亞＝收線中）；
 * nibble：魚在試吃（浮標小抖，這時收竿會掉餌）；sink：浮標整個沉下去（時間窗內收竿＝中魚）；hook：等伺服器；fight：拉扯；land：等伺服器結算
 */
export type Phase = 'off' | 'idle' | 'charge' | 'cast' | 'fly' | 'wait' | 'nibble' | 'sink' | 'hook' | 'fight' | 'land';
export type FishEv = 'sink' | 'missed' | 'landed' | 'snap' | 'unhook' | 'back' | null;

export class FishSM {
  phase: Phase = 'off';
  gear: Gear = 'float';
  item: ItemKey = 'shrimp';
  t = 0; chargeT = 0; power = 0; flyT = 0; flyDur = 0; flyDelay = 0; sinkAt = 0; winEnd = 0; rollT = 0;
  sid = 0;
  lure: LureSt | null = null;
  fight: Fight | null = null;
  /** 浮標小抖（畫面用 0～1） */
  twitch = 0;
  enter() { if (this.phase === 'off') this.phase = 'idle'; }
  exit() { this.phase = 'off'; this.lure = null; this.fight = null; }
  get lineOut() { return this.phase === 'fly' || this.phase === 'wait' || this.phase === 'nibble' || this.phase === 'sink' || this.phase === 'hook'; }
  startCharge() { if (this.phase !== 'idle') return false; this.phase = 'charge'; this.chargeT = 0; this.power = 0; return true; }
  /** 放開拋竿：回傳力道（不是蓄力中＝null） */
  release(): number | null { if (this.phase !== 'charge') return null; this.phase = 'cast'; return this.power; }
  /** 伺服器答應拋竿：flyS＝線頭飛多久、delay＝竿子還沒甩到放手點要再等多久（畫面用，落水＝flyT 歸零） */
  castOk(sid: number, dist: number, flyS: number = FISH.flyS, delay = 0) {
    if (this.phase !== 'cast') return;
    this.flyDelay = Math.max(0, delay); this.flyDur = this.flyDelay + Math.max(0.05, flyS);
    this.sid = sid; this.phase = 'fly'; this.flyT = this.flyDur; this.rollT = FISH.rollS * 0.75;
    this.lure = isLure(this.item) ? newLure(dist, this.item) : null;
  }
  castFail() { if (this.phase === 'cast') this.phase = 'idle'; }
  /** 伺服器說有魚咬：垂釣先小抖 sinkMs 才沉；路亞直接 sink（自動收竿） */
  bite(sinkMs: number) {
    if (this.phase !== 'wait') return;
    this.sinkAt = this.t + sinkMs / 1000; this.winEnd = this.sinkAt + FISH.windowS;
    this.phase = sinkMs > 0 ? 'nibble' : 'sink';
  }
  /** 按收竿：回傳要不要問伺服器（'reel'＝收回來／試著中魚） */
  pressReel(): boolean { if (this.phase === 'wait' || this.phase === 'nibble' || this.phase === 'sink') { this.phase = 'hook'; return true; } return false; }
  hooked(power: number, fightMs: number) { this.phase = 'fight'; this.fight = newFight(power, fightMs, this.gear === 'lure'); this.lure = null; }
  /** 收回來／太早／太慢／拉扯結束：回到準備好 */
  reset() { if (this.phase !== 'off') this.phase = 'idle'; this.lure = null; this.fight = null; this.twitch = 0; }
  /** 每幀；reel／jerk／dir＝玩家輸入。回傳事件（UI 處理） */
  tick(dt: number, inp: { reel: boolean; jerk: boolean; dir: number; troll?: boolean }, rnd: () => number = Math.random): FishEv {
    this.t += dt;
    switch (this.phase) {
      case 'charge': this.chargeT += dt; this.power = chargePower(this.chargeT); return null;
      case 'fly': this.flyT -= dt; if (this.flyT <= 0) this.phase = 'wait'; return null;
      case 'wait':
        if (this.lure && isLure(this.item) && stepLure(this.lure, this.item, inp.reel, inp.jerk, dt, inp.troll)) return 'back';
        return null;
      case 'nibble':
        this.twitch = Math.max(0, Math.sin(this.t * 11)) * 0.6;
        if (this.t >= this.sinkAt) { this.phase = 'sink'; this.twitch = 1; return 'sink'; }
        return null;
      case 'sink':
        if (this.t > this.winEnd + 0.35) { this.phase = 'hook'; return 'missed'; }
        return null;
      case 'fight': {
        const r = stepFight(this.fight!, inp.reel, inp.dir, dt, rnd);
        if (r) { this.phase = 'land'; return r; }
        return null;
      }
    }
    return null;
  }
}

// ---------------- 伺服器錯誤 → 玩家看得懂的話 ----------------
/** ''＝不用提示（自己會處理／太頻繁） */
export const FISH_ERR: Record<string, string> = {
  not_at_water: '站到碼頭或岸邊才能釣', moving: '船在開：先停船才能拋竿', swimming: '游泳時不能釣魚', land: '那邊是岸上，轉向海面再拋',
  hold_full: '魚獲滿了，先回碼頭賣魚', bad_gear: '這個餌配不上這支竿', slow: '', far_dock: '靠近碼頭再賣', empty: '還沒有魚可以賣',
  daily_cap: '伺服器還沒更新：今天賣魚到舊的上限了', old_server: '伺服器還沒更新，暫時不能釣魚', offline: '還沒連上線', no_cast: '', too_fast: '魚跑掉了',
  fighting: '上一竿還沒收好，再拋一次', not_joined: '重新連線中，等一下再拋', fail: '連線不穩，再拋一次',
};
export const fishErr = (e?: string, d = '做不到') => (e != null && Object.prototype.hasOwnProperty.call(FISH_ERR, e) ? FISH_ERR[e] || d : d);
/** 連線問題（呼叫可能沒送到、或伺服器做了但回應沒收到）：伺服器那邊的一竿可能還掛著 */
export const fishNetErr = (e?: string) => e === 'offline' || e === 'fail' || e === 'not_joined';

// ---------------- 船上站著走（釣魚時） ----------------
/**
 * 膠筏甲板可以站的範圍（船身座標：+z 船尾、-z 船頭；x 左右）。甲板木條 x ±1.07、z -1.13～1.95；
 * 留邊不掉下去，避開冰桶（x 0.2～0.9, z 0.65～1.15）和駕駛座木箱（x -0.65～-0.15, z 1.5～1.95）。
 */
export const DECK = {
  x0: -0.82, x1: 0.82, z0: -0.95, z1: 1.55,
  /** 障礙（含人的半徑） */
  boxes: [
    { x0: 0.05, x1: 1.05, z0: 0.5, z1: 1.3 },
    { x0: -0.8, x1: 0, z0: 1.35, z1: 2.1 },
  ] as readonly { x0: number; x1: number; z0: number; z1: number }[],
  /** 走路速度（m/s）：跟廣場走路一樣（PLAZA_WALK_SPD）；有裝備加速時 stepDeck 另外帶 spd */
  walkSpd: PLAZA_WALK_SPD,
  /** 甲板面高度（船身座標） */
  y: 0.255,
};
/** 夾在甲板內、推出障礙（往最近而且還在甲板內的邊推）；寫進 out（不配置新物件） */
export function deckClamp(x: number, z: number, out: { x: number; z: number } = { x: 0, z: 0 }) {
  x = Math.max(DECK.x0, Math.min(DECK.x1, x));
  z = Math.max(DECK.z0, Math.min(DECK.z1, z));
  for (const b of DECK.boxes) {
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) {
      let bx = x, bz = z, bd = Infinity;
      const tryP = (d: number, px: number, pz: number) => { if (d < bd && px >= DECK.x0 && px <= DECK.x1 && pz >= DECK.z0 && pz <= DECK.z1) { bd = d; bx = px; bz = pz; } };
      tryP(x - b.x0, b.x0, z); tryP(b.x1 - x, b.x1, z); tryP(z - b.z0, x, b.z0); tryP(b.z1 - z, x, b.z1);
      x = bx; z = bz;
    }
  }
  out.x = x; out.z = z;
  return out;
}
/** 站起來的起點：座位旁邊（夾在甲板內） */
export function deckStart(seatX: number, seatZ: number) { return deckClamp(seatX, seatZ - 0.35); }
/**
 * 甲板上走一步（直接改 p）：mx／mz＝搖桿（螢幕：右、前），camYaw＝鏡頭在世界的朝向，boatH＝船頭方向。
 * p＝船身座標的位置和面向（yaw 0＝面向船頭 -z）。回傳有沒有在走。
 */
export function stepDeck(p: { x: number; z: number; yaw: number }, mx: number, mz: number, camYaw: number, boatH: number, dt: number, spd: number = DECK.walkSpd): boolean {
  const m = Math.hypot(mx, mz);
  if (m < 0.12) return false;
  const k = Math.min(1, m);
  // 鏡頭座標 → 世界：前＝(-sin cy, -cos cy)、右＝(cos cy, -sin cy)
  const wx = (-Math.sin(camYaw) * mz + Math.cos(camYaw) * mx) / m, wz = (-Math.cos(camYaw) * mz - Math.sin(camYaw) * mx) / m;
  // 世界 → 船身（轉 -boatH）
  const c = Math.cos(-boatH), s = Math.sin(-boatH);
  const lx = wx * c + wz * s, lz = -wx * s + wz * c;
  deckClamp(p.x + lx * spd * k * dt, p.z + lz * spd * k * dt, p);
  p.yaw = Math.atan2(-lx, -lz);
  return true;
}

/**
 * 船上站著釣魚的鏡頭：跟岸上一樣的第三人稱，繞著人轉（camYaw＝玩家拖曳的鏡頭朝向，世界座標），不鎖船頭。
 * 拋竿方向＝鏡頭看的水平方向＝camYaw，所以人面向哪就往哪拋。
 */
export const STAND_CAM = { dist: 4.4, el: 0.36, eye: 1.35, ahead: 2.2 } as const;
type V3 = { x: number; y: number; z: number };
export function standCam(x: number, y: number, z: number, camYaw: number, pos: V3, look: V3) {
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), hd = STAND_CAM.dist * Math.cos(STAND_CAM.el);
  pos.x = x - fx * hd; pos.z = z - fz * hd; pos.y = y + STAND_CAM.eye + STAND_CAM.dist * Math.sin(STAND_CAM.el);
  look.x = x + fx * STAND_CAM.ahead; look.z = z + fz * STAND_CAM.ahead; look.y = y + STAND_CAM.eye - 0.2;
}
/**
 * 站在甲板上該面向哪（船身座標，0＝船頭）：線在水裡／蓄力＝那個世界方向；走路＝走的方向；站著不動＝鏡頭方向（人跟著鏡頭轉）。
 */
export function standWantYaw(fishYaw: number | null, moving: boolean, walkYaw: number, camYaw: number, boatH: number) {
  if (fishYaw != null) return fishYaw - boatH;
  if (moving) return walkYaw;
  return camYaw - boatH;
}

/**
 * HUD 一直顯示的「現在幾公尺」：蓄力＝這個力道會拋多遠、甩出去＝線頭飛到哪、等魚／咬餌＝浮標或假魚離人多遠（船漂、收線、抽竿都即時變）、
 * 拉魚＝魚還有多遠（拉近 prog 到 1 就是 0 m；大魚把線拉出去會比中魚時還遠）。沒在用線（準備好、沒在釣）回 null。
 */
export type FishDistIn = { phase: Phase; power: number; item: ItemKey; castDst: number; flyT: number; flyDur?: number; lureDist: number | null; floatDist: number; prog: number; fightD0: number };
export function fishDistNow(s: FishDistIn): number | null {
  switch (s.phase) {
    case 'charge': case 'cast': return castDist(s.power, s.item);
    case 'fly': return Math.max(0, s.castDst * (1 - Math.max(0, Math.min(1, s.flyT / (s.flyDur || FISH.flyS)))));
    case 'wait': case 'nibble': case 'sink': case 'hook': return Math.max(0, s.lureDist ?? s.floatDist);
    case 'fight': case 'land': return fightDistM(s.prog, s.fightD0);
    default: return null;
  }
}
/** 公尺顯示：10 m 以下一位小數（拉近最後幾公尺看得到在變），以上取整數；0 就是「0 m」 */
export function fmtDistM(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return '';
  const v = Math.max(0, m);
  return v < 0.05 ? '0 m' : v < 10 ? `${v.toFixed(1)} m` : `${Math.round(v)} m`;
}

// ---------------- 能釣的地方／沒釣竿提示 ----------------
/** 岸上可釣魚區的東界（碼頭岸線 -24 再往內 0.5 m）；西岸淺灘 |z| 跟 PB.shoreZ 一樣是 11。 */
export const FISH_SHORE_X = -23.5;
/** 沒有釣竿、走進可釣魚區時的上方提示（雜貨店「釣具」分頁）。 */
export const NO_ROD_HINT = '還沒買釣竿，可到「雜貨店 → 釣具」購買';
/** 離開後再進來，至少隔幾秒才再提示，避免在區界來回踩洗版。 */
export const NO_ROD_HINT_COOLDOWN = 20;

/** 現在站的地方能不能釣（岸上碼頭／西岸淺灘，或在船上）。 */
export function canFishAt(mode: string, walk?: { x: number; z: number } | null, onBoat = false): boolean {
  if (mode === 'boat') return onBoat;
  if (mode !== 'walk' || !walk) return false;
  const onPier = walk.x <= FISH_SHORE_X && walk.x >= PB.pierX1 - 0.3 && Math.abs(walk.z) <= PB.pierHalfW + 0.3;
  const onShore = walk.x <= FISH_SHORE_X && Math.abs(walk.z) <= PB.shoreZ;
  return onPier || onShore;
}

export type NoRodHintSt = { inZone: boolean; lastAt: number };
export function newNoRodHint(): NoRodHintSt { return { inZone: false, lastAt: -Infinity }; }
/**
 * 沒有釣竿、剛走進可釣魚區時回 true（顯示一次提示）。
 * 待在區內不會重覆；有竿永遠不提示。離開後再進來要過冷卻時間。
 */
export function stepNoRodHint(st: NoRodHintSt, inZone: boolean, hasRod: boolean, now: number, cooldown = NO_ROD_HINT_COOLDOWN): boolean {
  if (hasRod) { st.inZone = inZone; return false; }
  const entered = inZone && !st.inZone;
  st.inZone = inZone;
  if (!entered || now - st.lastAt < cooldown) return false;
  st.lastAt = now;
  return true;
}
