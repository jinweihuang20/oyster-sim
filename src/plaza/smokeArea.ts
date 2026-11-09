import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { SMOKE_CENTER, SMOKE_SEAT_COUNT, SMOKE_PILE_ID, seatPose, seatKey, plazaSmokeObstacles } from './layout';
import { makePlazaChair } from './props';
import { makeCigSmoke, type CharcoalFireFx } from './fireFx';

type MatFn = (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
type AddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  parent: THREE.Object3D,
  cast?: boolean,
) => THREE.Mesh;

/** 畫「吸菸區」地貼／立牌用的線條 canvas 貼圖 */
function makeSmokeLabelTexture(text: string, w = 256, h = 96) {
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
    const half = 1.85;
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
    for (const [sx, sz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]] as const) {
      add(rcyl(0.04, 0.045, 2.05, segs), wood, [cx + sx, 1.02, cz + sz], root, true);
    }
    const roof = add(rboxEnv(2.15, 0.035, 2.15), tarp, [cx, 2.08, cz], root, false);
    roof.rotation.x = -0.04;
  }

  // 立式菸灰缸 ×3
  {
    const metal = M(0x5a6068, { metalness: 0.45, roughness: 0.5 });
    const top = M(0x3a4048, { metalness: 0.35, roughness: 0.55 });
    for (const [dx, dz] of [[0, 0], [0.55, -0.85], [0.55, 0.85]] as const) {
      add(rcyl(0.055, 0.06, 0.95, segs), metal, [cx + dx, 0.48, cz + dz], root, true);
      add(rcyl(0.12, 0.13, 0.05, segs), top, [cx + dx, 0.98, cz + dz], root, false);
      add(rcyl(0.035, 0.04, 0.04, 6), M(0x2a2e32), [cx + dx, 1.02, cz + dz], root, false);
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

  // 座位（塑膠圓凳，朝區心）
  for (let s = 0; s < SMOKE_SEAT_COUNT; s++) {
    const pose = seatPose(SMOKE_PILE_ID, s);
    const { group, pad } = makePlazaChair(pose.pos.x, pose.pos.z, pose.yaw, M, add);
    root.add(group);
    seatPads.set(seatKey(SMOKE_PILE_ID, s), pad);
  }

  // 區內淡煙氣氛
  const ambientSmoke = makeCigSmoke({ count: lowDetail ? 4 : 7, seed: 12045, scale: 1.1 });
  ambientSmoke.group.position.set(cx, 1.05, cz);
  root.add(ambientSmoke.group);

  return {
    group: root,
    seatPads,
    obstacles: plazaSmokeObstacles(),
    ambientSmoke,
    tick: (tSec, dt) => ambientSmoke.tick(tSec, dt),
  };
}
