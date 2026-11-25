import { describe, it, expect } from 'vitest';
import { normDrift } from './boatNet';
import { nearestDrift, DRIFT } from './boatLogic';

describe('漂流箱', () => {
  it('伺服器 PascalCase／camelCase 都吃，壞資料丟掉', () => {
    const d = normDrift({ Boxes: [{ Key: 3, X: -80, Z: 12 }, { key: 0, x: 1, z: 1 }], NextShuffleAt: 99, MinPay: 5000, MaxPay: 20000 })!;
    expect(d.boxes).toEqual([{ key: 3, x: -80, z: 12 }]);
    expect(d.minPay).toBe(5000); expect(d.maxPay).toBe(20000);
    expect(normDrift(null)).toBeNull();
  });
  it('最近的箱子；客戶端撈的距離比伺服器嚴', () => {
    const n = nearestDrift(-60, 0, [{ x: -90, z: 0 }, { x: -62, z: 1 }])!;
    expect(n.box.x).toBe(-62); expect(n.dist).toBeCloseTo(Math.hypot(2, 1));
    expect(nearestDrift(0, 0, [])).toBeNull();
    expect(DRIFT.boatR).toBeLessThan(3.8); expect(DRIFT.swimR).toBeLessThan(2.2);
  });
});
