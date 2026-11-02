// 全服彈幕＋全球排行榜（後端：StatsServer /s/*）。後端關機時全部安靜失敗。
const API = 'https://game-status.gwtech.org/s';
type Deps = { id: string; test: boolean; nick: () => string; setNick: (v: string) => void; inTut: () => boolean; on: () => boolean; label: (kind: string, item: number) => string; toast: (t: string) => void; LS: { getItem(k: string): string | null; setItem(k: string, v: string): void } };
let D: Deps;
const $ = (id: string) => document.getElementById(id)!;
const esc = (v: string) => v.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const tq = () => D.test ? '&test=1' : '';
function post(p: string, data: object) {
  return fetch(API + p, { method: 'POST', body: JSON.stringify({ id: D.id, nick: D.nick(), test: D.test, ...data }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }).then(r => r.ok ? r.json() : null).catch(() => null);
}
const get = (p: string) => fetch(API + p, { mode: 'cors', cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);

// ---------- 彈幕 ----------
let last = 0, busy = false, polls = 0;
const queue: string[] = [];
let cur: HTMLElement | null = null;
function endCur() { const el = $('feed'); cur = null; el.classList.remove('on'); $('fdTrack').innerHTML = ''; busy = false; setTimeout(showNext, 600); }
function showNext() {
  const el = $('feed');
  if (busy || !queue.length || !D.on() || D.inTut()) return;
  busy = true; const txt = queue.shift()!;
  const tr = $('fdTrack'); tr.innerHTML = `<span class="fdIn"><i class="ic ic-horn"></i> ${txt}</span>`; el.classList.add('on');
  const s = tr.firstElementChild as HTMLElement; cur = s; s.style.animationDuration = Math.max(7, (txt.length + 10) * 0.32) + 's';
  s.onanimationend = () => { if (cur === s) endCur(); };
}
async function poll() {
  if (document.hidden) return;
  polls++;
  if (D.on()) {
    const r = await get(`/events?since=${last}${tq()}`);
    if (r && typeof r.last === 'number') {
      const first = last === 0; last = r.last;
      if (!first) for (const e of r.events ?? []) { const t = `<b>${esc(e.nick)}</b><small>#${esc(e.tag)}</small> ${esc(D.label(e.kind, e.item))}`; if (queue.length >= 3) queue[queue.length - 1] += '　・　' + t; else queue.push(t); }
      showNext();
    }
  }
  if (polls % 2 === 0) checkPassed();
}
export function report(kind: 'pearl' | 'legend' | 'odd' | 'port', item: number) { if (D.on() && !D.inTut()) post('/event', { kind, item }); }

// ---------- 排行榜 ----------
const BOARDS = [['income', '今日收入', '$'], ['oysters', '單班最多蚵仔', ''], ['pearls', '珍珠收藏', '']] as const;
let board = 'income', view: 'daily' | 'weekly' = 'daily';
export function submit(s: { income?: number; oysters?: number; pearls?: number }) {
  return post('/score', { scores: s }).then(() => { lastRank = 0; checkPassed(); });
}
let lastRank = 0;
async function checkPassed() {
  const r = await get(`/top?board=income&view=daily&n=50&me=${D.id}${tq()}`);
  if (!r?.mine) return;
  const rank = r.mine.rank as number;
  if (lastRank && rank > lastRank && !D.inTut()) {
    const above = (r.rows as any[]).find(x => x.rank === rank - 1);
    D.toast(above ? `${above.nick}#${above.tag} 超過你了！` : '有人超過你了！');
  }
  lastRank = rank;
}
async function render() {
  const list = $('lbList');
  $('lbTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.b === board));
  $('lbView').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.v === view));
  list.innerHTML = '<div class="lbEmpty"><i class="ic ic-timer"></i><span>讀取中…</span></div>';
  const r = await get(`/top?board=${board}&view=${view}&n=20&me=${D.id}${tq()}`);
  if (!r) { list.innerHTML = '<div class="lbEmpty"><i class="ic ic-warn"></i><span>排行榜暫時連不上<br><small>等一下再試試</small></span></div>'; return; }
  const unit = BOARDS.find(b => b[0] === board)![2];
  const row = (x: any) => `<div class="lbRow${x.me ? ' me' : ''}"><span class="lbR">${x.rank}</span><span class="lbN"><b>${esc(x.nick)}</b><small>#${esc(x.tag)}</small>${x.title ? `<em class="lbT"><i class="ic ic-crown"></i>${esc(x.title)}</em>` : ''}</span><span class="lbV">${unit}${x.v}</span>` +
    (x.me ? `<span class="lbA"><span><i class="ic ic-like"></i>${x.likes}</span><span><i class="ic ic-oyster"></i>${x.shells}</span></span>` : `<span class="lbA"><button data-k="${x.k}" data-r="like" aria-label="讚"><i class="ic ic-like"></i>${x.likes}</button><button data-k="${x.k}" data-r="shell" aria-label="丟蚵殼"><i class="ic ic-oyster"></i>${x.shells}</button></span>`) + '</div>';
  const rows = r.rows as any[];
  list.innerHTML = rows.length ? rows.map(row).join('') + (r.mine && !rows.some(x => x.me) ? '<div class="lbGap"></div>' + row(r.mine) : '') : '<div class="lbEmpty"><i class="ic ic-rank"></i><span>還沒有人上榜<br><small>收工後就會出現你的成績！</small></span></div>';
  list.querySelectorAll<HTMLButtonElement>('button[data-k]').forEach(b => b.onclick = async () => {
    b.disabled = true; const ok = await post('/react', { k: b.dataset.k, kind: b.dataset.r });
    if (ok) { const n = b.lastChild as Text; n.textContent = String(Number(n.textContent) + 1); D.toast(b.dataset.r === 'like' ? '按讚送出！' : '丟一顆蚵殼過去！'); }
    else D.toast('慢一點，等一下再按');
  });
  $('lbMe').innerHTML = r.myTitle ? `<i class="ic ic-crown"></i> 你的稱號：${esc(r.myTitle)}` : '';
}
export function open() { ($('lbNick') as HTMLInputElement).value = D.nick() === '剝蚵人' ? '' : D.nick(); $('lb').classList.add('show'); render(); }

export function init(d: Deps) {
  D = d;
  const f = document.createElement('div'); f.id = 'feed';
  f.innerHTML = '<div id="fdTrack"></div><button id="fdX" type="button" aria-label="關閉這則消息"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  document.body.appendChild(f);
  // 只關掉當下這則；放開才觸發，且需在同一顆按鈕上按下
  const x = f.querySelector('#fdX') as HTMLButtonElement; let down = false;
  const stop = (e: Event) => e.stopPropagation();
  x.addEventListener('pointerdown', e => { stop(e); down = true; });
  x.addEventListener('pointerup', e => { stop(e); e.preventDefault(); if (down && cur) endCur(); down = false; });
  x.addEventListener('pointerleave', () => { down = false; });
  x.addEventListener('pointercancel', () => { down = false; });
  for (const t of ['click', 'touchstart', 'touchend', 'mousedown', 'mouseup']) x.addEventListener(t, stop);
  if (/[?&]feedtest=1/.test(location.search)) { queue.push('<b>測試蚵民</b><small>#0001</small> 剝到了黑珍珠！', '<b>第二則</b><small>#0002</small> 開到「舊懷錶」'); setTimeout(showNext, 500); }
  $('lbTabs').innerHTML = BOARDS.map(b => `<button data-b="${b[0]}">${b[1]}</button>`).join('');
  $('lbTabs').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { board = b.dataset.b!; render(); });
  $('lbView').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { view = b.dataset.v as any; render(); });
  $('lbClose').onclick = () => $('lb').classList.remove('show');
  const ni = $('lbNick') as HTMLInputElement;
  ni.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ni.blur(); } });
  $('lbNickSave').onclick = async () => { D.setNick(ni.value); ni.value = D.nick() === '剝蚵人' ? '' : D.nick(); await post('/score', { scores: {} }); D.toast('名字改好了'); render(); };
  setInterval(poll, 25_000); setTimeout(poll, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) showNext(); });
}
export function resume() { showNext(); }
// ---------- 禮物信箱 ----------
export type Gift = { id: string; type: 'money' | 'equip' | 'odd' | 'pearl'; amount?: number; itemId?: string | number; tier?: number; message?: string; createdAt?: number | string };
export async function gifts(): Promise<Gift[]> { const r = await get(`/gifts?pid=${encodeURIComponent(D.id)}${tq()}`); return Array.isArray(r?.gifts) ? r.gifts : []; }
// 回傳：ok 領到、gone 已領或不存在（從清單移除）、retry 伺服器忙或沒連上（保留）
export async function claimGift(giftId: string): Promise<{ st: 'ok' | 'gone' | 'retry'; gift?: Gift }> {
  try { const r = await fetch(API + '/gifts/claim', { method: 'POST', body: JSON.stringify({ pid: D.id, giftId }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }); const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) return { st: 'ok', gift: j.gift }; if (r.status === 409 || r.status === 404) return { st: 'gone' }; return { st: 'retry' }; } catch { return { st: 'retry' }; }
}

// ---------- 線上人數（/s/presence、/s/online）。後端沒部署時看板直接隱藏 ----------
let prsPlaying: () => boolean = () => false;
function showOnline(r: any) {
  const el = $('onlineSign');
  if (!r || typeof r.online !== 'number') { el.style.display = 'none'; return; }
  const on = Math.max(1, r.online), sh = r.shucking | 0;
  $('onlineTxt').innerHTML = sh >= 1 ? `現在 <b>${sh}</b> 人正在剝蚵仔` : `現在 <b>${on}</b> 人在蚵寮`;
  el.style.display = '';
}
async function presenceTick() {
  if (document.hidden) return;
  const r = await fetch(API + '/presence', { method: 'POST', body: JSON.stringify({ pid: D.id, game: 'oyster', shucking: prsPlaying() }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }).then(x => x.ok ? x.json() : null).catch(() => null);
  showOnline(r);
}
export function startPresence(playing: () => boolean) {
  prsPlaying = playing;
  presenceTick(); setInterval(presenceTick, 25000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) presenceTick(); });
}

// 玩家號碼（伺服器發放、保證不重複）。舊版伺服器沒有 /me 時回 null。
export type Me = { tag: string; changed: boolean; oldTag?: string | null };
export async function me(): Promise<Me | null> { const r = await get(`/me?pid=${encodeURIComponent(D.id)}`); return r && typeof r.tag === 'string' && /^\d{4,5}$/.test(r.tag) ? r : null; }
export function ackMe() { fetch(API + '/me/ack', { method: 'POST', body: JSON.stringify({ pid: D.id }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }).catch(() => null); }
export const myNick = () => D.nick();
