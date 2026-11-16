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

let NAMES: string[] | null = null;
function buildNames(): string[] {
  const out: string[] = new Array(COMBO_TOTAL);
  const used = new Set<string>();
  const fun: number[] = [];
  for (let i = 0; i < COMBO_TOTAL; i++) {
    const sp = specialOf(i);
    if (sp) { out[i] = sp.n; used.add(sp.n); continue; }
    if (hash(i * 7 + 3) % 2 || [...plainName(comboOf(i))].length >= 13) fun.push(i); // 太長的正常名也改綽號
    else { out[i] = plainName(comboOf(i)); used.add(out[i]); }
  }
  for (const i of fun) {
    const c = comboOf(i), h = hash(i);
    // 最搶眼的特色優先：焦/嫩、沒粉漿/厚/薄、阿婆/沙茶等
    const adjs = shuffle([...FUN_DONE[c.done], ...FUN_BATTER[c.batter], ...FUN_EGG[c.egg], ...FUN_SAUCE[c.sauce], ...FUN_ANY.filter((_, k) => (h >>> k) & 1)], h);
    const nouns = shuffle(funNouns(c), h >>> 7);
    let name = '';
    for (const max of [10, 12]) { // 先找 10 字內，放得進圖鑑格兩行
      for (const a of adjs) {
        for (const n of nouns) {
          const cand = a + n;
          if ([...cand].length <= max && !used.has(cand)) { name = cand; break; }
        }
        if (name) break;
      }
      if (name) break;
    }
    if (!name) name = plainName(c);
    out[i] = name; used.add(name);
  }
  return out;
}

/** 蚵仔煎名稱：隱藏款用專屬名，其餘約一半正常描述、一半趣味綽號（依 id 固定、不重複） */
export function comboName(id: number): string {
  const sp = specialOf(id); if (sp) return sp.n;
  if (!NAMES) NAMES = buildNames();
  return NAMES[Math.max(0, Math.min(COMBO_TOTAL - 1, Math.floor(id)))];
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
