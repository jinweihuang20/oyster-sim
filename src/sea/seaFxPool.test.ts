import { describe, expect, it } from 'vitest';

/** 對齊 seaModels.makeFx 的固定池語意（不碰 WebGL）：滿了蓋最舊、不 splice */
class SplashPool {
  readonly p: { on: boolean; age: number; life: number }[];
  private next = 0;
  constructor(cap: number) {
    this.p = Array.from({ length: cap }, () => ({ on: false, age: 0, life: 0 }));
  }
  spawn(life = 1) {
    const q = this.p[this.next];
    this.next = (this.next + 1) % this.p.length;
    q.on = true; q.age = 0; q.life = life;
  }
  step(dt: number) {
    let n = 0;
    for (const q of this.p) {
      if (!q.on) continue;
      q.age += dt;
      if (q.age >= q.life) { q.on = false; continue; }
      n++;
    }
    return n;
  }
  live() { return this.p.filter(q => q.on).length; }
}

describe('sea splash pool (makeFx semantics)', () => {
  it('滿池時覆蓋舊粒子，數量不超過 cap', () => {
    const pool = new SplashPool(4);
    for (let i = 0; i < 10; i++) pool.spawn(10);
    expect(pool.live()).toBe(4);
  });

  it('tick 到期關閉，不靠 splice', () => {
    const pool = new SplashPool(3);
    pool.spawn(0.5); pool.spawn(0.5); pool.spawn(0.5);
    expect(pool.step(0.6)).toBe(0);
    expect(pool.live()).toBe(0);
  });
});
