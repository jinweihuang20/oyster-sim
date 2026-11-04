import * as THREE from 'three';
import { PlazaClient } from './hubClient';
import {
  PILE_COUNT, SLOTS_PER_PILE, PLAZA_CAPACITY, WALK_BOUND, SIT_DIST,
  seatPose, seatKey, nearestFreeSeat, pileObstacles, pileCenter, type PlazaSeatRef,
} from './layout';
import { plazaShedPosts } from './props';
import { createPlazaWorldView, tickPlazaTags, type PlazaWorldView } from './worldView';
import type { PlazaAimTarget, PlazaChat, PlazaPlayer, PlazaShellEvent, PlazaSnapshot, PlazaStealEvent } from './types';

export type PlazaDeps = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string) => void;
  audio: () => void;
  scene: THREE.Scene;
  camera: () => THREE.Camera;
  bubbles: HTMLElement;
  /** 與工寮同款蚵殼幾何／材質 */
  shellGeo: THREE.BufferGeometry;
  shellMat: THREE.Material;
  /** 連上後進廣場自由走動 */
  enterWalk: () => void;
  /** 第一次坐下：開始無 NPC 剝蚵工班 */
  beginShift: (pileId: number, slot: number) => void;
  /** 已在工班中再坐下（換位） */
  resumeSit: (pileId: number, slot: number) => void;
  /** 站起恢復走動（不結束工班） */
  goWalk: () => void;
  applySeatPose: (pos: THREE.Vector3, yaw: number) => void;
  getPhase: () => string;
  getCount: () => number;
  getWalkXZ: () => { x: number; z: number };
  getYaw: () => number;
  getMoving: () => boolean;
  /** 是否正撐傘（同步給其他人） */
  getUmb: () => boolean;
  /** 別人丟殼飛過（含打向自己，先播飛行動畫） */
  onShellThrow?: (e: PlazaShellEvent) => void;
  /** 殼飛到自己：結算擋／中 */
  onShellInbound?: (e: PlazaShellEvent) => void;
  /** 偷肉結果（含自己被偷） */
  onStealResult?: (e: PlazaStealEvent) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  onPayout: (clamped: number, meta: { oysters: number; dur: number; raw: number }) => void;
  onExit: () => void;
  /** 入場時連不上後端：不要進廣場，回主選單 */
  onEnterFail?: (err?: string) => void;
};

let active = false;
let client: PlazaClient | null = null;
let view: PlazaWorldView | null = null;
let ui: HTMLElement | null = null;
let myPile: number | null = null;
let mySlot: number | null = null;
let snap: PlazaSnapshot | null = null;
let phaseTimer = 0;
let deps: PlazaDeps | null = null;
let seated = false;
let shiftStarted = false;
let near: PlazaSeatRef | null = null;
let sittingBusy = false;
/** 斷線後手動重連 timer */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let netDown = false;

export const isPlazaActive = () => active;
export const plazaSeated = () => seated;
export const plazaShiftStarted = () => shiftStarted;
export function plazaMySeat() { return myPile != null && mySlot != null ? { pileId: myPile, slot: mySlot } : null; }
export function plazaWalkBound() { return WALK_BOUND; }
export function plazaPileObs(): [number, number, number][] {
  const out = pileObstacles();
  for (const p of plazaShedPosts()) out.push([p.x, p.z, 0.22]);
  return out;
}
export function plazaNearSeat() { return near; }
/** 點擊射線打到哪一堆（給補蚵用） */
export function plazaHitPile(raycaster: THREE.Raycaster): number | null {
  return view?.hitPile(raycaster) ?? null;
}
/** 自己坐下的那堆中心（補蚵飛出起點） */
export function plazaMyPileOrigin(out = new THREE.Vector3()) {
  if (myPile == null) return null;
  return pileCenter(myPile, out);
}

export function plazaConnId() { return client?.connectionId ?? ''; }

/** 坐下遠端玩家瞄準點 */
export function plazaAimTargets(): PlazaAimTarget[] {
  return view?.aimTargets() ?? [];
}

export async function plazaThrowAt(
  targetConnId: string,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.throwAt(targetConnId, from.x, from.y, from.z, to.x, to.y, to.z);
}

/** 飛殼純視覺（丟空／丟地上），其他人看得到 */
export async function plazaShellFx(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.shellFx(from.x, from.y, from.z, to.x, to.y, to.z);
}

/** 遠端丟殼甩臂 */
export function plazaPlayThrowFx(connId: string) {
  view?.playThrowFx(connId);
}

export async function plazaStealFrom(targetConnId: string, caught = false) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn', steal: undefined };
  return client.stealFrom(targetConnId, caught);
}

const ERR_ZH: Record<string, string> = {
  taken: '這個位子有人了',
  full: '廣場滿了，等有人離開再來',
  bad_seat: '位子不對',
  not_joined: '還沒連上廣場',
  no_seat: '請先選位子',
  slow: '太快了，稍等一下',
  connect_fail: '連不上廣場伺服器',
  join_fail: '進廣場失敗',
  already_paid: '這一工已經結過算了',
  bad_token: '場次失效，請重新進廣場',
  no_target: '對方不在了',
  target_walk: '對方站起來了',
  bad_target: '不能對自己',
  empty: '碗裡沒肉了',
  throw_fail: '丟殼失敗',
  steal_fail: '偷失敗',
};

function zhErr(e?: string) { return (e && ERR_ZH[e]) || e || '失敗了'; }

export function openPlaza(D: PlazaDeps) {
  if (active) return;
  active = true; seated = false; shiftStarted = false; deps = D;
  myPile = null; mySlot = null; snap = null; near = null; sittingBusy = false;
  D.audio();
  client = new PlazaClient();
  view = createPlazaWorldView(D.scene, D.bubbles, {
    shellGeo: D.shellGeo,
    shellMat: D.shellMat,
    lowDetail: matchMedia('(pointer: coarse)').matches,
  });
  buildUi();
  wireClient(D);
  void boot(D);
}

async function abortEnter(D: PlazaDeps, err?: string) {
  active = false; seated = false; shiftStarted = false; netDown = false;
  clearReconnectTimer();
  await client?.disconnect();
  client = null;
  view?.dispose(); view = null;
  ui?.remove(); ui = null;
  myPile = null; mySlot = null; snap = null; near = null; deps = null;
  D.onEnterFail?.(err);
}

async function boot(D: PlazaDeps) {
  setHud('連線中…');
  const r = await client!.connect(D.id, D.nick());
  if (!active || !client) return; // 入場中被取消
  if (!r.ok) {
    D.toast(`廣場連不上：${zhErr(r.err)}`, '#ff8a7a');
    await abortEnter(D, r.err);
    return;
  }
  snap = r.snap ?? null;
  if (snap) view?.syncRoster(snap, D.id);
  setHud(`${plazaHudPeople(snap)}　隨便坐、不趕時間`);
  D.enterWalk();
  showRoamUi();
}

function clearReconnectTimer() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function scheduleManualReconnect(delayMs = 3000) {
  clearReconnectTimer();
  if (!active || !client) return;
  reconnectTimer = setTimeout(() => { void doManualReconnect(); }, delayMs);
}

async function doManualReconnect() {
  reconnectTimer = null;
  if (!active || !client || !deps) return;
  setNetBanner(`連線中斷，正在重連…`);
  const r = await client.tryManualReconnect();
  if (!active) return;
  if (!r.ok) {
    setNetBanner(`重連失敗，稍後再試…`);
    deps.toast('廣場重連失敗，持續嘗試中', '#ffb08a');
    scheduleManualReconnect(Math.min(20000, 4000 + Math.random() * 2000));
  }
}

function flashNetOk(msg: string) {
  setNetBanner(msg, true);
  setTimeout(() => { if (!netDown) setNetBanner(null); }, 2200);
}

async function restoreAfterRejoin(s?: PlazaSnapshot) {
  if (!deps || !client) return;
  netDown = false;
  clearReconnectTimer();
  syncSeatChrome();
  if (s) {
    snap = normalizeSnap(s);
    view?.syncRoster(snap, deps.id);
  }
  // 斷線期間座位已被清掉：若本地還坐著，試著搶回原位
  if (seated && myPile != null && mySlot != null) {
    const r = await client.claimSeat(myPile, mySlot);
    if (r.ok) {
      if ((r as any).token) client.token = (r as any).token;
      if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
      flashNetOk('已重連，位子還在');
      deps.toast('已重連，位子還在', '#9be37a');
      setHud(plazaHudPeople(snap));
      return;
    }
    // 位子被佔：站起來繼續逛
    myPile = null; mySlot = null; seated = false;
    view?.highlight(null, null);
    syncSeatChrome();
    deps.goWalk();
    flashNetOk('已重連');
    deps.toast(r.err === 'taken' ? '已重連，原位子有人了，請另找空位' : '已重連，請重新找位子坐下', '#ffd76a');
    setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
    return;
  }
  flashNetOk('廣場已重新連線');
  deps.toast('廣場已重新連線', '#9be37a');
  if (!seated) setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
}

function wireClient(D: PlazaDeps) {
  client!.setHandlers({
    onRoster: (s) => {
      snap = normalizeSnap(s);
      view?.syncRoster(snap, D.id);
      if (!netDown && !seated) setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
    },
    onJoined: (p) => {
      const n = normPlayer(p);
      view?.applyPose(n, D.id);
      if (n.pid && n.pid !== D.id) D.toast(`${n.nick} 進來廣場了`, '#9fe0ff');
    },
    onLeft: (p) => {
      const n = normPlayer(p);
      view?.remove(n);
      if (n.pid && n.pid !== D.id) D.toast(`${n.nick} 離開廣場了`, '#ffb08a');
    },
    onSeatChanged: (p) => { view?.applyPose(normPlayer(p), D.id); },
    onPose: (p) => { view?.applyPose(normPlayer(p), D.id); },
    onPhase: (p) => { view?.applyPose(normPlayer(p), D.id); },
    onChat: (m) => pushChat(normChat(m)),
    onShellThrow: (e) => D.onShellThrow?.(e),
    onShellInbound: (e) => D.onShellInbound?.(e),
    onStealResult: (e) => D.onStealResult?.(e),
    onReconnecting: (attempt) => {
      if (!active) return;
      netDown = true;
      setNetBanner(`連線不穩，正在重連（第 ${attempt} 次）…`);
      if (attempt === 1) D.toast('廣場連線中斷，正在重連…', '#ffb08a');
      // 坐下時也要看得到提示
      const hud = ui?.querySelector('#pzHud') as HTMLElement | null;
      if (hud) hud.classList.remove('hide');
    },
    onSocketReconnected: () => {
      if (!active) return;
      setNetBanner('連上了，正在回到廣場…');
    },
    onRejoined: (s) => { if (active) void restoreAfterRejoin(s); },
    onRejoinFail: (err, attempt) => {
      if (!active) return;
      netDown = true;
      setNetBanner(`重連中（第 ${attempt ?? '?'} 次）…`);
      D.toast(zhErr(err) || '重連失敗，繼續嘗試', '#ffb08a');
    },
    onClose: () => {
      if (!active) return;
      netDown = true;
      setNetBanner('連線中斷，正在重連…');
      D.toast('廣場連線中斷，正在重連…', '#ffb08a');
      const hud = ui?.querySelector('#pzHud') as HTMLElement | null;
      if (hud) hud.classList.remove('hide');
      scheduleManualReconnect(1500);
    },
  });
}

function normalizeSnap(s: any): PlazaSnapshot {
  const players: PlazaPlayer[] = (s?.players ?? s?.Players ?? []).map(normPlayer);
  // occupied = 在場總人數（含自己／走動）；舊後端若仍回「入座數」則改以 players.length 為準
  const rawOcc = s?.occupied ?? s?.Occupied;
  const occupied = players.length > 0 ? players.length
    : (typeof rawOcc === 'number' ? rawOcc : 0);
  return {
    players,
    pileCount: s?.pileCount ?? s?.PileCount ?? PILE_COUNT,
    slotsPerPile: s?.slotsPerPile ?? s?.SlotsPerPile ?? SLOTS_PER_PILE,
    occupied,
    capacity: s?.capacity ?? s?.Capacity ?? PLAZA_CAPACITY,
  };
}

/** HUD：目前在場幾人 */
function plazaHudPeople(s?: PlazaSnapshot | null) {
  const n = s?.players?.length ?? s?.occupied ?? 0;
  const cap = s?.capacity ?? PLAZA_CAPACITY;
  return `廣場休閒・目前 ${n} 人（可坐 ${cap}）`;
}
function normPlayer(p: any): PlazaPlayer {
  const seated = !!(p?.seated ?? p?.Seated ?? ((p?.pileId ?? p?.PileId ?? -1) >= 0));
  return {
    connId: p?.connId ?? p?.ConnId ?? '',
    pid: p?.pid ?? p?.Pid ?? '',
    nick: p?.nick ?? p?.Nick ?? '剝蚵人',
    pileId: p?.pileId ?? p?.PileId ?? -1,
    slot: p?.slot ?? p?.Slot ?? -1,
    phase: p?.phase ?? p?.Phase ?? 'idle',
    count: p?.count ?? p?.Count ?? 0,
    joinedAt: p?.joinedAt ?? p?.JoinedAt ?? 0,
    x: Number(p?.x ?? p?.X ?? 0),
    z: Number(p?.z ?? p?.Z ?? 0),
    yaw: Number(p?.yaw ?? p?.Yaw ?? 0),
    seated,
    moving: !!(p?.moving ?? p?.Moving),
    umb: !!(p?.umb ?? p?.Umb),
  };
}
function normChat(m: any): PlazaChat {
  return {
    connId: m?.connId ?? m?.ConnId ?? '',
    pid: m?.pid ?? m?.Pid ?? '',
    nick: m?.nick ?? m?.Nick ?? '?',
    text: m?.text ?? m?.Text ?? '',
    pileId: m?.pileId ?? m?.PileId ?? null,
    at: m?.at ?? m?.At ?? Date.now(),
  };
}

function takenSet(exceptMine = true) {
  const t = new Set<string>();
  for (const p of snap?.players ?? []) {
    if (exceptMine && deps && p.pid === deps.id) continue;
    t.add(seatKey(p.pileId, p.slot));
  }
  return t;
}

function buildUi() {
  ui = document.createElement('div');
  ui.id = 'plazaRoot';
  ui.innerHTML = `
<style>
#plazaRoot{position:fixed;inset:0;z-index:8500;pointer-events:none;font-family:inherit}
#plazaRoot *{box-sizing:border-box}
#pzHud{pointer-events:none;position:absolute;top:calc(env(safe-area-inset-top) + 10px);left:50%;transform:translateX(-50%);max-width:min(78vw,340px);background:rgba(20,12,6,.72);border:2px solid #d9952b;border-radius:12px;padding:5px 10px;font-weight:800;font-size:13px;color:#ffd23f;text-align:center;line-height:1.3;z-index:1}
#pzHud.hide{display:none}
#pzNet{display:none;pointer-events:none;position:absolute;top:calc(env(safe-area-inset-top) + 52px);left:50%;transform:translateX(-50%);max-width:min(86vw,360px);background:rgba(80,28,12,.92);border:2px solid #ffb08a;border-radius:12px;padding:8px 14px;font-weight:900;font-size:14px;color:#ffe0c0;text-align:center;line-height:1.35;z-index:4;box-shadow:0 4px 14px #0008}
#pzNet.on{display:block}
#pzNet.ok{background:rgba(20,48,28,.92);border-color:#9be37a;color:#d8ffc8}
#pzX{pointer-events:auto;position:absolute;top:calc(env(safe-area-inset-top) + 8px);right:calc(env(safe-area-inset-right) + 8px);min-width:42px;height:42px;padding:0 12px;font-size:14px;z-index:3;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;white-space:nowrap}
#pzX.hide{display:none}
/* 聊天放左側，避開右下雨傘／丟殼／偷 */
#pzChatFab{pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 168px);z-index:3;min-width:48px;height:44px;padding:0 12px;border:0;border-radius:12px;background:#d9952b;color:#2a1600;font-weight:900;font-size:14px;box-shadow:2px 2px 0 #1b1208}
#pzChat{display:none;pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 220px);width:min(58vw,260px);max-width:calc(100vw - 24px);background:rgba(20,12,6,.88);border:2px solid #d9952b;border-radius:12px;padding:8px;color:#fff6d8;z-index:3}
#pzChat.open{display:block}
@media (pointer:fine){
  #pzChatFab{bottom:calc(env(safe-area-inset-bottom) + 88px)}
  #pzChat{bottom:calc(env(safe-area-inset-bottom) + 140px)}
}
@media (pointer:coarse) and (orientation:landscape){
  #pzChatFab{bottom:calc(env(safe-area-inset-bottom) + 120px)}
  #pzChat{bottom:calc(env(safe-area-inset-bottom) + 172px);width:min(42vw,240px)}
}
#pzChatHd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:12px;font-weight:800;color:#ffd23f}
#pzChatMin{pointer-events:auto;background:transparent;border:0;color:#ffd23f;font-size:18px;line-height:1;padding:2px 6px;font-weight:900}
#pzLog{height:64px;overflow:auto;font-size:12px;line-height:1.35;margin-bottom:6px}
#pzRow{display:flex;gap:6px}
#pzRow input{flex:1;min-width:0;border-radius:8px;border:2px solid #6b3a12;background:#1a1008;color:#fff6d8;padding:6px 8px;font-size:14px}
#pzRow button{pointer-events:auto;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;padding:8px 12px}
#pzSitPrompt{display:none;pointer-events:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 150px);transform:translateX(-50%);background:rgba(20,12,6,.8);border:2px solid #9be37a;border-radius:12px;padding:8px 14px;color:#9be37a;font-weight:900;font-size:14px;text-align:center;z-index:1;max-width:min(90vw,360px)}
#pzSitPrompt.on{display:block}
@media (pointer:fine){#pzSitPrompt{bottom:calc(env(safe-area-inset-bottom) + 72px)}}
@media (max-width:420px){#pzChat{width:min(72vw,240px)}#pzLog{height:52px}}
</style>
<button id="pzX" type="button" aria-label="離開廣場">離開廣場</button>
<div id="pzHud">準備中…</div>
<div id="pzNet" role="status" aria-live="polite"></div>
<div id="pzSitPrompt"></div>
<button id="pzChatFab" type="button" aria-label="聊天">聊天</button>
<div id="pzChat">
  <div id="pzChatHd"><span>廣場聊天</span><button id="pzChatMin" type="button" aria-label="縮小">–</button></div>
  <div id="pzLog"></div>
  <div id="pzRow"><input id="pzIn" maxlength="80" placeholder="跟廣場打招呼…"/><button id="pzSend" type="button">送</button></div>
</div>`;
  document.body.appendChild(ui);
  ui.querySelector('#pzX')!.addEventListener('click', () => {
    if (shiftStarted) deps?.onExit();
    else { const exit = deps?.onExit; void closePlaza(true).then(() => exit?.()); }
  });
  const chat = ui.querySelector('#pzChat') as HTMLElement;
  const fab = ui.querySelector('#pzChatFab') as HTMLElement;
  const setChatOpen = (open: boolean) => {
    chat.classList.toggle('open', open);
    fab.textContent = open ? '聊天' : '聊天';
    fab.style.opacity = open ? '0.55' : '1';
  };
  fab.addEventListener('click', () => setChatOpen(!chat.classList.contains('open')));
  ui.querySelector('#pzChatMin')!.addEventListener('click', () => setChatOpen(false));
  ui.querySelector('#pzSend')!.addEventListener('click', sendChat);
  ui.querySelector('#pzIn')!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') sendChat(); });
  setChatOpen(false);
}

function showRoamUi() {
  syncSeatChrome();
}

/** 走動才顯示離開／頂部提示；坐下改用遊戲內 quit／🚶，避免擋 #top */
function syncSeatChrome() {
  const leave = ui?.querySelector('#pzX') as HTMLElement | null;
  const hud = ui?.querySelector('#pzHud') as HTMLElement | null;
  if (leave) leave.classList.toggle('hide', seated);
  // 斷線重連時 HUD 也要看得見
  if (hud) hud.classList.toggle('hide', seated && !netDown);
}

function setHud(t: string) {
  const el = ui?.querySelector('#pzHud'); if (el) el.textContent = t;
  syncSeatChrome();
}

/** 連線狀態條：坐下時也顯示（不跟 #pzHud 一起藏） */
function setNetBanner(t: string | null, ok = false) {
  const el = ui?.querySelector('#pzNet') as HTMLElement | null;
  if (!el) return;
  if (!t) { el.classList.remove('on', 'ok'); el.textContent = ''; return; }
  el.textContent = t;
  el.classList.add('on');
  el.classList.toggle('ok', ok);
}

function setSitPrompt(t: string | null) {
  const el = ui?.querySelector('#pzSitPrompt') as HTMLElement | null;
  if (!el) return;
  if (!t) { el.classList.remove('on'); el.textContent = ''; return; }
  el.textContent = t; el.classList.add('on');
}

/** 走動時更新附近空位提示 */
export function plazaUpdateNear(wx: number, wz: number) {
  if (!active || seated) { near = null; setSitPrompt(null); view?.highlightNear(null); return null; }
  const n = nearestFreeSeat(wx, wz, takenSet(true), SIT_DIST);
  near = n ? { pileId: n.pileId, slot: n.slot } : null;
  view?.highlightNear(near);
  if (near) {
    const touch = matchMedia('(pointer: coarse)').matches;
    setSitPrompt(touch ? `第 ${near.pileId + 1} 堆空位　按「坐落」坐下剝蚵` : `第 ${near.pileId + 1} 堆空位　按 E 坐下剝蚵`);
  } else setSitPrompt(null);
  return near;
}

/** 嘗試坐附近空位（E／坐落） */
export async function plazaTrySit(): Promise<boolean> {
  if (!deps || !active || seated || sittingBusy) return false;
  const seat = near ?? nearestFreeSeat(deps.getWalkXZ().x, deps.getWalkXZ().z, takenSet(true), SIT_DIST);
  if (!seat) { deps.toast('靠近空的藍色板凳再坐', '#ffb08a'); return false; }
  sittingBusy = true;
  try {
    if (!client?.connected) { deps.toast('還沒連上廣場', '#ff8a7a'); return false; }
    const first = !shiftStarted;
    const r = first || myPile == null
      ? await client.claimSeat(seat.pileId, seat.slot)
      : await client.changeSeat(seat.pileId, seat.slot);
    if (!r.ok) {
      deps.toast(zhErr(r.err), '#ff8a7a');
      if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
      return false;
    }
    if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
    if ((r as any).token) client.token = (r as any).token;
    myPile = seat.pileId; mySlot = seat.slot;
    const pose = seatPose(seat.pileId, seat.slot);
    deps.applySeatPose(pose.pos, pose.yaw);
    view?.highlight(seat.pileId, seat.slot);
    seated = true; near = null; setSitPrompt(null);
    syncSeatChrome();
    if (first) { shiftStarted = true; deps.beginShift(seat.pileId, seat.slot); }
    else deps.resumeSit(seat.pileId, seat.slot);
    return true;
  } finally { sittingBusy = false; }
}

/** 站起：釋座並恢復走動（工班繼續） */
export async function plazaStandWalk() {
  if (!deps || !active || !seated) return;
  // 先 goWalk（仍留著 myPile／mySlot 算站起點），再清座位並通知伺服器
  seated = false;
  deps.goWalk();
  myPile = null; mySlot = null;
  view?.highlight(null, null);
  setHud(`${plazaHudPeople(snap)}　靠近空位坐下，不趕時間`);
  syncSeatChrome();
  await client?.leaveSeat();
  // 立刻把站起後座標推出去，避免遠端還停在椅上或飛向舊 Sync 點
  if (client?.connected && deps) {
    const p = deps.getWalkXZ();
    void client.sync(p.x, p.z, deps.getYaw(), 'walk', deps.getCount(), false, deps.getUmb());
  }
}

function sendChat() {
  const input = ui?.querySelector('#pzIn') as HTMLInputElement | null;
  if (!input || !client) return;
  const t = input.value.trim(); if (!t) return;
  input.value = '';
  void client.chat(t, false).then(r => { if (!r.ok) deps?.toast(zhErr(r.err), '#ff8a7a'); });
}

function pushChat(m: PlazaChat) {
  const log = ui?.querySelector('#pzLog'); if (!log) return;
  const row = document.createElement('div');
  const where = m.pileId != null ? `[堆${m.pileId + 1}] ` : '';
  row.textContent = `${where}${m.nick}：${m.text}`;
  log.appendChild(row); log.scrollTop = log.scrollHeight;
  while (log.childElementCount > 40) log.firstChild?.remove();
  const isSelf = Boolean(deps && (m.pid === deps.id || (!!m.connId && m.connId === client?.connectionId)));
  view?.showChat({ connId: m.connId || undefined, pid: m.pid || undefined, nick: m.nick, text: m.text, self: isSelf });
}

export function tickPlaza(dt: number) {
  if (!active || !deps) return;
  const p = deps.getWalkXZ();
  view?.setSelfPose(p.x, p.z, deps.getYaw(), seated);
  tickPlazaTags(view, deps.camera(), dt);
  if (!seated) plazaUpdateNear(p.x, p.z);
  if (!client?.connected) return;
  phaseTimer += dt;
  // ~10Hz 同步位置＋動作
  if (phaseTimer >= 0.1) {
    phaseTimer = 0;
    const yaw = deps.getYaw();
    const phase = seated ? deps.getPhase() : 'walk';
    const moving = !seated && deps.getMoving();
    void client.sync(p.x, p.z, yaw, phase, deps.getCount(), moving, deps.getUmb());
  }
}

/** 收工／結算時藏廣場 UI（離開鈕、聊天），避免擋結果面板 */
export function plazaHideChrome(hide = true) {
  if (!ui) return;
  ui.style.display = hide ? 'none' : '';
  if (hide) setSitPrompt(null);
}

export async function plazaReportEarn(raw: number, oysters: number, durationSec: number): Promise<number> {
  if (!client || !deps) return Math.max(0, Math.floor(raw));
  const r = await client.reportEarn(Math.floor(raw), oysters, durationSec);
  if (!r.ok) {
    deps.toast(zhErr(r.err) + '（暫用本機結算）', '#ffb08a');
    return Math.max(0, Math.min(10_000, Math.floor(raw)));
  }
  deps.track('plaza_reward', { amount: r.payout, via: 'plaza' });
  return r.payout;
}

export async function closePlaza(leaveSeat = true) {
  if (!active) return;
  active = false; seated = false; shiftStarted = false; netDown = false;
  clearReconnectTimer();
  if (leaveSeat) await client?.leaveSeat();
  await client?.disconnect();
  client = null;
  view?.dispose(); view = null;
  ui?.remove(); ui = null;
  myPile = null; mySlot = null; snap = null; deps = null; near = null;
}

export function plazaEndCleanup() {
  setSitPrompt(null);
  plazaHideChrome(true);
}
