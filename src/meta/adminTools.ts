/**
 * #5636 遊戲內後台：呼叫 StatsServer /api/*（Basic 密碼），對齊後台網頁可編輯操作。
 */
import { $ } from '../ui';
import { myTag } from './social';

export const ADMIN_PLAYER_TAG = '5636';
const ADMIN_ORIGIN = import.meta.env.DEV ? 'http://127.0.0.1:8787' : 'https://game-status.gwtech.org';
const PW_KEY = 'oyAdminPw';

type HubItem = { id: string; label: string; icon: string; group: string };

const HUB: HubItem[] = [
  { group: '玩家', id: 'players', label: '玩家', icon: 'ic-rank' },
  { group: '玩家', id: 'gifts', label: '送禮', icon: 'ic-gift' },
  { group: '玩家', id: 'leaderboard', label: '排行榜', icon: 'ic-trophy' },
  { group: '經濟', id: 'shop', label: '商店價格', icon: 'ic-shop' },
  { group: '經濟', id: 'economy', label: '賺錢設定', icon: 'ic-coin' },
  { group: '內容', id: 'surveys', label: '問卷調查', icon: 'ic-chat' },
  { group: '內容', id: 'notices', label: '遊戲公告', icon: 'ic-horn' },
  { group: '內容', id: 'events', label: '活動場景', icon: 'ic-lantern' },
  { group: '其他', id: 'feedback', label: '玩家回饋', icon: 'ic-chat' },
  { group: '其他', id: 'plaza', label: '廣場／旗幟', icon: 'ic-flag' },
];

const DIFF = ['易', '普', '硬', '超硬'];
const RAR = ['白珍珠', '粉珍珠', '金珍珠', '黑珍珠'];
const LOCS = [
  { id: 'home', n: '自家蚵寮' },
  { id: 'wanggong', n: '王功漁港' },
  { id: 'dongshi', n: '東石碼頭' },
  { id: 'budai', n: '布袋大廠' },
  { id: 'plaza', n: '蚵仔廣場' },
];
const STEAL: Record<string, string> = { normal: '一般（可剝可偷）', steal_only: '只能用偷的', no_steal: '不能偷' };
const QTYPES: { v: string; n: string }[] = [
  { v: 'single', n: '單選' }, { v: 'multi', n: '多選' }, { v: 'text', n: '簡答' },
];
const FB_CATS: [string, string][] = [['', '全部'], ['bug', 'Bug'], ['idea', '建議'], ['fun', '好玩'], ['hard', '太難']];
const GIFT_CATS: [string, string][] = [
  ['money', '金錢'], ['pearl', '珍珠'], ['odd', '奇物'], ['item', '道具'],
  ['equip-head', '裝備-頭'], ['equip-sleeve', '袖套'], ['equip-shirt', '衣服'],
  ['equip-pants', '褲子'], ['equip-shoes', '鞋子'],
];
const SHOP_CAT: Record<string, string> = {
  knife: '刀具', umbrella: '雨傘', basin: '盆仔', tool: '其他器具', med: '藥品', item: '道具',
  'equip-head': '服飾-頭', 'equip-sleeve': '服飾-袖套', 'equip-shirt': '服飾-衣服',
  'equip-pants': '服飾-褲子', 'equip-shoes': '服飾-鞋子',
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const tw = (ts: number | null | undefined) => {
  if (ts == null) return '–';
  try { return new Date(ts + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); }
  catch { return ''; }
};
const toLocal = (ts: number | null | undefined) => ts == null ? '' : new Date(ts + 8 * 3600e3).toISOString().slice(0, 16);
const fromLocal = (v: string) => v ? Date.parse(v + ':00Z') - 8 * 3600e3 : null;
const money = (n: number | null | undefined) => n == null ? '–' : `$${Number(n).toLocaleString()}`;
const dur = (s: number | null | undefined) => {
  if (s == null) return '–';
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} 時 ${m} 分` : m ? `${m} 分 ${s % 60} 秒` : `${s} 秒`;
};
const num = (v: unknown, dec = false) => {
  const t = String(v ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? (dec ? n : Math.floor(n)) : null;
};
const getPw = () => sessionStorage.getItem(PW_KEY) || '';
const setPw = (v: string) => { try { sessionStorage.setItem(PW_KEY, v); } catch { /* */ } };
const clearPw = () => { try { sessionStorage.removeItem(PW_KEY); } catch { /* */ } };

export function isAdminPlayer(tag = myTag()) {
  return (tag || '').replace(/^#/, '') === ADMIN_PLAYER_TAG;
}

export function syncAdminBtn(tag?: string) {
  const btn = document.getElementById('oAdmin');
  if (!btn) return;
  btn.style.display = isAdminPlayer(tag ?? myTag()) ? '' : 'none';
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const pw = getPw();
  headers.set('Authorization', 'Basic ' + btoa('admin:' + pw));
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const r = await fetch(ADMIN_ORIGIN + path, { ...init, headers, mode: 'cors', cache: 'no-store' });
  if (r.status === 401) { clearPw(); throw new Error('auth'); }
  return r;
}

async function apiJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await api(path, init);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as any)?.error || `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

function bodyEl() { return document.getElementById('adminToolsBody')!; }
function hintEl() { return document.getElementById('adminToolsHint'); }
function setHint(t: string) { const h = hintEl(); if (h) h.textContent = t; }

function showMsg(el: HTMLElement, text: string, bad = false) {
  let m = el.querySelector('.adminMsg') as HTMLElement | null;
  if (!m) { m = document.createElement('p'); m.className = 'adminMsg'; el.prepend(m); }
  m.textContent = text;
  m.classList.toggle('bad', bad);
}

function backBar(title: string, backAct = 'hub') {
  return `<div class="adminBar"><button type="button" class="adminBack" data-act="${esc(backAct)}">← 返回</button><b>${esc(title)}</b></div>`;
}

function onAuth(e: any) {
  if (e?.message === 'auth') { renderLogin(); return true; }
  return false;
}

function fillEco(src: any) {
  return {
    dpay: [...(src.dpay ?? [6, 8, 12, 18])],
    crumbRate: Number(src.crumbRate ?? 0.7),
    tempCut: Number(src.tempCut ?? 1),
    quickBonus: Number(src.quickBonus ?? 1),
    perfectPay: Number(src.perfectPay ?? 2),
    yardStealFine: Number(src.yardStealFine ?? 5),
    yardStealDiff: Number(src.yardStealDiff ?? 1),
    plazaStealPen: Number(src.plazaStealPen ?? 30),
    plazaStealBanN: Number(src.plazaStealBanN ?? 3),
    plazaStealBanMs: Number(src.plazaStealBanMs ?? 45000),
    plazaStealMinCount: Number(src.plazaStealMinCount ?? 4),
    peaceBonus: Number(src.peaceBonus ?? 50),
    nightMult: Number(src.nightMult ?? 0.2),
    workedMinCount: Number(src.workedMinCount ?? 5),
    dailyPays: [...(src.dailyPays ?? [1000, 1200, 1500, 1800, 2200, 2600, 3000])],
    startMoney: Number(src.startMoney ?? 10000),
    return7: Number(src.return7 ?? 10000),
    return30: Number(src.return30 ?? 30000),
    locMult: { home: 1, wanggong: 1.2, dongshi: 1.4, budai: 2, plaza: 2, ...(src.locMult ?? {}) },
    rarPrices: [...(src.rarPrices ?? [200, 600, 1800, 6000])],
    plazaMaxEarn: Number(src.plazaMaxEarn ?? 99_999_999),
    plazaCapBase: Number(src.plazaCapBase ?? 80),
    plazaCapDurSec: Number(src.plazaCapDurSec ?? 1800),
    plazaCapPerSec: Number(src.plazaCapPerSec ?? 12),
    plazaCapOystersMax: Number(src.plazaCapOystersMax ?? 400),
    plazaCapPerOyster: Number(src.plazaCapPerOyster ?? 20),
  };
}

function renderLogin() {
  setHint('輸入後台密碼（與 game-status AdminPassword 相同）。只存在此裝置瀏覽器分頁。');
  bodyEl().innerHTML = `<div class="adminLogin">
    <label>後台密碼 <input id="adminPw" type="password" autocomplete="current-password" placeholder="AdminPassword"></label>
    <button type="button" class="adminPrimary" data-act="login">登入</button>
    <p class="adminNote">帳號固定 admin；密碼錯誤會清掉暫存。</p>
  </div>`;
  bodyEl().querySelector('#adminPw')?.addEventListener('keydown', e => {
    if ((e as KeyboardEvent).key === 'Enter') void tryLogin();
  });
}

async function tryLogin() {
  const inp = document.getElementById('adminPw') as HTMLInputElement | null;
  const pw = (inp?.value || '').trim();
  if (!pw) { showMsg(bodyEl(), '請輸入密碼', true); return; }
  setPw(pw);
  try {
    await apiJson('/api/players/online');
    renderHub();
  } catch {
    clearPw();
    showMsg(bodyEl(), '密碼錯誤或連不上伺服器', true);
  }
}

function renderHub() {
  setHint('選一項管理功能。與後台網頁相同，可編輯／儲存，不只檢視。');
  const groups = [...new Set(HUB.map(h => h.group))];
  bodyEl().innerHTML = groups.map(g => {
    const items = HUB.filter(h => h.group === g);
    return `<div class="adminGrp"><div class="adminGrpH">${esc(g)}</div>
      <div class="sysGrid adminGrid">${items.map(it =>
        `<button type="button" data-view="${it.id}"><i class="ic ${it.icon}"></i><span>${esc(it.label)}</span></button>`,
      ).join('')}</div></div>`;
  }).join('') + `<p class="adminNote"><button type="button" data-act="logout" class="adminLink">清除密碼／登出</button></p>`;
}

/* ─── 玩家 ─── */
async function renderPlayers() {
  setHint('點玩家看詳情；可從詳情直接送禮。');
  const root = bodyEl();
  root.innerHTML = backBar('玩家') + `<div class="adminRow">
    <input id="apQ" placeholder="搜尋暱稱／#編號／id">
    <label class="adminChk"><input type="checkbox" id="apOn">只看線上</label>
    <button type="button" data-act="players-search">搜尋</button>
  </div><div class="adminList">載入中…</div>`;

  const load = async (page = 1) => {
    const list = root.querySelector('.adminList')!;
    const q = (document.getElementById('apQ') as HTMLInputElement)?.value || '';
    const onlyOn = (document.getElementById('apOn') as HTMLInputElement)?.checked;
    list.textContent = '載入中…';
    try {
      const p = new URLSearchParams({
        game: 'oyster-sim', size: '40', page: String(page), q, sort: 'last', dir: 'desc',
        ...(onlyOn ? { online: '1' } : {}),
      });
      const j = await apiJson(`/api/players?${p}`);
      const rows = j.rows as any[];
      const pages = Math.max(1, Math.ceil(j.total / j.size));
      list.innerHTML = `<p class="adminMeta">共 ${j.total}・線上 ${j.online}・第 ${j.page}/${pages} 頁</p>` +
        (rows.length ? rows.map(r =>
          `<button type="button" class="adminCard adminTap" data-pid="${esc(r.id)}">
            <b>${esc(r.nick || '（未取名）')} <small>#${esc(r.tag || '')}</small></b>
            <span>${r.online ? (r.shucking ? '🟢 線上・上工中' : '🟢 線上') : '離線'}・班次 ${r.shifts ?? 0}・${money(r.income)}</span>
            <small>${esc(r.device || '')} ${esc(r.version || '')}・圖鑑 ${r.dex}/${r.dexTotal}</small>
          </button>`,
        ).join('') : '<p class="adminMeta">沒有結果</p>') +
        (pages > 1 ? `<div class="adminRow adminPg">
          <button type="button" data-pg="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ 上一頁</button>
          <button type="button" data-pg="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一頁 ›</button>
        </div>` : '');
      list.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', () => {
        void renderPlayerDetail((b as HTMLElement).dataset.pid!);
      }));
      list.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => {
        const pg = Number((b as HTMLElement).dataset.pg);
        if (pg >= 1) void load(pg);
      }));
    } catch (e: any) {
      if (onAuth(e)) return;
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };
  root.querySelector('[data-act="players-search"]')?.addEventListener('click', () => void load(1));
  document.getElementById('apOn')?.addEventListener('change', () => void load(1));
  document.getElementById('apQ')?.addEventListener('keydown', e => {
    if ((e as KeyboardEvent).key === 'Enter') void load(1);
  });
  await load(1);
}

async function renderPlayerDetail(id: string) {
  setHint('玩家詳情：上工／上線／開物／購買／禮物；可直接送禮。');
  const root = bodyEl();
  root.innerHTML = backBar('玩家詳情', 'players') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  try {
    const d = await apiJson(`/api/players/detail?game=oyster-sim&id=${encodeURIComponent(id)}`);
    const p = d.profile;
    const who = `${p.nick || '（未取名）'}${p.tag ? ` #${p.tag}` : ''}`;
    const giftTarget = p.tag ? `#${p.tag}` : p.id;
    const tabs: [string, string, any[]][] = [
      ['shifts', '上工', d.shifts || []],
      ['sessions', '上線', d.sessions || []],
      ['finds', '開物', d.finds || []],
      ['buys', '購買', d.buys || []],
      ['gifts', '禮物', d.gifts || []],
    ];
    let tab = 'shifts';
    const paint = () => {
      const cur = tabs.find(t => t[0] === tab)!;
      const rows = cur[2] as any[];
      list.innerHTML = `
        <div class="adminCard">
          <div class="adminWho">
            <b>${esc(who)}</b>
            <span class="adminChip${p.online ? ' on' : ''}">${p.online ? (p.shucking ? '線上・上工中' : '線上') : '離線'}</span>
            <button type="button" class="adminPrimary" data-act="gift-to" data-target="${esc(giftTarget)}">送禮給他</button>
          </div>
          <div class="adminKpis">
            <span>第一次 ${esc(tw(p.firstSeen))}</span>
            <span>最後 ${p.online ? '現在' : esc(tw(p.lastSeen))}</span>
            <span>上工 ${p.shifts} 次</span>
            <span>收入 ${money(p.income)}</span>
            <span>圖鑑 ${p.dex}/${p.dexTotal}</span>
            <span>線上 ${dur(p.playSec)}・${p.sessions} 段</span>
          </div>
          <p class="adminMeta">id：${esc(p.id)}・k：${esc(p.k)}</p>
        </div>
        <div class="adminTabs">${tabs.map(([k, n, a]) =>
          `<button type="button" class="${k === tab ? 'on' : ''}" data-tab="${k}">${esc(n)}（${a.length}）</button>`,
        ).join('')}</div>
        <div class="adminDetailList">${rows.length ? rows.slice(0, 80).map(row => {
          if (tab === 'shifts') return `<div class="adminCard"><b>${esc(tw(row.at))}・${esc(row.loc)}</b><span>${money(row.earn)}・開蚵 ${row.opened ?? '–'}・${esc(row.reasonZh || '')}</span><small>${dur(row.dur)}</small></div>`;
          if (tab === 'sessions') return `<div class="adminCard"><b>${esc(tw(row.start))} ～ ${row.open ? '線上中' : esc(tw(row.end))}</b><span>${dur(row.sec)}${row.shucking ? '・有上工' : ''}</span></div>`;
          if (tab === 'finds') return `<div class="adminCard"><b>${esc(row.name)}</b><span>${esc(tw(row.at))}・${esc(row.rarity || '')}${row.limited ? '・活動' : ''}</span></div>`;
          if (tab === 'buys') return `<div class="adminCard"><b>${esc(row.name)}</b><span>${esc(tw(row.at))}・${money(row.price)}</span></div>`;
          return `<div class="adminCard"><b>${esc(row.name)}</b><span>${esc(tw(row.at))}・${row.all ? '全體' : '個人'}</span><small>${esc(row.message || '')}</small></div>`;
        }).join('') : '<p class="adminMeta">沒有紀錄</p>'}</div>`;
      list.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
        tab = (b as HTMLElement).dataset.tab!;
        paint();
      }));
      list.querySelector('[data-act="gift-to"]')?.addEventListener('click', () => {
        void renderGifts({ target: giftTarget });
      });
    };
    paint();
  } catch (e: any) {
    if (onAuth(e)) return;
    list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

/* ─── 送禮 ─── */
async function renderGifts(opts?: { target?: string }) {
  setHint('送禮與後台相同：可選目錄物品、數量、全體或指定玩家，可撤回。');
  const root = bodyEl();
  root.innerHTML = backBar('送禮') + `<div class="adminForm" id="gfForm">
    <label class="adminChk"><input type="checkbox" id="gfAll"> 全體玩家</label>
    <label>目標 <input id="gfTarget" placeholder="#5636／k／id" value="${esc(opts?.target || '')}"></label>
    <label>分類 <select id="gfCat">${GIFT_CATS.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('')}</select></label>
    <label id="gfAmtL">金額 <input id="gfAmt" type="number" min="1" value="1000"></label>
    <div id="gfPickWrap" style="display:none">
      <label>搜尋 <input id="gfQ" placeholder="名稱關鍵字"></label>
      <label>物品 <select id="gfPick" size="5"></select></label>
      <label>數量 <input id="gfQty" type="number" min="1" max="20" value="1"></label>
    </div>
    <label>留言 <input id="gfMsg" maxlength="200"></label>
    <button type="button" class="adminPrimary" data-act="gift-send">送出</button>
  </div><div class="adminList">載入中…</div>`;

  let items: any[] = [];
  try {
    const cat = await apiJson('/api/gifts/catalog');
    items = cat.items || [];
  } catch (e: any) {
    if (onAuth(e)) return;
    showMsg(root, '物品清單載入失敗', true);
  }

  const typeOf = (c: string) => c.startsWith('equip') ? 'equip' : c;
  const syncType = () => {
    const c = (document.getElementById('gfCat') as HTMLSelectElement).value;
    const t = typeOf(c);
    (document.getElementById('gfAmtL') as HTMLElement).style.display = t === 'money' ? '' : 'none';
    (document.getElementById('gfPickWrap') as HTMLElement).style.display = t === 'money' ? 'none' : '';
    if (t !== 'money') paintPick();
  };
  const paintPick = () => {
    const c = (document.getElementById('gfCat') as HTMLSelectElement).value;
    const q = ((document.getElementById('gfQ') as HTMLInputElement)?.value || '').trim();
    const opts = items.filter(i => i.category === c && (!q || i.name.includes(q) || i.id.includes(q)));
    const sel = document.getElementById('gfPick') as HTMLSelectElement;
    const cur = sel.value;
    sel.innerHTML = opts.map(i =>
      `<option value="${esc(i.id)}">${esc(i.name)}${i.rarity ? `（${esc(i.rarity)}）` : ''}</option>`,
    ).join('') || '<option value="">（無）</option>';
    if (opts.some(i => i.id === cur)) sel.value = cur;
  };
  document.getElementById('gfCat')?.addEventListener('change', syncType);
  document.getElementById('gfQ')?.addEventListener('input', paintPick);
  document.getElementById('gfAll')?.addEventListener('change', () => {
    const on = (document.getElementById('gfAll') as HTMLInputElement).checked;
    (document.getElementById('gfTarget') as HTMLInputElement).disabled = on;
  });
  syncType();

  const load = async () => {
    const list = root.querySelector('.adminList')!;
    try {
      const rows = await apiJson<any[]>('/api/gifts');
      list.innerHTML = rows.slice(0, 60).map(g =>
        `<div class="adminCard${g.revoked ? ' dim' : ''}"><b>#${g.id} ${esc(g.label)}</b>
        <span>${esc(g.type)}${g.amount != null ? ` $${g.amount}` : ''}${g.itemId ? ` ${esc(g.itemId)}` : ''}${g.tier != null ? ` tier${g.tier}` : ''}</span>
        <small>${tw(g.createdAt)}・領 ${g.claims}${g.revoked ? '・已撤回' : ''}${g.message ? `・${esc(g.message)}` : ''}</small>
        ${g.revoked || (g.claims && !g.all) ? '' : `<button type="button" data-revoke="${g.id}">撤回</button>`}</div>`,
      ).join('') || '<p class="adminMeta">還沒有禮物</p>';
      list.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
        const gid = Number((b as HTMLElement).dataset.revoke);
        if (!confirm(`撤回禮物 #${gid}？已領的不會收回。`)) return;
        try { await apiJson('/api/gifts/revoke', { method: 'POST', body: JSON.stringify({ id: gid }) }); await load(); }
        catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      }));
    } catch (e: any) {
      if (onAuth(e)) return;
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  root.querySelector('[data-act="gift-send"]')?.addEventListener('click', async () => {
    const all = (document.getElementById('gfAll') as HTMLInputElement).checked;
    const target = all ? '全體玩家' : (document.getElementById('gfTarget') as HTMLInputElement).value.trim();
    const cat = (document.getElementById('gfCat') as HTMLSelectElement).value;
    const type = typeOf(cat);
    const message = (document.getElementById('gfMsg') as HTMLInputElement).value;
    if (!target) { showMsg(root, '請填目標', true); return; }
    const body: any = { target, type, message };
    let name = '';
    let n = 1;
    if (type === 'money') {
      body.amount = Number((document.getElementById('gfAmt') as HTMLInputElement).value);
      if (!(body.amount >= 1)) { showMsg(root, '金額至少 1', true); return; }
      name = `$${body.amount}`;
    } else {
      const pick = (document.getElementById('gfPick') as HTMLSelectElement).value;
      const it = items.find(i => i.id === pick && i.category === cat);
      if (!it) { showMsg(root, '請選物品', true); return; }
      n = Math.max(1, Math.min(20, Math.floor(Number((document.getElementById('gfQty') as HTMLInputElement).value) || 1)));
      if (type === 'pearl') body.tier = +it.id.replace('pearl-', '');
      else body.id = it.id;
      name = it.name;
    }
    if (!confirm(`要送給 ${all ? '全體玩家' : target}：${name} × ${n}？`)) return;
    try {
      let sent = 0, label = '';
      for (let i = 0; i < n; i++) {
        const j = await apiJson('/api/gifts', { method: 'POST', body: JSON.stringify(body) });
        label = j.label; sent++;
      }
      showMsg(root, `已送給 ${label}：${name} × ${sent}`);
      await load();
    } catch (e: any) {
      if (!onAuth(e)) showMsg(root, e?.message || '失敗', true);
    }
  });
  await load();
}

/* ─── 排行榜 ─── */
async function renderLeaderboard() {
  setHint('可改分、刪除成績、調整各榜上限。');
  const root = bodyEl();
  root.innerHTML = backBar('排行榜') + `<div class="adminForm" id="lbForm">
    <label>榜單 <select id="lbBoard"></select></label>
    <label>日期（台北） <input id="lbDay" type="date"></label>
    <label class="adminChk"><input type="checkbox" id="lbTest"> 含測試</label>
    <button type="button" data-act="lb-load">重新載入</button>
  </div>
  <div class="adminCard" id="lbCaps"></div>
  <div class="adminForm">
    <label>寫入目標 <input id="lbTarget" placeholder="#編號／k／id"></label>
    <label>暱稱（選填） <input id="lbNick"></label>
    <label>分數（0＝刪） <input id="lbV" type="number" min="0" value="0"></label>
    <button type="button" class="adminPrimary" data-act="lb-set">寫入分數</button>
  </div>
  <div class="adminList">載入中…</div>`;

  let boards: { id: string; name: string; cap: number }[] = [];
  let caps: Record<string, number> = {};

  const load = async () => {
    const list = root.querySelector('.adminList')!;
    const board = (document.getElementById('lbBoard') as HTMLSelectElement)?.value || 'oysters';
    const day = (document.getElementById('lbDay') as HTMLInputElement)?.value || '';
    const test = (document.getElementById('lbTest') as HTMLInputElement)?.checked;
    list.textContent = '載入中…';
    try {
      const p = new URLSearchParams({ board, ...(day ? { day } : {}), ...(test ? { test: '1' } : {}) });
      const j = await apiJson(`/api/leaderboard?${p}`);
      boards = j.boards || [];
      caps = j.caps || {};
      const sel = document.getElementById('lbBoard') as HTMLSelectElement;
      if (!sel.options.length) {
        sel.innerHTML = boards.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
      }
      sel.value = j.board;
      (document.getElementById('lbDay') as HTMLInputElement).value = j.day;
      const capsEl = document.getElementById('lbCaps')!;
      capsEl.innerHTML = `<b>各榜上限</b>` + boards.map(b =>
        `<label>${esc(b.name)} <input data-cap="${esc(b.id)}" type="number" min="1" value="${caps[b.id] ?? b.cap}"></label>`,
      ).join('') + `<button type="button" data-act="lb-caps">儲存上限</button>`;
      capsEl.querySelector('[data-act="lb-caps"]')?.addEventListener('click', async () => {
        const body: Record<string, number> = {};
        capsEl.querySelectorAll('input[data-cap]').forEach(inp => {
          const el = inp as HTMLInputElement;
          body[el.dataset.cap!] = Math.floor(Number(el.value));
        });
        try {
          await apiJson('/api/leaderboard/caps', { method: 'POST', body: JSON.stringify(body) });
          showMsg(root, '上限已更新');
          await load();
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      });
      const rows = j.rows as any[];
      list.innerHTML = rows.map(r =>
        `<div class="adminCard"><b>#${r.rank} ${esc(r.nick)} <small>#${esc(r.tag)}</small></b>
        <span>${Number(r.v).toLocaleString()}・${esc(tw(r.ts))}</span>
        <div class="adminActions">
          <button type="button" data-edit="${esc(r.k)}" data-nick="${esc(r.nick)}" data-v="${r.v}">改分</button>
          <button type="button" data-del="${esc(r.k)}" data-nick="${esc(r.nick)}" data-tag="${esc(r.tag)}">刪除</button>
        </div></div>`,
      ).join('') || '<p class="adminMeta">這天還沒有成績</p>';
      list.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', async () => {
        const el = b as HTMLElement;
        const raw = prompt(`${el.dataset.nick}\n新分數（目前 ${el.dataset.v}，0＝刪除）`, el.dataset.v);
        if (raw == null) return;
        const v = Math.floor(Number(raw));
        if (!Number.isFinite(v) || v < 0) { showMsg(root, '分數不對', true); return; }
        try {
          await apiJson('/api/leaderboard/set', {
            method: 'POST',
            body: JSON.stringify({
              board: (document.getElementById('lbBoard') as HTMLSelectElement).value,
              day: (document.getElementById('lbDay') as HTMLInputElement).value,
              target: el.dataset.edit, v, nick: el.dataset.nick,
              test: (document.getElementById('lbTest') as HTMLInputElement).checked,
            }),
          });
          showMsg(root, v === 0 ? '已刪除' : `已改 → ${v}`);
          await load();
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      }));
      list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        const el = b as HTMLElement;
        if (!confirm(`刪除 ${el.dataset.nick} #${el.dataset.tag} 的成績？`)) return;
        try {
          await apiJson('/api/leaderboard/delete', {
            method: 'POST',
            body: JSON.stringify({
              board: (document.getElementById('lbBoard') as HTMLSelectElement).value,
              day: (document.getElementById('lbDay') as HTMLInputElement).value,
              target: el.dataset.del,
              test: (document.getElementById('lbTest') as HTMLInputElement).checked,
            }),
          });
          showMsg(root, '已刪除');
          await load();
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      }));
    } catch (e: any) {
      if (onAuth(e)) return;
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  root.querySelector('[data-act="lb-load"]')?.addEventListener('click', () => void load());
  root.querySelector('[data-act="lb-set"]')?.addEventListener('click', async () => {
    const target = (document.getElementById('lbTarget') as HTMLInputElement).value.trim();
    const v = Math.floor(Number((document.getElementById('lbV') as HTMLInputElement).value));
    if (!target) { showMsg(root, '請填玩家', true); return; }
    if (!Number.isFinite(v) || v < 0) { showMsg(root, '分數不對', true); return; }
    if (!confirm(`要把 ${target} 設成 ${v}？`)) return;
    try {
      const j = await apiJson('/api/leaderboard/set', {
        method: 'POST',
        body: JSON.stringify({
          board: (document.getElementById('lbBoard') as HTMLSelectElement).value,
          day: (document.getElementById('lbDay') as HTMLInputElement).value,
          target, v,
          nick: (document.getElementById('lbNick') as HTMLInputElement).value.trim() || undefined,
          test: (document.getElementById('lbTest') as HTMLInputElement).checked,
        }),
      });
      showMsg(root, v === 0 ? `已刪除 ${j.label}` : `已寫入 ${j.label}：${j.v}`);
      await load();
    } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
  });
  await load();
}

/* ─── 商店 ─── */
async function renderShop() {
  setHint('改價、單品折扣、全館特價、標新品；儲存後玩家下次開雜貨店生效。');
  const root = bodyEl();
  root.innerHTML = backBar('商店價格') + `<div class="adminCard">
    <b>全館特價</b>
    <div class="adminRow">
      <label>折扣 <input id="salePct" type="number" min="1" max="99" placeholder="90＝9折"></label>
      <label>開始 <input id="saleStart" type="datetime-local"></label>
      <label>結束 <input id="saleEnd" type="datetime-local"></label>
      <button type="button" data-act="sale-clear">清除</button>
    </div>
  </div>
  <div class="adminRow"><input id="shQ" placeholder="搜尋物品"><button type="button" class="adminPrimary" data-act="shop-save">儲存</button></div>
  <div class="adminList">載入中…</div>`;

  type Ed = { id: string; name: string; category: string; base: number; price: string; pct: string; start: string; end: string; isNew: boolean; was: number };
  let items: Ed[] = [];

  const active = (pct: number | null, s: number | null, e: number | null, t: number) =>
    pct != null && pct > 0 && pct < 100 && (s == null || t >= s) && (e == null || t < e);
  const eff = (r: Ed) => {
    const list = num(r.price) ?? r.base;
    let f = 1;
    const sp = num((document.getElementById('salePct') as HTMLInputElement)?.value);
    if (active(num(r.pct), fromLocal(r.start), fromLocal(r.end), Date.now())) f *= num(r.pct)! / 100;
    if (active(sp, fromLocal((document.getElementById('saleStart') as HTMLInputElement)?.value || ''), fromLocal((document.getElementById('saleEnd') as HTMLInputElement)?.value || ''), Date.now())) f *= sp! / 100;
    return f < 1 ? Math.max(1, Math.round(list * f)) : list;
  };

  const paint = (q = '') => {
    const list = root.querySelector('.adminList')!;
    const qq = q.trim();
    const order = Object.keys(SHOP_CAT);
    const groups = order.map(c => ({
      c, name: SHOP_CAT[c],
      list: items.filter(i => i.category === c && (!qq || i.name.includes(qq) || i.id.includes(qq))),
    })).filter(g => g.list.length);
    list.innerHTML = groups.map(g =>
      `<div class="adminGrpH">${esc(g.name)}</div>` + g.list.map(i =>
        `<div class="adminCard shopRow" data-id="${esc(i.id)}">
          <b>${esc(i.name)}</b><small>${esc(i.id)}・底 $${i.base}・現售 $${eff(i)}</small>
          <label>改價 <input class="shPrice" type="number" min="1" value="${esc(i.price)}" placeholder="${i.base}"></label>
          <label>折扣 <input class="shPct" type="number" min="1" max="99" value="${esc(i.pct)}" placeholder="—"></label>
          <label>折開 <input class="shStart" type="datetime-local" value="${esc(i.start)}"></label>
          <label>折迄 <input class="shEnd" type="datetime-local" value="${esc(i.end)}"></label>
          <label class="adminChk"><input class="shNew" type="checkbox" ${i.isNew ? 'checked' : ''}> 新品</label>
          <button type="button" data-clear="${esc(i.id)}">還原</button>
        </div>`,
      ).join(''),
    ).join('') || '<p class="adminMeta">沒有物品</p>';
    list.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.clear!;
      const it = items.find(x => x.id === id);
      if (!it) return;
      it.price = ''; it.pct = ''; it.start = ''; it.end = ''; it.isNew = false;
      paint((document.getElementById('shQ') as HTMLInputElement)?.value || '');
    }));
    list.querySelectorAll('.shopRow').forEach(row => {
      const sync = () => {
        const id = (row as HTMLElement).dataset.id!;
        const it = items.find(x => x.id === id);
        if (!it) return;
        it.price = (row.querySelector('.shPrice') as HTMLInputElement).value;
        it.pct = (row.querySelector('.shPct') as HTMLInputElement).value;
        it.start = (row.querySelector('.shStart') as HTMLInputElement).value;
        it.end = (row.querySelector('.shEnd') as HTMLInputElement).value;
        it.isNew = (row.querySelector('.shNew') as HTMLInputElement).checked;
      };
      row.querySelectorAll('input').forEach(inp => inp.addEventListener('change', sync));
    });
  };

  try {
    const j = await apiJson('/api/shop');
    items = (j.items || []).map((i: any) => ({
      id: i.id, name: i.name, category: i.category, base: i.base,
      price: i.price?.toString() ?? '', pct: i.pct?.toString() ?? '',
      start: toLocal(i.start), end: toLocal(i.end), isNew: !!i.isNew, was: i.effective,
    }));
    (document.getElementById('salePct') as HTMLInputElement).value = j.sale?.pct?.toString() ?? '';
    (document.getElementById('saleStart') as HTMLInputElement).value = toLocal(j.sale?.start);
    (document.getElementById('saleEnd') as HTMLInputElement).value = toLocal(j.sale?.end);
    paint();
  } catch (e: any) {
    if (onAuth(e)) return;
    root.querySelector('.adminList')!.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }

  document.getElementById('shQ')?.addEventListener('input', () => paint((document.getElementById('shQ') as HTMLInputElement).value));
  root.querySelector('[data-act="sale-clear"]')?.addEventListener('click', () => {
    (document.getElementById('salePct') as HTMLInputElement).value = '';
    (document.getElementById('saleStart') as HTMLInputElement).value = '';
    (document.getElementById('saleEnd') as HTMLInputElement).value = '';
  });
  root.querySelector('[data-act="shop-save"]')?.addEventListener('click', async () => {
    root.querySelectorAll('.shopRow').forEach(row => {
      const id = (row as HTMLElement).dataset.id!;
      const it = items.find(x => x.id === id);
      if (!it) return;
      it.price = (row.querySelector('.shPrice') as HTMLInputElement).value;
      it.pct = (row.querySelector('.shPct') as HTMLInputElement).value;
      it.start = (row.querySelector('.shStart') as HTMLInputElement).value;
      it.end = (row.querySelector('.shEnd') as HTMLInputElement).value;
      it.isNew = (row.querySelector('.shNew') as HTMLInputElement).checked;
    });
    const payloadItems = items
      .filter(r => num(r.price) != null || num(r.pct) != null || r.isNew)
      .map(r => ({ id: r.id, price: num(r.price), pct: num(r.pct), start: fromLocal(r.start), end: fromLocal(r.end), isNew: r.isNew }));
    const sale = {
      pct: num((document.getElementById('salePct') as HTMLInputElement).value),
      start: fromLocal((document.getElementById('saleStart') as HTMLInputElement).value),
      end: fromLocal((document.getElementById('saleEnd') as HTMLInputElement).value),
    };
    try {
      await apiJson('/api/shop', { method: 'POST', body: JSON.stringify({ items: payloadItems, sale }) });
      showMsg(root, '已儲存價格');
      void renderShop();
    } catch (e: any) {
      if (!onAuth(e)) showMsg(root, e?.message || '失敗', true);
    }
  });
}

/* ─── 賺錢設定 ─── */
async function renderEconomy() {
  setHint('與後台「賺錢設定」相同：分區編輯後儲存／重設。');
  const root = bodyEl();
  root.innerHTML = backBar('賺錢設定') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  try {
    const j = await apiJson('/api/economy');
    let cfg = fillEco(j.cfg || {});
    const defaults = fillEco(j.defaults || {});
    const paint = () => {
      list.innerHTML = `<p class="adminMeta">上次儲存：${j.updatedAt ? tw(j.updatedAt) : '尚未自訂（用遊戲內建）'}</p>
      <div class="adminActions">
        <button type="button" data-act="eco-defaults">填回預設</button>
        <button type="button" data-act="eco-reset">重設資料庫</button>
        <button type="button" class="adminPrimary" data-act="eco-save">儲存</button>
      </div>
      <div class="adminCard"><b>入碗工錢</b>
        <div class="adminGrid2">${DIFF.map((n, i) => `<label>${n} $<input data-dpay="${i}" type="number" value="${cfg.dpay[i]}"></label>`).join('')}
        <label>殼屑比例 <input data-k="crumbRate" type="number" step="0.05" value="${cfg.crumbRate}"></label>
        <label>臨時工扣薪 $<input data-k="tempCut" type="number" value="${cfg.tempCut}"></label>
        <label>俐落即時 +$<input data-k="quickBonus" type="number" value="${cfg.quickBonus}"></label>
        <label>收工俐落 ×$<input data-k="perfectPay" type="number" value="${cfg.perfectPay}"></label></div>
      </div>
      <div class="adminCard"><b>懲罰／偷肉／額外</b>
        <div class="adminGrid2">
          <label>工寮偷罰 $<input data-k="yardStealFine" type="number" value="${cfg.yardStealFine}"></label>
          <label>偷肉難度 <select data-k="yardStealDiff">${DIFF.map((n, i) => `<option value="${i}" ${cfg.yardStealDiff === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>廣場偷罰 $<input data-k="plazaStealPen" type="number" value="${cfg.plazaStealPen}"></label>
          <label>連抓禁偷次數 <input data-k="plazaStealBanN" type="number" value="${cfg.plazaStealBanN}"></label>
          <label>禁偷毫秒 <input data-k="plazaStealBanMs" type="number" value="${cfg.plazaStealBanMs}"></label>
          <label>對方碗最少顆數 <input data-k="plazaStealMinCount" type="number" value="${cfg.plazaStealMinCount}"></label>
          <label>和平獎勵 $<input data-k="peaceBonus" type="number" value="${cfg.peaceBonus}"></label>
          <label>夜班倍率 <input data-k="nightMult" type="number" step="0.05" value="${cfg.nightMult}"></label>
          <label>有效上工最少入碗 <input data-k="workedMinCount" type="number" value="${cfg.workedMinCount}"></label>
        </div>
      </div>
      <div class="adminCard"><b>每日上工費／回歸／初始</b>
        <div class="adminGrid2">${cfg.dailyPays.map((v: number, i: number) => `<label>第 ${i + 1} 天 $<input data-daily="${i}" type="number" value="${v}"></label>`).join('')}
        <label>初始金額 $<input data-k="startMoney" type="number" value="${cfg.startMoney}"></label>
        <label>回歸≥7天 $<input data-k="return7" type="number" value="${cfg.return7}"></label>
        <label>回歸≥30天 $<input data-k="return30" type="number" value="${cfg.return30}"></label></div>
      </div>
      <div class="adminCard"><b>地點倍率</b>
        <div class="adminGrid2">${LOCS.map(L => `<label>${esc(L.n)} ×<input data-loc="${L.id}" type="number" step="0.05" value="${cfg.locMult[L.id] ?? 1}"></label>`).join('')}</div>
      </div>
      <div class="adminCard"><b>珍珠售價</b>
        <div class="adminGrid2">${RAR.map((n, i) => `<label>${n} $<input data-rar="${i}" type="number" value="${cfg.rarPrices[i]}"></label>`).join('')}</div>
      </div>
      <div class="adminCard"><b>廣場結算上限</b>
        <p class="adminHint">時長／入碗 softCap 已停用；入帳＝本機試算，只砍絕對天花板。</p>
        <div class="adminGrid2">
          <label>絕對天花板 $<input data-k="plazaMaxEarn" type="number" value="${cfg.plazaMaxEarn}"></label>
        </div>
      </div>`;

      const read = () => {
        const next = fillEco(cfg);
        list.querySelectorAll('input[data-k],select[data-k]').forEach(el => {
          const inp = el as HTMLInputElement;
          const k = inp.dataset.k!;
          const n = Number(inp.value);
          (next as any)[k] = Number.isFinite(n) ? n : inp.value;
        });
        list.querySelectorAll('input[data-dpay]').forEach(el => {
          const inp = el as HTMLInputElement;
          next.dpay[+inp.dataset.dpay!] = Math.floor(Number(inp.value) || 0);
        });
        list.querySelectorAll('input[data-daily]').forEach(el => {
          const inp = el as HTMLInputElement;
          next.dailyPays[+inp.dataset.daily!] = Math.floor(Number(inp.value) || 0);
        });
        list.querySelectorAll('input[data-rar]').forEach(el => {
          const inp = el as HTMLInputElement;
          next.rarPrices[+inp.dataset.rar!] = Math.floor(Number(inp.value) || 0);
        });
        list.querySelectorAll('input[data-loc]').forEach(el => {
          const inp = el as HTMLInputElement;
          next.locMult[inp.dataset.loc!] = Number(inp.value) || 1;
        });
        return next;
      };

      list.querySelector('[data-act="eco-defaults"]')?.addEventListener('click', () => {
        cfg = fillEco(defaults);
        paint();
        showMsg(root, '已填回內建值（尚未儲存）');
      });
      list.querySelector('[data-act="eco-reset"]')?.addEventListener('click', async () => {
        if (!confirm('恢復成遊戲內建預設？後台自訂會刪除。')) return;
        try {
          const r = await apiJson('/api/economy', { method: 'POST', body: JSON.stringify({ reset: true }) });
          cfg = fillEco(r.cfg);
          paint();
          showMsg(root, '已恢復內建預設');
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      });
      list.querySelector('[data-act="eco-save"]')?.addEventListener('click', async () => {
        const body = read();
        if (!confirm('儲存後玩家約 15 秒內會拉到新設定。確定？')) return;
        try {
          const r = await apiJson('/api/economy', { method: 'POST', body: JSON.stringify({ cfg: body }) });
          cfg = fillEco(r.cfg);
          paint();
          showMsg(root, '已儲存');
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      });
    };
    paint();
  } catch (e: any) {
    if (onAuth(e)) return;
    list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

/* ─── 問卷 ─── */
async function renderSurveys() {
  setHint('新增／編輯題目、查看答卷、刪除，與後台問卷頁相同。');
  const root = bodyEl();
  root.innerHTML = backBar('問卷調查') + `<div class="adminActions"><button type="button" class="adminPrimary" data-act="sv-new">＋ 新增問卷</button></div><div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  let rows: any[] = [];
  let oddsSkew = 0;

  const statusOf = (r: any) => {
    const t = Date.now() + oddsSkew;
    const s = r.survey;
    return !r.enabled ? '停用' : t < s.start ? '排程中' : t < s.end ? '進行中' : '已結束';
  };

  const load = async () => {
    list.textContent = '載入中…';
    try {
      const j = await apiJson('/api/surveys');
      oddsSkew = (j.serverTime || Date.now()) - Date.now();
      rows = j.surveys || [];
      list.innerHTML = rows.map(r => {
        const s = r.survey;
        return `<div class="adminCard">
          <b>${esc(s.title)} <small class="adminTag">${esc(statusOf(r))}</small></b>
          <span>${s.questions?.length || 0} 題・獎勵 ${money(s.rewardMoney)}・完成 ${r.stats?.completions ?? 0}</span>
          <small>${tw(s.start)} ～ ${tw(s.end)}</small>
          <p>${esc(s.desc || '')}</p>
          <div class="adminActions">
            <button type="button" data-sv-del="${s.id}">刪除</button>
            <button type="button" data-sv-resp="${s.id}">查看答卷</button>
            <button type="button" data-sv-edit="${s.id}">編輯</button>
          </div>
        </div>`;
      }).join('') || '<p class="adminMeta">還沒有問卷</p>';
      list.querySelectorAll('[data-sv-del]').forEach(b => b.addEventListener('click', async () => {
        const id = Number((b as HTMLElement).dataset.svDel);
        if (!confirm('刪除這份問卷？（答卷會保留）')) return;
        try { await apiJson('/api/surveys/delete', { method: 'POST', body: JSON.stringify({ id }) }); await load(); }
        catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      }));
      list.querySelectorAll('[data-sv-edit]').forEach(b => b.addEventListener('click', () => {
        const id = Number((b as HTMLElement).dataset.svEdit);
        editSurvey(rows.find(r => r.survey.id === id));
      }));
      list.querySelectorAll('[data-sv-resp]').forEach(b => b.addEventListener('click', () => {
        const id = Number((b as HTMLElement).dataset.svResp);
        void viewSurveyResp(rows.find(r => r.survey.id === id));
      }));
    } catch (e: any) {
      if (onAuth(e)) return;
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  const blankQ = (i: number) => ({ id: `q${i}`, type: 'single', text: '', required: true, options: ['選項 A', '選項 B'], maxLen: '200' });

  const editSurvey = (row?: any) => {
    const s = row?.survey;
    const ed = s ? {
      id: s.id, title: s.title, desc: s.desc, rewardMoney: String(s.rewardMoney),
      start: toLocal(s.start), end: toLocal(s.end), enabled: !!row.enabled,
      questions: (s.questions || []).map((q: any, i: number) => ({
        id: q.id || `q${i + 1}`, type: q.type, text: q.text, required: q.required !== false,
        options: q.options?.length ? [...q.options] : ['選項 A', '選項 B'],
        maxLen: String(q.maxLen ?? 200),
      })),
    } : {
      id: null, title: '', desc: '', rewardMoney: '0',
      start: toLocal(Date.now()), end: toLocal(Date.now() + 7 * 86400e3), enabled: true,
      questions: [blankQ(1)],
    };

    const paintEd = () => {
      root.innerHTML = backBar(ed.id ? '編輯問卷' : '新增問卷', 'surveys') + `<div class="adminForm" id="svEd">
        <label>名稱 <input id="svTitle" maxlength="40" value="${esc(ed.title)}"></label>
        <label>說明 <textarea id="svDesc" maxlength="400" rows="2">${esc(ed.desc)}</textarea></label>
        <label>開始 <input id="svStart" type="datetime-local" value="${esc(ed.start)}"></label>
        <label>結束 <input id="svEnd" type="datetime-local" value="${esc(ed.end)}"></label>
        <label>完成獎勵 $<input id="svReward" type="number" min="0" value="${esc(ed.rewardMoney)}"></label>
        <label class="adminChk"><input type="checkbox" id="svOn" ${ed.enabled ? 'checked' : ''}> 啟用</label>
        <div class="adminActions"><button type="button" data-act="sv-addq">＋ 加題</button></div>
        <div id="svQs"></div>
        <button type="button" class="adminPrimary" data-act="sv-save">儲存</button>
      </div>`;
      const qsEl = document.getElementById('svQs')!;
      qsEl.innerHTML = ed.questions.map((q: any, i: number) => `
        <div class="adminCard" data-qi="${i}">
          <div class="adminActions">
            <b>第 ${i + 1} 題</b>
            <select data-qtype>${QTYPES.map(t => `<option value="${t.v}" ${q.type === t.v ? 'selected' : ''}>${t.n}</option>`).join('')}</select>
            <label class="adminChk"><input type="checkbox" data-qreq ${q.required ? 'checked' : ''}> 必填</label>
            <button type="button" data-qup ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-qdn ${i === ed.questions.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" data-qrm ${ed.questions.length <= 1 ? 'disabled' : ''}>移除</button>
          </div>
          <label>題目 <input data-qtext maxlength="200" value="${esc(q.text)}"></label>
          ${q.type === 'text'
            ? `<label>字數上限 <input data-qmax type="number" min="1" max="500" value="${esc(q.maxLen)}"></label>`
            : `${(q.options || []).map((o: string, oi: number) =>
                `<div class="adminRow"><input data-qopt="${oi}" maxlength="80" value="${esc(o)}"><button type="button" data-qoptrm="${oi}" ${(q.options.length <= 2) ? 'disabled' : ''}>移除</button></div>`,
              ).join('')}<button type="button" data-qoptadd ${q.options.length >= 20 ? 'disabled' : ''}>＋ 加選項</button>`}
        </div>`).join('');

      const syncFromDom = () => {
        ed.title = (document.getElementById('svTitle') as HTMLInputElement).value;
        ed.desc = (document.getElementById('svDesc') as HTMLTextAreaElement).value;
        ed.start = (document.getElementById('svStart') as HTMLInputElement).value;
        ed.end = (document.getElementById('svEnd') as HTMLInputElement).value;
        ed.rewardMoney = (document.getElementById('svReward') as HTMLInputElement).value;
        ed.enabled = (document.getElementById('svOn') as HTMLInputElement).checked;
        qsEl.querySelectorAll('[data-qi]').forEach(card => {
          const i = Number((card as HTMLElement).dataset.qi);
          const q = ed.questions[i];
          q.type = (card.querySelector('[data-qtype]') as HTMLSelectElement).value;
          q.required = (card.querySelector('[data-qreq]') as HTMLInputElement).checked;
          q.text = (card.querySelector('[data-qtext]') as HTMLInputElement).value;
          if (q.type === 'text') q.maxLen = (card.querySelector('[data-qmax]') as HTMLInputElement)?.value || '200';
          else {
            q.options = Array.from(card.querySelectorAll('[data-qopt]')).map(inp => (inp as HTMLInputElement).value);
          }
        });
      };

      qsEl.querySelectorAll('[data-qtype]').forEach(sel => sel.addEventListener('change', () => {
        syncFromDom();
        const i = Number((sel as HTMLElement).closest('[data-qi]')!.getAttribute('data-qi'));
        const q = ed.questions[i];
        if (q.type === 'text') { if (!q.maxLen) q.maxLen = '200'; }
        else if (!q.options?.length) q.options = ['選項 A', '選項 B'];
        paintEd();
      }));
      qsEl.querySelectorAll('[data-qup]').forEach(b => b.addEventListener('click', () => {
        syncFromDom();
        const i = Number((b as HTMLElement).closest('[data-qi]')!.getAttribute('data-qi'));
        if (i <= 0) return;
        const t = ed.questions[i]; ed.questions[i] = ed.questions[i - 1]; ed.questions[i - 1] = t;
        paintEd();
      }));
      qsEl.querySelectorAll('[data-qdn]').forEach(b => b.addEventListener('click', () => {
        syncFromDom();
        const i = Number((b as HTMLElement).closest('[data-qi]')!.getAttribute('data-qi'));
        if (i >= ed.questions.length - 1) return;
        const t = ed.questions[i]; ed.questions[i] = ed.questions[i + 1]; ed.questions[i + 1] = t;
        paintEd();
      }));
      qsEl.querySelectorAll('[data-qrm]').forEach(b => b.addEventListener('click', () => {
        syncFromDom();
        const i = Number((b as HTMLElement).closest('[data-qi]')!.getAttribute('data-qi'));
        if (ed.questions.length <= 1) return;
        ed.questions.splice(i, 1);
        paintEd();
      }));
      qsEl.querySelectorAll('[data-qoptadd]').forEach(b => b.addEventListener('click', () => {
        syncFromDom();
        const i = Number((b as HTMLElement).closest('[data-qi]')!.getAttribute('data-qi'));
        ed.questions[i].options.push(`選項 ${ed.questions[i].options.length + 1}`);
        paintEd();
      }));
      qsEl.querySelectorAll('[data-qoptrm]').forEach(b => b.addEventListener('click', () => {
        syncFromDom();
        const card = (b as HTMLElement).closest('[data-qi]')!;
        const i = Number(card.getAttribute('data-qi'));
        const oi = Number((b as HTMLElement).dataset.qoptrm);
        if (ed.questions[i].options.length <= 2) return;
        ed.questions[i].options.splice(oi, 1);
        paintEd();
      }));
      root.querySelector('[data-act="sv-addq"]')?.addEventListener('click', () => {
        syncFromDom();
        ed.questions.push(blankQ(ed.questions.length + 1));
        paintEd();
      });
      root.querySelector('[data-act="sv-save"]')?.addEventListener('click', async () => {
        syncFromDom();
        const questions = ed.questions.map((q: any, i: number) => {
          const base: any = {
            id: String(q.id || `q${i + 1}`).trim() || `q${i + 1}`,
            type: q.type, text: String(q.text ?? '').trim(), required: !!q.required,
          };
          if (q.type === 'text') base.maxLen = num(q.maxLen) ?? 200;
          else base.options = (q.options || []).map((o: string) => String(o ?? '').trim()).filter(Boolean);
          return base;
        });
        const body = {
          id: ed.id, title: ed.title, desc: ed.desc,
          rewardMoney: num(ed.rewardMoney) ?? 0,
          start: fromLocal(ed.start), end: fromLocal(ed.end),
          enabled: !!ed.enabled, questions,
        };
        try {
          await apiJson('/api/surveys', { method: 'POST', body: JSON.stringify(body) });
          showMsg(root, '已儲存');
          void renderSurveys();
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      });
    };
    paintEd();
  };

  const viewSurveyResp = async (row?: any) => {
    if (!row) return;
    root.innerHTML = backBar(`答卷・${row.survey.title}`, 'surveys') + `<div class="adminList">載入中…</div>`;
    const box = root.querySelector('.adminList')!;
    try {
      const j = await apiJson(`/api/surveys/responses?id=${row.survey.id}`);
      const qs = j.survey?.questions ?? row.survey.questions;
      const responses = j.responses || [];
      const fmtAns = (q: any, a: unknown) => {
        if (a == null) return '—';
        if (q.type === 'text') return String(a);
        if (q.type === 'single') { const i = Number(a); return q.options?.[i] ?? `#${i}`; }
        if (Array.isArray(a)) return a.map(i => q.options?.[Number(i)] ?? `#${i}`).join('、') || '—';
        return String(a);
      };
      box.innerHTML = `<p class="adminMeta">共 ${responses.length} 份</p>` + (responses.length ? responses.map((rp: any) =>
        `<div class="adminCard"><b>${esc(rp.nick || '（無暱稱）')} #${esc(rp.tag)}</b><small>${tw(rp.ts)}${rp.test ? '・測試' : ''}</small>
        <ul class="adminUl">${qs.map((q: any) => `<li><span class="adminMuted">${esc(q.text)}</span>：${esc(fmtAns(q, rp.answers?.[q.id]))}</li>`).join('')}</ul></div>`,
      ).join('') : '<p class="adminMeta">還沒有人填</p>');
    } catch (e: any) {
      if (onAuth(e)) return;
      box.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  root.querySelector('[data-act="sv-new"]')?.addEventListener('click', () => editSurvey());
  await load();
}

/* ─── 公告 ─── */
async function renderNotices() {
  setHint('新增／編輯／刪除公告；進行中才會顯示給玩家。');
  const root = bodyEl();
  root.innerHTML = backBar('遊戲公告') + `<div class="adminActions"><button type="button" class="adminPrimary" data-act="nt-new">＋ 新增公告</button></div><div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  let rows: any[] = [];
  let skew = 0;

  const statusOf = (r: any) => {
    const t = Date.now() + skew;
    const n = r.notice;
    return !r.enabled ? '停用' : t < n.start ? '排程中' : t < n.end ? '進行中' : '已結束';
  };

  const load = async () => {
    list.textContent = '載入中…';
    try {
      const j = await apiJson('/api/notices');
      skew = (j.serverTime || Date.now()) - Date.now();
      rows = j.notices || [];
      list.innerHTML = rows.map(r => {
        const n = r.notice;
        return `<div class="adminCard"><b>${esc(n.title)} <small class="adminTag">${esc(statusOf(r))}</small></b>
          <small>${tw(n.start)} ～ ${tw(n.end)}・更新 ${tw(n.updated)}</small>
          <pre class="adminPre">${esc(n.body)}</pre>
          <div class="adminActions">
            <button type="button" data-nt-del="${n.id}">刪除</button>
            <button type="button" data-nt-edit="${n.id}">編輯</button>
          </div></div>`;
      }).join('') || '<p class="adminMeta">還沒有公告</p>';
      list.querySelectorAll('[data-nt-del]').forEach(b => b.addEventListener('click', async () => {
        const id = Number((b as HTMLElement).dataset.ntDel);
        if (!confirm('刪除公告？')) return;
        try { await apiJson('/api/notices/delete', { method: 'POST', body: JSON.stringify({ id }) }); await load(); }
        catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      }));
      list.querySelectorAll('[data-nt-edit]').forEach(b => b.addEventListener('click', () => {
        const id = Number((b as HTMLElement).dataset.ntEdit);
        editNotice(rows.find(r => r.notice.id === id));
      }));
    } catch (e: any) {
      if (onAuth(e)) return;
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  const editNotice = (row?: any) => {
    const n = row?.notice;
    const ed = n
      ? { id: n.id, title: n.title, body: n.body, start: toLocal(n.start), end: toLocal(n.end), enabled: !!row.enabled }
      : { id: null as null, title: '', body: '', start: toLocal(Date.now()), end: toLocal(Date.now() + 7 * 86400e3), enabled: true };
    root.innerHTML = backBar(ed.id ? '編輯公告' : '新增公告', 'notices') + `<div class="adminForm">
      <label>標題 <input id="ntTitle" maxlength="60" value="${esc(ed.title)}"></label>
      <label>內容 <textarea id="ntBody" maxlength="4000" rows="6">${esc(ed.body)}</textarea></label>
      <label>開始 <input id="ntStart" type="datetime-local" value="${esc(ed.start)}"></label>
      <label>結束 <input id="ntEnd" type="datetime-local" value="${esc(ed.end)}"></label>
      <label class="adminChk"><input type="checkbox" id="ntOn" ${ed.enabled ? 'checked' : ''}> 啟用</label>
      <button type="button" class="adminPrimary" data-act="nt-save">儲存</button>
    </div>`;
    root.querySelector('[data-act="nt-save"]')?.addEventListener('click', async () => {
      const body = {
        id: ed.id,
        title: (document.getElementById('ntTitle') as HTMLInputElement).value.trim(),
        body: (document.getElementById('ntBody') as HTMLTextAreaElement).value.trim(),
        start: fromLocal((document.getElementById('ntStart') as HTMLInputElement).value),
        end: fromLocal((document.getElementById('ntEnd') as HTMLInputElement).value),
        enabled: (document.getElementById('ntOn') as HTMLInputElement).checked,
      };
      try {
        await apiJson('/api/notices', { method: 'POST', body: JSON.stringify(body) });
        showMsg(root, '已儲存');
        void renderNotices();
      } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
    });
  };

  root.querySelector('[data-act="nt-new"]')?.addEventListener('click', () => editNotice());
  await load();
}

/* ─── 活動 ─── */
async function renderEvents() {
  setHint('新增／編輯／刪除活動場景（含奇物獎勵）。');
  const root = bodyEl();
  root.innerHTML = backBar('活動場景') + `<div class="adminActions"><button type="button" class="adminPrimary" data-act="ev-new">＋ 新增活動</button></div><div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  let rows: any[] = [];
  let odds: { i: number; name: string; rarity?: string }[] = [];
  let skew = 0;

  const statusOf = (r: any) => {
    const t = Date.now() + skew;
    return !r.enabled ? '停用' : t < r.ev.start ? '排程中' : t < r.ev.end ? '進行中' : '已結束';
  };
  const load = async () => {
    list.textContent = '載入中…';
    try {
      const j = await apiJson('/api/events');
      skew = (j.serverTime || Date.now()) - Date.now();
      rows = j.events || [];
      odds = j.odds || [];
      list.innerHTML = rows.map(r => {
        const e = r.ev;
        return `<div class="adminCard">
          <b>${esc(e.name)} <small class="adminTag">${esc(statusOf(r))}</small></b>
          <span>NPC ${e.npc}・${e.dur}s・${esc(STEAL[e.steal] || e.steal)}・參加 ${r.stats?.participants ?? 0}</span>
          <small>${tw(e.start)} ～ ${tw(e.end)}</small>
          <p>${esc(e.desc || '')}</p>
          <div class="adminActions">
            <button type="button" data-ev-del="${e.id}">刪除</button>
            <button type="button" data-ev-edit="${e.id}">編輯</button>
          </div>
        </div>`;
      }).join('') || '<p class="adminMeta">還沒有活動</p>';
      list.querySelectorAll('[data-ev-del]').forEach(b => b.addEventListener('click', async () => {
        const id = Number((b as HTMLElement).dataset.evDel);
        if (!confirm('刪除活動？（成績會保留）')) return;
        try { await apiJson('/api/events/delete', { method: 'POST', body: JSON.stringify({ id }) }); await load(); }
        catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      }));
      list.querySelectorAll('[data-ev-edit]').forEach(b => b.addEventListener('click', () => {
        const id = Number((b as HTMLElement).dataset.evEdit);
        editEvent(rows.find(r => r.ev.id === id));
      }));
    } catch (e: any) {
      if (onAuth(e)) return;
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  const editEvent = (row?: any) => {
    const e = row?.ev;
    const ed: any = e ? {
      id: e.id, name: e.name, desc: e.desc, npc: String(e.npc), dur: String(e.dur),
      throwX: String(e.throwX), angerX: String(e.angerX), bonus: String(e.bonus), earlyBonus: String(e.earlyBonus),
      earlyMeat: e.earlyMeat == null ? '' : String(e.earlyMeat), infHp: !!e.infHp, steal: e.steal,
      maxPlays: e.maxPlays > 0 ? String(e.maxPlays) : '1', unlim: !(e.maxPlays > 0),
      oddDone: (e.oddDone || []).map((o: any) => ({ ...o })), oddEarly: (e.oddEarly || []).map((o: any) => ({ ...o })),
      start: toLocal(e.start), end: toLocal(e.end), enabled: !!row.enabled,
    } : {
      id: null, name: '', desc: '', npc: '6', dur: '180', throwX: '1', angerX: '1', bonus: '0', earlyBonus: '0',
      earlyMeat: '', infHp: false, steal: 'normal', maxPlays: '1', unlim: true, oddDone: [], oddEarly: [],
      start: toLocal(Date.now()), end: toLocal(Date.now() + 7 * 86400e3), enabled: true,
    };

    const paintEd = () => {
      const oddOpts = (sel: number) => odds.map(o =>
        `<option value="${o.i}" ${o.i === sel ? 'selected' : ''}>${esc(o.name)}${o.rarity ? `（${esc(o.rarity)}）` : ''}</option>`,
      ).join('');
      const oddBlock = (key: 'oddDone' | 'oddEarly', title: string) => `
        <div class="adminCard"><b>${title}</b>
          ${(ed[key] as any[]).map((o, i) => `
            <div class="adminRow" data-odd="${key}" data-oi="${i}">
              <select data-oddi>${oddOpts(o.i)}</select>
              <label>數量 <input data-oddn type="number" min="1" max="99" value="${o.n}"></label>
              <button type="button" data-oddrm>移除</button>
            </div>`).join('') || '<p class="adminMeta">無</p>'}
          <button type="button" data-oddadd="${key}" ${odds.length ? '' : 'disabled'}>＋ 加奇物</button>
        </div>`;

      root.innerHTML = backBar(ed.id ? '編輯活動' : '新增活動', 'events') + `<div class="adminForm" id="evEd">
        <label>名稱 <input id="evName" maxlength="20" value="${esc(ed.name)}"></label>
        <label>說明 <textarea id="evDesc" maxlength="200" rows="2">${esc(ed.desc)}</textarea></label>
        <label>開始 <input id="evStart" type="datetime-local" value="${esc(ed.start)}"></label>
        <label>結束 <input id="evEnd" type="datetime-local" value="${esc(ed.end)}"></label>
        <label>NPC 人數 <input id="evNpc" type="number" min="1" max="50" value="${esc(ed.npc)}"></label>
        <label>上工秒數 <input id="evDur" type="number" min="30" max="1800" value="${esc(ed.dur)}"></label>
        <label>丟殼倍率 <input id="evThrow" type="number" step="0.1" value="${esc(ed.throwX)}"></label>
        <label>怒氣倍率 <input id="evAnger" type="number" step="0.1" value="${esc(ed.angerX)}"></label>
        <label>完工獎勵 $<input id="evBonus" type="number" min="0" value="${esc(ed.bonus)}"></label>
        <label>提前額外 $<input id="evEarlyBonus" type="number" min="0" value="${esc(ed.earlyBonus)}"></label>
        <label>提前肉數 <input id="evEarlyMeat" type="number" min="1" value="${esc(ed.earlyMeat)}" placeholder="空白＝無"></label>
        <label>可玩次數 <input id="evMax" type="number" min="1" max="1000" value="${esc(ed.maxPlays)}" ${ed.unlim ? 'disabled' : ''}></label>
        <label class="adminChk"><input type="checkbox" id="evUnlim" ${ed.unlim ? 'checked' : ''}> 次數無限制</label>
        <label>偷肉規則 <select id="evSteal">${Object.entries(STEAL).map(([v, n]) => `<option value="${v}" ${ed.steal === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="adminChk"><input type="checkbox" id="evInfHp" ${ed.infHp ? 'checked' : ''}> 無限血條</label>
        <label class="adminChk"><input type="checkbox" id="evOn" ${ed.enabled ? 'checked' : ''}> 啟用</label>
        ${oddBlock('oddDone', '完工奇物獎勵')}
        ${oddBlock('oddEarly', '提前完工奇物獎勵')}
        <button type="button" class="adminPrimary" data-act="ev-save">儲存</button>
      </div>`;

      const syncOdds = () => {
        root.querySelectorAll('[data-odd]').forEach(row => {
          const key = (row as HTMLElement).dataset.odd as 'oddDone' | 'oddEarly';
          const oi = Number((row as HTMLElement).dataset.oi);
          ed[key][oi].i = Number((row.querySelector('[data-oddi]') as HTMLSelectElement).value);
          ed[key][oi].n = Number((row.querySelector('[data-oddn]') as HTMLInputElement).value) || 1;
        });
      };

      document.getElementById('evUnlim')?.addEventListener('change', () => {
        ed.unlim = (document.getElementById('evUnlim') as HTMLInputElement).checked;
        (document.getElementById('evMax') as HTMLInputElement).disabled = ed.unlim;
      });
      root.querySelectorAll('[data-oddadd]').forEach(b => b.addEventListener('click', () => {
        syncOdds();
        const key = (b as HTMLElement).dataset.oddadd as 'oddDone' | 'oddEarly';
        ed[key].push({ i: odds[0]?.i ?? 0, n: 1 });
        paintEd();
      }));
      root.querySelectorAll('[data-oddrm]').forEach(b => b.addEventListener('click', () => {
        syncOdds();
        const row = (b as HTMLElement).closest('[data-odd]') as HTMLElement;
        const key = row.dataset.odd as 'oddDone' | 'oddEarly';
        ed[key].splice(Number(row.dataset.oi), 1);
        paintEd();
      }));
      root.querySelector('[data-act="ev-save"]')?.addEventListener('click', async () => {
        syncOdds();
        const body = {
          id: ed.id,
          name: (document.getElementById('evName') as HTMLInputElement).value,
          desc: (document.getElementById('evDesc') as HTMLTextAreaElement).value,
          npc: num((document.getElementById('evNpc') as HTMLInputElement).value),
          dur: num((document.getElementById('evDur') as HTMLInputElement).value),
          throwX: num((document.getElementById('evThrow') as HTMLInputElement).value, true),
          angerX: num((document.getElementById('evAnger') as HTMLInputElement).value, true),
          bonus: num((document.getElementById('evBonus') as HTMLInputElement).value) ?? 0,
          earlyBonus: num((document.getElementById('evEarlyBonus') as HTMLInputElement).value) ?? 0,
          earlyMeat: num((document.getElementById('evEarlyMeat') as HTMLInputElement).value),
          infHp: (document.getElementById('evInfHp') as HTMLInputElement).checked,
          steal: (document.getElementById('evSteal') as HTMLSelectElement).value,
          maxPlays: (document.getElementById('evUnlim') as HTMLInputElement).checked ? 0 : num((document.getElementById('evMax') as HTMLInputElement).value),
          oddDone: ed.oddDone.map((o: any) => ({ i: num(o.i), n: num(o.n) })),
          oddEarly: ed.oddEarly.map((o: any) => ({ i: num(o.i), n: num(o.n) })),
          start: fromLocal((document.getElementById('evStart') as HTMLInputElement).value),
          end: fromLocal((document.getElementById('evEnd') as HTMLInputElement).value),
          enabled: (document.getElementById('evOn') as HTMLInputElement).checked,
        };
        try {
          await apiJson('/api/events', { method: 'POST', body: JSON.stringify(body) });
          showMsg(root, '已儲存');
          void renderEvents();
        } catch (err: any) { if (!onAuth(err)) showMsg(root, err?.message || '失敗', true); }
      });
    };
    paintEd();
  };

  root.querySelector('[data-act="ev-new"]')?.addEventListener('click', () => editEvent());
  await load();
}

/* ─── 回饋 ─── */
async function renderFeedback(cat = '') {
  setHint('玩家回饋（檢視；可依類別篩選）。');
  const root = bodyEl();
  root.innerHTML = backBar('玩家回饋') + `<div class="adminTabs">${FB_CATS.map(([c, n]) =>
    `<button type="button" class="${c === cat ? 'on' : ''}" data-fbcat="${esc(c)}">${esc(n)}</button>`,
  ).join('')}</div><div class="adminList">載入中…</div>`;
  root.querySelectorAll('[data-fbcat]').forEach(b => b.addEventListener('click', () => {
    void renderFeedback((b as HTMLElement).dataset.fbcat || '');
  }));
  const list = root.querySelector('.adminList')!;
  try {
    const rows = await apiJson<any[]>(`/api/feedback?cat=${encodeURIComponent(cat)}`);
    const names = Object.fromEntries(FB_CATS.slice(1));
    list.innerHTML = rows.slice(0, 80).map(f =>
      `<div class="adminCard"><b>${esc(names[f.cat] || f.cat || '')}</b><small>${tw(f.ts)}</small>
      <p>${esc(f.text || '')}</p>
      ${f.contact ? `<small>聯絡：${esc(f.contact)}</small>` : ''}
      ${f.meta ? `<small class="adminMuted">${esc(Object.entries(f.meta).map(([k, v]) => `${k}: ${v}`).join('・'))}</small>` : ''}
      </div>`,
    ).join('') || '<p class="adminMeta">沒有回饋</p>';
  } catch (e: any) {
    if (onAuth(e)) return;
    list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

/* ─── 廣場 ─── */
async function renderPlaza() {
  setHint('廣場狀態、代發聊天、旗幟審核（收起／清字／刪除）。');
  const root = bodyEl();
  root.innerHTML = backBar('廣場／旗幟') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;

  const load = async () => {
    try {
      const [st, fl] = await Promise.all([
        apiJson('/api/plaza'),
        apiJson('/api/plaza/flags').catch(() => ({ flags: [] })),
      ]);
      const flags = fl.flags || [];
      list.innerHTML = `
        <div class="adminCard">
          <b>狀態</b>
          <span>在場 ${st.online ?? 0}／可坐 ${st.capacity ?? '–'}・坐下 ${st.seated ?? 0}</span>
          <span>你（#${esc(st.tag)}）${st.inPlaza ? (st.dormant ? '在場・休眠' : '在場') : '不在廣場'}${st.me ? `・${esc(st.me.nick)}` : ''}</span>
        </div>
        <div class="adminCard"><b>在場玩家</b>
          ${(st.players || []).map((p: any) =>
            `<div class="adminMini">${esc(p.nick || '？')}${p.tag ? ` #${esc(p.tag)}` : ''}・${p.seated ? `坐 p${p.pileId}s${p.slot}` : '閒逛'}${p.mine ? '（你）' : ''}</div>`,
          ).join('') || '<p class="adminMeta">目前沒人</p>'}
        </div>
        <div class="adminCard"><b>聊天代發</b>
          <label class="adminChk"><input type="checkbox" id="pzPile"> 只給同堆</label>
          <div class="adminRow"><input id="pzText" maxlength="80" placeholder="${st.inPlaza ? '以你在廣場的身分發言' : '需先進入廣場才能發言'}" ${st.inPlaza ? '' : 'disabled'}>
          <button type="button" data-act="pz-send" ${st.inPlaza ? '' : 'disabled'}>送出</button></div>
          <div class="adminChat">${(st.chat || []).slice(-40).map((c: any) =>
            `<div class="adminMini${c.mine ? ' mine' : ''}"><b>${esc(c.nick)}${c.tag ? ` #${esc(c.tag)}` : ''}</b> ${esc(c.text)} <small>${esc(tw(c.at).slice(11))}</small></div>`,
          ).join('') || '<p class="adminMeta">尚無訊息</p>'}</div>
        </div>
        <div class="adminCard"><b>旗幟（已插 ${flags.filter((f: any) => f.planted).length}）</b>
          ${flags.map((f: any) =>
            `<div class="adminCard">
              <b>${esc(f.nick || f.k)}${f.tag ? ` #${esc(f.tag)}` : ''}</b>
              <span>${f.planted ? '已插' : '未插'}・(${Number(f.x).toFixed(1)}, ${Number(f.z).toFixed(1)})</span>
              <pre class="adminPre">${esc(f.text || '（無文字）')}</pre>
              <div class="adminActions">
                <button type="button" data-flag="${esc(f.k)}" data-faction="unplant" ${f.planted ? '' : 'disabled'}>收起</button>
                <button type="button" data-flag="${esc(f.k)}" data-faction="clear_text" ${f.text ? '' : 'disabled'}>清字</button>
                <button type="button" data-flag="${esc(f.k)}" data-faction="delete">刪除</button>
              </div>
            </div>`,
          ).join('') || '<p class="adminMeta">尚無旗幟</p>'}
        </div>
        <button type="button" data-act="pz-refresh">重新整理</button>`;

      list.querySelector('[data-act="pz-refresh"]')?.addEventListener('click', () => void load());
      list.querySelector('[data-act="pz-send"]')?.addEventListener('click', async () => {
        const text = (document.getElementById('pzText') as HTMLInputElement).value.trim();
        if (!text) { showMsg(root, '請輸入內容', true); return; }
        try {
          const j = await apiJson('/api/plaza', {
            method: 'POST',
            body: JSON.stringify({ text, pileOnly: (document.getElementById('pzPile') as HTMLInputElement).checked }),
          });
          if (!j.ok) {
            const e = j.err || 'fail';
            showMsg(root, e === 'not_in_plaza' ? '你不在廣場了' : e === 'slow' ? '太快了' : `失敗（${e}）`, true);
          } else {
            showMsg(root, '已送出');
            (document.getElementById('pzText') as HTMLInputElement).value = '';
          }
          await load();
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      });
      list.querySelectorAll('[data-flag]').forEach(b => b.addEventListener('click', async () => {
        const el = b as HTMLElement;
        const action = el.dataset.faction!;
        const pid = el.dataset.flag!;
        if (action === 'delete' && !confirm('刪除這支旗紀錄？升級進度會一起清掉。')) return;
        try {
          const j = await apiJson('/api/plaza/flags', { method: 'POST', body: JSON.stringify({ pid, action }) });
          if (!j.ok) showMsg(root, `操作失敗（${j.err || 'fail'}）`, true);
          else showMsg(root, action === 'unplant' ? '已收起' : action === 'clear_text' ? '已清空文字' : '已刪除');
          await load();
        } catch (e: any) { if (!onAuth(e)) showMsg(root, e?.message || '失敗', true); }
      }));
    } catch (e: any) {
      if (onAuth(e)) return;
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };
  await load();
}

async function openView(id: string) {
  const map: Record<string, () => Promise<void>> = {
    players: renderPlayers,
    gifts: () => renderGifts(),
    leaderboard: renderLeaderboard,
    shop: renderShop,
    economy: renderEconomy,
    surveys: renderSurveys,
    notices: renderNotices,
    events: renderEvents,
    feedback: () => renderFeedback(),
    plaza: renderPlaza,
  };
  const fn = map[id];
  if (fn) await fn();
}

export function openAdminTools() {
  if (!isAdminPlayer()) { syncAdminBtn(); return; }
  $('adminTools').classList.add('show');
  if (!getPw()) renderLogin();
  else renderHub();
}

export function initAdminTools() {
  const btn = document.getElementById('oAdmin');
  if (btn) btn.addEventListener('click', () => openAdminTools());
  const close = document.getElementById('adminToolsClose');
  if (close) close.addEventListener('click', () => $('adminTools').classList.remove('show'));
  bodyEl()?.addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-view]');
    if (!t) return;
    const act = t.dataset.act;
    const view = t.dataset.view;
    if (act === 'login') void tryLogin();
    else if (act === 'hub') renderHub();
    else if (act === 'players') void renderPlayers();
    else if (act === 'surveys') void renderSurveys();
    else if (act === 'notices') void renderNotices();
    else if (act === 'events') void renderEvents();
    else if (act === 'logout') { clearPw(); renderLogin(); }
    else if (view) void openView(view);
  });
  syncAdminBtn();
}
