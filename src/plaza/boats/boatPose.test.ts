import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makePlayerAvatar } from '../../dm/character';
import { makeMeshHelpers } from '../../dm/mesh';
const mk = () => { const { M, add } = makeMeshHelpers(new THREE.Scene(), true); return makePlayerAvatar({ shirt: 0x3a7ab8, hair: 0x222222, pants: 0x2a2a40 }, M, add, false) as any; };
import { poseRider } from './boatPose';

describe('船上姿勢', () => {
  it('抽菸：同一套坐姿抽菸，手藏起來、外框不被坐姿墊高、吸氣不累加', () => {
    const rig = mk();
    const y0 = rig.torso.position.y;
    let pr = poseRider(rig, 'drive', 0, { smoke: { puffK: 0 } });
    for (let i = 0; i < 200; i++) pr = poseRider(rig, 'drive', i * 0.016, { steer: 0.3, smoke: { puffK: 1, inhale: 1 } });
    expect(rig.root.position.y).toBe(0);
    expect(rig.torso.position.y).toBeLessThan(y0 + 0.05);
    expect(rig.handR.visible).toBe(false);
    expect(pr.dy).toBeCloseTo(0.07 - 0.72);
    // 抽到嘴邊時頭的俯仰跟吸菸區一樣（不是駕駛的 0.04）
    expect(rig.head.rotation.x).toBeLessThan(0);
  });
  it('乘客抽一口時右手舉起（跟沒抽時不同）', () => {
    const rig = mk();
    poseRider(rig, 'sit', 0, { smoke: { puffK: 0 } });
    const rest = rig.lowerR.rotation.clone();
    poseRider(rig, 'sit', 0, { smoke: { puffK: 1 } });
    expect(rig.lowerR.rotation.equals(rest)).toBe(false);
  });
});
