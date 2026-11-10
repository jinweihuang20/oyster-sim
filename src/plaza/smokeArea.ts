import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { SMOKE_CENTER, SMOKE_SEAT_COUNT, SMOKE_PILE_ID, SMOKE_ABER_SLOT, SMOKE_ASHTRAY_XZ, SMOKE_ASHTRAY_TOP_Y, seatPose, seatKey, plazaSmokeObstacles, smokeNpcSeatPose } from './layout';
import { makePlazaChair } from './props';
import { makeCigSmoke, type CharcoalFireFx } from './fireFx';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type MatFn = (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
type AddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  parent: THREE.Object3D,
  cast?: boolean,
) => THREE.Mesh;

/** 畫「吸菸區」地貼／立牌用的線條 canvas 貼圖 */
export function makeSmokeLabelTexture(text: string, w = 256, h = 96) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(42,90,134,0.95)';
  c.lineWidth = 4;
  c.strokeRect(8, 8, w - 16, h - 16);
  c.strokeStyle = 'rgba(220,228,236,0.55)';
  c.lineWidth = 1.5;
  c.strokeRect(14, 14, w - 28, h - 28);
  c.fillStyle = 'rgba(232,242,250,0.92)';
  c.font = `700 ${Math.floor(h * 0.34)}px system-ui,sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}


const buttFilterMat = new THREE.MeshStandardMaterial({ color: 0xc99a62, roughness: 0.95, metalness: 0 });
const buttPaperMat = new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.95, metalness: 0 });
const buttAshMat = new THREE.MeshStandardMaterial({ color: 0x4a4644, roughness: 1, metalness: 0 });
/** 菸灰缸裡的菸蒂：平躺、方向隨機，部分略斜靠；一個菸灰缸合併成 3 個 mesh */
export function makeCigButts(n: number, rMin: number, rMax: number, seed: number): THREE.Group {
  let r = (seed >>> 0) || 1;
  const rn = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
  const fil: THREE.BufferGeometry[] = [], pap: THREE.BufferGeometry[] = [], ash: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rn() * 0.9;
    const rad = rMin + rn() * (rMax - rMin);
    const yaw = rn() * Math.PI * 2;
    const tilt = rn() < 0.35 ? 0.15 + rn() * 0.25 : rn() * 0.06; // 少數斜靠在別根上
    const fl = 0.022 + rn() * 0.006; // 濾嘴
    const pl = 0.006 + rn() * 0.022; // 剩下的菸紙
    const rr = 0.0042;
    e.set(Math.PI / 2 + tilt, yaw, 0, 'YXZ'); q.setFromEuler(e);
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q); // 沿菸身（圓柱軸）
    const base = new THREE.Vector3(Math.cos(a) * rad, rr + Math.sin(tilt) * (pl + 0.003), Math.sin(a) * rad);
    const add = (arr: THREE.BufferGeometry[], len: number, off: number, rad0: number) => {
      const g = new THREE.CylinderGeometry(rad0, rad0, len, 6, 1);
      v.copy(base).addScaledVector(dir, off);
      m.compose(v, q, one); g.applyMatrix4(m); arr.push(g);
    };
    add(fil, fl, -fl / 2, rr);
    add(pap, pl, pl / 2, rr * 0.94);
    // 燒過的末端：一小截灰黑，菸紙皺縮
    add(ash, 0.003, pl + 0.0015, rr * 0.8);
  }
  const g = new THREE.Group();
  g.name = 'cigButts';
  for (const [arr, mat] of [[fil, buttFilterMat], [pap, buttPaperMat], [ash, buttAshMat]] as const) {
    const merged = mergeGeometries(arr as THREE.BufferGeometry[]);
    (arr as THREE.BufferGeometry[]).forEach(x => x.dispose());
    if (merged) g.add(new THREE.Mesh(merged, mat));
  }
  return g;
}

/**
 * 廣場西側棚外吸菸區：地標線、遮雨棚、菸灰缸、可坐椅、立牌。
 * 座位 pileId = SMOKE_PILE_ID，slot 0..SMOKE_SEAT_COUNT-1。
 */
export function makePlazaSmokeArea(
  M: MatFn,
  add: AddFn,
  lowDetail = false,
): {
  group: THREE.Group;
  seatPads: Map<string, THREE.Mesh>;
  obstacles: [number, number, number][];
  ambientSmoke: CharcoalFireFx;
  tick: (tSec: number, dt: number) => void;
} {
  const root = new THREE.Group();
  root.name = 'plazaSmokeArea';
  const { x: cx, z: cz } = SMOKE_CENTER;
  const segs = lowDetail ? 5 : 8;
  const seatPads = new Map<string, THREE.Mesh>();

  // 地面虛線框＋accent 邊
  {
    const g = new THREE.Group();
    g.position.set(cx, 0.01, cz);
    root.add(g);
    const edge = M(0x2a5a86, { roughness: 0.55, metalness: 0.05 });
    const dash = M(0xc8d0d8, { roughness: 0.85 });
    const half = 2.55;
    // outer accent rim
    add(rboxEnv(half * 2 + 0.08, 0.02, 0.06), edge, [0, 0, -half], g, false);
    add(rboxEnv(half * 2 + 0.08, 0.02, 0.06), edge, [0, 0, half], g, false);
    add(rboxEnv(0.06, 0.02, half * 2 + 0.08), edge, [-half, 0, 0], g, false);
    add(rboxEnv(0.06, 0.02, half * 2 + 0.08), edge, [half, 0, 0], g, false);
    // dashed inner
    const n = 9;
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) continue;
      const t = -half + (i + 0.5) * (2 * half / n);
      const len = (2 * half / n) * 0.7;
      add(rboxEnv(len, 0.012, 0.035), dash, [t, 0.002, -half + 0.08], g, false);
      add(rboxEnv(len, 0.012, 0.035), dash, [t, 0.002, half - 0.08], g, false);
      add(rboxEnv(0.035, 0.012, len), dash, [-half + 0.08, 0.002, t], g, false);
      add(rboxEnv(0.035, 0.012, len), dash, [half - 0.08, 0.002, t], g, false);
    }
    // floor decal
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 0.48),
      new THREE.MeshBasicMaterial({ map: makeSmokeLabelTexture('吸菸區'), transparent: true, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0, 0.018, 0.15);
    g.add(decal);
  }

  // 小遮雨棚（單色帆布，無漸層）
  {
    const wood = M(0x5a5e62, { roughness: 0.88 });
    const tarp = M(0x6a7884, { side: THREE.DoubleSide, roughness: 0.78 });
    for (const [sx, sz] of [[-1.15, -1.35], [1.15, -1.35], [-1.15, 1.35], [1.15, 1.35]] as const) {
      add(rcyl(0.04, 0.045, 2.05, segs), wood, [cx + sx, 1.02, cz + sz], root, true);
    }
    const roof = add(rboxEnv(2.55, 0.035, 2.95), tarp, [cx, 2.08, cz], root, false);
    roof.rotation.x = -0.04;
  }

  // 立式菸灰缸 ×3（西側留空檔，頂緣約坐姿肩高略下）
  {
    const metal = M(0x5a6068, { metalness: 0.45, roughness: 0.5 });
    const top = M(0x3a4048, { metalness: 0.35, roughness: 0.55 });
    const topY = SMOKE_ASHTRAY_TOP_Y;
    const postH = topY - 0.08; // 柱頂略低於盤
    const postY = postH / 2;
    for (const [dx, dz] of SMOKE_ASHTRAY_XZ) {
      add(rcyl(0.055, 0.06, postH, segs), metal, [cx + dx, postY, cz + dz], root, true);
      add(rcyl(0.12, 0.13, 0.05, segs), top, [cx + dx, topY - 0.04, cz + dz], root, false);
      add(rcyl(0.035, 0.04, 0.04, 6), M(0x2a2e32), [cx + dx, topY, cz + dz], root, false);
      const butts = makeCigButts(7, 0.055, 0.085, 3100 + Math.round((dx + dz) * 97));
      butts.position.set(cx + dx, topY - 0.015, cz + dz);
      root.add(butts);
    }
  }

  // 立牌
  {
    const pole = M(0x4a5056, { roughness: 0.8 });
    add(rcyl(0.03, 0.035, 1.35, 5), pole, [cx - 1.55, 0.68, cz + 1.35], root, true);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.32),
      new THREE.MeshBasicMaterial({
        map: makeSmokeLabelTexture('吸菸區', 320, 120),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    sign.position.set(cx - 1.55, 1.45, cz + 1.35);
    sign.rotation.y = Math.PI * 0.15;
    root.add(sign);
  }

  // 座位（塑膠圓凳，朝區心）；僅 0..SMOKE_SEAT_COUNT-1 可坐
  for (let s = 0; s < SMOKE_SEAT_COUNT; s++) {
    const pose = seatPose(SMOKE_PILE_ID, s);
    const { group, pad } = makePlazaChair(pose.pos.x, pose.pos.z, pose.yaw, M, add);
    root.add(group);
    seatPads.set(seatKey(SMOKE_PILE_ID, s), pad);
  }
  // 阿伯專用椅：進 seatPads 才能在放下時高亮，但不列入玩家 nearestFreeSeat
  {
    const pose = smokeNpcSeatPose();
    const { group, pad } = makePlazaChair(pose.pos.x, pose.pos.z, pose.yaw, M, add);
    root.add(group);
    seatPads.set(seatKey(SMOKE_PILE_ID, SMOKE_ABER_SLOT), pad);
  }

  // 區內淡煙氣氛
  const ambientSmoke = makeCigSmoke({ count: lowDetail ? 4 : 7, seed: 12045, scale: 1.1 });
  ambientSmoke.group.position.set(cx, SMOKE_ASHTRAY_TOP_Y + 0.04, cz);
  root.add(ambientSmoke.group);

  return {
    group: root,
    seatPads,
    obstacles: plazaSmokeObstacles(),
    ambientSmoke,
    tick: (tSec, dt) => ambientSmoke.tick(tSec, dt),
  };
}
