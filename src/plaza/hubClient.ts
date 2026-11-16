import * as signalR from '@microsoft/signalr';
import type { PlazaPlayer, PlazaSnapshot, PlazaChat, PlazaShellEvent, PlazaShellHitEvent, PlazaStealEvent, PlazaGrillOyster, PlazaGrillTakenEvent, PlazaSeatWish, PlazaSeatWishEnd, PlazaFoodQueue, PlazaCookState, PlazaCookSeat } from './types';
import { normSeatWish, normSeatWishEnd, normPoseBatch } from './types';
import type { PlazaMove } from './types';
import { normFlagDto, type PlazaFlagState } from './flags';
import { raceHubUrl } from '../race/hubClient';
import { partyHubUrl } from '../party/hubClient';
import { validCombo } from '../cook/combo';

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
  /** 機關槍開火（其他人） */
  onMgFire?: (e: PlazaMgFireEvent) => void;
  /** 自己被機關槍打中 */
  onMgHit?: (e: PlazaMgHitEvent) => void;
  /** 廣場警示（例如有人上機關槍） */
  onPlazaAlert?: (e: { kind?: string; text: string; nick?: string; connId?: string; expireAt?: number; ammo?: number }) => void;
  onNpcMoon?: (e: any) => void;
  /** 別人請阿婆吃蚵仔煎（只轉動畫和分數） */
  onNpcFeed?: (e: any) => void;
  onStealResult?: (e: PlazaStealEvent) => void;
  /** 共烤蚵狀態更新（放上／烤開／掀殼） */
  onGrillUpsert?: (o: PlazaGrillOyster) => void;
  onGrillRemove?: (id: string, byConnId: string, byNick: string) => void;
  onGrillTaken?: (e: PlazaGrillTakenEvent) => void;
  /** 吸菸區「抽一口」同步（其他人） */
  onPlazaPuff?: (e: { connId: string; pid: string; start: boolean; holdMs: number }) => void;
  onFlagUpsert?: (f: PlazaFlagState) => void;
  onSeatWish?: (w: PlazaSeatWish) => void;
  /** 食材攤排隊狀態變更 */
  /** fresh＝剛加入／重連拿到的完整狀態（伺服器重開後 seq 會變小，要直接採用） */
  onFoodQueue?: (q: PlazaFoodQueue, fresh?: boolean) => void;
  /** 被食材攤踢出（timeout＝180 秒到；away＝輪到時不在） */
  onFoodKick?: (reason: string) => void;
  /** 輪到自己買食材 */
  onFoodTurn?: (q: PlazaFoodQueue) => void;
  /** 烹煮區整體狀態（佔位／展示盤） */
  onCookState?: (s: PlazaCookState, fresh?: boolean) => void;
  /** 某個位子的煎製進度 */
  onCookSeat?: (s: PlazaCookSeat) => void;
  onSeatWishEnd?: (e: PlazaSeatWishEnd) => void;
  /** 新伺服器 10Hz 合併的走動（呼叫過 EnablePoseBatch 才會收到） */
  onPoses?: (moves: PlazaMove[]) => void;
  /** 連線中斷，開始自動重連 */
  onReconnecting?: (attempt: number) => void;
  /** 底層 socket 重連成功（尚未重新 Join） */
  onSocketReconnected?: () => void;
  /** 重新 Join 成功（含近期聊天／共烤狀態） */
  onRejoined?: (snap?: PlazaSnapshot, chat?: PlazaChat[], grills?: PlazaGrillOyster[], flags?: PlazaFlagState[], wishes?: PlazaSeatWish[]) => void;
  /** 重新 Join 失敗（仍會再試） */
  onRejoinFail?: (err?: string, attempt?: number) => void;
  /** 自動重連耗盡／連線徹底關閉 */
  onClose?: (err?: string) => void;
  /** 1v1 競速：State／Results（Race hub） */
  onRaceState?: (snap: any) => void;
  onRaceResults?: (r: any) => void;
  /** 休閒房：State（Party hub；形狀同 roster snap） */
  onPartyState?: (snap: any) => void;
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

export type PlazaMgFireEvent = {
  connId: string; nick: string; slot: number;
  fromX: number; fromY: number; fromZ: number;
  dirX: number; dirY: number; dirZ: number;
  ammo: number; id: number;
};
export type PlazaMgHitEvent = {
  fromConnId: string; fromNick: string;
  toConnId: string; toNick: string;
  x: number; y: number; z: number;
};

function normMgFire(e: any): PlazaMgFireEvent {
  return {
    connId: String(e?.connId ?? e?.ConnId ?? ''),
    nick: String(e?.nick ?? e?.Nick ?? '?'),
    slot: Math.floor(fin(e?.slot ?? e?.Slot)),
    fromX: fin(e?.fromX ?? e?.FromX),
    fromY: fin(e?.fromY ?? e?.FromY),
    fromZ: fin(e?.fromZ ?? e?.FromZ),
    dirX: fin(e?.dirX ?? e?.DirX),
    dirY: fin(e?.dirY ?? e?.DirY),
    dirZ: fin(e?.dirZ ?? e?.DirZ, -1),
    ammo: Math.floor(fin(e?.ammo ?? e?.Ammo)),
    id: Math.floor(fin(e?.id ?? e?.Id)),
  };
}
function normMgHit(e: any): PlazaMgHitEvent {
  return {
    fromConnId: String(e?.fromConnId ?? e?.FromConnId ?? ''),
    fromNick: String(e?.fromNick ?? e?.FromNick ?? '?'),
    toConnId: String(e?.toConnId ?? e?.ToConnId ?? ''),
    toNick: String(e?.toNick ?? e?.ToNick ?? '?'),
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

function finWait(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

export class PlazaClient {
  conn: signalR.HubConnection | null = null;
  token = '';
  pid = '';
  nick = '';
  /** 非空＝連 Race hub，Join(code,pid,nick) */
  raceCode = '';
  /** 非空＝連 Party hub；partyCreate＝開房 */
  partyCode = '';
  partyCreate = false;
  private handlers: PlazaHubHandlers = {};
  private intentionalStop = false;
  private reconnectAttempt = 0;
  private rejoining = false;

  setHandlers(h: PlazaHubHandlers) { this.handlers = h; }

  get connectionId() { return this.conn?.connectionId ?? ''; }
  get isRace() { return !!this.raceCode; }
  get isParty() { return !!this.partyCode || this.partyCreate; }

  async connect(pid: string, nick: string, opts?: {
    keepAttempt?: boolean;
    raceCode?: string;
    partyCode?: string;
    partyCreate?: boolean;
  }): Promise<{ ok: boolean; err?: string; snap?: PlazaSnapshot; chat?: PlazaChat[]; grills?: PlazaGrillOyster[]; carryNpc?: boolean }> {
    this.pid = pid;
    this.nick = nick;
    if (opts?.raceCode !== undefined) this.raceCode = opts.raceCode || '';
    if (opts?.partyCode !== undefined) this.partyCode = opts.partyCode || '';
    if (opts?.partyCreate !== undefined) this.partyCreate = !!opts.partyCreate;
    // race／party 互斥
    if (this.raceCode) { this.partyCode = ''; this.partyCreate = false; }
    if (this.partyCode || this.partyCreate) this.raceCode = '';
    this.intentionalStop = false;
    if (!opts?.keepAttempt) this.reconnectAttempt = 0;
    // 進場／重連清線：不要 Depart（舊服無此方法；且 await 失敗會卡住「正在入場」）
    await this.disconnect({ depart: false });
    this.intentionalStop = false;
    const url = this.raceCode ? raceHubUrl() : (this.isParty ? partyHubUrl() : plazaHubUrl());
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(url, { withCredentials: false })
      .withAutomaticReconnect(RECONNECT_DELAYS)
      .withServerTimeout(90_000)
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
    conn.on('Poses', (b: any) => {
      try { const m = normPoseBatch(b); if (m.length) this.handlers.onPoses?.(m); } catch (err) { console.error('Poses', err); }
    });
    conn.on('Phase', (p: PlazaPlayer) => this.handlers.onPhase?.(p));
    conn.on('Chat', (m: PlazaChat) => this.handlers.onChat?.(m));
    conn.on('NpcSay', (m: any) => {
      try { this.handlers.onNpcSay?.(normChatDto(m)); } catch (err) { console.error('NpcSay', err); }
    });
    conn.on('CookState', (x: any) => { const n = normCookState(x); if (n) this.handlers.onCookState?.(n); });
    conn.on('CookSeat', (x: any) => { const n = normCookSeat(x); if (n) this.handlers.onCookSeat?.(n); });
    conn.on('FoodQueue', (q: any) => { const n = normFoodQueue(q); if (n) this.handlers.onFoodQueue?.(n); });
    conn.on('FoodTurn', (q: any) => { const n = normFoodQueue(q); if (n) this.handlers.onFoodTurn?.(n); });
    conn.on('FoodKick', (e: any) => this.handlers.onFoodKick?.(String(e?.reason ?? e?.Reason ?? '')));
    conn.on('SeatWish', (w: any) => {
      try { const n = normSeatWish(w); if (n) this.handlers.onSeatWish?.(n); } catch (err) { console.error('SeatWish', err); }
    });
    conn.on('SeatWishEnd', (e: any) => {
      try { const n = normSeatWishEnd(e); if (n) this.handlers.onSeatWishEnd?.(n); } catch (err) { console.error('SeatWishEnd', err); }
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
    conn.on('NpcFeed', (e: any) => { try { this.handlers.onNpcFeed?.(e); } catch (err) { console.error('NpcFeed', err); } });
    conn.on('MgFire', (e: any) => {
      try { this.handlers.onMgFire?.(normMgFire(e)); } catch (err) { console.error('MgFire', err); }
    });
    conn.on('MgHit', (e: any) => {
      try { this.handlers.onMgHit?.(normMgHit(e)); } catch (err) { console.error('MgHit', err); }
    });
    conn.on('PlazaAlert', (e: any) => {
      try {
        this.handlers.onPlazaAlert?.({
          kind: String(e?.kind ?? e?.Kind ?? ''),
          text: String(e?.text ?? e?.Text ?? ''),
          nick: String(e?.nick ?? e?.Nick ?? ''),
          connId: String(e?.connId ?? e?.ConnId ?? ''),
          expireAt: Number(e?.expireAt ?? e?.ExpireAt ?? 0) || undefined,
          ammo: Number(e?.ammo ?? e?.Ammo ?? 0) || undefined,
        });
      } catch (err) { console.error('PlazaAlert', err); }
    });
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
    conn.on('State', (e: any) => {
      try {
        if (this.isParty) this.handlers.onPartyState?.(e);
        else this.handlers.onRaceState?.(e);
      } catch (err) { console.error('State', err); }
    });
    conn.on('Results', (e: any) => {
      try { this.handlers.onRaceResults?.(e); } catch (err) { console.error('RaceResults', err); }
    });
  }

  private async joinHub(): Promise<{ ok: boolean; err?: string; snap?: PlazaSnapshot; token?: string; chat?: PlazaChat[]; grills?: PlazaGrillOyster[]; carryNpc?: boolean; flags?: PlazaFlagState[]; wishes?: PlazaSeatWish[] }> {
    if (!this.conn) return { ok: false, err: 'no_conn' };
    try {
      let r: any;
      if (this.partyCreate && !this.partyCode) {
        r = await this.conn.invoke('Create', this.pid, this.nick);
        if (r?.ok && (r.code || r.Code)) {
          this.partyCode = String(r.code ?? r.Code);
          this.partyCreate = false;
        }
      } else if (this.partyCode) {
        r = await this.conn.invoke('Join', this.partyCode, this.pid, this.nick);
      } else if (this.raceCode) {
        r = await this.conn.invoke('Join', this.raceCode, this.pid, this.nick);
      } else {
        r = await this.conn.invoke('Join', this.pid, this.nick);
      }
      if (!r?.ok) return { ok: false, err: r?.err || 'join_fail' };
      this.token = r.token || '';
      this.reconnectAttempt = 0;
      if (this.raceCode || this.partyCode) {
        const raw = (r as any).chat ?? (r as any).Chat ?? [];
        const chat = Array.isArray(raw) ? raw.map(normChatDto) : [];
        return { ok: true, snap: r.snap as any, token: this.token, chat, grills: [], carryNpc: false, flags: [], wishes: [] };
      }
      const raw = (r as any).chat ?? (r as any).Chat ?? [];
      const chat = Array.isArray(raw) ? raw.map(normChatDto) : [];
      const rawG = (r as any).grills ?? (r as any).Grills ?? [];
      const grills = Array.isArray(rawG) ? rawG.map(normGrillOyster) : [];
      const carryNpc = !!(r as any).carryNpc || !!(r as any).CarryNpc;
      const rawF = (r as any).flags ?? (r as any).Flags;
      const flags = Array.isArray(rawF) ? rawF.map(normFlagDto) : undefined;
      const rawW = (r as any).wishes ?? (r as any).Wishes ?? [];
      const wishes = Array.isArray(rawW) ? rawW.map(normSeatWish).filter((x: PlazaSeatWish | null): x is PlazaSeatWish => !!x) : [];
      const fq = normFoodQueue((r as any).foodQueue ?? (r as any).FoodQueue);
      if (fq) queueMicrotask(() => this.handlers.onFoodQueue?.(fq, true));
      const ck = normCookState((r as any).cook ?? (r as any).Cook);
      if (ck) queueMicrotask(() => this.handlers.onCookState?.(ck, true));
      // 新伺服器：改收 10Hz 合併走動；舊伺服器沒這個方法就維持單筆 Pose（每次 Join 後都要再宣告）
      void this.enablePoseBatch();
      return { ok: true, snap: r.snap, token: this.token, chat, grills, carryNpc, flags, wishes };
    } catch (e: any) {
      return { ok: false, err: e?.message || 'join_fail' };
    }
  }

  /** 伺服器是否已改送批次走動 */
  poseBatch = false;
  private async enablePoseBatch() {
    this.poseBatch = false;
    if (!this.conn) return;
    try {
      const r: any = await this.conn.invoke('EnablePoseBatch');
      this.poseBatch = !!r?.ok;
    } catch { /* 舊伺服器：沒有這個方法 */ }
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
      this.handlers.onRejoined?.(r.snap, r.chat, r.grills, r.flags, r.wishes);
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
      if (r.ok) { this.handlers.onRejoined?.(r.snap, r.chat, r.grills, r.flags, r.wishes); return r; }
      return r;
    }
    this.reconnectAttempt += 1;
    this.handlers.onReconnecting?.(this.reconnectAttempt);
    const pid = this.pid, nick = this.nick;
    if (!pid) return { ok: false, err: 'no_pid' };
    const r = await this.connect(pid, nick, {
      keepAttempt: true,
      raceCode: this.raceCode || undefined,
      partyCode: this.partyCode || undefined,
      partyCreate: false,
    });
    if (r.ok) this.handlers.onRejoined?.(r.snap, r.chat, (r as any).grills, (r as any).flags, (r as any).wishes);
    else this.handlers.onRejoinFail?.(r.err, this.reconnectAttempt);
    return r;
  }

  /** mgAmmo：機關槍；省略／0＝付錢滿彈；&gt;0＝碗內蚵肉當子彈顆數 */
  async claimSeat(pileId: number, slot: number, mgAmmo = 0) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', snap: undefined as PlazaSnapshot | undefined, mg: undefined as { expireAt: number; ammo: number } | undefined };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string; token?: string; seat?: { pileId: number; slot: number }; snap?: PlazaSnapshot; mg?: { expireAt: number; ammo: number } }>('ClaimSeat', pileId, slot, mgAmmo);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'claim_fail', snap: undefined as PlazaSnapshot | undefined, mg: undefined as { expireAt: number; ammo: number } | undefined }; }
  }

  async changeSeat(pileId: number, slot: number, mgAmmo = 0) {
    if (!this.conn) return { ok: false as const, err: 'no_conn', snap: undefined as PlazaSnapshot | undefined, mg: undefined as { expireAt: number; ammo: number } | undefined };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string; seat?: { pileId: number; slot: number }; snap?: PlazaSnapshot; mg?: { expireAt: number; ammo: number } }>('ChangeSeat', pileId, slot, mgAmmo);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'change_fail', snap: undefined as PlazaSnapshot | undefined, mg: undefined as { expireAt: number; ammo: number } | undefined }; }
  }

  /** 食材攤：排隊（沒人時直接輪到，mode=use） */
  async foodQueueJoin(): Promise<{ ok: boolean; err?: string; mode?: string; state?: PlazaFoodQueue | null }> {
    if (!this.conn) return { ok: false, err: 'no_conn' };
    try {
      const r: any = await this.conn.invoke('FoodQueueJoin');
      return { ok: !!r?.ok, err: r?.err, mode: r?.mode, state: normFoodQueue(r?.state) };
    } catch (e: any) { return { ok: false, err: e?.message || 'food_fail' }; }
  }
  /** 烹煮區：佔位／離開／進度／展示 */
  async cookClaim(seat: number): Promise<{ ok: boolean; err?: string; state?: PlazaCookState | null }> {
    if (!this.conn) return { ok: false, err: 'no_conn' };
    try { const r: any = await this.conn.invoke('CookClaim', seat); return { ok: !!r?.ok, err: r?.err, state: normCookState(r?.state) }; }
    catch (e: any) { return { ok: false, err: e?.message || 'cook_fail' }; }
  }
  async cookLeave() { if (!this.conn) return; try { await this.conn.invoke('CookLeave'); } catch { /* */ } }
  async cookProgress(stage: number, combo: number) { if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return; try { await this.conn.invoke('CookProgress', stage, combo); } catch { /* */ } }
  async cookDisplay(combo: number): Promise<{ ok: boolean; err?: string; state?: PlazaCookState | null }> {
    if (!this.conn) return { ok: false, err: 'no_conn' };
    try { const r: any = await this.conn.invoke('CookDisplay', combo); return { ok: !!r?.ok, err: r?.err, state: normCookState(r?.state) }; }
    catch (e: any) { return { ok: false, err: e?.message || 'cook_fail' }; }
  }
  async cookDisplayClear() { if (!this.conn) return; try { await this.conn.invoke('CookDisplayClear'); } catch { /* */ } }

  /** 食材攤：離開隊伍／離開攤子 */
  /** 重新拿一次排隊狀態（舊伺服器沒有這個方法就回 null） */
  async foodQueueGet() {
    if (!this.conn || !this.connected) return null;
    try { const r: any = await this.conn.invoke('FoodQueueGet'); return normFoodQueue(r?.state); } catch { return null; }
  }

  async foodQueueLeave() {
    if (!this.conn) return null;
    try { const r: any = await this.conn.invoke('FoodQueueLeave'); return normFoodQueue(r?.state); } catch { return null; }
  }

    async leaveSeat() {
    if (!this.conn) return;
    try { await this.conn.invoke('LeaveSeat'); } catch { /* ignore */ }
  }

  /** 主動離開：立刻清伺服器身影（不走切 App 休眠寬限） */
  async depart() {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return;
    try { await this.conn.invoke('Depart'); } catch { /* 舊服無此方法則靠 disconnect */ }
  }

  /** 環視時 ~10Hz Sync；勿堆疊 await，否則回包擠在主執行緒會頓一下 */
  private _syncBusy = false;
  private _syncPend: [number, number, number, string, number, boolean, boolean, number, number] | null = null;
  async sync(x: number, z: number, yaw: number, phase: string, count: number, moving: boolean, umb = false, lookYaw = 0, pitch = 0) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return;
    this._syncPend = [x, z, yaw, phase, count, moving, umb, lookYaw, pitch];
    if (this._syncBusy) return;
    this._syncBusy = true;
    try {
      while (this._syncPend) {
        const args = this._syncPend;
        this._syncPend = null;
        if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) break;
        try { await this.conn.invoke('Sync', ...args); } catch { /* ignore */ }
      }
    } finally {
      this._syncBusy = false;
    }
  }

  async setOutfit(head: string, hand: string, body: string, legs: string, feet: string, hair = 'hr_basic') {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return;
    try { await this.conn.invoke('SetOutfit', head, hand, body, legs, feet, hair); } catch { /* ignore */ }
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

  async mgFire(fromX: number, fromY: number, fromZ: number, dirX: number, dirY: number, dirZ: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string; ammo?: number; id?: number }>(
        'MgFire', fromX, fromY, fromZ, dirX, dirY, dirZ,
      );
    } catch (e: any) { return { ok: false as const, err: e?.message || 'mg_fail' }; }
  }

  async mgHit(targetConnId: string, x: number, y: number, z: number) {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string }>('MgHit', targetConnId, x, y, z);
    } catch (e: any) { return { ok: false as const, err: e?.message || 'mg_fail' }; }
  }

  async mgReload() {
    if (!this.conn) return { ok: false as const, err: 'no_conn' };
    try {
      return await this.conn.invoke<{ ok: boolean; err?: string; ammo?: number }>('MgReload');
    } catch (e: any) { return { ok: false as const, err: e?.message || 'mg_fail' }; }
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
  /** 請阿婆吃：轉給同廣場其他人（舊伺服器沒有這個方法：回 false，不影響本機） */
  async npcFeed(npcConnId: string, combo: number, score: number, rep: boolean, li: number) {
    if (!this.conn || !this.connected) return false;
    try { const r: any = await this.conn.invoke('NpcFeed', npcConnId, combo, score, rep, li); return !!r?.ok; } catch { return false; }
  }

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
      return await this.conn.invoke<{ ok: boolean; err?: string; snap?: PlazaSnapshot; deliver?: PlazaSeatWishEnd }>('PlaceNpc', npcConnId, pileId, slot);
    } catch (e: any) {
      return { ok: false as const, err: e?.message || 'place_fail', snap: undefined as PlazaSnapshot | undefined, deliver: undefined as PlazaSeatWishEnd | undefined };
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

  /**
   * @param depart 主動離開廣場才通知伺服器立刻清人；進場前清線／重連不要 Depart。
   */
  async disconnect(opts?: { depart?: boolean }) {
    this.intentionalStop = true;
    const c = this.conn; this.conn = null; this.token = '';
    if (!c) return;
    if (opts?.depart && c.state === signalR.HubConnectionState.Connected) {
      // 舊服無 Depart；加短逾時避免卡在離開／取消入場
      try {
        await Promise.race([
          c.invoke('Depart'),
          new Promise<void>((_, rej) => setTimeout(() => rej(new Error('depart_timeout')), 800)),
        ]);
      } catch { /* 舊服／逾時略過 */ }
    }
    try { await c.stop(); } catch { /* ignore */ }
  }

  get connected() { return !!this.conn && this.conn.state === signalR.HubConnectionState.Connected; }

  /** 在面前約半步處插旗；舊伺服器無此方法時回 nosup，不丟錯 */
  async plantFlag(x: number, z: number, yaw: number, text: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any; waitMs?: number }>('PlantFlag', x, z, yaw, text);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined, waitMs: finWait(r?.waitMs) };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async showFlag() {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any; waitMs?: number }>('ShowFlag');
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined, waitMs: finWait(r?.waitMs) };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async removeFlag() {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any; waitMs?: number }>('RemoveFlag');
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined, waitMs: finWait(r?.waitMs) };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async setFlagText(text: string) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any; waitMs?: number }>('SetFlagText', text);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined, waitMs: finWait(r?.waitMs) };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async upgradeFlag(track: string, from?: number) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    let r: { ok: boolean; err?: string; flag?: any; waitMs?: number } | undefined;
    try {
      if (from != null) {
        try { r = await this.conn.invoke('UpgradeFlagFrom', track, from); }
        catch { r = undefined; } // 舊伺服器沒有這個方法：改用舊的
      }
      if (!r) r = await this.conn.invoke('UpgradeFlag', track);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined, waitMs: finWait(r?.waitMs) };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }

  async selectFlag(track: string, level: number) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) return { ok: false as const, err: 'no_conn', flag: undefined as PlazaFlagState | undefined };
    try {
      const r = await this.conn.invoke<{ ok: boolean; err?: string; flag?: any; waitMs?: number }>('SelectFlag', track, level);
      return { ok: !!r?.ok, err: r?.err, flag: r?.flag ? normFlagDto(r.flag) : undefined, waitMs: finWait(r?.waitMs) };
    } catch {
      return { ok: false as const, err: 'nosup', flag: undefined as PlazaFlagState | undefined };
    }
  }
}

/** 煎台位子上限（伺服器目前 12 位；留點餘裕給之後加位子） */
const COOK_SEAT_MAX = 32;

export function normFoodQueue(q: any): PlazaFoodQueue | null {
  if (!q || typeof q !== 'object') return null;
  const g = (k: string) => q[k] ?? q[k[0].toUpperCase() + k.slice(1)];
  const raw = g('queue');
  return {
    userConn: String(g('userConn') ?? ''), userPid: String(g('userPid') ?? ''), userNick: String(g('userNick') ?? ''),
    endsAt: fin(g('endsAt')), now: fin(g('now')), useMs: fin(g('useMs'), 90_000), max: fin(g('max'), 10),
    queue: Array.isArray(raw) ? raw.map((e: any) => ({
      connId: String(e?.connId ?? e?.ConnId ?? ''), pid: String(e?.pid ?? e?.Pid ?? ''),
      nick: String(e?.nick ?? e?.Nick ?? ''), index: fin(e?.index ?? e?.Index),
    })) : [],
    seq: fin(g('seq')),
  };
}

const pick = (o: any, k: string) => o?.[k] ?? o?.[k[0].toUpperCase() + k.slice(1)];
export function normCookSeat(x: any): PlazaCookSeat | null {
  if (!x || typeof x !== 'object') return null;
  const seat = fin(pick(x, 'seat'), -1); if (seat < 0 || seat >= COOK_SEAT_MAX) return null;
  return { seat, connId: String(pick(x, 'connId') ?? ''), pid: String(pick(x, 'pid') ?? ''), nick: String(pick(x, 'nick') ?? ''), stage: fin(pick(x, 'stage')), combo: fin(pick(x, 'combo'), -1) };
}
export function normCookState(x: any): PlazaCookState | null {
  if (!x || typeof x !== 'object') return null;
  const seats = (pick(x, 'seats') ?? []) as any[], ds = (pick(x, 'displays') ?? []) as any[];
  return {
    seats: Array.isArray(seats) ? seats.map(normCookSeat).filter((v): v is PlazaCookSeat => !!v) : [],
    displays: Array.isArray(ds) ? ds.map(d => ({ connId: String(pick(d, 'connId') ?? ''), pid: String(pick(d, 'pid') ?? ''), nick: String(pick(d, 'nick') ?? ''), seat: fin(pick(d, 'seat')), slot: fin(pick(d, 'slot')), combo: fin(pick(d, 'combo')), at: fin(pick(d, 'at')) })).filter(d => d.seat >= 0 && d.seat < COOK_SEAT_MAX && validCombo(d.combo)) : [],
    seq: fin(pick(x, 'seq')),
  };
}
