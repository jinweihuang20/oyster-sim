import * as THREE from 'three';
import { PlazaClient } from './hubClient';
import {
  PILE_COUNT, SLOTS_PER_PILE, PLAZA_CAPACITY, WALK_BOUND, SIT_DIST,
  seatPose, seatKey, nearestFreeSeat, pileObstacles, pileCenter, type PlazaSeatRef,
} from './layout';
import { plazaCanopySites } from './props';
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

export const isPlazaActive = () => active;
export const plazaSeated = () => seated;
export const plazaShiftStarted = () => shiftStarted;
export function plazaMySeat() { return myPile != null && mySlot != null ? { pileId: myPile, slot: mySlot } : null; }
export function plazaWalkBound() { return WALK_BOUND; }
export function plazaPileObs(): [number, number, number][] {
  const out = pileObstacles();
  for (const site of plazaCanopySites()) {
    for (const p of site.posts) out.push([p.x, p.z, 0.2]);
  }
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

async function boot(D: PlazaDeps) {
  setHud('連線中…');
  const r = await client!.connect(D.id, D.nick());
  if (!r.ok) {
    setHud('連線失敗（仍可逛逛，但坐不下）');
    D.toast(zhErr(r.err), '#ff8a7a');
    D.enterWalk();
    showRoamUi();
    return;
  }
  snap = r.snap ?? null;
  if (snap) view?.syncRoster(snap, D.id);
  setHud(`廣場休閒 ${snap?.occupied ?? 0}/${snap?.capacity ?? PLAZA_CAPACITY}　隨便坐、不趕時間`);
  D.enterWalk();
  showRoamUi();
}

function wireClient(D: PlazaDeps) {
  client!.setHandlers({
    onRoster: (s) => {
      snap = normalizeSnap(s);
      view?.syncRoster(snap, D.id);
      if (!seated) setHud(`廣場休閒 ${snap.occupied}/${snap.capacity}　靠近空位坐下`);
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
    onClose: (err) => {
      if (!active) return;
      D.toast(err ? `廣場斷線：${err}` : '廣場連線中斷', '#ffb08a');
      setHud('已斷線');
    },
  });
}

function normalizeSnap(s: any): PlazaSnapshot {
  const players: PlazaPlayer[] = (s?.players ?? s?.Players ?? []).map(normPlayer);
  return {
    players,
    pileCount: s?.pileCount ?? s?.PileCount ?? PILE_COUNT,
    slotsPerPile: s?.slotsPerPile ?? s?.SlotsPerPile ?? SLOTS_PER_PILE,
    occupied: s?.occupied ?? s?.Occupied ?? players.filter(p => p.seated).length,
    capacity: s?.capacity ?? s?.Capacity ?? PLAZA_CAPACITY,
  };
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
  return { nick: m?.nick ?? m?.Nick ?? '?', text: m?.text ?? m?.Text ?? '', pileId: m?.pileId ?? m?.PileId ?? null, at: m?.at ?? m?.At ?? Date.now() };
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
#pzX{pointer-events:auto;position:absolute;top:calc(env(safe-area-inset-top) + 8px);right:calc(env(safe-area-inset-right) + 8px);min-width:42px;height:42px;padding:0 12px;font-size:14px;z-index:3;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;white-space:nowrap}
#pzX.hide{display:none}
#pzChatFab{pointer-events:auto;position:absolute;right:calc(env(safe-area-inset-right) + 10px);bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:3;min-width:48px;height:44px;padding:0 12px;border:0;border-radius:12px;background:#d9952b;color:#2a1600;font-weight:900;font-size:14px;box-shadow:2px 2px 0 #1b1208}
#pzChat{display:none;pointer-events:auto;position:absolute;right:calc(env(safe-area-inset-right) + 10px);bottom:calc(env(safe-area-inset-bottom) + 66px);width:min(58vw,260px);max-width:calc(100vw - 24px);background:rgba(20,12,6,.88);border:2px solid #d9952b;border-radius:12px;padding:8px;color:#fff6d8;z-index:3}
#pzChat.open{display:block}
#pzChatHd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:12px;font-weight:800;color:#ffd23f}
#pzChatMin{pointer-events:auto;background:transparent;border:0;color:#ffd23f;font-size:18px;line-height:1;padding:2px 6px;font-weight:900}
#pzLog{height:64px;overflow:auto;font-size:12px;line-height:1.35;margin-bottom:6px}
#pzRow{display:flex;gap:6px}
#pzRow input{flex:1;min-width:0;border-radius:8px;border:2px solid #6b3a12;background:#1a1008;color:#fff6d8;padding:6px 8px;font-size:14px}
#pzRow button{pointer-events:auto;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;padding:8px 12px}
#pzSitPrompt{display:none;pointer-events:none;position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 150px);transform:translateX(-50%);background:rgba(20,12,6,.8);border:2px solid #9be37a;border-radius:12px;padding:8px 14px;color:#9be37a;font-weight:900;font-size:14px;text-align:center;z-index:1;max-width:min(90vw,360px)}
#pzSitPrompt.on{display:block}
@media (pointer:fine){#pzSitPrompt{bottom:calc(env(safe-area-inset-bottom) + 72px)}}
@media (max-width:420px){#pzChat{width:min(70vw,240px)}#pzLog{height:52px}}
</style>
<button id="pzX" type="button" aria-label="離開廣場">離開廣場</button>
<div id="pzHud">準備中…</div>
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
  if (hud) hud.classList.toggle('hide', seated);
}

function setHud(t: string) {
  const el = ui?.querySelector('#pzHud'); if (el) el.textContent = t;
  syncSeatChrome();
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
  await client?.leaveSeat();
  myPile = null; mySlot = null; seated = false;
  view?.highlight(null, null);
  setHud(`廣場休閒 ${snap?.occupied ?? 0}/${snap?.capacity ?? PLAZA_CAPACITY}　靠近空位坐下，不趕時間`);
  syncSeatChrome();
  deps.goWalk();
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
}

export function tickPlaza(dt: number) {
  if (!active || !deps) return;
  tickPlazaTags(view, deps.camera(), dt);
  if (!seated) {
    const p = deps.getWalkXZ();
    plazaUpdateNear(p.x, p.z);
  }
  if (!client?.connected) return;
  phaseTimer += dt;
  // ~10Hz 同步位置＋動作
  if (phaseTimer >= 0.1) {
    phaseTimer = 0;
    const p = deps.getWalkXZ();
    const yaw = deps.getYaw();
    const phase = seated ? deps.getPhase() : 'walk';
    const moving = !seated && deps.getMoving();
    void client.sync(p.x, p.z, yaw, phase, deps.getCount(), moving, deps.getUmb());
  }
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
  active = false; seated = false; shiftStarted = false;
  if (leaveSeat) await client?.leaveSeat();
  await client?.disconnect();
  client = null;
  view?.dispose(); view = null;
  ui?.remove(); ui = null;
  myPile = null; mySlot = null; snap = null; deps = null; near = null;
}

export function plazaEndCleanup() {
  setSitPrompt(null);
}
