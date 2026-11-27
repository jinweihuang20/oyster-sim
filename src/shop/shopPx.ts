/**
 * 雜貨店售價（純邏輯，方便測試）：伺服器 /s/shop/prices 回的 items（key＝商品 key，例如 'item-fishRodLure'、'item-rackKit'）。
 * 有效（price > 0、特價沒過期）就用伺服器的 price；特價過期就回到後台改的標價 base；伺服器沒有這樣東西就用遊戲內建價格。
 */
export type ShopPx = { price: number; base: number; sale?: boolean; endsAt?: number | null };

export function pxLiveIn(map: Record<string, ShopPx>, k: string, now: number): ShopPx | null {
  const p = map[k];
  return p && p.price > 0 && !(p.endsAt && now >= p.endsAt) ? p : null;
}

export function pxIn(map: Record<string, ShopPx>, k: string, base: number, now: number): number {
  const p = pxLiveIn(map, k, now); if (p) return p.price;
  const q = map[k]; return q && q.base > 0 ? q.base : base;
}
