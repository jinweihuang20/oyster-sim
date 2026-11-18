/**
 * 廣場丟殼時間軸（丟殼者／被丟者／旁觀者共用）。
 *
 * 照現實：丟殼者一按就放手，殼以固定速度飛；ThrowAt 在放手當下送出。
 * 被丟者／旁觀者收到時殼「已經在空中飛了 延遲 秒」：從弧線上對應進度接著飛，
 * 剩餘時間＝飛行 − 估計延遲（最少 PLAZA_REMAIN_MIN），盡量和丟殼者畫面同時落地。
 * 被丟者 ⚠ 預警在收到當下亮起，落地當下才判定擋／反彈／受傷。
 * 飛行秒數只用封包裡的出手點→目標點座標算（三方數字相同）。
 * 阿婆主動丟玩家（伺服器發的）維持原本先蓄力 PLAZA_NPC_WINDUP 再飛；丟阿婆由伺服器當下結算，本機快飛。
 */
export type V3 = { x: number; y: number; z: number };

/** 阿婆主動丟玩家時，被丟者先看到的蓄力預警秒數（原本行為） */
export const PLAZA_NPC_WINDUP = 1.0;
/** 座標缺漏時的飛行秒數 */
export const PLAZA_FLY_FALLBACK = 0.4;
/** 殼的固定飛行速度（公尺／秒）：同桌對面約 2.4m → 0.3s */
export const PLAZA_SHELL_SPEED = 8;
/** 最長飛行秒數（廣場另一頭也不會飄太久） */
export const PLAZA_FLY_MAX = 0.8;
/** 極近距離的最短飛行秒數（避免 0 秒） */
export const PLAZA_FLY_MIN = 0.12;
/** 丟阿婆時本機快飛秒數 */
export const PLAZA_NPC_FLY = 0.5;
/** 收到後至少還要飛這麼久（不瞬移、留一點反應） */
export const PLAZA_REMAIN_MIN = 0.1;
/** 還沒量到延遲時的預估單程延遲（秒） */
export const PLAZA_LAT_DEFAULT = 0.06;
/** 延遲補償上限（秒）：網路很差時不要補到殼一出現就落地 */
export const PLAZA_LAT_MAX = 0.25;

/** 飛行秒數＝出手點到目標點距離 ÷ 固定速度（PLAZA_FLY_MIN～PLAZA_FLY_MAX） */
export function plazaFlyTime(from: V3 | null | undefined, to: V3 | null | undefined): number {
  if (!from || !to) return PLAZA_FLY_FALLBACK;
  const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (!Number.isFinite(d)) return PLAZA_FLY_FALLBACK;
  return Math.min(PLAZA_FLY_MAX, Math.max(PLAZA_FLY_MIN, d / PLAZA_SHELL_SPEED));
}

/** 封包（fromX..toZ）的飛行秒數 */
export function plazaEventFlyTime(e: { fromX: number; fromY: number; fromZ: number; toX: number; toY: number; toZ: number }) {
  return plazaFlyTime({ x: e.fromX, y: e.fromY, z: e.fromZ }, { x: e.toX, y: e.toY, z: e.toZ });
}

/**
 * 丟殼者→伺服器→自己 的單程延遲估計（秒）。
 * 用自己量到的來回時間（RTT）：對方上行≈自己上行時，上行半趟＋下行半趟≈一個 RTT。
 */
export function plazaLatencyEst(rttMs: number | null | undefined): number {
  if (rttMs == null || !Number.isFinite(rttMs) || rttMs <= 0) return PLAZA_LAT_DEFAULT;
  return Math.min(PLAZA_LAT_MAX, rttMs / 1000);
}

/** 收到時殼已飛了 lat 秒：回傳弧線起始進度 k0 與剩餘秒數 remain（remain＝(1−k0)×fly） */
export function plazaCatchUp(fly: number, lat: number): { k0: number; remain: number } {
  if (!(fly > 0)) return { k0: 0, remain: PLAZA_REMAIN_MIN };
  const remain = Math.min(fly, Math.max(PLAZA_REMAIN_MIN, fly - Math.max(0, lat)));
  return { k0: 1 - remain / fly, remain };
}
