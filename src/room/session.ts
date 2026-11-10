import { RoomClient } from './hubClient';
import { ROOM_SCENES, roomModeLabel, roomSceneName, roomZhErr, type RoomSnap } from './types';

export type RoomHooks = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string) => void;
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

export function bindRoom(h: RoomHooks) { hooks = h; }
export function isRoomActive() { return !!snap; }
export function currentRoomSnap() { return snap; }
export function roomRemainSec() { return snap?.remainSec ?? 0; }

export function openRoomCreate() { showSetup('create'); }
export function openRoomJoin() { showSetup('join'); }

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
  if (!hooks?.canEnter()) { hooks?.toast('現在沒辦法開房間', '#ff8a7a'); return; }
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
    void doCreate(scene, Number(seats.value), mode, Number(dur.value) * 60, Number(goal.value));
  });
}

async function ensureClient() {
  if (client) return client;
  const c = new RoomClient();
  await c.connect({
    onState: applySnap,
    onKicked: () => { hooks?.toast('你被請出房間了', '#ff8a7a'); void kickedOut(); },
    onClose: () => { if (snap) hooks?.toast('好友房連線中斷', '#ff8a7a'); },
  });
  client = c;
  return c;
}

async function doCreate(scene: string, seats: number, mode: string, durationSec: number, goalMeat: number) {
  const h = hooks; if (!h) return;
  try {
    const c = await ensureClient();
    const r = await c.create(h.id, h.nick(), scene, seats, mode, durationSec, goalMeat);
    if (!r.ok || !r.snap) { h.toast(roomZhErr(r.err), '#ff8a7a'); return; }
    c.token = r.token || '';
    hideModal();
    enterWith(r.snap);
  } catch {
    h.toast('暫時連不上房間伺服器', '#ff8a7a');
  }
}

async function doJoin(code: string) {
  const h = hooks; if (!h) return;
  const raw = code.trim().toUpperCase();
  if (raw.length !== 6) { h.toast('房間代碼要 6 個字', '#ff8a7a'); return; }
  try {
    const c = await ensureClient();
    const r = await c.join(h.id, h.nick(), raw);
    if (!r.ok || !r.snap) { h.toast(roomZhErr(r.err), '#ff8a7a'); return; }
    c.token = r.token || '';
    hideModal();
    enterWith(r.snap);
  } catch {
    h.toast('暫時連不上房間伺服器', '#ff8a7a');
  }
}

function enterWith(s: RoomSnap) {
  snap = s; lastPhase = ''; playStarted = false; reported = false;
  hooks?.audio();
  hooks?.enterScene(s.scene, () => { applySnap(s); });
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
    lastPhase = s.phase;
  }
  if (s.phase === 'lobby') hooks?.applyScene(s.scene);
  if (s.phase === 'countdown' || (s.phase === 'play' && s.endMode === 'timed')) startRemainClock();
  else stopRemainClock();
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
    h.toast(roomZhErr(r?.err), '#ff8a7a');
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
  snap = null; lastPhase = ''; playStarted = false; reported = false;
  const c = client; client = null;
  try { await c?.stop(); } catch { /* ignore */ }
  if (layer) { layer.classList.remove('show'); layer.innerHTML = ''; }
  hideModal();
  document.body.classList.remove('roomMode', 'roomLobby', 'roomPlay', 'roomResults');
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
  const modeTxt = roomModeLabel(s.endMode, s.durationSec, s.goalMeat);
  const countTxt = s.phase === 'countdown' ? `即將開始 ${Math.max(1, s.remainSec)}` : '';
  const list = s.players.map(p => {
    const you = p.pid === h.id ? '（你）' : '';
    const mark = s.phase === 'lobby' || s.phase === 'countdown' ? (p.ready ? '已準備' : '還沒好') : `${p.meat} 顆`;
    const pay = s.phase === 'results' && p.settled ? `・$${p.payout}` : '';
    const acts = host && p.pid !== h.id && s.phase === 'lobby'
      ? `<button type="button" data-kick="${esc(p.pid)}">請出</button><button type="button" data-tr="${esc(p.pid)}">轉讓</button>`
      : '';
    return `<li class="${p.host ? 'host' : ''}${p.pid === h.id ? ' me' : ''}"><b>${esc(p.nick)}${you}</b><small>${p.host ? '房主・' : ''}#${esc(p.tag)}・${mark}${pay}</small>${acts}</li>`;
  }).join('');
  const edit = host && s.phase === 'lobby' ? `<details class="rmEdit"><summary>改規則</summary>
    <div class="rmScenes">${ROOM_SCENES.map(sc => `<button type="button" class="rmScene${sc.id === s.scene ? ' on' : ''}" data-edsc="${sc.id}">${esc(sc.n)}</button>`).join('')}</div>
    <label>人數 <span id="rmEdSeatsLab">${s.seats}</span></label>
    <input id="rmEdSeats" type="range" min="${Math.max(2, s.players.length)}" max="8" value="${s.seats}" />
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
    <div class="rmHead"><b>好友房 ${esc(s.code)}</b><small>${esc(roomSceneName(s.scene))}・${s.players.length}/${s.seats} 人・${esc(modeTxt)}${s.phase === 'play' && s.endMode === 'timed' ? `・<span id="rmRemain">剩 ${s.remainSec} 秒</span>` : ''}${countTxt ? '・' + countTxt : ''}</small></div>
    ${s.phase === 'countdown' ? `<div class="rmCount">${Math.max(1, s.remainSec)}</div>` : ''}
    <ul class="rmList">${list}</ul>
    ${s.phase === 'lobby' && s.players.length < 2 ? `<p class="rmWait">至少要 2 人才能開始，把房間代碼 ${esc(s.code)} 傳給朋友吧</p>` : ''}
    ${edit}
    <div class="rmActs">${lobbyBtns}${playBtns}${resBtns}${s.phase !== 'results' ? `<button type="button" id="rmLeave">離開房間</button>` : ''}</div>
  </div>`;
  el.classList.add('show');
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
    const durEl = el.querySelector('#rmEdDur') as HTMLInputElement;
    const goalEl = el.querySelector('#rmEdGoal') as HTMLInputElement;
    seatsEl.oninput = () => { (el.querySelector('#rmEdSeatsLab') as HTMLElement).textContent = seatsEl.value; };
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
    apply.onclick = () => void act(() => client!.edit(sc, Number(seatsEl.value), md, Number(durEl.value) * 60, Number(goalEl.value)));
  }
}

async function act(fn: () => Promise<{ ok: boolean; err?: string; snap?: RoomSnap }>) {
  if (!client) return;
  const r = await fn();
  if (!r.ok) hooks?.toast(roomZhErr(r.err), '#ff8a7a');
  else if (r.snap) applySnap(r.snap);
}
