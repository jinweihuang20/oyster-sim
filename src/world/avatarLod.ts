import * as THREE from 'three';
import type { PlayerRig } from '../dm/character';

/** 進入遠距簡模（公尺） */
export const AVATAR_LOD_ENTER = 10.5;
/** 回到完整模型（公尺）；與 ENTER 拉開避免來回閃爍 */
export const AVATAR_LOD_EXIT = 8.5;

const FLAG = '_avatarLod';
const SKIN = 0xe8bc98;

type LodMats = {
  body: THREE.MeshLambertMaterial;
  pants: THREE.MeshLambertMaterial;
  skin: THREE.MeshLambertMaterial;
  hair: THREE.MeshLambertMaterial;
  feet: THREE.MeshLambertMaterial;
};

type LodState = {
  on: boolean;
  mats: LodMats;
  parts: THREE.Mesh[];
};

function isDrawable(o: THREE.Object3D): o is THREE.Mesh | THREE.Sprite {
  return (o as THREE.Mesh).isMesh === true || (o as THREE.Sprite).isSprite === true;
}

function lambert(hex: number) {
  const m = new THREE.MeshLambertMaterial({ color: hex });
  m.userData.lodMesh = true;
  return m;
}

function addBox(
  parent: THREE.Object3D,
  w: number, h: number, d: number,
  mat: THREE.Material,
  pos: [number, number, number],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.userData.lodMesh = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

function srcColor(mats: THREE.MeshStandardMaterial[] | undefined, fallback: number) {
  const c = mats?.[0]?.color;
  return c ?? new THREE.Color(fallback);
}

function getState(rig: PlayerRig): LodState | undefined {
  return rig.outer.userData[FLAG] as LodState | undefined;
}

function refreshColors(rig: PlayerRig, st: LodState) {
  const om = rig.outfitMats;
  st.mats.body.color.copy(srcColor(om?.body, 0xc45c26));
  st.mats.pants.color.copy(srcColor(om?.legs, 0x2a2a40));
  st.mats.hair.color.copy(srcColor(om?.hair, 0x222222));
  st.mats.feet.color.copy(srcColor(om?.feet, 0x333333));
}

/** 建立掛在既有骨骼上的簡模，坐下／抱起時會跟著動 */
export function ensureAvatarLod(rig: PlayerRig) {
  if (getState(rig)) return;
  const mats: LodMats = {
    body: lambert(0xc45c26),
    pants: lambert(0x2a2a40),
    skin: lambert(SKIN),
    hair: lambert(0x222222),
    feet: lambert(0x333333),
  };
  const parts = [
    addBox(rig.torso, 0.38, 0.48, 0.22, mats.body, [0, 0.12, 0]),
    addBox(rig.torso, 0.4, 0.1, 0.24, mats.pants, [0, -0.16, 0]),
    addBox(rig.head, 0.28, 0.28, 0.28, mats.skin, [0, 0, 0]),
    addBox(rig.head, 0.3, 0.12, 0.3, mats.hair, [0, 0.1, 0.01]),
    addBox(rig.legL, 0.14, 0.34, 0.14, mats.pants, [0, -0.15, 0]),
    addBox(rig.legR, 0.14, 0.34, 0.14, mats.pants, [0, -0.15, 0]),
    addBox(rig.shinL, 0.13, 0.4, 0.13, mats.pants, [0, -0.18, 0]),
    addBox(rig.shinR, 0.13, 0.4, 0.13, mats.pants, [0, -0.18, 0]),
    addBox(rig.shinL, 0.15, 0.08, 0.22, mats.feet, [0, -0.36, -0.03]),
    addBox(rig.shinR, 0.15, 0.08, 0.22, mats.feet, [0, -0.36, -0.03]),
  ];
  const st: LodState = { on: false, mats, parts };
  refreshColors(rig, st);
  rig.outer.userData[FLAG] = st;
}

function captureAndHide(rig: PlayerRig) {
  rig.outer.traverse(obj => {
    if (!isDrawable(obj)) return;
    if (obj.userData.lodMesh) {
      obj.visible = true;
      return;
    }
    if (obj.userData._lodPrevVis === undefined) obj.userData._lodPrevVis = obj.visible;
    obj.visible = false;
  });
}

function restoreFull(rig: PlayerRig) {
  rig.outer.traverse(obj => {
    if (!isDrawable(obj)) return;
    if (obj.userData.lodMesh) {
      obj.visible = false;
      return;
    }
    if (obj.userData._lodPrevVis !== undefined) {
      obj.visible = obj.userData._lodPrevVis;
      delete obj.userData._lodPrevVis;
    }
  });
}

export function isAvatarLodOn(rig: PlayerRig) {
  return !!getState(rig)?.on;
}

export function setAvatarLod(rig: PlayerRig, on: boolean) {
  ensureAvatarLod(rig);
  const st = getState(rig)!;
  if (st.on === on) {
    if (on) {
      refreshColors(rig, st);
      captureAndHide(rig);
    }
    return;
  }
  st.on = on;
  refreshColors(rig, st);
  if (on) captureAndHide(rig);
  else restoreFull(rig);
}

/** 裝備變更後：更新簡模顏色，並把新加的配件一併藏起 */
export function syncAvatarLod(rig: PlayerRig) {
  const st = getState(rig);
  if (!st) return;
  refreshColors(rig, st);
  if (!st.on) return;
  // 先恢復再重抓，避免把「藏起中」當成裝備本來的可見狀態
  restoreFull(rig);
  st.on = true;
  captureAndHide(rig);
}

/** 遠距用滯後切換；enabled=false 時強制回完整模型 */
export function applyAvatarDistanceLod(rig: PlayerRig, dist: number, enabled: boolean) {
  if (!enabled) {
    if (getState(rig)?.on) setAvatarLod(rig, false);
    return;
  }
  const on = !!getState(rig)?.on;
  if (!on && dist >= AVATAR_LOD_ENTER) setAvatarLod(rig, true);
  else if (on && dist <= AVATAR_LOD_EXIT) setAvatarLod(rig, false);
  else if (on) setAvatarLod(rig, true);
}
