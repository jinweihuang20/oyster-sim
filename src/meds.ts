export type MedKey = 'green' | 'speed' | 'slip' | 'dmg' | 'regen' | 'grudge';
export type Med = { id: string; n: string; emo: string; price: number; dur: number; m?: Partial<Record<MedKey, number>>; luck?: number; heal?: number; good: string; bad: string };

export type MedsDeps = {
  $: (id: string) => HTMLElement;
  toast: (t: string, c?: string) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  persist: () => void;
  getSave: () => { meds: Record<string, number>; money: number };
  getState: () => string;
  isTut: () => boolean;
  hasEvRun: () => boolean;
  getNpcs: () => any[];
  grudgeUI: (n: any) => void;
  say: (n: any, t: string, dur?: number) => void;
  getHp: () => number;
  setHp: (v: number) => void;
  updHud: () => void;
  getAc: () => AudioContext | null;
  SFX: { pop: () => void; jingle: (up?: boolean) => void };
  getItems: () => { id: string; n: string; good: string }[];
  getMoonMax: () => number;
  getMoonUsed: () => number;
  moonStart: () => void;
  isPlazaMode: () => boolean;
  getSaltNext: () => boolean;
  setSaltNext: (v: boolean) => void;
  px: (id: string, price: number) => number;
  pxCd: (id: string) => string;
  pxHtml: (id: string, price: number) => string;
  payFor: (id: string, price: number, name: string) => Promise<number | null>;
  renderShop: () => void;
};

let D: MedsDeps;
export function initMeds(deps: MedsDeps) { D = deps; }

export const MEDS: Med[] = [
  { id: 'tonic', n: '阿伯提神補酒', emo: '🍾', price: 40, dur: 60, m: { green: 1.25, slip: 1.5 }, good: '綠區 +25%', bad: '手會抖，割手率 +50%' },
  { id: 'oil', n: '綠色風油精', emo: '🧴', price: 30, dur: 60, m: { speed: 0.75 }, luck: -1, good: '指針速度 -25%（比較穩）', bad: '薰到眼睛，幸運 -1' },
  { id: 'patch', n: '痠痛貼布', emo: '🩹', price: 25, dur: 90, m: { dmg: 0.5, regen: 3, speed: 1.1 }, good: '受到的傷害減半、手痛恢復 3 倍', bad: '手腕貼太緊，指針速度 +10%' },
  { id: 'soup', n: '轉運雞精', emo: '🍵', price: 80, dur: 60, m: { green: 0.85 }, luck: 2, good: '幸運 +2（比較容易開到珍珠奇物）', bad: '補過頭有點暈，綠區 -15%' },
  { id: 'okb', n: 'OK繃', emo: '🩹', price: 15, dur: 0, heal: 25, good: '立刻補 25 點手的體力', bad: '只是包起來，沒有持續效果' },
  { id: 'sweet', n: '古早味糖果', emo: '🍬', price: 35, dur: 0, good: '送給最生氣的阿婆，她的怒氣立刻 -40', bad: '只有一位阿婆有份' },
  { id: 'salt', n: '粗鹽', emo: '🧂', price: 25, dur: 0, good: '下一顆蚵仔一定是易或普通', bad: '只對下一顆有效' },
  { id: 'candy', n: '潤喉糖', emo: '🍬', price: 20, dur: 90, m: { grudge: 0.5, regen: 0.5 }, good: '跟阿婆有說有笑，怒氣增加減半', bad: '只顧講話，手痛恢復變慢一半' },
];
export const medT: Record<string, number> = {};
const medOn = () => MEDS.filter(m => (medT[m.id] ?? 0) > 0);
export function medM(k: MedKey) { let v = 1; for (const m of medOn()) v *= m.m?.[k] ?? 1; return v; }
export function medA(_k: 'luck') { let v = 0; for (const m of medOn()) v += m.luck ?? 0; return v; }
let medDrawT = 0;

export function tickMeds(dt: number) {
  let ch = false;
  for (const k in medT) {
    const was = medT[k] > 0;
    medT[k] = Math.max(0, medT[k] - dt);
    if (was && medT[k] <= 0) { ch = true; const m = MEDS.find(x => x.id === k); if (m) D.toast(`${m.emo}${m.n} 效果結束了`, '#cfc3ff'); }
  }
  medDrawT -= dt;
  if (ch || medDrawT <= 0) { medDrawT = 1; drawMeds(); }
}

export function drawMeds() {
  const save = D.getSave();
  const el = document.getElementById('medAct');
  if (el) el.innerHTML = medOn().map(m => `<span>${m.emo}${Math.ceil(medT[m.id])}s</span>`).join('') + (D.getSaltNext() ? '<span>🧂下一粒</span>' : '');
  const n = MEDS.reduce((a, m) => a + (save.meds[m.id] ?? 0), 0) + D.getItems().reduce((a, m) => a + (save.meds[m.id] ?? 0), 0);
  const b = document.getElementById('medBtn');
  if (b) { b.innerHTML = (n ? `<i class="ic ic-pill"></i> 藥品/道具 ×${n}` : '<i class="ic ic-pill"></i> 藥品/道具') + '<span class="key"> (M)</span>' + (n ? '' : '<small>去雜貨店買</small>'); b.classList.toggle('empty', !n); }
  const L = document.getElementById('medList'); if (L && L.classList.contains('show')) renderMedList();
}

export function useMed(id: string) {
  const save = D.getSave();
  const m = MEDS.find(x => x.id === id); if (!m || D.getState() !== 'play' || D.isTut() || !(save.meds[id] > 0)) return;
  let who = '';
  if (id === 'sweet' && D.hasEvRun()) { D.toast('活動中的阿婆都殺紅眼了，糖果沒有用', '#ff9a8a'); return; }
  if (id === 'sweet') {
    const npcs = D.getNpcs();
    const t = npcs.reduce((a, b) => ((b.grudge ?? 0) > (a.grudge ?? 0) ? b : a));
    if ((t.grudge ?? 0) < 1) { D.toast('阿婆們現在都不生氣，糖果先留著', '#cfc3ff'); return; }
    t.grudge = Math.max(0, (t.grudge ?? 0) - 40); t.calm = Math.max(t.calm ?? 0, 3); D.grudgeUI(t); D.say(t, '哎唷，古早味！好啦不跟你計較', 2.6); who = `（給${t.name}）`;
  }
  if (id === 'salt') { if (D.getSaltNext()) { D.toast('粗鹽已經用了，等下一顆', '#cfc3ff'); return; } D.setSaltNext(true); }
  save.meds[id]--; D.persist();
  if (m.heal) { D.setHp(Math.min(100, D.getHp() + m.heal)); D.updHud(); }
  if (m.dur) medT[id] = (medT[id] ?? 0) + m.dur;
  D.track('use', { item: id });
  D.toast(`${m.emo}使用${m.n}${who}：${m.good}；${m.bad}${m.dur ? `（${m.dur} 秒）` : ''}`, '#cfc3ff');
  if (D.getAc()) D.SFX.pop();
  drawMeds();
}

export function renderMedList() {
  const $ = D.$, save = D.getSave(), plazaMode = D.isPlazaMode();
  const L = $('medList'); const own = MEDS.filter(m => (save.meds[m.id] ?? 0) > 0);
  const ownI = D.getItems().filter(m => (save.meds[m.id] ?? 0) > 0);
  const itemHint = plazaMode ? '廣場不能用飛彈鐵拳' : `這一工剩 ${Math.max(0, D.getMoonMax() - D.getMoonUsed())} 次`;
  L.innerHTML = '<div class="mlH"><b>藥品</b><button class="mlX" aria-label="關閉">✕</button></div>' + (own.length ? own.map((m, i) => `<button data-use="${m.id}"><span class="mlN"><span class="nm"><span class="key">${i + 1}. </span>${m.emo} ${m.n}</span><b class="ct">×${save.meds[m.id]}</b></span><small>${m.good}／${m.bad}${m.dur ? `・${m.dur} 秒` : '・立即'}${medT[m.id] > 0 ? `（剩 ${Math.ceil(medT[m.id])}s，再用會延長）` : ''}</small></button>`).join('') : '<p>身上沒有藥品，去雜貨店的「藥品」買吧</p>') + '<div class="mlH"><b>道具</b></div>' + (ownI.length ? ownI.map(m => `<button data-item="${m.id}"${plazaMode ? ' disabled' : ''}><span class="mlN"><i class="ic ic-moon"></i><span class="nm">${m.n}</span><b class="ct">×${save.meds[m.id]}</b></span><small>${plazaMode ? itemHint : `${m.good}（${itemHint}）`}</small></button>`).join('') : '<p>身上沒有道具，去雜貨店的「道具」買吧</p>');
  L.querySelector('.mlX')?.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); L.classList.remove('show'); });
  L.querySelectorAll('button[data-item]').forEach(b => b.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); if (plazaMode) { D.toast('廣場不能用飛彈鐵拳', '#ffb08a'); return; } D.moonStart(); }));
  L.querySelectorAll('button[data-use]').forEach(b => b.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); useMed(b.getAttribute('data-use')!); renderMedList(); }));
}

export function initMedsUi() {
  const b = D.$('medBtn'), L = D.$('medList');
  b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); L.classList.toggle('show'); if (L.classList.contains('show')) renderMedList(); });
  L.addEventListener('pointerdown', e => e.stopPropagation());
  window.addEventListener('pointerdown', e => { if (!(e.target as HTMLElement).closest?.('#medList,#medBtn')) L.classList.remove('show'); });
  drawMeds();
}

export function renderMedShop() {
  const $ = D.$, save = D.getSave();
  $('shopList').insertAdjacentHTML('beforeend', `<h3><i class="ic ic-pill"></i> 藥品</h3><p style="font-size:12px;opacity:.8">消耗品：上工時按「藥品/道具」使用，效果持續幾秒，同一種再用會延長時間；收工後效果消失，沒用完的會留著。</p><table class="kt"><tr><th>藥品</th><th>好處</th><th>代價</th><th>時間</th><th>持有</th><th></th></tr>` + MEDS.map(m => `<tr><td><b>${m.emo} ${m.n}</b>${D.pxCd('med-' + m.id)}</td><td style="color:#9be37a">${m.good}</td><td style="color:#ff8a7a">${m.bad}</td><td>${m.dur ? `${m.dur}s` : '立即'}</td><td>${save.meds[m.id] ?? 0}</td><td><button data-mbuy="${m.id}" ${save.money < D.px('med-' + m.id, m.price) ? 'disabled' : ''}>${D.pxHtml('med-' + m.id, m.price)}</button></td></tr>`).join('') + '</table>');
  $('shopList').querySelectorAll('button[data-mbuy]').forEach(b => (b as HTMLButtonElement).onclick = async () => {
    const m = MEDS.find(x => x.id === b.getAttribute('data-mbuy'))!;
    const pr = await D.payFor('med-' + m.id, m.price, m.n); if (pr == null) return;
    save.money -= pr; save.meds[m.id] = (save.meds[m.id] ?? 0) + 1; D.persist(); D.track('buy', { item: 'med-' + m.id, price: pr }); if (D.getAc()) D.SFX.jingle(); D.renderShop(); drawMeds();
  });
}
