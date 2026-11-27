import { describe, it, expect } from 'vitest';
import { FISH, FishSM, newFight, stepFight, fullFight, hookFightMs, hookPower, fishPower, fightDistM, type FightEnd } from './fishLogic';
import { newLineW, lineWStart, lineWDist, newFightW, fightWStart, stepFightW } from './fishWorld';
import { remoteFightSide } from './fishSync';
import { fishPoseCode, fishSteerOf } from './fishPose';

const DT = 1 / 60;
/** 固定亂數：0.7 → 魚往右衝（run＝1） */
const rndRight = () => 0.7;
const rndStill = () => 0.1;

/** 垂釣：拋竿 → 等魚 → 試吃 → 浮標沉下去 → 收竿 → 伺服器說中魚 */
function floatHook(power = 0.3, ms = 6000, d0 = 14) {
  const sm = new FishSM();
  sm.gear = 'float'; sm.item = 'shrimp';
  sm.enter(); sm.startCharge(); sm.tick(0.4, { reel: false, jerk: false, dir: 0 });
  expect(sm.release()).not.toBeNull();
  sm.castOk(1, d0);
  for (let i = 0; i < 60 && sm.phase === 'fly'; i++) sm.tick(DT, { reel: false, jerk: false, dir: 0 });
  expect(sm.phase).toBe('wait');
  sm.bite(500);
  expect(sm.phase).toBe('nibble');
  let ev = null;
  for (let i = 0; i < 120 && sm.phase === 'nibble'; i++) ev = sm.tick(DT, { reel: false, jerk: false, dir: 0 });
  expect(ev).toBe('sink');
  expect(sm.pressReel()).toBe(true);
  expect(sm.phase).toBe('hook');
  sm.hooked(power, ms, d0);
  return sm;
}
function run(sm: FishSM, inp: (t: number) => { reel: boolean; dir: number }, rnd: () => number, maxS = 120) {
  let ev: ReturnType<FishSM['tick']> = null, t = 0;
  while (!ev && t < maxS) { const i = inp(t); ev = sm.tick(DT, { reel: i.reel, jerk: false, dir: i.dir }, rnd); t += DT; }
  return { ev, t };
}

describe('CR-34 垂釣中魚後跟路亞一樣進全套搏鬥', () => {
  it('浮標沉下去收竿 → 中魚進 fight（不是直接釣上來），而且是全套搏鬥', () => {
    const sm = floatHook();
    expect(sm.phase).toBe('fight');
    expect(sm.fight).not.toBeNull();
    expect(sm.fight!.lure).toBe(true);
    expect(fullFight('float')).toBe(true);
    expect(fullFight('lure')).toBe(true);
    // 剛中魚還沒拉上來
    expect(sm.tick(DT, { reel: true, jerk: false, dir: 0 }, rndStill)).toBeNull();
    expect(sm.fight!.prog).toBeLessThan(1);
  });
  it('垂釣跟路亞同一條魚、同樣輸入：搏鬥完全一樣', () => {
    const a = floatHook(0.5, 9000, 16);
    const b = new FishSM(); b.gear = 'lure'; b.item = 'minnow'; b.phase = 'hook'; b.hooked(0.5, 9000, 16);
    for (let i = 0; i < 400; i++) {
      const inp = { reel: i % 90 < 60, jerk: false, dir: i % 200 < 100 ? -1 : 1 };
      const ea = a.tick(DT, inp, rndRight), eb = b.tick(DT, inp, rndRight);
      expect(ea).toBe(eb);
      expect(a.fight?.prog).toBeCloseTo(b.fight?.prog ?? 0, 9);
      expect(a.fight?.ten).toBeCloseTo(b.fight?.ten ?? 0, 9);
      if (ea) break;
    }
  });
  it('魚會左右衝；搖桿往反方向拉收得比較快、張力比較低', () => {
    const good = floatHook(0.4, 8000), bad = floatHook(0.4, 8000);
    for (let i = 0; i < 60; i++) {
      good.tick(DT, { reel: true, jerk: false, dir: -1 }, rndRight);
      bad.tick(DT, { reel: true, jerk: false, dir: 1 }, rndRight);
    }
    expect(good.fight!.run).toBe(1);
    expect(good.fight!.prog).toBeGreaterThan(bad.fight!.prog);
    expect(good.fight!.ten).toBeLessThan(bad.fight!.ten);
  });
  it('小魚（CR-24 輕手感）：一直收線不會爆線，很快就拉上來', () => {
    const p = hookPower(0.25, 0);
    expect(p).toBeLessThan(0.2);
    const d0 = 10, sm = floatHook(p, hookFightMs(d0, 0.25, 0, 4.1), d0);
    const r = run(sm, () => ({ reel: true, dir: 0 }), rndRight);
    expect(r.ev).toBe('landed');
    expect(r.t).toBeLessThan(6);
  });
  it('大魚一直按著收線會斷線', () => {
    const sm = floatHook(fishPower(60, 2), 30000, 20);
    expect(run(sm, () => ({ reel: true, dir: 0 }), rndStill).ev).toBe('snap');
  });
  it('大魚一放一收（張力到紅區就放）可以拉上來', () => {
    const sm = floatHook(fishPower(20, 1), 15000, 18);
    let hold = true;
    const r = run(sm, () => { const ten = sm.fight?.ten ?? 0; if (ten >= FISH.redT) hold = false; else if (ten < 0.45) hold = true; return { reel: hold, dir: -(sm.fight?.run ?? 0) }; }, rndRight, 200);
    expect(r.ev).toBe('landed');
  });
  it('線放太鬆太久：魚脫鉤跑掉', () => {
    const sm = floatHook(0.3, 8000);
    expect(run(sm, () => ({ reel: false, dir: 0 }), rndStill).ev).toBe('unhook');
    expect(sm.phase).toBe('land');
    sm.reset();
    expect(sm.phase).toBe('idle');
    expect(sm.fight).toBeNull();
  });
  it('拉上來不會比伺服器最短拉扯時間快（新舊伺服器都一樣，不會被判 too_fast）', () => {
    for (const [kg, tier, d0] of [[0.3, 0, 6], [2, 1, 14], [12, 2, 22]] as const) {
      const mps = 3, ms = hookFightMs(d0, kg, tier, mps), power = hookPower(kg, tier, 0.4, mps);
      const sm = floatHook(power, ms, d0);
      let hold = true;
      const r = run(sm, () => { const ten = sm.fight?.ten ?? 0; if (ten >= FISH.redT) hold = false; else if (ten < 0.4) hold = true; return { reel: hold, dir: -(sm.fight?.run ?? 0) }; }, rndRight, 200);
      expect(r.ev).toBe('landed');
      // 伺服器 FishMinFightMs ＝ 時間 × 2／5 − 延遲
      expect(r.t * 1000).toBeGreaterThanOrEqual(ms * 0.4);
    }
  });
});

describe('CR-34 垂釣搏鬥用 CR-31 真實世界座標（從浮標的位置開始）', () => {
  /** 跟 plazaFish doReel 一樣：魚從浮標的世界位置開始拉 */
  function startAtFloat(fx: number, fz: number, ax: number, az: number) {
    const lw = lineWStart(newLineW(), fx, fz, ax, az, Math.hypot(fx - ax, fz - az));
    const d0 = Math.max(1.5, lineWDist(lw, ax, az)), r0 = lineWDist(lw, ax, az), k = d0 / r0;
    return { d0, fw: fightWStart(newFightW(), ax + (lw.x - ax) * k, az + (lw.z - az) * k, ax, az, d0) };
  }
  it('魚一開始就在浮標那裡', () => {
    const { fw, d0 } = startAtFloat(-40, 12, -30, 0);
    expect(fw.x).toBeCloseTo(-40, 9); expect(fw.z).toBeCloseTo(12, 9);
    expect(d0).toBeCloseTo(Math.hypot(10, 12), 9);
  });
  it('船開離魚：線被拉出去、張力上來；開向魚：距離變短、張力掉', () => {
    const away = startAtFloat(0, -15, 0, 0), toward = startAtFloat(0, -15, 0, 0);
    const sa = floatHook(0.4, 9000, away.d0), st = floatHook(0.4, 9000, toward.d0);
    let za = 0, zt = 0;
    for (let i = 0; i < 90; i++) {
      sa.tick(DT, { reel: false, jerk: false, dir: 0 }, rndStill); za += 2 * DT; stepFightW(away.fw, sa.fight!, 0, za, 0, DT);
      st.tick(DT, { reel: false, jerk: false, dir: 0 }, rndStill); zt -= 2 * DT; stepFightW(toward.fw, st.fight!, 0, zt, 0, DT);
    }
    expect(sa.fight!.prog).toBeLessThan(st.fight!.prog);
    expect(sa.fight!.ten).toBeGreaterThan(st.fight!.ten);
    expect(lineWDist(toward.fw, 0, zt)).toBeLessThan(fightDistM(st.fight!.prog, toward.d0) + 1e-6);
    expect(lineWDist(toward.fw, 0, zt)).toBeLessThan(15);
  });
  it('魚往左右衝時在世界座標裡繞著人游', () => {
    const { fw, d0 } = startAtFloat(0, -12, 0, 0);
    const sm = floatHook(0.4, 9000, d0);
    let end: FightEnd | 'landed' | null = null;
    for (let i = 0; i < 60 && !end; i++) { end = sm.tick(DT, { reel: true, jerk: false, dir: -1 }, rndRight) as FightEnd; stepFightW(fw, sm.fight!, 0, 0, 2.2 * sm.fight!.run, DT); }
    expect(sm.fight!.run).toBe(1);
    expect(Math.abs(fw.x)).toBeGreaterThan(1);
  });
});

describe('CR-34 同步／回放：垂釣搏鬥的左右拉也看得到', () => {
  it('垂釣拉魚的姿勢碼帶左右拉方向，別人畫面線頭往反方向偏', () => {
    const c = fishPoseCode('fight', true, false, -1);
    expect(c & 16).toBe(0);
    expect(fishSteerOf(c)).toBe(-1);
    expect(remoteFightSide(-1, false, 0.3, 0.5)).toBeCloseTo(2.2, 6);
    expect(remoteFightSide(1, false, 0.3, 0.5)).toBeCloseTo(-2.2, 6);
  });
});
