import * as THREE from 'three';
import type { MatFn, MeshAdd } from './weapons';
import { rbox } from '../geo';

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
