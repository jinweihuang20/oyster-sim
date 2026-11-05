import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BufferGeometry } from 'three';
import * as THREE from 'three';

/**
 * 圓角方塊：尺寸／比例不變，僅替換 BoxGeometry 並自動平滑折角法線。
 * segments 低以保持 low-poly 體量、不重算骨架。
 */
export function rbox(w: number, h: number, d: number, segments = 2, radiusRatio = 0.14): BufferGeometry {
  const m = Math.min(w, h, d);
  const radius = Math.min(m * radiusRatio, m * 0.42);
  return toCreasedNormals(new RoundedBoxGeometry(w, h, d, segments, radius));
}

/** 既有幾何套用折角平滑法線（不改頂點位置／縮放） */
export function crease(g: BufferGeometry, angle = Math.PI / 3): BufferGeometry {
  return toCreasedNormals(g, angle);
}

export function rcyl(
  rt: number, rb: number, h: number, seg = 8,
  openEnded = false,
): BufferGeometry {
  return crease(new THREE.CylinderGeometry(rt, rb, h, seg, 1, openEnded));
}
