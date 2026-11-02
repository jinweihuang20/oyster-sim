// Threads／IG／FB／LINE 內建瀏覽器：自動改用系統瀏覽器開，存檔用一次性代碼搬過去
const API = 'https://game-status.gwtech.org/s';
const P = __PREVIEW__ ? 'preview:' : '';
const UA = navigator.userAgent;
const IOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const ANDROID = /Android/i.test(UA);
export const IN_APP = /Barcelona|Threads|Instagram|FBAN|FBAV|FB_IAB|\bLine\//i.test(UA);
// 模組載入時（主程式建立新存檔前）先記下本機是否已有進度
const hadProgress = (() => { try { const s = JSON.parse(localStorage.getItem(P + 'oyster-sim') || 'null'); return !!s && ((s.days | 0) > 0 || (s.bonusN | 0) > 0 || (Array.isArray(s.dex) && s.dex.some((x: number) => x > 0))); } catch { return false; } })();

function stripMv() { const u = new URL(location.href); u.searchParams.delete('mv'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }

/** 目標瀏覽器：有 ?mv=代碼 時，本機沒進度才匯入（匯入後重新整理）；有進度就保留本機存檔。回傳 true 表示即將重新整理。 */
export async function importMove(): Promise<boolean> {
  const code = new URLSearchParams(location.search).get('mv'); if (!code) return false;
  stripMv();
  try {
    const r = await fetch(API + '/move/' + encodeURIComponent(code), { mode: 'cors', cache: 'no-store' });
    if (!r.ok || hadProgress) return false; // 有進度：代碼已被取用作廢，保留本機
    const j = await r.json(); const data = j?.data; if (!data || typeof data !== 'object') return false;
    for (const [k, v] of Object.entries(data)) if (typeof k === 'string' && k.startsWith('oyster') && typeof v === 'string') localStorage.setItem(P + k, v);
    location.reload(); return true;
  } catch { return false; }
}

function collect(): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (!k.startsWith(P)) continue; const n = k.slice(P.length); if (n.startsWith('oyster') && !n.startsWith('preview:')) o[n] = localStorage.getItem(k)!; }
  return o;
}

const SK = 'inappStay';
/** 內建瀏覽器：上傳存檔換代碼後跳到系統瀏覽器。 */
export async function escapeInApp(pid: string) {
  if (!IN_APP || new URLSearchParams(location.search).has('mv')) return;
  try { if (sessionStorage.getItem(SK)) return; } catch { /* */ }
  let code = '';
  try { const r = await fetch(API + '/move', { method: 'POST', body: JSON.stringify({ pid, data: collect() }), headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }); if (r.ok) code = (await r.json())?.code || ''; } catch { /* 離線就只換瀏覽器不搬檔 */ }
  const u = new URL(location.href); u.searchParams.delete('mv'); if (code) u.searchParams.set('mv', code);
  const url = u.toString();
  if (ANDROID) {
    location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    return;
  }
  if (IOS) location.href = 'x-safari-' + url;
  setTimeout(() => { if (document.visibilityState === 'visible') hint(url); }, 1500);
}

function btn(el: HTMLElement, f: () => void) {
  let ok = false;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); ok = true; });
  el.addEventListener('pointerleave', () => { ok = false; });
  el.addEventListener('pointerup', e => { e.stopPropagation(); if (ok) f(); ok = false; });
}
const ICO = (p: string) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
function hint(url: string) {
  if (document.getElementById('iaNote')) return;
  const st = document.createElement('style'); st.textContent = `
#iaNote{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,20,30,.55);padding:16px}
#iaNote .box{width:min(350px,100%);max-height:100%;overflow:auto;background:#efe9dc;border:3px solid #2f5b7c;box-shadow:6px 6px 0 #1d2f3d;color:#26323a;font-family:inherit}
#iaNote .hd{position:sticky;top:0;background:repeating-linear-gradient(90deg,#3d6f93 0 10px,#33607f 10px 20px);color:#efe9dc;padding:12px 44px 12px 12px;font-size:19px;font-weight:800;letter-spacing:2px;display:flex;align-items:center;gap:8px;border-bottom:3px solid #2f5b7c}
#iaNote .x{position:absolute;right:6px;top:6px;width:36px;height:36px;min-height:0;padding:0;background:transparent;color:#efe9dc;border:0;box-shadow:none;display:flex;align-items:center;justify-content:center}
#iaNote ol{margin:0;padding:14px 16px 6px 36px;font-size:15px;line-height:1.7}
#iaNote .sub{font-size:13px;color:#5b6670;padding:0 16px 12px;line-height:1.5}
#iaNote .bt{display:flex;flex-direction:column;gap:10px;padding:0 14px 16px}
#iaNote button{min-height:48px;font-size:17px;font-weight:700;border:2px solid #1d2f3d;box-shadow:3px 3px 0 #1d2f3d;cursor:pointer;font-family:inherit;touch-action:manipulation;display:flex;align-items:center;justify-content:center;gap:6px}
#iaNote .pri{background:#b8473a;color:#efe9dc}#iaNote .sec{background:#efe9dc;color:#2f5b7c}`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'iaNote';
  d.innerHTML = `<div class="box"><div class="hd">${ICO('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M12 13v4M10 15l2 2 2-2"/>')}改用瀏覽器開比較順<button class="x" aria-label="關閉">${ICO('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
<ol><li>點右上角「⋯」</li><li>選「在瀏覽器開啟」</li></ol>
<div class="sub">目前在 App 內建瀏覽器裡，存檔容易不見。從這裡開過去，你的進度會一起搬過去（10 分鐘內有效）。</div>
<div class="bt"><button class="pri">${ICO('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>')}複製遊戲連結</button><button class="sec">繼續在這裡玩</button></div></div>`;
  for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart']) d.addEventListener(ev, e => e.stopPropagation());
  const close = () => { try { sessionStorage.setItem(SK, '1'); } catch { /* */ } d.remove(); };
  btn(d.querySelector('.x') as HTMLElement, close);
  btn(d.querySelector('.sec') as HTMLElement, close);
  const pri = d.querySelector('.pri') as HTMLElement;
  btn(pri, () => { navigator.clipboard?.writeText(url).then(() => { pri.lastChild!.textContent = '已複製，貼到瀏覽器開'; }).catch(() => { prompt('複製這個連結，貼到瀏覽器開', url); }); });
  document.body.appendChild(d);
}
