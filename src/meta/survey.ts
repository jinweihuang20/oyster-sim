import * as SocialNS from './social';
import { evLeft } from './events';

export type SurveyHost = {
  $: (id: string) => HTMLElement;
  persist: () => void;
  toast: (t: string, c?: string) => void;
  esc: (s: string) => string;
  Social: typeof SocialNS;
  SFX: { jingle: (up?: boolean) => void; pop: () => void };
  LS: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void };
  renderDaily: () => void;
  bootQuiet: () => boolean;
  get save(): any;
  get state(): string;
  get tut(): any;
};

let H: SurveyHost;

type SvCfg = SocialNS.SurveyCfg;
export let svList: SvCfg[] = [], svSkew = 0, svBusy = false, svOpenId: number | null = null;
const svClaimed = (id: number) => (H.save.svClaim ??= []).includes(id);
export const svPending = () => svList.filter(s => !s.done && !svClaimed(s.id) && Date.now() + svSkew < s.end);
function svValid(s: any): s is SvCfg {
  return s && Number.isInteger(s.id) && typeof s.title === 'string' && Array.isArray(s.questions) && s.questions.length > 0 && Number.isFinite(s.end);
}
function svNormalize(s: any): SvCfg | null {
  if (!svValid(s)) return null;
  const qs: SocialNS.SurveyQ[] = [];
  for (const q of s.questions) {
    if (!q || typeof q.id !== 'string' || typeof q.text !== 'string') continue;
    const type = q.type === 'multi' || q.type === 'text' ? q.type : 'single';
    if (type === 'text') qs.push({ id: q.id, type, text: q.text, required: q.required !== false, maxLen: Math.min(500, Math.max(1, Math.floor(Number(q.maxLen) || 200))) });
    else {
      const options = Array.isArray(q.options) ? q.options.filter((o: unknown) => typeof o === 'string').map((o: string) => o.slice(0, 80)) : [];
      if (options.length < 2) continue;
      qs.push({ id: q.id, type, text: q.text, required: q.required !== false, options });
    }
  }
  if (!qs.length) return null;
  return { id: s.id, title: String(s.title).slice(0, 40), desc: typeof s.desc === 'string' ? s.desc.slice(0, 400) : '', questions: qs, rewardMoney: Math.max(0, Math.floor(Number(s.rewardMoney) || 0)), start: Number(s.start) || 0, end: Number(s.end), done: s.done === true || svClaimed(s.id) };
}
export let svPrompted = false;
const SV_ALERT_MUTE_OLD = 'svAlertMute';
const SV_ALERT_MUTE_IDS = 'svAlertMutedIds';
function svLoadMutedIds(): number[] {
  try {
    const raw = JSON.parse(H.LS.getItem(SV_ALERT_MUTE_IDS) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((x: unknown) => typeof x === 'number' && Number.isInteger(x) && x > 0).slice(-80);
  } catch { return []; }
}
function svSaveMutedIds(ids: number[]) {
  try { H.LS.setItem(SV_ALERT_MUTE_IDS, JSON.stringify([...new Set(ids)].slice(-80))); } catch { /* 忽略 */ }
}
/** 舊版永久 mute → 改壓住當下 pending，避免已選過的人又被煩 */
function svMigrateMuteFlag() {
  try {
    if (H.LS.getItem(SV_ALERT_MUTE_OLD) !== '1') return;
    const ids = [...svLoadMutedIds(), ...svPending().map(s => s.id)];
    svSaveMutedIds(ids);
    H.LS.removeItem(SV_ALERT_MUTE_OLD);
  } catch { /* 忽略 */ }
}
function svMutePendingAlerts() {
  svSaveMutedIds([...svLoadMutedIds(), ...svPending().map(s => s.id)]);
}
/** 尚未被「不再提示」壓住的未填問卷（有新 id 才會再跳） */
const svAlertable = () => {
  const muted = new Set(svLoadMutedIds());
  return svPending().filter(s => !muted.has(s.id));
};
export function svRender() {
  const box = H.$('svEntry');
  const now = Date.now() + svSkew;
  svList = svList.filter(s => now < s.end);
  const pending = svPending();
  if (!pending.length) { box.style.display = 'none'; box.classList.remove('svNeed'); return; }
  const soon = Math.min(...pending.map(s => s.end));
  box.innerHTML = `<div class="svHd"><i class="ic ic-chat"></i><b>問卷調查</b><span class="svBadge">未填 ${pending.length}</span><span class="svLeft"><i class="ic ic-timer"></i> 剩 ${evLeft(soon - now)}</span></div>` +
    `<p class="svMeta">填完送出可領現金・每人每份只能填一次</p>` +
    `<div class="svList">${pending.map(s => `<div class="svRow"><b>${H.esc(s.title)}</b><span class="svMeta">$${s.rewardMoney.toLocaleString()}・${s.questions.length} 題</span><button type="button" data-sv="${s.id}">填寫</button></div>`).join('')}</div>`;
  box.classList.add('svNeed');
  box.style.display = '';
}
export async function svFetch() {
  svList = []; svRender();
  const r = await H.Social.svActive();
  if (!r) { svList = []; svRender(); return; }
  svSkew = r.serverTime - Date.now();
  svList = r.surveys.map(svNormalize).filter((s): s is SvCfg => !!s);
  svMigrateMuteFlag();
  svRender();
  svAlert();
}
/** 回主選單時提示有未填問卷（每次最多一次；「不再提示」只壓住目前這批，新問卷再提醒） */
export function svAlert() {
  svMigrateMuteFlag();
  const alertable = svAlertable();
  if (svPrompted || !alertable.length) return;
  if (H.bootQuiet()) return; // 新人先完成教學再提示問卷（入口仍在主畫面）
  if (H.state === 'play' || H.tut || !H.$('overlay').classList.contains('show')) return;
  if (document.getElementById('giftMsg') || document.getElementById('newMsg') || document.getElementById('featMsg') || document.getElementById('svMsg') || document.getElementById('plazaGuide') || H.$('sv').classList.contains('show')) return;
  svPrompted = true;
  const m = document.createElement('div'); m.id = 'svMsg'; m.className = 'giftMsg';
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-chat"></i> 有未填寫的問卷</b>` +
    `<ul class="gnList">${alertable.map(s => `<li><b>${H.esc(s.title)}</b>${s.rewardMoney ? `<br><small>完成可領 $${s.rewardMoney.toLocaleString()}</small>` : ''}</li>`).join('')}</ul>` +
    `<div class="mbtns"><button class="gmMute" type="button">不再提示</button><button class="gmNo" type="button">稍後</button><button class="gmYes" type="button"><i class="ic ic-chat"></i> 去填寫</button></div></div>`;
  const close = () => m.remove();
  m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
  m.addEventListener('click', e => { if (e.target === m) close(); });
  m.querySelector('.gmMute')?.addEventListener('click', () => {
    svMutePendingAlerts();
    close();
    H.toast('之後不會再提醒這幾份問卷（有新問卷還會提示）');
  });
  m.querySelector('.gmYes')?.addEventListener('click', () => {
    close();
    H.$('overlay').scrollTop = Math.max(0, H.$('svEntry').offsetTop - 40);
    const first = alertable[0];
    if (first) svOpen(first.id);
  });
  document.body.appendChild(m);
}
export function svOpen(id: number) {
  const s = svList.find(x => x.id === id);
  if (!s || s.done || svClaimed(id)) { H.toast('這份問卷你填過了'); svRender(); return; }
  document.getElementById('svMsg')?.remove();
  svOpenId = id;
  const body = H.$('svBody');
  body.innerHTML = `<div class="svName">${H.esc(s.title)}</div>${s.desc ? `<p class="svDesc">${H.esc(s.desc)}</p>` : ''}<p class="svMeta">完成獎勵 $${s.rewardMoney.toLocaleString()}</p>` +
    s.questions.map((q, i) => {
      const req = q.required ? '<span class="req">必填</span>' : '';
      if (q.type === 'text') return `<div class="svQ" data-qid="${H.esc(q.id)}" data-type="text"><h3>${i + 1}. ${H.esc(q.text)}${req}</h3><textarea maxlength="${q.maxLen ?? 200}" placeholder="寫在這裡…"></textarea><p class="svHint">最多 ${q.maxLen ?? 200} 字</p></div>`;
      const input = q.type === 'multi' ? 'checkbox' : 'radio';
      const opts = (q.options ?? []).map((o, oi) => `<label><input type="${input}" name="sv_${H.esc(q.id)}" value="${oi}"> <span>${H.esc(o)}</span></label>`).join('');
      return `<div class="svQ" data-qid="${H.esc(q.id)}" data-type="${q.type}"><h3>${i + 1}. ${H.esc(q.text)}${req}</h3><div class="svOpts">${opts}</div></div>`;
    }).join('') + '<p id="svErr" class="svErr" style="display:none"></p>';
  H.$('svSubmit').style.display = '';
  H.$('sv').classList.add('show');
}
function svCollect(s: SvCfg): { answers: Record<string, unknown> } | { error: string } {
  const answers: Record<string, unknown> = {};
  for (const q of s.questions) {
    const box = Array.from(document.querySelectorAll('#svBody .svQ')).find(el => (el as HTMLElement).dataset.qid === q.id) as HTMLElement | undefined;
    if (!box) return { error: '畫面有問題，請關閉重開' };
    if (q.type === 'text') {
      const t = (box.querySelector('textarea') as HTMLTextAreaElement)?.value ?? '';
      if (q.required && !t.trim()) return { error: `請回答「${q.text}」` };
      if (t.length > (q.maxLen ?? 200)) return { error: `「${q.text}」太長了` };
      if (t.trim() || q.required) answers[q.id] = t;
      continue;
    }
    const picked = Array.from(box.querySelectorAll('input:checked')).map(el => +(el as HTMLInputElement).value).filter(n => Number.isInteger(n));
    if (q.type === 'single') {
      if (!picked.length) { if (q.required) return { error: `請回答「${q.text}」` }; continue; }
      answers[q.id] = picked[0];
    } else {
      if (!picked.length) { if (q.required) return { error: `請回答「${q.text}」` }; continue; }
      answers[q.id] = picked;
    }
  }
  return { answers };
}
async function svDoSubmit() {
  if (svBusy || svOpenId == null) return;
  const s = svList.find(x => x.id === svOpenId);
  if (!s) { H.$('sv').classList.remove('show'); return; }
  const errEl = document.getElementById('svErr');
  const got = svCollect(s);
  if ('error' in got) { if (errEl) { errEl.style.display = ''; errEl.textContent = got.error; } return; }
  if (errEl) errEl.style.display = 'none';
  svBusy = true; const btn = H.$('svSubmit') as HTMLButtonElement; btn.disabled = true;
  const r = await H.Social.svSubmit(s.id, got.answers);
  svBusy = false; btn.disabled = false;
  if (r.st === 'ok') {
    H.save.svClaim ??= []; if (!H.save.svClaim.includes(s.id)) H.save.svClaim.push(s.id);
    H.save.svClaim = H.save.svClaim.slice(-50);
    if (r.money > 0) H.save.money += r.money;
    s.done = true; H.persist(); H.renderDaily();
    H.$('sv').classList.remove('show'); svOpenId = null; svRender();
    H.toast(r.money > 0 ? `問卷送出了！領到 $${r.money}` : '問卷送出了，多謝幫忙！', '#9fe0ff');
    try { H.SFX.jingle(); } catch { /* */ }
    return;
  }
  if (r.st === 'already') { s.done = true; H.save.svClaim ??= []; if (!H.save.svClaim.includes(s.id)) { H.save.svClaim.push(s.id); H.persist(); } H.$('sv').classList.remove('show'); svRender(); H.toast('這份問卷你填過了'); return; }
  if (r.st === 'ended') { H.toast('問卷已經結束了'); H.$('sv').classList.remove('show'); svFetch(); return; }
  if (r.st === 'bad') { if (errEl) { errEl.style.display = ''; errEl.textContent = r.error ?? '答案有問題，再檢查一下'; } return; }
  H.toast('連不上伺服器，等一下再試');
}
export function setSvPrompted(v: boolean) { svPrompted = v; }

export function initSurvey(host: SurveyHost) {
  H = host;
  H.$('svClose').onclick = () => { H.$('sv').classList.remove('show'); svOpenId = null; };
  H.$('svSubmit').onclick = () => { void svDoSubmit(); };
  H.$('svEntry').onclick = (e) => {
    const t = (e.target as HTMLElement | null)?.closest?.('[data-sv]') as HTMLElement | null;
    if (!t) return;
    e.preventDefault();
    svOpen(+t.getAttribute('data-sv')!);
  };
}
