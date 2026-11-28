/**
 * 廣場霧裁剪：物件／整區被線性霧「完全蓋住」（距離 ≥ fog.far）就不畫，靠近再恢復。
 * 遲滯避免在霧遠平面來回抖動。
 */

/** 進出霧遠平面的緩衝（公尺） */
export const FOG_CULL_HYST = 4;

/**
 * 目前要不要藏：wasHidden＝上一幀狀態。
 * 出現條件：dist ≤ fogFar − hyst；消失條件：dist ≥ fogFar ＋ hyst。
 */
export function fogCullHidden(
  dist: number,
  fogFar: number,
  wasHidden: boolean,
  hyst = FOG_CULL_HYST,
): boolean {
  if (!Number.isFinite(dist) || !Number.isFinite(fogFar) || fogFar <= 0) return false;
  const h = Math.max(0, hyst);
  return wasHidden ? dist > fogFar - h : dist > fogFar + h;
}

/** 無遲滯：單次判斷距離是否已超出霧遠平面（蚵棚／船這幀 skip 用） */
export function beyondFogFar(dist: number, fogFar: number): boolean {
  return Number.isFinite(dist) && Number.isFinite(fogFar) && fogFar > 0 && dist > fogFar;
}

/** 這幀實際可用的繪製半徑：不可超過霧遠平面（再加一點餘裕也沒意義） */
export function fogDrawRange(viewR: number, fogFar: number): number {
  if (!(fogFar > 0)) return viewR;
  if (!(viewR > 0)) return fogFar;
  return Math.min(viewR, fogFar);
}

/** 廣場霧裁焦點：中央棚附近；用鏡頭到此點的距離判斷整座廣場要不要畫 */
export const PLAZA_FOG_FOCUS = { x: 0, z: 0 } as const;

export function distToPlazaFogFocus(x: number, z: number): number {
  return Math.hypot(x - PLAZA_FOG_FOCUS.x, z - PLAZA_FOG_FOCUS.z);
}
