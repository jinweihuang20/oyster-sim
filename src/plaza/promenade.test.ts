import { describe, it, expect } from 'vitest';
import { PROM, PLAT, PROM_WALK, PROM_SOLID, PROM_MAX_Z, PROM_STEP_MAX, promGroundY, promWalkClamp, onPromenade, promFishable, promPushOut, promSolidAt } from './promenade';
import { plazaGroundY, pileObstacles, plazaCafeObstacles, WALK_BOUND, WALK_BOUND_WEST, MG_PLATFORM, TIDAL_FLAT } from './layout';
import { PB, dockSlot, pushStatic, stepSwim, distToPier } from './boats/boatLogic';
import { canFishAt, castPoint, castHitsLand, FISH } from './boats/fishLogic';
import { promenadeParts } from './boats/promenadeGeo';

/** 伺服器 PlazaPromenadeTests 用同一批點（兩邊一起改） */
const SYNC_FISH_OK: readonly [number, number][] = [[-23.6, 13], [-23.6, 23.9], [-27.2, 24.4], [-27.2, 29.6], [-25.6, 27], [-24.8, 27], [-24.8, 29.6], [-23.2, 24.6]];
const SYNC_FISH_NO: readonly [number, number][] = [[-21, 18], [-20.6, 27], [-22, 27], [-21.5, 24.6], [-23.6, 31], [-15, 18], [-28.5, 27]];

const rectHitsCircle = (r: { x0: number; x1: number; z0: number; z1: number }, cx: number, cz: number, rad: number) => {
  const qx = Math.max(r.x0, Math.min(r.x1, cx)), qz = Math.max(r.z0, Math.min(r.z1, cz));
  return Math.hypot(cx - qx, cz - qz) < rad;
};

/** 模擬 walkSeat.walkStep 的夾限順序（矩形 → 步道 → 爬升檢查） */
function walk(p: { x: number; z: number }, dx: number, dz: number, steps = 200, sp = 0.08) {
  const L = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < steps; i++) {
    const px = p.x, pz = p.z, gy0 = plazaGroundY(px, pz);
    p.x += dx / L * sp; p.z += dz / L * sp;
    p.x = Math.max(PB.pierX1 + 0.35, Math.min(WALK_BOUND + 8, p.x));
    p.z = Math.max(-14, Math.min(PROM_MAX_Z, p.z));
    if (!promWalkClamp(p, px, pz)) { if (p.x < -WALK_BOUND_WEST && Math.abs(p.z) > PB.pierHalfW - 0.3) p.x = -WALK_BOUND_WEST; }
    if (plazaGroundY(p.x, p.z) - gy0 > 0.38) { p.x = px; p.z = pz; }
    expect(Math.abs(plazaGroundY(p.x, p.z) - gy0)).toBeLessThanOrEqual(PROM_STEP_MAX + 1e-6);
  }
  return p;
}

describe('CR-38 海堤步道＋觀景台：位置', () => {
  it('數字跟伺服器 PlazaWorld.Promenade.cs 一致', () => {
    expect(PROM).toMatchObject({ seaX: -24, landX: -20.2, z0: 11.5, z1: 24, tetraX: -25.6 });
    expect(PLAT).toMatchObject({ x0: -27.6, z0: 24, z1: 30, upX0: -25.2, upX1: -21.4, upZ0: 25.4, stairX1: -20.2, stairZ1: 29 });
  });
  it('貼著西岸護岸、在廣場南緣外，不擋碼頭、船位、廣場東西', () => {
    expect(PROM.seaX).toBe(PB.shoreX);
    expect(PROM.z0).toBe(WALK_BOUND);
    // 在廣場南邊的沙地（潮間帶以南）、岸線以東只有觀景台下層凸出海面
    for (const r of PROM_WALK) { expect(r.z0).toBeGreaterThanOrEqual(WALK_BOUND); expect(r.x1).toBeLessThan(-11); }
    expect(PLAT.x0).toBeLessThan(PB.shoreX);
    expect(PLAT.x0).toBeGreaterThan(-28);
    // 碼頭、10 艘船的停靠位都離很遠
    for (const r of [...PROM_WALK, ...PROM_SOLID]) {
      expect(r.z0).toBeGreaterThan(PB.pierHalfW + 10);
      for (let i = 0; i < PB.count; i++) { const d = dockSlot(i); expect(rectHitsCircle(r, d.x, d.z, PB.hullHalf + PB.hullR + 3)).toBe(false); }
      expect(distToPier((r.x0 + r.x1) / 2, r.z0)).toBeGreaterThan(10);
    }
    // 蚵堆、高台、咖啡店障礙都不在步道上
    for (const [x, z, rad] of [...pileObstacles(), ...plazaCafeObstacles()]) for (const r of PROM_WALK) expect(rectHitsCircle(r, x, z, rad)).toBe(false);
    expect(MG_PLATFORM.cx - MG_PLATFORM.w / 2).toBeGreaterThan(PROM.landX + 5);
    expect(TIDAL_FLAT.zMax).toBeLessThan(PROM.z0);
  });
  it('外觀合進碼頭 mesh：格式一致、三角形數量有上限', () => {
    const parts = promenadeParts();
    let tris = 0;
    for (const g of parts) {
      expect(g.index).toBeNull();
      expect(Object.keys(g.attributes).sort()).toEqual(['color', 'normal', 'position']);
      tris += g.attributes.position.count / 3;
    }
    expect(tris).toBeLessThan(6000);
    expect(tris).toBeGreaterThan(1000);
  });
});

describe('CR-38 走動：高度與欄杆', () => {
  it('地面高度：碎石步道比人行道高、觀景台下層／樓梯／上層', () => {
    expect(plazaGroundY(-23, 18)).toBeCloseTo(PROM.pathY);
    expect(plazaGroundY(-21, 18)).toBe(0);
    expect(plazaGroundY(-26, 27)).toBeCloseTo(PLAT.lowY);
    expect(plazaGroundY(-23, 24.8)).toBeCloseTo(PLAT.lowY);
    expect(plazaGroundY(-23, 27)).toBeCloseTo(PLAT.topY);
    expect(plazaGroundY(-20.8, PLAT.upZ0)).toBeCloseTo(PLAT.lowY);
    expect(plazaGroundY(-20.8, (PLAT.upZ0 + PLAT.stairZ1) / 2)).toBeCloseTo((PLAT.lowY + PLAT.topY) / 2);
    expect(plazaGroundY(-20.8, 29.5)).toBeCloseTo(PLAT.topY);
    // 廣場其他地方、機關槍高台不受影響
    expect(plazaGroundY(-15, 5)).toBe(0);
    expect(plazaGroundY(MG_PLATFORM.cx, MG_PLATFORM.cz)).toBe(MG_PLATFORM.y);
    expect(promGroundY(0, 0)).toBe(0);
  });
  it('從廣場走上步道、走到觀景台、爬樓梯上到上層', () => {
    const p = { x: -22.8, z: 8 };
    walk(p, 0, 1, 80);
    expect(onPromenade(p.x, p.z)).toBe(true);
    expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PROM.pathY);
    walk(p, 0, 1, 200);
    // 步道南端：被上層白色結構擋在連接走道
    expect(p.z).toBeLessThan(PLAT.upZ0);
    expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.lowY);
    // 往東到樓梯口、往南爬上去
    walk(p, 1, 0, 60);
    expect(p.x).toBeCloseTo(PLAT.stairX1 - 0.25);
    walk(p, 0, 1, 120);
    expect(p.z).toBeCloseTo(PROM_MAX_Z);
    expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.topY);
    // 往西走上上層，一路到西側欄杆，不會掉到下層甲板
    walk(p, -1, 0, 120);
    expect(p.x).toBeCloseTo(PLAT.upX0 + 0.25);
    expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.topY);
    walk(p, 0, -1, 120);
    expect(p.z).toBeCloseTo(PLAT.upZ0 + 0.25);
    expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.topY);
    // 往東走回樓梯頂、下樓梯
    walk(p, 0, 1, 80); walk(p, 1, 0, 80); walk(p, 0, -1, 60);
    expect(plazaGroundY(p.x, p.z)).toBeCloseTo(PLAT.lowY);
  });
  it('欄杆擋住：步道不會走進海裡、下層甲板走不出去、從下層鑽不進上層底下、樓梯中段不能翻欄杆', () => {
    const a = walk({ x: -22.5, z: 18 }, -1, 0, 60);
    expect(a.x).toBeCloseTo(PROM.seaX + 0.25);
    const b = walk({ x: -26, z: 27 }, -1, 0, 60);
    expect(b.x).toBeCloseTo(PLAT.x0 + 0.25);
    walk(b, 0, 1, 60); expect(b.z).toBeCloseTo(PLAT.z1 - 0.25);
    walk(b, 1, 0, 60); expect(b.x).toBeCloseTo(PLAT.upX0 - 0.25);
    expect(plazaGroundY(b.x, b.z)).toBeCloseTo(PLAT.lowY);
    const c = walk({ x: -20.8, z: 27 }, -1, 0, 40);
    expect(c.x).toBeCloseTo(PLAT.upX1 + 0.25);
    // 陸側石墩外不能走
    const d = walk({ x: -21, z: 18 }, 1, 0, 40);
    expect(d.x).toBeCloseTo(PROM.landX - 0.25);
    // 廣場南緣其他地方還是走不出去
    const e = walk({ x: -10, z: 10 }, 0, 1, 60);
    expect(e.z).toBeCloseTo(WALK_BOUND);
  });
});

describe('CR-38 釣魚', () => {
  it('步道欄杆邊、觀景台上下層靠海側可以釣；人行道、樓梯、上層東側、步道外不行', () => {
    for (const [x, z] of SYNC_FISH_OK) { expect(promFishable(x, z)).toBe(true); expect(canFishAt('walk', { x, z })).toBe(true); }
    for (const [x, z] of SYNC_FISH_NO) expect(canFishAt('walk', { x, z })).toBe(false);
    // 可以釣的點都是走得到的
    for (const [x, z] of SYNC_FISH_OK) expect(onPromenade(x, z)).toBe(true);
  });
  it('往海拋落在海面；往陸地拋、拋到觀景台或消波塊算岸上', () => {
    // 每個可以釣的點：往西或往西北（面海）拋，最近最遠都落在海面
    for (const [x, z] of SYNC_FISH_OK) {
      const ok = [Math.PI / 2, Math.PI / 4].some(h => [0, 0.5, 1].every(pw => { const p = castPoint(x, z, h, pw); return !castHitsLand(p.x, p.z); }));
      expect(ok).toBe(true);
    }
    // 上層、下層甲板往正西拋會越過下層甲板落進海裡
    for (const [x, z] of [[-24.8, 27], [-27.2, 29.6]] as const) { const p = castPoint(x, z, Math.PI / 2, 0); expect(castHitsLand(p.x, p.z)).toBe(false); }
    // 往東（陸地）
    const e = castPoint(-23.6, 18, -Math.PI / 2, 0.3);
    expect(castHitsLand(e.x, e.z)).toBe(true);
    // 從步道往南斜拋到觀景台下層
    expect(castHitsLand(-26, 27)).toBe(true);
    expect(castHitsLand(-24.8, 18)).toBe(true);
    expect(promSolidAt(-25, 15)).toBe(true);
    expect(castHitsLand(-30, 27)).toBe(false);
    expect(FISH.castMin).toBeGreaterThan(PLAT.upX0 - PLAT.x0 + 0.5);
  });
});

describe('CR-38 船、游泳撞觀景台／消波塊', () => {
  it('船開進觀景台會被推出去並減速', () => {
    const b = { x: -26, z: 27, h: Math.PI / 2, v: 3 };
    expect(pushStatic(b)).toBe(true);
    expect(b.v).toBeLessThan(3);
    for (const r of PROM_SOLID) expect(rectHitsCircle(r, b.x, b.z, 0.01)).toBe(false);
  });
  it('游泳游不進消波塊帶；遠處沒影響', () => {
    const s = { x: -25.0, z: 18, h: 0 };
    stepSwim(s, 0, 0, 0.016);
    expect(s.x).toBeLessThanOrEqual(PROM.tetraX - 0.44);
    const o = { x: -60, z: 18 };
    expect(promPushOut(o, 1)).toBe(false);
    expect(o.x).toBe(-60);
  });
});
