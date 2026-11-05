import * as THREE from 'three';
import { rbox, rcyl, crease } from './geo';
import type { PlayerRig } from './dm/character';

/** 服飾視覺（與 main EQUIP id 對齊；只負責外觀） */
export type EquipVis = {
  slot: 'head' | 'hand' | 'body' | 'legs' | 'feet';
  id: string;
  base: string;
  pat: 'plain' | 'flower' | 'rain' | 'camo' | 'neon' | 'tattoo' | 'dragon';
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
  { slot: 'legs', id: 'lg_basic', base: '#4a4a52', pat: 'plain' },
  { slot: 'legs', id: 'lg_rain', base: '#ffd21a', pat: 'rain' },
  { slot: 'legs', id: 'lg_flower', base: '#e86a8a', pat: 'flower' },
  { slot: 'legs', id: 'lg_camo', base: '#5a6b3a', pat: 'camo' },
  { slot: 'feet', id: 'ft_basic', base: '#2a5ab0', pat: 'plain' },
  { slot: 'feet', id: 'ft_boots', base: '#ffd21a', pat: 'plain' },
  { slot: 'feet', id: 'ft_work', base: '#6a4a2a', pat: 'plain' },
  { slot: 'feet', id: 'ft_gold', base: '#e8b830', pat: 'plain' },
];

const BY_ID = new Map(EQUIP_VIS.map(e => [e.id, e]));
const DEFAULTS: OutfitIds = {
  head: 'hd_basic', hand: 'hn_basic', body: 'bd_basic', legs: 'lg_basic', feet: 'ft_basic',
};

export function normalizeOutfitIds(raw?: Partial<OutfitIds> | null): OutfitIds {
  const pick = (slot: keyof OutfitIds, id?: string) => {
    const e = id ? BY_ID.get(id) : undefined;
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

function patDraw(g: CanvasRenderingContext2D, e: EquipVis, W: number, H: number) {
  g.fillStyle = e.base; g.fillRect(0, 0, W, H);
  const dot = (x: number, y: number, r: number, col: string) => {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  };
  if (e.pat === 'flower') for (let i = 0; i < 40; i++) {
    const x = (i * 37) % W, y = (i * 53) % H;
    for (let k = 0; k < 5; k++) dot(x + Math.cos(k * 1.26) * 5, y + Math.sin(k * 1.26) * 5, 3, '#fff3c8');
    dot(x, y, 2.5, '#3a8a4a');
  }
  if (e.pat === 'rain') {
    g.strokeStyle = '#fff7a0'; g.lineWidth = 3;
    for (let y = 10; y < H; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  }
  if (e.pat === 'camo') for (let i = 0; i < 30; i++) {
    dot((i * 41) % W, (i * 29) % H, 8 + (i % 3) * 4, ['#2e3a1e', '#8a7a4a', '#3e5228'][i % 3]);
  }
  if (e.pat === 'neon') { g.fillStyle = '#ffffff'; for (let y = 20; y < H; y += 40) g.fillRect(0, y, W, 6); }
  if (e.pat === 'tattoo') {
    g.strokeStyle = '#1e2a4a'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(W / 2, H + 12 - i * 22, 40, Math.PI, 2 * Math.PI); g.stroke(); }
    dot(40, 40, 9, '#b8323a'); dot(90, 80, 9, '#2a5a9a');
  }
  if (e.pat === 'dragon') {
    g.strokeStyle = '#ffd25a'; g.lineWidth = 4; g.beginPath();
    for (let x = 0; x <= W; x += 4) g.lineTo(x, H / 2 + Math.sin(x / 10) * 26);
    g.stroke();
  }
}

const texCache = new Map<string, THREE.CanvasTexture>();
export function makeEqTexture(e: EquipVis): THREE.CanvasTexture {
  let t = texCache.get(e.id);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  patDraw(c.getContext('2d')!, e, 128, 128);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  texCache.set(e.id, t);
  return t;
}

function paintMat(m: THREE.MeshStandardMaterial, e: EquipVis) {
  m.map = makeEqTexture(e);
  m.color.set(0xffffff);
  m.emissive.setHex(e.pat === 'neon' ? 0x1a6a40 : 0x000000);
  m.emissiveIntensity = e.pat === 'neon' ? 0.35 : 0;
  m.needsUpdate = true;
}

function clearHat(hat: THREE.Group) {
  while (hat.children.length) {
    const c = hat.children.pop()!;
    c.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  }
}

function buildHat(hat: THREE.Group, head: EquipVis) {
  clearHat(hat);
  const col = new THREE.Color(head.base);
  const M = (c: THREE.Color) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: false });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number]) => {
    const x = new THREE.Mesh(g, m); x.position.set(...p); hat.add(x); return x;
  };
  if (head.id === 'hd_hat') {
    add(crease(new THREE.ConeGeometry(0.28, 0.16, 12)), M(col), [0, 0.2, 0]);
  } else if (head.id === 'hd_fisher') {
    add(rcyl(0.16, 0.16, 0.08, 12), M(col), [0, 0.16, 0]);
    add(rbox(0.16, 0.015, 0.12), M(col.clone().multiplyScalar(0.85)), [0, 0.12, 0.14]);
  } else if (head.id === 'hd_helmet') {
    add(crease(new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, 1.4)), M(col), [0, 0.14, 0]);
    add(rbox(0.22, 0.04, 0.08), M(col.clone().multiplyScalar(0.9)), [0, 0.2, 0]);
  } else if (head.id === 'hd_crown') {
    add(rcyl(0.14, 0.16, 0.1, 10), M(col), [0, 0.18, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(rbox(0.04, 0.1, 0.04), M(col), [Math.sin(a) * 0.14, 0.28, Math.cos(a) * 0.14]);
    }
  } else {
    // 花布頭巾：薄蓋在髮頂
    add(rbox(0.32, 0.04, 0.32), M(col), [0, 0.16, 0.02]);
  }
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
  for (const m of mats.body) paintMat(m, body);
  for (const m of mats.sleeve) paintMat(m, hand);
  for (const m of mats.legs) paintMat(m, legs);
  for (const m of mats.feet) paintMat(m, feet);
  for (const m of mats.hair) {
    // 頭髮維持深色；頭巾色由帽子／頭飾表現
    m.color.setHex(0x222222);
    m.map = null;
    m.emissive.setHex(0);
    m.needsUpdate = true;
  }
  if (rig.hatG) buildHat(rig.hatG, head);
  rig.outfitKey = outfitKey(o);
  return o;
}
