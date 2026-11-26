import { describe, it, expect } from 'vitest';
import { FISH, FishSM, chargePower, castDist, castPoint, yawOf, newLure, stepLure, rhythmOk, newFight, stepFight, trollOk, oysterLeft, taipeiDay } from './fishLogic';

const run = (sm: FishSM, s: number, inp = { reel: false, jerk: false, dir: 0 }) => { const evs: string[] = []; for (let t = 0; t < s; t += 1 / 60) { const e = sm.tick(1 / 60, inp); if (e) evs.push(e); } return evs; };

describe('釣魚：拋竿', () => {
  it('力道條來回擺、距離 4～16 m、落點在面向前方', () => {
    expect(chargePower(0)).toBe(0);
    expect(chargePower(FISH.chargePeriod / 2)).toBeCloseTo(1);
    expect(chargePower(FISH.chargePeriod)).toBeCloseTo(0);
    expect(castDist(0)).toBe(4); expect(castDist(1)).toBe(16); expect(castDist(9)).toBe(16);
    const p = castPoint(-30, 0, Math.PI / 2, 0.5);
    expect(p.x).toBeCloseTo(-40); expect(p.z).toBeCloseTo(0);
    expect(yawOf(-1, 0)).toBeCloseTo(Math.PI / 2);
  });
  it('拖釣：乘客、米諾／鐵板、船速 0.8～3.5', () => {
    expect(trollOk(1, 'minnow', 2)).toBe(true);
    expect(trollOk(0, 'minnow', 2)).toBe(false);
    expect(trollOk(1, 'soft', 2)).toBe(false);
    expect(trollOk(1, 'jig', 5)).toBe(false);
  });
  it('蚵仔肉每天 20 塊，隔天重算', () => {
    const d = taipeiDay(Date.UTC(2026, 10, 25, 20, 0)); // 台北 11/26 04:00
    expect(d).toBe(20261126);
    expect(oysterLeft(d, d, 5)).toBe(15);
    expect(oysterLeft(d, d - 1, 20)).toBe(20);
  });
});

describe('釣魚：狀態機', () => {
  it('垂釣：蓄力 → 拋 → 等 → 小抖 → 沉 → 收竿 → 拉扯 → 上岸', () => {
    const sm = new FishSM(); sm.gear = 'float'; sm.item = 'worm';
    expect(sm.startCharge()).toBe(false); // 還沒進釣魚模式
    sm.enter();
    expect(sm.startCharge()).toBe(true);
    run(sm, FISH.chargePeriod / 2);
    const pw = sm.release()!;
    expect(pw).toBeGreaterThan(0.9);
    expect(sm.phase).toBe('cast');
    sm.castOk(7, castDist(pw));
    expect(sm.phase).toBe('fly');
    run(sm, FISH.flyS + 0.05);
    expect(sm.phase).toBe('wait');
    sm.bite(1000);
    expect(sm.phase).toBe('nibble');
    expect(run(sm, 1.05)).toEqual(['sink']);
    expect(sm.pressReel()).toBe(true);
    expect(sm.phase).toBe('hook');
    sm.hooked(0.3, 2500);
    expect(sm.phase).toBe('fight');
    // 收收停停：張力不爆，幾秒內拉上來
    let ev: string | null = null;
    for (let i = 0; i < 60 * 10 && !ev; i++) ev = sm.tick(1 / 60, { reel: sm.fight!.ten < 0.7, jerk: false, dir: 0 });
    expect(ev).toBe('landed');
    expect(sm.phase).toBe('land');
    sm.reset(); expect(sm.phase).toBe('idle');
  });
  it('沉下去沒收：時間窗過了就 missed', () => {
    const sm = new FishSM(); sm.enter(); sm.startCharge(); sm.release(); sm.castOk(1, 8); run(sm, 1);
    sm.bite(0);
    expect(sm.phase).toBe('sink');
    expect(run(sm, FISH.windowS + 0.5)).toEqual(['missed']);
  });
  it('路亞：收線收到腳邊就 back', () => {
    const sm = new FishSM(); sm.gear = 'lure'; sm.item = 'minnow'; sm.enter(); sm.startCharge(); sm.release(); sm.castOk(1, 10); run(sm, 1);
    expect(sm.lure).not.toBeNull();
    const evs = run(sm, 8, { reel: true, jerk: false, dir: 0 });
    expect(evs).toContain('back');
  });
});

describe('釣魚：路亞節奏', () => {
  const sim = (item: 'minnow' | 'jig' | 'soft' | 'popper', pat: (t: number) => { reel: boolean; jerk: boolean }, s = 6) => {
    const l = newLure(60, item); let t = 0;
    while (t < s) { const p = pat(t); stepLure(l, item, p.reel, p.jerk, 1 / 60); t += 1 / 60; }
    return l;
  };
  const every = (t: number, per: number) => Math.floor(t * 60) % Math.round(per * 60) === 0;
  it('米諾：一直收＋偶爾抽 → 對；只慢慢收 → 不對', () => {
    expect(sim('minnow', t => ({ reel: true, jerk: every(t, 1.2) })).follow).toBe(true);
    expect(sim('minnow', t => ({ reel: Math.floor(t * 2) % 2 === 0, jerk: false })).follow).toBe(false);
  });
  it('軟蟲：先沉、收收停停貼底 → 對；一直狂收 → 不對', () => {
    expect(sim('soft', t => ({ reel: t > 3 && Math.floor(t * 3) % 3 === 0, jerk: false }), 9).follow).toBe(true);
    expect(sim('soft', () => ({ reel: true, jerk: false })).follow).toBe(false);
  });
  it('鐵板：沉下去再抽 → 對；在水面亂收 → 不對', () => {
    expect(sim('jig', t => ({ reel: false, jerk: t > 3 && every(t, 1) }), 8).follow).toBe(true);
    expect(sim('jig', () => ({ reel: true, jerk: false })).follow).toBe(false);
  });
  it('波趴：抽一下停一下 → 對；一直收 → 不對', () => {
    expect(sim('popper', t => ({ reel: false, jerk: every(t, 0.9) })).follow).toBe(true);
    const l = sim('popper', () => ({ reel: true, jerk: false }));
    expect(rhythmOk('popper', l)).toBe(false);
  });
  it('拖釣：自動算對', () => {
    const l = newLure(12, 'jig');
    for (let i = 0; i < 90; i++) stepLure(l, 'jig', false, false, 1 / 60, true);
    expect(l.follow).toBe(true);
  });
});

describe('釣魚：拉扯張力', () => {
  it('一直按著收線 → 張力爆 → 斷線', () => {
    const f = newFight(0.9, 20000, true); let r = null;
    for (let i = 0; i < 600 && !r; i++) r = stepFight(f, true, 0, 1 / 60, () => 0.9);
    expect(r).toBe('snap');
  });
  it('路亞完全不收 → 張力太低 → 脫鉤；垂釣不會脫鉤', () => {
    const f = newFight(0.5, 8000, true); let r = null;
    for (let i = 0; i < 600 && !r; i++) r = stepFight(f, false, 0, 1 / 60, () => 0.1);
    expect(r).toBe('unhook');
    const g = newFight(0.5, 8000, false); r = null;
    for (let i = 0; i < 600 && !r; i++) r = stepFight(g, false, 0, 1 / 60);
    expect(r).toBeNull();
  });
  it('路亞：搖桿往魚衝的反方向拉比較快拉上來', () => {
    const play = (smart: boolean) => {
      const f = newFight(0.7, 12000, true); let seq = 0; const rnd = () => [0.5, 0.3, 0.9, 0.3][seq++ % 4];
      for (let i = 0; i < 60 * 40; i++) {
        const r = stepFight(f, f.ten < 0.65, smart ? -f.run : f.run, 1 / 60, rnd);
        if (r === 'landed') return f.t;
        if (r) return 999;
      }
      return 999;
    };
    const smart = play(true), dumb = play(false);
    expect(smart).toBeLessThan(30);
    expect(smart).toBeLessThan(dumb);
  });
  it('拉扯時間大約照伺服器給的（最少一半，伺服器擋太快）', () => {
    const f = newFight(0.3, 2500, false); let r = null;
    for (let i = 0; i < 60 * 20 && !r; i++) r = stepFight(f, true, 0, 1 / 60);
    expect(r).toBe('landed');
    expect(f.t * 1000).toBeGreaterThan(2500 / 2);
  });
});
