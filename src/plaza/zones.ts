/**
 * 廣場分區：AABB、鄰區、載入／卸載半徑、視距裁剪檔位。
 * 以玩家腳下 (x,z) 判定；轉頭不觸發。
 */
import {
  WALK_BOUND, WALK_BOUND_WEST, WALK_BOUND_EAST, PILE_COUNT, PILE_SPACING,
  pileIsRemoved, pileIsGrill, pileCenter,
  SMOKE_CENTER, CAFE_BUILDING, SEAFOOD_BUILDING, HQ_BUILDING,
  NORTH_DOCK, MG_PLATFORM, TIDAL_FLAT,
} from './layout';

export type PlazaZoneId =
  | 'core'
  | 'westSmoke'
  | 'southGrill'
  | 'eastStreet'
  | 'northShed'
  | 'ambiance';

export type ZoneAabb = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * 門檻對齊可走範圍 ≈ 44×25.5m。
 * 進場：整場先建齊；運轉：遠距便宜繪製（關陰影／停 FX／關小零件），不消失、不 dispose。
 */
/** 鄰近觸發（若日後再開分幀補載）；進場已全建 */
export const ZONE_LOAD_R = 9;
/** 保留常數；場內預設不卸 mesh（見 ZONE_DISPOSE） */
export const ZONE_UNLOAD_R = 22;
/** 鄰近／坐下禁止卸載的緩衝 */
export const ZONE_PIN_R = 5;
/** 這張圖 dispose／重建比常駐便宜繪製更貴 → 關閉 */
export const ZONE_DISPOSE = false;

/** 常態三檔視距（公尺）；省電再 × ecoScale。far/hide＝便宜繪製，不是隱形 */
export const CULL_NEAR = 8;
export const CULL_MID = 14;
export const CULL_FAR = 20;
export const CULL_ECO_SCALE = 0.75;

export const ZONE_AABB: Record<PlazaZoneId, ZoneAabb> = {
  // 中央棚下 4×4（不含南烤／西菸／東街／北工寮）
  core: { minX: -WALK_BOUND, maxX: WALK_BOUND, minZ: -WALK_BOUND, maxZ: WALK_BOUND },
  westSmoke: {
    minX: -WALK_BOUND_WEST,
    maxX: -WALK_BOUND + 1.5,
    minZ: Math.min(TIDAL_FLAT.zMin, SMOKE_CENTER.z - 6),
    maxZ: Math.max(TIDAL_FLAT.zMax, SMOKE_CENTER.z + 6),
  },
  southGrill: {
    minX: Math.min(-WALK_BOUND, MG_PLATFORM.cx - MG_PLATFORM.w),
    maxX: WALK_BOUND,
    minZ: PILE_SPACING * 0.9,
    maxZ: Math.max(WALK_BOUND + 2, MG_PLATFORM.cz + MG_PLATFORM.d),
  },
  eastStreet: {
    minX: WALK_BOUND - 0.5,
    maxX: Math.max(WALK_BOUND_EAST, CAFE_BUILDING.x1) + 0.5,
    minZ: Math.min(HQ_BUILDING.z0, SEAFOOD_BUILDING.z0) - 0.5,
    maxZ: CAFE_BUILDING.z1 + 0.5,
  },
  northShed: {
    minX: -NORTH_DOCK.xMax - 0.5,
    maxX: NORTH_DOCK.xMax + 0.5,
    minZ: NORTH_DOCK.z1 - 0.5,
    maxZ: -WALK_BOUND + 1.5,
  },
  // 外圈攤位帶：棚柱環外側一圈（不含潮間帶，潮間帶歸 westSmoke）
  ambiance: {
    minX: -WALK_BOUND - 1.2,
    maxX: WALK_BOUND + 1.2,
    minZ: -WALK_BOUND - 1.2,
    maxZ: WALK_BOUND + 1.2,
  },
};

/** 鄰區表（雙向） */
const NEIGHBORS: Record<PlazaZoneId, PlazaZoneId[]> = {
  core: ['westSmoke', 'southGrill', 'eastStreet', 'northShed', 'ambiance'],
  westSmoke: ['core', 'ambiance', 'northShed'],
  southGrill: ['core', 'ambiance', 'eastStreet'],
  eastStreet: ['core', 'southGrill', 'ambiance', 'northShed'],
  northShed: ['core', 'westSmoke', 'eastStreet', 'ambiance'],
  ambiance: ['core', 'westSmoke', 'southGrill', 'eastStreet', 'northShed'],
};

export function neighbors(zone: PlazaZoneId): readonly PlazaZoneId[] {
  return NEIGHBORS[zone];
}

/** 點到 AABB 的水平距離（在內＝0） */
export function distToAabb(x: number, z: number, box: ZoneAabb): number {
  const cx = Math.min(box.maxX, Math.max(box.minX, x));
  const cz = Math.min(box.maxZ, Math.max(box.minZ, z));
  return Math.hypot(x - cx, z - cz);
}

export function distToZone(x: number, z: number, id: PlazaZoneId): number {
  return distToAabb(x, z, ZONE_AABB[id]);
}

/** 玩家所在主區（重疊時專區優先於 core／ambiance） */
export function zoneAt(x: number, z: number): PlazaZoneId {
  const prefer: PlazaZoneId[] = ['westSmoke', 'southGrill', 'eastStreet', 'northShed', 'core', 'ambiance'];
  for (const id of prefer) {
    if (distToZone(x, z, id) <= 0) return id;
  }
  let best: PlazaZoneId = 'core';
  let bestD = Infinity;
  for (const id of prefer) {
    const d = distToZone(x, z, id);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

/** 蚵堆 2×2 象限：0=NW 1=NE 2=SW 3=SE（對齊 PLAZA_LAMP） */
export function pileQuadrant(pileId: number): 0 | 1 | 2 | 3 {
  const r = Math.floor(pileId / 4);
  const c = pileId % 4;
  return ((r < 2 ? 0 : 2) + (c < 2 ? 0 : 1)) as 0 | 1 | 2 | 3;
}

/** 核心非烤台堆（依象限） */
export function corePilesInQuadrant(q: 0 | 1 | 2 | 3): number[] {
  const out: number[] = [];
  for (let i = 0; i < PILE_COUNT; i++) {
    if (pileIsRemoved(i) || pileIsGrill(i)) continue;
    if (pileQuadrant(i) === q) out.push(i);
  }
  return out;
}

/** 離 (x,z) 最近的 n 個象限 */
export function nearestQuadrants(x: number, z: number, n = 2): (0 | 1 | 2 | 3)[] {
  const centers: { q: 0 | 1 | 2 | 3; d: number }[] = [
    { q: 0, d: Math.hypot(x - (-PILE_SPACING), z - (-PILE_SPACING)) },
    { q: 1, d: Math.hypot(x - PILE_SPACING, z - (-PILE_SPACING)) },
    { q: 2, d: Math.hypot(x - (-PILE_SPACING), z - PILE_SPACING) },
    { q: 3, d: Math.hypot(x - PILE_SPACING, z - PILE_SPACING) },
  ];
  centers.sort((a, b) => a.d - b.d);
  return centers.slice(0, Math.max(1, Math.min(4, n))).map(c => c.q);
}

/** 南排烤台 pile ids */
export function southGrillPiles(): number[] {
  const out: number[] = [];
  for (let i = 0; i < PILE_COUNT; i++) {
    if (!pileIsRemoved(i) && pileIsGrill(i)) out.push(i);
  }
  return out;
}

export type CullTier = 'near' | 'mid' | 'far' | 'hide';

/** 距離 → 裁剪檔；eco 時距離門檻 ×0.75 */
export function cullTier(dist: number, eco: boolean): CullTier {
  const s = eco ? CULL_ECO_SCALE : 1;
  if (dist < CULL_NEAR * s) return 'near';
  if (dist < CULL_MID * s) return 'mid';
  if (dist < CULL_FAR * s) return 'far';
  return 'hide';
}

/** 供 streamer 決定要載／卸的目標集合 */
export function zonesWanted(x: number, z: number, loadR = ZONE_LOAD_R): Set<PlazaZoneId> {
  const want = new Set<PlazaZoneId>(['core']);
  const here = zoneAt(x, z);
  want.add(here);
  for (const n of neighbors(here)) {
    if (distToZone(x, z, n) <= loadR) want.add(n);
  }
  for (const id of Object.keys(ZONE_AABB) as PlazaZoneId[]) {
    if (distToZone(x, z, id) <= loadR) want.add(id);
  }
  return want;
}

export function zoneShouldUnload(
  id: PlazaZoneId,
  x: number,
  z: number,
  opts?: { seatedZone?: PlazaZoneId | null; pinned?: Set<PlazaZoneId>; unloadR?: number },
): boolean {
  if (id === 'core') return false;
  if (opts?.seatedZone === id) return false;
  if (opts?.pinned?.has(id)) return false;
  const r = opts?.unloadR ?? ZONE_UNLOAD_R;
  return distToZone(x, z, id) > r;
}

/** debug／驗收用 */
export function zoneStatsLabel(
  loaded: Iterable<PlazaZoneId>,
  pending: Iterable<PlazaZoneId>,
): string {
  return `loaded=[${[...loaded].join(',')}] pending=[${[...pending].join(',')}]`;
}

/** 象限中心（給 pile 暖載距離用） */
export function quadrantCenter(q: 0 | 1 | 2 | 3): { x: number; z: number } {
  const piles = corePilesInQuadrant(q);
  if (!piles.length) {
    const sx = (q & 1) ? PILE_SPACING : -PILE_SPACING;
    const sz = (q & 2) ? PILE_SPACING : -PILE_SPACING;
    return { x: sx, z: sz };
  }
  let sx = 0, sz = 0;
  const tmp = pileCenter(piles[0]);
  for (const id of piles) {
    pileCenter(id, tmp);
    sx += tmp.x; sz += tmp.z;
  }
  return { x: sx / piles.length, z: sz / piles.length };
}
