import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { makeCharcoalFire, type CharcoalFireFx } from './fireFx';
import {
  PILE_SPACING, PLAZA_LAMP_XZ, WALK_BOUND, pileCenter, seatPose,
  PILE_COUNT, SLOTS_PER_PILE, NPC_SLOTS_PER_PILE, pileHasNpc,
} from './layout';

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
  count = 210,
): THREE.Group {
  const g = new THREE.Group();
  g.userData.pileId = pileId;
  // clone 材質，避免廣場 dispose 時清掉工寮共用 mat；geometry 仍共用勿 dispose
  const mat = (shellMat as THREE.Material).clone();
  const pile = new THREE.InstancedMesh(shellGeo, mat, count);
  pile.castShadow = true;
  pile.renderOrder = 0;
  pile.userData.pileId = pileId;
  pile.userData.sharedGeo = true;
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  let r = (pileId + 1) * 9973;
  const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < count; i++) {
    const a = rn() * 6.28;
    // 略偏外圈＋縮小有效半徑，堆面更密實（勿用過稀的均勻圓盤）
    const rad = Math.pow(rn(), 0.42) * 0.98;
    const h = Math.max(0, 0.58 * (1 - rad / 0.92));
    d.position.set(Math.cos(a) * rad, h + 0.03, Math.sin(a) * rad);
    d.rotation.set(rn() * 3, rn() * 3, rn() * 3);
    d.scale.setScalar(0.92 + rn() * 0.22);
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

/** 烤網高度（世界 y；底座已壓低，避免擋臉盆／肉碗） */
export const GRILL_GRATE_Y = 0.32;
/** 烤網可用半徑（點放蚵／碰撞） */
export const GRILL_NET_R = 0.62;

/**
 * 廣場烤蚵台：共烤炭爐＋烤網；旁側生蚵籃供撈盆（點擊碰撞仍帶 pileId）。
 */
export function makePlazaGrill(
  shellGeo: THREE.BufferGeometry,
  shellMat: THREE.Material,
  pileId: number,
  lowDetail = false,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `grill-${pileId}`;
  g.userData.pileId = pileId;
  g.userData.grill = true;
  const segs = lowDetail ? 6 : 10;
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, metalness: 0.45, roughness: 0.55 });
  const brick = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.88 });
  const gy = GRILL_GRATE_Y;

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.pileId = pileId;
    g.add(m);
    return m;
  };

  // 矮磚台（壓低：頂面約在烤網下）
  add(rboxEnv(1.55, 0.18, 1.55), brick, [0, 0.09, 0], true);
  // 鋼盤中心 0.2、高 0.08 → 頂面 ≈ 0.24；炭要在其上、烤網（gy）之下
  const steelY = 0.2;
  const steelH = 0.08;
  add(rboxEnv(1.4, steelH, 1.4), steel, [0, steelY, 0], false);
  const steelTop = steelY + steelH / 2;
  // 烤位：多木炭燒紅；貼鋼盤上、壓在烤網下、脈動放慢
  const fire: CharcoalFireFx = makeCharcoalFire({
    width: 1.05,
    depth: 1.05,
    lowDetail,
    flames: false,
    sparks: false,
    smoke: 0.6,
    flat: true,
    pulseSpeed: 0.32,
    chunks: lowDetail ? 26 : 42,
    hotRatio: 0.72,
    withLight: !lowDetail,
    lightIntensity: 2.8,
    lightDistance: 4.2,
    seed: 1100 + pileId * 97,
  });
  // 炭床貼在鋼盤頂（勿再往下埋進鋼盤裡）
  fire.group.position.set(0, steelTop + 0.012, 0);
  g.add(fire.group);
  g.userData.fireFx = fire;
  // 烤網
  const grate = new THREE.MeshStandardMaterial({ color: 0x6a6a70, metalness: 0.55, roughness: 0.4 });
  for (let i = 0; i < 9; i++) {
    add(rboxEnv(1.2, 0.012, 0.022), grate, [0, gy, -0.48 + i * 0.12], false);
    add(rboxEnv(0.022, 0.012, 1.2), grate, [-0.48 + i * 0.12, gy + 0.004, 0], false);
  }
  // 邊框
  add(rboxEnv(1.28, 0.03, 0.05), steel, [0, gy + 0.02, -0.62], false);
  add(rboxEnv(1.28, 0.03, 0.05), steel, [0, gy + 0.02, 0.62], false);
  add(rboxEnv(0.05, 0.03, 1.28), steel, [-0.62, gy + 0.02, 0], false);
  add(rboxEnv(0.05, 0.03, 1.28), steel, [0.62, gy + 0.02, 0], false);

  // 旁側生蚵籃（撈蚵來源；略外移避免擋座位臉盆）
  const basket = new THREE.Group();
  basket.position.set(1.15, 0, 0.2);
  basket.userData.pileId = pileId;
  g.add(basket);
  const baskMesh = new THREE.Mesh(rcyl(0.28, 0.25, 0.22, segs), wood);
  baskMesh.position.y = 0.14;
  baskMesh.userData.pileId = pileId;
  basket.add(baskMesh);
  const mat = (shellMat as THREE.Material).clone();
  const nShell = lowDetail ? 28 : 48;
  const pile = new THREE.InstancedMesh(shellGeo, mat, nShell);
  pile.userData.pileId = pileId;
  pile.userData.sharedGeo = true;
  pile.castShadow = true;
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  let r = (pileId + 7) * 7919;
  const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < nShell; i++) {
    const a = rn() * 6.28;
    const rad = Math.pow(rn(), 0.5) * 0.26;
    d.position.set(Math.cos(a) * rad, 0.2 + Math.max(0, 0.16 * (1 - rad / 0.26)), Math.sin(a) * rad);
    d.rotation.set(rn() * 3, rn() * 3, rn() * 3);
    d.scale.setScalar(0.85 + rn() * 0.25);
    d.updateMatrix();
    pile.setMatrixAt(i, d.matrix);
    col.setHex(GREYS[Math.min(4, Math.floor(rn() * rn() * 6.2))]);
    pile.setColorAt(i, col);
  }
  pile.instanceMatrix.needsUpdate = true;
  if (pile.instanceColor) pile.instanceColor.needsUpdate = true;
  basket.add(pile);

  // 點擊碰撞（烤網＋蚵籃）
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.55, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.28;
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
  const seat = add(rcyl(0.2, 0.21, 0.05, 14), seatMat, [0, CHAIR_SEAT_Y, 0], group, true);
  // 坐墊下圈
  add(rcyl(0.18, 0.19, 0.03, 12), M(0x2f6aaf), [0, CHAIR_SEAT_Y - 0.04, 0], group, false);
  // 四腳
  for (const [lx, lz] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]] as const) {
    add(rcyl(0.022, 0.028, CHAIR_SEAT_Y - 0.02, 6), legMat, [lx, (CHAIR_SEAT_Y - 0.02) / 2, lz], group, false);
  }
  // 腳環
  add(new THREE.TorusGeometry(0.13, 0.012, 6, 16), legMat, [0, 0.14, 0], group, false).rotation.x = Math.PI / 2;
  // 椅背（本地 +Z＝背後，角色看 -Z）
  add(rboxEnv(0.34, 0.08, 0.04), backMat, [0, CHAIR_SEAT_Y + 0.22, 0.16], group, true);
  add(rboxEnv(0.04, 0.28, 0.04), backMat, [-0.12, CHAIR_SEAT_Y + 0.12, 0.16], group, false);
  add(rboxEnv(0.04, 0.28, 0.04), backMat, [0.12, CHAIR_SEAT_Y + 0.12, 0.16], group, false);
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
    const seatN = SLOTS_PER_PILE + (pileHasNpc(i) ? NPC_SLOTS_PER_PILE : 0);
    for (let s = 0; s < seatN; s++) {
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

/** 大棚樑／鐵皮高度（玩家頭高約 1.55，約三人身高） */
export const PLAZA_ROOF_Y = 4.65;
export const PLAZA_POST_H = 4.75;

/** 工業大吊扇：超長扇葉，掛在樑下 */
function makePlazaCeilingFan(
  M: (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial,
  add: (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], parent: THREE.Object3D, cast?: boolean) => THREE.Mesh,
  lowDetail: boolean,
  x: number,
  z: number,
  roofY: number,
  spinSign: number,
): { root: THREE.Group; tick: (dt: number) => void } {
  const root = new THREE.Group();
  root.name = 'plazaCeilingFan';
  root.position.set(x, 0, z);
  const metal = M(0x4a4a48, { metalness: 0.55, roughness: 0.45 });
  const hubMat = M(0x3a3a38, { metalness: 0.4, roughness: 0.5 });
  const bladeMat = M(0x6e6558, { roughness: 0.82, side: THREE.DoubleSide });
  const segs = lowDetail ? 5 : 8;
  const hangY = roofY - 0.12;
  // 吊桿＋馬達殼
  add(rcyl(0.035, 0.04, 0.55, segs), metal, [0, hangY - 0.28, 0], root, false);
  add(rcyl(0.16, 0.18, 0.14, segs), hubMat, [0, hangY - 0.58, 0], root, false);
  add(rcyl(0.09, 0.1, 0.08, 6), metal, [0, hangY - 0.68, 0], root, false);

  const rotor = new THREE.Group();
  rotor.position.set(0, hangY - 0.72, 0);
  root.add(rotor);
  add(rcyl(0.22, 0.2, 0.06, segs), hubMat, [0, 0.02, 0], rotor, false);

  const bladeLen = lowDetail ? 2.6 : 3.05;
  const bladeW = lowDetail ? 0.28 : 0.34;
  const nBlades = 3;
  for (let i = 0; i < nBlades; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / nBlades) * Math.PI * 2;
    rotor.add(arm);
    const blade = add(
      rboxEnv(bladeLen, 0.035, bladeW),
      bladeMat,
      [bladeLen * 0.52, 0, 0],
      arm,
      false,
    );
    // 略俯角、微扭，比較像工業扇葉
    blade.rotation.z = -0.08;
    blade.rotation.x = 0.12;
  }

  const speed = 2.1 * spinSign; // ~20 RPM（現速三倍）
  return {
    root,
    tick: (dt: number) => { rotor.rotation.y += speed * dt; },
  };
}

/**
 * 廣場大棚：鏽鐵皮厝頂＋外圈木柱（風格同自家工寮，柱只立外圈避開堆椅）。
 * 工寮原棚進廣場仍隱藏，改用這座加大棚架。
 */
export function makePlazaBigShed(
  M: (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial,
  add: (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], parent: THREE.Object3D, cast?: boolean) => THREE.Mesh,
  lowDetail = false,
): { group: THREE.Group; posts: { x: number; z: number }[]; tick: (dt: number) => void } {
  const g = new THREE.Group();
  g.name = 'plazaBigShed';
  const posts = collectPlazaShedPosts();
  const wood = M(0x5a4a3a, { roughness: 0.88 });
  const rust = [0x8a5a3a, 0x9a6a48, 0x7a6a5e];
  const postH = PLAZA_POST_H;
  const roofY = PLAZA_ROOF_Y;
  const segs = lowDetail ? 5 : 7;
  const fanTicks: ((dt: number) => void)[] = [];

  for (const p of posts) {
    add(rcyl(0.07, 0.08, postH, segs), wood, [p.x, postH / 2, p.z], g, true);
  }
  // 外框樑
  const beam = (x: number, y: number, z: number, w: number, d: number) =>
    add(rboxEnv(w, 0.12, d), wood, [x, y, z], g, false);
  beam(0, roofY - 0.08, -10.6, 21.4, 0.14);
  beam(0, roofY - 0.08, 10.6, 21.4, 0.14);
  beam(-10.6, roofY - 0.08, 0, 0.14, 21.4);
  beam(10.6, roofY - 0.08, 0, 0.14, 21.4);

  // 東／南牆：貼齊走動極限，橫木條頂到屋頂樑
  {
    const thick = 0.14;
    const wallH = roofY - 0.04;
    const span = 21.4;
    const plankH = lowDetail ? 0.36 : 0.28;
    const plankA = M(0x6a5540, { roughness: 0.92 });
    const plankB = M(0x534330, { roughness: 0.94 });
    const studs = [-10.6, -5.2, 0, 5.2, 10.6];
    const n = Math.ceil(wallH / plankH);
    const face = (axis: 'x' | 'z', outer: number) => {
      // outer＝內側面在 WALK_BOUND；板心再往外半厚
      const c = outer + thick * 0.5;
      for (let i = 0; i < n; i++) {
        const y0 = i * plankH;
        const h = Math.min(plankH * 0.9, wallH - y0);
        if (h < 0.06) break;
        const y = y0 + h * 0.5;
        if (axis === 'x') add(rboxEnv(thick, h, span), i % 2 ? plankA : plankB, [c, y, 0], g, false);
        else add(rboxEnv(span, h, thick), i % 2 ? plankA : plankB, [0, y, c], g, false);
      }
      for (const s of studs) {
        if (axis === 'x') add(rboxEnv(thick + 0.04, wallH, 0.16), wood, [c + 0.02, wallH * 0.5, s], g, true);
        else add(rboxEnv(0.16, wallH, thick + 0.04), wood, [s, wallH * 0.5, c + 0.02], g, true);
      }
      if (axis === 'x') add(rboxEnv(thick + 0.06, 0.1, span + 0.2), wood, [c, wallH + 0.02, 0], g, false);
      else add(rboxEnv(span + 0.2, 0.1, thick + 0.06), wood, [0, wallH + 0.02, c], g, false);
    };
    face('x', WALK_BOUND); // 東
    face('z', WALK_BOUND); // 南
  }

  // 鏽鐵皮厝頂（長條斜舖，蓋住整場）
  const n = lowDetail ? 22 : 34;
  const span = 21.6;
  const stripW = span / n;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (i + 0.5) * stripW;
    const panel = add(
      rboxEnv(stripW * 1.02, 0.035, span),
      M(rust[i % 3], { side: THREE.DoubleSide, metalness: 0.35, roughness: 0.88 }),
      [x, roofY + (i % 2) * 0.025, 0],
      g,
      false,
    );
    panel.rotation.z = 0.05;
  }

  // 吊燈外觀：四堆一盞（與 PLAZA_LAMP_XZ／實際 PointLight 對齊）
  {
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (const [x, z] of PLAZA_LAMP_XZ) {
      add(new THREE.SphereGeometry(lowDetail ? 0.07 : 0.09, lowDetail ? 6 : 8, lowDetail ? 5 : 6), glow, [x, roofY - 0.55, z], g, false);
      add(rcyl(0.008, 0.008, 0.5, 4), M(0x111111), [x, roofY - 0.25, z], g, false);
    }
  }

  // 兩把超大吊扇（避開四角吊燈，對角擺）
  for (const [fx, fz, dir] of [[-4.0, 4.0, 1], [4.0, -4.0, -1]] as const) {
    const fan = makePlazaCeilingFan(M, add, lowDetail, fx, fz, roofY, dir);
    g.add(fan.root);
    fanTicks.push(fan.tick);
  }

  return {
    group: g,
    posts,
    tick: (dt: number) => { for (const t of fanTicks) t(dt); },
  };
}
