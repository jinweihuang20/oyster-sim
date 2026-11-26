import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { newFishPose, stepFishPose, applyFishPose, rodTipWorld, steerPose, STEER, type FishPoseIn, type FishPoseSt } from './fishPose';
import { makeRod } from './fishRod';
import { makePlayerAvatar } from '../../dm/character';
import { makeMeshHelpers } from '../../dm/mesh';

const dt = 1 / 60;
const inp = (o: Partial<FishPoseIn> = {}): FishPoseIn => ({ phase: 'fight', power: 0, reel: true, tension: 0.6, lure: true, twitch: 0, steer: 0, ...o });
const run = (st: FishPoseSt, i: FishPoseIn, n: number) => { for (let k = 0; k < n; k++) stepFishPose(st, i, dt); return st; };
const mk = () => { const { M, add } = makeMeshHelpers(new THREE.Scene(), true); return makePlayerAvatar({ shirt: 0x3a7ab8, hair: 0x222222, pants: 0x2a2a40 }, M, add, false) as any; };

describe('拉魚往左右拉的人物動作', () => {
  it('往左／往右：身體側傾、上身轉向、竿子掃過去，左右對稱、方向相反、看得出來', () => {
    const L = run(newFishPose(), inp({ steer: -1 }), 120), R = run(newFishPose(), inp({ steer: 1 }), 120);
    expect(L.steer).toBeCloseTo(-1, 2); expect(R.steer).toBeCloseTo(1, 2);
    const pl = steerPose(L.steer), pr = steerPose(R.steer);
    for (const k of ['side', 'hx', 'roll', 'twist'] as const) { expect(pl[k]).toBeCloseTo(-pr[k], 6); expect(Math.abs(pr[k])).toBeGreaterThan(0.1); }
    // 往左拉：竿往左（-x）、手往左、上身頂端往左傾（+z 轉）、胸口轉向左（+y 轉）
    expect(pl.side).toBeLessThan(0); expect(pl.hx).toBeLessThan(0); expect(pl.roll).toBeGreaterThan(0); expect(pl.twist).toBeGreaterThan(0);
    // 往上拉的張力姿勢不變（左右只疊在旁邊）
    expect(L.pitch).toBeCloseTo(R.pitch, 6); expect(L.lean).toBeCloseTo(R.lean, 6); expect(L.bend).toBeCloseTo(R.bend, 6);
    expect(L.pitch).toBeGreaterThan(1);
  });

  it('真的套到人物上：竿尖往拉的那邊、torso 側傾＋轉向，左右對稱', () => {
    const res: Record<string, { tipX: number; rz: number; ry: number }> = {};
    for (const [k, s] of [['L', -1], ['N', 0], ['R', 1]] as const) {
      const rig = mk(), scene = new THREE.Scene(); scene.add(rig.outer); rig.outer.rotation.y = 0;
      const st = run(newFishPose(), inp({ steer: s }), 150), rod = makeRod('lure'), i = inp({ steer: s });
      applyFishPose(rig, st, rod, i); scene.updateMatrixWorld(true);
      const tip = rodTipWorld(rod, new THREE.Vector3());
      res[k] = { tipX: tip.x, rz: rig.torso.rotation.z, ry: rig.torso.rotation.y };
      rod.dispose();
    }
    expect(res.L.tipX).toBeLessThan(res.N.tipX - 0.3); expect(res.R.tipX).toBeGreaterThan(res.N.tipX + 0.3);
    // 竿尖左右掃的量：兩邊差不多（站姿本來就有一點往右偏，容許 25%）
    const dl = res.N.tipX - res.L.tipX, dr = res.R.tipX - res.N.tipX;
    expect(Math.abs(dl - dr) / Math.max(dl, dr)).toBeLessThan(0.25);
    expect(res.L.rz).toBeCloseTo(STEER.roll, 2); expect(res.R.rz).toBeCloseTo(-STEER.roll, 2); expect(res.N.rz).toBe(0);
    expect(res.L.ry - res.N.ry).toBeCloseTo(-(res.R.ry - res.N.ry), 2);
    expect(res.L.ry - res.N.ry).toBeGreaterThan(0.2);
  });

  it('左右切換有重量：慢慢轉過去（不會一幀跳到另一邊）', () => {
    const st = run(newFishPose(), inp({ steer: -1 }), 120);
    let prev = st.steer, maxStep = 0, crossT = -1;
    for (let k = 0; k < 90; k++) { stepFishPose(st, inp({ steer: 1 }), dt); maxStep = Math.max(maxStep, Math.abs(st.steer - prev)); prev = st.steer; if (crossT < 0 && st.steer > 0) crossT = k * dt; }
    expect(maxStep).toBeLessThan(0.15);
    expect(crossT).toBeGreaterThan(0.08); expect(crossT).toBeLessThan(0.35);
    expect(st.steer).toBeGreaterThan(0.9);
  });

  it('放開搖桿或離開拉魚：平順回正到 0，torso 側傾還原', () => {
    for (const end of [inp({ steer: 0 }), inp({ phase: 'show', steer: 1 }), inp({ phase: 'hold', steer: -1 })]) {
      const st = run(newFishPose(), inp({ steer: 1 }), 120);
      let prev = st.steer;
      for (let k = 0; k < 150; k++) { stepFishPose(st, end, dt); expect(st.steer).toBeLessThanOrEqual(prev + 1e-9); prev = st.steer; }
      expect(st.steer).toBe(0);
    }
    const rig = mk(), rod = makeRod('lure');
    const st = run(newFishPose(), inp({ steer: 1 }), 120);
    applyFishPose(rig, st, rod, inp({ steer: 1 })); expect(rig.torso.rotation.z).toBeLessThan(-0.1);
    run(st, inp({ phase: 'hold' }), 200);
    applyFishPose(rig, st, rod, inp({ phase: 'hold' })); expect(rig.torso.rotation.z).toBe(0);
    // 回正後不再碰 z（走路擺動自己管）
    rig.torso.rotation.z = 0.05; applyFishPose(rig, st, rod, inp({ phase: 'hold' })); expect(rig.torso.rotation.z).toBe(0.05);
    rod.dispose();
  });

  it('別人的（沒有 steer）拉魚姿勢跟以前一樣不偏', () => {
    const a = run(newFishPose(), { phase: 'fight', power: 0, reel: true, tension: 0.6, lure: true, twitch: 0 }, 120);
    expect(a.steer).toBe(0);
    expect(steerPose(a.steer).side).toBe(0);
  });
});
