/** 禮物信箱／領取（從 main.ts 拆出，行為不變） */
import type { Save } from '../core';
import { $ } from '../ui';
import * as Social from './social';
import { EQUIP, ODD } from '../shop';

export type GiftItem = { id: string; n: string };
export type GiftPearl = { name: string };

export type GiftsDeps = {
  getSave: () => Save;
  persist: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  renderDex: () => void;
  renderDaily: () => void;
  getState: () => string;
  isTut: () => boolean;
  bootQuiet: () => boolean;
  LS: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };
  audio: () => void;
  tone: (freq: number, dur: number, vol: number, type?: OscillatorType, delay?: number, glideTo?: number) => void;
  RAR: GiftPearl[];
  ITEMS: GiftItem[];
  svAlert: () => void;
  featAnnounce: () => void;
  newAnnounce: () => void;
};

let D: GiftsDeps;
let giftList: Social.Gift[] = [], giftAt = 0;
let giftSeen: string[] = [];

export function initGifts(deps: GiftsDeps) {
  D = deps;
  try { giftSeen = JSON.parse(D.LS.getItem('giftSeen') || '[]'); } catch { giftSeen = []; }
  setTimeout(() => checkGifts(true), 3000);
  Social.onPresence(() => { checkGifts(); });
  $('oGift').onclick = () => { renderGifts(); $('gift').classList.add('show'); };
  $('giftClose').onclick = () => $('gift').classList.remove('show');
}

export async function checkGifts(force = false) {
  if (!force && Date.now() - giftAt < 20e3) return; giftAt = Date.now();
  try { giftList = await Social.gifts(); } catch { giftList = []; }
  const b = document.getElementById('oGift'); if (b) b.style.display = giftList.length ? '' : 'none';
  giftAlert();
}

function giftNew() { return giftList.filter(g => !giftSeen.includes(String(g.id))); }

export function giftAlert() {
  const n = giftNew(), h = document.getElementById('giftHud');
  if (h) h.style.display = D.getState() === 'play' && n.length ? '' : 'none';
  if (D.bootQuiet()) return;
  if (!n.length || D.getState() === 'play' || D.isTut() || document.getElementById('giftMsg') || document.getElementById('newMsg') || document.getElementById('featMsg') || document.getElementById('svMsg') || $('gift').classList.contains('show')) return;
  for (const g of n) giftSeen.push(String(g.id));
  while (giftSeen.length > 200) giftSeen.shift();
  try { D.LS.setItem('giftSeen', JSON.stringify(giftSeen)); } catch { /* 忽略 */ }
  giftNotice(n);
}

function giftNotice(n: Social.Gift[]) {
  const esc2 = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const m = document.createElement('div'); m.id = 'giftMsg'; m.className = 'giftMsg';
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-gift"></i> 你有新禮物</b><ul class="gnList">${n.map(g => `<li>${esc2(giftLabel(g))}${g.message ? `<br><small>「${esc2(g.message)}」</small>` : ''}</li>`).join('')}</ul><div class="mbtns"><button class="gmNo">稍後再領</button><button class="gmYes"><i class="ic ic-check"></i> 領取</button></div></div>`;
  const close = () => { m.remove(); setTimeout(() => { D.svAlert(); D.featAnnounce(); D.newAnnounce(); }, 300); };
  m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
  m.addEventListener('click', e => { if (e.target === m) close(); });
  const y = m.querySelector<HTMLButtonElement>('.gmYes')!;
  y.addEventListener('click', async () => {
    if (y.disabled) return; y.disabled = true; y.textContent = '領取中…';
    const got: string[] = []; let bad = '';
    const save = D.getSave();
    for (const g of n) {
      const r = await Social.claimGift(g.id);
      if (r.st === 'retry') { bad = r.why ?? '等一下再試'; continue; }
      giftList = giftList.filter(x => String(x.id) !== String(g.id));
      if (r.st === 'ok') { const gg = r.gift ?? g; applyGift(gg); got.push(giftGot(gg)); if (gg.message) got.push(`「${gg.message}」`); D.track('gift_claim', { type: gg.type, money: save.money }); }
      else bad = r.why ?? '這份禮物已經不能領了';
    }
    D.renderDaily(); giftBadge(); close();
    if (got.length) {
      try { D.audio(); for (let k = 0; k < 5; k++) D.tone(1100 + k * 200, 0.12, 0.08, 'square', k * 0.06, 1600 + k * 200); D.tone(659, 0.45, 0.12, 'triangle', 0.35); } catch { }
      giftMsg(true, '已領取！', [...got, ...(bad ? [`有一份沒領到：${bad}`] : []), `身上有 $${save.money}`]);
    } else giftMsg(false, '沒領到', [bad || '等一下再試']);
  });
  document.body.appendChild(m);
}

export function giftLabel(g: Social.Gift) {
  if (g.type === 'money') return `$${Math.max(0, Math.floor(+g.amount! || 0))}`;
  if (g.type === 'equip') return EQUIP.find(e => e.id === g.itemId)?.n ?? '服飾';
  if (g.type === 'odd') return ODD[+g.itemId!]?.name ?? '奇物';
  if (g.type === 'pearl') return D.RAR[+(g.tier ?? 0)]?.name ?? '珍珠';
  if (g.type === 'item') return D.ITEMS.find(i => 'item-' + i.id === String(g.itemId) || i.id === String(g.itemId))?.n ?? '道具';
  return '禮物';
}

export function applyGift(g: Social.Gift) {
  const save = D.getSave();
  if (g.type === 'money') save.money += Math.max(0, Math.floor(+g.amount! || 0));
  else if (g.type === 'equip') { if (EQUIP.some(e => e.id === g.itemId) && !save.shop.owned.includes(g.itemId as string)) save.shop.owned.push(g.itemId as string); }
  else if (g.type === 'odd') { const i = +g.itemId!; if (Number.isInteger(i) && i >= 0 && i < save.odd.length) save.odd[i]++; }
  else if (g.type === 'pearl') { const t = +(g.tier ?? 0); if (Number.isInteger(t) && t >= 0 && t < save.dex.length) save.dex[t]++; }
  else if (g.type === 'item') { const it = D.ITEMS.find(i => 'item-' + i.id === String(g.itemId) || i.id === String(g.itemId)); if (it) save.meds[it.id] = (save.meds[it.id] ?? 0) + 1; }
  D.persist(); D.renderDex();
}

export function giftBadge() { const ob = document.getElementById('oGift'); if (ob) ob.style.display = giftList.length ? '' : 'none'; }

export function giftMsg(ok: boolean, title: string, lines: string[]) {
  document.getElementById('giftMsg')?.remove();
  const esc2 = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const m = document.createElement('div'); m.id = 'giftMsg'; m.className = 'giftMsg' + (ok ? '' : ' bad');
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ${ok ? 'ic-gift' : 'ic-warn'}"></i> ${esc2(title)}</b><ul>${lines.map(l => `<li>${esc2(l)}</li>`).join('')}</ul><div class="mbtns"><button class="gmOk"><i class="ic ic-check"></i> 確定</button></div></div>`;
  const close = () => m.remove();
  m.querySelectorAll('button').forEach(b => b.addEventListener('click', close));
  m.addEventListener('click', e => { if (e.target === m) close(); });
  document.body.appendChild(m);
}

function giftGot(g: Social.Gift) { return g.type === 'money' ? `+${giftLabel(g)}` : `${g.type === 'equip' ? '服飾' : g.type === 'odd' ? '奇物' : g.type === 'item' ? '道具' : '珍珠'}：${giftLabel(g)}`; }

export function renderGifts() {
  const esc2 = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const save = D.getSave();
  $('giftBody').innerHTML = giftList.length ? giftList.map(g => `<div class="gfRow"><div><b>${esc2(giftLabel(g))}</b><small>${esc2(g.message ?? '')}</small></div><button data-gift="${esc2(String(g.id))}">領取</button></div>`).join('') : '<p class="eqHint">目前沒有禮物。</p>';
  $('giftBody').querySelectorAll<HTMLButtonElement>('button[data-gift]').forEach(b => b.onclick = async () => {
    if (b.disabled) return;
    const id = b.getAttribute('data-gift')!; b.disabled = true; b.classList.add('busy'); b.textContent = '領取中…';
    const local = giftList.find(x => String(x.id) === id);
    const r = await Social.claimGift(id);
    if (r.st === 'retry') { b.disabled = false; b.classList.remove('busy'); b.textContent = '領取'; giftMsg(false, '沒領到', [r.why ?? '等一下再試']); return; }
    giftList = giftList.filter(x => String(x.id) !== id);
    if (r.st === 'ok') {
      const g = r.gift ?? local!; applyGift(g); D.renderDaily();
      try { D.audio(); for (let k = 0; k < 5; k++) D.tone(1100 + k * 200, 0.12, 0.08, 'square', k * 0.06, 1600 + k * 200); D.tone(659, 0.45, 0.12, 'triangle', 0.35); } catch { }
      D.track('gift_claim', { type: g.type, money: save.money });
      giftMsg(true, '已領取！', [giftGot(g), ...(g.message ? [`「${g.message}」`] : []), `身上有 $${save.money}`]);
    } else giftMsg(false, '沒領到', [r.why ?? '這份禮物已經不能領了']);
    renderGifts(); giftBadge();
  });
}
