/** 主選單／彈窗忙碌／簽到提示／雜貨新品（從 main.ts 拆出，行為不變） */
import { todayKey } from '../core';
import { $ } from './dom';

export type MenuDeps = {
  getState: () => string;
  isTut: () => boolean;
  getSave: () => { tutDone?: number; days?: number; bonusN?: number; bonusDay?: string };
  LS: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void };
  Social: { local: (t: string) => void };
  giftAlert: () => void;
  svAlert: () => void;
  featAnnounce: () => void;
  shopKeys: () => string[];
  shopName: (k: string) => string;
  getShopTab: () => number;
  getShopNewIds: () => string[];
  KNIVES: { id: string; price: number; n: string }[];
  UMBS: { id: string; price: number; n: string }[];
  BOWLS: { id: string; price: number; n: string }[];
  GEAR: { id: string; price: number; n: string }[];
  EQUIP: { id: string; price: number; n: string }[];
  MEDS: { id: string; n: string }[];
  ITEMS: { id: string; n: string }[];
  openDaily: () => void;
};

let D: MenuDeps;

export function esc(v: string) { return v.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); }

export function bootQuiet() {
  const save = D.getSave();
  return !save.tutDone && (save.days ?? 0) < 1;
}

export function menuModalBusy() {
  return D.getState() === 'play' || D.isTut() || !$('overlay').classList.contains('show')
    || !!document.getElementById('giftMsg') || !!document.getElementById('newMsg') || !!document.getElementById('featMsg') || !!document.getElementById('svMsg') || !!document.getElementById('plazaGuide')
    || $('gift').classList.contains('show') || !!document.querySelector('.panel.show:not(#overlay)');
}

const CAL_TIP_KEY = 'calTipSeen1';
export function calTipOff() { try { localStorage.setItem(CAL_TIP_KEY, '1'); } catch { } document.getElementById('calTip')?.remove(); document.getElementById('calBtn')?.classList.remove('tipGlow'); }
export function calTipCheck() {
  try { if (localStorage.getItem(CAL_TIP_KEY)) return; } catch { return; }
  const save = D.getSave();
  if (!(save.bonusN ?? 0) || save.bonusDay === todayKey()) return;
  const b = document.getElementById('calBtn'); if (!b || document.getElementById('calTip')) return;
  b.classList.add('tipGlow');
  const t = document.createElement('div'); t.id = 'calTip';
  t.innerHTML = '<span>簽到移到這裡囉！點日曆領上工費</span><button class="calTipX" aria-label="關閉">✕</button>';
  document.body.appendChild(t);
  const place = () => { if (!t.isConnected) return; const r = b.getBoundingClientRect(); if (!r.width) { t.style.display = 'none'; return; } t.style.display = ''; t.style.top = `${r.bottom + 10}px`; t.style.right = `${Math.max(8, innerWidth - r.right - 4)}px`; t.style.setProperty('--ax', `${Math.max(12, innerWidth - r.right - 4 - Math.max(8, innerWidth - r.right - 4) + r.width / 2 - 7)}px`); requestAnimationFrame(place); };
  place();
  t.querySelector<HTMLButtonElement>('.calTipX')!.onclick = e => { e.stopPropagation(); calTipOff(); };
  t.onclick = () => { calTipOff(); D.openDaily(); };
}

const SHOP_RECENT = ['item-moon'];
const NEW_CAT: Record<string, string> = { knife: '刀具', umb: '雨傘', bowl: '器具', gear: '器具', cloth: '服飾', med: '藥品', item: '道具' };
const NEW_ATTR: [string, string][] = [['buy', 'knife'], ['eq', 'knife'], ['ubuy', 'umb'], ['ueq', 'umb'], ['bbuy', 'bowl'], ['beq', 'bowl'], ['gbuy', 'gear'], ['gtog', 'gear'], ['cbuy', 'gear'], ['ctog', 'gear'], ['slbuy', 'cloth'], ['sleq', 'cloth'], ['mbuy', 'med'], ['ibuy', 'item']];
const SHOP_NEW = { has: (k: string) => D.getShopNewIds().includes(k) || D.getShopNewIds().includes(k.split('-').slice(1).join('-')) };

let shopKnown: Set<string>, shopAnn: Set<string>;
let newSnap: string[] = [];

export function initMenu(deps: MenuDeps) {
  D = deps;
  let raw: any = null; try { raw = JSON.parse(D.LS.getItem('shopKnown') ?? 'null'); } catch { }
  const save = D.getSave();
  if (Array.isArray(raw)) shopKnown = new Set(raw);
  else { shopKnown = new Set(D.shopKeys().filter(k => !(save.days! > 0 && SHOP_RECENT.includes(k)))); try { D.LS.setItem('shopKnown', JSON.stringify([...shopKnown])); } catch { } }
  let a: any = null; try { a = JSON.parse(D.LS.getItem('shopAnn') ?? 'null'); } catch { } shopAnn = new Set(Array.isArray(a) ? a : []);
  setInterval(newAnnounce, 1500); setTimeout(newAnnounce, 2500);
  (window as any).__newShop = { now: () => newNow(), reset: () => { D.LS.removeItem('shopKnown'); D.LS.removeItem('shopAnn'); D.LS.removeItem('shopAnnDay'); } };
}

const newNow = () => D.shopKeys().filter(k => !shopKnown.has(k) || (SHOP_NEW.has(k) && !shopAnn.has('seen:' + k)));
const saveNew = () => { try { D.LS.setItem('shopKnown', JSON.stringify([...shopKnown])); D.LS.setItem('shopAnn', JSON.stringify([...shopAnn])); } catch { } };
const markSeen = (k: string) => { shopKnown.add(k); shopAnn.add('seen:' + k); };

export function newDecor() {
  const shop = $('shop'); if (!shop.classList.contains('show')) newSnap = newNow();
  const groups = Array.from(document.querySelectorAll<HTMLElement>('#shopList .stab'));
  let changed = false;
  const shopTab = D.getShopTab();
  groups.forEach((g, i) => { for (const [at, c] of NEW_ATTR) g.querySelectorAll(`button[data-${at}]`).forEach(b => {
    const k = c + '-' + b.getAttribute('data-' + at); if (!newSnap.includes(k)) return;
    const card = b.closest('tr, .slCard, .itemCard'); const nm = card?.querySelector('b');
    if (nm && !card!.querySelector('.newTag')) nm.insertAdjacentHTML('afterend', '<span class="newTag">新品</span>');
    if (i === shopTab && !shopKnown.has(k) || i === shopTab && !shopAnn.has('seen:' + k)) { markSeen(k); changed = true; } }); });
  if (changed) saveNew();
  const left = newNow();
  document.querySelectorAll<HTMLElement>('#shopTabs button').forEach(b => { const t = b.textContent ?? ''; b.classList.toggle('hasNew', left.some(k => t.includes(NEW_CAT[k.split('-')[0]]))); });
  newDots();
}

export function newDots() {
  const has = newNow().length > 0;
  for (const id of ['shopBtn', 'shopBtn2', 'oShop', 'eqShop']) { const b = document.getElementById(id); if (!b) continue; let d = b.querySelector('.newDot'); if (has && !d) b.insertAdjacentHTML('beforeend', '<span class="newDot">新</span>'); else if (!has && d) d.remove(); }
}

function openShopAt(k: string) {
  ($('shopBtn2') as HTMLButtonElement).click();
  const cat = NEW_CAT[k.split('-')[0]]; const i = Array.from(document.querySelectorAll('#shopTabs button')).findIndex(b => (b.textContent ?? '').includes(cat));
  if (i >= 0) (document.querySelectorAll('#shopTabs button')[i] as HTMLButtonElement).click();
}

export function newAnnounce() {
  newDots();
  if (bootQuiet()) return;
  const fresh = newNow().filter(k => !shopAnn.has(k)); if (!fresh.length) return;
  if (menuModalBusy()) return;
  const names = fresh.map(D.shopName).join('、');
  fresh.forEach(k => shopAnn.add(k)); saveNew();
  const day = todayKey(); if (D.LS.getItem('shopAnnDay') !== day) { try { D.LS.setItem('shopAnnDay', day); } catch { } D.Social.local(`雜貨店新上架：${names}`); }
  const m = document.createElement('div'); m.id = 'newMsg'; m.className = 'giftMsg';
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-shop"></i> 雜貨店新上架</b><p class="nmTx">雜貨店新上架：${esc(names)}</p><div class="mbtns"><button class="gmNo">晚點再說</button><button class="gmYes">去看看</button></div></div>`;
  const close = () => { m.remove(); setTimeout(() => { D.giftAlert(); D.svAlert(); D.featAnnounce(); }, 300); };
  m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
  m.querySelector('.gmYes')!.addEventListener('click', () => { close(); openShopAt(fresh[0]); });
  document.body.appendChild(m);
}
