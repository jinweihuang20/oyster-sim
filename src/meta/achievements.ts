import * as SocialNS from './social';
import type { EvCfg } from './eventsTypes';

export type AchSave = { got: Record<string, number>; st: Record<string, number>; locs: string[]; seats: string[]; radio: string[]; sets: string[]; fresh: string[]; title: string; pts: number };

export type AchHost = {
  $: (id: string) => HTMLElement;
  persist: () => void;
  toast: (t: string, c?: string) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  esc: (s: string) => string;
  btn: (id: string, f: () => void, up?: () => void) => void;
  Social: typeof SocialNS;
  ODD: readonly { limited?: boolean; weight: number }[];
  LEGEND_ODD: number[];
  setsOn: () => { id: string }[];
  locNow: () => { id: string };
  endDay: () => void;
  get save(): any;
  get state(): string;
  get tut(): any;
  get count(): number;
  get opened(): number;
  get perfects(): number;
  get steals(): number;
  get caught(): number;
  get meatHits(): number;
  get blocks(): number;
  get reflects(): number;
  get shellHits(): number;
  get nightShift(): boolean;
  get achFromRes(): boolean;
  set achFromRes(v: boolean);
};

let H: AchHost;
type AchDef = { id: string; cat: string; n: string; d: string; t: number[]; v: () => number; hint?: string; unit?: string };
const ACH_CATS = [{ id: 'shuck', s: '剝蚵', n: '剝蚵職人', ic: 'ic-knife' }, { id: 'steal', s: '偷蚵', n: '偷蚵高手', ic: 'ic-hand' }, { id: 'war', s: '戰爭', n: '阿婆們的戰爭', ic: 'ic-umb' }, { id: 'travel', s: '跑透透', n: '跑遍蚵寮', ic: 'ic-pin' }, { id: 'collect', s: '收藏', n: '收藏家', ic: 'ic-pearl' }, { id: 'veteran', s: '老蚵仔', n: '老蚵仔', ic: 'ic-flag' }];
export const achS = (): AchSave => (H.save.ach ??= { got: {}, st: {}, locs: [], seats: [], radio: [], sets: [], fresh: [], title: '', pts: 0 });
export const AS = (k: string) => achS().st[k] ?? 0;
// 上工中把這一工的即時數字加進去，剝到就跳成就，不用等收工
const L_ = () => { const L = H.save.life; if (H.state !== 'play' || H.tut) return L; return { ...L, inBowl: L.inBowl + H.count, opened: L.opened + H.opened, perfects: L.perfects + H.perfects, steals: L.steals + H.steals, caught: L.caught + H.caught, meatHits: L.meatHits + H.meatHits, blocks: L.blocks + H.blocks, reflects: L.reflects + H.reflects, shellHits: L.shellHits + H.shellHits }; };
const dexPct = () => { const odd = H.ODD.map((o, i) => [o, i] as const).filter(([o]) => !o.limited); const tot = 4 + odd.length, have = (H.save.dex as number[]).filter((x: number) => x).length + odd.filter(([, i]) => H.save.odd[i]).length; return Math.floor(have / tot * 100); };
export const ACHS: AchDef[] = [
  { id: 'inbowl', cat: 'shuck', n: '蚵仔入碗', d: '累積剝進碗裡的蚵仔', t: [100, 1000, 10000], v: () => L_().inBowl, unit: '顆' },
  { id: 'opened', cat: 'shuck', n: '開殼達人', d: '累積開殼次數', t: [200, 2000, 20000], v: () => L_().opened, unit: '次' },
  { id: 'best', cat: 'shuck', n: '一工爆量', d: '單一工最多入碗顆數', t: [20, 50, 100], v: () => Math.max(H.save.best, H.state === 'play' && !H.tut ? H.count : 0), unit: '顆' },
  { id: 'perfect', cat: 'shuck', n: '俐落刀工', d: '累積完美／俐落開殼', t: [50, 500, 5000], v: () => L_().perfects, unit: '次' },
  { id: 'combo', cat: 'shuck', n: '連擊不斷', d: '最長連擊', t: [10, 25, 50], v: () => L_().bestCombo, unit: '連擊' },
  { id: 'zerowaste', cat: 'shuck', n: '一點不浪費', d: '浪費率 0% 完成一工（至少入碗 5 顆）', t: [1, 10, 50], v: () => AS('zw'), unit: '工' },
  { id: 'nocrack', cat: 'shuck', n: '殼屑零容忍', d: '完全沒有殼屑完成一工（至少入碗 5 顆）', t: [1, 10, 50], v: () => AS('nc'), unit: '工' },
  { id: 'steals', cat: 'steal', n: '偷蚵仔', d: '累積偷到的蚵仔', t: [50, 500, 1000], v: () => L_().steals, unit: '顆' },
  { id: 'clean', cat: 'steal', n: '神不知鬼不覺', d: '一工偷 20 顆以上，而且一次都沒被抓到', t: [1, 5, 20], v: () => AS('cs'), unit: '工' },
  { id: 'stealonly', cat: 'steal', n: '只准用偷的', d: '完成一場「只能用偷的」活動', t: [1], v: () => AS('so') },
  { id: 'caught', cat: 'steal', n: '慣犯', d: '累積被抓到偷蚵', t: [10, 100, 500], v: () => L_().caught, hint: '被抓到也是一種經驗', unit: '次' },
  { id: 'meathit', cat: 'steal', n: '肉彈攻擊', d: '用蚵仔肉丟中阿婆', t: [10, 100, 1000], v: () => L_().meatHits, unit: '次' },
  { id: 'blocks', cat: 'war', n: '雨傘防線', d: '用雨傘擋下的殼', t: [100, 1000, 10000], v: () => L_().blocks, unit: '個' },
  { id: 'reflect', cat: 'war', n: '完美反彈', d: '把殼完美反彈回去', t: [20, 200, 2000], v: () => L_().reflects, unit: '次' },
  { id: 'shellhit', cat: 'war', n: '以殼還殼', d: '丟殼丟中阿婆', t: [50, 500, 5000], v: () => L_().shellHits, unit: '次' },
  { id: 'nohit', cat: 'war', n: '毫髮無傷', d: '完成一工都沒被殼丟中（至少入碗 5 顆）', t: [1, 10, 50], v: () => AS('nh'), unit: '工' },
  { id: 'scared', cat: 'war', n: '阿婆們怕你了', d: '連續擋下 3 次，讓阿婆們怕你', t: [1, 10, 100], v: () => AS('sc'), unit: '次' },
  { id: 'moon', cat: 'war', n: '送上月球', d: '把鄰居送上月球', t: [1, 10, 50], v: () => AS('moon'), hint: '雜貨店有一樣很兇的道具', unit: '位' },
  { id: 'queen', cat: 'war', n: '今日剝蚵冠軍', d: '拿下當天剝蚵冠軍', t: [1, 10, 100], v: () => H.save.queen, unit: '次' },
  { id: 'peace', cat: 'war', n: '和平主義', d: '一整工都沒對人丟殼（丟地上／自動丟掉不算）', t: [1, 10, 50], v: () => AS('peace'), unit: '工' },
  { id: 'locs', cat: 'travel', n: '跑遍蚵寮', d: '在不同地點上過工', t: [2, 3, 4], v: () => achS().locs.length, unit: '個地點' },
  { id: 'seats', cat: 'travel', n: '換個位子坐', d: '坐過不同的座位上工', t: [2, 4, 5], v: () => achS().seats.length, unit: '個座位' },
  { id: 'radio', cat: 'travel', n: '收音機迷', d: '聽過收音機的不同電台', t: [1, 2, 3], v: () => achS().radio.length, unit: '台' },
  { id: 'night', cat: 'travel', n: '夜貓子', d: '上夜班', t: [1, 10, 50], v: () => AS('night'), hint: '天黑了還在剝？', unit: '工' },
  { id: 'temp', cat: 'travel', n: '臨時工', d: '做臨時工', t: [1, 10, 50], v: () => AS('temp'), unit: '工' },
  { id: 'dex', cat: 'collect', n: '圖鑑收集', d: '圖鑑收集進度（不含活動限定）', t: [25, 50, 100], v: dexPct, unit: '%' },
  { id: 'white', cat: 'collect', n: '白珍珠', d: '累積找到白珍珠', t: [1, 50, 500], v: () => H.save.dex[0], unit: '顆' },
  { id: 'pink', cat: 'collect', n: '粉紅珍珠', d: '累積找到粉紅珍珠', t: [1, 20, 200], v: () => H.save.dex[1], unit: '顆' },
  { id: 'goldp', cat: 'collect', n: '金珍珠', d: '累積找到金珍珠', t: [1, 10, 50], v: () => H.save.dex[2], unit: '顆' },
  { id: 'black', cat: 'collect', n: '黑珍珠', d: '累積找到黑珍珠', t: [1, 3, 10], v: () => H.save.dex[3], hint: '傳說中，找到的時候整個漁港都會轟動', unit: '顆' },
  { id: 'legend', cat: 'collect', n: '傳說奇物', d: '開到傳說等級的奇物', t: [1, 5, 20], v: () => H.LEGEND_ODD.reduce((a, i) => a + (H.save.odd[i] ?? 0), 0), unit: '件' },
  { id: 'sets', cat: 'collect', n: '套裝收集', d: '湊齊並穿上整套套裝', t: [1, 2, 3], v: () => achS().sets.length, unit: '套' },
  { id: 'owned', cat: 'collect', n: '雜貨店常客', d: '擁有的雜貨店商品', t: [3, 8, 15], v: () => H.save.shop.owned.length, unit: '樣' },
  { id: 'days', cat: 'veteran', n: '上工天數', d: '累積上工天數', t: [10, 100, 500], v: () => H.save.days, unit: '天' },
  { id: 'streak', cat: 'veteran', n: '連續上工', d: '連續天數領每日上工費', t: [3, 5, 7], v: () => Math.max(AS('streak'), H.save.streakDay ?? 0), unit: '天' },
  { id: 'daily', cat: 'veteran', n: '天天報到', d: '累積領每日上工費', t: [7, 30, 100], v: () => H.save.bonusN ?? 0, unit: '次' },
  { id: 'back', cat: 'veteran', n: '歡迎回來', d: '好一陣子沒來，又回到蚵寮上工', t: [1], v: () => H.save.retDay ? 1 : 0, hint: '好久不見也沒關係' },
  { id: 'ev', cat: 'veteran', n: '活動常客', d: '完成活動場次', t: [1, 10, 50], v: () => AS('ev'), unit: '場' },
  { id: 'evearly', cat: 'veteran', n: '提前完工', d: '活動中提前完成目標', t: [1, 5, 20], v: () => AS('ee'), unit: '次' },
  { id: 'evtop', cat: 'veteran', n: '活動前十名', d: '活動排行榜擠進前 10 名', t: [1], v: () => AS('top') },
  { id: 'tut', cat: 'veteran', n: '學會剝蚵', d: '完成新手教學', t: [1], v: () => H.save.tutDone ? 1 : 0 },
];
const TIER_N = ['銅', '銀', '金'], TIER_PTS = [10, 25, 50], TIER_PAY = [1000, 3000, 10000], ONE_PTS = 30, ONE_PAY = 3000;
const tierName = (a: AchDef, k: number) => a.t.length === 1 ? '達成' : TIER_N[k];
const tierPts = (a: AchDef, k: number) => a.t.length === 1 ? ONE_PTS : TIER_PTS[k];
const tierPay = (a: AchDef, k: number) => a.t.length === 1 ? ONE_PAY : TIER_PAY[k];
// 稱號：點數門檻，或達成指定成就；伺服器端有同一份白名單（game-stats-server H.Social.cs AchTitles）
const ACH_TITLES: { n: string; d: string; ok: () => boolean }[] = [
  { n: '蚵寮新手', d: '成就點數 100', ok: () => achS().pts >= 100 },
  { n: '剝蚵好手', d: '成就點數 300', ok: () => achS().pts >= 300 },
  { n: '蚵寮老手', d: '成就點數 700', ok: () => achS().pts >= 700 },
  { n: '王功剝蚵達人', d: '成就點數 1200', ok: () => achS().pts >= 1200 },
  { n: '漁港傳說', d: '成就點數 2000', ok: () => achS().pts >= 2000 },
  { n: '偷蚵之王', d: '「偷蚵仔」金牌', ok: () => (achS().got.steals ?? 0) >= 3 },
  { n: '月球回來的人', d: '「送上月球」銅牌', ok: () => (achS().got.moon ?? 0) >= 1 },
  { n: '傘下無敵', d: '「雨傘防線」金牌', ok: () => (achS().got.blocks ?? 0) >= 3 },
  { n: '黑珍珠獵人', d: '「黑珍珠」銅牌', ok: () => (achS().got.black ?? 0) >= 1 },
  { n: '走跳蚵寮', d: '「跑遍蚵寮」金牌', ok: () => (achS().got.locs ?? 0) >= 3 },
  { n: '圖鑑博士', d: '「圖鑑收集」金牌', ok: () => (achS().got.dex ?? 0) >= 3 },
  { n: '鐵打的蚵工', d: '「上工天數」金牌', ok: () => (achS().got.days ?? 0) >= 3 },
  { n: '雜貨店股東', d: '「雜貨店常客」金牌', ok: () => (achS().got.owned ?? 0) >= 3 },
  { n: '活動常客', d: '「活動常客」銀牌', ok: () => (achS().got.ev ?? 0) >= 2 },
];
export const achTitle = () => { const t = achS().title; return t && ACH_TITLES.some(x => x.n === t && x.ok()) ? t : ''; };
export const achAdd = (list: 'locs' | 'seats' | 'radio' | 'sets', id: string) => { const a = achS()[list]; if (!a.includes(id)) a.push(id); };
export function achBump(k: string, n = 1) { const s = achS().st; s[k] = (s[k] ?? 0) + n; achCheck(); }
// 看板式橫幅：不擋操作（pointer-events:none），排隊一個一個出
type AchB = { h: string; id?: string };
const achQ: AchB[] = []; let achBusy = false, achMore = 0;
function achBanner(h: string, id?: string) { if (achQ.length + (achBusy ? 1 : 0) >= 3) { achMore++; } else achQ.push({ h, id }); if (!achBusy) achNextBanner(); }
function achNextBanner() {
  const el = H.$('achBan'); let b = achQ.shift();
  if (!b && achMore) { b = { h: `<i class="ic ic-trophy"></i><span><small>成就達成</small><b>還有 ${achMore} 個成就</b><em>到成就頁面看看</em></span>` }; achMore = 0; }
  if (!b) { achBusy = false; el.classList.remove('on'); return; }
  achBusy = true; el.innerHTML = b.h; el.dataset.id = b.id ?? ''; el.classList.toggle('tap', H.state !== 'play'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  setTimeout(() => { el.classList.remove('on'); setTimeout(achNextBanner, 350); }, 3400);
}
// 上工時點橫幅不做事（不干擾操作）；其他畫面點了直接打開成就頁面到那一項
export let achShiftGot: string[] = [];
export function clearAchShiftGot() { achShiftGot = []; }
export function pushAchShiftGot(s: string) { achShiftGot.push(s); }
export function achCheck(retro = false) {
  const A = achS(); let gotN = 0, cash = 0;
  for (const s of H.setsOn()) achAdd('sets', s.id);
  A.st.streak = Math.max(A.st.streak ?? 0, H.save.streakDay ?? 0);
  ACHS.forEach((a, idx) => {
    const v = a.v() || 0; let k = A.got[a.id] ?? 0;
    while (k < a.t.length && v >= a.t[k]) {
      const pts = tierPts(a, k), pay = tierPay(a, k); A.pts += pts; H.save.money += pay; cash += pay; gotN++;
      if (!A.fresh.includes(a.id)) A.fresh.push(a.id);
      if (!retro) {
        const gold = a.t.length > 1 && k === 2;
        achBanner(`<i class="ic ic-trophy"></i><span><small>成就達成・${tierName(a, k)}${a.t.length > 1 ? '牌' : ''}</small><b>${H.esc(a.n)}</b><em>+${pts} 點・+$${pay}</em></span>`, a.id);
        if (H.state !== 'menu') achShiftGot.push(`${a.n}・${tierName(a, k)}${a.t.length > 1 ? '牌' : ''}（+$${pay}）`);
        if (gold) H.Social.report('ach', idx);
        H.track('achievement', { item: a.id, tier: k });
      }
      k++;
    }
    A.got[a.id] = k;
  });
  if (gotN) { H.persist(); if (retro) achBanner(`<i class="ic ic-trophy"></i><span><small>依照過去的紀錄補發</small><b>${gotN} 個成就</b><em>+$${cash}</em></span>`); }
  achDot(); if (H.$('ach').classList.contains('show')) achRender();
}
export function achDot() { const b = document.getElementById('oAch'); if (b) b.classList.toggle('achNew', achS().fresh.length > 0); }
let achTab = 'shuck';
export function achRender() {
  const A = achS(), cur = achTitle(), next = ACH_TITLES.slice(0, 5).find(t => !t.ok());
  const maxPts = ACHS.reduce((s, a) => s + a.t.reduce((x, _, k) => x + tierPts(a, k), 0), 0), done = ACHS.filter(a => (A.got[a.id] ?? 0) >= a.t.length).length;
  H.$('achTop').innerHTML = `<div class="achSum"><div><small>成就點數</small><b>${A.pts}</b><span>／${maxPts}</span></div><div><small>全部達成</small><b>${done}</b><span>／${ACHS.length}</span></div><div class="achCur"><small>目前稱號</small><b>${cur ? H.esc(cur) : '未配戴'}</b></div></div>` +
    (next ? `<div class="achNext"><span>下一個稱號「${next.n}」</span><i class="achBar"><i style="width:${Math.min(100, A.pts / parseInt(next.d.replace(/\D/g, '')) * 100)}%"></i></i></div>` : '');
  const fresh = new Set(A.fresh);
  H.$('achTabs').innerHTML = [...ACH_CATS, { id: 'title', n: '稱號', s: '稱號', ic: 'ic-crown' }].map((c: any) => { const nf = ACHS.some(a => a.cat === c.id && fresh.has(a.id)); return `<button data-t="${c.id}" class="${c.id === achTab ? 'on' : ''}${nf ? ' achNew' : ''}" role="tab" aria-selected="${c.id === achTab}"><i class="ic ${c.ic}"></i><span>${c.s}</span></button>`; }).join('') + `<b class="achCatT">${achTab === 'title' ? '稱號' : ACH_CATS.find(c => c.id === achTab)!.n}</b>`;
  if (achTab === 'title') {
    H.$('achList').innerHTML = `<p class="achTip">達成條件就能配戴，配戴的稱號會顯示在排行榜和跑馬燈的名字前面。</p>` + ACH_TITLES.map(t => { const ok = t.ok(), on = cur === t.n;
      return `<div class="achCard ttl${ok ? ' ok' : ' lock'}${on ? ' on' : ''}"><div class="achH"><b>${ok ? '' : '<i class="ic ic-lock"></i> '}${t.n}</b>${ok ? `<button class="achEq" data-n="${t.n}">${on ? '卸下' : '配戴'}</button>` : ''}</div><p>${t.d}</p></div>`; }).join('');
  } else {
    H.$('achList').innerHTML = ACHS.filter(a => a.cat === achTab).map(a => {
      const k = A.got[a.id] ?? 0, v = Math.max(0, Math.floor(a.v() || 0)), hid = !!a.hint && k === 0, full = k >= a.t.length, goal = a.t[Math.min(k, a.t.length - 1)];
      const pct = full ? 100 : Math.min(100, v / goal * 100);
      const tiers = a.t.map((th, j) => `<span class="achT t${a.t.length === 1 ? 'x' : j}${j < k ? ' got' : ''}">${tierName(a, j)}<small>${th}${a.unit === '%' ? '%' : ''}</small></span>`).join('');
      return `<div data-a="${a.id}" class="achCard${full ? ' full' : ''}${fresh.has(a.id) ? ' new' : ''}${hid ? ' hid' : ''}"><div class="achH"><b>${hid ? '？？？' : H.esc(a.n)}</b><span class="achTs">${tiers}</span></div><p>${hid ? `提示：${a.hint}` : a.d}</p>` +
        (a.t.length > 1 || !full ? `<div class="achP"><i class="achBar"><i style="width:${pct}%"></i></i><span>${hid ? '？' : full ? '全部達成' : (a.unit === '%' ? `${Math.min(v, goal)}%／${goal}%` : `${Math.min(v, goal)}／${goal}${a.unit ? ' ' + a.unit : ''}`)}</span></div>` : '') +
        `<small class="achR">${full ? '已領取全部獎勵' : `下一階：+${tierPts(a, k)} 點・+$${tierPay(a, k)}`}</small></div>`; }).join('');
  }
}
export function achOpen(focus?: string) { if (document.pointerLockElement) document.exitPointerLock(); achCheck(); achRender(); H.$('ach').classList.add('show'); const pb = H.$('ach').querySelector('.pb') as HTMLElement | null; pb?.scrollTo(0, 0); if (focus) { const c = H.$('achList').querySelector<HTMLElement>(`[data-a="${focus}"]`); if (c && pb) { pb.scrollTo(0, c.offsetTop - 120); c.classList.add('achHi'); setTimeout(() => c.classList.remove('achHi'), 1600); } } }
function achTabSeen() { const A = achS(); const before = A.fresh.length; A.fresh = A.fresh.filter(id => ACHS.find(a => a.id === id)?.cat !== achTab); if (A.fresh.length !== before) { H.persist(); achDot(); } }
// 一工結束：記錄原本沒有的統計
export function achShift(o: { worked: boolean; temp: boolean; waste: number; cracked: number; steals: number; caught: number; hitsTaken: number; thrown: number; ev: EvCfg | null; evDone: boolean; evEarly: boolean; cnt: number }) {
  const s = achS().st, inc = (k: string) => s[k] = (s[k] ?? 0) + 1;
  if (o.cnt > 0) { achAdd('locs', H.locNow().id); achAdd('seats', H.save.seat ?? 'door'); }
  if (o.worked) { if (o.waste === 0) inc('zw'); if (o.cracked === 0) inc('nc'); if (o.hitsTaken === 0) inc('nh'); if (o.thrown === 0 && !o.temp) inc('peace'); if (H.nightShift) inc('night'); if (o.temp) inc('temp'); }
  if (o.steals >= 20 && o.caught === 0) inc('cs');
  if (o.ev && o.evDone) { inc('ev'); if (o.evEarly) inc('ee'); if (o.ev.steal === 'steal_only') inc('so'); }
  achCheck();
}
// 第一次載入（舊玩家）：依既有紀錄補發，不廣播
(window as any).__ach = { end: () => H.endDay(), get got() { return achShiftGot; }, get s() { return achS(); }, bump: achBump, check: achCheck, title: achTitle, list: ACHS.map(a => a.id) };
export function initAchievements(host: AchHost) {
  H = host;
  H.$('achBan').addEventListener('pointerup', () => { const el = H.$('achBan'); if (H.state === 'play' || !el.classList.contains('on')) return; const a = ACHS.find(x => x.id === el.dataset.id); if (a) achTab = a.cat; achOpen(a?.id); });
  H.$('achTabs').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button[data-t]') as HTMLElement | null; if (!b) return; achTabSeen(); achTab = b.dataset.t!; achRender(); });
  H.$('achList').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('.achEq') as HTMLElement | null; if (!b) return; const A = achS(), n = b.dataset.n!; A.title = A.title === n ? '' : n; H.persist(); achRender(); H.toast(A.title ? `配戴稱號「${A.title}」` : '已卸下稱號', '#ffe080'); H.Social.syncTitle(); });
  H.$('achClose').onclick = () => { achTabSeen(); H.$('ach').classList.remove('show'); if (H.achFromRes) { H.achFromRes = false; if (H.state === 'end') H.$('result').classList.add('show'); } };
  H.btn('oAch', () => achOpen());
  setInterval(() => { if (H.state === 'play' && !H.tut) achCheck(); }, 1000); // 上工中每秒檢查一次即時進度
  { const first = !H.save.ach; const A = achS();
  if (first) { A.st.peace = Object.entries(H.save.titles as Record<string, number>).filter(([k]) => k.includes('和平')).reduce((x, [, v]) => x + v, 0); if (H.save.days > 0) achAdd('locs', 'home'); if (H.save.loc && H.save.days > 0) achAdd('locs', H.save.loc); if (H.save.seat && H.save.days > 0) achAdd('seats', H.save.seat); }
  setTimeout(() => achCheck(first), 1500); achDot(); }
  (window as any).__achOk = 1;
  (window as any).__ach = { end: () => H.endDay(), get got() { return achShiftGot; }, get s() { return achS(); }, bump: achBump, check: achCheck, title: achTitle, list: ACHS.map(a => a.id) };
}
