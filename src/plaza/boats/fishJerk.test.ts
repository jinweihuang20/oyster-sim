import { describe, it, expect } from 'vitest';
import { newFishPose, stepFishPose, jerkEnv, JERK_T, jerkTn, jerkFromSync, type FishPoseIn } from './fishPose';
import { fishSyncDue, fishSyncChanged, newFishSync, normFishSync, FISH_SYNC } from './fishSync';

const dt = 1 / 60;
const inp = (o: Partial<FishPoseIn> = {}): FishPoseIn => ({ phase: 'wait', power: 0, reel: false, tension: 0, lure: true, twitch: 0, jerk: 0, ...o });
const settle = (st = newFishPose(), i = inp(), n = 180) => { for (let k = 0; k < n; k++) stepFishPose(st, i, dt); return st; };

describe('抽竿動作', () => {
  it('力道曲線：很快甩到頂、平順放回 0', () => {
    expect(jerkEnv(0)).toBe(0); expect(jerkEnv(1)).toBe(0);
    let peakU = 0, peak = 0; for (let u = 0; u <= 1; u += 0.01) { const e = jerkEnv(u); if (e > peak) { peak = e; peakU = u; } }
    expect(peak).toBeCloseTo(1, 2); expect(peakU).toBeLessThan(0.3);
    // 放回段是單調遞減（不抖）
    for (let u = 0.25; u < 0.99; u += 0.01) expect(jerkEnv(u + 0.01)).toBeLessThanOrEqual(jerkEnv(u) + 1e-9);
    expect(JERK_T).toBeGreaterThanOrEqual(0.32); expect(JERK_T).toBeLessThanOrEqual(0.4);
  });

  it('按抽竿：竿子猛往上、手往上往後、身體後仰、竿彎，之後回到原本等待姿勢', () => {
    for (const reel of [false, true]) {
      const st = settle(newFishPose(), inp({ reel }));
      const p0 = st.pitch, hy0 = st.hy, hz0 = st.hz, lean0 = st.lean, bend0 = st.bend;
      const i = inp({ reel, jerk: 1 });
      let maxP = -9, maxHy = -9, maxHz = -9, maxLean = -9, maxBend = -9, peakT = 0;
      for (let k = 0; k < Math.round(JERK_T / dt); k++) {
        stepFishPose(st, i, dt);
        if (st.pitch > maxP) { maxP = st.pitch; peakT = k * dt; }
        maxHy = Math.max(maxHy, st.hy); maxHz = Math.max(maxHz, st.hz); maxLean = Math.max(maxLean, st.lean); maxBend = Math.max(maxBend, st.bend);
      }
      expect(maxP - p0).toBeGreaterThan(0.55);
      expect(peakT).toBeLessThan(0.16);
      expect(maxHy - hy0).toBeGreaterThan(0.09);
      expect(maxHz - hz0).toBeGreaterThan(0.06);
      expect(maxLean - lean0).toBeGreaterThan(0.09);
      expect(maxBend - bend0).toBeGreaterThan(0.15);
      settle(st, i, 60);
      expect(st.jerkT).toBe(-1);
      expect(Math.abs(st.pitch - p0)).toBeLessThan(0.02);
      expect(Math.abs(st.lean - lean0)).toBeLessThan(0.01);
      expect(Math.abs(st.hy - hy0)).toBeLessThan(0.01);
    }
  });

  it('連續抽竿：每下都重新甩上去、沒有一幀突然跳回原位', () => {
    const st = settle();
    const p0 = st.pitch;
    let prev = st.pitch, maxDrop = 0, peaks = 0, rising = false;
    for (let n = 1; n <= 6; n++) {
      const i = inp({ jerk: n });
      for (let k = 0; k < 15; k++) { // 每 0.25 秒抽一下（比動作還快）
        stepFishPose(st, i, dt);
        maxDrop = Math.max(maxDrop, prev - st.pitch);
        if (st.pitch > prev) rising = true; else if (rising) { rising = false; peaks++; }
        prev = st.pitch;
        expect(st.pitch).toBeLessThan(p0 + 0.95);
      }
      expect(st.pitch - p0).toBeGreaterThan(0.3);
    }
    expect(maxDrop).toBeLessThan(0.08);
    expect(peaks).toBeGreaterThanOrEqual(5);
    settle(st, inp({ jerk: 6 }), 60);
    expect(Math.abs(st.pitch - p0)).toBeLessThan(0.02);
  });

  it('不在路亞等待（拉魚、持竿、垂釣竿）就不甩；拉魚時抽竿計數變了也不影響拉魚姿勢', () => {
    for (const o of [{ phase: 'fight' as const, tension: 0.5 }, { phase: 'hold' as const }, { lure: false }]) {
      const a = settle(newFishPose(), inp(o)), b = settle(newFishPose(), inp(o));
      for (let k = 0; k < 12; k++) { stepFishPose(a, inp(o), dt); stepFishPose(b, inp({ ...o, jerk: 3 }), dt); }
      expect(b.jerkT).toBe(-1);
      expect(b.pitch).toBeCloseTo(a.pitch, 6); expect(b.lean).toBeCloseTo(a.lean, 6);
    }
    // 抽到一半中魚：抽竿動作收掉，換成揚竿
    const st = settle(); stepFishPose(st, inp({ jerk: 1 }), dt); expect(st.jerkT).toBeGreaterThanOrEqual(0);
    stepFishPose(st, inp({ phase: 'fight', jerk: 1 }), dt); expect(st.jerkT).toBe(-1); expect(st.hookT).toBeGreaterThanOrEqual(0);
  });
});

describe('抽竿同步給別人看（只用既有 FishSync 欄位）', () => {
  it('計數換成 tn 0.1～0.9 輪流，伺服器夾 0～1 後還分得出來', () => {
    expect(jerkTn(0)).toBe(0);
    const seen = new Set<number>(); for (let n = 1; n <= 9; n++) { const v = jerkTn(n); expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(1); seen.add(Math.round(v * 100) / 100); }
    expect(seen.size).toBe(9);
    for (let n = 1; n < 30; n++) expect(jerkTn(n + 1)).not.toBe(jerkTn(n));
  });
  it('收到：前後都是路亞等待／捲線、tn 換了才算抽竿；拉魚張力、剛拋完、垂釣竿都不算', () => {
    expect(jerkFromSync(20, 0, 20, 0.1)).toBe(true);
    expect(jerkFromSync(20, 0.1, 22, 0.2)).toBe(true); // 邊捲邊抽
    expect(jerkFromSync(20, 0.3, 20, 0.3)).toBe(false);
    expect(jerkFromSync(19, 0, 20, 0.4)).toBe(false); // 甩竿 → 等待（帶著舊的計數）
    expect(jerkFromSync(21, 0.5, 20, 0.6)).toBe(false); // 拉魚 → 等待
    expect(jerkFromSync(20, 0.5, 21, 0.75)).toBe(false); // 中魚張力
    expect(jerkFromSync(4, 0, 4, 0.1)).toBe(false); // 垂釣竿
    expect(jerkFromSync(20, 0.1, 20, 0)).toBe(false);
  });
  it('抽竿要很快送出（0.25 秒），但不超過伺服器 3 秒 16 筆', () => {
    const last = { ...newFishSync(), st: 20, cd: 12, tn: 0.1 }, cur = { ...last, tn: 0.2 };
    expect(fishSyncChanged(last, cur)).toBe(true);
    expect(fishSyncDue(last, cur, true, 0.2)).toBe(false);
    expect(fishSyncDue(last, cur, true, FISH_SYNC.jerkGap)).toBe(true);
    expect(3 / FISH_SYNC.jerkGap).toBeLessThanOrEqual(16);
    // 垂釣竿等待時 tn 一直是 0，不會多送
    expect(fishSyncChanged({ ...last, st: 4, tn: 0 }, { ...last, st: 4, tn: 0 })).toBe(false);
  });
  it('收到的線長最多 44 m（伺服器 FishSyncClamp：最遠的慢搖鐵板 42 m＋2）', () => {
    expect(normFishSync({ connId: 'a', st: 20, cd: 43 })!.cd).toBe(43);
    expect(normFishSync({ connId: 'a', st: 20, cd: 99 })!.cd).toBe(44);
  });
});
