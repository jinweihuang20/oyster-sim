import * as SocialNS from './social';
import type { EvCfg, EvOdd } from './eventsTypes';
export type { EvCfg, EvOdd } from './eventsTypes';

export type EventsHost = {
  $: (id: string) => HTMLElement;
  persist: () => void;
  toast: (t: string, c?: string) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  esc: (s: string) => string;
  Social: typeof SocialNS;
  ODD: readonly { name: string; weight: number; limited?: boolean }[];
  rarOf: (w: number) => string;
  legendTotal: () => number;
  renderDex: () => void;
  renderLocs: (o?: any) => void;
  audio: () => AudioContext;
  startDay: () => void;
  later: (s: number, f: () => void) => void;
  endDay: () => void;
  achBump: (k: string, n?: number) => void;
  AS: (k: string) => number;
  SHOT: string | null;
  SHIFT: number;
  get save(): any;
  get state(): string;
  get tut(): any;
  get count(): number;
  set count(v: number);
  get timeLeft(): number;
  get shiftLen(): number;
  set shiftLen(v: number);
  get endReason(): string;
  set endReason(v: string);
  get lastPay(): any;
  get statsSid(): string;
  get evToken(): string | null;
  set evToken(v: string | null);
  get evRun(): EvCfg | null;
  set evRun(v: EvCfg | null);
  get evLastId(): number | null;
  set evLastId(v: number | null);
  get evBusy(): boolean;
  set evBusy(v: boolean);
  returnToMainMenu: (work?: () => void | Promise<void>, opts?: { then?: () => void }) => void;
};

let H: EventsHost;

const EV_RULE: Record<string, string> = { normal: '一般，可剝可偷', steal_only: '只能用偷的', no_steal: '不能偷' };
export let evCfg: EvCfg | null = null, evSkew = 0, evShown = false;
export function evMeat() {
  if (!H.evRun || H.state !== 'play' || H.tut) return;
  const tgt = H.evRun.earlyMeat;
  if (tgt && H.count >= tgt && H.endReason !== 'early') { H.endReason = 'early'; H.toast('達成目標，提前完工！', '#ffd76a'); H.later(0.8, H.endDay); }
}
export function evHud() {
  const el = document.getElementById('evHud'); if (!el) return;
  if (!H.evRun || H.state !== 'play') { el.style.display = 'none'; document.body.classList.remove('evOn'); return; }
  document.body.classList.add('evOn');
  const t = H.evRun.earlyMeat, rule = H.evRun.steal === 'no_steal' ? '本活動不能偷' : H.evRun.steal === 'steal_only' ? '本活動只能用偷的' : '';
  el.innerHTML = `<i class="ic ic-lantern"></i>${t ? `<b>${Math.min(H.count, t)}/${t}</b>` : `<b>${H.esc(H.evRun.name)}</b>`}${rule ? `<small>${rule}</small>` : ''}`;
  el.style.display = '';
}
const evOdds = (l: EvOdd[]) => (Array.isArray(l) ? l : []).filter(o => Number.isInteger(o?.i) && H.ODD[o.i] && o.n > 0).map(o => ({ i: o.i, n: Math.min(99, Math.floor(o.n)) }));
// 收工：發活動獎勵（同一工只發一次，存檔記住 sid 防重複領）、回報成績、組收工畫面的活動區塊
export function evFinish(ev: EvCfg, done: boolean, early: boolean): string {
  const sid = H.statsSid; H.save.evClaim ??= [];
  const fresh = done && !H.save.evClaim.includes(sid);
  const odds = done ? [...evOdds(ev.oddDone), ...(early ? evOdds(ev.oddEarly) : [])] : [];
  if (fresh) {
    H.save.evClaim.push(sid); H.save.evClaim = H.save.evClaim.slice(-30);
    for (const o of odds) { H.save.odd[o.i] = (H.save.odd[o.i] ?? 0) + o.n; const def = H.ODD[o.i]; if (H.rarOf(def.weight) === 'legend' && !def.limited) { H.save.legendDry = 0; H.save.legendN = H.legendTotal(); } }
    for (const i of new Set(odds.map(o => o.i))) H.Social.report(H.rarOf(H.ODD[i].weight) === 'legend' ? 'legend' : 'odd', i);
    H.renderDex();
  }
  const score = H.count * 1000 + (early ? Math.max(0, Math.ceil(H.timeLeft)) : 0);
  if (!H.SHOT) { if (H.evToken) H.Social.evResult({ eventId: ev.id, token: H.evToken, sid, score, meat: H.count, completed: done, early }); H.track('event_end', { item: 'ev-' + ev.id, count: H.count, earn: H.lastPay.earn, reason: early ? 'time' : H.endReason === 'quit' ? 'quit' : 'time', dur: Math.round(H.shiftLen - Math.max(0, H.timeLeft)) }); }
  const row = (l: string, v: string, on = true) => `<div class="row${on ? '' : ' off'}"><span>${l}</span><b>${v}</b></div>`;
  const oddRow = (l: EvOdd[]) => l.map(o => `${H.esc(H.ODD[o.i].name)} ×${o.n}`).join('、');
  return `<div class="evRes"><h3><i class="ic ic-lantern"></i> 活動獎勵・${H.esc(ev.name)}</h3>` +
    row('完工獎勵', done ? `+$${ev.bonus}` : '未完工', done) +
    (ev.earlyMeat ? row(`提前完工額外獎勵（${ev.earlyMeat} 顆）`, early ? `+$${ev.earlyBonus}` : `${Math.min(H.count, ev.earlyMeat)}/${ev.earlyMeat}`, early) : '') +
    (evOdds(ev.oddDone).length ? row('完工奇物', oddRow(evOdds(ev.oddDone)), done) : '') +
    (ev.earlyMeat && evOdds(ev.oddEarly).length ? row('提前完工奇物', oddRow(evOdds(ev.oddEarly)), early) : '') +
    (done && !fresh ? '<p class="evNote">這一工的獎勵已經領過了</p>' : odds.length && fresh ? '<p class="evNote">奇物已收進圖鑑</p>' : '') +
    `<button id="resEvLb" class="evLbBtn"><i class="ic ic-rank"></i> 活動排行榜</button></div>`;
}
export function evLeft(ms: number) { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return d ? `${d} 天 ${h} 小時` : h ? `${h} 小時 ${mm} 分` : `${mm} 分`; }
export function evRender() {
  const box = H.$('evEntry'); const ev = evCfg;
  if (!ev || Date.now() + evSkew >= ev.end) { box.style.display = 'none'; evCfg = null; return; }
  const left = ev.end - (Date.now() + evSkew);
  box.innerHTML = `<div class="evHd"><i class="ic ic-lantern"></i><b>活動場景</b><span class="evLeft"><i class="ic ic-timer"></i> 剩 ${evLeft(left)}</span></div>` +
    `<div class="evName">${H.esc(ev.name)}</div>${ev.desc ? `<p class="evDesc">${H.esc(ev.desc)}</p>` : ''}` +
    `<p class="evMeta">阿婆 ${ev.npc} 人・上工 ${Math.round(ev.dur / 60 * 10) / 10} 分鐘${ev.earlyMeat ? `・剝滿 ${ev.earlyMeat} 顆提前完工` : ''}・偷蚵仔：${EV_RULE[ev.steal] ?? EV_RULE.normal}${ev.infHp ? '・不會受傷' : ''}<br>完工 $${ev.bonus}${ev.earlyMeat ? `・提前完工再加 $${ev.earlyBonus}` : ''}</p>` +
    `<p class="evPlays">${ev.left == null ? '不限次數' : ev.left > 0 ? `還可以玩 ${ev.left} 次` : '這個活動的次數用完了'}</p>` +
    `<div class="evBtns"><button id="evGo"${ev.left === 0 ? ' disabled' : ''}><i class="ic ic-flag"></i> ${ev.left === 0 ? '次數用完了' : '參加活動'}</button><button id="evRank"><i class="ic ic-rank"></i> 活動排行榜</button></div>`;
  box.style.display = '';
  H.$('evGo').onclick = evStart; const eid = ev.id; H.$('evRank').onclick = () => evLbOpen(eid);
}
const evValid = (e: any): e is EvCfg => e && Number.isInteger(e.id) && typeof e.name === 'string' && Number.isFinite(e.npc) && Number.isFinite(e.dur) && e.dur > 0 && Number.isFinite(e.end);
export async function evFetch() {
  evCfg = null; evRender(); // 抓新的之前先藏起來，失敗就不顯示（不用舊設定）
  evFetchFrom(await H.Social.evActive());
}
export function evFetchFrom(r: Awaited<ReturnType<typeof H.Social.evActive>>) {
  if (!r || !evValid(r.event)) { evCfg = null; evRender(); return; }
  evSkew = r.serverTime - Date.now(); const e: any = r.event;
  evCfg = { ...e, throwX: Number(e.throwX) || 1, angerX: Number(e.angerX) || 1, bonus: Math.max(0, Number(e.bonus) || 0), earlyBonus: Math.max(0, Number(e.earlyBonus) || 0), earlyMeat: Number(e.earlyMeat) > 0 ? Math.floor(e.earlyMeat) : null, infHp: e.infHp === true, steal: ['steal_only', 'no_steal'].includes(e.steal) ? e.steal : 'normal', oddDone: evOdds(e.oddDone), oddEarly: evOdds(e.oddEarly), left: typeof r.left === 'number' ? Math.max(0, r.left) : null };
  evRender();
}
// 參加活動：先跟伺服器拿場次 token（次數上限由伺服器判斷），拿到才開工
export async function evStart(): Promise<boolean> {
  const ev = evCfg; if (!ev || Date.now() + evSkew >= ev.end) { evRender(); H.toast('活動已經結束了'); return false; }
  if (!H.save.tutDone) { H.toast('先完成教學再來參加活動喔'); return false; }
  if (ev.left === 0) { H.toast('這個活動的次數用完了'); return false; }
  if (H.evBusy) return false; H.evBusy = true;
  const b = document.getElementById('evGo') as HTMLButtonElement | null; if (b) b.disabled = true;
  const r = await H.Social.evStart(ev.id); H.evBusy = false;
  if (r.st !== 'ok') {
    if (r.st === 'limit') { ev.left = 0; H.toast('這個活動的次數用完了'); evRender(); }
    else if (r.st === 'ended') { H.toast('活動已經結束了'); evFetch(); }
    else { H.toast('連不上活動伺服器，等一下再試'); evRender(); }
    return false;
  }
  ev.left = r.left; H.evToken = r.token; H.evRun = ev; H.shiftLen = Math.max(10, Math.min(1800, Math.round(ev.dur))); H.audio(); H.startDay();
  return true;
}
// 收工畫面「再次上工」：剛剛是活動就再開一場同一個活動；活動結束或次數用完就回主選單
export async function evAgain() {
  if (H.evBusy) return;
  const id = H.evLastId; const ab = H.$('again') as HTMLButtonElement; ab.disabled = true;
  const r = await H.Social.evActive(); ab.disabled = false;
  const toMenu = (m: string) => { if (m) H.toast(m); H.evLastId = null; H.$('result').classList.remove('show'); H.returnToMainMenu(); };
  if (!r) { H.toast('連不上活動伺服器，等一下再試'); return; }
  if (!evValid(r.event) || r.event.id !== id) { toMenu('活動已經結束了'); return; }
  evFetchFrom(r);
  if (evCfg?.left === 0) { toMenu('這個活動的次數用完了'); return; }
  if (!(await evStart()) && !H.evRun) { if (H.$('result').classList.contains('show')) toMenu(''); }
}
export async function evLbOpen(id: number) {
  const body = H.$('evLbBody'); body.innerHTML = '<div class="lbEmpty"><span>載入中…</span></div>'; H.$('evLb').classList.add('show');
  const r = await H.Social.evTop(id);
  if (!r || !Array.isArray(r.rows)) { body.innerHTML = '<div class="lbEmpty"><i class="ic ic-warn"></i><span>排行榜暫時連不上<br><small>等一下再試試</small></span></div>'; return; }
  { const me = r.mine ?? r.rows.find((x: any) => x.me); if (me && me.rank <= 10 && !H.AS('top')) H.achBump('top'); }
  const row = (x: any) => `<div class="lbRow${x.me ? ' me' : ''}"><span class="lbR">${x.rank}</span><span class="lbN">${x.atitle ? `<span class="lbWho"><em class="lbAt">${H.esc(x.atitle)}</em><b class="lbNick">${H.esc(x.nick)}</b></span>` : `<span class="lbWho"><b class="lbNick">${H.esc(x.nick)}</b></span>`}<small class="lbId">#${H.esc(x.tag)}</small></span><span class="lbV">${Math.floor(x.v / 1000)} 顆${x.early ? `<small class="evE">提前 ${x.v % 1000} 秒</small>` : ''}</span></div>`;
  body.innerHTML = (r.event ? `<p class="evDesc">${H.esc(r.event.name)}・共 ${r.total ?? r.rows.length} 人參加</p>` : '') +
    (r.rows.length ? r.rows.map(row).join('') + (r.mine ? '<div class="lbGap"></div>' + row(r.mine) : '') : '<div class="lbEmpty"><i class="ic ic-rank"></i><span>還沒有人上榜<br><small>完成活動就會出現你的成績</small></span></div>');
}


export function setEvShown(v: boolean) { evShown = v; }

export function initEvents(host: EventsHost) {
  H = host;
  H.$('evLbClose').onclick = () => H.$('evLb').classList.remove('show');
}
