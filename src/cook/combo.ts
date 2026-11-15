/**
 * 蚵仔煎組合：16 配料組合 × 4 粉漿 × 2 蛋 × 3 熟度 × 6 醬 = 2,304 種。
 * id = ((((top × 4 + batter) × 2 + egg) × 3 + done) × 6 + sauce)；與後端 PlazaWorld.Cook.cs 範圍一致。
 */
export const TOPS = [
  { bit: 1, id: 'oy', n: '蚵仔', short: '蚵', food: ['oyster', 'bigoy', 'rockoy'] },
  { bit: 2, id: 'shrimp', n: '蝦仁', short: '蝦', food: ['shrimp'] },
  { bit: 4, id: 'squid', n: '花枝', short: '花枝', food: ['squid'] },
  { bit: 8, id: 'veg', n: '青菜', short: '青菜', food: ['veg'] },
] as const;
export const BATTERS = ['不加粉漿', '薄脆', '標準', '厚實'] as const;
export const EGGS = ['無蛋', '加蛋'] as const;
export const DONES = ['嫩', '金黃', '焦香'] as const;
/** 醬：0＝不加；其餘對應食材 id */
export const SAUCES = [
  { id: '', n: '不加醬', short: '' },
  { id: 'sweet', n: '甜辣醬', short: '甜辣' },
  { id: 'garlic', n: '蒜蓉醬油膏', short: '蒜蓉' },
  { id: 'ketchup', n: '番茄醬', short: '番茄' },
  { id: 'shacha', n: '沙茶醬', short: '沙茶' },
  { id: 'amasauce', n: '阿婆祕傳醬', short: '阿婆' },
] as const;
export const COMBO_TOTAL = 16 * 4 * 2 * 3 * 6;

export type Combo = { top: number; batter: number; egg: number; done: number; sauce: number };

export function comboId(c: Combo) {
  return ((((c.top & 15) * 4 + c.batter) * 2 + c.egg) * 3 + c.done) * 6 + c.sauce;
}
export function comboOf(id: number): Combo {
  let n = Math.max(0, Math.min(COMBO_TOTAL - 1, Math.floor(id)));
  const sauce = n % 6; n = Math.floor(n / 6);
  const done = n % 3; n = Math.floor(n / 3);
  const egg = n % 2; n = Math.floor(n / 2);
  const batter = n % 4; n = Math.floor(n / 4);
  return { top: n & 15, batter, egg, done, sauce };
}
export const validCombo = (id: unknown) => Number.isInteger(id) && (id as number) >= 0 && (id as number) < COMBO_TOTAL;

/** 隱藏款：特定組合有專屬名字 */
type Special = { n: string; desc: string; test: (c: Combo) => boolean };
const SPECIALS: Special[] = [
  { n: '空氣蚵仔煎', desc: '什麼都沒放，鏟起來只剩一縷香氣。', test: c => !c.top && !c.batter && !c.egg && !c.sauce },
  { n: '阿婆的味道', desc: '蚵仔、標準粉漿、加蛋煎到金黃，再淋上阿婆祕傳醬，跟記憶裡一模一樣。', test: c => c.top === 1 && c.batter === 2 && c.egg === 1 && c.done === 1 && c.sauce === 5 },
  { n: '經典夜市蚵仔煎', desc: '蚵仔、標準粉漿、加蛋、金黃、甜辣醬，夜市攤最常見的那一盤。', test: c => c.top === 1 && c.batter === 2 && c.egg === 1 && c.done === 1 && c.sauce === 1 },
  { n: '黑暗料理', desc: '所有配料、厚粉漿不加蛋，煎到焦香再擠番茄醬。勇氣可嘉。', test: c => c.top === 15 && c.batter === 3 && !c.egg && c.done === 2 && c.sauce === 3 },
  { n: '海陸大滿貫', desc: '蚵仔、蝦仁、花枝、青菜全上，加蛋煎到金黃配沙茶。', test: c => c.top === 15 && c.batter === 2 && c.egg === 1 && c.done === 1 && c.sauce === 4 },
  { n: '田園小清新', desc: '只放青菜、薄脆粉漿不加蛋，嫩煎配蒜蓉醬油膏。', test: c => c.top === 8 && c.batter === 1 && !c.egg && c.done === 0 && c.sauce === 2 },
];
export function specialOf(id: number): Special | null {
  const c = comboOf(id);
  return SPECIALS.find(s => s.test(c)) ?? null;
}
export const SPECIAL_IDS: number[] = (() => { const out: number[] = []; for (let i = 0; i < COMBO_TOTAL; i++) if (specialOf(i)) out.push(i); return out; })();

/** 配料組合名稱（0＝空） */
export function topName(top: number): string {
  const sea = TOPS.slice(0, 3).filter(t => top & t.bit);
  const veg = !!(top & 8);
  let s = '';
  if (sea.length === 1) s = sea[0].n;
  else if (sea.length === 2) s = sea[0].bit === 1 ? '蚵仔' + sea[1].short : sea.map(t => t.short).join('');
  else if (sea.length === 3) s = '三鮮';
  if (veg) s += sea.length ? '青菜' : '青菜';
  return s;
}

/** 自動命名，例：薄脆焦香沙茶花枝煎；不加粉漿走「炒」 */
export function comboName(id: number): string {
  const sp = specialOf(id); if (sp) return sp.n;
  const c = comboOf(id);
  const b = ['', '薄脆', '', '厚實'][c.batter];
  const d = DONES[c.done];
  const s = SAUCES[c.sauce].short;
  const t = topName(c.top);
  if (!c.batter) {
    if (!t) return `${d}${s}${c.egg ? '炒蛋' : '空鍋'}`;
    return `${d}${s}${c.egg ? '' : '無蛋'}炒${t}${c.egg ? '蛋' : ''}`;
  }
  return `${b}${d}${s}${c.egg ? '' : '無蛋'}${t || '粉漿'}煎`;
}

/** 特色清單（詳細頁） */
export function comboFeatures(id: number): string[] {
  const c = comboOf(id);
  const tops = TOPS.filter(t => c.top & t.bit).map(t => t.n);
  return [tops.length ? `配料：${tops.join('、')}` : '配料：無', `粉漿：${BATTERS[c.batter]}`, `蛋：${c.egg ? '有' : '無'}`, `熟度：${DONES[c.done]}`, `醬：${SAUCES[c.sauce].n}`];
}

/** 收集里程碑稱號 */
export const COOK_TITLES = [
  { n: 10, t: '煎台新手' },
  { n: 50, t: '熟練煎手' },
  { n: 100, t: '夜市名攤' },
  { n: 500, t: '蚵仔煎宗師' },
];
export function cookTitle(count: number) {
  let t = ''; for (const m of COOK_TITLES) if (count >= m.n) t = m.t; return t;
}
