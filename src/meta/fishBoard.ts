/**
 * 釣魚歷史排行榜（後端 GET /s/fish/lb?pid=）：大物榜（單尾最重）、累積總重、總賣魚收入。
 * 純資料／字串：解析伺服器回應、組每一列的分數 HTML，給 social.ts 的全球排行榜「釣魚」分頁用。
 */
export type FishBoardId = 'fBig' | 'fWeight' | 'fRev';
export const FISH_BOARDS: { id: FishBoardId; key: 'big' | 'weight' | 'rev'; label: string }[] = [
  { id: 'fBig', key: 'big', label: '大物榜' },
  { id: 'fWeight', key: 'weight', label: '累積總重' },
  { id: 'fRev', key: 'rev', label: '總賣魚收入' },
];
export const isFishBoard = (id: string): id is FishBoardId => FISH_BOARDS.some(b => b.id === id);

export type FishLbRow = {
  rank: number | null; k: string; nick: string; tag: string; title: string | null; atitle: string | null; foil: boolean; me: boolean;
  /** 單尾最重 */ kg: number; sp: string; name: string;
  /** 累積總重 */ total: number; n: number;
  /** 總賣魚收入 */ rev: number;
};
export type FishLbBoard = { rows: FishLbRow[]; mine: FishLbRow | null; count: number };
export type FishLb = Record<'big' | 'weight' | 'rev', FishLbBoard>;

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const str = (v: unknown) => (v == null ? '' : String(v));
function parseRow(x: any): FishLbRow | null {
  if (!x || typeof x !== 'object') return null;
  const rk = Number(x.rank);
  return {
    rank: x.rank == null || !Number.isFinite(rk) || rk <= 0 ? null : rk,
    k: str(x.k), nick: str(x.nick) || '剝蚵人', tag: str(x.tag), title: x.title ? str(x.title) : null, atitle: x.atitle ? str(x.atitle) : null,
    foil: !!x.foil, me: !!x.me,
    kg: num(x.kg), sp: str(x.sp), name: str(x.name), total: num(x.total), n: Math.max(0, Math.floor(num(x.n))), rev: Math.max(0, Math.floor(num(x.rev))),
  };
}
function parseBoard(b: any): FishLbBoard {
  const rows = Array.isArray(b?.rows) ? (b.rows as unknown[]).map(parseRow).filter((r): r is FishLbRow => !!r) : [];
  return { rows, mine: parseRow(b?.mine), count: Math.max(rows.length, Math.floor(num(b?.count))) };
}
/** 伺服器回應 → 三個榜；舊伺服器（沒有這個端點）或格式不對回 null */
export function parseFishLb(r: unknown): FishLb | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as any;
  if (!o.big && !o.weight && !o.rev) return null;
  return { big: parseBoard(o.big), weight: parseBoard(o.weight), rev: parseBoard(o.rev) };
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
/** 公斤：1 位小數（420.5 kg），太小的魚保留 2 位（0.25 kg） */
export function fmtKg(kg: number) {
  const v = Math.max(0, num(kg));
  const s = v < 10 && Math.round(v * 100) % 10 !== 0 ? v.toFixed(2) : v.toFixed(1);
  const [a, b] = s.split('.');
  return `${Number(a).toLocaleString('en-US')}.${b}`;
}

/** 每一列的分數區塊（沿用全球排行榜 .lbV／.lbNum／.lbUnit 樣式） */
export function fishScoreHtml(board: FishBoardId, x: FishLbRow): string {
  if (board === 'fBig') return `<span class="lbV"><span class="lbUnit lbFishSp">${esc(x.name || '魚')}</span><b class="lbNum">${esc(fmtKg(x.kg))}</b><span class="lbUnit">kg</span></span>`;
  if (board === 'fWeight') return `<span class="lbV"><b class="lbNum">${esc(fmtKg(x.total))}</b><span class="lbUnit">kg・${esc(fmtInt(x.n))} 條</span></span>`;
  return `<span class="lbV"><span class="lbUnit">$</span><b class="lbNum">${esc(fmtInt(x.rev))}</b></span>`;
}

export function fishEmptyHint(board: FishBoardId) {
  return board === 'fBig' ? '在廣場海邊釣到魚，就會記下你釣過最重的一條！'
    : board === 'fWeight' ? '每釣上一條魚，重量都會累積進來！'
      : '到碼頭把魚賣掉，收入就會累積進來！';
}

/** 底部「我的名次」一行 */
export function fishMeText(board: FishBoardId, mine: FishLbRow | null): string {
  if (!mine) return '你尚未上榜';
  const what = board === 'fBig' ? `最重 ${esc(mine.name || '魚')} ${esc(fmtKg(mine.kg))} kg` : board === 'fWeight' ? `累積 ${esc(fmtKg(mine.total))} kg` : `累積 $${esc(fmtInt(mine.rev))}`;
  return mine.rank ? `你目前第 <b>${esc(mine.rank)}</b> 名・${what}` : `你的紀錄：${what}（不公開排名）`;
}
