import * as THREE from 'three';
import type { MatFn } from '../dm/weapons';
import { rboxEnv, rcyl } from '../core/geo';
import { LOCS } from '../world/locs';
import { SHED_DOORS, SHED_FRONT_Z, SHED_W, SHED_D, SHED_RING_Z, SHED_RING_R } from './layout';

type AddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  parent: THREE.Object3D,
  cast?: boolean,
) => THREE.Mesh;

export type ShedDoorState = { locked: boolean; active: boolean };

const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",system-ui,sans-serif';
const ACCENT = 0x2a5a86;
const LOCK_GREY = 0x8a8f96;
const WALL_H = 2.6;
const DOCK_Y = 0.02;

/** 地點名稱去掉前面的圖示字元 */
export function shedName(loc: string): string {
  const l = LOCS.find(x => x.id === loc);
  return (l?.n ?? loc).replace(/^[^\u3400-\u9fff]+/, '').trim();
}

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

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/** 四塊招牌共用一張貼圖（每列一塊，4:1） */
function signAtlas(lowDetail: boolean) {
  const W = lowDetail ? 512 : 1024, H = W;
  const rowH = H / SHED_DOORS.length;
  return canvasTex(W, H, c => {
    SHED_DOORS.forEach((d, i) => {
      const y0 = i * rowH, pad = W * 0.012;
      c.fillStyle = '#efe9dc';
      roundRect(c, pad, y0 + pad, W - pad * 2, rowH - pad * 2, rowH * 0.12);
      c.fill();
      c.lineWidth = W * 0.008;
      c.strokeStyle = '#16191d';
      c.stroke();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#1b2430';
      c.font = `900 ${Math.round(rowH * 0.42)}px ${FONT}`;
      c.fillText(shedName(d.loc), W / 2, y0 + rowH * 0.4);
      const l = LOCS.find(x => x.id === d.loc);
      c.fillStyle = '#2a5a86';
      c.font = `700 ${Math.round(rowH * 0.2)}px ${FONT}`;
      c.fillText(`工錢 ×${(l?.m ?? 1).toFixed(1)}`, W / 2, y0 + rowH * 0.78);
    });
  });
}

/** 線條鎖頭（未解鎖時掛在招牌旁） */
function lockTex() {
  return canvasTex(128, 128, c => {
    c.fillStyle = '#efe9dc';
    c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill();
    c.lineWidth = 5; c.strokeStyle = '#16191d'; c.stroke();
    c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(46, 60); c.lineTo(46, 46); c.arc(64, 46, 18, Math.PI, 0); c.lineTo(82, 60); c.stroke();
    roundRect(c, 36, 58, 56, 40, 7); c.stroke();
    c.beginPath(); c.moveTo(64, 72); c.lineTo(64, 84); c.stroke();
  });
}

/**
 * 北側碼頭工寮街：四間低面數工寮（各自主題）＋招牌＋門口圓圈。
 * 靜態部分交給 mergeStaticMeshes；圓圈（shedRing）、鎖頭（shedLock）、摩天輪（shedWheel）不合併。
 * 不加任何燈。
 */
export function makePlazaShedRow(M: MatFn, add: AddFn, lowDetail = false) {
  const LO = lowDetail;
  const segs = LO ? 6 : 10;
  const group = new THREE.Group();
  group.name = 'plazaShedRow';
  const textures: THREE.Texture[] = [];
  const ownMats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  // 同色共用材質
  const matCache = new Map<string, THREE.Material>();
  const mat = (c: number, o: Record<string, unknown> = {}) => {
    const k = `${c}:${JSON.stringify(o)}`;
    let m = matCache.get(k);
    if (!m) { m = M(c, o as any); matCache.set(k, m); }
    return m;
  };
  const basic = (c: number) => {
    const k = `b${c}`;
    let m = matCache.get(k);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); matCache.set(k, m); }
    return m;
  };

  const atlas = signAtlas(LO); textures.push(atlas);
  const signMat = new THREE.MeshBasicMaterial({ map: atlas, color: 0xe8e8e8 }); ownMats.push(signMat);
  const lockT = lockTex(); textures.push(lockT);
  const lockMat = new THREE.MeshBasicMaterial({ map: lockT, transparent: true, color: 0xe8e8e8 }); ownMats.push(lockMat);
  const lockGeo = new THREE.PlaneGeometry(0.42, 0.42); geos.push(lockGeo);
  const ringGeo = new THREE.RingGeometry(SHED_RING_R - 0.06, SHED_RING_R, 48);
  const fillGeo = new THREE.CircleGeometry(SHED_RING_R - 0.06, 40);
  const chevGeo = new THREE.PlaneGeometry(0.26, 0.045);
  geos.push(ringGeo, fillGeo, chevGeo);

  const W = SHED_W, D = SHED_D;
  const locks = new Map<string, THREE.Mesh>();
  const rings = new Map<string, { g: THREE.Group; ring: THREE.MeshBasicMaterial; fill: THREE.MeshBasicMaterial }>();
  let wheel: THREE.Group | null = null;

  const body = (g: THREE.Group, color: number, h = WALL_H) =>
    add(rboxEnv(W, h, D, 0.02), mat(color, { roughness: 0.85 }), [0, DOCK_Y + h / 2, -D / 2], g, true);
  const door = (g: THREE.Group, color = 0x2b2f33, w = 1.0, h = 1.9) =>
    add(new THREE.BoxGeometry(w, h, 0.06), mat(color, { roughness: 0.7 }), [0, DOCK_Y + h / 2, 0.02], g, false);

  SHED_DOORS.forEach((d, i) => {
    const g = new THREE.Group();
    g.name = `shed-${d.loc}`;
    g.position.set(d.x, 0, SHED_FRONT_Z);
    group.add(g);

    if (d.loc === 'home') {
      // 自家蚵寮：鍍鋅鐵皮寮、鏽紅斜頂、木柱、門口一籃蚵殼＋紅色塑膠椅
      body(g, 0x8d9aa3);
      for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.03, WALL_H - 0.1, 0.02), mat(0x76838c), [k * 0.68, DOCK_Y + WALL_H / 2, 0.012], g, false);
      const roof = add(rboxEnv(W + 0.5, 0.08, D + 0.7, 0.05), mat(0x9a5a3a, { roughness: 0.9 }), [0, DOCK_Y + WALL_H + 0.18, -D / 2 + 0.15], g, true);
      roof.rotation.x = -0.12;
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.12, WALL_H + 0.15, 0.12), mat(0x6a4a2a), [sx * (W / 2 - 0.02), DOCK_Y + (WALL_H + 0.15) / 2, 0.08], g, true);
      door(g, 0x3a2e24);
      add(rcyl(0.26, 0.22, 0.3, segs), mat(0x8a6a38), [-1.12, DOCK_Y + 0.15, 0.24], g, false);
      add(new THREE.SphereGeometry(0.22, segs, 4), mat(0xb8b0a0), [-1.12, DOCK_Y + 0.3, 0.24], g, false).scale.set(1, 0.45, 1);
      const red = mat(0xd03a30, { roughness: 0.6 });
      add(new THREE.BoxGeometry(0.4, 0.05, 0.38), red, [1.12, DOCK_Y + 0.42, 0.24], g, false);
      add(new THREE.BoxGeometry(0.4, 0.38, 0.05), red, [1.12, DOCK_Y + 0.62, 0.06], g, false);
      for (const lx of [-0.17, 0.17]) for (const lz of [0.08, 0.4]) add(new THREE.BoxGeometry(0.035, 0.42, 0.035), red, [1.12 + lx, DOCK_Y + 0.21, lz], g, false);
    } else if (d.loc === 'wanggong') {
      // 王功漁港：白牆藍腰帶、藍平頂、救生圈、旁邊一座黑白條紋燈塔
      body(g, 0xeef0ec);
      add(new THREE.BoxGeometry(W + 0.02, 0.5, D + 0.02), mat(0x2a6ab0), [0, DOCK_Y + 0.25, -D / 2], g, false);
      add(rboxEnv(W + 0.3, 0.12, D + 0.3, 0.05), mat(0x2a6ab0), [0, DOCK_Y + WALL_H + 0.06, -D / 2], g, true);
      door(g, 0x2b3a4a);
      add(new THREE.BoxGeometry(0.7, 0.5, 0.05), mat(0x3a5a78, { roughness: 0.3 }), [1.08, DOCK_Y + 1.45, 0.02], g, false);
      const buoy = add(new THREE.TorusGeometry(0.2, 0.055, 6, LO ? 12 : 18), mat(0xd8402e), [-1.1, DOCK_Y + 1.45, 0.06], g, false);
      buoy.rotation.set(0, 0, 0);
      const lx = W / 2 + 0.45, lz = -D + 0.5;
      const bands = 5, bh = 0.72;
      for (let k = 0; k < bands; k++) {
        const r0 = 0.44 - k * 0.025, r1 = 0.44 - (k + 1) * 0.025;
        add(rcyl(r1, r0, bh, segs), mat(k % 2 ? 0xf2f2ee : 0x1b1d20, { roughness: 0.7 }), [lx, DOCK_Y + bh * (k + 0.5), lz], g, k === 0);
      }
      const topY = DOCK_Y + bh * bands;
      add(rcyl(0.36, 0.36, 0.08, segs), mat(0x1b1d20), [lx, topY + 0.04, lz], g, false);
      add(rcyl(0.22, 0.22, 0.34, segs), basic(0xffe6a0), [lx, topY + 0.25, lz], g, false);
      add(new THREE.ConeGeometry(0.28, 0.3, segs), mat(0xc03a30), [lx, topY + 0.57, lz], g, false);
    } else if (d.loc === 'dongshi') {
      // 東石漁人碼頭：木棧屋、雙斜頂、後方小摩天輪
      body(g, 0xb8875a);
      for (const sx of [-1, 1]) {
        const r = add(rboxEnv(W / 2 + 0.45, 0.08, D + 0.4, 0.05), mat(0x4e5f70, { roughness: 0.8 }), [sx * (W / 4 + 0.08), DOCK_Y + WALL_H + 0.36, -D / 2], g, true);
        r.rotation.z = -sx * 0.42;
      }
      add(new THREE.BoxGeometry(W, 0.86, 0.06), mat(0xb8875a), [0, DOCK_Y + WALL_H + 0.2, -0.03], g, false);
      door(g, 0x4a3424);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.62, 0.48, 0.05), mat(0xf4e6c8, { roughness: 0.5 }), [sx * 1.08, DOCK_Y + 1.45, 0.02], g, false);
      // 摩天輪（不合併；一般畫質慢轉）
      const hubY = DOCK_Y + 3.35, wz = -D - 0.7, R = 1.45;
      const leg = mat(0x8a929a, { metalness: 0.3, roughness: 0.6 });
      for (const sz of [-0.28, 0.28]) for (const sx of [-1, 1]) {
        const l = add(new THREE.BoxGeometry(0.07, hubY / Math.cos(0.3), 0.07), leg, [sx * Math.tan(0.3) * hubY / 2, hubY / 2, wz + sz], g, false);
        l.rotation.z = sx * 0.3;
      }
      const wg = new THREE.Group();
      wg.name = 'shedWheel';
      wg.position.set(0, hubY, wz);
      g.add(wg);
      const rimMat = mat(0xe8e4da, { roughness: 0.5 });
      add(new THREE.TorusGeometry(R, 0.04, 4, LO ? 24 : 40), rimMat, [0, 0, 0], wg, false);
      add(new THREE.TorusGeometry(R * 0.55, 0.025, 4, LO ? 16 : 28), rimMat, [0, 0, 0], wg, false);
      const n = 8, cabin = [0xd03a30, 0xf0c020, 0x2a6ab0, 0x30a050];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const s = add(new THREE.BoxGeometry(0.035, R, 0.035), rimMat, [Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0], wg, false);
        s.rotation.z = a - Math.PI / 2;
        add(new THREE.BoxGeometry(0.22, 0.2, 0.2), mat(cabin[k % 4], { roughness: 0.6 }), [Math.cos(a) * R, Math.sin(a) * R - 0.1, 0], wg, false);
      }
      add(rcyl(0.09, 0.09, 0.66, segs), leg, [0, 0, 0], wg, false).rotation.x = Math.PI / 2;
      wheel = wg;
    } else {
      // 布袋蚵寮大廠：灰色廠房、鋸齒屋頂、捲門、煙囪
      body(g, 0x9aa0a6);
      const teeth = 3, tw = W / teeth;
      for (let k = 0; k < teeth; k++) {
        const t = add(rboxEnv(tw + 0.12, 0.07, D + 0.2, 0.05), mat(0x6e757c, { roughness: 0.8 }), [-W / 2 + tw * (k + 0.5), DOCK_Y + WALL_H + 0.3, -D / 2], g, true);
        t.rotation.z = 0.5;
        add(new THREE.BoxGeometry(0.05, 0.62, D + 0.2), mat(0x6e757c), [-W / 2 + tw * (k + 1) - 0.03, DOCK_Y + WALL_H + 0.3, -D / 2], g, false);
      }
      add(new THREE.BoxGeometry(1.5, 1.85, 0.06), mat(0xc8ccd0, { roughness: 0.6, metalness: 0.2 }), [0, DOCK_Y + 0.925, 0.02], g, false);
      for (let k = 1; k < 7; k++) add(new THREE.BoxGeometry(1.5, 0.02, 0.02), mat(0x7a8086), [0, DOCK_Y + k * 0.26, 0.06], g, false);
      const cx = -W / 2 + 0.45, cz = -D + 0.45;
      add(rcyl(0.2, 0.26, 4.6, segs), mat(0xb8b2a8, { roughness: 0.9 }), [cx, DOCK_Y + 2.3, cz], g, true);
      add(rcyl(0.205, 0.205, 0.32, segs), mat(0xc03a30), [cx, DOCK_Y + 4.3, cz], g, false);
      add(new THREE.BoxGeometry(0.62, 0.44, 0.05), mat(0x3a4a58, { roughness: 0.3 }), [1.15, DOCK_Y + 1.55, 0.02], g, false);
    }

    // 招牌（共用貼圖；UV 取第 i 列）
    const sg = new THREE.PlaneGeometry(2.3, 0.575);
    const uv = sg.getAttribute('uv') as THREE.BufferAttribute;
    const v0 = 1 - (i + 1) / SHED_DOORS.length, v1 = 1 - i / SHED_DOORS.length;
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) > 0.5 ? v1 : v0);
    uv.needsUpdate = true;
    add(sg, signMat, [0, DOCK_Y + 2.2, 0.075], g, false);
    const lk = new THREE.Mesh(lockGeo, lockMat);
    lk.name = 'shedLock';
    lk.position.set(1.42, DOCK_Y + 2.2, 0.08);
    lk.visible = false;
    g.add(lk);
    locks.set(d.loc, lk);

    // 門口圓圈（細環＋淡底＋朝門的細箭頭）
    const rg = new THREE.Group();
    rg.name = 'shedRing';
    rg.position.set(d.x, DOCK_Y + 0.012, SHED_RING_Z);
    const ringMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.85, depthWrite: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.12, depthWrite: false });
    ownMats.push(ringMat, fillMat);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; rg.add(ring);
    const fill = new THREE.Mesh(fillGeo, fillMat); fill.rotation.x = -Math.PI / 2; fill.position.y = -0.002; rg.add(fill);
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(chevGeo, ringMat);
      c.rotation.x = -Math.PI / 2;
      c.rotation.z = -s * Math.PI / 4; // 兩撇組成指向門（-Z）的箭頭
      c.position.set(s * 0.085, 0.001, 0);
      rg.add(c);
    }
    rg.renderOrder = 2;
    group.add(rg);
    rings.set(d.loc, { g: rg, ring: ringMat, fill: fillMat });
  });

  function setDoorState(loc: string, st: ShedDoorState) {
    const r = rings.get(loc);
    if (r) {
      const col = st.locked ? LOCK_GREY : ACCENT;
      if (r.ring.color.getHex() !== col) { r.ring.color.setHex(col); r.fill.color.setHex(col); }
      r.ring.opacity = st.active ? 1 : 0.85;
      r.fill.opacity = st.active ? 0.22 : 0.12;
      r.g.userData.active = st.active;
      if (!st.active) r.g.scale.setScalar(1);
    }
    const lk = locks.get(loc);
    if (lk) lk.visible = st.locked;
  }

  let t = 0;
  function tick(dt: number, eco: boolean) {
    t += dt;
    if (wheel && !LO && !eco) wheel.rotation.z += dt * 0.22;
    for (const r of rings.values()) {
      if (r.g.userData.active) r.g.scale.setScalar(1 + Math.sin(t * 4) * 0.025);
    }
  }

  function dispose() {
    for (const tx of textures) tx.dispose();
    for (const m of ownMats) m.dispose();
    for (const gg of geos) gg.dispose();
  }

  return { group, setDoorState, tick, dispose };
}
