import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  PLAZA_SHELL_SPEED, PLAZA_FLY_MIN, PLAZA_FLY_MAX, PLAZA_FLY_FALLBACK, PLAZA_REMAIN_MIN,
  PLAZA_LAT_DEFAULT, PLAZA_LAT_MAX, PLAZA_NPC_WINDUP,
  plazaFlyTime, plazaEventFlyTime, plazaLatencyEst, plazaCatchUp,
} from './shellTiming.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const o = { x: 0, y: 1, z: 0 };
const at = (d: number) => ({ x: 0, y: 1, z: -d });

test('固定速度 5 m/s，最短 0.12s、最長 1.28s', () => {
  assert.equal(PLAZA_SHELL_SPEED, 5);
  assert.equal(PLAZA_FLY_MAX, 1.28);
  assert.ok(near(plazaFlyTime(o, at(2.4)), 0.48)); // 同桌對面
  assert.ok(near(plazaFlyTime(o, at(5)), 1.0));
  assert.ok(near(plazaFlyTime(o, at(6.4)), PLAZA_FLY_MAX));
  assert.equal(plazaFlyTime(o, at(14)), PLAZA_FLY_MAX);
  assert.equal(plazaFlyTime(o, at(0.5)), PLAZA_FLY_MIN);
  assert.equal(plazaFlyTime(null, at(3)), PLAZA_FLY_FALLBACK);
  assert.equal(plazaFlyTime(o, { x: NaN, y: 0, z: 0 }), PLAZA_FLY_FALLBACK);
});

test('三方同一封包座標算出相同飛行時間（含反彈回程）', () => {
  const e = { fromX: 1, fromY: 1.1, fromZ: 0.5, toX: -1.2, toY: 1.0, toZ: -1.4 };
  const fly = plazaEventFlyTime(e);
  assert.ok(near(plazaFlyTime({ x: 1, y: 1.1, z: 0.5 }, { x: -1.2, y: 1.0, z: -1.4 }), fly));
  assert.ok(near(plazaFlyTime({ x: -1.2, y: 1.0, z: -1.4 }, { x: 1, y: 1.1, z: 0.5 }), fly));
});

test('延遲估計：用自己的 RTT，沒量到用預設，有上限', () => {
  assert.equal(plazaLatencyEst(null), PLAZA_LAT_DEFAULT);
  assert.equal(plazaLatencyEst(0), PLAZA_LAT_DEFAULT);
  assert.ok(near(plazaLatencyEst(80), 0.08));
  assert.equal(plazaLatencyEst(2000), PLAZA_LAT_MAX);
});

test('收到時從弧線中段接著飛：剩餘＝飛行−延遲，落地和丟的人同時', () => {
  const { k0, remain } = plazaCatchUp(0.5, 0.1);
  assert.ok(near(remain, 0.4));
  assert.ok(near(k0, 0.2));
  // 起點進度＋剩餘時間剛好走完整段（不瞬移、不重飛）
  assert.ok(near(k0 * 0.5 + remain, 0.5));
});

test('延遲比飛行還長：至少再飛 0.1s；沒延遲就整段飛', () => {
  const a = plazaCatchUp(0.15, 0.2);
  assert.equal(a.remain, PLAZA_REMAIN_MIN);
  assert.ok(a.k0 > 0 && a.k0 < 1);
  const b = plazaCatchUp(0.3, 0);
  assert.equal(b.k0, 0);
  assert.equal(b.remain, 0.3);
  // 飛行本身比最短剩餘還短：不超過飛行時間
  const c = plazaCatchUp(0.08, 0.05);
  assert.equal(c.remain, 0.08);
  assert.equal(c.k0, 0);
});

test('阿婆主動丟玩家維持原本 1 秒蓄力', () => {
  assert.equal(PLAZA_NPC_WINDUP, 1.0);
});
