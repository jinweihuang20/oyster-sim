/**
 * 獎勵提示（撈到漂流箱等）：獨立一條，不跟共用的 #toast 搶位子。
 * - 共用 #toast 只有一格，誰最後呼叫誰贏（有人進出廣場、撞船、其他提示都會把它蓋掉），而且上方小條是半透明＋毛玻璃，海面天空一霧就糊。
 * - 這裡：實心深底、無 backdrop-filter／無發光陰影、大字金額；自己的計時（不吃主迴圈 dt），約 2.8 秒後淡出。
 */
export type RewardKind = 'mine' | 'feed';
export type RewardItem = { id: number; key: string; kind: RewardKind; label: string; amount: string; until: number };

export const REWARD_SEC = { mine: 2.8, feed: 2.6, fade: 0.35, max: 3 } as const;

/** 純邏輯：加一筆（同 key 只留新的；超過上限丟最舊的） */
export function pushReward(list: RewardItem[], it: RewardItem, max: number = REWARD_SEC.max): RewardItem[] {
  const out = list.filter(x => x.key !== it.key);
  out.push(it);
  while (out.length > max) out.shift();
  return out;
}
/** 純邏輯：過期的拿掉 */
export const liveRewards = (list: RewardItem[], now: number) => list.filter(x => x.until > now);

let host: HTMLElement | null = null;
let seq = 0;
let items: RewardItem[] = [];
const nodes = new Map<number, HTMLElement>();

function ensureHost() {
  if (host && host.isConnected) return host;
  host = document.createElement('div');
  host.id = 'rewardToasts';
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

function drop(id: number) {
  const el = nodes.get(id); if (!el) return;
  nodes.delete(id);
  el.classList.remove('on'); el.classList.add('out');
  window.setTimeout(() => el.remove(), REWARD_SEC.fade * 1000 + 40);
}

/** 顯示一筆獎勵。kind=mine：自己拿到（大）；feed：別人拿到的公告（小一點） */
export function rewardToast(label: string, amount: string, kind: RewardKind = 'mine', key = `${kind}:${label}:${amount}`, sec?: number) {
  if (typeof document === 'undefined') return;
  const h = ensureHost();
  const life = sec ?? REWARD_SEC[kind];
  const it: RewardItem = { id: ++seq, key, kind, label, amount, until: performance.now() + life * 1000 };
  const before = new Set(items.map(x => x.id));
  items = pushReward(items, it);
  for (const id of before) if (!items.some(x => x.id === id)) drop(id);
  const el = document.createElement('div');
  el.className = `rwT ${kind}`;
  const a = document.createElement('b'); a.className = 'rwAmt'; a.textContent = amount;
  const l = document.createElement('span'); l.className = 'rwLbl'; l.textContent = label;
  if (kind === 'mine') el.append(l, a); else el.append(l, document.createTextNode(' '), a);
  h.appendChild(el); nodes.set(it.id, el);
  // 下一幀再加 .on，才有淡入
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  window.setTimeout(() => { items = liveRewards(items, performance.now() + 1); drop(it.id); }, life * 1000);
}

/** 離開廣場時清掉 */
export function clearRewardToasts() {
  for (const id of [...nodes.keys()]) drop(id);
  items = [];
}
