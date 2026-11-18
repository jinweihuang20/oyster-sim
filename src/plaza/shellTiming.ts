/**
 * 廣場丟殼時間軸（丟殼者／被丟者／旁觀者共用）。
 *
 * 被丟的人收到 ShellInbound 後：先蓄力預警 WINDUP 秒，再飛 INBOUND_FLY 秒，落地時才判定擋／反彈／受傷。
 * 所以丟真人時，丟殼者與旁觀者的殼也要花 WINDUP + INBOUND_FLY 才落地，畫面才會和結果對得上。
 * 阿婆由伺服器在轉發當下就結算噴血，維持快飛；反彈飛回也不用蓄力。
 */
export const PLAZA_WINDUP = 1.0;
export const PLAZA_INBOUND_FLY = 0.55;
export const PLAZA_SHELL_LAND = PLAZA_WINDUP + PLAZA_INBOUND_FLY;
/** 丟阿婆時本機快飛秒數 */
export const PLAZA_NPC_FLY = 0.5;

export type ShellFlightKind =
  /** 自己丟出去 */
  | { who: 'thrower'; targetIsNpc: boolean }
  /** 旁觀別人丟；reflect／targetIsNpc 為 undefined/null 代表不知道（舊伺服器或看不到目標） */
  | { who: 'spectator'; reflect?: boolean; targetIsNpc: boolean | null };

/** 回傳 [飛行秒數, 拋物線高度] */
export function plazaShellFlight(k: ShellFlightKind): [number, number] {
  if (k.who === 'thrower') return k.targetIsNpc ? [PLAZA_NPC_FLY, 0.3] : [PLAZA_SHELL_LAND, 0.75];
  if (k.reflect === false && k.targetIsNpc === false) return [PLAZA_SHELL_LAND, 0.75];
  return [PLAZA_INBOUND_FLY, 0.35];
}
