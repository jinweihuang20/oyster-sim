import { describe, it, expect } from 'vitest';
import { ISLET, onIsletLand, onIsletWalk, isletGroundY, distToIslet, isletLandSpot, isletWalkClamp, isletFishable, isletSellNear, isletDiveSpot, isletPushOut, isletClampToWalk } from './islet';
import { PB, onLand, distToLand, landSpot, pushStatic, stepSwim } from './boats/boatLogic';
import { canFishAt, castHitsLand, FISH } from './boats/fishLogic';
import { plazaGroundY, WALK_BOUND_WEST } from './layout';
import { isletParts } from './boats/isletGeo';

/** 伺服器 PlazaIsletTests 用同一批點（兩邊一起改） */
const SYNC_WALK: readonly [number, number][] = [
  [ISLET.cx, ISLET.cz], [ISLET.cx + 2, 0], [ISLET.cx - 2, 1], [-126, 0], [-125, 0.4],
];
const SYNC_FISH_OK: readonly [number, number][] = [
  [ISLET.cx + 3.8, 0], [ISLET.cx, ISLET.r - 0.5], [ISLET.cx, -(ISLET.r - 0.5)], [-125.2, 0], [-126.5, 0.5],
];
const SYNC_FISH_NO: readonly [number, number][] = [
  [-100, 0], [-40, 0], [-132, 20], [-120, 0], [0, 0],
];

describe('CR-39 沙洲平台：位置', () => {
  it('單位是公尺；碼頭西端到沙洲中心約 92 m，整座都在海面可行駛範圍內', () => {
    expect(PB.pierX1).toBe(-40);
    expect(PB.sea.x0).toBe(-140);
    expect(ISLET.cx).toBe(-132);
    expect(ISLET.cz).toBe(0);
    expect(ISLET.r * 2).toBeGreaterThanOrEqual(8);
    expect(ISLET.r * 2).toBeLessThanOrEqual(10);
    // 往西 100 m 會落在海面西緣，中心改放 -132，西坡腳仍在 -140 以內
    expect(ISLET.cx - ISLET.r).toBeGreaterThan(PB.sea.x0);
    expect(ISLET.jetX1).toBeGreaterThan(ISLET.cx);
    expect(ISLET.jetX1).toBeLessThan(PB.sea.x1);
    expect(Math.abs(ISLET.cx - PB.pierX1)).toBeCloseTo(92);
    expect(ISLET.cx - PB.pierX1).toBeLessThan(0); // 更西
    expect(Math.abs(ISLET.cx - PB.pierX1)).toBeLessThan(100);
  });
  it('數字跟伺服器 PlazaWorld.Islet.cs 一致', () => {
    expect(ISLET).toMatchObject({
      cx: -132, cz: 0, rTop: 3.4, r: 4.6, jetX0: -127.6, jetX1: -124, sellX: -133.2, sellZ: 1.8,
    });
  });
  it('外觀合進碼頭 mesh：格式一致、三角形有上限', () => {
    const parts = isletParts();
    let tris = 0;
    for (const g of parts) {
      expect(g.index).toBeNull();
      expect(Object.keys(g.attributes).sort()).toEqual(['color', 'normal', 'position']);
      tris += g.attributes.position.count / 3;
    }
    expect(tris).toBeLessThan(2500);
    expect(tris).toBeGreaterThan(80);
  });
});

describe('CR-39 走動與上岸', () => {
  it('沙洲頂、棧橋可以走，周圍海面不行；高度是矮沙丘', () => {
    for (const [x, z] of SYNC_WALK) {
      expect(onIsletWalk(x, z)).toBe(true);
      expect(onIsletLand(x, z)).toBe(true);
      expect(onLand(x, z)).toBe(true);
      expect(plazaGroundY(x, z)).toBeGreaterThan(0);
    }
    expect(plazaGroundY(ISLET.cx, ISLET.cz)).toBeCloseTo(ISLET.topY);
    expect(plazaGroundY(-125, 0)).toBeCloseTo(ISLET.jetY);
    expect(onIsletWalk(-120, 0)).toBe(false);
    expect(onIsletLand(-120, 0)).toBe(false);
    expect(onLand(-80, 0)).toBe(false);
    expect(isletGroundY(0, 0)).toBe(0);
  });
  it('從棧橋旁邊可以上岸；離太遠不行；碼頭原有上岸不受影響', () => {
    const p = landSpot(-123.5, 2.2)!;
    expect(p).not.toBeNull();
    expect(onIsletWalk(p.x, p.z) || onIsletLand(p.x, p.z)).toBe(true);
    expect(landSpot(-80, 30)).toBeNull();
    expect(onLand(-30, 0)).toBe(true);
    expect(landSpot(-40, 3.5)).not.toBeNull();
    expect(distToLand(-123.5, 2.2)).toBeLessThan(PB.landR);
    expect(distToIslet(-123.5, 2.2)).toBeLessThan(3);
  });
  it('走在沙洲上不會掉進海裡；從碼頭走不過去（中間是海）', () => {
    const p = { x: ISLET.cx, z: ISLET.cz };
    for (let i = 0; i < 80; i++) {
      const px = p.x, pz = p.z;
      p.x += 0.15;
      if (!isletWalkClamp(p, px, pz)) { p.x = px; p.z = pz; }
    }
    expect(onIsletWalk(p.x, p.z)).toBe(true);
    expect(p.x).toBeLessThanOrEqual(ISLET.jetX1 - 0.2);
    // 碼頭西端再往西：不是沙洲夾限管的，應維持「走不進海」
    const q = { x: PB.pierX1 + 0.35, z: 0 };
    expect(isletWalkClamp(q, q.x, q.z)).toBe(false);
  });
  it('夾限會把人推回沙洲可走範圍', () => {
    const p = { x: ISLET.cx + 8, z: 0 };
    expect(isletWalkClamp(p, ISLET.cx, ISLET.cz)).toBe(true);
    expect(onIsletWalk(p.x, p.z)).toBe(true);
  });
});

describe('CR-39 停船、游泳、賣魚、釣魚', () => {
  it('船開進沙洲會被推出去並減速', () => {
    const b = { x: ISLET.cx, z: ISLET.cz, h: 0, v: 4 };
    expect(pushStatic(b)).toBe(true);
    expect(b.v).toBeLessThan(4);
    expect(Math.hypot(b.x - ISLET.cx, b.z - ISLET.cz)).toBeGreaterThan(ISLET.r - 1.2);
  });
  it('游泳游不進沙洲；可從沙洲邊上水，落點在海裡', () => {
    const s = { x: ISLET.cx + 1, z: 0, h: 0 };
    stepSwim(s, 1, 0, 0.016);
    expect(onIsletLand(s.x, s.z)).toBe(false);
    const d = isletDiveSpot(ISLET.cx + 2, 0);
    expect(d).not.toBeNull();
    expect(onIsletLand(d!.x, d!.z)).toBe(false);
    expect(d!.x).toBeGreaterThanOrEqual(PB.sea.x0);
    expect(Math.hypot(d!.x - (ISLET.cx + 2), d!.z)).toBeLessThan(8);
  });
  it('沙洲邊和棧橋可以釣；中間海面、碼頭外不行（與伺服器同一批點）', () => {
    for (const [x, z] of SYNC_FISH_OK) {
      expect(isletFishable(x, z)).toBe(true);
      expect(canFishAt('walk', { x, z })).toBe(true);
    }
    for (const [x, z] of SYNC_FISH_NO) expect(isletFishable(x, z)).toBe(false);
    expect(canFishAt('walk', { x: -30, z: 0 })).toBe(true);
  });
  it('往海拋落在海面；拋到沙洲或棧橋算岸上', () => {
    expect(castHitsLand(ISLET.cx, ISLET.cz)).toBe(true);
    expect(castHitsLand(-125, 0)).toBe(true);
    expect(castHitsLand(-140.5, 0)).toBe(true); // 海面西緣外
    expect(castHitsLand(ISLET.cx, 12)).toBe(false);
    expect(castHitsLand(-136, 10)).toBe(false);
    expect(FISH.castMin).toBeGreaterThan(2);
  });
  it('賣魚：人在沙洲／棧橋上或船靠棧橋可以賣', () => {
    expect(isletSellNear(ISLET.sellX, ISLET.sellZ)).toBe(true);
    expect(isletSellNear(ISLET.cx, ISLET.cz)).toBe(true);
    expect(isletSellNear(-123.5, 2.2)).toBe(true);
    expect(isletSellNear(-80, 0)).toBe(false);
    expect(isletSellNear(0, 0)).toBe(false);
  });
});
