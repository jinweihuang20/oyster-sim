// 死鬥模式（測試）：獨立場景、獨立 renderer，不動存檔／金錢／成就／統計
import * as THREE from 'three';

type Part = 'head' | 'body' | 'legs';
interface Fighter {
  name: string; isPlayer: boolean; pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; pitch: number;
  hp: number; ammo: number; dead: boolean; respawnAt: number; invulnUntil: number;
  kills: number; deaths: number; hs: number; shots: number; hits: number;
  mesh: THREE.Group | null; cd: number; rig: { armR: THREE.Group; legL: THREE.Group; legR: THREE.Group } | null; throwA: number; walkPh: number; pickCd: number; umbT: number; umbHeld: boolean; umbTired: boolean; umbMesh: THREE.Object3D | null; goal: THREE.Vector3; idleUntil: number; pickT: number;
}
interface Shell { pos: THREE.Vector3; vel: THREE.Vector3; owner: Fighter; mesh: THREE.Mesh; life: number; }

const SPEED = 24, HALF = 18, MAXAMMO = 5, EYE = 1.6, R = 0.35;
const PILES = [[0, 0], [-13, -12], [13, 12], [-12, 12], [12, -12], [0, -6], [5, 15]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const PICK_R = 1.9;
// 掩體：木箱堆、藍色塑膠籃堆、剝蚵工作桌
type Kind = 'crate' | 'basket' | 'table';
const COVER_DEF: [number, number, number, number, number, Kind][] = [
  [-8, -6, 2.4, 1.2, 1.5, 'crate'], [8, 6, 2.4, 1.2, 1.5, 'crate'], [-7, 8, 2.2, 1.0, 1.3, 'basket'], [7, -8, 2.2, 1.0, 1.3, 'basket'],
  [0, 11, 3.0, 1.2, 1.0, 'table'], [0, -11, 3.0, 1.2, 1.0, 'table'], [-12, 0, 1.2, 2.6, 1.5, 'crate'], [12, 0, 1.0, 2.2, 1.3, 'basket'],
];
const COVERS: THREE.Box3[] = COVER_DEF.map(([x, z, w, d, h]) => new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)));
const SPAWNS = [[-15, -15], [15, 15], [-15, 15], [15, -15], [0, -16], [0, 16], [-16, 0], [16, 0]];

let active = false;
export const isDeathmatchActive = () => active;

export interface DmUmb {
  umb: { n: string; open: number; dur: number; cover: number }; model: THREE.Object3D;
  // 沿用上工場景的美術：阿婆模型、蚵殼幾何／材質、藤壺
  makeAma: (top: number, hair: number) => { g: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; pants: THREE.Material };
  shellGeos: THREE.BufferGeometry[]; shellMat: THREE.Material; greyPick: () => number;
  barnGeo: THREE.BufferGeometry; barnMat: THREE.Material; placeBarn: (list: THREE.Object3D[], dd: number, y?: number) => void;
}
export function openDeathmatch(U: DmUmb, onExit: () => void) {
  if (active) return; active = true;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const root = document.createElement('div'); root.id = 'dmRoot';
  root.innerHTML = `<style>
#dmRoot{position:fixed;inset:0;z-index:9000;background:#000;touch-action:none;user-select:none;-webkit-user-select:none;font-family:inherit}
#dmRoot canvas{position:absolute;inset:0;width:100%;height:100%}
#dmRoot .dmb{position:absolute;background:#c8102e;color:#fff6d8;border:3px solid #ffd23f;border-radius:10px;font-weight:900;font-size:18px;padding:10px 16px;box-shadow:0 3px 0 #6b0010;letter-spacing:2px}
#dmX{top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 10px);width:48px;height:48px;padding:0!important;font-size:24px!important}
#dmScoreBtn{top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 70px)}
#dmHud{position:absolute;left:calc(env(safe-area-inset-left) + 12px);top:calc(env(safe-area-inset-top) + 10px);color:#ffd23f;font-weight:900;font-size:18px;text-shadow:0 2px 0 #000;line-height:1.5;background:rgba(20,10,0,.55);border:2px solid #ffd23f;border-radius:8px;padding:6px 10px}
#dmCross{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none}
#dmCross:before,#dmCross:after{content:'';position:absolute;background:#fff;box-shadow:0 0 2px #000}
#dmCross:before{left:10px;top:0;width:2px;height:22px}#dmCross:after{top:10px;left:0;height:2px;width:22px}
#dmMark{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;pointer-events:none;opacity:0;border:3px solid #ff3b3b;transform:rotate(45deg);transition:opacity .25s}
#dmMsg{position:absolute;left:50%;top:30%;transform:translateX(-50%);color:#fff6d8;font-weight:900;font-size:28px;text-shadow:0 3px 0 #000;pointer-events:none;text-align:center}
.dmPop{position:absolute;color:#ffd23f;font-weight:900;font-size:22px;text-shadow:0 2px 0 #000;pointer-events:none;transform:translate(-50%,-50%);transition:transform .8s,opacity .8s}
#dmBoard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#2a1206;border:4px solid #ffd23f;border-radius:12px;color:#fff6d8;padding:14px 18px;display:none;min-width:300px;max-width:92vw}
#dmBoard.show{display:block}#dmBoard h2{margin:0 0 8px;color:#ffd23f;text-align:center;letter-spacing:4px}
#dmBoard table{border-collapse:collapse;width:100%;font-size:16px}#dmBoard td,#dmBoard th{padding:4px 8px;text-align:center;border-bottom:1px solid #6b3a12}
#dmBoard tr.me td{color:#ffd23f;font-weight:900}
#dmThrow{right:calc(env(safe-area-inset-right) + 20px);bottom:calc(env(safe-area-inset-bottom) + 30px);width:84px;height:84px;border-radius:50%!important;font-size:24px!important}
#dmPick{right:calc(env(safe-area-inset-right) + 120px);bottom:calc(env(safe-area-inset-bottom) + 30px)}
#dmUmb{right:calc(env(safe-area-inset-right) + 120px);bottom:calc(env(safe-area-inset-bottom) + 90px)}
#dmUmb.held{background:#ffd23f;color:#2a1206}
#dmJoy{position:absolute;left:calc(env(safe-area-inset-left) + 30px);bottom:calc(env(safe-area-inset-bottom) + 30px);width:120px;height:120px;border-radius:50%;border:3px solid rgba(255,210,63,.7);background:rgba(0,0,0,.25)}
#dmKnob{position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:rgba(255,210,63,.8)}
#dmHelp{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 12px);transform:translateX(-50%);color:#fff6d8;font-size:14px;text-shadow:0 1px 0 #000;pointer-events:none}
</style><canvas></canvas><div id="dmCross"></div><div id="dmMark"></div><div id="dmMsg"></div><div id="dmHud"></div>
<button class="dmb" id="dmScoreBtn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" style="vertical-align:-3px"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg> 戰績</button>
<button class="dmb" id="dmX" aria-label="離開">✕</button><div id="dmBoard"><h2>戰績</h2><div id="dmTable"></div></div>
${isTouch ? '<div id="dmJoy"><div id="dmKnob"></div></div><button class="dmb" id="dmPick">拿殼</button><button class="dmb" id="dmUmb">雨傘</button><button class="dmb" id="dmThrow">丟</button>' : '<div id="dmHelp">點畫面鎖定滑鼠｜WASD 移動｜左鍵 丟｜E 拿殼｜按住 R 雨傘｜Tab 戰績｜Esc 放開滑鼠</div>'}`;
  document.body.appendChild(root);
  const q = (id: string) => root.querySelector('#' + id) as HTMLElement;
  const canvas = root.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a3050); scene.fog = new THREE.Fog(0x4a3a50, 14, 44);
  const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 100); cam.rotation.order = 'YXZ';
  const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], parent: THREE.Object3D = scene, shadow = true) => { const x = new THREE.Mesh(g, m); x.position.set(...p); x.castShadow = shadow; x.receiveShadow = true; parent.add(x); return x; };
  // 黃昏漁港燈光（同上工場景色調，亮度調高方便瞄準）
  scene.add(new THREE.HemisphereLight(0xc08a9a, 0x201810, 1.0));
  const sun = new THREE.DirectionalLight(0xff9a60, 1.1); sun.position.set(-12, 16, -18); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 60 }); sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.002; scene.add(sun);
  // 水泥地＋水漬
  add(new THREE.PlaneGeometry(HALF * 2 + 4, HALF * 2 + 4), M(0x5a544c, { roughness: 0.95 }), [0, 0, 0]).rotation.x = -Math.PI / 2;
  const stain = M(0x3e3c38, { roughness: 0.3, transparent: true, opacity: 0.5 }), stainG = new THREE.CircleGeometry(1, 12);
  for (let i = 0; i < 18; i++) { const d = add(stainG, stain, [(Math.random() - .5) * 32, 0.01, (Math.random() - .5) * 32], scene, false); d.rotation.x = -Math.PI / 2; d.scale.set(0.6 + Math.random() * 1.6, 0.4 + Math.random(), 1); }
  // 四周鐵皮工寮牆
  const tin = M(0x6f7a80, { roughness: 0.6, metalness: 0.3 }), tinD = M(0x56606a, { roughness: 0.6, metalness: 0.3 }), rib = new THREE.BoxGeometry(0.08, 3, 0.08);
  for (const [x, z, w, d] of [[0, -HALF, HALF * 2, .3], [0, HALF, HALF * 2, .3], [-HALF, 0, .3, HALF * 2], [HALF, 0, .3, HALF * 2]]) {
    add(new THREE.BoxGeometry(w, 3, d), tin, [x, 1.5, z]);
    const n = Math.round(Math.max(w, d) / 0.6); for (let k = 0; k < n; k++) { const t = -Math.max(w, d) / 2 + (k + .5) * Math.max(w, d) / n; add(rib, tinD, w > d ? [t, 1.5, z - Math.sign(z) * 0.18] : [x - Math.sign(x) * 0.18, 1.5, t], scene, false); }
  }
  // 掩體
  const wood = M(0x8a6440), woodD = M(0x5e4128), blue = M(0x2a6ad0, { roughness: 0.5 }), tableTop = M(0x9a9a92, { roughness: 0.4, metalness: 0.4 }), steel = M(0x707070, { metalness: 0.5, roughness: 0.4 });
  for (const [x, z, w, d, h, k] of COVER_DEF) {
    if (k === 'crate') { const nx = Math.round(Math.max(w, d) / 1.2), along = w >= d; for (let i = 0; i < nx; i++) for (let j = 0; j < 2; j++) { const off = -Math.max(w, d) / 2 + (i + .5) * Math.max(w, d) / nx, sz = Math.min(w, d);
      const c = add(new THREE.BoxGeometry(along ? Math.max(w, d) / nx - 0.04 : sz, h / 2 - 0.02, along ? sz : Math.max(w, d) / nx - 0.04), wood, [along ? x + off : x, h / 4 + j * h / 2, along ? z : z + off]); c.rotation.y = (Math.random() - .5) * 0.06;
      add(new THREE.BoxGeometry(along ? Math.max(w, d) / nx : sz + 0.02, 0.06, along ? sz + 0.02 : Math.max(w, d) / nx), woodD, [along ? x + off : x, j * h / 2 + h / 4, along ? z : z + off], scene, false); } }
    else if (k === 'basket') { const along = w >= d, n = Math.round(Math.max(w, d) / 0.55); for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { const off = -Math.max(w, d) / 2 + (i + .5) * Math.max(w, d) / n;
      add(new THREE.BoxGeometry(along ? 0.52 : Math.min(w, d), h / 4 - 0.02, along ? Math.min(w, d) : 0.52), blue, [along ? x + off : x, h / 8 + j * h / 4, along ? z : z + off]); } }
    else { add(new THREE.BoxGeometry(w, 0.06, d), tableTop, [x, h - 0.03, z]); add(new THREE.BoxGeometry(w - 0.1, h - 0.1, 0.04), steel, [x, (h - 0.06) / 2, z]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.06, h, 0.06), steel, [x + sx * (w / 2 - 0.05), h / 2, z + sz * (d / 2 - 0.05)]);
      for (let i = 0; i < 10; i++) { const sh = add(U.shellGeos[i % 6], U.shellMat, [x + (Math.random() - .5) * (w - .3), h + 0.03, z + (Math.random() - .5) * (d - .3)]); sh.rotation.y = Math.random() * 6; } }
  }
  // 裝飾：紅色塑膠椅、水桶、路燈
  const red = M(0xd04040, { roughness: 0.5 }), stoolG = new THREE.CylinderGeometry(0.17, 0.15, 0.3, 10);
  for (const [x, z] of [[-15, -3], [-14.6, -2.4], [15, 4], [6, 16], [-6, -16], [3, -15.5]]) add(stoolG, red, [x, 0.15, z]);
  for (const [x, z, c] of [[16.5, -16.5, 0xd07a2a], [-16.5, 16.5, 0x3a8a4a], [16.5, 9, 0x3a8a4a]] as const) add(new THREE.CylinderGeometry(0.22, 0.17, 0.45, 10), M(c), [x, 0.22, z]);
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (const [x, z] of [[-17, -17], [17, 17], [-17, 17], [17, -17]]) { add(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), steel, [x * 0.97, 1.7, z * 0.97]); add(new THREE.SphereGeometry(0.12, 8, 6), glowM, [x * 0.97, 3.4, z * 0.97], scene, false);
    const l = new THREE.PointLight(0xffb060, 18, 14, 1.6); l.position.set(x * 0.93, 3.3, z * 0.93); scene.add(l); }
  // 蚵仔堆：共用上工的蚵殼幾何／材質，InstancedMesh
  const coneM = M(0x6a7c94, { roughness: 0.95, emissive: 0x24262a }), coneG = new THREE.ConeGeometry(0.9, 0.55, 10), dmy = new THREE.Object3D(), col = new THREE.Color();
  PILES.forEach((pp, pi) => {
    add(coneG, coneM, [pp.x, 0.27, pp.z]);
    const im = new THREE.InstancedMesh(U.shellGeos[pi % U.shellGeos.length], U.shellMat, 160); im.castShadow = true;
    for (let i = 0; i < 160; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.0, hh = Math.max(0, 0.55 * (1 - r / 0.95)); dmy.position.set(pp.x + Math.cos(a) * r, hh + 0.03, pp.z + Math.sin(a) * r); dmy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); dmy.updateMatrix(); im.setMatrixAt(i, dmy.matrix); im.setColorAt(i, col.setHex(U.greyPick())); }
    scene.add(im);
  });
  // 丟出去的殼：上工那顆真蚵殼＋藤壺，放大一點好看清楚
  function shellMesh() {
    const m = new THREE.Mesh(U.shellGeos[Math.floor(Math.random() * U.shellGeos.length)], U.shellMat); m.scale.setScalar(1.7); m.castShadow = true;
    const bl: THREE.Object3D[] = []; for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(U.barnGeo, U.barnMat); m.add(b); bl.push(b); } U.placeBarn(bl, 2); return m;
  }
  // 阿婆：沿用上工的阿婆模型，藏起板凳和坐姿小腿，改成站姿雙腿
  function makeBot(top: number, hair: number) {
    const outer = new THREE.Group(); const a = U.makeAma(top, hair);
    a.g.children.forEach(c => { if ((c as THREE.Mesh).isMesh && c.position.y < 0.4) c.visible = false; });
    a.g.scale.setScalar(1.25); a.g.position.y = 0.39; outer.add(a.g);
    const leg = (sx: number) => { const p = new THREE.Group(); p.position.set(sx, 0.8, 0); outer.add(p);
      add(new THREE.CylinderGeometry(0.075, 0.06, 0.78, 6), a.pants, [0, -0.4, 0], p); add(new THREE.BoxGeometry(0.11, 0.03, 0.24), M(0xf2f2ee), [0, -0.78, -0.04], p); add(new THREE.BoxGeometry(0.115, 0.035, 0.04), M(0x2f5fb8), [0, -0.76, -0.1], p); return p; };
    const legL = leg(-0.12), legR = leg(0.12);
    outer.traverse(o => { o.castShadow = true; }); scene.add(outer);
    return { outer, rig: { armR: a.armR, legL, legR } };
  }
  const mk = (name: string, isPlayer: boolean, color: number): Fighter => ({ name, isPlayer, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, ammo: 0, dead: false, respawnAt: 0, invulnUntil: 0, kills: 0, deaths: 0, hs: 0, shots: 0, hits: 0, mesh: null, rig: null, throwA: 0, walkPh: 0, pickCd: 0, cd: 1, umbT: 0, umbHeld: false, umbTired: false, umbMesh: null, goal: new THREE.Vector3(), idleUntil: 0, pickT: 0 });
  const me = mk('你', true, 0);
  const fighters: Fighter[] = [me, mk('阿婆 A', false, 0), mk('阿婆 B', false, 0), mk('阿婆 C', false, 0)];
  ([[0xc84a6a, 0xdddddd], [0x3a7a5a, 0xbbbbbb], [0x6a5aa0, 0x888888]] as const).forEach(([t, h], i) => { const b = makeBot(t, h); fighters[i + 1].mesh = b.outer; fighters[i + 1].rig = b.rig; });
  const shells: Shell[] = [];
  // 雨傘：沿用上工的傘（目前裝備的傘外觀與開傘／可撐／遮擋數值）
  scene.add(cam);
  me.umbMesh = U.model; U.model.visible = false; cam.add(U.model);
  for (const f of fighters) if (f.mesh) { const m = U.model.clone(true); m.visible = false; m.position.set(0, 1.35, -0.5); m.rotation.set(-Math.PI / 2.4, 0, 0); m.scale.setScalar(0.8); f.mesh.add(m); f.umbMesh = m; }
  const umbUp = (f: Fighter) => f.umbHeld && (U.umb.open + U.umb.dur - f.umbT) >= U.umb.open;
  function openUmb(f: Fighter) { if (f.dead || f.umbHeld || f.umbTired) return; f.umbHeld = true; f.umbT = U.umb.open + U.umb.dur; }
  function closeUmb(f: Fighter) { f.umbTired = false; f.umbHeld = false; f.umbT = 0; }
  let now = 0;
  function spawn(f: Fighter) {
    const opts = SPAWNS.map(([x, z]) => new THREE.Vector3(x, 0, z)).sort((a, b) => minDist(b, f) - minDist(a, f));
    f.pos.copy(opts[Math.floor(Math.random() * 3)]); f.vel.set(0, 0, 0); f.hp = 100; f.ammo = MAXAMMO; f.dead = false;
    f.invulnUntil = now + 3; f.idleUntil = now + 1; f.umbHeld = false; f.umbTired = false; f.umbT = 0; f.yaw = Math.atan2(-f.pos.x, -f.pos.z) + Math.PI; f.pitch = 0; f.goal.copy(nearPile(f.pos)); f.pickT = 0;
  }
  const nearPile = (p: THREE.Vector3) => PILES.reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a));
  const pileDist = (p: THREE.Vector3) => { const n = nearPile(p); return Math.hypot(n.x - p.x, n.z - p.z); };
  const minDist = (p: THREE.Vector3, self: Fighter) => Math.min(...fighters.filter(o => o !== self && !o.dead).map(o => o.pos.distanceTo(p)), 99);
  fighters.forEach(spawn);

  // ---- 輸入 ----
  const keys: Record<string, boolean> = {}; const joy = { x: 0, y: 0 }; let holdPick = false;
  const blur = () => { for (const k in keys) keys[k] = false; closeUmb(me); holdPick = false; };
  addEventListener('blur', blur);
  let locked = false;
  const onKey = (e: KeyboardEvent, d: boolean) => {
    keys[e.code] = d;
    if (e.code === 'Tab') { e.preventDefault(); q('dmBoard').classList.toggle('show', d); if (d) renderBoard(); }
    if (d && e.code === 'KeyE') pick(me);
    if (e.code === 'KeyR' && !e.repeat) d ? openUmb(me) : closeUmb(me);
  };
  const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const plc = () => { locked = document.pointerLockElement === canvas; };
  document.addEventListener('pointerlockchange', plc);
  canvas.addEventListener('mousedown', e => { if (isTouch) return; if (!locked) { canvas.requestPointerLock?.(); return; } if (e.button === 0) throwShell(me); });
  canvas.addEventListener('mousemove', e => { if (!locked) return; me.yaw -= e.movementX * 0.0025; me.pitch = clampP(me.pitch - e.movementY * 0.0025); });
  const clampP = (p: number) => Math.max(-1.3, Math.min(1.3, p));
  if (isTouch) {
    // 多指同時操作：用 pointerId 分開追蹤搖桿、轉視角、各個按鈕
    const jo = q('dmJoy'), kn = q('dmKnob'), ptr = new Map<number, { k: 'joy' | 'look' | 'btn'; el?: HTMLElement; x: number; y: number }>();
    const joyAt = (x: number, y: number) => { const r = jo.getBoundingClientRect(); let jx = (x - r.left - 60) / 50, jy = (y - r.top - 60) / 50; const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; } joy.x = jx; joy.y = jy; kn.style.transform = `translate(${jx * 35}px,${jy * 35}px)`; };
    root.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return; const t = e.target as HTMLElement, b = t.closest('button') as HTMLElement | null;
      if (b) { if (b.id === 'dmUmb') openUmb(me); if (b.id === 'dmPick') holdPick = true; ptr.set(e.pointerId, { k: 'btn', el: b, x: e.clientX, y: e.clientY }); return; }
      if (t.closest('#dmJoy')) { ptr.set(e.pointerId, { k: 'joy', x: e.clientX, y: e.clientY }); joyAt(e.clientX, e.clientY); }
      else ptr.set(e.pointerId, { k: 'look', x: e.clientX, y: e.clientY });
    });
    root.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return;
      if (p.k === 'joy') joyAt(e.clientX, e.clientY);
      else if (p.k === 'look') { me.yaw -= (e.clientX - p.x) * 0.006; me.pitch = clampP(me.pitch - (e.clientY - p.y) * 0.006); }
      p.x = e.clientX; p.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId);
      if (p.k === 'joy') { joy.x = joy.y = 0; kn.style.transform = ''; }
      if (p.k === 'btn' && p.el) {
        if (p.el.id === 'dmUmb') closeUmb(me);
        if (p.el.id === 'dmPick') { holdPick = false; if (e.type === 'pointerup') pick(me); }
        if (p.el.id === 'dmThrow' && e.type === 'pointerup') throwShell(me); // 放開才發射
      }
    };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  }
  q('dmScoreBtn').onclick = () => { q('dmBoard').classList.toggle('show'); renderBoard(); };
  q('dmX').onclick = () => exit();

  // ---- 遊戲邏輯 ----
  function pick(f: Fighter) {
    if (f.dead || f.ammo >= MAXAMMO) return false;
    if (pileDist(f.pos) > PICK_R) { if (f.isPlayer) msg('離蚵仔堆太遠了', 1); return false; }
    f.ammo = MAXAMMO; return true;
  }
  function eyeOf(f: Fighter) { return new THREE.Vector3(f.pos.x, f.pos.y + EYE, f.pos.z); }
  function dirOf(yaw: number, pitch: number) { return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
  function throwShell(f: Fighter, yaw = f.yaw, pitch = f.pitch) {
    if (f.dead) return false;
    if (f.umbHeld) { if (f.isPlayer) msg('撐傘時不能丟，先放開雨傘', 1); return false; }
    if (f.ammo <= 0) { if (f.isPlayer) msg('沒殼了，去蚵仔堆拿', 1); return false; }
    f.ammo--; f.shots++; if (f.isPlayer) f.invulnUntil = 0;
    const d = dirOf(yaw, pitch); const p = eyeOf(f).addScaledVector(d, 0.4);
    const m = shellMesh(); m.position.copy(p); scene.add(m); f.throwA = 0.35;
    shells.push({ pos: p, vel: d.multiplyScalar(SPEED).add(f.vel.clone().multiplyScalar(0.5)), owner: f, mesh: m, life: 6 });
    return true;
  }
  // 點是否在某人的命中區（頭為球，身體與腳為圓柱）
  function hitPart(f: Fighter, p: THREE.Vector3): Part | null {
    const dx = p.x - f.pos.x, dz = p.z - f.pos.z, y = p.y - f.pos.y, h = Math.hypot(dx, dz);
    if (Math.hypot(h, y - 1.665) < 0.22) return 'head';
    if (h < 0.34 && y >= 0.8 && y < 1.5) return 'body';
    if (h < 0.24 && y >= 0 && y < 0.8) return 'legs';
    return null;
  }
  function hitWorld(p: THREE.Vector3) {
    if (p.y <= 0 || Math.abs(p.x) >= HALF - 0.2 || Math.abs(p.z) >= HALF - 0.2) return true;
    return COVERS.some(b => b.containsPoint(p));
  }
  function damage(src: Fighter, f: Fighter, part: Part, at: THREE.Vector3) {
    src.hits++;
    if (f.dead) return;
    const inv = now < f.invulnUntil;
    if (src.isPlayer) { popAt(at, inv ? '無敵' : part === 'head' ? '爆頭' : part === 'body' ? '身體' : '腳'); mark(); }
    if (inv) return;
    f.hp -= part === 'head' ? 999 : part === 'body' ? 40 : 20;
    if (f.isPlayer) flashHurt();
    if (f.hp <= 0) {
      f.dead = true; f.deaths++; f.respawnAt = now + 3; f.ammo = 0; src.kills++; if (part === 'head') src.hs++;
      if (f.mesh) f.mesh.visible = false;
      if (f.isPlayer) msg(`被 ${src.name} 擊倒${part === 'head' ? '（爆頭）' : ''}，3 秒後復活`, 3);
      else if (src.isPlayer) msg(`擊倒 ${f.name}${part === 'head' ? '（爆頭）' : ''}`, 1.5);
    }
  }
  function stepShells(dt: number) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i]; const a = s.pos.clone();
      const b = a.clone().addScaledVector(s.vel, dt); s.life -= dt;
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.08)); let done = false;
      for (let k = 1; k <= n && !done; k++) {
        const p = a.clone().lerp(b, k / n);
        for (const f of fighters) { if (f === s.owner || f.dead) continue;
          if (umbUp(f) && Math.hypot(p.x - f.pos.x, p.z - f.pos.z) < 0.9 && p.y > f.pos.y + 0.3 && p.y < f.pos.y + 2.2) {
            const fwd = dirOf(f.yaw, 0), inc = s.vel.clone().setY(0).normalize();
            if (-fwd.dot(inc) > Math.cos(Math.PI / 3) && Math.random() < U.umb.cover) { if (f.isPlayer) msg('擋下來了！', 0.8); else if (s.owner.isPlayer) popAt(p, '被傘擋'); done = true; break; }
          }
          const part = hitPart(f, p); if (part) { damage(s.owner, f, part, p); done = true; break; } }
        if (!done && hitWorld(p)) done = true;
      }
      s.pos.copy(b); s.mesh.position.copy(b); s.mesh.rotation.y += dt * 20; s.mesh.rotation.x += dt * 9;
      if (done || s.life <= 0) { scene.remove(s.mesh); shells.splice(i, 1); }
    }
  }
  function collide(f: Fighter) {
    f.pos.x = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, f.pos.x)); f.pos.z = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, f.pos.z));
    for (const b of COVERS) {
      const cx = Math.max(b.min.x, Math.min(b.max.x, f.pos.x)), cz = Math.max(b.min.z, Math.min(b.max.z, f.pos.z));
      const dx = f.pos.x - cx, dz = f.pos.z - cz, d = Math.hypot(dx, dz);
      if (d < R) { if (d < 1e-4) { f.pos.x += R; continue; } f.pos.x = cx + dx / d * R; f.pos.z = cz + dz / d * R; }
    }
  }
  // 直線仰角：水平距離 d、高差 dy
  function launchPitch(d: number, dy: number) {
    return Math.atan2(dy, d); // 直線彈道
  }
  function botThink(f: Fighter, dt: number) {
    if (now < f.idleUntil) { f.vel.set(0, 0, 0); return; }
    if (f.umbHeld) { if (!shells.some(s => s.owner !== f && s.pos.distanceTo(f.pos) < 8)) closeUmb(f); }
    else if (f.cd > 0.4) for (const s of shells) { if (s.owner === f) continue; const rel = f.pos.clone().sub(s.pos); rel.y = 0; if (rel.length() < 8 && rel.normalize().dot(s.vel.clone().setY(0).normalize()) > 0.95 && Math.random() < 0.02) { f.yaw = Math.atan2(s.pos.x - f.pos.x, s.pos.z - f.pos.z) + Math.PI; openUmb(f); break; } }
    const targets = fighters.filter(o => o !== f && !o.dead);
    let tgt: Fighter | null = null, best = 1e9;
    for (const o of targets) { const d = o.pos.distanceTo(f.pos) * (o.isPlayer ? 0.8 : 1); if (d < best) { best = d; tgt = o; } }
    if (f.ammo === 0 || (f.pickT > 0 && f.ammo < MAXAMMO)) {
      f.goal.copy(nearPile(f.pos)); f.pickT = 1; // 去最近的蚵仔堆，經過就會自動撿
    } else if (f.pos.distanceTo(f.goal) < 1.5 || Math.random() < dt * 0.3) {
      f.pickT = 0; const base = tgt ? tgt.pos : nearPile(f.pos); const a = Math.random() * 6.28, r = 7 + Math.random() * 6;
      f.goal.set(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
    }
    const to = f.goal.clone().sub(f.pos); to.y = 0;
    if (to.length() > 0.3) f.vel.copy(to.normalize().multiplyScalar(3.6)); else f.vel.set(0, 0, 0);
    if (tgt && !f.umbHeld) {
      // 預判：用飛行時間估計目標位置
      let aim = tgt.pos.clone(); for (let k = 0; k < 3; k++) { const t = eyeOf(f).distanceTo(aim) / (SPEED * 0.95); aim = tgt.pos.clone().addScaledVector(tgt.vel, t); }
      aim.y += 1.15 + (Math.random() < 0.15 ? 0.45 : 0);
      const e = eyeOf(f), dx = aim.x - e.x, dz = aim.z - e.z, d = Math.hypot(dx, dz);
      f.yaw = Math.atan2(-dx, -dz); f.pitch = launchPitch(d, aim.y - e.y);
      f.cd -= dt;
      if (f.ammo > 0 && f.cd <= 0 && d < 22) { const err = 0.02 + d * 0.0025; throwShell(f, f.yaw + (Math.random() - .5) * err * 2, f.pitch + (Math.random() - .5) * err * 2); f.cd = 1.1 + Math.random() * 1.2; }
    } else f.yaw = Math.atan2(-f.vel.x, -f.vel.z);
  }
  function update(dt: number) {
    now += dt;
    for (const f of fighters) {
      if (f.dead) { f.vel.set(0, 0, 0); if (now >= f.respawnAt) { spawn(f); if (f.mesh) f.mesh.visible = true; if (f.isPlayer) msg('', 0); } continue; }
      if (f.umbHeld) { f.umbT -= dt; if (f.umbT <= 0) { f.umbHeld = false; f.umbTired = true; f.umbT = 0; if (f.isPlayer) msg('手痠了，放開再重新撐傘', 1.5); } }
      if (f.umbMesh) f.umbMesh.visible = f.umbHeld;
      // 邊走邊撿：在蚵仔堆旁邊每 0.2 秒自動補一顆（按住拿殼／E 一次補滿）
      if (f.ammo < MAXAMMO && pileDist(f.pos) <= PICK_R) { f.pickCd -= dt; if (f.pickCd <= 0) { f.ammo++; f.pickCd = 0.2; } } else f.pickCd = 0;
      if (f.isPlayer && (holdPick || keys.KeyE)) pick(f);
      if (f.isPlayer) {
        let fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x, fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + joy.y;
        const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
        const s = Math.sin(f.yaw), c = Math.cos(f.yaw);
        f.vel.set((fx * c + fz * s) * 5, 0, (-fx * s + fz * c) * 5);
      } else botThink(f, dt);
      if (f.vel.lengthSq() > 0.01) f.invulnUntil = Math.min(f.invulnUntil, now); // 一開始移動就結束無敵
      f.pos.addScaledVector(f.vel, dt); collide(f);
      if (f.rig) { const sp = f.vel.length(); f.walkPh += dt * sp * 2.6; const sw = Math.sin(f.walkPh) * Math.min(1, sp / 3) * 0.6; f.rig.legL.rotation.x = sw; f.rig.legR.rotation.x = -sw;
        f.throwA = Math.max(0, f.throwA - dt); f.rig.armR.rotation.x = f.throwA > 0 ? -2.2 * Math.sin((f.throwA / 0.35) * Math.PI) : f.umbHeld ? -0.8 : 0; }
      if (f.mesh) { f.mesh.position.copy(f.pos); f.mesh.rotation.y = f.yaw; f.mesh.visible = now < f.invulnUntil ? Math.floor(now * 10) % 2 === 0 : true; }
    }
    stepShells(dt);
  }

  // ---- UI ----
  let msgT = 0;
  function msg(t: string, sec: number) { q('dmMsg').textContent = t; msgT = sec; }
  let markT = 0; function mark() { q('dmMark').style.opacity = '1'; markT = 0.25; }
  function flashHurt() { root.style.boxShadow = 'inset 0 0 80px #f00'; setTimeout(() => root.style.boxShadow = '', 150); }
  function popAt(p: THREE.Vector3, t: string) {
    const v = p.clone().project(cam); if (v.z > 1) return;
    const el = document.createElement('div'); el.className = 'dmPop'; el.textContent = t;
    el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; root.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-150%)'; el.style.opacity = '0'; }); setTimeout(() => el.remove(), 900);
  }
  function renderBoard() {
    const rows = [...fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    q('dmTable').innerHTML = `<table><tr><th>名字</th><th>擊倒</th><th>倒下</th><th>爆頭</th><th>命中率</th></tr>${rows.map(f => `<tr class="${f.isPlayer ? 'me' : ''}"><td>${f.name}</td><td>${f.kills}</td><td>${f.deaths}</td><td>${f.hs}</td><td>${f.shots ? Math.round(f.hits / f.shots * 100) : 0}%</td></tr>`).join('')}</table>`;
  }
  function hud() {
    const atPile = pileDist(me.pos) <= PICK_R;
    if (isTouch) q('dmUmb').classList.toggle('held', me.umbHeld);
    q('dmHud').innerHTML = `血量 ${Math.max(0, me.hp)}<br>殼 ${me.ammo} / ${MAXAMMO}${now < me.invulnUntil && !me.dead ? '<br>無敵中' : ''}${me.umbHeld ? '<br>撐傘中' : me.umbTired ? '<br>手痠，放開雨傘' : ''}${atPile && me.ammo < MAXAMMO && !me.dead ? '<br>撿殼中' : ''}`;
    if (q('dmBoard').classList.contains('show')) renderBoard();
  }

  // ---- 迴圈 ----
  let raf = 0, last = performance.now(), hudT = 0;
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  function loop() {
    raf = requestAnimationFrame(loop);
    const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
    update(dt);
    cam.position.copy(eyeOf(me)); if (me.dead) cam.position.y = 0.4; cam.rotation.set(me.pitch, me.yaw, 0);
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) q('dmMsg').textContent = ''; }
    if (markT > 0) { markT -= dt; if (markT <= 0) q('dmMark').style.opacity = '0'; }
    if ((hudT -= dt) <= 0) { hud(); hudT = 0.1; }
    renderer.render(scene, cam);
  }
  loop(); msg('死鬥（測試）：殼丟完就去蚵仔堆補', 2.5);

  function exit() {
    cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', resize); removeEventListener('blur', blur);
    document.removeEventListener('pointerlockchange', plc); if (document.pointerLockElement === canvas) document.exitPointerLock();
    renderer.dispose(); root.remove(); active = false; delete (window as any).__dm; onExit();
  }
  // 測試掛勾
  (window as any).__dm = { fighters, shells, me, pick, openUmb, closeUmb, throwShell, update, exit, renderBoard, launchPitch, get now() { return now; } };
}
