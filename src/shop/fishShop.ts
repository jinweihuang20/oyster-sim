/**
 * 雜貨店「釣具」分頁：列商品、產出卡片 HTML、找出購買鈕。
 * 購買鈕用 data-fishbuy（不要用 data-fbuy：廣場旗幟的購買鈕已經用這個名字，
 * 整份商店清單一起 query 會對不到商品、一開雜貨店就炸掉）。
 */
import { FISH, type LureKey } from '../plaza/boats/fishLogic';
import type { TackleKey } from './tackleModel';

export const FISH_BUY_ATTR = 'data-fishbuy';

/** 假魚卡片的說明（簡短；不寫出現機率） */
export const LURE_GOOD: Record<LureKey, string> = {
  minnow: '路亞：快收加偶爾抽竿，掠食魚會追',
  jig: '路亞：丟得遠、沉得深，深水大魚',
  soft: '路亞：慢慢收貼底爬，石斑愛吃',
  popper: '路亞：抽一下停一下濺水花，清晨和黃昏才有效',
  stickbait: '進階大物：水面下 S 字滑行，整天都能引出水面大物',
  trollskirt: '進階大物：坐船拖釣專用，外海高速大魚最愛',
  slowjig: '進階大物：拋最遠、沉最深，慢抽飄落引出深海巨物',
  egi: '進階大物：抽一下沉一下，專釣軟絲和花枝',
};

export type FishShopRow = {
  id: string; n: string; price: number; kind: 'rod' | 'bait' | 'lure';
  good: string; bad?: string; pack?: number; once?: boolean;
  /** 3D 縮圖用的餌／假魚模型（tackleModel.ts）；釣竿沒有 */
  tk?: TackleKey;
};

export type FishShopSave = { meds?: Record<string, number>; money: number };

export type FishShopFmt = {
  qtyHtml: (k: string) => string;
  px: (k: string, base: number) => number;
  pxHtml: (k: string, base: number) => string;
  pxCd: (k: string) => string;
};

/** 舊存檔可能沒有 meds：一律當成空的，不要直接讀 undefined[id] */
export function shopMeds(save: FishShopSave): Record<string, number> {
  return save.meds ?? (save.meds = {});
}

export function fishShopRows(): FishShopRow[] {
  return [
    { id: FISH.rods.float.id, n: FISH.rods.float.n, price: FISH.rods.float.price, kind: 'rod', good: '掛餌拋出去等魚咬：浮標整個沉下去再收竿，好上手', once: true },
    { id: FISH.rods.lure.id, n: FISH.rods.lure.n, price: FISH.rods.lure.price, kind: 'rod', good: '拋假魚、靠收線節奏引魚：比較難，但大魚和稀有魚比較多；坐船還能拖釣', bad: '拉扯比較難：魚會左右衝，張力太高斷線、太低脫鉤', once: true },
    ...FISH.baits.filter(b => b.id).map(b => ({
      id: b.id, n: `${b.n}（${b.pack} 個）`, price: b.price, kind: 'bait' as const, pack: b.pack, tk: b.k,
      good: b.k === 'shrimp' ? '垂釣用，什麼魚都吃一點' : b.k === 'worm' ? '垂釣用，魚比較愛咬，也比較容易釣到大魚' : '垂釣用，晚上特別有效，白帶魚愛吃',
      bad: '魚咬了（不管有沒有釣到）就用掉一個',
    })),
    ...FISH.lures.map(l => ({
      id: l.id, n: l.n, price: l.price, kind: 'lure' as const, tk: l.k,
      good: LURE_GOOD[l.k],
      bad: '可以一直用；線斷了就沒了',
    })),
  ];
}

export function fishShopIntroHtml() {
  return `<h3><i class="ic ic-shop"></i> 釣具</h3><p style="font-size:12px;opacity:.8">在廣場碼頭邊或坐船出海按「釣魚」。蚵仔肉當餌免費，每天可以帶 ${FISH.oysterPerDay} 塊出海。釣到的魚在碼頭賣。</p>`;
}

/** 3D 縮圖已經畫好就直接放圖；還沒畫就先放線條圖示＋data-tk，等 fillTackleThumbs 分批換掉 */
export function tackleIcHtml(r: FishShopRow, svg: string, thumb?: (k: TackleKey) => string | undefined) {
  if (!r.tk) return `<div class="itemIc tkIc">${svg}</div>`;
  const url = thumb?.(r.tk);
  return url ? `<div class="itemIc tkIc" data-tk="${r.tk}" data-tkok="1">${tackleImgHtml(url, r.n)}</div>` : `<div class="itemIc tkIc" data-tk="${r.tk}">${svg}</div>`;
}
export const tackleImgHtml = (url: string, alt: string) => `<img class="tkImg" src="${url}" alt="${alt.replace(/[<>"&]/g, '')}" width="72" height="45" draggable="false">`;

export function fishCardHtml(r: FishShopRow, save: FishShopSave, svg: string, fmt: FishShopFmt, thumb?: (k: TackleKey) => string | undefined) {
  const meds = shopMeds(save);
  const own = meds[r.id] ?? 0;
  const k = 'item-' + r.id;
  const btn = r.once && own > 0
    ? `<span class="shopOwnPx"><i class="ic ic-check" aria-hidden="true"></i> 已擁有</span>`
    : `${r.once ? '' : fmt.qtyHtml(k)}<button ${FISH_BUY_ATTR}="${r.id}" ${save.money < fmt.px(k, r.price) ? 'disabled' : ''}>${fmt.pxHtml(k, r.price)}</button>`;
  return `<div class="itemCard">${tackleIcHtml(r, svg, thumb)}<div class="itemTx"><b>${r.n}</b><small style="color:#9be37a">${r.good}</small>${r.bad ? `<small style="color:#ff8a7a">${r.bad}</small>` : ''}<small>${r.once ? (own > 0 ? '已擁有' : '一次買斷') : `持有 ${own}`}</small>${fmt.pxCd(k)}</div><div class="buyRow">${btn}</div></div>`;
}

export function fishShopHtml(save: FishShopSave, svgs: { rod: string; bait: string; lure: string }, fmt: FishShopFmt, thumb?: (k: TackleKey) => string | undefined) {
  const rows = fishShopRows();
  const svgOf = (r: FishShopRow) => r.kind === 'rod' ? svgs.rod : r.kind === 'bait' ? svgs.bait : svgs.lure;
  return fishShopIntroHtml() + rows.map(r => fishCardHtml(r, save, svgOf(r), fmt, thumb)).join('');
}

/** 從按鈕讀釣具 id；對不到（例如誤抓到廣場旗幟的空 data-fbuy）就回傳 undefined，呼叫端必須略過，不能直接讀 .id */
export function fishBuyRowOf(attrVal: string | null | undefined, rows: FishShopRow[] = fishShopRows()) {
  if (!attrVal) return undefined;
  return rows.find(x => x.id === attrVal);
}

export function eachFishBuyButton(
  root: { querySelectorAll: (sel: string) => ArrayLike<{ getAttribute: (n: string) => string | null }> },
  rows: FishShopRow[],
  fn: (btn: { getAttribute: (n: string) => string | null }, row: FishShopRow) => void,
) {
  const list = root.querySelectorAll(`button[${FISH_BUY_ATTR}]`);
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const r = fishBuyRowOf(b.getAttribute('data-fishbuy'), rows);
    if (!r) continue;
    fn(b, r);
  }
}
