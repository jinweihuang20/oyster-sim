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
};

export type PlazaSnapshot = {
  players: PlazaPlayer[];
  pileCount: number;
  slotsPerPile: number;
  occupied: number;
  capacity: number;
};

export type PlazaChat = {
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
  x: number;
  z: number;
  yaw: number;
  seated: boolean;
  count: number;
  umb: boolean;
  head: { x: number; y: number; z: number };
  bowl: { x: number; y: number; z: number };
};
