/**
 * 鏡頭靠近時暫時藏起頭模型，避免切視角時人頭貼在畫面裡。
 * 也提供「湊近臉」特效的水平位置：頭只從畫面兩側探出，不衝進中間。
 */
import * as THREE from 'three';

export const CAM_HEAD_FADE_DIST = 0.5;

const camPos = new THREE.Vector3();
const headPos = new THREE.Vector3();
/** 被本模組藏起的頭 → 藏之前的 visible */
const hidden = new Map<THREE.Object3D, boolean>();

/** 湊近臉特效：畫面外停點、探入時的水平距離（相機座標 +X） */
export function leanFacePeekX(fovDeg: number, aspect: number, z = 0.75): { restX: number; peekX: number } {
  const halfW = Math.max(0.01, z) * Math.tan((fovDeg * Math.PI / 180) / 2) * Math.max(0.1, aspect);
  const narrow = aspect < 0.8;
  return {
    restX: halfW + 0.3,
    // 直向略探入、橫向貼齊畫面邊緣，避免兩顆頭占滿左右
    peekX: (narrow ? 0.9 : 0.88) * halfW,
  };
}

export function tickCamHeadFade(
  camera: THREE.Camera,
  heads: Iterable<THREE.Object3D | null | undefined>,
  enabled: boolean,
) {
  const want = new Set<THREE.Object3D>();
  if (enabled) {
    camera.getWorldPosition(camPos);
    if ([camPos.x, camPos.y, camPos.z].every(Number.isFinite)) {
      for (const h of heads) {
        if (!h) continue;
        if (!h.visible && !hidden.has(h)) continue;
        h.getWorldPosition(headPos);
        if (![headPos.x, headPos.y, headPos.z].every(Number.isFinite)) continue;
        if (headPos.distanceTo(camPos) < CAM_HEAD_FADE_DIST) want.add(h);
      }
    }
  }
  for (const [h, was] of [...hidden]) {
    if (want.has(h)) continue;
    try { if (h.visible === false) h.visible = was; } catch { /* */ }
    hidden.delete(h);
  }
  for (const h of want) {
    if (!hidden.has(h)) hidden.set(h, h.visible);
    h.visible = false;
  }
}

export function clearCamHeadFade() {
  for (const [h, was] of hidden) {
    try { if (h.visible === false) h.visible = was; } catch { /* */ }
  }
  hidden.clear();
}
