import { describe, it, expect, beforeAll } from 'vitest';
import { mountFishDex, fishDexMerge } from './fishDex';
import { FISH_SPECIES, FISH_DESC, FISH_PHOTO, isPhotoFish } from './fishModel';
import { fishDbg } from './plazaFish';

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.requestAnimationFrame ??= () => 0;
  g.cancelAnimationFrame ??= () => {};
});

const fakeHost = () => {
  const stub = { addEventListener() {}, querySelectorAll: () => [] as unknown[], classList: { add() {} } };
  const h = {
    innerHTML: '',
    scrollTop: 0,
    querySelectorAll: () => [] as unknown[],
    querySelector: () => stub,
    classList: { add() {} },
  };
  return h as unknown as HTMLElement & { innerHTML: string };
};

describe('魚類圖鑑：魚種、巨物', () => {
  it('還沒釣過：全部灰色剪影＋？？？，不露名字、說明、地點', () => {
    const h = fakeHost();
    const v = mountFishDex(h);
    const html = h.innerHTML;
    expect(html).toContain(`已經釣過 0／${FISH_SPECIES.length} 種`);
    expect((html.match(/class="fdxCard /g) || []).length).toBe(FISH_SPECIES.length);
    expect((html.match(/？？？/g) || []).length).toBe(FISH_SPECIES.length);
    expect((html.match(/data-sil="1"/g) || []).length).toBe(FISH_SPECIES.length);
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
    expect(html).toContain(`已經釣過 2／${FISH_SPECIES.length} 種`);
    expect(html).toMatch(/fdxCard t3" [^>]*data-sp="shumoku"/);
    expect(html).toContain('雙髻鯊'); expect(html).toContain('最大 188.4 kg・1 條');
    expect(html).toContain('大軟絲'); expect(html).toContain('最大 2.15 kg・3 條');
    expect(html).not.toContain('翻車魚');
    v.stop(false);
  });
  it('韓國魚用上傳照片：沒釣過是灰色剪影，釣過顯示原圖與指定說明', () => {
    expect(FISH_SPECIES.length).toBe(25);
    expect(FISH_SPECIES.at(-1)).toEqual({ id: 'hanguoyu', name: '韓國魚', tier: 0 });
    expect(isPhotoFish('hanguoyu')).toBe(true);
    expect(FISH_PHOTO.hanguoyu).toMatch(/hanguoyu/);
    expect(FISH_DESC.hanguoyu).toBe('我跟你聊的是大海，你在跟我聊漱口杯？');

    const h = fakeHost();
    const v = mountFishDex(h);
    expect(h.innerHTML).toContain('class="fdxPhoto sil"');
    expect(h.innerHTML).toMatch(/data-sp="hanguoyu"[^>]*src="/);
    expect(h.innerHTML).not.toContain('韓國魚');
    expect(h.innerHTML).not.toContain('漱口杯');
    expect((h.innerHTML.match(/class="fdxCard t0/g) || []).length).toBe(7);

    v.open('hanguoyu');
    expect(h.innerHTML).toContain('fdxViewImg sil');
    expect(h.innerHTML).toContain('？？？');
    expect(h.innerHTML).not.toContain('拖曳可以轉');
    expect(h.innerHTML).not.toContain('fdxCv');
    expect(h.innerHTML).not.toContain('韓國魚');
    expect(h.innerHTML).not.toContain('漱口杯');
    v.stop(false);
  });
  it('韓國魚釣過之後：格子與詳情都顯示照片和介紹', () => {
    fishDexMerge([{ sp: 'hanguoyu', kg: 2.2, n: 4 }]);
    const h = fakeHost();
    const v = mountFishDex(h);
    expect(h.innerHTML).toContain('韓國魚');
    expect(h.innerHTML).toContain('最大 2.20 kg・4 條');
    expect(h.innerHTML).toMatch(/class="fdxPhoto"/);
    expect(h.innerHTML).not.toMatch(/data-sp="hanguoyu"[^>]*class="fdxPhoto sil"/);
    v.open('hanguoyu');
    expect(h.innerHTML).toContain('韓國魚');
    expect(h.innerHTML).toContain('我跟你聊的是大海，你在跟我聊漱口杯？');
    expect(h.innerHTML).toContain('fdxViewImg');
    expect(h.innerHTML).not.toContain('fdxViewImg sil');
    expect(h.innerHTML).not.toContain('拖曳可以轉');
    expect(h.innerHTML).not.toContain('fdxCv');
    v.stop(false);
  });
  it('秀漁獲：韓國魚不會丟例外', () => {
    expect(() => fishDbg.fakeCatch('hanguoyu', 1.1)).not.toThrow();
  });
});
