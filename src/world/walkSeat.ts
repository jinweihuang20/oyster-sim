import * as THREE from 'three';
import type { Seat } from './locs';
import { SEATS } from './locs';

export type WalkSeatDeps = {
  $: (id: string) => HTMLElement;
  on: (id: string, v: boolean) => void;
  COARSE: boolean;
  clamp: (v: number, a: number, b: number) => number;
  getState: () => string;
  getPhase: () => string;
  isPlazaMode: () => boolean;
  plazaSeated: () => boolean;
  plazaStandWalk: () => void;
  plazaPileObs: () => [number, number, number][];
  /** 遠端站立玩家碰撞圓（擋路不推擠；蹲／躺略過） */
  plazaWalkBodies: () => [number, number, number][];
  plazaWalkBound: () => number;
  plazaNearSeat: () => { pileId: number; slot: number } | null;
  plazaMySeat: () => { pileId: number; slot: number } | null;
  seatPose: (pileId: number, slot: number) => { pos: THREE.Vector3; yaw: number };
  setPlazaSeatPropsVisible: (v: boolean) => void;
  oyster: THREE.Object3D;
  shellGeo: THREE.BufferGeometry;
  shellTopMat: THREE.Material;
  shellTop: THREE.Object3D;
  handRig: THREE.Object3D;
  SEAT: THREE.Vector3;
  BASIN: THREE.Vector3;
  BOWL: THREE.Vector3;
  getBowlR: () => number;
  seatGround: (st: Seat) => THREE.Vector3;
  seatNow: () => Seat;
  getSeatYaw: () => number;
  setSeatYaw: (v: number) => void;
  getYaw: () => number;
  setYaw: (v: number) => void;
  getTYaw: () => number;
  setTYaw: (v: number) => void;
  getPitch: () => number;
  setPitch: (v: number) => void;
  getTPitch: () => number;
  setTPitch: (v: number) => void;
  getTpv: () => boolean;
  setTpv: (v: boolean) => void;
  saveTpv: () => boolean;
  drawCamBtn: () => void;
  drawRadio: () => void;
  applySeat: (id: string) => void;
  getSaveSeat: () => string | undefined;
  persist: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  toast: (t: string, c?: string) => void;
  SFX: { pop: () => void };
  later: (s: number, f: () => void) => void;
  goPick: () => void;
  setPhase: (p: any) => void;
  stopSteal: () => void;
  fly: (m: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, dur: number, arc: number, done?: () => void) => void;
  worldOf: (o: THREE.Object3D) => THREE.Vector3;
  pileSpot: () => THREE.Vector3;
  nag: (lines: string[]) => void;
  pick: <T>(a: T[]) => T;
  say: (n: any, t: string, dur?: number) => void;
  getNpcs: () => { g: THREE.Object3D; look: number }[];
  bumpAbandoned: () => void;
  setProgress: (v: number) => void;
  setCombo: (v: number) => void;
  setTension: (v: number) => void;
  setRotKey: (v: number) => void;
  hint: HTMLElement;
  stools: THREE.Group[];
  scene: THREE.Scene;
};

let D: WalkSeatDeps;

export let walking = false;
export let nearSeat: Seat | null = null;
export const walkPos = new THREE.Vector3();
export const walkKeys = new Set<string>();
export const joy = { x: 0, y: 0 };
/** 廣場第一人稱頭晃／移動量（frame 可寫入） */
export const walkMotion = { bobPh: 0, bobW: 0, spd: 0, strafe: 0 };
/** 廣場蹲下等姿勢的移動倍率 */
export const walkTune = { mul: 1 };

const NAG_STAND = ['剝一半就要走喔？', '蚵仔丟著就走，好浪費！', '要去哪裡？工作先做完啦'];

export function initWalkSeat(deps: WalkSeatDeps) { D = deps; }

export function setWalking(v: boolean) { walking = v; }
export function setNearSeat(v: Seat | null) { nearSeat = v; }

export function clearWalkInput() {
  joy.x = joy.y = 0;
  walkKeys.clear();
}

export function standUp() {
  if (D.getState() !== 'play' || walking) return;
  if (D.isPlazaMode() && D.plazaSeated()) { void D.plazaStandWalk(); return; }
  if (['seam', 'twist', 'crab', 'aim', 'empty'].includes(D.getPhase())) {
    D.bumpAbandoned();
    const sh = new THREE.Mesh(D.shellGeo, D.shellTopMat);
    D.fly(sh, D.worldOf(D.oyster), D.pileSpot(), 0.6, 0.6, () => D.scene.remove(sh));
    D.nag(NAG_STAND);
    const npcs = D.getNpcs();
    if (npcs.length && (!D.seatNow().nag || Math.random() > D.seatNow().nag)) {
      const n = D.pick(npcs); if (n) { n.look = 2.5; D.say(n, D.pick(NAG_STAND), 3); }
    }
  }
  D.oyster.visible = false; D.setProgress(0); D.setCombo(0); D.setTension(0); D.shellTop.rotation.z = 0; D.setRotKey(0); D.stopSteal(); D.setPhase('busy');
  walking = true; D.handRig.visible = false; walkPos.copy(D.SEAT).setY(1.55); const out = D.seatGround(D.seatNow()).setLength(0.45); walkPos.add(out);
  const y = D.getYaw() + D.getSeatYaw(); D.setTYaw(y); D.setYaw(y); D.setTPitch(-0.25); D.setPitch(-0.25);
  D.$('diff').textContent = ''; D.on('standBtn', false); D.on('joy', true); D.on('stealBtn', false);
  D.hint.textContent = D.COARSE ? '用搖桿行路，走去空的藍色板凳邊仔，按「坐落」換位' : 'WASD 行路，走去空的藍色板凳邊仔，按 E 坐落換位';
}

/** 廣場：站起後的本地走動狀態（由 plazaStandWalk 呼叫） */
export function plazaEnterWalkPose(fromSeat = true) {
  D.oyster.visible = false; D.setProgress(0); D.setCombo(0); D.setTension(0); D.shellTop.rotation.z = 0; D.setRotKey(0); D.stopSteal(); D.setPhase('busy');
  D.setPlazaSeatPropsVisible(false);
  walking = true; D.handRig.visible = false;
  if (fromSeat) {
    const s = D.plazaMySeat();
    if (s) {
      const pose = D.seatPose(s.pileId, s.slot);
      walkPos.set(pose.pos.x + Math.sin(pose.yaw) * 0.55, 1.55, pose.pos.z + Math.cos(pose.yaw) * 0.55);
      D.setTYaw(pose.yaw); D.setYaw(pose.yaw);
      D.setSeatYaw(pose.yaw);
    } else {
      walkPos.copy(D.SEAT).setY(1.55);
      walkPos.x += Math.sin(D.getSeatYaw()) * 0.55; walkPos.z += Math.cos(D.getSeatYaw()) * 0.55;
      D.setTYaw(D.getSeatYaw()); D.setYaw(D.getSeatYaw());
    }
    D.setTpv(!!D.saveTpv()); D.drawCamBtn();
  }
  D.drawRadio();
  D.setTPitch(-0.2); D.setPitch(-0.2); D.$('diff').textContent = '';
  D.on('standBtn', false); D.on('umbBtn', false); D.on('medBtn', false); D.on('stealBtn', false); D.on('joy', true); D.on('camBtn', D.COARSE);
  if (D.COARSE) { const cam = D.$('camBtn'); if (cam) { cam.classList.add('on'); cam.style.display = ''; } }
  D.stools.forEach(g => { g.visible = false; g.userData.tag.visible = false; });
  D.hint.textContent = D.COARSE ? '廣場走走・可按「視角」切換・靠近空位坐下' : 'WASD 走動・V 切換視角・空白鍵跳躍・C 蹲下・Z 躺下・E 坐下剝蚵';
}

export function sitDown(id: string) {
  walking = false; nearSeat = null; D.on('seatCard', false); D.on('joy', false); joy.x = joy.y = 0; walkKeys.clear();
  D.stools.forEach(g => g.userData.tag.visible = false);
  if (id !== D.getSaveSeat()) D.track('seat', { seat: id });
  D.applySeat(id); D.persist(); D.handRig.visible = true;
  D.setTYaw(0); D.setYaw(0); D.setTPitch(-0.85); D.setPitch(-0.85);
  D.toast(`坐落${D.seatNow().n}`, '#9fe0ff'); D.SFX.pop(); D.later(0.3, D.goPick);
}

export function walkStep(dt: number) {
  const k = (c: string) => walkKeys.has(c) ? 1 : 0;
  let f = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') - joy.y, r = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + joy.x;
  const l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l; }
  const moveSp = (D.isPlazaMode() ? 2.4 : 1.7) * walkTune.mul;
  walkMotion.spd = l * moveSp; walkMotion.strafe = r * moveSp;
  const yaw = D.getYaw();
  const prevX = walkPos.x, prevZ = walkPos.z;
  const sp = moveSp * dt; walkPos.x += (-Math.sin(yaw) * f + Math.cos(yaw) * r) * sp; walkPos.z += (-Math.cos(yaw) * f - Math.sin(yaw) * r) * sp;
  const obs: [number, number, number][] = D.isPlazaMode()
    ? [...D.plazaPileObs()]
    : [[0, 0, 1.15], [D.BASIN.x, D.BASIN.z, 0.42], [D.BOWL.x, D.BOWL.z, D.getBowlR() + 0.12], [2.6, 2.6, 0.75], [2.9, -2.5, 0.35], [3.1, -1.9, 0.35], [-2.9, 2.6, 0.35], [3.0, 0.5, 0.3], [-3.0, 0.2, 0.3]];
  if (!D.isPlazaMode()) {
    D.getNpcs().forEach(n => obs.push([n.g.position.x, n.g.position.z, 0.5]));
    D.stools.forEach(g => obs.push([g.position.x, g.position.z, 0.28]));
  }
  // 場景障礙：推出圓外（可沿邊滑）
  for (let it = 0; it < 3; it++) for (const [x, z, rr] of obs) {
    const dx = walkPos.x - x, dz = walkPos.z - z, d = Math.hypot(dx, dz);
    if (d < rr + 0.2 && d > 1e-4) { walkPos.x = x + dx / d * (rr + 0.2); walkPos.z = z + dz / d * (rr + 0.2); }
  }
  // 玩家之間：擋路但不推擠；跳躍同樣干涉（不因離地穿透）
  if (D.isPlazaMode()) {
    for (const [x, z, rr] of D.plazaWalkBodies()) {
      const dx = walkPos.x - x, dz = walkPos.z - z, d = Math.hypot(dx, dz);
      const minD = rr + 0.2;
      if (d >= minD || d <= 1e-4) continue;
      const pd = Math.hypot(prevX - x, prevZ - z);
      // 已在圈內且這步是往外／不加深：放行以便脫困；否則還原本幀位移
      if (!(pd < minD && d + 1e-8 >= pd)) { walkPos.x = prevX; walkPos.z = prevZ; break; }
    }
  }
  if (!D.isPlazaMode() && walkPos.z < -2.55 && walkPos.x < -1.3) walkPos.z = -2.55;
  const bound = D.isPlazaMode() ? D.plazaWalkBound() : 3.25;
  walkPos.x = D.clamp(walkPos.x, -bound, bound); walkPos.z = D.clamp(walkPos.z, -bound, bound);
  walkPos.y = 1.55 + (D.isPlazaMode() && !D.getTpv() ? 0 : Math.sin(performance.now() / 120) * 0.012 * Math.min(1, l));
  if (D.isPlazaMode()) {
    nearSeat = null; D.stools.forEach(g => { g.visible = false; g.userData.tag.visible = false; });
    const n = D.plazaNearSeat();
    D.on('seatCard', !!n);
    D.$('seatCard').classList.add('mini');
    if (n) D.$('seatInfo').textContent = `第 ${n.pileId + 1} 堆・座 ${n.slot + 1}`;
    return;
  }
  let best: Seat | null = null, bd = 0.85;
  SEATS.forEach((st, i) => {
    const d = Math.hypot(walkPos.x - D.stools[i].position.x, walkPos.z - D.stools[i].position.z);
    D.stools[i].userData.tag.visible = true;
    if (d < bd) { bd = d; best = st; }
  });
  if (best !== nearSeat) {
    nearSeat = best; D.on('seatCard', !!best); D.$('seatCard').classList.remove('mini');
    if (best) {
      const st = best as Seat;
      D.$('seatInfo').innerHTML = `<b>🪑 ${st.n}</b>${st.id === D.seatNow().id ? '（這馬的位）' : ''}<br><span style="color:#9be37a">＋ ${st.pro}</span><br><span style="color:#ff8a7a">－ ${st.con}</span>`;
    }
  }
}

export function initWalkJoy() {
  const j = D.$('joy'), kb = D.$('joyK'); let jid = -1, cx = 0, cy = 0;
  j.addEventListener('pointerdown', e => { e.stopPropagation(); jid = e.pointerId; const r = j.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; j.setPointerCapture(e.pointerId); });
  j.addEventListener('pointermove', e => {
    if (e.pointerId !== jid) return;
    const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.min(1, Math.hypot(dx, dy) / 50), a = Math.atan2(dy, dx);
    joy.x = Math.cos(a) * d; joy.y = Math.sin(a) * d; kb.style.transform = `translate(${joy.x * 40}px,${joy.y * 40}px)`;
  });
  const end = (e: PointerEvent) => { if (e.pointerId !== jid) return; jid = -1; joy.x = joy.y = 0; kb.style.transform = ''; };
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
}
