import * as THREE from 'three';
import { rboxEnv, rcyl } from '../geo';

/**
 * 死鬥／商店共用的武器定義。
 * 加新槍：1) 擴 WeaponId 2) 填 WEAPON_DEFS 3) 在 buildWeaponView 加模型
 */
export type WeaponId =
  | 'oysterGun'
  | 'oysterSniper'
  | 'oysterAk'
  | 'oysterM4'
  | 'oysterDeagle'
  | 'oysterSmg'
  | 'oysterNova';

export interface WeaponDef {
  id: WeaponId;
  /** 商店／圖鑑短述 */
  name: string;
  blurb: string;
  maxAmmo: number;
  /** 射速（發／秒）；實際間隔＝`1 / fireRate`（連發組內同此） */
  fireRate: number;
  /**
   * 長按連發組大小。1＝每冷卻一發；>1＝打完一組後停 `burstPause` 再下一組
   */
  burstCount: number;
  /** 一組連發打完後的停頓（秒）；`burstCount ≤ 1` 時忽略 */
  burstPause: number;
  /** 子彈飛行速度（世界單位／秒） */
  bulletSpeed: number;
  /**
   * 軀幹傷害／彈（對齊 CS 無甲胸傷 ×2，因死鬥 MAX_HP=200）。
   * 頭＝×4、腿＝×0.5；散彈為每顆彈丸傷害。
   */
  damage: number;
  /** 每次扣板機的彈丸數（散彈＞1） */
  pelletCount: number;
  /** 彈丸散布（弧度） */
  spread: number;
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
  /** 雜貨店標價；0＝開局贈送 */
  price: number;
  /** 是否在雜貨店／死鬥武器選單出現 */
  inShop: boolean;
}

/** 部位倍率（近似 CS：頭×4、腿×0.75→本作 leg 用 0.5 對齊舊手感） */
export const HEAD_DAMAGE_MUL = 4;
export const LEGS_DAMAGE_MUL = 0.5;

export function partDamage(bodyDamage: number, part: 'head' | 'body' | 'legs'): number {
  if (part === 'head') return Math.round(bodyDamage * HEAD_DAMAGE_MUL);
  if (part === 'legs') return Math.round(bodyDamage * LEGS_DAMAGE_MUL);
  return Math.round(bodyDamage);
}

/** 運行中實例：彈藥／後座力／view 掛這裡 */
export interface Weapon {
  def: WeaponDef;
  ammo: number;
  kick: number;
  view: THREE.Group | null;
  /** 本組連發還剩幾發（含剛要打的那發）；0＝下一發開新組 */
  burstLeft: number;
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  // 傷害對照 CS 無甲胸傷 ×2（MAX_HP 200≈CS 100）
  oysterGun: {
    id: 'oysterGun',
    name: '蚵仔槍',
    blurb: '鐵管＋木托＋蚵殼漏斗；長按三連發節奏',
    maxAmmo: 15,
    fireRate: 10,
    burstCount: 3,
    burstPause: 0.48,
    bulletSpeed: 90,
    damage: 60, // FAMAS 30
    pelletCount: 1,
    spread: 0,
    kickScale: 1,
    zoom: 1,
    adsBreakOnFire: false,
    hipCross: true,
    hip: [0.26, -0.3, -0.52],
    hipRot: [0.1, 0.16, 0.04],
    price: 0,
    inShop: true,
  },
  oysterAk: {
    id: 'oysterAk',
    name: '蚵卡拉什',
    blurb: '彎彈匣塞滿乾蚵，木托還黏著殼屑；全自動土砲',
    maxAmmo: 30,
    fireRate: 9.5,
    burstCount: 1,
    burstPause: 0,
    bulletSpeed: 100,
    damage: 72, // AK-47 36 → 約 3 槍軀幹
    pelletCount: 1,
    spread: 0.012,
    kickScale: 1.35,
    zoom: 1,
    adsBreakOnFire: false,
    hipCross: true,
    hip: [0.26, -0.3, -0.52],
    hipRot: [0.1, 0.16, 0.04],
    price: 5500,
    inShop: true,
  },
  oysterM4: {
    id: 'oysterM4',
    name: '蚵殼卡賓',
    blurb: '寶特瓶護木＋蚵灰塗裝，射速穩、後座較收',
    maxAmmo: 30,
    fireRate: 11,
    burstCount: 1,
    burstPause: 0,
    bulletSpeed: 105,
    damage: 66, // M4A4 33 → 約 4 槍軀幹，射速補
    pelletCount: 1,
    spread: 0.008,
    kickScale: 0.95,
    zoom: 1.2,
    adsBreakOnFire: false,
    hipCross: true,
    hip: [0.25, -0.3, -0.55],
    hipRot: [0.08, 0.14, 0.03],
    price: 6200,
    inShop: true,
  },
  oysterDeagle: {
    id: 'oysterDeagle',
    name: '珍珠沙鷹',
    blurb: '握把鑲半顆黑珍珠，一槍一個響；半自動手槍',
    maxAmmo: 7,
    fireRate: 2.2,
    burstCount: 1,
    burstPause: 0,
    bulletSpeed: 130,
    damage: 106, // Deagle 53 → 約 2 槍軀幹／頭秒殺
    pelletCount: 1,
    spread: 0.01,
    kickScale: 2.2,
    zoom: 1,
    adsBreakOnFire: false,
    hipCross: true,
    hip: [0.22, -0.28, -0.42],
    hipRot: [0.05, 0.2, 0.02],
    price: 3800,
    inShop: true,
  },
  oysterSmg: {
    id: 'oysterSmg',
    name: '蚵仔烏茲',
    blurb: '短鐵管＋蚵網彈鼓，近身掃起來像撒殼',
    maxAmmo: 25,
    fireRate: 14,
    burstCount: 1,
    burstPause: 0,
    bulletSpeed: 75,
    damage: 50, // MAC-10／MP9 一帶；射速換單發較低
    pelletCount: 1,
    spread: 0.028,
    kickScale: 0.75,
    zoom: 1,
    adsBreakOnFire: false,
    hipCross: true,
    hip: [0.24, -0.28, -0.48],
    hipRot: [0.12, 0.18, 0.05],
    price: 2200,
    inShop: true,
  },
  oysterNova: {
    id: 'oysterNova',
    name: '蚵殼噴子',
    blurb: '雙管塞蚵殼，一扣散出一盆碎殼',
    maxAmmo: 8,
    fireRate: 1.15,
    burstCount: 1,
    burstPause: 0,
    bulletSpeed: 70,
    damage: 34, // Nova 單彈丸 ~26；×6 近距約可收掉滿血
    pelletCount: 6,
    spread: 0.085,
    kickScale: 2.4,
    zoom: 1,
    adsBreakOnFire: false,
    hipCross: true,
    hip: [0.27, -0.32, -0.55],
    hipRot: [0.12, 0.1, 0.02],
    price: 3000,
    inShop: true,
  },
  oysterSniper: {
    id: 'oysterSniper',
    name: '蚵殼狙擊',
    blurb: '加長鐵管＋寶特瓶瞄具，開鏡 3.5×，開火後要重新開鏡',
    maxAmmo: 6,
    fireRate: 1.05,
    burstCount: 1,
    burstPause: 0,
    bulletSpeed: 160,
    damage: 110, // 近 AWP 無甲胸傷；滿血軀幹要兩槍，頭仍秒殺（×4）
    pelletCount: 1,
    spread: 0,
    kickScale: 1.85,
    zoom: 3.5,
    adsBreakOnFire: true,
    hipCross: false,
    hip: [0.28, -0.34, -0.58],
    hipRot: [0.06, 0.12, 0.02],
    price: 8800,
    inShop: true,
  },
};

export const isWeaponId = (id: string): id is WeaponId => id in WEAPON_DEFS;

export const makeWeapon = (id: WeaponId): Weapon => ({
  def: WEAPON_DEFS[id],
  ammo: WEAPON_DEFS[id].maxAmmo,
  kick: 0,
  view: null,
  burstLeft: 0,
});

/** 依射速換算單發間隔（秒） */
export function shotInterval(d: WeaponDef): number {
  return 1 / Math.max(0.05, d.fireRate);
}

/** 開火成功後寫入下一發冷卻；連發組內用射速，組末用 burstPause */
export function cooldownAfterShot(w: Weapon): number {
  const d = w.def;
  const gap = shotInterval(d);
  if (d.burstCount <= 1) return gap;
  w.burstLeft = Math.max(0, w.burstLeft - 1);
  return w.burstLeft > 0 ? gap : d.burstPause;
}

/** 長按開新一組連發 */
export function armBurst(w: Weapon) {
  if (w.def.burstCount > 1 && w.burstLeft <= 0) w.burstLeft = w.def.burstCount;
}

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
  const m = new THREE.Object3D();
  m.position.set(0, y, z);
  g.add(m);
  g.userData.muzzle = m;
  return g;
}

function stickShell(
  g: THREE.Group,
  shellGeos: THREE.BufferGeometry[],
  shellMat: THREE.Material,
  i: number,
  pos: [number, number, number],
  scale = 0.75,
  rot: [number, number, number] = [0.4, 0.8, 0.2],
) {
  const sh = new THREE.Mesh(shellGeos[i % shellGeos.length], shellMat);
  sh.scale.setScalar(scale);
  sh.position.set(...pos);
  sh.rotation.set(...rot);
  g.add(sh);
}

export function buildWeaponView(id: WeaponId, ctx: WeaponViewCtx): THREE.Group {
  const { M, add, LO, shellGeos, shellMat } = ctx;
  const segs = LO ? 6 : 8;

  if (id === 'oysterGun') {
    const g = new THREE.Group();
    const wood = M(0x8a5a32), metal = M(0x6a7078, { metalness: 0.45, roughness: 0.4 }), rust = M(0x7a5a40), tape = M(0xc8b060);
    add(rboxEnv(0.07, 0.11, 0.26), wood, [0, -0.05, 0.1], g, false);
    add(rboxEnv(0.065, 0.15, 0.085), wood, [0, -0.13, 0.12], g, false);
    add(rboxEnv(0.085, 0.09, 0.2), metal, [0, 0.01, -0.04], g, false);
    const barrel = add(rcyl(0.032, 0.038, 0.52, segs), rust, [0, 0.015, -0.4], g, false);
    barrel.rotation.x = Math.PI / 2;
    add(rcyl(0.045, 0.045, 0.04, segs), metal, [0, 0.015, -0.66], g, false).rotation.x = Math.PI / 2;
    add(rcyl(0.07, 0.045, 0.11, 6), M(0x3a5a3a), [0, 0.11, -0.02], g, false);
    stickShell(g, shellGeos, shellMat, 0, [-0.018, 0.16, -0.02], 0.85);
    stickShell(g, shellGeos, shellMat, 1, [0.018, 0.16, -0.02], 0.85, [0.4, 1.2, 0.2]);
    add(new THREE.TorusGeometry(0.042, 0.011, 4, LO ? 6 : 10), tape, [0, 0.015, -0.22], g, false).rotation.y = Math.PI / 2;
    add(rboxEnv(0.02, 0.04, 0.06), metal, [0, -0.05, 0.02], g, false);
    return tagMuzzle(g, 0.015, -0.72);
  }

  if (id === 'oysterAk') {
    const g = new THREE.Group();
    const wood = M(0x7a4a28), metal = M(0x4a5048, { metalness: 0.5, roughness: 0.45 }), rust = M(0x6a5038);
    add(rboxEnv(0.065, 0.1, 0.34), wood, [0, -0.04, 0.12], g, false);
    add(rboxEnv(0.055, 0.18, 0.07), wood, [0, -0.15, 0.16], g, false);
    add(rboxEnv(0.08, 0.08, 0.28), metal, [0, 0.02, -0.06], g, false);
    // 彎彈匣（塞乾蚵）
    const mag = add(rboxEnv(0.045, 0.2, 0.07), rust, [0, -0.14, -0.02], g, false);
    mag.rotation.z = 0.35;
    stickShell(g, shellGeos, shellMat, 2, [0.02, -0.12, -0.02], 0.45, [1.2, 0.3, 0.5]);
    stickShell(g, shellGeos, shellMat, 3, [-0.01, -0.18, 0.0], 0.4, [0.8, 1.5, 0.2]);
    const barrel = add(rcyl(0.028, 0.034, 0.62, segs), metal, [0, 0.025, -0.48], g, false);
    barrel.rotation.x = Math.PI / 2;
    add(rcyl(0.05, 0.04, 0.1, segs), rust, [0, 0.025, -0.82], g, false).rotation.x = Math.PI / 2;
    // 蚵殼護木
    stickShell(g, shellGeos, shellMat, 0, [0.05, 0.06, -0.2], 0.55, [0.2, 0.5, 1.2]);
    stickShell(g, shellGeos, shellMat, 1, [-0.05, 0.05, -0.28], 0.5, [0.3, -0.4, -1]);
    add(rboxEnv(0.03, 0.05, 0.08), metal, [0, 0.07, -0.12], g, false);
    return tagMuzzle(g, 0.025, -0.9);
  }

  if (id === 'oysterM4') {
    const g = new THREE.Group();
    const dark = M(0x2e3238, { metalness: 0.4, roughness: 0.5 }), teal = M(0x3a6a5a), plastic = M(0x4a5560);
    add(rboxEnv(0.06, 0.09, 0.3), plastic, [0, -0.05, 0.14], g, false);
    add(rboxEnv(0.05, 0.16, 0.065), plastic, [0, -0.14, 0.18], g, false);
    add(rboxEnv(0.07, 0.07, 0.32), dark, [0, 0.01, -0.05], g, false);
    // 直彈匣
    add(rboxEnv(0.04, 0.18, 0.06), teal, [0, -0.12, -0.02], g, false);
    const barrel = add(rcyl(0.022, 0.026, 0.58, segs), dark, [0, 0.015, -0.48], g, false);
    barrel.rotation.x = Math.PI / 2;
    // 寶特瓶護木
    add(rcyl(0.04, 0.04, 0.22, segs), M(0x5a9aaa, { transparent: true, opacity: 0.55, roughness: 0.2 }), [0, 0.015, -0.28], g, false).rotation.x = Math.PI / 2;
    add(rboxEnv(0.035, 0.04, 0.12), dark, [0, 0.06, -0.08], g, false);
    stickShell(g, shellGeos, shellMat, 4, [0.0, 0.1, 0.08], 0.55, [0.6, 0.2, 0.4]);
    // 簡易紅點（蚵珠）
    add(rcyl(0.018, 0.018, 0.06, 6), M(0x222222), [0, 0.08, -0.1], g, false).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.01, 6, 6), M(0xff4040, { emissive: 0xaa2020, emissiveIntensity: 0.6 }), [0, 0.08, -0.07], g, false);
    return tagMuzzle(g, 0.015, -0.8);
  }

  if (id === 'oysterDeagle') {
    const g = new THREE.Group();
    const metal = M(0xb0a090, { metalness: 0.7, roughness: 0.25 }), dark = M(0x2a2a2a), pearl = M(0x1a1520, { metalness: 0.3, roughness: 0.15 });
    add(rboxEnv(0.055, 0.08, 0.18), metal, [0, 0.0, -0.02], g, false);
    add(rboxEnv(0.05, 0.14, 0.06), dark, [0, -0.1, 0.06], g, false);
    // 黑珍珠握把飾
    add(new THREE.SphereGeometry(0.022, 8, 8), pearl, [0.03, -0.1, 0.06], g, false);
    const barrel = add(rcyl(0.02, 0.024, 0.28, segs), metal, [0, 0.02, -0.22], g, false);
    barrel.rotation.x = Math.PI / 2;
    add(rboxEnv(0.04, 0.035, 0.08), metal, [0, 0.045, -0.08], g, false);
    stickShell(g, shellGeos, shellMat, 0, [0, 0.07, 0.04], 0.4, [0.5, 1, 0.3]);
    add(rboxEnv(0.015, 0.03, 0.04), dark, [0, -0.02, 0.02], g, false);
    return tagMuzzle(g, 0.02, -0.38);
  }

  if (id === 'oysterSmg') {
    const g = new THREE.Group();
    const metal = M(0x5a6068, { metalness: 0.45, roughness: 0.4 }), mesh = M(0x8a7a50), dark = M(0x333338);
    add(rboxEnv(0.07, 0.08, 0.22), metal, [0, 0.0, 0.02], g, false);
    add(rboxEnv(0.055, 0.12, 0.06), dark, [0, -0.1, 0.08], g, false);
    // 蚵網彈鼓
    add(rcyl(0.09, 0.09, 0.05, LO ? 8 : 12), mesh, [0, -0.08, -0.04], g, false).rotation.x = Math.PI / 2;
    stickShell(g, shellGeos, shellMat, 1, [0.05, -0.08, -0.04], 0.35, [0.2, 0.9, 0.5]);
    stickShell(g, shellGeos, shellMat, 2, [-0.04, -0.1, -0.02], 0.32, [1, 0.2, 0.8]);
    const barrel = add(rcyl(0.024, 0.028, 0.32, segs), metal, [0, 0.01, -0.28], g, false);
    barrel.rotation.x = Math.PI / 2;
    add(rboxEnv(0.04, 0.04, 0.1), dark, [0, 0.05, -0.05], g, false);
    // 折疊托（短）
    add(rboxEnv(0.03, 0.04, 0.12), dark, [0, 0.02, 0.16], g, false);
    return tagMuzzle(g, 0.01, -0.46);
  }

  if (id === 'oysterNova') {
    const g = new THREE.Group();
    const wood = M(0x6a4020), metal = M(0x6a7078, { metalness: 0.5, roughness: 0.35 }), rust = M(0x7a5a40);
    add(rboxEnv(0.07, 0.09, 0.28), wood, [0, -0.04, 0.1], g, false);
    add(rboxEnv(0.06, 0.14, 0.07), wood, [0, -0.13, 0.14], g, false);
    // 雙管
    for (const sx of [-0.028, 0.028]) {
      const b = add(rcyl(0.022, 0.026, 0.55, segs), metal, [sx, 0.02, -0.35], g, false);
      b.rotation.x = Math.PI / 2;
    }
    add(rboxEnv(0.09, 0.05, 0.12), rust, [0, 0.02, -0.08], g, false);
    // 管口蚵殼裝飾
    stickShell(g, shellGeos, shellMat, 0, [-0.04, 0.05, -0.62], 0.5, [0.3, 0.5, 1.4]);
    stickShell(g, shellGeos, shellMat, 3, [0.04, 0.04, -0.6], 0.48, [0.4, -0.6, -1.2]);
    stickShell(g, shellGeos, shellMat, 1, [0, 0.1, 0.0], 0.6, [0.7, 0.3, 0.2]);
    add(rboxEnv(0.025, 0.04, 0.05), metal, [0, -0.04, 0.02], g, false);
    return tagMuzzle(g, 0.02, -0.66);
  }

  if (id === 'oysterSniper') {
    const g = new THREE.Group();
    const wood = M(0x6e4428), metal = M(0x5a6068, { metalness: 0.55, roughness: 0.35 }), dark = M(0x2a2a2a);
    const plastic = M(0x3a6a9a, { roughness: 0.45, transparent: true, opacity: 0.55 });
    add(rboxEnv(0.06, 0.09, 0.32), wood, [0, -0.06, 0.14], g, false);
    add(rboxEnv(0.055, 0.16, 0.07), wood, [0, -0.14, 0.18], g, false);
    add(rboxEnv(0.07, 0.07, 0.28), metal, [0, 0.0, -0.02], g, false);
    const barrel = add(rcyl(0.022, 0.028, 0.95, segs), metal, [0, 0.01, -0.62], g, false);
    barrel.rotation.x = Math.PI / 2;
    add(rcyl(0.034, 0.034, 0.05, segs), dark, [0, 0.01, -1.08], g, false).rotation.x = Math.PI / 2;
    add(rcyl(0.028, 0.028, 0.18, segs), plastic, [0, 0.08, -0.12], g, false).rotation.x = Math.PI / 2;
    add(rcyl(0.032, 0.032, 0.03, 6), dark, [0, 0.08, -0.03], g, false).rotation.x = Math.PI / 2;
    add(rcyl(0.032, 0.032, 0.03, 6), dark, [0, 0.08, -0.21], g, false).rotation.x = Math.PI / 2;
    stickShell(g, shellGeos, shellMat, 0, [0, 0.12, 0.06], 0.7, [0.5, 0.8, 0.2]);
    add(rboxEnv(0.018, 0.035, 0.05), dark, [0, -0.05, 0.04], g, false);
    return tagMuzzle(g, 0.01, -1.14);
  }

  return tagMuzzle(new THREE.Group(), 0, -0.4);
}
