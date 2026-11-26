import { describe, it, expect } from 'vitest';
import { FISH, castDist, fishDistNow, fmtDistM, fightDistM, newFight, stepFight, bigPull, FIGHT_P0, FIGHT_PROG_MIN, FIGHT_MAX_M, type FishDistIn } from './fishLogic';

const base = (o: Partial<FishDistIn>): FishDistIn => ({ phase: 'idle', power: 0, item: 'shrimp', castDst: 20, flyT: 0, lureDist: null, floatDist: 0, prog: 0, fightD0: 20, ...o });

describe('HUD 一直顯示現在幾公尺', () => {
  it('蓄力：跟著力道即時變（垂釣竿 4～24 m、路亞看假魚）', () => {
    expect(fishDistNow(base({ phase: 'charge', power: 0 }))).toBe(4);
    expect(fishDistNow(base({ phase: 'charge', power: 1 }))).toBe(24);
    expect(fishDistNow(base({ phase: 'charge', power: 1, item: 'slowjig' }))).toBe(42);
    expect(fishDistNow(base({ phase: 'cast', power: 0.5, item: 'jig' }))).toBe(castDist(0.5, 'jig'));
  });
  it('甩出去：從 0 長到落點', () => {
    expect(fishDistNow(base({ phase: 'fly', flyT: FISH.flyS }))).toBe(0);
    expect(fishDistNow(base({ phase: 'fly', flyT: FISH.flyS / 2 }))).toBeCloseTo(10);
    expect(fishDistNow(base({ phase: 'fly', flyT: 0 }))).toBe(20);
  });
  it('等魚／咬餌／沉／收竿：浮標實際距離（船漂會變）、路亞看假魚離多遠', () => {
    for (const phase of ['wait', 'nibble', 'sink', 'hook'] as const) {
      expect(fishDistNow(base({ phase, floatDist: 17.3 }))).toBe(17.3);
      expect(fishDistNow(base({ phase, lureDist: 8.2, floatDist: 30 }))).toBe(8.2);
    }
  });
  it('拉魚：從中魚時的距離開始，拉近到 0 m', () => {
    expect(fishDistNow(base({ phase: 'fight', prog: FIGHT_P0, fightD0: 18 }))).toBeCloseTo(18);
    expect(fishDistNow(base({ phase: 'fight', prog: 0.6, fightD0: 18 }))).toBeCloseTo(9);
    expect(fishDistNow(base({ phase: 'land', prog: 1, fightD0: 18 }))).toBe(0);
    // 被拉出去：比中魚時還遠，最多 1.8 倍、也不超過 60 m
    expect(fightDistM(FIGHT_PROG_MIN, 18)).toBeCloseTo(18 * 1.8, 5);
    expect(fightDistM(FIGHT_PROG_MIN, 40)).toBe(FIGHT_MAX_M);
  });
  it('準備好／沒在釣：不顯示', () => {
    expect(fishDistNow(base({ phase: 'idle' }))).toBeNull();
    expect(fishDistNow(base({ phase: 'off' }))).toBeNull();
    expect(fmtDistM(null)).toBe('');
  });
  it('顯示格式：10 m 以上整數、以下一位小數、最後是 0 m', () => {
    expect(fmtDistM(24)).toBe('24 m'); expect(fmtDistM(23.6)).toBe('24 m');
    expect(fmtDistM(9.94)).toBe('9.9 m'); expect(fmtDistM(0.4)).toBe('0.4 m');
    expect(fmtDistM(0.01)).toBe('0 m'); expect(fmtDistM(-3)).toBe('0 m'); expect(fmtDistM(NaN)).toBe('');
  });
});

describe('大魚往回拉線：不跟牠拉扯距離就一直變遠', () => {
  const dt = 1 / 30, fixed = (v: number) => () => v;
  const slack = (power: number, secs: number) => {
    const f = newFight(power, 20_000, false);
    // 垂釣竿：不會因為鬆線脫鉤；只看距離
    for (let i = 0; i < secs / dt; i++) stepFight(f, false, 0, dt, fixed(0.5));
    return fightDistM(f.prog, 18);
  };
  it('不收線：大魚（power ≥ 0.8）把線拉出去比小魚（≤ 0.3）快很多，而且超過中魚時的距離', () => {
    expect(bigPull(0.3)).toBe(0); expect(bigPull(1)).toBe(1); expect(bigPull(0.8)).toBeGreaterThan(0.35);
    const small = slack(0.3, 3), big = slack(0.85, 3), huge = slack(1, 3);
    expect(small).toBeLessThan(18 * 1.05);
    expect(big).toBeGreaterThan(18 * 1.15);
    expect(huge).toBeGreaterThan(big);
    expect(big - 18).toBeGreaterThan((small - 18) * 4);
    // 一直放著：拉到線軸底（1.8 倍）
    expect(slack(1, 30)).toBeCloseTo(18 * 1.8, 3);
  });
  it('距離是一秒一秒往上爬（看得到 18 → 21 → 25 m 那樣在變）', () => {
    const f = newFight(1, 20_000, false); let prev = fightDistM(f.prog, 18); const seen: number[] = [];
    for (let s = 0; s < 4; s++) { for (let i = 0; i < 1 / dt; i++) stepFight(f, false, 0, dt, fixed(0.5)); const d = fightDistM(f.prog, 18); expect(d).toBeGreaterThan(prev + 0.5); seen.push(d); prev = d; }
    expect(seen[3]).toBeGreaterThan(24);
  });
  it('路亞：大魚在衝、沒反方向拉，就算收線也會被拉出去；反方向拉就收得回來、照樣釣得上來', () => {
    // rnd 0.9 → 魚往右衝（run＝1）
    const a = newFight(1, 20_000, true), b = newFight(1, 20_000, true);
    // 第 1 秒魚開始衝（run＝1），之後量 1.5 秒
    for (let i = 0; i < 1.05 / dt; i++) { stepFight(a, true, 0, dt, fixed(0.9)); stepFight(b, true, -1, dt, fixed(0.9)); }
    expect(a.run).toBe(1);
    const a0 = fightDistM(a.prog, 18), b0 = fightDistM(b.prog, 18);
    for (let i = 0; i < 1.5 / dt; i++) { a.ten = 0.5; b.ten = 0.5; stepFight(a, true, 0, dt, fixed(0.9)); stepFight(b, true, -1, dt, fixed(0.9)); }
    expect(fightDistM(a.prog, 18)).toBeGreaterThan(a0 + 0.3);
    expect(fightDistM(b.prog, 18)).toBeLessThan(b0 - 2);
  });
  it('巨物也公平：收線＋反方向拉、張力到紅區就放一下，拉得上來（不斷線、不脫鉤）', () => {
    for (const power of [0.85, 1]) {
      const f = newFight(power, 40_000, true); let end = null, t = 0, minD = 99;
      let reel = true;
      while (!end && t < 120) {
        if (f.ten >= 0.88) reel = false; else if (f.ten <= 0.55) reel = true;
        end = stepFight(f, reel, f.run === 0 ? 0 : -f.run, dt, Math.random); t += dt;
        minD = Math.min(minD, fightDistM(f.prog, 18));
      }
      expect(end).toBe('landed');
      expect(minD).toBe(0);
      expect(t).toBeLessThan(80);
    }
  });
});
