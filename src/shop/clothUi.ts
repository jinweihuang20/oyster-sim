/** 裝備／服飾店 UI（從 main.ts 拆出，行為不變） */
import * as THREE from 'three';
import type { Save } from '../core';
import { $ } from '../ui';
import { type Slot, type Fx, type Eq, SLOTS, EQUIP, SETS, NONE_ID, isNoneId, defaultEquipId, stealHoldSeconds } from './shopEquip';
import { EQUIP_VIS, paintEquipCanvas } from './equipVisual';
import { openClothTryPreview, closeClothTryPreview } from './tryPreview';
import { hydrateEquipThumbs } from './equipThumb';
import { refreshEqPreview, snapshotEqPreview } from './equipPreview';

export type ClothUiDeps = {
  getSave: () => Save;
  persist: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  getAc: () => AudioContext | null;
  SFX: { jingle: (up?: boolean) => void };
  applyOutfit3: () => void;
  renderShop: () => void;
  openShopPx: () => void;
  getShopTab: () => number;
  setShopTab: (n: number) => void;
  px: (k: string, base: number) => number;
  pxCd: (k: string) => string;
  pxHtml: (k: string, base: number, pre?: string) => string;
  payFor: (k: string, base: number, name: string) => Promise<number | null>;
  syncEqPreview: (el: HTMLElement, outfit: { head: string; hand: string; body: string; legs: string; feet: string }) => void;
  stopEqPreview: () => void;
  myName: () => string;
  statsId: string;
  COARSE: boolean;
  sleeve: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  shirtCuff: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  getEqFromRes: () => boolean;
  setEqFromRes: (v: boolean) => void;
  setShopFromEquip: (v: boolean) => void;
  isEvRun: () => boolean;
  getSleeveTry: () => string | null;
  setSleeveTry: (v: string | null) => void;
  getClothTab: () => Slot;
  setClothTab: (v: Slot) => void;
  getEqPick: () => Slot | null;
  setEqPick: (v: Slot | null) => void;
};

let D: ClothUiDeps;
export function initClothUi(deps: ClothUiDeps) { D = deps; }

// Slot/EQUIP/SETS → shopEquip.ts
export const eqOwned = (id: string) => (EQUIP.find(e => e.id === id)?.price === 0) || D.getSave().shop.owned.includes(id);
export const setEquip = (slot: Slot, id: string) => { const save = D.getSave(); save.equip = save.equip ?? {}; save.equip[slot] = id; };
export const equipNow = (slot: Slot) => EQUIP.find(e => e.slot === slot && e.id === D.getSave().equip?.[slot] && eqOwned(e.id)) ?? EQUIP.find(e => e.id === defaultEquipId(slot))!;
export const wornIds = () => SLOTS.map(([s]) => equipNow(s).id);
export const setsOn = () => { const w = wornIds(); return SETS.filter(s => s.need.every(i => w.includes(i))); };
export const slOn = (id: string) => wornIds().includes(id);
export function fxAll(): Required<Fx> {
  const r = { bowl: 0, keep: 0, speed: 1, pearl: 1, nag: 1, throw: 1, dmg: 1, luck: 0, steal: 0 };
  for (const f of [...SLOTS.map(([s]) => equipNow(s).fx), ...setsOn().map(s => s.fx)]) { r.bowl += f.bowl ?? 0; r.keep += f.keep ?? 0; r.luck += f.luck ?? 0; r.steal += f.steal ?? 0; r.speed *= f.speed ?? 1; r.pearl *= f.pearl ?? 1; r.nag *= f.nag ?? 1; r.throw *= f.throw ?? 1; r.dmg *= f.dmg ?? 1; }
  r.keep = Math.min(0.7, r.keep); r.throw = Math.max(0.1, r.throw);
  if (D.isEvRun()) { r.throw = Math.max(1, r.throw); r.nag = Math.max(1, r.nag); } // 活動中阿婆是瘋子：怕你、少丟、少唸的效果都不算
  return r;
}
export function migrateEquip() {
  const save = D.getSave();
  save.equip = save.equip ?? {};
  if (save.shop?.owned) save.shop.owned = save.shop.owned.filter(id => id !== 'bd_nude');
  for (const [s] of SLOTS) {
    let cur = save.equip[s];
    if (s === 'body' && cur === 'bd_nude') cur = NONE_ID.body;
    if (cur === 'none') cur = NONE_ID[s];
    save.equip[s] = cur;
    if (!save.equip[s] || !eqOwned(save.equip[s])) save.equip[s] = defaultEquipId(s);
  }
}
export const SCARED = ['這個人看起來很流氓…', '不要惹那位', '手上那個刺青…你敢丟殼你丟', '小聲點，那個人在看', '我剛剛什麼都沒說喔', '那個刺青是真的嗎…', '今天大家安靜剝蚵就好', '殼不要往那邊丟啦', '那位是哪個角頭的…', '好啦好啦，我專心剝', '這位做的鐵板燒一定很好吃'];
export function patDraw(g: CanvasRenderingContext2D, e: Eq, W: number, H: number) {
  g.fillStyle = e.base; g.fillRect(0, 0, W, H);
  const dot = (x: number, y: number, r: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  if (e.pat === 'flower') for (let i = 0; i < 40; i++) { const x = (i * 37) % W, y = (i * 53) % H; for (let k = 0; k < 5; k++) dot(x + Math.cos(k * 1.26) * 5, y + Math.sin(k * 1.26) * 5, 3, '#fff3c8'); dot(x, y, 2.5, '#3a8a4a'); }
  if (e.pat === 'rain') { g.strokeStyle = '#fff7a0'; g.lineWidth = 3; for (let y = 10; y < H; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
  if (e.pat === 'camo') for (let i = 0; i < 30; i++) dot((i * 41) % W, (i * 29) % H, 8 + (i % 3) * 4, ['#2e3a1e', '#8a7a4a', '#3e5228'][i % 3]);
  if (e.pat === 'neon') { g.fillStyle = '#ffffff'; for (let y = 20; y < H; y += 40) g.fillRect(0, y, W, 6); }
  if (e.pat === 'tattoo') { g.strokeStyle = '#1e2a4a'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(W / 2, H + 12 - i * 22, 40, Math.PI, 2 * Math.PI); g.stroke(); } dot(40, 40, 9, '#b8323a'); dot(90, 80, 9, '#2a5a9a'); }
  if (e.pat === 'dragon') { g.strokeStyle = '#ffd25a'; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, H / 2 + Math.sin(x / 10) * 26); g.stroke(); }
  if (e.pat === 'karakusa') { g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, W, H); g.strokeStyle = '#1e3358'; g.lineWidth = 2.4; g.lineCap = 'round'; for (let row = 0; row < 5; row++) { const y0 = 12 + row * (H / 5); g.beginPath(); for (let x = 0; x <= W; x += 4) { const y = y0 + Math.sin(x / 14 + row) * 10; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); for (let i = 0; i < 4; i++) { const x = 16 + i * (W / 4); const y = y0 + Math.sin(x / 14 + row) * 10; g.beginPath(); g.ellipse(x, y - 6, 7, 4, -0.7, 0, 7); g.stroke(); g.beginPath(); g.ellipse(x + 8, y + 6, 7, 4, 0.8, 0, 7); g.stroke(); } } }
}
export function eqTex(e: Eq) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const vis = EQUIP_VIS.find(x => x.id === e.id);
  const g = c.getContext('2d')!;
  if (vis) paintEquipCanvas(g, vis, 128, 128);
  else { g.fillStyle = e.base; g.fillRect(0, 0, 128, 128); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return tex;
}
export function applySleeve() {
  const trying = D.getSleeveTry();
  const s = trying ? EQUIP.find(x => x.id === trying)! : equipNow('hand');
  const body = equipNow('body');
  const shirtless = body.id === 'bd_bikini' || body.id === 'bd_none';
  const sleeveless = body.id === 'bd_singlet';
  const bare = !trying && (s.id === 'hn_none' || ((shirtless || sleeveless) && s.id === 'hn_basic'));
  if (bare) {
    D.sleeve.map?.dispose();
    D.sleeve.map = null;
    D.sleeve.color.set('#e8bc98');
    D.sleeve.emissive.set(0);
    D.sleeve.needsUpdate = true;
    D.shirtCuff.color.set('#e8bc98');
    return;
  }
  D.sleeve.map?.dispose(); D.sleeve.map = eqTex(s); D.sleeve.color.set(0xffffff);
  D.sleeve.emissive.set(s.pat === 'neon' ? 0x1a8a50 : 0x000000); D.sleeve.needsUpdate = true;
  D.shirtCuff.color.set((shirtless || sleeveless) ? s.base : body.base);
}
export function sleeveGold() { if (!slOn('sl_dragon')) return; let k = 0; const iv = setInterval(() => { D.sleeve.emissive.set(k % 2 ? 0x000000 : 0xb08010); if (++k > 8) { clearInterval(iv); D.sleeve.emissive.set(0); } }, 150); }
// 線條圖示：各部位一個簡單輪廓，填該件顏色
let eqSvgN = 0;
export function eqSvg(e: Eq, w = 72, grey = false) {
  const s = '#1b1b1b', f = grey ? '#a8a8a8' : e.base;
  const P: Record<Slot, string> = {
    head: `<path d="M10 40Q36 6 62 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M6 40H66" stroke="${s}" stroke-width="2.5"/>`,
    hand: `<rect x="6" y="18" width="44" height="22" rx="8" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    body: `<path d="M22 10L8 20l6 10 6-4v30h32V26l6 4 6-10-14-10-6 6h-16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    legs: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    feet: `<path d="M10 40q0-14 16-14h14q16 4 22 14v6H10Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>` };
  const ID: Record<string, string> = {
    sl_flower: `<defs><clipPath id="c_sl_flower"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_flower)"><g transform="translate(14 24)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(26 33)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(38 23)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(46 34)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(10 36)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(32 28)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><path d="M18 30l3-2M42 29l3 2M30 37l3-1" stroke="#3a8a4a" stroke-width="1.5"/></g><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_rain: `<defs><clipPath id="c_sl_rain"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_rain)"><path d="M12 22q12-3 28 0" stroke="#fff8c8" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 26v10M34 26v10" stroke="#c8a010" stroke-width="1.2"/><path d="M14 30q2 3 0 5" stroke="#5aa8e8" stroke-width="1.6" fill="none"/></g><path d="M44 18v22" stroke="${s}" stroke-width="2"/><path d="M46 19v20" stroke="#c8a010" stroke-width="1"/><path d="M48 19v20" stroke="#c8a010" stroke-width="1"/><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_89: `<defs><clipPath id="c_sl_89"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="#e8b890"/><g clip-path="url(#c_sl_89)"><path d="M6 34q5-4 10 0t10 0t10 0t10 0V40H6Z" fill="#2a4a8a" stroke="${s}" stroke-width="1.2"/><path d="M9 34q2-3 4 0M21 34q2-3 4 0M33 34q2-3 4 0" stroke="#fff" stroke-width="1" fill="none"/><path d="M18 26q6-6 12 0q-6 6-12 0Z" fill="#e8501a" stroke="${s}" stroke-width="1.2"/><path d="M30 26l5-3v6Z" fill="#e8501a" stroke="${s}" stroke-width="1.2"/><circle cx="21" cy="25.5" r=".8" fill="${s}"/><path d="M36 21q3-3 6 0q3-2 5 1" stroke="${s}" stroke-width="1.3" fill="none"/><path d="M8 22q3-3 6 0" stroke="${s}" stroke-width="1.3" fill="none"/></g><rect x="6" y="18" width="5" height="22" fill="#3a5a8a"/><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_camo: `<defs><clipPath id="c_sl_camo"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_camo)"><path d="M6 22q6-4 10 0t6 6q-6 4-10 0Z" fill="#8a7a4a"/><path d="M24 30q6-4 12 0t4 8H22Z" fill="#2e3a1e"/><path d="M34 18q6 2 8 6t-6 4q-4-2-2-10Z" fill="#2e3a1e"/><path d="M10 34q4-2 8 2l-2 4H8Z" fill="#2e3a1e"/><path d="M40 32q4-2 8 0v6q-6 0-8-6Z" fill="#8a7a4a"/></g><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_neon: `<defs><clipPath id="c_sl_neon"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_neon)"><rect x="6" y="27" width="44" height="5" fill="#e8f0f0" stroke="${s}" stroke-width="1"/><path d="M12 27l3 5M20 27l3 5M28 27l3 5M36 27l3 5" stroke="#9ab" stroke-width="1"/><path d="M10 22h14" stroke="#c8ffe0" stroke-width="2" stroke-linecap="round"/></g><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/><path d="M2 24l-3-2M2 30h-4M2 36l-3 2" stroke="#39ff9a" stroke-width="1.6" stroke-linecap="round"/>`,
    sl_dragon: `<defs><clipPath id="c_sl_dragon"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_dragon)"><path d="M8 33q6-10 12-2t12-2t10-6" stroke="#e8b830" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M8 33q6-10 12-2t12-2t10-6" stroke="#fff3a8" stroke-width=".7" fill="none" stroke-dasharray="1.5 1.5"/><path d="M14 30l-1-3M20 31l1-3M26 32l-1-3M32 29l1-3" stroke="#e8b830" stroke-width="1.2"/><path d="M42 23l5-2-1 4l2 2-5 1Z" fill="#e8b830" stroke="#fff3a8" stroke-width=".6"/><circle cx="44" cy="23.5" r=".8" fill="#c82a2a"/><path d="M47 21l2-3M46 26q3 1 2 4" stroke="#e8b830" stroke-width="1" fill="none"/><path d="M10 22q2-2 4 0M36 37q2-2 4 0" stroke="#e8b830" stroke-width="1" fill="none"/></g><path d="M6 20h44M6 38h44" stroke="#e8b830" stroke-width="1" stroke-dasharray="2 2"/><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    hd_basic: `<path d="M14 40Q36 8 58 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M56 36l10 10-4 4-8-8" fill="${f}" stroke="${s}" stroke-width="2.5"/><circle cx="28" cy="30" r="2.5" fill="#fff3c8"/><circle cx="42" cy="26" r="2.5" fill="#fff3c8"/>`,
    hd_hat: `<path d="M4 44L36 10L68 44Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 36H52M28 26H44" stroke="${s}" stroke-width="1.5"/>`,
    hd_fisher: `<path d="M20 36V20Q36 10 52 20V36Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M8 44L20 36H52L64 44Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    hd_helmet: `<path d="M14 40Q14 12 36 12Q58 12 58 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M8 40H64V46H8Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M36 12V40" stroke="${s}" stroke-width="2"/>`,
    hd_crown: `<path d="M10 46L14 18L26 32L36 12L46 32L58 18L62 46Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="36" cy="38" r="4" fill="#c82a2a" stroke="${s}" stroke-width="1.5"/>`,
    bd_vest: `<path d="M22 10L14 20v36h16V22l6 6 6-6v34h16V20L50 10l-8 8h-12Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    bd_rain: `<path d="M24 8L8 22l6 8 6-4v32h32V26l6 4 6-8L48 8l-12 10Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M36 18V58" stroke="${s}" stroke-width="2"/>`,
    ft_boots: `<path d="M18 8h18v28q16 2 22 10v6H18Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    ft_work: `<path d="M16 18h20v14q18 2 22 12v8H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 24h10M22 30h10" stroke="#e8d8a8" stroke-width="2"/>`,
    lg_flower: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="26" cy="22" r="3" fill="#fff3c8"/><circle cx="46" cy="36" r="3" fill="#fff3c8"/>`,
    bd_bikini: `<path d="M22 10L8 20l6 10 6-4v30h32V26l6 4 6-10-14-10-6 6h-16Z" fill="#e8bc98" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 26q6-2 10 6h-12Z" fill="${grey ? '#c4c4c4' : '#e84a5c'}" stroke="${s}" stroke-width="1.6"/><path d="M48 26q-6-2-10 6h12Z" fill="${grey ? '#c4c4c4' : '#e84a5c'}" stroke="${s}" stroke-width="1.6"/><path d="M30 22L36 12L42 22" fill="none" stroke="#fff6ee" stroke-width="2"/><path d="M24 50h24l-3 8H27Z" fill="${grey ? '#c4c4c4' : '#e84a5c'}" stroke="${s}" stroke-width="1.6"/>`,
    hd_straw: `<path d="M2 44L36 18L70 44Q36 50 2 44Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 38H54M26 30H46" stroke="${s}" stroke-width="1.5"/><path d="M22 40H50" stroke="#5a3a18" stroke-width="3"/>`,
    hd_purple: `<path d="M14 40Q36 8 58 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M56 36l10 10-4 4-8-8" fill="${f}" stroke="${s}" stroke-width="2.5"/><circle cx="28" cy="30" r="2.5" fill="#e8b8e0"/><circle cx="42" cy="26" r="2.5" fill="#fff0c8"/>`,
    sl_redflower: `<defs><clipPath id="c_sl_redflower"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_redflower)"><g transform="translate(16 26)"><circle r="4" fill="#fff3c8"/><circle r="1.4" fill="#2f7a38"/></g><g transform="translate(34 32)"><circle r="4.4" fill="#ffe0a0"/><circle r="1.5" fill="#f0d020"/></g><g transform="translate(28 22)"><circle r="3.4" fill="#fff8e8"/><circle r="1.2" fill="#2f7a38"/></g></g><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    bd_singlet: `<path d="M24 14L16 22v36h40V22L48 14l-6 8h-12Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M28 14q8 10 16 0" fill="none" stroke="${s}" stroke-width="2"/>`,
    bd_hawaii: `<path d="M22 10L8 20l6 10 6-4v30h32V26l6 4 6-10-14-10-6 6h-16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 16l6 10 6-10" fill="${f}" stroke="${s}" stroke-width="2"/><circle cx="28" cy="34" r="3" fill="#e85040"/><circle cx="44" cy="42" r="3" fill="#f0c030"/>`,
    lg_rolled: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 44h16M38 44h16" stroke="#e8bc98" stroke-width="6"/><path d="M18 40h16M38 40h16" stroke="${s}" stroke-width="2"/>`,
    ft_greenboots: `<path d="M18 8h18v28q16 2 22 10v6H18Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    ft_redslipper: `<path d="M10 40q0-14 16-14h14q16 4 22 14v6H10Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 40q16-12 36 0" fill="none" stroke="${s}" stroke-width="3"/>`,
    hd_karakusa: `<path d="M14 40Q36 8 58 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M56 36l10 10-4 4-8-8" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M22 28q8-6 16 2t14-1" fill="none" stroke="#1e3358" stroke-width="1.8"/><path d="M28 34q6 4 12-2" fill="none" stroke="#1e3358" stroke-width="1.6"/>`,
    sl_nightwrap: `<rect x="6" y="18" width="44" height="22" rx="8" fill="${f}" stroke="${s}" stroke-width="2.5"/><rect x="6" y="27" width="44" height="3" fill="#2a4a7a"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    bd_nightshort: `<path d="M22 10L8 20l6 10 6-4v30h32V26l6 4 6-10-14-10-6 6h-16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 16l6 10 6-10" fill="${f}" stroke="${s}" stroke-width="2"/><path d="M28 48h16" stroke="#1a2438" stroke-width="3"/>`,
    lg_tied: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 50h16M38 50h16" stroke="#1a2438" stroke-width="5"/>`,
    ft_tabi: `<path d="M10 40q0-10 10-12h8v18H10Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 30h16q10 2 14 12v4H30Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M28 28v18" stroke="#e8e2d4" stroke-width="2"/>`,
    hd_none: `<circle cx="36" cy="32" r="16" fill="#e8bc98" stroke="${s}" stroke-width="2.5"/><path d="M20 32Q20 14 36 14Q52 14 52 32Q44 22 36 24Q28 22 20 32Z" fill="#222" stroke="${s}" stroke-width="2"/>`,
    hn_none: `<rect x="6" y="18" width="44" height="22" rx="8" fill="#e8bc98" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    bd_none: `<path d="M22 10L8 20l6 10 6-4v30h32V26l6 4 6-10-14-10-6 6h-16Z" fill="#e8bc98" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 28l8 8M34 28l-8 8M40 28l8 8M48 28l-8 8" stroke="${grey ? '#888' : '#2a2a2a'}" stroke-width="2.6" stroke-linecap="round"/>`,
    lg_none: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="#e8bc98" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 8h28l2 16H20Z" fill="#d8d0c4" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>`,
    ft_none: `<path d="M10 40q0-14 16-14h14q16 4 22 14v6H10Z" fill="#e8bc98" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>` };
  // iOS WebKit：多個同名 clipPath id 會解析到第一個（可能在隱藏元素裡），每個實例改用唯一 id
  const u = `_${++eqSvgN}`;
  let body = (ID[e.id] ?? P[e.slot]).replace(/id="(c_[a-z0-9_]+)"/g, `id="$1${u}"`).replace(/url\(#(c_[a-z0-9_]+)\)/g, `url(#$1${u})`);
  if (grey) body = body.replace(/fill="#(?!a8a8a8)[0-9a-fA-F]{3,6}"/g, 'fill="#c4c4c4"');
  return `<svg class="slv" viewBox="0 0 72 60" width="${w}" height="${w * 60 / 72}">${body}</svg>`;
}
function eqIcon(e: Eq, w = 72, grey = false) {
  return `<span class="eqThumb" data-eqthumb="${e.id}">${eqSvg(e, w, grey)}</span>`;
}
/** 空欄／不穿：淡淡的部位線條輪廓，不畫半身 */
export function eqSlotOutline(slot: Slot, w = 56) {
  const s = '#2a3440';
  const o = `fill="none" stroke="${s}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const P: Record<Slot, string> = {
    head: `<path d="M16 44Q36 10 56 44" ${o}/><path d="M10 44H62" ${o}/>`,
    body: `<path d="M22 12L10 22l6 10 6-4v28h28V28l6 4 6-10-12-10-6 6H28Z" ${o}/>`,
    hand: `<rect x="10" y="20" width="38" height="20" rx="7" ${o}/><path d="M48 24h10a6 6 0 0 1 0 12H48" ${o}/>`,
    legs: `<path d="M22 10h28l4 46H40l-4-28-4 28H18Z" ${o}/>`,
    feet: `<path d="M12 42q0-14 16-14h12q16 4 22 14v6H12Z" ${o}/>`,
  };
  return `<svg class="slv" viewBox="0 0 72 60" width="${w}" height="${Math.round(w * 60 / 72)}" aria-hidden="true">${P[slot]}</svg>`;
}
// 全身人形（裝備面板與分享卡共用的配色）
export function figSvg() {
  const k = '#1b1b1b', SK = '#e8b890', H = equipNow('head'), A = equipNow('hand'), B = equipNow('body'), L = equipNow('legs'), F = equipNow('feet');
  const ol = `stroke="${k}" stroke-width="3" stroke-linejoin="round"`;
  // 圖樣：每個人形只出現一次，id 固定
  const fl = (id: string, c: string) => `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="${c}"/><g fill="#fff3c8"><circle cx="4" cy="4" r="1.8"/><circle cx="7" cy="4" r="1.8"/><circle cx="5.5" cy="1.6" r="1.8"/><circle cx="5.5" cy="6.4" r="1.8"/></g><circle cx="5.5" cy="4" r="1.2" fill="#3a8a4a"/><circle cx="11" cy="11" r="1.5" fill="#fff3c8"/></pattern>`;
  const defs = `<defs>
${fl('pFlower', '#e86a8a')}${fl('pFlowerR', '#c84a5a')}
<pattern id="pCamo" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#5a6b3a"/><path d="M2 6q6-6 12 0t8 8q-6 4-12 0T2 6Z" fill="#2e3a1e"/><path d="M16 20q6-4 10 2t-4 6q-8 0-6-8Z" fill="#8a7a4a"/><circle cx="24" cy="6" r="3.5" fill="#3e5228"/></pattern>
<pattern id="pNeon" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(70)"><rect width="10" height="10" fill="#39ff9a"/><rect width="10" height="3" fill="#fff"/></pattern>
<pattern id="pSeq" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#b84ad8"/><circle cx="2" cy="2" r="1.6" fill="#f0c8ff"/><circle cx="6" cy="6" r="1.6" fill="#ffd8f8"/></pattern>
<pattern id="pTat" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${SK}"/><path d="M0 12q4-8 8 0t8 0" stroke="#1e2a4a" stroke-width="1.6" fill="none"/><circle cx="12" cy="4" r="2" fill="#b8323a"/></pattern>
<pattern id="pKara" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#e8e2d4"/><path d="M0 10q4-8 8 0t8 0" stroke="#1e3358" stroke-width="1.5" fill="none"/><ellipse cx="5" cy="5" rx="3" ry="2" fill="none" stroke="#1e3358" stroke-width="1.2"/></pattern>
</defs>`;
  void 0;
  const PF: Record<string, string> = { flower: 'url(#pFlower)', camo: 'url(#pCamo)', neon: 'url(#pNeon)', tattoo: 'url(#pTat)' };
  // ---- 手臂（在衣服後面）：肩到腕，手在末端 ----
  const shirtless = B.id === 'bd_bikini' || B.id === 'bd_none';
  const sleeveless = B.id === 'bd_singlet';
  const bareArm = A.id === 'hn_none' || ((shirtless || sleeveless) && A.id === 'hn_basic');
  const armFill = bareArm ? SK : A.id === 'sl_flower' ? 'url(#pFlower)' : A.id === 'sl_redflower' ? 'url(#pFlowerR)' : A.id === 'sl_camo' ? 'url(#pCamo)' : A.id === 'sl_neon' ? 'url(#pNeon)' : A.id === 'sl_89' ? 'url(#pTat)' : A.base;
  const arm = (x1: number, x2: number) => { const d = `M${x1} 100L${x2} 160`, dx = x2 - x1, len = Math.hypot(dx, 60), nx = -60 / len, ny = dx / len;
    let ex = '';
    if (A.id === 'sl_rain') ex = `<path d="M${x1 + nx * 3} ${100 + ny * 3}L${x2 + nx * 3} ${160 + ny * 3}" stroke="#fffbe0" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>`;
    if (A.id === 'sl_dragon') { let p = ''; for (let i = 0; i <= 10; i++) { const t = i / 10, o = Math.sin(i * 1.6) * 4; p += `${i ? 'L' : 'M'}${(x1 + dx * t + nx * o).toFixed(1)} ${(100 + 60 * t + ny * o).toFixed(1)}`; } ex = `<path d="${p}" stroke="#ffd25a" stroke-width="2" fill="none"/><circle cx="${x1 + dx * 0.2}" cy="112" r="2.2" fill="#ffd25a"/>`; }
    if (A.id === 'sl_89') ex = `<path d="M${x1} 100L${x2} 160" stroke="#1e2a4a" stroke-width="1" stroke-dasharray="3 4" fill="none"/>`;
    return `<path d="${d}" stroke="${k}" stroke-width="20" stroke-linecap="round"/><path d="${d}" stroke="${armFill}" stroke-width="14" stroke-linecap="round"/>${ex}<path d="M${x2 - 7} 158h14" stroke="${k}" stroke-width="2"/><circle cx="${x2 + (x2 < 80 ? -1 : 1)}" cy="170" r="9" fill="${SK}" stroke="${k}" stroke-width="3"/>`; };
  // ---- 衣服 ----
  const T = 'M50 90h60l10 20-10 6-2-4v70H52v-70l-2 4-10-6Z';
  const body: Record<string, string> = {
    bd_basic: `<path d="${T}" fill="#e8e4d8" ${ol}/><path d="M70 90q10 10 20 0" fill="none" stroke="${k}" stroke-width="2"/><ellipse cx="80" cy="130" rx="12" ry="8" fill="#9a9488" stroke="${k}" stroke-width="2"/><path d="M70 130q10-6 20 0" stroke="#e8e4d8" stroke-width="1.5" fill="none"/>`,
    bd_rain: `<path d="${T}" fill="#ffd21a" ${ol}/><path d="M80 92V182" stroke="${k}" stroke-width="2"/>${[110, 130, 150, 170].map(y => `<circle cx="80" cy="${y}" r="2.5" fill="#fff" stroke="${k}" stroke-width="1.5"/>`).join('')}<path d="M56 100l4 70" stroke="#fffbe0" stroke-width="3" opacity=".8"/>`,
    bd_vest: `<path d="${T}" fill="#f2efe4" ${ol}/><path d="M52 92h18l-2 90H52Z M108 92H90l2 90h16Z" fill="#c82a2a" stroke="${k}" stroke-width="2.5" stroke-linejoin="round"/><path d="M70 92l-2 90M90 92l2 90" stroke="#ffd25a" stroke-width="3"/><path d="M56 150h8M96 150h8" stroke="#ffd25a" stroke-width="2"/>`,
    bd_boss: `<path d="${T}" fill="#1e2a3a" ${ol}/><path d="M66 90l14 14 14-14" fill="#2e3e52" stroke="${k}" stroke-width="2.5"/><path d="M80 104V182" stroke="#c8c8c8" stroke-width="2.5" stroke-dasharray="2 2"/><rect x="58" y="140" width="14" height="12" fill="none" stroke="#c8c8c8" stroke-width="2"/><rect x="88" y="140" width="14" height="12" fill="none" stroke="#c8c8c8" stroke-width="2"/>`,
    bd_sequin: `<path d="${T}" fill="url(#pSeq)" ${ol}/><path d="M64 92q16 16 32 0" fill="none" stroke="#ffd25a" stroke-width="3"/>`,
    bd_bikini: `<path d="${T}" fill="${SK}" ${ol}/><path d="M58 126q10-6 16 8H56Z" fill="#e84a5c" ${ol}/><path d="M102 126q-10-6-16 8h18Z" fill="#e84a5c" ${ol}/><path d="M68 122L80 100L92 122" fill="none" stroke="#fff6ee" stroke-width="3" stroke-linecap="round"/><path d="M56 168h48l-6 16H62Z" fill="#e84a5c" ${ol}/>`,
    bd_none: `<path d="${T}" fill="${SK}" ${ol}/><path d="M62 126l10 10M72 126l-10 10M88 126l10 10M98 126l-10 10" fill="none" stroke="#2a2a2a" stroke-width="3.4" stroke-linecap="round"/>`,
    bd_singlet: `<path d="${T}" fill="#f4f0e8" ${ol}/><path d="M70 90q10 12 20 0" fill="none" stroke="${k}" stroke-width="2"/><path d="M52 100h8M100 100h8" stroke="#e4e0d8" stroke-width="4"/>`,
    bd_hawaii: `<path d="${T}" fill="#1e8a7a" ${ol}/><path d="M66 90l14 14 14-14" fill="#1e8a7a" stroke="${k}" stroke-width="2.5"/><circle cx="68" cy="130" r="6" fill="#e85040"/><circle cx="92" cy="148" r="6" fill="#f0c030"/><circle cx="80" cy="168" r="5" fill="#f078a0"/>`,
    bd_nightshort: `<path d="${T}" fill="#24344c" ${ol}/><path d="M66 90l14 14 14-14" fill="#24344c" stroke="${k}" stroke-width="2.5"/><path d="M72 170h16" stroke="#1a2438" stroke-width="4"/><path d="M62 148h8M90 148h8" fill="none" stroke="#e8e2d4" stroke-width="2"/>` };
  const hood = B.id === 'bd_rain' ? `<path d="M50 92Q48 34 80 30Q112 34 110 92Z" fill="#ffd21a" ${ol}/>` : '';
  // ---- 褲子 ----
  const P = 'M54 182h52l6 86H86l-6-60-6 60H48Z';
  const legs: Record<string, string> = {
    lg_basic: `<path d="${P}" fill="#4a4a52" ${ol}/><path d="M58 190q8 10 16 0M86 190q8 10 16 0" stroke="#8a8a92" stroke-width="2" fill="none"/><rect x="92" y="222" width="12" height="12" fill="none" stroke="#8a8a92" stroke-width="2"/>`,
    lg_rain: `<path d="${P}" fill="#ffd21a" ${ol}/><path d="M60 190l-6 72M100 190l4 72" stroke="#fffbe0" stroke-width="3" opacity=".85"/>`,
    lg_flower: `<path d="${P}" fill="url(#pFlower)" ${ol}/>`,
    lg_camo: `<path d="${P}" fill="url(#pCamo)" ${ol}/><rect x="56" y="214" width="12" height="14" fill="none" stroke="#2e3a1e" stroke-width="2"/>`,
    lg_rolled: `<path d="${P}" fill="#6a6248" ${ol}/><path d="M52 240h20M88 240h20" stroke="#e8bc98" stroke-width="10"/><path d="M52 232h20M88 232h20" stroke="${k}" stroke-width="2"/>`,
    lg_tied: `<path d="${P}" fill="#2a3040" ${ol}/><path d="M52 250h20M88 250h20" stroke="#1a2438" stroke-width="8"/>` };
  // ---- 鞋子 ----
  const toes = (x: number) => [0, 1, 2, 3].map(i => `<circle cx="${x + 6 + i * 7}" cy="270" r="3" fill="${SK}" stroke="${k}" stroke-width="1.2"/>`).join('');
  const slip = (sole: string, strap: string) => [40, 84].map(x => `<rect x="${x - 4}" y="276" width="40" height="7" rx="3" fill="${sole}" stroke="${k}" stroke-width="2.5"/>${toes(x)}<path d="M${x + 2} 276q16-12 32 0" fill="none" stroke="${strap}" stroke-width="5"/>`).join('');
  const feet: Record<string, string> = {
    ft_none: [40, 84].map(x => `<ellipse cx="${x + 16}" cy="278" rx="18" ry="7" fill="${SK}" ${ol}/>${toes(x)}`).join(''),
    ft_basic: slip('#f2f2ee', '#2a5ab0'),
    ft_gold: slip('#e8b830', '#ffd25a') + `<circle cx="56" cy="271" r="2" fill="#fff"/><circle cx="100" cy="271" r="2" fill="#fff"/>`,
    ft_boots: [44, 84].map(x => `<path d="M${x} 236h30v40h6v8H${x - 4}v-8h4Z" fill="#ffd21a" ${ol}/><path d="M${x + 4} 242v32" stroke="#fffbe0" stroke-width="3"/>`).join(''),
    ft_work: [40, 84].map(x => `<path d="M${x + 2} 258h30l4 18h4v8H${x - 2}v-8h4Z" fill="#6a4a2a" ${ol}/>${[262, 268, 274].map(y => `<path d="M${x + 10} ${y}l12 3M${x + 22} ${y}l-12 3" stroke="#e8d8a8" stroke-width="1.5"/>`).join('')}`).join(''),
    ft_greenboots: [44, 84].map(x => `<path d="M${x} 236h30v40h6v8H${x - 4}v-8h4Z" fill="#2f8a3a" ${ol}/><path d="M${x + 4} 242v32" stroke="#1a5a28" stroke-width="3"/>`).join(''),
    ft_redslipper: slip('#e85a4a', '#c82028'),
    ft_tabi: [40, 84].map(x => `<path d="M${x} 252h18v22H${x - 2}v-8h2Z" fill="#1a1c22" ${ol}/><path d="M${x + 18} 256h16l4 18H${x + 18}Z" fill="#1a1c22" ${ol}/><path d="M${x + 17} 254v22" stroke="#e8e2d4" stroke-width="2"/>`).join('') };
  // ---- 頭 ----
  const hd: Record<string, string> = {
    hd_basic: `<path d="M56 62Q56 34 80 34Q104 34 104 62Q92 48 80 50Q68 48 56 62Z" fill="url(#pFlowerR)" ${ol}/><path d="M102 56l14 6-6 6zM102 58l10 14-8 0z" fill="#c84a5a" ${ol}/>`,
    hd_hat: `<path d="M28 58L80 22L132 58Q80 66 28 58Z" fill="#d8b46a" ${ol}/><path d="M48 50L112 50M62 40H98M80 22V58" stroke="#8a6a2a" stroke-width="1.5"/><path d="M62 62q18 28 36 0" fill="none" stroke="${k}" stroke-width="1.5"/>`,
    hd_fisher: `<path d="M58 54V38Q80 26 102 38V54Z" fill="#4a6a8a" ${ol}/><path d="M44 62L58 52H102L116 62Q80 68 44 62Z" fill="#4a6a8a" ${ol}/><path d="M58 50H102" stroke="#2a3a4a" stroke-width="2.5"/>`,
    hd_helmet: `<path d="M56 56Q56 30 80 30Q104 30 104 56Z" fill="#ffb21a" ${ol}/><path d="M48 54H112V60H48Z" fill="#ffb21a" ${ol}/><path d="M80 30V54M70 33v21M90 33v21" stroke="${k}" stroke-width="2"/>`,
    hd_crown: `<path d="M58 54L60 28L70 40L80 22L90 40L100 28L102 54Z" fill="#e8b830" ${ol}/><path d="M58 54H102" stroke="#b8862a" stroke-width="4"/><circle cx="80" cy="44" r="4" fill="#c82a2a" stroke="${k}" stroke-width="1.5"/><circle cx="66" cy="48" r="2.5" fill="#2a8ac8"/><circle cx="94" cy="48" r="2.5" fill="#2a8ac8"/><circle cx="80" cy="22" r="2.5" fill="#fff6dc" stroke="${k}"/>`,
    hd_none: `<path d="M56 62Q56 34 80 34Q104 34 104 62Q92 48 80 50Q68 48 56 62Z" fill="#222222" ${ol}/>`,
    hd_straw: `<path d="M22 60L80 28L138 60Q80 68 22 60Z" fill="#d2a85a" ${ol}/><path d="M48 52H112M62 42H98" stroke="#8a5a24" stroke-width="1.5"/><path d="M58 58H102" stroke="#5a3a18" stroke-width="4"/>`,
    hd_purple: `<path d="M56 62Q56 34 80 34Q104 34 104 62Q92 48 80 50Q68 48 56 62Z" fill="#6a2a78" ${ol}/><path d="M102 56l14 6-6 6zM102 58l10 14-8 0z" fill="#6a2a78" ${ol}/>`,
    hd_karakusa: `<path d="M56 62Q56 34 80 34Q104 34 104 62Q92 48 80 50Q68 48 56 62Z" fill="url(#pKara)" ${ol}/><path d="M102 56l14 6-6 6zM102 58l10 14-8 0z" fill="#e8e2d4" ${ol}/>` };
  const face = `<circle cx="80" cy="66" r="24" fill="${SK}" ${ol}/><circle cx="71" cy="66" r="2.6" fill="${k}"/><circle cx="89" cy="66" r="2.6" fill="${k}"/><path d="M73 76q7 6 14 0" fill="none" stroke="${k}" stroke-width="2.2" stroke-linecap="round"/><circle cx="66" cy="73" r="3" fill="#f0a090" opacity=".7"/><circle cx="94" cy="73" r="3" fill="#f0a090" opacity=".7"/>`;
  void PF;
  const legsDraw = B.id === 'bd_bikini'
    ? `<path d="${P}" fill="${SK}" ${ol}/><path d="M56 182h48l-4 20H60Z" fill="#e84a5c" ${ol}/>`
    : L.id === 'lg_none'
      ? `<path d="${P}" fill="${SK}" ${ol}/><path d="M56 182h48l-4 22H60Z" fill="#d8d0c4" ${ol}/>`
      : (legs[L.id] ?? legs.lg_basic);
  return `<svg viewBox="0 0 160 300" class="eqFig">${defs}${hood}${arm(50, 34)}${arm(110, 126)}${legsDraw}${body[B.id] ?? body.bd_basic}${face}${hd[H.id] ?? ''}${feet[F.id] ?? feet.ft_basic}</svg>`;
}
// 裝備面板：中間大角色＋兩側方格（左：頭／衣服／手，右：褲子／鞋子）
const EQ_LEFT: Slot[] = ['head', 'body', 'hand'];
const EQ_RIGHT: Slot[] = ['legs', 'feet'];
let eqListOpen = false;

function slotLabel(s: Slot) { return SLOTS.find(x => x[0] === s)![1]; }
function eqWornText(e: Eq) { return isNoneId(e.id) || e.price ? e.eff : '基本款，沒有加成'; }
function eqTileHtml(s: Slot) {
  const e = equipNow(s), n = slotLabel(s), on = D.getEqPick() === s;
  const inner = isNoneId(e.id)
    ? `<span class="eqEmpty">${eqSlotOutline(s)}</span>`
    : eqIcon(e, 64);
  const extra = isNoneId(e.id) ? '，目前不穿' : `：${e.n}`;
  return `<button type="button" class="eqTile${on ? ' on' : ''}${isNoneId(e.id) ? ' empty' : ''}" data-slot="${s}" aria-label="${n}${extra}">${inner}</button>`;
}
const SVG_SHED = `<svg class="eqShed" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true"><defs>
<pattern id="eqStCorr" width="12" height="40" patternUnits="userSpaceOnUse">
<rect width="12" height="40" fill="#514940"/>
<rect width="4.2" height="40" fill="#635c52"/>
<rect x="4.2" width="2.2" height="40" fill="#3a3530"/>
<rect x="6.4" width="5.6" height="40" fill="#575047"/>
<path d="M1.1 0V40" stroke="#7a7368" stroke-width=".55" opacity=".45"/>
<path d="M10.6 0V40" stroke="#2c2824" stroke-width=".5" opacity=".35"/>
</pattern>
<pattern id="eqStGrain" width="64" height="64" patternUnits="userSpaceOnUse">
<filter id="eqStGn" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/>
<feColorMatrix type="matrix" values="0 0 0 0 .18  0 0 0 0 .16  0 0 0 0 .13  0 0 0 .55 0"/>
</filter>
<rect width="64" height="64" filter="url(#eqStGn)"/>
</pattern>
<pattern id="eqStFloor" width="300" height="20" patternUnits="userSpaceOnUse">
<rect width="300" height="10" fill="#9a7d50"/>
<rect y="10" width="300" height="10" fill="#8b7046"/>
<path d="M0 9.65H300" stroke="#5a4428" stroke-width=".85"/>
<path d="M0 19.65H300" stroke="#5a4428" stroke-width=".85"/>
<path d="M96 0V10M214 0V10" stroke="#6a5030" stroke-width=".7" opacity=".5"/>
<path d="M38 10V20M168 10V20M272 10V20" stroke="#6a5030" stroke-width=".7" opacity=".5"/>
</pattern>
<pattern id="eqStFlGrain" width="80" height="28" patternUnits="userSpaceOnUse">
<filter id="eqStFg" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".03 .55" numOctaves="2" seed="7"/>
<feColorMatrix type="matrix" values="0 0 0 0 .42  0 0 0 0 .3  0 0 0 0 .14  0 0 0 .32 0"/>
</filter>
<rect width="80" height="28" filter="url(#eqStFg)"/>
</pattern>
<linearGradient id="eqStTop" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#f2e4c4" stop-opacity=".2"/>
<stop offset=".28" stop-color="#d8c8a4" stop-opacity=".06"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</linearGradient>
<radialGradient id="eqStSpot" cx="50%" cy="40%" r="50%">
<stop offset="0" stop-color="#fff6d8" stop-opacity=".4"/>
<stop offset=".42" stop-color="#e8d2a4" stop-opacity=".12"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
<radialGradient id="eqStVig" cx="50%" cy="46%" r="74%">
<stop offset=".52" stop-color="#000" stop-opacity="0"/>
<stop offset="1" stop-color="#1a1612" stop-opacity=".5"/>
</radialGradient>
<radialGradient id="eqStShade" cx="50%" cy="50%" r="50%">
<stop offset="0" stop-color="#000" stop-opacity=".4"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="300" height="324" fill="url(#eqStCorr)"/>
<rect width="300" height="324" fill="url(#eqStGrain)" opacity=".42"/>
<path d="M0 118H300" stroke="#2a2622" stroke-width="1" opacity=".22"/>
<path d="M0 214H300" stroke="#2a2622" stroke-width="1" opacity=".22"/>
<rect width="300" height="20" fill="#3c352e"/>
<rect y="16" width="300" height="6" fill="#2a241f"/>
<path d="M0 20H300" stroke="#1e1a16" stroke-width="1.5"/>
<rect y="322" width="300" height="78" fill="url(#eqStFloor)"/>
<rect y="322" width="300" height="78" fill="url(#eqStFlGrain)" opacity=".5"/>
<path d="M0 322H300" stroke="#2a2218" stroke-width="3"/>
<ellipse cx="150" cy="356" rx="66" ry="12" fill="url(#eqStShade)"/>
<rect width="300" height="324" fill="url(#eqStTop)"/>
<rect width="300" height="400" fill="url(#eqStSpot)"/>
<rect width="300" height="400" fill="url(#eqStVig)"/>
</svg>`;
export function eqStats(): string[] {
  const f = fxAll(), pc = (v: number) => Math.round(v * 100), out: string[] = [];
  if (f.pearl > 1.0001) out.push(`珍珠率|+${pc(f.pearl - 1)}%`);
  if (f.bowl) out.push(`每碗多拿|+$${f.bowl}`);
  if (f.throw < 0.9999) out.push(`被丟殼機率|−${pc(1 - f.throw)}%`);
  if (f.nag < 0.9999) out.push(`阿婆唸人、干擾|−${pc(1 - f.nag)}%`);
  if (f.dmg < 0.9999) out.push(`受到傷害|−${pc(1 - f.dmg)}%`);
  if (f.speed < 0.9999) out.push(`翹殼指針|慢 ${pc(1 - f.speed)}%`);
  if (f.keep) out.push(`沒中保住連擊|${pc(f.keep)}%`);
  if (f.luck) out.push(`幸運|+${f.luck}`);
  if (f.steal > 0) out.push(`偷竊按住|廣場 ${stealHoldSeconds(f, 'plaza').toFixed(2)} 秒、工寮 ${stealHoldSeconds(f, 'yard').toFixed(2)} 秒`);
  return out;
}
function currentOutfit() {
  return {
    head: equipNow('head').id, hand: equipNow('hand').id,
    body: equipNow('body').id, legs: equipNow('legs').id, feet: equipNow('feet').id,
  };
}
function boardInnerHtml() {
  const st = eqStats();
  return `<div class="eqBoardT">目前加成</div>${st.length ? `<div class="eqStats">${st.map(x => { const [a, b] = x.split('|'); return `<div><small>${a}</small><b>${b}</b></div>`; }).join('')}</div>` : '<p class="eqNone">現在穿的都是基本款，還沒有加成。去服飾店挑幾件吧。</p>'}`;
}
function setsInnerHtml() {
  const sets = setsOn(), worn = wornIds();
  return SETS.map(s => { const done = sets.includes(s), have = s.need.filter(i => eqOwned(i)).length;
      const full = have === s.need.length; return `<div class="eqSet${done ? ' done' : ''}${full ? ' full' : ''}"${full ? ` data-setid="${s.id}" role="button"` : ''}><div class="eqSetH"><b>${s.n}</b><span>${have}/${s.need.length} 件</span></div><div class="eqSetI">${s.need.map(i => { const e = EQUIP.find(x => x.id === i)!; return `<div class="${worn.includes(i) ? 'worn' : eqOwned(i) ? 'own' : 'no'}">${eqIcon(e, 40, !eqOwned(i))}<small>${e.n}</small></div>`; }).join('')}</div><p>${s.eff}${s.id === 'typhoon' ? '（手部任意）' : ''}</p>${done ? '<i class="eqStamp">套裝完成</i>' : ''}${full ? `<em class="eqSetGo"><i class="ic ${done ? 'ic-check' : 'ic-hand'}"></i> ${done ? '穿著中' : '一鍵換上'}</em>` : ''}</div>`; }).join('');
}
function listHtml(pick: Slot) {
  const pickName = slotLabel(pick);
  return `<div class="eqList"><div class="eqListT">換${pickName}<small>點一件就換上，換穿免費</small></div>${EQUIP.filter(e => e.slot === pick && eqOwned(e.id)).slice().sort((a, b) => Number(isNoneId(b.id)) - Number(isNoneId(a.id))).map(e => `<button data-eqset="${e.id}" class="${equipNow(e.slot).id === e.id ? 'on' : ''}">${eqIcon(e, 48)}<span><b>${e.n}</b><small>${e.eff}</small></span>${equipNow(e.slot).id === e.id ? '<em>穿著中</em>' : ''}</button>`).join('')}<p class="eqHint">想要更多款式，去服飾店看看。</p></div>`;
}
function pickPaneHtml() {
  const pick = D.getEqPick();
  if (!pick) {
    eqListOpen = false;
    return '<p class="eqHint">點旁邊的格子或人身上的部位查看與換裝。</p>';
  }
  const pickEq = equipNow(pick);
  const pickName = slotLabel(pick);
  return `<div class="eqInfo"><div class="eqInfoT"><small>${pickName}</small><b>${pickEq.n}</b><p>${eqWornText(pickEq)}</p></div>${eqListOpen ? '' : `<button type="button" class="eqInfoGo" data-eqopen="${pick}">換裝</button>`}</div>` + (eqListOpen ? listHtml(pick) : '');
}
function syncTileOn() {
  const pick = D.getEqPick();
  document.querySelectorAll('#eqBody .eqTile[data-slot]').forEach(el => {
    el.classList.toggle('on', el.getAttribute('data-slot') === pick);
  });
}
function paintPickPane() {
  const pane = document.getElementById('eqPickPane');
  if (!pane) return;
  pane.innerHTML = pickPaneHtml();
  syncTileOn();
  hydrateEquipThumbs(pane);
}
function paintTile(s: Slot) {
  const root = $('eqBody');
  const btn = root.querySelector(`.eqTile[data-slot="${s}"]`);
  if (!btn) return;
  btn.outerHTML = eqTileHtml(s);
  const next = root.querySelector<HTMLElement>(`.eqTile[data-slot="${s}"]`);
  if (next) hydrateEquipThumbs(next);
}
function paintBoardAndSets() {
  const root = $('eqBody');
  const board = root.querySelector('.eqBoard');
  if (board) board.innerHTML = boardInnerHtml();
  const sets = root.querySelector('.eqSets');
  if (sets) { sets.innerHTML = setsInnerHtml(); hydrateEquipThumbs(sets); }
}
function applyPreview() {
  const fig = document.getElementById('eqFigW');
  if (!fig) return;
  if (fig.firstElementChild) refreshEqPreview(currentOutfit());
  else D.syncEqPreview(fig, currentOutfit());
}
let pickGuard = 0;
function pickSlot(s: Slot) {
  const now = performance.now();
  if (now < pickGuard) return;
  pickGuard = now + 80;
  // 點一下就直接打開該部位的換裝清單；再點同一個部位收起
  if (D.getEqPick() !== s || !eqListOpen) { D.setEqPick(s); eqListOpen = true; }
  else { D.setEqPick(null); eqListOpen = false; }
  paintPickPane();
  if (eqListOpen) $('eqBody').querySelector('.eqList')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  else if (D.getEqPick()) $('eqBody').querySelector('.eqInfo')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function wearFromList(id: string) {
  const e = EQUIP.find(x => x.id === id);
  if (!e) return;
  setEquip(e.slot, e.id);
  D.persist();
  applySleeve();
  D.applyOutfit3();
  paintTile(e.slot);
  paintBoardAndSets();
  applyPreview();
  paintPickPane();
}
function goShop() {
  D.setShopFromEquip(true);
  D.openShopPx();
  $('equip').classList.remove('show');
  D.stopEqPreview();
  if (D.getEqPick()) D.setClothTab(D.getEqPick()!);
  D.renderShop();
  const gs = Array.from(document.querySelectorAll('#shopList .stab'));
  const i = gs.findIndex(g => g.querySelector('.slGrid'));
  if (i >= 0) { D.setShopTab(i); D.renderShop(); }
  $('shop').classList.add('show');
  $('shop').scrollTop = 0;
}
function onEquipClick(ev: Event) {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const slotBtn = t.closest('button[data-slot]');
  if (slotBtn && $('eqBody').contains(slotBtn)) {
    pickSlot(slotBtn.getAttribute('data-slot') as Slot);
    return;
  }
  if (t.closest('.eqInfoGo')) {
    eqListOpen = true;
    paintPickPane();
    $('eqBody').querySelector('.eqList')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  const setItem = t.closest('button[data-eqset]');
  if (setItem) {
    wearFromList(setItem.getAttribute('data-eqset')!);
    return;
  }
  const setEl = t.closest<HTMLElement>('.eqSet[data-setid]');
  if (setEl) {
    const st = SETS.find(x => x.id === setEl.dataset.setid);
    if (st) askSet(st);
    return;
  }
  if (t.closest('#eqShare')) { void shareOutfit(); return; }
  if (t.closest('#eqShop')) { goShop(); return; }
}
function ensureEquipBound() {
  const root = $('eqBody');
  if (root.dataset.eqBound === '1') return;
  root.dataset.eqBound = '1';
  root.addEventListener('click', onEquipClick);
}
export function renderEquip() {
  const pick = D.getEqPick();
  if (!pick) eqListOpen = false;
  const hits = SLOTS.map(([s, n]) => `<button type="button" class="eqHit" data-slot="${s}" aria-label="${n}"></button>`).join('');
  $('eqBody').innerHTML =
    `<div class="eqBoard">${boardInnerHtml()}</div>` +
    `<div class="eqStage">${SVG_SHED}<div class="eqCol l">${EQ_LEFT.map(eqTileHtml).join('')}</div><div class="eqFigW" id="eqFigW"></div><div class="eqCol r">${EQ_RIGHT.map(eqTileHtml).join('')}</div>${hits}</div>` +
    `<div id="eqPickPane">${pickPaneHtml()}</div>` +
    `<div class="eqSecT">套裝收集</div><div class="eqSets">${setsInnerHtml()}</div>` +
    `<div id="eqShareOut"></div><p class="eqHint">分享到 Discord 有機會拿神秘好禮</p><div class="eqDock"><button id="eqShare"><i class="ic ic-send"></i>分享穿搭</button><button id="eqShop"><i class="ic ic-shop"></i>去服飾店</button></div>`;
  D.syncEqPreview($('eqFigW'), currentOutfit());
  ensureEquipBound();
  hydrateEquipThumbs($('eqBody'));
}

export function renderClothShop() {
  if (D.getSleeveTry()) { D.setSleeveTry(null); applySleeve(); }
  const items = EQUIP.filter(e => e.slot === D.getClothTab() && (e.price > 0 || isNoneId(e.id))).sort((a, b) => Number(isNoneId(b.id)) - Number(isNoneId(a.id)) || a.price - b.price);
  $('shopList').insertAdjacentHTML('beforeend', `<h3><i class="ic ic-equip"></i> 服飾</h3><p style="font-size:12px;opacity:.8">買了永久擁有，每個部位一次穿一件，只有穿著的有效果。換穿免費，也可以在主畫面的「裝備」換。湊齊套裝還有額外加成。點商品圖片可試穿，還沒買也能看。</p><div class="clTabs">${SLOTS.map(([s, n]) => `<button data-ctab="${s}" class="${s === D.getClothTab() ? 'on' : ''}">${n}</button>`).join('')}</div><div class="slGrid">` + items.map(s => { const own = eqOwned(s.id), cur = equipNow(s.slot).id === s.id;
    return `<div class="slCard${cur ? ' on' : ''}"><button type="button" class="slPeek" data-sltry="${s.id}" aria-label="試穿 ${s.n}">${eqIcon(s)}<b>${s.n}</b><em class="slPeekT">點我看穿著樣子</em></button><small>${s.eff}</small>${D.pxCd(s.id)}<div class="slBtns">${own ? `<button data-sleq="${s.id}" ${cur ? 'disabled' : ''}>${cur ? '穿著中' : '換上'}</button>` : `<button data-slbuy="${s.id}" ${D.getSave().money < D.px(s.id, s.price) ? 'disabled' : ''}>${D.pxHtml(s.id, s.price, '買 ')}</button>`}</div></div>`; }).join('') + `</div>`);
  $('shopList').querySelectorAll('button[data-ctab]').forEach(b => (b as HTMLButtonElement).onclick = () => { D.setClothTab(b.getAttribute('data-ctab') as Slot); D.renderShop(); });
  $('shopList').querySelectorAll('button[data-slbuy],button[data-sleq]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const id = b.getAttribute('data-slbuy') ?? b.getAttribute('data-sleq')!; const s = EQUIP.find(x => x.id === id)!;
    if (b.hasAttribute('data-slbuy')) { const pr = await D.payFor(id, s.price, s.n); if (pr == null) return; D.getSave().money -= pr; D.getSave().shop.owned.push(id); D.track('buy', { item: id, price: pr }); if (D.getAc()) D.SFX.jingle(); }
    setEquip(s.slot, id); D.setSleeveTry(null); D.persist(); applySleeve(); D.applyOutfit3(); D.renderShop();
  });
  $('shopList').querySelectorAll('button[data-sltry]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const s = EQUIP.find(x => x.id === b.getAttribute('data-sltry'));
    if (s) openTryModal(s);
  });
  hydrateEquipThumbs($('shopList'));
}

function closeTryModal() {
  closeClothTryPreview();
  document.getElementById('clothTry')?.remove();
}

function openTryModal(item: Eq) {
  closeTryModal();
  const outfit = {
    head: equipNow('head').id, hand: equipNow('hand').id,
    body: equipNow('body').id, legs: equipNow('legs').id, feet: equipNow('feet').id,
    [item.slot]: item.id,
  };
  const own = eqOwned(item.id);
  const cur = equipNow(item.slot).id === item.id;
  const act = own
    ? `<button type="button" data-sleq="${item.id}" ${cur ? 'disabled' : ''}>${cur ? '穿著中' : '換上'}</button>`
    : `<button type="button" data-slbuy="${item.id}" ${D.getSave().money < D.px(item.id, item.price) ? 'disabled' : ''}>${D.pxHtml(item.id, item.price, '買 ')}</button>`;
  const m = document.createElement('div');
  m.id = 'clothTry';
  m.className = 'clothTry';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-label', `試穿 ${item.n}`);
  m.innerHTML = `<div class="clothTryBox"><button type="button" class="clothTryX" aria-label="關閉"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="clothTryHd"><b>試穿：${item.n}</b><small>${item.eff}</small></div><div class="clothTryStage" id="clothTryStage"></div><p class="clothTryHint">可拖曳轉動看背面。點外面或關閉即可離開。</p><div class="clothTryAct">${act}</div></div>`;
  document.body.appendChild(m);
  openClothTryPreview(m.querySelector('#clothTryStage') as HTMLElement, outfit);
  const close = () => closeTryModal();
  m.querySelector('.clothTryX')?.addEventListener('click', close);
  m.addEventListener('click', e => { if (e.target === m) close(); });
  const buyBtn = m.querySelector<HTMLButtonElement>('button[data-slbuy],button[data-sleq]');
  if (buyBtn) buyBtn.onclick = async () => {
    if (buyBtn.hasAttribute('data-slbuy')) {
      const pr = await D.payFor(item.id, item.price, item.n);
      if (pr == null) return;
      D.getSave().money -= pr;
      D.getSave().shop.owned.push(item.id);
      D.track('buy', { item: item.id, price: pr });
      if (D.getAc()) D.SFX.jingle();
    }
    setEquip(item.slot, item.id);
    D.setSleeveTry(null);
    D.persist();
    applySleeve();
    D.applyOutfit3();
    closeTryModal();
    D.renderShop();
  };
}

// 分享穿搭卡：直接畫在 canvas 上
export async function shareOutfit() {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  g.fillStyle = '#1e3a5a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f0e6c8'; g.lineWidth = 14; g.strokeRect(30, 30, W - 60, H - 60);
  g.fillStyle = '#c8302a'; g.fillRect(60, 55, W - 120, 120); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(60, 55, W - 120, 120);
  g.fillStyle = '#fff6dc'; g.textAlign = 'center'; g.font = 'bold 72px sans-serif'; g.fillText('剝蚵仔模擬器', W / 2, 135);
  g.font = 'bold 48px sans-serif'; g.fillText(D.myName(), W / 2, 220);
  g.font = '32px sans-serif'; g.fillStyle = '#c8d8e8'; g.fillText('#' + D.statsId.slice(0, 4).toUpperCase() + ' 的今日穿搭', W / 2, 258);
  const stageH = 970, stageW = Math.round(stageH * 3 / 4), sx = Math.round((W - stageW) / 2), sy = 280;
  const shed = new Image();
  shed.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG_SHED.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  await new Promise<void>(r => { shed.onload = () => r(); shed.onerror = () => r(); });
  g.drawImage(shed, sx, sy, stageW, stageH);
  const figX = sx + stageW * 0.20, figY = sy + stageH * 0.03, figW = stageW * 0.60, figH = stageH * 0.92;
  const snap = snapshotEqPreview(currentOutfit(), Math.round(figW), Math.round(figH));
  if (snap) g.drawImage(snap, figX, figY, figW, figH);
  g.fillStyle = '#c8d8e8'; g.font = '30px sans-serif'; g.fillText('https://jinweihuang20.github.io/oyster-sim/', W / 2, H - 62);
  const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return;
  const file = new File([blob], 'oyster-outfit.png', { type: 'image/png' }); const url = URL.createObjectURL(blob);
  $('eqShareOut').innerHTML = `<img src="${url}" alt="穿搭卡" style="width:100%;border-radius:8px;margin-top:8px"><p class="eqHint">手機也可以長按圖片儲存。</p><a href="${url}" download="oyster-outfit.png" class="btnLike">儲存圖片</a><p class="eqHint" style="margin-top:10px">加入 Discord 分享穿搭，就送神秘好禮！</p><a href="https://discord.gg/tpPBqxACVq" target="_blank" rel="noopener" class="btnLike dcBtn">加入 Discord</a>`;
  const nav = navigator as any;
  if (D.COARSE && nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: '剝蚵仔模擬器', text: '看看我的剝蚵穿搭 https://jinweihuang20.github.io/oyster-sim/' }); } catch { } }
}

export function askSet(st: typeof SETS[number]) {
  document.getElementById('giftMsg')?.remove();
  const worn = wornIds(), on = st.need.every(i => worn.includes(i));
  const m = document.createElement('div'); m.id = 'giftMsg'; m.className = 'giftMsg setAsk';
  const items = st.need.map(i => { const e = EQUIP.find(x => x.id === i)!; return `<li>${eqIcon(e, 32)}<span>${e.n}</span></li>`; }).join('');
  m.innerHTML = on
    ? `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-check"></i> 已經穿著這套了</b><p class="saEff">${st.n}：${st.eff}</p><div class="mbtns"><button class="gmNo"><i class="ic ic-check"></i> 確定</button></div></div>`
    : `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-hand"></i> 要換上「${st.n}」嗎？</b><ul class="saList">${items}</ul><p class="saEff">套裝加成：${st.eff}</p><div class="mbtns"><button class="gmNo">取消</button><button class="gmYes"><i class="ic ic-check"></i> 換上</button></div></div>`;
  const close = () => m.remove();
  m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
  m.querySelector('.gmYes')?.addEventListener('click', () => {
    for (const i of st.need) { const e = EQUIP.find(x => x.id === i); if (e && eqOwned(i)) setEquip(e.slot, i); }
    D.persist(); applySleeve(); D.applyOutfit3(); renderEquip(); try { D.SFX.jingle(); } catch { /* 無音訊 */ }
    m.querySelector('.gmBox')!.innerHTML = `<button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-check"></i> 已換上「${st.n}」</b><p class="saEff">套裝加成生效：${st.eff}</p><div class="mbtns"><button class="gmNo"><i class="ic ic-check"></i> 確定</button></div>`;
    m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
    setTimeout(close, 2200);
  });
  m.addEventListener('click', e => { if (e.target === m) close(); });
  document.body.appendChild(m);
  hydrateEquipThumbs(m);
}

export function openEquip() {
  renderEquip();
  $('equip').classList.add('show');
  requestAnimationFrame(() => {
    void $('equip').offsetHeight;
    const fig = document.getElementById('eqFigW');
    if (fig) D.syncEqPreview(fig, currentOutfit());
  });
}
