import { describe, it, expect } from 'vitest';
import { PROM, PLAT, PROM_WALK, PROM_WALK_S, PROM_WALK_N, PROM_SOLID, PROM_SOLID_S, PROM_MAX_Z, PROM_MIN_Z, PROM_STEP_MAX, promGroundY, promWalkClamp, onPromenade, promFishable, promPushOut, promSolidAt } from './promenade';
import { plazaGroundY, pileObstacles, plazaCafeObstacles, plazaShedObstacles, WALK_BOUND, WALK_BOUND_WEST, MG_PLATFORM, TIDAL_FLAT, NORTH_DOCK, SHED_DOORS, SHED_W, SHED_D, SHED_FRONT_Z, SMOKE_CENTER } from './layout';
import { PB, dockSlot, pushStatic, stepSwim, distToPier } from './boats/boatLogic';
import { canFishAt, castPoint, castHitsLand, FISH } from './boats/fishLogic';
import { promenadeParts } from './boats/promenadeGeo';

/** 伺服器 PlazaPromenadeTests 用同一批點（兩邊一起改）；北側是南側對 z＝0 的鏡像 */
const SYNC_FISH_OK_S: readonly [number, number][] = [[-23.6, 13], [-23.6, 23.9], [-27.2, 24.4], [-27.2, 29.6], [-25.6, 27], [-24.8, 27], [-24.8, 29.6], [-23.2, 24.6]];
const SYNC_FISH_NO_S: readonly [number, number][] = [[-21, 18], [-20.6, 27], [-22, 27], [-21.5, 24.6], [-23.6, 31], [-15, 18], [-28.5, 27]];
const flip = (pts: readonly [number, number][]): [number, number][] => pts.map(([x, z]) => [x, -z]);
const SYNC_FISH_OK = [...SYNC_FISH_OK_S, ...flip(SYNC_FISH_OK_S)];
const SYNC_FISH_NO = [...SYNC_FISH_NO_S, ...flip(SYNC_FISH_NO_S)];

const rectHitsCircle = (r: { x0: number; x1: number; z0: number; z1: number }, cx: number, cz: number, rad: number) => {
  const qx = Math.max(r.x0, Math.min(r.x1, cx)), qz = Math.max(r.z0, Math.min(r.z1, cz));
  return Math.hypot(cx - qx, cz - qz) < rad;
};

/** 模擬 walkSeat.walkStep 的夾限順序（矩形 → 步道 → 工寮街北緣 → 爬升檢查） */
function walk(p: { x: number; z: number }, dx: number, dz: number, steps = 200, sp = 0.08) {
  const L = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < steps; i++) {
    const px = p.x, pz = p.z, gy0 = plazaGroundY(px, pz);
    p.x += dx / L * sp; p.z += dz / L * sp;
    p.x = Math.max(PB.pierX1 + 0.35, Math.min(WALK_BOUND + 8, p.x));
    p.z = Math.max(PROM_MIN_Z, Math.min(PROM_MAX_Z, p.z));
    if (!promWalkClamp(p, px, pz)) {
      if (p.x < -WALK_BOUND_WEST && Math.abs(p.z) > PB.pierHalfW - 0.3) p.x = -WALK_BOUND_WEST;
      if (p.z < -WALK_BOUND && Math.abs(p.x) > NORTH_DOCK.xMax) {
        const adx = Math.abs(p.x) - NORTH_DOCK.xMax, adz = -WALK_BOUND - p.z;
        if (adx <= adz) p.x = Math.sign(p.x) * NORTH_DOCK.xMax; else p.z = -WALK_BOUND;
      }
      if (p.z < NORTH_DOCK.zMin) p.z = NORTH_DOCK.zMin;
    }
    if (plazaGroundY(p.x, p.z) - gy0 > 0.38) { p.x = px; p.z = pz; }
    expect(Math.abs(plazaGroundY(p.x, p.z) - gy0)).toBeLessThanOrEqual(PROM_STEP_MAX + 1e-6);
  }
  return p;
}

function expectWalkToPlatform(fromZ: number, dir: number) {
  const p = { x: -22.8, z: fromZ };
  walk(p, 0, dir, 80);
  expect(onPromenade(p.x, p.z)).toBe(true);
  expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PROM.pathY);
  walk(p, 0, dir, 200);
  // 步道遠端：被上層白色結構擋在連接走道
  expect(p.z * dir).toBeLessThan(PLAT.upZ0);
  expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.lowY);
  walk(p, 1, 0, 60);
  expect(p.x).toBeCloseTo(PLAT.stairX1 - 0.25);
  walk(p, 0, dir, 120);
  expect(p.z).toBeCloseTo(dir * (dir > 0 ? PROM_MAX_Z : -PROM_MIN_Z));
  expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.topY);
  walk(p, -1, 0, 120);
  expect(p.x).toBeCloseTo(PLAT.upX0 + 0.25);
  expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.topY);
  walk(p, 0, -dir, 120);
  expect(p.z).toBeCloseTo(dir * (PLAT.upZ0 + 0.25));
  expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.topY);
  walk(p, 0, dir, 80); walk(p, 1, 0, 80); walk(p, 0, -dir, 60);
  expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.lowY);
}

describe('CR-38 海堤步道＋觀景台：位置', () => {
  it('數字跟伺服器 PlazaWorld.Promenade.cs 一致', () => {
    expect(PROM).toMatchObject({ seaX: -24, landX: -20.2, z0: 11.5, z1: 24, tetraX: -25.6 });
    expect(PLAT).toMatchObject({ x0: -27.6, z0: 24, z1: 30, upX0: -25.2, upX1: -21.4, upZ0: 25.4, stairX1: -20.2, stairZ1: 29 });
    expect(PROM_MIN_Z).toBe(-PROM_MAX_Z);
    expect(PROM_WALK_N).toHaveLength(PROM_WALK_S.length);
  });
  it('貼著西岸護岸、在廣場南／北緣外，不擋碼頭、船位、工寮、北側漁船、廣場東西', () => {
    expect(PROM.seaX).toBe(PB.shoreX);
    expect(PROM.z0).toBe(WALK_BOUND);
    for (const r of PROM_WALK_S) { expect(r.z0).toBeGreaterThanOrEqual(WALK_BOUND); expect(r.x1).toBeLessThan(-11); }
    for (const r of PROM_WALK_N) { expect(r.z1).toBeLessThanOrEqual(-WALK_BOUND); expect(r.x1).toBeLessThan(-11); }
    expect(PLAT.x0).toBeLessThan(PB.shoreX);
    expect(PLAT.x0).toBeGreaterThan(-28);
    // 碼頭、10 艘船的停靠位都離很遠
    for (const r of PROM_WALK.concat(PROM_SOLID)) {
      expect(Math.min(Math.abs(r.z0), Math.abs(r.z1))).toBeGreaterThan(PB.pierHalfW + 10);
      for (let i = 0; i < PB.count; i++) { const d = dockSlot(i); expect(rectHitsCircle(r, d.x, d.z, PB.hullHalf + PB.hullR + 3)).toBe(false); }
      expect(distToPier((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2)).toBeGreaterThan(10);
    }
    // 蚵堆、高台、咖啡店、吸菸區、工寮門口擺設都不在步道上
    for (const [x, z, rad] of [...pileObstacles(), ...plazaCafeObstacles(), ...plazaShedObstacles(), [SMOKE_CENTER.x, SMOKE_CENTER.z, 2] as [number, number, number]])
      for (const r of PROM_WALK) expect(rectHitsCircle(r, x, z, rad)).toBe(false);
    expect(MG_PLATFORM.cx - MG_PLATFORM.w / 2).toBeGreaterThan(PROM.landX + 5);
    expect(TIDAL_FLAT.zMax).toBeLessThan(PROM.z0);
    expect(TIDAL_FLAT.zMin).toBeGreaterThan(-PROM.z0);
    // 北側工寮街、工寮本體、北側漁船（ambiance makePlazaHarbor）都在步道東側約 9 m 外
    expect(PROM.landX + 1).toBeLessThan(-NORTH_DOCK.xMax);
    for (const r of PROM_WALK.concat(PROM_SOLID)) {
      expect(rectHitsCircle(r, 0, (NORTH_DOCK.z0 + NORTH_DOCK.z1) / 2, 11.2)).toBe(false);
      for (const d of SHED_DOORS) expect(rectHitsCircle(r, d.x, SHED_FRONT_Z - SHED_D / 2, Math.max(SHED_W, SHED_D) / 2 + 0.4)).toBe(false);
      for (let i = 0; i < 5; i++) {
        const x = -9 + i * 4.5, z = NORTH_DOCK.z1 - 2.0 - (i % 2) * 2.2;
        expect(rectHitsCircle(r, x, z, 2.2)).toBe(false);
      }
    }
  });
  it('外觀合進碼頭 mesh：格式一致、三角形數量有上限（南北兩側仍是同一個 mesh）', () => {
    const parts = promenadeParts();
    let tris = 0;
    for (const g of parts) {
      expect(g.index).toBeNull();
      expect(Object.keys(g.attributes).sort()).toEqual(['color', 'normal', 'position']);
      tris += g.attributes.position.count / 3;
    }
    expect(tris).toBeLessThan(8000);
    expect(tris).toBeGreaterThan(2000);
  });
});

describe('CR-38 走動：高度與欄杆', () => {
  it('地面高度：碎石步道比人行道高、觀景台下層／樓梯／上層（南北對稱）', () => {
    for (const s of [1, -1] as const) {
      expect(plazaGroundY(-23, 18 * s)).toBeCloseTo(PROM.pathY);
      expect(plazaGroundY(-21, 18 * s)).toBe(0);
      expect(plazaGroundY(-26, 27 * s)).toBeCloseTo(PLAT.lowY);
      expect(plazaGroundY(-23, 24.8 * s)).toBeCloseTo(PLAT.lowY);
      expect(plazaGroundY(-23, 27 * s)).toBeCloseTo(PLAT.topY);
      expect(plazaGroundY(-20.8, PLAT.upZ0 * s)).toBeCloseTo(PLAT.lowY);
      expect(plazaGroundY(-20.8, ((PLAT.upZ0 + PLAT.stairZ1) / 2) * s)).toBeCloseTo((PLAT.lowY + PLAT.topY) / 2);
      expect(plazaGroundY(-20.8, 29.5 * s)).toBeCloseTo(PLAT.topY);
    }
    expect(plazaGroundY(-15, 5)).toBe(0);
    expect(plazaGroundY(MG_PLATFORM.cx, MG_PLATFORM.cz)).toBe(MG_PLATFORM.y);
    expect(promGroundY(0, 0)).toBe(0);
  });
  it('從廣場走上南側步道、走到觀景台、爬樓梯上到上層', () => {
    expectWalkToPlatform(8, 1);
  });
  it('從廣場走上北側步道、走到觀景台、爬樓梯上到上層', () => {
    expectWalkToPlatform(-8, -1);
  });
  it('欄杆擋住：步道不會走進海裡、下層甲板走不出去、從下層鑽不進上層底下（南北兩側）', () => {
    for (const s of [1, -1] as const) {
      const a = walk({ x: -22.5, z: 18 * s }, -1, 0, 60);
      expect(a.x).toBeCloseTo(PROM.seaX + 0.25);
      const b = walk({ x: -26, z: 27 * s }, -1, 0, 60);
      expect(b.x).toBeCloseTo(PLAT.x0 + 0.25);
      walk(b, 0, s, 60); expect(b.z).toBeCloseTo((PLAT.z1 - 0.25) * s);
      walk(b, 1, 0, 60); expect(b.x).toBeCloseTo(PLAT.upX0 - 0.25);
      expect(plazaGroundY(b.x, b.z)).toBeCloseTo(PLAT.lowY);
      const c = walk({ x: -20.8, z: 27 * s }, -1, 0, 40);
      expect(c.x).toBeCloseTo(PLAT.upX1 + 0.25);
      const d = walk({ x: -21, z: 18 * s }, 1, 0, 40);
      expect(d.x).toBeCloseTo(PROM.landX - 0.25);
    }
    const e = walk({ x: -10, z: 10 }, 0, 1, 60);
    expect(e.z).toBeCloseTo(WALK_BOUND);
    const f = walk({ x: -10, z: -10 }, 0, -1, 60);
    // 北側工寮街還是只能走到 zMin，不會走到步道
    expect(f.z).toBeGreaterThanOrEqual(NORTH_DOCK.zMin - 1e-6);
    expect(f.x).toBeCloseTo(-10);
    expect(onPromenade(f.x, f.z)).toBe(false);
  });
});

describe('CR-38 釣魚', () => {
  it('步道欄杆邊、觀景台上下層靠海側可以釣；人行道、樓梯、上層東側、步道外不行（南北兩側）', () => {
    for (const [x, z] of SYNC_FISH_OK) { expect(promFishable(x, z)).toBe(true); expect(canFishAt('walk', { x, z })).toBe(true); }
    for (const [x, z] of SYNC_FISH_NO) expect(canFishAt('walk', { x, z })).toBe(false);
    for (const [x, z] of SYNC_FISH_OK) expect(onPromenade(x, z)).toBe(true);
  });
  it('往海拋落在海面；往陸地拋、拋到觀景台或消波塊算岸上（南北兩側）', () => {
    for (const [x, z] of SYNC_FISH_OK) {
      const ok = [Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4].some(h => [0, 0.5, 1].every(pw => { const p = castPoint(x, z, h, pw); return !castHitsLand(p.x, p.z); }));
      expect(ok).toBe(true);
    }
    for (const [x, z] of [[-24.8, 27], [-27.2, 29.6], [-24.8, -27], [-27.2, -29.6]] as const) {
      const p = castPoint(x, z, Math.PI / 2, 0); expect(castHitsLand(p.x, p.z)).toBe(false);
    }
    const e = castPoint(-23.6, 18, -Math.PI / 2, 0.3);
    expect(castHitsLand(e.x, e.z)).toBe(true);
    expect(castHitsLand(castPoint(-23.6, -18, -Math.PI / 2, 0.3).x, castPoint(-23.6, -18, -Math.PI / 2, 0.3).z)).toBe(true);
    expect(castHitsLand(-26, 27)).toBe(true);
    expect(castHitsLand(-26, -27)).toBe(true);
    expect(castHitsLand(-24.8, 18)).toBe(true);
    expect(castHitsLand(-24.8, -18)).toBe(true);
    expect(promSolidAt(-25, 15)).toBe(true);
    expect(promSolidAt(-25, -15)).toBe(true);
    expect(castHitsLand(-30, 27)).toBe(false);
    expect(castHitsLand(-30, -27)).toBe(false);
    expect(FISH.castMin).toBeGreaterThan(PLAT.upX0 - PLAT.x0 + 0.5);
  });
});

describe('CR-38 船、游泳撞觀景台／消波塊', () => {
  it('船開進觀景台會被推出去並減速（南北兩側）', () => {
    for (const z of [27, -27]) {
      const b = { x: -26, z, h: Math.PI / 2, v: 3 };
      expect(pushStatic(b)).toBe(true);
      expect(b.v).toBeLessThan(3);
      for (const r of PROM_SOLID) expect(rectHitsCircle(r, b.x, b.z, 0.01)).toBe(false);
    }
  });
  it('游泳游不進消波塊帶；遠處沒影響（南北兩側）', () => {
    for (const z of [18, -18]) {
      const s = { x: -25.0, z, h: 0 };
      stepSwim(s, 0, 0, 0.016);
      expect(s.x).toBeLessThanOrEqual(PROM.tetraX - 0.44);
      const o = { x: -60, z };
      expect(promPushOut(o, 1)).toBe(false);
      expect(o.x).toBe(-60);
    }
  });
});
