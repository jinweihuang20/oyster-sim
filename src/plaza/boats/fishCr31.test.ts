import { describe, it, expect } from 'vitest';
import { FISH, FishSM, newLure, stepLure, newFight, stepFight, fightDistM, fishDistNow, FIGHT_P0, type LureKey } from './fishLogic';
import { FW, newLineW, lineWStart, lineWDist, lineWYaw, takeSlack, stepLineW, dragLure, newFightW, fightWStart, stepFightW, progOfDist, fightSecs } from './fishWorld';

const DT = 1 / 60;
/** 跟 plazaFish tickFish 同一個順序：收線前捲鬆線 → stepLure → 線長約束 → 船拖水阻 */
function lureStep(w: ReturnType<typeof newLineW>, s: ReturnType<typeof newLure>, item: LureKey, ax: number, az: number, reel: boolean, dt = DT) {
  if (reel) s.dist = takeSlack(s.dist, w, ax, az);
  const len0 = s.dist;
  const back = stepLure(s, item, reel, false, dt, false, w.drag);
  const v = stepLineW(w, s.dist, ax, az, dt, Math.max(0, len0 - s.dist));
  dragLure(s, item, v, dt);
  return back;
}
const noRnd = () => 0.1; // 魚不往左右衝（run＝0）

describe('CR-31 船不動：岸上／船上拋竿收線跟以前一樣', () => {
  it('浮標落水後原地不動，距離＝拋竿距離', () => {
    const w = lineWStart(newLineW(), 0, -18, 0, 0, 18);
    for (let i = 0; i < 600; i++) stepLineW(w, w.len, 0, 0, DT);
    expect(w.x).toBeCloseTo(0, 9); expect(w.z).toBeCloseTo(-18, 9);
    expect(lineWDist(w, 0, 0)).toBeCloseTo(18, 9);
    expect(w.drag).toBe(0);
  });
  it('路亞收線：假魚沿原方向往人拉回來，真實距離一直等於線長，收到 backR 就收完', () => {
    const h = 0.6, d0 = 20, ax = -30, az = 4;
    const w = lineWStart(newLineW(), ax - Math.sin(h) * d0, az - Math.cos(h) * d0, ax, az, d0);
    const s = newLure(d0, 'minnow');
    let back = false, n = 0;
    while (!back && n++ < 6000) {
      back = lureStep(w, s, 'minnow', ax, az, true);
      expect(lineWDist(w, ax, az)).toBeCloseTo(s.dist, 6);
      expect(lineWYaw(w, ax, az, 0)).toBeCloseTo(h, 6);
    }
    expect(back).toBe(true);
    expect(lineWDist(w, ax, az)).toBeLessThanOrEqual(FISH.backR + 1e-9);
    // 跟原本 stepLure 一樣快收回來（約 20 m ÷ 3 m/s）
    expect(n * DT).toBeGreaterThan(5); expect(n * DT).toBeLessThan(9);
  });
  it('船不動拉魚：stepFightW 不改進度和張力，魚的距離＝fightDistM（手感跟以前一樣）', () => {
    const d0 = 15, f = newFight(0.3, 8000, false, d0);
    const w = fightWStart(newFightW(), 0, -d0, 0, 0, d0);
    let end: string | null = null, i = 0;
    while (!end && i++ < 20000) {
      end = stepFight(f, true, 0, DT, noRnd);
      const p = f.prog, ten = f.ten;
      const r = end ? null : stepFightW(w, f, 0, 0, 0, DT);
      expect(r).toBeNull();
      expect(f.prog).toBe(p); expect(f.ten).toBe(ten);
      if (!end) expect(lineWDist(w, 0, 0)).toBeCloseTo(fightDistM(f.prog, d0), 6);
    }
    expect(end).toBe('landed');
  });
});

describe('CR-31 船在開、沒收線：線鬆留原地，拉直才被拖', () => {
  it('線還鬆時假魚在原地；船開超過線長就沿著船的軌跡被拖，距離不超過線長', () => {
    const len = 12;
    const w = lineWStart(newLineW(), 0, 10, 0, 0, len); // 假魚在船後 10 m（線放 12 m）
    const s = newLure(len, 'minnow');
    let bx = 0, bz = 0;
    const v = 2; // 船往 -z 開
    // 前 1 秒：船離假魚 10 → 12 m，線還沒直
    for (let i = 0; i < 59; i++) { bz -= v * DT; lureStep(w, s, 'minnow', bx, bz, false); }
    expect(w.x).toBeCloseTo(0, 9); expect(w.z).toBeCloseTo(10, 9);
    // 之後：被拖著走
    for (let i = 0; i < 600; i++) {
      bz -= v * DT; lureStep(w, s, 'minnow', bx, bz, false);
      expect(lineWDist(w, bx, bz)).toBeLessThanOrEqual(len + 1e-6);
    }
    expect(w.z).toBeLessThan(0); // 跟著船走了
    expect(lineWDist(w, bx, bz)).toBeCloseTo(len, 6);
    expect(w.z - bz).toBeCloseTo(len, 6); // 拖在船的正後方
    expect(w.drag).toBeGreaterThan(1.5);
  });
  it('船轉彎：假魚沿船走過的方向被拖（夾在現在竿尖到假魚的線上）', () => {
    const w = lineWStart(newLineW(), 0, 8, 0, 0, 8);
    let bx = 0, bz = 0;
    for (let i = 0; i < 240; i++) { bx += 2 * DT; stepLineW(w, 8, bx, bz, DT); }
    expect(lineWDist(w, bx, bz)).toBeCloseTo(8, 6);
    expect(w.x).toBeGreaterThan(0.5);
    expect(w.x).toBeLessThan(bx);
  });
  it('浮標被拖：一直在線長內、在水面（沒有水深），拖速算得出來', () => {
    const w = lineWStart(newLineW(), 5, 0, 0, 0, 5);
    let bx = 0;
    for (let i = 0; i < 180; i++) { bx -= 1.5 * DT; stepLineW(w, w.len, bx, 0, DT); }
    expect(lineWDist(w, bx, 0)).toBeCloseTo(5, 6);
    expect(w.drag).toBeGreaterThan(1.2);
  });
  it('船拖得快：深的慢搖鐵板被水阻抬高一點，但還在水面下；船不動就照常沉', () => {
    const run = (v: number) => {
      const s = newLure(10, 'slowjig'); s.depth = 0.95;
      const w = lineWStart(newLineW(), 0, 10, 0, 0, 10);
      let bz = 0;
      for (let i = 0; i < 300; i++) { bz -= v * DT; lureStep(w, s, 'slowjig', 0, bz, false); }
      return s;
    };
    const still = run(0), slow = run(0.3), fast = run(2.5);
    expect(still.depth).toBeGreaterThan(0.95 - 1e-9);
    expect(slow.depth).toBeGreaterThan(0.95 - 1e-9);
    expect(fast.depth).toBeLessThan(0.75);
    expect(fast.depth).toBeGreaterThan(FW.liftFloor);
    // 被拖著走也算假魚在游（節奏判斷看得到速度）
    expect(fast.spd).toBeGreaterThan(1.5);
  });
  it('拖越快抬越高；波趴一直在水面不受影響', () => {
    const lift = (v: number) => { const s = newLure(10, 'jig'); s.depth = 1; for (let i = 0; i < 600; i++) dragLure(s, 'jig', v, DT); return s.depth; };
    expect(lift(3)).toBeLessThan(lift(1.5));
    expect(lift(1.5)).toBeLessThan(1);
    const p = newLure(10, 'popper'); dragLure(p, 'popper', 3, 1); expect(p.depth).toBe(0);
  });
});

describe('CR-31 船在開、邊收線：往現在的竿子拉', () => {
  it('收線把假魚拉向「現在」的船，不是拋竿的原點；收完的位置在現在的船邊', () => {
    const d0 = 20;
    const w = lineWStart(newLineW(), 0, -d0, 0, 0, d0); // 往 -z 拋
    const s = newLure(d0, 'minnow');
    let bx = 0, back = false, n = 0;
    while (!back && n++ < 6000) {
      bx += 1.2 * DT; // 船往 +x 橫移
      back = lureStep(w, s, 'minnow', bx, 0, true);
      // HUD 距離＝船到假魚的真實距離
      const hud = fishDistNow({ phase: 'wait', power: 0, item: 'minnow', castDst: d0, flyT: 0, lureDist: lineWDist(w, bx, 0), floatDist: 0, prog: 0, fightD0: 0 });
      expect(hud).toBeCloseTo(Math.hypot(w.x - bx, w.z), 6);
    }
    expect(back).toBe(true);
    expect(Math.hypot(w.x - bx, w.z)).toBeLessThanOrEqual(FISH.backR + 1e-6);
    expect(bx).toBeGreaterThan(5);
    expect(w.x).toBeGreaterThan(bx - FISH.backR - 1e-6); // 在現在的船邊，不在原點 (0,0)
    expect(Math.hypot(w.x, w.z)).toBeGreaterThan(3);
  });
  it('船開向假魚時線鬆：一按收線先把鬆的線捲掉（線長＝真實距離）', () => {
    const w = lineWStart(newLineW(), 0, -20, 0, 0, 20);
    const s = newLure(20, 'minnow');
    let bz = 0;
    for (let i = 0; i < 300; i++) { bz -= 2 * DT; lureStep(w, s, 'minnow', 0, bz, false); }
    expect(s.dist).toBeCloseTo(20, 6); // 線還放著 20 m
    expect(lineWDist(w, 0, bz)).toBeCloseTo(10, 4); // 實際只剩 10 m
    lureStep(w, s, 'minnow', 0, bz, true);
    expect(s.dist).toBeLessThan(10);
    expect(lineWDist(w, 0, bz)).toBeCloseTo(s.dist, 6);
  });
  it('FishSM 走完整流程：路亞 back 事件在現在的船位置觸發', () => {
    const sm = new FishSM(); sm.enter(); sm.item = 'minnow'; sm.gear = 'lure';
    sm.startCharge(); sm.release(); sm.castOk(1, 18, 0.5, 0);
    const w = lineWStart(newLineW(), 0, -18, 0, 0, 18);
    let bx = 0, ev: string | null = null, n = 0;
    while (sm.phase === 'fly' && n++ < 100) sm.tick(DT, { reel: false, jerk: false, dir: 0 });
    expect(sm.phase).toBe('wait');
    n = 0;
    while (ev !== 'back' && n++ < 6000) {
      bx -= 1 * DT;
      if (sm.lure) sm.lure.dist = takeSlack(sm.lure.dist, w, bx, 0);
      const len0 = sm.lure!.dist;
      ev = sm.tick(DT, { reel: true, jerk: false, dir: 0 });
      if (sm.lure) stepLineW(w, sm.lure.dist, bx, 0, DT, len0 - sm.lure.dist);
    }
    expect(ev).toBe('back');
    expect(Math.hypot(w.x - bx, w.z)).toBeLessThanOrEqual(FISH.backR + 0.1);
  });
});

describe('CR-31 拉魚時船在開', () => {
  const run = (vBoat: number, secs: number, reel: boolean, power = 0.5, d0 = 18) => {
    const f = newFight(power, 12000, false, d0);
    const w = fightWStart(newFightW(), 0, -d0, 0, 0, d0); // 魚在 -z
    let bz = 0, end: string | null = null, minTen = 1, maxTen = 0;
    for (let i = 0; i < secs / DT && !end; i++) {
      bz += vBoat * DT; // +：開離魚；-：開向魚
      end = stepFight(f, reel, 0, DT, noRnd);
      if (!end) end = stepFightW(w, f, 0, bz, 0, DT);
      minTen = Math.min(minTen, f.ten); maxTen = Math.max(maxTen, f.ten);
    }
    return { f, w, bz, end, real: lineWDist(w, 0, bz), minTen, maxTen };
  };
  it('船開離魚：線被拉出去（進度往回）、張力比不開船高、魚被拖著跟船走', () => {
    const still = run(0, 3, false), away = run(2.5, 3, false);
    expect(away.f.prog).toBeLessThan(still.f.prog - 0.05);
    expect(away.maxTen).toBeGreaterThan(still.maxTen + 0.2);
    expect(away.w.z).toBeGreaterThan(-18 + 3); // 魚被拖著往 +z 走
    expect(away.real).toBeCloseTo(fightDistM(away.f.prog, 18), 5); // 線是直的
  });
  it('船開離魚又一直收線：大魚會被拉到爆線', () => {
    const r = run(3.5, 20, true, 0.9, 30);
    expect(r.end).toBe('snap');
  });
  it('船開向魚：距離直接變短、線鬆張力掉；HUD 顯示真實距離', () => {
    const r = run(-3, 2.5, false, 0.2);
    expect(r.end).toBeNull();
    const L = fightDistM(r.f.prog, 18);
    expect(r.real).toBeLessThan(L - 2); // 線鬆
    expect(r.real).toBeLessThan(18 - 4);
    expect(r.minTen).toBeLessThan(0.05);
    const hud = fishDistNow({ phase: 'fight', power: 0, item: 'shrimp', castDst: 0, flyT: 0, lureDist: null, floatDist: 0, prog: r.f.prog, fightD0: 18, fightM: r.real });
    expect(hud).toBeCloseTo(r.real, 9);
  });
  it('開向魚邊收線：魚到「現在」的船邊就拉上來（不早於安全的最短拉扯時間）', () => {
    const d0 = 18, f = newFight(0.2, 12000, false, d0);
    const w = fightWStart(newFightW(), 0, -d0, 0, 0, d0);
    let bz = 0, end: string | null = null, n = 0;
    while (!end && n++ < 20000) {
      bz -= 3 * DT;
      end = stepFight(f, true, 0, DT, noRnd);
      if (!end) end = stepFightW(w, f, 0, bz, 0, DT);
    }
    expect(end).toBe('landed');
    expect(f.prog).toBeLessThan(1); // 不是靠進度收滿，是魚真的到船邊
    expect(Math.hypot(w.x, w.z - bz)).toBeLessThanOrEqual(FW.landR + 1e-9);
    expect(bz).toBeLessThan(-5); // 船已經開走一段
    expect(f.t).toBeGreaterThanOrEqual(FW.landTK * fightSecs(f) - 1e-9);
  });
  it('船衝向魚很快：最短拉扯時間之前不會算拉上來（伺服器不會判太快）', () => {
    const d0 = 18, f = newFight(0.2, 12000, false, d0);
    const w = fightWStart(newFightW(), 0, -d0, 0, 0, d0);
    let bz = 0, end: string | null = null, n = 0;
    while (!end && n++ < 20000) {
      bz -= (bz > -16 ? 8 : 0) * DT; // 衝到魚旁邊就停
      end = stepFight(f, false, 0, DT, noRnd);
      if (!end) end = stepFightW(w, f, 0, bz, 0, DT);
      if (f.t < FW.landTK * fightSecs(f) - DT) expect(end).toBeNull();
      if (f.t > 30) break;
    }
  });
  it('魚往左右衝：在世界座標裡繞著人游，衝回來就回到原方位', () => {
    const d0 = 12, f = newFight(0.3, 9000, true, d0);
    const w = fightWStart(newFightW(), 0, -d0, 0, 0, d0);
    stepFightW(w, f, 0, 0, 2.2, DT);
    expect(w.x).toBeGreaterThan(1.5); // 往右（面向 -z 時右邊＝+x）
    expect(lineWDist(w, 0, 0)).toBeCloseTo(fightDistM(f.prog, d0), 6);
    stepFightW(w, f, 0, 0, 0, DT);
    expect(Math.abs(w.x)).toBeLessThan(0.3);
  });
  it('進度和線長互換', () => {
    expect(progOfDist(18, 18)).toBeCloseTo(FIGHT_P0, 9);
    expect(fightDistM(progOfDist(7, 18), 18)).toBeCloseTo(7, 9);
  });
});
