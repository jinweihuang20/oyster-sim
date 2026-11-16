/** 請廣場阿婆吃蚵仔煎：選一盤收好的蚵仔煎，阿婆吃掉、玩家拿 $1,000。 */
import { comboName, comboHasFood } from './combo';
import { dishThumb } from './dish3d';

export const FEED_PAY = 1000;

export type FeedDeps = {
  getSave: () => { cookDish?: Record<string, number>; money: number };
  persist: () => void;
  isTut: () => boolean;
  toast: (text: string, color?: string) => void;
  /** 加錢後更新畫面 */
  onMoney: () => void;
  /** 阿婆吃的動畫＋對話；回傳 false＝阿婆不在旁邊了 */
  eat: (npcConnId: string, combo: number) => boolean;
  /** 還在不在阿婆旁邊（選的時候走開就關掉） */
  stillNear: (npcConnId: string) => boolean;
  sfx?: () => void;
};

let D: FeedDeps;
let box: HTMLDivElement | null = null;
let target: { connId: string; nick: string } | null = null;
let watch = 0;
/** 正在給（阿婆吃的動畫期間）：擋連點和重開選單再送 */
let busyUntil = 0;
const EAT_MS = 2300;

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const IC = {
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  coin: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>',
  dish: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="14" rx="9" ry="4.5"/><path d="M7 12c1.5-3 8.5-3 10 0"/></svg>',
};

export function initFeed(deps: FeedDeps) { D = deps; }

const stock = () => (D.getSave().cookDish ??= {});
/** 這款還能請幾盤：只算真的用到食材、數量是正整數的 */
function plates(S: Record<string, number>, id: number) {
  const n = S[String(id)];
  return comboHasFood(id) && Number.isInteger(n) && n > 0 ? n : 0;
}
/** 收好、可以請阿婆吃的盤數（沒有就不顯示「請阿婆吃」） */
export function cookedDishCount() {
  const S = D?.getSave().cookDish; if (!S) return 0;
  let t = 0; for (const k of Object.keys(S)) t += plates(S, Number(k));
  return t;
}
export const feedBusy = () => performance.now() < busyUntil;

export function feedOpen() { return !!box; }

export function closeFeed() {
  clearInterval(watch); watch = 0;
  box?.remove(); box = null; target = null;
}

export function openFeed(npc: { connId: string; nick: string }) {
  if (!D || D.isTut() || feedBusy()) return;
  closeFeed();
  target = npc;
  if (document.pointerLockElement) document.exitPointerLock();
  box = document.createElement('div');
  box.id = 'feedPick';
  box.addEventListener('pointerdown', e => { if (e.target === box) closeFeed(); });
  document.body.appendChild(box);
  render();
  // 走開（或阿婆被抱走）就收起來
  watch = window.setInterval(() => { if (target && !D.stillNear(target.connId)) { closeFeed(); D.toast('離阿婆太遠了，走近一點再請', '#ffb08a'); } }, 400);
}

function render() {
  if (!box || !target) return;
  const S = stock();
  const ids = Object.keys(S).map(Number).filter(id => plates(S, id) > 0).sort((a, b) => (S[String(b)] - S[String(a)]) || a - b);
  const who = esc(target.nick || '阿婆');
  const list = ids.length
    ? `<ul class="fpList">${ids.map(id => `<li class="fpRow"><img class="fpImg" alt="" src="${dishThumb(id)}" width="48" height="48"><div class="fpTx"><b>${esc(comboName(id))}</b><small>還有 ${S[String(id)]} 盤</small></div><button type="button" class="fpGo" data-feed="${id}">請吃</button></li>`).join('')}</ul>`
    : `<div class="fpEmpty">${IC.dish}<p>還沒有煎好的蚵仔煎。到廣場中央或第 5 桌的煎台，或在主選單按「煎蚵仔煎」煎一盤再來。</p></div>`;
  box.innerHTML = `<div class="fpCard" role="dialog" aria-label="請${who}吃蚵仔煎"><div class="fpHead"><b>請${who}吃蚵仔煎</b><button type="button" class="fpX" aria-label="關閉">${IC.x}</button></div>`
    + `<p class="fpNote">${IC.coin}<span>每請一盤，${who}會給你 $${FEED_PAY.toLocaleString()}</span></p>${list}</div>`;
  box.querySelector<HTMLButtonElement>('.fpX')!.onclick = closeFeed;
  box.querySelectorAll<HTMLButtonElement>('button[data-feed]').forEach(b => b.onclick = () => give(Number(b.dataset.feed)));
}

function give(id: number) {
  if (!target || !box || feedBusy()) return;
  // 先鎖住所有按鈕，連點只會算第一下
  box.querySelectorAll<HTMLButtonElement>('button[data-feed]').forEach(b => { b.disabled = true; });
  const S = stock(), k = String(id);
  if (!(plates(S, id) > 0)) { if (!comboHasFood(id)) delete S[k]; render(); return; }
  if (!D.eat(target.connId, id)) { closeFeed(); D.toast('阿婆不在旁邊了', '#ffb08a'); return; }
  busyUntil = performance.now() + EAT_MS;
  // 先扣一盤再給錢
  const left = S[k] - 1; if (left > 0) S[k] = left; else delete S[k];
  const s = D.getSave(); s.money += FEED_PAY;
  D.persist(); D.onMoney();
  try { D.sfx?.(); } catch { /* 音效失敗不影響 */ }
  D.toast(`${target.nick || '阿婆'}吃得很開心，給你 $${FEED_PAY.toLocaleString()}`, '#9be37a');
  closeFeed();
}
