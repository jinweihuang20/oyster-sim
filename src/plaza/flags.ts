/** 廣場旗幟：價格、文案檢查、伺服器通訊（所有權在本機，旗的位置／字／升級在伺服器） */

export type FlagTrack = 'color' | 'size' | 'fx';

export type PlazaFlagState = {
  k: string;
  nick: string;
  tag: string;
  x: number;
  z: number;
  yaw: number;
  text: string;
  color: number;
  size: number;
  fx: number;
  planted: boolean;
};

export type FlagColorSpec = {
  lv: number;
  n: string;
  price: number;
  cloth: number;
  text: number;
  style: 'flat' | 'foil' | 'gradient';
};

export type FlagSizeSpec = { lv: number; n: string; price: number; scale: number; radius: number };
export type FlagFxSpec = { lv: number; n: string; price: number };

/** 顏色：0 附贈，之後分開買；含旗面色與字色 */
export const FLAG_COLORS: FlagColorSpec[] = [
  { lv: 0, n: '赤紅白字', price: 0, cloth: 0x8a1820, text: 0xf4f0e8, style: 'flat' },
  { lv: 1, n: '藏青白字', price: 40000, cloth: 0x1e3a5f, text: 0xf4f0e8, style: 'flat' },
  { lv: 2, n: '牙白墨字', price: 55000, cloth: 0xf2efe4, text: 0x1f2a35, style: 'flat' },
  { lv: 3, n: '金箔墨字', price: 150000, cloth: 0xd4af37, text: 0x1f2a35, style: 'foil' },
  { lv: 4, n: '金紅漸層', price: 220000, cloth: 0xc9a227, text: 0xffe9a0, style: 'gradient' },
];

/** 尺寸三級；radius 是和其他旗的最小間距半徑 */
export const FLAG_SIZES: FlagSizeSpec[] = [
  { lv: 0, n: '小旗', price: 0, scale: 1, radius: 1.6 },
  { lv: 1, n: '中旗', price: 80000, scale: 1.35, radius: 2.2 },
  { lv: 2, n: '大旗', price: 180000, scale: 1.75, radius: 2.9 },
];

export const FLAG_FX: FlagFxSpec[] = [
  { lv: 0, n: '無特效', price: 0 },
  { lv: 1, n: '隨風擺動', price: 50000 },
  { lv: 2, n: '金光微閃', price: 90000 },
  { lv: 3, n: '光柱煙火', price: 200000 },
];

/** 雜貨店本體＋各升級檔（catalog / 後台改價都看這張表） */
export const FLAG_PRICE_ITEMS = [
  { id: 'plazaFlag', n: '廣場旗幟', price: 500000 },
  { id: 'flagColor1', n: '旗幟顏色：藏青白字', price: 40000 },
  { id: 'flagColor2', n: '旗幟顏色：牙白墨字', price: 55000 },
  { id: 'flagColor3', n: '旗幟顏色：金箔墨字', price: 150000 },
  { id: 'flagColor4', n: '旗幟顏色：金紅漸層', price: 220000 },
  { id: 'flagSize1', n: '旗幟尺寸：中旗', price: 80000 },
  { id: 'flagSize2', n: '旗幟尺寸：大旗', price: 180000 },
  { id: 'flagFx1', n: '旗幟特效：隨風擺動', price: 50000 },
  { id: 'flagFx2', n: '旗幟特效：金光微閃', price: 90000 },
  { id: 'flagFx3', n: '旗幟特效：光柱煙火', price: 200000 },
];

export const FLAG_ITEM = FLAG_PRICE_ITEMS[0];
export const FLAG_TEXT_MAX = 12;
export const FLAG_RENDER_CAP = 48;

export const FLAG_ERR_ZH: Record<string, string> = {
  bounds: '這裡超出廣場範圍',
  pile: '不能插在蚵堆上',
  seat: '不能插在座位上',
  stall: '不能插在攤位上',
  walkway: '不能插在主要走道上',
  too_close: '離別人的旗太近了',
  blocked: '這裡太擠，換個地方插',
  far: '走到要插的地方再按',
  seated: '站著才能插旗',
  bad_text: '這句話不能寫在旗上',
  url: '旗上不能寫網址',
  control: '旗上不能有奇怪的符號',
  too_long: '旗上最多寫 12 個字',
  slow: '慢一點再試',
  not_joined: '要先進入廣場',
  nosup: '這台伺服器還沒開放插旗',
  max: '這一項已經升到頂了',
  grow: '旗變大後會跟隔壁的旗太近，先換個地方再升級',
  no_conn: '還沒連上廣場',
  no_pid: '找不到你的存檔編號',
};

export function flagErrText(err?: string) {
  if (!err) return '沒成功';
  return FLAG_ERR_ZH[err] || err;
}

export function flagColorOf(lv: number) {
  return FLAG_COLORS[Math.max(0, Math.min(FLAG_COLORS.length - 1, lv | 0))] ?? FLAG_COLORS[0];
}
export function flagSizeOf(lv: number) {
  return FLAG_SIZES[Math.max(0, Math.min(FLAG_SIZES.length - 1, lv | 0))] ?? FLAG_SIZES[0];
}
export function flagFxOf(lv: number) {
  return FLAG_FX[Math.max(0, Math.min(FLAG_FX.length - 1, lv | 0))] ?? FLAG_FX[0];
}

export function nextFlagItem(track: FlagTrack, lv: number) {
  const id = track === 'color' ? `flagColor${lv + 1}` : track === 'size' ? `flagSize${lv + 1}` : `flagFx${lv + 1}`;
  return FLAG_PRICE_ITEMS.find(x => x.id === id) ?? null;
}

export function clipFlagText(raw: string) {
  return Array.from((raw ?? '').trim()).slice(0, FLAG_TEXT_MAX).join('');
}

function fin(n: unknown, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function normFlagDto(e: any): PlazaFlagState {
  return {
    k: String(e?.k ?? e?.K ?? ''),
    nick: String(e?.nick ?? e?.Nick ?? ''),
    tag: String(e?.tag ?? e?.Tag ?? ''),
    x: fin(e?.x ?? e?.X),
    z: fin(e?.z ?? e?.Z),
    yaw: fin(e?.yaw ?? e?.Yaw),
    text: String(e?.text ?? e?.Text ?? ''),
    color: Math.max(0, fin(e?.color ?? e?.Color, 0) | 0),
    size: Math.max(0, fin(e?.size ?? e?.Size, 0) | 0),
    fx: Math.max(0, fin(e?.fx ?? e?.Fx, 0) | 0),
    planted: !!(e?.planted ?? e?.Planted),
  };
}

function flagApiBase() {
  try {
    const u = new URLSearchParams(location.search).get('plazaHub');
    if (u && u.includes('/hubs/plaza')) return u.replace(/\/hubs\/plaza.*$/, '/s');
  } catch { /* ignore */ }
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787/s';
  return 'https://game-status.gwtech.org/s';
}

export async function fetchFlagSnapshot(pid: string, ms = 2500): Promise<{ flags: PlazaFlagState[]; mine: PlazaFlagState | null; ok: boolean }> {
  const empty = { flags: [] as PlazaFlagState[], mine: null as PlazaFlagState | null, ok: false };
  if (!pid) return empty;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(`${flagApiBase()}/plaza/flags?me=${encodeURIComponent(pid)}`, { mode: 'cors', cache: 'no-store', signal: c.signal });
    if (r.status === 404) return empty;
    if (!r.ok) return empty;
    const j = await r.json();
    const flags = Array.isArray(j?.flags) ? j.flags.map(normFlagDto) : [];
    const mine = j?.mine ? normFlagDto(j.mine) : null;
    return { flags, mine, ok: true };
  } catch {
    return empty;
  } finally {
    clearTimeout(t);
  }
}

export async function postFlagText(pid: string, text: string): Promise<{ ok: boolean; err?: string; mine?: PlazaFlagState | null }> {
  if (!pid) return { ok: false, err: 'no_pid' };
  try {
    const r = await fetch(`${flagApiBase()}/plaza/flag/text`, {
      method: 'POST', mode: 'cors', cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid, text }),
    });
    if (r.status === 404) return { ok: false, err: 'nosup' };
    const j = await r.json().catch(() => null);
    if (!j) return { ok: false, err: 'nosup' };
    return { ok: !!j.ok, err: j.err, mine: j.mine ? normFlagDto(j.mine) : null };
  } catch {
    return { ok: false, err: 'nosup' };
  }
}

export async function postFlagUpgrade(pid: string, track: FlagTrack): Promise<{ ok: boolean; err?: string; mine?: PlazaFlagState | null }> {
  if (!pid) return { ok: false, err: 'no_pid' };
  try {
    const r = await fetch(`${flagApiBase()}/plaza/flag/upgrade`, {
      method: 'POST', mode: 'cors', cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid, track }),
    });
    if (r.status === 404) return { ok: false, err: 'nosup' };
    const j = await r.json().catch(() => null);
    if (!j) return { ok: false, err: 'nosup' };
    return { ok: !!j.ok, err: j.err, mine: j.mine ? normFlagDto(j.mine) : null };
  } catch {
    return { ok: false, err: 'nosup' };
  }
}
