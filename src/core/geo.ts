import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BufferGeometry } from 'three';
import * as THREE from 'three';

/** 手機／省電：方塊取代圓角、圓柱少段，降面數 */
let geoLo = false;
export function setGeoLowDetail(on: boolean) { geoLo = !!on; }
export function geoLowDetail() { return geoLo; }

/**
 * 圓角方塊（本機／遠端玩家）：一律保留圓角。
 * segments 低以保持 low-poly 體量、不重算骨架。
 */
export function rbox(w: number, h: number, d: number, segments = 2, radiusRatio = 0.14): BufferGeometry {
  const m = Math.min(w, h, d);
  const radius = Math.min(m * radiusRatio, m * 0.42);
  return toCreasedNormals(new RoundedBoxGeometry(w, h, d, segments, radius));
}

/** NPC 人物：與玩家一樣用圓角方塊 */
export function rboxNpc(w: number, h: number, d: number): BufferGeometry {
  return rbox(w, h, d);
}

/** 場景道具：一般 1 段圓角；手機／省電改純方塊降面（人物請用 rbox／rboxNpc） */
export function rboxEnv(w: number, h: number, d: number, radiusRatio = 0.13): BufferGeometry {
  if (geoLo) return new THREE.BoxGeometry(w, h, d);
  return rbox(w, h, d, 1, radiusRatio);
}

/** 既有幾何套用折角平滑法線（不改頂點位置／縮放） */
export function crease(g: BufferGeometry, angle = Math.PI / 3): BufferGeometry {
  return toCreasedNormals(g, angle);
}

export function rcyl(
  rt: number, rb: number, h: number, seg = 8,
  openEnded = false,
): BufferGeometry {
  const s = geoLo ? Math.min(seg, 5) : seg;
  return crease(new THREE.CylinderGeometry(rt, rb, h, s, 1, openEnded));
}
