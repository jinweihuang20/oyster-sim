import * as signalR from '@microsoft/signalr';
import { normBody, normSnap, type RoomBody, type RoomSnap } from './types';

const DEFAULT_HUB = 'https://game-status.gwtech.org/hubs/room';

export function roomHubUrl() {
  try {
    const u = new URLSearchParams(location.search).get('roomHub');
    if (u) return u;
  } catch { /* ignore */ }
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787/hubs/room';
  return DEFAULT_HUB;
}

export type RoomHubHandlers = {
  onState?: (snap: RoomSnap) => void;
  onPose?: (body: RoomBody) => void;
  onPoses?: (bodies: RoomBody[]) => void;
  onKicked?: () => void;
  onClose?: (err?: string) => void;
};

type InvokeResult = { ok: boolean; err?: string; token?: string; snap?: RoomSnap; payout?: number; closed?: boolean };

export class RoomClient {
  private conn: signalR.HubConnection | null = null;
  private handlers: RoomHubHandlers = {};
  token = '';

  async connect(handlers: RoomHubHandlers) {
    this.handlers = handlers;
    if (this.conn) await this.stop();
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(roomHubUrl())
      .withAutomaticReconnect([0, 800, 1600, 3200, 5000])
      .build();
    conn.on('State', (s) => {
      const snap = normSnap(s);
      if (snap) this.handlers.onState?.(snap);
    });
    conn.on('Pose', (p) => {
      const b = normBody(p);
      if (b.pid || b.connId) this.handlers.onPose?.(b);
    });
    conn.on('Poses', (list) => {
      const bodies = Array.isArray(list) ? list.map(normBody) : [];
      this.handlers.onPoses?.(bodies);
    });
    conn.on('Kicked', () => this.handlers.onKicked?.());
    conn.onclose(err => this.handlers.onClose?.(err?.message));
    this.conn = conn;
    await conn.start();
  }

  private async inv(method: string, ...args: unknown[]): Promise<InvokeResult> {
    if (!this.conn) return { ok: false, err: 'no_conn' };
    try {
      const r = await this.conn.invoke<any>(method, ...args);
      const snap = normSnap(r?.snap);
      return { ok: !!r?.ok, err: r?.err, token: r?.token, snap: snap ?? undefined, payout: r?.payout, closed: r?.closed };
    } catch (e: any) {
      return { ok: false, err: e?.message || 'fail' };
    }
  }

  create(pid: string, nick: string, scene: string, seats: number, endMode: string, durationSec: number, goalMeat: number, npcCount: number) {
    return this.inv('Create', pid, nick, scene, seats, endMode, durationSec, goalMeat, npcCount);
  }
  join(pid: string, nick: string, code: string) { return this.inv('Join', pid, nick, code); }
  leave() { return this.inv('Leave'); }
  ready(v: boolean) { return this.inv('Ready', v); }
  start() { return this.inv('Start'); }
  endMatch() { return this.inv('EndMatch'); }
  kick(pid: string) { return this.inv('Kick', pid); }
  transfer(pid: string) { return this.inv('Transfer', pid); }
  edit(scene: string, seats: number, endMode: string, durationSec: number, goalMeat: number, npcCount: number) {
    return this.inv('Edit', scene, seats, endMode, durationSec, goalMeat, npcCount);
  }
  sync(x: number, z: number, yaw: number, phase: string, count: number, moving: boolean, umb: boolean, lookYaw: number, pitch: number) {
    return this.inv('Sync', x, z, yaw, phase, count, moving, umb, lookYaw, pitch);
  }
  claimSeat(slot: number) { return this.inv('ClaimSeat', slot); }
  leaveSeat() { return this.inv('LeaveSeat'); }
  setOutfit(head: string, hand: string, body: string, legs: string, feet: string) {
    return this.inv('SetOutfit', head, hand, body, legs, feet);
  }
  setCosmetics(cosmetics: string) { return this.inv('SetCosmetics', cosmetics); }
  carryNpc(npcConnId: string) { return this.inv('CarryNpc', npcConnId); }
  placeNpc(npcConnId: string, slot: number) { return this.inv('PlaceNpc', npcConnId, slot); }
  syncScore(meat: number, rawEarn: number) { return this.inv('SyncScore', meat, rawEarn); }
  rematch() { return this.inv('Rematch'); }
  reportEarn(rawEarn: number, oysters: number, durationSec: number) {
    return this.inv('ReportEarn', this.token, rawEarn, oysters, durationSec);
  }

  async stop() {
    const c = this.conn;
    this.conn = null;
    this.token = '';
    if (!c) return;
    try { await c.stop(); } catch { /* ignore */ }
  }
}
