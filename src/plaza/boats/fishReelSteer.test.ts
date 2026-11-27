/**
 * 收線時也能左右拉（CR-18）：輸入 → FishSync st（捲線 6 也帶 +32／+64）→ 伺服器轉發 → 別人畫面。
 * 收線只是輕輕帶竿控線，幅度要明顯比中魚搏鬥小；搏鬥的幅度維持 fae8778 不變。
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { steerDirFromPad } from './fishReelFeel';
import { fishPoseCode, fishPoseDecode, fishPoseDecodeInto, fishSteerOf, newFishPose, stepFishPose, applyFishPose, rodTipWorld, steerPose, steerablePhase, jerkFromSync, STEER, STEER_REEL, type FishPoseIn } from './fishPose';
import { FISH_SYNC, newFishSync, copyFishSync, fishSyncDue, normFishSync, remoteFightSide, remoteReelSide, REEL_SIDE_M, jerkSt } from './fishSync';
import { makeRod } from './fishRod';
import { makePlayerAvatar } from '../../dm/character';
import { makeMeshHelpers } from '../../dm/mesh';

const dt = 1 / 60;
/** 跟伺服器 PlazaWorld.FishSyncClamp 一樣：拉魚（5）、捲線（6）才留左右 bit，兩個都設＝都不留 */
const serverClamp = (st: number) => {
  const b = Math.min(st & 15, 7); if (!b) return 0;
  const L = (st & 32) !== 0, R = (st & 64) !== 0;
  return b | (st & 16) | ((b === 5 || b === 6) && L !== R ? (L ? 32 : 64) : 0);
};
/** 自己這邊：路亞等待中按住收線＋鍵盤／搖桿 → 送出去的 st */
const reelSt = (keys: string[], joyX = 0, reel = true) => fishPoseCode('wait', reel, true, steerDirFromPad(c => keys.includes(c), joyX));
const relay = (st: number) => normFishSync({ ConnId: 'A', St: serverClamp(st), Boat: false, Yaw: 0, Ch: 0, Cd: 12, Tn: 0.3 })!;
const mkRig = () => { const { M, add } = makeMeshHelpers(new THREE.Scene(), true); return makePlayerAvatar({ shirt: 0x3a7ab8, hair: 0x222222, pants: 0x2a2a40 }, M, add, false) as any; };

/** 別人畫面：收到的 st 擺 n 幀，回傳竿尖（人物座標）、torso 側傾／轉向 */
function remoteView(sts: number[], frames = 120) {
  const rig = mkRig(), scene = new THREE.Scene(); scene.add(rig.outer);
  const pose = newFishPose(), rod = makeRod('lure'); const inp = {} as FishPoseIn;
  for (const st of sts) for (let k = 0; k < frames; k++) { fishPoseDecodeInto(st, inp, 0.5); stepFishPose(pose, inp, dt); applyFishPose(rig, pose, rod, inp); }
  scene.updateMatrixWorld(true);
  const tip = rig.outer.worldToLocal(rodTipWorld(rod, new THREE.Vector3()));
  const out = { tipX: tip.x, rz: rig.torso.rotation.z, ry: rig.torso.rotation.y, steer: pose.steer, k: pose.steerK };
  rod.dispose();
  return out;
}
const deg = (r: number) => (Math.abs(r) * 180) / Math.PI;

describe('收線左右拉：輸入編進 FishSync st', () => {
  it('路亞按住收線：A／←＝+32、D／→＝+64、搖桿也一樣；放開方向＝沒 bit', () => {
    const base = 6 | 16;
    expect(reelSt(['KeyA'])).toBe(base | 32);
    expect(reelSt(['ArrowLeft'])).toBe(base | 32);
    expect(reelSt(['KeyD'])).toBe(base | 64);
    expect(reelSt(['ArrowRight'])).toBe(base | 64);
    expect(reelSt([], -0.8)).toBe(base | 32);
    expect(reelSt([], 0.8)).toBe(base | 64);
    expect(reelSt([])).toBe(base);
    expect(reelSt([], 0.1)).toBe(base);
  });
  it('只有收線中才帶：沒按收線（等待 4）、持竿、蓄力、甩竿、秀漁獲都不帶', () => {
    expect(reelSt(['KeyA'], 0, false)).toBe(4 | 16);
    for (const ph of ['hold', 'charge', 'cast', 'show'] as const) expect(fishPoseCode(ph, true, true, -1) & (32 | 64)).toBe(0);
    expect(steerablePhase({ phase: 'wait', reel: true })).toBe(true);
    expect(steerablePhase({ phase: 'wait', reel: false })).toBe(false);
    expect(steerablePhase({ phase: 'fight', reel: false })).toBe(true);
  });
  it('解碼：捲線 6 解得出左右；抽竿計數（tn）照舊、左右 bit 不會被當成抽竿', () => {
    expect(fishSteerOf(6 | 16 | 32)).toBe(-1);
    expect(fishSteerOf(6 | 16 | 64)).toBe(1);
    expect(fishSteerOf(6 | 32 | 64)).toBe(0);
    expect(fishPoseDecode(6 | 16 | 64)).toMatchObject({ phase: 'wait', reel: true, lure: true, steer: 1 });
    expect(fishPoseDecode(4 | 16 | 32).steer).toBe(0);
    expect(jerkSt(6 | 16 | 32)).toBe(true);
    expect(jerkFromSync(6 | 16 | 32, 0.3, 6 | 16 | 64, 0.3)).toBe(false);
  });
  it('左右換了會送出去（走 steerGap，不洗爆限速）；伺服器轉發後 bit 還在', () => {
    const last = newFishSync(), cur = newFishSync();
    cur.st = reelSt([]); cur.cd = 12; copyFishSync(cur, last);
    for (const keys of [['KeyA'], ['KeyD'], []]) {
      cur.st = reelSt(keys);
      expect(fishSyncDue(last, cur, true, 0.05)).toBe(false);
      expect(fishSyncDue(last, cur, true, FISH_SYNC.steerGap)).toBe(true);
      copyFishSync(cur, last);
    }
    expect(relay(reelSt(['KeyA'])).st).toBe(6 | 16 | 32);
    expect(relay(reelSt(['KeyD'])).st).toBe(6 | 16 | 64);
    expect(relay(reelSt([])).st).toBe(6 | 16);
  });
});

describe('收線左右拉：別人畫面看得出來，但比搏鬥小很多', () => {
  it('收線：竿尖往左右輕輕帶（0.5 m 以上），身體只微微側傾（4～6°）、轉身（6～8°）', () => {
    const N = remoteView([relay(reelSt([])).st]);
    const L = remoteView([relay(reelSt(['KeyA'])).st]);
    const R = remoteView([relay(reelSt(['KeyD'])).st]);
    expect(L.k).toBe(0); expect(R.k).toBe(0);
    expect(L.tipX).toBeLessThan(N.tipX - 0.5); expect(R.tipX).toBeGreaterThan(N.tipX + 0.5);
    expect(L.rz).toBeGreaterThan(0); expect(R.rz).toBeLessThan(0); expect(N.rz).toBe(0);
    expect(deg(L.rz)).toBeGreaterThanOrEqual(4); expect(deg(L.rz)).toBeLessThanOrEqual(6);
    expect(deg(L.ry - N.ry)).toBeGreaterThanOrEqual(6); expect(deg(L.ry - N.ry)).toBeLessThanOrEqual(8);
    expect(deg(N.ry - R.ry)).toBeGreaterThanOrEqual(6); expect(deg(N.ry - R.ry)).toBeLessThanOrEqual(8);
  });
  it('收線的幅度明顯比搏鬥小：竿尖、側傾、轉身、線頭偏移都不到一半', () => {
    const rN = remoteView([6 | 16]), rL = remoteView([6 | 16 | 32]);
    const fN = remoteView([5 | 16]), fL = remoteView([5 | 16 | 32]);
    const reelTip = rN.tipX - rL.tipX, fightTip = fN.tipX - fL.tipX;
    expect(reelTip).toBeGreaterThan(0.5);
    expect(reelTip).toBeLessThan(fightTip * 0.5);
    expect(rL.rz).toBeLessThan(fL.rz * 0.5);
    expect(rL.ry - rN.ry).toBeLessThan((fL.ry - fN.ry) * 0.5);
    const reelSide = Math.abs(remoteReelSide(-1, true, 12)), fightSide = Math.abs(remoteFightSide(-1, true, 0, 0.5));
    expect(reelSide).toBeGreaterThanOrEqual(0.6); expect(reelSide).toBeLessThanOrEqual(0.9);
    expect(reelSide).toBeLessThan(fightSide * 0.5);
    // 收線時假魚跟著竿子同一邊（往左帶＝往左偏），搏鬥是魚往反方向衝
    expect(remoteReelSide(-1, true, 12)).toBeCloseTo(-REEL_SIDE_M, 6);
    expect(remoteReelSide(1, true, 12)).toBeCloseTo(REEL_SIDE_M, 6);
    // 線收很短時偏少一點；垂釣不偏
    expect(Math.abs(remoteReelSide(1, true, 1))).toBeLessThan(REEL_SIDE_M * 0.5);
    expect(remoteReelSide(1, false, 12)).toBe(0);
  });
  it('搏鬥幅度維持不變（fae8778）：竿掃約 2.5 m、側傾約 17°、轉身約 23°、線頭偏 2.2 m', () => {
    expect(STEER).toEqual({ rate: 4.5, side: 0.8, hx: 0.18, roll: 0.3, twist: 0.4 });
    expect(steerPose(-1)).toEqual(steerPose(-1, 1));
    expect(steerPose(1, 1)).toEqual({ side: 0.8, hx: 0.18, roll: -0.3, twist: -0.4 });
    expect(steerPose(1, 0)).toEqual({ side: STEER_REEL.side, hx: STEER_REEL.hx, roll: -STEER_REEL.roll, twist: -STEER_REEL.twist });
    const fN = remoteView([5 | 16]), fL = remoteView([5 | 16 | 32]);
    expect(fL.k).toBe(1);
    expect(fL.rz).toBeCloseTo(STEER.roll, 2);
    expect(fN.tipX - fL.tipX).toBeGreaterThan(1);
    expect(remoteFightSide(-1, true, 0.7, 0.5)).toBeCloseTo(2.2, 6);
  });
  it('收線帶竿中魚了：幅度平順放大成搏鬥（不會一幀跳過去）；放開收線慢慢回正', () => {
    const rig = mkRig(), rod = makeRod('lure'), pose = newFishPose(), inp = {} as FishPoseIn;
    const run = (st: number, n: number, f?: () => void) => { for (let k = 0; k < n; k++) { fishPoseDecodeInto(st, inp, 0.5); stepFishPose(pose, inp, dt); applyFishPose(rig, pose, rod, inp); f?.(); } };
    run(6 | 16 | 32, 120);
    const reelRz = rig.torso.rotation.z;
    let prev = reelRz, maxStep = 0;
    run(5 | 16 | 32, 120, () => { maxStep = Math.max(maxStep, Math.abs(rig.torso.rotation.z - prev)); prev = rig.torso.rotation.z; });
    expect(maxStep).toBeLessThan(0.02);
    expect(rig.torso.rotation.z).toBeGreaterThan(reelRz * 2);
    // 回到收線再放開方向／放開收線：回正
    run(6 | 16, 150);
    expect(pose.steer).toBe(0); expect(rig.torso.rotation.z).toBe(0);
    run(6 | 16 | 64, 120); run(4 | 16, 150);
    expect(pose.steer).toBe(0);
    rod.dispose();
  });
});
