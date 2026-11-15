/** 煎台操作面板（自由煎，不計分不限時）與蚵仔煎圖鑑（三層）。 */
import { TOPS, BATTERS, DONES, SAUCES, COMBO_TOTAL, comboId, comboOf, comboName, comboFeatures, specialOf, SPECIAL_IDS, topName, cookTitle, COOK_TITLES, type Combo } from './combo';
import { dishThumb, mountDishViewer } from './dish3d';
import { foodCount, foodCountAny, takeFood } from '../food/pantry';
import { FOOD_BY_ID } from '../food/ingredients';

export type CookDeps = {
  getSave: () => { cookDex?: Record<string, number> };
  persist: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  toast: (text: string, color?: string) => void;
  /** 離開煎台（放掉位子） */
  leaveSeat: () => void;
  /** 煎的進度同步（步驟顆粒度） */
  progress: (stage: number, combo: number) => void;
  /** 展示；回傳是否成功 */
  display: (combo: number) => Promise<boolean>;
  /** 鍋上那盤（本機） */
  myPan: (combo: number) => void;
};

let D: CookDeps;
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const IC = {
  dex: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg>',
  dish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><ellipse cx="12" cy="13" rx="9" ry="5"/><ellipse cx="12" cy="12" rx="6" ry="3"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
};

const dex = () => (D.getSave().cookDex ??= {});
const has = (id: number) => !!dex()[String(id)];
const dexCount = () => Object.keys(dex()).length;
const fmtDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

export function initCook(deps: CookDeps) {
  D = deps;
  $('cookClose').addEventListener('click', () => closeCook(true));
  $('cookDexClose').addEventListener('click', () => closeDex());
}

/* ───────── 煎台 ───────── */

type Sel = { top: number; batter: number; egg: number; done: number; sauce: number };
let seat: number | null = null;
let step = 1;
let sel: Sel = { top: 0, batter: -1, egg: -1, done: -1, sauce: -1 };
let target: Combo | null = null;
let stopView: (() => void) | null = null;
let lastViewId = -2;
let pourT0 = 0, pourRaf = 0, pourFrac = 0;
let cookT0 = 0, cookRaf = 0, flipped = false, doneFrac = 0;
let resultId = -1;
let resultNew = false;
const POUR_MS = 2400, COOK_MS = 7000;
const DONE_EDGE = [0.38, 0.72];
const doneOf = (f: number) => (f < DONE_EDGE[0] ? 0 : f < DONE_EDGE[1] ? 1 : 2);
const batterOf = (f: number) => (f < 0.34 ? 1 : f < 0.67 ? 2 : 3);

const curCombo = (): Combo => ({ top: sel.top, batter: Math.max(0, sel.batter), egg: Math.max(0, sel.egg), done: Math.max(0, sel.done), sauce: Math.max(0, sel.sauce) });

export function cookOpenSeat() { return seat; }
export function cookPanelOpen() { return $('cook').classList.contains('show'); }

/** 站上位子、伺服器佔位成功後打開 */
export function openCook(s: number, preset?: number) {
  seat = s;
  resetSel(preset);
  $('cook').classList.add('show');
  if (document.pointerLockElement) document.exitPointerLock();
  render();
}

function resetSel(preset?: number) {
  step = 1; flipped = false; doneFrac = 0; pourFrac = 0; resultId = -1;
  cancelAnimationFrame(pourRaf); cancelAnimationFrame(cookRaf);
  target = preset != null && preset >= 0 ? comboOf(preset) : null;
  sel = { top: 0, batter: -1, egg: -1, done: -1, sauce: -1 };
  if (target) {
    for (const t of TOPS) if (target.top & t.bit && foodCountAny(t.food) > 0) sel.top |= t.bit;
  }
  sync(0);
}

/** 關閉：放掉位子 */
export function closeCook(leave = true) {
  cancelAnimationFrame(pourRaf); cancelAnimationFrame(cookRaf);
  stopView?.(); stopView = null; lastViewId = -2;
  $('cook').classList.remove('show');
  if (leave && seat != null) { seat = null; D.leaveSeat(); }
  seat = null;
}

function sync(stage: number) {
  const id = stage >= 1 ? comboId(curCombo()) : -1;
  D.progress(stage, id);
  D.myPan(stage >= 1 ? id : -1);
}

function mountView(id: number) {
  const cv = document.getElementById('ckView') as HTMLCanvasElement | null;
  if (!cv) return;
  if (id === lastViewId && stopView) return;
  stopView?.(); lastViewId = id;
  stopView = mountDishViewer(cv, id);
}

const hint = (ids: readonly string[]) => FOOD_BY_ID[ids[0]]?.how ?? '';
function chip(label: string, on: boolean, n: number | null, attr: string, disabled = false) {
  return `<button type="button" class="ckChip${on ? ' on' : ''}" ${attr}${disabled ? ' disabled' : ''}><span>${label}</span>${n != null ? `<small>×${n}</small>` : ''}</button>`;
}
function targetTip(txt: string) { return target ? `<p class="ckTarget">照圖鑑：${txt}</p>` : ''; }

function stepsBar() {
  const L = ['配料', '粉漿', '蛋', '煎', '醬', '完成'];
  return `<ol class="ckSteps">${L.map((s, i) => `<li class="${i + 1 < step ? 'done' : i + 1 === step ? 'cur' : ''}">${s}</li>`).join('')}</ol>`;
}

function render() {
  const body = $('cookBody');
  const head = `<div class="ckHead"><b>煎台 ${seat != null ? seat + 1 : ''} 號</b><button type="button" class="ckLink" data-ck="dex">${IC.dex}圖鑑</button></div>`;
  let html = head + stepsBar() + `<div class="ckViewW"><canvas id="ckView" width="256" height="256"></canvas></div>`;
  if (step === 1) {
    const lack = TOPS.filter(t => foodCountAny(t.food) === 0);
    html += `<h3 class="ckH">選配料（可複選）</h3><div class="ckChips">${TOPS.map(t => { const n = foodCountAny(t.food); return chip(t.n, !!(sel.top & t.bit), n, `data-top="${t.bit}"`, n === 0); }).join('')}</div>`
      + (lack.length ? `<p class="ckHint">${IC.info}${lack.map(t => `${t.n}：${hint(t.food)}`).join('；')}</p>` : '')
      + targetTip(topName(target?.top ?? 0) || '不放配料')
      + `<div class="ckAct"><button type="button" class="ckBtn pri" data-ck="next">下一步</button></div>`;
  } else if (step === 2) {
    const n = foodCount('flour');
    html += `<h3 class="ckH">倒粉漿：按住越久越厚</h3>`
      + `<div class="ckMeter"><div class="ckFill" id="ckPour" style="width:${pourFrac * 100}%"></div><span style="left:0;width:34%">薄脆</span><span style="left:34%;width:33%">標準</span><span style="left:67%;width:33%">厚實</span></div>`
      + targetTip(BATTERS[target?.batter ?? 0])
      + `<div class="ckAct"><button type="button" class="ckBtn" data-ck="nobatter">不加粉漿</button><button type="button" class="ckBtn pri ckHold" id="ckPourBtn"${n ? '' : ' disabled'}>按住倒粉漿<small>地瓜粉 ×${n}</small></button></div>`
      + (n ? '' : `<p class="ckHint">${IC.info}地瓜粉：${hint(['flour'])}</p>`);
  } else if (step === 3) {
    const n = foodCount('egg');
    html += `<h3 class="ckH">要加蛋嗎？</h3><div class="ckChips">${chip('加蛋', sel.egg === 1, n, 'data-egg="1"', n === 0)}${chip('不加蛋', sel.egg === 0, null, 'data-egg="0"')}</div>`
      + (n ? '' : `<p class="ckHint">${IC.info}雞蛋：${hint(['egg'])}</p>`)
      + targetTip(target?.egg ? '加蛋' : '不加蛋');
  } else if (step === 4) {
    html += `<h3 class="ckH">先「翻面」，再看準時機「鏟起」</h3>`
      + `<div class="ckMeter done"><div class="ckFill" id="ckDone" style="width:${doneFrac * 100}%"></div><span style="left:0;width:38%">嫩</span><span style="left:38%;width:34%">金黃</span><span style="left:72%;width:28%">焦香</span></div>`
      + targetTip(DONES[target?.done ?? 0])
      + `<div class="ckAct"><button type="button" class="ckBtn" data-ck="flip"${flipped ? ' disabled' : ''}>${flipped ? '已翻面' : '翻面'}</button><button type="button" class="ckBtn pri" data-ck="scoop"${flipped ? '' : ' disabled'}>鏟起</button></div>`;
  } else if (step === 5) {
    html += `<h3 class="ckH">淋什麼醬？</h3><div class="ckChips">${SAUCES.map((s, i) => { const n = i ? foodCount(s.id) : null; return chip(s.n, sel.sauce === i, n, `data-sauce="${i}"`, i > 0 && n === 0); }).join('')}</div>`
      + (SAUCES.slice(1).some(s => foodCount(s.id) === 0) ? `<p class="ckHint">${IC.info}醬料在廣場食材攤買；阿婆祕傳醬要用殼丟中阿婆才有機會拿到</p>` : '')
      + targetTip(SAUCES[target?.sauce ?? 0].n);
  } else {
    const id = resultId, sp = specialOf(id), isNew = resultNew;
    html += `<div class="ckResult"><div class="ckName">${esc(comboName(id))}${sp ? '<span class="ckTag">隱藏款</span>' : ''}${isNew ? '<span class="ckTag new">新收集</span>' : ''}</div>`
      + (sp ? `<p class="ckDesc">${esc(sp.desc)}</p>` : '')
      + `<ul class="ckFeat">${comboFeatures(id).map(f => `<li>${f}</li>`).join('')}</ul>`
      + `<p class="ckSum">圖鑑 ${dexCount()}／${COMBO_TOTAL.toLocaleString()}${cookTitle(dexCount()) ? `・${cookTitle(dexCount())}` : ''}</p></div>`
      + `<div class="ckAsk" id="ckAsk"><b>要展示嗎？</b><span>會放在煎台旁，大家都看得到；每人一盤，離開廣場就收掉</span><div class="ckAct"><button type="button" class="ckBtn" data-ck="nodisp">不用</button><button type="button" class="ckBtn pri" data-ck="disp">展示</button></div></div>`
      + `<div class="ckAct"><button type="button" class="ckBtn" data-ck="again">再煎一盤</button></div>`;
  }
  body.innerHTML = html;
  mountView(step === 6 ? resultId : step === 1 && !sel.top ? comboId({ top: 0, batter: 0, egg: 0, done: 0, sauce: 0 }) : comboId(curCombo()));
  bind(body);
}

function bind(body: HTMLElement) {
  body.querySelectorAll<HTMLButtonElement>('[data-top]').forEach(b => b.onclick = () => { sel.top ^= Number(b.dataset.top); render(); });
  body.querySelectorAll<HTMLButtonElement>('[data-egg]').forEach(b => b.onclick = () => { sel.egg = Number(b.dataset.egg); step = 4; sync(3); startCook(); });
  body.querySelectorAll<HTMLButtonElement>('[data-sauce]').forEach(b => b.onclick = () => { sel.sauce = Number(b.dataset.sauce); finish(); });
  body.querySelectorAll<HTMLButtonElement>('[data-ck]').forEach(b => b.onclick = () => {
    const k = b.dataset.ck;
    if (k === 'dex') openDex(target ? comboId(target) : undefined);
    else if (k === 'next') { step = 2; sync(1); render(); }
    else if (k === 'nobatter') { sel.batter = 0; step = 3; sync(2); render(); }
    else if (k === 'flip') { flipped = true; render(); }
    else if (k === 'scoop') scoop();
    else if (k === 'disp') void doDisplay(b);
    else if (k === 'nodisp') document.getElementById('ckAsk')?.remove();
    else if (k === 'again') { resetSel(target ? comboId(target) : undefined); render(); }
  });
  const pb = document.getElementById('ckPourBtn') as HTMLButtonElement | null;
  if (pb) {
    const start = (e: Event) => {
      e.preventDefault(); if (pb.disabled || pourT0) return;
      pourT0 = performance.now();
      const tick = () => {
        pourFrac = Math.min(1, (performance.now() - pourT0) / POUR_MS);
        const f = document.getElementById('ckPour'); if (f) f.style.width = `${pourFrac * 100}%`;
        if (pourFrac >= 1) { end(); return; }
        pourRaf = requestAnimationFrame(tick);
      };
      tick();
    };
    const end = () => {
      if (!pourT0) return;
      cancelAnimationFrame(pourRaf); pourT0 = 0;
      sel.batter = batterOf(Math.max(0.01, pourFrac));
      step = 3; sync(2); render();
    };
    pb.addEventListener('pointerdown', start);
    pb.addEventListener('pointerup', end); pb.addEventListener('pointerleave', end); pb.addEventListener('pointercancel', end);
    pb.addEventListener('contextmenu', e => e.preventDefault());
  }
}

function startCook() {
  cookT0 = performance.now(); flipped = false; doneFrac = 0;
  render();
  let lastBand = -1;
  const tick = () => {
    doneFrac = Math.min(1, (performance.now() - cookT0) / COOK_MS);
    const f = document.getElementById('ckDone'); if (f) f.style.width = `${doneFrac * 100}%`;
    const band = doneOf(doneFrac);
    if (band !== lastBand) { lastBand = band; sel.done = band; mountView(comboId(curCombo())); D.myPan(comboId(curCombo())); }
    if (doneFrac >= 1) { flipped = true; scoop(); return; }
    cookRaf = requestAnimationFrame(tick);
  };
  tick();
}

function scoop() {
  cancelAnimationFrame(cookRaf);
  sel.done = doneOf(doneFrac);
  step = 5; sync(4); render();
}

/** 收尾：扣食材、記圖鑑、問要不要展示 */
function finish() {
  const c = curCombo();
  // 選的時候有，煎完時可能剛好過期：缺的就當沒加
  for (const t of TOPS) if (c.top & t.bit && !takeFood(t.food)) c.top &= ~t.bit;
  if (c.batter && !takeFood(['flour'])) c.batter = 0;
  if (c.egg && !takeFood(['egg'])) c.egg = 0;
  if (c.sauce && !takeFood([SAUCES[c.sauce].id])) c.sauce = 0;
  sel = { ...c };
  const id = comboId(c);
  const before = dexCount();
  const isNew = !has(id);
  if (isNew) { dex()[String(id)] = Date.now(); D.persist(); }
  resultNew = isNew;
  resultId = id; step = 6;
  sync(6);
  D.track('cook', { item: 'cook-' + id, combo: id, kind: isNew ? 'new' : 'repeat', count: dexCount() });
  const after = dexCount();
  const m = COOK_TITLES.find(x => before < x.n && after >= x.n);
  if (m) D.toast(`圖鑑收集 ${m.n} 種，獲得稱號「${m.t}」`, '#9be37a');
  else if (specialOf(id) && isNew) D.toast(`發現隱藏款「${comboName(id)}」！`, '#9be37a');
  render();
}

async function doDisplay(b: HTMLButtonElement) {
  b.disabled = true;
  const ok = await D.display(resultId);
  const ask = document.getElementById('ckAsk');
  if (ok) { if (ask) ask.innerHTML = '<b>已展示在煎台旁</b><span>新展示會取代舊的那盤</span>'; }
  else { b.disabled = false; D.toast('展示失敗，再試一次', '#ffb08a'); }
}

/* ───────── 圖鑑 ───────── */

let dexLevel = 1, dexTop = 0, dexBatter = 2, dexEgg = 1, dexId = -1;
let fUn = false, fHidden = false, fq = '';
let stopDexView: (() => void) | null = null;
/** 從展示盤打開：顯示主人名字 */
let dexOwner = '';

export function openDex(id?: number, owner = '') {
  dexOwner = owner;
  if (id != null && id >= 0) { const c = comboOf(id); dexTop = c.top; dexBatter = c.batter; dexEgg = c.egg; dexId = id; dexLevel = 3; }
  else dexLevel = 1;
  $('cookDex').classList.add('show');
  renderDex();
}
export function closeDex() { stopDexView?.(); stopDexView = null; $('cookDex').classList.remove('show'); }
export function dexOpen() { return $('cookDex').classList.contains('show'); }

const SIL = `<span class="dxSil">${IC.dish}</span>`;
const thumb = (id: number) => { const u = dishThumb(id); return u ? `<img src="${u}" alt="" draggable="false">` : SIL; };
const groupCount = (top: number) => { let n = 0; for (const k of Object.keys(dex())) if (comboOf(Number(k)).top === top) n++; return n; };
const topLabel = (top: number) => topName(top) || '不放配料';

function dexHead() {
  const n = dexCount(), t = cookTitle(n), next = COOK_TITLES.find(m => m.n > n);
  return `<div class="dxTotal"><div><b>已收集 ${n.toLocaleString()}／${COMBO_TOTAL.toLocaleString()}</b>${t ? `<span class="dxTitle">${t}</span>` : ''}</div><div class="dxBar"><i style="width:${(n / COMBO_TOTAL) * 100}%"></i></div>${next ? `<small>再收集 ${next.n - n} 種可得稱號「${next.t}」</small>` : '<small>所有稱號都拿到了</small>'}</div>`;
}
function filters() {
  return `<div class="dxFilt"><label class="dxSearch">${IC.search}<input id="dxQ" type="search" placeholder="搜尋名稱，例：沙茶花枝" value="${esc(fq)}"></label><div class="dxTog"><button type="button" class="ckChip sm${fUn ? ' on' : ''}" data-f="un">未收集</button><button type="button" class="ckChip sm${fHidden ? ' on' : ''}" data-f="hid">隱藏款</button></div></div>`;
}

function renderDex() {
  stopDexView?.(); stopDexView = null;
  const B = $('cookDexBody');
  let html = '';
  if (dexLevel === 1) {
    html = dexHead() + filters();
    if (fq.trim() || fHidden) {
      const q = fq.trim();
      const ids: number[] = [];
      const pool = fHidden ? SPECIAL_IDS : Array.from({ length: COMBO_TOTAL }, (_, i) => i);
      for (const id of pool) {
        if (fUn && has(id)) continue;
        // 隱藏款沒收集前不給搜名字
        const nm = specialOf(id) && !has(id) ? '' : comboName(id);
        if (q && !nm.includes(q)) continue;
        ids.push(id); if (ids.length >= 60) break;
      }
      html += ids.length ? `<div class="dxList">${ids.map(id => { const hid = !!specialOf(id) && !has(id); return `<button type="button" class="dxItem${has(id) ? '' : ' un'}" data-id="${id}">${has(id) ? thumb(id) : SIL}<span>${hid ? '？？？（隱藏款）' : esc(comboName(id))}</span></button>`; }).join('')}</div>` : '<p class="dxEmpty">沒有符合的蚵仔煎</p>';
    } else {
      const tops = Array.from({ length: 16 }, (_, i) => i).filter(t => !fUn || groupCount(t) < 144);
      html += `<div class="dxCards">${tops.map(t => {
        const n = groupCount(t);
        const first = Object.keys(dex()).map(Number).find(id => comboOf(id).top === t);
        return `<button type="button" class="dxCard" data-top="${t}">${first != null ? thumb(first) : SIL}<b>${topLabel(t)}</b><span class="dxMini"><i style="width:${(n / 144) * 100}%"></i></span><small>${n}／144</small></button>`;
      }).join('')}</div>`;
    }
  } else if (dexLevel === 2) {
    html = `<div class="dxNav"><button type="button" class="ckLink" data-nav="1">${IC.back}全部</button><b>${topLabel(dexTop)}</b><small>${groupCount(dexTop)}／144</small></div>`
      + `<div class="dxSeg">${BATTERS.map((b, i) => `<button type="button" class="${i === dexBatter ? 'on' : ''}" data-b="${i}">${b === '不加粉漿' ? '無粉漿' : b}</button>`).join('')}</div>`
      + `<div class="dxSeg">${['無蛋', '加蛋'].map((e, i) => `<button type="button" class="${i === dexEgg ? 'on' : ''}" data-e="${i}">${e}</button>`).join('')}</div>`
      + `<div class="dxGrid"><span></span>${SAUCES.map(s => `<span class="dxCol">${s.short || '無醬'}</span>`).join('')}`
      + DONES.map((d, di) => `<span class="dxRow">${d}</span>` + SAUCES.map((_, si) => {
        const id = comboId({ top: dexTop, batter: dexBatter, egg: dexEgg, done: di, sauce: si });
        const got = has(id);
        if (fUn && got) return '<span class="dxCell gone"></span>';
        return `<button type="button" class="dxCell${got ? '' : ' un'}" data-id="${id}" aria-label="${got ? esc(comboName(id)) : '未收集'}">${got ? thumb(id) : SIL}</button>`;
      }).join('')).join('') + '</div>';
  } else {
    const id = dexId, got = has(id), sp = specialOf(id), hid = !!sp && !got;
    html = `<div class="dxNav"><button type="button" class="ckLink" data-nav="2">${IC.back}${topLabel(comboOf(id).top)}</button></div>`
      + `<div class="ckViewW big${got ? '' : ' un'}"><canvas id="dxView" width="256" height="256"></canvas>${got ? '' : '<span class="dxLock">還沒煎過</span>'}</div>`
      + `<div class="ckName">${hid ? '？？？' : esc(comboName(id))}${sp ? '<span class="ckTag">隱藏款</span>' : ''}</div>`
      + (dexOwner ? `<p class="ckDesc">${esc(dexOwner)} 展示的作品</p>` : '')
      + (sp && got ? `<p class="ckDesc">${esc(sp.desc)}</p>` : '')
      + `<ul class="ckFeat">${hid ? '<li>條件保密，煎出來才知道</li>' : comboFeatures(id).map(f => `<li>${f}</li>`).join('')}</ul>`
      + `<p class="ckSum">${got ? `第一次煎出：${fmtDate(dex()[String(id)])}` : '還沒收集'}</p>`
      + `<div class="ckAct"><button type="button" class="ckBtn pri" data-ck="follow"${hid ? ' disabled' : ''}>照這樣煎</button></div>`
      + (seat == null ? '<p class="ckHint">' + IC.info + '到廣場東北角烹煮區，站上煎台位子後可以用</p>' : '');
  }
  B.innerHTML = html;
  B.scrollTop = dexLevel === 3 ? 0 : B.scrollTop;
  bindDex(B);
  if (dexLevel === 3) {
    const cv = document.getElementById('dxView') as HTMLCanvasElement | null;
    if (cv && !(specialOf(dexId) && !has(dexId))) stopDexView = mountDishViewer(cv, dexId);
  }
}

function bindDex(B: HTMLElement) {
  B.querySelectorAll<HTMLButtonElement>('[data-top]').forEach(b => b.onclick = () => {
    dexTop = Number(b.dataset.top); dexLevel = 2;
    // 預設切到這組最近收集的那種粉漿／蛋
    let best = -1, bt = 0;
    for (const [k, t] of Object.entries(dex())) { const c = comboOf(Number(k)); if (c.top === dexTop && t > bt) { bt = t; best = Number(k); } }
    if (best >= 0) { const c = comboOf(best); dexBatter = c.batter; dexEgg = c.egg; }
    renderDex();
  });
  B.querySelectorAll<HTMLButtonElement>('[data-id]').forEach(b => b.onclick = () => { dexId = Number(b.dataset.id); const c = comboOf(dexId); dexTop = c.top; dexBatter = c.batter; dexEgg = c.egg; dexOwner = ''; dexLevel = 3; renderDex(); });
  B.querySelectorAll<HTMLButtonElement>('[data-b]').forEach(b => b.onclick = () => { dexBatter = Number(b.dataset.b); renderDex(); });
  B.querySelectorAll<HTMLButtonElement>('[data-e]').forEach(b => b.onclick = () => { dexEgg = Number(b.dataset.e); renderDex(); });
  B.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(b => b.onclick = () => { dexLevel = Number(b.dataset.nav); renderDex(); });
  B.querySelectorAll<HTMLButtonElement>('[data-f]').forEach(b => b.onclick = () => { if (b.dataset.f === 'un') fUn = !fUn; else fHidden = !fHidden; renderDex(); });
  const q = document.getElementById('dxQ') as HTMLInputElement | null;
  if (q) {
    let t = 0;
    q.oninput = () => { clearTimeout(t); t = window.setTimeout(() => { fq = q.value; renderDex(); const n = document.getElementById('dxQ') as HTMLInputElement | null; if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  }
  B.querySelector<HTMLButtonElement>('[data-ck="follow"]')?.addEventListener('click', () => {
    if (seat == null) { D.toast('到廣場烹煮區站上煎台位子，再按「照這樣煎」', '#ffd76a'); return; }
    closeDex(); resetSel(dexId); render();
  });
}
