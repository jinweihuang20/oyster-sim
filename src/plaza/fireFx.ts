import * as THREE from 'three';
import { rboxEnv } from '../core/geo';

export type CharcoalFireFx = {
  group: THREE.Group;
  light: THREE.PointLight | null;
  tick: (tSec: number, dt: number) => void;
  dispose: () => void;
};

export type CharcoalFireOpts = {
  /** 炭床寬（X） */
  width?: number;
  /** 炭床深（Z） */
  depth?: number;
  lowDetail?: boolean;
  /** 是否加跳動點光 */
  withLight?: boolean;
  lightIntensity?: number;
  lightDistance?: number;
  /** 煙柱強度 0＝無 */
  smoke?: number;
  /** 火舌（烤位可關，只留燒紅木炭） */
  flames?: boolean;
  /** 飛揚火星 */
  sparks?: boolean;
  /** 木炭塊數量（未指定則依 lowDetail） */
  chunks?: number;
  /** 燒紅炭比例 0～1 */
  hotRatio?: number;
  /** 燒紅／閃爍速度（1＝預設；烤位可降） */
  pulseSpeed?: number;
  /** 壓扁炭層（烤網下用，避免冒出網面） */
  flat?: boolean;
  /** 亂數種子（同台穩定） */
  seed?: number;
};

type Flame = { mesh: THREE.Mesh; bx: number; bz: number; phase: number; h: number; s: number };
type Ember = { mesh: THREE.Mesh; bx: number; bz: number; phase: number; amp: number };
type Smoke = {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  vx: number;
  vz: number;
  speed: number;
  base: number;
  bx: number;
  bz: number;
};
type HotChunk = {
  mesh: THREE.Mesh;
  glow: THREE.Mesh | null;
  mat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshBasicMaterial | null;
  baseY: number;
  phase: number;
};

/** 共用幾何／冷炭材質（多台烤爐共用） */
const flameGeo = new THREE.ConeGeometry(0.045, 0.14, 5, 1, true);
flameGeo.translate(0, 0.07, 0);
const emberGeo = new THREE.SphereGeometry(0.018, 4, 3);
const smokeGeo = new THREE.SphereGeometry(0.07, 6, 5);
const coalChunkGeo = rboxEnv(0.1, 0.05, 0.08);
const coalGlowGeo = new THREE.SphereGeometry(0.04, 5, 4);

const coalMat = new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 1, metalness: 0 });
const flameMat = new THREE.MeshBasicMaterial({
  color: 0xff6a22,
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const flameTipMat = new THREE.MeshBasicMaterial({
  color: 0xffc45a,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const emberMat = new THREE.MeshBasicMaterial({
  color: 0xff9020,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});
const smokeMat = new THREE.MeshBasicMaterial({
  color: 0x8a8680,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});

function rng(seed: number) {
  let r = (seed >>> 0) || 1;
  return () => {
    r = (r * 1664525 + 1013904223) >>> 0;
    return r / 4294967296;
  };
}

function makeHotCoalMat() {
  return new THREE.MeshStandardMaterial({
    color: 0x2a1410,
    roughness: 0.92,
    metalness: 0.08,
    emissive: 0xff3a10,
    emissiveIntensity: 0.85,
  });
}

/**
 * 炭火／燒紅木炭：不規則炭塊、可選火舌／煙／點光。
 * 供共烤台／夜市烤肉攤共用。
 */
export function makeCharcoalFire(opts: CharcoalFireOpts = {}): CharcoalFireFx {
  const w = opts.width ?? 0.9;
  const d = opts.depth ?? 0.9;
  const lo = !!opts.lowDetail;
  const wantFlames = opts.flames !== false;
  const wantSparks = opts.sparks ?? (!lo && wantFlames);
  const smokeN = Math.max(0, Math.round((opts.smoke ?? (wantFlames ? 1 : 0)) * (lo ? 5 : 10)));
  const nChunk = opts.chunks ?? (lo ? 7 : 14);
  const hotRatio = opts.hotRatio ?? 0.45;
  const pulseSp = Math.max(0.05, opts.pulseSpeed ?? 1);
  const flat = !!opts.flat;
  const rn = rng(opts.seed ?? 42);

  const group = new THREE.Group();
  group.name = 'charcoalFire';

  // 底炭層（flat：薄層，鋼盤與烤網之間）
  const bed = new THREE.Mesh(rboxEnv(w, flat ? 0.022 : 0.045, d), coalMat);
  bed.position.y = 0;
  bed.userData.sharedMat = true;
  group.add(bed);

  // 不規則炭塊（燒紅者各自材質，可獨立脈動）
  const hotChunks: HotChunk[] = [];
  for (let i = 0; i < nChunk; i++) {
    const hot = rn() < hotRatio;
    const mat = hot ? makeHotCoalMat() : coalMat;
    const m = new THREE.Mesh(coalChunkGeo, mat);
    m.userData.sharedGeo = true;
    m.userData.sharedMat = !hot;
    // flat：炭貼床面、高度壓在烤網下（約 0.06～0.07 淨空）
    const cy = flat ? (0.008 + rn() * 0.012) : (0.018 + rn() * 0.028);
    m.position.set((rn() - 0.5) * w * 0.84, cy, (rn() - 0.5) * d * 0.84);
    m.rotation.set(rn() * (flat ? 0.4 : 1.2), rn() * 6.28, rn() * (flat ? 0.4 : 1.2));
    const s = flat ? (0.6 + rn() * 0.75) : (0.65 + rn() * 1.15);
    const sy = flat ? (0.32 + rn() * 0.28) : (0.5 + rn() * 0.75);
    m.scale.set(s * (0.7 + rn() * 0.65), sy, s * (0.7 + rn() * 0.55));
    group.add(m);

    let glow: THREE.Mesh | null = null;
    let glowMat: THREE.MeshBasicMaterial | null = null;
    if (hot) {
      glowMat = new THREE.MeshBasicMaterial({
        color: 0xff4a18,
        transparent: true,
        opacity: flat ? 0.35 : 0.4,
        depthWrite: false,
      });
      glow = new THREE.Mesh(coalGlowGeo, glowMat);
      glow.userData.sharedGeo = true;
      glow.position.copy(m.position);
      glow.position.y += flat ? 0.008 : 0.02;
      glow.scale.setScalar((flat ? 0.35 : 0.55) + rn() * (flat ? 0.3 : 0.55));
      glow.renderOrder = 2;
      group.add(glow);
      hotChunks.push({ mesh: m, glow, mat: mat as THREE.MeshStandardMaterial, glowMat, baseY: sy, phase: rn() * 6.28 });
    }
  }

  // 火舌（可關）
  const flames: Flame[] = [];
  if (wantFlames) {
    const nFlame = lo ? 4 : 7;
    for (let i = 0; i < nFlame; i++) {
      const tip = i % 2 === 0;
      const mesh = new THREE.Mesh(flameGeo, tip ? flameTipMat : flameMat);
      mesh.userData.sharedGeo = true;
      mesh.userData.sharedMat = true;
      mesh.renderOrder = 2;
      const bx = (rn() - 0.5) * w * 0.55;
      const bz = (rn() - 0.5) * d * 0.55;
      mesh.position.set(bx, 0.02, bz);
      group.add(mesh);
      flames.push({ mesh, bx, bz, phase: rn() * 6.28, h: 0.7 + rn() * 0.7, s: 0.55 + rn() * 0.55 });
    }
  }

  // 炭火星
  const embers: Ember[] = [];
  if (wantSparks) {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(emberGeo, emberMat);
      mesh.userData.sharedGeo = true;
      mesh.userData.sharedMat = true;
      mesh.renderOrder = 3;
      const bx = (rn() - 0.5) * w * 0.5;
      const bz = (rn() - 0.5) * d * 0.5;
      mesh.position.set(bx, 0.06, bz);
      group.add(mesh);
      embers.push({ mesh, bx, bz, phase: rn() * 6.28, amp: 0.04 + rn() * 0.08 });
    }
  }

  // 煙（物件池循環）
  const smokes: Smoke[] = [];
  for (let i = 0; i < smokeN; i++) {
    const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
    mesh.userData.sharedGeo = true;
    mesh.renderOrder = 1;
    mesh.visible = false;
    group.add(mesh);
    smokes.push({
      mesh,
      age: rn() * 2.5,
      life: 1.6 + rn() * 1.8,
      vx: (rn() - 0.5) * 0.12,
      vz: (rn() - 0.5) * 0.12,
      speed: 0.22 + rn() * 0.28,
      base: 0.14 + rn() * 0.12,
      bx: (rn() - 0.5) * w * 0.4,
      bz: (rn() - 0.5) * d * 0.4,
    });
  }

  let light: THREE.PointLight | null = null;
  const baseI = opts.lightIntensity ?? 3.6;
  if (opts.withLight !== false && !lo) {
    // 無火時偏暗紅炭光；有火時偏橙
    light = new THREE.PointLight(wantFlames ? 0xff7a30 : 0xff5520, baseI, opts.lightDistance ?? 4.5, 1.65);
    light.position.set(0, wantFlames ? 0.42 : 0.22, 0);
    light.castShadow = false;
    group.add(light);
  }

  function resetSmoke(s: Smoke, t: number) {
    s.age = 0;
    s.life = 1.5 + rn() * 2;
    s.vx = (rn() - 0.5) * 0.14;
    s.vz = (rn() - 0.5) * 0.14;
    s.speed = 0.2 + rn() * 0.32;
    s.base = 0.12 + rn() * 0.14;
    s.bx = (rn() - 0.5) * w * 0.45;
    s.bz = (rn() - 0.5) * d * 0.45;
    s.mesh.position.set(s.bx, 0.08, s.bz);
    s.mesh.scale.setScalar(s.base);
    s.mesh.visible = true;
    void t;
  }

  function tick(tSec: number, dt: number) {
    const step = Math.min(0.05, Math.max(0, dt));
    const t = tSec * pulseSp;
    const flicker = 0.82 + 0.18 * Math.sin(t * 11.3) + 0.08 * Math.sin(t * 23.7 + 1.2);
    const flicker2 = 0.75 + 0.25 * Math.sin(t * 17.1 + 0.7);

    for (const c of hotChunks) {
      const pulse = 0.55 + 0.45 * Math.sin(t * (5.5 + c.phase * 0.4) + c.phase);
      const pulse2 = 0.5 + 0.5 * Math.sin(t * 13.2 + c.phase * 1.7);
      c.mat.emissiveIntensity = 0.45 + 0.75 * pulse * pulse2;
      // 燒紅色在橙紅間微抖
      const r = 1;
      const g = 0.18 + 0.12 * pulse;
      const bCol = 0.04 + 0.03 * pulse2;
      c.mat.emissive.setRGB(r, g, bCol);
      // flat：幾乎不動高度，避免脈動頂穿烤網
      c.mesh.scale.y = c.baseY * (flat ? (0.96 + 0.04 * pulse) : (0.9 + 0.12 * pulse));
      if (c.glow && c.glowMat) {
        c.glow.position.x = c.mesh.position.x;
        c.glow.position.z = c.mesh.position.z;
        c.glow.position.y = c.mesh.position.y + (flat ? 0.004 : 0.015) + pulse * (flat ? 0.003 : 0.01);
        const gs = (flat ? 0.32 : 0.5) + pulse * (flat ? 0.22 : 0.55);
        c.glow.scale.setScalar(gs * (0.7 + c.baseY * 0.35));
        c.glowMat.opacity = (flat ? 0.14 : 0.22) + (flat ? 0.22 : 0.38) * pulse * pulse2;
        c.glowMat.color.setRGB(1, 0.22 + 0.2 * pulse, 0.06);
      }
    }

    for (const f of flames) {
      const wave = 0.55 + 0.45 * Math.sin(t * (7 + f.h * 3) + f.phase);
      const lean = Math.sin(t * 2.4 + f.phase) * 0.12;
      f.mesh.position.x = f.bx + lean * 0.04;
      f.mesh.position.z = f.bz + Math.cos(t * 1.8 + f.phase) * 0.03;
      f.mesh.scale.set(f.s * (0.75 + wave * 0.35), f.h * (0.65 + wave * 0.7), f.s * (0.75 + wave * 0.3));
      f.mesh.rotation.z = lean;
      f.mesh.rotation.x = Math.sin(t * 3.1 + f.phase) * 0.15;
    }

    for (const e of embers) {
      const u = (t * 0.55 + e.phase) % 1;
      const rise = u * e.amp * 4;
      e.mesh.position.set(
        e.bx + Math.sin(t * 4 + e.phase) * 0.03,
        0.05 + rise,
        e.bz + Math.cos(t * 3.2 + e.phase) * 0.03,
      );
      e.mesh.scale.setScalar(Math.max(0.05, (1 - u) * 1.15));
      e.mesh.visible = u < 0.92;
    }

    for (const s of smokes) {
      s.age += step;
      if (s.age >= s.life) resetSmoke(s, tSec);
      const u = s.age / s.life;
      const y = 0.1 + u * 0.95 * s.speed * 4.2;
      const drift = u * u;
      s.mesh.position.set(s.bx + s.vx * drift * 2.2, y, s.bz + s.vz * drift * 2.2);
      const sc = s.base * (1 + u * 2.4);
      s.mesh.scale.set(sc * 1.15, sc * 0.85, sc * 1.15);
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 * (1 - u) * (0.7 + 0.3 * flicker2);
      s.mesh.visible = true;
    }

    if (light) {
      light.intensity = baseI * (0.72 + 0.38 * flicker * flicker2);
      light.position.y = (wantFlames ? 0.38 : (flat ? 0.12 : 0.2)) + 0.05 * flicker;
    }
  }

  for (const s of smokes) {
    s.age = rn() * s.life;
    s.mesh.visible = true;
  }

  function dispose() {
    group.removeFromParent();
    for (const s of smokes) (s.mesh.material as THREE.Material).dispose();
    for (const c of hotChunks) {
      c.mat.dispose();
      c.glowMat?.dispose();
    }
    if (light) { light.dispose(); light = null; }
  }

  return { group, light, tick, dispose };
}

/**
 * 薄煙（吸菸區／嘴邊）：無炭火／無光，只循環小煙團。
 */
export function makeCigSmoke(opts: { count?: number; seed?: number; scale?: number } = {}): CharcoalFireFx {
  const rn = rng(opts.seed ?? 8801);
  const n = Math.max(2, opts.count ?? 5);
  const sc = opts.scale ?? 0.55;
  const group = new THREE.Group();
  group.name = 'cigSmoke';
  type S = { mesh: THREE.Mesh; age: number; life: number; vx: number; vz: number; speed: number; base: number };
  const smokes: S[] = [];
  for (let i = 0; i < n; i++) {
    const mat = smokeMat.clone();
    mat.opacity = 0.16;
    mat.color.setHex(0x9a9894);
    const mesh = new THREE.Mesh(smokeGeo, mat);
    mesh.userData.sharedGeo = true;
    mesh.renderOrder = 2;
    mesh.visible = false;
    group.add(mesh);
    smokes.push({
      mesh,
      age: rn() * 2,
      life: 1.2 + rn() * 1.4,
      vx: (rn() - 0.5) * 0.06,
      vz: (rn() - 0.5) * 0.06,
      speed: 0.18 + rn() * 0.22,
      base: 0.08 * sc + rn() * 0.06 * sc,
    });
  }
  function reset(s: S) {
    s.age = 0;
    s.life = 1.1 + rn() * 1.5;
    s.vx = (rn() - 0.5) * 0.07;
    s.vz = (rn() - 0.5) * 0.07;
    s.speed = 0.16 + rn() * 0.24;
    s.base = 0.07 * sc + rn() * 0.07 * sc;
    s.mesh.position.set((rn() - 0.5) * 0.04, 0.02, (rn() - 0.5) * 0.04);
    s.mesh.scale.setScalar(s.base);
    s.mesh.visible = true;
    const m = s.mesh.material as THREE.MeshBasicMaterial;
    m.opacity = 0.18;
  }
  for (const s of smokes) reset(s);
  return {
    group,
    light: null,
    tick: (_t, dt) => {
      const step = Math.min(0.05, Math.max(0, dt));
      for (const s of smokes) {
        s.age += step;
        if (s.age >= s.life) { reset(s); continue; }
        const u = s.age / s.life;
        s.mesh.position.x += s.vx * step;
        s.mesh.position.z += s.vz * step;
        s.mesh.position.y += s.speed * step;
        s.mesh.scale.setScalar(s.base * (1 + u * 1.8));
        const m = s.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = 0.18 * (1 - u);
      }
    },
    dispose: () => {
      for (const s of smokes) {
        const m = s.mesh.material as THREE.Material;
        if (!s.mesh.userData.sharedMat) m.dispose();
      }
      group.clear();
    },
  };
}

/** 第一人稱手持香菸（細白煙柱＋橘紅菸頭＋濾嘴；冒煙重用 makeCigSmoke） */
export type FpCigarette = {
  group: THREE.Group;
  tip: THREE.Object3D;
  smoke: CharcoalFireFx;
  /** 額外菸頭亮度（吸一口時拉高） */
  setTipBoost: (v: number) => void;
  tick: (tSec: number, dt: number) => void;
  dispose: () => void;
};

export function makeFpCigarette(opts: { lowDetail?: boolean } = {}): FpCigarette {
  const group = new THREE.Group();
  group.name = 'fpCigarette';
  // 沿 -Z 伸出（相機前方），右手握著
  const filter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, 0.028, 6),
    new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.9, metalness: 0 }),
  );
  filter.rotation.x = Math.PI / 2;
  filter.position.z = 0.014;
  group.add(filter);
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0048, 0.0048, 0.09, 6),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.95, metalness: 0 }),
  );
  stick.rotation.x = Math.PI / 2;
  stick.position.z = -0.04;
  group.add(stick);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.0062, 6, 5),
    new THREE.MeshStandardMaterial({
      color: 0x3a1810,
      emissive: 0xff4a12,
      emissiveIntensity: 0.95,
      roughness: 0.6,
      metalness: 0.05,
    }),
  );
  tip.position.z = -0.088;
  group.add(tip);
  const smoke = makeCigSmoke({ count: opts.lowDetail ? 2 : 4, seed: 7703, scale: 0.35 });
  smoke.group.position.copy(tip.position);
  smoke.group.position.y += 0.004;
  group.add(smoke.group);
  let tipBoost = 0;
  return {
    group,
    tip,
    smoke,
    setTipBoost: (v) => { tipBoost = Math.max(0, v); },
    tick: (tSec, dt) => {
      // 菸頭微微閃爍；吸一口時更亮
      const m = tip.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.7 + Math.sin(tSec * 7.5) * 0.18 + tipBoost * (0.9 + Math.sin(tSec * 3.2) * 0.25);
      smoke.tick(tSec, dt);
    },
    dispose: () => {
      smoke.dispose();
      group.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.geometry && !mesh.userData.sharedGeo) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else if (mat && !mesh.userData.sharedMat) mat.dispose();
      });
      group.clear();
    },
  };
}


/** 第三人稱方塊人手持菸（掛 lowerR 腕端；比例比 FP 大） */
export function makeAvatarCigarette(opts: { lowDetail?: boolean } = {}): FpCigarette {
  const group = new THREE.Group();
  group.name = 'avatarCigarette';
  const sc = 2.4;
  const filter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055 * sc, 0.0055 * sc, 0.028 * sc, opts.lowDetail ? 5 : 6),
    new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.9, metalness: 0 }),
  );
  filter.rotation.x = Math.PI / 2;
  filter.position.z = 0.014 * sc;
  group.add(filter);
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0048 * sc, 0.0048 * sc, 0.09 * sc, opts.lowDetail ? 5 : 6),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.95, metalness: 0 }),
  );
  stick.rotation.x = Math.PI / 2;
  stick.position.z = -0.04 * sc;
  group.add(stick);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.0065 * sc, opts.lowDetail ? 5 : 6, 4),
    new THREE.MeshStandardMaterial({
      color: 0x3a1810,
      emissive: 0xff4a12,
      emissiveIntensity: 0.95,
      roughness: 0.6,
      metalness: 0.05,
    }),
  );
  tip.position.z = -0.088 * sc;
  group.add(tip);
  const smoke = makeCigSmoke({ count: opts.lowDetail ? 2 : 3, seed: 6601, scale: 0.55 });
  smoke.group.position.copy(tip.position);
  smoke.group.position.y += 0.01;
  group.add(smoke.group);
  let tipBoost = 0;
  return {
    group,
    tip,
    smoke,
    setTipBoost: (v) => { tipBoost = Math.max(0, v); },
    tick: (tSec, dt) => {
      const m = tip.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.7 + Math.sin(tSec * 7.5) * 0.18 + tipBoost * (0.9 + Math.sin(tSec * 3.2) * 0.25);
      smoke.tick(tSec, dt);
    },
    dispose: () => {
      smoke.dispose();
      group.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.geometry && !mesh.userData.sharedGeo) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else if (mat && !mesh.userData.sharedMat) mat.dispose();
      });
      group.clear();
    },
  };
}

/** 彈烟灰：一小點灰粒往下掉 */
export function spawnAshSpeck(parent: THREE.Object3D, local: THREE.Vector3) {
  const mat = smokeMat.clone();
  mat.color.setHex(0x6a6560);
  mat.opacity = 0.55;
  const mesh = new THREE.Mesh(smokeGeo, mat);
  mesh.userData.sharedGeo = true;
  mesh.scale.setScalar(0.04);
  mesh.position.copy(local);
  parent.add(mesh);
  let age = 0;
  const life = 0.55;
  return {
    tick: (dt: number) => {
      age += dt;
      mesh.position.y -= 0.25 * dt;
      mesh.position.x += (Math.random() - 0.5) * 0.02 * dt;
      mat.opacity = 0.55 * Math.max(0, 1 - age / life);
      mesh.scale.setScalar(0.04 * (1 + age * 1.2));
      return age < life;
    },
    dispose: () => {
      parent.remove(mesh);
      mat.dispose();
    },
  };
}

/** 吐煙用柔邊煙霧貼圖：高斯衰減疊低頻雜訊做出絲狀不均勻感（3 種變化） */
const puffTexs: THREE.Texture[] = [];
function getPuffTex(i: number): THREE.Texture {
  if (!puffTexs.length) {
    for (let v = 0; v < 3; v++) {
      const N = 96, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d')!;
      const img = g.createImageData(N, N);
      const rn = rng(4242 + v * 977);
      // 低頻雜訊：幾個隨機高斯小團疊加
      const blobs = Array.from({ length: 9 }, () => ({ x: (rn() - 0.5) * 1.1, y: (rn() - 0.5) * 1.1, r: 0.22 + rn() * 0.3, w: 0.4 + rn() * 0.6 }));
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1;
        const r2 = dx * dx + dy * dy;
        let n = 0;
        for (const b of blobs) { const ex = dx - b.x, ey = dy - b.y; n += b.w * Math.exp(-(ex * ex + ey * ey) / (b.r * b.r)); }
        const env = Math.exp(-r2 * 3.2) * Math.max(0, 1 - r2);
        const a = Math.min(1, env * (0.35 + 0.65 * Math.min(1, n)));
        const k = (y * N + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = Math.round(a * 255);
      }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      puffTexs.push(t);
    }
  }
  return puffTexs[i % puffTexs.length];
}

/** 吐煙：從嘴邊連續噴出一道細煙，前段快、受阻力減速後往上飄、捲動擴散淡出（單次，用完 dispose）。
 *  group 的 -Z 為噴出方向；世界空間使用時請把 group.rotation.y 設成角色朝向。 */
export function makeExhalePuff(opts: { scale?: number; count?: number; seed?: number } = {}): CharcoalFireFx {
  const rn = rng(opts.seed ?? (9000 + Math.floor(Math.random() * 8000)));
  const sc = Math.max(0.15, opts.scale ?? 1);
  const n = Math.min(44, Math.max(10, Math.round((opts.count ?? Math.round(8 + sc * 6)) * 2.6)));
  const group = new THREE.Group();
  group.name = 'exhalePuff';
  type S = { sp: THREE.Sprite; mat: THREE.SpriteMaterial; delay: number; age: number; life: number; vx: number; vy: number; vz: number; s0: number; s1: number; ar: number; rot: number; spin: number; ph: number; fq: number; peak: number; tone: number; lift: number };
  const smokes: S[] = [];
  const emitDur = 0.3 + 0.35 * Math.min(1, sc);
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1);
    const mat = new THREE.SpriteMaterial({ map: getPuffTex(i), color: 0xc2c7cd, transparent: true, opacity: 0, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.renderOrder = 3;
    sp.visible = false;
    group.add(sp);
    // 前段的煙較快較濃，尾段較慢較淡；吐氣方向略朝下
    const speed = (0.5 + rn() * 0.4) * (1 - k * 0.6) * (0.6 + 0.4 * sc);
    const spread = 0.1 + k * 0.22 + rn() * 0.08;
    const ang = rn() * Math.PI * 2;
    smokes.push({
      sp, mat,
      delay: k * emitDur + rn() * 0.04,
      age: 0,
      life: 2.0 + rn() * 1.6,
      vx: Math.cos(ang) * spread * speed,
      vy: Math.sin(ang) * spread * speed - 0.12 * speed,
      vz: -speed,
      s0: (0.014 + rn() * 0.01) * (0.7 + 0.3 * sc),
      s1: (0.13 + rn() * 0.16) * (0.6 + 0.4 * sc),
      ar: 0.6 + rn() * 0.8,
      rot: rn() * Math.PI * 2,
      spin: (rn() - 0.5) * 1.2,
      ph: rn() * Math.PI * 2,
      fq: 1.4 + rn() * 1.8,
      peak: (0.26 + rn() * 0.16) * Math.min(1, 0.55 + 0.45 * sc) * (1 - k * 0.4),
      tone: 0.9 + rn() * 0.14,
      lift: 0.14 + rn() * 0.16,
    });
  }
  let t = 0;
  return {
    group,
    light: null,
    tick: (_t, dt) => {
      const step = Math.min(0.05, Math.max(0, dt));
      t += step;
      const drag = Math.exp(-3.2 * step);
      for (const s of smokes) {
        if (t < s.delay) continue;
        if (s.age === 0) { s.sp.position.set((rn() - 0.5) * 0.006, (rn() - 0.5) * 0.004, -0.005); s.sp.visible = true; }
        s.age += step;
        if (s.age >= s.life) { s.sp.visible = false; continue; }
        const u = s.age / s.life;
        // 阻力減速，熱煙慢慢浮起（越後面浮得越明顯）
        s.vx *= drag; s.vz *= drag; s.vy = s.vy * drag + s.lift * Math.min(1, s.age / 0.6) * step;
        // 捲動：各團不同頻率左右／前後擺，散成一絲一絲
        const curl = 0.08 * Math.min(1, u * 2);
        s.sp.position.x += (s.vx + Math.sin(s.age * s.fq + s.ph) * curl) * step;
        s.sp.position.y += s.vy * step;
        s.sp.position.z += (s.vz + Math.cos(s.age * s.fq * 0.8 + s.ph) * curl * 0.7) * step;
        const grow = 1 - Math.pow(1 - u, 2.4);
        const sz = s.s0 + (s.s1 - s.s0) * grow;
        s.sp.scale.set(sz * s.ar, sz / Math.sqrt(s.ar), 1);
        s.rot += s.spin * step * (1 - u * 0.5);
        s.mat.rotation = s.rot;
        const fadeIn = Math.min(1, s.age / 0.06);
        const fadeOut = Math.pow(1 - u, 1.4);
        s.mat.opacity = s.peak * fadeIn * fadeOut;
        // 剛吐出偏藍灰，散開後轉淡灰白
        const c = s.tone * (0.78 + 0.14 * u);
        s.mat.color.setRGB(c * 0.97, c, c * 1.04);
      }
    },
    dispose: () => {
      for (const s of smokes) s.mat.dispose();
      group.clear();
    },
  };
}
