/**
 * 拉魚左右拉：自己的輸入 → FishSync st（+32 左／+64 右）→ 伺服器轉發 → 別人畫面上的人物／竿子／線頭，整條路都測。
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HubConnectionState } from '@microsoft/signalr';
import { steerDirFromPad } from './fishReelFeel';
import { fishPoseCode, fishPoseDecodeInto, newFishPose, stepFishPose, applyFishPose, rodTipWorld, STEER, type FishPoseIn } from './fishPose';
import { FISH_SYNC, newFishSync, copyFishSync, fishSyncDue, fishSyncLost, normFishSync, remoteFightSide } from './fishSync';
import { makeBoatNet } from './boatNet';
import { makeRod } from './fishRod';
import { makePlayerAvatar } from '../../dm/character';
import { makeMeshHelpers } from '../../dm/mesh';

const dt = 1 / 60;
/** 跟伺服器 PlazaWorld.FishSyncClamp 一樣：只有拉魚（5）才留左右 bit，兩個都設＝都不留 */
const serverClamp = (st: number) => {
  const b = Math.min(st & 15, 7); if (!b) return 0;
  const L = (st & 32) !== 0, R = (st & 64) !== 0;
  return b | (st & 16) | (b === 5 && L !== R ? (L ? 32 : 64) : 0);
};
/** 自己這邊：鍵盤／搖桿 → 送出去的 st */
const localSt = (keys: string[], joyX = 0, lure = true, reel = true) => fishPoseCode('fight', reel, lure, steerDirFromPad(c => keys.includes(c), joyX));
/** 伺服器轉發給別人的事件（PascalCase 也吃） */
const relay = (st: number) => normFishSync({ ConnId: 'A', St: serverClamp(st), Boat: false, Yaw: 0, Ch: 0, Cd: 12, Tn: 0.5 })!;
const mkRig = () => { const { M, add } = makeMeshHelpers(new THREE.Scene(), true); return makePlayerAvatar({ shirt: 0x3a7ab8, hair: 0x222222, pants: 0x2a2a40 }, M, add, false) as any; };

/** 別人畫面：收到的 st 擺 n 幀，回傳竿尖（人物座標）、torso 側傾／轉向 */
function remoteView(sts: number[], frames = 90, boatYaw: number | null = null) {
  const rig = mkRig(), scene = new THREE.Scene(); scene.add(rig.outer);
  if (boatYaw != null) { rig.outer.position.set(-50, 0.6, -8); rig.outer.rotation.set(0.03, boatYaw, -0.04); }
  const pose = newFishPose(), rod = makeRod('lure'); const inp = {} as FishPoseIn;
  for (const st of sts) for (let k = 0; k < frames; k++) { fishPoseDecodeInto(st, inp, 0.5); stepFishPose(pose, inp, dt); applyFishPose(rig, pose, rod, inp); }
  scene.updateMatrixWorld(true);
  const tip = rig.outer.worldToLocal(rodTipWorld(rod, new THREE.Vector3()));
  const out = { tipX: tip.x, rz: rig.torso.rotation.z, ry: rig.torso.rotation.y, steer: pose.steer };
  rod.dispose();
  return out;
}

describe('拉魚左右拉：輸入編進 FishSync st', () => {
  it('鍵盤 A／←＝+32、D／→＝+64、搖桿左右也一樣；按住收線也照帶；放開＝沒有 bit', () => {
    for (const lure of [true, false]) for (const reel of [true, false]) {
      const base = 5 + (lure ? 16 : 0);
      expect(localSt(['KeyA'], 0, lure, reel)).toBe(base | 32);
      expect(localSt(['ArrowLeft'], 0, lure, reel)).toBe(base | 32);
      expect(localSt(['KeyD'], 0, lure, reel)).toBe(base | 64);
      expect(localSt(['ArrowRight'], 0, lure, reel)).toBe(base | 64);
      expect(localSt([], -0.8, lure, reel)).toBe(base | 32);
      expect(localSt([], 0.8, lure, reel)).toBe(base | 64);
      expect(localSt([], 0, lure, reel)).toBe(base);
      // 搖桿只推一點點（死區內）＝不算
      expect(localSt([], 0.1, lure, reel)).toBe(base);
    }
  });
  it('左右換了、放開了都會送出去（不會被節流吃掉）', () => {
    const last = newFishSync(), cur = newFishSync();
    cur.st = localSt([]); cur.cd = 12; cur.tn = 0.5; copyFishSync(cur, last);
    for (const keys of [['KeyA'], ['KeyD'], []]) {
      cur.st = localSt(keys);
      expect(fishSyncDue(last, cur, true, 0.05)).toBe(false);
      expect(fishSyncDue(last, cur, true, FISH_SYNC.steerGap)).toBe(true);
      copyFishSync(cur, last);
    }
  });
  it('伺服器轉發後左右 bit 還在，別人解得出左／右／正中', () => {
    expect(relay(localSt(['KeyA'])).st).toBe(5 | 16 | 32);
    expect(relay(localSt(['KeyD'])).st).toBe(5 | 16 | 64);
    expect(relay(localSt([])).st).toBe(5 | 16);
  });
});

describe('拉魚左右拉：別人畫面看得出來', () => {
  it('岸上：往左拉竿尖往左掃、往右拉往右掃（各超過 1 m），身體往兩邊明顯側傾＋轉身；放開回正', () => {
    const N = remoteView([relay(localSt([])).st]);
    const L = remoteView([relay(localSt(['KeyA'])).st]);
    const R = remoteView([relay(localSt(['KeyD'])).st]);
    expect(L.tipX).toBeLessThan(N.tipX - 1); expect(R.tipX).toBeGreaterThan(N.tipX + 1);
    expect(L.rz).toBeGreaterThan(0.25); expect(R.rz).toBeLessThan(-0.25); expect(N.rz).toBe(0);
    expect(L.ry - N.ry).toBeGreaterThan(0.3); expect(N.ry - R.ry).toBeGreaterThan(0.3);
    // 放開（又收到 st 5）：慢慢回正到正中
    const back = remoteView([relay(localSt(['KeyA'])).st, relay(localSt([])).st], 120);
    expect(back.steer).toBe(0); expect(back.rz).toBe(0);
    expect(Math.abs(back.tipX - N.tipX)).toBeLessThan(0.15);
  });
  it('船上（船身有轉向、有搖晃）：一樣左右對稱、看得出來', () => {
    const N = remoteView([5 | 16], 90, 2.1), L = remoteView([5 | 16 | 32], 90, 2.1), R = remoteView([5 | 16 | 64], 90, 2.1);
    expect(L.tipX).toBeLessThan(N.tipX - 1); expect(R.tipX).toBeGreaterThan(N.tipX + 1);
    expect(L.rz).toBeCloseTo(STEER.roll, 2); expect(R.rz).toBeCloseTo(-STEER.roll, 2);
  });
  it('左右切換是平順轉過去（不會一幀跳到另一邊）', () => {
    const rig = mkRig(), rod = makeRod('lure'), pose = newFishPose(), inp = {} as FishPoseIn;
    const run = (st: number, n: number, f?: () => void) => { for (let k = 0; k < n; k++) { fishPoseDecodeInto(st, inp, 0.5); stepFishPose(pose, inp, dt); applyFishPose(rig, pose, rod, inp); f?.(); } };
    run(5 | 32, 90);
    let prev = rig.torso.rotation.z, maxStep = 0;
    run(5 | 64, 90, () => { maxStep = Math.max(maxStep, Math.abs(rig.torso.rotation.z - prev)); prev = rig.torso.rotation.z; });
    expect(maxStep).toBeLessThan(0.05);
    expect(rig.torso.rotation.z).toBeLessThan(-0.25);
    rod.dispose();
  });
  it('路亞：別人畫面的線頭跟拉的方向相反（魚往另一邊衝），垂釣照舊小擺', () => {
    expect(remoteFightSide(-1, true, 0.7, 0.5)).toBeCloseTo(2.2, 6);
    expect(remoteFightSide(1, true, -0.7, 0.5)).toBeCloseTo(-2.2, 6);
    expect(Math.abs(remoteFightSide(0, true, 1, 0.5))).toBeLessThan(1.5);
    expect(remoteFightSide(1, false, 0.5, 0.5)).toBeCloseTo(remoteFightSide(0, false, 0.5, 0.5), 6);
  });
});

describe('拉魚左右拉：伺服器限速／送失敗會重送', () => {
  it('沒送到：退避 retryGap 後一定重送同一個 st（含不釣了），不會一直卡在舊方向', () => {
    const last = newFishSync(), cur = newFishSync();
    cur.st = 5 | 32; cur.cd = 12; copyFishSync(cur, last);
    let since = fishSyncLost(last);
    expect(fishSyncDue(last, cur, true, since)).toBe(false);
    since += FISH_SYNC.retryGap - 0.01; expect(fishSyncDue(last, cur, true, since)).toBe(false);
    since += 0.02; expect(fishSyncDue(last, cur, true, since)).toBe(true);
    // 「不釣了」沒送到也要重送
    cur.st = 0; copyFishSync(cur, last); since = fishSyncLost(last);
    expect(fishSyncDue(last, cur, true, since)).toBe(false);
    expect(fishSyncDue(last, cur, true, since + FISH_SYNC.retryGap)).toBe(true);
    // 平常（沒退避）不釣了照樣立刻送
    expect(fishSyncDue({ ...cur, st: 5 }, cur, true, 0)).toBe(true);
  });
  it('boatNet：伺服器回 slow／失敗＝通知重送；ok＝不通知', async () => {
    let reply: any = { ok: true };
    const client: any = { afterJoin: [], bindExtra() {}, conn: { state: HubConnectionState.Connected, async invoke(m: string) { if (m === 'BoatState') return { ok: true, state: { boats: [], swimmers: [], t: 1, v: 1 } }; return reply; } } };
    const net = makeBoatNet(client, { state: () => {} } as any);
    const flush = () => new Promise(r => setTimeout(r, 0));
    await net.fetchState(); await flush();
    let lost = 0;
    expect(net.fishSync({ ...newFishSync(), st: 5 | 32 }, () => lost++)).toBe(true); await flush(); await flush();
    expect(lost).toBe(0);
    reply = { ok: false, err: 'slow' };
    expect(net.fishSync({ ...newFishSync(), st: 5 | 64 }, () => lost++)).toBe(true); await flush(); await flush();
    expect(lost).toBe(1);
    client.conn.invoke = async () => { throw new Error('boom'); };
    expect(net.fishSync({ ...newFishSync(), st: 5 }, () => lost++)).toBe(true); await flush(); await flush();
    expect(lost).toBe(2);
  });
});
