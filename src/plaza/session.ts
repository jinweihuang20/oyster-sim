import * as THREE from 'three';
import { PlazaClient } from './hubClient';
import {
  PILE_COUNT, SLOTS_PER_PILE, PLAZA_CAPACITY, WALK_BOUND, SIT_DIST,
  seatPose, seatKey, nearestFreeSeat, pileObstacles, pileCenter, randomWalkSpawn, type PlazaSeatRef,
} from './layout';
import { plazaShedPosts } from './props';
import { createPlazaWorldView, tickPlazaTags, type PlazaWorldView } from './worldView';
import type { PlazaAimTarget, PlazaChat, PlazaPlayer, PlazaShellEvent, PlazaSnapshot, PlazaStealEvent } from './types';
import { postDiscordPlazaChat, postDiscordPlazaPresence } from '../core/discord';
import { myTag } from '../meta/social';

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
  /** 坐下時左右轉頭（相對座位）；第一人稱走動也可送，第三人稱走動為 0 */
  getLookYaw?: () => number;
  /** 視角俯仰；第三人稱走動鎖 0，其餘照本機 */
  getPitch?: () => number;
  /** 是否第三人稱（走動時用來決定要不要鎖頭／俯仰同步） */
  getTpv?: () => boolean;
  /** 目前五件裝備 id（進場／換裝同步） */
  getOutfit?: () => { head: string; hand: string; body: string; legs: string; feet: string };
  /** 別人丟殼飛過（含打向自己，先播飛行動畫） */
  onShellThrow?: (e: PlazaShellEvent) => void;
  /** 殼飛到自己：結算擋／中 */
  onShellInbound?: (e: PlazaShellEvent) => void;
  /** 自己丟的殼被對方完美反彈打回來 */
  onShellReflectHit?: (e: PlazaShellEvent) => void;
  /** 偷肉結果（含自己被偷） */
  onStealResult?: (e: PlazaStealEvent) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  onPayout: (clamped: number, meta: { oysters: number; dur: number; raw: number }) => void;
  onExit: () => void;
  /** 入場時連不上後端：不要進廣場，回主選單 */
  onEnterFail?: (err?: string) => void;
};

let active = false;
/** 已成功進場並公告過（離場才再公告；重連／連線失敗不重複） */
let plazaIoAnnounced = false;
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
/** 聊天縮小時未讀數；打開後清零 */
let chatUnread = 0;
let chatPeekTimer: ReturnType<typeof setTimeout> | null = null;

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
/** 入場隨機站位（避開蚵堆／棚柱，面向中心） */
export function plazaRandomSpawn() {
  const posts: [number, number, number][] = plazaShedPosts().map(p => [p.x, p.z, 0.22]);
  return randomWalkSpawn(posts);
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

/** 完美反彈：殼飛回原丟殼者並造成傷害 */
export async function plazaShellReflect(
  originalThrowerConnId: string,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.shellReflect(originalThrowerConnId, from.x, from.y, from.z, to.x, to.y, to.z);
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
  other_pile: '只能偷同一堆的人',
  newcomer: '剛坐下要先剝一會才能偷',
  protected: '對方碗裡太少，先別偷',
  umb: '對方撐著傘，偷不到',
  busy: '對方正在撬殼，下手不了',
  immune: '對方剛被偷過，先等等',
  pair_cd: '同一個目標要隔一下再偷',
  victim_cap: '對方這分鐘被偷太多次了',
  steal_ban: '偷被抓太多次，先冷靜一下',
};

export function plazaZhErr(e?: string) { return (e && ERR_ZH[e]) || e || '失敗了'; }
function zhErr(e?: string) { return plazaZhErr(e); }

export function openPlaza(D: PlazaDeps) {
  if (active) return;
  active = true; seated = false; shiftStarted = false; plazaIoAnnounced = false; deps = D;
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
  syncPlazaPeopleHud();
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
  applyChatHistory(r.chat);
  void plazaPushOutfit();
  setHud(`${plazaHudPeople(snap)}　隨便坐、不趕時間`);
  D.enterWalk();
  showRoamUi();
  if (!plazaIoAnnounced) {
    plazaIoAnnounced = true;
    const online = snap?.occupied ?? snap?.players?.length ?? null;
    void postDiscordPlazaPresence(D.nick(), 'join', { online, tag: myTag() });
  }
}

/** 把本機目前裝備推到廣場（進場／換裝／重連後） */
export async function plazaPushOutfit() {
  if (!client?.connected || !deps?.getOutfit) return;
  const o = deps.getOutfit();
  await client.setOutfit(o.head, o.hand, o.body, o.legs, o.feet);
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

async function restoreAfterRejoin(s?: PlazaSnapshot, chat?: PlazaChat[]) {
  if (!deps || !client) return;
  netDown = false;
  clearReconnectTimer();
  syncSeatChrome();
  // 重連後先清掉可能殘留的「自己」遠端分身，再套 roster
  view?.pruneSelf(deps.id);
  if (s) {
    snap = normalizeSnap(s);
    view?.syncRoster(snap, deps.id);
  }
  // 補離線期間錯過的聊天
  applyChatHistory(chat);
  void plazaPushOutfit();
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
      syncPlazaPeopleHud();
      if (!netDown && !seated) setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
    },
    onJoined: (p) => {
      const n = normPlayer(p);
      view?.applyPose(n, D.id);
      if (snap) {
        const i = snap.players.findIndex(x => x.connId === n.connId || (!!n.pid && x.pid === n.pid));
        if (i < 0) snap.players.push(n); else snap.players[i] = { ...snap.players[i], ...n };
        snap.occupied = snap.players.length;
      }
      syncPlazaPeopleHud();
      if (n.pid && n.pid !== D.id) D.toast(`${n.nick} 進來廣場了`, '#9fe0ff');
    },
    onLeft: (p) => {
      const n = normPlayer(p);
      view?.remove(n);
      if (snap) {
        snap.players = snap.players.filter(x => x.connId !== n.connId && !(n.pid && x.pid === n.pid));
        snap.occupied = snap.players.length;
      }
      syncPlazaPeopleHud();
      if (n.pid && n.pid !== D.id) D.toast(`${n.nick} 離開廣場了`, '#ffb08a');
    },
    onSeatChanged: (p) => { view?.applyPose(normPlayer(p), D.id); },
    onPose: (p) => { view?.applyPose(normPlayer(p), D.id); },
    onPhase: (p) => { view?.applyPose(normPlayer(p), D.id); },
    onChat: (m) => pushChat(normChat(m)),
    onShellThrow: (e) => { try { D.onShellThrow?.(e); } catch (err) { console.error('onShellThrow', err); } },
    onShellInbound: (e) => { try { D.onShellInbound?.(e); } catch (err) { console.error('onShellInbound', err); } },
    onShellReflectHit: (e) => { try { D.onShellReflectHit?.(e); } catch (err) { console.error('onShellReflectHit', err); } },
    onStealResult: (e) => { try { D.onStealResult?.(e); } catch (err) { console.error('onStealResult', err); } },
    onReconnecting: (attempt) => {
      if (!active) return;
      netDown = true;
      setNetBanner(`連線不穩，正在重連（第 ${attempt} 次）…`);
      if (attempt === 1) D.toast('廣場連線中斷，正在重連…', '#ffb08a');
    },
    onSocketReconnected: () => {
      if (!active) return;
      setNetBanner('連上了，正在回到廣場…');
    },
    onRejoined: (s, chat) => { if (active) void restoreAfterRejoin(s, chat); },
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
    lookYaw: Number(p?.lookYaw ?? p?.LookYaw ?? 0),
    pitch: Number(p?.pitch ?? p?.Pitch ?? 0),
    head: p?.head ?? p?.Head ?? 'hd_basic',
    hand: p?.hand ?? p?.Hand ?? 'hn_basic',
    body: p?.body ?? p?.Body ?? 'bd_basic',
    legs: p?.legs ?? p?.Legs ?? 'lg_basic',
    feet: p?.feet ?? p?.Feet ?? 'ft_basic',
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
/* 高於 #plazaTags(8800)、#seatCard(8900)，聊天窗不被人名／座位指示蓋住 */
#plazaRoot{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:inherit}
#plazaRoot *{box-sizing:border-box}
/* 人數提示改走遊戲 #top；此層僅保留作內部狀態字串，預設隱藏以免蓋住 HUD */
#pzHud{display:none}
#pzNet{display:none;pointer-events:none;position:absolute;top:calc(env(safe-area-inset-top) + 108px);left:50%;transform:translateX(-50%);max-width:min(86vw,360px);background:rgba(80,28,12,.92);border:2px solid #ffb08a;border-radius:12px;padding:8px 14px;font-weight:900;font-size:14px;color:#ffe0c0;text-align:center;line-height:1.35;z-index:4;box-shadow:0 4px 14px #0008}
#pzNet.on{display:block}
#pzNet.ok{background:rgba(20,48,28,.92);border-color:#9be37a;color:#d8ffc8}
/* 右下：避開上方狀態列、左下搖桿／聊天 */
#pzX{pointer-events:auto;position:absolute;top:auto;bottom:calc(env(safe-area-inset-bottom) + 18px);right:calc(env(safe-area-inset-right) + 12px);left:auto;min-width:42px;height:44px;padding:0 14px;font-size:14px;z-index:3;background:#d9952b;color:#2a1600;border:0;border-radius:12px;font-weight:800;white-space:nowrap;box-shadow:2px 2px 0 #1b1208}
#pzX.hide{display:none}
@media (pointer:coarse){#pzX{bottom:calc(env(safe-area-inset-bottom) + 16px);right:calc(env(safe-area-inset-right) + 12px);min-height:48px;padding:0 16px;font-size:15px}}
/* 橫向矮屏視角鈕也在右下，離開鈕改疊在上方 */
@media (pointer:coarse) and (orientation:landscape) and (max-height:500px){#pzX{bottom:calc(env(safe-area-inset-bottom) + 68px)}}
/* 聊天放左側，避開右下雨傘／丟殼／偷 */
#pzChatFab{pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 168px);z-index:3;min-width:48px;height:44px;padding:0 12px;border:0;border-radius:12px;background:#d9952b;color:#2a1600;font-weight:900;font-size:14px;box-shadow:2px 2px 0 #1b1208}
#pzChatFab .pzBadge{display:none;position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#e23b2f;color:#fff;font-size:11px;font-weight:900;line-height:18px;text-align:center;box-shadow:0 1px 0 #1b1208;pointer-events:none}
#pzChatFab.hasUnread .pzBadge{display:block}
#pzChatFab.hasUnread{animation:pzFabPulse .9s ease-in-out 2}
@keyframes pzFabPulse{0%,100%{transform:scale(1)}40%{transform:scale(1.06)}}
#pzChatPeek{display:none;pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 220px);max-width:min(70vw,280px);background:rgba(20,12,6,.92);border:2px solid #d9952b;border-radius:12px;padding:8px 10px;color:#fff6d8;font-size:12px;line-height:1.35;z-index:3;cursor:pointer;box-shadow:2px 2px 0 #1b1208}
#pzChatPeek.on{display:block}
#pzChatPeek b{color:#ffd23f;font-weight:900}
#pzChat{display:none;pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 220px);width:min(58vw,260px);max-width:calc(100vw - 24px);background:rgba(20,12,6,.88);border:2px solid #d9952b;border-radius:12px;padding:8px;color:#fff6d8;z-index:3}
#pzChat.open{display:block}
/* 電腦：聊天鈕底部與「離開廣場」切齊；視窗／預覽叠在鈕上方 */
@media (pointer:fine){
  #pzChatFab{bottom:calc(env(safe-area-inset-bottom) + 18px);height:44px}
  #pzChatPeek{bottom:calc(env(safe-area-inset-bottom) + 70px)}
  #pzChat{bottom:calc(env(safe-area-inset-bottom) + 70px)}
}
/* 電腦寬螢幕：聊天窗加寬，方便看長句 */
@media (pointer:fine) and (min-width:900px){
  #pzChat{width:min(36vw,420px)}
  #pzChatPeek{max-width:min(36vw,420px)}
  #pzLog{height:88px}
}
@media (pointer:coarse) and (orientation:landscape){
  #pzChatFab{bottom:calc(env(safe-area-inset-bottom) + 120px)}
  #pzChatPeek{bottom:calc(env(safe-area-inset-bottom) + 172px);max-width:min(42vw,240px)}
  #pzChat{bottom:calc(env(safe-area-inset-bottom) + 172px);width:min(42vw,240px)}
}
#pzChatHd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:12px;font-weight:800;color:#ffd23f}
#pzChatMin{pointer-events:auto;background:transparent;border:0;color:#ffd23f;font-size:18px;line-height:1;padding:2px 6px;font-weight:900}
#pzLog{height:64px;overflow:auto;font-size:12px;line-height:1.35;margin-bottom:6px}
#pzRow{display:flex;gap:6px}
#pzRow input{flex:1;min-width:0;border-radius:8px;border:2px solid #6b3a12;background:#1a1008;color:#fff6d8;padding:6px 8px;font-size:14px}
#pzRow button{pointer-events:auto;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;padding:8px 12px}
@media (max-width:420px){#pzChat{width:min(72vw,240px)}#pzLog{height:52px}}
</style>
<button id="pzX" type="button" aria-label="離開廣場">離開廣場</button>
<div id="pzHud">準備中…</div>
<div id="pzNet" role="status" aria-live="polite"></div>
<button id="pzChatFab" type="button" aria-label="聊天">聊天<span class="key"> (ENTER)</span><span class="pzBadge" aria-hidden="true">0</span></button>
<button id="pzChatPeek" type="button" aria-label="打開聊天"></button>
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
  const peek = ui.querySelector('#pzChatPeek') as HTMLElement;
  const inp = ui.querySelector('#pzIn') as HTMLInputElement;
  fab.addEventListener('click', () => {
    if (chat.classList.contains('open')) plazaCloseChat();
    else plazaFocusChat();
  });
  peek.addEventListener('click', () => plazaFocusChat());
  ui.querySelector('#pzChatMin')!.addEventListener('click', () => plazaCloseChat());
  ui.querySelector('#pzSend')!.addEventListener('click', sendChat);
  inp.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Enter') { ke.preventDefault(); sendChat(); }
    if (ke.key === 'Escape') { ke.preventDefault(); plazaCloseChat(); }
  });
  chatUnread = 0;
  plazaCloseChat();
  hideChatPeek();
}

function scrollChatLogToEnd() {
  const log = ui?.querySelector('#pzLog') as HTMLElement | null;
  if (!log) return;
  log.scrollTop = log.scrollHeight;
}

function setChatOpen(open: boolean) {
  const chat = ui?.querySelector('#pzChat') as HTMLElement | null;
  const fab = ui?.querySelector('#pzChatFab') as HTMLElement | null;
  if (!chat || !fab) return;
  chat.classList.toggle('open', open);
  fab.style.opacity = open ? '0.55' : '1';
  if (open) {
    chatUnread = 0;
    hideChatPeek();
    syncChatBadge();
    // 縮小時 display:none，展開後才有正確 scrollHeight；雙 rAF 等 layout
    requestAnimationFrame(() => requestAnimationFrame(scrollChatLogToEnd));
  }
}

function syncChatBadge() {
  const fab = ui?.querySelector('#pzChatFab') as HTMLElement | null;
  const badge = fab?.querySelector('.pzBadge') as HTMLElement | null;
  if (!fab || !badge) return;
  const n = chatUnread;
  fab.classList.toggle('hasUnread', n > 0);
  badge.textContent = n > 99 ? '99+' : String(n);
  fab.setAttribute('aria-label', n > 0 ? `聊天，${n} 則未讀` : '聊天');
}

function hideChatPeek() {
  if (chatPeekTimer) { clearTimeout(chatPeekTimer); chatPeekTimer = null; }
  ui?.querySelector('#pzChatPeek')?.classList.remove('on');
}

/** 縮小中：短暫預覽最新一句，點了開聊天 */
function showChatPeek(nick: string, text: string) {
  const peek = ui?.querySelector('#pzChatPeek') as HTMLElement | null;
  if (!peek || plazaChatIsOpen()) return;
  const short = text.length > 36 ? text.slice(0, 35) + '…' : text;
  peek.innerHTML = `<b>${escChat(nick)}</b> ${escChat(short)}`;
  peek.classList.add('on');
  if (chatPeekTimer) clearTimeout(chatPeekTimer);
  chatPeekTimer = setTimeout(() => { chatPeekTimer = null; peek.classList.remove('on'); }, 4200);
}

function escChat(s: string) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Enter／點聊天：打開並直接打字 */
export function plazaFocusChat() {
  if (!active || !ui) return false;
  setChatOpen(true);
  const inp = ui.querySelector('#pzIn') as HTMLInputElement | null;
  if (!inp) return true;
  // 下一幀 focus，避開 pointer lock 剛退出／按鍵還在冒泡
  requestAnimationFrame(() => {
    try { inp.focus({ preventScroll: true }); } catch { inp.focus(); }
  });
  return true;
}

export function plazaCloseChat() {
  const inp = ui?.querySelector('#pzIn') as HTMLInputElement | null;
  if (inp && document.activeElement === inp) inp.blur();
  setChatOpen(false);
  return true;
}

export function plazaChatIsOpen() {
  return !!ui?.querySelector('#pzChat')?.classList.contains('open');
}

function showRoamUi() {
  syncSeatChrome();
}

/** 走動才顯示離開；坐下改用遊戲內 quit／🚶。上方狀態一律用遊戲 #top／#stats */
function syncSeatChrome() {
  const leave = ui?.querySelector('#pzX') as HTMLElement | null;
  if (leave) leave.classList.toggle('hide', seated);
}

function setHud(t: string) {
  const el = ui?.querySelector('#pzHud'); if (el) el.textContent = t;
  syncSeatChrome();
  syncPlazaPeopleHud();
}

/** 廣場人數顯示在遊戲 #stats 的 #onHud（人數圖示），坐下／閒逛皆可見 */
function syncPlazaPeopleHud() {
  const h = document.getElementById('onHud');
  const nEl = document.getElementById('onHudN');
  if (!h || !nEl) return;
  if (!active) {
    delete h.dataset.plaza;
    h.style.display = 'none';
    h.removeAttribute('title');
    h.setAttribute('aria-label', '目前線上人數');
    return;
  }
  const n = snap?.players?.length ?? snap?.occupied ?? 0;
  const cap = snap?.capacity ?? PLAZA_CAPACITY;
  h.dataset.plaza = '1';
  h.style.display = '';
  nEl.textContent = String(n);
  h.title = `廣場目前 ${n} 人（可坐 ${cap}）`;
  h.setAttribute('aria-label', h.title);
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

/** 走動時更新附近空位（資訊只走遊戲 #seatCard，不再另顯示底部提示） */
export function plazaUpdateNear(wx: number, wz: number) {
  if (!active || seated) { near = null; view?.highlightNear(null); return null; }
  const n = nearestFreeSeat(wx, wz, takenSet(true), SIT_DIST);
  near = n ? { pileId: n.pileId, slot: n.slot } : null;
  view?.highlightNear(near);
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
    seated = true; near = null;
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
    const lockLook = deps.getTpv?.() ?? false;
    void client.sync(
      p.x, p.z, deps.getYaw(), 'walk', deps.getCount(), false, deps.getUmb(),
      lockLook ? 0 : (deps.getLookYaw?.() ?? 0),
      lockLook ? 0 : (deps.getPitch?.() ?? 0),
    );
  }
}

function sendChat() {
  const input = ui?.querySelector('#pzIn') as HTMLInputElement | null;
  if (!input || !client) return;
  const t = input.value.trim(); if (!t) return;
  input.value = '';
  void client.chat(t, false).then(r => { if (!r.ok) deps?.toast(zhErr(r.err), '#ff8a7a'); });
}

function chatRowKey(m: PlazaChat) {
  return `${m.at}|${m.pid || ''}|${m.nick}|${m.text}`;
}

function appendChatRow(m: PlazaChat) {
  const log = ui?.querySelector('#pzLog'); if (!log) return;
  const row = document.createElement('div');
  row.dataset.ck = chatRowKey(m);
  const where = m.pileId != null ? `[堆${m.pileId + 1}] ` : '';
  row.textContent = `${where}${m.nick}：${m.text}`;
  log.appendChild(row);
  while (log.childElementCount > 40) log.firstChild?.remove();
  log.scrollTop = log.scrollHeight;
}

/** 進場／重連：用伺服器近期紀錄覆寫聊天窗（補離線空窗；不彈泡泡） */
function applyChatHistory(msgs?: PlazaChat[] | null) {
  const log = ui?.querySelector('#pzLog'); if (!log) return;
  if (!msgs?.length) return;
  const normalized = msgs.map(normChat).filter(m => m.text);
  if (!normalized.length) return;
  log.innerHTML = '';
  for (const m of normalized) appendChatRow(m);
}

function pushChat(m: PlazaChat) {
  const log = ui?.querySelector('#pzLog'); if (!log) return;
  const key = chatRowKey(m);
  // 與歷史回放重複則略過（避免重連後又收到同則即時包）
  if (Array.from(log.children).some(el => (el as HTMLElement).dataset.ck === key)) return;
  appendChatRow(m);
  const isSelf = Boolean(deps && (m.pid === deps.id || (!!m.connId && m.connId === client?.connectionId)));
  view?.showChat({ connId: m.connId || undefined, pid: m.pid || undefined, nick: m.nick, text: m.text, self: isSelf });
  // 僅發言端送 Discord，避免場上每人各推一則
  if (isSelf && m.text) void postDiscordPlazaChat(m.nick || '剝蚵人', m.text, { pileId: m.pileId, tag: myTag() });
  // 縮小中：角標＋短暫預覽（不自動展開，避免打斷剝蚵）
  if (!isSelf && !plazaChatIsOpen()) {
    chatUnread = Math.min(99, chatUnread + 1);
    syncChatBadge();
    showChatPeek(m.nick || '誰', m.text || '');
  }
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
    // 第三人稱走動：鎖 look，避免遠端上下點頭；第一人稱／坐下照常同步頭
    const lockLook = !seated && (deps.getTpv?.() ?? false);
    const lookYaw = lockLook ? 0 : (deps.getLookYaw?.() ?? 0);
    const pitch = lockLook ? 0 : (deps.getPitch?.() ?? 0);
    void client.sync(p.x, p.z, yaw, phase, deps.getCount(), moving, deps.getUmb(), lookYaw, pitch);
  }
}

/** 收工／結算時藏廣場 UI（離開鈕、聊天），避免擋結果面板 */
export function plazaHideChrome(hide = true) {
  if (!ui) return;
  ui.style.display = hide ? 'none' : '';
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
  const nick = deps?.nick() ?? '剝蚵人';
  const online = snap?.occupied ?? snap?.players?.length ?? null;
  const announceLeave = plazaIoAnnounced;
  active = false; seated = false; shiftStarted = false; netDown = false; plazaIoAnnounced = false;
  chatUnread = 0; hideChatPeek();
  clearReconnectTimer();
  syncPlazaPeopleHud();
  if (leaveSeat) await client?.leaveSeat();
  await client?.disconnect();
  client = null;
  view?.dispose(); view = null;
  ui?.remove(); ui = null;
  myPile = null; mySlot = null; snap = null; deps = null; near = null;
  if (announceLeave) void postDiscordPlazaPresence(nick, 'leave', { online: online != null ? Math.max(0, online - 1) : null, tag: myTag() });
}

export function plazaEndCleanup() {
  plazaHideChrome(true);
}
