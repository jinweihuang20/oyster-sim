import * as THREE from 'three';

export const PILE_COUNT = 16;
export const SLOTS_PER_PILE = 4;
/** 已移除的蚵堆（東側第 4／8／12 堆＝pileId 3／7／11）；保留 id 空間，不建 mesh／不給入座 */
export const REMOVED_PILE_IDS: readonly number[] = [3, 7, 11];
export const pileIsRemoved = (pileId: number) => REMOVED_PILE_IDS.includes(pileId);
export const pileIsActive = (pileId: number) => pileId >= 0 && pileId < PILE_COUNT && !pileIsRemoved(pileId);
/** 每堆額外阿婆座位（slot = SLOTS_PER_PILE + npcSlot）；僅 NpcPileIds 有 */
export const NPC_SLOTS_PER_PILE = 2;
/** 有阿婆的堆（與後端 PlazaWorld.NpcPileIds 對齊；不含已移除堆） */
export const NPC_PILE_IDS: readonly number[] = [1, 4, 10, 13];
export const pileHasNpc = (pileId: number) => NPC_PILE_IDS.includes(pileId);
/** 南排改烤蚵台（多人共烤，座位／同步沿用舊堆模組） */
export const GRILL_PILE_IDS: readonly number[] = [12, 13, 14, 15];
export const pileIsGrill = (pileId: number) => GRILL_PILE_IDS.includes(pileId);
/** 吸菸區虛擬堆（與後端 PlazaWorld.SmokePileId 對齊） */
export const SMOKE_PILE_ID = 100;
export const SMOKE_SEAT_COUNT = 4;
export const SMOKE_CENTER = { x: -12.0, z: -2.6 } as const;
/** 東南角多那芝咖啡門口吸菸區（與後端 PlazaWorld.CafeSmokePileId 對齊）：3 桌 × 2 座 */
export const CAFE_SMOKE_PILE_ID = 101;
export const CAFE_SMOKE_SEAT_COUNT = 6;
/** 門口小桌中心（x 固定，z 由北到南） */
export const CAFE_TABLE_X = 12.3;
export const CAFE_TABLE_Z: readonly number[] = [6.05, 8.15, 10.25];
/** 椅心離桌心（沿 z） */
export const CAFE_CHAIR_OFFSET = 0.6;
export const CAFE_TABLE_RADIUS = 0.36;
/** 咖啡店建築（外觀，不可進入）：正門朝西 */
export const CAFE_BUILDING = { x0: 14.2, x1: 19.6, z0: 5.0, z1: 11.0, h: 5.2, doorZ: 8.15 } as const;
/** 門廊深度（x 13.2..14.2） */
export const CAFE_PORCH_DEPTH = 1.0;
/** 東牆開口 z 範圍（其餘留短牆）：南段多那芝＋樸子腳＋北段競選總部，連成一條店面前庭 */
export const CAFE_OPENING = { z0: -8.3, z1: 11.5 } as const;
/** 南牆實牆止於此 x（東端 8.0..11.5 拆掉，換矮欄杆） */
export const CAFE_SOUTH_WALL_END = 8.0;
/** 東延區可走範圍（咖啡店前庭）：x ∈ (WALK_BOUND, xMax]、z ∈ [zMin, WALK_BOUND] */
export const CAFE_FORECOURT = { xMax: 13.95, zMin: -7.7 } as const;
/** 多那芝北側海產店「樸子腳」（外觀，不可進入）：正門朝西 */
export const SEAFOOD_BUILDING = { x0: 14.2, x1: 19.6, z0: -1.4, z1: 4.4, h: 4.2, doorZ: 1.5 } as const;
/** 樸子腳北側「聯合競選總部」組合屋（外觀，不可進入、無座位）：正門朝西 */
export const HQ_BUILDING = { x0: 14.2, x1: 19.6, z0: -8.0, z1: -1.6, h: 3.1 } as const;
/** 競選總部門口擺設（碰撞圓）：旗架、疊放塑膠椅、小講台 */
export const HQ_PROPS: readonly { kind: 'flags' | 'chairs' | 'podium'; x: number; z: number; r: number }[] = [
  { kind: 'flags', x: 13.72, z: -7.25, r: 0.32 },
  { kind: 'chairs', x: 13.68, z: -6.3, r: 0.3 },
  { kind: 'podium', x: 13.58, z: -3.0, r: 0.36 },
];
/** 樸子腳騎樓紅柱 x（前庭內，有碰撞） */
export const SEAFOOD_ARCADE_X = 13.78;
/** 樸子腳門口座位（與後端 PlazaWorld.SeafoodPileId 對齊）：3 圓桌 × 2 板凳，純坐、不抽菸、不開工班 */
export const SEAFOOD_PILE_ID = 102;
export const SEAFOOD_SEAT_COUNT = 6;
export const SEAFOOD_TABLE_X = 12.3;
export const SEAFOOD_TABLE_Z: readonly number[] = [-0.45, 1.5, 3.45];
export const SEAFOOD_STOOL_OFFSET = 0.55;
export const SEAFOOD_TABLE_RADIUS = 0.34;
export const isRestPile = (pileId: number) => pileId === SEAFOOD_PILE_ID;
/** 非蚵堆座位（吸菸區＋休息座）：不開工班、不算容量、不能被偷／丟 */
export const isLeisurePile = (pileId: number) => isSmokePile(pileId) || isRestPile(pileId);
export const isSmokePile = (pileId: number) => pileId === SMOKE_PILE_ID || pileId === CAFE_SMOKE_PILE_ID;
export const isCafeSmokePile = (pileId: number) => pileId === CAFE_SMOKE_PILE_ID;
export const smokeSeatCountOf = (pileId: number) => (pileId === CAFE_SMOKE_PILE_ID ? CAFE_SMOKE_SEAT_COUNT : SMOKE_SEAT_COUNT);
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
export const PLAZA_CAPACITY = (PILE_COUNT - REMOVED_PILE_IDS.length) * SLOTS_PER_PILE;
export const PILE_SPACING = 5.2;
/** 椅子離堆心距離（貼近蚵堆；身體靠 hangArms／後仰避免埋進堆裡） */
export const SEAT_RADIUS = 1.38;
/** 阿婆椅略外移，夾在玩家座位之間 */
export const NPC_SEAT_RADIUS = 1.52;
/** 廣場走動邊界（東南北約蓋住 4×4 堆） */
export const WALK_BOUND = 11.5;
/** 西緣延伸到潮間帶／養殖預留區 */
export const WALK_BOUND_WEST = 24;
/** 東緣延伸到多那芝咖啡（實際可走僅前庭，見 plazaClampWalk） */
export const WALK_BOUND_EAST = 20;
export type PlazaWalkBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export function plazaWalkBounds(): PlazaWalkBounds {
  return { minX: -WALK_BOUND_WEST, maxX: WALK_BOUND_EAST, minZ: -WALK_BOUND, maxZ: WALK_BOUND };
}
/** 該點是否在可走區（主廣場＋咖啡前庭） */
export function plazaWalkAllowed(x: number, z: number, margin = 0): boolean {
  if (x < -WALK_BOUND_WEST + margin || z < -WALK_BOUND + margin || z > WALK_BOUND - margin) return false;
  if (x <= WALK_BOUND - margin) return true;
  return x <= CAFE_FORECOURT.xMax - margin && z >= CAFE_FORECOURT.zMin + margin;
}
/**
 * 東延區夾限：出了東牆線（x > WALK_BOUND）只准在咖啡前庭；
 * 碰到開口北側短牆時，往位移較小的方向推回（可沿牆滑）。
 */
export function plazaClampWalk(p: { x: number; z: number }) {
  if (p.x <= WALK_BOUND) return p;
  if (p.z < CAFE_FORECOURT.zMin) {
    const dx = p.x - WALK_BOUND, dz = CAFE_FORECOURT.zMin - p.z;
    if (dx <= dz) p.x = WALK_BOUND; else p.z = CAFE_FORECOURT.zMin;
  }
  if (p.x > CAFE_FORECOURT.xMax) p.x = CAFE_FORECOURT.xMax;
  return p;
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
  if (isRestPile(pileId)) {
    const t = Math.max(0, Math.min(SEAFOOD_TABLE_Z.length - 1, slot >> 1));
    const center = new THREE.Vector3(SEAFOOD_TABLE_X, 0, SEAFOOD_TABLE_Z[t]);
    const pos = new THREE.Vector3(SEAFOOD_TABLE_X, 0, center.z + ((slot & 1) ? SEAFOOD_STOOL_OFFSET : -SEAFOOD_STOOL_OFFSET));
    const yaw = Math.atan2(pos.x - center.x, pos.z - center.z);
    return { pos, yaw, center, angle: 0 };
  }
  if (isCafeSmokePile(pileId)) {
    const t = Math.max(0, Math.min(CAFE_TABLE_Z.length - 1, slot >> 1));
    const center = new THREE.Vector3(CAFE_TABLE_X, 0, CAFE_TABLE_Z[t]);
    const pos = new THREE.Vector3(CAFE_TABLE_X, 0, center.z + ((slot & 1) ? CAFE_CHAIR_OFFSET : -CAFE_CHAIR_OFFSET));
    const yaw = Math.atan2(pos.x - center.x, pos.z - center.z);
    return { pos, yaw, center, angle: 0 };
  }
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
    if (pileIsRemoved(p)) continue;
    for (let s = 0; s < SLOTS_PER_PILE; s++) consider(p, s);
    if (pileHasNpc(p)) {
      for (let s = SLOTS_PER_PILE; s < SLOTS_PER_PILE + NPC_SLOTS_PER_PILE; s++) consider(p, s);
    }
  }
  for (let s = 0; s < SMOKE_SEAT_COUNT; s++) consider(SMOKE_PILE_ID, s);
  for (let s = 0; s < CAFE_SMOKE_SEAT_COUNT; s++) consider(CAFE_SMOKE_PILE_ID, s);
  for (let s = 0; s < SEAFOOD_SEAT_COUNT; s++) consider(SEAFOOD_PILE_ID, s);
  return best;
}

/** 放下阿婆：玩家座＋阿婆加座＋休閒座 */
export function nearestFreePlaceSeat(x: number, z: number, taken: Set<string>, maxDist = SIT_DIST): (PlazaSeatRef & { dist: number }) | null {
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
    if (pileIsRemoved(p)) continue;
    for (let s = 0; s < SLOTS_PER_PILE; s++) consider(p, s);
    if (pileHasNpc(p)) {
      for (let s = SLOTS_PER_PILE; s < SLOTS_PER_PILE + NPC_SLOTS_PER_PILE; s++) consider(p, s);
    }
  }
  for (let s = 0; s < SMOKE_SEAT_COUNT; s++) consider(SMOKE_PILE_ID, s);
  for (let s = 0; s < CAFE_SMOKE_SEAT_COUNT; s++) consider(CAFE_SMOKE_PILE_ID, s);
  for (let s = 0; s < SEAFOOD_SEAT_COUNT; s++) consider(SEAFOOD_PILE_ID, s);
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

/** 樸子腳騎樓紅柱 z（兩端＋門兩側） */
export function seafoodColumnZ(): number[] {
  const B = SEAFOOD_BUILDING;
  return [B.z0 + 0.2, B.doorZ - 1.05, B.doorZ + 1.05, B.z1 - 0.2];
}
/** 樸子腳騎樓下擺設（碰撞圓） */
export const SEAFOOD_PROPS: readonly { kind: 'ice' | 'tank' | 'menu'; x: number; z: number; r: number }[] = [
  { kind: 'ice', x: 13.72, z: -0.75, r: 0.32 },
  { kind: 'menu', x: 13.6, z: 2.85, r: 0.22 },
  { kind: 'tank', x: 13.85, z: 3.7, r: 0.3 },
];

/** 咖啡門口：小桌圓＋東牆開口北端短牆頭（椅不擋，才能走近入座） */
export function plazaCafeObstacles(): [number, number, number][] {
  return [
    ...CAFE_TABLE_Z.map(z => [CAFE_TABLE_X, z, CAFE_TABLE_RADIUS] as [number, number, number]),
    [WALK_BOUND + 0.07, CAFE_OPENING.z0, 0.12],
    // 門口護欄外側柱、吸菸區立牌（與 cafe.ts 對齊）
    [CAFE_BUILDING.x0 - CAFE_PORCH_DEPTH + 0.12, CAFE_BUILDING.doorZ - 0.86, 0.07],
    [CAFE_BUILDING.x0 - CAFE_PORCH_DEPTH + 0.12, CAFE_BUILDING.doorZ + 0.86, 0.07],
    [CAFE_BUILDING.x0 - CAFE_PORCH_DEPTH + 0.25, WALK_BOUND - 0.3, 0.08],
    // 樸子腳：圓桌、騎樓紅柱、門口保麗龍冰箱／魚缸／菜單架（與 seafood.ts 對齊）
    ...SEAFOOD_TABLE_Z.map(z => [SEAFOOD_TABLE_X, z, SEAFOOD_TABLE_RADIUS] as [number, number, number]),
    ...seafoodColumnZ().map(z => [SEAFOOD_ARCADE_X, z, 0.1] as [number, number, number]),
    ...SEAFOOD_PROPS.map(p => [p.x, p.z, p.r] as [number, number, number]),
    // 競選總部門口擺設（與 hq.ts 對齊）
    ...HQ_PROPS.map(p => [p.x, p.z, p.r] as [number, number, number]),
  ];
}

/** 碰撞用：每堆一個圓（遮雨棚柱另見 plazaCanopySites） */
export function pileObstacles(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < PILE_COUNT; i++) {
    if (pileIsRemoved(i)) continue;
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
  if (!plazaWalkAllowed(x, z, margin)) return false;
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
