/**
 * 自己的蚵棚：高空識別標記狀態、開船海面小雷達的座標換算（純邏輯，不碰 three／DOM）。
 * 雷達採「船頭朝上」：前方＝畫面 -y、右方＝+x、後方＝+y。
 */
import { isMine, isPrivate, rackNow, type RackDto } from './rackLogic';

/** 自己蚵棚的高空光柱：只給主人看、最遠約 200 m，InstancedMesh 容量 8（私人最多 4 座） */
export const RACK_BEACON = {
  viewR: 200,
  cap: 8,
  /** 生長中／空棚：亮青 */
  grow: 0x38bdf8,
  /** 有串可收／長滿：暖金 */
  ripe: 0xfacc15,
} as const;

/** 海面小雷達：顯示半徑、自己棚超出時貼邊的距離、範圍圈、重繪間隔 */
export const RACK_RADAR = {
  range: 100,
  clampR: 95,
  rings: [50, 100] as const,
  /** 約 11 Hz，不要每幀重畫以免手機發熱 */
  interval: 0.09,
} as const;

export type RackBeaconState = 'none' | 'grow' | 'ripe';
/** 只有自己的蚵棚才有高空標記；有串可收（或已長滿）用金色，否則青色 */
export function rackBeaconState(r: RackDto, me: string, serverNow: number): RackBeaconState {
  if (!isMine(r, me)) return 'none';
  return rackNow(r, serverNow) > 0 ? 'ripe' : 'grow';
}

/**
 * 世界相對位移 → 船頭朝上的雷達座標（公尺）。
 * 船頭方向 h 與膠筏相同：前進 = (-sin h, -cos h)。
 */
export function rackWorldToRadar(dx: number, dz: number, h: number): { x: number; y: number } {
  const fwdX = -Math.sin(h), fwdZ = -Math.cos(h);
  const rightX = -fwdZ, rightZ = fwdX;
  const ahead = dx * fwdX + dz * fwdZ;
  const right = dx * rightX + dz * rightZ;
  return { x: right, y: -ahead };
}

/** 超出 clampR 就縮到圓邊內側，方向不變（自己的蚵棚、碼頭出範圍時仍看得到方位） */
export function radarClamp(x: number, y: number, clampR: number): { x: number; y: number; dist: number; clamped: boolean } {
  const dist = Math.hypot(x, y);
  if (dist <= clampR || dist < 1e-9) return { x, y, dist, clamped: false };
  const k = clampR / dist;
  return { x: x * k, y: y * k, dist, clamped: true };
}

/** 拉魚戰鬥、全螢幕面板、釣魚 HUD 打開時，小雷達要藏起來避免打架 */
const RADAR_COVER = ['fishFight', 'rackPanelOpen', 'fishPanelOpen', 'fishReplayOn', 'plazaFishing', 'fishMode', 'uiCovered'] as const;
export function rackRadarCovered(cls: { contains(c: string): boolean } | string): boolean {
  const has = typeof cls === 'string' ? (c: string) => cls.split(/\s+/).includes(c) : (c: string) => cls.contains(c);
  return RADAR_COVER.some(has);
}

export type RadarMarkKind = 'pier' | 'public' | 'other' | 'mineGrow' | 'mineRipe';
export type RadarMark = {
  kind: RadarMarkKind;
  x: number; y: number;
  dist: number;
  clamped: boolean;
  /** 雷達平面上的旋轉（碼頭木板朝向） */
  rot?: number;
};

export function buildRadarMarks(o: {
  boat: { x: number; z: number; h: number };
  racks: readonly RackDto[];
  me: string;
  now: number;
  pier: { x: number; z: number };
  range?: number;
  clampR?: number;
}): RadarMark[] {
  const range = o.range ?? RACK_RADAR.range, clampR = o.clampR ?? RACK_RADAR.clampR;
  const { boat } = o;
  const marks: RadarMark[] = [];
  const pierLoc = rackWorldToRadar(o.pier.x - boat.x, o.pier.z - boat.z, boat.h);
  const pier = radarClamp(pierLoc.x, pierLoc.y, clampR);
  const axis = rackWorldToRadar(1, 0, boat.h);
  marks.push({ kind: 'pier', ...pier, rot: Math.atan2(axis.y, axis.x) });
  for (const r of o.racks) {
    const loc = rackWorldToRadar(r.x - boat.x, r.z - boat.z, boat.h);
    const st = rackBeaconState(r, o.me, o.now);
    if (st !== 'none') {
      marks.push({ kind: st === 'ripe' ? 'mineRipe' : 'mineGrow', ...radarClamp(loc.x, loc.y, clampR) });
    } else if (Math.hypot(loc.x, loc.y) <= range) {
      marks.push({ kind: isPrivate(r) ? 'other' : 'public', x: loc.x, y: loc.y, dist: Math.hypot(loc.x, loc.y), clamped: false });
    }
  }
  return marks;
}

/** 把標記畫到正方形 canvas（呼叫端已依 DPR 設好寬高） */
export function paintRackRadar(ctx: CanvasRenderingContext2D, size: number, marks: readonly RadarMark[], range = RACK_RADAR.range) {
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  const pad = Math.max(6, size * 0.07);
  const sc = (cx - pad) / Math.max(1, range);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, cx - 0.5, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = Math.max(1, size * 0.01);
  for (const r of RACK_RADAR.rings) {
    ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(cx, pad); ctx.lineTo(cx, size - pad); ctx.moveTo(pad, cy); ctx.lineTo(size - pad, cy); ctx.stroke();

  const px = (m: RadarMark) => cx + m.x * sc;
  const py = (m: RadarMark) => cy + m.y * sc;

  for (const m of marks) {
    if (m.kind !== 'public' && m.kind !== 'other') continue;
    const x = px(m), y = py(m), r = Math.max(1.6, size * 0.018);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = m.kind === 'public' ? 'rgba(230,236,242,0.55)' : 'rgba(196,150,120,0.55)';
    ctx.fill();
  }

  const pier = marks.find(m => m.kind === 'pier');
  if (pier) {
    const x = px(pier), y = py(pier);
    const w = Math.max(9, size * 0.1), h = Math.max(4, size * 0.042);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(pier.rot ?? 0);
    ctx.fillStyle = '#d4b896';
    ctx.strokeStyle = 'rgba(40,28,16,0.7)';
    ctx.lineWidth = Math.max(1, size * 0.012);
    rounded(ctx, -w / 2, -h / 2, w, h, 1.5); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (pier.clamped) {
      ctx.font = `800 ${Math.max(8, Math.round(size * 0.09))}px system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, size * 0.03);
      ctx.strokeStyle = 'rgba(12,22,36,0.85)'; ctx.fillStyle = '#f3e6d0';
      const ox = Math.hypot(pier.x, pier.y) > 1e-6 ? (-pier.x / Math.hypot(pier.x, pier.y)) * (h + size * 0.07) : 0;
      const oy = Math.hypot(pier.x, pier.y) > 1e-6 ? (-pier.y / Math.hypot(pier.x, pier.y)) * (h + size * 0.07) : -h - size * 0.07;
      ctx.strokeText('碼', x + ox, y + oy); ctx.fillText('碼', x + ox, y + oy);
    }
  }

  for (const m of marks) {
    if (m.kind !== 'mineGrow' && m.kind !== 'mineRipe') continue;
    const x = px(m), y = py(m), r = Math.max(3.6, size * 0.042);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = m.kind === 'mineRipe' ? '#fbbf24' : '#38bdf8';
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, size * 0.016);
    ctx.strokeStyle = '#0c1624'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, size * 0.01);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  }

  // 船頭永遠朝上：中心小箭頭
  const ah = Math.max(6, size * 0.07), aw = Math.max(4, size * 0.038);
  ctx.beginPath();
  ctx.moveTo(cx, cy - ah); ctx.lineTo(cx + aw, cy + ah * 0.55); ctx.lineTo(cx, cy + ah * 0.18); ctx.lineTo(cx - aw, cy + ah * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#e8f2ff';
  ctx.strokeStyle = 'rgba(12,22,36,0.9)';
  ctx.lineWidth = Math.max(1.2, size * 0.014);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
