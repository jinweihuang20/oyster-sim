/**
 * 廣場海面釣魚（客戶端）：釣魚模式的按鈕（拋竿／收線／抽竿）、力道條、張力條、換餌面板、圖鑑、釣線浮標魚影、賣魚。
 * 判定在伺服器（PlazaWorld.Fish.cs）：能不能拋、每 2 秒擲咬餌、收竿時間窗、魚種重量、拉扯最短時間、魚獲、賣魚（沒有每日上限）。
 * 釣竿／餌／假魚在本機存檔（跟蚵棚組合包一樣）；伺服器說用掉才扣。
 * 手機省電：只有在釣魚時才畫 3 個東西（1 條線段組＋浮標＋魚影），每幀不 new 物件，DOM 只在字變了才改。
 */
import * as THREE from 'three';
import { toast, toastTop } from '../../ui/dom';
import { rewardToast } from '../../ui/rewardToast';
import { walkKeys, joy } from '../../world/walkSeat';
import type { PlayerRig } from '../../dm/character';
import { PB, pierNearest } from './boatLogic';
import { isletSellNear } from '../islet';
import type { BoatNet } from './boatNet';
import { FISH, FishSM, ITEM_NAME, LURE_TIP, isLure, isSquidSp, lureDepthZone, inDepthZone, castPoint, castDist, castRange, castFlyDur, fishDistNow, fmtDistM, fmtFightLbl, fightDistM, hookFightMs, hookPower, yawOf, trollOk, FISH_ERR, fishErr, fishNetErr, canFishAt, newNoRodHint, stepNoRodHint, NO_ROD_HINT, type Gear, type ItemKey, type BaitKey, type LureKey, type NoRodHintSt } from './fishLogic';
import { makeRod, makeFishLineMat, type Rod } from './fishRod';
import { castFlyPoint, castLine, CAST_LINE_SEGS, CAST_RELEASE_S, CAST_SETTLE_S, type CastLineOpt } from './castArc';
import { makeFishMesh, FISH_TIER } from './fishModel';
import { HOIST_S, HOIST_HANG_S, HOIST_TIP_DROP, HOIST_CARD_U, fishLenM, fightCloseK, fightFishDepth, fightFishYaw, newHoist, startHoist, stopHoist, stepHoist, hoistDone, hoistU, hoistMouth, hoistPitch, hoistYaw, fishCenterFromMouth } from './fishHoist';
import { makeFishFx, FX, type FishFx } from './fishFx';
import { mountFishDex, fishDexMerge, type FishDexView } from './fishDex';
import { ITEM_HINT, itemHintHtml } from './fishHints';
import { newFishPose, stepFishPose, applyFishPose, rodTipWorld, fishPoseCode, jerkTn, steerablePhase, type FishPoseIn, type FishPhase } from './fishPose';
import { remoteReelSide, type FishSyncMsg } from './fishSync';
import { ReplayVideoRec, browserVideoDeps, canRecordVideo, fmtMB, loadVideoQuality, saveVideoQuality, VIDEO_QUALITY, type VideoQuality } from './fishReplayRecord';
import { rpPlaceOf, newRpPlace, rpPlaceBoat, newRigStash, rigStage, rigPlace, rigRestore } from './fishReplayStage';
import { RF, RF_STRIDE, RP_PHASE, RFISH, REPLAY_TAIL_S, newReplayRec, recStart, recStop, recReset, recTick, recPush, recSplash, recClip, clipSample, clipSplashes, newReplayPlay, playStep, playSeek, playToggle, playRestart, playSpeed, fmtReplayT, orbitStart, orbitDist, orbitDrag, orbitZoom, orbitPos, rpPhaseCode, type ReplayClip, type ReplayMeta, type ReplayPlay, type Orbit } from './fishReplay';
import { newLineW, lineWStart, lineWDist, lineWYaw, takeSlack, stepLineW, dragLure, newFightW, fightWStart, stepFightW, FW } from './fishWorld';
import { bindReelFeel, makeReelClickSfx, reelPressLabel, steerDirFromPad, type ReelFeel, type ReelSfxOut } from './fishReelFeel';

export type FishBoat = { id: number; x: number; z: number; h: number; v: number; /** 船身高度／傾斜（有就記進回放） */ y?: number; rx?: number; rz?: number };
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
  /** 收線棘輪音接到遊戲 sfx 總線（跟著音量／靜音）；沒給就安靜） */
  sfxBus?: () => ReelSfxOut | null;
  grantMoney?: (n: number, via: string) => void;
  /** 釣具存檔：gear(id) 有幾個、addGear(id, ±n) */
  gear?: (id: string) => number;
  addGear?: (id: string, d: number) => void;
  /** 蚵仔肉：今天還能帶幾塊、用掉一塊 */
  oyster?: () => number;
  useOyster?: () => void;
  /** 精彩回放：藏起現場的其他玩家／船（true）、照原樣還原（false）；重複呼叫沒事 */
  replayStage?: (on: boolean) => void;
  /** 精彩回放用的替身船（第一次才建，之後重複用；平常藏著） */
  replayBoat?: () => THREE.Object3D | null;
};

const ICON = {
  rank: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 20h8"/></svg>',
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
  replay: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M10 9l5 3-5 3z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M10 6l-6 6 6 6"/><path d="M4 12h11a5 5 0 0 1 5 5v1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>',
  recDot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" style="fill:#ff4d4f;stroke:none"/></svg>',
  hd: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9v6M7 12h4M11 9v6"/><path d="M14 9v6h1.5a3 3 0 0 0 0-6z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 19h14"/></svg>',
};
const ERR = FISH_ERR;
const err = fishErr;
const money = (n: number) => `$${Math.round(n).toLocaleString('zh-TW')}`;
const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
/** 除錯：每個伺服器呼叫最後一次的回應 */
const dbgLast: Record<string, unknown> = {};
const g = (o: any, k: string) => o?.[k] ?? o?.[k[0].toUpperCase() + k.slice(1)];
const TIER: readonly string[] = FISH_TIER;
/** 假魚在線頭的顏色／大小（米諾維持原本的銀白） */
const LURE_LOOK: Record<LureKey, { c: number; s: number }> = {
  minnow: { c: 0xd8e0e8, s: 0.75 }, jig: { c: 0xc4ccd6, s: 0.7 }, soft: { c: 0xd88a5a, s: 0.7 }, popper: { c: 0xf0e0a0, s: 0.8 },
  stickbait: { c: 0xeef4fa, s: 0.9 }, trollskirt: { c: 0xe24a8a, s: 0.95 }, slowjig: { c: 0xf0c040, s: 0.85 }, egi: { c: 0xf07a2a, s: 0.85 },
  vib: { c: 0x8fb4dc, s: 0.75 }, tairubber: { c: 0xe0502a, s: 0.75 }, deepcrank: { c: 0xc8dc3a, s: 0.8 }, squidjig: { c: 0xff8ab8, s: 0.8 },
};

type HoldFish = { sp: string; name: string; tier: number; kg: number; val: number };
const normFish = (o: any): HoldFish | null => o ? { sp: String(g(o, 'sp') ?? ''), name: String(g(o, 'name') ?? ''), tier: num(g(o, 'tier')), kg: num(g(o, 'kg')), val: num(g(o, 'val')) } : null;

let C: FishCtx | null = null;
const sm = new FishSM();
let rod: Gear = 'float';
let pick: Record<Gear, ItemKey> = { float: 'oyster', lure: 'minnow' };
let ok = false, oldServer = false, busy = false, fetchT = 0, fetchTries = 0;
/** 伺服器那邊可能還掛著上一竿（收魚／收竿的回應在斷線時丟了）：下次拋竿前先放棄它 */
let staleLine = false;
let hold: HoldFish[] = [], holdN = 0, holdVal = 0;
let dexView: FishDexView | null = null;
let dex = new Map<string, { kg: number; n: number }>();
/** jerkN＝這次登入抽竿幾下（人物抽竿動作、送給別人看） */
let jerkN = 0;
/** 拉魚／收線時搖桿左右（給人物動作）；runS＝魚往左右衝（平滑，線在水裡的那頭跟著偏）；reelS＝收線左右帶竿（平滑，假魚跟著輕輕偏） */
let steerIn = 0, runS = 0, reelS = 0;
/** 中魚那一刻魚離人幾公尺（拉扯距離從這裡開始算） */
let fightD0 = 8;
/** 拉扯中魚現在多遠（線、同步都用這個；線最多畫到 44 m，跟伺服器同步上限一樣） */
const fightM = () => (sm.fight ? (fw.on ? lineWDist(fw, ancX, ancZ) : fightDistM(sm.fight.prog, fightD0)) : 0);
/** 浮標／假魚現在離人多遠（真實水平距離；CR-31） */
const lineNow = () => { if (lw.on) return lineWDist(lw, ancX, ancZ); const o = origin(); return sm.lure ? sm.lure.dist : Math.hypot(castX - o.x, castZ - o.z); };
/**
 * CR-31 真實世界釣線：lw＝浮標／假魚在水裡的世界座標（線長：浮標 lw.len、假魚 sm.lure.dist）；fw＝上鉤的魚的世界座標。
 * 錨點 (ancX, ancZ)＝現在人在哪（船在開就跟著船），每幀 tickFish 更新；收線往「現在」的竿子拉。
 */
const lw = newLineW(), fw = newFightW();
let ancX = 0, ancZ = 0, wakeT = 0;
const _anc = new THREE.Vector3();
function anchorNow() {
  const rig = C?.me();
  if (rig) { rig.outer.getWorldPosition(_anc); ancX = _anc.x; ancZ = _anc.z; }
  else if (C) { const o = origin(); ancX = o.x; ancZ = o.z; }
}
/** 線頭那邊（浮標／假魚／魚）在人的哪個方向（世界 h）；還沒落水＝拋竿方向 */
function aimH() {
  const ph = sm.phase;
  if ((ph === 'fight' || ph === 'land') && fw.on) return lineWYaw(fw, ancX, ancZ, castH);
  if ((ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook') && lw.on) return lineWYaw(lw, ancX, ancZ, castH);
  return castH;
}
let reelHeld = false, jerkQ = false, act = false, castH = 0, castX = 0, castZ = 0, castDst = 8, ox = 0, oz = 0;
let reelFeel: ReelFeel | null = null;
let reelSfx = makeReelClickSfx(() => { try { return C?.sfxBus?.() ?? null; } catch { return null; } });
let hooked: HoldFish | null = null;
let t = 0, splashT = 0, shadowA = 0, tipS = '', panelTab: 'gear' | 'dex' = 'gear', panelOn = false;
let noRodHint: NoRodHintSt = newNoRodHint();
let ui: {
  entry: HTMLButtonElement; sell: HTMLButtonElement; bar: HTMLDivElement; cast: HTMLButtonElement; reel: HTMLButtonElement; jerk: HTMLButtonElement;
  hud: HTMLDivElement; acts: HTMLDivElement; hudTx: HTMLSpanElement; hudDist: HTMLSpanElement; hudTip: HTMLSpanElement; depth: HTMLDivElement; depthZone: HTMLDivElement; depthDot: HTMLDivElement; meter: HTMLDivElement; fill: HTMLDivElement; mLbl: HTMLSpanElement; dirL: HTMLElement; dirR: HTMLElement; panel: HTMLDivElement;
} | null = null;
// 3D：一組線段（竿＋線）、浮標／假魚、魚影
// 3D：釣竿模型（掛在人物身上）＋釣線（一條線段）、浮標／假魚、魚影
let myRod: Rod | null = null;
const myPose = newFishPose();
const poseIn: FishPoseIn = { phase: 'off', power: 0, reel: false, tension: 0, lure: false, twitch: 0, jerk: 0 };
let ffx: FishFx | null = null, bubbleT = 0, inkT = 0, fightX = 0, fightZ = 0;
let gfx: { g: THREE.Group; line: THREE.Line; pos: Float32Array; bob: THREE.Mesh; bobMat: THREE.MeshBasicMaterial; shadow: THREE.Mesh; shMat: THREE.MeshBasicMaterial } | null = null;
const _tip = new THREE.Vector3(), _end = new THREE.Vector3(), _dir = new THREE.Vector3();
const _lineTip0 = new THREE.Vector3(1e9, 0, 0), _lineEnd0 = new THREE.Vector3(1e9, 0, 0);
let lineWasOn = false;
/** 拋竿弧線：放手點、落點、鬆線計時（落水後線慢慢鬆成懸垂）、放開拋竿的時間 */
const _rel = new THREE.Vector3(), _land = new THREE.Vector3();
const lineOpt: CastLineOpt = { k: 1, settle: 1, sag: 0, wy: 0 };
let settleT = CAST_SETTLE_S, flying = false, relT = 0;

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
  C = ctx; ok = false; oldServer = false; busy = false; fetchT = 2; fetchTries = 0; staleLine = false; hold = []; holdN = holdVal = 0; sm.exit(); hooked = null; panelOn = false; noRodHint = newNoRodHint();
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
  hud.innerHTML = `<div id="fishDepth" aria-label="水深" aria-hidden="true"><span class="fdLo">淺</span><div class="fdTrack"><div class="fdRail"><div class="fdZone"></div><div class="fdDot"></div></div></div><span class="fdHi">深</span></div><span class="fhDist" aria-label="距離"></span><div class="fhTx"><span class="fhMain"></span><span class="fhTip"></span></div>`;
  const acts = document.createElement('div'); acts.id = 'fishActs';
  acts.innerHTML = `<button type="button" class="fhB" data-f="gear" aria-label="換竿換餌">${ICON.gear}<span>換餌</span></button><button type="button" class="fhB" data-f="dex" aria-label="魚類圖鑑">${ICON.book}<span>圖鑑</span></button><button type="button" class="fhB fhRp" data-f="replay" aria-label="精彩回放">${ICON.replay}<span>回放</span></button><button type="button" class="fhB fhX" data-f="exit" aria-label="不釣了">${ICON.exit}<span>不釣了</span></button>`;
  const meter = document.createElement('div'); meter.id = 'fishMeter';
  meter.innerHTML = `<i class="fmDir l">${ICON.left}</i><div class="fmBar"><div class="fmRed"></div><div class="fmFill"></div></div><i class="fmDir r">${ICON.right}</i><span class="fmLbl"></span>`;
  const panel = document.createElement('div'); panel.id = 'fishPanel';
  const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  const tap = (b: HTMLElement, f: () => void) => b.addEventListener('pointerdown', e => { stop(e); act = true; f(); });
  tap(entry, () => toggleFish());
  tap(sell, () => void sellFish());
  tap(jerk, () => { jerkQ = true; });
  cast.addEventListener('pointerdown', e => { stop(e); act = true; pressCast(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    cast.addEventListener(ev, () => releaseCast());
  }
  reelFeel?.dispose();
  reelFeel = bindReelFeel(reel, {
    onDown: () => { act = true; pressReel(); },
    onUp: () => { reelHeld = false; },
    haptic: () => { try { navigator.vibrate?.(12); } catch { /* 不支援 */ } },
    sfx: reelSfx,
    shouldSpin: () => sm.phase === 'fight' || (sm.phase === 'wait' && sm.gear === 'lure'),
    getTension: () => sm.phase === 'fight' ? (sm.fight?.ten ?? 0) : -1,
  });
  for (const b of [entry, sell, jerk, reel, cast]) b.addEventListener('click', stop);
  // iOS 長按會跳出原生放大鏡選字泡泡：這三顆是按住操作（用 pointerdown／pointerup，不是 click），擋掉 touchstart 預設行為不會影響收線
  for (const b of [jerk, reel, cast]) {
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  }
  acts.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-f]'); if (!b) return;
    e.preventDefault(); act = true;
    const f = b.dataset.f;
    if (f === 'exit') exitFish(); else if (f === 'replay') askReplay(); else openPanel(f === 'dex' ? 'dex' : 'gear');
  });
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  // 把「釣魚」「賣魚」放進船上那一欄（跟拉蚵串同一排）；沒有那一欄就放自己的
  const rackBar = root.querySelector('#boatRackBar');
  (rackBar ?? root).append(entry, sell);
  root.append(bar, hud, meter, panel);
  mountCatchCard();
  (document.getElementById('plazaRoot') ?? root).append(acts);
  ui = { entry, sell, bar, cast, reel, jerk, hud, acts, hudTx: hud.querySelector('.fhMain')!, hudDist: hud.querySelector('.fhDist')!, hudTip: hud.querySelector('.fhTip')!, depth: hud.querySelector('#fishDepth')!, depthZone: hud.querySelector('.fdZone')!, depthDot: hud.querySelector('.fdDot')!, meter, fill: meter.querySelector('.fmFill')!, mLbl: meter.querySelector('.fmLbl')!, dirL: meter.querySelector('.fmDir.l')!, dirR: meter.querySelector('.fmDir.r')!, panel };
  addEventListener('keyup', onKeyUp);
  addEventListener('pointerdown', onAnyInput, { passive: true });
  buildGfx(ctx.scene);
}
export function closeFish() {
  stopReplay(); hideCatchCard(); cardEl?.remove(); cardEl = null;
  recReset(rec); recEndT = -1; wantReplay = false;
  if (cardTimer) { clearTimeout(cardTimer); cardTimer = 0; }
  reelFeel?.dispose(); reelFeel = null; reelSfx.stop();
  if (ui) { ui.entry.remove(); ui.sell.remove(); ui.bar.remove(); ui.hud.remove(); ui.acts.remove(); ui.meter.remove(); ui.panel.remove(); ui = null; }
  removeEventListener('keyup', onKeyUp);
  removeEventListener('pointerdown', onAnyInput);
  document.body.classList.remove('plazaFishing', 'fishPanelOpen', 'fishFight');
  clearFishToastTop();
  ffx?.dispose(); ffx = null;
  if (gfx) { gfx.g.removeFromParent(); gfx.line.geometry.dispose(); (gfx.line.material as THREE.Material).dispose(); gfx.bob.geometry.dispose(); gfx.bobMat.dispose(); gfx.shadow.geometry.dispose(); gfx.shMat.dispose(); gfx = null; }
  dexView?.stop(); dexView = null;
  dropRod(); catchT = 0; dropFishMesh();
  sm.exit(); C = null; reelHeld = false;
}
function onAnyInput() { act = true; }
function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') { releaseCast(); if (reelFeel) reelFeel.keyUp(); else reelHeld = false; }
}

function buildGfx(parent: THREE.Object3D) {
  const g = new THREE.Group(); g.name = 'plazaFish'; g.visible = false;
  // 一條多段曲線（竿尖→線頭），每幀直接改同一塊 buffer
  const pos = new Float32Array((CAST_LINE_SEGS + 1) * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.Line(geo, makeFishLineMat());
  line.frustumCulled = false;
  const bobMat = new THREE.MeshBasicMaterial({ color: 0xe8432e });
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), bobMat);
  const shMat = new THREE.MeshBasicMaterial({ color: 0x0a1a28, transparent: true, opacity: 0, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), shMat);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.55, 1.4, 1);
  g.add(line, bob, shadow); parent.add(g);
  ffx = makeFishFx(parent);
  gfx = { g, line, pos, bob, bobMat, shadow, shMat };
}

// ---------------- 伺服器 ----------------
async function fetchState() {
  const n = C?.net(); if (!n || C?.localOnly()) return;
  const r = await n.fish('FishState'); dbgLast.FishState = r;
  // 只有真的沒有這個方法才算舊伺服器；斷線中的 fail／offline 下次再問
  if (r?.err === 'old_server') { oldServer = true; return; }
  if (!r?.ok) return;
  const s = r.state;
  ok = true;
  hold = ((g(s, 'hold') ?? []) as any[]).map(normFish).filter((f): f is HoldFish => !!f);
  holdN = hold.length; holdVal = num(g(s, 'holdVal'));
  dex = new Map(((g(s, 'dex') ?? []) as any[]).map(o => [String(g(o, 'sp') ?? ''), { kg: num(g(o, 'kg')), n: num(g(o, 'n')) }]));
  const ch = fishDexMerge([...dex].map(([sp, d]) => ({ sp, kg: d.kg, n: d.n })));
  if (panelOn && (panelTab !== 'dex' || ch)) renderPanel();
}
export function onFishBig(e: { connId: string; nick: string; name: string; kg: number; tier?: number }) {
  if (!C) return;
  const giant = num(e.tier) >= 3;
  rewardToast(`${e.nick || '有人'} 釣到${giant ? '巨物' : '傳說魚'}：${e.name}`, `${e.kg.toFixed(1)} kg`, 'feed', `fishbig:${e.connId}:${e.kg}`, giant ? 6 : undefined);
}

// ---------------- 進出釣魚模式 ----------------
/** 現在站的地方能不能釣（客戶端提示，伺服器會再判一次） */
function canFishHere(): boolean {
  if (!C) return false;
  const m = C.mode();
  return canFishAt(m, m === 'walk' ? C.walkPos() : undefined, !!C.myBoat());
}
function toggleFish() { if (sm.phase === 'off') enterFish(); else exitFish(); }
function enterFish() {
  if (!C || sm.phase !== 'off') return;
  if (!anyRod()) { toast(NO_ROD_HINT, '#ffb08a', 2); return; }
  if (oldServer) { toast(ERR.old_server, '#ffb08a', 2); return; }
  if (!canFishHere()) { toast(ERR.not_at_water, '#ffb08a', 1.6); return; }
  fixPick();
  sm.gear = rod; sm.item = pick[rod];
  sm.enter();
  document.body.classList.add('plazaFishing');
  if (ui) { ui.hud.classList.add('on'); ui.acts.classList.add('on'); syncFishToastTop(); }
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
  stopReplay(); hideCatchCard();
  if (rec.on) { if (recEndT > 0) finishRec(); else recReset(rec); }
  sm.exit(); sm.sid = 0; reelHeld = false; reelFeel?.release(); hooked = null;
  catchT = 0; dropFishMesh();
  closePanel();
  document.body.classList.remove('plazaFishing', 'fishFight');
  if (why) toast(why, '#9fe0ff', 1.6);
}
/** 釣魚中要吃掉搖桿：岸上一直擋（不然走掉）；船上只有拉扯時擋（駕駛開船＝自動收線） */
export function fishHoldsInput() { return sm.phase !== 'off' && (!!rp || C?.mode() === 'walk' || sm.phase === 'fight' || sm.phase === 'land'); }
export const fishActive = () => sm.phase !== 'off';

// ---------------- 動作 ----------------
function pressCast() {
  if (sm.phase === 'off' || rp) return;
  if (sm.phase === 'idle') {
    fixPick(); sm.gear = rod; sm.item = pick[rod];
    if (!owns(rod)) { toast(`還沒有${FISH.rods[rod].n}`, '#ffb08a'); return; }
    if (countOf(sm.item) < 1) { toast(sm.item === 'oyster' ? '今天的蚵仔肉用完了，換別的餌' : `${ITEM_NAME[sm.item]}用完了，到雜貨店補`, '#ffb08a', 1.8); openPanel('gear'); return; }
    if (holdN >= FISH.holdMax) { toast(ERR.hold_full, '#ffd76a', 1.8); return; }
    const b = C?.myBoat();
    if (C?.mySeat() === 0 && b && Math.abs(b.v) > FISH.driverMaxV) { toast(ERR.moving, '#ffb08a', 1.4); return; }
    // 又要拋了：上一條魚的回放收尾（卡片收掉，回放按鈕還在）
    if (rec.on && recEndT > 0) finishRec();
    hideCatchCard();
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
  relT = t;
  C.sfx('launch');
  void castOnServer(n, p).then(r => {
    dbgLast.FishCast = r;
    if (!C) return;
    if (!r?.ok) { sm.castFail(); if (r?.err === 'old_server') oldServer = true; const m = err(r?.err, '拋不出去'); if (m && r?.err !== 'slow') toast(m, '#ffb08a', 1.6); return; }
    castX = num(r.x, castX); castZ = num(r.z, castZ); castDst = num(r.dist, castDst);
    // 竿子甩到放手點才讓線頭飛出去（伺服器回得快就等一下），落水＝拋物線碰到水面那一幀（drawGfx）
    sm.castOk(num(r.sid), castDst, castFlyDur(castDst), CAST_RELEASE_S - (t - relT));
    // 落點＝真的世界座標；線長＝拋出去的距離（之後船開遠就沿線拖、收線往現在的竿子拉）
    if (sm.phase === 'fly') { anchorNow(); lineWStart(lw, castX, castZ, ancX, ancZ, castDst); if (sm.lure) sm.lure.dist = lw.len; } else lw.on = false;
    fw.on = false;
  });
}
/** 放棄伺服器那邊掛著的上一竿（斷線時丟掉的那條魚）；成功才清旗標 */
async function abandonStale(n: NonNullable<ReturnType<FishCtx['net']>>) {
  const r = await n.fish('FishAbandon'); dbgLast.FishAbandon = r;
  if (r?.ok || r?.err === 'old_server') staleLine = false;
  return r;
}
/** 拋竿：先清掉斷線留下的上一竿；伺服器還說「拉扯中」（自己這邊早就不在拉了）就放棄它再拋一次 */
async function castOnServer(n: NonNullable<ReturnType<FishCtx['net']>>, p: number) {
  if (staleLine) await abandonStale(n);
  let r = await n.fish('FishCast', sm.gear, sm.item, p, castH);
  if (r?.err === 'fighting' && C && sm.phase === 'cast') {
    const a = await abandonStale(n);
    if (a?.ok && C && sm.phase === 'cast') r = await n.fish('FishCast', sm.gear, sm.item, p, castH);
  }
  return r;
}
/** 重新連上廣場（自動重連／手動重連／換新連線）：重新問狀態、不要沿用斷線時的「舊伺服器」判斷 */
export function fishRejoined() {
  oldServer = false; ok = false; fetchTries = 0; fetchT = 0.3;
  if (!C) return;
  const n = C.net();
  // 斷線期間收魚失敗、或伺服器說拉扯中的那一竿：先放棄掉，之後才拋得出去
  if (n && staleLine && sm.phase !== 'fight' && sm.phase !== 'land' && sm.phase !== 'hook') void abandonStale(n);
}
function pressReel() {
  if (!C || rp) return;
  if (sm.phase === 'fight' || (sm.phase === 'wait' && sm.gear === 'lure')) { reelHeld = true; return; }
  if (sm.gear === 'float' && sm.pressReel()) void doReel();
}
async function doReel() {
  const n = C?.net(); if (!n || !C) return;
  const r = await n.fish('FishReel', sm.sid); dbgLast.FishReel = r;
  if (!C || sm.phase !== 'hook') return;
  if (!r?.ok) { sm.reset(); if (fishNetErr(r?.err)) staleLine = true; if (r?.err && err(r.err, '')) toast(err(r.err, ''), '#ffb08a'); return; }
  const kind = String(r.kind ?? '');
  if (r.baitUsed) useItem(sm.item);
  if (kind === 'hooked') {
    hooked = normFish(r.fish);
    // 中魚時伺服器就回了魚種：真的魚模型直接放進線頭的水裡（遠的時候沉在水下，拉近才浮上來翻騰）
    if (hooked) ensureFishMesh(hooked.sp, hooked.kg);
    try { navigator.vibrate?.(70); } catch { /* 不支援 */ }
    C.sfx('hit');
    anchorNow();
    fightD0 = Math.max(1.5, lineNow());
    // 魚從線頭那個世界座標開始拉（太近就往外推到 1.5 m）
    { const r0 = lw.on ? lineWDist(lw, ancX, ancZ) : 0; const h0 = aimH(); const k = r0 > 1e-3 ? fightD0 / r0 : 0;
      const x0 = r0 > 1e-3 ? ancX + (lw.x - ancX) * k : ancX - Math.sin(h0) * fightD0, z0 = r0 > 1e-3 ? ancZ + (lw.z - ancZ) * k : ancZ - Math.cos(h0) * fightD0;
      fightWStart(fw, x0, z0, ancX, ancZ, fightD0); runS = 0; }
    // 拉多久＝實際中魚距離 ÷ 收線速度（伺服器回 mps；舊伺服器沒有就照公斤數算，不比它的最短時間快）
    const mps = num(g(r, 'mps'), 0);
    const power = hookPower(hooked?.kg ?? 1, hooked?.tier ?? 0, num(r.power, 0.3), mps > 0 ? mps : undefined);
    sm.hooked(power, hookFightMs(fightD0, hooked?.kg ?? 1, hooked?.tier ?? 0, mps > 0 ? mps : undefined, num(r.fightMs, 2500), power), fightD0);
    // 精彩回放：從中魚開始錄（只留最後 10 秒）；上一條的片段留著，釣上來才換掉
    recStart(rec); recEndT = -1; wantReplay = false;
    document.body.classList.add('fishFight');
    // 頭足類一上鉤就噴墨（位置在 drawGfx 拉扯那段算）
    inkT = hooked && isSquidSp(hooked.sp) ? 0 : 1e9;
    toastTop(hooked && hooked.tier >= 3 ? '中魚！力道大得不得了……是巨物！穩住張力慢慢拉' : hooked && hooked.tier >= 2 ? '中魚！好重……是大傢伙！' : '中魚！按住「收線」，張力別到紅色' + (sm.fight?.lure ? '；魚往哪邊衝，搖桿就往反方向拉' : ''), 2.4);
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
  // 沒釣上來（線斷、脫鉤、斷線）：水裡那條魚濺一下就不見（拉上來的才接著吊出水面）
  if (!(r?.ok && r.landed && !r.lureLost)) { escapeFish(); recReset(rec); recEndT = -1; }
  if (!r?.ok) {
    // 斷線：伺服器那邊還在「拉扯中」，不清掉之後會一直拋不出去
    if (fishNetErr(r?.err)) { staleLine = true; toast('連線中斷，這條魚跑掉了', '#ffb08a', 1.8); return; }
    toast(err(r?.err, '魚跑掉了'), '#ffb08a', 1.6); return;
  }
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
  // 魚從最後線頭那個水面點破水、沿線被吊到竿尖（不是直接出現在竿尖）
  showCatch(fish, fightX, fightZ);
  // 回放再錄到魚吊上來、掛在竿尖晃一下（約 2 秒）才收尾
  recMeta = { sp: fish.sp, name: fish.name, kg: fish.kg, tier: fish.tier, player: '' };
  recEndT = t + REPLAY_TAIL_S;
  const d = dex.get(fish.sp);
  dex.set(fish.sp, { kg: Math.max(d?.kg ?? 0, fish.kg), n: (d?.n ?? 0) + 1 });
  fishDexMerge([{ sp: fish.sp, ...dex.get(fish.sp)! }]);
  const tag = r.first ? '・新魚種' : r.record ? '・最大紀錄' : '';
  if (isSquidSp(fish.sp)) ffx?.inkPuff(fightX, PB.waterY + 0.05, fightZ, 1.2);
  const giant = fish.tier >= 3;
  const full = holdN >= FISH.holdMax;
  // 先讓人看到魚破水被吊起來（約 0.45 秒），再響起收魚聲、讓上方「回放」鈕亮起來
  if (cardTimer) clearTimeout(cardTimer);
  cardTimer = setTimeout(() => {
    cardTimer = 0;
    C?.sfx('dock');
    if (giant) toastTop(`釣到巨物：${fish.name}！`, 3);
    rewardToast(`釣到${TIER[fish.tier] === '普通' ? '' : TIER[fish.tier] ?? ''} ${fish.name}${tag}`, `${fish.kg.toFixed(fish.kg < 10 ? 2 : 1)} kg・約 ${money(fish.val)}`, 'mine', `fish:${Date.now()}`, giant ? 6 : undefined);
    if (full) toast('魚獲滿了！回碼頭賣魚', '#ffd76a', 2);
    showCatchCard(fish);
  }, Math.round(HOIST_S * HOIST_CARD_U * 1000));
}
async function sellFish() {
  const n = C?.net(); if (!n || busy || !C) return;
  busy = true;
  const r = await n.fish('FishSell').finally(() => { busy = false; }); dbgLast.FishSell = r;
  if (!r?.ok) { if (r?.err !== 'slow') toast(err(r?.err, '賣不掉'), '#ffb08a'); return; }
  const pay = num(r.pay);
  C.grantMoney?.(pay, 'fish-sell');
  holdN = num(r.left);
  hold = holdN === 0 ? [] : hold.slice(-holdN);
  holdVal = holdN === 0 ? 0 : hold.reduce((s, f) => s + f.val, 0);
  C.sfx('launch');
  rewardToast(`賣魚 ${num(r.n)} 條・${num(r.kg).toFixed(1)} kg`, `+${money(pay)}`, 'mine', `fish-sell:${Date.now()}`);
  void fetchState();
}

// ---------------- 換餌／圖鑑面板 ----------------
function openPanel(tab: 'gear' | 'dex') { panelTab = tab; panelOn = true; renderPanel(); ui?.panel.classList.add('on'); document.body.classList.add('fishPanelOpen'); if (tab === 'dex') void fetchState(); }
function closePanel() { dexView?.stop(); dexView = null; panelOn = false; ui?.panel.classList.remove('on'); document.body.classList.remove('fishPanelOpen'); }
function renderPanel() {
  if (!ui) return;
  const tabs = `<div class="fpTabs"><button type="button" data-tab="gear" class="${panelTab === 'gear' ? 'on' : ''}">釣具</button><button type="button" data-tab="dex" class="${panelTab === 'dex' ? 'on' : ''}">魚類圖鑑</button><button type="button" class="fpLb" aria-label="釣魚排行榜">${ICON.rank}<span>排行榜</span></button><button type="button" class="fpX" aria-label="關閉">${ICON.exit}</button></div>`;
  let body = '';
  if (panelTab === 'gear') {
    const rodRow = (['float', 'lure'] as Gear[]).map(gr => `<button type="button" data-rod="${gr}" class="fpPick ${rod === gr ? 'on' : ''}" ${owns(gr) ? '' : 'disabled'}><b>${FISH.rods[gr].n}</b><small>${owns(gr) ? (gr === 'float' ? '掛餌等魚咬' : '操控假魚') : '雜貨店有賣'}</small></button>`).join('');
    const items: { k: ItemKey; n: string }[] = rod === 'float' ? FISH.baits.map(b => ({ k: b.k, n: b.n })) : FISH.lures.map(l => ({ k: l.k, n: l.n }));
    const itemRow = items.map(it => { const c = countOf(it.k); return `<button type="button" data-item="${it.k}" class="fpPick ${pick[rod] === it.k ? 'on' : ''}" ${c > 0 ? '' : 'disabled'}><b>${it.n}</b><small class="fpTag">${ITEM_HINT[it.k].tag}</small><small>${it.k === 'oyster' ? `今天剩 ${c} 塊` : `剩 ${c}`}</small></button>`; }).join('');
    const cr = castRange(pick[rod]);
    const tip = itemHintHtml(pick[rod], 'fhHint fpHint') + (rod === 'lure' ? `<p class="fpTip">${LURE_TIP[pick.lure as LureKey]}</p>` : '<p class="fpTip">浮標小小抖動是魚在試吃，等整個沉下去再收竿</p>') + `<p class="fpTip">拋竿距離 ${cr.min}～${cr.max} m${rod === 'lure' ? '（越重的假魚拋越遠）' : ''}</p>`;
    body = `<h4>釣竿</h4><div class="fpRow">${rodRow}</div><h4>${rod === 'float' ? '餌' : '假魚'}</h4><div class="fpRow">${itemRow}</div>${tip}<p class="fpFoot">魚獲 ${holdN}／${FISH.holdMax}・約 ${money(holdVal)}（到碼頭全部賣得掉）</p>`;
  }
  dexView?.stop(false); dexView = null;
  ui.panel.innerHTML = tabs + `<div class="fpBody">${body}</div>`;
  if (panelTab === 'dex') { const host = ui.panel.querySelector<HTMLElement>('.fpBody')!; host.classList.add('fdxHost'); dexView = mountFishDex(host); }
  ui.panel.querySelector('.fpX')?.addEventListener('pointerdown', e => { e.preventDefault(); closePanel(); });
  ui.panel.querySelector('.fpLb')?.addEventListener('pointerdown', e => { e.preventDefault(); closePanel(); void import('../../meta/social').then(m => m.openFishBoard()); });
  ui.panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); panelTab = b.dataset.tab as 'gear' | 'dex'; renderPanel(); }));
  ui.panel.querySelectorAll<HTMLButtonElement>('[data-rod]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.disabled || sm.lineOut || sm.phase === 'fight') return; rod = b.dataset.rod as Gear; fixPick(); sm.gear = rod; sm.item = pick[rod]; renderPanel(); }));
  ui.panel.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.disabled || sm.lineOut || sm.phase === 'fight') return; pick[rod] = b.dataset.item as ItemKey; sm.item = pick[rod]; renderPanel(); }));
}

// ---------------- 鍵盤 ----------------
/** 回 true＝吃掉這個鍵（G＝釣魚／不釣；空白鍵＝拋竿（按住蓄力）／收線；J＝抽竿；Esc＝關面板） */
export function fishKey(code: string): boolean {
  if (!C) return false;
  // 回放中：Esc＝返回、空白鍵＝播放／暫停；其他釣魚鍵都吃掉（不會拋竿、不會收竿）
  if (rp) {
    if (code === 'Escape') { stopReplay(); return true; }
    if (code === 'Space') { rpToggle(); return true; }
    return code === 'KeyG' || code === 'KeyJ' || code === 'KeyR' || code === 'KeyF' || code === 'KeyX';
  }
  if (code === 'KeyG') { if (sm.phase !== 'off' || (anyRod() && canFishHere() && (C.mode() !== 'walk' || C.canAct()))) { act = true; toggleFish(); return true; } return false; }
  if (sm.phase === 'off') return false;
  act = true;
  if (code === 'Escape') { if (panelOn) closePanel(); else exitFish(); return true; }
  if (code === 'Space') { if (sm.phase === 'idle') pressCast(); else if (reelFeel) reelFeel.keyDown(); else pressReel(); return true; }
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
  if (rec.on && recEndT > 0 && t >= recEndT) finishRec();
  if (cardOn && t >= cardHideT) hideCatchCard();
  if (rpFreshT && t >= rpFreshT) clearReplayFresh();
  // 第一次進場：拿魚獲／圖鑑（舊伺服器就算了）
  if (!ok && !oldServer && fetchTries < 6) { fetchT -= dt; if (fetchT <= 0) { fetchT = 10; fetchTries++; void fetchState(); } }
  const mode = C.mode(); const b = C.myBoat();
  // 沒釣竿走進可釣魚區：上方提示一次「雜貨店 → 釣具」，待在區內不重覆
  if (stepNoRodHint(noRodHint, canFishHere(), anyRod(), t)) toastTop(NO_ROD_HINT, 4);
  if (sm.phase !== 'off') {
    // 離開能釣的地方（下船、跳水、走開）：收竿
    if (!canFishHere()) exitFish(mode === 'swim' ? '掉進海裡，釣竿收起來了' : '');
    // 駕駛開船：自動收線
    else if (C.mySeat() === 0 && b && Math.abs(b.v) > FISH.driverMaxV && sm.lineOut) { void C.net()?.fish('FishReel', sm.sid); sm.reset(); toast('開船了，自動收線', '#9fe0ff', 1.4); }
  }
  if (sm.phase !== 'off') {
    const dir = steerDirFromPad(c => walkKeys.has(c), joy.x);
    if (dir !== 0) act = true;
    steerIn = dir;
    const troll = !!b && sm.gear === 'lure' && trollOk(C.mySeat(), sm.item, b.v);
    // 抽竿（路亞等待／捲線中才算）：人物甩一下竿
    if (jerkQ && sm.lure && sm.phase === 'wait') jerkN++;
    // CR-31：收線／抽竿前先把鬆掉的線捲起來（假魚往現在的竿子拉，不是拋竿的位置）
    anchorNow();
    const lureW = sm.phase === 'wait' && !!sm.lure && lw.on;
    if (lureW && (reelHeld || jerkQ) && !troll) sm.lure!.dist = takeSlack(sm.lure!.dist, lw, ancX, ancZ);
    const len0 = sm.lure?.dist ?? 0;
    const ev = sm.tick(dt, { reel: reelHeld, jerk: jerkQ, dir, troll, drag: lureW ? lw.drag : 0 });
    stepWorld(dt, len0, troll);
    if (jerkQ && sm.lure && gfx) C.splash(lw.on ? lw.x : castX, lw.on ? lw.z : castZ, sm.item === 'popper' ? 0.3 : 0.12);
    jerkQ = false;
    reelFeel?.tick();
    if (ev === 'sink') { C.sfx('warn'); C.splash(lw.on ? lw.x : castX, lw.on ? lw.z : castZ, 0.2); }
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
    else if (r?.err === 'no_cast' || r?.err === 'fighting') { if (r.err === 'fighting') staleLine = true; sm.reset(); }
    return;
  }
  if (r.bite) sm.bite(num(r.sinkMs));
}

/**
 * CR-31 每幀真實世界釣線（tickFish 的 sm.tick 之後）：
 * 等魚／咬餌＝浮標／假魚夾在線長內（線鬆留原地、船開遠沿線拖、收線往現在的竿子拉；船拖快了深的假魚被抬高一點）；
 * 拉魚＝魚在世界座標裡衝，船開走拉出線＋張力、船開過去線鬆距離變短；線鬆時魚到竿子邊就算拉上來。
 */
function stepWorld(dt: number, len0: number, troll: boolean) {
  const ph = sm.phase;
  if ((ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook') && lw.on) {
    const s = sm.lure;
    if (s) {
      const v = stepLineW(lw, s.dist, ancX, ancZ, dt, Math.max(0, len0 - s.dist));
      if (ph === 'wait' && isLure(sm.item)) dragLure(s, sm.item, v, dt, troll);
    } else stepLineW(lw, lw.len, ancX, ancZ, dt);
    // 被船拖著走：後面冒一串小水花
    if (lw.drag > FW.wakeV && ffx) { wakeT -= dt; if (wakeT <= 0) { wakeT = FX.bubbleGap * 1.6; ffx.bubble(lw.x, PB.waterY + 0.04, lw.z); } }
  } else if (ph === 'fight' && sm.fight && fw.on) {
    const f = sm.fight;
    runS += (f.run - runS) * (1 - Math.exp(-dt * 2.5));
    if (stepFightW(fw, f, ancX, ancZ, runS * 2.2 * Math.min(1, f.t), dt) === 'landed') { sm.phase = 'land'; void endFight('landed'); }
  }
}
function drawGfx(dt: number) {
  ffx?.tick(dt);
  if (!gfx || !C) return;
  const ph = sm.phase;
  const fightOn = (ph === 'fight' || ph === 'land') && !!sm.fight;
  if (!fightOn) runS = 0;
  // 魚模型只活在：拉扯中（水裡）、剛釣上來吊起／掛著（idle／蓄力）；其他時候（又拋出去、收竿）收掉
  if (fishMesh && !fightOn && !(catchT > 0 && (ph === 'idle' || ph === 'charge'))) { dropFishMesh(); catchT = 0; }
  if (phaseOf() !== 'wait') reelS = 0;
  gfx.g.visible = sm.phase !== 'off';
  if (!gfx.g.visible) return;
  // 線從竿尖出去（竿子模型由 fishPostPose 擺好）
  const rig = C.me();
  if (myRod && rig) rodTipWorld(myRod, _tip);
  else { const o = origin(); _tip.set(o.x, PB.waterY + 2.4, o.z); }
  const fx = -Math.sin(castH), fz = -Math.cos(castH);
  const p = gfx.pos;
  // 線的另一頭
  const wy = PB.waterY + 0.04;
  let lineOn = true, bobOn = false, shTarget = 0;
  lineOpt.wy = wy; lineOpt.k = 1;
  if (lw.on && ph !== 'fly') _land.set(lw.x, wy, lw.z); else _land.set(castX, wy, castZ);
  if (ph === 'fly') {
    // 竿子還沒甩到放手點：線頭貼在竿尖（放手點跟著竿尖走）；之後沿拋物線飛到落點
    const span = Math.max(0.05, sm.flyDur - sm.flyDelay);
    const k = Math.max(0, Math.min(1, (sm.flyDur - Math.max(0, sm.flyT) - sm.flyDelay) / span));
    if (k <= 0 || !flying) _rel.copy(_tip);
    flying = true; settleT = 0;
    lineOpt.k = k;
    castFlyPoint(_rel.x, _rel.y, _rel.z, castX, wy, castZ, k, _end);
    bobOn = true;
  } else if (ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook') {
    if (sm.gear === 'float' || !sm.lure) {
      const dip = ph === 'sink' || (ph === 'hook' && sm.twitch >= 1) ? -0.16 : -sm.twitch * 0.06;
      _end.set(lw.on ? lw.x : castX, wy + Math.sin(t * 2.2) * 0.02 + dip, lw.on ? lw.z : castZ);
      bobOn = ph !== 'sink';
      if (ph === 'nibble' || ph === 'sink') shTarget = 0.35;
      gfx.shadow.position.set(_end.x + 0.3, wy - 0.01, _end.z + 0.2);
    } else {
      const d = sm.lure.depth;
      let lpx = lw.on ? lw.x : castX, lpz = lw.on ? lw.z : castZ;
      const ah = aimH();
      // 收線時左右帶竿：假魚跟著竿子輕輕往那邊偏（跟別人畫面同一個量，比拉魚小很多）
      const rTg = reelHeld && phaseOf() === 'wait' ? steerIn : 0;
      reelS += (rTg - reelS) * (1 - Math.exp(-dt * 2.5));
      if (rTg === 0 && Math.abs(reelS) < 0.002) reelS = 0;
      const rs = remoteReelSide(reelS, true, sm.lure.dist);
      lpx += Math.cos(ah) * rs; lpz -= Math.sin(ah) * rs;
      _end.set(lpx, wy - d * 0.5, lpz);
      bobOn = d < 0.25;
      if (sm.lure.follow) shTarget = 0.38;
      // 船拖裙尾假餌：拖釣或快收時，假魚後面拉出一條氣泡
      if (sm.item === 'trollskirt' && ffx) {
        const b = C.myBoat();
        if ((b && trollOk(C.mySeat(), sm.item, b.v)) || sm.lure.spd >= 1.6) { bubbleT -= dt; if (bubbleT <= 0) { bubbleT = FX.bubbleGap; ffx.bubble(lpx, wy, lpz); } }
      }
      // 魚影跟在假魚後面一點
      const bx = lpx - ancX, bz = lpz - ancZ, bl = Math.hypot(bx, bz) || 1;
      gfx.shadow.position.set(lpx + bx / bl * 1.1, wy - 0.01, lpz + bz / bl * 1.1);
      gfx.shadow.rotation.z = Math.atan2(bx, bz);
    }
  } else if ((ph === 'fight' || ph === 'land') && sm.fight) {
    const f = sm.fight;
    // CR-31：魚在真的世界座標（tickFish 的 stepWorld 算好：往左右衝、船開走被拖、收線往現在的竿子拉）；這裡只加一點晃動
    if (!fw.on) fightWStart(fw, ancX + fx * fightD0, ancZ + fz * fightD0, ancX, ancZ, fightD0);
    const rr = lineWDist(fw, ancX, ancZ) || 1e-3;
    const d = Math.min(44, Math.max(1.5, rr));
    const ux = (fw.x - ancX) / rr, uz = (fw.z - ancZ) / rr;
    const sx = -uz, sz = ux;
    const x = fw.x + Math.sin(t * 5) * 0.2, z = fw.z + Math.cos(t * 4) * 0.2;
    _end.set(x, wy, z);
    fightX = x; fightZ = z;
    // 大軟絲／花枝：拉扯時每隔一下噴墨
    if (hooked && isSquidSp(hooked.sp) && ffx) { inkT -= dt; if (inkT <= 0) { inkT = 1.4 + Math.random() * 0.6; ffx.inkPuff(x, wy + 0.01, z, 0.8); } }
    shTarget = 0.55;
    if (fishMesh) {
      // 真的魚在線頭的水裡：遠＝沉在水下、近＝浮上來翻騰，最後幾公尺一下一下破水；魚頭朝人、往衝的那邊甩
      const dep = fightFishDepth(d, f.ten, t);
      const yaw = fightFishYaw(-ux, -uz, runS, t, f.power);
      const pitch = dep < 0.02 ? Math.min(0.5, 0.08 + (0.02 - dep) * 2.6) : 0.06;
      _mouth.x = x; _mouth.y = PB.waterY - dep; _mouth.z = z;
      fishCenterFromMouth(_mouth, yaw, pitch, fishLen, _ctr);
      fishMesh.position.set(_ctr.x, _ctr.y, _ctr.z);
      fishMesh.rotation.set(0, yaw, pitch);
      fishMesh.visible = true;
      fishYaw = yaw;
      // 線頭接在魚嘴（沉在水下時線頭留在水面）
      _end.y = Math.max(wy - 0.02, _mouth.y);
      // 破水那一下：濺水花
      if (dep < 0 && fishDep >= 0) spl(x, z, 0.2 + 0.3 * f.power);
      fishDep = dep;
      shTarget = 0.55 * (1 - 0.7 * fightCloseK(d));
    }
    gfx.shadow.position.set(x, wy - 0.01, z);
    gfx.shadow.rotation.z = Math.atan2(sx * f.run, sz * f.run) || 0;
    splashT -= dt;
    // 拉魚週期水花降頻（約 1s）：減 GPU 寫入／發熱，視覺仍有濺水
    if (splashT <= 0) { splashT = 0.95 + Math.random() * 0.35; spl(x, z, 0.12 + 0.2 * f.power); }
  } else if (fishMesh && catchT > 0) {
    catchT -= dt;
    if (hoist.on) {
      // 剛釣上來：魚從水面破水、沿弧線被吊到竿尖下（約 0.6 秒），邊吊邊甩尾，線一直接在竿尖→魚嘴
      const u = stepHoist(hoist, dt);
      hoistMouth(hoist.wx, hoist.wy, hoist.wz, _tip.x, _tip.y, _tip.z, u, _mouth);
      const yaw = hoistYaw(hoist.yaw, u, t), pitch = hoistPitch(u, t);
      fishCenterFromMouth(_mouth, yaw, pitch, fishLen, _ctr);
      fishMesh.position.set(_ctr.x, _ctr.y, _ctr.z);
      fishMesh.rotation.set(0, yaw, pitch);
      _end.set(_mouth.x, _mouth.y, _mouth.z);
      // 魚身拖出水面時再滴一圈小水花
      if (!hoistDrip && u >= 0.3) { hoistDrip = true; spl(hoist.wx, hoist.wz, 0.15); }
      if (hoistDone(hoist)) { hangYaw = yaw; hangT = 0; stopHoist(hoist); }
    } else {
      // 吊上來了：掛在竿尖下面晃（約 1.8 秒）
      hangT += dt;
      _end.set(_tip.x, _tip.y - HOIST_TIP_DROP, _tip.z);
      fishMesh.position.set(_end.x + Math.sin(t * 3.1) * 0.04, _end.y - fishLen * 0.5, _end.z);
      fishMesh.rotation.set(0, hangYaw + hangT * 1.6, Math.PI / 2 + Math.sin(t * 7) * 0.12);
    }
    fishMesh.visible = true;
    if (catchT <= 0) { dropFishMesh(); catchT = 0; }
  } else lineOn = false;
  // 拋物線碰到水面：濺水花＋聲音（剛好落在落點那一幀）
  if (flying && ph !== 'fly') {
    flying = false;
    if (sm.lineOut) { C.splash(castX, castZ, 0.25); C.sfx('splash'); } else settleT = CAST_SETTLE_S;
  }
  if (ph !== 'fly' && settleT < CAST_SETTLE_S) settleT += dt;
  if (lineOn) {
    // 靜止時線往下垂多少：浮標鬆、假魚收線時拉直、拉魚越緊越直、掛魚在竿尖＝直的
    const L = Math.hypot(_end.x - _tip.x, _end.z - _tip.z);
    let sag = 0;
    if (ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook') {
      sag = sm.gear === 'float' || !sm.lure ? Math.min(0.8, 0.12 + 0.025 * L) : reelHeld ? Math.min(0.25, 0.04 + 0.006 * L) : Math.min(0.55, 0.08 + 0.015 * L);
      if (ph === 'sink' || ph === 'hook') sag *= 0.4;
    } else if ((ph === 'fight' || ph === 'land') && sm.fight) sag = Math.min(0.4, (0.03 + 0.008 * L) * (1 - Math.min(1, sm.fight.ten)));
    lineOpt.sag = sag;
    lineOpt.settle = ph === 'fly' ? 0 : ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook' ? settleT / CAST_SETTLE_S : 1;
    castLine(p, CAST_LINE_SEGS, _tip, _rel, _land, _end, lineOpt);
  } else { for (let i = 0; i < p.length; i += 3) { p[i] = _tip.x; p[i + 1] = _tip.y; p[i + 2] = _tip.z; } }
  // 釣線位移很小時跳過 GPU 上傳（靜置等咬時很常見）
  if (lineOn !== lineWasOn || _tip.distanceToSquared(_lineTip0) > 1e-4 || _end.distanceToSquared(_lineEnd0) > 1e-4) {
    (gfx.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    _lineTip0.copy(_tip); _lineEnd0.copy(_end); lineWasOn = lineOn;
  }
  gfx.bob.visible = bobOn && lineOn;
  if (gfx.bob.visible) {
    gfx.bob.position.copy(_end);
    const lure = sm.gear === 'lure';
    const look = lure && isLure(sm.item) ? LURE_LOOK[sm.item] : null;
    gfx.bobMat.color.setHex(look ? look.c : 0xe8432e);
    gfx.bob.scale.setScalar(look ? look.s : 1);
  }
  shadowA += (shTarget - shadowA) * Math.min(1, dt * 3);
  gfx.shMat.opacity = shadowA;
  gfx.shadow.visible = shadowA > 0.02;
  // 精彩回放：中魚→吊上來這段每秒記 ~25 格（只有數字，不配置）
  if (rec.on && lineOn && recTick(rec, dt)) recPush(rec, recFill);
}

// ---------------- 精彩回放（最後 10 秒，自由視角） ----------------
/** 錄影緩衝（預先配置 ~49 KB，重複用）；clip＝上一條釣上來的魚的片段（下一條會換掉） */
const rec = newReplayRec();
let clip: ReplayClip | null = null, recMeta: ReplayMeta | null = null, recEndT = -1, wantReplay = false, rpBtnOn = false;
/** 濺水花（同時記進回放） */
function spl(x: number, z: number, k: number) { C?.splash(x, z, k); recSplash(rec, k, x, z); }
const _wq = new THREE.Vector3();
/** 這一格要記的數字：都是現成的狀態，不配置 */
function recFill(b: Float32Array, o: number) {
  const rig = C?.me(), bt = C?.myBoat();
  if (rig) {
    rig.outer.updateWorldMatrix(true, false);
    const m = rig.outer.matrixWorld.elements;
    b[o + RF.px] = m[12]; b[o + RF.py] = m[13]; b[o + RF.pz] = m[14]; b[o + RF.pyaw] = Math.atan2(m[8], m[10]);
  } else { const q = origin(); b[o + RF.px] = q.x; b[o + RF.py] = 0; b[o + RF.pz] = q.z; b[o + RF.pyaw] = castH; }
  // 船：每一格的真實位置／船頭／浪晃（中魚時船在開，回放替身船照這條路線走）
  b[o + RF.boat] = bt ? 1 : 0; b[o + RF.bx] = bt?.x ?? 0; b[o + RF.bz] = bt?.z ?? 0; b[o + RF.bh] = bt?.h ?? 0;
  b[o + RF.by] = bt?.y ?? PB.waterY; b[o + RF.brx] = bt?.rx ?? 0; b[o + RF.brz] = bt?.rz ?? 0;
  b[o + RF.rx] = _tip.x; b[o + RF.ry] = _tip.y; b[o + RF.rz] = _tip.z;
  const P = myPose;
  b[o + RF.pitch] = P.pitch; b[o + RF.side] = P.side; b[o + RF.hx] = P.hx; b[o + RF.hy] = P.hy; b[o + RF.hz] = P.hz; b[o + RF.lean] = P.lean;
  b[o + RF.bend] = P.bend; b[o + RF.crank] = P.crank; b[o + RF.brace] = P.brace; b[o + RF.steer] = P.steer; b[o + RF.steerK] = P.steerK;
  b[o + RF.phase] = rpPhaseCode(poseIn.phase); b[o + RF.reel] = poseIn.reel ? 1 : 0; b[o + RF.lure] = poseIn.lure ? 1 : 0;
  const fm = fishMesh;
  if (fm) {
    b[o + RF.fx] = fm.position.x; b[o + RF.fy] = fm.position.y; b[o + RF.fz] = fm.position.z;
    b[o + RF.fyaw] = fm.rotation.y; b[o + RF.fpitch] = fm.rotation.z; b[o + RF.froll] = fm.rotation.x;
    b[o + RF.fvis] = fm.visible ? 1 : 0;
    b[o + RF.fst] = sm.fight && (sm.phase === 'fight' || sm.phase === 'land') ? RFISH.water : hoist.on ? RFISH.hoist : catchT > 0 ? RFISH.hang : RFISH.none;
  } else { b[o + RF.fvis] = 0; b[o + RF.fst] = RFISH.none; b[o + RF.fx] = _end.x; b[o + RF.fy] = _end.y; b[o + RF.fz] = _end.z; }
  b[o + RF.tail] = t;
  b[o + RF.lx] = _end.x; b[o + RF.ly] = _end.y; b[o + RF.lz] = _end.z;
  b[o + RF.ten] = sm.fight?.ten ?? 0; b[o + RF.sag] = lineOpt.sag;
  b[o + RF.shadow] = shadowA;
}
/** 收尾：拷貝成片段（換掉上一條的） */
function finishRec() {
  if (recMeta) { const c = recClip(rec, recMeta); if (c) clip = c; }
  recStop(rec); recEndT = -1; recMeta = null;
  if (wantReplay) { wantReplay = false; startReplay(); }
}

// 釣到魚後不再跳出白底回放卡；改點亮上方「回放」鈕，仍可開同一套回放畫面
let cardEl: HTMLDivElement | null = null, cardOn = false, cardHideT = 0, rpFreshT = 0;
function mountCatchCard() {
  cardEl?.remove();
  const el = document.createElement('div'); el.id = 'fishCatchCard';
  el.innerHTML = `<div class="fccTx"><b class="fccName"></b><small class="fccSub"></small></div><button type="button" class="fccRp" data-c="replay" aria-label="精彩回放">${ICON.replay}<span>精彩回放</span></button><button type="button" class="fccX" data-c="close" aria-label="關閉">${ICON.exit}</button>`;
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]'); if (!b) return;
    e.preventDefault(); act = true;
    if (b.dataset.c === 'replay') askReplay(); else hideCatchCard();
  });
  el.addEventListener('click', e => e.stopPropagation());
  document.body.append(el);
  cardEl = el;
}
function showCatchCard(_f: HoldFish) {
  // 不再跳出白底「精彩回放」卡；改讓上方「回放」鈕亮起來提醒
  hideCatchCard();
  markReplayFresh();
}
function hideCatchCard() { cardOn = false; cardEl?.classList.remove('on'); }
function rpBtn() { return ui?.acts.querySelector('.fhRp') ?? null; }
function markReplayFresh() {
  const b = rpBtn(); if (!b) return;
  b.classList.add('fresh');
  rpFreshT = t + 4;
}
function clearReplayFresh() {
  rpFreshT = 0;
  rpBtn()?.classList.remove('fresh');
}
function setRpBusy(on: boolean) {
  const s = cardEl?.querySelector('.fccRp span'); if (s) s.textContent = on ? '準備回放…' : '精彩回放';
  cardEl?.classList.toggle('busy', on);
}
/** 按「精彩回放」：還在錄收尾（魚剛吊起來）就等錄完自動開始 */
function askReplay() {
  if (rp || !C) return;
  if (rec.on && recEndT > 0) { wantReplay = true; setRpBusy(true); return; }
  startReplay();
}

type Rp = {
  c: ReplayClip; play: ReplayPlay; orbit: Orbit; fr: Float32Array;
  focus: THREE.Vector3; snap: boolean; sep: number; fish: THREE.Mesh | null; el: HTMLDivElement;
  fill: HTMLElement; knob: HTMLElement; time: HTMLElement; playB: HTMLElement; spdB: HTMLElement; hint: HTMLElement; recB: HTMLElement; recS: string; vqB: HTMLElement;
  timeS: string; playS: boolean | null; ptr: Map<number, { x: number; y: number }>; pinch: number; scrub: boolean; scrubPlay: boolean; hintT: number;
};
let rp: Rp | null = null;
const rpPose = newFishPose();
const rpIn: FishPoseIn = { phase: 'hold', power: 0, reel: false, tension: 0, lure: false, twitch: 0, jerk: 0, steer: 0 };
const _rpTg = new THREE.Vector3(), _rpCam = { x: 0, y: 0, z: 0 }, _rpP = new THREE.Vector3();
/** 回放能不能繼續：還在釣魚模式（沒在拋／拉）、還連著線上、人還在 */
function replayOk() { return !!C && !!rp && sm.phase === 'idle' && !!C.me() && !!C.net() && !C.localOnly(); }
function startReplay() {
  const c = clip;
  if (!c || !C || rp) return;
  if (sm.phase !== 'idle') { toast('收好竿子才能看回放', '#ffb08a', 1.4); return; }
  if (!C.net() || C.localOnly()) { toast('連線中斷，暫時不能回放', '#ffb08a', 1.6); return; }
  hideCatchCard(); clearReplayFresh(); closePanel();
  // 現場那條掛在竿尖的魚先收掉（回放有自己的一條）
  catchT = 0; dropFishMesh();
  const el = document.createElement('div'); el.id = 'fishReplay';
  const kg = c.meta.kg.toFixed(c.meta.kg < 10 ? 2 : 1);
  el.innerHTML = `<div class="frTop"><span class="frTag">${ICON.replay}<span>精彩回放</span></span><span class="frName"></span><button type="button" class="frB frBack" data-r="exit" aria-label="返回">${ICON.back}<span>返回</span></button></div>`
    + `<div class="frHint">拖曳轉視角・雙指或滾輪縮放</div>`
    + `<div class="frDock"><div class="frSave"><button type="button" class="frB frSaveB" data-r="save" aria-label="儲存或分享影片">${ICON.save}<span></span></button><button type="button" class="frB frSaveX" data-r="savex" aria-label="不要這支影片">${ICON.exit}</button></div>`
    + `<div class="frBar"><div class="frRow frRowT"><div class="frTrack" data-r="track"><div class="frRail"><div class="frFill"></div><div class="frKnob"></div></div></div><span class="frTime"></span></div>`
    + `<div class="frRow frRowP"><button type="button" class="frB frPlay" data-r="play" aria-label="播放／暫停"></button><button type="button" class="frB frRe" data-r="restart" aria-label="重播">${ICON.restart}<span>重播</span></button><button type="button" class="frB frSpd" data-r="speed" aria-label="播放速度">1×</button>`
    + `<button type="button" class="frB frZ frZo" data-r="zout" aria-label="拉遠">${ICON.minus}</button><button type="button" class="frB frZ" data-r="zin" aria-label="拉近">${ICON.plus}</button></div>`
    + `<div class="frRow frRowR"><button type="button" class="frB frVq" data-r="vq" aria-label="錄影畫質"></button><button type="button" class="frB frRec" data-r="rec" aria-label="錄製影片"></button></div></div></div>`;
  el.querySelector('.frName')!.textContent = `${c.meta.name}・${kg} kg`;
  const r: Rp = {
    c, play: newReplayPlay(c.dur), orbit: orbitStart(c.f[RF.pyaw]), fr: new Float32Array(RF_STRIDE),
    focus: new THREE.Vector3(), snap: true, sep: 4, fish: null, el,
    fill: el.querySelector('.frFill')!, knob: el.querySelector('.frKnob')!, time: el.querySelector('.frTime')!, playB: el.querySelector('.frPlay')!, spdB: el.querySelector('.frSpd')!, hint: el.querySelector('.frHint')!, recB: el.querySelector('.frRec')!, recS: '', vqB: el.querySelector('.frVq')!,
    timeS: '', playS: null, ptr: new Map(), pinch: 0, scrub: false, scrubPlay: false, hintT: 3.5,
  };
  rp = r;
  // 回放舞台：現場的其他玩家／船先藏起來；人掛到舞台照當時的世界座標擺（現場的位置、船、同步都不動）
  C.replayStage?.(true);
  bindReplayUi(r);
  document.body.append(el);
  document.body.classList.add('fishReplayOn');
  reelHeld = false; reelFeel?.release();
  const f = makeFishMesh(c.meta.sp);
  if (f && gfx) { f.scale.setScalar(fishLenM(c.meta.kg)); f.visible = false; gfx.g.add(f); r.fish = f; }
  rpUi(r);
}
export function stopReplay() {
  const r = rp; if (!r) return;
  rp = null; wantReplay = false;
  // 錄到一半／錄好沒存：丟掉（停串流、釋放網址，不會跳出下載）
  if (vrec) { vrec.onChange = null; vrec.abort(); vrec = null; }
  r.el.remove();
  document.body.classList.remove('fishReplayOn');
  // 魚模型的幾何／材質是共用快取：拿掉 Mesh 就好（跟現場那條一樣）
  r.fish?.removeFromParent(); r.fish = null;
  r.ptr.clear();
  // 人掛回原本的地方（船上座位／岸上）、替身船藏起來、現場的人和船照原樣顯示
  rigRestore(rpRig, rpStageG);
  rpStageG.removeFromParent();
  if (rpBoatG) rpBoatG.visible = false;
  C?.replayStage?.(false);
  // 回放改過的身體（側傾、弓步）還原；下一幀照常由釣魚姿勢／走路擺
  const rig = C?.me();
  if (rig) {
    rig.torso.rotation.z = 0;
    if (rpPose.braceW) { rpPose.braceW = false; rig.legL.rotation.set(0, 0, 0); rig.legR.rotation.set(0, 0, 0); rig.shinL.rotation.x = 0; rig.shinR.rotation.x = 0; rig.root.position.y = 0; }
  }
  rpPose.rollW = false;
  if (gfx) { gfx.shMat.opacity = 0; gfx.shadow.visible = false; }
}
function rpToggle() { if (rp && !vrecBusy()) { playToggle(rp.play); rpUi(rp); } }
// ---------------- 回放存成影片（純畫面） ----------------
let vrec: ReplayVideoRec | null = null;
const vrecBusy = () => !!vrec && (vrec.st === 'arming' || vrec.st === 'rec' || vrec.st === 'finishing');
/** 錄影畫質（記在 localStorage，下一條魚也一樣） */
let vq: VideoQuality | null = null;
const vqNow = (): VideoQuality => (vq ??= loadVideoQuality((() => { try { return localStorage; } catch { return null; } })()));
function vqToggle() {
  vq = vqNow() === 'high' ? 'standard' : 'high';
  try { saveVideoQuality(localStorage, vq); } catch { /* 不能存就算了 */ }
}
/** 按「錄製影片」：從 0 秒用目前的速度重播、開始錄；錄影中再按＝提早停止 */
function rpRecTap(r: Rp) {
  if (vrec?.st === 'rec') { vrec.stop(); rpUi(r); return; }
  if (vrec?.st === 'finishing') return;
  if (vrec?.st === 'arming') { vrec.abort(); rpUi(r); return; }
  const cv = document.getElementById('c') as HTMLCanvasElement | null;
  if (!cv || !canRecordVideo(globalThis, cv)) { toast('此瀏覽器不支援錄製影片', '#ffb08a', 2); return; }
  if (!vrec) {
    vrec = new ReplayVideoRec(browserVideoDeps(cv));
    vrec.onChange = st => {
      if (rp !== r) return;
      if (st === 'error') toast('錄影失敗，再試一次', '#ffb08a', 1.8);
      // 畫布拉好解析度、真的開始錄了：才從 0 秒播
      if (st === 'rec') playRestart(r.play);
      rpUi(r);
    };
  }
  // 先停在 0 秒（高畫質要等畫布拉好解析度畫完一幀，開始錄才從頭播）
  playSeek(r.play, 0); r.play.playing = false;
  r.scrub = false;
  if (!vrec.start(r.c.meta.sp, r.c.meta.kg, vqNow())) { if (vrec.st !== 'error') toast('此瀏覽器不支援錄製影片', '#ffb08a', 2); rpUi(r); return; }
  r.hintT = 2.5; r.hint.textContent = '錄影中也可以拖曳轉視角、縮放'; r.hint.classList.remove('off');
  rpUi(r);
}
/** 按「儲存／分享」：在這個點擊裡同步叫分享面板或下載（Safari／手機才不會擋） */
function rpSaveTap() {
  if (!vrec || vrec.st !== 'ready') return;
  const how = vrec.save();
  if (how === 'download') toast('影片已下載', '#9fe0ff', 1.6);
}
function bindReplayUi(r: Rp) {
  const el = r.el, track = el.querySelector<HTMLElement>('.frTrack')!;
  const seekX = (x: number) => { const b = track.getBoundingClientRect(); playSeek(r.play, ((x - b.left) / Math.max(1, b.width)) * r.play.dur); rpUi(r); };
  // 儲存／分享用 click（真正的使用者點擊，分享面板和下載才不會被瀏覽器擋）
  el.querySelector('.frSaveB')!.addEventListener('click', e => { e.stopPropagation(); rpSaveTap(); });
  el.querySelector('.frSaveX')!.addEventListener('click', e => { e.stopPropagation(); vrec?.clear(); rpUi(r); });
  el.addEventListener('pointerdown', e => {
    e.stopPropagation(); act = true;
    const tg = e.target as HTMLElement;
    const b = tg.closest<HTMLElement>('[data-r]');
    if (b && (b.dataset.r === 'save' || b.dataset.r === 'savex')) return;
    e.preventDefault();
    if (b) {
      const k = b.dataset.r;
      if (k === 'rec') { rpRecTap(r); return; }
      if (k === 'vq') { if (!vrecBusy()) { vqToggle(); rpUi(r); } return; }
      // 錄影中：不能拖時間軸、暫停、重播、換速度（影片才會連續）；轉視角、縮放照樣可以
      if (vrecBusy() && (k === 'track' || k === 'play' || k === 'restart' || k === 'speed')) return;
      if (k === 'track') { r.scrub = true; r.scrubPlay = r.play.playing; r.play.playing = false; try { track.setPointerCapture(e.pointerId); } catch { /* 不支援 */ } seekX(e.clientX); return; }
      if (k === 'exit') { stopReplay(); return; }
      if (k === 'play') playToggle(r.play);
      else if (k === 'restart') playRestart(r.play);
      else if (k === 'speed') playSpeed(r.play);
      else if (k === 'zin') orbitZoom(r.orbit, 0.8);
      else if (k === 'zout') orbitZoom(r.orbit, 1.25);
      rpUi(r); return;
    }
    if (tg.closest('.frDock, .frTop')) return;
    // 空白處：一指拖＝轉視角、兩指＝縮放
    r.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch { /* 不支援 */ }
    if (r.ptr.size === 2) { const [a, c] = [...r.ptr.values()]; r.pinch = Math.hypot(a.x - c.x, a.y - c.y); }
    r.hintT = 0;
  });
  el.addEventListener('pointermove', e => {
    if (r.scrub) { seekX(e.clientX); return; }
    const p = r.ptr.get(e.pointerId); if (!p) return;
    e.preventDefault();
    if (r.ptr.size >= 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, c] = [...r.ptr.values()];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      if (r.pinch > 1 && d > 1) orbitZoom(r.orbit, r.pinch / d);
      r.pinch = d;
      return;
    }
    orbitDrag(r.orbit, e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = (e: PointerEvent) => {
    if (r.scrub) { r.scrub = false; if (r.scrubPlay && r.play.t < r.play.dur) r.play.playing = true; rpUi(r); return; }
    r.ptr.delete(e.pointerId); r.pinch = 0;
    if (r.ptr.size === 2) { const [a, c] = [...r.ptr.values()]; r.pinch = Math.hypot(a.x - c.x, a.y - c.y); }
  };
  for (const ev of ['pointerup', 'pointercancel'] as const) el.addEventListener(ev, up);
  el.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); orbitZoom(r.orbit, Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004)); r.hintT = 0; }, { passive: false });
  el.addEventListener('click', e => e.stopPropagation());
  el.addEventListener('contextmenu', e => e.preventDefault());
}
/** 控制列：字變了才改 DOM */
function rpUi(r: Rp) {
  const u = r.play.dur > 0 ? r.play.t / r.play.dur : 0;
  const pc = `${(u * 100).toFixed(2)}%`;
  r.fill.style.width = pc; r.knob.style.left = pc;
  const ts = `${fmtReplayT(r.play.t)} / ${fmtReplayT(r.play.dur)}`;
  if (ts !== r.timeS) { r.timeS = ts; r.time.textContent = ts; }
  if (r.playS !== r.play.playing) {
    r.playS = r.play.playing;
    r.playB.innerHTML = r.play.playing ? `${ICON.pause}<span>暫停</span>` : `${ICON.play}<span>播放</span>`;
  }
  const sp = r.play.speed === 1 ? '1×' : '0.5×';
  if (r.spdB.textContent !== sp) { r.spdB.textContent = sp; r.spdB.classList.toggle('on', r.play.speed !== 1); }
  // 錄影按鈕／錄影中提示／影片好了
  const vs = vrec?.st ?? 'idle';
  const q = vqNow();
  const rs = `${q}|` + (vs === 'rec' ? `rec|${fmtReplayT(r.play.t)}` : vs === 'finishing' ? 'fin' : vs === 'arming' ? 'arm' : vs === 'ready' ? `ready|${vrec!.size}` : 'idle');
  if (rs !== r.recS) {
    r.recS = rs;
    const busy = vs === 'rec' || vs === 'finishing' || vs === 'arming';
    r.vqB.innerHTML = `${ICON.hd}<span>${VIDEO_QUALITY[q].label}</span>`;
    r.vqB.classList.toggle('on', q === 'high');
    r.vqB.setAttribute('aria-label', `錄影畫質：${VIDEO_QUALITY[q].label}（點一下切換）`);
    r.el.classList.toggle('recording', busy);
    r.recB.classList.toggle('on', vs === 'rec');
    r.recB.innerHTML = vs === 'rec' ? `${ICON.recDot}<span>錄製中 ${fmtReplayT(r.play.t)} / ${fmtReplayT(r.play.dur)}・停止</span>`
      : vs === 'finishing' ? `${ICON.recDot}<span>影片處理中…</span>` : vs === 'arming' ? `${ICON.recDot}<span>準備錄影…</span>` : `${ICON.video}<span>錄製影片</span>`;
    r.el.classList.toggle('vidReady', vs === 'ready');
    const sv = r.el.querySelector('.frSaveB span');
    if (sv) sv.textContent = vs === 'ready' ? `儲存 / 分享影片・${fmtMB(vrec!.size)}` : '';
    r.el.querySelector('.frSaveB')?.setAttribute('aria-label', vs === 'ready' ? `影片好了（${vrec!.quality === 'high' ? '高畫質・' : ''}${fmtMB(vrec!.size)}），儲存或分享` : '儲存或分享影片');
  }
}
/**
 * 回放舞台（CR-32）：全部照當時錄下的世界座標重播，不再換算到人「現在」站的位置／開的船。
 * 人暫時掛到舞台上（矩陣直接擺），替身船照每一格錄到的船位置／船頭／傾斜走；結束時都還原。
 */
const rpStageG = new THREE.Group(); rpStageG.name = 'fishReplayStage';
const rpRig = newRigStash(), rpAt = newRpPlace();
let rpBoatG: THREE.Object3D | null = null;
function drawReplay(dt: number) {
  const r = rp!, c = r.c, fr = r.fr, rig = C!.me()!;
  ffx?.tick(dt);
  // 播放（0.5× 慢動作）；經過的水花在對的時間點濺起來（拖拉時間軸時不濺）
  const t0 = r.play.t;
  playStep(r.play, dt);
  clipSample(c, r.play.t, fr);
  rpPlaceOf(fr, rpAt);
  // 人：掛到舞台，擺到這一格錄到的世界位置／朝向（現場的船開到哪都不影響）
  if (rpStageG.parent !== C!.scene) C!.scene.add(rpStageG);
  rigStage(rpRig, rig.outer, rpStageG);
  rigPlace(rig.outer, rpAt);
  // 船：當時在船上＝替身船照這一格的船走；岸上＝不出現
  const bg = rpAt.boat ? (rpBoatG ??= C!.replayBoat?.() ?? null) : rpBoatG;
  if (bg) rpPlaceBoat(bg, rpAt);
  if (r.play.t > t0) clipSplashes(c, t0, r.play.t, (o, k) => { C!.splash(c.f[o + RF.sx], c.f[o + RF.sz], k); if (k >= 0.35) C!.sfx('splash'); });
  // 竿子＋姿勢
  const gear: Gear = fr[RF.lure] > 0.5 ? 'lure' : 'float';
  if (!myRod || myRod.kind !== gear) { myRod?.dispose(); myRod = makeRod(gear); }
  rpPose.pitch = fr[RF.pitch]; rpPose.side = fr[RF.side]; rpPose.hx = fr[RF.hx]; rpPose.hy = fr[RF.hy]; rpPose.hz = fr[RF.hz];
  rpPose.lean = fr[RF.lean]; rpPose.bend = fr[RF.bend]; rpPose.crank = fr[RF.crank]; rpPose.brace = fr[RF.brace];
  rpPose.steer = fr[RF.steer]; rpPose.steerK = fr[RF.steerK];
  rpIn.phase = RP_PHASE[Math.round(fr[RF.phase])] ?? 'hold'; rpIn.reel = fr[RF.reel] > 0.5; rpIn.lure = gear === 'lure'; rpIn.tension = fr[RF.ten];
  applyFishPose(rig, rpPose, myRod, rpIn);
  rodTipWorld(myRod, _tip);
  // 魚
  const st = Math.round(fr[RF.fst]);
  if (r.fish) {
    r.fish.visible = fr[RF.fvis] > 0.5 && st !== RFISH.none;
    if (r.fish.visible) {
      r.fish.position.set(fr[RF.fx], fr[RF.fy], fr[RF.fz]);
      r.fish.rotation.set(fr[RF.froll], fr[RF.fyaw], fr[RF.fpitch]);
    }
  }
  // 線（竿尖→線頭／魚嘴；掛在竿尖時接竿尖下面）
  if (gfx) {
    gfx.g.visible = true; gfx.bob.visible = false;
    _end.set(fr[RF.lx], fr[RF.ly], fr[RF.lz]);
    if (st === RFISH.hang) _end.set(_tip.x, _tip.y - HOIST_TIP_DROP, _tip.z);
    lineOpt.k = 1; lineOpt.settle = 1; lineOpt.sag = fr[RF.sag]; lineOpt.wy = PB.waterY + 0.04;
    castLine(gfx.pos, CAST_LINE_SEGS, _tip, _tip, _end, _end, lineOpt);
    (gfx.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    gfx.shMat.opacity = fr[RF.shadow]; gfx.shadow.visible = fr[RF.shadow] > 0.02 && st === RFISH.water;
    gfx.shadow.position.set(_end.x, PB.waterY + 0.03, _end.z);
  }
  // 鏡頭：繞著人和魚中間轉（魚吊到竿尖時就是人身邊）
  _rpP.set(rpAt.x, rpAt.y + 1.15, rpAt.z);
  if (r.fish?.visible) _rpTg.copy(r.fish.position); else _rpTg.copy(_end);
  // 人和魚隔多遠（鏡頭自動拉遠拉近，平滑）
  const sep = _rpTg.distanceTo(_rpP);
  _rpTg.lerp(_rpP, 0.5);
  if (r.snap) { r.focus.copy(_rpTg); r.sep = sep; r.snap = false; }
  else { const k = 1 - Math.exp(-dt * 4); r.focus.lerp(_rpTg, k); r.sep += (sep - r.sep) * (1 - Math.exp(-dt * 2.2)); }
  const cam = camRef;
  if (cam) {
    // 直式手機畫面比較窄：拉遠一點才框得到人和魚
    const asp = (cam as THREE.PerspectiveCamera).aspect || 1.6;
    const wide = Math.pow(Math.min(2.2, Math.max(1, 1.25 / asp)), 0.85);
    orbitPos(r.orbit, r.focus.x, r.focus.y, r.focus.z, Math.max(PB.waterY, rpAt.y), _rpCam, orbitDist(r.orbit, r.sep) * wide);
    cam.position.set(_rpCam.x, _rpCam.y, _rpCam.z);
    cam.lookAt(r.focus);
    cam.updateMatrixWorld();
  }
  // 錄影：播到尾巴自動停
  if (vrec?.st === 'rec' && !r.play.playing && r.play.t >= r.play.dur) vrec.stop();
  if (r.hintT > 0) { r.hintT -= dt; if (r.hintT <= 0) r.hint.classList.add('off'); } else if (!r.hint.classList.contains('off')) r.hint.classList.add('off');
  rpUi(r);
}

// ---------------- 人物動作＋釣竿（在人物擺好姿勢之後才呼叫） ----------------
let catchT = 0, catchSp = '', catchKg = 0;
/**
 * 魚模型（一條）：拉扯中在線頭水裡 → 釣上來從水面吊到竿尖 → 掛著晃 → 收掉。
 * 魚種幾何／材質是共用快取（fishModel），這裡只 new 一個 Mesh、用完 removeFromParent，不會漏 GPU 記憶體。
 */
let fishMesh: THREE.Mesh | null = null, fishMeshSp = '', fishLen = 0.4, fishYaw = 0, fishDep = 1;
let hangT = 0, hangYaw = 0, hoistDrip = false, cardTimer: ReturnType<typeof setTimeout> | 0 = 0;
const hoist = newHoist();
const _mouth = { x: 0, y: 0, z: 0 }, _ctr = { x: 0, y: 0, z: 0 };
function ensureFishMesh(sp: string, kg: number) {
  if (!gfx || !sp) return false;
  fishLen = fishLenM(kg);
  if (fishMesh && fishMeshSp === sp) { fishMesh.scale.setScalar(fishLen); return true; }
  dropFishMesh();
  const m = makeFishMesh(sp); if (!m) return false;
  fishMesh = m; fishMeshSp = sp; fishDep = 1;
  m.scale.setScalar(fishLen); m.visible = false;
  gfx.g.add(m);
  return true;
}
function dropFishMesh() { fishMesh?.removeFromParent(); fishMesh = null; fishMeshSp = ''; stopHoist(hoist); hoistDrip = false; }
/** 魚跑掉：在魚的位置濺一下，模型收掉 */
function escapeFish() {
  if (fishMesh?.visible && C) C.splash(fishMesh.position.x, fishMesh.position.z, 0.35);
  dropFishMesh();
}
/** 釣上來：從水面點 (wx, wz) 破水，吊到竿尖（沒給＝面前 1.8 m 的水面，測試用） */
function showCatch(f: HoldFish, wx?: number, wz?: number) {
  if (!gfx) return;
  catchSp = f.sp; catchKg = +f.kg.toFixed(2);
  const had = !!fishMesh?.visible && fishMeshSp === f.sp;
  if (!ensureFishMesh(f.sp, f.kg)) return;
  const o = origin(), fx = -Math.sin(castH), fz = -Math.cos(castH);
  const x = Number.isFinite(wx) ? wx! : o.x + fx * 1.8, z = Number.isFinite(wz) ? wz! : o.z + fz * 1.8;
  startHoist(hoist, x, PB.waterY + 0.02, z, had ? fishYaw : Math.atan2(fz, -fx));
  hoistDrip = false;
  catchT = HOIST_S + HOIST_HANG_S;
  spl(x, z, 0.4 + 0.3 * Math.min(1, f.kg / 20)); C?.sfx('splash');
}
function dropRod() {
  if (!myRod) return;
  myRod.dispose(); myRod = null;
  const rig = C?.me();
  if (rig) { rig.torso.rotation.set(0, 0, 0); rig.head.rotation.x = 0; }
}
function phaseOf(): FishPhase {
  const ph = sm.phase;
  return ph === 'off' ? 'off' : ph === 'idle' ? (catchT > 0 ? 'show' : 'hold') : ph === 'charge' ? 'charge' : ph === 'cast' || ph === 'fly' ? 'cast' : ph === 'fight' || ph === 'land' ? 'fight' : 'wait';
}
function fillPoseIn() {
  poseIn.phase = phaseOf();
  poseIn.power = sm.power;
  poseIn.lure = sm.gear === 'lure';
  poseIn.reel = reelHeld && (poseIn.phase === 'fight' || (poseIn.lure && poseIn.phase === 'wait'));
  poseIn.tension = sm.fight?.ten ?? 0;
  poseIn.twitch = sm.phase === 'nibble' ? Math.max(0.4, sm.twitch) : sm.phase === 'sink' ? 1 : 0;
  poseIn.jerk = jerkN;
  // 拉魚（搏鬥）或收線中都能左右拉；收線時動作小（fishPose 的 STEER_REEL）
  poseIn.steer = steerablePhase(poseIn) ? steerIn : 0;
  return poseIn;
}
/**
 * 給別人看的釣魚狀態（不含站位；站位由 plazaBoats 填）：姿勢代碼、拋竿方向（世界）、線長、張力、秀漁獲。
 * 每幀呼叫、填進既有物件，不配置。
 */
export function fishSyncFill(out: FishSyncMsg) {
  if (sm.phase === 'off') { out.st = 0; out.ch = 0; out.cd = 0; out.tn = 0; out.sp = ''; out.kg = 0; return out; }
  fillPoseIn();
  out.st = fishPoseCode(poseIn.phase, poseIn.reel, poseIn.lure, poseIn.steer);
  // 線頭的真實方向／距離（船在開也對：別人畫面線從人拉到同一個地方）；甩竿中＝拋竿方向、落點距離
  out.ch = +aimH().toFixed(2);
  const ph = sm.phase;
  const d = (ph === 'fight' || ph === 'land') && sm.fight ? Math.min(44, Math.max(1.5, fightM())) : ph === 'fly' || ph === 'cast' ? castDst : lw.on ? lineNow() : sm.lure ? sm.lure.dist : castDst;
  // 甩竿一放開就送落點距離（別人畫面的線頭才會跟自己一樣飛到同一個地方）
  out.cd = sm.lineOut || ph === 'fight' || ph === 'land' || ph === 'cast' || ph === 'fly' ? Math.round(d * 2) / 2 : 0;
  // 拉魚＝張力；路亞等待／捲線＝抽竿計數（別人看到抽竿動作；伺服器 tn 照樣夾 0～1，不用改）
  out.tn = poseIn.phase === 'fight' ? Math.round(poseIn.tension * 4) / 4 : poseIn.phase === 'wait' && poseIn.lure ? jerkTn(jerkN) : 0;
  const show = poseIn.phase === 'show';
  out.sp = show ? catchSp : ''; out.kg = show ? catchKg : 0;
  return out;
}
/** 線上同步的姿勢代碼（0＝沒在釣） */
export function fishPoseNow() { return sm.phase === 'off' ? 0 : fishPoseCode(fillPoseIn().phase, poseIn.reel, poseIn.lure, poseIn.steer); }
/**
 * 人物該面向哪（世界 yaw）：線在水裡／拉魚＝拋出去的方向；蓄力＝鏡頭方向；其他＝null（自由）
 */
let faceTest: number | null = null;
export function fishFaceYaw(): number | null {
  const ph = sm.phase;
  if (ph === 'off') return null;
  if (faceTest != null) return faceTest;
  if (sm.lineOut || ph === 'fight' || ph === 'land' || ph === 'cast' || ph === 'fly') return aimH();
  if (ph === 'charge' && camRef) { camRef.getWorldDirection(_dir); return yawOf(_dir.x, _dir.z); }
  return null;
}
/** 能不能在船上走動：拿著竿等魚的時候可以；蓄力、甩竿、拉魚時站定 */
export function fishCanWalk() { const ph = sm.phase; return !rp && (ph === 'idle' || ph === 'wait' || ph === 'nibble'); }
/** 正在收線：路亞等魚按住收線，或拉魚按住收線（浮標點一下收竿不算持續收線） */
export function fishReeling() {
  return reelHeld && (sm.phase === 'fight' || (sm.phase === 'wait' && !!sm.lure));
}
/**
 * 每幀在人物擺完姿勢之後呼叫（main.ts camTick 之後）：套釣魚動作、釣竿、再畫線（線要從竿尖出去）。
 */
export function fishPostPose(dt: number) {
  if (!C) return;
  // 精彩回放：人物竿子／魚／線／鏡頭都由回放片段擺（不送任何同步）
  if (rp) { if (replayOk()) { drawReplay(dt); return; } stopReplay(); }
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
/** 除錯：身體上看得到的網格頂點數（不含釣竿）；被烤進身體的竿子會讓它變多 */
export function fishBodyVerts(torso: THREE.Object3D) {
  let n = 0;
  torso.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || !m.visible) return; for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p.name === 'fishRod') return; n += m.geometry.getAttribute('position').count; });
  return n;
}
/** 除錯：釣竿／姿勢 */
function poseDbg() {
  const rig = C?.me();
  const tip = myRod && rig ? rodTipWorld(myRod, new THREE.Vector3()) : null;
  const hand = rig ? rig.lowerR.localToWorld(new THREE.Vector3(0, -((rig.lowerR.userData.restLen as number) || 0.24), 0)) : null;
  return { rod: myRod?.kind ?? null, phase: poseIn.phase, pitch: +myPose.pitch.toFixed(2), bend: +myPose.bend.toFixed(2), crank: +myPose.crank.toFixed(2), lean: +myPose.lean.toFixed(2), tip: tip && { x: +tip.x.toFixed(2), y: +tip.y.toFixed(2), z: +tip.z.toFixed(2) }, hand: hand && { x: +hand.x.toFixed(2), y: +hand.y.toFixed(2), z: +hand.z.toFixed(2) }, line: gfx ? [...Array.from(gfx.pos.slice(0, 3)), ...Array.from(gfx.pos.slice(-3))].map(v => +v.toFixed(2)) : null, gap: tip && gfx && gfx.g.visible ? +tip.distanceTo(new THREE.Vector3(gfx.pos[0], gfx.pos[1], gfx.pos[2])).toFixed(3) : null, rods: myRod?.g.parent ? myRod.g.parent.children.filter(o => o.name === 'fishRod').length : 0, rodVis: myRod ? myRod.g.children.every(c => c.visible) : null, bodyVerts: rig ? fishBodyVerts(rig.torso) : 0, catch: catchT > 0 };
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
  if (b) { const q = pierNearest(b.x, b.z); atDock = Math.hypot(q.x - b.x, q.z - b.z) <= 6 || isletSellNear(b.x, b.z); }
  else if (mode === 'walk') { const p = C.walkPos(); atDock = (p.x <= -23 && Math.abs(p.z) <= 11) || (p.x <= -23 && p.x >= PB.pierX1 - 0.3 && Math.abs(p.z) <= 2) || isletSellNear(p.x, p.z); }
  const showSell = net && holdN > 0 && atDock && !sm.lineOut && sm.phase !== 'fight';
  ui.sell.classList.toggle('on', showSell);
  if (showSell) { const s = `賣魚（${holdN} 條）`; const l = ui.sell.querySelector('.lbl')!; if (l.textContent !== s) l.textContent = s; }
  // 釣魚模式 UI 放在右下（船上那一欄的位置）。#fishBar 是 column-reverse，.prepend 讓「賣魚」排在最下面（拋竿／收線下面）
  if (showSell && on && (ui.sell.parentElement !== ui.bar || ui.bar.firstElementChild !== ui.sell)) ui.bar.prepend(ui.sell);
  else if (!on && ui.sell.parentElement === ui.bar) (document.getElementById('boatRackBar') ?? ui.bar).append(ui.sell);
  ui.bar.classList.toggle('on', on);
  ui.hud.classList.toggle('on', on);
  ui.acts.classList.toggle('on', on);
  // 回放按鈕：有上一條魚的片段（或剛釣到還在錄收尾）、沒在拋／拉的時候才是可按
  const rpCan = !rp && sm.phase === 'idle' && (!!clip || (rec.on && recEndT > 0));
  if (rpCan !== rpBtnOn) { rpBtnOn = rpCan; ui.acts.classList.toggle('hasRp', rpCan); }
  const rpEl = rpBtn();
  if (rpEl) {
    rpEl.setAttribute('aria-disabled', rpCan ? 'false' : 'true');
    const lab = rpCan ? '觀看精彩回放' : '還沒有可看的回放';
    if (rpEl.getAttribute('aria-label') !== lab) rpEl.setAttribute('aria-label', lab);
  }
  if (!on) { reelFeel?.release(); ui.meter.classList.remove('on'); ui.depth.classList.remove('on'); ui.depth.setAttribute('aria-hidden', 'true'); clearFishToastTop(); return; }
  const ph = sm.phase, lure = sm.gear === 'lure';
  ui.cast.classList.toggle('on', ph === 'idle' || ph === 'charge' || ph === 'cast');
  ui.cast.classList.toggle('dis', ph === 'cast');
  const reelOn = ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'fight' || ph === 'hook' || ph === 'fly';
  ui.reel.classList.toggle('on', reelOn);
  ui.reel.classList.toggle('dis', ph === 'hook' || ph === 'fly');
  ui.reel.classList.toggle('hot', ph === 'sink');
  const rl0 = ph === 'fight' || lure ? '收線' : ph === 'sink' ? '收竿！' : '收竿';
  const rl = (reelHeld || !!reelFeel?.held()) ? reelPressLabel(rl0) : rl0;
  const rlEl = ui.reel.querySelector('.lbl')!; if (rlEl.textContent !== rl) rlEl.textContent = rl;
  ui.jerk.classList.toggle('on', lure && ph === 'wait' && !(b && trollOk(C.mySeat(), sm.item, b.v)));
  // HUD
  const cnt = countOf(sm.item);
  const main = `${FISH.rods[sm.gear].n}・${ITEM_NAME[sm.item]}${lure ? '' : sm.item === 'oyster' ? `（今天剩 ${cnt}）` : ` ×${cnt}`}｜魚獲 ${holdN}／${FISH.holdMax}`;
  if (ui.hudTx.textContent !== main) ui.hudTx.textContent = main;
  // 現在幾公尺：一直顯示（蓄力、飛出去、等魚、拉魚都即時變）
  const o = origin();
  // CR-31：剩餘距離＝現在的人到浮標／假魚／魚的真實水平距離（船在開也對）
  const real = lw.on && (ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook') ? lineNow() : null;
  const dm = fmtDistM(fishDistNow({ phase: ph, power: sm.power, item: sm.item, castDst, flyT: sm.flyT, flyDur: sm.flyDur, lureDist: real ?? (sm.lure ? sm.lure.dist : null), floatDist: Math.hypot(castX - o.x, castZ - o.z), prog: sm.fight?.prog ?? 0, fightD0, fightM: fw.on && sm.fight ? fightM() : undefined }));
  if (ui.hudDist.textContent !== dm) { ui.hudDist.textContent = dm; ui.hudDist.classList.toggle('on', !!dm); }
  const troll = !!b && lure && trollOk(C.mySeat(), sm.item, b.v);
  const tip = ph === 'idle' ? (C.mySeat() === 0 && b && Math.abs(b.v) > FISH.driverMaxV ? '先停船才能拋竿' : '按住「拋竿」蓄力，放開拋出去')
    : ph === 'charge' ? '放開就拋出去' : ph === 'cast' || ph === 'fly' ? '' 
    : ph === 'wait' ? (troll ? '拖釣中：船慢慢開，假魚跟在後面' : lure ? (sm.lure?.follow ? '有魚跟上來了，節奏保持住' : LURE_TIP[sm.item as LureKey]) : '等魚咬…')
    : ph === 'nibble' ? '有魚在試吃，還不要收' : ph === 'sink' ? '浮標沉下去了！快收竿' : ph === 'hook' ? '' 
    : ph === 'fight' ? (sm.fight?.lure && sm.fight.run !== 0 ? `魚往${sm.fight.run < 0 ? '左' : '右'}衝，搖桿往${sm.fight.run < 0 ? '右' : '左'}拉` : '按住收線，張力別到紅色') : '';
  if (tip !== tipS) { tipS = tip; ui.hudTip.textContent = tip; ui.hudTip.classList.toggle('on', !!tip); }
  // 力道條／張力條
  const meterOn = ph === 'charge' || ph === 'fight';
  ui.meter.classList.toggle('on', meterOn);
  if (meterOn) {
    const v = ph === 'charge' ? sm.power : sm.fight?.ten ?? 0;
    ui.fill.style.transform = `scaleX(${v.toFixed(3)})`;
    ui.meter.classList.toggle('charge', ph === 'charge');
    ui.meter.classList.toggle('red', ph === 'fight' && v >= FISH.redT);
    const lbl = ph === 'charge' ? `力道 ${Math.round(castDist(sm.power, sm.item))} m` : fmtFightLbl(sm.fight?.prog ?? 0);
    if (ui.mLbl.textContent !== lbl) ui.mLbl.textContent = lbl;
    const run = ph === 'fight' && sm.fight?.lure ? sm.fight.run : 0;
    ui.dirL.classList.toggle('on', run > 0); ui.dirR.classList.toggle('on', run < 0);
  }
  // 路亞水深條：假魚在水裡才顯示（等魚／試吃／沉／等伺服器）；蓄力、飛線、拉魚、垂釣竿都藏起來
  const depthOn = lure && !!sm.lure && (ph === 'wait' || ph === 'nibble' || ph === 'sink' || ph === 'hook');
  ui.depth.classList.toggle('on', depthOn);
  ui.depth.setAttribute('aria-hidden', depthOn ? 'false' : 'true');
  if (depthOn && sm.lure && isLure(sm.item)) {
    const z = lureDepthZone(sm.item);
    ui.depthZone.style.top = (z.min * 100).toFixed(1) + '%';
    ui.depthZone.style.height = ((z.max - z.min) * 100).toFixed(1) + '%';
    const d = sm.lure.depth;
    ui.depthDot.style.top = (d * 100).toFixed(1) + '%';
    const okD = inDepthZone(sm.item, d);
    ui.depthDot.classList.toggle('in', okD);
    ui.depthDot.classList.toggle('follow', okD && sm.lure.follow);
  }
  syncFishToastTop();
}

/** 上方提示排在換餌列和狀態條下面（量實際底緣，直式／橫式都不會蓋住按鈕） */
let fishToastTopKey = '';
let fishToastMeasureAt = 0;
function clearFishToastTop() {
  if (!fishToastTopKey) return;
  fishToastTopKey = '';
  fishToastMeasureAt = 0;
  document.documentElement.style.removeProperty('--fish-toast-top');
}
function syncFishToastTop(force = false) {
  if (!ui) { clearFishToastTop(); return; }
  const hud = ui.hud, acts = ui.acts;
  if (!hud.classList.contains('on') && !acts.classList.contains('on')) { clearFishToastTop(); return; }
  // 每幀 getBoundingClientRect 會逼 layout；約 0.4s 量一次即可
  const now = performance.now();
  if (!force && now - fishToastMeasureAt < 400) return;
  fishToastMeasureAt = now;
  const bottom = Math.max(acts.getBoundingClientRect().bottom, hud.getBoundingClientRect().bottom);
  const top = Math.round(bottom + 8);
  const key = String(top);
  if (key === fishToastTopKey) return;
  fishToastTopKey = key;
  document.documentElement.style.setProperty('--fish-toast-top', `${top}px`);
}

// ---------------- 除錯 ----------------
export const fishDbg = {
  state() { return { phase: sm.phase, gear: sm.gear, item: sm.item, sid: sm.sid, power: +sm.power.toFixed(2), lure: sm.lure ? { dist: +sm.lure.dist.toFixed(1), depth: +sm.lure.depth.toFixed(2), follow: sm.lure.follow } : null, fight: sm.fight ? { ten: +sm.fight.ten.toFixed(2), prog: +sm.fight.prog.toFixed(2), run: sm.fight.run } : null, ok, oldServer, staleLine, holdN, holdVal, dex: Object.fromEntries(dex), rod, pick: { ...pick }, hooked }; },
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
  /** 測試：魚模型現在在哪（拉扯水裡／吊起／掛著） */
  fishMesh() { return fishMesh ? { sp: fishMeshSp, vis: fishMesh.visible, y: +fishMesh.position.y.toFixed(2), water: +PB.waterY.toFixed(2), hoist: hoist.on, u: +hoistU(hoist).toFixed(2), len: +fishLen.toFixed(2) } : null; },
  panel(tab: 'gear' | 'dex' = 'gear') { openPanel(tab); return 'ok'; },
  close() { closePanel(); return 'ok'; },
  pick(r: Gear, item?: ItemKey) { rod = r; if (item) pick[r] = item; sm.gear = rod; sm.item = pick[rod]; return { rod, item: sm.item }; },
  fetch() { void fetchState(); return 'ok'; },
  /** 測試：站到岸上某一點（碼頭尾端約 x＝-39, z＝0） */
  tp(x: number, z: number) { const p = C?.walkPos() as { x: number; z: number } | undefined; if (!p || C?.mode() !== 'walk') return 'not walking'; p.x = x; p.z = z; return 'ok'; },
  ui() { return ui ? { entry: ui.entry.classList.contains('on'), sell: ui.sell.classList.contains('on'), bar: ui.bar.classList.contains('on'), cast: ui.cast.classList.contains('on'), reel: ui.reel.classList.contains('on') ? ui.reel.textContent : null, reelPressed: ui.reel.classList.contains('pressed'), jerk: ui.jerk.classList.contains('on'), hud: ui.hud.classList.contains('on') ? ui.hud.textContent : null, acts: ui.acts.classList.contains('on'), depth: ui.depth.classList.contains('on'), meter: ui.meter.classList.contains('on') ? ui.mLbl.textContent : null, panel: panelOn } : null; },
  /** 測試：特效粒子數（氣泡、墨） */
  fx() { return ffx ? { bubbles: ffx.bubbles.live(), ink: ffx.ink.live() } : null; },
  /** 測試：噴一團墨（在現在的線頭位置） */
  ink() { ffx?.inkPuff(_end.x, PB.waterY + 0.05, _end.z, 1); return ffx?.ink.live() ?? 0; },
  /** 測試：假裝中魚（不經伺服器，只看拉扯畫面） */
  /** 測試：錄影片狀態 */
  vrec() { const cv = document.getElementById('c') as HTMLCanvasElement | null; return { st: vrec?.st ?? null, size: vrec?.size ?? 0, name: vrec?.name ?? '', type: vrec?.type ?? '', url: !!vrec?.url, q: vqNow(), canvas: cv ? [cv.width, cv.height] : null }; },
  /** 測試：回放跳到某秒並暫停 */
  rpSeek(sec: number) { if (!rp) return null; playSeek(rp.play, sec); rp.play.playing = false; rpUi(rp); return rp.play.t; },
  /** 測試：精彩回放（狀態／開始／關閉） */
  replay(on?: boolean) { if (on === true) startReplay(); else if (on === false) stopReplay(); return { clip: clip ? { n: clip.n, dur: +clip.dur.toFixed(2), sp: clip.meta.sp, bytes: clip.f.byteLength } : null, rec: { on: rec.on, n: rec.n, bytes: rec.buf.byteLength }, on: !!rp, t: rp ? +rp.play.t.toFixed(2) : null, speed: rp?.play.speed ?? null, orbit: rp ? { ...rp.orbit } : null, fish: !!rp?.fish?.parent, card: cardOn, focus: rp ? rp.focus.toArray().map(v => +v.toFixed(2)) : null, cam: rp && camRef ? camRef.position.toArray().map(v => +v.toFixed(2)) : null, me: C?.me()?.outer.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)) ?? null, fishPos: rp?.fish ? rp.fish.position.toArray().map(v => +v.toFixed(2)) : null }; },
  /** 測試：假裝釣上來（接在 fakeFight 後面；不經伺服器） */
  fakeLand(sp = 'x', kg = 1.2) {
    const f: HoldFish = { sp, name: sp, tier: 0, kg, val: 0 };
    document.body.classList.remove('fishFight'); sm.reset(); hooked = null;
    showCatch(f, fightX, fightZ);
    recMeta = { sp, name: sp, kg, tier: 0, player: '' }; recEndT = t + REPLAY_TAIL_S;
    showCatchCard(f);
    return 'ok';
  },
  fakeFight(power = 0.6, ms = 10000, lure = true, sp = '') { const o0 = origin(); ox = o0.x; oz = o0.z; sm.phase = 'hook'; sm.gear = lure ? 'lure' : 'float'; fightD0 = castDst; sm.hooked(power, ms, fightD0); anchorNow(); fightWStart(fw, ancX - Math.sin(castH) * fightD0, ancZ - Math.cos(castH) * fightD0, ancX, ancZ, fightD0); runS = 0; recStart(rec); recEndT = -1; if (sp) { hooked = { sp, name: sp, tier: 0, kg: 1.2, val: 0 }; ensureFishMesh(sp, 1.2); } document.body.classList.add('fishFight'); return sm.phase; },
};
export type { BaitKey, LureKey };
