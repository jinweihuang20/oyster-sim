/**
 * 巡蚵棚收成（客戶端）：畫蚵棚、拉蚵串、船貨、回碼頭賣、私人蚵棚（放置／偷拉警告／升級）。
 * 所有判定在伺服器（PlazaWorld.Racks.cs）；這裡只負責畫面、按鈕、提示。駕駛、乘客都能拉／放／升級／賣（船貨算拉的人）。
 */
import * as THREE from 'three';
import { toast, toastTop } from '../../ui/dom';
import { rewardToast } from '../../ui/rewardToast';
import { PB, distToLand, pierNearest, hullPts } from './boatLogic';
import type { PlazaSea } from './boatScene';
import type { BoatNet } from './boatNet';
import {
  RACK, RACK_DRAW, RACK_PUSH_AABB, pickDrawnRacks, UP_LINES, UP_MAX, planUpTap, isMine, isPrivate, loadSlow, nearestRack, pushFromRack, rackNextSec, rackNow, rackRipe, rackCooling, rackAgePct, fmtWait, ripeViewR, stealFine, upCost,
  type RackDto, type RackSnap,
} from './rackLogic';
import { RACK_BEACON, RACK_RADAR, rackBeaconState, rackRadarCovered, buildRadarMarks, paintRackRadar } from './rackRadar';
import { beyondFogFar, fogDrawRange } from '../fogCull';

export type RackBoat = { id: number; x: number; z: number; h: number; v: number };
export type RackCtx = {
  net: () => BoatNet | null;
  sea: () => PlazaSea | null;
  /** 目前場景霧遠平面（公尺）；沒有就不当裁剪 */
  fogFar?: () => number;
  /** 我在船上：那艘船（不在船上＝null）、座位 */
  myBoat: () => RackBoat | null;
  mySeat: () => number;
  localOnly: () => boolean;
  splash: (x: number, z: number, k: number) => void;
  sfx: (k: 'splash' | 'bump' | 'hit' | 'dock' | 'launch' | 'warn') => void;
  grantMoney?: (n: number, via: string) => void;
  getMoney?: () => number;
  spendMoney?: (n: number, via: string) => boolean;
  /** 偷拉罰款：有多少扣多少，回實際扣的 */
  fineMoney?: (n: number, via: string) => number;
  /** 雜貨店買的蚵棚組合包（存檔） */
  kits?: () => number;
  addKits?: (d: number) => void;
};

const ICON = {
  haul: '<svg viewBox="0 0 24 24"><path d="M12 3v11"/><path d="M8 7l4-4 4 4"/><path d="M7 15c0 3 2 5 5 5s5-2 5-5"/><circle cx="9" cy="16" r="1.2"/><circle cx="15" cy="16" r="1.2"/></svg>',
  sell: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="2.6"/><path d="M7 4h10"/></svg>',
  place: '<svg viewBox="0 0 24 24"><path d="M4 9h16M6 9v11M12 9v11M18 9v11"/><path d="M12 2v4M10 4h4"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 20V6M6 12l6-6 6 6"/><path d="M5 21h14"/></svg>',
  cargo: '<svg viewBox="0 0 24 24"><path d="M5 9h14l-1.5 10h-11z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

let C: RackCtx | null = null;
let racks: RackDto[] = [];
let me = '';
let off = 0; // 伺服器時間 − 本機時間
let cfg = { price: 200, kgPer: 3, finePerKg: 250, cargoMax: 24, ownMax: 4, upCost: [] as number[][], ageStartMs: 2 * 3600_000, ageSpanMs: 2 * 3600_000, ageFloor: 50, sellBonusPct: 0, sellBonusLeft: false };
let cargo = 0, cargoVal = 0;
const loads = new Map<number, number>();
let ok = false;
let holding = false, haulT = 0, busy = false, armSteal: { id: number; until: number } | null = null;
const stealOk = new Set<number>();
let ui: { bar: HTMLDivElement; haul: HTMLButtonElement; sell: HTMLButtonElement; place: HTMLButtonElement; up: HTMLButtonElement; cargo: HTMLDivElement; tag: HTMLDivElement; panel: HTMLDivElement; radar: HTMLDivElement; radarCv: HTMLCanvasElement } | null = null;
let panelRack = -1;
/** 連按升級的排隊：每一下都排進去，一個一個送給伺服器（不會掉按、也不會一次扣兩次錢） */
type UpJob = { id: number; line: number; cost: number };
let upQ: UpJob[] = [];
let upRun = false;
/** 每座蚵棚每一項還在排隊的次數、排隊中總共要花的錢 */
const upPend = new Map<number, number[]>();
let upPendCost = 0;
const pendOf = (id: number) => { let a = upPend.get(id); if (!a) { a = [0, 0, 0, 0, 0, 0]; upPend.set(id, a); } return a; };
function clearUpQ() { upQ = []; upPend.clear(); upPendCost = 0; }
let t = 0, refetchT = 0, radarT = 0, nearRack: { rack: RackDto; dist: number } | null = null;
const _p = new THREE.Vector3();

const sNow = () => Date.now() + off;
const money = (n: number) => `$${Math.round(n).toLocaleString('zh-TW')}`;
const ERR: Record<string, string> = {
  far: '離蚵棚太遠，再靠近一點', fast: '船太快了，慢下來才拉得到', empty: '這座還沒長出蚵串', full: '船貨滿了，先回碼頭卸貨', slow: '',
  not_on_boat: '要在船上才行', far_dock: '靠近碼頭再卸貨', daily_cap: '今天賣太多了，明天再來', own_max: '你的私人蚵棚已經放滿了',
  sea_full: '海上蚵棚太多了，先收掉一座', near_land: '離碼頭／岸邊太近，往外海開一點', near_rack: '離別的蚵棚太近，換個地方', edge: '太靠海的邊邊了', near_boat: '旁邊有船擋著，換個地方再放',
  not_owner: '這不是你的蚵棚', max: '已經升到最高級了', stale: '等級剛剛變了，再按一次', gone: '這座蚵棚不見了', old_server: '伺服器還沒更新', offline: '還沒連上線',
};
const err = (e?: string, d = '做不到') => (e != null && e in ERR ? ERR[e] : d);

// ---------------- 開／關 ----------------
export function openRacks(ctx: RackCtx, root: HTMLElement) {
  closeRacks();
  C = ctx; racks = []; me = ''; cargo = 0; cargoVal = 0; loads.clear(); ok = false; stealOk.clear(); armSteal = null; holding = false; busy = false; panelRack = -1; clearUpQ();
  const bar = document.createElement('div'); bar.id = 'boatRackBar';
  const mk = (id: string, ic: string, label: string, key = '') => {
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'boatBtn rackBtn';
    b.innerHTML = `<i class="boatIc">${ic}</i><span class="lbl">${label}</span>${key ? `<span class="key"> (${key})</span>` : ''}`;
    bar.appendChild(b); return b;
  };
  const haul = mk('boatHaul', ICON.haul, '拉蚵串', 'R');
  const sell = mk('boatSell', ICON.sell, '卸貨賣錢');
  const place = mk('boatPlace', ICON.place, '放蚵棚');
  const up = mk('boatRackUp', ICON.up, '升級蚵棚');
  const cargoEl = document.createElement('div'); cargoEl.id = 'boatCargo';
  const tag = document.createElement('div'); tag.id = 'rackTag';
  const panel = document.createElement('div'); panel.id = 'rackUpPanel';
  const radar = document.createElement('div'); radar.id = 'boatRadar'; radar.setAttribute('aria-hidden', 'true');
  const radarCv = document.createElement('canvas'); radar.appendChild(radarCv);
  // 拉蚵串：按住一直拉（放開就停）
  haul.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pressHaul(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) haul.addEventListener(ev, () => { holding = false; });
  const tap = (b: HTMLButtonElement, f: () => void) => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); f(); });
  tap(sell, () => void sellCargo()); tap(place, () => void placeRack()); tap(up, () => openPanel());
  for (const b of [haul, sell, place, up]) b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  root.append(bar, cargoEl, tag, panel, radar);
  ui = { bar, haul, sell, place, up, cargo: cargoEl, tag, panel, radar, radarCv };
}
export function closeRacks() {
  ui?.bar.remove(); ui?.cargo.remove(); ui?.tag.remove(); ui?.panel.remove(); ui?.radar.remove(); ui = null;
  document.body.classList.remove('rackPanelOpen');
  C = null; racks = []; holding = false; radarT = 0; clearUpQ();
}

// ---------------- 伺服器事件 ----------------
export function onRackSnap(s: RackSnap) {
  ok = true;
  racks = s.racks.slice(0, 400);
  me = s.me; off = s.now - Date.now();
  cfg = { price: s.price, kgPer: s.kgPer, finePerKg: s.finePerKg, cargoMax: s.cargoMax, ownMax: s.ownMax, upCost: s.upCost, ageStartMs: s.ageStartMs, ageSpanMs: s.ageSpanMs, ageFloor: s.ageFloor, sellBonusPct: s.sellBonusPct, sellBonusLeft: s.sellBonusLeft };
  cargo = s.myCargo; cargoVal = s.myCargoVal;
}
export function onRackUpd(r: RackDto) {
  const i = racks.findIndex(x => x.id === r.id);
  if (i >= 0) racks[i] = r; else racks.push(r);
  if (panelRack === r.id) renderPanel();
}
export function onRackGone(id: number) { racks = racks.filter(r => r.id !== id); if (panelRack === id) closePanel(); }
export function onRackStolen(e: { rackId: number; by: string; warn: boolean }) {
  C?.sfx('warn');
  if (e.warn) toastTop(`${e.by || '有人'} 靠近你的私人蚵棚，好像想偷拉`, 3);
  else toast(`${e.by || '有人'} 偷拉了你的蚵棚！（對方被罰錢）`, '#ff8a7a', 2.6);
}
export function onCargo(e: { cargo: number; lost: number }) {
  if (e.lost > 0) toast(`船貨掉進海裡 ${e.lost} 串`, '#9fe0ff', 2);
  setCargo(e.cargo);
}
export function onLoad(e: { boatId: number; load: number }) { if (e.boatId >= 0) loads.set(e.boatId, e.load); }
/** 跳水／撞船的回應帶回剩多少 */
export function rackSpill(r: { cargo?: number; lost?: number }) { if (r.lost && r.lost > 0) onCargo({ cargo: r.cargo ?? 0, lost: r.lost }); else if (r.cargo != null) setCargo(r.cargo); }
function setCargo(n: number) {
  if (cargo > 0) cargoVal = Math.round(cargoVal * Math.max(0, n) / cargo); else cargoVal = 0;
  cargo = Math.max(0, n);
}

/** 開船：整船船貨越多越慢（駕駛用） */
export function rackSlow(boatId: number) { return loadSlow(loads.get(boatId) ?? 0, cfg.cargoMax); }
/** 船撞到蚵棚架子（駕駛本機物理）；回 true＝撞到 */
export function rackPush(b: { x: number; z: number; h: number; v: number }) {
  let hit = false;
  for (const r of racks) {
    if (Math.abs(r.x - b.x) > RACK_PUSH_AABB || Math.abs(r.z - b.z) > RACK_PUSH_AABB) continue;
    if (pushFromRack(b, r, hullPts(b), PB.hullR)) hit = true;
  }
  return hit;
}
/** 下船前：在碼頭邊、身上有船貨就先賣掉 */
export async function rackBeforeLeave() {
  const b = C?.myBoat();
  if (!b || cargo <= 0 || !ok) return;
  const p = pierNearest(b.x, b.z);
  if (Math.hypot(p.x - b.x, p.z - b.z) <= RACK.sellR + 0.5) await sellCargo();
}

// ---------------- 動作 ----------------
function target(): RackDto | null {
  const b = C?.myBoat(); if (!b || !nearRack) return null;
  return nearRack.dist <= RACK.haulR ? nearRack.rack : null;
}
function pressHaul() {
  const r = target(); if (!r || !C) return;
  if (isPrivate(r) && !isMine(r, me) && !stealOk.has(r.id)) {
    if (armSteal && armSteal.id === r.id && t < armSteal.until) { stealOk.add(r.id); armSteal = null; }
    else {
      armSteal = { id: r.id, until: t + 6 };
      C.sfx('warn');
      toastTop(`這是 ${r.owner || '別人'} 的私人蚵棚：偷拉每串罰 ${money(stealFine(r, cfg.kgPer, cfg.finePerKg))}，主人會收到通知。再按一次才會拉`, 3.5);
      return;
    }
  }
  holding = true; haulT = 0;
}
/** 鍵盤 R：按一下拉一串（按住會自動連發） */
export function rackKey(code: string) {
  if (code !== 'KeyR' || !target()) return false;
  pressHaul(); if (holding) { void haulOnce(); holding = false; }
  return true;
}
async function haulOnce() {
  const r = target(); const n = C?.net(); if (!r || !n || busy || !C) return;
  const b = C.myBoat(); if (!b || Math.abs(b.v) > RACK.haulMaxV) { toast(ERR.fast, '#ffb08a', 1.2); holding = false; return; }
  const steal = isPrivate(r) && !isMine(r, me);
  busy = true;
  const res = await n.rackHaul(r.id, steal).finally(() => { busy = false; });
  if (!res.ok) {
    if (res.err === 'slow') return;
    holding = false;
    if (res.err === 'steal_confirm') { stealOk.delete(r.id); return; }
    toast(err(res.err, '拉不上來'), '#ffb08a', 1.4); return;
  }
  if (res.rack) onRackUpd(res.rack);
  cargo = res.cargo ?? cargo + 1; if (res.cargoVal != null) cargoVal = res.cargoVal;
  C.splash(r.x, r.z, 0.35);
  if (res.fine && res.fine > 0) {
    const paid = C.fineMoney?.(res.fine, 'rack-steal') ?? 0;
    toast(`偷拉別人的蚵串，罰 ${money(paid || res.fine)}`, '#ff8a7a', 1.6);
  }
  if (cargo >= cfg.cargoMax) { holding = false; toast('船貨滿了！回碼頭卸貨賣錢', '#ffd76a', 2); }
}
async function sellCargo() {
  const n = C?.net(); if (!n || busy || !C) return;
  busy = true;
  const r = await n.rackSell().finally(() => { busy = false; });
  if (!r.ok) { if (r.err !== 'slow') toast(err(r.err, '賣不掉'), '#ffb08a'); return; }
  const bonus = r.bonus ?? 0;
  C.grantMoney?.((r.pay ?? 0) + bonus, 'rack-sell');
  setCargo(r.cargo ?? 0); if (!cargo) cargoVal = 0;
  if (bonus > 0) cfg.sellBonusLeft = false;
  C.sfx('launch');
  // 今天第一次卸貨：加碼直接算進金額，標籤寫出來
  rewardToast(bonus > 0 ? `卸貨 ${r.strings} 串・今日第一次加碼 +${money(bonus)}` : `卸貨 ${r.strings} 串・${r.kg} kg`, `+${money((r.pay ?? 0) + bonus)}`, 'mine', `rack-sell:${Date.now()}`);
}
async function placeRack() {
  const n = C?.net(); if (!n || busy || !C) return;
  if ((C.kits?.() ?? 0) < 1) { toast('先到雜貨店買「蚵棚」', '#ffb08a'); return; }
  busy = true;
  const r = await n.rackPlace().finally(() => { busy = false; });
  if (!r.ok || !r.rack) { toast(err(r.err, '這裡放不下'), '#ffb08a'); return; }
  C.addKits?.(-1);
  onRackUpd(r.rack);
  C.splash(r.rack.x, r.rack.z, 1); C.sfx('dock');
  toast('蚵棚放好了！慢慢會長出蚵串，別人偷拉會被罰錢', '#9be37a', 2.6);
}

// ---------------- 升級面板 ----------------
function myRackNear(): RackDto | null {
  if (!nearRack || nearRack.dist > RACK.upR) return null;
  return isMine(nearRack.rack, me) ? nearRack.rack : null;
}
/** 升級面板打開時：面板在最上層，船上的動作按鈕、碼頭箭頭、船貨條先收起來（body.rackPanelOpen） */
function openPanel() { const r = myRackNear(); if (!r) return; panelRack = r.id; renderPanel(); ui?.panel.classList.add('on'); document.body.classList.add('rackPanelOpen'); }
function closePanel() { panelRack = -1; ui?.panel.classList.remove('on'); document.body.classList.remove('rackPanelOpen'); }
function renderPanel() {
  if (!ui) return;
  const r = racks.find(x => x.id === panelRack); if (!r) { closePanel(); return; }
  // 連按中：畫面先照「排隊的都會成功」顯示（等級往上疊、錢先扣），伺服器回來再對齊
  const m = (C?.getMoney?.() ?? 0) - upPendCost;
  const pend = pendOf(r.id);
  const rows = UP_LINES.map((l, i) => {
    const lv = Math.min(UP_MAX, r.up[i] + pend[i]), c = upCost(cfg.upCost, i, lv);
    const btn = lv >= UP_MAX ? '<span class="rkMax">滿級</span>' : `<button type="button" data-up="${i}" ${c == null || m < c ? 'disabled' : ''}>${c == null ? '—' : money(c)}</button>`;
    return `<div class="rkRow"><div class="rkTx"><b>${l.n}</b><span class="rkLv">Lv${lv}</span><small>${l.fx(lv)}${lv < UP_MAX ? `　→　${l.fx(lv + 1)}` : ''}</small></div>${btn}</div>`;
  }).join('');
  ui.panel.innerHTML = `<div class="rkHead"><b>我的蚵棚</b><span>${rackNow(r, sNow())}／${r.max} 串</span><button type="button" class="rkX" aria-label="關閉">${ICON.close}</button></div>${rows}<div class="rkFoot"><span>身上 ${money(m)}</span><button type="button" class="rkRm">收掉這座（拿回組合包）</button></div>`;
  ui.panel.querySelector('.rkX')?.addEventListener('pointerdown', e => { e.preventDefault(); closePanel(); });
  ui.panel.querySelector('.rkRm')?.addEventListener('pointerdown', e => { e.preventDefault(); void removeRack(r.id); });
  ui.panel.querySelectorAll<HTMLButtonElement>('button[data-up]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); void upgrade(r.id, Number(b.dataset.up)); }));
}
/** 按一下升級：先排進隊伍（照排隊中的等級、錢判斷），畫面馬上更新，不用等伺服器 */
function upgrade(id: number, line: number) {
  const n = C?.net(); const r = racks.find(x => x.id === id); if (!n || !r || !C) return;
  const pend = pendOf(id);
  const p = planUpTap(r.up, pend[line], line, C.getMoney?.() ?? 0, upPendCost, cfg.upCost);
  if (!p.ok) { if (p.err === 'money') toast('錢不夠', '#ffb08a'); return; }
  pend[line]++; upPendCost += p.cost;
  upQ.push({ id, line, cost: p.cost });
  C.sfx('dock');
  renderPanel();
  void pumpUp();
}
/** 一個一個送：每次都帶伺服器最新確認的等級（from），所以連按不會被當成舊資料、也不會多扣 */
async function pumpUp() {
  if (upRun) return;
  upRun = true;
  try {
    while (upQ.length && C) {
      const job = upQ[0];
      const n = C.net(); const r = racks.find(x => x.id === job.id);
      const pend = pendOf(job.id);
      const drop = (msg?: string) => {
        // 這一項後面排的也一起取消（錢退回排隊額度）
        const rest = upQ.filter(q => q.id === job.id && q.line === job.line);
        upQ = upQ.filter(q => !(q.id === job.id && q.line === job.line));
        for (const q of rest) upPendCost -= q.cost;
        pend[job.line] = 0;
        if (msg) toast(msg, '#ffb08a');
      };
      if (!n || !r) { drop(); continue; }
      const res = await n.rackUpgrade(job.id, job.line, r.up[job.line]);
      if (!C) break;
      if (res.ok && res.rack) {
        upQ.shift(); pend[job.line] = Math.max(0, pend[job.line] - 1); upPendCost -= job.cost;
        // 伺服器確認後才扣錢（跟雜貨店一樣，錢在本機存檔）
        C.spendMoney?.(res.cost ?? job.cost, 'rack-up');
        onRackUpd(res.rack);
        C.sfx('launch');
        toast(`${UP_LINES[job.line].n} 升到 Lv${res.lv}`, '#9be37a', 1.2);
      } else if (res.err === 'slow') {
        // 伺服器說太快：等一下再送同一個，不丟掉
        await new Promise(f => setTimeout(f, 400));
      } else drop(err(res.err, '升級失敗'));
      renderPanel();
    }
  } finally { upRun = false; }
}
async function removeRack(id: number) {
  const n = C?.net(); if (!n || busy || !C) return;
  busy = true;
  const r = await n.rackRemove(id).finally(() => { busy = false; });
  if (!r.ok) { toast(err(r.err, '收不起來'), '#ffb08a'); return; }
  onRackGone(id); C.addKits?.(1);
  toast('蚵棚收起來了，組合包放回身上（升級不保留）', '#9fe0ff', 2.4);
}

// ---------------- 每幀 ----------------
/** 畫蚵棚＋更新按鈕；在 sea.begin()／end() 之間呼叫 */
export function tickRacks(dt: number, cam: THREE.Camera) {
  if (!C) return;
  t += dt;
  const sea = C.sea(); const b = C.myBoat();
  // 定期對帳（便宜：一分鐘一次）
  refetchT += dt; if (refetchT > 60) { refetchT = 0; if (ok && !C.localOnly()) void C.net()?.fetchRacks(); }
  const now = sNow(), cx = cam.position.x, cz = cam.position.z;
  // 霧遠平面（岸上 64／海上 130）：蚵棚與光柱都不畫出霧外（光柱材質 fog:false，要靠距離裁）
  const fogFar = C.fogFar?.() ?? 0;
  const drawFar = fogDrawRange(RACK.viewR, fogFar || 1e9);
  const beaconFar = fogDrawRange(RACK_BEACON.viewR, fogFar || 1e9);
  const strFar = fogDrawRange(RACK.strR, fogFar || 1e9);
  if (sea && racks.length) {
    // 熟了的燈：遠一點也看得到；由近到遠，船邊優先，避免名額被遠處先佔走
    const ripeList = pickDrawnRacks(
      racks.filter(r => rackRipe(r, now) && !beyondFogFar(Math.hypot(r.x - cx, r.z - cz), fogFar) && Math.hypot(r.x - cx, r.z - cz) <= ripeViewR(r, me)),
      cx, cz, 1e9, RACK_DRAW.ripe, b,
    );
    for (const r of ripeList) sea.ripe(r.x, r.z, r.h, 0.5 + 0.5 * Math.sin(t * 3 + r.id));
    // 架子：鏡頭附近由近到遠；膠筏旁邊能撞到的一定先畫（仍不得超出霧遠）
    for (const r of pickDrawnRacks(racks, cx, cz, drawFar, RACK_DRAW.frames, b)) {
      const d = Math.hypot(r.x - cx, r.z - cz);
      if (beyondFogFar(d, fogFar)) continue;
      const bob = Math.sin(t * 1.1 + r.id * 0.7);
      if (!sea.rack(r.x, r.z, r.h, bob, isPrivate(r) ? (isMine(r, me) ? 1 : 2) : 0)) continue;
      if (d <= strFar) sea.strings(r.x, r.z, r.h, rackNow(r, now), r.max, t);
    }
    // 自己的蚵棚：高空光柱（霧外不畫）
    for (const r of racks) {
      if (rackBeaconState(r, me, now) === 'none') continue;
      const dCam = Math.hypot(r.x - cx, r.z - cz);
      const dBoat = b ? Math.hypot(r.x - b.x, r.z - b.z) : dCam;
      if (dCam > beaconFar && dBoat > beaconFar) continue;
      if (beyondFogFar(dCam, fogFar) && beyondFogFar(dBoat, fogFar)) continue;
      const ripe = rackNow(r, now) > 0;
      sea.beacon(r.x, r.z, ripe, ripe ? Math.sin(t * 1.7 + r.id * 0.7) : 0);
    }
  }
  nearRack = b ? nearestRack(b.x, b.z, racks) : null;
  // 按住拉蚵串
  if (holding) { haulT -= dt; if (haulT <= 0) { haulT = RACK.haulEvery; void haulOnce(); } if (!target()) holding = false; }
  if (armSteal && t > armSteal.until) armSteal = null;
  syncRackUi(cam, b, now);
  syncRadar(dt, b, now);
}
function syncRackUi(cam: THREE.Camera, b: RackBoat | null, now: number) {
  if (!ui || !C) return;
  const on = !!b && ok && !C.localOnly();
  const tr = on ? target() : null;
  const trN = tr ? rackNow(tr, now) : 0;
  const showHaul = !!tr && trN > 0 && cargo < cfg.cargoMax;
  ui.haul.classList.toggle('on', showHaul);
  if (showHaul) {
    const steal = isPrivate(tr!) && !isMine(tr!, me);
    const armed = steal && !stealOk.has(tr!.id) && armSteal?.id === tr!.id;
    const lbl = steal ? (stealOk.has(tr!.id) || armed ? `確定偷拉（罰 ${money(stealFine(tr!, cfg.kgPer, cfg.finePerKg))}／串）` : '偷拉蚵串') : '拉蚵串';
    const el = ui.haul.querySelector('.lbl')!; if (el.textContent !== lbl) el.textContent = lbl;
    ui.haul.classList.toggle('steal', steal);
    ui.haul.classList.toggle('dis', Math.abs(b!.v) > RACK.haulMaxV);
  }
  const p = b ? pierNearest(b.x, b.z) : null;
  ui.sell.classList.toggle('on', on && cargo > 0 && !!p && Math.hypot(p.x - b!.x, p.z - b!.z) <= RACK.sellR);
  const kits = C.kits?.() ?? 0;
  const canPlace = on && kits > 0 && !tr && !!b && Math.abs(b.v) <= RACK.haulMaxV && distToLand(b.x, b.z) >= RACK.placeLand && (!nearRack || nearRack.dist >= RACK.placeApart)
    && racks.filter(r => isMine(r, me)).length < cfg.ownMax;
  ui.place.classList.toggle('on', canPlace);
  if (canPlace) { const l = ui.place.querySelector('.lbl')!; const s = `放蚵棚（剩 ${kits}）`; if (l.textContent !== s) l.textContent = s; }
  const mine = on ? myRackNear() : null;
  ui.up.classList.toggle('on', !!mine);
  if (panelRack >= 0 && !mine) closePanel();
  // 船貨
  const showCargo = on && (cargo > 0 || !!tr);
  ui.cargo.classList.toggle('on', showCargo);
  if (showCargo) {
    const s = `<i class="boatIc">${ICON.cargo}</i><span>蚵串 ${cargo}／${cfg.cargoMax}・${cargo * cfg.kgPer} kg${cargoVal > 0 ? `・約 ${money(cargoVal)}` : ''}${cargo > 0 && cfg.sellBonusLeft && cfg.sellBonusPct > 0 ? `・今日第一次賣 +${cfg.sellBonusPct}%` : ''}</span>`;
    if (ui.cargo.dataset.s !== s) { ui.cargo.dataset.s = s; ui.cargo.innerHTML = s; }
  }
  // 附近蚵棚的名牌（公共／私人＋主人＋串數）
  const nr = on && nearRack && nearRack.dist <= 16 ? nearRack.rack : null;
  if (nr) {
    _p.set(nr.x, PB.waterY + 2.1, nr.z).project(cam);
    const vis = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
    ui.tag.classList.toggle('on', vis);
    if (vis) {
      const n = rackNow(nr, now), nx = rackNextSec(nr, now);
      const who = !isPrivate(nr) ? '公共蚵棚' : isMine(nr, me) ? '我的蚵棚' : `私人・${nr.owner || '別人'}的蚵棚`;
      const age = rackAgePct(nr, now, cfg);
      const grow = rackCooling(nr, now) ? `・剛被拉過，${fmtWait(nx)}後再長` : nx ? `・${fmtWait(nx)}後長一串` : age < 100 ? `・放太久了，賣價剩 ${age}%` : '・長滿了';
      const s = `${who}｜${n}／${nr.max} 串${grow}`;
      if (ui.tag.textContent !== s) ui.tag.textContent = s;
      ui.tag.classList.toggle('priv', isPrivate(nr) && !isMine(nr, me));
      ui.tag.classList.toggle('mine', isMine(nr, me));
      ui.tag.style.transform = `translate(${((_p.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - _p.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%,-100%)`;
    }
  } else ui.tag.classList.remove('on');
}

/** 開船時左上角海面小雷達（約 11 Hz 重畫；拉魚／面板打開時隱藏） */
function syncRadar(dt: number, b: RackBoat | null, now: number) {
  if (!ui) return;
  const show = !!b && !rackRadarCovered(document.body.classList);
  ui.radar.classList.toggle('on', show);
  if (!show || !b) { radarT = 0; return; }
  radarT += dt;
  const css = ui.radar.clientWidth;
  if (radarT < RACK_RADAR.interval && ui.radarCv.width && css) return;
  radarT = 0;
  if (!css) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.max(1, Math.round(css * dpr));
  if (ui.radarCv.width !== px) { ui.radarCv.width = px; ui.radarCv.height = px; }
  const ctx = ui.radarCv.getContext('2d'); if (!ctx) return;
  paintRackRadar(ctx, px, buildRadarMarks({ boat: b, racks, me, now, pier: pierNearest(b.x, b.z) }));
}


// ---------------- 除錯 ----------------
export const rackDbg = {
  _raw(id: number) { return racks.find(r => r.id === id); },
  list() { const n = sNow(); return racks.map(r => ({ id: r.id, x: +r.x.toFixed(1), z: +r.z.toFixed(1), n: rackNow(r, n), max: r.max, ok: r.ok, owner: r.owner, up: r.up.join(''), mine: isMine(r, me) })); },
  cargo() { return { cargo, cargoVal, loads: Object.fromEntries(loads), me, ok }; },
  near() { return nearRack ? { id: nearRack.rack.id, dist: +nearRack.dist.toFixed(2) } : null; },
  haul() { pressHaul(); if (holding) { holding = false; void haulOnce(); } return 'ok'; },
  sell() { void sellCargo(); return 'ok'; },
  place() { void placeRack(); return 'ok'; },
  panel() { openPanel(); return panelRack; },
  up(line: number) { const r = myRackNear(); if (!r) return 'no own rack nearby'; void upgrade(r.id, line); return 'ok'; },
  ui() { return ui ? { haul: ui.haul.classList.contains('on') ? ui.haul.textContent : null, sell: ui.sell.classList.contains('on'), place: ui.place.classList.contains('on'), up: ui.up.classList.contains('on'), cargo: ui.cargo.classList.contains('on') ? ui.cargo.textContent : null, tag: ui.tag.classList.contains('on') ? ui.tag.textContent : null, panel: ui.panel.classList.contains('on') } : null; },
};
