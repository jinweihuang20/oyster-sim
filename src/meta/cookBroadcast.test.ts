import { describe, expect, it } from 'vitest';
import {
  BC_POLL_MS, BC_STALE_MS,
  cookBcApplyPoll, cookBcCursorInit, cookBcMarkDisconnected, cookBcParseItems, cookBcPlan,
  type CookBcCursor,
} from './cookBroadcast';

const t0 = 1_000_000;
const first = (id: number, combo = 12) => ({ id, kind: 'first', nick: '阿明', tag: '1234', combo, score: 0, ts: t0 });
const ama = (id: number, combo = 20, score = 90) => ({ id, kind: 'ama', nick: '小美', tag: '5678', combo, score, ts: t0 });

/** 剛開遊戲：用 since=-1 追到最新，不補播歷史 */
function openGame(now = t0, last = 40): CookBcCursor {
  const plan = cookBcPlan(cookBcCursorInit(), now);
  expect(plan).toEqual({ recover: true, since: -1 });
  const res = cookBcApplyPoll(cookBcCursorInit(), { last, items: [first(1), ama(2)] }, now, plan.recover);
  expect(res.discard).toBe(true);
  expect(res.items).toEqual([]);
  expect(res.cursor).toEqual({ last, lastOkAt: now, skipBacklog: false });
  return res.cursor;
}

describe('蚵仔煎全服廣播輪詢', () => {
  it('緩衝比輪詢間隔長，避免正常 12 秒一輪被當成斷線', () => {
    expect(BC_POLL_MS).toBe(12_000);
    expect(BC_STALE_MS).toBeGreaterThan(BC_POLL_MS);
  });

  it('連線中的新廣播會顯示（全服首創與阿婆好評）', () => {
    let cur = openGame();
    const now = t0 + BC_POLL_MS;
    const plan = cookBcPlan(cur, now);
    expect(plan).toEqual({ recover: false, since: 40 });
    const items = [first(41, 3), ama(42, 8, 92)];
    const res = cookBcApplyPoll(cur, { last: 42, items }, now, plan.recover);
    expect(res.discard).toBe(false);
    expect(res.cursor.last).toBe(42);
    expect(res.cursor.skipBacklog).toBe(false);
    expect(res.items.map(x => `${x.kind}:${x.combo}:${x.score}`)).toEqual(['first:3:0', 'ama:8:92']);
  });

  it('輪詢失敗會標記斷線並清佇列；恢復時用 since=-1 丟棄漏掉的，且遊標追到最新，之後新的才顯示', () => {
    let cur = openGame();
    // 連線中先排了一則還沒看
    const live = cookBcApplyPoll(cur, { last: 41, items: [first(41)] }, t0 + BC_POLL_MS, false);
    expect(live.discard).toBe(false);
    expect(live.items).toHaveLength(1);
    cur = live.cursor;

    const failed = cookBcApplyPoll(cur, null, t0 + BC_POLL_MS * 2, false);
    expect(failed.discard).toBe(true);
    expect(failed.items).toEqual([]);
    expect(failed.cursor.last).toBe(41); // 失敗不後退也不推進遊標
    expect(failed.cursor.skipBacklog).toBe(true);
    cur = failed.cursor;

    // 恢復：即使回傳斷線期間的一串，也不播；since 要改問 -1，避免舊伺服器把漏的全送回來還被誤播
    const now = t0 + BC_POLL_MS * 2 + 1000;
    const plan = cookBcPlan(cur, now);
    expect(plan).toEqual({ recover: true, since: -1 });
    const recover = cookBcApplyPoll(cur, { last: 80, items: [first(50), ama(60), first(70), ama(80)] }, now, plan.recover);
    expect(recover.discard).toBe(true);
    expect(recover.items).toEqual([]);
    expect(recover.cursor).toEqual({ last: 80, lastOkAt: now, skipBacklog: false });
    cur = recover.cursor;

    // 恢復後的下一輪：只顯示這之後的新廣播，不會重播 50～80
    const later = now + BC_POLL_MS;
    const nextPlan = cookBcPlan(cur, later);
    expect(nextPlan).toEqual({ recover: false, since: 80 });
    const next = cookBcApplyPoll(cur, { last: 81, items: [ama(81, 15, 88)] }, later, nextPlan.recover);
    expect(next.discard).toBe(false);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toMatchObject({ kind: 'ama', combo: 15, score: 88 });
    expect(next.cursor.last).toBe(81);
  });

  it('offline 標記與過長間隔一樣會丟棄漏掉的廣播', () => {
    let cur = openGame();
    cur = cookBcMarkDisconnected(cur);
    expect(cur.skipBacklog).toBe(true);
    const plan = cookBcPlan(cur, t0 + 1000);
    expect(plan.recover).toBe(true);
    expect(plan.since).toBe(-1);

    // 分頁在背景太久：即使沒設 skipBacklog，只要超過 BC_STALE_MS 也當斷線
    cur = openGame();
    const late = t0 + BC_STALE_MS + 1;
    const gap = cookBcPlan(cur, late);
    expect(gap).toEqual({ recover: true, since: -1 });
    const res = cookBcApplyPoll(cur, { last: 99, items: [first(90), ama(99)] }, late, gap.recover);
    expect(res.discard).toBe(true);
    expect(res.items).toEqual([]);
    expect(res.cursor.last).toBe(99);

    // 正常間隔內不會誤判
    const onTime = cookBcPlan(openGame(), t0 + BC_POLL_MS);
    expect(onTime.recover).toBe(false);
    expect(onTime.since).toBe(40);
  });

  it('請求期間又斷線：即使出發時還連著，回來也要丟棄', () => {
    let cur = openGame();
    const plan = cookBcPlan(cur, t0 + BC_POLL_MS);
    expect(plan.recover).toBe(false);
    cur = cookBcMarkDisconnected(cur);
    const res = cookBcApplyPoll(cur, { last: 55, items: [first(55)] }, t0 + BC_POLL_MS + 200, plan.recover);
    expect(res.discard).toBe(true);
    expect(res.items).toEqual([]);
    expect(res.cursor.last).toBe(55);
    expect(res.cursor.skipBacklog).toBe(false);
  });

  it('壞資料略過，合法項目才會進顯示清單', () => {
    const items = cookBcParseItems([
      { kind: 'nope', combo: 1 },
      { kind: 'first', combo: 1.5 },
      { kind: 'first', combo: 7, nick: '阿明', tag: '1' },
      null,
    ], t0);
    expect(items).toHaveLength(1);
    expect(items[0].combo).toBe(7);
  });
});
