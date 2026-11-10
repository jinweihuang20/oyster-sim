/** 裝備／服飾店 UI（從 main.ts 拆出，行為不變） */
import * as THREE from 'three';
import type { Save } from '../core';
import { $ } from '../ui';
import { type Slot, type Fx, type Eq, SLOTS, EQUIP, SETS } from './shopEquip';
import { EQUIP_VIS, paintEquipCanvas } from './equipVisual';
import { openClothTryPreview, closeClothTryPreview } from './tryPreview';

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
  sleeve: THREE.MeshStandardMaterial;
  shirtCuff: THREE.MeshStandardMaterial;
  getEqFromRes: () => boolean;
  setEqFromRes: (v: boolean) => void;
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
export const equipNow = (slot: Slot) => EQUIP.find(e => e.slot === slot && e.id === D.getSave().equip?.[slot] && eqOwned(e.id)) ?? EQUIP.find(e => e.slot === slot && e.price === 0)!;
export const wornIds = () => SLOTS.map(([s]) => equipNow(s).id);
export const setsOn = () => { const w = wornIds(); return SETS.filter(s => s.need.every(i => w.includes(i))); };
export const slOn = (id: string) => wornIds().includes(id);
export function fxAll(): Required<Fx> {
  const r = { bowl: 0, keep: 0, speed: 1, pearl: 1, nag: 1, throw: 1, dmg: 1, luck: 0 };
  for (const f of [...SLOTS.map(([s]) => equipNow(s).fx), ...setsOn().map(s => s.fx)]) { r.bowl += f.bowl ?? 0; r.keep += f.keep ?? 0; r.luck += f.luck ?? 0; r.speed *= f.speed ?? 1; r.pearl *= f.pearl ?? 1; r.nag *= f.nag ?? 1; r.throw *= f.throw ?? 1; r.dmg *= f.dmg ?? 1; }
  r.keep = Math.min(0.7, r.keep); r.throw = Math.max(0.1, r.throw);
  if (D.isEvRun()) { r.throw = Math.max(1, r.throw); r.nag = Math.max(1, r.nag); } // 活動中阿婆是瘋子：怕你、少丟、少唸的效果都不算
  return r;
}
export function migrateEquip() { const save = D.getSave(); save.equip = save.equip ?? {}; for (const [s] of SLOTS) if (!save.equip[s] || !eqOwned(save.equip[s])) save.equip[s] = EQUIP.find(e => e.slot === s && e.price === 0)!.id; }
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
  const s = D.getSleeveTry() ? EQUIP.find(x => x.id === D.getSleeveTry())! : equipNow('hand');
  D.sleeve.map?.dispose(); D.sleeve.map = eqTex(s); D.sleeve.color.set(0xffffff);
  D.sleeve.emissive.set(s.pat === 'neon' ? 0x1a8a50 : 0x000000); D.sleeve.needsUpdate = true;
  D.shirtCuff.color.set(equipNow('body').base);
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
    lg_flower: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="26" cy="22" r="3" fill="#fff3c8"/><circle cx="46" cy="36" r="3" fill="#fff3c8"/>` };
  // iOS WebKit：多個同名 clipPath id 會解析到第一個（可能在隱藏元素裡），每個實例改用唯一 id
  const u = `_${++eqSvgN}`;
  let body = (ID[e.id] ?? P[e.slot]).replace(/id="(c_[a-z0-9_]+)"/g, `id="$1${u}"`).replace(/url\(#(c_[a-z0-9_]+)\)/g, `url(#$1${u})`);
  if (grey) body = body.replace(/fill="#(?!a8a8a8)[0-9a-fA-F]{3,6}"/g, 'fill="#c4c4c4"');
  return `<svg class="slv" viewBox="0 0 72 60" width="${w}" height="${w * 60 / 72}">${body}</svg>`;
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
</defs>`;
  void 0;
  const PF: Record<string, string> = { flower: 'url(#pFlower)', camo: 'url(#pCamo)', neon: 'url(#pNeon)', tattoo: 'url(#pTat)' };
  // ---- 手臂（在衣服後面）：肩到腕，手在末端 ----
  const armFill = A.id === 'sl_flower' ? 'url(#pFlower)' : A.id === 'sl_camo' ? 'url(#pCamo)' : A.id === 'sl_neon' ? 'url(#pNeon)' : A.id === 'sl_89' ? 'url(#pTat)' : A.base;
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
    bd_sequin: `<path d="${T}" fill="url(#pSeq)" ${ol}/><path d="M64 92q16 16 32 0" fill="none" stroke="#ffd25a" stroke-width="3"/>` };
  const hood = B.id === 'bd_rain' ? `<path d="M50 92Q48 34 80 30Q112 34 110 92Z" fill="#ffd21a" ${ol}/>` : '';
  // ---- 褲子 ----
  const P = 'M54 182h52l6 86H86l-6-60-6 60H48Z';
  const legs: Record<string, string> = {
    lg_basic: `<path d="${P}" fill="#4a4a52" ${ol}/><path d="M58 190q8 10 16 0M86 190q8 10 16 0" stroke="#8a8a92" stroke-width="2" fill="none"/><rect x="92" y="222" width="12" height="12" fill="none" stroke="#8a8a92" stroke-width="2"/>`,
    lg_rain: `<path d="${P}" fill="#ffd21a" ${ol}/><path d="M60 190l-6 72M100 190l4 72" stroke="#fffbe0" stroke-width="3" opacity=".85"/>`,
    lg_flower: `<path d="${P}" fill="url(#pFlower)" ${ol}/>`,
    lg_camo: `<path d="${P}" fill="url(#pCamo)" ${ol}/><rect x="56" y="214" width="12" height="14" fill="none" stroke="#2e3a1e" stroke-width="2"/>` };
  // ---- 鞋子 ----
  const toes = (x: number) => [0, 1, 2, 3].map(i => `<circle cx="${x + 6 + i * 7}" cy="270" r="3" fill="${SK}" stroke="${k}" stroke-width="1.2"/>`).join('');
  const slip = (sole: string, strap: string) => [40, 84].map(x => `<rect x="${x - 4}" y="276" width="40" height="7" rx="3" fill="${sole}" stroke="${k}" stroke-width="2.5"/>${toes(x)}<path d="M${x + 2} 276q16-12 32 0" fill="none" stroke="${strap}" stroke-width="5"/>`).join('');
  const feet: Record<string, string> = {
    ft_basic: slip('#f2f2ee', '#2a5ab0'),
    ft_gold: slip('#e8b830', '#ffd25a') + `<circle cx="56" cy="271" r="2" fill="#fff"/><circle cx="100" cy="271" r="2" fill="#fff"/>`,
    ft_boots: [44, 84].map(x => `<path d="M${x} 236h30v40h6v8H${x - 4}v-8h4Z" fill="#ffd21a" ${ol}/><path d="M${x + 4} 242v32" stroke="#fffbe0" stroke-width="3"/>`).join(''),
    ft_work: [40, 84].map(x => `<path d="M${x + 2} 258h30l4 18h4v8H${x - 2}v-8h4Z" fill="#6a4a2a" ${ol}/>${[262, 268, 274].map(y => `<path d="M${x + 10} ${y}l12 3M${x + 22} ${y}l-12 3" stroke="#e8d8a8" stroke-width="1.5"/>`).join('')}`).join('') };
  // ---- 頭 ----
  const hd: Record<string, string> = {
    hd_basic: `<path d="M56 62Q56 34 80 34Q104 34 104 62Q92 48 80 50Q68 48 56 62Z" fill="url(#pFlowerR)" ${ol}/><path d="M102 56l14 6-6 6zM102 58l10 14-8 0z" fill="#c84a5a" ${ol}/>`,
    hd_hat: `<path d="M28 58L80 22L132 58Q80 66 28 58Z" fill="#d8b46a" ${ol}/><path d="M48 50L112 50M62 40H98M80 22V58" stroke="#8a6a2a" stroke-width="1.5"/><path d="M62 62q18 28 36 0" fill="none" stroke="${k}" stroke-width="1.5"/>`,
    hd_fisher: `<path d="M58 54V38Q80 26 102 38V54Z" fill="#4a6a8a" ${ol}/><path d="M44 62L58 52H102L116 62Q80 68 44 62Z" fill="#4a6a8a" ${ol}/><path d="M58 50H102" stroke="#2a3a4a" stroke-width="2.5"/>`,
    hd_helmet: `<path d="M56 56Q56 30 80 30Q104 30 104 56Z" fill="#ffb21a" ${ol}/><path d="M48 54H112V60H48Z" fill="#ffb21a" ${ol}/><path d="M80 30V54M70 33v21M90 33v21" stroke="${k}" stroke-width="2"/>`,
    hd_crown: `<path d="M58 54L60 28L70 40L80 22L90 40L100 28L102 54Z" fill="#e8b830" ${ol}/><path d="M58 54H102" stroke="#b8862a" stroke-width="4"/><circle cx="80" cy="44" r="4" fill="#c82a2a" stroke="${k}" stroke-width="1.5"/><circle cx="66" cy="48" r="2.5" fill="#2a8ac8"/><circle cx="94" cy="48" r="2.5" fill="#2a8ac8"/><circle cx="80" cy="22" r="2.5" fill="#fff6dc" stroke="${k}"/>` };
  const face = `<circle cx="80" cy="66" r="24" fill="${SK}" ${ol}/><circle cx="71" cy="66" r="2.6" fill="${k}"/><circle cx="89" cy="66" r="2.6" fill="${k}"/><path d="M73 76q7 6 14 0" fill="none" stroke="${k}" stroke-width="2.2" stroke-linecap="round"/><circle cx="66" cy="73" r="3" fill="#f0a090" opacity=".7"/><circle cx="94" cy="73" r="3" fill="#f0a090" opacity=".7"/>`;
  void PF;
  return `<svg viewBox="0 0 160 300" class="eqFig">${defs}${hood}${arm(50, 34)}${arm(110, 126)}${legs[L.id] ?? legs.lg_basic}${body[B.id] ?? body.bd_basic}${face}${hd[H.id] ?? hd.hd_basic}${feet[F.id] ?? feet.ft_basic}</svg>`;
}
// 裝備面板 v2：場景＋木牌部位卡＋加成看板＋套裝收集
// ax/ay：僅首幀佔位；實際圓圈／線由 equipPreview 投影 3D（頭＝帽子中心），不再用 ay 去拉人物高度
const EQ_CARD: Record<Slot, { side: 'l' | 'r'; top: number; ax: number; ay: number }> = {
  head: { side: 'l', top: 2, ax: 80, ay: 36 }, hand: { side: 'l', top: 34, ax: 40, ay: 170 }, feet: { side: 'l', top: 66, ax: 70, ay: 270 },
  body: { side: 'r', top: 18, ax: 98, ay: 122 }, legs: { side: 'r', top: 48, ax: 94, ay: 203 } };
const EQ_FW = 54.04, EQ_FT = 2, EQ_FH = 86, EQ_CH = 27, EQ_CW = 30;
const eqAx = (vx: number) => 50 + (vx - 80) / 160 * EQ_FW, eqAy = (vy: number) => EQ_FT + vy / 300 * EQ_FH;
const SVG_SHED = `<svg class="eqShed" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="eqSpot" cx="50%" cy="48%" r="45%"><stop offset="0" stop-color="#fff6d8" stop-opacity=".95"/><stop offset=".6" stop-color="#ffe9b0" stop-opacity=".35"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient><pattern id="eqMat" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#c9a865"/><path d="M0 5h14" stroke="#a8864a" stroke-width="1.4"/><path d="M7 0v5M0 5v5M14 5v5" stroke="#b39352" stroke-width="1"/></pattern></defs>
<rect width="300" height="400" fill="#2c4a63"/><path d="M0 0h300v54L150 30 0 54Z" fill="#5d8fb3"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 20} ${54 - i * 1.6 * (i < 8 ? 1 : 0) - (i >= 8 ? (15 - i) * 1.6 : 0)}V0" stroke="#3f6f92" stroke-width="2"/>`).join('')}<path d="M0 54L150 30 300 54" fill="none" stroke="#16191d" stroke-width="4"/>
<rect x="20" y="52" width="10" height="280" fill="#6b4a2a" stroke="#16191d" stroke-width="2"/><rect x="270" y="52" width="10" height="280" fill="#6b4a2a" stroke="#16191d" stroke-width="2"/>
${[46, 76, 224, 254].map((x, j) => `<path d="M${x} 50V${120 + j % 2 * 30}" stroke="#d9c9a0" stroke-width="1.5"/>${[0, 1, 2, 3].map(k => `<ellipse cx="${x + (k % 2 ? 4 : -4)}" cy="${66 + k * 16 + j % 2 * 6}" rx="6" ry="4" fill="#9aa39a" stroke="#16191d" stroke-width="1.5"/>`).join('')}`).join('')}
<rect width="300" height="400" fill="url(#eqSpot)"/><path d="M0 330L300 330 300 400 0 400Z" fill="url(#eqMat)"/><path d="M0 330H300" stroke="#16191d" stroke-width="3"/><ellipse cx="150" cy="350" rx="70" ry="10" fill="#000" opacity=".25"/></svg>`;
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
  return out;
}
export function renderEquip() {
  const sets = setsOn(), st = eqStats(), worn = wornIds();
  const lines = SLOTS.map(([s]) => { const c = EQ_CARD[s], cx = c.side === 'l' ? EQ_CW : 100 - EQ_CW, cy = c.top + EQ_CH / 2;
    return `<line data-slot="${s}" x1="${cx}" y1="${cy}" x2="${eqAx(c.ax).toFixed(1)}" y2="${eqAy(c.ay).toFixed(1)}"/><circle data-slot="${s}" cx="${eqAx(c.ax).toFixed(1)}" cy="${eqAy(c.ay).toFixed(1)}" r="1.1"/>`; }).join('');
  const cards = SLOTS.map(([s, n]) => { const c = EQ_CARD[s], e = equipNow(s);
    return `<button class="eqCard ${c.side}${D.getEqPick() === s ? ' on' : ''}" data-slot="${s}" style="top:${c.top}%"><span class="eqTag">${n}</span>${eqSvg(e, 44)}<b>${e.n}</b><small>${e.price ? e.eff : '基本款，沒有加成'}</small></button>`; }).join('');
  const hits = SLOTS.map(([s]) => { const c = EQ_CARD[s]; return `<button class="eqHit" data-slot="${s}" aria-label="${SLOTS.find(x => x[0] === s)![1]}" style="left:${eqAx(c.ax)}%;top:${eqAy(c.ay)}%"></button>`; }).join('');
  const pickName = D.getEqPick() ? SLOTS.find(x => x[0] === D.getEqPick())![1] : '';
  $('eqBody').innerHTML =
    `<div class="eqBoard"><div class="eqBoardT">目前加成</div>${st.length ? `<div class="eqStats">${st.map(x => { const [a, b] = x.split('|'); return `<div><small>${a}</small><b>${b}</b></div>`; }).join('')}</div>` : '<p class="eqNone">現在穿的都是基本款，還沒有加成。去服飾店挑幾件吧。</p>'}</div>` +
    `<div class="eqStage">${SVG_SHED}<div class="eqFigW" id="eqFigW"></div><svg class="eqLines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${hits}${cards}</div>` +
    (D.getEqPick() ? `<div class="eqList"><div class="eqListT">換${pickName}<small>點一件就換上，換穿免費</small></div>${EQUIP.filter(e => e.slot === D.getEqPick() && eqOwned(e.id)).map(e => `<button data-eqset="${e.id}" class="${equipNow(e.slot).id === e.id ? 'on' : ''}">${eqSvg(e, 48)}<span><b>${e.n}</b><small>${e.eff}</small></span>${equipNow(e.slot).id === e.id ? '<em>穿著中</em>' : ''}</button>`).join('')}<p class="eqHint">想要更多款式，去服飾店看看。</p></div>` : '<p class="eqHint">點人身上的部位或旁邊的木牌來換裝。</p>') +
    `<div class="eqSecT">套裝收集</div><div class="eqSets">${SETS.map(s => { const done = sets.includes(s), have = s.need.filter(i => eqOwned(i)).length;
      const full = have === s.need.length; return `<div class="eqSet${done ? ' done' : ''}${full ? ' full' : ''}"${full ? ` data-setid="${s.id}" role="button"` : ''}><div class="eqSetH"><b>${s.n}</b><span>${have}/${s.need.length} 件</span></div><div class="eqSetI">${s.need.map(i => { const e = EQUIP.find(x => x.id === i)!; return `<div class="${worn.includes(i) ? 'worn' : eqOwned(i) ? 'own' : 'no'}">${eqSvg(e, 40, !eqOwned(i))}<small>${e.n}</small></div>`; }).join('')}</div><p>${s.eff}${s.id === 'typhoon' ? '（手部任意）' : ''}</p>${done ? '<i class="eqStamp">套裝完成</i>' : ''}${full ? `<em class="eqSetGo"><i class="ic ${done ? 'ic-check' : 'ic-hand'}"></i> ${done ? '穿著中' : '一鍵換上'}</em>` : ''}</div>`; }).join('')}</div>` +
    `<div id="eqShareOut"></div><p class="eqHint">分享到 Discord 有機會拿神秘好禮</p><div class="eqDock"><button id="eqShare"><i class="ic ic-send"></i>分享穿搭</button><button id="eqShop"><i class="ic ic-shop"></i>去服飾店</button></div>`;
  D.syncEqPreview($('eqFigW'), {
    head: equipNow('head').id, hand: equipNow('hand').id,
    body: equipNow('body').id, legs: equipNow('legs').id, feet: equipNow('feet').id,
  });
  $('eqBody').querySelectorAll('button[data-slot]').forEach(b => (b as HTMLButtonElement).onclick = () => { const s = b.getAttribute('data-slot') as Slot; D.setEqPick(D.getEqPick() === s ? null : s); renderEquip(); if (D.getEqPick()) $('eqBody').querySelector('.eqList')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  $('eqBody').querySelectorAll<HTMLElement>('.eqSet[data-setid]').forEach(el => el.onclick = () => { const st = SETS.find(x => x.id === el.dataset.setid); if (st) askSet(st); });
  $('eqBody').querySelectorAll('button[data-eqset]').forEach(b => (b as HTMLButtonElement).onclick = () => { const e = EQUIP.find(x => x.id === b.getAttribute('data-eqset'))!; setEquip(e.slot, e.id); D.persist(); applySleeve(); D.applyOutfit3(); renderEquip(); });
  ($('eqShare') as HTMLButtonElement).onclick = shareOutfit;
  ($('eqShop') as HTMLButtonElement).onclick = () => { D.openShopPx(); $('equip').classList.remove('show'); D.stopEqPreview(); D.setEqFromRes(false); if (D.getEqPick()) D.setClothTab(D.getEqPick()!); D.renderShop(); const gs = Array.from(document.querySelectorAll('#shopList .stab')); const i = gs.findIndex(g => g.querySelector('.slGrid')); if (i >= 0) { D.setShopTab(i); D.renderShop(); } $('shop').classList.add('show'); $('shop').scrollTop = 0; };
}
export function renderClothShop() {
  if (D.getSleeveTry()) { D.setSleeveTry(null); applySleeve(); }
  const items = EQUIP.filter(e => e.slot === D.getClothTab() && e.price > 0).sort((a, b) => a.price - b.price);
  $('shopList').insertAdjacentHTML('beforeend', `<h3><i class="ic ic-hand"></i> 服飾</h3><p style="font-size:12px;opacity:.8">買了永久擁有，每個部位一次穿一件，只有穿著的有效果。換穿免費，也可以在主畫面的「裝備」換。湊齊套裝還有額外加成。點商品圖片可試穿，還沒買也能看。</p><div class="clTabs">${SLOTS.map(([s, n]) => `<button data-ctab="${s}" class="${s === D.getClothTab() ? 'on' : ''}">${n}</button>`).join('')}</div><div class="slGrid">` + items.map(s => { const own = eqOwned(s.id), cur = equipNow(s.slot).id === s.id;
    return `<div class="slCard${cur ? ' on' : ''}"><button type="button" class="slPeek" data-sltry="${s.id}" aria-label="試穿 ${s.n}">${eqSvg(s)}<b>${s.n}</b><em class="slPeekT">點我看穿著樣子</em></button><small>${s.eff}</small>${D.pxCd(s.id)}<div class="slBtns">${own ? `<button data-sleq="${s.id}" ${cur ? 'disabled' : ''}>${cur ? '穿著中' : '換上'}</button>` : `<button data-slbuy="${s.id}" ${D.getSave().money < D.px(s.id, s.price) ? 'disabled' : ''}>${D.pxHtml(s.id, s.price, '買 ')}</button>`}</div></div>`; }).join('') + `</div>`);
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
  g.fillStyle = '#c8302a'; g.fillRect(60, 60, W - 120, 150); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(60, 60, W - 120, 150);
  g.fillStyle = '#fff6dc'; g.textAlign = 'center'; g.font = 'bold 84px sans-serif'; g.fillText('剝蚵仔模擬器', W / 2, 165);
  g.font = 'bold 60px sans-serif'; g.fillText(D.myName(), W / 2, 300); g.font = '36px sans-serif'; g.fillStyle = '#c8d8e8'; g.fillText('#' + D.statsId.slice(0, 4).toUpperCase() + ' 的今日穿搭', W / 2, 352);
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(figSvg().replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="750" '));
  await new Promise(r => { img.onload = r; img.onerror = r; }); g.fillStyle = '#f0e6c8'; g.fillRect(80, 400, 440, 780); g.drawImage(img, 100, 415, 400, 750);
  g.textAlign = 'left'; let y = 450;
  for (const [s, n] of SLOTS) { const e = equipNow(s); g.fillStyle = e.base; g.fillRect(570, y - 40, 50, 50); g.strokeStyle = '#1b1b1b'; g.lineWidth = 4; g.strokeRect(570, y - 40, 50, 50); g.fillStyle = '#c8d8e8'; g.font = '32px sans-serif'; g.fillText(n, 640, y - 12); g.fillStyle = '#fff6dc'; g.font = 'bold 42px sans-serif'; g.fillText(e.n, 640, y + 34); y += 130; }
  const sets = setsOn(); if (sets.length) { g.fillStyle = '#ffd25a'; g.font = 'bold 40px sans-serif'; g.fillText('套裝：' + sets.map(s => s.n).join('、'), 570, y + 10); }
  g.textAlign = 'center'; g.fillStyle = '#c8d8e8'; g.font = '34px sans-serif'; g.fillText('https://jinweihuang20.github.io/oyster-sim/', W / 2, H - 80);
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
  const items = st.need.map(i => { const e = EQUIP.find(x => x.id === i)!; return `<li>${eqSvg(e, 32, false)}<span>${e.n}</span></li>`; }).join('');
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
}

export function openEquip() { renderEquip(); $('equip').classList.add('show'); requestAnimationFrame(() => { void $('equip').offsetHeight; renderEquip(); }); }
