import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { FISH_SPECIES } from './fishModel';
import { LURE_KEYS, ITEM_NAME, type ItemKey } from './fishLogic';
import { FISH_TAGS, ITEM_LIKES, LURE_FAV, BIG_LURES, SQUID_LURES, ITEM_HINT, itemHintLine, itemHintHtml, itemGood, fishClue, fishRecLine, fishBestLures } from './fishHints';
import { fishDexOrder, mountFishDex, fishDexMerge } from './fishDex';
import { fishShopRows, fishShopHtml } from '../../shop/fishShop';

const nm = (id: string) => FISH_SPECIES.find(s => s.id === id)!.name;
const ALL_ITEMS: ItemKey[] = [...LURE_KEYS, 'oyster', 'shrimp', 'worm', 'squid'];

describe('CR-23 假餌／餌料提示', () => {
  it('12 種假魚＋4 種餌都有水層釣法和目標魚，寫的魚都真的對味（伺服器標籤或 FishLureFav）', () => {
    expect(LURE_KEYS.length).toBe(12);
    for (const k of ALL_ITEMS) {
      const h = ITEM_HINT[k];
      expect(h.how.length, k).toBeGreaterThan(2);
      expect(h.tag.length, k).toBeGreaterThan(0);
      expect(h.tag.length, k).toBeLessThanOrEqual(6);
      expect(h.fish.length, k).toBeGreaterThanOrEqual(3);
      for (const f of [...h.fish, ...(h.bigFish ?? [])]) {
        expect(FISH_SPECIES.some(s => s.id === f), `${k}:${f}`).toBe(true);
        expect(itemGood(k, f), `${k} 不該寫 ${f}`).toBe(true);
      }
      // big 裡寫的魚名都要列在 bigFish（才會被檢查）
      for (const s of FISH_SPECIES) if (h.big?.includes(s.name)) expect(h.bigFish, `${k}:${s.id}`).toContain(s.id);
      const line = itemHintLine(k);
      for (const f of h.fish) expect(line).toContain(nm(f));
    }
  });
  it('木蝦：頭足類、不咬巨物，目標只有頭足類', () => {
    expect(itemHintLine('egi')).toContain('頭足類');
    expect(itemHintLine('egi')).toContain('不咬巨物');
    for (const f of ITEM_HINT.egi.fish) expect(FISH_TAGS[f]).toContain('squid');
    for (const s of FISH_SPECIES.filter(x => x.tier === 3)) expect(itemGood('egi', s.id)).toBe(false);
  });
  it('進階大物路亞（大鉛筆餌、船拖裙尾、慢搖鐵板）和小透抽軟餌、顫泳餌都有提到巨物', () => {
    for (const k of ['stickbait', 'trollskirt', 'slowjig', 'squidjig', 'vib'] as const) {
      expect(itemHintLine(k), k).toMatch(/巨物/);
      expect((ITEM_HINT[k].bigFish ?? []).some(f => FISH_SPECIES.find(s => s.id === f)!.tier === 3), k).toBe(true);
    }
    for (const k of BIG_LURES) expect(ITEM_HINT[k].how).toContain('大物加成');
    expect(itemHintLine('popper')).toMatch(/清晨／黃昏/);
    expect(itemHintLine('trollskirt')).toContain('拖釣');
  });
  it('雜貨店釣具卡片和換餌面板都看得到提示', () => {
    const rows = fishShopRows();
    const html = fishShopHtml({ money: 0, meds: {} }, { rod: '', bait: '', lure: '' }, { qtyHtml: () => '', px: (_k, b) => b, pxHtml: (_k, b) => String(b), pxCd: () => '' });
    for (const k of LURE_KEYS) { expect(rows.some(r => r.tk === k)).toBe(true); expect(html).toContain(itemHintHtml(k, 'fhHint shopHint')); }
    for (const k of ['shrimp', 'worm', 'squid'] as const) expect(html).toContain(itemHintHtml(k, 'fhHint shopHint'));
    expect(html).not.toMatch(/backdrop-filter/);
  });
});

describe('CR-23 圖鑑線索／推薦', () => {
  it('37 種魚都有線索（不洩露魚名）和推薦', () => {
    expect(FISH_SPECIES.length).toBe(37);
    for (const s of FISH_SPECIES) {
      expect(FISH_TAGS[s.id], s.id).toBeTruthy();
      const c = fishClue(s.id), r = fishRecLine(s.id);
      expect(c.startsWith('線索：') && c.length > 3, s.id).toBe(true);
      expect(r.startsWith('推薦：') && r.length > 3, s.id).toBe(true);
      for (const o of FISH_SPECIES) expect(c.includes(o.name), `${s.id} 線索不能有魚名 ${o.name}`).toBe(false);
      // 推薦的假魚都真的對味
      for (const k of fishBestLures(s.id)) expect(itemGood(k, s.id), `${s.id}:${k}`).toBe(true);
    }
  });
  it('雙髻鯊：深水、拖釣；推薦船拖裙尾假餌／慢搖鐵板／大鉛筆餌', () => {
    expect(fishClue('shumoku')).toContain('深水');
    expect(fishClue('shumoku')).toContain('拖釣');
    expect(fishClue('shumoku')).toContain('進階大物路亞');
    const r = fishRecLine('shumoku');
    for (const k of ['trollskirt', 'slowjig', 'stickbait'] as const) expect(r).toContain(ITEM_NAME[k]);
    expect(r).not.toContain(ITEM_NAME.egi);
  });
  it('大王烏賊：深水、夜、頭足類；推薦小透抽軟餌（木蝦釣不到巨物）', () => {
    const c = fishClue('daiouika');
    expect(c).toContain('深水'); expect(c).toContain('夜'); expect(c).toContain('頭足類');
    expect(fishRecLine('daiouika')).toContain('小透抽軟餌');
    expect(fishRecLine('daiouika')).not.toContain('大號木蝦');
  });
  it('韓國魚：蚵棚附近・垂釣；軟絲推薦木蝦和小透抽', () => {
    expect(fishClue('hanguoyu')).toBe('線索：蚵棚附近・垂釣');
    expect(fishRecLine('hanguoyu')).toContain('垂釣');
    expect(fishRecLine('aoriika')).toContain('大號木蝦');
    expect(fishRecLine('aoriika')).toContain('小透抽軟餌');
  });
  it('圖鑑排序一定是 普通 → 稀有 → 傳說 → 巨物', () => {
    const t = fishDexOrder().map(s => s.tier);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
    expect(t[0]).toBe(0); expect(t[t.length - 1]).toBe(3);
    expect(fishDexOrder().length).toBe(FISH_SPECIES.length);
  });
  describe('圖鑑詳情', () => {
    beforeAll(() => {
      const g = globalThis as Record<string, unknown>;
      g.requestAnimationFrame ??= () => 0;
      g.cancelAnimationFrame ??= () => {};
    });
    const fakeHost = () => {
      const stub = { addEventListener() {}, querySelectorAll: () => [] as unknown[], classList: { add() {} }, getContext: () => null };
      return { innerHTML: '', scrollTop: 0, querySelectorAll: () => [] as unknown[], querySelector: () => stub, classList: { add() {} } } as unknown as HTMLElement & { innerHTML: string };
    };
    it('沒釣過：顯示線索不顯示魚名；釣過：顯示推薦', () => {
      const h = fakeHost();
      const v = mountFishDex(h);
      v.open('manbou');
      expect(h.innerHTML).toContain(`<p class="fdxHint fdxClue">${fishClue('manbou')}</p>`);
      expect(h.innerHTML).toContain('？？？');
      expect(h.innerHTML).not.toContain('翻車魚');
      expect(h.innerHTML).not.toContain('fdxRec');
      fishDexMerge([{ sp: 'manbou', kg: 120, n: 1 }]);
      v.refresh();
      expect(h.innerHTML).toContain(`<p class="fdxHint fdxRec">${fishRecLine('manbou')}</p>`);
      expect(h.innerHTML).toContain('翻車魚');
      v.stop(false);
    });
  });
});

// 旁邊有伺服器原始碼（開發機）就逐表比對；CI 沒有就跳過
const SRV = '/workspace/game-stats-server-box/StatsServer/Plaza/PlazaWorld.Fish.cs';
describe.skipIf(!existsSync(SRV))('跟伺服器 PlazaWorld.Fish.cs 一致', () => {
  const src = existsSync(SRV) ? readFileSync(SRV, 'utf8') : '';
  const arr = (s: string) => [...s.matchAll(/"([a-z]+)"/g)].map(m => m[1]);
  it('FishTable 標籤', () => {
    const rows = [...src.matchAll(/new\("([a-z]+)", "[^"]+", (\d), [^"]+"([a-z ]+)"\)/g)];
    expect(rows.length).toBe(FISH_SPECIES.length);
    for (const [, id, tier, tags] of rows) {
      expect([...(FISH_TAGS[id] ?? [])].sort(), id).toEqual(tags.split(' ').sort());
      expect(FISH_SPECIES.find(s => s.id === id)?.tier, id).toBe(Number(tier));
    }
  });
  it('FishLureFav／FishBigLures／FishSquidLures', () => {
    const fav = src.slice(src.indexOf('FishLureFav = new()'), src.indexOf('};', src.indexOf('FishLureFav = new()')));
    const ents = [...fav.matchAll(/\["([a-z]+)"\] = \[([^\]]*)\]/g)];
    expect(ents.length).toBe(Object.keys(LURE_FAV).length);
    for (const [, k, list] of ents) expect(LURE_FAV[k as keyof typeof LURE_FAV], k).toEqual(arr(list));
    expect(arr(src.match(/FishBigLures = \[([^\]]*)\]/)![1])).toEqual([...BIG_LURES]);
    expect(arr(src.match(/FishSquidLures = \[([^\]]*)\]/)![1])).toEqual([...SQUID_LURES]);
  });
  it('FishLikes', () => {
    const body = src.slice(src.indexOf('static IEnumerable<string> FishLikes'), src.indexOf('if (c.Troll)', src.indexOf('static IEnumerable<string> FishLikes')));
    for (const [, k, rest] of body.matchAll(/case "([a-z]+)":(.*?)break;/g)) expect([...ITEM_LIKES[k as ItemKey]], k).toEqual([...rest.matchAll(/yield return "([a-z]+)"/g)].map(m => m[1]));
  });
});
