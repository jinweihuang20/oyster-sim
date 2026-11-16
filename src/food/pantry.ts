/** 食材收集（V1）：取得、保存期限、雜貨店食材區、食材頁。只收集與查看，還不能使用。 */
import { FOODS, FOOD_BY_ID, FOOD_RATE, CAT_N, foodLifeMs, foodSvg, type Food, type FoodCat } from './ingredients';
import type { FoodBatch } from '../core/save';
import { qtyHtml, bindQty, getQty, resetQty } from '../shop/qty';

export type FoodSrc = 'shuck' | 'scoop' | 'buy' | 'ama' | 'signin';
export type FoodDeps = {
  getSave: () => { money: number; food?: FoodBatch[]; foodSeen?: string[] };
  persist: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  pop: (text: string, color?: string) => void;
  toastTop: (text: string) => void;
  isTut: () => boolean;
  px: (id: string, price: number) => number;
  pxCd: (id: string) => string;
  pxHtml: (id: string, price: number) => string;
  payFor: (id: string, price: number, name: string) => Promise<number | null>;
  jingle: () => void;
  /** 目前在一般廣場（食材攤只在這裡開） */
  inPlaza: () => boolean;
  /** 前往廣場／走到食材攤 */
  goStall: () => void;
  /** 開食材攤時向伺服器拿一次價格（後台改價／特價） */
  refreshPrices: () => void;
  /** 買完更新畫面上的錢 */
  onMoney: () => void;
  /** 排隊：輪到自己才可開 */
  canOpenStall: () => boolean;
  /** 按「買好了」關畫面＝讓給下一位 */
  onStallClose: () => void;
  /** 開蚵仔煎圖鑑 */
  openCookDex: () => void;
};

let D: FoodDeps;
const MAX_BATCH = 300;
/** 同種同品質、一小時內取得的併成同一批（期限照較早那份算） */
const MERGE_MS = 3600_000;

export function initFood(deps: FoodDeps) {
  D = deps;
  purgeFood();
  document.getElementById('foodClose')?.addEventListener('click', () => document.getElementById('food')?.classList.remove('show'));
  document.getElementById('foodStallClose')?.addEventListener('click', () => { document.getElementById('foodStall')?.classList.remove('show'); D.onStallClose(); });
  setInterval(() => { flushShuckTrack(); if (!document.hidden) purgeFood(); }, 60_000);
  addEventListener('pagehide', flushShuckTrack);
}

const batches = () => { const s = D.getSave(); return (s.food ??= []); };
const expAt = (b: FoodBatch) => { const f = FOOD_BY_ID[b.id]; return f && f.life ? b.at + foodLifeMs(f) : Infinity; };

export function foodCount(id: string, q?: number) {
  let n = 0; for (const b of batches()) if (b.id === id && (q == null || (b.q ?? 0) === q)) n += b.n; return n;
}

/** 剝蚵每顆都入帳，統計改成累積後一次送（避免每顆一筆） */
const shuckPend: Record<number, number> = {};
function flushShuckTrack() {
  for (const k of Object.keys(shuckPend)) {
    const q = Number(k), n = shuckPend[q]; delete shuckPend[q];
    if (n > 0) D.track('food', { item: 'food-oyster', kind: 'shuck', count: n, ...(q ? { q } : {}) });
  }
}
export function addFood(id: string, n: number, src: FoodSrc, q = 0, quiet = false) {
  const f = FOOD_BY_ID[id]; if (!f || n < 1) return;
  const L = batches(), now = Date.now(), qq = f.quality ? q : 0;
  // 不會壞的（粉、醬、蚵仔）同種同品質永遠併成一批，批數不會長、不會被 MAX_BATCH 擠掉
  const hit = L.find(b => b.id === id && (b.q ?? 0) === qq && (!f.life || now - b.at < MERGE_MS));
  if (hit) hit.n += n; else L.push(qq ? { id, n, at: now, q: qq } : { id, n, at: now });
  if (L.length > MAX_BATCH) L.splice(0, L.length - MAX_BATCH);
  const s = D.getSave(); s.foodSeen ??= [];
  const first = !s.foodSeen.includes(id); if (first) s.foodSeen.push(id);
  D.persist();
  if (src === 'shuck') { shuckPend[qq] = (shuckPend[qq] ?? 0) + n; if ((shuckPend[0] ?? 0) + (shuckPend[1] ?? 0) >= 20) flushShuckTrack(); }
  else D.track('food', { item: 'food-' + id, kind: src, count: n, ...(qq ? { q: qq } : {}) });
  const nm = `${f.n}${f.quality ? (qq ? '（完整）' : '（一般）') : ''}`;
  if (first) D.toastTop(`第一次拿到食材「${f.n}」！主選單的「食材」可以查看`);
  else if (!quiet) D.pop(`食材 +${n} ${nm}`, '#bfe0ff');
  renderFoodPanel();
}

/** 用掉食材（從最舊的一批開始扣）；ids 任一種都算（例：蚵仔＝一般／大蚵／石蚵）。不夠回 false 不扣 */
export function takeFood(ids: readonly string[], n = 1): boolean {
  purgeFood();
  const L = batches().filter(b => ids.includes(b.id)).sort((a, b) => a.at - b.at);
  if (L.reduce((s, b) => s + b.n, 0) < n) return false;
  let left = n;
  for (const b of L) { const k = Math.min(b.n, left); b.n -= k; left -= k; if (!left) break; }
  const all = batches();
  for (let i = all.length - 1; i >= 0; i--) if (all[i].n <= 0) all.splice(i, 1);
  D.persist();
  renderFoodPanel();
  return true;
}
export function foodCountAny(ids: readonly string[]) { return ids.reduce((s, id) => s + foodCount(id), 0); }

/** 過期的自動清掉並提示 */
export function purgeFood() {
  const L = batches(), now = Date.now(), gone: Record<string, number> = {};
  for (let i = L.length - 1; i >= 0; i--) {
    const b = L[i];
    if (!FOOD_BY_ID[b.id] || !(b.n > 0)) { L.splice(i, 1); continue; }
    if (expAt(b) <= now) { gone[b.id] = (gone[b.id] ?? 0) + b.n; L.splice(i, 1); }
  }
  const ks = Object.keys(gone); if (!ks.length) return;
  D.persist();
  D.toastTop(`放太久壞掉了，已清掉：${ks.map(k => `${FOOD_BY_ID[k].n} ×${gone[k]}`).join('、')}`);
  renderFoodPanel();
}

// ----- 取得管道 -----
/** 自己剝進碗的每一顆蚵仔肉都算一份食材蚵仔（完整／一般看有沒有剝破）；偷來、寵物、烤台的肉和新手教學不算 */
export function rollShuck(intact: boolean) {
  if (D.isTut()) return;
  addFood('oyster', 1, 'shuck', intact ? 1 : 0, true);
}
/** used：入碗幾顆（與 rollShuck 同一批：教學、偷來、寵物不算；烤台搶到再入碗的算）。每顆各自擲一次 */
export function rollScoop(locId: string, used: number) {
  if (D.isTut()) return;
  const r = FOOD_RATE.scoop[locId] ?? FOOD_RATE.scoop.home;
  let shrimp = 0, squid = 0;
  for (let i = 0; i < Math.max(0, Math.floor(used)); i++) {
    if (Math.random() >= r) continue;
    if (Math.random() < FOOD_RATE.shrimpShare) shrimp++; else squid++;
  }
  if (shrimp) addFood('shrimp', shrimp, 'scoop');
  if (squid) addFood('squid', squid, 'scoop');
}
export function rollAma() {
  if (D.isTut() || Math.random() >= FOOD_RATE.amaSauce) return;
  addFood('amasauce', 1, 'ama');
}
/** 簽到第 7 天食材福袋；回傳給簽到視窗的說明 */
export function dailyFoodBag(): string {
  const k = FOOD_RATE.bagMin + Math.floor(Math.random() * (FOOD_RATE.bagMax - FOOD_RATE.bagMin + 1));
  const got: Record<string, number> = {};
  for (let i = 0; i < k; i++) { const id = FOOD_RATE.bagPool[Math.floor(Math.random() * FOOD_RATE.bagPool.length)]; got[id] = (got[id] ?? 0) + 1; }
  for (const [id, n] of Object.entries(got)) addFood(id, n, 'signin', 0, true);
  return `食材福袋：${Object.entries(got).map(([id, n]) => `${FOOD_BY_ID[id].n} ×${n}`).join('、')}`;
}

// ----- 顯示 -----
const leftTxt = (ms: number) => {
  if (!isFinite(ms)) return '不會壞';
  const h = Math.max(0, Math.ceil(ms / 3600_000));
  return h >= 24 ? `${Math.floor(h / 24)} 天${h % 24 ? ` ${h % 24} 小時` : ''}後壞掉` : `${h} 小時後壞掉`;
};
export const lifeTxt = (f: Food) => f.life ? `可放 ${f.life / 24} 天` : '不會壞';

function rowHtml(f: Food) {
  const n = foodCount(f.id), now = Date.now();
  const mine = batches().filter(b => b.id === f.id);
  const soonest = mine.reduce((a, b) => Math.min(a, expAt(b)), Infinity);
  const q = f.quality && n ? `<span class="fdQ">完整 ${foodCount(f.id, 1)}・一般 ${foodCount(f.id, 0)}</span>` : '';
  const exp = n ? `<span class="fdExp${isFinite(soonest) && soonest - now < 12 * 3600_000 ? ' warn' : ''}">${isFinite(soonest) ? '最早一份 ' : ''}${leftTxt(soonest - now)}</span>` : `<span class="fdExp">${lifeTxt(f)}</span>`;
  return `<div class="fdRow${n ? '' : ' none'}${f.soon ? ' soon' : ''}"><span class="fdIc" style="--fc:${f.color}">${foodSvg(f)}</span><div class="fdTx"><div class="fdTop"><b>${f.n}</b>${q}<span class="fdN">×${n}</span></div><div class="fdHow"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg>${f.how}</div>${exp}</div></div>`;
}

export function foodPanelHtml() {
  const kinds = FOODS.filter(f => foodCount(f.id) > 0).length;
  const cats: FoodCat[] = ['main', 'extra', 'base', 'egg', 'sauce'];
  return `<div class="fdHead"><div class="fdTease"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18M5 10v9h14v-9M4 10l2-5h12l2 5"/><path d="M10 19v-5h4v5"/></svg><span>廣場煎台開張了</span></div>`
    + `<p class="fdSub">到廣場中央和第 5 桌的煎台，站進藍色圓圈按「開始煎」；或在主選單按「煎蚵仔煎」，用自家煎台煎。用這些食材能煎出 2,304 種蚵仔煎，現有 <b>${kinds}/${FOODS.length}</b> 種食材。</p>`
    + `<p class="fdBuy">地瓜粉、青菜、雞蛋和醬料在<b>廣場食材攤</b>買得到。</p>`
    + `<div class="fdBtns"><button type="button" class="fdBtn" data-cookdex>${DEX_IC}<span>蚵仔煎圖鑑</span></button><button type="button" class="fdBtn pri" data-fdgo>${GO_IC}<span>${D.inPlaza() ? '走到食材攤' : '前往廣場'}</span></button></div></div>`
    + cats.map(c => `<div class="fdCat">${CAT_N[c]}</div>` + FOODS.filter(f => f.cat === c).map(rowHtml).join('')).join('');
}

export function renderFoodPanel() {
  const L = document.getElementById('foodList'); if (!L || !document.getElementById('food')?.classList.contains('show')) return;
  L.innerHTML = foodPanelHtml(); bindGo(L);
}
export function openFood() {
  purgeFood();
  const p = document.getElementById('food'), L = document.getElementById('foodList'); if (!p || !L) return;
  L.innerHTML = foodPanelHtml(); bindGo(L); p.classList.add('show'); p.scrollTop = 0;
}

const DEX_IC = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/></svg>';
const GO_IC = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg>';
/** 「前往廣場」：在廣場裡會直接走到食材攤 */
const goBtn = () => `<button type="button" class="fdGo" data-fdgo>${GO_IC}${D.inPlaza() ? '走到食材攤' : '前往廣場'}</button>`;
function bindGo(root: ParentNode) {
  root.querySelectorAll<HTMLButtonElement>('button[data-cookdex]').forEach(b => b.onclick = e => { e.stopPropagation(); D.openCookDex(); });
  root.querySelectorAll<HTMLButtonElement>('button[data-fdgo]').forEach(b => b.onclick = e => { e.stopPropagation(); D.goStall(); });
}

/** 雜貨店「食材」分頁：只放指引，食材只在廣場食材攤賣 */
export function renderFoodShop() {
  const list = document.getElementById('shopList'); if (!list) return;
  list.insertAdjacentHTML('beforeend', `<h3><i class="ic ic-bowl"></i> 食材</h3><div class="fdGuide"><p>食材請到<b>廣場食材攤</b>購買，地瓜粉、青菜、雞蛋和四種醬料都有，不限量。</p>${goBtn()}</div>`);
  bindGo(list);
}

function stallHtml() {
  const money = D.getSave().money;
  return `<p class="fsIntro">青菜和雞蛋可放 3 天，粉、醬和蚵仔不會壞。每剝一顆蚵仔肉就多一個蚵仔，蝦仁、花枝在蚵仔肉入碗時有機會一起拿到（家 50%、王功 55%、東石 60%、布袋 70%、廣場和烤台 60%，兩種各一半），阿婆祕傳醬要丟中阿婆才有。</p><div class="fsList">`
    + FOODS.filter(f => f.price).map(f => {
      const k = 'food-' + f.id, u = D.px(k, f.price!);
      // 固定兩行：名稱＋說明／（特價）＋數量＋購買；按鈕字永遠是「買 N 個 $X」，不因數量換行
      return `<div class="fsRow"><span class="fdIc sm" style="--fc:${f.color}">${foodSvg(f, 16)}</span>`
        + `<div class="fsL1"><b>${f.n}</b><small>${lifeTxt(f)}・持有 ${foodCount(f.id)}</small></div>`
        + `<div class="fsL2"><span class="fsCd">${D.pxCd(k)}</span>${qtyHtml(k)}<button type="button" class="fsPay" data-fbuy="${f.id}" ${money < u ? 'disabled' : ''}>買 1 個 $${u}</button></div></div>`;
    }).join('') + '</div>';
}

/** 廣場食材攤面板（不限購）；只在廣場、站在攤前圓圈時打開 */
export function renderFoodStall() {
  const list = document.getElementById('foodStallList'); if (!list) return;
  const sv = document.getElementById('foodStallMoney'); if (sv) sv.textContent = `$${D.getSave().money}`;
  list.innerHTML = stallHtml();
  list.querySelectorAll<HTMLButtonElement>('button[data-fbuy]').forEach(b => {
    const f = FOOD_BY_ID[b.dataset.fbuy!]; const k = 'food-' + f.id;
    bindQty(b.closest('.fsRow')!, k, () => D.px(k, f.price!), () => D.getSave().money, b);
    b.onclick = async () => {
      if (!D.inPlaza()) { renderFoodStall(); return; }
      const pr = await D.payFor(k, f.price!, f.n); if (pr == null) return;
      const s = D.getSave(); const n = Math.min(getQty(k), Math.floor(s.money / pr)); if (n < 1) return;
      s.money -= pr * n; D.track('buy', { item: k, price: pr * n, qty: n });
      addFood(f.id, n, 'buy', 0, true); D.jingle(); D.pop(`買了 ${f.n} ×${n}`, '#bfe0ff');
      resetQty(k); renderFoodStall(); D.onMoney();
    };
  });
}
export function openFoodStall() {
  if (!D.inPlaza()) { D.toastTop('食材攤在廣場，進廣場後走到攤子前面就能買'); return; }
  if (!D.canOpenStall()) { D.toastTop('食材攤有人在買，站上隊伍最後面的圓圈排隊'); return; }
  purgeFood();
  const p = document.getElementById('foodStall'); if (!p) return;
  if (document.pointerLockElement) document.exitPointerLock();
  D.refreshPrices(); renderFoodStall(); p.classList.add('show'); p.scrollTop = 0;
}
