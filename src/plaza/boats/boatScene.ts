/**
 * 廣場西側海面的場景：海（沿用出海採蚵的海面 shader）、護岸、碼頭、5 艘膠筏、航跡水花、夜間燈光。
 * 手機效能：
 * - 5 艘船＝近模／遠模兩個 InstancedMesh（各 1 個 draw call），自己開的那艘才用完整可動模型。
 * - 碼頭（木板＋樁＋護岸＋燈柱）合成一個 vertex-color mesh。
 * - 夜燈不加真的光源：燈頭自發光＋一包 Points 光暈＋疊加貼花光池（水面／木板）；船頭燈＝疊加光錐貼花＋光點。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeWater, makeRaft, makeFx, type Raft } from '../../sea/seaModels';
import { PB, dockSlot } from './boatLogic';

const lam = (c: number, o: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

/** 海面高度圖範圍 */
const RECT = { x0: -140, z0: -75, w: 116, h: 150 };
/** 碼頭燈柱（每 6 m 一支，南北交錯） */
export const DOCK_LAMPS: readonly { x: number; z: number }[] = Array.from({ length: 3 }, (_, i) => ({ x: -26.5 - i * 5.5, z: (i % 2 ? 1 : -1) * (PB.pierHalfW - 0.15) }));
/** 廣場走到碼頭那段泥灘路的路燈 */
const PATH_LAMPS: readonly { x: number; z: number }[] = [{ x: -15.6, z: 2.3 }, { x: -20.6, z: -2.3 }];
const ALL_LAMPS = [...DOCK_LAMPS, ...PATH_LAMPS];
const LAMP_H = 2.6;
/** 同時畫幾個漂流箱：平常 2 個＋漂流潮 4 個（2026-11 降低頻率；舊伺服器 3＋8，留著餘裕） */
const DRIFT_MAX = 14;
/** 同時畫幾座蚵棚（只畫鏡頭附近）、幾串蚵串、幾盞熟了的燈 */
const RACK_DRAW = 24, STR_DRAW = 320, RIPE_DRAW = 24;
/** 蚵棚架子：長 5 m、寬 2.2 m；兩排吊蚵串，每排 12 格 */
export const RACK_GEO = { len: 5, half: 1.1, slots: 12, topY: 1.25 };

function heightMap() {
  const W = 232, H = 300, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const px = (x: number) => (x - RECT.x0) / RECT.w * W, pz = (z: number) => (z - RECT.z0) / RECT.h * H, k = W / RECT.w;
  // 近岸淺（綠藍）→ 外海深：x 方向線性漸層
  const g = c.createLinearGradient(px(PB.shoreX), 0, px(PB.shoreX - 26), 0);
  g.addColorStop(0, 'rgb(140,0,0)'); g.addColorStop(0.35, 'rgb(118,0,0)'); g.addColorStop(1, 'rgb(0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighten';
  const blob = (x: number, z: number, r: number, top: number, ch: 'r' | 'g') => {
    const gr = c.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), r * k);
    const v = Math.round(top * 255);
    gr.addColorStop(0, ch === 'r' ? `rgb(${v},0,0)` : `rgb(0,${v},0)`); gr.addColorStop(1, 'rgb(0,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(px(x), pz(z), r * k, 0, Math.PI * 2); c.fill();
  };
  // 外海小沙洲（露出水面）＋淺灘
  blob(-96, -34, 14, 0.82, 'r'); blob(-84, 41, 10, 0.78, 'r'); blob(-118, 8, 9, 0.7, 'r');
  // 護岸邊、碼頭樁的白浪
  for (let z = -70; z <= 70; z += 3) blob(PB.shoreX - 0.4, z, 1.6, 0.8, 'g');
  for (let x = PB.pierX1; x <= PB.pierX0; x += 2.2) { blob(x, -PB.pierHalfW, 0.9, 0.55, 'g'); blob(x, PB.pierHalfW, 0.9, 0.55, 'g'); }
  blob(PB.pierX1, 0, 2.2, 0.7, 'g');
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** 把一組 mesh（含子物件）烘成一個帶頂點色的幾何（同一個 Lambert 材質畫） */
function bakeGroup(root: THREE.Object3D, skip?: (m: THREE.Mesh) => boolean) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts: THREE.BufferGeometry[] = [];
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || !m.visible || skip?.(m)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    m4.multiplyMatrices(inv, m.matrixWorld); g.applyMatrix4(m4);
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshLambertMaterial;
    col.copy(mat.color ?? col.setHex(0xffffff));
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  });
  const out = mergeGeometries(parts); parts.forEach(p => p.dispose());
  return out;
}
const tint = (g: THREE.BufferGeometry, hex: number) => {
  // 先轉成非索引再算頂點數（之前用索引前的 24 個頂點填色，後面 12 個頂點吃到下一塊的顏色）
  const gg = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
  const c = new THREE.Color(hex), n = gg.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); return gg;
};
const box = (w: number, h: number, d: number, x: number, y: number, z: number, hex: number, ry = 0) => {
  const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return tint(g, hex);
};
const cyl = (r: number, h: number, x: number, y: number, z: number, hex: number, seg = 6) => {
  const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y, z); return tint(g, hex);
};

/**
 * 漂流箱：一眼看得出是「木箱」——四面橫木條（條與條之間有深色縫）、四角立柱、上下框、每面一根斜撐、蓋子也是木條。
 * 原點在水線附近：箱子約 1/4 泡在水裡。全部烘成一個頂點色幾何（InstancedMesh 一個 draw call）。
 */
export function driftCrateGeo(withFlag = false) {
  const S = 0.96, H = 0.82, cy = 0.2, f = 0.085, t = 0.035, gap = 0.024, out = S / 2;
  const WOOD = [0xc48d4a, 0xb27a3d, 0xcd9a57, 0xa8713a], TRIM = 0x5a381a, BRACE = 0x83542a, GAP = 0x3e2612, LID = [0xd4a464, 0xc39052, 0xd8aa6c, 0xbf8b4c];
  const parts: THREE.BufferGeometry[] = [box(S - 0.05, H - 0.05, S - 0.05, 0, cy, 0, GAP)];
  const y0 = cy - H / 2, y1 = cy + H / 2;
  // 四面橫木條：上下框中間塞 4 條
  const n = 4, ph = (H - 2 * f - (n + 1) * gap) / n;
  for (let side = 0; side < 4; side++) {
    const ry = side * Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const y = y0 + f + gap + ph / 2 + i * (ph + gap);
      const g = new THREE.BoxGeometry(S - 2 * f + 0.01, ph, t); g.translate(0, y, out - t / 2 + 0.004); g.rotateY(ry); parts.push(tint(g, WOOD[(i + side) % 4]));
    }
    // 斜撐（框內對角）
    const w = S - 2 * f, hh = H - 2 * f, len = Math.hypot(w, hh), ang = Math.atan2(hh, w) * (side % 2 ? 1 : -1);
    const b = new THREE.BoxGeometry(len - 0.02, 0.075, t); b.rotateZ(ang); b.translate(0, cy, out + t / 2 - 0.002); b.rotateY(ry); parts.push(tint(b, BRACE));
    // 上下框（四邊）
    for (const y of [y0 + f / 2, y1 - f / 2]) { const g = new THREE.BoxGeometry(S + 0.02, f, f); g.translate(0, y, out - f / 2 + 0.012); g.rotateY(ry); parts.push(tint(g, TRIM)); }
    // 角柱
    const c = new THREE.BoxGeometry(f + 0.012, H + 0.012, f + 0.012); c.translate(out - f / 2 + 0.012, cy, out - f / 2 + 0.012); c.rotateY(ry); parts.push(tint(c, TRIM));
  }
  // 蓋子：4 條木板＋兩根橫壓條
  const lw = (S - 2 * f - 3 * gap) / 4;
  for (let i = 0; i < 4; i++) parts.push(box(lw, t, S - 2 * f + 0.01, -S / 2 + f + lw / 2 + i * (lw + gap), y1 - t / 2 + 0.006, 0, LID[i]));
  for (const z of [-0.2, 0.2]) parts.push(box(S - 2 * f + 0.01, t * 0.9, 0.07, 0, y1 + 0.012, z, BRACE));
  if (withFlag) parts.push(box(0.04, 0.9, 0.04, out - 0.05, y1 + 0.45, out - 0.05, 0x30343a), box(0.3, 0.18, 0.02, out + 0.1, y1 + 0.78, out - 0.05, 0xff7a1a));
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g;
}

/** 蚵棚竹架（公共／私人同一個；私人另外插小旗）：竹竿＋橫竹＋浮球，約 300 三角形 */
export function rackFrameGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const { len, half, topY } = RACK_GEO;
  const BAM = 0xc9b27a, BAM2 = 0xa8915c, FLOAT = 0xeeeee8;
  for (const sx of [-len / 2, 0, len / 2]) for (const sz of [-half, half]) {
    const g = new THREE.CylinderGeometry(0.06, 0.075, 2.3, 5); g.translate(sx, topY - 1.0, sz); parts.push(tint(g, sx === 0 ? BAM2 : BAM));
  }
  for (const sz of [-half, half]) { const g = new THREE.CylinderGeometry(0.05, 0.05, len + 0.5, 5); g.rotateZ(Math.PI / 2); g.translate(0, topY, sz); parts.push(tint(g, BAM)); }
  for (const sx of [-len / 2, 0, len / 2]) { const g = new THREE.CylinderGeometry(0.045, 0.045, half * 2 + 0.3, 5); g.rotateX(Math.PI / 2); g.translate(sx, topY + 0.06, 0); parts.push(tint(g, BAM2)); }
  for (const sx of [-len / 2 + 0.6, len / 2 - 0.6]) for (const sz of [-half, half]) { const g = new THREE.SphereGeometry(0.22, 7, 5); g.scale(1, 0.75, 1); g.translate(sx, -0.02, sz); parts.push(tint(g, FLOAT)); }
  const out = mergeGeometries(parts); parts.forEach(p => p.dispose()); return out;
}
/** 一串蚵串：繩子＋四坨蚵（原點在橫竹上） */
export function rackStringGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const rope = new THREE.CylinderGeometry(0.012, 0.012, 1.25, 4); rope.translate(0, -0.62, 0); parts.push(tint(rope, 0x3a3a30));
  const C = [0x8a8678, 0x9a9484, 0x7c786a, 0x948e7c];
  for (let j = 0; j < 4; j++) {
    const l = new THREE.IcosahedronGeometry(0.13 - j * 0.008, 0); l.scale(1, 0.8, 1.15); l.rotateY(j * 1.7); l.translate((j % 2 ? 0.03 : -0.03), -0.3 - j * 0.24, (j % 2 ? -0.02 : 0.02));
    parts.push(tint(l, C[j]));
  }
  const out = mergeGeometries(parts); parts.forEach(p => p.dispose()); return out;
}

/** 遠處的膠筏：幾個方塊（約 60 個三角形） */
function farBoatGeo(trim: number) {
  const parts = [
    box(2.2, 0.24, 3.6, 0, 0.08, 0.4, 0xe9ece8), box(2.0, 0.22, 1.2, 0, 0.34, -1.85, 0xe9ece8),
    box(2.1, 0.05, 3.1, 0, 0.23, 0.35, 0x9a7a52), box(0.1, 0.14, 3.4, -1.1, 0.3, 0.4, trim), box(0.1, 0.14, 3.4, 1.1, 0.3, 0.4, trim),
    box(0.42, 0.55, 0.55, 0, 0.66, 2.3, 0x2a2e34), box(0.7, 0.45, 0.5, 0.55, 0.48, 0.9, 0x3a7ab8),
  ];
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g;
}

/** 徑向漸層貼圖（光池／光暈共用） */
function glowTex(soft = 1) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25 * soft, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** 光錐貼圖（船頭燈打在水面：前寬後窄、往前淡出） */
function coneTex() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d')!;
  const img = c.createImageData(64, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
    const v = y / 127, half = 0.12 + 0.38 * v, u = Math.abs(x / 63 - 0.5);
    const a = Math.max(0, 1 - u / half) * Math.pow(1 - v, 1.3) * Math.min(1, v * 6);
    const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export type PlazaSea = ReturnType<typeof makePlazaSea>;

export function makePlazaSea(parent: THREE.Object3D, o: { coarse: boolean; fog?: THREE.Fog | null; plazaLamps?: readonly (readonly [number, number])[] }) {
  const group = new THREE.Group(); group.name = 'plazaSea'; parent.add(group);
  const fog = o.fog ?? new THREE.Fog(0xc8dce8, 20, 64);
  const water = makeWater(group, heightMap(), o.coarse, { c: fog.color.clone(), n: fog.near, f: fog.far }, {
    rect: RECT, y: PB.waterY, seg: o.coarse ? [58, 75] : [96, 124], outer: { x: -330, z: 0, size: 600 },
  });
  water.inner.name = 'plazaSeaWater';

  // ---------- 護岸＋碼頭＋燈柱：一個 mesh ----------
  const parts: THREE.BufferGeometry[] = [];
  const stone = 0x7a7468, stoneD = 0x5e5a52, plank = 0x8a6a48, plankD = 0x6e5236, post = 0x4a3a2a;
  // 護岸：沿西緣 z -70～70（廣場那段在泥灘外側），石塊高低錯落
  for (let z = -70; z < 70; z += 2) parts.push(box(0.9, 1.0 + ((z * 7) % 3) * 0.04, 2.02, PB.shoreX - 0.45, -0.48, z + 1, (z / 2) % 2 ? stone : stoneD));
  // 廣場南北兩側的海岸（泥灘外的沙地），讓海岸線連續
  for (const s of [-1, 1]) parts.push(box(13, 0.06, 58, PB.shoreX + 6.5, -0.02, s * (11.5 + 29), 0xd9cba4));
  // 碼頭木板（橫向一片片）＋兩側邊樑
  const L = PB.pierX0 - PB.pierX1;
  for (let i = 0; i < Math.round(L / 0.5); i++) parts.push(box(0.46, 0.07, PB.pierHalfW * 2, PB.pierX0 - 0.25 - i * 0.5, -0.035, 0, i % 3 === 0 ? plankD : plank));
  for (const s of [-1, 1]) parts.push(box(L, 0.16, 0.16, (PB.pierX0 + PB.pierX1) / 2, -0.12, s * (PB.pierHalfW - 0.06), plankD));
  // 樁：每 2.2 m 一對，插進水裡
  for (let x = PB.pierX0 - 0.6; x >= PB.pierX1; x -= 2.2) for (const s of [-1, 1]) parts.push(cyl(0.13, 1.7, x, -0.75, s * (PB.pierHalfW - 0.05), post));
  // 碼頭尾端的繫船柱
  for (let i = 0; i < PB.count; i++) { const d = dockSlot(i); parts.push(cyl(0.09, 0.32, d.x, 0.13, Math.sign(d.z) * (PB.pierHalfW - 0.2), 0x2a2a2a, 8)); }
  // 燈柱：桿＋燈罩（燈頭另外用自發光材質）
  for (const p of ALL_LAMPS) { parts.push(cyl(0.05, LAMP_H, p.x, LAMP_H / 2, p.z, 0x3a3e44, 6)); parts.push(box(0.36, 0.08, 0.36, p.x, LAMP_H + 0.02, p.z, 0x2a2e34)); }
  const dockGeo = mergeGeometries(parts); parts.forEach(p => p.dispose());
  const dock = new THREE.Mesh(dockGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  dock.name = 'plazaDock'; group.add(dock);
  // 燈頭（白天是霧白燈罩、晚上自發光）：一個 mesh
  const headParts = ALL_LAMPS.map(p => { const g = new THREE.SphereGeometry(0.15, 10, 6); g.translate(p.x, LAMP_H - 0.12, p.z); return g; });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xd8d4c8 });
  const lampHeads = new THREE.Mesh(mergeGeometries(headParts), lampHeadMat); headParts.forEach(p => p.dispose());
  group.add(lampHeads);

  // ---------- 5 艘膠筏：近模／遠模 InstancedMesh ----------
  const tmp = new THREE.Group();
  const proto = makeRaft(tmp, { trim: 0x2a5a86, crew: [] });
  const nearGeo = bakeGroup(proto.g);
  tmp.clear();
  const boatMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const near = new THREE.InstancedMesh(nearGeo, boatMat, PB.count); near.name = 'plazaBoatsNear';
  const far = new THREE.InstancedMesh(farBoatGeo(0x2a5a86), boatMat, PB.count); far.name = 'plazaBoatsFar';
  for (const m of [near, far]) { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(m); }

  // ---------- 漂流箱：一個 InstancedMesh（木條拼的木箱，約 600 三角形，一個 draw call）----------
  const crateGeo = driftCrateGeo();
  const crates = new THREE.InstancedMesh(crateGeo, boatMat, DRIFT_MAX); crates.name = 'plazaDriftCrates';
  crates.count = 0; crates.frustumCulled = false; crates.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(crates);
  // 金色大箱子：同一個 instanced mesh、只換顏色（不多 draw call）
  crates.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DRIFT_MAX * 3).fill(1), 3); crates.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const _gold = new THREE.Color(1.35, 1.05, 0.35), _white = new THREE.Color(1, 1, 1);

  // ---------- 蚵棚：架子／蚵串／私人小旗／熟了的燈（各一個 InstancedMesh）----------
  const rackFrames = new THREE.InstancedMesh(rackFrameGeo(), boatMat, RACK_DRAW); rackFrames.name = 'plazaRacks';
  const rackStrs = new THREE.InstancedMesh(rackStringGeo(), boatMat, STR_DRAW); rackStrs.name = 'plazaRackStrings';
  const flagG = (() => { const p = [box(0.04, 1.1, 0.04, 0, 0.55, 0, 0xffffff), box(0.5, 0.3, 0.02, 0.27, 0.92, 0, 0xffffff)]; const g = mergeGeometries(p); p.forEach(x => x.dispose()); return g; })();
  const flagMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const rackFlags = new THREE.InstancedMesh(flagG, flagMat, RACK_DRAW); rackFlags.name = 'plazaRackFlags';
  rackFlags.setColorAt(0, new THREE.Color(1, 1, 1));
  // 熟了：竿頂一顆自己發光的燈（不受光照，白天也看得出來；霧會蓋掉遠的）
  const ripeG = new THREE.SphereGeometry(0.16, 8, 6); ripeG.translate(0, 0.16, 0);
  const ripeMat = new THREE.MeshBasicMaterial({ color: 0xffd84a });
  const rackRipe = new THREE.InstancedMesh(ripeG, ripeMat, RIPE_DRAW); rackRipe.name = 'plazaRackRipe';
  for (const m of [rackFrames, rackStrs, rackFlags, rackRipe]) { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(m); }
  const FLAG_MINE = new THREE.Color(0x2a5a86), FLAG_OTHER = new THREE.Color(0xd84a3a);

  // ---------- 航跡／水花 ----------
  const fx = makeFx(group, o.coarse ? 110 : 160, PB.waterY + 0.1);

  // ---------- 夜燈（假光）：光暈 Points、光池貼花、船頭光錐 ----------
  const glowT = glowTex(), coneT = coneTex();
  const N_GLOW = ALL_LAMPS.length + PB.count + DRIFT_MAX + RIPE_DRAW + 8;
  const gPos = new Float32Array(N_GLOW * 3), gCol = new Float32Array(N_GLOW * 3);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage));
  glowGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3).setUsage(THREE.DynamicDrawUsage));
  const glowMat = new THREE.PointsMaterial({ size: 1.5, map: glowT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const glows = new THREE.Points(glowGeo, glowMat); glows.frustumCulled = false; glows.renderOrder = 5; glows.name = 'plazaSeaGlows'; group.add(glows);
  // 碼頭燈光池：每支燈一個水面光池＋一個木板光池，合成一個 mesh
  const poolParts: THREE.BufferGeometry[] = [];
  const pool = (x: number, y: number, z: number, s: number) => { const a = new THREE.PlaneGeometry(s, s); a.rotateX(-Math.PI / 2); a.translate(x, y, z); poolParts.push(a); };
  for (const p of DOCK_LAMPS) { pool(p.x, PB.waterY + 0.14, p.z + Math.sign(p.z) * 2.2, 7); pool(p.x, 0.02, p.z * 0.4, 4.2); }
  for (const p of PATH_LAMPS) pool(p.x, 0.03, p.z * 0.6, 5.2);
  // 廣場：棚下四盞吊燈的地面暖光（原本只有燈泡光暈）
  for (const [x, z] of o.plazaLamps ?? []) pool(x, 0.025, z, 6.5);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowT, color: 0xffc070, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pools = new THREE.Mesh(mergeGeometries(poolParts), poolMat); poolParts.forEach(p => p.dispose());
  pools.renderOrder = 3; pools.visible = false; pools.name = 'plazaSeaPools'; group.add(pools);
  // 船頭燈光錐：InstancedMesh（只畫有人開的船）
  const coneG = new THREE.PlaneGeometry(1, 1); coneG.rotateX(-Math.PI / 2); coneG.translate(0, 0, -0.5);
  const coneMat = new THREE.MeshBasicMaterial({ map: coneT, color: 0xfff0c8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const cones = new THREE.InstancedMesh(coneG, coneMat, PB.count); cones.count = 0; cones.frustumCulled = false; cones.renderOrder = 3; cones.name = 'plazaBoatCones'; group.add(cones);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  let nearN = 0, farN = 0, coneN = 0, glowN = 0, crateN = 0, rackN = 0, strN = 0, flagN = 0, ripeN = 0;
  let night = 0;
  const lampOn = new THREE.Color(0xffd890), lampOff = new THREE.Color(0xd8d4c8);

  return {
    group, water, fx, near, far, dock,
    /** 每幀開頭：清空這幀要畫的船 */
    begin() { nearN = farN = coneN = 0; glowN = 0; crateN = 0; rackN = strN = flagN = ripeN = 0; },
    /** 蚵棚架子；priv：0 公共、1 自己的（藍旗）、2 別人的私人（紅旗） */
    rack(x: number, z: number, h: number, bob: number, priv: 0 | 1 | 2) {
      if (rackN >= RACK_DRAW) return false;
      _e.set(0, h, bob * 0.02); _q.setFromEuler(_e); _p.set(x, PB.waterY + bob * 0.04, z); _m.compose(_p, _q, _s);
      rackFrames.setMatrixAt(rackN++, _m);
      if (priv && flagN < RACK_DRAW) {
        _p.set(x + Math.cos(h) * RACK_GEO.len / 2, PB.waterY + RACK_GEO.topY + 0.1, z - Math.sin(h) * RACK_GEO.len / 2); _m.compose(_p, _q, _s);
        rackFlags.setMatrixAt(flagN, _m); rackFlags.setColorAt(flagN++, priv === 1 ? FLAG_MINE : FLAG_OTHER);
      }
      return true;
    },
    /** 吊 n 串（兩排各 12 格；max 少於 24 時平均分） */
    strings(x: number, z: number, h: number, n: number, max: number, t: number) {
      const per = Math.ceil(Math.max(1, max) / 2), step = (RACK_GEO.len - 0.6) / Math.max(1, per - 1);
      const c = Math.cos(h), sn = Math.sin(h);
      for (let i = 0; i < n && strN < STR_DRAW; i++) {
        const row = i % 2, k = Math.floor(i / 2);
        const lx = -RACK_GEO.len / 2 + 0.3 + k * step, lz = row ? RACK_GEO.half - 0.05 : -RACK_GEO.half + 0.05;
        const sw = Math.sin(t * 1.3 + i * 0.9 + x) * 0.05;
        _e.set(sw, h, sw * 0.6); _q.setFromEuler(_e);
        _p.set(x + c * lx + sn * lz, PB.waterY + RACK_GEO.topY, z - sn * lx + c * lz); _m.compose(_p, _q, _s);
        rackStrs.setMatrixAt(strN++, _m);
      }
    },
    /** 長滿了：竿頂的燈（夜晚加光暈） */
    ripe(x: number, z: number, h: number, pulse: number) {
      if (ripeN >= RIPE_DRAW) return;
      _p.set(x - Math.cos(h) * RACK_GEO.len / 2, PB.waterY + RACK_GEO.topY + 0.12, z + Math.sin(h) * RACK_GEO.len / 2);
      _q.identity(); _s.setScalar(0.85 + pulse * 0.3); _m.compose(_p, _q, _s); _s.set(1, 1, 1);
      rackRipe.setMatrixAt(ripeN++, _m);
      this.glow(_p.x, _p.y + 0.15, _p.z, 1, 0.82, 0.3);
    },
    /** 漂流箱（水面上下晃）；夜晚加一點暖色光暈 */
    crate(x: number, y: number, z: number, h: number, rx: number, rz: number, gold = false) {
      if (crateN >= DRIFT_MAX) return;
      _e.set(rx, h, rz); _q.setFromEuler(_e); _p.set(x, y, z);
      if (gold) _s.setScalar(1.45);
      _m.compose(_p, _q, _s); _s.set(1, 1, 1);
      crates.setColorAt(crateN, gold ? _gold : _white);
      crates.setMatrixAt(crateN++, _m);
      if (gold) this.glow(x, y + 0.7, z, 1, 0.8, 0.25); else this.glow(x, y + 0.45, z, 0.5, 0.34, 0.13);
    },
    /** 放一艘（instanced）；far＝遠模 */
    put(x: number, y: number, z: number, h: number, rx: number, rz: number, useFar: boolean) {
      _e.set(rx, h, rz); _q.setFromEuler(_e); _p.set(x, y, z); _m.compose(_p, _q, _s);
      if (useFar) far.setMatrixAt(farN++, _m); else near.setMatrixAt(nearN++, _m);
    },
    /** 船頭燈（夜晚、有人開的船）：水面光錐＋船頭光點 */
    headlight(x: number, z: number, h: number) {
      if (night < 0.05) return;
      const fx = -Math.sin(h), fz = -Math.cos(h);
      _e.set(0, h, 0); _q.setFromEuler(_e); _p.set(x + fx * 2.4, PB.waterY + 0.16, z + fz * 2.4); _s.set(3.2, 1, 9); _m.compose(_p, _q, _s); _s.set(1, 1, 1);
      if (coneN < PB.count) cones.setMatrixAt(coneN++, _m);
      this.glow(x + fx * 2.55, PB.waterY + 0.75, z + fz * 2.55, 1, 0.95, 0.8);
    },
    glow(x: number, y: number, z: number, r: number, g: number, b: number) {
      if (glowN >= N_GLOW) return;
      gPos[glowN * 3] = x; gPos[glowN * 3 + 1] = y; gPos[glowN * 3 + 2] = z;
      gCol[glowN * 3] = r * night; gCol[glowN * 3 + 1] = g * night; gCol[glowN * 3 + 2] = b * night; glowN++;
    },
    end() {
      near.count = nearN; far.count = farN; near.instanceMatrix.needsUpdate = true; far.instanceMatrix.needsUpdate = true;
      crates.count = crateN; crates.visible = crateN > 0; if (crateN) { crates.instanceMatrix.needsUpdate = true; if (crates.instanceColor) crates.instanceColor.needsUpdate = true; }
      rackFrames.count = rackN; rackFrames.visible = rackN > 0; if (rackN) rackFrames.instanceMatrix.needsUpdate = true;
      rackStrs.count = strN; rackStrs.visible = strN > 0; if (strN) rackStrs.instanceMatrix.needsUpdate = true;
      rackFlags.count = flagN; rackFlags.visible = flagN > 0; if (flagN) { rackFlags.instanceMatrix.needsUpdate = true; if (rackFlags.instanceColor) rackFlags.instanceColor.needsUpdate = true; }
      rackRipe.count = ripeN; rackRipe.visible = ripeN > 0; if (ripeN) rackRipe.instanceMatrix.needsUpdate = true;
      cones.count = night > 0.05 ? coneN : 0; cones.instanceMatrix.needsUpdate = true;
      if (night > 0.05) for (const p of ALL_LAMPS) this.glow(p.x, LAMP_H - 0.12, p.z, 1, 0.82, 0.5);
      glows.visible = night > 0.05 && glowN > 0;
      glowGeo.setDrawRange(0, glowN);
      (glowGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true; (glowGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    },
    /** 夜晚 0→1：海面月光、燈頭自發光、光池／光暈／夜光藻 */
    setNight(k: number, sky: THREE.Color) {
      night = k;
      water.setNight(k, sky);
      lampHeadMat.color.copy(lampOff).lerp(lampOn, k);
      pools.visible = k > 0.05; poolMat.opacity = 0.42 * k;
      fx.setTint(1 - 0.62 * k, 1 - 0.1 * k, 1 + 0.2 * k);
    },
    nightK: () => night,
    setFog(f: THREE.Fog) { water.setFog(f.color, f.near, f.far); },
    tick(t: number, dt: number) { water.set(t, 0); fx.tick(dt); },
    /** 自己開的那艘：完整可動模型（舷外機會轉、螺旋槳會轉） */
    makeOwnRaft(): Raft { return makeRaft(group, { trim: 0x2a5a86, crew: [] }); },
    stats() {
      let tris = 0; const per = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += per(water.inner.geometry) + (water.outer ? per(water.outer.geometry) : 0) + per(dock.geometry) + per(lampHeads.geometry);
      return { nearTris: per(nearGeo), farTris: per(far.geometry), staticTris: Math.round(tris), dockMeshes: 2, water: water.outer ? 2 : 1 };
    },
    dispose() {
      group.removeFromParent();
      group.traverse(x => { const m = x as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mm)) mm.forEach(q => q.dispose()); else mm?.dispose(); });
      glowT.dispose(); coneT.dispose();
    },
  };
}
