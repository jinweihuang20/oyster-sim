import { describe, it, expect } from 'vitest';
import { HOIST_S, HOIST_HANG_S, HOIST_TIP_DROP, HOIST_CARD_U, fishLenM, fightCloseK, fightFishDepth, fightFishYaw, newHoist, startHoist, stopHoist, stepHoist, hoistDone, hoistU, hoistMouth, hoistPitch, hoistYaw, fishHeadDir, fishCenterFromMouth } from './fishHoist';

const W = { x: 3, y: 0.02, z: -6 };   // 最後線頭的水面點
const T = { x: 0.4, y: 2.6, z: -1.2 }; // 竿尖
const at = (u: number) => hoistMouth(W.x, W.y, W.z, T.x, T.y, T.z, u, { x: 0, y: 0, z: 0 });

describe('吊魚出水（CR-19）', () => {
  it('t＝0 魚嘴在水面破水點，不在竿尖', () => {
    const p = at(0);
    expect(p.y).toBeCloseTo(W.y, 6);
    expect(p.x).toBeCloseTo(W.x, 6); expect(p.z).toBeCloseTo(W.z, 6);
    expect(Math.hypot(p.x - T.x, p.y - T.y, p.z - T.z)).toBeGreaterThan(3);
  });
  it('t＝1 到竿尖下的掛魚點', () => {
    const p = at(1);
    expect(p.x).toBeCloseTo(T.x, 6); expect(p.z).toBeCloseTo(T.z, 6);
    expect(p.y).toBeCloseTo(T.y - HOIST_TIP_DROP, 6);
  });
  it('高度從水面平順往上（單調、沒 NaN、不會掉回水裡），水平距離一路收近', () => {
    let py = -Infinity, pd = Infinity, maxJump = 0;
    for (let i = 0; i <= 60; i++) {
      const p = at(i / 60);
      for (const v of [p.x, p.y, p.z]) expect(Number.isFinite(v)).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(W.y - 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(py - 1e-9);
      const d = Math.hypot(p.x - T.x, p.z - T.z);
      expect(d).toBeLessThanOrEqual(pd + 1e-9);
      if (i > 0) maxJump = Math.max(maxJump, p.y - py);
      py = p.y; pd = d;
    }
    // 每一步不跳太多（平順）
    expect(maxJump).toBeLessThan(0.2);
  });
  it('弧線：先往上竄、水平後跟（中段已經離水一大半、水平還沒到一半多）', () => {
    const p = at(0.35);
    const upK = (p.y - W.y) / (T.y - HOIST_TIP_DROP - W.y);
    const hK = 1 - Math.hypot(p.x - T.x, p.z - T.z) / Math.hypot(W.x - T.x, W.z - T.z);
    expect(upK).toBeGreaterThan(hK + 0.2);
  });
  it('壞輸入不出 NaN', () => {
    const p = hoistMouth(NaN, 0, 0, 1, 2, 3, NaN, { x: 0, y: 0, z: 0 });
    for (const v of [p.x, p.y, p.z]) expect(Number.isFinite(v)).toBe(true);
    const q = at(Infinity); expect(q.y).toBeCloseTo(T.y - HOIST_TIP_DROP, 6);
    expect(Number.isFinite(hoistPitch(NaN, NaN))).toBe(true);
    expect(Number.isFinite(hoistYaw(NaN, 0.5, 1))).toBe(true);
  });
  it('身體從橫躺轉成頭朝上掛著，甩尾越吊越小', () => {
    expect(Math.abs(hoistPitch(0, 0))).toBeLessThan(0.01);
    const p1 = hoistPitch(1, 0);
    expect(p1).toBeCloseTo(Math.PI / 2, 2);
    // 甩尾振幅：開始大、結束接上掛著晃的 0.12
    let a0 = 0, a1 = 0;
    for (let i = 0; i < 200; i++) { const tt = i * 0.013; a0 = Math.max(a0, Math.abs(hoistPitch(0, tt))); a1 = Math.max(a1, Math.abs(hoistPitch(1, tt) - Math.PI / 2)); }
    expect(a0).toBeGreaterThan(0.4); expect(a1).toBeLessThanOrEqual(0.1201);
  });
  it('魚嘴在線頭、身體在後面（頭朝 +x、長度 1）', () => {
    const m = { x: 1, y: 0, z: 2 }, c = { x: 0, y: 0, z: 0 };
    fishCenterFromMouth(m, 0, 0, 0.8, c);
    expect(c.x).toBeCloseTo(0.6, 6); expect(c.y).toBeCloseTo(0, 6);
    fishCenterFromMouth(m, 0.7, Math.PI / 2, 0.8, c); // 頭朝上：身體在嘴下面
    expect(c.y).toBeCloseTo(-0.4, 6); expect(c.x).toBeCloseTo(1, 6);
    const h = fishHeadDir(Math.PI / 2, 0, { x: 0, y: 0, z: 0 }); // three：yaw π/2 → 頭朝 -z
    expect(h.z).toBeCloseTo(-1, 6);
  });
  it('狀態：開始→走完→掛著；中途跑掉／收竿可以清掉', () => {
    const h = newHoist();
    expect(h.on).toBe(false); expect(hoistU(h)).toBe(1); expect(stepHoist(h, 0.1)).toBe(1);
    startHoist(h, W.x, W.y, W.z, 0.3);
    expect(h.on).toBe(true); expect(hoistU(h)).toBe(0); expect(h.dur).toBe(HOIST_S);
    let u = 0, n = 0;
    while (!hoistDone(h) && n < 200) { u = stepHoist(h, 1 / 60); n++; }
    expect(u).toBe(1);
    expect(n * (1 / 60)).toBeGreaterThanOrEqual(HOIST_S - 1e-6);
    expect(n * (1 / 60)).toBeLessThan(HOIST_S + 0.05);
    stopHoist(h); expect(h.on).toBe(false); expect(h.t).toBe(0);
    // 跑掉（中途取消）
    startHoist(h, 0, 0, 0, 0); stepHoist(h, 0.2); expect(hoistDone(h)).toBe(false);
    stopHoist(h); expect(hoistDone(h)).toBe(true); expect(h.on).toBe(false);
    // 再開一次從 0 開始
    startHoist(h, 0, 0, 0, 0); expect(hoistU(h)).toBe(0);
    // 壞的 dt / dur
    stepHoist(h, NaN); expect(hoistU(h)).toBe(0);
    startHoist(h, 0, 0, 0, 0, 0); expect(h.dur).toBeGreaterThan(0);
  });
  it('節奏：卡片在吊到一大半才跳、吊加掛總長合理（不拖）', () => {
    expect(HOIST_S).toBeGreaterThanOrEqual(0.45); expect(HOIST_S).toBeLessThanOrEqual(0.7);
    expect(HOIST_CARD_U).toBeGreaterThan(0.5); expect(HOIST_CARD_U).toBeLessThan(1);
    expect(HOIST_S + HOIST_HANG_S).toBeLessThan(3);
  });
});

describe('拉扯中魚在水裡（CR-19）', () => {
  it('遠＝沉在水下，拉近才浮上來、會破水', () => {
    expect(fightCloseK(30)).toBe(0); expect(fightCloseK(1.5)).toBe(1);
    // 遠：一直在水下
    for (let i = 0; i < 100; i++) expect(fightFishDepth(20, 1, i * 0.05)).toBeGreaterThan(0.3);
    // 近：最淺會破水（負的）、最深也很淺
    let mn = 1, mx = -1;
    for (let i = 0; i < 200; i++) { const d = fightFishDepth(1.5, 0.8, i * 0.03); mn = Math.min(mn, d); mx = Math.max(mx, d); }
    expect(mn).toBeLessThan(0); expect(mx).toBeLessThan(0.1);
  });
  it('深度隨距離單調（同一時間）、沒 NaN', () => {
    let p = -Infinity;
    for (let d = 1; d <= 30; d += 0.5) { const v = fightFishDepth(d, 0.5, 0); expect(v).toBeGreaterThanOrEqual(p - 1e-9); p = v; }
    expect(Number.isFinite(fightFishDepth(NaN, NaN, NaN))).toBe(true);
  });
  it('魚頭朝人、往衝的那邊甩', () => {
    // 人在 +x 方向：沒衝、尾巴擺到中間（t＝0）＝頭朝 +x（yaw 0）
    expect(fightFishYaw(1, 0, 0, 0, 0.5)).toBeCloseTo(0, 6);
    expect(fightFishYaw(1, 0, 1, 0, 0.5)).toBeGreaterThan(0.5);
    expect(fightFishYaw(1, 0, -1, 0, 0.5)).toBeLessThan(-0.5);
    expect(Number.isFinite(fightFishYaw(NaN, NaN, NaN, NaN, NaN))).toBe(true);
  });
  it('魚長照原本公式（1 kg≈45 cm、夾 0.22～2.2 m）', () => {
    expect(fishLenM(1)).toBeCloseTo(0.45, 6);
    expect(fishLenM(0)).toBeGreaterThanOrEqual(0.22);
    expect(fishLenM(1e6)).toBe(2.2);
    expect(fishLenM(NaN)).toBeGreaterThan(0.22);
  });
});
