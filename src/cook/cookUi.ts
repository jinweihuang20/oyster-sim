/** 煎台操作面板（自由煎，不計分不限時）與蚵仔煎圖鑑（三層）。 */
import { TOPS, BATTERS, DONES, SAUCES, COMBO_TOTAL, comboId, comboOf, comboName, comboHasFood, comboFeatures, specialOf, SPECIAL_IDS, topName, cookTitle, COOK_TITLES, type Combo } from './combo';
import { dishThumb, mountDishViewer } from './dish3d';
import { foodCount, foodCountAny, takeFood } from '../food/pantry';
import { FOOD_BY_ID } from '../food/ingredients';
import { cookFirstOf, loadCookFirsts, onCookFirsts, reportCookDone } from '../meta/cookBroadcast';

export type CookDeps = {
  getSave: () => { cookDex?: Record<string, number>; cookDish?: Record<string, number> };
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
  /** 起鍋音效（big＝隱藏款／新稱號）；靜音由音效系統處理 */
  sfx?: (big: boolean) => void;
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
  document.querySelectorAll<HTMLButtonElement>('#dexTabs button').forEach(b => b.onclick = () => dexTab(b.dataset.t === 'cook' ? 'cook' : 'pearl'));
}

/* ───────── 煎台 ───────── */

type Sel = { top: number; batter: number; egg: number; done: number; sauce: number };
let seat: number | null = null;
/** 主選單的自家煎台：不連伺服器、不能展示 */
let solo = false;
let step = 1;
let sel: Sel = { top: 0, batter: -1, egg: -1, done: -1, sauce: -1 };
let target: Combo | null = null;
let stopView: (() => void) | null = null;
let lastViewId = -2;
let viewCv: HTMLCanvasElement | null = null;
let lastViewKey = '';
let lastViewUnder: boolean | null = null;
let pourT0 = 0, pourRaf = 0, pourFrac = 0;
let cookT0 = 0, cookRaf = 0, flipped = false, doneFrac = 0;
/** 從「醬」回到「煎」：熟度條停在上次的位置，可沿用或重新煎 */
let reviewDone = false;
let resultId = -1;
let resultNew = false;
let resultKept = true;
/** 剛按「完成」：下一次畫面要播起鍋特效 */
let fx: { big: boolean; banner: string; sub: string } | null = null;
const POUR_MS = 2400, COOK_MS = 7000;
const DONE_EDGE = [0.38, 0.72];
const doneOf = (f: number) => (f < DONE_EDGE[0] ? 0 : f < DONE_EDGE[1] ? 1 : 2);
const batterOf = (f: number) => (f < 0.34 ? 1 : f < 0.67 ? 2 : 3);

const curCombo = (): Combo => ({ top: sel.top, batter: Math.max(0, sel.batter), egg: Math.max(0, sel.egg), done: Math.max(0, sel.done), sauce: Math.max(0, sel.sauce) });

export function cookOpenSeat() { return seat; }
export function cookPanelOpen() { return $('cook').classList.contains('show'); }

/** 站上位子、伺服器佔位成功後打開 */
export function openCook(s: number, preset?: number) {
  seat = s; solo = false;
  $('cook').classList.remove('solo');
  resetSel(preset);
  $('cook').classList.add('show');
  if (document.pointerLockElement) document.exitPointerLock();
  render();
}

function resetSel(preset?: number) {
  step = 1; flipped = false; doneFrac = 0; pourFrac = 0; resultId = -1; reviewDone = false; pourT0 = 0;
  cancelAnimationFrame(pourRaf); cancelAnimationFrame(cookRaf);
  target = preset != null && preset >= 0 ? comboOf(preset) : null;
  sel = { top: 0, batter: -1, egg: -1, done: -1, sauce: -1 };
  if (target) {
    for (const t of TOPS) if (target.top & t.bit && foodCountAny(t.food) > 0) sel.top |= t.bit;
  }
  sync(0);
}

/** 主選單「煎蚵仔煎」：自家煎台，一樣扣食材、記圖鑑，但不展示也不連伺服器 */
export function openCookSolo() {
  seat = null; solo = true;
  resetSel();
  $('cook').classList.add('show', 'solo');
  ($('cookClose') as HTMLButtonElement).textContent = '回主選單';
  if (document.pointerLockElement) document.exitPointerLock();
  render();
}

/** 關閉：放掉位子 */
export function closeCook(leave = true) {
  cancelAnimationFrame(pourRaf); cancelAnimationFrame(cookRaf);
  stopView?.(); stopView = null; lastViewId = -2; viewCv = null; lastViewKey = ''; lastViewUnder = null;
  $('cook').classList.remove('show');
  if (leave && seat != null && !solo) { seat = null; D.leaveSeat(); }
  seat = null;
  if (solo) { solo = false; $('cook').classList.remove('solo'); ($('cookClose') as HTMLButtonElement).textContent = '離開煎台'; }
}

function sync(stage: number) {
  const id = stage >= 1 ? comboId(curCombo()) : -1;
  if (solo) return;
  D.progress(stage, id);
  D.myPan(stage >= 1 ? id : -1);
}

/** 起鍋特效：光圈、金色光暈、火花、蒸氣；隱藏款／新稱號再加橫幅和更多火花 */
function fxHtml(f: { big: boolean; banner: string; sub: string }) {
  const n = f.big ? 22 : 12;
  let sp = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360 + (i * 37) % 23, d = (f.big ? 38 : 30) + ((i * 53) % 17);
    sp += `<i class="ckSpk" style="--a:${a.toFixed(0)}deg;--d:${d};--dl:${((i * 41) % 9) * 22}ms"></i>`;
  }
  return `<div class="ckFx" aria-hidden="true"><b class="ckRing"></b>${f.big ? '<b class="ckRing r2"></b>' : ''}<b class="ckGlow"></b>${sp}<i class="ckSteam s1"></i><i class="ckSteam s2"></i><i class="ckSteam s3"></i></div>`
    + (f.banner ? `<div class="ckBanner"><b>${esc(f.banner)}</b>${f.sub ? `<small>${esc(f.sub)}</small>` : ''}</div>` : '');
}

/** 預覽：煎的過程固定角度不轉，翻面後看底面，加醬時翻回正面；做好才慢慢轉 */
function mountView(id: number) {
  const cv = document.getElementById('ckView') as HTMLCanvasElement | null;
  if (!cv) return;
  const under = step === 4 && flipped; // 翻面後（含從醬回上一步）看底面
  const spin = step === 6;
  const key = `${id}|${under ? 1 : 0}|${spin ? 1 : 0}`;
  // 每次 render 都換新 canvas：同一盤也要掛到新 canvas 上（舊寫法會留下空白預覽）
  if (key === lastViewKey && stopView && viewCv === cv) return;
  const flipIn = lastViewUnder != null && lastViewUnder !== under && step >= 4 && step <= 5;
  stopView?.(); lastViewId = id; lastViewKey = key; lastViewUnder = under; viewCv = cv;
  // 剛起鍋：先彈一下、放完特效再開始慢慢轉
  const pop = !!cv.closest('.ckViewW.fx');
  stopView = mountDishViewer(cv, id, undefined, { spin, under, flipIn, spinAfter: pop ? 1300 : 0 });
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
  const canBack = step >= 2 && step <= 5;
  const head = `<div class="ckHead"><button type="button" class="ckLink ckBack" data-ck="back"${canBack ? '' : ' disabled aria-hidden="true" tabindex="-1"'}>${IC.back}上一步</button><b>${solo ? '自家煎台' : `煎台 ${seat != null ? seat + 1 : ''} 號`}</b><button type="button" class="ckLink" data-ck="dex">${IC.dex}圖鑑</button><button type="button" class="ckLink ckX" data-ck="close" aria-label="${solo ? '回主選單' : '離開煎台'}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  let html = '';
  const fxNow = step === 6 ? fx : null; fx = null;
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
      + (sel.batter >= 0 ? `<p class="ckPrev"><span>上次：${BATTERS[sel.batter]}</span><button type="button" class="ckLink" data-ck="keepbatter">沿用</button></p>` : '')
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
      + (reviewDone
        ? `<p class="ckPrev"><span>上次：${DONES[Math.max(0, sel.done)]}</span></p><div class="ckAct"><button type="button" class="ckBtn" data-ck="recook">重新煎</button><button type="button" class="ckBtn pri" data-ck="keepdone">沿用${DONES[Math.max(0, sel.done)]}</button></div>`
        : `<div class="ckAct"><button type="button" class="ckBtn" data-ck="flip"${flipped ? ' disabled' : ''}>${flipped ? '已翻面' : '翻面'}</button><button type="button" class="ckBtn pri" data-ck="scoop"${flipped ? '' : ' disabled'}>鏟起</button></div>`);
  } else if (step === 5) {
    html += `<h3 class="ckH">淋什麼醬？選好按「完成」</h3><div class="ckChips">${SAUCES.map((s, i) => { const n = i ? foodCount(s.id) : null; return chip(s.n, sel.sauce === i, n, `data-sauce="${i}"`, i > 0 && n === 0); }).join('')}</div>`
      + (SAUCES.slice(1).some(s => foodCount(s.id) === 0) ? `<p class="ckHint">${IC.info}醬料在廣場食材攤買；阿婆祕傳醬要用殼丟中阿婆才有機會拿到</p>` : '')
      + targetTip(SAUCES[target?.sauce ?? 0].n)
      + `<div class="ckAct"><button type="button" class="ckBtn pri" data-ck="finish"${sel.sauce < 0 ? ' disabled' : ''}>完成</button></div>`;
  } else {
    const id = resultId, sp = specialOf(id), isNew = resultNew;
    html += `<div class="ckResult"><div class="ckName">${esc(comboName(id))}${sp ? '<span class="ckTag">隱藏款</span>' : ''}${isNew ? '<span class="ckTag new">新收集</span>' : ''}</div>`
      + (sp ? `<p class="ckDesc">${esc(sp.desc)}</p>` : '')
      + `<ul class="ckFeat">${comboFeatures(id).map(f => `<li>${f}</li>`).join('')}</ul>`
      + `<p class="ckSum">圖鑑 ${dexCount()}／${COMBO_TOTAL.toLocaleString()}${cookTitle(dexCount()) ? `・${cookTitle(dexCount())}` : ''}</p></div>`
      + (resultKept ? `<p class="ckHint">${IC.info}這盤收好了（同款共 ${D.getSave().cookDish?.[String(id)] ?? 1} 盤），可以在廣場走到阿婆旁邊「請阿婆吃」</p>`
        : `<p class="ckHint">${IC.info}這盤什麼都沒放，沒辦法收起來請阿婆吃。加點配料、粉漿、蛋或醬再煎一盤吧</p>`)
      + (solo ? '' : `<div class="ckAsk" id="ckAsk"><b>要展示嗎？</b><span>會放在煎台旁，大家都看得到；每人一盤，離開廣場就收掉</span><div class="ckAct"><button type="button" class="ckBtn" data-ck="nodisp">不用</button><button type="button" class="ckBtn pri" data-ck="disp">展示</button></div></div>`)
      + `<div class="ckAct"><button type="button" class="ckBtn" data-ck="again">再煎一盤</button></div>`;
  }
  // 全螢幕：標題列＋步驟固定在上、預覽撐滿中間、操作區固定在下
  body.innerHTML = head + stepsBar() + `<div class="ckViewW${fxNow ? ' fx' + (fxNow.big ? ' big' : '') : ''}"><canvas id="ckView" width="256" height="256"></canvas>${fxNow ? fxHtml(fxNow) : ''}</div><div class="ckCtl s${step}${fxNow ? ' fx' : ''}">${html}</div>`;
  mountView(step === 6 ? resultId : step === 1 && !sel.top ? comboId({ top: 0, batter: 0, egg: 0, done: 0, sauce: 0 }) : comboId(curCombo()));
  bind(body);
}

function bind(body: HTMLElement) {
  body.querySelectorAll<HTMLButtonElement>('[data-top]').forEach(b => b.onclick = () => { sel.top ^= Number(b.dataset.top); render(); });
  body.querySelectorAll<HTMLButtonElement>('[data-egg]').forEach(b => b.onclick = () => { sel.egg = Number(b.dataset.egg); step = 4; sync(3); startCook(); });
  body.querySelectorAll<HTMLButtonElement>('[data-sauce]').forEach(b => b.onclick = () => { sel.sauce = Number(b.dataset.sauce); sync(4); render(); }); // 只選，不馬上完成：可以換
  body.querySelectorAll<HTMLButtonElement>('[data-ck]').forEach(b => b.onclick = () => {
    const k = b.dataset.ck;
    if (k === 'dex') openDex(target ? comboId(target) : undefined);
    else if (k === 'back') goBack();
    else if (k === 'finish') { if (step === 5 && sel.sauce >= 0) finish(); }
    else if (k === 'close') ($('cookClose') as HTMLButtonElement).click();
    else if (k === 'keepbatter') { if (sel.batter > 0 && !foodCount('flour')) sel.batter = 0; step = 3; sync(2); render(); }
    else if (k === 'keepdone') { reviewDone = false; step = 5; sync(4); render(); }
    else if (k === 'recook') startCook();
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

/** 上一步：回到前一步，保留那一步原本的選擇；計時中的步驟會停下重來 */
function goBack() {
  if (step < 2 || step > 5) return;
  cancelAnimationFrame(pourRaf); pourT0 = 0;
  if (step === 4) { cancelAnimationFrame(cookRaf); doneFrac = 0; flipped = false; sel.done = -1; reviewDone = false; }
  if (step === 5) { reviewDone = sel.done >= 0; flipped = true; }
  step -= 1;
  sync(step - 1);
  render();
}

function startCook() {
  cancelAnimationFrame(cookRaf);
  cookT0 = performance.now(); flipped = false; doneFrac = 0; reviewDone = false;
  render();
  let lastBand = -1;
  const tick = () => {
    doneFrac = Math.min(1, (performance.now() - cookT0) / COOK_MS);
    const f = document.getElementById('ckDone'); if (f) f.style.width = `${doneFrac * 100}%`;
    const band = doneOf(doneFrac);
    if (band !== lastBand) { lastBand = band; sel.done = band; mountView(comboId(curCombo())); if (!solo) D.myPan(comboId(curCombo())); }
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
  if (isNew) dex()[String(id)] = Date.now();
  // 煎好的這盤留著（可以請阿婆吃）；自家煎台也算。什麼都沒放（沒扣到任何食材）的空氣煎不留盤
  resultKept = comboHasFood(id);
  if (resultKept) { const st = (D.getSave().cookDish ??= {}); st[String(id)] = Math.min(99_999, (st[String(id)] ?? 0) + 1); }
  // 問伺服器是不是全服首創（是的話全服廣播）；空氣煎不算
  void reportCookDone(id);
  D.persist();
  resultNew = isNew;
  resultId = id; step = 6;
  sync(6);
  D.track('cook', { item: 'cook-' + id, combo: id, kind: isNew ? 'new' : 'repeat', count: dexCount() });
  const after = dexCount();
  const m = COOK_TITLES.find(x => before < x.n && after >= x.n);
  const sp = specialOf(id) && isNew;
  fx = m ? { big: true, banner: `獲得稱號：${m.t}`, sub: `圖鑑收集 ${m.n} 種${sp ? '・發現隱藏款' : ''}` }
    : sp ? { big: true, banner: '隱藏款！', sub: comboName(id) }
    : { big: false, banner: '', sub: '' };
  try { D.sfx?.(fx.big); } catch { /* 音效失敗不影響 */ }
  try { navigator.vibrate?.(fx.big ? [30, 50, 30] : 30); } catch { /* 不支援 */ }
  render();
}

async function doDisplay(b: HTMLButtonElement) {
  b.disabled = true;
  const ok = await D.display(resultId);
  const ask = document.getElementById('ckAsk');
  if (ok) { if (ask) ask.innerHTML = '<b>已展示在煎台旁</b><span>新展示會取代舊的那盤</span>'; }
  else { b.disabled = false; D.toast('展示失敗，再試一次', '#ffb08a'); }
}

/* ───────── 圖鑑（平鋪：一格一種，共 2,304 格，依編號排；只畫看得到的幾列） ───────── */

type DexFilter = 'all' | 'got' | 'un' | 'hid';
let dexLevel: 'list' | 'detail' = 'list';
let dexId = -1;
let dexFilter: DexFilter = 'all';
let fq = '';
let dexIds: number[] = [];
let dexScroll = 0;
let stopDexView: (() => void) | null = null;
let virtRaf = 0;
let thumbRaf = 0;
const thumbQ: { id: number; el: HTMLElement }[] = [];
/** 從展示盤打開：顯示主人名字 */
let dexOwner = '';

export function openDex(id?: number, owner = '') {
  dexOwner = owner;
  if (id != null && id >= 0) { dexId = id; dexLevel = 'detail'; }
  else dexLevel = 'list';
  $('dex').classList.add('show');
  dexTab('cook');
}

/** 圖鑑分頁：珍珠和奇物（原本的）／蚵仔煎 */
export function dexTab(t: 'pearl' | 'cook') {
  document.querySelectorAll<HTMLButtonElement>('#dexTabs button').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  ($('dexList') as HTMLElement).hidden = t !== 'pearl';
  ($('cookDexBody') as HTMLElement).hidden = t !== 'cook';
  if (t === 'cook') { renderDex(); void loadCookFirsts(); }
  else { stopDexView?.(); stopDexView = null; cancelAnimationFrame(virtRaf); cancelAnimationFrame(thumbRaf); thumbQ.length = 0; }
}
export function closeDex() {
  stopDexView?.(); stopDexView = null;
  cancelAnimationFrame(virtRaf); cancelAnimationFrame(thumbRaf); thumbQ.length = 0;
  $('dex').classList.remove('show');
}
// 首創名單更新：圖鑑開著就重畫看得到的格子／詳細頁
onCookFirsts(() => {
  if (!dexOpen()) return;
  if (dexLevel === 'detail') { renderDex(); return; }
  const R = document.getElementById('dxRows'); if (R) { R.dataset.k = ''; drawRows(); }
});
export function dexOpen() { return $('dex').classList.contains('show') && !($('cookDexBody') as HTMLElement).hidden; }

const SIL = `<span class="dxSil">${IC.dish}</span>`;
const SIL_Q = `<span class="dxSil q">${IC.dish}<b>？</b></span>`;
const no = (id: number) => `No.${String(id + 1).padStart(4, '0')}`;

function dexHead() {
  const n = dexCount(), t = cookTitle(n), next = COOK_TITLES.find(m => m.n > n);
  return `<div class="dxTotal"><div><b>已收集 ${n.toLocaleString()}／${COMBO_TOTAL.toLocaleString()}</b>${t ? `<span class="dxTitle">${t}</span>` : ''}</div><div class="dxBar"><i style="width:${(n / COMBO_TOTAL) * 100}%"></i></div>${next ? `<small>再收集 ${next.n - n} 種可得稱號「${next.t}」</small>` : '<small>所有稱號都拿到了</small>'}</div>`;
}
function filtersHtml() {
  const F: [DexFilter, string][] = [['all', '全部'], ['got', '已收集'], ['un', '未收集'], ['hid', '隱藏款']];
  return `<div class="dxFilt"><label class="dxSearch">${IC.search}<input id="dxQ" type="search" placeholder="搜尋已收集的名稱或編號" value="${esc(fq)}"></label><div class="dxTog">${F.map(([k, l]) => `<button type="button" class="ckChip sm${dexFilter === k ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div></div>`;
}

function computeIds() {
  const q = fq.trim();
  const qNo = /^(no\.?)?\s*0*(\d{1,4})$/i.exec(q);
  const out: number[] = [];
  const pool = dexFilter === 'hid' ? SPECIAL_IDS : null;
  const N = pool ? pool.length : COMBO_TOTAL;
  for (let k = 0; k < N; k++) {
    const id = pool ? pool[k] : k;
    const got = has(id);
    if (dexFilter === 'got' && !got) continue;
    if (dexFilter === 'un' && got) continue;
    if (q) {
      if (qNo) { if (id + 1 !== Number(qNo[2])) continue; }
      else if (!got || !comboName(id).includes(q)) continue; // 名稱只搜已收集的
    }
    out.push(id);
  }
  dexIds = out;
}

function cellHtml(id: number) {
  const got = has(id), sp = !!specialOf(id);
  if (got) { const f = cookFirstOf(id); return `<button type="button" class="dxCell" data-id="${id}"><span class="dxTh" data-th="${id}">${SIL}</span><span class="dxNm">${esc(comboName(id))}</span>${sp ? '<i class="dxSp">隱藏款</i>' : ''}${f ? `<i class="dxFirst" title="全服首創：${esc(f.nick)}">首創 ${esc(f.nick)}</i>` : ''}</button>`; }
  return `<button type="button" class="dxCell un" data-id="${id}">${sp ? SIL_Q : SIL}<span class="dxNm"><small>${no(id)}</small>？？？</span></button>`;
}

function cols() {
  const w = document.getElementById('dxVirt')?.clientWidth ?? 300;
  return w >= 560 ? 5 : w >= 420 ? 4 : 3;
}

function renderDex() {
  stopDexView?.(); stopDexView = null;
  cancelAnimationFrame(virtRaf); cancelAnimationFrame(thumbRaf); thumbQ.length = 0;
  const B = $('cookDexBody');
  if (dexLevel === 'list') {
    computeIds();
    B.innerHTML = dexHead() + filtersHtml()
      + (dexIds.length ? `<div id="dxVirt" class="dxVirt"><div id="dxSpace" class="dxSpace"><div id="dxRows" class="dxRows"></div></div></div>` : '<p class="dxEmpty">沒有符合的蚵仔煎</p>');
    bindDexList(B);
    const V = document.getElementById('dxVirt');
    if (V) {
      V.scrollTop = dexScroll;
      V.onscroll = () => { dexScroll = V.scrollTop; cancelAnimationFrame(virtRaf); virtRaf = requestAnimationFrame(drawRows); };
      drawRows();
    }
    return;
  }
  const id = dexId, got = has(id), sp = specialOf(id), hid = !!sp && !got;
  B.innerHTML = `<div class="dxNav"><button type="button" class="ckLink" data-nav="list">${IC.back}圖鑑</button><small>${no(id)}</small></div>`
    + `<div class="ckViewW big${got ? '' : ' un'}"><canvas id="dxView" width="256" height="256"></canvas>${got ? '' : '<span class="dxLock">還沒煎過</span>'}</div>`
    + `<div class="ckName">${hid ? '？？？' : esc(comboName(id))}${sp ? '<span class="ckTag">隱藏款</span>' : ''}</div>`
    + (dexOwner ? `<p class="ckDesc">${esc(dexOwner)} 展示的作品</p>` : '')
    + (sp && got ? `<p class="ckDesc">${esc(sp.desc)}</p>` : '')
    + `<ul class="ckFeat">${hid ? '<li>條件保密，煎出來才知道</li>' : comboFeatures(id).map(f => `<li>${f}</li>`).join('')}</ul>`
    + `<p class="ckSum">${got ? `第一次煎出：${fmtDate(dex()[String(id)])}` : '還沒收集'}</p>`
    + (hid ? '' : (() => { const f = cookFirstOf(id); return f ? `<p class="ckFirst">${IC.info}全服首創：${esc(f.nick)}${f.tag ? `<small>#${esc(f.tag)}</small>` : ''}${f.ts ? `・${fmtDate(f.ts)}` : ''}</p>` : ''; })())
    + `<div class="ckAct"><button type="button" class="ckBtn pri" data-ck="follow"${hid ? ' disabled' : ''}>照這樣煎</button></div>`
    + (seat == null && !solo ? '<p class="ckHint">' + IC.info + '主選單按「煎蚵仔煎」，或到廣場中央、第 5 桌的煎台站上位子後可以用</p>' : '');
  B.scrollTop = 0;
  B.querySelector<HTMLButtonElement>('[data-nav]')!.onclick = () => { dexLevel = 'list'; dexOwner = ''; renderDex(); };
  B.querySelector<HTMLButtonElement>('[data-ck="follow"]')?.addEventListener('click', () => {
    if (seat == null && !solo) { D.toast('主選單按「煎蚵仔煎」或到廣場中央、第 5 桌的煎台站上位子，再按「照這樣煎」', '#ffd76a'); return; }
    closeDex(); resetSel(dexId); render();
  });
  const cv = document.getElementById('dxView') as HTMLCanvasElement | null;
  if (cv && !hid) stopDexView = mountDishViewer(cv, id);
}

/** 只畫看得到的列（上下各多留 2 列） */
function drawRows() {
  const V = document.getElementById('dxVirt'), S = document.getElementById('dxSpace'), R = document.getElementById('dxRows');
  if (!V || !S || !R) return;
  const c = cols(), gap = 6;
  const cw = (V.clientWidth - gap * (c - 1)) / c;
  const rowH = Math.round(cw + 40 + gap);
  const rows = Math.ceil(dexIds.length / c);
  S.style.height = `${rows * rowH}px`;
  const r0 = Math.max(0, Math.floor(V.scrollTop / rowH) - 2);
  const r1 = Math.min(rows, Math.ceil((V.scrollTop + V.clientHeight) / rowH) + 2);
  const key = `${c}:${r0}:${r1}:${dexIds.length}`;
  if (R.dataset.k === key) return;
  R.dataset.k = key;
  R.style.transform = `translateY(${r0 * rowH}px)`;
  R.style.gridTemplateColumns = `repeat(${c}, minmax(0, 1fr))`;
  R.style.setProperty('--rowh', `${rowH - gap}px`);
  R.innerHTML = dexIds.slice(r0 * c, r1 * c).map(cellHtml).join('');
  // 縮圖：可見格子逐格補（一幀一張，避免卡）
  thumbQ.length = 0;
  R.querySelectorAll<HTMLElement>('[data-th]').forEach(el => thumbQ.push({ id: Number(el.dataset.th), el }));
  cancelAnimationFrame(thumbRaf);
  const pump = () => {
    const t0 = performance.now();
    while (thumbQ.length && performance.now() - t0 < 8) {
      const { id, el } = thumbQ.shift()!;
      if (!el.isConnected) continue;
      const u = dishThumb(id);
      if (u) el.innerHTML = `<img src="${u}" alt="" draggable="false">`;
    }
    if (thumbQ.length) thumbRaf = requestAnimationFrame(pump);
  };
  thumbRaf = requestAnimationFrame(pump);
}

function bindDexList(B: HTMLElement) {
  B.querySelectorAll<HTMLButtonElement>('[data-f]').forEach(b => b.onclick = () => { dexFilter = b.dataset.f as DexFilter; dexScroll = 0; renderDex(); });
  const R = document.getElementById('dxRows');
  R?.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (!b) return;
    dexId = Number(b.dataset.id); dexOwner = ''; dexLevel = 'detail'; renderDex();
  });
  const q = document.getElementById('dxQ') as HTMLInputElement | null;
  if (q) {
    let t = 0;
    q.oninput = () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        fq = q.value; dexScroll = 0; renderDex();
        const n = document.getElementById('dxQ') as HTMLInputElement | null;
        if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
      }, 250);
    };
  }
  window.addEventListener('resize', onDexResize);
}
function onDexResize() {
  if (!dexOpen() || dexLevel !== 'list') { window.removeEventListener('resize', onDexResize); return; }
  const R = document.getElementById('dxRows'); if (R) R.dataset.k = '';
  drawRows();
}
