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
/** 這盤真的用到食材（配料、粉漿、蛋、醬至少一樣）；什麼都沒放的「空氣蚵仔煎」不算一盤 */
export function comboHasFood(id: number) {
  if (!validCombo(id)) return false;
  const c = comboOf(id);
  return !!(c.top || c.batter || c.egg || c.sauce);
}

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

/** 配料組合名稱（0＝空）。兩種海鮮用簡稱相連，例如蚵蝦。 */
export function topName(top: number): string {
  const sea = TOPS.slice(0, 3).filter(t => top & t.bit);
  const veg = !!(top & 8);
  let s = '';
  if (sea.length === 1) s = sea[0].n;
  else if (sea.length === 2) s = sea.map(t => t.short).join('');
  else if (sea.length === 3) s = '三鮮';
  if (veg) s += '青菜';
  return s;
}

export const NAME_SLOTS = ['batter', 'done', 'top', 'sauce', 'egg'] as const;
export type NameSlot = typeof NAME_SLOTS[number];
export type RevealLevel = 'full' | 'first' | 'related' | 'unknown';

/** 各欄位用在名稱裡的短詞，每個條件對上一個位置 */
export function comboParts(c: Combo): Record<NameSlot, string> {
  return {
    batter: ['無粉', '薄脆', '標準', '厚實'][c.batter],
    done: DONES[c.done],
    top: topName(c.top) || '不放配料',
    sauce: ['原味', '甜辣', '蒜蓉', '番茄', '沙茶', '阿婆'][c.sauce],
    egg: c.egg ? '加蛋' : '無蛋',
  };
}

/** 依揭開的欄位組名；沒揭開的位置用 ○。例：薄脆金黃・蚵蝦・沙茶加蛋煎 */
export function formatComboName(c: Combo, slots?: ReadonlySet<NameSlot> | NameSlot[]): string {
  const show = slots ? new Set(slots) : new Set(NAME_SLOTS);
  const p = comboParts(c);
  const tok = (s: NameSlot) => show.has(s) ? p[s] : '○';
  return `${tok('batter')}${tok('done')}・${tok('top')}・${tok('sauce')}${tok('egg')}煎`;
}

/** 整數雜湊：同 id 永遠同結果（全服首創揭開時固定藏哪一欄） */
function hash(x: number) {
  x = Math.imul(x ^ 0x5bd1e995, 0x9e3779b1); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13;
  return x >>> 0;
}

/** 這層揭開哪些欄位。full＝全開；first＝五欄揭四欄；related＝只揭配料；unknown＝全藏。 */
export function revealedSlots(id: number, level: RevealLevel): Set<NameSlot> {
  if (level === 'full') return new Set(NAME_SLOTS);
  if (level === 'related') return new Set<NameSlot>(['top']);
  if (level === 'first') {
    const hide = NAME_SLOTS[hash(id) % NAME_SLOTS.length];
    return new Set(NAME_SLOTS.filter(s => s !== hide));
  }
  return new Set();
}

/**
 * 圖鑑顯示用名稱。隱藏款未親自煎過一律只顯示「？」；已煎過用專屬名。
 * 其餘依揭開層級組名，完全沒揭開時為「？」。
 */
export function comboLabel(id: number, level: RevealLevel = 'full'): string {
  if (!validCombo(id)) return '？';
  const sp = specialOf(id);
  if (sp) return level === 'full' ? sp.n : '？';
  if (level === 'unknown') return '？';
  return formatComboName(comboOf(id), revealedSlots(id, level));
}

/** 起鍋、廣播、展示用的完整名稱（隱藏款用專屬名，其餘由食材欄位組成） */
export function comboName(id: number): string {
  return comboLabel(id, 'full');
}

/** 特色清單（詳細頁）。可只列出已揭開的欄位，其餘為 ○。 */
export function comboFeatures(id: number, slots?: ReadonlySet<NameSlot> | NameSlot[]): string[] {
  const c = comboOf(id);
  const show = slots ? new Set(slots) : new Set(NAME_SLOTS);
  const tops = TOPS.filter(t => c.top & t.bit).map(t => t.n);
  const topTxt = tops.length ? tops.join('、') : '無';
  return [
    `粉漿：${show.has('batter') ? BATTERS[c.batter] : '○'}`,
    `熟度：${show.has('done') ? DONES[c.done] : '○'}`,
    `配料：${show.has('top') ? topTxt : '○'}`,
    `醬：${show.has('sauce') ? SAUCES[c.sauce].n : '○'}`,
    `蛋：${show.has('egg') ? (c.egg ? '有' : '無') : '○'}`,
  ];
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
