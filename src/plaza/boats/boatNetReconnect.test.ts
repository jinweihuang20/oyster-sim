import { describe, it, expect, vi, afterEach } from 'vitest';
import { HubConnectionState } from '@microsoft/signalr';
import { makeBoatNet } from './boatNet';
import { fishErr, fishNetErr } from './fishLogic';

/** 假的 PlazaClient：invoke 依序回 answers（Error＝丟例外） */
function fakeClient(answers: Record<string, (unknown | Error)[]>) {
  const calls: string[] = [];
  const client: any = {
    afterJoin: [] as (() => void)[],
    bindExtra() { /* 不需要事件 */ },
    conn: {
      state: HubConnectionState.Connected,
      async invoke(m: string) {
        calls.push(m);
        const q = answers[m] ?? [];
        const a = q.length > 1 ? q.shift() : q[0];
        if (a instanceof Error) throw a;
        return a ?? { ok: false, err: 'nope' };
      },
    },
  };
  return { client, calls, join: async () => { for (const f of client.afterJoin) f(); await new Promise(r => setTimeout(r, 0)); } };
}
const snap = { ok: true, state: { boats: [], swimmers: [], t: 1, v: 1 } };
const flush = () => new Promise(r => setTimeout(r, 0));

afterEach(() => { vi.useRealTimers(); });

describe('斷線重連：不要把一次連線失敗當成舊伺服器', () => {
  it('BoatState 斷線丟例外：重試，不切本機模式', async () => {
    vi.useFakeTimers();
    const { client, calls } = fakeClient({ BoatState: [new Error('Invocation canceled due to the underlying connection being closed.'), snap], DriftState: [{ ok: false }], RackState: [{ ok: false }] });
    const states: unknown[] = [];
    const net = makeBoatNet(client, { state: s => states.push(s) } as any);
    const p = net.fetchState(3, 100);
    await vi.advanceTimersByTimeAsync(250);
    await p;
    expect(states).toHaveLength(1);
    expect(states[0]).not.toBeNull();
    expect(net.supported()).toBe(true);
    expect(calls.filter(c => c === 'BoatState')).toHaveLength(2);
  });

  it('真的沒有方法（舊伺服器）才切本機；重連到新伺服器後恢復', async () => {
    const { client, join } = fakeClient({ BoatState: [new Error("Method does not exist."), snap], FishCast: [{ ok: true, sid: 1 }], DriftState: [{ ok: false }], RackState: [{ ok: false }] });
    const states: unknown[] = []; let rejoins = 0;
    const net = makeBoatNet(client, { state: s => states.push(s), rejoined: () => { rejoins++; } } as any);
    await join();
    expect(states).toEqual([null]);
    expect(net.supported()).toBe(false);
    expect((await net.fish('FishCast')).err).toBe('old_server');
    // 伺服器更新完、重新連上：不能還卡在舊伺服器
    await join(); await flush();
    expect(rejoins).toBe(2);
    expect(net.supported()).toBe(true);
    expect(states[1]).not.toBeNull();
    expect((await net.fish('FishCast')).ok).toBe(true);
  });

  it('呼叫中斷線＝fail，不會讓之後的呼叫都變成舊伺服器', async () => {
    const { client } = fakeClient({ FishCast: [new Error('connection closed'), { ok: true, sid: 2 }] });
    const net = makeBoatNet(client, { state: () => {} } as any);
    expect((await net.fish('FishCast')).err).toBe('fail');
    expect((await net.fish('FishCast')).ok).toBe(true);
  });
});

describe('釣魚錯誤訊息', () => {
  it('斷線相關的錯誤有自己的說法，不是一律「拋不出去」', () => {
    expect(fishErr('fail', '拋不出去')).toBe('連線不穩，再拋一次');
    expect(fishErr('not_joined', '拋不出去')).toBe('重新連線中，等一下再拋');
    expect(fishErr('fighting', '拋不出去')).toBe('上一竿還沒收好，再拋一次');
    expect(fishErr('offline', '拋不出去')).toBe('還沒連上線');
    expect(fishErr('slow', 'x')).toBe('x');
    expect(fishErr('constructor', 'x')).toBe('x');
    expect(fishErr(undefined, 'x')).toBe('x');
  });
  it('哪些錯誤表示伺服器那邊可能還掛著上一竿', () => {
    expect(['offline', 'fail', 'not_joined'].every(fishNetErr)).toBe(true);
    expect(['no_cast', 'fighting', 'slow', 'old_server', undefined].some(fishNetErr)).toBe(false);
  });
});
