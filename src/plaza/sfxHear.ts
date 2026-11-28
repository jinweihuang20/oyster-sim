/**
 * 廣場／外海同步音效可聽範圍。
 * 視覺靠霧裁；音效另加硬上限，避免海上霧拉到 130m 時岸上丟殼／機關槍還聽得到。
 */

/** 同步音效硬上限（公尺）；不超過目前霧遠平面 */
export const PLAZA_SFX_HEAR_CAP = 52;

export function plazaSfxHearR(fogFar: number): number {
  if (!(fogFar > 0) || !Number.isFinite(fogFar)) return PLAZA_SFX_HEAR_CAP;
  return Math.min(fogFar, PLAZA_SFX_HEAR_CAP);
}

/** 來源相對聽者是否在可聽範圍內 */
export function plazaSfxAudible(
  sx: number,
  sz: number,
  lx: number,
  lz: number,
  fogFar: number,
): boolean {
  if (![sx, sz, lx, lz].every(Number.isFinite)) return false;
  return Math.hypot(sx - lx, sz - lz) <= plazaSfxHearR(fogFar);
}
