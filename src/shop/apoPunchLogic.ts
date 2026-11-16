/** 阿珀貓拳計時與允許條件（純邏輯，方便單測） */

export const APO_PUNCH_INTERVAL = 10;
export const APO_PUNCH_RETRY = 2;
/** 出拳請求進行中：先佔住計時，等結果再改成間隔或重試 */
export const APO_PUNCH_PENDING = 99;

export type ApoPunchGateInput = {
  play: boolean;
  tut: boolean;
  race: boolean;
  isApo: boolean;
  mg: boolean;
  plaza: boolean;
  plazaActive: boolean;
  /** 工寮或廣場坐下剝蚵中 */
  shucking: boolean;
};

/** 廣場內站著、走著、坐下都可以出拳；工寮則要正在剝蚵。不看 AFK。 */
export function apoPunchAllowedFrom(s: ApoPunchGateInput): boolean {
  if (!s.play || s.tut || s.race || !s.isApo || s.mg) return false;
  if (s.plaza && s.plazaActive) return true;
  return s.shucking;
}

/** 允許時才扣秒；到時回 fire，dueIn 先設成 PENDING，等非同步結果再 resolve。 */
export function tickApoPunchTimer(allowed: boolean, dueIn: number, dt: number): { dueIn: number; fire: boolean } {
  if (!allowed) return { dueIn, fire: false };
  let t = dueIn <= 0 ? APO_PUNCH_INTERVAL : dueIn;
  t -= dt;
  if (t <= 0) return { dueIn: APO_PUNCH_PENDING, fire: true };
  return { dueIn: t, fire: false };
}

export function resolveApoPunchTimer(ok: boolean): number {
  return ok ? APO_PUNCH_INTERVAL : APO_PUNCH_RETRY;
}

/** 廣場同步結果：成功或舊服／斷線／節流時仍播出拳；其他錯誤則稍後再探。 */
export function plazaPunchProceed(r: { ok?: boolean; err?: string } | null | undefined): 'play' | 'retry' {
  if (!r) return 'retry';
  if (r.ok) return 'play';
  const err = r.err || '';
  if (err === 'nosup' || err === 'no_conn' || err === 'slow') return 'play';
  return 'retry';
}

/** 僅在舊服／斷線時用本機偷肉；伺服器說 slow 只播動畫、不偷。 */
export function plazaPunchLocalSteal(r: { ok?: boolean; err?: string } | null | undefined, wantSteal: boolean): boolean {
  if (r?.ok) return false;
  if (r?.err === 'nosup' || r?.err === 'no_conn') return wantSteal;
  return false;
}
