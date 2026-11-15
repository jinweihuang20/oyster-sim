/**
 * 蚵仔煎程序化模型：一個產生器涵蓋 2,304 種組合（同一 id 一定長一樣）。
 * 單位：半徑 1；放到世界時自行縮放（盤上約 0.13）。
 */
import * as THREE from 'three';
import { comboOf, type Combo } from './combo';

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
  spot: new THREE.CircleGeometry(1, 10),
};

const BATTER_COL = ['#efe5c8', '#ddb062', '#ad6d33'];
const EDGE_COL = ['#e6d6ae', '#c58a3c', '#6e3f1c'];
const SAUCE_COL = ['', '#e0566e', '#4a2b1d', '#cf2a22', '#a8572a', '#d8a21c'];
const EGG_Y = ['#f6d35a', '#eebd3c', '#d79a33'];

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

/** 產生一盤蚵仔煎（Group，底面在 y=0） */
export function buildDish(id: number, combo?: Combo): THREE.Group {
  const c = combo ?? comboOf(id);
  const r = rng(id + 17);
  const g = new THREE.Group();
  const H = [0, 0.05, 0.085, 0.14][c.batter];
  let top = 0.02;
  const loose = c.batter === 0;
  if (!loose) {
    const shape = blobOutline(r, c.batter === 1 ? 0.95 : 0.88, 32, c.batter === 1 ? 0.14 : 0.08);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: H * 0.35, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    const base = new THREE.Mesh(geo, mat(BATTER_COL[c.done], { rough: c.batter === 1 ? 0.5 : 0.75 }));
    base.position.y = H * 0.35;
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
    const edge = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(rng(id + 3), c.batter === 1 ? 0.97 : 0.9, 32, 0.08), 4), mat(EDGE_COL[c.done], { opacity: [0.25, 0.55, 0.85][c.done] }));
    edge.rotation.x = -Math.PI / 2; edge.position.y = top - 0.004; g.add(edge);
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(blobOutline(rng(id + 5), [0.8, 0.72, 0.62][c.done], 28, 0.1), 4), mat(BATTER_COL[c.done]));
    inner.rotation.x = -Math.PI / 2; inner.position.y = top - 0.002; g.add(inner);
    const spots = [3, 9, 18][c.done];
    for (let i = 0; i < spots; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
      const m = new THREE.Mesh(G.spot, mat(EDGE_COL[Math.min(2, c.done + 1)], { opacity: 0.7 }));
      m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.03 + r() * 0.05);
      m.position.set(Math.cos(a) * d, top, Math.sin(a) * d); g.add(m);
    }
  }
  // 蛋
  if (c.egg) {
    const n = loose ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (loose ? 0.5 : 0.6);
      const white = r() < 0.4;
      const m = new THREE.Mesh(G.blob, mat(white ? '#fbf5e3' : EGG_Y[c.done]));
      const s = loose ? 0.1 + r() * 0.08 : 0.18 + r() * 0.12;
      m.scale.set(s, loose ? s * 0.6 : 0.025, s * (0.7 + r() * 0.4));
      m.position.set(Math.cos(a) * d, top + (loose ? s * 0.3 : 0.004), Math.sin(a) * d);
      m.rotation.y = r() * Math.PI;
      g.add(m);
    }
    if (!loose) top += 0.02;
  }
  // 配料
  const R = loose ? 0.55 : 0.72;
  const place = (m: THREE.Object3D, lift: number) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
    m.position.set(Math.cos(a) * d, top + lift + (loose ? r() * 0.08 : 0), Math.sin(a) * d);
    m.rotation.y = r() * Math.PI * 2;
    g.add(m);
  };
  if (c.top & 1) for (let i = 0; i < 7; i++) {
    const o = new THREE.Group();
    const body = new THREE.Mesh(G.oy, mat(c.done === 2 ? '#a89c84' : '#c4bba5', { rough: 0.35 }));
    body.scale.set(0.12, 0.045, 0.085); o.add(body);
    const frill = new THREE.Mesh(G.oy, mat('#5e5a52', { rough: 0.4 }));
    frill.scale.set(0.06, 0.03, 0.05); frill.position.set(0.06, 0.012, 0); o.add(frill);
    place(o, 0.03);
  }
  if (c.top & 2) for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(G.shrimp, mat(c.done === 0 ? '#f39a7c' : '#ec7a52', { rough: 0.45 }));
    m.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(m); place(o, 0.035);
  }
  if (c.top & 4) for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(G.squid, mat(c.done === 2 ? '#eadfc8' : '#f6f1e6', { rough: 0.4 }));
    m.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(m); place(o, 0.025);
  }
  if (c.top & 8) for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(G.leaf, mat(c.done === 2 ? '#3f7a2c' : '#4f9a3a', { rough: 0.6 }));
    (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    m.rotation.x = -Math.PI / 2 + (r() - 0.5) * 0.5; const o = new THREE.Group(); o.add(m); place(o, 0.02);
  }
  // 醬：之字淋上
  if (c.sauce) {
    const pts: THREE.Vector3[] = [];
    const rows = 5, w = loose ? 0.55 : 0.75, y = top + 0.07;
    const rot = r() * Math.PI;
    for (let i = 0; i <= rows * 6; i++) {
      const t = i / (rows * 6);
      const z = -w + t * 2 * w;
      const x = Math.sin(t * rows * Math.PI) * Math.sqrt(Math.max(0, w * w - z * z)) * 0.95;
      pts.push(new THREE.Vector3(x * Math.cos(rot) - z * Math.sin(rot), y, x * Math.sin(rot) + z * Math.cos(rot)));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, c.sauce === 2 ? 0.022 : 0.03, 5), mat(SAUCE_COL[c.sauce], { rough: 0.25 }));
    g.add(tube);
    if (!loose) {
      const glaze = new THREE.Mesh(G.spot, mat(SAUCE_COL[c.sauce], { opacity: 0.18 }));
      glaze.rotation.x = -Math.PI / 2; glaze.scale.setScalar(0.7); glaze.position.y = top + 0.001; g.add(glaze);
    }
  }
  g.userData.dishId = id;
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
    if (geo && !Object.values(G).includes(geo as any) && geo !== plateGeo) geo.dispose();
  });
}

/* ───── 縮圖與 3D 檢視（共用一個離屏 renderer） ───── */
let R3: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let cam: THREE.PerspectiveCamera | null = null;
const thumbs = new Map<number, string>();

function ensure(size: number) {
  if (!R3) {
    const cv = document.createElement('canvas');
    R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    R3.setPixelRatio(1);
    R3.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6a7380, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2, 4, 3); scene.add(sun);
    cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  }
  const s = R3.getSize(new THREE.Vector2());
  if (s.x !== size) R3.setSize(size, size, false);
  return { R: R3, S: scene!, C: cam! };
}

function shoot(id: number, size: number, yaw: number, pitch: number, combo?: Combo, plate = true) {
  const { R, S, C } = ensure(size);
  const holder = new THREE.Group();
  const d = buildDish(id, combo); holder.add(d);
  if (plate) holder.add(buildPlate());
  holder.rotation.y = yaw;
  S.add(holder);
  const dist = 4.6;
  C.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  C.lookAt(0, 0.05, 0);
  R.setClearColor(0x000000, 0);
  R.render(S, C);
  S.remove(holder); disposeDish(holder);
  return R.domElement;
}

/** 縮圖 dataURL（記憶體快取） */
export function dishThumb(id: number): string {
  const hit = thumbs.get(id); if (hit) return hit;
  try {
    const url = shoot(id, 128, 0.5, 0.95).toDataURL('image/png');
    thumbs.set(id, url);
    return url;
  } catch { return ''; }
}

/** 可拖曳旋轉的 3D 檢視；回傳 stop() */
export function mountDishViewer(canvas: HTMLCanvasElement, id: number, combo?: Combo): () => void {
  const ctx = canvas.getContext('2d'); if (!ctx) return () => {};
  let yaw = 0.6, pitch = 0.85, drag = false, lx = 0, ly = 0, idle = true, raf = 0, dirty = true;
  const size = 256;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    if (idle) { yaw += 0.006; dirty = true; }
    if (!dirty) return; dirty = false;
    const src = shoot(id, size, yaw, pitch, combo);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  };
  const down = (e: PointerEvent) => { drag = true; idle = false; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (!drag) return; yaw += (e.clientX - lx) * 0.012; pitch = Math.max(0.25, Math.min(1.45, pitch + (e.clientY - ly) * 0.008)); lx = e.clientX; ly = e.clientY; dirty = true; };
  const up = () => { drag = false; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.style.touchAction = 'none';
  draw();
  return () => { cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); };
}
