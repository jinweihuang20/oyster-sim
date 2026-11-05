/** 玩法／模式更新公告資料（進主畫面跳一次；之後換 id 再發） */
export const FEAT_NOTES: { id: string; title: string; lines: string[] }[] = [
  {
    id: 'dm-modes-weapons-2026-11b',
    title: '死鬥大更新',
    lines: [
      '雜貨店新上架多把死鬥槍：蚵卡拉什、蚵殼卡賓、烏茲、沙鷹、噴子、狙擊…',
      '「死鬥・混戰」：3 分鐘搶擊殺榜，結算依名次發錢',
      '「死鬥・圍毆」：一關接一關，BOT 越來越多也越兇，看你能撐幾關',
      '蚵仔堆填彈有冷卻（圓環進度），補完要換下一堆',
    ],
  },
];

export type AnnounceDeps = {
  LS: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void };
  LS_P: string;
  $: (id: string) => HTMLElement;
  esc: (s: string) => string;
  bootQuiet: () => boolean;
  menuModalBusy: () => boolean;
  Social: { local: (t: string) => void };
  giftAlert: () => void;
  svAlert: () => void;
  newAnnounce: () => void;
};

let D: AnnounceDeps;
let featSeen: Set<string>;
let FEAT_LS: string;

export function initAnnounce(deps: AnnounceDeps) {
  D = deps;
  FEAT_LS = D.LS_P + 'featNotes';
  let raw: any = null;
  try { raw = JSON.parse(D.LS.getItem(FEAT_LS) ?? 'null'); } catch { /* */ }
  featSeen = new Set(Array.isArray(raw) ? raw : []);
  setInterval(featAnnounce, 1500);
  setTimeout(featAnnounce, 1800);
  (window as any).__featNotes = {
    pending: () => featPending().map(n => n.id),
    reset: () => { D.LS.removeItem(FEAT_LS); featSeen = new Set(); featDots(); },
  };
}

const featSave = () => { try { D.LS.setItem(FEAT_LS, JSON.stringify([...featSeen])); } catch { /* */ } };
const featPending = () => FEAT_NOTES.filter(n => !featSeen.has(n.id));

export function featDots() {
  const has = featPending().length > 0;
  for (const id of ['oDmFfa', 'oDmHorde']) {
    const b = document.getElementById(id); if (!b) continue;
    b.style.position = b.style.position || 'relative';
    let d = b.querySelector('.newDot');
    if (has && !d) b.insertAdjacentHTML('beforeend', '<span class="newDot">新</span>');
    else if (!has && d) d.remove();
  }
}

export function featAnnounce() {
  featDots();
  if (D.bootQuiet()) return;
  const next = featPending()[0]; if (!next) return;
  if (D.menuModalBusy()) return;
  featSeen.add(next.id); featSave(); featDots();
  D.Social.local(next.title + '：' + next.lines[0]);
  const m = document.createElement('div'); m.id = 'featMsg'; m.className = 'giftMsg';
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b>${D.esc(next.title)}</b>
<ul class="featList">${next.lines.map(l => `<li>${D.esc(l)}</li>`).join('')}</ul>
<div class="mbtns"><button class="gmNo">知道了</button><button class="gmYes">去雜貨店看槍</button></div></div>`;
  const close = () => { m.remove(); setTimeout(() => { D.giftAlert(); D.svAlert(); D.newAnnounce(); }, 300); };
  m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
  m.querySelector('.gmYes')!.addEventListener('click', () => {
    close();
    (D.$('oShop') as HTMLButtonElement).click();
    requestAnimationFrame(() => {
      const h = Array.from(D.$('shopList').querySelectorAll('h3')).find(el => (el.textContent ?? '').includes('槍枝'));
      h?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.body.appendChild(m);
}
