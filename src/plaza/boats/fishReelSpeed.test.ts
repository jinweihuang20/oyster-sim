import { describe, it, expect } from 'vitest';
import { REEL, reelMps, reelFightMs, hookFightMs, hookPower, fishPower, newFight, stepFight, fightDistM, fightPumpK, fightTenCeil, lureBadGood, FISH } from './fishLogic';

/** 模擬拉魚：smart＝張力到紅區放一下、路亞往反方向拉；回傳 [秒數, 最快 m/s, 結果] */
function play(power: number, ms: number, d0: number, lure: boolean, rnd: () => number = () => 0.5) {
  const f = newFight(power, ms, lure, d0); const dt = 1 / 60; let reel = true, end = null, prev = d0, vMax = 0;
  while (!end && f.t < 300) {
    if (f.ten >= 0.9) reel = false; else if (f.ten <= 0.55) reel = true;
    end = stepFight(f, reel, f.run === 0 ? 0 : -f.run, dt, rnd);
    const d = fightDistM(f.prog, d0); vMax = Math.max(vMax, (prev - d) / dt); prev = d;
  }
  return { t: f.t, vMax, end };
}

describe('拉魚速度：距離 ÷ 收線速度（看實際公斤數）', () => {
  it('收線速度：小魚 3.5～4.2 m/s，越重越慢，稀有度只慢一點', () => {
    expect(reelMps(0.5, 0)).toBeGreaterThan(3.5); expect(reelMps(0.5, 0)).toBeLessThan(4.2);
    expect(reelMps(3.5, 0)).toBeGreaterThan(2); expect(reelMps(3.5, 0)).toBeLessThan(3.4);
    expect(reelMps(20, 2)).toBeGreaterThan(1); expect(reelMps(20, 2)).toBeLessThan(1.9);
    expect(reelMps(850, 3)).toBeGreaterThan(0.5); expect(reelMps(850, 3)).toBeLessThan(0.6);
    let prev = 99;
    for (const kg of [0.3, 0.6, 1, 3.5, 10, 40, 60, 320, 850]) { const v = reelMps(kg, 0); expect(v).toBeLessThan(prev); prev = v; }
    // 0.6 kg 稀有花枝比 3.5 kg 普通嘉鱲快
    expect(reelMps(0.6, 1)).toBeGreaterThan(reelMps(3.5, 0));
  });
  it('0.5 kg 小魚：8 m 約 2 秒、30 m 約 8 秒（以前 30 m 1.45 秒 ≈ 20 m/s 的魚雷）', () => {
    for (const lure of [false, true]) {
      const near = play(fishPower(0.5, 0), reelFightMs(8, reelMps(0.5, 0)), 8, lure), far = play(fishPower(0.5, 0), reelFightMs(30, reelMps(0.5, 0)), 30, lure);
      expect(near.end).toBe('landed'); expect(far.end).toBe('landed');
      expect(near.t).toBeGreaterThan(1.7); expect(near.t).toBeLessThan(2.6);
      expect(far.t).toBeGreaterThan(6.6); expect(far.t).toBeLessThan(8.6);
      expect(30 / far.t).toBeLessThan(REEL.capMps + 0.05);
      // 畫面上最快也不超過 4.5 m/s（路亞往反方向拉得再好也一樣）
      expect(near.vMax).toBeLessThanOrEqual(REEL.capMps + 1e-6); expect(far.vMax).toBeLessThanOrEqual(REEL.capMps + 1e-6);
    }
    // 垂釣一直收：剛好照伺服器時間
    const ms = reelFightMs(30, reelMps(0.5, 0));
    expect(play(fishPower(0.5, 0), ms, 30, false).t * 1000).toBeCloseTo(ms, -2);
  });
  it('小魚一直收線不會爆線；大魚照樣要一放一收', () => {
    expect(fightTenCeil(0.3)).toBeLessThan(FISH.snapT);
    const f = newFight(0.3, 8000, false, 30); let r = null;
    for (let i = 0; i < 60 * 20 && !r; i++) r = stepFight(f, true, 0, 1 / 60);
    expect(r).toBe('landed');
    const g = newFight(0.9, 20000, false, 30); r = null;
    for (let i = 0; i < 600 && !r; i++) r = stepFight(g, true, 0, 1 / 60);
    expect(r).toBe('snap');
  });
  it('重的比輕的慢：同 20 m，0.5 kg < 3.5 kg < 20 kg < 320 kg', () => {
    const t = [[0.5, 0], [3.5, 0], [20, 2], [320, 3]].map(([kg, tier]) => {
      return play(fishPower(kg, tier), reelFightMs(20, reelMps(kg, tier)), 20, true, Math.random).t;
    });
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    // 巨物 20 m：大約 25～60 秒，刺激但不拖
    expect(t[3]).toBeGreaterThan(20); expect(t[3]).toBeLessThan(60);
  });
  it('時間夾在 1.5～55 秒；最快拉完一定比伺服器最短時間（× 0.4）長', () => {
    expect(reelFightMs(2, 4.2)).toBe(REEL.minMs);
    expect(reelFightMs(45, reelMps(850, 3))).toBe(REEL.maxMs);
    for (const [kg, tier] of [[0.3, 0], [3.5, 0], [20, 2], [320, 3], [850, 3]])
      for (const d of [4, 10, 30]) {
        const power = fishPower(kg, tier);
        const ms = reelFightMs(d, reelMps(kg, tier));
        // 路亞一直反方向拉、從不放：最快
        const f = newFight(power, ms, true, d); f.ten = 0.5; let t = 0; const dt = 1 / 120;
        while (f.prog < 1) { f.prog += Math.min(f.rate * (f.pump ?? 1) * 1.35, f.cap ?? Infinity) * dt; t += dt; }
        expect(t * 1000).toBeGreaterThan(Math.max(600, ms * 0.4 - 450));
        expect(fightPumpK(power)).toBeLessThanOrEqual(1.45);
      }
  });
  it('新伺服器（有 mps）用實際中魚距離；舊伺服器沒 mps 不比它的最短時間快', () => {
    // 拋 30 m、收到 10 m 才咬：照 10 m 算
    expect(hookFightMs(10, 0.5, 0, 3.8, 7900)).toBe(reelFightMs(10, 3.8));
    // 舊伺服器：0.5 kg 普通魚 fightMs 2000 → 30 m 照新的（較慢）算
    expect(hookFightMs(30, 0.5, 0, undefined, 2000)).toBe(reelFightMs(30, reelMps(0.5, 0)));
    // 舊伺服器：稀有魚 fightMs 10 秒、8 m → 至少 0.7 倍
    const ms = hookFightMs(8, 0.6, 1, undefined, 10000, 0.6);
    expect(ms).toBeGreaterThanOrEqual(10000 * 0.5 * 1.35 * fightPumpK(0.6));
  });
  it('0.18 kg 小魚張力輕鬆，路亞沒帶竿也不進紅區、不會斷線', () => {
    const p0 = fishPower(0.18, 0), p1 = fishPower(0.18, 1);
    expect(p0).toBeCloseTo(0.11, 2);
    expect(p1).toBeGreaterThanOrEqual(p0);
    expect(p1).toBeLessThanOrEqual(0.16);
    expect(fightTenCeil(p0)).toBeCloseTo(0.42, 2);
    expect(fightTenCeil(fishPower(0.5, 0))).toBeCloseTo(0.55, 2);
    expect(fightTenCeil(fishPower(3.5, 0))).toBeCloseTo(0.84, 2);
    expect(lureBadGood(0.11)).toBeCloseTo(0.88, 5);
    expect(lureBadGood(0.45)).toBeCloseTo(0.6, 5);
    for (const [power, lure] of [[p0, false], [p0, true], [p1, true]] as const) {
      const f = newFight(power, reelFightMs(30, reelMps(0.18, lure ? 1 : 0)), lure, 30);
      let r = null, tenMax = 0;
      for (let i = 0; i < 60 * 40 && !r; i++) {
        r = stepFight(f, true, 0, 1 / 60, () => 0.9);
        tenMax = Math.max(tenMax, f.ten);
      }
      expect(r).toBe('landed');
      expect(tenMax).toBeGreaterThanOrEqual(0.35);
      expect(tenMax).toBeLessThan(FISH.redT);
      expect(tenMax).toBeLessThanOrEqual(0.55);
    }
  });
  it('舊伺服器沒 mps、把 0.18 kg 稀有魚 power 給成 0.65 時，改用 fishPower 保持輕鬆', () => {
    expect(hookPower(0.18, 1, 0.65)).toBe(fishPower(0.18, 1));
    expect(hookPower(0.18, 1, 0.65, 0)).toBe(fishPower(0.18, 1));
    expect(hookPower(0.18, 1, 0.65, 3.8)).toBe(0.65);
    const p = hookPower(0.18, 1, 0.65);
    const f = newFight(p, hookFightMs(30, 0.18, 1, undefined, 2500, p), true, 30);
    let r = null, tenMax = 0;
    for (let i = 0; i < 60 * 40 && !r; i++) {
      r = stepFight(f, true, 0, 1 / 60, () => 0.9);
      tenMax = Math.max(tenMax, f.ten);
    }
    expect(r).toBe('landed');
    expect(tenMax).toBeLessThan(FISH.redT);
    expect(tenMax).toBeLessThanOrEqual(0.55);
  });
  it('中型魚張力會進紅區、大魚和巨物一直收會斷線', () => {
    expect(fightTenCeil(fishPower(3.5, 0))).toBeGreaterThanOrEqual(FISH.redT);
    expect(fightTenCeil(fishPower(3.5, 0))).toBeLessThan(FISH.snapT);
    expect(fightTenCeil(fishPower(20, 2))).toBeGreaterThanOrEqual(FISH.snapT);
    expect(fightTenCeil(fishPower(320, 3))).toBeGreaterThanOrEqual(FISH.snapT);
    for (const [kg, tier] of [[20, 2], [320, 3]] as const) {
      const g = newFight(fishPower(kg, tier), reelFightMs(30, reelMps(kg, tier)), false, 30);
      let r = null;
      for (let i = 0; i < 60 * 20 && !r; i++) r = stepFight(g, true, 0, 1 / 60);
      expect(r).toBe('snap');
    }
  });

});
