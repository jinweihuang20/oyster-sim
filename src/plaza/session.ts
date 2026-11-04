import * as THREE from 'three';
import { PlazaClient } from './hubClient';
import { PILE_COUNT, SLOTS_PER_PILE, PLAZA_CAPACITY, seatPose } from './layout';
import { createPlazaWorldView, tickPlazaTags, type PlazaWorldView } from './worldView';
import type { PlazaChat, PlazaPlayer, PlazaSnapshot } from './types';

export type PlazaDeps = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string) => void;
  audio: () => void;
  scene: THREE.Scene;
  camera: () => THREE.Camera;
  bubbles: HTMLElement;
  /** 入座後開始無 NPC 剝蚵工班 */
  beginShift: (pileId: number, slot: number) => void;
  /** 把座椅／鏡頭綁到廣場位子 */
  applySeatPose: (pos: THREE.Vector3, yaw: number) => void;
  getPhase: () => string;
  getCount: () => number;
  track: (t: string, d?: Record<string, unknown>) => void;
  /** 結算：回傳本機算出的 earn，由廣場 clamp 後入帳 */
  onPayout: (clamped: number, meta: { oysters: number; dur: number; raw: number }) => void;
  /** 按 ✕：已入座則收工；否則退回主選單 */
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

export const isPlazaActive = () => active;
export const plazaSeated = () => seated;
export function plazaMySeat() { return myPile != null && mySlot != null ? { pileId: myPile, slot: mySlot } : null; }

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
};

function zhErr(e?: string) { return (e && ERR_ZH[e]) || e || '失敗了'; }

export function openPlaza(D: PlazaDeps) {
  if (active) return;
  active = true; seated = false; deps = D; myPile = null; mySlot = null; snap = null;
  D.audio();
  client = new PlazaClient();
  view = createPlazaWorldView(D.scene, D.bubbles, matchMedia('(pointer: coarse)').matches);
  buildUi();
  wireClient(D);
  void boot(D);
}

async function boot(D: PlazaDeps) {
  setStatus('連線中…');
  const r = await client!.connect(D.id, D.nick());
  if (!r.ok) {
    setStatus('連線失敗');
    D.toast(zhErr(r.err), '#ff8a7a');
    // 降級：仍可看選座 UI，但不能真的入座同步
    renderSeats();
    return;
  }
  snap = r.snap ?? null;
  if (snap) view?.syncRoster(snap, D.id);
  setStatus(`廣場 ${snap?.occupied ?? 0}/${snap?.capacity ?? PLAZA_CAPACITY}`);
  renderSeats();
}

function wireClient(D: PlazaDeps) {
  client!.setHandlers({
    onRoster: (s) => { snap = normalizeSnap(s); view?.syncRoster(snap, D.id); setStatus(`廣場 ${snap.occupied}/${snap.capacity}`); renderSeats(); },
    onJoined: (p) => { view?.upsert(normPlayer(p), D.id); },
    onLeft: (p) => { view?.remove(normPlayer(p)); },
    onSeatChanged: (p) => { view?.upsert(normPlayer(p), D.id); },
    onPhase: (p) => { view?.setPhase(normPlayer(p)); },
    onChat: (m) => pushChat(normChat(m)),
    onClose: (err) => {
      if (!active) return;
      D.toast(err ? `廣場斷線：${err}` : '廣場連線中斷', '#ffb08a');
      setStatus('已斷線');
    },
  });
}

/** SignalR 可能給 PascalCase */
function normalizeSnap(s: any): PlazaSnapshot {
  const players = (s?.players ?? s?.Players ?? []).map(normPlayer);
  return {
    players,
    pileCount: s?.pileCount ?? s?.PileCount ?? PILE_COUNT,
    slotsPerPile: s?.slotsPerPile ?? s?.SlotsPerPile ?? SLOTS_PER_PILE,
    occupied: s?.occupied ?? s?.Occupied ?? players.length,
    capacity: s?.capacity ?? s?.Capacity ?? PLAZA_CAPACITY,
  };
}
function normPlayer(p: any): PlazaPlayer {
  return {
    connId: p?.connId ?? p?.ConnId ?? '',
    pid: p?.pid ?? p?.Pid ?? '',
    nick: p?.nick ?? p?.Nick ?? '剝蚵人',
    pileId: p?.pileId ?? p?.PileId ?? -1,
    slot: p?.slot ?? p?.Slot ?? -1,
    phase: p?.phase ?? p?.Phase ?? 'idle',
    count: p?.count ?? p?.Count ?? 0,
    joinedAt: p?.joinedAt ?? p?.JoinedAt ?? 0,
  };
}
function normChat(m: any): PlazaChat {
  return { nick: m?.nick ?? m?.Nick ?? '?', text: m?.text ?? m?.Text ?? '', pileId: m?.pileId ?? m?.PileId ?? null, at: m?.at ?? m?.At ?? Date.now() };
}

function buildUi() {
  ui = document.createElement('div');
  ui.id = 'plazaRoot';
  ui.innerHTML = `
<style>
#plazaRoot{position:fixed;inset:0;z-index:8500;pointer-events:none;font-family:inherit}
#plazaRoot *{box-sizing:border-box}
#pzPanel{pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94vw,420px);max-height:min(88vh,640px);overflow:auto;background:rgba(36,22,10,.96);border:3px solid #d9952b;border-radius:16px;padding:14px 14px 12px;color:#fff6d8}
#pzPanel h2{margin:0 0 6px;color:#ffd23f;letter-spacing:2px;font-size:20px;text-align:center}
#pzStatus{text-align:center;font-size:13px;opacity:.85;margin-bottom:8px}
#pzSeats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.pzPile{background:rgba(20,12,6,.55);border:2px solid #6b3a12;border-radius:10px;padding:6px 4px}
.pzPile b{display:block;text-align:center;font-size:12px;color:#ffd23f;margin-bottom:4px}
.pzSlots{display:grid;grid-template-columns:1fr 1fr;gap:3px}
.pzSlots button{min-height:32px;padding:4px 2px;font-size:12px;font-weight:800;border-radius:8px;border:2px solid #ffd23f;background:#c45c26;color:#fff6d8}
.pzSlots button.free{background:#2f7d4a;border-color:#9be37a}
.pzSlots button.mine{background:#ffd23f;color:#2a1206}
.pzSlots button:disabled{opacity:.45;cursor:not-allowed}
#pzChat{display:none;pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 8px);bottom:calc(env(safe-area-inset-bottom) + 12px);width:min(72vw,320px);background:rgba(20,12,6,.72);border:2px solid #d9952b;border-radius:12px;padding:8px;color:#fff6d8}
#pzChat.on{display:block}
#pzLog{height:72px;overflow:auto;font-size:12px;line-height:1.35;margin-bottom:6px}
#pzLog div{opacity:.92}
#pzRow{display:flex;gap:6px}
#pzRow input{flex:1;min-width:0;border-radius:8px;border:2px solid #6b3a12;background:#1a1008;color:#fff6d8;padding:6px 8px;font-size:14px}
#pzRow button,#pzX,#pzGo{pointer-events:auto;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;padding:8px 12px}
#pzX{position:absolute;top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 10px);width:44px;height:44px;font-size:22px;z-index:2}
#pzHint{pointer-events:none;position:absolute;top:calc(env(safe-area-inset-top) + 14px);left:50%;transform:translateX(-50%);background:rgba(20,12,6,.65);border:2px solid #d9952b;border-radius:10px;padding:4px 10px;font-weight:800;font-size:14px;color:#ffd23f;display:none}
#pzHint.on{display:block}
#pzChange{display:none;pointer-events:auto;position:absolute;right:calc(env(safe-area-inset-right) + 8px);bottom:calc(env(safe-area-inset-bottom) + 12px);background:#2a1206;color:#ffd23f;border:2px solid #ffd23f;border-radius:10px;font-weight:800;padding:8px 12px}
#pzChange.on{display:block}
</style>
<button id="pzX" type="button" aria-label="離開">✕</button>
<div id="pzHint"></div>
<div id="pzPanel">
  <h2>蚵仔廣場</h2>
  <div id="pzStatus">準備中…</div>
  <p style="font-size:13px;margin:0 0 6px;opacity:.9;text-align:center">選一堆蚵仔，一堆四人，點空位坐下。</p>
  <div id="pzSeats"></div>
</div>
<div id="pzChat"><div id="pzLog"></div><div id="pzRow"><input id="pzIn" maxlength="80" placeholder="跟廣場打招呼…"/><button id="pzSend" type="button">送</button></div></div>
<button id="pzChange" type="button">換位</button>`;
  document.body.appendChild(ui);
  ui.querySelector('#pzX')!.addEventListener('click', () => {
    if (seated) deps?.onExit();
    else { const exit = deps?.onExit; void closePlaza(true).then(() => exit?.()); }
  });
  ui.querySelector('#pzSend')!.addEventListener('click', sendChat);
  ui.querySelector('#pzIn')!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') sendChat(); });
  ui.querySelector('#pzChange')!.addEventListener('click', () => {
    seated = false;
    ui!.querySelector('#pzPanel')!.setAttribute('style', '');
    (ui!.querySelector('#pzChat') as HTMLElement).classList.remove('on');
    (ui!.querySelector('#pzChange') as HTMLElement).classList.remove('on');
    (ui!.querySelector('#pzHint') as HTMLElement).classList.remove('on');
    renderSeats();
  });
}

function setStatus(t: string) {
  const el = ui?.querySelector('#pzStatus'); if (el) el.textContent = t;
}

function takenSet() {
  const t = new Set<string>();
  for (const p of snap?.players ?? []) t.add(`${p.pileId}:${p.slot}`);
  return t;
}

function renderSeats() {
  const box = ui?.querySelector('#pzSeats'); if (!box) return;
  const taken = takenSet();
  const full = (snap?.occupied ?? 0) >= (snap?.capacity ?? PLAZA_CAPACITY);
  let html = '';
  for (let i = 0; i < PILE_COUNT; i++) {
    html += `<div class="pzPile"><b>第 ${i + 1} 堆</b><div class="pzSlots">`;
    for (let s = 0; s < SLOTS_PER_PILE; s++) {
      const k = `${i}:${s}`;
      const mine = myPile === i && mySlot === s;
      const busy = taken.has(k) && !mine;
      const cls = mine ? 'mine' : busy ? '' : 'free';
      const label = mine ? '你' : busy ? '有人' : `${s + 1}`;
      html += `<button type="button" class="${cls}" data-p="${i}" data-s="${s}" ${busy || (full && !mine && myPile == null) ? 'disabled' : ''}>${label}</button>`;
    }
    html += `</div></div>`;
  }
  if (full && myPile == null) setStatus(`廣場滿了（${snap?.occupied}/${snap?.capacity}），等空位`);
  box.innerHTML = html;
  box.querySelectorAll<HTMLButtonElement>('button[data-p]').forEach(b => {
    b.onclick = () => void pickSeat(+b.dataset.p!, +b.dataset.s!);
  });
}

async function pickSeat(pileId: number, slot: number) {
  if (!deps || !client) return;
  if (!client.connected) { deps.toast('還沒連上廣場，稍後再試', '#ff8a7a'); return; }
  setStatus('入座中…');
  const first = myPile == null;
  const r = first ? await client.claimSeat(pileId, slot) : await client.changeSeat(pileId, slot);
  if (!r.ok) {
    deps.toast(zhErr(r.err), '#ff8a7a');
    if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
    renderSeats();
    return;
  }
  if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
  if ((r as any).token) client.token = (r as any).token;
  myPile = pileId; mySlot = slot;
  const pose = seatPose(pileId, slot);
  deps.applySeatPose(pose.pos, pose.yaw);
  view?.highlight(pileId, slot);
  seated = true;
  (ui!.querySelector('#pzPanel') as HTMLElement).style.display = 'none';
  (ui!.querySelector('#pzChat') as HTMLElement).classList.add('on');
  (ui!.querySelector('#pzChange') as HTMLElement).classList.add('on');
  const hint = ui!.querySelector('#pzHint') as HTMLElement;
  hint.textContent = `第 ${pileId + 1} 堆 · 座 ${slot + 1}`;
  hint.classList.add('on');
  if (first) deps.beginShift(pileId, slot);
  else deps.toast(`換到第 ${pileId + 1} 堆`, '#9be37a');
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

/** 主迴圈呼叫：同步 phase、名牌 */
export function tickPlaza(dt: number) {
  if (!active || !deps) return;
  tickPlazaTags(view, deps.camera());
  if (!seated || !client?.connected) return;
  phaseTimer += dt;
  if (phaseTimer >= 0.25) {
    phaseTimer = 0;
    void client.setPhase(deps.getPhase(), deps.getCount());
  }
}

/** 收工時由 main 呼叫，回傳 clamp 後金額（失敗則用 raw 但標錯誤） */
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
  active = false; seated = false;
  if (leaveSeat) await client?.leaveSeat();
  await client?.disconnect();
  client = null;
  view?.dispose(); view = null;
  ui?.remove(); ui = null;
  myPile = null; mySlot = null; snap = null; deps = null;
}

export function plazaEndCleanup() {
  // 收工後保留連線與換位，只關聊天提示；若要整退由 closePlaza
  const hint = ui?.querySelector('#pzHint');
  hint?.classList.remove('on');
}
