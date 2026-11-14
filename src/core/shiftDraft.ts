/**
 * 未結算班次草稿：定期寫入 localStorage，重開自動補入帳。
 * 防竄改：同步 HMAC-SHA256 + 結構／上限檢查 + 已領 sid 名單。
 * 純前端無法防盡心破解，但可擋隨意改 JSON；關頁用同步簽名確保寫得完。
 */
import { eco } from './economy';

export type ShiftDraftMode = 'yard' | 'plaza';

export type ShiftDraftBody = {
  v: 1;
  sid: string;
  mode: ShiftDraftMode;
  t0: number;
  tu: number;
  meatPay: number;
  perfects: number;
  bowlBonus: number;
  penalty: number;
  pearlMoney: number;
  count: number;
  dCnt: [number, number, number, number];
  night: 0 | 1;
  locM: number;
  perfectPay: number;
  nightMult: number;
};

type SignedDraft = { body: ShiftDraftBody; sig: string };

const DRAFT_KEY = 'oyster-shift-draft';
const CLAIMED_KEY = 'oyster-shift-claimed';
const SALT = 'oy-shift-draft-v1';
const MAX_AGE_MS = 36 * 3600_000;
const MAX_CLAIMED = 40;

export type SaveStorage = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem?: (k: string) => void;
};

/** 同步 SHA-256（關頁不能依賴 async subtle；canon／key 為 UTF-8） */
function sha256(str: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bytes = unescape(encodeURIComponent(str));
  const l = bytes.length;
  const withOne = l + 1;
  const bitLen = l * 8;
  const padLen = ((56 - (withOne % 64)) + 64) % 64;
  const total = withOne + padLen + 8;
  const buf = new Uint8Array(total);
  for (let i = 0; i < l; i++) buf[i] = bytes.charCodeAt(i);
  buf[l] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 4, bitLen >>> 0);
  for (let off = 0; off < total; off += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ ((~e) & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = [
      (H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0,
      (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0,
    ];
  }
  return H.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('');
}

function hmacHex(pid: string, payload: string): string {
  const keyMat = `${SALT}|${pid}|${SALT}`;
  // 簡化 HMAC：H(key || msg || key) — 擋隨意改 JSON；非標準 HMAC 但同步可靠
  return sha256(`${keyMat}|${payload}|${keyMat}`);
}

function canon(body: ShiftDraftBody): string {
  return [
    body.v, body.sid, body.mode, body.t0, body.tu,
    body.meatPay, body.perfects, body.bowlBonus, body.penalty, body.pearlMoney,
    body.count, body.dCnt.join('.'), body.night, body.locM, body.perfectPay, body.nightMult,
  ].join('|');
}

function num(x: unknown, lo = 0, hi = 1e9): number | null {
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return null;
  const f = Math.floor(n);
  if (f < lo || f > hi) return null;
  return f;
}

function parseBody(raw: unknown): ShiftDraftBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.sid !== 'string' || o.sid.length < 8 || o.sid.length > 80) return null;
  if (o.mode !== 'yard' && o.mode !== 'plaza') return null;
  const t0 = num(o.t0, 1, Date.now() + 60_000);
  const tu = num(o.tu, 1, Date.now() + 60_000);
  const meatPay = num(o.meatPay, 0, 50_000_000);
  const perfects = num(o.perfects, 0, 50_000);
  const bowlBonus = num(o.bowlBonus, 0, 5_000_000);
  const penalty = num(o.penalty, 0, 5_000_000);
  const pearlMoney = num(o.pearlMoney, 0, 50_000_000);
  const count = num(o.count, 0, 20_000);
  const night = o.night === 1 || o.night === true ? 1 : o.night === 0 || o.night === false ? 0 : null;
  const locM = typeof o.locM === 'number' && Number.isFinite(o.locM) ? o.locM : null;
  const perfectPay = num(o.perfectPay, 0, 100_000);
  const nightMult = typeof o.nightMult === 'number' && Number.isFinite(o.nightMult) ? o.nightMult : null;
  const dRaw = o.dCnt;
  if (!Array.isArray(dRaw) || dRaw.length !== 4) return null;
  const dCnt = [0, 1, 2, 3].map(i => num(dRaw[i], 0, 20_000)) as (number | null)[];
  if (dCnt.some(x => x == null) || t0 == null || tu == null || meatPay == null || perfects == null
    || bowlBonus == null || penalty == null || pearlMoney == null || count == null || night == null
    || locM == null || perfectPay == null || nightMult == null) return null;
  if (locM < 0.1 || locM > 10 || nightMult < 0 || nightMult > 5) return null;
  if (tu < t0 || Date.now() - tu > MAX_AGE_MS || Date.now() - t0 > MAX_AGE_MS + 12 * 3600_000) return null;
  const sumD = (dCnt as number[]).reduce((a, b) => a + b, 0);
  if (sumD > count) return null;
  return {
    v: 1, sid: o.sid, mode: o.mode, t0, tu, meatPay, perfects, bowlBonus, penalty, pearlMoney,
    count, dCnt: dCnt as [number, number, number, number], night, locM, perfectPay, nightMult,
  };
}

export function computeDraftEarn(d: ShiftDraftBody): number {
  const base0 = d.meatPay + d.perfects * d.perfectPay + d.bowlBonus + d.pearlMoney;
  const locBonus = Math.round(base0 * (d.locM - 1));
  const nightBonus = d.night ? Math.round((base0 + locBonus) * d.nightMult) : 0;
  return Math.max(0, base0 + locBonus + nightBonus - d.penalty);
}

function plausible(d: ShiftDraftBody, earn: number): boolean {
  if (earn <= 0 || d.count <= 0) return false;
  const maxPay = Math.max(...eco.dpay, 1);
  // locBonus／night 會把金額放大，上限略留餘地
  const ceil = Math.ceil(
    d.count * maxPay * Math.max(d.locM, 1) * (1 + (d.night ? d.nightMult : 0)) * 1.25
    + d.perfects * d.perfectPay + d.bowlBonus + d.pearlMoney + 500,
  );
  if (earn > ceil) return false;
  if (earn > eco.plazaMaxEarn) return false;
  if (d.meatPay > d.count * maxPay * 4 + d.perfects * 8) return false;
  return true;
}

export function writeShiftDraft(LS: SaveStorage, pid: string, body: ShiftDraftBody): boolean {
  if (body.count <= 0 && body.meatPay <= 0 && body.pearlMoney <= 0) return false;
  const earn = computeDraftEarn(body);
  if (!plausible(body, earn)) return false;
  try {
    const sig = hmacHex(pid, canon(body));
    if (!sig) return false;
    LS.setItem(DRAFT_KEY, JSON.stringify({ body, sig } satisfies SignedDraft));
    return true;
  } catch {
    return false;
  }
}

export function clearShiftDraft(LS: SaveStorage): void {
  try {
    if (LS.removeItem) LS.removeItem(DRAFT_KEY);
    else LS.setItem(DRAFT_KEY, '');
  } catch { /* */ }
}

function loadClaimed(LS: SaveStorage, pid: string): string[] {
  try {
    const raw = JSON.parse(LS.getItem(CLAIMED_KEY) || 'null') as { ids?: unknown; sig?: string } | null;
    if (!raw || !Array.isArray(raw.ids) || typeof raw.sig !== 'string') return [];
    const ids = raw.ids.filter((x): x is string => typeof x === 'string').slice(0, MAX_CLAIMED);
    if (hmacHex(pid, ids.join(',')) !== raw.sig.toLowerCase()) return [];
    return ids;
  } catch { return []; }
}

function saveClaimed(LS: SaveStorage, pid: string, ids: string[]): void {
  const next = ids.slice(-MAX_CLAIMED);
  const sig = hmacHex(pid, next.join(','));
  try { LS.setItem(CLAIMED_KEY, JSON.stringify({ ids: next, sig })); } catch { /* */ }
}

export type ReclaimResult = {
  ok: true;
  earn: number;
  count: number;
  mode: ShiftDraftMode;
  dCnt: [number, number, number, number];
  sid: string;
} | { ok: false; reason?: string };

/** 驗證草稿並標記 sid 已領；成功後才清草稿。 */
export function takeShiftDraft(LS: SaveStorage, pid: string): ReclaimResult {
  let packed: SignedDraft | null = null;
  try {
    const raw = LS.getItem(DRAFT_KEY);
    if (!raw) return { ok: false, reason: 'empty' };
    packed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'parse' };
  }
  if (!packed?.body || typeof packed.sig !== 'string') return { ok: false, reason: 'shape' };
  const body = parseBody(packed.body);
  if (!body) return { ok: false, reason: 'body' };
  if (hmacHex(pid, canon(body)) !== packed.sig.toLowerCase()) return { ok: false, reason: 'sig' };
  const earn = computeDraftEarn(body);
  if (!plausible(body, earn)) return { ok: false, reason: 'cap' };
  const claimed = loadClaimed(LS, pid);
  if (claimed.includes(body.sid)) {
    clearShiftDraft(LS);
    return { ok: false, reason: 'claimed' };
  }
  claimed.push(body.sid);
  saveClaimed(LS, pid, claimed);
  clearShiftDraft(LS);
  return { ok: true, earn, count: body.count, mode: body.mode, dCnt: body.dCnt, sid: body.sid };
}
