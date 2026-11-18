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
  /** 掛機睡著：廣場／工寮都不出拳、不偷肉 */
  afk?: boolean;
};

/** 廣場內站著、走著、坐下都可以出拳；工寮則要正在剝蚵。掛機時暫停。 */
export function apoPunchAllowedFrom(s: ApoPunchGateInput): boolean {
  if (!s.play || s.tut || s.race || !s.isApo || s.mg || s.afk) return false;
  if (s.plaza && s.plazaActive) return true;
  return s.shucking;
}

/** 從掛機醒來時重設為完整 10 秒間隔，避免停在 PENDING 或立刻再出拳。 */
export function apoPunchTimerOnWake(wasAfk: boolean, afk: boolean, dueIn: number): number {
  if (wasAfk && !afk) return APO_PUNCH_INTERVAL;
  return dueIn;
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

/** 本機偷肉只看目標碗有沒有肉。伺服器回覆只做同步，slow／失敗都不能把偷到的肉拿掉。 */
export function plazaPunchLocalSteal(_r: { ok?: boolean; err?: string } | null | undefined, wantSteal: boolean): boolean {
  return !!wantSteal;
}

/** 廣場貓拳候選（純資料，方便單測） */
export type PlazaApoCand = {
  connId: string;
  pileId: number;
  count: number;
  dist2: number;
  isNpc?: boolean;
  phase?: string;
  carriedBy?: string;
  aber?: boolean;
};

function plazaApoBaseOk(t: PlazaApoCand, range2: number): boolean {
  return !!t.isNpc
    && t.phase !== 'moon'
    && !t.carriedBy
    && !t.aber
    && t.dist2 < range2;
}

/** 從名單裡隨機抽一個；有兩個以上時盡量不連續抽同一個。 */
export function pickRandomAvoidLast<T extends { connId: string }>(
  list: T[],
  lastId: string | null | undefined,
  rand: () => number = Math.random,
): T | null {
  if (!list.length) return null;
  const pool = list.length >= 2 && lastId
    ? list.filter((t) => t.connId !== lastId)
    : list;
  const use = pool.length ? pool : list;
  const i = Math.min(use.length - 1, Math.max(0, Math.floor(rand() * use.length)));
  return use[i];
}

/**
 * 廣場坐下剝蚵：同桌、範圍內、碗裡有肉的阿婆隨機抽；沒有帶肉的才改抽同桌空碗。
 * 連續出拳在兩個以上可選時，避免連打同一人。
 */
export function pickPlazaSeatedApoTarget<T extends PlazaApoCand>(
  list: T[],
  range2: number,
  pileId: number,
  lastId: string | null | undefined,
  rand: () => number = Math.random,
): T | null {
  const atTable = list.filter((t) => plazaApoBaseOk(t, range2) && t.pileId === pileId);
  const withMeat = atTable.filter((t) => t.count > 0);
  return pickRandomAvoidLast(withMeat.length ? withMeat : atTable, lastId, rand);
}

/** 廣場走著／站著：範圍內最近的阿婆（含空碗），行為維持原樣。 */
export function pickPlazaNearestApoTarget<T extends PlazaApoCand>(
  list: T[],
  range2: number,
): T | null {
  let best: T | null = null;
  let bestD = range2;
  for (const t of list) {
    if (!plazaApoBaseOk(t, range2)) continue;
    if (t.dist2 < bestD) { best = t; bestD = t.dist2; }
  }
  return best;
}
