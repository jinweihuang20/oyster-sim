import * as THREE from 'three';

export const PILE_COUNT = 16;
export const SLOTS_PER_PILE = 4;
export const PLAZA_CAPACITY = PILE_COUNT * SLOTS_PER_PILE;
export const PILE_SPACING = 5.2;
export const SEAT_RADIUS = 1.55;

/** 4×4 蚵仔堆中心 */
export function pileCenter(pileId: number, out = new THREE.Vector3()) {
  const r = Math.floor(pileId / 4), c = pileId % 4;
  return out.set((c - 1.5) * PILE_SPACING, 0, (r - 1.5) * PILE_SPACING);
}

/** 一堆四座：朝堆心 */
export function seatPose(pileId: number, slot: number) {
  const center = pileCenter(pileId);
  const a = slot * (Math.PI / 2) + Math.PI / 4;
  const pos = new THREE.Vector3(
    center.x + Math.sin(a) * SEAT_RADIUS,
    0,
    center.z + Math.cos(a) * SEAT_RADIUS,
  );
  // 面向堆心
  const yaw = Math.atan2(center.x - pos.x, center.z - pos.z);
  return { pos, yaw, center, angle: a };
}

export function seatKey(pileId: number, slot: number) {
  return `${pileId}:${slot}`;
}
