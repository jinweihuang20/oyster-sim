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
scene.background = new THREE.Color(0x0b0d18);
scene.fog = new THREE.Fog(0x0b0d18, 6, 16);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
camera.rotation.order = 'YXZ';
scene.add(camera);
const SEAT = new THREE.Vector3(0, 1.05, 2.0);
camera.position.copy(SEAT);

const mat = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
function mesh(g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], parent: THREE.Object3D = scene) {
  const x = new THREE.Mesh(g, m); if (p) x.position.set(...p); x.castShadow = true; x.receiveShadow = parent === scene; parent.add(x); return x;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ---------- 場景：暗暝巷仔 ----------
scene.add(new THREE.HemisphereLight(0x8090c0, 0x201008, 0.45));
const lamp = new THREE.PointLight(0xffb060, 30, 12, 1.6); lamp.position.set(0, 3.0, 0); lamp.castShadow = true; lamp.shadow.bias = -0.003; lamp.shadow.normalBias = 0.03; lamp.shadow.mapSize.set(1024, 1024); scene.add(lamp);
mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), [0, 3.0, 0]);
mesh(new THREE.ConeGeometry(0.3, 0.2, 12, 1, true), mat(0x334433, { side: THREE.DoubleSide }), [0, 3.12, 0]);
mesh(new THREE.CylinderGeometry(0.01, 0.01, 2, 4), mat(0x111111), [0, 4.2, 0]);
const ground = mesh(new THREE.PlaneGeometry(30, 30), mat(0x3a3530)); ground.rotation.x = -Math.PI / 2;
for (const [x, z, ry] of [[-4.5, 0, Math.PI / 2], [4.5, 0, -Math.PI / 2], [0, -5, 0]] as const) {
  const w = mesh(new THREE.BoxGeometry(12, 5, 0.3), mat(0x5a4a40), [x, 2.5, z]); w.rotation.y = ry;
}
for (let i = 0; i < 4; i++) mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.5 }), [-3 + i * 2, 2.6, -4.8]);
const lantern = mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd03020 }), [-3, 3.2, -4.4]);
const lp = new THREE.PointLight(0xff4020, 3, 4); lp.position.copy(lantern.position); scene.add(lp);
mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), mat(0x2060a0), [3.6, 0.2, -3.5]);
// 中央蚵殼山
const shellGeo = new THREE.DodecahedronGeometry(0.09, 0); shellGeo.scale(1.3, 0.45, 1);
const halfGeo = new THREE.DodecahedronGeometry(0.09, 0); halfGeo.scale(1.3, 0.25, 1);
const shellMat = mat(0x8a8478);
mesh(new THREE.ConeGeometry(0.9, 0.55, 10), shellMat, [0, 0.27, 0]);
const pile = new THREE.InstancedMesh(shellGeo, shellMat, 260); pile.castShadow = true;
{ const d = new THREE.Object3D(); for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.0, h = Math.max(0, 0.55 * (1 - r / 0.95)); d.position.set(Math.cos(a) * r, h + 0.03, Math.sin(a) * r); d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); d.updateMatrix(); pile.setMatrixAt(i, d.matrix); } }
scene.add(pile);
const pileSpot = () => { const a = Math.random() * 6.28, r = rnd(0.2, 0.7); return new THREE.Vector3(Math.cos(a) * r, 0.5 * (1 - r) + 0.05, Math.sin(a) * r); };

// 玩家前面：生蚵面盆、裝肉的碗（愛投準）
mesh(new THREE.CylinderGeometry(0.33, 0.26, 0.18, 16, 1, true), mat(0xc84030, { side: THREE.DoubleSide }), [-0.35, 0.1, 1.45]);
const basinShells = new THREE.InstancedMesh(shellGeo, shellMat, 25);
{ const d = new THREE.Object3D(); for (let i = 0; i < 25; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.24; d.position.set(-0.35 + Math.cos(a) * r, 0.12 + Math.random() * 0.05, 1.45 + Math.sin(a) * r); d.rotation.set(Math.random(), Math.random() * 3, Math.random()); d.updateMatrix(); basinShells.setMatrixAt(i, d.matrix); } }
scene.add(basinShells);
const BOWL = new THREE.Vector3(0.55, 0.12, 1.0), BOWL_R = 0.17;
mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.14, 18, 1, true), mat(0x4a8ac0, { side: THREE.DoubleSide, roughness: 0.4 }), [BOWL.x, 0.07, BOWL.z]);
mesh(new THREE.CircleGeometry(0.13, 18), mat(0x3a6a90), [BOWL.x, 0.005, BOWL.z]).rotation.x = -Math.PI / 2;
const bowlMeat: THREE.Mesh[] = [], splats: THREE.Mesh[] = [];
const meatMat = mat(0xd8cbb0, { roughness: 0.3, metalness: 0.1 }), splatMat = mat(0x8a7a60, { roughness: 0.2 });
const meatGeo = new THREE.SphereGeometry(0.035, 8, 6); meatGeo.scale(1.4, 0.6, 1);

// ---------- 阿婆 ----------
const skin = 0xd9a07a;
function makeAma(top: number, hair: number) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 8), mat(0x885530), [0, 0.15, 0.05], g);
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
  cyc: number; dur: number; ev: number; oy: THREE.Group; top: THREE.Mesh; meat: THREE.Mesh; bowl: THREE.Vector3; bowlMeat: THREE.Mesh[] };
const npcs: Npc[] = [];
const NPC_DEF = [
  { name: '快手阿桃', rate: 1.9, chatty: 0.1, peek: false, top: 0x6a3a8a, hair: 0x999999, a: -1.1 },
  { name: '講話阿春', rate: 2.8, chatty: 0.6, peek: false, top: 0x2a7a5a, hair: 0x333333, a: Math.PI },
  { name: '好奇阿嬌', rate: 2.4, chatty: 0.3, peek: true, top: 0xb04050, hair: 0xcccccc, a: 1.1 },
];
for (const d of NPC_DEF) {
  const a = makeAma(d.top, d.hair); const ang = Math.PI / 2 + d.a; const r = 1.9;
  a.g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); a.g.lookAt(0, 0, 0); a.g.rotateY(Math.PI); scene.add(a.g);
  // 手頂的蚵仔佮蚵刀
  const oy = new THREE.Group(); oy.position.set(0, -0.15, -0.32); a.armL.add(oy);
  mesh(halfGeo, mat(0x6a6458), [0, 0, 0], oy);
  const meat = mesh(meatGeo, meatMat, [0, 0.025, 0], oy);
  const top = mesh(halfGeo, mat(0x9a9488), [0, 0.04, 0], oy);
  const kn = new THREE.Group(); kn.position.set(0, -0.18, -0.34); a.armR.add(kn);
  mesh(new THREE.BoxGeometry(0.03, 0.03, 0.09), mat(0x7a4a20), [0, 0, 0], kn);
  mesh(new THREE.BoxGeometry(0.02, 0.006, 0.09), mat(0xd0d0d8, { metalness: 0.8, roughness: 0.25 }), [0, 0, -0.09], kn);
  const bowlL = new THREE.Vector3(0.32, 0, -0.42); const bowl = a.g.localToWorld(bowlL.clone());
  mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.1, 14, 1, true), mat(0xdddddd, { side: THREE.DoubleSide }), [bowl.x, 0.05, bowl.z]);
  bowl.y = 0.08;
  const bubble = document.createElement('div'); bubble.className = 'bub'; bubble.style.opacity = '0'; $('bubbles').appendChild(bubble);
  npcs.push({ ...a, name: d.name, rate: d.rate, chatty: d.chatty, peek: d.peek, count: 0, pause: 0, look: 0, bubble, bubT: 0, lean: 0, cyc: Math.random(), dur: d.rate, ev: 0, oy, top, meat, bowl, bowlMeat: [] });
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
const PRAISE = ['好手路！', '有影準喔！', '彼粒擲甲真媠！'];
function say(n: Npc, t: string, dur = 3.2) { n.bubble.textContent = t; n.bubble.style.opacity = '1'; n.bubT = dur; }
let lastNag = '';
function nag(lines: string[]) {
  let t = pick(lines); while (t === lastNag && lines.length > 1) t = pick(lines); lastNag = t;
  const n = npcs.find(x => x.peek && Math.random() < 0.5) ?? pick(npcs); n.look = 2.5; say(n, t, 3);
}

// ---------- 玩家的雙手（掛佇鏡頭） ----------
const handRig = new THREE.Group(); camera.add(handRig);
const sleeve = mat(0x3a5a8a);
function makeHand(s: number) {
  const h = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8), sleeve, [0, 0, 0.12], h).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.11, 0.05, 0.13), mat(skin), [0, 0, -0.1], h);
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.022, 0.03, 0.07), mat(skin), [-0.04 + i * 0.026, -0.01, -0.19], h);
  mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), mat(skin), [s * -0.06, 0, -0.12], h).rotation.y = s * 0.6;
  return h;
}
const handL = makeHand(-1), handR = makeHand(1);
const HL = new THREE.Vector3(-0.16, -0.24, -0.42);
handL.position.copy(HL); handL.rotation.set(0.4, 0.3, 0.3);
handR.position.set(0.2, -0.26, -0.45); handR.rotation.set(0.3, -0.3, -0.2);
handRig.add(handL, handR);
const knife = new THREE.Group(); handR.add(knife); knife.position.set(-0.02, 0.03, -0.18); knife.rotation.set(0, 0.9, 0);
mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.11, 6), mat(0x7a4a20), [0, 0, 0], knife).rotation.z = Math.PI / 2;
mesh(new THREE.BoxGeometry(0.1, 0.006, 0.025), mat(0xd0d0d8, { metalness: 0.8, roughness: 0.25 }), [-0.1, 0, 0], knife);
const oyster = new THREE.Group(); handL.add(oyster); oyster.position.set(0.02, 0.05, -0.16);
const shellBotMat = mat(0x7a7468), shellTopMat = mat(0x9a9488);
const shellBot = mesh(halfGeo, shellBotMat, [0, -0.01, 0], oyster);
const meatInHand = mesh(meatGeo, meatMat, [0, 0.015, 0], oyster);
const shellTop = mesh(halfGeo, shellTopMat, [0, 0.025, 0], oyster);
const barnacles: THREE.Mesh[] = [];
for (let i = 0; i < 6; i++) barnacles.push(mesh(new THREE.ConeGeometry(0.012, 0.02, 5), mat(0x5a5448), [rnd(-0.08, 0.08), 0.045, rnd(-0.05, 0.05)], oyster));
const shimmer = mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0, 0], oyster);
const pearlMesh = mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.3 }), [0, 0.05, 0], oyster);
pearlMesh.visible = false;
const leanFaces: THREE.Group[] = [];
for (const s of [-1, 1]) { const f = makeAma(s < 0 ? 0x2a7a5a : 0xb04050, s < 0 ? 0x333333 : 0xcccccc).head; f.removeFromParent(); f.rotation.y = Math.PI; f.scale.setScalar(1.3); camera.add(f); f.userData.s = s; f.position.set(s * 1.2, 0.05, -0.75); leanFaces.push(f); }

// ---------- 音效 ----------
let ac: AudioContext | null = null;
const audio = () => (ac ??= new AudioContext());
function noise(dur: number, freq: number, vol: number) {
  const a = audio(), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = a.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start();
}
function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0) {
  const a = audio(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const crackSound = (big = true) => { noise(0.12, 2400, big ? 0.9 : 0.4); tone(180, 0.06, 0.3, 'triangle', 0.02); };
const ding = (rare: number) => { const base = [1318, 1568, 1760, 2093][rare]; tone(base, 1.4, 0.25); tone(base * 1.5, 1.2, 0.12, 'sine', 0.12); if (rare >= 2) tone(base * 2, 1.5, 0.1, 'sine', 0.3); };

// ---------- 難度、珍珠、存檔 ----------
const DIFF = [
  { n: '易', css: '#9be37a', z0: 0.5, z1: 0.92, speed: 0.8, pries: 1, scale: 0.85, rough: 0 },
  { n: '普通', css: '#f5d9a8', z0: 0.62, z1: 0.88, speed: 1.0, pries: 1, scale: 1.0, rough: 2 },
  { n: '硬', css: '#ffa860', z0: 0.68, z1: 0.85, speed: 1.25, pries: 2, scale: 1.15, rough: 4 },
  { n: '超硬', css: '#ff6a5a', z0: 0.72, z1: 0.83, speed: 1.5, pries: 3, scale: 1.3, rough: 6 },
];
const DIFF_W = [30, 40, 22, 8];
const RAR = [
  { name: '白珍珠', color: 0xf4f1ea, css: '#f4f1ea', w: 70, price: 200 },
  { name: '粉珍珠', color: 0xf3b5c8, css: '#f3b5c8', w: 20, price: 600 },
  { name: '金珍珠', color: 0xf2c440, css: '#f2c440', w: 8, price: 1800 },
  { name: '烏珍珠', color: 0x22202a, css: '#3a3548', w: 2, price: 6000 },
];
const OYSTER_PRICE = 3;
type Save = { dex: number[]; best: number; money: number; days: number; queen: number };
const save: Save = { dex: [0, 0, 0, 0], best: 0, money: 0, days: 0, queen: 0, ...JSON.parse(localStorage.getItem('oyster-sim') || '{}') };
const persist = () => localStorage.setItem('oyster-sim', JSON.stringify(save));
let dry = 0;
function rollPearl(): number {
  const p = 1 / 50 + Math.max(0, dry - 40) * 0.01;
  if (Math.random() >= p) { dry++; return -1; }
  dry = 0; let r = Math.random() * 100;
  for (let i = 0; i < 4; i++) { r -= RAR[i].w; if (r < 0) return i; } return 0;
}
function rollDiff() { let r = Math.random() * 100; for (let i = 0; i < 4; i++) { r -= DIFF_W[i]; if (r < 0) return i; } return 1; }

// ---------- 遊戲狀態 ----------
let state: 'menu' | 'play' | 'end' = 'menu';
let phase: 'pry' | 'aim' | 'busy' = 'busy';
let hp = 100, stabs = 0, flinch = 0, hurtT = 0, handPain = false;
let timeLeft = SHIFT, count = 0, opened = 0, missed = 0, abandoned = 0, perfects = 0, dayPearls: number[] = [];
let holding = false, hold = 0, nextPearl = -1, diff = 1, priesLeft = 1, slowmo = 0, shake = 0, pearlShow = 0;
let yaw = 0, pitch = -0.85, tYaw = 0, tPitch = -0.85;
const timers: { t: number; f: () => void }[] = [];
const later = (t: number, f: () => void) => timers.push({ t, f });
const flyers: { m: THREE.Object3D; p0: THREE.Vector3; p1: THREE.Vector3; t: number; dur: number; h: number; end?: () => void }[] = [];
const fly = (m: THREE.Object3D, p0: THREE.Vector3, p1: THREE.Vector3, dur: number, h: number, end?: () => void) => { scene.add(m); m.position.copy(p0); flyers.push({ m, p0, p1, t: 0, dur, h, end }); };
const gauge = $('gauge'), fill = $('fill'), zone = $('zone'), label = $('label'), hint = $('hint'), toastEl = $('toast');
let toastT = 0;
function toast(t: string, c = '#ffe080') { toastEl.textContent = t; toastEl.style.color = c; toastEl.classList.add('on'); toastT = 1.1; }
const PERF0 = 0.7, PERF1 = 0.8, IDEAL = 0.75;
function setPhase(p: typeof phase) {
  phase = p; holding = false; hold = 0; gauge.classList.remove('on');
  gauge.classList.toggle('aim', p === 'aim'); $('reticle').classList.toggle('on', p === 'aim');
  $('giveUp').classList.toggle('on', p === 'pry' && state === 'play');
  const d = DIFF[diff];
  if (p === 'aim') { zone.style.left = `${PERF0 * 100}%`; zone.style.width = `${(PERF1 - PERF0) * 100}%`; hint.textContent = '轉頭對準藍色碗，按住蓄力，在藍色區間放開投肉！'; $('diff').textContent = ''; }
  if (p === 'pry') { zone.style.left = `${d.z0 * 100}%`; zone.style.width = `${(d.z1 - d.z0) * 100}%`; hint.textContent = '按住撬開蚵仔，在金色區間放開！'; updDiff(); }
}
function updDiff() { const d = DIFF[diff], el = $('diff'); el.style.color = d.css; el.textContent = `難度：${d.n}${d.pries > 1 ? `（愛撬 ${priesLeft} 擺）` : ''}`; }
function newOyster() {
  if (state !== 'play') return;
  diff = rollDiff(); priesLeft = DIFF[diff].pries; const d = DIFF[diff];
  oyster.visible = true; oyster.scale.setScalar(d.scale); oyster.rotation.set(0, 0, 0);
  shellTop.visible = true; shellTop.position.set(0, 0.025, 0); shellTop.rotation.set(0, 0, 0); meatInHand.visible = true; pearlMesh.visible = false;
  shellTopMat.color.setHex([0xb0aa9c, 0x9a9488, 0x7e786c, 0x625c52][diff]);
  barnacles.forEach((b, i) => b.visible = i < d.rough);
  nextPearl = rollPearl(); setPhase('pry');
}
function startDay() {
  state = 'play'; handPain = false; timeLeft = SHIFT; count = opened = missed = abandoned = perfects = stabs = 0; hp = 100; dayPearls = [];
  npcs.forEach(n => { n.count = 0; });
  [...bowlMeat, ...splats].forEach(m => scene.remove(m)); bowlMeat.length = 0; splats.length = 0;
  ['overlay', 'result', 'dex'].forEach(i => $(i).classList.remove('show')); newOyster(); updHud();
}
function updHud() {
  const s = Math.max(0, Math.ceil(timeLeft)); $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  ($('hpFill') as HTMLElement).style.width = `${hp}%`;
  $('count').textContent = `🦪 ${count}`; $('pearls').textContent = `⚪ ${dayPearls.length}`;
  $('stats').textContent = `開 ${opened}・投進 ${count}・無入 ${missed}・浪費率 ${opened ? Math.round(missed / opened * 100) : 0}%・放棄 ${abandoned}・割手 ${stabs}`;
}
function worldOf(o: THREE.Object3D) { return o.getWorldPosition(new THREE.Vector3()); }
function release() {
  if (!holding) return; const h = hold; holding = false; hold = 0; gauge.classList.remove('on');
  if (state !== 'play') return;
  if (phase === 'pry') {
    const d = DIFF[diff];
    if (h >= d.z0 && h <= d.z1) {
      priesLeft--;
      if (priesLeft > 0) { crackSound(false); shake = 0.12; hint.textContent = `有裂矣！閣撬 ${priesLeft} 擺`; updDiff(); }
      else openOyster();
    } else { hint.textContent = h < d.z0 ? '猶未開，閣出力一點！' : '傷大力，刀仔滑去矣！'; tone(120, 0.1, 0.15, 'square'); if (h > d.z1 && Math.random() < [0.15, 0.25, 0.4, 0.55][diff]) { stab(); return; } if (h > d.z1) { setPhase('busy'); later(0.5, () => setPhase('pry')); } }
  } else if (phase === 'aim') shoot(h);
}
function stab() {
  const dmg = 10 + diff * 5; hp = Math.max(0, hp - dmg); stabs++;
  shake = 0.3; flinch = 0.6; hurtT = 0.9; tone(90, 0.25, 0.3, 'sawtooth'); noise(0.08, 900, 0.3);
  hint.textContent = `哎呀！刀仔割著手矣！（-${dmg}）`; toast('aiā！', '#ff9a8a'); nag(NAG_STAB); updHud();
  setPhase('busy');
  if (hp <= 0) { handPain = true; later(0.8, endDay); } else later(0.7, () => setPhase('pry'));
}
function openOyster() {
  crackSound(); shake = 0.25; opened++; setPhase('busy');
  shellTop.visible = false;
  const top = new THREE.Mesh(halfGeo, shellTopMat); fly(top, worldOf(oyster), pileSpot(), 0.6, 0.5, () => scene.remove(top));
  if (nextPearl >= 0) { revealPearl(nextPearl); later(2.5, () => { pearlMesh.visible = false; setPhase('aim'); }); }
  else later(0.2, () => setPhase('aim'));
  updHud();
}
function aimPoint() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const t = dir.y < -0.05 ? (BOWL.y - camera.position.y) / dir.y : 6;
  const p = camera.position.clone().addScaledVector(dir, t); p.y = BOWL.y;
  const off = p.clone().sub(camera.position).setY(0); if (off.length() > 3) off.setLength(3);
  return camera.position.clone().add(off).setY(BOWL.y);
}
function shoot(power: number) {
  setPhase('busy');
  const perfect = power >= PERF0 && power <= PERF1;
  if (perfect) { perfects++; toast('完美出手！', '#9fe0ff'); tone(1046, 0.25, 0.15); tone(1568, 0.3, 0.1, 'sine', 0.08); }
  const aim = aimPoint(), origin = camera.position.clone().setY(BOWL.y);
  const factor = perfect ? 1 : power / IDEAL;
  const land = origin.clone().lerp(aim, factor);
  if (!perfect) land.add(new THREE.Vector3(rnd(-0.05, 0.05), 0, rnd(-0.05, 0.05)));
  const inBowl = Math.hypot(land.x - BOWL.x, land.z - BOWL.z) < BOWL_R;
  meatInHand.visible = false;
  const from = worldOf(oyster); const m = new THREE.Mesh(meatGeo, meatMat);
  const dist = from.distanceTo(land);
  if (inBowl) land.set(BOWL.x + rnd(-0.08, 0.08), 0.06 + Math.min(bowlMeat.length, 40) * 0.0015, BOWL.z + rnd(-0.08, 0.08));
  else land.y = 0.01;
  noise(0.15, 600, 0.2);
  fly(m, from, land, 0.45 + dist * 0.15, 0.25 + dist * 0.2, () => {
    if (inBowl) { count++; bowlMeat.push(m); if (bowlMeat.length > 60) scene.remove(bowlMeat.shift()!); tone(520, 0.12, 0.2, 'triangle'); if (!perfect) toast('入碗！'); if (Math.random() < 0.15) { const n = pick(npcs); say(n, pick(PRAISE), 2); } }
    else { missed++; m.material = splatMat; m.scale.set(1.5, 0.25, 1.5); m.rotation.set(0, Math.random() * 3, 0); splats.push(m); if (splats.length > 30) scene.remove(splats.shift()!); noise(0.2, 300, 0.4); toast('無入！', '#ff8a7a'); nag(NAG_MISS); }
    updHud();
  });
  // 空殼仔擲掉，換下一粒
  later(0.35, () => { oyster.visible = false; const sh = new THREE.Mesh(halfGeo, shellBotMat); fly(sh, worldOf(oyster), pileSpot(), 0.6, 0.5, () => scene.remove(sh)); });
  later(0.8, newOyster);
}
function giveUp() {
  if (state !== 'play' || phase !== 'pry') return;
  abandoned++; setPhase('busy'); oyster.visible = false;
  const sh = new THREE.Mesh(shellGeo, shellTopMat); fly(sh, worldOf(oyster), pileSpot(), 0.6, 0.6, () => scene.remove(sh));
  hint.textContent = '擲掉矣…'; nag(NAG_GIVEUP); updHud();
  later(0.6, newOyster);
}
function revealPearl(r: number) {
  dayPearls.push(r); save.dex[r]++; persist(); renderDex();
  slowmo = 2.6; pearlShow = 2.6;
  (pearlMesh.material as THREE.MeshStandardMaterial).color.setHex(RAR[r].color);
  (pearlMesh.material as THREE.MeshStandardMaterial).emissive.setHex(r === 3 ? 0x302050 : RAR[r].color).multiplyScalar(0.25);
  pearlMesh.visible = true; ding(r);
  label.innerHTML = `${RAR[r].name}！<small>${['阿婆們攏越頭來看矣！', '哇～粉紅仔，真媠！', '金光閃閃，今仔日發矣！', '烏珍珠！！全巷仔攏轟動！'][r]}</small>`;
  label.style.color = RAR[r].css === '#3a3548' ? '#c9b8ff' : RAR[r].css; label.classList.add('on');
  const cries = ['哎唷！珍珠！', '予我看覓咧！', '好運喔你！', '天公伯仔有保庇！'];
  npcs.forEach((n, i) => { n.look = 2.6; say(n, cries[(i + r) % cries.length], 2.6); });
}
function endDay() {
  state = 'end'; setPhase('busy');
  const all = [{ name: '你（阿婆）', count, me: true }, ...npcs.map(n => ({ name: n.name, count: n.count, me: false }))].sort((a, b) => b.count - a.count);
  const queen = all[0].me;
  const pearlMoney = dayPearls.reduce((s, r) => s + RAR[r].price, 0), earn = count * OYSTER_PRICE + pearlMoney;
  const waste = opened ? Math.round(missed / opened * 100) : 0;
  save.days++; save.best = Math.max(save.best, count); save.money += earn; if (queen) save.queen++; persist();
  $('resTitle').textContent = handPain ? '🩹 手痛收工' : queen ? '👑 今日蚵后！' : '收工矣～';
  $('resBody').innerHTML = all.map((a, i) => `<div class="row"><span>${i + 1}. ${a.name}</span><b>${a.count} 粒入碗</b></div>`).join('') +
    `<p>開殼 ${opened} 粒・入碗 ${count} 粒・無入 ${missed} 粒<br>浪費率 <b>${waste}%</b>・完美出手 ${perfects} 擺・放棄 ${abandoned} 粒・割著手 ${stabs} 擺</p>` +
    `<p>蚵仔 ${count} 粒 × $${OYSTER_PRICE} = $${count * OYSTER_PRICE}<br>珍珠 ${dayPearls.length} 粒 = $${pearlMoney}<br><b style="font-size:20px">今日收入 $${earn}</b></p>` +
    `<p style="font-size:13px;opacity:.8">累積收入 $${save.money}・最佳紀錄 ${save.best} 粒・做蚵后 ${save.queen} 擺</p>` +
    `<p>${waste >= 30 ? '阿婆們：「塗跤攏是蚵仔肉，明仔載較準咧！」' : queen ? '阿婆們：「哎唷，今仔日予你贏去矣！」' : `${all[0].name}：「明仔載閣來拚喔～」`}</p>`;
  $('result').classList.add('show');
}
function renderDex() {
  $('dexList').innerHTML = RAR.map((r, i) => `<div class="dexItem"><div class="dot" style="background:${save.dex[i] ? r.css : '#333'};box-shadow:0 0 8px ${save.dex[i] ? r.css : 'transparent'}"></div><div><b>${save.dex[i] ? r.name : '？？？'}</b><br><small>收集 ${save.dex[i]} 粒・市價 $${r.price}</small></div></div>`).join('') +
    `<p style="font-size:13px">已收集 ${save.dex.filter(x => x).length} / 4 種</p>`;
}
renderDex();

// ---------- 操作 ----------
let down: { x: number; y: number; id: number; drag: boolean; yaw: number; pitch: number } | null = null;
const YAW = 1.25, P0 = -1.05, P1 = 0.15;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const canHold = () => state === 'play' && (phase === 'pry' || phase === 'aim');
canvas.addEventListener('pointerdown', e => {
  if (state !== 'play') return; audio().resume();
  down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, yaw: tYaw, pitch: tPitch };
  if (canHold()) { holding = true; hold = 0; }
});
window.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && state === 'play') {
    tYaw = -(e.clientX / innerWidth - 0.5) * 2 * YAW; tPitch = clamp(P0 + (1 - e.clientY / innerHeight) * (P1 - P0) * 1.15 - 0.05, P0, P1); return;
  }
  if (!down || down.id !== e.pointerId) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.drag && Math.hypot(dx, dy) > 14) { down.drag = true; holding = false; hold = 0; gauge.classList.remove('on'); }
  if (down.drag) { tYaw = clamp(down.yaw + dx * 0.006, -YAW, YAW); tPitch = clamp(down.pitch + dy * 0.006, P0, P1); }
});
const up = (e: PointerEvent) => { if (down && down.id === e.pointerId) { if (!down.drag) release(); down = null; } };
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && canHold()) { audio().resume(); holding = true; hold = 0; }
  if (e.code === 'KeyQ') giveUp();
});
window.addEventListener('keyup', e => { if (e.code === 'Space') release(); });
$('giveUp').addEventListener('pointerdown', e => { e.stopPropagation(); giveUp(); });
$('start').onclick = () => { audio(); startDay(); };
$('again').onclick = startDay;
$('dexBtn').onclick = () => { renderDex(); $('dex').classList.add('show'); };
$('dexClose').onclick = () => $('dex').classList.remove('show');

// ---------- 阿婆真正咧剝 ----------
function npcShuck(n: Npc, dt: number, t: number) {
  if (n.pause > 0) n.pause -= dt; else n.cyc += dt / n.dur;
  const c = n.cyc;
  // 0~.15 提蚵仔、.15~.6 撬、.6 開殼、.7 肉入碗、.85 殼擲去山、1 換一粒
  const prying = c > 0.15 && c < 0.6 && n.pause <= 0;
  n.armR.rotation.x = prying ? -0.25 + Math.sin(t * 28) * 0.12 : -0.05;
  n.armR.rotation.z = prying ? Math.sin(t * 14) * 0.08 : 0;
  n.armL.rotation.x = c < 0.15 ? -0.4 * (1 - c / 0.15) : -0.15;
  if (c >= 0.6 && n.ev === 0) { n.ev = 1; n.top.rotation.z = -1.3; n.top.position.set(-0.05, 0.07, 0); }
  if (c >= 0.7 && n.ev === 1) { n.ev = 2; n.meat.visible = false; const m = new THREE.Mesh(meatGeo, meatMat);
    fly(m, worldOf(n.meat), n.bowl.clone().add(new THREE.Vector3(rnd(-0.06, 0.06), Math.min(n.bowlMeat.length, 30) * 0.002, rnd(-0.06, 0.06))), 0.35, 0.15, () => {
      n.count++; n.bowlMeat.push(m); if (n.bowlMeat.length > 25) scene.remove(n.bowlMeat.shift()!); }); }
  if (c >= 0.85 && n.ev === 2) { n.ev = 3; n.oy.visible = false; const sh = new THREE.Mesh(halfGeo, shellMat); fly(sh, worldOf(n.oy), pileSpot(), 0.5, 0.4, () => scene.remove(sh)); }
  if (c >= 1) { n.cyc = 0; n.ev = 0; n.dur = n.rate * rnd(0.8, 1.2); n.oy.visible = true; n.meat.visible = true; n.top.rotation.z = 0; n.top.position.set(0, 0.04, 0); }
}

// ---------- 主迴圈 ----------
let baseFov = 70, narrow = false;
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  narrow = camera.aspect < 0.8; baseFov = narrow ? 82 : 70; handRig.position.set(0, narrow ? -0.02 : 0, 0); handRig.scale.set(narrow ? 0.42 : 0.7, narrow ? 0.6 : 0.7, 0.7); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); const v = new THREE.Vector3();
let chatTimer = 2;
function frame() {
  const rdt = Math.min(clock.getDelta(), 0.05);
  slowmo = Math.max(0, slowmo - rdt); const dt = rdt * (slowmo > 0.4 ? 0.3 : 1), t = clock.elapsedTime;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= rdt; if (timers[i].t <= 0) { const f = timers[i].f; timers.splice(i, 1); f(); } }
  hurtT = Math.max(0, hurtT - rdt); flinch = Math.max(0, flinch - rdt); ($('hurt') as HTMLElement).style.opacity = String(Math.min(0.55, hurtT * 0.6));
  toastT -= rdt; if (toastT <= 0) toastEl.classList.remove('on');
  if (state === 'play') {
    timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; endDay(); }
    hp = Math.min(100, hp + dt / 6);
    if (holding) {
      gauge.classList.add('on');
      if (phase === 'pry') { hold += dt * DIFF[diff].speed; if (hold > 1.15) { hold = 1.2; release(); } }
      else if (phase === 'aim') { hold += dt * 1.1; if (hold > 1.25) { hold = 1.3; release(); } }
    }
    fill.style.width = `${Math.min(1, hold) * 100}%`;
    chatTimer -= dt; if (chatTimer <= 0) { chatTimer = 3 + Math.random() * 4; const n = npcs[Math.random() < 0.5 ? 1 : Math.floor(Math.random() * 3)]; if (n.bubT <= 0) { say(n, pick(GOSSIP)); if (Math.random() < n.chatty) n.pause = 2.5; } }
    for (const n of npcs) {
      npcShuck(n, dt, t);
      if (n.peek && n.look <= 0 && Math.random() < dt * 0.06) { n.look = 2.5; say(n, pick(PEEK), 2.5); }
    }
    updHud();
  }
  for (const n of npcs) {
    n.look -= dt; n.bubT -= rdt; if (n.bubT <= 0) n.bubble.style.opacity = '0';
    const tgtY = n.look > 0 ? Math.atan2(camera.position.x - n.g.position.x, camera.position.z - n.g.position.z) - n.g.rotation.y : 0;
    n.lean += ((n.look > 0 ? 1 : 0) - n.lean) * Math.min(1, rdt * 4);
    n.head.rotation.set(n.pause > 0 ? -0.15 : 0.35 - n.lean * 0.3, 0, 0); n.body.rotation.x = n.lean * 0.15;
    n.head.rotation.y = THREE.MathUtils.lerp(0, Math.atan2(Math.sin(tgtY + Math.PI), Math.cos(tgtY + Math.PI)), n.lean);
    n.head.getWorldPosition(v); v.y += 0.28; v.project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    n.bubble.style.display = vis ? 'block' : 'none';
    n.bubble.style.left = `${clamp((v.x * .5 + .5) * innerWidth, 90, innerWidth - 90)}px`; n.bubble.style.top = `${(-v.y * .5 + .5) * innerHeight}px`;
  }
  for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt / f.dur; const k = Math.min(1, f.t); f.m.position.lerpVectors(f.p0, f.p1, k); f.m.position.y += Math.sin(k * Math.PI) * f.h; if (k < 1) f.m.rotation.x += dt * 8; else { flyers.splice(i, 1); f.end?.(); } }
  // 珍珠演出（手機直向時縮小放大量，珍珠保持佇畫面內）
  pearlShow = Math.max(0, pearlShow - rdt);
  const pe = pearlShow > 0 ? Math.min(1, pearlShow * 2, (2.6 - pearlShow) * 4) : 0;
  if (pearlShow <= 0) label.classList.remove('on');
  (shimmer.material as THREE.MeshBasicMaterial).opacity = holding && phase === 'pry' && nextPearl >= 0 ? 0.25 + Math.sin(t * 8) * 0.12 : pe * 0.25;
  pearlMesh.rotation.y += rdt * 2;
  const ds = DIFF[diff].scale;
  oyster.scale.setScalar(ds * (1 + pe * (narrow ? 0.25 : 0.6)));
  handL.position.set(HL.x + (narrow ? 0.12 : 0.05) * pe, HL.y + 0.06 * pe, HL.z);
  leanFaces.forEach(f => { f.position.x = f.userData.s * ((narrow ? 0.75 : 1.2) - (narrow ? 0.35 : 0.62) * pe); f.position.y = 0.05 - 0.08 * pe; f.rotation.z = -f.userData.s * 0.35 * pe; });
  // 撬／投的手勢
  const pry = holding && phase === 'pry' ? Math.min(1, hold) : 0;
  handR.rotation.z = -0.2 + pry * 0.5 + Math.sin(t * 40) * pry * 0.02; handR.position.x = 0.2 - pry * 0.04;
  const ch = holding && phase === 'aim' ? Math.min(1, hold) : 0;
  if (phase === 'aim' || ch) { handL.position.y += 0.05 + ch * 0.06; handL.position.z -= ch * 0.05; handL.rotation.x = 0.4 - ch * 0.5; } else handL.rotation.x = 0.4;
  if (flinch > 0) { handL.position.x -= flinch * 0.08 * Math.abs(Math.sin(t * 30)); handL.position.y -= flinch * 0.1; handL.rotation.z = 0.3 + flinch * 0.8; } else handL.rotation.z = 0.3;
  yaw += (tYaw - yaw) * Math.min(1, rdt * 8); pitch += (tPitch - pitch) * Math.min(1, rdt * 8);
  shake = Math.max(0, shake - rdt);
  camera.rotation.set(pitch - pe * 0.08, yaw, 0);
  camera.position.copy(SEAT); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(shake * 0.03));
  camera.fov = baseFov - pe * (narrow ? 10 : 22); camera.updateProjectionMatrix();
  lamp.intensity = 30 + Math.sin(t * 1.3) * 1.2;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// ---------- 截圖模式 ----------
if (SHOT) {
  startDay(); npcs.forEach((n, i) => { n.count = 5 + i * 3; });
  const look = (y: number, p: number) => { tYaw = yaw = y; tPitch = pitch = p; };
  if (SHOT === 'diff') { diff = 3; priesLeft = 3; newOyster(); diff = 3; priesLeft = 2; oyster.scale.setScalar(1.3); barnacles.forEach(b => b.visible = true); shellTopMat.color.setHex(0x625c52); setPhase('pry'); updDiff(); holding = true; hold = 0.6; }
  if (SHOT === 'aim') { look(-0.55, -0.68); shellTop.visible = false; setPhase('aim'); holding = true; hold = 0.55; }
  if (SHOT === 'miss') { look(-0.2, -0.45); shellTop.visible = false; setPhase('aim'); opened = 3; count = 2; shoot(1.2); later(0.1, () => say(npcs[1], NAG_MISS[0], 99)); }
  if (SHOT === 'npc') { look(0.15, -0.25); npcs.forEach((n, i) => { n.cyc = [0.4, 0.65, 0.3][i]; }); say(npcs[1], GOSSIP[3], 99); }
  if (SHOT === 'pearl') { look(0, -0.85); openOyster(); revealPearl(2); slowmo = 99; pearlShow = 1.6; }
  if (SHOT === 'stab') { hp = 55; diff = 2; stab(); }
  if (SHOT === 'end') { count = 38; opened = 47; missed = 9; abandoned = 3; perfects = 12; dayPearls = [0, 2]; endDay(); }
}
frame();
