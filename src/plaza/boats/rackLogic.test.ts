import { describe, it, expect } from 'vitest';
import { normRack, normRackSnap, rackNow, rackRipe, rackNextSec, loadSlow, ripeViewR, stealFine, upCost, UP_LINES, nearestRack, parseUp, RACK } from './rackLogic';

const base = { id: 3, x: -60, z: 10, h: 0, n: 4, t: 1_000_000, ok: '', owner: '', max: 12, growMs: 20_000, up: '111111' };

describe('巡蚵棚', () => {
  it('客戶端自己算現在幾串（每 growMs 一串，到 max 為止）', () => {
    const r = normRack(base)!;
    expect(rackNow(r, 1_000_000)).toBe(4);
    expect(rackNow(r, 1_000_000 + 19_999)).toBe(4);
    expect(rackNow(r, 1_000_000 + 40_000)).toBe(6);
    expect(rackNow(r, 1_000_000 + 9e6)).toBe(12);
    expect(rackRipe(r, 1_000_000 + 9e6)).toBe(true);
    expect(rackNextSec(r, 1_000_000 + 5_000)).toBe(15);
    expect(rackNextSec(r, 1_000_000 + 9e6)).toBe(0);
  });
  it('伺服器欄位大小寫都吃', () => {
    const s = normRackSnap({ Racks: [{ Id: 1001, X: 1, Z: 2, H: 0, N: 0, T: 5, Ok: 'abcd1234', Owner: '阿明 #1234', Max: 24, GrowMs: 10000, Up: '535111' }], Me: 'abcd1234', CargoMax: 24, UpCost: [[1, 2, 3, 4]] })!;
    expect(s.racks[0].ok).toBe('abcd1234');
    expect(s.racks[0].up).toEqual([5, 3, 5, 1, 1, 1]);
    expect(s.me).toBe('abcd1234');
    expect(upCost(s.upCost, 0, 1)).toBe(1);
    expect(upCost(s.upCost, 0, 5)).toBeNull();
  });
  it('船貨越重越慢，滿載 60%', () => {
    expect(loadSlow(0, 24)).toBe(1);
    expect(loadSlow(24, 24)).toBeCloseTo(0.6);
    expect(loadSlow(99, 24)).toBeCloseTo(0.6);
  });
  it('警示燈只有主人自己看得遠', () => {
    const r = normRack({ ...base, ok: 'me000001', up: '111115' })!;
    expect(ripeViewR(r, 'me000001')).toBe(RACK.ripeR[4]);
    expect(ripeViewR(r, 'other001')).toBe(RACK.ripeR[0]);
  });
  it('偷拉罰款跟防盜等級', () => {
    const r = normRack({ ...base, ok: 'x', up: '111511' })!;
    expect(stealFine(r, 3, 250)).toBe(1875);
    expect(stealFine(normRack({ ...base, ok: 'x' })!, 3, 250)).toBe(750);
  });
  it('六條升級線、Lv1～5 都有文字；最近的蚵棚', () => {
    expect(UP_LINES).toHaveLength(6);
    for (const l of UP_LINES) for (let lv = 1; lv <= 5; lv++) expect(l.fx(lv).length).toBeGreaterThan(2);
    const list = [normRack({ ...base, id: 1, x: 0, z: 0 })!, normRack({ ...base, id: 2, x: 10, z: 0 })!];
    expect(nearestRack(8, 0, list)!.rack.id).toBe(2);
    expect(parseUp('9x')).toEqual([1, 1, 1, 1, 1, 1]);
  });
});
import { pushFromRack } from './rackLogic';
describe('船撞蚵棚', () => {
  it('推出架子外、減速；旁邊經過不撞', () => {
    const b = { x: 0.5, z: 0.3, h: 0, v: 5 };
    expect(pushFromRack(b, { x: 0, z: 0, h: 0 }, [[b.x, b.z]], 1)).toBe(true);
    expect(b.v).toBeLessThan(5);
    const c = { x: 0, z: 4, h: 0, v: 5 };
    expect(pushFromRack(c, { x: 0, z: 0, h: 0 }, [[0, 4]], 1)).toBe(false);
    // 旋轉 90°：長邊變成沿 z
    const d = { x: 0, z: 2.2, h: 0, v: 3 };
    expect(pushFromRack(d, { x: 0, z: 0, h: Math.PI / 2 }, [[0, 2.2]], 1)).toBe(true);
  });
});

import { rackAgePct, rackFullAt, rackCooling, fmtWait, UP_FULL_MIN } from './rackLogic';
describe('私人蚵棚：放太久變老、公共冷卻', () => {
  const c = { ageStartMs: 2 * 3600_000, ageSpanMs: 2 * 3600_000, ageFloor: 50 };
  const priv = (n: number, t: number, a = 0) => ({ id: 1001, x: 0, z: 0, h: 0, n, t, ok: 'k', owner: 'o', max: 12, growMs: 150_000, up: [1, 1, 1, 1, 1, 1], a });
  it('長滿 2 小時內原價，之後線性降到 5 折，不會更低（跟伺服器一樣）', () => {
    const t0 = 1_000_000_000;
    expect(rackFullAt(priv(0, t0), t0 + 1000)).toBe(0);
    expect(rackFullAt(priv(0, t0), t0 + 12 * 150_000)).toBe(t0 + 12 * 150_000);
    expect(rackAgePct(priv(12, t0), t0 + 2 * 3600_000, c)).toBe(100);
    expect(rackAgePct(priv(12, t0), t0 + 3 * 3600_000, c)).toBe(75);
    expect(rackAgePct(priv(12, t0), t0 + 30 * 3600_000, c)).toBe(50);
    // 拉過一半：a 記住開始變老的時間
    expect(rackAgePct(priv(5, t0 + 5 * 3600_000, t0), t0 + 5 * 3600_000, c)).toBe(50);
    // 公共蚵棚不會變老
    expect(rackAgePct({ ...priv(12, t0), ok: '' }, t0 + 30 * 3600_000, c)).toBe(100);
  });
  it('公共蚵棚 t 在未來＝冷卻中；時間格式', () => {
    expect(rackCooling({ ...priv(3, 2000), ok: '' }, 1000)).toBe(true);
    expect(rackCooling(priv(3, 2000), 1000)).toBe(false);
    expect(rackCooling({ ...priv(3, 500), ok: '' }, 1000)).toBe(false);
    expect(fmtWait(45)).toBe('45 秒');
    expect(fmtWait(125)).toBe('2 分 05 秒');
  });
  it('生長速度：30 分鐘起、Lv5 約 19 分鐘；舊伺服器沒送也有預設', () => {
    expect(UP_FULL_MIN[0]).toBe(30);
    expect(UP_FULL_MIN[4]).toBeGreaterThanOrEqual(18); expect(UP_FULL_MIN[4]).toBeLessThanOrEqual(20);
    const s = normRackSnap({ racks: [] })!;
    expect(s.upFullMs[0]).toBe(30 * 60_000);
    expect(s.ageFloor).toBe(50);
  });
});

import { hullPts, PB } from './boatLogic';
describe('剛放好的蚵棚壓在船上：往哪個方向開都開得走', () => {
  const clear = (b: { x: number; z: number; h: number }, r: { x: number; z: number; h: number }) => {
    const t = { ...b, v: 0 };
    return !pushFromRack(t, r, hullPts(b), PB.hullR);
  };
  it('舊版放法（架子壓在船身上）＋ 8 個方向、前進／倒車都能脫困', () => {
    for (let k = 0; k < 8; k++) for (const dir of [1, -1]) {
      const h0 = 0.3;
      // 舊版：右舷 2.2 m、架子跟船同向 → 架子橫跨船身
      const r = { x: Math.cos(h0) * 2.2, z: -Math.sin(h0) * 2.2, h: h0 };
      const b = { x: 0, z: 0, h: h0 + k * Math.PI / 4, v: 0 };
      for (let i = 0; i < 180; i++) {
        b.v = 4 * dir; // 一直踩油門
        b.x += -Math.sin(b.h) * b.v / 60; b.z += -Math.cos(b.h) * b.v / 60;
        pushFromRack(b, r, hullPts(b), PB.hullR);
      }
      expect(clear(b, r)).toBe(true);
      expect(Math.hypot(b.x, b.z)).toBeGreaterThan(2.5);
    }
  });
  it('往外開不減速，一次最多推 0.2 m', () => {
    const r = { x: 0, z: 0, h: 0 };
    const b = { x: 0, z: 0.5, h: Math.PI, v: 3 }; // h=π → 往 +z 開（離開架子）
    pushFromRack(b, r, hullPts(b), PB.hullR);
    expect(b.v).toBe(3);
    expect(b.z - 0.5).toBeLessThanOrEqual(0.2 + 1e-9);
  });
});

import { planUpTap } from './rackLogic';
describe('連按升級蚵棚', () => {
  const costs = [[6000, 12000, 20000, 32000], [7000, 14000, 24000, 38000], [8000, 16000, 27000, 42000], [6000, 12000, 20000, 32000], [4000, 8000, 14000, 22000], [3000, 6000, 10000, 16000]];
  /** 模擬伺服器還沒回覆前連按 n 下：回傳排進去幾下、預扣多少 */
  const tapMany = (up: number[], line: number, money: number, n: number) => {
    let pend = 0, cost = 0; const lvs: number[] = [];
    for (let i = 0; i < n; i++) { const p = planUpTap(up, pend, line, money, cost, costs); if (!p.ok) continue; pend++; cost += p.cost; lvs.push(p.lv); }
    return { pend, cost, lvs };
  };
  it('等伺服器的時候連按也排得進去，一路疊到 Lv5 就停', () => {
    const r = tapMany([1, 1, 1, 1, 1, 1], 0, 1_000_000, 10);
    expect(r.pend).toBe(4);
    expect(r.lvs).toEqual([1, 2, 3, 4]);
    expect(r.cost).toBe(6000 + 12000 + 20000 + 32000);
  });
  it('錢只夠幾下就只排幾下（排隊中的錢先算掉，不會扣成負的）', () => {
    const r = tapMany([1, 1, 1, 1, 1, 1], 0, 20_000, 10);
    expect(r.pend).toBe(2); expect(r.cost).toBe(18000);
    expect(planUpTap([1, 1, 1, 1, 1, 1], 2, 0, 20_000, 18000, costs)).toEqual({ ok: false, err: 'money' });
  });
  it('已經升過的、滿級的', () => {
    expect(planUpTap([3, 1, 1, 1, 1, 1], 0, 0, 1e9, 0, costs)).toEqual({ ok: true, cost: 20000, lv: 3 });
    expect(planUpTap([5, 1, 1, 1, 1, 1], 0, 0, 1e9, 0, costs)).toEqual({ ok: false, err: 'max' });
    expect(planUpTap([4, 1, 1, 1, 1, 1], 1, 0, 1e9, 0, costs)).toEqual({ ok: false, err: 'max' });
    // 不同項目各自排，錢共用
    const a = planUpTap([1, 1, 1, 1, 1, 1], 0, 5, 10000, 0, costs);
    expect(a).toEqual({ ok: true, cost: 3000, lv: 1 });
    expect(planUpTap([1, 1, 1, 1, 1, 1], 0, 4, 10000, 3000, costs)).toEqual({ ok: true, cost: 4000, lv: 1 });
    expect(planUpTap([1, 1, 1, 1, 1, 1], 0, 0, 10000, 7000, costs)).toEqual({ ok: false, err: 'money' });
  });
});

import { readFileSync } from 'node:fs';
import { pickDrawnRacks, RACK_DRAW, RACK_PUSH_AABB, RACK_MUST_DRAW_R } from './rackLogic';
describe('畫得出來的蚵棚：膠筏撞得到的一定在畫面裡', () => {
  const at = (id: number, x: number, z: number) => ({ id, x, z });
  it('鏡頭附近由近到遠，超出 viewR 的不畫，最多 cap 座', () => {
    const list = [at(1, 80, 0), at(2, 10, 0), at(3, 30, 0), at(4, 20, 0)];
    expect(pickDrawnRacks(list, 0, 0, 75, 2).map(r => r.id)).toEqual([2, 4]);
  });
  it('陣列後面、離鏡頭較遠的蚵棚，只要膠筏撞得到就一定先畫（舊邏輯會先畫前 24 座而漏掉它）', () => {
    const cluster = Array.from({ length: 30 }, (_, i) => at(i + 1, 50, (i - 14.5) * 2));
    const hit = at(99, -6, 0); // 船在原點旁邊，這座會撞到；鏡頭也在附近但這座排在陣列最後
    const boat = { x: 0, z: 0 };
    const drawn = pickDrawnRacks([...cluster, hit], 0, 0, 75, 24, boat);
    expect(drawn).toHaveLength(24);
    expect(drawn.some(r => r.id === 99)).toBe(true);
    // 沒有船優先時，這座比那 30 座更近鏡頭，也會入選；改用鏡頭在群集中心、船在另一側
    const cam = { x: 50, z: 0 };
    const farBoat = { x: -6, z: 0 };
    const drawn2 = pickDrawnRacks([...cluster, hit], cam.x, cam.z, 75, 24, farBoat);
    expect(drawn2.some(r => r.id === 99)).toBe(true);
    // 舊邏輯（陣列順序＋只看鏡頭距離）會漏掉它：群集 30 座都在 viewR 內且排在前面
    const old = [...cluster, hit].filter(r => Math.hypot(r.x - cam.x, r.z - cam.z) <= 75).slice(0, 24);
    expect(old.some(r => r.id === 99)).toBe(false);
  });
  it('鏡頭遠超過 viewR 時，船旁邊能撞到的蚵棚還是會畫', () => {
    const r = at(1, 0, 0);
    expect(pickDrawnRacks([r], 200, 0, 75, 24)).toEqual([]);
    expect(pickDrawnRacks([r], 200, 0, 75, 24, { x: 1, z: 0 }).map(x => x.id)).toEqual([1]);
    expect(Math.hypot(0 - 1, 0 - 0)).toBeLessThanOrEqual(RACK_MUST_DRAW_R);
  });
  it('碰撞粗篩半徑被必畫距離蓋住，容量夠裝一圈能撞到的蚵棚', () => {
    expect(RACK_MUST_DRAW_R).toBeGreaterThanOrEqual(RACK_PUSH_AABB * Math.SQRT2);
    expect(RACK_DRAW.frames).toBeGreaterThanOrEqual(24);
    expect(RACK_DRAW.strings).toBeGreaterThanOrEqual(RACK_DRAW.frames * 12);
    expect(RACK_DRAW.ripe).toBe(RACK_DRAW.frames);
  });
  it('每幀選取和 InstancedMesh 容量對得上；出海採蚵竹架也不用預設視錐裁切', () => {
    const tick = readFileSync('src/plaza/boats/plazaRacks.ts', 'utf8');
    const scene = readFileSync('src/plaza/boats/boatScene.ts', 'utf8');
    const sea = readFileSync('src/sea/seaModels.ts', 'utf8');
    expect(tick).toContain('pickDrawnRacks(racks, cx, cz, drawFar, RACK_DRAW.frames, b)');
    expect(tick).toContain('fogDrawRange(RACK.viewR');
    expect(tick).toContain('RACK_PUSH_AABB');
    expect(scene).toContain('RACK_DRAW.frames');
    expect(scene).toContain('frustumCulled = false');
    expect(sea).toMatch(/pm\.frustumCulled = false/);
    expect(sea).toMatch(/fm\.frustumCulled = false/);
    expect(sea).toMatch(/lumps\.frustumCulled = false/);
    expect(sea).toMatch(/ropes\.frustumCulled = false/);
  });
});

