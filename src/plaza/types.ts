export type PlazaPlayer = {
  connId: string;
  pid: string;
  nick: string;
  pileId: number;
  slot: number;
  phase: string;
  count: number;
  joinedAt: number;
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
