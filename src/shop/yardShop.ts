/** 工寮雜貨：刀／傘／碗／槍與伺服器價格（從 main.ts 拆出，行為不變） */
import type { Save } from '../core';
import { $ } from '../ui';
import {
  shopWeapons, WEAPON_DEFS, isWeaponId, openWeaponPreview,
  type WeaponId,
} from '../deathmatch';
import type * as THREE from 'three';

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

export const GEAR = [
  { id: 'glove', n: '🧤 棉紗手套', price: 120, good: '割到手的傷害減半', bad: '手套厚，指針速度 +5%' },
  { id: 'radio', n: '收音機', price: 300, good: '阿婆氣消得快：怒氣增加 ×0.7（聽廣播心情好）', bad: '太吵：丟殼預警變晚（⚠ 和提示聲晚一半才出現）' },
  { id: 'glasses', n: '👓 老花眼鏡', price: 200, good: '蚵仔縫更亮更粗、光暈更大；插刀判定範圍 +25%', bad: '看遠有點霧：畫面邊緣微暗' }];
export const KNIVES: Knife[] = [
  { id: 'basic', luck: 1, n: '舊蚵刀', price: 0, green: 1, speed: 1, steps: 0, stab: 1, seam: 1, blade: 0xd0d0d8, desc: '媽媽留下來的，普普通通' },
  { id: 'dull', luck: 3, n: '便宜鈍刀', price: 20, green: 0.7, speed: 0.85, steps: 0, stab: 1.5, seam: 1, blade: 0x8a8a80, desc: '夜市 20 塊，指針較慢、運氣特別好，但綠區小、很常割到手' },
  { id: 'wide', luck: 0, n: '寬口刀', price: 150, green: 1.5, speed: 1.35, steps: 0, stab: 1, seam: 0.85, blade: 0xe8e0c8, desc: '刀面寬，綠區大，但指針快、比較難找縫' },
  { id: 'point', luck: 2, n: '尖口刀', price: 200, green: 0.9, speed: 1, steps: -1, stab: 1.6, seam: 1, blade: 0xb0c8e0, desc: '尖尖的一下就進去，少撬一下，運氣較好，但比較危險' },
  { id: 'seam', luck: 0, n: '找縫刀', price: 180, green: 0.9, speed: 1.1, steps: 0, stab: 0.8, seam: 1.6, blade: 0xc8e0b0, desc: '找縫很簡單，撬的時候比較費力' },
  { id: 'master', luck: 4, n: '師傅刀', price: 1200, green: 1.2, speed: 0.95, steps: -1, stab: 0.6, seam: 1.25, blade: 0xffe28a, desc: '老師傅手工，樣樣好，就是貴' },
];
export const UMBS: Umb[] = [
  { id: 'stripe', n: '紅白傘', price: 0, open: 0.05, dur: 4, perf: 0.28, cover: 0.95, reflect: 1, look: 'stripe', size: 1, desc: '工寮門口撿到的，各方面都普通好用' },
  { id: 'clear', n: '超商透明傘', price: 30, open: 0.05, dur: 3, perf: 0.2, cover: 0.85, reflect: 0.6, look: 'clear', size: 0.8, desc: '便宜又輕，但傘面小、反彈沒力，撐一下手就痠' },
  { id: 'fold', n: '自動摺疊傘', price: 160, open: 0, dur: 3, perf: 0.4, cover: 0.8, reflect: 1.2, look: 'navy', size: 0.7, desc: '一按就開，完美反彈時機最寬，但傘面小' },
  { id: 'beach', n: '海灘陽傘', price: 260, open: 0.25, dur: 8, perf: 0.15, cover: 1, reflect: 0.8, look: 'beach', size: 1.3, desc: '又大又能撐很久，但開傘比較慢、完美時機窄' },
  { id: 'temple', n: '廟會涼傘', price: 1500, open: 0.05, dur: 5, perf: 0.35, cover: 1, reflect: 1.6, look: 'temple', size: 1.05, desc: '神明的涼傘，反彈超有力，就是貴' },
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
export function openShopPx() { fetchPrices().then(r => { if (r === 'changed' && $('shop').classList.contains('show')) renderShop(); }); }
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
export function renderShop() {
  if (!D.getSave().shop.owned.includes('basic')) D.getSave().shop.owned.push('basic');
  ensureStarterWeapons();
  const cur = knifeNow().id;
  $('shopList').innerHTML = `<h3><i class="ic ic-knife"></i> 剝殼刀</h3><table class="kt"><tr><th>刀</th><th>綠區</th><th>指針速</th><th>撬幾下</th><th>割手率</th><th>找縫</th><th>幸運</th><th></th></tr>` + KNIVES.map(k => {
    const own = D.getSave().shop.owned.includes(k.id);
    const tr = D.getSave().trial?.id === k.id, btn = tr ? `${k.id === cur ? '<b>使用中</b><br>' : `<button data-eq="${k.id}">換</button><br>`}<button data-buy="${k.id}" ${D.getSave().money < px(k.id, k.price) ? 'disabled' : ''}>${pxHtml(k.id, k.price, '買斷 ')}</button>` : k.id === cur ? '<b>使用中</b>' : own ? `<button data-eq="${k.id}">換</button>` : `<button data-buy="${k.id}" ${D.getSave().money < px(k.id, k.price) ? 'disabled' : ''}>${pxHtml(k.id, k.price)}</button>`;
    return `<tr><td><b>${k.n}</b>${(() => { const tr = D.getSave().trial; return tr?.id === k.id ? ` <span class="trialTag">試用剩 ${tr.left} 班</span>` : ''; })()}<br><small>${k.desc}</small>${pxCd(k.id)}</td><td>${pctTxt(k.green, true)}</td><td>${pctTxt(k.speed, false)}</td><td>${k.steps ? `<b style="color:${k.steps < 0 ? '#9be37a' : '#ff8a7a'}">${k.steps > 0 ? '+' : ''}${k.steps}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${pctTxt(k.stab, false)}</td><td>${pctTxt(k.seam, true)}</td><td>${k.luck ? `<b style="color:#f2c440">${'🍀'.repeat(k.luck)}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!D.getSave().shop.owned.includes('stripe')) D.getSave().shop.owned.push('stripe');
  const cu = umbNow().id, B = UMBS[0];
  const rel = (v: number, b: number, goodHigh: boolean, unit: string) => { if (v === b) return `<span style="opacity:.6">${v}${unit}</span>`; const good = goodHigh ? v > b : v < b; return `<b style="color:${good ? '#9be37a' : '#ff8a7a'}">${v}${unit}</b>`; };
  $('shopList').innerHTML += `<h3><i class="ic ic-umb"></i> 雨傘</h3><table class="kt"><tr><th>傘</th><th>開傘</th><th>可撐</th><th>完美窗</th><th>遮擋</th><th>反彈力</th><th></th></tr>` + UMBS.map(u => {
    const own = D.getSave().shop.owned.includes(u.id);
    const btn = u.id === cu ? '<b>使用中</b>' : own ? `<button data-ueq="${u.id}">換</button>` : `<button data-ubuy="${u.id}" ${D.getSave().money < px(u.id, u.price) ? 'disabled' : ''}>${pxHtml(u.id, u.price)}</button>`;
    return `<tr><td><b>${u.n}</b><br><small>${u.desc}</small>${pxCd(u.id)}</td><td>${rel(u.open, B.open, false, 's')}</td><td>${rel(u.dur, B.dur, true, 's')}</td><td>${rel(u.perf, B.perf, true, 's')}</td><td>${rel(Math.round(u.cover * 100), 95, true, '%')}</td><td>${rel(u.reflect, 1, true, '×')}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!D.getSave().shop.owned.includes('plastic')) D.getSave().shop.owned.push('plastic');
  const cb = bowlNow().id;
  $('shopList').innerHTML += `<h3><i class="ic ic-bowl"></i> 盆仔</h3><table class="kt"><tr><th>盆</th><th>加價</th><th></th></tr>` + BOWLS.map(b => {
    const own = D.getSave().shop.owned.includes(b.id);
    const bk = b.id === 'wide' ? 'bowl-wide' : b.id; const btn = b.id === cb ? '<b>使用中</b>' : own ? `<button data-beq="${b.id}">換</button>` : `<button data-bbuy="${b.id}" ${D.getSave().money < px(bk, b.price) ? 'disabled' : ''}>${pxHtml(bk, b.price)}</button>`;
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
    return `<tr><td><b>${g.n}</b><br><small style="color:#9be37a">${g.good}</small><small style="color:#ff8a7a">${g.bad}</small>${pxCd(g.id)}</td><td>${own ? `<button data-gtog="${g.id}">${on ? '✅ 使用中' : '⬜ 沒用'}</button>` : `<button data-gbuy="${g.id}" ${D.getSave().money < px(g.id, g.price) ? 'disabled' : ''}>${pxHtml(g.id, g.price)}</button>`}</td></tr>`; }).join('') + '</table>');
  $('shopList').querySelectorAll('button[data-gbuy],button[data-gtog]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-gbuy') || b.getAttribute('data-gtog')!; const g = GEAR.find(x => x.id === id)!; const save = D.getSave(); save.gear = save.gear ?? {};
    if (b.hasAttribute('data-gbuy')) { const pr = await payFor(id, g.price, g.n.replace(/^\S+\s/, '')); if (pr == null) return; save.money -= pr; save.shop.owned.push(id); save.gear[id] = true; D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); }
    else save.gear[id] = !gearOn(id);
    D.persist(); renderShop(); D.drawRadio(); D.applyGloves();
  });
  const cw = weaponNow();
  $('shopList').insertAdjacentHTML('beforeend', `<h3><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg> 槍枝</h3><p style="font-size:12px;opacity:.8"><b style="color:#d9952b">點整列可預覽 3D 模型</b>（進去後拖曳旋轉）；買了才能在死鬥裡裝備；${WEAPON_DEFS.oysterGun.name}開局就送。${import.meta.env.DEV ? '（開發模式：全部已解鎖）' : ''}</p><table class="kt"><tr><th>槍</th><th>傷害</th><th>彈匣</th><th>射速</th><th>彈速</th><th></th></tr>` + shopWeapons().map(w => {
    const own = ownsWeapon(w.id);
    const btn = w.id === cw ? '<b>死鬥預設</b>' : own ? `<button data-weq="${w.id}">設為預設</button>` : `<button data-wbuy="${w.id}" ${D.getSave().money < px(w.id, w.price) ? 'disabled' : ''}>${pxHtml(w.id, w.price)}</button>`;
    return `<tr class="wpnRow" data-wprev="${w.id}" role="button" tabindex="0" title="點擊預覽"><td><b>${w.name}</b> <small style="opacity:.7">預覽</small><br><small>${w.blurb}</small>${pxCd(w.id)}</td><td>${w.damage}${w.pelletCount > 1 ? `<br><small>×${w.pelletCount}</small>` : ''}</td><td>${w.maxAmmo}</td><td>${w.fireRate.toFixed(1)}/s${w.burstCount > 1 ? `<br><small>${w.burstCount} 連發</small>` : ''}${w.pelletCount > 1 ? `<br><small>散彈 ×${w.pelletCount}</small>` : ''}</td><td>${w.bulletSpeed}</td><td>${btn}</td></tr>`;
  }).join('') + '</table>');
  const wpnPrevCtx = () => ({ shellGeos: D.shellGeos, shellMat: D.pileMat });
  const showWpnPrev = (id: WeaponId) => {
    const w = WEAPON_DEFS[id];
    const own = ownsWeapon(id);
    const isDef = weaponNow() === id;
    const act = isDef
      ? '<button type="button" class="ghost" disabled>死鬥預設中</button>'
      : own
        ? `<button type="button" data-prev-eq="${id}">設為死鬥預設</button>`
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
}

export const getShopNewIds = () => shopNewIds;
