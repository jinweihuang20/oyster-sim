import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { TIDAL_FLAT } from './layout';

type MatFn = (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
type AddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  parent: THREE.Object3D,
  cast?: boolean,
) => THREE.Mesh;

/**
 * 廣場西側潮間帶：泥灘＋淺水＋養殖竹架示意（可走；互動之後再加）。
 * 座標：棚西外側往西到 WALK_BOUND_WEST。
 */
export function makePlazaTidalFlat(
  M: MatFn,
  add: AddFn,
  lowDetail = false,
): { group: THREE.Group } {
  const g = new THREE.Group();
  g.name = 'plazaTidalFlat';

  const { xInner, xOuter, zMin, zMax } = TIDAL_FLAT;
  const width = Math.abs(xInner - xOuter);
  const depth = zMax - zMin;
  const cx = (xInner + xOuter) * 0.5;
  const cz = (zMin + zMax) * 0.5;

  // 泥灘（貼棚外側大半）
  const mudW = width * 0.62;
  const mudX = xInner - mudW * 0.5;
  const mud = M(0x5a4a32, { roughness: 0.96, metalness: 0.02 });
  add(rboxEnv(mudW, 0.04, depth), mud, [mudX, -0.015, cz], g, false);
  // 濕泥斑紋
  const wet = M(0x4a3a28, { roughness: 0.92 });
  for (const [dx, dz, sx, sz] of [
    [-1.2, -3.5, 2.8, 2.2], [1.5, 2.0, 3.2, 1.8], [-0.5, 5.5, 2.4, 2.6], [2.0, -6.0, 2.6, 2.0],
  ] as const) {
    add(rboxEnv(sx, 0.02, sz), wet, [mudX + dx, -0.005, cz + dz], g, false);
  }

  // 淺水（更外側）
  const waterW = width - mudW + 0.4;
  const waterX = xOuter + waterW * 0.5;
  const water = M(0x3a6a78, {
    roughness: 0.35,
    metalness: 0.15,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  add(rboxEnv(waterW, 0.06, depth * 0.98), water, [waterX, -0.04, cz], g, false);
  // 水底泥
  add(rboxEnv(waterW * 0.98, 0.03, depth * 0.96), M(0x3a3020, { roughness: 1 }), [waterX, -0.08, cz], g, false);

  // 養殖竹架／插竿（幾排，之後可當掛點）
  const bamboo = M(0x8a6a38, { roughness: 0.88 });
  const rope = M(0xc8b070, { roughness: 0.8 });
  const segs = lowDetail ? 4 : 6;
  const rows = lowDetail ? 3 : 4;
  const polesPerRow = lowDetail ? 5 : 7;
  const rowX0 = xInner - 2.2;
  const rowGap = (mudW - 3.2) / Math.max(1, rows - 1);
  for (let r = 0; r < rows; r++) {
    const rx = rowX0 - r * rowGap;
    const z0 = zMin + 1.6;
    const z1 = zMax - 1.6;
    for (let i = 0; i < polesPerRow; i++) {
      const t = i / Math.max(1, polesPerRow - 1);
      const pz = z0 + (z1 - z0) * t;
      const h = 1.15 + (i % 3) * 0.08;
      add(rcyl(0.035, 0.04, h, segs), bamboo, [rx, h * 0.5, pz], g, true);
      add(rcyl(0.035, 0.04, h, segs), bamboo, [rx - 1.1, h * 0.5, pz], g, true);
      // 橫竿
      const beam = add(rcyl(0.028, 0.028, 1.15, 4), bamboo, [rx - 0.55, h * 0.78, pz], g, false);
      beam.rotation.z = Math.PI / 2;
      // 垂掛繩／蚵串示意
      if (!lowDetail || i % 2 === 0) {
        add(rcyl(0.012, 0.012, 0.35, 3), rope, [rx - 0.25, h * 0.55, pz], g, false);
        add(rcyl(0.012, 0.012, 0.35, 3), rope, [rx - 0.85, h * 0.55, pz], g, false);
        const shell = M(0xb8a888, { roughness: 0.75 });
        add(rboxEnv(0.08, 0.04, 0.06), shell, [rx - 0.25, h * 0.35, pz], g, false);
        add(rboxEnv(0.08, 0.04, 0.06), shell, [rx - 0.85, h * 0.35, pz], g, false);
      }
    }
  }

  // 零星浮標／石塊
  const buoy = M(0xd04040, { roughness: 0.55 });
  for (const [x, z] of [
    [xOuter + 1.8, -4.5], [xOuter + 2.4, 1.2], [xOuter + 1.5, 6.0], [xInner - 4.5, -8.0],
  ] as const) {
    add(rcyl(0.1, 0.12, 0.28, segs), buoy, [x, 0.08, z], g, false);
    add(rcyl(0.02, 0.02, 0.5, 3), M(0x333333), [x, -0.15, z], g, false);
  }
  const rock = M(0x6a6860, { roughness: 0.95 });
  for (const [x, z, s] of [
    [xInner - 1.5, -7.5, 0.35], [xInner - 3.0, 4.2, 0.28], [mudX - 1.0, 0.5, 0.4],
  ] as const) {
    add(rboxEnv(s * 1.4, s * 0.5, s), rock, [x, s * 0.15, z], g, false);
  }

  return { group: g };
}
