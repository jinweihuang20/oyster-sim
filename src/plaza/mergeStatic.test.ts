import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeStaticMeshes, countMeshes } from './mergeStatic';

describe('mergeStaticMeshes', () => {
  it('同材質靜態 mesh 合成較少繪製單位', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat);
      m.position.set(i * 0.3, 0, 0);
      root.add(m);
    }
    const before = countMeshes(root);
    const stats = mergeStaticMeshes(root, { name: 'testMerged' });
    expect(before).toBe(20);
    expect(stats.merged).toBe(20);
    expect(stats.created).toBe(1);
    expect(countMeshes(root)).toBe(1);
  });

  it('userData.noMerge 的動畫／可動件不併', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x445566 });
    for (let i = 0; i < 4; i++) root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    const moving = new THREE.Group();
    moving.userData.noMerge = true;
    for (let i = 0; i < 4; i++) moving.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat));
    root.add(moving);
    mergeStaticMeshes(root);
    expect(countMeshes(moving)).toBe(4);
    expect(countMeshes(root)).toBe(5); // 1 merged + 4 moving
  });
});
