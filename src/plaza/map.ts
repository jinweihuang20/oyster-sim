import {
  PILE_COUNT, WALK_BOUND, WALK_BOUND_WEST, TIDAL_FLAT, pileCenter, pileIsGrill, SMOKE_CENTER,
} from './layout';
import { PLAZA_STALL_SITES } from './ambiance';
import { plazaDisplayName, type PlazaPlayer } from './types';

export type PlazaMapMarker = {
  x: number;
  z: number;
  yaw: number;
  nick: string;
  self?: boolean;
  seated?: boolean;
};

/** 地圖世界範圍（含西潮間帶＋北側碼頭） */
const MAP_MIN_X = -WALK_BOUND_WEST - 0.6;
const MAP_MAX_X = WALK_BOUND + 0.6;
const MAP_MIN_Z = -13.6;
const MAP_MAX_Z = WALK_BOUND + 0.6;

const STALL_LABEL: Record<string, string> = {
  bbq: '立烤',
  bbqSit: '坐烤',
  drink: '飲料',
  'drink-s': '飲料',
  snack: '小吃',
  'snack-n': '小吃',
  fruit: '水果',
  'fruit-e': '水果',
  cart: '推車',
  'cart-n': '推車',
  noodle: '麵攤',
  seafood: '海鮮',
  sweet: '甜品',
};

function worldToCanvas(x: number, z: number, size: number, pad: number): [number, number] {
  const span = size - pad * 2;
  // +X 向右；+Z 向下（南／烤區在下、北／碼頭在上）
  const u = (x - MAP_MIN_X) / (MAP_MAX_X - MAP_MIN_X);
  const v = (z - MAP_MIN_Z) / (MAP_MAX_Z - MAP_MIN_Z);
  return [pad + u * span, pad + v * span];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 畫廣場俯視圖：場景示意＋玩家 */
export function drawPlazaMap(
  canvas: HTMLCanvasElement,
  markers: PlazaMapMarker[],
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const css = Math.min(canvas.clientWidth || 320, canvas.clientHeight || 320);
  const size = Math.max(220, Math.floor(css * dpr));
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pad = size * 0.06;
  const to = (x: number, z: number) => worldToCanvas(x, z, size, pad);

  // 背景
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size * 0.5, size * 0.45, size * 0.1, size * 0.5, size * 0.5, size * 0.7);
  g.addColorStop(0, '#3a4a38');
  g.addColorStop(1, '#1a2218');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // 潮間帶／養殖預留（西）
  {
    const [x0, y0] = to(TIDAL_FLAT.xOuter, TIDAL_FLAT.zMin);
    const [x1, y1] = to(TIDAL_FLAT.xInner, TIDAL_FLAT.zMax);
    const l = Math.min(x0, x1), t = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
    ctx.fillStyle = 'rgba(70,90,78,.55)';
    ctx.fillRect(l, t, w, h);
    // 外側淺水
    const [wx0, wy0] = to(TIDAL_FLAT.xOuter, TIDAL_FLAT.zMin);
    const [wx1, wy1] = to(TIDAL_FLAT.xInner - Math.abs(TIDAL_FLAT.xInner - TIDAL_FLAT.xOuter) * 0.38, TIDAL_FLAT.zMax);
    const wl = Math.min(wx0, wx1), wt = Math.min(wy0, wy1), ww = Math.abs(wx1 - wx0), wh = Math.abs(wy1 - wy0);
    ctx.fillStyle = 'rgba(50,110,120,.45)';
    ctx.fillRect(wl, wt, ww, wh);
    ctx.fillStyle = 'rgba(210,230,200,.85)';
    ctx.font = `700 ${Math.max(10, size * 0.03)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('潮間帶', l + w * 0.55, t + h * 0.45);
    ctx.font = `600 ${Math.max(9, size * 0.024)}px system-ui,sans-serif`;
    ctx.fillStyle = 'rgba(190,210,180,.75)';
    ctx.fillText('養殖預留', l + w * 0.55, t + h * 0.58);
  }

  // 走動界（西緣延伸）
  {
    const [x0, y0] = to(-WALK_BOUND_WEST, -WALK_BOUND);
    const [x1, y1] = to(WALK_BOUND, WALK_BOUND);
    const l = Math.min(x0, x1), t = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = Math.max(1, size * 0.004);
    ctx.setLineDash([size * 0.012, size * 0.01]);
    ctx.strokeRect(l, t, w, h);
    ctx.setLineDash([]);
  }

  // 碼頭示意（世界 -Z；佈局位置不變）
  {
    const [x0, y0] = to(-10, -11.2);
    const [x1, y1] = to(10, -13.4);
    const l = Math.min(x0, x1), t = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
    ctx.fillStyle = 'rgba(90,100,108,.55)';
    ctx.fillRect(l, t, w, h);
    ctx.fillStyle = 'rgba(200,210,220,.75)';
    ctx.font = `700 ${Math.max(10, size * 0.032)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('碼頭', l + w / 2, t + h / 2);
  }

  // 蚵堆／烤台
  const mapSpanX = MAP_MAX_X - MAP_MIN_X;
  for (let i = 0; i < PILE_COUNT; i++) {
    const c = pileCenter(i);
    const [mx, my] = to(c.x, c.z);
    const r = (1.05 / mapSpanX) * (size - pad * 2) * 0.92;
    const grill = pileIsGrill(i);
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fillStyle = grill ? 'rgba(180,90,40,.72)' : 'rgba(70,78,62,.85)';
    ctx.fill();
    ctx.strokeStyle = grill ? 'rgba(255,180,90,.7)' : 'rgba(180,200,160,.35)';
    ctx.lineWidth = Math.max(1, size * 0.003);
    ctx.stroke();
    ctx.fillStyle = grill ? '#ffe0b0' : 'rgba(230,240,210,.7)';
    ctx.font = `700 ${Math.max(9, size * 0.028)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(grill ? `烤${i - 11}` : `${i + 1}`, mx, my);
  }

  // 攤位
  ctx.font = `700 ${Math.max(9, size * 0.026)}px system-ui,sans-serif`;
  for (const s of PLAZA_STALL_SITES) {
    const [mx, my] = to(s.x, s.z);
    const rw = (s.radius / mapSpanX) * (size - pad * 2) * 0.55;
    const rh = rw * 0.7;
    ctx.fillStyle = 'rgba(40,28,16,.82)';
    roundRect(ctx, mx - rw, my - rh, rw * 2, rh * 2, size * 0.012);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,149,43,.75)';
    ctx.lineWidth = Math.max(1, size * 0.0025);
    ctx.stroke();
    ctx.fillStyle = '#ffe6b0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(STALL_LABEL[s.id] || s.kind, mx, my);
  }

  // 吸菸區
  {
    const [mx, my] = to(SMOKE_CENTER.x, SMOKE_CENTER.z);
    const rw = Math.max(8, size * 0.028);
    ctx.fillStyle = 'rgba(32,56,72,.78)';
    roundRect(ctx, mx - rw * 1.6, my - rw * 0.7, rw * 3.2, rw * 1.4, size * 0.01);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,90,134,.9)';
    ctx.lineWidth = Math.max(1, size * 0.0025);
    ctx.stroke();
    ctx.fillStyle = '#e8f2fa';
    ctx.font = `700 ${Math.max(9, size * 0.026)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('吸菸區', mx, my);
  }

  // 玩家（別人先、自己後）
  const others = markers.filter(m => !m.self);
  const me = markers.find(m => m.self);
  const drawMarker = (m: PlazaMapMarker) => {
    const [mx, my] = to(m.x, m.z);
    // 遠端只留小點；自己稍大一點
    const rad = Math.max(2.5, size * (m.self ? 0.014 : 0.009));
    ctx.beginPath();
    ctx.arc(mx, my, rad + (m.self ? 1.5 : 1), 0, Math.PI * 2);
    ctx.fillStyle = m.self ? 'rgba(80,200,255,.35)' : 'rgba(0,0,0,.28)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my, rad, 0, Math.PI * 2);
    ctx.fillStyle = m.self ? '#5ad0ff' : m.seated ? '#ffb060' : '#ff7a6a';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, size * (m.self ? 0.0025 : 0.0018));
    ctx.stroke();
    // 名字／視角箭頭：只有自己顯示
    if (!m.self) return;
    const ahead = 0.55;
    const [ax, ay] = to(m.x - Math.sin(m.yaw) * ahead, m.z - Math.cos(m.yaw) * ahead);
    const dx = ax - mx, dy = ay - my;
    const dl = Math.hypot(dx, dy) || 1;
    const len = rad * 1.8;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + (dx / dl) * len, my + (dy / dl) * len);
    ctx.strokeStyle = '#e8ffff';
    ctx.lineWidth = Math.max(1.5, size * 0.0035);
    ctx.stroke();
    ctx.font = `800 ${Math.max(10, size * 0.028)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = Math.max(2, size * 0.006);
    ctx.strokeStyle = 'rgba(10,8,4,.75)';
    ctx.strokeText('你', mx, my - rad - 2);
    ctx.fillStyle = '#c8f4ff';
    ctx.fillText('你', mx, my - rad - 2);
  };
  for (const m of others) drawMarker(m);
  if (me) drawMarker(me);

  // 指南
  ctx.fillStyle = 'rgba(255,246,216,.55)';
  ctx.font = `600 ${Math.max(9, size * 0.024)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('北 ↑ 碼頭', size / 2, pad * 0.85);
  ctx.textAlign = 'left';
  ctx.fillText('西', pad * 0.35, size / 2);
  ctx.textAlign = 'right';
  ctx.fillText('東', size - pad * 0.35, size / 2);
  ctx.textAlign = 'center';
  ctx.fillText('南 ↓ 烤區', size / 2, size - pad * 0.25);
}

/** 從 snapshot＋本機座標組標記（略過阿婆） */
export function buildPlazaMapMarkers(
  players: PlazaPlayer[],
  self: { pid: string; x: number; z: number; yaw: number; seated: boolean; nick: string },
): PlazaMapMarker[] {
  const out: PlazaMapMarker[] = [];
  let sawSelf = false;
  for (const p of players) {
    if (p.isNpc) continue;
    const isSelf = p.pid === self.pid;
    if (isSelf) {
      sawSelf = true;
      out.push({
        x: self.x, z: self.z, yaw: self.yaw,
        nick: plazaDisplayName(self.nick, p.tag),
        self: true,
        seated: self.seated,
      });
      continue;
    }
    out.push({
      x: p.x, z: p.z, yaw: p.yaw,
      nick: plazaDisplayName(p.nick, p.tag),
      seated: p.seated,
    });
  }
  if (!sawSelf) {
    out.push({
      x: self.x, z: self.z, yaw: self.yaw,
      nick: self.nick || '你',
      self: true,
      seated: self.seated,
    });
  }
  return out;
}
