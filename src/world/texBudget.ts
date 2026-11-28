/**
 * 貼圖預算（mobile.txt §4）：
 * - 手機長寬 ≤ 1024；小物件 256／512
 * - 盡量 2 的次方（mipmap／壓縮紋理友善）
 * - 檔案貼圖優先 KTX2（見 loadTex.ts）
 */

export const TEX_MAX = 1024;
export const TEX_MED = 512;
export const TEX_SMALL = 256;

export type TexKind = 'color' | 'small' | 'sign' | 'data';

/** 大於 0 時往上取最近的 2 的次方 */
export function potCeil(n: number): number {
  const x = Math.max(1, Math.ceil(n));
  let p = 1;
  while (p < x) p <<= 1;
  return p;
}

export function isPot(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** 依裝置／省電決定上限：手機≤1024；省電再壓到 512；小物件 256 */
export function texMaxSide(opts: { coarse?: boolean; eco?: boolean; kind?: TexKind } = {}): number {
  const kind = opts.kind ?? 'color';
  if (kind === 'small') return TEX_SMALL;
  if (opts.eco) return TEX_MED;
  if (opts.coarse) return TEX_MAX;
  if (kind === 'sign') return TEX_MAX;
  return TEX_MAX;
}

/** 把邊長夾在上限內並（預設）對齊 2 的次方 */
export function clampTexDim(n: number, maxSide: number, pot = true): number {
  const capped = Math.max(1, Math.min(maxSide, Math.floor(n)));
  return pot ? Math.min(maxSide, potCeil(capped)) : capped;
}

export type CanvasBudget = { width: number; height: number; maxSide: number };

/** 計算畫布應有的寬高（可選強制正方形） */
export function budgetCanvasSize(
  w: number,
  h: number,
  opts: { coarse?: boolean; eco?: boolean; kind?: TexKind; pot?: boolean; square?: boolean } = {},
): CanvasBudget {
  const maxSide = texMaxSide(opts);
  const pot = opts.pot !== false;
  if (opts.square) {
    const s = clampTexDim(Math.max(w, h), maxSide, pot);
    return { width: s, height: s, maxSide };
  }
  return {
    width: clampTexDim(w, maxSide, pot),
    height: clampTexDim(h, maxSide, pot),
    maxSide,
  };
}
