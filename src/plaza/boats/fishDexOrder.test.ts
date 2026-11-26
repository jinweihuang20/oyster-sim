import { describe, it, expect, beforeAll } from 'vitest';
import { mountFishDex, fishDexOrder } from './fishDex';
import { FISH_SPECIES } from './fishModel';

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.requestAnimationFrame ??= () => 0;
  g.cancelAnimationFrame ??= () => {};
});

const fakeHost = () => {
  const stub = { addEventListener() {}, querySelectorAll: () => [] as unknown[], classList: { add() {} } };
  return { innerHTML: '', scrollTop: 0, querySelectorAll: () => [] as unknown[], querySelector: () => stub, classList: { add() {} } } as unknown as HTMLElement & { innerHTML: string };
};

describe('圖鑑排序：普通 → 稀有 → 傳說 → 巨物', () => {
  it('畫出來的卡片稀有度不會倒退，37 種都在、不重複；同一級照定義順序', () => {
    const h = fakeHost();
    const v = mountFishDex(h);
    const cards = [...h.innerHTML.matchAll(/class="fdxCard t(\d)[^"]*" [^>]*data-sp="([^"]+)"/g)].map(m => ({ tier: +m[1], id: m[2] }));
    v.stop(false);
    expect(cards).toHaveLength(37);
    expect(new Set(cards.map(c => c.id))).toEqual(new Set(FISH_SPECIES.map(s => s.id)));
    for (let i = 1; i < cards.length; i++) expect(cards[i].tier).toBeGreaterThanOrEqual(cards[i - 1].tier);
    for (const c of cards) expect(c.tier).toBe(FISH_SPECIES.find(s => s.id === c.id)!.tier);
    const count = [0, 1, 2, 3].map(t => cards.filter(c => c.tier === t).length);
    expect(count).toEqual([10, 14, 8, 5]);
    // 同一級照 FISH_SPECIES 順序（例：普通的韓國魚在小石斑之後、嘉鱲之前）
    for (const t of [0, 1, 2, 3]) expect(cards.filter(c => c.tier === t).map(c => c.id)).toEqual(FISH_SPECIES.filter(s => s.tier === t).map(s => s.id));
    expect(cards.slice(0, 10).map(c => c.id)).toEqual(['kurodai', 'kisu', 'aigo', 'aji', 'hata', 'isaki', 'hanguoyu', 'madai', 'bora', 'fugu']);
  });
  it('底層 FISH_SPECIES 不動（只能往後加）；之後新增的魚也會自動排進對的稀有度', () => {
    expect(FISH_SPECIES[0].id).toBe('kurodai'); expect(FISH_SPECIES[24].id).toBe('hanguoyu'); expect(FISH_SPECIES[36].id).toBe('daiouika');
    const o = fishDexOrder();
    expect(o).toHaveLength(FISH_SPECIES.length);
    expect(o.map(s => s.tier)).toEqual([...FISH_SPECIES.map(s => s.tier)].sort((a, b) => a - b));
  });
});
