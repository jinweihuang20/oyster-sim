import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import {
  WALK_BOUND, CAFE_SMOKE_PILE_ID, CAFE_SMOKE_SEAT_COUNT, CAFE_TABLE_X, CAFE_TABLE_Z, CAFE_TABLE_RADIUS,
  CAFE_BUILDING, SEAFOOD_BUILDING, CAFE_PORCH_DEPTH, CAFE_OPENING, CAFE_SOUTH_WALL_END, seatPose, seatKey,
} from './layout';
import { CHAIR_SEAT_Y } from './props';
import { makeSmokeLabelTexture, makeCigButts } from './smokeArea';
import { makeCigSmoke, type CharcoalFireFx } from './fireFx';

type MatFn = (c: number, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
type AddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  parent: THREE.Object3D,
  cast?: boolean,
) => THREE.Mesh;

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** 米白石材：錯縫石塊＋細深色縫線（一張 ≈ 1.8m × 1.8m） */
function stoneTexture(lowDetail: boolean) {
  const S = lowDetail ? 128 : 256;
  const t = canvasTex(S, S, c => {
    c.fillStyle = '#cfc4b0';
    c.fillRect(0, 0, S, S);
    const rows = 4, bw = S / 2, bh = S / rows;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let i = -1; i < 3; i++) {
        const x = i * bw + off;
        const v = Math.floor((rnd() - 0.5) * 14);
        c.fillStyle = `rgb(${207 + v},${196 + v},${176 + v})`;
        c.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2);
      }
    }
    c.strokeStyle = 'rgba(120,112,100,0.55)';
    c.lineWidth = Math.max(1, S / 200);
    for (let r = 0; r <= rows; r++) {
      c.beginPath(); c.moveTo(0, r * bh); c.lineTo(S, r * bh); c.stroke();
      const off = r % 2 ? bw / 2 : 0;
      for (let i = 0; i < 3; i++) {
        const x = (i * bw + off) % S;
        c.beginPath(); c.moveTo(x, r * bh); c.lineTo(x, r * bh + bh); c.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 招牌深色立體字（無官方徽章，純文字） */
function signTexture(text: string, w: number, h: number, font: string) {
  return canvasTex(w, h, c => {
    c.clearRect(0, 0, w, h);
    c.font = font;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // 立體感：亮邊在上左、陰影在下右
    c.fillStyle = 'rgba(245,240,230,0.55)';
    c.fillText(text, w / 2 - 2, h / 2 - 2);
    c.fillStyle = 'rgba(20,22,24,0.45)';
    c.fillText(text, w / 2 + 3, h / 2 + 3);
    c.fillStyle = '#2b2f33';
    c.fillText(text, w / 2, h / 2);
  });
}

/** 麵包櫥窗內景（暖光層架＋糕點色塊，假的） */
function bakeryTexture(lowDetail: boolean, dim = false) {
  const W = lowDetail ? 128 : 256, H = lowDetail ? 160 : 320;
  return canvasTex(W, H, c => {
    c.fillStyle = dim ? '#5a4f43' : '#f1d9a8';
    c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, H * 0.25, 4, W / 2, H * 0.3, H * 0.8);
    g.addColorStop(0, dim ? 'rgba(255,220,160,0.35)' : 'rgba(255,246,220,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const shelves = dim ? 2 : 4;
    const colors = ['#d9a05b', '#e8c27a', '#c9874a', '#f3e2c0', '#e0b16a', '#b8744a'];
    let k = 0;
    for (let s = 0; s < shelves; s++) {
      const y = H * (0.28 + s * (dim ? 0.3 : 0.18));
      c.fillStyle = dim ? '#3a3632' : '#8a8f94';
      c.fillRect(W * 0.06, y, W * 0.88, Math.max(2, H * 0.012));
      const n = 5;
      for (let i = 0; i < n; i++) {
        c.fillStyle = colors[(k++) % colors.length];
        const cx = W * (0.14 + i * 0.18), r = W * 0.055;
        c.beginPath();
        c.ellipse(cx, y - r * 0.7, r, r * 0.65, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
}

/**
 * 廣場東南角「多那芝咖啡」外觀（不可進入）＋門口吸菸區 3 桌 6 座。
 * 正門朝西（-X），座位 pileId = CAFE_SMOKE_PILE_ID。
 */
export function makePlazaCafe(
  M: MatFn,
  add: AddFn,
  lowDetail = false,
): {
  group: THREE.Group;
  seatPads: Map<string, THREE.Mesh>;
  lights: THREE.PointLight[];
  ambientSmoke: CharcoalFireFx;
  tick: (tSec: number, dt: number) => void;
  dispose: () => void;
} {
  const root = new THREE.Group();
  root.name = 'plazaCafe';
  const LO = lowDetail;
  const segs = LO ? 6 : 10;
  const seatPads = new Map<string, THREE.Mesh>();
  const textures: THREE.Texture[] = [];
  const lights: THREE.PointLight[] = [];
  const B = CAFE_BUILDING;
  const W = B.x1 - B.x0, D = B.z1 - B.z0;
  const cz = (B.z0 + B.z1) / 2;
  const fx = B.x0; // 正面（西）
  const doorZ = B.doorZ;

  // ── 地面：東延街面＋前庭地磚 ──
  {
    const street = new THREE.Mesh(new THREE.PlaneGeometry(10, 30), M(0x8f918c, { roughness: 0.95 }));
    street.rotation.x = -Math.PI / 2;
    street.position.set(13.8 + 5, 0.0005, 0);
    street.receiveShadow = !LO;
    root.add(street);
    const pave = new THREE.Mesh(
      new THREE.PlaneGeometry(fx - WALK_BOUND + 0.2, CAFE_OPENING.z1 - CAFE_OPENING.z0 + 0.3),
      M(0xbdb8ad, { roughness: 0.9 }),
    );
    pave.rotation.x = -Math.PI / 2;
    pave.position.set((WALK_BOUND - 0.2 + fx) / 2, 0.004, (CAFE_OPENING.z0 + CAFE_OPENING.z1 + 0.3) / 2);
    pave.receiveShadow = !LO;
    root.add(pave);
  }

  // ── 建築主體（石材） ──
  const stoneTex = stoneTexture(LO); textures.push(stoneTex);
  const stoneSide = stoneTex.clone(); stoneSide.repeat.set(W / 1.8, B.h / 1.8); stoneSide.needsUpdate = true; textures.push(stoneSide);
  stoneTex.repeat.set(D / 1.8, B.h / 1.8);
  const stoneFront = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9 });
  const stoneSideMat = new THREE.MeshStandardMaterial({ map: stoneSide, roughness: 0.9 });
  const roofMat = M(0x9c9a94, { roughness: 0.95 });
  {
    // BoxGeometry 面序：+x,-x,+y,-y,+z,-z
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(W, B.h, D),
      [stoneSideMat, stoneFront, roofMat, roofMat, stoneSideMat, stoneSideMat],
    );
    body.position.set((B.x0 + B.x1) / 2, B.h / 2, cz);
    body.castShadow = !LO; body.receiveShadow = !LO;
    root.add(body);
  }
  const trim = M(0xd9cfbc, { roughness: 0.85 });
  const plinth = M(0xa9a08e, { roughness: 0.92 });
  const dark = M(0x262a2e, { roughness: 0.55, metalness: 0.35 });
  const metal = M(0x5c6268, { roughness: 0.45, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a3238, roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.32, depthWrite: false });

  // 女兒牆壓頂＋屋頂設備
  add(rboxEnv(W + 0.24, 0.16, D + 0.24, 0.05), trim, [(B.x0 + B.x1) / 2, B.h + 0.08, cz], root, false);
  if (!LO) add(rboxEnv(1.2, 0.7, 1.0), M(0x8a8e92, { metalness: 0.3 }), [B.x1 - 1.2, B.h + 0.5, cz + 1.4], root, false);

  // 底座石條
  add(new THREE.BoxGeometry(0.1, 0.36, D + 0.04), plinth, [fx - 0.05, 0.18, cz], root, false);

  // 方柱：分三開間（左 BAKERY／中門／右窗）
  const pil = [B.z0 + 0.15, doorZ - 0.95, doorZ + 0.95, B.z1 - 0.15];
  for (const z of pil) add(rboxEnv(0.16, 3.0, 0.32, 0.06), trim, [fx - 0.08, 1.5, z], root, true);

  // 橫飾帶＋招牌「多那芝咖啡」
  add(rboxEnv(0.26, 0.72, D + 0.16, 0.05), trim, [fx - 0.13, 3.36, cz], root, true);
  add(rboxEnv(0.34, 0.08, D + 0.26, 0.05), trim, [fx - 0.17, 3.76, cz], root, false);
  {
    const tex = signTexture('多那芝咖啡', LO ? 512 : 1024, LO ? 96 : 192, `800 ${LO ? 70 : 140}px "Noto Serif TC","PMingLiU",serif`);
    textures.push(tex);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.6), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0.2 }));
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(fx - 0.27, 3.34, doorZ);
    root.add(sign);
  }

  const facadePlane = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };
  const frameRect = (z0: number, z1: number, y0: number, y1: number, x: number, t = 0.07) => {
    const zw = z1 - z0, yh = y1 - y0, zc = (z0 + z1) / 2, yc = (y0 + y1) / 2;
    add(new THREE.BoxGeometry(0.08, t, zw + t), dark, [x, y0, zc], root, false);
    add(new THREE.BoxGeometry(0.08, t, zw + t), dark, [x, y1, zc], root, false);
    add(new THREE.BoxGeometry(0.08, yh, t), dark, [x, yc, z0], root, false);
    add(new THREE.BoxGeometry(0.08, yh, t), dark, [x, yc, z1], root, false);
  };

  // 左：BAKERY 櫥窗（暖光層架）
  {
    const z0 = pil[0] + 0.22, z1 = pil[1] - 0.22, y0 = 0.42, y1 = 2.45;
    const tex = bakeryTexture(LO); textures.push(tex);
    facadePlane(z1 - z0, y1 - y0, new THREE.MeshBasicMaterial({ map: tex }), fx - 0.01, (y0 + y1) / 2, (z0 + z1) / 2);
    facadePlane(z1 - z0, y1 - y0, glass, fx - 0.05, (y0 + y1) / 2, (z0 + z1) / 2);
    frameRect(z0, z1, y0, y1, fx - 0.04);
    add(new THREE.BoxGeometry(0.08, y1 - y0, 0.05), dark, [fx - 0.04, (y0 + y1) / 2, (z0 + z1) / 2], root, false);
    const bt = signTexture('BAKERY', 256, 64, '700 40px system-ui,sans-serif'); textures.push(bt);
    facadePlane(1.1, 0.27, new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false }), fx - 0.02, 2.72, (z0 + z1) / 2);
  }
  // 中：深框玻璃門＋雨遮
  {
    const z0 = doorZ - 0.62, z1 = doorZ + 0.62, y0 = 0.04, y1 = 2.42;
    const tex = bakeryTexture(LO, true); textures.push(tex);
    facadePlane(z1 - z0, y1 - y0, new THREE.MeshBasicMaterial({ map: tex }), fx - 0.01, (y0 + y1) / 2, doorZ);
    facadePlane(z1 - z0, y1 - y0, glass, fx - 0.05, (y0 + y1) / 2, doorZ);
    frameRect(z0, z1, y0, y1, fx - 0.04, 0.09);
    add(new THREE.BoxGeometry(0.08, y1 - y0, 0.06), dark, [fx - 0.04, (y0 + y1) / 2, doorZ], root, false);
    for (const s of [-1, 1]) add(rcyl(0.015, 0.015, 0.7, 6), metal, [fx - 0.12, 1.1, doorZ + s * 0.1], root, false);
    const awn = add(rboxEnv(0.7, 0.06, 1.9, 0.1), dark, [fx - 0.35, 2.66, doorZ], root, true);
    awn.rotation.z = 0.08;
    // 門廊
    add(rboxEnv(CAFE_PORCH_DEPTH, 0.08, 2.5, 0.08), plinth, [fx - CAFE_PORCH_DEPTH / 2, 0.04, doorZ], root, false);
    // 兩道金屬護欄（門口兩側）
    for (const s of [-1, 1]) {
      const z = doorZ + s * 0.86;
      const xa = fx - CAFE_PORCH_DEPTH + 0.12, xb = fx - 0.12;
      add(rcyl(0.025, 0.03, 0.85, segs), metal, [xa, 0.425, z], root, true);
      add(rcyl(0.025, 0.03, 0.85, segs), metal, [xb, 0.425, z], root, true);
      const rail = add(rcyl(0.02, 0.02, xb - xa, segs), metal, [(xa + xb) / 2, 0.84, z], root, false);
      rail.rotation.z = Math.PI / 2;
    }
  }
  // 右：咖啡座窗
  {
    const z0 = pil[2] + 0.22, z1 = pil[3] - 0.22, y0 = 0.42, y1 = 2.45;
    const tex = bakeryTexture(LO, true); textures.push(tex);
    facadePlane(z1 - z0, y1 - y0, new THREE.MeshBasicMaterial({ map: tex }), fx - 0.01, (y0 + y1) / 2, (z0 + z1) / 2);
    facadePlane(z1 - z0, y1 - y0, glass, fx - 0.05, (y0 + y1) / 2, (z0 + z1) / 2);
    frameRect(z0, z1, y0, y1, fx - 0.04);
  }
  // 二樓：窄高深色窗
  {
    const winMat = M(0x1e242a, { roughness: 0.15, metalness: 0.6 });
    const zs = LO ? [B.z0 + 0.9, doorZ, B.z1 - 0.9] : [B.z0 + 0.75, B.z0 + 1.75, doorZ, B.z1 - 1.75, B.z1 - 0.75];
    for (const z of zs) {
      add(new THREE.BoxGeometry(0.06, 1.0, 0.42), winMat, [fx - 0.02, 4.48, z], root, false);
      add(new THREE.BoxGeometry(0.1, 0.06, 0.52), trim, [fx - 0.05, 3.95, z], root, false);
    }
  }
  // 門口暖燈（最多 1 盞；省電／低畫質不開）
  if (!LO) {
    const pl = new THREE.PointLight(0xffd8a8, 4.5, 6, 1.6);
    pl.position.set(fx - 0.6, 2.45, doorZ);
    pl.castShadow = false;
    root.add(pl);
    lights.push(pl);
  }
  add(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0b0 }), [fx - 0.5, 2.58, doorZ], root, false);

  // ── 前庭北端花台改到樸子腳北側（見 seafood.ts）；兩店之間補一道石材側牆 ──
  add(rboxEnv(B.x1 - B.x0, 3.4, B.z0 - SEAFOOD_BUILDING.z1, 0.04), stoneSideMat, [(B.x0 + B.x1) / 2, 1.7, (B.z0 + SEAFOOD_BUILDING.z1) / 2], root, false);
  // ── 南側矮欄杆（取代拆掉的南牆東段）──
  {
    const x0 = CAFE_SOUTH_WALL_END, x1 = fx + 0.2, z = WALK_BOUND + 0.12;
    const rail = M(0x6a7076, { roughness: 0.5, metalness: 0.45 });
    const n = Math.max(2, Math.round((x1 - x0) / 1.1));
    for (let i = 0; i <= n; i++) add(rcyl(0.03, 0.035, 0.95, segs), rail, [x0 + (i / n) * (x1 - x0), 0.475, z], root, true);
    for (const y of [0.92, 0.5]) {
      const r = add(rcyl(0.02, 0.02, x1 - x0, segs), rail, [(x0 + x1) / 2, y, z], root, false);
      r.rotation.z = Math.PI / 2;
    }
  }

  // ── 門口吸菸區：3 木桌 × 2 椅＋小菸灰缸 ──
  const wood = M(0x7a6a58, { roughness: 0.82 });
  const woodDark = M(0x4e4a46, { roughness: 0.85 });
  const ashMat = M(0x3a3e44, { metalness: 0.4, roughness: 0.5 });
  const TABLE_Y = 0.72;
  for (const z of CAFE_TABLE_Z) {
    add(rcyl(CAFE_TABLE_RADIUS, CAFE_TABLE_RADIUS, 0.04, segs + 4), wood, [CAFE_TABLE_X, TABLE_Y, z], root, true);
    add(rcyl(0.035, 0.04, TABLE_Y - 0.02, segs), woodDark, [CAFE_TABLE_X, TABLE_Y / 2, z], root, true);
    add(rcyl(0.2, 0.22, 0.03, segs), woodDark, [CAFE_TABLE_X, 0.015, z], root, false);
    add(rcyl(0.075, 0.065, 0.035, segs), ashMat, [CAFE_TABLE_X, TABLE_Y + 0.037, z], root, false);
    const butts = makeCigButts(3, 0.02, 0.05, 4200 + Math.round(z * 131));
    butts.position.set(CAFE_TABLE_X, TABLE_Y + 0.0545 - 0.006, z);
    root.add(butts);
  }
  for (let s = 0; s < CAFE_SMOKE_SEAT_COUNT; s++) {
    const pose = seatPose(CAFE_SMOKE_PILE_ID, s);
    const g = new THREE.Group();
    g.position.set(pose.pos.x, 0, pose.pos.z);
    g.rotation.y = pose.yaw;
    root.add(g);
    add(rboxEnv(0.4, 0.045, 0.38, 0.1), wood, [0, CHAIR_SEAT_Y, 0], g, true);
    for (const [lx, lz] of [[0.16, 0.15], [-0.16, 0.15], [0.16, -0.15], [-0.16, -0.15]] as const) {
      add(rcyl(0.018, 0.022, CHAIR_SEAT_Y - 0.02, 5), woodDark, [lx, (CHAIR_SEAT_Y - 0.02) / 2, lz], g, false);
    }
    // 椅背（本地 +Z＝背後）
    add(rboxEnv(0.38, 0.1, 0.035, 0.1), wood, [0, CHAIR_SEAT_Y + 0.3, 0.17], g, true);
    for (const lx of [-0.16, 0.16]) add(rboxEnv(0.035, 0.34, 0.035), woodDark, [lx, CHAIR_SEAT_Y + 0.17, 0.17], g, false);
    const pad = add(
      new THREE.CylinderGeometry(0.28, 0.28, 0.025, 16),
      M(0x5a9ad0, { transparent: true, opacity: 0.32, roughness: 0.2 }),
      [0, 0.015, 0],
      g,
      false,
    );
    seatPads.set(seatKey(CAFE_SMOKE_PILE_ID, s), pad);
  }

  // 地面 accent 細框＋「吸菸區」地貼／立牌（線條風，無 emoji）
  {
    const edge = M(0x2a5a86, { roughness: 0.55, metalness: 0.05 });
    const xa = CAFE_TABLE_X - 0.62, xb = CAFE_TABLE_X + 0.62;
    const za = CAFE_TABLE_Z[0] - 0.95, zb = CAFE_TABLE_Z[CAFE_TABLE_Z.length - 1] + 1.0;
    add(new THREE.BoxGeometry(xb - xa, 0.012, 0.05), edge, [(xa + xb) / 2, 0.012, za], root, false);
    add(new THREE.BoxGeometry(xb - xa, 0.012, 0.05), edge, [(xa + xb) / 2, 0.012, zb], root, false);
    add(new THREE.BoxGeometry(0.05, 0.012, zb - za), edge, [xa, 0.012, (za + zb) / 2], root, false);
    add(new THREE.BoxGeometry(0.05, 0.012, zb - za), edge, [xb, 0.012, (za + zb) / 2], root, false);
    const decalTex = makeSmokeLabelTexture('吸菸區'); textures.push(decalTex);
    const dg = new THREE.Group();
    dg.position.set(CAFE_TABLE_X, 0.02, zb - 0.27);
    dg.rotation.y = -Math.PI / 2;
    root.add(dg);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.34), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false }));
    decal.rotation.x = -Math.PI / 2;
    dg.add(decal);

    const sx = fx - CAFE_PORCH_DEPTH + 0.25, sz = WALK_BOUND - 0.3;
    add(rcyl(0.03, 0.035, 1.35, 5), M(0x4a5056, { roughness: 0.8 }), [sx, 0.68, sz], root, true);
    const signTex = makeSmokeLabelTexture('吸菸區', 320, 120); textures.push(signTex);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.32),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    sign.position.set(sx, 1.45, sz);
    sign.rotation.y = -Math.PI / 2 + 0.35;
    root.add(sign);
  }

  // 中桌菸灰缸淡煙
  const ambientSmoke = makeCigSmoke({ count: LO ? 3 : 5, seed: 20101, scale: 0.9 });
  ambientSmoke.group.position.set(CAFE_TABLE_X, TABLE_Y + 0.06, CAFE_TABLE_Z[1]);
  root.add(ambientSmoke.group);

  return {
    group: root,
    seatPads,
    lights,
    ambientSmoke,
    tick: (tSec, dt) => ambientSmoke.tick(tSec, dt),
    dispose: () => {
      for (const t of textures) t.dispose();
      ambientSmoke.dispose();
    },
  };
}
