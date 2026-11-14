/** 工寮雜貨：刀／傘／碗／槍與伺服器價格（從 main.ts 拆出，行為不變） */
import type { Save } from '../core';
import { $ } from '../ui';
import {
  shopWeapons, WEAPON_DEFS, isWeaponId, openWeaponPreview,
  type WeaponId,
} from '../deathmatch';
import type * as THREE from 'three';
import { mountFlagPreview, type FlagPreviewState } from './flagPreview';
import {
  FLAG_COLORS, FLAG_ERR_ZH, FLAG_FX, FLAG_ITEM, FLAG_SIZES, FLAG_TEXT_MAX,
  fetchFlagSnapshot, flagErrText, flagSlowText, flagTextErr, flagTextSaveNote, nextFlagItem,
  postFlagSelect, postFlagText, postFlagUpgrade, type FlagTrack, type PlazaFlagState,
} from '../plaza/flags';
import { PETS, findPet, type Pet } from './pets';
import { renderPetThumb } from './petThumb';
import { openPetPreview } from './petPreview';

/** 目前裝備中的寵物（買了且開開關才會回傳，沒有時回 null） */
export const petNow = (): Pet | null => {
  const save = D.getSave();
  const id = save.shop.equipped.pet;
  const p = findPet(id);
  if (!p) return null;
  if (!save.shop.owned.includes(p.id)) return null;
  if (save.gear?.[p.id] === false) return null;
  return p;
};

export type Knife = { id: string; n: string; price: number; green: number; speed: number; steps: number; stab: number; seam: number; luck: number; blade: number; desc: string };
export type Umb = { id: string; n: string; price: number; open: number; dur: number; perf: number; cover: number; reflect: number; look: string; size: number; desc: string };
export type Bowl = { id: string; n: string; price: number; r: number; bounce: number; dist: number; perf: number; bonus: number; h: number; color: number; metal?: number; desc: string };

export type YardShopDeps = {
  getSave: () => Save;
  persist: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  esc: (s: string) => string;
  getAc: () => AudioContext | null;
  SFX: { jingle: (up?: boolean) => void };
  applyKnife: () => void;
  applyUmb: () => void;
  applyBowl: () => void;
  applyGloves: () => void;
  drawRadio: () => void;
  /** 廣場外觀開關後同步（金煙／坐墊／名牌框） */
  onCosmeticsChange?: () => void;
  /** 寵物購買／切換／開關後同步（出場或收起寵物模型） */
  onPetChange?: () => void;
  getPlayerId: () => string;
  getNick: () => string;
  toast: (t: string, c?: string, sec?: number, place?: 'mid' | 'top') => void;
  getShopTab: () => number;
  onFlagChange?: () => void;
  showFlag?: (on: boolean) => Promise<{ ok: boolean; err?: string; mine?: PlazaFlagState | null; waitMs?: number }>;
  setFlagText?: (text: string) => Promise<{ ok: boolean; err?: string; mine?: PlazaFlagState | null; waitMs?: number }>;
  upgradeFlag?: (track: FlagTrack, from?: number) => Promise<{ ok: boolean; err?: string; mine?: PlazaFlagState | null; waitMs?: number }>;
  selectFlag?: (track: FlagTrack, level: number) => Promise<{ ok: boolean; err?: string; mine?: PlazaFlagState | null; waitMs?: number }>;
  clearBowlMeat: () => void;
  renderClothShop: () => void;
  renderMedShop: () => void;
  renderItemShop: () => void;
  shopTabs: () => void;
  newDecor: () => void;
  shellGeos: THREE.BufferGeometry[];
  pileMat: THREE.Material;
};

let D: YardShopDeps;
export function initYardShop(deps: YardShopDeps) { D = deps; }

/** 工寮器具：數值可由後台 ItemStats 覆寫；沒覆寫用這裡預設 */
export type Gear = {
  id: string; n: string; price: number; good: string; bad: string;
  /** 手套：割手受傷倍率（預設 0.5） */
  dmgMul?: number;
  /** 手套：指針速度倍率（預設 1.05） */
  speedMul?: number;
  /** 收音機：怒氣增加倍率（預設 0.7） */
  angerMul?: number;
  /** 老花眼鏡：找縫判定倍率（預設 1.25） */
  seamMul?: number;
};
export const GEAR: Gear[] = [
  { id: 'glove', n: '🧤 棉紗手套', price: 120, good: '割到手的傷害減半', bad: '手套厚，指針速度 +5%', dmgMul: 0.5, speedMul: 1.05 },
  { id: 'radio', n: '收音機', price: 300, good: '阿婆氣消得快：怒氣增加 ×0.7（聽廣播心情好）', bad: '太吵：丟殼預警變晚（⚠ 和提示聲晚一半才出現）', angerMul: 0.7 },
  { id: 'glasses', n: '👓 老花眼鏡', price: 200, good: '蚵仔縫更亮更粗、光暈更大；插刀判定範圍 +25%', bad: '看遠有點霧：畫面邊緣微暗', seamMul: 1.25 },
];
export function gearFx(id: string): Gear | undefined { return GEAR.find(g => g.id === id); }
/** 廣場高單價外觀（永久、可開關；所有權與器具一樣存在本機存檔） */
export const COSMETICS = [
  { id: 'goldPipe', n: '金煙菸斗', price: 150000, good: '廣場吐出的煙和菸頭的煙會帶一層溫潤金霧', ic: 'pipe' },
  { id: 'seatCush', n: '專屬坐墊', price: 150000, good: '坐下時椅面鋪上赤金刺繡坐墊，別人看得到', ic: 'cushion' },
  { id: 'nameFrame', n: '金箔名牌框', price: 300000, good: '廣場頭頂名牌和全球排行榜的名字加上金箔外框', ic: 'frame' },
];
const COS_IC: Record<string, string> = {
  pipe: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 15h9l3-3 5 1"/><path d="M13 15c0 2.6-2.1 4.5-5 4.5"/></svg>',
  cushion: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="3"/><path d="M8 10l4 4 4-4"/></svg>',
  frame: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="6" y="8" width="12" height="8" rx="1"/></svg>',
};
export const KNIVES: Knife[] = [
  { id: 'basic', luck: 1, n: '舊蚵刀', price: 0, green: 1, speed: 1, steps: 0, stab: 1, seam: 1, blade: 0xd0d0d8, desc: '媽媽留下來的，普普通通' },
  { id: 'dull', luck: 3, n: '便宜鈍刀', price: 20, green: 0.7, speed: 0.85, steps: 0, stab: 1.5, seam: 1, blade: 0x8a8a80, desc: '夜市 20 塊，指針較慢、運氣特別好，但綠區小、很常割到手' },
  { id: 'wide', luck: 0, n: '寬口刀', price: 150, green: 1.5, speed: 1.35, steps: 0, stab: 1, seam: 0.85, blade: 0xe8e0c8, desc: '刀面寬，綠區大，但指針快、比較難找縫' },
  { id: 'point', luck: 2, n: '尖口刀', price: 200, green: 0.9, speed: 1, steps: -1, stab: 1.6, seam: 1, blade: 0xb0c8e0, desc: '尖尖的一下就進去，少撬一下，運氣較好，但比較危險' },
  { id: 'seam', luck: 0, n: '找縫刀', price: 180, green: 0.9, speed: 1.1, steps: 0, stab: 0.8, seam: 1.6, blade: 0xc8e0b0, desc: '找縫很簡單，撬的時候比較費力' },
  { id: 'master', luck: 4, n: '師傅刀', price: 1200, green: 1.2, speed: 0.95, steps: -1, stab: 0.6, seam: 1.25, blade: 0xffe28a, desc: '老師傅手工，樣樣好，就是貴' },
  { id: 'harbor', luck: 4, n: '鎮港金刀', price: 200000, green: 1.26, speed: 0.90, steps: -1, stab: 0.57, seam: 1.31, blade: 0xffd24a, desc: '港口老師傅壓箱底的金刀，比師傅刀再利一點點' },
];
export const UMBS: Umb[] = [
  { id: 'stripe', n: '紅白傘', price: 0, open: 0.05, dur: 4, perf: 0.28, cover: 0.95, reflect: 1, look: 'stripe', size: 1, desc: '工寮門口撿到的，各方面都普通好用' },
  { id: 'clear', n: '超商透明傘', price: 30, open: 0.05, dur: 3, perf: 0.2, cover: 0.85, reflect: 0.6, look: 'clear', size: 0.8, desc: '便宜又輕，但傘面小、反彈沒力，撐一下手就痠' },
  { id: 'fold', n: '自動摺疊傘', price: 160, open: 0, dur: 3, perf: 0.4, cover: 0.8, reflect: 1.2, look: 'navy', size: 0.7, desc: '一按就開，完美反彈時機最寬，但傘面小' },
  { id: 'beach', n: '海灘陽傘', price: 260, open: 0.25, dur: 8, perf: 0.15, cover: 1, reflect: 0.8, look: 'beach', size: 1.3, desc: '又大又能撐很久，但開傘比較慢、完美時機窄' },
  { id: 'temple', n: '廟會涼傘', price: 1500, open: 0.05, dur: 5, perf: 0.35, cover: 1, reflect: 1.6, look: 'temple', size: 1.05, desc: '神明的涼傘，反彈超有力，就是貴' },
  { id: 'gilt', n: '金箔涼傘', price: 200000, open: 0.048, dur: 5.2, perf: 0.37, cover: 1, reflect: 1.68, look: 'gold', size: 1.08, desc: '廟會金箔糊的涼傘，比廟會涼傘再穩一點' },
];
export const BOWLS: Bowl[] = [
  { id: 'plastic', n: '塑膠臉盆', price: 0, r: 0.17, bounce: 0, dist: 1, perf: 0.10, bonus: 0, h: 0.14, color: 0x4a8ac0, desc: '藍色塑膠盆，普通' },
  { id: 'wide', n: '大臉盆', price: 120, r: 0.27, bounce: 0.3, dist: 1, perf: 0.10, bonus: 0, h: 0.06, color: 0xd04a3a, desc: '寬又淺的大紅盆，亮圈比較大，好認' },
  { id: 'bucket', n: '深桶', price: 180, r: 0.12, bounce: 0, dist: 1.1, perf: 0.08, bonus: 1, h: 0.34, color: 0x3a8a4a, desc: '深又窄，進去就跑不掉，肉比較鮮一顆加 $1' },
  { id: 'low', n: '矮盆', price: 150, r: 0.16, bounce: 0.1, dist: 0.7, perf: 0.16, bonus: 0, h: 0.08, color: 0xe0b030, desc: '放比較近、比較矮，順手好點' },
  { id: 'steel', n: '不銹鋼盆', price: 900, r: 0.21, bounce: 0.05, dist: 0.9, perf: 0.13, bonus: 1, h: 0.15, color: 0xd8dde4, metal: 0.9, desc: '專業級，樣樣好，就是貴' },
];

export const gearOn = (id: string) => {
  const save = D.getSave();
  return save.shop.owned.includes(id) && save.gear?.[id] !== false;
};
export const umbNow = () => { const save = D.getSave(); return UMBS.find(u => u.id === save.shop.equipped.umb) ?? UMBS[0]; };
export const bowlNow = () => { const save = D.getSave(); return BOWLS.find(b => b.id === save.shop.equipped.bowl) ?? BOWLS[0]; };
export const knifeNow = () => { const save = D.getSave(); return KNIVES.find(k => k.id === save.shop.equipped.knife) ?? KNIVES[0]; };

function pctTxt(v: number, goodHigh: boolean) { if (v === 1) return '<span style="opacity:.6">—</span>'; const p = Math.round((v - 1) * 100), good = goodHigh ? p > 0 : p < 0; return `<b style="color:${good ? '#9be37a' : '#ff8a7a'}">${p > 0 ? '+' : ''}${p}%</b>`; }
// 商店價格：每次打開雜貨店向伺服器拿一次（後台「商店價格」可改價、打折）；拿不到就照內建價格
type ShopPx = { price: number; base: number; sale?: boolean; endsAt?: number | null };
const PX_URL = 'https://game-status.gwtech.org/s/shop/prices?game=oyster-sim';
/** 後台「標為新品」的物品 key（給雜貨店新品標記用） */
let shopNewIds: string[] = [];
let shopPx: Record<string, ShopPx> = {}, shopPxAt = 0, shopPxTry = 0, shopSkew = 0, payBusy = false;
export async function fetchPrices(ms = 2000) {
  shopPxTry = Date.now(); const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(PX_URL, { mode: 'cors', cache: 'no-store', signal: c.signal });
    const j = r.ok ? await r.json() : null;
    if (!j || typeof j.items !== 'object') return false;
    const old = JSON.stringify(shopPx); shopPx = j.items; shopNewIds = Array.isArray(j.newIds) ? j.newIds.filter((x: unknown) => typeof x === 'string') : []; (window as any).__shopNewIds = shopNewIds; shopPxAt = Date.now(); shopSkew = typeof j.serverTime === 'number' ? j.serverTime - Date.now() : 0;
    return old !== JSON.stringify(shopPx) ? 'changed' : true;
  } catch { return false; } finally { clearTimeout(t); }
}
const pxNow = () => Date.now() + shopSkew;
const pxLive = (k: string) => { const p = shopPx[k]; return p && p.price > 0 && !(p.endsAt && pxNow() >= p.endsAt) ? p : null; };
export const px = (k: string, base: number) => { const p = pxLive(k); if (p) return p.price; const q = shopPx[k]; return q && q.base > 0 ? q.base : base; };
function cdTxt(ms: number) { if (ms <= 0) return '特價已結束'; const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `剩 ${d} 天 ${h} 小時` : `剩 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
/** 價格標示：特價時原價劃掉＋新價＋「特價」＋倒數 */
export function pxHtml(k: string, base: number, pre = '') {
  const p = pxLive(k); if (!p || !p.sale || p.price >= p.base) return `${pre}$${px(k, base)}`;
  return `<span class="pxSale">${pre}<s>$${p.base}</s>$${p.price}</span><span class="saleTag">特價</span>`;
}
/** 特價倒數：放在物品說明下面的小字 */
export function pxCd(k: string) { const p = pxLive(k); return p?.sale && p.endsAt && p.price < p.base ? `<small class="saleCd" data-end="${p.endsAt}">特價${cdTxt(p.endsAt - pxNow())}</small>` : ''; }
setInterval(() => { if (!$('shop').classList.contains('show')) return; let gone = false; $('shop').querySelectorAll<HTMLElement>('.saleCd').forEach(e => { const left = +e.dataset.end! - pxNow(); e.textContent = '特價' + cdTxt(left); if (left <= 0) gone = true; }); if (gone) renderShop(); }, 1000);
export function openShopPx() {
  void Promise.all([fetchPrices(), import('./itemStats').then(m => m.fetchItemStats())]).then(([r]) => {
    if (r === 'changed' && $('shop').classList.contains('show')) renderShop();
    else if ($('shop').classList.contains('show')) renderShop();
  });
}
/** 已擁有時仍顯示價格，旁邊保留使用／換裝狀態；不可再買 */
function ownedPxHtml(k: string, base: number, worn = false) {
  const label = worn ? '已穿戴' : '已擁有';
  return `<span class="shopOwnPx"><i class="ic ic-check" aria-hidden="true"></i> ${label} ${pxHtml(k, base)}</span>`;
}
function pxMsg(t: string) {
  const m = document.createElement('div'); m.className = 'giftMsg bad';
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-shop"></i> 價格有變動</b><p style="margin:6px 0">${t}</p><div class="mbtns"><button class="gmYes">知道了</button></div></div>`;
  const close = () => m.remove(); m.querySelectorAll('.gmX,.gmYes').forEach(b => b.addEventListener('click', close)); m.addEventListener('click', e => { if (e.target === m) close(); });
  document.body.appendChild(m);
}
/** 結帳：價格超過 60 秒沒更新就重拿一次；價格變了就跳提示、不扣錢。回傳實際要付的錢，不能買回 null */
export async function payFor(k: string, base: number, name: string): Promise<number | null> {
  if (payBusy) return null;
  let price = px(k, base);
  if (Date.now() - Math.max(shopPxAt, shopPxTry) > 60_000) {
    payBusy = true; try { await fetchPrices(); } finally { payBusy = false; }
    const np = px(k, base);
    if (np !== price) { renderShop(); pxMsg(`「${D.esc(name)}」現在是 $${np}（剛剛顯示 $${price}），價格已經更新，要買的話請再按一次。`); return null; }
    price = np;
  }
  return D.getSave().money >= price ? price : null;
}
export function ensureStarterWeapons() {
  for (const w of shopWeapons()) if (w.price <= 0 && !D.getSave().shop.owned.includes(w.id)) D.getSave().shop.owned.push(w.id);
}
/** 開發模式（vite dev）視為已購買全部上架槍，方便測死鬥 */
export function ownsWeapon(id: string) {
  if (D.getSave().shop.owned.includes(id)) return true;
  return import.meta.env.DEV && isWeaponId(id) && WEAPON_DEFS[id].inShop;
}
export function ownedWeaponIds(): WeaponId[] {
  ensureStarterWeapons();
  if (import.meta.env.DEV) return shopWeapons().map(w => w.id);
  return shopWeapons().map(w => w.id).filter(id => D.getSave().shop.owned.includes(id));
}
export function weaponNow(): WeaponId {
  const id = D.getSave().shop.equipped.weapon;
  const owned = ownedWeaponIds();
  return id && isWeaponId(id) && owned.includes(id) ? id : 'oysterGun';
}
let shopRenderSeq = 0;
/** 非同步資料回來後重套目前分頁的顯示（不動捲動位置） */
function reapplyShopTab() {
  const gs = Array.from(document.querySelectorAll<HTMLElement>('#shopList .stab'));
  const cur = D.getShopTab();
  gs.forEach((g, i) => { g.style.display = i === cur ? '' : 'none'; });
}
export function renderShop() {
  const seq = ++shopRenderSeq;
  const keepScroll = $('shop').scrollTop;
  if (!D.getSave().shop.owned.includes('basic')) D.getSave().shop.owned.push('basic');
  ensureStarterWeapons();
  const cur = knifeNow().id;
  $('shopList').innerHTML = `<h3><i class="ic ic-knife"></i> 剝殼刀</h3><table class="kt"><tr><th>刀</th><th>綠區</th><th>指針速</th><th>撬幾下</th><th>割手率</th><th>找縫</th><th>幸運</th><th></th></tr>` + KNIVES.map(k => {
    const own = D.getSave().shop.owned.includes(k.id);
    const tr = D.getSave().trial?.id === k.id, btn = tr ? `${k.id === cur ? '<b>使用中</b><br>' : `<button data-eq="${k.id}">換</button><br>`}<button data-buy="${k.id}" ${D.getSave().money < px(k.id, k.price) ? 'disabled' : ''}>${pxHtml(k.id, k.price, '買斷 ')}</button>` : k.id === cur ? `${ownedPxHtml(k.id, k.price)}<b>使用中</b>` : own ? `${ownedPxHtml(k.id, k.price)}<button data-eq="${k.id}">換</button>` : `<button data-buy="${k.id}" ${D.getSave().money < px(k.id, k.price) ? 'disabled' : ''}>${pxHtml(k.id, k.price)}</button>`;
    return `<tr><td><b>${k.n}</b>${(() => { const tr = D.getSave().trial; return tr?.id === k.id ? ` <span class="trialTag">試用剩 ${tr.left} 班</span>` : ''; })()}<br><small>${k.desc}</small>${pxCd(k.id)}</td><td>${pctTxt(k.green, true)}</td><td>${pctTxt(k.speed, false)}</td><td>${k.steps ? `<b style="color:${k.steps < 0 ? '#9be37a' : '#ff8a7a'}">${k.steps > 0 ? '+' : ''}${k.steps}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${pctTxt(k.stab, false)}</td><td>${pctTxt(k.seam, true)}</td><td>${k.luck ? `<b style="color:#f2c440">${'🍀'.repeat(k.luck)}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!D.getSave().shop.owned.includes('stripe')) D.getSave().shop.owned.push('stripe');
  const cu = umbNow().id, B = UMBS[0];
  const rel = (v: number, b: number, goodHigh: boolean, unit: string) => { if (v === b) return `<span style="opacity:.6">${v}${unit}</span>`; const good = goodHigh ? v > b : v < b; return `<b style="color:${good ? '#9be37a' : '#ff8a7a'}">${v}${unit}</b>`; };
  $('shopList').innerHTML += `<h3><i class="ic ic-umb"></i> 雨傘</h3><table class="kt"><tr><th>傘</th><th>開傘</th><th>可撐</th><th>完美窗</th><th>遮擋</th><th>反彈力</th><th></th></tr>` + UMBS.map(u => {
    const own = D.getSave().shop.owned.includes(u.id);
    const btn = u.id === cu ? `${ownedPxHtml(u.id, u.price)}<b>使用中</b>` : own ? `${ownedPxHtml(u.id, u.price)}<button data-ueq="${u.id}">換</button>` : `<button data-ubuy="${u.id}" ${D.getSave().money < px(u.id, u.price) ? 'disabled' : ''}>${pxHtml(u.id, u.price)}</button>`;
    return `<tr><td><b>${u.n}</b><br><small>${u.desc}</small>${pxCd(u.id)}</td><td>${rel(u.open, B.open, false, 's')}</td><td>${rel(u.dur, B.dur, true, 's')}</td><td>${rel(u.perf, B.perf, true, 's')}</td><td>${rel(Math.round(u.cover * 100), 95, true, '%')}</td><td>${rel(u.reflect, 1, true, '×')}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!D.getSave().shop.owned.includes('plastic')) D.getSave().shop.owned.push('plastic');
  const cb = bowlNow().id;
  $('shopList').innerHTML += `<h3><i class="ic ic-bowl"></i> 盆仔</h3><table class="kt"><tr><th>盆</th><th>加價</th><th></th></tr>` + BOWLS.map(b => {
    const own = D.getSave().shop.owned.includes(b.id);
    const bk = b.id === 'wide' ? 'bowl-wide' : b.id; const btn = b.id === cb ? `${ownedPxHtml(bk, b.price)}<b>使用中</b>` : own ? `${ownedPxHtml(bk, b.price)}<button data-beq="${b.id}">換</button>` : `<button data-bbuy="${b.id}" ${D.getSave().money < px(bk, b.price) ? 'disabled' : ''}>${pxHtml(bk, b.price)}</button>`;
    return `<tr><td><b>${b.n}</b><br><small>${b.desc}</small>${pxCd(b.id === 'wide' ? 'bowl-wide' : b.id)}</td><td>${rel(b.bonus, 0, true, '$')}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  $('shopList').querySelectorAll('button[data-bbuy],button[data-beq]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-bbuy') || b.getAttribute('data-beq')!; const w = BOWLS.find(x => x.id === id)!;
    if (b.hasAttribute('data-bbuy')) { const pr = await payFor(id === 'wide' ? 'bowl-wide' : id, w.price, w.n); if (pr == null) return; D.getSave().money -= pr; D.getSave().shop.owned.push(id); D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); }
    D.clearBowlMeat();
    D.getSave().shop.equipped.bowl = id; D.persist(); D.applyBowl(); renderShop();
  });
  $('shopList').querySelectorAll('button[data-ubuy],button[data-ueq]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-ubuy') || b.getAttribute('data-ueq')!; const u = UMBS.find(x => x.id === id)!;
    if (b.hasAttribute('data-ubuy')) { const pr = await payFor(id, u.price, u.n); if (pr == null) return; D.getSave().money -= pr; D.getSave().shop.owned.push(id); D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); }
    D.getSave().shop.equipped.umb = id; D.persist(); D.applyUmb(); renderShop();
  });
  $('shopList').querySelectorAll('button[data-buy],button[data-eq]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-buy') || b.getAttribute('data-eq')!; const k = KNIVES.find(x => x.id === id)!;
    if (b.hasAttribute('data-buy')) { const pr = await payFor(id, k.price, k.n); if (pr == null) return; D.getSave().money -= pr; if (D.getSave().trial?.id === id) delete D.getSave().trial; else D.getSave().shop.owned.push(id); D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); }
    D.getSave().shop.equipped.knife = id; D.persist(); D.applyKnife(); renderShop();
  });
  $('shopList').insertAdjacentHTML('beforeend', '<h4 class="shH4"><i class="ic ic-gear"></i> 其他器具（買了可以開關）</h4><table class="kt">' + GEAR.map(g => { const own = D.getSave().shop.owned.includes(g.id), on = gearOn(g.id);
    return `<tr><td><b>${g.n}</b><br><small style="color:#9be37a">${g.good}</small><small style="color:#ff8a7a">${g.bad}</small>${pxCd(g.id)}</td><td>${own ? `${ownedPxHtml(g.id, g.price)}<button data-gtog="${g.id}">${on ? '✅ 使用中' : '⬜ 沒用'}</button>` : `<button data-gbuy="${g.id}" ${D.getSave().money < px(g.id, g.price) ? 'disabled' : ''}>${pxHtml(g.id, g.price)}</button>`}</td></tr>`; }).join('') + '</table>');
  $('shopList').querySelectorAll('button[data-gbuy],button[data-gtog]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-gbuy') || b.getAttribute('data-gtog')!; const g = GEAR.find(x => x.id === id)!; const save = D.getSave(); save.gear = save.gear ?? {};
    if (b.hasAttribute('data-gbuy')) { const pr = await payFor(id, g.price, g.n.replace(/^\S+\s/, '')); if (pr == null) return; save.money -= pr; save.shop.owned.push(id); save.gear[id] = true; D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); }
    else save.gear[id] = !gearOn(id);
    D.persist(); renderShop(); D.drawRadio(); D.applyGloves();
  });
  $('shopList').insertAdjacentHTML('beforeend', '<h4 class="shH4"><i class="ic ic-user"></i> 廣場外觀（買了可以開關）</h4><table class="kt">' + COSMETICS.map(g => {
    const own = D.getSave().shop.owned.includes(g.id), on = gearOn(g.id);
    const ic = COS_IC[g.ic] || '';
    return `<tr><td><b>${ic} ${g.n}</b><br><small style="color:#9be37a">${g.good}</small>${pxCd(g.id)}</td><td>${own ? `${ownedPxHtml(g.id, g.price)}<button data-ctog="${g.id}">${on ? '使用中' : '沒在用'}</button>` : `<button data-cbuy="${g.id}" ${D.getSave().money < px(g.id, g.price) ? 'disabled' : ''}>${pxHtml(g.id, g.price)}</button>`}</td></tr>`;
  }).join('') + '</table>');
  $('shopList').querySelectorAll('button[data-cbuy],button[data-ctog]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-cbuy') || b.getAttribute('data-ctog')!;
    const g = COSMETICS.find(x => x.id === id)!; const save = D.getSave(); save.gear = save.gear ?? {};
    if (b.hasAttribute('data-cbuy')) { const pr = await payFor(id, g.price, g.n); if (pr == null) return; save.money -= pr; save.shop.owned.push(id); save.gear[id] = true; D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); }
    else save.gear[id] = !gearOn(id);
    D.persist(); renderShop(); D.onCosmeticsChange?.();
  });
  renderFlagShop();
  // 寵物：買了可以開關；只能同時裝備一隻（放在 renderFlagShop 之後，才不會把旗幟拉進寵物 tab）
  const curPet = D.getSave().shop.equipped.pet;
  $('shopList').insertAdjacentHTML('beforeend', `<h3><i class="ic ic-moon"></i> 寵物</h3><p style="font-size:12px;opacity:.8"><b style="color:#d9952b">點縮圖可開啟 3D 檢視</b>。寵物會站在你的右肩，剝蚵仔時會跟著你產出效果。買了可以在這裡開關；同時只能帶一隻。你超過 10 秒都沒操作，寵物會睡著暫停效果。</p>` +
    '<div class="petList">' + PETS.map(p => {
      const save = D.getSave();
      const own = save.shop.owned.includes(p.id);
      const on = own && save.gear?.[p.id] !== false && curPet === p.id;
      const equipBtn = own
        ? (curPet === p.id
          ? `<button data-ptog="${p.id}">${on ? '✅ 使用中' : '⬜ 沒用'}</button>`
          : `<button data-peq="${p.id}">換這一隻</button>`)
        : `<button data-pbuy="${p.id}" ${save.money < px(p.id, p.price) ? 'disabled' : ''}>${pxHtml(p.id, p.price)}</button>`;
      const thumb = renderPetThumb(p.id);
      const thumbInner = thumb
        ? `<img src="${thumb}" alt="${p.n}" />`
        : `<span style="font-size:12px;opacity:.8">預覽</span>`;
      const ownPx = own ? ownedPxHtml(p.id, p.price) : '';
      return `<div class="petCard"><button class="petThumb" type="button" data-ppreview="${p.id}" aria-label="預覽 ${p.n}">${thumbInner}</button><div class="petBody"><div class="petInfo"><b>${p.n}</b><span class="petDesc">${p.desc}</span><span class="petEff">${p.eff}</span>${pxCd(p.id) ? `<span class="petCd">${pxCd(p.id)}</span>` : ''}</div><div class="petAct">${ownPx}${equipBtn}</div></div></div>`;
    }).join('') + '</div>');
  $('shopList').querySelectorAll<HTMLElement>('[data-ppreview]').forEach(el => {
    el.onclick = () => { const id = el.getAttribute('data-ppreview')!; openPetPreview(id); };
  });
  $('shopList').querySelectorAll('button[data-pbuy],button[data-peq],button[data-ptog]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-pbuy') || b.getAttribute('data-peq') || b.getAttribute('data-ptog')!;
    const p = PETS.find(x => x.id === id)!; const save = D.getSave(); save.gear = save.gear ?? {};
    if (b.hasAttribute('data-pbuy')) {
      const pr = await payFor(id, p.price, p.n); if (pr == null) return;
      save.money -= pr; save.shop.owned.push(id); save.gear[id] = true; save.shop.equipped.pet = id;
      D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle();
    } else if (b.hasAttribute('data-peq')) {
      save.shop.equipped.pet = id; save.gear[id] = true;
    } else {
      // toggle on/off（只影響當前裝備的）
      save.gear[id] = save.gear[id] === false;
    }
    D.persist(); renderShop(); D.onPetChange?.();
  });
  const cw = weaponNow();
  $('shopList').insertAdjacentHTML('beforeend', `<h3><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg> 槍枝</h3><p style="font-size:12px;opacity:.8"><b style="color:#d9952b">點整列可預覽 3D 模型</b>（進去後拖曳旋轉）；買了才能在死鬥裡裝備；${WEAPON_DEFS.oysterGun.name}開局就送。${import.meta.env.DEV ? '（開發模式：全部已解鎖）' : ''}</p><table class="kt"><tr><th>槍</th><th>傷害</th><th>彈匣</th><th>射速</th><th>彈速</th><th></th></tr>` + shopWeapons().map(w => {
    const own = ownsWeapon(w.id);
    const btn = w.id === cw ? `${ownedPxHtml(w.id, w.price)}<b>死鬥預設</b>` : own ? `${ownedPxHtml(w.id, w.price)}<button data-weq="${w.id}">設為預設</button>` : `<button data-wbuy="${w.id}" ${D.getSave().money < px(w.id, w.price) ? 'disabled' : ''}>${pxHtml(w.id, w.price)}</button>`;
    return `<tr class="wpnRow" data-wprev="${w.id}" role="button" tabindex="0" title="點擊預覽"><td><b>${w.name}</b> <small style="opacity:.7">預覽</small><br><small>${w.blurb}</small>${pxCd(w.id)}</td><td>${w.damage}${w.pelletCount > 1 ? `<br><small>×${w.pelletCount}</small>` : ''}</td><td>${w.maxAmmo}</td><td>${w.fireRate.toFixed(1)}/s${w.burstCount > 1 ? `<br><small>${w.burstCount} 連發</small>` : ''}${w.pelletCount > 1 ? `<br><small>散彈 ×${w.pelletCount}</small>` : ''}</td><td>${w.bulletSpeed}</td><td>${btn}</td></tr>`;
  }).join('') + '</table>');
  const wpnPrevCtx = () => ({ shellGeos: D.shellGeos, shellMat: D.pileMat });
  const showWpnPrev = (id: WeaponId) => {
    const w = WEAPON_DEFS[id];
    const own = ownsWeapon(id);
    const isDef = weaponNow() === id;
    const act = isDef
      ? `${ownedPxHtml(id, w.price)}<button type="button" class="ghost" disabled>死鬥預設中</button>`
      : own
        ? `${ownedPxHtml(id, w.price)}<button type="button" data-prev-eq="${id}">設為死鬥預設</button>`
        : `<button type="button" data-prev-buy="${id}" ${D.getSave().money < px(id, w.price) ? 'disabled' : ''}>${pxHtml(id, w.price, '購買 ')}</button>`;
    openWeaponPreview({
      id,
      ctx: wpnPrevCtx(),
      actionsHtml: `${act}<button type="button" class="ghost" data-prev-x>關閉</button>`,
      bindActions: (box, close) => {
        box.querySelector('[data-prev-x]')?.addEventListener('click', close);
        box.querySelector(`[data-prev-eq="${id}"]`)?.addEventListener('click', () => {
          D.getSave().shop.equipped.weapon = id; D.persist(); close(); renderShop();
        });
        box.querySelector(`[data-prev-buy="${id}"]`)?.addEventListener('click', async () => {
          const pr = await payFor(id, w.price, w.name); if (pr == null) return;
          D.getSave().money -= pr; D.getSave().shop.owned.push(id); D.getSave().shop.equipped.weapon = id;
          D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); D.persist(); close(); renderShop();
        });
      },
    });
  };
  $('shopList').querySelectorAll<HTMLElement>('.wpnRow').forEach(row => {
    row.onclick = e => {
      if ((e.target as HTMLElement).closest('button')) return;
      const id = row.dataset.wprev; if (id && isWeaponId(id)) showWpnPrev(id);
    };
  });
  $('shopList').querySelectorAll('button[data-wbuy],button[data-weq]').forEach(b => (b as HTMLButtonElement).onclick = async e => {
    e.stopPropagation();
    const id = (b.getAttribute('data-wbuy') || b.getAttribute('data-weq'))!;
    if (!isWeaponId(id)) return;
    const w = WEAPON_DEFS[id];
    if (b.hasAttribute('data-wbuy')) {
      const pr = await payFor(id, w.price, w.name); if (pr == null) return;
      D.getSave().money -= pr; D.getSave().shop.owned.push(id); D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle();
    }
    D.getSave().shop.equipped.weapon = id; D.persist(); renderShop();
  });
  D.renderClothShop(); D.renderMedShop(); D.renderItemShop(); D.shopTabs(); D.newDecor();
  if (seq > 1 && $('shop').classList.contains('show')) $('shop').scrollTop = keepScroll;
}


const LOCK_IC = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
let flagMineCache: PlazaFlagState | null = null;
let flagUpBusy = false;
let flagPv: FlagPreviewState = { color: 0, size: 0, fx: 0, text: '', nick: '' };

function flagPvRow(label: string, track: FlagTrack, opts: { lv: number; n: string }[], unlocked: number, selected: number) {
  const chips = opts.map(o => {
    const locked = o.lv > unlocked;
    const on = o.lv === selected;
    return `<button type="button" class="flagChip${on ? ' on' : ''}${locked ? ' lock' : ''}" data-fpv="${track}" data-lv="${o.lv}" data-locked="${locked ? 1 : 0}">${locked ? LOCK_IC : ''}${D.esc(o.n)}</button>`;
  }).join('');
  return `<div class="flagTrack"><div class="flagTrackHd">${label}</div><div class="flagChips">${chips}</div></div>`;
}

function flagPvHtml(note: string) {
  return `<div class="flagPv"><canvas id="flagPvCv" width="260" height="200" aria-label="旗幟預覽"></canvas><div id="flagPvNote" class="flagPvNote">${note}</div></div>`;
}

const FLAG_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2.2 3.6L17 11H6"/></svg>';

function flagShopHtml(mine: PlazaFlagState | null, own: boolean) {
  const save = D.getSave();
  if (!own) {
    const can = save.money >= px(FLAG_ITEM.id, FLAG_ITEM.price);
    return `<div id="flagShop" class="flagShop"><h4 class="shH4">${FLAG_IC} 廣場旗幟</h4><p class="flagLead">買了可以在廣場插一支自己的旗，寫上最多 ${FLAG_TEXT_MAX} 個字。走到想放的地方按「插旗」（旗會插在你面前約半步），再插一次會搬到新位置。每個人同時只能有一支旗。</p>${flagPvHtml('點下面的樣式試看插在廣場的樣子')}${flagPvRow('顏色', 'color', FLAG_COLORS, 0, 0)}${flagPvRow('尺寸', 'size', FLAG_SIZES, 0, 0)}${flagPvRow('特效', 'fx', FLAG_FX, 0, 0)}<button data-fbuy ${can ? '' : 'disabled'}>${pxHtml(FLAG_ITEM.id, FLAG_ITEM.price)}</button>${pxCd(FLAG_ITEM.id)}</div>`;
  }
  const unlockedColor = mine?.color ?? 0;
  const unlockedSize = mine?.size ?? 0;
  const unlockedFx = mine?.fx ?? 0;
  const selectedColor = mine?.colorSel ?? unlockedColor;
  const selectedSize = mine?.sizeSel ?? unlockedSize;
  const selectedFx = mine?.fxSel ?? unlockedFx;
  const text = D.esc(mine?.text || '');
  const trackRow = (label: string, track: FlagTrack, unlocked: number, selected: number, opts: { lv: number; n: string }[]) => {
    const chips = opts.map(o => {
      if (o.lv > unlocked) return `<button type="button" class="flagChip lock" data-fpv="${track}" data-lv="${o.lv}" data-locked="1" title="還沒解鎖，點一下試看">${LOCK_IC}${D.esc(o.n)}</button>`;
      const on = o.lv === selected;
      return `<button type="button" class="flagChip${on ? ' on' : ''}" data-fsel="${track}" data-lv="${o.lv}"${on ? ' aria-current="true"' : ''}>${D.esc(o.n)}</button>`;
    }).join('');
    const nxt = nextFlagItem(track, unlocked);
    const buy = !mine
      ? '<button disabled>讀取等級中…</button>'
      : nxt
      ? `<button data-fup="${track}" ${save.money >= px(nxt.id, nxt.price) && !flagUpBusy ? '' : 'disabled'}>解鎖 ${D.esc(nxt.n.replace(/^旗幟[^：]*：/, ''))} ${pxHtml(nxt.id, nxt.price)}</button>${pxCd(nxt.id)}`
      : '<span class="flagMax">已全部解鎖</span>';
    // 已解鎖更高級但廣場上選的是較低的：講清楚，免得以為買了沒效又重買
    const hiN = opts.find(o => o.lv === unlocked)?.n ?? '';
    const selN = opts.find(o => o.lv === selected)?.n ?? '';
    const gap = mine && selected < unlocked ? `<div class="flagSelHint">廣場上目前用的是「${D.esc(selN)}」，你已經解鎖「${D.esc(hiN)}」，點上面的「${D.esc(hiN)}」就會換上（不用再買）</div>` : '';
    return `<div class="flagTrack"><div class="flagTrackHd">${label}</div><div class="flagChips">${chips}</div>${gap}${buy}</div>`;
  };
  return `<div id="flagShop" class="flagShop"><h4 class="shH4">${FLAG_IC} 廣場旗幟</h4>${ownedPxHtml(FLAG_ITEM.id, FLAG_ITEM.price)}<p class="flagLead">已購買。走到廣場想放的地方按「插旗」（旗會插在你面前約半步）；再插一次會把舊的搬走。解鎖後的顏色、尺寸和特效可以隨時改選；有鎖頭的可以先點來試看。</p>${flagPvHtml('目前的樣子')}<label class="flagLbl">旗上的字（最多 ${FLAG_TEXT_MAX} 個字）<input id="flagTextIn" class="flagIn" type="text" maxlength="${FLAG_TEXT_MAX}" value="${text}" placeholder="寫在旗上的字"></label><button data-fsave>儲存文字</button><div id="flagTextMsg" class="flagMsg" role="status" aria-live="polite"></div><div class="flagTrack"><div class="flagTrackHd">在廣場顯示</div><div class="flagChips"><button type="button" class="flagChip${mine?.planted ? ' on' : ''}" data-fshow="1"${mine?.planted ? ' aria-current="true"' : ''}>顯示</button><button type="button" class="flagChip${mine && !mine.planted ? ' on' : ''}" data-fshow="0"${mine && !mine.planted ? ' aria-current="true"' : ''}>收起</button></div></div>${trackRow('顏色', 'color', unlockedColor, selectedColor, FLAG_COLORS)}${trackRow('尺寸', 'size', unlockedSize, selectedSize, FLAG_SIZES)}${trackRow('特效', 'fx', unlockedFx, selectedFx, FLAG_FX)}</div>`;
}

function bindFlagShop(mine: PlazaFlagState | null) {
  bindFlagPreview(mine);
  const box = document.getElementById('flagShop');
  if (!box) return;
  const buy = box.querySelector<HTMLButtonElement>('button[data-fbuy]');
  if (buy) buy.onclick = async () => {
    const pr = await payFor(FLAG_ITEM.id, FLAG_ITEM.price, FLAG_ITEM.n);
    if (pr == null) return;
    const save = D.getSave();
    save.money -= pr;
    save.shop.owned.push(FLAG_ITEM.id);
    D.track('buy', { item: FLAG_ITEM.id, price: pr });
    if (D.getAc()) D.SFX.jingle();
    D.persist();
    renderShop();
    D.onFlagChange?.();
  };
  box.querySelectorAll<HTMLButtonElement>('button[data-fshow]').forEach(b => b.onclick = async () => {
    if (b.disabled || b.classList.contains('on')) return;
    const on = b.dataset.fshow === '1';
    if (!D.showFlag) return;
    b.disabled = true;
    try {
      const r = await D.showFlag(on);
      if (!r.ok) {
        const m: Record<string, string> = { no_conn: '要在廣場裡才能切換旗子顯示', never_planted: '還沒插過旗，先到廣場按「插旗」', not_planted: '旗子已經是收起來的', nosup: '這台伺服器還沒開放這個功能' };
        D.toast(m[r.err || ''] ?? flagSlowText(r.err, r.waitMs, on ? 'plant' : 'remove'), '#ffb08a');
        return;
      }
      D.toast(on ? '旗子插回原本的位置了' : '旗子收起來了，文字和升級都會保留', '#9be37a', 3, 'top');
      renderFlagShop(r.mine ?? mine);
    } finally { if (b.isConnected) b.disabled = false; }
  });
  const saveBtn = box.querySelector<HTMLButtonElement>('button[data-fsave]');
  const flagMsg = (t: string, ok: boolean) => {
    const el = document.getElementById('flagTextMsg');
    if (el) { el.textContent = t; el.className = 'flagMsg ' + (ok ? 'ok' : 'bad'); }
    D.toast(t, ok ? '#9be37a' : '#ffb08a');
  };
  const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>(res => setTimeout(() => res(null), ms))]);
  const textIn = box.querySelector<HTMLInputElement>('#flagTextIn');
  if (textIn) textIn.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); saveBtn?.click(); } };
  if (saveBtn) saveBtn.onclick = async () => {
    if (saveBtn.disabled) return;
    if (!D.getSave().shop.owned.includes(FLAG_ITEM.id)) { flagMsg(flagTextErr('no_flag'), false); return; }
    const inp = textIn;
    const raw = inp?.value ?? '';
    const pid = D.getPlayerId();
    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = '儲存中…';
    try {
      let r = D.setFlagText ? await withTimeout(D.setFlagText(raw), 8000) : null;
      if (!r || r.err === 'no_conn' || r.err === 'nosup') r = await withTimeout(postFlagText(pid, raw), 8000);
      if (!r) { flagMsg('伺服器沒有回應，文字還沒儲存，請稍後再試', false); return; }
      if (!r.ok) { flagMsg(flagTextErr(r.err, r.waitMs), false); return; }
      const got = r.mine?.text ?? raw;
      const note = flagTextSaveNote(raw, got);
      const msg = note ? `旗幟文字已儲存（${note}）` : `旗幟文字已儲存：「${got}」`;
      if (D.getAc()) D.SFX.jingle();
      renderFlagShop(r.mine ?? mine);
      flagMsg(msg, true);
    } catch {
      flagMsg('儲存失敗，請稍後再試', false);
    } finally {
      if (saveBtn.isConnected) { saveBtn.disabled = false; saveBtn.textContent = label; }
    }
  };
  box.querySelectorAll<HTMLButtonElement>('button[data-fsel]').forEach(b => {
    b.onclick = async () => {
      const track = b.getAttribute('data-fsel') as FlagTrack | null;
      const lv = Number(b.getAttribute('data-lv'));
      if (!track || !Number.isFinite(lv)) return;
      const cur = track === 'color' ? (mine?.colorSel ?? mine?.color ?? 0) : track === 'size' ? (mine?.sizeSel ?? mine?.size ?? 0) : (mine?.fxSel ?? mine?.fx ?? 0);
      if (lv === cur) return;
      let r = D.selectFlag ? await D.selectFlag(track, lv) : null;
      if (!r || r.err === 'no_conn') r = await postFlagSelect(D.getPlayerId(), track, lv);
      if (!r.ok) {
        D.toast(r.err === 'nosup' ? '這台伺服器還沒開放挑選旗幟樣式' : r.err === 'grow' ? '換成這個尺寸會跟隔壁的旗太近，先到廣場把旗插到空一點的地方再換（已解鎖，不用再買）' : flagSlowText(r.err, r.waitMs, 'edit'), '#ffb08a');
        return;
      }
      const next: any = r.mine ? { ...r.mine } : { ...(mine ?? {}) };
      if (track === 'color') next.colorSel = lv; else if (track === 'size') next.sizeSel = lv; else next.fxSel = lv;
      renderFlagShop(next);
      D.toast('已換成「' + (b.textContent || '').trim() + '」', '#9fd0a8');
    };
  });
  box.querySelectorAll<HTMLButtonElement>('button[data-fup]').forEach(b => {
    b.onclick = async () => {
      const track = b.getAttribute('data-fup') as FlagTrack | null;
      if (!track || !mine || flagUpBusy) return; // 還沒讀到真實等級前不給買
      const lv = track === 'color' ? mine.color : track === 'size' ? mine.size : mine.fx;
      const item = nextFlagItem(track, lv);
      if (!item) { D.toast(FLAG_ERR_ZH.max, '#ffb08a'); return; }
      flagUpBusy = true;
      box.querySelectorAll<HTMLButtonElement>('button[data-fup]').forEach(x => { x.disabled = true; });
      try {
        const pr = await payFor(item.id, item.price, item.n);
        if (pr == null) return;
        const save = D.getSave();
        save.money -= pr;
        D.persist();
        let r: { ok: boolean; err?: string; mine?: PlazaFlagState | null; waitMs?: number } | null = null;
        try {
          r = D.upgradeFlag ? await D.upgradeFlag(track, lv) : null;
          if (!r || r.err === 'no_conn') r = await postFlagUpgrade(D.getPlayerId(), track, lv);
        } catch {
          r = { ok: false, err: 'offline' };
        }
        if (!r.ok) {
          D.getSave().money += pr; // 沒升級成功一律退錢
          D.persist();
          if (r.mine) flagMineCache = r.mine;
          D.toast(r.err === 'stale' ? FLAG_ERR_ZH.stale : flagSlowText(r.err, r.waitMs, 'edit') + '，錢已退回', '#ffb08a');
          return;
        }
        if (r.mine) flagMineCache = r.mine;
        D.track('buy', { item: item.id, price: pr });
        if (D.getAc()) D.SFX.jingle();
        D.toast(`${item.n} 升級好了`, '#9be37a');
      } finally {
        flagUpBusy = false;
        renderShop();
      }
    };
  });
}

function bindFlagPreview(mine: PlazaFlagState | null) {
  const box = document.getElementById('flagShop');
  const cv = box?.querySelector<HTMLCanvasElement>('#flagPvCv');
  if (!box || !cv) return;
  const sel = {
    color: mine?.colorSel ?? mine?.color ?? 0,
    size: mine?.sizeSel ?? mine?.size ?? 0,
    fx: mine?.fxSel ?? mine?.fx ?? 0,
  };
  flagPv = { ...sel, text: mine?.text || '', nick: D.getNick() };
  mountFlagPreview(cv, () => flagPv);
  const note = box.querySelector<HTMLElement>('#flagPvNote');
  const baseNote = note?.textContent || '';
  const refreshNote = () => {
    if (!note) return;
    const tried: string[] = [];
    box.querySelectorAll<HTMLButtonElement>('button[data-fpv].pv').forEach(b => tried.push((b.textContent || '').trim()));
    note.textContent = tried.length ? '試看中：' + tried.join('、') + '（尚未解鎖）' : baseNote;
    note.classList.toggle('try', tried.length > 0);
  };
  box.querySelectorAll<HTMLButtonElement>('button[data-fpv]').forEach(b => b.onclick = () => {
    const track = b.dataset.fpv as FlagTrack;
    const lv = Number(b.dataset.lv);
    if (!Number.isFinite(lv)) return;
    const row = b.parentElement;
    const was = b.classList.contains('pv') || (b.dataset.locked !== '1' && b.classList.contains('on'));
    row?.querySelectorAll('button').forEach(x => { x.classList.remove('pv'); if (x.hasAttribute('data-fpv')) x.classList.remove('on'); });
    if (b.dataset.locked === '1' && was) {
      flagPv = { ...flagPv, [track]: sel[track] }; // 再點一次取消試看
      row?.querySelector(`button[data-lv="${sel[track]}"]`)?.classList.add('on');
    } else {
      flagPv = { ...flagPv, [track]: lv };
      b.classList.add(b.dataset.locked === '1' ? 'pv' : 'on');
    }
    refreshNote();
  });
  const textIn = box.querySelector<HTMLInputElement>('#flagTextIn');
  textIn?.addEventListener('input', () => { flagPv = { ...flagPv, text: textIn.value }; });
}

function renderFlagShop(prefetched?: PlazaFlagState | null) {
  const own = D.getSave().shop.owned.includes(FLAG_ITEM.id);
  const existing = document.getElementById('flagShop');
  if (prefetched) flagMineCache = prefetched;
  const cur = prefetched ?? flagMineCache;
  const html = flagShopHtml(cur, own);
  if (existing) existing.outerHTML = html;
  else $('shopList').insertAdjacentHTML('beforeend', html);
  bindFlagShop(cur);
  if (own && prefetched === undefined) {
    const pid = D.getPlayerId();
    const seq = shopRenderSeq;
    void fetchFlagSnapshot(pid).then(r => {
      // 伺服器還沒有這個人的旗資料＝全部 0 級
      const mine0 = r.mine ?? ({ color: 0, size: 0, fx: 0, colorSel: 0, sizeSel: 0, fxSel: 0, planted: false, text: '' } as unknown as PlazaFlagState);
      if (r.ok) { r.mine = mine0; flagMineCache = mine0; }
      if (seq !== shopRenderSeq || !r.ok) return; // 商店已重畫過，舊的回應不要蓋新畫面
      const box = document.getElementById('flagShop');
      if (!box || !box.parentElement) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = flagShopHtml(r.mine, true);
      const fresh = tmp.firstElementChild;
      if (!fresh) return;
      box.replaceWith(fresh);
      bindFlagShop(r.mine);
      reapplyShopTab();
    });
  }
}

export const getShopNewIds = () => shopNewIds;
export { FLAG_PRICE_ITEMS, FLAG_ITEM } from '../plaza/flags';
