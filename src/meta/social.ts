// 全服彈幕＋全球排行榜（後端：StatsServer /s/*）。後端關機時全部安靜失敗。
import { postDiscordFirstPlay, postDiscordRename } from '../core/discord';
const API = 'https://game-status.gwtech.org/s';
type Deps = { id: string; test: boolean; nick: () => string; setNick: (v: string) => void; inTut: () => boolean; on: () => boolean; label: (kind: string, item: number) => string; title?: () => string; foil?: () => boolean; toast: (t: string) => void; LS: { getItem(k: string): string | null; setItem(k: string, v: string): void } };
let D: Deps;
const $ = (id: string) => document.getElementById(id)!;
const esc = (v: string) => v.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const tq = () => D.test ? '&test=1' : '';
function post(p: string, data: object) {
  return fetch(API + p, { method: 'POST', body: JSON.stringify({ id: D.id, nick: D.nick(), title: D.title?.() ?? '', foil: !!D.foil?.(), test: D.test, ...data }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }).then(r => r.ok ? r.json() : null).catch(() => null);
}
const get = (p: string) => fetch(API + p, { mode: 'cors', cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);

// ---------- 彈幕 ----------
let last = 0, busy = false, polls = 0;
const queue: string[] = [];
let cur: HTMLElement | null = null;
function endCur() { const el = $('feed'); cur = null; el.classList.remove('on'); $('fdTrack').innerHTML = ''; placeFeed(); busy = false; setTimeout(showNext, 600); }
// 跑馬燈放在 HUD（#top、#stats）下緣之下；並把廣場 #toast 頂距寫成 CSS 變數，避免與跑馬燈交疊
export function placeFeed() {
  const f = document.getElementById('feed'); if (!f) return;
  let b = 0;
  for (const id of ['top', 'stats']) {
    const e = document.getElementById(id); if (!e) continue;
    const r = e.getBoundingClientRect();
    if (r.height > 0 && r.width > 0 && r.top < innerHeight * 0.4 && getComputedStyle(e).visibility !== 'hidden' && (e.textContent || '').trim()) b = Math.max(b, r.bottom);
  }
  f.style.top = b > 0 ? Math.round(b + 6) + 'px' : 'var(--sa-top)';
  // 廣場提示：有跑馬燈時貼在其下，否則貼在 HUD 下
  let toastTop = b > 0 ? Math.round(b + 8) : 56;
  if (f.classList.contains('on')) {
    const fr = f.getBoundingClientRect();
    if (fr.height > 0) toastTop = Math.round(fr.bottom + 6);
    else toastTop = Math.round((b > 0 ? b + 6 : 46) + 36);
  }
  document.documentElement.style.setProperty('--plaza-toast-top', `${toastTop}px`);

  const h = document.getElementById('hint'); if (!h) return;
  h.style.removeProperty('top'); h.style.removeProperty('bottom');
  const plaza = document.body.classList.contains('plazaMode');
  // 上半部提示（手機 #hint／廣場）要讓過跑馬燈與 toast
  let clearY = 0;
  if (f.classList.contains('on')) {
    const fr = f.getBoundingClientRect();
    if (fr.height > 0) clearY = Math.max(clearY, Math.round(fr.bottom + 4));
  }
  if (plaza) clearY = Math.max(clearY, toastTop + 26);
  if (!clearY) return;
  const hr = h.getBoundingClientRect();
  const hintOnTop = hr.top < innerHeight * 0.45;
  if (hintOnTop && hr.height > 0 && hr.top < clearY + 2)
    { h.style.setProperty('top', `${clearY}px`, 'important'); h.style.setProperty('bottom', 'auto', 'important'); }
}
function showNext() {
  const el = $('feed'); placeFeed();
  if (busy || !queue.length || !D.on() || D.inTut()) return;
  busy = true; const txt = queue.shift()!;
  const tr = $('fdTrack'); tr.innerHTML = `<span class="fdIn"><i class="ic ic-horn"></i> ${txt}</span>`; el.classList.add('on'); placeFeed();
  const s = tr.firstElementChild as HTMLElement; cur = s; s.style.animationDuration = Math.max(4.4, (txt.length + 10) * 0.2) + 's';
  s.onanimationend = () => { if (cur === s) endCur(); };
}
async function poll() {
  if (document.hidden) return;
  polls++;
  if (D.on()) {
    const r = await get(`/events?since=${last}${tq()}`);
    if (r && typeof r.last === 'number') {
      const first = last === 0; last = r.last;
      if (!first) for (const e of r.events ?? []) { const t = `${e.atitle ? `<em class="fdA">${esc(e.atitle)}</em>` : ''}<b>${esc(e.nick)}</b><small>#${esc(e.tag)}</small> ${esc(D.label(e.kind, e.item))}`; if (queue.length >= 3) queue[queue.length - 1] += '　・　' + t; else queue.push(t); }
      showNext();
    }
  }
  if (polls % 2 === 0) checkPassed();
}
// 配戴稱號後同步到伺服器（排行榜、跑馬燈顯示在名字前）
export function syncTitle() { if (D?.on()) post('/score', { scores: {} }); }
export function report(kind: 'pearl' | 'legend' | 'odd' | 'port' | 'ach', item: number) { if (D?.on() && !D.inTut()) post('/event', { kind, item }); }

// ---------- 排行榜 ----------
const BOARDS = [
  ['income', '今日收入', '$'],
  ['oysters', '單班最多蚵仔', ''],
  ['pearls', '珍珠收藏', ''],
  ['dmKills', '死鬥-混戰', ''],
  ['dmWaves', '死鬥-圍毆', ''],
  ['seat', '送座位', ''],
] as const;
let board = 'income', view: 'daily' | 'weekly' = 'daily';
export function submit(s: { income?: number; oysters?: number; pearls?: number; dmKills?: number; dmWaves?: number }) {
  return post('/score', { scores: s }).then(() => { lastRank = 0; checkPassed(); });
}

/** 客戶端玩法收入（工寮／廣場剝蚵、死鬥獎金）累加到今日收入。伺服器發放的送座位／好友房不要走這裡，以免重覆入帳。 */
export function addPlayIncome(amount: number, extra?: { oysters?: number; pearls?: number }) {
  const n = Math.max(0, Math.floor(amount));
  const td = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  let inc = 0;
  try { const o = JSON.parse(D.LS.getItem('oyster-lb-day') || '{}'); inc = o.d === td ? o.v : 0; } catch { /* ignore */ }
  inc += n;
  try { D.LS.setItem('oyster-lb-day', JSON.stringify({ d: td, v: inc })); } catch { /* ignore */ }
  return submit({ income: inc, ...extra });
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
  const viewBtns = Array.from($('lbView').querySelectorAll('button') as NodeListOf<HTMLButtonElement>);
  if (board === 'seat') {
    const labels = ['今日榜', '總榜'] as const;
    viewBtns.forEach((b, i) => { b.textContent = labels[i] ?? b.textContent; });
  } else {
    const labels = ['今天', '本週'] as const;
    viewBtns.forEach((b, i) => { b.textContent = labels[i] ?? b.textContent; });
  }
  const apiView = board === 'seat' && view === 'weekly' ? 'all' : view;
  viewBtns.forEach(b => b.classList.toggle('on', b.dataset.v === view));
  list.innerHTML = '<div class="lbEmpty"><i class="ic ic-timer"></i><span>讀取中…</span></div>';
  const r = await get(`/top?board=${board}&view=${apiView}&n=20&me=${D.id}${tq()}`);
  if (!r) { list.innerHTML = '<div class="lbEmpty"><i class="ic ic-warn"></i><span>排行榜暫時連不上<br><small>等一下再試試</small></span></div>'; return; }
  const unit = BOARDS.find(b => b[0] === board)![2];
  const foilOn = (x: any) => !!(x.foil || (x.me && D.foil?.()));
  const nameInner = (x: any) => {
    const at = x.atitle ? `<em class="lbAt">${esc(x.atitle)}</em>` : '';
    return `<span class="lbWho">${at}<small class="lbId">#${esc(x.tag)}</small></span><b class="lbNick">${esc(x.nick)}</b>`;
  };
  const fr = await import('./friends');
  await fr.loadFriends();
  const row = (x: any) => {
    return `<div class="lbRow${x.me ? ' me' : ''}${foilOn(x) ? ' foil' : ''}"><span class="lbR">${x.rank}</span><span class="lbN">${foilOn(x) ? `<span class="lbFoil">${nameInner(x)}</span>` : nameInner(x)}${x.title ? `<em class="lbT"><i class="ic ic-crown"></i>${esc(x.title)}</em>` : ''}</span><span class="lbV">${unit}${x.v}</span>` +
      (x.me ? `<span class="lbA"><span><i class="ic ic-like"></i>${x.likes}</span><span><i class="ic ic-oyster"></i>${x.shells}</span></span>` : `<span class="lbA"><button data-k="${x.k}" data-r="like" aria-label="讚"><i class="ic ic-like"></i>${x.likes}</button><button data-k="${x.k}" data-r="shell" aria-label="丟蚵殼"><i class="ic ic-oyster"></i>${x.shells}</button></span><span class="lbFrAct">${fr.friendActionBtn(x.k, x.tag, x.nick)}</span>`) + '</div>';
  };
  const rows = r.rows as any[];
  const emptyHint = board === 'seat' ? '把鄰居送到指定位子後就會出現成績！' : board.startsWith('dm') ? '死鬥結算後就會出現成績！' : '收工後就會出現你的成績！';
  list.innerHTML = rows.length ? rows.map(row).join('') + (r.mine && !rows.some(x => x.me) ? '<div class="lbGap"></div>' + row(r.mine) : '') : `<div class="lbEmpty"><i class="ic ic-rank"></i><span>還沒有人上榜<br><small>${emptyHint}</small></span></div>`;
  list.querySelectorAll<HTMLButtonElement>('button[data-k][data-r]').forEach(b => b.onclick = async () => {
    b.disabled = true; const ok = await post('/react', { k: b.dataset.k, kind: b.dataset.r });
    if (ok) { const n = b.lastChild as Text; n.textContent = String(Number(n.textContent) + 1); D.toast(b.dataset.r === 'like' ? '按讚送出！' : '丟一顆蚵殼過去！'); }
    else D.toast('慢一點，等一下再按');
  });
  fr.bindFriendActions(list);
  $('lbMe').innerHTML = r.myTitle ? `<i class="ic ic-crown"></i> 你的稱號：${esc(r.myTitle)}` : '';
}
export function open() { ($('lbNick') as HTMLInputElement).value = D.nick() === '剝蚵人' ? '' : D.nick(); $('lb').classList.add('show'); render(); }

export function init(d: Deps) {
  D = d;
  const f = document.createElement('div'); f.id = 'feed';
  f.innerHTML = '<div id="fdTrack"></div><button id="fdX" type="button" aria-label="關閉這則消息"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  document.body.appendChild(f);
  addEventListener('resize', placeFeed);
  // 面板開關後重新定位（之前只在 resize 時算，主選單時算的位置會留到上工，蓋住上方 HUD）
  { let q = 0; new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; placeFeed(); }); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); }
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(placeFeed); for (const id of ['top', 'stats', 'hint']) { const e = document.getElementById(id); if (e) ro.observe(e); } }
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
export function local(txt: string) { queue.push(esc(txt)); showNext(); }
// ---------- 禮物信箱 ----------
export type Gift = { id: string; type: 'money' | 'equip' | 'odd' | 'pearl' | 'item'; amount?: number; itemId?: string | number; tier?: number; message?: string; createdAt?: number | string };
export async function gifts(): Promise<Gift[]> { const r = await get(`/gifts?pid=${encodeURIComponent(D.id)}&caps=item${tq()}`); return Array.isArray(r?.gifts) ? r.gifts : []; }
// 回傳：ok 領到、gone 已領或不存在（從清單移除）、retry 伺服器忙或沒連上（保留）
export async function claimGift(giftId: string | number): Promise<{ st: 'ok' | 'gone' | 'retry'; gift?: Gift; why?: string }> {
  try { const r = await fetch(API + '/gifts/claim', { method: 'POST', body: JSON.stringify({ pid: D.id, giftId: String(giftId) }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }); const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) return { st: 'ok', gift: j.gift };
    if (r.status === 409) return { st: 'gone', gift: j?.gift, why: '這份禮物已經領過了' };
    if (r.status === 404) return { st: 'gone', why: '這份禮物已經過期或被收回了' };
    if (r.status === 429) return { st: 'retry', why: '領得太快了，等一下再試' };
    return { st: 'retry', why: '信箱忙線中，等一下再試' }; } catch { return { st: 'retry', why: '連不上信箱，檢查一下網路再試' }; }
}

// ---------- 線上人數（/s/presence、/s/online）。後端沒部署時看板直接隱藏 ----------
let prsPlaying: () => boolean = () => false;
let prsWhere: () => string = () => 'menu';
let prsHook: () => void = () => { };
export function onPresence(f: () => void) { prsHook = f; }
function showOnline(r: any) {
  const el = $('onlineSign');
  const h = document.getElementById('onHud');
  // 廣場進行中：#onHud 改顯示廣場人數，不要被全服線上人數蓋掉
  const plazaOwnsHud = h?.dataset.plaza === '1';
  if (!r || typeof r.online !== 'number') {
    el.style.display = 'none';
    if (h && !plazaOwnsHud) h.style.display = 'none';
    return;
  }
  const on = Math.max(1, r.online), sh = r.shucking | 0;
  $('onlineTxt').innerHTML = sh >= 1 ? `現在 <b>${sh}</b> 人正在剝蚵仔` : `現在 <b>${on}</b> 人在蚵寮`;
  el.style.display = '';
  if (h && !plazaOwnsHud) { h.style.display = ''; $('onHudN').textContent = String(on); }
}
async function presenceTick() {
  if (document.hidden) return;
  const r = await fetch(API + '/presence', {
    method: 'POST',
    body: JSON.stringify({ pid: D.id, game: 'oyster', shucking: prsPlaying(), where: prsWhere() }),
    headers: { 'Content-Type': 'text/plain' },
    mode: 'cors',
  }).then(x => x.ok ? x.json() : null).catch(() => null);
  showOnline(r);
  try { prsHook(); } catch { /* 忽略 */ }
}

const FIRST_DC_KEY = 'oyster-dc-first';
/** 第一次遊玩進場通知（days=0 且未完成教學；每裝置只送一次） */
export async function maybeAnnounceFirstPlay(isFirst: () => boolean) {
  try { if (D.LS.getItem(FIRST_DC_KEY)) return; } catch { return; }
  if (!isFirst()) return;
  try { D.LS.setItem(FIRST_DC_KEY, '1'); } catch { /* */ }
  if (!myTagCache) { try { await me(); } catch { /* */ } }
  void postDiscordFirstPlay(D.nick(), { tag: myTagCache });
}

export function startPresence(playing: () => boolean, where?: () => string) {
  prsPlaying = playing;
  if (where) prsWhere = where;
  presenceTick(); setInterval(presenceTick, 25000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) presenceTick(); });
}

// 玩家號碼（伺服器發放、保證不重複）。舊版伺服器沒有 /me 時回 null。
export type Me = { tag: string; changed: boolean; oldTag?: string | null };
let myTagCache = '';
export const myTag = () => myTagCache;
export async function me(): Promise<Me | null> {
  const r = await get(`/me?pid=${encodeURIComponent(D.id)}`);
  if (r && typeof r.tag === 'string' && /^\d{4,5}$/.test(r.tag)) { myTagCache = r.tag; return r as Me; }
  return null;
}
export function ackMe() { fetch(API + '/me/ack', { method: 'POST', body: JSON.stringify({ pid: D.id }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }).catch(() => null); }
export const myNick = () => D.nick();

// ---------- 活動場景 ----------
/** 目前進行中的活動；連不上或逾時回傳 undefined（呼叫端要隱藏入口，不能沿用舊設定） */
export async function evActive(): Promise<{ event: any | null; serverTime: number; left?: number | null } | undefined> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
  try { const r = await fetch(API + '/events/active?game=oyster-sim&id=' + encodeURIComponent(D.id), { mode: 'cors', cache: 'no-store', signal: ac.signal }); if (!r.ok) return undefined; const j = await r.json(); return j && typeof j.serverTime === 'number' ? j : undefined; }
  catch { return undefined; } finally { clearTimeout(t); }
}
// 開始一場活動：伺服器發場次 token（次數上限在伺服器扣）。ok / limit / ended / net
export async function evStart(eventId: number): Promise<{ st: 'ok'; token: string; left: number | null } | { st: 'limit' | 'ended' | 'net' }> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(API + '/events/start', { method: 'POST', body: JSON.stringify({ id: D.id, eventId }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors', signal: ac.signal });
    const j = await r.json().catch(() => null);
    if (r.ok && j && typeof j.token === 'string') return { st: 'ok', token: j.token, left: typeof j.left === 'number' ? j.left : null };
    if (j?.error === 'limit') return { st: 'limit' };
    if (j?.error === 'ended') return { st: 'ended' };
    return { st: 'net' };
  } catch { return { st: 'net' }; } finally { clearTimeout(t); }
}
export function evResult(d: { eventId: number; token: string; sid: string; score: number; meat: number; completed: boolean; early: boolean }) { return post('/events/result', d); }
export function evTop(eventId: number) { return get(`/events/top?eventId=${eventId}&id=${encodeURIComponent(D.id)}${tq()}`); }

// ---------- 問卷調查 ----------
export type SurveyQ = { id: string; type: 'single' | 'multi' | 'text'; text: string; required: boolean; options?: string[]; maxLen?: number };
export type SurveyCfg = { id: number; title: string; desc: string; questions: SurveyQ[]; rewardMoney: number; start: number; end: number; done?: boolean };
/** 進行中問卷；連不上回傳 undefined（呼叫端要隱藏入口） */
export async function svActive(): Promise<{ surveys: SurveyCfg[]; serverTime: number } | undefined> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(API + '/surveys/active?game=oyster-sim&id=' + encodeURIComponent(D.id), { mode: 'cors', cache: 'no-store', signal: ac.signal });
    if (!r.ok) return undefined;
    const j = await r.json();
    return j && typeof j.serverTime === 'number' && Array.isArray(j.surveys) ? j : undefined;
  } catch { return undefined; } finally { clearTimeout(t); }
}
/** 提交問卷：ok 帶回現金獎勵；already／ended／bad／net */
export async function svSubmit(surveyId: number, answers: Record<string, unknown>): Promise<{ st: 'ok'; money: number } | { st: 'already' | 'ended' | 'bad' | 'net'; error?: string }> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
  try {
    const r = await fetch(API + '/surveys/submit', {
      method: 'POST', body: JSON.stringify({ id: D.id, nick: D.nick(), test: D.test, surveyId, answers }),
      headers: { 'Content-Type': 'text/plain' }, mode: 'cors', signal: ac.signal,
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) return { st: 'ok', money: Math.max(0, Math.floor(Number(j.reward?.money) || 0)) };
    if (j?.error === 'already') return { st: 'already' };
    if (j?.error === 'ended') return { st: 'ended' };
    if (r.status === 400) return { st: 'bad', error: typeof j?.error === 'string' ? j.error : undefined };
    return { st: 'net' };
  } catch { return { st: 'net' }; } finally { clearTimeout(t); }
}

/** 改名視窗完成改名後通知 Discord */
export async function announceRename(oldNick: string) {
  if (!myTagCache) { try { await me(); } catch { /* */ } }
  void postDiscordRename(oldNick, D.nick(), { tag: myTagCache });
}

// ---------- 遊戲公告 ----------
export type NoticeItem = { id: number; title: string; body: string; start: number; end: number; updated: number };
/** 進行中公告；連不上回傳 undefined */
export async function noticesActive(): Promise<{ notices: NoticeItem[]; serverTime: number } | undefined> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(API + '/notices?game=oyster-sim', { mode: 'cors', cache: 'no-store', signal: ac.signal });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!j || typeof j.serverTime !== 'number' || !Array.isArray(j.notices)) return undefined;
    const notices: NoticeItem[] = [];
    for (const x of j.notices) {
      if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' || typeof x.body !== 'string') continue;
      notices.push({
        id: x.id,
        title: x.title,
        body: x.body,
        start: Number(x.start) || 0,
        end: Number(x.end) || 0,
        updated: Number(x.updated) || 0,
      });
    }
    return { notices, serverTime: j.serverTime };
  } catch { return undefined; } finally { clearTimeout(t); }
}
