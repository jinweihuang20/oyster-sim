import { RaceQueueClient } from './hubClient';
import {
  raceModeLabel, raceZhErr, type RaceMatched, type RaceMode, type RaceResults, type RaceSnap,
} from './types';

export type RaceHooks = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string, sec?: number, place?: 'mid' | 'top') => void;
  audio: () => void;
  canEnter: () => boolean;
  /** 配對成功後進小廣場對戰（plaza raceMode） */
  enterMatch: (m: RaceMatched) => void;
  /** 勝負卡：回主選單 */
  leaveMatch: () => void;
  /** 勝負卡：回主選單後用同一規則再排 */
  rematch: (mode: RaceMode) => void;
  grantMoney?: (n: number, via: string) => void;
};

const COUNTDOWN_MS = 3000;

let hooks: RaceHooks | null = null;
let queueClient: RaceQueueClient | null = null;
let modal: HTMLElement | null = null;
let hud: HTMLElement | null = null;
let countEl: HTMLElement | null = null;
let queuing = false;
let pendingMode: RaceMode | null = null;
let raceSnap: RaceSnap | null = null;
let resultsShown = false;
let countTimer = 0;
let lastCountShown = '';
let prevPhase = '';

export function bindRace(h: RaceHooks) { hooks = h; }
export function isRaceQueuing() { return queuing; }
export function currentRaceSnap() { return raceSnap; }
/** 已開打（可剝／偷／丟）；倒數／準備中／結算皆 false */
export function isRacePlayActive() {
  return !!raceSnap && raceSnap.phase === 'play';
}
/** 競速場上但還不能動手（等對手／倒數／結算） */
export function isRaceInputLocked() {
  return !!raceSnap && raceSnap.phase !== 'play';
}

export function openRaceMenu() {
  if (!hooks?.canEnter()) {
    hooks?.toast('現在沒辦法開單挑', '#ff8a7a', 3, 'top');
    return;
  }
  showMenu();
}

/** 直接用指定規則排隊（再來一場／跳過選單） */
export function startRaceQueue(mode: RaceMode) {
  if (!hooks?.canEnter()) {
    hooks?.toast('現在沒辦法開單挑', '#ff8a7a', 3, 'top');
    return;
  }
  void startQueue(mode === 'goal' ? 'goal' : 'timed');
}

export async function cancelRaceQueue() {
  queuing = false;
  pendingMode = null;
  try { await queueClient?.cancelQueue(); } catch { /* */ }
  await queueClient?.disconnect();
  queueClient = null;
  hideModal();
}

export function setRaceSnap(s: RaceSnap | null) {
  const prev = prevPhase;
  raceSnap = s;
  if (!s) {
    prevPhase = '';
    stopCountClock();
    clearRaceHud();
    hideCountOverlay();
    document.body.classList.remove('raceWait');
    return;
  }
  prevPhase = s.phase;
  renderRaceHud(s);
  syncCountOverlay(s);
  document.body.classList.toggle('raceWait', s.phase !== 'play' && s.phase !== 'results');
  if (s.phase === 'countdown') startCountClock();
  else stopCountClock();
  if (prev !== 'play' && s.phase === 'play') {
    flashGo();
    hooks?.toast('開始！', '#9be37a', 1.2, 'top');
    hooks?.audio();
  }
  if (s.phase === 'results' && !resultsShown) {
    resultsShown = true;
    hideCountOverlay();
    showResultsFromSnap(s);
  }
}

export function applyRaceResults(r: RaceResults, myPid: string) {
  resultsShown = true;
  const win = !!(r.winnerPid && r.winnerPid === myPid);
  const draw = !r.winnerPid || r.reason === 'draw';
  const me = r.players.find(p => p.pid === myPid);
  const opp = r.players.find(p => p.pid !== myPid);
  const pay = draw ? r.losePay : (win ? r.winPay : r.losePay);
  if (pay > 0) hooks?.grantMoney?.(pay, 'race');
  const title = draw ? '平手' : (win ? '勝利！' : '敗北');
  const why = r.reason === 'forfeit' ? '對手斷線判負'
    : r.reason === 'goal' ? '先達目標'
    : r.reason === 'time' ? '時間到'
    : r.reason === 'draw' ? '同分'
    : '';
  showResultsCard({
    title,
    color: draw ? '#ffd76a' : (win ? '#9be37a' : '#ff8a7a'),
    line: `${me?.count ?? 0} 顆　vs　對手 ${opp?.count ?? 0} 顆`,
    sub: why ? `${why}・獎勵 $${pay}` : `獎勵 $${pay}`,
    rematchMode: (r.mode === 'goal' ? 'goal' : 'timed') as RaceMode,
  });
}

export function clearRaceUi() {
  resultsShown = false;
  raceSnap = null;
  prevPhase = '';
  lastCountShown = '';
  stopCountClock();
  clearRaceHud();
  hideCountOverlay();
  hideModal();
  document.body.classList.remove('raceWait');
}

function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'raceModal';
  document.body.appendChild(modal);
  return modal;
}

function hideModal() {
  if (modal) { modal.classList.remove('show'); modal.innerHTML = ''; }
}

function ensureHud() {
  if (hud) return hud;
  hud = document.createElement('div');
  hud.id = 'raceHud';
  document.body.appendChild(hud);
  return hud;
}

function clearRaceHud() {
  if (hud) { hud.classList.remove('on'); hud.innerHTML = ''; }
}

function showMenu() {
  const el = ensureModal();
  el.innerHTML = `<div class="rcCard">
    <h3>單挑競速</h3>
    <p>獨立小廣場・對座剝蚵，可偷／丟殼／撐傘</p>
    <div class="rcModes">
      <button type="button" class="rcPri" data-mode="timed">限時 120 秒</button>
      <button type="button" class="rcPri" data-mode="goal">先到 20 顆</button>
    </div>
    <div class="rcActs"><button type="button" id="rcCancel">取消</button></div>
  </div>`;
  el.classList.add('show');
  el.querySelector('#rcCancel')!.addEventListener('click', () => { void cancelRaceQueue(); });
  el.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => {
    b.onclick = () => { hooks?.audio(); void startQueue((b.dataset.mode === 'goal' ? 'goal' : 'timed')); };
  });
}

function showWaiting(mode: RaceMode) {
  const el = ensureModal();
  el.innerHTML = `<div class="rcCard">
    <h3>尋找對手</h3>
    <p>${raceModeLabel(mode)}・配對中…</p>
    <div class="rcSpin" aria-hidden="true"></div>
    <div class="rcActs"><button type="button" id="rcCancelQ">取消排隊</button></div>
  </div>`;
  el.classList.add('show');
  el.querySelector('#rcCancelQ')!.addEventListener('click', () => {
    hooks?.audio();
    void cancelRaceQueue();
    hooks?.toast('已取消排隊', '#ffd76a', 2, 'top');
  });
}

async function startQueue(mode: RaceMode) {
  if (!hooks) return;
  if (queuing) return;
  pendingMode = mode;
  queuing = true;
  showWaiting(mode);
  queueClient = new RaceQueueClient();
  queueClient.setHandlers({
    onMatched: (m) => { void onMatched(m); },
    onClose: () => {
      if (!queuing) return;
      queuing = false;
      hideModal();
      hooks?.toast('配對連線中斷', '#ff8a7a', 3, 'top');
    },
  });
  const c = await queueClient.connect();
  if (!c.ok) {
    queuing = false;
    hideModal();
    hooks.toast(raceZhErr(c.err), '#ff8a7a', 3, 'top');
    return;
  }
  const r = await queueClient.queue(hooks.id, hooks.nick(), mode, mode === 'goal' ? 20 : 120);
  if (!r.ok) {
    queuing = false;
    await queueClient.disconnect();
    queueClient = null;
    hideModal();
    hooks.toast(raceZhErr(r.err), '#ff8a7a', 3, 'top');
    return;
  }
  if (r.matched) void onMatched(r.matched);
}

async function onMatched(m: RaceMatched) {
  if (!hooks) return;
  queuing = false;
  pendingMode = null;
  hideModal();
  try { await queueClient?.disconnect(); } catch { /* */ }
  queueClient = null;
  resultsShown = false;
  hooks.toast(`配對成功・${raceModeLabel(m.mode, m.param)}`, '#9be37a', 2, 'top');
  hooks.enterMatch(m);
}

function renderRaceHud(s: RaceSnap) {
  const el = ensureHud();
  const mePid = hooks?.id || '';
  const me = s.players.find(p => p.pid === mePid);
  const opp = s.players.find(p => p.pid !== mePid);
  const localRemain = s.phase === 'countdown' ? localCountdownSec(s) : s.remainSec;
  const mid = s.phase === 'countdown'
    ? `倒數 ${Math.max(1, localRemain)}`
    : s.phase === 'play'
      ? (s.mode === 'timed' ? fmtSec(s.remainSec) : `目標 ${s.goalMeat}`)
      : s.phase === 'results' ? '結束'
        : '等待雙方進場';
  el.innerHTML = `<div class="rcHudIn">
    <span class="rcYou">你 ${me?.count ?? 0}</span>
    <span class="rcMid">${mid}</span>
    <span class="rcOpp">對手 ${opp?.count ?? 0}</span>
  </div>`;
  el.classList.add('on');
}

function localCountdownSec(s: RaceSnap) {
  if (s.phaseAt > 0) {
    return Math.max(0, Math.ceil((COUNTDOWN_MS - (Date.now() - s.phaseAt)) / 1000));
  }
  return Math.max(0, s.remainSec | 0);
}

function ensureCountEl() {
  if (countEl) return countEl;
  countEl = document.createElement('div');
  countEl.id = 'raceCount';
  countEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(countEl);
  return countEl;
}

function hideCountOverlay() {
  if (!countEl) return;
  countEl.classList.remove('on', 'go');
  countEl.textContent = '';
}

function syncCountOverlay(s: RaceSnap) {
  const el = ensureCountEl();
  if (s.phase === 'lobby') {
    const txt = '等待對手進場';
    if (lastCountShown !== txt) {
      lastCountShown = txt;
      el.textContent = txt;
      el.classList.add('on');
      el.classList.remove('go');
    }
    return;
  }
  if (s.phase === 'countdown') {
    const sec = localCountdownSec(s);
    const txt = sec > 0 ? String(sec) : '開始';
    if (lastCountShown !== txt) {
      lastCountShown = txt;
      el.textContent = txt;
      el.classList.remove('on', 'go');
      void el.offsetWidth;
      el.classList.add('on');
      el.classList.toggle('go', sec <= 0);
      hooks?.audio();
    }
    return;
  }
  if (s.phase !== 'play') hideCountOverlay();
}

function flashGo() {
  const el = ensureCountEl();
  lastCountShown = '開始';
  el.textContent = '開始';
  el.classList.add('on', 'go');
  window.setTimeout(() => {
    if (raceSnap?.phase === 'play') hideCountOverlay();
  }, 700);
}

function tickCountClock() {
  if (!raceSnap || raceSnap.phase !== 'countdown') { stopCountClock(); return; }
  const sec = localCountdownSec(raceSnap);
  if (sec !== raceSnap.remainSec) {
    raceSnap = { ...raceSnap, remainSec: sec };
    renderRaceHud(raceSnap);
  }
  syncCountOverlay(raceSnap);
}

function startCountClock() {
  if (countTimer) return;
  countTimer = window.setInterval(tickCountClock, 100);
}

function stopCountClock() {
  if (!countTimer) return;
  clearInterval(countTimer);
  countTimer = 0;
}

function fmtSec(s: number) {
  const n = Math.max(0, s | 0);
  const m = Math.floor(n / 60);
  const r = n % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function showResultsFromSnap(s: RaceSnap) {
  applyRaceResults({
    code: s.code,
    mode: s.mode,
    phase: s.phase,
    reason: s.reason,
    winnerConnId: s.winnerConnId,
    winnerPid: s.winnerPid,
    winnerNick: s.winnerNick,
    winPay: s.winPay,
    losePay: s.losePay,
    players: s.players,
  }, hooks?.id || '');
}

function showResultsCard(opts: {
  title: string; color: string; line: string; sub: string; rematchMode: RaceMode;
}) {
  const el = ensureModal();
  el.innerHTML = `<div class="rcCard">
    <h3 style="color:${opts.color}">${opts.title}</h3>
    <p>${opts.line}</p>
    <p class="rcNote">${opts.sub}</p>
    <div class="rcActs">
      <button type="button" class="rcPri" id="rcAgain">再來一場</button>
      <button type="button" id="rcMenu">回主選單</button>
    </div>
  </div>`;
  el.classList.add('show');
  el.querySelector('#rcAgain')!.addEventListener('click', () => {
    hooks?.audio();
    hideModal();
    hooks?.rematch(opts.rematchMode);
  });
  el.querySelector('#rcMenu')!.addEventListener('click', () => {
    hooks?.audio();
    hideModal();
    hooks?.leaveMatch();
  });
}
