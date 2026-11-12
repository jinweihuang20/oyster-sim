/** 工寮遠景地標與各地點蚵寮本體（從 main.ts 拆出，行為不變） */
import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core';

export type YardSceneDeps = {
  scene: THREE.Scene;
  mesh: (g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], parent?: THREE.Object3D) => THREE.Mesh;
  mat: (c: number, o?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  locNow: () => { id: string };
  ground: THREE.Mesh;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  lamp: THREE.PointLight;
  water: THREE.Mesh;
};

let D: YardSceneDeps;
const _c2 = new THREE.Color();

export function initYardScene(deps: YardSceneDeps) {
  D = deps;
  buildLandmarks();
}

// ---------- 各漁港：遠景地標 + 不同的鄰座 ----------
export const LAND: Record<string, THREE.Group> = {};
function buildLandmarks() {
  const G = (id: string) => { const g = new THREE.Group(); g.visible = false; D.scene.add(g); LAND[id] = g; return g; };
  const B = (w: number, h: number, d: number, c: number, p: [number, number, number], g: THREE.Object3D, o: Record<string, unknown> = {}) => D.mesh(rboxEnv(w, h, d), D.mat(c, o), p, g);
  // 王功：紅白燈塔 + 防波堤
  const wg = G('wanggong');
  for (let i = 0; i < 6; i++) D.mesh(rcyl(0.55 - i * 0.05, 0.6 - i * 0.05, 1.2, 12), D.mat(i % 2 ? 0xf2f2ee : 0xc8302a), [-9, 0.1 + i * 1.2, -24], wg);
  D.mesh(rcyl(0.35, 0.35, 0.7, 10), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }), [-9, 7.6, -24], wg);
  D.mesh(new THREE.ConeGeometry(0.5, 0.6, 10), D.mat(0x2a2a2a), [-9, 8.25, -24], wg);
  B(30, 0.6, 1.2, 0x8a8a84, [3, -0.2, -21], wg);
  for (let i = 0; i < 9; i++) B(0.8, 0.8, 0.8, 0x9a9a90, [-10 + i * 2.6, 0.3, -20.3], wg);
  // 東石：蚵棚 + 漁人碼頭木棧道與風車
  const ds = G('dongshi');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) D.mesh(rcyl(0.04, 0.04, 1.4, 5), D.mat(0x8a6a3a), [-12 + c * 1.6, 0, -18 - r * 2], ds);
  for (let r = 0; r < 4; r++) B(16, 0.06, 0.08, 0x6a5030, [-4.8, 0.65, -18 - r * 2], ds);
  B(12, 0.25, 2.5, 0x9a6a3a, [8, 0.2, -23], ds);
  D.mesh(rcyl(0.15, 0.25, 5, 8), D.mat(0xf0ece0), [11, 2.5, -25], ds);
  const bl = new THREE.Group(); bl.position.set(11, 5, -24.7); ds.add(bl); for (let k = 0; k < 4; k++) { const b = B(0.25, 2.4, 0.05, 0xe8e0d0, [0, 1.2, 0], new THREE.Group()); const h = b.parent!; h.rotation.z = k * Math.PI / 2; bl.add(h); }
  // 布袋：鹽田方格 + 白鹽山 + 濕地蘆葦
  const bd = G('budai');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) B(3, 0.05, 2, (r + c) % 2 ? 0xc8d8e0 : 0xb0c8d4, [-12 + c * 3.4, -0.35, -17 - r * 2.4], bd, { roughness: 0.2, metalness: 0.2 });
  for (let i = 0; i < 4; i++) D.mesh(new THREE.ConeGeometry(1.2 + i * 0.2, 1.6 + i * 0.3, 10), D.mat(0xfafafa), [7 + i * 2.6, 0.5, -22 - (i % 2) * 2], bd);
  for (let i = 0; i < 40; i++) D.mesh(rcyl(0.02, 0.03, 1.2, 4), D.mat(0x8a9a4a), [-14 + Math.random() * 28, 0.2, -26 - Math.random() * 3], bd);
  // 自家：竹竿曬衣 + 小漁船
  const hm = G('home');
  B(3, 0.5, 1.2, 0x2a6aa0, [6, -0.25, -22], hm); B(1, 0.8, 0.8, 0xf0f0e8, [6.5, 0.4, -22], hm);
}
// ---------- 各地點的蚵寮本體（裝飾用，不影響座位／碗／蚵殼山／射線目標） ----------
type ShedStyle = { ground: number; hemi: number; hemiK: number; sun: number; sunK: number; lamp: number; lampK: number; fog: number; fogNear: number; fogFar: number };
const SHED_STYLE: Record<string, ShedStyle> = {
  home: { ground: 0xd8d2c4, hemi: 0xfff2e4, hemiK: 1.08, sun: 0xffe8c4, sunK: 1.18, lamp: 0xffe8c8, lampK: 12, fog: 0xd0e0d8, fogNear: 18, fogFar: 52 },
  wanggong: { ground: 0xd8d4ca, hemi: 0xfff4ea, hemiK: 1.12, sun: 0xfff0d8, sunK: 1.22, lamp: 0xffeedc, lampK: 11, fog: 0xc8dce8, fogNear: 16, fogFar: 52 },
  dongshi: { ground: 0xdcc8a8, hemi: 0xfff0e0, hemiK: 1.08, sun: 0xffe0b0, sunK: 1.18, lamp: 0xffe4bc, lampK: 12, fog: 0xe0c8a8, fogNear: 15, fogFar: 48 },
  budai: { ground: 0xd0d6d8, hemi: 0xfff4ec, hemiK: 1.15, sun: 0xfff2e0, sunK: 0.9, lamp: 0xfff0e0, lampK: 18, fog: 0xc0d0d8, fogNear: 15, fogFar: 46 },
};
let shedG: THREE.Group | null = null, shedId = '';
export function getShedG() { return shedG; }
export const shedAnim: ((t: number) => void)[] = [];
export function disposeShed() {
  if (!shedG) return;
  shedG.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as THREE.Material | THREE.Material[] | undefined; if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose()); });
  shedG.removeFromParent(); shedG = null; shedAnim.length = 0;
}
export function buildShed(id: string) {
  disposeShed(); shedId = id; const g = new THREE.Group(); D.scene.add(g); shedG = g;
  const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => D.mat(c, o);
  const B = (w: number, h: number, d: number, m: THREE.Material, p: [number, number, number], ry = 0) => { const x = D.mesh(rboxEnv(w, h, d), m, p, g); x.rotation.y = ry; return x; };
  const C = (rt: number, rb: number, h: number, m: THREE.Material, p: [number, number, number], seg = 8) => D.mesh(rcyl(rt, rb, h, seg), m, p, g);
  const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  const flat = (w: number, d: number, m: THREE.Material, p: [number, number, number]) => {
    const x = D.mesh(new THREE.PlaneGeometry(w, d), m, p, g);
    x.rotation.x = -Math.PI / 2; x.castShadow = false; x.receiveShadow = false;
    x.renderOrder = 1;
    const mm = x.material as THREE.Material;
    mm.depthWrite = false;
    mm.polygonOffset = true; mm.polygonOffsetFactor = -2; mm.polygonOffsetUnits = -2;
    return x;
  };
  if (id === 'wanggong') {
    // 藍白條紋帆布棚（四角鋼管 + 斜面帆布）
    const pipe = M(0xb8bcc0, { metalness: 0.6, roughness: 0.4 });
    for (const x of [-3.5, 3.5]) for (const z of [-3.5, 3.5]) C(0.04, 0.04, 2.9, pipe, [x, 1.45, z], 6);
    const blue = M(0x2a64b8, { side: THREE.DoubleSide }), white = M(0xf2f4f6, { side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) { const s = B(0.72, 0.02, 7.6, i % 2 ? white : blue, [-3.24 + i * 0.72, 3.0 - Math.abs(i - 4.5) * 0.05, 0]); s.rotation.z = (i < 5 ? 1 : -1) * 0.07; }
    for (let i = 0; i < 10; i++) B(0.72, 0.25, 0.02, i % 2 ? white : blue, [-3.24 + i * 0.72, 2.75, 3.8]); // 前緣垂邊
    // 木棧板
    const wood = M(0xa88458), woodD = M(0x7a5a38);
    for (const [px, pz] of [[-2.6, -2.9], [2.7, -2.7], [2.9, 2.6], [-2.8, 2.7]]) { for (let k = 0; k < 5; k++) B(1.0, 0.03, 0.14, wood, [px, 0.12, pz - 0.4 + k * 0.2]); for (const k of [-0.42, 0, 0.42]) B(0.1, 0.1, 1.0, woodD, [px + k, 0.05, pz]); }
    // 疊保麗龍箱
    const sty = M(0xf8f8f4, { roughness: 1 });
    for (let i = 0; i < 9; i++) B(0.6, 0.32, 0.42, sty, [-3.1 + (i % 3) * 0.62, 0.3 + Math.floor(i / 3) * 0.33, -3.0]);
    for (let i = 0; i < 4; i++) B(0.6, 0.32, 0.42, sty, [3.45, 0.3 + i * 0.33, -1.2], 1.57);
    // 漁網 + 浮球掛在後方
    const netM = M(0x2a8a6a, { wireframe: true, side: THREE.DoubleSide });
    const nt = D.mesh(new THREE.PlaneGeometry(4.5, 1.6, 18, 7), netM, [-0.6, 2.0, -3.55], g); nt.castShadow = false;
    const buoyC = [0xf06a1a, 0xf0d030, 0xf06a1a, 0xe8e8e8, 0xf06a1a];
    for (let i = 0; i < 5; i++) D.mesh(new THREE.SphereGeometry(0.13, 10, 8), M(buoyC[i], { roughness: 0.4 }), [-2.6 + i * 1.0, 1.25 + (i % 2) * 0.12, -3.5], g);
    for (let i = 0; i < 3; i++) D.mesh(new THREE.SphereGeometry(0.16, 10, 8), M(0x6ab0e0, { transparent: true, opacity: 0.7, roughness: 0.1 }), [3.55, 2.3 - i * 0.35, 1.0 + i * 0.3], g); // 玻璃浮球
    // 盤起來的索仔
    const rope = M(0xd8b070);
    for (let k = 0; k < 4; k++) D.mesh(new THREE.TorusGeometry(0.34 - k * 0.04, 0.035, 5, 14), rope, [-3.0, 0.04 + k * 0.06, -1.6], g).rotation.x = Math.PI / 2;
    // 冰桶
    B(0.7, 0.45, 0.45, M(0x2a8ad0), [3.0, 0.23, 0.4], 0.3); B(0.72, 0.08, 0.47, M(0xf2f2f2), [3.0, 0.49, 0.4], 0.3);
  } else if (id === 'dongshi') {
    // 觀光木棧道地板
    const plankA = M(0xa06e40), plankB = M(0x8a5c34);
    for (let i = 0; i < 26; i++) { const p = B(13, 0.04, 0.48, i % 2 ? plankA : plankB, [0, 0.03, -6.3 + i * 0.5]); p.castShadow = false; p.receiveShadow = true; }
    // 竹蚵棚框 + 垂吊蚵串
    const bam = M(0xb8a060), oy = M(0x7a7a72, { roughness: 1 });
    for (const x of [-3.6, 3.6]) { for (const z of [-3.4, -1.2, 1.0, 3.2]) C(0.045, 0.05, 2.7, bam, [x, 1.35, z], 6); const r = C(0.04, 0.04, 7.0, bam, [x, 2.55, -0.1], 6); r.rotation.x = Math.PI / 2; }
    for (const z of [-3.4, 3.2]) { const r = C(0.04, 0.04, 7.2, bam, [0, 2.6, z], 6); r.rotation.z = Math.PI / 2; }
    for (const x of [-3.6, 3.6]) for (let k = 0; k < 9; k++) { const z = -3.1 + k * 0.75; C(0.006, 0.006, 1.1, M(0x5a4a3a), [x, 2.0, z], 3); for (let j = 0; j < 4; j++) D.mesh(new THREE.DodecahedronGeometry(0.06, 0), oy, [x, 1.6 + j * 0.22, z], g); }
    for (let k = 0; k < 7; k++) { const x = -2.7 + k * 0.9; C(0.006, 0.006, 0.9, M(0x5a4a3a), [x, 2.15, -3.4], 3); for (let j = 0; j < 3; j++) D.mesh(new THREE.DodecahedronGeometry(0.06, 0), oy, [x, 1.85 + j * 0.2, -3.4], g); }
    // 節慶燈串（垂墜弧線，彩色燈泡會閃）
    const cols = [0xff4a3a, 0xffd040, 0x40d0ff, 0x60ff80, 0xff80d0];
    const bulbs: THREE.MeshBasicMaterial[] = [];
    for (const [z0, z1] of [[-3.4, 3.2]] as const) for (const x of [-2.4, 0, 2.4]) for (let i = 0; i <= 12; i++) { const f = i / 12, z = z0 + (z1 - z0) * f, y = 2.75 - Math.sin(f * Math.PI) * 0.35; const m = glow(cols[(i + Math.round(x)) % 5]); bulbs.push(m); D.mesh(new THREE.SphereGeometry(0.045, 6, 5), m, [x, y, z], g).castShadow = false; }
    shedAnim.push(t => bulbs.forEach((m, i) => m.color.setHex(cols[(i + Math.floor(t * 2)) % 5])));
    // 招牌
    const sign = B(1.6, 0.6, 0.06, M(0xc83a2a), [2.2, 2.05, -3.5]); void sign;
    B(1.45, 0.45, 0.02, M(0xf4e4c0), [2.2, 2.05, -3.46]);
    for (let k = 0; k < 4; k++) B(0.22, 0.25, 0.01, M(0x2a2a2a), [1.75 + k * 0.3, 2.05, -3.44]);
    for (const x of [1.6, 2.8]) C(0.03, 0.03, 2.0, M(0x6a4a2a), [x, 1.0, -3.55], 6);
    // 海灘陽傘
    const umb = (x: number, z: number, a: number, b: number) => { C(0.025, 0.025, 2.3, M(0xeeeeee), [x, 1.15, z], 6); for (let k = 0; k < 8; k++) { const c = D.mesh(new THREE.ConeGeometry(0.95, 0.35, 8, 1, true, k * Math.PI / 4, Math.PI / 4), M(k % 2 ? a : b, { side: THREE.DoubleSide }), [x, 2.4, z], g); c.castShadow = false; } };
    umb(-3.0, -2.6, 0xf0f0f0, 0xe04a3a); umb(3.0, 2.4, 0xf0f0f0, 0x2a8ad0);
    // 木欄杆
    for (let i = 0; i < 14; i++) C(0.04, 0.04, 0.8, plankB, [-6 + i * 0.95, 0.4, -4.2], 6);
    { const r = C(0.035, 0.035, 13, plankA, [0.2, 0.8, -4.2], 6); r.rotation.z = Math.PI / 2; }
  } else if (id === 'budai') {
    // 工廠內：牆、高鋼桁架屋頂、後方大鐵捲門開口
    const wall = M(0xb8c0c4, { side: THREE.DoubleSide, metalness: 0.3 }), steel = M(0x5a6a74, { metalness: 0.6, roughness: 0.45 });
    for (const x of [-6, 6]) B(0.1, 5.5, 12, wall, [x, 2.75, 0]);
    B(4.2, 5.5, 0.1, wall, [-3.9, 2.75, -5]); B(4.2, 5.5, 0.1, wall, [3.9, 2.75, -5]); B(3.6, 2.3, 0.1, wall, [0, 4.35, -5]);
    B(3.6, 0.15, 0.2, M(0xe0b020), [0, 3.15, -4.95]); // 鐵捲門框
    for (let z = -4; z <= 4; z += 2) { B(12, 0.12, 0.12, steel, [0, 4.6, z]); for (let k = -5; k <= 5; k++) { const d = B(0.06, 0.9, 0.06, steel, [k * 1.1, 5.0, z]); d.rotation.z = k % 2 ? 0.5 : -0.5; } B(12, 0.1, 0.1, steel, [0, 5.4, z]); }
    for (const x of [-5.8, 5.8]) for (let z = -4; z <= 4; z += 2) B(0.18, 5.4, 0.18, steel, [x, 2.7, z]);
    C(0.06, 0.06, 4.6, steel, [3.5, 2.3, -3.5], 6); // 掛時鐘的柱
    B(12, 0.08, 9.2, M(0x8a949a, { metalness: 0.5, side: THREE.DoubleSide }), [0, 5.7, -0.4]);
    // 日光燈管（冷白）
    const tube = glow(0xf4fbff);
    for (const x of [-2.4, 0, 2.4]) for (const z of [-3, 0, 3]) { const t = C(0.03, 0.03, 1.5, tube, [x, 3.4, z], 6); t.rotation.z = Math.PI / 2; t.castShadow = false; B(1.6, 0.04, 0.12, M(0xdddddd), [x, 3.45, z]); C(0.005, 0.005, 1.2, M(0x222222), [x, 4.05, z], 3); }
    // 不鏽鋼長桌
    const ss = M(0xd4dade, { metalness: 0.85, roughness: 0.25 });
    for (const x of [-4.4, 4.4]) { B(1.0, 0.05, 6.5, ss, [x, 0.85, 0]); for (const z of [-3, 0, 3]) for (const dx of [-0.42, 0.42]) C(0.025, 0.025, 0.85, ss, [x + dx, 0.42, z], 6); }
    // 輸送帶（皮帶會動）
    const beltM = M(0x2a2c2e, { roughness: 0.7 });
    B(4.0, 0.08, 0.7, beltM, [0, 0.72, -4.2]); B(4.1, 0.14, 0.08, ss, [0, 0.74, -3.84]); B(4.1, 0.14, 0.08, ss, [0, 0.74, -4.56]);
    for (const x of [-1.9, 0, 1.9]) for (const z of [-3.9, -4.5]) C(0.03, 0.03, 0.7, ss, [x, 0.35, z], 6);
    const ridges: THREE.Mesh[] = []; for (let k = 0; k < 10; k++) ridges.push(B(0.04, 0.02, 0.66, M(0x4a4c4e), [-1.9 + k * 0.4, 0.77, -4.2]));
    const beltOy: THREE.Mesh[] = []; for (let k = 0; k < 6; k++) beltOy.push(D.mesh(new THREE.DodecahedronGeometry(0.07, 0), M(0x8a8a86), [-1.8 + k * 0.7, 0.82, -4.2], g));
    shedAnim.push(t => { ridges.forEach((r, k) => r.position.x = -1.9 + ((k * 0.4 + t * 0.3) % 4)); beltOy.forEach((r, k) => r.position.x = -1.9 + ((k * 0.7 + t * 0.3) % 3.9)); });
    // 黃色安全線
    const yel = M(0xf0c020, { roughness: 0.6 });
    for (const x of [-3.4, 3.4]) flat(0.12, 9, yel, [x, 0.03, 0]);
    flat(6.8, 0.12, yel, [0, 0.03, -3.5]); flat(6.8, 0.12, yel, [0, 0.03, 3.6]);
    for (let k = 0; k < 6; k++) { const s = flat(0.12, 0.6, k % 2 ? M(0x222222) : yel, [-1.5 + k * 0.6, 0.03, -4.9]); s.rotation.z = 0.6; }
    // 大蚵殼山 + 麻袋
    for (const [x, z, r] of [[-4.6, -4.0, 0.9], [4.7, -3.8, 1.0]] as const) D.mesh(new THREE.ConeGeometry(r, r * 1.1, 9), M(0x8a909a, { roughness: 1 }), [x, r * 0.55, z], g);
    const sack = M(0xc8b088, { roughness: 1 });
    for (let i = 0; i < 6; i++) { const s = D.mesh(new THREE.SphereGeometry(0.3, 8, 6), sack, [-5.3 + (i % 3) * 0.55, 0.25 + Math.floor(i / 3) * 0.4, 2.8], g); s.scale.set(1, 0.75, 0.8); }
    // 壁扇（扇葉會轉）
    for (const z of [-2, 2]) { const fg = new THREE.Group(); fg.position.set(5.85, 3.2, z); fg.rotation.y = -Math.PI / 2; g.add(fg); D.mesh(new THREE.TorusGeometry(0.35, 0.02, 4, 16), M(0xdddddd), [0, 0, 0.05], fg); const bl = new THREE.Group(); fg.add(bl); for (let k = 0; k < 3; k++) { const b = D.mesh(rboxEnv(0.1, 0.32, 0.01), M(0x8ac0e0), [0, 0.16, 0.05], new THREE.Group()); const h = b.parent!; h.rotation.z = k * 2.094; bl.add(h); } shedAnim.push(t => bl.rotation.z = t * 12); }
  } else {
    // 自家：鏽鐵皮厝頂 + 木柱
    const rust = [0x8a5a3a, 0x9a6a48, 0x7a6a5e];
    for (let i = 0; i < 12; i++) { const r = B(0.62, 0.03, 8, M(rust[i % 3], { side: THREE.DoubleSide, metalness: 0.35, roughness: 0.9 }), [-3.4 + i * 0.62, 3.05 + (i % 2) * 0.03, 0]); r.rotation.z = 0.06; }
    const wood = M(0x5a4a3a);
    for (const x of [-3.5, 3.5]) for (const z of [-3.5, 0, 3.5]) C(0.07, 0.07, 3.1, wood, [x, 1.55, z], 6);
    for (const z of [-3.5, 3.5]) B(7.2, 0.1, 0.1, wood, [0, 3.0, z]);
    // 水泥地水漬（抬高＋polygonOffset，避免貼地轉視角深度閃爍）
    const stain = M(0x4e4c48, { roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false });
    stain.polygonOffset = true; stain.polygonOffsetFactor = -2; stain.polygonOffsetUnits = -2;
    for (const [x, z, s] of [[-2.4, 0.6, 0.7], [2.2, -1.6, 0.9], [1.5, 2.9, 0.5], [-1.2, -2.6, 0.6]] as const) {
      const d = D.mesh(new THREE.CircleGeometry(s, 12), stain, [x, 0.03, z], g);
      d.rotation.x = -Math.PI / 2; d.scale.y = 0.6; d.castShadow = false; d.receiveShadow = false; d.renderOrder = 1;
    }
    // 吊著的裸燈泡
    for (const [x, z] of [[0, 0], [-2.2, -1.5], [2.2, 1.2]]) { D.mesh(new THREE.SphereGeometry(0.07, 10, 8), glow(0xffd9a0), [x, 2.55, z], g).castShadow = false; C(0.006, 0.006, 0.45, M(0x111111), [x, 2.8, z], 4); }
    // 紅色塑膠椅
    const red = M(0xd04040, { roughness: 0.5 });
    for (const [x, z] of [[3.0, 0.5], [-3.0, 0.2], [-2.6, -0.5]]) C(0.17, 0.15, 0.3, red, [x, 0.15, z]);
    // 藍色塑膠籃
    const bl = M(0x2a6ad0, { roughness: 0.5 });
    for (const [x, z, y] of [[-3.0, -2.9, 0.15], [-2.4, -2.9, 0.15], [-2.7, -2.9, 0.45], [2.9, -2.6, 0.15]] as const) { B(0.55, 0.3, 0.4, bl, [x, y, z]); }
    // 水桶、網仔、索仔
    for (const [x, z, c] of [[3.1, -1.9, 0xd07a2a], [-2.9, 2.6, 0x3a8a4a]] as const) C(0.2, 0.16, 0.4, M(c), [x, 0.2, z], 10);
    const net = D.mesh(new THREE.SphereGeometry(0.7, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2a7a6a, { wireframe: true }), [2.6, 0, 2.6], g); net.scale.y = 0.4;
    D.mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12), M(0xd8b070), [-3.0, 0.05, -1.8], g).rotation.x = Math.PI / 2;
    // 盆栽
    C(0.2, 0.15, 0.3, M(0xa0522d), [3.3, 0.15, 3.1]); for (let k = 0; k < 5; k++) { const l = D.mesh(new THREE.ConeGeometry(0.1, 0.55, 5), M(0x3a8a3a), [3.3 + Math.cos(k * 1.26) * 0.08, 0.5, 3.1 + Math.sin(k * 1.26) * 0.08], g); l.rotation.set(Math.sin(k * 1.26) * 0.4, 0, -Math.cos(k * 1.26) * 0.4); }
    // 側邊停的機車
    const sc = new THREE.Group(); sc.position.set(4.6, 0, -0.8); sc.rotation.y = 0.15; g.add(sc);
    const tire = M(0x1a1a1a);
    for (const z of [-0.55, 0.55]) D.mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 12), tire, [0, 0.27, z], sc).rotation.y = Math.PI / 2;
    D.mesh(rboxEnv(0.34, 0.35, 0.9), M(0xe8e4d8, { roughness: 0.4 }), [0, 0.48, 0.05], sc);
    D.mesh(rboxEnv(0.3, 0.1, 0.55), M(0x2a2a2a), [0, 0.7, 0.2], sc);
    D.mesh(rboxEnv(0.3, 0.7, 0.15), M(0xc83a3a, { roughness: 0.4 }), [0, 0.75, -0.5], sc);
    D.mesh(rcyl(0.02, 0.02, 0.6, 5), M(0x888888), [0, 1.15, -0.55], sc).rotation.x = Math.PI / 2 - 0.1;
    D.mesh(rcyl(0.015, 0.015, 0.6, 5), M(0x333333), [0, 1.15, -0.55], sc).rotation.z = Math.PI / 2;
  }
}
export function applyShedLook() {
  const id = D.locNow().id; if (id !== shedId) buildShed(id);
  const s = SHED_STYLE[id] ?? SHED_STYLE.home;
  (D.ground.material as THREE.MeshStandardMaterial).color.setHex(s.ground);
  D.hemi.color.lerp(_c2.setHex(s.hemi), 0.5); D.hemi.intensity *= s.hemiK;
  D.sun.color.setHex(s.sun); D.sun.intensity *= s.sunK;
  D.lamp.color.setHex(s.lamp); D.lamp.intensity = s.lampK;
  const f = D.scene.fog as THREE.Fog; f.color.lerp(_c2.setHex(s.fog), 0.45); f.near = s.fogNear; f.far = s.fogFar;
}

export const WATER_C: Record<string, number> = { home: 0x3a90b8, wanggong: 0x2a7ab0, dongshi: 0x4a8898, budai: 0x4a9aaa };
type Crew = { name: string; hair: number; look: 'ama' | 'agong' | 'dajie' | 'fisher' | 'ama2'; pal: number[] };
const CREW: Record<string, Crew[]> = {
  home: [{ name: '快手阿桃', hair: 0x999999, look: 'ama', pal: [] }, { name: '講話阿春', hair: 0x333333, look: 'ama', pal: [] }, { name: '好奇阿嬌', hair: 0xcccccc, look: 'ama', pal: [] }],
  wanggong: [{ name: '漁夫阿伯', hair: 0x555555, look: 'fisher', pal: [0x2a4a7a, 0x3a6a9a, 0xe8e0c8] }, { name: '燈塔阿公', hair: 0xdddddd, look: 'agong', pal: [0xe8e8e0, 0x6a7a8a, 0x8a5a3a] }, { name: '海口阿嬤', hair: 0xaaaaaa, look: 'ama2', pal: [0x4a6a9a, 0xc8d8e8, 0x2a5a7a] }],
  dongshi: [{ name: '碼頭大姐', hair: 0x2a1a10, look: 'dajie', pal: [0xe07a4a, 0xf0c050, 0xd04a6a] }, { name: '蚵棚阿伯', hair: 0x444444, look: 'fisher', pal: [0x6a5a3a, 0x8a7a4a, 0x4a4a3a] }, { name: '愛聊阿嬤', hair: 0xbbbbbb, look: 'ama2', pal: [0xc06a8a, 0xe0a0b0, 0x8a4a6a] }],
  budai: [{ name: '鹽田阿公', hair: 0xeeeeee, look: 'agong', pal: [0xf0f0f0, 0xc8c8c0, 0x6a6a5a] }, { name: '大廠組長大姐', hair: 0x1a1a1a, look: 'dajie', pal: [0x3a7a5a, 0x2a5a4a, 0xe8e8d8] }, { name: '老師傅阿伯', hair: 0x666666, look: 'fisher', pal: [0x4a4a5a, 0x5a5a6a, 0x7a6a4a] }],
};
const crewHats: THREE.Object3D[] = [];
export function showLand() {
  const id = D.locNow().id;
  for (const k in LAND) LAND[k].visible = k === id;
  const wm = D.water.material as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  wm.color.setHex(WATER_C[id] ?? 0x3a4a6a);
}
