import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { driftCrateGeo } from './boatScene';

describe('漂流箱模型', () => {
  it('是木條拼的箱子：方正、約 1 m、浮在水線（約 1/4 泡水），三角形不多', () => {
    const g = driftCrateGeo(); g.computeBoundingBox();
    const b = g.boundingBox!, s = new THREE.Vector3(); b.getSize(s);
    expect(s.x).toBeGreaterThan(0.9); expect(s.x).toBeLessThan(1.1);
    expect(Math.abs(s.x - s.z)).toBeLessThan(0.02);
    expect(s.y).toBeGreaterThan(0.8); expect(s.y).toBeLessThan(0.95);
    expect(b.min.y).toBeLessThan(-0.15); expect(b.max.y).toBeGreaterThan(0.55);
    const tris = g.attributes.position.count / 3;
    expect(tris).toBeGreaterThan(300); expect(tris).toBeLessThan(800);
    // 每個頂點都有自己的顏色（不會吃到別塊的色、也不會是 0 黑）
    expect(g.attributes.color.count).toBe(g.attributes.position.count);
    const c = g.attributes.color.array as Float32Array;
    for (let i = 0; i < c.length; i += 3) expect(c[i] + c[i + 1] + c[i + 2]).toBeGreaterThan(0.05);
  });
  it('旗子是選配', () => {
    const a = driftCrateGeo(false), b = driftCrateGeo(true);
    expect(b.attributes.position.count).toBeGreaterThan(a.attributes.position.count);
  });
});
