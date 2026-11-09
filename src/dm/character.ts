import * as THREE from 'three';
import type { MatFn, MeshAdd } from './weapons';
import { rbox } from '../core/geo';

const SKIN = 0xe8bc98;

/** 第三人稱方塊玩家（風格對齊上工 NPC） */
export type PlayerOutfitMats = {
  body: THREE.MeshStandardMaterial[];
  sleeve: THREE.MeshStandardMaterial[];
  legs: THREE.MeshStandardMaterial[];
  feet: THREE.MeshStandardMaterial[];
  hair: THREE.MeshStandardMaterial[];
};

export type PlayerRig = {
  outer: THREE.Group;
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  /** 頭飾掛點（斗笠／安全帽等） */
  hatG: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  weaponMount: THREE.Group;
  shoulderL: THREE.Object3D;
  shoulderR: THREE.Object3D;
  upperL: THREE.Group;
  lowerL: THREE.Group;
  upperR: THREE.Group;
  lowerR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  outfitMats: PlayerOutfitMats;
  /** 目前套用的 outfit key（避免重複上貼圖） */
  outfitKey?: string;
};

export type PlayerLook = { shirt: number; hair: number; pants?: number };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _d = new THREE.Vector3(), _e = new THREE.Vector3(), _side = new THREE.Vector3();
const _mid = new THREE.Vector3(), _handL = new THREE.Vector3();
const _q = new THREE.Quaternion(), _pw = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

/** 方塊臂段：中點放在 from–to，+Y 對準連線 */
function placeSeg(seg: THREE.Group, fromW: THREE.Vector3, toW: THREE.Vector3, parent: THREE.Object3D) {
  const len = Math.max(0.04, fromW.distanceTo(toW));
  _mid.copy(fromW).add(toW).multiplyScalar(0.5);
  parent.worldToLocal(_mid);
  seg.position.copy(_mid);
  _d.copy(toW).sub(fromW);
  if (_d.lengthSq() < 1e-8) return;
  _d.normalize();
  _q.setFromUnitVectors(_up, _d);
  parent.getWorldQuaternion(_pw);
  seg.quaternion.copy(_pw).invert().multiply(_q);
  const base = (seg.userData.restLen as number) || 0.28;
  seg.scale.set(1, len / base, 1);
}

function bendArm(
  upper: THREE.Group,
  lower: THREE.Group,
  shoulderW: THREE.Vector3,
  handW: THREE.Vector3,
  sideSign: number,
  bend: number,
  parent: THREE.Object3D,
) {
  _d.copy(handW).sub(shoulderW);
  const span = _d.length() || 0.01;
  _d.multiplyScalar(1 / span);
  _side.crossVectors(_d, _up);
  if (_side.lengthSq() < 1e-6) _side.set(sideSign, 0, 0);
  else _side.normalize().multiplyScalar(sideSign);
  _e.copy(shoulderW).lerp(handW, 0.48).addScaledVector(_side, bend * Math.min(1, span / 0.45));
  placeSeg(upper, shoulderW, _e, parent);
  placeSeg(lower, _e, handW, parent);
}

/**
 * 方塊人：RoundedBox＋折角平滑法線；持槍＝槍上手＋肩→肘→手對準（骨架／縮放不變）。
 */
export function makePlayerAvatar(
  look: PlayerLook,
  M: MatFn,
  add: MeshAdd,
  _LO: boolean,
): PlayerRig {
  const boxy = { flatShading: false as const, roughness: 0.78 };
  const outer = new THREE.Group();
  const root = new THREE.Group(); outer.add(root);

  const skinM = M(SKIN, boxy);
  const shirtM = M(look.shirt, boxy);
  const sleeveM = M(look.shirt, boxy);
  const pantsM = M(look.pants ?? 0x3a5068, boxy);
  const hairM = M(look.hair, boxy);
  const shoeM = M(0x333333, boxy);
  const soleM = M(0xf6f2ea, boxy);

  const torso = new THREE.Group(); torso.position.set(0, 0.92, 0); root.add(torso);
  add(rbox(0.38, 0.48, 0.22), shirtM, [0, 0.12, 0], torso);
  add(rbox(0.4, 0.1, 0.24), pantsM, [0, -0.16, 0], torso);
  add(rbox(0.12, 0.08, 0.12), skinM, [0, 0.4, 0], torso);

  const head = new THREE.Group(); head.position.set(0, 0.58, 0); torso.add(head);
  add(rbox(0.28, 0.28, 0.28), skinM, [0, 0, 0], head);
  add(rbox(0.3, 0.12, 0.3), hairM, [0, 0.1, 0.01], head);
  add(rbox(0.3, 0.18, 0.08), hairM, [0, 0.02, 0.12], head);
  for (const s of [-1, 1]) add(rbox(0.05, 0.05, 0.04), M(0x111111, boxy), [s * 0.07, 0.02, -0.14], head);
  add(rbox(0.1, 0.03, 0.03), M(0xa04040, boxy), [0, -0.08, -0.14], head);
  const hatG = new THREE.Group(); head.add(hatG);

  const shoulderL = new THREE.Object3D(); shoulderL.position.set(-0.22, 0.3, 0); torso.add(shoulderL);
  const shoulderR = new THREE.Object3D(); shoulderR.position.set(0.22, 0.3, 0); torso.add(shoulderR);

  // 槍架：抵肩瞄準角度（槍口 -Z）
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.05, 0.12, -0.2);
  weaponMount.rotation.set(0.12, 0.15, 0.18);
  torso.add(weaponMount);

  // 方塊手黏在握把／護木（跟槍一起動）
  const handR = new THREE.Group();
  handR.position.set(0.03, -0.05, 0.1);
  weaponMount.add(handR);
  add(rbox(0.09, 0.09, 0.1), skinM, [0, 0, 0], handR);

  const handL = new THREE.Group();
  handL.position.set(-0.02, 0.0, -0.2);
  weaponMount.add(handL);
  add(rbox(0.09, 0.09, 0.1), skinM, [0, 0, 0], handL);

  const mkSeg = (len: number, mat: THREE.MeshStandardMaterial, thick: number) => {
    const g = new THREE.Group();
    g.userData.restLen = len;
    torso.add(g);
    add(rbox(thick, len, thick), mat, [0, 0, 0], g);
    return g;
  };
  const upperR = mkSeg(0.26, sleeveM, 0.1);
  const lowerR = mkSeg(0.24, skinM, 0.09);
  const upperL = mkSeg(0.26, sleeveM, 0.1);
  const lowerL = mkSeg(0.24, skinM, 0.09);

  const makeLeg = (side: number) => {
    const thigh = new THREE.Group(); thigh.position.set(side * 0.11, 0.72, 0); root.add(thigh);
    add(rbox(0.14, 0.34, 0.14), pantsM, [0, -0.15, 0], thigh);
    const shin = new THREE.Group(); shin.position.set(0, -0.34, 0); thigh.add(shin);
    add(rbox(0.13, 0.32, 0.13), pantsM, [0, -0.14, 0], shin);
    add(rbox(0.14, 0.08, 0.22), shoeM, [0, -0.32, -0.03], shin);
    add(rbox(0.145, 0.03, 0.24), soleM, [0, -0.36, -0.03], shin);
    return { thigh, shin };
  };
  const legL = makeLeg(-1), legR = makeLeg(1);

  const rig: PlayerRig = {
    outer, root, torso, head, hatG,
    legL: legL.thigh, legR: legR.thigh, shinL: legL.shin, shinR: legR.shin,
    weaponMount, shoulderL, shoulderR,
    upperL, lowerL, upperR, lowerR, handL, handR,
    outfitMats: {
      body: [shirtM],
      sleeve: [sleeveM],
      legs: [pantsM],
      feet: [shoeM, soleM],
      hair: [hairM],
    },
  };
  syncHoldArms(rig, 0);
  return rig;
}

const _hangDir = new THREE.Vector3();
const _hangX = new THREE.Vector3();
const _hangZ = new THREE.Vector3();
const _hangMat = new THREE.Matrix4();

/** 臂段沿 +Y；固定 restLen，只跟方向（廣場不持槍垂臂／擺臂用） */
function placePlazaArmSeg(seg: THREE.Group, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  if (!seg) return;
  const base = (seg.userData.restLen as number) || 0.26;
  _hangDir.set(bx - ax, by - ay, bz - az);
  const raw = _hangDir.length();
  if (raw < 1e-6) {
    seg.position.set(ax, ay - base * 0.5, az);
    seg.quaternion.identity();
    seg.scale.set(1, 1, 1);
    return;
  }
  _hangDir.multiplyScalar(1 / raw);
  seg.position.set(ax + _hangDir.x * base * 0.5, ay + _hangDir.y * base * 0.5, az + _hangDir.z * base * 0.5);
  // 勿用 setFromUnitVectors(+Y→臂)：近垂直時扭轉會跳，第三人稱看自己上臂像過度旋轉
  // local +Y＝臂向；+X 鎖向軀幹右側投影，扭轉連續
  _hangX.set(1, 0, 0);
  _hangX.addScaledVector(_hangDir, -_hangX.dot(_hangDir));
  if (_hangX.lengthSq() < 1e-8) {
    _hangX.set(0, 0, 1);
    _hangX.addScaledVector(_hangDir, -_hangX.dot(_hangDir));
  }
  _hangX.normalize();
  _hangZ.crossVectors(_hangX, _hangDir).normalize();
  _hangX.crossVectors(_hangDir, _hangZ).normalize();
  _hangMat.makeBasis(_hangX, _hangDir, _hangZ);
  seg.quaternion.setFromRotationMatrix(_hangMat);
  seg.scale.set(1, 1, 1);
}

export function placePlazaArmChain(
  upper: THREE.Group, lower: THREE.Group,
  shx: number, shy: number, shz: number,
  elx: number, ely: number, elz: number,
  wrx: number, wry: number, wrz: number,
) {
  const uLen = (upper.userData.restLen as number) || 0.26;
  const lLen = (lower.userData.restLen as number) || 0.24;
  _hangDir.set(elx - shx, ely - shy, elz - shz);
  if (_hangDir.lengthSq() < 1e-8) _hangDir.set(0, -1, 0); else _hangDir.normalize();
  const e2x = shx + _hangDir.x * uLen, e2y = shy + _hangDir.y * uLen, e2z = shz + _hangDir.z * uLen;
  placePlazaArmSeg(upper, shx, shy, shz, e2x, e2y, e2z);
  _hangDir.set(wrx - e2x, wry - e2y, wrz - e2z);
  if (_hangDir.lengthSq() < 1e-8) _hangDir.set(0, -1, 0); else _hangDir.normalize();
  placePlazaArmSeg(lower, e2x, e2y, e2z, e2x + _hangDir.x * lLen, e2y + _hangDir.y * lLen, e2z + _hangDir.z * lLen);
}

/** 廣場：藏槍架，臂自然下垂（sit＝坐姿略前伸） */
export function posePlazaHangArms(rig: PlayerRig, sit = false) {
  rig.weaponMount.visible = false;
  rig.handL.visible = false;
  rig.handR.visible = false;
  rig.shoulderL.rotation.set(0, 0, 0);
  if (rig.shoulderR) rig.shoulderR.rotation.set(0, 0, 0);
  const hang = (upper: THREE.Group, lower: THREE.Group, side: number) => {
    const shx = side * 0.22, shy = 0.30, shz = 0;
    const uFwd = sit ? 0.42 : 0.1;
    const lFwd = sit ? 0.55 : 0.22;
    const out = side * (sit ? 0.06 : 0.04);
    const elbowX = shx + out;
    const elbowY = shy - (sit ? 0.22 : 0.24);
    const elbowZ = shz - uFwd;
    const wristX = elbowX + out * 0.5;
    const wristY = elbowY - (sit ? 0.16 : 0.2);
    const wristZ = elbowZ - (lFwd - uFwd);
    placePlazaArmChain(upper, lower, shx, shy, shz, elbowX, elbowY, elbowZ, wristX, wristY, wristZ);
  };
  hang(rig.upperL, rig.lowerL, -1);
  hang(rig.upperR, rig.lowerR, 1);
}

/**
 * 廣場走路腿部：跨步＋膝蓋彎曲（避免筆直無膝）。
 * @param ph 相位（弧度）
 * @param amp 0..1 移動幅度
 * @returns stride（給擺臂用，左腿前為正）
 */
export function posePlazaWalkCycle(rig: PlayerRig, ph: number, amp: number): number {
  const a = Math.min(1, Math.max(0, amp));
  const stride = Math.sin(ph) * a;
  const stride2 = Math.sin(ph * 2);
  // 大腿跨步（幅度收斂，減少晃）
  rig.legL.rotation.x = stride * 0.5;
  rig.legR.rotation.x = -stride * 0.5;
  // 膝蓋：shin 負向才是向前彎（與蹲姿／坐姿同號）；後腿抬起時多彎
  const baseKnee = 0.04 + 0.04 * a;
  const liftL = Math.max(0, -Math.sin(ph)) * 0.4 * a;
  const liftR = Math.max(0, Math.sin(ph)) * 0.4 * a;
  rig.shinL.rotation.x = -(baseKnee + liftL);
  rig.shinR.rotation.x = -(baseKnee + liftR);
  // 身體輕顛＋輕扭（壓低避免「整個人在晃」）
  rig.root.position.y = Math.abs(stride2) * 0.018 * a;
  rig.torso.rotation.y = stride * 0.05;
  rig.torso.rotation.z = stride * -0.03;
  rig.torso.rotation.x = -0.02 * a;
  return stride;
}

/** 廣場跳躍時間軸：先微蹲再起飛（本機／遠端共用） */
export const PLAZA_JUMP_CROUCH = 0.14;
export const PLAZA_JUMP_AIR = 0.55;
export const PLAZA_JUMP_DUR = PLAZA_JUMP_CROUCH + PLAZA_JUMP_AIR;
export const PLAZA_JUMP_H = 0.8;
export const PLAZA_JUMP_DIP = 0.14;

/** 跳躍經過秒數 → 高度（負＝蹲壓） */
export function plazaJumpHeight(elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed < PLAZA_JUMP_CROUCH) {
    const c = elapsed / PLAZA_JUMP_CROUCH;
    return -PLAZA_JUMP_DIP * Math.sin(c * Math.PI * 0.5);
  }
  const u = Math.min(1, (elapsed - PLAZA_JUMP_CROUCH) / PLAZA_JUMP_AIR);
  // u=0 接續蹲底；中段到峰值；落地歸零
  return -PLAZA_JUMP_DIP * (1 - u) * (1 - u) + 4 * PLAZA_JUMP_H * u * (1 - u);
}

/** 跳躍腿／臂姿勢：蹲壓彎膝，起飛伸展＋手臂上揚 */
export function posePlazaJump(rig: PlayerRig, elapsed: number) {
  const total = PLAZA_JUMP_DUR;
  if (elapsed <= 0 || elapsed >= total) return;
  if (elapsed < PLAZA_JUMP_CROUCH) {
    const c = elapsed / PLAZA_JUMP_CROUCH;
    const k = Math.sin(c * Math.PI * 0.5);
    rig.legL.rotation.x = 0.55 * k;
    rig.legR.rotation.x = 0.55 * k;
    // shin 負向＝膝蓋向前彎（同蹲姿）
    rig.shinL.rotation.x = -(0.12 + 1.15 * k);
    rig.shinR.rotation.x = -(0.12 + 1.15 * k);
    rig.torso.rotation.x = 0.25 * k;
    rig.root.position.y = 0;
    const a = -0.35 * k;
    rig.shoulderL.rotation.x = a;
    if (rig.shoulderR) rig.shoulderR.rotation.x = a;
  } else {
    const u = (elapsed - PLAZA_JUMP_CROUCH) / PLAZA_JUMP_AIR;
    // 起飛伸腿，落地前略收
    const stretch = Math.sin(Math.min(1, u / 0.35) * Math.PI * 0.5);
    const land = u > 0.75 ? (u - 0.75) / 0.25 : 0;
    const thigh = -0.15 * stretch + 0.4 * land;
    const knee = -(0.1 * (1 - stretch) + 0.55 * land);
    rig.legL.rotation.x = thigh;
    rig.legR.rotation.x = thigh;
    rig.shinL.rotation.x = knee;
    rig.shinR.rotation.x = knee;
    rig.torso.rotation.x = -0.08 * stretch + 0.15 * land;
    rig.root.position.y = 0;
    const a = -2.2 * Math.sin(Math.min(1, u) * Math.PI);
    rig.shoulderL.rotation.x = a;
    if (rig.shoulderR) rig.shoulderR.rotation.x = a;
  }
}

/**
 * 廣場走路擺臂：輕微ㄑ字彎肘（勿抬肘／前臂近水平），與腿反向擺。
 * swing>0＝左腿前→右臂較前；前＝負 Z。
 */
export function posePlazaWalkSwingArms(rig: PlayerRig, swing: number) {
  rig.weaponMount.visible = false;
  rig.handL.visible = false;
  rig.handR.visible = false;
  rig.shoulderL.rotation.set(0, 0, 0);
  if (rig.shoulderR) rig.shoulderR.rotation.set(0, 0, 0);
  const amp = 0.2;
  // fwd>0＝該臂較往前
  const fwdL = -swing * amp;
  const fwdR = swing * amp;
  const hangSwing = (upper: THREE.Group, lower: THREE.Group, side: number, fwd: number) => {
    const shx = side * 0.22, shy = 0.30, shz = 0;
    const out = side * 0.05;
    // 肘略低：上臂自然下垂再輕彎，避免誇張抬肘
    const elbowX = shx + out;
    const elbowY = shy - 0.21;
    const elbowZ = shz - fwd * 0.55;
    // 腕再往下並略前 → 彎肘再收一點
    const wristX = elbowX + out * 0.25;
    const wristY = elbowY - 0.14;
    const wristZ = elbowZ - 0.09;
    placePlazaArmChain(upper, lower, shx, shy, shz, elbowX, elbowY, elbowZ, wristX, wristY, wristZ);
  };
  hangSwing(rig.upperL, rig.lowerL, -1, fwdL);
  hangSwing(rig.upperR, rig.lowerR, 1, fwdR);
}

/** 持槍：手黏槍，臂段每幀對準（外彎肘） */
export function syncHoldArms(rig: PlayerRig, kick = 0) {
  const k = kick;
  rig.weaponMount.position.set(0.05 + k * 0.01, 0.12 + k * 0.03, -0.2 + k * 0.04);
  rig.weaponMount.rotation.set(0.12 + k * 0.28, 0.15, 0.18);
  // 護木手略前移一點，托槍更清楚
  rig.handR.position.set(0.03, -0.05, 0.1);
  rig.handL.position.set(-0.02, 0.02, -0.22);

  rig.handL.visible = true;
  rig.handR.visible = true;
  rig.upperL.visible = rig.lowerL.visible = rig.upperR.visible = rig.lowerR.visible = true;

  rig.torso.updateWorldMatrix(true, true);
  rig.shoulderR.getWorldPosition(_a);
  rig.handR.getWorldPosition(_b);
  rig.shoulderL.getWorldPosition(_c);
  rig.handL.getWorldPosition(_handL);

  bendArm(rig.upperR, rig.lowerR, _a, _b, 1, 0.14, rig.torso);
  bendArm(rig.upperL, rig.lowerL, _c, _handL, -1, 0.16, rig.torso);
}

/** 撐傘：右臂上舉、左臂下垂 */
export function poseUmbArms(rig: PlayerRig) {
  rig.handL.visible = rig.handR.visible = false;
  rig.torso.updateWorldMatrix(true, true);
  rig.shoulderR.getWorldPosition(_a);
  rig.shoulderL.getWorldPosition(_c);
  _b.copy(_a).add(_d.set(0.05, 0.45, -0.15));
  _handL.copy(_c).add(_e.set(-0.05, -0.4, 0.05));
  bendArm(rig.upperR, rig.lowerR, _a, _b, 1, 0.08, rig.torso);
  bendArm(rig.upperL, rig.lowerL, _c, _handL, -1, 0.06, rig.torso);
}

export function poseAimArms(rig: PlayerRig, kick = 0) {
  syncHoldArms(rig, kick);
}

/** 攤位老闆：在攤台上忙（雙手前伸小幅畫圈），偶爾舉右手招呼客人 */
export function posePlazaStallKeeper(rig: PlayerRig, t: number, ph: number) {
  rig.weaponMount.visible = false;
  rig.handL.visible = false;
  rig.handR.visible = false;
  const cyc = (t + ph) % 12;
  const wave = cyc > 9 ? Math.sin(((cyc - 9) / 3) * Math.PI) : 0; // 0..1..0
  const work = (side: number, k: number) => {
    const shx = side * 0.22, shy = 0.3;
    const a = t * 2.2 + ph + k;
    const elbowX = shx + side * 0.08, elbowY = shy - 0.2, elbowZ = -0.16;
    const wristX = side * 0.12 + Math.cos(a) * 0.05;
    const wristY = shy - 0.24 + Math.sin(a * 1.3) * 0.03;
    const wristZ = -0.36 + Math.sin(a) * 0.04;
    return [shx, shy, 0, elbowX, elbowY, elbowZ, wristX, wristY, wristZ] as const;
  };
  const L = work(-1, 0);
  placePlazaArmChain(rig.upperL, rig.lowerL, ...L);
  const R = work(1, Math.PI);
  if (wave > 0) {
    const sw = Math.sin(t * 9) * 0.06 * wave;
    const lift = (v: number, to: number) => v + (to - v) * wave;
    placePlazaArmChain(rig.upperR, rig.lowerR, R[0], R[1], R[2],
      lift(R[3], 0.34), lift(R[4], 0.36), lift(R[5], -0.08),
      lift(R[6], 0.32 + sw), lift(R[7], 0.62), lift(R[8], -0.12));
  } else placePlazaArmChain(rig.upperR, rig.lowerR, ...R);
  rig.head.rotation.y = Math.sin(t * 0.4 + ph) * 0.3;
}
/** 廣場蹲／躺姿勢：k 0..1 平滑；在擺臂之後呼叫（outer.rotation.order 需為 YXZ） */
export function applyPlazaBodyPose(rig: PlayerRig, pose: string, k: number) {
  if (k <= 0.001) { (rig as any).torso && Math.abs((rig as any).torso.rotation.x) < 0.4 && pose === 'crouch' && ((rig as any).torso.rotation.x = 0); return; }
  const r: any = rig;
  if (pose === 'lie') { (rig as any).torso && ((rig as any).torso.rotation.x = 0);
    rig.outer.rotation.x = Math.PI / 2 * k;
    rig.outer.position.y += 0.16 * k;
    rig.legL.rotation.x *= 1 - k; rig.legR.rotation.x *= 1 - k;
    r.shinL && (r.shinL.rotation.x *= 1 - k); r.shinR && (r.shinR.rotation.x *= 1 - k);
    rig.shoulderL.rotation.x = rig.shoulderL.rotation.x * (1 - k) - 2.6 * k;
    r.shoulderR && (r.shoulderR.rotation.x = r.shoulderR.rotation.x * (1 - k) - 2.6 * k);
  } else {
    rig.outer.position.y -= 0.4 * k; (rig as any).torso && ((rig as any).torso.rotation.x = -0.35 * k);
    rig.legL.rotation.x = rig.legL.rotation.x * (1 - 0.4 * k) + 1.55 * k;
    rig.legR.rotation.x = rig.legR.rotation.x * (1 - 0.4 * k) + 1.55 * k;
    r.shinL && (r.shinL.rotation.x = r.shinL.rotation.x * (1 - k) - 2.3 * k);
    r.shinR && (r.shinR.rotation.x = r.shinR.rotation.x * (1 - k) - 2.3 * k);
  }
}

/** 與 plaza/worldView 坐姿對齊：椅面 0.42、髖略抬 0.14 */
export const PLAZA_CHAIR_SEAT_Y = 0.42;
export const PLAZA_SIT_HIP_LIFT = 0.14;
const PLAZA_HIP_Y = 0.72;
const PLAZA_TORSO_Y = 0.92;
export const PLAZA_SIT_ROOT_Y = (PLAZA_CHAIR_SEAT_Y + PLAZA_SIT_HIP_LIFT) - PLAZA_HIP_Y;

/** 廣場坐下：同站立 avatar，只改腿／髖／臂（與遠端 poseSit 相同） */
export function posePlazaSit(rig: PlayerRig) {
  posePlazaHangArms(rig, true);
  rig.outer.scale.setScalar(1);
  rig.root.scale.set(1, 1, 1);
  rig.root.position.y = PLAZA_SIT_ROOT_Y;
  rig.legL.scale.set(1, 1, 1);
  rig.legR.scale.set(1, 1, 1);
  rig.shinL.scale.set(1, 1, 1);
  rig.shinR.scale.set(1, 1, 1);
  rig.torso.scale.set(1, 1, 1);
  rig.legL.rotation.set(1.25, 0.06, 0.08);
  rig.legR.rotation.set(1.25, -0.06, -0.08);
  rig.shinL.rotation.set(-1.35, 0, 0);
  rig.shinR.rotation.set(-1.35, 0, 0);
  rig.torso.rotation.x = -0.06;
  rig.torso.position.y = PLAZA_TORSO_Y - 0.02;
  rig.head.rotation.y = 0;
  rig.head.rotation.x = 0;
}

/** 廣場站立預設（清掉坐姿） */
export function posePlazaStand(rig: PlayerRig) {
  posePlazaHangArms(rig, false);
  rig.outer.scale.setScalar(1);
  rig.root.scale.set(1, 1, 1);
  rig.root.position.set(0, 0, 0);
  rig.legL.rotation.set(0, 0, 0);
  rig.legR.rotation.set(0, 0, 0);
  rig.shinL.rotation.set(0, 0, 0);
  rig.shinR.rotation.set(0, 0, 0);
  rig.legL.scale.set(1, 1, 1);
  rig.legR.scale.set(1, 1, 1);
  rig.shinL.scale.set(1, 1, 1);
  rig.shinR.scale.set(1, 1, 1);
  rig.torso.scale.set(1, 1, 1);
  rig.torso.rotation.x = 0;
  rig.torso.position.y = PLAZA_TORSO_Y;
}

/** 吸菸區坐下：右手近嘴（與遠端 smoke phase 相同） */
export function posePlazaSmokeSit(rig: PlayerRig) {
  posePlazaSit(rig);
  placePlazaArmChain(rig.upperL, rig.lowerL, -0.22, 0.28, 0, -0.18, 0.12, -0.12, -0.14, 0.06, -0.22);
  placePlazaArmChain(rig.upperR, rig.lowerR, 0.22, 0.32, 0, 0.08, 0.42, -0.12, 0.04, 0.52, -0.2);
  if (rig.head) rig.head.rotation.x = -0.04;
}
