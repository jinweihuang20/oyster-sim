/** 食材資料表：之後「蚵仔煎攤」與 50 種蚵仔煎圖鑑（5 主料 × 5 醬 × 加不加蛋）共用 */

export type FoodCat = 'base' | 'main' | 'extra' | 'egg' | 'sauce';
export type FoodIcon = 'oyster' | 'shrimp' | 'squid' | 'egg' | 'leaf' | 'sack' | 'bottle' | 'jar';
export type Food = {
  id: string; n: string; cat: FoodCat; icon: FoodIcon;
  /** 外觀色（之後煎出來的料／醬顏色也用這個） */
  color: string;
  /** 保存時數；0＝不會壞 */
  life: number;
  /** 雜貨店價格；沒有＝買不到 */
  price?: number;
  /** 有品質之分（一般／完整） */
  quality?: boolean;
  /** 尚未開放取得 */
  soon?: boolean;
  /** 怎麼拿到（顯示在食材頁） */
  how: string;
};

const H = 3600_000;
export const FOODS: Food[] = [
  // 基底（每份都要）
  { id: 'flour', n: '地瓜粉', cat: 'base', icon: 'sack', color: '#e9e4d8', life: 0, price: 15, how: '廣場食材攤購買，簽到第 7 天福袋也可能有' },
  { id: 'veg', n: '青菜', cat: 'base', icon: 'leaf', color: '#5fa84a', life: 72, price: 10, how: '廣場食材攤購買，簽到第 7 天福袋也可能有' },
  // 主料 5 種
  { id: 'oyster', n: '一般蚵仔', cat: 'main', icon: 'oyster', color: '#c9c2b0', life: 0, quality: true, how: '每剝一顆蚵仔肉進碗就多一個（不會壞）' },
  { id: 'bigoy', n: '大蚵', cat: 'main', icon: 'oyster', color: '#b8ad94', life: 48, soon: true, how: '即將開放' },
  { id: 'rockoy', n: '石蚵', cat: 'main', icon: 'oyster', color: '#8f8a7e', life: 48, soon: true, how: '即將開放' },
  { id: 'shrimp', n: '蝦仁', cat: 'extra', icon: 'shrimp', color: '#f19a8a', life: 48, how: '臉盆補蚵仔時，用掉的每顆都有機會撈到（自己撈、換位補盆、烤台自動補都算）' },
  { id: 'squid', n: '花枝', cat: 'extra', icon: 'squid', color: '#f3efe6', life: 48, how: '臉盆補蚵仔時，用掉的每顆都有機會撈到（自己撈、換位補盆、烤台自動補都算）' },
  // 蛋
  { id: 'egg', n: '雞蛋', cat: 'egg', icon: 'egg', color: '#f2c94c', life: 72, price: 8, how: '廣場食材攤購買，簽到第 7 天福袋也可能有' },
  // 醬料 5 種
  { id: 'sweet', n: '甜辣醬', cat: 'sauce', icon: 'bottle', color: '#e8708a', life: 0, price: 20, how: '廣場食材攤購買，簽到第 7 天福袋也可能有' },
  { id: 'garlic', n: '蒜蓉醬油膏', cat: 'sauce', icon: 'bottle', color: '#5a3a2a', life: 0, price: 20, how: '廣場食材攤購買，簽到第 7 天福袋也可能有' },
  { id: 'ketchup', n: '番茄醬', cat: 'sauce', icon: 'bottle', color: '#d8342c', life: 0, price: 35, how: '廣場食材攤購買' },
  { id: 'shacha', n: '沙茶醬', cat: 'sauce', icon: 'jar', color: '#b8662e', life: 0, price: 40, how: '廣場食材攤購買' },
  { id: 'amasauce', n: '阿婆祕傳醬', cat: 'sauce', icon: 'jar', color: '#d9a520', life: 0, how: '用殼丟中阿婆有機會掉落（廣場的阿婆也算）' },
];
export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map(f => [f.id, f]));
export const foodLifeMs = (f: Food) => f.life * H;

/** 圖鑑組合用：主料（一般蚵仔／大蚵／石蚵／蚵仔加蝦仁／蚵仔加花枝） */
export const RECIPE_MAINS: { id: string; n: string; need: string[] }[] = [
  { id: 'oy', n: '蚵仔', need: ['oyster'] },
  { id: 'big', n: '大蚵', need: ['bigoy'] },
  { id: 'rock', n: '石蚵', need: ['rockoy'] },
  { id: 'shrimp', n: '蚵仔蝦仁', need: ['oyster', 'shrimp'] },
  { id: 'squid', n: '蚵仔花枝', need: ['oyster', 'squid'] },
];
export const RECIPE_SAUCES = ['sweet', 'garlic', 'ketchup', 'shacha', 'amasauce'];
export const RECIPE_BASE = ['flour', 'veg'];
export const RECIPE_COUNT = RECIPE_MAINS.length * RECIPE_SAUCES.length * 2;

export const CAT_N: Record<FoodCat, string> = { base: '基底', main: '主料', extra: '配料', egg: '蛋', sauce: '醬料' };

/** 取得機率／數值（V1） */
export const FOOD_RATE = {
  /** 每顆從臉盆拿出來的蚵仔，補盆時各自擲一次蝦仁或花枝：依地點 home / wanggong / dongshi / budai；廣場（含烤台）另計 */
  scoop: { home: 0.12, wanggong: 0.14, dongshi: 0.16, budai: 0.18, plaza: 0.16 } as Record<string, number>,
  /** 撈到時是蝦仁的比例（其餘花枝） */
  shrimpShare: 0.6,
  /** 丟中阿婆掉祕傳醬 */
  amaSauce: 0.2,
  /** 簽到第 7 天食材福袋 3～5 份 */
  bagMin: 3, bagMax: 5,
  bagPool: ['flour', 'veg', 'egg', 'sweet', 'garlic'],
};

/** 線條圖示（24×24，stroke=currentColor） */
const ICON_PATH: Record<FoodIcon, string> = {
  oyster: '<path d="M4 13c0-5 4-8 8-8s8 3 8 8c0 3-3 6-8 6s-8-3-8-6z"/><path d="M8 13c1.5 1.5 6.5 1.5 8 0"/>',
  shrimp: '<path d="M18 6c-6-1-12 3-12 9 0 2.5 2 4 4 4"/><path d="M18 6c1 3-1 6-5 7"/><path d="M10 19l-3 2M10 19l-1 3"/>',
  squid: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3.5"/>',
  egg: '<path d="M12 3c-4 0-7 6-7 10.5A7 7 0 0 0 19 13.5C19 9 16 3 12 3z"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z"/><path d="M5 19l9-9"/>',
  sack: '<path d="M8 6h8l-1 3c3 2 5 5 5 8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3c0-3 2-6 5-8z"/><path d="M9 9h6"/>',
  bottle: '<path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z"/><path d="M8 13h8"/>',
  jar: '<path d="M7 6h10v3c2 1 2 2 2 4v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6c0-2 0-3 2-4z"/><path d="M6 4h12v2H6z"/>',
};
export const foodSvg = (f: Food, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATH[f.icon]}</svg>`;
