import { RoomClient } from './hubClient';
import { createRoomAvatarView, type RoomAvatarView } from './avatarView';
import { roomPhysicalSeats, roomSeatPose } from './seats';
import { ROOM_SCENES, roomModeLabel, roomSceneName, roomZhErr, type RoomBody, type RoomSnap } from './types';

export type RoomHooks = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string, sec?: number, place?: 'mid' | 'top') => void;
  audio: () => void;
  enterScene: (scene: string, then: () => void) => void;
  applyScene: (scene: string) => void;
  startPlay: () => void;
  finishPlay: () => { earn: number; count: number; durSec: number };
  leaveScene: () => void;
  getCount: () => number;
  getEarn: () => number;
  grantPayout: (n: number) => void;
  canEnter: () => boolean;
  getScene: () => import('three').Scene;
  hideYardExtras: (hide: boolean) => void;
  enterWalk: () => void;
  applySeatPose: (x: number, z: number, yaw: number) => void;
  afterStand: () => void;
  getWalkXZ: () => { x: number; z: number };
  getYaw: () => number;
  getLookYaw: () => number;
  getPitch: () => number;
  getPhase: () => string;
  getMoving: () => boolean;
  getUmb: () => boolean;
  getOutfit: () => { hair: string; head: string; hand: string; body: string; legs: string; feet: string };
  getCosmetics: () => string;
  isWalking: () => boolean;
};

let hooks: RoomHooks | null = null;
let client: RoomClient | null = null;
let snap: RoomSnap | null = null;
let lastPhase: string = '';
let reported = false;
let syncAt = 0;
let layer: HTMLElement | null = null;
let modal: HTMLElement | null = null;
let playStarted = false;
let remainTimer = 0;
let view: RoomAvatarView | null = null;
let hudOpen = true;
let carriedConn = '';
let poseAt = 0;
let outfitSent = false;

/** 主選單好友房入口；先關閉，程式保留以便之後再開。 */
export const ROOM_ENABLED = false;

export function bindRoom(h: RoomHooks) { hooks = h; }
export function isRoomActive() { return !!snap; }
export function currentRoomSnap() { return snap; }
export function roomRemainSec() { return snap?.remainSec ?? 0; }

export function openRoomCreate() { if (!ROOM_ENABLED) return; showSetup('create'); }
export function openRoomJoin() { if (!ROOM_ENABLED) return; showSetup('join'); }

export async function closeRoom(backToMenu = true) {
  const h = hooks;
  try { await client?.leave(); } catch { /* ignore */ }
  await teardown();
  if (backToMenu) h?.leaveScene();
}

export function roomSyncScore() {
  if (!snap || snap.phase !== 'play' || !client) return;
  const now = performance.now();
  if (now - syncAt < 800) return;
  syncAt = now;
  void client.syncScore(hooks?.getCount() ?? 0, hooks?.getEarn() ?? 0);
}

function esc(v: string) {
  return v.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
}

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'roomLayer';
  document.body.appendChild(layer);
  const place = () => placeRoomHud();
  addEventListener('resize', place);
  addEventListener('orientationchange', () => setTimeout(place, 60));
  return layer;
}

function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'roomModal';
  document.body.appendChild(modal);
  return modal;
}

function hideModal() {
  if (modal) { modal.classList.remove('show'); modal.innerHTML = ''; }
}

function showSetup(kind: 'create' | 'join') {
  if (!hooks?.canEnter()) { hooks?.toast('現在沒辦法開房間', '#ff8a7a', 3, 'top'); return; }
  const el = ensureModal();
  if (kind === 'join') {
    el.innerHTML = `<div class="rmCard"><h3>加入房間</h3>
      <p>輸入 6 碼房間代碼</p>
      <input id="rmCodeIn" maxlength="6" autocomplete="off" spellcheck="false" placeholder="例如 A3K7P2" />
      <div class="rmActs"><button type="button" class="rmPri" id="rmGoJoin">加入</button><button type="button" id="rmCancel">取消</button></div></div>`;
    el.classList.add('show');
    const input = el.querySelector('#rmCodeIn') as HTMLInputElement;
    input.focus();
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
    el.querySelector('#rmCancel')!.addEventListener('click', hideModal);
    el.querySelector('#rmGoJoin')!.addEventListener('click', () => void doJoin(input.value));
    input.addEventListener('keydown', ev => { if (ev.key === 'Enter') void doJoin(input.value); });
    return;
  }
  el.innerHTML = `<div class="rmCard"><h3>開房間</h3>
    <label>場景</label>
    <div class="rmScenes">${ROOM_SCENES.map((s, i) => `<button type="button" class="rmScene${i === 0 ? ' on' : ''}" data-sc="${s.id}">${esc(s.n)}</button>`).join('')}</div>
    <label>人數 <span id="rmSeatsLab">4</span></label>
    <input id="rmSeats" type="range" min="2" max="8" value="4" />
    <label>鄰居數量 <span id="rmNpcLab">2</span></label>
    <input id="rmNpcs" type="range" min="0" max="4" value="2" />
    <p class="rmHint">鄰居會坐著一起剝蚵，不算在 2 人下限或人數上限裡</p>
    <label>結束條件</label>
    <div class="rmModes">
      <button type="button" class="rmMode on" data-m="untimed">不限時</button>
      <button type="button" class="rmMode" data-m="timed">限時</button>
      <button type="button" class="rmMode" data-m="goal">顆數</button>
    </div>
    <div id="rmTimedRow" class="rmSub" hidden><label>分鐘 <span id="rmDurLab">5</span></label><input id="rmDur" type="range" min="3" max="20" value="5" /></div>
    <div id="rmGoalRow" class="rmSub" hidden><label>目標顆數 <span id="rmGoalLab">100</span></label><input id="rmGoal" type="range" min="50" max="300" step="10" value="100" /></div>
    <div class="rmActs"><button type="button" class="rmPri" id="rmGoCreate">開房間</button><button type="button" id="rmCancel">取消</button></div></div>`;
  el.classList.add('show');
  let scene = 'home', mode = 'untimed';
  el.querySelectorAll<HTMLButtonElement>('.rmScene').forEach(b => b.onclick = () => {
    scene = b.dataset.sc || 'home';
    el.querySelectorAll('.rmScene').forEach(x => x.classList.toggle('on', x === b));
  });
  const seats = el.querySelector('#rmSeats') as HTMLInputElement;
  seats.oninput = () => { (el.querySelector('#rmSeatsLab') as HTMLElement).textContent = seats.value; };
  const npcs = el.querySelector('#rmNpcs') as HTMLInputElement;
  npcs.oninput = () => { (el.querySelector('#rmNpcLab') as HTMLElement).textContent = npcs.value; };
  const dur = el.querySelector('#rmDur') as HTMLInputElement;
  dur.oninput = () => { (el.querySelector('#rmDurLab') as HTMLElement).textContent = dur.value; };
  const goal = el.querySelector('#rmGoal') as HTMLInputElement;
  goal.oninput = () => { (el.querySelector('#rmGoalLab') as HTMLElement).textContent = goal.value; };
  const timedRow = el.querySelector('#rmTimedRow') as HTMLElement;
  const goalRow = el.querySelector('#rmGoalRow') as HTMLElement;
  el.querySelectorAll<HTMLButtonElement>('.rmMode').forEach(b => b.onclick = () => {
    mode = b.dataset.m || 'untimed';
    el.querySelectorAll('.rmMode').forEach(x => x.classList.toggle('on', x === b));
    timedRow.hidden = mode !== 'timed';
    goalRow.hidden = mode !== 'goal';
  });
  el.querySelector('#rmCancel')!.addEventListener('click', hideModal);
  el.querySelector('#rmGoCreate')!.addEventListener('click', () => {
    void doCreate(scene, Number(seats.value), mode, Number(dur.value) * 60, Number(goal.value), Number(npcs.value));
  });
}

async function ensureClient() {
  if (client) return client;
  const c = new RoomClient();
  await c.connect({
    onState: applySnap,
    onPose: (b) => { view?.applyPose(b); updateCarried(b); },
    onPoses: (list) => { list.forEach(b => { view?.applyPose(b); updateCarried(b); }); },
    onKicked: () => { hooks?.toast('你被請出房間了', '#ff8a7a', 3, 'top'); void kickedOut(); },
    onClose: () => { if (snap) hooks?.toast('好友房連線中斷', '#ff8a7a', 3, 'top'); },
  });
  client = c;
  return c;
}

async function doCreate(scene: string, seats: number, mode: string, durationSec: number, goalMeat: number, npcCount: number) {
  const h = hooks; if (!h) return;
  try {
    const c = await ensureClient();
    const r = await c.create(h.id, h.nick(), scene, seats, mode, durationSec, goalMeat, npcCount);
    if (!r.ok || !r.snap) { h.toast(roomZhErr(r.err), '#ff8a7a', 3, 'top'); return; }
    c.token = r.token || '';
    hideModal();
    enterWith(r.snap);
  } catch {
    h.toast('暫時連不上房間伺服器', '#ff8a7a', 3, 'top');
  }
}

async function doJoin(code: string) {
  const h = hooks; if (!h) return;
  const raw = code.trim().toUpperCase();
  if (raw.length !== 6) { h.toast('房間代碼要 6 個字', '#ff8a7a', 2.5, 'top'); return; }
  try {
    const c = await ensureClient();
    const r = await c.join(h.id, h.nick(), raw);
    if (!r.ok || !r.snap) { h.toast(roomZhErr(r.err), '#ff8a7a', 3, 'top'); return; }
    c.token = r.token || '';
    hideModal();
    enterWith(r.snap);
  } catch {
    h.toast('暫時連不上房間伺服器', '#ff8a7a', 3, 'top');
  }
}

function enterWith(s: RoomSnap) {
  snap = s; lastPhase = ''; playStarted = false; reported = false; hudOpen = true; carriedConn = ''; outfitSent = false;
  hooks?.audio();
  hooks?.enterScene(s.scene, () => {
    const h = hooks;
    if (h?.getScene) {
      view?.dispose();
      view = createRoomAvatarView(h.getScene(), () => h.id);
    }
    h?.hideYardExtras(true);
    h?.enterWalk();
    applySnap(s);
    void pushOutfit();
  });
}

function applySnap(s: RoomSnap) {
  const prev = lastPhase;
  snap = s;
  if (prev !== s.phase) {
    if (s.phase === 'lobby' && (prev === 'results' || prev === 'play' || prev === 'countdown' || !prev)) {
      playStarted = false; reported = false;
      if (prev === 'results') hooks?.applyScene(s.scene);
    }
    if (s.phase === 'play' && !playStarted) {
      playStarted = true;
      hooks?.startPlay();
    }
    if (s.phase === 'results' && prev !== 'results') void onResults(s);
    if (s.phase === 'play') hudOpen = false;
    else if (s.phase === 'lobby' || s.phase === 'countdown') hudOpen = true;
    lastPhase = s.phase;
  }
  if (s.phase === 'lobby') hooks?.applyScene(s.scene);
  if (s.phase === 'countdown' || (s.phase === 'play' && s.endMode === 'timed')) startRemainClock();
  else stopRemainClock();
  syncView(s);
  renderHud(s);
}

async function onResults(s: RoomSnap) {
  const h = hooks; if (!h || reported) return;
  const info = h.finishPlay();
  reported = true;
  const r = await client?.reportEarn(info.earn, info.count, info.durSec);
  if (r?.ok) {
    h.grantPayout(r.payout ?? 0);
    if (r.snap) { snap = r.snap; renderHud(r.snap); }
  } else {
    h.toast(roomZhErr(r?.err), '#ff8a7a', 3, 'top');
    renderHud(s);
  }
}

async function kickedOut() {
  await teardown();
  hooks?.leaveScene();
}

function stopRemainClock() {
  if (remainTimer) { clearInterval(remainTimer); remainTimer = 0; }
}

function tickRemain() {
  if (!snap) return;
  if (snap.phase === 'countdown') {
    const sec = Math.max(0, Math.ceil((3000 - (Date.now() - snap.phaseAt)) / 1000));
    if (sec !== snap.remainSec) { snap = { ...snap, remainSec: sec }; renderHud(snap); }
  } else if (snap.phase === 'play' && snap.endMode === 'timed') {
    const sec = Math.max(0, Math.ceil((snap.playAt + snap.durationSec * 1000 - Date.now()) / 1000));
    if (sec !== snap.remainSec) {
      snap = { ...snap, remainSec: sec };
      const el = document.getElementById('rmRemain');
      if (el) el.textContent = `剩 ${sec} 秒`;
    }
  }
}

function startRemainClock() {
  if (remainTimer) return;
  remainTimer = window.setInterval(tickRemain, 250);
}

async function teardown() {
  stopRemainClock();
  view?.dispose(); view = null;
  hooks?.hideYardExtras(false);
  carriedConn = ''; outfitSent = false; hudOpen = true;
  snap = null; lastPhase = ''; playStarted = false; reported = false;
  const c = client; client = null;
  try { await c?.stop(); } catch { /* ignore */ }
  if (layer) { layer.classList.remove('show'); layer.innerHTML = ''; }
  hideModal();
  document.body.classList.remove('roomMode', 'roomLobby', 'roomPlay', 'roomResults');
}


function rankingLine(s: RoomSnap, selfId: string) {
  const people = (s.bodies && s.bodies.length ? s.bodies : [
    ...s.players.map(p => ({ ...p, isNpc: false, meat: p.meat })),
    ...(s.npcs ?? []),
  ]).slice();
  people.sort((a, b) => (b.meat ?? 0) - (a.meat ?? 0));
  return people.slice(0, 4).map(p => {
    const you = p.pid === selfId ? '你' : p.nick;
    return `${you} ${p.meat}`;
  }).join(' · ');
}

function placeRoomHud() {
  if (!layer) return;
  if (document.body.classList.contains('roomResults')) {
    layer.style.top = '';
    return;
  }
  let y = 8;
  try {
    const sa = getComputedStyle(document.documentElement).getPropertyValue('--sa-top');
    const n = parseInt(sa, 10);
    if (Number.isFinite(n)) y = Math.max(y, n + 6);
  } catch { /* ignore */ }
  for (const id of ['top', 'stats']) {
    const e = document.getElementById(id);
    if (!e) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.height > 0 && r.top < innerHeight * 0.5) y = Math.max(y, Math.round(r.bottom + 6));
  }
  layer.style.top = `${y}px`;
}

function renderHud(s: RoomSnap) {
  const h = hooks; if (!h) return;
  const el = ensureLayer();
  const me = s.players.find(p => p.pid === h.id);
  const host = !!me?.host;
  document.body.classList.add('roomMode');
  document.body.classList.toggle('roomLobby', s.phase === 'lobby' || s.phase === 'countdown');
  document.body.classList.toggle('roomPlay', s.phase === 'play');
  document.body.classList.toggle('roomResults', s.phase === 'results');
  const open = s.phase === 'results' || hudOpen;
  el.classList.toggle('rmOpen', open);
  const modeTxt = roomModeLabel(s.endMode, s.durationSec, s.goalMeat);
  const live = (s.phase === 'play' || s.phase === 'results') ? rankingLine(s, h.id) : '';
  const sub = `${roomSceneName(s.scene)}·${s.players.length}/${s.seats} 人·鄰居 ${s.npcCount ?? 0}·${modeTxt}`
    + (s.phase === 'play' && s.endMode === 'timed' ? `·<span id="rmRemain">剩 ${s.remainSec} 秒</span>` : '')
    + (s.phase === 'countdown' ? `·即將開始` : '');
  const humans = s.players.map(p => {
    const you = p.pid === h.id ? '（你）' : '';
    const mark = s.phase === 'lobby' || s.phase === 'countdown' ? (p.ready ? '已準備' : '還沒好') : `${p.meat} 顆`;
    const pay = s.phase === 'results' && p.settled ? `·$${p.payout}` : '';
    const acts = host && p.pid !== h.id && s.phase === 'lobby'
      ? `<button type="button" data-kick="${esc(p.pid)}">請出</button><button type="button" data-tr="${esc(p.pid)}">轉讓</button>`
      : '';
    return `<li class="${p.host ? 'host' : ''}${p.pid === h.id ? ' me' : ''}"><b>${esc(p.nick)}${you}</b><small>${p.host ? '房主·' : ''}#${esc(p.tag)}·${mark}${pay}</small>${acts}</li>`;
  }).join('');
  const npcLis = (s.npcs ?? []).map(n => `<li class="npc"><b>${esc(n.nick)}</b><small>鄰居·${n.meat} 顆${s.phase === 'results' ? '·不發獎' : ''}</small></li>`).join('');
  const edit = host && s.phase === 'lobby' ? `<details class="rmEdit"><summary>改規則</summary>
    <div class="rmScenes">${ROOM_SCENES.map(sc => `<button type="button" class="rmScene${sc.id === s.scene ? ' on' : ''}" data-edsc="${sc.id}">${esc(sc.n)}</button>`).join('')}</div>
    <label>人數 <span id="rmEdSeatsLab">${s.seats}</span></label>
    <input id="rmEdSeats" type="range" min="${Math.max(2, s.players.length)}" max="8" value="${s.seats}" />
    <label>鄰居數量 <span id="rmEdNpcLab">${s.npcCount ?? 2}</span></label>
    <input id="rmEdNpcs" type="range" min="0" max="4" value="${s.npcCount ?? 2}" />
    <div class="rmModes">
      <button type="button" class="rmMode${s.endMode === 'untimed' ? ' on' : ''}" data-edm="untimed">不限時</button>
      <button type="button" class="rmMode${s.endMode === 'timed' ? ' on' : ''}" data-edm="timed">限時</button>
      <button type="button" class="rmMode${s.endMode === 'goal' ? ' on' : ''}" data-edm="goal">顆數</button>
    </div>
    <label>分鐘 <span id="rmEdDurLab">${Math.round(s.durationSec / 60)}</span></label>
    <input id="rmEdDur" type="range" min="3" max="20" value="${Math.round(s.durationSec / 60)}" />
    <label>目標顆數 <span id="rmEdGoalLab">${s.goalMeat}</span></label>
    <input id="rmEdGoal" type="range" min="50" max="300" step="10" value="${s.goalMeat}" />
    <button type="button" class="rmPri" id="rmApplyEdit">套用</button>
  </details>` : '';
  const playBtns = s.phase === 'play' && host && s.endMode === 'untimed'
    ? `<button type="button" class="rmPri" id="rmEnd">結束本局</button>` : '';
  const lobbyBtns = s.phase === 'lobby'
    ? `<button type="button" class="rmPri" id="rmReady">${me?.ready ? '取消準備' : '準備'}</button>${host ? `<button type="button" id="rmStart"${s.players.length < 2 ? ' disabled' : ''}>開始</button>` : ''}`
    : '';
  const resBtns = s.phase === 'results'
    ? `${host ? `<button type="button" class="rmPri" id="rmAgain">再來一局</button>` : '<p class="rmWait">等房主再來一局</p>'}<button type="button" id="rmLeaveRes">離開</button>`
    : '';
  el.innerHTML = `<div class="rmHud">
    <button type="button" class="rmHead" id="rmToggle" aria-expanded="${open ? 'true' : 'false'}">
      <span class="rmHeadMain"><b>好友房 ${esc(s.code)}</b><small>${sub}</small></span>
      ${live && s.phase !== 'lobby' ? `<span class="rmLive">${esc(live)}</span>` : ''}
      ${s.phase !== 'results' ? `<span class="rmChev" aria-hidden="true"></span>` : ''}
    </button>
    <div class="rmDetail">
      ${s.phase === 'countdown' ? `<div class="rmCount">${Math.max(1, s.remainSec)}</div>` : ''}
      <ul class="rmList">${humans}${npcLis}</ul>
      ${s.phase === 'lobby' && s.players.length < 2 ? `<p class="rmWait">至少要 2 人才能開始，把房間代碼 ${esc(s.code)} 傳給朋友吧</p>` : ''}
      ${edit}
      <div class="rmActs">${lobbyBtns}${playBtns}${resBtns}${s.phase !== 'results' ? `<button type="button" id="rmLeave">離開房間</button>` : ''}</div>
    </div>
  </div>`;
  if (s.phase === 'countdown') {
    // 倒數放到畫面中央，避免擋住上方列
  }
  el.classList.add('show');
  placeRoomHud();
  el.querySelector('#rmToggle')?.addEventListener('click', ev => {
    ev.preventDefault();
    if (s.phase === 'results') return;
    hudOpen = !hudOpen;
    renderHud(s);
  });
  el.querySelector('#rmReady')?.addEventListener('click', () => void act(() => client!.ready(!me?.ready)));
  el.querySelector('#rmStart')?.addEventListener('click', () => void act(() => client!.start()));
  el.querySelector('#rmEnd')?.addEventListener('click', () => void act(() => client!.endMatch()));
  el.querySelector('#rmAgain')?.addEventListener('click', () => void act(() => client!.rematch()));
  el.querySelector('#rmLeave')?.addEventListener('click', () => void closeRoom(true));
  el.querySelector('#rmLeaveRes')?.addEventListener('click', () => void closeRoom(true));
  el.querySelectorAll<HTMLButtonElement>('[data-kick]').forEach(b => b.onclick = () => void act(() => client!.kick(b.dataset.kick || '')));
  el.querySelectorAll<HTMLButtonElement>('[data-tr]').forEach(b => b.onclick = () => void act(() => client!.transfer(b.dataset.tr || '')));
  const apply = el.querySelector('#rmApplyEdit') as HTMLButtonElement | null;
  if (apply) {
    const seatsEl = el.querySelector('#rmEdSeats') as HTMLInputElement;
    const npcEl = el.querySelector('#rmEdNpcs') as HTMLInputElement;
    const durEl = el.querySelector('#rmEdDur') as HTMLInputElement;
    const goalEl = el.querySelector('#rmEdGoal') as HTMLInputElement;
    seatsEl.oninput = () => { (el.querySelector('#rmEdSeatsLab') as HTMLElement).textContent = seatsEl.value; };
    npcEl.oninput = () => { (el.querySelector('#rmEdNpcLab') as HTMLElement).textContent = npcEl.value; };
    durEl.oninput = () => { (el.querySelector('#rmEdDurLab') as HTMLElement).textContent = durEl.value; };
    goalEl.oninput = () => { (el.querySelector('#rmEdGoalLab') as HTMLElement).textContent = goalEl.value; };
    let sc = s.scene, md = s.endMode;
    el.querySelectorAll<HTMLButtonElement>('[data-edsc]').forEach(b => b.onclick = () => {
      sc = b.dataset.edsc || sc;
      el.querySelectorAll('[data-edsc]').forEach(x => x.classList.toggle('on', x === b));
    });
    el.querySelectorAll<HTMLButtonElement>('[data-edm]').forEach(b => b.onclick = () => {
      md = (b.dataset.edm || md) as any;
      el.querySelectorAll('[data-edm]').forEach(x => x.classList.toggle('on', x === b));
    });
    apply.onclick = () => void act(() => client!.edit(sc, Number(seatsEl.value), md, Number(durEl.value) * 60, Number(goalEl.value), Number(npcEl.value)));
  }
}


function syncView(s: RoomSnap) {
  if (!view) return;
  view.layoutStools(s.seats, s.npcCount ?? 0);
  view.applyBodies(s.bodies ?? []);
}

function updateCarried(b: RoomBody) {
  if (!hooks) return;
  if (b.carriedBy === hooks.id) carriedConn = b.connId;
  else if (carriedConn && b.connId === carriedConn && !b.carriedBy) carriedConn = '';
}

async function pushOutfit() {
  if (!client || !hooks || outfitSent) return;
  outfitSent = true;
  const o = hooks.getOutfit();
  await client.setOutfit(o.head, o.hand, o.body, o.legs, o.feet, o.hair);
  await client.setCosmetics(hooks.getCosmetics());
}

export function roomSeated() {
  const me = snap?.bodies?.find(b => b.pid === hooks?.id) ?? snap?.players.find(p => p.pid === hooks?.id);
  return !!me && (me as any).seat >= 0;
}

export function roomWalkBodies() {
  return view?.walkBodies() ?? [];
}

export function roomNearPrompt(): { kind: 'sit' | 'carry' | 'place'; info: string; btn: string; slot?: number; npcConnId?: string } | null {
  if (!hooks || !snap || !hooks.isWalking()) return null;
  const { x, z } = hooks.getWalkXZ();
  const bodies = snap.bodies ?? [];
  if (carriedConn) {
    const seat = view?.nearSeat(x, z, bodies);
    if (seat) return { kind: 'place', info: `空位 ${seat.slot + 1}`, btn: '放下', slot: seat.slot, npcConnId: carriedConn };
    return { kind: 'place', info: '把鄰居放到空的板凳', btn: '放下' };
  }
  const npc = view?.nearNpc(x, z, bodies);
  if (npc) return { kind: 'carry', info: `抱起 ${npc.nick}`, btn: '抱起', npcConnId: npc.connId };
  const seat = view?.nearSeat(x, z, bodies);
  if (seat) return { kind: 'sit', info: `板凳 ${seat.slot + 1}`, btn: '坐這裡', slot: seat.slot };
  return null;
}

export async function roomTrySit() {
  const p = roomNearPrompt();
  if (!p || !client) return false;
  if (p.kind === 'sit' && p.slot != null) {
    const r = await client.claimSeat(p.slot);
    if (!r.ok) { hooks?.toast(roomZhErr(r.err), '#ff8a7a', 3, 'top'); return false; }
    const total = roomPhysicalSeats(snap!.seats, snap!.npcCount ?? 0);
    const pose = roomSeatPose(p.slot, total);
    hooks?.applySeatPose(pose.x, pose.z, pose.yaw);
    if (r.snap) applySnap(r.snap);
    return true;
  }
  if (p.kind === 'carry' && p.npcConnId) {
    const r = await client.carryNpc(p.npcConnId);
    if (!r.ok) { hooks?.toast(roomZhErr(r.err), '#ff8a7a', 3, 'top'); return false; }
    carriedConn = p.npcConnId;
    if (r.snap) applySnap(r.snap);
    return true;
  }
  if (p.kind === 'place' && p.npcConnId && p.slot != null) {
    const r = await client.placeNpc(p.npcConnId, p.slot);
    if (!r.ok) { hooks?.toast(roomZhErr(r.err), '#ff8a7a', 3, 'top'); return false; }
    carriedConn = '';
    if (r.snap) applySnap(r.snap);
    return true;
  }
  return false;
}

export async function roomStandWalk() {
  if (!client || !roomSeated()) return;
  const r = await client.leaveSeat();
  if (!r.ok) { hooks?.toast(roomZhErr(r.err), '#ff8a7a', 3, 'top'); return; }
  hooks?.afterStand();
  if (r.snap) applySnap(r.snap);
}

export function roomTick(dt: number) {
  view?.tick(dt);
  if (!client || !hooks || !snap || snap.phase === 'results') return;
  const now = performance.now();
  if (now - poseAt < 120) return;
  poseAt = now;
  const walk = hooks.isWalking();
  const p = hooks.getWalkXZ();
  void client.sync(
    p.x, p.z, hooks.getYaw(),
    hooks.getPhase() || (walk ? (hooks.getMoving() ? 'walk' : 'idle') : 'sit'),
    hooks.getCount(),
    hooks.getMoving(),
    hooks.getUmb(),
    walk ? 0 : hooks.getLookYaw(),
    hooks.getPitch(),
  );
}

export function roomSyncPose() { roomTick(0.05); }

async function act(fn: () => Promise<{ ok: boolean; err?: string; snap?: RoomSnap }>) {
  if (!client) return;
  const r = await fn();
  if (!r.ok) hooks?.toast(roomZhErr(r.err), '#ff8a7a', 3, 'top');
  else if (r.snap) applySnap(r.snap);
}
