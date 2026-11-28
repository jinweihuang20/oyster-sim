import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeCharcoalFire, makeCigSmoke } from './fireFx';

function countMeshes(root: THREE.Object3D) {
  let instanced = 0, plain = 0;
  root.traverse(o => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) instanced++;
    else if ((o as THREE.Mesh).isMesh) plain++;
  });
  return { instanced, plain };
}

describe('charcoal / cig InstancedMesh', () => {
  it('烤台炭塊／火舌／火星／煙：重複零件合併成少數 InstancedMesh', () => {
    const fx = makeCharcoalFire({
      chunks: 42, hotRatio: 0.7, flames: true, sparks: true, smoke: 1.0, lowDetail: false, withLight: false, seed: 7,
    });
    const c = countMeshes(fx.group);
    // 底炭床 1 個普通 mesh；其餘冷／熱炭、光暈、火舌、火星、煙都應是 Instanced
    expect(c.plain).toBeLessThanOrEqual(2);
    expect(c.instanced).toBeGreaterThanOrEqual(4);
    // 若仍用個別 Mesh 畫 42 炭＋火＋煙，plain 會破 50
    expect(c.plain + c.instanced).toBeLessThan(12);
    fx.dispose();
  });

  it('菸煙：一個 InstancedMesh', () => {
    const fx = makeCigSmoke({ count: 8, seed: 3 });
    const c = countMeshes(fx.group);
    expect(c.instanced).toBe(1);
    expect(c.plain).toBe(0);
    fx.dispose();
  });
});
