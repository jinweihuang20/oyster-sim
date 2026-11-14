import * as THREE from 'three';
import { rbox, rcyl, crease } from '../core/geo';
import type { PlayerRig } from '../dm/character';
import { NO_MERGE, rebuildAvatarMerged } from '../dm/avatarMerge';

/** 服飾視覺（與 main EQUIP id 對齊；只負責外觀） */
export type EquipVis = {
  slot: 'hair' | 'head' | 'hand' | 'body' | 'legs' | 'feet';
  id: string;
  base: string;
  pat: 'plain' | 'flower' | 'rain' | 'camo' | 'neon' | 'tattoo' | 'dragon' | 'karakusa';
};

export type OutfitIds = {
  hair: string;
  head: string;
  hand: string;
  body: string;
  legs: string;
  feet: string;
};

/** 全服飾 id 白名單（server／client 共用語意） */
export const EQUIP_VIS: EquipVis[] = [
  { slot: 'hair', id: 'hr_basic', base: '#5a3a28', pat: 'plain' },
  { slot: 'hair', id: 'hr_mlong', base: '#3a2818', pat: 'plain' },
  { slot: 'hair', id: 'hr_bob', base: '#2a1a12', pat: 'plain' },
  { slot: 'hair', id: 'hr_long', base: '#4a2e20', pat: 'plain' },
  { slot: 'hair', id: 'hr_reggae', base: '#2a1a10', pat: 'plain' },
  { slot: 'hair', id: 'hr_spike', base: '#2e2418', pat: 'plain' },
  { slot: 'hair', id: 'hr_samurai', base: '#2a1c12', pat: 'plain' },
  { slot: 'hair', id: 'hr_afro', base: '#2c1a10', pat: 'plain' },
  { slot: 'hair', id: 'hr_mohawk', base: '#2a2218', pat: 'plain' },
  { slot: 'hair', id: 'hr_lowbun', base: '#3a2418', pat: 'plain' },
  { slot: 'hair', id: 'hr_twinbraid', base: '#4a2e1c', pat: 'plain' },
  { slot: 'hair', id: 'hr_halfbun', base: '#3a2818', pat: 'plain' },
  { slot: 'hair', id: 'hr_wolf', base: '#2e2016', pat: 'plain' },
  { slot: 'hair', id: 'hr_sidebraid', base: '#3a2618', pat: 'plain' },
  { slot: 'hair', id: 'hr_none', base: '#e8bc98', pat: 'plain' },
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
  hair: 'hr_basic', head: 'hd_basic', hand: 'hn_basic', body: 'bd_basic', legs: 'lg_basic', feet: 'ft_basic',
};

const NONE_OF: OutfitIds = { hair: 'hr_none', head: 'hd_none', hand: 'hn_none', body: 'bd_none', legs: 'lg_none', feet: 'ft_none' };

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
    hair: pick('hair', raw?.hair),
    head: pick('head', raw?.head),
    hand: pick('hand', raw?.hand),
    body: pick('body', raw?.body),
    legs: pick('legs', raw?.legs),
    feet: pick('feet', raw?.feet),
  };
}

export function outfitKey(o: OutfitIds) {
  return `${o.hair}|${o.head}|${o.hand}|${o.body}|${o.legs}|${o.feet}`;
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

/** 戴帽時頭頂壓扁強度：仍建原髮型，只縮頭頂 */
export type HairCover = 'none' | 'soft' | 'full';

/** 依帽子決定壓扁強度。none＝不穿；soft＝頭巾／金冠；full＝斗笠／草帽／漁夫／安全帽 */
export function hairCoverFor(headId: string): HairCover {
  if (headId === 'hd_none') return 'none';
  if (headId === 'hd_basic' || headId === 'hd_purple' || headId === 'hd_karakusa' || headId === 'hd_crown') {
    return 'soft';
  }
  return 'full';
}

/**
 * 戴帽時仍建原本髮型，只把頭頂壓進帽冠；剪影不變。
 * pivot 約在頭皮，下半披落／辮子縮幅較小。
 */
function applyHairHatSquash(g: THREE.Object3D, cover: HairCover, hairId: string) {
  if (cover === 'none') {
    g.scale.set(1, 1, 1);
    g.position.set(0, 0, 0);
    return;
  }
  // 一般髮型幾乎不縮（帽子蓋住即可）；高／大體積才明顯壓進帽冠
  const bulky = hairId === 'hr_afro' || hairId === 'hr_mohawk' || hairId === 'hr_spike' || hairId === 'hr_samurai';
  let sy: number;
  let sxz: number;
  if (!bulky) {
    sy = cover === 'soft' ? 0.97 : 0.92;
    sxz = cover === 'soft' ? 0.99 : 0.96;
  } else if (hairId === 'hr_afro') {
    sy = cover === 'soft' ? 0.70 : 0.48;
    sxz = cover === 'soft' ? 0.78 : 0.68;
  } else {
    sy = cover === 'soft' ? 0.80 : 0.62;
    sxz = cover === 'soft' ? 0.92 : 0.86;
  }
  const pivotY = 0.04;
  g.scale.set(sxz, sy, sxz);
  g.position.set(0, pivotY * (1 - sy), 0);
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
  m.visible = true;
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
  // 袖套／上臂細節不參與肢體 merge：合併失敗時來源會被藏住，第三人稱袖套會整段消失
  if (key === DET.sleeve || key === DET.upper) g.userData[NO_MERGE] = 1;
  clearGroup(g);
  return g;
}

const DET = {
  body: 'eqBodyDet',
  sleeve: 'eqSleeveDet',
  upper: 'eqUpperDet',
  leg: 'eqLegDet',
  shin: 'eqShinDet',
  hair: 'eqHairDet',
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
    [rig.head, DET.hair],
  ];
  for (const [p, k] of pairs) {
    if (!p) continue;
    const g = p.userData[k] as THREE.Group | undefined;
    if (g) clearGroup(g);
  }
  // 清掉裝備髮型後還原頭上的基本髮塊（廣場 NPC 白髮／灰髮靠這層）
  setBaseHairVisible(rig.head, true);
}

function setBaseHairVisible(head: THREE.Object3D, on: boolean) {
  head.traverse(o => {
    if ((o as THREE.Mesh).isMesh && o.userData.baseHair) o.visible = on;
  });
}

/**
 * 頭 ≈ 0.28（臉 -Z）。髮型＝側視剪影一次擠出成「單一片」立體，
 * 像 RO 立繪厚度，不再用多塊方／球拼。
 * 剪影座標：x 前(-)後(+)，y 上；擠出寬度≈頭寬。
 */
function hairSilhouette(pts: [number, number][], width = 0.32) {
  const sh = new THREE.Shape();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.022,
    bevelSegments: 2,
    curveSegments: 4,
  });
  g.translate(0, 0, -width * 0.5);
  // 擠出軸 Z → 左右 X；剪影 x → 世界 -Z（臉朝前）
  g.rotateY(-Math.PI / 2);
  return crease(g);
}

/** 剪影款（目前長髮改走 buildLongHair） */
const HAIR_PROFILE: Record<string, [number, number][]> = {};

const UP = new THREE.Vector3(0, 1, 0);

/** 刺底在頭皮上，尖端沿 dir 伸出。四角錐，稜朝外才有刺蝟剪影。 */
function addHairSpike(
  parent: THREE.Object3D,
  mat: THREE.Material,
  spec: readonly [number, number, number, number, number, number, number, number],
) {
  const [x, y, z, dx, dy, dz, len, rad] = spec;
  const d = new THREE.Vector3(dx, dy, dz).normalize();
  const geo = G(`hr-spike-c-${len}-${rad}`, () => crease(new THREE.ConeGeometry(rad, len, 4)));
  const mesh = add(parent, geo, mat, [x + d.x * len * 0.5, y + d.y * len * 0.5, z + d.z * len * 0.5]);
  const aim = new THREE.Quaternion().setFromUnitVectors(UP, d);
  const twist = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 4);
  mesh.quaternion.copy(aim).multiply(twist);
}

/** 髮塊用較小圓角，避免 rbox 圓角在頂－側接縫挖出縫隙露頭皮 */
const hairBox = (w: number, h: number, d: number) => rbox(w, h, d, 2, 0.06);

/**
 * 全蓋款底層：頭頂／兩側／後腦本體互相延伸交疊（頭寬 0.28、面 ±0.14）。
 * 只放大既有髮塊範圍，不另塞銜接補丁。前緣停眉上。
 */
function addHairScalp(parent: THREE.Object3D, mat: THREE.Material) {
  // 頂蓋加厚並往前／側伸出，包住頭頂與額上緣
  add(parent, G('hr-scalp-top6', () => hairBox(0.36, 0.10, 0.34)), mat, [0, 0.138, 0.0]);
  add(parent, G('hr-scalp-back6', () => hairBox(0.34, 0.24, 0.10)), mat, [0, 0.04, 0.145]);
  // 側板加高到頂蓋中線以上，前後也拉長
  add(parent, G('hr-scalp-side6', () => hairBox(0.08, 0.20, 0.30)), mat, [-0.16, 0.09, 0.0]);
  add(parent, G('hr-scalp-side6', () => hairBox(0.08, 0.20, 0.30)), mat, [0.16, 0.09, 0.0]);
  add(parent, G('hr-scalp-corner6', () => hairBox(0.12, 0.14, 0.12)), mat, [-0.13, 0.11, 0.115]);
  add(parent, G('hr-scalp-corner6', () => hairBox(0.12, 0.14, 0.12)), mat, [0.13, 0.11, 0.115]);
}

/**
 * fade／undercut 頭頂殼：把頂蓋與側上緣加寬加高到彼此交疊；耳下仍剃短。
 */
function addCrownShell(parent: THREE.Object3D, mat: THREE.Material, key: string) {
  add(parent, G(`${key}-top6`, () => hairBox(0.34, 0.08, 0.32)), mat, [0, 0.145, -0.01]);
  add(parent, G(`${key}-front6`, () => hairBox(0.26, 0.06, 0.10)), mat, [0, 0.132, -0.13]);
  add(parent, G(`${key}-back6`, () => hairBox(0.30, 0.12, 0.09)), mat, [0, 0.112, 0.135]);
  add(parent, G(`${key}-side6`, () => hairBox(0.06, 0.10, 0.26)), mat, [-0.152, 0.118, 0.0]);
  add(parent, G(`${key}-side6`, () => hairBox(0.06, 0.10, 0.26)), mat, [0.152, 0.118, 0.0]);
  add(parent, G(`${key}-corner6`, () => hairBox(0.10, 0.09, 0.08)), mat, [-0.12, 0.125, 0.118]);
  add(parent, G(`${key}-corner6`, () => hairBox(0.10, 0.09, 0.08)), mat, [0.12, 0.125, 0.118]);
}

/**
 * 刺蝟：動畫風幾何尖刺。往上／外放射，稜角清楚。
 * 頭頂前緣蓋滿髮際；眼睛仍露；後腦與兩側短收。
 */
function buildSpikeHair(parent: THREE.Object3D, mat: THREE.Material) {
  // 頂蓋與側上緣加寬交疊後再插刺（不做額外補丁塊）
  addCrownShell(parent, mat, 'hr-spike');
  const spikes: [number, number, number, number, number, number, number, number][] = [
    [0.0, 0.165, -0.08, 0.05, 0.85, -0.5, 0.18, 0.032],
    [-0.045, 0.165, -0.07, -0.22, 0.9, -0.35, 0.16, 0.028],
    [0.05, 0.165, -0.07, 0.22, 0.9, -0.38, 0.17, 0.028],
    [-0.07, 0.16, -0.02, -0.35, 0.9, -0.08, 0.13, 0.024],
    [0.07, 0.16, -0.02, 0.35, 0.9, -0.08, 0.13, 0.024],
    [-0.04, 0.17, 0.02, -0.15, 0.96, 0.1, 0.14, 0.026],
    [0.04, 0.17, 0.02, 0.15, 0.96, 0.1, 0.14, 0.026],
    [0.0, 0.17, 0.05, 0, 0.9, 0.3, 0.15, 0.028],
    [-0.055, 0.16, 0.06, -0.2, 0.9, 0.3, 0.11, 0.022],
    [0.055, 0.16, 0.06, 0.2, 0.9, 0.3, 0.11, 0.022],
    [0.0, 0.155, 0.1, 0, 0.75, 0.55, 0.10, 0.022],
  ];
  for (const s of spikes) addHairSpike(parent, mat, s);
}

/**
 * 雷鬼：undercut 髒辮。頭頂從前髮際蓋滿，後頂束起垂下。
 */
function buildDreadHair(parent: THREE.Object3D, mat: THREE.Material) {
  addCrownShell(parent, mat, 'hr-dread');
  add(parent, G('hr-dread-knot', () => rbox(0.10, 0.06, 0.08)), mat, [0, 0.125, 0.125]);
  addDread(parent, mat, [-0.045, 0.135, 0.125], [1, 0, 0.12], 0.10, 0.018);
  addDread(parent, mat, [-0.035, 0.115, 0.13], [1, -0.08, 0.1], 0.09, 0.016);
  // 前頂也有辮根，避免前額禿
  const onTop: [number, number, number, number, number, number, number, number][] = [
    [0.0, 0.16, -0.1, 0, 0.4, 0.9, 0.14, 0.028],
    [-0.06, 0.16, -0.08, 0.15, 0.35, 0.9, 0.15, 0.026],
    [0.06, 0.16, -0.08, -0.15, 0.35, 0.9, 0.15, 0.026],
    [-0.06, 0.17, -0.02, 0.18, -0.05, 0.9, 0.16, 0.028],
    [0.06, 0.17, -0.02, -0.18, -0.05, 0.9, 0.16, 0.028],
    [-0.03, 0.18, 0.02, 0.08, -0.1, 0.9, 0.14, 0.030],
    [0.03, 0.18, 0.02, -0.08, -0.1, 0.9, 0.14, 0.030],
    [0.0, 0.185, 0.05, 0, -0.15, 0.9, 0.12, 0.032],
  ];
  for (const s of onTop) addDread(parent, mat, [s[0], s[1], s[2]], [s[3], s[4], s[5]], s[6], s[7]);
  const hang: [number, number, number, number, number, number, number, number][] = [
    [0.0, 0.10, 0.145, 0, -1, 0.35, 0.42, 0.032],
    [-0.04, 0.10, 0.135, -0.1, -1, 0.3, 0.38, 0.028],
    [0.04, 0.10, 0.135, 0.1, -1, 0.3, 0.40, 0.028],
    [-0.07, 0.11, 0.125, -0.15, -1, 0.22, 0.34, 0.026],
    [0.07, 0.11, 0.125, 0.15, -1, 0.22, 0.36, 0.026],
    [0.0, 0.09, 0.16, 0, -1, 0.45, 0.46, 0.030],
  ];
  for (const s of hang) addDread(parent, mat, [s[0], s[1], s[2]], [s[3], s[4], s[5]], s[6], s[7]);
}

/** 辮根在 base，沿 dir 垂下。上端較細。 */
function addDread(
  parent: THREE.Object3D,
  mat: THREE.Material,
  base: [number, number, number],
  dir: [number, number, number],
  len: number,
  rad: number,
) {
  const d = new THREE.Vector3(...dir).normalize();
  const geo = G(`hr-dread-${len}-${rad}`, () => rcyl(rad * 0.72, rad, len, 6));
  const mesh = add(parent, geo, mat, [
    base[0] + d.x * len * 0.5,
    base[1] + d.y * len * 0.5,
    base[2] + d.z * len * 0.5,
  ]);
  mesh.quaternion.setFromUnitVectors(UP, d);
}

/**
 * 男生短髮：短寸 crop。兩側漸短、頭頂略亂尖、側掃瀏海在眉上。
 * 眼睛與耳朵全露；不要頭盔罩。
 */
function buildCropHair(parent: THREE.Object3D, mat: THREE.Material) {
  // 單片剪影加寬過頭（頭 0.28），頂／側一體蓋住頭皮，不另補方塊
  add(parent, G('hr-crop-soft2', () => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.145, 0.09);
    sh.quadraticCurveTo(-0.16, 0.145, -0.06, 0.205);
    sh.quadraticCurveTo(0.02, 0.225, 0.11, 0.18);
    sh.quadraticCurveTo(0.155, 0.10, 0.145, 0.03);
    sh.quadraticCurveTo(0.13, -0.02, 0.05, -0.04);
    sh.quadraticCurveTo(0.0, -0.045, -0.05, -0.015);
    sh.quadraticCurveTo(-0.11, 0.045, -0.145, 0.09);
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.024,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.translate(0, 0, -0.17);
    g.rotateY(-Math.PI / 2);
    return crease(g);
  }), mat, [0, 0.02, 0]);
  // 側掃瀏海：往上接到頂髮
  add(parent, G('hr-crop-bang2', () => rbox(0.14, 0.055, 0.04)), mat, [0.02, 0.105, -0.155]);
  add(parent, G('hr-crop-bangTip2', () => rbox(0.055, 0.05, 0.032)), mat, [0.08, 0.09, -0.15]);
  const tufts: [number, number, number, number, number, number, number, number][] = [
    [0.02, 0.175, -0.04, 0.12, 0.95, -0.25, 0.08, 0.024],
    [-0.04, 0.17, -0.02, -0.1, 0.97, -0.12, 0.07, 0.022],
    [0.05, 0.17, 0.0, 0.15, 0.96, -0.08, 0.075, 0.022],
    [0, 0.17, 0.04, 0, 0.98, 0.1, 0.065, 0.020],
    [-0.05, 0.165, 0.05, -0.12, 0.96, 0.15, 0.06, 0.018],
  ];
  for (const s of tufts) addHairSpike(parent, mat, s);
}

/**
 * 後腦全蓋：頭頂殼之外再加厚後牆與後頸，不透頭皮。
 */
function addFullBackCover(parent: THREE.Object3D, mat: THREE.Material, key: string) {
  addHairScalp(parent, mat);
  add(parent, G(`${key}-backWall6`, () => hairBox(0.34, 0.22, 0.10)), mat, [0, 0.02, 0.152]);
  add(parent, G(`${key}-nape6`, () => hairBox(0.30, 0.16, 0.09)), mat, [0, -0.06, 0.138]);
  add(parent, G(`${key}-napeLow6`, () => hairBox(0.26, 0.12, 0.08)), mat, [0, -0.14, 0.118]);
  add(parent, G(`${key}-sideBack6`, () => hairBox(0.08, 0.20, 0.14)), mat, [-0.155, 0.0, 0.08]);
  add(parent, G(`${key}-sideBack6`, () => hairBox(0.08, 0.20, 0.14)), mat, [0.155, 0.0, 0.08]);
}

/**
 * 沿路徑做連續麻花：中軸柱＋重疊球節（球與球、球與柱都交疊，不分離）。
 * 路徑應從後腦底部往前延伸。
 */
function addBraidChain(
  parent: THREE.Object3D,
  mat: THREE.Material,
  key: string,
  points: readonly [number, number, number][],
  rad: number,
) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 1e-5) continue;
    dir.multiplyScalar(1 / len);
    const spine = add(
      parent,
      G(`${key}-spine-${rad}`, () => rcyl(rad * 0.72, rad * 0.72, len * 1.12, 6)),
      mat,
      [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5],
    );
    spine.quaternion.setFromUnitVectors(UP, dir);
  }
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const side = i % 2 === 0 ? 1 : -1;
    add(
      parent,
      G(`${key}-ball-${rad}`, () => crease(new THREE.SphereGeometry(rad * 1.05, 6, 5))),
      mat,
      [p[0] + side * rad * 0.22, p[1], p[2]],
    );
    add(
      parent,
      G(`${key}-ballCore-${rad}`, () => crease(new THREE.SphereGeometry(rad * 0.85, 6, 5))),
      mat,
      [p[0] - side * rad * 0.12, p[1], p[2]],
    );
  }
}

/**
 * 低丸子頭：後頸低髻＋兩側簾式瀏海。髮際乾淨，耳與眼全露。
 */
function buildLowBunHair(parent: THREE.Object3D, mat: THREE.Material) {
  addFullBackCover(parent, mat, 'hr-lowbun');
  // 額前髮際從頂蓋往下延伸到眉上
  add(parent, G('hr-lowbun-front6', () => hairBox(0.28, 0.10, 0.07)), mat, [0, 0.12, -0.145]);
  add(parent, G('hr-lowbun-bangL3', () => hairBox(0.08, 0.09, 0.05)), mat, [-0.08, 0.11, -0.15]);
  add(parent, G('hr-lowbun-bangR3', () => hairBox(0.08, 0.09, 0.05)), mat, [0.08, 0.11, -0.15]);
  add(parent, G('hr-lowbun-bangTipL3', () => hairBox(0.05, 0.08, 0.036)), mat, [-0.11, 0.08, -0.135]);
  add(parent, G('hr-lowbun-bangTipR3', () => hairBox(0.05, 0.08, 0.036)), mat, [0.11, 0.08, -0.135]);
  // 後腦收束到後頸低髻（與後蓋重疊）
  add(parent, G('hr-lowbun-gather', () => rbox(0.16, 0.10, 0.08)), mat, [0, -0.04, 0.145]);
  add(parent, G('hr-lowbun-stem', () => rcyl(0.035, 0.045, 0.05, 6)), mat, [0, -0.10, 0.15]);
  add(parent, G('hr-lowbun-bun', () => crease(new THREE.SphereGeometry(0.075, 8, 6))), mat, [0, -0.14, 0.15]);
  add(parent, G('hr-lowbun-bunTip', () => crease(new THREE.SphereGeometry(0.04, 6, 5))), mat, [0, -0.18, 0.145]);
}

/**
 * 雙麻花辮：中分、眉上碎瀏海；辮根在後腦底部，往前披到肩胸。
 */
function buildTwinBraidHair(parent: THREE.Object3D, mat: THREE.Material) {
  addFullBackCover(parent, mat, 'hr-twin');
  // 額前髮際：從頂蓋往下延伸到眉上（連續一塊，不是另塞補丁）
  add(parent, G('hr-twin-front6', () => hairBox(0.30, 0.11, 0.08)), mat, [0, 0.12, -0.145]);
  add(parent, G('hr-twin-bangL3', () => hairBox(0.09, 0.09, 0.05)), mat, [-0.06, 0.11, -0.15]);
  add(parent, G('hr-twin-bangR3', () => hairBox(0.09, 0.09, 0.05)), mat, [0.06, 0.11, -0.15]);
  add(parent, G('hr-twin-part3', () => hairBox(0.04, 0.07, 0.07)), mat, [0, 0.14, -0.12]);
  // 後頸總根＋辮
  add(parent, G('hr-twin-root', () => rbox(0.14, 0.08, 0.08)), mat, [0, -0.08, 0.13]);
  for (const s of [-1, 1]) {
    add(parent, G('hr-twin-base', () => rbox(0.06, 0.07, 0.07)), mat, [s * 0.06, -0.10, 0.10]);
    // 後腦底 → 側肩 → 胸前垂下（-Z 在身體前方可見）
    const chain: [number, number, number][] = [
      [s * 0.05, -0.10, 0.13],
      [s * 0.12, -0.12, 0.07],
      [s * 0.16, -0.14, 0.01],
      [s * 0.17, -0.16, -0.06],
      [s * 0.15, -0.20, -0.12],
      [s * 0.13, -0.26, -0.15],
      [s * 0.12, -0.34, -0.16],
      [s * 0.11, -0.42, -0.16],
      [s * 0.10, -0.50, -0.15],
      [s * 0.09, -0.58, -0.14],
    ];
    addBraidChain(parent, mat, `hr-twin-${s}`, chain, 0.032);
  }
}

/**
 * 半丸子頭：頭頂小髻＋下半肩長披落；額與眼全露。
 */
function buildHalfBunHair(parent: THREE.Object3D, mat: THREE.Material) {
  addFullBackCover(parent, mat, 'hr-half');
  // 上半收成頂髻：頂／前延伸接到底蓋
  add(parent, G('hr-half-top2', () => rbox(0.28, 0.055, 0.26)), mat, [0, 0.152, 0.0]);
  add(parent, G('hr-half-front2', () => rbox(0.2, 0.055, 0.07)), mat, [0, 0.13, -0.13]);
  add(parent, G('hr-half-stem', () => rcyl(0.025, 0.032, 0.04, 6)), mat, [0, 0.19, 0.02]);
  add(parent, G('hr-half-bun', () => crease(new THREE.SphereGeometry(0.055, 8, 6))), mat, [0, 0.235, 0.02]);
  // 下半肩長層：後腦與兩側垂落（與後蓋重疊）
  add(parent, G('hr-half-back', () => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.10, 0.10);
    sh.quadraticCurveTo(-0.02, 0.14, 0.10, 0.10);
    sh.quadraticCurveTo(0.14, 0.0, 0.13, -0.14);
    sh.quadraticCurveTo(0.10, -0.30, 0.0, -0.32);
    sh.quadraticCurveTo(-0.10, -0.30, -0.13, -0.14);
    sh.quadraticCurveTo(-0.14, 0.0, -0.10, 0.10);
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 6,
    });
    g.translate(0, 0, -0.08);
    g.rotateY(-Math.PI / 2);
    return crease(g);
  }), mat, [0, -0.02, 0.08]);
  for (const s of [-1, 1]) {
    const strand = add(parent, G('hr-half-side2', () => rbox(0.06, 0.24, 0.08)), mat, [s * 0.15, -0.12, 0.02]);
    strand.rotation.z = s * 0.18;
  }
}

/**
 * 狼尾剪：肩長層次、末端外翻碎翹；眉上碎瀏海，眼臉全露。
 */
function buildWolfHair(parent: THREE.Object3D, mat: THREE.Material) {
  addFullBackCover(parent, mat, 'hr-wolf');
  add(parent, G('hr-wolf-soft', () => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.13, 0.095);
    sh.quadraticCurveTo(-0.14, 0.15, -0.05, 0.21);
    sh.quadraticCurveTo(0.04, 0.23, 0.12, 0.17);
    sh.quadraticCurveTo(0.16, 0.08, 0.15, -0.02);
    sh.quadraticCurveTo(0.14, -0.14, 0.10, -0.24);
    sh.quadraticCurveTo(0.04, -0.30, -0.02, -0.26);
    sh.quadraticCurveTo(-0.06, -0.14, -0.08, -0.02);
    sh.quadraticCurveTo(-0.10, 0.05, -0.13, 0.095);
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.30,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.translate(0, 0, -0.14);
    g.rotateY(-Math.PI / 2);
    return crease(g);
  }), mat, [0, 0.02, 0]);
  // 眉上碎瀏海：往上接到頂髮
  add(parent, G('hr-wolf-bang2', () => rbox(0.16, 0.06, 0.04)), mat, [0, 0.12, -0.15]);
  add(parent, G('hr-wolf-bangTip2', () => rbox(0.05, 0.05, 0.03)), mat, [-0.06, 0.095, -0.145]);
  add(parent, G('hr-wolf-bangTip2', () => rbox(0.05, 0.05, 0.03)), mat, [0.05, 0.098, -0.145]);
  // 層次外翻尖束
  const tufts: [number, number, number, number, number, number, number, number][] = [
    [-0.12, 0.02, -0.02, -0.7, -0.2, -0.4, 0.09, 0.022],
    [0.12, 0.02, -0.02, 0.7, -0.2, -0.4, 0.09, 0.022],
    [-0.11, -0.08, 0.02, -0.65, -0.45, 0.1, 0.10, 0.024],
    [0.11, -0.08, 0.02, 0.65, -0.45, 0.1, 0.10, 0.024],
    [-0.08, -0.16, 0.04, -0.45, -0.7, 0.2, 0.09, 0.022],
    [0.08, -0.16, 0.04, 0.45, -0.7, 0.2, 0.09, 0.022],
    [0.0, -0.18, 0.08, 0, -0.6, 0.6, 0.10, 0.024],
    [-0.05, 0.12, 0.08, -0.3, 0.2, 0.8, 0.08, 0.02],
    [0.05, 0.12, 0.08, 0.3, 0.2, 0.8, 0.08, 0.02],
  ];
  for (const s of tufts) addHairSpike(parent, mat, s);
}

/**
 * 側編麻花：辮根在後腦底部，往前披一肩；額前梳起，耳眼全露。
 */
function buildSideBraidHair(parent: THREE.Object3D, mat: THREE.Material) {
  addFullBackCover(parent, mat, 'hr-side');
  // 額前梳起、無瀏海蓋臉
  add(parent, G('hr-side-sweep', () => rbox(0.16, 0.035, 0.05)), mat, [0.02, 0.14, -0.12]);
  add(parent, G('hr-side-sweepL', () => rbox(0.05, 0.04, 0.04)), mat, [-0.1, 0.12, -0.1]);
  // 後頸總根 → 右肩繞到胸前
  add(parent, G('hr-side-gather', () => rbox(0.14, 0.09, 0.09)), mat, [0.02, -0.08, 0.13]);
  const chain: [number, number, number][] = [
    [0.03, -0.10, 0.13],
    [0.10, -0.12, 0.07],
    [0.15, -0.14, 0.01],
    [0.16, -0.16, -0.06],
    [0.14, -0.20, -0.12],
    [0.12, -0.26, -0.15],
    [0.11, -0.34, -0.16],
    [0.10, -0.42, -0.16],
    [0.09, -0.50, -0.15],
    [0.08, -0.58, -0.14],
    [0.07, -0.66, -0.13],
  ];
  addBraidChain(parent, mat, 'hr-side', chain, 0.034);
  // 左肩側披落，蓋住左後側
  const loose = add(parent, G('hr-side-loose', () => rbox(0.055, 0.22, 0.06)), mat, [-0.13, -0.10, 0.04]);
  loose.rotation.z = -0.2;
  const loose2 = add(parent, G('hr-side-loose2', () => rbox(0.05, 0.18, 0.05)), mat, [-0.12, -0.18, 0.06]);
  loose2.rotation.z = -0.15;
}

/**
 * 爆炸頭：復古迪斯可超大圓 afro（低面球簇）。
 * 包覆基準同前（嵌進頭上半、眉上／耳上界線）；外圍半徑放大成飽滿近正圓雲球。
 */
function buildAfroHair(parent: THREE.Object3D, mat: THREE.Material) {
  // 本體頂／側／後延伸交疊，球簇從這層長出去
  add(parent, G('hr-afro-cap8', () => rbox(0.32, 0.07, 0.28)), mat, [0, 0.14, 0.02]);
  add(parent, G('hr-afro-back8', () => rbox(0.30, 0.18, 0.09)), mat, [0, 0.04, 0.145]);
  add(parent, G('hr-afro-nape8', () => rbox(0.26, 0.12, 0.08)), mat, [0, -0.04, 0.13]);
  add(parent, G('hr-afro-side8', () => rbox(0.08, 0.16, 0.22)), mat, [-0.155, 0.08, 0.02]);
  add(parent, G('hr-afro-side8', () => rbox(0.08, 0.16, 0.22)), mat, [0.155, 0.08, 0.02]);
  add(parent, G('hr-afro-brow8', () => rbox(0.24, 0.06, 0.07)), mat, [0, 0.115, -0.145]);

  const CX = 0, CY = 0.16, CZ = 0.04;
  const shellR = 0.30;

  // 核心：略大、填滿內側，避免貼頭皮扁塌
  const cores: [number, number, number, number, number, number, number][] = [
    [CX, CY, CZ, 0.20, 1.15, 1.08, 1.12],
    [CX, CY + 0.04, CZ + 0.06, 0.16, 1.1, 1.05, 1.08],
    [CX - 0.10, CY, CZ + 0.02, 0.14, 1.05, 1.05, 1.05],
    [CX + 0.10, CY, CZ + 0.02, 0.14, 1.05, 1.05, 1.05],
    [CX, CY - 0.04, CZ + 0.08, 0.13, 1.08, 1.0, 1.05],
  ];
  for (const [x, y, z, r, sx, sy, sz] of cores) {
    add(parent, G(`hr-afro-core7-${r}`, () => {
      const g = crease(new THREE.SphereGeometry(r, 7, 5));
      g.scale(sx, sy, sz);
      return g;
    }), mat, [x, y, z]);
  }

  // 球殼取樣：均勻方位角＋仰角，外輪廓趨近正圓；前下半裁掉以免蓋眼／蓋耳
  const shell: [number, number, number, number][] = [];
  const rings = [
    { elev: 1.15, n: 1, rad: 0.10 },   // 正頂
    { elev: 0.85, n: 6, rad: 0.095 },
    { elev: 0.50, n: 8, rad: 0.09 },
    { elev: 0.15, n: 8, rad: 0.09 },
    { elev: -0.20, n: 8, rad: 0.085 }, // 約耳上／後頸上高度
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const az = (i / ring.n) * Math.PI * 2 + ring.elev * 0.3;
      const ce = Math.cos(ring.elev);
      const x = CX + Math.cos(az) * shellR * ce;
      const y = CY + Math.sin(ring.elev) * shellR;
      const z = CZ + Math.sin(az) * shellR * ce;
      // 前下：擋掉會蓋眼／臉的點（y 低且 z 過前）
      if (z < -0.12 && y < 0.14) continue;
      // 兩側下緣：維持耳上（y 太低且 |x| 大）
      if (y < 0.05 && Math.abs(x) > 0.12) continue;
      shell.push([x, y, z, ring.rad]);
    }
  }
  // 補填頂側凹陷（花椰菜縫）
  const fillers: [number, number, number, number][] = [
    [CX - 0.14, CY + 0.18, CZ - 0.02, 0.09],
    [CX + 0.14, CY + 0.18, CZ - 0.02, 0.09],
    [CX - 0.18, CY + 0.10, CZ + 0.06, 0.09],
    [CX + 0.18, CY + 0.10, CZ + 0.06, 0.09],
    [CX - 0.16, CY + 0.06, CZ - 0.04, 0.08],
    [CX + 0.16, CY + 0.06, CZ - 0.04, 0.08],
    [CX, CY + 0.22, CZ + 0.10, 0.095],
    [CX, CY + 0.12, CZ + 0.22, 0.09],
    [CX - 0.12, CY + 0.04, CZ + 0.18, 0.085],
    [CX + 0.12, CY + 0.04, CZ + 0.18, 0.085],
    // 前額雲緣（仍 ≥ 眉上）
    [CX, CY + 0.02, CZ - 0.14, 0.07],
    [CX - 0.09, CY + 0.04, CZ - 0.12, 0.065],
    [CX + 0.09, CY + 0.04, CZ - 0.12, 0.065],
  ];
  for (const c of fillers) shell.push(c);

  for (const [x, y, z, r] of shell) {
    add(parent, G(`hr-afro-curl7-${r}`, () => crease(new THREE.SphereGeometry(r, 6, 5))), mat, [x, y, z]);
  }

  const facets: [number, number, number, number][] = [
    [CX - 0.14, CY + 0.14, CZ + 0.10, 0.08],
    [CX + 0.14, CY + 0.14, CZ + 0.10, 0.08],
    [CX, CY + 0.20, CZ + 0.06, 0.085],
    [CX - 0.10, CY + 0.08, CZ + 0.16, 0.075],
    [CX + 0.10, CY + 0.08, CZ + 0.16, 0.075],
    [CX, CY + 0.06, CZ + 0.20, 0.08],
  ];
  for (const [x, y, z, r] of facets) {
    add(parent, G(`hr-afro-facet7-${r}`, () => crease(new THREE.IcosahedronGeometry(r, 0))), mat, [x, y, z]);
  }
}

/**
 * 飛機頭：兩側剃短，中央一脊幾何尖刺從額際到後頸。
 * 額、眼、臉全露；尖刺稜角清楚，不用大塊方磚。
 */
function buildMohawkHair(parent: THREE.Object3D, mat: THREE.Material) {
  // 中央窄脊底座（從前髮際到後腦）
  add(parent, G('hr-mohawk-ridge', () => rbox(0.055, 0.04, 0.28)), mat, [0, 0.155, 0.0]);
  add(parent, G('hr-mohawk-front', () => rbox(0.045, 0.03, 0.05)), mat, [0, 0.14, -0.13]);
  add(parent, G('hr-mohawk-nape', () => rbox(0.04, 0.03, 0.04)), mat, [0, 0.12, 0.14]);
  // 極薄側 fade，表示剃短但不佔體積
  add(parent, G('hr-mohawk-fade', () => rbox(0.012, 0.022, 0.10)), mat, [-0.09, 0.135, 0.0]);
  add(parent, G('hr-mohawk-fade', () => rbox(0.012, 0.022, 0.10)), mat, [0.09, 0.135, 0.0]);
  // 中央尖脊：從前到後一排向上／略後仰的刺
  const spikes: [number, number, number, number, number, number, number, number][] = [
    [0, 0.16, -0.12, 0, 0.85, -0.45, 0.13, 0.028],
    [0, 0.165, -0.08, 0, 0.95, -0.25, 0.16, 0.030],
    [0, 0.17, -0.04, 0, 1.0, -0.1, 0.18, 0.032],
    [0, 0.175, 0.0, 0, 1.0, 0.05, 0.19, 0.032],
    [0, 0.17, 0.04, 0, 0.98, 0.2, 0.17, 0.030],
    [0, 0.165, 0.08, 0, 0.9, 0.35, 0.14, 0.028],
    [0, 0.155, 0.12, 0, 0.75, 0.55, 0.11, 0.024],
  ];
  for (const s of spikes) addHairSpike(parent, mat, s);
}

/**
 * 武士頭：現代 undercut ＋頭頂緊紮小髻。
 * 兩側／耳上剃短；額前全露；頭髮往後收成頂髻。
 */
function buildSamuraiHair(parent: THREE.Object3D, mat: THREE.Material) {
  addCrownShell(parent, mat, 'hr-sam');
  add(parent, G('hr-sam-gather5', () => rbox(0.1, 0.06, 0.09)), mat, [0, 0.155, 0.10]);
  add(parent, G('hr-sam-stem', () => rcyl(0.022, 0.028, 0.045, 6)), mat, [0, 0.19, 0.08]);
  add(parent, G('hr-sam-bun', () => crease(new THREE.SphereGeometry(0.055, 8, 6))), mat, [0, 0.23, 0.08]);
  add(parent, G('hr-sam-bunTip', () => crease(new THREE.SphereGeometry(0.028, 6, 5))), mat, [0, 0.265, 0.07]);
}

/**
 * 男生長髮：肩長波浪。額前連成一體、不中分；臉與眼睛全露；肩上分層。
 */
function buildMaleLongHair(parent: THREE.Object3D, mat: THREE.Material) {
  add(parent, G('hr-mlong-soft3', () => {
    const sh = new THREE.Shape();
    // 額際整片停眉上；後片到肩；擠出寬過頭皮
    sh.moveTo(-0.13, 0.09);
    sh.quadraticCurveTo(-0.15, 0.15, -0.05, 0.22);
    sh.quadraticCurveTo(0.04, 0.24, 0.13, 0.175);
    sh.quadraticCurveTo(0.17, 0.08, 0.155, -0.04);
    sh.quadraticCurveTo(0.145, -0.16, 0.10, -0.26);
    sh.quadraticCurveTo(0.04, -0.32, -0.02, -0.28);
    sh.quadraticCurveTo(-0.05, -0.16, -0.06, -0.04);
    sh.quadraticCurveTo(-0.09, 0.04, -0.13, 0.09);
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.026,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.translate(0, 0, -0.17);
    g.rotateY(-Math.PI / 2);
    return crease(g);
  }), mat, [0, 0.02, 0]);
  // 肩上幾何分股
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const strand = add(
        parent,
        G(`hr-mlong-strand-${i}`, () => rbox(0.035, 0.14 + i * 0.02, 0.045)),
        mat,
        [s * (0.11 + i * 0.025), -0.16 - i * 0.04, 0.02 + i * 0.02],
      );
      strand.rotation.z = s * (0.2 + i * 0.08);
      strand.rotation.x = 0.12 + i * 0.06;
    }
  }
}

/**
 * 女生長髮：波浪披肩。額前連成一體、不中分；不蓋眼；肩上有層次捲。
 */
function buildLongHair(parent: THREE.Object3D, mat: THREE.Material) {
  add(parent, G('hr-long-soft3', () => {
    const sh = new THREE.Shape();
    // 額際整片停眉上；擠出寬過頭皮，頂側一體
    sh.moveTo(-0.14, 0.09);
    sh.quadraticCurveTo(-0.155, 0.15, -0.06, 0.23);
    sh.quadraticCurveTo(0.04, 0.25, 0.14, 0.185);
    sh.quadraticCurveTo(0.18, 0.08, 0.165, -0.06);
    sh.quadraticCurveTo(0.155, -0.20, 0.13, -0.34);
    sh.quadraticCurveTo(0.08, -0.48, 0.0, -0.45);
    sh.quadraticCurveTo(-0.04, -0.32, -0.05, -0.16);
    sh.quadraticCurveTo(-0.06, -0.04, -0.11, 0.05);
    sh.quadraticCurveTo(-0.13, 0.08, -0.14, 0.09);
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.35,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.024,
      bevelSegments: 3,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.175);
    g.rotateY(-Math.PI / 2);
    return crease(g);
  }), mat, [0, 0.02, 0]);
  // 肩上層次捲
  for (const s of [-1, 1]) {
    const curl = add(parent, G('hr-long-curl', () => rbox(0.07, 0.16, 0.09)), mat, [s * 0.145, -0.28, 0.04]);
    curl.rotation.z = s * 0.35;
    curl.rotation.x = 0.2;
    const curl2 = add(parent, G('hr-long-curl2', () => rbox(0.055, 0.12, 0.07)), mat, [s * 0.12, -0.38, 0.08]);
    curl2.rotation.z = s * 0.4;
    curl2.rotation.x = 0.35;
  }
}

/**
 * 女生短髮：單一弧線剪影擠出成圓潤鮑伯。
 * 平滑瀏海與下巴線，自然頂部弧度；寬度略小於耳距，耳朵會露出。
 */
function buildBobHair(parent: THREE.Object3D, mat: THREE.Material) {
  add(parent, G('hr-bob-soft3', () => {
    const sh = new THREE.Shape();
    // 側視：前(-)後(+)。瀏海停眉上；擠出寬過頭皮，頂側一體
    sh.moveTo(-0.155, 0.088);
    sh.quadraticCurveTo(-0.17, 0.15, -0.08, 0.22);
    sh.quadraticCurveTo(0.02, 0.25, 0.12, 0.205);
    sh.quadraticCurveTo(0.185, 0.12, 0.17, 0.02);
    sh.quadraticCurveTo(0.165, -0.08, 0.08, -0.145);
    sh.quadraticCurveTo(0.0, -0.165, -0.06, -0.10);
    sh.quadraticCurveTo(-0.11, -0.02, -0.13, 0.06);
    sh.quadraticCurveTo(-0.15, 0.08, -0.155, 0.088);
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.022,
      bevelSegments: 3,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.17);
    g.rotateY(-Math.PI / 2);
    return crease(g);
  }), mat, [0, 0.02, 0]);
}

/** 頭髮：一律建原本剪影；戴帽時再壓扁頭頂，不換成另一套帽下造型。 */
function buildHair(rig: PlayerRig, hair: EquipVis, cover: HairCover = 'none') {
  const g = ensureDet(rig.head, DET.hair);
  setBaseHairVisible(rig.head, false);
  if (hair.id === 'hr_none') {
    applyHairHatSquash(g, 'none', hair.id);
    return;
  }
  const mat = rig.outfitMats.hair[0];
  if (!mat) return;
  if (hair.id === 'hr_basic') buildCropHair(g, mat);
  else if (hair.id === 'hr_mlong') buildMaleLongHair(g, mat);
  else if (hair.id === 'hr_samurai') buildSamuraiHair(g, mat);
  else if (hair.id === 'hr_afro') buildAfroHair(g, mat);
  else if (hair.id === 'hr_mohawk') buildMohawkHair(g, mat);
  else if (hair.id === 'hr_lowbun') buildLowBunHair(g, mat);
  else if (hair.id === 'hr_twinbraid') buildTwinBraidHair(g, mat);
  else if (hair.id === 'hr_halfbun') buildHalfBunHair(g, mat);
  else if (hair.id === 'hr_wolf') buildWolfHair(g, mat);
  else if (hair.id === 'hr_sidebraid') buildSideBraidHair(g, mat);
  else if (hair.id === 'hr_bob') buildBobHair(g, mat);
  else if (hair.id === 'hr_long') buildLongHair(g, mat);
  else if (hair.id === 'hr_spike') buildSpikeHair(g, mat);
  else if (hair.id === 'hr_reggae') buildDreadHair(g, mat);
  else {
    const profile = HAIR_PROFILE[hair.id];
    if (!profile) return;
    addHairScalp(g, mat);
    add(g, hairSilhouette(profile, 0.32), mat, [0, 0.02, 0]);
  }
  applyHairHatSquash(g, cover, hair.id);
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
    // 短打只穿軀幹：手臂不加袖／袖口（保持裸臂）
    const cloth = texM;
    const dark = solid(0x1a2438, 'ns-dark', { roughness: 0.82 });
    const cream = solid(0xe8e2d4, 'ns-tie', { roughness: 0.7 });
    add(g, G('ns-col', () => rbox(0.12, 0.075, 0.07)), cloth, [-0.08, 0.345, -0.08], [0.22, 0.18, 0.28]);
    add(g, G('ns-col', () => rbox(0.12, 0.075, 0.07)), cloth, [0.08, 0.345, -0.08], [0.22, -0.18, -0.28]);
    add(g, G('ns-hem', () => rbox(0.39, 0.028, 0.23)), dark, [0, -0.112, 0]);
    add(g, G('ns-tie', () => rbox(0.055, 0.016, 0.016)), cream, [-0.05, 0.05, -0.122]);
    add(g, G('ns-tie', () => rbox(0.055, 0.016, 0.016)), cream, [0.05, 0.05, -0.122]);
    add(g, G('ns-knot', () => rbox(0.03, 0.03, 0.02)), cream, [0, 0.05, -0.128]);
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
  texM.visible = true;
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
  cuffM.visible = true;
  // 袖身略往肘延伸，蓋住小臂上端膚色面（同貼圖）；略粗於小臂，避免被臂 mesh 吃掉
  const coverG = G('slv-cover2', () => rbox(0.118, 0.26, 0.118));
  const cuffG = G('slv-cuff2', () => rcyl(0.062, 0.058, 0.04, 8));
  const stripeG = G('slv-stripe2', () => rbox(0.022, 0.24, 0.122));
  for (const arm of [rig.lowerL, rig.lowerR]) {
    if (!arm) continue;
    arm.visible = true;
    const g = ensureDet(arm, DET.sleeve);
    g.visible = true;
    const cover = add(g, coverG, texM, [0, -0.01, 0]);
    cover.visible = true;
    cover.renderOrder = 2;
    const cuff = add(g, cuffG, cuffM, [0, 0.11, 0]);
    cuff.visible = true;
    cuff.renderOrder = 2;
    if (hand.id === 'sl_neon') {
      const s = add(g, stripeG, SM('slv-white', 0xe8f8f0), [0.03, -0.01, 0]);
      s.visible = true; s.renderOrder = 2;
    }
    if (hand.id === 'sl_nightwrap') {
      const s = add(g, stripeG, SM('slv-indigo', 0x2a4a7a), [0.03, -0.01, 0]);
      s.visible = true; s.renderOrder = 2;
    }
    if (hand.id === 'sl_rain') {
      const s = add(g, G('slv-ref2', () => rbox(0.12, 0.02, 0.12)), SM('slv-ref', 0xe8e6d8, { roughness: 0.4 }), [0, 0.04, 0]);
      s.visible = true; s.renderOrder = 2;
    }
  }
  // 上臂本體也強制顯示（貼袖套材質）
  for (const arm of [rig.upperL, rig.upperR]) {
    if (!arm) continue;
    arm.visible = true;
    arm.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.visible = true;
        delete o.userData.mergeSource;
      }
    });
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
  const hair = BY_ID.get(o.hair)!;
  const head = BY_ID.get(o.head)!;
  const hand = BY_ID.get(o.hand)!;
  const body = BY_ID.get(o.body)!;
  const legs = BY_ID.get(o.legs)!;
  const feet = BY_ID.get(o.feet)!;
  const SKIN_HEX = '#e8bc98';
  const shirtless = body.id === 'bd_bikini' || body.id === 'bd_none';
  const sleeveless = body.id === 'bd_singlet' || body.id === 'bd_nightshort';
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
  // 短袖／無袖＋基本袖：裸臂；真正的 sl_* 袖套仍要顯示（小偷套夜行手袖等）
  const bareArms = hand.id === 'hn_none'
    || ((shirtless || sleeveless || body.id === 'bd_nightshort') && hand.id === 'hn_basic');
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
    m.color.set(hair.id === 'hr_none' ? SKIN_HEX : hair.base);
    m.needsUpdate = true;
  }
  // 先帽後髮：依帽子遮罩等級建「帽下版」髮型，避免髮穿出帽冠
  if (rig.hatG) buildHat(rig.hatG, head);
  buildHair(rig, hair, hairCoverFor(head.id));
  buildBodyDetails(rig, body);
  if (body.id !== 'bd_hawaii') {
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
