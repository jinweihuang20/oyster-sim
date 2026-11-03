import * as THREE from 'three';

/**
 * 死鬥／商店共用的武器定義。
 * 加新槍：1) 擴 WeaponId 2) 填 WEAPON_DEFS 3) 在 buildWeaponView 加模型
 */
export type WeaponId = 'oysterGun' | 'oysterSniper';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** 商店／圖鑑短述 */
  blurb: string;
  maxAmmo: number;
  fireCd: number;
  projSpeed: number;
  /** 後座力強度（相對） */
  kickScale: number;
  /** 開鏡倍率；1＝不能開鏡，FOV＝基準／zoom */
  zoom: number;
  /** 射擊後強制關鏡，需再按一次開鏡（狙擊典型） */
  adsBreakOnFire: boolean;
  /** 非開鏡時是否顯示準心（狙擊通常 false，靠開鏡準星） */
  hipCross: boolean;
  /** 第一人稱靜止握持（相機本地） */
  hip: [number, number, number];
  hipRot: [number, number, number];
  /** 商店標價；目前死鬥免費領，之後接金錢 */
  price: number;
  /** 是否在死鬥武器店上架 */
  inShop: boolean;
}

/** 運行中實例：彈藥／後座力／view 掛這裡 */
export interface Weapon {
  def: WeaponDef;
  ammo: number;
  kick: number;
  view: THREE.Group | null;
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  oysterGun: {
    id: 'oysterGun',
    name: '蚵仔槍',
    blurb: '鐵管＋木托＋蚵殼漏斗，夜市土砲入門款',
    maxAmmo: 15,
    fireCd: 0.15,
    projSpeed: 90,
    kickScale: 1,
    zoom: 1,
    adsBreakOnFire: false,
    hipCross: true,
    hip: [0.26, -0.3, -0.52],
    hipRot: [0.1, 0.16, 0.04],
    price: 0,
    inShop: true,
  },
  oysterSniper: {
    id: 'oysterSniper',
    name: '蚵殼狙擊',
    blurb: '加長鐵管＋寶特瓶瞄具，開鏡 3.5×，開火後要重新開鏡',
    maxAmmo: 6,
    fireCd: 0.95,
    projSpeed: 160,
    kickScale: 1.85,
    zoom: 3.5,
    adsBreakOnFire: true,
    hipCross: false,
    hip: [0.28, -0.34, -0.58],
    hipRot: [0.06, 0.12, 0.02],
    price: 0,
    inShop: true,
  },
};

export const makeWeapon = (id: WeaponId): Weapon => ({
  def: WEAPON_DEFS[id],
  ammo: WEAPON_DEFS[id].maxAmmo,
  kick: 0,
  view: null,
});

export const weaponList = (): WeaponDef[] => Object.values(WEAPON_DEFS);
export const shopWeapons = (): WeaponDef[] => weaponList().filter(w => w.inShop);

export type MatFn = (c: number, o?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial;
export type MeshAdd = (
  g: THREE.BufferGeometry,
  m: THREE.Material,
  p: [number, number, number],
  parent?: THREE.Object3D,
  shadow?: boolean,
) => THREE.Mesh;

export type WeaponViewCtx = {
  M: MatFn;
  add: MeshAdd;
  LO: boolean;
  shellGeos: THREE.BufferGeometry[];
  shellMat: THREE.Material;
};

/** 槍口錨點（火花／彈道用），存在 userData.muzzle */
function tagMuzzle(g: THREE.Group, y: number, z: number) {
  const m = new THREE.Object3D(); m.position.set(0, y, z); g.add(m); g.userData.muzzle = m; return g;
}

export function buildWeaponView(id: WeaponId, ctx: WeaponViewCtx): THREE.Group {
  const { M, add, LO, shellGeos, shellMat } = ctx;
  if (id === 'oysterGun') {
    const g = new THREE.Group();
    const wood = M(0x8a5a32), metal = M(0x6a7078, { metalness: 0.45, roughness: 0.4 }), rust = M(0x7a5a40), tape = M(0xc8b060);
    add(new THREE.BoxGeometry(0.07, 0.11, 0.26), wood, [0, -0.05, 0.1], g, false);
    add(new THREE.BoxGeometry(0.065, 0.15, 0.085), wood, [0, -0.13, 0.12], g, false);
    add(new THREE.BoxGeometry(0.085, 0.09, 0.2), metal, [0, 0.01, -0.04], g, false);
    const barrel = add(new THREE.CylinderGeometry(0.032, 0.038, 0.52, LO ? 6 : 8), rust, [0, 0.015, -0.4], g, false);
    barrel.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.04, LO ? 6 : 8), metal, [0, 0.015, -0.66], g, false).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.07, 0.045, 0.11, 6), M(0x3a5a3a), [0, 0.11, -0.02], g, false);
    for (let i = 0; i < 2; i++) {
      const sh = new THREE.Mesh(shellGeos[i % shellGeos.length], shellMat);
      sh.scale.setScalar(0.85);
      sh.position.set((i - 0.5) * 0.035, 0.16, -0.02);
      sh.rotation.set(0.4, i * 1.2, 0.2);
      g.add(sh);
    }
    const wrap = add(new THREE.TorusGeometry(0.042, 0.011, 4, LO ? 6 : 10), tape, [0, 0.015, -0.22], g, false);
    wrap.rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(0.02, 0.04, 0.06), metal, [0, -0.05, 0.02], g, false);
    return tagMuzzle(g, 0.015, -0.72);
  }
  if (id === 'oysterSniper') {
    const g = new THREE.Group();
    const wood = M(0x6e4428), metal = M(0x5a6068, { metalness: 0.55, roughness: 0.35 }), dark = M(0x2a2a2a);
    const plastic = M(0x3a6a9a, { roughness: 0.45, transparent: true, opacity: 0.55 });
    add(new THREE.BoxGeometry(0.06, 0.09, 0.32), wood, [0, -0.06, 0.14], g, false);
    add(new THREE.BoxGeometry(0.055, 0.16, 0.07), wood, [0, -0.14, 0.18], g, false);
    add(new THREE.BoxGeometry(0.07, 0.07, 0.28), metal, [0, 0.0, -0.02], g, false);
    const barrel = add(new THREE.CylinderGeometry(0.022, 0.028, 0.95, LO ? 6 : 8), metal, [0, 0.01, -0.62], g, false);
    barrel.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.034, 0.034, 0.05, LO ? 6 : 8), dark, [0, 0.01, -1.08], g, false).rotation.x = Math.PI / 2;
    // 寶特瓶／鐵罐瞄具
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.18, LO ? 6 : 8), plastic, [0, 0.08, -0.12], g, false).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 6), dark, [0, 0.08, -0.03], g, false).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 6), dark, [0, 0.08, -0.21], g, false).rotation.x = Math.PI / 2;
    const sh = new THREE.Mesh(shellGeos[0], shellMat);
    sh.scale.setScalar(0.7); sh.position.set(0.0, 0.12, 0.06); sh.rotation.set(0.5, 0.8, 0.2); g.add(sh);
    add(new THREE.BoxGeometry(0.018, 0.035, 0.05), dark, [0, -0.05, 0.04], g, false);
    return tagMuzzle(g, 0.01, -1.14);
  }
  return tagMuzzle(new THREE.Group(), 0, -0.4);
}
