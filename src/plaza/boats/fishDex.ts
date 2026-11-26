/**
 * 魚類圖鑑（廣場釣魚的面板、主選單的「圖鑑」頁共用）：魚種卡片（3D 縮圖，韓國魚用照片）＋點進去看可以轉的 3D 模型（照片魚顯示 2D 圖）。
 * 沒釣過的只顯示灰色剪影和「？？？」，不寫在哪裡、用什麼釣。
 * 資料：本機快取（localStorage）＋廣場伺服器 FishState＋REST /s/fishdex，取最大值合併。
 */
import { FISH_SPECIES, FISH_DESC, FISH_TIER, FISH_PHOTO } from './fishModel';
import { fishThumb, mountFishViewer, releaseFish3d } from './fish3d';

export type FishDexRow = { kg: number; n: number };
const LS_KEY = 'oysterFishDex1';
const TIER: readonly string[] = FISH_TIER;
let rows: Map<string, FishDexRow> | null = null;

function load(): Map<string, FishDexRow> {
  if (rows) return rows;
  rows = new Map();
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY) || '{}') as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      const r = v as { kg?: unknown; n?: unknown };
      const kg = Number(r?.kg), n = Number(r?.n);
      if (FISH_SPECIES.some(s => s.id === k) && Number.isFinite(kg) && Number.isFinite(n) && n > 0) rows.set(k, { kg: Math.max(0, kg), n: Math.floor(n) });
    }
  } catch { /* 壞掉就當沒有 */ }
  return rows;
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(load()))); } catch { /* 滿了就算了 */ }
}
/** 目前的圖鑑（唯讀） */
export function fishDexRows(): ReadonlyMap<string, FishDexRow> { return load(); }
/** 合併（伺服器／剛釣到）：重量、條數都取大的；有變才存 */
export function fishDexMerge(list: Iterable<{ sp: string; kg: number; n: number }>) {
  const m = load(); let ch = false;
  for (const r of list) {
    if (!r?.sp || !FISH_SPECIES.some(s => s.id === r.sp) || !(r.n > 0)) continue;
    const o = m.get(r.sp);
    const kg = Math.max(o?.kg ?? 0, Number(r.kg) || 0), n = Math.max(o?.n ?? 0, Math.floor(Number(r.n) || 0));
    if (!o || o.kg !== kg || o.n !== n) { m.set(r.sp, { kg, n }); ch = true; }
  }
  if (ch) save();
  return ch;
}

/**
 * 圖鑑顯示順序：普通 → 稀有 → 傳說 → 巨物，同一級照 FISH_SPECIES 定義順序（穩定排序）。
 * FISH_SPECIES 本身只能往後加（跟伺服器同順序、舊存檔照 id 對），之後新增魚種也會自動排進對的稀有度。
 */
export const fishDexOrder = () => FISH_SPECIES.map((s, i) => ({ s, i })).sort((a, b) => a.s.tier - b.s.tier || a.i - b.i).map(x => x.s);

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const kgS = (kg: number) => kg.toFixed(kg < 10 ? 2 : 1);

export type FishDexView = { refresh(): void; stop(release?: boolean): void; open(id: string | null): void };
/**
 * 把圖鑑畫進 host（格子 → 點卡片看 3D／照片）；回傳 refresh（資料變了重畫）／stop（關掉：停 3D、放掉 WebGL）／open（打開某條魚的詳情）。
 */
export function mountFishDex(host: HTMLElement, opts: { onOpenDetail?: (id: string | null) => void } = {}): FishDexView {
  let detail: string | null = null;
  let stopViewer: (() => void) | null = null;
  let thumbJob = 0;
  const render = () => {
    stopViewer?.(); stopViewer = null;
    cancelAnimationFrame(thumbJob);
    const m = load();
    if (detail) {
      const s = FISH_SPECIES.find(x => x.id === detail)!;
      const d = m.get(s.id);
      const photo = FISH_PHOTO[s.id];
      const view = photo
        ? `<div class="fdxView"><img class="fdxViewImg${d ? '' : ' sil'}" src="${esc(photo)}" alt="${d ? esc(s.name) : '還沒釣過的魚'}"></div>`
        : `<div class="fdxView"><canvas class="fdxCv" aria-label="${d ? esc(s.name) : '還沒釣過的魚'}的 3D 模型，可以拖曳旋轉"></canvas><small>拖曳可以轉</small></div>`;
      host.innerHTML = `<div class="fdxDet t${s.tier}">
        <div class="fdxNav"><span class="fdxBack" role="button" tabindex="0">返回圖鑑</span><span class="fdxTier">${TIER[s.tier] ?? ''}</span></div>
        ${view}
        <h3 class="fdxName">${d ? esc(s.name) : '？？？'}</h3>
        ${d ? `<p class="fdxStat">最大 ${kgS(d.kg)} kg・釣過 ${d.n} 條</p><p class="fdxDesc">${esc(FISH_DESC[s.id] ?? '')}</p>` : '<p class="fdxDesc">還沒釣過。釣到之後才看得到牠的樣子和介紹。</p>'}
      </div>`;
      const back = host.querySelector<HTMLElement>('.fdxBack')!;
      const go = (e: Event) => { e.preventDefault(); e.stopPropagation(); detail = null; opts.onOpenDetail?.(null); render(); };
      back.addEventListener('click', go);
      back.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') go(e); });
      if (!photo) stopViewer = mountFishViewer(host.querySelector<HTMLCanvasElement>('.fdxCv')!, s.id, !d);
      return;
    }
    const got = FISH_SPECIES.filter(s => m.has(s.id)).length;
    host.innerHTML = `<p class="fdxHead">已經釣過 ${got}／${FISH_SPECIES.length} 種</p><div class="fdxGrid">${fishDexOrder().map(s => {
      const d = m.get(s.id);
      const photo = FISH_PHOTO[s.id];
      const img = photo
        ? `<img class="fdxPhoto${d ? '' : ' sil'}" alt="" data-sp="${s.id}" data-sil="${d ? 0 : 1}" src="${esc(photo)}">`
        : `<img alt="" data-sp="${s.id}" data-sil="${d ? 0 : 1}">`;
      return `<div class="fdxCard t${s.tier}${d ? '' : ' no'}" role="button" tabindex="0" data-sp="${s.id}"><span class="fdxTier">${TIER[s.tier] ?? ''}</span><span class="fdxImg">${img}</span><b>${d ? esc(s.name) : '？？？'}</b><small>${d ? `最大 ${kgS(d.kg)} kg・${d.n} 條` : '還沒釣過'}</small></div>`;
    }).join('')}</div>`;
    host.querySelectorAll<HTMLElement>('.fdxCard').forEach(c => {
      const open = (e: Event) => { e.preventDefault(); e.stopPropagation(); detail = c.dataset.sp!; opts.onOpenDetail?.(detail); render(); host.scrollTop = 0; };
      c.addEventListener('click', open);
      c.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') open(e); });
    });
    // 縮圖：每幀畫 3 張，不要一次卡住
    const imgs = Array.from(host.querySelectorAll<HTMLImageElement>('img[data-sp]:not(.fdxPhoto)'));
    let i = 0;
    const step = () => {
      for (let k = 0; k < 3 && i < imgs.length; k++, i++) {
        const im = imgs[i]; if (!im.isConnected) return;
        const url = fishThumb(im.dataset.sp!, im.dataset.sil === '1');
        if (url) im.src = url; else im.parentElement?.classList.add('noGl');
      }
      if (i < imgs.length) thumbJob = requestAnimationFrame(step);
    };
    step();
  };
  render();
  return {
    refresh() { render(); },
    stop(release = true) { stopViewer?.(); stopViewer = null; cancelAnimationFrame(thumbJob); if (release) releaseFish3d(); },
    open(id) { detail = id && FISH_SPECIES.some(s => s.id === id) ? id : null; opts.onOpenDetail?.(detail); render(); if (detail) host.scrollTop = 0; },
  };
}
