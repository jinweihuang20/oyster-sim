import { describe, it, expect } from 'vitest';
import { PB, dockSlot, stepPlazaBoat, pushStatic, pushFromBoat, isHardRam, stepSwim, freePassengerSeat, boatEmpty, distToLand, landSpot, onLand, knockSpot, nightK, hullPts } from './boatLogic';

describe('廣場膠筏', () => {
  it('20 艘排在碼頭兩側、不互相重疊、船尾靠碼頭', () => {
    const s = Array.from({ length: PB.count }, (_, i) => dockSlot(i));
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z)).toBeGreaterThan(2.4);
    for (const d of s) {
      expect(d.x).toBeLessThan(PB.pierX0); expect(d.x).toBeGreaterThan(PB.pierX1);
      const b = { ...d, v: 0 }; const before = { x: b.x, z: b.z };
      pushStatic(b); expect(Math.hypot(b.x - before.x, b.z - before.z)).toBeLessThan(0.01);
      // 船尾（+前進的反方向）朝碼頭
      const stern = d.z + Math.cos(d.h) * 2;
      expect(Math.abs(stern)).toBeLessThan(Math.abs(d.z));
    }
  });
  it('開船：油門加速到極速、放開慢慢停', () => {
    const b = { x: -60, z: 20, h: 0, v: 0 };
    for (let i = 0; i < 300; i++) stepPlazaBoat(b, 1, 0, 1 / 60);
    expect(b.v).toBeCloseTo(PB.maxSpd, 1);
    expect(b.z).toBeLessThan(20);
    const v = b.v; for (let i = 0; i < 120; i++) stepPlazaBoat(b, 0, 0, 1 / 60);
    expect(b.v).toBeLessThan(v * 0.7);
  });
  it('撞岸／撞碼頭會被推出去並減速', () => {
    const b = { x: -24.5, z: 20, h: 0, v: 5 };
    expect(pushStatic(b)).toBe(true);
    for (const [px] of hullPts(b)) expect(px).toBeLessThanOrEqual(PB.shoreX - PB.hullR + 1e-6);
    expect(b.v).toBeCloseTo(5 * PB.pierBump);
    const c = { x: -40, z: 0.5, h: Math.PI / 2, v: 3 };
    pushStatic(c);
    expect(Math.abs(c.z)).toBeGreaterThan(PB.pierHalfW);
  });
  it('兩艘相撞：只推開自己，回傳撞擊方向', () => {
    const me = { x: -60, z: 0, h: Math.PI / 2, v: 5 }, o = { x: -61, z: 0, h: Math.PI / 2 };
    const hit = pushFromBoat(me, o);
    expect(hit).not.toBeNull();
    expect(o.x).toBe(-61);
    expect(isHardRam(5)).toBe(true); expect(isHardRam(2)).toBe(false);
  });
  it('游泳慢、游不進碼頭也游不上岸', () => {
    const s = { x: -30, z: 8, h: 0 };
    for (let i = 0; i < 120; i++) stepSwim(s, 1, 0, 1 / 60);
    expect(8 - s.z).toBeCloseTo(PB.swimSpd * 2, 1);
    for (let i = 0; i < 600; i++) stepSwim(s, 1, 0, 1 / 60);
    expect(Math.abs(s.z)).toBeGreaterThan(PB.pierHalfW);
    const t = { x: -25, z: 8, h: -Math.PI / 2, v: 0 };
    for (let i = 0; i < 200; i++) stepSwim(t, 1, 0, 1 / 60);
    expect(t.x).toBeLessThan(PB.shoreX);
  });
  it('上岸點：碼頭或廣場西緣，太遠不行', () => {
    expect(onLand(-30, 0)).toBe(true); expect(onLand(-30, 3)).toBe(false); expect(onLand(-20, 30)).toBe(true);
    const p = landSpot(-40, 3.5)!; expect(p).not.toBeNull(); expect(onLand(p.x, p.z)).toBe(true);
    const q = landSpot(-26, 8)!; expect(q.x).toBeGreaterThan(PB.shoreX);
    expect(landSpot(-80, 30)).toBeNull();
    expect(distToLand(-30, 0)).toBe(0);
  });
  it('座位：駕駛＋最多 3 個乘客', () => {
    expect(freePassengerSeat(['a', '', '', ''])).toBe(1);
    expect(freePassengerSeat(['a', 'b', 'c', 'd'])).toBe(-1);
    expect(boatEmpty(['', '', '', ''])).toBe(true);
  });
  it('落水點在海面範圍內、左右錯開', () => {
    const a = knockSpot({ x: -60, z: 0 }, 1, 0, 0), b = knockSpot({ x: -60, z: 0 }, 1, 0, 1);
    expect(a.z).not.toBeCloseTo(b.z);
    const c = knockSpot({ x: PB.sea.x0, z: PB.sea.z1 }, -1, 0, 3);
    expect(c.x).toBeGreaterThanOrEqual(PB.sea.x0); expect(c.z).toBeLessThanOrEqual(PB.sea.z1);
  });
  it('夜晚程度', () => {
    expect(nightK(12)).toBe(0); expect(nightK(22)).toBe(1); expect(nightK(2)).toBe(1);
    expect(nightK(18.5)).toBeCloseTo(0.5); expect(nightK(5.75)).toBeCloseTo(0.5);
  });
});
