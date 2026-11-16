/**
 * 蚵仔煎全服廣播：全服首創（伺服器判定誰先煎出）、請阿婆吃高分。
 * 後端：POST /s/cook/first、POST /s/bc/ama、POST /s/cook/seen、GET /s/bc、GET /s/cook/firsts。
 * 舊伺服器沒有這些路徑時全部安靜失敗（不顯示首創、不跳橫幅），遊戲照常。
 */
import { comboHasFood, comboName } from '../cook/combo';
import { socialPost, socialGet, socialTest, socialShow, socialInTut, socialNick } from './social';

export type CookFirst = { nick: string; tag: string; ts: number };
const firsts = new Map<number, CookFirst>();
let firstsAt = 0, firstsBusy: Promise<void> | null = null;
const listeners = new Set<() => void>();

const tq = () => (socialTest() ? '?test=1' : '');
const tq2 = () => (socialTest() ? '&test=1' : '');
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');

export const AMA_BC_MIN = 85;

/** 這款的全服首創（沒有資料回 null） */
export function cookFirstOf(id: number): CookFirst | null { return firsts.get(id) ?? null; }
export function onCookFirsts(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }

/** 拿首創名單（1 分鐘內不重拿；force 忽略快取） */
export function loadCookFirsts(force = false): Promise<void> {
  if (firstsBusy) return firstsBusy;
  if (!force && performance.now() - firstsAt < 60_000 && firstsAt > 0) return Promise.resolve();
  firstsBusy = (async () => {
    const r = await socialGet('/cook/firsts' + tq());
    firstsAt = performance.now();
    if (r && Array.isArray(r.list)) {
      firsts.clear();
      for (const row of r.list) {
        if (!Array.isArray(row)) continue;
        const id = Number(row[0]);
        if (Number.isInteger(id)) firsts.set(id, { nick: String(row[1] ?? ''), tag: String(row[2] ?? ''), ts: Number(row[3]) || 0 });
      }
      listeners.forEach(f => { try { f(); } catch { /* 畫面更新失敗不影響 */ } });
    }
  })().finally(() => { firstsBusy = null; });
  return firstsBusy;
}

/* ───────── 橫幅 ───────── */
type Item = { kind: 'first' | 'ama'; nick: string; tag: string; combo: number; score: number };
const queue: Item[] = [];
let showing = false;
/** 自己剛播過的（輪詢回來時不再播一次）：kind|combo|score */
const mine = new Map<string, number>();

const SV = (p: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC_FIRST = SV('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>');
const IC_AMA = SV('<path d="M3 11h18"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M9 7c0-1.5 1-2 1-3M13 7c0-1.5 1-2 1-3"/>');

function bannerText(it: Item) {
  const who = `<b>${esc(it.nick || '有人')}</b>${it.tag ? `<small>#${esc(it.tag)}</small>` : ''}`;
  return it.kind === 'first'
    ? `${who} 全服首次煎出〈${esc(comboName(it.combo))}〉`
    : `${who} 請阿婆吃〈${esc(comboName(it.combo))}〉，拿到 <b>${it.score}</b> 分`;
}

function push(it: Item) {
  if (!socialShow()) return;
  if (queue.length >= 6) queue.shift();
  queue.push(it);
  if (!showing) next();
}

let hideT = 0, nextT = 0;
/** 收起目前這則，稍後換下一則（點一下或時間到） */
function dismiss(delay = 350) {
  const el = document.getElementById('bcBanner');
  window.clearTimeout(hideT); window.clearTimeout(nextT);
  el?.classList.remove('on');
  nextT = window.setTimeout(next, delay);
}

function bannerEl() {
  let el = document.getElementById('bcBanner');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'bcBanner';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.title = '點一下關閉';
  // 只有橫幅本身吃點擊；點了立刻收起、換下一則，不傳到遊戲畫面
  const stop = (e: Event) => e.stopPropagation();
  el.addEventListener('pointerdown', stop);
  el.addEventListener('touchstart', stop, { passive: true });
  el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); if (el!.classList.contains('on')) dismiss(200); });
  document.body.appendChild(el);
  return el;
}

function next() {
  const it = queue.shift();
  const el = document.getElementById('bcBanner');
  if (!it) { showing = false; el?.classList.remove('on'); return; }
  showing = true;
  const b = el ?? bannerEl();
  b.innerHTML = `<span class="bcIc">${it.kind === 'first' ? IC_FIRST : IC_AMA}</span><span class="bcTx"><em>${it.kind === 'first' ? '全服首創' : '阿婆好評'}</em>${bannerText(it)}</span>`;
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  window.clearTimeout(hideT);
  hideT = window.setTimeout(() => dismiss(350), 4000);
}

/* ───────── 回報 ───────── */
/** 煎好一盤（自家煎台、廣場煎台都算）：問伺服器是不是全服首創 */
export async function reportCookDone(combo: number) {
  if (!comboHasFood(combo) || socialInTut()) return;
  const r = await socialPost('/cook/first', { combo });
  if (!r || !r.ok) return;
  if (r.first) {
    firsts.set(combo, { nick: String(r.nick ?? ''), tag: String(r.tag ?? ''), ts: Number(r.ts) || Date.now() });
    listeners.forEach(f => { try { f(); } catch { /* */ } });
  }
  if (r.broadcast) {
    mine.set(`first|${combo}|0`, Date.now());
    push({ kind: 'first', nick: String(r.nick || socialNick()), tag: String(r.tag ?? ''), combo, score: 0 });
  }
}

/** 請阿婆吃拿到 85 分以上：全服廣播 */
/** showAfterMs＝等阿婆吃完、頭上冒分數時才跳自己的橫幅 */
export async function reportAmaScore(combo: number, score: number, showAfterMs = 0) {
  if (score < AMA_BC_MIN || !comboHasFood(combo) || socialInTut()) return;
  const t0 = performance.now();
  const sc = Math.round(score);
  const r = await socialPost('/bc/ama', { combo, score: sc });
  // 伺服器確認要播（30 秒內沒播過）→ 全服都會看到；連不上／舊伺服器（r＝null）→ 至少自己這邊照樣跳
  if (r?.broadcast || r == null) {
    mine.set(`ama|${combo}|${sc}`, Date.now());
    const wait = Math.max(0, showAfterMs - (performance.now() - t0));
    window.setTimeout(() => push({ kind: 'ama', nick: socialNick(), tag: '', combo, score: sc }), wait);
  }
}

/* ───────── 輪詢 ───────── */
let last = -1, timer = 0, polling = false;
async function poll() {
  if (polling || document.hidden) return;
  polling = true;
  try {
    const r = await socialGet(`/bc?since=${last}${tq2()}`);
    if (!r || typeof r.last !== 'number') return;
    const first = last < 0;
    last = r.last;
    if (first) return; // 剛開遊戲不補播
    const now = Date.now();
    for (const [k, t] of mine) if (now - t > 120_000) mine.delete(k);
    for (const e of Array.isArray(r.items) ? r.items : []) {
      const kind = e?.kind === 'first' ? 'first' : e?.kind === 'ama' ? 'ama' : null;
      const combo = Number(e?.combo), score = Number(e?.score) || 0;
      if (!kind || !Number.isInteger(combo)) continue;
      const key = `${kind}|${combo}|${kind === 'ama' ? score : 0}`;
      if (mine.has(key) && String(e?.nick ?? '') === socialNick()) { mine.delete(key); continue; }
      if (kind === 'first' && !firsts.has(combo)) firsts.set(combo, { nick: String(e?.nick ?? ''), tag: String(e?.tag ?? ''), ts: Number(e?.ts) || now });
      push({ kind, nick: String(e?.nick ?? ''), tag: String(e?.tag ?? ''), combo, score });
    }
  } finally { polling = false; }
}

/** 開遊戲時呼叫一次：每 12 秒看有沒有新的全服廣播（主選單、工寮、廣場都會收到） */
/**
 * 圖鑑收集榜：這版之前煎過的款式一次補登到伺服器（伺服器每人只收一次、只收有食材的組合）。
 * 本機圖鑑是空的就先不送（雲端存檔還沒載回來時不會白白用掉這一次）；舊伺服器沒有這條路徑時下次開遊戲再試。
 */
export function syncCookDexOnce(ids: number[]) {
  const key = 'oyster-ck-seen-up' + (socialTest() ? '-t' : '');
  try { if (localStorage.getItem(key)) return; } catch { return; }
  const list = [...new Set(ids)].filter(id => Number.isInteger(id) && comboHasFood(id)).slice(0, 2304);
  if (!list.length) return;
  window.setTimeout(async () => {
    const r = await socialPost('/cook/seen', { combos: list });
    if (r?.ok) { try { localStorage.setItem(key, '1'); } catch { /* 存不了下次再送，伺服器只收一次 */ } }
  }, 6000);
}

export function initCookBroadcast() {
  if (timer) return;
  window.setTimeout(poll, 4000);
  timer = window.setInterval(poll, 12_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll(); });
}
