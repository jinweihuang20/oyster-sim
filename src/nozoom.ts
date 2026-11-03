// 防止整個遊戲被雙擊／連點／捏合放大（iOS Safari 會忽略 user-scalable=no）
export function installNoZoom() {
  const st = document.createElement('style');
  st.textContent = 'html,body{touch-action:manipulation}canvas,#hud,#btns,#btnsL,#joy,.mb{touch-action:none}button,a,label,input,select{touch-action:manipulation}';
  document.head.appendChild(st);
  const stop = (e: Event) => e.preventDefault();
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  // 兩指以上捏合
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 && !(e.target as HTMLElement).closest?.('#dmRoot')) e.preventDefault(); }, { passive: false });
  // 300ms 內連點：只擋非互動元素（按鈕、輸入框、連結、可捲動面板照常，避免吃掉按鈕的 click）
  let last = 0;
  document.addEventListener('touchend', e => {
    const now = e.timeStamp, el = e.target as HTMLElement;
    const interactive = el.closest?.('button,a,input,textarea,select,label,[contenteditable],.panel,[data-scroll]');
    if (now - last < 300 && !interactive && e.cancelable) e.preventDefault();
    last = now;
  }, { passive: false });
}
