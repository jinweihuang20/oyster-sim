/** 共用 DOM 小工具（從 main.ts 拆出，行為不變） */

export const $ = (id: string) => document.getElementById(id)!;

export const on = (id: string, v: boolean) => $(id).classList.toggle('on', v);

export type ToastDeps = {
  isPlazaMode: () => boolean;
  /** 廣場時重算跑馬燈頂距（對齊原 Social.placeFeed） */
  onPlazaToast?: () => void;
};

let toastEl: HTMLElement | null = null;
let toastT = 0;
let toastDeps: ToastDeps = { isPlazaMode: () => false };

export function initDomToast(el: HTMLElement, deps: ToastDeps) {
  toastEl = el;
  toastDeps = deps;
}

export function toast(t: string, c = '#ffe080') {
  if (!toastEl) return;
  toastEl.textContent = t;
  toastEl.style.color = c;
  toastEl.classList.add('on');
  toastT = 1.1;
  // 廣場：重算頂距，避免與跑馬燈交疊
  if (toastDeps.isPlazaMode()) {
    try { toastDeps.onPlazaToast?.(); } catch { /* Social 尚未 init */ }
  }
}

/** 主迴圈呼叫：倒數並關閉 toast */
export function tickToast(dt: number) {
  if (!toastEl) return;
  toastT -= dt;
  if (toastT <= 0) toastEl.classList.remove('on');
}
