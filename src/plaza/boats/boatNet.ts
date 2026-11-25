/** 廣場海面的連線：叫伺服器的 Boat* 方法、收事件。舊伺服器沒有這些方法時改成「只有自己看得到」。 */
import type * as signalR from '@microsoft/signalr';
import { HubConnectionState } from '@microsoft/signalr';
import type { PlazaClient } from '../hubClient';

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

export type BoatNetEvents = {
  seats: (b: BoatDto) => void;
  poses: (p: BoatPosesDto) => void;
  ram: (r: RamDto) => void;
  swimStart: (s: SwimDto) => void;
  swimEnd: (connId: string) => void;
  rescued: (e: { boatId: number; seat: number; by: string }) => void;
  /** Join／重連後：伺服器的完整狀態（null＝舊伺服器，不支援） */
  state: (s: BoatsSnap | null) => void;
};

export type BoatRes = { ok: boolean; err?: string; boat?: BoatDto | null; seat?: number; swim?: SwimDto | null };

export function makeBoatNet(client: PlazaClient, ev: BoatNetEvents) {
  let supported: boolean | null = null;
  let closed = false;
  const live = () => !closed && !!client.conn && client.conn.state === HubConnectionState.Connected;
  const call = async (m: string, ...a: unknown[]): Promise<any> => {
    if (!live() || supported === false) return { ok: false, err: supported === false ? 'old_server' : 'offline' };
    try { return await client.conn!.invoke(m, ...a); } catch (e: any) { return { ok: false, err: String(e?.message ?? 'fail').includes('does not exist') ? 'old_server' : 'fail' }; }
  };
  const res = (r: any): BoatRes => ({ ok: !!r?.ok, err: r?.err, boat: normBoat(r?.boat), seat: r?.seat != null ? num(r.seat, -1) : undefined, swim: normSwim(r?.swim) });

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
    conn.on('BoatRescued', safe(x => ev.rescued({ boatId: num(g(x, 'boatId'), -1), seat: num(g(x, 'seat'), -1), by: String(g(x, 'by') ?? '') })));
  });
  const fetchState = async () => {
    const r = await call('BoatState');
    if (r?.err === 'old_server') { supported = false; ev.state(null); return; }
    if (r?.ok) { supported = true; ev.state(normSnap(r.state)); }
  };
  client.afterJoin.push(() => { void fetchState(); });

  let driveBusy = false, swimBusy = false;
  return {
    /** null＝還不知道；false＝舊伺服器 */
    supported: () => supported,
    live,
    fetchState,
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
    close() { closed = true; },
  };
}
export type BoatNet = ReturnType<typeof makeBoatNet>;
