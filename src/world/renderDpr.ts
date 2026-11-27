/**
 * 暫時拉高畫布解析度（錄高畫質影片用）：main.ts 的 resize() 會先看這裡。
 * setRenderDprBoost(null) 就馬上回到原本的（手機／省電上限）解析度。
 */
let boost: number | null = null;
let apply: (() => void) | null = null;
export function setRenderDprBoost(v: number | null) {
  boost = v != null && Number.isFinite(v) && v > 0 ? v : null;
  apply?.();
}
export const renderDprBoost = () => boost;
/** main.ts 註冊：倍率變了就重算畫布大小 */
export function onRenderDprChange(f: (() => void) | null) { apply = f; }
