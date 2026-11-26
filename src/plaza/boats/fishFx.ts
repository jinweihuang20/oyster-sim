/**
 * 釣魚特效（輕量、手機不發燙）：
 * - 船拖裙尾假餌的氣泡尾跡：小白球，往上浮、慢慢變小。
 * - 頭足類（大軟絲、花枝）中魚／拉扯／拉上來時噴墨：深色扁圓，在水面下慢慢散開、變淡（縮小）消失。
 * 兩種各一個 InstancedMesh（各 1 個 draw call），粒子固定數量循環使用（不 new 物件）；沒有粒子時整個隱藏。
 * 粒子邏輯（FxPool）不碰 three，方便測試。
 */
import * as THREE from 'three';

export type FxP = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; age: number; s0: number; s1: number; on: boolean };

/** 固定大小的粒子池：滿了就蓋掉最舊的 */
export class FxPool {
  readonly p: FxP[];
  private next = 0;
  constructor(readonly cap: number) {
    this.p = Array.from({ length: cap }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, age: 0, s0: 0, s1: 0, on: false }));
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number) {
    const q = this.p[this.next]; this.next = (this.next + 1) % this.cap;
    q.x = x; q.y = y; q.z = z; q.vx = vx; q.vy = vy; q.vz = vz; q.life = Math.max(0.05, life); q.age = 0; q.s0 = s0; q.s1 = s1; q.on = true;
    return q;
  }
  /** 走一步；回傳還活著的數量。drag＝速度每秒衰減比例 */
  step(dt: number, drag = 1.5, maxY = Infinity) {
    let n = 0; const k = Math.exp(-drag * dt);
    for (const q of this.p) {
      if (!q.on) continue;
      q.age += dt;
      if (q.age >= q.life) { q.on = false; continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vx *= k; q.vz *= k;
      if (q.y > maxY) { q.on = false; continue; }
      n++;
    }
    return n;
  }
  /** 目前大小：s0 → s1（墨會先變大），最後 30% 縮到 0（看起來像變淡） */
  static size(q: FxP) {
    const u = Math.min(1, q.age / q.life);
    const s = q.s0 + (q.s1 - q.s0) * Math.min(1, u / 0.7);
    return u > 0.7 ? s * (1 - (u - 0.7) / 0.3) : s;
  }
  live() { let n = 0; for (const q of this.p) if (q.on) n++; return n; }
  clear() { for (const q of this.p) q.on = false; }
}

export const FX = {
  bubbleCap: 28, inkCap: 14,
  /** 氣泡：每隔幾秒冒一顆、活多久 */
  bubbleGap: 0.07, bubbleLife: 0.9,
  /** 墨：一次噴幾團、活多久、多大 */
  inkBurst: 5, inkLife: 2.2, inkS0: 0.25, inkS1: 0.95,
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export type FishFx = {
  group: THREE.Group;
  bubbles: FxPool; ink: FxPool;
  /** 拖釣氣泡（x,z＝假魚位置；y＝水面高度）：從水面冒出來一點點就破掉 */
  bubble(x: number, y: number, z: number): void;
  /** 噴墨一團 */
  inkPuff(x: number, y: number, z: number, k?: number): void;
  tick(dt: number): void;
  dispose(): void;
};

export function makeFishFx(parent: THREE.Object3D): FishFx {
  const group = new THREE.Group(); group.name = 'fishFx';
  const bGeo = new THREE.IcosahedronGeometry(0.05, 0);
  const bMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.85, depthWrite: false });
  const bMesh = new THREE.InstancedMesh(bGeo, bMat, FX.bubbleCap);
  const iGeo = new THREE.CircleGeometry(0.5, 12);
  // 墨貼在水面上（水是不透明的）：polygonOffset 避免跟水面打架閃爍
  const iMat = new THREE.MeshBasicMaterial({ color: 0x14101a, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const iMesh = new THREE.InstancedMesh(iGeo, iMat, FX.inkCap);
  for (const m of [bMesh, iMesh]) { m.frustumCulled = false; m.count = 0; m.visible = false; m.renderOrder = 2; }
  group.add(bMesh, iMesh); parent.add(group);
  const bubbles = new FxPool(FX.bubbleCap), ink = new FxPool(FX.inkCap);
  let maxY = Infinity;
  const upload = (pool: FxPool, mesh: THREE.InstancedMesh, flat: boolean) => {
    let i = 0;
    for (const q of pool.p) {
      if (!q.on) continue;
      const s = FxPool.size(q);
      _p.set(q.x, q.y, q.z); _s.set(s, s, s);
      if (flat) { _q.copy(_flat); _s.z = 1; } else _q.identity();
      _m.compose(_p, _q, _s); mesh.setMatrixAt(i++, _m);
    }
    mesh.count = i; mesh.visible = i > 0;
    if (i > 0) mesh.instanceMatrix.needsUpdate = true;
  };
  return {
    group, bubbles, ink,
    bubble(x, y, z) { bubbles.spawn(x + (Math.random() - 0.5) * 0.12, y, z + (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.2, 0.15 + Math.random() * 0.15, (Math.random() - 0.5) * 0.2, FX.bubbleLife, 0.9 + Math.random() * 0.5, 0.3); maxY = y + 0.22; },
    inkPuff(x, y, z, k = 1) {
      for (let i = 0; i < FX.inkBurst; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 0.6;
        ink.spawn(x + Math.cos(a) * 0.15, y - 0.02 * i, z + Math.sin(a) * 0.15, Math.cos(a) * r * k, 0, Math.sin(a) * r * k, FX.inkLife * (0.8 + Math.random() * 0.4), FX.inkS0 * k, FX.inkS1 * k * (0.8 + Math.random() * 0.4));
      }
    },
    tick(dt) {
      if (bubbles.step(dt, 0.8, maxY) || bMesh.visible) upload(bubbles, bMesh, false);
      if (ink.step(dt, 1.6) || iMesh.visible) upload(ink, iMesh, true);
    },
    dispose() { group.removeFromParent(); bGeo.dispose(); bMat.dispose(); iGeo.dispose(); iMat.dispose(); bMesh.dispose(); iMesh.dispose(); bubbles.clear(); ink.clear(); },
  };
}
