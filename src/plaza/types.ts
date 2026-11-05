export type PlazaPlayer = {
  connId: string;
  pid: string;
  nick: string;
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
};

export type PlazaSnapshot = {
  players: PlazaPlayer[];
  pileCount: number;
  slotsPerPile: number;
  occupied: number;
  capacity: number;
};

export type PlazaChat = {
  connId?: string;
  pid?: string;
  nick: string;
  text: string;
  pileId: number | null;
  at: number;
};

export type PlazaShellEvent = {
  fromConnId: string;
  fromNick: string;
  toConnId: string;
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
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

/** 給丟殼／偷肉瞄準用 */
export type PlazaAimTarget = {
  connId: string;
  nick: string;
  pileId: number;
  phase: string;
  x: number;
  z: number;
  yaw: number;
  seated: boolean;
  count: number;
  umb: boolean;
  head: { x: number; y: number; z: number };
  bowl: { x: number; y: number; z: number };
};
