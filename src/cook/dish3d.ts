/**
 * 蚵仔煎程序化模型：一個產生器涵蓋 9,216 種組合（同一 id 一定長一樣）。
 * 單位：半徑 1；放到世界時自行縮放（盤上約 0.13）。
 */
import * as THREE from 'three';
import { comboOf, isTower, blooperOf, type Combo } from './combo';

function rng(seed: number) {
  let a = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const matCache = new Map<string, THREE.Material>();
function mat(color: string, o: { rough?: number; opacity?: number; emissive?: string } = {}) {
  const k = `${color}|${o.rough ?? 0.7}|${o.opacity ?? 1}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: 0, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1 });
    matCache.set(k, m);
  }
  return m;
}
const G = {
  oy: new THREE.SphereGeometry(1, 10, 6),
  shrimp: new THREE.TorusGeometry(0.1, 0.038, 6, 12, Math.PI * 1.25),
  squid: new THREE.TorusGeometry(0.085, 0.026, 6, 14),
  leaf: (() => { const s = new THREE.Shape(); s.moveTo(0, -0.1); s.quadraticCurveTo(0.07, 0, 0, 0.11); s.quadraticCurveTo(-0.07, 0, 0, -0.1); return new THREE.ShapeGeometry(s, 4); })(),
  blob: new THREE.SphereGeometry(1, 10, 6),
  /** 小白菜葉片（沿 +x 長）：邊緣波浪皺摺，三種皺法輪流用 */
  bok: [0, 1, 2].map(v => {
    const s = new THREE.Shape();
    const L = 0.44 + v * 0.03, W = 0.15 + v * 0.015;
    s.moveTo(0, 0);
    s.bezierCurveTo(L * 0.25, W * 0.9, L * 0.75, W * 1.05, L, W * 0.15);
    s.bezierCurveTo(L * 1.02, -W * 0.1, L * 0.7, -W * 1.05, L * 0.25, -W * 0.85);
    s.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(s, 14);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), e = Math.abs(y) / W;
      p.setZ(i, Math.sin(x * (34 + v * 6) + v) * 0.018 * e + Math.sin(y * 60 + x * 20) * 0.008 + y * y * 1.6 + x * x * 0.12);
    }
    geo.computeVertexNormals();
    return geo;
  }),
  spot: new THREE.CircleGeometry(1, 10),
  /** 豬肉絲：細長一小條 */
  pork: new THREE.CylinderGeometry(0.012, 0.009, 0.16, 6),
  /** 韭菜：細長葉片（沿 +x），和圓葉小白菜明顯不同 */
  chive: (() => {
    const s = new THREE.Shape();
    const L = 0.46, W = 0.016;
    s.moveTo(0, 0);
    s.quadraticCurveTo(L * 0.4, W, L * 0.88, W * 0.45);
    s.lineTo(L, 0);
    s.quadraticCurveTo(L * 0.88, -W * 0.35, L * 0.4, -W);
    s.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(s, 10);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 9) * 0.018 + x * x * 0.07);
    }
    geo.computeVertexNormals();
    return geo;
  })(),
};

const BATTER_COL = ['#efe5c8', '#ddb062', '#ad6d33'];
const EDGE_COL = ['#e6d6ae', '#c58a3c', '#6e3f1c'];
/** 醬色：甜辣是夜市那種橘紅色 */
const SAUCE_COL = ['', '#e2552c', '#4a2b1d', '#cf2a22', '#a8572a', '#c98a1c'];
const EGG_Y = ['#f6d35a', '#eebd3c', '#d79a33'];
const EGG_W = ['#fbf3d6', '#f6e6b8', '#ead19a'];

function blobOutline(r: () => number, R: number, n = 28, wob = 0.09) {
  const s = new THREE.Shape();
  const ph = r() * 6, ph2 = r() * 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = R * (1 + Math.sin(a * 3 + ph) * wob * 0.6 + Math.sin(a * 5 + ph2) * wob * 0.4 + (r() - 0.5) * wob * 0.5);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

function heartOutline(s = 0.9) {
  const sh = new THREE.Shape();
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = s * 0.052 * 16 * Math.pow(Math.sin(a), 3);
    const y = s * 0.052 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  return sh;
}

function addSaucePool(g: THREE.Group, c: Combo, r: () => number, top: number, loose: boolean) {
  const col = SAUCE_COL[c.sauce];
  const Rp = loose ? 0.4 + r() * 0.06 : 0.6 + r() * 0.08;
  const T = c.sauce === 2 ? 0.012 : 0.02;
  const shape = blobOutline(r, Rp, 40, 0.2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: T, bevelSize: 0.05, bevelSegments: 3, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(geo, mat(col, { rough: 0.16 }));
  pool.position.y = top + T * 0.4; g.add(pool);
  // 邊緣半透明一圈
  const rim = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(r, Rp * 1.12, 36, 0.24), 3), mat(col, { opacity: 0.42, rough: 0.2 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = top + 0.003; g.add(rim);
  if (loose) return;
  // 流過餅邊的醬汁舌頭，盤子上積一小灘
  const n = 3 + Math.floor(r() * 3), edge = c.batter === 1 ? 0.95 : 0.88;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const w = 0.06 + r() * 0.05;
    const tongue = new THREE.Mesh(G.blob, mat(col, { rough: 0.18 }));
    const mid = (Rp + edge) / 2, len = (edge - Rp) / 2 + 0.08;
    tongue.scale.set(len, T * 0.9, w); tongue.rotation.y = -a;
    tongue.position.set(ca * mid, top + T * 0.3, sa * mid); g.add(tongue);
    const over = new THREE.Mesh(G.blob, mat(col, { rough: 0.18 }));
    over.scale.set(0.08, 0.05, w * 0.85); over.rotation.y = -a; over.rotation.z = 0;
    over.position.set(ca * (edge + 0.02), top * 0.55, sa * (edge + 0.02)); g.add(over);
    if (r() < 0.75) {
      const pud = new THREE.Mesh(G.blob, mat(col, { rough: 0.15 }));
      const pr = 0.07 + r() * 0.07;
      pud.scale.set(pr * 1.3, 0.012, pr); pud.rotation.y = -a;
      pud.position.set(ca * (edge + 0.1), 0.006, sa * (edge + 0.1)); g.add(pud);
    }
  }
}

/** 小白菜：深淺兩種綠、白綠色梗；有的被半透明粉漿蓋住一半，有的伸出餅邊 */
function addGreens(g: THREE.Group, c: Combo, r: () => number, top: number, loose: boolean) {
  const dark = c.done === 2 ? '#2f6a24' : '#3a8a2e', light = c.done === 2 ? '#5c9440' : '#78b85a';
  const stemCol = c.done === 2 ? '#c9d9a8' : '#e3efcf';
  const n = loose ? 5 : 6 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const kind = loose ? 2 : i % 3; // 0 蓋在粉漿下、1 伸出餅邊、2 放在上面
    const o = new THREE.Group();
    const stem = new THREE.Mesh(G.blob, mat(stemCol, { rough: 0.45 }));
    stem.scale.set(0.13, 0.028, 0.045); stem.position.set(0.08, 0, 0); o.add(stem);
    const leaf = new THREE.Mesh(G.bok[i % 3], mat(r() < 0.5 ? dark : light, { rough: 0.55 }));
    (leaf.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    leaf.rotation.x = -Math.PI / 2; leaf.position.set(0.15, 0.01, 0); o.add(leaf);
    const k = 1.05 + r() * 0.35; o.scale.setScalar(k);
    const a = r() * Math.PI * 2;
    let d: number, y: number;
    if (kind === 1) { d = 0.4 + r() * 0.1; y = top - 0.01; o.rotation.y = -a; o.rotation.z = -0.12; o.scale.setScalar(0.95 + r() * 0.15); } // 葉尖伸出餅邊、不超出盤子
    else { d = Math.sqrt(r()) * (loose ? 0.35 : 0.5); y = kind === 0 ? top - 0.03 : top + 0.02; o.rotation.y = r() * Math.PI * 2; o.rotation.z = (r() - 0.5) * 0.2; }
    o.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    g.add(o);
    if (kind === 0) {
      // 半透明粉漿蓋住一半
      const film = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(r, 0.2, 20, 0.25), 2), mat(BATTER_COL[c.done], { opacity: 0.55, rough: 0.4 }));
      film.rotation.x = -Math.PI / 2; film.position.set(Math.cos(a) * d + (r() - 0.5) * 0.1, top + 0.012, Math.sin(a) * d + (r() - 0.5) * 0.1); g.add(film);
    }
  }
}

function addPork(g: THREE.Group, c: Combo, r: () => number, top: number, loose: boolean) {
  const col = c.done === 2 ? '#8a4a28' : c.done === 1 ? '#b05a32' : '#c4784a';
  const n = loose ? 7 : 9;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(G.pork, mat(col, { rough: 0.55 }));
    m.rotation.z = (r() - 0.5) * 0.9;
    m.rotation.x = Math.PI / 2 + (r() - 0.5) * 0.5;
    const o = new THREE.Group(); o.add(m);
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (loose ? 0.5 : 0.68);
    o.position.set(Math.cos(a) * d, top + 0.03 + r() * 0.02, Math.sin(a) * d);
    o.rotation.y = r() * Math.PI * 2;
    o.scale.setScalar(0.85 + r() * 0.4);
    g.add(o);
  }
}

function addChives(g: THREE.Group, c: Combo, r: () => number, top: number, loose: boolean) {
  const dark = c.done === 2 ? '#245a22' : '#2f7a32';
  const light = c.done === 2 ? '#3d7a30' : '#4a9a3c';
  const n = loose ? 6 : 8;
  for (let i = 0; i < n; i++) {
    const blade = new THREE.Mesh(G.chive, mat(r() < 0.5 ? dark : light, { rough: 0.5 }));
    (blade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    blade.rotation.x = -Math.PI / 2;
    const o = new THREE.Group(); o.add(blade);
    const a = r() * Math.PI * 2;
    if (i % 3 === 1) {
      o.position.set(Math.cos(a) * 0.7, top + 0.01, Math.sin(a) * 0.7);
      o.rotation.y = -a + (r() - 0.5) * 0.25;
      o.rotation.z = 0.12 + r() * 0.22;
    } else {
      const d = Math.sqrt(r()) * (loose ? 0.4 : 0.55);
      o.position.set(Math.cos(a) * d, top + 0.025, Math.sin(a) * d);
      o.rotation.y = r() * Math.PI * 2;
      o.rotation.z = (r() - 0.5) * 0.45;
    }
    o.scale.setScalar(0.9 + r() * 0.35);
    g.add(o);
  }
}

/** 產生一盤蚵仔煎（Group，底面在 y=0） */
export function buildDish(id: number, combo?: Combo, seed = 0): THREE.Group {
  const c = combo ?? comboOf(id);
  if (!c) return new THREE.Group();
  // 粉漿／蛋的形狀只看粉漿和熟度（加減配料、加蛋時餅皮不會整個換形狀，動畫才接得上）
  const bseed = (c.batter * 3 + c.done) * 97;
  let r = rng(bseed + 17 + seed * 7919);
  const g = new THREE.Group();
  const H = [0, 0.05, 0.085, 0.14][c.batter];
  let top = 0.02;
  const loose = c.batter === 0;
  /** 動畫用：把這段新加的物件標上 part */
  const tag = (from: number, part: string) => { for (let i = from; i < g.children.length; i++) g.children[i].userData.part ??= part; };
  let mark = g.children.length;
  const tower = isTower(c);
  const blooper = blooperOf(c);
  if (tower) {
    const tr = rng((id || 1) * 17 + 401 + seed * 53);
    let y = 0;
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const rad = 0.9 - i * 0.08, h = 0.125 + tr() * 0.03;
      const shape = blobOutline(tr, rad, 28, 0.1 + i * 0.02);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: h * 0.28, bevelSize: 0.045, bevelSegments: 2, curveSegments: 4 });
      geo.rotateX(-Math.PI / 2);
      const col = i === layers - 1 ? BATTER_COL[c.done] : EDGE_COL[Math.min(2, c.done)];
      const mesh = new THREE.Mesh(geo, mat(col, { rough: 0.68 }));
      const lean = (i - 1.1) * 0.09;
      mesh.position.set(Math.sin(i * 1.35) * lean, y + h * 0.35, Math.cos(i * 0.95) * lean * 0.85);
      mesh.rotation.y = (tr() - 0.5) * 0.45;
      mesh.rotation.z = (i % 2 ? 1 : -1) * (0.05 + tr() * 0.06);
      mesh.rotation.x = (tr() - 0.5) * 0.07;
      g.add(mesh);
      y += h * 1.18;
    }
    top = y + 0.02;
  } else if (!loose) {
    const heart = blooper === 'lonely';
    const shape = heart ? heartOutline(0.92) : blobOutline(r, c.batter === 1 ? 0.95 : 0.88, 32, c.batter === 1 ? 0.14 : 0.08);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: H * 0.35, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    const base = new THREE.Mesh(geo, mat(BATTER_COL[c.done], { rough: c.batter === 1 ? 0.5 : 0.75 }));
    base.position.y = H * 0.35;
    if (heart) base.rotation.y = Math.PI; // 心尖朝前
    g.add(base);
    top = H * 1.7 + 0.01;
    // 薄脆：外圈蕾絲脆邊
    if (c.batter === 1) {
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, d = 0.9 + r() * 0.22;
        const m = new THREE.Mesh(G.spot, mat(EDGE_COL[c.done], { opacity: 0.85 }));
        m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.04 + r() * 0.06);
        m.position.set(Math.cos(a) * d, 0.012, Math.sin(a) * d); g.add(m);
      }
    }
    // 熟度：邊緣焦色＋斑點
    const edge = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(rng(bseed + 3), c.batter === 1 ? 0.97 : 0.9, 32, 0.08), 4), mat(EDGE_COL[c.done], { opacity: [0.25, 0.55, 0.85][c.done] }));
    edge.rotation.x = -Math.PI / 2; edge.position.y = top - 0.004; g.add(edge);
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(rng(bseed + 5), [0.8, 0.72, 0.62][c.done], 28, 0.1), 4), mat(BATTER_COL[c.done]));
    inner.rotation.x = -Math.PI / 2; inner.position.y = top - 0.002; g.add(inner);
    const spots = [3, 9, 18][c.done];
    for (let i = 0; i < spots; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
      const m = new THREE.Mesh(G.spot, mat(EDGE_COL[Math.min(2, c.done + 1)], { opacity: 0.7 }));
      m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.03 + r() * 0.05);
      m.position.set(Math.cos(a) * d, top, Math.sin(a) * d); g.add(m);
    }
  }
  tag(mark, 'batter'); mark = g.children.length;
  // 蛋：攤平的蛋皮片（不規則薄片，邊緣帶一點蛋白）；沒粉漿就是散開的炒蛋片
  if (c.egg && blooper === 'egg') {
    const er = rng(c.batter * 41 + 29 + seed * 7919);
    const face = [
      { x: 0, z: 0, R: 0.42 },
      { x: -0.16, z: -0.1, R: 0.09 },
      { x: 0.16, z: -0.1, R: 0.09 },
      { x: -0.18, z: 0.16, R: 0.06 },
      { x: 0, z: 0.2, R: 0.055 },
      { x: 0.18, z: 0.16, R: 0.06 },
    ];
    for (let i = 0; i < face.length; i++) {
      const f = face[i], piece = new THREE.Group();
      const col = i === 0 ? EGG_W[c.done] : i <= 2 ? EGG_Y[c.done] : EGG_W[c.done];
      const pat = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(er, f.R, 20, 0.12), 2), mat(col, { rough: 0.5 }));
      pat.rotation.x = -Math.PI / 2; piece.add(pat);
      piece.position.set(f.x, top + 0.01, f.z); g.add(piece);
    }
  } else if (c.egg) {
    const er = rng(c.batter * 41 + 29 + seed * 7919);
    const n = loose ? 8 : 5 + Math.floor(er() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + er() * 0.9, d = loose ? 0.12 + er() * 0.42 : 0.18 + er() * 0.42;
      const R = loose ? 0.1 + er() * 0.07 : 0.24 + er() * 0.1;
      const y = top + 0.006 + i * 0.0025 + er() * 0.006;
      const piece = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(er, R * 1.08, 22, 0.22), 2), mat(EGG_W[c.done], { rough: 0.55 }));
      rim.rotation.x = -Math.PI / 2; piece.add(rim);
      const yolk = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(er, R * 0.92, 22, 0.25), 2), mat(EGG_Y[c.done], { rough: 0.5 }));
      yolk.rotation.x = -Math.PI / 2; yolk.position.set((er() - 0.5) * R * 0.15, 0.003, (er() - 0.5) * R * 0.15); piece.add(yolk);
      // 一兩條蛋白紋
      if (er() < 0.6) {
        const st = new THREE.Mesh(G.spot, mat(EGG_W[c.done], { opacity: 0.9 }));
        st.rotation.x = -Math.PI / 2; st.scale.set(R * 0.5, R * 0.12, 1); st.position.set((er() - 0.5) * R * 0.6, 0.005, (er() - 0.5) * R * 0.6); piece.add(st);
      }
      piece.scale.set(1, 1, 0.75 + er() * 0.45);
      piece.rotation.y = er() * Math.PI * 2;
      if (loose) { piece.rotation.x = (er() - 0.5) * 0.35; piece.rotation.z = (er() - 0.5) * 0.35; }
      piece.position.set(Math.cos(a) * d, loose ? top + 0.02 + er() * 0.05 : y, Math.sin(a) * d);
      g.add(piece);
    }
    top += loose ? 0.04 : 0.025;
  }
  // 醬：中間一大灘、微微隆起、亮亮的，幾道醬汁流過餅邊滴到盤子上；配料從醬裡冒出來
  tag(mark, 'egg'); mark = g.children.length;
  if (c.sauce) {
    addSaucePool(g, c, rng(id + 67 + seed * 7919), top, loose);
    top += loose ? 0.02 : 0.03;
  }
  tag(mark, 'sauce'); mark = g.children.length;
  // 配料：每種配料用自己的亂數（不看整盤 id），加減別的配料時原本的料不會跳位置，動畫才接得上
  const R = loose ? 0.55 : 0.72;
  const topRng = (bit: number) => { r = rng(bit * 131 + (loose ? 7 : 0) + seed * 7919); };
  const place = (m: THREE.Object3D, lift: number) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
    m.position.set(Math.cos(a) * d, top + lift + (loose ? r() * 0.08 : 0), Math.sin(a) * d);
    m.rotation.y = r() * Math.PI * 2;
    g.add(m);
  };
  topRng(1); mark = g.children.length;
  if (c.top & 1) for (let i = 0; i < 7; i++) {
    const o = new THREE.Group();
    const body = new THREE.Mesh(G.oy, mat(c.done === 2 ? '#a89c84' : '#c4bba5', { rough: 0.35 }));
    body.scale.set(0.12, 0.045, 0.085); o.add(body);
    const frill = new THREE.Mesh(G.oy, mat('#5e5a52', { rough: 0.4 }));
    frill.scale.set(0.06, 0.03, 0.05); frill.position.set(0.06, 0.012, 0); o.add(frill);
    place(o, 0.03);
  }
  tag(mark, 'top1'); topRng(2); mark = g.children.length;
  if (c.top & 2) for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(G.shrimp, mat(c.done === 0 ? '#f39a7c' : '#ec7a52', { rough: 0.45 }));
    m.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(m); place(o, 0.035);
  }
  tag(mark, 'top2'); topRng(4); mark = g.children.length;
  if (c.top & 4) for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(G.squid, mat(c.done === 2 ? '#eadfc8' : '#f6f1e6', { rough: 0.4 }));
    m.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(m); place(o, 0.025);
  }
  tag(mark, 'top4'); topRng(16); mark = g.children.length;
  if (c.top & 16) addPork(g, c, rng(16 * 131 + (loose ? 7 : 0) + seed * 7919), top, loose);
  tag(mark, 'top16'); mark = g.children.length;
  if (c.top & 8) addGreens(g, c, rng(8 * 131 + (loose ? 7 : 0) + seed * 7919), top, loose);
  tag(mark, 'top8'); mark = g.children.length;
  if (c.top & 32) addChives(g, c, rng(32 * 131 + (loose ? 7 : 0) + seed * 7919), top, loose);
  tag(mark, 'top32');
  if (blooper === 'ketchup' || blooper === 'stirburn') {
    const cr = rng(id * 3 + 77 + seed);
    const cracks = blooper === 'ketchup' ? 5 : 3;
    for (let i = 0; i < cracks; i++) {
      const a = cr() * Math.PI * 2, d = 0.1 + cr() * 0.45;
      const crack = new THREE.Mesh(G.spot, mat('#5a3a24', { opacity: 0.7, rough: 0.8 }));
      crack.rotation.x = -Math.PI / 2;
      crack.scale.set(0.02 + cr() * 0.03, 0.18 + cr() * 0.22, 1);
      crack.rotation.z = a; crack.position.set(Math.cos(a) * d, top + 0.012, Math.sin(a) * d);
      g.add(crack);
    }
    // 裂開：一塊稍微走開
    const lean = blooper === 'stirburn' ? 0.22 : 0.12;
    g.rotation.z += (cr() - 0.5) * 0.18;
    g.position.x += (cr() - 0.5) * lean;
  }
  if (blooper === 'stirburn') {
    const cr = rng(id * 5 + 19);
    g.scale.set(1.04, 0.86, 1.04);
    g.position.y += 0.01;
    g.rotation.y += (cr() - 0.5) * 0.4;
  }
  g.userData.dishId = id;
  return g;
}

const UNDER_COL = ['#e4c88c', '#c98f45', '#8a5226'];
const UNDER_SPOT = ['#c9a062', '#9a6128', '#4e2a12'];
/**
 * 翻面後看到的底面：煎過的粉漿面（依熟度上色、焦脆斑點），配料只剩微微凸起；
 * 沒粉漿的則是翻炒過、換了位置的配料。
 */
export function buildUnder(id: number, combo?: Combo): THREE.Group {
  const c = combo ?? comboOf(id);
  if (!c) return new THREE.Group();
  if (!c.batter) return buildDish(id, c, 1);
  const g = new THREE.Group();
  const H = [0, 0.05, 0.085, 0.14][c.batter];
  const shape = blobOutline(rng(id + 17), c.batter === 1 ? 0.95 : 0.88, 32, c.batter === 1 ? 0.14 : 0.08);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: H * 0.35, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(geo, mat(UNDER_COL[c.done], { rough: 0.55 }));
  base.position.y = H * 0.35; g.add(base);
  const top = H * 1.7 + 0.012;
  const r = rng(id + 53);
  // 配料隔著粉漿凸起來的小包
  const bumps = [0, 1, 2, 3, 4, 5].filter(i => c.top & (1 << i)).length * 5 + (c.egg ? 3 : 0);
  for (let i = 0; i < bumps; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.68;
    const m = new THREE.Mesh(G.blob, mat(UNDER_COL[c.done], { rough: 0.5 }));
    const k = 0.08 + r() * 0.06; m.scale.set(k, 0.025 + r() * 0.015, k * (0.7 + r() * 0.5));
    m.position.set(Math.cos(a) * d, top - 0.012, Math.sin(a) * d); m.rotation.y = r() * Math.PI; g.add(m);
  }
  // 焦脆斑點，越熟越多越深
  const spots = [10, 20, 32][c.done];
  for (let i = 0; i < spots; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.82;
    const m = new THREE.Mesh(G.spot, mat(UNDER_SPOT[c.done], { opacity: 0.55 + r() * 0.35 }));
    m.rotation.x = -Math.PI / 2; m.scale.set(0.03 + r() * 0.07, 0.025 + r() * 0.05, 1);
    m.position.set(Math.cos(a) * d, top, Math.sin(a) * d); g.add(m);
  }
  // 外圈比較焦
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.66, c.batter === 1 ? 0.95 : 0.88, 32), mat(UNDER_SPOT[c.done], { opacity: 0.35 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = top - 0.003; g.add(ring);
  // 蛋從縫隙透出一點點
  if (c.egg) for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(G.spot, mat(EGG_Y[c.done], { opacity: 0.3 }));
    m.rotation.x = -Math.PI / 2; m.scale.set(0.12 + r() * 0.08, 0.08 + r() * 0.05, 1);
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.6; m.position.set(Math.cos(a) * d, top + 0.001, Math.sin(a) * d); g.add(m);
  }
  // 伸出餅邊的青菜葉尖／韭菜，翻過來也看得到
  if (c.top & 8) {
    const vr = rng(id + 59);
    for (let i = 0; i < 3; i++) {
      const a = vr() * Math.PI * 2, leaf = new THREE.Mesh(G.bok[i % 3], mat(i % 2 ? '#3a8a2e' : '#78b85a', { rough: 0.55 }));
      (leaf.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      leaf.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(leaf);
      o.rotation.y = -a; o.position.set(Math.cos(a) * 0.68, top * 0.5, Math.sin(a) * 0.68); g.add(o);
    }
  }
  if (c.top & 32) {
    const vr = rng(id + 61);
    for (let i = 0; i < 3; i++) {
      const a = vr() * Math.PI * 2, blade = new THREE.Mesh(G.chive, mat(i % 2 ? '#245a22' : '#4a9a3c', { rough: 0.5 }));
      (blade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      blade.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(blade);
      o.rotation.y = -a; o.rotation.z = 0.15; o.position.set(Math.cos(a) * 0.72, top * 0.45, Math.sin(a) * 0.72); g.add(o);
    }
  }
  if (c.batter === 1) for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2, d = 0.9 + r() * 0.2;
    const m = new THREE.Mesh(G.spot, mat(UNDER_SPOT[c.done], { opacity: 0.8 }));
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.04 + r() * 0.05); m.position.set(Math.cos(a) * d, 0.012, Math.sin(a) * d); g.add(m);
  }
  return g;
}

/** 盤子（半徑 1.15，配 buildDish） */
let plateGeo: THREE.CylinderGeometry | null = null;
export function buildPlate() {
  plateGeo ??= new THREE.CylinderGeometry(1.2, 1.0, 0.08, 28);
  const m = new THREE.Mesh(plateGeo, mat('#f4f2ec', { rough: 0.35 }));
  m.position.y = -0.04;
  return m;
}

export function disposeDish(g: THREE.Object3D) {
  g.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry;
    if (geo && !Object.values(G).includes(geo as any) && geo !== plateGeo && !ANIM_GEOS.includes(geo)) geo.dispose();
  });
}

/* ───── 縮圖與 3D 檢視（共用一個離屏 renderer；WebGL 失效時改畫 2D 示意圖） ───── */
let R3: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let cam: THREE.PerspectiveCamera | null = null;
let glLost = false, glBroken = false;
const thumbs = new Map<number, string>();

function ensure(size: number) {
  if (glBroken) throw new Error('no webgl');
  if (!R3) {
    const cv = document.createElement('canvas');
    try {
      R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { glBroken = true; throw e; }
    // iOS 同時開太多 WebGL 會把舊的 context 收掉：先畫 2D 圖，恢復後自動回 3D
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); glLost = true; }, false);
    cv.addEventListener('webglcontextrestored', () => { glLost = false; }, false);
    R3.setPixelRatio(1);
    R3.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a93a0, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.45); sun.position.set(2, 4, 3); scene.add(sun);
    // 背光勾邊：放在深色鐵板上也看得清楚輪廓
    const rim = new THREE.DirectionalLight(0xdfeaff, 0.9); rim.position.set(-2.5, 2.2, -3); scene.add(rim);
    cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  }
  if (glLost || R3.getContext().isContextLost()) throw new Error('webgl lost');
  const s = R3.getSize(new THREE.Vector2());
  if (s.x !== size) R3.setSize(size, size, false);
  return { R: R3, S: scene!, C: cam! };
}

/** 翻面姿勢：under＝顯示底面；ang＝繞水平軸轉的角度；lift＝往上拋的高度 */
type Pose = { under: boolean; ang: number; lift: number };

/* ───── 加料／倒粉漿／打蛋動畫（只在煎的預覽用；每幀重建一盤再擺位置） ───── */
/** addTop／remTop：這次加上／拿掉的配料 bit；pour：新倒的粉漿（0＝沒有）；egg：剛加蛋 */
export type DishAnim = {
  addTop: number; remTop: number; pour: number; egg: boolean; ms: number;
  /** 按住倒粉漿時直接指定：攤開程度（0～1）、粉漿柱粗細（0＝沒在倒） */
  spread?: number; stream?: number;
  /** 放開後從這個攤開程度收尾到 1（不再倒） */
  k0?: number;
};
/** 按住倒粉漿：pourFrac（0～1）→ 攤開程度 */
export const pourSpread = (frac: number) => Math.min(1, 0.16 + Math.max(0, frac) * 1.7);
/** 按住倒粉漿時的即時狀態；預覽每幀來問（null＝沒在倒） */
export type LivePour = { frac: number; batter: number; holding: boolean };
let livePour: (() => LivePour | null) | null = null;
export function setLivePour(fn: (() => LivePour | null) | null) { livePour = fn; }
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
function bounce(t: number) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
/** 兩盤之間要播什麼動畫；沒有變化回 null */
export function dishAnimBetween(fromId: number, toId: number): DishAnim | null {
  if (fromId < 0 || fromId === toId) return null;
  const a = comboOf(fromId), b = comboOf(toId);
  if (!a || !b) return null;
  const addTop = b.top & ~a.top, remTop = a.top & ~b.top;
  const pour = b.batter && b.batter !== a.batter ? b.batter : 0;
  const egg = !!b.egg && !a.egg;
  if (!addTop && !remTop && !pour && !egg) return null;
  const ms = pour ? [0, 700, 850, 1000][pour] : egg ? 1300 : 750;
  return { addTop, remTop, pour, egg, ms };
}
const STREAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const LADLE_GEO = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const EGG_GEO = new THREE.SphereGeometry(1, 18, 12);
const SHELL_GEO = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const EGG_SHELL_MAT = new THREE.MeshStandardMaterial({ color: '#efe3cf', roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
const ANIM_GEOS: THREE.BufferGeometry[] = [STREAM_GEO, LADLE_GEO, EGG_GEO, SHELL_GEO];
/** 依動畫進度 t（0～1）擺放這一幀的配料／粉漿／蛋 */
function applyDishAnim(d: THREE.Group, an: DishAnim, t: number) {
  const kids = [...d.children];
  const byPart = new Map<string, THREE.Object3D[]>();
  for (const k of kids) { const p = String(k.userData.part ?? ''); if (!byPart.has(p)) byPart.set(p, []); byPart.get(p)!.push(k); }
  // 配料：加上的從上面掉下來彈一下（一顆顆錯開）；拿掉的往上飄、縮小消失
  for (const bit of [1, 2, 4, 8, 16, 32]) {
    const list = byPart.get('top' + bit); if (!list) continue;
    if (an.addTop & bit) list.forEach((o, i) => {
      const u = clamp01((t - (i / list.length) * 0.35) / 0.6);
      if (u <= 0) { o.visible = false; return; }
      o.position.y += (1 - bounce(u)) * 0.75;
      if (bit === 1) {
        // 蚵：多跳兩下，落地冒「啾」
        o.position.y += Math.abs(Math.sin(u * Math.PI * 2.4)) * (1 - u) * 0.28;
        o.rotation.y += (1 - u) * 1.2;
        if (i === 0 && u > 0.18 && u < 0.9) {
          const ch = chirpSprite();
          ch.position.set(o.position.x, o.position.y + 0.28, o.position.z);
          (ch.material as THREE.SpriteMaterial).opacity = Math.sin((u - 0.18) / 0.72 * Math.PI);
          d.add(ch);
        }
      } else if (bit === 4) {
        // 花枝圈滾進來
        o.rotation.x += (1 - u) * Math.PI * 2;
        o.position.x += (1 - u) * 0.28;
        o.position.z += Math.sin((1 - u) * Math.PI) * 0.08;
      } else if (bit === 32) {
        // 韭菜像頭髮一樣豎起來
        const stand = easeOut(u);
        o.rotation.z = o.rotation.z * stand + 0.2;
        o.rotation.x *= stand;
        o.scale.y *= 0.35 + 0.65 * stand;
        o.position.y += (1 - stand) * 0.08;
      } else if (bit === 16) {
        // 豬肉絲捲成八字鬍
        const curl = easeOut(u);
        const side = o.position.x >= 0 ? 1 : -1;
        o.rotation.z += side * curl * 0.95;
        o.rotation.y += (1 - curl) * 0.8;
        o.position.z *= 0.35 + 0.65 * curl;
        o.position.y += Math.abs(o.position.x) * 0.1 * curl;
      } else {
        o.rotation.y += (1 - u) * 1.5;
      }
    });
    else if (an.remTop & bit) list.forEach((o, i) => {
      const u = easeOut(clamp01((t - (i / list.length) * 0.2) / 0.7));
      o.position.y += u * 0.45; o.scale.multiplyScalar(Math.max(0.001, 1 - u));
      if (u >= 1) o.visible = false;
    });
  }
  // 粉漿：杓子倒下來一道粉漿，從中間往外攤開到該有的厚度（厚實攤得慢、薄脆攤得快又大）
  if (an.pour) {
    const list = byPart.get('batter') ?? [];
    const sp = an.spread ?? (an.k0 != null ? an.k0 + (1 - an.k0) * easeOut(clamp01(t)) : easeOut(clamp01((t - 0.12) / 0.78)));
    const k = 0.12 + 0.88 * sp, ky = 0.25 + 0.75 * sp;
    if (list.length) {
      const grp = new THREE.Group(); grp.scale.set(k, ky, k);
      for (const o of list) { d.remove(o); grp.add(o); }
      d.add(grp);
      // 粉漿攤開時，上面的配料也跟著往外推一點
      for (const bit of [1, 2, 4, 8, 16, 32]) for (const o of byPart.get('top' + bit) ?? []) { o.position.x *= 0.55 + 0.45 * sp; o.position.z *= 0.55 + 0.45 * sp; }
    }
    const pourT = an.stream ?? (an.k0 != null ? 0 : clamp01(1 - (t - 0.05) / 0.6));
    if (pourT > 0) {
      const col = BATTER_COL[0], rad = [0, 0.035, 0.05, 0.07][an.pour];
      const top = 1.25, len = top * (an.stream != null ? 1 : Math.min(1, t / 0.12 + 0.1));
      const stream = new THREE.Mesh(STREAM_GEO, mat(col, { opacity: 0.9, rough: 0.35 }));
      stream.scale.set(rad * pourT + 0.006, len, rad * pourT + 0.006);
      stream.position.set(0, top - len / 2, 0); d.add(stream);
      const ladle = new THREE.Mesh(LADLE_GEO, mat('#9aa3ab', { rough: 0.3 }));
      ladle.scale.set(0.2, 0.13, 0.2); ladle.rotation.z = -0.9 * (an.stream != null ? 1 : Math.min(1, t / 0.15 + 0.3));
      ladle.position.set(0.12, top + 0.06, 0); d.add(ladle);
    }
  }
  // 蛋：一顆蛋在鐵板上方敲一下、殼裂成兩半，蛋黃連蛋白掉下來，再在粉漿上攤開
  if (an.egg) {
    const list = byPart.get('egg') ?? [];
    const H = 0.72, top = 0.1;
    // 蛋片：落地後從中間往外攤開
    const sp = easeOut(clamp01((t - 0.5) / 0.45));
    if (list.length) {
      if (sp <= 0) list.forEach(o => { o.visible = false; });
      else {
        const grp = new THREE.Group(); grp.scale.set(0.15 + 0.85 * sp, 1, 0.15 + 0.85 * sp);
        for (const o of list) { d.remove(o); grp.add(o); }
        d.add(grp);
      }
    }
    // 整顆蛋：降下來、輕敲兩下
    if (t < 0.34) {
      const u = easeOut(clamp01(t / 0.18));
      const egg = new THREE.Mesh(EGG_GEO, EGG_SHELL_MAT);
      const knock = t > 0.18 ? Math.sin(((t - 0.18) / 0.16) * Math.PI * 2) * 0.05 : 0;
      egg.scale.set(0.16, 0.205, 0.16); egg.rotation.z = 0.5 + knock * 3;
      egg.position.set(0.04, H + 0.35 * (1 - u) - Math.abs(knock), 0); d.add(egg);
    } else {
      // 殼裂開：兩半往左右翻開，之後往上收走
      const u = easeOut(clamp01((t - 0.34) / 0.2)), out = clamp01((t - 0.62) / 0.25);
      if (out < 1) for (const s of [-1, 1]) {
        const half = new THREE.Mesh(SHELL_GEO, EGG_SHELL_MAT);
        const k = 1 - out;
        half.scale.set(0.16 * k, 0.2 * k, 0.16 * k);
        half.rotation.set(0, 0, s > 0 ? -Math.PI / 2 - u * 0.9 : Math.PI / 2 + u * 0.9);
        half.position.set(0.04 + s * (0.03 + u * 0.2), H + u * 0.06 + out * 0.3, 0); d.add(half);
      }
      // 蛋黃＋蛋白往下掉，落到粉漿上就變成蛋片
      const f = clamp01((t - 0.36) / 0.16);
      if (f < 1) {
        const y = H - (H - top) * f * f;
        const white = new THREE.Mesh(EGG_GEO, mat('#f6f3ea', { opacity: 0.82, rough: 0.25 }));
        white.scale.set(0.12 - f * 0.02, 0.08 + f * 0.1, 0.12 - f * 0.02); white.position.set(0.04, y + 0.02, 0); d.add(white);
        const yolk = new THREE.Mesh(EGG_GEO, mat('#f2b22a', { rough: 0.35 }));
        yolk.scale.setScalar(0.075); yolk.position.set(0.04, y, 0); d.add(yolk);
      } else if (sp < 0.35) {
        // 剛落地：一灘蛋白＋蛋黃，馬上攤開
        const w = 1 + sp * 4;
        const white = new THREE.Mesh(EGG_GEO, mat('#f6f3ea', { opacity: 0.85, rough: 0.25 }));
        white.scale.set(0.13 * w, 0.025, 0.13 * w); white.position.set(0.04, top + 0.02, 0); d.add(white);
        const yolk = new THREE.Mesh(EGG_GEO, mat('#f2b22a', { rough: 0.35 }));
        yolk.scale.set(0.065, 0.04, 0.065); yolk.position.set(0.04, top + 0.04, 0); d.add(yolk);
      }
    }
  }
}

function shoot(id: number, size: number, yaw: number, pitch: number, combo?: Combo, plate = true, pose?: Pose, anim?: { an: DishAnim; t: number }) {
  const { R, S, C } = ensure(size);
  const holder = new THREE.Group();
  // 拿掉配料的動畫：先用「舊配料＋新的」那盤畫，讓被拿掉的慢慢消失
  const base = combo ?? comboOf(id);
  const animCombo = anim && anim.an.remTop && base ? { ...base, top: base.top | anim.an.remTop } : combo;
  const d = pose?.under ? buildUnder(id, combo) : buildDish(id, animCombo);
  if (anim && !pose?.under) applyDishAnim(d, anim.an, anim.t);
  if (pose && (pose.ang || pose.lift)) {
    const pv = new THREE.Group(); pv.position.y = 0.08 + pose.lift; pv.rotation.x = pose.ang;
    d.position.y = -0.08; pv.add(d); holder.add(pv);
  } else holder.add(d);
  if (plate) holder.add(buildPlate());
  holder.rotation.y = yaw;
  S.add(holder);
  const dist = 4.5;
  C.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  C.lookAt(0, 0.05, 0);
  R.setClearColor(0x000000, 0);
  try { R.render(S, C); } finally { S.remove(holder); disposeDish(holder); }
  return R.domElement;
}

/** WebGL 不能用時的 2D 示意圖：盤子＋粉漿＋蛋＋配料點點 */
function draw2D(ctx: CanvasRenderingContext2D, W: number, id: number, combo?: Combo, under = false) {
  const raw = combo ?? comboOf(id); if (!raw) return;
  const c = { ...raw }, r = rng(id + 17 + (under ? 7919 : 0));
  if (under && c.batter) { c.top = 0; c.egg = 0; c.sauce = 0; }
  const cx = W / 2, cy = W * 0.54;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx, cy + W * 0.05, W * 0.44, W * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4f2ec'; ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = Math.max(1, W / 160);
  ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.43, W * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (c.batter) {
    ctx.fillStyle = (under ? UNDER_COL : BATTER_COL)[c.done]; ctx.strokeStyle = (under ? UNDER_SPOT : EDGE_COL)[c.done];
    if (!under && isTower(c)) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i === 3 ? BATTER_COL[c.done] : EDGE_COL[c.done];
        const ox = (i % 2 ? 1 : -1) * W * 0.03 * i, oy = -W * (0.015 + i * 0.055);
        ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, W * (0.33 - i * 0.03), W * 0.1, (i % 2 ? 1 : -1) * 0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (!under && blooperOf(c) === 'lonely') {
      ctx.beginPath();
      const s = W * 0.009;
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const x = cx + s * 16 * Math.pow(Math.sin(a), 3);
        const y = cy + s * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * -0.7 - W * 0.02;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(cx, cy - W * 0.015, W * 0.33, W * 0.145, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  if (c.egg) {
    ctx.fillStyle = '#f6d24a';
    if (blooperOf(c) === 'egg') {
      ctx.fillStyle = '#fbf3d6';
      ctx.beginPath(); ctx.ellipse(cx, cy - W * 0.02, W * 0.2, W * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eebd3c';
      ctx.beginPath(); ctx.ellipse(cx - W * 0.07, cy - W * 0.05, W * 0.035, W * 0.028, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + W * 0.07, cy - W * 0.05, W * 0.035, W * 0.028, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d79a33'; ctx.lineWidth = Math.max(1.5, W / 80); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy + W * 0.02, W * 0.08, 0.15, Math.PI - 0.15); ctx.stroke();
    } else {
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * W * 0.4, cy + (r() - 0.5) * W * 0.16, W * 0.05, W * 0.025, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  if (c.sauce) {
    ctx.fillStyle = SAUCE_COL[c.sauce];
    ctx.beginPath(); ctx.ellipse(cx, cy - W * 0.01, W * (c.batter ? 0.22 : 0.15), W * (c.batter ? 0.095 : 0.065), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - W * 0.06, cy - W * 0.04, W * 0.06, W * 0.015, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  const tc = ['#9a9a8a', '#f19a8a', '#f3efe6', '#4f9a3c', '#c4784a', '#3d8c3a'];
  for (let b = 0; b < 6; b++) if (c.top & (1 << b)) {
    if (b === 3) { // 小白菜：大葉＋白綠梗
      for (let i = 0; i < 5; i++) {
        const x = cx + (r() - 0.5) * W * 0.5, y = cy + (r() - 0.5) * W * 0.2, ang = r() * Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = '#e3efcf'; ctx.fillRect(-W * 0.05, -W * 0.008, W * 0.06, W * 0.016);
        ctx.fillStyle = i % 2 ? '#3a8a2e' : '#78b85a'; ctx.beginPath(); ctx.ellipse(W * 0.06, 0, W * 0.07, W * 0.03, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      continue;
    }
    if (b === 4) { // 豬肉絲：短褐條
      for (let i = 0; i < 8; i++) {
        const x = cx + (r() - 0.5) * W * 0.5, y = cy + (r() - 0.5) * W * 0.2, ang = r() * Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = i % 2 ? '#8a4a28' : '#c4784a';
        ctx.fillRect(-W * 0.055, -W * 0.007, W * 0.11, W * 0.014);
        ctx.restore();
      }
      continue;
    }
    if (b === 5) { // 韭菜：細長葉
      for (let i = 0; i < 7; i++) {
        const x = cx + (r() - 0.5) * W * 0.5, y = cy + (r() - 0.5) * W * 0.2, ang = r() * Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = i % 2 ? '#245a22' : '#4a9a3c';
        ctx.lineWidth = Math.max(1.2, W / 90); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-W * 0.09, 0); ctx.quadraticCurveTo(0, W * 0.02, W * 0.1, 0); ctx.stroke();
        ctx.restore();
      }
      continue;
    }
    ctx.fillStyle = tc[b];
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * W * 0.46, cy + (r() - 0.5) * W * 0.18, W * 0.035, W * 0.02, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const bk = blooperOf(c);
  if (!under && (bk === 'ketchup' || bk === 'stirburn')) {
    ctx.strokeStyle = 'rgba(90,50,30,.65)'; ctx.lineWidth = Math.max(1.2, W / 100);
    for (let i = 0; i < 4; i++) {
      const x = cx + (r() - 0.5) * W * 0.35, y = cy + (r() - 0.5) * W * 0.12;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * W * 0.18, y + (r() - 0.5) * W * 0.08); ctx.stroke();
    }
  }
  ctx.restore();
}

/** 縮圖 dataURL（記憶體快取） */
export function dishThumb(id: number): string {
  const hit = thumbs.get(id); if (hit) return hit;
  try {
    const url = shoot(id, 128, 0.5, 0.95).toDataURL('image/png');
    thumbs.set(id, url);
    return url;
  } catch {
    try { const cv = document.createElement('canvas'); cv.width = cv.height = 128; draw2D(cv.getContext('2d')!, 128, id); return cv.toDataURL('image/png'); } catch { return ''; }
  }
}

/**
 * 可拖曳旋轉的 3D 檢視；回傳 stop()。
 * 掛上時立刻同步畫一次（不等 rAF）；跟著顯示大小調解析度；WebGL 掉了就畫 2D 圖。
 */
export type ViewerOpts = {
  /** 自動慢慢轉（預設會轉；煎的過程中關掉） */
  spin?: boolean;
  /** 顯示底面（翻面後） */
  under?: boolean;
  /** 掛上時先播一次翻面動畫（從另一面翻過來） */
  flipIn?: boolean;
  /** 幾毫秒後才開始自動轉（起鍋特效播完） */
  spinAfter?: number;
  /** 從這一盤變過來：播加料／倒粉漿／打蛋動畫（點一下預覽就跳過） */
  animFrom?: number;
  /** 剛放開倒粉漿：從這個攤開程度收尾（不重播整段倒的動畫） */
  pourSettle?: number;
  /** 起鍋時播鍋鏟拋接；偶爾會先黏在天花板再掉回盤上（純視覺，盤子不會沒） */
  flourish?: boolean;
};
let chirpTex: THREE.CanvasTexture | null = null;
let chirpMat: THREE.SpriteMaterial | null = null;
function chirpSprite() {
  if (!chirpTex) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.font = '700 44px "Noto Sans TC","Source Han Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = '#fff'; c.lineWidth = 8; c.lineJoin = 'round';
    c.strokeText('啾', 64, 34);
    c.fillStyle = '#2a5a86'; c.fillText('啾', 64, 34);
    chirpTex = new THREE.CanvasTexture(cv);
    chirpMat = new THREE.SpriteMaterial({ map: chirpTex, transparent: true, depthTest: false });
  }
  const s = new THREE.Sprite(chirpMat!);
  s.scale.set(0.5, 0.25, 1);
  return s;
}

function shootPlate(size: number): HTMLCanvasElement {
  const { R, S, C } = ensure(size);
  const holder = new THREE.Group();
  holder.add(buildPlate());
  S.add(holder);
  C.position.set(0, Math.sin(0.95) * 4.5, Math.cos(0.95) * 4.5);
  C.lookAt(0, 0.05, 0);
  R.setClearColor(0x000000, 0);
  try { R.render(S, C); } finally { S.remove(holder); disposeDish(holder); }
  return R.domElement;
}

function drawSpatula(ctx: CanvasRenderingContext2D, W: number, x: number, y: number, ang: number) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const lw = Math.max(1.6, W / 90);
  ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a5560'; ctx.fillStyle = '#9aa3ab';
  ctx.beginPath();
  ctx.roundRect(-W * 0.022, 0, W * 0.044, W * 0.36, 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b7bec4';
  ctx.beginPath();
  ctx.roundRect(-W * 0.11, -W * 0.045, W * 0.22, W * 0.09, 8);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const FLIP_MS = 420;
export function mountDishViewer(canvas: HTMLCanvasElement, id: number, combo?: Combo, opts: ViewerOpts = {}): () => void {
  const ctx = canvas.getContext('2d'); if (!ctx) return () => {};
  const under = !!opts.under;
  let yaw = 0.6, pitch = 0.85, drag = false, lx = 0, ly = 0, idle = opts.spin !== false, raf = 0, dirty = true, stopped = false;
  let flipT0 = opts.flipIn ? performance.now() : 0;
  const flourishMiss = !!(opts.flourish && !reduceMotion() && Math.random() < 0.12);
  let flourishT0 = opts.flourish && !reduceMotion() ? performance.now() : 0;
  const FLOURISH_MS = flourishMiss ? 2800 : 1600;
  const spinAt = performance.now() + Math.max(opts.spinAfter ?? 0, flourishT0 ? FLOURISH_MS : 0);
  const an: DishAnim | null = under || reduceMotion() ? null
    : opts.pourSettle != null && comboOf(id)?.batter ? { addTop: 0, remTop: 0, pour: comboOf(id)!.batter, egg: false, ms: 320, k0: Math.min(1, Math.max(0, opts.pourSettle)) }
    : opts.animFrom != null ? dishAnimBetween(opts.animFrom, id) : null;
  let animT0 = an ? performance.now() : 0;
  const animNow = () => {
    if (!an || !animT0) return undefined;
    const t = (performance.now() - animT0) / an.ms;
    if (t >= 1) { animT0 = 0; return undefined; }
    return { an, t };
  };
  /** 翻面動畫：前半段舊的那面轉到立起來，後半段換新的那面落下 */
  const pose = (): Pose | undefined => {
    if (!flipT0) return under ? { under: true, ang: 0, lift: 0 } : undefined;
    const t = Math.min(1, (performance.now() - flipT0) / FLIP_MS);
    if (t >= 1) { flipT0 = 0; return under ? { under: true, ang: 0, lift: 0 } : undefined; }
    const lift = Math.sin(t * Math.PI) * 0.55;
    return t < 0.5 ? { under: !under, ang: t * Math.PI, lift } : { under, ang: (t - 1) * Math.PI, lift };
  };
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const px = Math.max(128, Math.min(640, Math.round(Math.min(w, h) * Math.min(2, window.devicePixelRatio || 1))));
    if (canvas.width !== px || canvas.height !== px) { canvas.width = canvas.height = px; dirty = true; }
  };
  const paint = () => {
    dirty = false;
    const W = canvas.width;
    ctx.clearRect(0, 0, W, canvas.height);
    const p = pose();
    // 按住倒粉漿：照目前倒了多少即時畫（杓子倒、粉漿柱、慢慢攤開）
    const lp = !under ? livePour?.() : null;
    if (lp && lp.batter > 0) {
      const sp = pourSpread(lp.frac);
      const live: DishAnim = { addTop: 0, remTop: 0, pour: lp.batter, egg: false, ms: 1, spread: reduceMotion() ? 1 : sp, stream: lp.holding ? 1 : 0 };
      const liveCombo = combo ?? comboOf(id);
      if (!liveCombo) { draw2D(ctx, W, id, combo, false); return; }
      try { ctx.drawImage(shoot(id, W, yaw, pitch, { ...liveCombo, batter: lp.batter }, true, p, { an: live, t: 0.5 }), 0, 0, W, canvas.height); }
      catch { draw2D(ctx, W, id, combo, false); }
      return;
    }
    const ft = flourishT0 ? Math.min(1, (performance.now() - flourishT0) / FLOURISH_MS) : 1;
    if (flourishT0 && ft >= 1) flourishT0 = 0;
    try {
      if (flourishT0) {
        const dish = shoot(id, W, yaw, pitch, combo, false, p, animNow());
        try { ctx.drawImage(shootPlate(W), 0, 0, W, canvas.height); } catch { /* 盤子畫不出來就只拋料理 */ }
        let dy = 0, rot = 0, spatX = W * 0.78, spatY = W * 0.72, spatA = -0.6;
        if (!flourishMiss) {
          const up = easeOut(clamp01(ft / 0.42));
          const down = easeOut(clamp01((ft - 0.42) / 0.28));
          const toss = ft < 0.42 ? up : Math.max(0, 1 - down);
          dy = -Math.sin(toss * Math.PI) * W * 0.28;
          rot = toss * 0.9;
          spatX = W * (0.82 - 0.2 * Math.min(1, ft / 0.2));
          spatY = W * 0.7 - toss * W * 0.22;
          spatA = -0.7 + toss * 0.9;
          if (ft > 0.75) { const k = (ft - 0.75) / 0.25; spatX += k * W * 0.3; spatY += k * W * 0.1; }
        } else {
          const up = easeOut(clamp01(ft / 0.32));
          const hang = ft >= 0.32 && ft < 0.68;
          const down = easeOut(clamp01((ft - 0.68) / 0.24));
          const air = ft < 0.32 ? up : hang ? 1 : Math.max(0, 1 - down);
          dy = -air * W * 0.46 - (hang ? Math.sin(ft * 18) * W * 0.008 : 0);
          rot = air * 0.35 + (hang ? Math.sin(ft * 14) * 0.06 : 0);
          spatX = W * (0.82 - 0.18 * Math.min(1, ft / 0.2));
          spatY = W * 0.7 - Math.min(1, ft / 0.32) * W * 0.2;
          spatA = -0.7 + Math.min(1, ft / 0.32) * 0.5;
          if (ft > 0.85) { const k = (ft - 0.85) / 0.15; spatX += k * W * 0.3; }
        }
        ctx.save();
        ctx.translate(0, dy);
        ctx.translate(W / 2, W * 0.54);
        ctx.rotate(rot);
        ctx.translate(-W / 2, -W * 0.54);
        ctx.drawImage(dish, 0, 0, W, canvas.height);
        ctx.restore();
        if (ft < 0.95) drawSpatula(ctx, W, spatX, spatY, spatA);
      } else {
        ctx.drawImage(shoot(id, W, yaw, pitch, combo, true, p, animNow()), 0, 0, W, canvas.height);
      }
    } catch { draw2D(ctx, W, id, combo, p?.under ?? false); }
  };
  const draw = () => {
    if (stopped) return;
    if (!canvas.isConnected) { stop(); return; }
    raf = requestAnimationFrame(draw);
    if (idle && performance.now() >= spinAt) { yaw += 0.006; dirty = true; }
    if (flipT0) dirty = true;
    if (flourishT0) dirty = true;
    if (animT0 || livePour) dirty = true;
    if (dirty) paint();
  };
  const down = (e: PointerEvent) => { if (animT0) { animT0 = 0; dirty = true; } if (flourishT0) { flourishT0 = 0; dirty = true; } drag = true; idle = false; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (!drag) return; yaw += (e.clientX - lx) * 0.012; pitch = Math.max(0.25, Math.min(1.45, pitch + (e.clientY - ly) * 0.008)); lx = e.clientX; ly = e.clientY; dirty = true; };
  const up = () => { drag = false; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.style.touchAction = 'none';
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { fit(); if (dirty && !stopped) paint(); }) : null;
  ro?.observe(canvas);
  fit(); paint(); draw();
  function stop() {
    stopped = true; cancelAnimationFrame(raf); ro?.disconnect();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
  }
  return stop;
}
