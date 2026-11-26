// 雲端存檔：同 pid 多裝置 last-write-wins；連結碼讓第二台領取同一身分＋進度。
const API = 'https://game-status.gwtech.org/s';
const REV_KEY = 'oyster-cloud-rev';
const SYNC_AT = 'oyster-cloud-at';

export type CloudLS = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem?: (k: string) => void;
};

type Status = 'idle' | 'syncing' | 'ok' | 'err' | 'offline';

let pid = '';
let LS: CloudLS;
let status: Status = 'idle';
let lastErr = '';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: Array<(s: Status, err: string) => void> = [];

const notify = () => { for (const f of listeners) try { f(status, lastErr); } catch { /* */ } };
export const onCloudStatus = (f: (s: Status, err: string) => void) => { listeners.push(f); f(status, lastErr); return () => { listeners = listeners.filter(x => x !== f); }; };
export const cloudStatus = () => ({ status, err: lastErr });

function setStatus(s: Status, err = '') { status = s; lastErr = err; notify(); }
const TOO_LARGE = '存檔過大，無法同步到雲端';
function setPutStatus(put: 'ok' | 'stale' | 'fail' | 'too_large', failMsg: string, failStatus: Status = 'err') {
  if (put === 'ok') { setStatus('ok'); return; }
  if (put === 'too_large') { setStatus('err', TOO_LARGE); return; }
  setStatus(failStatus, failMsg);
}

function localRev(): number {
  const n = Number(LS.getItem(REV_KEY) || '0');
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function bumpRev(): number {
  const r = Math.max(localRev() + 1, Date.now());
  try { LS.setItem(REV_KEY, String(r)); } catch { /* */ }
  return r;
}

/** 未結算草稿／已領名單／提示與介面狀態：只留本機，不上雲（避免雲端覆寫把進度冲掉或重複領）。設定 oyster-mix 仍上雲。 */
const CLOUD_SKIP = new Set([
  'oyster-shift-draft', 'oyster-shift-claimed', SYNC_AT,
  'oyster-auth-token', 'oyster-auth-wait', 'oyster-auth-intent', 'oyster-auth-handled',
  'oyster-lb-day', 'oyster-homeguide', 'oyster-dc-first', 'oyster-dm-set',
]);
export function isCloudSkipKey(k: string) {
  if (CLOUD_SKIP.has(k)) return true;
  if (k.startsWith('oyster-fr-watch:') || k.startsWith('oyster-fr-ping:')) return true;
  if (k.startsWith('oyster-ck-seen-up')) return true;
  return false;
}
/** localStorage 字串若是 JSON 物件／陣列就解析，避免雲端 payload 再跳脫一次。 */
export function packCloudValue(v: string): unknown {
  const t = v.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(v); } catch { /* 當純文字 */ }
  }
  return v;
}
/** 舊雲端存檔是字串、新的可能是物件；寫回 localStorage 一律轉成字串。 */
export function unpackCloudValue(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return null;
}

/** 收集本機 oyster* 鍵（與 inapp collect 一致；含 stats-id／存檔／設定）。 */
export function collectCloudData(): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const prefix = typeof __PREVIEW__ !== 'undefined' && __PREVIEW__ ? 'preview:' : '';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i)!;
      if (prefix) { if (!full.startsWith(prefix)) continue; }
      else if (full.startsWith('preview:')) continue;
      const k = prefix ? full.slice(prefix.length) : full;
      if (!k.startsWith('oyster') || isCloudSkipKey(k)) continue;
      const v = localStorage.getItem(full);
      if (typeof v === 'string') o[k] = packCloudValue(v);
    }
  } catch { /* */ }
  if (pid) o['oyster-stats-id'] = pid;
  o[REV_KEY] = String(localRev());
  return o;
}

export function applyCloudData(data: Record<string, unknown>, rev: number, newPid: string) {
  for (const [k, v] of Object.entries(data)) {
    if (typeof k !== 'string' || !k.startsWith('oyster')) continue;
    if (isCloudSkipKey(k) || k === REV_KEY) continue;
    const s = unpackCloudValue(v);
    if (s === null) continue;
    try { LS.setItem(k, s); } catch { /* */ }
  }
  try {
    LS.setItem('oyster-stats-id', newPid);
    LS.setItem(REV_KEY, String(rev));
  } catch { /* */ }
}

/** 套用遠端存檔並重新載入（取回綁定進度時用）。 */
export function cloudApplyRemote(data: Record<string, unknown>, rev: number, newPid: string) {
  if (newPid) pid = newPid;
  applyCloudData(data, rev, newPid || pid);
  setStatus('ok');
  location.reload();
}

export function cloudSetPid(playerId: string) {
  if (playerId) pid = playerId;
}

async function getCloud(): Promise<{ found: boolean; pid?: string; data?: Record<string, unknown>; rev?: number } | null> {
  try {
    const r = await fetch(`${API}/cloud?pid=${encodeURIComponent(pid)}`, { mode: 'cors', cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.ok) return null;
    if (!j.found) return { found: false };
    const data = j.data && typeof j.data === 'object' && !Array.isArray(j.data) ? j.data as Record<string, unknown> : {};
    return { found: true, pid: String(j.pid || pid), data, rev: Number(j.rev) || 0 };
  } catch { return null; }
}

function cloudAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'text/plain' };
  try {
    const t = LS?.getItem('oyster-auth-token');
    if (t) h.Authorization = 'Bearer ' + t;
  } catch { /* */ }
  return h;
}

async function putCloud(rev: number, data: Record<string, unknown>): Promise<'ok' | 'stale' | 'fail' | 'too_large'> {
  try {
    const r = await fetch(`${API}/cloud`, {
      method: 'POST', mode: 'cors',
      headers: cloudAuthHeaders(),
      body: JSON.stringify({ pid, data, rev }),
    });
    if (r.status === 401) { setStatus('err', '請重新登入這台'); return 'fail'; }
    if (r.status === 413) return 'too_large';
    if (!r.ok) return 'fail';
    const j = await r.json();
    if (j?.ok) {
      try { LS.setItem(SYNC_AT, String(Date.now())); } catch { /* */ }
      return 'ok';
    }
    if (j?.err === 'stale' && j.data) {
      applyCloudData(j.data as Record<string, unknown>, Number(j.rev) || 0, String(j.pid || pid));
      return 'stale';
    }
    return 'fail';
  } catch { return 'fail'; }
}

/** 盡早綁定 pid／LS，讓後續 persist 能累計 rev。 */
export function cloudInit(playerId: string, ls: CloudLS) {
  pid = playerId;
  LS = ls;
}

/** 開機：雲端較新就套用並 reload；本機較新就上傳。回傳 true＝即將 reload。 */
export async function cloudBoot(playerId?: string, ls?: CloudLS): Promise<boolean> {
  if (playerId) pid = playerId;
  if (ls) LS = ls;
  setStatus('syncing');
  const remote = await getCloud();
  if (!remote) { setStatus('offline', '連不上雲端'); return false; }
  const loc = localRev();
  if (!remote.found) {
    const rev = loc > 0 ? loc : bumpRev();
    const put = await putCloud(rev, collectCloudData());
    setPutStatus(put, '首次上傳失敗');
    return false;
  }
  const rRev = remote.rev ?? 0;
  if (rRev > loc) {
    applyCloudData(remote.data || {}, rRev, remote.pid || pid);
    setStatus('ok');
    location.reload();
    return true;
  }
  if (loc > rRev) {
    const put = await putCloud(loc, collectCloudData());
    if (put === 'stale') { setStatus('ok'); location.reload(); return true; }
    setPutStatus(put, '上傳失敗');
    return false;
  }
  setStatus('ok');
  return false;
}

export function cloudTouch() {
  if (!pid || !LS) return;
  bumpRev();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void cloudFlush(); }, 4000);
}

export async function cloudFlush(): Promise<boolean> {
  if (!pid || !LS) return false;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  setStatus('syncing');
  const rev = localRev() || bumpRev();
  const put = await putCloud(rev, collectCloudData());
  if (put === 'stale') { setStatus('ok'); location.reload(); return true; }
  if (put === 'ok') { setStatus('ok'); return false; }
  setPutStatus(put, '同步失敗', put === 'too_large' ? 'err' : 'offline');
  return false;
}

export async function cloudMakeLink(): Promise<{ ok: true; code: string; ttlMs: number } | { ok: false; err: string }> {
  await cloudFlush();
  try {
    const r = await fetch(`${API}/cloud/link`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ pid }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) return { ok: false, err: j?.err === 'no_cloud' ? '請先成功同步一次' : '產生失敗' };
    return { ok: true, code: String(j.code), ttlMs: Number(j.ttlMs) || 600_000 };
  } catch { return { ok: false, err: '連線失敗' }; }
}

export async function cloudClaimLink(code: string): Promise<{ ok: true } | { ok: false; err: string }> {
  const c = code.trim().toUpperCase();
  if (c.length < 4) return { ok: false, err: '代碼太短' };
  try {
    const r = await fetch(`${API}/cloud/claim`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ code: c }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) {
      const e = j?.err;
      return { ok: false, err: e === 'not_found' ? '代碼無效或過期' : e === 'no_cloud' ? '對方還沒有雲端存檔' : '領取失敗' };
    }
    applyCloudData(j.data || {}, Number(j.rev) || 0, String(j.pid || ''));
    location.reload();
    return { ok: true };
  } catch { return { ok: false, err: '連線失敗' }; }
}

export function installCloudLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void cloudFlush();
  });
  addEventListener('pagehide', () => { void cloudFlush(); });
}
