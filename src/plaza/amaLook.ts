import * as THREE from 'three';
import { rboxEnv } from '../core/geo';
import { applyOutfitToRig, clearOutfitDetails } from '../shop/equipVisual';
import type { PlayerRig } from '../dm/character';
import { rebuildAvatarMerged } from '../dm/avatarMerge';

/** 比玩家略矮、骨架略小 */
export const AMA_SCALE = 0.88;
/** 椅面髖高 0.56；縮放後把人抬回椅面，避免沉進椅子 */
export const AMA_SIT_LIFT = 0.56 * (1 - AMA_SCALE);
export const AMA_HUNCH_TORSO = -0.28;
export const AMA_HUNCH_HEAD_X = 0.16;
export const AMA_HEAD_Y = 0.55;
export const AMA_HEAD_FORWARD = -0.08;
export const AMA_HIP_Y = 0.72;
export const AMA_CARRY_TILT = 1.05;
export const AMA_CARRY_Y = 0.54;
export const AMA_CARRY_FWD = 0.28;
export const AMA_CARRY_ROLL = 0.06;
/** 抱的人躺下：阿婆移到胸口（往頭的方向）並平趴的位置 */
export const AMA_CARRY_LIE_BACK = 0.8;
export const AMA_CARRY_LIE_Y = 0.42;

export function amaCarrySide(tilt = AMA_CARRY_TILT) {
  return AMA_HIP_Y * AMA_SCALE * Math.sin(tilt);
}

export type FloralPal = { base: string; petal: string; center: string };

/** 花布底色／花瓣／花心，依 pid 抽一套，貼圖跨阿婆共用 */
export const AMA_FLORALS: FloralPal[] = [
  { base: '#e07a3a', petal: '#fff3c8', center: '#2f7a38' },
  { base: '#d25a6c', petal: '#fff0f4', center: '#d8a020' },
  { base: '#3d8a62', petal: '#ffe59a', center: '#c04040' },
  { base: '#4a6cac', petal: '#ffe8d4', center: '#d06030' },
  { base: '#d0a44a', petal: '#fff8e4', center: '#6a3a78' },
  { base: '#8a4a7a', petal: '#ffd4e4', center: '#e8c050' },
];

export type AmaFarmLook = {
  pal: number;
  hair: number;
  pants: number;
  headTint: number;
  head: 'none' | 'hd_basic' | 'hd_hat' | 'hd_fisher';
  legs: 'lg_basic' | 'lg_flower';
  feet: 'ft_basic' | 'ft_boots';
  apron: boolean;
  sleeve: number;
  sleeveCheck?: [number, number];
};

/** 白髮包髻為主；帽子較少，避免蓋住髮髻 */
export const AMA_LOOKS: AmaFarmLook[] = [
  { pal: 0, hair: 0xe8e8e8, pants: 0x3a5068, headTint: 0xc84a5a, head: 'none', legs: 'lg_basic', feet: 'ft_basic', apron: true, sleeve: 0x2a3a6a },
  { pal: 1, hair: 0xd4d4d4, pants: 0x4a4a52, headTint: 0x5a7ab0, head: 'none', legs: 'lg_basic', feet: 'ft_basic', apron: false, sleeve: 0x3a5040 },
  { pal: 2, hair: 0xc8c8c8, pants: 0x2a3848, headTint: 0xc84a5a, head: 'hd_basic', legs: 'lg_basic', feet: 'ft_basic', apron: true, sleeve: 0xe8d8c0 },
  { pal: 3, hair: 0xdedede, pants: 0x3a4050, headTint: 0x5a7ab0, head: 'none', legs: 'lg_basic', feet: 'ft_boots', apron: true, sleeve: 0x5a3038, sleeveCheck: [0x5a3038, 0xe8d8c8] },
  { pal: 4, hair: 0xe0e0e0, pants: 0x4a5540, headTint: 0xd8b46a, head: 'hd_hat', legs: 'lg_basic', feet: 'ft_boots', apron: false, sleeve: 0x2a3a6a },
  { pal: 5, hair: 0xc4c4c4, pants: 0x3a5068, headTint: 0xe0b040, head: 'none', legs: 'lg_flower', feet: 'ft_basic', apron: false, sleeve: 0xe8d8c0 },
  { pal: 0, hair: 0xf0f0f0, pants: 0x2a2a38, headTint: 0xc84a5a, head: 'none', legs: 'lg_basic', feet: 'ft_basic', apron: true, sleeve: 0x2a4a7a, sleeveCheck: [0x2a4a7a, 0xf2efe6] },
  { pal: 1, hair: 0xd8d8d8, pants: 0x3a3a48, headTint: 0x4a6a8a, head: 'hd_fisher', legs: 'lg_basic', feet: 'ft_boots', apron: true, sleeve: 0x3a5040 },
  { pal: 2, hair: 0xbebebe, pants: 0x3a3a48, headTint: 0xe0c078, head: 'none', legs: 'lg_flower', feet: 'ft_basic', apron: false, sleeve: 0x6a3038 },
  { pal: 3, hair: 0xe4e4e4, pants: 0x4a5568, headTint: 0x5a7ab0, head: 'hd_basic', legs: 'lg_basic', feet: 'ft_basic', apron: true, sleeve: 0x2a3a6a },
  { pal: 4, hair: 0xcacaca, pants: 0x3a4860, headTint: 0xd0a860, head: 'none', legs: 'lg_basic', feet: 'ft_boots', apron: true, sleeve: 0x5a4030, sleeveCheck: [0x5a4030, 0xf0e6d0] },
  { pal: 5, hair: 0xd0d0d0, pants: 0x3a5068, headTint: 0xc86a5a, head: 'none', legs: 'lg_basic', feet: 'ft_basic', apron: true, sleeve: 0x3a5040 },
];

export function hashPid(pid: string) {
  let h = 0;
  for (let i = 0; i < pid.length; i++) h = (h * 31 + pid.charCodeAt(i)) | 0;
  return h;
}

export function pickAmaLook(pid: string): AmaFarmLook {
  return AMA_LOOKS[Math.abs(hashPid(pid)) % AMA_LOOKS.length];
}

/** 廣場阿婆固定三隻穿比基尼（pid 對齊後端 npc-pXX-sY） */
export const AMA_BIKINI_PIDS = new Set([
  'npc-p01-s4',
  'npc-p04-s5',
  'npc-p13-s4',
]);

export function amaWearsBikini(pid?: string | null) {
  return !!pid && AMA_BIKINI_PIDS.has(pid);
}

export function amaShirtHex(look: AmaFarmLook): number {
  return parseInt(AMA_FLORALS[look.pal % AMA_FLORALS.length].base.slice(1), 16);
}

const floralTexCache = new Map<string, THREE.CanvasTexture>();
const floralMatCache = new Map<string, THREE.MeshStandardMaterial>();
const sleeveMatCache = new Map<string, THREE.MeshStandardMaterial>();
const hairMatCache = new Map<number, THREE.MeshStandardMaterial>();
const checkTexCache = new Map<string, THREE.CanvasTexture>();

let sharedApronM: THREE.MeshStandardMaterial | null = null;
let sharedStrapM: THREE.MeshStandardMaterial | null = null;
let sharedSleeveGeo: THREE.BufferGeometry | null = null;
let sharedBunGeo: THREE.BufferGeometry | null = null;
let sharedBunBaseGeo: THREE.BufferGeometry | null = null;

function floralKey(p: FloralPal) {
  return `${p.base}|${p.petal}|${p.center}`;
}

function getFloralTexture(p: FloralPal): THREE.CanvasTexture {
  const k = floralKey(p);
  let t = floralTexCache.get(k);
  if (t) return t;
  const W = 64;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d')!;
  g.fillStyle = p.base;
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 16; i++) {
    const x = (i * 17 + 10) % W;
    const y = (i * 29 + 12) % W;
    for (let n = 0; n < 5; n++) {
      const a = n * 1.256637;
      g.fillStyle = p.petal;
      g.beginPath();
      g.arc(x + Math.cos(a) * 3.1, y + Math.sin(a) * 3.1, 1.7, 0, 7);
      g.fill();
    }
    g.fillStyle = p.center;
    g.beginPath();
    g.arc(x, y, 1.35, 0, 7);
    g.fill();
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.anisotropy = 2;
  floralTexCache.set(k, t);
  return t;
}

function getFloralMat(p: FloralPal): THREE.MeshStandardMaterial {
  const k = floralKey(p);
  let m = floralMatCache.get(k);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    map: getFloralTexture(p),
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.02,
  });
  floralMatCache.set(k, m);
  return m;
}

function getCheckTexture(a: number, b: number): THREE.CanvasTexture {
  const k = `${a.toString(16)}|${b.toString(16)}`;
  let t = checkTexCache.get(k);
  if (t) return t;
  const W = 32;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d')!;
  const ca = `#${a.toString(16).padStart(6, '0')}`;
  const cb = `#${b.toString(16).padStart(6, '0')}`;
  const s = 8;
  for (let y = 0; y < W; y += s) {
    for (let x = 0; x < W; x += s) {
      g.fillStyle = ((x + y) / s) % 2 === 0 ? ca : cb;
      g.fillRect(x, y, s, s);
    }
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  checkTexCache.set(k, t);
  return t;
}

function getSleeveMat(look: AmaFarmLook): THREE.MeshStandardMaterial {
  const k = look.sleeveCheck
    ? `c:${look.sleeveCheck[0].toString(16)}:${look.sleeveCheck[1].toString(16)}`
    : `s:${look.sleeve.toString(16)}`;
  let m = sleeveMatCache.get(k);
  if (m) return m;
  if (look.sleeveCheck) {
    m = new THREE.MeshStandardMaterial({
      map: getCheckTexture(look.sleeveCheck[0], look.sleeveCheck[1]),
      color: 0xffffff,
      roughness: 0.88,
    });
  } else {
    m = new THREE.MeshStandardMaterial({ color: look.sleeve, roughness: 0.88 });
  }
  sleeveMatCache.set(k, m);
  return m;
}

function getHairMat(color: number): THREE.MeshStandardMaterial {
  let m = hairMatCache.get(color);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
  hairMatCache.set(color, m);
  return m;
}

function retargetMats(
  root: THREE.Object3D,
  from: THREE.MeshStandardMaterial[],
  to: THREE.MeshStandardMaterial,
) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (from.includes(mesh.material as THREE.MeshStandardMaterial)) mesh.material = to;
  });
}

function clearHat(hat: THREE.Group) {
  while (hat.children.length) {
    const c = hat.children.pop()!;
    hat.remove(c);
  }
}

function paintAmaHair(rig: PlayerRig, ama: AmaFarmLook) {
  const mats = rig.outfitMats;
  if (!mats) return;
  for (const m of mats.hair) {
    m.map = null;
    m.color.setHex(ama.hair);
    m.emissive.setHex(0);
    m.needsUpdate = true;
  }
}

function ensureAmaBun(rig: PlayerRig, ama: AmaFarmLook) {
  if (rig.head.userData.amaBun) return;
  const bunM = getHairMat(ama.hair);
  if (!sharedBunGeo) sharedBunGeo = new THREE.SphereGeometry(0.085, 8, 6);
  if (!sharedBunBaseGeo) sharedBunBaseGeo = new THREE.SphereGeometry(0.055, 8, 6);
  const base = new THREE.Mesh(sharedBunBaseGeo, bunM);
  const bun = new THREE.Mesh(sharedBunGeo, bunM);
  // +Z＝後腦；斗笠再往後、往下，避免被帽緣吃掉
  const back = ama.head === 'hd_hat' ? 0.175 : 0.155;
  const by = ama.head === 'hd_hat' ? 0.035 : 0.085;
  base.position.set(0, by - 0.01, back);
  base.scale.set(1.2, 0.52, 1.15);
  bun.position.set(0, by + 0.03, back + 0.01);
  rig.head.add(base);
  rig.head.add(bun);
  rig.head.userData.amaBun = 1;
}

function dressAmaHat(rig: PlayerRig, ama: AmaFarmLook) {
  if (!rig.hatG) return;
  if (ama.head === 'none') {
    clearHat(rig.hatG);
    rig.hatG.position.set(0, 0, 0);
    return;
  }
  const tint = new THREE.Color(ama.headTint);
  rig.hatG.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mesh.isMesh && mat?.color) mat.color.copy(tint);
  });
  // 帽子略往臉側挪，讓後腦白髮包髻露出
  if (ama.head === 'hd_hat') rig.hatG.position.set(0, 0.01, -0.05);
  else if (ama.head === 'hd_fisher') rig.hatG.position.set(0, 0, -0.04);
  else {
    rig.hatG.position.set(0, 0, -0.05);
    const scarf = rig.hatG.children[0] as THREE.Mesh | undefined;
    if (scarf) scarf.scale.set(1, 1, 0.72);
    if (ama.head === 'hd_basic' && !rig.hatG.userData.amaKnot) {
      const knotM = getSleeveMat({ ...ama, sleeve: ama.headTint, sleeveCheck: undefined });
      const knot = new THREE.Mesh(rboxEnv(0.08, 0.06, 0.1), knotM);
      knot.position.set(0.14, 0.12, 0.02);
      knot.rotation.z = 0.4;
      rig.hatG.add(knot);
      rig.hatG.userData.amaKnot = 1;
    }
  }
}

/** 套花布衫、袖套、白髮包髻；帽子較少且讓髮髻露在後面。少數 pid 改穿比基尼。 */
export function dressPlazaAma(rig: PlayerRig, ama: AmaFarmLook, pid?: string) {
  if (amaWearsBikini(pid)) {
    // 比基尼本體由 applyOutfitToRig 建；勿 clearOutfitDetails
    applyOutfitToRig(rig, {
      head: ama.head === 'none' ? 'hd_none' : ama.head,
      hand: 'hn_basic',
      body: 'bd_bikini',
      legs: 'lg_none',
      feet: 'ft_basic',
    });
    paintAmaHair(rig, ama);
    dressAmaHat(rig, ama);
    ensureAmaBun(rig, ama);
    rig.head.position.set(0, AMA_HEAD_Y, AMA_HEAD_FORWARD);
    applyAmaScale(rig);
    rebuildAvatarMerged(rig);
    return;
  }

  const pal = AMA_FLORALS[ama.pal % AMA_FLORALS.length];
  applyOutfitToRig(rig, {
    head: ama.head === 'none' ? 'hd_basic' : ama.head,
    hand: 'hn_basic',
    body: 'bd_basic',
    legs: ama.legs,
    feet: ama.feet,
  });
  clearOutfitDetails(rig);
  const mats = rig.outfitMats;
  if (!mats) return;

  const flor = getFloralMat(pal);
  retargetMats(rig.torso, mats.body, flor);
  retargetMats(rig.torso, mats.sleeve, flor);
  mats.body[0] = flor;
  if (mats.sleeve[0]) mats.sleeve[0] = flor;

  paintAmaHair(rig, ama);

  if (ama.legs === 'lg_basic') {
    for (const m of mats.legs) {
      m.map = null;
      m.color.setHex(ama.pants);
      m.emissive.setHex(0);
      m.needsUpdate = true;
    }
  }
  if (ama.feet === 'ft_basic') {
    if (mats.feet[0]) {
      mats.feet[0].map = null;
      mats.feet[0].color.setHex(0x2a5ab0);
      mats.feet[0].needsUpdate = true;
    }
    if (mats.feet[1]) {
      mats.feet[1].map = null;
      mats.feet[1].color.setHex(0xf6f2ea);
      mats.feet[1].needsUpdate = true;
    }
  }

  dressAmaHat(rig, ama);

  if (ama.apron && !rig.torso.userData.amaApron) {
    if (!sharedApronM) sharedApronM = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.92 });
    if (!sharedStrapM) sharedStrapM = new THREE.MeshStandardMaterial({ color: 0xe4ddd0, roughness: 0.9 });
    const apron = new THREE.Mesh(rboxEnv(0.26, 0.34, 0.03), sharedApronM);
    apron.position.set(0, 0.02, -0.13);
    rig.torso.add(apron);
    for (const s of [-1, 1] as const) {
      const strap = new THREE.Mesh(rboxEnv(0.028, 0.2, 0.02), sharedStrapM);
      strap.position.set(s * 0.09, 0.28, -0.1);
      strap.rotation.z = s * 0.18;
      rig.torso.add(strap);
    }
    const pocket = new THREE.Mesh(rboxEnv(0.1, 0.08, 0.02), sharedStrapM);
    pocket.position.set(0.06, -0.06, -0.145);
    rig.torso.add(pocket);
    rig.torso.userData.amaApron = 1;
  }

  ensureAmaBun(rig, ama);

  if (!rig.lowerL.userData.amaSleeve) {
    if (!sharedSleeveGeo) sharedSleeveGeo = rboxEnv(0.112, 0.175, 0.112);
    const sm = getSleeveMat(ama);
    for (const arm of [rig.lowerL, rig.lowerR]) {
      const cover = new THREE.Mesh(sharedSleeveGeo, sm);
      // +Y 朝手腕：袖套偏肘、露出一點腕
      cover.position.set(0, -0.015, 0);
      arm.add(cover);
      arm.userData.amaSleeve = 1;
    }
  }

  rig.head.position.set(0, AMA_HEAD_Y, AMA_HEAD_FORWARD);
  applyAmaScale(rig);
  rebuildAvatarMerged(rig);
}

/** 吸菸區阿伯：老年男性，不套阿婆花布／包髻 */
export function dressPlazaAber(rig: PlayerRig) {
  applyOutfitToRig(rig, {
    head: 'hd_basic',
    hand: 'hn_basic',
    body: 'bd_basic',
    legs: 'lg_basic',
    feet: 'ft_basic',
  });
  clearOutfitDetails(rig);
  if (rig.hatG) {
    clearHat(rig.hatG);
    rig.hatG.position.set(0, 0, 0);
  }
  const mats = rig.outfitMats;
  if (!mats) return;
  for (const m of mats.body) {
    m.map = null;
    m.color.setHex(0x4a6a8a);
    m.emissive.setHex(0);
    m.needsUpdate = true;
  }
  for (const m of mats.sleeve) {
    m.map = null;
    m.color.setHex(0x4a6a8a);
    m.needsUpdate = true;
  }
  for (const m of mats.hair) {
    m.map = null;
    m.color.setHex(0x8a8a8a);
    m.emissive.setHex(0);
    m.needsUpdate = true;
  }
  for (const m of mats.legs) {
    m.map = null;
    m.color.setHex(0x3a3a48);
    m.needsUpdate = true;
  }
  rebuildAvatarMerged(rig);
}

export function applyAmaScale(rig: PlayerRig) {
  rig.outer.scale.setScalar(AMA_SCALE);
}

/**
 * 駝背＋頭略前伸。可重覆呼叫：若姿勢函式重設了旋轉就再疊一次，已疊過則略過。
 */
export function applyAmaAppearance(rig: PlayerRig) {
  applyAmaScale(rig);
  const t = rig.torso;
  const cur = t.rotation.x;
  const from = t.userData.amaTorsoFrom as number | undefined;
  if (from == null || Math.abs(cur - (from + AMA_HUNCH_TORSO)) > 1e-5) {
    t.userData.amaTorsoFrom = cur;
    t.rotation.x = cur + AMA_HUNCH_TORSO;
  }
  if (rig.head) {
    rig.head.position.set(0, AMA_HEAD_Y, AMA_HEAD_FORWARD);
    const hc = rig.head.rotation.x;
    const hf = rig.head.userData.amaHeadFrom as number | undefined;
    if (hf == null || Math.abs(hc - (hf + AMA_HUNCH_HEAD_X)) > 1e-5) {
      rig.head.userData.amaHeadFrom = hc;
      rig.head.rotation.x = hc + AMA_HUNCH_HEAD_X;
    }
  }
}
