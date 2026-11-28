import { describe, it, expect } from 'vitest';
import {
  CULL_FAR, CULL_ECO_SCALE, REMOTE_FULL_R, REMOTE_FULL_R_ECO, REMOTE_LOD_HYST,
  REMOTE_CROWD_SOFT, REMOTE_CROWD_MID, REMOTE_CROWD_HARD,
  remoteFullR, remoteLodSimple,
} from './zones';

/** 模擬玩家一路走遠再走回來，回傳每一步是否為簡易小人 */
function walk(dists: number[], eco = false, pinned = false, crowd = 0) {
  let s = false;
  return dists.map(d => (s = remoteLodSimple(s, d, eco, pinned, crowd)));
}

describe('遠端玩家兩段 LOD', () => {
  it('完整角色門檻比舊的隱形距離明顯更遠（一般／省電）', () => {
    expect(remoteFullR(false)).toBe(REMOTE_FULL_R);
    expect(remoteFullR(true)).toBe(REMOTE_FULL_R_ECO);
    expect(REMOTE_FULL_R - REMOTE_LOD_HYST).toBeGreaterThanOrEqual(CULL_FAR * 1.5);
    expect(REMOTE_FULL_R_ECO - REMOTE_LOD_HYST).toBeGreaterThanOrEqual(CULL_FAR * CULL_ECO_SCALE * 1.5);
  });

  it('舊版會隱形的距離（20 m 起）現在仍是完整角色', () => {
    for (const d of [CULL_FAR, 25, REMOTE_FULL_R]) expect(remoteLodSimple(false, d, false)).toBe(false);
    for (const d of [CULL_FAR * CULL_ECO_SCALE, 20, REMOTE_FULL_R_ECO]) expect(remoteLodSimple(false, d, true)).toBe(false);
  });

  it('超過門檻＋遲滯就切簡易小人（不是隱形），多遠都一樣', () => {
    const R = REMOTE_FULL_R + REMOTE_LOD_HYST;
    expect(remoteLodSimple(false, R + 0.01, false)).toBe(true);
    expect(remoteLodSimple(false, 80, false)).toBe(true);
    expect(remoteLodSimple(false, 500, false)).toBe(true);
    expect(remoteLodSimple(false, REMOTE_FULL_R_ECO + REMOTE_LOD_HYST + 0.01, true)).toBe(true);
  });

  it('邊界附近來回晃不會每幀切換（遲滯）', () => {
    const R = REMOTE_FULL_R;
    const jitter = [R - 2, R + 2, R - 2, R + 2, R + 3, R - 3, R + 1];
    expect(walk(jitter)).toEqual(jitter.map(() => false));
    // 已經是小人：在 R±H 內晃都維持小人
    let s = true;
    for (const d of jitter) { s = remoteLodSimple(s, d, false); expect(s).toBe(true); }
  });

  it('走回門檻內會還原完整角色', () => {
    const R = REMOTE_FULL_R, H = REMOTE_LOD_HYST;
    const seq = walk([10, 30, R + H + 1, 60, R, R - H + 0.5, R - H - 0.5, 12]);
    expect(seq).toEqual([false, false, true, true, true, true, false, false]);
  });

  it('被抱／抱人中一律完整角色；距離異常不當成遠', () => {
    expect(walk([100, 200], false, true)).toEqual([false, false]);
    expect(remoteLodSimple(true, NaN, false)).toBe(false);
  });

  it('人多時完整角色半徑縮短（廣場內較早改小人）', () => {
    expect(remoteFullR(false, 0)).toBe(REMOTE_FULL_R);
    expect(remoteFullR(false, REMOTE_CROWD_SOFT)).toBeCloseTo(REMOTE_FULL_R * 0.85, 5);
    expect(remoteFullR(false, REMOTE_CROWD_MID)).toBeCloseTo(REMOTE_FULL_R * 0.7, 5);
    expect(remoteFullR(false, REMOTE_CROWD_HARD)).toBeCloseTo(REMOTE_FULL_R * 0.55, 5);
    // 25 m：人少仍完整；人多（40）改小人
    expect(remoteLodSimple(false, 25, false, false, 0)).toBe(false);
    expect(remoteLodSimple(false, 25, false, false, REMOTE_CROWD_HARD)).toBe(true);
  });
});
