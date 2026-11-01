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
function showNext() {
  const el = $('feed');
  if (busy || !queue.length || !D.on() || D.inTut()) return;
  busy = true; const txt = queue.shift()!;
  el.innerHTML = `<span class="fdIn"><i class="ic ic-horn"></i> ${txt}</span>`; el.classList.add('on');
  const s = el.firstElementChild as HTMLElement; s.style.animationDuration = Math.max(7, (txt.length + 10) * 0.32) + 's';
  s.onanimationend = () => { el.classList.remove('on'); el.innerHTML = ''; busy = false; setTimeout(showNext, 600); };
}
async function poll() {
  if (document.hidden) return;
  polls++;
  if (D.on()) {
    const r = await get(`/events?since=${last}${tq()}`);
    if (r && typeof r.last === 'number') {
      const first = last === 0; last = r.last;
      if (!first) for (const e of r.events ?? []) { if (queue.length < 6) queue.push(`<b>${esc(e.nick)}</b><small>#${esc(e.tag)}</small> ${esc(D.label(e.kind, e.item))}`); }
      showNext();
    }
  }
  if (polls % 2 === 0) checkPassed();
}
export function report(kind: 'pearl' | 'legend' | 'port', item: number) { if (D.on() && !D.inTut()) post('/event', { kind, item }); }

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
  const f = document.createElement('div'); f.id = 'feed'; document.body.appendChild(f);
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
