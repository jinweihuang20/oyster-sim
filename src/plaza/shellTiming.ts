/**
 * 廣場丟殼時間軸（丟殼者／被丟者／旁觀者共用）。
 *
 * 被丟的人收到 ShellInbound 後：先蓄力預警 PLAZA_WINDUP 秒（固定，保留反應時間），
 * 再以固定速度飛 距離÷PLAZA_SHELL_SPEED 秒，落地時才判定擋／反彈／受傷。
 * 飛行秒數只用封包裡的出手點→目標點座標算（三方收到的數字相同），所以各端落地時間一致。
 * 丟真人時，丟殼者與旁觀者的殼花 PLAZA_WINDUP + 飛行 才落地。
 * 阿婆由伺服器在轉發當下就結算噴血，維持快飛；反彈飛回不用蓄力，飛行同樣是距離÷速度。
 */
export type V3 = { x: number; y: number; z: number };

/** 被丟者蓄力預警秒數（⚠ 方向警告；收音機晚亮在剩一半時才亮） */
export const PLAZA_WINDUP = 0.65;
/** 座標缺漏時的飛行秒數 */
export const PLAZA_FLY_FALLBACK = 0.4;
/** 殼的固定飛行速度（公尺／秒）：同桌對面約 2.8m → 0.4s */
export const PLAZA_SHELL_SPEED = 7;
/** 極近距離的最短飛行秒數（避免 0 秒） */
export const PLAZA_FLY_MIN = 0.12;
/** 丟阿婆時本機快飛秒數 */
export const PLAZA_NPC_FLY = 0.5;

/** 飛行秒數＝出手點到目標點距離 ÷ 固定速度（最短 PLAZA_FLY_MIN） */
export function plazaFlyTime(from: V3 | null | undefined, to: V3 | null | undefined): number {
  if (!from || !to) return PLAZA_FLY_FALLBACK;
  const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (!Number.isFinite(d)) return PLAZA_FLY_FALLBACK;
  return Math.max(PLAZA_FLY_MIN, d / PLAZA_SHELL_SPEED);
}

/** 封包（fromX..toZ）的飛行秒數 */
export function plazaEventFlyTime(e: { fromX: number; fromY: number; fromZ: number; toX: number; toY: number; toZ: number }) {
  return plazaFlyTime({ x: e.fromX, y: e.fromY, z: e.fromZ }, { x: e.toX, y: e.toY, z: e.toZ });
}

export type ShellFlightKind =
  /** 自己丟出去；fly＝plazaFlyTime(出手點, 送出的目標點) */
  | { who: 'thrower'; targetIsNpc: boolean; fly: number }
  /** 旁觀別人丟；reflect／targetIsNpc 為 undefined/null 代表不知道（舊伺服器或看不到目標） */
  | { who: 'spectator'; reflect?: boolean; targetIsNpc: boolean | null; fly: number };

/** 回傳 [飛行秒數, 拋物線高度] */
export function plazaShellFlight(k: ShellFlightKind): [number, number] {
  if (k.who === 'thrower') return k.targetIsNpc ? [PLAZA_NPC_FLY, 0.3] : [PLAZA_WINDUP + k.fly, 0.55];
  if (k.reflect === false && k.targetIsNpc === false) return [PLAZA_WINDUP + k.fly, 0.55];
  return [k.fly, 0.3];
}
