import { loadFriends, type FriendRow } from '../meta/friends';
import {
  partyAcceptInvite, partyDeclineInvite, partyInviteFriend, partyListInvites,
} from './hubClient';
import {
  PARTY_CAPACITY, partyInviteUrl, partyZhErr, normPartySnap,
  type PartyInvite, type PartySnap,
} from './types';

export type PartyHooks = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string, sec?: number, place?: 'mid' | 'top') => void;
  audio: () => void;
  canEnter: () => boolean;
  /** 已在廣場／對局中時 deep link 提示 */
  busyToast?: () => void;
  enterParty: (opts: { code?: string; create?: boolean }) => void;
  leaveParty: () => void;
};

let hooks: PartyHooks | null = null;
let modal: HTMLElement | null = null;
let hud: HTMLElement | null = null;
let partySnap: PartySnap | null = null;
let invitePollTimer = 0;
let seenInviteIds = new Set<string>();

export function bindParty(h: PartyHooks) { hooks = h; }
export function currentPartySnap() { return partySnap; }
export function currentPartyCode() { return partySnap?.code || ''; }

export function openPartyMenu() {
  if (!hooks?.canEnter()) {
    hooks?.toast('現在沒辦法開休閒房', '#ff8a7a', 3, 'top');
    return;
  }
  showMenu();
}

export function setPartySnap(s: PartySnap | null) {
  partySnap = s;
  if (!s) {
    clearPartyHud();
    return;
  }
  // 已離開／清 UI 後忽略晚到的 State，避免 HUD 又被畫回來
  if (!document.body.classList.contains('partyMode')) {
    clearPartyHud();
    return;
  }
  renderPartyHud(s);
}

export function clearPartyUi() {
  partySnap = null;
  clearPartyHud();
  hideModal();
  try { document.body.classList.remove('partyMode'); } catch { /* */ }
}

function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'partyModal';
  document.body.appendChild(modal);
  return modal;
}

function hideModal() {
  if (!modal) return;
  modal.classList.remove('show');
  modal.innerHTML = '';
}

function ensureHud() {
  if (hud) return hud;
  hud = document.createElement('div');
  hud.id = 'partyHud';
  document.body.appendChild(hud);
  return hud;
}

function clearPartyHud() {
  if (hud) { hud.classList.remove('on'); hud.innerHTML = ''; }
}

function showMenu() {
  const el = ensureModal();
  el.innerHTML = `<div class="ptCard">
    <h3>多人休閒房</h3>
    <p>中央八座・可換位走動，無倒數勝負</p>
    <div class="ptModes">
      <button type="button" class="ptPri" id="ptCreate">開一間房</button>
      <div class="ptJoinRow">
        <input id="ptCode" maxlength="6" placeholder="房間代碼" autocomplete="off" spellcheck="false"/>
        <button type="button" id="ptJoin">加入</button>
      </div>
    </div>
    <div class="ptActs"><button type="button" id="ptCancel">取消</button></div>
  </div>`;
  el.classList.add('show');
  el.querySelector('#ptCancel')!.addEventListener('click', () => hideModal());
  el.querySelector('#ptCreate')!.addEventListener('click', () => {
    hooks?.audio();
    hideModal();
    hooks?.enterParty({ create: true });
  });
  const join = () => {
    const code = String((el.querySelector('#ptCode') as HTMLInputElement)?.value || '').trim().toUpperCase();
    if (code.length !== 6) {
      hooks?.toast('請輸入 6 碼房間代碼', '#ffb08a', 2, 'top');
      return;
    }
    hooks?.audio();
    hideModal();
    hooks?.enterParty({ code });
  };
  el.querySelector('#ptJoin')!.addEventListener('click', join);
  el.querySelector('#ptCode')!.addEventListener('keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') join();
  });
}

function renderPartyHud(s: PartySnap) {
  const el = ensureHud();
  const n = s.occupied || s.players.length;
  const cap = s.capacity || PARTY_CAPACITY;
  el.innerHTML = `<div class="ptHudIn">
    <span class="ptLab">休閒房 <b>${esc(s.code)}</b>・${n}/${cap}</span>
    <span class="ptActsHud">
      <button type="button" id="ptCopy" title="複製邀請網址">複製網址</button>
      <button type="button" id="ptInvite" title="邀請好友">邀請</button>
      <button type="button" id="ptLeave">離開</button>
    </span>
  </div>`;
  el.classList.add('on');
  el.querySelector('#ptCopy')?.addEventListener('click', () => { void copyInvite(s.code); });
  el.querySelector('#ptInvite')?.addEventListener('click', () => { void showInviteFriends(s.code); });
  el.querySelector('#ptLeave')?.addEventListener('click', () => {
    hooks?.audio();
    hooks?.leaveParty();
  });
}

async function copyInvite(code: string) {
  const url = partyInviteUrl(code);
  try {
    await navigator.clipboard.writeText(url);
    hooks?.toast('已複製邀請網址', '#9be37a', 2, 'top');
  } catch {
    hooks?.toast(url, '#ffd76a', 4, 'top');
  }
}

async function showInviteFriends(code: string) {
  if (!hooks) return;
  const el = ensureModal();
  el.innerHTML = `<div class="ptCard">
    <h3>邀請好友</h3>
    <p>線上好友可直接收邀請；離線請複製網址</p>
    <div class="ptList" id="ptFrList">載入中…</div>
    <div class="ptActs">
      <button type="button" id="ptCopy2">複製網址</button>
      <button type="button" id="ptCloseInv">關閉</button>
    </div>
  </div>`;
  el.classList.add('show');
  el.querySelector('#ptCloseInv')!.addEventListener('click', () => hideModal());
  el.querySelector('#ptCopy2')!.addEventListener('click', () => { void copyInvite(code); });
  let friends: FriendRow[] = [];
  try {
    const data = await loadFriends(true);
    friends = data?.friends ?? [];
  } catch { friends = []; }
  const list = el.querySelector('#ptFrList')!;
  const online = friends.filter(f => f.online);
  if (!online.length) {
    list.innerHTML = `<div class="ptEmpty">目前沒有線上好友，可複製網址分享</div>`;
    return;
  }
  list.innerHTML = online.map(f => `<div class="ptFrRow">
    <span>${esc(f.nick)}${f.tag ? ` #${esc(String(f.tag).replace(/^#/, ''))}` : ''}</span>
    <button type="button" data-k="${esc(f.k)}">邀請</button>
  </div>`).join('');
  list.querySelectorAll<HTMLButtonElement>('button[data-k]').forEach(b => {
    b.onclick = async () => {
      const to = b.dataset.k || '';
      b.disabled = true;
      const r = await partyInviteFriend(hooks!.id, to, code);
      if (r.ok) hooks?.toast('已送出邀請', '#9be37a', 2, 'top');
      else {
        hooks?.toast(partyZhErr(r.err), '#ff8a7a', 3, 'top');
        b.disabled = false;
      }
    };
  });
}

function esc(v: unknown) {
  return String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

/** 主選單輪詢好友邀請 */
export function startPartyInvitePoll() {
  stopPartyInvitePoll();
  void pollInvites();
  invitePollTimer = window.setInterval(() => { void pollInvites(); }, 12_000);
}

export function stopPartyInvitePoll() {
  if (invitePollTimer) { clearInterval(invitePollTimer); invitePollTimer = 0; }
}

async function pollInvites() {
  if (!hooks) return;
  if (!hooks.canEnter()) return;
  const raw = await partyListInvites(hooks.id);
  const invites: PartyInvite[] = raw.map((x: any) => ({
    id: String(x?.id ?? ''),
    from: String(x?.from ?? ''),
    nick: String(x?.nick ?? '好友'),
    tag: String(x?.tag ?? '').replace(/^#/, ''),
    code: String(x?.code ?? '').toUpperCase(),
    at: Number(x?.at ?? 0) || 0,
  })).filter((x: PartyInvite) => x.id && x.code.length === 6);

  for (const inv of invites) {
    if (seenInviteIds.has(inv.id)) continue;
    seenInviteIds.add(inv.id);
    showIncomingInvite(inv);
    break;
  }
}

function showIncomingInvite(inv: PartyInvite) {
  if (!hooks) return;
  const el = ensureModal();
  const tag = inv.tag ? ` #${esc(inv.tag)}` : '';
  el.innerHTML = `<div class="ptCard">
    <h3>休閒房邀請</h3>
    <p><b>${esc(inv.nick)}</b>${tag} 邀你進房 <b>${esc(inv.code)}</b></p>
    <div class="ptActs">
      <button type="button" class="ptPri" id="ptAcc">接受</button>
      <button type="button" id="ptDec">婉拒</button>
    </div>
  </div>`;
  el.classList.add('show');
  el.querySelector('#ptAcc')!.addEventListener('click', async () => {
    hooks?.audio();
    const r = await partyAcceptInvite(hooks!.id, inv.id);
    hideModal();
    if (!r.ok || !r.code) {
      hooks?.toast(partyZhErr(r.err), '#ff8a7a', 3, 'top');
      return;
    }
    if (!hooks?.canEnter()) {
      hooks?.busyToast?.();
      return;
    }
    hooks?.enterParty({ code: r.code });
  });
  el.querySelector('#ptDec')!.addEventListener('click', () => {
    void partyDeclineInvite(hooks!.id, inv.id);
    hideModal();
  });
}

/** 啟動時讀 ?party= 直進 */
export function consumePartyDeepLink(): string | null {
  try {
    const u = new URL(location.href);
    const code = (u.searchParams.get('party') || '').trim().toUpperCase();
    if (code.length !== 6) return null;
    u.searchParams.delete('party');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    return code;
  } catch {
    return null;
  }
}

export function applyPartyState(raw: any) {
  setPartySnap(normPartySnap(raw));
}
