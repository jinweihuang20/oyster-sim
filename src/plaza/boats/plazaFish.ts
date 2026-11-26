/**
 * 廣場海面釣魚（客戶端）：釣魚模式的按鈕（拋竿／收線／抽竿）、力道條、張力條、換餌面板、圖鑑、釣線浮標魚影、賣魚。
 * 判定在伺服器（PlazaWorld.Fish.cs）：能不能拋、每 2 秒擲咬餌、收竿時間窗、魚種重量、拉扯最短時間、魚獲、賣魚上限。
 * 釣竿／餌／假魚在本機存檔（跟蚵棚組合包一樣）；伺服器說用掉才扣。
 * 手機省電：只有在釣魚時才畫 3 個東西（1 條線段組＋浮標＋魚影），每幀不 new 物件，DOM 只在字變了才改。
 */
import * as THREE from 'three';
import { toast, toastTop } from '../../ui/dom';
import { rewardToast } from '../../ui/rewardToast';
import { walkKeys, joy } from '../../world/walkSeat';
import type { PlayerRig } from '../../dm/character';
import { PB, pierNearest } from './boatLogic';
import type { BoatNet } from './boatNet';
import { FISH, FishSM, ITEM_NAME, LURE_TIP, isLure, castPoint, castDist, castRange, yawOf, trollOk, type Gear, type ItemKey, type BaitKey, type LureKey } from './fishLogic';
import { makeRod, type Rod } from './fishRod';
import { fishGeometry, fishMaterial } from './fishModel';
import { mountFishDex, fishDexMerge, type FishDexView } from './fishDex';
import { newFishPose, stepFishPose, applyFishPose, rodTipWorld, fishPoseCode, type FishPoseIn, type FishPhase } from './fishPose';

export type FishBoat = { id: number; x: number; z: number; h: number; v: number };
export type FishCtx = {
  net: () => BoatNet | null;
  scene: THREE.Object3D;
  mode: () => 'walk' | 'boat' | 'swim';
  myBoat: () => FishBoat | null;
  mySeat: () => number;
  walkPos: () => { x: number; z: number };
  canAct: () => boolean;
  me: () => PlayerRig | null;
  localOnly: () => boolean;
  splash: (x: number, z: number, k: number) => void;
  sfx: (k: 'splash' | 'bump' | 'hit' | 'dock' | 'launch' | 'warn') => void;
  grantMoney?: (n: number, via: string) => void;
  /** 釣具存檔：gear(id) 有幾個、addGear(id, ±n) */
  gear?: (id: string) => number;
  addGear?: (id: string, d: number) => void;
  /** 蚵仔肉：今天還能帶幾塊、用掉一塊 */
  oyster?: () => number;
  useOyster?: () => void;
};

const ICON = {
  rod: '<svg viewBox="0 0 24 24"><path d="M4 20L19 3"/><path d="M19 3v12"/><circle cx="19" cy="17" r="2"/><path d="M6 18l2 2"/></svg>',
  cast: '<svg viewBox="0 0 24 24"><path d="M4 20L17 5"/><path d="M17 5c3 3 4 8 2 13"/><circle cx="19" cy="19" r="1.6"/></svg>',
  reel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5V2M19 12h3"/></svg>',
  jerk: '<svg viewBox="0 0 24 24"><path d="M5 19l6-6 3 3 5-9"/><path d="M15 7h4v4"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M3 12c3-4 7-6 11-6 3 0 5 2 7 6-2 4-4 6-7 6-4 0-8-2-11-6z"/><path d="M3 12l-1-3M3 12l-1 3"/><circle cx="16" cy="11" r="1"/></svg>',
  sell: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="2.6"/><path d="M7 4h10"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M7 4h10l-1 6H8z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="3"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5c3-1 6-1 8 1v14c-2-2-5-2-8-1z"/><path d="M20 5c-3-1-6-1-8 1v14c2-2 5-2 8-1z"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
};
const ERR: Record<string, string> = {
  not_at_water: '站到碼頭或岸邊才能釣', moving: '船在開：先停船才能拋竿', swimming: '游泳時不能釣魚', land: '那邊是岸上，轉向海面再拋',
  hold_full: '魚獲滿了，先回碼頭賣魚', bad_gear: '這個餌配不上這支竿', fighting: '', slow: '', far_dock: '靠近碼頭再賣', empty: '還沒有魚可以賣',
  daily_cap: '今天賣魚到上限了，明天再來', old_server: '伺服器還沒更新，暫時不能釣魚', offline: '還沒連上線', no_cast: '', too_fast: '魚跑掉了',
};
const err = (e?: string, d = '做不到') => (e != null && e in ERR ? ERR[e] || d : d);
const money = (n: number) => `$${Math.round(n).toLocaleString('zh-TW')}`;
const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
/** 除錯：每個伺服器呼叫最後一次的回應 */
const dbgLast: Record<string, unknown> = {};
const g = (o: any, k: string) => o?.[k] ?? o?.[k[0].toUpperCase() + k.slice(1)];
const TIER = ['普通', '稀有', '傳說'];

type HoldFish = { sp: string; name: string; tier: number; kg: number; val: number };
const normFish = (o: any): HoldFish | null => o ? { sp: String(g(o, 'sp') ?? ''), name: String(g(o, 'name') ?? ''), tier: num(g(o, 'tier')), kg: num(g(o, 'kg')), val: num(g(o, 'val')) } : null;

let C: FishCtx | null = null;
const sm = new FishSM();
let rod: Gear = 'float';
let pick: Record<Gear, ItemKey> = { float: 'oyster', lure: 'minnow' };
let ok = false, oldServer = false, busy = false, fetchT = 0, fetchTries = 0;
let hold: HoldFish[] = [], holdN = 0, holdVal = 0, sellLeft: number = FISH.sellMax;
let dexView: FishDexView | null = null;
let dex = new Map<string, { kg: number; n: number }>();
let reelHeld = false, jerkQ = false, act = false, castH = 0, castX = 0, castZ = 0, castDst = 8, ox = 0, oz = 0;
let hooked: HoldFish | null = null;
let t = 0, splashT = 0, shadowA = 0, tipS = '', panelTab: 'gear' | 'dex' = 'gear', panelOn = false;
let ui: {
  entry: HTMLButtonElement; sell: HTMLButtonElement; bar: HTMLDivElement; cast: HTMLButtonElement; reel: HTMLButtonElement; jerk: HTMLButtonElement;
  hud: HTMLDivElement; hudTx: HTMLSpanElement; hudTip: HTMLSpanElement; meter: HTMLDivElement; fill: HTMLDivElement; mLbl: HTMLSpanElement; dirL: HTMLElement; dirR: HTMLElement; panel: HTMLDivElement;
} | null = null;
// 3D：一組線段（竿＋線）、浮標／假魚、魚影
// 3D：釣竿模型（掛在人物身上）＋釣線（一條線段）、浮標／假魚、魚影
let myRod: Rod | null = null;
const myPose = newFishPose();
const poseIn: FishPoseIn = { phase: 'off', power: 0, reel: false, tension: 0, lure: false, twitch: 0 };
let gfx: { g: THREE.Group; line: THREE.LineSegments; pos: Float32Array; bob: THREE.Mesh; bobMat: THREE.MeshBasicMaterial; shadow: THREE.Mesh; shMat: THREE.MeshBasicMaterial } | null = null;
const _tip = new THREE.Vector3(), _end = new THREE.Vector3(), _dir = new THREE.Vector3();

const owns = (gr: Gear) => (C?.gear?.(FISH.rods[gr].id) ?? 0) > 0;
const anyRod = () => owns('float') || owns('lure');
function countOf(k: ItemKey) {
  if (k === 'oyster') return C?.oyster?.() ?? 0;
  const it = isLure(k) ? FISH.lures.find(x => x.k === k) : FISH.baits.find(x => x.k === k);
  return it?.id ? C?.gear?.(it.id) ?? 0 : 0;
}
function useItem(k: ItemKey) {
  if (k === 'oyster') { C?.useOyster?.(); return; }
  const it = isLure(k) ? FISH.lures.find(x => x.k === k) : FISH.baits.find(x => x.k === k);
  if (it?.id) C?.addGear?.(it.id, -1);
}
/** 目前選的餌／假魚沒了：自動換成還有的 */
function fixPick() {
  if (!owns(rod) && owns(rod === 'float' ? 'lure' : 'float')) rod = rod === 'float' ? 'lure' : 'float';
  const list: ItemKey[] = rod === 'float' ? FISH.baits.map(b => b.k) : FISH.lures.map(l => l.k);
  if (countOf(pick[rod]) > 0) return;
  const k = list.find(x => countOf(x) > 0); if (k) pick[rod] = k;
}

// ---------------- 開／關 ----------------
export function openFish(ctx: FishCtx, root: HTMLElement) {
  closeFish();
  C = ctx; ok = false; oldServer = false; busy = false; fetchT = 2; fetchTries = 0; hold = []; holdN = holdVal = 0; sm.exit(); hooked = null; panelOn = false;
  const mk = (id: string, ic: string, label: string, key = '', cls = '') => {
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'boatBtn fishBtn ' + cls;
    b.innerHTML = `<i class="boatIc">${ic}</i><span class="lbl">${label}</span>${key ? `<span class="key"> (${key})</span>` : ''}`;
    return b;
  };
  const entry = mk('fishGo', ICON.rod, '釣魚', 'G');
  const sell = mk('fishSell', ICON.sell, '賣魚');
  const bar = document.createElement('div'); bar.id = 'fishBar';
  const jerk = mk('fishJerk', ICON.jerk, '抽竿', 'J');
  const reel = mk('fishReel', ICON.reel, '收線', '空白鍵');
  const cast = mk('fishCast', ICON.cast, '拋竿', '空白鍵');
  bar.append(jerk, reel, cast);
  const hud = document.createElement('div'); hud.id = 'fishHud';
  hud.innerHTML = `<div class="fhTx"><span class="fhMain"></span><span class="fhTip"></span></div><button type="button" class="fhB" data-f="gear" aria-label="換竿換餌">${ICON.gear}<span>換餌</span></button><button type="button" class="fhB" data-f="dex" aria-label="魚類圖鑑">${ICON.book}<span>圖鑑</span></button><button type="button" class="fhB fhX" data-f="exit" aria-label="不釣了">${ICON.exit}<span>不釣了</span></button>`;
  const meter = document.createElement('div'); meter.id = 'fishMeter';
  meter.innerHTML = `<i class="fmDir l">${ICON.left}</i><div class="fmBar"><div class="fmRed"></div><div class="fmFill"></div></div><i class="fmDir r">${ICON.right}</i><span class="fmLbl"></span>`;
  const panel = document.createElement('div'); panel.id = 'fishPanel';
  const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  const tap = (b: HTMLElement, f: () => void) => b.addEventListener('pointerdown', e => { stop(e); act = true; f(); });
  tap(entry, () => toggleFish());
  tap(sell, () => void sellFish());
  tap(jerk, () => { jerkQ = true; });
  cast.addEventListener('pointerdown', e => { stop(e); act = true; pressCast(); });
  reel.addEventListener('pointerdown', e => { stop(e); act = true; pressReel(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    cast.addEventListener(ev, () => releaseCast());
    reel.addEventListener(ev, () => { reelHeld = false; });
  }
  for (const b of [entry, sell, jerk, reel, cast]) b.addEventListener('click', stop);
  hud.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-f]'); if (!b) return;
    e.preventDefault(); act = true;
    const f = b.dataset.f;
    if (f === 'exit') exitFish(); else openPanel(f === 'dex' ? 'dex' : 'gear');
  });
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  // 把「釣魚」「賣魚」放進船上那一欄（跟拉蚵串同一排）；沒有那一欄就放自己的
  const rackBar = root.querySelector('#boatRackBar');
  (rackBar ?? root).append(entry, sell);
  root.append(bar, hud, meter, panel);
  ui = { entry, sell, bar, cast, reel, jerk, hud, hudTx: hud.querySelector('.fhMain')!, hudTip: hud.querySelector('.fhTip')!, meter, fill: meter.querySelector('.fmFill')!, mLbl: meter.querySelector('.fmLbl')!, dirL: meter.querySelector('.fmDir.l')!, dirR: meter.querySelector('.fmDir.r')!, panel };
  addEventListener('keyup', onKeyUp);
  addEventListener('pointerdown', onAnyInput, { passive: true });
  buildGfx(ctx.scene);
}
export function closeFish() {
  if (ui) { ui.entry.remove(); ui.sell.remove(); ui.bar.remove(); ui.hud.remove(); ui.meter.remove(); ui.panel.remove(); ui = null; }
  removeEventListener('keyup', onKeyUp);
  removeEventListener('pointerdown', onAnyInput);
  document.body.classList.remove('plazaFishing', 'fishPanelOpen', 'fishFight');
  if (gfx) { gfx.g.removeFromParent(); gfx.line.geometry.dispose(); (gfx.line.material as THREE.Material).dispose(); gfx.bob.geometry.dispose(); gfx.bobMat.dispose(); gfx.shadow.geometry.dispose(); gfx.shMat.dispose(); gfx = null; }
  dexView?.stop(); dexView = null;
  dropRod(); catchT = 0; catchMesh?.removeFromParent(); catchMesh = null;
  sm.exit(); C = null; reelHeld = false;
}
function onAnyInput() { act = true; }
function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') { releaseCast(); reelHeld = false; }
}

function buildGfx(parent: THREE.Object3D) {
  const g = new THREE.Group(); g.name = 'plazaFish'; g.visible = false;
  const pos = new Float32Array(12);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1d2b3a }));
  line.frustumCulled = false;
  const bobMat = new THREE.MeshBasicMaterial({ color: 0xe8432e });
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), bobMat);
  const shMat = new THREE.MeshBasicMaterial({ color: 0x0a1a28, transparent: true, opacity: 0, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), shMat);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.55, 1.4, 1);
  g.add(line, bob, shadow); parent.add(g);
  gfx = { g, line, pos, bob, bobMat, shadow, shMat };
}

// ---------------- 伺服器 ----------------
async function fetchState() {
  const n = C?.net(); if (!n || C?.localOnly()) return;
  const r = await n.fish('FishState'); dbgLast.FishState = r;
  if (r?.err === 'old_server' || (r && !r.ok && r.err === 'fail')) { oldServer = true; return; }
  if (!r?.ok) return;
  const s = r.state;
  ok = true;
  hold = ((g(s, 'hold') ?? []) as any[]).map(normFish).filter((f): f is HoldFish => !!f);
  holdN = hold.length; holdVal = num(g(s, 'holdVal'));
  sellLeft = num(g(s, 'sellLeft'), FISH.sellMax);
  dex = new Map(((g(s, 'dex') ?? []) as any[]).map(o => [String(g(o, 'sp') ?? ''), { kg: num(g(o, 'kg')), n: num(g(o, 'n')) }]));
  const ch = fishDexMerge([...dex].map(([sp, d]) => ({ sp, kg: d.kg, n: d.n })));
  if (panelOn && (panelTab !== 'dex' || ch)) renderPanel();
}
export function onFishBig(e: { connId: string; nick: string; name: string; kg: number }) {
  if (!C) return;
  rewardToast(`${e.nick || '有人'} 釣到傳說魚：${e.name}`, `${e.kg.toFixed(1)} kg`, 'feed', `fishbig:${e.connId}:${e.kg}`);
}

// ---------------- 進出釣魚模式 ----------------
/** 現在站的地方能不能釣（客戶端提示，伺服器會再判一次） */
function canFishHere(): boolean {
  if (!C) return false;
  const m = C.mode();
  if (m === 'boat') return !!C.myBoat();
  if (m !== 'walk') return false;
  const p = C.walkPos();
  return (p.x <= -23.5 && p.x >= PB.pierX1 - 0.3 && Math.abs(p.z) <= PB.pierHalfW + 0.3) || (p.x <= -23.5 && Math.abs(p.z) <= 11);
}
function toggleFish() { if (sm.phase === 'off') enterFish(); else exitFish(); }
function enterFish() {
  if (!C || sm.phase !== 'off') return;
  if (!anyRod()) { toast('先到雜貨店買「垂釣竿」或「路亞竿」', '#ffb08a', 2); return; }
  if (oldServer) { toast(ERR.old_server, '#ffb08a', 2); return; }
  if (!canFishHere()) { toast(ERR.not_at_water, '#ffb08a', 1.6); return; }
  fixPick();
  sm.gear = rod; sm.item = pick[rod];
  sm.enter();
  document.body.classList.add('plazaFishing');
  if (!ok) void fetchState();
  toastTop(rod === 'float' ? '按住「拋竿」蓄力，放開就拋出去；浮標整個沉下去再按「收竿」' : `按住「拋竿」蓄力；收線節奏：${LURE_TIP[pick.lure as LureKey]}`, 4);
}
export function exitFish(why = '') {
  if (!C || sm.phase === 'off') return;
  const n = C.net();
  if (sm.sid && (sm.lineOut || sm.phase === 'fight')) {
    if (sm.phase === 'fight') void n?.fish('FishLand', sm.sid, false, false);
    else void n?.fish('FishReel', sm.sid);
  }
  sm.exit(); sm.sid = 0; reelHeld = false; hooked = null;
  catchT = 0; catchMesh?.removeFromParent(); catchMesh = null;
  closePanel();
  document.body.classList.remove('plazaFishing', 'fishFight');
  if (why) toast(why, '#9fe0ff', 1.6);
}
/** 釣魚中要吃掉搖桿：岸上一直擋（不然走掉）；船上只有拉扯時擋（駕駛開船＝自動收線） */
export function fishHoldsInput() { return sm.phase !== 'off' && (C?.mode() === 'walk' || sm.phase === 'fight' || sm.phase === 'land'); }
export const fishActive = () => sm.phase !== 'off';

// ---------------- 動作 ----------------
function pressCast() {
  if (sm.phase === 'off') return;
  if (sm.phase === 'idle') {
    fixPick(); sm.gear = rod; sm.item = pick[rod];
    if (!owns(rod)) { toast(`還沒有${FISH.rods[rod].n}`, '#ffb08a'); return; }
    if (countOf(sm.item) < 1) { toast(sm.item === 'oyster' ? '今天的蚵仔肉用完了，換別的餌' : `${ITEM_NAME[sm.item]}用完了，到雜貨店補`, '#ffb08a', 1.8); openPanel('gear'); return; }
    if (holdN >= FISH.holdMax) { toast(ERR.hold_full, '#ffd76a', 1.8); return; }
    const b = C?.myBoat();
    if (C?.mySeat() === 0 && b && Math.abs(b.v) > FISH.driverMaxV) { toast(ERR.moving, '#ffb08a', 1.4); return; }
    sm.startCharge();
  }
}
function releaseCast() {
  const p = sm.release(); if (p == null || !C) return;
  const n = C.net();
  const cam = camRef; if (cam) { cam.getWorldDirection(_dir); castH = yawOf(_dir.x, _dir.z); }
  const o = origin(); ox = o.x; oz = o.z;
  const cp = castPoint(ox, oz, castH, p, sm.item); castX = cp.x; castZ = cp.z; castDst = castDist(p, sm.item);
  if (!n || C.localOnly()) { sm.castFail(); toast(ERR.offline, '#ffb08a'); return; }
  C.sfx('launch');
  void n.fish('FishCast', sm.gear, sm.item, p, castH).then(r => {
    dbgLast.FishCast = r;
    if (!r?.ok) { sm.castFail(); if (r?.err === 'old_server') oldServer = true; const m = err(r?.err, '拋不出去'); if (m && r?.err !== 'slow') toast(m, '#ffb08a', 1.6); return; }
    castX = num(r.x, castX); castZ = num(r.z, castZ); castDst = num(r.dist, castDst);
    sm.castOk(num(r.sid), castDst);
    // 落水
    window.setTimeout(() => { if (C && sm.lineOut) { C.splash(castX, castZ, 0.25); C.sfx('splash'); } }, FISH.flyS * 1000);
  });
}
function pressReel() {
  if (!C) return;
  if (sm.phase === 'fight' || (sm.phase === 'wait' && sm.gear === 'lure')) { reelHeld = true; return; }
  if (sm.gear === 'float' && sm.pressReel()) void doReel();
}
async function doReel() {
  const n = C?.net(); if (!n || !C) return;
  const r = await n.fish('FishReel', sm.sid); dbgLast.FishReel = r;
  if (!C || sm.phase !== 'hook') return;
  if (!r?.ok) { sm.reset(); if (r?.err && err(r.err, '')) toast(err(r.err, ''), '#ffb08a'); return; }
  const kind = String(r.kind ?? '');
  if (r.baitUsed) useItem(sm.item);
  if (kind === 'hooked') {
    hooked = normFish(r.fish);
    try { navigator.vibrate?.(70); } catch { /* 不支援 */ }
    C.sfx('hit');
    sm.hooked(num(r.power, 0.3), num(r.fightMs, 2500));
    document.body.classList.add('fishFight');
    toastTop(hooked && hooked.tier >= 2 ? '中魚！好重……是大傢伙！' : '中魚！按住「收線」，張力別到紅色' + (sm.gear === 'lure' ? '；魚往哪邊衝，搖桿就往反方向拉' : ''), 2.4);
    return;
  }
  sm.reset();
  if (kind === 'early') toast('太早收竿，餌被扯掉了', '#ffb08a', 1.6);
  else if (kind === 'late') toast('太慢了，餌被吃掉了', '#ffb08a', 1.6);
  else if (kind === 'reeled' && sm.gear === 'lure') { /* 收回來了 */ }
}
async function endFight(kind: 'landed' | 'snap' | 'unhook') {
  const n = C?.net(); if (!n || !C) return;
  document.body.classList.remove('fishFight');
  const r = await n.fish('FishLand', sm.sid, kind === 'landed', kind === 'snap'); dbgLast.FishLand = r;
  const f = hooked; hooked = null;
  if (!C) return;
  sm.reset();
  if (!r?.ok) { toast(err(r?.err, '魚跑掉了'), '#ffb08a', 1.6); return; }
  holdN = num(r.holdN, holdN); holdVal = num(r.holdVal, holdVal);
  if (r.lureLost) {
    useItem(sm.item);
    toast(`線斷了！${ITEM_NAME[sm.item]}沒了`, '#ff8a7a', 2);
    fixPick(); sm.item = pick[rod];
    return;
  }
  if (!r.landed) { toast(kind === 'snap' ? '線斷了，魚跑掉了' : '魚脫鉤跑掉了', '#ffb08a', 1.8); return; }
  const fish = normFish(r.fish) ?? f;
  if (!fish) return;
  hold.push(fish);
  showCatch(fish);
  const d = dex.get(fish.sp);
  dex.set(fish.sp, { kg: Math.max(d?.kg ?? 0, fish.kg), n: (d?.n ?? 0) + 1 });
  fishDexMerge([{ sp: fish.sp, ...dex.get(fish.sp)! }]);
  C.sfx('dock');
  const tag = r.first ? '・新魚種' : r.record ? '・最大紀錄' : '';
  rewardToast(`釣到${TIER[fish.tier] === '普通' ? '' : TIER[fish.tier]} ${fish.name}${tag}`, `${fish.kg.toFixed(fish.kg < 10 ? 2 : 1)} kg・約 ${money(fish.val)}`, 'mine', `fish:${Date.now()}`);
  if (holdN >= FISH.holdMax) toast('魚獲滿了！回碼頭賣魚', '#ffd76a', 2);
}
async function sellFish() {
  const n = C?.net(); if (!n || busy || !C) return;
  busy = true;
  const r = await n.fish('FishSell').finally(() => { busy = false; }); dbgLast.FishSell = r;
  if (!r?.ok) { if (r?.err !== 'slow') toast(err(r?.err, '賣不掉'), '#ffb08a'); return; }
  const pay = num(r.pay);
  C.grantMoney?.(pay, 'fish-sell');
  holdN = num(r.left); sellLeft = num(r.sellLeft, sellLeft);
  hold = holdN === 0 ? [] : hold.slice(-holdN);
  holdVal = holdN === 0 ? 0 : hold.reduce((s, f) => s + f.val, 0);
  C.sfx('launch');
  rewardToast(`賣魚 ${num(r.n)} 條・${num(r.kg).toFixed(1)} kg`, `+${money(pay)}`, 'mine', `fish-sell:${Date.now()}`);
  if (holdN > 0) toast('今天賣魚到上限了，剩下的明天再賣', '#ffd76a', 2.2);
  void fetchState();
}

// ---------------- 換餌／圖鑑面板 ----------------
function openPanel(tab: 'gear' | 'dex') { panelTab = tab; panelOn = true; renderPanel(); ui?.panel.classList.add('on'); document.body.classList.add('fishPanelOpen'); if (tab === 'dex') void fetchState(); }
function closePanel() { dexView?.stop(); dexView = null; panelOn = false; ui?.panel.classList.remove('on'); document.body.classList.remove('fishPanelOpen'); }
function renderPanel() {
  if (!ui) return;
  const tabs = `<div class="fpTabs"><button type="button" data-tab="gear" class="${panelTab === 'gear' ? 'on' : ''}">釣具</button><button type="button" data-tab="dex" class="${panelTab === 'dex' ? 'on' : ''}">魚類圖鑑</button><button type="button" class="fpX" aria-label="關閉">${ICON.exit}</button></div>`;
  let body = '';
  if (panelTab === 'gear') {
    const rodRow = (['float', 'lure'] as Gear[]).map(gr => `<button type="button" data-rod="${gr}" class="fpPick ${rod === gr ? 'on' : ''}" ${owns(gr) ? '' : 'disabled'}><b>${FISH.rods[gr].n}</b><small>${owns(gr) ? (gr === 'float' ? '掛餌等魚咬' : '操控假魚') : '雜貨店有賣'}</small></button>`).join('');
    const items: { k: ItemKey; n: string }[] = rod === 'float' ? FISH.baits.map(b => ({ k: b.k, n: b.n })) : FISH.lures.map(l => ({ k: l.k, n: l.n }));
    const itemRow = items.map(it => { const c = countOf(it.k); return `<button type="button" data-item="${it.k}" class="fpPick ${pick[rod] === it.k ? 'on' : ''}" ${c > 0 ? '' : 'disabled'}><b>${it.n}</b><small>${it.k === 'oyster' ? `今天剩 ${c} 塊` : `剩 ${c}`}</small></button>`; }).join('');
    const cr = castRange(pick[rod]);
    const tip = (rod === 'lure' ? `<p class="fpTip">${LURE_TIP[pick.lure as LureKey]}</p>` : '<p class="fpTip">浮標小小抖動是魚在試吃，等整個沉下去再收竿</p>') + `<p class="fpTip">拋竿距離 ${cr.min}～${cr.max} m${rod === 'lure' ? '（越重的假魚拋越遠）' : ''}</p>`;
    body = `<h4>釣竿</h4><div class="fpRow">${rodRow}</div><h4>${rod === 'float' ? '餌' : '假魚'}</h4><div class="fpRow">${itemRow}</div>${tip}<p class="fpFoot">魚獲 ${holdN}／${FISH.holdMax}・約 ${money(holdVal)}　今天還能賣 ${money(sellLeft)}</p>`;
  }
  dexView?.stop(false); dexView = null;
  ui.panel.innerHTML = tabs + `<div class="fpBody">${body}</div>`;
  if (panelTab === 'dex') { const host = ui.panel.querySelector<HTMLElement>('.fpBody')!; host.classList.add('fdxHost'); dexView = mountFishDex(host); }
  ui.panel.querySelector('.fpX')?.addEventListener('pointerdown', e => { e.preventDefault(); closePanel(); });
  ui.panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); panelTab = b.dataset.tab as 'gear' | 'dex'; renderPanel(); }));
  ui.panel.querySelectorAll<HTMLButtonElement>('[data-rod]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.disabled || sm.lineOut || sm.phase === 'fight') return; rod = b.dataset.rod as Gear; fixPick(); sm.gear = rod; sm.item = pick[rod]; renderPanel(); }));
  ui.panel.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.disabled || sm.lineOut || sm.phase === 'fight') return; pick[rod] = b.dataset.item as ItemKey; sm.item = pick[rod]; renderPanel(); }));
}

// ---------------- 鍵盤 ----------------
/** 回 true＝吃掉這個鍵（G＝釣魚／不釣；空白鍵＝拋竿（按住蓄力）／收線；J＝抽竿；Esc＝關面板） */
export function fishKey(code: string): boolean {
  if (!C) return false;
  if (code === 'KeyG') { if (sm.phase !== 'off' || (anyRod() && canFishHere() && (C.mode() !== 'walk' || C.canAct()))) { act = true; toggleFish(); return true; } return false; }
  if (sm.phase === 'off') return false;
  act = true;
  if (code === 'Escape') { if (panelOn) closePanel(); else exitFish(); return true; }
  if (code === 'Space') { if (sm.phase === 'idle') pressCast(); else pressReel(); return true; }
  if (code === 'KeyJ') { jerkQ = true; return true; }
  return code === 'KeyR' || code === 'KeyF' || code === 'KeyX';
}

// ---------------- 每幀 ----------------
let camRef: THREE.Camera | null = null;
let rollBusy = false, rollAcc = 0;
function origin() {
  const b = C?.myBoat();
  if (b) return { x: b.x, z: b.z };
  const p = C!.walkPos(); return { x: p.x, z: p.z };
}
export function tickFish(dt: number, cam: THREE.Camera) {
  if (!C) return;
  t += dt; camRef = cam;
  // 第一次進場：拿魚獲／圖鑑（舊伺服器就算了）
  if (!ok && !oldServer && fetchTries < 6) { fetchT -= dt; if (fetchT <= 0) { fetchT = 10; fetchTries++; void fetchState(); } }
  const mode = C.mode(); const b = C.myBoat();
  if (sm.phase !== 'off') {
    // 離開能釣的地方（下船、跳水、走開）：收竿
    if (!canFishHere()) exitFish(mode === 'swim' ? '掉進海裡，釣竿收起來了' : '');
    // 駕駛開船：自動收線
    else if (C.mySeat() === 0 && b && Math.abs(b.v) > FISH.driverMaxV && sm.lineOut) { void C.net()?.fish('FishReel', sm.sid); sm.reset(); toast('開船了，自動收線', '#9fe0ff', 1.4); }
  }
  if (sm.phase !== 'off') {
    let dir = 0;
    if (walkKeys.has('KeyA') || walkKeys.has('ArrowLeft')) dir -= 1;
    if (walkKeys.has('KeyD') || walkKeys.has('ArrowRight')) dir += 1;
    if (Math.abs(joy.x) > 0.15) dir = joy.x;
    if (dir !== 0) act = true;
    const troll = !!b && sm.gear === 'lure' && trollOk(C.mySeat(), sm.item, b.v);
    const ev = sm.tick(dt, { reel: reelHeld, jerk: jerkQ, dir, troll });
    if (jerkQ && sm.lure && gfx) C.splash(lurePos().x, lurePos().z, sm.item === 'popper' ? 0.3 : 0.12);
    jerkQ = false;
    if (ev === 'sink') { C.sfx('warn'); C.splash(castX, castZ, 0.2); }
    else if (ev === 'missed') void doReel();
    else if (ev === 'back') { void C.net()?.fish('FishReel', sm.sid); sm.reset(); }
    else if (ev === 'landed' || ev === 'snap' || ev === 'unhook') void endFight(ev);
    // 路亞咬了：直接中魚
    if (sm.phase === 'sink' && sm.gear === 'lure' && sm.pressReel()) void doReel();
    // 浮標被船拖太遠：收線
    if (sm.phase === 'wait' && sm.gear === 'float' && b) { const o = origin(); if (Math.hypot(castX - o.x, castZ - o.z) > FISH.dragR) { void C.net()?.fish('FishReel', sm.sid); sm.reset(); toast('船漂太遠，浮標收回來了', '#9fe0ff', 1.4); } }
    // 每 2 秒問伺服器有沒有魚咬
    if (sm.phase === 'wait') {
      rollAcc += dt;
      if (rollAcc >= FISH.rollS && !rollBusy) { rollAcc = 0; void roll(); }
    } else rollAcc = 0;
  }
  syncUi(mode, b);
}
async function roll() {
  const n = C?.net(); if (!n) return;
  rollBusy = true;
  const lureOk = !!sm.lure?.follow;
  const a = act; act = false;
  const sid = sm.sid;
  const r = await n.fish('FishRoll', sid, a, lureOk).finally(() => { rollBusy = false; }); dbgLast.FishRoll = r;
  if (!C || sm.sid !== sid || sm.phase !== 'wait') return;
  if (!r?.ok) {
    if (r?.err === 'moving') { sm.reset(); toast('開船了，自動收線', '#9fe0ff', 1.4); }
    else if (r?.err === 'late') { useItem(sm.item); sm.reset(); toast('餌被吃掉了', '#ffb08a', 1.4); }
    else if (r?.err === 'no_cast' || r?.err === 'fighting') sm.reset();
    return;
  }
  if (r.bite) sm.bite(num(r.sinkMs));
}

function lurePos() {
  const b = C?.myBoat();
  if (sm.lure && b && sm.gear === 'lure' && trollOk(C!.mySeat(), sm.item, b.v)) return { x: b.x + Math.sin(b.h) * 12, z: b.z + Math.cos(b.h) * 12 };
  const d = sm.lure?.dist ?? castDst;
  return { x: ox - Math.sin(castH) * d, z: oz - Math.cos(castH) * d };
}
function drawGfx(dt: number) {
  if (!gfx || !C) return;
  const ph = sm.phase;
  gfx.g.visible = sm.phase !== 'off';
  if (!gfx.g.visible) return;
  // 線從竿尖出去（竿子模型由 fishPostPose 擺好）
  const rig = C.me();
  if (myRod && rig) rodTipWorld(myRod, _tip);
  else { const o = origin(); _tip.set(o.x, PB.waterY + 2.4, o.z); }
  const fx = -Math.sin(castH), fz = -Math.cos(castH);
  const p = gfx.pos;
  p[0] = p[3] = _tip.x; p[1] = p[4] = _tip.y; p[2] = p[5] = _tip.z;
  // 線的另一頭
  const wy = PB.waterY + 0.04;
  let lineOn = true, bobOn = false, shTarget = 0;
  if (ph === 'fly') {
    const k = 1 - Math.max(0, sm.flyT) / FISH.flyS;
    _end.set(_tip.x + (castX - _tip.x) * k, _tip.y + (wy - _tip.y) * k + Math.sin(k * Math.PI) * 2.2, _tip.z + (castZ - _tip.z) * k);
    bobOn = true;
  } else if (ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook') {
    if (sm.gear === 'float' || !sm.lure) {
      const dip = ph === 'sink' || (ph === 'hook' && sm.twitch >= 1) ? -0.16 : -sm.twitch * 0.06;
      _end.set(castX, wy + Math.sin(t * 2.2) * 0.02 + dip, castZ);
      bobOn = ph !== 'sink';
      if (ph === 'nibble' || ph === 'sink') shTarget = 0.35;
      gfx.shadow.position.set(castX + 0.3, wy - 0.01, castZ + 0.2);
    } else {
      const lp = lurePos(); const d = sm.lure.depth;
      _end.set(lp.x, wy - d * 0.5, lp.z);
      bobOn = d < 0.25;
      if (sm.lure.follow) shTarget = 0.38;
      // 魚影跟在假魚後面一點
      const bx = lp.x - ox, bz = lp.z - oz, bl = Math.hypot(bx, bz) || 1;
      gfx.shadow.position.set(lp.x + bx / bl * 1.1, wy - 0.01, lp.z + bz / bl * 1.1);
      gfx.shadow.rotation.z = Math.atan2(bx, bz);
    }
  } else if ((ph === 'fight' || ph === 'land') && sm.fight) {
    const f = sm.fight;
    const d = 1.5 + castDst * (1 - f.prog);
    const side = f.run * 2.2 * Math.min(1, f.t);
    const sx = Math.cos(castH), sz = -Math.sin(castH);
    const x = ox + fx * d + sx * side + Math.sin(t * 5) * 0.2, z = oz + fz * d + sz * side + Math.cos(t * 4) * 0.2;
    _end.set(x, wy, z);
    shTarget = 0.55;
    gfx.shadow.position.set(x, wy - 0.01, z);
    gfx.shadow.rotation.z = Math.atan2(sx * f.run, sz * f.run) || 0;
    splashT -= dt;
    if (splashT <= 0) { splashT = 0.45 + Math.random() * 0.3; C.splash(x, z, 0.15 + 0.25 * f.power); }
  } else if (catchMesh && catchT > 0) {
    // 剛釣上來：魚掛在竿尖下面晃（約 1.8 秒）
    catchT -= dt;
    _end.set(_tip.x, _tip.y - 0.25, _tip.z);
    const L = catchMesh.scale.x;
    catchMesh.position.set(_end.x + Math.sin(t * 3.1) * 0.04, _end.y - L * 0.5, _end.z);
    catchMesh.rotation.set(0, t * 1.6, Math.PI / 2 + Math.sin(t * 7) * 0.12);
    if (catchT <= 0) { catchMesh.removeFromParent(); catchMesh = null; }
  } else lineOn = false;
  if (lineOn) { p[6] = _tip.x; p[7] = _tip.y; p[8] = _tip.z; p[9] = _end.x; p[10] = _end.y; p[11] = _end.z; }
  else { p[6] = p[9] = _tip.x; p[7] = p[10] = _tip.y; p[8] = p[11] = _tip.z; }
  (gfx.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  gfx.bob.visible = bobOn && lineOn;
  if (gfx.bob.visible) {
    gfx.bob.position.copy(_end);
    const lure = sm.gear === 'lure';
    gfx.bobMat.color.setHex(lure ? 0xd8e0e8 : 0xe8432e);
    gfx.bob.scale.setScalar(lure ? 0.75 : 1);
  }
  shadowA += (shTarget - shadowA) * Math.min(1, dt * 3);
  gfx.shMat.opacity = shadowA;
  gfx.shadow.visible = shadowA > 0.02;
}

// ---------------- 人物動作＋釣竿（在人物擺好姿勢之後才呼叫） ----------------
let catchMesh: THREE.Mesh | null = null, catchT = 0;
function showCatch(f: HoldFish) {
  if (!gfx) return;
  const geo = fishGeometry(f.sp); if (!geo) return;
  catchMesh?.removeFromParent();
  catchMesh = new THREE.Mesh(geo, fishMaterial());
  // 魚長：約 0.45 m × kg^(1/3)（1 kg≈45 cm、100 kg≈2 m），手上看得到就好
  catchMesh.scale.setScalar(Math.max(0.22, Math.min(2.2, 0.45 * Math.cbrt(Math.max(0.05, f.kg)))));
  gfx.g.add(catchMesh); catchT = 1.8;
}
function dropRod() {
  if (!myRod) return;
  myRod.dispose(); myRod = null;
  const rig = C?.me();
  if (rig) { rig.torso.rotation.set(0, 0, 0); rig.head.rotation.x = 0; }
}
function phaseOf(): FishPhase {
  const ph = sm.phase;
  return ph === 'off' ? 'off' : ph === 'idle' ? 'hold' : ph === 'charge' ? 'charge' : ph === 'cast' || ph === 'fly' ? 'cast' : ph === 'fight' || ph === 'land' ? 'fight' : 'wait';
}
function fillPoseIn() {
  poseIn.phase = phaseOf();
  poseIn.power = sm.power;
  poseIn.lure = sm.gear === 'lure';
  poseIn.reel = reelHeld && (poseIn.phase === 'fight' || (poseIn.lure && poseIn.phase === 'wait'));
  poseIn.tension = sm.fight?.ten ?? 0;
  poseIn.twitch = sm.phase === 'nibble' ? Math.max(0.4, sm.twitch) : sm.phase === 'sink' ? 1 : 0;
  return poseIn;
}
/** 線上同步的姿勢代碼（0＝沒在釣） */
export function fishPoseNow() { return sm.phase === 'off' ? 0 : fishPoseCode(fillPoseIn().phase, poseIn.reel, poseIn.lure); }
/**
 * 人物該面向哪（世界 yaw）：線在水裡／拉魚＝拋出去的方向；蓄力＝鏡頭方向；其他＝null（自由）
 */
let faceTest: number | null = null;
export function fishFaceYaw(): number | null {
  const ph = sm.phase;
  if (ph === 'off') return null;
  if (faceTest != null) return faceTest;
  if (sm.lineOut || ph === 'fight' || ph === 'land' || ph === 'cast' || ph === 'fly') return castH;
  if (ph === 'charge' && camRef) { camRef.getWorldDirection(_dir); return yawOf(_dir.x, _dir.z); }
  return null;
}
/** 能不能在船上走動：拿著竿等魚的時候可以；蓄力、甩竿、拉魚時站定 */
export function fishCanWalk() { const ph = sm.phase; return ph === 'idle' || ph === 'wait' || ph === 'nibble'; }
/**
 * 每幀在人物擺完姿勢之後呼叫（main.ts camTick 之後）：套釣魚動作、釣竿、再畫線（線要從竿尖出去）。
 */
export function fishPostPose(dt: number) {
  if (!C) return;
  const rig = C.me();
  if (sm.phase !== 'off' && rig) {
    if (!myRod || myRod.kind !== sm.gear) { myRod?.dispose(); myRod = makeRod(sm.gear); }
    fillPoseIn();
    stepFishPose(myPose, poseIn, dt);
    // 岸上：線在水裡就面向線（鏡頭可以轉去看別的地方）
    if (C.mode() === 'walk') { const fy = fishFaceYaw(); if (fy != null) rig.outer.rotation.y = fy; }
    applyFishPose(rig, myPose, myRod, poseIn);
  } else if (myRod) dropRod();
  drawGfx(dt);
}
/** 除錯：釣竿／姿勢 */
function poseDbg() {
  const rig = C?.me();
  const tip = myRod && rig ? rodTipWorld(myRod, new THREE.Vector3()) : null;
  const hand = rig ? rig.lowerR.localToWorld(new THREE.Vector3(0, -((rig.lowerR.userData.restLen as number) || 0.24), 0)) : null;
  return { rod: myRod?.kind ?? null, phase: poseIn.phase, pitch: +myPose.pitch.toFixed(2), bend: +myPose.bend.toFixed(2), crank: +myPose.crank.toFixed(2), lean: +myPose.lean.toFixed(2), tip: tip && { x: +tip.x.toFixed(2), y: +tip.y.toFixed(2), z: +tip.z.toFixed(2) }, hand: hand && { x: +hand.x.toFixed(2), y: +hand.y.toFixed(2), z: +hand.z.toFixed(2) }, line: gfx ? Array.from(gfx.pos.slice(6, 12), v => +v.toFixed(2)) : null, catch: catchT > 0 };
}

function syncUi(mode: 'walk' | 'boat' | 'swim', b: FishBoat | null) {
  if (!ui || !C) return;
  const on = sm.phase !== 'off';
  const net = !C.localOnly() && !oldServer;
  // 進入按鈕：有竿、在能釣的地方、沒在釣
  const canEnter = !on && net && anyRod() && canFishHere() && (mode === 'boat' || C.canAct());
  ui.entry.classList.toggle('on', canEnter);
  // 賣魚：有魚、在碼頭邊
  let atDock = false;
  if (b) { const q = pierNearest(b.x, b.z); atDock = Math.hypot(q.x - b.x, q.z - b.z) <= 6; }
  else if (mode === 'walk') { const p = C.walkPos(); atDock = (p.x <= -23 && Math.abs(p.z) <= 11) || (p.x <= -23 && p.x >= PB.pierX1 - 0.3 && Math.abs(p.z) <= 2); }
  const showSell = net && holdN > 0 && atDock && !sm.lineOut && sm.phase !== 'fight';
  ui.sell.classList.toggle('on', showSell);
  if (showSell) { const s = `賣魚（${holdN} 條）`; const l = ui.sell.querySelector('.lbl')!; if (l.textContent !== s) l.textContent = s; }
  // 釣魚模式 UI 放在右下（船上那一欄的位置）
  if (showSell && on && ui.sell.parentElement !== ui.bar) ui.bar.append(ui.sell);
  else if (!on && ui.sell.parentElement === ui.bar) (document.getElementById('boatRackBar') ?? ui.bar).append(ui.sell);
  ui.bar.classList.toggle('on', on);
  ui.hud.classList.toggle('on', on);
  if (!on) { ui.meter.classList.remove('on'); return; }
  const ph = sm.phase, lure = sm.gear === 'lure';
  ui.cast.classList.toggle('on', ph === 'idle' || ph === 'charge' || ph === 'cast');
  ui.cast.classList.toggle('dis', ph === 'cast');
  const reelOn = ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'fight' || ph === 'hook' || ph === 'fly';
  ui.reel.classList.toggle('on', reelOn);
  ui.reel.classList.toggle('dis', ph === 'hook' || ph === 'fly');
  ui.reel.classList.toggle('hot', ph === 'sink');
  const rl = ph === 'fight' || lure ? '收線' : ph === 'sink' ? '收竿！' : '收竿';
  const rlEl = ui.reel.querySelector('.lbl')!; if (rlEl.textContent !== rl) rlEl.textContent = rl;
  ui.jerk.classList.toggle('on', lure && ph === 'wait' && !(b && trollOk(C.mySeat(), sm.item, b.v)));
  // HUD
  const cnt = countOf(sm.item);
  const main = `${FISH.rods[sm.gear].n}・${ITEM_NAME[sm.item]}${lure ? '' : sm.item === 'oyster' ? `（今天剩 ${cnt}）` : ` ×${cnt}`}｜魚獲 ${holdN}／${FISH.holdMax}`;
  if (ui.hudTx.textContent !== main) ui.hudTx.textContent = main;
  const troll = !!b && lure && trollOk(C.mySeat(), sm.item, b.v);
  const tip = ph === 'idle' ? (C.mySeat() === 0 && b && Math.abs(b.v) > FISH.driverMaxV ? '先停船才能拋竿' : '按住「拋竿」蓄力，放開拋出去')
    : ph === 'charge' ? '放開就拋出去' : ph === 'cast' || ph === 'fly' ? '' 
    : ph === 'wait' ? (troll ? '拖釣中：船慢慢開，假魚跟在後面' : lure ? (sm.lure?.follow ? '有魚跟上來了，節奏保持住' : LURE_TIP[sm.item as LureKey]) : '等魚咬…')
    : ph === 'nibble' ? '有魚在試吃，還不要收' : ph === 'sink' ? '浮標沉下去了！快收竿' : ph === 'hook' ? '' 
    : ph === 'fight' ? (lure && sm.fight && sm.fight.run !== 0 ? `魚往${sm.fight.run < 0 ? '左' : '右'}衝，搖桿往${sm.fight.run < 0 ? '右' : '左'}拉` : '按住收線，張力別到紅色') : '';
  if (tip !== tipS) { tipS = tip; ui.hudTip.textContent = tip; ui.hudTip.classList.toggle('on', !!tip); }
  // 力道條／張力條
  const meterOn = ph === 'charge' || ph === 'fight';
  ui.meter.classList.toggle('on', meterOn);
  if (meterOn) {
    const v = ph === 'charge' ? sm.power : sm.fight?.ten ?? 0;
    ui.fill.style.transform = `scaleX(${v.toFixed(3)})`;
    ui.meter.classList.toggle('charge', ph === 'charge');
    ui.meter.classList.toggle('red', ph === 'fight' && v >= FISH.redT);
    const lbl = ph === 'charge' ? `力道 ${Math.round(castDist(sm.power, sm.item))} m` : `張力・拉近 ${Math.round((sm.fight?.prog ?? 0) * 100)}%`;
    if (ui.mLbl.textContent !== lbl) ui.mLbl.textContent = lbl;
    const run = ph === 'fight' && lure ? sm.fight?.run ?? 0 : 0;
    ui.dirL.classList.toggle('on', run > 0); ui.dirR.classList.toggle('on', run < 0);
  }
}

// ---------------- 除錯 ----------------
export const fishDbg = {
  state() { return { phase: sm.phase, gear: sm.gear, item: sm.item, sid: sm.sid, power: +sm.power.toFixed(2), lure: sm.lure ? { dist: +sm.lure.dist.toFixed(1), depth: +sm.lure.depth.toFixed(2), follow: sm.lure.follow } : null, fight: sm.fight ? { ten: +sm.fight.ten.toFixed(2), prog: +sm.fight.prog.toFixed(2), run: sm.fight.run } : null, ok, oldServer, holdN, holdVal, sellLeft, dex: Object.fromEntries(dex), rod, pick: { ...pick }, hooked }; },
  enter() { enterFish(); return sm.phase; },
  exit() { exitFish(); return sm.phase; },
  /** 拋竿（power 0～1；h 不給＝鏡頭方向） */
  cast(power = 0.6, h?: number) {
    if (sm.phase === 'off') enterFish();
    if (!sm.startCharge()) return 'not idle: ' + sm.phase;
    sm.power = power;
    const cam = camRef; if (h != null) { camRef = null; castH = h; }
    releaseCast(); camRef = cam;
    return sm.phase;
  },
  reel() { pressReel(); return sm.phase; },
  hold(on = true) { reelHeld = on; return sm.phase; },
  jerk() { jerkQ = true; return 'ok'; },
  async sell() { await sellFish(); return dbgLast.FishSell; },
  last() { return dbgLast; },
  pose() { return poseDbg(); },
  /** 測試：固定人物面向（截側面圖用；null＝還原） */
  face(h: number | null = null) { faceTest = h; return h; },
  /** 測試：按住拋竿蓄力到 power（不放開） */
  charge(power = 0.7) { if (sm.phase === 'off') enterFish(); if (sm.phase === 'idle') pressCast(); sm.power = power; return sm.phase; },
  /** 測試：放開拋竿（h＝方向；不給就用鏡頭方向） */
  release(h?: number) { const cam = camRef; if (h != null) { camRef = null; castH = h; } releaseCast(); camRef = cam; return sm.phase; },
  /** 測試：假裝釣上一條魚（只看掛在竿上的樣子） */
  fakeCatch(sp = 'kurodai', kg = 1.2) { showCatch({ sp, name: sp, tier: 0, kg, val: 0 }); return catchT; },
  panel(tab: 'gear' | 'dex' = 'gear') { openPanel(tab); return 'ok'; },
  close() { closePanel(); return 'ok'; },
  pick(r: Gear, item?: ItemKey) { rod = r; if (item) pick[r] = item; sm.gear = rod; sm.item = pick[rod]; return { rod, item: sm.item }; },
  fetch() { void fetchState(); return 'ok'; },
  /** 測試：站到岸上某一點（碼頭尾端約 x＝-39, z＝0） */
  tp(x: number, z: number) { const p = C?.walkPos() as { x: number; z: number } | undefined; if (!p || C?.mode() !== 'walk') return 'not walking'; p.x = x; p.z = z; return 'ok'; },
  ui() { return ui ? { entry: ui.entry.classList.contains('on'), sell: ui.sell.classList.contains('on'), bar: ui.bar.classList.contains('on'), cast: ui.cast.classList.contains('on'), reel: ui.reel.classList.contains('on') ? ui.reel.textContent : null, jerk: ui.jerk.classList.contains('on'), hud: ui.hud.classList.contains('on') ? ui.hud.textContent : null, meter: ui.meter.classList.contains('on') ? ui.mLbl.textContent : null, panel: panelOn } : null; },
  /** 測試：假裝中魚（不經伺服器，只看拉扯畫面） */
  fakeFight(power = 0.6, ms = 10000, lure = true) { sm.phase = 'hook'; sm.gear = lure ? 'lure' : 'float'; sm.hooked(power, ms); document.body.classList.add('fishFight'); return sm.phase; },
};
export type { BaitKey, LureKey };
