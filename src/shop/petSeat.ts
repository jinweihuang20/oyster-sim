/** 貼地寵物（阿康／阿珀／阿妹）坐下時的位置：碗右前方、膝蓋旁，第一人稱也看得到 */
import * as THREE from 'three';

export const GROUND_PET_RADIUS = 0.16;
/** 與紅臉盆／肉碗的最小淨空（邊緣到寵物包圍半徑） */
export const GROUND_PET_WORK_CLEAR = 0.08;
/** 相對肉碗中心再往玩家右側偏一點（公尺） */
export const SEATED_PET_BOWL_RIGHT = 0.08;
/** 從肉碗往玩家靠近的距離比例（夾在碗與膝蓋之間） */
export const SEATED_PET_BOWL_BACK_K = 0.45;
export const SEATED_PET_BOWL_BACK_MIN = 0.22;
export const SEATED_PET_BOWL_BACK_MAX = 0.50;
/** 朝玩家／碗微轉，第一人稱比較看得到臉 */
export const SEATED_PET_YAW_IN = 0.55;
/** 沒有肉碗（抽菸區等）時：坐在右側膝蓋旁 */
export const SEATED_PET_FALLBACK = { right: 0.46, forward: 0.48 };

export type Xz = { x: number; z: number };
export type Circ = Xz & { r: number };

/** 工寮第一人稱坐下：對齊 main.ts 的 SEAT0／BASIN0／BOWL0 */
export const SHED_SEATED_WORK = {
  camY: 1.05,
  seatZ: 2,
  pitch: -0.85,
  bowl: { x: 0.35, z: 0.92, r: 0.17 },
  basin: { x: -0.35, z: 0.98, r: 0.27 },
} as const;

/** 廣場第一人稱坐下：鏡頭較高、盆／碗較近（對齊 BASIN0_PLAZA／BOWL0_PLAZA 與 SEAT.y=ground+1.48） */
export const PLAZA_SEATED_WORK = {
  camY: 1.48,
  seatZ: 2,
  pitch: -0.85,
  bowl: { x: 0.35, z: 1.22, r: 0.17 },
  basin: { x: -0.35, z: 1.28, r: 0.33 },
} as const;

/**
 * 遠端坐下臉盆／肉碗的本地座標，對齊 plaza/worldView.ts makeRemoteProps
 * basinX=-0.28, basinZ=-0.58；meatX=basinX+0.2+0.2+0.13
 */
export const REMOTE_SEATED_BASIN = { x: -0.28, z: -0.58, r: 0.20 };
export const REMOTE_SEATED_BOWL = { x: 0.25, z: -0.58, r: 0.13 };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 若離圓形工位太近，沿與圓心的連線往外推 */
export function pushClearOfCircle(x: number, z: number, circ: Circ, radius = GROUND_PET_RADIUS, clear = GROUND_PET_WORK_CLEAR): Xz {
  const dx = x - circ.x, dz = z - circ.z;
  const need = circ.r + radius + clear;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return { x: circ.x + need, z: circ.z };
  if (d < need) {
    const k = need / d;
    return { x: circ.x + dx * k, z: circ.z + dz * k };
  }
  return { x, z };
}

export function workClearance(pet: Xz, bowl: Circ, basin: Circ, radius = GROUND_PET_RADIUS): { bowlGap: number; basinGap: number } {
  return {
    bowlGap: Math.hypot(pet.x - bowl.x, pet.z - bowl.z) - bowl.r - radius,
    basinGap: Math.hypot(pet.x - basin.x, pet.z - basin.z) - basin.r - radius,
  };
}

/**
 * 坐下時貼地寵物的世界（或同一本地空間）站立點。
 * yaw=0 時玩家朝 -Z，右側為 +X。
 */
export function seatedGroundPetSpot(opts: {
  seat: Xz;
  yaw: number;
  bowl?: Circ | null;
  basin?: Circ | null;
}): { x: number; z: number; yaw: number } {
  const s = Math.sin(opts.yaw), c = Math.cos(opts.yaw);
  const right = { x: c, z: -s };
  const fwd = { x: -s, z: -c };
  let x: number;
  let z: number;
  const bowl = opts.bowl && Number.isFinite(opts.bowl.x + opts.bowl.z) ? opts.bowl : null;
  if (bowl) {
    const bowlFwd = (bowl.x - opts.seat.x) * fwd.x + (bowl.z - opts.seat.z) * fwd.z;
    const back = clamp(bowlFwd * SEATED_PET_BOWL_BACK_K, SEATED_PET_BOWL_BACK_MIN, SEATED_PET_BOWL_BACK_MAX);
    x = bowl.x + right.x * SEATED_PET_BOWL_RIGHT - fwd.x * back;
    z = bowl.z + right.z * SEATED_PET_BOWL_RIGHT - fwd.z * back;
    ({ x, z } = pushClearOfCircle(x, z, bowl));
    if (opts.basin && Number.isFinite(opts.basin.x + opts.basin.z)) {
      ({ x, z } = pushClearOfCircle(x, z, opts.basin));
    }
  } else {
    x = opts.seat.x + right.x * SEATED_PET_FALLBACK.right + fwd.x * SEATED_PET_FALLBACK.forward;
    z = opts.seat.z + right.z * SEATED_PET_FALLBACK.right + fwd.z * SEATED_PET_FALLBACK.forward;
  }
  return { x, z, yaw: opts.yaw + SEATED_PET_YAW_IN };
}

/** 舊版坐下位置（右側偏後），第一人稱朝下看工位時會落到鏡頭後方 */
export function legacySeatedGroundPetSpot(seat: Xz, yaw: number, side = 0.55, back = 0.32): Xz {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { x: seat.x + c * side + s * back, z: seat.z - s * side + c * back };
}

export type FpSeatedCam = {
  x: number; y: number; z: number;
  pitch: number;
  yaw?: number;
  fov: number;
  aspect: number;
};

/** 把一點投到第一人稱坐下鏡頭的 NDC，用來確認寵物有沒有入鏡 */
export function projectFpSeated(cam: FpSeatedCam, point: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const c = new THREE.PerspectiveCamera(cam.fov, cam.aspect, 0.05, 20);
  c.position.set(cam.x, cam.y, cam.z);
  c.rotation.order = 'YXZ';
  c.rotation.set(cam.pitch, cam.yaw ?? 0, 0);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const v = new THREE.Vector3(point.x, point.y, point.z).project(c);
  return { x: v.x, y: v.y, z: v.z };
}

export function inFpSeatedView(
  cam: FpSeatedCam,
  point: { x: number; y: number; z: number },
  margin = 0,
): boolean {
  const p = projectFpSeated(cam, point);
  const m = Math.max(0, margin);
  return p.z < 1 && Math.abs(p.x) <= 1 - m && Math.abs(p.y) <= 1 - m;
}

/**
 * 本機寵物錨點要不要顯示。
 * 以前第一人稱坐下會把貼地寵物藏起來以免擋視線；改放到碗右前方後即可顯示。
 */
export function ownPetAnchorVisible(opts: {
  play: boolean;
  paused?: boolean;
  tut?: boolean;
  onMg?: boolean;
  race?: boolean;
}): boolean {
  return !!opts.play && !opts.paused && !opts.tut && !opts.onMg && !opts.race;
}
