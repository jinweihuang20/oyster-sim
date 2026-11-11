export type PlazaPlayer = {
  connId: string;
  pid: string;
  nick: string;
  /** 社群短號碼，顯示用「暱稱 #1234」 */
  tag?: string;
  pileId: number;
  slot: number;
  phase: string;
  count: number;
  joinedAt: number;
  x: number;
  z: number;
  yaw: number;
  seated: boolean;
  moving: boolean;
  umb?: boolean;
  /** 坐下相對座位的左右轉頭 */
  lookYaw?: number;
  /** 視角俯仰 */
  pitch?: number;
  /** 裝備 id（與 EQUIP／equipVisual 對齊） */
  head?: string;
  hand?: string;
  body?: string;
  legs?: string;
  feet?: string;
  /** 廣場外觀旗標，例如 "goldSmoke,cushion,nameFrame"；舊伺服器沒這個欄位 */
  cosmetics?: string;
  /** 伺服器阿婆（每堆 2 人），同步同真人 */
  isNpc?: boolean;
  /** 抱起這位阿婆的玩家 connId；空＝沒被抱 */
  carriedBy?: string;
};

export type PlazaSnapshot = {
  players: PlazaPlayer[];
  pileCount: number;
  slotsPerPile: number;
  occupied: number;
  capacity: number;
  /** index＝pileId：0綜合 1簡單 2一般 3困難，-1＝非剝蚵堆 */
  pileDiffs: number[];
};

export type PlazaChat = {
  connId?: string;
  pid?: string;
  nick: string;
  tag?: string;
  text: string;
  pileId: number | null;
  at: number;
  /** discord／admin：來自伺服器代發，勿再回貼 Discord */
  via?: string;
};

/** 暱稱＋#號碼，避免重名難辨 */
export function plazaDisplayName(nick?: string | null, tag?: string | null) {
  const n = (nick || '剝蚵人').trim() || '剝蚵人';
  const t = (tag || '').trim().replace(/^#/, '');
  return t ? `${n} #${t}` : n;
}

export type PlazaShellEvent = {
  fromConnId: string;
  fromNick: string;
  toConnId: string;
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
};

/** 廣場被殼砸中噴血 */
export type PlazaShellHitEvent = {
  connId: string;
  nick: string;
  x: number; y: number; z: number;
};

export type PlazaStealEvent = {
  fromConnId: string;
  fromNick: string;
  toConnId: string;
  toNick: string;
  fromCount: number;
  toCount: number;
  caught: boolean;
};

/** 共烤蚵：cooking→open→flipped；taken 後從場上移除 */
export type PlazaGrillOyster = {
  id: string;
  pileId: number;
  lx: number;
  lz: number;
  state: 'cooking' | 'open' | 'flipped' | 'taken' | string;
  placedAt: number;
  openAt: number;
  ownerConnId: string;
  ownerNick: string;
  diff: number;
};

export type PlazaGrillTakenEvent = {
  oyster: PlazaGrillOyster;
  byConnId: string;
  byNick: string;
  count: number;
};

/** 給丟殼／偷肉瞄準用 */
export type PlazaAimTarget = {
  connId: string;
  nick: string;
  pileId: number;
  phase: string;
  x: number;
  z: number;
  yaw: number;
  /** 坐下轉頭（同步目標角）；偏開時自己的碗離開視野才可被偷 */
  lookYaw?: number;
  seated: boolean;
  count: number;
  umb: boolean;
  isNpc?: boolean;
  carriedBy?: string;
  head: { x: number; y: number; z: number };
  bowl: { x: number; y: number; z: number };
};

/** 廣場 NPC 送座位任務 */
export type PlazaSeatWish = {
  wishId: string;
  npcConnId: string;
  npcPid: string;
  npcNick: string;
  pileId: number;
  slot: number;
  line: string;
  startedAt: number;
  expiresAt: number;
  carrierConnId?: string;
  carrierNick?: string;
};

export type PlazaSeatWishEnd = {
  wishId: string;
  npcConnId: string;
  reason: string;
  line?: string;
  carrierConnId?: string;
  pay?: number;
  capped?: boolean;
  total?: number;
  fast?: boolean;
};

export function normSeatWish(w: any): PlazaSeatWish | null {
  if (!w) return null;
  const wishId = String(w.wishId ?? w.WishId ?? '');
  const npcConnId = String(w.npcConnId ?? w.NpcConnId ?? '');
  if (!wishId || !npcConnId) return null;
  return {
    wishId, npcConnId,
    npcPid: String(w.npcPid ?? w.NpcPid ?? ''),
    npcNick: String(w.npcNick ?? w.NpcNick ?? ''),
    pileId: Number(w.pileId ?? w.PileId ?? -1),
    slot: Number(w.slot ?? w.Slot ?? -1),
    line: String(w.line ?? w.Line ?? ''),
    startedAt: Number(w.startedAt ?? w.StartedAt ?? 0),
    expiresAt: Number(w.expiresAt ?? w.ExpiresAt ?? 0),
    carrierConnId: String(w.carrierConnId ?? w.CarrierConnId ?? ''),
    carrierNick: String(w.carrierNick ?? w.CarrierNick ?? ''),
  };
}

export function normSeatWishEnd(e: any): PlazaSeatWishEnd | null {
  if (!e) return null;
  const wishId = String(e.wishId ?? e.WishId ?? '');
  const npcConnId = String(e.npcConnId ?? e.NpcConnId ?? '');
  if (!wishId && !npcConnId) return null;
  return {
    wishId, npcConnId,
    reason: String(e.reason ?? e.Reason ?? ''),
    line: String(e.line ?? e.Line ?? ''),
    carrierConnId: String(e.carrierConnId ?? e.CarrierConnId ?? ''),
    pay: Number(e.pay ?? e.Pay ?? 0),
    capped: !!(e.capped ?? e.Capped),
    total: Number(e.total ?? e.Total ?? 0),
    fast: !!(e.fast ?? e.Fast),
  };
}
