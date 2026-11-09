/** 廣場外觀旗標：緊湊字串，例如 "goldSmoke,cushion,nameFrame"。舊伺服器沒這個欄位時當沒開。 */

export const GOLD_SMOKE_TINT = 0xc4a86a;

export type PlazaCosmetics = {
  goldSmoke: boolean;
  cushion: boolean;
  nameFrame: boolean;
};

export function parseCosmetics(raw?: string | null): PlazaCosmetics {
  const parts = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  const has = (key: string) => parts.includes(key) || parts.some(p => p.startsWith(`${key}:`));
  return {
    goldSmoke: parts.includes('goldSmoke'),
    cushion: has('cushion'),
    nameFrame: parts.includes('nameFrame'),
  };
}

export function encodeCosmetics(flags: PlazaCosmetics): string {
  const parts: string[] = [];
  if (flags.goldSmoke) parts.push('goldSmoke');
  if (flags.cushion) parts.push('cushion');
  if (flags.nameFrame) parts.push('nameFrame');
  return parts.join(',');
}
