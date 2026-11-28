/**
 * 出海採蚵的場景模型：海面（波浪、深淺色、淺灘、泡沫）、膠筏、蚵棚竹架、碼頭、水花／航跡。
 * 手機效能：海面一個 shader、竹竿／蚵串／木板都用 instancing 或合併幾何，沒有後製。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEA, type Layout, type Str } from './seaLogic';

const ACC = 0x2a5a86;
export const SUN = new THREE.Vector3(30, 60, 20).normalize();
export const SKY = new THREE.Color(0xcfe6f2);
const lam = (c: number, o: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

// ---------- 高度圖：R＝海底高度（淺灘、沙洲），G＝竹架邊泡沫 ----------
/** 地圖範圍（世界座標） */
export const MAP = { x0: -100, z0: -150, w: 200, h: 240 };
export function makeHeightMap(L: Layout, rng: () => number) {
  const W = 400, H = 480, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const px = (x: number) => (x - MAP.x0) / MAP.w * W, pz = (z: number) => (z - MAP.z0) / MAP.h * H, k = W / MAP.w;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighten';
  const blob = (x: number, z: number, r: number, top: number, ch: 'r' | 'g') => {
    const g = c.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), r * k);
    const v = Math.round(top * 255);
    g.addColorStop(0, ch === 'r' ? `rgb(${v},0,0)` : `rgb(0,${v},0)`); g.addColorStop(1, 'rgb(0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(px(x), pz(z), r * k, 0, Math.PI * 2); c.fill();
  };
  // 淺灘：中心 1，往外線性降到 0（半徑 r0 × shoalFall）；跟 seaLogic 的 shoalR 對得上
  for (const s of L.shoals) blob(s.x, s.z, s.r0 * SEA.shoalFall, 1, 'r');
  // 沙洲本體（碼頭南邊），邊緣用一串圓弄出不規則
  for (let x = -110; x <= 110; x += 9) blob(x, 19 + rng() * 5, 15 + rng() * 6, 1, 'r');
  c.fillStyle = 'rgb(255,0,0)'; c.fillRect(0, pz(30), W, H);
  // 外海側小沙丘
  for (let i = 0; i < 5; i++) blob(-90 + rng() * 180, 8 + rng() * 4, 5 + rng() * 4, 0.9, 'r');
  // 竹架周圍泡沫
  for (const r of L.rows) {
    const n = Math.max(2, Math.ceil(Math.hypot(r.bx - r.ax, r.bz - r.az) / 3.2)) + 1;
    for (let i = 0; i < n; i++) { const f = i / (n - 1); blob(r.ax + (r.bx - r.ax) * f, r.az + (r.bz - r.az) * f, 1.6, 0.9, 'g'); }
  }
  blob(SEA.dock.x, SEA.dock.z + 3, 3, 0.7, 'g');
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
/** 退潮 ebb 時，高度超過多少算露出水面（對應 shoalR） */
export const sandLevel = (ebb: number) => 1 - (1 + SEA.shoalGrow * ebb) / SEA.shoalFall;

const WATER_VS = /* glsl */`
uniform float uTime, uHt; uniform sampler2D uMap; uniform vec4 uRect;
varying vec3 vW; varying vec3 vN; varying float vDepth;
float wv(vec2 p, float t){ return 0.07*sin(dot(p,vec2(0.23,0.11))+t*1.25)+0.045*sin(dot(p,vec2(-0.13,0.31))+t*1.65)+0.025*sin(dot(p,vec2(0.47,-0.29))+t*2.4)+0.015*sin(dot(p,vec2(-0.61,-0.52))+t*3.1); }
void main(){
  vec4 wp = modelMatrix*vec4(position,1.0);
  vec2 uv = (wp.xz-uRect.xy)/uRect.zw;
  float above = texture2D(uMap, uv).r - uHt;
  float sea = 1.0 - smoothstep(-0.06, 0.0, above);
  float y = wv(wp.xz, uTime), e = 0.5;
  float hx = wv(wp.xz+vec2(e,0.0), uTime)-y, hz = wv(wp.xz+vec2(0.0,e), uTime)-y;
  vN = normalize(vec3(-hx/e*sea, 1.0, -hz/e*sea));
  wp.y += y*sea + smoothstep(0.0, 0.08, above)*0.35;
  vW = wp.xyz;
  vec4 mv = viewMatrix*wp; vDepth = -mv.z;
  gl_Position = projectionMatrix*mv;
}`;
const WATER_FS = /* glsl */`
uniform float uTime, uHt, uFogN, uFogF, uNight; uniform sampler2D uMap; uniform vec4 uRect; uniform vec3 uSun, uFogC, uSky, uMoon;
varying vec3 vW; varying vec3 vN; varying float vDepth;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }
void main(){
  vec2 uv = (vW.xz-uRect.xy)/uRect.zw;
  vec4 m = texture2D(uMap, uv);
  float above = m.r - uHt;
  vec3 V = normalize(cameraPosition - vW);
  vec3 col;
  if (above > 0.0) {
    float dry = smoothstep(0.0, 0.08, above);
    float n = vn(vW.xz*2.3)*0.6 + vn(vW.xz*9.0)*0.4;
    float rip = 0.5 + 0.5*sin(vW.x*1.9 + vW.z*0.8 + vn(vW.xz*0.35)*7.0);
    col = mix(vec3(0.56,0.50,0.38), vec3(0.91,0.84,0.66), dry) * (0.88 + 0.16*n) * (0.95 + 0.07*rip*dry) * mix(1.0, 0.36, uNight);
    col += (1.0-dry) * pow(max(dot(reflect(-uSun, vec3(0.0,1.0,0.0)), V), 0.0), 24.0) * 0.45;
    float edge = 1.0 - smoothstep(0.0, 0.014, above);
    col = mix(col, vec3(0.96), edge * 0.7 * smoothstep(0.4, 0.6, vn(vW.xz*3.0 + uTime*0.6)));
  } else {
    float d = -above;
    col = mix(vec3(0.45,0.82,0.78), vec3(0.20,0.58,0.70), smoothstep(0.0, 0.12, d));
    col = mix(col, vec3(0.08,0.31,0.49), smoothstep(0.12, 0.6, d));
    vec3 N = normalize(vN + vec3((vn(vW.xz*1.3 + uTime*0.35)-0.5)*0.3, 0.0, (vn(vW.zx*1.1 - uTime*0.3)-0.5)*0.3));
    col *= 0.78 + 0.22*max(dot(N, uSun), 0.0);
    // 夜晚：水色壓暗偏藍，太陽反光換成月光反射（一條拉長的月光帶）
    col = mix(col, col*vec3(0.30,0.40,0.62), uNight);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    col = mix(col, uSky, fres*0.5);
    col += vec3(1.0,0.96,0.85) * pow(max(dot(reflect(-uSun, N), V), 0.0), 90.0) * 0.85 * (1.0-uNight);
    if (uNight > 0.0) {
      float mr = max(dot(reflect(-uMoon, N), V), 0.0);
      col += vec3(0.78,0.86,1.0) * (pow(mr, 40.0)*0.9 + pow(mr, 6.0)*0.08) * uNight;
    }
    float fn = vn(vW.xz*1.8 + vec2(uTime*0.5, -uTime*0.3));
    float shore = 1.0 - smoothstep(0.0, 0.05, d);
    float band = smoothstep(0.55, 0.75, fn + shore*0.6 - 0.25 + 0.15*sin(d*120.0 - uTime*2.0));
    float foam = shore*band + m.g * smoothstep(0.45, 0.8, vn(vW.xz*4.0 + uTime*0.8));
    col = mix(col, mix(vec3(0.95,0.97,0.97), vec3(0.32,0.40,0.50), uNight), clamp(foam, 0.0, 1.0)*0.85);
  }
  gl_FragColor = vec4(mix(col, uFogC, smoothstep(uFogN, uFogF, vDepth)), 1.0);
}`;
export type WaterOpts = {
  /** 高度圖對應的世界矩形（預設＝出海採蚵的 MAP） */
  rect?: { x0: number; z0: number; w: number; h: number };
  /** 外圈到地平線的大平面；null＝不要 */
  outer?: { x: number; z: number; size: number } | null;
  /** 水面高度（預設 0） */
  y?: number;
  seg?: [number, number];
  /** 外圈地平線海面分段（預設 24；廣場外海可降到 6～8 省 vertex shader） */
  outerSeg?: number;
};
export function makeWater(scene: THREE.Scene | THREE.Object3D, map: THREE.Texture, coarse: boolean, fog: { c: THREE.Color; n: number; f: number }, o: WaterOpts = {}) {
  const R = o.rect ?? MAP, y = o.y ?? 0;
  const mat = new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS,
    uniforms: {
      uTime: { value: 0 }, uHt: { value: sandLevel(0) }, uMap: { value: map }, uRect: { value: new THREE.Vector4(R.x0, R.z0, R.w, R.h) },
      uSun: { value: SUN }, uSky: { value: SKY.clone() }, uFogC: { value: fog.c }, uFogN: { value: fog.n }, uFogF: { value: fog.f },
      uNight: { value: 0 }, uMoon: { value: new THREE.Vector3(-0.5, 0.35, -0.6).normalize() },
    },
  });
  // 預設分段已壓過一輪；呼叫端可再傳 seg（出海／廣場）
  const seg = o.seg ?? (coarse ? [56, 68] : [160, 192]);
  const g = new THREE.PlaneGeometry(R.w, R.h, seg[0], seg[1]); g.rotateX(-Math.PI / 2);
  const inner = new THREE.Mesh(g, mat); inner.position.set(R.x0 + R.w / 2, y, R.z0 + R.h / 2); scene.add(inner);
  const oo = o.outer === undefined ? { x: 0, z: -60, size: 900 } : o.outer;
  let outer: THREE.Mesh | null = null;
  if (oo) {
    const os = Math.max(2, o.outerSeg ?? 24);
    const og = new THREE.PlaneGeometry(oo.size, oo.size, os, os); og.rotateX(-Math.PI / 2);
    outer = new THREE.Mesh(og, mat); outer.position.set(oo.x, y - 0.25, oo.z); scene.add(outer);
  }
  return {
    mat, inner, outer,
    set(t: number, ebb: number) { mat.uniforms.uTime.value = t; mat.uniforms.uHt.value = sandLevel(ebb); },
    /** 夜晚 0→1：水色壓暗、月光反射；sky＝反射用的天色 */
    setNight(k: number, sky?: THREE.Color) { mat.uniforms.uNight.value = k; if (sky) (mat.uniforms.uSky.value as THREE.Color).copy(sky); },
    setFog(c: THREE.Color, n: number, f: number) { (mat.uniforms.uFogC.value as THREE.Color).copy(c); mat.uniforms.uFogN.value = n; mat.uniforms.uFogF.value = f; },
    dispose() { g.dispose(); outer?.geometry.dispose(); mat.dispose(); inner.removeFromParent(); outer?.removeFromParent(); },
  };
}

// ---------- 天空 ----------
export function skyTexture() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256; const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6fa8d6'); g.addColorStop(0.55, '#bcdcef'); g.addColorStop(1, '#e8f2f4');
  c.fillStyle = g; c.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- 竹子貼圖（竹節） ----------
let bambooTex: THREE.Texture | null = null;
function bamboo() {
  if (bambooTex) return bambooTex;
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 128; const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 16, 0); g.addColorStop(0, '#9c8450'); g.addColorStop(0.5, '#d2b878'); g.addColorStop(1, '#8a7444');
  c.fillStyle = g; c.fillRect(0, 0, 16, 128);
  c.fillStyle = 'rgba(70,55,25,.75)'; for (let y = 10; y < 128; y += 32) c.fillRect(0, y, 16, 3);
  c.fillStyle = 'rgba(255,255,255,.15)'; for (let y = 13; y < 128; y += 32) c.fillRect(0, y, 16, 2);
  bambooTex = new THREE.CanvasTexture(cv); bambooTex.colorSpace = THREE.SRGBColorSpace; bambooTex.wrapS = bambooTex.wrapT = THREE.RepeatWrapping;
  return bambooTex;
}
function woodTex() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const c = cv.getContext('2d')!;
  c.fillStyle = '#8a6a48'; c.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(${50 + Math.random() * 40},${35 + Math.random() * 25},20,.35)`; c.beginPath(); const y = Math.random() * 64; c.moveTo(0, y); c.bezierCurveTo(20, y + 3, 40, y - 3, 64, y + Math.random() * 4 - 2); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------- 蚵棚竹架＋蚵串 ----------
export type Farm = { lumps: THREE.InstancedMesh; ropes: THREE.InstancedMesh; strFirst: number[]; strN: number[]; hide(i: number): void };
export function makeFarms(scene: THREE.Scene, L: Layout, rng: () => number): Farm {
  const bt = bamboo();
  const poleM = lam(0xffffff, { map: bt });
  const poleGeo = new THREE.CylinderGeometry(0.075, 0.09, 3.2, 6);
  const poles: THREE.Matrix4[] = [];
  const bars: THREE.BufferGeometry[] = [];
  const d = new THREE.Object3D();
  const floats: THREE.Matrix4[] = [];
  L.rows.forEach(r => {
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az), n = Math.max(2, Math.ceil(len / 3.2)) + 1;
    const nx = -(r.bz - r.az) / len, nz = (r.bx - r.ax) / len, ang = -Math.atan2(r.bz - r.az, r.bx - r.ax);
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1), x = r.ax + (r.bx - r.ax) * f, z = r.az + (r.bz - r.az) * f;
      for (const sg of [1, -1]) {
        d.position.set(x + nx * 0.65 * sg, 0.15, z + nz * 0.65 * sg); d.rotation.set((rng() - 0.5) * 0.1, rng() * 6, (rng() - 0.5) * 0.1); d.scale.set(1, 0.9 + rng() * 0.25, 1); d.updateMatrix(); poles.push(d.matrix.clone());
      }
      if (k % 2 === 0) { d.position.set(x, 0.05, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); floats.push(d.matrix.clone()); }
    }
    // 頂上兩根橫竹＋橫撐
    for (const sg of [1, -1]) {
      const g = new THREE.CylinderGeometry(0.06, 0.06, len + 0.6, 6); g.rotateZ(Math.PI / 2); g.rotateY(ang);
      g.translate((r.ax + r.bx) / 2 + nx * 0.65 * sg, 1.3, (r.az + r.bz) / 2 + nz * 0.65 * sg); bars.push(g);
    }
    for (let k = 0; k < n; k += 2) {
      const f = k / (n - 1), g = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 5); g.rotateZ(Math.PI / 2); g.rotateY(ang + Math.PI / 2);
      g.translate(r.ax + (r.bx - r.ax) * f, 1.36, r.az + (r.bz - r.az) * f); bars.push(g);
    }
  });
  const pm = new THREE.InstancedMesh(poleGeo, poleM, poles.length); poles.forEach((m, i) => pm.setMatrixAt(i, m)); pm.frustumCulled = true; scene.add(pm);
  if (bars.length) { const bm = new THREE.Mesh(mergeGeometries(bars), poleM); scene.add(bm); bars.forEach(g => g.dispose()); }
  const fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), lam(0xf2f2ee), floats.length); floats.forEach((m, i) => fm.setMatrixAt(i, m)); fm.frustumCulled = true; scene.add(fm);
  // 蚵串：一條繩＋一坨坨蚵（拉走後整串藏起來）
  const strFirst: number[] = [], strN: number[] = [];
  let total = 0; L.strs.forEach(s => { strFirst.push(total); const n = 2 + s.w * 2; strN.push(n); total += n; });
  const lg = new THREE.IcosahedronGeometry(0.2, 0); lg.scale(1, 0.75, 1.2);
  const lumps = new THREE.InstancedMesh(lg, lam(0xffffff, { flatShading: true }), total);
  const ropes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 4), lam(0x3a3a30), L.strs.length);
  const col = new THREE.Color();
  L.strs.forEach((s, si) => {
    const len = 1.1 + 0.35 * s.w;
    d.position.set(s.x, 1.3 - len / 2, s.z); d.rotation.set(0, 0, 0); d.scale.set(1, len, 1); d.updateMatrix(); ropes.setMatrixAt(si, d.matrix);
    for (let j = 0; j < strN[si]; j++) {
      const y = 1.15 - (j / strN[si]) * len * 0.95;
      d.position.set(s.x + (rng() - 0.5) * 0.12, y, s.z + (rng() - 0.5) * 0.12); d.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      d.scale.setScalar((0.8 + 0.25 * s.w) * (0.8 + rng() * 0.4)); d.updateMatrix();
      lumps.setMatrixAt(strFirst[si] + j, d.matrix);
      const g = 0.35 + rng() * 0.15 - s.w * 0.04; lumps.setColorAt(strFirst[si] + j, col.setRGB(g * 1.05, g, g * 0.85));
    }
  });
  lumps.frustumCulled = true; ropes.frustumCulled = true;
  scene.add(lumps, ropes);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    lumps, ropes, strFirst, strN,
    hide(i: number) { for (let j = 0; j < strN[i]; j++) lumps.setMatrixAt(strFirst[i] + j, zero); ropes.setMatrixAt(i, zero); lumps.instanceMatrix.needsUpdate = true; ropes.instanceMatrix.needsUpdate = true; },
  };
}
/** 私人蚵棚：紅旗＋牌子；自己的：藍旗 */
export function makeFlags(scene: THREE.Scene, L: Layout) {
  const post = lam(0x5a4430);
  L.rows.forEach(r => {
    const flagM = lam(r.owned ? 0xd04030 : ACC, { side: THREE.DoubleSide });
    for (const [x, z] of [[r.ax, r.az], [r.bx, r.bz]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.8, 5), post); p.position.set(x, 1.9, z); scene.add(p);
      const fg = new THREE.PlaneGeometry(1.1, 0.6, 4, 1); const pos = fg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 3) * 0.08);
      const f = new THREE.Mesh(fg, flagM); f.position.set(x + 0.55, 3.4, z); f.rotation.y = 0.3; scene.add(f);
    }
    if (r.owned) {
      const tx = document.createElement('canvas'); tx.width = 256; tx.height = 96; const c = tx.getContext('2d')!;
      c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 96); c.strokeStyle = '#d04030'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 88);
      c.fillStyle = '#b02a20'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('私人蚵棚', 128, 50);
      const t = new THREE.CanvasTexture(tx); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: true })); sp.scale.set(3, 1.1, 1); sp.position.set((r.ax + r.bx) / 2, 2.8, (r.az + r.bz) / 2); scene.add(sp);
    }
  });
}

// ---------- 碼頭＋沙洲上的東西 ----------
export function makeShore(scene: THREE.Scene, rng: () => number) {
  const wt = woodTex();
  const plankM = lam(0xffffff, { map: wt }), postM = lam(0x6a5038, { map: wt });
  // 碼頭：一片片木板（有縫）＋木樁＋輪胎
  const x0 = SEA.dock.x, z0 = SEA.dock.z;
  const nP = 34, pk = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 0.08, 0.32), plankM, nP), d = new THREE.Object3D();
  for (let i = 0; i < nP; i++) { d.position.set(x0 + (rng() - 0.5) * 0.06, 0.62 + (rng() - 0.5) * 0.02, z0 - 0.2 + i * 0.4); d.rotation.set(0, (rng() - 0.5) * 0.03, (rng() - 0.5) * 0.02); d.updateMatrix(); pk.setMatrixAt(i, d.matrix); pk.setColorAt(i, new THREE.Color().setHSL(0.08, 0.3, 0.45 + rng() * 0.15)); }
  scene.add(pk);
  const posts: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= 6; i++) for (const sx of [-1.45, 1.45]) { const g = new THREE.CylinderGeometry(0.14, 0.16, 2.4, 7); g.translate(x0 + sx, -0.3, z0 + i * 2.2); posts.push(g); }
  for (const sx of [-1.4, 1.4]) { const g = new THREE.BoxGeometry(0.12, 0.18, 14); g.translate(x0 + sx, 0.5, z0 + 6.6); posts.push(g); }
  const pm = new THREE.Mesh(mergeGeometries(posts), postM); scene.add(pm); posts.forEach(g => g.dispose());
  const tireM = lam(0x1e1e1e);
  for (const [sx, zz] of [[-1.6, 0.3], [1.6, 0.3], [1.6, 4.5], [-1.6, 6.7]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 6, 12), tireM); t.position.set(x0 + sx, 0.25, z0 + zz); t.rotation.y = Math.PI / 2; scene.add(t); }
  const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 8), lam(0x2a2a2a)); bol.position.set(x0 + 1.2, 0.82, z0 + 0.3); scene.add(bol);
  // 工寮帳篷
  const tent = new THREE.Group(); tent.position.set(-8, 0.35, 16); scene.add(tent);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 4.6, 1.2, 4, 1, true), lam(0xf4f1e6, { side: THREE.DoubleSide })); roof.rotation.y = Math.PI / 4; roof.position.y = 2.6; tent.add(roof);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.3, 0.25, 4, 1, true), lam(ACC, { side: THREE.DoubleSide })); stripe.rotation.y = Math.PI / 4; stripe.position.y = 2.05; tent.add(stripe);
  for (const [x, z] of [[-3.2, -2.3], [3.2, -2.3], [-3.2, 2.3], [3.2, 2.3]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5), postM); c.position.set(x, 1, z); tent.add(c); }
  const crateM = lam(0x6f8090);
  for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), crateM); b.position.set(-2.5 + (i % 4) * 1.1, 0.25 + Math.floor(i / 4) * 0.5, -1); tent.add(b); }
  // 燈塔（塭港堆）
  const lt = new THREE.Group(); lt.position.set(14, 0.35, 20); scene.add(lt);
  const steel = lam(0x9aa4ac);
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 9, 5), steel); c.position.set(x, 4.5, z); c.rotation.set(-z * 0.08, 0, x * 0.08); lt.add(c); }
  for (let y = 1.5; y < 9; y += 1.6) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75 - y * 0.03, 0.04, 4, 4), steel); ring.position.y = y; ring.rotation.set(Math.PI / 2, 0, Math.PI / 4); lt.add(ring); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), lam(0xffffff)); top.position.y = 9.2; lt.add(top);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 1.3), lam(0xc83a2a)); cap.position.y = 9.8; lt.add(cap);
  // 漂流木、蚵殼堆
  const drift = lam(0x9a8a70);
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2 + rng() * 2, 6), drift); l.position.set(-40 + rng() * 80, 0.45, 16 + rng() * 10); l.rotation.set(Math.PI / 2, 0, rng() * 3); scene.add(l); }
  const shellG = new THREE.IcosahedronGeometry(0.16, 0); shellG.scale(1, 0.4, 1.3);
  const sh = new THREE.InstancedMesh(shellG, lam(0xd8d2c4, { flatShading: true }), 140);
  for (let i = 0; i < 140; i++) { const a = rng() * 6.28, r = Math.sqrt(rng()) * 1.6; d.position.set(-3 + Math.cos(a) * r, 0.38 + (1.6 - r) * 0.35, 19 + Math.sin(a) * r); d.rotation.set(rng() * 3, rng() * 3, rng() * 3); d.scale.setScalar(1); d.updateMatrix(); sh.setMatrixAt(i, d.matrix); }
  scene.add(sh);
}

// ---------- 膠筏（PVC 管筏）＋人 ----------
export type Raft = { g: THREE.Group; body: THREE.Group; prop: THREE.Object3D; arm: THREE.Object3D | null; stack: THREE.InstancedMesh; flash: THREE.MeshLambertMaterial; motor: THREE.Group; tillerEnd: THREE.Object3D; seat: THREE.Object3D };
type Who = 'me' | 'abo' | 'apo';
function person(who: Who, skin: THREE.Material) {
  const g = new THREE.Group();
  const shirt = who === 'me' ? 0xf06a1a : who === 'abo' ? 0x2a4a6a : 0xd86a9a; // 自己穿救生衣
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.36), lam(shirt)); body.position.y = 0.55; g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.5), lam(who === 'apo' ? 0x3a3048 : 0x2a3038)); legs.position.set(0, 0.15, -0.08); g.add(legs);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin); head.position.y = 1.05; g.add(head);
  if (who === 'apo') {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), lam(0xe8e8e8)); hair.position.y = 1.2; g.add(hair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lam(0xe8e8e8)); bun.position.set(0, 1.22, 0.2); g.add(bun);
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.38), lam(0x6a9a4a)); scarf.position.y = 0.88; g.add(scarf);
  } else {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 12), lam(0xd8c078)); hat.position.y = 1.32; g.add(hat); // 斗笠
  }
  let arm: THREE.Object3D | null = null;
  if (who === 'apo') {
    arm = new THREE.Group(); arm.position.set(0.3, 0.8, 0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), lam(0xd86a9a)); a.position.y = -0.22; arm.add(a);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), lam(0xbdb5a0, { flatShading: true })); hand.position.y = -0.5; arm.add(hand);
    g.add(arm);
  }
  return { g, arm };
}
export function makeRaft(scene: THREE.Scene | THREE.Object3D, opts: { trim: number; crew: Who[] }): Raft {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); scene.add(g);
  // 9 根 PVC 管，船頭往上翹
  const pipes: THREE.BufferGeometry[] = [];
  const N = 9, R = 0.12, gap = 0.235;
  for (let i = 0; i < N; i++) {
    const x = (i - (N - 1) / 2) * gap;
    const a = new THREE.CylinderGeometry(R, R, 3.6, 8); a.rotateX(Math.PI / 2); a.translate(x, 0.08, 0.4); pipes.push(a);
    const b = new THREE.CylinderGeometry(R, R * 0.9, 1.3, 8); b.translate(0, 0.65, 0); b.rotateX(-Math.PI / 2 + 0.42); b.translate(x, 0.08, -1.4); pipes.push(b);
    const cap = new THREE.SphereGeometry(R * 0.9, 8, 4); cap.translate(x, 0.08 + Math.sin(0.42) * 1.3, -1.4 - Math.cos(0.42) * 1.3); pipes.push(cap);
  }
  const pipeG = mergeGeometries(pipes.map(p => p.index ? p.toNonIndexed() : p)); pipes.forEach(p => p.dispose());
  const flash = lam(0xe9ece8);
  body.add(new THREE.Mesh(pipeG, flash));
  // 甲板木條＋橫樑＋船舷色條
  const deck: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) { const b = new THREE.BoxGeometry(2.15, 0.05, 0.26); b.translate(0, 0.23, -1 + k * 0.36); deck.push(b); }
  const deckM = new THREE.Mesh(mergeGeometries(deck), lam(0x9a7a52)); deck.forEach(b => b.dispose()); body.add(deckM);
  for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 3.4), lam(opts.trim)); rail.position.set(sx * 1.1, 0.3, 0.4); body.add(rail); }
  // 舷外機
  const motor = new THREE.Group(); motor.position.set(0, 0.3, 2.3); body.add(motor);
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.55), lam(0x2a2e34)); cowl.position.y = 0.35; motor.add(cowl);
  const cowlTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.5), lam(opts.trim)); cowlTop.position.y = 0.64; motor.add(cowlTop);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.16), lam(0x3a3e44)); shaft.position.set(0, -0.3, 0.05); motor.add(shaft);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.42), lam(0x3a3e44)); foot.position.set(0, -0.72, 0.05); motor.add(foot);
  const prop = new THREE.Group(); prop.position.set(0, -0.72, 0.3); motor.add(prop);
  for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.06), lam(0xb0b4b8)); bl.rotation.z = i * 2.09; prop.add(bl); }
  // 舵柄：從引擎往前伸到船尾座位旁（握把端＝tillerEnd）
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.72, 6), lam(0x2a2e34)); tiller.rotation.x = Math.PI / 2 + 0.03; tiller.position.set(0, 0.49, -0.5); motor.add(tiller);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), lam(0xc0502a)); grip.rotation.x = Math.PI / 2; grip.position.set(0, 0.48, -0.8); motor.add(grip);
  const tillerEnd = new THREE.Object3D(); tillerEnd.position.set(0, 0.48, -0.82); motor.add(tillerEnd);
  // 冰桶＋人
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), lam(0x3a7ab8)); box.position.set(0.55, 0.48, 0.9); body.add(box);
  // 船尾座位（木箱）：玩家坐這裡握舵柄
  const seatBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.45), lam(0x8a6a48)); seatBox.position.set(-0.4, 0.42, 1.72); body.add(seatBox);
  const seat = new THREE.Object3D(); seat.position.set(-0.4, 0.59, 1.72); body.add(seat);
  const skin = lam(0xe8c09a);
  let arm: THREE.Object3D | null = null;
  opts.crew.forEach((w, i) => {
    const p = person(w, skin);
    p.g.position.set(i === 0 ? 0.35 : -0.45, 0.25, i === 0 ? 1.7 : 0.2);
    if (w === 'apo') p.g.rotation.y = Math.PI;
    body.add(p.g); if (p.arm) arm = p.arm;
  });
  const stack = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), lam(0x5a5446), 12); stack.count = 0; body.add(stack);
  return { g, body, prop, arm, stack, flash, motor, tillerEnd, seat };
}

// ---------- 水花／航跡（固定物件池 InstancedMesh，additive；不 push／shift／splice 觸發 GC） ----------
type FxP = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; s0: number; s1: number; a: number; on: boolean };

export function makeFx(scene: THREE.Scene | THREE.Object3D, max = 160, y0 = 0.12) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d')!;
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), max);
  mesh.renderOrder = 3; mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
  const ps: FxP[] = Array.from({ length: max }, () => ({
    x: 0, y: y0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0, s0: 0.6, s1: 2.2, a: 0.45, on: false,
  }));
  let cursor = 0;
  const d = new THREE.Object3D(), col = new THREE.Color(), tint = new THREE.Color(1, 1, 1);
  for (let i = 0; i < max; i++) mesh.setColorAt(i, col.setRGB(0, 0, 0));
  return {
    mesh,
    /** 粒子顏色（夜光藻：偏藍綠）；只改顏色，不加燈 */
    setTint(r: number, g: number, b: number) { tint.setRGB(r, g, b); },
    spawn(x: number, z: number, o: Partial<Omit<FxP, 'on'>> = {}) {
      const p = ps[cursor];
      cursor = (cursor + 1) % max;
      p.x = x; p.z = z;
      p.y = o.y ?? y0;
      p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
      p.age = 0;
      p.life = o.life ?? 1.4;
      p.s0 = o.s0 ?? 0.6; p.s1 = o.s1 ?? 2.2;
      p.a = o.a ?? 0.45;
      p.on = true;
    },
    tick(dt: number) {
      let n = 0;
      for (let i = 0; i < max; i++) {
        const p = ps[i];
        if (!p.on) continue;
        p.age += dt;
        if (p.age >= p.life) { p.on = false; continue; }
        p.x += p.vx * dt; p.y = Math.max(y0, p.y + p.vy * dt); p.vy -= 9 * dt; p.z += p.vz * dt;
        const f = p.age / p.life, s = p.s0 + (p.s1 - p.s0) * f;
        d.position.set(p.x, p.y, p.z); d.scale.set(s, 1, s); d.updateMatrix(); mesh.setMatrixAt(n, d.matrix);
        const a = p.a * (1 - f); mesh.setColorAt(n, col.setRGB(a * tint.r, a * tint.g, a * tint.b)); n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}

// ---------- 迫擊砲：落點預告＋砲彈 ----------
export function makeMortarFx(scene: THREE.Scene, pool = 3) {
  const items = Array.from({ length: pool }, () => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xe0482a, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, fog: false }));
    for (const m of [ring, fill, dot]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.visible = false; scene.add(m); }
    const sg = new THREE.IcosahedronGeometry(0.32, 0); sg.scale(1, 0.55, 1.3);
    const shell = new THREE.Mesh(sg, lam(0x8a8270, { flatShading: true })); shell.visible = false; scene.add(shell);
    return { ring, fill, dot, shell };
  });
  return {
    /** i：哪一發；p：0→1 的飛行進度 */
    show(i: number, s: { x0: number; z0: number; tx: number; tz: number }, p: number, r: number, t: number) {
      const it = items[i]; if (!it) return;
      const y = 0.32;
      it.ring.visible = it.fill.visible = it.dot.visible = it.shell.visible = true;
      it.ring.position.set(s.tx, y, s.tz); it.ring.scale.setScalar(r); (it.ring.material as THREE.MeshBasicMaterial).color.setHex(p > 0.7 && Math.sin(t * 30) > 0 ? 0xffd24a : 0xff6a3a);
      it.fill.position.set(s.tx, y - 0.01, s.tz); it.fill.scale.setScalar(Math.max(0.05, r * p));
      it.dot.position.set(s.tx, y + 0.01, s.tz);
      const d = Math.hypot(s.tx - s.x0, s.tz - s.z0), H = 5 + d * 0.18;
      it.shell.position.set(s.x0 + (s.tx - s.x0) * p, 1.6 + (0.2 - 1.6) * p + 4 * H * p * (1 - p), s.z0 + (s.tz - s.z0) * p);
      it.shell.rotation.set(t * 7, t * 5, 0);
    },
    hide(i: number) { const it = items[i]; if (!it) return; it.ring.visible = it.fill.visible = it.dot.visible = it.shell.visible = false; },
  };
}
export type { Str };
