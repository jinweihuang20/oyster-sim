/** 死鬥對局參數（單機先用；線上房間之後填同一結構） */

export type DmMode = 'ffa' | 'horde';

export type DmArenaId = 'pier';

export type DmMatchConfig = {
  mode: DmMode;
  /** FFA：BOT 數量；圍毆波次另算 */
  botCount: number;
  arenaId: DmArenaId;
  /** 混戰一局秒數；圍毆不使用整場倒數 */
  durationSec: number;
};

export const DM_MAX_BOTS = 8;
export const DM_ROUND_SEC = 180;

export const DM_PRESETS = {
  ffa: { mode: 'ffa', botCount: DM_MAX_BOTS, arenaId: 'pier', durationSec: DM_ROUND_SEC },
  horde: { mode: 'horde', botCount: DM_MAX_BOTS, arenaId: 'pier', durationSec: DM_ROUND_SEC },
} as const satisfies Record<DmMode, DmMatchConfig>;

export const DM_MODE_LABEL: Record<DmMode, string> = {
  ffa: '混戰',
  horde: '圍毆',
};

export function resolveMatchConfig(partial?: Partial<DmMatchConfig>): DmMatchConfig {
  const base = DM_PRESETS.ffa;
  const mode = partial?.mode ?? base.mode;
  const preset = DM_PRESETS[mode] ?? base;
  const botCount = Math.max(0, Math.min(DM_MAX_BOTS, Math.floor(partial?.botCount ?? preset.botCount)));
  const arenaId = partial?.arenaId ?? preset.arenaId;
  const durationSec = Math.max(30, Math.floor(partial?.durationSec ?? preset.durationSec));
  return { mode, botCount, arenaId, durationSec };
}

/** 敵我判定：之後線上玩家也吃同一條 */
export function isHostile(a: { teamId: number }, b: { teamId: number }): boolean {
  return a !== b && a.teamId !== b.teamId;
}

/** 依模式與席位指派 teamId；席位 0＝本機玩家，1..＝BOT */
export function teamIdForSeat(mode: DmMode, seat: number): number {
  if (mode === 'horde') return seat === 0 ? 0 : 1;
  return seat;
}

/** 圍毆第 n 關（1-based）出場 BOT 數 */
export function hordeBotCount(wave: number): number {
  return Math.min(DM_MAX_BOTS, 2 + Math.max(0, wave - 1));
}

/** 圍毆兇猛度：散射倍率、射擊間隔倍率、移速倍率 */
export function hordeAggression(wave: number): { errMul: number; cdMul: number; spdMul: number } {
  const t = Math.max(0, wave - 1);
  return {
    errMul: Math.max(0.35, 1 - t * 0.07),
    cdMul: Math.max(0.4, 1 - t * 0.06),
    spdMul: Math.min(1.45, 1 + t * 0.05),
  };
}

/** 混戰結算：名次 1-based（對齊槍價 2k–9k，好局約半把中價槍） */
export function ffaReward(place: number, kills: number): number {
  const placePay = place === 1 ? 650 : place === 2 ? 400 : place === 3 ? 250 : 120;
  return placePay + kills * 28;
}

/** 圍毆結算：過關數＋擊殺 */
export function hordeReward(wavesCleared: number, kills: number): number {
  let pay = kills * 32;
  for (let w = 1; w <= wavesCleared; w++) pay += 140 + w * 80;
  return pay;
}
