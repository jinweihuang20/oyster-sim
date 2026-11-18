import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  PLAZA_WINDUP, PLAZA_SHELL_SPEED, PLAZA_FLY_MIN, PLAZA_FLY_MAX, PLAZA_FLY_FALLBACK, PLAZA_NPC_FLY,
  plazaFlyTime, plazaEventFlyTime, plazaShellFlight,
} from './shellTiming.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const o = { x: 0, y: 1, z: 0 };
const at = (d: number) => ({ x: 0, y: 1, z: -d });

test('固定速度 8 m/s，最長 0.8s；蓄力固定 0.65s', () => {
  assert.equal(PLAZA_WINDUP, 0.65);
  assert.equal(PLAZA_SHELL_SPEED, 8);
  assert.equal(PLAZA_FLY_MAX, 0.8);
  assert.ok(near(plazaFlyTime(o, at(2.4)), 0.3)); // 同桌對面
  assert.ok(near(plazaFlyTime(o, at(4)), 0.5));
  assert.equal(plazaFlyTime(o, at(6.4)), 0.8);
  assert.equal(plazaFlyTime(o, at(14)), PLAZA_FLY_MAX); // 廣場另一頭封頂
});

test('極近距離有最短秒數；座標缺漏用 0.4s', () => {
  assert.equal(plazaFlyTime(o, o), PLAZA_FLY_MIN);
  assert.equal(plazaFlyTime(o, at(0.8)), PLAZA_FLY_MIN);
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
  // 丟殼者與旁觀者：握在手上 PLAZA_WINDUP，放手後只飛 fly；落地＝蓄力＋飛行（＝被丟者判定時間）
  const [th, tf] = plazaShellFlight({ who: 'thrower', targetIsNpc: false, fly });
  const [sh, sf] = plazaShellFlight({ who: 'spectator', reflect: false, targetIsNpc: false, fly });
  assert.equal(th, PLAZA_WINDUP);
  assert.equal(sh, PLAZA_WINDUP);
  assert.ok(near(tf, fly));
  assert.ok(near(sf, fly));
  assert.ok(near(th + tf, PLAZA_WINDUP + fly));
});

test('丟阿婆維持快飛不握；旁觀反彈／阿婆／舊伺服器不握、直接飛', () => {
  const fly = 0.3;
  assert.deepEqual(plazaShellFlight({ who: 'thrower', targetIsNpc: true, fly }).slice(0, 2), [0, PLAZA_NPC_FLY]);
  for (const k of [
    { reflect: true, targetIsNpc: false },
    { reflect: false, targetIsNpc: true },
    { reflect: undefined, targetIsNpc: false },
    { reflect: false, targetIsNpc: null },
  ] as const) {
    assert.deepEqual(plazaShellFlight({ who: 'spectator', ...k, fly }).slice(0, 2), [0, fly]);
  }
});
