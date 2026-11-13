/**
 * #5636（後台 AdminPlazaTag）專用：主畫面「後台」入口，連到 game-status 管理頁。
 * API／頁面與 StatsServer ClientApp AdminToolsMenu 對齊；瀏覽器會要 Basic 密碼。
 */
import { $ } from '../ui';
import { myTag } from './social';

/** 與 StatsServer appsettings AdminPlazaTag 預設一致 */
export const ADMIN_PLAYER_TAG = '5636';

const ADMIN_ORIGIN = import.meta.env.DEV
  ? 'http://127.0.0.1:8787'
  : 'https://game-status.gwtech.org';

type AdminLink = { path: string; label: string; icon: string; query?: string };

/** 對齊後台 AdminToolsMenu 分組 */
const ADMIN_GROUPS: { title: string; items: AdminLink[] }[] = [
  {
    title: '總覽',
    items: [
      { path: '/admin', label: '統計首頁', icon: 'ic-rank', query: 'game=oyster-sim' },
      { path: '/admin/feedback', label: '玩家回饋', icon: 'ic-chat' },
    ],
  },
  {
    title: '玩家',
    items: [
      { path: '/admin/players', label: '玩家', icon: 'ic-rank', query: 'game=oyster-sim' },
      { path: '/admin/gifts', label: '送禮', icon: 'ic-gift' },
      { path: '/admin/leaderboard', label: '排行榜', icon: 'ic-trophy' },
    ],
  },
  {
    title: '經濟',
    items: [
      { path: '/admin/shop', label: '商店價格', icon: 'ic-shop' },
      { path: '/admin/economy', label: '賺錢設定', icon: 'ic-coin' },
    ],
  },
  {
    title: '內容',
    items: [
      { path: '/admin/events', label: '活動場景', icon: 'ic-lantern' },
      { path: '/admin/surveys', label: '問卷調查', icon: 'ic-chat' },
      { path: '/admin/notices', label: '遊戲公告', icon: 'ic-horn' },
    ],
  },
  {
    title: '廣場',
    items: [
      { path: '/admin/plaza', label: '廣場／旗幟', icon: 'ic-flag' },
    ],
  },
];

export function isAdminPlayer(tag = myTag()) {
  return (tag || '').replace(/^#/, '') === ADMIN_PLAYER_TAG;
}

function adminUrl(item: AdminLink) {
  const q = item.query ? `?${item.query}` : '';
  return `${ADMIN_ORIGIN}${item.path}${q}`;
}

export function syncAdminBtn(tag?: string) {
  const btn = document.getElementById('oAdmin');
  if (!btn) return;
  btn.style.display = isAdminPlayer(tag ?? myTag()) ? '' : 'none';
}

export function openAdminTools() {
  if (!isAdminPlayer()) { syncAdminBtn(); return; }
  const body = document.getElementById('adminToolsBody');
  if (body && !body.dataset.ready) {
    body.innerHTML = ADMIN_GROUPS.map(g =>
      `<div class="adminGrp"><div class="adminGrpH">${g.title}</div>` +
      `<div class="sysGrid adminGrid">${g.items.map(it =>
        `<button type="button" class="adminGo" data-href="${adminUrl(it).replace(/"/g, '')}">` +
        `<i class="ic ${it.icon}"></i><span>${it.label}</span></button>`,
      ).join('')}</div></div>`,
    ).join('');
    body.dataset.ready = '1';
    body.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button.adminGo');
      if (!b?.dataset.href) return;
      window.open(b.dataset.href, '_blank', 'noopener,noreferrer');
    });
  }
  $('adminTools').classList.add('show');
}

export function initAdminTools() {
  const btn = document.getElementById('oAdmin');
  if (btn) btn.addEventListener('click', () => openAdminTools());
  const close = document.getElementById('adminToolsClose');
  if (close) close.addEventListener('click', () => $('adminTools').classList.remove('show'));
  syncAdminBtn();
}
