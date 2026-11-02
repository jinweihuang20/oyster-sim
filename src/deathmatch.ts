// 死鬥模式（測試）：獨立場景、獨立 renderer，不動存檔／金錢／成就／統計
import * as THREE from 'three';

type Part = 'head' | 'body' | 'legs';
interface Fighter {
  name: string; isPlayer: boolean; pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; pitch: number;
  hp: number; ammo: number; dead: boolean; respawnAt: number; invulnUntil: number;
  kills: number; deaths: number; hs: number; shots: number; hits: number;
  mesh: THREE.Group | null; cd: number; stepAcc: number; deathAt: number; fallDir: THREE.Vector3; hpBar: { g: THREE.Group; fill: THREE.Mesh; bg: THREE.MeshBasicMaterial; fm: THREE.MeshBasicMaterial } | null; rig: { armR: THREE.Group; legL: THREE.Group; legR: THREE.Group } | null; throwA: number; walkPh: number; pickCd: number; umbT: number; umbHeld: boolean; umbTired: boolean; umbMesh: THREE.Object3D | null; goal: THREE.Vector3; idleUntil: number; pickT: number;
}
interface Shell { pos: THREE.Vector3; vel: THREE.Vector3; owner: Fighter; mesh: THREE.Mesh; life: number; }

const SPEED = 24, HALF = 18, MAXAMMO = 15, EYE = 1.6, R = 0.35;
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

// 線條圖示（同遊戲 icons.css 風格：方角粗線、無 emoji）
const ico = (d: string, sz = 22) => `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" style="vertical-align:-4px">${d}</svg>`;
const I = {
  shell: '<path d="M4 15c0-6 4-10 8-10s8 4 8 10c-3 2-13 2-16 0z"/><path d="M8 9l1 6M12 7v8M16 9l-1 6"/>',
  throw: '<path d="M4 18c4-9 10-12 16-12"/><path d="M15 3l5 3-3 5"/>',
  grab: '<path d="M7 11V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V12M16 9.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.6L7 14"/>',
  umb: '<path d="M2 12a10 10 0 0120 0z"/><path d="M12 12v7a2 2 0 01-4 0"/><path d="M12 2v2"/>',
  board: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  heart: '<path d="M12 20l-8-8a4.5 4.5 0 016.5-6.3L12 7l1.5-1.3A4.5 4.5 0 0120 12z"/>',
  skull: '<path d="M5 11a7 7 0 0114 0v4h-2v4H7v-4H5z"/><path d="M9 11h.1M15 11h.1"/><path d="M10 19v-2M14 19v-2"/>',
  head: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  x: '<path d="M5 5l14 14M19 5L5 19"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
};
type DS = { sens: number; tsens: number; invY: boolean; assist: boolean; btn: number; op: number };
const DS_DEF: DS = { sens: 1, tsens: 1, invY: false, assist: true, btn: 1, op: 0.85 };
function loadDS(): DS { try { return { ...DS_DEF, ...JSON.parse(localStorage.getItem('oyster-dm-set') || '{}') }; } catch { return { ...DS_DEF }; } }
let active = false;
export const isDeathmatchActive = () => active;

export interface DmUmb {
  umb: { n: string; open: number; dur: number; cover: number }; model: THREE.Object3D;
  // 沿用上工場景的美術：阿婆模型、蚵殼幾何／材質、藤壺
  makeAma: (top: number, hair: number) => { g: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; pants: THREE.Material };
  shellGeos: THREE.BufferGeometry[]; shellMat: THREE.Material; greyPick: () => number;
  audio: () => AudioContext; sfxOut: () => AudioNode; gore: () => boolean;
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
#dmHp{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 64px);width:min(42vw,280px);height:26px;background:#2a1206;border:3px solid #ffd23f;border-radius:8px;box-shadow:0 3px 0 #6b0010;overflow:hidden;pointer-events:none}
#dmHpF{position:absolute;left:0;top:0;bottom:0;width:100%;background:#3c3;transition:width .15s}
#dmHpN{position:absolute;inset:0;text-align:center;color:#fff6d8;font-weight:900;font-size:16px;line-height:20px;text-shadow:0 2px 0 #000;letter-spacing:1px}
#dmHp.hit{animation:dmHit .3s}@keyframes dmHit{0%{border-color:#fff;transform:translateX(-50%) scale(1.08)}100%{border-color:#ffd23f;transform:translateX(-50%)}}
#dmEdge{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 20px rgba(220,0,0,.75);opacity:0;transition:opacity .35s}
#dmEdge.on{opacity:1;transition:none}
#dmFeed{position:fixed;right:calc(env(safe-area-inset-right) + 12px);top:calc(env(safe-area-inset-top) + 70px);display:flex;flex-direction:column;gap:4px;align-items:flex-end;pointer-events:none}
#dmFeed div{background:rgba(42,18,6,.8);border:2px solid #ffd23f;border-radius:6px;color:#fff6d8;font-weight:900;padding:2px 8px;font-size:15px;transition:opacity .4s}
#dmFeed .me{color:#ffd23f}
#dmHud.empty{border-color:#ff3b3b;color:#ff3b3b}
#dmUmb.cd{opacity:.45}
.dmPop svg{filter:drop-shadow(0 2px 0 #000)}
#dmRoot.dead canvas{filter:saturate(.3) brightness(.75)}
#dmRoot.dead #dmEdge{opacity:.8}
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
#dmRoot{--bs:1;--bo:.85}
#dmRoot .ctl{opacity:var(--bo);transform:scale(var(--bs));transform-origin:bottom right}
#dmSetBtn{top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 130px);width:48px;height:48px;padding:0!important}
#dmScoreBtn{width:48px;height:48px;padding:0!important}
#dmSet{position:absolute;inset:0;background:rgba(10,5,0,.6);display:none;align-items:center;justify-content:center;z-index:5}
#dmSet.show{display:flex}
#dmSetBox{position:relative;background:#2a1206;border:4px solid #ffd23f;border-radius:12px;color:#fff6d8;padding:0 16px 14px;width:min(92vw,360px);max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px);overflow:auto;touch-action:pan-y}
#dmSetHd{position:sticky;top:0;background:#2a1206;display:flex;justify-content:space-between;align-items:center;padding:10px 0;color:#ffd23f;z-index:1}
#dmSetX{position:static!important;width:44px;height:44px;padding:0!important}
#dmSetBox label{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0;font-weight:900}
#dmSetBox input[type=range]{flex:1;max-width:180px}
#dmSetBox input[type=checkbox]{width:26px;height:26px}
#dmPause{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#ffd23f;background:rgba(0,0,0,.35);pointer-events:none}
#dmPause.show{display:flex}
#dmFJ{position:absolute;width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;border:3px solid rgba(255,210,63,.7);background:rgba(0,0,0,.25);display:none;pointer-events:none;opacity:var(--bo)}
#dmFJ.show{display:block}#dmFJ.sprint{border-color:#ff7a3b}
#dmFK{position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;background:rgba(255,210,63,.85)}
#dmJoyHint{position:absolute;left:calc(env(safe-area-inset-left) + 40px);bottom:calc(env(safe-area-inset-bottom) + 40px);width:100px;height:100px;border-radius:50%;border:2px dashed rgba(255,210,63,.4);pointer-events:none}
#dmThrow{right:calc(env(safe-area-inset-right) + 20px);bottom:calc(env(safe-area-inset-bottom) + 30px);width:84px;height:84px;border-radius:50%!important;font-size:24px!important}
#dmPick{right:calc(env(safe-area-inset-right) + 120px);bottom:calc(env(safe-area-inset-bottom) + 30px)}
#dmUmb{right:calc(env(safe-area-inset-right) + 120px);bottom:calc(env(safe-area-inset-bottom) + 90px)}
#dmUmb.held{background:#ffd23f;color:#2a1206}
#dmHelp{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 12px);transform:translateX(-50%);color:#fff6d8;font-size:14px;text-shadow:0 1px 0 #000;pointer-events:none}
</style><canvas></canvas><div id="dmCross"></div><div id="dmMark"></div><div id="dmMsg"></div><div id="dmHud"></div><div id="dmEdge"></div><div id="dmHp"><div id="dmHpF"></div><div id="dmHpN"></div></div><div id="dmFeed"></div>
<button class="dmb" id="dmScoreBtn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" style="vertical-align:-3px"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></button>
<button class="dmb" id="dmSetBtn" aria-label="設定">${ico(I.gear, 26)}</button><div id="dmPause">${ico(I.play, 64)}</div>
<div id="dmSet"><div id="dmSetBox"><div id="dmSetHd">${ico(I.gear, 26)}<button class="dmb" id="dmSetX" aria-label="關閉">✕</button></div>
<label>滑鼠靈敏度<input type="range" id="dsSens" min="0.3" max="3" step="0.05"></label>
<label>觸控靈敏度<input type="range" id="dsTsens" min="0.3" max="3" step="0.05"></label>
<label>上下反轉<input type="checkbox" id="dsInv"></label>
<label>瞄準輔助<input type="checkbox" id="dsAssist"></label>
<label>按鈕大小<input type="range" id="dsBtn" min="0.7" max="1.5" step="0.05"></label>
<label>按鈕透明度<input type="range" id="dsOp" min="0.3" max="1" step="0.05"></label>
</div></div>
<button class="dmb" id="dmX" aria-label="離開">✕</button><div id="dmBoard"><h2>${ico(I.board, 26)}</h2><div id="dmTable"></div></div>
${isTouch ? `<div id="dmJoyHint"></div><div id="dmFJ"><div id="dmFK"></div></div><button class="dmb ctl" id="dmPick" aria-label="拿殼">${ico(I.grab, 28)}</button><button class="dmb ctl" id="dmUmb" aria-label="雨傘">${ico(I.umb, 28)}</button><button class="dmb ctl" id="dmThrow" aria-label="丟">${ico(I.throw, 38)}</button>` : '<div id="dmHelp">WASD ・ Shift ・ 左鍵 ・ 右鍵／R ・ E ・ Tab ・ Esc</div>'}`;
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
  const mk = (name: string, isPlayer: boolean, color: number): Fighter => ({ name, isPlayer, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, ammo: 0, dead: false, respawnAt: 0, invulnUntil: 0, kills: 0, deaths: 0, hs: 0, shots: 0, hits: 0, mesh: null, rig: null, stepAcc: 0, hpBar: null, deathAt: 0, fallDir: new THREE.Vector3(0, 0, 1), throwA: 0, walkPh: 0, pickCd: 0, cd: 1, umbT: 0, umbHeld: false, umbTired: false, umbMesh: null, goal: new THREE.Vector3(), idleUntil: 0, pickT: 0 });
  const me = mk('你', true, 0);
  const fighters: Fighter[] = [me, mk('阿婆 A', false, 0), mk('阿婆 B', false, 0), mk('阿婆 C', false, 0)];
  ([[0xc84a6a, 0xdddddd], [0x3a7a5a, 0xbbbbbb], [0x6a5aa0, 0x888888]] as const).forEach(([t, h], i) => { const b = makeBot(t, h); fighters[i + 1].mesh = b.outer; fighters[i + 1].rig = b.rig; });
  const shells: Shell[] = [];
  // 雨傘：沿用上工的傘（目前裝備的傘外觀與開傘／可撐／遮擋數值）
  scene.add(cam);
  me.umbMesh = U.model; U.model.visible = false; U.model.position.set(0.12, -0.3, -0.85); U.model.rotation.set(0, 0, 0); U.model.scale.setScalar(0.62);
  cam.add(U.model); // 像盾牌往前開
  for (const f of fighters) if (f.mesh) { const m = U.model.clone(true); m.visible = false; m.position.set(0, 1.2, -0.6); m.rotation.set(0, 0, 0); m.scale.setScalar(0.8); f.mesh.add(m); f.umbMesh = m; }
  U.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); Object.assign(m.material, { transparent: true, opacity: 0.6, depthWrite: false }); } }); // 半透明，看得到前方
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

  // ---- 音效：程序合成，接到遊戲的音效音量（跟著主音量／靜音設定） ----
  let voices = 0; const MAXV = 14; let nbuf: AudioBuffer | null = null;
  function ctx() { try { const a = U.audio(); if (!nbuf) { nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return a; } catch { return null; } }
  function outPan(a: AudioContext, g: GainNode, pan: number) { if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(U.sfxOut()); } else g.connect(U.sfxOut()); }
  function nz(dur: number, freq: number, vol: number, pan = 0, sweepTo = 0, delay = 0, qv = 0.8) {
    const a = ctx(); if (!a || voices >= MAXV || vol < 0.004) return; voices++;
    const t = a.currentTime + delay, s = a.createBufferSource(); s.buffer = nbuf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = qv;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g); outPan(a, g, pan);
    s.start(t, Math.random() * 0.5, dur + 0.02); setTimeout(() => voices--, (delay + dur) * 1000 + 60);
  }
  function tn(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', pan = 0, delay = 0, glideTo = 0) {
    const a = ctx(); if (!a || voices >= MAXV || vol < 0.004) return; voices++;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); outPan(a, g, pan);
    o.start(t); o.stop(t + dur + 0.03); setTimeout(() => voices--, (delay + dur) * 1000 + 60);
  }
  const _r = new THREE.Vector3(), _d = new THREE.Vector3();
  // 位置音：距離衰減＋左右聲道
  function spatial(p: THREE.Vector3) { _d.copy(p).sub(cam.position); const dist = _d.length(); _r.set(1, 0, 0).applyQuaternion(cam.quaternion); return { v: 1 / (1 + dist * 0.22), pan: dist > 0.1 ? _d.normalize().dot(_r) * 0.85 : 0 }; }
  const SND = {
    throw(f: Fighter) { const sp = f.isPlayer ? { v: 1, pan: 0 } : spatial(f.pos), k = f.isPlayer ? 1 : 0.5;
      nz(0.2, 2200, 0.35 * sp.v * k, sp.pan, 500); tn(260, 0.07, 0.12 * sp.v * k, 'square', sp.pan, 0, 110); },
    pick() { tn(1900, 0.03, 0.05, 'square'); nz(0.03, 3500, 0.06); },
    reload() { nz(0.035, 3200, 0.3, 0, 0, 0, 3); tn(900, 0.03, 0.08, 'square'); nz(0.06, 1300, 0.35, 0, 600, 0.13, 2); tn(170, 0.07, 0.18, 'square', 0, 0.13, 90); nz(0.03, 4200, 0.18, 0, 0, 0.2, 4); },
    hit(at: THREE.Vector3, head: boolean, mine: boolean) { const sp = mine ? { v: 1, pan: 0 } : spatial(at);
      nz(0.09, 380, 0.5 * sp.v, sp.pan); tn(140, 0.1, 0.25 * sp.v, 'sine', sp.pan, 0, 70);
      if (head) { tn(1500, 0.14, 0.22 * sp.v, 'triangle', sp.pan, 0.01); tn(2250, 0.2, 0.16 * sp.v, 'triangle', sp.pan, 0.05); nz(0.07, 2600, 0.3 * sp.v, sp.pan, 900); } },
    hurt() { nz(0.12, 300, 0.5); tn(110, 0.15, 0.3, 'sawtooth', 0, 0, 60); },
    block(at: THREE.Vector3) { const sp = spatial(at); nz(0.12, 240, 0.55 * sp.v, sp.pan); tn(85, 0.14, 0.3 * sp.v, 'sine', sp.pan); },
    step(f: Fighter) { const sp = f.isPlayer ? { v: 1, pan: 0 } : spatial(f.pos), k = f.isPlayer ? 0.14 : 0.3;
      nz(0.07, 650 + Math.random() * 300, k * sp.v, sp.pan, 300); nz(0.05, 3500, k * 0.25 * sp.v, sp.pan, 0, 0.01); }, // 濕水泥地
  };
  // ---- 血花：一個 InstancedMesh 池，不在命中時配置新物件 ----
  const BN = 240, blood = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0x9a0a0a }), BN);
  blood.frustumCulled = false; scene.add(blood);
  const bp = new Float32Array(BN * 3), bv = new Float32Array(BN * 3), bl = new Float32Array(BN); let bi = 0;
  const _m = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < BN; i++) blood.setMatrixAt(i, _zero);
  function burst(at: THREE.Vector3, dir: THREE.Vector3, n: number) {
    if (!U.gore()) return;
    for (let k = 0; k < n; k++) { const i = bi; bi = (bi + 1) % BN; const sp = 1.5 + Math.random() * 3;
      bp[i * 3] = at.x; bp[i * 3 + 1] = at.y; bp[i * 3 + 2] = at.z;
      bv[i * 3] = dir.x * sp + (Math.random() - .5) * 2.2; bv[i * 3 + 1] = dir.y * sp + Math.random() * 2; bv[i * 3 + 2] = dir.z * sp + (Math.random() - .5) * 2.2; bl[i] = 0.35 + Math.random() * 0.35; }
  }
  function stepBlood(dt: number) {
    let any = false;
    for (let i = 0; i < BN; i++) { if (bl[i] <= 0) continue; any = true; bl[i] -= dt;
      if (bl[i] <= 0 || bp[i * 3 + 1] < 0.01) { bl[i] = 0; blood.setMatrixAt(i, _zero); continue; }
      bv[i * 3 + 1] -= 9.8 * dt; bp[i * 3] += bv[i * 3] * dt; bp[i * 3 + 1] += bv[i * 3 + 1] * dt; bp[i * 3 + 2] += bv[i * 3 + 2] * dt;
      const sc = Math.min(1, bl[i] * 3); _m.makeScale(sc, sc, sc).setPosition(bp[i * 3], bp[i * 3 + 1], bp[i * 3 + 2]); blood.setMatrixAt(i, _m); }
    if (any) blood.instanceMatrix.needsUpdate = true;
  }
  // ---- 阿婆頭上血條（看板，滿血或太遠就藏） ----
  const barG = new THREE.PlaneGeometry(0.7, 0.09);
  for (const f of fighters) if (f.mesh) {
    const g = new THREE.Group(), bg = new THREE.MeshBasicMaterial({ color: 0x2a1206, transparent: true, depthWrite: false }), fm = new THREE.MeshBasicMaterial({ color: 0x33cc33, transparent: true, depthWrite: false });
    const b = new THREE.Mesh(barG, bg); b.scale.set(1.08, 1.5, 1); const fill = new THREE.Mesh(barG, fm); fill.position.z = 0.001; g.add(b, fill); g.renderOrder = 5; scene.add(g); g.visible = false;
    f.hpBar = { g, fill, bg, fm };
  }
  function stepBars() {
    for (const f of fighters) { const h = f.hpBar; if (!h) continue;
      const show = !f.dead && f.hp < 100 && f.pos.distanceTo(me.pos) < 20; h.g.visible = show; if (!show) continue;
      h.g.position.set(f.pos.x, 2.05, f.pos.z); h.g.quaternion.copy(cam.quaternion);
      const r = Math.max(0, f.hp) / 100; h.fill.scale.x = Math.max(0.001, r); h.fill.position.x = -0.35 * (1 - r); h.fm.color.set(hpCol(f.hp));
      const op = now < f.invulnUntil ? 0.35 : 1; h.fm.opacity = op; h.bg.opacity = op * 0.8; }
  }
  // ---- 輸入 ----
  const DSv = loadDS();
  const applyDS = () => { root.style.setProperty('--bs', String(DSv.btn)); root.style.setProperty('--bo', String(DSv.op)); try { localStorage.setItem('oyster-dm-set', JSON.stringify(DSv)); } catch { /* 無痕模式 */ } };
  {
    const bind = (id: string, k: keyof DS) => { const el = q(id) as HTMLInputElement; if (el.type === 'checkbox') { el.checked = DSv[k] as boolean; el.onchange = () => { (DSv as Record<string, unknown>)[k] = el.checked; applyDS(); }; } else { el.value = String(DSv[k]); el.oninput = () => { (DSv as Record<string, unknown>)[k] = +el.value; applyDS(); }; } };
    bind('dsSens', 'sens'); bind('dsTsens', 'tsens'); bind('dsInv', 'invY'); bind('dsAssist', 'assist'); bind('dsBtn', 'btn'); bind('dsOp', 'op'); applyDS();
    q('dmSetBtn').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); q('dmSet').classList.add('show'); };
    q('dmSetX').onclick = () => q('dmSet').classList.remove('show');
  }
  const keys: Record<string, boolean> = {}; const joy = { x: 0, y: 0 }; let holdPick = false, sprint = false, rmb = false;
  const blur = () => { for (const k in keys) keys[k] = false; closeUmb(me); holdPick = false; rmb = false; };
  addEventListener('blur', blur);
  let locked = false, wasLocked = false;
  const onKey = (e: KeyboardEvent, d: boolean) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    keys[e.code] = d;
    if (e.code === 'Tab') { e.preventDefault(); q('dmBoard').classList.toggle('show', d); if (d) renderBoard(); }
    if (d && e.code === 'KeyE') pick(me);
    if (e.code === 'KeyR' && !e.repeat) { if (d) openUmb(me); else if (!rmb) closeUmb(me); }
  };
  const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const plc = () => { locked = document.pointerLockElement === canvas; if (locked) wasLocked = true; else blur(); };
  document.addEventListener('pointerlockchange', plc);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => { if (isTouch) return; if (!locked) { canvas.requestPointerLock?.(); return; }
    if (e.button === 0) throwShell(me); if (e.button === 2) { rmb = true; openUmb(me); } });
  const mu = (e: MouseEvent) => { if (e.button === 2 && rmb) { rmb = false; if (!keys.KeyR) closeUmb(me); } };
  addEventListener('mouseup', mu);
  const clampP = (p: number) => Math.max(-1.3, Math.min(1.3, p));
  const inv = () => (DSv.invY ? -1 : 1);
  canvas.addEventListener('mousemove', e => { if (!locked) return; const k = 0.0025 * DSv.sens; me.yaw -= e.movementX * k; me.pitch = clampP(me.pitch - e.movementY * k * inv()); });
  // 瞄準輔助：準星靠近阿婆時轉視角變慢
  const _af = new THREE.Vector3(), _at = new THREE.Vector3();
  function assistK() {
    if (!DSv.assist) return 1; const e = eyeOf(me); _af.copy(dirOf(me.yaw, me.pitch)); let best = 1;
    for (const f of fighters) { if (f === me || f.dead) continue; _at.set(f.pos.x, f.pos.y + 1.3, f.pos.z).sub(e); const d = _at.length(); if (d > 30) continue; const ang = _af.angleTo(_at.normalize()), lim = Math.max(0.04, 0.6 / d);
      if (ang < lim) best = Math.min(best, 0.45 + 0.55 * (ang / lim)); }
    return best;
  }
  // 觸控轉視角：靈敏度曲線＋輕微加速
  function touchLook(dx: number, dy: number) {
    const sp = Math.hypot(dx, dy), acc = 1 + Math.min(1, sp / 25) * 0.6, k = 0.0045 * DSv.tsens * acc * assistK();
    me.yaw -= dx * k; me.pitch = clampP(me.pitch - dy * k * inv());
  }
  if (isTouch) {
    // 多指同時操作：用 pointerId 分開追蹤浮動搖桿、轉視角、各個按鈕
    const fj = q('dmFJ'), fk = q('dmFK'), hint = q('dmJoyHint');
    type P = { k: 'joy' | 'look' | 'btn'; el?: HTMLElement; x: number; y: number; ox: number; oy: number };
    const ptr = new Map<number, P>(); const DEAD = 0.15, RAD = 55;
    const joyAt = (p: P, x: number, y: number) => {
      let jx = (x - p.ox) / RAD, jy = (y - p.oy) / RAD; const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; }
      const m = Math.min(1, l); fk.style.transform = `translate(${jx * 40}px,${jy * 40}px)`;
      if (m < DEAD) { joy.x = joy.y = 0; sprint = false; } else { const r = (m - DEAD) / (1 - DEAD) / m; joy.x = jx * r; joy.y = jy * r; sprint = l > 1.15; } // 推出外圈＝衝刺
      fj.classList.toggle('sprint', sprint);
    };
    root.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || q('dmSet').classList.contains('show')) return; const t = e.target as HTMLElement, b = t.closest('button') as HTMLElement | null;
      const rec: P = { k: 'look', x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
      if (b) { if (b.id === 'dmUmb') openUmb(me); if (b.id === 'dmPick') holdPick = true; rec.k = 'btn'; rec.el = b; ptr.set(e.pointerId, rec); return; }
      if (e.clientX < innerWidth * 0.45 && ![...ptr.values()].some(p => p.k === 'joy')) { rec.k = 'joy'; fj.style.left = e.clientX + 'px'; fj.style.top = e.clientY + 'px'; fj.classList.add('show'); hint.style.display = 'none'; joyAt(rec, e.clientX, e.clientY); }
      ptr.set(e.pointerId, rec);
    });
    root.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return;
      if (p.k === 'joy') joyAt(p, e.clientX, e.clientY);
      else if (p.k === 'look' || (p.k === 'btn' && p.el?.id === 'dmThrow')) touchLook(e.clientX - p.x, e.clientY - p.y); // 按住丟可以拖曳瞄準
      p.x = e.clientX; p.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId);
      if (p.k === 'joy') { joy.x = joy.y = 0; sprint = false; fj.classList.remove('show', 'sprint'); fk.style.transform = ''; hint.style.display = ''; }
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
    if (pileDist(f.pos) > PICK_R) { return false; }
    const was = f.ammo; f.ammo = MAXAMMO; if (f.isPlayer && was < MAXAMMO) SND.reload(); return true;
  }
  function eyeOf(f: Fighter) { return new THREE.Vector3(f.pos.x, f.pos.y + EYE, f.pos.z); }
  function dirOf(yaw: number, pitch: number) { return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
  function throwShell(f: Fighter, yaw = f.yaw, pitch = f.pitch) {
    if (f.dead) return false;
    if (f.umbHeld) { return false; }
    if (f.ammo <= 0) { return false; }
    f.ammo--; f.shots++; if (f.isPlayer) f.invulnUntil = 0;
    const d = dirOf(yaw, pitch); const p = eyeOf(f).addScaledVector(d, 0.4);
    const m = shellMesh(); m.position.copy(p); scene.add(m); f.throwA = 0.35; SND.throw(f);
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
  function damage(src: Fighter, f: Fighter, part: Part, at: THREE.Vector3, dir?: THREE.Vector3) {
    src.hits++;
    if (f.dead) return;
    const inv = now < f.invulnUntil;
    if (!inv) { burst(at, dir ?? _d.set(0, 0, 0), part === 'head' ? 26 : 10); SND.hit(at, part === 'head', src.isPlayer); }
    if (src.isPlayer) { popAt(at, inv ? ico(I.shield, 28) : part === 'head' ? ico(I.head, 34) : part === 'body' ? '-40' : '-20'); mark(); }
    if (inv) return;
    f.hp -= part === 'head' ? 999 : part === 'body' ? 40 : 20;
    if (f.isPlayer) { flashHurt(); SND.hurt(); }
    if (f.hp <= 0) {
      f.dead = true; f.deathAt = now; if (dir) f.fallDir.set(dir.x, 0, dir.z).normalize(); if (f.fallDir.lengthSq() < 0.5) f.fallDir.set(0, 0, 1); f.deaths++; f.respawnAt = now + 3; f.ammo = 0; src.kills++; if (part === 'head') src.hs++;
      if (f.umbMesh) f.umbMesh.visible = false; f.umbHeld = false;
      feed(src, f, part === 'head');
    }
  }
  const _dir = new THREE.Vector3();
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
            if (-fwd.dot(inc) > Math.cos(Math.PI / 3) && Math.random() < U.umb.cover) { SND.block(p); if (f.isPlayer || s.owner.isPlayer) popAt(p, ico(I.umb, 28)); done = true; break; }
          }
          const part = hitPart(f, p); if (part) { damage(s.owner, f, part, p, _dir.copy(s.vel).normalize()); done = true; break; } }
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
  const _fq = new THREE.Quaternion(), _yq = new THREE.Quaternion(), _fa = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function update(dt: number) {
    now += dt;
    for (const f of fighters) {
      if (f.dead && f.mesh) { // 倒地：往被打的方向倒下，躺到復活（沒有命中判定）
        const k = Math.min(1, (now - f.deathAt) / 0.55), e = k * k * (3 - 2 * k) * (Math.PI / 2 - 0.08) + (k >= 1 ? 0 : Math.sin(k * Math.PI) * 0.05);
        _fq.setFromAxisAngle(_fa.set(f.fallDir.z, 0, -f.fallDir.x), e); _yq.setFromAxisAngle(_up, f.yaw); f.mesh.quaternion.copy(_fq).multiply(_yq); f.mesh.position.copy(f.pos); f.mesh.visible = true; }
      if (f.dead) { f.vel.set(0, 0, 0); if (now >= f.respawnAt) { spawn(f); if (f.mesh) f.mesh.visible = true; if (f.isPlayer) q('dmMsg').innerHTML = ''; } continue; }
      if (f.umbHeld) { f.umbT -= dt; if (f.umbT <= 0) { f.umbHeld = false; f.umbTired = true; f.umbT = 0; } }
      if (f.umbMesh) f.umbMesh.visible = f.umbHeld;
      // 邊走邊撿：在蚵仔堆旁邊每 0.2 秒自動補一顆（按住拿殼／E 一次補滿）
      if (f.ammo < MAXAMMO && pileDist(f.pos) <= PICK_R) { f.pickCd -= dt; if (f.pickCd <= 0) { f.ammo++; f.pickCd = 0.12; if (f.isPlayer) { if (f.ammo === MAXAMMO) SND.reload(); else SND.pick(); } } } else f.pickCd = 0;
      if (f.isPlayer && (holdPick || keys.KeyE)) pick(f);
      if (f.isPlayer) {
        let fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x, fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + joy.y;
        const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
        const s = Math.sin(f.yaw), c = Math.cos(f.yaw);
        const vmax = (keys.ShiftLeft || keys.ShiftRight || sprint) && fz < 0.2 ? 7.5 : 5; f.vel.set((fx * c + fz * s) * vmax, 0, (-fx * s + fz * c) * vmax);
      } else botThink(f, dt);
      if (f.vel.lengthSq() > 0.01) f.invulnUntil = Math.min(f.invulnUntil, now); // 一開始移動就結束無敵
      const spd = f.vel.length(); if (spd > 0.5) { f.stepAcc += spd * dt; if (f.stepAcc > 0.75) { f.stepAcc = 0; if (f.isPlayer || f.pos.distanceTo(me.pos) < 25) SND.step(f); } } else f.stepAcc = 0.6;
      f.pos.addScaledVector(f.vel, dt); collide(f);
      if (f.rig) { const sp = f.vel.length(); f.walkPh += dt * sp * 2.6; const sw = Math.sin(f.walkPh) * Math.min(1, sp / 3) * 0.6; f.rig.legL.rotation.x = sw; f.rig.legR.rotation.x = -sw;
        f.throwA = Math.max(0, f.throwA - dt); f.rig.armR.rotation.x = f.throwA > 0 ? -2.2 * Math.sin((f.throwA / 0.35) * Math.PI) : f.umbHeld ? -0.8 : 0; }
      if (f.mesh) { f.mesh.position.copy(f.pos); f.mesh.rotation.set(0, f.yaw, 0); f.mesh.visible = now < f.invulnUntil ? Math.floor(now * 10) % 2 === 0 : true; }
    }
    stepShells(dt); stepBlood(dt); stepBars();
  }

  // ---- UI ----
  let msgT = 0;
  function msg(t: string, sec: number) { q('dmMsg').textContent = t; msgT = sec; }
  let markT = 0; function mark() { q('dmMark').style.opacity = '1'; markT = 0.25; }
  function flashHurt() { const e = q('dmEdge'); e.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => e.classList.remove('on'))); const h = q('dmHp'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit'); }
  // 擊殺欄：「擊倒者 圖示 倒下者」，名字只留代號
  const tag = (f: Fighter) => f.isPlayer ? '你' : f.name.slice(-1);
  function feed(a: Fighter, b: Fighter, head: boolean) {
    const box = q('dmFeed'), el = document.createElement('div'); if (a.isPlayer || b.isPlayer) el.className = 'me';
    el.innerHTML = `${tag(a)} ${ico(head ? I.head : I.skull, 18)} ${tag(b)}`; box.prepend(el);
    while (box.children.length > 4) box.lastElementChild!.remove(); setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, 4000);
  }
  function popAt(p: THREE.Vector3, t: string) {
    const v = p.clone().project(cam); if (v.z > 1) return;
    const el = document.createElement('div'); el.className = 'dmPop'; el.innerHTML = t;
    el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; root.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-150%)'; el.style.opacity = '0'; }); setTimeout(() => el.remove(), 900);
  }
  function renderBoard() {
    const rows = [...fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    q('dmTable').innerHTML = `<table><tr><th></th><th>${ico(I.skull, 18)}</th><th>${ico(I.heart, 18)}</th><th>${ico(I.head, 18)}</th><th>%</th></tr>${rows.map(f => `<tr class="${f.isPlayer ? 'me' : ''}"><td>${tag(f)}</td><td>${f.kills}</td><td>${f.deaths}</td><td>${f.hs}</td><td>${f.shots ? Math.round(f.hits / f.shots * 100) : 0}%</td></tr>`).join('')}</table>`;
  }
  const hpCol = (hp: number) => `hsl(${Math.max(0, Math.min(100, hp)) * 1.2},80%,45%)`;
  function hud() {
    q('dmHpF').style.width = Math.max(0, me.hp) + '%'; q('dmHpF').style.background = hpCol(me.hp); q('dmHpN').innerHTML = `${ico(I.heart, 16)} ${Math.max(0, me.hp)}`;
    const atPile = pileDist(me.pos) <= PICK_R;
    if (isTouch) q('dmUmb').classList.toggle('held', me.umbHeld);
    q('dmHud').innerHTML = `${ico(I.shell)} ${me.ammo}/${MAXAMMO}${now < me.invulnUntil && !me.dead ? ' ' + ico(I.shield) : ''}${atPile && me.ammo < MAXAMMO && !me.dead ? ' ' + ico(I.grab) : ''}`;
    q('dmHud').classList.toggle('empty', me.ammo === 0); if (isTouch) q('dmUmb').classList.toggle('cd', me.umbTired);
    if (me.dead) q('dmMsg').innerHTML = `${ico(I.skull, 40)}<br>${Math.max(1, Math.ceil(me.respawnAt - now))}`;
    if (q('dmBoard').classList.contains('show')) renderBoard();
  }

  // ---- 迴圈 ----
  let raf = 0, last = performance.now(), hudT = 0;
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  function loop() {
    raf = requestAnimationFrame(loop);
    const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
    const paused = !isTouch && wasLocked && !locked; q('dmPause').classList.toggle('show', paused && !q('dmSet').classList.contains('show'));
    if (!paused) update(dt);
    cam.position.copy(eyeOf(me)); let roll = 0, pt = me.pitch;
    if (me.dead) { const k = Math.min(1, (now - me.deathAt) / 0.6), e = k * k * (3 - 2 * k); cam.position.y = EYE + (0.25 - EYE) * e; roll = 1.25 * e; pt = me.pitch * (1 - e) + 0.15 * e; }
    cam.rotation.set(pt, me.yaw, roll); root.classList.toggle('dead', me.dead);
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) q('dmMsg').textContent = ''; }
    if (markT > 0) { markT -= dt; if (markT <= 0) q('dmMark').style.opacity = '0'; }
    if ((hudT -= dt) <= 0) { hud(); hudT = 0.1; }
    renderer.render(scene, cam);
  }
  loop();

  function exit() {
    cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', resize); removeEventListener('blur', blur); removeEventListener('mouseup', mu);
    document.removeEventListener('pointerlockchange', plc); if (document.pointerLockElement === canvas) document.exitPointerLock();
    renderer.dispose(); root.remove(); active = false; delete (window as any).__dm; onExit();
  }
  // 測試掛勾
  (window as any).__dm = { fighters, shells, me, pick, DSv, assistK, touchLook, get voices() { return voices; }, bloodLive: () => Array.from(bl).filter(x => x > 0).length, bars: () => fighters.map(f => f.hpBar?.g.visible ?? null), openUmb, closeUmb, throwShell, update, exit, renderBoard, launchPitch, get now() { return now; } };
}
