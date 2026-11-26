import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FISH, LURE_KEYS, LURE_TIP, ITEM_NAME, TROLL_LURES, isLure, isSquidSp, castRange, castDist, rhythmOk, stepLure, newLure, trollOk, DECK, stepDeck, type LureKey, type LureSt } from './fishLogic';
import { FISH_SPECIES, FISH_DESC, FISH_TIER, FISH_SEG, buildFishGeometry, fishModelIds, isPhotoFish, makeFishMesh } from './fishModel';
import { FxPool, FX } from './fishFx';
import { PB, stepSwim } from './boatLogic';
import { SEA } from '../../sea/seaLogic';
import { PLAZA_WALK_SPD, walkAmpOf } from '../../world/walkSpeed';
import { plazaGaitRate } from '../../dm/character';

const st = (o: Partial<LureSt>): LureSt => ({ dist: 10, depth: 0.2, holdS: 0, hold: 0, spd: 0, jerk: 0, okT: 0, follow: false, ...o });
const NEW: LureKey[] = ['stickbait', 'trollskirt', 'slowjig', 'egi'];

describe('進階大物路亞：8 種假魚', () => {
  it('名單、價格、名字、說明', () => {
    expect(LURE_KEYS).toEqual(['minnow', 'jig', 'soft', 'popper', 'stickbait', 'trollskirt', 'slowjig', 'egi']);
    expect(FISH.lures.map(l => l.k)).toEqual(LURE_KEYS);
    const px = Object.fromEntries(FISH.lures.map(l => [l.id, l.price]));
    expect(px).toMatchObject({ fishLureStickbait: 4_000, fishLureTrollSkirt: 5_500, fishLureSlowJig: 4_800, fishLureEgi: 3_200 });
    for (const k of LURE_KEYS) { expect(isLure(k)).toBe(true); expect(ITEM_NAME[k].length).toBeGreaterThan(1); expect(LURE_TIP[k].length).toBeGreaterThan(8); }
    expect(isLure('shrimp')).toBe(false); expect(isLure('oyster')).toBe(false);
  });
  it('拋竿距離（伺服器 FishLureCastMax 同值）', () => {
    const want: Record<LureKey, number> = { minnow: 26, jig: 40, soft: 22, popper: 30, stickbait: 34, trollskirt: 28, slowjig: 42, egi: 24 };
    for (const k of LURE_KEYS) { expect(castRange(k)).toEqual({ min: 5, max: want[k] }); expect(castDist(1, k)).toBe(want[k]); expect(castDist(0, k)).toBe(5); }
    expect(castDist(1, 'slowjig')).toBeGreaterThan(castDist(1, 'jig'));
  });
  it('拖釣：米諾、鐵板、裙尾、鉛筆餌可以；軟蟲、波趴、慢搖鐵板、木蝦不行；駕駛不行', () => {
    expect([...TROLL_LURES].sort()).toEqual(['jig', 'minnow', 'stickbait', 'trollskirt']);
    for (const k of LURE_KEYS) expect(trollOk(1, k, 2)).toBe(TROLL_LURES.includes(k));
    expect(trollOk(0, 'trollskirt', 2)).toBe(false);
    expect(trollOk(1, 'trollskirt', 0.3)).toBe(false);
    expect(trollOk(1, 'trollskirt', 5)).toBe(false);
  });
  it('每種假魚的節奏', () => {
    // 原本四種不變
    expect(rhythmOk('minnow', st({ spd: 2, jerk: 1 }))).toBe(true);
    expect(rhythmOk('jig', st({ depth: 0.5, jerk: 1, hold: 0.2 }))).toBe(true);
    expect(rhythmOk('soft', st({ depth: 0.7, spd: 0.6, jerk: 0.2 }))).toBe(true);
    expect(rhythmOk('popper', st({ depth: 0, jerk: 1, hold: 0.1 }))).toBe(true);
    // 大鉛筆餌：上層、中快收＋抽竿
    expect(rhythmOk('stickbait', st({ depth: 0.2, spd: 1.4, jerk: 1.2 }))).toBe(true);
    expect(rhythmOk('stickbait', st({ depth: 0.7, spd: 1.4, jerk: 1.2 }))).toBe(false);
    expect(rhythmOk('stickbait', st({ depth: 0.2, spd: 1.4, jerk: 0 }))).toBe(false);
    expect(rhythmOk('stickbait', st({ depth: 0.2, spd: 0.4, jerk: 1.2 }))).toBe(false);
    // 船拖裙尾假餌：一直快收、上層
    expect(rhythmOk('trollskirt', st({ depth: 0.1, spd: 2.2 }))).toBe(true);
    expect(rhythmOk('trollskirt', st({ depth: 0.1, spd: 1.0 }))).toBe(false);
    expect(rhythmOk('trollskirt', st({ depth: 0.6, spd: 2.2 }))).toBe(false);
    // 慢搖鐵板：沉深、輕抽停頓
    expect(rhythmOk('slowjig', st({ depth: 0.6, jerk: 1, hold: 0.2 }))).toBe(true);
    expect(rhythmOk('slowjig', st({ depth: 0.3, jerk: 1, hold: 0.2 }))).toBe(false);
    expect(rhythmOk('slowjig', st({ depth: 0.6, jerk: 3.5, hold: 0.2 }))).toBe(false);
    expect(rhythmOk('slowjig', st({ depth: 0.6, jerk: 1, hold: 0.8 }))).toBe(false);
    // 木蝦：抽一下沉一下，不能一直快收
    expect(rhythmOk('egi', st({ depth: 0.4, jerk: 1, hold: 0.2, spd: 0.4 }))).toBe(true);
    expect(rhythmOk('egi', st({ depth: 0.1, jerk: 1, hold: 0.2 }))).toBe(false);
    expect(rhythmOk('egi', st({ depth: 0.4, jerk: 1, hold: 0.9, spd: 2.5 }))).toBe(false);
  });
  it('照教學的手法操作，節奏真的會對（魚影跟上來）', () => {
    const run = (k: LureKey, fn: (i: number) => { reel: boolean; jerk: boolean }, sec = 14) => {
      const s = newLure(28, k); let ok = false;
      for (let i = 0; i < sec * 30; i++) { const a = fn(i); stepLure(s, k, a.reel, a.jerk, 1 / 30); if (s.follow) ok = true; }
      return ok;
    };
    // 鉛筆餌：一直收、每 1 秒抽一下
    expect(run('stickbait', i => ({ reel: true, jerk: i % 30 === 0 }))).toBe(true);
    // 裙尾：一直收
    expect(run('trollskirt', () => ({ reel: true, jerk: false }))).toBe(true);
    // 慢搖鐵板：先沉 3 秒，之後每 1.5 秒抽一下、不收線
    expect(run('slowjig', i => ({ reel: false, jerk: i > 90 && i % 45 === 0 }))).toBe(true);
    // 木蝦：先沉 2 秒，每 1.2 秒抽一下
    expect(run('egi', i => ({ reel: false, jerk: i > 60 && i % 36 === 0 }))).toBe(true);
    // 木蝦一直快收：不行
    expect(run('egi', () => ({ reel: true, jerk: false }))).toBe(false);
    // 拖釣：裙尾自動算對、假魚在上層
    const tr = newLure(10, 'trollskirt');
    for (let i = 0; i < 60; i++) stepLure(tr, 'trollskirt', false, false, 1 / 30, true);
    expect(tr.follow).toBe(true); expect(tr.depth).toBeLessThan(0.2);
  });
});

describe('25 種魚（含巨物、韓國魚）', () => {
  it('舊的 16 種順序不變、後來的接在後面；巨物是第 3 級；韓國魚是普通', () => {
    expect(FISH_SPECIES.length).toBe(25);
    expect(FISH_SPECIES.slice(0, 16).map(s => s.id)).toEqual(['kurodai', 'kisu', 'aigo', 'aji', 'hata', 'isaki', 'tachiuo', 'suzuki', 'katsuo', 'kanpachi', 'torahata', 'shiira', 'gt', 'tamakai', 'kajiki', 'maguro']);
    expect(FISH_SPECIES.slice(16).map(s => [s.id, s.tier])).toEqual([['sawara', 1], ['sugi', 1], ['aoriika', 1], ['kouika', 1], ['kurokajiki', 2], ['mebachi', 2], ['shumoku', 3], ['manbou', 3], ['hanguoyu', 0]]);
    expect(FISH_TIER).toEqual(['普通', '稀有', '傳說', '巨物']);
    expect(fishModelIds().sort()).toEqual(FISH_SPECIES.filter(s => !isPhotoFish(s.id)).map(s => s.id).sort());
    expect(isSquidSp('aoriika')).toBe(true); expect(isSquidSp('kouika')).toBe(true); expect(isSquidSp('tachiuo')).toBe(false);
    for (const s of FISH_SPECIES) expect(FISH_DESC[s.id]).not.toMatch(/餌|碼頭|拖釣|深海|晚上|白天|機率|木蝦|鐵板/);
    expect(FISH_DESC.hanguoyu).toBe('我跟你聊的是大海，你在跟我聊漱口杯？');
    expect(buildFishGeometry('hanguoyu')).toBeNull();
    expect(() => makeFishMesh('hanguoyu')).not.toThrow();
  });
  it('每種都有正常的幾何（有頂點、沒有壞數字、面數不爆、長度 1）', () => {
    for (const s of FISH_SPECIES.filter(s => !isPhotoFish(s.id))) {
      const g = buildFishGeometry(s.id)!;
      expect(g, s.id).toBeTruthy();
      const pos = g.getAttribute('position'), col = g.getAttribute('color'), nor = g.getAttribute('normal');
      expect(pos.count).toBeGreaterThan(900);
      expect(col.count).toBe(pos.count); expect(nor.count).toBe(pos.count);
      expect(pos.count / 3).toBeLessThan(FISH_SEG.along * FISH_SEG.around * 2 + 900);
      for (const a of [pos.array, col.array, nor.array]) for (let i = 0; i < a.length; i++) expect(Number.isFinite(a[i])).toBe(true);
      g.computeBoundingBox(); const bb = g.boundingBox!;
      expect(bb.max.x - bb.min.x).toBeCloseTo(1, 1);
      g.dispose();
    }
  });
  const box = (id: string) => { const g = buildFishGeometry(id)!; g.computeBoundingBox(); const b = g.boundingBox!.clone(); g.dispose(); return { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z }; };
  it('長相：雙髻鯊的槌頭很寬、翻車魚比長度還高、頭足類的側鰭讓身體很寬、黑皮旗魚有長嘴但沒有大帆', () => {
    // 雙髻鯊：頭最前面 12% 的左右寬度＞身體最粗處
    const g = buildFishGeometry('shumoku')!; g.computeBoundingBox();
    const mx = g.boundingBox!.max.x, p = g.getAttribute('position');
    let headZ = 0, bodyZ = 0;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = Math.abs(p.getZ(i)); if (x > mx - 0.12) headZ = Math.max(headZ, z); else if (x > mx - 0.5) bodyZ = Math.max(bodyZ, z); }
    expect(headZ).toBeGreaterThan(bodyZ * 1.2);
    g.dispose();
    expect(box('manbou').h).toBeGreaterThan(1);
    expect(box('aoriika').d).toBeGreaterThan(box('tachiuo').d * 2);
    expect(box('kouika').d).toBeGreaterThan(box('kouika').h * 1.2);
    // 黑皮旗魚：背鰭比雨傘旗魚的帆矮很多
    const topFront = (id: string) => { const g = buildFishGeometry(id)!; g.computeBoundingBox(); const b = g.boundingBox!; const p = g.getAttribute('position'); let hi = -9; for (let i = 0; i < p.count; i++) if (p.getX(i) > b.min.x + 0.4) hi = Math.max(hi, p.getY(i)); g.dispose(); return hi; };
    expect(topFront('kurokajiki')).toBeLessThan(topFront('kajiki') * 0.75);
    const front = (id: string) => { const g = buildFishGeometry(id)!; g.computeBoundingBox(); const mx = g.boundingBox!.max.x; const p = g.getAttribute('position'); let lo = 9, hi = -9; for (let i = 0; i < p.count; i++) if (p.getX(i) > mx - 0.08) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); } g.dispose(); return hi - lo; };
    expect(front('kurokajiki')).toBeLessThan(0.035);
    // 大目鮪比黑鮪魚胖（體高／長）
    expect(box('mebachi').h).toBeGreaterThan(box('maguro').h);
  });
  it('一條魚一個 mesh：同一個 BufferGeometry 就是 1 個 draw call', () => {
    for (const id of ['shumoku', 'manbou', 'aoriika', 'kouika']) {
      const g = buildFishGeometry(id)!; const m = new THREE.Mesh(g);
      expect(m.geometry.groups.length).toBe(0); g.dispose();
    }
  });
});

describe('特效粒子池（氣泡、墨）', () => {
  it('固定數量循環用、時間到就消失、滿了蓋最舊的', () => {
    const p = new FxPool(4);
    for (let i = 0; i < 6; i++) p.spawn(i, 0, 0, 0, 0.3, 0, 1, 0.2, 1);
    expect(p.live()).toBe(4); expect(p.p.length).toBe(4);
    expect(p.p.map(q => q.x).sort()).toEqual([2, 3, 4, 5]);
    expect(p.step(0.5)).toBe(4);
    expect(FxPool.size(p.p[0])).toBeGreaterThan(0.2);
    expect(p.step(0.6)).toBe(0);
    // 冒出水面太高就破
    const b = new FxPool(2); b.spawn(0, 0, 0, 0, 1, 0, 5, 1, 1);
    expect(b.step(0.1, 1, 0.15)).toBe(1); expect(b.step(0.1, 1, 0.15)).toBe(0);
    // 最後慢慢縮到 0
    const q = p.spawn(0, 0, 0, 0, 0, 0, 1, 0.2, 1); q.age = 0.999; expect(FxPool.size(q)).toBeLessThan(0.01);
    expect(FX.inkCap).toBeLessThanOrEqual(16); expect(FX.bubbleCap).toBeLessThanOrEqual(32);
  });
});

describe('甲板走路、游泳速度', () => {
  it('甲板走路跟廣場走路一樣快，步頻／擺腿也一樣', () => {
    expect(PLAZA_WALK_SPD).toBe(3);
    expect(DECK.walkSpd).toBe(PLAZA_WALK_SPD);
    const p = { x: 0, z: 0, yaw: 0 };
    stepDeck(p, 0, 1, 0, 0, 0.1);
    expect(p.z).toBeCloseTo(-0.3);
    // 有裝備加速：帶進來的速度
    const q = { x: 0, z: 0, yaw: 0 };
    stepDeck(q, 0, 1, 0, 0, 0.1, 3.6);
    expect(q.z).toBeCloseTo(-0.36);
    expect(plazaGaitRate(DECK.walkSpd)).toBe(15);
    expect(walkAmpOf(DECK.walkSpd)).toBe(1);
  });
  it('游泳 1.35 → 2.1 m/s（快約 55%），還是比船慢', () => {
    expect(PB.swimSpd).toBe(2.1);
    expect(PB.swimSpd / 1.35).toBeGreaterThan(1.5); expect(PB.swimSpd / 1.35).toBeLessThan(1.6);
    expect(PB.swimSpd).toBeLessThan(SEA.maxSpd / 3);
    const s = { x: -80, z: 0, h: 0 };
    stepSwim(s, 1, 0, 1);
    expect(Math.hypot(s.x + 80, s.z)).toBeCloseTo(2.1);
  });
});

describe('新假魚都在', () => {
  it('四款新的都是可以重複用的假魚', () => {
    for (const k of NEW) expect(FISH.lures.find(l => l.k === k)?.id).toMatch(/^fishLure/);
  });
});
