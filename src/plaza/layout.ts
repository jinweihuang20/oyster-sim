import * as THREE from 'three';

export const PILE_COUNT = 16;
export const SLOTS_PER_PILE = 4;
export const PLAZA_CAPACITY = PILE_COUNT * SLOTS_PER_PILE;
export const PILE_SPACING = 5.2;
export const SEAT_RADIUS = 1.55;
/** 廣場走動邊界（約蓋住 4×4 堆） */
export const WALK_BOUND = 11.5;
export const SIT_DIST = 1.15;

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
  // 相機／角色預設看向 -Z；yaw 使 -Z 對準堆心（atan2 用「位置相對堆心」）
  const yaw = Math.atan2(pos.x - center.x, pos.z - center.z);
  return { pos, yaw, center, angle: a };
}

export function seatKey(pileId: number, slot: number) {
  return `${pileId}:${slot}`;
}

export type PlazaSeatRef = { pileId: number; slot: number };

/** 找最近的空位（taken 為 `pile:slot`） */
export function nearestFreeSeat(x: number, z: number, taken: Set<string>, maxDist = SIT_DIST): (PlazaSeatRef & { dist: number }) | null {
  let best: (PlazaSeatRef & { dist: number }) | null = null;
  for (let p = 0; p < PILE_COUNT; p++) {
    for (let s = 0; s < SLOTS_PER_PILE; s++) {
      const k = seatKey(p, s);
      if (taken.has(k)) continue;
      const pose = seatPose(p, s);
      const d = Math.hypot(x - pose.pos.x, z - pose.pos.z);
      if (d > maxDist) continue;
      if (!best || d < best.dist) best = { pileId: p, slot: s, dist: d };
    }
  }
  return best;
}

/** 碰撞用：每堆一個圓（遮雨棚柱另見 plazaCanopySites） */
export function pileObstacles(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < PILE_COUNT; i++) {
    const c = pileCenter(i);
    out.push([c.x, c.z, 1.05]);
  }
  return out;
}
