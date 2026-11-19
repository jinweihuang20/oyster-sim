import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyPlazaBodyPose, resetPlazaPoseBase, type PlayerRig } from './character.ts';

function fakeRig(): PlayerRig {
  const o = () => new THREE.Object3D();
  return {
    outer: o(), root: o(), torso: o(), head: o(),
    legL: o(), legR: o(), shinL: o(), shinR: o(),
    shoulderL: o(), shoulderR: o(),
  } as unknown as PlayerRig;
}

test('只套混合式蹲姿不重設基準：大腿每幀累加到 ~3.9 rad（舊 bug 重現）', () => {
  const rig = fakeRig();
  for (let i = 0; i < 120; i++) applyPlazaBodyPose(rig, 'crouch', 1);
  assert.ok(rig.legL.rotation.x > 3.5);
});

test('遠端蹲著不動：每幀重設後大腿 1.55、小腿 -2.3，不累加', () => {
  const rig = fakeRig();
  for (let i = 0; i < 120; i++) {
    rig.outer.position.y = 0;
    resetPlazaPoseBase(rig, false, 0);
    applyPlazaBodyPose(rig, 'crouch', 1);
  }
  assert.ok(Math.abs(rig.legL.rotation.x - 1.55) < 1e-9);
  assert.ok(Math.abs(rig.shinL.rotation.x + 2.3) < 1e-9);
  assert.ok(Math.abs(rig.outer.position.y + 0.4) < 1e-9);
});

test('遠端蹲著走：腿在合理範圍內擺動，不會折爛', () => {
  const rig = fakeRig();
  let ph = 0;
  for (let i = 0; i < 300; i++) {
    ph += 0.15;
    resetPlazaPoseBase(rig, true, ph);
    applyPlazaBodyPose(rig, 'crouch', 1);
    for (const l of [rig.legL, rig.legR]) assert.ok(l.rotation.x > 1.3 && l.rotation.x < 1.8, `leg ${l.rotation.x}`);
    for (const s of [rig.shinL, rig.shinR]) assert.ok(s.rotation.x < -2.2 && s.rotation.x > -2.5, `shin ${s.rotation.x}`);
  }
});

test('從坐姿（腿帶 y/z 旋轉）直接蹲：基準重設會清掉殘留', () => {
  const rig = fakeRig();
  rig.legL.rotation.set(1.25, 0.06, 0.08);
  rig.root.position.y = -0.16;
  resetPlazaPoseBase(rig, false, 0);
  applyPlazaBodyPose(rig, 'crouch', 1);
  assert.equal(rig.legL.rotation.y, 0);
  assert.equal(rig.legL.rotation.z, 0);
  assert.equal(rig.root.position.y, 0);
});
