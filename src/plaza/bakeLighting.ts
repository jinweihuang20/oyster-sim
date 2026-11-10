import * as THREE from 'three';

export type BakeLightingOpts = {
  /** 陽光方向（從天空指向地面的反向：位置向量） */
  sunDir?: THREE.Vector3;
  /** 是否把直射陰影也烤進去（手機／省電建議開；桌機即時陰影請關以免雙重） */
  includeDirect?: boolean;
  skip?: (o: THREE.Object3D) => boolean;
};

const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const SKIP_NAMES = new Set(['seatPadsIM', 'charcoalFire', 'plazaCeilingFan', 'cigSmoke', 'seatCushion']);

function isUnlitMat(mat: THREE.Material | THREE.Material[]) {
  const mats = Array.isArray(mat) ? mat : [mat];
  return mats.every(m => !m || (m as THREE.MeshBasicMaterial).isMeshBasicMaterial);
}

function skipDefault(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  if (m.isMesh && m.material && isUnlitMat(m.material)) return true;
  let p: THREE.Object3D | null = o;
  while (p) {
    if (SKIP_NAMES.has(p.name || '')) return true;
    p = p.parent;
  }
  return false;
}

/** 以粗網格紀錄靜態物高度，用來估計遮蔽與接觸暗角 */
function buildHeightGrid(root: THREE.Object3D, skip: (o: THREE.Object3D) => boolean) {
  const box = new THREE.Box3().setFromObject(root);
  const pad = 1;
  const minX = box.min.x - pad, maxX = box.max.x + pad;
  const minZ = box.min.z - pad, maxZ = box.max.z + pad;
  const cell = 0.35;
  const w = Math.max(8, Math.ceil((maxX - minX) / cell));
  const h = Math.max(8, Math.ceil((maxZ - minZ) / cell));
  const grid = new Float32Array(w * h);
  grid.fill(-20);
  const put = (x: number, z: number, y: number) => {
    const ix = Math.floor((x - minX) / cell);
    const iz = Math.floor((z - minZ) / cell);
    if (ix < 0 || iz < 0 || ix >= w || iz >= h) return;
    const i = iz * w + ix;
    if (y > grid[i]) grid[i] = y;
  };
  const v = new THREE.Vector3();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || skip(m)) return;
    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      const im = m as THREE.InstancedMesh;
      const mx = new THREE.Matrix4();
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, mx);
        v.setFromMatrixPosition(mx);
        m.parent?.localToWorld(v);
        put(v.x, v.z, v.y + 0.4);
      }
      return;
    }
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    if (!b) return;
    m.updateWorldMatrix(true, false);
    const corners = [
      [b.min.x, b.min.y, b.min.z], [b.max.x, b.min.y, b.min.z],
      [b.min.x, b.min.y, b.max.z], [b.max.x, b.min.y, b.max.z],
      [b.min.x, b.max.y, b.min.z], [b.max.x, b.max.y, b.min.z],
      [b.min.x, b.max.y, b.max.z], [b.max.x, b.max.y, b.max.z],
    ];
    for (const c of corners) {
      v.set(c[0], c[1], c[2]).applyMatrix4(m.matrixWorld);
      put(v.x, v.z, v.y);
    }
  });
  return { grid, w, h, minX, minZ, cell, sample(x: number, z: number) {
    const ix = Math.floor((x - minX) / cell);
    const iz = Math.floor((z - minZ) / cell);
    if (ix < 0 || iz < 0 || ix >= w || iz >= h) return -20;
    return grid[iz * w + ix];
  } };
}

function shadowAt(x: number, y: number, z: number, sun: THREE.Vector3, grid: ReturnType<typeof buildHeightGrid>, steps = 18) {
  // sun 是光源方向（由上往下走的反向量：從點走向太陽）
  const sx = sun.x, sy = sun.y, sz = sun.z;
  const len = Math.hypot(sx, sy, sz) || 1;
  const dx = sx / len, dy = sy / len, dz = sz / len;
  const step = 0.45;
  let px = x + dx * 0.15, py = y + dy * 0.15, pz = z + dz * 0.15;
  for (let i = 0; i < steps; i++) {
    px += dx * step; py += dy * step; pz += dz * step;
    if (py > 14) return 1;
    const h = grid.sample(px, pz);
    if (h > py + 0.08) return 0;
  }
  return 1;
}

function aoAt(x: number, y: number, z: number, ny: number, grid: ReturnType<typeof buildHeightGrid>) {
  let blocked = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  for (const [dx, dz] of dirs) {
    const h = grid.sample(x + dx * 0.7, z + dz * 0.7);
    if (h > y + 0.12) blocked++;
  }
  const hemi = 0.62 + 0.38 * Math.max(0, ny);
  const occ = 1 - blocked * 0.045;
  const ground = y < 0.12 ? 0.88 + y * 0.8 : 1;
  return Math.max(0.5, hemi * occ * ground);
}

/**
 * 把靜態場景的環境光遮蔽（與可選的陽光陰影）烤進頂點色／instanceColor。
 * 當成乘法色：1＝全亮。不會改動態角色。
 */
export function bakeStaticLighting(root: THREE.Object3D, opts: BakeLightingOpts = {}) {
  const includeDirect = !!opts.includeDirect;
  const skip = (o: THREE.Object3D) => !!(opts.skip?.(o) || skipDefault(o) || o.userData.lightingBaked);
  const sun = (opts.sunDir ?? new THREE.Vector3(-3, 11, -5)).clone().normalize();
  root.updateMatrixWorld(true);
  const grid = buildHeightGrid(root, o => skipDefault(o) || !!opts.skip?.(o));

  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || skip(m)) return;

    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      const im = m as THREE.InstancedMesh;
      const mx = new THREE.Matrix4();
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, mx);
        _p.setFromMatrixPosition(mx);
        im.localToWorld(_p);
        const ao0 = aoAt(_p.x, _p.y, _p.z, 1, grid);
        const ao = includeDirect ? ao0 : 0.88 + 0.12 * ((ao0 - 0.5) / 0.5);
        const sh = includeDirect ? shadowAt(_p.x, _p.y + 0.3, _p.z, sun, grid) : 1;
        const lit = Math.max(includeDirect ? 0.42 : 0.86, ao * (includeDirect ? (0.55 + 0.45 * sh) : 1));
        _c.setRGB(lit, lit, lit);
        im.setColorAt(i, _c);
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.userData.lightingBaked = true;
      return;
    }

    let geo = m.geometry;
    if (m.userData.sharedGeo) {
      geo = geo.clone();
      m.geometry = geo;
      m.userData.sharedGeo = false;
    }
    const pos = geo.getAttribute('position');
    if (!pos) return;
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    const nrm = geo.getAttribute('normal');
    const col = new Float32Array(pos.count * 3);
    m.updateWorldMatrix(true, false);
    const normalMat = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      _n.fromBufferAttribute(nrm, i).applyMatrix3(normalMat).normalize();
      const ao0 = aoAt(_p.x, _p.y, _p.z, _n.y, grid);
      const ao = includeDirect ? ao0 : 0.88 + 0.12 * ((ao0 - 0.5) / 0.5);
      let sh = 1;
      if (includeDirect) {
        const ndl = Math.max(0, _n.dot(sun));
        sh = 0.4 + 0.6 * ndl * shadowAt(_p.x, _p.y, _p.z, sun, grid);
      }
      const lit = Math.max(includeDirect ? 0.38 : 0.86, ao * sh);
      col[i * 3] = lit;
      col[i * 3 + 1] = lit;
      col[i * 3 + 2] = lit;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      const std = mat as THREE.MeshStandardMaterial;
      if ('vertexColors' in std) {
        std.vertexColors = true;
        std.needsUpdate = true;
      }
    }
    m.userData.lightingBaked = true;
  });
}
