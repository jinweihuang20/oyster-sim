import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type MergeStats = { considered: number; merged: number; created: number };

export function countMeshes(root: THREE.Object3D): number {
  let n = 0;
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) n++; });
  return n;
}

function matKey(mat: THREE.Material): string | null {
  if ((mat as THREE.MeshBasicMaterial).visible === false) return null;
  if (mat instanceof THREE.MeshStandardMaterial) {
    return [
      'std', mat.color.getHex(), mat.roughness, mat.metalness,
      mat.transparent ? 1 : 0, mat.opacity, mat.side,
      mat.map?.id ?? 0, mat.emissive.getHex(), mat.emissiveIntensity,
      mat.flatShading ? 1 : 0,
    ].join(':');
  }
  if (mat instanceof THREE.MeshLambertMaterial) {
    return [
      'lam', mat.color.getHex(),
      mat.transparent ? 1 : 0, mat.opacity, mat.side,
      mat.map?.id ?? 0, mat.emissive.getHex(), mat.emissiveIntensity,
    ].join(':');
  }
  if (mat instanceof THREE.MeshBasicMaterial) {
    return [
      'bas', mat.color.getHex(),
      mat.transparent ? 1 : 0, mat.opacity, mat.side,
      mat.map?.id ?? 0, mat.blending, mat.depthWrite ? 1 : 0,
    ].join(':');
  }
  return null;
}

/** 把同一棵樹上、材質相同的靜態 mesh 合成較少的繪製單位（略過互動／動畫／貼圖 LOD） */
export function mergeStaticMeshes(
  root: THREE.Object3D,
  opts?: { skip?: (mesh: THREE.Mesh) => boolean; name?: string },
): MergeStats {
  root.updateMatrixWorld(true);
  const skip = opts?.skip;
  const collected: THREE.Mesh[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if ((m as THREE.InstancedMesh).isInstancedMesh) return;
    if (Array.isArray(m.material)) return;
    if (m.userData.sharedGeo || m.userData.noLod) return;
    const mat = m.material as THREE.Material;
    if (!mat || mat.visible === false) return;
    if (!matKey(mat)) return;
    if (skip?.(m)) return;
    collected.push(m);
  });

  type Bucket = { meshes: THREE.Mesh[]; mat: THREE.Material; cast: boolean; recv: boolean };
  const buckets = new Map<string, Bucket>();
  for (const m of collected) {
    const mat = m.material as THREE.Material;
    const key = `${matKey(mat)}|c${m.castShadow ? 1 : 0}|r${m.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) {
      b = { meshes: [], mat, cast: m.castShadow, recv: m.receiveShadow };
      buckets.set(key, b);
    }
    b.meshes.push(m);
  }

  const dest = new THREE.Group();
  dest.name = opts?.name ?? 'mergedStatic';
  dest.userData.mergedStatic = true;
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  let merged = 0;
  let created = 0;

  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue;
    const geos: THREE.BufferGeometry[] = [];
    for (const m of b.meshes) {
      const src = m.geometry;
      const g = src.index ? src.toNonIndexed() : src.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(invRoot, m.matrixWorld));
      geos.push(g);
    }
    let combined: THREE.BufferGeometry | null = null;
    try {
      combined = mergeGeometries(geos, false);
    } catch {
      combined = null;
    }
    geos.forEach(g => g.dispose());
    if (!combined) continue;
    const mesh = new THREE.Mesh(combined, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    mesh.name = 'merged';
    dest.add(mesh);
    created++;
    merged += b.meshes.length;
    for (const m of b.meshes) {
      const mat = m.material as THREE.Material;
      m.parent?.remove(m);
      if (!m.userData.sharedGeo) m.geometry.dispose();
      if (mat !== b.mat) mat.dispose();
    }
  }

  if (created) root.add(dest);
  return { considered: collected.length, merged, created };
}
