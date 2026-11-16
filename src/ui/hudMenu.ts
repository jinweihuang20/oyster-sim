/** 遊戲中（廣場／工寮）上方的「選單」：把雜貨店、圖鑑、食材、裝備、排行榜、設定收進一個小面板。 */

export type HudMenuDeps = {
  /** 目前在廣場（排行榜只在廣場有） */
  inPlaza: () => boolean;
  /** 新品提示（雜貨店） */
  shopNew: () => boolean;
  openCookDex: () => void;
  openFood: () => void;
};

let D: HudMenuDeps;
let box: HTMLDivElement | null = null;

const sv = (p: string) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  dex: sv('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6M9 11h4"/>'),
  cook: sv('<ellipse cx="10" cy="13" rx="8" ry="5"/><path d="M18 12l4-2"/><path d="M6 12.5c1-2 7-2 8 0"/>'),
  food: sv('<path d="M3 11h18"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M9 7c0-1.5 1-2 1-3M13 7c0-1.5 1-2 1-3"/>'),
  shop: sv('<path d="M3 10h18M5 10v10h14V10M4 10l2-5h12l2 5"/><path d="M10 20v-5h4v5"/>'),
  equip: sv('<path d="M8 3l-4 3 2 4 2-1v12h8V9l2 1 2-4-4-3c-1 1.5-2.5 2-4 2s-3-.5-4-2z"/>'),
  rank: sv('<path d="M4 20V12h4v8M10 20V6h4v14M16 20v-6h4v6"/>'),
  set: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

const click = (id: string) => (document.getElementById(id) as HTMLButtonElement | null)?.click();

/** 有畫面蓋在遊戲上（選單、圖鑑、雜貨店、設定…）：body 加 uiCovered，廣場／工寮的浮動按鈕先藏起來 */
const COVER_SKIP = new Set(['overlay', 'npcTip']);
export function syncUiCovered() {
  let on = !!box;
  if (!on) for (const p of Array.from(document.querySelectorAll<HTMLElement>('.panel.show'))) {
    if (!COVER_SKIP.has(p.id) && p.getClientRects().length) { on = true; break; }
  }
  document.body.classList.toggle('uiCovered', on);
}

export function initHudMenu(deps: HudMenuDeps) {
  D = deps;
  window.setInterval(syncUiCovered, 200);
  // 點擊後馬上更新一次（開關畫面不用等下一輪）
  document.addEventListener('click', () => queueMicrotask(syncUiCovered), true);
  document.addEventListener('click', () => window.setTimeout(syncUiCovered, 0));
  document.getElementById('hudMenuBtn')?.addEventListener('click', e => { e.stopPropagation(); if (box) closeHudMenu(); else openHudMenu(); });
}

export function hudMenuOpen() { return !!box; }
export function closeHudMenu() { box?.remove(); box = null; syncUiCovered(); }

export function openHudMenu() {
  if (!D) return;
  closeHudMenu();
  if (document.pointerLockElement) document.exitPointerLock();
  type Tile = { k: string; n: string; ic: string; dot?: boolean; go: () => void };
  const tiles: Tile[] = [
    { k: 'dex', n: '圖鑑', ic: ICON.dex, go: () => click('dexBtn') },
    { k: 'cook', n: '蚵仔煎圖鑑', ic: ICON.cook, go: () => D.openCookDex() },
    { k: 'food', n: '食材', ic: ICON.food, go: () => D.openFood() },
    { k: 'shop', n: '雜貨店', ic: ICON.shop, dot: D.shopNew(), go: () => click('shopBtn') },
    { k: 'equip', n: '裝備', ic: ICON.equip, go: () => click('eqBtn') },
    ...(D.inPlaza() ? [{ k: 'rank', n: '排行榜', ic: ICON.rank, go: () => click('rankBtn') }] : []),
    { k: 'set', n: '設定', ic: ICON.set, go: () => click('setBtn') },
  ];
  box = document.createElement('div');
  box.id = 'hudMenu';
  box.innerHTML = `<div class="hmCard" role="dialog" aria-label="選單"><div class="hmHead"><b>選單</b><button type="button" class="hmX" aria-label="關閉">${ICON.x}</button></div>`
    + `<div class="hmGrid">${tiles.map(t => `<button type="button" class="hmTile" data-k="${t.k}">${t.ic}<span>${t.n}</span>${t.dot ? '<i class="hmDot">新</i>' : ''}</button>`).join('')}</div></div>`;
  box.addEventListener('pointerdown', e => { if (e.target === box) closeHudMenu(); });
  document.body.appendChild(box);
  box.querySelector<HTMLButtonElement>('.hmX')!.onclick = closeHudMenu;
  syncUiCovered();
  box.querySelectorAll<HTMLButtonElement>('.hmTile').forEach(b => b.onclick = () => {
    const t = tiles.find(x => x.k === b.dataset.k); closeHudMenu(); t?.go();
  });
}
