import * as THREE from 'three';

// ---------- 基本設定 ----------
const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // 截圖測試用：down | up | pearl
const SHIFT = 180;
const canvas = $('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!SHOT });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d18);
scene.fog = new THREE.Fog(0x0b0d18, 6, 16);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
scene.add(camera);
const SEAT = new THREE.Vector3(0, 1.05, 2.0);
camera.position.copy(SEAT);

const mat = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
function mesh(g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], parent: THREE.Object3D = scene) {
  const x = new THREE.Mesh(g, m); if (p) x.position.set(...p); x.castShadow = true; x.receiveShadow = parent === scene; parent.add(x); return x;
}

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
// 窗戶微光、紅燈籠
for (let i = 0; i < 4; i++) mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.5 }), [-3 + i * 2, 2.6, -4.8]);
const lantern = mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd03020 }), [-3, 3.2, -4.4]);
const lp = new THREE.PointLight(0xff4020, 3, 4); lp.position.copy(lantern.position); scene.add(lp);
mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), mat(0x2060a0), [3.6, 0.2, -3.5]); // 塑膠籃
// 中央蚵殼山
const shellGeo = new THREE.DodecahedronGeometry(0.09, 0); shellGeo.scale(1.3, 0.45, 1);
const shellMat = mat(0x8a8478);
mesh(new THREE.ConeGeometry(0.9, 0.55, 10), shellMat, [0, 0.27, 0]);
const pile = new THREE.InstancedMesh(shellGeo, shellMat, 260); pile.castShadow = true;
{ const d = new THREE.Object3D(); for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.0, h = Math.max(0, 0.55 * (1 - r / 0.95)); d.position.set(Math.cos(a) * r, h + 0.03, Math.sin(a) * r); d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); d.updateMatrix(); pile.setMatrixAt(i, d.matrix); } }
scene.add(pile);

// 玩家前面的面盆、碗、椅仔
const basin = mesh(new THREE.CylinderGeometry(0.33, 0.26, 0.18, 16, 1, true), mat(0xc84030, { side: THREE.DoubleSide }), [-0.05, 0.1, 1.35]);
const basinShells = new THREE.InstancedMesh(shellGeo, shellMat, 25);
{ const d = new THREE.Object3D(); for (let i = 0; i < 25; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.24; d.position.set(-0.05 + Math.cos(a) * r, 0.12 + Math.random() * 0.05, 1.35 + Math.sin(a) * r); d.rotation.set(Math.random(), Math.random() * 3, Math.random()); d.updateMatrix(); basinShells.setMatrixAt(i, d.matrix); } }
scene.add(basinShells);
const BOWL = new THREE.Vector3(0.42, 0.14, 1.55);
mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xeeeeee, { side: THREE.DoubleSide, roughness: 0.4 }), [BOWL.x, 0.18, BOWL.z]).rotation.x = 0;
const bowlMeat: THREE.Mesh[] = [];
const meatMat = mat(0xd8cbb0, { roughness: 0.3, metalness: 0.1 });
const meatGeo = new THREE.SphereGeometry(0.035, 8, 6); meatGeo.scale(1.4, 0.6, 1);

// ---------- 阿婆 ----------
type Npc = { g: THREE.Group; head: THREE.Group; armL: THREE.Object3D; armR: THREE.Object3D; name: string; rate: number; chatty: number; peek: boolean; count: number; cd: number; pause: number; look: number; bubble: HTMLDivElement; bubT: number; lean: number; angle: number };
const npcs: Npc[] = [];
const skin = 0xd9a07a;
function makeAma(top: number, hair: number) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 8), mat(0x885530), [0, 0.15, 0.05], g); // 椅仔
  mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.55, 8), mat(top), [0, 0.6, 0], g);
  mesh(new THREE.BoxGeometry(0.42, 0.14, 0.45), mat(0x2a2a40), [0, 0.35, -0.15], g); // 腳
  const head = new THREE.Group(); head.position.set(0, 1.02, 0); g.add(head);
  mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(skin), [0, 0, 0], head);
  mesh(new THREE.SphereGeometry(0.155, 10, 8, 0, Math.PI * 2, 0, 1.4), mat(hair), [0, 0.02, 0.02], head);
  mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(hair), [0, 0.1, 0.13], head); // 頭鬃髻
  for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.018, 6, 4), mat(0x111111), [s * 0.05, 0.02, -0.14], head); }
  mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), mat(0x803030), [0, -0.06, -0.145], head);
  const arm = (s: number) => { const p = new THREE.Group(); p.position.set(s * 0.2, 0.8, -0.02); g.add(p); mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 6), mat(top), [0, -0.12, -0.12], p).rotation.x = 1.1; mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(skin), [0, -0.2, -0.3], p); return p; };
  return { g, head, armL: arm(-1), armR: arm(1) };
}
const NPC_DEF = [
  { name: '快手阿桃', rate: 1.9, chatty: 0.1, peek: false, top: 0x6a3a8a, hair: 0x999999, a: -1.1 },
  { name: '講話阿春', rate: 2.8, chatty: 0.6, peek: false, top: 0x2a7a5a, hair: 0x333333, a: Math.PI },
  { name: '好奇阿嬌', rate: 2.4, chatty: 0.3, peek: true, top: 0xb04050, hair: 0xcccccc, a: 1.1 },
];
for (const d of NPC_DEF) {
  const a = makeAma(d.top, d.hair); const ang = Math.PI / 2 + d.a; const r = 1.9;
  a.g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); a.g.lookAt(0, 0, 0); a.g.rotateY(Math.PI);
  scene.add(a.g);
  const bubble = document.createElement('div'); bubble.className = 'bub'; bubble.style.opacity = '0'; $('bubbles').appendChild(bubble);
  npcs.push({ ...a, name: d.name, rate: d.rate, chatty: d.chatty, peek: d.peek, count: 0, cd: d.rate, pause: 0, look: 0, bubble, bubT: 0, lean: 0, angle: ang });
}
const GOSSIP = [
  '恁敢知，巷仔尾阿雄閣換頭路矣', '今仔日的蚵仔誠肥喔！', '阮孫講欲讀博士，我聽攏無', '聽講今仔日有人撥著烏珍珠喔', '撥較緊咧，等一下菜市仔欲收矣',
  '這擺颱風無來，蚵仔有夠讚', '我少年時一工撥兩千粒咧', '恁新婦有轉來無？', '珍珠喔～愈撥愈有機會啦', '你彼盆哪會撥遮慢？',
  '蚵仔煎攤頭家講欲加訂', '啊～腰痠矣，歇一下', '昨昏電視彼齣真好看', '金色的珍珠，一世人看過一擺爾爾',
];
const PEEK = ['欸，你彼粒是毋是有物件？', '我看覓咧～', '你撥偌濟矣？'];
function say(n: Npc, t: string, dur = 3.2) { n.bubble.textContent = t; n.bubble.style.opacity = '1'; n.bubT = dur; }

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
handL.position.set(-0.16, -0.24, -0.42); handL.rotation.set(0.4, 0.3, 0.3);
handR.position.set(0.2, -0.26, -0.45); handR.rotation.set(0.3, -0.3, -0.2);
handRig.add(handL, handR);
const knife = new THREE.Group(); handR.add(knife); knife.position.set(-0.02, 0.03, -0.18); knife.rotation.set(0, 0.9, 0);
mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.11, 6), mat(0x7a4a20), [0, 0, 0], knife).rotation.z = Math.PI / 2;
mesh(new THREE.BoxGeometry(0.1, 0.006, 0.025), mat(0xd0d0d8, { metalness: 0.8, roughness: 0.25 }), [-0.1, 0, 0], knife);
// 手頂的蚵仔
const oyster = new THREE.Group(); handL.add(oyster); oyster.position.set(0.02, 0.05, -0.16);
const shellTop = mesh(shellGeo.clone().scale(0.9, 0.9, 0.9), mat(0x9a9488), [0, 0.02, 0], oyster);
const shellBot = mesh(shellGeo.clone().scale(0.9, 1.2, 0.9), mat(0x7a7468), [0, -0.01, 0], oyster);
const shimmer = mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0, 0], oyster);
const pearlMesh = mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.3 }), [0, 0.05, 0], oyster);
pearlMesh.visible = false;
// 珍珠出現時湊過來的阿婆面（掛佇鏡頭兩邊）
const leanFaces: THREE.Group[] = [];
for (const s of [-1, 1]) { const f = makeAma(s < 0 ? 0x2a7a5a : 0xb04050, s < 0 ? 0x333333 : 0xcccccc).head; f.removeFromParent(); f.rotation.y = Math.PI; f.scale.setScalar(1.3); camera.add(f); f.userData.s = s; f.position.set(s * 1.2, 0.05, -0.75); leanFaces.push(f); }

// ---------- 音效（WebAudio 合成） ----------
let ac: AudioContext | null = null;
const audio = () => (ac ??= new AudioContext());
function crackSound() {
  const a = audio(), n = a.sampleRate * 0.12, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.8;
  const g = a.createGain(); g.gain.value = 0.9; s.connect(f).connect(g).connect(a.destination); s.start();
  tone(180, 0.06, 0.3, 'triangle', 0.02);
}
function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0) {
  const a = audio(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const ding = (rare: number) => { const base = [1318, 1568, 1760, 2093][rare]; tone(base, 1.4, 0.25); tone(base * 1.5, 1.2, 0.12, 'sine', 0.12); if (rare >= 2) tone(base * 2, 1.5, 0.1, 'sine', 0.3); };

// ---------- 珍珠與存檔 ----------
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
  const p = 1 / 50 + Math.max(0, dry - 40) * 0.01; // 保底：連續 40 粒無珍珠後每粒 +1%
  if (Math.random() >= p) { dry++; return -1; }
  dry = 0; let r = Math.random() * 100;
  for (let i = 0; i < 4; i++) { r -= RAR[i].w; if (r < 0) return i; } return 0;
}

// ---------- 遊戲狀態 ----------
let state: 'menu' | 'play' | 'end' = 'menu';
let timeLeft = SHIFT, count = 0, dayPearls: number[] = [];
let holding = false, hold = 0, nextPearl = -1, cooldown = 0, slowmo = 0, shake = 0, pearlShow = 0;
let yaw = 0, pitch = -0.85, tYaw = 0, tPitch = -0.85;
const flyers: { m: THREE.Object3D; p0: THREE.Vector3; p1: THREE.Vector3; t: number; dur: number; h: number; end?: () => void }[] = [];
const gauge = $('gauge'), fill = $('fill'), label = $('label');
function newOyster() { oyster.visible = true; oyster.scale.setScalar(1); shellTop.position.set(0, 0.02, 0); shellTop.rotation.set(0, 0, 0); pearlMesh.visible = false; nextPearl = rollPearl(); }
function startDay() {
  state = 'play'; timeLeft = SHIFT; count = 0; dayPearls = []; npcs.forEach(n => { n.count = 0; n.cd = n.rate; });
  bowlMeat.forEach(m => scene.remove(m)); bowlMeat.length = 0;
  ['overlay', 'result', 'dex'].forEach(i => $(i).classList.remove('show')); newOyster(); updHud();
}
function updHud() {
  const s = Math.max(0, Math.ceil(timeLeft)); $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('count').textContent = `🦪 ${count}`; $('pearls').textContent = `⚪ ${dayPearls.length}`;
}
const SWEET0 = 0.62, SWEET1 = 0.88;
function release() {
  if (!holding) return; holding = false; gauge.classList.remove('on');
  if (state !== 'play' || cooldown > 0) return;
  if (hold >= SWEET0 && hold <= SWEET1) shuck();
  else { $('hint').textContent = hold < SWEET0 ? '猶未開，閣出力一點！' : '傷大力，刀仔滑去矣！'; cooldown = hold > SWEET1 ? 0.5 : 0.1; tone(120, 0.1, 0.15, 'square'); }
  hold = 0;
}
function worldOf(o: THREE.Object3D) { return o.getWorldPosition(new THREE.Vector3()); }
function shuck() {
  crackSound(); shake = 0.25; count++; $('hint').textContent = ['讚！', '好手路！', '真輕鬆～', '啵！'][count % 4];
  const p = nextPearl;
  // 蚵仔肉跳入碗
  const meat = new THREE.Mesh(meatGeo, meatMat); scene.add(meat);
  const from = worldOf(oyster), to = BOWL.clone().add(new THREE.Vector3((Math.random() - .5) * .14, 0.04 + Math.min(bowlMeat.length, 40) * 0.002, (Math.random() - .5) * .14));
  flyers.push({ m: meat, p0: from, p1: to, t: 0, dur: 0.45, h: 0.25, end: () => { bowlMeat.push(meat); if (bowlMeat.length > 60) scene.remove(bowlMeat.shift()!); } });
  // 殼仔擲去殼山
  const sh = new THREE.Mesh(shellGeo, shellMat); scene.add(sh);
  flyers.push({ m: sh, p0: from.clone(), p1: new THREE.Vector3((Math.random() - .5) * 0.8, 0.35, 0.6 + Math.random() * 0.2), t: 0, dur: 0.6, h: 0.5, end: () => scene.remove(sh) });
  if (p >= 0) revealPearl(p); else { oyster.visible = false; cooldown = 0.25; }
  updHud();
}
function revealPearl(r: number) {
  dayPearls.push(r); save.dex[r]++; persist(); renderDex();
  slowmo = 2.6; pearlShow = 2.6; cooldown = 2.4;
  shellTop.position.set(-0.03, 0.07, 0); shellTop.rotation.set(0, 0, 0.9);
  (pearlMesh.material as THREE.MeshStandardMaterial).color.setHex(RAR[r].color);
  (pearlMesh.material as THREE.MeshStandardMaterial).emissive.setHex(r === 3 ? 0x302050 : RAR[r].color).multiplyScalar(0.25);
  pearlMesh.visible = true; ding(r);
  label.innerHTML = `${RAR[r].name}！<small>${['阿婆們攏越頭來看矣！', '哇～粉紅仔，真媠！', '金光閃閃，今仔日發矣！', '烏珍珠！！全巷仔攏轟動！'][r]}</small>`;
  label.style.color = RAR[r].css === '#3a3548' ? '#c9b8ff' : RAR[r].css; label.classList.add('on');
  const cries = ['哎唷！珍珠！', '予我看覓咧！', '好運喔你！', '天公伯仔有保庇！'];
  npcs.forEach((n, i) => { n.look = 2.6; say(n, cries[(i + r) % cries.length], 2.6); });
}
function endDay() {
  state = 'end'; holding = false; gauge.classList.remove('on');
  const all = [{ name: '你（阿婆）', count, me: true }, ...npcs.map(n => ({ name: n.name, count: n.count, me: false }))].sort((a, b) => b.count - a.count);
  const queen = all[0].me;
  const pearlMoney = dayPearls.reduce((s, r) => s + RAR[r].price, 0), earn = count * OYSTER_PRICE + pearlMoney;
  save.days++; save.best = Math.max(save.best, count); save.money += earn; if (queen) save.queen++; persist();
  $('resTitle').textContent = queen ? '👑 今日蚵后！' : '收工矣～';
  $('resBody').innerHTML = all.map((a, i) => `<div class="row"><span>${i + 1}. ${a.name}</span><b>${a.count} 粒</b></div>`).join('') +
    `<p>蚵仔 ${count} 粒 × $${OYSTER_PRICE} = $${count * OYSTER_PRICE}<br>珍珠 ${dayPearls.length} 粒 = $${pearlMoney}<br><b style="font-size:20px">今日收入 $${earn}</b></p>` +
    `<p style="font-size:13px;opacity:.8">累積收入 $${save.money}・最佳紀錄 ${save.best} 粒・做蚵后 ${save.queen} 擺</p>` +
    `<p>${queen ? '阿婆們：「哎唷，今仔日予你贏去矣！」' : `${all[0].name}：「明仔載閣來拚喔～」`}</p>`;
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
canvas.addEventListener('pointerdown', e => {
  if (state !== 'play') return; audio().resume();
  down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, yaw: tYaw, pitch: tPitch };
  if (cooldown <= 0) { holding = true; hold = 0; }
});
window.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && state === 'play') { // 電腦：滑鼠位置決定視角
    tYaw = -(e.clientX / innerWidth - 0.5) * 2 * YAW; tPitch = clamp(P0 + (1 - e.clientY / innerHeight) * (P1 - P0) * 1.15 - 0.05, P0, P1); return;
  }
  if (!down || down.id !== e.pointerId) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.drag && Math.hypot(dx, dy) > 14) { down.drag = true; holding = false; hold = 0; gauge.classList.remove('on'); }
  if (down.drag) { tYaw = clamp(down.yaw + dx * 0.006, -YAW, YAW); tPitch = clamp(down.pitch + dy * 0.006, P0, P1); }
});
const up = (e: PointerEvent) => { if (down && down.id === e.pointerId) { if (!down.drag) release(); down = null; } };
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
window.addEventListener('keydown', e => { if (e.code === 'Space' && state === 'play' && !e.repeat && cooldown <= 0) { audio().resume(); holding = true; hold = 0; } });
window.addEventListener('keyup', e => { if (e.code === 'Space') release(); });
$('start').onclick = () => { audio(); startDay(); };
$('again').onclick = startDay;
$('dexBtn').onclick = () => { renderDex(); $('dex').classList.add('show'); };
$('dexClose').onclick = () => $('dex').classList.remove('show');

// ---------- 主迴圈 ----------
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const narrow = camera.aspect < 0.8; baseFov = narrow ? 82 : 70; handRig.position.set(0, narrow ? -0.02 : 0, 0); handRig.scale.set(narrow ? 0.42 : 0.7, narrow ? 0.6 : 0.7, 0.7); }
let baseFov = 70;
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); const v = new THREE.Vector3();
let chatTimer = 2;
function frame() {
  const rdt = Math.min(clock.getDelta(), 0.05);
  slowmo = Math.max(0, slowmo - rdt); const dt = rdt * (slowmo > 0.4 ? 0.3 : 1), t = clock.elapsedTime;
  if (state === 'play') {
    timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; endDay(); }
    if (cooldown > 0) { cooldown -= rdt; if (cooldown <= 0 && !oyster.visible || (pearlShow <= 0 && pearlMesh.visible && cooldown <= 0)) newOyster(); }
    if (holding) { hold += dt / 1.0; gauge.classList.add('on'); if (hold > 1.15) { hold = 1.2; release(); } }
    fill.style.width = `${Math.min(1, hold) * 100}%`;
    // 阿婆
    chatTimer -= dt; if (chatTimer <= 0) { chatTimer = 3 + Math.random() * 4; const n = npcs[Math.random() < 0.5 ? 1 : Math.floor(Math.random() * 3)]; if (n.bubT <= 0) { say(n, GOSSIP[Math.floor(Math.random() * GOSSIP.length)]); if (Math.random() < n.chatty) n.pause = 2.5; } }
    for (const n of npcs) {
      if (n.pause > 0) n.pause -= dt; else { n.cd -= dt; if (n.cd <= 0) { n.count++; n.cd = n.rate * (0.8 + Math.random() * 0.4); } }
      if (n.peek && n.look <= 0 && Math.random() < dt * 0.06) { n.look = 2.5; say(n, PEEK[Math.floor(Math.random() * PEEK.length)], 2.5); }
    }
    updHud();
  }
  for (const n of npcs) {
    n.look -= dt; n.bubT -= rdt; if (n.bubT <= 0) n.bubble.style.opacity = '0';
    const work = n.pause > 0 ? 0 : 1, sp = 6 / n.rate;
    n.armL.rotation.x = Math.sin(t * sp) * 0.25 * work; n.armR.rotation.x = Math.cos(t * sp * 1.3) * 0.35 * work;
    const tgtY = n.look > 0 ? Math.atan2(camera.position.x - n.g.position.x, camera.position.z - n.g.position.z) - n.g.rotation.y : 0;
    n.lean += ((n.look > 0 ? 1 : 0) - n.lean) * Math.min(1, rdt * 4);
    n.head.rotation.set(n.pause > 0 ? -0.15 : 0.35 - n.lean * 0.3, 0, 0); n.head.rotation.y = 0; n.g.children[1].rotation.x = n.lean * 0.15;
    n.head.rotation.y = THREE.MathUtils.lerp(0, Math.atan2(Math.sin(tgtY + Math.PI), Math.cos(tgtY + Math.PI)), n.lean);
    // 對話框位置
    n.head.getWorldPosition(v); v.y += 0.28; v.project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    n.bubble.style.display = vis ? 'block' : 'none';
    n.bubble.style.left = `${(v.x * .5 + .5) * innerWidth}px`; n.bubble.style.top = `${(-v.y * .5 + .5) * innerHeight}px`;
  }
  // 飛行物
  for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt / f.dur; const k = Math.min(1, f.t); f.m.position.lerpVectors(f.p0, f.p1, k); f.m.position.y += Math.sin(k * Math.PI) * f.h; f.m.rotation.x += dt * 8; if (k >= 1) { flyers.splice(i, 1); f.end?.(); } }
  // 珍珠演出
  pearlShow = Math.max(0, pearlShow - rdt);
  const pe = pearlShow > 0 ? Math.min(1, pearlShow * 2, (2.6 - pearlShow) * 4) : 0;
  if (pearlShow <= 0) label.classList.remove('on');
  const shim = holding && nextPearl >= 0 ? 0.25 + Math.sin(t * 8) * 0.12 : pe * 0.25;
  (shimmer.material as THREE.MeshBasicMaterial).opacity = shim;
  pearlMesh.rotation.y += rdt * 2; oyster.scale.setScalar(1 + pe * 0.6);
  leanFaces.forEach(f => { f.position.x = f.userData.s * (1.2 - 0.62 * pe); f.position.y = 0.05 - 0.08 * pe; f.rotation.z = -f.userData.s * 0.35 * pe; });
  // 撬開動作
  const pry = holding ? Math.min(1, hold) : 0;
  handR.rotation.z = -0.2 + pry * 0.5 + Math.sin(t * 40) * pry * 0.02; handR.position.x = 0.2 - pry * 0.04;
  // 鏡頭
  yaw += (tYaw - yaw) * Math.min(1, rdt * 8); pitch += (tPitch - pitch) * Math.min(1, rdt * 8);
  shake = Math.max(0, shake - rdt);
  camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.y = yaw; camera.rotation.x = pitch - pe * 0.08;
  camera.position.copy(SEAT); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(shake * 0.03));
  camera.fov = baseFov - pe * 22; camera.updateProjectionMatrix();
  lamp.intensity = 30 + Math.sin(t * 1.3) * 1.2; // 輕輕閃爍，無刺眼
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
camera.rotation.order = 'YXZ';
// ---------- 截圖模式 ----------
if (SHOT) {
  startDay(); npcs.forEach((n, i) => { n.count = 5 + i * 3; });
  if (SHOT === 'up') { tYaw = yaw = 0.15; tPitch = pitch = -0.05; say(npcs[0], GOSSIP[0], 99); say(npcs[1], GOSSIP[3], 99); say(npcs[2], PEEK[0], 99); }
  if (SHOT === 'down') { holding = true; hold = 0.7; }
  if (SHOT === 'pearl') { tPitch = pitch = -0.85; revealPearl(Number(params.get('r') ?? 2)); slowmo = 99; pearlShow = 1.6; }
  if (SHOT === 'end') { count = 42; dayPearls = [0, 2]; endDay(); }
}
frame();
