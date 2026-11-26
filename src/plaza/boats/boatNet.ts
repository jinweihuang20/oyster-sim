/** 廣場海面的連線：叫伺服器的 Boat* 方法、收事件。舊伺服器沒有這些方法時改成「只有自己看得到」。 */
import type * as signalR from '@microsoft/signalr';
import { HubConnectionState } from '@microsoft/signalr';
import type { PlazaClient } from '../hubClient';
import { normRack, normRackSnap, type RackDto, type RackSnap } from './rackLogic';

export type BoatDto = { id: number; x: number; z: number; h: number; v: number; seats: string[] };
export type SwimDto = { connId: string; x: number; z: number; h: number };
export type BoatsSnap = { boats: BoatDto[]; swimmers: SwimDto[]; t: number; v: number };
export type RamDto = { by: string; byNick: string; fromBoat: number; target: number; x: number; z: number; ix: number; iz: number; knocked: SwimDto[] };
export type BoatPosesDto = { t: number; b: [number, number, number, number, number][]; s: [string, number, number, number][] };

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const g = (o: any, k: string) => o?.[k] ?? o?.[k[0].toUpperCase() + k.slice(1)];
export function normBoat(o: any): BoatDto | null {
  if (!o) return null;
  const id = num(g(o, 'id'), -1); if (id < 0) return null;
  const seats = (g(o, 'seats') ?? []) as unknown[];
  return { id, x: num(g(o, 'x')), z: num(g(o, 'z')), h: num(g(o, 'h')), v: num(g(o, 'v')), seats: [0, 1, 2, 3].map(i => String(seats[i] ?? '')) };
}
export function normSwim(o: any): SwimDto | null {
  const c = String(g(o, 'connId') ?? ''); if (!c) return null;
  return { connId: c, x: num(g(o, 'x')), z: num(g(o, 'z')), h: num(g(o, 'h')) };
}
function normSnap(o: any): BoatsSnap | null {
  if (!o) return null;
  return {
    boats: ((g(o, 'boats') ?? []) as any[]).map(normBoat).filter((b): b is BoatDto => !!b),
    swimmers: ((g(o, 'swimmers') ?? []) as any[]).map(normSwim).filter((s): s is SwimDto => !!s),
    t: num(g(o, 't')), v: num(g(o, 'v')),
  };
}

/** gold＝金色大箱子（要多人一起拉）；tide＝漂流潮多出來的 */
export type DriftBox = { key: number; x: number; z: number; gold?: boolean; tide?: boolean };
export type DriftSnap = {
  boxes: DriftBox[]; nextShuffleAt: number; minPay: number; maxPay: number;
  /** 漂流潮進行中到幾點（0＝沒有）、下一次幾點；金箱金額、要幾人、幾秒內一起拉；今天第一次撈加碼 */
  tideUntil: number; nextTideAt: number; goldMin: number; goldMax: number; goldNeed: number; goldWindowMs: number; bonusPct: number; bonusLeft: boolean;
};
export type DriftClaimed = { key: number; connId: string; nick: string; pay: number; n: number; gold: boolean };
/** 同船（或一起拉金箱）有人撈到漂流箱：我分到的錢（bonus＝今天第一次的加碼） */
export type DriftShare = { key: number; pay: number; bonus: number; total: number; n: number; by: string; gold: boolean };
export type DriftTide = { until: number; n: number; gold: boolean };
export type DriftPull = { key: number; n: number; need: number; nick: string };
export function normDrift(o: any): DriftSnap | null {
  if (!o) return null;
  const boxes = ((g(o, 'boxes') ?? []) as any[]).map(b => ({ key: num(g(b, 'key'), -1), x: num(g(b, 'x')), z: num(g(b, 'z')), gold: !!g(b, 'gold'), tide: !!g(b, 'tide') })).filter(b => b.key > 0);
  return {
    boxes, nextShuffleAt: num(g(o, 'nextShuffleAt')), minPay: num(g(o, 'minPay'), 5000), maxPay: num(g(o, 'maxPay'), 20000),
    tideUntil: num(g(o, 'tideUntil')), nextTideAt: num(g(o, 'nextTideAt')), goldMin: num(g(o, 'goldMin'), 30000), goldMax: num(g(o, 'goldMax'), 45000),
    goldNeed: Math.max(2, num(g(o, 'goldNeed'), 2)), goldWindowMs: num(g(o, 'goldWindowMs'), 8000), bonusPct: num(g(o, 'bonusPct')), bonusLeft: !!g(o, 'bonusLeft'),
  };
}

export type BoatNetEvents = {
  /** 漂流箱整包（換位置／補新的／進場） */
  drift?: (s: DriftSnap) => void;
  driftClaimed?: (e: DriftClaimed) => void;
  driftShare?: (e: DriftShare) => void;
  /** 漂流潮開始（整點）／有人在拉金箱子 */
  driftTide?: (e: DriftTide) => void;
  driftPull?: (e: DriftPull) => void;
  seats: (b: BoatDto) => void;
  poses: (p: BoatPosesDto) => void;
  ram: (r: RamDto) => void;
  swimStart: (s: SwimDto) => void;
  swimEnd: (connId: string) => void;
  rescued: (e: { boatId: number; seat: number; by: string }) => void;
  /** Join／重連後：伺服器的完整狀態（null＝舊伺服器，不支援） */
  state: (s: BoatsSnap | null, soft?: boolean) => void;
  /** 蚵棚：整包（進場／對帳）、單座更新、收掉 */
  racks?: (s: RackSnap) => void;
  rackUpd?: (r: RackDto) => void;
  rackGone?: (id: number) => void;
  /** 我的私人蚵棚被偷（warn＝防盜 Lv3 起：有人靠近想偷） */
  rackStolen?: (e: { rackId: number; by: string; warn: boolean }) => void;
  /** 我被撞下水掉了船貨 */
  cargo?: (e: { cargo: number; lost: number }) => void;
  /** 一艘船上所有人的船貨合計 */
  load?: (e: { boatId: number; load: number }) => void;
  /** 有人釣到傳說魚（全廣場公告） */
  fishBig?: (e: { connId: string; nick: string; name: string; kg: number }) => void;
  /** 別人在船上釣魚：站的位置（船身座標）、面向、姿勢代碼（fishPose.ts） */
  fishPose?: (e: { connId: string; dx: number; dz: number; yaw: number; st: number }) => void;
};
export type HaulRes = { ok: boolean; err?: string; cargo?: number; cargoVal?: number; rack?: RackDto | null; fine?: number };
export type SellRes = { ok: boolean; err?: string; pay?: number; strings?: number; kg?: number; cargo?: number; bonus?: number };
export type RackUpRes = { ok: boolean; err?: string; rack?: RackDto | null; line?: number; lv?: number; cost?: number };

export type BoatRes = { ok: boolean; err?: string; boat?: BoatDto | null; seat?: number; swim?: SwimDto | null; cargo?: number; lost?: number };

export function makeBoatNet(client: PlazaClient, ev: BoatNetEvents) {
  let supported: boolean | null = null;
  let closed = false;
  const live = () => !closed && !!client.conn && client.conn.state === HubConnectionState.Connected;
  const call = async (m: string, ...a: unknown[]): Promise<any> => {
    if (!live() || supported === false) return { ok: false, err: supported === false ? 'old_server' : 'offline' };
    try { return await client.conn!.invoke(m, ...a); } catch (e: any) { return { ok: false, err: String(e?.message ?? 'fail').includes('does not exist') ? 'old_server' : 'fail' }; }
  };
  const res = (r: any): BoatRes => ({ ok: !!r?.ok, err: r?.err, boat: normBoat(r?.boat), seat: r?.seat != null ? num(r.seat, -1) : undefined, swim: normSwim(r?.swim), cargo: r?.cargo != null ? num(r.cargo) : undefined, lost: r?.lost != null ? num(r.lost) : undefined });

  client.bindExtra((conn: signalR.HubConnection) => {
    const safe = (f: (x: any) => void) => (x: any) => { if (closed) return; try { f(x); } catch (e) { console.error('boat ev', e); } };
    conn.on('BoatSeats', safe(x => { const b = normBoat(x); if (b) ev.seats(b); }));
    conn.on('BoatPoses', safe(x => ev.poses({ t: num(g(x, 't')), b: (g(x, 'b') ?? []) as any, s: (g(x, 's') ?? []) as any })));
    conn.on('BoatRam', safe(x => ev.ram({
      by: String(g(x, 'by') ?? ''), byNick: String(g(x, 'byNick') ?? ''), fromBoat: num(g(x, 'fromBoat'), -1), target: num(g(x, 'target'), -1),
      x: num(g(x, 'x')), z: num(g(x, 'z')), ix: num(g(x, 'ix')), iz: num(g(x, 'iz')),
      knocked: ((g(x, 'knocked') ?? []) as any[]).map(normSwim).filter((s): s is SwimDto => !!s),
    })));
    conn.on('SwimStart', safe(x => { const s = normSwim(x); if (s) ev.swimStart(s); }));
    conn.on('SwimEnd', safe(x => { const c = String(g(x, 'connId') ?? ''); if (c) ev.swimEnd(c); }));
    conn.on('DriftBoxes', safe(x => { const d = normDrift(x); if (d) ev.drift?.(d); }));
    conn.on('DriftClaimed', safe(x => ev.driftClaimed?.({ key: num(g(x, 'key'), -1), connId: String(g(x, 'connId') ?? ''), nick: String(g(x, 'nick') ?? ''), pay: num(g(x, 'pay')), n: Math.max(1, num(g(x, 'n'), 1)), gold: !!g(x, 'gold') })));
    conn.on('DriftShare', safe(x => ev.driftShare?.({ key: num(g(x, 'key'), -1), pay: num(g(x, 'pay')), bonus: num(g(x, 'bonus')), total: num(g(x, 'total')), n: Math.max(1, num(g(x, 'n'), 1)), by: String(g(x, 'by') ?? ''), gold: !!g(x, 'gold') })));
    conn.on('DriftTide', safe(x => ev.driftTide?.({ until: num(g(x, 'until')), n: num(g(x, 'n')), gold: !!g(x, 'gold') })));
    conn.on('DriftPull', safe(x => ev.driftPull?.({ key: num(g(x, 'key'), -1), n: num(g(x, 'n')), need: Math.max(2, num(g(x, 'need'), 2)), nick: String(g(x, 'nick') ?? '') })));
    conn.on('RackUpd', safe(x => { const r = normRack(x); if (r) ev.rackUpd?.(r); }));
    conn.on('RackGone', safe(x => ev.rackGone?.(num(g(x, 'id'), -1))));
    conn.on('RackStolen', safe(x => ev.rackStolen?.({ rackId: num(g(x, 'rackId'), -1), by: String(g(x, 'by') ?? ''), warn: !!g(x, 'warn') })));
    conn.on('BoatCargo', safe(x => ev.cargo?.({ cargo: num(g(x, 'cargo')), lost: num(g(x, 'lost')) })));
    conn.on('BoatLoad', safe(x => ev.load?.({ boatId: num(g(x, 'boatId'), -1), load: num(g(x, 'load')) })));
    conn.on('FishBig', safe(x => ev.fishBig?.({ connId: String(g(x, 'connId') ?? ''), nick: String(g(x, 'nick') ?? ''), name: String(g(x, 'name') ?? ''), kg: num(g(x, 'kg')) })));
    conn.on('FishPose', safe(x => ev.fishPose?.({ connId: String(g(x, 'connId') ?? ''), dx: num(g(x, 'dx')), dz: num(g(x, 'dz')), yaw: num(g(x, 'yaw')), st: num(g(x, 'st')) })));
    conn.on('BoatRescued', safe(x => ev.rescued({ boatId: num(g(x, 'boatId'), -1), seat: num(g(x, 'seat'), -1), by: String(g(x, 'by') ?? '') })));
  });
  const fetchState = async () => {
    const r = await call('BoatState');
    // 舊伺服器沒有 BoatState（錯誤訊息各版本不同）：只要呼叫丟例外就當不支援，改本機模式
    if (r?.err === 'old_server' || r?.err === 'fail') { supported = false; ev.state(null); return; }
    if (r?.ok) { supported = true; ev.state(normSnap(r.state)); void fetchDrift(); void fetchRacks(); }
  };
  /** 蚵棚：舊伺服器沒有就沒有蚵棚 */
  const fetchRacks = async () => {
    const r = await call('RackState');
    if (r?.ok) { const s = normRackSnap(r.state); if (s) ev.racks?.(s); }
  };
  /** 漂流箱：舊伺服器沒有這個方法就沒有箱子（不影響開船） */
  const fetchDrift = async () => {
    const r = await call('DriftState');
    if (r?.ok) { const d = normDrift(r.state); if (d) ev.drift?.(d); }
  };
  client.afterJoin.push(() => { void fetchState(); });

  let driveBusy = false, swimBusy = false, fishPoseBusy = false, fishPoseOld = false;
  return {
    /** null＝還不知道；false＝舊伺服器 */
    supported: () => supported,
    live,
    fetchState,
    /** 定期對帳（只修別人的座位／泳者；失敗不當成舊伺服器） */
    async resync() {
      if (!supported || !live()) return;
      const r = await call('BoatState');
      if (r?.ok) ev.state(normSnap(r.state), true);
      void fetchDrift();
    },
    board: async (id: number, seat = -1) => res(await call('BoatBoard', id, seat)),
    /** 10Hz：上一筆還沒回來就跳過這筆 */
    drive(id: number, x: number, z: number, h: number, v: number) {
      if (driveBusy || !supported) return;
      driveBusy = true;
      void call('BoatDrive', id, x, z, h, v).finally(() => { driveBusy = false; });
    },
    leave: async (x: number, z: number) => res(await call('BoatLeave', x, z)),
    jump: async () => res(await call('BoatJump')),
    ram: async (from: number, target: number) => res(await call('BoatRam', from, target)),
    swim(x: number, z: number, h: number) {
      if (swimBusy || !supported) return;
      swimBusy = true;
      void call('SwimSync', x, z, h).finally(() => { swimBusy = false; });
    },
    swimOut: async (x: number, z: number) => res(await call('SwimOut', x, z)),
    rescue: async (connId: string) => res(await call('BoatRescue', connId)),
    fetchDrift,
    fetchRacks,
    rackHaul: async (id: number, steal: boolean): Promise<HaulRes> => { const r = await call('RackHaul', id, steal); return { ok: !!r?.ok, err: r?.err, cargo: r?.cargo != null ? num(r.cargo) : undefined, cargoVal: r?.cargoVal != null ? num(r.cargoVal) : undefined, rack: normRack(r?.rack), fine: num(r?.fine) }; },
    rackSell: async (): Promise<SellRes> => { const r = await call('RackSell'); return { ok: !!r?.ok, err: r?.err, pay: num(r?.pay), strings: num(r?.strings), kg: num(r?.kg), cargo: num(r?.cargo), bonus: num(r?.bonus) }; },
    rackPlace: async (): Promise<{ ok: boolean; err?: string; rack?: RackDto | null }> => { const r = await call('RackPlace'); return { ok: !!r?.ok, err: r?.err, rack: normRack(r?.rack) }; },
    rackRemove: async (id: number): Promise<{ ok: boolean; err?: string }> => { const r = await call('RackRemove', id); return { ok: !!r?.ok, err: r?.err }; },
    rackUpgrade: async (id: number, line: number, from: number): Promise<RackUpRes> => { const r = await call('RackUpgrade', id, line, from); return { ok: !!r?.ok, err: r?.err, rack: normRack(r?.rack), line: num(r?.line), lv: num(r?.lv), cost: num(r?.cost) }; },
    driftClaim: async (key: number): Promise<{ ok: boolean; err?: string; pay?: number; bonus?: number; total?: number; n?: number; need?: number; gold?: boolean }> => {
      const r = await call('DriftClaim', key);
      return { ok: !!r?.ok, err: r?.err, pay: r?.pay != null ? num(r.pay) : undefined, bonus: num(r?.bonus), total: r?.total != null ? num(r.total) : undefined, n: Math.max(1, num(r?.n, 1)), need: num(r?.need), gold: !!r?.gold };
    },
    /** 釣魚（PlazaWorld.Fish.cs）：回傳原始物件，plazaFish.ts 自己正規化 */
    fish: (m: 'FishState' | 'FishCast' | 'FishRoll' | 'FishReel' | 'FishLand' | 'FishSell', ...a: unknown[]): Promise<any> => call(m, ...a),
    /** 船上釣魚姿勢（給別人看；舊伺服器沒有就算了） */
    fishPose(dx: number, dz: number, yaw: number, st: number) {
      if (fishPoseBusy || !supported || fishPoseOld) return;
      fishPoseBusy = true;
      void call('FishPose', dx, dz, yaw, st).then(r => { if (r?.err === 'old_server') fishPoseOld = true; }).finally(() => { fishPoseBusy = false; });
    },
    close() { closed = true; },
  };
}
export type BoatNet = ReturnType<typeof makeBoatNet>;
