/**
 * 釣竿模型（拿在手上）：垂釣竿＝長竹竿（竹節、手把纏線、木頭線輪）；路亞竿＝短碳纖維竿（EVA／軟木握把、捲線器在竿下、5 個導線環由大到小）。
 * 一支竿＝一個合併好的 mesh（頂點色）＋路亞竿的捲線器搖把（會轉）。竿子彎曲在 CPU 改頂點（只有彎度變了才改），竿尖位置跟著彎。
 * 竿子座標：握把底＝原點、竿身沿 +Y、彎曲往 -Z（掛線的那一邊）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Gear } from './fishLogic';

/** 竿長（公尺）：人物約 1.5 公尺高，垂釣竿比人長一倍、路亞竿比較短 */
export const ROD_LEN: Record<Gear, number> = { float: 3.0, lure: 1.95 };
/** 握把在竿上的位置（手握的點離竿底多遠） */
export const ROD_GRIP: Record<Gear, number> = { float: 0.32, lure: 0.3 };

/**
 * 彎曲：竿上高度 y 的位置往 -Z 偏多少（bend 0～1；負的＝往反方向）。越靠竿尖彎越多（三次方），竿尖往下也會縮一點。
 * 手握的地方以下不彎。
 */
export function rodBend(y: number, L: number, bend: number, grip = 0) {
  const u = Math.max(0, (y - grip) / Math.max(0.01, L - grip));
  const d = bend * 0.42 * (L - grip) * u * u * (1.4 - 0.4 * u);
  const dy = -Math.abs(bend) * 0.12 * (L - grip) * u * u * u;
  return { dz: -d, dy };
}

const COL = new THREE.Color();
function paint(g: THREE.BufferGeometry, hex: number) {
  const n = g.getAttribute('position').count; const a = new Float32Array(n * 3); COL.setHex(hex);
  for (let i = 0; i < n; i++) { a[i * 3] = COL.r; a[i * 3 + 1] = COL.g; a[i * 3 + 2] = COL.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
/** 一段竿身（圓錐柱），y0→y1、半徑 r0→r1 */
function seg(y0: number, y1: number, r0: number, r1: number, hex: number, sides = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, sides, 1, false); g.translate(0, (y0 + y1) / 2, 0); return paint(ni(g), hex);
}
function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: number) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(ni(g), hex); }
function ring(r: number, y: number, z: number, hex: number) {
  const g = new THREE.TorusGeometry(r, 0.0035, 3, 8); g.rotateX(Math.PI / 2); g.rotateY(Math.PI / 2); g.translate(0, y, z); return paint(ni(g), hex);
}

export type Rod = {
  kind: Gear;
  g: THREE.Group;
  /** 設定彎度（-1～1）；跟上次差不多就不改頂點 */
  setBend(b: number): void;
  /** 捲線器搖把轉到幾度（路亞竿） */
  setCrank(a: number): void;
  /** 竿尖（竿子座標） */
  tipLocal(out: THREE.Vector3): THREE.Vector3;
  /** 搖把握把（竿子座標；左手要握的地方）；垂釣竿＝竿上前手的位置 */
  handLLocal(out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
};

/** 頂點色、平面著色的共用材質 */
let mat: THREE.MeshLambertMaterial | null = null;
const rodMat = () => (mat ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

/** 做一支釣竿（每個人一支；用完 dispose） */
export function makeRod(kind: Gear): Rod {
  const L = ROD_LEN[kind], grip = ROD_GRIP[kind];
  const parts: THREE.BufferGeometry[] = [];
  let crank: THREE.Mesh | null = null;
  const crankAt = new THREE.Vector3(), handL = new THREE.Vector3();
  if (kind === 'float') {
    // 竹竿：五節，越上面越細；節處深一點的竹節環；底部手把纏暗紅色線
    const nodes = 6;
    for (let i = 0; i < nodes; i++) {
      const y0 = (L * i) / nodes, y1 = (L * (i + 1)) / nodes;
      const r0 = 0.019 - 0.0145 * (i / nodes), r1 = 0.019 - 0.0145 * ((i + 1) / nodes);
      parts.push(seg(y0, y1, r0, r1, i % 2 ? 0xc9a85f : 0xbf9c52));
      if (i > 0) parts.push(seg(y0 - 0.012, y0 + 0.012, r0 + 0.0035, r0 + 0.0035, 0x8a6a34));
    }
    parts.push(seg(0, 0.42, 0.024, 0.022, 0x7a2a22, 8));
    parts.push(seg(0.0, 0.03, 0.027, 0.027, 0x3a2a1a, 8));
    // 木頭線輪（握把上方、竿子下面）
    const drum = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10); drum.rotateZ(Math.PI / 2); drum.translate(0, 0.5, 0.05); parts.push(paint(ni(drum), 0x6a4a2a));
    parts.push(box(0.012, 0.02, 0.05, 0, 0.5, 0.025, 0x4a3420));
    handL.set(0, grip + 0.38, 0);
  } else {
    // 路亞竿：碳纖維竿身（深藍黑）、#2a5a86 纏線、EVA 握把（後）＋軟木（前）、捲線座
    parts.push(seg(0, 0.22, 0.02, 0.019, 0x2a2a2a, 8)); // 後握 EVA
    parts.push(seg(0.22, 0.27, 0.017, 0.017, 0x2a5a86, 8)); // 捲線座
    parts.push(seg(0.27, 0.42, 0.019, 0.017, 0xb08a5a, 8)); // 前握 軟木
    parts.push(seg(0.42, L, 0.012, 0.0028, 0x1c2430, 6));
    for (const y of [0.44, 0.9, 1.4]) parts.push(seg(y, y + 0.02, 0.0125 - y * 0.004, 0.0122 - y * 0.004, 0x2a5a86, 6));
    // 導線環：從捲線器往竿尖由大到小（在竿子下面，-Z 是掛線那面＝竿腹）
    const guides = [[0.62, 0.032], [0.92, 0.022], [1.2, 0.016], [1.45, 0.012], [1.7, 0.009]];
    for (const [y, r] of guides) { parts.push(ring(r, y, -r - 0.012, 0xb8c0c8)); parts.push(box(0.004, 0.004, r + 0.012, 0, y, -(r + 0.012) / 2, 0x8a9098)); }
    parts.push(ring(0.005, L - 0.004, -0.006, 0xb8c0c8));
    // 紡車式捲線器：腳＋本體＋線杯（往前）＋線臂
    parts.push(box(0.012, 0.012, 0.07, 0, 0.245, -0.035, 0x3a3e44));
    const body = new THREE.CylinderGeometry(0.03, 0.034, 0.06, 8); body.rotateX(Math.PI / 2); body.translate(0, 0.245, -0.09); parts.push(paint(ni(body), 0x2a2e34));
    const spool = new THREE.CylinderGeometry(0.028, 0.028, 0.04, 10); spool.translate(0, 0.295, -0.09); parts.push(paint(ni(spool), 0xc0c6cc));
    const lineG = new THREE.CylinderGeometry(0.024, 0.024, 0.03, 10); lineG.translate(0, 0.297, -0.09); parts.push(paint(ni(lineG), 0x2a5a86));
    parts.push(box(0.06, 0.004, 0.004, 0, 0.32, -0.09, 0x9aa0a6));
    crankAt.set(-0.036, 0.245, -0.09);
    // 搖把：臂＋握把（另一個 mesh，會轉）
    const cg = mergeGeometries([box(0.008, 0.07, 0.01, -0.006, -0.035, 0, 0x3a3e44), box(0.026, 0.018, 0.018, -0.02, -0.07, 0, 0x2a5a86)])!;
    crank = new THREE.Mesh(cg, rodMat()); crank.position.copy(crankAt);
    handL.set(-0.05, 0.245 - 0.07, -0.09);
  }
  const geo = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
  const base = (geo.getAttribute('position').array as Float32Array).slice();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const mesh = new THREE.Mesh(geo, rodMat()); mesh.frustumCulled = false; mesh.castShadow = false;
  const g = new THREE.Group(); g.name = 'fishRod'; g.add(mesh); if (crank) g.add(crank);
  let bendNow = 0;
  const apply = (b: number) => {
    const a = pos.array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      const y = base[i + 1]; const d = rodBend(y, L, b, grip);
      a[i] = base[i]; a[i + 1] = y + d.dy; a[i + 2] = base[i + 2] + d.dz;
    }
    pos.needsUpdate = true; // 平面著色：法線在 shader 裡算，不用重算頂點法線
  };
  return {
    kind, g,
    setBend(b) { b = Math.max(-1, Math.min(1, b)); if (Math.abs(b - bendNow) < 0.012) return; bendNow = b; apply(b); },
    setCrank(a) { if (crank) crank.rotation.x = a; },
    tipLocal(out) { const d = rodBend(L, L, bendNow, grip); return out.set(0, L + d.dy, d.dz); },
    handLLocal(out) {
      if (kind === 'lure' && crank) { const a = crank.rotation.x; return out.set(crankAt.x - 0.02, crankAt.y - Math.cos(a) * 0.07, crankAt.z - Math.sin(a) * 0.07); }
      const d = rodBend(handL.y, L, bendNow, grip); return out.set(handL.x, handL.y + d.dy, handL.z + d.dz);
    },
    dispose() { g.removeFromParent(); geo.dispose(); crank?.geometry.dispose(); },
  };
}
