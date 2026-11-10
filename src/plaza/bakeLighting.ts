import * as THREE from 'three';

export type BakeLightingOpts = {
  /** 陽光方向（從天空指向地面的反向：位置向量） */
  sunDir?: THREE.Vector3;
  /** 是否把直射陰影也烤進去（手機／省電建議開；桌機即時陰影請關以免雙重） */
  includeDirect?: boolean;
  /** 吊燈水平位置；開啟 lampPool 時在燈下烤一圈暖光（手機省電關點光時仍看得到） */
  lampXZ?: readonly (readonly [number, number])[];
  lampY?: number;
  lampPool?: boolean;
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
      const dayArr = new Float32Array(im.count * 3);
      const nigArr = new Float32Array(im.count * 3);
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
  // 輕輕的環境遮蔽：棚底／背光面略暗，不要把整片廣場壓黑
  const hemi = 0.92 + 0.08 * Math.max(0, ny);
  const occ = 1 - blocked * 0.02;
  const ground = y < 0.12 ? 0.97 + y * 0.25 : 1;
  return Math.max(0.90, hemi * occ * ground);
}

/** 乘法亮度：1＝與烘焙前一樣亮。手機保留一點棚下層次，桌機幾乎只在暗角微暗。 */
function bakedLit(ao0: number, ndl: number, shRaw: number, includeDirect: boolean) {
  if (!includeDirect) {
    return Math.min(1, Math.max(0.94, 0.94 + 0.06 * ((ao0 - 0.5) / 0.5)));
  }
  const sh = 0.96 + 0.04 * (0.35 + 0.65 * Math.max(0, ndl)) * (0.5 + 0.5 * shRaw);
  // 略為抬高，讓整體亮度回到烘焙前，棚底仍略暗一點
  return Math.min(1, Math.max(0.90, ao0 * sh) * 1.05);
}

/** 吊燈下方／棚底的暖光權重 0–1。tight＝夜間較清楚的光池。 */
function lampWarm(x: number, y: number, z: number, ny: number, lamps: readonly (readonly [number, number])[], lampY: number, tight: boolean) {
  let w = 0;
  const rad = tight ? 4.0 : 4.8;
  for (const [lx, lz] of lamps) {
    const horiz = Math.hypot(x - lx, z - lz);
    if (ny >= -0.15 && y < 2.4) {
      const u = 1 - horiz / rad;
      if (u > 0) {
        const fall = tight ? (u * u * (3 - 2 * u)) ** 2 : u * u;
        const heightFade = y < 0.25 ? 1 : Math.max(0, 1 - y / 2.5);
        w = Math.max(w, fall * heightFade);
      }
    }
    if (ny < 0 && y > 3.4) {
      const t = 1 - Math.hypot(horiz, Math.max(0, lampY - y)) / (tight ? 2.2 : 2.4);
      if (t > 0) w = Math.max(w, tight ? t * t * t * 0.9 : t * t * 0.85);
    }
  }
  return w;
}

const DAY_GAIN: [number, number, number] = [0.42, 0.24, 0.06];
const NIGHT_GAIN_LO: [number, number, number] = [2.4, 1.3, 0.3];
const NIGHT_GAIN_HI: [number, number, number] = [1.05, 0.58, 0.14];

function applyWarm(lit: number, warm: number, fill: number, gain: [number, number, number], out: Float32Array | THREE.Color, i = 0) {
  const base = lit * fill;
  const r = base * (1 + warm * gain[0]);
  const g = base * (1 + warm * gain[1]);
  const b = base * (1 + warm * gain[2]);
  if (out instanceof THREE.Color) out.setRGB(r, g, b);
  else { out[i] = r; out[i + 1] = g; out[i + 2] = b; }
}

function lerpBakeColors(day: ArrayLike<number>, night: ArrayLike<number>, out: Float32Array, t: number) {
  const s = 1 - t;
  for (let i = 0; i < out.length; i++) out[i] = (day[i] as number) * s + (night[i] as number) * t;
}

/** 在白天／夜間兩套烘焙色之間插值（t=0 白天、t=1 夜晚） */
export function applyPlazaBakeBlend(root: THREE.Object3D, t: number) {
  const k = Math.max(0, Math.min(1, t));
  if (root.userData.bakeNightT === k) return;
  root.userData.bakeNightT = k;
  root.traverse(o => {
    const im = o as THREE.InstancedMesh;
    if (im.isInstancedMesh && im.instanceColor && im.userData.colorDay && im.userData.colorNight) {
      lerpBakeColors(im.userData.colorDay as Float32Array, im.userData.colorNight as Float32Array, im.instanceColor.array as Float32Array, k);
      im.instanceColor.needsUpdate = true;
      return;
    }
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const day = m.geometry.getAttribute('colorDay');
    const nig = m.geometry.getAttribute('colorNight');
    const col = m.geometry.getAttribute('color');
    if (!day || !nig || !col) return;
    lerpBakeColors(day.array, nig.array, col.array as Float32Array, k);
    col.needsUpdate = true;
  });
}

/**
 * 把靜態場景的環境光遮蔽（與可選的陽光陰影）烤進頂點色／instanceColor。
 * 當成乘法色：1＝全亮。同時寫入白天／夜間兩套頂點色，供 applyPlazaBakeBlend 切換。不會改動態角色。
 */
export function bakeStaticLighting(root: THREE.Object3D, opts: BakeLightingOpts = {}) {
  const includeDirect = !!opts.includeDirect;
  const lamps = opts.lampXZ ?? [];
  const lampY = opts.lampY ?? 4.1;
  const usePool = !!opts.lampPool && lamps.length > 0;
  const nightGain = includeDirect ? NIGHT_GAIN_LO : NIGHT_GAIN_HI;
  const nightFill = includeDirect ? 0.55 : 0.5;
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
      const dayArr = new Float32Array(im.count * 3);
      const nigArr = new Float32Array(im.count * 3);
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, mx);
        _p.setFromMatrixPosition(mx);
        im.localToWorld(_p);
        const ao0 = aoAt(_p.x, _p.y, _p.z, 1, grid);
        const shRaw = includeDirect ? shadowAt(_p.x, _p.y + 0.3, _p.z, sun, grid) : 1;
        const lit = bakedLit(ao0, 1, shRaw, includeDirect);
        const dayW = usePool ? lampWarm(_p.x, _p.y, _p.z, 1, lamps, lampY, false) : 0;
        const nigW = usePool ? lampWarm(_p.x, _p.y, _p.z, 1, lamps, lampY, true) : 0;
        applyWarm(lit, dayW, 1, DAY_GAIN, dayArr, i * 3);
        applyWarm(lit, nigW, nightFill, nightGain, nigArr, i * 3);
      }
      im.userData.colorDay = dayArr;
      im.userData.colorNight = nigArr;
      for (let i = 0; i < im.count; i++) {
        _c.setRGB(dayArr[i * 3], dayArr[i * 3 + 1], dayArr[i * 3 + 2]);
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
    const dayCol = new Float32Array(pos.count * 3);
    const nigCol = new Float32Array(pos.count * 3);
    m.updateWorldMatrix(true, false);
    const normalMat = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      _n.fromBufferAttribute(nrm, i).applyMatrix3(normalMat).normalize();
      const ao0 = aoAt(_p.x, _p.y, _p.z, _n.y, grid);
      const ndl = includeDirect ? _n.dot(sun) : 1;
      const shRaw = includeDirect ? shadowAt(_p.x, _p.y, _p.z, sun, grid) : 1;
      const lit = bakedLit(ao0, ndl, shRaw, includeDirect);
      const dayW = usePool ? lampWarm(_p.x, _p.y, _p.z, _n.y, lamps, lampY, false) : 0;
      const nigW = usePool ? lampWarm(_p.x, _p.y, _p.z, _n.y, lamps, lampY, true) : 0;
      applyWarm(lit, dayW, 1, DAY_GAIN, dayCol, i * 3);
      applyWarm(lit, nigW, nightFill, nightGain, nigCol, i * 3);
    }
    col.set(dayCol);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('colorDay', new THREE.BufferAttribute(dayCol, 3));
    geo.setAttribute('colorNight', new THREE.BufferAttribute(nigCol, 3));
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
