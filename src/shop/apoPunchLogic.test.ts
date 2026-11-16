import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APO_PUNCH_INTERVAL,
  APO_PUNCH_RETRY,
  APO_PUNCH_PENDING,
  apoPunchAllowedFrom,
  tickApoPunchTimer,
  apoPunchTimerOnWake,
  resolveApoPunchTimer,
  plazaPunchProceed,
  plazaPunchLocalSteal,
  type ApoPunchGateInput,
} from './apoPunchLogic.ts';

const base = (over: Partial<ApoPunchGateInput> = {}): ApoPunchGateInput => ({
  play: true, tut: false, race: false, isApo: true, mg: false,
  plaza: false, plazaActive: false, shucking: false, ...over,
});

test('廣場站著（未走動、未剝蚵）也允許出拳', () => {
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true, shucking: false })), true);
});

test('廣場走動允許出拳', () => {
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true })), true);
});

test('廣場坐下剝蚵允許出拳', () => {
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true, shucking: true })), true);
});

test('未在廣場且沒有剝蚵則不出拳', () => {
  assert.equal(apoPunchAllowedFrom(base()), false);
  assert.equal(apoPunchAllowedFrom(base({ shucking: true })), true);
});

test('競速或機關槍或非阿珀時關閉', () => {
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true, race: true })), false);
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true, mg: true })), false);
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true, isApo: false })), false);
});

test('掛機時廣場或工寮都不允許出拳', () => {
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true, afk: true })), false);
  assert.equal(apoPunchAllowedFrom(base({ shucking: true, afk: true })), false);
  assert.equal(apoPunchAllowedFrom(base({ plaza: true, plazaActive: true, afk: false })), true);
});

test('不允許時計時暫停，剩餘秒數保留', () => {
  const paused = tickApoPunchTimer(false, 3.5, 1);
  assert.deepEqual(paused, { dueIn: 3.5, fire: false });
});

test('掛機醒來時，不論原本是 PENDING、即將到期或剩餘 2 秒，都重設為 10 秒', () => {
  assert.equal(apoPunchTimerOnWake(true, false, APO_PUNCH_PENDING), APO_PUNCH_INTERVAL);
  assert.equal(apoPunchTimerOnWake(true, false, 0.2), APO_PUNCH_INTERVAL);
  assert.equal(apoPunchTimerOnWake(true, false, APO_PUNCH_RETRY), APO_PUNCH_INTERVAL);
  assert.equal(apoPunchTimerOnWake(true, true, 3), 3);
  assert.equal(apoPunchTimerOnWake(false, false, 3), 3);
});

test('醒來後要再等滿 10 秒才會出拳，不會卡在 PENDING 或立刻打出', () => {
  const due = apoPunchTimerOnWake(true, false, APO_PUNCH_PENDING);
  const mid = tickApoPunchTimer(true, due, 9.5);
  assert.equal(mid.fire, false);
  const fire = tickApoPunchTimer(true, mid.dueIn, 0.6);
  assert.equal(fire.fire, true);
  assert.equal(fire.dueIn, APO_PUNCH_PENDING);
});

test('允許時從 0 先臂成 10 秒再倒數，到時觸發並進入 pending', () => {
  let due = 0;
  const first = tickApoPunchTimer(true, due, 0.5);
  assert.equal(first.fire, false);
  assert.ok(Math.abs(first.dueIn - (APO_PUNCH_INTERVAL - 0.5)) < 1e-9);
  due = first.dueIn;
  // 再扣到剛好超過剩餘
  const fire = tickApoPunchTimer(true, due, due + 0.01);
  assert.equal(fire.fire, true);
  assert.equal(fire.dueIn, APO_PUNCH_PENDING);
});

test('連續出拳：成功後再等 10 秒才會再觸發，失敗則約 2 秒重試，可無限循環', () => {
  let due = resolveApoPunchTimer(true);
  assert.equal(due, APO_PUNCH_INTERVAL);
  // 模擬 9.5 秒還沒出
  let step = tickApoPunchTimer(true, due, 9.5);
  assert.equal(step.fire, false);
  step = tickApoPunchTimer(true, step.dueIn, 0.6);
  assert.equal(step.fire, true);
  assert.equal(step.dueIn, APO_PUNCH_PENDING);
  due = resolveApoPunchTimer(true);
  assert.equal(due, APO_PUNCH_INTERVAL);

  // 沒打到：2 秒後再探
  due = resolveApoPunchTimer(false);
  assert.equal(due, APO_PUNCH_RETRY);
  step = tickApoPunchTimer(true, due, 1.9);
  assert.equal(step.fire, false);
  step = tickApoPunchTimer(true, step.dueIn, 0.2);
  assert.equal(step.fire, true);

  // 再成功，再跑一輪 10 秒
  due = resolveApoPunchTimer(true);
  step = tickApoPunchTimer(true, due, 10);
  assert.equal(step.fire, true);
  assert.equal(step.dueIn, APO_PUNCH_PENDING);
});

test('廣場同步：slow／舊服／斷線仍播出拳；far 則重試', () => {
  assert.equal(plazaPunchProceed({ ok: true }), 'play');
  assert.equal(plazaPunchProceed({ ok: false, err: 'slow' }), 'play');
  assert.equal(plazaPunchProceed({ ok: false, err: 'nosup' }), 'play');
  assert.equal(plazaPunchProceed({ ok: false, err: 'no_conn' }), 'play');
  assert.equal(plazaPunchProceed({ ok: false, err: 'far' }), 'retry');
  assert.equal(plazaPunchProceed({ ok: false, err: 'no_pet' }), 'retry');
});

test('碗裡有肉就本機偷到，不管伺服器 ok／slow／失敗；空碗不偷', () => {
  assert.equal(plazaPunchLocalSteal({ ok: true }, true), true);
  assert.equal(plazaPunchLocalSteal({ ok: true, err: undefined }, true), true);
  assert.equal(plazaPunchLocalSteal({ ok: false, err: 'slow' }, true), true);
  assert.equal(plazaPunchLocalSteal({ ok: false, err: 'nosup' }, true), true);
  assert.equal(plazaPunchLocalSteal({ ok: false, err: 'no_conn' }, true), true);
  assert.equal(plazaPunchLocalSteal({ ok: false, err: 'far' }, true), true);
  assert.equal(plazaPunchLocalSteal(null, true), true);
  assert.equal(plazaPunchLocalSteal({ ok: true }, false), false);
  assert.equal(plazaPunchLocalSteal({ ok: false, err: 'slow' }, false), false);
});
