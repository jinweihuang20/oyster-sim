import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlayerRig } from './character';

const MERGED = 'mergedLimb';
const SOURCE = 'mergeSource';
export const NO_MERGE = 'noMerge';

const sharedMats = new Map<string, THREE.MeshStandardMaterial>();

function sharedSolid(opts: { metal: number; rough: number; em: number; emi: number; ro: number }) {
  const key = `s:${opts.metal.toFixed(2)}:${opts.rough.toFixed(2)}:${opts.em}:${opts.emi.toFixed(2)}:r${opts.ro}`;
  let m = sharedMats.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: opts.rough,
    metalness: opts.metal,
    emissive: opts.em,
    emissiveIntensity: opts.emi,
    flatShading: false,
  });
  if (opts.ro) m.userData.forceRenderOrder = opts.ro;
  sharedMats.set(key, m);
  return m;
}

function stdOf(mat: THREE.Material): THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | null {
  if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return mat as THREE.MeshStandardMaterial;
  if ((mat as THREE.MeshLambertMaterial).isMeshLambertMaterial) return mat as THREE.MeshLambertMaterial;
  return null;
}

function bucketKey(mat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial, renderOrder: number) {
  const mapId = (mat as THREE.MeshStandardMaterial).map?.id ?? 0;
  const metal = (mat as THREE.MeshStandardMaterial).metalness ?? 0;
  const rough = (mat as THREE.MeshStandardMaterial).roughness ?? 0.78;
  const em = mat.emissive?.getHex?.() ?? 0;
  const emi = mat.emissiveIntensity ?? 0;
  if (mapId) return `t:${mapId}:${metal.toFixed(2)}:${rough.toFixed(2)}:${em}:${emi.toFixed(2)}:r${renderOrder >= 1 ? 1 : 0}`;
  return `c:${metal.toFixed(2)}:${rough.toFixed(2)}:${em}:${emi.toFixed(2)}:r${renderOrder >= 1 ? 1 : 0}`;
}

function materialForBucket(
  key: string,
  src: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial,
  renderOrder: number,
) {
  if (key.startsWith('t:')) {
    // 同一個貼圖／表面參數共用一份材質（服飾 canvas 本來就有快取）
    let m = sharedMats.get(key);
    if (m) return m;
    m = src.clone() as THREE.MeshStandardMaterial;
    if (src.map) m.map = src.map;
    sharedMats.set(key, m);
    return m;
  }
  const metal = (src as THREE.MeshStandardMaterial).metalness ?? 0;
  const rough = (src as THREE.MeshStandardMaterial).roughness ?? 0.78;
  return sharedSolid({
    metal, rough,
    em: src.emissive?.getHex?.() ?? 0,
    emi: src.emissiveIntensity ?? 0,
    ro: renderOrder >= 1 ? 1 : 0,
  });
}

function isMesh(o: THREE.Object3D): o is THREE.Mesh {
  return (o as THREE.Mesh).isMesh === true && !(o as THREE.InstancedMesh).isInstancedMesh;
}

function underExcluded(o: THREE.Object3D, group: THREE.Object3D, exclude: Set<THREE.Object3D>) {
  let p: THREE.Object3D | null = o;
  while (p && p !== group) {
    if (exclude.has(p)) return true;
    p = p.parent;
  }
  return p !== group;
}

function hasNoMerge(o: THREE.Object3D) {
  let p: THREE.Object3D | null = o;
  while (p) {
    if (p.userData[NO_MERGE]) return true;
    p = p.parent;
  }
  return false;
}

function collect(group: THREE.Object3D, exclude: Set<THREE.Object3D>) {
  const out: THREE.Mesh[] = [];
  group.traverse(o => {
    if (!isMesh(o) || !o.geometry) return;
    if (o.userData[MERGED] || hasNoMerge(o)) return;
    if (Array.isArray(o.material)) return;
    if (underExcluded(o, group, exclude)) return;
    out.push(o);
  });
  return out;
}

function withVertexColors(src: THREE.BufferGeometry, color: THREE.Color) {
  const g = src.index ? src.toNonIndexed() : src.clone();
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function disposeMergedIn(group: THREE.Object3D) {
  const gone: THREE.Mesh[] = [];
  group.traverse(o => {
    if (isMesh(o) && o.userData[MERGED]) gone.push(o);
  });
  for (const m of gone) {
    m.removeFromParent();
    m.geometry.dispose();
  }
}

function mergeGroup(group: THREE.Object3D, exclude: Set<THREE.Object3D>) {
  disposeMergedIn(group);
  const sources = collect(group, exclude);
  if (!sources.length) return;

  group.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();

  type Bucket = { key: string; mat: THREE.Material; geos: THREE.BufferGeometry[]; toDispose: THREE.BufferGeometry[]; ro: number; cast: boolean; recv: boolean };
  const buckets = new Map<string, Bucket>();

  for (const mesh of sources) {
    const srcMat = stdOf(mesh.material as THREE.Material);
    if (!srcMat || srcMat.visible === false) {
      mesh.visible = true;
      delete mesh.userData[SOURCE];
      continue;
    }
    const ro = mesh.renderOrder >= 1 ? 1 : 0;
    const key = bucketKey(srcMat, mesh.renderOrder);
    const mat = materialForBucket(key, srcMat, mesh.renderOrder);
    let b = buckets.get(key);
    if (!b) {
      b = { key, mat, geos: [], toDispose: [], ro, cast: false, recv: false };
      buckets.set(key, b);
    }
    b.cast = b.cast || mesh.castShadow;
    b.recv = b.recv || mesh.receiveShadow;
    if (mesh.renderOrder > b.ro) b.ro = mesh.renderOrder;

    const baked = key.startsWith('c:')
      ? withVertexColors(mesh.geometry, srcMat.color)
      : (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone());
    baked.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    b.geos.push(baked);
    b.toDispose.push(baked);

    mesh.userData[SOURCE] = true;
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }

  for (const b of buckets.values()) {
    if (!b.geos.length) continue;
    let combined: THREE.BufferGeometry | null = null;
    try {
      combined = b.geos.length === 1 ? b.geos[0].clone() : mergeGeometries(b.geos, false);
    } catch {
      combined = null;
    }
    b.toDispose.forEach(g => g.dispose());
    if (!combined) continue;
    const mesh = new THREE.Mesh(combined, b.mat);
    mesh.name = MERGED;
    mesh.userData[MERGED] = true;
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    mesh.renderOrder = b.ro;
    mesh.frustumCulled = true;
    group.add(mesh);
  }
}

/** 依四肢／頭／軀幹把靜態小塊合成較少的 mesh；動畫仍轉骨骼群組。換裝後請再呼叫。 */
export function rebuildAvatarMerged(rig: PlayerRig | null | undefined) {
  if (!rig?.outer) return;
  const exclude = new Set<THREE.Object3D>([
    rig.head, rig.hatG,
    rig.upperL, rig.lowerL, rig.upperR, rig.lowerR,
    rig.handL, rig.handR, rig.weaponMount,
    rig.shoulderL, rig.shoulderR,
    rig.legL, rig.legR, rig.shinL, rig.shinR,
  ].filter(Boolean));

  mergeGroup(rig.torso, exclude);
  mergeGroup(rig.head, new Set([rig.hatG].filter(Boolean)));
  mergeGroup(rig.hatG, new Set());
  for (const g of [rig.upperL, rig.lowerL, rig.upperR, rig.lowerR, rig.handL, rig.handR]) {
    if (g) mergeGroup(g, new Set());
  }
  for (const g of [rig.legL, rig.legR]) {
    if (!g) continue;
    const shins = new Set<THREE.Object3D>();
    if (g === rig.legL && rig.shinL) shins.add(rig.shinL);
    if (g === rig.legR && rig.shinR) shins.add(rig.shinR);
    mergeGroup(g, shins);
  }
  if (rig.shinL) mergeGroup(rig.shinL, new Set());
  if (rig.shinR) mergeGroup(rig.shinR, new Set());
}
