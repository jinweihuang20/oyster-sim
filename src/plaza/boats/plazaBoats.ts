/**
 * 廣場西側海面：5 艘膠筏的控制器（上下船、開船、載人、撞船落水、游泳、救人、船上丟殼）。
 * 座位／落水／救人由伺服器判定；位置由駕駛回報（10Hz）。伺服器還沒更新時＝只有自己看得到（本機模式）。
 */
import * as THREE from 'three';
import { makePlayerAvatar, posePlazaStand, ensurePlazaSmokeCig, getPlazaSmokeCig, clearPlazaSmokeCig, type PlayerRig, type SmokeSitPoseOpts } from '../../dm/character';
import { makeMeshHelpers } from '../../dm/mesh';
import { toast, toastTop } from '../../ui/dom';
import { rewardToast, clearRewardToasts } from '../../ui/rewardToast';
import { walkKeys, joy } from '../../world/walkSeat';
import type { PlazaClient } from '../hubClient';
import type { PlazaWorldView } from '../worldView';
import type { Raft } from '../../sea/seaModels';
import {
  PB, SEATS, dockSlot, stepPlazaBoat, pushStatic, pushFromBoat, isHardRam, stepSwim, freePassengerSeat, boatEmpty,
  distToLand, landSpot, hullPts, knockSpot, boatBob, pierNearest, dockEdge, nearestDrift, DRIFT, type Hull,
} from './boatLogic';
import { poseRider, swimPetSpot } from './boatPose';
import { makePlazaSea, type PlazaSea } from './boatScene';
import { openRacks, closeRacks, onRackSnap, onRackUpd, onRackGone, onRackStolen, onCargo, onLoad, rackSpill, rackSlow, rackPush, rackBeforeLeave, rackKey, tickRacks, rackDbg } from './plazaRacks';
import { makeBoatNet, type BoatNet, type BoatDto, type SwimDto, type RamDto, type BoatPosesDto, type BoatsSnap, type DriftBox, type DriftSnap, type DriftClaimed, type DriftShare, type DriftTide, type DriftPull } from './boatNet';

export type BoatSfx = 'splash' | 'bump' | 'hit' | 'dock' | 'launch' | 'warn';
export type PlazaBoatDeps = {
  scene: THREE.Scene;
  coarse: boolean;
  fog: () => THREE.Fog | null;
  /** 廣場吊燈位置（夜晚地面光池） */
  plazaLamps?: readonly (readonly [number, number])[];
  client: () => PlazaClient | null;
  myConn: () => string;
  myNick: () => string;
  view: () => PlazaWorldView | null;
  /** 自己的廣場 avatar（第三人稱同一個） */
  me: () => PlayerRig | null;
  walkPos: THREE.Vector3;
  setYaw: (y: number) => void;
  /** 可以互動（在廣場走動、沒坐著、沒開選單） */
  canAct: () => boolean;
  sfx: (k: BoatSfx) => void;
  /** 船上丟殼：target＝要丟的人（null＝丟進海裡）；回 false＝節流中沒丟 */
  throwShell: (from: THREE.Vector3, target: { connId: string; nick: string } | null, to: THREE.Vector3) => boolean;
  /** 船上抽菸：吸菸區同一套「抽一口」的目前進度（null＝沒在抽／不能抽） */
  smoke?: () => SmokeSitPoseOpts | null;
  /** 伺服器發的獎金入帳（跟其他廣場獎勵同一條路） */
  grantMoney?: (amount: number, via: string) => void;
  /** 蚵棚：本機錢包（升級扣錢、偷拉罰款）與雜貨店買的蚵棚組合包 */
  getMoney?: () => number;
  spendMoney?: (n: number, via: string) => boolean;
  fineMoney?: (n: number, via: string) => number;
  rackKits?: () => number;
  addRackKits?: (d: number) => void;
};

type Mode = 'walk' | 'boat' | 'swim';
type BoatSt = Hull & { id: number; seats: string[]; tx: number; tz: number; th: number; tv: number; netT: number; sway: number; steer: number; wakeT: number; bumpT: number; y: number; rx: number; rz: number; fake?: { t: number; r: number; cx: number; cz: number } };
type SwimSt = { connId: string; x: number; z: number; h: number; tx: number; tz: number; th: number; fake?: boolean; /** 0～1：在游（自由式）／踩水，平滑 */ k?: number };
type Prompt = { kind: 'board' | 'ride' | 'leave' | 'rescue' | 'climb' | 'out' | 'full'; label: string; boat?: number; conn?: string };

const ICON = {
  boat: '<svg viewBox="0 0 24 24"><path d="M3 15h18l-3 4H6z"/><path d="M12 15V5l5 7h-5"/></svg>',
  seat: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2"/><path d="M8 21v-6h8M12 8v7"/><path d="M3 18h18"/></svg>',
  dock: '<svg viewBox="0 0 24 24"><path d="M3 12h18M6 12v8M12 12v8M18 12v8"/><path d="M8 8l4-4 4 4"/></svg>',
  rescue: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2"/></svg>',
  dive: '<svg viewBox="0 0 24 24"><path d="M12 3v9M8 8l4 4 4-4"/><path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17M3 21c2 0 2-1.5 4.5-1.5S10 21 12 21s2-1.5 4.5-1.5S19 21 21 21"/></svg>',
  shell: '<svg viewBox="0 0 24 24"><path d="M4 14c0-5 4-9 8-9s8 4 8 9c-3 2-13 2-16 0z"/><path d="M12 5v10M8 7l2 8M16 7l-2 8"/></svg>',
  climb: '<svg viewBox="0 0 24 24"><path d="M6 21V9M18 21V9M6 12h12M6 17h12"/><path d="M9 6l3-3 3 3"/></svg>',
};

let D: PlazaBoatDeps | null = null;
let sea: PlazaSea | null = null;
let net: BoatNet | null = null;
let boats: BoatSt[] = [];
const swimmers = new Map<string, SwimSt>();
let mode: Mode = 'walk';
let myBoat = -1, mySeat = -1;
const mySwim = { x: 0, z: 0, h: 0 };
let mySwimK = 0;
let own: Raft | null = null;
let ownAnchors: THREE.Object3D[] = [];
let localOnly = false, localNoticed = false;
let driveAcc = 0, swimAcc = 0, ramCd = 0, throwCd = 0, throwAnim = 0, mySway = 0, busy = false, splashT = 0, t = 0;
let prompt: Prompt | null = null;
let ui: { root: HTMLDivElement; act: HTMLButtonElement; shell: HTMLButtonElement; dive: HTMLButtonElement; note: HTMLDivElement; dock: HTMLDivElement; dockArrow: HTMLElement; dockLbl: HTMLSpanElement } | null = null;
let resyncT = 0;
// 漂流箱（伺服器給位置；撈到由伺服器判定）
let drifts: DriftBox[] = [];
let driftPay = { min: 5000, max: 20000 };
/** 最新一包漂流箱設定（漂流潮、金箱、今日加碼） */
let driftCfg: DriftSnap | null = null;
/** 金箱子：上次提示「要幾個人一起拉」的時間（別一直跳） */
let goldNoteT = -99;
let driftBusy = false, driftCd = 0, driftCapNoted = false;
/** 每次開網頁只提示一次 */
let driftHinted = false;
const mounted = new Set<string>();
const fakeRigs = new Map<string, PlayerRig>();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camSnap = true;
const _o = new THREE.Object3D(), _v = new THREE.Vector3(), _e = new THREE.Euler();

const fwd = (h: number) => [-Math.sin(h), -Math.cos(h)] as const;
const myId = () => D?.myConn() || 'me';
const isMe = (c: string) => !!c && c === myId();

function newBoat(i: number): BoatSt {
  const d = dockSlot(i);
  return { id: i, x: d.x, z: d.z, h: d.h, v: 0, seats: ['', '', '', ''], tx: d.x, tz: d.z, th: d.h, tv: 0, netT: 0, sway: 0, steer: 0, wakeT: 0, bumpT: 0, y: PB.waterY, rx: 0, rz: 0 };
}

// ---------------- UI ----------------
function buildUi() {
  if (ui) return;
  const root = document.createElement('div'); root.id = 'boatUi';
  const mk = (id: string, ic: string, label: string, key: string) => {
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'boatBtn';
    b.innerHTML = `<i class="boatIc">${ic}</i><span class="lbl">${label}</span><span class="key"> (${key})</span>`;
    root.appendChild(b); return b;
  };
  const act = mk('boatAct', ICON.boat, '上船', 'E');
  const shell = mk('boatShell', ICON.shell, '丟殼', 'F');
  const dive = mk('boatDive', ICON.dive, '跳水', 'X');
  const note = document.createElement('div'); note.id = 'boatNote'; root.appendChild(note);
  // 碼頭方向指示：碼頭不在畫面內（或很遠）時，貼在畫面邊緣指向碼頭
  const dock = document.createElement('div'); dock.id = 'boatDockInd'; dock.setAttribute('aria-hidden', 'true');
  dock.innerHTML = `<i class="dockArrow"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M13 8.5l3.5 3.5-3.5 3.5"/></svg></i><span class="dockLbl"></span>`;
  root.appendChild(dock);
  const tap = (b: HTMLButtonElement, f: () => void) => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); f(); });
  tap(act, () => doPrompt()); tap(shell, () => throwFromBoat()); tap(dive, () => void jumpIn());
  for (const b of [act, shell, dive]) b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
  document.body.appendChild(root);
  ui = { root, act, shell, dive, note, dock, dockArrow: dock.querySelector('.dockArrow') as HTMLElement, dockLbl: dock.querySelector('.dockLbl') as HTMLSpanElement };
}
function syncUi() {
  if (!ui) return;
  const p = prompt;
  ui.act.classList.toggle('on', !!p);
  if (p) {
    const ic = p.kind === 'leave' || p.kind === 'out' ? ICON.dock : p.kind === 'rescue' ? ICON.rescue : p.kind === 'climb' ? ICON.climb : p.kind === 'ride' ? ICON.seat : ICON.boat;
    const lbl = ui.act.querySelector('.lbl')!;
    if (lbl.textContent !== p.label) { lbl.textContent = p.label; (ui.act.querySelector('.boatIc') as HTMLElement).innerHTML = ic; }
    ui.act.classList.toggle('dis', p.kind === 'full' || busy);
  }
  ui.shell.classList.toggle('on', mode === 'boat');
  ui.dive.classList.toggle('on', mode === 'boat');
  document.body.classList.toggle('plazaBoating', mode !== 'walk');
  document.body.classList.toggle('plazaSwimming', mode === 'swim');
}
function note(s: string) { if (ui) { ui.note.textContent = s; ui.note.classList.toggle('on', !!s); } }

// ---------------- 開／關 ----------------
export function openPlazaBoats(deps: PlazaBoatDeps) {
  closePlazaBoats();
  D = deps;
  sea = makePlazaSea(deps.scene, { coarse: deps.coarse, fog: deps.fog(), plazaLamps: deps.plazaLamps });
  boats = Array.from({ length: PB.count }, (_, i) => newBoat(i));
  drifts = []; driftBusy = false; driftCd = 0;
  swimmers.clear(); mode = 'walk'; myBoat = mySeat = -1; localOnly = false; localNoticed = false; prompt = null; busy = false; camSnap = true;
  buildUi();
  const c = deps.client();
  if (c) {
    net = makeBoatNet(c, {
      seats: onSeats, poses: onPoses, ram: onRam, swimStart: s => upsertSwim(s, true), swimEnd: endSwim, rescued: onRescued, state: onState,
      drift: onDrift, driftClaimed: onDriftClaimed, driftShare: onDriftShare, driftTide: onDriftTide, driftPull: onDriftPull,
      racks: onRackSnap, rackUpd: onRackUpd, rackGone: onRackGone, rackStolen: onRackStolen, cargo: onCargo, load: onLoad,
    });
  } else localOnly = true;
  openRacks({
    net: () => net, sea: () => sea,
    myBoat: () => (mode === 'boat' ? boats[myBoat] ?? null : null), mySeat: () => mySeat, localOnly: () => localOnly || !net,
    splash: (x, z, k) => splash(x, z, k), sfx: k => D?.sfx(k),
    grantMoney: (n, via) => D?.grantMoney?.(n, via), getMoney: () => D?.getMoney?.() ?? 0, spendMoney: (n, via) => D?.spendMoney?.(n, via) ?? false,
    fineMoney: (n, via) => D?.fineMoney?.(n, via) ?? 0, kits: () => D?.rackKits?.() ?? 0, addKits: d => D?.addRackKits?.(d),
  }, ui!.root);
  syncUi();
}
export function closePlazaBoats() {
  if (!D) return;
  // 還在船上／水裡就離開廣場：下次進場站在碼頭口
  if (mode !== 'walk') { D.walkPos.x = PB.shoreX + 1.2; D.walkPos.z = 0; restoreMe(); }
  clearRewardToasts();
  for (const c of mounted) D.view()?.setRemoteMount(c, null);
  mounted.clear();
  D.view()?.setSeaView(false);
  for (const r of fakeRigs.values()) r.outer.removeFromParent();
  fakeRigs.clear();
  closeRacks();
  net?.close(); net = null;
  sea?.dispose(); sea = null; own = null; ownAnchors = [];
  ui?.root.remove(); ui = null;
  document.body.classList.remove('plazaBoating', 'plazaSwimming');
  mode = 'walk'; myBoat = mySeat = -1; boats = []; swimmers.clear(); drifts = [];
  D = null;
}
export const plazaBoatsActive = () => !!D && mode !== 'walk';
/** 游泳時寵物站在背上：回背上那一點的世界座標＋朝向（不在游泳＝null） */
const _back = new THREE.Vector3();
export function plazaSwimBack(groundPet = false): { x: number; y: number; z: number; yaw: number } | null {
  if (!D || mode !== 'swim') return null;
  const rig = D.me(); if (!rig) return null;
  const sp = swimPetSpot(swimForce ?? mySwimK, groundPet);
  _back.set(0, sp.y, sp.z).applyEuler(rig.outer.rotation).add(rig.outer.position);
  return { x: _back.x, y: _back.y, z: _back.z, yaw: mySwim.h };
}
export const plazaBoatsMode = () => mode;
export const plazaBoatsOpen = () => !!D;

// ---------------- 伺服器事件 ----------------
function onState(s: BoatsSnap | null, soft = false) {
  if (!s) {
    localOnly = true;
    if (!localNoticed) { localNoticed = true; toastTop('海上同步還沒開放（伺服器未更新）：先只有你看得到自己的船'); }
    return;
  }
  localOnly = false;
  const wasBoat = myBoat, wasMode = mode;
  // 定期對帳：自己正在上下船時不要拿舊快照蓋掉
  if (soft && busy) return;
  for (const b of s.boats) onSeats(b, !soft);
  for (const k of [...swimmers.keys()]) if (!swimmers.get(k)!.fake) swimmers.delete(k);
  for (const w of s.swimmers) upsertSwim(w, !soft);
  if (soft) return;
  // 重連後：伺服器沒有我的座位／泳者紀錄（重開或斷線太久）＝回岸上
  const me = myId();
  const stillOn = s.boats.some(b => b.seats.includes(me)), stillSwim = s.swimmers.some(w => w.connId === me);
  if (wasMode === 'boat' && !stillOn) {
    const b = boats[wasBoat];
    if (b && mySeat === 0 && boatEmpty(b.seats)) {
      // 船還在原地等：坐回駕駛座
      void net?.board(b.id, 0).then(r => { if (!r.ok) forceAshore('連線重新整理了，先回到碼頭'); else if (r.boat) onSeats(r.boat); });
    } else forceAshore('連線重新整理了，先回到碼頭');
  } else if (wasMode === 'swim' && !stillSwim) forceAshore('連線重新整理了，先回到碼頭');
}
function onDrift(s: DriftSnap) {
  drifts = s.boxes.slice(0, 14);
  driftPay = { min: s.minPay, max: s.maxPay };
  // 整包廣播不帶我的 bonusLeft：沿用進場時拿到的
  const left = driftCfg?.bonusLeft ?? s.bonusLeft;
  driftCfg = { ...s, bonusLeft: s.bonusLeft || left };
}
/** 漂流潮開始（台北整點）：大字提示，不說在哪 */
function onDriftTide(e: DriftTide) {
  if (!D) return;
  D.sfx('launch');
  toastTop(`漂流潮來了！接下來 10 分鐘海上多了 ${e.n} 個漂流箱${e.gold ? '，還有一個金色大箱子（要 2 個人以上一起拉）' : ''}`, 4);
}
/** 有人在拉金箱子：附近的人看得到，叫人來幫忙 */
function onDriftPull(e: DriftPull) {
  const b = drifts.find(d => d.key === e.key); if (!b || !D || mode === 'walk') return;
  const me = mode === 'boat' ? boats[myBoat] : mySwim; if (!me) return;
  if (Math.hypot(b.x - me.x, b.z - me.z) > 60) return;
  if (t - goldNoteT < 2) return; goldNoteT = t;
  toast(`${e.nick || '有人'} 在拉金色大箱子（${e.n}／${e.need} 人），快來一起拉！`, '#ffd76a', 2);
}
/** 獎勵提示文字：分錢、今天第一次加碼 */
function driftLabel(head: string, n: number, bonus: number, gold: boolean) {
  const parts = [head];
  if (n > 1) parts.push(gold ? `${n} 人平分` : `全船 ${n} 人平分`);
  if (bonus > 0) parts.push(`今日第一次 +${money(bonus)}`);
  return parts.join('・');
}
function onDriftClaimed(e: DriftClaimed) {
  const b = drifts.find(d => d.key === e.key);
  drifts = drifts.filter(d => d.key !== e.key);
  if (b) splash(b.x, b.z, 1.2);
  // 自己撈到的入帳在 DriftClaim 的回應裡處理（只入一次）；別人撈到：小公告
  // 同船分錢的人另外收到 DriftShare（自己的獎勵提示），這裡就不再放公告
  if (!isMe(e.connId) && e.pay > 0 && !sharedKeys.has(e.key)) rewardToast(`${e.nick || '有人'} ${e.gold ? '一起拉上金色大箱子' : '撈到漂流箱'}${e.n > 1 ? `（${e.n} 人平分）` : ''}`, money(e.pay), 'feed', `drift:${e.key}`);
}
const sharedKeys = new Set<number>();
/** 同船有人撈到：我分到的錢（伺服器已記 income），入帳＋自己的獎勵提示 */
function onDriftShare(e: DriftShare) {
  if (e.pay <= 0) return;
  sharedKeys.add(e.key); if (sharedKeys.size > 40) sharedKeys.delete(sharedKeys.values().next().value!);
  D?.grantMoney?.(e.pay + e.bonus, 'drift-share');
  D?.sfx('launch');
  if (e.bonus > 0 && driftCfg) driftCfg.bonusLeft = false;
  rewardToast(driftLabel(e.gold ? '拉上金色大箱子！' : `${e.by || '同船的人'} 撈到漂流箱`, e.n, e.bonus, e.gold), `+${money(e.pay + e.bonus)}`, 'mine', `drift:${e.key}`);
}
const money = (n: number) => `$${n.toLocaleString('zh-TW')}`;
function driftHint() {
  if (driftHinted || localOnly) return;
  driftHinted = true;
  // 只說有這回事，不說在哪（要自己出海找）
  later(1.8, () => toastTop(`海上藏著漂流箱（${money(driftPay.min)}～${money(driftPay.max)}），位置會換，要自己找；每個整點有 10 分鐘「漂流潮」。西邊海上的公共蚵棚熟了會亮燈，靠近可以拉蚵串回碼頭賣`));
}
/** 靠近漂流箱：請伺服器判定（伺服器用自己知道的船／泳者位置），成功才入帳 */
function tickDrift(dt: number) {
  driftCd = Math.max(0, driftCd - dt);
  if (!D || !sea) return;
  for (const d of drifts) {
    const ph = t * DRIFT.bobHz + d.key * 1.3;
    sea.crate(d.x, PB.waterY + 0.02 + Math.sin(ph) * 0.07, d.z, d.key * 0.7 + Math.sin(ph * 0.4) * 0.3, Math.sin(ph * 0.8) * 0.08, Math.cos(ph * 0.9) * 0.08, !!d.gold);
  }
  if (mode === 'walk' || localOnly || driftBusy || driftCd > 0 || !net) return;
  const b = mode === 'boat' ? boats[myBoat] : null;
  const x = b ? b.x : mySwim.x, z = b ? b.z : mySwim.z;
  const n = nearestDrift(x, z, drifts);
  if (!n || n.dist > (n.box.gold ? (b ? DRIFT.goldBoatR : DRIFT.goldSwimR) : (b ? DRIFT.boatR : DRIFT.swimR))) return;
  const key = n.box.key;
  // 駕駛：先把最新位置送上去，伺服器才看得到我已經到了
  if (b && mySeat === 0) net.drive(b.id, b.x, b.z, b.h, b.v); else if (!b) net.swim(mySwim.x, mySwim.z, mySwim.h);
  driftBusy = true;
  void net.driftClaim(key).then(r => {
    driftBusy = false;
    if (r.ok && r.pay) {
      drifts = drifts.filter(d => d.key !== key);
      const bonus = r.bonus ?? 0;
      D?.grantMoney?.(r.pay + bonus, 'drift-box');
      if (bonus > 0 && driftCfg) driftCfg.bonusLeft = false;
      splash(n.box.x, n.box.z, r.gold ? 2.4 : 1.6); D?.sfx('launch');
      rewardToast(driftLabel(r.gold ? '拉上金色大箱子！' : '撈到漂流箱！', r.n ?? 1, bonus, !!r.gold), `+${money(r.pay + bonus)}`, 'mine', `drift:${key}`);
      driftCd = 1;
      return;
    }
    // 金箱子：一個人拉不動，要等別人一起拉（8 秒內）；每 1.5 秒再拉一次
    if (r.err === 'pull_more') {
      if (t - goldNoteT >= 2.5) { goldNoteT = t; toast(`金色大箱子太重了，要 ${r.need || 2} 個人一起拉（現在 ${r.n ?? 1} 人）`, '#ffd76a', 2); }
      driftCd = 1.5; return;
    }
    if (r.err === 'gold_cap') { toast('今天拉金色大箱子的次數用完了', '#ffb08a'); driftCd = 30; return; }
    if (r.err === 'gone') { drifts = drifts.filter(d => d.key !== key); return; }
    if (r.err === 'daily_cap') { if (!driftCapNoted) { driftCapNoted = true; toast('今天撈太多漂流箱了，明天再來', '#ffb08a'); } driftCd = 60; return; }
    // far／slow：位置還沒同步到，等一下再試
    driftCd = r.err === 'slow' ? 2 : 0.6;
  });
}
function forceAshore(msg: string) {
  if (!D) return;
  const b = boats[myBoat];
  if (b) b.seats = b.seats.map(c => (isMe(c) ? '' : c));
  restoreMe();
  D.walkPos.x = PB.shoreX + 1.2; D.walkPos.z = 0; D.setYaw(-Math.PI / 2);
  mode = 'walk'; myBoat = mySeat = -1; toast(msg, '#9fe0ff', 2);
  syncUi();
}
function onSeats(b: BoatDto, snap = false) {
  const s = boats[b.id]; if (!s) return;
  const me = myId();
  const before = s.seats.indexOf(me), after = b.seats.indexOf(me);
  s.seats = b.seats.slice();
  // 坐在船上的人一定不在水裡（從水裡爬上船時舊伺服器不會送 SwimEnd → 別人畫面上他一直泡在海底）
  for (const c of b.seats) if (c && !isMe(c) && swimmers.has(c) && !swimmers.get(c)!.fake) swimmers.delete(c);
  // 同一個人只會在一艘船上：別艘船上的舊座位清掉
  for (const o of boats) if (o !== s) for (let k = 0; k < o.seats.length; k++) if (o.seats[k] && b.seats.includes(o.seats[k]) && !isMe(o.seats[k])) o.seats[k] = '';
  const iDrive = mode === 'boat' && myBoat === b.id && mySeat === 0;
  if (!iDrive) {
    s.tx = b.x; s.tz = b.z; s.th = b.h; s.tv = b.v;
    if (snap || Math.hypot(s.x - b.x, s.z - b.z) > 8) { s.x = b.x; s.z = b.z; s.h = b.h; s.v = b.v; }
  }
  // 我被移出這艘（撞船由 BoatRam 處理；這裡處理伺服器主動清座位）
  if (before >= 0 && after < 0 && mode === 'boat' && myBoat === b.id && !busy) {
    if (!swimmers.has(me)) forceAshore('你已經不在船上了');
  }
}
function onPoses(p: BoatPosesDto) {
  const now = performance.now();
  for (const r of p.b) {
    const id = Number(r[0]); const s = boats[id]; if (!s || s.fake) continue;
    if (mode === 'boat' && myBoat === id && mySeat === 0) continue;
    s.tx = Number(r[1]); s.tz = Number(r[2]); s.th = Number(r[3]); s.tv = Number(r[4]); s.netT = now;
    if (Math.hypot(s.x - s.tx, s.z - s.tz) > 12) { s.x = s.tx; s.z = s.tz; s.h = s.th; }
  }
  for (const r of p.s) {
    const c = String(r[0]); if (isMe(c)) continue;
    const w = swimmers.get(c);
    if (w) { w.tx = Number(r[1]); w.tz = Number(r[2]); w.th = Number(r[3]); } else upsertSwim({ connId: c, x: Number(r[1]), z: Number(r[2]), h: Number(r[3]) }, true);
  }
}
function upsertSwim(s: SwimDto, snap: boolean) {
  if (isMe(s.connId)) return;
  // 在水裡就不在任何船上（落水／跳水的 BoatSeats 晚到也一樣）
  for (const b of boats) for (let k = 0; k < b.seats.length; k++) if (b.seats[k] === s.connId) b.seats[k] = '';
  const w = swimmers.get(s.connId);
  if (w) { w.tx = s.x; w.tz = s.z; w.th = s.h; if (snap) { w.x = s.x; w.z = s.z; w.h = s.h; } return; }
  swimmers.set(s.connId, { connId: s.connId, x: s.x, z: s.z, h: s.h, tx: s.x, tz: s.z, th: s.h });
  splash(s.x, s.z, 1);
}
function endSwim(connId: string) {
  if (isMe(connId)) return;
  swimmers.delete(connId);
}
function onRam(r: RamDto) {
  const tb = boats[r.target]; if (!D || !tb) return;
  splash(r.x, r.z, 2);
  D.sfx('hit');
  tb.v = tb.tv = 0; tb.sway = 1;
  // 對方船被撞得往外推一點（只是畫面，下一筆位置會校正）
  tb.x += r.ix * 0.8; tb.z += r.iz * 0.8;
  const me = myId();
  for (const k of r.knocked) {
    if (k.connId === me) {
      becomeSwimmer(k.x, k.z, k.h);
      toast(r.by === me ? '撞太猛，自己也掉下去了！' : `被 ${r.byNick || '別人'} 撞下水了！游回岸邊或等人救`, '#9fe0ff', 2.4);
    } else upsertSwim(k, true);
  }
  tb.seats = tb.seats.map(c => (r.knocked.some(k => k.connId === c) ? '' : c));
  if (r.by === me && r.knocked.length) toast(`撞翻了！${r.knocked.length} 人落水`, '#ffd23a', 1.6);
}
function onRescued(e: { boatId: number; seat: number; by: string }) {
  const b = boats[e.boatId]; if (!b || !D) return;
  b.seats[e.seat] = myId();
  mountMe(e.boatId, e.seat);
  toast(e.by ? `${e.by} 把你拉上船了` : '被拉上船了', '#9fe0ff', 1.6);
}

// ---------------- 自己上下船 ----------------
function ensureOwn() {
  if (own || !sea) return own;
  own = sea.makeOwnRaft();
  ownAnchors = SEATS.map(s => { const a = new THREE.Object3D(); a.position.set(s.x, s.y, s.z); own!.body.add(a); return a; });
  own.g.visible = false;
  return own;
}
function mountMe(id: number, seat: number) {
  if (!D) return;
  const rig = D.me(); const rf = ensureOwn(); if (!rf) return;
  swimmers.delete(myId());
  mode = 'boat'; myBoat = id; mySeat = seat; camSnap = true;
  if (rig) {
    ownAnchors[seat].add(rig.outer);
    rig.outer.position.set(0, 0, 0); rig.outer.rotation.set(0, 0, 0); rig.outer.visible = true;
  }
  D.sfx('dock');
  syncUi();
  driftHint();
}
function restoreMe() {
  const rig = D?.me();
  if (rig && D) {
    D.scene.attach(rig.outer);
    rig.outer.rotation.set(0, rig.outer.rotation.y, 0);
    posePlazaStand(rig);
    rig.handL.visible = rig.handR.visible = true;
  }
  if (own) own.g.visible = false;
}
function becomeSwimmer(x: number, z: number, h: number) {
  if (!D) return;
  const b = boats[myBoat];
  if (b) b.seats = b.seats.map(c => (isMe(c) ? '' : c));
  restoreMe();
  mode = 'swim'; myBoat = mySeat = -1; mySwim.x = x; mySwim.z = z; mySwim.h = h; camSnap = true;
  splash(x, z, 1.4); D.sfx('splash');
  syncUi();
}
function landAt(x: number, z: number, yaw: number) {
  if (!D) return;
  restoreMe();
  mode = 'walk'; myBoat = mySeat = -1;
  D.walkPos.x = x; D.walkPos.z = z; D.setYaw(yaw);
  D.sfx('dock');
  syncUi();
}

async function board(id: number, seat: number) {
  const b = boats[id]; if (!b || busy || !D) return;
  if (localOnly || b.fake) {
    if (seat === 0 && b.seats[0]) return;
    b.seats[seat] = myId(); mountMe(id, seat);
    if (localOnly && !localNoticed) { localNoticed = true; toastTop('海上同步還沒開放（伺服器未更新）：先只有你看得到自己的船'); }
    return;
  }
  busy = true; syncUi();
  const r = await net!.board(id, seat).finally(() => { busy = false; });
  if (!r.ok) {
    if (r.err === 'old_server') { localOnly = true; busy = false; return board(id, seat); }
    console.debug('boat board fail', r.err, JSON.stringify(r.boat), D.walkPos.x.toFixed(2), D.walkPos.z.toFixed(2));
    toast(ERR[r.err ?? ''] ?? '上不了船', '#ffb08a'); if (r.boat) onSeats(r.boat); syncUi(); return;
  }
  if (r.boat) onSeats(r.boat, true);
  mountMe(id, r.seat ?? seat);
  toast(mySeat === 0 ? '上船了！W／S 油門、A／D 轉向' : '上船了！坐穩了', '#9fe0ff', 1.6);
}
const ERR: Record<string, string> = {
  far: '離船太遠了', taken: '這艘已經有人在開了', full: '船上坐滿了', on_boat: '你已經在船上了', seated: '先站起來再上船', carrying: '抱著人不能上船',
  fast: '船開太快，等它慢下來', far_shore: '離岸太遠，靠近碼頭或岸邊再下船', not_near_land: '離岸太遠，靠近碼頭或岸邊再下船', bad_spot: '這裡站不住，換個位置下船', slow: '慢一點', no_seat: '船上沒有空位了',
};
async function leaveBoat() {
  const b = boats[myBoat]; if (!b || !D || busy) return;
  const spot = landSpot(b.x, b.z); if (!spot) { toast('靠近碼頭或岸邊再下船', '#ffb08a'); return; }
  const yaw = Math.atan2(-(spot.x - b.x), -(spot.z - b.z));
  if (mySeat === 0) { b.v = 0; b.tv = 0; }
  // 身上有蚵串：下船前先在碼頭賣掉
  if (!localOnly && !b.fake) await rackBeforeLeave();
  if (!boats[myBoat] || mode !== 'boat') return;
  if (localOnly || b.fake) { b.seats[mySeat] = ''; landAt(spot.x, spot.z, yaw); return; }
  // 駕駛下船前先把最後位置送上去（船就停在這裡）
  if (mySeat === 0) net!.drive(b.id, b.x, b.z, b.h, 0);
  busy = true;
  const r = await net!.leave(spot.x, spot.z).finally(() => { busy = false; });
  if (!r.ok) { toast(ERR[r.err ?? ''] ?? '下不了船', '#ffb08a'); return; }
  if (r.boat) onSeats(r.boat);
  landAt(spot.x, spot.z, yaw);
}
async function jumpIn() {
  if (mode !== 'boat' || !D || busy) return;
  const b = boats[myBoat]; if (!b) return;
  const [fx, fz] = fwd(b.h), sx = -fz, sz = fx;
  const side = mySeat % 2 ? 1 : -1;
  const x = b.x + sx * 2.2 * side, z = b.z + sz * 2.2 * side;
  if (localOnly || b.fake) { becomeSwimmer(x, z, b.h); return; }
  busy = true;
  const r = await net!.jump().finally(() => { busy = false; });
  if (!r.ok) { toast(ERR[r.err ?? ''] ?? '跳不下去', '#ffb08a'); return; }
  if (r.boat) onSeats(r.boat);
  rackSpill(r);
  const s = r.swim; becomeSwimmer(s?.x ?? x, s?.z ?? z, s?.h ?? b.h);
}
async function swimOut() {
  if (!D || busy) return;
  const spot = landSpot(mySwim.x, mySwim.z, 2.4); if (!spot) return;
  const yaw = Math.atan2(-(spot.x - mySwim.x), -(spot.z - mySwim.z));
  if (localOnly) { landAt(spot.x, spot.z, yaw); toast('上岸了，全身濕透', '#9fe0ff'); return; }
  busy = true;
  const r = await net!.swimOut(spot.x, spot.z).finally(() => { busy = false; });
  if (!r.ok) { toast(ERR[r.err ?? ''] ?? '爬不上去，再靠近一點', '#ffb08a'); return; }
  landAt(spot.x, spot.z, yaw); toast('上岸了，全身濕透', '#9fe0ff');
}
async function climbBoat(id: number) {
  const b = boats[id]; if (!b || busy) return;
  const seat = b.seats[0] ? freePassengerSeat(b.seats) : 0;
  if (seat < 0) return;
  if (localOnly || b.fake) { b.seats[seat] = myId(); mountMe(id, seat); return; }
  busy = true;
  const r = await net!.board(id, seat).finally(() => { busy = false; });
  if (!r.ok) { toast(ERR[r.err ?? ''] ?? '爬不上去', '#ffb08a'); return; }
  if (r.boat) onSeats(r.boat, true);
  mountMe(id, r.seat ?? seat);
}
async function rescue(connId: string) {
  const b = boats[myBoat]; if (!b || busy) return;
  const w = swimmers.get(connId); if (!w) return;
  const seat = freePassengerSeat(b.seats); if (seat < 0) { toast('船上沒有空位了', '#ffb08a'); return; }
  if (localOnly || w.fake) {
    swimmers.delete(connId); b.seats[seat] = connId; splash(w.x, w.z, 0.8); toast('拉上船了！', '#9fe0ff'); return;
  }
  busy = true;
  const r = await net!.rescue(connId).finally(() => { busy = false; });
  if (!r.ok) { toast(ERR[r.err ?? ''] ?? '拉不上來', '#ffb08a'); return; }
  swimmers.delete(connId);
  if (r.boat) onSeats(r.boat);
  toast('拉上船了！', '#9fe0ff');
}

function doPrompt() {
  const p = prompt; if (!p || busy || !D) return;
  if (p.kind === 'board') void board(p.boat!, 0);
  else if (p.kind === 'ride') void board(p.boat!, -1);
  else if (p.kind === 'leave') void leaveBoat();
  else if (p.kind === 'rescue') void rescue(p.conn!);
  else if (p.kind === 'climb') void climbBoat(p.boat!);
  else if (p.kind === 'out') void swimOut();
}

/** 鍵盤：回 true＝吃掉這個鍵。E＝上船／下船／救人／上岸、F＝丟殼、X＝跳水；在船上／水裡擋掉跳／蹲／躺 */
export function plazaBoatsKey(code: string): boolean {
  if (!D) return false;
  if (code === 'KeyE' && prompt && D.canAct()) { doPrompt(); return true; }
  if (mode === 'walk') return false;
  if (code === 'KeyF' && mode === 'boat') { throwFromBoat(); return true; }
  if (code === 'KeyX' && mode === 'boat') { void jumpIn(); return true; }
  if (code === 'KeyR' && mode === 'boat') { rackKey(code); return true; }
  // T＝抽一口：在船上交給吸菸模組（游泳時吞掉）
  if (code === 'KeyT') return mode === 'swim';
  return code === 'Space' || code === 'KeyC' || code === 'KeyZ' || code === 'KeyG' || code === 'KeyE' || code === 'KeyR';
}

// ---------------- 丟殼 ----------------
function myHead(out: THREE.Vector3) {
  const rig = D?.me();
  if (rig) { rig.head.getWorldPosition(out); return out; }
  const b = boats[myBoat]; return out.set(b?.x ?? 0, PB.waterY + 1.6, b?.z ?? 0);
}
function throwFromBoat() {
  if (!D || mode !== 'boat' || throwCd > 0) return;
  const b = boats[myBoat]; if (!b) return;
  const from = myHead(new THREE.Vector3()); from.y += 0.15;
  // 瞄準：鏡頭前方 ±40°、18 m 內最近的人（船上、水裡、岸上都算）
  const [fx, fz] = fwd(b.h);
  let best: { connId: string; nick: string; p: THREE.Vector3 } | null = null, bestD = 18;
  for (const r of D.view()?.remoteList() ?? []) {
    if (r.isNpc) continue;
    const h = D.view()?.remoteHead(r.connId); if (!h) continue;
    const dx = h.x - from.x, dz = h.z - from.z, d = Math.hypot(dx, dz);
    if (d < 1 || d > bestD) continue;
    if ((dx * fx + dz * fz) / d < Math.cos(0.7)) continue;
    best = { connId: r.connId, nick: r.nick, p: new THREE.Vector3(h.x, h.y, h.z) }; bestD = d;
  }
  const to = best ? best.p : new THREE.Vector3(b.x + fx * 9, PB.waterY + 0.1, b.z + fz * 9);
  if (!D.throwShell(from, best ? { connId: best.connId, nick: best.nick } : null, to)) return;
  throwCd = 0.45; throwAnim = 0.45;
  if (!best) later(0.6, () => splash(to.x, to.z, 0.5));
}
const timers: { t: number; f: () => void }[] = [];
function later(s: number, f: () => void) { timers.push({ t: s, f }); }

/** 被殼打中（本機或遠端）：那個人和他的船晃一下 */
export function plazaBoatsSway(connId: string) {
  if (!D) return;
  if (isMe(connId) && mode === 'boat') { mySway = 1; const b = boats[myBoat]; if (b) b.sway = Math.max(b.sway, 0.6); return; }
  for (const b of boats) if (b.seats.includes(connId)) { b.sway = Math.max(b.sway, 0.6); swayConn.set(connId, 1); }
}
const swayConn = new Map<string, number>();

// ---------------- 水花 ----------------
function splash(x: number, z: number, k: number) {
  const fx = sea?.fx; if (!fx) return;
  const n = Math.round(6 + 6 * k);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; fx.spawn(x, z, { vx: Math.cos(a) * 2.4 * k, vz: Math.sin(a) * 2.4 * k, vy: 3 + Math.random() * 2.5 * k, y: PB.waterY + 0.2, life: 0.8, s0: 0.35, s1: 1.1, a: 0.7 }); }
  fx.spawn(x, z, { life: 1.1, s0: 0.8, s1: 2.6 * k + 1, a: 0.5 });
}
function wake(b: BoatSt) {
  const fx = sea?.fx; if (!fx || Math.abs(b.v) < 0.8) return;
  const [ffx, ffz] = fwd(b.h), sx = Math.cos(b.h), sz = -Math.sin(b.h), k = Math.min(1, Math.abs(b.v) / PB.maxSpd);
  fx.spawn(b.x - ffx * 2.6, b.z - ffz * 2.6, { vx: -ffx * 1.2, vz: -ffz * 1.2, life: 1.6, s0: 0.7, s1: 2.4 + k, a: 0.32 * k + 0.1 });
  for (const sg of [1, -1]) fx.spawn(b.x + ffx * 1.6 + sx * sg * 0.9, b.z + ffz * 1.6 + sz * sg * 0.9, { vx: sx * sg * 1.6, vz: sz * sg * 1.6, life: 1.2, s0: 0.4, s1: 1.6, a: 0.22 * k });
}

// ---------------- 每幀 ----------------
function input() {
  const k = (c: string) => (walkKeys.has(c) ? 1 : 0);
  let thr = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
  let steer = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
  if (Math.abs(joy.y) > 0.15) thr = -joy.y;
  if (Math.abs(joy.x) > 0.12) steer = joy.x;
  return { thr: Math.max(-1, Math.min(1, thr)), steer: Math.max(-1, Math.min(1, steer)) };
}

/** 主迴圈每幀呼叫（在廣場、不論在不在船上）；cam＝目前畫面用的相機（判斷遠近 LOD） */
export function tickPlazaBoats(dt: number, cam: THREE.Camera) {
  if (!D || !sea) return;
  dt = Math.min(dt, 0.1); t += dt;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].f; timers.splice(i, 1); f(); } }
  ramCd = Math.max(0, ramCd - dt); throwCd = Math.max(0, throwCd - dt); throwAnim = Math.max(0, throwAnim - dt); mySway = Math.max(0, mySway - dt / PB.swayT);
  const me = myId();
  const { thr, steer } = mode !== 'walk' ? input() : { thr: 0, steer: 0 };

  // 1) 船的位置：我開的＝本機物理；別人的＝內插＋航位推算；假船＝繞圈
  const kk = 1 - Math.exp(-8 * dt);
  for (const b of boats) {
    b.sway = Math.max(0, b.sway - dt / PB.swayT); b.bumpT = Math.max(0, b.bumpT - dt);
    if (mode === 'boat' && b.id === myBoat && mySeat === 0) {
      const v0 = b.v;
      stepPlazaBoat(b, thr, steer, dt, rackSlow(b.id));
      b.steer += (steer - b.steer) * Math.min(1, dt * 6);
      if ((pushStatic(b) || rackPush(b)) && Math.abs(v0) > 1.5 && b.bumpT <= 0) { b.bumpT = 0.4; D.sfx('bump'); const [fx, fz] = fwd(b.h); splash(b.x + fx * 2, b.z + fz * 2, 0.6); }
      for (const o of boats) {
        if (o === b) continue;
        if (Math.abs(o.x - b.x) > 7 || Math.abs(o.z - b.z) > 7) continue;
        const hit = pushFromBoat(b, o);
        if (!hit) continue;
        if (b.bumpT <= 0) {
          b.bumpT = 0.45; o.sway = Math.max(o.sway, 0.5);
          const [p] = hullPts(b); splash((p[0] + o.x) / 2, (p[1] + o.z) / 2, Math.min(1.6, 0.5 + Math.abs(v0) / 4));
          D.sfx('bump');
          // 撞得夠猛、對方船上有人：請伺服器判定落水
          if (isHardRam(v0) && ramCd <= 0 && !boatEmpty(o.seats)) {
            ramCd = PB.ramCd;
            if (localOnly || o.fake) fakeRam(b, o, hit.ux, hit.uz);
            else void net!.ram(b.id, o.id).then(r => { if (!r.ok && r.err !== 'slow') console.debug('ram', r.err); else rackSpill(r); });
          }
        }
        b.v *= PB.bump;
      }
      driveAcc += dt;
      if (driveAcc >= 1 / PB.driveHz && !localOnly) { driveAcc = 0; net?.drive(b.id, b.x, b.z, b.h, b.v); }
    } else if (b.fake) {
      const f = b.fake; f.t += dt;
      const a = f.t * 0.22;
      b.x = f.cx + Math.cos(a) * f.r; b.z = f.cz + Math.sin(a) * f.r; b.h = Math.PI - a; b.v = 0.22 * f.r;
      b.steer = 0.4;
    } else {
      // 航位推算：目標跟著回報速度往前走（最多 0.6 秒）
      const age = Math.min(0.6, (performance.now() - b.netT) / 1000);
      const [fx, fz] = fwd(b.th);
      const gx = b.tx + fx * b.tv * (b.netT ? age : 0), gz = b.tz + fz * b.tv * (b.netT ? age : 0);
      b.x += (gx - b.x) * kk; b.z += (gz - b.z) * kk;
      let dh = b.th - b.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.steer += (Math.max(-1, Math.min(1, -dh * 3)) - b.steer) * Math.min(1, dt * 4);
      b.h += dh * kk; b.v += (b.tv - b.v) * kk;
    }
    const bob = boatBob(b.x, b.z, t, b.v, b.sway);
    b.y = bob.y; b.rx = bob.rx; b.rz = bob.rz;
    b.wakeT -= dt;
    if (b.wakeT <= 0) { b.wakeT = 0.07; if (Math.abs(b.v) > 0.8 && Math.hypot(b.x - cam.position.x, b.z - cam.position.z) < 60) wake(b); }
  }
  // 別人互撞：畫面上兩艘靠得很近、相對速度快就噴水花（每個人都看得到）
  splashT -= dt;
  if (splashT <= 0) {
    splashT = 0.2;
    for (let i = 0; i < boats.length; i++) for (let j = i + 1; j < boats.length; j++) {
      const a = boats[i], c = boats[j];
      if ((mode === 'boat' && mySeat === 0 && (a.id === myBoat || c.id === myBoat))) continue;
      if (Math.abs(a.x - c.x) > 4.2 || Math.abs(a.z - c.z) > 4.2) continue;
      if (Math.abs(a.v) + Math.abs(c.v) < 2.5 || Math.hypot(a.x - c.x, a.z - c.z) > 3.4) continue;
      if (a.bumpT > 0 || c.bumpT > 0) continue;
      a.bumpT = c.bumpT = 0.8; a.sway = Math.max(a.sway, 0.5); c.sway = Math.max(c.sway, 0.5);
      splash((a.x + c.x) / 2, (a.z + c.z) / 2, 1);
    }
  }

  // 2) 游泳
  if (mode === 'swim') {
    stepSwim(mySwim, thr, steer, dt);
    mySwimK += ((Math.abs(thr) > 0.05 ? 1 : 0) - mySwimK) * Math.min(1, dt * 3);
    for (const b of boats) { const dx = mySwim.x - b.x, dz = mySwim.z - b.z, d = Math.hypot(dx, dz); if (d < 1.5 && d > 1e-3) { mySwim.x = b.x + dx / d * 1.5; mySwim.z = b.z + dz / d * 1.5; } }
    swimAcc += dt;
    if (swimAcc >= 1 / PB.swimHz && !localOnly) { swimAcc = 0; net?.swim(mySwim.x, mySwim.z, mySwim.h); }
    if ((thr || steer) && Math.random() < dt * 6) { const [fx, fz] = fwd(mySwim.h); sea.fx.spawn(mySwim.x - fx * 0.6, mySwim.z - fz * 0.6, { life: 0.9, s0: 0.3, s1: 1.1, a: 0.3 }); }
  }
  for (const w of swimmers.values()) {
    if (w.fake) continue;
    const ox = w.x, oz = w.z;
    w.x += (w.tx - w.x) * kk; w.z += (w.tz - w.z) * kk;
    const mv = dt > 0 ? Math.hypot(w.x - ox, w.z - oz) / dt : 0;
    w.k = (w.k ?? 0) + ((mv > 0.35 ? 1 : 0) - (w.k ?? 0)) * Math.min(1, dt * 3);
    let dh = w.th - w.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); w.h += dh * kk;
  }

  // 3) 畫：5 艘 instanced（我在的那艘用完整模型）＋船頭燈
  sea.begin();
  for (const b of boats) {
    const mine = mode === 'boat' && b.id === myBoat;
    if (mine && own) {
      own.g.visible = true;
      own.g.position.set(b.x, b.y, b.z); own.g.rotation.set(b.rx, b.h, b.rz + mySway * Math.sin(t * 14) * 0.08);
      own.prop.rotation.z += b.v * 0.12;
      own.motor.rotation.y += (b.steer * 0.4 - own.motor.rotation.y) * 0.2;
    } else {
      const far = Math.hypot(b.x - cam.position.x, b.z - cam.position.z) > PB.lodFar;
      sea.put(b.x, b.y, b.z, b.h, b.rx, b.rz, far);
    }
    if (b.seats[0]) sea.headlight(b.x, b.z, b.h);
  }
  if (own && !(mode === 'boat')) own.g.visible = false;
  tickDrift(dt);
  tickRacks(dt, cam);
  sea.end();
  sea.tick(t, dt);

  // 4) 人：遠端坐船／游泳交給 worldView；自己在船上用 poseRider
  const view = D.view();
  // 在船上／水裡：遠處的人和船都不隱形（回岸上恢復一般視距裁剪）
  view?.setSeaView(seaViewForce ?? mode !== 'walk');
  const now = new Set<string>();
  for (const b of boats) {
    for (let s = 0; s < PB.seats; s++) {
      const c = b.seats[s]; if (!c || c === me) continue;
      seatWorld(b, s, _v);
      const sw = swayConn.get(c) ?? 0;
      const m = { x: _v.x, y: _v.y, z: _v.z, yaw: b.h, pose: SEATS[s].pose, steer: s === 0 ? b.steer : 0, sway: sw, rx: b.rx, rz: b.rz };
      if (fakeRigs.has(c)) placeFake(c, m);
      else if (view) { view.setRemoteMount(c, m); now.add(c); }
    }
  }
  for (const w of swimmers.values()) {
    const m = { x: w.x, y: PB.waterY, z: w.z, yaw: w.h, pose: 'swim' as const, swim: swimForce ?? (w.fake ? 0 : w.k ?? 0) };
    if (fakeRigs.has(w.connId)) placeFake(w.connId, m);
    else if (view) { view.setRemoteMount(w.connId, m); now.add(w.connId); }
  }
  for (const [c, v] of swayConn) { const n = v - dt / PB.swayT; if (n <= 0) swayConn.delete(c); else swayConn.set(c, n); }
  for (const c of mounted) if (!now.has(c)) view?.setRemoteMount(c, null);
  mounted.clear(); for (const c of now) mounted.add(c);
  for (const [c, r] of fakeRigs) if (!boats.some(b => b.seats.includes(c)) && !swimmers.has(c)) { r.outer.removeFromParent(); fakeRigs.delete(c); }

  const rig = D.me();
  if (rig && mode === 'boat') {
    const b = boats[myBoat];
    const pr = poseRider(rig, SEATS[mySeat].pose, t, { steer: mySeat === 0 ? b.steer : 0, sway: mySway, throwK: throwAnim > 0 ? 1 - throwAnim / 0.45 : 0, smoke: D.smoke?.() ?? null });
    rig.outer.position.set(0, pr.dy, 0); rig.outer.rotation.set(pr.rx, 0, 0); rig.outer.visible = true;
    D.walkPos.set(b.x, 1.55, b.z);
  } else if (rig && mode === 'swim') {
    const pr = poseRider(rig, 'swim', t, { swim: swimForce ?? mySwimK });
    rig.outer.position.set(mySwim.x, PB.waterY + pr.dy, mySwim.z); rig.outer.rotation.order = 'YXZ'; rig.outer.rotation.set(pr.rx, mySwim.h, 0); rig.outer.visible = true;
    D.walkPos.set(mySwim.x, 1.55, mySwim.z);
  }

  // 定期對帳（每 15 秒，便宜）：修掉漏收事件造成的「人還在海底／船上沒人」
  resyncT += dt;
  if (resyncT >= 15) { resyncT = 0; if (!localOnly) void net?.resync(); }
  tickDockInd(cam);

  // 5) 提示按鈕
  prompt = D.canAct() || mode !== 'walk' ? findPrompt() : null;
  syncUi();
  if (mode === 'boat' && mySeat === 0) {
    const b = boats[myBoat];
    note(localOnly ? '只有你看得到（伺服器未更新）' : Math.abs(b.v) >= PB.ramSpeed ? '全速：撞到有人的船會把人撞下水' : '');
  } else if (mode === 'swim') note('游回碼頭或岸邊，或游到慢下來的船旁邊');
  else note('');
}
const _dp = new THREE.Vector3();
let dockShown = false;
/** 碼頭指示：在船上／水裡、碼頭不在畫面內或還很遠 → 畫面邊緣箭頭＋距離 */
function tickDockInd(cam: THREE.Camera) {
  if (!ui) return;
  let show = false;
  if (mode !== 'walk') {
    const me = mode === 'boat' ? boats[myBoat] : mySwim;
    if (me) {
      const p = pierNearest(me.x, me.z);
      const dist = Math.hypot(me.x - p.x, me.z - p.z);
      _dp.set(p.x, 0.4, p.z).project(cam);
      const W = window.innerWidth, H = window.innerHeight;
      const e = dockEdge(_dp.x, _dp.y, _dp.z > 1, W, H, dist, dockInsets(W, H));
      if (e) {
        show = true;
        ui.dock.style.transform = `translate(${e.x.toFixed(0)}px,${e.y.toFixed(0)}px)`;
        ui.dockArrow.style.transform = `rotate(${e.deg.toFixed(0)}deg)`;
        const lbl = `${Math.round(dist)} m`;
        if (ui.dockLbl.textContent !== lbl) ui.dockLbl.textContent = lbl;
      }
    }
  }
  if (show !== dockShown) { dockShown = show; ui.dock.classList.toggle('on', show); }
}
/** 指示器要避開的邊（px）：手機橫放時下緣左邊搖桿、右邊按鈕都很高 */
function dockInsets(W: number, H: number) {
  const short = H <= 500;
  // 下緣中間只有「下船」鈕（碼頭附近才出現，那時指示已收起），可以壓低；左下搖桿、右下按鈕欄另外避開
  return { l: 40, r: 40, t: short ? 92 : 110, b: short ? 64 : 90, bl: [short ? 190 : 230, short ? 150 : 200] as const, br: [short ? 150 : 170, short ? 258 : 310] as const };
}
function seatWorld(b: BoatSt, s: number, out: THREE.Vector3) {
  _o.position.set(b.x, b.y, b.z); _e.set(b.rx, b.h, b.rz); _o.quaternion.setFromEuler(_e); _o.updateMatrix();
  return out.set(SEATS[s].x, SEATS[s].y, SEATS[s].z).applyMatrix4(_o.matrix);
}
function findPrompt(): Prompt | null {
  if (!D) return null;
  if (mode === 'walk') {
    const p = D.walkPos; let best: BoatSt | null = null, bd: number = PB.boardR;
    // 伺服器量船中心（4.6 m）；這裡略嚴，免得按了被拒
    for (const b of boats) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd) { bd = d; best = b; } }
    if (!best) return null;
    if (!best.seats[0]) return { kind: 'board', label: '上船開', boat: best.id };
    if (freePassengerSeat(best.seats) >= 0) return { kind: 'ride', label: '搭這艘', boat: best.id };
    return { kind: 'full', label: '船上坐滿了', boat: best.id };
  }
  if (mode === 'boat') {
    const b = boats[myBoat]; if (!b) return null;
    if (Math.abs(b.v) <= PB.rescueMaxV && freePassengerSeat(b.seats) >= 0) {
      let bw: SwimSt | null = null, bd: number = PB.rescueR;
      for (const w of swimmers.values()) { const d = Math.hypot(w.x - b.x, w.z - b.z); if (d < bd) { bd = d; bw = w; } }
      if (bw) return { kind: 'rescue', label: '拉人上船', conn: bw.connId };
    }
    if (distToLand(b.x, b.z) <= PB.landR - 1.2 && Math.abs(b.v) < 2.5) return { kind: 'leave', label: '下船', boat: b.id };
    return null;
  }
  // 游泳
  if (distToLand(mySwim.x, mySwim.z) <= PB.climbR) return { kind: 'out', label: '爬上岸' };
  for (const b of boats) {
    if (Math.abs(b.v) > PB.rescueMaxV) continue;
    if (Math.hypot(b.x - mySwim.x, b.z - mySwim.z) > PB.rescueR) continue;
    if (b.seats[0] && freePassengerSeat(b.seats) < 0) continue;
    return { kind: 'climb', label: '爬上船', boat: b.id };
  }
  return null;
}

/** 在船上／水裡：追船鏡頭（取代第三人稱走路鏡頭） */
export function plazaBoatsCam(cam: THREE.PerspectiveCamera, dt: number) {
  if (!D || mode === 'walk') return false;
  const b = mode === 'boat' ? boats[myBoat] : null;
  const x = b ? b.x : mySwim.x, z = b ? b.z : mySwim.z, h = b ? b.h : mySwim.h;
  const [fx, fz] = fwd(h);
  const back = (b ? 7.6 : 4.6) * camFront, up = (b ? 4.4 : 2.6) * Math.abs(camFront);
  const tx = x - fx * back, tz = z - fz * back, ty = up + (b ? Math.sin(t * 2.1) * 0.05 : 0);
  const k = camSnap ? 1 : 1 - Math.exp(-4.5 * dt);
  camPos.x += (tx - camPos.x) * k; camPos.z += (tz - camPos.z) * k; camPos.y += (ty - camPos.y) * k;
  // 鏡頭不要穿進碼頭木板底下
  if (camPos.y < 0.8) camPos.y = 0.8;
  const lx = x + fx * (b ? 5 : 3) * Math.sign(camFront), lz = z + fz * (b ? 5 : 3) * Math.sign(camFront), ly = PB.waterY + (b ? 0.9 : 0.4);
  if (camSnap) camLook.set(lx, ly, lz); else camLook.lerp(_v.set(lx, ly, lz), k);
  camSnap = false;
  cam.position.copy(camPos); cam.lookAt(camLook);
  if (cam.fov !== 58) { cam.fov = 58; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  return true;
}

/** 夜晚：海面月光、碼頭燈、船頭燈、夜光藻航跡 */
export function plazaBoatsNight(k: number, sky: THREE.Color) { sea?.setNight(k, sky); }
export function plazaBoatsFog(f: THREE.Fog) { sea?.setFog(f); }

// ---------------- 測試／除錯 ----------------
function placeFake(c: string, m: { x: number; y: number; z: number; yaw: number; pose: 'drive' | 'sit' | 'deck' | 'swim'; steer?: number; sway?: number; rx?: number; rz?: number; swim?: number }) {
  const r = fakeRigs.get(c); if (!r) return;
  // 除錯：假乘客抽菸（每 6 秒抽一口），看船上抽菸姿勢用
  const smoke = fakeSmoke && m.pose !== 'swim' ? { puffK: Math.max(0, Math.sin(t * 1.05)) ** 2 } : null;
  const pr = poseRider(r, m.pose, t, { steer: m.steer, sway: m.sway, smoke, swim: m.swim });
  if (smoke) ensurePlazaSmokeCig(r, true); else if (getPlazaSmokeCig(r)) clearPlazaSmokeCig(r);
  r.outer.position.set(m.x, m.y + pr.dy, m.z); r.outer.rotation.order = 'YXZ'; r.outer.rotation.set(pr.rx + (m.rx ?? 0), m.yaw, m.rz ?? 0);
}
function fakeRig(c: string) {
  if (!D || fakeRigs.has(c)) return;
  const { M, add } = makeMeshHelpers(D.scene, D.coarse);
  const rig = makePlayerAvatar({ shirt: 0x3a7ab8, hair: 0x222222, pants: 0x2a2a40 }, M, add, false);
  D.scene.add(rig.outer); fakeRigs.set(c, rig);
}
function fakeRam(b: BoatSt, o: BoatSt, ux: number, uz: number) {
  const knocked: SwimDto[] = [];
  o.seats.forEach((c, i) => { if (!c) return; const p = knockSpot(o, ux, uz, i); knocked.push({ connId: c, x: p.x, z: p.z, h: o.h }); });
  for (const k of knocked) if (fakeRigs.has(k.connId) || isMe(k.connId)) { /* 假人／自己 */ }
  onRam({ by: myId(), byNick: D?.myNick() ?? '', fromBoat: b.id, target: o.id, x: (b.x + o.x) / 2, z: (b.z + o.z) / 2, ix: ux, iz: uz, knocked });
  for (const k of knocked) { const w = swimmers.get(k.connId); if (w && fakeRigs.has(k.connId)) w.fake = true; }
  if (o.fake) o.fake = undefined;
}
let fakeN = 0, fakeSmoke = false;
/** 除錯：強制游泳姿勢（0＝踩水、1＝自由式；null＝照實際速度） */
let swimForce: number | null = null;
/** 量效能用：強制海上視野開／關（null＝照規則） */
let seaViewForce: boolean | null = null;
/** 除錯：追船鏡頭倍率（負＝從船頭往回看，看自己／乘客的姿勢） */
let camFront = 1;
export const plazaBoatsDbg = {
  /** 傳送到碼頭口（站在碼頭上，旁邊就是船） */
  tpDock() {
    if (!D) return 'closed';
    if (mode !== 'walk') forceAshore('傳送到碼頭');
    // 站到最靠碼頭口、還沒人開的那艘旁邊（碼頭上）
    let best: BoatSt | null = null, bd = 1e9;
    for (const b of boats) { if (b.seats[0] || Math.abs(b.z) > 6 || b.x < PB.pierX1 || b.x > PB.pierX0) continue; const d = PB.pierX0 - b.x; if (d < bd) { bd = d; best = b; } }
    D.walkPos.x = best ? best.x : -28; D.walkPos.z = best ? Math.sign(best.z) * 0.7 : 0;
    D.setYaw(best ? (best.z < 0 ? 0 : Math.PI) : Math.PI / 2);
    return best ? `boat ${best.id}` : 'ok';
  },
  /** 直接坐上第 i 艘（預設 0）駕駛座 */
  board(i = 0) { void board(i, 0); return 'ok'; },
  /** 生一艘假的遠端船（有假駕駛＋乘客，在碼頭外繞圈） */
  spawnBoat(i = PB.count - 1, riders = 2) {
    const b = boats[i]; if (!b || !D) return 'no boat';
    const cx = -60, cz = 14 - (fakeN % 3) * 14;
    b.fake = { t: 0, r: 12, cx, cz }; b.seats = ['', '', '', ''];
    for (let s = 0; s < Math.min(PB.seats, riders); s++) { const c = `dbg-${++fakeN}`; fakeRig(c); b.seats[s] = c; }
    return `boat ${i} @ (${cx},${cz})`;
  },
  /** 在自己附近生一個假的落水者（可練習拉人上船） */
  spawnSwimmer() {
    if (!D) return 'closed';
    const p = mode === 'boat' ? boats[myBoat] : mode === 'swim' ? mySwim : { x: -32, z: 6, h: 0 };
    const c = `dbg-${++fakeN}`; fakeRig(c);
    swimmers.set(c, { connId: c, x: p.x + 2.2, z: p.z + 1.2, h: 0, tx: p.x + 2.2, tz: p.z + 1.2, th: 0, fake: true });
    splash(p.x + 2.2, p.z + 1.2, 1);
    return c;
  },
  /** 強制撞船：自己在船上＝假裝被撞下水；不然撞翻最近一艘有假人的船 */
  ram() {
    if (!D) return 'closed';
    if (mode === 'boat') {
      const b = boats[myBoat];
      const [fx, fz] = fwd(b.h);
      if (localOnly) { fakeRam({ ...b, id: -1 } as BoatSt, b, -fz, fx); return 'local ram'; }
      // 線上：真的跳水（伺服器知道），畫面上演撞船
      splash(b.x, b.z, 2); D.sfx('hit');
      void jumpIn().then(() => toast('被撞下水了！（測試）', '#9fe0ff', 2));
      return 'jump';
    }
    const o = boats.find(b => b.fake && !boatEmpty(b.seats)); if (!o) return 'no fake boat';
    fakeRam({ ...o, id: -1 } as BoatSt, o, 1, 0);
    return 'ok';
  },
  state() {
    return { mode, myBoat, mySeat, localOnly, supported: net?.supported() ?? null, boats: boats.map(b => ({ id: b.id, x: +b.x.toFixed(1), z: +b.z.toFixed(1), v: +b.v.toFixed(1), seats: b.seats.filter(Boolean).length })), swimmers: [...swimmers.keys()], prompt: prompt?.label ?? null, sea: sea?.stats() };
  },
  /** 漂流箱：目前位置；把最近一個拉到自己旁邊（只改畫面，伺服器判定照舊） */
  drift() { return { boxes: drifts.map(d => ({ key: d.key, x: +d.x.toFixed(1), z: +d.z.toFixed(1), gold: !!d.gold, tide: !!d.tide })), pay: driftPay, hinted: driftHinted, tideUntil: driftCfg?.tideUntil ?? 0, nextTideAt: driftCfg?.nextTideAt ?? 0, bonusLeft: driftCfg?.bonusLeft ?? null }; },
  /** 假乘客／假駕駛抽菸（看姿勢用） */
  smoke(on = true) { fakeSmoke = on; return 'ok'; },
  swimK(k: number | null = null) { swimForce = k; return 'ok'; },
  /** 海上視野：遠處小人數、遠距仍畫本體數 */
  cam(k = 1) { camFront = k || 1; return 'ok'; },
  seaView(force?: boolean | null) { if (force !== undefined) seaViewForce = force; return D?.view()?.seaViewStats() ?? null; },
  night(k: number) { sea?.setNight(k, new THREE.Color(0x1d3557)); return 'ok'; },
  /** 蚵棚：racks.list()／cargo()／near()／haul()／sell()／place()／panel()／up(line)／ui() */
  racks: rackDbg,
  /** 自己開的船分段開到某座蚵棚旁（伺服器一次最多跳 14 m，所以每 0.15 秒跳 12 m） */
  tpRack(id: number, side = 2.9) {
    const b = boats[myBoat]; if (!b || mode !== 'boat' || mySeat !== 0) return 'not driving';
    const r = rackDbg.list().find(x => x.id === id); if (!r) return 'no rack';
    const raw = (rackDbg as any)._raw?.(id) as { h: number } | undefined;
    const h = raw?.h ?? 0;
    // 架子長邊沿 (cos h, −sin h)；停在寬邊外 side 公尺，船頭跟架子平行
    const tx = r.x + Math.sin(h) * side, tz = r.z + Math.cos(h) * side;
    const go = () => {
      const bb = boats[myBoat]; if (!bb || mode !== 'boat') return;
      const dx = tx - bb.x, dz = tz - bb.z, d = Math.hypot(dx, dz), k = Math.min(1, 12 / Math.max(d, 1e-6));
      bb.x += dx * k; bb.z += dz * k; bb.h = h + Math.PI / 2; bb.v = 0; bb.tv = 0;
      if (!localOnly) net?.drive(bb.id, bb.x, bb.z, bb.h, 0);
      if (k < 1) later(0.15, go);
    };
    go();
    return `→ (${tx.toFixed(1)},${tz.toFixed(1)})`;
  },
  /** 走路時傳送到某點（碼頭上） */
  tp(x: number, z: number, yaw?: number) { if (!D || mode !== 'walk') return 'not walking'; D.walkPos.x = x; D.walkPos.z = z; if (yaw != null) D.setYaw(yaw); return 'ok'; },
  /** 自己開的船直接擺到某處（測試撞船／救人；伺服器一次最多跳 14 m） */
  place(x: number, z: number, h: number, v = 0) {
    const b = boats[myBoat]; if (!b || mode !== 'boat' || mySeat !== 0) return 'not driving';
    b.x = x; b.z = z; b.h = h; b.v = v; if (!localOnly) net?.drive(b.id, x, z, h, v); return 'ok';
  },
  /** 自己的位置（船／游泳／走路） */
  me() { const b = boats[myBoat]; return mode === 'boat' && b ? { mode, x: b.x, z: b.z, h: b.h, v: b.v, seat: mySeat, id: b.id } : mode === 'swim' ? { mode, ...mySwim } : { mode, x: D?.walkPos.x, z: D?.walkPos.z }; },
  /** 量效能用：整片海（含夜燈）先藏起來 */
  hide(on = true) { if (sea) sea.group.visible = !on; if (own) own.g.visible = !on && mode === 'boat'; return 'ok'; },
  /** 量效能用：整片海的夜燈（光池／光暈／光錐）開關 */
  lights(on = true) { if (sea) for (const n of ['plazaSeaGlows', 'plazaSeaPools', 'plazaBoatCones']) { const o = sea.group.getObjectByName(n); if (o) o.visible = on; } return 'ok'; },
};
