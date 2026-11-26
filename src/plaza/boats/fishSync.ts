/**
 * 釣魚動作同步（給別人看）：純資料＋判斷，不碰 three／DOM，方便測試。
 * 只在狀態變了才送：姿勢代碼換了、線長差 1 m、張力差 0.25、甲板上走動／轉身、拋竿方向換了；最快 0.35 秒一次，在釣的時候 2 秒保底。
 */

export type FishSyncMsg = {
  /** 姿勢代碼（fishPose.ts）：0 沒在釣、1 持竿、2 蓄力、3 甩竿、4 等待、5 拉魚、6 捲線、7 秀漁獲；+16 路亞竿；拉魚時 +32＝往左拉、+64＝往右拉 */
  st: number;
  /** 在船上（dx/dz/yaw＝船身座標）；岸上（yaw＝世界面向） */
  boat: boolean;
  dx: number; dz: number; yaw: number;
  /** 拋竿方向（船上＝相對船身；岸上＝世界） */
  ch: number;
  /** 線長（公尺；竿尖到浮標／假魚的水平距離） */
  cd: number;
  /** 拉扯張力 0～1 */
  tn: number;
  /** 秀漁獲：魚種、重量 */
  sp: string; kg: number;
};

export const FISH_SYNC = {
  /** 兩次送出最短間隔（秒） */
  minGap: 0.35,
  /** 姿勢換了（蓄力→甩竿→等魚…）最短間隔：要快，別人看到的甩竿時間點才跟自己一樣 */
  phaseGap: 0.1,
  /** 在釣的時候多久保底送一次（秒） */
  keepAlive: 2,
  /** 別人多久沒更新就當作不釣了（秒） */
  stale: 6,
  cdStep: 1, tnStep: 0.25, posStep: 0.08, yawStep: 0.25, chStep: 0.12,
  /** 抽竿（路亞等待／捲線時 tn 換了）最短間隔：要快，別人看到的抽竿才跟得上節奏；伺服器限 3 秒 16 筆 */
  jerkGap: 0.25,
  /** 拉魚左右拉方向換了的最短間隔：要快，別人看到側傾才跟得上；比姿勢轉換稍慢，以免洗爆伺服器 3 秒 16 筆 */
  steerGap: 0.2,
};

export const newFishSync = (): FishSyncMsg => ({ st: 0, boat: false, dx: 0, dz: 0, yaw: 0, ch: 0, cd: 0, tn: 0, sp: '', kg: 0 });
export function copyFishSync(from: FishSyncMsg, to: FishSyncMsg) {
  to.st = from.st; to.boat = from.boat; to.dx = from.dx; to.dz = from.dz; to.yaw = from.yaw; to.ch = from.ch; to.cd = from.cd; to.tn = from.tn; to.sp = from.sp; to.kg = from.kg;
  return to;
}
/** 路亞等待／捲線（tn 拿來送抽竿計數） */
export const jerkSt = (st: number) => (st & 16) !== 0 && ((st & 15) === 4 || (st & 15) === 6);
const angD = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** 跟上次送出的比：有沒有「看得出來」的變化 */
export function fishSyncChanged(last: FishSyncMsg, cur: FishSyncMsg) {
  if (last.st !== cur.st || last.boat !== cur.boat || last.sp !== cur.sp) return true;
  if (cur.st === 0) return false;
  return Math.abs(last.cd - cur.cd) >= FISH_SYNC.cdStep
    || ((cur.st & 15) === 5 && Math.abs(last.tn - cur.tn) >= FISH_SYNC.tnStep)
    || (jerkSt(cur.st) && last.tn !== cur.tn)
    || (cur.boat && Math.hypot(last.dx - cur.dx, last.dz - cur.dz) > FISH_SYNC.posStep)
    || angD(last.yaw, cur.yaw) > FISH_SYNC.yawStep
    || angD(last.ch, cur.ch) > FISH_SYNC.chStep;
}

/**
 * 這幀要不要送。sentOnce＝送過至少一次；since＝距離上次送出的秒數。
 * 開始釣／不釣了／姿勢換了：只要過了最短間隔就送；不釣了（st 0）立刻送，別人頭上的「釣魚中」才會馬上收掉。
 */
export function fishSyncDue(last: FishSyncMsg, cur: FishSyncMsg, sentOnce: boolean, since: number) {
  if (!sentOnce) return cur.st !== 0;
  if (cur.st === 0) return last.st !== 0;
  if (since >= FISH_SYNC.keepAlive) return true;
  // 姿勢／路亞 bit 換了走 phaseGap；只有左右拉方向換了走 steerGap（較慢，避免左右狂切洗爆限速）
  if ((last.st & 31) !== (cur.st & 31)) return since >= FISH_SYNC.phaseGap;
  if (((last.st ^ cur.st) & (32 | 64)) !== 0) return since >= FISH_SYNC.steerGap;
  if (jerkSt(cur.st) && jerkSt(last.st) && last.tn !== cur.tn) return since >= FISH_SYNC.jerkGap;
  return since >= FISH_SYNC.minGap && fishSyncChanged(last, cur);
}

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const g = (o: any, k: string) => o?.[k] ?? o?.[k[0].toUpperCase() + k.slice(1)];
/** 伺服器事件 → 乾淨的資料（PascalCase／camelCase 都吃、壞數字變 0） */
export function normFishSync(x: any): (FishSyncMsg & { connId: string }) | null {
  const connId = String(g(x, 'connId') ?? '');
  if (!connId) return null;
  const st = Math.max(0, Math.trunc(num(g(x, 'st'))));
  return {
    connId, st, boat: !!g(x, 'boat'),
    dx: num(g(x, 'dx')), dz: num(g(x, 'dz')), yaw: num(g(x, 'yaw')), ch: num(g(x, 'ch')),
    cd: Math.max(0, Math.min(44, num(g(x, 'cd')))), tn: Math.max(0, Math.min(1, num(g(x, 'tn')))),
    sp: String(g(x, 'sp') ?? '').slice(0, 24), kg: Math.max(0, num(g(x, 'kg'))),
  };
}

/** 頭上的狀態牌：0 不顯示、1「釣魚中」、2「拉魚中！」、3「釣到了！」 */
export function fishBadgeOf(st: number): 0 | 1 | 2 | 3 {
  const b = st & 15;
  return b === 0 ? 0 : b === 5 ? 2 : b === 7 ? 3 : 1;
}
export const FISH_BADGE_TEXT = ['', '釣魚中', '拉魚中！', '釣到了！'] as const;

/** 有沒有線在水裡（要畫線＋浮標／假魚） */
export const fishLineOut = (st: number) => { const b = st & 15; return b === 4 || b === 5 || b === 6; };

/** 線在水面的落點：站的位置往拋竿方向 cd 公尺（yaw 慣例：前方＝-sin/-cos） */
export function fishLineEnd(x: number, z: number, heading: number, cd: number, out: { x: number; z: number }) {
  out.x = x - Math.sin(heading) * cd; out.z = z - Math.cos(heading) * cd;
  return out;
}
