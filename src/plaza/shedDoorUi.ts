/** 廣場北碼頭：站在工寮門口按「進入」後的小面板（選班別／提早解鎖） */

export type ShedDoorPanelOpts = {
  name: string;
  mult: number;
  desc: string;
  unlocked: boolean;
  /** 未解鎖：條件文字，例如「入碗 120/200 顆解鎖」 */
  needText?: string;
  /** 未解鎖：提早解鎖價格（null＝不開放） */
  price?: number | null;
  money?: number;
  /** 廣場這趟已有收入：先結算再去 */
  settleFirst?: boolean;
  shifts: { len: number; label: string; sub?: string }[];
  onShift: (len: number) => void;
  /** 回傳 true＝已解鎖成功（面板會重畫成可進入） */
  onUnlock?: () => Promise<boolean>;
  /** 每幀檢查：離開圓圈就自動關掉 */
  stillNear: () => boolean;
};

let el: HTMLDivElement | null = null;
let raf = 0;
let cur: ShedDoorPanelOpts | null = null;
let confirmT: ReturnType<typeof setTimeout> | null = null;

export const shedDoorPanelOpen = () => !!el;

export function closeShedDoorPanel() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (confirmT) { clearTimeout(confirmT); confirmT = null; }
  el?.remove();
  el = null;
  cur = null;
  removeEventListener('keydown', onKey, true);
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape') { e.preventDefault(); closeShedDoorPanel(); }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function render() {
  if (!el || !cur) return;
  const o = cur;
  const head = `<div class="sdHead"><b>${esc(o.name)}</b><span class="sdMult">工錢 ×${o.mult.toFixed(1)}</span></div><p class="sdDesc">${esc(o.desc)}</p>`;
  let body = '';
  if (o.unlocked) {
    body = (o.settleFirst ? `<p class="sdNote"><i class="ic ic-coin"></i> 廣場這趟的收入會先結算，再去上工</p>` : '') +
      `<div class="sdShifts">${o.shifts.map((s, i) => `<button type="button" class="sdGo${i === 0 ? ' main' : ''}" data-len="${s.len}">${esc(s.label)}${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</button>`).join('')}</div>`;
  } else {
    const pr = o.price;
    const can = pr != null && (o.money ?? 0) >= pr;
    body = `<p class="sdLock"><i class="ic ic-lock"></i> ${esc(o.needText ?? '還沒解鎖')}</p>` +
      (pr != null
        ? `<div class="sdShifts"><button type="button" class="sdGo main sdBuy" ${can ? '' : 'disabled'}>花 $${pr} 提早解鎖</button></div>` +
          (can ? '' : `<p class="sdNote">錢不夠（目前 $${o.money ?? 0}）</p>`)
        : '');
  }
  el.innerHTML = `<div class="sdBox" role="dialog" aria-label="${esc(o.name)}">${head}${body}<button type="button" class="sdX">先不要</button></div>`;
  el.querySelector<HTMLButtonElement>('.sdX')!.onclick = () => closeShedDoorPanel();
  el.querySelectorAll<HTMLButtonElement>('button[data-len]').forEach(b => b.onclick = () => {
    const len = Number(b.dataset.len);
    closeShedDoorPanel();
    o.onShift(len);
  });
  const buy = el.querySelector<HTMLButtonElement>('.sdBuy');
  if (buy && o.onUnlock) buy.onclick = async () => {
    if (!buy.classList.contains('confirm')) {
      buy.classList.add('confirm');
      buy.textContent = `確定花 $${o.price} 解鎖？再按一次`;
      if (confirmT) clearTimeout(confirmT);
      confirmT = setTimeout(() => { if (cur === o) render(); }, 4000);
      return;
    }
    if (confirmT) { clearTimeout(confirmT); confirmT = null; }
    buy.disabled = true;
    const ok = await o.onUnlock!();
    if (cur !== o) return;
    if (ok) o.unlocked = true;
    render();
  };
}

export function openShedDoorPanel(o: ShedDoorPanelOpts) {
  closeShedDoorPanel();
  if (document.pointerLockElement) document.exitPointerLock();
  cur = o;
  el = document.createElement('div');
  el.id = 'shedDoor';
  document.body.appendChild(el);
  render();
  addEventListener('keydown', onKey, true);
  const loop = () => {
    if (!cur) return;
    if (!cur.stillNear()) { closeShedDoorPanel(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
