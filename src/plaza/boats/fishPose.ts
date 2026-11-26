/**
 * 釣魚動作：持竿、甩竿（往後蓄力→往前甩）、拉竿（竿子立高、身體後仰、竿彎）、捲線（左手轉捲線器搖把）。
 * stepFishPose＝純數值（平滑跟隨，可測試）；applyFishPose＝把數值套到人物手臂＋釣竿。
 * 手的座標都是 torso 座標（前方＝-Z、右手＝+X）。
 */
import * as THREE from 'three';
import { placePlazaArmChain, type PlayerRig } from '../../dm/character';
import type { Rod } from './fishRod';
import { ROD_GRIP } from './fishRod';

export type FishPhase = 'off' | 'hold' | 'charge' | 'cast' | 'wait' | 'fight' | 'show';
export type FishPoseIn = {
  phase: FishPhase;
  /** 蓄力 0～1 */
  power: number;
  /** 正在捲線 */
  reel: boolean;
  /** 拉扯張力 0～1（拉魚時） */
  tension: number;
  /** 路亞竿 */
  lure: boolean;
  /** 魚在咬／動竿：小抖動 0～1 */
  twitch: number;
};
export type FishPoseSt = {
  pitch: number; side: number;
  hx: number; hy: number; hz: number;
  lean: number;
  bend: number; bendV: number;
  crank: number;
  /** 甩竿開始後經過的秒數（<0＝不在甩） */
  castT: number;
  /** 中魚揚竿（剛進入拉魚）後經過的秒數（<0＝不在揚竿） */
  hookT: number;
  /** 腳站穩（弓步、膝蓋微彎、重心放低）0～1；braceW＝腳現在是不是被這裡改過（收掉時要還原一次） */
  brace: number; braceW: boolean;
  prev: FishPhase;
  t: number;
};

/** 甩竿往前甩的時間（秒） */
export const CAST_FLICK = 0.32;
/** 中魚揚竿：往上猛拉的時間（秒） */
export const HOOK_SET = 0.38;

export function newFishPose(): FishPoseSt {
  return { pitch: 0.6, side: 0.1, hx: 0.14, hy: 0.02, hz: -0.3, lean: 0, bend: 0, bendV: 0, crank: 0, castT: -1, hookT: -1, brace: 0, braceW: false, prev: 'off', t: 0 };
}

export type FishPoseTg = { pitch: number; hx: number; hy: number; hz: number; lean: number; bend: number; side: number; brace: number };
const _tg: FishPoseTg = { pitch: 0, hx: 0, hy: 0, hz: 0, lean: 0, bend: 0, side: 0, brace: 0 };
const T = (pitch: number, hx: number, hy: number, hz: number, lean: number, bend: number, side: number, brace = 0, out: FishPoseTg = _tg) => {
  out.pitch = pitch; out.hx = hx; out.hy = hy; out.hz = hz; out.lean = lean; out.bend = bend; out.side = side; out.brace = brace; return out;
};
/**
 * 拉魚：竿子立高、雙手往上往胸口拉、身體大幅後仰、腳站穩；跟著張力和魚掙扎「拉一下、放一下捲線」（pump）。
 * 竿彎跟張力走，再疊一點魚在掙扎的快速抖動。hookT≥0＝剛中魚的揚竿猛拉。
 */
export function fightTarget(k: number, t: number, hookT: number, out: FishPoseTg = _tg) {
  k = Math.max(0, Math.min(1, k));
  const pump = Math.sin(t * (2.1 + 1.3 * k)), pa = 0.45 + 0.55 * k;
  const pulse = Math.sin(t * 13.7) * 0.05 * (0.4 + k) + Math.sin(t * 5.3) * 0.04 * k;
  let pitch = 1.08 + 0.32 * k + 0.24 * pump * pa, hy = 0.18 + 0.12 * k + 0.07 * pump * pa, hz = -0.2 + 0.05 * pump * pa;
  let lean = 0.24 + 0.22 * k + 0.09 * pump * pa, bend = 0.5 + 0.48 * k - 0.07 * pump * pa + pulse;
  if (hookT >= 0 && hookT < HOOK_SET) {
    // 揚竿：一下子往上往後猛拉，竿子瞬間彎下去
    const u = hookT / HOOK_SET, e = Math.sin(Math.PI * Math.min(1, u * 1.25)) * (1 - 0.3 * u);
    pitch += 0.6 * e; hy += 0.14 * e; hz += 0.08 * e; lean += 0.22 * e; bend += 0.35 * e;
  }
  return T(pitch, 0.08, hy, hz, Math.min(0.62, lean), Math.min(1, bend), 0.05, 1, out);
}

/** 各狀態的目標：竿子仰角（0＝水平往前、π/2＝直立、更大＝往後）、右手位置、身體後仰、竿彎、腳站穩（回傳共用物件，不配置） */
export function fishPoseTarget(inp: FishPoseIn, castT: number, t: number, hookT = -1): FishPoseTg {
  switch (inp.phase) {
    case 'charge': {
      const p = Math.max(0, Math.min(1, inp.power));
      return T(1.2 + 0.85 * p, 0.17, 0.16 + 0.22 * p, -0.18 + 0.12 * p, 0.06 + 0.1 * p, -0.06 - 0.12 * p, 0.16);
    }
    case 'cast': {
      if (castT >= 0 && castT < CAST_FLICK) {
        // 往前甩：手從肩上往前下揮，竿尖落後（彎）
        const u = castT / CAST_FLICK, e = 1 - (1 - u) * (1 - u);
        return T(2.0 - 1.85 * e, 0.15, 0.36 - 0.34 * e, -0.08 - 0.3 * e, 0.14 - 0.26 * e, 0.42 * Math.sin(Math.PI * u), 0.1);
      }
      return T(0.3, 0.14, 0.04, -0.36, -0.1, 0.12, 0.08);
    }
    case 'wait': {
      const tw = inp.twitch > 0 ? Math.sin(t * 38) * 0.06 * inp.twitch : 0;
      if (inp.lure) return T(inp.reel ? 0.28 : 0.42, 0.12, 0.0, -0.3, 0, (inp.reel ? 0.16 : 0.08) + tw, 0.14);
      return T(0.62, 0.12, 0.02, -0.28, 0, 0.1 + tw, 0.1);
    }
    case 'fight':
      return fightTarget(inp.tension, t, hookT);
    case 'show': {
      // 釣上來了：竿子舉高、魚掛在竿尖晃，身體微微後仰
      const wob = Math.sin(t * 6) * 0.04;
      return T(1.45 + wob, 0.14, 0.2, -0.22, -0.05, 0.28 + wob, 0.12, 0.35);
    }
    case 'hold':
      return T(0.75, 0.14, 0.0, -0.26, 0, 0.03, 0.12);
    default:
      return T(1.35, 0.24, -0.12, -0.06, 0, 0, 0.06);
  }
}

/** 往下一幀走（dt 秒）；不配置新物件 */
export function stepFishPose(st: FishPoseSt, inp: FishPoseIn, dt: number) {
  dt = Math.min(0.1, Math.max(0, dt));
  st.t += dt;
  if (inp.phase === 'cast' && st.prev !== 'cast') st.castT = 0;
  else if (inp.phase === 'cast' && st.castT >= 0) st.castT += dt;
  else if (inp.phase !== 'cast') st.castT = -1;
  // 中魚：從等魚／收竿變成拉魚的那一下＝揚竿
  if (inp.phase === 'fight' && st.prev !== 'fight') st.hookT = st.prev === 'off' ? -1 : 0;
  else if (inp.phase === 'fight' && st.hookT >= 0) { st.hookT += dt; if (st.hookT >= HOOK_SET) st.hookT = -1; }
  else if (inp.phase !== 'fight') st.hookT = -1;
  st.prev = inp.phase;
  const tg = fishPoseTarget(inp, st.castT, st.t, st.hookT);
  const flick = inp.phase === 'cast' && st.castT >= 0 && st.castT < CAST_FLICK;
  const yank = st.hookT >= 0;
  const k = flick ? 1 : 1 - Math.exp(-dt * (yank ? 22 : inp.phase === 'charge' ? 7 : inp.phase === 'fight' ? 11 : 9));
  st.brace += (tg.brace - st.brace) * (1 - Math.exp(-dt * 6));
  if (st.brace < 0.002 && tg.brace === 0) st.brace = 0;
  st.pitch += (tg.pitch - st.pitch) * k;
  st.side += (tg.side - st.side) * k;
  st.hx += (tg.hx - st.hx) * k; st.hy += (tg.hy - st.hy) * k; st.hz += (tg.hz - st.hz) * k;
  st.lean += (tg.lean - st.lean) * k;
  // 竿彎：彈簧（甩完會抖幾下）
  st.bendV += ((tg.bend - st.bend) * (yank ? 520 : 260) - st.bendV * 18) * dt;
  st.bend += st.bendV * dt;
  if (st.bend > 1) { st.bend = 1; st.bendV = 0; } else if (st.bend < -1) { st.bend = -1; st.bendV = 0; }
  // 捲線：左手轉搖把（約每秒 2.2 圈；拉魚時跟著張力慢一點）
  const reeling = inp.reel && (inp.phase === 'wait' || inp.phase === 'fight');
  if (reeling) st.crank = (st.crank + dt * Math.PI * 2 * (inp.phase === 'fight' ? 1.6 - inp.tension * 0.6 : 2.2)) % (Math.PI * 2);
  return st;
}

/** 線上同步用的姿勢代碼：0 沒在釣、1 持竿、2 蓄力、3 甩竿、4 等待、5 拉魚、6 捲線、7 秀漁獲；+16＝路亞竿 */
export function fishPoseCode(phase: FishPhase, reel: boolean, lure: boolean) {
  const b = phase === 'off' ? 0 : phase === 'hold' ? 1 : phase === 'charge' ? 2 : phase === 'cast' ? 3 : phase === 'fight' ? 5 : phase === 'show' ? 7 : reel ? 6 : 4;
  return b === 0 ? 0 : b + (lure ? 16 : 0);
}
export function fishPoseDecode(code: number): FishPoseIn {
  const lure = (code & 16) !== 0, b = code & 15;
  const phase: FishPhase = b === 1 ? 'hold' : b === 2 ? 'charge' : b === 3 ? 'cast' : b === 4 || b === 6 ? 'wait' : b === 5 ? 'fight' : b === 7 ? 'show' : 'off';
  return { phase, power: 0.8, reel: b === 6 || b === 5, tension: 0.5, lure, twitch: 0 };
}
/** 解碼到既有物件（每幀用，不配置） */
export function fishPoseDecodeInto(code: number, out: FishPoseIn, tension = 0.5): FishPoseIn {
  const lure = (code & 16) !== 0, b = code & 15;
  out.phase = b === 1 ? 'hold' : b === 2 ? 'charge' : b === 3 ? 'cast' : b === 4 || b === 6 ? 'wait' : b === 5 ? 'fight' : b === 7 ? 'show' : 'off';
  out.power = 0.8; out.reel = b === 6 || b === 5; out.tension = tension; out.lure = lure; out.twitch = 0;
  return out;
}

const _dir = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _hl = new THREE.Vector3();

function armTo(rig: PlayerRig, side: number, hx: number, hy: number, hz: number, bendOut: number) {
  const sx = side * 0.22, sy = 0.33, sz = 0;
  const ex = (sx + hx) / 2 + side * bendOut, ey = (sy + hy) / 2 - 0.1, ez = (sz + hz) / 2 + 0.06;
  placePlazaArmChain(side < 0 ? rig.upperL : rig.upperR, side < 0 ? rig.lowerL : rig.lowerR, sx, sy, sz, ex, ey, ez, hx, hy, hz);
}

/**
 * 套用：竿子掛在 torso 上、握點在右手；左手握竿前段（垂釣竿／拉魚）或轉捲線器搖把（路亞竿捲線）。
 * baseLean＝原本的 torso 前傾（走路／坐的時候），會加上釣魚後仰。
 */
export function applyFishPose(rig: PlayerRig, st: FishPoseSt, rod: Rod, inp: FishPoseIn, baseLean = 0) {
  rig.weaponMount.visible = false; rig.handL.visible = false; rig.handR.visible = false;
  if (rod.g.parent !== rig.torso) rig.torso.add(rod.g);
  // 竿方向：仰角 pitch、往右外側偏 side
  _dir.set(st.side, Math.sin(st.pitch), -Math.cos(st.pitch)).normalize();
  // 竿彎的方向：世界往下（在 torso 座標近似）去掉沿竿分量；竿直立時改用往前
  _b.set(0, -1, 0).addScaledVector(_dir, _dir.y);
  if (_b.lengthSq() < 1e-4) _b.set(0, 0, -1);
  _b.normalize();
  _z.copy(_b).multiplyScalar(-1);
  _x.crossVectors(_dir, _z).normalize();
  _z.crossVectors(_x, _dir);
  _m.makeBasis(_x, _dir, _z);
  rod.g.quaternion.setFromRotationMatrix(_m);
  const grip = ROD_GRIP[rod.kind];
  rod.g.position.set(st.hx - _dir.x * grip, st.hy - _dir.y * grip, st.hz - _dir.z * grip);
  rod.setBend(st.bend);
  rod.setCrank(st.crank);
  armTo(rig, 1, st.hx, st.hy, st.hz, 0.08);
  // 左手：路亞竿捲線／等待時握搖把；其他時候握竿前段（雙手持竿）
  rod.g.updateMatrix();
  const crankHand = inp.lure && (inp.phase === 'wait' || inp.phase === 'fight');
  if (crankHand || !inp.lure || inp.phase === 'fight' || inp.phase === 'charge' || inp.phase === 'cast') {
    rod.handLLocal(_hl);
    if (!crankHand && inp.lure) _hl.set(0, grip + 0.14, 0);
    _hl.applyMatrix4(rod.g.matrix);
    armTo(rig, -1, _hl.x, _hl.y, _hl.z, 0.06);
  } else {
    armTo(rig, -1, -0.2, -0.12, -0.2, 0.06);
  }
  rig.torso.rotation.x = baseLean + st.lean;
  rig.torso.rotation.y = -0.12 - 0.1 * st.brace;
  // 頭：後仰時還是看著魚（往前低一點），不要跟著身體一起朝天
  rig.head.rotation.x = Math.min(0.3, Math.max(-0.2, -st.lean * 0.45 + (inp.phase === 'wait' ? 0.12 : 0) + 0.12 * st.brace));
  braceLegs(rig, st);
}

/**
 * 腳站穩：左腳往前跨、右腳往後撐、膝蓋微彎、重心放低（拉魚、秀漁獲）。沒在站穩就不碰腳（走路／坐姿自己管）；
 * 剛收掉時還原一次。
 */
function braceLegs(rig: PlayerRig, st: FishPoseSt) {
  const b = st.brace;
  if (b <= 0) {
    if (st.braceW) { st.braceW = false; rig.legL.rotation.set(0, 0, 0); rig.legR.rotation.set(0, 0, 0); rig.shinL.rotation.x = 0; rig.shinR.rotation.x = 0; rig.root.position.y = 0; }
    return;
  }
  st.braceW = true;
  rig.legL.rotation.set(0.42 * b, 0, 0.08 * b);
  rig.legR.rotation.set(-0.3 * b, 0, -0.08 * b);
  rig.shinL.rotation.x = -0.32 * b;
  rig.shinR.rotation.x = -0.14 * b;
  rig.root.position.y = -0.05 * b;
}

/** 世界座標的竿尖（線從這裡出去） */
export function rodTipWorld(rod: Rod, out: THREE.Vector3) {
  rod.tipLocal(out);
  rod.g.updateWorldMatrix(true, false);
  return out.applyMatrix4(rod.g.matrixWorld);
}
