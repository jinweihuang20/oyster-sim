import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  PLAZA_WINDUP, PLAZA_SHELL_SPEED, PLAZA_FLY_MIN, PLAZA_FLY_FALLBACK, PLAZA_NPC_FLY,
  plazaFlyTime, plazaEventFlyTime, plazaShellFlight,
} from './shellTiming.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const o = { x: 0, y: 1, z: 0 };
const at = (d: number) => ({ x: 0, y: 1, z: -d });

test('固定速度與丟阿婆相同：同桌阿婆平均 1.7m 用 0.5s，蓄力固定 0.65s', () => {
  assert.equal(PLAZA_WINDUP, 0.65);
  assert.equal(PLAZA_SHELL_SPEED, 3.4);
  assert.ok(near(plazaFlyTime(o, at(1.7)), PLAZA_NPC_FLY)); // 等同丟阿婆
  assert.ok(near(plazaFlyTime(o, at(3.4)), 1.0));
  assert.ok(near(plazaFlyTime(o, at(13.6)), 4.0)); // 廣場另一頭，不封頂
});

test('極近距離有最短秒數；座標缺漏用 0.4s', () => {
  assert.equal(plazaFlyTime(o, o), PLAZA_FLY_MIN);
  assert.equal(plazaFlyTime(o, at(0.3)), PLAZA_FLY_MIN);
  assert.equal(plazaFlyTime(null, at(3)), PLAZA_FLY_FALLBACK);
  assert.equal(plazaFlyTime(o, { x: NaN, y: 0, z: 0 }), PLAZA_FLY_FALLBACK);
});

test('三方同一封包座標算出相同時間（含反彈回程）', () => {
  const e = { fromX: 1, fromY: 1.1, fromZ: 0.5, toX: -1.2, toY: 1.0, toZ: -1.4 };
  const fly = plazaEventFlyTime(e);
  // 丟殼者用同一組出手點／目標點
  assert.ok(near(plazaFlyTime({ x: 1, y: 1.1, z: 0.5 }, { x: -1.2, y: 1.0, z: -1.4 }), fly));
  // 反彈回程（起訖對調）距離相同
  assert.ok(near(plazaFlyTime({ x: -1.2, y: 1.0, z: -1.4 }, { x: 1, y: 1.1, z: 0.5 }), fly));
  const thrower = plazaShellFlight({ who: 'thrower', targetIsNpc: false, fly })[0];
  const spect = plazaShellFlight({ who: 'spectator', reflect: false, targetIsNpc: false, fly })[0];
  assert.ok(near(thrower, PLAZA_WINDUP + fly));
  assert.ok(near(spect, PLAZA_WINDUP + fly));
});

test('丟阿婆維持快飛；旁觀反彈／阿婆／舊伺服器只算飛行不加蓄力', () => {
  const fly = 0.4;
  assert.equal(plazaShellFlight({ who: 'thrower', targetIsNpc: true, fly })[0], PLAZA_NPC_FLY);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: true, targetIsNpc: false, fly })[0], fly);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: false, targetIsNpc: true, fly })[0], fly);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: undefined, targetIsNpc: false, fly })[0], fly);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: false, targetIsNpc: null, fly })[0], fly);
});
