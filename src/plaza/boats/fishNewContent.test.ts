import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { FISH, LURE_KEYS, LURE_TIP, LURE_DEPTH, LURE_PHYS, ITEM_NAME, TROLL_LURES, SQUID_SP, isSquidSp, castRange, rhythmOk, stepLure, newLure, inDepthZone, trollOk, type LureKey, type LureSt } from './fishLogic';
import { FISH_SPECIES, FISH_DESC, buildFishGeometry, makeFishMesh, fishGeometry, isPhotoFish } from './fishModel';
import { makeFishFx } from './fishFx';
import { mountFishDex, fishDexMerge } from './fishDex';
import { fishDbg } from './plazaFish';
import { TACKLE_KEYS, buildTackleGeometry } from '../../shop/tackleModel';
import { fishShopRows, fishShopHtml, tackleIcHtml, LURE_GOOD } from '../../shop/fishShop';

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.requestAnimationFrame ??= () => 0;
  g.cancelAnimationFrame ??= () => {};
});

const NEW_LURES: LureKey[] = ['vib', 'tairubber', 'deepcrank', 'squidjig'];
const NEW_SP = ['madai', 'bora', 'fugu', 'akahata', 'hirame', 'kamasu', 'tako', 'ei', 'ryugu', 'manta', 'jinbei', 'daiouika'];
const st = (o: Partial<LureSt>): LureSt => ({ dist: 10, depth: 0.5, holdS: 0, hold: 0, spd: 0, jerk: 0, okT: 0, follow: false, ...o });

describe('4 種新假餌：顫泳餌、鯛魚頭、深潛胖胖餌、小透抽軟餌', () => {
  it('名單接在後面、價格、id、名字、說明、拋竿距離、水層', () => {
    expect(LURE_KEYS.slice(8)).toEqual(NEW_LURES);
    const rows = Object.fromEntries(FISH.lures.map(l => [l.k, l]));
    expect([rows.vib, rows.tairubber, rows.deepcrank, rows.squidjig].map(l => [l.id, l.n, l.price])).toEqual([
      ['fishLureVib', '顫泳餌', 2_600], ['fishLureTaiRubber', '鯛魚頭', 3_600], ['fishLureDeepCrank', '深潛胖胖餌', 2_400], ['fishLureSquidJig', '小透抽軟餌', 3_400],
    ]);
    expect(NEW_LURES.map(k => castRange(k).max)).toEqual([32, 30, 28, 26]);
    expect(NEW_LURES.map(k => LURE_DEPTH[k])).toEqual([{ min: 0.35, max: 0.85 }, { min: 0.65, max: 1 }, { min: 0.4, max: 0.8 }, { min: 0.45, max: 1 }]);
    for (const k of NEW_LURES) {
      expect(ITEM_NAME[k]).toBe(rows[k].n);
      expect(LURE_TIP[k].length).toBeGreaterThan(10); expect(LURE_TIP[k].length).toBeLessThan(40);
      expect(LURE_GOOD[k].length).toBeGreaterThan(8);
      expect(LURE_PHYS[k]).toBeTruthy();
    }
    // 拖釣：顫泳餌、深潛胖胖餌可以；鯛魚頭、小透抽軟餌不行
    expect(TROLL_LURES).toContain('vib'); expect(TROLL_LURES).toContain('deepcrank');
    expect(trollOk(1, 'vib', 2)).toBe(true); expect(trollOk(1, 'deepcrank', 2)).toBe(true);
    expect(trollOk(1, 'tairubber', 2)).toBe(false); expect(trollOk(1, 'squidjig', 2)).toBe(false);
  });
  it('節奏判定', () => {
    // 顫泳餌：中深層中快收，不用抽竿；太淺、太慢不行
    expect(rhythmOk('vib', st({ depth: 0.5, spd: 1.6 }))).toBe(true);
    expect(rhythmOk('vib', st({ depth: 0.2, spd: 1.6 }))).toBe(false);
    expect(rhythmOk('vib', st({ depth: 0.5, spd: 0.8 }))).toBe(false);
    // 鯛魚頭：貼底慢等速、不能抽
    expect(rhythmOk('tairubber', st({ depth: 0.9, spd: 0.7 }))).toBe(true);
    expect(rhythmOk('tairubber', st({ depth: 0.9, spd: 0.7, jerk: 1 }))).toBe(false);
    expect(rhythmOk('tairubber', st({ depth: 0.9, spd: 2 }))).toBe(false);
    expect(rhythmOk('tairubber', st({ depth: 0.5, spd: 0.7 }))).toBe(false);
    // 深潛胖胖餌：中速
    expect(rhythmOk('deepcrank', st({ depth: 0.6, spd: 1.2 }))).toBe(true);
    expect(rhythmOk('deepcrank', st({ depth: 0.6, spd: 2.2 }))).toBe(false);
    expect(rhythmOk('deepcrank', st({ depth: 0.2, spd: 1.2 }))).toBe(false);
    // 小透抽軟餌：底層輕抽短停
    expect(rhythmOk('squidjig', st({ depth: 0.7, jerk: 1, hold: 0.2, spd: 0.4 }))).toBe(true);
    expect(rhythmOk('squidjig', st({ depth: 0.7, jerk: 0, hold: 0.2 }))).toBe(false);
    expect(rhythmOk('squidjig', st({ depth: 0.7, jerk: 1, hold: 0.9, spd: 2 }))).toBe(false);
  });
  const run = (k: LureKey, fn: (i: number) => { reel: boolean; jerk: boolean }, sec = 14) => {
    const s = newLure(28, k); let ok = false, maxD = 0;
    for (let i = 0; i < sec * 30; i++) { const a = fn(i); if (stepLure(s, k, a.reel, a.jerk, 1 / 30)) break; if (s.follow) ok = true; maxD = Math.max(maxD, s.depth); }
    return { ok, s, maxD };
  };
  it('照說明的手法操作，魚影會跟上來；做錯就不行', () => {
    // 顫泳餌：先沉 1.5 秒，再一直收
    expect(run('vib', i => ({ reel: i > 45, jerk: false })).ok).toBe(true);
    // 一拋下去就快收：浮在上層，不行
    expect(run('vib', () => ({ reel: true, jerk: false })).ok).toBe(false);
    // 鯛魚頭：沉 3 秒到底，之後收 0.3 秒停 0.3 秒（慢慢等速）
    expect(run('tairubber', i => ({ reel: i > 90 && i % 18 < 9, jerk: false }), 20).ok).toBe(true);
    // 鯛魚頭一直抽竿：不行
    expect(run('tairubber', i => ({ reel: false, jerk: i > 90 && i % 20 === 0 }), 20).ok).toBe(false);
    // 深潛胖胖餌：按住一直收就好（舌板自己潛到中深層）
    const dc = run('deepcrank', () => ({ reel: true, jerk: false }));
    expect(dc.ok).toBe(true); expect(dc.maxD).toBeGreaterThan(0.4); expect(dc.maxD).toBeLessThanOrEqual(0.8);
    // 小透抽軟餌：先沉 2 秒，每 1.2 秒輕抽一下
    expect(run('squidjig', i => ({ reel: false, jerk: i > 60 && i % 36 === 0 })).ok).toBe(true);
    expect(run('squidjig', () => ({ reel: true, jerk: false })).ok).toBe(false);
  });
  it('水裡的物理：顫泳餌、鯛魚頭沉得快；胖胖餌不收會浮、收線最快 1.6 m/s', () => {
    const sinkFor = (k: LureKey, sec: number) => { const s = newLure(20, k); for (let i = 0; i < sec * 30; i++) stepLure(s, k, false, false, 1 / 30); return s.depth; };
    expect(sinkFor('vib', 1)).toBeGreaterThan(sinkFor('minnow', 1) * 1.6);
    expect(sinkFor('tairubber', 1)).toBeGreaterThan(sinkFor('minnow', 1) * 1.5);
    expect(sinkFor('deepcrank', 2)).toBeLessThanOrEqual(0.05);
    const s = newLure(20, 'deepcrank'); s.depth = 0.6;
    for (let i = 0; i < 90; i++) stepLure(s, 'deepcrank', false, false, 1 / 30);
    expect(s.depth).toBeLessThan(0.35);
    const r = newLure(20, 'deepcrank');
    for (let i = 0; i < 150; i++) stepLure(r, 'deepcrank', true, false, 1 / 30);
    expect(r.spd).toBeLessThanOrEqual(1.6 + 1e-6); expect(inDepthZone('deepcrank', r.depth)).toBe(true);
    // 拖釣：顫泳餌在中層、胖胖餌更深
    const t = newLure(10, 'vib'), u = newLure(10, 'deepcrank');
    for (let i = 0; i < 120; i++) { stepLure(t, 'vib', false, false, 1 / 30, true); stepLure(u, 'deepcrank', false, false, 1 / 30, true); }
    expect(inDepthZone('vib', t.depth)).toBe(true); expect(inDepthZone('deepcrank', u.depth)).toBe(true); expect(t.follow).toBe(true);
  });
  it('雜貨店：買得到、有 3D 縮圖（12 種假魚＋3 種餌）', () => {
    const rows = fishShopRows();
    for (const k of NEW_LURES) {
      const r = rows.find(x => x.tk === k)!;
      expect(r.kind).toBe('lure'); expect(r.good).toBe(LURE_GOOD[k]);
      expect(tackleIcHtml(r, '<svg></svg>')).toBe(`<div class="itemIc tkIc" data-tk="${k}"><svg></svg></div>`);
    }
    const html = fishShopHtml({ money: 99_999, meds: {} }, { rod: '<svg></svg>', bait: '<svg></svg>', lure: '<svg></svg>' }, { qtyHtml: () => '', px: (_k, b) => b, pxHtml: (_k, b) => `$${b}`, pxCd: () => '' });
    for (const n of ['顫泳餌', '鯛魚頭', '深潛胖胖餌', '小透抽軟餌']) expect(html).toContain(n);
    expect(TACKLE_KEYS.filter(k => (LURE_KEYS as readonly string[]).includes(k))).toHaveLength(12);
    expect((html.match(/data-tk="/g) ?? []).length).toBe(15);
    const sz = (k: string) => { const g = buildTackleGeometry(k)!; const v = g.boundingBox!.getSize(new THREE.Vector3()); g.dispose(); return v; };
    // 顫泳餌側扁（高比寬多）、胖胖餌圓胖（比米諾高）、布捲細長
    expect(sz('vib').y).toBeGreaterThan(sz('vib').z * 1.5);
    expect(sz('deepcrank').y).toBeGreaterThan(sz('minnow').y);
    expect(sz('squidjig').y).toBeLessThan(sz('minnow').y);
    for (const k of NEW_LURES) { const g = buildTackleGeometry(k)!; expect(g.getAttribute('position').count / 3).toBeLessThan(3000); g.dispose(); }
  });
});

describe('12 種新魚（第 25～36 號）', () => {
  it('接在韓國魚後面、稀有度、只寫外觀的說明', () => {
    expect(FISH_SPECIES).toHaveLength(37);
    expect(FISH_SPECIES[24].id).toBe('hanguoyu');
    expect(FISH_SPECIES.slice(25).map(s => [s.id, s.name, s.tier])).toEqual([
      ['madai', '嘉鱲', 0], ['bora', '烏魚', 0], ['fugu', '河豚', 0],
      ['akahata', '紅鰷', 1], ['hirame', '比目魚', 1], ['kamasu', '金梭魚', 1], ['tako', '章魚', 1],
      ['ei', '魟魚', 2], ['ryugu', '皇帶魚', 2],
      ['manta', '鬼蝠魟', 3], ['jinbei', '鯨鯊', 3], ['daiouika', '大王烏賊', 3],
    ]);
    expect(new Set(FISH_SPECIES.map(s => s.id)).size).toBe(37);
    const lureNames = FISH.lures.map(l => l.n).concat(FISH.baits.map(b => b.n));
    for (const id of NEW_SP) {
      const d = FISH_DESC[id];
      expect(d.length).toBeGreaterThan(20);
      expect(d).not.toMatch(/餌|碼頭|拖釣|深海|晚上|白天|夜|機率|木蝦|鐵板|路亞|垂釣|海底|水層|蚵棚|釣/);
      for (const n of lureNames) expect(d).not.toContain(n);
    }
  });
  it('每種都有低面數 3D 模型（正規化、沒有壞數字、一個 mesh）', () => {
    for (const id of NEW_SP) {
      expect(isPhotoFish(id)).toBe(false);
      const g = buildFishGeometry(id)!;
      expect(g, id).toBeTruthy();
      const p = g.getAttribute('position');
      expect(p.count).toBeGreaterThan(900);
      expect(p.count / 3, id).toBeLessThan(2100);
      for (const a of [p.array, g.getAttribute('color').array, g.getAttribute('normal').array]) for (let i = 0; i < a.length; i++) expect(Number.isFinite(a[i])).toBe(true);
      g.computeBoundingBox(); expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeCloseTo(1, 1);
      g.dispose();
      const m = makeFishMesh(id)!;
      expect(m).toBeInstanceOf(THREE.Mesh); expect(m.geometry).toBe(fishGeometry(id));
      expect(makeFishMesh(id)!.material).toBe(m.material);
    }
  });
  const box = (id: string) => { const g = buildFishGeometry(id)!; g.computeBoundingBox(); const b = g.boundingBox!.clone(); g.dispose(); return { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z }; };
  it('長相認得出來', () => {
    // 河豚：圓球（高、寬都超過長度一半）
    expect(box('fugu').h).toBeGreaterThan(0.55); expect(box('fugu').d).toBeGreaterThan(0.5);
    // 比目魚、魟魚、鬼蝠魟：平躺（寬遠大於高）；鬼蝠魟翅膀比長度還寬
    expect(box('hirame').d).toBeGreaterThan(box('hirame').h * 3);
    expect(box('ei').d).toBeGreaterThan(box('ei').h * 5);
    expect(box('manta').d).toBeGreaterThan(1);
    // 皇帶魚：超長緞帶（比白帶魚還扁），冠鬣讓頭最高
    expect(box('ryugu').d).toBeLessThan(0.1); expect(box('ryugu').h).toBeLessThan(0.3);
    // 金梭魚細長、嘉鱲高
    expect(box('kamasu').h).toBeLessThan(box('madai').h * 0.5);
    // 章魚：腕往四周散開（後段 25% 的腕尖離中心比大軟絲、花枝遠很多）
    const armReach = (id: string) => { const g = buildFishGeometry(id)!; g.computeBoundingBox(); const b = g.boundingBox!, p = g.getAttribute('position'); let r = 0; for (let i = 0; i < p.count; i++) if (p.getX(i) < b.min.x + 0.25) r = Math.max(r, Math.abs(p.getZ(i)), Math.abs(p.getY(i))); g.dispose(); return r; };
    expect(armReach('tako')).toBeGreaterThan(armReach('aoriika') * 3);
    expect(armReach('tako')).toBeGreaterThan(armReach('kouika') * 1.5);
    // 鯨鯊：頭比身高還寬
    const g = buildFishGeometry('jinbei')!; g.computeBoundingBox();
    const mx = g.boundingBox!.max.x, p = g.getAttribute('position'); let z0 = 9, z1 = -9, y0 = 9, y1 = -9;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > mx - 0.06) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); y0 = Math.min(y0, p.getY(i)); y1 = Math.max(y1, p.getY(i)); }
    expect(z1 - z0).toBeGreaterThan((y1 - y0) * 1.2); g.dispose();
  });
  it('章魚、大王烏賊是頭足類：中魚和拉上來都噴墨', () => {
    expect(SQUID_SP).toEqual(['aoriika', 'kouika', 'tako', 'daiouika']);
    for (const id of ['tako', 'daiouika', 'aoriika', 'kouika']) expect(isSquidSp(id)).toBe(true);
    for (const id of NEW_SP.filter(x => x !== 'tako' && x !== 'daiouika')) expect(isSquidSp(id)).toBe(false);
    const fx = makeFishFx(new THREE.Group());
    fx.inkPuff(0, 0, 0, 1.2);
    expect(fx.ink.live()).toBeGreaterThan(0);
  });
  it('圖鑑：37 張卡、釣到新魚會顯示名字和重量；秀漁獲不會丟例外', () => {
    const host = () => {
      const stub = { addEventListener() {}, querySelectorAll: () => [] as unknown[], classList: { add() {} } };
      return { innerHTML: '', scrollTop: 0, querySelectorAll: () => [] as unknown[], querySelector: () => stub, classList: { add() {} } } as unknown as HTMLElement & { innerHTML: string };
    };
    fishDexMerge([{ sp: 'jinbei', kg: 612.5, n: 1 }, { sp: 'tako', kg: 3.2, n: 2 }]);
    const h = host(); const v = mountFishDex(h);
    expect((h.innerHTML.match(/class="fdxCard /g) || []).length).toBe(37);
    expect(h.innerHTML).toContain('鯨鯊'); expect(h.innerHTML).toContain('章魚');
    expect(h.innerHTML).not.toContain('大王烏賊');
    expect(h.innerHTML).toContain('最大 612.5 kg・1 條'); expect(h.innerHTML).toMatch(/fdxCard t3[^"]*" [^>]*data-sp="jinbei"/);
    v.stop(false);
    for (const id of NEW_SP) expect(() => fishDbg.fakeCatch(id, 2)).not.toThrow();
  });
});
