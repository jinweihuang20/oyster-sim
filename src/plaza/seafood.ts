import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import {
  WALK_BOUND, CAFE_OPENING, SEAFOOD_BUILDING, SEAFOOD_ARCADE_X, SEAFOOD_PILE_ID, SEAFOOD_SEAT_COUNT, HQ_SEAT_SLOT,
  SEAFOOD_TABLE_X, SEAFOOD_TABLE_Z, SEAFOOD_TABLE_RADIUS, SEAFOOD_PROPS, seafoodColumnZ, seatPose, seatKey,
} from './layout';
import { CHAIR_SEAT_Y } from './props';

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

/** 大招牌：深灰浪板＋紅黃店名＋左魚右漁船（線條簡化，非任何實際店家圖樣） */
function signboardTexture(lowDetail: boolean) {
  const W = lowDetail ? 512 : 1024, H = lowDetail ? 128 : 256;
  return canvasTex(W, H, c => {
    // 浪板：深淺直條
    c.fillStyle = '#3b3f43';
    c.fillRect(0, 0, W, H);
    const rib = W / 64;
    for (let i = 0; i < 64; i++) {
      c.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      c.fillRect(i * rib, 0, rib * 0.5, H);
    }
    c.strokeStyle = 'rgba(20,22,24,0.7)';
    c.lineWidth = H * 0.03;
    c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, W - c.lineWidth, H - c.lineWidth);
    const lw = Math.max(2, H * 0.025);
    // 左：卡通魚（線條）
    {
      const cx = W * 0.11, cy = H * 0.52, r = H * 0.26;
      c.fillStyle = '#e8eef2';
      c.strokeStyle = '#f2c84b';
      c.lineWidth = lw;
      c.beginPath();
      c.ellipse(cx, cy, r * 1.25, r * 0.72, 0, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(cx - r * 1.15, cy);
      c.lineTo(cx - r * 1.9, cy - r * 0.6);
      c.lineTo(cx - r * 1.9, cy + r * 0.6);
      c.closePath();
      c.fill(); c.stroke();
      c.fillStyle = '#2b2f33';
      c.beginPath(); c.arc(cx + r * 0.7, cy - r * 0.15, r * 0.12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2b2f33';
      c.beginPath(); c.arc(cx + r * 0.25, cy, r * 0.5, -0.9, 0.9); c.stroke();
    }
    // 右：漁船（線條）
    {
      const cx = W * 0.89, cy = H * 0.6, s = H * 0.3;
      c.strokeStyle = '#e8eef2';
      c.fillStyle = '#c8433a';
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(cx - s * 1.3, cy);
      c.lineTo(cx + s * 1.3, cy);
      c.lineTo(cx + s * 0.9, cy + s * 0.55);
      c.lineTo(cx - s * 1.0, cy + s * 0.55);
      c.closePath();
      c.fill(); c.stroke();
      c.fillStyle = '#e8eef2';
      c.fillRect(cx - s * 0.5, cy - s * 0.55, s * 0.7, s * 0.55);
      c.beginPath(); c.moveTo(cx + s * 0.55, cy); c.lineTo(cx + s * 0.55, cy - s * 1.15); c.stroke();
      c.beginPath(); c.moveTo(cx + s * 0.55, cy - s * 1.1); c.lineTo(cx - s * 1.1, cy - s * 0.1); c.stroke();
    }
    // 店名：紅字黃邊
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `900 ${Math.round(H * 0.62)}px "Noto Serif TC","DFKai-SB","KaiTi","PMingLiU",serif`;
    c.lineJoin = 'round';
    c.lineWidth = H * 0.07;
    c.strokeStyle = '#f2c84b';
    c.strokeText('樸子腳', W * 0.47, H * 0.53);
    c.fillStyle = '#d23a2e';
    c.fillText('樸子腳', W * 0.47, H * 0.53);
    // 小標「海產」：黃底紅字直排
    const tx = W * 0.71, tw = H * 0.24;
    c.fillStyle = '#f2c84b';
    c.fillRect(tx - tw / 2, H * 0.18, tw, H * 0.64);
    c.fillStyle = '#b8322a';
    c.font = `800 ${Math.round(tw * 0.78)}px system-ui,sans-serif`;
    c.fillText('海', tx, H * 0.35);
    c.fillText('產', tx, H * 0.65);
  });
}

/** 「歡迎光臨 樸子腳」深色小招牌 */
function subSignTexture() {
  return canvasTex(512, 96, c => {
    c.fillStyle = '#23272b';
    c.fillRect(0, 0, 512, 96);
    c.strokeStyle = '#d23a2e';
    c.lineWidth = 5;
    c.strokeRect(4, 4, 504, 88);
    c.fillStyle = '#f4efe6';
    c.font = '800 52px system-ui,sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('歡迎光臨  樸子腳', 256, 50);
  });
}

/** 一樓店內（暖光、模糊桌椅色塊，假的） */
function interiorTexture(lowDetail: boolean) {
  const W = lowDetail ? 128 : 256, H = lowDetail ? 96 : 192;
  return canvasTex(W, H, c => {
    c.fillStyle = '#d9cdb4';
    c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,248,230,0.85)');
    g.addColorStop(1, 'rgba(120,110,96,0.4)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(70,74,78,0.55)';
    for (let i = 0; i < 4; i++) {
      const x = W * (0.12 + i * 0.22);
      c.fillRect(x, H * 0.62, W * 0.14, H * 0.05);
      c.fillRect(x + W * 0.06, H * 0.67, W * 0.02, H * 0.2);
    }
    c.fillStyle = 'rgba(210,58,46,0.55)';
    c.fillRect(W * 0.05, H * 0.08, W * 0.9, H * 0.06);
  });
}

/** 菜單海報（色塊＋橫線，不寫真菜名） */
function menuTexture(seed: number) {
  return canvasTex(96, 128, c => {
    c.fillStyle = '#f4efe6';
    c.fillRect(0, 0, 96, 128);
    c.fillStyle = seed % 2 ? '#d23a2e' : '#2a5a86';
    c.fillRect(0, 0, 96, 22);
    c.fillStyle = '#f4efe6';
    c.font = '800 15px system-ui,sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(seed % 2 ? '今日漁獲' : '熱炒', 48, 11);
    c.fillStyle = '#5c6268';
    for (let i = 0; i < 6; i++) {
      c.fillRect(10, 32 + i * 15, 50, 4);
      c.fillRect(70, 32 + i * 15, 16, 4);
    }
  });
}

/**
 * 多那芝北側海產店「樸子腳」外觀（不可進入）＋門口 3 圓桌 6 板凳。
 * 正門朝西（-X），座位 pileId = SEAFOOD_PILE_ID（純坐，不抽菸、不開工班）。
 */
export function makePlazaSeafood(
  M: MatFn,
  add: AddFn,
  lowDetail = false,
): {
  group: THREE.Group;
  seatPads: Map<string, THREE.Mesh>;
  lights: THREE.PointLight[];
  dispose: () => void;
} {
  const root = new THREE.Group();
  root.name = 'plazaSeafood';
  const LO = lowDetail;
  const segs = LO ? 6 : 10;
  const seatPads = new Map<string, THREE.Mesh>();
  const textures: THREE.Texture[] = [];
  const lights: THREE.PointLight[] = [];
  const B = SEAFOOD_BUILDING;
  const W = B.x1 - B.x0, D = B.z1 - B.z0;
  const cz = (B.z0 + B.z1) / 2;
  const fx = B.x0;
  const doorZ = B.doorZ;
  const AX = SEAFOOD_ARCADE_X;

  // ── 建築主體：淺灰水泥牆＋平頂 ──
  const wall = M(0xc9c6bf, { roughness: 0.92 });
  const roof = M(0x8e8c86, { roughness: 0.95 });
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, B.h, D), [wall, wall, roof, roof, wall, wall]);
    body.position.set((B.x0 + B.x1) / 2, B.h / 2, cz);
    body.castShadow = !LO; body.receiveShadow = !LO;
    root.add(body);
  }
  const red = M(0xb8322a, { roughness: 0.5, metalness: 0.4 });
  const dark = M(0x2b2f33, { roughness: 0.55, metalness: 0.35 });
  const white = M(0xeeeae2, { roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a3238, roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.3, depthWrite: false });

  const facadePlane = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // ── 一樓：白色下牆板＋整排玻璃拉門（店內暖光假景） ──
  {
    const slatZ1 = B.z0 + 0.75; // 北端木條側板
    const z0 = slatZ1 + 0.05, z1 = B.z1 - 0.12;
    const tex = interiorTexture(LO); textures.push(tex);
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
    add(new THREE.BoxGeometry(0.08, 0.55, z1 - z0), white, [fx - 0.04, 0.275, (z0 + z1) / 2], root, false);
    facadePlane(z1 - z0, 2.0, new THREE.MeshBasicMaterial({ map: tex }), fx - 0.01, 1.55, (z0 + z1) / 2);
    facadePlane(z1 - z0, 2.0, glass, fx - 0.05, 1.55, (z0 + z1) / 2);
    // 拉門框
    const panels = LO ? 4 : 6;
    for (let i = 0; i <= panels; i++) {
      const z = z0 + (i / panels) * (z1 - z0);
      add(new THREE.BoxGeometry(0.07, 2.0, 0.05), dark, [fx - 0.05, 1.55, z], root, false);
    }
    add(new THREE.BoxGeometry(0.08, 0.06, z1 - z0), dark, [fx - 0.05, 0.56, (z0 + z1) / 2], root, false);
    add(new THREE.BoxGeometry(0.08, 0.06, z1 - z0), dark, [fx - 0.05, 2.55, (z0 + z1) / 2], root, false);
    // 菜單海報（貼玻璃上）
    const posters = LO ? [doorZ + 1.6] : [doorZ - 1.5, doorZ + 1.6, doorZ + 2.2];
    posters.forEach((z, i) => {
      const t = menuTexture(i); textures.push(t);
      facadePlane(0.42, 0.56, new THREE.MeshBasicMaterial({ map: t }), fx - 0.08, 1.55, z);
    });
    // 北端木條側板
    const slat = M(0x8a6e52, { roughness: 0.85 });
    const n = LO ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const z = B.z0 + 0.08 + (i / (n - 1)) * (slatZ1 - B.z0 - 0.16);
      add(new THREE.BoxGeometry(0.05, 2.5, 0.06), slat, [fx - 0.04, 1.3, z], root, false);
    }
  }

  // ── 騎樓：紅鋼柱＋紅橫樑＋淺雨棚 ──
  {
    for (const z of seafoodColumnZ()) {
      add(new THREE.BoxGeometry(0.14, 2.9, 0.14), red, [AX, 1.45, z], root, true);
    }
    add(new THREE.BoxGeometry(0.18, 0.2, D + 0.1), red, [AX, 2.95, cz], root, true);
    // 柱頂到牆的短樑
    for (const z of seafoodColumnZ()) add(new THREE.BoxGeometry(fx - AX, 0.12, 0.1), red, [(fx + AX) / 2, 2.92, z], root, false);
    const canopy = add(rboxEnv(fx - AX + 0.3, 0.05, D + 0.3, 0.05), M(0x6a6f74, { roughness: 0.6, metalness: 0.4 }), [(fx + AX) / 2 - 0.1, 3.08, cz], root, true);
    canopy.rotation.z = -0.06;
  }

  // ── 大招牌（深灰浪板，跨整個正面） ──
  {
    const tex = signboardTexture(LO); textures.push(tex);
    const sw = D + 0.2, sh = 1.25, sy = 3.75;
    add(new THREE.BoxGeometry(0.12, sh, sw), M(0x34383c, { roughness: 0.7, metalness: 0.3 }), [fx - 0.08, sy, cz], root, true);
    facadePlane(sw - 0.04, sh - 0.04, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0.15 }), fx - 0.15, sy, cz);
  }
  // 小招牌「歡迎光臨 樸子腳」掛在紅樑下、正對門口
  {
    const tex = subSignTexture(); textures.push(tex);
    const m = facadePlane(1.9, 0.36, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }), AX - 0.1, 2.66, doorZ);
    m.renderOrder = 1;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.1, 0.02), dark, [AX - 0.1, 2.8, doorZ + s * 0.8], root, false);
  }

  // ── 前庭北端花台（東牆短牆頭到店牆；隨開口北移到競選總部北側） ──
  {
    const x0 = WALK_BOUND + 0.14, x1 = fx, z = CAFE_OPENING.z0 + 0.15;
    add(rboxEnv(x1 - x0, 0.55, 0.4, 0.06), M(0x9a9890, { roughness: 0.92 }), [(x0 + x1) / 2, 0.275, z], root, true);
    add(rboxEnv(x1 - x0 - 0.1, 0.12, 0.3, 0.2), M(0x5e7a52, { roughness: 0.95 }), [(x0 + x1) / 2, 0.6, z], root, false);
  }

  // ── 騎樓擺設：保麗龍冰箱、魚缸、菜單立牌 ──
  for (const p of SEAFOOD_PROPS) {
    if (p.kind === 'ice') {
      const foam = M(0xf2f2ee, { roughness: 0.95 });
      add(rboxEnv(0.55, 0.36, 0.42, 0.04), foam, [p.x, 0.18, p.z], root, true);
      add(rboxEnv(0.55, 0.3, 0.42, 0.04), foam, [p.x, 0.52, p.z], root, true);
      if (!LO) {
        add(rboxEnv(0.48, 0.3, 0.36, 0.04), foam, [p.x, 0.16, p.z + 0.48], root, true);
        // 冰塊＋魚（灰藍細長）
        add(new THREE.BoxGeometry(0.42, 0.03, 0.3), M(0xdfeef2, { roughness: 0.2, transparent: true, opacity: 0.85 }), [p.x, 0.32, p.z + 0.48], root, false);
        for (const dz of [-0.08, 0.06]) {
          const fish = add(new THREE.CapsuleGeometry(0.035, 0.22, 3, 6), M(0x8a9aa4, { roughness: 0.4, metalness: 0.3 }), [p.x, 0.35, p.z + 0.48 + dz], root, false);
          fish.rotation.x = Math.PI / 2;
        }
      }
    } else if (p.kind === 'tank') {
      add(rboxEnv(0.48, 0.55, 0.6, 0.03), dark, [p.x, 0.275, p.z], root, true);
      const tank = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.48, 0.58),
        new THREE.MeshStandardMaterial({ color: 0x8fb4b8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false }),
      );
      tank.position.set(p.x, 0.8, p.z);
      root.add(tank);
      add(new THREE.BoxGeometry(0.5, 0.04, 0.62), dark, [p.x, 1.06, p.z], root, false);
      if (!LO) {
        const fishMat = M(0xd8774a, { roughness: 0.5 });
        for (const [dx, dy, dz] of [[-0.08, 0.72, -0.12], [0.06, 0.86, 0.08], [0.0, 0.78, 0.18]] as const) {
          const f = add(new THREE.CapsuleGeometry(0.03, 0.1, 3, 6), fishMat, [p.x + dx, dy, p.z + dz], root, false);
          f.rotation.x = Math.PI / 2;
        }
      }
      // 旁邊水桶
      add(rcyl(0.15, 0.12, 0.32, segs), M(0x3f6f8e, { roughness: 0.6 }), [p.x + 0.05, 0.16, p.z - 0.5], root, true);
    } else {
      // A 字菜單架
      const t = menuTexture(1); textures.push(t);
      const frame = M(0x4a4f54, { roughness: 0.7 });
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(p.x + s * 0.11, 0.5, p.z);
        g.rotation.z = s * 0.2;
        root.add(g);
        add(new THREE.BoxGeometry(0.03, 1.0, 0.44), frame, [0, 0, 0], g, true);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.52), new THREE.MeshBasicMaterial({ map: t }));
        face.rotation.y = s * Math.PI / 2;
        face.position.set(s * 0.02, 0.12, 0);
        g.add(face);
      }
    }
  }

  // 門口暖光：自發光燈泡＋光暈，不再加 PointLight
  for (const z of [doorZ - 1.6, doorZ + 1.6]) {
    add(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }), [fx - 0.3, 2.95, z], root, false);
    if (!LO) {
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe0b8, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      halo.position.set(fx - 0.3, 2.95, z);
      root.add(halo);
    }
  }

  // ── 門口座位：3 張圓桌 × 2 張紅色塑膠板凳 ──
  const tableTop = M(0xe9e5dc, { roughness: 0.7 });
  const steel = M(0x8a9096, { roughness: 0.4, metalness: 0.6 });
  const stoolMat = M(0xc0392b, { roughness: 0.6 });
  const TABLE_Y = 0.72;
  for (const z of SEAFOOD_TABLE_Z) {
    add(rcyl(SEAFOOD_TABLE_RADIUS, SEAFOOD_TABLE_RADIUS, 0.035, segs + 6), tableTop, [SEAFOOD_TABLE_X, TABLE_Y, z], root, true);
    add(rcyl(0.03, 0.03, TABLE_Y - 0.02, segs), steel, [SEAFOOD_TABLE_X, TABLE_Y / 2, z], root, true);
    add(rcyl(0.2, 0.22, 0.03, segs), steel, [SEAFOOD_TABLE_X, 0.015, z], root, false);
  }
  for (let s = 0; s < SEAFOOD_SEAT_COUNT; s++) {
    const pose = seatPose(SEAFOOD_PILE_ID, s);
    const g = new THREE.Group();
    g.position.set(pose.pos.x, 0, pose.pos.z);
    g.rotation.y = pose.yaw;
    root.add(g);
    add(rcyl(0.17, 0.15, 0.05, segs + 2), stoolMat, [0, CHAIR_SEAT_Y - 0.02, 0], g, true);
    add(rcyl(0.13, 0.17, CHAIR_SEAT_Y - 0.06, segs), stoolMat, [0, (CHAIR_SEAT_Y - 0.06) / 2, 0], g, false);
    const pad = add(
      new THREE.CylinderGeometry(0.28, 0.28, 0.025, 16),
      M(0x5a9ad0, { transparent: true, opacity: 0.32, roughness: 0.2 }),
      [0, 0.015, 0],
      g,
      false,
    );
    seatPads.set(seatKey(SEAFOOD_PILE_ID, s), pad);
  }
  {
    // 競選總部門口：一張可坐的白色塑膠椅（朝西，椅背在東側）
    const pose = seatPose(SEAFOOD_PILE_ID, HQ_SEAT_SLOT);
    const g = new THREE.Group();
    g.position.set(pose.pos.x, 0, pose.pos.z);
    g.rotation.y = pose.yaw;
    root.add(g);
    const plastic = M(0xf2f2ee, { roughness: 0.6 });
    add(rboxEnv(0.42, 0.04, 0.42, 0.12), plastic, [0, CHAIR_SEAT_Y - 0.02, 0], g, true);
    add(rboxEnv(0.42, 0.4, 0.04, 0.12), plastic, [0, CHAIR_SEAT_Y + 0.22, 0.2], g, true);
    for (const [dx, dz] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]] as const) {
      add(new THREE.BoxGeometry(0.04, CHAIR_SEAT_Y - 0.04, 0.04), plastic, [dx, (CHAIR_SEAT_Y - 0.04) / 2, dz], g, false);
    }
    const pad = add(
      new THREE.CylinderGeometry(0.28, 0.28, 0.025, 16),
      M(0x5a9ad0, { transparent: true, opacity: 0.32, roughness: 0.2 }),
      [0, 0.015, 0],
      g,
      false,
    );
    seatPads.set(seatKey(SEAFOOD_PILE_ID, HQ_SEAT_SLOT), pad);
  }

  return {
    group: root,
    seatPads,
    lights,
    dispose: () => { for (const t of textures) t.dispose(); },
  };
}
