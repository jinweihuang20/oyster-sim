import { installBackGuard } from './backguard';
import { checkCode, REDEEM_MESSAGES } from './redeem';
import type { RedeemCodeDef } from './redeemCodes';
import * as THREE from 'three';

// ---------- 基本設定 ----------
const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // 截圖測試用
const SHIFT = 180;
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
for (const [x, z] of [[0, 0], [-2.2, -1.5], [2.2, 1.2]]) { mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbMat, [x, 2.55, z]); mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.45, 4), mat(0x111111), [x, 2.8, z]); }
const ground = mesh(new THREE.PlaneGeometry(14, 14), mat(0x6a6a66)); ground.rotation.x = -Math.PI / 2; // 水泥地
// 鐵皮厝頂 + 柱仔
const roofMat = mat(0x8a9aa0, { side: THREE.DoubleSide, metalness: 0.4 });
for (let i = 0; i < 12; i++) { const r = mesh(new THREE.BoxGeometry(0.62, 0.03, 8), i % 2 ? roofMat : mat(0x7a8a90, { metalness: 0.4 }), [-3.4 + i * 0.62, 3.05 + (i % 2) * 0.03, 0]); r.rotation.z = 0.06; }
for (const x of [-3.5, 3.5]) for (const z of [-3.5, 0, 3.5]) mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.1, 6), mat(0x5a4a3a), [x, 1.55, z]);
for (const z of [-3.5, 3.5]) mesh(new THREE.BoxGeometry(7.2, 0.1, 0.1), mat(0x5a4a3a), [0, 3.0, z]);
// 保麗龍箱、水桶、網仔、索仔、塑膠椅
for (let i = 0; i < 7; i++) mesh(new THREE.BoxGeometry(0.6, 0.35, 0.4), mat(0xf2f2ee), [-3 + (i % 3) * 0.62, 0.18 + Math.floor(i / 3) * 0.36, -3.0]);
for (const [x, z, c] of [[2.9, -2.5, 0x2f6fbf], [3.1, -1.9, 0xd07a2a], [-2.9, 2.6, 0x3a8a4a]] as const) mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 10), mat(c), [x, 0.2, z]);
const net = mesh(new THREE.SphereGeometry(0.7, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a7a6a, { wireframe: true }), [2.6, 0, 2.6]); net.scale.y = 0.4;
mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12), mat(0xd8b070), [-3.0, 0.05, -1.8]).rotation.x = Math.PI / 2;
for (const [x, z] of [[3.0, 0.5], [-3.0, 0.2]]) { mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.3, 8), mat(0xd04040), [x, 0.15, z]); }
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

// 玩家前面：生蚵面盆、裝肉的碗（愛投準）
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
  mesh(new THREE.BoxGeometry(0.42, 0.14, 0.45), mat(0x2a2a40), [0, 0.35, -0.15], g);
  const head = new THREE.Group(); head.position.set(0, 1.02, 0); g.add(head);
  mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(skin), [0, 0, 0], head);
  mesh(new THREE.SphereGeometry(0.155, 10, 8, 0, Math.PI * 2, 0, 1.4), mat(hair), [0, 0.02, 0.02], head);
  mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(hair), [0, 0.1, 0.13], head);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.018, 6, 4), mat(0x111111), [s * 0.05, 0.02, -0.14], head);
  mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), mat(0x803030), [0, -0.06, -0.145], head);
  const arm = (s: number) => { const p = new THREE.Group(); p.position.set(s * 0.2, 0.8, -0.02); g.add(p); mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 6), mat(top), [0, -0.12, -0.12], p).rotation.x = 1.1; mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(skin), [0, -0.2, -0.3], p); return p; };
  return { g, body, head, armL: arm(-1), armR: arm(1) };
}
type Npc = ReturnType<typeof makeAma> & { name: string; rate: number; chatty: number; peek: boolean; count: number; pause: number; look: number; bubble: HTMLDivElement; bubT: number; lean: number;
  cyc: number; dur: number; ev: number; mood: number; angry: number; distract: number; turnDir: number; windup: number; throwCd: number; stuck: THREE.Mesh | null; baseY: number; basinN?: number; scoopT?: number; clutch?: number; grudge?: number; gAt?: number; tag: HTMLButtonElement; calm?: number; gIcon?: THREE.Sprite; gBar?: THREE.Sprite; bump?: THREE.Object3D; bumpT?: number; oy: THREE.Group; top: THREE.Mesh; meat: THREE.Mesh; bowl: THREE.Vector3; bowlMeat: THREE.Mesh[] };
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
  '恁敢知，巷仔尾阿雄閣換頭路矣', '今仔日的蚵仔誠肥喔！', '阮孫講欲讀博士，我聽攏無', '聽講今仔日有人撥著烏珍珠喔', '撥較緊咧，等一下菜市仔欲收矣',
  '這擺颱風無來，蚵仔有夠讚', '我少年時一工撥兩千粒咧', '恁新婦有轉來無？', '珍珠喔～愈撥愈有機會啦', '蚵仔煎攤頭家講欲加訂',
  '啊～腰痠矣，歇一下', '昨昏電視彼齣真好看', '金色的珍珠，一世人看過一擺爾爾', '今仔日有幾粒硬甲若石頭咧',
];
const PEEK = ['欸，你彼粒是毋是有物件？', '我看覓咧～', '你撥偌濟矣？'];
const NAG_MISS = ['哎唷！肉擲落塗跤矣啦！', '你是咧投籃喔？準一點啦！', '蚵仔肉毋是按呢擲的啦', '拍損喔～一粒蚵仔也是錢呢', '目睭金金看碗啦！', '閣擲歪去矣，我看袂落去', '塗跤的蚵仔是欲予貓仔食喔？', '恁阿公若佇咧，一定罵你'];
const NAG_GIVEUP = ['遮爾仔緊就放棄喔？', '硬的才有肉啦，閣試看覓！', '少年人無耐性喔～', '彼粒會使撥啦，拍損！', '放棄？阮彼時陣毋敢按呢', '哎，蚵仔嘛是有生命的呢'];
const NAG_STAB = ['哎唷！慢慢仔來啦！', '刀仔利呢，細膩咧！', '流血矣啦，緊揉一下', '莫遐爾急，手較要緊', '你按呢欲去病院喔？'];
const NAG_CRACK = ['殼屑攏入去肉內矣啦！', '遐大力是欲拆厝喔？', '有殼屑的蚵仔無人欲買啦', '細膩扭，莫用蠻力'];
const NAG_SLIP = ['縫都揣無，閣硬插！', '先揣縫啦，戇囡仔', '刀仔毋是按呢用的'];
const SCOLD_HIT = ['啥人擲的！？', '蚵仔肉黏佇我頭殼頂啦！', '你是故意的乎！', '我頭鬃拄才洗的呢！'];
const SCOLD_SHELL = ['夭壽喔！擲殼仔！', '你欲討皮疼喔？', '好啊，你來啊！', '我共你講，我少年時陣是投手呢'];
const SCOLD_STEAL = ['掠著矣！偷蚵仔賊！', '你咧創啥！我的蚵仔！', '還來！兩倍還來！', '厝邊隔壁也敢偷！'];
const GRUDGE = ['哼，我無欲佮你講話', '某人喔，手腳毋清氣', '我會記牢咧', '今仔日真衰，坐佇你邊仔'];
const TURN_CHAT = ['欸欸，你聽我講…', '阿春仔，你敢知影…', '我共你講一个秘密', '彼个阿雄喔…'];
const PRAISE = ['好手路！', '有影準喔！', '彼粒擲甲真媠！'];
function say(n: Npc, t: string, dur = 3.2) { if (ac) SFX.murmur([300, 230, 380][npcs.indexOf(n)] ?? 300); n.bubble.textContent = t; n.bubble.style.opacity = '1'; n.bubT = dur; }
let lastNag = '';
function nag(lines: string[]) {
  if (Math.random() > seatNow().nag) return;
  let t = pick(lines); while (t === lastNag && lines.length > 1) t = pick(lines); lastNag = t;
  const n = npcs.find(x => x.peek && Math.random() < 0.5) ?? pick(npcs); n.look = 2.5; say(n, t, 3);
}

// ---------- 玩家的雙手（掛佇鏡頭） ----------
const handRig = new THREE.Group(); camera.add(handRig);
const sleeve = mat(0x3a5a8a);
function makeHand(s: number) {
  const h = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.7, 8), sleeve, [0, 0, 0.32], h).rotation.x = Math.PI / 2; // 長前臂延伸到畫面角落，兩手呈 A 字
  mesh(new THREE.BoxGeometry(0.11, 0.05, 0.13), mat(skin), [0, 0, -0.1], h);
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.022, 0.03, 0.07), mat(skin), [-0.04 + i * 0.026, -0.01, -0.19], h);
  mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), mat(skin), [s * -0.06, 0, -0.12], h).rotation.y = s * 0.6;
  return h;
}
const handL = makeHand(-1), handR = makeHand(1);
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
const seamMark = mesh(new THREE.BoxGeometry(0.035, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x201810 }), [0, 0.012, 0], oyster);
const seamGlow = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, depthWrite: false }), [0, 0.012, 0], oyster);
const shimmer = mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0, 0], oyster);
const pearlMesh = mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.3 }), [0, 0.05, 0], oyster);
pearlMesh.visible = false;
const leanFaces: THREE.Group[] = [];
for (const s of [-1, 1]) { const f = makeAma(s < 0 ? 0x2a7a5a : 0xb04050, s < 0 ? 0x333333 : 0xcccccc).head; f.removeFromParent(); f.rotation.y = Math.PI; f.scale.setScalar(1.3); camera.add(f); f.userData.s = s; f.position.set(s * 1.2, 0.05, -0.75); leanFaces.push(f); }

// ---------- 音效（全部 WebAudio 即時合成，無外部音檔） ----------
type Mix = { master: number; amb: number; sfx: number; mute: boolean ; music: number; gore: boolean; stats: boolean; sens: number; invX: boolean; invY: boolean };
const MIX_DEF = { master: 0.8, amb: 0.6, sfx: 0.8, mute: false, music: 0.35, gore: true, stats: true, sens: 1, invX: false, invY: false };
const mix: Mix = (() => { let raw: any = {}; try { raw = JSON.parse(localStorage.getItem('oyster-mix') || '{}') || {}; } catch { raw = {}; }
  const m: any = { ...MIX_DEF }; for (const k of Object.keys(MIX_DEF) as (keyof typeof MIX_DEF)[]) if (typeof raw[k] === typeof MIX_DEF[k]) m[k] = raw[k]; return m; })();
// ---------- 匿名統計（無個資；可於設定關閉） ----------
const STATS_URL = 'https://core-recycle-stats.jinweihuang1020.workers.dev/e';
const statsId = (() => { try { let v = localStorage.getItem('oyster-stats-id'); if (!v) { v = crypto.randomUUID(); localStorage.setItem('oyster-stats-id', v); } return v; } catch { return 'anon-' + Math.random().toString(36).slice(2, 14); } })();
let statsSid = '';
const COARSE = matchMedia('(pointer: coarse)').matches;
const statsDevice = COARSE ? 'mobile' : 'pc';
function track(t: string, d: Record<string, unknown> = {}) {
  if (!mix.stats || SHOT) return;
  try {
    const body = JSON.stringify({ game: 'oyster-sim', id: statsId, platform: 'web', version: '1', test: params.get('stattest') === '1', events: [{ t, sid: statsSid || statsId, ts: Date.now(), dev: statsDevice, ...d }] });
    fetch(STATS_URL, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' }).catch(() => { });
  } catch { }
}
let ac: AudioContext | null = null, masterG: GainNode, ambG: GainNode, sfxG: GainNode, musG: GainNode;
function applyMix() { if (!ac) { try { localStorage.setItem('oyster-mix', JSON.stringify(mix)); } catch { } return; } masterG.gain.value = mix.mute ? 0 : mix.master; ambG.gain.value = mix.amb; sfxG.gain.value = mix.sfx; musG.gain.value = mix.music * 0.5; try { localStorage.setItem('oyster-mix', JSON.stringify(mix)); } catch { } }
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
// ----- 台式電子琴 BGM（那卡西／廟口風，全部 WebAudio 合成） -----
function startMusic(a: AudioContext) {
  const BPM = 128, st = 60 / BPM / 2; // 8 分音符
  const N = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  // 五聲音階旋律（C D E G A），0 = 休止；32 步 × 2 段
  const mel = [76, 0, 79, 76, 74, 0, 72, 74, 76, 79, 81, 0, 79, 76, 74, 0, 72, 0, 74, 72, 69, 0, 67, 69, 72, 74, 76, 74, 72, 0, 0, 0,
               81, 0, 79, 81, 84, 0, 81, 79, 76, 79, 81, 0, 79, 0, 76, 74, 72, 74, 76, 79, 76, 74, 72, 69, 67, 0, 69, 72, 72, 0, 0, 0];
  const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [48, 52, 55], [45, 48, 52], [43, 47, 50], [48, 52, 55]]; // C Am F G C Am G C
  const out = a.createGain(); out.connect(musG);
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
  { id: 'wanggong', n: '⚓ 王功漁港', m: 1.2, w: [22, 40, 28, 10], thr: 1.2, ang: 1.15, price: 800, need: 150, tint: 0x5f8fb0, d: '海風大、硬殼多一點，阿婆稍微兇' },
  { id: 'dongshi', n: '🎡 東石漁人碼頭', m: 1.4, w: [14, 34, 36, 16], thr: 1.4, ang: 1.3, price: 2500, need: 500, tint: 0xd08a5a, d: '觀光客多、蚵仔偏硬，阿婆丟殼更勤' },
  { id: 'budai', n: '🏭 布袋蚵寮大廠', m: 1.7, w: [8, 26, 40, 26], thr: 1.7, ang: 1.5, price: 6000, need: 1200, tint: 0x8a9a7a, d: '工錢最高，但蚵仔超硬、阿婆最兇' }];
const locNow = () => LOCS.find(l => l.id === save.loc && (l.price === 0 || save.locs?.includes(l.id))) ?? LOCS[0];
const locW = () => locNow().w;
const RAR = [
  { name: '白珍珠', color: 0xf4f1ea, css: '#f4f1ea', w: 70, price: 200, emo: '⚪', tease: '最常見的珍珠，多剝幾粒就有' },
  { name: '粉珍珠', color: 0xf3b5c8, css: '#f3b5c8', w: 20, price: 600, emo: '🩷', tease: '聽說有粉紅色的，真媠' },
  { name: '金珍珠', color: 0xf2c440, css: '#f2c440', w: 8, price: 1800, emo: '🟡', tease: '金光閃閃的…有人講過' },
  { name: '烏珍珠', color: 0x22202a, css: '#3a3548', w: 2, price: 6000, emo: '⚫', tease: '傳說中的烏色寶貝，剝一世人才看一擺' },
];
const ODD = [
  { name: '假牙', css: '#f0e8e0', w: 30, emo: '🦷', tease: '聽說有人在蚵裡挖到…會笑的東西', price: 50, line: '啥人的假喙齒啦！？', cry: ['哎唷，彼毋是阿雄伯的？', '笑死人，假喙齒嘛會生蚵仔'] },
  { name: '古早硬幣', css: '#c08a40', w: 30, emo: '🪙', tease: '圓圓的、銀色的，老古董', price: 300, line: '日本時代的銀角仔！', cry: ['古董喔！會使賣錢！', '阮阿公以前嘛有收'] },
  { name: '金戒指', css: '#f2c440', w: 10, emo: '💍', tease: '某人的定情物遺落在海裡…', price: 2500, line: '金戒指！啥人的定情物？', cry: ['金的呢！予我看覓！', '這愛去報警無？'] },
  { name: '小螃蟹', css: '#e05a3a', w: 30, emo: '🦀', tease: '小心，會夾手！', price: 0, line: '螃蟹夾手矣！！', cry: ['緊甩！緊甩！', '哈哈哈，伊夾牢牢'] },
  { name: '統一發票', css: '#f4f4f0', w: 24, price: 5, emo: '🧾', tease: '溼溼的紙…上面有號碼', line: '啥人的發票塞入去蚵仔內！', cry: ['緊對看覓有中無！', '溼漉漉，號碼看無矣'] },
  { name: '幾枚銅板', css: '#c89a50', w: 24, price: 20, emo: '🪙', tease: '叮叮噹噹的零錢聲', line: '十箍、五箍…發財矣！', cry: ['蚵仔嘛會儉錢喔', '提去買飲料'] },
  { name: '機車鎖匙', css: '#a8b0b8', w: 16, price: 0, emo: '🔑', tease: '某人一直在找的東西', line: '啥人的機車鎖匙？！', cry: ['阿明仔揣規工矣！', '緊去廣播！'] },
  { name: '珍奶吸管', css: '#3a6ad8', w: 16, price: 1, emo: '🥤', tease: '粗粗的、塑膠的…海洋垃圾', line: '珍珠奶茶的粗吸管…', cry: ['海洋垃圾啦！', '毋是彼種珍珠啦'] },
  { name: '紅包', css: '#d8282a', w: 9, price: 600, emo: '🧧', tease: '紅紅的、過年才有', line: '紅包！內底有錢！', cry: ['恭喜發財！', '分一半予我啦'] },
  { name: '媽祖平安符', css: '#e8b030', w: 7, price: 888, emo: '🏮', tease: '有神明保庇的東西', line: '媽祖婆的平安符！', cry: ['媽祖保庇！', '今仔日一定好運'] },
  { name: '筊杯', css: '#c0302a', w: 6, price: 400, emo: '🌙', tease: '一對紅紅的半月', line: '一對筊杯！聖筊！', cry: ['問神明今仔日會贏無', '笑筊啦哈哈'] },
  { name: '大同電鍋公仔', css: '#e04a3a', w: 4, price: 1200, emo: '🍚', tease: '台灣人家家都有一台的…迷你版', line: '大同電鍋迷你公仔！', cry: ['收藏價值高喔！', '阮兜彼台用三十冬矣'] },
  { name: '中獎發票', css: '#ffe07a', w: 1, price: 8000, emo: '🎫', tease: '傳說有人在蚵裡挖到千萬…', line: '中獎矣！！是頭獎！', cry: ['緊去領！緊去領！', '請客！請客！'] },
];
const dexN = () => save.dex.filter(x => x).length + save.odd.filter(x => x).length;
const rarOf = (w: number) => w <= 2 ? 'legend' : w <= 10 ? 'rare' : w <= 20 ? 'uncommon' : 'common';
const OYSTER_PRICE = 3, CRACK_PRICE = 1;
// ----- 存檔（有版本號；舊存檔會自動補欄位，壞去就用預設） -----
const SAVE_V = 3;
const LIFE_KEYS = ['opened', 'inBowl', 'missed', 'wasteShells', 'cracked', 'perfects', 'abandoned', 'stabs', 'steals', 'caught', 'meatHits', 'shellHits', 'hitsTaken', 'blocks', 'reflects', 'lost', 'bestCombo'] as const;
type Life = Record<typeof LIFE_KEYS[number], number>;
type Save = { v: number; dex: number[]; odd: number[]; best: number; money: number; days: number; queen: number; life: Life; titles: Record<string, number>; shop: { owned: string[]; equipped: Record<string, string> }; seat?: string; bonusDay?: string; bonusN?: number; tutDone?: number; locs?: string[]; loc?: string; redeemed: string[]; meds: Record<string, number> };
function defaultSave(): Save { return { v: SAVE_V, redeemed: [], meds: {}, dex: [0, 0, 0, 0], odd: ODD.map(() => 0), best: 0, money: 0, days: 0, queen: 0, life: Object.fromEntries(LIFE_KEYS.map(k => [k, 0])) as Life, titles: {}, shop: { owned: [], equipped: {} } }; }
function loadSave(): Save {
  const d = defaultSave(); let raw: any = null;
  try { raw = JSON.parse(localStorage.getItem('oyster-sim') || 'null'); } catch { raw = null; }
  if (!raw || typeof raw !== 'object') return d;
  const num = (x: any, def = 0) => (typeof x === 'number' && isFinite(x) ? x : def);
  const arr4 = (a: any) => [0, 1, 2, 3].map(i => num(Array.isArray(a) ? a[i] : 0));
  // v1（無 v 欄位）→ v2：加 life／titles／shop
  const out: Save = { ...d, dex: arr4(raw.dex), odd: ODD.map((_, i) => num(Array.isArray(raw.odd) ? raw.odd[i] : 0)), best: num(raw.best), money: num(raw.money), days: num(raw.days), queen: num(raw.queen) };
  for (const k of LIFE_KEYS) out.life[k] = num(raw.life?.[k]);
  if (raw.titles && typeof raw.titles === 'object') for (const [k, v] of Object.entries(raw.titles)) out.titles[k] = num(v);
  if (Array.isArray(raw.shop?.owned)) out.shop.owned = raw.shop.owned.filter((x: any) => typeof x === 'string');
  if (raw.shop?.equipped && typeof raw.shop.equipped === 'object') for (const [k, v] of Object.entries(raw.shop.equipped)) if (typeof v === 'string') out.shop.equipped[k] = v;
  if (typeof raw.seat === 'string') out.seat = raw.seat;
  if (typeof raw.bonusDay === 'string') out.bonusDay = raw.bonusDay;
  out.bonusN = num(raw.bonusN); out.tutDone = num(raw.tutDone);
  if (raw.meds && typeof raw.meds === 'object') for (const [k, v] of Object.entries(raw.meds)) out.meds[k] = Math.max(0, Math.floor(num(v)));
  out.locs = Array.isArray(raw.locs) ? raw.locs.filter((x: any) => typeof x === 'string') : []; if (typeof raw.loc === 'string') out.loc = raw.loc;
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
const persist = () => { try { localStorage.setItem('oyster-sim', JSON.stringify(save)); } catch { /* 私密模式等 */ } };
persist();
let dry = 0;
const wpick = (arr: { w: number }[]) => { let r = Math.random() * arr.reduce((s, x) => s + x.w, 0); for (let i = 0; i < arr.length; i++) { r -= arr[i].w; if (r < 0) return i; } return 0; };
// 幸運值：每點 找著機率 ×(1+0.12×luck)；非普通物件權重 ×(1+0.15×luck)，傳說最多 ×1.3
const luckNow = () => Math.max(0, (knifeNow().luck || 0) + medA('luck'));
const luckW = (arr: { w: number }[], l: number) => arr.map(x => ({ w: x.w <= 2 ? x.w * Math.min(1.3, 1 + 0.15 * l) : x.w <= 20 ? x.w * (1 + 0.15 * l) : x.w }));
function rollFind(): { kind: 'pearl' | 'odd' | 'none'; i: number } {
  const l = luckNow(), f = 1 + 0.12 * l;
  const p = (1 / 50 + Math.max(0, dry - 40) * 0.01) * f;
  if (Math.random() < p) { dry = 0; return { kind: 'pearl', i: wpick(luckW(RAR, l)) }; }
  dry++;
  if (Math.random() < (1 / 24) * f) return { kind: 'odd', i: wpick(luckW(ODD, l)) };
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
    else { mesh(new THREE.BoxGeometry(0.055, 0.003, 0.075), mat(0xffe07a, { emissive: 0x806010, roughness: 0.3 } as any), [0, 0.005, 0], g); }
  }
  return g;
});
// 紅白雨傘（傳統菜市仔款）
const umb = new THREE.Group(); camera.add(umb); umb.visible = false;
let umbSize = 1;
function buildUmb(look: string, size: number) {
  while (umb.children.length) umb.remove(umb.children[0]); umbSize = size;
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
const IDEAL = 0.75; let PERF0 = 0.7, PERF1 = 0.8;
const HINTS: Record<Phase, string> = {
  pick: COARSE ? '看家己的紅面盆，點一粒蚵仔（或點家己的手）提起來（細粒較好撬，烏閣粗的較硬）' : '看家己的紅面盆，點一粒蚵仔（或按 Space）提起來（細粒較好撬，烏閣粗的較硬）',
  scoop: '撈蚵仔中…',
  seam: COARSE ? '按牢 ◀ ▶ 或拖蚵仔來轉，揣殼縫；縫對著刀尖時點一下蚵仔插刀（拖別位是看四周）' : '滾輪／A D 轉蚵仔揣殼縫，縫對著刀尖時點一下（或 Space）插刀',
  twist: COARSE ? '看指針來回擺動，走到綠區時點一下螢幕撬一下；撬夠次數殼就打開。點在紅區太用力會把殼弄碎' : '看指針來回擺動，走到綠區時點一下滑鼠（或按 Space）撬一下；撬夠次數殼就打開。點在紅區太用力會把殼弄碎',
  aim: COARSE ? '拖畫面轉頭對準藍色碗，按牢螢幕蓄力，藍色區間放開投肉！' : '滑鼠轉頭對準藍色碗，按牢（滑鼠／Space）蓄力，藍色區間放開投肉！',
  empty: COARSE ? '空殼仔：按「丟殼」對準阿婆擲過去，或者等一下自動擲掉' : '空殼仔：F／右鍵對準阿婆擲過去，或者等一下自動擲掉',
  crab: COARSE ? '螃蟹夾手矣！緊狂點螢幕共甩掉！' : '螃蟹夾手矣！緊連點（滑鼠／Space）共甩掉！',
  busy: '',
};
const on = (id: string, v: boolean) => $(id).classList.toggle('on', v);
function setPhase(p: Phase) {
  phase = p; holding = false; hold = 0; fill.style.marginLeft = '0'; zone.style.left = ''; zone.style.width = ''; if (p === 'twist') { needleStart = performance.now(); combo = 0; } gauge.classList.remove('on', 'aim', 'tw');
  if (p === 'aim') gauge.classList.add('aim'); if (p === 'twist') gauge.classList.add('tw', 'on');
  on('reticle', p === 'aim' || p === 'empty' || p === 'pick' || (document.pointerLockElement === canvas && p !== 'busy')); on('giveUp', (p === 'seam' || p === 'twist') && state === 'play'); on('prog', p === 'twist' || p === 'crab');
  on('rotL', p === 'seam'); on('rotR', p === 'seam'); on('throwBtn', (p === 'seam' || p === 'empty') && state === 'play');
  if (p !== 'busy') hint.textContent = HINTS[p];
  const d = DIFF[diff];
  if (p === 'aim') { const TW = tut ? 0.12 : 0; zone.style.left = `${(PERF0 - TW) * 100}%`; zone.style.width = `${(PERF1 - PERF0 + 2 * TW) * 100}%`; $('diff').textContent = crackedNow ? '⚠ 有殼屑' : ''; }
  if (p === 'twist') { zone.style.left = `${d.lo * 100}%`; zone.style.width = `${(d.hi - d.lo) * 100}%`; progress = 0; strokeDir = 0; strokeLen = 0; strokePeak = 0; }
  if (p === 'seam' || p === 'twist') updDiff();
}
function updDiff() { const d = DIFF[diff], el = $('diff'); el.style.color = d.css; el.textContent = `難度：${d.n}${phase === 'twist' ? `・要撬 ${pryNeed()} 下` : ''}${crackedNow ? '・⚠ 有殼屑' : ''}`; }
function goPick() { if (state !== 'play' || walking) return; oyster.visible = false; setPhase('pick'); if (!basinOy.length) hint.textContent = '面盆空矣！轉頭看中央的蚵殼山，點一下撈一把'; }
function holdOyster(dd: number) {
  if (state !== 'play' || walking) return;
  diff = tut ? 0 : dd; const d = DIFF[diff];
  oyster.visible = true; oyster.rotation.set(0, 0, 0); rot = rnd(0, 6.28); crackedNow = false;
  seamA = rnd(0, 6.28); const r = 0.115; seamMark.position.set(Math.cos(seamA) * r, 0.012, Math.sin(seamA) * r); seamMark.rotation.y = -seamA + Math.PI / 2; seamGlow.position.copy(seamMark.position); seamGlow.rotation.copy(seamMark.rotation);
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
}
let nightShift = false, walkHintShown = false;
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
  const tn = locNow().tint; (scene.background as THREE.Color).setHex(L(1)); (scene.fog as THREE.Fog).color.setHex(L(2)); if (tn !== null) { _c2.setHex(tn); (scene.background as THREE.Color).lerp(_c2, 0.3); (scene.fog as THREE.Fog).color.lerp(_c2, 0.3); } hemi.color.setHex(L(3));
  hemi.intensity = a[4] + (b[4] - a[4]) * f; sun.intensity = a[5] + (b[5] - a[5]) * f;
  const nn = document.getElementById('nightNote'); if (nn) nn.textContent = isNight() ? '🌙 現在是夜班時段：這一工收入 +20%' : '💡 晚上 8 點到早上 5 點上工是夜班，收入 +20%';
}
updSky(); setInterval(updSky, 30000);
function startDay() {
  nightShift = isNight(); updSky(); $('nightTag').style.display = nightShift ? '' : 'none'; if (nightShift) later(1.5, () => toast('🌙 夜班上工！這一工收入 +20%', '#b8c8ff'));
  npcs.forEach(dressAma);
  if (walking) { walking = false; on('seatCard', false); on('joy', false); handRig.visible = true; stools.forEach(g => g.userData.tag.visible = false); tYaw = yaw = 0; tPitch = pitch = -0.85; }
  state = 'play'; handPain = false; for (const k in medT) delete medT[k]; drawMeds(); timeLeft = SHIFT; hp = 100; dayCombo = 0;
  statsSid = crypto.randomUUID?.() ?? statsId + '-' + Date.now(); if (!tut) track('start', { seat: save.seat ?? 'door', loc: locNow().id });
  const sidNow = statsSid; const pingT = setInterval(() => { if (tut || state !== 'play' || statsSid !== sidNow || document.hidden) { if (statsSid !== sidNow || state !== 'play') clearInterval(pingT); return; } track('ping'); }, 60_000);
  count = bowlBonus = cracked = opened = missed = abandoned = perfects = stabs = steals = caught = penalty = meatHits = shellHits = blocks = hitsTaken = reflects = wasteShells = thrown = lost = blockStreak = 0; dayPearls = []; dayOdd = []; dayMulti2 = dayMulti3 = 0; meatsLeft = 1; showExtra();
  dayMaxGrudge = 0; npcs.forEach(n => { n.count = 0; n.mood = 0; n.angry = 0; n.distract = 0; n.windup = 0; n.grudge = 0; n.gAt = 0; n.calm = 0; n.clutch = 0; n.throwCd = rnd(15, 30); if (n.stuck) { n.stuck.removeFromParent(); n.stuck = null; } });
  [...bowlMeat, ...splats].forEach(m => scene.remove(m)); bowlMeat.length = 0; splats.length = 0;
  ['overlay', 'result', 'dex'].forEach(i => $(i).classList.remove('show')); on('umbBtn', true); on('medBtn', !tut); on('quitBtn', !tut); drawMeds(); basinOy.forEach(m => scene.remove(m)); basinOy.length = 0; fillBasin(false); goPick(); if (!SHOT && !tut && !matchMedia('(pointer: coarse)').matches) canvas.requestPointerLock?.(); updHud();
}
function updHud() {
  ($('hpFill') as HTMLElement).style.width = `${hp}%`;
  const s = Math.max(0, Math.ceil(timeLeft)); $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('count').textContent = `🦪 ${count}`; $('pearls').textContent = `⚪ ${dayPearls.length + dayOdd.length}`;
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
  n.clutch = rnd(3, 5) * power; n.pause = Math.max(n.pause, n.clutch); n.windup = 0; SFX.aia(); later(0.15, () => tone(380, 0.6, 0.12, 'sawtooth', 0, 220)); say(n, pick(['哎唷喂啊！我的頭！', '夭壽喔！流血矣啦！', '你這囡仔！擲我頭殼！']));
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
function hurt(dmg: number, txt: string) { if (tut) dmg = 0; dmg *= medM('dmg'); hp = Math.max(0, hp - dmg); shake = 0.3; hurtT = 0.9; SFX.aia(); toast(txt, '#ff9a8a'); updHud(); if (hp <= 0 && state === 'play') { handPain = true; setPhase('busy'); later(0.8, endDay); } }

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
  for (let i = 0; i < 8; i++) { const m = makeBasinOyster(wpick(locW().map(w => ({ w })))); const slot = basinSlot(i); m.rotation.set(rnd(-0.2, 0.2), rnd(0, 6), rnd(-0.2, 0.2)); basinOy.push(m);
    if (animate) { const p0 = pileSpot(); fly(m, p0, slot, 0.4 + i * 0.05, 0.4, () => m.position.copy(slot)); } else { m.position.copy(slot); scene.add(m); } }
}
function hitsOyster(cx: number, cy: number) { camera.updateMatrixWorld(); ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera); return ray.intersectObject(oyster, true).length > 0; }
function pickAt(cx: number, cy: number) {
  if (phase !== 'pick' || state !== 'play') return;
  camera.updateMatrixWorld();
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObjects(basinOy, true)[0];
  if (hit) { let o: THREE.Object3D = hit.object; while (!basinOy.includes(o as THREE.Mesh)) o = o.parent!; grab(o as THREE.Mesh); return; }
  // 點著家己的手／手骨（或附近）：揀螢幕上上近的蚵仔
  let best: THREE.Mesh | null = null, bd = Math.max(110, innerWidth * 0.12);
  for (const m of basinOy) { const p = m.position.clone().project(camera); if (p.z > 1) continue; const d = Math.hypot((p.x + 1) / 2 * innerWidth - cx, (1 - p.y) / 2 * innerHeight - cy); if (d < bd) { bd = d; best = m; } }
  if (best) { grab(best); return; }
  if (ray.intersectObject(pileHit, false).length || ray.intersectObject(pile, false).length) { scoop(); return; }
  hint.textContent = basinOy.length ? '點面盆內的蚵仔' : '面盆空矣！點中央的蚵殼山撈一把';
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
  if (Math.abs(seamErr()) < tolNow()) { noise(0.06, 3000, 0.4); tone(320, 0.08, 0.2, 'triangle', 0, 200); toast('插入去矣！', '#9be37a'); seamGlow.visible = false; setPhase('twist'); }
  else if (Math.random() < slipNow()) { stabs++; flinch = 0.6; nag(NAG_STAB); hint.textContent = '刀仔滑去，割著手矣！'; setPhase('busy'); bleed(16); hurt(10 + diff * 5, 'aiā！'); if (hp > 0) later(0.7, () => setPhase('seam')); }
  else { tone(140, 0.08, 0.2, 'square'); hint.textContent = '無對縫，刀仔滑開矣！閣揣看覓'; if (Math.random() < 0.3) nag(NAG_SLIP); shake = 0.08; }
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
const PRY = [{ w: 0.3, sp: 0.8 }, { w: 0.22, sp: 1.05 }, { w: 0.15, sp: 1.35 }, { w: 0.1, sp: 1.7 }];
const PRY_NEED = [2, 3, 4, 5], PRY_C = 0.55, PRY_RED = 0.86;
let needleStart = 0, combo = 0, dayCombo = 0;
// ----- 剝殼刀（各有利弊） -----
type Knife = { id: string; n: string; price: number; green: number; speed: number; steps: number; stab: number; seam: number; luck: number; blade: number; desc: string };
const KNIVES: Knife[] = [
  { id: 'basic', luck: 1, n: '舊蚵刀', price: 0, green: 1, speed: 1, steps: 0, stab: 1, seam: 1, blade: 0xd0d0d8, desc: '阿母留落來的，普普仔' },
  { id: 'dull', luck: 3, n: '俗鈍刀', price: 20, green: 0.7, speed: 0.85, steps: 0, stab: 1.5, seam: 1, blade: 0x8a8a80, desc: '夜市 20 箍，指針較慢、運氣特別好，毋過綠區細、真捷割著手' },
  { id: 'wide', luck: 0, n: '闊喙刀', price: 150, green: 1.5, speed: 1.35, steps: 0, stab: 1, seam: 0.85, blade: 0xe8e0c8, desc: '刀面闊，綠區大，毋過指針緊、揣縫較歹' },
  { id: 'point', luck: 2, n: '尖喙刀', price: 200, green: 0.9, speed: 1, steps: -1, stab: 1.6, seam: 1, blade: 0xb0c8e0, desc: '尖尖一下就入去，少撬一下，較有運，毋過較危險' },
  { id: 'seam', luck: 0, n: '揣縫刀', price: 180, green: 0.9, speed: 1.1, steps: 0, stab: 0.8, seam: 1.6, blade: 0xc8e0b0, desc: '揣縫真簡單，撬的時陣較食力' },
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
// ----- 盆仔（投肉用） -----
type Bowl = { id: string; n: string; price: number; r: number; bounce: number; dist: number; perf: number; bonus: number; h: number; color: number; metal?: number; desc: string };
const BOWLS: Bowl[] = [
  { id: 'plastic', n: '塑膠面盆', price: 0, r: 0.17, bounce: 0, dist: 1, perf: 0.10, bonus: 0, h: 0.14, color: 0x4a8ac0, desc: '藍色塑膠盆，普通' },
  { id: 'wide', n: '大面盆', price: 120, r: 0.27, bounce: 0.3, dist: 1, perf: 0.10, bonus: 0, h: 0.06, color: 0xd04a3a, desc: '闊閣淺，好投，毋過無準會彈出來' },
  { id: 'bucket', n: '深桶', price: 180, r: 0.12, bounce: 0, dist: 1.1, perf: 0.08, bonus: 1, h: 0.34, color: 0x3a8a4a, desc: '深閣窄，入去就袂走，肉較鮮一粒加 $1' },
  { id: 'low', n: '矮盆', price: 150, r: 0.16, bounce: 0.1, dist: 0.7, perf: 0.16, bonus: 0, h: 0.08, color: 0xe0b030, desc: '囥較近、較矮，拋物線好抓，完美窗闊' },
  { id: 'steel', n: '不銹鋼盆', price: 900, r: 0.21, bounce: 0.05, dist: 0.9, perf: 0.13, bonus: 1, h: 0.15, color: 0xd8dde4, metal: 0.9, desc: '專業級，樣樣好，就是貴' },
];
// ----- 位仔（換位） -----
type Seat = { id: string; n: string; a: number; r: number; scoop: number; bowl: number; perf: number; nag: number; throwM: number; steal: number; pro: string; con: string };
const SEATS: Seat[] = [
  { id: 'door', n: '門口位', a: 0, r: 2.0, scoop: 1, bowl: 1, perf: 0, nag: 1, throwM: 1, steal: 1, pro: '平衡，啥物攏普通', con: '—' },
  { id: 'pile', n: '蚵山邊', a: 0.85, r: 1.75, scoop: 0.55, bowl: 1.2, perf: 0, nag: 1, throwM: 1.25, steal: 1, pro: '撈蚵仔快 45%', con: '碗較遠 +20%、殼仔較濟擲過來 +25%' },
  { id: 'bowl', n: '碗邊位', a: -0.85, r: 2.0, scoop: 1.4, bowl: 0.7, perf: 0.04, nag: 1, throwM: 1, steal: 1, pro: '碗較近 -30%、完美窗 +4%', con: '撈蚵仔慢 40%' },
  { id: 'gossip', n: '阿春邊仔', a: 2.5, r: 1.95, scoop: 1, bowl: 1, perf: 0, nag: 2, throwM: 1.3, steal: 1.6, pro: '阿婆講話較久，好偷 +60%', con: '唸你 ×2、殼仔 +30%' },
  { id: 'corner', n: '角落', a: -0.35, r: 2.7, scoop: 1.5, bowl: 1.25, perf: 0, nag: 0.5, throwM: 0.5, steal: 1, pro: '殼仔較少 -50%、較少人唸 -50%', con: '撈蚵仔慢 50%、碗較遠 +25%' },
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
  const b = bowlNow(), S = seatNow(); BOWL_R = b.r; const pw = b.perf + S.perf; PERF0 = IDEAL - pw / 2; PERF1 = IDEAL + pw / 2;
  BOWL_L.set(SEAT0.x + (BOWL0.x - SEAT0.x) * b.dist * S.bowl, BOWL0.y, SEAT0.z + (BOWL0.z - SEAT0.z) * b.dist * S.bowl); buildBowl(b);
  seatRig.updateMatrixWorld(true); const w = seatRig.localToWorld(BOWL_L.clone()); BOWL.x = w.x; BOWL.z = w.z;
}
const knifeNow = () => KNIVES.find(k => k.id === save.shop.equipped.knife) ?? KNIVES[0];
const pryW = () => Math.min(0.6, PRY[diff].w * knifeNow().green * medM('green'));
const PRY_SLOW = 0.8; // 整體放慢 20%
const prySp = () => PRY[diff].sp * PRY_SLOW * knifeNow().speed * medM('speed');
const pryNeed = () => Math.max(1, PRY_NEED[diff] + knifeNow().steps);
const tolNow = () => DIFF[diff].tol * knifeNow().seam;
const slipNow = () => tut ? 0 : Math.min(0.9, DIFF[diff].slip * knifeNow().stab * medM('slip'));
function pctTxt(v: number, goodHigh: boolean) { if (v === 1) return '<span style="opacity:.6">—</span>'; const p = Math.round((v - 1) * 100), good = goodHigh ? p > 0 : p < 0; return `<b style="color:${good ? '#9be37a' : '#ff8a7a'}">${p > 0 ? '+' : ''}${p}%</b>`; }
function renderShop() {
  if (!save.shop.owned.includes('basic')) save.shop.owned.push('basic');
  const cur = knifeNow().id;
  $('shopList').innerHTML = `<p>錢：<b>$${save.money}</b></p><h3>🔪 剝殼刀</h3><table class="kt"><tr><th>刀</th><th>綠區</th><th>指針速</th><th>撬幾下</th><th>割手率</th><th>揣縫</th><th>幸運</th><th></th></tr>` + KNIVES.map(k => {
    const own = save.shop.owned.includes(k.id);
    const btn = k.id === cur ? '<b>使用中</b>' : own ? `<button data-eq="${k.id}">換</button>` : `<button data-buy="${k.id}" ${save.money < k.price ? 'disabled' : ''}>$${k.price}</button>`;
    return `<tr><td><b>${k.n}</b><br><small>${k.desc}</small></td><td>${pctTxt(k.green, true)}</td><td>${pctTxt(k.speed, false)}</td><td>${k.steps ? `<b style="color:${k.steps < 0 ? '#9be37a' : '#ff8a7a'}">${k.steps > 0 ? '+' : ''}${k.steps}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${pctTxt(k.stab, false)}</td><td>${pctTxt(k.seam, true)}</td><td>${k.luck ? `<b style="color:#f2c440">${'🍀'.repeat(k.luck)}</b>` : '<span style="opacity:.6">—</span>'}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!save.shop.owned.includes('stripe')) save.shop.owned.push('stripe');
  const cu = umbNow().id, B = UMBS[0];
  const rel = (v: number, b: number, goodHigh: boolean, unit: string) => { if (v === b) return `<span style="opacity:.6">${v}${unit}</span>`; const good = goodHigh ? v > b : v < b; return `<b style="color:${good ? '#9be37a' : '#ff8a7a'}">${v}${unit}</b>`; };
  $('shopList').innerHTML += `<h3>☂ 雨傘</h3><table class="kt"><tr><th>傘</th><th>開傘</th><th>可撐</th><th>完美窗</th><th>遮</th><th>反彈力</th><th></th></tr>` + UMBS.map(u => {
    const own = save.shop.owned.includes(u.id);
    const btn = u.id === cu ? '<b>使用中</b>' : own ? `<button data-ueq="${u.id}">換</button>` : `<button data-ubuy="${u.id}" ${save.money < u.price ? 'disabled' : ''}>$${u.price}</button>`;
    return `<tr><td><b>${u.n}</b><br><small>${u.desc}</small></td><td>${rel(u.open, B.open, false, 's')}</td><td>${rel(u.dur, B.dur, true, 's')}</td><td>${rel(u.perf, B.perf, true, 's')}</td><td>${rel(Math.round(u.cover * 100), 95, true, '%')}</td><td>${rel(u.reflect, 1, true, '×')}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
  if (!save.shop.owned.includes('plastic')) save.shop.owned.push('plastic');
  const cb = bowlNow().id, P = BOWLS[0];
  $('shopList').innerHTML += `<h3>🥣 盆仔</h3><table class="kt"><tr><th>盆</th><th>盆口</th><th>彈出</th><th>距離</th><th>完美窗</th><th>加價</th><th></th></tr>` + BOWLS.map(b => {
    const own = save.shop.owned.includes(b.id);
    const btn = b.id === cb ? '<b>使用中</b>' : own ? `<button data-beq="${b.id}">換</button>` : `<button data-bbuy="${b.id}" ${save.money < b.price ? 'disabled' : ''}>$${b.price}</button>`;
    return `<tr><td><b>${b.n}</b><br><small>${b.desc}</small></td><td>${rel(Math.round(b.r / P.r * 100), 100, true, '%')}</td><td>${rel(Math.round(b.bounce * 100), 0, false, '%')}</td><td>${rel(Math.round(b.dist * 100), 100, false, '%')}</td><td>${rel(Math.round(b.perf * 100), 10, true, '%')}</td><td>${rel(b.bonus, 0, true, '$')}</td><td>${btn}</td></tr>`; }).join('') + '</table>';
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
    if (b.hasAttribute('data-buy')) { if (save.money < k.price) return; save.money -= k.price; save.shop.owned.push(id); track('buy', { item: id, price: k.price }); if (ac) SFX.jingle(); }
    save.shop.equipped.knife = id; persist(); applyKnife(); renderShop();
  });
  renderMedShop(); shopTabs();
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
  if (n > PRY_RED) { combo = 0; progress += 1 / need; SFX.creak(); pryFx(false, '碎！'); if (!crackedNow) { crackedNow = true; noise(0.1, 4000, 0.5); noise(0.25, 6000, 0.3); shake = 0.15; toast('傷大力，殼碎去矣！', '#ffa860'); meatInHand.material = splatMat; nag(NAG_CRACK); updDiff(); } }
  else if (Math.abs(n - PRY_C) <= w / 2) { progress += 1 / need; combo++; if (combo > dayCombo) dayCombo = combo; if (combo > save.life.bestCombo) { save.life.bestCombo = combo; persist(); } SFX.creak(); tone(1500, 0.04, 0.12, 'square'); tone(2200, 0.05, 0.08, 'triangle', 0.03); shake = 0.05; const k = Math.round(progress * need); pryFx(true, `✓ ${k}/${need}${combo >= 2 ? `　連擊 x${combo}` : ''}`); hint.textContent = combo >= 3 ? '讚！手路真好！' : '好！閣一下'; }
  else { combo = 0; tone(140, 0.12, 0.12, 'triangle'); noise(0.06, 300, 0.2); pryFx(false, '✗ 無著'); hint.textContent = '時機不對，等指針走到綠區再點'; tension = 0.3; return; }
  shellTop.rotation.z = -progress * 0.4;
  if (progress >= 0.999) openOyster();
}
function halfTwist(peak: number) {
  const d = DIFF[diff];
  if (peak < d.lo) { hint.textContent = '力氣不夠，再用力一點！'; return; }
  progress += 1 / d.need; SFX.creak();
  if (peak > d.hi && !crackedNow) { crackedNow = true; noise(0.1, 4000, 0.5); noise(0.25, 6000, 0.3); shake = 0.15; toast('殼碎去矣！', '#ffa860'); meatInHand.material = splatMat; nag(NAG_CRACK); updDiff(); }
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
  crackSound(); shake = 0.25; opened++; setPhase('busy'); seamMark.visible = false;
  if (crackedNow) cracked++;
  shellTop.visible = false;
  const top = new THREE.Mesh(halfGeo, shellTopMat); fly(top, worldOf(oyster), pileSpot(), 0.6, 0.5, () => scene.remove(top));
  if (find.kind === 'pearl') { revealPearl(find.i); later(2.5, () => { pearlMesh.visible = false; setPhase('aim'); }); }
  else if (find.kind === 'odd') revealOdd(find.i);
  else later(0.2, () => setPhase('aim'));
  updHud();
}
function revealOdd(i: number) {
  const o = ODD[i]; dayOdd.push(i); save.odd[i]++; persist(); track('find', { kind: 'odd', item: 'odd-' + i, rarity: rarOf(o.w), seat: save.seat ?? 'door', knife: knifeNow().id, luck: luckNow(), dex: dexN() }); oddMeshes[i].visible = true;
  slowmo = 1.8; pearlShow = 2.2; SFX.jingle(i !== 3);
  label.innerHTML = `${o.name}！<small>${o.line}</small><small>${save.odd[i] === 1 ? '🆕 第一次找到！' : `你的第 ${save.odd[i]} 個`}</small>`; label.style.color = o.css; label.classList.add('on');
  npcs.forEach((n, k) => { n.look = 2.4; say(n, o.cry[k % o.cry.length], 2.4); });
  if (i === 3) { later(0.6, () => { flinch = 1; SFX.pinch(); bleed(8); hurt(4, '夾！'); crabShakes = 0; strokeDir = 0; strokeLen = 0; setPhase('crab'); }); }
  else later(2.2, () => { oddMeshes[i].visible = false; setPhase('aim'); });
}
function crabOff() {
  const c = oddMeshes[3]; c.visible = false; const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xd04a2a)); m.scale.y = 0.5;
  fly(m, worldOf(oyster), new THREE.Vector3(rnd(-1, 1), 0.02, rnd(0.3, 1.5)), 0.6, 0.4, () => { later(3, () => scene.remove(m)); });
  toast('甩掉矣！', '#9be37a'); setPhase('busy'); later(0.4, () => setPhase('aim'));
}
// ----- 3. 投肉 -----
function aimPoint() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const t = dir.y < -0.05 ? (BOWL.y - camera.position.y) / dir.y : 6;
  const p = camera.position.clone().addScaledVector(dir, t);
  const off = p.sub(camera.position).setY(0); if (off.length() > 3) off.setLength(3);
  return camera.position.clone().add(off).setY(BOWL.y);
}
function npcNear(p: THREE.Vector3, r: number) { return npcs.find(n => Math.hypot(n.g.position.x - p.x, n.g.position.z - p.z) < r); }
function shoot(power: number) {
  setPhase('busy');
  const TW = tut ? 0.12 : 0; const perfect = power >= PERF0 - TW && power <= PERF1 + TW; // 教學時藍區較闊
  if (perfect) { perfects++; toast('完美出手！', '#9fe0ff'); tone(1046, 0.25, 0.15); tone(1568, 0.3, 0.1, 'sine', 0.08); }
  const aim = aimPoint(), origin = camera.position.clone().setY(BOWL.y);
  const land = origin.clone().lerp(aim, perfect ? 1 : power / IDEAL);
  if (!perfect) land.add(new THREE.Vector3(rnd(-0.05, 0.05), 0, rnd(-0.05, 0.05)));
  let inBowl = Math.hypot(land.x - BOWL.x, land.z - BOWL.z) < BOWL_R;
  const bounced = inBowl && !perfect && Math.random() < bowlNow().bounce;
  if (bounced) { inBowl = false; const d = land.clone().sub(BOWL).setY(0); if (d.lengthSq() < 1e-4) d.set(1, 0, 0); land.copy(BOWL).addScaledVector(d.normalize(), BOWL_R + rnd(0.15, 0.3)); }
  const victim = inBowl ? undefined : npcNear(land, 0.5);
  meatInHand.visible = false;
  const wasCracked = crackedNow;
  const from = worldOf(oyster); const m = new THREE.Mesh(meatGeo, wasCracked ? splatMat : meatMat);
  const dist = from.distanceTo(land);
  if (inBowl) land.set(BOWL.x + rnd(-0.08, 0.08), 0.06 + Math.min(bowlMeat.length, 40) * 0.0015, BOWL.z + rnd(-0.08, 0.08)); else land.y = 0.01;
  SFX.whoosh();
  if (victim) { fly(m, from, () => worldOf(victim.head).add(new THREE.Vector3(0, 0.14, 0)), 0.7, 0.4, () => meatOnHead(victim, m)); missed++; }
  else fly(m, from, land, 0.45 + dist * 0.15, 0.25 + dist * 0.2, () => {
    if (inBowl) { count++; bowlBonus += bowlNow().bonus; if (wasCracked) penalty += OYSTER_PRICE - CRACK_PRICE; bowlMeat.push(m); if (bowlMeat.length > 60) scene.remove(bowlMeat.shift()!); SFX.plop(); if (!perfect) toast(wasCracked ? '入碗（有殼屑）' : '入碗！'); if (Math.random() < 0.15) say(pick(npcs), pick(PRAISE), 2); }
    else { missed++; if (bounced) { SFX.plop(); later(0.05, () => toast('彈出來矣！', '#ff8a7a')); } m.material = splatMat; m.scale.set(1.5, 0.25, 1.5); splats.push(m); if (splats.length > 30) scene.remove(splats.shift()!); SFX.splat(); toast('無入！', '#ff8a7a'); nag(NAG_MISS); }
    updHud();
  });
  later(0.35, () => { if (meatsLeft > 1 && state === 'play') { meatsLeft--; showExtra(); meatInHand.visible = true; meatInHand.material = meatMat; setPhase('aim'); hint.textContent = `還有 ${meatsLeft} 塊肉！繼續丟進碗裡`; } else { meatsLeft = 1; showExtra(); emptyT = 2.2; setPhase('empty'); } });
}
function discardShell() { if (phase !== 'empty') return; oyster.visible = false; const sh = new THREE.Mesh(halfGeo, shellBotMat); fly(sh, worldOf(oyster), pileSpot(), 0.6, 0.5, () => scene.remove(sh)); setPhase('busy'); later(0.5, goPick); }
function meatOnHead(n: Npc, m: THREE.Mesh) {
  meatHits++; addGrudge(n, 25); if (n.stuck) n.stuck.removeFromParent(); m.removeFromParent(); m.position.set(0, 0.15, 0); m.scale.setScalar(1.6); n.head.add(m); n.stuck = m;
  later(8, () => { if (n.stuck === m) { m.removeFromParent(); n.stuck = null; } });
  toast(`擲著${n.name}的頭！`, '#ffb070'); SFX.splat();
  anger(n, SCOLD_HIT, 0.85); updHud();
}
function anger(n: Npc, lines: string[], retaliate: number) {
  n.angry = 2.5; n.mood = Math.max(n.mood, 35); nagFrom(n, lines, 3); tone(220, 0.3, 0.2, 'square');
  if (Math.random() < retaliate) later(0.6, () => windUp(n));
}
const stunned = (n: Npc) => (n.clutch ?? 0) > 0;
const freeToSteal = (n: Npc) => n.distract > 0 || stunned(n);
let dayMaxGrudge = 0;
function addGrudge(n: Npc, v: number) { if (v > 0) v *= medM('grudge') * locNow().ang; const g0 = n.grudge ?? 0; n.grudge = Math.max(0, Math.min(100, g0 + v)); if (v > 0) { n.gAt = performance.now(); if (g0 < 60 && n.grudge >= 60 && state === 'play') toast(`${n.name}很生氣！會更常丟你（一陣子不惹她就會消氣）`, '#ff7a6a'); } dayMaxGrudge = Math.max(dayMaxGrudge, n.grudge); }
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
  if (target) { const t = target; fly(sh, from, () => worldOf(t.head), 0.5, 0.3, () => { scene.remove(sh); shellHits++; SFX.hitNpc(); toast(`擲著${t.name}！`, '#ffb070'); anger(t, SCOLD_SHELL, 0.6); addGrudge(t, 35); npcHurt(t); updHud(); }); }
  else { let stray: Npc | undefined; for (const n of npcs) { const p = worldOf(n.head).project(camera); if (p.z < 1 && Math.abs(p.x) < 0.7 && Math.abs(p.y) < 0.8 && Math.random() < 0.4) stray = n; }
    if (stray) { const t = stray; fly(sh, from, () => worldOf(t.head), 0.55, 0.35, () => { scene.remove(sh); shellHits++; SFX.hitNpc(); toast(`歪去擲著${t.name}！`, '#ffb070'); anger(t, SCOLD_SHELL, 0.6); addGrudge(t, 30); npcHurt(t); updHud(); }); }
    else { const a = aimPoint(); a.y = 0.02; fly(sh, from, a, 0.6, 0.5, () => later(2, () => scene.remove(sh))); } }
  setPhase('busy'); later(0.6, goPick);
}
// ----- 7. 阿婆擲殼仔 + 雨傘 -----
function windUp(n: Npc) { if (n.windup > 0 || state !== 'play' || stunned(n)) return; n.windup = Math.max(0.45, 1.0 - (n.grudge ?? 0) * 0.005); n.look = 1.6; SFX.alert(); }
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
      reflects++; blockStreak++; SFX.boing(); tone(1800, 0.08, 0.15, 'square'); toast('完美反彈！✨', '#ffe36a'); shake = 0.08;
      fly(sh, sh.position.clone(), () => worldOf(n.head), 0.4, 0.15, () => { scene.remove(sh); SFX.hitNpc(); addGrudge(n, Math.round(20 * U.reflect)); npcHurt(n, U.reflect); });
    } else if (covered) { scene.remove(sh); blocks++; blockStreak++; SFX.boing(); toast('擋著！波嗯～', '#9be37a'); say(n, pick(['哪會有雨傘啦！', '狡怪喔你！', '啥物時陣提出來的！']), 2.5); }
    else { scene.remove(sh); blockStreak = 0; hitsTaken++; ($('splat') as HTMLElement).style.opacity = '1'; later(0.9, () => ($('splat') as HTMLElement).style.opacity = '0'); hurt(8, '哎唷！擲著矣！'); hitInHand(); }
    if (blockStreak >= 3) { blockStreak = 0; npcs.forEach((m, i) => { m.calm = 45; if (i === 0) later(0.8, () => say(m, '這个阿婆有夠勇……', 3)); }); toast('阿婆們驚你矣，暫時較少擲', '#9fe0ff'); }
    updHud();
  });
}
function hitInHand() {
  if (phase === 'twist' || phase === 'seam') {
    if (Math.random() < 0.5) { lost++; abandoned++; const sh = new THREE.Mesh(shellGeo, shellTopMat); oyster.visible = false; const a = worldOf(oyster); fly(sh, a, a.clone().setY(0.02).add(new THREE.Vector3(rnd(-0.3, 0.3), 0, -0.3)), 0.5, 0.2, () => later(3, () => scene.remove(sh))); toast('蚵仔落落去塗跤矣！', '#ff9a8a'); progress = 0; shellTop.rotation.z = 0; setPhase('busy'); later(0.8, goPick); }
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
  caught++; stopSteal(); const back = Math.min(count, 2); count -= back; n.count += back; penalty += 20;
  n.distract = 0; n.pause = 0; addGrudge(n, 20); anger(n, SCOLD_STEAL, 0.5); toast('予人掠著矣！-2 粒、罰 $20', '#ff8a7a'); shake = 0.2; SFX.sting(); updHud();
}
function stealOne(n: Npc) {
  if (n.count <= 0) { toast('碗內無肉矣'); stopSteal(); return; }
  n.count--; count++; steals++; addGrudge(n, 12); const m = new THREE.Mesh(meatGeo, meatMat);
  const lm = n.bowlMeat.pop(); if (lm) scene.remove(lm);
  fly(m, n.bowl.clone(), BOWL.clone().add(new THREE.Vector3(rnd(-0.08, 0.08), 0.06, rnd(-0.08, 0.08))), 0.5, 0.3, () => bowlMeat.push(m));
  SFX.sneak(); toast('偷著一粒！', '#c9a0ff'); updHud();
}
function lifeHtml() { const L = save.life, w = L.opened + L.wasteShells ? Math.round((L.missed + L.wasteShells) / (L.opened + L.wasteShells) * 100) : 0;
  const tl = Object.entries(save.titles).map(([k, v]) => `${k} ×${v}`).join('、') || '（猶無）';
  return `<h3>生涯紀錄</h3><p style="font-size:13px;line-height:1.6">做工 ${save.days} 工・累積收入 $${save.money}・最佳 ${save.best} 粒<br>開殼 ${L.opened}・入碗 ${L.inBowl}・浪費率 ${w}%・殼屑 ${L.cracked}<br>完美出手 ${L.perfects}・最長連擊 ${L.bestCombo}・放棄 ${L.abandoned}・割手 ${L.stabs}<br>偷 ${L.steals}/掠 ${L.caught}・擲著阿婆 ${L.shellHits}・予人擲 ${L.hitsTaken}・擋 ${L.blocks}・反彈 ${L.reflects}<br>稱號：${tl}</p>`; }
function endDay() { if (document.pointerLockElement) document.exitPointerLock();
  if (tut) { tutEnd(false); return; }
  if (state === 'end') return; state = 'end'; setPhase('busy'); closeUmbrella(); on('umbBtn', false); on('medBtn', false); on('quitBtn', false); $('medList').classList.remove('show'); on('stealBtn', false); stopSteal();
  const all = [{ name: '你（阿婆）', count, me: true }, ...npcs.map(n => ({ name: n.name, count: n.count, me: false }))].sort((a, b) => b.count - a.count);
  const queen = all[0].me;
  const pearlMoney = dayPearls.reduce((s, r) => s + RAR[r].price, 0) + dayOdd.reduce((s, r) => s + ODD[r].price, 0);
  const titles: string[] = []; let bonus = 0;
  if (thrown === 0) { titles.push('🕊 和平阿婆（+$50）'); bonus = 50; }
  if (shellHits >= 3 && shellHits > hitsTaken) titles.push('👊 工寮霸主');
  if (blocks + reflects >= 3 && blocks + reflects > hitsTaken) titles.push('☂ 雨傘大師');
  const LC = locNow(), base0 = count * OYSTER_PRICE + bowlBonus + pearlMoney, locBonus = Math.round(base0 * (LC.m - 1)), nightBonus = nightShift ? Math.round((base0 + locBonus) * 0.2) : 0;
  const earn = Math.max(0, base0 + locBonus + nightBonus + bonus - penalty);
  const waste = opened + wasteShells ? Math.round((missed + wasteShells) / (opened + wasteShells) * 100) : 0;
  save.days++; save.best = Math.max(save.best, count); save.money += earn; if (queen) { save.queen++; titles.unshift('👑 今日蚵后'); }
  const L = save.life; L.opened += opened; L.inBowl += count; L.missed += missed; L.wasteShells += wasteShells; L.cracked += cracked; L.perfects += perfects; L.abandoned += abandoned; L.stabs += stabs; L.steals += steals; L.caught += caught; L.meatHits += meatHits; L.shellHits += shellHits; L.hitsTaken += hitsTaken; L.blocks += blocks; L.reflects += reflects; L.lost += lost;
  for (const tt of titles) { const k = tt.replace(/（.*）/, ''); save.titles[k] = (save.titles[k] ?? 0) + 1; }
  persist();
  track('day', { loc: locNow().id,  count, opened, missed, perfects, cracked, steals, caught, shellHits, earn, pearls: dayPearls.length + dayOdd.length, waste, combo: dayCombo, maxAnger: Math.round(dayMaxGrudge), double: dayMulti2, triple: dayMulti3, dur: Math.round(SHIFT - Math.max(0, timeLeft)), dex: dexN(), seat: save.seat ?? 'door' });
  $('resTitle').textContent = handPain ? '🩹 手痛收工' : queen ? '👑 今日蚵后！' : '收工矣～';
  $('resBody').innerHTML = all.map((a, i) => `<div class="row"><span>${i + 1}. ${a.name}</span><b>${a.count} 粒入碗</b></div>`).join('') +
    `<p style="font-size:14px">開殼 ${opened}・入碗 ${count}・無入 ${missed}・浪費率 <b>${waste}%</b><br>殼屑 ${cracked}・完美出手 ${perfects}・放棄 ${abandoned}・割手 ${stabs}<br>` +
    `偷 ${steals}・予人掠著 ${caught}・肉擲著阿婆 ${meatHits}・殼擲著阿婆 ${shellHits}<br>雨傘擋 ${blocks}・完美反彈 ${reflects}・予人擲著 ${hitsTaken}・擲殼 ${thrown}・蚵仔落塗跤 ${lost}</p>` + (titles.length ? `<p style="font-size:18px"><b>${titles.join('　')}</b></p>` : '') +
    `<p>蚵仔 ${count} 粒 × $${OYSTER_PRICE}（殼屑 ${cracked} 粒只 $${CRACK_PRICE}）${bowlBonus ? `<br>盆仔加價 +$${bowlBonus}` : ''}<br>珍珠／奇物 ${dayPearls.length + dayOdd.length} 件 = $${pearlMoney}<br>罰款／扣價 -$${penalty}${locBonus ? `<br>${LC.n} 工錢 ×${LC.m}：+$${locBonus}` : ''}${nightBonus ? `<br>🌙 夜班加成 +20%：+$${nightBonus}` : ''}${bonus ? `<br>和平獎金 +$${bonus}` : ''}<br><b style="font-size:20px">今日收入 $${earn}</b></p>` +
    `<p style="font-size:13px;opacity:.8">累積收入 $${save.money}・最佳紀錄 ${save.best} 粒・做蚵后 ${save.queen} 擺</p>` +
    `<p>${caught >= 2 ? '阿婆們：「明仔載你家己坐一角！」' : waste >= 30 ? '阿婆們：「塗跤攏是蚵仔肉，明仔載較準咧！」' : queen ? '阿婆們：「哎唷，今仔日予你贏去矣！」' : `${all[0].name}：「明仔載閣來拚喔～」`}</p>`;
  $('result').classList.add('show'); if (ac) SFX.endJingle(queen && !handPain);
}
function revealPearl(r: number) {
  dayPearls.push(r); save.dex[r]++; persist(); track('find', { kind: 'pearl', item: 'pearl-' + r, rarity: rarOf(RAR[r].w), seat: save.seat ?? 'door', knife: knifeNow().id, luck: luckNow(), dex: dexN() }); renderDex();
  slowmo = 2.6; pearlShow = 2.6;
  (pearlMesh.material as THREE.MeshStandardMaterial).color.setHex(RAR[r].color);
  (pearlMesh.material as THREE.MeshStandardMaterial).emissive.setHex(r === 3 ? 0x302050 : RAR[r].color).multiplyScalar(0.25);
  pearlMesh.visible = true; ding(r);
  label.innerHTML = `${RAR[r].name}！<small>${save.dex[r] === 1 ? '🆕 第一次找到！' : `你的第 ${save.dex[r]} 個`}</small><small>${['阿婆們攏越頭來看矣！', '哇～粉紅仔，真媠！', '金光閃閃，今仔日發矣！', '烏珍珠！！全港仔攏轟動！'][r]}</small>`;
  label.style.color = RAR[r].css === '#3a3548' ? '#c9b8ff' : RAR[r].css; label.classList.add('on');
  const cries = ['哎唷！珍珠！', '予我看覓咧！', '好運喔你！', '天公伯仔有保庇！'];
  npcs.forEach((n, i) => { n.look = 2.6; say(n, cries[(i + r) % cries.length], 2.6); });
}
function renderDex() {
  const RZ: Record<string, string> = { common: '普通', uncommon: '少見', rare: '稀有', legend: '傳說' };
  const all = [...RAR.map((r, i) => ({ ...r, has: save.dex[i] ?? 0 })), ...ODD.map((o, i) => ({ ...o, has: save.odd[i] ?? 0 }))];
  const item = (x: typeof all[number]) => { const rr = rarOf(x.w); return `<div class="dexItem ${x.has ? '' : 'locked'}"><div class="dot" style="background:${x.has ? x.css : '#222'};box-shadow:0 0 8px ${x.has ? x.css : 'transparent'}">${x.emo}</div><div><b>${x.has ? x.name : '？？？'}</b>${x.has ? ` <span class="dexN">×${x.has}</span>` : ''} <span class="rb r-${rr}">${RZ[rr]}</span><br><small>${x.has ? `收集 ${x.has} 件・值 $${x.price}${'line' in x ? `<br>「${(x as any).line}」` : ''}` : `💭 ${x.tease}`}</small></div></div>`; };
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
  if (phase === 'aim') { holding = true; hold = 0; }
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
function release() { if (!holding) return; const h = hold; holding = false; hold = 0; gauge.classList.remove('on'); if (phase === 'aim' && state === 'play') shoot(h); }
const up = (e: PointerEvent) => { if (down && down.id === e.pointerId && walking) { down = null; return; } if (down && down.id === e.pointerId) { if (!down.drag) { if (phase === 'seam') tryInsert(); else if (phase === 'pick') { if (e.pointerType === 'mouse') pickAt(innerWidth / 2, innerHeight / 2); else pickAt(e.clientX, e.clientY); } else release(); } else release(); down = null; } };
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { if (phase === 'seam') { rot += e.deltaY * 0.004; e.preventDefault(); } }, { passive: false });
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text') return;
  if (state === 'play' && !tut && e.code === 'KeyM') { const L = $('medList'); if (document.pointerLockElement) document.exitPointerLock(); L.classList.toggle('show'); if (L.classList.contains('show')) renderMedList(); return; }
  if (state === 'play' && $('medList').classList.contains('show') && /^Digit[1-9]$/.test(e.code)) { const own = MEDS.filter(m => (save.meds[m.id] ?? 0) > 0); const m = own[+e.code.slice(5) - 1]; if (m) { useMed(m.id); renderMedList(); } return; }
  if (tut && e.code === 'Enter' && TUT[tut.i].next) { $('tutNext').click(); return; }
  if (state !== 'play') return; audio().resume();
  if (walking) { walkKeys.add(e.code); if (e.code === 'KeyE' && nearSeat) sitDown(nearSeat.id); return; }
  if (e.code === 'KeyG') { standUp(); return; }
  if (e.code === 'Space' && !e.repeat && umbHeld) { hint.textContent = '撐著傘不能剝蚵，先放開雨傘'; return; }
  if (e.code === 'Space' && !e.repeat) { if (phase === 'pick') pickAt(innerWidth / 2, innerHeight / 2); else if (phase === 'seam') tryInsert(); else if (swipePhase()) pry(e.timeStamp); else if (phase === 'aim') { holding = true; hold = 0; } }
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
btn('giveUp', giveUp); btn('quitBtn', () => { if (state !== 'play' || tut) return; if (document.pointerLockElement) document.exitPointerLock(); if (confirm('確定要翹班嗎？這一工會直接收工結算。')) endDay(); }); btn('standBtn', standUp); btn('sitBtn', () => { if (nearSeat) sitDown(nearSeat.id); }); btn('throwBtn', throwShell); btn('umbBtn', openUmbrella, closeUmbrella); for (const ev of ['pointercancel', 'lostpointercapture', 'touchend', 'touchcancel']) $('umbBtn').addEventListener(ev, closeUmbrella); addEventListener('blur', closeUmbrella); document.addEventListener('visibilitychange', () => { if (document.hidden) closeUmbrella(); }); $('umbBtn').addEventListener('contextmenu', e => e.preventDefault()); btn('stealBtn', startSteal, stopSteal);
{ const sb = $('stealBtn'); sb.addEventListener('pointerdown', e => { try { sb.setPointerCapture(e.pointerId); } catch { } });
  for (const ev of ['pointercancel', 'lostpointercapture', 'touchend', 'touchcancel']) sb.addEventListener(ev, stopSteal);
  window.addEventListener('pointerup', stopSteal); window.addEventListener('pointercancel', stopSteal); window.addEventListener('blur', stopSteal); document.addEventListener('visibilitychange', stopSteal); }
// 手機：次要按鈕放左下一排（不收選單）
if (matchMedia('(pointer:coarse)').matches) { const L = $('btnsL'); for (const id of ['medBtn', 'quitBtn', 'giveUp', 'standBtn']) L.appendChild($(id)); }
btn('rotL', () => rotKey = -1, () => rotKey = 0); btn('rotR', () => rotKey = 1, () => rotKey = 0);
// ----- 徛起來行路、換位 -----
let walking = false, nearSeat: Seat | null = null; const walkPos = new THREE.Vector3(), walkKeys = new Set<string>(), joy = { x: 0, y: 0 };
const NAG_STAND = ['撥一半就欲走喔？', '蚵仔擲咧就走，拍損！', '欲去佗位？工課做予了啦'];
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
  hint.textContent = '擲掉矣…'; nag(NAG_GIVEUP); updHud(); later(0.6, goPick);
}
function renderLocs() {
  const el = $('locPick'); const tot = save.life.inBowl ?? 0;
  el.innerHTML = '<b>上工地點</b>' + LOCS.map(l => { const own = l.price === 0 || save.locs!.includes(l.id), cur = locNow().id === l.id;
    const info = `<small>工錢 ×${l.m}・${l.d}</small>`;
    if (own) return `<button class="loc ${cur ? 'cur' : ''}" data-loc="${l.id}">${l.n}${cur ? '（選擇中）' : ''}<br>${info}</button>`;
    const ok = tot >= l.need && save.money >= l.price;
    return `<button class="loc locked" data-lbuy="${l.id}" ${ok ? '' : 'disabled'}>🔒 ${l.n}<br>${info}<br><small>解鎖：累計入碗 ${l.need} 粒（目前 ${tot}）＋ $${l.price}（有 $${save.money}）</small></button>`; }).join('');
  el.querySelectorAll<HTMLButtonElement>('[data-loc]').forEach(b => b.onclick = () => { save.loc = b.dataset.loc; persist(); renderLocs(); updSky(); });
  el.querySelectorAll<HTMLButtonElement>('[data-lbuy]').forEach(b => b.onclick = () => { const l = LOCS.find(x => x.id === b.dataset.lbuy)!; if (save.money < l.price || tot < l.need) return; save.money -= l.price; save.locs!.push(l.id); save.loc = l.id; persist(); track('buy', { item: 'loc-' + l.id, price: l.price }); toast(`解鎖 ${l.n}！`); renderLocs(); updSky(); });
}
renderLocs();
$('rLoc').onclick = () => { $('result').classList.remove('show'); renderLocs(); $('overlay').classList.add('show'); $('overlay').scrollTop = 0; };
$('start').onclick = () => { audio(); if (!save.tutDone) tutStart(); else startDay(); };
$('again').onclick = startDay;
$('dexBtn').onclick = () => { renderDex(); $('dex').classList.add('show'); };
$('setBtn').onclick = () => $('settings').classList.add('show');
$('daily').onclick = claimDaily; renderDaily(); document.addEventListener('visibilitychange', () => { if (!document.hidden) renderDaily(); });
if (params.get('bonusdone') === '1') { save.bonusDay = todayKey(); renderDaily(); }
$('resetSave').onclick = () => { if (confirm('確定欲重置存檔？錢、圖鑑、生涯紀錄、設定攏會清掉，無法度復原。')) { localStorage.removeItem('oyster-sim'); localStorage.removeItem('oyster-mix'); location.reload(); } };
$('shopBtn').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); renderShop(); $('shop').classList.add('show'); };
$('shopBtn2').onclick = () => { renderShop(); $('shop').classList.add('show'); };
$('shopClose').onclick = () => $('shop').classList.remove('show');
applyKnife(); applyUmb(); applySeat(save.seat ?? 'door');
$('setClose').onclick = () => $('settings').classList.remove('show');
for (const k of ['master', 'amb', 'sfx'] as const) { const el = $('v_' + k) as HTMLInputElement; el.value = String(mix[k]); el.oninput = () => { mix[k] = Number(el.value); applyMix(); if (k === 'sfx' && ac) SFX.plop(); }; }
for (const [id, key] of [['v_invX', 'invX'], ['v_invY', 'invY']] as const) { const c = $(id) as HTMLInputElement; c.checked = mix[key]; c.onchange = () => { mix[key] = c.checked; applyMix(); }; }
{ const mv = $('v_music') as HTMLInputElement; mv.value = String(mix.music); mv.oninput = () => { mix.music = +mv.value; applyMix(); }; }
{ const g = $('v_stats') as HTMLInputElement; g.checked = mix.stats; g.onchange = () => { mix.stats = g.checked; applyMix(); }; }
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
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  narrow = camera.aspect < 0.8; baseFov = narrow ? 82 : 70; handRig.position.set(0, narrow ? -0.02 : 0, 0); handRig.scale.set(narrow ? 0.42 : 0.7, narrow ? 0.6 : 0.7, 0.7); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); const v = new THREE.Vector3();
let chatTimer = 2;
const warnEl = $('warn');
function frame() {
  const rdt = Math.min(clock.getDelta(), 0.05);
  slowmo = Math.max(0, slowmo - rdt); const dt = rdt * (slowmo > 0.4 ? 0.3 : 1), t = clock.elapsedTime;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= rdt; if (timers[i].t <= 0) { const f = timers[i].f; timers.splice(i, 1); f(); } }
  hurtT = Math.max(0, hurtT - rdt); flinch = Math.max(0, flinch - rdt); ($('hurt') as HTMLElement).style.opacity = String(Math.min(0.55, hurtT * 0.6));
  toastT -= rdt; if (toastT <= 0) toastEl.classList.remove('on');
  tension = Math.max(0, tension - rdt * 1.6);
  if (umbHeld) { umbT = Math.max(0, umbT - rdt); if (umbT <= 0) { umbHeld = false; umbTired = true; $('umbBtn').classList.remove('held'); toast('手痠了，放開再重新撐傘', '#ffcf8a'); } } else umbT = 0; $('umbBtn').classList.toggle('cd', umbTired); { const b = $('umbBtn'), c = $('umbCd'); if (umbHeld) { const f = umbT / Math.max(0.1, umbLen); b.style.setProperty('--p', `${(f * 100).toFixed(1)}%`); c.textContent = `${umbT.toFixed(1)}s`; b.classList.toggle('low', umbT < 1.2); } else { c.textContent = ''; b.classList.remove('low'); } }
  const us = umbT > 0 ? Math.min(1, umbAge() / Math.max(0.1, umbNow().open + 0.05), umbT * 6) : 0; umb.visible = us > 0; umb.scale.setScalar(0.3 + 0.7 * us); umb.rotation.z = Math.sin(t * 20) * 0.05 * us;
  let warnNpc: Npc | null = null;
  if (state === 'play') {
    if (!tut) timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; endDay(); }
    hp = Math.min(100, hp + dt / 6 * medM('regen')); tickMeds(dt);
    if (phase === 'seam') {
      rot += rotKey * rdt * 2.5; oyster.rotation.y = rot;
      const e = Math.abs(seamErr()), d = DIFF[diff], close = clamp(1 - e / (tolNow() * 3), 0, 1);
      (seamGlow.material as THREE.MeshBasicMaterial).opacity = close * 0.55;
      const tk = Math.floor(rot / 0.25); if (tk !== lastTick) { lastTick = tk; tone(1800 + close * 1200, 0.025, 0.03 + close * 0.08, 'square'); }
      knife.position.y = 0.03 + (e < tolNow() * 1.5 ? Math.sin(t * 50) * 0.004 : 0);
    } else knife.position.y = 0.03;
    if (phase === 'twist') { if (SHOT === 'pry') needleStart = performance.now() - Math.acos(1 - 2 * PRY_C) / (Math.PI * 2 * prySp()) * 1000; const n = needle(), w = pryW(); zone.style.left = `${(PRY_C - w / 2) * 100}%`; zone.style.width = `${w * 100}%`; fill.style.width = '4px'; fill.style.marginLeft = `calc(${n * 100}% - 2px)`; fill.style.background = n > PRY_RED ? '#ff5a4a' : Math.abs(n - PRY_C) <= w / 2 ? '#d8ffb0' : '#fff'; }
    if (phase === 'twist' || phase === 'crab') { ($('progFill') as HTMLElement).style.width = `${(phase === 'crab' ? crabShakes / 6 : progress) * 100}%`; }
    if (phase === 'crab') hp = Math.max(1, hp - dt * 2);
    updBlood(rdt);
    if (phase === 'scoop') { scoopT -= rdt; on('prog', true); ($('progFill') as HTMLElement).style.width = `${(1 - scoopT / scoopDur) * 100}%`; if (scoopT <= 0) { fillBasin(true); on('prog', false); later(0.6, goPick); setPhase('busy'); } }
    if (phase === 'empty') { emptyT -= rdt; if (emptyT <= 0) discardShell(); }
    if (holding && phase === 'aim') { gauge.classList.add('on'); hold += dt * 1.1; if (hold > 1.25) { hold = 1.3; release(); } fill.style.width = `${Math.min(1, hold) * 100}%`; fill.style.background = 'rgba(255,255,255,.75)'; }
    // 偷蚵仔
    on('standBtn', !walking); if (walking && !walkHintShown && npcs.some(n => (n.grudge ?? 0) > 5)) { walkHintShown = true; toast('起來走走，阿婆氣消得比較快', '#9be37a'); }
    const tgt = walking ? null : stealTarget(); on('stealBtn', !!tgt); if (!tgt) stopSteal();
    if (tgt && !stealNpc && phase !== 'busy') hint.textContent = tgt.distract > 0 ? `${tgt.name}越頭咧講話！按住 E／「偷」偷伊的肉` : `${tgt.name}咧看，毋通偷…`;
    if (stealNpc) { if (!freeToSteal(stealNpc)) caughtBy(stealNpc); else { stealT += dt; on('prog', true); ($('progFill') as HTMLElement).style.width = `${stealT / 0.9 * 100}%`; if (stealT >= 0.9) { stealT = 0; stealOne(stealNpc); } } }
    chatTimer -= dt * seatNow().nag; if (chatTimer <= 0) { chatTimer = 3 + Math.random() * 4; const n = pick(npcs);
      if (n.bubT <= 0 && n.windup <= 0) { if (n.mood > 0) say(n, pick(GRUDGE)); else if (Math.random() < 0.5) { n.distract = rnd(3, 5.5) * seatNow().steal; n.turnDir = Math.random() < 0.5 ? -1 : 1; say(n, pick(TURN_CHAT), n.distract); } else { say(n, pick(GOSSIP)); if (Math.random() < n.chatty) n.pause = 2.5; } } }
    for (const n of npcs) {
      n.distract -= dt; n.angry -= dt; n.mood -= dt;
      npcShuck(n, dt, t);
      n.grudge = Math.max(0, (n.grudge ?? 0) - (walking ? (performance.now() - (n.gAt ?? 0) > 2000 ? dt * 7.5 : 0) : performance.now() - (n.gAt ?? 0) > 8000 ? dt * 2.5 : 0)); n.calm = Math.max(0, (n.calm ?? 0) - dt); grudgeUI(n);
      n.throwCd -= dt * seatNow().throwM * locNow().thr * (n.calm! > 0 ? 0.3 : (1 + n.grudge! / 25) * (n.mood > 0 ? 2 : 1)); if (n.throwCd <= 0) { n.throwCd = rnd(20, 40); if (!tut) windUp(n); }
      if (n.windup > 0) { warnNpc = n; n.windup -= rdt; if (n.windup <= 0) npcThrow(n); }
      if (n.peek && n.look <= 0 && n.distract <= 0 && Math.random() < dt * 0.05) { n.look = 2.5; say(n, pick(PEEK), 2.5); }
    }
    updHud();
  }
  // ⚠ 方向提示
  if (warnNpc) { const rel = warnNpc.g.position.clone().sub(camera.position); const fwd = camera.getWorldDirection(new THREE.Vector3()); let a = Math.atan2(rel.x, rel.z) - Math.atan2(fwd.x, fwd.z); a = Math.atan2(Math.sin(a), Math.cos(a));
    warnEl.classList.add('on'); warnEl.style.left = `${clamp(50 - a / 1.2 * 45, 6, 94)}%`; warnEl.style.opacity = String(0.6 + 0.4 * Math.sin(t * 14)); warnEl.textContent = a > 0.5 ? '⚠◀' : a < -0.5 ? '▶⚠' : '⚠'; hint.textContent = `${warnNpc.name}欲擲殼仔過來矣！緊按 R／「雨傘」！`; }
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
  camera.position.copy(walking ? walkPos : SEAT); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(shake * 0.03));
  camera.fov = baseFov - pe * (narrow ? 10 : 22); camera.updateProjectionMatrix();
  lamp.intensity = 26 + Math.sin(t * 1.3) * 1.0;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// ---------- 新手教學 ----------
type TutStep = { id: string; line: string; pc: string; mb: string; hi?: string[]; next?: string; done?: () => boolean; enter?: () => void };
const TUT: TutStep[] = [
  { id: 'grab', line: '來，阿姨教你！先拿一顆蚵仔起來。', pc: '點紅色臉盆裡的蚵仔（或按 Space）', mb: '點紅色臉盆裡的蚵仔，或點自己的手', done: () => phase === 'seam' },
  { id: 'seam', line: '蚵仔殼有一條縫，要轉到對準刀尖喔。', pc: '用滾輪／A D 轉蚵仔，金色的縫對準刀尖時點一下（或按 Space）插刀', mb: '按住 ◀ ▶ 或拖動蚵仔來轉，縫對準刀尖時點一下蚵仔插刀', hi: ['rotL', 'rotR'], done: () => phase === 'twist' || phase === 'aim' },
  { id: 'pry', line: '刀插進去了！看指針，到綠區再撬，不要太用力喔～', pc: '指針走到綠區就點滑鼠／按 Space，撬到殼打開', mb: '指針走到綠區就點一下螢幕，撬到殼打開', hi: ['gauge'], done: () => phase === 'aim' },
  { id: 'toss', line: '蚵仔肉出來了！丟進藍色的碗裡才算錢。', pc: '轉頭對準藍色碗，按住滑鼠／Space 蓄力，到藍色區間放開', mb: '拖動畫面對準藍色碗，按住螢幕蓄力，到藍色區間放開', hi: ['gauge'], done: () => count > tut!.c0 },
  { id: 'steal', line: '偷偷跟你說：阿婆轉頭聊天的時候，可以偷她碗裡的肉…', pc: '看到阿婆在聊天，對準她的碗按住 E 偷（被看到她會生氣）', mb: '看到阿婆在聊天，對準她的碗按住「偷」（被看到她會生氣）', hi: ['stealBtn'], next: '知道了 ▶', done: () => steals > tut!.s0 },
  { id: 'shell', line: '撬出空殼，也可以丟向別人！', pc: '手上有空殼時，對準阿婆按 F 或右鍵丟過去', mb: '手上有空殼時，對準阿婆按「丟殼」丟過去', hi: ['throwBtn'], next: '知道了 ▶', done: () => thrown > tut!.t0 },
  { id: 'umb', line: '小心！阿婆要丟殼過來了！', pc: '看到 ⚠ 趕快按住 R 打開雨傘擋', mb: '看到 ⚠ 趕快按住「雨傘」擋', hi: ['umbBtn'], next: '知道了 ▶', done: () => umbT > 0, enter: () => later(1.2, () => { if (tut && TUT[tut.i].id === 'umb') windUp(npcs[0]); }) },
  { id: 'stand', line: '坐太久腳會麻，起來走走，找別的位子。', pc: '按 G 換位置', mb: '按「🚶 換位置」按鈕', hi: ['standBtn'], next: '知道了 ▶', done: () => walking },
  { id: 'sit', line: '每個位子的好處都不一樣，看清楚再坐。', pc: '用 WASD 走到藍色板凳旁邊，按 E 坐下（或按下面的按鈕坐回原位）', mb: '用搖桿走到藍色板凳旁邊，按「坐落」坐下（或按下面的按鈕坐回原位）', hi: ['sitBtn'], next: '坐回去 ▶', done: () => !walking },
  { id: 'menu', line: '賺的錢可以去雜貨店買好刀、雨傘、碗；開到的珍珠會記在圖鑑裡。', pc: '上面有 🏪 雜貨店、圖鑑、⚙ 設定，開始畫面也有', mb: '上面有 🏪 雜貨店、圖鑑、⚙ 設定，開始畫面也有', hi: ['shopBtn', 'dexBtn', 'setBtn'], next: '下一步 ▶' },
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
  stopSteal(); state = 'menu'; renderLocs(); setPhase('busy'); oyster.visible = false; closeUmbrella(); on('umbBtn', false); on('medBtn', false); on('quitBtn', false); $('medList').classList.remove('show'); on('stealBtn', false); on('standBtn', false); on('lockHint', false);
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
$('tutReplay').onclick = () => { $('settings').classList.remove('show'); if (state === 'play' && !tut && !confirm('這一班會放棄，確定要重看教學嗎？')) return; if (state === 'play' && !tut) { state = 'menu'; } tutStart(); };
(window as any).__oy = { get phase() { return phase; }, get umb() { return { held: umbHeld, t: umbT, vis: umb.visible }; }, get tut() { return tut && TUT[tut.i].id; }, needle: () => needle(), get pryW() { return pryW(); }, PRY_C, get hold() { return hold; }, PERF0, PERF1, seamErr: () => seamErr(), get walking() { return walking; }, get money() { return save.money; }, get state() { return state; }, bowlScr: () => { const v = BOWL.clone().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, nudge: (a: number, b: number) => { tYaw = clamp(tYaw + a, -yl(), yl()); tPitch = clamp(tPitch + b, P0, P1); }, basinScr: () => { const m = basinOy[0]; if (!m) return null; const v = worldOf(m).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, aimScr: () => { const v = aimPoint().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } };
// ---------- 截圖模式 ----------
if (SHOT) {
  startDay(); npcs.forEach((n, i) => { n.count = 5 + i * 3; n.throwCd = 999; });
  const look = (y: number, p: number) => { tYaw = yaw = y; tPitch = pitch = p; };
  const twistSetup = () => { diff = 2; setPhase('twist'); seamGlow.visible = false; progress = 0.6; tension = 0.5; strokeDir = 1; shellTop.rotation.z = -0.25; };
  if (SHOT === 'blood' || SHOT === 'aid') { if (SHOT === 'aid') mix.gore = false; later(0.3, () => { flinch = 0.6; bleed(16); hurt(15, '割著手矣！'); }); }
  if (SHOT === 'npcblood' || SHOT === 'npcaid') { if (SHOT === 'npcaid') mix.gore = false; const n = npcs[0]; look(Math.atan2(-(worldOf(n.head).x - camera.position.x), -(worldOf(n.head).z - camera.position.z)), -0.2); later(0.2, () => npcHurt(n)); }
  if (SHOT === 'grudge') { look(0.15, -0.25); [30, 65, 100].forEach((g, i) => { npcs[i].grudge = g; grudgeUI(npcs[i]); }); npcs[2].angry = 99; say(npcs[2], '看我連環殼！', 99); }
  if (SHOT === 'reflect') { const n = npcs[2]; look(0.6, -0.3); n.windup = 0.25; later(0.62, () => { umbT = umbLen = 0.9; umb.visible = true; }); }
  if (SHOT === 'shop') { save.money = 600; save.shop.owned = ['basic', 'seam']; save.shop.equipped.knife = 'seam'; applyKnife(); renderShop(); $('shop').classList.add('show'); }
  if (SHOT === 'bowl') { save.shop.equipped.bowl = params.get('b') || 'steel'; applyBowl(); look(0.35, -0.75); }
  if (SHOT === 'seat') { applySeat(params.get('s') || 'corner'); goPick(); }
  if (SHOT === 'walk') { later(0.1, () => { standUp(); walkPos.set(-1.1, 1.55, -2.35); tYaw = yaw = 3.09; tPitch = pitch = -0.5; }); }
  if (SHOT === 'dex') { renderDex(); $('dex').classList.add('show'); }
  if (SHOT === 'settings') $('settings').classList.add('show');
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
}
frame();

// 開始／結算畫面嘛會當開雜貨店、圖鑑、設定
for (const [b, t] of [['oShop', 'shopBtn'], ['oDex', 'dexBtn'], ['oSet', 'setBtn'], ['rDex', 'dexBtn'], ['rSet', 'setBtn']] as const) $(b).onclick = () => ($(t) as HTMLButtonElement).click();
// 手機：面板頂懸浮標題＋✕
for (const [pid, cid] of [['shop', 'shopClose'], ['dex', 'dexClose'], ['settings', 'setClose'], ['redeem', 'rdClose']] as const) {
  const pn = $(pid), h = pn.querySelector('h2')!, bar = document.createElement('div'); bar.className = 'ph';
  pn.insertBefore(bar, h); bar.appendChild(h); const x = document.createElement('button'); x.className = 'px'; x.textContent = '✕'; x.setAttribute('aria-label', '關閉');
  x.onclick = () => ($(cid) as HTMLButtonElement).click(); bar.appendChild(x);
}

const NPC_TIP: Record<string, string> = {
  '快手阿桃': '剝蚵仔最快，很少轉頭聊天，所以很難偷她的肉。想贏今日蚵后，主要對手就是她。',
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
function grant(d: RedeemCodeDef) {
  const r = d.reward;
  if (r.money) save.money += Math.max(0, Math.floor(r.money));
  for (const id of r.items ?? []) if (!save.shop.owned.includes(id)) save.shop.owned.push(id);
  (r.pearls ?? []).forEach((n, i) => { if (i < save.dex.length) save.dex[i] += Math.max(0, Math.floor(n)); });
  for (const [k, n] of Object.entries(r.odd ?? {})) if (+k < save.odd.length) save.odd[+k] += Math.max(0, Math.floor(n));
  for (const [k, n] of Object.entries(r.meds ?? {})) if (MEDS.some(m => m.id === k)) save.meds[k] = (save.meds[k] ?? 0) + Math.max(0, Math.floor(n));
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
      grant(res.def); msg.innerHTML = `🎉 兌換成功！${res.def.label ? `（${res.def.label}）` : ''}<br>獲得：${rewardText(res.def)}`; msg.className = 'ok'; inp.value = '';
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
  { id: 'soup', n: '轉運雞精', emo: '🍵', price: 80, dur: 60, m: { green: 0.85 }, luck: 2, good: '幸運 +2（較容易開到珍珠奇物）', bad: '補過頭有點暈，綠區 -15%' },
  { id: 'okb', n: 'OK繃', emo: '🩹', price: 15, dur: 0, heal: 25, good: '立刻補 25 點手的體力', bad: '只是包起來，沒有持續效果' },
  { id: 'candy', n: '潤喉糖', emo: '🍬', price: 20, dur: 90, m: { grudge: 0.5, regen: 0.5 }, good: '跟阿婆有說有笑，怒氣增加減半', bad: '只顧講話，手痛恢復變慢一半' },
];
const medT: Record<string, number> = {};
const medOn = () => MEDS.filter(m => (medT[m.id] ?? 0) > 0);
function medM(k: MedKey) { let v = 1; for (const m of medOn()) v *= m.m?.[k] ?? 1; return v; }
function medA(_k: 'luck') { let v = 0; for (const m of medOn()) v += m.luck ?? 0; return v; }
let medDrawT = 0;
function tickMeds(dt: number) { let ch = false; for (const k in medT) { const was = medT[k] > 0; medT[k] = Math.max(0, medT[k] - dt); if (was && medT[k] <= 0) { ch = true; const m = MEDS.find(x => x.id === k); if (m) toast(`${m.emo}${m.n} 效果結束了`, '#cfc3ff'); } } medDrawT -= dt; if (ch || medDrawT <= 0) { medDrawT = 1; drawMeds(); } }
function drawMeds() {
  const el = document.getElementById('medAct'); if (el) el.innerHTML = medOn().map(m => `<span>${m.emo}${Math.ceil(medT[m.id])}s</span>`).join('');
  const n = MEDS.reduce((a, m) => a + (save.meds[m.id] ?? 0), 0); const b = document.getElementById('medBtn'); if (b) { b.innerHTML = (n ? `💊 藥品 ×${n}` : '💊 藥品') + '<span class="key"> (M)</span>' + (n ? '' : '<small>去雜貨店買藥</small>'); b.classList.toggle('empty', !n); }
  const L = document.getElementById('medList'); if (L && L.classList.contains('show')) renderMedList();
}
function useMed(id: string) {
  const m = MEDS.find(x => x.id === id); if (!m || state !== 'play' || tut || !(save.meds[id] > 0)) return;
  save.meds[id]--; persist(); if (m.heal) { hp = Math.min(100, hp + m.heal); updHud(); } if (m.dur) medT[id] = (medT[id] ?? 0) + m.dur; track('use', { item: id }); toast(`${m.emo}使用${m.n}：${m.good}；${m.bad}${m.dur ? `（${m.dur} 秒）` : ''}`, '#cfc3ff'); if (ac) SFX.pop(); drawMeds();
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
  $('shopList').insertAdjacentHTML('beforeend', `<h3>💊 藥品</h3><p style="font-size:12px;opacity:.8">消耗品：上工時按「💊 藥品」使用，效果持續幾秒，同一種再用會延長時間；收工後效果消失，沒用完的會留著。</p><table class="kt"><tr><th>藥品</th><th>好處</th><th>代價</th><th>時間</th><th>持有</th><th></th></tr>` + MEDS.map(m => `<tr><td><b>${m.emo} ${m.n}</b></td><td style="color:#9be37a">${m.good}</td><td style="color:#ff8a7a">${m.bad}</td><td>${m.dur ? `${m.dur}s` : "立即"}</td><td>${save.meds[m.id] ?? 0}</td><td><button data-mbuy="${m.id}" ${save.money < m.price ? 'disabled' : ''}>$${m.price}</button></td></tr>`).join('') + '</table>');
  $('shopList').querySelectorAll('button[data-mbuy]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    const m = MEDS.find(x => x.id === b.getAttribute('data-mbuy'))!; if (save.money < m.price) return;
    save.money -= m.price; save.meds[m.id] = (save.meds[m.id] ?? 0) + 1; persist(); track('buy', { item: 'med-' + m.id, price: m.price }); if (ac) SFX.jingle(); renderShop(); drawMeds();
  });
}
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
installBackGuard(() => {
  const open = (id: string) => document.getElementById(id)?.classList.contains('show');
  if (open('npcTip')) { $('npcTip').classList.remove('show'); return 'handled'; }
  if (open('medList')) { $('medList').classList.remove('show'); return 'handled'; }
  for (const [id, close] of [['redeem', 'rdClose'], ['shop', 'shopClose'], ['settings', 'setClose'], ['dex', 'dexClose']]) if (open(id)) { ($(close) as HTMLElement).click(); return 'handled'; }
  if (state === 'play') { toast('上工中按返回不會離開；要收工請按「🏃 翹班」或等時間到', '#ffcf8a'); return 'handled'; }
  return 'confirm-exit';
}, () => state === 'play');
