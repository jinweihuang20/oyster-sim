import { initUpdate } from './update';
import { postDiscordFeedback } from './discord';
import { installBackGuard } from './backguard';
import { checkCode, REDEEM_MESSAGES } from './redeem';
import type { RedeemCodeDef } from './redeemCodes';
import * as THREE from 'three';
import * as Social from './social';
const LS_P = __PREVIEW__ ? 'preview:' : '';
const LS = { getItem: (k: string) => localStorage.getItem(LS_P + k), setItem: (k: string, v: string) => localStorage.setItem(LS_P + k, v), removeItem: (k: string) => localStorage.removeItem(LS_P + k) };
if (__PREVIEW__) document.addEventListener('DOMContentLoaded', () => { const t = document.createElement('div'); t.textContent = '預覽版'; t.style.cssText = 'position:fixed;left:0;bottom:0;z-index:99999;background:#d8402f;color:#fff4dc;font:bold 12px sans-serif;padding:2px 8px;pointer-events:none;box-shadow:2px -2px 0 #1b2a3a'; document.body.appendChild(t); });


// ---------- 基本設定 ----------
const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // 截圖測試用
const SHIFT = 180;
let shiftLen = SHIFT; // 臨時工 60／120 秒
const TEMP_CUT = 1;
const canvas = $('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!SHOT });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3050);
scene.fog = new THREE.Fog(0x4a3a50, 10, 34);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
camera.rotation.order = 'YXZ';
scene.add(camera);
// 第三人稱另用一台鏡頭，遊戲邏輯照舊用 camera
const tpCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 200); let tpOn = false;
function viewCam() { return tpOn ? tpCam : camera; }
const SEAT0 = new THREE.Vector3(0, 1.05, 2.0), SEAT = SEAT0.clone();
camera.position.copy(SEAT);

const mat = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
function mesh(g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], parent: THREE.Object3D = scene) {
  const x = new THREE.Mesh(g, m); if (p) x.position.set(...p); x.castShadow = true; x.receiveShadow = parent === scene; parent.add(x); return x;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
// ---------- 場景：漁港邊的工寮（黃昏） ----------
const hemi = new THREE.HemisphereLight(0xc08a9a, 0x201810, 0.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xff9a60, 0.5); sun.position.set(-6, 3, -12); scene.add(sun);
const lamp = new THREE.PointLight(0xffb060, 26, 10, 1.6); lamp.position.set(0, 2.55, 0); lamp.castShadow = true; lamp.shadow.bias = -0.003; lamp.shadow.normalBias = 0.03; lamp.shadow.mapSize.set(1024, 1024); scene.add(lamp);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
const ground = mesh(new THREE.PlaneGeometry(14, 14), mat(0x6a6a66)); ground.rotation.x = -Math.PI / 2; // 水泥地
// 柱仔頂的指針時鐘（跟著裝置時間）
const clockG = new THREE.Group(); clockG.position.set(3.5, 2.35, -3.5); scene.add(clockG); clockG.lookAt(0, 2.0, 2.0); clockG.translateZ(0.09);
mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), mat(0x6a4a2a), [0, 0, -0.02], clockG).rotation.x = Math.PI / 2;
mesh(new THREE.CircleGeometry(0.26, 24), mat(0xfff6dc, { emissive: 0xfff0c8, emissiveIntensity: 0.35 }), [0, 0, 0.01], clockG);
for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, L = i % 3 ? 0.03 : 0.06; mesh(new THREE.BoxGeometry(i % 3 ? 0.012 : 0.02, L, 0.005), mat(0x222222), [Math.sin(a) * (0.23 - L / 2), Math.cos(a) * (0.23 - L / 2), 0.015], clockG).rotation.z = -a; }
const hand = (len: number, w: number, c: number, z: number) => { const p = new THREE.Group(); p.position.z = z; clockG.add(p); mesh(new THREE.BoxGeometry(w, len, 0.006), mat(c), [0, len / 2 - 0.02, 0], p); return p; };
const clkH = hand(0.14, 0.022, 0x1a1a1a, 0.02), clkM = hand(0.2, 0.014, 0x1a1a1a, 0.026), clkS = hand(0.21, 0.006, 0xc0392b, 0.032);
mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8), mat(0x111111), [0, 0, 0.035], clockG).rotation.x = Math.PI / 2;
function updClock() { const d = new Date(), sec = d.getSeconds(), m = d.getMinutes() + sec / 60, h = (d.getHours() % 12) + m / 60; clkS.rotation.z = -sec / 60 * Math.PI * 2; clkM.rotation.z = -m / 60 * Math.PI * 2; clkH.rotation.z = -h / 12 * Math.PI * 2; }
updClock(); setInterval(updClock, 1000);
// 港口：碼頭、水、漁船
mesh(new THREE.BoxGeometry(14, 0.3, 3), mat(0x7a7468), [0, -0.15, -5.8]);
const water = mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.25, metalness: 0.3 }), [0, -0.5, -27]); water.rotation.x = -Math.PI / 2;
const sky = mesh(new THREE.PlaneGeometry(90, 20), new THREE.MeshBasicMaterial({ color: 0xd8805a, fog: false }), [0, 4, -40]);
mesh(new THREE.PlaneGeometry(90, 12), new THREE.MeshBasicMaterial({ color: 0x6a4a7a, fog: false }), [0, 16, -39.9]); sky.renderOrder = -1;
const boats: THREE.Group[] = [];
const flagCols = [0xd03030, 0x2a5ad0, 0xf0c020, 0x30a050];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group(); g.position.set(-8 + i * 4 + rnd(-0.5, 0.5), -0.45, -9 - (i % 2) * 2.5); g.rotation.y = rnd(-0.3, 0.3); scene.add(g);
  const hull = mesh(new THREE.BoxGeometry(3.2, 0.7, 1.1), mat([0xe8e8e0, 0x2a6ab0, 0xd8d0b0][i % 3]), [0, 0.35, 0], g);
  mesh(new THREE.BoxGeometry(3.25, 0.12, 1.15), mat(0xb03030), [0, 0.05, 0], g); void hull;
  mesh(new THREE.BoxGeometry(1.0, 0.6, 0.8), mat(0xf0f0e8), [0.6, 1.0, 0], g);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 4), mat(0x333333), [-0.6, 1.8, 0], g);
  for (let k = 0; k < 3; k++) mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ color: flagCols[(i + k) % 4], side: THREE.DoubleSide }), [-0.42, 2.7 - k * 0.3, 0], g);
  mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: [0xffe0a0, 0xff6040, 0x60ff80][i % 3] }), [0.6, 1.4, 0], g);
  boats.push(g);
}

// 中央蚵殼山
// 蚵殼：灰色為主，偶爾帶烏（頂點色：烏斑、烏紋、烏邊）
function shellPaint(g: THREE.BufferGeometry, seed: number) {
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3); let r = seed * 9301 + 49297;
  const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const blotch = new THREE.Vector3(rn() - 0.5, rn() - 0.5, rn() - 0.5).normalize(), streak = rn() * 6.28, dark = rn() < 0.45;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), v = new THREE.Vector3(x, y, z).normalize();
    let c = 0.82 + rn() * 0.22;
    const ry = Math.abs(y) / 0.04; if (ry < 0.35) c *= 0.55 + ry;           // 烏邊
    if (dark && v.dot(blotch) > 0.55) c *= 0.35;                             // 烏斑
    if (Math.sin(x * 60 * Math.cos(streak) + z * 60 * Math.sin(streak)) > 0.82) c *= 0.5; // 烏紋
    col[i * 3] = c * 0.62; col[i * 3 + 1] = c * 0.8; col[i * 3 + 2] = Math.min(1, c * 1.15); // 偏冷補償黃燈
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const mkShell = (sy: number, seed: number) => { const g = new THREE.DodecahedronGeometry(0.09, 0); g.scale(1.3, sy, 1); return shellPaint(g, seed); };
const SHELL_GEOS = [0, 1, 2, 3, 4, 5].map(i => mkShell(0.45, i + 1)), HALF_GEOS = [0, 1, 2, 3, 4, 5].map(i => mkShell(0.25, i + 11));
const shellGeo = SHELL_GEOS[0], halfGeo = HALF_GEOS[0];
const GREYS = [0xc2c2be, 0xa4a4a2, 0x8a8a8a, 0x6c6c6e, 0x4a4a4e];
const greyPick = () => GREYS[Math.min(4, Math.floor(Math.random() * Math.random() * 6.2))];
const shellM = (c: number) => { const m = mat(c, { vertexColors: true, roughness: 0.92, metalness: 0 }); m.emissive.setHex(0x2a2c30); return m; };
const shellMat = shellM(0xa0a0a0);
mesh(new THREE.ConeGeometry(0.9, 0.55, 10), mat(0x6a7c94, { roughness: 0.95, emissive: 0x24262a }), [0, 0.27, 0]);
const pileMat = shellM(0xffffff); const pile = new THREE.InstancedMesh(shellGeo, pileMat, 260); pile.castShadow = true;
{ const d = new THREE.Object3D(); for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.0, h = Math.max(0, 0.55 * (1 - r / 0.95)); d.position.set(Math.cos(a) * r, h + 0.03, Math.sin(a) * r); d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); d.updateMatrix(); pile.setMatrixAt(i, d.matrix); pile.setColorAt(i, new THREE.Color(greyPick())); } }
scene.add(pile);
const pileSpot = () => { const a = Math.random() * 6.28, r = rnd(0.2, 0.7); return new THREE.Vector3(Math.cos(a) * r, 0.5 * (1 - r) + 0.05, Math.sin(a) * r); };

// 玩家前面：生蚵臉盆、裝肉的碗（點碗丟肉）
const basinMesh = mesh(new THREE.CylinderGeometry(0.33, 0.26, 0.18, 16, 1, true), mat(0xc84030, { side: THREE.DoubleSide }), [-0.35, 0.1, 1.45]);
const BASIN0 = new THREE.Vector3(-0.35, 0.1, 1.45), BASIN = BASIN0.clone();
const basinOy: THREE.Mesh[] = [];
const basinShells = new THREE.InstancedMesh(shellGeo, pileMat, 1);
{ const d = new THREE.Object3D(); for (let i = 0; i < 25; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.24; d.position.set(-0.35 + Math.cos(a) * r, 0.12 + Math.random() * 0.05, 1.45 + Math.sin(a) * r); d.rotation.set(Math.random(), Math.random() * 3, Math.random()); d.updateMatrix(); basinShells.setMatrixAt(i, d.matrix); basinShells.setColorAt(i, new THREE.Color(greyPick())); } }
const seatRig = new THREE.Group(); scene.add(seatRig); seatRig.add(basinMesh, basinShells);
const BOWL0 = new THREE.Vector3(0.55, 0.12, 1.0), BOWL = BOWL0.clone(); let BOWL_R = 0.17;
const bowlG = new THREE.Group(); seatRig.add(bowlG); const BOWL_L = BOWL0.clone();
function buildBowl(b: { r: number; h: number; color: number; metal?: number }) {
  bowlG.clear(); const bot = b.r * 0.72;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(b.r + 0.03, bot, b.h, 22, 1, true), new THREE.MeshStandardMaterial({ color: b.color, side: THREE.DoubleSide, roughness: b.metal ? 0.25 : 0.45, metalness: b.metal ?? 0 }));
  wall.position.y = b.h / 2; bowlG.add(wall);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(b.r + 0.03, 0.012, 6, 24), wall.material); rim.rotation.x = Math.PI / 2; rim.position.y = b.h; bowlG.add(rim);
  const fl = new THREE.Mesh(new THREE.CircleGeometry(bot, 18), new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color).multiplyScalar(0.75), metalness: b.metal ?? 0, roughness: 0.5 })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.005; bowlG.add(fl);
  bowlG.position.set(BOWL_L.x, 0, BOWL_L.z); BOWL.y = Math.max(0.08, b.h - 0.02);
}
const bowlMeat: THREE.Mesh[] = [], splats: THREE.Mesh[] = [];
const meatMat = mat(0xd8cbb0, { roughness: 0.3, metalness: 0.1 }), splatMat = mat(0x8a8680, { roughness: 0.6 });
const meatGeo = new THREE.SphereGeometry(0.035, 8, 6); meatGeo.scale(1.4, 0.6, 1);

// ---------- 阿婆 ----------
const skin = 0xd9a07a;
function makeAma(top: number, hair: number) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 8), mat(0xc83a3a), [0, 0.15, 0.05], g);
  const body = mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.55, 8), mat(top), [0, 0.6, 0], g);
  const pants = mat(0x2a2a40); mesh(new THREE.BoxGeometry(0.42, 0.14, 0.45), pants, [0, 0.35, -0.15], g);
  // 坐姿小腿＋藍白拖
  const shinG = new THREE.CylinderGeometry(0.055, 0.045, 0.3, 6), sole = mat(0xf2f2ee), strap = mat(0x2f5fb8);
  for (const sx of [-0.1, 0.1]) { mesh(shinG, pants, [sx, 0.17, -0.34], g); mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6), mat(skin), [sx, 0.04, -0.35], g);
    mesh(new THREE.BoxGeometry(0.09, 0.02, 0.2), sole, [sx, 0.01, -0.4], g); mesh(new THREE.BoxGeometry(0.095, 0.03, 0.035), strap, [sx, 0.035, -0.45], g); mesh(new THREE.SphereGeometry(0.035, 6, 4, 0, Math.PI * 2, 0, 1.6), mat(skin), [sx, 0.025, -0.47], g); }
  const head = new THREE.Group(); head.position.set(0, 1.02, 0); g.add(head);
  mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(skin), [0, 0, 0], head);
  mesh(new THREE.SphereGeometry(0.155, 10, 8, 0, Math.PI * 2, 0, 1.4), mat(hair), [0, 0.02, 0.02], head);
  mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(hair), [0, 0.1, 0.13], head);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.018, 6, 4), mat(0x111111), [s * 0.05, 0.02, -0.14], head);
  mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), mat(0x803030), [0, -0.06, -0.145], head);
  const arm = (s: number) => { const p = new THREE.Group(); p.position.set(s * 0.2, 0.8, -0.02); g.add(p); mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 6), mat(top), [0, -0.12, -0.12], p).rotation.x = 1.1; mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(skin), [0, -0.2, -0.3], p); return p; };
  return { g, body, head, pants, armL: arm(-1), armR: arm(1) };
}
type Npc = ReturnType<typeof makeAma> & { name: string; rate: number; chatty: number; peek: boolean; count: number; pause: number; look: number; bubble: HTMLDivElement; bubT: number; lean: number;
  cyc: number; dur: number; ev: number; mood: number; angry: number; distract: number; turnDir: number; windup: number; w0?: number; warned?: boolean; throwCd: number; stuck: THREE.Mesh | null; baseY: number; basinN?: number; scoopT?: number; clutch?: number; grudge?: number; gAt?: number; tag: HTMLButtonElement; calm?: number; gIcon?: THREE.Sprite; gBar?: THREE.Sprite; bump?: THREE.Object3D; bumpT?: number; oy: THREE.Group; top: THREE.Mesh; meat: THREE.Mesh; bowl: THREE.Vector3; bowlMeat: THREE.Mesh[] };
const npcs: Npc[] = [];
// 阿婆每粒秒數 = rate × 難度倍率（易 0.75／普通 1／硬 1.3／超硬 1.6）
const NPC_DIFF_T = [0.75, 1, 1.3, 1.6];
const NPC_DEF = [
  { name: '快手阿桃', rate: 4.2, chatty: 0.1, peek: false, top: 0x6a3a8a, hair: 0x999999, a: -1.9 },
  { name: '講話阿春', rate: 7.5, chatty: 0.6, peek: false, top: 0x2a7a5a, hair: 0x333333, a: Math.PI },
  { name: '好奇阿嬌', rate: 5.8, chatty: 0.3, peek: true, top: 0xb04050, hair: 0xcccccc, a: 1.9 },
];
for (const d of NPC_DEF) {
  const a = makeAma(d.top, d.hair); const ang = Math.PI / 2 + d.a; const r = 1.9;
  a.g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); a.g.lookAt(0, 0, 0); a.g.rotateY(Math.PI); scene.add(a.g);
  // 手頂的蚵仔佮蚵刀
  const oy = new THREE.Group(); oy.position.set(0, -0.15, -0.32); a.armL.add(oy);
  mesh(halfGeo, mat(0x6a6458), [0, 0, 0], oy);
  const meat = mesh(meatGeo, meatMat, [0, 0.025, 0], oy);
  const top = mesh(HALF_GEOS[npcs.length % 6], shellM(greyPick()), [0, 0.04, 0], oy);
  const kn = new THREE.Group(); kn.position.set(0, -0.18, -0.34); a.armR.add(kn);
  mesh(new THREE.BoxGeometry(0.03, 0.03, 0.09), mat(0x7a4a20), [0, 0, 0], kn);
  mesh(new THREE.BoxGeometry(0.02, 0.006, 0.09), mat(0xd0d0d8, { metalness: 0.8, roughness: 0.25 }), [0, 0, -0.09], kn);
  const bowlL = new THREE.Vector3(0.32, 0, -0.42); const bowl = a.g.localToWorld(bowlL.clone());
  mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.1, 14, 1, true), mat(0xdddddd, { side: THREE.DoubleSide }), [bowl.x, 0.05, bowl.z]);
  bowl.y = 0.08;
  const tag = document.createElement('button'); tag.className = 'ntag'; tag.textContent = d.name; $('bubbles').appendChild(tag); const ni = npcs.length; tag.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); npcTip(npcs[ni]); });
  const bubble = document.createElement('div'); bubble.className = 'bub'; bubble.style.opacity = '0'; $('bubbles').appendChild(bubble);
  npcs.push({ ...a, tag, name: d.name, rate: d.rate, chatty: d.chatty, peek: d.peek, count: 0, pause: 0, look: 0, bubble, bubT: 0, lean: 0, cyc: Math.random(), dur: d.rate, ev: 0, mood: 0, angry: 0, distract: 0, turnDir: 1, windup: 0, throwCd: rnd(15, 30), stuck: null, baseY: 0, oy, top, meat, bowl, bowlMeat: [] });
}
const GOSSIP = [
  '你們知道嗎，巷尾的阿雄又換工作了', '今天的蚵仔好肥喔！', '我孫子說要讀博士，我都聽不懂', '聽說今天有人剝到黑珍珠喔', '剝快一點，等一下菜市場要收了',
  '這次颱風沒來，蚵仔超讚', '我年輕時一天剝兩千顆呢', '你媳婦有回來嗎？', '珍珠喔～越剝越有機會啦', '蚵仔煎攤老闆說要加訂',
  '啊～腰好痠，休息一下', '昨天電視那齣好好看', '金色的珍珠，一輩子只看過一次', '今天有幾顆硬得像石頭',
];
const PEEK = ['欸，你那顆是不是有東西？', '我看看～', '你剝多少了？'];
const NAG_GIVEUP = ['這麼快就放棄喔？', '硬的才有肉啦，再試試看！', '年輕人沒耐性喔～', '那顆可以剝啦，好浪費！', '放棄？我們那時候才不敢這樣', '唉，蚵仔也是有生命的呢'];
const NAG_STAB = ['哎唷！慢慢來啦！', '刀子很利，小心點！', '流血了啦，快按一下', '別那麼急，手比較要緊', '你這樣是要去醫院喔？'];
const NAG_CRACK = ['殼屑都跑進肉裡了啦！', '那麼大力是要拆房子喔？', '有殼屑的蚵仔沒人要買啦', '小心扭，別用蠻力'];
const NAG_SLIP = ['縫都沒找到，還硬插！', '先找縫啦，傻孩子', '刀子不是這樣用的'];
const SCOLD_HIT = ['誰丟的！？', '蚵仔肉黏在我頭上啦！', '你是故意的吧！', '我頭髮剛洗的耶！'];
const SCOLD_SHELL = ['要命喔！丟殼！', '你皮在癢喔？', '好啊，你來啊！', '跟你說，我年輕時是投手呢'];
const SCOLD_STEAL = ['抓到了！偷蚵仔賊！', '你在幹嘛！我的蚵仔！', '還來！加倍還來！', '左鄰右舍也敢偷！'];
const GRUDGE = ['哼，我不想跟你講話', '某人喔，手腳不乾淨', '我會記住的', '今天真倒楣，坐你旁邊'];
const TURN_CHAT = ['欸欸，你聽我說…', '阿春，你知不知道…', '跟你說一個秘密', '那個阿雄喔…'];
const PRAISE = ['好功夫！', '真的很準喔！', '那顆丟得真漂亮！'];
function say(n: Npc, t: string, dur = 3.2) { if (ac) SFX.murmur([300, 230, 380][npcs.indexOf(n)] ?? 300); n.bubble.textContent = t; n.bubble.style.opacity = '1'; n.bubT = dur; }
let lastNag = '';
function nag(lines: string[]) {
  if (Math.random() > seatNow().nag * fxAll().nag) return;
  let t = pick(lines); while (t === lastNag && lines.length > 1) t = pick(lines); lastNag = t;
  const n = npcs.find(x => x.peek && Math.random() < 0.5) ?? pick(npcs); n.look = 2.5; say(n, t, 3);
}

// ---------- 玩家的雙手（掛佇鏡頭） ----------
const handRig = new THREE.Group(); camera.add(handRig);
const sleeve = mat(0x3a5a8a), shirtCuff = mat(0xe8e4d8);
const handSkin = mat(skin), cuffMat = mat(0x3a6fc0); cuffMat.visible = false;
const fingerMeshes: THREE.Mesh[] = [];
function applyGloves() { const g = gearOn('glove'); handSkin.color.set(g ? 0xe8e4d8 : skin); handSkin.roughness = g ? 1 : 0.85; cuffMat.visible = g; fingerMeshes.forEach(f => f.scale.set(g ? 1.25 : 1, g ? 1.2 : 1, g ? 1.05 : 1)); applyGlasses(); }
function applyGlasses() { const g = gearOn('glasses'); (seamMark.material as THREE.MeshBasicMaterial).color.set(g ? 0xe8a050 : 0x7a4a1e); seamMark.scale.setScalar(g ? 1.7 : 1); seamGlow.scale.setScalar(g ? 1.6 : 1); document.getElementById('vign')?.classList.toggle('on', g && state === 'play'); }
function makeHand(s: number) {
  const h = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.7, 8), sleeve, [0, 0, 0.32], h).rotation.x = Math.PI / 2; // 長前臂延伸到畫面角落，兩手呈 A 字
  mesh(new THREE.BoxGeometry(0.11, 0.05, 0.13), handSkin, [0, 0, -0.1], h);
  mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.06, 8), shirtCuff, [0, 0, 0.66], h).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.035, 8), cuffMat, [0, 0, -0.03], h).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.022, 0.03, 0.07), handSkin, [-0.04 + i * 0.026, -0.01, -0.19], h);
  mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), handSkin, [s * -0.06, 0, -0.12], h).rotation.y = s * 0.6;
  return h;
}
const handL = makeHand(-1), handR = makeHand(1);
[handL, handR].forEach(h => h.children.forEach(c => { const m = c as THREE.Mesh; if (m.material === handSkin && (m.geometry as THREE.BoxGeometry).parameters?.width < 0.05) fingerMeshes.push(m); }));
const HL = new THREE.Vector3(-0.16, -0.24, -0.42);
handL.position.copy(HL); handL.rotation.set(0.4, -0.5, 0.3);
handR.position.set(0.2, -0.26, -0.45); handR.rotation.set(0.3, 0.5, -0.2);
handRig.add(handL, handR);
let knifeK = 0; const _kt = new THREE.Vector3(), _kg = new THREE.Vector3(), _ko = new THREE.Vector3(0.05, 0.015, 0);
const knife = new THREE.Group(); handR.add(knife); knife.position.set(-0.02, 0.03, -0.18); knife.rotation.set(0, 0.9, 0);
mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.11, 6), mat(0x7a4a20), [0, 0, 0], knife).rotation.z = Math.PI / 2;
mesh(new THREE.BoxGeometry(0.1, 0.006, 0.025), mat(0xd0d0d8, { metalness: 0.8, roughness: 0.25 }), [-0.1, 0, 0], knife);
const oyster = new THREE.Group(); handL.add(oyster); oyster.position.set(0.02, 0.05, -0.16);
const shellBotMat = shellM(0x8a8a8a), shellTopMat = shellM(0xa4a4a2);
const shellBot = mesh(halfGeo, shellBotMat, [0, -0.01, 0], oyster);
const meatInHand = mesh(meatGeo, meatMat, [0, 0.015, 0], oyster);
const shellTop = mesh(halfGeo, shellTopMat, [0, 0.025, 0], oyster);
const barnacles: THREE.Mesh[] = [];
mesh(new THREE.CircleGeometry(0.075, 14), mat(0xeeeae4, { roughness: 0.35, metalness: 0.15 }), [0, 0.008, 0], oyster).scale.set(1.25, 0.9, 1); (oyster.children[oyster.children.length - 1] as THREE.Mesh).rotation.x = -Math.PI / 2;
for (let i = 0; i < 6; i++) barnacles.push(mesh(new THREE.ConeGeometry(0.012, 0.02, 5), mat(0x6e6e70), [rnd(-0.08, 0.08), 0.045, rnd(-0.05, 0.05)], oyster));
const seamMark = mesh(new THREE.BoxGeometry(0.042, 0.016, 0.016), new THREE.MeshBasicMaterial({ color: 0x7a4a1e }), [0, 0.012, 0], oyster);
const seamRing = mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 24), new THREE.MeshBasicMaterial({ color: 0xd8ff80, transparent: true, opacity: 0, depthWrite: false }), [0, 0.02, 0], oyster); seamRing.rotation.x = Math.PI / 2; seamRing.visible = false;
let sweet = false, sweetT = 0;
const seamGlow = mesh(new THREE.BoxGeometry(0.062, 0.026, 0.026), new THREE.MeshBasicMaterial({ color: 0xffc878, transparent: true, opacity: 0, depthWrite: false }), [0, 0.012, 0], oyster);
const shimmer = mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0, 0], oyster);
const pearlMesh = mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.3 }), [0, 0.05, 0], oyster);
pearlMesh.visible = false;
const leanFaces: THREE.Group[] = [];
for (const s of [-1, 1]) { const f = makeAma(s < 0 ? 0x2a7a5a : 0xb04050, s < 0 ? 0x333333 : 0xcccccc).head; f.removeFromParent(); f.rotation.y = Math.PI; f.scale.setScalar(1.3); camera.add(f); f.userData.s = s; f.position.set(s * 1.2, 0.05, -0.75); leanFaces.push(f); }

// ---------- 音效（全部 WebAudio 即時合成，無外部音檔） ----------
type Mix = { master: number; amb: number; sfx: number; mute: boolean ; music: number; gore: boolean; stats: boolean; feed: boolean; sens: number; invX: boolean; invY: boolean };
const MIX_DEF = { master: 0.8, amb: 0.6, sfx: 0.8, mute: false, music: 0.35, gore: true, stats: true, feed: true, sens: 1, invX: false, invY: false };
const mix: Mix = (() => { let raw: any = {}; try { raw = JSON.parse(LS.getItem('oyster-mix') || '{}') || {}; } catch { raw = {}; }
  const m: any = { ...MIX_DEF }; for (const k of Object.keys(MIX_DEF) as (keyof typeof MIX_DEF)[]) if (typeof raw[k] === typeof MIX_DEF[k]) m[k] = raw[k]; return m; })();
// ---------- 匿名統計（無個資；可於設定關閉） ----------
const STATS_URL = 'https://game-status.gwtech.org/e';
const statsId = (() => { try { let v = LS.getItem('oyster-stats-id'); if (!v) { v = crypto.randomUUID(); LS.setItem('oyster-stats-id', v); } return v; } catch { return 'anon-' + Math.random().toString(36).slice(2, 14); } })();
let statsSid = '';
const COARSE = matchMedia('(pointer: coarse)').matches;
const statsDevice = COARSE ? 'mobile' : 'pc';
function track(t: string, d: Record<string, unknown> = {}) {
  if (!mix.stats || SHOT) return;
  try {
    const body = JSON.stringify({ game: 'oyster-sim', id: statsId, platform: 'web', version: __BUILD__, test: __PREVIEW__ || params.get('stattest') === '1', events: [{ t, sid: statsSid || statsId, ts: Date.now(), dev: statsDevice, ...d }] });
    fetch(STATS_URL, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' }).catch(() => { });
  } catch { }
}
let ac: AudioContext | null = null, masterG: GainNode, ambG: GainNode, sfxG: GainNode, musG: GainNode;
function applyMix() { if (!ac) { try { LS.setItem('oyster-mix', JSON.stringify(mix)); } catch { } return; } masterG.gain.value = mix.mute ? 0 : mix.master; ambG.gain.value = mix.amb; sfxG.gain.value = mix.sfx; musG.gain.value = mix.music * 0.5; try { LS.setItem('oyster-mix', JSON.stringify(mix)); } catch { } }
function noiseBuf(a: AudioContext, sec: number) { const n = a.sampleRate * sec, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
function lfo(a: AudioContext, rate: number, depth: number, target: AudioParam) { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(target); o.start(); }
function startAmbience(a: AudioContext) {
  const nb = noiseBuf(a, 4);
  const loopNoise = (type: BiquadFilterType, f: number, vol: number, lrate: number, ldepth: number) => {
    const s = a.createBufferSource(); s.buffer = nb; s.loop = true; const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = a.createGain(); g.gain.value = vol;
    s.connect(fl).connect(g).connect(ambG); s.start(); if (lrate) lfo(a, lrate, ldepth, g.gain); return fl;
  };
  loopNoise('lowpass', 500, 0.35, 0.12, 0.25);   // 海湧
  const wind = loopNoise('highpass', 3000, 0.03, 0.07, 0.02); lfo(a, 0.05, 800, wind.frequency); // 風
  const eng = a.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 42; const ef = a.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 160; const eg = a.createGain(); eg.gain.value = 0.05;
  eng.connect(ef).connect(eg).connect(ambG); eng.start(); lfo(a, 7, 0.02, eg.gain); // 遠遠的漁船引擎
  const gull = () => { const t = a.currentTime; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) { const o = a.createOscillator(), g = a.createGain(), s0 = t + k * 0.28; o.type = 'triangle';
      o.frequency.setValueAtTime(1500, s0); o.frequency.exponentialRampToValueAtTime(900, s0 + 0.22); g.gain.setValueAtTime(0, s0); g.gain.linearRampToValueAtTime(0.04, s0 + 0.03); g.gain.linearRampToValueAtTime(0, s0 + 0.24);
      o.connect(g).connect(ambG); o.start(s0); o.stop(s0 + 0.3); } setTimeout(gull, 5000 + Math.random() * 9000); };
  setTimeout(gull, 2000);
  const radio = () => { const t = a.currentTime, s = a.createBufferSource(); s.buffer = nb; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 3; const g = a.createGain();
    g.gain.value = 0; for (let k = 0; k < 12; k++) g.gain.setValueAtTime(Math.random() < 0.6 ? 0.03 : 0, t + k * 0.12); g.gain.setValueAtTime(0, t + 1.5);
    s.connect(f).connect(g).connect(ambG); s.start(t); s.stop(t + 1.6); setTimeout(radio, 9000 + Math.random() * 12000); };
  setTimeout(radio, 6000);
}
// ----- 收音機懷舊曲（AM 收音機味：帶通 + 輕微失真 + 沙沙聲），收音機開著時跟一般 BGM 交叉淡入淡出 -----
function startRadioMusic(a: AudioContext, bgm: GainNode) {
  const BPM = 84, st = 60 / BPM / 2, N = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  // 小調五聲（A C D E G），三拍子慢版懷舊風；24 步 × 4 段
  const mel = [69, 0, 72, 74, 0, 76, 74, 0, 72, 69, 0, 0, 67, 0, 69, 72, 0, 74, 69, 0, 0, 0, 0, 0,
               76, 0, 79, 76, 0, 74, 72, 0, 74, 76, 0, 0, 74, 0, 72, 69, 0, 67, 69, 0, 0, 0, 0, 0,
               72, 0, 74, 76, 0, 79, 81, 0, 79, 76, 0, 0, 74, 0, 76, 74, 0, 72, 69, 0, 72, 74, 0, 0,
               76, 0, 74, 72, 0, 69, 67, 0, 69, 72, 0, 0, 69, 0, 67, 64, 0, 67, 69, 0, 0, 0, 0, 0];
  const roots = [45, 43, 41, 40, 45, 48, 43, 45]; // Am G F E Am C G Am（每 12 步一個）
  const out = a.createGain(); out.gain.value = 0; out.connect(musG);
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 1.2;
  const ws = a.createWaveShaper(); const cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); } ws.curve = cv;
  const bus = a.createGain(); bus.gain.value = 0.9; bus.connect(hp).connect(ws).connect(lp).connect(out);
  // 沙沙聲（AM 雜訊），音量隨機飄
  const sb = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), sd = sb.getChannelData(0); for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * (Math.random() < 0.002 ? 1 : 0.35);
  const sn = a.createBufferSource(); sn.buffer = sb; sn.loop = true; const sf = a.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1800; sf.Q.value = 0.6; const sg = a.createGain(); sg.gain.value = 0.035;
  sn.connect(sf).connect(sg).connect(out); sn.start(); lfo(a, 0.23, 0.015, sg.gain);
  const lead = (f: number, t: number, d: number) => { const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.04); g.gain.setValueAtTime(0.09, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
    for (const [ty, mul, v] of [['triangle', 1, 1], ['sine', 2, 0.35]] as [OscillatorType, number, number][]) { const o = a.createOscillator(), og = a.createGain(); o.type = ty; o.frequency.value = f * mul; og.gain.value = v; const vib = a.createOscillator(), vg = a.createGain(); vib.frequency.value = 5; vg.gain.value = 14; vib.connect(vg).connect(o.detune); o.connect(og).connect(g); o.start(t); o.stop(t + d + 0.05); vib.start(t); vib.stop(t + d + 0.05); }
    g.connect(bus); };
  const pluck = (f: number, t: number, v: number) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + st * 1.8); o.connect(g).connect(bus); o.start(t); o.stop(t + st * 2); };
  let step = 0, next = a.currentTime + 0.1, on = false;
  setInterval(() => {
    const want = state === 'play' && !tut && gearOn('radio');
    if (want !== on) { on = want; const t = a.currentTime; out.gain.cancelScheduledValues(t); bgm.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); bgm.gain.setValueAtTime(bgm.gain.value, t); out.gain.linearRampToValueAtTime(on ? 1 : 0, t + 0.5); bgm.gain.linearRampToValueAtTime(on ? 0 : 1, t + 0.5); if (on) { step = 0; next = t + 0.05; } }
    if (!on && out.gain.value < 0.001) { next = a.currentTime + 0.1; return; }
    while (next < a.currentTime + 0.25) {
      const i = step % 96, b = i % 6, root = roots[Math.floor(i / 12) % 8];
      const m = mel[i]; if (m) { let d = 1; while (d < 4 && !mel[(i + d) % 96]) d++; lead(N(m), next, st * d * 0.95); }
      if (b === 0) pluck(N(root), next, 0.32); else if (b === 2 || b === 4) { pluck(N(root + 12 + (b === 2 ? 3 : 7)), next, 0.09); pluck(N(root + 19), next, 0.06); }
      next += st; step++;
    }
  }, 60);
}
// ----- 台式電子琴 BGM（那卡西／廟口風，全部 WebAudio 合成） -----
function startMusic(a: AudioContext) {
  const BPM = 128, st = 60 / BPM / 2; // 8 分音符
  const N = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  // 五聲音階旋律（C D E G A），0 = 休止；32 步 × 2 段
  const mel = [76, 0, 79, 76, 74, 0, 72, 74, 76, 79, 81, 0, 79, 76, 74, 0, 72, 0, 74, 72, 69, 0, 67, 69, 72, 74, 76, 74, 72, 0, 0, 0,
               81, 0, 79, 81, 84, 0, 81, 79, 76, 79, 81, 0, 79, 0, 76, 74, 72, 74, 76, 79, 76, 74, 72, 69, 67, 0, 69, 72, 72, 0, 0, 0];
  const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [48, 52, 55], [45, 48, 52], [43, 47, 50], [48, 52, 55]]; // C Am F G C Am G C
  const out = a.createGain(); out.connect(musG); startRadioMusic(a, out);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(out);
  const nb = noiseBuf(a, 0.3);
  const organ = (f: number, t: number, d: number, v: number) => { const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + d * 0.8); g.gain.linearRampToValueAtTime(0, t + d);
    for (const [ty, det, mul] of [['square', 0, 1], ['sawtooth', 7, 1], ['triangle', 0, 2]] as [OscillatorType, number, number][]) { const o = a.createOscillator(); o.type = ty; o.frequency.value = f * mul; o.detune.value = det; const vib = a.createOscillator(), vg = a.createGain(); vib.frequency.value = 5.5; vg.gain.value = 9; vib.connect(vg).connect(o.detune); o.connect(g); o.start(t); o.stop(t + d + 0.02); vib.start(t); vib.stop(t + d + 0.02); }
    g.connect(lp); };
  const bass = (f: number, t: number) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + st * 1.6); o.connect(g).connect(out); o.start(t); o.stop(t + st * 1.7); };
  const stab = (ns: number[], t: number) => ns.forEach(n => { const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = N(n + 12); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + st * 0.8); o.connect(g).connect(lp); o.start(t); o.stop(t + st); });
  const kick = (t: number) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g).connect(out); o.start(t); o.stop(t + 0.2); };
  const hit = (t: number, hp: number, v: number, d: number) => { const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = nb; f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + d); };
  let step = 0, next = a.currentTime + 0.1;
  setInterval(() => {
    while (next < a.currentTime + 0.25) {
      const i = step % 64, beat = i % 8, ch = chords[Math.floor(i / 8)];
      const m = mel[i]; if (m) organ(N(m), next, st * (mel[(i + 1) % 64] ? 0.95 : 1.9), 0.06);
      if (beat === 0 || beat === 4) { bass(N(ch[0] - 12), next); kick(next); }
      if (beat === 2 || beat === 6) { stab(ch, next); hit(next, 1500, 0.25, 0.12); }
      hit(next, 7000, beat % 2 ? 0.05 : 0.08, 0.04);
      next += st; step++;
    }
  }, 60);
}
function audio() {
  if (!ac) { ac = new AudioContext(); masterG = ac.createGain(); ambG = ac.createGain(); sfxG = ac.createGain(); musG = ac.createGain(); musG.connect(masterG); ambG.connect(masterG); sfxG.connect(masterG); masterG.connect(ac.destination); applyMix(); startAmbience(ac); startMusic(ac); }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function noise(dur: number, freq: number, vol: number, sweepTo = 0) {
  const a = audio(), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, a.currentTime + dur);
  const g = a.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(sfxG); s.start();
}
function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0, glideTo = 0) {
  const a = audio(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxG); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  creak: () => tone(rnd(140, 200), 0.18, 0.08, 'sawtooth', 0, rnd(90, 120)),
  whoosh: () => noise(0.3, 400, 0.35, 2500),
  plop: () => { tone(420, 0.1, 0.2, 'sine', 0, 180); tone(700, 0.06, 0.08, 'triangle', 0.04); },
  splat: () => { noise(0.22, 300, 0.5); tone(90, 0.12, 0.15, 'sine'); },
  aia: () => { tone(520, 0.12, 0.15, 'square', 0, 700); tone(700, 0.25, 0.15, 'square', 0.12, 380); noise(0.08, 200, 0.4); },
  pinch: () => { noise(0.05, 3500, 0.5); tone(1200, 0.1, 0.1, 'square', 0.02, 800); },
  jingle: (up = true) => [0, 1, 2, 3].forEach(k => tone(up ? 660 * Math.pow(1.26, k) : 400 / Math.pow(1.2, k), 0.18, 0.12, 'triangle', k * 0.09)),
  sneak: () => { tone(300, 0.08, 0.05, 'sine'); tone(240, 0.08, 0.05, 'sine', 0.12); },
  sting: () => { tone(220, 0.35, 0.2, 'square', 0, 110); tone(233, 0.35, 0.15, 'sawtooth', 0.02, 116); },
  hitNpc: () => { noise(0.08, 2500, 0.5); tone(160, 0.1, 0.2, 'sine'); },
  alert: () => { tone(880, 0.1, 0.12, 'square'); tone(660, 0.1, 0.12, 'square', 0.15); tone(880, 0.1, 0.12, 'square', 0.3); },
  boing: () => { tone(160, 0.45, 0.3, 'sine', 0, 420); tone(320, 0.3, 0.1, 'triangle', 0.05, 640); },
  pop: () => noise(0.05, 1500, 0.3),
  endJingle: (good: boolean) => (good ? [523, 659, 784, 1046] : [523, 494, 440, 392]).forEach((f, k) => tone(f, 0.3, 0.14, 'triangle', k * 0.16)),
  murmur: (pitch: number) => { const n = 3 + Math.floor(Math.random() * 4); for (let k = 0; k < n; k++) tone(pitch * rnd(0.85, 1.25), 0.07, 0.045, 'square', k * 0.09); },
};
const crackSound = (big = true) => { noise(0.12, 2400, big ? 0.9 : 0.4); tone(180, 0.06, 0.3, 'triangle', 0.02); };
const ding = (rare: number) => { const base = [1318, 1568, 1760, 2093][rare]; tone(base, 1.4, 0.25); tone(base * 1.5, 1.2, 0.12, 'sine', 0.12); if (rare >= 2) tone(base * 2, 1.5, 0.1, 'sine', 0.3); };

// ---------- 難度、珍珠、奇物、存檔 ----------
const DIFF = [
  { n: '易', css: '#9be37a', tol: 0.45, need: 2, lo: 0.12, hi: 0.85, slip: 0.1, scale: 0.85, rough: 0 },
  { n: '普通', css: '#f5d9a8', tol: 0.33, need: 3, lo: 0.18, hi: 0.72, slip: 0.2, scale: 1.0, rough: 2 },
  { n: '硬', css: '#ffa860', tol: 0.24, need: 5, lo: 0.25, hi: 0.62, slip: 0.35, scale: 1.15, rough: 4 },
  { n: '超硬', css: '#ff6a5a', tol: 0.17, need: 7, lo: 0.3, hi: 0.55, slip: 0.5, scale: 1.3, rough: 6 },
];
const DIFF_W = [30, 40, 22, 8];
// 上工地點：工錢倍率越高，蚵仔越硬、阿婆越兇、丟殼越頻繁
type Loc = { id: string; n: string; m: number; w: number[]; thr: number; ang: number; price: number; need: number; tint: number | null; d: string };
const LOCS: Loc[] = [
  { id: 'home', n: '🏠 自家蚵寮', m: 1, w: DIFF_W, thr: 1, ang: 1, price: 0, need: 0, tint: null, d: '熟悉的老位子，阿婆們都很和氣' },
  { id: 'wanggong', n: '⚓ 王功漁港', m: 1.2, w: [22, 40, 28, 10], thr: 1.2, ang: 1.15, price: 800, need: 60, tint: 0x5f8fb0, d: '海風大、硬殼多一點，阿婆稍微兇' },
  { id: 'dongshi', n: '🎡 東石漁人碼頭', m: 1.4, w: [14, 34, 36, 16], thr: 1.4, ang: 1.3, price: 2500, need: 200, tint: 0xd08a5a, d: '觀光客多、蚵仔偏硬，阿婆丟殼更勤' },
  { id: 'budai', n: '🏭 布袋蚵寮大廠', m: 1.7, w: [8, 26, 40, 26], thr: 1.7, ang: 1.5, price: 6000, need: 500, tint: 0x8a9a7a, d: '工錢最高，但蚵仔超硬、阿婆最兇' }];
const locNow = () => LOCS.find(l => l.id === save.loc && (l.need === 0 || save.locs?.includes(l.id))) ?? LOCS[0];
const locW = () => locNow().w;
const RAR = [
  { name: '白珍珠', color: 0xf4f1ea, css: '#f4f1ea', w: 70, price: 200, emo: '⚪', tease: '最常見的珍珠，多剝幾顆就有' },
  { name: '粉珍珠', color: 0xf3b5c8, css: '#f3b5c8', w: 20, price: 600, emo: '🩷', tease: '聽說有粉紅色的，很漂亮' },
  { name: '金珍珠', color: 0xf2c440, css: '#f2c440', w: 8, price: 1800, emo: '🟡', tease: '金光閃閃的…有人說過' },
  { name: '黑珍珠', color: 0x22202a, css: '#3a3548', w: 2, price: 6000, emo: '⚫', tease: '傳說中的黑色寶貝，剝一輩子才看到一次' },
];
const ODD = [
  { name: '假牙', css: '#f0e8e0', w: 30, emo: '🦷', tease: '聽說有人在蚵裡挖到…會笑的東西', price: 50, line: '誰的假牙啦！？', cry: ['哎唷，那不是阿雄伯的嗎？', '笑死，假牙也會長蚵仔'] },
  { name: '古早硬幣', css: '#c08a40', w: 30, emo: '🪙', tease: '圓圓的、銀色的，老古董', price: 300, line: '日治時代的銀幣！', cry: ['古董喔！可以賣錢！', '我阿公以前也有收'] },
  { name: '金戒指', css: '#f2c440', w: 10, emo: '💍', tease: '某人的定情物遺落在海裡…', price: 2500, line: '金戒指！誰的定情物？', cry: ['金的耶！給我看看！', '這要不要報警？'] },
  { name: '小螃蟹', css: '#e05a3a', w: 30, emo: '🦀', tease: '小心，會夾手！', price: 0, line: '螃蟹夾手了！！', cry: ['快甩！快甩！', '哈哈哈，牠夾得好緊'] },
  { name: '統一發票', css: '#f4f4f0', w: 24, price: 5, emo: '🧾', tease: '溼溼的紙…上面有號碼', line: '誰的發票塞進蚵仔裡！', cry: ['快對對看有沒有中！', '溼答答的，號碼看不清了'] },
  { name: '幾枚銅板', css: '#c89a50', w: 24, price: 20, emo: '🪙', tease: '叮叮噹噹的零錢聲', line: '十塊、五塊…發財了！', cry: ['蚵仔也會存錢喔', '拿去買飲料'] },
  { name: '機車鎖匙', css: '#a8b0b8', w: 16, price: 0, emo: '🔑', tease: '某人一直在找的東西', line: '誰的機車鑰匙？！', cry: ['阿明找一整天了！', '快去廣播！'] },
  { name: '珍奶吸管', css: '#3a6ad8', w: 16, price: 1, emo: '🥤', tease: '粗粗的、塑膠的…海洋垃圾', line: '珍珠奶茶的粗吸管…', cry: ['海洋垃圾啦！', '不是那種珍珠啦'] },
  { name: '紅包', css: '#d8282a', w: 9, price: 600, emo: '🧧', tease: '紅紅的、過年才有', line: '紅包！裡面有錢！', cry: ['恭喜發財！', '分我一半啦'] },
  { name: '媽祖平安符', css: '#e8b030', w: 7, price: 888, emo: '🏮', tease: '有神明保佑的東西', line: '媽祖的平安符！', cry: ['媽祖保佑！', '今天一定好運'] },
  { name: '筊杯', css: '#c0302a', w: 6, price: 400, emo: '🌙', tease: '一對紅紅的半月', line: '一對筊杯！聖筊！', cry: ['問神明今天會不會贏', '笑死人了哈哈'] },
  { name: '大同電鍋公仔', css: '#e04a3a', w: 4, price: 1200, emo: '🍚', tease: '台灣人家家都有一台的…迷你版', line: '大同電鍋迷你公仔！', cry: ['收藏價值高喔！', '我家那台用三十年了'] },
  { name: '中獎發票', css: '#ffe07a', w: 1, price: 8000, emo: '🎫', tease: '傳說有人在蚵裡挖到千萬…', line: '中獎了！！是頭獎！', cry: ['快去領！快去領！', '請客！請客！'] },
  { name: '開港紀念蚵', css: '#c8443a', w: 0, price: 0, emo: '⚓', tease: '活動限定：開港紀念包才拿得到', line: '開港紀念，蚵仔大豐收！', cry: ['這顆是紀念的喔！', '開港大吉！'], ex: true },
  // 2026-11 新增 20 種怪奇物（只能接在最後面，存檔用索引）
  { name: '會說話的鹹酥雞', css: '#d8962a', w: 22, price: 30, emo: '', tease: '聞起來很香…好像還會講話', line: '一直說「加辣嗎？」', cry: ['不要辣，謝謝！', '鹹酥雞怎麼跑進蚵裡啦'], ic: "<path d='M6 9h12l-2 12H8z'/><path d='M9 9V6a3 3 0 0 1 6 0v3M10 14h.01M14 14h.01M10 17h4'/>" },
  { name: '插著吸管的蚵', css: '#b8b0a0', w: 22, price: 15, emo: '', tease: '有人在蚵裡留了一根管子', line: '好像有人先喝過了', cry: ['誰先喝的啦！', '蚵仔也可以外帶喔？'], ic: "<path d='M3 15c0-4 4-7 9-7s9 3 9 7-4 5-9 5-9-1-9-5z'/><path d='M13 12l5-10h3'/>" },
  { name: '迷你斑馬線', css: '#f4f4f0', w: 22, price: 40, emo: '', tease: '一條一條白白的…有誰在等', line: '有一隻螃蟹正在乖乖等紅燈', cry: ['好有交通道德', '綠燈了，快過！'], ic: "<path d='M3 20h18M3 4h18M6 7v10M10 7v10M14 7v10M18 7v10'/>" },
  { name: '會自己捲起來的海帶', css: '#4a8a4a', w: 22, price: 25, emo: '', tease: '軟軟的、綠綠的，會自己動', line: '捲成「謝謝光臨」四個字', cry: ['這海帶很有禮貌', '歡迎再來！'], ic: "<path d='M12 21c-4-3 4-6 0-9s4-6 0-9'/><path d='M7 21c-3-3 3-6 0-9M17 12c3-3-3-6 0-9'/>" },
  { name: '夾娃娃機的夾子', css: '#c0c8d0', w: 22, price: 60, emo: '', tease: '鐵做的，三根爪子', line: '裡面還夾著一顆更小的蚵', cry: ['保夾成功！', '這台機台好佛心'], ic: "<path d='M12 2v7M8 9h8M8 9l-3 6 3 4M16 9l3 6-3 4M12 9v9'/><circle cx='12' cy='19' r='2'/>" },
  { name: '珍珠奶茶的珍珠', css: '#a07858', w: 14, price: 120, emo: '', tease: '黑黑圓圓的…不像珍珠', line: '這顆不是我生的。', cry: ['蚵仔說不是牠的', '拿去配奶茶啦'], ic: "<circle cx='12' cy='13' r='7'/><path d='M9 11a3 3 0 0 1 3-2M12 6V2'/>" },
  { name: '迷你麥克風', css: '#8a8a98', w: 14, price: 200, emo: '', tease: '小小的，好像想唱歌', line: '一拿出來就自己開始唱〈愛拚才會贏〉', cry: ['三分天註定！', '七分靠打拚！'], ic: "<rect x='9' y='2' width='6' height='11' rx='3'/><path d='M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8'/>" },
  { name: '里長的名片', css: '#f0e6c8', w: 14, price: 150, emo: '', tease: '一張小紙片，上面印著頭銜', line: '背面寫著「有事找我」', cry: ['里長伯人真好', '水溝不通也可以找嗎？'], ic: "<rect x='2' y='6' width='20' height='12'/><circle cx='8' cy='12' r='2'/><path d='M13 10h6M13 14h4'/>" },
  { name: '會發熱的暖暖包', css: '#e87a4a', w: 14, price: 100, emo: '', tease: '摸起來…怎麼是溫的？', line: '在海裡泡了不知道多久，還是熱的', cry: ['好暖喔，借我握一下', '品質太好了吧'], ic: "<rect x='5' y='5' width='14' height='16'/><path d='M9 2c-1 1 1 2 0 3M12 2c-1 1 1 2 0 3M15 2c-1 1 1 2 0 3M9 13h6'/>" },
  { name: '小烏龜', css: '#5a9a5a', w: 14, price: 0, emo: '', tease: '慢吞吞的，背著一個家', line: '自己慢慢爬出蚵殼走了', cry: ['慢走喔～', '不要跑太快'], ic: "<path d='M4 15a8 6 0 0 1 16 0z'/><path d='M20 13h2M5 15l-1 3M19 15l1 3M9 15l-1 3M15 15l1 3M9 11l3-2 3 2'/>" },
  { name: '迷你神明', css: '#e8b030', w: 5, price: 1500, emo: '', tease: '坐得很端正，好像在保佑誰', line: '一尊小小的土地公，坐得很端正', cry: ['快拜一下！', '福德正神保佑'], ic: "<circle cx='12' cy='6' r='3'/><path d='M7 21v-8l5-3 5 3v8zM5 21h14M10 16c1 1 3 1 4 0'/>" },
  { name: '摺好的紅包', css: '#d8282a', w: 5, price: 3, emo: '', tease: '紅紅的、摺得很整齊', line: '裡面是 3 塊錢和一張「謝謝」', cry: ['三塊也是心意', '哈哈哈，好有禮貌'], ic: "<rect x='6' y='2' width='12' height='20'/><path d='M6 8l6 4 6-4'/><circle cx='12' cy='15' r='2'/>" },
  { name: '會響的手機', css: '#8ab0d8', w: 5, price: 800, emo: '', tease: '裡面傳出鈴聲…', line: '來電顯示「阿母」', cry: ['快接！是阿母！', '阿母找你吃飯啦'], ic: "<rect x='7' y='2' width='10' height='20'/><path d='M11 18h2M3 7c-1 2-1 4 0 6M21 7c1 2 1 4 0 6'/>" },
  { name: '一副假睫毛', css: '#e0a8c0', w: 5, price: 600, emo: '', tease: '彎彎的、黑黑的兩條', line: '比蚵還要漂亮', cry: ['好會畫喔', '借我戴一下'], ic: "<path d='M2 12c3-3 6-3 9 0M13 12c3-3 6-3 9 0M3 11l-1-3M6 9.5l-1-3M9 10l1-3M14 11l-1-3M17 9.5l-1-3M20 10l1-3'/>" },
  { name: '迷你漁船', css: '#3a7ac0', w: 5, price: 1200, emo: '', tease: '小小的，有船帆', line: '裡面坐著更小的阿伯在補網', cry: ['阿伯辛苦了！', '今天有沒有漁獲？'], ic: "<path d='M3 15h18l-3 5H6z'/><path d='M12 15V3l6 9h-6'/>" },
  { name: '一整碗蚵仔煎', css: '#e86a4a', w: 1, price: 6000, emo: '', tease: '熱熱的…還有醬汁的味道', line: '熱騰騰的，還附醬', cry: ['蚵仔煎自己出來了！', '分我一口啦'], ic: "<path d='M3 11h18a9 9 0 0 1-18 0z'/><path d='M9 20h6M8 3c-1 2 1 3 0 5M12 3c-1 2 1 3 0 5M16 3c-1 2 1 3 0 5'/>" },
  { name: '另一個蚵', css: '#b8a890', w: 1, price: 8000, emo: '', tease: '蚵裡面…好像還有東西', line: '打開裡面還有一個蚵，裡面又有一個蚵……', cry: ['剝不完了啦！', '蚵中蚵中蚵'], ic: "<path d='M2 13c0-5 4-9 10-9s10 4 10 9-4 7-10 7S2 18 2 13z'/><path d='M7 13c0-2 2-4 5-4s5 2 5 4-2 3-5 3-5-1-5-3z'/><circle cx='12' cy='13' r='1'/>" },
  { name: '外星人名片', css: '#7ae0a0', w: 1, price: 9999, emo: '', tease: '不像是地球的東西', line: '聯絡方式是「看天上」', cry: ['外星人也剝蚵喔？', '快抬頭看看！'], ic: "<rect x='2' y='7' width='20' height='12'/><path d='M7 15c-2 0-2-5 0-5s2 5 0 5zM12 11h6M12 15h4M17 3l-2 4'/>" },
  { name: '過期的樂透彩券', css: '#f2d060', w: 1, price: 0, emo: '', tease: '六個號碼…好像哪裡不對', line: '對了六個號碼，但是是去年的', cry: ['差一年啦！！', '好可惜喔…'], ic: "<rect x='3' y='4' width='18' height='16'/><circle cx='8' cy='10' r='1.5'/><circle cx='12' cy='10' r='1.5'/><circle cx='16' cy='10' r='1.5'/><path d='M6 16h12M4 5l16 14'/>" },
  { name: '縮小的阿婆', css: '#d0a0b0', w: 1, price: 10000, emo: '', tease: '有人說…在蚵裡看到自己', line: '長得跟你一模一樣，正在剝更小的蚵', cry: ['那不是你嗎！？', '她也在剝蚵耶'], ic: "<circle cx='12' cy='5' r='3'/><path d='M8 21l1-8h6l1 8M9 13l-3 3M15 13l2 2M17 15l2-2'/>" },
];
const dexN = () => save.dex.filter(x => x).length + save.odd.filter(x => x).length;
const rarOf = (w: number) => w <= 2 ? 'legend' : w <= 10 ? 'rare' : w <= 20 ? 'uncommon' : 'common';
// 入碗工錢依難度：易／普通／硬／超硬；殼屑 = 25%（至少 $1）
const DPAY = [6, 8, 12, 18], DSHORT = ['易', '普', '硬', '超硬'];
let meatPay = 0, dCnt = [0, 0, 0, 0];
const OYSTER_PRICE = 8, CRACK_PRICE = 2, PERFECT_PAY = 2;
// 新手保護：生涯收工未滿 3 班 → 只出易／普通、綠區 +30%、割手率 -40%
const newbie = () => !tut && save.days < 3;
// 統計：本班各難度 [開殼, 插刀失敗, 割手, 殼碎]、收工原因
let dStat = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], endReason = 'time';
const dstatStr = () => dStat.flat().join(',');
// ----- 存檔（有版本號；舊存檔會自動補欄位，壞去就用預設） -----
const SAVE_V = 3;
const LIFE_KEYS = ['opened', 'inBowl', 'missed', 'wasteShells', 'cracked', 'perfects', 'abandoned', 'stabs', 'steals', 'caught', 'meatHits', 'shellHits', 'hitsTaken', 'blocks', 'reflects', 'lost', 'bestCombo'] as const;
type Life = Record<typeof LIFE_KEYS[number], number>;
type Save = { v: number; dex: number[]; odd: number[]; best: number; money: number; days: number; queen: number; life: Life; titles: Record<string, number>; shop: { owned: string[]; equipped: Record<string, string> }; seat?: string; bonusDay?: string; bonusN?: number; tutDone?: number; locs?: string[]; loc?: string; name?: string; locSeen?: string[]; gear?: Record<string, boolean>; redeemed: string[]; meds: Record<string, number>; trial?: { id: string; left: number }; equip?: Record<string, string>; namePrompted?: number; tpv?: number };
const START_MONEY = 10000; // 首次遊玩見面禮（僅無存檔的新玩家）
function defaultSave(): Save { return { v: SAVE_V, redeemed: [], meds: {}, dex: [0, 0, 0, 0], odd: ODD.map(() => 0), best: 0, money: START_MONEY, days: 0, queen: 0, life: Object.fromEntries(LIFE_KEYS.map(k => [k, 0])) as Life, titles: {}, shop: { owned: [], equipped: {} }, locs: [], gear: {} }; }
function loadSave(): Save {
  const d = defaultSave(); let raw: any = null;
  try { raw = JSON.parse(LS.getItem('oyster-sim') || 'null'); } catch { raw = null; }
  if (!raw || typeof raw !== 'object') return d;
  const num = (x: any, def = 0) => (typeof x === 'number' && isFinite(x) ? x : def);
  const arr4 = (a: any) => [0, 1, 2, 3].map(i => num(Array.isArray(a) ? a[i] : 0));
  // v1（無 v 欄位）→ v2：加 life／titles／shop
  const out: Save = { ...d, dex: arr4(raw.dex), odd: ODD.map((_, i) => num(Array.isArray(raw.odd) ? raw.odd[i] : 0)), best: num(raw.best), money: num(raw.money), days: num(raw.days), queen: num(raw.queen) };
  for (const k of LIFE_KEYS) out.life[k] = num(raw.life?.[k]);
  if (raw.titles && typeof raw.titles === 'object') for (const [k0, v] of Object.entries(raw.titles)) { const k = k0 === '👑 今日蚵后' ? '👑 今日剝蚵冠軍' : k0; out.titles[k] = (out.titles[k] ?? 0) + num(v); }
  if (raw.namePrompted) out.namePrompted = 1;
  if (raw.tpv) out.tpv = 1;
  if (raw.equip && typeof raw.equip === 'object') { out.equip = {}; for (const [k, v] of Object.entries(raw.equip)) if (typeof v === 'string') out.equip[k] = v; }
  if (Array.isArray(raw.shop?.owned)) out.shop.owned = raw.shop.owned.filter((x: any) => typeof x === 'string');
  if (raw.shop?.equipped && typeof raw.shop.equipped === 'object') for (const [k, v] of Object.entries(raw.shop.equipped)) if (typeof v === 'string') out.shop.equipped[k] = v;
  if (typeof raw.seat === 'string') out.seat = raw.seat;
  if (typeof raw.bonusDay === 'string') out.bonusDay = raw.bonusDay;
  out.bonusN = num(raw.bonusN); out.tutDone = num(raw.tutDone);
  if (raw.meds && typeof raw.meds === 'object') for (const [k, v] of Object.entries(raw.meds)) out.meds[k] = Math.max(0, Math.floor(num(v)));
  out.locs = Array.isArray(raw.locs) ? raw.locs.filter((x: any) => typeof x === 'string') : []; if (typeof raw.loc === 'string') out.loc = raw.loc;
  out.gear = {}; if (raw.gear && typeof raw.gear === 'object') for (const [k, v] of Object.entries(raw.gear)) out.gear[k] = !!v;
  if (typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.slice(0, 16);
  if (Array.isArray(raw.locSeen)) out.locSeen = raw.locSeen.filter((x: any) => typeof x === 'string');
  if (raw.trial && typeof raw.trial.id === 'string' && num(raw.trial.left) > 0) out.trial = { id: raw.trial.id, left: num(raw.trial.left) };
  if (Array.isArray(raw.redeemed)) out.redeemed = raw.redeemed.filter((x: any) => typeof x === 'string');
  return out;
}
const save: Save = loadSave();
// 每日上工費：用裝置本地日曆日判斷
const DAILY_PAY = 100;
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function renderDaily() {
  const b = document.getElementById('daily') as HTMLButtonElement | null; if (!b) return;
  const done = save.bonusDay === todayKey();
  b.disabled = done; b.classList.toggle('done', done);
  b.innerHTML = done ? `✅ 今天的上工費已經領過了・明天再來領<small>身上有 $${save.money}</small>` : `💰 領今日上工費 $${DAILY_PAY}<small>阿姨說：今天也要加油喔！</small>`;
}
function claimDaily(ev?: Event) {
  if (save.bonusDay === todayKey()) { renderDaily(); return; }
  save.bonusDay = todayKey(); save.bonusN = (save.bonusN ?? 0) + 1; save.money += DAILY_PAY; persist();
  track('daily_bonus', { amount: DAILY_PAY, streak: save.bonusN, money: save.money });
  try { audio(); for (let k = 0; k < 6; k++) tone(1200 + k * 180, 0.12, 0.09, 'square', k * 0.07, 1800 + k * 180); tone(523, 0.4, 0.12, 'triangle', 0.45); tone(784, 0.5, 0.12, 'triangle', 0.55); } catch { }
  const b = document.getElementById('daily')!; const r = b.getBoundingClientRect();
  for (let i = 0; i < 14; i++) { const c = document.createElement('div'); c.className = 'coinfx'; c.textContent = '🪙'; c.style.left = `${r.left + r.width / 2}px`; c.style.top = `${r.top + r.height / 2}px`; c.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`); c.style.setProperty('--dy', `${-80 - Math.random() * 160}px`); c.style.animationDelay = `${i * 0.03}s`; document.body.appendChild(c); setTimeout(() => c.remove(), 1400); }
  const plus = document.createElement('div'); plus.className = 'coinplus'; plus.textContent = `+$${DAILY_PAY}`; plus.style.left = `${r.left + r.width / 2}px`; plus.style.top = `${r.top}px`; document.body.appendChild(plus); setTimeout(() => plus.remove(), 1500);
  ev?.stopPropagation(); renderDaily();
}
const persist = () => { try { LS.setItem('oyster-sim', JSON.stringify(save)); } catch { /* 私密模式等 */ } };
persist();
let dry = 0;
const wpick = (arr: { w: number }[]) => { let r = Math.random() * arr.reduce((s, x) => s + x.w, 0); for (let i = 0; i < arr.length; i++) { r -= arr[i].w; if (r < 0) return i; } return 0; };
// 幸運值：每點 找著機率 ×(1+0.12×luck)；非普通物件權重 ×(1+0.15×luck)，傳說最多 ×1.3
const luckNow = () => Math.max(0, (knifeNow().luck || 0) + medA('luck') + fxAll().luck);
const luckW = (arr: { w: number }[], l: number) => arr.map(x => ({ w: x.w <= 2 ? x.w * Math.min(1.3, 1 + 0.15 * l) : x.w <= 20 ? x.w * (1 + 0.15 * l) : x.w }));
function rollFind(): { kind: 'pearl' | 'odd' | 'none'; i: number } {
  const l = luckNow(), f = 1 + 0.12 * l;
  const p = (1 / 50 + Math.max(0, dry - 40) * 0.01) * f * fxAll().pearl;
  if (Math.random() < p) { dry = 0; return { kind: 'pearl', i: wpick(luckW(RAR, l)) }; }
  // 新手：普通／少見（權重 ≥20）額外 +1.5 倍機率 → 合計約 ×2.5；稀有／傳說不加
  const common = (arr: { w: number }[]) => luckW(arr, l).map((x, i) => ({ w: arr[i].w >= 20 ? x.w : 0 }));
  if (newbie() && Math.random() < p * 1.5) { dry = 0; return { kind: 'pearl', i: wpick(common(RAR)) }; }
  dry++;
  if (Math.random() < (1 / 24) * f) return { kind: 'odd', i: wpick(luckW(ODD, l)) };
  if (newbie() && Math.random() < (1 / 24) * f * 1.5) return { kind: 'odd', i: wpick(common(ODD)) };
  // 保底：第一班到第 5 顆還沒找到東西 → 給一顆白珍珠
  if (!tut && save.days === 0 && opened >= 4 && !dayPearls.length && !dayOdd.length) { dry = 0; return { kind: 'pearl', i: 0 }; }
  return { kind: 'none', i: 0 };
}

// 奇物模型
const oddMeshes: THREE.Object3D[] = ODD.map((o, i) => {
  const g = new THREE.Group(); oyster.add(g); g.position.set(0, 0.05, 0); g.visible = false;
  if (i === 0) { mesh(new THREE.BoxGeometry(0.07, 0.02, 0.03), mat(0xe89a9a), [0, 0, 0], g); for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.011, 0.018, 0.012), mat(0xffffff), [-0.028 + k * 0.014, 0.017, -0.01], g); }
  if (i === 1) mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 16), mat(0xb0b0b8, { metalness: 0.7, roughness: 0.3 }), [0, 0, 0], g);
  if (i === 2) { const r = mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), mat(0xf2c440, { metalness: 0.9, roughness: 0.2 }), [0, 0.01, 0], g); r.rotation.x = 1.2; mesh(new THREE.OctahedronGeometry(0.01), mat(0xffffff, { roughness: 0.1 }), [0, 0.034, 0], g); }
  if (i === 3) { const b = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xd04a2a), [0, 0, 0], g); b.scale.y = 0.5; for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.016, 6, 5), mat(0xe05a3a), [s * 0.045, 0.005, -0.03], g); for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), mat(0xc04a2a), [s * 0.04, -0.005, -0.01 + k * 0.015], g); } }
  if (i >= 4) { const c = parseInt(o.css.slice(1), 16), M = mat(c, { roughness: 0.5 });
    if (o.name.includes('發票')) { const b = mesh(new THREE.BoxGeometry(0.05, 0.002, 0.07), M, [0, 0.005, 0], g); b.rotation.z = 0.15; }
    else if (o.name.includes('銅板')) for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 14), mat(c, { metalness: 0.8, roughness: 0.3 }), [k * 0.02 - 0.02, k * 0.004, k % 2 * 0.01], g);
    else if (o.name.includes('鎖匙')) { mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 12), mat(c, { metalness: 0.8 }), [-0.02, 0, 0], g).rotation.x = Math.PI / 2; mesh(new THREE.BoxGeometry(0.04, 0.004, 0.008), mat(c, { metalness: 0.8 }), [0.012, 0, 0], g); }
    else if (o.name.includes('吸管')) mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), M, [0, 0.01, 0], g).rotation.z = Math.PI / 2.4;
    else if (o.name === '紅包') { mesh(new THREE.BoxGeometry(0.04, 0.006, 0.065), M, [0, 0.005, 0], g); mesh(new THREE.BoxGeometry(0.016, 0.007, 0.016), mat(0xf2c440, { metalness: 0.7 }), [0, 0.006, 0], g); }
    else if (o.name.includes('平安符')) { mesh(new THREE.BoxGeometry(0.03, 0.004, 0.05), mat(0xe8b030), [0, 0.005, 0], g); mesh(new THREE.BoxGeometry(0.02, 0.005, 0.012), mat(0xc0302a), [0, 0.006, 0.012], g); }
    else if (o.name === '筊杯') for (const sx of [-1, 1]) { const h = mesh(new THREE.SphereGeometry(0.022, 10, 6, 0, Math.PI), M, [sx * 0.018, 0.008, 0], g); h.scale.set(0.6, 1, 1.4); h.rotation.set(-Math.PI / 2, 0, sx * 0.3); }
    else if (o.name.includes('電鍋')) { mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.035, 16), M, [0, 0.018, 0], g); mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 16), mat(0xf4f0e8), [0, 0.038, 0], g); mesh(new THREE.SphereGeometry(0.006, 6, 4), mat(0x222222), [0, 0.044, 0], g); }
    else if ('ic' in o) { const b = mesh(new THREE.SphereGeometry(0.028, 10, 8), M, [0, 0.012, 0], g); b.scale.y = 0.55; mesh(new THREE.BoxGeometry(0.02, 0.012, 0.02), mat(0xffffff, { roughness: 0.3 }), [0, 0.026, 0], g); }
    else { mesh(new THREE.BoxGeometry(0.055, 0.003, 0.075), mat(0xffe07a, { emissive: 0x806010, roughness: 0.3 } as any), [0, 0.005, 0], g); }
  }
  return g;
});
// 紅白雨傘（傳統菜市仔款）
const umb = new THREE.Group(); camera.add(umb); umb.visible = false;
var umb3Ready = false, umbSlow = 1; let umbSize = 1, umbS = 0, umbLook = 'stripe';
function buildUmb(look: string, size: number) {
  while (umb.children.length) umb.remove(umb.children[0]); umbSize = size; umbLook = look; if (umb3Ready) build3Umb();
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const x = cv.getContext('2d')!;
  const pal: Record<string, string[]> = { stripe: ['#c8302a', '#f4f0e8'], clear: ['#cfe6ff', '#e4f2ff'], navy: ['#1f2b4a', '#24335a'], beach: ['#e83a3a', '#f6c33a', '#3ab0e8', '#5ac85a'], temple: ['#b0141a', '#e8b030'] };
  const cols = pal[look] ?? pal.stripe; for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * 32, 0, 32, 32); }
  if (look === 'temple') { x.fillStyle = '#ffe28a'; x.fillRect(0, 26, 256, 6); }
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: look === 'clear' ? 0.1 : 0.8, transparent: look === 'clear', opacity: look === 'clear' ? 0.45 : 1 });
  const c = mesh(new THREE.ConeGeometry(0.9 * size, 0.35 * size, look === 'temple' ? 24 : 16, 1, true), m, [0, 0, 0], umb); c.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), mat(look === 'temple' ? 0xd8a020 : 0x6a4a2a), [0, -0.05, 0.35], umb).rotation.x = Math.PI / 2;
}
buildUmb('stripe', 1);
umb.position.set(0, 0, -0.75);

// ---------- 遊戲狀態 ----------
let tapAim = false, tossT0 = 0; const TAP_HINT = '肉在刀尖上！點一下碗（或碗附近）丟進去，越快越俐落';
type Phase = 'pick' | 'scoop' | 'seam' | 'twist' | 'aim' | 'empty' | 'crab' | 'busy';
let state: 'menu' | 'play' | 'end' = 'menu';
let tut: { i: number; c0: number; t0: number; b0: number; s0: number } | null = null; // 教學進行中
let phase: Phase = 'busy';
let hp = 100, stabs = 0, flinch = 0, hurtT = 0, handPain = false;
let timeLeft = SHIFT, count = 0, bowlBonus = 0, cracked = 0, opened = 0, missed = 0, abandoned = 0, perfects = 0, dayPearls: number[] = [], dayOdd: number[] = [];
let reflects = 0, wasteShells = 0, thrown = 0, lost = 0, blockStreak = 0;
let steals = 0, caught = 0, penalty = 0, meatHits = 0, shellHits = 0, blocks = 0, hitsTaken = 0, crackedNow = false;
let holding = false, hold = 0, diff = 1, slowmo = 0, shake = 0, pearlShow = 0;
let rot = 0, seamA = 0, lastTick = 0, progress = 0, tension = 0, strokeDir = 0, strokeLen = 0, strokePeak = 0, crabShakes = 0, lastKeyT = 0, lastKey = '';
let find: ReturnType<typeof rollFind> = { kind: 'none', i: 0 };
let umbT = 0, stealT = 0, stealNpc: Npc | null = null, rotKey = 0, emptyT = 0;
let yaw = 0, pitch = -0.85, tYaw = 0, tPitch = -0.85;
const timers: { t: number; f: () => void }[] = [];
const later = (t: number, f: () => void) => timers.push({ t, f });
const flyers: { m: THREE.Object3D; p0: THREE.Vector3; p1: THREE.Vector3 | (() => THREE.Vector3); t: number; dur: number; h: number; end?: () => void }[] = [];
const fly = (m: THREE.Object3D, p0: THREE.Vector3, p1: THREE.Vector3 | (() => THREE.Vector3), dur: number, h: number, end?: () => void) => { scene.add(m); m.position.copy(p0); flyers.push({ m, p0, p1, t: 0, dur, h, end }); };
const gauge = $('gauge'), fill = $('fill'), zone = $('zone'), label = $('label'), hint = $('hint'), toastEl = $('toast');
let toastT = 0;
function toast(t: string, c = '#ffe080') { toastEl.textContent = t; toastEl.style.color = c; toastEl.classList.add('on'); toastT = 1.1; }
let inZ0 = '';
function setInZ(z: string) { if (z === inZ0) return; const was = inZ0; inZ0 = z; gauge.classList.toggle('inZ', !!z); gauge.classList.toggle('inP', z === 'p'); $('gtag').textContent = z === 'p' ? '完美！' : z ? '現在！' : '';
  if (z && !was) { navigator.vibrate?.(15); tone(z === 'p' ? 1320 : 990, 0.04, 0.06, 'triangle'); } }
const IDEAL = 0.75; let PERF0 = 0.7, PERF1 = 0.8;
const HINTS: Record<Phase, string> = {
  pick: COARSE ? '看自己的紅臉盆，點一顆蚵仔（或點自己的手）拿起來（小顆比較好撬，黑又粗的比較硬）' : '看自己的紅臉盆，點一顆蚵仔（或按 Space）拿起來（小顆比較好撬，黑又粗的比較硬）',
  scoop: '撈蚵仔中…',
  seam: COARSE ? '按住 ◀ ▶ 或拖蚵仔來轉，找殼縫；縫對準刀尖時點一下蚵仔插刀（拖其他地方是看四周）' : '滾輪／A D 轉蚵仔找殼縫，縫對準刀尖時點一下（或 Space）插刀',
  twist: COARSE ? '看指針來回擺動，走到綠區時點一下螢幕撬一下；撬夠次數殼就打開。點在紅區太用力會把殼弄碎' : '看指針來回擺動，走到綠區時點一下滑鼠（或按 Space）撬一下；撬夠次數殼就打開。點在紅區太用力會把殼弄碎',
  aim: '肉在刀尖上！點一下碗（或碗附近）丟進去，0.8 秒內點有「俐落」+$1，2 秒沒點會自己進碗',
  empty: COARSE ? '空殼：按「丟殼」對準阿婆丟過去，或者等一下自動丟掉' : '空殼：F／右鍵對準阿婆丟過去，或者等一下自動丟掉',
  crab: COARSE ? '螃蟹夾手了！快狂點螢幕把牠甩掉！' : '螃蟹夾手了！快連點（滑鼠／Space）把牠甩掉！',
  busy: '',
};
const on = (id: string, v: boolean) => $(id).classList.toggle('on', v);
function setPhase(p: Phase) {
  if (p !== 'seam') { seamRing.visible = false; sweet = false; }
  phase = p; holding = false; hold = 0; fill.style.marginLeft = '0'; zone.style.left = ''; zone.style.width = ''; if (p === 'twist') { needleStart = performance.now(); combo = 0; pryHits = 0; } gauge.classList.remove('on', 'aim', 'tw'); setInZ('');
  tapAim = p === 'aim'; if (tapAim) tossT0 = performance.now(); bowlRing.visible = tapAim;
  if (p === 'aim' && !tapAim) gauge.classList.add('aim'); if (p === 'twist') gauge.classList.add('tw', 'on');
  on('reticle', (p === 'aim' && !tapAim) || p === 'empty' || p === 'pick' || (document.pointerLockElement === canvas && p !== 'busy')); on('giveUp', (p === 'seam' || p === 'twist') && state === 'play'); on('prog', p === 'twist' || p === 'crab');
  on('rotL', p === 'seam'); on('rotR', p === 'seam'); on('throwBtn', (p === 'seam' || p === 'empty') && state === 'play');
  if (p !== 'busy') hint.textContent = tapAim ? TAP_HINT : HINTS[p];
  const d = DIFF[diff];
  if (p === 'aim') { const TW = tut ? 0.12 : 0; zone.style.left = `${(PERF0 - TW) * 100}%`; zone.style.width = `${(PERF1 - PERF0 + 2 * TW) * 100}%`; $('diff').textContent = crackedNow ? '⚠ 有殼屑' : ''; }
  if (p === 'twist') { zone.style.left = `${d.lo * 100}%`; zone.style.width = `${(d.hi - d.lo) * 100}%`; progress = 0; strokeDir = 0; strokeLen = 0; strokePeak = 0; }
  if (p === 'seam' || p === 'twist') updDiff();
}
function updDiff() { const d = DIFF[diff], el = $('diff'); el.style.color = d.css; el.textContent = `難度：${d.n}${phase === 'twist' ? `・要撬 ${pryNeed()} 下` : ''}${crackedNow ? '・⚠ 有殼屑' : ''}`; }
function goPick() { if (state !== 'play' || walking) return; oyster.visible = false; setPhase('pick'); if (!basinOy.length) hint.textContent = '臉盆空了！轉頭看中間的蚵殼山，點一下撈一把'; }
function holdOyster(dd: number) {
  if (state !== 'play' || walking) return;
  if (saltNext && !tut) { saltNext = false; if (dd > 1) dd = Math.random() < 0.5 ? 0 : 1; toast('🧂 粗鹽搓過，這顆比較好開', '#cfc3ff'); drawMeds(); }
  diff = tut ? 0 : dd; const d = DIFF[diff];
  oyster.visible = true; oyster.rotation.set(0, 0, 0); rot = rnd(0, 6.28); crackedNow = false;
  seamA = rnd(0, 6.28); const r = 0.115; seamMark.position.set(Math.cos(seamA) * r, 0.012, Math.sin(seamA) * r); seamMark.rotation.y = -seamA + Math.PI / 2; seamGlow.position.copy(seamMark.position); seamGlow.rotation.copy(seamMark.rotation); seamRing.position.set(seamMark.position.x, 0.02, seamMark.position.z); sweet = false;
  seamMark.visible = seamGlow.visible = true;
  shellTop.visible = true; shellTop.position.set(0, 0.025, 0); shellTop.rotation.set(0, 0, 0); meatInHand.visible = true; meatInHand.material = meatMat; pearlMesh.visible = false; oddMeshes.forEach(m => m.visible = false);
  { const base = [0xc2c2be, 0xa0a09e, 0x7c7c7e, 0x58585c][diff]; shellTopMat.color.setHex(base); shellBotMat.color.setHex(base).multiplyScalar(0.85); const gi = Math.floor(Math.random() * 6); shellTop.geometry = HALF_GEOS[gi]; shellBot.geometry = HALF_GEOS[(gi + 3) % 6]; }
  barnacles.forEach((b, i) => b.visible = i < d.rough);
  meatsLeft = 1; showExtra();
  find = tut ? { kind: 'none', i: 0 } : rollFind(); setPhase('seam');
}
// 每次上工隨機換阿婆衣服顏色與花樣
const CLOTH = [0xc94f4f, 0x3f7cc9, 0x4fa36b, 0xd98c2b, 0x8a5bc2, 0xd65f9a, 0x2f9a9a, 0xb8863b, 0x5a6fb0, 0xe0c341];
function dressAma(n: Npc) {
  const pick = () => CLOTH[Math.floor(Math.random() * CLOTH.length)]; const base = pick(); let acc = pick(); if (acc === base) acc = 0xf4ecd8;
  const kind = Math.floor(Math.random() * 4), cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d')!;
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0'); x.fillStyle = hex(base); x.fillRect(0, 0, 64, 64); x.fillStyle = hex(acc);
  if (kind === 1) for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 64, 6);
  else if (kind === 2) for (let y = 4; y < 64; y += 16) for (let i = 4; i < 64; i += 16) { x.beginPath(); x.arc(i + (y % 32 ? 8 : 0), y, 3.5, 0, 7); x.fill(); }
  else if (kind === 3) for (let k = 0; k < 7; k++) { const cx = Math.random() * 64, cy = Math.random() * 64; for (let a = 0; a < 5; a++) { x.beginPath(); x.arc(cx + Math.cos(a * 1.26) * 4, cy + Math.sin(a * 1.26) * 4, 3, 0, 7); x.fill(); } x.fillStyle = '#ffe680'; x.beginPath(); x.arc(cx, cy, 2, 0, 7); x.fill(); x.fillStyle = hex(acc); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1); tex.colorSpace = THREE.SRGBColorSpace;
  const m = n.body.material as THREE.MeshStandardMaterial; m.map?.dispose(); m.map = tex; m.color.set(0xffffff); m.needsUpdate = true;
  for (const a of [n.armL, n.armR]) { const sl = a.children[0] as THREE.Mesh; (sl.material as THREE.MeshStandardMaterial).color.set(base); }
  const PANTS = [0x2a2a40, 0x3a3a3a, 0x4a3a2a, 0x223a5a, 0x5a4a6a, 0x2f4a3a]; (n.pants as THREE.MeshStandardMaterial).color.set(PANTS[Math.floor(Math.random() * PANTS.length)]);
}
let nightShift = false, walkHintShown = false, saltNext = false;
// 器具（手套、收音機）：買了可開關
const GEAR = [
  { id: 'glove', n: '🧤 棉紗手套', price: 120, good: '割到手的傷害減半', bad: '手套厚，指針速度 +5%' },
  { id: 'radio', n: '📻 收音機', price: 300, good: '阿婆氣消得快：怒氣增加 ×0.7（聽廣播心情好）', bad: '太吵：丟殼預警變晚（⚠ 和提示聲晚一半才出現）' },
  { id: 'glasses', n: '👓 老花眼鏡', price: 200, good: '蚵仔縫更亮更粗、光暈更大；插刀判定範圍 +25%', bad: '看遠有點霧：畫面邊緣微暗' }];
function drawRadio() { const b = document.getElementById('radioBtn'); if (!b) return; const show = state === 'play' && !tut && save.shop.owned.includes('radio'); b.style.display = show ? '' : 'none'; const on = gearOn('radio'); b.classList.toggle('off', !on); b.innerHTML = COARSE ? '<i class="ic ic-radio"></i><i class="led"></i>' : `<i class="ic ic-radio"></i> ${on ? '開' : '關'}<span class="key"> (V)</span>`; b.title = on ? '收音機：開' : '收音機：關'; }
function toggleRadio() { if (!save.shop.owned.includes('radio') || state !== 'play' || tut) return; save.gear = save.gear ?? {}; save.gear.radio = !gearOn('radio'); persist(); drawRadio(); toast(gearOn('radio') ? '📻 收音機打開：阿婆心情好，但聽不到丟殼預警' : '📻 收音機關掉：聽得到丟殼預警了', '#cfc3ff'); }
const gearOn = (id: string) => save.shop.owned.includes(id) && save.gear?.[id] !== false;
const isNight = () => { const h = new Date().getHours(); return h >= 20 || h < 5; };
// 天色跟著玩家裝置的時間（黎明／白天／黃昏／夜晚，平滑過渡）
const SKY: [number, number, number, number, number, number][] = [ // 時, 天空, 霧, 半球光, 強度, 太陽強度
  [0, 0x1c2440, 0x222a44, 0x8090c0, 0.62, 0.15], [5, 0x2a2c4e, 0x30304e, 0x9a90b8, 0.6, 0.25], [6.5, 0xd99a7a, 0xc89080, 0xffc0a0, 0.7, 0.55],
  [9, 0x8fc3e8, 0xa8c8dc, 0xe8f0ff, 0.85, 0.9], [16, 0x9cc6e6, 0xb0cadc, 0xf0f0ff, 0.85, 0.85], [18, 0x3a3050, 0x4a3a50, 0xc08a9a, 0.6, 0.5],
  [19.5, 0x24284a, 0x2a2c48, 0x8a90c0, 0.62, 0.2], [24, 0x1c2440, 0x222a44, 0x8090c0, 0.62, 0.15]];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function updSky() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60; let i = 0; while (SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], f = (h - a[0]) / (b[0] - a[0]);
  const L = (k: number) => _c1.setHex(a[k]).lerp(_c2.setHex(b[k]), f).getHex();
  try { showLand(); } catch { /* 尚未初始化 */ } const tn = locNow().tint; (scene.background as THREE.Color).setHex(L(1)); (scene.fog as THREE.Fog).color.setHex(L(2)); if (tn !== null) { _c2.setHex(tn); (scene.background as THREE.Color).lerp(_c2, 0.3); (scene.fog as THREE.Fog).color.lerp(_c2, 0.3); } hemi.color.setHex(L(3));
  hemi.intensity = a[4] + (b[4] - a[4]) * f; sun.intensity = a[5] + (b[5] - a[5]) * f;
  try { applyShedLook(); } catch { /* 尚未初始化 */ }
  const nn = document.getElementById('nightNote'); if (nn) nn.textContent = isNight() ? '🌙 現在是夜班時段：這一工收入 +20%' : '💡 晚上 8 點到早上 5 點上工是夜班，收入 +20%';
}

// ---------- 各漁港：遠景地標 + 不同的鄰座 ----------
const LAND: Record<string, THREE.Group> = {};
{
  const G = (id: string) => { const g = new THREE.Group(); g.visible = false; scene.add(g); LAND[id] = g; return g; };
  const B = (w: number, h: number, d: number, c: number, p: [number, number, number], g: THREE.Object3D, o: Record<string, unknown> = {}) => mesh(new THREE.BoxGeometry(w, h, d), mat(c, o), p, g);
  // 王功：紅白燈塔 + 防波堤
  const wg = G('wanggong');
  for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.55 - i * 0.05, 0.6 - i * 0.05, 1.2, 12), mat(i % 2 ? 0xf2f2ee : 0xc8302a), [-9, 0.1 + i * 1.2, -24], wg);
  mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 10), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }), [-9, 7.6, -24], wg);
  mesh(new THREE.ConeGeometry(0.5, 0.6, 10), mat(0x2a2a2a), [-9, 8.25, -24], wg);
  B(30, 0.6, 1.2, 0x8a8a84, [3, -0.2, -21], wg);
  for (let i = 0; i < 9; i++) B(0.8, 0.8, 0.8, 0x9a9a90, [-10 + i * 2.6, 0.3, -20.3], wg);
  // 東石：蚵棚 + 漁人碼頭木棧道與風車
  const ds = G('dongshi');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), mat(0x8a6a3a), [-12 + c * 1.6, 0, -18 - r * 2], ds);
  for (let r = 0; r < 4; r++) B(16, 0.06, 0.08, 0x6a5030, [-4.8, 0.65, -18 - r * 2], ds);
  B(12, 0.25, 2.5, 0x9a6a3a, [8, 0.2, -23], ds);
  mesh(new THREE.CylinderGeometry(0.15, 0.25, 5, 8), mat(0xf0ece0), [11, 2.5, -25], ds);
  const bl = new THREE.Group(); bl.position.set(11, 5, -24.7); ds.add(bl); for (let k = 0; k < 4; k++) { const b = B(0.25, 2.4, 0.05, 0xe8e0d0, [0, 1.2, 0], new THREE.Group()); const h = b.parent!; h.rotation.z = k * Math.PI / 2; bl.add(h); }
  // 布袋：鹽田方格 + 白鹽山 + 濕地蘆葦
  const bd = G('budai');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) B(3, 0.05, 2, (r + c) % 2 ? 0xc8d8e0 : 0xb0c8d4, [-12 + c * 3.4, -0.35, -17 - r * 2.4], bd, { roughness: 0.2, metalness: 0.2 });
  for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(1.2 + i * 0.2, 1.6 + i * 0.3, 10), mat(0xfafafa), [7 + i * 2.6, 0.5, -22 - (i % 2) * 2], bd);
  for (let i = 0; i < 40; i++) mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.2, 4), mat(0x8a9a4a), [-14 + Math.random() * 28, 0.2, -26 - Math.random() * 3], bd);
  // 自家：竹竿曬衣 + 小漁船
  const hm = G('home');
  B(3, 0.5, 1.2, 0x2a6aa0, [6, -0.25, -22], hm); B(1, 0.8, 0.8, 0xf0f0e8, [6.5, 0.4, -22], hm);
}
// ---------- 各地點的蚵寮本體（裝飾用，不影響座位／碗／蚵殼山／射線目標） ----------
type ShedStyle = { ground: number; hemi: number; hemiK: number; sun: number; sunK: number; lamp: number; lampK: number; fog: number; fogNear: number; fogFar: number };
const SHED_STYLE: Record<string, ShedStyle> = {
  home: { ground: 0x707070, hemi: 0xffe0c0, hemiK: 1.0, sun: 0xffb070, sunK: 1.1, lamp: 0xffc080, lampK: 22, fog: 0x8a7060, fogNear: 10, fogFar: 34 },
  wanggong: { ground: 0x8a8478, hemi: 0xd8ecff, hemiK: 1.25, sun: 0xf0f6ff, sunK: 1.4, lamp: 0xeaf4ff, lampK: 14, fog: 0x9ab8d0, fogNear: 12, fogFar: 40 },
  dongshi: { ground: 0x8a6440, hemi: 0xffc898, hemiK: 1.05, sun: 0xff8a40, sunK: 1.5, lamp: 0xffb060, lampK: 18, fog: 0xc8804a, fogNear: 10, fogFar: 36 },
  budai: { ground: 0x5a6266, hemi: 0xe4f0ff, hemiK: 1.35, sun: 0xd8e8ff, sunK: 0.6, lamp: 0xe8f4ff, lampK: 34, fog: 0x7a8a94, fogNear: 9, fogFar: 30 },
};
let shedG: THREE.Group | null = null, shedId = '';
const shedAnim: ((t: number) => void)[] = [];
function disposeShed() {
  if (!shedG) return;
  shedG.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as THREE.Material | THREE.Material[] | undefined; if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose()); });
  shedG.removeFromParent(); shedG = null; shedAnim.length = 0;
}
function buildShed(id: string) {
  disposeShed(); shedId = id; const g = new THREE.Group(); scene.add(g); shedG = g;
  const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => mat(c, o);
  const B = (w: number, h: number, d: number, m: THREE.Material, p: [number, number, number], ry = 0) => { const x = mesh(new THREE.BoxGeometry(w, h, d), m, p, g); x.rotation.y = ry; return x; };
  const C = (rt: number, rb: number, h: number, m: THREE.Material, p: [number, number, number], seg = 8) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, p, g);
  const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  const flat = (w: number, d: number, m: THREE.Material, p: [number, number, number]) => { const x = mesh(new THREE.PlaneGeometry(w, d), m, p, g); x.rotation.x = -Math.PI / 2; x.castShadow = false; x.receiveShadow = true; return x; };
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
    const nt = mesh(new THREE.PlaneGeometry(4.5, 1.6, 18, 7), netM, [-0.6, 2.0, -3.55], g); nt.castShadow = false;
    const buoyC = [0xf06a1a, 0xf0d030, 0xf06a1a, 0xe8e8e8, 0xf06a1a];
    for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(0.13, 10, 8), M(buoyC[i], { roughness: 0.4 }), [-2.6 + i * 1.0, 1.25 + (i % 2) * 0.12, -3.5], g);
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.16, 10, 8), M(0x6ab0e0, { transparent: true, opacity: 0.7, roughness: 0.1 }), [3.55, 2.3 - i * 0.35, 1.0 + i * 0.3], g); // 玻璃浮球
    // 盤起來的索仔
    const rope = M(0xd8b070);
    for (let k = 0; k < 4; k++) mesh(new THREE.TorusGeometry(0.34 - k * 0.04, 0.035, 5, 14), rope, [-3.0, 0.04 + k * 0.06, -1.6], g).rotation.x = Math.PI / 2;
    // 冰桶
    B(0.7, 0.45, 0.45, M(0x2a8ad0), [3.0, 0.23, 0.4], 0.3); B(0.72, 0.08, 0.47, M(0xf2f2f2), [3.0, 0.49, 0.4], 0.3);
  } else if (id === 'dongshi') {
    // 觀光木棧道地板
    const plankA = M(0xa06e40), plankB = M(0x8a5c34);
    for (let i = 0; i < 26; i++) { const p = B(13, 0.04, 0.48, i % 2 ? plankA : plankB, [0, 0.005, -6.3 + i * 0.5]); p.castShadow = false; p.receiveShadow = true; }
    // 竹蚵棚框 + 垂吊蚵串
    const bam = M(0xb8a060), oy = M(0x7a7a72, { roughness: 1 });
    for (const x of [-3.6, 3.6]) { for (const z of [-3.4, -1.2, 1.0, 3.2]) C(0.045, 0.05, 2.7, bam, [x, 1.35, z], 6); const r = C(0.04, 0.04, 7.0, bam, [x, 2.55, -0.1], 6); r.rotation.x = Math.PI / 2; }
    for (const z of [-3.4, 3.2]) { const r = C(0.04, 0.04, 7.2, bam, [0, 2.6, z], 6); r.rotation.z = Math.PI / 2; }
    for (const x of [-3.6, 3.6]) for (let k = 0; k < 9; k++) { const z = -3.1 + k * 0.75; C(0.006, 0.006, 1.1, M(0x5a4a3a), [x, 2.0, z], 3); for (let j = 0; j < 4; j++) mesh(new THREE.DodecahedronGeometry(0.06, 0), oy, [x, 1.6 + j * 0.22, z], g); }
    for (let k = 0; k < 7; k++) { const x = -2.7 + k * 0.9; C(0.006, 0.006, 0.9, M(0x5a4a3a), [x, 2.15, -3.4], 3); for (let j = 0; j < 3; j++) mesh(new THREE.DodecahedronGeometry(0.06, 0), oy, [x, 1.85 + j * 0.2, -3.4], g); }
    // 節慶燈串（垂墜弧線，彩色燈泡會閃）
    const cols = [0xff4a3a, 0xffd040, 0x40d0ff, 0x60ff80, 0xff80d0];
    const bulbs: THREE.MeshBasicMaterial[] = [];
    for (const [z0, z1] of [[-3.4, 3.2]] as const) for (const x of [-2.4, 0, 2.4]) for (let i = 0; i <= 12; i++) { const f = i / 12, z = z0 + (z1 - z0) * f, y = 2.75 - Math.sin(f * Math.PI) * 0.35; const m = glow(cols[(i + Math.round(x)) % 5]); bulbs.push(m); mesh(new THREE.SphereGeometry(0.045, 6, 5), m, [x, y, z], g).castShadow = false; }
    shedAnim.push(t => bulbs.forEach((m, i) => m.color.setHex(cols[(i + Math.floor(t * 2)) % 5])));
    // 招牌
    const sign = B(1.6, 0.6, 0.06, M(0xc83a2a), [2.2, 2.05, -3.5]); void sign;
    B(1.45, 0.45, 0.02, M(0xf4e4c0), [2.2, 2.05, -3.46]);
    for (let k = 0; k < 4; k++) B(0.22, 0.25, 0.01, M(0x2a2a2a), [1.75 + k * 0.3, 2.05, -3.44]);
    for (const x of [1.6, 2.8]) C(0.03, 0.03, 2.0, M(0x6a4a2a), [x, 1.0, -3.55], 6);
    // 海灘陽傘
    const umb = (x: number, z: number, a: number, b: number) => { C(0.025, 0.025, 2.3, M(0xeeeeee), [x, 1.15, z], 6); for (let k = 0; k < 8; k++) { const c = mesh(new THREE.ConeGeometry(0.95, 0.35, 8, 1, true, k * Math.PI / 4, Math.PI / 4), M(k % 2 ? a : b, { side: THREE.DoubleSide }), [x, 2.4, z], g); c.castShadow = false; } };
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
    const beltOy: THREE.Mesh[] = []; for (let k = 0; k < 6; k++) beltOy.push(mesh(new THREE.DodecahedronGeometry(0.07, 0), M(0x8a8a86), [-1.8 + k * 0.7, 0.82, -4.2], g));
    shedAnim.push(t => { ridges.forEach((r, k) => r.position.x = -1.9 + ((k * 0.4 + t * 0.3) % 4)); beltOy.forEach((r, k) => r.position.x = -1.9 + ((k * 0.7 + t * 0.3) % 3.9)); });
    // 黃色安全線
    const yel = M(0xf0c020, { roughness: 0.6 });
    for (const x of [-3.4, 3.4]) flat(0.12, 9, yel, [x, 0.012, 0]);
    flat(6.8, 0.12, yel, [0, 0.012, -3.5]); flat(6.8, 0.12, yel, [0, 0.012, 3.6]);
    for (let k = 0; k < 6; k++) { const s = flat(0.12, 0.6, k % 2 ? M(0x222222) : yel, [-1.5 + k * 0.6, 0.013, -4.9]); s.rotation.z = 0.6; }
    // 大蚵殼山 + 麻袋
    for (const [x, z, r] of [[-4.6, -4.0, 0.9], [4.7, -3.8, 1.0]] as const) mesh(new THREE.ConeGeometry(r, r * 1.1, 9), M(0x8a909a, { roughness: 1 }), [x, r * 0.55, z], g);
    const sack = M(0xc8b088, { roughness: 1 });
    for (let i = 0; i < 6; i++) { const s = mesh(new THREE.SphereGeometry(0.3, 8, 6), sack, [-5.3 + (i % 3) * 0.55, 0.25 + Math.floor(i / 3) * 0.4, 2.8], g); s.scale.set(1, 0.75, 0.8); }
    // 壁扇（扇葉會轉）
    for (const z of [-2, 2]) { const fg = new THREE.Group(); fg.position.set(5.85, 3.2, z); fg.rotation.y = -Math.PI / 2; g.add(fg); mesh(new THREE.TorusGeometry(0.35, 0.02, 4, 16), M(0xdddddd), [0, 0, 0.05], fg); const bl = new THREE.Group(); fg.add(bl); for (let k = 0; k < 3; k++) { const b = mesh(new THREE.BoxGeometry(0.1, 0.32, 0.01), M(0x8ac0e0), [0, 0.16, 0.05], new THREE.Group()); const h = b.parent!; h.rotation.z = k * 2.094; bl.add(h); } shedAnim.push(t => bl.rotation.z = t * 12); }
  } else {
    // 自家：鏽鐵皮厝頂 + 木柱
    const rust = [0x8a5a3a, 0x9a6a48, 0x7a6a5e];
    for (let i = 0; i < 12; i++) { const r = B(0.62, 0.03, 8, M(rust[i % 3], { side: THREE.DoubleSide, metalness: 0.35, roughness: 0.9 }), [-3.4 + i * 0.62, 3.05 + (i % 2) * 0.03, 0]); r.rotation.z = 0.06; }
    const wood = M(0x5a4a3a);
    for (const x of [-3.5, 3.5]) for (const z of [-3.5, 0, 3.5]) C(0.07, 0.07, 3.1, wood, [x, 1.55, z], 6);
    for (const z of [-3.5, 3.5]) B(7.2, 0.1, 0.1, wood, [0, 3.0, z]);
    // 水泥地水漬
    const stain = M(0x4e4c48, { roughness: 0.3, transparent: true, opacity: 0.55 });
    for (const [x, z, s] of [[-2.4, 0.6, 0.7], [2.2, -1.6, 0.9], [1.5, 2.9, 0.5], [-1.2, -2.6, 0.6]] as const) { const d = mesh(new THREE.CircleGeometry(s, 12), stain, [x, 0.008, z], g); d.rotation.x = -Math.PI / 2; d.scale.y = 0.6; d.castShadow = false; }
    // 吊著的裸燈泡
    for (const [x, z] of [[0, 0], [-2.2, -1.5], [2.2, 1.2]]) { mesh(new THREE.SphereGeometry(0.07, 10, 8), glow(0xffd9a0), [x, 2.55, z], g).castShadow = false; C(0.006, 0.006, 0.45, M(0x111111), [x, 2.8, z], 4); }
    // 紅色塑膠椅
    const red = M(0xd04040, { roughness: 0.5 });
    for (const [x, z] of [[3.0, 0.5], [-3.0, 0.2], [-2.6, -0.5]]) C(0.17, 0.15, 0.3, red, [x, 0.15, z]);
    // 藍色塑膠籃
    const bl = M(0x2a6ad0, { roughness: 0.5 });
    for (const [x, z, y] of [[-3.0, -2.9, 0.15], [-2.4, -2.9, 0.15], [-2.7, -2.9, 0.45], [2.9, -2.6, 0.15]] as const) { B(0.55, 0.3, 0.4, bl, [x, y, z]); }
    // 水桶、網仔、索仔
    for (const [x, z, c] of [[3.1, -1.9, 0xd07a2a], [-2.9, 2.6, 0x3a8a4a]] as const) C(0.2, 0.16, 0.4, M(c), [x, 0.2, z], 10);
    const net = mesh(new THREE.SphereGeometry(0.7, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2a7a6a, { wireframe: true }), [2.6, 0, 2.6], g); net.scale.y = 0.4;
    mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12), M(0xd8b070), [-3.0, 0.05, -1.8], g).rotation.x = Math.PI / 2;
    // 盆栽
    C(0.2, 0.15, 0.3, M(0xa0522d), [3.3, 0.15, 3.1]); for (let k = 0; k < 5; k++) { const l = mesh(new THREE.ConeGeometry(0.1, 0.55, 5), M(0x3a8a3a), [3.3 + Math.cos(k * 1.26) * 0.08, 0.5, 3.1 + Math.sin(k * 1.26) * 0.08], g); l.rotation.set(Math.sin(k * 1.26) * 0.4, 0, -Math.cos(k * 1.26) * 0.4); }
    // 側邊停的機車
    const sc = new THREE.Group(); sc.position.set(4.6, 0, -0.8); sc.rotation.y = 0.15; g.add(sc);
    const tire = M(0x1a1a1a);
    for (const z of [-0.55, 0.55]) mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 12), tire, [0, 0.27, z], sc).rotation.y = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.34, 0.35, 0.9), M(0xe8e4d8, { roughness: 0.4 }), [0, 0.48, 0.05], sc);
    mesh(new THREE.BoxGeometry(0.3, 0.1, 0.55), M(0x2a2a2a), [0, 0.7, 0.2], sc);
    mesh(new THREE.BoxGeometry(0.3, 0.7, 0.15), M(0xc83a3a, { roughness: 0.4 }), [0, 0.75, -0.5], sc);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), M(0x888888), [0, 1.15, -0.55], sc).rotation.x = Math.PI / 2 - 0.1;
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 5), M(0x333333), [0, 1.15, -0.55], sc).rotation.z = Math.PI / 2;
  }
}
function applyShedLook() {
  const id = locNow().id; if (id !== shedId) buildShed(id);
  const s = SHED_STYLE[id] ?? SHED_STYLE.home;
  (ground.material as THREE.MeshStandardMaterial).color.setHex(s.ground);
  hemi.color.lerp(_c2.setHex(s.hemi), 0.5); hemi.intensity *= s.hemiK;
  sun.color.setHex(s.sun); sun.intensity *= s.sunK;
  lamp.color.setHex(s.lamp); lamp.intensity = s.lampK;
  const f = scene.fog as THREE.Fog; f.color.lerp(_c2.setHex(s.fog), 0.45); f.near = s.fogNear; f.far = s.fogFar;
}

const WATER_C: Record<string, number> = { home: 0x3a4a6a, wanggong: 0x2a4a7a, dongshi: 0x4a5a5a, budai: 0x5a7a7a };
type Crew = { name: string; hair: number; look: 'ama' | 'agong' | 'dajie' | 'fisher' | 'ama2'; pal: number[] };
const CREW: Record<string, Crew[]> = {
  home: [{ name: '快手阿桃', hair: 0x999999, look: 'ama', pal: [] }, { name: '講話阿春', hair: 0x333333, look: 'ama', pal: [] }, { name: '好奇阿嬌', hair: 0xcccccc, look: 'ama', pal: [] }],
  wanggong: [{ name: '漁夫阿伯', hair: 0x555555, look: 'fisher', pal: [0x2a4a7a, 0x3a6a9a, 0xe8e0c8] }, { name: '燈塔阿公', hair: 0xdddddd, look: 'agong', pal: [0xe8e8e0, 0x6a7a8a, 0x8a5a3a] }, { name: '海口阿嬤', hair: 0xaaaaaa, look: 'ama2', pal: [0x4a6a9a, 0xc8d8e8, 0x2a5a7a] }],
  dongshi: [{ name: '碼頭大姐', hair: 0x2a1a10, look: 'dajie', pal: [0xe07a4a, 0xf0c050, 0xd04a6a] }, { name: '蚵棚阿伯', hair: 0x444444, look: 'fisher', pal: [0x6a5a3a, 0x8a7a4a, 0x4a4a3a] }, { name: '愛聊阿嬤', hair: 0xbbbbbb, look: 'ama2', pal: [0xc06a8a, 0xe0a0b0, 0x8a4a6a] }],
  budai: [{ name: '鹽田阿公', hair: 0xeeeeee, look: 'agong', pal: [0xf0f0f0, 0xc8c8c0, 0x6a6a5a] }, { name: '大廠組長大姐', hair: 0x1a1a1a, look: 'dajie', pal: [0x3a7a5a, 0x2a5a4a, 0xe8e8d8] }, { name: '老師傅阿伯', hair: 0x666666, look: 'fisher', pal: [0x4a4a5a, 0x5a5a6a, 0x7a6a4a] }],
};
const crewHats: THREE.Object3D[] = [];
function showLand() { const id = locNow().id; for (const k in LAND) LAND[k].visible = k === id; (water.material as THREE.MeshStandardMaterial).color.setHex(WATER_C[id] ?? 0x3a4a6a); }
function applyCrew() {
  const id = locNow().id, set = CREW[id] ?? CREW.home;
  showLand();
  crewHats.forEach(h => h.removeFromParent()); crewHats.length = 0;
  npcs.forEach((n, i) => {
    const c = set[i % set.length]; n.name = c.name; n.tag.textContent = c.name;
    const head = n.g.children.find(o => o instanceof THREE.Group && Math.abs(o.position.y - 1.02) < 0.01) as THREE.Group | undefined; if (!head) return;
    const hair = head.children[1] as THREE.Mesh, bun = head.children[2] as THREE.Mesh;
    (hair.material as THREE.MeshStandardMaterial).color.setHex(c.hair); (bun.material as THREE.MeshStandardMaterial).color.setHex(c.hair);
    bun.visible = c.look === 'ama' || c.look === 'ama2'; hair.scale.set(1, c.look === 'agong' ? 0.6 : 1, 1);
    let hat: THREE.Object3D | null = null;
    if (c.look === 'fisher') { hat = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), mat(c.pal[2] ?? 0xe8e0c8), [0, 0, 0], hat); mesh(new THREE.BoxGeometry(0.16, 0.015, 0.12), mat(c.pal[0]), [0, -0.035, 0.14], hat); hat.position.set(0, 0.12, 0); }
    else if (c.look === 'agong') { hat = mesh(new THREE.ConeGeometry(0.3, 0.14, 14), mat(0xd8c080), [0, 0.16, 0]); } // 斗笠
    else if (c.look === 'dajie') { hat = mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 16), mat(c.pal[1]), [0, 0.06, 0]); hat.rotation.x = Math.PI / 2; } // 髮箍
    else if (c.look === 'ama2') { hat = mesh(new THREE.SphereGeometry(0.165, 10, 6, 0, Math.PI * 2, 0, 1.2), mat(c.pal[1]), [0, 0.03, 0]); } // 頭巾
    if (hat) { head.add(hat); crewHats.push(hat); }
    if (c.pal.length) { const m = n.body.material as THREE.MeshStandardMaterial; const base = c.pal[Math.floor(Math.random() * 2)]; m.map?.dispose(); m.map = null; m.color.setHex(base); m.needsUpdate = true; for (const a of [n.armL, n.armR]) ((a.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(base); }
  });
}
updSky(); showLand(); applyCrew(); setInterval(updSky, 30000);
function startDay() { if (performance.now() < guardUntil) return; inputGuard();
  nightShift = isNight(); updSky(); $('nightTag').style.display = nightShift ? '' : 'none'; if (nightShift) later(1.5, () => toast('🌙 夜班上工！這一工收入 +20%', '#b8c8ff'));
  npcs.forEach(dressAma); applyCrew();
  if (walking) { walking = false; on('seatCard', false); on('joy', false); handRig.visible = true; stools.forEach(g => g.userData.tag.visible = false); tYaw = yaw = 0; tPitch = pitch = -0.85; }
  state = 'play'; handPain = false; for (const k in medT) delete medT[k]; drawMeds(); timeLeft = shiftLen; hp = 100; dayCombo = 0;
  statsSid = crypto.randomUUID?.() ?? statsId + '-' + Date.now(); if (!tut) track('start', { seat: save.seat ?? 'door', loc: locNow().id });
  const sidNow = statsSid; const pingT = setInterval(() => { if (tut || state !== 'play' || statsSid !== sidNow || document.hidden) { if (statsSid !== sidNow || state !== 'play') clearInterval(pingT); return; } track('ping'); }, 60_000);
  count = bowlBonus = cracked = opened = missed = abandoned = perfects = stabs = steals = caught = penalty = meatHits = shellHits = blocks = hitsTaken = reflects = wasteShells = thrown = lost = blockStreak = 0; dayPearls = []; dayOdd = []; meatPay = 0; dCnt = [0, 0, 0, 0]; dStat = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; endReason = 'time'; dayMulti2 = dayMulti3 = 0; meatsLeft = 1; showExtra();
  dayMaxGrudge = 0; npcs.forEach(n => { n.count = 0; n.mood = 0; n.angry = 0; n.distract = 0; n.windup = 0; n.grudge = 0; n.gAt = 0; n.calm = 0; n.clutch = 0; n.throwCd = rnd(15, 30); if (n.stuck) { n.stuck.removeFromParent(); n.stuck = null; } });
  [...bowlMeat, ...splats].forEach(m => scene.remove(m)); bowlMeat.length = 0; splats.length = 0;
  ['overlay', 'result', 'dex'].forEach(i => $(i).classList.remove('show')); on('umbBtn', true); on('medBtn', !tut); on('quitBtn', !tut); drawRadio(); applyGloves(); applySleeve(); drawMeds(); basinOy.forEach(m => scene.remove(m)); basinOy.length = 0; fillBasin(false); goPick(); if (!SHOT && !tut && !matchMedia('(pointer: coarse)').matches) canvas.requestPointerLock?.(); updHud();
}
function updHud() {
  ($('hpFill') as HTMLElement).style.width = `${hp}%`;
  const s = Math.max(0, Math.ceil(timeLeft)); $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('count').innerHTML = `<i class="ic ic-oyster"></i> ${count}`; $('pearls').innerHTML = `<i class="ic ic-pearl"></i> ${dayPearls.length + dayOdd.length}`;
  $('stats').textContent = `開 ${opened}・入碗 ${count}・浪費率 ${opened + wasteShells ? Math.round((missed + wasteShells) / (opened + wasteShells) * 100) : 0}%・殼屑 ${cracked}・偷 ${steals}/掠 ${caught}・割手 ${stabs}`;
}
function worldOf(o: THREE.Object3D) { return o.getWorldPosition(new THREE.Vector3()); }
function nagFrom(n: Npc, lines: string[], dur = 3) { let t = pick(lines); if (t === lastNag && lines.length > 1) t = lines[(lines.indexOf(t) + 1) % lines.length]; lastNag = t; n.look = dur; say(n, t, dur); }
// ----- 血 -----
const drops: { m: THREE.Mesh; v: THREE.Vector3 }[] = [], decals: { m: THREE.Mesh; t: number }[] = [];
const dropGeo = new THREE.SphereGeometry(0.005, 6, 4), dropMat = new THREE.MeshBasicMaterial({ color: 0xe0182a });
const decalGeo = new THREE.CircleGeometry(1, 10);
const wound = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), new THREE.MeshBasicMaterial({ color: 0xa00818, transparent: true })); wound.position.set(0.03, 0.06, -0.02); wound.rotation.set(-1.2, 0, 0.4); wound.visible = false; handL.add(wound);
let woundT = 0;
function emojiSprite(t: string, sz = 0.18) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 64, 70); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.setScalar(sz); return sp; }
function npcHurt(n: Npc, power = 1) {
  n.clutch = rnd(3, 5) * power; n.pause = Math.max(n.pause, n.clutch); n.windup = 0; SFX.aia(); later(0.15, () => tone(380, 0.6, 0.12, 'sawtooth', 0, 220)); say(n, pick(['哎唷喂啊！我的頭！', '要命喔！流血了啦！', '你這孩子！丟我的頭！']));
  if (n.bump) n.head.remove(n.bump);
  n.bump = mix.gore ? new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xd86a5a)) : emojiSprite('🩹', 0.14); n.bump.position.set(0.02, 0.12, 0.03); n.head.add(n.bump); n.bumpT = 20;
  if (!mix.gore) { const st = emojiSprite('💫', 0.22); st.position.set(0, 0.2, 0); n.head.add(st); later(2.5, () => n.head.remove(st)); return; }
  bleed(Math.round(18 * power), worldOf(n.head).add(new THREE.Vector3(0, 0.1, 0)), false);
}
function bleed(n: number, at?: THREE.Vector3, me = true) {
  if (!mix.gore) { if (me) { const b = $('aid') as HTMLElement; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } return; }
  const o = at ?? new THREE.Vector3(); if (!at) { handL.getWorldPosition(o); o.y += 0.05; }
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(dropGeo, dropMat); m.position.copy(o); m.scale.setScalar(rnd(0.6, 1.6)); scene.add(m); drops.push({ m, v: new THREE.Vector3(rnd(-0.8, 0.8), rnd(0.8, 2), rnd(-0.9, 0.2)) }); }
  if (me) { woundT = 8; wound.visible = true; }
}
function landY(p: THREE.Vector3) { if (Math.hypot(p.x - BOWL.x, p.z - BOWL.z) < BOWL_R + 0.03) return BOWL.y + 0.06; if (Math.hypot(p.x - BASIN.x, p.z - BASIN.z) < 0.3) return 0.15; if (Math.hypot(p.x, p.z) < 0.9) return 0.15 * (1 - Math.hypot(p.x, p.z) / 0.9) + 0.01; return 0.005; }
function updBlood(dt: number) {
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.v.y -= 9 * dt; d.m.position.addScaledVector(d.v, dt); const y = landY(d.m.position);
    if (d.m.position.y <= y) { scene.remove(d.m); drops.splice(i, 1); const c = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0xb01020, transparent: true, opacity: 0.85, depthWrite: false })); c.rotation.x = -Math.PI / 2; c.position.set(d.m.position.x, y + 0.003, d.m.position.z); c.scale.setScalar(rnd(0.015, 0.035)); scene.add(c); decals.push({ m: c, t: 14 }); } }
  for (let i = decals.length - 1; i >= 0; i--) { const d = decals[i]; d.t -= dt; (d.m.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, d.t / 5); if (d.t <= 0) { scene.remove(d.m); decals.splice(i, 1); } }
  if (woundT > 0) { woundT -= dt; (wound.material as THREE.MeshBasicMaterial).opacity = Math.min(1, woundT / 3); if (woundT <= 0) wound.visible = false; }
}
function hurt(dmg: number, txt: string) { react3('ouch'); if (tut) dmg = 0; dmg *= medM('dmg') * fxAll().dmg; hp = Math.max(0, hp - dmg); shake = 0.3; hurtT = 0.9; SFX.aia(); toast(txt, '#ff9a8a'); updHud(); if (hp <= 0 && state === 'play') { handPain = true; setPhase('busy'); later(0.8, endDay); } }

// ----- 0. 提蚵仔／撈蚵仔 -----
const ray = new THREE.Raycaster();
const pileHit = scene.children.find(o => (o as THREE.Mesh).geometry instanceof THREE.ConeGeometry && o.position.y > 0.2 && o.position.y < 0.3)!;
function makeBasinOyster(dd: number) {
  const m = new THREE.Mesh(SHELL_GEOS[Math.floor(Math.random() * 6)], shellM([0xc2c2be, 0xa0a09e, 0x7c7c7e, 0x58585c][dd])); m.scale.setScalar(DIFF[dd].scale * 0.95); m.userData.diff = dd; m.castShadow = true;
  for (let i = 0; i < DIFF[dd].rough; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.025, 5), mat(0x5a5448)); b.position.set(rnd(-0.08, 0.08), 0.04, rnd(-0.05, 0.05)); m.add(b); }
  return m;
}
function basinSlot(i: number) { const a = i * 2.4, r = 0.06 + (i % 4) * 0.05; return new THREE.Vector3(BASIN.x + Math.cos(a) * r, 0.14 + Math.floor(i / 6) * 0.04, BASIN.z + Math.sin(a) * r); }
function fillBasin(animate: boolean) {
  for (let i = 0; i < 8; i++) { const m = makeBasinOyster(wpick((newbie() ? [50, 50, 0, 0] : locW()).map(w => ({ w })))); const slot = basinSlot(i); m.rotation.set(rnd(-0.2, 0.2), rnd(0, 6), rnd(-0.2, 0.2)); basinOy.push(m);
    if (animate) { const p0 = pileSpot(); fly(m, p0, slot, 0.4 + i * 0.05, 0.4, () => m.position.copy(slot)); } else { m.position.copy(slot); scene.add(m); } }
}
function hitsOyster(cx: number, cy: number) { camera.updateMatrixWorld(); viewCam().updateMatrixWorld(); ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), viewCam()); return ray.intersectObject(oyster, true).length > 0; }
function pickAt(cx: number, cy: number) {
  if (phase !== 'pick' || state !== 'play') return;
  camera.updateMatrixWorld();
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), viewCam());
  const hit = ray.intersectObjects(basinOy, true)[0];
  if (hit) { let o: THREE.Object3D = hit.object; while (!basinOy.includes(o as THREE.Mesh)) o = o.parent!; grab(o as THREE.Mesh); return; }
  // 點著家己的手／手骨（或附近）：揀螢幕上上近的蚵仔
  let best: THREE.Mesh | null = null, bd = Math.max(110, innerWidth * 0.12);
  for (const m of basinOy) { const p = m.position.clone().project(viewCam()); if (p.z > 1) continue; const d = Math.hypot((p.x + 1) / 2 * innerWidth - cx, (1 - p.y) / 2 * innerHeight - cy); if (d < bd) { bd = d; best = m; } }
  if (best) { grab(best); return; }
  if (ray.intersectObject(pileHit, false).length || ray.intersectObject(pile, false).length) { scoop(); return; }
  hint.textContent = basinOy.length ? '點臉盆內的蚵仔' : '臉盆空了！點中間的蚵殼山撈一把';
}
function grab(m: THREE.Mesh) {
  basinOy.splice(basinOy.indexOf(m), 1); setPhase('busy'); reach = 0.35; tone(500, 0.05, 0.08, 'triangle'); noise(0.05, 1200, 0.2);
  fly(m, m.position.clone(), () => worldOf(oyster), 0.3, 0.05, () => { scene.remove(m); noise(0.04, 2500, 0.25); holdOyster(m.userData.diff); });
}
function scoop() { if (basinOy.length >= 8) return; setPhase('scoop'); scoopT = scoopDur = 1.5 * seatNow().scoop; noise(0.6, 900, 0.3); noise(0.6, 1600, 0.2); }
let reach = 0, scoopT = 0, scoopDur = 1.5;
// ----- 1. 找縫 -----
const scr = (o: THREE.Object3D) => { const p = worldOf(o).project(camera); return new THREE.Vector2(p.x * innerWidth, p.y * innerHeight); };
const knifeTip = knife.children[1] as THREE.Object3D;
function seamErr() { const c = scr(oyster), m = scr(seamMark).sub(c), k = scr(knifeTip).sub(c); let d = Math.atan2(m.y, m.x) - Math.atan2(k.y, k.x); d = Math.atan2(Math.sin(d), Math.cos(d)); return d; }
function tryInsert() {
  if (phase !== 'seam') return;
  const d = DIFF[diff];
  if (Math.abs(seamErr()) < tolNow()) { noise(0.06, 3000, 0.4); tone(320, 0.08, 0.2, 'triangle', 0, 200); toast('插進去了！', '#9be37a'); seamGlow.visible = false; seamRing.visible = false; sweet = false; setPhase('twist'); }
  else if (Math.random() < slipNow()) { stabs++; dStat[diff][1]++; dStat[diff][2]++; flinch = 0.6; nag(NAG_STAB); hint.textContent = '刀子滑掉，割到手了！'; setPhase('busy'); bleed(16); hurt((10 + diff * 5) * (gearOn('glove') ? 0.5 : 1), gearOn('glove') ? '哎呀！（有手套）' : '哎呀！'); if (hp > 0) later(0.7, () => setPhase('seam')); }
  else { dStat[diff][1]++; tone(140, 0.08, 0.2, 'square'); hint.textContent = '沒對準縫，刀子滑開了！再找找看'; if (Math.random() < 0.3) nag(NAG_SLIP); shake = 0.08; }
}
// ----- 2. 扭手腕 -----
function twistInput(dx: number, dtMs: number) { if (swipePhase()) return;
  if (Math.abs(dx) < 0.5) return;
  const dir = Math.sign(dx), speed = Math.abs(dx) / Math.max(1, dtMs) * 1000 / (innerWidth * 2.2);
  tension = Math.max(tension, Math.min(1.2, speed));
  if (phase === 'crab') { if (dir !== strokeDir && strokeLen > innerWidth * 0.04) { crabShakes++; SFX.creak(); if (crabShakes >= 6) crabOff(); } if (dir !== strokeDir) strokeLen = 0; strokeDir = dir; strokeLen += Math.abs(dx); return; }
  if (phase !== 'twist') return;
  if (dir !== strokeDir) { if (strokeDir !== 0 && strokeLen > innerWidth * 0.05) halfTwist(strokePeak); strokeDir = dir; strokeLen = 0; strokePeak = 0; }
  strokeLen += Math.abs(dx); strokePeak = Math.max(strokePeak, tension);
}
const PRY = [{ w: 0.3, sp: 0.8 }, { w: 0.22, sp: 1.05 }, { w: 0.2, sp: 1.35 }, { w: 0.135, sp: 1.7 }];
let pryHits = 0;
const PRY_NEED = [2, 3, 4, 5], PRY_C = 0.55, PRY_RED = 0.86;
let needleStart = 0, combo = 0, dayCombo = 0;
// ----- 剝殼刀（各有利弊） -----
type Knife = { id: string; n: string; price: number; green: number; speed: number; steps: number; stab: number; seam: number; luck: number; blade: number; desc: string };
const KNIVES: Knife[] = [
  { id: 'basic', luck: 1, n: '舊蚵刀', price: 0, green: 1, speed: 1, steps: 0, stab: 1, seam: 1, blade: 0xd0d0d8, desc: '媽媽留下來的，普普通通' },
  { id: 'dull', luck: 3, n: '便宜鈍刀', price: 20, green: 0.7, speed: 0.85, steps: 0, stab: 1.5, seam: 1, blade: 0x8a8a80, desc: '夜市 20 塊，指針較慢、運氣特別好，但綠區小、很常割到手' },
  { id: 'wide', luck: 0, n: '寬口刀', price: 150, green: 1.5, speed: 1.35, steps: 0, stab: 1, seam: 0.85, blade: 0xe8e0c8, desc: '刀面寬，綠區大，但指針快、比較難找縫' },
  { id: 'point', luck: 2, n: '尖口刀', price: 200, green: 0.9, speed: 1, steps: -1, stab: 1.6, seam: 1, blade: 0xb0c8e0, desc: '尖尖的一下就進去，少撬一下，運氣較好，但比較危險' },
  { id: 'seam', luck: 0, n: '找縫刀', price: 180, green: 0.9, speed: 1.1, steps: 0, stab: 0.8, seam: 1.6, blade: 0xc8e0b0, desc: '找縫很簡單，撬的時候比較費力' },
  { id: 'master', luck: 4, n: '師傅刀', price: 1200, green: 1.2, speed: 0.95, steps: -1, stab: 0.6, seam: 1.25, blade: 0xffe28a, desc: '老師傅手工，樣樣好，就是貴' },
];
type Umb = { id: string; n: string; price: number; open: number; dur: number; perf: number; cover: number; reflect: number; look: string; size: number; desc: string };
const UMBS: Umb[] = [
  { id: 'stripe', n: '紅白傘', price: 0, open: 0.05, dur: 4, perf: 0.28, cover: 0.95, reflect: 1, look: 'stripe', size: 1, desc: '工寮門口撿到的，各方面都普通好用' },
  { id: 'clear', n: '超商透明傘', price: 30, open: 0.05, dur: 3, perf: 0.2, cover: 0.85, reflect: 0.6, look: 'clear', size: 0.8, desc: '便宜又輕，但傘面小、反彈沒力，撐一下手就痠' },
  { id: 'fold', n: '自動摺疊傘', price: 160, open: 0, dur: 3, perf: 0.4, cover: 0.8, reflect: 1.2, look: 'navy', size: 0.7, desc: '一按就開，完美反彈時機最寬，但傘面小' },
  { id: 'beach', n: '海灘陽傘', price: 260, open: 0.25, dur: 8, perf: 0.15, cover: 1, reflect: 0.8, look: 'beach', size: 1.3, desc: '又大又能撐很久，但開傘比較慢、完美時機窄' },
  { id: 'temple', n: '廟會涼傘', price: 1500, open: 0.05, dur: 5, perf: 0.35, cover: 1, reflect: 1.6, look: 'temple', size: 1.05, desc: '神明的涼傘，反彈超有力，就是貴' },
];
const umbNow = () => UMBS.find(u => u.id === save.shop.equipped.umb) ?? UMBS[0];
function applyUmb() { const u = umbNow(); buildUmb(u.look, u.size); }
// ----- 盆仔（裝肉用） -----
type Bowl = { id: string; n: string; price: number; r: number; bounce: number; dist: number; perf: number; bonus: number; h: number; color: number; metal?: number; desc: string };
const BOWLS: Bowl[] = [
  { id: 'plastic', n: '塑膠臉盆', price: 0, r: 0.17, bounce: 0, dist: 1, perf: 0.10, bonus: 0, h: 0.14, color: 0x4a8ac0, desc: '藍色塑膠盆，普通' },
  { id: 'wide', n: '大臉盆', price: 120, r: 0.27, bounce: 0.3, dist: 1, perf: 0.10, bonus: 0, h: 0.06, color: 0xd04a3a, desc: '寬又淺的大紅盆，亮圈比較大，好認' },
  { id: 'bucket', n: '深桶', price: 180, r: 0.12, bounce: 0, dist: 1.1, perf: 0.08, bonus: 1, h: 0.34, color: 0x3a8a4a, desc: '深又窄，進去就跑不掉，肉比較鮮一顆加 $1' },
  { id: 'low', n: '矮盆', price: 150, r: 0.16, bounce: 0.1, dist: 0.7, perf: 0.16, bonus: 0, h: 0.08, color: 0xe0b030, desc: '放比較近、比較矮，順手好點' },
  { id: 'steel', n: '不銹鋼盆', price: 900, r: 0.21, bounce: 0.05, dist: 0.9, perf: 0.13, bonus: 1, h: 0.15, color: 0xd8dde4, metal: 0.9, desc: '專業級，樣樣好，就是貴' },
];
// ----- 位仔（換位） -----
type Seat = { id: string; n: string; a: number; r: number; scoop: number; bowl: number; perf: number; nag: number; throwM: number; steal: number; pro: string; con: string };
const SEATS: Seat[] = [
  { id: 'door', n: '門口位', a: 0, r: 2.0, scoop: 1, bowl: 1, perf: 0, nag: 1, throwM: 1, steal: 1, pro: '平衡，什麼都普通', con: '—' },
  { id: 'pile', n: '蚵山邊', a: 0.85, r: 1.75, scoop: 0.55, bowl: 1.2, perf: 0, nag: 1, throwM: 1.25, steal: 1, pro: '撈蚵仔快 45%', con: '丟過來的殼多 +25%' },
  { id: 'bowl', n: '碗邊位', a: -0.85, r: 2.0, scoop: 1.4, bowl: 0.7, perf: 0.04, nag: 1, throwM: 1, steal: 1, pro: '就坐在碗旁邊，順手', con: '撈蚵仔慢 40%' },
  { id: 'gossip', n: '阿春邊仔', a: 2.5, r: 1.95, scoop: 1, bowl: 1, perf: 0, nag: 2, throwM: 1.3, steal: 1.6, pro: '阿婆聊天比較久，好偷 +60%', con: '唸你 ×2、殼仔 +30%' },
  { id: 'corner', n: '角落', a: -0.35, r: 2.7, scoop: 1.5, bowl: 1.25, perf: 0, nag: 0.5, throwM: 0.5, steal: 1, pro: '殼比較少 -50%、比較少人唸 -50%', con: '撈蚵仔慢 50%' },
];
const seatNow = () => SEATS.find(x => x.id === save.seat) ?? SEATS[0];
const seatGround = (st: Seat) => new THREE.Vector3(-Math.sin(st.a) * st.r, 0, Math.cos(st.a) * st.r);
let seatYaw = 0;
const stools = SEATS.map(st => { const g = new THREE.Group(); const p = seatGround(st); g.position.copy(p);
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), mat(0x3a7ac0), [0, 0.4, 0], g); for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), mat(0x2a5a90), [x, 0.2, z], g);
  const tag = emojiSprite('🪑', 0.3); tag.position.y = 0.9; tag.visible = false; g.add(tag); g.userData.tag = tag; scene.add(g); return g; });
function applySeat(id: string) {
  const old = seatRig.matrixWorld.clone().invert(); save.seat = id; const st = seatNow();
  seatRig.rotation.y = -st.a; seatRig.position.copy(seatGround(st).multiplyScalar((st.r - 2) / st.r || 0)); seatRig.updateMatrixWorld(true); seatYaw = -st.a;
  const M = seatRig.matrixWorld.clone().multiply(old);
  [...basinOy, ...bowlMeat].forEach(m => m.position.applyMatrix4(M));
  SEAT.copy(seatRig.localToWorld(SEAT0.clone())); BASIN.copy(seatRig.localToWorld(BASIN0.clone())); applyBowl();
}
const bowlNow = () => BOWLS.find(b => b.id === save.shop.equipped.bowl) ?? BOWLS[0];
function applyBowl() {
  const b = bowlNow(), S = seatNow(); BOWL_R = b.r * (newbie() ? 1.2 : 1); const pw = (b.perf + S.perf) * (newbie() ? 1.4 : 1); PERF0 = IDEAL - pw / 2; PERF1 = IDEAL + pw / 2;
  BOWL_L.set(SEAT0.x + (BOWL0.x - SEAT0.x) * b.dist * S.bowl, BOWL0.y, SEAT0.z + (BOWL0.z - SEAT0.z) * b.dist * S.bowl); buildBowl(b);
  seatRig.updateMatrixWorld(true); const w = seatRig.localToWorld(BOWL_L.clone()); BOWL.x = w.x; BOWL.z = w.z;
}
const knifeNow = () => KNIVES.find(k => k.id === save.shop.equipped.knife) ?? KNIVES[0];
const pryW = () => Math.min(0.6, Math.min(1.6, 1 + 0.15 * pryHits) * PRY[diff].w * knifeNow().green * medM('green') * (newbie() ? 1.3 : 1));
const PRY_SLOW = 0.56; // 整體放慢（0.8→0.56，再慢 30%）
const prySp = () => PRY[diff].sp * PRY_SLOW * (gearOn('glove') ? 1.05 : 1) * knifeNow().speed * medM('speed') * fxAll().speed;
const pryNeed = () => Math.max(1, PRY_NEED[diff] + knifeNow().steps);
const tolNow = () => DIFF[diff].tol * knifeNow().seam * (gearOn('glasses') ? 1.25 : 1);
const slipNow = () => tut ? 0 : Math.min(0.9, DIFF[diff].slip * knifeNow().stab * medM('slip') * (newbie() ? 0.6 : 1));
function pctTxt(v: number, goodHigh: boolean) { if (v === 1) return '<span style="opacity:.6">—</span>'; const p = Math.round((v - 1) * 100), good = goodHigh ? p > 0 : p < 0; return `<b style="color:${good ? '#9be37a' : '#ff8a7a'}">${p > 0 ? '+' : ''}${p}%</b>`; }
function renderShop() {
  if (!save.shop.owned.includes('basic')) save.shop.owned.push('basic');
  const cur = knifeNow().id;
  $('shopList').innerHTML = `<p>錢：<b>$${save.money}</b></p><h3><i class="ic ic-knife"></i> 剝殼刀</h3><table class="kt"><tr><th>刀</th><th>綠區</th><th>指針速</th><th>撬幾下</th><th>割手率</th><th>找縫</th><th>幸運</th><th></th></tr>` + KNIVES.map(k => {
    const own = save.shop.owned.includes(k.id);
    const tr = save.trial?.id === k.id, btn = tr ? `${k.id === cur ? '<b>使用中</b><br>' : `<button data-eq="${k.id}">換</button><br>`}<button data-buy="${k.id}" ${save.money < k.price ? 'disabled' : ''}>買斷 $${k.price}</button>` : k.id === cur ? '<b>使用中</b>' : own ? `<button data-eq="${k.id}">換</button>` : `<button data-buy="${k.id}" ${save.money < k.price ? 'disabled' : ''}>$${k.price}</button>`;
    return `<tr><td><b>${k.n}</b>${save.trial?.id === k.id ? ` <span class="trialTag">試用剩 ${save.trial.left} 班</span>` : ''}<br><small>${k.desc}</small></td><td>${pctTxt(k.green, true)}</td><td>${pctTxt(k.speed, false)}</td><td>${k.steps ? `<b style="color:${k.steps < 0 ? '#9be37a' : '#ff8a7a'}">${k.steps > 0 ? '+' : ''}${k.steps}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${pctTxt(k.stab, false)}</td><td>${pctTxt(k.seam, true)}</td><td>${k.luck ? `<b style="color:#f2c440">${'🍀'.repeat(k.luck)}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!save.shop.owned.includes('stripe')) save.shop.owned.push('stripe');
  const cu = umbNow().id, B = UMBS[0];
  const rel = (v: number, b: number, goodHigh: boolean, unit: string) => { if (v === b) return `<span style="opacity:.6">${v}${unit}</span>`; const good = goodHigh ? v > b : v < b; return `<b style="color:${good ? '#9be37a' : '#ff8a7a'}">${v}${unit}</b>`; };
  $('shopList').innerHTML += `<h3><i class="ic ic-umb"></i> 雨傘</h3><table class="kt"><tr><th>傘</th><th>開傘</th><th>可撐</th><th>完美窗</th><th>遮擋</th><th>反彈力</th><th></th></tr>` + UMBS.map(u => {
    const own = save.shop.owned.includes(u.id);
    const btn = u.id === cu ? '<b>使用中</b>' : own ? `<button data-ueq="${u.id}">換</button>` : `<button data-ubuy="${u.id}" ${save.money < u.price ? 'disabled' : ''}>$${u.price}</button>`;
    return `<tr><td><b>${u.n}</b><br><small>${u.desc}</small></td><td>${rel(u.open, B.open, false, 's')}</td><td>${rel(u.dur, B.dur, true, 's')}</td><td>${rel(u.perf, B.perf, true, 's')}</td><td>${rel(Math.round(u.cover * 100), 95, true, '%')}</td><td>${rel(u.reflect, 1, true, '×')}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!save.shop.owned.includes('plastic')) save.shop.owned.push('plastic');
  const cb = bowlNow().id;
  $('shopList').innerHTML += `<h3><i class="ic ic-bowl"></i> 盆仔</h3><table class="kt"><tr><th>盆</th><th>加價</th><th></th></tr>` + BOWLS.map(b => {
    const own = save.shop.owned.includes(b.id);
    const btn = b.id === cb ? '<b>使用中</b>' : own ? `<button data-beq="${b.id}">換</button>` : `<button data-bbuy="${b.id}" ${save.money < b.price ? 'disabled' : ''}>$${b.price}</button>`;
    return `<tr><td><b>${b.n}</b><br><small>${b.desc}</small></td><td>${rel(b.bonus, 0, true, '$')}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  $('shopList').querySelectorAll('button[data-bbuy],button[data-beq]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const id = b.getAttribute('data-bbuy') || b.getAttribute('data-beq')!; const w = BOWLS.find(x => x.id === id)!;
    if (b.hasAttribute('data-bbuy')) { if (save.money < w.price) return; save.money -= w.price; save.shop.owned.push(id); track('buy', { item: id, price: w.price }); if (ac) SFX.jingle(); }
    if (bowlMeat.length) { bowlMeat.forEach(m => scene.remove(m)); bowlMeat.length = 0; }
    save.shop.equipped.bowl = id; persist(); applyBowl(); renderShop();
  });
  $('shopList').querySelectorAll('button[data-ubuy],button[data-ueq]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const id = b.getAttribute('data-ubuy') || b.getAttribute('data-ueq')!; const u = UMBS.find(x => x.id === id)!;
    if (b.hasAttribute('data-ubuy')) { if (save.money < u.price) return; save.money -= u.price; save.shop.owned.push(id); track('buy', { item: id, price: u.price }); if (ac) SFX.jingle(); }
    save.shop.equipped.umb = id; persist(); applyUmb(); renderShop();
  });
  $('shopList').querySelectorAll('button[data-buy],button[data-eq]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const id = b.getAttribute('data-buy') || b.getAttribute('data-eq')!; const k = KNIVES.find(x => x.id === id)!;
    if (b.hasAttribute('data-buy')) { if (save.money < k.price) return; save.money -= k.price; if (save.trial?.id === id) delete save.trial; else save.shop.owned.push(id); track('buy', { item: id, price: k.price }); if (ac) SFX.jingle(); }
    save.shop.equipped.knife = id; persist(); applyKnife(); renderShop();
  });
  $('shopList').insertAdjacentHTML('beforeend', '<h4 class="shH4"><i class="ic ic-gear"></i> 其他器具（買了可以開關）</h4><table class="kt">' + GEAR.map(g => { const own = save.shop.owned.includes(g.id), on = gearOn(g.id);
    return `<tr><td><b>${g.n}</b><br><small style="color:#9be37a">${g.good}</small><small style="color:#ff8a7a">${g.bad}</small></td><td>${own ? `<button data-gtog="${g.id}">${on ? '✅ 使用中' : '⬜ 沒用'}</button>` : `<button data-gbuy="${g.id}" ${save.money < g.price ? 'disabled' : ''}>$${g.price}</button>`}</td></tr>`; }).join('') + '</table>');
  $('shopList').querySelectorAll('button[data-gbuy],button[data-gtog]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const id = b.getAttribute('data-gbuy') || b.getAttribute('data-gtog')!; const g = GEAR.find(x => x.id === id)!; save.gear = save.gear ?? {};
    if (b.hasAttribute('data-gbuy')) { if (save.money < g.price) return; save.money -= g.price; save.shop.owned.push(id); save.gear[id] = true; track('buy', { item: id, price: g.price }); if (ac) SFX.jingle(); }
    else save.gear[id] = !gearOn(id);
    persist(); renderShop(); drawRadio(); applyGloves();
  });
  renderClothShop(); renderMedShop(); shopTabs();
}
function applyKnife() { ((knife.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(knifeNow().blade); const k = knifeNow(); (knife.children[1] as THREE.Mesh).scale.set(k.id === 'point' ? 1.2 : 1, 1, k.id === 'wide' ? 1.7 : k.id === 'point' ? 0.6 : 1); }
const PRY_GRACE = 0.04;
// 視覺佮判定攏用同一个時間公式（事件 timeStamp），毋免等下一格
const needle = (ms = performance.now()) => 0.5 - 0.5 * Math.cos(((ms - needleStart) / 1000) * Math.PI * 2 * prySp());
(window as any).__sim = () => ({ t: SHIFT - timeLeft, c: npcs.map(n => n.count), names: npcs.map(n => n.name) });
(window as any).__pryReset = (d = 2) => { diff = d; progress = 0; crackedNow = false; setPhase('twist'); };
(window as any).__pry = () => { if (phase !== 'twist') return null; const f = prySp(), per = 1000 / f, th = Math.acos(1 - 2 * PRY_C) / (Math.PI * 2) * per; const el = (performance.now() - needleStart) % per; let w = th - el; if (w < 5) w += per / 2 > th ? per - 2 * th + th * 2 - th : per; return { wait: ((th - el) % per + per) % per, phase, progress }; };
function pryFx(ok: boolean, txt: string) { gauge.classList.remove('hit', 'miss'); void gauge.offsetWidth; gauge.classList.add(ok ? 'hit' : 'miss'); const pp = $('ppop'); pp.textContent = txt; pp.className = ''; void pp.offsetWidth; pp.className = ok ? 'ok' : 'bad'; }
function pry(ms = performance.now()) {
  if (phase === 'crab') { crabShakes++; tone(600 + crabShakes * 40, 0.05, 0.1); strokeDir = -strokeDir || 1; flinch = 0.3; if (crabShakes >= 8) crabOff(); return; }
  if (phase !== 'twist') return;
  const n = needle(ms), w = pryW() + PRY_GRACE * 2; (window as any).__pryLog = ((window as any).__pryLog || []).concat([[+n.toFixed(3), Math.abs(n - PRY_C) <= w / 2]]); strokeDir = -strokeDir || 1; tension = 0.9;
  const need = pryNeed();
  if (n > PRY_RED) { combo = 0; progress += 1 / need; SFX.creak(); pryFx(false, '碎！'); if (!crackedNow) { crackedNow = true; dStat[diff][3]++; noise(0.1, 4000, 0.5); noise(0.25, 6000, 0.3); shake = 0.15; toast('太大力，殼碎掉了！', '#ffa860'); meatInHand.material = splatMat; nag(NAG_CRACK); updDiff(); } }
  else if (Math.abs(n - PRY_C) <= w / 2) { progress += 1 / need; pryHits++; if (Math.sin(((ms - needleStart) / 1000) * Math.PI * 2 * prySp()) > 0) needleStart = ms; combo++; if (combo > dayCombo) dayCombo = combo; if (combo > save.life.bestCombo) { save.life.bestCombo = combo; persist(); } SFX.creak(); tone(1500, 0.04, 0.12, 'square'); tone(2200, 0.05, 0.08, 'triangle', 0.03); shake = 0.05; const k = Math.round(progress * need); pryFx(true, `✓ ${k}/${need}${combo >= 2 ? `　連擊 x${combo}` : ''}`); hint.textContent = combo >= 3 ? '讚！功夫真好！' : '好！再一下'; }
  else { if (!(Math.random() < fxAll().keep)) combo = 0; tone(140, 0.12, 0.12, 'triangle'); noise(0.06, 300, 0.2); pryFx(false, '✗ 沒中'); hint.textContent = '時機不對，等指針走到綠區再點'; tension = 0.3; return; }
  shellTop.rotation.z = -progress * 0.4;
  if (progress >= 0.999) openOyster();
}
function halfTwist(peak: number) {
  const d = DIFF[diff];
  if (peak < d.lo) { hint.textContent = '力氣不夠，再用力一點！'; return; }
  progress += 1 / d.need; SFX.creak();
  if (peak > d.hi && !crackedNow) { crackedNow = true; dStat[diff][3]++; noise(0.1, 4000, 0.5); noise(0.25, 6000, 0.3); shake = 0.15; toast('殼碎掉了！', '#ffa860'); meatInHand.material = splatMat; nag(NAG_CRACK); updDiff(); }
  else hint.textContent = HINTS.twist;
  shellTop.rotation.z = -progress * 0.4;
  if (progress >= 0.999) openOyster();
}
function keyTwist(k: string) { if (swipePhase()) return;
  const now = performance.now(), dt = now - lastKeyT; lastKeyT = now;
  if (k === lastKey) return; lastKey = k;
  const t = Math.min(1.2, 220 / Math.max(80, dt)); tension = Math.max(tension, t);
  if (phase === 'crab') { crabShakes++; tone(600 + crabShakes * 40, 0.05, 0.1); if (crabShakes >= 6) crabOff(); return; }
  if (phase === 'twist' && dt < 1500) halfTwist(t); else if (phase === 'twist') hint.textContent = '再快一點！';
}
let meatsLeft = 1, dayMulti2 = 0, dayMulti3 = 0; const extraMeat: THREE.Object3D[] = [];
function showExtra() {
  if (!extraMeat.length && meatInHand.parent) for (let k = 0; k < 2; k++) { const e = meatInHand.clone(); e.position.x += (k ? -1 : 1) * 0.028; e.position.z += 0.012; e.scale.multiplyScalar(0.85); meatInHand.parent.add(e); extraMeat.push(e); }
  extraMeat.forEach((e, k) => e.visible = k < meatsLeft - 1);
}
function openOyster() {
  { const l = luckNow(), r = Math.random(); meatsLeft = tut ? 1 : r < 0.02 + 0.0025 * l ? 3 : r < 0.10 + 0.0075 * l ? 2 : 1; showExtra();
    if (meatsLeft > 1) { if (meatsLeft === 3) dayMulti3++; else dayMulti2++; later(0.3, () => { toast(meatsLeft === 3 ? '三仁！一顆有三塊肉！' : '雙仁！一顆有兩塊肉！', '#ffd76a'); tone(880, 0.12, 0.15, 'triangle'); tone(1320, 0.18, 0.12, 'triangle', 0.1); if (meatsLeft === 3) tone(1760, 0.22, 0.12, 'triangle', 0.2); }); } }
  crackSound(); shake = 0.25; opened++; dStat[diff][0]++; setPhase('busy'); seamMark.visible = false;
  if (crackedNow) cracked++;
  shellTop.visible = false;
  const top = new THREE.Mesh(halfGeo, shellTopMat); fly(top, worldOf(oyster), pileSpot(), 0.6, 0.5, () => scene.remove(top));
  if (find.kind === 'pearl') { revealPearl(find.i); later(2.5, () => { pearlMesh.visible = false; setPhase('aim'); }); }
  else if (find.kind === 'odd') revealOdd(find.i);
  else later(0.2, () => setPhase('aim'));
  updHud();
}
function revealOdd(i: number) { react3('cheer');
  const o = ODD[i]; dayOdd.push(i); save.odd[i]++; persist(); Social.report(rarOf(o.w) === 'legend' ? 'legend' : 'odd', i); track('find', { kind: 'odd', item: 'odd-' + i, rarity: rarOf(o.w), seat: save.seat ?? 'door', knife: knifeNow().id, luck: luckNow(), dex: dexN() }); oddMeshes[i].visible = true;
  slowmo = 1.8; pearlShow = 2.2; SFX.jingle(i !== 3);
  label.innerHTML = `${o.name}！<small>${o.line}</small><small>${save.odd[i] === 1 ? '🆕 第一次找到！' : `你的第 ${save.odd[i]} 個`}</small>`; label.style.color = o.css; label.classList.add('on');
  npcs.forEach((n, k) => { n.look = 2.4; say(n, o.cry[k % o.cry.length], 2.4); });
  if (i === 3) { later(0.6, () => { flinch = 1; SFX.pinch(); bleed(8); hurt(4, '夾！'); crabShakes = 0; strokeDir = 0; strokeLen = 0; setPhase('crab'); }); }
  else later(2.2, () => { oddMeshes[i].visible = false; setPhase('aim'); });
}
function crabOff() {
  const c = oddMeshes[3]; c.visible = false; const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xd04a2a)); m.scale.y = 0.5;
  fly(m, worldOf(oyster), new THREE.Vector3(rnd(-1, 1), 0.02, rnd(0.3, 1.5)), 0.6, 0.4, () => { later(3, () => scene.remove(m)); });
  toast('甩掉了！', '#9be37a'); setPhase('busy'); later(0.4, () => setPhase('aim'));
}
// ----- 3. 點碗丟肉 -----
function aimPoint() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const t = dir.y < -0.05 ? (BOWL.y - camera.position.y) / dir.y : 6;
  const p = camera.position.clone().addScaledVector(dir, t);
  const off = p.sub(camera.position).setY(0); if (off.length() > 3) off.setLength(3);
  return camera.position.clone().add(off).setY(BOWL.y);
}
const bowlRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0xf2b705, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
bowlRing.rotation.x = -Math.PI / 2; bowlRing.visible = false; scene.add(bowlRing);
const fx: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
const fxGeo = new THREE.SphereGeometry(0.012, 5, 4);
function burst(at: THREE.Vector3, n: number, color: number, up: number) {
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color, transparent: true })); m.position.copy(at); scene.add(m); const a = Math.random() * 6.28, r = rnd(0.2, 0.6); fx.push({ m, v: new THREE.Vector3(Math.cos(a) * r, rnd(0.6, 1) * up, Math.sin(a) * r), t: 0.6 }); }
}
function tickFx(dt: number) {
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t -= dt; f.v.y -= 4 * dt; f.m.position.addScaledVector(f.v, dt); (f.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.t / 0.6); if (f.t <= 0) { scene.remove(f.m); fx.splice(i, 1); } }
  if (bowlRing.visible) { const k = 1 + 0.12 * Math.sin(performance.now() / 120); bowlRing.position.set(BOWL.x, BOWL.y + 0.02, BOWL.z); bowlRing.scale.setScalar(BOWL_R * k); }
}
function nearBowl(x: number, y: number) {
  const p = BOWL.clone().project(viewCam()); if (p.z > 1) return false;
  const bx = (p.x + 1) / 2 * innerWidth, by = (1 - p.y) / 2 * innerHeight;
  return Math.hypot(bx - x, by - y) < Math.max(150, Math.min(innerWidth, innerHeight) * 0.28);
}
function toss(tapped: boolean) {
  if (phase !== 'aim' || !tapAim || state !== 'play') return;
  const el = (performance.now() - tossT0) / 1000, quick = tapped && el <= 0.8;
  setPhase('busy'); meatInHand.visible = false;
  const wasCracked = crackedNow, md = diff;
  const from = worldOf(oyster), m = new THREE.Mesh(meatGeo, wasCracked ? splatMat : meatMat);
  const land = new THREE.Vector3(BOWL.x + rnd(-0.06, 0.06), BOWL.y - 0.04 + Math.min(bowlMeat.length, 40) * 0.0015, BOWL.z + rnd(-0.06, 0.06));
  SFX.whoosh(); if (quick) { perfects++; $('gtag').textContent = ''; }
  fly(m, from, land, 0.45, 0.3, () => {
    count++; bowlBonus += bowlNow().bonus + fxAll().bowl; const pv = Math.max(wasCracked ? 1 : 0, (wasCracked ? Math.max(1, Math.round(DPAY[md] * 0.25)) : DPAY[md]) - (shiftLen < SHIFT ? TEMP_CUT : 0)) + (quick ? 1 : 0); meatPay += pv; dCnt[md]++; bowlMeat.push(m); if (bowlMeat.length > 60) scene.remove(bowlMeat.shift()!);
    burst(land.clone().setY(BOWL.y + 0.02), 8, 0xbfe4f2, 1);
    if (!wasCracked) burst(land.clone().setY(BOWL.y + 0.05), 6, 0xffd23a, 1.4);
    if (quick) { tone(980, 0.06, 0.18, 'triangle', 0, 520); tone(1568, 0.08, 0.1, 'sine', 0.05); } else SFX.plop();
    toast(`${quick ? '俐落！' : wasCracked ? '入碗（有殼屑）' : '入碗！'} +$${pv} ${DIFF[md].n}`, quick ? '#f2b705' : DIFF[md].css); if (Math.random() < 0.15) say(pick(npcs), pick(PRAISE), 2);
    updHud();
  });
  later(0.35, () => { if (meatsLeft > 1 && state === 'play') { meatsLeft--; showExtra(); meatInHand.visible = true; meatInHand.material = meatMat; setPhase('aim'); hint.textContent = `還有 ${meatsLeft} 塊肉！點碗繼續丟`; } else { meatsLeft = 1; showExtra(); emptyT = 2.2; setPhase('empty'); } });
}
function discardShell() { if (phase !== 'empty') return; oyster.visible = false; const sh = new THREE.Mesh(halfGeo, shellBotMat); fly(sh, worldOf(oyster), pileSpot(), 0.6, 0.5, () => scene.remove(sh)); setPhase('busy'); later(0.5, goPick); }
function meatOnHead(n: Npc, m: THREE.Mesh) {
  meatHits++; addGrudge(n, 25); if (n.stuck) n.stuck.removeFromParent(); m.removeFromParent(); m.position.set(0, 0.15, 0); m.scale.setScalar(1.6); n.head.add(m); n.stuck = m;
  later(8, () => { if (n.stuck === m) { m.removeFromParent(); n.stuck = null; } });
  toast(`丟中${n.name}的頭！`, '#ffb070'); SFX.splat();
  anger(n, SCOLD_HIT, 0.85); updHud();
}
function anger(n: Npc, lines: string[], retaliate: number) {
  n.angry = 2.5; n.mood = Math.max(n.mood, 35); nagFrom(n, lines, 3); tone(220, 0.3, 0.2, 'square');
  if (Math.random() < retaliate) later(0.6, () => windUp(n));
}
const stunned = (n: Npc) => (n.clutch ?? 0) > 0;
const freeToSteal = (n: Npc) => n.distract > 0 || stunned(n);
let dayMaxGrudge = 0;
function addGrudge(n: Npc, v: number) { if (v > 0) v *= medM('grudge') * locNow().ang * (gearOn('radio') ? 0.7 : 1); const g0 = n.grudge ?? 0; n.grudge = Math.max(0, Math.min(100, g0 + v)); if (v > 0) { n.gAt = performance.now(); if (g0 < 60 && n.grudge >= 60 && state === 'play') toast(`${n.name}很生氣！會更常丟你（一陣子不惹她就會消氣）`, '#ff7a6a'); } dayMaxGrudge = Math.max(dayMaxGrudge, n.grudge); }
function grudgeUI(n: Npc) {
  if (!n.gIcon) { n.gIcon = emojiSprite('💢', 0.12); n.gIcon.position.set(-0.1, 0.32, 0); n.head.add(n.gIcon); const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3b2f, depthTest: false })); bar.center.set(0, 0.5); bar.position.set(-0.03, 0.32, 0); n.head.add(bar); n.gBar = bar; }
  const g = n.grudge ?? 0; n.gIcon.visible = n.gBar!.visible = g > 4; n.gIcon.scale.setScalar(0.12 + g * 0.0015); n.gBar!.scale.set(0.006 + g * 0.0032, 0.035, 1);
  (n.gBar!.material as THREE.SpriteMaterial).color.setHSL(0.12 - g * 0.0012, 1, 0.5);
}
// ----- 6. 擲殼仔 -----
function throwShell() {
  if (state !== 'play' || (phase !== 'empty' && phase !== 'seam')) return;
  thrown++; if (phase === 'seam') { abandoned++; wasteShells++; }
  const from = worldOf(oyster); oyster.visible = false;
  let target: Npc | undefined;
  for (const n of npcs) { const p = worldOf(n.head).project(camera); if (p.z < 1 && Math.abs(p.x) < 0.25 && Math.abs(p.y) < 0.45) target = n; }
  const sh = new THREE.Mesh(halfGeo, shellBotMat); SFX.whoosh();
  if (target) { const t = target; fly(sh, from, () => worldOf(t.head), 0.5, 0.3, () => { scene.remove(sh); shellHits++; SFX.hitNpc(); toast(`丟中${t.name}！`, '#ffb070'); anger(t, SCOLD_SHELL, 0.6); addGrudge(t, 35); npcHurt(t); updHud(); }); }
  else { let stray: Npc | undefined; for (const n of npcs) { const p = worldOf(n.head).project(camera); if (p.z < 1 && Math.abs(p.x) < 0.7 && Math.abs(p.y) < 0.8 && Math.random() < 0.4) stray = n; }
    if (stray) { const t = stray; fly(sh, from, () => worldOf(t.head), 0.55, 0.35, () => { scene.remove(sh); shellHits++; SFX.hitNpc(); toast(`丟歪打中${t.name}！`, '#ffb070'); anger(t, SCOLD_SHELL, 0.6); addGrudge(t, 30); npcHurt(t); updHud(); }); }
    else { const a = aimPoint(); a.y = 0.02; fly(sh, from, a, 0.6, 0.5, () => later(2, () => scene.remove(sh))); } }
  setPhase('busy'); later(0.6, goPick);
}
// ----- 7. 阿婆擲殼仔 + 雨傘 -----
function windUp(n: Npc) { if (n.windup > 0 || state !== 'play' || stunned(n)) return; n.windup = Math.max(0.45, 1.0 - (n.grudge ?? 0) * 0.005); n.w0 = n.windup; n.warned = !gearOn('radio'); n.look = 1.6; if (n.warned) SFX.alert(); }
// 收音機開著：預警變晚（剩一半時間才出現，至少 0.5 秒）
const warnLead = (n: Npc) => Math.min(n.w0 ?? n.windup, Math.max(0.5, (n.w0 ?? n.windup) * 0.5));
function npcThrow(n: Npc) {
  if (stunned(n)) return;
  const shots = (n.grudge ?? 0) >= 90 ? 3 : 1;
  if (shots > 1) { addGrudge(n, -35); say(n, '看我連環殼！', 2); }
  for (let i = 0; i < shots; i++) later(i * 0.4, () => throwOne(n));
}
function throwOne(n: Npc) {
  if (state !== 'play') return;
  const sh = new THREE.Mesh(pick(HALF_GEOS), shellM(greyPick())); const from = worldOf(n.head); SFX.whoosh();
  fly(sh, from, () => camera.position.clone().add(new THREE.Vector3(0, -0.05, 0)), 0.55, 0.4, () => {
    const U = umbNow(), up = umbT > 0 && umbAge() >= U.open, covered = up && Math.random() < U.cover;
    if (up && !covered) toast('傘傷細，殼仔對邊仔鑽入來！', '#ff9a8a');
    if (covered && umbAge() - U.open < U.perf) { // 拄開好的時陣 = 完美反彈
      reflects++; blockStreak++; umbHit3(sh.position); SFX.boing(); tone(1800, 0.08, 0.15, 'square'); toast('完美反彈！✨', '#ffe36a'); shake = 0.08;
      fly(sh, sh.position.clone(), () => worldOf(n.head), 0.4, 0.15, () => { scene.remove(sh); SFX.hitNpc(); addGrudge(n, Math.round(20 * U.reflect)); npcHurt(n, U.reflect); });
    } else if (covered) { umbHit3(sh.position); scene.remove(sh); blocks++; blockStreak++; SFX.boing(); toast('擋住了！啵嗯～', '#9be37a'); say(n, pick(['怎麼會有雨傘啦！', '狡怪喔你！', '什麼時候拿出來的！']), 2.5); }
    else { scene.remove(sh); blockStreak = 0; hitsTaken++; ($('splat') as HTMLElement).style.opacity = '1'; later(0.9, () => ($('splat') as HTMLElement).style.opacity = '0'); hurt(8, '哎唷！被丟中了！'); hitInHand(); }
    if (blockStreak >= 3) { blockStreak = 0; npcs.forEach((m, i) => { m.calm = 45; if (i === 0) later(0.8, () => say(m, `這個${myName()}真勇敢……`, 3)); }); toast('阿婆們怕你了，暫時比較少丟', '#9fe0ff'); }
    updHud();
  });
}
function hitInHand() {
  if (phase === 'twist' || phase === 'seam') {
    if (Math.random() < 0.5) { lost++; abandoned++; const sh = new THREE.Mesh(shellGeo, shellTopMat); oyster.visible = false; const a = worldOf(oyster); fly(sh, a, a.clone().setY(0.02).add(new THREE.Vector3(rnd(-0.3, 0.3), 0, -0.3)), 0.5, 0.2, () => later(3, () => scene.remove(sh))); toast('蚵仔掉到地上了！', '#ff9a8a'); progress = 0; shellTop.rotation.z = 0; setPhase('busy'); later(0.8, goPick); }
    else if (phase === 'twist') { progress = 0; shellTop.rotation.z = 0; combo = 0; toast('撬到一半，殼又合回去了…', '#ff9a8a'); }
  }
}
let umbHeld = false, umbTired = false;
// 按住開傘、放開就收；沒有冷卻。撐太久（超過該傘的「可撐」秒數）手會痠自動收起，要放開再按。
function openUmbrella() { if (state !== 'play' || umbHeld || umbTired) return; const u = umbNow(); umbHeld = true; umbT = umbLen = u.open + u.dur; umb.visible = true; SFX.pop(); $('umbBtn').classList.add('held'); }
function closeUmbrella() { umbTired = false; if (!umbHeld && umbT <= 0) return; umbHeld = false; umbT = 0; $('umbBtn').classList.remove('held'); }
let umbLen = 0.9;
const umbAge = () => umbLen - umbT;
// ----- 4. 偷蚵仔 -----
function stealTarget() { for (const n of npcs) { const p = n.bowl.clone().project(camera); if (p.z < 1 && Math.abs(p.x) < 0.3 && Math.abs(p.y) < 0.35) return n; } return null; }
function startSteal() { if (state !== 'play' || umbHeld) return; const n = stealTarget(); if (!n) return; stealNpc = n; stealT = 0; SFX.sneak(); if (!freeToSteal(n)) caughtBy(n); }
function stopSteal() { stealNpc = null; stealT = 0; on('prog', phase === 'twist' || phase === 'crab' || phase === 'scoop'); }
function caughtBy(n: Npc) {
  caught++; stopSteal(); penalty += 5;
  n.distract = 0; n.pause = 0; addGrudge(n, 20); anger(n, SCOLD_STEAL, 0.5); toast('被抓到了！罰 $5', '#ff8a7a'); shake = 0.2; SFX.sting(); updHud();
}
function stealOne(n: Npc) {
  if (n.count <= 0) { toast('碗裡沒肉了'); stopSteal(); return; }
  n.count--; count++; meatPay += DPAY[1]; steals++; addGrudge(n, 12); const m = new THREE.Mesh(meatGeo, meatMat);
  const lm = n.bowlMeat.pop(); if (lm) scene.remove(lm);
  fly(m, n.bowl.clone(), BOWL.clone().add(new THREE.Vector3(rnd(-0.08, 0.08), 0.06, rnd(-0.08, 0.08))), 0.5, 0.3, () => bowlMeat.push(m));
  SFX.sneak(); toast('偷到一顆！', '#c9a0ff'); updHud();
}
function lifeHtml() { const L = save.life, w = L.opened + L.wasteShells ? Math.round((L.missed + L.wasteShells) / (L.opened + L.wasteShells) * 100) : 0;
  const tl = Object.entries(save.titles).map(([k, v]) => `${k} ×${v}`).join('、') || '（猶無）';
  return `<h3>生涯紀錄</h3><p style="font-size:13px;line-height:1.6">工作 ${save.days} 天・累積收入 $${save.money}・最佳 ${save.best} 顆<br>開殼 ${L.opened}・入碗 ${L.inBowl}・浪費率 ${w}%・殼屑 ${L.cracked}<br>完美／俐落 ${L.perfects}・最長連擊 ${L.bestCombo}・放棄 ${L.abandoned}・割手 ${L.stabs}<br>偷 ${L.steals}/被抓 ${L.caught}・丟中阿婆 ${L.shellHits}・被丟中 ${L.hitsTaken}・擋 ${L.blocks}・反彈 ${L.reflects}<br>稱號：${tl}</p>`; }
let lastPay = { gross: 0, pen: 0, earn: 0 }, nameWait = false;
function endDay() { inputGuard(); if (document.pointerLockElement) document.exitPointerLock();
  if (tut) { tutEnd(false); return; }
  if (state === 'end') return; state = 'end'; setPhase('busy'); closeUmbrella(); on('umbBtn', false); on('medBtn', false); on('quitBtn', false); on('camBtn', false); $('radioBtn').style.display = 'none'; document.getElementById('vign')?.classList.remove('on'); $('medList').classList.remove('show'); on('stealBtn', false); stopSteal();
  const all = [{ name: `你（${esc(myName())}）`, count, me: true }, ...npcs.map(n => ({ name: n.name, count: n.count, me: false }))].sort((a, b) => b.count - a.count);
  const temp = shiftLen < SHIFT, worked = endReason !== 'quit' && count >= 5, queen = all[0].me && !temp && worked, PAY = OYSTER_PRICE - (temp ? TEMP_CUT : 0);
  const pearlMoney = dayPearls.reduce((s, r) => s + RAR[r].price, 0) + dayOdd.reduce((s, r) => s + ODD[r].price, 0);
  const titles: string[] = []; let bonus = 0;
  if (thrown === 0 && !temp && worked) { titles.push(`🕊 和平${esc(myName())}（+$50）`); bonus = 50; }
  if (worked && shellHits >= 3 && shellHits > hitsTaken) titles.push('👊 工寮霸主');
  if (worked && blocks + reflects >= 3 && blocks + reflects > hitsTaken) titles.push('☂ 雨傘大師');
  const LC = locNow(), base0 = meatPay + perfects * PERFECT_PAY + bowlBonus + pearlMoney, locBonus = Math.round(base0 * (LC.m - 1)), nightBonus = nightShift ? Math.round((base0 + locBonus) * 0.2) : 0;
  const earn = Math.max(0, base0 + locBonus + nightBonus + bonus - penalty); lastPay = { gross: base0 + locBonus + nightBonus + bonus, pen: penalty, earn };
  const waste = opened + wasteShells ? Math.round((missed + wasteShells) / (opened + wasteShells) * 100) : 0;
  save.days++; tickTrial(); autoUnlock(); save.best = Math.max(save.best, count); save.money += earn; if (queen) { save.queen++; titles.unshift('👑 今日剝蚵冠軍'); }
  const L = save.life; L.opened += opened; L.inBowl += count; L.missed += missed; L.wasteShells += wasteShells; L.cracked += cracked; L.perfects += perfects; L.abandoned += abandoned; L.stabs += stabs; L.steals += steals; L.caught += caught; L.meatHits += meatHits; L.shellHits += shellHits; L.hitsTaken += hitsTaken; L.blocks += blocks; L.reflects += reflects; L.lost += lost;
  for (const tt of titles) { const k = tt.replace(/（.*）/, ''); save.titles[k] = (save.titles[k] ?? 0) + 1; }
  persist();
  if (!tut && !SHOT) { const td = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); let inc = 0; try { const o = JSON.parse(LS.getItem('oyster-lb-day') || '{}'); inc = o.d === td ? o.v : 0; } catch { } inc += Math.max(0, earn); try { LS.setItem('oyster-lb-day', JSON.stringify({ d: td, v: inc })); } catch { } Social.submit({ income: inc, oysters: count, pearls: save.dex.reduce((a, b) => a + b, 0) }); }
  track('day', { loc: locNow().id, item: 't' + shiftLen,  count, opened, missed, perfects, cracked, steals, caught, shellHits, earn, pearls: dayPearls.length + dayOdd.length, waste, combo: dayCombo, maxAnger: Math.round(dayMaxGrudge), double: dayMulti2, triple: dayMulti3, dur: Math.round(shiftLen - Math.max(0, timeLeft)), dex: dexN(), seat: save.seat ?? 'door', reason: handPain ? 'hand' : endReason, dstat: dstatStr() });
  $('resTitle').textContent = handPain ? '🩹 手痛收工' : queen ? '👑 今日剝蚵冠軍！' : '收工了～';
  $('resBody').innerHTML = all.map((a, i) => `<div class="row"><span>${i + 1}. ${a.name}</span><b>${a.count} 顆入碗</b></div>`).join('') +
    `<p style="font-size:14px">開殼 ${opened}・入碗 ${count}・無入 ${missed}・浪費率 <b>${waste}%</b><br>殼屑 ${cracked}・完美／俐落 ${perfects}・放棄 ${abandoned}・割手 ${stabs}<br>` +
    `偷 ${steals}・被抓到 ${caught}・肉丟中阿婆 ${meatHits}・殼丟中阿婆 ${shellHits}<br>雨傘擋 ${blocks}・完美反彈 ${reflects}・被丟中 ${hitsTaken}・丟殼 ${thrown}・蚵仔掉地上 ${lost}</p>` + (titles.length ? `<p style="font-size:18px"><b>${titles.join('　')}</b></p>` : '') +
    `<p>蚵仔 ${count} 顆 = $${meatPay}（${dCnt.map((c, i) => `${DSHORT[i]}×${c}`).join(' ')}）<br><small>每顆 易$6・普$8・硬$12・超硬$18，殼屑 ${cracked} 顆只算 25%${temp ? `，臨時工抽成 -$${TEMP_CUT}／顆` : ''}</small>${perfects ? `<br>完美／俐落 ${perfects} 次 × $${PERFECT_PAY}` : ''}${bowlBonus ? `<br>臉盆加價 +$${bowlBonus}` : ''}<br>珍珠／奇物 ${dayPearls.length + dayOdd.length} 件 = $${pearlMoney}<br>罰款／扣價 -$${penalty}${locBonus ? `<br>${LC.n} 工錢 ×${LC.m}：+$${locBonus}` : ''}${nightBonus ? `<br>🌙 夜班加成 +20%：+$${nightBonus}` : ''}${bonus ? `<br>和平獎金 +$${bonus}` : ''}<br><b style="font-size:20px">今日收入 $${earn}</b></p>` +
    `<p style="font-size:13px;opacity:.8">累積收入 $${save.money}・最佳紀錄 ${save.best} 顆・拿冠軍 ${save.queen} 次</p>` +
    `<p>${caught >= 2 ? '阿婆們：「明天你自己坐一邊！」' : waste >= 30 ? '阿婆們：「地上都是蚵仔肉，明天準一點！」' : queen ? '阿婆們：「哎唷，今天被你贏走了！」' : `${all[0].name}：「明天再來拚喔～」`}</p>`;
  $('result').classList.add('show'); later(1.2, namePrompt); if (ac) SFX.endJingle(queen && !handPain);
}
function revealPearl(r: number) { react3('cheer');
  sleeveGold(); dayPearls.push(r); save.dex[r]++; persist(); Social.report('pearl', r); track('find', { kind: 'pearl', item: 'pearl-' + r, rarity: rarOf(RAR[r].w), seat: save.seat ?? 'door', knife: knifeNow().id, luck: luckNow(), dex: dexN() }); renderDex();
  slowmo = 2.6; pearlShow = 2.6;
  (pearlMesh.material as THREE.MeshStandardMaterial).color.setHex(RAR[r].color);
  (pearlMesh.material as THREE.MeshStandardMaterial).emissive.setHex(r === 3 ? 0x302050 : RAR[r].color).multiplyScalar(0.25);
  pearlMesh.visible = true; ding(r);
  label.innerHTML = `${RAR[r].name}！<small>${save.dex[r] === 1 ? '🆕 第一次找到！' : `你的第 ${save.dex[r]} 個`}</small><small>${['阿婆們都轉頭來看了！', '哇～粉紅色的，好漂亮！', '金光閃閃，今天發了！', '黑珍珠！！整個漁港都轟動了！'][r]}</small>`;
  label.style.color = RAR[r].css === '#3a3548' ? '#c9b8ff' : RAR[r].css; label.classList.add('on');
  const cries = ['哎唷！珍珠！', '給我看看！', '好運喔你！', '老天爺保佑！'];
  npcs.forEach((n, i) => { n.look = 2.6; say(n, cries[(i + r) % cries.length], 2.6); });
}
function renderDex() {
  const RZ: Record<string, string> = { common: '普通', uncommon: '少見', rare: '稀有', legend: '傳說' };
  const all = [...RAR.map((r, i) => ({ ...r, has: save.dex[i] ?? 0 })), ...ODD.map((o, i) => ({ ...o, has: save.odd[i] ?? 0 }))];
  const item = (x: typeof all[number]) => { const rr = rarOf(x.w); return `<div class="dexItem ${x.has ? '' : 'locked'}">${x.has ? `<div class="dot" style="background:${x.css};box-shadow:0 0 8px ${x.css}">${'ic' in x && (x as any).ic ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1e1a16" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${(x as any).ic}</svg>` : x.emo}</div>` : '<div class="dot unk" aria-hidden="true">?</div>'}<div><b>${x.has ? x.name : '？？？'}</b>${x.has ? ` <span class="dexN">×${x.has}</span>` : ''} <span class="rb r-${rr}">${RZ[rr]}</span><br><small>${x.has ? `收集 ${x.has} 件・值 $${x.price}${'line' in x ? `<br>「${(x as any).line}」` : ''}` : `💭 ${x.tease}`}</small></div></div>`; };
  const got = all.filter(x => x.has).length;
  const per = (['common', 'uncommon', 'rare', 'legend'] as const).map(r => { const xs = all.filter(x => rarOf(x.w) === r); return `<span class="rb r-${r}">${RZ[r]} ${xs.filter(x => x.has).length}/${xs.length}</span>`; }).join(' ');
  $('dexList').innerHTML = `<div class="dexProg"><b>已收集 ${got} / ${all.length} 種</b>・累計挖到 <b>${all.reduce((a, x) => a + x.has, 0)}</b> 個<div class="dexBar"><i style="width:${got / all.length * 100}%"></i></div>${per}</div>` +
    '<h3>珍珠</h3>' + all.slice(0, RAR.length).map(item).join('') + '<h3>奇物</h3>' + all.slice(RAR.length).map(item).join('') + lifeHtml();
}
renderDex();

// ---------- 操作 ----------
let down: { x: number; y: number; id: number; drag: boolean; yaw: number; pitch: number; rotMode: boolean; lx: number; lt: number } | null = null;
const yl = () => walking ? 1e9 : YAW;
const YAW = 1.25, P0 = -1.05, P1 = 0.15;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const swipePhase = () => phase === 'twist' || phase === 'crab';
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (state !== 'play') return; audio().resume(); if (umbHeld) { hint.textContent = '撐著傘不能剝蚵，先放開雨傘'; return; }
  if (swipePhase()) { pry(e.timeStamp); if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) canvas.requestPointerLock(); return; }
  if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (walking) { down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: true, yaw: tYaw, pitch: tPitch, rotMode: false, lx: e.clientX, lt: performance.now() }; return; }
  if (e.button === 2) { throwShell(); return; }
  down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, yaw: tYaw, pitch: tPitch, rotMode: e.pointerType !== 'mouse' && phase === 'seam' && hitsOyster(e.clientX, e.clientY), lx: e.clientX, lt: performance.now() };
});
let lastMoveT = performance.now();
window.addEventListener('pointermove', e => {
  const now = performance.now();
  if (e.pointerType === 'mouse' && state === 'play') {
    if (swipePhase()) { lastMoveT = now; return; }
    lastMoveT = now;
    if (document.pointerLockElement === canvas) { const k = 0.0022 * mix.sens; yaw = tYaw = clamp(tYaw - e.movementX * k * (mix.invX ? -1 : 1), -yl(), yl()); pitch = tPitch = clamp(tPitch - e.movementY * k * (mix.invY ? -1 : 1), P0, P1); camera.rotation.set(pitch, yaw + (walking ? 0 : seatYaw), 0); camera.updateMatrixWorld(); }
    return;
  }
  if (!down || down.id !== e.pointerId) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (swipePhase()) return;
  if (down.rotMode) { rot += (e.clientX - down.lx) * 0.012; down.lx = e.clientX; if (Math.abs(dx) > 8) down.drag = true; return; }
  if (!down.drag && Math.hypot(dx, dy) > 14) { down.drag = true; holding = false; hold = 0; gauge.classList.remove('on'); }
  if (down.drag) { const k = 0.006 * mix.sens; tYaw = clamp(down.yaw - dx * k * (mix.invX ? -1 : 1), -yl(), yl()); tPitch = clamp(down.pitch - dy * k * (mix.invY ? -1 : 1), P0, P1); }
});
function release() { if (!holding) return; const h = hold; holding = false; hold = 0; gauge.classList.remove('on'); void h; }
const up = (e: PointerEvent) => { if (down && down.id === e.pointerId && walking) { down = null; return; } if (down && down.id === e.pointerId) { if (!down.drag) { if (phase === 'seam') tryInsert(); else if (phase === 'pick') { if (e.pointerType === 'mouse') pickAt(innerWidth / 2, innerHeight / 2); else pickAt(e.clientX, e.clientY); } else if (phase === 'aim' && tapAim) { const lk = document.pointerLockElement === canvas; if (nearBowl(lk ? innerWidth / 2 : e.clientX, lk ? innerHeight / 2 : e.clientY)) toss(true); else hint.textContent = '點碗或碗附近就能丟進去'; } else release(); } else release(); down = null; } };
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { if (phase === 'seam') { rot += e.deltaY * 0.004; e.preventDefault(); } }, { passive: false });
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
  if (e.code === 'KeyV' && !e.repeat) toggleRadio();
  if (state === 'play' && !tut && e.code === 'KeyM') { const L = $('medList'); if (document.pointerLockElement) document.exitPointerLock(); L.classList.toggle('show'); if (L.classList.contains('show')) renderMedList(); return; }
  if (state === 'play' && $('medList').classList.contains('show') && /^Digit[1-9]$/.test(e.code)) { const own = MEDS.filter(m => (save.meds[m.id] ?? 0) > 0); const m = own[+e.code.slice(5) - 1]; if (m) { useMed(m.id); renderMedList(); } return; }
  if (tut && e.code === 'Enter' && TUT[tut.i].next) { $('tutNext').click(); return; }
  if (state !== 'play') return; audio().resume();
  if (walking) { walkKeys.add(e.code); if (e.code === 'KeyE' && nearSeat) sitDown(nearSeat.id); return; }
  if (e.code === 'KeyG') { standUp(); return; }
  if (e.code === 'Space' && !e.repeat && umbHeld) { hint.textContent = '撐著傘不能剝蚵，先放開雨傘'; return; }
  if (e.code === 'Space' && !e.repeat) { if (phase === 'pick') pickAt(innerWidth / 2, innerHeight / 2); else if (phase === 'seam') tryInsert(); else if (swipePhase()) pry(e.timeStamp); else if (phase === 'aim' && tapAim) toss(true); else if (phase === 'aim') { holding = true; hold = 0; } }
  if (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    const l = e.code === 'KeyA' || e.code === 'ArrowLeft';
    if (phase === 'seam') rotKey = l ? -1 : 1; else if (!e.repeat && swipePhase()) keyTwist(l ? 'L' : 'R');
  }
  if (e.code === 'KeyQ') giveUp();
  if (e.code === 'KeyF') throwShell();
  if (e.code === 'KeyR' && !e.repeat) openUmbrella();
  if (e.code === 'KeyE' && !e.repeat) startSteal();
});
window.addEventListener('keyup', e => { walkKeys.delete(e.code); if (e.code === 'Space') release(); if (/Key[AD]|Arrow(Left|Right)/.test(e.code)) rotKey = 0; if (e.code === 'KeyE') stopSteal(); if (e.code === 'KeyR') closeUmbrella(); });
// 換畫面後 350ms 內忽略點擊，防止放開觸發後的合成 click 穿透到新畫面同位置的按鈕
let guardUntil = 0;
function inputGuard() { guardUntil = performance.now() + 350; }
for (const ev of ['click', 'pointerup']) document.addEventListener(ev, e => { if (performance.now() < guardUntil && (e.target as HTMLElement)?.closest?.('button,a,.panel')) { e.stopPropagation(); e.preventDefault(); } }, true);
// 手機：一般按鈕放開才觸發，移動超過 12px 視為滑動不算按；按住型（雨傘、方向）維持按下即觸發
const btn = (id: string, f: () => void, upF?: () => void) => {
  const el = $(id);
  if (upF || !COARSE) { el.addEventListener('pointerdown', e => { e.stopPropagation(); audio().resume(); f(); }); if (upF) { el.addEventListener('pointerup', upF); el.addEventListener('pointerleave', upF); } return; }
  let sx = 0, sy = 0, st = 0, ok = false;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); audio().resume(); sx = e.clientX; sy = e.clientY; st = performance.now(); ok = true; });
  el.addEventListener('pointermove', e => { if (ok && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) ok = false; });
  el.addEventListener('pointercancel', () => ok = false);
  el.addEventListener('pointerup', e => { e.stopPropagation(); if (ok && performance.now() - st < 800) f(); ok = false; });
};
btn('giveUp', giveUp); btn('radioBtn', toggleRadio); btn('quitBtn', () => { if (state !== 'play' || tut) return; if (document.pointerLockElement) document.exitPointerLock(); $('backMenu').classList.add('show'); });
$('bmStay').onclick = () => $('backMenu').classList.remove('show');
$('bmGo').onclick = () => { $('backMenu').classList.remove('show'); if (state !== 'play' || tut) return; const m0 = save.money; endReason = 'quit'; endDay(); $('result').classList.remove('show'); renderLocs(); $('overlay').classList.add('show'); $('overlay').scrollTop = 0; void m0; const P = lastPay; if (P.gross || P.pen) { const r = (ic: string, l: string, v: string, c = '') => `<div class="row"><span><i class="ic ic-${ic}"></i> ${l}</span><b${c}>${v}</b></div>`; $('psBody').innerHTML = r('oyster', '收入', `+$${P.gross}`) + (P.pen ? r('warn', '罰款／扣價', `-$${P.pen}`, ' style="color:#ff8a7a"') + r('coin', '淨收入', `$${P.earn}`) : '') + `<p style="font-size:14px;opacity:.85">已入帳，身上共有 $${save.money}</p>`; $('paySum').classList.add('show'); } };
$('psOk').onclick = () => { $('paySum').classList.remove('show'); if (nameWait) { nameWait = false; setTimeout(namePrompt, 300); } }; btn('standBtn', standUp); btn('sitBtn', () => { if (nearSeat) sitDown(nearSeat.id); }); btn('throwBtn', throwShell); btn('umbBtn', openUmbrella, closeUmbrella); for (const ev of ['pointercancel', 'lostpointercapture', 'touchend', 'touchcancel']) $('umbBtn').addEventListener(ev, closeUmbrella); addEventListener('blur', closeUmbrella); document.addEventListener('visibilitychange', () => { if (document.hidden) closeUmbrella(); }); $('umbBtn').addEventListener('contextmenu', e => e.preventDefault()); btn('stealBtn', startSteal, stopSteal);
{ const sb = $('stealBtn'); sb.addEventListener('pointerdown', e => { try { sb.setPointerCapture(e.pointerId); } catch { } });
  for (const ev of ['pointercancel', 'lostpointercapture', 'touchend', 'touchcancel']) sb.addEventListener(ev, stopSteal);
  window.addEventListener('pointerup', stopSteal); window.addEventListener('pointercancel', stopSteal); window.addEventListener('blur', stopSteal); document.addEventListener('visibilitychange', stopSteal); }
// 手機：次要按鈕放左下一排（不收選單）
if (matchMedia('(pointer:coarse)').matches) { const L = $('btnsL'); for (const id of ['radioBtn', 'medBtn', 'quitBtn', 'giveUp', 'standBtn', 'camBtn']) L.appendChild($(id)); }
else $('btns').insertBefore($('radioBtn'), $('medBtn'));
btn('rotL', () => rotKey = -1, () => rotKey = 0); btn('rotR', () => rotKey = 1, () => rotKey = 0);
// ----- 徛起來行路、換位 -----
let walking = false, nearSeat: Seat | null = null; const walkPos = new THREE.Vector3(), walkKeys = new Set<string>(), joy = { x: 0, y: 0 };
const NAG_STAND = ['剝一半就要走喔？', '蚵仔丟著就走，好浪費！', '要去哪裡？工作先做完啦'];
function standUp() {
  if (state !== 'play' || walking) return;
  if (['seam', 'twist', 'crab', 'aim', 'empty'].includes(phase)) { abandoned++; const sh = new THREE.Mesh(shellGeo, shellTopMat); fly(sh, worldOf(oyster), pileSpot(), 0.6, 0.6, () => scene.remove(sh)); nag(NAG_STAND); if (!seatNow().nag || Math.random() > seatNow().nag) { const n = pick(npcs); n.look = 2.5; say(n, pick(NAG_STAND), 3); } }
  oyster.visible = false; progress = 0; combo = 0; tension = 0; shellTop.rotation.z = 0; rotKey = 0; stopSteal(); setPhase('busy');
  walking = true; handRig.visible = false; walkPos.copy(SEAT).setY(1.55); const out = seatGround(seatNow()).setLength(0.45); walkPos.add(out);
  tYaw = yaw = yaw + seatYaw; tPitch = pitch = -0.25; $('diff').textContent = ''; on('standBtn', false); on('joy', true); on('stealBtn', false);
  hint.textContent = 'WASD／搖桿行路，走去空的藍色板凳邊仔，按 E／「坐落」換位';
}
function sitDown(id: string) {
  walking = false; nearSeat = null; on('seatCard', false); on('joy', false); joy.x = joy.y = 0; walkKeys.clear(); stools.forEach(g => g.userData.tag.visible = false);
  if (id !== save.seat) track('seat', { seat: id }); applySeat(id); persist(); handRig.visible = true; tYaw = yaw = 0; tPitch = pitch = -0.85; toast(`坐落${seatNow().n}`, '#9fe0ff'); SFX.pop(); later(0.3, goPick);
}
function walkStep(dt: number) {
  const k = (c: string) => walkKeys.has(c) ? 1 : 0;
  let f = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') - joy.y, r = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + joy.x;
  const l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l; }
  const sp = 1.7 * dt; walkPos.x += (-Math.sin(yaw) * f + Math.cos(yaw) * r) * sp; walkPos.z += (-Math.cos(yaw) * f - Math.sin(yaw) * r) * sp;
  const obs: [number, number, number][] = [[0, 0, 1.15], [BASIN.x, BASIN.z, 0.42], [BOWL.x, BOWL.z, BOWL_R + 0.12], [2.6, 2.6, 0.75], [2.9, -2.5, 0.35], [3.1, -1.9, 0.35], [-2.9, 2.6, 0.35], [3.0, 0.5, 0.3], [-3.0, 0.2, 0.3]];
  npcs.forEach(n => obs.push([n.g.position.x, n.g.position.z, 0.5])); stools.forEach(g => obs.push([g.position.x, g.position.z, 0.28]));
  for (let it = 0; it < 3; it++) for (const [x, z, rr] of obs) { const dx = walkPos.x - x, dz = walkPos.z - z, d = Math.hypot(dx, dz); if (d < rr + 0.2 && d > 1e-4) { walkPos.x = x + dx / d * (rr + 0.2); walkPos.z = z + dz / d * (rr + 0.2); } }
  if (walkPos.z < -2.55 && walkPos.x < -1.3) walkPos.z = -2.55; // 保麗龍箱
  walkPos.x = clamp(walkPos.x, -3.25, 3.25); walkPos.z = clamp(walkPos.z, -3.25, 3.25); walkPos.y = 1.55 + Math.sin(performance.now() / 120) * 0.012 * Math.min(1, l);
  let best: Seat | null = null, bd = 0.85; SEATS.forEach((st, i) => { const d = Math.hypot(walkPos.x - stools[i].position.x, walkPos.z - stools[i].position.z); stools[i].userData.tag.visible = true; if (d < bd) { bd = d; best = st; } });
  if (best !== nearSeat) { nearSeat = best; on('seatCard', !!best); if (best) { const st = best as Seat; $('seatInfo').innerHTML = `<b>🪑 ${st.n}</b>${st.id === seatNow().id ? '（這馬的位）' : ''}<br><span style="color:#9be37a">＋ ${st.pro}</span><br><span style="color:#ff8a7a">－ ${st.con}</span>`; } }
}
{ const j = $('joy'), kb = $('joyK'); let jid = -1, cx = 0, cy = 0;
  j.addEventListener('pointerdown', e => { e.stopPropagation(); jid = e.pointerId; const r = j.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; j.setPointerCapture(e.pointerId); });
  j.addEventListener('pointermove', e => { if (e.pointerId !== jid) return; const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.min(1, Math.hypot(dx, dy) / 50), a = Math.atan2(dy, dx); joy.x = Math.cos(a) * d; joy.y = Math.sin(a) * d; kb.style.transform = `translate(${joy.x * 40}px,${joy.y * 40}px)`; });
  const end = (e: PointerEvent) => { if (e.pointerId !== jid) return; jid = -1; joy.x = joy.y = 0; kb.style.transform = ''; };
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end); }
function giveUp() {
  if (state !== 'play' || (phase !== 'seam' && phase !== 'twist')) return;
  abandoned++; setPhase('busy'); oyster.visible = false; gauge.classList.remove('hit', 'miss', 'hitHold');
  later(0.05, () => { progress = 0; combo = 0; crackedNow = false; tension = 0; shellTop.rotation.z = 0; rotKey = 0; });
  const sh = new THREE.Mesh(shellGeo, shellTopMat); fly(sh, worldOf(oyster), pileSpot(), 0.6, 0.6, () => scene.remove(sh));
  hint.textContent = '丟掉了…'; nag(NAG_GIVEUP); updHud(); later(0.6, goPick);
}
// 入碗數達標自動解鎖地點（不用錢）
function autoUnlock() { const tot = save.life.inBowl ?? 0; save.locs ??= []; for (const l of LOCS) if (l.need && tot >= l.need && !save.locs.includes(l.id)) { save.locs.push(l.id); persist(); Social.report('port', LOCS.indexOf(l)); track('buy', { item: 'loc-' + l.id, price: 0 }); toast(`📍 新地點解鎖：${l.n}`); } }
function renderLocs() { autoUnlock();
  const el = $('locPick'); const tot = save.life.inBowl ?? 0;
  const seen = save.locSeen ?? (save.locSeen = ['home']); const cl = locNow();
  const isNew = (l: typeof LOCS[number]) => !seen.includes(l.id) && save.locs!.includes(l.id);
  const anyNew = LOCS.some(isNew);
  el.innerHTML = `<div class="locHead"><b><i class="ic ic-pin"></i> 上工地點：${cl.n} ×${cl.m.toFixed(1)}</b>${anyNew ? '<span class="nb">NEW</span>' : ''}<small>👉 點下面的卡片換地點${COARSE ? '（左右滑看更多）' : ''}</small></div><div class="locRow">` + LOCS.map(l => { const own = l.need === 0 || save.locs!.includes(l.id), cur = cl.id === l.id, nw = isNew(l) ? '<span class="nb">NEW</span>' : '';
    const head = `<span class="ln">${own ? '' : '🔒 '}${l.n}</span>${nw}<span class="lm">工錢 ×${l.m.toFixed(1)}</span>`;
    if (own) return `<button class="loc ${cur ? 'cur' : ''}" data-loc="${l.id}">${head}<small>${cur ? '✅ 選擇中' : '點一下選這裡'}</small><small class="ld">${l.d}</small></button>`;
    return `<button class="loc locked" disabled>${head}<small><i class="ic ic-lock"></i> 解鎖條件：入碗 ${tot}/${l.need} 顆</small><small class="ld">${l.d}</small></button>`; }).join('') + '</div>';
  const mark = (id?: string) => { if (id && !seen.includes(id)) { seen.push(id); persist(); } };
  el.querySelectorAll<HTMLButtonElement>('button.loc').forEach(b => b.addEventListener('click', () => mark(b.dataset.loc || b.dataset.lbuy), { capture: true }));
  requestAnimationFrame(() => el.querySelector('.loc.cur')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  el.querySelectorAll<HTMLButtonElement>('[data-loc]').forEach(b => b.onclick = () => { save.loc = b.dataset.loc; persist(); renderLocs(); updSky(); });
}
renderLocs();
$('rLoc').onclick = () => { $('result').classList.remove('show'); renderLocs(); $('overlay').classList.add('show'); $('overlay').scrollTop = 0; };
const go = (len: number) => { shiftLen = len; audio(); if (!save.tutDone) tutStart(); else startDay(); };
$('t60').onclick = () => go(60); $('t120').onclick = () => go(120);
$('start').onclick = () => { shiftLen = SHIFT; audio(); if (!save.tutDone) tutStart(); else startDay(); };
btn('again', startDay);
btn('resMenu', () => { $('result').classList.remove('show'); renderLocs(); $('overlay').classList.add('show'); $('overlay').scrollTop = 0; });
$('dexBtn').onclick = () => { renderDex(); $('dex').classList.add('show'); };
$('setBtn').onclick = () => { $('settings').classList.add('show'); void refreshTag(); };
$('daily').onclick = claimDaily; renderDaily(); document.addEventListener('visibilitychange', () => { if (!document.hidden) renderDaily(); });
if (params.get('bonusdone') === '1') { save.bonusDay = todayKey(); renderDaily(); }
$('resetSave').onclick = () => { if (confirm('確定要重置存檔？錢、圖鑑、生涯紀錄、設定都會清掉，無法復原。')) { LS.removeItem('oyster-sim'); LS.removeItem('oyster-mix'); location.reload(); } };
$('shopBtn').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); renderShop(); $('shop').classList.add('show'); };
$('shopBtn2').onclick = () => { renderShop(); $('shop').classList.add('show'); };
$('shopClose').onclick = () => { $('shop').classList.remove('show'); if (sleeveTry) { sleeveTry = null; applySleeve(); } };
applyKnife(); applyUmb(); applySeat(save.seat ?? 'door');
$('pidLong').textContent = statsId;
let myTag = '', tagNoted = false;
const pidText = () => myTag ? `${Social.myNick()} #${myTag}` : '';
const refreshTag = () => Social.me().then(m => {
  if (m) myTag = m.tag;
  $('pidVal').textContent = pidText() || (m === null && !myTag ? '暫時連不上伺服器' : '讀取中…');
  ($('pidCopy') as HTMLButtonElement).style.display = myTag ? '' : 'none';
  if (m?.changed && !tagNoted) {
    tagNoted = true;
    $('tnBody').innerHTML = `<p>你的玩家號碼已更新為 <b>#${m.tag}</b>${m.oldTag ? `（原本是 #${m.oldTag}）` : ''}。</p><p style="font-size:14px;opacity:.85">原本的號碼跟其他玩家重複，為了排行榜和禮物不會弄錯人，系統幫你換了一個新號碼。錢和紀錄都不受影響。</p>`;
    $('tagNote').classList.add('show');
  }
});
$('tnOk').onclick = () => { $('tagNote').classList.remove('show'); Social.ackMe(); };
setTimeout(refreshTag, 1500);
$('pidCopy').onclick = () => {
  const txt = pidText(); if (!txt) return;
  const sel = () => { const r = document.createRange(); r.selectNodeContents($('pidVal')); const w = getSelection(); w?.removeAllRanges(); w?.addRange(r); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => toast('已複製'), () => { sel(); toast('已選取，請長按複製'); });
  else { sel(); try { document.execCommand('copy'); toast('已複製'); } catch { toast('已選取，請長按複製'); } }
};
$('setClose').onclick = () => $('settings').classList.remove('show');
for (const k of ['master', 'amb', 'sfx'] as const) { const el = $('v_' + k) as HTMLInputElement; el.value = String(mix[k]); el.oninput = () => { mix[k] = Number(el.value); applyMix(); if (k === 'sfx' && ac) SFX.plop(); }; }
for (const [id, key] of [['v_invX', 'invX'], ['v_invY', 'invY']] as const) { const c = $(id) as HTMLInputElement; c.checked = mix[key]; c.onchange = () => { mix[key] = c.checked; applyMix(); }; }
{ const mv = $('v_music') as HTMLInputElement; mv.value = String(mix.music); mv.oninput = () => { mix.music = +mv.value; applyMix(); }; }
{ const g = $('v_stats') as HTMLInputElement; g.checked = mix.stats; g.onchange = () => { mix.stats = g.checked; applyMix(); }; }
{ const g = $('v_feed') as HTMLInputElement; g.checked = mix.feed; g.onchange = () => { mix.feed = g.checked; applyMix(); }; }
{ const g = $('v_gore') as HTMLInputElement; g.checked = mix.gore; g.onchange = () => { mix.gore = g.checked; applyMix(); }; }
{ const sv = $('v_sens') as HTMLInputElement; sv.value = String(mix.sens); sv.oninput = () => { mix.sens = +sv.value; applyMix(); }; }
document.addEventListener('pointerlockchange', () => { const l = document.pointerLockElement === canvas; on('lockHint', !l && state === 'play' && !matchMedia('(pointer: coarse)').matches); setPhase(phase); });
{ const m = $('v_mute') as HTMLInputElement; m.checked = mix.mute; m.onchange = () => { mix.mute = m.checked; applyMix(); }; }
window.addEventListener('pointerdown', () => audio(), { once: true });
$('dexClose').onclick = () => $('dex').classList.remove('show');

// ---------- 阿婆真正咧剝 ----------
function npcShuck(n: Npc, dt: number, t: number) {
  if (n.pause > 0 || n.distract > 0 || n.angry > 0) n.pause -= dt; else n.cyc += dt / n.dur;
  const c = n.cyc;
  const prying = c > 0.15 && c < 0.6 && n.pause <= 0 && n.distract <= 0;
  n.armR.rotation.x = n.windup > 0 ? -2.4 : n.angry > 0 ? -1.6 + Math.sin(t * 12) * 0.3 : prying ? -0.25 + Math.sin(t * 28) * 0.12 : -0.05;
  n.armR.rotation.z = prying ? Math.sin(t * 14) * 0.08 : 0;
  if ((n.scoopT ?? 0) > 0) { n.scoopT! -= dt; n.armL.rotation.x = n.armR.rotation.x = -0.9 + Math.sin(t * 8) * 0.2; n.body.rotation.x = 0.35; return; }
  if (n.bump && (n.bumpT = (n.bumpT ?? 0) - dt) <= 0) { n.head.remove(n.bump); n.bump = undefined; }
  if ((n.clutch ?? 0) > 0) { n.clutch! -= dt; n.armL.rotation.x = n.armR.rotation.x = -2.7; n.body.rotation.z = Math.sin(t * 18) * 0.08; return; }
  n.armL.rotation.x = n.angry > 0 ? -1.4 : c < 0.15 ? -0.4 * (1 - c / 0.15) : -0.15;
  if (c >= 0.6 && n.ev === 0) { n.ev = 1; n.top.rotation.z = -1.3; n.top.position.set(-0.05, 0.07, 0); }
  if (c >= 0.7 && n.ev === 1) { n.ev = 2; n.meat.visible = false; const m = new THREE.Mesh(meatGeo, meatMat);
    fly(m, worldOf(n.meat), n.bowl.clone().add(new THREE.Vector3(rnd(-0.06, 0.06), Math.min(n.bowlMeat.length, 30) * 0.002, rnd(-0.06, 0.06))), 0.35, 0.15, () => {
      n.count++; n.bowlMeat.push(m); if (n.bowlMeat.length > 25) scene.remove(n.bowlMeat.shift()!); }); }
  if (c >= 0.85 && n.ev === 2) { n.ev = 3; n.oy.visible = false; const sh = new THREE.Mesh(pick(HALF_GEOS), shellMat); fly(sh, worldOf(n.oy), pileSpot(), 0.5, 0.4, () => scene.remove(sh)); }
  if (c >= 1 && (n.basinN = (n.basinN ?? 6) - 1) <= 0) { n.basinN = 6; n.pause = 1.5; n.scoopT = 1.5; }
  if (c >= 1) { n.cyc = 0; n.ev = 0; n.dur = n.rate * NPC_DIFF_T[wpick(locW().map(w => ({ w })))] * rnd(0.9, 1.1); n.oy.visible = true; n.meat.visible = true; n.top.rotation.z = 0; n.top.position.set(0, 0.04, 0); }
}

// ---------- 主迴圈 ----------
let baseFov = 70, narrow = false;
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); tpCam.aspect = camera.aspect; tpCam.updateProjectionMatrix();
  narrow = camera.aspect < 0.8; baseFov = narrow ? 82 : 70; handRig.position.set(0, narrow ? -0.02 : 0, 0); handRig.scale.set(narrow ? 0.42 : 0.7, narrow ? 0.6 : 0.7, 0.7); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); const v = new THREE.Vector3();
let chatTimer = 2;
const warnEl = $('warn');
let pauseAt = 0;
const isPaused = () => state === 'play' && (document.hidden || !!document.querySelector('.panel.show') || $('medList').classList.contains('show') || !!document.getElementById('npcTip')?.classList.contains('show'));
function frame() {
  if (shedAnim.length) { const t = performance.now() / 1000; for (const f of shedAnim) f(t); }
  if (isPaused()) {
    clock.getDelta(); if (!pauseAt) { pauseAt = performance.now(); holding = false; stopSteal(); $('pauseTag').classList.add('on'); }
    renderer.render(scene, viewCam()); requestAnimationFrame(frame); return;
  }
  if (pauseAt) { const d = performance.now() - pauseAt; pauseAt = 0; needleStart += d; npcs.forEach(n => { if (n.gAt) n.gAt += d; }); lastMoveT += d; $('pauseTag').classList.remove('on'); clock.getDelta(); }
  const rdt = Math.min(clock.getDelta(), 0.05);
  slowmo = Math.max(0, slowmo - rdt); const dt = rdt * (slowmo > 0.4 ? 0.3 : 1), t = clock.elapsedTime;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= rdt; if (timers[i].t <= 0) { const f = timers[i].f; timers.splice(i, 1); f(); } }
  hurtT = Math.max(0, hurtT - rdt); flinch = Math.max(0, flinch - rdt); ($('hurt') as HTMLElement).style.opacity = String(Math.min(0.55, hurtT * 0.6));
  toastT -= rdt; if (toastT <= 0) toastEl.classList.remove('on');
  tension = Math.max(0, tension - rdt * 1.6);
  if (umbHeld) { umbT = Math.max(0, umbT - rdt); if (umbT <= 0) { umbHeld = false; umbTired = true; $('umbBtn').classList.remove('held'); toast('手痠了，放開再重新撐傘', '#ffcf8a'); } } else umbT = 0; $('umbBtn').classList.toggle('cd', umbTired); { const b = $('umbBtn'), c = $('umbCd'); if (umbHeld) { const f = umbT / Math.max(0.1, umbLen); b.style.setProperty('--p', `${(f * 100).toFixed(1)}%`); c.textContent = `${umbT.toFixed(1)}s`; b.classList.toggle('low', umbT < 1.2); } else { c.textContent = ''; b.classList.remove('low'); } }
  const us = umbT > 0 ? Math.min(1, umbAge() / Math.max(0.1, umbNow().open + 0.05), umbT * 6) : 0; umbS = us; umb.visible = us > 0; umb.scale.setScalar(0.3 + 0.7 * us); umb.rotation.z = Math.sin(t * 20) * 0.05 * us;
  let warnNpc: Npc | null = null;
  if (state === 'play') {
    if (!tut) timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; endDay(); }
    hp = Math.min(100, hp + dt / 6 * medM('regen')); tickMeds(dt);
    if (phase === 'seam') {
      rot += rotKey * rdt * 2.5; oyster.rotation.y = rot;
      const e = Math.abs(seamErr()), d = DIFF[diff], close = clamp(1 - e / (tolNow() * 3), 0, 1);
      (seamGlow.material as THREE.MeshBasicMaterial).opacity = gearOn('glasses') ? Math.min(1, 0.5 + 0.06 * Math.sin(performance.now() * 0.0042) + clamp(1 - e / (tolNow() * 5), 0, 1) * 0.5) : 0.24 + 0.06 * Math.sin(performance.now() * 0.0042) + close * 0.4;
      { const inZ = e < tolNow(), gl = gearOn('glasses') ? 1.6 : 1, gm = seamGlow.material as THREE.MeshBasicMaterial;
        if (inZ && !sweet) { sweetT = 0.25; navigator.vibrate?.(15); tone(1400, 0.05, 0.12, 'triangle', 0, 2100); }
        sweet = inZ; sweetT = Math.max(0, sweetT - rdt); const snap = sweetT / 0.25;
        gm.color.set(inZ ? 0xd8ff80 : 0xffc878); if (inZ) gm.opacity = gearOn('glasses') ? 1 : 0.8;
        seamGlow.scale.setScalar(gl * (inZ ? 1.5 + snap * 0.6 : 1));
        seamRing.visible = inZ && seamMark.visible; seamRing.scale.setScalar(1 + snap * 0.8); (seamRing.material as THREE.MeshBasicMaterial).opacity = 0.85 - snap * 0.4; }
      const tk = Math.floor(rot / 0.25); if (tk !== lastTick) { lastTick = tk; tone(1800 + close * 1200, 0.025, 0.03 + close * 0.08, 'square'); }
      knife.position.y = 0.03 + (e < tolNow() * 1.5 ? Math.sin(t * 50) * 0.004 : 0);
    } else knife.position.y = 0.03;
    if (phase === 'twist') { if (SHOT === 'pry') needleStart = performance.now() - Math.acos(1 - 2 * PRY_C) / (Math.PI * 2 * prySp()) * 1000; const n = needle(), w = pryW(); zone.style.left = `${(PRY_C - w / 2) * 100}%`; zone.style.width = `${w * 100}%`; fill.style.width = '4px'; fill.style.marginLeft = `calc(${n * 100}% - 2px)`; fill.style.background = n > PRY_RED ? '#ff5a4a' : Math.abs(n - PRY_C) <= w / 2 ? '#d8ffb0' : '#fff'; setInZ(n <= PRY_RED && Math.abs(n - PRY_C) <= w / 2 ? 'z' : ''); }
    if (phase === 'twist' || phase === 'crab') { ($('progFill') as HTMLElement).style.width = `${(phase === 'crab' ? crabShakes / 6 : progress) * 100}%`; }
    if (phase === 'crab') hp = Math.max(1, hp - dt * 2);
    updBlood(rdt);
    if (phase === 'scoop') { scoopT -= rdt; on('prog', true); ($('progFill') as HTMLElement).style.width = `${(1 - scoopT / scoopDur) * 100}%`; if (scoopT <= 0) { fillBasin(true); on('prog', false); later(0.6, goPick); setPhase('busy'); } }
    tickFx(rdt); if (phase === 'aim' && tapAim && performance.now() - tossT0 > 2000) toss(false);
    if (phase === 'empty') { emptyT -= rdt; if (emptyT <= 0) discardShell(); }
    if (phase !== 'twist') setInZ('');
    // 偷蚵仔
    on('standBtn', !walking); on('camBtn', true); if (walking && !walkHintShown && npcs.some(n => (n.grudge ?? 0) > 5)) { walkHintShown = true; toast('起來走走，阿婆氣消得比較快', '#9be37a'); }
    const tgt = walking ? null : stealTarget(); on('stealBtn', !!tgt); if (!tgt) stopSteal();
    if (tgt && !stealNpc && phase !== 'busy') hint.textContent = tgt.distract > 0 ? `${tgt.name}轉頭在聊天！按住 E／「偷」偷她的肉` : `${tgt.name}在看，不要偷…`;
    if (stealNpc) { if (!freeToSteal(stealNpc)) caughtBy(stealNpc); else { stealT += dt; on('prog', true); ($('progFill') as HTMLElement).style.width = `${stealT / 0.9 * 100}%`; if (stealT >= 0.9) { stealT = 0; stealOne(stealNpc); } } }
    chatTimer -= dt * seatNow().nag; if (chatTimer <= 0) { chatTimer = 3 + Math.random() * 4; const n = pick(npcs);
      if (n.bubT <= 0 && n.windup <= 0) { if (n.mood > 0) say(n, pick(GRUDGE)); else if (Math.random() < 0.5) { n.distract = rnd(3, 5.5) * seatNow().steal; n.turnDir = Math.random() < 0.5 ? -1 : 1; say(n, pick(TURN_CHAT), n.distract); } else { say(n, pick(GOSSIP)); if (Math.random() < n.chatty) n.pause = 2.5; } } }
    for (const n of npcs) {
      n.distract -= dt; n.angry -= dt; n.mood -= dt;
      npcShuck(n, dt, t);
      n.grudge = Math.max(0, (n.grudge ?? 0) - (walking ? (performance.now() - (n.gAt ?? 0) > 2000 ? dt * 7.5 : 0) : performance.now() - (n.gAt ?? 0) > 8000 ? dt * 2.5 : 0) * (newbie() ? 2 : 1)); n.calm = Math.max(0, (n.calm ?? 0) - dt); grudgeUI(n);
      if (n === npcs[0] && slOn('sl_89') && !tut && (scaredT -= dt) <= 0) { scaredT = rnd(8, 15); const m = pick(npcs); if (m.bubT <= 0) say(m, pick(SCARED)); }
      n.throwCd -= dt * seatNow().throwM * locNow().thr * (n.calm! > 0 ? 0.3 : (1 + n.grudge! / 25) * (n.mood > 0 ? 2 : 1) * 1); if (n.throwCd <= 0) { n.throwCd = rnd(20, 40); if (!tut && !(newbie() && !((n.grudge ?? 0) > 0)) && !(Math.random() > fxAll().throw)) windUp(n); }
      if (n.windup > 0) { warnNpc = n; n.windup -= rdt; if (!n.warned && n.windup <= warnLead(n)) { n.warned = true; SFX.alert(); } if (n.windup <= 0) npcThrow(n); }
      if (n.peek && n.look <= 0 && n.distract <= 0 && Math.random() < dt * 0.05) { n.look = 2.5; say(n, pick(PEEK), 2.5); }
    }
    updHud();
  }
  // ⚠ 方向提示
  if (warnNpc && !warnNpc.warned) warnNpc = null;
  if (warnNpc) { const rel = warnNpc.g.position.clone().sub(camera.position); const fwd = camera.getWorldDirection(new THREE.Vector3()); let a = Math.atan2(rel.x, rel.z) - Math.atan2(fwd.x, fwd.z); a = Math.atan2(Math.sin(a), Math.cos(a));
    warnEl.classList.add('on'); warnEl.style.left = `${clamp(50 - a / 1.2 * 45, 6, 94)}%`; warnEl.style.opacity = String(0.6 + 0.4 * Math.sin(t * 14)); warnEl.textContent = a > 0.5 ? '⚠◀' : a < -0.5 ? '▶⚠' : '⚠'; hint.textContent = `${warnNpc.name}要丟殼過來了！快按 R／「雨傘」！`; }
  else warnEl.classList.remove('on');
  for (const n of npcs) {
    n.look -= dt; n.bubT -= rdt; if (n.bubT <= 0) n.bubble.style.opacity = '0';
    const stand = n.angry > 0 || n.windup > 0 ? 1 : 0; n.baseY += (stand * 0.18 - n.baseY) * Math.min(1, rdt * 6); n.g.position.y = n.baseY;
    const tgtY = n.look > 0 || stand ? Math.atan2(camera.position.x - n.g.position.x, camera.position.z - n.g.position.z) - n.g.rotation.y : 0;
    const want = n.look > 0 || stand ? 1 : 0;
    n.lean += (want - n.lean) * Math.min(1, rdt * 4);
    n.head.rotation.set(n.pause > 0 ? -0.15 : 0.35 - n.lean * 0.3, 0, 0); n.body.rotation.x = n.lean * 0.15;
    const face = THREE.MathUtils.lerp(0, Math.atan2(Math.sin(tgtY + Math.PI), Math.cos(tgtY + Math.PI)), n.lean);
    n.head.rotation.y = n.distract > 0 && !stand ? n.turnDir * 1.3 : face;
    n.head.getWorldPosition(v); v.y += 0.28; v.project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    n.bubble.style.display = vis ? 'block' : 'none';
    n.tag.style.display = vis && !tut ? 'block' : 'none'; n.tag.style.left = `${clamp((v.x * .5 + .5) * innerWidth, 50, innerWidth - 50)}px`; n.tag.style.top = `${(-v.y * .5 + .5) * innerHeight - 4}px`; { const g = n.grudge ?? 0; n.tag.textContent = n.name + (g >= 60 ? ' 😡' : g >= 25 ? ' 😠' : ''); }
    n.bubble.style.left = `${clamp((v.x * .5 + .5) * innerWidth, 90, innerWidth - 90)}px`; n.bubble.style.top = `${Math.max((-v.y * .5 + .5) * innerHeight - 24, $('top').getBoundingClientRect().bottom + 10 + n.bubble.offsetHeight)}px`;
  }
  boats.forEach((b, i) => { b.position.y = -0.45 + Math.sin(t * 0.8 + i) * 0.05; b.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.03; });
  for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt / f.dur; const k = Math.min(1, f.t); const p1 = typeof f.p1 === 'function' ? f.p1() : f.p1; f.m.position.lerpVectors(f.p0, p1, k); f.m.position.y += Math.sin(k * Math.PI) * f.h; if (k < 1) f.m.rotation.x += dt * 8; else { flyers.splice(i, 1); f.end?.(); } }
  pearlShow = Math.max(0, pearlShow - rdt);
  const pe = pearlShow > 0 ? Math.min(1, pearlShow * 2, (2.6 - pearlShow) * 4) : 0;
  if (pearlShow <= 0) label.classList.remove('on');
  (shimmer.material as THREE.MeshBasicMaterial).opacity = phase === 'twist' && find.kind === 'pearl' ? 0.2 + Math.sin(t * 8) * 0.1 : pe * 0.25;
  pearlMesh.rotation.y += rdt * 2;
  oyster.scale.setScalar(DIFF[diff].scale * (1 + pe * (narrow ? 0.25 : 0.6)));
  handL.position.set(HL.x + (narrow ? 0.12 : 0.05) * pe, HL.y + 0.06 * pe, HL.z);
  const restX = 0.75 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect + 0.3; // 平常囥佇畫面外
  leanFaces.forEach(f => { f.visible = pe > 0.02; f.position.x = f.userData.s * (restX + ((narrow ? 0.4 : 0.58) - restX) * pe); f.position.y = 0.05 - 0.08 * pe; f.rotation.z = -f.userData.s * 0.35 * pe; });
  // 手勢
  const tw = phase === 'twist' ? strokeDir * Math.min(1, tension) : 0;
  handR.position.y = -0.26; handR.rotation.z = -0.2 + tw * 0.4; handR.rotation.y = 0.5 + tw * 0.2; handR.position.x = 0.2 - (phase === 'twist' || phase === 'seam' ? 0.07 : 0);
  if (phase === 'crab') handL.position.x += Math.sin(t * 30) * 0.02;
  reach = Math.max(0, reach - rdt); const rk = Math.sin(Math.min(1, reach / 0.35) * Math.PI); handL.position.z -= rk * 0.18; handL.position.y -= rk * 0.12;
  if (phase === 'scoop') { const sk = Math.sin(t * 6); handL.position.z -= 0.2 + sk * 0.05; handR.position.z = -0.6 + sk * 0.05; handL.position.y += 0.05; } else handR.position.z = -0.45;
  // 找縫／撬殼：右手把刀尖帶到左手蚵仔的殼縫上（平滑靠近）
  { const want = (phase === 'seam' || phase === 'twist') && oyster.visible ? 1 : 0; knifeK += (want - knifeK) * Math.min(1, rdt * 8);
    if (knifeK > 0.01) { handRig.updateMatrixWorld(true); const tip = knife.localToWorld(_kt.set(-0.15, 0, 0)), goal = handL.localToWorld(_kg.copy(oyster.position).add(_ko));
      handRig.worldToLocal(tip); handRig.worldToLocal(goal); handR.position.addScaledVector(goal.sub(tip), knifeK); } }
  const ch = holding && phase === 'aim' ? Math.min(1, hold) : 0;
  if (phase === 'aim' || ch) { handL.position.y += 0.05 + ch * 0.06; handL.position.z -= ch * 0.05; handL.rotation.x = 0.4 - ch * 0.5; } else handL.rotation.x = 0.4;
  if (flinch > 0) { handL.position.y -= flinch * 0.1; handL.rotation.z = 0.3 + flinch * 0.8; } else handL.rotation.z = 0.3;
  if (!swipePhase()) { yaw = tYaw; pitch = tPitch; }
  shake = Math.max(0, shake - rdt);
  if (walking) walkStep(rdt);
  camera.rotation.set(pitch - pe * 0.08, yaw + (walking ? 0 : seatYaw), 0);
  camera.position.copy(walking ? walkPos : SEAT); camera.updateMatrixWorld(); camTick(dt); umbArm(); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(shake * 0.03));
  camera.fov = baseFov - pe * (narrow ? 10 : 22); camera.updateProjectionMatrix();
  lamp.intensity = 26 + Math.sin(t * 1.3) * 1.0;
  renderer.render(scene, viewCam());
  requestAnimationFrame(frame);
}
// ---------- 新手教學 ----------
type TutStep = { id: string; line: string; pc: string; mb: string; hi?: string[]; next?: string; done?: () => boolean; enter?: () => void };
const TUT: TutStep[] = [
  { id: 'grab', line: '來，阿姨教你！先拿一顆蚵仔起來。', pc: '點紅色臉盆裡的蚵仔（或按 Space）', mb: '點紅色臉盆裡的蚵仔，或點自己的手', done: () => phase === 'seam' },
  { id: 'seam', line: '蚵仔殼有一條縫，要轉到對準刀尖喔。', pc: '用滾輪／A D 轉蚵仔，金色的縫對準刀尖時點一下（或按 Space）插刀', mb: '按住 ◀ ▶ 或拖動蚵仔來轉，縫對準刀尖時點一下蚵仔插刀', hi: ['rotL', 'rotR'], done: () => phase === 'twist' || phase === 'aim' },
  { id: 'pry', line: '刀插進去了！看指針，到綠區再撬，不要太用力喔～', pc: '指針走到綠區就點滑鼠／按 Space，撬到殼打開', mb: '指針走到綠區就點一下螢幕，撬到殼打開', hi: ['gauge'], done: () => phase === 'aim' },
  { id: 'toss', line: '蚵仔肉出來了！碗亮起來的時候，點一下碗就能丟進去。', pc: '點一下碗（或碗附近），蚵仔肉就會飛進去', mb: '點一下碗（或碗附近），蚵仔肉就會飛進去', hi: [], done: () => count > tut!.c0 },
  { id: 'steal', line: '偷偷跟你說：阿婆轉頭聊天的時候，可以偷她碗裡的肉…', pc: '看到阿婆在聊天，對準她的碗按住 E 偷（被看到她會生氣）', mb: '看到阿婆在聊天，對準她的碗按住「偷」（被看到她會生氣）', hi: ['stealBtn'], next: '知道了 ▶', done: () => steals > tut!.s0 },
  { id: 'shell', line: '撬出空殼，也可以丟向別人！', pc: '手上有空殼時，對準阿婆按 F 或右鍵丟過去', mb: '手上有空殼時，對準阿婆按「丟殼」丟過去', hi: ['throwBtn'], next: '知道了 ▶', done: () => thrown > tut!.t0 },
  { id: 'umb', line: '小心！阿婆要丟殼過來了！', pc: '看到 ⚠ 趕快按住 R 打開雨傘擋', mb: '看到 ⚠ 趕快按住「雨傘」擋', hi: ['umbBtn'], next: '知道了 ▶', done: () => umbT > 0, enter: () => later(1.2, () => { if (tut && TUT[tut.i].id === 'umb') windUp(npcs[0]); }) },
  { id: 'stand', line: '坐太久腳會麻，起來走走，找別的位子。', pc: '按 G 換位置', mb: '按「🚶 換位置」按鈕', hi: ['standBtn'], next: '知道了 ▶', done: () => walking },
  { id: 'sit', line: '每個位子的好處都不一樣，看清楚再坐。', pc: '用 WASD 走到藍色板凳旁邊，按 E 坐下（或按下面的按鈕坐回原位）', mb: '用搖桿走到藍色板凳旁邊，按「坐落」坐下（或按下面的按鈕坐回原位）', hi: ['sitBtn'], next: '坐回去 ▶', done: () => !walking },
  { id: 'menu', line: '賺的錢可以去雜貨店買好刀、雨傘、碗和服飾，在「裝備」換穿；開到的珍珠會記在圖鑑裡。', pc: '上面有 🏪 雜貨店、圖鑑、⚙ 設定，開始畫面還有「裝備」', mb: '上面有 🏪 雜貨店、圖鑑、⚙ 設定，開始畫面還有「裝備」', hi: ['shopBtn', 'dexBtn', 'setBtn'], next: '下一步 ▶' },
  { id: 'daily', line: '還有，每天來上工，阿姨都發 $100 上工費給你！', pc: '在開始畫面按「💰 領今日上工費」，每天可以領一次', mb: '在開始畫面按「💰 領今日上工費」，每天可以領一次', next: '學會了！🎉' },
];
let tutHi: string[] = [];
function tutShow() {
  if (!tut) return; const st = TUT[tut.i];
  tutHi.forEach(id => $(id).classList.remove('tutHi')); tutHi = st.hi ?? []; tutHi.forEach(id => $(id).classList.add('tutHi'));
  $('tutStep').textContent = `教學 ${tut.i + 1}/${TUT.length}`; $('tutLine').textContent = '👵 ' + st.line; $('tutDo').textContent = '👉 ' + (COARSE ? st.mb : st.pc); $('tutKeys').style.display = COARSE ? 'none' : '';
  const nb = $('tutNext'); nb.textContent = (st.next ?? '') + (COARSE ? '' : '（Enter）'); nb.style.display = st.next ? '' : 'none';
}
function tutGo(i: number) {
  if (!tut) return; if (i >= TUT.length) { tutEnd(true); return; }
  tut.i = i; tut.b0 = missed; tut.c0 = count; tut.t0 = thrown; tut.s0 = steals; track('tutorial_step', { step: TUT[i].id, i }); TUT[i].enter?.(); tutShow();
}
function tutStart() {
  audio(); ['overlay', 'result', 'dex', 'settings', 'shop'].forEach(i => $(i).classList.remove('show'));
  tut = { i: 0, c0: 0, t0: 0, b0: 0, s0: 0 }; startDay(); document.body.classList.add('tutOn'); on('tut', true); track('tutorial_start', { replay: save.tutDone ? 1 : 0 }); tutGo(0);
}
function tutEnd(done: boolean) {
  if (!tut) return; const st = TUT[tut.i].id; tut = null;
  track(done ? 'tutorial_complete' : 'tutorial_skip', { step: st });
  save.tutDone = 1; persist();
  tutHi.forEach(id => $(id).classList.remove('tutHi')); tutHi = []; document.body.classList.remove('tutOn'); on('tut', false);
  if (document.pointerLockElement) document.exitPointerLock();
  if (walking) { walking = false; on('seatCard', false); on('joy', false); handRig.visible = true; stools.forEach(g => g.userData.tag.visible = false); }
  stopSteal(); state = 'menu'; renderLocs(); setPhase('busy'); oyster.visible = false; closeUmbrella(); on('umbBtn', false); on('medBtn', false); on('quitBtn', false); $('radioBtn').style.display = 'none'; document.getElementById('vign')?.classList.remove('on'); $('medList').classList.remove('show'); on('stealBtn', false); on('standBtn', false); on('lockHint', false);
  if (done) toast('出師了！去剝蚵仔賺錢吧～', '#9be37a');
  renderDaily(); $('overlay').classList.add('show');
}
setInterval(() => {
  if (!tut || state !== 'play') return; const st = TUT[tut.i];
  if (st.id === 'toss' && phase !== 'busy' && phase !== 'aim' && count === tut.c0 && missed > tut.b0) { toast('沒關係，再來一顆！', '#ffe080'); tutGo(0); return; }
  if (st.done?.()) tutGo(tut.i + 1);
}, 120);
$('tutNext').onclick = e => { e.stopPropagation(); if (!tut) return; const st = TUT[tut.i]; if (st.id === 'sit' && walking) sitDown(save.seat ?? 'door'); tutGo(tut.i + 1); };
$('tutSkip').onclick = e => { e.stopPropagation(); tutEnd(false); };
['tutNext', 'tutSkip'].forEach(id => $(id).addEventListener('pointerdown', e => e.stopPropagation()));
$('oTut').onclick = () => tutStart();
$('oRank').onclick = () => Social.open(); $('rRank').onclick = () => Social.open();
Social.init({ id: statsId, test: __PREVIEW__ || params.get('stattest') === '1', LS, nick: () => myName(), setNick: v => { const c = cleanName(v); save.name = c === '剝蚵人' ? undefined : c; persist(); drawName(); }, inTut: () => !!tut || !!SHOT, on: () => mix.feed && !SHOT, toast: t => toast(t, '#f2b705'),
  label: (k, i) => k === 'pearl' ? `剝到了${RAR[i]?.name ?? '珍珠'}！` : k === 'legend' ? `挖到傳說的「${ODD[i]?.name ?? '寶物'}」！` : k === 'odd' ? `開到「${ODD[i]?.name ?? '奇物'}」` : `解鎖了新地點 ${(LOCS[i]?.n ?? '').replace(/^\S+\s/, '')}！` });
Social.startPresence(() => state === 'play');
$('tutReplay').onclick = () => { $('settings').classList.remove('show'); if (state === 'play' && !tut && !confirm('這一班會放棄，確定要重看教學嗎？')) return; if (state === 'play' && !tut) { state = 'menu'; } tutStart(); };
(window as any).__oy = { get phase() { return phase; }, get umb() { return { held: umbHeld, t: umbT, vis: umb.visible }; }, get tut() { return tut && TUT[tut.i].id; }, needle: () => needle(), get pryW() { return pryW(); }, PRY_C, get hold() { return hold; }, PERF0, PERF1, seamErr: () => seamErr(), get walking() { return walking; }, get money() { return save.money; }, get state() { return state; }, bowlScr: () => { const v = BOWL.clone().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, nudge: (a: number, b: number) => { tYaw = clamp(tYaw + a, -yl(), yl()); tPitch = clamp(tPitch + b, P0, P1); }, basinScr: () => { const m = basinOy[0]; if (!m) return null; const v = worldOf(m).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, aimScr: () => { const v = aimPoint().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } };
// ---------- 截圖模式 ----------
if (SHOT) setTimeout(() => {
  startDay(); npcs.forEach((n, i) => { n.count = 5 + i * 3; n.throwCd = 999; });
  const look = (y: number, p: number) => { tYaw = yaw = y; tPitch = pitch = p; };
  const twistSetup = () => { diff = 2; setPhase('twist'); seamGlow.visible = false; progress = 0.6; tension = 0.5; strokeDir = 1; shellTop.rotation.z = -0.25; };
  if (SHOT === 'blood' || SHOT === 'aid') { if (SHOT === 'aid') mix.gore = false; later(0.3, () => { flinch = 0.6; bleed(16); hurt(15, '割到手了！'); }); }
  if (SHOT === 'npcblood' || SHOT === 'npcaid') { if (SHOT === 'npcaid') mix.gore = false; const n = npcs[0]; look(Math.atan2(-(worldOf(n.head).x - camera.position.x), -(worldOf(n.head).z - camera.position.z)), -0.2); later(0.2, () => npcHurt(n)); }
  if (SHOT === 'grudge') { look(0.15, -0.25); [30, 65, 100].forEach((g, i) => { npcs[i].grudge = g; grudgeUI(npcs[i]); }); npcs[2].angry = 99; say(npcs[2], '看我連環殼！', 99); }
  if (SHOT === 'reflect') { const n = npcs[2]; look(0.6, -0.3); n.windup = 0.25; later(0.62, () => { umbT = umbLen = 0.9; umb.visible = true; }); }
  if (SHOT === 'shop') { save.money = 600; save.shop.owned = ['basic', 'seam']; save.shop.equipped.knife = 'seam'; applyKnife(); renderShop(); $('shop').classList.add('show'); }
  if (SHOT === 'bowl') { save.shop.equipped.bowl = params.get('b') || 'steel'; applyBowl(); look(0.35, -0.75); }
  if (SHOT === 'seat') { applySeat(params.get('s') || 'corner'); goPick(); }
  if (SHOT === 'walk') { later(0.1, () => { standUp(); walkPos.set(-1.1, 1.55, -2.35); tYaw = yaw = 3.09; tPitch = pitch = -0.5; }); }
  if (SHOT === 'dex') { renderDex(); $('dex').classList.add('show'); }
  if (SHOT === 'sleeves') { save.money = 20000; const sid = params.get('s') || 'sl_dragon'; for (const id of ['sl_flower', sid, 'hd_crown', 'bd_vest', 'ft_gold']) save.shop.owned.push(id); setEquip('hand', sid); if (params.get('set')) { setEquip('head', 'hd_crown'); setEquip('body', 'bd_vest'); setEquip('feet', 'ft_gold'); } applySleeve(); { const of = params.get('outfit'); if (of) { for (const id of of.split(',')) { const e = EQUIP.find(q => q.id === id); if (e) { save.shop.owned.push(id); setEquip(e.slot, id); } } applySleeve(); } } if (params.get('p') === 'shop') { renderShop(); $('shop').classList.add('show'); } if (params.get('p') === 'eq') { eqPick = 'hand'; renderEquip(); $('equip').classList.add('show'); } if (params.get('tpv')) { for (const id of ['hd_hat', 'bd_rain', 'lg_rain', 'ft_boots']) { save.shop.owned.push(id); setEquip(EQUIP.find(e => e.id === id)!.slot, id); } setEquip('hand', 'sl_89'); applySleeve(); setTpv(true); if (params.get('tpv') === 'cheer') later(0.5, () => react3('cheer')); }
  if (params.get('p') === 'name') { save.name = undefined; save.namePrompted = 0; namePrompt(); } }
  if (SHOT === 'settings') $('settings').classList.add('show');
  if (SHOT === 'fb' || SHOT === 'fbdone') { openFb('settings'); if (SHOT === 'fbdone') fbShow(true); }
  if (SHOT === 'pick') look(-0.25, -0.85);
  if (SHOT === 'scoop') { look(0, -0.5); basinOy.forEach(m => scene.remove(m)); basinOy.length = 0; scoop(); }
  const shotHold = () => holdOyster(2);
  if (SHOT !== 'pick' && SHOT !== 'scoop' && SHOT !== 'end') shotHold();
  if (SHOT === 'seam') { diff = 2; seamGlow.visible = true; rot = 0.3; }
  if (SHOT === 'prytest') twistSetup();
  if (SHOT === 'pry') { twistSetup(); later(0.05, () => { needleStart = performance.now() - Math.acos(1 - 2 * PRY_C) / (Math.PI * 2 * PRY[2].sp) * 1000 - 20000 / PRY[2].sp * 0; progress = 0.5; pryFx(true, '✓ 2/4　連擊 x2'); gauge.classList.add('hitHold'); hint.textContent = HINTS.twist; }); }
  if (SHOT === 'twist') { twistSetup(); later(0.05, () => { tension = 0.5; }); }
  if (SHOT === 'crack') { twistSetup(); halfTwist(1.1); }
  if (SHOT === 'hitnpc') { look(0.1, -0.25); later(0.05, () => { const m = new THREE.Mesh(meatGeo, meatMat); scene.add(m); meatOnHead(npcs[1], m); }); }
  if (SHOT === 'steal') { const n = npcs[2]; look(0.62, -0.62); n.distract = 99; n.turnDir = -1; say(n, TURN_CHAT[0], 99); later(0.1, () => { startSteal(); }); }
  if (SHOT === 'caught') { const n = npcs[2]; look(0.62, -0.62); later(0.1, () => { stealNpc = null; caughtBy(n); }); }
  if (SHOT === 'crab') { setPhase('busy'); seamMark.visible = false; shellTop.visible = false; revealOdd(3); }
  if (SHOT === 'throw') { look(0.1, -0.3); setPhase('empty'); emptyT = 99; later(0.05, throwShell); }
  if (SHOT === 'warning') { look(-0.3, -0.5); windUp(npcs[2]); npcs[2].windup = 99; }
  if (SHOT === 'umbrella') { look(0.6, -0.3); windUp(npcs[2]); npcs[2].windup = 0.3; later(0.25, () => { umbT = umbLen = 0.9; umb.visible = true; }); later(0.6, () => { umbT = 0.6; }); }
  if (SHOT === 'harbor') look(0, -0.05);
  if (SHOT === 'end') { count = 38; opened = 47; missed = 9; abandoned = 3; perfects = 12; cracked = 4; steals = 3; caught = 1; meatHits = 2; shellHits = 4; thrown = 5; blocks = 3; reflects = 2; lost = 1; hitsTaken = 1; penalty = 28; dayPearls = [0]; dayOdd = [1]; endDay(); }
}, 0);
frame();

// 開始／結算畫面嘛會當開雜貨店、圖鑑、設定
for (const [b, t] of [['oShop', 'shopBtn'], ['oDex', 'dexBtn'], ['oSet', 'setBtn'], ['rDex', 'dexBtn'], ['rSet', 'setBtn']] as const) $(b).onclick = () => ($(t) as HTMLButtonElement).click();
// 所有可關閉面板：頂端懸浮標題＋右上角 ✕（手機、電腦都一樣）
for (const [pid, cid] of [['shop', 'shopClose'], ['dex', 'dexClose'], ['settings', 'setClose'], ['redeem', 'rdClose'], ['fb', 'fbClose'], ['lb', 'lbClose'], ['equip', 'eqClose'], ['nameAsk', 'naClose'], ['gift', 'giftClose'], ['paySum', 'psOk'], ['tagNote', 'tnOk']] as const) {
  const pn = $(pid), h = pn.querySelector('h2')!, bar = document.createElement('div'); bar.className = 'ph';
  pn.insertBefore(bar, h); bar.appendChild(h); const x = document.createElement('button'); x.className = 'px'; x.textContent = '✕'; x.setAttribute('aria-label', '關閉');
  x.onclick = () => ($(cid) as HTMLButtonElement).click(); bar.appendChild(x);
  // 共用外框：標題列以外的內容包進 .pb（統一 16px 內距）
  const body = document.createElement('div'); body.className = 'pb';
  while (bar.nextSibling) body.appendChild(bar.nextSibling);
  pn.appendChild(body); pn.classList.add('sheet');
}
// 共用暗色背板：有可關閉面板開著時蓋住主畫面按鈕，避免露出、誤點
{
  const bd = document.createElement('div'); bd.id = 'pbd'; document.body.appendChild(bd);
  ['pointerdown', 'pointerup', 'click', 'touchstart'].forEach(t => bd.addEventListener(t, e => { e.stopPropagation(); }, { passive: true }));
  const sync = () => bd.classList.toggle('show', !!document.querySelector('.panel.sheet.show'));
  const mo = new MutationObserver(sync); document.querySelectorAll('.panel.sheet').forEach(p => mo.observe(p, { attributes: true, attributeFilter: ['class'] })); sync();
}

const NPC_TIP: Record<string, string> = {
  '快手阿桃': '剝蚵仔最快，很少轉頭聊天，所以很難偷她的肉。想贏今日剝蚵冠軍，主要對手就是她。',
  '講話阿春': '很愛聊天，常常轉頭跟別人講話，是最好偷肉的對象；但偷太多次她會記仇。',
  '好奇阿嬌': '很好奇，常常偷看你在做什麼，偷她的肉比較容易被抓到，要等她確實轉頭再動手。',
};
function npcTip(n: Npc) {
  const g = Math.round(n.grudge ?? 0), lv = g >= 60 ? '😡 很生氣' : g >= 25 ? '😠 有點生氣' : '🙂 心情還好';
  let el = document.getElementById('npcTip'); if (!el) { el = document.createElement('div'); el.id = 'npcTip'; el.className = 'panel'; document.body.appendChild(el); el.addEventListener('pointerdown', e => { e.stopPropagation(); el!.classList.remove('show'); }); }
  el.innerHTML = `<h3>${n.name}</h3><p>${NPC_TIP[n.name] ?? ''}</p><p>怒氣：<b>${g}</b> / 100（${lv}）</p><ul>
<li><b>會讓她生氣</b>：用殼丟中她（+35，丟歪打中 +30）、偷她的肉（+12，被抓到再 +20）。</li>
<li><b>越生氣越常丟你</b>：怒氣越高，她丟殼的頻率越高、準備時間越短；怒氣到 90 會連丟 3 顆殼。</li>
<li><b>怎麼讓她消氣</b>：8 秒內不要再丟她或偷她，之後怒氣每秒降 2.5。<b>起來走動</b>時氣消得快：只要 2 秒、之後每秒降 7.5。</li>
<li><b>被丟的時候</b>：看到 ⚠ 就趕快按住 ☂ 雨傘擋（放開就收起來，撐傘時不能剝蚵）；連續擋下 3 次，阿婆們會暫時比較少丟。</li>
<li><b>真的被盯上</b>：可以「🚶 換位置」，換到比較不容易被丟中的位子。</li></ul><p style="opacity:.7;font-size:12px">點這裡關閉</p>`;
  el.classList.add('show');
}

// ---------- 兌換碼 ----------
function rewardText(d: RedeemCodeDef) {
  const r = d.reward, p: string[] = [];
  if (r.money) p.push(`$${r.money}`);
  for (const id of r.items ?? []) { const it = [...KNIVES, ...UMBS].find(x => x.id === id) as { n: string } | undefined; p.push(it ? it.n : id); }
  (r.pearls ?? []).forEach((n, i) => { if (n > 0 && RAR[i]) p.push(`${RAR[i].emo}${RAR[i].name}×${n}`); });
  for (const [k, n] of Object.entries(r.odd ?? {})) { const o = ODD[+k]; if (o && n > 0) p.push(`${o.emo}${o.name}×${n}`); }
  for (const [k, n] of Object.entries(r.meds ?? {})) { const m = MEDS.find(x => x.id === k); if (m && n > 0) p.push(`${m.emo}${m.n}×${n}`); }
  return p.join('、') || '（無）';
}
function rewardList(d: RedeemCodeDef) {
  const r = d.reward, li: string[] = [], row = (ic: string, t: string) => li.push(`<li><i class="ic ic-${ic}"></i> ${t}</li>`);
  if (r.money) row('coin', `工錢 $${r.money}`);
  if (r.trial) { const k = KNIVES.find(x => x.id === r.trial!.knife); if (k) row('knife', save.trial?.id === k.id ? `${k.n}（試用 ${r.trial.shifts} 班）` : `${k.n}（已擁有，改送等值工錢 $${TRIAL_REFUND}）`); }
  for (const id of r.items ?? []) { const it = [...KNIVES, ...UMBS].find(x => x.id === id); row('gift', it ? it.n : id); }
  for (const [k, n] of Object.entries(r.meds ?? {})) { const m = MEDS.find(x => x.id === k); if (m && n > 0) row('pill', `${m.n} ×${n}`); }
  for (const [k, n] of Object.entries(r.odd ?? {})) { const o = ODD[+k]; if (o && n > 0) row('book', `${o.name} ×${n}（已收進圖鑑）`); }
  (r.pearls ?? []).forEach((n, i) => { if (n > 0 && RAR[i]) row('pearl', `${RAR[i].name} ×${n}`); });
  return `<div class="rdGot"><b><i class="ic ic-gift"></i> 兌換成功${d.label ? `・${d.label}` : ''}</b><ul>${li.join('')}</ul></div>`;
}
const TRIAL_REFUND = 100;
function tickTrial() {
  const t = save.trial; if (!t) return;
  t.left--; if (t.left > 0) { setTimeout(() => toast(`${KNIVES.find(k => k.id === t.id)?.n ?? '試用刀'}試用剩 ${t.left} 班`, '#ffd76a'), 400); return; }
  delete save.trial; save.shop.owned = save.shop.owned.filter(x => x !== t.id);
  if (save.shop.equipped.knife === t.id) { save.shop.equipped.knife = 'basic'; applyKnife(); }
  setTimeout(() => toast('試用刀到期，已換回舊蚵刀；喜歡的話可以到雜貨店買斷', '#ffd76a'), 400);
}
function grant(d: RedeemCodeDef) {
  const r = d.reward;
  if (r.money) save.money += Math.max(0, Math.floor(r.money));
  for (const id of r.items ?? []) if (!save.shop.owned.includes(id)) save.shop.owned.push(id);
  (r.pearls ?? []).forEach((n, i) => { if (i < save.dex.length) save.dex[i] += Math.max(0, Math.floor(n)); });
  for (const [k, n] of Object.entries(r.odd ?? {})) if (+k < save.odd.length) save.odd[+k] += Math.max(0, Math.floor(n));
  for (const [k, n] of Object.entries(r.meds ?? {})) if (MEDS.some(m => m.id === k)) save.meds[k] = (save.meds[k] ?? 0) + Math.max(0, Math.floor(n));
  if (r.trial) { const k = KNIVES.find(x => x.id === r.trial!.knife); if (k) { if (save.shop.owned.includes(k.id)) save.money += TRIAL_REFUND; else { save.shop.owned.push(k.id); save.trial = { id: k.id, left: Math.max(1, r.trial.shifts) }; save.shop.equipped.knife = k.id; applyKnife(); } } }
  save.redeemed.push(d.id); persist();
}
{
  const msg = $('rdMsg'), inp = $('rdInput') as HTMLInputElement, sub = $('rdSubmit') as HTMLButtonElement;
  const open = () => { if (document.pointerLockElement) document.exitPointerLock(); msg.textContent = ''; msg.className = ''; inp.value = ''; $('redeem').classList.add('show'); setTimeout(() => inp.focus(), 50); };
  $('oRedeem').onclick = open; $('setRedeem').onclick = open;
  $('rdClose').onclick = () => { $('redeem').classList.remove('show'); inp.blur(); };
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true; sub.disabled = true;
    try {
      const res = await checkCode(inp.value, save.redeemed);
      if (!res.ok) { msg.textContent = REDEEM_MESSAGES[res.reason]; msg.className = 'bad'; return; }
      grant(res.def); msg.innerHTML = rewardList(res.def); msg.className = 'ok'; inp.value = '';
      track('redeem', { item: res.def.id }); if (ac) SFX.jingle(); try { renderDex(); } catch { }
    } finally { busy = false; sub.disabled = false; }
  };
  sub.onclick = go; inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}

// ---------- 💊 藥品（消耗品，一工內有效）----------
type MedKey = 'green' | 'speed' | 'slip' | 'dmg' | 'regen' | 'grudge';
type Med = { id: string; n: string; emo: string; price: number; dur: number; m?: Partial<Record<MedKey, number>>; luck?: number; heal?: number; good: string; bad: string };
const MEDS: Med[] = [
  { id: 'tonic', n: '阿伯提神補酒', emo: '🍾', price: 40, dur: 60, m: { green: 1.25, slip: 1.5 }, good: '綠區 +25%', bad: '手會抖，割手率 +50%' },
  { id: 'oil', n: '綠色風油精', emo: '🧴', price: 30, dur: 60, m: { speed: 0.75 }, luck: -1, good: '指針速度 -25%（比較穩）', bad: '薰到眼睛，幸運 -1' },
  { id: 'patch', n: '痠痛貼布', emo: '🩹', price: 25, dur: 90, m: { dmg: 0.5, regen: 3, speed: 1.1 }, good: '受到的傷害減半、手痛恢復 3 倍', bad: '手腕貼太緊，指針速度 +10%' },
  { id: 'soup', n: '轉運雞精', emo: '🍵', price: 80, dur: 60, m: { green: 0.85 }, luck: 2, good: '幸運 +2（比較容易開到珍珠奇物）', bad: '補過頭有點暈，綠區 -15%' },
  { id: 'okb', n: 'OK繃', emo: '🩹', price: 15, dur: 0, heal: 25, good: '立刻補 25 點手的體力', bad: '只是包起來，沒有持續效果' },
  { id: 'sweet', n: '古早味糖果', emo: '🍬', price: 35, dur: 0, good: '送給最生氣的阿婆，她的怒氣立刻 -40', bad: '只有一位阿婆有份' },
  { id: 'salt', n: '粗鹽', emo: '🧂', price: 25, dur: 0, good: '下一顆蚵仔一定是易或普通', bad: '只對下一顆有效' },
  { id: 'candy', n: '潤喉糖', emo: '🍬', price: 20, dur: 90, m: { grudge: 0.5, regen: 0.5 }, good: '跟阿婆有說有笑，怒氣增加減半', bad: '只顧講話，手痛恢復變慢一半' },
];
const medT: Record<string, number> = {};
const medOn = () => MEDS.filter(m => (medT[m.id] ?? 0) > 0);
function medM(k: MedKey) { let v = 1; for (const m of medOn()) v *= m.m?.[k] ?? 1; return v; }
function medA(_k: 'luck') { let v = 0; for (const m of medOn()) v += m.luck ?? 0; return v; }
let medDrawT = 0;
function tickMeds(dt: number) { let ch = false; for (const k in medT) { const was = medT[k] > 0; medT[k] = Math.max(0, medT[k] - dt); if (was && medT[k] <= 0) { ch = true; const m = MEDS.find(x => x.id === k); if (m) toast(`${m.emo}${m.n} 效果結束了`, '#cfc3ff'); } } medDrawT -= dt; if (ch || medDrawT <= 0) { medDrawT = 1; drawMeds(); } }
function drawMeds() {
  const el = document.getElementById('medAct'); if (el) el.innerHTML = medOn().map(m => `<span>${m.emo}${Math.ceil(medT[m.id])}s</span>`).join('') + (saltNext ? '<span>🧂下一粒</span>' : '');
  const n = MEDS.reduce((a, m) => a + (save.meds[m.id] ?? 0), 0); const b = document.getElementById('medBtn'); if (b) { b.innerHTML = (n ? `<i class="ic ic-pill"></i> 藥品 ×${n}` : '<i class="ic ic-pill"></i> 藥品') + '<span class="key"> (M)</span>' + (n ? '' : '<small>去雜貨店買藥</small>'); b.classList.toggle('empty', !n); }
  const L = document.getElementById('medList'); if (L && L.classList.contains('show')) renderMedList();
}
function useMed(id: string) {
  const m = MEDS.find(x => x.id === id); if (!m || state !== 'play' || tut || !(save.meds[id] > 0)) return;
  let who = '';
  if (id === 'sweet') { const t = npcs.reduce((a, b) => ((b.grudge ?? 0) > (a.grudge ?? 0) ? b : a)); if ((t.grudge ?? 0) < 1) { toast('阿婆們現在都不生氣，糖果先留著', '#cfc3ff'); return; } t.grudge = Math.max(0, (t.grudge ?? 0) - 40); t.calm = Math.max(t.calm ?? 0, 3); grudgeUI(t); say(t, '哎唷，古早味！好啦不跟你計較', 2.6); who = `（給${t.name}）`; }
  if (id === 'salt') { if (saltNext) { toast('粗鹽已經用了，等下一顆', '#cfc3ff'); return; } saltNext = true; }
  save.meds[id]--; persist(); if (m.heal) { hp = Math.min(100, hp + m.heal); updHud(); } if (m.dur) medT[id] = (medT[id] ?? 0) + m.dur; track('use', { item: id }); toast(`${m.emo}使用${m.n}${who}：${m.good}；${m.bad}${m.dur ? `（${m.dur} 秒）` : ''}`, '#cfc3ff'); if (ac) SFX.pop(); drawMeds();
}
function renderMedList() {
  const L = $('medList'); const own = MEDS.filter(m => (save.meds[m.id] ?? 0) > 0);
  L.innerHTML = own.length ? own.map((m, i) => `<button data-use="${m.id}"><span class="key">${i + 1}. </span>${m.emo} ${m.n} ×${save.meds[m.id]}<small>${m.good}／${m.bad}${m.dur ? `・${m.dur} 秒` : "・立即"}${medT[m.id] > 0 ? `（剩 ${Math.ceil(medT[m.id])}s，再用會延長）` : ''}</small></button>`).join('') : '<p>身上沒有藥品，去雜貨店的「💊 藥品」買吧</p>';
  L.querySelectorAll('button[data-use]').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); useMed(b.getAttribute('data-use')!); renderMedList(); }));
}
{
  const b = $('medBtn'), L = $('medList');
  b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); L.classList.toggle('show'); if (L.classList.contains('show')) renderMedList(); });
  L.addEventListener('pointerdown', e => e.stopPropagation());
  window.addEventListener('pointerdown', e => { if (!(e.target as HTMLElement).closest?.('#medList,#medBtn')) L.classList.remove('show'); });
  drawMeds();
}
function renderMedShop() {
  $('shopList').insertAdjacentHTML('beforeend', `<h3><i class="ic ic-pill"></i> 藥品</h3><p style="font-size:12px;opacity:.8">消耗品：上工時按「💊 藥品」使用，效果持續幾秒，同一種再用會延長時間；收工後效果消失，沒用完的會留著。</p><table class="kt"><tr><th>藥品</th><th>好處</th><th>代價</th><th>時間</th><th>持有</th><th></th></tr>` + MEDS.map(m => `<tr><td><b>${m.emo} ${m.n}</b></td><td style="color:#9be37a">${m.good}</td><td style="color:#ff8a7a">${m.bad}</td><td>${m.dur ? `${m.dur}s` : "立即"}</td><td>${save.meds[m.id] ?? 0}</td><td><button data-mbuy="${m.id}" ${save.money < m.price ? 'disabled' : ''}>$${m.price}</button></td></tr>`).join('') + '</table>');
  $('shopList').querySelectorAll('button[data-mbuy]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const m = MEDS.find(x => x.id === b.getAttribute('data-mbuy'))!; if (save.money < m.price) return;
    save.money -= m.price; save.meds[m.id] = (save.meds[m.id] ?? 0) + 1; persist(); track('buy', { item: 'med-' + m.id, price: m.price }); if (ac) SFX.jingle(); renderShop(); drawMeds();
  });
}
// ---------- 裝備（頭／手／衣服／褲子／鞋子）----------
type Slot = 'head' | 'hand' | 'body' | 'legs' | 'feet';
type Fx = { bowl?: number; keep?: number; speed?: number; pearl?: number; nag?: number; throw?: number; dmg?: number; luck?: number };
type Eq = { id: string; slot: Slot; n: string; price: number; eff: string; base: string; pat: string; fx: Fx };
const SLOTS: [Slot, string][] = [['head', '頭'], ['hand', '手'], ['body', '衣服'], ['legs', '褲子'], ['feet', '鞋子']];
const EQUIP: Eq[] = [
  { slot: 'head', id: 'hd_basic', n: '花布頭巾', price: 0, eff: '基本款', base: '#c84a5a', pat: 'flower', fx: {} },
  { slot: 'head', id: 'hd_hat', n: '斗笠', price: 3000, eff: '殼比較難砸到臉，被丟殼的機率 -10%', base: '#d8b46a', pat: 'plain', fx: { throw: 0.9 } },
  { slot: 'head', id: 'hd_fisher', n: '漁夫帽', price: 9000, eff: '帽簷壓低，阿婆唸你的機率 -10%', base: '#4a6a8a', pat: 'plain', fx: { nag: 0.9 } },
  { slot: 'head', id: 'hd_helmet', n: '工地安全帽', price: 20000, eff: '受到的傷害 -15%', base: '#ffb21a', pat: 'plain', fx: { dmg: 0.85 } },
  { slot: 'head', id: 'hd_crown', n: '廟會金冠', price: 60000, eff: '珍珠率 +5%', base: '#e8b830', pat: 'dragon', fx: { pearl: 1.05 } },
  { slot: 'hand', id: 'hn_basic', n: '素色袖套', price: 0, eff: '基本款', base: '#3a5a8a', pat: 'plain', fx: {} },
  { slot: 'hand', id: 'sl_flower', n: '碎花袖套', price: 3000, eff: '每碗多拿 $1', base: '#e86a8a', pat: 'flower', fx: { bowl: 1 } },
  { slot: 'hand', id: 'sl_rain', n: '防水雨衣袖套', price: 8000, eff: '翹殼沒中的懲罰減半（一半機率保住連擊）', base: '#ffd21a', pat: 'rain', fx: { keep: 0.5 } },
  { slot: 'hand', id: 'sl_89', n: '89包手袖套', price: 8989, eff: '刺青太兇，阿婆主動丟殼的機率剩 ×0.2，旁邊的人會小聲議論', base: '#d9a77a', pat: 'tattoo', fx: { throw: 0.2 } },
  { slot: 'hand', id: 'sl_camo', n: '迷彩袖套', price: 15000, eff: '比較不顯眼，阿婆唸你、干擾的機率 -30%', base: '#5a6b3a', pat: 'camo', fx: { nag: 0.7 } },
  { slot: 'hand', id: 'sl_neon', n: '螢光運動袖套', price: 30000, eff: '翹殼指針慢 5%', base: '#39ff9a', pat: 'neon', fx: { speed: 0.95 } },
  { slot: 'hand', id: 'sl_dragon', n: '金線刺繡龍袖套', price: 80000, eff: '珍珠率 +8%，開到珍珠手臂閃金光', base: '#8a1420', pat: 'dragon', fx: { pearl: 1.08 } },
  { slot: 'body', id: 'bd_basic', n: '舊 T 恤', price: 0, eff: '基本款', base: '#e8e4d8', pat: 'plain', fx: {} },
  { slot: 'body', id: 'bd_rain', n: '雨衣', price: 5000, eff: '受到的傷害 -10%', base: '#ffd21a', pat: 'rain', fx: { dmg: 0.9 } },
  { slot: 'body', id: 'bd_vest', n: '廟會背心', price: 15000, eff: '每碗多拿 $1', base: '#c82a2a', pat: 'plain', fx: { bowl: 1 } },
  { slot: 'body', id: 'bd_boss', n: '漁港老大夾克', price: 40000, eff: '氣場夠，被丟殼的機率 -20%', base: '#1e2a3a', pat: 'tattoo', fx: { throw: 0.8 } },
  { slot: 'body', id: 'bd_sequin', n: '亮片表演服', price: 70000, eff: '幸運 +1（比較會開到珍珠、奇物）', base: '#b84ad8', pat: 'neon', fx: { luck: 1 } },
  { slot: 'legs', id: 'lg_basic', n: '工作褲', price: 0, eff: '基本款', base: '#4a4a52', pat: 'plain', fx: {} },
  { slot: 'legs', id: 'lg_rain', n: '雨褲', price: 4000, eff: '受到的傷害 -10%', base: '#ffd21a', pat: 'rain', fx: { dmg: 0.9 } },
  { slot: 'legs', id: 'lg_flower', n: '花褲', price: 12000, eff: '每碗多拿 $1', base: '#e86a8a', pat: 'flower', fx: { bowl: 1 } },
  { slot: 'legs', id: 'lg_camo', n: '迷彩褲', price: 25000, eff: '阿婆唸你的機率 -15%', base: '#5a6b3a', pat: 'camo', fx: { nag: 0.85 } },
  { slot: 'feet', id: 'ft_basic', n: '藍白拖', price: 0, eff: '基本款', base: '#2a5ab0', pat: 'plain', fx: {} },
  { slot: 'feet', id: 'ft_boots', n: '雨鞋', price: 3000, eff: '站得穩，翹殼沒中有兩成機率保住連擊', base: '#ffd21a', pat: 'plain', fx: { keep: 0.2 } },
  { slot: 'feet', id: 'ft_work', n: '工作靴', price: 18000, eff: '翹殼指針慢 3%', base: '#6a4a2a', pat: 'plain', fx: { speed: 0.97 } },
  { slot: 'feet', id: 'ft_gold', n: '金色拖鞋', price: 50000, eff: '珍珠率 +4%', base: '#e8b830', pat: 'plain', fx: { pearl: 1.04 } },
];
const SETS: { id: string; n: string; need: string[]; eff: string; fx: Fx }[] = [
  { id: 'typhoon', n: '颱風天套', need: ['hd_hat', 'bd_rain', 'lg_rain', 'ft_boots'], eff: '被丟殼的機率再 -30%、受到的傷害再 -10%', fx: { throw: 0.7, dmg: 0.9 } },
  { id: 'temple', n: '廟會套', need: ['hd_crown', 'bd_vest', 'sl_dragon', 'ft_gold'], eff: '珍珠率再 +5%、每碗再多 $2', fx: { pearl: 1.05, bowl: 2 } },
  { id: 'army', n: '迷彩套', need: ['hd_helmet', 'sl_camo', 'lg_camo', 'ft_work'], eff: '阿婆唸你的機率再 -30%', fx: { nag: 0.7 } },
];
const eqOwned = (id: string) => (EQUIP.find(e => e.id === id)?.price === 0) || save.shop.owned.includes(id);
const setEquip = (slot: Slot, id: string) => { save.equip = save.equip ?? {}; save.equip[slot] = id; };
const equipNow = (slot: Slot) => EQUIP.find(e => e.slot === slot && e.id === save.equip?.[slot] && eqOwned(e.id)) ?? EQUIP.find(e => e.slot === slot && e.price === 0)!;
const wornIds = () => SLOTS.map(([s]) => equipNow(s).id);
const setsOn = () => { const w = wornIds(); return SETS.filter(s => s.need.every(i => w.includes(i))); };
const slOn = (id: string) => wornIds().includes(id);
function fxAll(): Required<Fx> {
  const r = { bowl: 0, keep: 0, speed: 1, pearl: 1, nag: 1, throw: 1, dmg: 1, luck: 0 };
  for (const f of [...SLOTS.map(([s]) => equipNow(s).fx), ...setsOn().map(s => s.fx)]) { r.bowl += f.bowl ?? 0; r.keep += f.keep ?? 0; r.luck += f.luck ?? 0; r.speed *= f.speed ?? 1; r.pearl *= f.pearl ?? 1; r.nag *= f.nag ?? 1; r.throw *= f.throw ?? 1; r.dmg *= f.dmg ?? 1; }
  r.keep = Math.min(0.7, r.keep); r.throw = Math.max(0.1, r.throw); return r;
}
function migrateEquip() { save.equip = save.equip ?? {}; for (const [s] of SLOTS) if (!save.equip[s] || !eqOwned(save.equip[s])) save.equip[s] = EQUIP.find(e => e.slot === s && e.price === 0)!.id; }
let sleeveTry: string | null = null, scaredT = 10;
const SCARED = ['這個人看起來很流氓…', '不要惹那位', '手上那個刺青…你敢丟殼你丟', '小聲點，那個人在看', '我剛剛什麼都沒說喔', '那個刺青是真的嗎…', '今天大家安靜剝蚵就好', '殼不要往那邊丟啦', '那位是哪個角頭的…', '好啦好啦，我專心剝', '這位做的鐵板燒一定很好吃'];
function patDraw(g: CanvasRenderingContext2D, e: Eq, W: number, H: number) {
  g.fillStyle = e.base; g.fillRect(0, 0, W, H);
  const dot = (x: number, y: number, r: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  if (e.pat === 'flower') for (let i = 0; i < 40; i++) { const x = (i * 37) % W, y = (i * 53) % H; for (let k = 0; k < 5; k++) dot(x + Math.cos(k * 1.26) * 5, y + Math.sin(k * 1.26) * 5, 3, '#fff3c8'); dot(x, y, 2.5, '#3a8a4a'); }
  if (e.pat === 'rain') { g.strokeStyle = '#fff7a0'; g.lineWidth = 3; for (let y = 10; y < H; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
  if (e.pat === 'camo') for (let i = 0; i < 30; i++) dot((i * 41) % W, (i * 29) % H, 8 + (i % 3) * 4, ['#2e3a1e', '#8a7a4a', '#3e5228'][i % 3]);
  if (e.pat === 'neon') { g.fillStyle = '#ffffff'; for (let y = 20; y < H; y += 40) g.fillRect(0, y, W, 6); }
  if (e.pat === 'tattoo') { g.strokeStyle = '#1e2a4a'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(W / 2, H + 12 - i * 22, 40, Math.PI, 2 * Math.PI); g.stroke(); } dot(40, 40, 9, '#b8323a'); dot(90, 80, 9, '#2a5a9a'); }
  if (e.pat === 'dragon') { g.strokeStyle = '#ffd25a'; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, H / 2 + Math.sin(x / 10) * 26); g.stroke(); }
}
function eqTex(e: Eq) { const c = document.createElement('canvas'); c.width = c.height = 128; patDraw(c.getContext('2d')!, e, 128, 128); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); return t; }
function applySleeve() {
  const s = sleeveTry ? EQUIP.find(x => x.id === sleeveTry)! : equipNow('hand');
  sleeve.map?.dispose(); sleeve.map = eqTex(s); sleeve.color.set(0xffffff);
  sleeve.emissive.set(s.pat === 'neon' ? 0x1a8a50 : 0x000000); sleeve.needsUpdate = true;
  shirtCuff.color.set(equipNow('body').base);
}
function sleeveGold() { if (!slOn('sl_dragon')) return; let k = 0; const iv = setInterval(() => { sleeve.emissive.set(k % 2 ? 0x000000 : 0xb08010); if (++k > 8) { clearInterval(iv); sleeve.emissive.set(0); } }, 150); }
// 線條圖示：各部位一個簡單輪廓，填該件顏色
let eqSvgN = 0;
function eqSvg(e: Eq, w = 72, grey = false) {
  const s = '#1b1b1b', f = grey ? '#a8a8a8' : e.base;
  const P: Record<Slot, string> = {
    head: `<path d="M10 40Q36 6 62 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M6 40H66" stroke="${s}" stroke-width="2.5"/>`,
    hand: `<rect x="6" y="18" width="44" height="22" rx="8" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    body: `<path d="M22 10L8 20l6 10 6-4v30h32V26l6 4 6-10-14-10-6 6h-16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    legs: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    feet: `<path d="M10 40q0-14 16-14h14q16 4 22 14v6H10Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>` };
  const ID: Record<string, string> = {
    sl_flower: `<defs><clipPath id="c_sl_flower"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_flower)"><g transform="translate(14 24)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(26 33)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(38 23)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(46 34)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(10 36)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><g transform="translate(32 28)"><circle r="2.6" fill="#fff3c8"/><circle r="1" fill="#f0c020"/></g><path d="M18 30l3-2M42 29l3 2M30 37l3-1" stroke="#3a8a4a" stroke-width="1.5"/></g><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_rain: `<defs><clipPath id="c_sl_rain"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_rain)"><path d="M12 22q12-3 28 0" stroke="#fff8c8" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 26v10M34 26v10" stroke="#c8a010" stroke-width="1.2"/><path d="M14 30q2 3 0 5" stroke="#5aa8e8" stroke-width="1.6" fill="none"/></g><path d="M44 18v22" stroke="${s}" stroke-width="2"/><path d="M46 19v20" stroke="#c8a010" stroke-width="1"/><path d="M48 19v20" stroke="#c8a010" stroke-width="1"/><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_89: `<defs><clipPath id="c_sl_89"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="#e8b890"/><g clip-path="url(#c_sl_89)"><path d="M6 34q5-4 10 0t10 0t10 0t10 0V40H6Z" fill="#2a4a8a" stroke="${s}" stroke-width="1.2"/><path d="M9 34q2-3 4 0M21 34q2-3 4 0M33 34q2-3 4 0" stroke="#fff" stroke-width="1" fill="none"/><path d="M18 26q6-6 12 0q-6 6-12 0Z" fill="#e8501a" stroke="${s}" stroke-width="1.2"/><path d="M30 26l5-3v6Z" fill="#e8501a" stroke="${s}" stroke-width="1.2"/><circle cx="21" cy="25.5" r=".8" fill="${s}"/><path d="M36 21q3-3 6 0q3-2 5 1" stroke="${s}" stroke-width="1.3" fill="none"/><path d="M8 22q3-3 6 0" stroke="${s}" stroke-width="1.3" fill="none"/></g><rect x="6" y="18" width="5" height="22" fill="#3a5a8a"/><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_camo: `<defs><clipPath id="c_sl_camo"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_camo)"><path d="M6 22q6-4 10 0t6 6q-6 4-10 0Z" fill="#8a7a4a"/><path d="M24 30q6-4 12 0t4 8H22Z" fill="#2e3a1e"/><path d="M34 18q6 2 8 6t-6 4q-4-2-2-10Z" fill="#2e3a1e"/><path d="M10 34q4-2 8 2l-2 4H8Z" fill="#2e3a1e"/><path d="M40 32q4-2 8 0v6q-6 0-8-6Z" fill="#8a7a4a"/></g><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    sl_neon: `<defs><clipPath id="c_sl_neon"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_neon)"><rect x="6" y="27" width="44" height="5" fill="#e8f0f0" stroke="${s}" stroke-width="1"/><path d="M12 27l3 5M20 27l3 5M28 27l3 5M36 27l3 5" stroke="#9ab" stroke-width="1"/><path d="M10 22h14" stroke="#c8ffe0" stroke-width="2" stroke-linecap="round"/></g><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/><path d="M2 24l-3-2M2 30h-4M2 36l-3 2" stroke="#39ff9a" stroke-width="1.6" stroke-linecap="round"/>`,
    sl_dragon: `<defs><clipPath id="c_sl_dragon"><rect x="6" y="18" width="44" height="22" rx="8"/></clipPath></defs><rect x="6" y="18" width="44" height="22" rx="8" fill="${f}"/><g clip-path="url(#c_sl_dragon)"><path d="M8 33q6-10 12-2t12-2t10-6" stroke="#e8b830" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M8 33q6-10 12-2t12-2t10-6" stroke="#fff3a8" stroke-width=".7" fill="none" stroke-dasharray="1.5 1.5"/><path d="M14 30l-1-3M20 31l1-3M26 32l-1-3M32 29l1-3" stroke="#e8b830" stroke-width="1.2"/><path d="M42 23l5-2-1 4l2 2-5 1Z" fill="#e8b830" stroke="#fff3a8" stroke-width=".6"/><circle cx="44" cy="23.5" r=".8" fill="#c82a2a"/><path d="M47 21l2-3M46 26q3 1 2 4" stroke="#e8b830" stroke-width="1" fill="none"/><path d="M10 22q2-2 4 0M36 37q2-2 4 0" stroke="#e8b830" stroke-width="1" fill="none"/></g><path d="M6 20h44M6 38h44" stroke="#e8b830" stroke-width="1" stroke-dasharray="2 2"/><rect x="6" y="18" width="44" height="22" rx="8" fill="none" stroke="${s}" stroke-width="2.5"/><path d="M50 22h10a7 7 0 0 1 0 14H50" fill="#e8b890" stroke="${s}" stroke-width="2.5"/>`,
    hd_basic: `<path d="M14 40Q36 8 58 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M56 36l10 10-4 4-8-8" fill="${f}" stroke="${s}" stroke-width="2.5"/><circle cx="28" cy="30" r="2.5" fill="#fff3c8"/><circle cx="42" cy="26" r="2.5" fill="#fff3c8"/>`,
    hd_hat: `<path d="M4 44L36 10L68 44Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 36H52M28 26H44" stroke="${s}" stroke-width="1.5"/>`,
    hd_fisher: `<path d="M20 36V20Q36 10 52 20V36Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M8 44L20 36H52L64 44Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    hd_helmet: `<path d="M14 40Q14 12 36 12Q58 12 58 40Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M8 40H64V46H8Z" fill="${f}" stroke="${s}" stroke-width="2.5"/><path d="M36 12V40" stroke="${s}" stroke-width="2"/>`,
    hd_crown: `<path d="M10 46L14 18L26 32L36 12L46 32L58 18L62 46Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="36" cy="38" r="4" fill="#c82a2a" stroke="${s}" stroke-width="1.5"/>`,
    bd_vest: `<path d="M22 10L14 20v36h16V22l6 6 6-6v34h16V20L50 10l-8 8h-12Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    bd_rain: `<path d="M24 8L8 22l6 8 6-4v32h32V26l6 4 6-8L48 8l-12 10Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M36 18V58" stroke="${s}" stroke-width="2"/>`,
    ft_boots: `<path d="M18 8h18v28q16 2 22 10v6H18Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`,
    ft_work: `<path d="M16 18h20v14q18 2 22 12v8H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 24h10M22 30h10" stroke="#e8d8a8" stroke-width="2"/>`,
    lg_flower: `<path d="M20 8h32l4 50H40l-4-30-4 30H16Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="26" cy="22" r="3" fill="#fff3c8"/><circle cx="46" cy="36" r="3" fill="#fff3c8"/>` };
  // iOS WebKit：多個同名 clipPath id 會解析到第一個（可能在隱藏元素裡），每個實例改用唯一 id
  const u = `_${++eqSvgN}`;
  let body = (ID[e.id] ?? P[e.slot]).replace(/id="(c_[a-z0-9_]+)"/g, `id="$1${u}"`).replace(/url\(#(c_[a-z0-9_]+)\)/g, `url(#$1${u})`);
  if (grey) body = body.replace(/fill="#(?!a8a8a8)[0-9a-fA-F]{3,6}"/g, 'fill="#c4c4c4"');
  return `<svg class="slv" viewBox="0 0 72 60" width="${w}" height="${w * 60 / 72}">${body}</svg>`;
}
// 全身人形（裝備面板與分享卡共用的配色）
function figSvg() {
  const k = '#1b1b1b', SK = '#e8b890', H = equipNow('head'), A = equipNow('hand'), B = equipNow('body'), L = equipNow('legs'), F = equipNow('feet');
  const ol = `stroke="${k}" stroke-width="3" stroke-linejoin="round"`;
  // 圖樣：每個人形只出現一次，id 固定
  const fl = (id: string, c: string) => `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="${c}"/><g fill="#fff3c8"><circle cx="4" cy="4" r="1.8"/><circle cx="7" cy="4" r="1.8"/><circle cx="5.5" cy="1.6" r="1.8"/><circle cx="5.5" cy="6.4" r="1.8"/></g><circle cx="5.5" cy="4" r="1.2" fill="#3a8a4a"/><circle cx="11" cy="11" r="1.5" fill="#fff3c8"/></pattern>`;
  const defs = `<defs>
${fl('pFlower', '#e86a8a')}${fl('pFlowerR', '#c84a5a')}
<pattern id="pCamo" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#5a6b3a"/><path d="M2 6q6-6 12 0t8 8q-6 4-12 0T2 6Z" fill="#2e3a1e"/><path d="M16 20q6-4 10 2t-4 6q-8 0-6-8Z" fill="#8a7a4a"/><circle cx="24" cy="6" r="3.5" fill="#3e5228"/></pattern>
<pattern id="pNeon" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(70)"><rect width="10" height="10" fill="#39ff9a"/><rect width="10" height="3" fill="#fff"/></pattern>
<pattern id="pSeq" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#b84ad8"/><circle cx="2" cy="2" r="1.6" fill="#f0c8ff"/><circle cx="6" cy="6" r="1.6" fill="#ffd8f8"/></pattern>
<pattern id="pTat" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${SK}"/><path d="M0 12q4-8 8 0t8 0" stroke="#1e2a4a" stroke-width="1.6" fill="none"/><circle cx="12" cy="4" r="2" fill="#b8323a"/></pattern>
</defs>`;
  void 0;
  const PF: Record<string, string> = { flower: 'url(#pFlower)', camo: 'url(#pCamo)', neon: 'url(#pNeon)', tattoo: 'url(#pTat)' };
  // ---- 手臂（在衣服後面）：肩到腕，手在末端 ----
  const armFill = A.id === 'sl_flower' ? 'url(#pFlower)' : A.id === 'sl_camo' ? 'url(#pCamo)' : A.id === 'sl_neon' ? 'url(#pNeon)' : A.id === 'sl_89' ? 'url(#pTat)' : A.base;
  const arm = (x1: number, x2: number) => { const d = `M${x1} 100L${x2} 160`, dx = x2 - x1, len = Math.hypot(dx, 60), nx = -60 / len, ny = dx / len;
    let ex = '';
    if (A.id === 'sl_rain') ex = `<path d="M${x1 + nx * 3} ${100 + ny * 3}L${x2 + nx * 3} ${160 + ny * 3}" stroke="#fffbe0" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>`;
    if (A.id === 'sl_dragon') { let p = ''; for (let i = 0; i <= 10; i++) { const t = i / 10, o = Math.sin(i * 1.6) * 4; p += `${i ? 'L' : 'M'}${(x1 + dx * t + nx * o).toFixed(1)} ${(100 + 60 * t + ny * o).toFixed(1)}`; } ex = `<path d="${p}" stroke="#ffd25a" stroke-width="2" fill="none"/><circle cx="${x1 + dx * 0.2}" cy="112" r="2.2" fill="#ffd25a"/>`; }
    if (A.id === 'sl_89') ex = `<path d="M${x1} 100L${x2} 160" stroke="#1e2a4a" stroke-width="1" stroke-dasharray="3 4" fill="none"/>`;
    return `<path d="${d}" stroke="${k}" stroke-width="20" stroke-linecap="round"/><path d="${d}" stroke="${armFill}" stroke-width="14" stroke-linecap="round"/>${ex}<path d="M${x2 - 7} 158h14" stroke="${k}" stroke-width="2"/><circle cx="${x2 + (x2 < 80 ? -1 : 1)}" cy="170" r="9" fill="${SK}" stroke="${k}" stroke-width="3"/>`; };
  // ---- 衣服 ----
  const T = 'M50 90h60l10 20-10 6-2-4v70H52v-70l-2 4-10-6Z';
  const body: Record<string, string> = {
    bd_basic: `<path d="${T}" fill="#e8e4d8" ${ol}/><path d="M70 90q10 10 20 0" fill="none" stroke="${k}" stroke-width="2"/><ellipse cx="80" cy="130" rx="12" ry="8" fill="#9a9488" stroke="${k}" stroke-width="2"/><path d="M70 130q10-6 20 0" stroke="#e8e4d8" stroke-width="1.5" fill="none"/>`,
    bd_rain: `<path d="${T}" fill="#ffd21a" ${ol}/><path d="M80 92V182" stroke="${k}" stroke-width="2"/>${[110, 130, 150, 170].map(y => `<circle cx="80" cy="${y}" r="2.5" fill="#fff" stroke="${k}" stroke-width="1.5"/>`).join('')}<path d="M56 100l4 70" stroke="#fffbe0" stroke-width="3" opacity=".8"/>`,
    bd_vest: `<path d="${T}" fill="#f2efe4" ${ol}/><path d="M52 92h18l-2 90H52Z M108 92H90l2 90h16Z" fill="#c82a2a" stroke="${k}" stroke-width="2.5" stroke-linejoin="round"/><path d="M70 92l-2 90M90 92l2 90" stroke="#ffd25a" stroke-width="3"/><path d="M56 150h8M96 150h8" stroke="#ffd25a" stroke-width="2"/>`,
    bd_boss: `<path d="${T}" fill="#1e2a3a" ${ol}/><path d="M66 90l14 14 14-14" fill="#2e3e52" stroke="${k}" stroke-width="2.5"/><path d="M80 104V182" stroke="#c8c8c8" stroke-width="2.5" stroke-dasharray="2 2"/><rect x="58" y="140" width="14" height="12" fill="none" stroke="#c8c8c8" stroke-width="2"/><rect x="88" y="140" width="14" height="12" fill="none" stroke="#c8c8c8" stroke-width="2"/>`,
    bd_sequin: `<path d="${T}" fill="url(#pSeq)" ${ol}/><path d="M64 92q16 16 32 0" fill="none" stroke="#ffd25a" stroke-width="3"/>` };
  const hood = B.id === 'bd_rain' ? `<path d="M50 92Q48 34 80 30Q112 34 110 92Z" fill="#ffd21a" ${ol}/>` : '';
  // ---- 褲子 ----
  const P = 'M54 182h52l6 86H86l-6-60-6 60H48Z';
  const legs: Record<string, string> = {
    lg_basic: `<path d="${P}" fill="#4a4a52" ${ol}/><path d="M58 190q8 10 16 0M86 190q8 10 16 0" stroke="#8a8a92" stroke-width="2" fill="none"/><rect x="92" y="222" width="12" height="12" fill="none" stroke="#8a8a92" stroke-width="2"/>`,
    lg_rain: `<path d="${P}" fill="#ffd21a" ${ol}/><path d="M60 190l-6 72M100 190l4 72" stroke="#fffbe0" stroke-width="3" opacity=".85"/>`,
    lg_flower: `<path d="${P}" fill="url(#pFlower)" ${ol}/>`,
    lg_camo: `<path d="${P}" fill="url(#pCamo)" ${ol}/><rect x="56" y="214" width="12" height="14" fill="none" stroke="#2e3a1e" stroke-width="2"/>` };
  // ---- 鞋子 ----
  const toes = (x: number) => [0, 1, 2, 3].map(i => `<circle cx="${x + 6 + i * 7}" cy="270" r="3" fill="${SK}" stroke="${k}" stroke-width="1.2"/>`).join('');
  const slip = (sole: string, strap: string) => [40, 84].map(x => `<rect x="${x - 4}" y="276" width="40" height="7" rx="3" fill="${sole}" stroke="${k}" stroke-width="2.5"/>${toes(x)}<path d="M${x + 2} 276q16-12 32 0" fill="none" stroke="${strap}" stroke-width="5"/>`).join('');
  const feet: Record<string, string> = {
    ft_basic: slip('#f2f2ee', '#2a5ab0'),
    ft_gold: slip('#e8b830', '#ffd25a') + `<circle cx="56" cy="271" r="2" fill="#fff"/><circle cx="100" cy="271" r="2" fill="#fff"/>`,
    ft_boots: [44, 84].map(x => `<path d="M${x} 236h30v40h6v8H${x - 4}v-8h4Z" fill="#ffd21a" ${ol}/><path d="M${x + 4} 242v32" stroke="#fffbe0" stroke-width="3"/>`).join(''),
    ft_work: [40, 84].map(x => `<path d="M${x + 2} 258h30l4 18h4v8H${x - 2}v-8h4Z" fill="#6a4a2a" ${ol}/>${[262, 268, 274].map(y => `<path d="M${x + 10} ${y}l12 3M${x + 22} ${y}l-12 3" stroke="#e8d8a8" stroke-width="1.5"/>`).join('')}`).join('') };
  // ---- 頭 ----
  const hd: Record<string, string> = {
    hd_basic: `<path d="M56 62Q56 34 80 34Q104 34 104 62Q92 48 80 50Q68 48 56 62Z" fill="url(#pFlowerR)" ${ol}/><path d="M102 56l14 6-6 6zM102 58l10 14-8 0z" fill="#c84a5a" ${ol}/>`,
    hd_hat: `<path d="M28 58L80 22L132 58Q80 66 28 58Z" fill="#d8b46a" ${ol}/><path d="M48 50L112 50M62 40H98M80 22V58" stroke="#8a6a2a" stroke-width="1.5"/><path d="M62 62q18 28 36 0" fill="none" stroke="${k}" stroke-width="1.5"/>`,
    hd_fisher: `<path d="M58 54V38Q80 26 102 38V54Z" fill="#4a6a8a" ${ol}/><path d="M44 62L58 52H102L116 62Q80 68 44 62Z" fill="#4a6a8a" ${ol}/><path d="M58 50H102" stroke="#2a3a4a" stroke-width="2.5"/>`,
    hd_helmet: `<path d="M56 56Q56 30 80 30Q104 30 104 56Z" fill="#ffb21a" ${ol}/><path d="M48 54H112V60H48Z" fill="#ffb21a" ${ol}/><path d="M80 30V54M70 33v21M90 33v21" stroke="${k}" stroke-width="2"/>`,
    hd_crown: `<path d="M58 54L60 28L70 40L80 22L90 40L100 28L102 54Z" fill="#e8b830" ${ol}/><path d="M58 54H102" stroke="#b8862a" stroke-width="4"/><circle cx="80" cy="44" r="4" fill="#c82a2a" stroke="${k}" stroke-width="1.5"/><circle cx="66" cy="48" r="2.5" fill="#2a8ac8"/><circle cx="94" cy="48" r="2.5" fill="#2a8ac8"/><circle cx="80" cy="22" r="2.5" fill="#fff6dc" stroke="${k}"/>` };
  const face = `<circle cx="80" cy="66" r="24" fill="${SK}" ${ol}/><circle cx="71" cy="66" r="2.6" fill="${k}"/><circle cx="89" cy="66" r="2.6" fill="${k}"/><path d="M73 76q7 6 14 0" fill="none" stroke="${k}" stroke-width="2.2" stroke-linecap="round"/><circle cx="66" cy="73" r="3" fill="#f0a090" opacity=".7"/><circle cx="94" cy="73" r="3" fill="#f0a090" opacity=".7"/>`;
  void PF;
  return `<svg viewBox="0 0 160 300" class="eqFig">${defs}${hood}${arm(50, 34)}${arm(110, 126)}${legs[L.id] ?? legs.lg_basic}${body[B.id] ?? body.bd_basic}${face}${hd[H.id] ?? hd.hd_basic}${feet[F.id] ?? feet.ft_basic}</svg>`;
}
// 裝備面板 v2：場景＋木牌部位卡＋加成看板＋套裝收集
const EQ_CARD: Record<Slot, { side: 'l' | 'r'; top: number; ax: number; ay: number }> = {
  head: { side: 'l', top: 2, ax: 80, ay: 42 }, hand: { side: 'l', top: 36, ax: 36, ay: 150 }, feet: { side: 'l', top: 70, ax: 62, ay: 278 },
  body: { side: 'r', top: 19, ax: 100, ay: 130 }, legs: { side: 'r', top: 53, ax: 96, ay: 228 } };
const EQ_FW = 54.04, EQ_FT = 8, EQ_FH = 76, EQ_CH = 27, EQ_CW = 30;
const eqAx = (vx: number) => 50 + (vx - 80) / 160 * EQ_FW, eqAy = (vy: number) => EQ_FT + vy / 300 * EQ_FH;
const SVG_SHED = `<svg class="eqShed" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="eqSpot" cx="50%" cy="48%" r="45%"><stop offset="0" stop-color="#fff6d8" stop-opacity=".95"/><stop offset=".6" stop-color="#ffe9b0" stop-opacity=".35"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient><pattern id="eqMat" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#c9a865"/><path d="M0 5h14" stroke="#a8864a" stroke-width="1.4"/><path d="M7 0v5M0 5v5M14 5v5" stroke="#b39352" stroke-width="1"/></pattern></defs>
<rect width="300" height="400" fill="#2c4a63"/><path d="M0 0h300v54L150 30 0 54Z" fill="#5d8fb3"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 20} ${54 - i * 1.6 * (i < 8 ? 1 : 0) - (i >= 8 ? (15 - i) * 1.6 : 0)}V0" stroke="#3f6f92" stroke-width="2"/>`).join('')}<path d="M0 54L150 30 300 54" fill="none" stroke="#16191d" stroke-width="4"/>
<rect x="20" y="52" width="10" height="280" fill="#6b4a2a" stroke="#16191d" stroke-width="2"/><rect x="270" y="52" width="10" height="280" fill="#6b4a2a" stroke="#16191d" stroke-width="2"/>
${[46, 76, 224, 254].map((x, j) => `<path d="M${x} 50V${120 + j % 2 * 30}" stroke="#d9c9a0" stroke-width="1.5"/>${[0, 1, 2, 3].map(k => `<ellipse cx="${x + (k % 2 ? 4 : -4)}" cy="${66 + k * 16 + j % 2 * 6}" rx="6" ry="4" fill="#9aa39a" stroke="#16191d" stroke-width="1.5"/>`).join('')}`).join('')}
<rect width="300" height="400" fill="url(#eqSpot)"/><path d="M0 330L300 330 300 400 0 400Z" fill="url(#eqMat)"/><path d="M0 330H300" stroke="#16191d" stroke-width="3"/><ellipse cx="150" cy="350" rx="70" ry="10" fill="#000" opacity=".25"/></svg>`;
let eqPick: Slot | null = null;
function eqStats(): string[] {
  const f = fxAll(), pc = (v: number) => Math.round(v * 100), out: string[] = [];
  if (f.pearl > 1.0001) out.push(`珍珠率|+${pc(f.pearl - 1)}%`);
  if (f.bowl) out.push(`每碗多拿|+$${f.bowl}`);
  if (f.throw < 0.9999) out.push(`被丟殼機率|−${pc(1 - f.throw)}%`);
  if (f.nag < 0.9999) out.push(`阿婆唸人、干擾|−${pc(1 - f.nag)}%`);
  if (f.dmg < 0.9999) out.push(`受到傷害|−${pc(1 - f.dmg)}%`);
  if (f.speed < 0.9999) out.push(`翹殼指針|慢 ${pc(1 - f.speed)}%`);
  if (f.keep) out.push(`沒中保住連擊|${pc(f.keep)}%`);
  if (f.luck) out.push(`幸運|+${f.luck}`);
  return out;
}
function renderEquip() {
  const sets = setsOn(), st = eqStats(), worn = wornIds();
  const lines = SLOTS.map(([s]) => { const c = EQ_CARD[s], cx = c.side === 'l' ? EQ_CW : 100 - EQ_CW, cy = c.top + EQ_CH / 2;
    return `<line x1="${cx}" y1="${cy}" x2="${eqAx(c.ax).toFixed(1)}" y2="${eqAy(c.ay).toFixed(1)}"/><circle cx="${eqAx(c.ax).toFixed(1)}" cy="${eqAy(c.ay).toFixed(1)}" r="1.1"/>`; }).join('');
  const cards = SLOTS.map(([s, n]) => { const c = EQ_CARD[s], e = equipNow(s);
    return `<button class="eqCard ${c.side}${eqPick === s ? ' on' : ''}" data-slot="${s}" style="top:${c.top}%"><span class="eqTag">${n}</span>${eqSvg(e, 44)}<b>${e.n}</b><small>${e.price ? e.eff : '基本款，沒有加成'}</small></button>`; }).join('');
  const hits = SLOTS.map(([s]) => { const c = EQ_CARD[s]; return `<button class="eqHit" data-slot="${s}" aria-label="${SLOTS.find(x => x[0] === s)![1]}" style="left:${eqAx(c.ax)}%;top:${eqAy(c.ay)}%"></button>`; }).join('');
  const pickName = eqPick ? SLOTS.find(x => x[0] === eqPick)![1] : '';
  $('eqBody').innerHTML =
    `<div class="eqBoard"><div class="eqBoardT">目前加成</div>${st.length ? `<div class="eqStats">${st.map(x => { const [a, b] = x.split('|'); return `<div><small>${a}</small><b>${b}</b></div>`; }).join('')}</div>` : '<p class="eqNone">現在穿的都是基本款，還沒有加成。去服飾店挑幾件吧。</p>'}</div>` +
    `<div class="eqStage">${SVG_SHED}<div class="eqFigW">${figSvg()}</div><svg class="eqLines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${hits}${cards}</div>` +
    (eqPick ? `<div class="eqList"><div class="eqListT">換${pickName}<small>點一件就換上，換穿免費</small></div>${EQUIP.filter(e => e.slot === eqPick && eqOwned(e.id)).map(e => `<button data-eqset="${e.id}" class="${equipNow(e.slot).id === e.id ? 'on' : ''}">${eqSvg(e, 48)}<span><b>${e.n}</b><small>${e.eff}</small></span>${equipNow(e.slot).id === e.id ? '<em>穿著中</em>' : ''}</button>`).join('')}<p class="eqHint">想要更多款式，去服飾店看看。</p></div>` : '<p class="eqHint">點人身上的部位或旁邊的木牌來換裝。</p>') +
    `<div class="eqSecT">套裝收集</div><div class="eqSets">${SETS.map(s => { const done = sets.includes(s), have = s.need.filter(i => eqOwned(i)).length;
      const full = have === s.need.length; return `<div class="eqSet${done ? ' done' : ''}${full ? ' full' : ''}"${full ? ` data-setid="${s.id}" role="button"` : ''}><div class="eqSetH"><b>${s.n}</b><span>${have}/${s.need.length} 件</span></div><div class="eqSetI">${s.need.map(i => { const e = EQUIP.find(x => x.id === i)!; return `<div class="${worn.includes(i) ? 'worn' : eqOwned(i) ? 'own' : 'no'}">${eqSvg(e, 40, !eqOwned(i))}<small>${e.n}</small></div>`; }).join('')}</div><p>${s.eff}${s.id === 'typhoon' ? '（手部任意）' : ''}</p>${done ? '<i class="eqStamp">套裝完成</i>' : ''}${full ? `<em class="eqSetGo"><i class="ic ${done ? 'ic-check' : 'ic-hand'}"></i> ${done ? '穿著中' : '一鍵換上'}</em>` : ''}</div>`; }).join('')}</div>` +
    `<div id="eqShareOut"></div><p class="eqHint">分享到 Discord 有機會拿神秘好禮</p><div class="eqDock"><button id="eqShare"><i class="ic ic-send"></i>分享穿搭</button><button id="eqShop"><i class="ic ic-shop"></i>去服飾店</button></div>`;
  $('eqBody').querySelectorAll('button[data-slot]').forEach(b => (b as HTMLButtonElement).onclick = () => { const s = b.getAttribute('data-slot') as Slot; eqPick = eqPick === s ? null : s; renderEquip(); if (eqPick) $('eqBody').querySelector('.eqList')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  $('eqBody').querySelectorAll<HTMLElement>('.eqSet[data-setid]').forEach(el => el.onclick = () => { const st = SETS.find(x => x.id === el.dataset.setid); if (st) askSet(st); });
  $('eqBody').querySelectorAll('button[data-eqset]').forEach(b => (b as HTMLButtonElement).onclick = () => { const e = EQUIP.find(x => x.id === b.getAttribute('data-eqset'))!; setEquip(e.slot, e.id); persist(); applySleeve(); applyOutfit3(); renderEquip(); });
  ($('eqShare') as HTMLButtonElement).onclick = shareOutfit;
  ($('eqShop') as HTMLButtonElement).onclick = () => { $('equip').classList.remove('show'); eqFromRes = false; if (eqPick) clothTab = eqPick; renderShop(); const gs = Array.from(document.querySelectorAll('#shopList .stab')); const i = gs.findIndex(g => g.querySelector('.slGrid')); if (i >= 0) { shopTab = i; renderShop(); } $('shop').classList.add('show'); $('shop').scrollTop = 0; };
}
let clothTab: Slot = 'hand';
function renderClothShop() {
  if (sleeveTry) { sleeveTry = null; applySleeve(); }
  const items = EQUIP.filter(e => e.slot === clothTab && e.price > 0).sort((a, b) => a.price - b.price);
  $('shopList').insertAdjacentHTML('beforeend', `<h3><i class="ic ic-hand"></i> 服飾</h3><p style="font-size:12px;opacity:.8">買了永久擁有，每個部位一次穿一件，只有穿著的有效果。換穿免費，也可以在主畫面的「裝備」換。湊齊套裝還有額外加成。</p><div class="clTabs">${SLOTS.map(([s, n]) => `<button data-ctab="${s}" class="${s === clothTab ? 'on' : ''}">${n}</button>`).join('')}</div><div class="slGrid">` + items.map(s => { const own = eqOwned(s.id), cur = equipNow(s.slot).id === s.id;
    return `<div class="slCard${cur ? ' on' : ''}">${eqSvg(s)}<b>${s.n}</b><small>$${s.price}・${s.eff}</small><div class="slBtns">${own ? `<button data-sleq="${s.id}" ${cur ? 'disabled' : ''}>${cur ? '穿著中' : '換上'}</button>` : `<button data-slbuy="${s.id}" ${save.money < s.price ? 'disabled' : ''}>買 $${s.price}</button>`}</div></div>`; }).join('') + `</div>`);
  $('shopList').querySelectorAll('button[data-ctab]').forEach(b => (b as HTMLButtonElement).onclick = () => { clothTab = b.getAttribute('data-ctab') as Slot; renderShop(); });
  $('shopList').querySelectorAll('button[data-slbuy],button[data-sleq]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const id = b.getAttribute('data-slbuy') ?? b.getAttribute('data-sleq')!; const s = EQUIP.find(x => x.id === id)!;
    if (b.hasAttribute('data-slbuy')) { if (save.money < s.price) return; save.money -= s.price; save.shop.owned.push(id); track('buy', { item: id, price: s.price }); if (ac) SFX.jingle(); }
    setEquip(s.slot, id); sleeveTry = null; persist(); applySleeve(); applyOutfit3(); renderShop();
  });
}
// 分享穿搭卡：直接畫在 canvas 上
async function shareOutfit() {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  g.fillStyle = '#1e3a5a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f0e6c8'; g.lineWidth = 14; g.strokeRect(30, 30, W - 60, H - 60);
  g.fillStyle = '#c8302a'; g.fillRect(60, 60, W - 120, 150); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(60, 60, W - 120, 150);
  g.fillStyle = '#fff6dc'; g.textAlign = 'center'; g.font = 'bold 84px sans-serif'; g.fillText('剝蚵仔模擬器', W / 2, 165);
  g.font = 'bold 60px sans-serif'; g.fillText(myName(), W / 2, 300); g.font = '36px sans-serif'; g.fillStyle = '#c8d8e8'; g.fillText('#' + statsId.slice(0, 4).toUpperCase() + ' 的今日穿搭', W / 2, 352);
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(figSvg().replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="750" '));
  await new Promise(r => { img.onload = r; img.onerror = r; }); g.fillStyle = '#f0e6c8'; g.fillRect(80, 400, 440, 780); g.drawImage(img, 100, 415, 400, 750);
  g.textAlign = 'left'; let y = 450;
  for (const [s, n] of SLOTS) { const e = equipNow(s); g.fillStyle = e.base; g.fillRect(570, y - 40, 50, 50); g.strokeStyle = '#1b1b1b'; g.lineWidth = 4; g.strokeRect(570, y - 40, 50, 50); g.fillStyle = '#c8d8e8'; g.font = '32px sans-serif'; g.fillText(n, 640, y - 12); g.fillStyle = '#fff6dc'; g.font = 'bold 42px sans-serif'; g.fillText(e.n, 640, y + 34); y += 130; }
  const sets = setsOn(); if (sets.length) { g.fillStyle = '#ffd25a'; g.font = 'bold 40px sans-serif'; g.fillText('套裝：' + sets.map(s => s.n).join('、'), 570, y + 10); }
  g.textAlign = 'center'; g.fillStyle = '#c8d8e8'; g.font = '34px sans-serif'; g.fillText('https://jinweihuang20.github.io/oyster-sim/', W / 2, H - 80);
  const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return;
  const file = new File([blob], 'oyster-outfit.png', { type: 'image/png' }); const url = URL.createObjectURL(blob);
  $('eqShareOut').innerHTML = `<img src="${url}" alt="穿搭卡" style="width:100%;border-radius:8px;margin-top:8px"><p class="eqHint">手機也可以長按圖片儲存。</p><a href="${url}" download="oyster-outfit.png" class="btnLike">儲存圖片</a><p class="eqHint" style="margin-top:10px">加入 Discord 分享穿搭，就送神秘好禮！</p><a href="https://discord.gg/tpPBqxACVq" target="_blank" rel="noopener" class="btnLike dcBtn">加入 Discord</a>`;
  const nav = navigator as any;
  if (COARSE && nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: '剝蚵仔模擬器', text: '看看我的剝蚵穿搭 https://jinweihuang20.github.io/oyster-sim/' }); } catch { } }
}
// 第一次收工後提醒取名字（只出現一次）
function namePrompt() {
  if ($('paySum').classList.contains('show')) { nameWait = true; return; }
  if (save.namePrompted || save.name || tut) return; save.namePrompted = 1; persist(); ($('naIn') as HTMLInputElement).value = ''; $('nameAsk').classList.add('show');
}
$('naOk').onclick = () => { const i = $('myName') as HTMLInputElement; i.value = ($('naIn') as HTMLInputElement).value; i.dispatchEvent(new Event('change')); $('nameAsk').classList.remove('show'); };
$('naSkip').onclick = () => $('nameAsk').classList.remove('show'); $('naClose').onclick = () => $('nameAsk').classList.remove('show');
{ const i = $('naIn'); for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']) i.addEventListener(ev, e => e.stopPropagation()); }
migrateEquip(); persist(); applySleeve();
// 禮物信箱：伺服器沒開或還沒有這個路由時安靜失敗
let giftList: Social.Gift[] = [], giftAt = 0;
async function checkGifts(force = false) {
  if (!force && Date.now() - giftAt < 3 * 60e3) return; giftAt = Date.now();
  try { giftList = await Social.gifts(); } catch { giftList = []; }
  const b = document.getElementById('oGift'); if (b) b.style.display = giftList.length ? '' : 'none';
}
function giftLabel(g: Social.Gift) {
  if (g.type === 'money') return `$${Math.max(0, Math.floor(+g.amount! || 0))}`;
  if (g.type === 'equip') return EQUIP.find(e => e.id === g.itemId)?.n ?? '服飾';
  if (g.type === 'odd') return ODD[+g.itemId!]?.name ?? '奇物';
  if (g.type === 'pearl') return RAR[+(g.tier ?? 0)]?.name ?? '珍珠';
  return '禮物';
}
function applyGift(g: Social.Gift) {
  if (g.type === 'money') save.money += Math.max(0, Math.floor(+g.amount! || 0));
  else if (g.type === 'equip') { if (EQUIP.some(e => e.id === g.itemId) && !save.shop.owned.includes(g.itemId as string)) save.shop.owned.push(g.itemId as string); }
  else if (g.type === 'odd') { const i = +g.itemId!; if (Number.isInteger(i) && i >= 0 && i < save.odd.length) save.odd[i]++; }
  else if (g.type === 'pearl') { const t = +(g.tier ?? 0); if (Number.isInteger(t) && t >= 0 && t < save.dex.length) save.dex[t]++; }
  persist(); renderDex();
}
function giftBadge() { const ob = document.getElementById('oGift'); if (ob) ob.style.display = giftList.length ? '' : 'none'; }
function askSet(st: typeof SETS[number]) {
  document.getElementById('giftMsg')?.remove();
  const worn = wornIds(), on = st.need.every(i => worn.includes(i));
  const m = document.createElement('div'); m.id = 'giftMsg'; m.className = 'giftMsg setAsk';
  const items = st.need.map(i => { const e = EQUIP.find(x => x.id === i)!; return `<li>${eqSvg(e, 32, false)}<span>${e.n}</span></li>`; }).join('');
  m.innerHTML = on
    ? `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-check"></i> 已經穿著這套了</b><p class="saEff">${st.n}：${st.eff}</p><div class="mbtns"><button class="gmNo"><i class="ic ic-check"></i> 確定</button></div></div>`
    : `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-hand"></i> 要換上「${st.n}」嗎？</b><ul class="saList">${items}</ul><p class="saEff">套裝加成：${st.eff}</p><div class="mbtns"><button class="gmNo">取消</button><button class="gmYes"><i class="ic ic-check"></i> 換上</button></div></div>`;
  const close = () => m.remove();
  m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
  m.querySelector('.gmYes')?.addEventListener('click', () => {
    for (const i of st.need) { const e = EQUIP.find(x => x.id === i); if (e && eqOwned(i)) setEquip(e.slot, i); }
    persist(); applySleeve(); applyOutfit3(); renderEquip(); try { SFX.jingle(); } catch { /* 無音訊 */ }
    m.querySelector('.gmBox')!.innerHTML = `<button class="gmX" aria-label="關閉">✕</button><b><i class="ic ic-check"></i> 已換上「${st.n}」</b><p class="saEff">套裝加成生效：${st.eff}</p><div class="mbtns"><button class="gmNo"><i class="ic ic-check"></i> 確定</button></div>`;
    m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', close));
    setTimeout(close, 2200);
  });
  m.addEventListener('click', e => { if (e.target === m) close(); });
  document.body.appendChild(m);
}
function giftMsg(ok: boolean, title: string, lines: string[]) {
  document.getElementById('giftMsg')?.remove();
  const esc2 = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const m = document.createElement('div'); m.id = 'giftMsg'; m.className = 'giftMsg' + (ok ? '' : ' bad');
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" aria-label="關閉">✕</button><b><i class="ic ${ok ? 'ic-gift' : 'ic-warn'}"></i> ${esc2(title)}</b><ul>${lines.map(l => `<li>${esc2(l)}</li>`).join('')}</ul><div class="mbtns"><button class="gmOk"><i class="ic ic-check"></i> 確定</button></div></div>`;
  const close = () => m.remove();
  m.querySelectorAll('button').forEach(b => b.addEventListener('click', close));
  m.addEventListener('click', e => { if (e.target === m) close(); });
  document.body.appendChild(m);
}
function giftGot(g: Social.Gift) { return g.type === 'money' ? `+${giftLabel(g)}` : `${g.type === 'equip' ? '服飾' : g.type === 'odd' ? '奇物' : '珍珠'}：${giftLabel(g)}`; }
function renderGifts() {
  const esc2 = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  $('giftBody').innerHTML = giftList.length ? giftList.map(g => `<div class="gfRow"><div><b>${esc2(giftLabel(g))}</b><small>${esc2(g.message ?? '')}</small></div><button data-gift="${esc2(String(g.id))}">領取</button></div>`).join('') : '<p class="eqHint">目前沒有禮物。</p>';
  $('giftBody').querySelectorAll<HTMLButtonElement>('button[data-gift]').forEach(b => b.onclick = async () => {
    if (b.disabled) return;
    const id = b.getAttribute('data-gift')!; b.disabled = true; b.classList.add('busy'); b.textContent = '領取中…';
    const local = giftList.find(x => String(x.id) === id);
    const r = await Social.claimGift(id);
    if (r.st === 'retry') { b.disabled = false; b.classList.remove('busy'); b.textContent = '領取'; giftMsg(false, '沒領到', [r.why ?? '等一下再試']); return; }
    giftList = giftList.filter(x => String(x.id) !== id);
    if (r.st === 'ok') {
      const g = r.gift ?? local!; applyGift(g); renderDaily();
      try { audio(); for (let k = 0; k < 5; k++) tone(1100 + k * 200, 0.12, 0.08, 'square', k * 0.06, 1600 + k * 200); tone(659, 0.45, 0.12, 'triangle', 0.35); } catch { }
      track('gift_claim', { type: g.type, money: save.money });
      giftMsg(true, '已領取！', [giftGot(g), ...(g.message ? [`「${g.message}」`] : []), `身上有 $${save.money}`]);
    } else giftMsg(false, '沒領到', [r.why ?? '這份禮物已經不能領了']);
    renderGifts(); giftBadge();
  });
}
$('oGift').onclick = () => { renderGifts(); $('gift').classList.add('show'); };
$('giftClose').onclick = () => $('gift').classList.remove('show');
setTimeout(() => checkGifts(true), 3000); setInterval(() => { if (state !== 'play') checkGifts(); }, 60e3);
// ---------- 第三人稱視角 ----------
// eslint-disable-next-line no-var
var tpReady = false;
const pm = { head: mat(0xffffff), body: mat(0xffffff), legs: mat(0xffffff), feet: mat(0xffffff), skin: mat(skin) };
const me3 = new THREE.Group(); me3.visible = false; scene.add(me3);
const meTorso = new THREE.Group(); me3.add(meTorso);
mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), pm.body, [0, 0.66, 0], meTorso);
const meSeatLegs = new THREE.Group(); me3.add(meSeatLegs);
mesh(new THREE.BoxGeometry(0.34, 0.12, 0.36), pm.legs, [0, 0.42, -0.1], meSeatLegs);
for (const sx of [-0.09, 0.09]) { mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.32, 6), pm.legs, [sx, 0.2, -0.28], meSeatLegs); mesh(new THREE.BoxGeometry(0.1, 0.05, 0.2), pm.feet, [sx, 0.03, -0.34], meSeatLegs); }
// 站著走路用的腿：髖關節為軸，前後擺
const meLeg = (sx: number) => { const g = new THREE.Group(); g.position.set(sx, 0.86, 0); me3.add(g); mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.8, 6), pm.legs, [0, -0.4, 0], g); mesh(new THREE.BoxGeometry(0.11, 0.06, 0.22), pm.feet, [0, -0.83, -0.05], g); g.visible = false; return g; };
const meLegL = meLeg(-0.09), meLegR = meLeg(0.09); let walkPh = 0; const lastWalk = new THREE.Vector3(); let tpWas = false; const tpLook = new THREE.Vector3();
const meHead = new THREE.Group(); meHead.position.set(0, 1.02, 0); meTorso.add(meHead);
mesh(new THREE.SphereGeometry(0.15, 10, 8), pm.skin, [0, 0, 0], meHead);
mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, 1.3), pm.head, [0, 0.03, 0], meHead);
mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12), pm.head, [0, 0.06, 0], meHead);
const meArm = (s: number) => { const p = new THREE.Group(); p.position.set(s * 0.22, 0.84, 0); meTorso.add(p); mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.36, 6), sleeve, [0, -0.12, -0.12], p).rotation.x = 1.1; mesh(new THREE.SphereGeometry(0.05, 6, 5), pm.skin, [0, -0.2, -0.3], p); return p; };
const meArmL = meArm(-1), meArmR = meArm(1);
let tpv = false, cheerT = 0, ouchT = 0;
function applyOutfit3() {
  for (const s of ['head', 'body', 'legs', 'feet'] as const) { const e = equipNow(s), m = pm[s]; m.map?.dispose(); m.map = eqTex(e); m.map.repeat.set(1, 1); m.color.set(0xffffff); m.emissive.set(e.pat === 'neon' ? 0x3a1a50 : 0); m.needsUpdate = true; }
}
function setTpv(v: boolean) { tpv = v; save.tpv = v ? 1 : 0; persist(); applyOutfit3(); drawCamBtn(); const c = document.getElementById('tpvSel') as HTMLInputElement | null; if (c) c.checked = v; }
function drawCamBtn() { const b = document.getElementById('camBtn'); if (!b) return; b.classList.toggle('on', tpv); b.title = tpv ? '視角：第三人稱' : '視角：第一人稱'; }
function react3(kind: 'cheer' | 'ouch') { if (!tpReady) return; if (kind === 'cheer') cheerT = 1.4; else ouchT = 0.6; }
// 每幀：放好角色、把鏡頭拉到身後上方；手和蚵仔仍跟著鏡頭，操作不變
function camTick(dt: number) {
  if (!tpReady) return;
  const show = tpv && state === 'play';
  const enter = show && !tpWas; tpWas = show;
  tpOn = show; me3.visible = show; umbTick3(dt, show); handRig.scale.setScalar(show ? 0.75 : 1); handRig.position.set(0, show ? -0.04 : 0, 0); handL.children[0].visible = handR.children[0].visible = !show;
  if (!show) return;
  const kk = enter ? 1 : 1 - Math.exp(-5 * dt);
  meSeatLegs.visible = !walking; meLegL.visible = meLegR.visible = walking;
  if (walking) {
    // 走路：站起來、腿手擺動，鏡頭跟在背後上方
    const sp = Math.hypot(walkPos.x - lastWalk.x, walkPos.z - lastWalk.z) / Math.max(dt, 1e-3); lastWalk.copy(walkPos);
    walkPh += Math.min(sp, 3) * dt * 5; const sw = Math.min(1, sp / 1.2) * Math.sin(walkPh);
    me3.position.set(walkPos.x, walkPos.y - 1.55 - 0.4, walkPos.z); me3.rotation.y = yaw; meTorso.position.y = 0.43; meTorso.rotation.x = 0;
    meLegL.rotation.x = sw * 0.6; meLegR.rotation.x = -sw * 0.6; meArmL.rotation.x = -sw * 0.5; meArmR.rotation.x = sw * 0.5; meArmL.rotation.z = meArmR.rotation.z = 0; meHead.rotation.y = 0;
    handRig.visible = false;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), gy = walkPos.y - 1.95;
    const cp = new THREE.Vector3(walkPos.x - fx * 2.9, gy + 2.5, walkPos.z - fz * 2.9);
    if (enter) tpCam.position.copy(cp); else tpCam.position.lerp(cp, kk);
    { const lt = new THREE.Vector3(walkPos.x + fx * 1.2, gy + 0.9, walkPos.z + fz * 1.2); if (enter) tpLook.copy(lt); else tpLook.lerp(lt, kk); tpCam.lookAt(tpLook); } tpCam.updateMatrixWorld(); return;
  }
  me3.position.set(SEAT.x, SEAT.y - 1.02, SEAT.z); me3.rotation.y = seatYaw;
  cheerT = Math.max(0, cheerT - dt); ouchT = Math.max(0, ouchT - dt);
  const up = cheerT > 0 ? Math.sin(Math.min(1, cheerT) * Math.PI) : 0;
  meArmL.rotation.x = meArmR.rotation.x = -up * 2.4; meArmL.rotation.z = -up * 0.3; meArmR.rotation.z = up * 0.3;
  meTorso.rotation.x = ouchT > 0 ? Math.sin(ouchT / 0.6 * Math.PI) * 0.35 : 0; meTorso.position.y = up * 0.06;
  meHead.rotation.y = yaw * 0.6; meTorso.position.y = Math.max(meTorso.position.y, 0);
  // 從背後斜 3/4 看，人在畫面中下、全身入鏡
  const h = seatYaw + yaw * 0.35, fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const tx = SEAT.x + fx * 0.3, tz = SEAT.z + fz * 0.3;
  { const cp = new THREE.Vector3(SEAT.x - fx * 2.6 - rx * 1.5, SEAT.y + 0.85, SEAT.z - fz * 2.6 - rz * 1.5); if (enter) tpCam.position.copy(cp); else tpCam.position.lerp(cp, kk); } { const lt = new THREE.Vector3(SEAT.x + fx * 0.8 + rx * 0.35, SEAT.y - 0.2, SEAT.z + fz * 0.8 + rz * 0.35); if (enter) tpLook.copy(lt); else tpLook.lerp(lt, kk); tpCam.lookAt(tpLook); } tpCam.updateMatrixWorld();
  // 蚵仔與刀跟著角色的手（handRig 掛在 camera 底下，換算到角色胸前）
  camera.updateMatrixWorld(); const hp = new THREE.Vector3(SEAT.x + fx * 0.45, SEAT.y - 0.55 + up * 0.4, SEAT.z + fz * 0.45); camera.worldToLocal(hp); handRig.position.copy(hp).add(new THREE.Vector3(0, 0.24, 0.42)); handRig.scale.setScalar(0.6);
}
tpv = !!save.tpv; applyOutfit3(); drawCamBtn(); tpReady = true;
$('camBtn').onclick = () => setTpv(!tpv);
{ const c = document.getElementById('tpvSel') as HTMLInputElement | null; if (c) { c.checked = tpv; c.onchange = () => setTpv(c.checked); } }
let eqFromRes = false;
// iOS：面板顯示後才重畫一次內容，避免隱藏時插入的 SVG 不上色
function openEquip() { renderEquip(); $('equip').classList.add('show'); requestAnimationFrame(() => { void $('equip').offsetHeight; renderEquip(); }); }
$('eqClose').onclick = () => { $('equip').classList.remove('show'); if (eqFromRes) { eqFromRes = false; $('result').classList.add('show'); } };
$('rEquip').onclick = () => { eqFromRes = true; $('result').classList.remove('show'); eqPick = null; openEquip(); };
$('oEquip').onclick = () => { eqPick = null; openEquip(); };
let shopTab = 0;
function shopTabs() {
  const list = $('shopList'), kids = Array.from(list.children); const groups: HTMLElement[] = []; let cur: HTMLElement | null = null; const head = document.createElement('div');
  for (const k of kids) { if (k.tagName === 'H3') { cur = document.createElement('div'); cur.className = 'stab'; groups.push(cur); } (cur ?? head).appendChild(k); }
  list.innerHTML = ''; list.appendChild(head); groups.forEach(g => list.appendChild(g));
  const names = groups.map(g => g.querySelector('h3')!.textContent!.replace('剝殼刀', '刀具').replace('盆仔', '器具'));
  let bar = document.getElementById('shopTabs'); if (!bar) { bar = document.createElement('div'); bar.id = 'shopTabs'; const h = $('shop').querySelector('h2')!; h.after(bar); }
  shopTab = Math.min(shopTab, groups.length - 1);
  bar.innerHTML = names.map((n, i) => `<button data-tab="${i}" class="${i === shopTab ? 'on' : ''}">${n.replace(/^(\S+)\s+(.+)$/, '<span class="ti">$1</span><span class="tl">$2</span>')}</button>`).join('');
  groups.forEach((g, i) => { g.style.display = i === shopTab ? '' : 'none'; g.querySelector('h3')!.style.display = 'none'; });
  bar.querySelectorAll('button').forEach(b => (b as HTMLButtonElement).onclick = () => { shopTab = +b.getAttribute('data-tab')!; shopTabs2(groups, bar!); });
}
function shopTabs2(groups: HTMLElement[], bar: HTMLElement) { groups.forEach((g, i) => g.style.display = i === shopTab ? '' : 'none'); bar.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === shopTab)); $('shop').scrollTop = 0; }

// 手機返回鍵：關掉最上層的視窗；上工中不離開；主畫面連按兩次才離開（同核心回收）
function cleanName(v: string) { return [...v.replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').trim()].slice(0, 8).join('').trim() || '剝蚵人'; }
function myName() { return save.name ? cleanName(save.name) : '剝蚵人'; }
function esc(v: string) { return v.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); }
function drawName() { const n = myName(); const m = document.getElementById('meLine'); if (m) { m.textContent = ''; m.append('夜晚的巷口，「'); const b = document.createElement('span'); b.id = 'nameEdit'; b.setAttribute('role', 'button'); b.tabIndex = 0; b.title = '點一下改名字'; b.textContent = n; const g = document.createElement('i'); g.textContent = ' ✎'; b.append(g); b.onkeydown = e => { if (e.key === 'Enter') b.click(); }; b.onclick = () => { ($('setBtn') as HTMLButtonElement).click(); setTimeout(() => ($('myName') as HTMLInputElement).focus(), 50); }; m.append(b, '」和鄰居阿婆們坐在小板凳上，圍在一起剝蚵仔。'); } const i = document.getElementById('myName') as HTMLInputElement | null; if (i && document.activeElement !== i) i.value = save.name ? n : ''; }
{ const i = $('myName') as HTMLInputElement; const commit = () => { const v = cleanName(i.value); save.name = v === '剝蚵人' ? undefined : v; i.value = save.name ? v : ''; persist(); drawName(); };
  i.addEventListener('change', commit); i.addEventListener('blur', commit); i.addEventListener('input', () => { const v = cleanName(i.value); save.name = v === '剝蚵人' ? undefined : v; persist(); }); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); i.blur(); } });
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) i.addEventListener(ev, e => e.stopPropagation()); drawName(); }
// 面板可捲動提示：內容超出且還沒捲到底時，底部顯示 ⌄
document.querySelectorAll<HTMLElement>('.panel').forEach(pn => {
  const h = document.createElement('div'); h.className = 'scrollHint'; h.innerHTML = '<span><b>⌄</b></span>'; pn.appendChild(h);
  const upd = () => h.classList.toggle('on', pn.classList.contains('show') && pn.scrollHeight - pn.clientHeight - pn.scrollTop > 24);
  h.onclick = () => pn.scrollBy({ top: pn.clientHeight * 0.6, behavior: 'smooth' });
  pn.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd);
  new MutationObserver(() => requestAnimationFrame(upd)).observe(pn, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); upd();
});
// 上工中關掉／離開頁面：記一筆中途離開
addEventListener('pagehide', () => { if (state === 'play' && !tut) track('abandon', { reason: 'abandon', count, opened, dur: Math.round(shiftLen - Math.max(0, timeLeft)), loc: locNow().id, dstat: dstatStr() }); });
// 💬 意見回饋
const FB_URL = STATS_URL.replace(/\/e$/, '/feedback');
let fbCat = '', fbFrom = '', fbLast = 0, fbMood = 0, fbTimer = 0;
const FB_PH: Record<string, string> = { bug: '哪裡出問題？在做什麼的時候發生的？例如：在王功漁港撬第三顆時畫面卡住…', idea: '想加什麼東西？新的刀、新漁港、新阿婆都可以講～', fun: '哪裡最好玩？哪個阿婆最好笑？', hard: '哪一段太難？撬殼、投碗還是躲殼？' };
const MOOD_TXT = ['', '很差', '普通偏差', '還可以', '不錯', '超好玩'];
const fbCount = () => { const n = ($('fbText') as HTMLTextAreaElement).value.length, c = $('fbCount'); c.textContent = `${n}/500`; c.className = n >= 480 ? 'full' : n >= 400 ? 'near' : ''; };
function fbCool() { const left = Math.ceil((60_000 - (Date.now() - fbLast)) / 1000), btn = $('fbSend') as HTMLButtonElement; clearTimeout(fbTimer);
  if (left > 0 && fbLast) { btn.disabled = true; $('fbSendTxt').textContent = `阿婆喘口氣… ${left} 秒`; fbTimer = window.setTimeout(fbCool, 1000); } else { btn.disabled = false; $('fbSendTxt').textContent = '送出'; } }
function fbShow(done: boolean) { $('fbForm').style.display = done ? 'none' : ''; $('fbDone').classList.toggle('on', done); }
function openFb(from: string) { fbFrom = from; $(from).classList.remove('show'); fbShow(false); $('fb').classList.add('show'); fbCount(); fbCool(); }
const bounce = (el: Element) => { el.classList.remove('pop'); void (el as HTMLElement).offsetWidth; el.classList.add('pop'); };
document.querySelectorAll<HTMLButtonElement>('[data-fc]').forEach(b => b.onclick = () => { fbCat = b.dataset.fc!; document.querySelectorAll<HTMLButtonElement>('[data-fc]').forEach(x => x.classList.toggle('sel', x === b)); bounce(b); ($('fbText') as HTMLTextAreaElement).placeholder = FB_PH[fbCat] ?? ''; });
document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(b => b.onclick = () => { const v = +b.dataset.mood!; fbMood = fbMood === v ? 0 : v; document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(x => { x.classList.toggle('sel', +x.dataset.mood! <= fbMood); }); bounce(b); $('fbMoodTxt').textContent = fbMood ? `${fbMood}/5 ${MOOD_TXT[fbMood]}` : ''; });
$('fbText').addEventListener('input', fbCount);
$('setFb').onclick = () => openFb('settings'); $('rFb').onclick = () => openFb('result');
$('fbClose').onclick = () => { $('fb').classList.remove('show'); fbShow(false); if (fbFrom) $(fbFrom).classList.add('show'); };
$('fbBack').onclick = () => { $('fb').classList.remove('show'); fbShow(false); if (fbFrom === 'result' || state !== 'play') { if (fbFrom) $(fbFrom).classList.add('show'); } };
$('fbSend').onclick = () => {
  const ta = $('fbText') as HTMLTextAreaElement, text = ta.value.trim().slice(0, 500);
  if (!fbCat) { toast('先選一個類別喔'); bounce($('fbCats')); return; }
  if (!text) { toast('寫點什麼再送出吧'); ta.focus(); return; }
  if (Date.now() - fbLast < 60_000) { fbCool(); return; }
  fbLast = Date.now(); const btn = $('fbSend'); btn.classList.add('flying'); ($('fbSend') as HTMLButtonElement).disabled = true; $('fbSendTxt').textContent = '送出中…';
  const ua = navigator.userAgent, uaS = (/(iPhone|iPad|Android|Windows|Mac OS X|Linux)/.exec(ua)?.[1] ?? '?') + ' ' + (/(Edg|Chrome|Firefox|Safari)\/[\d]+/.exec(ua)?.[0] ?? '');
  const body = JSON.stringify({ uid: statsId, cat: fbCat, text, mood: fbMood || undefined, contact: ($('fbContact') as HTMLInputElement).value.trim().slice(0, 120), meta: { ver: __BUILD__, dev: COARSE ? 'mobile' : 'pc', screen: `${innerWidth}x${innerHeight}`, loc: locNow().id, days: save.days, ua: uaS, mood: fbMood || undefined } });
  const catName: Record<string, string> = { bug: '🐛 Bug', idea: '💡 建議', fun: '😊 好玩', hard: '😣 太難' };
  const pBack = fetch(FB_URL, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }).then(r => r.ok, () => false);
  const pDc = postDiscordFeedback(`剝蚵仔模擬器｜${catName[fbCat] ?? fbCat}`, text, { 心情: fbMood ? `${'🦪'.repeat(fbMood)} ${fbMood}/5` : '未選', 版本: __BUILD__, 裝置: `${COARSE ? 'mobile' : 'pc'} ${uaS}`, 螢幕: `${innerWidth}x${innerHeight}`, 漁港: locNow().id, 工數: save.days });
  const minT = new Promise(r => setTimeout(r, 700));
  Promise.all([pBack, pDc, minT]).then(([a, b]) => { btn.classList.remove('flying');
    if (a || b) { ta.value = ''; fbCount(); fbMood = 0; document.querySelectorAll('[data-mood].sel').forEach(x => x.classList.remove('sel')); $('fbMoodTxt').textContent = ''; fbShow(true); fbCool(); }
    else { fbLast = 0; fbCool(); toast('送出失敗，稍後再試'); } });
};
(window as any).__fbDone = () => fbShow(true);
installBackGuard(() => {
  const open = (id: string) => document.getElementById(id)?.classList.contains('show');
  if (open('npcTip')) { $('npcTip').classList.remove('show'); return 'handled'; }
  if (open('medList')) { $('medList').classList.remove('show'); return 'handled'; }
  for (const [id, close] of [['lb', 'lbClose'], ['fb', 'fbClose'], ['redeem', 'rdClose'], ['shop', 'shopClose'], ['settings', 'setClose'], ['dex', 'dexClose']]) if (open(id)) { ($(close) as HTMLElement).click(); return 'handled'; }
  if (state === 'play') { toast('上工中按返回不會離開；要收工請按「回主選單」或等時間到', '#ffcf8a'); return 'handled'; }
  return 'confirm-exit';
}, () => state === 'play');

// ── 主畫面導覽（新玩家第一次看到主畫面時；阿婆逐一介紹按鈕）──
const HG: [string, string][] = [
  ['daily', '每天先來這裡領上工費，有錢才好買工具喔。'],
  ['start', '準備好了就按這裡開始剝蚵。'],
  ['oShop', '雜貨店可以買刀子、手套跟各種好用的東西。'],
  ['oDex', '剝到的珍珠和稀奇東西，都會記在圖鑑裡。'],
  ['oRank', '排行榜看看今天誰最會剝，也可以幫人按讚。'],
  ['oRedeem', '拿到兌換碼就在這裡輸入，有好禮可以領。'],
  ['discordStart', '來蚵寮群組聊天，兌換碼常常在那裡公布。'],
  ['oSet', '音量、名字跟重看教學，都在設定裡。'],
  ['locPick', '這裡可以換漁港，剝得越多，能去的地方越多。'],
];
let hgI = -1;
function hgShow() {
  const steps = HG.filter(([id]) => { const e = document.getElementById(id); return e && e.offsetParent; });
  let box = document.getElementById('hg'); if (!box) { box = document.createElement('div'); box.id = 'hg'; box.innerHTML = '<div id="hgHole"></div><div id="hgCall"><div id="hgTxt"></div><div class="hgB"><button id="hgSkip">略過</button><button id="hgNext">下一步</button></div></div>'; document.body.appendChild(box);
    let downOk = false; const t0 = () => Number(box!.dataset.t || 0);
    box.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); downOk = performance.now() - t0() > 350; });
    box.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); });
    box.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); if (!downOk) return; downOk = false;
      if ((e.target as HTMLElement).closest('#hgSkip')) hgEnd(); else hgStep(hgI + 1, steps2()); });
  }
  const steps2 = () => steps; (box as any)._s = steps; hgStep(0, steps);
}
function hgStep(i: number, steps: [string, string][]) {
  const box = $('hg'); if (i >= steps.length) { hgEnd(); return; } hgI = i; box.dataset.t = String(performance.now()); box.classList.add('show');
  const el = $(steps[i][0]); el.scrollIntoView({ block: 'center' });
  requestAnimationFrame(() => { const r = el.getBoundingClientRect(), H = innerHeight, p = 6; const hole = $('hgHole');
    Object.assign(hole.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + p * 2 + 'px', height: Math.min(r.height, H * 0.4) + p * 2 + 'px' });
    $('hgTxt').innerHTML = '<b>阿婆</b><span class="hgN">' + (i + 1) + '/' + steps.length + '</span><br>' + steps[i][1];
    $('hgNext').textContent = i === steps.length - 1 ? '知道了' : '下一步';
    const c = $('hgCall'); const below = r.top + r.height / 2 < H / 2; c.style.top = below ? Math.min(r.bottom + 16, H - 170) + 'px' : ''; c.style.bottom = below ? '' : Math.min(H - r.top + 16, H - 170) + 'px'; });
}
function hgEnd() { const b = document.getElementById('hg'); if (b) b.classList.remove('show'); hgI = -1; inputGuard(); try { LS.setItem('oyster-homeguide', '1'); } catch { } }
function hgMaybe() { if ((save.days || 0) >= 1 || LS.getItem('oyster-homeguide')) { return; } if ($('overlay').classList.contains('show')) setTimeout(hgShow, 600); }
$('hgReplay').onclick = () => { $('settings').classList.remove('show'); if (state === 'play') { toast('收工回到主畫面後再看導覽喔', '#ffcf8a'); return; } $('overlay').classList.add('show'); setTimeout(hgShow, 400); };
hgMaybe();

initUpdate(() => state !== 'play' && !document.querySelector('.panel.show:not(#overlay):not(.overlay)'));
(window as any).__tpTest = () => { const p = BOWL.clone().project(viewCam()); const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight; return { tp: tpOn, x: Math.round(x), y: Math.round(y), hit: nearBowl(x, y), farMiss: nearBowl(x > innerWidth / 2 ? 5 : innerWidth - 5, 5) }; };
(window as any).__cheer = () => react3('cheer');
(window as any).__aim = () => setPhase('aim');

// ---- 第三人稱雨傘：手舉起來撐一支立體傘（傘骨、傘面分片、把手），開合有動畫，被打中會晃 ----
const umb3 = new THREE.Group(); umb3.visible = false; me3.add(umb3);
const umb3Can = new THREE.Group(); umb3.add(umb3Can);
let umb3Open = 0, umb3Jolt = 0; const umbFx: { m: THREE.Mesh; t: number }[] = [];
function build3Umb() {
  while (umb3.children.length > 1) umb3.remove(umb3.children[1]); while (umb3Can.children.length) umb3Can.remove(umb3Can.children[0]);
  const pal: Record<string, number[]> = { stripe: [0xc8302a, 0xf4f0e8], clear: [0xcfe6ff, 0xe4f2ff], navy: [0x1f2b4a, 0x2a3c66], beach: [0xe83a3a, 0xf6c33a, 0x3ab0e8, 0x5ac85a], temple: [0xb0141a, 0xe8b030] };
  const cols = pal[umbLook] ?? pal.stripe, N = umbLook === 'temple' ? 12 : 8, R = 0.62 * umbSize, Hh = 0.24 * umbSize, clear = umbLook === 'clear';
  const metal = umbLook === 'temple' ? 0xd8a020 : 0x8a8a90;
  // 傘桿＋J 形把手
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), mat(metal), [0, 0.0, 0], umb3);
  const hd = mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 10, Math.PI), mat(umbLook === 'temple' ? 0xb0141a : 0x5a3a1a), [0.05, -0.47, 0], umb3); hd.rotation.z = Math.PI;
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), mat(umbLook === 'temple' ? 0xb0141a : 0x5a3a1a), [0, -0.42, 0], umb3);
  // 傘面：一片一片的三角面，每片顏色輪流
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, Hh, 0, Math.cos(a0) * R, 0, Math.sin(a0) * R, Math.cos(a1) * R, 0, Math.sin(a1) * R], 3)); g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: clear ? 0.1 : 0.8, transparent: clear, opacity: clear ? 0.5 : 1, flatShading: true });
    umb3Can.add(new THREE.Mesh(g, m));
    // 傘骨
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.hypot(R, Hh), 4), mat(metal));
    rib.position.set(Math.cos(a0) * R / 2, Hh / 2, Math.sin(a0) * R / 2); rib.lookAt(new THREE.Vector3(Math.cos(a0) * R, 0, Math.sin(a0) * R).add(umb3.position)); rib.rotateX(Math.PI / 2); umb3Can.add(rib);
    mesh(new THREE.SphereGeometry(0.014, 5, 4), mat(metal), [Math.cos(a0) * R, -0.005, Math.sin(a0) * R], umb3Can);
  }
  if (umbLook === 'temple') { const fr = mesh(new THREE.CylinderGeometry(R, R, 0.08, N, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe28a, side: THREE.DoubleSide }), [0, -0.04, 0], umb3Can); void fr; }
  mesh(new THREE.ConeGeometry(0.02, 0.08, 6), mat(metal), [0, Hh + 0.04, 0], umb3Can);
  umb3Can.position.y = 0.42;
}
build3Umb(); umb3Ready = true;
function umbHit3(at: THREE.Vector3) {
  if (!umb3Ready || !tpOn) return; umb3Jolt = 0.3;
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.95, depthWrite: false }));
  // 打中的點：拉到傘面上
  umb3Can.updateMatrixWorld(); const c = new THREE.Vector3(0, 0.15, 0); umb3Can.localToWorld(c); f.position.copy(c).lerp(at, 0.25); scene.add(f); umbFx.push({ m: f, t: 0 });
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xd8d0c0, transparent: true })); p.position.copy(f.position); p.userData.v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(2.2); scene.add(p); umbFx.push({ m: p, t: 0 }); }
}
function umbTick3(dt: number, show: boolean) {
  if (!umb3Ready) return;
  for (let i = umbFx.length - 1; i >= 0; i--) { const e = umbFx[i]; e.t += dt; const v = e.m.userData.v as THREE.Vector3 | undefined;
    if (v) { e.m.position.addScaledVector(v, dt); v.y -= 6 * dt; } else e.m.scale.setScalar(1 + e.t * 9);
    (e.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - e.t / 0.4); if (e.t > 0.4) { scene.remove(e.m); umbFx.splice(i, 1); } }
  const want = umbS > 0 ? 1 : 0; umb3Open += Math.sign(want - umb3Open) * Math.min(Math.abs(want - umb3Open), dt / 0.2 / umbSlow);
  umb3Jolt = Math.max(0, umb3Jolt - dt);
  const vis = show && umb3Open > 0.01; umb3.visible = vis; if (show) umb.visible = false;
  if (!vis) return;
  // 傘面像真的傘一樣從收起的細長往外撐開
  const o = umb3Open, e = 1 - Math.pow(1 - o, 3); umb3Can.scale.set(0.12 + 0.88 * e, 1.6 - 0.6 * e, 0.12 + 0.88 * e);
  const j = umb3Jolt > 0 ? Math.sin(umb3Jolt * 60) * umb3Jolt * 1.2 : 0;
  const st = walking ? 0.43 : 0;
  // 往前開傘：傘面朝前（殼飛來的方向），手往前伸握柄，傘稍微壓低偏右，不擋住手上的蚵仔
  umb3.position.set(0.22, 0.95 + st + 0.05 * e, -0.38 - 0.12 * e + j * 0.12); umb3.rotation.set(-1.15 * e - 0.2 - j, 0, -0.18 + j * 0.5);
}
function umbArm() { if (!umb3Ready || !umb3.visible) return; const e = 1 - Math.pow(1 - umb3Open, 3); meArmR.rotation.x = 1.35 * e + 0.2; meArmR.rotation.z = -0.1; }
(window as any).__umb3 = { open: () => openUmbrella(), close: () => closeUmbrella(), throwAt: () => throwOne(npcs[2]), get o() { return umb3Open; }, set slow(v: number) { umbSlow = v; } };
// iOS WebKit：面板從 display:none 變成顯示時，捲動容器內未進入畫面的內容（SVG、按鈕）有時不會繪製，
// 直到下一次重畫。顯示後下一幀強制重排並觸發一次重繪。
new MutationObserver(ms => { for (const m of ms) { const el = m.target as HTMLElement;
  if (el.classList.contains('panel') && el.classList.contains('show') && !(m.oldValue || '').includes('show'))
    requestAnimationFrame(() => { void el.offsetHeight; el.style.opacity = '0.999'; requestAnimationFrame(() => { el.style.opacity = ''; }); }); } })
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
