import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { makeCharcoalFire, type CharcoalFireFx } from './fireFx';
import { makePlazaTidalFlat } from './tidalFlat';

type MatFn = (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
type AddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  parent: THREE.Object3D,
  cast?: boolean,
) => THREE.Mesh;

export type PlazaStallKind =
  | 'bbq'      // 立式烤肉攤（高台）
  | 'bbqSit'   // 坐式烤肉區（矮桌／地爐）
  | 'drink'
  | 'snack'
  | 'fruit'
  | 'cart'
  | 'noodle'
  | 'seafood'
  | 'sweet';

/** 外圈攤位：面向廣場中心；避開蚵堆／棚柱（半徑約 10.6） */
export const PLAZA_STALL_SITES: readonly {
  id: string;
  x: number;
  z: number;
  kind: PlazaStallKind;
  radius: number;
}[] = [
  // 南：立式烤肉＋推車＋飲料（貼棚內緣，避開最南排蚵堆）
  { id: 'bbq', x: -1.4, z: 9.65, kind: 'bbq', radius: 1.25 },
  { id: 'cart', x: 2.6, z: 9.6, kind: 'cart', radius: 0.85 },
  { id: 'drink-s', x: 5.9, z: 9.5, kind: 'drink', radius: 1.0 },
  // 坐式烤肉區（西南角矮桌圍爐，非立式高台）
  { id: 'bbqSit', x: -7.4, z: 9.5, kind: 'bbqSit', radius: 1.45 },
  // 西邊改潮間帶／養殖預留，不再放攤
  // 東
  { id: 'snack', x: 9.7, z: -1.8, kind: 'snack', radius: 1.1 },
  { id: 'seafood', x: 9.65, z: 2.8, kind: 'seafood', radius: 1.15 },
  // 原位 (9.5,6.2) 讓給多那芝咖啡入口，移到東側偏北
  { id: 'fruit-e', x: 9.6, z: -5.6, kind: 'fruit', radius: 1.0 },
  // 北（碼頭在棚外；攤位仍在棚內走道）
  { id: 'fruit', x: -4.0, z: -9.6, kind: 'fruit', radius: 1.05 },
  { id: 'snack-n', x: 1.2, z: -9.65, kind: 'snack', radius: 1.05 },
  { id: 'cart-n', x: 5.5, z: -9.45, kind: 'cart', radius: 0.8 },
];

/** 走動／生成點用碰撞圓 */
export function plazaStallObstacles(): [number, number, number][] {
  return PLAZA_STALL_SITES.map(s => [s.x, s.z, s.radius]);
}

/**
 * 廣場氣氛：夜市攤＋立式／坐式烤肉＋北側碼頭漁船＋西側潮間帶。
 */
export function makePlazaAmbiance(
  M: MatFn,
  add: AddFn,
  lowDetail = false,
): {
  group: THREE.Group;
  lights: THREE.PointLight[];
  obstacles: [number, number, number][];
  tick: (tSec: number, dt: number) => void;
} {
  const root = new THREE.Group();
  root.name = 'plazaAmbiance';
  const lights: THREE.PointLight[] = [];
  const fires: CharcoalFireFx[] = [];
  const segs = lowDetail ? 5 : 8;

  for (const site of PLAZA_STALL_SITES) {
    const g = new THREE.Group();
    g.name = `stall-${site.id}`;
    g.position.set(site.x, 0, site.z);
    g.rotation.y = Math.atan2(site.x, site.z);
    root.add(g);
    switch (site.kind) {
      case 'bbq': buildBbqStand(g, M, add, segs, lowDetail, lights, fires); break;
      case 'bbqSit': buildBbqSit(g, M, add, segs, lowDetail, lights, fires); break;
      case 'drink': buildDrink(g, M, add, segs); break;
      case 'snack': buildSnack(g, M, add, segs, lowDetail); break;
      case 'fruit': buildFruit(g, M, add, segs); break;
      case 'cart': buildCart(g, M, add, segs); break;
      case 'noodle': buildNoodle(g, M, add, segs); break;
      case 'seafood': buildSeafood(g, M, add, segs); break;
      case 'sweet': buildSweet(g, M, add, segs); break;
    }
  }

  root.add(makePlazaHarbor(M, add, segs, lowDetail));
  root.add(makePlazaTidalFlat(M, add, lowDetail).group);

  return {
    group: root,
    lights,
    obstacles: plazaStallObstacles(),
    tick: (tSec, dt) => { for (const f of fires) f.tick(tSec, dt); },
  };
}

/** 北側棚外：碼頭＋漁船（工寮船會在入場時藏起，改用這組正確位置） */
function makePlazaHarbor(M: MatFn, add: AddFn, segs: number, lowDetail: boolean) {
  const g = new THREE.Group();
  g.name = 'plazaHarbor';
  // 碼頭沿棚外緣（柱環約 10.6），船在水上更外側
  const dockZ = -12.35;
  add(rboxEnv(22, 0.28, 2.4), M(0x7a8078, { roughness: 0.9 }), [0, -0.12, dockZ], g, false);
  // 繫船柱
  for (const x of [-8, -4, 0, 4, 8] as const) {
    add(rcyl(0.08, 0.09, 0.55, segs), M(0x5a4a3a), [x, 0.2, dockZ - 0.9], g, false);
  }
  const flagCols = [0xd03030, 0x2a5ad0, 0xf0c020, 0x30a050];
  const hullCols = [0xe8e8e0, 0x2a6ab0, 0xd8d0b0, 0xe0d8c8, 0x3a7a9a];
  const nBoat = lowDetail ? 4 : 5;
  for (let i = 0; i < nBoat; i++) {
    const boat = new THREE.Group();
    const x = -9 + i * 4.5;
    const z = dockZ - 3.2 - (i % 2) * 2.2;
    boat.position.set(x, -0.5, z);
    boat.rotation.y = (i % 2 === 0 ? -0.15 : 0.2) + (i - 2) * 0.04;
    g.add(boat);
    add(rboxEnv(3.1, 0.65, 1.05), M(hullCols[i % hullCols.length]), [0, 0.32, 0], boat, false);
    add(rboxEnv(3.15, 0.1, 1.1), M(0xb03030), [0, 0.04, 0], boat, false);
    add(rboxEnv(0.95, 0.55, 0.75), M(0xf0f0e8), [0.55, 0.95, 0], boat, false);
    add(rcyl(0.03, 0.03, 2.0, 4), M(0x333333), [-0.55, 1.65, 0], boat, false);
    for (let k = 0; k < 3; k++) {
      add(
        new THREE.PlaneGeometry(0.32, 0.2),
        new THREE.MeshBasicMaterial({ color: flagCols[(i + k) % 4], side: THREE.DoubleSide }),
        [-0.4, 2.45 - k * 0.28, 0],
        boat,
        false,
      );
    }
    add(
      new THREE.SphereGeometry(0.055, 5, 4),
      new THREE.MeshBasicMaterial({ color: [0xffe0a0, 0xff6040, 0x60ff80][i % 3] }),
      [0.55, 1.32, 0],
      boat,
      false,
    );
  }
  return g;
}

function buildBbqStand(
  g: THREE.Group,
  M: MatFn,
  add: AddFn,
  segs: number,
  lowDetail: boolean,
  lights: THREE.PointLight[],
  fires: CharcoalFireFx[],
) {
  const wood = M(0x5a4a32, { roughness: 0.9 });
  const steel = M(0x4a4a4e, { metalness: 0.45, roughness: 0.55 });
  const tarp = M(0xc45a2a, { side: THREE.DoubleSide, roughness: 0.75 });
  for (const sx of [-1.05, 1.05] as const) {
    add(rcyl(0.04, 0.045, 2.15, segs), wood, [sx, 1.08, -0.55], g, true);
    add(rcyl(0.04, 0.045, 2.15, segs), wood, [sx, 1.08, 0.55], g, true);
  }
  const roof = add(rboxEnv(2.3, 0.04, 1.35), tarp, [0, 2.12, 0], g, false);
  roof.rotation.x = -0.08;
  add(rboxEnv(1.35, 0.72, 0.55), steel, [0, 0.36, 0.05], g, true);
  add(rboxEnv(1.28, 0.04, 0.48), M(0x2a2a2c, { metalness: 0.3, roughness: 0.7 }), [0, 0.74, 0.05], g, false);
  const fire = makeCharcoalFire({
    width: 1.0,
    depth: 0.32,
    lowDetail,
    withLight: !lowDetail,
    lightIntensity: 5.2,
    lightDistance: 6.2,
    smoke: lowDetail ? 0.7 : 1.15,
    seed: 2201,
  });
  fire.group.position.set(0, 0.78, 0.05);
  g.add(fire.group);
  fires.push(fire);
  if (fire.light) lights.push(fire.light);
  const grate = M(0x6a6a70, { metalness: 0.55, roughness: 0.45 });
  for (let i = 0; i < 6; i++) add(rboxEnv(1.1, 0.015, 0.02), grate, [0, 0.86, -0.12 + i * 0.06], g, false);
  const meat = M(0x8a3a22, { roughness: 0.7 });
  for (let i = 0; i < (lowDetail ? 3 : 5); i++) {
    add(rboxEnv(0.16, 0.03, 0.07), meat, [-0.35 + i * 0.18, 0.9, 0.02], g, false);
  }
  add(rboxEnv(0.7, 0.06, 0.55), wood, [-0.15, 0.62, -0.95], g, false);
  for (const sx of [-0.55, 0.25] as const) {
    add(rcyl(0.14, 0.13, 0.28, segs), M(0xd04040, { roughness: 0.55 }), [sx, 0.14, -1.15], g, false);
  }
  add(rcyl(0.14, 0.14, 0.55, segs), M(0xd8d0c0, { metalness: 0.2, roughness: 0.5 }), [0.95, 0.28, 0.35], g, true);
}

/** 坐式烤肉：地爐＋矮桌＋地墊／矮凳圍坐（非立式高台） */
function buildBbqSit(
  g: THREE.Group,
  M: MatFn,
  add: AddFn,
  segs: number,
  lowDetail: boolean,
  lights: THREE.PointLight[],
  fires: CharcoalFireFx[],
) {
  const wood = M(0x6a5238, { roughness: 0.88 });
  const matCol = M(0xc8b070, { roughness: 0.85 });
  // 地墊
  add(rboxEnv(2.4, 0.03, 2.4), matCol, [0, 0.02, 0], g, false);
  // 中央矮炭爐
  const steel = M(0x3a3a3e, { metalness: 0.4, roughness: 0.55 });
  add(rcyl(0.42, 0.38, 0.28, segs), steel, [0, 0.2, 0], g, true);
  const fire = makeCharcoalFire({
    width: 0.62,
    depth: 0.62,
    lowDetail,
    withLight: !lowDetail,
    lightIntensity: 4.0,
    lightDistance: 5.2,
    smoke: lowDetail ? 0.65 : 1.05,
    seed: 3302,
  });
  fire.group.position.set(0, 0.36, 0);
  g.add(fire.group);
  fires.push(fire);
  if (fire.light) lights.push(fire.light);
  // 矮烤網架
  add(rboxEnv(0.7, 0.02, 0.7), M(0x6a6a70, { metalness: 0.5 }), [0, 0.48, 0], g, false);
  const meat = M(0x8a3a22);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.3;
    add(rboxEnv(0.14, 0.025, 0.06), meat, [Math.cos(a) * 0.18, 0.52, Math.sin(a) * 0.18], g, false);
  }
  // 四邊矮桌
  for (const [x, z] of [[0, -0.95], [0, 0.95], [-0.95, 0], [0.95, 0]] as const) {
    add(rboxEnv(0.55, 0.08, 0.4), wood, [x, 0.28, z], g, false);
    for (const s of [-0.18, 0.18] as const) {
      add(rcyl(0.03, 0.03, 0.24, 4), wood, [x + (z === 0 ? s : 0), 0.12, z + (x === 0 ? s : 0)], g, false);
    }
  }
  // 矮塑膠凳圍一圈
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    add(rcyl(0.12, 0.11, 0.18, segs), M(0xd04040), [Math.cos(a) * 1.25, 0.09, Math.sin(a) * 1.25], g, false);
  }
  // 低遮陽（較矮）
  const tarp = M(0xd87830, { side: THREE.DoubleSide, roughness: 0.75 });
  for (const sx of [-1.15, 1.15] as const) {
    add(rcyl(0.035, 0.04, 1.55, segs), wood, [sx, 0.78, -1.15], g, true);
    add(rcyl(0.035, 0.04, 1.55, segs), wood, [sx, 0.78, 1.15], g, true);
  }
  add(rboxEnv(2.5, 0.03, 2.5), tarp, [0, 1.55, 0], g, false);
}

function buildDrink(g: THREE.Group, M: MatFn, add: AddFn, segs: number) {
  const wood = M(0x6a5a40, { roughness: 0.88 });
  const blue = M(0x2a6aaa, { side: THREE.DoubleSide, roughness: 0.7 });
  for (const sx of [-0.75, 0.75] as const) {
    add(rcyl(0.035, 0.04, 1.9, segs), wood, [sx, 0.95, -0.35], g, true);
    add(rcyl(0.035, 0.04, 1.9, segs), wood, [sx, 0.95, 0.35], g, true);
  }
  add(rboxEnv(1.7, 0.035, 0.95), blue, [0, 1.88, 0], g, false);
  add(rboxEnv(0.85, 0.95, 0.55), M(0xc8d0d8, { metalness: 0.2, roughness: 0.45 }), [0, 0.48, 0.05], g, true);
  add(rboxEnv(0.78, 0.06, 0.48), M(0x2a2a2a), [0, 0.98, 0.05], g, false);
  const bottle = [0xd04040, 0x2a8a4a, 0xe8d050] as const;
  for (let i = 0; i < 5; i++) {
    add(rcyl(0.04, 0.04, 0.18, 5), M(bottle[i % 3]), [-0.28 + i * 0.14, 1.12, 0.05], g, false);
  }
  add(rcyl(0.13, 0.12, 0.28, segs), M(0xd04040), [0.55, 0.14, -0.55], g, false);
}

function buildSnack(g: THREE.Group, M: MatFn, add: AddFn, segs: number, lowDetail: boolean) {
  const wood = M(0x5a4a32, { roughness: 0.9 });
  const steel = M(0x5a5a60, { metalness: 0.4, roughness: 0.5 });
  add(rcyl(0.03, 0.03, 1.85, 4), wood, [0, 0.95, 0], g, true);
  // Cone 預設尖端朝 +Y＝陽傘頂；勿翻轉（翻了會變漏斗）
  add(
    new THREE.ConeGeometry(0.85, 0.22, lowDetail ? 6 : 10),
    M(0xe8a020, { side: THREE.DoubleSide, roughness: 0.7 }),
    [0, 1.95, 0],
    g,
    false,
  );
  add(rboxEnv(0.95, 0.65, 0.55), wood, [0, 0.33, 0.1], g, true);
  add(rcyl(0.22, 0.2, 0.12, segs), steel, [0, 0.72, 0.1], g, false);
  add(rcyl(0.18, 0.18, 0.04, segs), M(0xd89020, { roughness: 0.4, emissive: 0x3a2008, emissiveIntensity: 0.25 }), [0, 0.78, 0.1], g, false);
  add(rcyl(0.12, 0.12, 0.5, segs), M(0xd8d0c0), [0.55, 0.25, 0.35], g, true);
  for (const sx of [-0.35, 0.35] as const) {
    add(rcyl(0.13, 0.12, 0.28, segs), M(0x2a6ad0), [sx, 0.14, -0.55], g, false);
  }
}

function buildFruit(g: THREE.Group, M: MatFn, add: AddFn, segs: number) {
  const wood = M(0x8a6a40, { roughness: 0.85 });
  const tarp = M(0x2a7a4a, { side: THREE.DoubleSide, roughness: 0.75 });
  for (const sx of [-0.7, 0.7] as const) {
    add(rcyl(0.035, 0.04, 1.7, segs), wood, [sx, 0.85, -0.3], g, true);
    add(rcyl(0.035, 0.04, 1.7, segs), wood, [sx, 0.85, 0.3], g, true);
  }
  add(rboxEnv(1.55, 0.03, 0.85), tarp, [0, 1.72, 0], g, false);
  const crate = M(0xb88848, { roughness: 0.8 });
  add(rboxEnv(0.55, 0.35, 0.4), crate, [-0.35, 0.18, 0.05], g, true);
  add(rboxEnv(0.55, 0.35, 0.4), crate, [0.35, 0.18, 0.05], g, true);
  add(rboxEnv(0.5, 0.32, 0.38), crate, [0, 0.52, 0.08], g, true);
  const fruit = [0xd04030, 0xe8b020, 0x4aa050] as const;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(
      new THREE.SphereGeometry(0.06, 5, 4),
      M(fruit[i % 3]),
      [Math.cos(a) * 0.18, 0.72, 0.08 + Math.sin(a) * 0.12],
      g,
      false,
    );
  }
}

function buildCart(g: THREE.Group, M: MatFn, add: AddFn, segs: number) {
  const body = M(0xc45a28, { roughness: 0.7 });
  const wood = M(0x5a4a32, { roughness: 0.9 });
  add(rboxEnv(1.15, 0.55, 0.55), body, [0, 0.55, 0], g, true);
  add(rboxEnv(1.2, 0.04, 0.6), wood, [0, 0.85, 0], g, false);
  const tire = M(0x1a1a1a);
  for (const [x, z] of [[-0.4, 0.28], [0.4, 0.28], [-0.4, -0.28], [0.4, -0.28]] as const) {
    const w = add(new THREE.TorusGeometry(0.12, 0.035, 4, segs), tire, [x, 0.14, z], g, false);
    w.rotation.y = Math.PI / 2;
  }
  add(rcyl(0.025, 0.025, 0.9, 4), wood, [-0.45, 1.25, 0], g, false);
  add(rcyl(0.025, 0.025, 0.9, 4), wood, [0.45, 1.25, 0], g, false);
  add(rboxEnv(1.1, 0.03, 0.7), M(0xd8c040, { side: THREE.DoubleSide }), [0, 1.72, 0], g, false);
  add(rcyl(0.16, 0.14, 0.1, segs), M(0x6a6a70, { metalness: 0.35 }), [-0.2, 0.95, 0], g, false);
  add(rcyl(0.1, 0.09, 0.08, segs), M(0xe8e0d0), [0.25, 0.94, 0.05], g, false);
}

function buildNoodle(g: THREE.Group, M: MatFn, add: AddFn, segs: number) {
  const wood = M(0x5a4030, { roughness: 0.9 });
  const tarp = M(0xd8d0c0, { side: THREE.DoubleSide, roughness: 0.7 });
  for (const sx of [-0.85, 0.85] as const) {
    add(rcyl(0.04, 0.045, 2.0, segs), wood, [sx, 1.0, -0.4], g, true);
    add(rcyl(0.04, 0.045, 2.0, segs), wood, [sx, 1.0, 0.4], g, true);
  }
  add(rboxEnv(1.9, 0.035, 1.05), tarp, [0, 2.0, 0], g, false);
  add(rboxEnv(1.5, 0.7, 0.6), wood, [0, 0.4, 0.05], g, true);
  add(rcyl(0.28, 0.26, 0.14, segs), M(0x6a6a70, { metalness: 0.35 }), [0, 0.82, 0.05], g, false);
  add(rcyl(0.22, 0.22, 0.05, segs), M(0xe8d090, { roughness: 0.45 }), [0, 0.9, 0.05], g, false);
  for (const sx of [-0.45, 0.45] as const) {
    add(rcyl(0.13, 0.12, 0.28, segs), M(0xd04040), [sx, 0.14, -0.7], g, false);
  }
}

function buildSeafood(g: THREE.Group, M: MatFn, add: AddFn, segs: number) {
  const wood = M(0x4a6a8a, { roughness: 0.85 });
  const ice = M(0xe8f0f8, { roughness: 0.35, metalness: 0.1 });
  for (const sx of [-0.8, 0.8] as const) {
    add(rcyl(0.035, 0.04, 1.75, segs), wood, [sx, 0.88, -0.35], g, true);
    add(rcyl(0.035, 0.04, 1.75, segs), wood, [sx, 0.88, 0.35], g, true);
  }
  add(rboxEnv(1.75, 0.03, 0.9), M(0x2a5a9a, { side: THREE.DoubleSide }), [0, 1.75, 0], g, false);
  add(rboxEnv(1.4, 0.55, 0.7), M(0xd8dce0, { metalness: 0.15 }), [0, 0.35, 0], g, true);
  add(rboxEnv(1.25, 0.12, 0.55), ice, [0, 0.68, 0], g, false);
  // 簡易魚／蝦塊
  for (let i = 0; i < 6; i++) {
    add(rboxEnv(0.16, 0.05, 0.07), M(0xd08060), [-0.4 + i * 0.16, 0.78, (i % 2) * 0.12 - 0.06], g, false);
  }
  add(rcyl(0.22, 0.18, 0.35, segs), M(0xc84030, { side: THREE.DoubleSide }), [0.85, 0.2, -0.5], g, false);
}

function buildSweet(g: THREE.Group, M: MatFn, add: AddFn, segs: number) {
  const wood = M(0x8a5a3a, { roughness: 0.85 });
  const pink = M(0xe87898, { side: THREE.DoubleSide, roughness: 0.7 });
  for (const sx of [-0.65, 0.65] as const) {
    add(rcyl(0.03, 0.035, 1.65, segs), wood, [sx, 0.82, -0.3], g, true);
    add(rcyl(0.03, 0.035, 1.65, segs), wood, [sx, 0.82, 0.3], g, true);
  }
  add(rboxEnv(1.45, 0.03, 0.8), pink, [0, 1.65, 0], g, false);
  add(rboxEnv(1.1, 0.6, 0.5), wood, [0, 0.35, 0], g, true);
  const sweet = [0xf0a0b0, 0xf0d060, 0xa0d8a0] as const;
  for (let i = 0; i < 6; i++) {
    add(new THREE.SphereGeometry(0.05, 5, 4), M(sweet[i % 3]), [-0.3 + i * 0.12, 0.72, 0], g, false);
  }
  add(rcyl(0.12, 0.11, 0.26, segs), M(0xd04040), [0.5, 0.13, -0.55], g, false);
}
