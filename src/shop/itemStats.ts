/** 後台物品能力／文案覆寫：GET /s/shop/stats → 原地改 EQUIP／刀／傘／臉盆／藥／寵物… */
import { EQUIP, SETS, WALK_SPEED_BONUS, type Fx } from './shopEquip';
import { KNIVES, UMBS, BOWLS, GEAR, COSMETICS } from './yardShop';
import { MEDS } from './meds';
import { PETS } from './pets';

export type ItemStatFields = Record<string, string | number>;
export type ItemStatsMap = Record<string, ItemStatFields>;

const STATS_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8787/s/shop/stats?game=oyster-sim'
  : 'https://game-status.gwtech.org/s/shop/stats?game=oyster-sim';

let lastApplied = '';

function str(v: unknown): string | undefined {
  if (typeof v === 'string') { const t = v.trim(); return t.length ? t : undefined; }
  return undefined;
}
function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function applyFx(target: Fx, o: ItemStatFields) {
  const keys: (keyof Fx)[] = ['bowl', 'keep', 'speed', 'pearl', 'nag', 'throw', 'dmg', 'luck', 'steal'];
  for (const k of keys) {
    const v = num(o[k]);
    if (v != null) target[k] = v;
  }
}

/** 把覆寫套到遊戲內建陣列（原地改，商店 UI／戰鬥讀到的就是新值） */
export function applyItemStats(items: ItemStatsMap | null | undefined) {
  if (!items || typeof items !== 'object') return;

  for (const [key, o] of Object.entries(items)) {
    if (!o || typeof o !== 'object') continue;
    const i = key.indexOf(':');
    if (i < 0) continue;
    const kind = key.slice(0, i);
    const id = key.slice(i + 1);
    if (!id) continue;

    if (kind === 'equip') {
      const e = EQUIP.find(x => x.id === id); if (!e) continue;
      const n = str(o.n); if (n) e.n = n;
      const eff = str(o.eff); if (eff) e.eff = eff;
      applyFx(e.fx, o);
      const walk = num(o.walk);
      if (walk != null) WALK_SPEED_BONUS[id] = walk;
    } else if (kind === 'set') {
      const s = SETS.find(x => x.id === id); if (!s) continue;
      const n = str(o.n); if (n) s.n = n;
      const eff = str(o.eff); if (eff) s.eff = eff;
      applyFx(s.fx, o);
    } else if (kind === 'knife') {
      const k = KNIVES.find(x => x.id === id); if (!k) continue;
      const n = str(o.n); if (n) k.n = n;
      const desc = str(o.desc); if (desc) k.desc = desc;
      for (const f of ['green', 'speed', 'steps', 'stab', 'seam', 'luck'] as const) {
        const v = num(o[f]); if (v != null) k[f] = v;
      }
    } else if (kind === 'umb') {
      const u = UMBS.find(x => x.id === id); if (!u) continue;
      const n = str(o.n); if (n) u.n = n;
      const desc = str(o.desc); if (desc) u.desc = desc;
      for (const f of ['open', 'dur', 'perf', 'cover', 'reflect', 'size'] as const) {
        const v = num(o[f]); if (v != null) u[f] = v;
      }
    } else if (kind === 'bowl') {
      const b = BOWLS.find(x => x.id === id); if (!b) continue;
      const n = str(o.n); if (n) b.n = n;
      const desc = str(o.desc); if (desc) b.desc = desc;
      for (const f of ['r', 'bounce', 'dist', 'perf', 'bonus', 'h'] as const) {
        const v = num(o[f]); if (v != null) b[f] = v;
      }
    } else if (kind === 'pet') {
      const p = PETS.find(x => x.id === id); if (!p) continue;
      const n = str(o.n); if (n) p.n = n;
      const desc = str(o.desc); if (desc) p.desc = desc;
      const eff = str(o.eff); if (eff) p.eff = eff;
      const tickSec = num(o.tickSec); if (tickSec != null && tickSec > 0) p.fx.tickSec = tickSec;
      const perTick = num(o.perTick); if (perTick != null && perTick >= 1) p.fx.perTick = Math.floor(perTick);
      const meatDiff = num(o.meatDiff);
      if (meatDiff != null) p.fx.meatDiff = Math.max(0, Math.min(3, Math.floor(meatDiff))) as 0 | 1 | 2 | 3;
    } else if (kind === 'med') {
      const m = MEDS.find(x => x.id === id); if (!m) continue;
      const n = str(o.n); if (n) m.n = n;
      const good = str(o.good); if (good) m.good = good;
      const bad = str(o.bad); if (bad) m.bad = bad;
      const dur = num(o.dur); if (dur != null) m.dur = Math.max(0, dur);
      const luck = num(o.luck); if (luck != null) m.luck = luck;
      const heal = num(o.heal); if (heal != null) m.heal = heal;
      const mKeys = [
        ['mGreen', 'green'], ['mSpeed', 'speed'], ['mSlip', 'slip'],
        ['mDmg', 'dmg'], ['mRegen', 'regen'], ['mGrudge', 'grudge'],
      ] as const;
      for (const [src, dst] of mKeys) {
        const v = num(o[src]);
        if (v == null) continue;
        m.m = m.m ?? {};
        m.m[dst] = v;
      }
    } else if (kind === 'gear') {
      const g = GEAR.find(x => x.id === id); if (!g) continue;
      const n = str(o.n); if (n) g.n = n;
      const good = str(o.good); if (good) g.good = good;
      const bad = str(o.bad); if (bad) g.bad = bad;
      for (const f of ['dmgMul', 'speedMul', 'angerMul', 'seamMul'] as const) {
        const v = num(o[f]); if (v != null) g[f] = v;
      }
    } else if (kind === 'cosmetic') {
      const c = COSMETICS.find(x => x.id === id); if (!c) continue;
      const n = str(o.n); if (n) c.n = n;
      const good = str(o.good); if (good) c.good = good;
    } else if (kind === 'item') {
      // ITEMS 在 main.ts；透過 hook 套用
      itemHooks.forEach(h => h(id, o));
    }
  }
}

type ItemHook = (id: string, o: ItemStatFields) => void;
const itemHooks: ItemHook[] = [];
/** main.ts 註冊消耗品 ITEMS 的覆寫套用 */
export function onItemStatApply(fn: ItemHook) { itemHooks.push(fn); }

export async function fetchItemStats(ms = 2500): Promise<boolean> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(STATS_URL, { mode: 'cors', cache: 'no-store', signal: c.signal });
    if (!r.ok) return false;
    const j = await r.json();
    const items = j?.items as ItemStatsMap | undefined;
    const sig = JSON.stringify(items ?? {});
    if (sig === lastApplied) return true;
    applyItemStats(items);
    lastApplied = sig;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
