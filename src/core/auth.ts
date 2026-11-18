// 帳號綁定：登入只是取得同一組 pid／同一包雲端存檔的長期鑰匙。
// 不綁也能玩；這台登出只撤銷憑證，本機進度和 pid 都留著。

import { cloudFlush } from './cloudSync';
import { readOysterAuth, canonicalReturnUrl, stripOysterAuthFromUrl } from './authReturn';
import { parseEnabledProviders, parseLinkedProviders, providerName, providerKind, isLikelyEmail, type AuthLink } from './authProviders';

const API = 'https://game-status.gwtech.org/s';
const TOKEN_KEY = 'oyster-auth-token';
const WAIT_KEY = 'oyster-auth-wait';
const STARTED_KEY = 'oyster-auth-started';
const INTENT_KEY = 'oyster-auth-intent';
const HANDLED_KEY = 'oyster-auth-handled';
const WAIT_POLL_MS = 1500;
const WAIT_GIVE_UP_MS = 10 * 60 * 1000;

export type AuthLS = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem?: (k: string) => void;
};

export type SaveSummary = {
  pid?: string;
  nick?: string;
  tag?: string;
  money?: number;
  days?: number;
  ts?: number;
  hasSave?: boolean;
  data?: Record<string, unknown> | null;
  rev?: number;
};

type ExchangeOk = {
  ok: true;
  token: string;
  provider: string;
  mode: string;
  bound: boolean;
  pid: string | null;
  startPid: string | null;
};

export type AuthBootOpts = {
  onSafariHint?: () => void;
  onConflict?: (cloud: SaveSummary, device: SaveSummary) => void;
  applyCloud?: (data: Record<string, string>, rev: number, newPid: string) => void;
  onMessage?: (msg: string) => void;
};

let pid = '';
let LS: AuthLS;
let configured = false;
let bound = false;
let provider = '';
let enabledProviders: string[] = [];
let links: AuthLink[] = [];
let listeners: Array<() => void> = [];
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollStartedAt = 0;
let booting = false;
let lastOpts: AuthBootOpts = {};
let lastMsg = '';
let pollVisBound = false;
const handledIds = new Set<string>();

const notify = () => { for (const f of listeners) try { f(); } catch { /* */ } };

// 模組一載入就先把回跳票證抄下來，免得之後其他程式改掉網址。
const capturedReturn = typeof location !== 'undefined' ? readOysterAuth(location.href) : { code: '', err: '' };
let choicePending = false;
export const authChoicePending = () => choicePending;
export function setAuthChoicePending(v: boolean) { choicePending = v; }


export const authConfigured = () => configured;
export const authBound = () => bound;
export const authProvider = () => provider;
export const authEnabledProviders = () => enabledProviders.slice();
export const authLinks = () => links.slice();

function labelOf(id?: string | null): string {
  return providerName(id || provider || 'google');
}

function rememberLink(id: string) {
  if (!id) return;
  if (!links.some((l) => l.provider === id)) links = [...links, { provider: id }];
}
export const authToken = () => {
  try { return LS?.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
export const onAuthChange = (f: () => void) => {
  listeners.push(f);
  f();
  return () => { listeners = listeners.filter(x => x !== f); };
};

export function authInit(playerId: string, ls: AuthLS) {
  pid = playerId;
  LS = ls;
}

export function setAuthBootOpts(opts: AuthBootOpts) {
  lastOpts = { ...lastOpts, ...opts };
}

function tellOnce(opts: AuthBootOpts, key: string, msg: string) {
  const sk = 'oyster-auth-msg:' + key;
  try {
    if (sessionStorage.getItem(sk)) return;
    sessionStorage.setItem(sk, '1');
  } catch { /* */ }
  if (lastMsg === msg) return;
  lastMsg = msg;
  opts.onMessage?.(msg);
}

function alreadyHandled(id: string) {
  if (!id) return false;
  if (handledIds.has(id)) return true;
  try {
    if (sessionStorage.getItem(HANDLED_KEY) === id) return true;
  } catch { /* */ }
  return false;
}

function markHandled(id: string) {
  if (!id) return;
  handledIds.add(id);
  try {
    sessionStorage.setItem(HANDLED_KEY, id);
    LS.setItem(HANDLED_KEY, id);
  } catch { /* */ }
}

function clearLoginPending() {
  try { LS.removeItem?.(WAIT_KEY); } catch { /* */ }
  try { LS.removeItem?.(INTENT_KEY); } catch { /* */ }
  try { sessionStorage.removeItem(STARTED_KEY); } catch { /* */ }
}

function startedInThisContext() {
  try { if (sessionStorage.getItem(STARTED_KEY)) return true; } catch { /* */ }
  try { if (LS.getItem(INTENT_KEY)) return true; } catch { /* */ }
  return false;
}

export function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || !!(navigator as Navigator & { standalone?: boolean }).standalone;
}

export function isIosDevice() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function returnUrl() {
  return canonicalReturnUrl(location.href);
}

function setToken(t: string) {
  try { LS.setItem(TOKEN_KEY, t); } catch { /* */ }
}

function clearLocalAuth() {
  try { LS.removeItem?.(TOKEN_KEY); } catch { /* */ }
  try { LS.removeItem?.(WAIT_KEY); } catch { /* */ }
  try { LS.removeItem?.(INTENT_KEY); } catch { /* */ }
  try { sessionStorage.removeItem(STARTED_KEY); } catch { /* */ }
  bound = false;
  provider = '';
  links = [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJson(r: Response): Promise<any> {
  try { return await r.json(); } catch { return {}; }
}

export async function refreshAuthStatus(): Promise<void> {
  try {
    const r = await fetch(`${API}/auth/status`, { mode: 'cors', cache: 'no-store' });
    const j = await readJson(r);
    enabledProviders = parseEnabledProviders(j);
    configured = !!(r.ok && j && j.err !== 'not_configured' && enabledProviders.length > 0);
  } catch {
    configured = false;
    enabledProviders = [];
  }
  const token = authToken();
  if (!token) {
    bound = false;
    provider = '';
    links = [];
    notify();
    return;
  }
  try {
    const r = await fetch(`${API}/auth/me`, {
      mode: 'cors', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token },
    });
    const j = await readJson(r);
    if (r.ok && j?.ok) {
      bound = !!j.bound;
      provider = String(j.provider || '');
      links = parseLinkedProviders(j);
      if (bound && links.length === 0 && provider) links = [{ provider }];
    } else if (r.status === 401 || j?.err === 'auth') {
      clearLocalAuth();
    }
  } catch { /* 暫時連不上就維持現況 */ }
  notify();
}

export async function startProvider(id: string, mode: 'bind' | 'restore', opts?: AuthBootOpts): Promise<{ ok: true } | { ok: false; err: string }> {
  if (opts) setAuthBootOpts(opts);
  await refreshAuthStatus();
  const name = labelOf(id);
  if (!configured || !enabledProviders.includes(id)) return { ok: false, err: `還沒開放${name}綁定` };
  if (providerKind(id) === 'code') return { ok: false, err: `請在設定裡輸入 ${name} 和驗證碼` };
  const wait = crypto.randomUUID();
  try {
    LS.setItem(WAIT_KEY, wait);
    LS.setItem(INTENT_KEY, mode);
    sessionStorage.setItem(STARTED_KEY, mode);
  } catch { /* */ }
  // 先開始輪詢，iOS 主畫面 App 跳去 Safari 後回來才接得到票。
  startWaitPoll(lastOpts);
  const url = `${API}/auth/${encodeURIComponent(id)}/start?mode=${encodeURIComponent(mode)}`
    + `&return=${encodeURIComponent(returnUrl())}`
    + `&pid=${encodeURIComponent(pid)}`
    + `&wait=${encodeURIComponent(wait)}`;
  location.href = url;
  return { ok: true };
}

export async function startGoogle(mode: 'bind' | 'restore', opts?: AuthBootOpts): Promise<{ ok: true } | { ok: false; err: string }> {
  return startProvider('google', mode, opts);
}

function emailErr(err: string, retryAfter?: number): string {
  switch (err) {
    case 'bad_email': return '請輸入正確的 Email';
    case 'cooldown': return `請稍候再寄${retryAfter ? `（還要 ${retryAfter} 秒）` : ''}`;
    case 'rate': return '寄太多次了，請稍後再試';
    case 'send_failed': return '信沒有寄出，請稍後再試';
    case 'not_configured': return '還沒開放 Email 綁定';
    case 'bad_code': return '驗證碼不對，請再試一次';
    case 'expired': return '驗證碼已過期，請重新寄一組';
    case 'too_many': return '試太多次了，請重新寄一組驗證碼';
    default: return '沒有成功，請稍後再試';
  }
}

export async function requestEmailCode(email: string, mode: 'bind' | 'restore'): Promise<{ ok: true; retryAfter: number; hint: string } | { ok: false; err: string; retryAfter?: number }> {
  if (!isLikelyEmail(email)) return { ok: false, err: '請輸入正確的 Email' };
  try {
    const r = await fetch(`${API}/auth/email/start`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ email: email.trim(), mode, pid }),
    });
    if (r.status === 429) return { ok: false, err: '寄太多次了，請稍後再試' };
    const j = await readJson(r);
    if (j?.ok) return { ok: true, retryAfter: Number(j.retryAfter) || 60, hint: String(j.hint || '') };
    const retryAfter = Number(j?.retryAfter) || undefined;
    return { ok: false, err: emailErr(String(j?.err || 'fail'), retryAfter), retryAfter };
  } catch {
    return { ok: false, err: '連線失敗' };
  }
}

export async function verifyEmailCode(email: string, code: string, mode: 'bind' | 'restore', opts?: AuthBootOpts): Promise<{ ok: true } | { ok: false; err: string }> {
  if (opts) setAuthBootOpts(opts);
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length !== 6) return { ok: false, err: '請輸入 6 位數驗證碼' };
  if (!isLikelyEmail(email)) return { ok: false, err: '請輸入正確的 Email' };
  try {
    const r = await fetch(`${API}/auth/email/verify`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ email: email.trim(), code: digits, mode, pid }),
    });
    if (r.status === 429) return { ok: false, err: '試太多次了，請稍後再試' };
    const j = await readJson(r);
    if (!r.ok || !j?.ok || !j.token) return { ok: false, err: emailErr(String(j?.err || 'fail')) };
    const ex: ExchangeOk = {
      ok: true,
      token: String(j.token),
      provider: String(j.provider || 'email'),
      mode: String(j.mode || mode),
      bound: !!j.bound,
      pid: j.pid ? String(j.pid) : null,
      startPid: j.startPid ? String(j.startPid) : null,
    };
    setToken(ex.token);
    await finishLogin(ex, lastOpts, false);
    return { ok: true };
  } catch {
    return { ok: false, err: '連線失敗' };
  }
}

async function exchange(body: { code?: string; wait?: string }): Promise<ExchangeOk | { ok: false; err: string }> {
  try {
    const r = await fetch(`${API}/auth/exchange`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
    const j = await readJson(r);
    if (!r.ok || !j?.ok || !j.token) return { ok: false, err: String(j?.err || 'fail') };
    return {
      ok: true,
      token: String(j.token),
      provider: String(j.provider || 'google'),
      mode: String(j.mode || ''),
      bound: !!j.bound,
      pid: j.pid ? String(j.pid) : null,
      startPid: j.startPid ? String(j.startPid) : null,
    };
  } catch {
    return { ok: false, err: 'offline' };
  }
}

async function postAuth(path: string, body: Record<string, unknown>) {
  const token = authToken();
  const r = await fetch(`${API}${path}`, {
    method: 'POST', mode: 'cors',
    headers: {
      'Content-Type': 'text/plain',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });
  const j = await readJson(r);
  return { status: r.status, j };
}

export function summaryLines(s: SaveSummary | null | undefined): string {
  if (!s) return '沒有存檔資料';
  const nick = (s.nick || '').trim() || '還沒取名字';
  const tag = (s.tag || '').trim();
  const hash = tag ? (tag.startsWith('#') ? tag : '#' + tag) : '';
  const money = Number(s.money) || 0;
  const days = Number(s.days) || 0;
  const ts = Number(s.ts) || 0;
  const when = ts > 0
    ? new Date(ts).toLocaleString('zh-Hant-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
    : '尚未同步';
  return `${nick}${hash ? ' ' + hash : ''}\n錢：${money.toLocaleString('zh-Hant-TW')}\n天數：${days} 天\n上次同步：${when}`;
}

export function asCloudMap(data: unknown): Record<string, string> {
  const o: Record<string, string> = {};
  if (!data || typeof data !== 'object') return o;
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (typeof v === 'string') o[k] = v;
    else if (v != null) o[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return o;
}

async function finishLogin(ex: ExchangeOk, opts: AuthBootOpts, bounce = false): Promise<boolean> {
  const mode = ex.mode === 'restore' ? 'restore' : 'bind';
  // Safari 回跳頁必須用登入當下帶去的 pid，不能用這個分頁自己的匿名 pid。
  const bindPid = bounce ? (ex.startPid || '') : (pid || ex.startPid || '');
  const markBound = (boundPid?: string) => {
    bound = true;
    provider = ex.provider || 'google';
    rememberLink(provider);
    notify();
    if (!bounce) tellOnce(opts, 'bound:' + ex.token, `已綁定${labelOf(ex.provider)}，換裝置也可以用它取回進度。`);
    // 綁定後立刻上傳，否則之後寫入要帶憑證，雲端可能是空的，另一台取回就沒資料。
    if (!bounce && (!boundPid || !pid || boundPid === pid)) void cloudFlush();
  };
  try {
    if (mode === 'bind') {
      if (ex.bound && ex.pid && (!bindPid || ex.pid === bindPid)) {
        markBound(ex.pid);
        return false;
      }
      if (!bindPid) {
        if (!bounce) tellOnce(opts, 'bindfail:' + ex.token, '綁定沒有成功，請稍後再試');
        return false;
      }
      const { j } = await postAuth('/auth/bind', { pid: bindPid });
      if (j?.err === 'conflict') {
        if (!bounce) {
          choicePending = true;
          opts.onConflict?.(j.cloud as SaveSummary, j.device as SaveSummary);
          tellOnce(opts, 'conflict:' + ex.token, `這個${labelOf(ex.provider)}已有另一份進度，請選要留哪一份。`);
        }
        return false;
      }
      if (j?.ok) { markBound(bindPid); return false; }
      if (!bounce) tellOnce(opts, 'bindfail:' + ex.token, j?.err === 'not_configured' ? `還沒開放${labelOf(ex.provider)}綁定` : '綁定沒有成功，請稍後再試');
      return false;
    }
    const { j } = await postAuth('/auth/restore', { pid: bindPid || pid || undefined });
    if (j?.err === 'conflict') {
      if (!bounce) {
        choicePending = true;
        opts.onConflict?.(j.cloud as SaveSummary, j.device as SaveSummary);
        tellOnce(opts, 'conflict:' + ex.token, `這個${labelOf(ex.provider)}已有另一份進度，請選要留哪一份。`);
      }
      return false;
    }
    if (j?.err === 'not_linked') {
      // 取回絕不能改綁這台新的空進度，否則原本那台的綁定會被蓋掉。
      if (!bounce) tellOnce(opts, 'notlinked:' + ex.token, `這個${labelOf(ex.provider)}還沒綁過進度。請先在原本有進度的那台確認「已綁定：${labelOf(ex.provider)}」且同步成功，再回這台取回。`);
      return false;
    }
    if (j?.ok && j.cloud?.data && !bounce) {
      const newPid = String(j.pid || j.cloud.pid || '');
      opts.applyCloud?.(asCloudMap(j.cloud.data), Number(j.cloud.rev) || 0, newPid);
      return true;
    }
    if (j?.ok) {
      bound = true;
      provider = ex.provider || 'google';
      rememberLink(provider);
      notify();
      if (!bounce && !j.cloud?.data) tellOnce(opts, 'empty:' + ex.token, '已取回綁定，但雲端還沒有這份存檔。請先回原本那台打開遊戲，確認同步成功後再試一次。');
      return false;
    }
    if (!bounce) tellOnce(opts, 'restorefail:' + ex.token, '取回進度沒有成功，請稍後再試');
  } finally {
    await refreshAuthStatus();
  }
  return false;
}

function stopPoll() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

async function runPollTick() {
  const wait = (() => { try { return LS.getItem(WAIT_KEY) || ''; } catch { return ''; } })();
  if (!wait) { stopPoll(); return; }
  if (pollStartedAt && Date.now() - pollStartedAt > WAIT_GIVE_UP_MS) {
    try { LS.removeItem?.(WAIT_KEY); LS.removeItem?.(INTENT_KEY); } catch { /* */ }
    stopPoll();
    tellOnce(lastOpts, 'timeout', '登入逾時，請再試一次。');
    return;
  }
  const ex = await exchange({ wait });
  if (ex.ok) {
    setToken(ex.token);
    clearLoginPending();
    stopPoll();
    if (!alreadyHandled(ex.token)) {
      markHandled(ex.token);
      const reloading = await finishLogin(ex, lastOpts);
      if (!reloading) notify();
    } else {
      notify();
    }
    return;
  }
  pollTimer = setTimeout(() => { void runPollTick(); }, WAIT_POLL_MS);
}

function startWaitPoll(opts: AuthBootOpts) {
  setAuthBootOpts(opts);
  stopPoll();
  pollStartedAt = Date.now();
  pollTimer = setTimeout(() => { void runPollTick(); }, WAIT_POLL_MS);
  if (pollVisBound) return;
  pollVisBound = true;
  const onVis = () => { if (!document.hidden) void runPollTick(); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pageshow', onVis);
  addEventListener('focus', onVis);
}

export async function authBoot(opts: AuthBootOpts = {}): Promise<boolean> {
  if (booting) return false;
  booting = true;
  setAuthBootOpts(opts);
  await refreshAuthStatus();
  const got = capturedReturn.code || capturedReturn.err
    ? capturedReturn
    : readOysterAuth(location.href);
  const code = got.code;
  const returnErr = got.err;
  if (code || returnErr) {
    try { history.replaceState(null, '', stripOysterAuthFromUrl(location.href)); } catch { /* */ }
    if (returnErr && !code) {
      if (!( !startedInThisContext() && isIosDevice() && !isStandaloneApp() )) {
        tellOnce(opts, 'denied:' + returnErr, returnErr === 'denied' ? '沒有完成登入。請再試一次。' : '登入沒有成功，請稍後再試。');
      }
      booting = false;
      return false;
    }
    const bounce = !startedInThisContext() && isIosDevice() && !isStandaloneApp();
    const ex = await exchange({ code });
    if (ex.ok) setToken(ex.token);
    if (bounce) opts.onSafariHint?.();
    if (ex.ok) {
      // 回跳頁也要用 startPid 完成綁定；套用存檔只在原本的 App／分頁做。
      if (!alreadyHandled(ex.token)) {
        markHandled(ex.token);
        const reloading = await finishLogin(ex, opts, bounce);
        if (!bounce) clearLoginPending();
        booting = false;
        return bounce ? false : reloading;
      }
      if (!bounce) {
        clearLoginPending();
        tellOnce(opts, 'handled:' + ex.token, '登入已處理過。若進度沒有回來，請再開一次設定，或再按一次「取回進度」。');
      }
      booting = false;
      return false;
    }
    if (!bounce) tellOnce(opts, 'nocomplete', '登入沒有完成，請再試一次。');
    booting = false;
    return false;
  }
  let wait = '';
  try { wait = LS.getItem(WAIT_KEY) || ''; } catch { /* */ }
  if (wait) {
    const ex = await exchange({ wait });
    if (ex.ok) {
      setToken(ex.token);
      clearLoginPending();
      if (!alreadyHandled(ex.token)) {
        markHandled(ex.token);
        const reloading = await finishLogin(ex, opts);
        booting = false;
        return reloading;
      }
      booting = false;
      return false;
    }
    startWaitPoll(opts);
  } else {
    let intent = '';
    try { intent = LS.getItem(INTENT_KEY) || sessionStorage.getItem(STARTED_KEY) || ''; } catch { /* */ }
    if (intent === 'restore') {
      tellOnce(opts, 'nostart', '登入回來了，但這頁沒有收到憑證。請再按一次「取回進度」。');
    }
  }
  booting = false;
  return false;
}

export async function chooseKeepCloud(opts: AuthBootOpts): Promise<boolean> {
  try {
    const { j } = await postAuth('/auth/choose', { choice: 'cloud', pid });
    if (j?.ok && j.cloud?.data) {
      opts.applyCloud?.(asCloudMap(j.cloud.data), Number(j.cloud.rev) || 0, String(j.pid || j.cloud.pid || ''));
      return true;
    }
    if (j?.ok) {
      bound = true;
      notify();
      return false;
    }
    opts.onMessage?.('沒有套用成功，請稍後再試');
  } catch {
    opts.onMessage?.('連線失敗');
  }
  await refreshAuthStatus();
  return false;
}

export async function chooseKeepDevice(opts: AuthBootOpts): Promise<boolean> {
  try {
    const { j } = await postAuth('/auth/choose', { choice: 'device', pid });
    if (j?.ok) {
      bound = true;
      if (!provider) provider = 'google';
      rememberLink(provider);
      notify();
      opts.onMessage?.('已改綁到這台的進度。原本雲端那份還在，可用同步碼取回。');
      return false;
    }
    opts.onMessage?.('沒有改綁成功，請稍後再試');
  } catch {
    opts.onMessage?.('連線失敗');
  }
  await refreshAuthStatus();
  return false;
}

export async function logoutThisDevice(): Promise<{ ok: true } | { ok: false; err: string }> {
  try {
    if (authToken()) await postAuth('/auth/logout', {});
  } catch { /* 仍清本機憑證 */ }
  clearLocalAuth();
  notify();
  return { ok: true };
}

export async function unbindAccount(providerId?: string): Promise<{ ok: true } | { ok: false; err: string }> {
  try {
    const body = providerId ? { provider: providerId } : {};
    const { j, status } = await postAuth('/auth/unbind', body);
    if (!j?.ok && status !== 401) return { ok: false, err: '解除綁定失敗，請稍後再試' };
  } catch {
    return { ok: false, err: '連線失敗' };
  }
  await refreshAuthStatus();
  return { ok: true };
}
