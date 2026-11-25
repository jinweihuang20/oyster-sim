import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makePlayerAvatar } from '../../dm/character';
import { makeMeshHelpers } from '../../dm/mesh';
const mk = () => { const { M, add } = makeMeshHelpers(new THREE.Scene(), true); return makePlayerAvatar({ shirt: 0x3a7ab8, hair: 0x222222, pants: 0x2a2a40 }, M, add, false) as any; };
import { poseRider, swimPetSpot, SWIM_RX, TREAD_RX } from './boatPose';

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

describe('游泳：自由式＋寵物站背上', () => {
  it('k=0 踩水（直立、頭露出）、k=1 自由式（身體水平、貼水面）；中間連續', () => {
    const rig = mk();
    const a = poseRider(rig, 'swim', 1, { swim: 0 }), b = poseRider(rig, 'swim', 1, { swim: 1 }), m = poseRider(rig, 'swim', 1, { swim: 0.5 });
    expect(a.rx).toBeCloseTo(TREAD_RX); expect(b.rx).toBeCloseTo(SWIM_RX);
    expect(Math.abs(SWIM_RX + Math.PI / 2)).toBeLessThan(0.25);
    expect(a.dy).toBeLessThan(-0.9); expect(b.dy).toBeGreaterThan(-0.4);
    expect(m.rx).toBeLessThan(a.rx); expect(m.rx).toBeGreaterThan(b.rx);
  });
  it('自由式左右手輪流：同一時間一手在前伸、一手在後', () => {
    const rig = mk();
    poseRider(rig, 'swim', 0.2, { swim: 1 });
    const l = rig.lowerL.getWorldPosition(new THREE.Vector3()).y, r = rig.lowerR.getWorldPosition(new THREE.Vector3()).y;
    rig.outer.updateMatrixWorld(true);
    expect(Math.abs(rig.lowerL.position.y - rig.lowerR.position.y) + Math.abs(l - r)).toBeGreaterThan(0.05);
  });
  it('寵物：踩水站頭頂、自由式站背上；阿康這種貼地寵物在背上壓低一點', () => {
    const a = swimPetSpot(0), b = swimPetSpot(1), m = swimPetSpot(0.5);
    expect(a.y).toBeGreaterThan(b.y); expect(b.z).toBeGreaterThan(0.05);
    expect(m.y).toBeLessThan(a.y); expect(m.y).toBeGreaterThan(b.y);
    expect(swimPetSpot(-3)).toEqual(a); expect(swimPetSpot(9)).toEqual(b);
    expect(swimPetSpot(1, true).z).toBeLessThan(b.z);
  });
});
