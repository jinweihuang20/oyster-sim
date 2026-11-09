import * as THREE from 'three';

export const PILE_COUNT = 16;
export const SLOTS_PER_PILE = 4;
/** 每堆額外阿婆座位（slot = SLOTS_PER_PILE + npcSlot）；僅 NpcPileIds 有 */
export const NPC_SLOTS_PER_PILE = 2;
/** 先只在這 5 堆放阿婆（與後端 PlazaWorld.NpcPileIds 對齊） */
export const NPC_PILE_IDS: readonly number[] = [1, 4, 7, 10, 13];
export const pileHasNpc = (pileId: number) => NPC_PILE_IDS.includes(pileId);
/** 南排改烤蚵台（多人共烤，座位／同步沿用舊堆模組） */
export const GRILL_PILE_IDS: readonly number[] = [12, 13, 14, 15];
export const pileIsGrill = (pileId: number) => GRILL_PILE_IDS.includes(pileId);
/** 吸菸區虛擬堆（與後端 PlazaWorld.SmokePileId 對齊） */
export const SMOKE_PILE_ID = 100;
export const SMOKE_SEAT_COUNT = 4;
export const SMOKE_CENTER = { x: -12.0, z: -2.6 } as const;
export const isSmokePile = (pileId: number) => pileId === SMOKE_PILE_ID;
/** 吸菸區氣氛 NPC 椅（非玩家位；伺服器座位仍 0..SMOKE_SEAT_COUNT-1） */
/** 南側外緣：離玩家凳／菸灰缸／棚柱皆 ≥~1.6，不擋東側入座 */
export const SMOKE_NPC_ANGLE = -Math.PI / 2;
export const SMOKE_NPC_RADIUS = 2.5;
export function smokeNpcSeatPose() {
  const center = new THREE.Vector3(SMOKE_CENTER.x, 0, SMOKE_CENTER.z);
  const a = SMOKE_NPC_ANGLE;
  const radius = SMOKE_NPC_RADIUS;
  const pos = new THREE.Vector3(
    center.x + Math.cos(a) * radius,
    0,
    center.z + Math.sin(a) * radius,
  );
  const yaw = Math.atan2(pos.x - center.x, pos.z - center.z);
  return { pos, yaw, center, angle: a };
}
export const PLAZA_CAPACITY = PILE_COUNT * SLOTS_PER_PILE;
export const PILE_SPACING = 5.2;
/** 椅子離堆心距離（貼近蚵堆；身體靠 hangArms／後仰避免埋進堆裡） */
export const SEAT_RADIUS = 1.38;
/** 阿婆椅略外移，夾在玩家座位之間 */
export const NPC_SEAT_RADIUS = 1.52;
/** 廣場走動邊界（東南北約蓋住 4×4 堆） */
export const WALK_BOUND = 11.5;
/** 西緣延伸到潮間帶／養殖預留區 */
export const WALK_BOUND_WEST = 24;
export type PlazaWalkBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export function plazaWalkBounds(): PlazaWalkBounds {
  return { minX: -WALK_BOUND_WEST, maxX: WALK_BOUND, minZ: -WALK_BOUND, maxZ: WALK_BOUND };
}
/** 潮間帶世界範圍（棚西外側往西） */
export const TIDAL_FLAT = {
  /** 泥灘東緣（貼近棚柱環外側） */
  xInner: -11.2,
  xOuter: -WALK_BOUND_WEST,
  zMin: -10.2,
  zMax: 10.2,
} as const;
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

/** 一堆座位：0–3 玩家、4–5 阿婆；皆朝堆心。吸菸區 pileId=SMOKE_PILE_ID。 */
export function seatPose(pileId: number, slot: number) {
  if (isSmokePile(pileId)) {
    const n = Math.max(1, SMOKE_SEAT_COUNT - 1);
    const a = -0.95 + (slot / n) * 1.9;
    const radius = 1.15;
    const center = new THREE.Vector3(SMOKE_CENTER.x, 0, SMOKE_CENTER.z);
    const pos = new THREE.Vector3(
      center.x + Math.cos(a) * radius,
      0,
      center.z + Math.sin(a) * radius,
    );
    const yaw = Math.atan2(pos.x - center.x, pos.z - center.z);
    return { pos, yaw, center, angle: a };
  }
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

/** 找最近的空位（taken 為 `pile:slot`；含吸菸區） */
export function nearestFreeSeat(x: number, z: number, taken: Set<string>, maxDist = SIT_DIST): (PlazaSeatRef & { dist: number }) | null {
  let best: (PlazaSeatRef & { dist: number }) | null = null;
  const consider = (pileId: number, slot: number) => {
    const k = seatKey(pileId, slot);
    if (taken.has(k)) return;
    const pose = seatPose(pileId, slot);
    const d = Math.hypot(x - pose.pos.x, z - pose.pos.z);
    if (d > maxDist) return;
    if (!best || d < best.dist) best = { pileId, slot, dist: d };
  };
  for (let p = 0; p < PILE_COUNT; p++) {
    for (let s = 0; s < SLOTS_PER_PILE; s++) consider(p, s);
  }
  for (let s = 0; s < SMOKE_SEAT_COUNT; s++) consider(SMOKE_PILE_ID, s);
  return best;
}

/**
 * 立式菸灰缸相對 SMOKE_CENTER 的 xz（西側、遠離圓凳弧；與凳中心距離 ≥ ~1.17）
 * 舊位 (0,0)/(0.55,±0.85) 與 seat0／seat3 幾乎重疊（≈0.15）。
 */
export const SMOKE_ASHTRAY_XZ: readonly [number, number][] = [
  [-0.65, 0],
  [-0.5, -0.85],
  [-0.5, 0.85],
];
/** 菸灰缸頂緣高度：約坐姿肩高略下（坐姿頭≈1.51、肩≈1.06；舊頂≈1.02） */
export const SMOKE_ASHTRAY_TOP_Y = 0.88;
/** 菸灰缸柱碰撞半徑 */
export const SMOKE_ASHTRAY_RADIUS = 0.22;

/** 吸菸區碰撞（棚外大圈＋菸灰缸柱；菸灰缸勿擋東側入座路徑） */
export function plazaSmokeObstacles(): [number, number, number][] {
  const { x, z } = SMOKE_CENTER;
  const npc = smokeNpcSeatPose();
  return [
    [x, z, 1.55],
    ...SMOKE_ASHTRAY_XZ.map(([dx, dz]) => [x + dx, z + dz, SMOKE_ASHTRAY_RADIUS] as [number, number, number]),
    // NPC 圓凳（玩家不可坐，但仍擋路）
    [npc.pos.x, npc.pos.z, 0.38],
  ];
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

/** 離開廣場時記住的站位；坐著離開時帶 pileId/slot 供下次避開佔椅 */
export type PlazaSpawnMemory = { x: number; z: number; yaw: number; pileId?: number; slot?: number };

const SPAWN_CLEAR = 0.5;

function spawnPointClear(
  x: number,
  z: number,
  obs: [number, number, number][],
  bounds: PlazaWalkBounds = plazaWalkBounds(),
  margin = 0.35,
): boolean {
  if (x < bounds.minX + margin || x > bounds.maxX - margin || z < bounds.minZ + margin || z > bounds.maxZ - margin) return false;
  for (const [ox, oz, radius] of obs) {
    if (Math.hypot(x - ox, z - oz) < radius + SPAWN_CLEAR) return false;
  }
  return true;
}

/**
 * 入場隨機站位：在走動界內、避開蚵堆圓，並朝廣場中心。
 * `extraObs` 可帶入棚柱等 `[x, z, radius]`。
 */
export function randomWalkSpawn(extraObs: [number, number, number][] = []): { x: number; z: number; yaw: number } {
  const bound = WALK_BOUND * 0.82;
  const obs = [...pileObstacles(), ...extraObs];
  for (let n = 0; n < 48; n++) {
    const x = (Math.random() * 2 - 1) * bound;
    const z = (Math.random() * 2 - 1) * bound;
    if (!spawnPointClear(x, z, obs, { minX: -bound, maxX: bound, minZ: -bound, maxZ: bound }, 0)) continue;
    // yaw=0 看 -Z；atan2(x,z) 讓面前朝向原點
    return { x, z, yaw: Math.atan2(x, z) };
  }
  return { x: 0, z: WALK_BOUND * 0.72, yaw: 0 };
}

/**
 * 用上次離開位置入場；坐著離開且該椅現已被佔 → 站遠一點，不跟現坐者重疊。
 * 無有效記憶或完全卡死時退回隨機。
 */
export function resolveWalkSpawn(
  last: PlazaSpawnMemory | null | undefined,
  opts: { extraObs?: [number, number, number][]; takenSeats?: Set<string> } = {},
): { x: number; z: number; yaw: number } {
  const extraObs = opts.extraObs ?? [];
  const taken = opts.takenSeats ?? new Set<string>();
  const baseObs = [...pileObstacles(), ...extraObs];
  const seatObs: [number, number, number][] = [];
  for (const k of taken) {
    const parts = k.split(':');
    const ps = Number(parts[0]), ss = Number(parts[1]);
    if (!Number.isFinite(ps) || !Number.isFinite(ss) || ps < 0 || ss < 0) continue;
    const pose = seatPose(ps, ss);
    seatObs.push([pose.pos.x, pose.pos.z, 0.42]);
  }
  const obs = [...baseObs, ...seatObs];

  const tryAt = (x: number, z: number, yaw: number) =>
    (spawnPointClear(x, z, obs) ? { x, z, yaw } : null);

  if (last && Number.isFinite(last.x + last.z + last.yaw)) {
    const pileId = last.pileId;
    const slot = last.slot;
    if (pileId != null && pileId >= 0 && slot != null && slot >= 0) {
      const pose = seatPose(pileId, slot);
      const occupied = taken.has(seatKey(pileId, slot));
      // 佔椅時站遠一點，避免跟現坐者碰撞圓重疊
      const dists = occupied ? [1.2, 1.55, 1.9, 0.95] : [0.55, 0.9, 1.25];
      const laterals = [0, 0.55, -0.55, 0.95, -0.95];
      const fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw);
      const lx = Math.cos(pose.yaw), lz = -Math.sin(pose.yaw);
      for (const d of dists) {
        for (const lat of laterals) {
          const hit = tryAt(pose.pos.x + fx * d + lx * lat, pose.pos.z + fz * d + lz * lat, pose.yaw);
          if (hit) return hit;
        }
      }
    }

    {
      const hit = tryAt(last.x, last.z, last.yaw);
      if (hit) return hit;
      for (const d of [0.45, 0.9, 1.4, 2.0]) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const hit2 = tryAt(last.x + Math.cos(a) * d, last.z + Math.sin(a) * d, last.yaw);
          if (hit2) return hit2;
        }
      }
    }
  }

  return randomWalkSpawn(extraObs);
}
