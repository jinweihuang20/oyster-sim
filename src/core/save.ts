import { ODD } from '../shop/oddities';
import type { AchSave } from '../meta/achievements';

export const SAVE_V = 3;
export const LIFE_KEYS = ['opened', 'inBowl', 'missed', 'wasteShells', 'cracked', 'perfects', 'abandoned', 'stabs', 'steals', 'caught', 'meatHits', 'shellHits', 'hitsTaken', 'blocks', 'reflects', 'lost', 'bestCombo'] as const;
export type Life = Record<typeof LIFE_KEYS[number], number>;
export type Save = {
  v: number; dex: number[]; odd: number[]; best: number; money: number; days: number; queen: number; life: Life;
  titles: Record<string, number>; shop: { owned: string[]; equipped: Record<string, string> };
  evClaim?: string[]; svClaim?: number[]; seat?: string; bonusDay?: string; bonusN?: number; streakDay?: number;
  lastBonusDay?: string; lastSeen?: string; retDay?: string; tutDone?: number; locs?: string[]; loc?: string;
  name?: string; locSeen?: string[]; gear?: Record<string, boolean>; radioSt?: number; ach?: AchSave;
  redeemed: string[]; meds: Record<string, number>; trial?: { id: string; left: number }; equip?: Record<string, string>;
  namePrompted?: number; tpv?: number; legendDry?: number; legendN?: number;
  /** 上次離開廣場的站位（含坐著離開時記住的椅旁站點） */
  plazaSpawn?: { x: number; z: number; yaw: number; pileId?: number; slot?: number };
  /** 已成功進過廣場（舊存檔有 plazaSpawn 也會補上） */
  plazaVisited?: number;
  /** 教學結束後的廣場導引已顯示過 */
  plazaGuideSeen?: number;
};

export const START_MONEY = 10000;

export type SaveStorage = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
};

export function defaultSave(): Save {
  return {
    v: SAVE_V, redeemed: [], meds: {}, dex: [0, 0, 0, 0], odd: ODD.map(() => 0), best: 0, money: START_MONEY, days: 0, queen: 0,
    life: Object.fromEntries(LIFE_KEYS.map(k => [k, 0])) as Life, titles: {}, shop: { owned: [], equipped: {} }, locs: [], gear: {},
  };
}

export function loadSave(LS: SaveStorage): Save {
  const d = defaultSave(); let raw: any = null;
  try { raw = JSON.parse(LS.getItem('oyster-sim') || 'null'); } catch { raw = null; }
  if (!raw || typeof raw !== 'object') return d;
  const num = (x: any, def = 0) => (typeof x === 'number' && isFinite(x) ? x : def);
  const arr4 = (a: any) => [0, 1, 2, 3].map(i => num(Array.isArray(a) ? a[i] : 0));
  const out: Save = { ...d, dex: arr4(raw.dex), odd: ODD.map((_, i) => num(Array.isArray(raw.odd) ? raw.odd[i] : 0)), best: num(raw.best), money: num(raw.money), days: num(raw.days), queen: num(raw.queen) };
  for (const k of LIFE_KEYS) out.life[k] = num(raw.life?.[k]);
  if (raw.titles && typeof raw.titles === 'object') for (const [k0, v] of Object.entries(raw.titles)) { const k = k0 === '👑 今日蚵后' ? '👑 今日剝蚵冠軍' : k0; out.titles[k] = (out.titles[k] ?? 0) + num(v); }
  if (raw.namePrompted) out.namePrompted = 1;
  if (raw.tpv) out.tpv = 1;
  if (Array.isArray(raw.evClaim)) out.evClaim = raw.evClaim.filter((x: unknown) => typeof x === 'string').slice(-30);
  if (Array.isArray(raw.svClaim)) out.svClaim = raw.svClaim.filter((x: unknown) => typeof x === 'number' && Number.isInteger(x) && x > 0).slice(-50);
  out.legendDry = Math.max(0, Math.floor(num(raw.legendDry))); if (typeof raw.legendN === 'number') out.legendN = raw.legendN;
  if (raw.equip && typeof raw.equip === 'object') { out.equip = {}; for (const [k, v] of Object.entries(raw.equip)) if (typeof v === 'string') out.equip[k] = v; }
  if (Array.isArray(raw.shop?.owned)) out.shop.owned = raw.shop.owned.filter((x: any) => typeof x === 'string');
  if (raw.shop?.equipped && typeof raw.shop.equipped === 'object') for (const [k, v] of Object.entries(raw.shop.equipped)) if (typeof v === 'string') out.shop.equipped[k] = v;
  if (typeof raw.seat === 'string') out.seat = raw.seat;
  if (typeof raw.bonusDay === 'string') out.bonusDay = raw.bonusDay;
  for (const k of ['lastBonusDay', 'lastSeen', 'retDay'] as const) if (typeof raw[k] === 'string') out[k] = raw[k];
  out.streakDay = Math.min(7, Math.max(0, Math.floor(num(raw.streakDay))));
  out.bonusN = num(raw.bonusN); out.tutDone = num(raw.tutDone);
  if (raw.meds && typeof raw.meds === 'object') for (const [k, v] of Object.entries(raw.meds)) out.meds[k] = Math.max(0, Math.floor(num(v)));
  out.locs = Array.isArray(raw.locs) ? raw.locs.filter((x: any) => typeof x === 'string') : []; if (typeof raw.loc === 'string') out.loc = raw.loc;
  out.gear = {}; if (raw.gear && typeof raw.gear === 'object') for (const [k, v] of Object.entries(raw.gear)) out.gear[k] = !!v;
  if (typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.slice(0, 16);
  if (Array.isArray(raw.locSeen)) out.locSeen = raw.locSeen.filter((x: any) => typeof x === 'string');
  if (raw.trial && typeof raw.trial.id === 'string' && num(raw.trial.left) > 0) out.trial = { id: raw.trial.id, left: num(raw.trial.left) };
  if (raw.ach && typeof raw.ach === 'object') {
    const A = raw.ach, sa = (x: any) => Array.isArray(x) ? x.filter((y: any) => typeof y === 'string').slice(0, 60) : [],
      rec = (x: any) => { const o: Record<string, number> = {}; if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) o[k] = Math.max(0, Math.floor(num(v))); return o; };
    out.ach = { got: rec(A.got), st: rec(A.st), locs: sa(A.locs), seats: sa(A.seats), radio: sa(A.radio), sets: sa(A.sets), fresh: sa(A.fresh), title: typeof A.title === 'string' ? A.title.slice(0, 12) : '', pts: Math.max(0, Math.floor(num(A.pts))) };
  }
  if (Array.isArray(raw.redeemed)) out.redeemed = raw.redeemed.filter((x: any) => typeof x === 'string');
  if (raw.plazaSpawn && typeof raw.plazaSpawn === 'object') {
    const p = raw.plazaSpawn;
    const x = num(p.x, NaN), z = num(p.z, NaN), yaw = num(p.yaw, NaN);
    if (Number.isFinite(x + z + yaw)) {
      out.plazaSpawn = { x, z, yaw };
      const pileId = Math.floor(num(p.pileId, -1));
      const slot = Math.floor(num(p.slot, -1));
      if (pileId >= 0 && slot >= 0) { out.plazaSpawn.pileId = pileId; out.plazaSpawn.slot = slot; }
    }
  }
  if (num(raw.plazaVisited) || out.plazaSpawn) out.plazaVisited = 1;
  if (num(raw.plazaGuideSeen)) out.plazaGuideSeen = 1;
  return out;
}

export function writeSave(LS: SaveStorage, save: Save) {
  try { LS.setItem('oyster-sim', JSON.stringify(save)); } catch { /* 私密模式等 */ }
}

export const DAILY_PAYS = [1000, 1200, 1500, 1800, 2200, 2600, 3000];
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
