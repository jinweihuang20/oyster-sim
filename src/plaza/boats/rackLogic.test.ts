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
