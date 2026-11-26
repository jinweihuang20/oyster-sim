import { describe, it, expect } from 'vitest';
import { loadSave } from '../core/save';
import { FISH } from '../plaza/boats/fishLogic';
import {
  FISH_BUY_ATTR, fishShopRows, fishShopHtml, fishBuyRowOf, eachFishBuyButton, shopMeds,
} from './fishShop';

const fmt = {
  qtyHtml: (k: string) => `<div class="qtyBox" data-qk="${k}"></div>`,
  px: (_k: string, base: number) => base,
  pxHtml: (_k: string, base: number) => `$${base}`,
  pxCd: () => '',
};
const svgs = { rod: '<svg id="rod"></svg>', bait: '<svg id="bait"></svg>', lure: '<svg id="lure"></svg>' };

describe('雜貨店釣具', () => {
  it('商品列有垂釣竿、路亞竿、三種餌、四種假魚，不含免費蚵仔肉', () => {
    const ids = fishShopRows().map(r => r.id);
    expect(ids).toEqual([
      FISH.rods.float.id, FISH.rods.lure.id,
      'fishBaitShrimp', 'fishBaitWorm', 'fishBaitSquid',
      'fishLureMinnow', 'fishLureJig', 'fishLureSoft', 'fishLurePopper',
    ]);
    expect(ids.some(id => !id)).toBe(false);
  });

  it('HTML 用 data-fishbuy，不會跟廣場旗幟的 data-fbuy 撞名', () => {
    const html = fishShopHtml({ money: 20_000, meds: {} }, svgs, fmt);
    expect(html).toContain('<h3>');
    expect(html).toContain('釣具');
    expect(html).toContain('垂釣竿');
    expect(html).toContain('路亞竿');
    expect(html).toContain(`${FISH_BUY_ATTR}="fishRodFloat"`);
    expect(html).toContain(`${FISH_BUY_ATTR}="fishLurePopper"`);
    expect(html).not.toMatch(/data-fbuy[\s=>]/);
    expect((html.match(/data-fishbuy=/g) || []).length).toBe(fishShopRows().length);
  });

  it('舊存檔沒有 meds（或 meds 是 undefined）也能產出列表，不會讀 undefined.id', () => {
    const raw = { money: 8_000, tutDone: 1, days: 12, shop: { owned: ['basic'], equipped: { knife: 'basic' } } };
    const loaded = loadSave({ getItem: () => JSON.stringify(raw), setItem: () => {} });
    expect(loaded.meds).toEqual({});
    const bare = { money: 8_000 } as { money: number; meds?: Record<string, number> };
    expect(bare.meds).toBeUndefined();
    expect(shopMeds(bare)).toEqual({});
    expect(bare.meds).toEqual({});
    expect(() => fishShopHtml(loaded, svgs, fmt)).not.toThrow();
    expect(() => fishShopHtml({ money: 8_000 }, svgs, fmt)).not.toThrow();
    const html = fishShopHtml({ money: 8_000 }, svgs, fmt);
    expect(html).toContain('一次買斷');
    expect(html).toContain('持有 0');
  });

  it('已擁有的釣竿顯示已擁有、不再出現購買鈕', () => {
    const html = fishShopHtml({ money: 20_000, meds: { fishRodFloat: 1 } }, svgs, fmt);
    expect(html).toContain('已擁有');
    expect(html).not.toContain(`${FISH_BUY_ATTR}="fishRodFloat"`);
    expect(html).toContain(`${FISH_BUY_ATTR}="fishRodLure"`);
  });

  it('廣場旗幟那種空的 data-fbuy 對不到任何釣具，綁定時會略過而不是炸掉', () => {
    expect(fishBuyRowOf('')).toBeUndefined();
    expect(fishBuyRowOf(undefined)).toBeUndefined();
    expect(fishBuyRowOf('fishRodFloat')?.n).toBe('垂釣竿');

    const flagBtn = { getAttribute: (n: string) => n === 'data-fbuy' ? '' : n === 'data-fishbuy' ? null : null };
    const fishBtn = { getAttribute: (n: string) => n === 'data-fishbuy' ? 'fishBaitShrimp' : null };
    // 模擬舊寫法：整份商店清單 query button[data-fbuy]，旗幟鈕會進來
    expect(() => {
      const r = fishBuyRowOf(flagBtn.getAttribute('data-fbuy'));
      r!.id;
    }).toThrow();

    const bound: string[] = [];
    const root = {
      querySelectorAll: (sel: string) => {
        if (sel === `button[${FISH_BUY_ATTR}]`) return [fishBtn];
        if (sel === 'button[data-fbuy]') return [flagBtn, fishBtn];
        return [];
      },
    };
    expect(() => eachFishBuyButton(root, fishShopRows(), (_b, r) => { bound.push(r.id); })).not.toThrow();
    expect(bound).toEqual(['fishBaitShrimp']);
  });
});
