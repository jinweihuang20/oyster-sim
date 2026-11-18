import { test } from 'vitest';
import assert from 'node:assert/strict';
import { PLAZA_WINDUP, PLAZA_INBOUND_FLY, PLAZA_SHELL_LAND, plazaShellFlight } from './shellTiming.ts';

const land = PLAZA_WINDUP + PLAZA_INBOUND_FLY;

test('丟真人：本機落地時間＝對方蓄力＋飛行（對方此時才判定擋／反彈）', () => {
  assert.equal(plazaShellFlight({ who: 'thrower', targetIsNpc: false })[0], land);
});

test('丟阿婆：伺服器當下結算，本機維持快飛', () => {
  assert.ok(plazaShellFlight({ who: 'thrower', targetIsNpc: true })[0] < 0.6);
});

test('旁觀：丟真人用同樣時間；反彈、阿婆、舊伺服器維持快飛', () => {
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: false, targetIsNpc: false })[0], land);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: true, targetIsNpc: false })[0], PLAZA_INBOUND_FLY);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: false, targetIsNpc: true })[0], PLAZA_INBOUND_FLY);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: undefined, targetIsNpc: false })[0], PLAZA_INBOUND_FLY);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: false, targetIsNpc: null })[0], PLAZA_INBOUND_FLY);
});

test('時間平衡：蓄力 0.65s＋飛行 0.4s＝1.05s，反彈飛回 0.4s', () => {
  assert.equal(PLAZA_WINDUP, 0.65);
  assert.equal(PLAZA_INBOUND_FLY, 0.4);
  assert.ok(Math.abs(PLAZA_SHELL_LAND - 1.05) < 1e-9);
  assert.equal(plazaShellFlight({ who: 'spectator', reflect: true, targetIsNpc: false })[0], 0.4);
});
