/**
 * 蚵仔煎組合：64 配料組合 × 4 粉漿 × 2 蛋 × 3 熟度 × 6 醬 = 9,216 種。
 * id = ((((top × 4 + batter) × 2 + egg) × 3 + done) × 6 + sauce)；與後端 CookCombo、PlazaWorld.Cook 範圍一致。
 * top 用 6 個 bit（蚵仔／蝦仁／花枝／青菜／豬肉絲／韭菜）；新配料接在後面，舊 id 0–2303 仍是同一盤（新配料沒放）。
 */
export const TOPS = [
  { bit: 1, id: 'oy', n: '蚵仔', short: '蚵', food: ['oyster', 'bigoy', 'rockoy'] },
  { bit: 2, id: 'shrimp', n: '蝦仁', short: '蝦', food: ['shrimp'] },
  { bit: 4, id: 'squid', n: '花枝', short: '花枝', food: ['squid'] },
  { bit: 8, id: 'veg', n: '青菜', short: '青菜', food: ['veg'] },
  { bit: 16, id: 'pork', n: '豬肉絲', short: '肉絲', food: ['pork'] },
  { bit: 32, id: 'chive', n: '韭菜', short: '韭菜', food: ['chive'] },
] as const;
export const TOP_BITS = 6;
export const TOP_MASK = (1 << TOP_BITS) - 1; // 63
/** 加豬肉絲、韭菜之前的組合數；這些 id 的名字維持不變 */
export const OLD_COMBO_TOTAL = 16 * 4 * 2 * 3 * 6;
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
export const COMBO_TOTAL = (TOP_MASK + 1) * 4 * 2 * 3 * 6; // 9,216

export type Combo = { top: number; batter: number; egg: number; done: number; sauce: number };

export function comboId(c: Combo) {
  return ((((c.top & TOP_MASK) * 4 + c.batter) * 2 + c.egg) * 3 + c.done) * 6 + c.sauce;
}
/** 不認識的 id 回 null，不會钳成另一盤 */
export function comboOf(id: number): Combo | null {
  if (!Number.isInteger(id) || id < 0 || id >= COMBO_TOTAL) return null;
  let n = id;
  const sauce = n % 6; n = Math.floor(n / 6);
  const done = n % 3; n = Math.floor(n / 3);
  const egg = n % 2; n = Math.floor(n / 2);
  const batter = n % 4; n = Math.floor(n / 4);
  return { top: n & TOP_MASK, batter, egg, done, sauce };
}
export const validCombo = (id: unknown) => Number.isInteger(id) && (id as number) >= 0 && (id as number) < COMBO_TOTAL;
/** 這盤真的用到食材（配料、粉漿、蛋、醬至少一樣）；什麼都沒放的「空氣蚵仔煎」不算一盤 */
export function comboHasFood(id: number) {
  const c = comboOf(id);
  if (!c) return false;
  return !!(c.top || c.batter || c.egg || c.sauce);
}

/** 配料開了幾種（0～6） */
export const topKinds = (top: number) => [1, 2, 4, 8, 16, 32].filter(b => top & b).length;

/** 疊塔：5 種（含）以上配料，且粉漿是厚實。舊組合最多 4 種，不會被算進來。 */
export function isTower(c: Combo | number): boolean {
  const x = typeof c === 'number' ? comboOf(c) : c;
  return !!x && topKinds(x.top) >= 5 && x.batter === 3;
}

/** 出包款類型：笑臉鍋／裂開的焦香番茄／心形孤餅／散炒翻車 */
export type BlooperKind = 'egg' | 'ketchup' | 'lonely' | 'stirburn';
export function blooperOf(idOrCombo: number | Combo): BlooperKind | null {
  const c = typeof idOrCombo === 'number' ? comboOf(idOrCombo) : idOrCombo;
  if (!c) return null;
  if (topKinds(c.top) >= 5 && !c.batter && c.done === 2) return 'stirburn';
  if (!c.top && !c.batter && c.egg) return 'egg';
  if (c.done === 2 && c.sauce === 3 && !c.egg && c.batter <= 1) return 'ketchup';
  if (!c.top && c.batter === 3 && !c.sauce) return 'lonely';
  return null;
}
export const isBlooper = (id: number | Combo) => blooperOf(id) != null;

/** 隱藏款：特定組合有專屬名字 */
type Special = { n: string; desc: string; test: (c: Combo) => boolean };
const SPECIALS: Special[] = [
  { n: '空氣蚵仔煎', desc: '什麼都沒放，鏟起來只剩一縷香氣。', test: c => !c.top && !c.batter && !c.egg && !c.sauce },
  { n: '阿婆的味道', desc: '蚵仔、標準粉漿、加蛋煎到金黃，再淋上阿婆祕傳醬，跟記憶裡一模一樣。', test: c => c.top === 1 && c.batter === 2 && c.egg === 1 && c.done === 1 && c.sauce === 5 },
  { n: '經典夜市蚵仔煎', desc: '蚵仔、標準粉漿、加蛋、金黃、甜辣醬，夜市攤最常見的那一盤。', test: c => c.top === 1 && c.batter === 2 && c.egg === 1 && c.done === 1 && c.sauce === 1 },
  { n: '黑暗料理', desc: '所有配料、厚粉漿不加蛋，煎到焦香再擠番茄醬。勇氣可嘉。', test: c => c.top === 15 && c.batter === 3 && !c.egg && c.done === 2 && c.sauce === 3 },
  { n: '海陸大滿貫', desc: '蚵仔、蝦仁、花枝、青菜全上，加蛋煎到金黃配沙茶。', test: c => c.top === 15 && c.batter === 2 && c.egg === 1 && c.done === 1 && c.sauce === 4 },
  { n: '田園小清新', desc: '只放青菜、薄脆粉漿不加蛋，嫩煎配蒜蓉醬油膏。', test: c => c.top === 8 && c.batter === 1 && !c.egg && c.done === 0 && c.sauce === 2 },
  { n: '夜市全套', desc: '六種配料全上，標準粉漿加蛋煎到金黃，再淋阿婆祕傳醬。料多到蓋住餅。', test: c => c.top === 63 && c.batter === 2 && c.egg === 1 && c.done === 1 && c.sauce === 5 },
];
export function specialOf(id: number): Special | null {
  const c = comboOf(id);
  if (!c) return null;
  return SPECIALS.find(s => s.test(c)) ?? null;
}
export const SPECIAL_IDS: number[] = (() => { const out: number[] = []; for (let i = 0; i < COMBO_TOTAL; i++) if (specialOf(i)) out.push(i); return out; })();
export const TOWER_IDS: number[] = (() => { const out: number[] = []; for (let i = 0; i < COMBO_TOTAL; i++) if (isTower(i)) out.push(i); return out; })();
export const BLOOPER_IDS: number[] = (() => { const out: number[] = []; for (let i = 0; i < COMBO_TOTAL; i++) if (isBlooper(i)) out.push(i); return out; })();

/** 配料組合名稱（0＝空）。豬肉絲不算進「三鮮」；舊的 4 料組合用字跟以前一樣。 */
export function topName(top: number): string {
  const sea = TOPS.filter(t => t.bit <= 4 && (top & t.bit));
  const pork = !!(top & 16);
  const veg = !!(top & 8);
  const chive = !!(top & 32);
  let s = '';
  if (sea.length === 1) s = sea[0].n;
  else if (sea.length === 2) s = sea[0].bit === 1 ? '蚵仔' + sea[1].short : sea.map(t => t.short).join('');
  else if (sea.length === 3) s = '三鮮';
  if (pork) s += s ? '肉絲' : '豬肉絲';
  if (veg) s += '青菜';
  if (chive) s += '韭菜';
  return s;
}

/** 正常描述款命名，例：薄脆焦香沙茶花枝煎；不加粉漿走「炒」 */
function plainName(c: Combo): string {
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

/* ── 趣味命名：約一半的組合改用夜市風格的綽號，依 id 固定 ── */
const FUN_DONE = [
  ['半熟冒險家', '嫩到會發抖的', '剛剛好嫩嫩', '還在睡的', '軟綿綿'],
  ['金黃閃亮', '老闆最愛', '黃金比例', '標準好吃', '閃閃發光的'],
  ['焦香到阿婆搖頭', '炭烤風味（誤）', '焦脆有個性', '火力全開', '鍋巴系', '煎過頭的'],
];
const FUN_BATTER = [
  ['散裝', '沒有粉漿的勇氣', '自由奔放', '不受拘束'],
  ['薄脆到會唱歌的', '喀滋喀滋', '一咬就碎的', '薄如蟬翼'],
  ['中規中矩', '乖巧', '模範生', '不偏不倚'],
  ['厚到可以當枕頭的', '超有誠意', '份量爆表', '一口塞不下的'],
];
const FUN_EGG = [
  ['蛋去哪了', '沒蛋也很勇', '省蛋派'],
  ['蛋蛋加持', '雙倍蛋香', '蛋黃滿溢', '蛋包好包滿'],
];
const FUN_SAUCE = [
  ['清純原味', '素顏', '不沾醬派', '本色演出'],
  ['甜辣上頭', '甜辣派代表', '甜甜辣辣', '甜辣信徒'],
  ['蒜香撲鼻', '吸血鬼退散', '蒜你厲害', '醬油膏控'],
  ['番茄大亂入', '紅通通', '薯條醬誤用', '番茄派掌門'],
  ['沙茶狂熱', '沙茶上身', '沙茶控必點', '沙茶灌頂'],
  ['阿婆點頭認證', '阿婆祕傳', '巷口阿婆款', '阿婆說讚'],
];
const FUN_ANY = ['夜市排隊款', '深夜限定', '老闆私心', '考前續命', '下班犒賞', '隔壁攤都在看', '人氣爆棚', '期間限定', '傳說中的', '小吃界新星', '一吃就上癮', '心情不好也要吃'];

/** 配料的趣味主體（有粉漿時＝煎；沒粉漿＝炒/散裝） */
function funNouns(c: Combo): string[] {
  const t = topName(c.top);
  const n = [0, 1, 2, 3].filter(i => c.top & (1 << i)).length;
  if (!c.batter) {
    if (!t) return c.egg ? ['只有蛋的炒鍋', '蛋的獨角戲', '炒蛋而已'] : ['空鍋', '鍋子在發呆', '寂寞的鍋'];
    if (n === 4) return ['什麼都炒', '冰箱清空炒', '大鍋炒'];
    return [`炒${t}`, `${t}炒一炒`, `散裝${t}`];
  }
  if (!t) return ['蚵仔不見了煎', '只有粉的寂寞', '粉漿獨奏', '配料去哪了煎'];
  if (n === 4) return ['什麼都加大滿貫', '海陸雙霸全餐', '冰箱清空煎', '豪華吃到飽煎'];
  if (n === 3) return [`${t}煎`, `${t}豪華煎`, `${t}三重奏`, '三拼煎', '什錦煎', '綜合大拼盤'];
  return n === 2 ? [`${t}煎`, '雙拼煎', `${t}雙人組`] : [`${t}煎`, c.top === 1 ? '蚵蚵煎' : `${t}煎`];
}

/* ── 新配料（豬肉絲／韭菜）組合專用：獵奇但不離題，舊組合不會走到這裡 ── */
const WEIRD_DONE = [
  ['還沒睡醒的', '還在想事情的', '輕輕碰一下的', '像在做夢的'],
  ['自己發亮的', '剛好被看見的', '偷偷金黃的', '晒過太陽的'],
  ['差點走太遠的', '鍋邊說故事的', '帶著焦香迷路的', '火候有主意的'],
];
const WEIRD_BATTER = [
  ['不靠粉漿的', '赤腳上場的', '沒有粉漿也出場的'],
  ['薄到會飄的', '幾乎透明的', '一咬就唱歌的'],
  ['中間不說話的', '照舊路走的', '平平穩穩卻奇怪的'],
  ['厚得像在躲雨的', '一口會走很久的', '把自己疊起來的'],
];
const WEIRD_EGG = [
  ['蛋沒來也沒關係的', '空出蛋位子的', '把蛋位讓出來的'],
  ['蛋也湊一腳的', '蛋黃先到的', '帶著蛋香走來的'],
];
const WEIRD_SAUCE = [
  ['什麼醬都不肯沾的', '素顏出場的', '原味自己走的'],
  ['被甜辣點名的', '甜辣在後面追的', '甜辣自己跟上的'],
  ['蒜香先到一步的', '蒜蓉自己飄來的', '醬油膏來作伴的'],
  ['番茄路過留下的', '紅紅的跟來的', '番茄突然出現的'],
  ['沙茶自己坐下的', '沙茶從旁邊靠過來的', '被沙茶認親的'],
  ['阿婆也點頭的', '祕傳醬悄悄淋上的', '巷口才會遇見的'],
];
const WEIRD_ANY = [
  '地圖沒標的', '快收攤才有的', '夢裡見過的', '隔壁一直看的', '以為點錯的',
  '風大才出現的', '月光下的', '會自己排隊的', '差點被吹走的', '像在說故事的',
  '突然出現的', '不太記得的', '坐錯位子的', '星期三才有的',
];

/** 獵奇主體：一定看得出有肉絲或韭菜，其它配料也會寫進去 */
function weirdNouns(c: Combo): string[] {
  const t = topName(c.top);
  const pork = !!(c.top & 16), chive = !!(c.top & 32);
  const fry = c.batter ? '煎' : '炒';
  const out: string[] = [];
  if (t) {
    out.push(c.batter ? `${t}煎` : `炒${t}`);
    if (c.egg && !c.batter) out.push(`炒${t}蛋`);
  }
  if (pork && chive) {
    const rest = topName(c.top & ~48); // 扣掉肉絲、韭菜後剩下的
    out.push('肉絲牽韭菜' + fry, '韭菜帶肉絲' + fry, '肉絲韭菜' + fry);
    if (rest) out.push(rest + '肉絲韭菜' + fry);
  } else if (pork) {
    const rest = topName(c.top & ~16);
    out.push('迷路肉絲' + fry, '一縷肉絲' + fry, '走進鍋裡的肉絲');
    if (rest) out.push(rest + '肉絲' + fry);
  } else if (chive) {
    const rest = topName(c.top & ~32);
    out.push('站起來的韭菜' + fry, '風裡的韭菜' + fry, '夜行韭菜' + fry);
    if (rest) out.push(rest + '韭菜' + fry);
  }
  if ((c.top & 63) === 63) out.push('六料全翻出來' + fry, '鍋裡都擠滿了');
  return out.length ? out : [t ? t + fry : fry];
}

const TOWER_ADJ = [
  '搖搖欲墜的', '自己疊高的', '差點就倒的', '比頭還高的', '歪一邊的',
  '層層加碼的', '快碰到燈的', '用意志力站著的', '越疊越歪的', '風一吹會晃的',
];
function towerNouns(c: Combo): string[] {
  const t = topName(c.top);
  const out = [`${t}塔`, `疊起來的${t}`, `${t}高塔`];
  if (topKinds(c.top) === 6) out.push('六料高塔', '全料疊疊塔');
  else out.push('五料高塔', '差不多要封頂的塔');
  if (c.top & 32) out.push('韭菜在最上面的塔');
  if (c.top & 16) out.push('肉絲撐住的塔');
  return out;
}

const BLOOPER_ADJ: Record<BlooperKind, string[]> = {
  egg: ['只有蛋還很認真的', '空鍋裡的', '自己變成臉的'],
  ketchup: ['番茄來蓋焦的', '這個顏色不在計畫裡的', '焦香遇上番茄的', '翻車後還淋一筆的'],
  lonely: ['只有粉在場的', '沒有配料的厚餅', '自己站著的'],
  stirburn: ['全翻出來卻焦了的', '火候自己作主的', '散炒走太遠的', '差點收不回來的'],
};
function blooperNouns(c: Combo, k: BlooperKind): string[] {
  const t = topName(c.top);
  const fry = c.batter ? '煎' : '炒';
  if (k === 'egg') return ['炒蛋臉', '只有蛋的鍋', '蛋的獨角戲'];
  if (k === 'lonely') return ['厚實孤餅', '沒有配料的粉漿煎', '寂寞厚餅'];
  if (k === 'ketchup') return t ? [`焦香番茄${t}${fry}`, `番茄翻車${t}`, `${t}焦了還淋番茄`] : ['焦香番茄翻車', '番茄來救場的鍋'];
  return t ? [`散炒翻車的${t}`, `走太遠的${t}炒`, `${t}焦了`] : ['散炒翻車'];
}

/** 整數雜湊：同 id 永遠同結果 */
function hash(x: number) {
  x = Math.imul(x ^ 0x5bd1e995, 0x9e3779b1); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13;
  return x >>> 0;
}
function shuffle<T>(a: T[], seed: number): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) { seed = hash(seed + i); const j = seed % (i + 1); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

function pickName(c: Combo, h: number, nouns: string[], adjs: string[], used: Set<string>, maxes: number[]): string {
  const A = shuffle(adjs, h), N = shuffle(nouns, h >>> 7);
  let name = '';
  for (const max of maxes) {
    for (const a of A) {
      for (const n of N) {
        const cand = a + n;
        if ([...cand].length <= max && !used.has(cand)) { name = cand; break; }
      }
      if (name) break;
    }
    if (name) break;
  }
  return name;
}

let NAMES: string[] | null = null;
function buildNames(): string[] {
  const out: string[] = new Array(COMBO_TOTAL);
  const used = new Set<string>();
  const fun: number[] = [];
  const weird: number[] = [];
  const tower: number[] = [];
  const blooper: number[] = [];
  for (let i = 0; i < COMBO_TOTAL; i++) {
    const sp = specialOf(i);
    if (sp) { out[i] = sp.n; used.add(sp.n); continue; }
    const c = comboOf(i)!;
    if (isTower(c)) { tower.push(i); continue; }
    const bk = blooperOf(c);
    if (bk && i >= OLD_COMBO_TOTAL) { blooper.push(i); continue; } // 舊組合名稱不變，只掛出包標
    if (c.top & 48) { weird.push(i); continue; } // 有豬肉絲或韭菜：稍後走獵奇名，不影響舊組合
    if (hash(i * 7 + 3) % 2 || [...plainName(c)].length >= 13) fun.push(i);
    else { out[i] = plainName(c); used.add(out[i]); }
  }
  for (const i of fun) {
    const c = comboOf(i)!, h = hash(i);
    // 最搶眼的特色優先：焦／嫩、沒粉漿／厚／薄、阿婆／沙茶等
    const adjs = [...FUN_DONE[c.done], ...FUN_BATTER[c.batter], ...FUN_EGG[c.egg], ...FUN_SAUCE[c.sauce], ...FUN_ANY.filter((_, k) => (h >>> k) & 1)];
    const name = pickName(c, h, funNouns(c), adjs, used, [10, 12]);
    out[i] = name || plainName(c);
    used.add(out[i]);
  }
  for (const i of tower) {
    const c = comboOf(i)!, h = hash(i);
    const name = pickName(c, h, towerNouns(c), [...TOWER_ADJ, ...WEIRD_ANY.filter((_, k) => (h >>> k) & 1)], used, [10, 12, 14]);
    out[i] = name || (topName(c.top) + '塔');
    used.add(out[i]);
  }
  for (const i of blooper) {
    const c = comboOf(i)!, k = blooperOf(c)!, h = hash(i);
    const name = pickName(c, h, blooperNouns(c, k), BLOOPER_ADJ[k], used, [10, 12, 14]);
    out[i] = name || blooperNouns(c, k)[0];
    used.add(out[i]);
  }
  for (const i of weird) {
    const c = comboOf(i)!, h = hash(i);
    const adjs = [...WEIRD_DONE[c.done], ...WEIRD_BATTER[c.batter], ...WEIRD_EGG[c.egg], ...WEIRD_SAUCE[c.sauce], ...WEIRD_ANY.filter((_, k) => (h >>> k) & 1)];
    const name = pickName(c, h, weirdNouns(c), adjs, used, [10, 12, 14]);
    out[i] = name || plainName(c);
    used.add(out[i]);
  }
  return out;
}

/** 蚵仔煎名稱：隱藏款用專屬名；舊組合維持原名；有豬肉絲或韭菜的走獵奇綽號（依 id 固定、不重複） */
export function comboName(id: number): string {
  if (!validCombo(id)) return '';
  const sp = specialOf(id); if (sp) return sp.n;
  if (!NAMES) NAMES = buildNames();
  return NAMES[id];
}

/** 特色清單（詳細頁） */
export function comboFeatures(id: number): string[] {
  const c = comboOf(id);
  if (!c) return [];
  const tops = TOPS.filter(t => c.top & t.bit).map(t => t.n);
  return [tops.length ? `配料：${tops.join('、')}` : '配料：無', `粉漿：${BATTERS[c.batter]}`, `蛋：${c.egg ? '有' : '無'}`, `熟度：${DONES[c.done]}`, `醬：${SAUCES[c.sauce].n}`];
}

/** 完成畫面的中二一句；依 id 固定，會對上這盤真正有的料 */
export function comboComment(id: number): string {
  const c = comboOf(id);
  if (!c) return '';
  const h = hash(id * 13 + 9);
  const t = topName(c.top);
  const tower = isTower(c);
  const bk = blooperOf(c);
  const lines: string[] = [];
  if (tower) {
    lines.push(
      t ? `看哪，${t}一層層向上，這是敢挑戰煎台天空的意志！` : '層層堆疊，只為觸及這口鍋的極限！',
      '搖晃又如何，這座塔以熱油為地基，絕不輕易倒下！',
      '厚實粉漿築成高塔，配料們在頂端俯視凡間的平底鍋。',
    );
  } else if (bk === 'egg') {
    lines.push('空鍋之中，一枚蛋覺醒了自己的顏面。', '沒有配料又如何，這張蛋臉已經準備好迎接命運。', '這不是疏忽，這是蛋的獨角舞台。');
  } else if (bk === 'ketchup') {
    lines.push(t ? `焦香與番茄在${t}之上締結了無人預料的契約！` : '焦與紅的契約已成，這盤走出了自己的路。', '有人說這是翻車，我說這是新的傳說起點。', '火候走得稍遠，番茄挺身蓋上最後一章。');
  } else if (bk === 'lonely') {
    lines.push('沒有配料的厚實粉漿，正以孤高的姿態站在盤中央。', '這餅不靠任何配料，只靠自己的厚度活著。', '萬籟俱寂，只剩一張厚餅在呼吸。');
  } else if (bk === 'stirburn') {
    lines.push(t ? `${t}全數出擊，可惜火候先一步走遠了。` : '全軍出擊之後，焦香成為了最後的旗幟。', '這不是失敗，這是散炒走向極限的證明。', '鍋裡風雲變色，配料們仍未放棄自己的位置。');
  }
  if (!lines.length) {
    if (c.top & 1) lines.push('這顆蚵仔自深海而來，只為在這一盤完成宿命！', '蚵仔入鍋的瞬間，夜市的傳說又寫下下一行。');
    if (c.top & 2) lines.push('蝦仁躍入陣中，為這盤加上一抹珊瑚的勇氣。');
    if (c.top & 4) lines.push('花枝圈轉啊轉，旋轉之間已看穿這口鍋的命運。');
    if (c.top & 8) lines.push('青菜不是陪襯，是這盤心臟最綠的部分。');
    if (c.top & 16) lines.push('豬肉絲以纏繞之姿，把整盤的氣勢綁在一起！', '一縷肉絲穿越粉漿，宛如暗夜的絲線。');
    if (c.top & 32) lines.push('韭菜直指蒼天，宣告這盤的意志不可動搖！', '一把韭菜站了起來，那是覺醒的信號。');
    if (!c.top) lines.push('沒有配料又怎樣，這盤靠氣勢就能站上煎台！');
    if (c.batter === 1) lines.push('薄如蟬翼的粉漿，是刀刃也切不開的決心。');
    if (c.batter === 3) lines.push('厚實粉漿墊底，這盤已有王者的根基。');
    if (!c.batter && c.top) lines.push('不靠粉漿，只靠真本事在鍋裡走出自己的路。');
    if (c.egg) lines.push('蛋黃降臨，為這場戰鬥覆上一層金色的加護。');
    if (c.done === 0) lines.push('火候尚在低語，嫩意裡藏著還沒說完的故事。');
    if (c.done === 1) lines.push('金黃時刻已到，這一盤正在發光。');
    if (c.done === 2) lines.push('焦香是火焰留下的簽名，勇者才敢收下。');
    if (c.sauce === 5) lines.push('阿婆祕傳醬加身，這盤已得到巷口的祝福。');
    if (c.sauce === 4) lines.push('沙茶降臨，整盤都被這股熱意點名了。');
    if (c.sauce === 1) lines.push('甜辣在舌尖展開旗幟，這是夜市正統的宣告。');
    if (!lines.length) lines.push('這一盤已準備好，走向屬於自己的傳說。');
  }
  return lines[h % lines.length];
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
