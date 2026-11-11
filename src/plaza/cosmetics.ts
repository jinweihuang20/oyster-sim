/** 廣場外觀旗標：緊湊字串，例如 "goldSmoke,cushion,nameFrame"。舊伺服器沒這個欄位時當沒開。 */

export const GOLD_SMOKE_TINT = 0xc4a86a;

export type PlazaCosmetics = {
  goldSmoke: boolean;
  cushion: boolean;
  nameFrame: boolean;
  /** 寵物 id，例如 'pt_oyster_baby'；沒帶寵物為空字串 */
  pet: string;
};

export function parseCosmetics(raw?: string | null): PlazaCosmetics {
  const parts = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  const has = (key: string) => parts.includes(key) || parts.some(p => p.startsWith(`${key}:`));
  const valueOf = (key: string): string => {
    const p = parts.find(x => x.startsWith(`${key}:`));
    return p ? p.slice(key.length + 1) : '';
  };
  return {
    goldSmoke: parts.includes('goldSmoke'),
    cushion: has('cushion'),
    nameFrame: parts.includes('nameFrame'),
    pet: valueOf('pet'),
  };
}

export function encodeCosmetics(flags: PlazaCosmetics): string {
  const parts: string[] = [];
  if (flags.goldSmoke) parts.push('goldSmoke');
  if (flags.cushion) parts.push('cushion');
  if (flags.nameFrame) parts.push('nameFrame');
  if (flags.pet) parts.push(`pet:${flags.pet}`);
  return parts.join(',');
}
