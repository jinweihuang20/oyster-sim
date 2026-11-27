/**
 * 釣魚提示（雜貨店「釣具」、釣魚「換餌」、魚類圖鑑共用）：每種餌／假魚適合的水層、釣法和代表目標魚；
 * 圖鑑沒釣過的魚顯示「出沒線索」、釣過的魚顯示「推薦假餌／餌料」。
 *
 * 全部照伺服器 StatsServer/Plaza/PlazaWorld.Fish.cs 的判定算（不要自己猜）：
 * - FISH_TAGS＝FishTable 每種魚的 Tags
 * - ITEM_LIKES＝FishLikes：每種餌／假魚本身吸引的標籤（不含拖釣、蚵棚、深水、夜晚這些狀況）
 * - LURE_FAV＝FishLureFav：假魚特別對味的魚（權重 +4）
 * - BIG_LURES＝FishBigLures（傳說、巨物比較多）、SQUID_LURES＝FishSquidLures（其他假魚釣頭足類 ×0.3）
 * - 木蝦（egi）FishGiantPct＝0：釣不到巨物
 * 伺服器改了這幾張表，這裡要跟著改（fishHints.test.ts 會在旁邊有伺服器原始碼時自動比對）。
 */
import { FISH, LURE_KEYS, TROLL_LURES, ITEM_NAME, type ItemKey, type LureKey, type BaitKey } from './fishLogic';
import { FISH_SPECIES } from './fishModel';

export type FishTag = 'float' | 'pred' | 'deep' | 'bottom' | 'surf' | 'troll' | 'night' | 'rack' | 'squid' | 'giant';

/** 伺服器 FishTable 的 Tags（id → 標籤） */
export const FISH_TAGS: Readonly<Record<string, readonly FishTag[]>> = {
  kurodai: ['float', 'rack'], kisu: ['float'], aigo: ['float', 'rack'], aji: ['float', 'pred'], hata: ['bottom', 'rack'], isaki: ['float', 'night'],
  tachiuo: ['night', 'pred'], suzuki: ['pred', 'surf'], katsuo: ['troll', 'deep', 'pred'], kanpachi: ['troll', 'deep'], torahata: ['bottom', 'rack'], shiira: ['surf', 'troll'],
  gt: ['surf', 'pred', 'deep'], tamakai: ['bottom', 'deep'], kajiki: ['troll', 'deep'], maguro: ['deep', 'troll', 'night'],
  sawara: ['pred', 'surf', 'troll'], sugi: ['deep', 'bottom', 'pred'], aoriika: ['squid', 'rack', 'night'], kouika: ['squid', 'bottom', 'rack'],
  kurokajiki: ['troll', 'deep', 'surf'], mebachi: ['deep', 'troll', 'night'],
  shumoku: ['giant', 'deep', 'troll'], manbou: ['giant', 'surf', 'deep'],
  hanguoyu: ['float', 'rack'],
  madai: ['float', 'bottom', 'deep'], bora: ['float', 'rack', 'surf'], fugu: ['float', 'bottom', 'rack'],
  akahata: ['bottom', 'rack', 'deep'], hirame: ['bottom', 'pred'], kamasu: ['pred', 'deep', 'troll'], tako: ['squid', 'bottom', 'rack'],
  ei: ['bottom', 'deep', 'night'], ryugu: ['deep', 'night', 'pred'],
  manta: ['giant', 'surf', 'troll', 'deep'], jinbei: ['giant', 'surf', 'troll'], daiouika: ['squid', 'giant', 'deep', 'night'],
};

/** 伺服器 FishLikes：餌／假魚本身吸引的標籤（垂釣竿另外再加 float） */
export const ITEM_LIKES: Readonly<Record<ItemKey, readonly FishTag[]>> = {
  minnow: ['pred'], jig: ['deep'], soft: ['bottom'], popper: ['surf'], stickbait: ['surf', 'pred'], trollskirt: ['troll'],
  slowjig: ['deep', 'bottom'], egi: ['squid', 'bottom'], vib: ['pred', 'deep'], tairubber: ['bottom', 'deep'], deepcrank: ['pred', 'bottom'],
  squidjig: ['squid', 'night'], worm: ['bottom'], squid: ['night'], oyster: [], shrimp: [],
};

/** 伺服器 FishLureFav：假魚特別對味的魚 */
export const LURE_FAV: Readonly<Partial<Record<LureKey, readonly string[]>>> = {
  stickbait: ['gt', 'shiira', 'sawara', 'kurokajiki', 'mebachi', 'shumoku', 'manta'],
  trollskirt: ['kurokajiki', 'kajiki', 'shiira', 'maguro', 'mebachi', 'shumoku', 'jinbei'],
  slowjig: ['tamakai', 'torahata', 'kanpachi', 'sugi', 'mebachi', 'manbou', 'shumoku', 'jinbei'],
  egi: ['aoriika', 'kouika', 'tako'],
  vib: ['kamasu', 'kanpachi', 'sawara', 'katsuo', 'suzuki', 'ryugu', 'gt', 'aji', 'manta'],
  tairubber: ['madai', 'hirame', 'akahata', 'torahata', 'tamakai', 'ei', 'fugu', 'hata'],
  deepcrank: ['madai', 'suzuki', 'akahata', 'bora', 'torahata', 'kamasu', 'shiira', 'ei'],
  squidjig: ['tachiuo', 'tako', 'aoriika', 'kouika', 'daiouika', 'ryugu', 'madai'],
};
export const BIG_LURES: readonly LureKey[] = ['stickbait', 'trollskirt', 'slowjig'];
export const SQUID_LURES: readonly LureKey[] = ['egi', 'squidjig'];
const BAIT_KEYS: readonly BaitKey[] = ['oyster', 'shrimp', 'worm', 'squid'];
const isBait = (k: ItemKey): k is BaitKey => (BAIT_KEYS as readonly string[]).includes(k);

const spOf = (id: string) => FISH_SPECIES.find(s => s.id === id);
const hasTag = (id: string, t: FishTag) => (FISH_TAGS[id] ?? []).includes(t);

/**
 * 這個餌／假魚對這條魚有多對味（只看餌料本身，跟伺服器 FishWeights 同算法）：
 * 1 ＋ 2×符合的標籤（垂釣多一個 float）＋ 對味魚 4；頭足類被木蝦／小透抽軟餌以外的假魚 ×0.3；木蝦遇到巨物＝0。
 * 另外加一點點（不影響「有沒有對味」）反映伺服器稀有度加成：進階大物路亞對傳說／巨物 +1。
 */
export function itemScore(item: ItemKey, sp: string): number {
  const tags = FISH_TAGS[sp]; const s = spOf(sp);
  if (!tags || !s) return 0;
  const bait = isBait(item);
  if (item === 'egi' && s.tier >= 3) return 0;
  let n = ITEM_LIKES[item].filter(t => tags.includes(t)).length;
  if (bait && tags.includes('float')) n += 1;
  let x = 1 + 2 * n;
  if (!bait && LURE_FAV[item as LureKey]?.includes(sp)) x += 4;
  if (!bait && !SQUID_LURES.includes(item as LureKey) && tags.includes('squid')) x *= 0.3;
  if (!bait && s.tier >= 2 && !tags.includes('squid') && BIG_LURES.includes(item as LureKey)) x += 1;
  return x;
}
/** 有對味（至少一個標籤符合或是對味魚，而且沒被打折）：提示裡寫的目標魚都要過這關 */
export const itemGood = (item: ItemKey, sp: string) => itemScore(item, sp) >= 3;

// ---------------- 雜貨店／換餌：每種餌／假魚的提示 ----------------
export type ItemHint = {
  /** 換餌按鈕上的短標籤（6 字內） */
  tag: string;
  /** 適合水層／釣法 */
  how: string;
  /** 代表目標魚（都要 itemGood） */
  fish: readonly string[];
  /** 大物／巨物補充（可以寫魚名，寫的魚也要 itemGood） */
  big?: string;
  /** big 裡提到的魚（測試用，要 itemGood） */
  bigFish?: readonly string[];
};

export const ITEM_HINT: Readonly<Record<ItemKey, ItemHint>> = {
  oyster: { tag: '垂釣・免費', how: '垂釣・每天免費 20 塊・蚵棚附近魚多', fish: ['kurodai', 'aigo', 'hanguoyu', 'kisu'] },
  shrimp: { tag: '垂釣・通吃', how: '垂釣・什麼魚都吃一點', fish: ['kurodai', 'kisu', 'aji', 'isaki', 'bora'] },
  worm: { tag: '垂釣・貼底', how: '垂釣・貼底魚愛吃・稀有魚多', fish: ['madai', 'fugu', 'hata', 'torahata', 'hirame'] },
  squid: { tag: '垂釣・夜釣', how: '垂釣・晚上 18:00–05:00 咬餌最好', fish: ['isaki', 'tachiuo', 'aoriika'] },
  minnow: { tag: '巡游・可拖', how: '各水層巡游・可拖釣', fish: ['aji', 'suzuki', 'tachiuo', 'sawara', 'kamasu'] },
  jig: { tag: '深水・可拖', how: '深水・可拖釣', fish: ['katsuo', 'kanpachi', 'madai', 'kamasu'], big: '深水大物：黑鮪魚、浪人鰺', bigFish: ['maguro', 'gt'] },
  soft: { tag: '底層貼底', how: '底層貼底慢收', fish: ['hata', 'torahata', 'hirame', 'akahata', 'fugu'] },
  popper: { tag: '表層・晨昏', how: '表層・只有清晨／黃昏有效', fish: ['suzuki', 'shiira', 'sawara', 'bora'], big: '大物：浪人鰺', bigFish: ['gt'] },
  stickbait: { tag: '表層・大物', how: '表層・整天有效・可拖釣・大物加成', fish: ['gt', 'sawara', 'shiira', 'suzuki', 'kurokajiki'], big: '有機會中巨物（雙髻鯊、鬼蝠魟）', bigFish: ['shumoku', 'manta'] },
  trollskirt: { tag: '拖釣・大物', how: '坐船拖釣最強・大物加成', fish: ['shiira', 'kajiki', 'maguro', 'kurokajiki', 'mebachi'], big: '有機會中巨物（雙髻鯊、鯨鯊）', bigFish: ['shumoku', 'jinbei'] },
  slowjig: { tag: '深水・大物', how: '深水底層・慢抽飄落・大物加成', fish: ['sugi', 'kanpachi', 'torahata', 'tamakai', 'mebachi'], big: '有機會中深海巨物（翻車魚、雙髻鯊）', bigFish: ['manbou', 'shumoku'] },
  egi: { tag: '頭足類', how: '底層蚵棚・專釣頭足類，不咬巨物', fish: ['aoriika', 'kouika', 'tako'] },
  vib: { tag: '中深層・可拖', how: '中深層震動・可拖釣', fish: ['kamasu', 'katsuo', 'kanpachi', 'sawara', 'suzuki'], big: '傳說皇帶魚、浪人鰺，偶有巨物鬼蝠魟', bigFish: ['ryugu', 'gt', 'manta'] },
  tairubber: { tag: '深水底層', how: '深水底層・等速慢收', fish: ['madai', 'hirame', 'akahata', 'torahata'], big: '傳說：龍膽石斑、魟魚', bigFish: ['tamakai', 'ei'] },
  deepcrank: { tag: '中深層・可拖', how: '中深層・可拖釣・好上手', fish: ['suzuki', 'madai', 'bora', 'kamasu', 'akahata'] },
  squidjig: { tag: '頭足類・夜', how: '中底層・夜釣更強・專釣頭足類', fish: ['tachiuo', 'aoriika', 'kouika', 'tako'], big: '有機會中深海巨物（大王烏賊）', bigFish: ['daiouika'] },
};

const nameOf = (id: string) => spOf(id)?.name ?? id;
/** 完整一行：「深水・可拖釣｜鰹魚、紅甘、嘉鱲、金梭魚；深水大物：黑鮪魚、浪人鰺」 */
export function itemHintLine(k: ItemKey): string {
  const h = ITEM_HINT[k];
  return `${h.how}｜${h.fish.map(nameOf).join('、')}${h.big ? `；${h.big}` : ''}`;
}
/** HTML（雜貨店卡片／換餌面板）：水層釣法一行（深藍粗體）＋目標魚一行 */
export function itemHintHtml(k: ItemKey, cls = 'fhHint'): string {
  const h = ITEM_HINT[k];
  return `<span class="${cls}"><b>${h.how}</b><span>目標：${h.fish.map(nameOf).join('、')}${h.big ? `；${h.big}` : ''}</span></span>`;
}

// ---------------- 圖鑑：出沒線索／推薦 ----------------
const CLUE: readonly [FishTag, string][] = [
  ['rack', '蚵棚附近'], ['float', '垂釣'], ['deep', '深水（離岸 35m+）'], ['bottom', '貼底'], ['surf', '水面系'], ['pred', '愛追假魚'],
  ['troll', '拖釣'], ['night', '夜釣（18:00–05:00）'], ['squid', '頭足類假餌'],
];
/** 沒釣過的魚：出沒線索（只用伺服器標籤和稀有度，不寫魚名） */
export function fishClue(sp: string): string {
  const tags = FISH_TAGS[sp] ?? []; const s = spOf(sp);
  const out = CLUE.filter(([t]) => tags.includes(t)).map(([, w]) => w);
  // 巨物（頭足類以外）：進階大物路亞讓巨物機率變高、對味權重也在那三支
  if (s && s.tier >= 3 && !tags.includes('squid')) out.push('進階大物路亞');
  return out.length ? `線索：${out.join('・')}` : '線索：到處都有機會';
}

/** 這條魚最對味的假魚（最多 n 個，照對味程度排；同分照雜貨店順序） */
export function fishBestLures(sp: string, n = 3): LureKey[] {
  return LURE_KEYS.map((k, i) => ({ k, i, x: itemScore(k, sp) }))
    .filter(o => o.x >= 3)
    .sort((a, b) => b.x - a.x || a.i - b.i)
    .slice(0, n).map(o => o.k);
}
/** 這條魚最對味的垂釣餌（有對味的才列；全部一樣好就回傳全部） */
export function fishBestBaits(sp: string): BaitKey[] {
  // 不吃垂釣的傳說／巨物（沒有 float 標籤）就不推垂釣：只是標籤碰巧對到，實際很難
  if (!hasTag(sp, 'float') && (spOf(sp)?.tier ?? 0) >= 2) return [];
  const sc = BAIT_KEYS.map(k => ({ k, x: itemScore(k, sp) })).filter(o => o.x >= 3);
  if (!sc.length) return [];
  const mx = Math.max(...sc.map(o => o.x));
  return sc.filter(o => o.x === mx).map(o => o.k);
}
/** 釣過的魚：推薦假餌／餌料一行 */
export function fishRecLine(sp: string): string {
  const lures = fishBestLures(sp), baits = fishBestBaits(sp);
  const parts: string[] = [];
  const bait = baits.length ? (baits.length === BAIT_KEYS.length ? '垂釣什麼餌都行' : `垂釣用${baits.map(k => ITEM_NAME[k]).join('、')}`) : '';
  // 吃垂釣的魚（float）先寫垂釣
  if (bait && hasTag(sp, 'float')) parts.push(bait);
  if (lures.length) parts.push(lures.map(k => ITEM_NAME[k]).join('、'));
  if (bait && !hasTag(sp, 'float')) parts.push(bait);
  if (lures.some(k => (TROLL_LURES as readonly string[]).includes(k)) && hasTag(sp, 'troll')) parts.push('坐船拖釣更好');
  return parts.length ? `推薦：${parts.join('；')}` : '推薦：什麼餌都可能';
}

/** 給測試／檢查：雜貨店假魚順序（跟 FISH.lures 同） */
export const HINT_LURE_ORDER = FISH.lures.map(l => l.k);
