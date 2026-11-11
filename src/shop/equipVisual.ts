import * as THREE from 'three';
import { rbox, rcyl, crease } from '../core/geo';
import type { PlayerRig } from '../dm/character';
import { rebuildAvatarMerged } from '../dm/avatarMerge';

/** 服飾視覺（與 main EQUIP id 對齊；只負責外觀） */
export type EquipVis = {
  slot: 'head' | 'hand' | 'body' | 'legs' | 'feet';
  id: string;
  base: string;
  pat: 'plain' | 'flower' | 'rain' | 'camo' | 'neon' | 'tattoo' | 'dragon' | 'karakusa';
};

export type OutfitIds = {
  head: string;
  hand: string;
  body: string;
  legs: string;
  feet: string;
};

/** 全服飾 id 白名單（server／client 共用語意） */
export const EQUIP_VIS: EquipVis[] = [
  { slot: 'head', id: 'hd_basic', base: '#c84a5a', pat: 'flower' },
  { slot: 'head', id: 'hd_hat', base: '#d8b46a', pat: 'plain' },
  { slot: 'head', id: 'hd_fisher', base: '#4a6a8a', pat: 'plain' },
  { slot: 'head', id: 'hd_helmet', base: '#ffb21a', pat: 'plain' },
  { slot: 'head', id: 'hd_crown', base: '#e8b830', pat: 'dragon' },
  { slot: 'hand', id: 'hn_basic', base: '#3a5a8a', pat: 'plain' },
  { slot: 'hand', id: 'sl_flower', base: '#e86a8a', pat: 'flower' },
  { slot: 'hand', id: 'sl_rain', base: '#ffd21a', pat: 'rain' },
  { slot: 'hand', id: 'sl_89', base: '#d9a77a', pat: 'tattoo' },
  { slot: 'hand', id: 'sl_camo', base: '#5a6b3a', pat: 'camo' },
  { slot: 'hand', id: 'sl_neon', base: '#39ff9a', pat: 'neon' },
  { slot: 'hand', id: 'sl_dragon', base: '#8a1420', pat: 'dragon' },
  { slot: 'body', id: 'bd_basic', base: '#e8e4d8', pat: 'plain' },
  { slot: 'body', id: 'bd_rain', base: '#ffd21a', pat: 'rain' },
  { slot: 'body', id: 'bd_vest', base: '#c82a2a', pat: 'plain' },
  { slot: 'body', id: 'bd_boss', base: '#1e2a3a', pat: 'tattoo' },
  { slot: 'body', id: 'bd_sequin', base: '#b84ad8', pat: 'neon' },
  { slot: 'body', id: 'bd_bikini', base: '#e84a5c', pat: 'flower' },
  { slot: 'legs', id: 'lg_basic', base: '#4a4a52', pat: 'plain' },
  { slot: 'legs', id: 'lg_rain', base: '#ffd21a', pat: 'rain' },
  { slot: 'legs', id: 'lg_flower', base: '#e86a8a', pat: 'flower' },
  { slot: 'legs', id: 'lg_camo', base: '#5a6b3a', pat: 'camo' },
  { slot: 'feet', id: 'ft_basic', base: '#2a5ab0', pat: 'plain' },
  { slot: 'feet', id: 'ft_boots', base: '#ffd21a', pat: 'plain' },
  { slot: 'feet', id: 'ft_work', base: '#6a4a2a', pat: 'plain' },
  { slot: 'feet', id: 'ft_gold', base: '#e8b830', pat: 'plain' },
  { slot: 'head', id: 'hd_straw', base: '#d2a85a', pat: 'plain' },
  { slot: 'head', id: 'hd_purple', base: '#6a2a78', pat: 'flower' },
  { slot: 'hand', id: 'sl_redflower', base: '#c4282e', pat: 'flower' },
  { slot: 'body', id: 'bd_singlet', base: '#f4f0e8', pat: 'plain' },
  { slot: 'body', id: 'bd_hawaii', base: '#1e8a7a', pat: 'flower' },
  { slot: 'legs', id: 'lg_rolled', base: '#6a6248', pat: 'plain' },
  { slot: 'feet', id: 'ft_greenboots', base: '#2f8a3a', pat: 'plain' },
  { slot: 'feet', id: 'ft_redslipper', base: '#d4302a', pat: 'plain' },
  { slot: 'head', id: 'hd_karakusa', base: '#e8e2d4', pat: 'karakusa' },
  { slot: 'hand', id: 'sl_nightwrap', base: '#1a1c22', pat: 'plain' },
  { slot: 'body', id: 'bd_nightshort', base: '#24344c', pat: 'plain' },
  { slot: 'legs', id: 'lg_tied', base: '#2a3040', pat: 'plain' },
  { slot: 'feet', id: 'ft_tabi', base: '#1a1c22', pat: 'plain' },
  { slot: 'head', id: 'hd_none', base: '#e8bc98', pat: 'plain' },
  { slot: 'hand', id: 'hn_none', base: '#e8bc98', pat: 'plain' },
  { slot: 'body', id: 'bd_none', base: '#e8bc98', pat: 'plain' },
  { slot: 'legs', id: 'lg_none', base: '#e8bc98', pat: 'plain' },
  { slot: 'feet', id: 'ft_none', base: '#e8bc98', pat: 'plain' },
];

const BY_ID = new Map(EQUIP_VIS.map(e => [e.id, e]));
const DEFAULTS: OutfitIds = {
  head: 'hd_basic', hand: 'hn_basic', body: 'bd_basic', legs: 'lg_basic', feet: 'ft_basic',
};

const NONE_OF: OutfitIds = { head: 'hd_none', hand: 'hn_none', body: 'bd_none', legs: 'lg_none', feet: 'ft_none' };

function aliasEquipId(slot: keyof OutfitIds, id?: string) {
  if (!id) return id;
  if (id === 'none') return NONE_OF[slot];
  if (slot === 'body' && id === 'bd_nude') return 'bd_none';
  return id;
}

export function isNoneId(id?: string | null) {
  return !!id && (id === 'none' || id.endsWith('_none'));
}

export function normalizeOutfitIds(raw?: Partial<OutfitIds> | null): OutfitIds {
  const pick = (slot: keyof OutfitIds, id?: string) => {
    const mapped = aliasEquipId(slot, id);
    const e = mapped ? BY_ID.get(mapped) : undefined;
    return e && e.slot === slot ? e.id : DEFAULTS[slot];
  };
  return {
    head: pick('head', raw?.head),
    hand: pick('hand', raw?.hand),
    body: pick('body', raw?.body),
    legs: pick('legs', raw?.legs),
    feet: pick('feet', raw?.feet),
  };
}

export function outfitKey(o: OutfitIds) {
  return `${o.head}|${o.hand}|${o.body}|${o.legs}|${o.feet}`;
}

/** 頭盔/帽子超出髮蓋頂的高度（公尺）；寵物疊坐頭頂時要往上讓這個量，不然會被擋住 */
const HEAD_TOP_LIFT: Record<string, number> = {
  hd_hat: 0.18,     // 斗笠
  hd_fisher: 0.14,  // 漁夫帽
  hd_helmet: 0.12,  // 工地安全帽
  hd_crown: 0.18,   // 廟會金冠
  hd_straw: 0.18,   // 竹編草帽
};
export function headTopLift(headId: string): number {
  return HEAD_TOP_LIFT[headId] ?? 0;
}

const REPEAT: Record<string, [number, number]> = {
  hd_basic: [2, 2],
  sl_flower: [2, 2],
  lg_flower: [2, 3],
  sl_dragon: [1, 2],
  sl_89: [1, 2],
  bd_sequin: [3, 4],
  sl_neon: [1, 3],
  bd_boss: [1, 2],
  bd_rain: [1, 2],
  sl_rain: [1, 2],
  lg_rain: [1, 2],
  sl_camo: [2, 2],
  lg_camo: [2, 3],
  hn_basic: [1, 3],
  bd_basic: [1, 2],
  lg_basic: [1, 3],
  bd_vest: [1, 1],
  bd_bikini: [1, 1],
  bd_none: [1, 1],
  hd_purple: [2, 2],
  sl_redflower: [2, 2],
  bd_hawaii: [2, 3],
  hd_straw: [1, 2],
  bd_singlet: [1, 2],
  lg_rolled: [1, 3],
  hd_karakusa: [2, 2],
  sl_nightwrap: [1, 3],
  bd_nightshort: [1, 2],
  lg_tied: [1, 3],
  ft_tabi: [1, 1],
};

function wrapDot(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, W: number, H: number) {
  g.fillStyle = col;
  for (const ox of [-W, 0, W]) {
    for (const oy of [-H, 0, H]) {
      const px = x + ox, py = y + oy;
      if (px < -r || py < -r || px > W + r || py > H + r) continue;
      g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
    }
  }
}

function drawFlower(g: CanvasRenderingContext2D, x: number, y: number, s: number, petal: string, center: string, W: number, H: number) {
  for (let k = 0; k < 5; k++) {
    const a = k * 1.256637;
    wrapDot(g, x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.52, petal, W, H);
  }
  wrapDot(g, x, y, s * 0.36, center, W, H);
}

function drawFloral(g: CanvasRenderingContext2D, base: string, W: number, H: number) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const petals = ['#fff3c8', '#ffe8d4', '#fff8e8'];
  const centers = ['#2f7a38', '#d8a020', '#c04040'];
  for (let i = 0; i < 18; i++) {
    const x = (i * 47 + 18) % W;
    const y = (i * 71 + 22) % H;
    const s = 4.2 + (i % 3) * 1.3;
    drawFlower(g, x, y, s, petals[i % 3], centers[i % 3], W, H);
  }
  g.fillStyle = 'rgba(50,110,50,.55)';
  for (let i = 0; i < 12; i++) {
    const x = (i * 53 + 8) % W, y = (i * 41 + 30) % H;
    g.beginPath(); g.ellipse(x, y, 3.2, 1.4, i * 0.7, 0, 7); g.fill();
  }
}

function drawPurpleFloral(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#6a2a78'; g.fillRect(0, 0, W, H);
  const petals = ['#e8b8e0', '#f2d4f0', '#fff0c8'];
  const centers = ['#f0d060', '#c04070', '#ffe8a0'];
  for (let i = 0; i < 16; i++) {
    const x = (i * 47 + 18) % W;
    const y = (i * 71 + 22) % H;
    const s = 4.4 + (i % 3) * 1.2;
    drawFlower(g, x, y, s, petals[i % 3], centers[i % 3], W, H);
  }
}

function drawBigRedFloral(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#c4282e'; g.fillRect(0, 0, W, H);
  const petals = ['#fff3c8', '#ffe0a0', '#fff8e8'];
  const centers = ['#2f7a38', '#f0d020'];
  for (let i = 0; i < 10; i++) {
    const x = (i * 61 + 22) % W;
    const y = (i * 53 + 18) % H;
    drawFlower(g, x, y, 7.5 + (i % 2) * 1.8, petals[i % 3], centers[i % 2], W, H);
  }
  g.fillStyle = 'rgba(40,110,40,.5)';
  for (let i = 0; i < 8; i++) {
    const x = (i * 53 + 8) % W, y = (i * 41 + 30) % H;
    g.beginPath(); g.ellipse(x, y, 4.2, 1.8, i * 0.7, 0, 7); g.fill();
  }
}

function drawHawaiiFloral(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#1e8a7a'; g.fillRect(0, 0, W, H);
  const petals = ['#e85040', '#f0c030', '#f078a0', '#fff3c8'];
  const centers = ['#f0d060', '#c04040', '#ffe8a0'];
  for (let i = 0; i < 12; i++) {
    const x = (i * 53 + 16) % W;
    const y = (i * 67 + 20) % H;
    drawFlower(g, x, y, 6.2 + (i % 3) * 1.6, petals[i % 4], centers[i % 3], W, H);
  }
  g.fillStyle = '#2a6a38';
  for (let i = 0; i < 10; i++) {
    const x = (i * 49 + 10) % W, y = (i * 37 + 24) % H;
    g.beginPath(); g.ellipse(x, y, 5.2, 2.1, i * 0.55, 0, 7); g.fill();
  }
}

function drawStrawWeave(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#d2a85a'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8) {
    g.fillStyle = y % 16 === 0 ? '#c49848' : '#e0bc70';
    g.fillRect(0, y, W, 5);
    g.fillStyle = '#8a5a24';
    g.fillRect(0, y + 5, W, 1);
  }
  g.strokeStyle = 'rgba(90,55,20,.4)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 10) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14, H); g.stroke();
    g.beginPath(); g.moveTo(x + 14, 0); g.lineTo(x, H); g.stroke();
  }
}

function drawBamboo(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#d8b46a'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 10) {
    g.fillStyle = y % 20 === 0 ? '#c4a05a' : '#e0c078';
    g.fillRect(0, y, W, 6);
    g.fillStyle = '#8a6a2a';
    g.fillRect(0, y + 6, W, 1);
  }
  g.strokeStyle = 'rgba(90,70,30,.35)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 16) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, H); g.stroke();
  }
}

function drawRain(g: CanvasRenderingContext2D, base: string, W: number, H: number) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,251,224,.22)';
  g.fillRect(0, 0, W * 0.18, H);
  g.strokeStyle = 'rgba(180,140,20,.55)';
  g.lineWidth = 2;
  for (let y = 16; y < H; y += 28) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  g.fillStyle = '#e8e6d8';
  g.fillRect(0, H * 0.42, W, 7);
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(0, H * 0.42 + 2, W, 2);
}

function drawCamo(g: CanvasRenderingContext2D, base: string, W: number, H: number) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const cols = ['#2e3a1e', '#3e5228', '#8a7a4a', '#6a5a32'];
  const blob = (x: number, y: number, rx: number, ry: number, col: string, rot: number) => {
    g.fillStyle = col;
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill();
  };
  for (let i = 0; i < 22; i++) {
    blob((i * 41 + 10) % W, (i * 29 + 14) % H, 14 + (i % 4) * 4, 9 + (i % 3) * 3, cols[i % 4], i * 0.5);
  }
}

function drawNeon(g: CanvasRenderingContext2D, base: string, W: number, H: number) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e8f8f0';
  g.fillRect(0, H * 0.38, W, 14);
  g.fillRect(0, H * 0.62, W, 5);
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.fillRect(0, 0, W * 0.12, H);
}

function drawTattoo(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#d9a77a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1e2a4a';
  g.lineWidth = 3;
  g.beginPath();
  for (let x = 0; x <= W; x += 4) g.lineTo(x, 28 + Math.sin(x / 11) * 10);
  g.stroke();
  g.beginPath();
  for (let x = 0; x <= W; x += 4) g.lineTo(x, H - 24 + Math.sin(x / 9 + 1) * 8);
  g.stroke();
  g.fillStyle = '#b8323a';
  g.beginPath(); g.arc(40, 56, 11, 0, 7); g.fill();
  g.fillStyle = '#2a4a2a';
  g.beginPath(); g.ellipse(48, 64, 10, 4, 0.6, 0, 7); g.fill();
  g.fillStyle = '#1e2a4a';
  g.font = 'bold 28px sans-serif';
  g.fillText('89', 70, 80);
  g.strokeStyle = '#1e2a4a';
  g.lineWidth = 2;
  g.beginPath(); g.arc(96, 100, 18, Math.PI, 2 * Math.PI); g.stroke();
}

function drawDragon(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#8a1420'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#6e1018';
  for (let y = 8; y < H; y += 16) {
    for (let x = (y % 32 === 8 ? 8 : 0); x < W; x += 16) {
      g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
    }
  }
  g.strokeStyle = '#ffd25a';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(8, H * 0.72);
  g.bezierCurveTo(30, 20, 70, H - 10, 100, 36);
  g.lineTo(118, 22);
  g.stroke();
  g.lineWidth = 2;
  g.strokeStyle = '#fff3a8';
  g.beginPath();
  g.moveTo(10, H * 0.72);
  g.bezierCurveTo(32, 24, 68, H - 14, 98, 38);
  g.stroke();
  g.fillStyle = '#ffd25a';
  g.beginPath(); g.ellipse(112, 20, 10, 7, -0.5, 0, 7); g.fill();
  g.fillStyle = '#c82a2a';
  g.beginPath(); g.arc(116, 18, 2.2, 0, 7); g.fill();
  g.strokeStyle = '#e8b830';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = 16 + t * 80;
    const y = H * 0.72 * (1 - t) + 36 * t + Math.sin(t * 6) * 16;
    g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 3, y); g.lineTo(x, y + 6); g.stroke();
  }
}

function drawSequin(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#8a2cb0'; g.fillRect(0, 0, W, H);
  const cols = ['#e8b8ff', '#ffd8f8', '#f0c8ff', '#d070e8', '#fff6dc'];
  const step = 10;
  for (let y = 4; y < H; y += step) {
    for (let x = 4 + ((y / step) % 2 === 0 ? 0 : 5); x < W; x += step) {
      g.fillStyle = cols[(x + y) % cols.length];
      g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.beginPath(); g.arc(x - 1, y - 1.2, 1.1, 0, 7); g.fill();
    }
  }
}

function drawWornTee(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(200,180,140,.2)';
  g.fillRect(0, 0, W, 18);
  g.fillStyle = 'rgba(170,150,120,.16)';
  g.beginPath(); g.ellipse(90, 88, 22, 14, 0.4, 0, 7); g.fill();
  g.strokeStyle = 'rgba(140,130,110,.35)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(W / 2, 20); g.lineTo(W / 2, H); g.stroke();
}

function drawWorkPants(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#4a4a52'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#8a8a92';
  g.lineWidth = 1.4;
  g.setLineDash([4, 3]);
  g.beginPath(); g.moveTo(18, 0); g.lineTo(18, H); g.stroke();
  g.beginPath(); g.moveTo(W - 18, 0); g.lineTo(W - 18, H); g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(90,90,100,.45)';
  g.fillRect(28, 40, 36, 28);
  g.strokeStyle = '#2e2e34';
  g.strokeRect(28, 40, 36, 28);
}

function drawBoss(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#1e2a3a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(200,200,210,.12)';
  g.lineWidth = 1;
  for (let x = 6; x < W; x += 10) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
}

function drawLeather(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(40,24,12,.18)';
  for (let y = 0; y < H; y += 12) g.fillRect(0, y, W, 3);
}

function drawBikiniCloth(g: CanvasRenderingContext2D, W: number, H: number) {
  drawFloral(g, '#e84a5c', W, H);
}

function drawNudeTape(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#e8bc98'; g.fillRect(0, 0, W, H);
  const xAt = (cx: number, cy: number, s: number) => {
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy + s); g.stroke();
    g.beginPath(); g.moveTo(cx + s, cy - s); g.lineTo(cx - s, cy + s); g.stroke();
  };
  xAt(W * 0.34, H * 0.38, 13);
  xAt(W * 0.66, H * 0.38, 13);
}

function drawUnderwear(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#e8bc98'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d8d0c4';
  g.fillRect(0, 0, W, H * 0.38);
  g.fillStyle = '#eee8dc';
  g.fillRect(0, 0, W, 10);
}

function drawPlainShade(g: CanvasRenderingContext2D, base: string, W: number, H: number) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fillRect(0, 0, W, 8);
  g.fillStyle = 'rgba(0,0,0,.08)';
  g.fillRect(0, H - 10, W, 10);
}

/** 畫裝備花紋（第一人稱袖套與 3D 貼圖共用） */

function drawKarakusa(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#e8e2d4';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1e3358';
  g.lineWidth = Math.max(2, W / 64);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const rows = 6;
  for (let row = 0; row < rows; row++) {
    const y0 = (row + 0.45) * (H / rows);
    g.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = y0 + Math.sin((x / W) * Math.PI * 2 + row * 0.9) * (H / 18);
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    for (let i = 0; i < 5; i++) {
      const x = (i + 0.35) * (W / 5);
      const y = y0 + Math.sin((x / W) * Math.PI * 2 + row * 0.9) * (H / 18);
      const s = W / 22;
      g.beginPath();
      g.ellipse(x, y - s * 0.7, s, s * 0.55, -0.7, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(x + s * 1.1, y + s * 0.65, s, s * 0.55, 0.8, 0, Math.PI * 2);
      g.stroke();
    }
  }
}

export function paintEquipCanvas(g: CanvasRenderingContext2D, e: EquipVis, W: number, H: number) {
  switch (e.id) {
    case 'hd_basic':
    case 'sl_flower':
    case 'lg_flower':
      drawFloral(g, e.base, W, H); return;
    case 'hd_purple':
      drawPurpleFloral(g, W, H); return;
    case 'sl_redflower':
      drawBigRedFloral(g, W, H); return;
    case 'bd_hawaii':
      drawHawaiiFloral(g, W, H); return;
    case 'hd_hat':
      drawBamboo(g, W, H); return;
    case 'hd_straw':
      drawStrawWeave(g, W, H); return;
    case 'hd_karakusa':
      drawKarakusa(g, W, H); return;
    case 'sl_rain':
    case 'bd_rain':
    case 'lg_rain':
      drawRain(g, e.base, W, H); return;
    case 'sl_camo':
    case 'lg_camo':
      drawCamo(g, e.base, W, H); return;
    case 'sl_neon':
      drawNeon(g, e.base, W, H); return;
    case 'sl_89':
      drawTattoo(g, W, H); return;
    case 'sl_dragon':
    case 'hd_crown':
      drawDragon(g, W, H); return;
    case 'bd_sequin':
      drawSequin(g, W, H); return;
    case 'bd_bikini':
      drawBikiniCloth(g, W, H); return;
    case 'bd_none':
      drawNudeTape(g, W, H); return;
    case 'lg_none':
      drawUnderwear(g, W, H); return;
    case 'hd_none':
    case 'hn_none':
    case 'ft_none':
      drawPlainShade(g, '#e8bc98', W, H); return;
    case 'bd_basic':
      drawWornTee(g, W, H); return;
    case 'lg_basic':
      drawWorkPants(g, W, H); return;
    case 'lg_rolled':
      drawPlainShade(g, e.base, W, H); return;
    case 'bd_singlet':
      drawPlainShade(g, e.base, W, H); return;
    case 'bd_boss':
      drawBoss(g, W, H); return;
    case 'ft_work':
      drawLeather(g, W, H); return;
    case 'bd_vest':
    case 'hn_basic':
    case 'hd_fisher':
    case 'hd_helmet':
    case 'ft_basic':
    case 'ft_boots':
    case 'ft_gold':
    case 'ft_greenboots':
    case 'ft_redslipper':
      drawPlainShade(g, e.base, W, H); return;
    default:
      drawPlainShade(g, e.base, W, H);
  }
}

const texCache = new Map<string, THREE.CanvasTexture>();
export function makeEqTexture(e: EquipVis): THREE.CanvasTexture {
  let t = texCache.get(e.id);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  paintEquipCanvas(c.getContext('2d')!, e, 128, 128);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const rep = REPEAT[e.id] ?? [2, 3];
  t.repeat.set(rep[0], rep[1]);
  texCache.set(e.id, t);
  return t;
}

function resetSurf(m: THREE.MeshStandardMaterial) {
  m.metalness = 0.02;
  m.roughness = 0.78;
  m.emissive.setHex(0);
  m.emissiveIntensity = 0;
  m.map = null;
}

function paintMat(m: THREE.MeshStandardMaterial, e: EquipVis) {
  resetSurf(m);
  m.map = makeEqTexture(e);
  m.color.set(0xffffff);
  if (e.id === 'sl_neon') {
    m.emissive.setHex(0x1a6a40);
    m.emissiveIntensity = 0.35;
  } else if (e.id === 'bd_sequin') {
    m.emissive.setHex(0x4a1a60);
    m.emissiveIntensity = 0.22;
    m.roughness = 0.42;
    m.metalness = 0.18;
  } else if (e.id === 'sl_dragon' || e.id === 'hd_crown') {
    m.metalness = 0.12;
    m.roughness = 0.55;
  }
  m.needsUpdate = true;
}

function paintSolid(m: THREE.MeshStandardMaterial, hex: string, extra?: { metal?: number; rough?: number }) {
  resetSurf(m);
  m.color.set(hex);
  if (extra?.metal != null) m.metalness = extra.metal;
  if (extra?.rough != null) m.roughness = extra.rough;
  m.needsUpdate = true;
}

function paintFeet(mats: NonNullable<PlayerRig['outfitMats']>, feet: EquipVis) {
  const shoe = mats.feet[0];
  const sole = mats.feet[1];
  if (!shoe || !sole) return;
  if (feet.id === 'ft_none') {
    paintSolid(shoe, '#e8bc98');
    paintSolid(sole, '#e8bc98');
  } else if (feet.id === 'ft_basic') {
    paintSolid(shoe, '#f2f2ee');
    paintSolid(sole, '#e4dfd4');
  } else if (feet.id === 'ft_redslipper') {
    paintSolid(shoe, '#e85a4a');
    paintSolid(sole, '#a82820');
  } else if (feet.id === 'ft_gold') {
    paintSolid(shoe, '#e8c040', { metal: 0.45, rough: 0.35 });
    paintSolid(sole, '#c9a227', { metal: 0.3, rough: 0.45 });
  } else if (feet.id === 'ft_boots' || feet.id === 'ft_greenboots') {
    paintMat(shoe, feet);
    paintSolid(sole, feet.id === 'ft_greenboots' ? '#1a4a20' : '#c49212');
  } else if (feet.id === 'ft_work') {
    paintMat(shoe, feet);
    paintSolid(sole, '#2a1a10');
  } else if (feet.id === 'ft_tabi') {
    paintSolid(shoe, '#1a1c22');
    paintSolid(sole, '#121318');
  } else {
    paintMat(shoe, feet);
    paintMat(sole, feet);
  }
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function G(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function SM(key: string, color: number | string, extra?: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0]) {
  const k = `${key}|${color}|${extra?.map ? 'm' : ''}|${extra?.metalness ?? ''}|${extra?.roughness ?? ''}|${extra?.emissive ?? ''}`;
  let m = matCache.get(k);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color, roughness: 0.75, metalness: 0.04, ...extra,
  });
  matCache.set(k, m);
  return m;
}

function hex(c: string) { return new THREE.Color(c); }

function clearGroup(g: THREE.Group) {
  while (g.children.length) g.remove(g.children[g.children.length - 1]);
}

function ensureDet(parent: THREE.Object3D, key: string): THREE.Group {
  let g = parent.userData[key] as THREE.Group | undefined;
  if (!g || g.parent !== parent) {
    g = new THREE.Group();
    g.name = key;
    parent.add(g);
    parent.userData[key] = g;
  }
  clearGroup(g);
  return g;
}

const DET = {
  body: 'eqBodyDet',
  sleeve: 'eqSleeveDet',
  upper: 'eqUpperDet',
  leg: 'eqLegDet',
  shin: 'eqShinDet',
} as const;

/** 清掉玩家服飾加裝（帽子除外）。阿婆／阿伯套完基本外觀後要呼叫，避免領子、袖套蓋到他們自己的衣服。 */
export function clearOutfitDetails(rig: PlayerRig) {
  const pairs: [THREE.Object3D | undefined, string][] = [
    [rig.torso, DET.body],
    [rig.lowerL, DET.sleeve],
    [rig.lowerR, DET.sleeve],
    [rig.upperL, DET.upper],
    [rig.upperR, DET.upper],
    [rig.legL, DET.leg],
    [rig.legR, DET.leg],
    [rig.shinL, DET.shin],
    [rig.shinR, DET.shin],
  ];
  for (const [p, k] of pairs) {
    if (!p) continue;
    const g = p.userData[k] as THREE.Group | undefined;
    if (g) clearGroup(g);
  }
}

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  p: [number, number, number],
  rot?: [number, number, number],
  cloneMat = false,
) {
  const x = new THREE.Mesh(geo, cloneMat ? mat.clone() : mat);
  x.position.set(...p);
  if (rot) x.rotation.set(...rot);
  x.castShadow = false;
  x.receiveShadow = false;
  parent.add(x);
  return x;
}

function clearHat(hat: THREE.Group) {
  while (hat.children.length) hat.remove(hat.children[hat.children.length - 1]);
}

function buildHat(hat: THREE.Group, head: EquipVis) {
  clearHat(hat);
  if (head.id === 'hd_none') return;
  const addH = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    p: [number, number, number],
    rot?: [number, number, number],
  ) => add(hat, geo, mat, p, rot, true);
  const col = hex(head.base);
  const dark = col.clone().multiplyScalar(0.82);
  const flowerM = SM('hat-fl', 0xffffff, { map: makeEqTexture(head), roughness: 0.8 });
  const solid = (c: THREE.Color | number, key: string, extra?: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0]) =>
    SM(key, typeof c === 'number' ? c : c.getHex(), extra);

  if (head.id === 'hd_hat') {
    const straw = solid(col, 'hat-straw', { map: makeEqTexture(head), roughness: 0.88 });
    const strawD = solid(dark, 'hat-strawD', { roughness: 0.9 });
    const cord = solid(0x5a4030, 'hat-cord', { roughness: 0.92 });
    // 第一片寬緣，阿婆會微調 hatG 位置
    addH(G('douli-brim', () => rcyl(0.40, 0.40, 0.02, 16)), straw, [0, 0.145, 0]);
    addH(G('douli-cone', () => crease(new THREE.ConeGeometry(0.22, 0.15, 12))), strawD, [0, 0.23, 0]);
    addH(G('douli-band', () => rcyl(0.15, 0.15, 0.028, 12)), solid(0x5a4030, 'hat-band'), [0, 0.148, 0]);
    addH(G('cord', () => rbox(0.012, 0.18, 0.012)), cord, [-0.10, 0.04, -0.06], [0.15, 0, 0.32]);
    addH(G('cord', () => rbox(0.012, 0.18, 0.012)), cord, [0.10, 0.04, -0.06], [0.15, 0, -0.32]);
  } else if (head.id === 'hd_straw') {
    const straw = solid(col, 'straw-hat', { map: makeEqTexture(head), roughness: 0.9 });
    const strawD = solid(dark, 'straw-hatD', { roughness: 0.92 });
    const band = solid(0x5a3a18, 'straw-band', { roughness: 0.88 });
    addH(G('straw-brim', () => rcyl(0.48, 0.46, 0.018, 16)), straw, [0, 0.128, 0]);
    addH(G('straw-crown', () => crease(new THREE.ConeGeometry(0.20, 0.10, 12))), strawD, [0, 0.188, 0]);
    addH(G('straw-band', () => rcyl(0.18, 0.18, 0.032, 12)), band, [0, 0.142, 0]);
  } else if (head.id === 'hd_fisher') {
    const navy = solid(col, 'fish-navy', { roughness: 0.72 });
    const navyD = solid(dark, 'fish-navyD', { roughness: 0.74 });
    addH(G('fish-crown', () => rcyl(0.16, 0.172, 0.12, 12)), navy, [0, 0.185, 0]);
    addH(G('fish-top', () => rcyl(0.028, 0.028, 0.02, 8)), navyD, [0, 0.252, 0]);
    addH(G('fish-brim', () => rcyl(0.25, 0.22, 0.028, 14)), navy, [0, 0.118, 0]);
    addH(G('fish-stitch', () => rcyl(0.178, 0.178, 0.008, 12)), navyD, [0, 0.132, 0]);
    addH(G('eyelet', () => rcyl(0.012, 0.012, 0.02, 6)), solid(0x1a2a3a, 'eyelet'), [-0.158, 0.195, 0]);
    addH(G('eyelet', () => rcyl(0.012, 0.012, 0.02, 6)), solid(0x1a2a3a, 'eyelet'), [0.158, 0.195, 0]);
  } else if (head.id === 'hd_helmet') {
    const yel = solid(col, 'helm', { roughness: 0.45, metalness: 0.08 });
    const yelD = solid(dark, 'helmD', { roughness: 0.48, metalness: 0.08 });
    const blk = solid(0x3a3a3a, 'helm-blk', { roughness: 0.7 });
    addH(G('helm-shell', () => crease(new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, 1.35))), yel, [0, 0.145, 0]);
    addH(G('helm-visor', () => rbox(0.22, 0.022, 0.10)), yel, [0, 0.078, -0.16]);
    addH(G('helm-ridge', () => rbox(0.05, 0.04, 0.28)), yelD, [0, 0.225, -0.01]);
    addH(G('helm-slot', () => rbox(0.02, 0.04, 0.055)), blk, [-0.175, 0.15, 0]);
    addH(G('helm-slot', () => rbox(0.02, 0.04, 0.055)), blk, [0.175, 0.15, 0]);
    addH(G('helm-sticker', () => rbox(0.08, 0.03, 0.01)), solid(0xf5f0d0, 'helm-st', { roughness: 0.35 }), [0, 0.16, -0.175]);
    addH(G('helm-strap', () => rbox(0.014, 0.15, 0.014)), blk, [-0.12, 0.02, -0.04], [0.1, 0, 0.35]);
    addH(G('helm-strap', () => rbox(0.014, 0.15, 0.014)), blk, [0.12, 0.02, -0.04], [0.1, 0, -0.35]);
  } else if (head.id === 'hd_crown') {
    const gold = solid(col, 'crown', { roughness: 0.38, metalness: 0.55 });
    const goldD = solid(dark, 'crownD', { roughness: 0.42, metalness: 0.5 });
    const red = solid(0xc82a2a, 'crown-red', { roughness: 0.3, metalness: 0.2 });
    const teal = solid(0x2a8ac8, 'crown-teal', { roughness: 0.3, metalness: 0.2 });
    addH(G('crown-band', () => rcyl(0.155, 0.16, 0.085, 12)), gold, [0, 0.16, 0]);
    addH(G('crown-inner', () => rcyl(0.138, 0.138, 0.06, 10)), solid(0x8a1420, 'crown-in'), [0, 0.16, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI;
      const x = Math.sin(a) * 0.145, z = Math.cos(a) * 0.145;
      addH(G('crown-spike', () => rbox(0.036, 0.13, 0.036)), gold, [x, 0.265, z]);
      addH(G('crown-tip', () => new THREE.SphereGeometry(0.022, 8, 6)), i === 0 ? red : (i % 2 ? teal : goldD), [x, 0.34, z]);
    }
    addH(G('crown-jewel', () => new THREE.SphereGeometry(0.03, 8, 6)), red, [0, 0.175, -0.16]);
    addH(G('crown-tassel', () => rcyl(0.012, 0.008, 0.15, 6)), red, [-0.17, 0.055, 0]);
    addH(G('crown-tassel', () => rcyl(0.012, 0.008, 0.15, 6)), red, [0.17, 0.055, 0]);
  } else {
    // 花布頭巾：第一個小孩是頂蓋，阿婆會把它 Z 向縮小以免蓋住髮髻
    addH(G('scarf-top', () => rbox(0.34, 0.045, 0.32)), flowerM, [0, 0.158, 0.0]);
    addH(G('scarf-front', () => rbox(0.30, 0.055, 0.055)), flowerM, [0, 0.105, -0.148]);
    addH(G('scarf-side', () => rbox(0.055, 0.065, 0.22)), flowerM, [-0.15, 0.12, -0.02]);
    addH(G('scarf-side', () => rbox(0.055, 0.065, 0.22)), flowerM, [0.15, 0.12, -0.02]);
    const knot = solid(dark, 'scarf-knot', { map: makeEqTexture(head), roughness: 0.8 });
    addH(G('scarf-knot', () => rbox(0.07, 0.06, 0.07)), knot, [0.16, 0.10, 0.06], [0, 0.3, 0.35]);
    addH(G('scarf-tail', () => rbox(0.04, 0.14, 0.028)), flowerM, [0.18, 0.01, 0.08], [0.15, 0, 0.4]);
    addH(G('scarf-tail2', () => rbox(0.032, 0.12, 0.024)), flowerM, [0.15, -0.01, 0.10], [0.1, 0, 0.18]);
  }
}

function buildBodyDetails(rig: PlayerRig, body: EquipVis) {
  const g = ensureDet(rig.torso, DET.body);
  const base = hex(body.base);
  const dark = base.clone().multiplyScalar(0.82);
  const texM = SM(`body-${body.id}`, 0xffffff, { map: makeEqTexture(body), roughness: 0.78 });
  const solid = (c: number, key: string, extra?: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0]) =>
    SM(key, c, extra);

  if (body.id === 'bd_basic') {
    add(g, G('tee-neck', () => rcyl(0.085, 0.092, 0.042, 10)), solid(0xd4cbb8, 'tee-neck', { roughness: 0.86 }), [0, 0.35, 0]);
    add(g, G('tee-hem', () => rbox(0.39, 0.024, 0.23)), solid(0xd0c8b4, 'tee-hem', { roughness: 0.86 }), [0, -0.112, 0]);
  } else if (body.id === 'bd_rain') {
    add(g, G('rain-hood', () => rbox(0.28, 0.15, 0.12)), texM, [0, 0.34, 0.145]);
    add(g, G('rain-hood2', () => rcyl(0.12, 0.13, 0.08, 10)), texM, [0, 0.40, 0.155], [0.85, 0, 0]);
    add(g, G('zip', () => rbox(0.018, 0.42, 0.012)), solid(0x3a3a3a, 'zip'), [0, 0.12, -0.118]);
    add(g, G('zip-pull', () => rbox(0.03, 0.04, 0.02)), solid(0xc8c8c8, 'zip-pull', { metalness: 0.4, roughness: 0.4 }), [0, 0.28, -0.122]);
    const stripe = solid(0xe8e6d8, 'rain-ref', { roughness: 0.4, metalness: 0.15 });
    add(g, G('ref-stripe', () => rbox(0.36, 0.028, 0.01)), stripe, [0, 0.22, -0.118]);
    add(g, G('ref-stripe', () => rbox(0.36, 0.028, 0.01)), stripe, [0, 0.02, -0.118]);
  } else if (body.id === 'bd_vest') {
    const cream = solid(0xf2efe4, 'vest-in', { roughness: 0.88 });
    const gold = solid(0xe8b830, 'vest-gold', { roughness: 0.4, metalness: 0.45 });
    add(g, G('vest-in', () => rbox(0.145, 0.44, 0.03)), cream, [0, 0.12, -0.118]);
    add(g, G('vest-trim', () => rbox(0.016, 0.44, 0.016)), gold, [-0.07, 0.12, -0.132]);
    add(g, G('vest-trim', () => rbox(0.016, 0.44, 0.016)), gold, [0.07, 0.12, -0.132]);
    add(g, G('vest-waist', () => rbox(0.36, 0.03, 0.02)), gold, [0, -0.06, -0.118]);
    const btn = G('vest-btn', () => rcyl(0.012, 0.012, 0.01, 6));
    for (const y of [0.26, 0.14, 0.02, -0.08]) {
      add(g, btn, gold, [-0.07, y, -0.142]);
      add(g, btn, gold, [0.07, y, -0.142]);
    }
  } else if (body.id === 'bd_boss') {
    const navy = texM;
    const navyL = solid(0x2e3e52, 'boss-L', { roughness: 0.7 });
    const navyD = solid(0x141c28, 'boss-D', { roughness: 0.72 });
    add(g, G('boss-col', () => rbox(0.12, 0.08, 0.075)), navyL, [-0.08, 0.345, -0.08], [0.22, 0.18, 0.28]);
    add(g, G('boss-col', () => rbox(0.12, 0.08, 0.075)), navyL, [0.08, 0.345, -0.08], [0.22, -0.18, -0.28]);
    add(g, G('zip', () => rbox(0.016, 0.40, 0.012)), solid(0xb0b4b8, 'boss-zip', { metalness: 0.45, roughness: 0.4 }), [0, 0.10, -0.118]);
    add(g, G('boss-pk', () => rbox(0.10, 0.08, 0.03)), navyD, [-0.12, -0.02, -0.125]);
    add(g, G('boss-flap', () => rbox(0.10, 0.025, 0.035)), navyL, [-0.12, 0.025, -0.128]);
    add(g, G('boss-pk', () => rbox(0.10, 0.08, 0.03)), navyD, [0.12, -0.02, -0.125]);
    add(g, G('boss-flap', () => rbox(0.10, 0.025, 0.035)), navyL, [0.12, 0.025, -0.128]);
    void navy;
  } else if (body.id === 'bd_sequin') {
    const gold = solid(0xffd25a, 'seq-gold', { roughness: 0.35, metalness: 0.5 });
    add(g, G('seq-neck', () => rbox(0.22, 0.02, 0.02)), gold, [0, 0.345, -0.118]);
    add(g, G('seq-v', () => rbox(0.02, 0.10, 0.02)), gold, [-0.10, 0.30, -0.118], [0, 0, 0.4]);
    add(g, G('seq-v', () => rbox(0.02, 0.10, 0.02)), gold, [0.10, 0.30, -0.118], [0, 0, -0.4]);
    add(g, G('seq-waist', () => rbox(0.36, 0.03, 0.015)), gold, [0, -0.04, -0.118]);
  } else if (body.id === 'bd_bikini') {
    const flor = SM('bikini-flor', 0xffffff, { map: makeEqTexture(body), roughness: 0.72 });
    const white = solid(0xf7f2ea, 'bikini-w', { roughness: 0.74 });
    const lift = (m: THREE.Mesh) => { m.renderOrder = 2; };
    // 上衣：兩塊方形罩杯＋白肩帶＋後帶（無解剖細節）
    lift(add(g, G('bik-cup', () => rbox(0.125, 0.075, 0.045)), flor, [-0.075, 0.22, -0.125]));
    lift(add(g, G('bik-cup', () => rbox(0.125, 0.075, 0.045)), flor, [0.075, 0.22, -0.125]));
    lift(add(g, G('bik-trim', () => rbox(0.13, 0.016, 0.02)), white, [-0.075, 0.185, -0.138]));
    lift(add(g, G('bik-trim', () => rbox(0.13, 0.016, 0.02)), white, [0.075, 0.185, -0.138]));
    lift(add(g, G('bik-strap', () => rbox(0.02, 0.16, 0.016)), white, [-0.06, 0.30, -0.10], [0, 0, 0.28]));
    lift(add(g, G('bik-strap', () => rbox(0.02, 0.16, 0.016)), white, [0.06, 0.30, -0.10], [0, 0, -0.28]));
    lift(add(g, G('bik-back', () => rbox(0.30, 0.018, 0.016)), white, [0, 0.225, 0.118]));
    // 下身要比髖部方塊（0.40×0.10×0.24）更大，才不會被包在膚色裡面看不見
    lift(add(g, G('bik-bot', () => rbox(0.44, 0.11, 0.28)), flor, [0, -0.165, 0]));
    lift(add(g, G('bik-front', () => rbox(0.18, 0.065, 0.06)), flor, [0, -0.215, -0.125]));
    lift(add(g, G('bik-rear', () => rbox(0.22, 0.075, 0.055)), flor, [0, -0.21, 0.128]));
    lift(add(g, G('bik-wb', () => rbox(0.455, 0.03, 0.29)), white, [0, -0.102, 0]));
    lift(add(g, G('bik-tie', () => rbox(0.06, 0.045, 0.045)), flor, [-0.235, -0.16, 0]));
    lift(add(g, G('bik-tie', () => rbox(0.06, 0.045, 0.045)), flor, [0.235, -0.16, 0]));
    lift(add(g, G('bik-tie2', () => rbox(0.028, 0.07, 0.024)), white, [-0.26, -0.185, 0]));
    lift(add(g, G('bik-tie2', () => rbox(0.028, 0.07, 0.024)), white, [0.26, -0.185, 0]));
  } else if (body.id === 'bd_singlet') {
    const cream = solid(0xf2efe8, 'sing-neck', { roughness: 0.88 });
    const bind = solid(0xe4e0d8, 'sing-bind', { roughness: 0.86 });
    add(g, G('sing-neck', () => rcyl(0.11, 0.12, 0.036, 10)), cream, [0, 0.35, 0]);
    add(g, G('sing-hem', () => rbox(0.39, 0.02, 0.23)), solid(0xd8d4cc, 'sing-hem', { roughness: 0.88 }), [0, -0.112, 0]);
    add(g, G('sing-arm', () => rbox(0.03, 0.16, 0.20)), bind, [-0.19, 0.22, 0]);
    add(g, G('sing-arm', () => rbox(0.03, 0.16, 0.20)), bind, [0.19, 0.22, 0]);
  } else if (body.id === 'bd_hawaii') {
    add(g, G('haw-col', () => rbox(0.12, 0.08, 0.075)), texM, [-0.08, 0.345, -0.08], [0.22, 0.18, 0.28]);
    add(g, G('haw-col', () => rbox(0.12, 0.08, 0.075)), texM, [0.08, 0.345, -0.08], [0.22, -0.18, -0.28]);
    const btn = G('haw-btn', () => rcyl(0.012, 0.012, 0.01, 6));
    const btnM = solid(0xf2e8c8, 'haw-btn', { roughness: 0.7 });
    for (const y of [0.26, 0.14, 0.02, -0.08]) add(g, btn, btnM, [0, y, -0.122]);
    const cuffM = solid(new THREE.Color(body.base).multiplyScalar(0.78).getHex(), 'haw-cuff', { roughness: 0.8 });
    for (const arm of [rig.upperL, rig.upperR]) {
      if (!arm) continue;
      const ug = ensureDet(arm, DET.upper);
      add(ug, G('haw-slv', () => rbox(0.125, 0.16, 0.125)), texM, [0, 0.02, 0]);
      add(ug, G('haw-cuff', () => rcyl(0.07, 0.068, 0.028, 8)), cuffM, [0, 0.11, 0]);
    }
  } else if (body.id === 'bd_nightshort') {
    const cloth = texM;
    const dark = solid(0x1a2438, 'ns-dark', { roughness: 0.82 });
    const cream = solid(0xe8e2d4, 'ns-tie', { roughness: 0.7 });
    add(g, G('ns-col', () => rbox(0.12, 0.075, 0.07)), cloth, [-0.08, 0.345, -0.08], [0.22, 0.18, 0.28]);
    add(g, G('ns-col', () => rbox(0.12, 0.075, 0.07)), cloth, [0.08, 0.345, -0.08], [0.22, -0.18, -0.28]);
    add(g, G('ns-hem', () => rbox(0.39, 0.028, 0.23)), dark, [0, -0.112, 0]);
    add(g, G('ns-tie', () => rbox(0.055, 0.016, 0.016)), cream, [-0.05, 0.05, -0.122]);
    add(g, G('ns-tie', () => rbox(0.055, 0.016, 0.016)), cream, [0.05, 0.05, -0.122]);
    add(g, G('ns-knot', () => rbox(0.03, 0.03, 0.02)), cream, [0, 0.05, -0.128]);
    const cuffM = solid(0x1a2438, 'ns-cuff', { roughness: 0.8 });
    for (const arm of [rig.upperL, rig.upperR]) {
      if (!arm) continue;
      const ug = ensureDet(arm, DET.upper);
      add(ug, G('ns-slv', () => rbox(0.125, 0.15, 0.125)), cloth, [0, 0.02, 0]);
      add(ug, G('ns-cuff', () => rcyl(0.07, 0.068, 0.026, 8)), cuffM, [0, 0.105, 0]);
    }
  } else if (body.id === 'bd_none') {
    // 衣服不穿：膚色軀幹上的 X 字胸貼（沿用原本裸體外觀）
    const tape = solid(0x2a2a2a, 'nude-x', { roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const strip = G('nude-x', () => rbox(0.088, 0.02, 0.022));
    const lift = (m: THREE.Mesh) => { m.renderOrder = 3; };
    lift(add(g, strip, tape, [-0.075, 0.22, -0.138], [0, 0, 0.785]));
    lift(add(g, strip, tape, [-0.075, 0.22, -0.138], [0, 0, -0.785]));
    lift(add(g, strip, tape, [0.075, 0.22, -0.138], [0, 0, 0.785]));
    lift(add(g, strip, tape, [0.075, 0.22, -0.138], [0, 0, -0.785]));
  }
}

function buildSleeveDetails(rig: PlayerRig, hand: EquipVis) {
  const texM = SM(`slv-${hand.id}`, 0xffffff, { map: makeEqTexture(hand), roughness: 0.78, emissive: hand.id === 'sl_neon' ? 0x1a6a40 : 0x000000, emissiveIntensity: hand.id === 'sl_neon' ? 0.3 : 0 });
  const cuffCol =
    hand.id === 'sl_dragon' ? 0xe8b830 :
    hand.id === 'sl_neon' ? 0xe8f8f0 :
    hand.id === 'sl_rain' ? 0xd4a010 :
    hand.id === 'sl_89' ? 0xc49068 :
    hand.id === 'hn_basic' ? 0x2a3a62 :
    new THREE.Color(hand.base).multiplyScalar(0.75).getHex();
  const cuffM = SM(`cuff-${hand.id}`, cuffCol, {
    roughness: hand.id === 'sl_dragon' ? 0.4 : 0.82,
    metalness: hand.id === 'sl_dragon' ? 0.35 : 0.04,
  });
  // 袖身略往肘延伸，蓋住小臂上端膚色面（同貼圖）
  const coverG = G('slv-cover', () => rbox(0.108, 0.24, 0.108));
  const cuffG = G('slv-cuff', () => rcyl(0.058, 0.055, 0.036, 8));
  const stripeG = G('slv-stripe', () => rbox(0.02, 0.22, 0.112));
  for (const arm of [rig.lowerL, rig.lowerR]) {
    if (!arm) continue;
    const g = ensureDet(arm, DET.sleeve);
    add(g, coverG, texM, [0, -0.02, 0]);
    add(g, cuffG, cuffM, [0, 0.10, 0]);
    if (hand.id === 'sl_neon') add(g, stripeG, SM('slv-white', 0xe8f8f0), [0.03, -0.02, 0]);
    if (hand.id === 'sl_nightwrap') add(g, stripeG, SM('slv-indigo', 0x2a4a7a), [0.03, -0.02, 0]);
    if (hand.id === 'sl_rain') add(g, G('slv-ref', () => rbox(0.11, 0.018, 0.11)), SM('slv-ref', 0xe8e6d8, { roughness: 0.4 }), [0, 0.04, 0]);
  }
}


/** 捲管褲：把小腿褲管裁到反摺下緣，下面才用圓柱當腳踝，避免膚色從褲管正面穿出 */
function cropShinForRolled(rig: PlayerRig, on: boolean) {
  for (const shin of [rig.shinL, rig.shinR]) {
    if (!shin) continue;
    for (const c of shin.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || m.userData.mergedLimb) continue;
      // 鞋／鞋底有 z 偏移；小腿褲管方柱在 z=0、預設 y=-0.14（裁切後 y=-0.045）
      if (Math.abs(m.position.x) > 1e-4 || Math.abs(m.position.z) > 1e-4) continue;
      if (Math.abs(m.position.y + 0.14) > 0.02 && Math.abs(m.position.y + 0.045) > 0.02) continue;
      if (on) {
        m.position.y = -0.045;
        m.scale.y = 0.13 / 0.32;
      } else {
        m.position.y = -0.14;
        m.scale.set(1, 1, 1);
      }
    }
  }
}

function buildLegDetails(rig: PlayerRig, legs: EquipVis) {
  const darker = new THREE.Color(legs.base).multiplyScalar(0.78).getHex();
  const pocketM = SM(`leg-pk-${legs.id}`, darker, { roughness: 0.82 });
  const flapM = SM(`leg-fl-${legs.id}`, new THREE.Color(legs.base).multiplyScalar(0.9).getHex(), { roughness: 0.8 });
  for (const [leg, side] of [[rig.legL, -1], [rig.legR, 1]] as const) {
    if (!leg) continue;
    const g = ensureDet(leg, DET.leg);
    if (legs.id === 'lg_basic') {
      add(g, G('wp-pk', () => rbox(0.03, 0.11, 0.08)), pocketM, [side * 0.078, -0.12, 0.01]);
    } else if (legs.id === 'lg_camo') {
      add(g, G('cg-pk', () => rbox(0.055, 0.12, 0.08)), pocketM, [side * 0.09, -0.14, 0.02]);
      add(g, G('cg-flap', () => rbox(0.055, 0.03, 0.08)), flapM, [side * 0.09, -0.07, 0.025]);
    }
  }
  for (const shin of [rig.shinL, rig.shinR]) {
    if (!shin) continue;
    const g = ensureDet(shin, DET.shin);
    if (legs.id === 'lg_rain') {
      add(g, G('rp-ref', () => rbox(0.14, 0.028, 0.14)), SM('rp-ref', 0xe8e6d8, { roughness: 0.4 }), [0, -0.08, 0]);
      add(g, G('rp-cuff', () => rcyl(0.075, 0.07, 0.04, 8)), SM('rp-cuff', 0xd4a010, { roughness: 0.8 }), [0, -0.275, 0]);
    } else if (legs.id === 'lg_rolled') {
      const rollM = SM('roll-cuff', new THREE.Color(legs.base).multiplyScalar(0.82).getHex(), { roughness: 0.84 });
      const skinM = SM('roll-skin', 0xe8bc98, { roughness: 0.78 });
      add(g, G('roll-cuff', () => rcyl(0.092, 0.092, 0.06, 8)), rollM, [0, -0.08, 0]);
      // 只填反摺到鞋面之間，半徑對齊小腿正面寬度，不再比褲管鼓出去
      add(g, G('roll-skin2', () => rcyl(0.068, 0.062, 0.17, 8)), skinM, [0, -0.195, 0]);
    } else if (legs.id === 'lg_tied') {
      // 束口對齊小腿中心 z=0；半徑略大於小腿方柱對角線，包住邊角但不另加寬
      const cuffM = SM('tied-cuff', 0x1a2438, { roughness: 0.84 });
      add(g, G('tied-cuff', () => rcyl(0.095, 0.092, 0.045, 8)), cuffM, [0, -0.275, 0]);
      add(g, G('tied-band', () => rcyl(0.098, 0.095, 0.02, 8)), SM('tied-band', 0xe8e2d4, { roughness: 0.7 }), [0, -0.255, 0]);
    }
  }
}

function buildFeetDetails(rig: PlayerRig, feet: EquipVis) {
  for (const shin of [rig.shinL, rig.shinR]) {
    if (!shin) continue;
    const g = shin.userData[DET.shin] as THREE.Group | undefined;
    const host = g ?? ensureDet(shin, DET.shin);
    if (feet.id === 'ft_basic' || feet.id === 'ft_gold' || feet.id === 'ft_redslipper') {
      const strapC = feet.id === 'ft_gold' ? 0xe8b830 : feet.id === 'ft_redslipper' ? 0xc82028 : 0x2a5ab0;
      const strap = SM(`slip-${feet.id}`, strapC, {
        roughness: feet.id === 'ft_gold' ? 0.35 : 0.7,
        metalness: feet.id === 'ft_gold' ? 0.45 : 0.04,
      });
      add(host, G('slip-post', () => rbox(0.03, 0.04, 0.03)), strap, [0, -0.27, -0.10]);
      add(host, G('slip-a', () => rbox(0.10, 0.018, 0.032)), strap, [-0.04, -0.268, -0.03], [0, 0.45, 0.08]);
      add(host, G('slip-b', () => rbox(0.10, 0.018, 0.032)), strap, [0.04, -0.268, -0.03], [0, -0.45, -0.08]);
      if (feet.id === 'ft_gold') {
        add(host, G('slip-gem', () => rcyl(0.016, 0.016, 0.012, 8)), SM('slip-gem', 0xfff0b0, { metalness: 0.6, roughness: 0.28 }), [0, -0.252, -0.10]);
      }
    } else if (feet.id === 'ft_boots' || feet.id === 'ft_greenboots') {
      const yel = SM(`boot-${feet.id}`, 0xffffff, { map: makeEqTexture(feet), roughness: 0.72 });
      const yelD = SM(`bootD-${feet.id}`, feet.id === 'ft_greenboots' ? 0x1a5a28 : 0xd4a010, { roughness: 0.75 });
      // 小腿方柱中心在 z=0；舊鞋筒往鞋頭偏了 0.02，後側邊角會穿出。對齊小腿中心，不另外加寬
      const cover = (m: THREE.Mesh) => { m.renderOrder = 1; return m; };
      cover(add(host, G('rboot-shaft2', () => rcyl(0.105, 0.11, 0.20, 10)), yel, [0, -0.21, 0]));
      cover(add(host, G('rboot-cuff2', () => rcyl(0.115, 0.115, 0.03, 10)), yelD, [0, -0.105, 0]));
    } else if (feet.id === 'ft_work') {
      const brn = SM('wboot', 0xffffff, { map: makeEqTexture(feet), roughness: 0.8 });
      const brnD = SM('wbootD', 0x4a3018, { roughness: 0.78 });
      const lace = SM('wboot-lace', 0xe8d8a8, { roughness: 0.7 });
      const cover = (m: THREE.Mesh) => { m.renderOrder = 1; return m; };
      cover(add(host, G('wboot-shaft2', () => rcyl(0.105, 0.11, 0.14, 10)), brn, [0, -0.24, 0]));
      cover(add(host, G('wboot-toe', () => rbox(0.145, 0.055, 0.08)), brnD, [0, -0.325, -0.10]));
      cover(add(host, G('wboot-lace', () => rbox(0.075, 0.01, 0.012)), lace, [0, -0.22, -0.09]));
      cover(add(host, G('wboot-lace', () => rbox(0.075, 0.01, 0.012)), lace, [0, -0.248, -0.09]));
      cover(add(host, G('wboot-lace', () => rbox(0.075, 0.01, 0.012)), lace, [0, -0.276, -0.09]));
    } else if (feet.id === 'ft_tabi') {
      const blk = SM('tabi', 0x1a1c22, { roughness: 0.78 });
      const cream = SM('tabi-split', 0xe8e2d4, { roughness: 0.65 });
      const cover = (m: THREE.Mesh) => { m.renderOrder = 1; return m; };
      // 腳踝套筒對齊小腿中心，包住方柱下緣，不往鞋頭偏移
      cover(add(host, G('tabi-shaft', () => rcyl(0.095, 0.098, 0.10, 10)), blk, [0, -0.26, 0]));
      cover(add(host, G('tabi-cuff', () => rcyl(0.098, 0.098, 0.022, 10)), cream, [0, -0.21, 0]));
      const inner = shin === rig.shinL ? 1 : -1;
      cover(add(host, G('tabi-big', () => rbox(0.055, 0.05, 0.09)), blk, [inner * 0.042, -0.325, -0.125]));
      cover(add(host, G('tabi-rest', () => rbox(0.08, 0.05, 0.08)), blk, [inner * -0.032, -0.325, -0.115]));
      cover(add(host, G('tabi-line', () => rbox(0.012, 0.042, 0.09)), cream, [inner * 0.012, -0.322, -0.122]));
    }
  }
}

function addUnderwear(rig: PlayerRig) {
  const g = rig.torso ? (rig.torso.userData[DET.body] as THREE.Group | undefined) ?? ensureDet(rig.torso, DET.body) : undefined;
  if (!g) return;
  const cloth = SM('undies', 0xd8d0c4, { roughness: 0.86 });
  const wb = SM('undies-wb', 0xeee8dc, { roughness: 0.84 });
  const lift = (m: THREE.Mesh) => { m.renderOrder = 2; };
  lift(add(g, G('und-bot', () => rbox(0.42, 0.095, 0.26)), cloth, [0, -0.162, 0]));
  lift(add(g, G('und-front', () => rbox(0.15, 0.05, 0.05)), cloth, [0, -0.208, -0.122]));
  lift(add(g, G('und-wb', () => rbox(0.435, 0.024, 0.27)), wb, [0, -0.112, 0]));
}

/**
 * 把五件裝備套到 PlayerRig（廣場遠端／本機 plazaMe／可選死鬥）。
 * 需 rig 建好時帶 outfitMats／hatG（makePlayerAvatar 已建）。
 */
export function applyOutfitToRig(rig: PlayerRig, raw: Partial<OutfitIds> | null | undefined) {
  const o = normalizeOutfitIds(raw);
  const mats = rig.outfitMats;
  if (!mats) return o;
  const head = BY_ID.get(o.head)!;
  const hand = BY_ID.get(o.hand)!;
  const body = BY_ID.get(o.body)!;
  const legs = BY_ID.get(o.legs)!;
  const feet = BY_ID.get(o.feet)!;
  const SKIN_HEX = '#e8bc98';
  const shirtless = body.id === 'bd_bikini' || body.id === 'bd_none';
  const sleeveless = body.id === 'bd_singlet';
  if (body.id === 'bd_bikini') {
    for (const m of mats.body) paintSolid(m, SKIN_HEX);
    for (const m of mats.legs) paintSolid(m, SKIN_HEX);
  } else if (body.id === 'bd_none') {
    for (const m of mats.body) paintSolid(m, SKIN_HEX);
    if (legs.id === 'lg_none') for (const m of mats.legs) paintSolid(m, SKIN_HEX);
    else for (const m of mats.legs) paintMat(m, legs);
  } else {
    for (const m of mats.body) paintMat(m, body);
    if (legs.id === 'lg_none') for (const m of mats.legs) paintSolid(m, SKIN_HEX);
    else for (const m of mats.legs) paintMat(m, legs);
  }
  const bareArms = hand.id === 'hn_none' || ((shirtless || sleeveless) && hand.id === 'hn_basic');
  if (body.id === 'bd_hawaii') {
    for (const m of mats.sleeve) paintMat(m, body);
  } else if (bareArms) {
    for (const m of mats.sleeve) paintSolid(m, SKIN_HEX);
  } else {
    for (const m of mats.sleeve) paintMat(m, hand);
  }
  paintFeet(mats, feet);
  for (const m of mats.hair) {
    resetSurf(m);
    m.color.setHex(0x222222);
    m.needsUpdate = true;
  }
  if (rig.hatG) buildHat(rig.hatG, head);
  buildBodyDetails(rig, body);
  if (body.id !== 'bd_hawaii' && body.id !== 'bd_nightshort') {
    for (const arm of [rig.upperL, rig.upperR]) if (arm) ensureDet(arm, DET.upper);
  }
  if (bareArms) {
    // 花襯衫走上面的專用上臂貼圖，但不能略過清小臂袖套：否則從 sl_* 換成「不穿」時，舊袖身／袖口會留著
    for (const arm of [rig.lowerL, rig.lowerR]) if (arm) ensureDet(arm, DET.sleeve);
  } else {
    buildSleeveDetails(rig, hand);
  }
  if (body.id === 'bd_bikini') {
    // 比基尼會把腿畫成膚色並自帶下身，清掉原本褲袋以免浮在皮膚上
    for (const leg of [rig.legL, rig.legR]) if (leg) ensureDet(leg, DET.leg);
    for (const shin of [rig.shinL, rig.shinR]) if (shin) ensureDet(shin, DET.shin);
  } else if (legs.id === 'lg_none') {
    for (const leg of [rig.legL, rig.legR]) if (leg) ensureDet(leg, DET.leg);
    for (const shin of [rig.shinL, rig.shinR]) if (shin) ensureDet(shin, DET.shin);
    addUnderwear(rig);
  } else {
    buildLegDetails(rig, legs);
  }
  if (feet.id !== 'ft_none') buildFeetDetails(rig, feet);
  cropShinForRolled(rig, legs.id === 'lg_rolled' && body.id !== 'bd_bikini');
  rig.outfitKey = outfitKey(o);
  rebuildAvatarMerged(rig);
  return o;
}
