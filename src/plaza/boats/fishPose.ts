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
  prev: FishPhase;
  t: number;
};

/** 甩竿往前甩的時間（秒） */
export const CAST_FLICK = 0.32;

export function newFishPose(): FishPoseSt {
  return { pitch: 0.6, side: 0.1, hx: 0.14, hy: 0.02, hz: -0.3, lean: 0, bend: 0, bendV: 0, crank: 0, castT: -1, prev: 'off', t: 0 };
}

/** 各狀態的目標：竿子仰角（0＝水平往前、π/2＝直立、更大＝往後）、右手位置、身體後仰、竿彎 */
export function fishPoseTarget(inp: FishPoseIn, castT: number, t: number) {
  switch (inp.phase) {
    case 'charge': {
      const p = Math.max(0, Math.min(1, inp.power));
      return { pitch: 1.2 + 0.85 * p, hx: 0.17, hy: 0.16 + 0.22 * p, hz: -0.18 + 0.12 * p, lean: 0.06 + 0.1 * p, bend: -0.06 - 0.12 * p, side: 0.16 };
    }
    case 'cast': {
      if (castT >= 0 && castT < CAST_FLICK) {
        // 往前甩：手從肩上往前下揮，竿尖落後（彎）
        const u = castT / CAST_FLICK, e = 1 - (1 - u) * (1 - u);
        return { pitch: 2.0 - 1.85 * e, hx: 0.15, hy: 0.36 - 0.34 * e, hz: -0.08 - 0.3 * e, lean: 0.14 - 0.26 * e, bend: 0.55 * Math.sin(Math.PI * u), side: 0.1 };
      }
      return { pitch: 0.3, hx: 0.14, hy: 0.04, hz: -0.36, lean: -0.1, bend: 0.12, side: 0.08 };
    }
    case 'wait': {
      const tw = inp.twitch > 0 ? Math.sin(t * 38) * 0.06 * inp.twitch : 0;
      if (inp.lure) return { pitch: inp.reel ? 0.28 : 0.42, hx: 0.12, hy: 0.0, hz: -0.3, lean: 0, bend: (inp.reel ? 0.16 : 0.08) + tw, side: 0.14 };
      return { pitch: 0.62, hx: 0.12, hy: 0.02, hz: -0.28, lean: 0, bend: 0.1 + tw, side: 0.1 };
    }
    case 'fight': {
      const k = Math.max(0, Math.min(1, inp.tension));
      const wob = Math.sin(t * 9) * 0.05 * (0.4 + k);
      return { pitch: 1.0 + 0.25 * k + wob, hx: 0.1, hy: 0.12 + 0.08 * k, hz: -0.26, lean: 0.12 + 0.16 * k, bend: 0.35 + 0.6 * k + wob, side: 0.06 };
    }
    case 'show': {
      // 釣上來了：竿子舉高、魚掛在竿尖晃，身體微微後仰
      const wob = Math.sin(t * 6) * 0.04;
      return { pitch: 1.45 + wob, hx: 0.14, hy: 0.2, hz: -0.22, lean: -0.05, bend: 0.28 + wob, side: 0.12 };
    }
    case 'hold':
      return { pitch: 0.75, hx: 0.14, hy: 0.0, hz: -0.26, lean: 0, bend: 0.03, side: 0.12 };
    default:
      return { pitch: 1.35, hx: 0.24, hy: -0.12, hz: -0.06, lean: 0, bend: 0, side: 0.06 };
  }
}

/** 往下一幀走（dt 秒）；不配置新物件 */
export function stepFishPose(st: FishPoseSt, inp: FishPoseIn, dt: number) {
  dt = Math.min(0.1, Math.max(0, dt));
  st.t += dt;
  if (inp.phase === 'cast' && st.prev !== 'cast') st.castT = 0;
  else if (inp.phase === 'cast' && st.castT >= 0) st.castT += dt;
  else if (inp.phase !== 'cast') st.castT = -1;
  st.prev = inp.phase;
  const tg = fishPoseTarget(inp, st.castT, st.t);
  const flick = inp.phase === 'cast' && st.castT >= 0 && st.castT < CAST_FLICK;
  const k = flick ? 1 : 1 - Math.exp(-dt * (inp.phase === 'charge' ? 7 : 9));
  st.pitch += (tg.pitch - st.pitch) * k;
  st.side += (tg.side - st.side) * k;
  st.hx += (tg.hx - st.hx) * k; st.hy += (tg.hy - st.hy) * k; st.hz += (tg.hz - st.hz) * k;
  st.lean += (tg.lean - st.lean) * k;
  // 竿彎：彈簧（甩完會抖幾下）
  st.bendV += ((tg.bend - st.bend) * 260 - st.bendV * 18) * dt;
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
  rig.torso.rotation.y = -0.12;
  rig.head.rotation.x = Math.min(0.25, Math.max(-0.35, -st.lean * 0.6 + (inp.phase === 'wait' ? 0.12 : 0)));
}

/** 世界座標的竿尖（線從這裡出去） */
export function rodTipWorld(rod: Rod, out: THREE.Vector3) {
  rod.tipLocal(out);
  rod.g.updateWorldMatrix(true, false);
  return out.applyMatrix4(rod.g.matrixWorld);
}
