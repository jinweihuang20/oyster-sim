import { describe, it, expect } from 'vitest';
import { FISH_SYNC, newFishSync, copyFishSync, fishSyncChanged, fishSyncDue, normFishSync, fishBadgeOf, FISH_BADGE_TEXT, fishLineOut, fishLineEnd } from './fishSync';
import { fishPoseCode, fishPoseDecode, fishPoseDecodeInto, newFishPose, stepFishPose, fishPoseTarget, type FishPoseIn } from './fishPose';
import { castPoint } from './fishLogic';
import { HubConnectionState } from '@microsoft/signalr';
import { makeBoatNet } from './boatNet';

const msg = (o: Partial<ReturnType<typeof newFishSync>>) => ({ ...newFishSync(), ...o });

describe('釣魚動作同步：什麼時候送', () => {
  it('沒在釣就不送；開始釣馬上送', () => {
    const last = newFishSync();
    expect(fishSyncDue(last, msg({ st: 0 }), false, 99)).toBe(false);
    expect(fishSyncDue(last, msg({ st: 1 }), false, 0)).toBe(true);
  });
  it('姿勢換了：過了最短間隔才送；沒變就等保底', () => {
    const last = msg({ st: 4, cd: 12 });
    expect(fishSyncDue(last, msg({ st: 5, cd: 12 }), true, 0.1)).toBe(false);
    expect(fishSyncDue(last, msg({ st: 5, cd: 12 }), true, FISH_SYNC.minGap)).toBe(true);
    expect(fishSyncDue(last, msg({ st: 4, cd: 12 }), true, 1.5)).toBe(false);
    expect(fishSyncDue(last, msg({ st: 4, cd: 12 }), true, FISH_SYNC.keepAlive)).toBe(true);
  });
  it('不釣了：立刻送一次（頭上的「釣魚中」才會馬上收掉），之後不再送', () => {
    expect(fishSyncDue(msg({ st: 4 }), msg({ st: 0 }), true, 0)).toBe(true);
    expect(fishSyncDue(msg({ st: 0 }), msg({ st: 0 }), true, 10)).toBe(false);
  });
  it('看得出來的變化才算：線長 1 m、拉魚張力 0.25、甲板走動、轉身、拋竿方向', () => {
    const a = msg({ st: 5, boat: true, cd: 10, tn: 0.5, dx: 0.1, dz: 0.2, yaw: 0.3, ch: 1 });
    expect(fishSyncChanged(a, copyFishSync(a, newFishSync()))).toBe(false);
    expect(fishSyncChanged(a, { ...a, cd: 10.5 })).toBe(false);
    expect(fishSyncChanged(a, { ...a, cd: 9 })).toBe(true);
    expect(fishSyncChanged(a, { ...a, tn: 0.6 })).toBe(false);
    expect(fishSyncChanged(a, { ...a, tn: 0.75 })).toBe(true);
    expect(fishSyncChanged({ ...a, st: 4 }, { ...a, st: 4, tn: 1 })).toBe(false);
    expect(fishSyncChanged(a, { ...a, dx: 0.3 })).toBe(true);
    expect(fishSyncChanged(a, { ...a, yaw: 0.3 + Math.PI * 2 })).toBe(false);
    expect(fishSyncChanged(a, { ...a, yaw: 0.7 })).toBe(true);
    expect(fishSyncChanged(a, { ...a, ch: 1.2 })).toBe(true);
    expect(fishSyncChanged(a, { ...a, sp: 'kurodai' })).toBe(true);
    // 岸上不看甲板座標
    expect(fishSyncChanged({ ...a, boat: false }, { ...a, boat: false, dx: 0.9 })).toBe(false);
  });
});

describe('收到別人的同步', () => {
  it('PascalCase／camelCase、壞數字、沒有 connId', () => {
    const m = normFishSync({ ConnId: 'c1', St: 21, Boat: true, Dx: 0.2, Dz: '0.4', Yaw: 1, Ch: 2, Cd: 999, Tn: 3, Sp: 'kurodai', Kg: 1.5 })!;
    expect(m).toMatchObject({ connId: 'c1', st: 21, boat: true, dx: 0.2, dz: 0.4, yaw: 1, ch: 2, cd: 40, tn: 1, sp: 'kurodai', kg: 1.5 });
    const b = normFishSync({ connId: 'c2', st: 'x', cd: NaN })!;
    expect(b.st).toBe(0); expect(b.cd).toBe(0); expect(b.boat).toBe(false);
    expect(normFishSync({ st: 4 })).toBeNull();
  });
  it('頭上狀態牌：釣魚中／拉魚中！／釣到了！；不釣了就收', () => {
    expect(fishBadgeOf(0)).toBe(0);
    for (const st of [1, 2, 3, 4, 6, 1 + 16, 4 + 16]) expect(fishBadgeOf(st)).toBe(1);
    expect(fishBadgeOf(5)).toBe(2); expect(fishBadgeOf(5 + 16)).toBe(2);
    expect(fishBadgeOf(7)).toBe(3);
    expect(FISH_BADGE_TEXT[1]).toBe('釣魚中'); expect(FISH_BADGE_TEXT[2]).toBe('拉魚中！');
  });
  it('線落點：跟拋竿判定同一個方向慣例、同一個距離', () => {
    expect(fishLineOut(4)).toBe(true); expect(fishLineOut(5 + 16)).toBe(true); expect(fishLineOut(6)).toBe(true);
    expect(fishLineOut(1)).toBe(false); expect(fishLineOut(3)).toBe(false); expect(fishLineOut(7)).toBe(false);
    const e = fishLineEnd(-40, 2, 1.1, 18, { x: 0, z: 0 });
    expect(Math.hypot(e.x + 40, e.z - 2)).toBeCloseTo(18);
    // castPoint 是本機拋竿落點：power 1 的鐵板＝26 m
    const c = castPoint(-40, 2, 1.1, 1, 'jig');
    const e2 = fishLineEnd(-40, 2, 1.1, Math.hypot(c.x + 40, c.z - 2), { x: 0, z: 0 });
    expect(e2.x).toBeCloseTo(c.x); expect(e2.z).toBeCloseTo(c.z);
  });
});

describe('姿勢代碼：秀漁獲', () => {
  it('7＝秀漁獲；路亞 +16；解碼到既有物件', () => {
    expect(fishPoseCode('show', false, false)).toBe(7);
    expect(fishPoseCode('show', false, true)).toBe(23);
    expect(fishPoseDecode(23).phase).toBe('show');
    expect(fishPoseDecode(23).lure).toBe(true);
    const o: FishPoseIn = { phase: 'off', power: 0, reel: false, tension: 0, lure: false, twitch: 0 };
    for (const st of [0, 1, 2, 3, 4, 5, 6, 7, 17, 21, 22]) {
      const a = fishPoseDecode(st), b = fishPoseDecodeInto(st, o, 0.7);
      expect(b).toBe(o);
      expect([b.phase, b.reel, b.lure]).toEqual([a.phase, a.reel, a.lure]);
      expect(b.tension).toBe(0.7);
    }
  });
  it('秀漁獲：竿子比等待時舉得高、身體微後仰；拉魚：後仰、竿彎', () => {
    const base: FishPoseIn = { phase: 'wait', power: 0, reel: false, tension: 0, lure: false, twitch: 0 };
    const w = fishPoseTarget(base, -1, 0), s = fishPoseTarget({ ...base, phase: 'show' }, -1, 0), f = fishPoseTarget({ ...base, phase: 'fight', tension: 1 }, -1, 0);
    expect(s.pitch).toBeGreaterThan(w.pitch + 0.5);
    expect(s.lean).toBeLessThan(0);
    expect(f.lean).toBeGreaterThan(0.2); expect(f.bend).toBeGreaterThan(0.8);
    const st = newFishPose();
    for (let i = 0; i < 60; i++) stepFishPose(st, { ...base, phase: 'show' }, 1 / 30);
    expect(st.pitch).toBeGreaterThan(1.3);
  });
});

describe('送出：新伺服器 FishSync、舊伺服器退回 FishPose', () => {
  const mk = (fishSyncOk: boolean) => {
    const calls: [string, unknown[]][] = [];
    const client: any = {
      afterJoin: [], bindExtra() {},
      conn: {
        state: HubConnectionState.Connected,
        async invoke(m: string, ...a: unknown[]) {
          calls.push([m, a]);
          if (m === 'BoatState') return { ok: true, state: { boats: [], swimmers: [], t: 1, v: 1 } };
          if (m === 'FishSync' && !fishSyncOk) throw new Error("Method does not exist.");
          return { ok: true };
        },
      },
    };
    return { calls, net: makeBoatNet(client, { state: () => {} } as any) };
  };
  const flush = () => new Promise(r => setTimeout(r, 0));
  it('新伺服器：一筆帶全部欄位；上一筆還沒回來就不送', async () => {
    const { calls, net } = mk(true);
    await net.fetchState(); await flush();
    expect(net.fishSync(msg({ st: 5, boat: false, yaw: 1, ch: 1, cd: 14.5, tn: 0.75 }))).toBe(true);
    expect(net.fishSync(msg({ st: 5 }))).toBe(false);
    await flush();
    const fs = calls.filter(c => c[0] === 'FishSync');
    expect(fs).toHaveLength(1);
    expect(fs[0][1]).toEqual([5, false, 0, 0, 1, 1, 14.5, 0.75, '', 0]);
  });
  it('舊伺服器：船上改送 FishPose（秀漁獲當持竿）；岸上不送', async () => {
    const { calls, net } = mk(false);
    await net.fetchState(); await flush();
    net.fishSync(msg({ st: 4, boat: true, dx: 0.2, dz: 0.3, yaw: 1 })); await flush(); await flush();
    net.fishSync(msg({ st: 7 + 16, boat: true, dx: 0.2, dz: 0.3, yaw: 1 })); await flush();
    expect(net.fishSync(msg({ st: 4, boat: false }))).toBe(true); await flush();
    const fp = calls.filter(c => c[0] === 'FishPose');
    expect(fp).toHaveLength(1);
    expect(fp[0][1]).toEqual([0.2, 0.3, 1, 1 + 16]);
  });
});
