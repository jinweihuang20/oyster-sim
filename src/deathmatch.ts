// 死鬥模式（測試）：獨立場景、獨立 renderer，不動存檔／金錢／成就／統計
import * as THREE from 'three';

type Part = 'head' | 'body' | 'legs';
interface Fighter {
  name: string; isPlayer: boolean; pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; pitch: number;
  hp: number; ammo: number; dead: boolean; respawnAt: number; invulnUntil: number;
  kills: number; deaths: number; hs: number; shots: number; hits: number;
  mesh: THREE.Group | null; cd: number; goal: THREE.Vector3; idleUntil: number; pickT: number;
}
interface Shell { pos: THREE.Vector3; vel: THREE.Vector3; owner: Fighter; mesh: THREE.Mesh; life: number; }

const SPEED = 24, HALF = 18, MAXAMMO = 5, EYE = 1.6, R = 0.35;
const PILE = new THREE.Vector3(0, 0, 0);
const COVERS: THREE.Box3[] = [
  [-8, -6], [8, 6], [-7, 8], [7, -8], [0, 11], [0, -11], [-12, 0], [12, 0],
].map(([x, z]) => new THREE.Box3(new THREE.Vector3(x - 1.4, 0, z - 0.6), new THREE.Vector3(x + 1.4, 1.5, z + 0.6)));
const SPAWNS = [[-15, -15], [15, 15], [-15, 15], [15, -15], [0, -16], [0, 16], [-16, 0], [16, 0]];

let active = false;
export const isDeathmatchActive = () => active;

export function openDeathmatch(onExit: () => void) {
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
#dmJoy{position:absolute;left:calc(env(safe-area-inset-left) + 30px);bottom:calc(env(safe-area-inset-bottom) + 30px);width:120px;height:120px;border-radius:50%;border:3px solid rgba(255,210,63,.7);background:rgba(0,0,0,.25)}
#dmKnob{position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:rgba(255,210,63,.8)}
#dmHelp{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 12px);transform:translateX(-50%);color:#fff6d8;font-size:14px;text-shadow:0 1px 0 #000;pointer-events:none}
</style><canvas></canvas><div id="dmCross"></div><div id="dmMark"></div><div id="dmMsg"></div><div id="dmHud"></div>
<button class="dmb" id="dmScoreBtn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" style="vertical-align:-3px"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg> 戰績</button>
<button class="dmb" id="dmX" aria-label="離開">✕</button><div id="dmBoard"><h2>戰績</h2><div id="dmTable"></div></div>
${isTouch ? '<div id="dmJoy"><div id="dmKnob"></div></div><button class="dmb" id="dmPick">拿殼</button><button class="dmb" id="dmThrow">丟</button>' : '<div id="dmHelp">點畫面鎖定滑鼠｜WASD 移動｜左鍵 丟｜E 拿殼｜Tab 戰績｜Esc 放開滑鼠</div>'}`;
  document.body.appendChild(root);
  const q = (id: string) => root.querySelector('#' + id) as HTMLElement;
  const canvas = root.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2338); scene.fog = new THREE.Fog(0x1a2338, 20, 50);
  const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 100); cam.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xfff0d0, 0x302010, 1.1));
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.2); sun.position.set(10, 20, 5); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshLambertMaterial({ color: 0x5a5148 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const wallM = new THREE.MeshLambertMaterial({ color: 0x8a3a20 });
  for (const [x, z, w, d] of [[0, -HALF, HALF * 2, .4], [0, HALF, HALF * 2, .4], [-HALF, 0, .4, HALF * 2], [HALF, 0, .4, HALF * 2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), wallM); m.position.set(x, 1.5, z); scene.add(m);
  }
  const coverM = new THREE.MeshLambertMaterial({ color: 0x2f6f8f });
  for (const b of COVERS) { const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), coverM); m.position.copy(c); scene.add(m); }
  const shellGeo = new THREE.SphereGeometry(0.09, 8, 6); shellGeo.scale(1.4, 0.6, 1);
  const shellM = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 });
  const pile = new THREE.Group();
  for (let i = 0; i < 60; i++) { const s = new THREE.Mesh(shellGeo, shellM); const a = Math.random() * 6.28, r = Math.random() * 1.1; s.position.set(Math.cos(a) * r, 0.05 + Math.random() * (1.2 - r) * 0.5, Math.sin(a) * r); s.rotation.set(Math.random() * 3, Math.random() * 3, 0); pile.add(s); }
  scene.add(pile);

  function makeBot(color: number) {
    const g = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.8, 10), new THREE.MeshLambertMaterial({ color: 0x334 })); legs.position.y = 0.4;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.65, 10), new THREE.MeshLambertMaterial({ color })); body.position.y = 1.125;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf0c8a0 })); head.position.y = 1.6;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, 6.3, 0, 1.4), new THREE.MeshLambertMaterial({ color: 0xdddddd })); hair.position.y = 1.62;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), new THREE.MeshLambertMaterial({ color: 0xe0a080 })); nose.position.set(0, 1.6, 0.2);
    g.add(legs, body, head, hair, nose); scene.add(g); return g;
  }
  const mk = (name: string, isPlayer: boolean, color: number): Fighter => ({ name, isPlayer, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, ammo: 0, dead: false, respawnAt: 0, invulnUntil: 0, kills: 0, deaths: 0, hs: 0, shots: 0, hits: 0, mesh: isPlayer ? null : makeBot(color), cd: 1, goal: new THREE.Vector3(), idleUntil: 0, pickT: 0 });
  const me = mk('你', true, 0);
  const fighters: Fighter[] = [me, mk('阿婆 A', false, 0xc8102e), mk('阿婆 B', false, 0x2e7d32), mk('阿婆 C', false, 0x6a1b9a)];
  const shells: Shell[] = [];
  let now = 0;
  function spawn(f: Fighter) {
    const opts = SPAWNS.map(([x, z]) => new THREE.Vector3(x, 0, z)).sort((a, b) => minDist(b, f) - minDist(a, f));
    f.pos.copy(opts[Math.floor(Math.random() * 3)]); f.vel.set(0, 0, 0); f.hp = 100; f.ammo = 0; f.dead = false;
    f.invulnUntil = now + 3; f.idleUntil = now + 1; f.yaw = Math.atan2(-f.pos.x, -f.pos.z) + Math.PI; f.pitch = 0; f.goal.copy(PILE); f.pickT = 0;
  }
  const minDist = (p: THREE.Vector3, self: Fighter) => Math.min(...fighters.filter(o => o !== self && !o.dead).map(o => o.pos.distanceTo(p)), 99);
  fighters.forEach(spawn);

  // ---- 輸入 ----
  const keys: Record<string, boolean> = {}; const joy = { x: 0, y: 0 };
  let locked = false;
  const onKey = (e: KeyboardEvent, d: boolean) => {
    keys[e.code] = d;
    if (e.code === 'Tab') { e.preventDefault(); q('dmBoard').classList.toggle('show', d); if (d) renderBoard(); }
    if (d && e.code === 'KeyE') pick(me);
  };
  const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const plc = () => { locked = document.pointerLockElement === canvas; };
  document.addEventListener('pointerlockchange', plc);
  canvas.addEventListener('mousedown', e => { if (isTouch) return; if (!locked) { canvas.requestPointerLock?.(); return; } if (e.button === 0) throwShell(me); });
  canvas.addEventListener('mousemove', e => { if (!locked) return; me.yaw -= e.movementX * 0.0025; me.pitch = clampP(me.pitch - e.movementY * 0.0025); });
  const clampP = (p: number) => Math.max(-1.3, Math.min(1.3, p));
  if (isTouch) {
    const jo = q('dmJoy'), kn = q('dmKnob'); let jid = -1, lid = -1, lx = 0, ly = 0;
    root.addEventListener('touchstart', e => {
      for (const t of Array.from(e.changedTouches)) {
        const el = t.target as HTMLElement; if (el.closest('button')) continue;
        if (el.closest('#dmJoy') && jid < 0) jid = t.identifier; else if (lid < 0) { lid = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
    }, { passive: true });
    root.addEventListener('touchmove', e => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === jid) { const r = jo.getBoundingClientRect(); let x = (t.clientX - r.left - 60) / 50, y = (t.clientY - r.top - 60) / 50; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; kn.style.transform = `translate(${x * 35}px,${y * 35}px)`; }
        else if (t.identifier === lid) { me.yaw -= (t.clientX - lx) * 0.006; me.pitch = clampP(me.pitch - (t.clientY - ly) * 0.006); lx = t.clientX; ly = t.clientY; }
      }
    }, { passive: true });
    const end = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) { if (t.identifier === jid) { jid = -1; joy.x = joy.y = 0; kn.style.transform = ''; } if (t.identifier === lid) lid = -1; } };
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
    q('dmThrow').onclick = () => throwShell(me); q('dmPick').onclick = () => pick(me);
  }
  q('dmScoreBtn').onclick = () => { q('dmBoard').classList.toggle('show'); renderBoard(); };
  q('dmX').onclick = () => exit();

  // ---- 遊戲邏輯 ----
  function pick(f: Fighter) {
    if (f.dead || f.ammo >= MAXAMMO) return false;
    if (Math.hypot(f.pos.x - PILE.x, f.pos.z - PILE.z) > 2.6) { if (f.isPlayer) msg('離蚵仔堆太遠了', 1); return false; }
    f.ammo = MAXAMMO; return true;
  }
  function eyeOf(f: Fighter) { return new THREE.Vector3(f.pos.x, f.pos.y + EYE, f.pos.z); }
  function dirOf(yaw: number, pitch: number) { return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
  function throwShell(f: Fighter, yaw = f.yaw, pitch = f.pitch) {
    if (f.dead) return false;
    if (f.ammo <= 0) { if (f.isPlayer) msg('沒殼了，去蚵仔堆拿', 1); return false; }
    f.ammo--; f.shots++; if (f.isPlayer) f.invulnUntil = 0;
    const d = dirOf(yaw, pitch); const p = eyeOf(f).addScaledVector(d, 0.4);
    const m = new THREE.Mesh(shellGeo, shellM); m.position.copy(p); scene.add(m);
    shells.push({ pos: p, vel: d.multiplyScalar(SPEED).add(f.vel.clone().multiplyScalar(0.5)), owner: f, mesh: m, life: 6 });
    return true;
  }
  // 點是否在某人的命中區（頭為球，身體與腳為圓柱）
  function hitPart(f: Fighter, p: THREE.Vector3): Part | null {
    const dx = p.x - f.pos.x, dz = p.z - f.pos.z, y = p.y - f.pos.y, h = Math.hypot(dx, dz);
    if (Math.hypot(h, y - 1.6) < 0.24) return 'head';
    if (h < R && y >= 0.8 && y < 1.45) return 'body';
    if (h < R * 0.85 && y >= 0 && y < 0.8) return 'legs';
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
        for (const f of fighters) { if (f === s.owner || f.dead) continue; const part = hitPart(f, p); if (part) { damage(s.owner, f, part, p); done = true; break; } }
        if (!done && hitWorld(p)) done = true;
      }
      s.pos.copy(b); s.mesh.position.copy(b); s.mesh.rotation.y += dt * 20;
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
    const targets = fighters.filter(o => o !== f && !o.dead);
    let tgt: Fighter | null = null, best = 1e9;
    for (const o of targets) { const d = o.pos.distanceTo(f.pos) * (o.isPlayer ? 0.8 : 1); if (d < best) { best = d; tgt = o; } }
    if (f.ammo === 0) {
      f.goal.copy(PILE);
      if (Math.hypot(f.pos.x, f.pos.z) < 2.2) { f.pickT += dt; f.vel.set(0, 0, 0); if (f.pickT > 0.8) { pick(f); f.pickT = 0; f.goal.set((Math.random() - .5) * 26, 0, (Math.random() - .5) * 26); } }
    } else if (f.pos.distanceTo(f.goal) < 1.5 || Math.random() < dt * 0.3) {
      const base = tgt ? tgt.pos : PILE; const a = Math.random() * 6.28, r = 7 + Math.random() * 6;
      f.goal.set(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
    }
    const to = f.goal.clone().sub(f.pos); to.y = 0;
    if (to.length() > 0.3 && !(f.ammo === 0 && f.pickT > 0)) f.vel.copy(to.normalize().multiplyScalar(3.6)); else f.vel.set(0, 0, 0);
    if (tgt) {
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
      if (f.isPlayer) {
        let fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x, fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + joy.y;
        const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
        const s = Math.sin(f.yaw), c = Math.cos(f.yaw);
        f.vel.set((fx * c + fz * s) * 5, 0, (-fx * s + fz * c) * 5);
      } else botThink(f, dt);
      if (f.vel.lengthSq() > 0.01) f.invulnUntil = Math.min(f.invulnUntil, now); // 一開始移動就結束無敵
      f.pos.addScaledVector(f.vel, dt); collide(f);
      if (f.mesh) { f.mesh.position.copy(f.pos); f.mesh.rotation.y = f.yaw + Math.PI; f.mesh.visible = now < f.invulnUntil ? Math.floor(now * 10) % 2 === 0 : true; }
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
    const nearPile = Math.hypot(me.pos.x, me.pos.z) < 2.6;
    q('dmHud').innerHTML = `血量 ${Math.max(0, me.hp)}<br>殼 ${me.ammo} / ${MAXAMMO}${now < me.invulnUntil && !me.dead ? '<br>無敵中' : ''}${nearPile && me.ammo < MAXAMMO && !me.dead ? (isTouch ? '<br>可以拿殼' : '<br>按 E 拿殼') : ''}`;
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
  loop(); msg('死鬥（測試）：去中間蚵仔堆拿殼！', 2.5);

  function exit() {
    cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', resize);
    document.removeEventListener('pointerlockchange', plc); if (document.pointerLockElement === canvas) document.exitPointerLock();
    renderer.dispose(); root.remove(); active = false; delete (window as any).__dm; onExit();
  }
  // 測試掛勾
  (window as any).__dm = { fighters, shells, me, pick, throwShell, update, exit, renderBoard, launchPitch, get now() { return now; } };
}
