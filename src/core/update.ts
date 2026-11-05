/// <reference types="vite/client" />
// 新版上線通知：輪詢 version.json，只在主畫面／結算畫面顯示
const KEY = (__PREVIEW__ ? 'preview:' : '') + 'updDismissed';
let pending: { version: string; title: string } | null = null;
let shown = false;
export function initUpdate(canShow: () => boolean) {
  const url = () => import.meta.env.BASE_URL + 'version.json?t=' + Date.now();
  const check = async () => {
    try {
      const r = await fetch(url(), { cache: 'no-store' }); if (!r.ok) return;
      const j = await r.json();
      if (j && j.version && j.version !== __VERSION__ && localStorage.getItem(KEY) !== j.version) pending = { version: String(j.version), title: String(j.title || '') };
    } catch { /* 離線時略過 */ }
  };
  check(); setInterval(check, 180000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(() => { if (pending && !shown && canShow()) show(); }, 1000);
}
function btn(el: HTMLElement, f: () => void) {
  let ok = false;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); ok = true; });
  el.addEventListener('pointerleave', () => { ok = false; });
  el.addEventListener('pointerup', e => { e.stopPropagation(); if (ok) f(); ok = false; });
}
function show() {
  if (!pending) return; shown = true; const p = pending;
  if (!document.getElementById('updCss')) { const st = document.createElement('style'); st.id = 'updCss'; st.textContent = `
#updNote{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,20,30,.55);padding:16px}
#updNote .box{width:min(340px,100%);background:#efe9dc;border:3px solid #2f5b7c;box-shadow:6px 6px 0 #1d2f3d;color:#26323a;font-family:inherit;text-align:center}
#updNote .hd{background:repeating-linear-gradient(90deg,#3d6f93 0 10px,#33607f 10px 20px);color:#efe9dc;padding:12px;font-size:20px;font-weight:800;letter-spacing:2px;display:flex;align-items:center;justify-content:center;gap:8px;border-bottom:3px solid #2f5b7c}
#updNote .tt{padding:16px 14px 6px;font-size:15px;line-height:1.5;word-break:break-word}
#updNote .sub{font-size:13px;color:#5b6670;padding:0 14px 14px}
#updNote .bt{display:flex;flex-direction:column;gap:10px;padding:0 14px 16px}
#updNote button{min-height:48px;font-size:17px;font-weight:700;border:2px solid #1d2f3d;box-shadow:3px 3px 0 #1d2f3d;cursor:pointer;font-family:inherit;touch-action:manipulation}
#updNote .pri{background:#b8473a;color:#efe9dc}#updNote .sec{background:#efe9dc;color:#2f5b7c}
#updNote button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #1d2f3d}`; document.head.appendChild(st); }
  const d = document.createElement('div'); d.id = 'updNote';
  d.innerHTML = `<div class="box"><div class="hd"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>新版上線囉！</div><div class="tt"></div><div class="sub">重新整理就能玩到新版本，進度都會保留。</div><div class="bt"><button class="pri">重新整理</button><button class="sec">晚點再說</button></div></div>`;
  (d.querySelector('.tt') as HTMLElement).textContent = p.title || '遊戲有新內容更新了';
  for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart']) d.addEventListener(ev, e => e.stopPropagation());
  btn(d.querySelector('.pri') as HTMLElement, () => location.reload());
  btn(d.querySelector('.sec') as HTMLElement, () => { localStorage.setItem(KEY, p.version); pending = null; shown = false; d.remove(); });
  document.body.appendChild(d);
}
