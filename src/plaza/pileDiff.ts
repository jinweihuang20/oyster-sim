/** 廣場蚵堆桌種：0綜合 1簡單 2一般 3困難；-1＝非剝蚵堆（移除／烤台／休閒） */

export const PILE_DIFF_MIXED = 0;
export const PILE_DIFF_EASY = 1;
export const PILE_DIFF_NORMAL = 2;
export const PILE_DIFF_HARD = 3;
export const PILE_DIFF_NONE = -1;

export const PILE_DIFF_NAMES = ['綜合', '簡單', '一般', '困難'] as const;

/** 對應 易／普通／硬／超硬 */
export const PILE_DIFF_WEIGHTS: readonly (readonly number[])[] = [
  [30, 40, 22, 8],
  [100, 0, 0, 0],
  [0, 100, 0, 0],
  [0, 0, 70, 30],
];

/** index = pileId，長度 16，與伺服器 PlazaWorld.PileDiffMap 對齊 */
export const DEFAULT_PILE_DIFFS: readonly number[] = [
  1, 0, 3, -1,
  0, 2, 1, -1,
  3, 0, 2, -1,
  -1, -1, -1, -1,
];

export function pileDiffOf(pileId: number, snapDiffs?: readonly number[] | null): number {
  if (pileId < 0 || pileId >= DEFAULT_PILE_DIFFS.length) return PILE_DIFF_NONE;
  const src = snapDiffs && snapDiffs.length >= DEFAULT_PILE_DIFFS.length ? snapDiffs : DEFAULT_PILE_DIFFS;
  const v = src[pileId];
  return typeof v === 'number' && Number.isFinite(v) ? (v | 0) : DEFAULT_PILE_DIFFS[pileId];
}

export function pileDiffName(kind: number): string | null {
  if (kind < 0 || kind >= PILE_DIFF_NAMES.length) return null;
  return PILE_DIFF_NAMES[kind];
}

export function weightsFor(kind: number): number[] {
  const k = kind >= 0 && kind < PILE_DIFF_WEIGHTS.length ? kind : PILE_DIFF_MIXED;
  return PILE_DIFF_WEIGHTS[k].slice();
}

export function parsePileDiffs(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length < DEFAULT_PILE_DIFFS.length) return DEFAULT_PILE_DIFFS.slice();
  const n = DEFAULT_PILE_DIFFS.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const v = Number(raw[i]);
    out[i] = Number.isFinite(v) ? (v | 0) : DEFAULT_PILE_DIFFS[i];
  }
  return out;
}
