import * as THREE from 'three';
import { PILE_SPACING, pileCenter, seatPose, PILE_COUNT, SLOTS_PER_PILE } from './layout';

const GREYS = [0xffffff, 0xeae4e0, 0xd6d0cc, 0xc2bab8, 0xa8a0a0];

type FloorPaintKind = 'plaza' | 'yard';

/** 漁港水泥貼皮（無外圖）：中性灰褐、砂粒、水漬、分格縫——避開紫／粉夢核調 */
function paintConcreteFloor(c: CanvasRenderingContext2D, S: number, rn: () => number, kind: FloorPaintKind) {
  // 底：中性水泥（略暖，非紫灰）
  c.fillStyle = kind === 'yard' ? '#7a766e' : '#747068';
  c.fillRect(0, 0, S, S);
  const n = kind === 'yard' ? 12000 : 10000;
  for (let i = 0; i < n; i++) {
    const g = 88 + (rn() * 55) | 0;
    const warm = (rn() * 8) | 0;
    c.fillStyle = `rgba(${g + warm},${g + (warm >> 1)},${g - 4},${0.1 + rn() * 0.2})`;
    c.fillRect((rn() * S) | 0, (rn() * S) | 0, 1 + (rn() * 2.5) | 0, 1 + (rn() * 2) | 0);
  }
  // 舊水泥深淺斑
  for (let i = 0; i < (kind === 'yard' ? 36 : 30); i++) {
    const x = rn() * S, y = rn() * S, rx = 16 + rn() * 50, ry = 12 + rn() * 36;
    const dark = rn() < 0.5;
    c.fillStyle = dark
      ? `rgba(52,50,46,${0.07 + rn() * 0.11})`
      : `rgba(198,192,180,${0.05 + rn() * 0.09})`;
    c.beginPath(); c.ellipse(x, y, rx, ry, rn() * 3, 0, 7); c.fill();
  }
  // 海水／蚵汁水漬：褐灰，勿橄欖／紫
  for (let i = 0; i < (kind === 'yard' ? 14 : 18); i++) {
    c.fillStyle = `rgba(${62 + rn() * 28 | 0},${58 + rn() * 18 | 0},${48 + rn() * 14 | 0},${0.06 + rn() * 0.1})`;
    c.beginPath();
    c.ellipse(rn() * S, rn() * S, 8 + rn() * 32, 5 + rn() * 16, rn() * 4, 0, 7);
    c.fill();
  }
  // 分格縫
  c.strokeStyle = 'rgba(42,40,36,0.5)';
  c.lineWidth = kind === 'yard' ? 2.5 : 3;
  c.strokeRect(2, 2, S - 4, S - 4);
  c.strokeStyle = 'rgba(220,214,200,0.14)';
  c.lineWidth = 1;
  c.strokeRect(5, 5, S - 10, S - 10);
  for (let i = 0; i < 36; i++) {
    const edge = (rn() * 4) | 0;
    let x = 0, y = 0;
    if (edge === 0) { x = rn() * S; y = rn() * 5; }
    else if (edge === 1) { x = rn() * S; y = S - 5 + rn() * 5; }
    else if (edge === 2) { x = rn() * 5; y = rn() * S; }
    else { x = S - 5 + rn() * 5; y = rn() * S; }
    c.fillStyle = `rgba(45,43,40,${0.2 + rn() * 0.3})`;
    c.fillRect(x, y, 1 + rn() * 3, 1 + rn() * 2);
  }
}

function makeFloorMaps(kind: FloorPaintKind, sizePx: number, tiles: number, seed0: number) {
  let seed = seed0;
  const rn = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const mk = (paint: (c: CanvasRenderingContext2D, S: number) => void, srgb: boolean) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = sizePx;
    const c = cv.getContext('2d')!;
    paint(c, sizePx);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    t.repeat.set(tiles, tiles);
    return t;
  };
  const map = mk((c, S) => paintConcreteFloor(c, S, rn, kind), true);
  const rough = mk((c, S) => {
    c.fillStyle = '#9a9a9a';
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 7000; i++) {
      const g = (70 + rn() * 150) | 0;
      c.fillStyle = `rgb(${g},${g},${g})`;
      c.fillRect((rn() * S) | 0, (rn() * S) | 0, 1 + (rn() * 2) | 0, 1);
    }
    c.strokeStyle = '#e4e4e4';
    c.lineWidth = 4;
    c.strokeRect(2, 2, S - 4, S - 4);
  }, false);
  return { map, rough, tiles };
}

/** 廣場：分格對齊蚵堆 */
export function makePlazaFloorMaps(sizePx = 512) {
  const worldSize = 11.5 * 2.4;
  const tiles = worldSize / PILE_SPACING;
  return makeFloorMaps('plaza', sizePx, tiles, 42017);
}

/** 工寮水泥地 */
export function makeYardFloorMaps(sizePx = 384) {
  return makeFloorMaps('yard', sizePx, 5.5, 91013);
}

/** 與工寮蚵山同款：InstancedMesh 蚵殼堆 */
export function makeYardLikePile(
  shellGeo: THREE.BufferGeometry,
  shellMat: THREE.Material,
  pileId: number,
  count = 110,
): THREE.Group {
  const g = new THREE.Group();
  g.userData.pileId = pileId;
  // clone 材質，避免廣場 dispose 時清掉工寮共用 mat；geometry 仍共用勿 dispose
  const mat = (shellMat as THREE.Material).clone();
  const pile = new THREE.InstancedMesh(shellGeo, mat, count);
  pile.castShadow = true;
  pile.userData.pileId = pileId;
  pile.userData.sharedGeo = true;
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  let r = (pileId + 1) * 9973;
  const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < count; i++) {
    const a = rn() * 6.28, rad = Math.sqrt(rn()) * 1.0;
    const h = Math.max(0, 0.55 * (1 - rad / 0.95));
    d.position.set(Math.cos(a) * rad, h + 0.03, Math.sin(a) * rad);
    d.rotation.set(rn() * 3, rn() * 3, rn() * 3);
    d.updateMatrix();
    pile.setMatrixAt(i, d.matrix);
    col.setHex(GREYS[Math.min(4, Math.floor(rn() * rn() * 6.2))]);
    pile.setColorAt(i, col);
  }
  pile.instanceMatrix.needsUpdate = true;
  if (pile.instanceColor) pile.instanceColor.needsUpdate = true;
  g.add(pile);
  // 點擊用隱形碰撞（殼堆本身較碎）
  const hit = new THREE.Mesh(
    new THREE.ConeGeometry(1.05, 0.85, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.4;
  hit.userData.pileId = pileId;
  g.add(hit);
  return g;
}

/** 塑膠圓凳＋椅背：坐面高度約 0.42，對齊遠端坐下髖部 */
export const CHAIR_SEAT_Y = 0.42;

export function makePlazaChair(
  x: number, z: number, yaw: number,
  M: (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial,
  add: (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], parent: THREE.Object3D, cast?: boolean) => THREE.Mesh,
): { group: THREE.Group; pad: THREE.Mesh } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;

  const seatMat = M(0x3a7ac0, { roughness: 0.55 });
  const legMat = M(0x2a5a90, { roughness: 0.7 });
  const backMat = M(0x3480c8, { roughness: 0.55 });

  // 坐墊
  const seat = add(new THREE.CylinderGeometry(0.2, 0.21, 0.05, 14), seatMat, [0, CHAIR_SEAT_Y, 0], group, true);
  // 坐墊下圈
  add(new THREE.CylinderGeometry(0.18, 0.19, 0.03, 12), M(0x2f6aaf), [0, CHAIR_SEAT_Y - 0.04, 0], group, false);
  // 四腳
  for (const [lx, lz] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]] as const) {
    add(new THREE.CylinderGeometry(0.022, 0.028, CHAIR_SEAT_Y - 0.02, 6), legMat, [lx, (CHAIR_SEAT_Y - 0.02) / 2, lz], group, false);
  }
  // 腳環
  add(new THREE.TorusGeometry(0.13, 0.012, 6, 16), legMat, [0, 0.14, 0], group, false).rotation.x = Math.PI / 2;
  // 椅背（本地 +Z＝背後，角色看 -Z）
  add(new THREE.BoxGeometry(0.34, 0.08, 0.04), backMat, [0, CHAIR_SEAT_Y + 0.22, 0.16], group, true);
  add(new THREE.BoxGeometry(0.04, 0.28, 0.04), backMat, [-0.12, CHAIR_SEAT_Y + 0.12, 0.16], group, false);
  add(new THREE.BoxGeometry(0.04, 0.28, 0.04), backMat, [0.12, CHAIR_SEAT_Y + 0.12, 0.16], group, false);
  void seat;

  // 地面高亮墊（選位提示）
  const pad = add(
    new THREE.CylinderGeometry(0.28, 0.28, 0.025, 16),
    M(0x5a9ad0, { transparent: true, opacity: 0.32, roughness: 0.2 }),
    [0, 0.015, 0],
    group,
    false,
  );
  return { group, pad };
}

/** 大棚柱腳（外圈），給走動碰撞用 */
export function plazaShedPosts(): { x: number; z: number }[] {
  return collectPlazaShedPosts();
}

function shedPostClear(x: number, z: number, pad = 0.28) {
  for (let i = 0; i < PILE_COUNT; i++) {
    const c = pileCenter(i);
    if (Math.hypot(x - c.x, z - c.z) < 1.05 + pad) return false;
    for (let s = 0; s < SLOTS_PER_PILE; s++) {
      const seat = seatPose(i, s).pos;
      if (Math.hypot(x - seat.x, z - seat.z) < 0.4 + pad) return false;
    }
  }
  return true;
}

/** 外圈柱位：覆蓋廣場、不踩進蚵堆／椅子 */
function collectPlazaShedPosts(): { x: number; z: number }[] {
  const ring = 10.6;
  const along = [-10.6, -5.2, 0, 5.2, 10.6];
  const out: { x: number; z: number }[] = [];
  const add = (x: number, z: number) => {
    if (!shedPostClear(x, z)) return;
    if (out.some(p => Math.hypot(p.x - x, p.z - z) < 0.5)) return;
    out.push({ x, z });
  };
  for (const a of along) {
    add(-ring, a); add(ring, a); add(a, -ring); add(a, ring);
  }
  return out;
}

/**
 * 廣場大棚：鏽鐵皮厝頂＋外圈木柱（風格同自家工寮，柱只立外圈避開堆椅）。
 * 工寮原棚進廣場仍隱藏，改用這座加大棚架。
 */
export function makePlazaBigShed(
  M: (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial,
  add: (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], parent: THREE.Object3D, cast?: boolean) => THREE.Mesh,
  lowDetail = false,
): { group: THREE.Group; posts: { x: number; z: number }[] } {
  const g = new THREE.Group();
  g.name = 'plazaBigShed';
  const posts = collectPlazaShedPosts();
  const wood = M(0x5a4a3a, { roughness: 0.88 });
  const rust = [0x8a5a3a, 0x9a6a48, 0x7a6a5e];
  const postH = 3.15;
  const roofY = 3.08;
  const segs = lowDetail ? 5 : 7;

  for (const p of posts) {
    add(new THREE.CylinderGeometry(0.07, 0.08, postH, segs), wood, [p.x, postH / 2, p.z], g, true);
  }
  // 外框樑
  const beam = (x: number, y: number, z: number, w: number, d: number) =>
    add(new THREE.BoxGeometry(w, 0.12, d), wood, [x, y, z], g, false);
  beam(0, roofY - 0.08, -10.6, 21.4, 0.14);
  beam(0, roofY - 0.08, 10.6, 21.4, 0.14);
  beam(-10.6, roofY - 0.08, 0, 0.14, 21.4);
  beam(10.6, roofY - 0.08, 0, 0.14, 21.4);

  // 鏽鐵皮厝頂（長條斜舖，蓋住整場）
  const n = lowDetail ? 22 : 34;
  const span = 21.6;
  const stripW = span / n;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (i + 0.5) * stripW;
    const panel = add(
      new THREE.BoxGeometry(stripW * 1.02, 0.035, span),
      M(rust[i % 3], { side: THREE.DoubleSide, metalness: 0.35, roughness: 0.88 }),
      [x, roofY + (i % 2) * 0.025, 0],
      g,
      false,
    );
    panel.rotation.z = 0.05;
  }

  // 幾顆吊燈（不擋視線）
  if (!lowDetail) {
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (const [x, z] of [[-5.2, -5.2], [5.2, 5.2], [-5.2, 5.2], [5.2, -5.2], [0, 0]] as const) {
      add(new THREE.SphereGeometry(0.08, 8, 6), glow, [x, roofY - 0.55, z], g, false);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), M(0x111111), [x, roofY - 0.25, z], g, false);
    }
  }

  return { group: g, posts };
}
