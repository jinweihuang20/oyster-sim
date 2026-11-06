import * as THREE from 'three';

export const PILE_COUNT = 16;
export const SLOTS_PER_PILE = 4;
/** 每堆額外阿婆座位（slot = SLOTS_PER_PILE + npcSlot） */
export const NPC_SLOTS_PER_PILE = 2;
export const PLAZA_CAPACITY = PILE_COUNT * SLOTS_PER_PILE;
export const PILE_SPACING = 5.2;
/** 椅子離堆心距離（貼近蚵堆；身體靠 hangArms／後仰避免埋進堆裡） */
export const SEAT_RADIUS = 1.38;
/** 阿婆椅略外移，夾在玩家座位之間 */
export const NPC_SEAT_RADIUS = 1.52;
/** 廣場走動邊界（約蓋住 4×4 堆） */
export const WALK_BOUND = 11.5;
export const SIT_DIST = 1.15;

/** 4×4 蚵仔堆中心 */
export function pileCenter(pileId: number, out = new THREE.Vector3()) {
  const r = Math.floor(pileId / 4), c = pileId % 4;
  return out.set((c - 1.5) * PILE_SPACING, 0, (r - 1.5) * PILE_SPACING);
}

/** 四堆一盞：每個 2×2 區塊中心（與 PILE_SPACING 對齊） */
export const PLAZA_LAMP_XZ: readonly [number, number][] = [
  [-PILE_SPACING, -PILE_SPACING],
  [PILE_SPACING, -PILE_SPACING],
  [-PILE_SPACING, PILE_SPACING],
  [PILE_SPACING, PILE_SPACING],
];

/** 一堆座位：0–3 玩家、4–5 阿婆；皆朝堆心 */
export function seatPose(pileId: number, slot: number) {
  const center = pileCenter(pileId);
  const npc = slot >= SLOTS_PER_PILE;
  const a = npc
    ? (Math.max(0, slot - SLOTS_PER_PILE) % NPC_SLOTS_PER_PILE) * Math.PI
    : slot * (Math.PI / 2) + Math.PI / 4;
  const radius = npc ? NPC_SEAT_RADIUS : SEAT_RADIUS;
  const pos = new THREE.Vector3(
    center.x + Math.sin(a) * radius,
    0,
    center.z + Math.cos(a) * radius,
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

/**
 * 入場隨機站位：在走動界內、避開蚵堆圓，並朝廣場中心。
 * `extraObs` 可帶入棚柱等 `[x, z, radius]`。
 */
export function randomWalkSpawn(extraObs: [number, number, number][] = []): { x: number; z: number; yaw: number } {
  const bound = WALK_BOUND * 0.82;
  const obs = [...pileObstacles(), ...extraObs];
  const clear = 0.5;
  for (let n = 0; n < 48; n++) {
    const x = (Math.random() * 2 - 1) * bound;
    const z = (Math.random() * 2 - 1) * bound;
    let hit = false;
    for (const [ox, oz, radius] of obs) {
      if (Math.hypot(x - ox, z - oz) < radius + clear) { hit = true; break; }
    }
    if (hit) continue;
    // yaw=0 看 -Z；atan2(x,z) 讓面前朝向原點
    return { x, z, yaw: Math.atan2(x, z) };
  }
  return { x: 0, z: WALK_BOUND * 0.72, yaw: 0 };
}
