import * as signalR from '@microsoft/signalr';
import type { PlazaPlayer, PlazaSnapshot, PlazaChat, PlazaShellEvent, PlazaShellHitEvent, PlazaStealEvent, PlazaGrillOyster, PlazaGrillTakenEvent } from './types';
import { normFlagDto, type PlazaFlagState } from './flags';

export type PlazaHubHandlers = {
  onRoster?: (snap: PlazaSnapshot) => void;
  onJoined?: (p: PlazaPlayer) => void;
  onLeft?: (p: PlazaPlayer) => void;
  onSeatChanged?: (p: PlazaPlayer) => void;
  onPose?: (p: PlazaPlayer) => void;
  onPhase?: (p: PlazaPlayer) => void;
  onChat?: (m: PlazaChat) => void;
  /** 阿婆頭上氣泡（不進聊天窗） */
  onNpcSay?: (m: PlazaChat) => void;
  onShellThrow?: (e: PlazaShellEvent) => void;
  onShellInbound?: (e: PlazaShellEvent) => void;
  /** 自己丟的殼被對方完美反彈打回來 */
  onShellReflectHit?: (e: PlazaShellEvent) => void;
  /** 自己丟的殼被對方雨傘擋住（非完美反彈） */
  onShellBlocked?: (e: PlazaShellEvent) => void;
  /** 有人被殼砸中：全場噴血 */
  onShellHit?: (e: PlazaShellHitEvent) => void;
  onNpcMoon?: (e: any) => void;
  onStealResult?: (e: PlazaStealEvent) => void;
  /** 共烤蚵狀態更新（放上／烤開／掀殼） */
  onGrillUpsert?: (o: PlazaGrillOyster) => void;
  onGrillRemove?: (id: string, byConnId: string, byNick: string) => void;
  onGrillTaken?: (e: PlazaGrillTakenEvent) => void;
  /** 吸菸區「抽一口」同步（其他人） */
  onPlazaPuff?: (e: { connId: string; pid: string; start: boolean; holdMs: number }) => void;
  onFlagUpsert?: (f: PlazaFlagState) => void;
  /** 連線中斷，開始自動重連 */
  onReconnecting?: (attempt: number) => void;
  /** 底層 socket 重連成功（尚未重新 Join） */
  onSocketReconnected?: () => void;
  /** 重新 Join 成功（含近期聊天／共烤狀態） */
  onRejoined?: (snap?: PlazaSnapshot, chat?: PlazaChat[], grills?: PlazaGrillOyster[], flags?: PlazaFlagState[]) => void;
  /** 重新 Join 失敗（仍會再試） */
  onRejoinFail?: (err?: string, attempt?: number) => void;
  /** 自動重連耗盡／連線徹底關閉 */
  onClose?: (err?: string) => void;
};

const DEFAULT_HUB = 'https://game-status.gwtech.org/hubs/plaza';

/** 自動重連間隔（毫秒）；最後仍失敗再交由 session 手動輪詢 */
const RECONNECT_DELAYS = [0, 800, 1600, 3200, 5000, 8000, 12000, 20000];

export function plazaHubUrl() {
  try {
    const u = new URLSearchParams(location.search).get('plazaHub');
    if (u) return u;
  } catch { /* ignore */ }
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787/hubs/plaza';
  return DEFAULT_HUB;
}

function fin(n: unknown, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}
function normShell(e: any): PlazaShellEvent {
  return {
    fromConnId: String(e?.fromConnId ?? e?.FromConnId ?? ''),
    fromNick: String(e?.fromNick ?? e?.FromNick ?? '?'),
    toConnId: String(e?.toConnId ?? e?.ToConnId ?? ''),
    fromX: fin(e?.fromX ?? e?.FromX),
    fromY: fin(e?.fromY ?? e?.FromY),
    fromZ: fin(e?.fromZ ?? e?.FromZ),
    toX: fin(e?.toX ?? e?.ToX),
    toY: fin(e?.toY ?? e?.ToY),
    toZ: fin(e?.toZ ?? e?.ToZ),
  };
}

function normShellHit(e: any): PlazaShellHitEvent {
  return {
    connId: String(e?.connId ?? e?.ConnId ?? ''),
    nick: String(e?.nick ?? e?.Nick ?? '?'),
    x: fin(e?.x ?? e?.X),
    y: fin(e?.y ?? e?.Y),
    z: fin(e?.z ?? e?.Z),
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

export function normGrillOyster(e: any): PlazaGrillOyster {
  return {
    id: String(e?.id ?? e?.Id ?? ''),
    pileId: Number(e?.pileId ?? e?.PileId ?? -1),
    lx: fin(e?.lx ?? e?.Lx),
    lz: fin(e?.lz ?? e?.Lz),
    state: String(e?.state ?? e?.State ?? 'cooking').toLowerCase(),
    placedAt: Number(e?.placedAt ?? e?.PlacedAt ?? Date.now()),
    openAt: Number(e?.openAt ?? e?.OpenAt ?? Date.now()),
    ownerConnId: String(e?.ownerConnId ?? e?.OwnerConnId ?? ''),
    ownerNick: String(e?.ownerNick ?? e?.OwnerNick ?? ''),
    diff: Math.max(0, Math.min(3, Number(e?.diff ?? e?.Diff ?? 1) | 0)),
  };
}

function normChatDto(m: any): PlazaChat {
  const pile = m?.pileId ?? m?.PileId;
  return {
    connId: m?.connId ?? m?.ConnId ?? '',
    pid: m?.pid ?? m?.Pid ?? '',
    nick: m?.nick ?? m?.Nick ?? '?',
    text: m?.text ?? m?.Text ?? '',
    pileId: pile == null || pile < 0 ? null : Number(pile),
    at: Number(m?.at ?? m?.At ?? Date.now()),
  };
}

export class PlazaClient {
  conn: signalR.HubConnection | null = null;
  token = '';
  pid = '';
  nick = '';
  private handlers: PlazaHubHandlers = {};
  private intentionalStop = false;
  private reconnectAttempt = 0;
  private rejoining = false;

  setHandlers(h: PlazaHubHandlers) { this.handlers = h; }

  get connectionId() { return this.conn?.connectionId ?? ''; }

  async connect(pid: string, nick: string, opts?: { keepAttempt?: boolean }): Promise<{ ok: boolean; err?: string; snap?: PlazaSnapshot; chat?: PlazaChat[]; grills?: PlazaGrillOyster[]; carryNpc?: boolean }> {
    this.pid = pid;
    this.nick = nick;
    this.intentionalStop = false;
    if (!opts?.keepAttempt) this.reconnectAttempt = 0;
    await this.disconnect();
    this.intentionalStop = false;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(plazaHubUrl(), { withCredentials: false })
      .withAutomaticReconnect(RECONNECT_DELAYS)
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    this.conn = conn;
    this.bindHubEvents(conn);
    conn.onreconnecting(() => {
      if (this.intentionalStop) return;
      this.reconnectAttempt += 1;
      this.handlers.onReconnecting?.(this.reconnectAttempt);
    });
    conn.onreconnected(() => {
      if (this.intentionalStop) return;
      this.handlers.onSocketReconnected?.();
      void this.rejoinAfterReconnect();
    });
    conn.onclose((e) => {
      if (this.intentionalStop) return;
      this.handlers.onClose?.(e?.message);
    });
    try {
      await conn.start();
    } catch (e: any) {
      this.conn = null;
      return { ok: false, err: e?.message || 'connect_fail' };
    }
    return this.joinHub();
  }

  private bindHubEvents(conn: signalR.HubConnection) {
    conn.on('Roster', (snap: PlazaSnapshot) => this.handlers.onRoster?.(snap));
    conn.on('PlayerJoined', (p: PlazaPlayer) => this.handlers.onJoined?.(p));
    conn.on('PlayerLeft', (p: PlazaPlayer) => this.handlers.onLeft?.(p));
    conn.on('SeatChanged', (p: PlazaPlayer) => this.handlers.onSeatChanged?.(p));
    conn.on('Pose', (p: PlazaPlayer) => this.handlers.onPose?.(p));
    conn.on('Phase', (p: PlazaPlayer) => this.handlers.onPhase?.(p));
    conn.on('Chat', (m: PlazaChat) => this.handlers.onChat?.(m));
    conn.on('NpcSay', (m: any) => {
      try { this.handlers.onNpcSay?.(normChatDto(m)); } catch (err) { console.error('NpcSay', err); }
    });
    conn.on('ShellThrow', (e: any) => {
      try { this.handlers.onShellThrow?.(normShell(e)); } catch (err) { console.error('ShellThrow', err); }
    });
    conn.on('ShellInbound', (e: any) => {
      try { this.handlers.onShellInbound?.(normShell(e)); } catch (err) { console.error('ShellInbound', err); }
    });
    conn.on('ShellReflectHit', (e: any) => {
      try { this.handlers.onShellReflectHit?.(normShell(e)); } catch (err) { console.error('ShellReflectHit', err); }
    });
    conn.on('ShellBlocked', (e: any) => {
      try { this.handlers.onShellBlocked?.(normShell(e)); } catch (err) { console.error('ShellBlocked', err); }
    });
    conn.on('NpcMoon', (e: any) => { try { this.handlers.onNpcMoon?.(e); } catch (err) { console.error('NpcMoon', err); } });
    conn.on('ShellHit', (e: any) => {
      try { this.handlers.onShellHit?.(normShellHit(e)); } catch (err) { console.error('ShellHit', err); }
    });
    conn.on('StealResult', (e: any) => {
      try { this.handlers.onStealResult?.(normSteal(e)); } catch (err) { console.error('StealResult', err); }
    });
    conn.on('GrillUpsert', (e: any) => {
      try { this.handlers.onGrillUpsert?.(normGrillOyster(e)); } catch (err) { console.error('GrillUpsert', err); }
    });
    conn.on('GrillRemove', (e: any) => {
      try {
        const id = String(e?.id ?? e?.Id ?? '');
        const byConnId = String(e?.byConnId ?? e?.ByConnId ?? '');
        const byNick = String(e?.byNick ?? e?.ByNick ?? '');
        this.handlers.onGrillRemove?.(id, byConnId, byNick);
      } catch (err) { console.error('GrillRemove', err); }
    });
    conn.on('GrillTaken', (e: any) => {
      try {
        const oyster = normGrillOyster(e?.oyster ?? e?.Oyster ?? e);
        this.handlers.onGrillTaken?.({
          oyster,
          byConnId: String(e?.byConnId ?? e?.ByConnId ?? ''),
          byNick: String(e?.byNick ?? e?.ByNick ?? ''),
          count: Number(e?.count ?? e?.Count ?? 0),
        });
      } catch (err) { console.error('GrillTaken', err); }
    });
    conn.on('PlazaPuff', (e: any) => {
      try {
        this.handlers.onPlazaPuff?.({
          connId: String(e?.connId ?? e?.ConnId ?? ''),
          pid: String(e?.pid ?? e?.Pid ?? ''),
          start: !!(e?.start ?? e?.Start),
          holdMs: Math.max(0, Math.min(5000, Number(e?.holdMs ?? e?.HoldMs ?? 0) | 0)),
        });
      } catch (err) { console.error('PlazaPuff', err); }
    });
    conn.on('FlagUpsert', (e: any) => {
      try { this.handlers.onFlagUpsert?.(normFlagDto(e)); } catch (err) { console.error('FlagUpsert', err); }
    });
  }

  private async joinHub(): Promise<{ ok: boolean; err?: string; snap?: PlazaSnapshot; token?: string; chat?: PlazaChat[]; grills?: PlazaGrillOyster[]; carryNpc?: boolean; flags?: PlazaFlagState[] }> {
    if (!this.conn) return { ok: false, err: 'no_conn' };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; token?: string; snap?: PlazaSnapshot; chat?: any[]; grills?: any[] }>('Join', this.pid, this.nick);
      if (!r?.ok) return { ok: false, err: r?.err || 'join_fail' };
      this.token = r.token || '';
      this.reconnectAttempt = 0;
      const raw = (r as any).chat ?? (r as any).Chat ?? [];
      const chat = Array.isArray(raw) ? raw.map(normChatDto) : [];
      const rawG = (r as any).grills ?? (r as any).Grills ?? [];
      const grills = Array.isArray(rawG) ? rawG.map(normGrillOyster) : [];
      const carryNpc = !!(r as any).carryNpc || !!(r as any).CarryNpc;
      const rawF = (r as any).flags ?? (r as any).Flags;
      const flags = Array.isArray(rawF) ? rawF.map(normFlagDto) : undefined;
      return { ok: true, snap: r.snap, token: this.token, chat, grills, carryNpc, flags };
    } catch (e: any) {
      return { ok: false, err: e?.message || 'join_fail' };
    }
  }

  /** socket 重連後重新進廣場（伺服器斷線會清掉玩家） */
  private async rejoinAfterReconnect() {
    if (this.rejoining || this.intentionalStop) return;
    this.rejoining = true;
    try {
      const r = await this.joinHub();
      if (!r.ok) {
        this.handlers.onRejoinFail?.(r.err, this.reconnectAttempt);
        return;
      }
      this.handlers.onRejoined?.(r.snap, r.chat, r.grills, r.flags);
    } finally {
      this.rejoining = false;
    }
  }

  /**
   * 自動重連耗盡後，手動重建連線並 Join。
   * 回傳是否成功；呼叫端可輪詢重試。
   */
  async tryManualReconnect(): Promise<{ ok: boolean; err?: string; snap?: PlazaSnapshot; chat?: PlazaChat[] }> {
    if (this.intentionalStop) return { ok: false, err: 'stopped' };
    if (this.connected) {
      const r = await this.joinHub();
      if (r.ok) { this.handlers.onRejoined?.(r.snap, r.chat, r.grills, r.flags); return r; }
      return r;
    }
    this.reconnectAttempt += 1;
    this.handlers.onReconnecting?.(this.reconnectAttempt);
    const pid = this.pid, nick = this.nick;
    if (!pid) return { ok: false, err: 'no_pid' };
    const r = await this.connect(pid, nick, { keepAttempt: true });
    if (r.ok) this.handlers.onRejoined?.(r.snap, r.chat, (r as any).grills, (r as any).flags);
    else this.handlers.onRejoinFail?.(r.err, this.reconnectAttempt);
    return r;
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

  async sync(x: number, z: number, yaw: number, phase: string, count: number, moving: boolean, umb = false, lookYaw = 0, pitch = 0) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return;
    try { await this.conn.invoke('Sync', x, z, yaw, phase, count, moving, umb, lookYaw, pitch); } catch { /* ignore */ }
  }

  async setOutfit(head: string, hand: string, body: string, legs: string, feet: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return;
    try { await this.conn.invoke('SetOutfit', head, hand, body, legs, feet); } catch { /* ignore */ }
  }

  async setCosmetics(cosmetics: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return;
    // 伺服器對換裝有 200ms 節流，緊接在 SetOutfit 後會被擋；被擋就等一下再送
    for (let i = 0; i < 3; i++) {
      try {
        const r: any = await this.conn.invoke('SetCosmetics', cosmetics || '');
        if (r?.ok !== false || r?.err !== 'slow') return;
      } catch { return; /* 舊伺服器沒這個方法 */ }
      await new Promise(res => setTimeout(res, 300));
      if (this.conn?.state !== signalR.HubConnectionState.Connected) return;
    }
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

  /** 純視覺飛殼（無受擊目標） */
  async shellFx(fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('ShellFx', fromX, fromY, fromZ, toX, toY, toZ);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'throw_fail' }; }
  }

  /** 完美反彈：殼飛回原丟殼者並讓對方受擊 */
  async shellReflect(originalThrowerConnId: string, fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('ShellReflect', originalThrowerConnId, fromX, fromY, fromZ, toX, toY, toZ);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'throw_fail' }; }
  }

  /** 一般擋下：通知原丟殼者 */
  async shellBlocked(originalThrowerConnId: string) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('ShellBlocked', originalThrowerConnId);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'block_fail' }; }
  }

  /** 被殼砸中：廣播噴血點 */
  async moonNpc(connId: string, x: number, y: number, z: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try { return await this.conn.invoke<{ ok: boolean; err?: string }>('MoonNpc', connId, x, y, z); } catch (e: any) { return { ok: false as const, err: e?.message || 'moon_fail' }; }
  }

  async shellHit(x: number, y: number, z: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('ShellHit', x, y, z);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'hit_fail' }; }
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

  async grillPlace(lx: number, lz: number, diff: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', oyster: undefined as PlazaGrillOyster | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; oyster?: any }>('GrillPlace', lx, lz, diff);
      return { ok: !!r?.ok, err: r?.err, oyster: r?.oyster ? normGrillOyster(r.oyster) : undefined };
    } catch (e: any) { return { ok: false as const, err: e?.message || 'grill_fail', oyster: undefined }; }
  }

  async grillFlip(oysterId: string) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', oyster: undefined as PlazaGrillOyster | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; oyster?: any }>('GrillFlip', oysterId);
      return { ok: !!r?.ok, err: r?.err, oyster: r?.oyster ? normGrillOyster(r.oyster) : undefined };
    } catch (e: any) { return { ok: false as const, err: e?.message || 'flip_fail', oyster: undefined }; }
  }

  async grillTake(oysterId: string) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', oyster: undefined as PlazaGrillOyster | undefined, count: 0 };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; oyster?: any; count?: number }>('GrillTake', oysterId);
      return { ok: !!r?.ok, err: r?.err, oyster: r?.oyster ? normGrillOyster(r.oyster) : undefined, count: r?.count ?? 0 };
    } catch (e: any) { return { ok: false as const, err: e?.message || 'take_fail', oyster: undefined, count: 0 }; }
  }

  /** 抱起阿婆；舊伺服器無此方法時 catch 略過 */
  async carryNpc(npcConnId: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('CarryNpc', npcConnId);
    } catch (e: any) {
      return { ok: false as const, err: e?.message || 'carry_fail' };
    }
  }

  /** 放下阿婆；舊伺服器無此方法時 catch 略過 */
  async placeNpc(npcConnId: string, pileId: number, slot: number) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', snap: undefined as PlazaSnapshot | undefined };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string; snap?: PlazaSnapshot }>('PlaceNpc', npcConnId, pileId, slot);
    } catch (e: any) {
      return { ok: false as const, err: e?.message || 'place_fail', snap: undefined as PlazaSnapshot | undefined };
    }
  }

  /** 吸菸區抽一口同步；舊伺服器無此方法時 catch 略過，不中斷 */
  async plazaPuff(start: boolean, holdMs = 0) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn' };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string }>('PlazaPuff', !!start, Math.max(0, Math.min(5000, holdMs | 0)));
      return { ok: !!r?.ok, err: r?.err };
    } catch (e: any) {
      // 舊 hub 無 PlazaPuff → MethodDoesNotExist；忽略以免 solo／舊服崩潰
      return { ok: false as const, err: e?.message || 'puff_fail' };
    }
  }

  async disconnect() {
    this.intentionalStop = true;
    const c = this.conn; this.conn = null; this.token = '';
    if (!c) return;
    try { await c.stop(); } catch { /* ignore */ }
  }

  get connected() { return !!this.conn && this.conn.state === signalR.HubConnectionState.Connected; }

  /** 在腳邊插旗；舊伺服器無此方法時回 nosup，不丟錯 */
  async plantFlag(x: number, z: number, yaw: number, text: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any }>('PlantFlag', x, z, yaw, text);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async removeFlag() {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any }>('RemoveFlag');
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async setFlagText(text: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any }>('SetFlagText', text);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async upgradeFlag(track: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any }>('UpgradeFlag', track);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async selectFlag(track: string, level: number) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any }>('SelectFlag', track, level);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }
}
