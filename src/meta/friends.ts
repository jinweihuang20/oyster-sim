/**
 * 好友系統：申請／接受、列表（上線／位置）、私訊 API（UI 本版隱藏）。
 */
import { $ } from '../ui';
import { myTag } from './social';

const API = import.meta.env.DEV ? 'http://127.0.0.1:8787/s' : 'https://game-status.gwtech.org/s';
/** 私訊本版實作但隱藏入口 */
export const FRIENDS_DM_ENABLED = false;

type Deps = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string, sec?: number, place?: 'mid' | 'top') => void;
  presenceWhere: () => string;
};

let D: Deps;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export type FriendRow = {
  k: string; nick: string; tag: string; online: boolean; shucking?: boolean;
  where?: string | null; whereZh?: string; since?: number;
};
export type FriendReq = { id: number; k: string; nick: string; tag: string; online?: boolean; whereZh?: string; ts: number };

let cache: { friends: FriendRow[]; incoming: FriendReq[]; outgoing: FriendReq[]; at: number } | null = null;
let idSet = { ks: new Set<string>(), tags: new Set<string>(), at: 0 };
/** 已送出、尚在等對方接受的 k；對方接受後從名單消失並變成好友 → 紅點 */
let watchOutgoing = new Set<string>();
let acceptedPing = false;
const outWatchKey = () => `oyster-fr-watch:${D?.id || ''}`;
const pingKey = () => `oyster-fr-ping:${D?.id || ''}`;

function loadWatchOutgoing() {
  try {
    const raw = JSON.parse(localStorage.getItem(outWatchKey()) || '[]');
    watchOutgoing = new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch { watchOutgoing = new Set(); }
  try { acceptedPing = localStorage.getItem(pingKey()) === '1'; } catch { acceptedPing = false; }
}
function saveWatchOutgoing() {
  try { localStorage.setItem(outWatchKey(), JSON.stringify([...watchOutgoing])); } catch { /* */ }
}
function saveAcceptedPing() {
  try {
    if (acceptedPing) localStorage.setItem(pingKey(), '1');
    else localStorage.removeItem(pingKey());
  } catch { /* */ }
}

function noteFriendList(friends: FriendRow[], outgoing: FriendReq[]) {
  for (const o of outgoing) watchOutgoing.add(o.k);
  let hit = false;
  for (const f of friends) {
    if (watchOutgoing.has(f.k)) {
      hit = true;
      watchOutgoing.delete(f.k);
    }
  }
  if (hit) acceptedPing = true;
  saveWatchOutgoing();
  saveAcceptedPing();
}

const get = (p: string) => fetch(API + p, { mode: 'cors', cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
async function post(p: string, data: object) {
  try {
    const r = await fetch(API + p, {
      method: 'POST',
      body: JSON.stringify({ pid: D.id, ...data }),
      headers: { 'Content-Type': 'text/plain' },
      mode: 'cors',
    });
    const j = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, j };
  } catch { return { ok: false, status: 0, j: null as any }; }
}

export function isFriendTag(tag?: string | null) {
  if (!tag) return false;
  return idSet.tags.has(String(tag).replace(/^#/, ''));
}
export function isFriendK(k?: string | null) {
  return !!k && idSet.ks.has(k.toLowerCase());
}
export function friendMark(tag?: string | null, k?: string | null) {
  return isFriendTag(tag) || isFriendK(k) ? '（好友）' : '';
}

export async function refreshFriendIds(force = false) {
  if (!D?.id) return idSet;
  if (!force && Date.now() - idSet.at < 20_000) return idSet;
  const j = await get(`/friends/ids?pid=${encodeURIComponent(D.id)}`);
  if (j && Array.isArray(j.ks)) {
    idSet = {
      ks: new Set((j.ks as string[]).map(x => String(x).toLowerCase())),
      tags: new Set((j.tags as string[]).map(x => String(x).replace(/^#/, ''))),
      at: Date.now(),
    };
  }
  return idSet;
}

export async function loadFriends(force = false) {
  if (!force && cache && Date.now() - cache.at < 8_000) return cache;
  const j = await get(`/friends?pid=${encodeURIComponent(D.id)}`);
  if (!j) return cache;
  cache = {
    friends: Array.isArray(j.friends) ? j.friends : [],
    incoming: Array.isArray(j.incoming) ? j.incoming : [],
    outgoing: Array.isArray(j.outgoing) ? j.outgoing : [],
    at: Date.now(),
  };
  idSet = {
    ks: new Set(cache.friends.map(f => f.k.toLowerCase())),
    tags: new Set(cache.friends.map(f => String(f.tag || '').replace(/^#/, '')).filter(Boolean)),
    at: Date.now(),
  };
  noteFriendList(cache.friends, cache.outgoing);
  syncDot();
  return cache;
}

export function incomingCount() { return cache?.incoming.length ?? 0; }

function syncDot() {
  const btn = document.getElementById('oFriends');
  if (!btn) return;
  const show = incomingCount() > 0 || acceptedPing;
  btn.classList.toggle('hasReq', show);
  const dot = btn.querySelector('.frDot') as HTMLElement | null;
  if (dot) dot.removeAttribute('style');
}

function clearFriendDot() {
  acceptedPing = false;
  saveAcceptedPing();
  syncDot();
}

const errZh: Record<string, string> = {
  not_found: '找不到這位玩家',
  self: '不能加自己',
  already: '已經是好友了',
  pending: '已經送過申請了',
  full: '好友人數已滿',
  their_full: '對方好友已滿',
  pending_full: '待處理申請太多',
  no_request: '沒有這份申請',
  not_friend: '還不是好友',
  empty: '內容空白',
};

export async function requestFriend(target: string): Promise<boolean> {
  const t = target.trim();
  if (!t) { D.toast('請輸入玩家號碼', '#ff8a7a', 2.5, 'top'); return false; }
  const { ok, j } = await post('/friends/request', { target: t });
  if (ok && j?.ok) {
    await loadFriends(true);
    D.toast(
      j.accepted
        ? `已和 ${j.nick || ''}#${j.tag || ''} 成為好友`
        : `已向 ${j.nick || ''}#${j.tag || ''} 送出好友申請`,
      '#9be37a',
      3,
      'top',
    );
    return true;
  }
  D.toast(errZh[j?.error] || '申請失敗，稍後再試', '#ff8a7a', 3, 'top');
  return false;
}

export async function acceptFriend(k: string) {
  const { ok, j } = await post('/friends/accept', { k });
  if (ok && j?.ok) {
    D.toast(`已和 ${j.nick || ''}#${j.tag || ''} 成為好友`, '#9be37a', 3, 'top');
    await loadFriends(true);
    return true;
  }
  D.toast(errZh[j?.error] || '接受失敗', '#ff8a7a', 3, 'top');
  return false;
}

export async function declineFriend(k: string) {
  const { ok } = await post('/friends/decline', { k });
  if (ok) { D.toast('已拒絕／取消', '#ffd76a', 2.5, 'top'); await loadFriends(true); return true; }
  D.toast('操作失敗', '#ff8a7a', 3, 'top');
  return false;
}

export async function removeFriend(k: string, label: string) {
  if (!confirm(`確定要解除和 ${label} 的好友？`)) return false;
  const { ok } = await post('/friends/remove', { k });
  if (ok) { D.toast('已解除好友', '#ffd76a', 2.5, 'top'); await loadFriends(true); return true; }
  D.toast('解除失敗', '#ff8a7a', 3, 'top');
  return false;
}

/** 排行榜／廣場：依目前關係顯示加好友按鈕狀態 */
export function relationOf(k?: string | null, tag?: string | null): 'self' | 'friend' | 'out' | 'in' | 'none' {
  if (!k && !tag) return 'none';
  if (tag && myTag() && String(tag).replace(/^#/, '') === myTag()) return 'self';
  if (isFriendK(k) || isFriendTag(tag)) return 'friend';
  if (k && cache?.outgoing.some(x => x.k === k)) return 'out';
  if (tag && cache?.outgoing.some(x => x.tag === String(tag).replace(/^#/, ''))) return 'out';
  if (k && cache?.incoming.some(x => x.k === k)) return 'in';
  if (tag && cache?.incoming.some(x => x.tag === String(tag).replace(/^#/, ''))) return 'in';
  return 'none';
}

export function friendActionBtn(k: string, tag?: string, nick?: string) {
  const rel = relationOf(k, tag);
  if (rel === 'self') return '';
  if (rel === 'friend') return `<span class="frBadge">好友</span>`;
  if (rel === 'out') return `<span class="frBadge dim">已申請</span>`;
  if (rel === 'in') {
    const ik = k || cache?.incoming.find(x => x.tag === String(tag || '').replace(/^#/, ''))?.k || '';
    return ik ? `<button type="button" class="frAct" data-fr-accept="${esc(ik)}">接受</button>` : '';
  }
  const target = tag ? `#${String(tag).replace(/^#/, '')}` : k;
  if (!target) return '';
  return `<button type="button" class="frAct" data-fr-add="${esc(target)}" data-fr-nick="${esc(nick || '')}">加好友</button>`;
}

function paintPanel() {
  const body = document.getElementById('friendsBody');
  if (!body || !cache) return;
  const { friends, incoming, outgoing } = cache;
  const dmHidden = FRIENDS_DM_ENABLED ? '' : ' hidden';
  body.innerHTML = `
    <div class="frAdd">
      <input id="frTarget" type="text" maxlength="16" placeholder="輸入 #號碼 加好友" enterkeyhint="send">
      <button type="button" id="frAddBtn" class="frPrimary">申請</button>
    </div>
    ${incoming.length ? `<div class="frSec">待你接受（${incoming.length}）</div>
      ${incoming.map(r => `<div class="frCard">
        <div class="frWho"><b>${esc(r.nick)}</b><small>#${esc(r.tag)}</small>
          <span class="frLoc">${r.online ? esc(r.whereZh || '線上') : '離線'}</span></div>
        <div class="frActs">
          <button type="button" data-fr-accept="${esc(r.k)}">接受</button>
          <button type="button" data-fr-decline="${esc(r.k)}">拒絕</button>
        </div></div>`).join('')}` : ''}
    ${outgoing.length ? `<div class="frSec">已送出（${outgoing.length}）</div>
      ${outgoing.map(r => `<div class="frCard dim">
        <div class="frWho"><b>${esc(r.nick)}</b><small>#${esc(r.tag)}</small></div>
        <div class="frActs"><button type="button" data-fr-decline="${esc(r.k)}">取消</button></div>
      </div>`).join('')}` : ''}
    <div class="frSec">好友（${friends.length}）</div>
    ${friends.length ? friends.map(f => `<div class="frCard">
      <div class="frWho">
        <span class="frDotLive${f.online ? ' on' : ''}"></span>
        <b>${esc(f.nick)}</b><small>#${esc(f.tag)}</small>
        <span class="frLoc">${f.online ? esc(f.whereZh || '線上') : '離線'}</span>
      </div>
      <div class="frActs">
        <button type="button" class="frDm${dmHidden}" data-fr-dm="${esc(f.k)}" data-fr-name="${esc(f.nick)}#${esc(f.tag)}" ${FRIENDS_DM_ENABLED ? '' : 'tabindex="-1" aria-hidden="true"'}>私訊</button>
        <button type="button" data-fr-remove="${esc(f.k)}" data-fr-label="${esc(f.nick)}#${esc(f.tag)}">解除</button>
      </div>
    </div>`).join('') : '<p class="frEmpty">還沒有好友。到排行榜或廣場找人加吧。</p>'}
    <div id="frDmBox" class="frDmBox${dmHidden}" hidden>
      <div class="frDmHead"><button type="button" id="frDmBack">←</button><b id="frDmTitle">私訊</b></div>
      <div id="frDmList" class="frDmList"></div>
      <div class="frDmSend"><input id="frDmIn" maxlength="200" placeholder="說點什麼…"><button type="button" id="frDmGo">送</button></div>
    </div>`;

  (document.getElementById('frAddBtn') as HTMLButtonElement | null)?.addEventListener('click', async () => {
    const v = (document.getElementById('frTarget') as HTMLInputElement).value;
    if (await requestFriend(v)) {
      (document.getElementById('frTarget') as HTMLInputElement).value = '';
      paintPanel();
    }
  });
  document.getElementById('frTarget')?.addEventListener('keydown', e => {
    if ((e as KeyboardEvent).key === 'Enter') (document.getElementById('frAddBtn') as HTMLButtonElement)?.click();
  });
  body.querySelectorAll('[data-fr-accept]').forEach(b => b.addEventListener('click', async () => {
    if (await acceptFriend((b as HTMLElement).dataset.frAccept!)) paintPanel();
  }));
  body.querySelectorAll('[data-fr-decline]').forEach(b => b.addEventListener('click', async () => {
    if (await declineFriend((b as HTMLElement).dataset.frDecline!)) paintPanel();
  }));
  body.querySelectorAll('[data-fr-remove]').forEach(b => b.addEventListener('click', async () => {
    const el = b as HTMLElement;
    if (await removeFriend(el.dataset.frRemove!, el.dataset.frLabel || '')) paintPanel();
  }));
  if (FRIENDS_DM_ENABLED) {
    body.querySelectorAll('[data-fr-dm]').forEach(b => b.addEventListener('click', () => {
      const el = b as HTMLElement;
      void openDm(el.dataset.frDm!, el.dataset.frName || '');
    }));
  }
}

let dmWith = '';
async function openDm(k: string, title: string) {
  if (!FRIENDS_DM_ENABLED) return;
  dmWith = k;
  const box = document.getElementById('frDmBox');
  if (!box) return;
  box.hidden = false;
  (document.getElementById('frDmTitle') as HTMLElement).textContent = title;
  const list = document.getElementById('frDmList')!;
  list.innerHTML = '<p class="frEmpty">讀取中…</p>';
  const j = await get(`/friends/dm?pid=${encodeURIComponent(D.id)}&with=${encodeURIComponent(k)}`);
  const msgs = j?.messages || [];
  list.innerHTML = msgs.length
    ? msgs.map((m: any) => `<div class="frDmMsg${m.mine ? ' mine' : ''}"><span>${esc(m.text)}</span></div>`).join('')
    : '<p class="frEmpty">跟好友打聲招呼吧</p>';
  list.scrollTop = list.scrollHeight;
  document.getElementById('frDmBack')!.onclick = () => { box.hidden = true; dmWith = ''; };
  document.getElementById('frDmGo')!.onclick = async () => {
    const inp = document.getElementById('frDmIn') as HTMLInputElement;
    const text = inp.value.trim();
    if (!text || !dmWith) return;
    const { ok, j: r } = await post('/friends/dm', { to: dmWith, text });
    if (ok && r?.ok) { inp.value = ''; void openDm(dmWith, title); }
    else D.toast(errZh[r?.error] || '送出失敗', '#ff8a7a', 3, 'top');
  };
}

export async function openFriends() {
  $('friends').classList.add('show');
  const body = document.getElementById('friendsBody');
  if (body) body.innerHTML = '<p class="frEmpty">讀取中…</p>';
  await loadFriends(true);
  // 「被接受」看過就清；待接受邀請仍維持紅點直到處理完
  clearFriendDot();
  paintPanel();
  syncDot();
}

export function closeFriends() { $('friends').classList.remove('show'); }

/** 委派：排行榜／廣場上的加好友按鈕 */
export function bindFriendActions(root: ParentNode, onChange?: () => void) {
  root.querySelectorAll<HTMLElement>('[data-fr-add]').forEach(b => {
    if ((b as any)._frBound) return;
    (b as any)._frBound = true;
    b.addEventListener('click', async e => {
      e.stopPropagation();
      const target = b.dataset.frAdd!;
      if (await requestFriend(target)) {
        const span = document.createElement('span');
        const accepted = isFriendTag(target.replace(/^#/, '')) || isFriendK(target);
        span.className = accepted ? 'frBadge' : 'frBadge dim';
        span.textContent = accepted ? '好友' : '已申請';
        b.replaceWith(span);
        onChange?.();
      }
    });
  });
  root.querySelectorAll<HTMLElement>('[data-fr-accept]').forEach(b => {
    if ((b as any)._frBound) return;
    (b as any)._frBound = true;
    b.addEventListener('click', async e => {
      e.stopPropagation();
      if (await acceptFriend(b.dataset.frAccept!)) {
        const span = document.createElement('span');
        span.className = 'frBadge';
        span.textContent = '好友';
        b.replaceWith(span);
        onChange?.();
      }
    });
  });
}

export function initFriends(d: Deps) {
  D = d;
  loadWatchOutgoing();
  document.getElementById('oFriends')?.addEventListener('click', () => void openFriends());
  document.getElementById('friendsClose')?.addEventListener('click', () => closeFriends());
  void refreshFriendIds(true);
  void loadFriends(true);
  setInterval(() => { if (!document.hidden) void refreshFriendIds(true); }, 45_000);
  setInterval(() => {
    if (document.hidden) return;
    if (document.getElementById('friends')?.classList.contains('show')) void loadFriends(true).then(() => { paintPanel(); syncDot(); });
    else void loadFriends(true);
  }, 12_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void loadFriends(true);
  });
}
