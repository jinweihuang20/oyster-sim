import * as THREE from 'three';
import { PILE_SPACING } from './layout';

const GREYS = [0xffffff, 0xeae4e0, 0xd6d0cc, 0xc2bab8, 0xa8a0a0];

/**
 * 漁港水泥廣場貼皮：粗砂水泥＋對齊蚵堆的分格縫＋水漬／磨損。
 * 一張 canvas，無外部圖檔。
 */
export function makePlazaFloorMaps(sizePx = 512) {
  let seed = 42017;
  const rn = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

  const mk = (paint: (c: CanvasRenderingContext2D, S: number) => void) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = sizePx;
    const c = cv.getContext('2d')!;
    paint(c, sizePx);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  };

  // 世界：地板邊長 ≈ WALK_BOUND*2.4；一格 = PILE_SPACING → repeat 對齊 4×4
  const worldSize = 11.5 * 2.4;
  const tiles = worldSize / PILE_SPACING;

  const map = mk((c, S) => {
    // 底：偏暖灰水泥
    c.fillStyle = '#6a6862';
    c.fillRect(0, 0, S, S);
    // 細砂雜訊
    for (let i = 0; i < 9000; i++) {
      const g = 70 + (rn() * 70) | 0;
      c.fillStyle = `rgba(${g},${g - 2},${g - 6},${0.08 + rn() * 0.18})`;
      c.fillRect((rn() * S) | 0, (rn() * S) | 0, 1 + (rn() * 2) | 0, 1 + (rn() * 2) | 0);
    }
    // 大塊色斑（舊水泥深淺）
    for (let i = 0; i < 28; i++) {
      const x = rn() * S, y = rn() * S, rx = 18 + rn() * 55, ry = 14 + rn() * 40;
      const dark = rn() < 0.55;
      c.fillStyle = dark ? `rgba(48,46,42,${0.08 + rn() * 0.12})` : `rgba(190,186,176,${0.06 + rn() * 0.1})`;
      c.beginPath(); c.ellipse(x, y, rx, ry, rn() * 3, 0, 7); c.fill();
    }
    // 蚵汁／水漬（偏橄欖褐）
    for (let i = 0; i < 16; i++) {
      c.fillStyle = `rgba(${55 + rn() * 30 | 0},${52 + rn() * 20 | 0},${40 + rn() * 16 | 0},${0.07 + rn() * 0.12})`;
      c.beginPath();
      c.ellipse(rn() * S, rn() * S, 10 + rn() * 35, 6 + rn() * 18, rn() * 4, 0, 7);
      c.fill();
    }
    // 分格縫（對齊 repeat 一格＝一堆區）
    const cell = S; // 整張貼圖＝一格，靠 repeat 鋪
    c.strokeStyle = 'rgba(36,34,30,0.55)';
    c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, cell - 3, cell - 3);
    c.strokeStyle = 'rgba(210,205,195,0.18)';
    c.lineWidth = 1;
    c.strokeRect(4, 4, cell - 8, cell - 8);
    // 縫邊碎裂
    for (let i = 0; i < 40; i++) {
      const edge = (rn() * 4) | 0;
      let x = 0, y = 0;
      if (edge === 0) { x = rn() * S; y = rn() * 6; }
      else if (edge === 1) { x = rn() * S; y = S - 6 + rn() * 6; }
      else if (edge === 2) { x = rn() * 6; y = rn() * S; }
      else { x = S - 6 + rn() * 6; y = rn() * S; }
      c.fillStyle = `rgba(40,38,34,${0.25 + rn() * 0.35})`;
      c.fillRect(x, y, 1 + rn() * 3, 1 + rn() * 2);
    }
  });
  map.repeat.set(tiles, tiles);

  const rough = mk((c, S) => {
    c.fillStyle = '#a0a0a0';
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 6000; i++) {
      const g = (80 + rn() * 140) | 0;
      c.fillStyle = `rgb(${g},${g},${g})`;
      c.fillRect((rn() * S) | 0, (rn() * S) | 0, 1 + (rn() * 2) | 0, 1);
    }
    // 縫較粗
    c.strokeStyle = '#e8e8e8';
    c.lineWidth = 4;
    c.strokeRect(2, 2, S - 4, S - 4);
  });
  rough.colorSpace = THREE.NoColorSpace;
  rough.repeat.set(tiles, tiles);

  return { map, rough, tiles };
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
