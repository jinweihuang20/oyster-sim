/**
 * 雜貨店「釣具」商品的 3D 模型：餌（蝦仔、沙蟲、魷魚條、蚵仔肉）和 8 種路亞假魚。
 * 參考實物照片做低面數造型：一個商品＝一個 BufferGeometry（頂點色、平面著色、一次 draw call），
 * 頭朝 +x、上方 +y，建好後置中、最長邊縮成 1，縮圖鏡頭直接看 +z 側面。
 * 只用 three，不碰 DOM，可以直接在 vitest 裡建。
 */
import * as THREE from 'three';
import type { BaitKey, LureKey } from '../plaza/boats/fishLogic';

export type TackleKey = BaitKey | LureKey;
export const TACKLE_KEYS: readonly TackleKey[] = ['oyster', 'shrimp', 'worm', 'squid', 'minnow', 'jig', 'soft', 'popper', 'stickbait', 'trollskirt', 'slowjig', 'egi'];

type V = [number, number, number];

class Tris {
  pos: number[] = []; col: number[] = [];
  private c = new THREE.Color();
  tri(a: V, b: V, c: V, hex: number) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.c.setHex(hex);
    for (let i = 0; i < 3; i++) this.col.push(this.c.r, this.c.g, this.c.b);
  }
  quad(a: V, b: V, c: V, d: V, hex: number) { this.tri(a, b, c, hex); this.tri(a, c, d, hex); }
  /** 凸多邊形（扇形三角化） */
  poly(p: V[], hex: number) { for (let i = 1; i < p.length - 1; i++) this.tri(p[0], p[i], p[i + 1], hex); }
}

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const hash = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

type Paint = (t: number, vm: number, i: number, j: number) => number;
/**
 * 沿著折線拉一條管子：rad(t)＝[上下半徑, 左右半徑]；上下方向用 up 投影後平行傳遞（彎曲的鉤子、蟲身也不會扭）。
 * paint 的 vm＝這一格在圈上的高度（+1 最上、-1 最下）。
 */
function tube(T: Tris, pts: V[], rad: (t: number) => [number, number], M: number, paint: Paint | number, caps = true, up: V = [0, 1, 0]) {
  const n = pts.length; if (n < 2) return;
  const P = typeof paint === 'number' ? (() => paint) as Paint : paint;
  const tan: V[] = pts.map((_, i) => norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let N = sub(up, [tan[0][0] * dot(up, tan[0]), tan[0][1] * dot(up, tan[0]), tan[0][2] * dot(up, tan[0])]);
  if (Math.hypot(N[0], N[1], N[2]) < 1e-4) N = cross(tan[0], [0, 0, 1]);
  N = norm(N);
  const rings: V[][] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) { const t = tan[i]; N = norm(sub(N, [t[0] * dot(N, t), t[1] * dot(N, t), t[2] * dot(N, t)])); }
    const B = norm(cross(tan[i], N));
    const [h, w] = rad(i / (n - 1));
    const r: V[] = [];
    for (let j = 0; j < M; j++) { const a = (j / M) * Math.PI * 2; r.push(add(add(pts[i], N, h * Math.sin(a)), B, w * Math.cos(a))); }
    rings.push(r);
  }
  for (let i = 1; i < n; i++) for (let j = 0; j < M; j++) {
    const j2 = (j + 1) % M, vm = Math.sin(((j + 0.5) / M) * Math.PI * 2);
    T.quad(rings[i - 1][j], rings[i][j], rings[i][j2], rings[i - 1][j2], P((i - 0.5) / (n - 1), vm, i, j));
  }
  if (caps) for (const [i, c] of [[0, pts[0]], [n - 1, pts[n - 1]]] as [number, V][]) {
    const [h, w] = rad(i / (n - 1)); if (h < 1e-5 && w < 1e-5) continue;
    for (let j = 0; j < M; j++) { const vm = Math.sin(((j + 0.5) / M) * Math.PI * 2); T.tri(c, rings[i][j], rings[i][(j + 1) % M], P(i / (n - 1), vm, i, j)); }
  }
}
/** 直線身體：x 從 x0（尾）到 x1（頭），中線高度 yc(t)（t＝0 頭、1 尾） */
function body(T: Tris, x1: number, x0: number, N: number, M: number, rad: (t: number) => [number, number], paint: Paint, yc: (t: number) => number = () => 0) {
  const pts: V[] = []; for (let i = 0; i <= N; i++) { const t = i / N; pts.push([x1 + (x0 - x1) * t, yc(t), 0]); }
  tube(T, pts, rad, M, paint);
}
const lerpProf = (p: number[][], t: number) => {
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (t <= b[0] || i === p.length - 2) { const k = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0] || 1))); const e = k * k * (3 - 2 * k); return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e] as [number, number]; }
  }
  return [0, 0] as [number, number];
};
/** 球（眼睛、鉛頭） */
function ball(T: Tris, c: V, r: number, hex: number | Paint, seg = 6) {
  const pts: V[] = []; for (let i = 0; i <= seg; i++) pts.push([c[0] + r * Math.cos(Math.PI * (1 - i / seg)), c[1], c[2]]);
  tube(T, pts, t => { const s = Math.sin(Math.PI * t); return [r * s, r * s]; }, seg + 2, hex, false);
}
/** 眼睛：兩側各一顆（外圈＋瞳孔） */
function eyes(T: Tris, x: number, y: number, z: number, r: number, iris = 0xf2d24a) {
  for (const s of [1, -1]) { ball(T, [x, y, z * s], r, iris, 6); ball(T, [x + r * 0.15, y, (z + r * 0.75) * s], r * 0.55, 0x101418, 5); }
}
/** 局部座標點 (u,v,w) → 世界：o＋u·U＋v·Vv＋w·W */
const at = (o: V, U: V, Vv: V, W: V) => (u: number, v: number, w = 0): V => [o[0] + U[0] * u + Vv[0] * v + W[0] * w, o[1] + U[1] * u + Vv[1] * v + W[1] * w, o[2] + U[2] * u + Vv[2] * v + W[2] * w];
const STEEL = 0x8b939c, STEEL_D = 0x5f6770, GOLD = 0xc9a23a;
/** 單鉤：從 top 往 down 方向是鉤柄，鉤彎往 side 方向開口，尖端朝回 up */
function hook(T: Tris, top: V, down: V, side: V, L: number, r: number, hex = STEEL) {
  const D = norm(down), S = norm(side), W = norm(cross(D, S)), f = at(top, D, S, W);
  const g = L * 0.32, pts: V[] = [f(-L * 0.06, 0)];
  for (let i = 0; i <= 3; i++) pts.push(f((L - g) * (i / 3), 0));
  for (let i = 1; i <= 7; i++) { const a = Math.PI * (i / 7); pts.push(f(L - g + Math.sin(a) * g, g - Math.cos(a) * g)); }
  pts.push(f(L - g - g * 0.9, g * 2.05), f(L - g - g * 1.35, g * 2.1));
  tube(T, pts, t => { const k = t > 0.88 ? (1 - t) / 0.12 : 1; return [r * Math.max(0.2, k), r * Math.max(0.2, k)]; }, 5, hex, true, W);
  // 倒鉤
  const tip = pts[pts.length - 1];
  T.tri(tip, f(L - g - g * 1.0, g * 1.6), f(L - g - g * 1.05, g * 1.9, r), hex);
  // 鉤眼
  ring(T, f(-L * 0.06 - r * 2, 0), W, r * 2, r * 0.7, hex);
}
/** 小圓環（鉤眼、開口環） */
function ring(T: Tris, c: V, axis: V, R: number, r: number, hex: number) {
  const A = norm(axis), up: V = Math.abs(A[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const U = norm(cross(A, up)), Vv = cross(A, U), pts: V[] = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push(add(add(c, U, Math.cos(a) * R), Vv, Math.sin(a) * R)); }
  tube(T, pts, () => [r, r], 4, hex, false, A);
}
/** 三本鉤：鉤柄往 -y 掛在 top，三支鉤繞柄 120° */
function treble(T: Tris, top: V, L: number, r: number, rot = 0.4, hex = STEEL) {
  ring(T, add(top, [0, r * 1.5, 0]), [0, 0, 1], r * 2.6, r * 0.7, STEEL_D);
  for (let k = 0; k < 3; k++) { const a = rot + (k / 3) * Math.PI * 2; hook(T, top, [0, -1, 0], [Math.cos(a), 0, Math.sin(a)], L, r, hex); }
}
/** 線（輔助鉤的 PE 繩、子線） */
function line(T: Tris, pts: V[], r: number, hex: number) { tube(T, pts, () => [r, r], 4, hex, false); }

/** 魚形假魚的漆：背色、側面、腹色＋細鱗反光 */
const fishPaint = (back: number, side: number, belly: number, flash = side, cut = 0.35): Paint => (t, vm, i, j) =>
  vm > cut ? back : vm > -0.45 ? (hash(i, j) > 0.8 ? flash : side) : belly;

function buildOyster(T: Tris) {
  // 去殼蚵仔肉：灰白肉身、深色外膜一圈
  body(T, 0.5, -0.5, 14, 14, t => { const s = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.6; return [0.2 * s, 0.32 * s]; },
    (t, vm, i, j) => (Math.abs(vm) < 0.3 ? (hash(i, j) > 0.75 ? 0x55504a : 0x47433f) : vm > 0 ? (hash(i, j) > 0.85 ? 0xd9d2c4 : 0xcfc7b8) : 0xbcb2a1), t => 0.05 * Math.sin(t * 6));
}
function buildShrimp(T: Tris) {
  // 白蝦：身體往下彎、一節一節，尾扇、長觸鬚、細腳
  const pts: V[] = []; const N = 16;
  for (let i = 0; i <= N; i++) { const t = i / N, a = -0.25 + t * 2.3; pts.push([0.42 - Math.sin(a) * 0.3 - t * 0.25, 0.15 * Math.cos(a) - 0.05, 0]); }
  const R = (t: number) => { const h = 0.1 * (1 - t * 0.62) * Math.min(1, (t + 0.08) / 0.12); return [h, h * 0.78] as [number, number]; };
  tube(T, pts, R, 12, (t, vm, i) => (vm > 0.6 ? 0xc77962 : (i % 2 ? (vm > -0.2 ? 0xe9a68c : 0xf3c9b4) : (vm > -0.2 ? 0xdd8f74 : 0xeab49f))), true, [0, 1, 0]);
  const head = pts[0], tail = pts[N];
  // 頭角
  T.tri(add(head, [0.02, 0.06, 0]), add(head, [0.22, 0.09, 0]), add(head, [0.02, 0.0, 0]), 0xc9705a);
  eyes(T, head[0] + 0.01, head[1] + 0.04, 0.05, 0.018, 0x1a1a1a);
  // 觸鬚
  for (const s of [1, -1]) {
    const a: V[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; a.push([head[0] + 0.04 + t * 0.52, head[1] + 0.03 + Math.sin(t * 2.4) * 0.16 - t * 0.1, s * (0.03 + t * 0.12)]); }
    line(T, a, 0.005, 0xc76a52);
  }
  // 腳
  for (let k = 0; k < 7; k++) {
    const p = pts[2 + k]; for (const s of [1, -1]) line(T, [add(p, [0, -0.05, s * 0.03]), add(p, [0.04, -0.15, s * 0.07]), add(p, [0.08, -0.2, s * 0.07])], 0.006, 0xe59a80);
  }
  // 尾扇
  const d = norm(sub(pts[N], pts[N - 1]));
  for (const s of [-1, 0, 1]) T.poly([add(tail, [0, 0.01, s * 0.03]), add(add(tail, d, 0.15), [s * 0.02, 0.05, s * 0.07]), add(add(tail, d, 0.2), [0, 0, s * 0.03]), add(add(tail, d, 0.15), [-s * 0.02, -0.05, s * 0.07])], s ? 0xd9785e : 0xc8604a);
}
function buildWorm(T: Tris) {
  // 沙蟲：紅褐色、一環一環的長蟲，扭成 S 形，兩側小疣足
  const pts: V[] = []; const N = 40;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([0.5 - t, 0.13 * Math.sin(t * Math.PI * 2.2 + 0.4), 0.06 * Math.cos(t * Math.PI * 1.6)]); }
  const R = (t: number) => { const h = 0.042 * Math.min(1, (t + 0.03) / 0.08) * (1 - 0.6 * t * t); return [h, h * 1.05] as [number, number]; };
  tube(T, pts, R, 10, (t, vm, i, j) => i % 2 ? (vm > 0.3 ? 0x96473a : vm > -0.5 ? 0xb15e49 : 0xd08668) : (vm > 0.3 ? 0x8a4334 : vm > -0.5 ? 0xa55843 : 0xc47c60), true);
  // 疣足
  for (let i = 3; i < N - 2; i += 2) {
    const p = pts[i], tg = norm(sub(pts[i + 1], pts[i - 1])), sd = norm(cross(tg, [0, 1, 0])), w = R(i / N)[0];
    for (const s of [1, -1]) T.tri(add(p, sd, s * w * 0.6), add(add(p, sd, s * (w + 0.03)), tg, -0.012), add(p, tg, 0.02), 0xc47458);
  }
  // 頭和顎
  const h = pts[0]; T.tri(add(h, [0.01, 0.01, 0.012]), add(h, [0.06, 0.02, 0.02]), add(h, [0.02, -0.01, 0]), 0x3a2620); T.tri(add(h, [0.01, 0.01, -0.012]), add(h, [0.06, 0.02, -0.02]), add(h, [0.02, -0.01, 0]), 0x3a2620);
}
function buildSquidStrip(T: Tris) {
  // 魷魚條：扁長、乳白，上面帶淡紫紅斑，尾端剪成兩叉、微微波浪
  body(T, 0.5, -0.2, 20, 10, t => { const k = Math.min(1, (t + 0.04) / 0.1); return [0.035 * k, 0.12 * k * (1 - 0.25 * t)]; },
    (t, vm, i, j) => (vm > 0.2 ? (hash(i, j) > 0.82 ? 0xd3a0a4 : 0xeedfd5) : 0xf6ede3), t => 0.04 * Math.sin(t * 7));
  for (const s of [1, -1]) {
    const pts: V[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([-0.19 - t * 0.3, 0.04 * Math.sin(7 + t * 2.2), s * (0.045 * Math.min(1, t * 4) + t * 0.04)]); }
    tube(T, pts, t => [0.026 * (1 - t * 0.7), 0.05 * (1 - t * 0.8)], 8, (t, vm, i, j) => (vm > 0.2 ? (hash(i, j + s) > 0.82 ? 0xd3a0a4 : 0xeedfd5) : 0xf6ede3), true);
  }
}
function buildMinnow(T: Tris) {
  // 米諾：細長魚形、藍背銀身，頭下透明舌板，兩組三本鉤
  const prof = [[0, 0.005, 0.004], [0.06, 0.07, 0.05], [0.22, 0.105, 0.07], [0.6, 0.095, 0.06], [0.88, 0.05, 0.032], [1, 0.02, 0.014]];
  body(T, 0.42, -0.42, 24, 14, t => lerpProf(prof, t), fishPaint(0x2f5e8c, 0xd5dfe8, 0xf4f6f8, 0xe8eff5));
  // 腮紅、眼
  for (const s of [1, -1]) T.tri([0.3, 0.06, s * 0.068], [0.27, -0.06, s * 0.068], [0.25, 0.0, s * 0.072], 0xc8401a);
  eyes(T, 0.35, 0.025, 0.05, 0.026);
  // 透明舌板（往前下斜）
  T.poly([[0.4, -0.03, 0.045], [0.53, -0.15, 0.07], [0.56, -0.2, 0], [0.53, -0.15, -0.07], [0.4, -0.03, -0.045]], 0x9fcde6);
  ring(T, [0.49, -0.12, 0], [0, 0, 1], 0.012, 0.004, STEEL_D);
  treble(T, [0.12, -0.11, 0], 0.13, 0.007);
  treble(T, [-0.43, -0.02, 0], 0.13, 0.007, 1.0);
}
function buildJig(T: Tris) {
  // 鐵板：細長扁平金屬片，藍背銀身、亮面一格一格反光，頭上輔助鉤
  const prof = [[0, 0.012, 0.01], [0.07, 0.06, 0.028], [0.5, 0.075, 0.03], [0.85, 0.055, 0.024], [1, 0.012, 0.01]];
  body(T, 0.5, -0.5, 26, 8, t => lerpProf(prof, t), (t, vm, i, j) => (vm > 0.55 ? 0x2c66b0 : vm > 0.05 ? (hash(i, j) > 0.85 ? 0xcfe2f4 : 0xeaf0f5) : vm > -0.6 ? 0xb3c1ce : 0xe9cf4a));
  eyes(T, 0.4, 0.015, 0.024, 0.02);
  ring(T, [0.53, 0, 0], [0, 0, 1], 0.018, 0.005, STEEL_D);
  line(T, [[0.55, 0, 0], [0.5, -0.07, 0.01], [0.43, -0.14, 0.02]], 0.006, 0xe8e2d0);
  hook(T, [0.43, -0.12, 0.02], [-0.6, -1, 0], [-1, 0.2, 0], 0.11, 0.008);
}
function buildSoft(T: Tris) {
  // 軟蟲：鉛頭鉤（紅色圓頭＋眼）套一條綠褐色捲尾蟲，鉤尖從背上穿出
  ball(T, [0.38, 0, 0], 0.085, (t, vm, i, j) => (vm > -0.6 ? (hash(i, j) > 0.85 ? 0xe06a3a : 0xc8401a) : 0xa93315), 8);
  eyes(T, 0.43, 0.025, 0.06, 0.024, 0xf6f2e8);
  ring(T, [0.38, 0.1, 0], [0, 0, 1], 0.02, 0.006, STEEL_D);
  const prof = [[0, 0.05, 0.05], [0.12, 0.055, 0.055], [0.6, 0.045, 0.045], [1, 0.025, 0.025]];
  body(T, 0.31, -0.2, 16, 10, t => lerpProf(prof, t), (t, vm, i, j) => (hash(i, j) > 0.88 ? 0xe9d064 : i % 2 ? 0x6f8a3a : 0x617c31), t => -0.005 * t);
  // 捲尾
  const pts: V[] = []; for (let i = 0; i <= 18; i++) { const t = i / 18, a = t * Math.PI * 1.6; pts.push([-0.2 - Math.sin(a) * 0.13 - t * 0.12, -0.13 + Math.cos(a) * 0.13, 0]); }
  tube(T, pts, t => [0.028 * (1 - t * 0.6), 0.008 + 0.022 * (1 - t)], 6, (t, vm, i, j) => (hash(i, j) > 0.85 ? 0xe9d064 : 0x6a8536), true, [0, 0, 1]);
  // 鉤：從鉛頭沿蟲身裡面，到背上穿出
  line(T, [[0.33, 0, 0], [0.05, 0.01, 0]], 0.007, STEEL);
  hook(T, [0.02, 0.07, 0.0], [0, 1, 0], [1, 0, 0], 0.08, 0.007);
}
function buildPopper(T: Tris) {
  // 波趴：胖短身、頭前面凹杯狀嘴、喉部紅，兩組三本鉤，尾鉤帶白羽毛
  const prof = [[0, 0.1, 0.09], [0.08, 0.12, 0.11], [0.35, 0.13, 0.115], [0.8, 0.08, 0.07], [1, 0.03, 0.026]];
  body(T, 0.4, -0.4, 22, 14, t => lerpProf(prof, t), (t, vm, i, j) => (vm > 0.4 ? 0x4f8f3a : t < 0.22 && vm < -0.3 ? 0xd8322a : vm > -0.5 ? (hash(i, j) > 0.88 ? 0xf7efb4 : 0xf1e68e) : 0xfbf8ee));
  // 杯狀嘴：往內縮的凹面
  const cup: V[] = []; for (let i = 0; i <= 4; i++) { const t = i / 4; cup.push([0.4 - t * 0.07, -0.01, 0]); }
  tube(T, cup, t => [0.1 * (1 - t * 0.75), 0.09 * (1 - t * 0.75)], 14, (t, vm) => (vm < -0.2 ? 0xb52722 : 0xd8322a), false);
  eyes(T, 0.32, 0.04, 0.095, 0.03);
  ring(T, [0.36, 0.06, 0], [0, 0, 1], 0.014, 0.005, STEEL_D);
  treble(T, [0.05, -0.13, 0], 0.13, 0.007);
  treble(T, [-0.41, -0.02, 0], 0.13, 0.007, 0.9);
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; line(T, [[-0.42, -0.08, 0], [-0.5, -0.12 + Math.sin(a) * 0.03, Math.cos(a) * 0.03], [-0.58, -0.13 + Math.sin(a) * 0.05, Math.cos(a) * 0.05]], 0.008, k % 2 ? 0xffffff : 0xe4e8ec); }
}
function buildStickbait(T: Tris) {
  // 大鉛筆餌：很長、沒有舌板，藍背銀身，兩組粗三本鉤
  const prof = [[0, 0.01, 0.01], [0.06, 0.055, 0.045], [0.3, 0.075, 0.058], [0.72, 0.062, 0.05], [0.94, 0.03, 0.024], [1, 0.012, 0.01]];
  body(T, 0.5, -0.5, 28, 14, t => lerpProf(prof, t), fishPaint(0x1f4f8e, 0xcdd9e4, 0xf5f7f9, 0xe4ecf3, 0.3), t => -0.01 * Math.sin(t * Math.PI));
  for (const s of [1, -1]) T.tri([0.4, 0.045, s * 0.05], [0.37, -0.045, s * 0.05], [0.35, 0, s * 0.055], 0x7da8d8);
  eyes(T, 0.43, 0.012, 0.04, 0.022);
  ring(T, [0.52, 0, 0], [0, 0, 1], 0.014, 0.005, STEEL_D);
  treble(T, [0.12, -0.075, 0], 0.15, 0.008);
  treble(T, [-0.25, -0.065, 0], 0.15, 0.008, 1.0);
}
function buildTrollSkirt(T: Tris) {
  // 船拖裙尾假餌：鍍鉻子彈頭（前面凹面眼）＋往後拖的長條彩色裙尾，裡面藏大單鉤
  const prof = [[0, 0.06, 0.06], [0.1, 0.085, 0.085], [0.6, 0.095, 0.095], [1, 0.08, 0.08]];
  body(T, 0.5, 0.22, 10, 14, t => lerpProf(prof, t), (t, vm) => (t < 0.18 ? 0x2a5a86 : vm > 0.5 ? 0xf2f6fa : vm > -0.3 ? 0xc3cfda : 0x8e9cab));
  eyes(T, 0.46, 0.02, 0.07, 0.024);
  // 裙尾：一圈 14 條，粉紅／藍／銀亮片交錯，往後散開
  const C = [0xff5fa2, 0x2a7fd8, 0xd9e4ee, 0xff5fa2, 0x2a7fd8, 0x9a3fd0, 0xffffff];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2, pts: V[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, r = 0.075 + t * 0.05; pts.push([0.24 - t * 0.7, Math.sin(a) * r - t * t * 0.04 + Math.sin(t * 5 + k) * 0.01, Math.cos(a) * r]); }
    tube(T, pts, t => [0.004 + 0.01 * (1 - t), 0.02 * (1 - t * 0.6)], 4, C[k % C.length], false, [Math.cos(a), 0, -Math.sin(a)]);
  }
  line(T, [[0.56, 0, 0], [0.62, 0.01, 0]], 0.008, 0xdde4ea);
  hook(T, [-0.2, 0, 0], [-1, 0, 0], [0, -1, 0], 0.22, 0.011);
}
function buildSlowJig(T: Tris) {
  // 慢搖鐵板：寬葉片形、扁平，斑馬紋金／紅，頭上兩支輔助鉤
  const prof = [[0, 0.02, 0.012], [0.12, 0.11, 0.026], [0.45, 0.16, 0.03], [0.75, 0.15, 0.028], [0.95, 0.06, 0.016], [1, 0.02, 0.01]];
  body(T, 0.5, -0.5, 22, 10, t => lerpProf(prof, t), (t, vm) => (vm > 0.75 ? 0x7a1c16 : Math.floor(t * 11) % 2 ? (vm < -0.6 ? 0xeac64e : 0xdcae38) : 0xc4301f), t => -0.03 * t * t);
  eyes(T, 0.38, 0.02, 0.03, 0.026);
  ring(T, [0.53, 0, 0], [0, 0, 1], 0.02, 0.006, STEEL_D);
  for (const s of [1, -1]) {
    line(T, [[0.55, 0, 0], [0.52, -0.06, s * 0.03], [0.46, -0.12, s * 0.05]], 0.006, 0xf0e2c0);
    hook(T, [0.46, -0.1, s * 0.05], [-0.5, -1, 0], [-1, 0.3, s * 0.4], 0.11, 0.008, GOLD);
  }
}
function buildEgi(T: Tris) {
  // 大號木蝦（木蝦／EGI）：蝦形布面身體（橘粉斜紋），下巴鉛片、兩側小鰭、尾端一圈傘形鉤
  const prof = [[0, 0.04, 0.035], [0.1, 0.085, 0.07], [0.35, 0.1, 0.08], [0.8, 0.07, 0.055], [1, 0.03, 0.03]];
  body(T, 0.36, -0.36, 22, 14, t => lerpProf(prof, t), (t, vm, i, j) => (vm > 0.55 ? (i % 3 ? 0xe86a30 : 0xd2501e) : vm > -0.4 ? ((i + j) % 4 < 2 ? 0xff8a64 : 0xff6f8f) : 0xfcd3b8), t => 0.01 * t);
  eyes(T, 0.3, 0.03, 0.065, 0.03, 0xf2c23a);
  // 下巴鉛片（龍骨）
  T.poly([[0.38, -0.03, 0], [0.33, -0.16, 0], [0.16, -0.12, 0], [0.18, -0.06, 0]], 0x6b6e72);
  for (const s of [1, -1]) T.poly([[0.37, -0.035, s * 0.006], [0.32, -0.155, s * 0.006], [0.17, -0.115, s * 0.006], [0.19, -0.06, s * 0.006]], 0x7d8085);
  ring(T, [0.4, -0.01, 0], [0, 0, 1], 0.015, 0.005, STEEL_D);
  // 胸鰭（半透明小鰭）
  for (const s of [1, -1]) T.poly([[0.22, -0.01, s * 0.07], [0.2, 0.04, s * 0.15], [0.12, 0.05, s * 0.15], [0.13, -0.02, s * 0.075]], 0xffb3a0);
  // 背上羽毛觸鬚
  for (const s of [1, -1]) line(T, [[0.26, 0.08, s * 0.02], [0.18, 0.15, s * 0.04], [0.06, 0.17, s * 0.05]], 0.007, 0xf05a7a);
  // 尾端：鉤柄＋兩層傘形針
  line(T, [[-0.36, 0, 0], [-0.47, 0, 0]], 0.01, STEEL);
  for (const [x, n, L] of [[-0.44, 10, 0.07], [-0.48, 10, 0.06]] as [number, number, number][]) for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (x < -0.46 ? 0.3 : 0), d: V = [0.45, Math.sin(a), Math.cos(a)];
    line(T, [[x, 0, 0], add([x, 0, 0], norm(d), L)], 0.0045, 0xe9a4b8);
  }
}

const BUILD: Record<TackleKey, (T: Tris) => void> = {
  oyster: buildOyster, shrimp: buildShrimp, worm: buildWorm, squid: buildSquidStrip,
  minnow: buildMinnow, jig: buildJig, soft: buildSoft, popper: buildPopper,
  stickbait: buildStickbait, trollskirt: buildTrollSkirt, slowjig: buildSlowJig, egi: buildEgi,
};

/** 產生一個釣具的幾何（置中、最長邊＝1）；不認得的 key 回 null */
export function buildTackleGeometry(k: string): THREE.BufferGeometry | null {
  const fn = (BUILD as Record<string, ((T: Tris) => void) | undefined>)[k]; if (!fn) return null;
  const T = new Tris(); fn(T);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(T.col, 3));
  g.computeBoundingBox();
  const bb = g.boundingBox!, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
  const m = Math.max(s.x, s.y, s.z) || 1;
  g.translate(-c.x, -c.y, -c.z); g.scale(1 / m, 1 / m, 1 / m);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

const cache = new Map<string, THREE.BufferGeometry>();
export function tackleGeometry(k: string) { let g = cache.get(k); if (!g) { const n = buildTackleGeometry(k); if (!n) return null; g = n; cache.set(k, g); } return g; }
export function disposeTackleGeometries() { for (const g of cache.values()) g.dispose(); cache.clear(); }
