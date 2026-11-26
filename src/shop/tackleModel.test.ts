import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TACKLE_KEYS, buildTackleGeometry, tackleGeometry, disposeTackleGeometries } from './tackleModel';
import { FISH } from '../plaza/boats/fishLogic';
import { fishShopRows, fishShopHtml, tackleIcHtml } from './fishShop';

const fmt = { qtyHtml: () => '', px: (_k: string, b: number) => b, pxHtml: (_k: string, b: number) => `$${b}`, pxCd: () => '' };

describe('雜貨店釣具 3D 模型', () => {
  it('每個餌、每種假魚都有模型', () => {
    for (const b of FISH.baits) expect(TACKLE_KEYS).toContain(b.k);
    for (const l of FISH.lures) expect(TACKLE_KEYS).toContain(l.k);
    expect(buildTackleGeometry('nope')).toBeNull();
  });
  for (const k of TACKLE_KEYS) it(`${k}：位置／法線／顏色齊全、數值有限、置中、最長邊 1`, () => {
    const g = buildTackleGeometry(k)!;
    expect(g).toBeInstanceOf(THREE.BufferGeometry);
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
    expect(p.count).toBeGreaterThan(90); expect(p.count % 3).toBe(0);
    expect(n.count).toBe(p.count); expect(c.count).toBe(p.count);
    for (const a of [p, n, c]) for (const v of a.array as Float32Array) expect(Number.isFinite(v)).toBe(true);
    for (const v of c.array as Float32Array) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    // 一個 mesh、面數不爆
    expect(p.count / 3).toBeLessThan(6000);
    const s = g.boundingBox!.getSize(new THREE.Vector3()), ctr = g.boundingBox!.getCenter(new THREE.Vector3());
    expect(Math.max(s.x, s.y, s.z)).toBeCloseTo(1, 5);
    expect(ctr.length()).toBeLessThan(1e-5);
    // 有顏色變化（不是單色塊）
    const cols = new Set<string>(); for (let i = 0; i < c.count; i += 3) cols.add(`${c.getX(i).toFixed(3)},${c.getY(i).toFixed(3)},${c.getZ(i).toFixed(3)}`);
    expect(cols.size).toBeGreaterThanOrEqual(3);
    g.dispose();
  });
  it('假魚和餌是橫躺的（長大於高），快取同一個幾何', () => {
    for (const k of TACKLE_KEYS) {
      const s = tackleGeometry(k)!.boundingBox!.getSize(new THREE.Vector3());
      expect(s.x).toBeCloseTo(1, 5);
      expect(s.y).toBeLessThan(0.75);
    }
    expect(tackleGeometry('jig')).toBe(tackleGeometry('jig'));
    disposeTackleGeometries();
  });
  it('慢搖鐵板比鐵板寬、大鉛筆餌比米諾細長', () => {
    const sz = (k: string) => buildTackleGeometry(k)!.boundingBox!.getSize(new THREE.Vector3());
    expect(sz('slowjig').y).toBeGreaterThan(sz('jig').y);
    expect(sz('stickbait').y).toBeLessThan(sz('minnow').y);
  });
});

describe('雜貨店釣具卡片的 3D 縮圖', () => {
  it('餌、假魚卡片帶 data-tk；釣竿沒有；購買鈕仍是 data-fishbuy', () => {
    const html = fishShopHtml({ money: 99999 }, { rod: '<svg id="r"></svg>', bait: '<svg id="b"></svg>', lure: '<svg id="l"></svg>' }, fmt);
    for (const l of FISH.lures) expect(html).toContain(`data-tk="${l.k}"`);
    for (const b of FISH.baits.filter(x => x.id)) expect(html).toContain(`data-tk="${b.k}"`);
    expect(html).not.toContain('data-tk="oyster"');
    expect((html.match(/data-tk="/g) ?? []).length).toBe(FISH.lures.length + 3);
    expect(html).not.toContain('data-fbuy');
    expect((html.match(/data-fishbuy="/g) ?? []).length).toBe(fishShopRows().length);
  });
  it('已畫好的縮圖直接用 img（重畫不閃），沒畫好先放線條圖示', () => {
    const r = fishShopRows().find(x => x.tk === 'egi')!;
    expect(tackleIcHtml(r, '<svg></svg>')).toBe('<div class="itemIc tkIc" data-tk="egi"><svg></svg></div>');
    const h = tackleIcHtml(r, '<svg></svg>', k => (k === 'egi' ? 'data:image/png;base64,AA' : undefined));
    expect(h).toContain('data-tkok="1"'); expect(h).toContain('<img class="tkImg" src="data:image/png;base64,AA"'); expect(h).not.toContain('<svg');
    const rod = fishShopRows().find(x => x.kind === 'rod')!;
    expect(tackleIcHtml(rod, '<svg></svg>', () => 'x')).toBe('<div class="itemIc tkIc"><svg></svg></div>');
  });
});
