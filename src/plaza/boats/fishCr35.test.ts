import { describe, it, expect } from 'vitest';
import { FISH, fishPower, fightTenCeil, newFight, stepFight, reelMps, reelFightMs, type FightEnd } from './fishLogic';

const DT = 1 / 60;
/** 固定亂數：0.7 → 魚往右衝（run＝1），衝刺約 2.3 秒一輪 */
const rndDash = () => 0.7;

function fightOf(kg: number, tier: number, d0: number, lure = true) {
  const power = fishPower(kg, tier);
  return { power, d0, f: newFight(power, reelFightMs(d0, reelMps(kg, tier)), lure, d0) };
}

/** 模擬拉魚直到結束或超時。dir 可以是數字，或依當下 run 計算。 */
function play(
  kg: number, tier: number, d0: number,
  inp: (f: ReturnType<typeof newFight>) => { reel: boolean; dir: number },
  rnd: () => number = rndDash, maxS = 60,
) {
  const { f, power } = fightOf(kg, tier, d0);
  let end: FightEnd = null, tenMax = 0;
  while (!end && f.t < maxS) {
    const i = inp(f);
    end = stepFight(f, i.reel, i.dir, DT, rnd);
    tenMax = Math.max(tenMax, f.ten);
  }
  return { end, t: f.t, tenMax, power, ten: f.ten };
}

describe('CR-35 搏鬥張力上限：1 kg 以下輕鬆、1.5–2 kg 起硬拉會斷線', () => {
  it('公斤分界：1 kg 不斷線，1.5 kg 起 ceil ≥ 斷線門檻；大魚仍超過斷線門檻', () => {
    expect(fishPower(0.18, 0)).toBeCloseTo(0.11, 2);
    expect(fightTenCeil(fishPower(0.18, 0))).toBeCloseTo(0.45, 2);
    expect(fightTenCeil(fishPower(0.18, 0))).toBeLessThan(FISH.redT);

    expect(fishPower(0.5, 0)).toBeCloseTo(0.20, 2);
    expect(fightTenCeil(fishPower(0.5, 0))).toBeCloseTo(0.675, 2);
    expect(fightTenCeil(fishPower(0.5, 0))).toBeLessThan(FISH.redT);

    expect(fishPower(1, 0)).toBeCloseTo(0.26, 2);
    const c1 = fightTenCeil(fishPower(1, 0));
    expect(c1).toBeCloseTo(0.825, 2);
    expect(c1).toBeGreaterThanOrEqual(0.80);
    expect(c1).toBeLessThan(FISH.snapT);

    expect(fishPower(1.5, 0)).toBeCloseTo(0.31, 2);
    expect(fightTenCeil(fishPower(1.5, 0))).toBeGreaterThanOrEqual(FISH.snapT);
    expect(fishPower(2, 0)).toBeCloseTo(0.34, 2);
    expect(fightTenCeil(fishPower(2, 0))).toBeGreaterThanOrEqual(FISH.snapT);
    expect(fishPower(3.5, 0)).toBeCloseTo(0.40, 2);
    expect(fightTenCeil(fishPower(3.5, 0))).toBeGreaterThanOrEqual(FISH.snapT);

    expect(fightTenCeil(fishPower(20, 0))).toBeGreaterThanOrEqual(FISH.snapT);
    expect(fightTenCeil(fishPower(20, 2))).toBeGreaterThanOrEqual(FISH.snapT);
    expect(fightTenCeil(fishPower(320, 3))).toBeGreaterThanOrEqual(FISH.snapT);
  });

  it('0.18 kg、0.2 kg、0.5 kg 小魚：一直按收線、不反拉也不會進紅區或斷線', () => {
    for (const kg of [0.18, 0.2, 0.5]) {
      const r = play(kg, 0, 20, () => ({ reel: true, dir: 0 }));
      expect(r.end).toBe('landed');
      expect(r.tenMax).toBeGreaterThan(0.3);
      expect(r.tenMax).toBeLessThan(FISH.redT);
      expect(r.tenMax).toBeLessThan(FISH.snapT);
    }
  });

  it('1 kg：一直收可不斷線，張力可以到偏高但不爆線', () => {
    const r = play(1, 0, 18, () => ({ reel: true, dir: 0 }));
    expect(r.end).toBe('landed');
    expect(r.tenMax).toBeGreaterThan(0.7);
    expect(r.tenMax).toBeLessThan(FISH.snapT);
  });

  it('2 kg、3.5 kg：一直收線又不反拉，典型 4–8 秒搏鬥內會斷線', () => {
    for (const kg of [2, 3.5]) {
      const r = play(kg, 0, 16, () => ({ reel: true, dir: 0 }), rndDash, 20);
      expect(r.end).toBe('snap');
      expect(r.t).toBeGreaterThan(0.8);
      expect(r.t).toBeLessThan(8);
      expect(r.tenMax).toBeGreaterThanOrEqual(FISH.snapT);
    }
  });

  it('2 kg、3.5 kg：一直按收線，就算反拉正確也會斷線', () => {
    for (const kg of [2, 3.5]) {
      // 距離拉長一點，死按收線時張力一定先頂破斷線門檻
      const r = play(kg, 0, 28, (f) => ({ reel: true, dir: f.run === 0 ? 0 : -f.run }), rndDash, 40);
      expect(r.end).toBe('snap');
      expect(r.tenMax).toBeGreaterThanOrEqual(FISH.snapT);
    }
  });

  it('2 kg、3.5 kg：張力到紅區就放、有反拉，可以乾淨拉上來', () => {
    for (const kg of [2, 3.5]) {
      let hold = true;
      const r = play(kg, 0, 16, (f) => {
        if (f.ten >= FISH.redT) hold = false; else if (f.ten < 0.45) hold = true;
        return { reel: hold, dir: f.run === 0 ? 0 : -f.run };
      }, rndDash, 40);
      expect(r.end).toBe('landed');
    }
  });

  it('20 kg 以上大魚：一直死按會斷線；一放一收加反拉可以拉上來', () => {
    const snap = play(20, 2, 20, () => ({ reel: true, dir: 0 }), rndDash, 30);
    expect(snap.end).toBe('snap');
    expect(snap.tenMax).toBeGreaterThanOrEqual(FISH.snapT);

    let hold = true;
    const land = play(20, 2, 20, (f) => {
      if (f.ten >= FISH.redT) hold = false; else if (f.ten < 0.45) hold = true;
      return { reel: hold, dir: f.run === 0 ? 0 : -f.run };
    }, rndDash, 80);
    expect(land.end).toBe('landed');
  });

  it('20 kg 大魚：只反拉、一直按收線（不放）仍會斷線（還是要一放一收）', () => {
    const r = play(20, 2, 20, (f) => ({ reel: true, dir: f.run === 0 ? 0 : -f.run }), rndDash, 30);
    expect(r.end).toBe('snap');
  });
});
