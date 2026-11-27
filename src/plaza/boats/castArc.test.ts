import { describe, it, expect } from 'vitest';
import { castFlyPoint, castFlyDur, castApex, castDragS, castLine, CAST_LINE_SEGS, CAST_RELEASE_S } from './castArc';
import { CAST_FLICK } from './fishPose';
import { FishSM, FISH, fishDistNow } from './fishLogic';

const V = (x: number, y: number, z: number) => ({ x, y, z });
const WY = 0.04;

describe('拋竿：線頭飛行拋物線', () => {
  for (const d of [4, 12, 24, 42]) {
    it(`${d} m：從放手點出發、剛好落在落點水面、中間有平順的弧頂`, () => {
      const tx = 1, ty = 2.6, tz = 2, ex = 1, ez = 2 - d, o = V(0, 0, 0);
      castFlyPoint(tx, ty, tz, ex, WY, ez, 0, o); expect(o.x).toBeCloseTo(tx); expect(o.y).toBeCloseTo(ty); expect(o.z).toBeCloseTo(tz);
      castFlyPoint(tx, ty, tz, ex, WY, ez, 1, o); expect(o).toEqual({ x: ex, y: WY, z: ez });
      let peak = -Infinity, peakK = 0, prevY = ty, prevZ = tz, up = true, turns = 0;
      for (let i = 1; i <= 200; i++) {
        const k = i / 200; castFlyPoint(tx, ty, tz, ex, WY, ez, k, o);
        expect(Number.isFinite(o.y)).toBe(true);
        expect(o.z).toBeLessThanOrEqual(prevZ + 1e-9); // 一直往前、不倒退
        if (o.y > peak) { peak = o.y; peakK = k; }
        const goingUp = o.y >= prevY; if (goingUp !== up) { turns++; up = goingUp; }
        prevY = o.y; prevZ = o.z;
      }
      expect(turns).toBe(1); // 只有一個弧頂（先升後降）
      expect(peak).toBeCloseTo(Math.max(ty, WY) + castApex(d), 1);
      expect(peakK).toBeGreaterThan(0.2); expect(peakK).toBeLessThan(0.8);
      // 有空氣阻力：弧頂在水平過半之後、落水比出手陡
      castFlyPoint(tx, ty, tz, ex, WY, ez, peakK, o);
      expect((tz - o.z) / d).toBeGreaterThan(0.5);
    });
  }
  it('弧頂高度跟飛行時間隨距離變大，但有上下限', () => {
    expect(castApex(24)).toBeGreaterThan(castApex(4));
    expect(castApex(500)).toBeLessThanOrEqual(4.8); expect(castApex(0)).toBeGreaterThanOrEqual(1.1);
    expect(castFlyDur(24)).toBeGreaterThan(castFlyDur(4));
    expect(castFlyDur(500)).toBeLessThanOrEqual(1.45); expect(castFlyDur(NaN)).toBeGreaterThan(0);
    expect(castDragS(0)).toBe(0); expect(castDragS(1)).toBeCloseTo(1); expect(castDragS(0.5)).toBeGreaterThan(0.5);
  });
  it('竿子甩到一半多才放手（在甩竿動作裡面）', () => {
    expect(CAST_RELEASE_S).toBeGreaterThan(CAST_FLICK * 0.4); expect(CAST_RELEASE_S).toBeLessThan(CAST_FLICK);
  });
  it('站得比落點低（船上浪高）也不會 NaN', () => {
    const o = V(0, 0, 0);
    for (let k = 0; k <= 1; k += 0.05) { castFlyPoint(0, -1, 0, 0, WY, -10, k, o); expect(Number.isFinite(o.y)).toBe(true); }
    castFlyPoint(0, -1, 0, 0, WY, -10, 1, o); expect(o.y).toBeCloseTo(WY);
    castFlyPoint(0, 2, 0, 0, WY, 0, 0.5, o); expect(Number.isFinite(o.y)).toBe(true); // 零距離
  });
});

describe('拋竿：釣線曲線', () => {
  const N = CAST_LINE_SEGS, out = new Float32Array((N + 1) * 3);
  const pt = (i: number) => V(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
  const maxTurn = () => {
    let m = 0;
    for (let i = 1; i < N; i++) {
      const a = pt(i - 1), b = pt(i), c = pt(i + 1);
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
      const lu = Math.hypot(ux, uy, uz), lv = Math.hypot(vx, vy, vz);
      if (lu < 1e-6 || lv < 1e-6) continue;
      m = Math.max(m, Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (lu * lv)))));
    }
    return m;
  };
  for (const d of [4, 24, 42]) {
    it(`${d} m 飛行中：從竿尖出發、接到線頭、平順沒有折角`, () => {
      const rel = V(0, 2.6, 0), land = V(0, WY, -d), tip = V(0.05, 2.3, -0.3), end = V(0, 0, 0), fly = V(0, 0, 0);
      for (const k of [0, 0.1, 0.35, 0.6, 0.9, 1]) {
        castLine(out, N, tip, rel, land, end, { k, settle: 0, sag: 0.3, wy: WY });
        castFlyPoint(rel.x, rel.y, rel.z, land.x, WY, land.z, k, fly);
        const a = pt(0), b = pt(N);
        expect(a.x).toBeCloseTo(tip.x, 4); expect(a.y).toBeCloseTo(tip.y, 4); expect(a.z).toBeCloseTo(tip.z, 4);
        expect(b.x).toBeCloseTo(fly.x, 4); expect(b.y).toBeCloseTo(fly.y, 4); expect(b.z).toBeCloseTo(fly.z, 4);
        for (const v of out) expect(Number.isFinite(v)).toBe(true);
        expect(maxTurn()).toBeLessThan(0.6); // 每段轉角 < ~34°（沒有怪折角）
      }
    });
  }
  it('飛行中線拖出弧（不是直棍子）：中段高於竿尖→線頭的直線', () => {
    const rel = V(0, 2.6, 0), land = V(0, WY, -20), tip = V(0, 2.4, -0.2), end = V(0, 0, 0), fly = V(0, 0, 0);
    castLine(out, N, tip, rel, land, end, { k: 0.75, settle: 0, sag: 0.3, wy: WY });
    castFlyPoint(rel.x, rel.y, rel.z, land.x, WY, land.z, 0.75, fly);
    const m = pt(N / 2), chordY = (tip.y + fly.y) / 2;
    expect(m.y).toBeGreaterThan(chordY + 0.3);
  });
  it('落水後慢慢鬆成懸垂：settle 0→1 連續，最後中段往下垂但不沉進水裡', () => {
    const rel = V(0, 2.6, 0), land = V(0, WY, -12), tip = V(0, 2.2, -0.4), end = V(0.1, WY, -12);
    const prev = new Float32Array(out.length);
    castLine(prev, N, tip, rel, land, end, { k: 1, settle: 0, sag: 0.5, wy: WY });
    for (let st = 0.05; st <= 1.0001; st += 0.05) {
      castLine(out, N, tip, rel, land, end, { k: 1, settle: st, sag: 0.5, wy: WY });
      let jump = 0; for (let i = 0; i < out.length; i++) jump = Math.max(jump, Math.abs(out[i] - prev[i]));
      expect(jump).toBeLessThan(0.6); // 每一小步沒有跳很遠
      prev.set(out);
    }
    const a = pt(0), b = pt(N), m = pt(N / 2);
    expect(a.y).toBeCloseTo(tip.y, 4); expect(b.x).toBeCloseTo(end.x, 4); expect(b.z).toBeCloseTo(end.z, 4);
    expect(m.y).toBeLessThan((tip.y + end.y) / 2 - 0.3);
    for (let i = 0; i <= N; i++) expect(pt(i).y).toBeGreaterThanOrEqual(WY - 1e-6);
  });
  it('假魚在水下：線頭可以在水面下，中段不會穿過去', () => {
    const tip = V(0, 2.2, 0), end = V(0, WY - 0.4, -10), z = V(0, 0, 0);
    castLine(out, N, tip, z, z, end, { k: 1, settle: 1, sag: 0.4, wy: WY });
    expect(pt(N).y).toBeCloseTo(WY - 0.4, 4);
    for (let i = 0; i < N; i++) expect(pt(i).y).toBeGreaterThanOrEqual(Math.min(WY, tip.y + (end.y - tip.y) * i / N) - 1e-6);
  });
});

describe('拋竿：狀態機飛行時間', () => {
  it('castOk 帶飛行時間與放手延遲：剛好飛完才進等魚、HUD 距離跟著走', () => {
    const sm = new FishSM(); sm.gear = 'float'; sm.item = 'worm'; sm.enter(); sm.startCharge();
    sm.tick(0.4, { reel: false, jerk: false, dir: 0 }); sm.release();
    sm.castOk(3, 24, castFlyDur(24), 0.1);
    expect(sm.flyDur).toBeCloseTo(castFlyDur(24) + 0.1);
    sm.tick(castFlyDur(24), { reel: false, jerk: false, dir: 0 });
    expect(sm.phase).toBe('fly');
    expect(fishDistNow({ phase: 'fly', power: 1, item: 'worm', castDst: 24, flyT: sm.flyT, flyDur: sm.flyDur, lureDist: null, floatDist: 0, prog: 0, fightD0: 24 })).toBeGreaterThan(20);
    sm.tick(0.11, { reel: false, jerk: false, dir: 0 });
    expect(sm.phase).toBe('wait');
    const sm2 = new FishSM(); sm2.enter(); sm2.startCharge(); sm2.release(); sm2.castOk(1, 8);
    expect(sm2.flyT).toBeCloseTo(FISH.flyS); // 沒帶就照舊
  });
});
