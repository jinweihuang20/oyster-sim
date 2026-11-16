/** 阿婆滿意度：純函式，只看組合和今天同款請過幾次。 */
import { comboOf, validCombo } from './combo';

/** 配料種類數 → 分數（0～4 種） */
const TOP_PTS = [0, 22, 34, 42, 48];
/** 有蚵仔才是蚵仔煎 */
const OYSTER_PTS = 8;
/** 粉漿：不加／薄脆／標準／厚實 */
const BATTER_PTS = [0, 16, 20, 16];
const EGG_PTS = 12;
/** 熟度：嫩／金黃／焦香 */
const DONE_PTS = [7, 14, 7];
/** 醬：不加／一般醬／阿婆祕傳醬（index 5） */
const SAUCE_PTS = 8, AMA_SAUCE_PTS = 16;
/** 今天同款每多請一次扣 15%，最低剩 10% */
const REPEAT_STEP = 0.15, REPEAT_MIN = 0.1;

export type FeedTier = { min: number; pay: number };
export const FEED_TIERS: FeedTier[] = [
  { min: 90, pay: 1000 },
  { min: 70, pay: 600 },
  { min: 50, pay: 300 },
  { min: 0, pay: 0 },
];

/** 組合本身的分數（0～100，不含重複扣分） */
export function feedBaseScore(id: number): number {
  if (!validCombo(id)) return 0;
  const c = comboOf(id);
  const tops = [1, 2, 4, 8].filter(b => c.top & b).length;
  if (!tops && !c.batter) return 0;
  const s = TOP_PTS[tops] + (c.top & 1 ? OYSTER_PTS : 0) + BATTER_PTS[c.batter] + (c.egg ? EGG_PTS : 0)
    + DONE_PTS[c.done] + (c.sauce === 5 ? AMA_SAUCE_PTS : c.sauce ? SAUCE_PTS : 0);
  return Math.max(0, Math.min(100, s));
}

/** 實際分數：今天同款已經請過 repeat 次 */
export function feedScore(id: number, repeat: number): number {
  const k = Math.max(REPEAT_MIN, 1 - REPEAT_STEP * Math.max(0, Math.floor(repeat)));
  return Math.round(feedBaseScore(id) * k);
}

export const feedPay = (score: number) => FEED_TIERS.find(t => score >= t.min)!.pay;

const LINES: Record<'top' | 'good' | 'ok' | 'no', string[]> = {
  top: ['讚啦！這盤煎得有夠好吃', '這味道跟我少年時吃的一樣', '嗯～這款我會想再吃'],
  good: ['不錯喔，煎得真香', '好吃好吃，再加點什麼會更讚', '料下得不錯，阿婆滿意'],
  ok: ['還可以啦，吃得飽', '普普通通，下次料多放一點', '嗯…有點單調喔'],
  no: ['這我吞被落去', '這款阿婆吃不太下啦', '這樣不算蚵仔煎啦'],
};

/** 阿婆說的話；repeat>0 時提一下又是同款 */
export const FEED_LINE_N = 3;
/** li＝評語序號（0～2；廣場同步時傳序號，別人用同一句） */
export function feedLine(score: number, repeat: number, li = Math.floor(Math.random() * FEED_LINE_N)): string {
  const key = score >= 90 ? 'top' : score >= 70 ? 'good' : score >= 50 ? 'ok' : 'no';
  const arr = LINES[key];
  const base = arr[Math.abs(Math.floor(li)) % arr.length];
  return repeat > 0 && key !== 'top' ? `又是這款喔…${base}` : base;
}
