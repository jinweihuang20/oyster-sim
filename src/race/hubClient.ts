import * as signalR from '@microsoft/signalr';
import { normRaceMatched, type RaceMatched } from './types';

const DEFAULT_HUB = 'https://game-status.gwtech.org/hubs/race';

export function raceHubUrl() {
  try {
    const u = new URLSearchParams(location.search).get('raceHub');
    if (u) return u;
  } catch { /* ignore */ }
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787/hubs/race';
  return DEFAULT_HUB;
}

export type RaceQueueHandlers = {
  onMatched?: (m: RaceMatched) => void;
  onClose?: (err?: string) => void;
};

/** 僅負責配對佇列；進場後改由廣場 PlazaClient（raceMode）連同一 hub。 */
export class RaceQueueClient {
  conn: signalR.HubConnection | null = null;
  private handlers: RaceQueueHandlers = {};
  private intentionalStop = false;

  setHandlers(h: RaceQueueHandlers) { this.handlers = h; }

  get connected() {
    return this.conn?.state === signalR.HubConnectionState.Connected;
  }

  async connect(): Promise<{ ok: boolean; err?: string }> {
    this.intentionalStop = false;
    await this.disconnect();
    this.intentionalStop = false;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(raceHubUrl(), { withCredentials: false })
      .withAutomaticReconnect([0, 800, 1600, 3200, 5000])
      .withServerTimeout(90_000)
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    this.conn = conn;
    conn.on('Matched', (e: any) => {
      try { this.handlers.onMatched?.(normRaceMatched(e)); } catch (err) { console.error('Matched', err); }
    });
    conn.onclose((e) => {
      if (this.intentionalStop) return;
      this.handlers.onClose?.(e?.message);
    });
    try {
      await conn.start();
      return { ok: true };
    } catch (e: any) {
      this.conn = null;
      return { ok: false, err: e?.message || 'connect_fail' };
    }
  }

  async queue(pid: string, nick: string, mode: string, param = 0) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; matched?: any; queued?: boolean }>(
        'Queue', pid, nick, mode, param);
      if (!r?.ok) return { ok: false as const, err: r?.err || 'fail' };
      return {
        ok: true as const,
        queued: !!r.queued,
        matched: r.matched ? normRaceMatched(r.matched) : undefined,
      };
    } catch (e: any) {
      return { ok: false as const, err: e?.message || 'queue_fail' };
    }
  }

  async cancelQueue() {
    if (!this.conn) return;
    try { await this.conn.invoke('CancelQueue'); } catch { /* ignore */ }
  }

  async disconnect() {
    this.intentionalStop = true;
    const c = this.conn;
    this.conn = null;
    if (!c) return;
    try { await c.stop(); } catch { /* ignore */ }
  }
}
