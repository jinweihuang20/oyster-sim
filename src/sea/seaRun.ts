/**
 * 外傘頂洲「出海採蚵」第一段：開漁筏到外海蚵棚拉蚵串，退潮前回碼頭。
 * 自己一個 WebGL 畫布＋DOM 介面；結束後交出 Haul 給第二段（沙洲工寮剝蚵）。
 */
import * as THREE from 'three';
import {
  SEA, mulberry32, makeLayout, ebbOf, shoalR, groundLim, pullDur, inShoal, newBoat, stepBoat, nearestStr, strContent, finishHaul,
  type Layout, type Boat, type Load, type Haul, type Rng, type Str,
} from './seaLogic';

export { SEA } from './seaLogic';
export type { Haul as SeaHaul } from './seaLogic';

export type SeaSfx = 'pull' | 'got' | 'wave' | 'ground' | 'scold' | 'dock' | 'warn' | 'drop';
export type SeaOpts = { onDone: (h: Haul) => void; onAbort: () => void; sfx?: (k: SeaSfx) => void; seed?: number };

const ACC = 0x2a5a86;
const ICON = {
  tide: '<svg viewBox="0 0 24 24"><path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg>',
  load: '<svg viewBox="0 0 24 24"><path d="M3 15h18l-2.5 5h-13z"/><path d="M7 15V9h4v6M13 15V6h4v9"/></svg>',
  rope: '<svg viewBox="0 0 24 24"><path d="M12 2v5"/><ellipse cx="12" cy="10" rx="3" ry="2.6"/><ellipse cx="12" cy="15" rx="3.4" ry="2.6"/><ellipse cx="12" cy="20" rx="2.6" ry="2"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19"/></svg>',
  dock: '<svg viewBox="0 0 24 24"><path d="M3 12h18M6 12v8M12 12v8M18 12v8"/><path d="M8 8l4-4 4 4"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

let S: Run | null = null;
let fastK = 1;

type Run = {
  o: SeaOpts; rng: Rng; L: Layout; b: Boat; t: number; loads: Load[];
  fine: number; stolen: number; lost: number; warned: boolean; ended: boolean;
  pullOn: boolean; pullP: number; pullTarget: Str | null;
  wave: number; waveNext: number; waveDir: number; shoalNow: boolean;
  keys: Set<string>; joy: { id: number; x0: number; y0: number; x: number; y: number } | null;
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera;
  boatG: THREE.Group; stack: THREE.InstancedMesh; strMesh: THREE.InstancedMesh; ring: THREE.Mesh;
  shoalMs: { s: THREE.Mesh; rim: THREE.Mesh; sh: Layout['shoals'][number] }[]; water: THREE.Mesh;
  root: HTMLElement; el: Record<string, HTMLElement>; map: HTMLCanvasElement; mapT: number;
  raf: number; last: number; toastT: number; abortArm: number;
  onKey: (e: KeyboardEvent) => void; onKeyUp: (e: KeyboardEvent) => void; onResize: () => void; onBlur: () => void;
};

export const seaActive = () => !!S && !S.ended;

/** 測試用：直接跳過出海、加快退潮、看狀態、瞬移 */
export const seaDbg = {
  skip(oy = 60, big = 0.4) { if (!S || S.ended) return false; const n = Math.max(1, Math.round(oy)); end({ strings: Math.ceil(n / 11), oy: n, big: Math.round(n * big), fine: 0, stolen: 0, lost: 0, stranded: false, secs: Math.round(S.t), skipped: true }); return true; },
  fast(k = 8) { fastK = Math.max(0.1, k); return fastK; },
  state() { if (!S) return null; const b = S.b; return { t: +S.t.toFixed(1), len: S.L.len, load: b.load, strings: S.loads.length, grounded: b.grounded, x: +b.x.toFixed(1), z: +b.z.toFixed(1), v: +b.v.toFixed(2), fine: S.fine, near: !!nearestStr(S.L, b) }; },
  warp(x: number, z: number) { if (!S) return; S.b.x = x; S.b.z = z; S.b.v = 0; },
  /** 瞬移到最近一串旁邊（測試用） */
  toStr(owned = false) { if (!S) return null; const s = S.L.strs.find(q => !q.taken && S!.L.rows[q.row].owned === owned); if (!s) return null; const r = S.L.rows[s.row], l = Math.hypot(r.bx - r.ax, r.bz - r.az) || 1; S.b.x = s.x - (r.bz - r.az) / l * 2; S.b.z = s.z + (r.bx - r.ax) / l * 2; S.b.h = -Math.atan2(r.bz - r.az, r.bx - r.ax) + Math.PI / 2; S.b.v = 0; return { w: s.w }; },
  hold(on: boolean) { if (S) S.pullOn = on; },
};

export function seaStart(o: SeaOpts) {
  if (S) teardown();
  fastK = 1;
  (document.activeElement as HTMLElement | null)?.blur?.();
  const rng = mulberry32(o.seed ?? (Date.now() ^ (Math.random() * 1e9)));
  const L = makeLayout(rng), b = newBoat();
  const root = document.createElement('div'); root.id = 'seaRoot';
  root.innerHTML = `
    <canvas id="seaCv"></canvas>
    <div class="seaHud">
      <div class="seaRow"><span class="seaIc">${ICON.tide}</span><span class="seaLab">退潮</span><b id="seaTime">--:--</b><div class="seaBar"><i id="seaTideF"></i></div></div>
      <div class="seaRow"><span class="seaIc">${ICON.load}</span><span class="seaLab">載重</span><b id="seaLoad">0/${SEA.cap}</b><div class="seaBar seaLoadBar"><i id="seaLoadF"></i><em id="seaLim"></em></div></div>
      <div class="seaRow seaSum"><span class="seaIc">${ICON.rope}</span><span id="seaSum">還沒拉到蚵串</span></div>
    </div>
    <canvas id="seaMap" width="132" height="148"></canvas>
    <button id="seaQuit" class="seaQuit" type="button">${ICON.close}<span>放棄出海</span></button>
    <div id="seaToast"></div>
    <div id="seaBanner"></div>
    <div id="seaJoy"><i></i></div>
    <div id="seaKeys">W／↑ 前進・S／↓ 倒退・A D／← → 轉向・空白鍵長按拉蚵串／靠岸・Q 丟一串</div>
    <button id="seaDrop" type="button">${ICON.drop}<span>丟一串</span></button>
    <button id="seaAct" type="button"><span class="seaIc">${ICON.rope}</span><span id="seaActT">長按拉蚵串</span></button>
    <div id="seaEnd"></div>`;
  document.body.appendChild(root);
  const q = (id: string) => root.querySelector('#' + id) as HTMLElement;
  const el: Run['el'] = {};
  for (const id of ['seaTime', 'seaTideF', 'seaLoad', 'seaLoadF', 'seaLim', 'seaSum', 'seaToast', 'seaBanner', 'seaJoy', 'seaDrop', 'seaAct', 'seaActT', 'seaEnd', 'seaQuit', 'seaKeys']) el[id] = q(id);
  const cv = q('seaCv') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !matchMedia('(pointer: coarse)').matches, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfdcea); scene.fog = new THREE.Fog(0xbfdcea, 45, 120);
  const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x8a9a80, 2.2));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4); sun.position.set(30, 60, 20); scene.add(sun);

  const built = buildWorld(scene, L);
  S = {
    o, rng, L, b, t: 0, loads: [], fine: 0, stolen: 0, lost: 0, warned: false, ended: false,
    pullOn: false, pullP: 0, pullTarget: null, wave: 0, waveNext: SEA.waveMin + rng() * (SEA.waveMax - SEA.waveMin), waveDir: 0, shoalNow: false,
    keys: new Set(), joy: null, renderer, scene, cam, ...built,
    root, el, map: q('seaMap') as HTMLCanvasElement, mapT: 0, raf: 0, last: performance.now(), toastT: 0, abortArm: 0,
    onKey: () => {}, onKeyUp: () => {}, onResize: () => {}, onBlur: () => {},
  };
  bindInput(S);
  resize();
  toast(`漁筏出港！到外海蚵棚拉蚵串，退潮前（約 ${Math.round(L.len / 60 * 10) / 10} 分鐘）回碼頭`, 3.6);
  S.last = performance.now();
  S.raf = requestAnimationFrame(loop);
}

function resize() {
  if (!S) return;
  const w = innerWidth, h = innerHeight;
  S.renderer.setSize(w, h, false); S.cam.aspect = w / Math.max(1, h); S.cam.fov = w < h ? 70 : 55; S.cam.updateProjectionMatrix();
}

// ---------- 場景 ----------
function buildWorld(scene: THREE.Scene, L: Layout) {
  const lam = (c: number, o: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = scene) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); p.add(me); return me; };
  const water = add(new THREE.PlaneGeometry(420, 420), lam(0x5aa8c4), 0, 0, -60); water.rotation.x = -Math.PI / 2;
  // 沙洲＋碼頭＋工寮
  const sand = add(new THREE.PlaneGeometry(200, 60), lam(0xe2d3a6), 0, 0.05, 36); sand.rotation.x = -Math.PI / 2;
  const plank = lam(0x8a6a48), post = lam(0x5a4430);
  add(new THREE.BoxGeometry(3, 0.25, 12), plank, SEA.dock.x, 0.45, SEA.dock.z + 6);
  for (const dz of [0, 4, 8, 12]) for (const dx of [-1.3, 1.3]) add(new THREE.CylinderGeometry(0.14, 0.14, 1.6), post, SEA.dock.x + dx, 0, SEA.dock.z + dz);
  const tent = new THREE.Group(); tent.position.set(-8, 0, 15); scene.add(tent);
  add(new THREE.BoxGeometry(7, 0.18, 5), lam(0xf4f1e6), 0, 2.6, 0, tent);
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(1.1, 0.2, 5.04), lam(ACC), -2.4 + i * 2.4, 2.62, 0, tent);
  for (const [x, z] of [[-3.3, -2.3], [3.3, -2.3], [-3.3, 2.3], [3.3, 2.3]]) add(new THREE.CylinderGeometry(0.08, 0.08, 2.6), post, x, 1.3, z, tent);
  for (let i = 0; i < 8; i++) add(new THREE.BoxGeometry(0.9, 0.5, 0.6), lam(0x7a8a9a), -2.5 + (i % 4) * 1.1, 0.3 + Math.floor(i / 4) * 0.5, -1, tent);
  // 燈塔（塭港堆）
  const lt = new THREE.Group(); lt.position.set(14, 0, 18); scene.add(lt);
  const steel = lam(0x9aa4ac);
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const c = add(new THREE.CylinderGeometry(0.07, 0.1, 9), steel, x * 0.7, 4.5, z * 0.7, lt); c.rotation.set(-z * 0.06, 0, x * 0.06); }
  add(new THREE.BoxGeometry(1.2, 0.9, 1.2), lam(0xffffff), 0, 9.2, 0, lt);
  add(new THREE.BoxGeometry(1.3, 0.25, 1.3), lam(0xc83a2a), 0, 9.8, 0, lt);
  // 淺灘：沙色內圈＋淺水外圈（跟著退潮變大）
  const shoalMs = L.shoals.map(sh => {
    const rim = add(new THREE.CircleGeometry(1, 40), lam(0x9ad0d8, { transparent: true, opacity: 0.75 }), sh.x, 0.02, sh.z); rim.rotation.x = -Math.PI / 2;
    const s = add(new THREE.CircleGeometry(1, 40), lam(0xdcc995), sh.x, 0.04, sh.z); s.rotation.x = -Math.PI / 2;
    return { s, rim, sh };
  });
  // 蚵棚竹架：竹竿（instanced）＋橫桿＋旗子
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.08, 2.6);
  const polePos: [number, number][] = [];
  L.rows.forEach(r => {
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az), n = Math.max(2, Math.ceil(len / 3.2)) + 1;
    const nx = -(r.bz - r.az) / len, nz = (r.bx - r.ax) / len;
    for (let k = 0; k < n; k++) { const f = k / (n - 1), x = r.ax + (r.bx - r.ax) * f, z = r.az + (r.bz - r.az) * f; polePos.push([x + nx * 0.6, z + nz * 0.6], [x - nx * 0.6, z - nz * 0.6]); }
    for (const sgn of [1, -1]) {
      const bar = add(new THREE.BoxGeometry(len, 0.08, 0.08), lam(0xb89a5a), (r.ax + r.bx) / 2 + nx * 0.6 * sgn, 1.15, (r.az + r.bz) / 2 + nz * 0.6 * sgn);
      bar.rotation.y = -Math.atan2(r.bz - r.az, r.bx - r.ax);
    }
    const flagM = lam(r.owned ? 0xd04030 : ACC, { side: THREE.DoubleSide });
    for (const [x, z] of [[r.ax, r.az], [r.bx, r.bz]]) {
      add(new THREE.CylinderGeometry(0.05, 0.05, 3.6), post, x, 1.8, z);
      const f = add(new THREE.PlaneGeometry(1.1, 0.6), flagM, x + 0.55, 3.2, z); f.rotation.y = 0.3;
    }
    if (r.owned) { // 「私人蚵棚」牌子
      const tx = document.createElement('canvas'); tx.width = 256; tx.height = 96; const c = tx.getContext('2d')!;
      c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 96); c.strokeStyle = '#d04030'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 88);
      c.fillStyle = '#b02a20'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('私人蚵棚', 128, 50);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(tx), fog: true })); sp.scale.set(3, 1.1, 1); sp.position.set((r.ax + r.bx) / 2, 2.6, (r.az + r.bz) / 2); scene.add(sp);
    }
  });
  const poles = new THREE.InstancedMesh(poleGeo, lam(0xc8ab6a), polePos.length);
  const d = new THREE.Object3D();
  polePos.forEach(([x, z], i) => { d.position.set(x, 0.3, z); d.rotation.set((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08); d.updateMatrix(); poles.setMatrixAt(i, d.matrix); });
  scene.add(poles);
  // 蚵串（instanced；拉走後縮成 0）
  const strMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.16, 1, 7), lam(0xffffff), L.strs.length);
  L.strs.forEach((s, i) => { setStr(strMesh, i, s, true); strMesh.setColorAt(i, new THREE.Color(s.w === 3 ? 0x4a4438 : s.w === 2 ? 0x6a6252 : 0x8a826e)); });
  scene.add(strMesh);
  const ring = add(new THREE.TorusGeometry(1, 0.08, 6, 28), new THREE.MeshBasicMaterial({ color: ACC }), 0, 0.15, 0); ring.rotation.x = -Math.PI / 2; ring.visible = false;
  // 漁筏
  const boatG = new THREE.Group(); scene.add(boatG);
  const hull = lam(0xe8e4d8), trim = lam(ACC);
  add(new THREE.BoxGeometry(1.9, 0.4, 3.6), hull, 0, 0.2, 0, boatG);
  add(new THREE.BoxGeometry(1.95, 0.12, 3.65), trim, 0, 0.42, 0, boatG);
  const bow = add(new THREE.CylinderGeometry(0.95, 0.95, 0.4, 3, 1), hull, 0, 0.2, -1.8, boatG); bow.rotation.y = Math.PI / 6; bow.scale.set(1, 1, 0.55);
  add(new THREE.BoxGeometry(0.45, 0.6, 0.5), lam(0x30343a), 0, 0.55, 1.95, boatG);
  add(new THREE.BoxGeometry(0.5, 0.7, 0.4), lam(0xf06a1a), 0.35, 0.8, 1.2, boatG); // 救生衣的人
  add(new THREE.BoxGeometry(0.36, 0.36, 0.36), lam(0xe8c09a), 0.35, 1.35, 1.2, boatG);
  add(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 10), lam(0xe0c860), 0.35, 1.58, 1.2, boatG);
  const stack = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.32, 0.5), lam(0x5a5446), 12); stack.count = 0; boatG.add(stack);
  return { water, shoalMs, strMesh, ring, boatG, stack };
}
function setStr(m: THREE.InstancedMesh, i: number, s: Str, vis: boolean) {
  const d = new THREE.Object3D(); const h = 0.8 + 0.35 * s.w;
  d.position.set(s.x, 1.1 - h / 2 + 0.2, s.z); d.scale.set(vis ? 0.75 + 0.2 * s.w : 0, vis ? h : 0, vis ? 0.75 + 0.2 * s.w : 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.instanceMatrix.needsUpdate = true;
}

// ---------- 輸入 ----------
function bindInput(R: Run) {
  const game = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ', 'Enter', 'KeyF']);
  R.onKey = e => {
    if (!S || S.ended) { if (S?.ended && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); e.stopImmediatePropagation(); (S.root.querySelector('#seaGo') as HTMLElement | null)?.click(); } return; }
    if (e.code === 'Tab' || e.code.startsWith('F') && /^F\d+$/.test(e.code)) return;
    e.stopImmediatePropagation(); if (game.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    R.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyF') R.pullOn = true;
    if (e.code === 'KeyQ') dropOne();
  };
  R.onKeyUp = e => {
    if (!S) return; e.stopImmediatePropagation(); if (game.has(e.code)) e.preventDefault(); R.keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyF') R.pullOn = false;
  };
  R.onResize = () => resize();
  R.onBlur = () => { R.keys.clear(); R.pullOn = false; R.joy = null; };
  addEventListener('blur', R.onBlur);
  addEventListener('keydown', R.onKey, true); addEventListener('keyup', R.onKeyUp, true); addEventListener('resize', R.onResize);
  const act = R.el.seaAct;
  const down = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); try { act.setPointerCapture(e.pointerId); } catch { /* */ } R.pullOn = true; };
  const up = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); R.pullOn = false; };
  act.addEventListener('pointerdown', down); act.addEventListener('pointerup', up); act.addEventListener('pointercancel', up); act.addEventListener('lostpointercapture', () => { R.pullOn = false; });
  act.addEventListener('contextmenu', e => e.preventDefault());
  R.el.seaDrop.addEventListener('click', e => { e.stopPropagation(); dropOne(); });
  R.el.seaQuit.addEventListener('click', e => {
    e.stopPropagation(); if (!S) return;
    if (performance.now() < S.abortArm) { const o = S.o; teardown(); o.onAbort(); return; }
    S.abortArm = performance.now() + 3000; (S.el.seaQuit.querySelector('span') as HTMLElement).textContent = '再按一次放棄';
    setTimeout(() => { if (S && performance.now() >= S.abortArm) (S.el.seaQuit.querySelector('span') as HTMLElement).textContent = '放棄出海'; }, 3100);
  });
  // 搖桿：畫面左半邊任何地方按下拖曳
  const joyEl = R.el.seaJoy, knob = joyEl.firstElementChild as HTMLElement;
  R.root.addEventListener('pointerdown', e => {
    if (!S || S.ended || S.joy) return;
    if ((e.target as HTMLElement).closest('button,#seaEnd')) return;
    if (e.clientX > innerWidth * 0.62) return;
    S.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
    joyEl.style.left = `${e.clientX}px`; joyEl.style.top = `${e.clientY}px`; joyEl.classList.add('on'); knob.style.transform = '';
  });
  R.root.addEventListener('pointermove', e => {
    const j = S?.joy; if (!j || e.pointerId !== j.id) return;
    const dx = e.clientX - j.x0, dy = e.clientY - j.y0, r = 56, d = Math.hypot(dx, dy), k = d > r ? r / d : 1;
    j.x = (dx * k) / r; j.y = (dy * k) / r; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  });
  const jEnd = (e: PointerEvent) => { if (S?.joy && e.pointerId === S.joy.id) { S.joy = null; joyEl.classList.remove('on'); } };
  R.root.addEventListener('pointerup', jEnd); R.root.addEventListener('pointercancel', jEnd);
}

function input(R: Run) {
  const k = R.keys;
  let thr = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
  let steer = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  if (R.joy) { thr = Math.abs(R.joy.y) < 0.15 ? 0 : -R.joy.y; steer = Math.abs(R.joy.x) < 0.12 ? 0 : R.joy.x; }
  return { thr: Math.max(-1, Math.min(1, thr)), steer: Math.max(-1, Math.min(1, steer)) };
}

// ---------- 動作 ----------
function dropOne() {
  const R = S; if (!R || R.ended || !R.loads.length) return;
  // 丟最輕的一串
  let i = 0; R.loads.forEach((l, j) => { if (l.w < R.loads[i].w) i = j; });
  const l = R.loads.splice(i, 1)[0]; R.b.load -= l.w; R.lost++;
  R.o.sfx?.('drop');
  toast(R.b.grounded ? `丟掉一串（${l.oy} 顆）…` : `丟掉一串蚵仔（${l.oy} 顆）`, 1.6);
}
const SCOLD = ['欸！彼排是阮兜的蚵棚啦！', '閣偷拉？莫閣來啊！', '你是佗位來的？蚵仔還來！', '阮看甲真清楚喔！'];
function finishPull(R: Run, s: Str) {
  const owned = R.L.rows[s.row].owned;
  if (R.b.load + s.w > SEA.cap) { toast('船滿了，載不下這串；先丟一串或回碼頭', 1.8); return; }
  s.taken = true; setStr(R.strMesh, R.L.strs.indexOf(s), s, false);
  const c = strContent(s.w, R.rng); c.owned = owned; R.loads.push(c); R.b.load += s.w;
  R.o.sfx?.('got');
  if (owned) {
    const f = SEA.finePerW * s.w; R.fine += f; R.stolen++;
    R.o.sfx?.('scold');
    toast(`顧蚵棚大姐：「${SCOLD[Math.floor(R.rng() * SCOLD.length)]}」偷拉別人的蚵串，罰 $${f}`, 3);
  } else toast(`拉上來了！${['輕', '中', '重'][s.w - 1]}串 ${c.oy} 顆${c.big ? `（大蚵 ${c.big}）` : ''}`, 1.6);
}

function end(h: Haul) {
  const R = S; if (!R || R.ended) return;
  R.ended = true; R.pullOn = false; R.joy = null;
  const o = R.o;
  if (h.skipped) { teardown(); o.onDone(h); return; }
  const e = R.el.seaEnd;
  e.innerHTML = `<div class="seaEndBox">
    <h3>${h.stranded ? '退潮擱淺了' : '靠岸卸貨'}</h3>
    ${h.stranded ? '<p class="seaBad">潮水退光，漁筏卡在沙洲上，只救回一半的蚵仔。</p>' : ''}
    <p>拉回 <b>${h.strings}</b> 串・共 <b>${h.oy}</b> 顆蚵仔（大蚵 <b>${h.big}</b> 顆）</p>
    ${h.lost ? `<p>丟掉 ${h.lost} 串</p>` : ''}
    ${h.fine ? `<p class="seaBad">偷拉別人的蚵串 ${h.stolen} 串，罰 $${h.fine}（從今天工錢扣）</p>` : ''}
    ${h.strings === 0 ? `<p>空手回來，阿婆分你 ${h.oy} 顆剝剝看。</p>` : ''}
    <p class="seaNote">回沙洲工寮剝蚵：這堆剝完就收工，拉越多剝越久、賺越多。</p>
    <button id="seaGo" type="button">回工寮開剝</button></div>`;
  e.classList.add('on'); R.root.classList.add('ended');
  (e.querySelector('#seaGo') as HTMLElement).onclick = () => { teardown(); o.onDone(h); };
  o.sfx?.('dock');
}
function teardown() {
  const R = S; if (!R) return;
  cancelAnimationFrame(R.raf);
  removeEventListener('keydown', R.onKey, true); removeEventListener('keyup', R.onKeyUp, true); removeEventListener('resize', R.onResize); removeEventListener('blur', R.onBlur);
  R.scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mm = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach(x => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); }); });
  R.renderer.dispose(); try { R.renderer.forceContextLoss(); } catch { /* */ }
  R.root.remove(); S = null;
}

function toast(t: string, sec = 2) { if (!S) return; S.el.seaToast.textContent = t; S.el.seaToast.classList.add('on'); S.toastT = sec; }

// ---------- 主迴圈 ----------
function loop(now: number) {
  const R = S; if (!R) return;
  R.raf = requestAnimationFrame(loop);
  if (document.hidden) { R.last = now; return; }
  const dt = Math.min(0.05, Math.max(0, (now - R.last) / 1000)); R.last = now;
  if (!R.ended) tick(R, dt);
  draw(R, now / 1000);
}
function tick(R: Run, dt: number) {
  const b = R.b;
  R.t += dt * fastK;
  const ebb = ebbOf(R.t, R.L.len), left = R.L.len - R.t;
  if (!R.warned && left <= SEA.warnAt) { R.warned = true; R.o.sfx?.('warn'); toast('快退潮了！30 秒內回碼頭，不然會擱淺', 3); }
  if (left <= 0) { end(finishHaul(R.loads, { fine: R.fine, stolen: R.stolen, lost: R.lost, stranded: true, secs: Math.round(R.t) })); return; }
  // 浪
  R.waveNext -= dt;
  if (R.waveNext <= 0) {
    R.wave = SEA.waveLen; R.waveDir = R.rng() * Math.PI * 2; R.waveNext = SEA.waveMin + R.rng() * (SEA.waveMax - SEA.waveMin);
    R.o.sfx?.('wave');
    let msg = '大浪打過來，船晃得厲害！';
    if (R.pullP > 0) { R.pullP = Math.max(0, R.pullP - SEA.wavePullLoss); msg = '大浪打過來，蚵串滑掉一點！'; }
    if (b.load / SEA.cap >= SEA.waveDropAt && R.loads.length && R.rng() < SEA.waveDropP) {
      let i = 0; R.loads.forEach((l, j) => { if (l.w < R.loads[i].w) i = j; });
      const l = R.loads.splice(i, 1)[0]; b.load -= l.w; R.lost++; msg = `大浪打過來，船太重，一串蚵仔（${l.oy} 顆）掉進海裡！`;
    }
    toast(msg, 2.2);
  }
  if (R.wave > 0) { R.wave -= dt; const k = SEA.wavePush * Math.sin(Math.PI * Math.max(0, R.wave) / SEA.waveLen); b.px = Math.cos(R.waveDir) * k; b.pz = Math.sin(R.waveDir) * k; }
  else { b.px = b.pz = 0; }
  const { thr, steer } = input(R);
  const st = stepBoat(b, R.L, ebb, thr, steer, dt);
  if (st.justGrounded) { R.o.sfx?.('ground'); toast('擱淺了！船太重卡在淺灘，丟幾串蚵才走得動', 3); }
  if (st.shoal && !R.shoalNow && !b.grounded) toast('船底刮到沙了，淺灘開不快', 1.4);
  R.shoalNow = st.shoal;
  // 拉蚵串／靠岸
  const dockD = Math.hypot(b.x - SEA.dock.x, b.z - SEA.dock.z);
  const atDock = dockD < SEA.dockR && R.t > 3;
  const s = atDock ? null : nearestStr(R.L, b);
  if (s !== R.pullTarget) { R.pullTarget = s; R.pullP = 0; }
  const slow = Math.abs(b.v) < SEA.pullMaxSpd;
  if (atDock) {
    if (R.pullOn) { R.pullOn = false; end(finishHaul(R.loads, { fine: R.fine, stolen: R.stolen, lost: R.lost, stranded: false, secs: Math.round(R.t) })); return; }
  } else if (s && R.pullOn && slow && !b.grounded) {
    R.pullP += dt / pullDur(s.w);
    if (R.pullP >= 1) { R.pullP = 0; finishPull(R, s); R.pullTarget = null; }
  } else if (!R.pullOn) R.pullP = Math.max(0, R.pullP - dt * 1.5);
  hud(R, ebb, left, s, atDock, slow, dt);
}

function hud(R: Run, ebb: number, left: number, s: Str | null, atDock: boolean, slow: boolean, dt: number) {
  const b = R.b, E = R.el;
  const sec = Math.max(0, Math.ceil(left));
  E.seaTime.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  E.seaTime.classList.toggle('bad', left <= SEA.warnAt);
  E.seaTideF.style.width = `${(1 - ebb) * 100}%`;
  const lf = b.load / SEA.cap, lim = groundLim(ebb);
  E.seaLoad.textContent = `${b.load}/${SEA.cap}`;
  E.seaLoadF.style.width = `${lf * 100}%`; E.seaLoadF.classList.toggle('bad', lf > lim);
  E.seaLim.style.left = `${lim * 100}%`;
  const oy = R.loads.reduce((a, l) => a + l.oy, 0), big = R.loads.reduce((a, l) => a + l.big, 0);
  E.seaSum.textContent = R.loads.length ? `${R.loads.length} 串・約 ${oy} 顆（大蚵 ${big}）${R.fine ? `・罰 $${R.fine}` : ''}` : '還沒拉到蚵串';
  E.seaBanner.textContent = b.grounded ? '擱淺了！載重超過紅線，丟幾串蚵才走得動' : '';
  E.seaBanner.classList.toggle('on', b.grounded);
  E.seaDrop.classList.toggle('on', R.loads.length > 0); E.seaDrop.classList.toggle('hot', b.grounded);
  const A = E.seaAct, T = E.seaActT;
  let label = '', show = true, warn = false, dis = false;
  if (atDock) label = R.loads.length ? '靠岸卸貨' : '空手上岸';
  else if (s) {
    const owned = R.L.rows[s.row].owned;
    warn = owned;
    if (b.grounded) { label = '擱淺中'; dis = true; }
    else if (!slow) { label = '慢一點才拉得到'; dis = true; }
    else label = owned ? `長按偷拉（別人家的・罰 $${SEA.finePerW * s.w}）` : `長按拉蚵串（${['輕', '中', '重'][s.w - 1]}・${pullDur(s.w).toFixed(1)} 秒）`;
  } else show = false;
  if (T.textContent !== label) T.textContent = label;
  A.classList.toggle('on', show); A.classList.toggle('warn', warn); A.classList.toggle('dis', dis); A.classList.toggle('dock', atDock);
  A.style.setProperty('--p', `${Math.round(R.pullP * 100)}%`);
  if (R.toastT > 0) { R.toastT -= dt; if (R.toastT <= 0) E.seaToast.classList.remove('on'); }
}

function draw(R: Run, t: number) {
  const b = R.b, ebb = ebbOf(R.t, R.L.len);
  // 退潮：水面下降，淺灘變大
  R.water.position.y = -0.35 * ebb;
  for (const m of R.shoalMs) { const r = shoalR(m.sh, ebb); m.s.scale.setScalar(r); m.rim.scale.setScalar(r * 1.45); m.s.position.y = 0.04; }
  const lf = b.load / SEA.cap;
  const wv = R.wave > 0 ? Math.sin(Math.PI * R.wave / SEA.waveLen) : 0;
  R.boatG.position.set(b.x, 0.12 - 0.32 * lf - 0.35 * ebb + Math.sin(t * 2.1) * 0.05 * (1 + 4 * wv), b.z);
  R.boatG.rotation.set(Math.sin(t * 1.7) * 0.03 + wv * Math.sin(t * 6) * 0.12, b.h, Math.sin(t * 1.3) * 0.04 + wv * Math.sin(t * 5) * 0.18);
  if (b.grounded) R.boatG.rotation.z = 0.08;
  // 船上的蚵串堆
  const n = Math.min(12, R.loads.length); R.stack.count = n;
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { d.position.set(-0.45 + (i % 3) * 0.45, 0.6 + Math.floor(i / 6) * 0.32, -1.1 + (Math.floor(i / 3) % 2) * 0.55); d.scale.setScalar(0.8 + 0.2 * R.loads[i].w); d.updateMatrix(); R.stack.setMatrixAt(i, d.matrix); }
  R.stack.instanceMatrix.needsUpdate = true;
  // 目標圈
  const s = R.pullTarget;
  R.ring.visible = !!s && !R.ended;
  if (s) { R.ring.position.set(s.x, 0.15, s.z); R.ring.scale.setScalar(0.9 + 0.12 * Math.sin(t * 6)); ((R.ring.material) as THREE.MeshBasicMaterial).color.setHex(R.L.rows[s.row].owned ? 0xd04030 : 0xffffff); }
  // 鏡頭：船後上方
  const fx = -Math.sin(b.h), fz = -Math.cos(b.h);
  const back = 10 + 3 * lf, up = 7;
  const tx = b.x - fx * back, tz = b.z - fz * back;
  R.cam.position.x += (tx - R.cam.position.x) * 0.08; R.cam.position.z += (tz - R.cam.position.z) * 0.08; R.cam.position.y = up + wv * Math.sin(t * 9) * 0.15;
  if (R.t < 0.05) R.cam.position.set(tx, up, tz);
  R.cam.lookAt(b.x + fx * 6, 0, b.z + fz * 6);
  R.renderer.render(R.scene, R.cam);
  R.mapT -= 1 / 60; if (R.mapT <= 0) { R.mapT = 0.12; drawMap(R, ebb); }
}

function drawMap(R: Run, ebb: number) {
  const c = R.map.getContext('2d'); if (!c) return;
  const W = R.map.width, H = R.map.height, B = SEA.bounds;
  const px = (x: number) => (x - B.x0) / (B.x1 - B.x0) * W, pz = (z: number) => (z - B.z0) / (B.z1 - B.z0) * H;
  const sx = W / (B.x1 - B.x0);
  c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(90,168,196,.92)'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#e2d3a6'; c.fillRect(0, pz(4), W, H - pz(4));
  c.fillStyle = '#dcc995';
  for (const s of R.L.shoals) { c.beginPath(); c.arc(px(s.x), pz(s.z), shoalR(s, ebb) * sx, 0, Math.PI * 2); c.fill(); }
  c.lineWidth = 2.2;
  for (const r of R.L.rows) { c.strokeStyle = r.owned ? '#d04030' : '#1d3f60'; c.beginPath(); c.moveTo(px(r.ax), pz(r.az)); c.lineTo(px(r.bx), pz(r.bz)); c.stroke(); }
  c.fillStyle = '#3a2a1a'; c.fillRect(px(SEA.dock.x) - 3, pz(SEA.dock.z), 6, 8);
  const b = R.b; c.save(); c.translate(px(b.x), pz(b.z)); c.rotate(-b.h); c.fillStyle = b.grounded ? '#d04030' : '#fff'; c.strokeStyle = '#1d3f60'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(-4, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
}

/** 測試／除錯：是不是在淺灘上 */
export const seaInShoal = () => (S ? inShoal(S.L, S.b.x, S.b.z, ebbOf(S.t, S.L.len)) : false);
