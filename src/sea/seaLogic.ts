/**
 * 外傘頂洲「出海採蚵」第一段：純邏輯（不碰 three.js／DOM，方便測試）
 *
 * 座標：x 東西、z 南北（-z 往外海）。碼頭在原點附近，蚵棚在 z -50～-115。
 * 船頭方向 h：rotation.y = h，前進向量 = (-sin h, -cos h)。
 */

/** 調整用數字（改這裡就好） */
export const SEA = {
  lenMin: 140, lenMax: 180, // 退潮倒數（秒，每趟隨機）
  warnAt: 30, // 剩幾秒提醒回航
  cap: 18, // 載重上限（一串 1～3 單位）
  maxSpd: 7.5, rev: 0.35, accel: 5, turn: 1.75,
  loadSlow: 0.5, loadTurn: 0.55, // 滿載時：速度 -50%、轉向 -55%
  shoalSlow: 0.5, // 淺灘上刮底：速度 ×0.5
  groundLim0: 0.75, groundLim1: 0.3, // 載重比例超過這個就擱淺（出海時 → 退潮尾）
  shoalGrow: 0.7, // 淺灘半徑到退潮尾 +70%
  pullR: 3.4, pullMaxSpd: 2.2, // 拉蚵串：距離、船速要低於
  pullBase: 1.0, pullPerW: 0.8, // 拉一串秒數 = base + perW × 重量
  oyPerW: [0, 6, 11, 17], bigPerW: [0, 0.2, 0.35, 0.55], // 每串蚵仔數、大蚵比例（依重量 1～3）
  ownedShare: 0.3, finePerW: 250, // 別人家蚵棚比例、偷拉罰款（每單位重量）
  waveMin: 14, waveMax: 24, waveLen: 2.6, wavePush: 3.2, wavePullLoss: 0.35, waveDropAt: 0.8, waveDropP: 0.4,
  strandKeep: 0.5, // 退潮擱淺：只救回一半
  dockR: 7, minPile: 10,
  bounds: { x0: -62, x1: 62, z0: -128, z1: 6 },
  dock: { x: 0, z: 2 },
} as const;

export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type Shoal = { x: number; z: number; r0: number };
export type Str = { x: number; z: number; w: 1 | 2 | 3; row: number; taken: boolean };
export type Row = { ax: number; az: number; bx: number; bz: number; owned: boolean };
export type Layout = { len: number; shoals: Shoal[]; rows: Row[]; strs: Str[] };

/** 每趟隨機：蚵棚排數／位置、誰家的、淺灘、退潮時間 */
export function makeLayout(rng: Rng): Layout {
  const R = (a: number, b: number) => a + (b - a) * rng();
  const len = Math.round(R(SEA.lenMin, SEA.lenMax));
  const rows: Row[] = [], strs: Str[] = [];
  const nRows = 5 + Math.floor(rng() * 3);
  const zs: number[] = [];
  for (let tries = 0; zs.length < nRows && tries < 200; tries++) {
    const z = R(-112, -52);
    if (zs.every(o => Math.abs(o - z) > 7.5)) zs.push(z);
  }
  zs.sort((a, b) => b - a);
  zs.forEach((z, i) => {
    const L = R(14, 30), x0 = R(-46, 46 - L), ang = R(-0.25, 0.25);
    const ax = x0, az = z, bx = x0 + Math.cos(ang) * L, bz = z + Math.sin(ang) * L;
    rows.push({ ax, az, bx, bz, owned: false });
    const n = Math.max(3, Math.floor(L / 3.2));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n, wr = rng();
      strs.push({ x: ax + (bx - ax) * f, z: az + (bz - az) * f, w: wr < 0.45 ? 1 : wr < 0.8 ? 2 : 3, row: i, taken: false });
    }
  });
  // 別人家的蚵棚：約三成，但自己的至少留兩排
  const idx = rows.map((_, i) => i).sort(() => rng() - 0.5);
  const nOwned = Math.min(rows.length - 2, Math.round(rows.length * SEA.ownedShare + rng() * 0.6));
  for (let k = 0; k < nOwned; k++) rows[idx[k]].owned = true;
  // 淺灘：碼頭和蚵棚之間；不壓碼頭
  const shoals: Shoal[] = [];
  const nSh = 6 + Math.floor(rng() * 3);
  for (let tries = 0; shoals.length < nSh && tries < 300; tries++) {
    const s = { x: R(-48, 48), z: R(-104, -14), r0: R(3, 7.5) };
    if (Math.hypot(s.x - SEA.dock.x, s.z - SEA.dock.z) < s.r0 * (1 + SEA.shoalGrow) + 9) continue;
    if (shoals.some(o => Math.hypot(o.x - s.x, o.z - s.z) < o.r0 + s.r0 + 2)) continue;
    shoals.push(s);
  }
  return { len, shoals, rows, strs };
}

/** 退潮進度 0→1 */
export const ebbOf = (t: number, len: number) => Math.min(1, Math.max(0, t / len));
export const shoalR = (s: Shoal, ebb: number) => s.r0 * (1 + SEA.shoalGrow * ebb);
/** 現在載重比例超過多少會擱淺 */
export const groundLim = (ebb: number) => SEA.groundLim0 + (SEA.groundLim1 - SEA.groundLim0) * ebb;
export const pullDur = (w: number) => SEA.pullBase + SEA.pullPerW * w;
export function inShoal(L: Layout, x: number, z: number, ebb: number) {
  return L.shoals.some(s => Math.hypot(s.x - x, s.z - z) < shoalR(s, ebb));
}

export type Boat = { x: number; z: number; h: number; v: number; load: number; grounded: boolean; px: number; pz: number };
export const newBoat = (): Boat => ({ x: SEA.dock.x, z: SEA.dock.z - 3, h: 0, v: 0, load: 0, grounded: false, px: 0, pz: 0 });

/** 一步船的物理；回傳這一步有沒有「剛擱淺」 */
export function stepBoat(b: Boat, L: Layout, ebb: number, thr: number, steer: number, dt: number): { justGrounded: boolean; shoal: boolean } {
  const lf = b.load / SEA.cap, sh = inShoal(L, b.x, b.z, ebb);
  let justGrounded = false;
  if (sh && lf > groundLim(ebb) + 1e-6) { if (!b.grounded) justGrounded = true; b.grounded = true; }
  else b.grounded = false;
  if (b.grounded) { b.v *= Math.exp(-8 * dt); if (Math.abs(b.v) < 0.05) b.v = 0; return { justGrounded, shoal: sh }; }
  const maxV = SEA.maxSpd * (1 - SEA.loadSlow * lf) * (sh ? SEA.shoalSlow : 1);
  const target = thr >= 0 ? thr * maxV : thr * maxV * SEA.rev;
  const dv = target - b.v, step = SEA.accel * (1 - 0.4 * lf) * dt;
  b.v += Math.abs(dv) <= step ? dv : Math.sign(dv) * step;
  const turnK = SEA.turn * (1 - SEA.loadTurn * lf) * Math.min(1, Math.abs(b.v) / 2.5 + 0.25);
  b.h -= steer * turnK * dt * (b.v < -0.05 ? -1 : 1);
  b.x += (-Math.sin(b.h) * b.v + b.px) * dt;
  b.z += (-Math.cos(b.h) * b.v + b.pz) * dt;
  // 撞到蚵棚竹架：推開、減速
  for (const r of L.rows) {
    const vx = r.bx - r.ax, vz = r.bz - r.az, l2 = vx * vx + vz * vz;
    const f = Math.max(0, Math.min(1, ((b.x - r.ax) * vx + (b.z - r.az) * vz) / l2));
    const cx = r.ax + vx * f, cz = r.az + vz * f, dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz);
    if (d < 1.1) { const k = (1.1 - d) / Math.max(1e-4, d); b.x += dx * k; b.z += dz * k; b.v *= 0.6; }
  }
  const B = SEA.bounds;
  b.x = Math.min(B.x1, Math.max(B.x0, b.x)); b.z = Math.min(B.z1, Math.max(B.z0, b.z));
  return { justGrounded, shoal: sh };
}

/** 船邊最近、還沒拉的蚵串 */
export function nearestStr(L: Layout, b: Boat): Str | null {
  let best: Str | null = null, bd: number = SEA.pullR;
  for (const s of L.strs) { if (s.taken) continue; const d = Math.hypot(s.x - b.x, s.z - b.z); if (d < bd) { bd = d; best = s; } }
  return best;
}

export type Haul = { strings: number; oy: number; big: number; fine: number; stolen: number; lost: number; stranded: boolean; secs: number; skipped?: boolean };
export type Load = { w: number; oy: number; big: number; owned: boolean };
/** 一串的內容：越重蚵越多、大蚵越多 */
export function strContent(w: 1 | 2 | 3, rng: Rng): Load & { owned: boolean } {
  const oy = SEA.oyPerW[w] + Math.floor(rng() * 3) - 1;
  let big = 0; for (let i = 0; i < oy; i++) if (rng() < SEA.bigPerW[w]) big++;
  return { w, oy, big, owned: false };
}
/** 收尾：擱淺只救回一半；空手也給最少一小堆 */
export function finishHaul(loads: Load[], o: { fine: number; stolen: number; lost: number; stranded: boolean; secs: number }): Haul {
  let oy = loads.reduce((s, l) => s + l.oy, 0), big = loads.reduce((s, l) => s + l.big, 0);
  if (o.stranded) { oy = Math.floor(oy * SEA.strandKeep); big = Math.min(oy, Math.floor(big * SEA.strandKeep)); }
  if (oy < SEA.minPile) { oy = SEA.minPile; big = Math.min(big, oy); }
  return { strings: loads.length, oy, big, ...o };
}
