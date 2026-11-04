import * as signalR from '@microsoft/signalr';
import type { PlazaPlayer, PlazaSnapshot, PlazaChat, PlazaShellEvent, PlazaStealEvent } from './types';

export type PlazaHubHandlers = {
  onRoster?: (snap: PlazaSnapshot) => void;
  onJoined?: (p: PlazaPlayer) => void;
  onLeft?: (p: PlazaPlayer) => void;
  onSeatChanged?: (p: PlazaPlayer) => void;
  onPose?: (p: PlazaPlayer) => void;
  onPhase?: (p: PlazaPlayer) => void;
  onChat?: (m: PlazaChat) => void;
  onShellThrow?: (e: PlazaShellEvent) => void;
  onShellInbound?: (e: PlazaShellEvent) => void;
  onStealResult?: (e: PlazaStealEvent) => void;
  onClose?: (err?: string) => void;
};

const DEFAULT_HUB = 'https://game-status.gwtech.org/hubs/plaza';

export function plazaHubUrl() {
  try {
    const u = new URLSearchParams(location.search).get('plazaHub');
    if (u) return u;
  } catch { /* ignore */ }
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787/hubs/plaza';
  return DEFAULT_HUB;
}

function normShell(e: any): PlazaShellEvent {
  return {
    fromConnId: e?.fromConnId ?? e?.FromConnId ?? '',
    fromNick: e?.fromNick ?? e?.FromNick ?? '?',
    toConnId: e?.toConnId ?? e?.ToConnId ?? '',
    fromX: Number(e?.fromX ?? e?.FromX ?? 0),
    fromY: Number(e?.fromY ?? e?.FromY ?? 0),
    fromZ: Number(e?.fromZ ?? e?.FromZ ?? 0),
    toX: Number(e?.toX ?? e?.ToX ?? 0),
    toY: Number(e?.toY ?? e?.ToY ?? 0),
    toZ: Number(e?.toZ ?? e?.ToZ ?? 0),
  };
}

function normSteal(e: any): PlazaStealEvent {
  return {
    fromConnId: e?.fromConnId ?? e?.FromConnId ?? '',
    fromNick: e?.fromNick ?? e?.FromNick ?? '?',
    toConnId: e?.toConnId ?? e?.ToConnId ?? '',
    toNick: e?.toNick ?? e?.ToNick ?? '?',
    fromCount: Number(e?.fromCount ?? e?.FromCount ?? 0),
    toCount: Number(e?.toCount ?? e?.ToCount ?? 0),
    caught: !!(e?.caught ?? e?.Caught),
  };
}

export class PlazaClient {
  conn: signalR.HubConnection | null = null;
  token = '';
  pid = '';
  private handlers: PlazaHubHandlers = {};

  setHandlers(h: PlazaHubHandlers) { this.handlers = h; }

  get connectionId() { return this.conn?.connectionId ?? ''; }

  async connect(pid: string, nick: string): Promise<{ ok: boolean; err?: string; snap?: PlazaSnapshot }> {
    this.pid = pid;
    await this.disconnect();
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(plazaHubUrl(), { withCredentials: false })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    this.conn = conn;
    conn.on('Roster', (snap: PlazaSnapshot) => this.handlers.onRoster?.(snap));
    conn.on('PlayerJoined', (p: PlazaPlayer) => this.handlers.onJoined?.(p));
    conn.on('PlayerLeft', (p: PlazaPlayer) => this.handlers.onLeft?.(p));
    conn.on('SeatChanged', (p: PlazaPlayer) => this.handlers.onSeatChanged?.(p));
    conn.on('Pose', (p: PlazaPlayer) => this.handlers.onPose?.(p));
    conn.on('Phase', (p: PlazaPlayer) => this.handlers.onPhase?.(p));
    conn.on('Chat', (m: PlazaChat) => this.handlers.onChat?.(m));
    conn.on('ShellThrow', (e: any) => this.handlers.onShellThrow?.(normShell(e)));
    conn.on('ShellInbound', (e: any) => this.handlers.onShellInbound?.(normShell(e)));
    conn.on('StealResult', (e: any) => this.handlers.onStealResult?.(normSteal(e)));
    conn.onclose((e) => this.handlers.onClose?.(e?.message));
    try {
      await conn.start();
    } catch (e: any) {
      this.conn = null;
      return { ok: false, err: e?.message || 'connect_fail' };
    }
    try {
      const r = await conn.invoke<{ ok: boolean; err?: string; token?: string; snap?: PlazaSnapshot }>('Join', pid, nick);
      if (!r?.ok) { await this.disconnect(); return { ok: false, err: r?.err || 'join_fail' }; }
      this.token = r.token || '';
      return { ok: true, snap: r.snap };
    } catch (e: any) {
      await this.disconnect();
      return { ok: false, err: e?.message || 'join_fail' };
    }
  }

  async claimSeat(pileId: number, slot: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', snap: undefined as PlazaSnapshot | undefined };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string; token?: string; seat?: { pileId: number; slot: number }; snap?: PlazaSnapshot }>('ClaimSeat', pileId, slot);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'claim_fail', snap: undefined as PlazaSnapshot | undefined }; }
  }

  async changeSeat(pileId: number, slot: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', snap: undefined as PlazaSnapshot | undefined };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string; seat?: { pileId: number; slot: number }; snap?: PlazaSnapshot }>('ChangeSeat', pileId, slot);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'change_fail', snap: undefined as PlazaSnapshot | undefined }; }
  }

  async leaveSeat() {
    if (!this.conn) return;
    try { await this.conn.invoke('LeaveSeat'); } catch { /* ignore */ }
  }

  async sync(x: number, z: number, yaw: number, phase: string, count: number, moving: boolean, umb = false) {
    if (!this.conn) return;
    try { await this.conn.invoke('Sync', x, z, yaw, phase, count, moving, umb); } catch { /* ignore */ }
  }

  async setPhase(phase: string, count: number) {
    return this.sync(0, 0, 0, phase, count, false, false);
  }

  async throwAt(targetConnId: string, fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('ThrowAt', targetConnId, fromX, fromY, fromZ, toX, toY, toZ);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'throw_fail' }; }
  }

  async stealFrom(targetConnId: string, caught = false) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', steal: undefined as PlazaStealEvent | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; steal?: any }>('StealFrom', targetConnId, caught);
      return { ok: !!r?.ok, err: r?.err, steal: r?.steal ? normSteal(r.steal) : undefined };
    } catch (e: any) { return { ok: false as const, err: e?.message || 'steal_fail', steal: undefined }; }
  }

  async chat(text: string, pileOnly = false) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('Chat', text, pileOnly);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'chat_fail' }; }
  }

  async reportEarn(earn: number, oysters: number, durationSec: number) {
    if (!this.conn) return { ok: false as const, payout: 0, err: 'no_conn' };
    try {
      const r = await this.conn.invoke<{ ok: boolean; payout?: number; err?: string }>('ReportEarn', this.token, earn, oysters, durationSec);
      return { ok: !!r?.ok, payout: r?.payout ?? 0, err: r?.err };
    } catch (e: any) { return { ok: false as const, payout: 0, err: e?.message || 'pay_fail' }; }
  }

  async disconnect() {
    const c = this.conn; this.conn = null; this.token = '';
    if (!c) return;
    try { await c.stop(); } catch { /* ignore */ }
  }

  get connected() { return !!this.conn && this.conn.state === signalR.HubConnectionState.Connected; }
}
