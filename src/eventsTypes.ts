export type EvOdd = { i: number; n: number };
export type EvCfg = { id: number; name: string; desc: string; npc: number; dur: number; throwX: number; angerX: number; bonus: number; earlyBonus: number; earlyMeat: number | null; infHp: boolean; steal: 'normal' | 'steal_only' | 'no_steal'; oddDone: EvOdd[]; oddEarly: EvOdd[]; left?: number | null; start: number; end: number };
