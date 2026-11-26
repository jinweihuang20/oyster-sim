import { describe, it, expect, beforeAll } from 'vitest';
import { mountFishDex, fishDexMerge } from './fishDex';
import { FISH_SPECIES, FISH_DESC } from './fishModel';

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.requestAnimationFrame ??= () => 0;
  g.cancelAnimationFrame ??= () => {};
});

const fakeHost = () => {
  const h = { innerHTML: '', scrollTop: 0, querySelectorAll: () => [] as unknown[], classList: { add() {} } };
  return h as unknown as HTMLElement & { innerHTML: string };
};

describe('魚類圖鑑：24 種、巨物', () => {
  it('還沒釣過：全部灰色剪影＋？？？，不露名字、說明、地點', () => {
    const h = fakeHost();
    const v = mountFishDex(h);
    const html = h.innerHTML;
    expect(html).toContain('已經釣過 0／24 種');
    expect((html.match(/class="fdxCard /g) || []).length).toBe(24);
    expect((html.match(/？？？/g) || []).length).toBe(24);
    expect((html.match(/data-sil="1"/g) || []).length).toBe(24);
    for (const s of FISH_SPECIES) { expect(html).not.toContain(s.name); expect(html).not.toContain(FISH_DESC[s.id]); }
    expect(html).not.toMatch(/餌|碼頭|拖釣|木蝦|鐵板/);
    // 巨物：兩張 t3 卡、標籤寫「巨物」
    expect((html.match(/fdxCard t3 no/g) || []).length).toBe(2);
    expect((html.match(/>巨物</g) || []).length).toBe(2);
    expect((html.match(/>傳說</g) || []).length).toBe(6);
    expect((html.match(/>稀有</g) || []).length).toBe(10);
    v.stop(false);
  });
  it('釣到巨物之後：名字、重量出現，卡片是 t3', () => {
    fishDexMerge([{ sp: 'shumoku', kg: 188.4, n: 1 }, { sp: 'aoriika', kg: 2.15, n: 3 }, { sp: 'nope', kg: 1, n: 1 }]);
    const h = fakeHost();
    const v = mountFishDex(h);
    const html = h.innerHTML;
    expect(html).toContain('已經釣過 2／24 種');
    expect(html).toMatch(/fdxCard t3" [^>]*data-sp="shumoku"/);
    expect(html).toContain('雙髻鯊'); expect(html).toContain('最大 188.4 kg・1 條');
    expect(html).toContain('大軟絲'); expect(html).toContain('最大 2.15 kg・3 條');
    expect(html).not.toContain('翻車魚');
    v.stop(false);
  });
});
