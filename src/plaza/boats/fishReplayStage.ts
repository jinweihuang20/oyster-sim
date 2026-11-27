/**
 * 精彩回放的「舞台」（CR-32）：回放照當時錄下的世界座標重播，跟現在的人／船完全分開。
 * - 人：暫時掛到回放舞台（場景底下的空 Group），矩陣直接用錄到的世界座標＋朝向擺；
 *   現場系統每幀照樣寫 position／rotation（船上座位、岸上走路），只是回放期間不拿來畫，
 *   結束時掛回原本的爸爸、恢復自動矩陣，下一幀就是現場的樣子（不會瞬移、不會改到同步）。
 * - 船：當時在船上＝回放替身船照每一格錄到的船位置／船頭方向／傾斜走（船在開也照當時的路線）；岸上＝不出現。
 * - 現場的其他玩家／船：回放期間藏起來，結束時照原本的可見度還原（重複呼叫、提早結束都安全）。
 * 每幀不配置（暫存物件都是模組層級共用）。
 */
import * as THREE from 'three';
import { RF } from './fishReplay';

/** 這一格錄到的人＋船（世界座標） */
export type RpPlace = {
  x: number; y: number; z: number; yaw: number;
  boat: boolean; bx: number; by: number; bz: number; bh: number; brx: number; brz: number;
};
export const newRpPlace = (): RpPlace => ({ x: 0, y: 0, z: 0, yaw: 0, boat: false, bx: 0, by: 0, bz: 0, bh: 0, brx: 0, brz: 0 });
const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
/** 從回放格讀出當時的人／船世界座標（只看錄到的數字，不看現在的人或船） */
export function rpPlaceOf(fr: ArrayLike<number>, out: RpPlace): RpPlace {
  out.x = fin(fr[RF.px]); out.y = fin(fr[RF.py]); out.z = fin(fr[RF.pz]); out.yaw = fin(fr[RF.pyaw]);
  out.boat = fr[RF.boat] > 0.5;
  out.bx = fin(fr[RF.bx]); out.by = fin(fr[RF.by]); out.bz = fin(fr[RF.bz]); out.bh = fin(fr[RF.bh]);
  out.brx = fin(fr[RF.brx]); out.brz = fin(fr[RF.brz]);
  return out;
}

const _q = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
/**
 * 人在回放裡的世界姿勢：位置＝錄到的人；朝向＝錄到的 yaw。
 * 在船上：先套當時船的傾斜（rx, h, rz，跟船模型同一個順序），再轉人相對船頭的角度，人會跟替身船一起晃。
 */
export function rpRigQuat(p: RpPlace, out: THREE.Quaternion) {
  if (p.boat) {
    _e.set(p.brx, p.bh, p.brz); out.setFromEuler(_e);
    _qy.setFromAxisAngle(_y, p.yaw - p.bh);
    return out.multiply(_qy);
  }
  return out.setFromAxisAngle(_y, p.yaw);
}
/** 替身船擺到當時那一格（位置、船頭、傾斜） */
export function rpPlaceBoat(boat: THREE.Object3D, p: RpPlace) {
  boat.visible = p.boat;
  if (!p.boat) return false;
  boat.position.set(p.bx, p.by, p.bz);
  boat.rotation.set(p.brx, p.bh, p.brz);
  return true;
}

// ---------------- 人：暫時掛到回放舞台 ----------------
export type RigStash = {
  obj: THREE.Object3D | null;
  /** 原本（現場）的爸爸、原本有沒有自動矩陣 */
  parent: THREE.Object3D | null;
  auto: boolean;
  on: boolean;
};
export const newRigStash = (): RigStash => ({ obj: null, parent: null, auto: true, on: false });
/**
 * 接手：掛到舞台（position／rotation 欄位原封不動，現場系統照常寫）、關掉自動矩陣。
 * 已經接手了＝只檢查有沒有被別人搶走（上下船會把人掛到別的地方）：被搶就記下新爸爸、再掛回舞台。
 */
export function rigStage(st: RigStash, obj: THREE.Object3D, stage: THREE.Object3D) {
  if (st.on && st.obj !== obj) rigRestore(st, stage);
  if (!st.on) { st.obj = obj; st.parent = obj.parent; st.auto = obj.matrixAutoUpdate; st.on = true; }
  else if (obj.parent !== stage) st.parent = obj.parent;
  if (obj.parent !== stage) stage.add(obj);
  obj.matrixAutoUpdate = false;
  return st;
}
/** 這一幀的世界姿勢（舞台在原點、不縮放：矩陣＝世界） */
export function rigPlace(obj: THREE.Object3D, p: RpPlace) {
  rpRigQuat(p, _q);
  _p.set(p.x, p.y, p.z);
  obj.matrix.compose(_p, _q, obj.scale);
  obj.matrixWorldNeedsUpdate = true;
  obj.updateWorldMatrix(false, false);
}
/** 還原：還在舞台上＝掛回原本的爸爸；已經被別人搬走＝留在那裡。恢復自動矩陣（重複呼叫沒事） */
export function rigRestore(st: RigStash, stage: THREE.Object3D) {
  if (!st.on) return false;
  const o = st.obj!;
  if (o.parent === stage) { if (st.parent) st.parent.add(o); else stage.remove(o); }
  o.matrixAutoUpdate = st.auto;
  if (o.matrixAutoUpdate) o.updateMatrix();
  o.matrixWorldNeedsUpdate = true;
  st.obj = null; st.parent = null; st.on = false;
  return true;
}

// ---------------- 現場的人／船：先藏、再照原樣還原 ----------------
export type VisStash = { objs: THREE.Object3D[]; was: boolean[]; n: number };
export const newVisStash = (): VisStash => ({ objs: [], was: [], n: 0 });
/** 藏一個（同一個藏兩次只記第一次的原狀） */
export function visHide(s: VisStash, o: THREE.Object3D | null | undefined) {
  if (!o) return;
  for (let i = 0; i < s.n; i++) if (s.objs[i] === o) { o.visible = false; return; }
  s.objs[s.n] = o; s.was[s.n] = o.visible; s.n++;
  o.visible = false;
}
/** 全部照原本的可見度還原（沒藏過／還原過＝什麼都不做） */
export function visRestore(s: VisStash) {
  const n = s.n;
  for (let i = 0; i < n; i++) { s.objs[i].visible = s.was[i]; s.objs[i] = null!; }
  s.n = 0; s.objs.length = 0; s.was.length = 0;
  return n;
}
