/** 伺服器公告：主畫面按鈕＋未讀紅點；進場／商店／裝備等場景切換時抓取 */
import { $ } from '../ui';
import * as Social from './social';

export type NoticeItem = Social.NoticeItem;

export type NoticesDeps = {
  LS: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };
  esc: (s: string) => string;
  bootQuiet: () => boolean;
};

let D: NoticesDeps;
let list: NoticeItem[] = [];
let fetchAt = 0;
const READ_LS = 'noticeReadAt';
let readAt = 0;
let fetching = false;

export function initNotices(deps: NoticesDeps) {
  D = deps;
  readAt = Math.max(0, Number(D.LS.getItem(READ_LS) || 0) || 0);
  const btn = document.getElementById('oNotice');
  if (btn) btn.addEventListener('click', () => openNotices());
  const close = document.getElementById('noticeClose');
  if (close) close.addEventListener('click', () => $('notice').classList.remove('show'));
  noticeDot();
  setTimeout(() => { void refreshNotices(true); }, 1200);
}

function saveRead() {
  try { D.LS.setItem(READ_LS, String(readAt)); } catch { /* */ }
}

export function hasUnreadNotices() {
  return list.some(n => (n.updated || n.id) > readAt);
}

export function noticeDot() {
  const btn = document.getElementById('oNotice');
  if (!btn) return;
  btn.classList.toggle('unread', hasUnreadNotices());
}

function fmtWhen(ts: number) {
  try {
    return new Date(ts + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  } catch { return ''; }
}

export function renderNotices() {
  const body = document.getElementById('noticeBody');
  if (!body) return;
  if (!list.length) {
    body.innerHTML = `<p class="noticeEmpty">目前沒有公告。</p>`;
    return;
  }
  body.innerHTML = list.map(n => {
    const unread = (n.updated || n.id) > readAt;
    return `<article class="noticeCard${unread ? ' new' : ''}">` +
      `<h3>${D.esc(n.title)}${unread ? '<span class="noticeNew">新</span>' : ''}</h3>` +
      `<time>${D.esc(fmtWhen(n.updated || n.start))}</time>` +
      `<div class="noticeTxt">${D.esc(n.body)}</div>` +
      `</article>`;
  }).join('');
}

export function openNotices() {
  void refreshNotices(true).then(() => {
    renderNotices();
    markNoticesRead();
  });
  renderNotices();
  $('notice').classList.add('show');
}

export function markNoticesRead() {
  let max = readAt;
  for (const n of list) max = Math.max(max, n.updated || 0, n.id || 0);
  if (max > readAt) { readAt = max; saveRead(); }
  noticeDot();
  renderNotices();
}

/** 進場／場景切換呼叫；force 略過短時間節流 */
export async function refreshNotices(force = false) {
  if (!D) return;
  if (!force && Date.now() - fetchAt < 8_000) { noticeDot(); return; }
  if (fetching) return;
  fetching = true;
  fetchAt = Date.now();
  try {
    const r = await Social.noticesActive();
    list = r?.notices ?? [];
  } catch {
    /* 連不上就留舊列表 */
  } finally {
    fetching = false;
  }
  noticeDot();
  if ($('notice').classList.contains('show')) renderNotices();
}
