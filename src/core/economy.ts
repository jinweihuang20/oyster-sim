/** 剝蚵仔賺錢設定：內建預設 + 後台 /s/economy 覆蓋 */

export type EconomyCfg = {
  dpay: number[];
  crumbRate: number;
  tempCut: number;
  quickBonus: number;
  perfectPay: number;
  yardStealFine: number;
  yardStealDiff: number;
  plazaStealPen: number;
  plazaStealBanN: number;
  plazaStealBanMs: number;
  plazaStealMinCount: number;
  peaceBonus: number;
  nightMult: number;
  workedMinCount: number;
  dailyPays: number[];
  startMoney: number;
  return7: number;
  return30: number;
  locMult: Record<string, number>;
  rarPrices: number[];
  plazaMaxEarn: number;
  plazaCapBase: number;
  plazaCapDurSec: number;
  plazaCapPerSec: number;
  plazaCapOystersMax: number;
  plazaCapPerOyster: number;
};

export const ECO_DEFAULTS: EconomyCfg = {
  dpay: [6, 8, 12, 18],
  crumbRate: 0.7,
  tempCut: 1,
  quickBonus: 1,
  perfectPay: 2,
  yardStealFine: 5,
  yardStealDiff: 1,
  plazaStealPen: 30,
  plazaStealBanN: 3,
  plazaStealBanMs: 45_000,
  plazaStealMinCount: 4,
  peaceBonus: 50,
  nightMult: 0.2,
  workedMinCount: 5,
  dailyPays: [1000, 1200, 1500, 1800, 2200, 2600, 3000],
  startMoney: 10_000,
  return7: 10_000,
  return30: 30_000,
  locMult: { home: 1, wanggong: 1.2, dongshi: 1.4, budai: 2 },
  rarPrices: [200, 600, 1800, 6000],
  plazaMaxEarn: 99_999_999,
  plazaCapBase: 80,
  plazaCapDurSec: 1800,
  plazaCapPerSec: 12,
  plazaCapOystersMax: 400,
  plazaCapPerOyster: 20,
};

/** 執行期設定（啟動後可被伺服器覆蓋） */
export const eco: EconomyCfg = structuredClone(ECO_DEFAULTS);

const ECO_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8787/s/economy?game=oyster-sim'
  : 'https://game-status.gwtech.org/s/economy?game=oyster-sim';

function arr4(a: unknown, fallback: number[]): number[] {
  if (!Array.isArray(a) || a.length !== 4) return fallback.slice();
  return a.map((x, i) => {
    const n = Math.floor(Number(x));
    return Number.isFinite(n) ? n : fallback[i];
  });
}
function arr7(a: unknown, fallback: number[]): number[] {
  if (!Array.isArray(a) || a.length !== 7) return fallback.slice();
  return a.map((x, i) => {
    const n = Math.floor(Number(x));
    return Number.isFinite(n) ? n : fallback[i];
  });
}
function num(v: unknown, fallback: number, min?: number, max?: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (min != null && n < min) return fallback;
  if (max != null && n > max) return fallback;
  return n;
}

/** 把伺服器 cfg 合併進 eco（原地改，主程式直接讀 eco） */
export function applyEconomy(raw: Partial<EconomyCfg> | null | undefined) {
  if (!raw || typeof raw !== 'object') return;
  const d = ECO_DEFAULTS;
  eco.dpay = arr4(raw.dpay, d.dpay);
  eco.crumbRate = num(raw.crumbRate, d.crumbRate, 0.1, 1);
  eco.tempCut = Math.floor(num(raw.tempCut, d.tempCut, 0, 1000));
  eco.quickBonus = Math.floor(num(raw.quickBonus, d.quickBonus, 0, 100000));
  eco.perfectPay = Math.floor(num(raw.perfectPay, d.perfectPay, 0, 100000));
  eco.yardStealFine = Math.floor(num(raw.yardStealFine, d.yardStealFine, 0, 1e6));
  eco.yardStealDiff = Math.floor(num(raw.yardStealDiff, d.yardStealDiff, 0, 3));
  eco.plazaStealPen = Math.floor(num(raw.plazaStealPen, d.plazaStealPen, 0, 1e6));
  eco.plazaStealBanN = Math.floor(num(raw.plazaStealBanN, d.plazaStealBanN, 1, 100));
  eco.plazaStealBanMs = Math.floor(num(raw.plazaStealBanMs, d.plazaStealBanMs, 0, 3_600_000));
  eco.plazaStealMinCount = Math.floor(num(raw.plazaStealMinCount, d.plazaStealMinCount, 0, 1000));
  eco.peaceBonus = Math.floor(num(raw.peaceBonus, d.peaceBonus, 0, 1e6));
  eco.nightMult = num(raw.nightMult, d.nightMult, 0, 5);
  eco.workedMinCount = Math.floor(num(raw.workedMinCount, d.workedMinCount, 0, 1000));
  eco.dailyPays = arr7(raw.dailyPays, d.dailyPays);
  eco.startMoney = Math.floor(num(raw.startMoney, d.startMoney, 0, 1e8));
  eco.return7 = Math.floor(num(raw.return7, d.return7, 0, 1e8));
  eco.return30 = Math.floor(num(raw.return30, d.return30, 0, 1e8));
  eco.rarPrices = arr4(raw.rarPrices, d.rarPrices);
  eco.plazaMaxEarn = Math.floor(num(raw.plazaMaxEarn, d.plazaMaxEarn, 1, 1e8));
  eco.plazaCapBase = Math.floor(num(raw.plazaCapBase, d.plazaCapBase, 0, 1e7));
  eco.plazaCapDurSec = Math.floor(num(raw.plazaCapDurSec, d.plazaCapDurSec, 0, 14400));
  eco.plazaCapPerSec = Math.floor(num(raw.plazaCapPerSec, d.plazaCapPerSec, 0, 1e5));
  eco.plazaCapOystersMax = Math.floor(num(raw.plazaCapOystersMax, d.plazaCapOystersMax, 0, 10000));
  eco.plazaCapPerOyster = Math.floor(num(raw.plazaCapPerOyster, d.plazaCapPerOyster, 0, 1e5));
  if (raw.locMult && typeof raw.locMult === 'object') {
    for (const [k, v] of Object.entries(raw.locMult)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0.1 && n <= 10) eco.locMult[k] = n;
    }
  }
}

export async function fetchEconomy(ms = 2500): Promise<boolean> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(ECO_URL, { mode: 'cors', cache: 'no-store', signal: c.signal });
    if (!r.ok) return false;
    const j = await r.json();
    applyEconomy(j?.cfg);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** 同步 LOCS[].m 與珍珠售價（RAR 陣列原地改 price） */
export function syncEconomyTables(
  locs: { id: string; m: number }[],
  rar: { price: number }[],
) {
  for (const L of locs) {
    const m = eco.locMult[L.id];
    if (typeof m === 'number' && Number.isFinite(m)) L.m = m;
  }
  for (let i = 0; i < Math.min(4, rar.length); i++) rar[i].price = eco.rarPrices[i];
}

/** 廣場離線備援上限：soft 公式已停用，只取絕對天花板。 */
export function plazaSoftCapClient(_oysters: number, _durationSec: number): number {
  return eco.plazaMaxEarn;
}
