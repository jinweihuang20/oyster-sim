/**
 * #5636 遊戲內後台：呼叫 StatsServer /api/*（Basic 密碼），不導外網。
 * 功能對齊後台：送禮、玩家、商店價格、問卷、公告、賺錢設定等。
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
  { group: '經濟', id: 'shop', label: '商店價格', icon: 'ic-shop' },
  { group: '經濟', id: 'economy', label: '賺錢設定', icon: 'ic-coin' },
  { group: '內容', id: 'surveys', label: '問卷調查', icon: 'ic-chat' },
  { group: '內容', id: 'notices', label: '遊戲公告', icon: 'ic-horn' },
  { group: '內容', id: 'events', label: '活動場景', icon: 'ic-lantern' },
  { group: '其他', id: 'feedback', label: '玩家回饋', icon: 'ic-chat' },
  { group: '其他', id: 'plaza', label: '廣場狀態', icon: 'ic-flag' },
];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const tw = (ts: number) => {
  try { return new Date(ts + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); }
  catch { return ''; }
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

function backBar(title: string) {
  return `<div class="adminBar"><button type="button" class="adminBack" data-act="hub">← 選單</button><b>${esc(title)}</b></div>`;
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
  setHint('選一項管理功能。資料走後端 /api（需密碼）。');
  const groups = [...new Set(HUB.map(h => h.group))];
  bodyEl().innerHTML = groups.map(g => {
    const items = HUB.filter(h => h.group === g);
    return `<div class="adminGrp"><div class="adminGrpH">${esc(g)}</div>
      <div class="sysGrid adminGrid">${items.map(it =>
        `<button type="button" data-view="${it.id}"><i class="ic ${it.icon}"></i><span>${esc(it.label)}</span></button>`,
      ).join('')}</div></div>`;
  }).join('') + `<p class="adminNote"><button type="button" data-act="logout" class="adminLink">清除密碼／登出</button></p>`;
}

async function renderPlayers() {
  const root = bodyEl();
  root.innerHTML = backBar('玩家') + `<div class="adminRow"><input id="apQ" placeholder="搜尋暱稱／#編號"><button type="button" data-act="players-search">搜尋</button></div><div class="adminList">載入中…</div>`;
  const load = async (q = '') => {
    const list = root.querySelector('.adminList')!;
    list.textContent = '載入中…';
    try {
      const j = await apiJson(`/api/players?game=oyster-sim&size=40&q=${encodeURIComponent(q)}`);
      const rows = j.rows as any[];
      list.innerHTML = `<p class="adminMeta">共 ${j.total}・線上 ${j.online}</p>` + (rows.length ? rows.map(r =>
        `<div class="adminCard"><b>${esc(r.nick || '？')} <small>#${esc(r.tag || '')}</small></b>
        <span>${r.online ? '🟢 在線' : '離線'}・班次 ${r.shifts ?? 0}・收入 $${Number(r.income || 0).toLocaleString()}</span>
        <small>${esc(r.device || '')} ${esc(r.version || '')}</small></div>`,
      ).join('') : '<p class="adminMeta">沒有結果</p>');
    } catch (e: any) {
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message === 'auth' ? '請重新登入' : e?.message || '失敗')}</p>`;
      if (e?.message === 'auth') renderLogin();
    }
  };
  root.querySelector('[data-act="players-search"]')?.addEventListener('click', () => {
    void load((document.getElementById('apQ') as HTMLInputElement)?.value || '');
  });
  await load();
}

async function renderGifts() {
  const root = bodyEl();
  root.innerHTML = backBar('送禮') + `<div class="adminForm" id="gfForm">
    <label><input type="checkbox" id="gfAll"> 全體玩家</label>
    <label>目標 <input id="gfTarget" placeholder="#5636"></label>
    <label>類型 <select id="gfType"><option value="money">金錢</option><option value="pearl">珍珠</option><option value="odd">奇物索引</option><option value="item">道具 id</option><option value="equip">裝備 id</option></select></label>
    <label id="gfAmtL">金額 <input id="gfAmt" type="number" min="1" value="1000"></label>
    <label id="gfIdL" style="display:none">id／tier <input id="gfId" placeholder="pearl tier 0-3 或 odd-3／item-moon"></label>
    <label>留言 <input id="gfMsg" maxlength="200"></label>
    <button type="button" class="adminPrimary" data-act="gift-send">送出</button>
  </div><div class="adminList">載入中…</div>`;

  const syncType = () => {
    const t = (document.getElementById('gfType') as HTMLSelectElement).value;
    (document.getElementById('gfAmtL') as HTMLElement).style.display = t === 'money' ? '' : 'none';
    (document.getElementById('gfIdL') as HTMLElement).style.display = t === 'money' ? 'none' : '';
  };
  document.getElementById('gfType')?.addEventListener('change', syncType);
  document.getElementById('gfAll')?.addEventListener('change', () => {
    const on = (document.getElementById('gfAll') as HTMLInputElement).checked;
    (document.getElementById('gfTarget') as HTMLInputElement).disabled = on;
  });

  const load = async () => {
    const list = root.querySelector('.adminList')!;
    try {
      const rows = await apiJson<any[]>('/api/gifts');
      list.innerHTML = rows.slice(0, 40).map(g =>
        `<div class="adminCard${g.revoked ? ' dim' : ''}"><b>#${g.id} ${esc(g.label)}</b>
        <span>${esc(g.type)}${g.amount != null ? ` $${g.amount}` : ''}${g.itemId ? ` ${esc(g.itemId)}` : ''}${g.tier != null ? ` tier${g.tier}` : ''}</span>
        <small>${tw(g.createdAt)}・領 ${g.claims}${g.revoked ? '・已撤回' : ''}</small>
        ${g.revoked ? '' : `<button type="button" data-revoke="${g.id}">撤回</button>`}</div>`,
      ).join('') || '<p class="adminMeta">還沒有禮物</p>';
      list.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
        const id = Number((b as HTMLElement).dataset.revoke);
        if (!confirm(`撤回禮物 #${id}？`)) return;
        try { await apiJson('/api/gifts/revoke', { method: 'POST', body: JSON.stringify({ id }) }); await load(); }
        catch (e: any) { showMsg(root, e?.message || '失敗', true); }
      }));
    } catch (e: any) {
      if (e?.message === 'auth') { renderLogin(); return; }
      list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  root.querySelector('[data-act="gift-send"]')?.addEventListener('click', async () => {
    const all = (document.getElementById('gfAll') as HTMLInputElement).checked;
    const target = all ? '全體玩家' : (document.getElementById('gfTarget') as HTMLInputElement).value.trim();
    const type = (document.getElementById('gfType') as HTMLSelectElement).value;
    const message = (document.getElementById('gfMsg') as HTMLInputElement).value;
    const body: any = { target, type, message };
    if (type === 'money') body.amount = Number((document.getElementById('gfAmt') as HTMLInputElement).value);
    else if (type === 'pearl') body.tier = Number((document.getElementById('gfId') as HTMLInputElement).value);
    else body.id = (document.getElementById('gfId') as HTMLInputElement).value.trim();
    if (!target) { showMsg(root, '請填目標', true); return; }
    try {
      const j = await apiJson('/api/gifts', { method: 'POST', body: JSON.stringify(body) });
      showMsg(root, `已送給 ${j.label}`);
      await load();
    } catch (e: any) {
      if (e?.message === 'auth') renderLogin();
      else showMsg(root, e?.message || '失敗', true);
    }
  });
  await load();
}

async function renderShop() {
  const root = bodyEl();
  root.innerHTML = backBar('商店價格') + `<div class="adminRow"><input id="shQ" placeholder="搜尋物品"><button type="button" class="adminPrimary" data-act="shop-save">儲存改價</button></div><div class="adminList">載入中…</div>`;
  let items: any[] = [];
  let sale: any = {};
  const list = root.querySelector('.adminList')!;
  const paint = (q = '') => {
    const qq = q.trim();
    const rows = items.filter(i => !qq || i.name.includes(qq) || i.id.includes(qq));
    list.innerHTML = rows.map(i =>
      `<div class="adminCard shopRow" data-id="${esc(i.id)}"><b>${esc(i.name)}</b><small>${esc(i.id)}・底價 $${i.base}・現 $${i.effective}</small>
      <label>改價 <input class="shPrice" type="number" min="1" value="${i.price ?? ''}" placeholder="空白=底價"></label></div>`,
    ).join('') || '<p class="adminMeta">沒有物品</p>';
  };
  try {
    const j = await apiJson('/api/shop');
    items = j.items || [];
    sale = j.sale || {};
    paint();
  } catch (e: any) {
    if (e?.message === 'auth') { renderLogin(); return; }
    list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
  document.getElementById('shQ')?.addEventListener('input', () => paint((document.getElementById('shQ') as HTMLInputElement).value));
  root.querySelector('[data-act="shop-save"]')?.addEventListener('click', async () => {
    const payloadItems = Array.from(list.querySelectorAll('.shopRow')).map(row => {
      const id = (row as HTMLElement).dataset.id!;
      const v = (row.querySelector('.shPrice') as HTMLInputElement).value.trim();
      const orig = items.find(x => x.id === id);
      return { id, price: v === '' ? null : Number(v), pct: orig?.pct ?? null, start: orig?.start ?? null, end: orig?.end ?? null, isNew: !!orig?.isNew };
    }).filter(x => x.price != null || items.find(i => i.id === x.id)?.price != null);
    try {
      await apiJson('/api/shop', { method: 'POST', body: JSON.stringify({ items: payloadItems, sale }) });
      showMsg(root, '已儲存價格');
      const j = await apiJson('/api/shop');
      items = j.items || []; sale = j.sale || {};
      paint((document.getElementById('shQ') as HTMLInputElement)?.value || '');
    } catch (e: any) {
      if (e?.message === 'auth') renderLogin();
      else showMsg(root, e?.message || '失敗', true);
    }
  });
}

async function renderEconomy() {
  const root = bodyEl();
  root.innerHTML = backBar('賺錢設定') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  try {
    const j = await apiJson('/api/economy');
    const eco = { ...(j.cfg || {}) };
    const fields = Object.keys(eco).filter(k => typeof eco[k] === 'number' || typeof eco[k] === 'string' || typeof eco[k] === 'boolean');
    const arrays = Object.keys(eco).filter(k => Array.isArray(eco[k]));
    list.innerHTML = `<p class="adminMeta">更新：${j.updatedAt ? tw(j.updatedAt) : '預設'}</p>
      <div class="adminForm" id="ecoForm">${fields.map(k =>
      `<label>${esc(k)} <input data-k="${esc(k)}" value="${esc(eco[k])}"></label>`,
    ).join('')}${arrays.map(k =>
      `<label>${esc(k)} <input data-arr="${esc(k)}" value="${esc((eco[k] as number[]).join(','))}" placeholder="逗號分隔"></label>`,
    ).join('')}<button type="button" class="adminPrimary" data-act="eco-save">儲存</button></div>
      <p class="adminNote">陣列／倍率表請用逗號數字；複雜欄位請用後台網頁。</p>`;
    list.querySelector('[data-act="eco-save"]')?.addEventListener('click', async () => {
      const cfg: any = { ...eco };
      list.querySelectorAll('input[data-k]').forEach(inp => {
        const el = inp as HTMLInputElement;
        const k = el.dataset.k!;
        const raw = el.value.trim();
        const n = Number(raw);
        cfg[k] = raw === 'true' ? true : raw === 'false' ? false : Number.isFinite(n) && raw !== '' ? n : raw;
      });
      list.querySelectorAll('input[data-arr]').forEach(inp => {
        const el = inp as HTMLInputElement;
        cfg[el.dataset.arr!] = el.value.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n));
      });
      try {
        await apiJson('/api/economy', { method: 'POST', body: JSON.stringify({ cfg }) });
        showMsg(root, '已儲存');
      } catch (e: any) {
        if (e?.message === 'auth') renderLogin();
        else showMsg(root, e?.message || '失敗', true);
      }
    });
  } catch (e: any) {
    if (e?.message === 'auth') renderLogin();
    else list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

async function renderSurveys() {
  const root = bodyEl();
  root.innerHTML = backBar('問卷調查') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  try {
    const j = await apiJson('/api/surveys');
    const rows = j.surveys as any[];
    list.innerHTML = rows.map(r => {
      const s = r.survey;
      return `<div class="adminCard"><b>${esc(s.title)}</b>
        <span>${r.enabled ? '啟用' : '停用'}・完成 ${r.stats?.completions ?? 0}</span>
        <small>${tw(s.start)} ～ ${tw(s.end)}</small>
        <p>${esc(s.desc || '')}</p>
        <button type="button" data-del="${s.id}">刪除</button></div>`;
    }).join('') || '<p class="adminMeta">還沒有問卷（完整編輯題目請用後台網頁）</p>';
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const id = Number((b as HTMLElement).dataset.del);
      if (!confirm('刪除這份問卷？')) return;
      try {
        await apiJson('/api/surveys/delete', { method: 'POST', body: JSON.stringify({ id }) });
        void renderSurveys();
      } catch (e: any) { showMsg(root, e?.message || '失敗', true); }
    }));
  } catch (e: any) {
    if (e?.message === 'auth') renderLogin();
    else list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

async function renderNotices() {
  const root = bodyEl();
  root.innerHTML = backBar('遊戲公告') + `<div class="adminForm">
    <label>標題 <input id="ntTitle" maxlength="60"></label>
    <label>內容 <textarea id="ntBody" maxlength="4000" rows="4"></textarea></label>
    <label>開始 <input id="ntStart" type="datetime-local"></label>
    <label>結束 <input id="ntEnd" type="datetime-local"></label>
    <label><input type="checkbox" id="ntOn" checked> 啟用</label>
    <button type="button" class="adminPrimary" data-act="nt-save">新增公告</button>
  </div><div class="adminList">載入中…</div>`;

  const toLocal = (ts: number) => new Date(ts + 8 * 3600e3).toISOString().slice(0, 16);
  const fromLocal = (v: string) => v ? Date.parse(v + ':00Z') - 8 * 3600e3 : null;

  const load = async () => {
    const list = root.querySelector('.adminList')!;
    try {
      const j = await apiJson('/api/notices');
      const rows = j.notices as any[];
      list.innerHTML = rows.map(r => {
        const n = r.notice;
        return `<div class="adminCard"><b>${esc(n.title)}</b>
          <span>${r.enabled ? '啟用' : '停用'}</span>
          <small>${tw(n.start)} ～ ${tw(n.end)}</small>
          <pre class="adminPre">${esc(n.body)}</pre>
          <button type="button" data-del="${n.id}">刪除</button></div>`;
      }).join('') || '<p class="adminMeta">還沒有公告</p>';
      list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        const id = Number((b as HTMLElement).dataset.del);
        if (!confirm('刪除公告？')) return;
        try {
          await apiJson('/api/notices/delete', { method: 'POST', body: JSON.stringify({ id }) });
          await load();
        } catch (e: any) { showMsg(root, e?.message || '失敗', true); }
      }));
    } catch (e: any) {
      if (e?.message === 'auth') renderLogin();
      else list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
    }
  };

  // 預設：現在～+7 天
  const now = Date.now();
  (document.getElementById('ntStart') as HTMLInputElement).value = toLocal(now);
  (document.getElementById('ntEnd') as HTMLInputElement).value = toLocal(now + 7 * 86400e3);

  root.querySelector('[data-act="nt-save"]')?.addEventListener('click', async () => {
    const body = {
      id: null as null,
      title: (document.getElementById('ntTitle') as HTMLInputElement).value.trim(),
      body: (document.getElementById('ntBody') as HTMLTextAreaElement).value.trim(),
      start: fromLocal((document.getElementById('ntStart') as HTMLInputElement).value),
      end: fromLocal((document.getElementById('ntEnd') as HTMLInputElement).value),
      enabled: (document.getElementById('ntOn') as HTMLInputElement).checked,
    };
    try {
      await apiJson('/api/notices', { method: 'POST', body: JSON.stringify(body) });
      showMsg(root, '已新增');
      (document.getElementById('ntTitle') as HTMLInputElement).value = '';
      (document.getElementById('ntBody') as HTMLTextAreaElement).value = '';
      await load();
    } catch (e: any) {
      if (e?.message === 'auth') renderLogin();
      else showMsg(root, e?.message || '失敗', true);
    }
  });
  await load();
}

async function renderEvents() {
  const root = bodyEl();
  root.innerHTML = backBar('活動場景') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  try {
    const j = await apiJson('/api/events');
    const rows = j.events as any[];
    list.innerHTML = rows.map(r => {
      const e = r.ev;
      return `<div class="adminCard"><b>${esc(e.name)}</b>
        <span>${r.enabled ? '啟用' : '停用'}・參加 ${r.stats?.participants ?? 0}</span>
        <small>${tw(e.start)} ～ ${tw(e.end)}</small>
        <p>${esc(e.desc || '')}</p></div>`;
    }).join('') || '<p class="adminMeta">還沒有活動</p>';
  } catch (e: any) {
    if (e?.message === 'auth') renderLogin();
    else list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

async function renderFeedback() {
  const root = bodyEl();
  root.innerHTML = backBar('玩家回饋') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  try {
    const rows = await apiJson<any[]>('/api/feedback');
    list.innerHTML = rows.slice(0, 50).map(f =>
      `<div class="adminCard"><b>${esc(f.cat || '')}</b><small>${tw(f.ts)}</small>
      <p>${esc(f.text || '')}</p>
      ${f.contact ? `<small>聯絡：${esc(f.contact)}</small>` : ''}</div>`,
    ).join('') || '<p class="adminMeta">沒有回饋</p>';
  } catch (e: any) {
    if (e?.message === 'auth') renderLogin();
    else list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

async function renderPlaza() {
  const root = bodyEl();
  root.innerHTML = backBar('廣場狀態') + `<div class="adminList">載入中…</div>`;
  const list = root.querySelector('.adminList')!;
  try {
    const j = await apiJson('/api/plaza');
    list.innerHTML = `<pre class="adminPre">${esc(JSON.stringify(j, null, 2))}</pre>`;
  } catch (e: any) {
    if (e?.message === 'auth') renderLogin();
    else list.innerHTML = `<p class="adminMsg bad">${esc(e?.message || '失敗')}</p>`;
  }
}

async function openView(id: string) {
  const map: Record<string, () => Promise<void>> = {
    players: renderPlayers,
    gifts: renderGifts,
    shop: renderShop,
    economy: renderEconomy,
    surveys: renderSurveys,
    notices: renderNotices,
    events: renderEvents,
    feedback: renderFeedback,
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
    else if (act === 'logout') { clearPw(); renderLogin(); }
    else if (view) void openView(view);
  });
  syncAdminBtn();
}
