/** 每日上工簽到／連續天數／回歸禮（從 main.ts 拆出，行為不變） */
import { todayKey, dayDiff, eco, type Save } from '../core';
import { ODD } from '../shop';
import { $ } from '../ui';

export type DailyDeps = {
  getSave: () => Save;
  persist: () => void;
  renderDex: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  giftMsg: (ok: boolean, title: string, lines: string[]) => void;
  menuModalBusy: () => boolean;
  rarOf: (w: number) => string;
  legendSync: () => void;
  legendPick: () => number;
  legendTotal: () => number;
  audio: () => void;
  tone: (freq: number, dur: number, vol: number, type?: OscillatorType, delay?: number, glideTo?: number) => void;
};

let D: DailyDeps;

export function initDaily(deps: DailyDeps) {
  D = deps;
  setInterval(() => {
    const save = D.getSave();
    const t = todayKey(); if (save.bonusDay === t || dailyAutoDay === t) return;
    if (document.body.classList.contains('tutOn') || document.getElementById('hg') || document.getElementById('dailyMsg') || D.menuModalBusy()) return;
    dailyAutoDay = t; openDaily();
  }, 1200);
}

const nextStreak = () => {
  const save = D.getSave();
  const t = todayKey(), l = save.lastBonusDay, n = save.streakDay ?? 0;
  if (!l || n <= 0 || n >= 7 || dayDiff(l, t) !== 1) return 1;
  return n + 1;
};

export const stampRow = (got: number) => `<span class="stamps">${[1, 2, 3, 4, 5, 6, 7].map(i => `<span class="stp${i <= got ? ' on' : ''}${i === 7 ? ' big' : ''}">${i <= got ? '<i class="ic ic-check"></i>' : i === 7 ? '<i class="ic ic-gift"></i>' : i}</span>`).join('')}</span>`;

export function renderDaily() {
  const save = D.getSave();
  const done = save.bonusDay === todayKey();
  document.getElementById('calBtn')?.classList.toggle('due', !done);
  const box = document.getElementById('dailyMsg'); if (!box) return;
  const got = done ? (save.streakDay ?? 1) : nextStreak() - 1, today = done ? got : got + 1;
  box.querySelector('.dcGrid')!.innerHTML = [1, 2, 3, 4, 5, 6, 7].map(i => `<div class="dcCell${i <= got ? ' got' : ''}${i === today && !done ? ' now' : ''}${i === 7 ? ' big' : ''}"><span class="dcD">第 ${i} 天</span><i class="ic ${i <= got ? 'ic-check' : i === 7 ? 'ic-gift' : 'ic-coin'}"></i><b>$${(eco.dailyPays[i - 1] ?? 0).toLocaleString('zh-TW')}</b>${i === 7 ? '<small>另送傳說奇物</small>' : ''}</div>`).join('');
  const btn = box.querySelector<HTMLButtonElement>('.dcGo')!; btn.disabled = done; btn.textContent = done ? '今天領過了' : '領取';
  box.querySelector('.dcNote')!.textContent = done ? `已連續上工 ${got} 天，明天再來` : today === 7 ? '今天是第 7 天大獎！' : `再 ${7 - today} 天拿第 7 天大獎・斷一天會從第 1 天重來`;
}

export function openDaily() {
  if (document.getElementById('dailyMsg')) return;
  const d = document.createElement('div'); d.id = 'dailyMsg'; d.className = 'giftMsg dailyMsg';
  d.innerHTML = '<div class="gmBox dcBox"><button class="gmX" aria-label="關閉">✕</button><div class="dcTitle"><i class="ic ic-cal"></i> 每日上工簽到</div><div class="dcGrid"></div><p class="dcNote"></p><button class="dcGo">領取</button></div>';
  const close = () => d.remove();
  d.querySelector('.gmX')!.addEventListener('click', close);
  d.addEventListener('click', e => { if (e.target === d) close(); });
  d.querySelector('.dcGo')!.addEventListener('click', e => claimDaily(e));
  document.body.appendChild(d); renderDaily();
}

function coinFlyTo(from: DOMRect) {
  const t = document.getElementById('menuMoney')?.getBoundingClientRect(); if (!t) return;
  const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2, x1 = t.left + t.width / 2, y1 = t.top + t.height / 2;
  for (let k = 0; k < 8; k++) {
    const c = document.createElement('i'); c.className = 'ic ic-coin dcCoin'; c.style.left = x0 + 'px'; c.style.top = y0 + 'px'; document.body.appendChild(c);
    const dx = (Math.random() - .5) * 80, dy = (Math.random() - .5) * 50;
    c.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`, opacity: 1, offset: .3 }, { transform: `translate(calc(-50% + ${x1 - x0}px),calc(-50% + ${y1 - y0}px)) scale(.6)`, opacity: .3 }], { duration: 750, delay: k * 50, easing: 'ease-in', fill: 'forwards' }).onfinish = () => c.remove();
  }
  setTimeout(() => { const mm = document.getElementById('menuMoney'); mm?.classList.remove('bump'); void mm?.offsetWidth; mm?.classList.add('bump'); }, 800);
}

let dailyAutoDay = '';

function dailyItem(): string {
  const save = D.getSave();
  D.legendSync(); const i = D.legendPick(); save.odd[i] = (save.odd[i] ?? 0) + 1; save.legendN = D.legendTotal(); return `傳說奇物：${ODD[i].name}`;
}

export function claimDaily(ev?: Event) {
  const save = D.getSave();
  if (save.bonusDay === todayKey()) { renderDaily(); return; }
  const n = nextStreak(), amt = eco.dailyPays[n - 1];
  save.bonusDay = save.lastBonusDay = todayKey(); save.streakDay = n; save.bonusN = (save.bonusN ?? 0) + 1; save.money += amt;
  const item = n === 7 ? dailyItem() : '';
  D.persist(); D.renderDex();
  D.track('daily_bonus', { amount: amt, streak: n, money: save.money });
  try { D.audio(); for (let k = 0; k < 3; k++) D.tone(1200 + k * 250, 0.15, 0.09, 'square', k * 0.07, 1800 + k * 250); } catch { /* 無音訊 */ }
  const r = (document.querySelector('#dailyMsg .dcGo') ?? $('calBtn')).getBoundingClientRect(); coinFlyTo(r);
  const plus = document.createElement('div'); plus.className = 'coinplus'; plus.textContent = `+$${amt}`; plus.style.left = `${r.left + r.width / 2}px`; plus.style.top = `${r.top}px`; document.body.appendChild(plus); setTimeout(() => plus.remove(), 1500);
  ev?.stopPropagation(); renderDaily();
  if (item) D.giftMsg(true, '連續上工 7 天！', [`上工費 +$${amt}`, `阿姨另外送你：${item}`, `身上有 $${save.money}`]);
}

/** 老玩家回歸：離開 7 天以上回來，每 7 天最多領一次 */
export function checkReturn() {
  const save = D.getSave();
  const t = todayKey(), last = save.lastSeen; save.lastSeen = t;
  if (!last) { D.persist(); return; }
  const days = dayDiff(last, t);
  if (days < 7 || (save.retDay && dayDiff(save.retDay, t) < 7)) { D.persist(); return; }
  const big = days >= 30, amt = big ? eco.return30 : eco.return7;
  save.money += amt; save.retDay = t; save.streakDay = 0; save.lastBonusDay = undefined;
  let item: string;
  if (big) { const rs = ODD.map((o, i) => ({ o, i })).filter(x => D.rarOf(x.o.weight) === 'rare'); const p = rs[Math.floor(Math.random() * rs.length)] ?? { o: ODD[0], i: 0 }; save.odd[p.i]++; item = `稀有奇物：${p.o.name}`; }
  else { save.dex[0]++; item = '白珍珠 1 顆'; }
  D.persist(); D.renderDex(); renderDaily();
  D.track('return_bonus', { days, amount: amt });
  D.giftMsg(true, '阿姨好想你！', [`你已經 ${days} 天沒來上工了，歡迎回來！`, `回歸禮 +$${amt}`, item, '連續上工從第 1 天重新開始', `身上有 $${save.money}`]);
}
