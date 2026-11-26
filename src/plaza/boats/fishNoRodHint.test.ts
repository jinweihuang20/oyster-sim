import { describe, it, expect } from 'vitest';
import { PB } from './boatLogic';
import {
  FISH_SHORE_X, NO_ROD_HINT, NO_ROD_HINT_COOLDOWN,
  canFishAt, newNoRodHint, stepNoRodHint,
} from './fishLogic';

describe('可釣魚區', () => {
  it('西岸淺灘、碼頭棧橋可以釣；往內走或游泳不行', () => {
    expect(canFishAt('walk', { x: -24, z: 0 })).toBe(true);
    expect(canFishAt('walk', { x: FISH_SHORE_X, z: PB.shoreZ })).toBe(true);
    expect(canFishAt('walk', { x: FISH_SHORE_X, z: -PB.shoreZ })).toBe(true);
    expect(canFishAt('walk', { x: -30, z: 0 })).toBe(true); // 棧橋上
    expect(canFishAt('walk', { x: PB.pierX1 - 0.3, z: 0 })).toBe(true);
    expect(canFishAt('walk', { x: -23, z: 0 })).toBe(false); // 還沒走到岸邊
    expect(canFishAt('walk', { x: -24, z: PB.shoreZ + 0.1 })).toBe(false);
    expect(canFishAt('swim', { x: -24, z: 0 })).toBe(false);
    expect(canFishAt('walk')).toBe(false);
  });
  it('在船上可以釣；沒上船不行', () => {
    expect(canFishAt('boat', undefined, true)).toBe(true);
    expect(canFishAt('boat', undefined, false)).toBe(false);
    expect(canFishAt('boat', { x: 0, z: 0 }, true)).toBe(true);
  });
});

describe('沒有釣竿走進可釣魚區的提示', () => {
  it('提示寫明到「雜貨店 → 釣具」購買', () => {
    expect(NO_ROD_HINT).toBe('還沒買釣竿，可到「雜貨店 → 釣具」購買');
  });
  it('沒有釣竿、剛走進可釣魚區時要提示', () => {
    const st = newNoRodHint();
    expect(stepNoRodHint(st, false, false, 0)).toBe(false);
    expect(stepNoRodHint(st, true, false, 1)).toBe(true);
  });
  it('待在區內不會一直重覆提示', () => {
    const st = newNoRodHint();
    expect(stepNoRodHint(st, true, false, 0)).toBe(true);
    for (let t = 0.05; t <= 8; t += 0.05) expect(stepNoRodHint(st, true, false, t)).toBe(false);
    // 在岸邊走來走去（還在區內）也不再跳
    expect(stepNoRodHint(st, true, false, 12)).toBe(false);
  });
  it('已經有釣竿就不會出現這個提示', () => {
    const st = newNoRodHint();
    expect(stepNoRodHint(st, true, true, 1)).toBe(false);
    expect(stepNoRodHint(st, true, true, 2)).toBe(false);
    // 先有竿走進區，之後即使狀態還在區內也不會補跳沒竿提示
    expect(stepNoRodHint(st, true, false, 3)).toBe(false);
  });
  it('上船（可釣魚）沒有釣竿也會提示一次', () => {
    const st = newNoRodHint();
    const shore = canFishAt('walk', { x: 0, z: 0 });
    const boat = canFishAt('boat', undefined, true);
    expect(shore).toBe(false);
    expect(boat).toBe(true);
    expect(stepNoRodHint(st, shore, false, 0)).toBe(false);
    expect(stepNoRodHint(st, boat, false, 1)).toBe(true);
    expect(stepNoRodHint(st, boat, false, 2)).toBe(false);
    expect(stepNoRodHint(st, boat, true, 3)).toBe(false);
  });
  it('離開後立刻再進來不會洗版，過了冷卻才再提示', () => {
    const st = newNoRodHint();
    expect(stepNoRodHint(st, true, false, 0)).toBe(true);
    expect(stepNoRodHint(st, false, false, 1)).toBe(false);
    expect(stepNoRodHint(st, true, false, 2)).toBe(false); // 還在冷卻
    expect(stepNoRodHint(st, false, false, NO_ROD_HINT_COOLDOWN + 1)).toBe(false);
    expect(stepNoRodHint(st, true, false, NO_ROD_HINT_COOLDOWN + 2)).toBe(true);
  });
});
