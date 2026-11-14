/** 共用 DOM 小工具（從 main.ts 拆出，行為不變） */

export const $ = (id: string) => document.getElementById(id)!;

export const on = (id: string, v: boolean) => $(id).classList.toggle('on', v);

export type ToastDeps = {
  isPlazaMode: () => boolean;
  /** 廣場時重算跑馬燈頂距（對齊原 Social.placeFeed） */
  onPlazaToast?: () => void;
};

export type ToastPlace = 'mid' | 'top';

/** 系統／狀態類上方橫幅建議秒數 */
export const TOP_SEC = {
  short: 2,    // 已複製、改名、同步 OK
  mid: 2.5,    // 進出廣場、短設定
  info: 3,     // 補領、結算、解鎖、錯誤、連線
  long: 3.5,   // 長說明、含代碼
} as const;

let toastEl: HTMLElement | null = null;
let toastT = 0;
let toastDeps: ToastDeps = { isPlazaMode: () => false };
let topClearTimer = 0;
let topClearFn: (() => void) | null = null;

function cancelTopClear() {
  if (topClearTimer) { clearTimeout(topClearTimer); topClearTimer = 0; }
  if (toastEl && topClearFn) toastEl.removeEventListener('transitionend', topClearFn);
  topClearFn = null;
}

function hideToast() {
  if (!toastEl) return;
  toastT = 0;
  const el = toastEl;
  const keepTop = el.classList.contains('top');
  el.classList.remove('on');
  el.removeAttribute('title');
  cancelTopClear();
  if (!keepTop) return;
  // 淡出期間保留 .top，否則會瞬移到畫面中央再淡出
  const done = () => {
    if (toastEl !== el || el.classList.contains('on')) return;
    el.classList.remove('top');
    cancelTopClear();
  };
  topClearFn = done;
  el.addEventListener('transitionend', done);
  topClearTimer = window.setTimeout(done, 320);
}

export function initDomToast(el: HTMLElement, deps: ToastDeps) {
  toastEl = el;
  toastDeps = deps;
  el.addEventListener('click', (e) => {
    if (!toastEl?.classList.contains('on') || !toastEl.classList.contains('top')) return;
    e.preventDefault();
    e.stopPropagation();
    hideToast();
  });
}

/** @param place `top`＝畫面上方橫幅；預設中央大字。上方橫幅可點一下關閉。 */
export function toast(t: string, c = '#ffe080', sec = 1.1, place: ToastPlace = 'mid') {
  if (!toastEl) return;
  cancelTopClear();
  toastEl.textContent = t;
  toastEl.classList.toggle('top', place === 'top');
  if (place === 'top') {
    toastEl.style.color = '';
    toastEl.title = '點一下關閉';
  } else {
    toastEl.style.color = c;
    toastEl.removeAttribute('title');
  }
  toastEl.classList.add('on');
  toastT = Math.max(0.6, sec);
  if (toastDeps.isPlazaMode()) {
    try { toastDeps.onPlazaToast?.(); } catch { /* Social 尚未 init */ }
  }
}

/** 系統／狀態提示：上方橫幅，可點關 */
export function toastTop(t: string, sec: number = TOP_SEC.info) {
  toast(t, '#ffe080', sec, 'top');
}

/** 主迴圈呼叫：倒數並關閉 toast */
export function tickToast(dt: number) {
  if (!toastEl) return;
  toastT -= dt;
  if (toastT <= 0) hideToast();
}
