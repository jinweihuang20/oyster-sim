import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
// @ts-ignore 純 JS 腳本
import { buildCatalog, fishRackItems } from '../../scripts/catalog.mjs';
import { FISH } from '../plaza/boats/fishLogic';
import { RACK } from '../plaza/boats/rackLogic';
import { fishShopRows, fishShopHtml } from './fishShop';
import { pxIn, pxLiveIn, type ShopPx } from './shopPx';

const fishSrc = readFileSync('src/plaza/boats/fishLogic.ts', 'utf8');
const rackSrc = readFileSync('src/plaza/boats/rackLogic.ts', 'utf8');
type Cat = { id: string; name: string; category: string; price: number };
const items = fishRackItems(fishSrc, rackSrc) as Cat[];

describe('後台商店價格：釣具、蚵棚進 catalog.json', () => {
  it('釣具全部 17 樣（2 竿＋3 餌＋12 假魚），key 和雜貨店購買用的 item-<id> 一樣、原價一致', () => {
    const fish = items.filter(i => i.category === 'fish');
    const rows = fishShopRows();
    expect(fish.map(i => i.id)).toEqual(rows.map(r => 'item-' + r.id));
    for (const r of rows) expect(fish.find(i => i.id === 'item-' + r.id)!.price).toBe(r.price);
    expect(fish).toHaveLength(17);
    for (const k of ['vib', 'tairubber', 'deepcrank', 'squidjig']) {
      const l = FISH.lures.find(x => x.k === k)!;
      expect(fish.find(i => i.id === 'item-' + l.id)).toMatchObject({ name: l.n, price: l.price });
    }
    expect(fish.find(i => i.id === 'item-fishBaitShrimp')!.name).toBe('蝦仔餌（10 個）');
    expect(fish.some(i => i.id === 'item-')).toBe(false);
  });

  it('蚵棚組合包：item-rackKit，原價跟 RACK.kitPrice 一樣', () => {
    expect(items.filter(i => i.category === 'rack')).toEqual([{ id: 'item-' + RACK.kitId, name: '蚵棚', category: 'rack', price: RACK.kitPrice, limited: false }]);
  });

  it('整份 catalog 也有釣具和蚵棚，id 不重複', () => {
    const main = ['src/main.ts', 'src/shop/yardShop.ts', 'src/plaza/flags.ts', 'src/shop/meds.ts', 'src/shop/shopEquip.ts', 'src/world/locs.ts'].map(f => readFileSync(f, 'utf8')).join('\n');
    const c = buildCatalog(main, 't', readFileSync('src/shop/oddities.ts', 'utf8'), readFileSync('src/dm/weapons.ts', 'utf8'), readFileSync('src/shop/pets.ts', 'utf8'), readFileSync('src/food/ingredients.ts', 'utf8'), fishSrc, rackSrc);
    const all = c.items as Cat[];
    expect(all.filter(i => i.category === 'fish')).toHaveLength(17);
    expect(all.filter(i => i.category === 'rack')).toHaveLength(1);
    const keys = all.filter(i => i.category === 'fish' || i.category === 'rack').map(i => i.id);
    expect(new Set(keys).size).toBe(keys.length);
    expect(all.filter(i => keys.includes(i.id))).toHaveLength(keys.length);
  });
});

describe('雜貨店套用伺服器改價：釣具、蚵棚', () => {
  const now = 1_000_000;
  const map: Record<string, ShopPx> = {
    'item-fishRodLure': { price: 9_000, base: 9_000 },
    'item-fishLureVib': { price: 2_080, base: 2_600, sale: true, endsAt: now + 60_000 },
    'item-fishLureSquidJig': { price: 1_000, base: 3_000, sale: true, endsAt: now - 1 },
    'item-rackKit': { price: 12_000, base: 12_000 },
  };
  it('有改價用改價；特價中用特價；特價過期回到後台標價；沒設定用內建價', () => {
    expect(pxIn(map, 'item-fishRodLure', FISH.rods.lure.price, now)).toBe(9_000);
    expect(pxIn(map, 'item-fishLureVib', 2_600, now)).toBe(2_080);
    expect(pxLiveIn(map, 'item-fishLureSquidJig', now)).toBeNull();
    expect(pxIn(map, 'item-fishLureSquidJig', 3_400, now)).toBe(3_000);
    expect(pxIn(map, 'item-rackKit', RACK.kitPrice, now)).toBe(12_000);
    expect(pxIn(map, 'item-fishRodFloat', FISH.rods.float.price, now)).toBe(FISH.rods.float.price);
    expect(pxIn({}, 'item-rackKit', RACK.kitPrice, now)).toBe(15_000);
  });

  it('釣具卡片顯示改過的價格、錢夠不夠也照改價判斷', () => {
    const fmt = {
      qtyHtml: () => '',
      px: (k: string, base: number) => pxIn(map, k, base, now),
      pxHtml: (k: string, base: number) => `$${pxIn(map, k, base, now)}`,
      pxCd: () => '',
    };
    const svgs = { rod: '', bait: '', lure: '' };
    // 錢 10,000：路亞竿原價 12,000 買不起，改成 9,000 就買得起
    const html = fishShopHtml({ money: 10_000, meds: {} }, svgs, fmt);
    expect(html).toContain('data-fishbuy="fishRodLure" >$9000</button>');
    expect(html).toContain('data-fishbuy="fishLureVib" >$2080</button>');
    expect(html).toContain('data-fishbuy="fishRodFloat" >$3000</button>');
    const poor = fishShopHtml({ money: 8_000, meds: {} }, svgs, fmt);
    expect(poor).toContain('data-fishbuy="fishRodLure" disabled>$9000</button>');
  });
});
