import { test, expect } from 'vitest';
import * as THREE from 'three';
import {
  CAM_HEAD_FADE_DIST,
  leanFacePeekX,
  tickCamHeadFade,
  clearCamHeadFade,
} from './camHeadFade';

test('橫向湊近臉停在畫面兩側，不會比半寬更靠近中間', () => {
  const { restX, peekX } = leanFacePeekX(53, 2);
  const halfW = 0.75 * Math.tan((53 * Math.PI / 180) / 2) * 2;
  expect(peekX).toBeLessThan(halfW);
  expect(peekX).toBeGreaterThan(halfW * 0.7);
  expect(restX).toBeGreaterThan(halfW);
});

test('直向湊近臉也只從邊緣探出', () => {
  const { peekX, restX } = leanFacePeekX(82, 0.5);
  const halfW = 0.75 * Math.tan((82 * Math.PI / 180) / 2) * 0.5;
  expect(peekX).toBeLessThanOrEqual(halfW * 0.95 + 1e-9);
  expect(restX).toBeGreaterThan(halfW);
});

test('頭在 0.5m 內會被藏起，離開後恢復', () => {
  clearCamHeadFade();
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 1, 0);
  cam.updateMatrixWorld();
  const near = new THREE.Group();
  near.position.set(0.2, 1, 0);
  near.updateMatrixWorld();
  const far = new THREE.Group();
  far.position.set(0, 1, 2);
  far.updateMatrixWorld();
  tickCamHeadFade(cam, [near, far], true);
  expect(near.visible).toBe(false);
  expect(far.visible).toBe(true);
  near.position.set(0, 1, 2);
  near.updateMatrixWorld();
  tickCamHeadFade(cam, [near, far], true);
  expect(near.visible).toBe(true);
  expect(far.visible).toBe(true);
  clearCamHeadFade();
});

test('關閉時會恢復已被藏起的頭', () => {
  clearCamHeadFade();
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 0, 0);
  cam.updateMatrixWorld();
  const head = new THREE.Group();
  head.position.set(0.1, 0, 0);
  head.updateMatrixWorld();
  tickCamHeadFade(cam, [head], true);
  expect(head.visible).toBe(false);
  tickCamHeadFade(cam, [head], false);
  expect(head.visible).toBe(true);
  expect(CAM_HEAD_FADE_DIST).toBe(0.5);
  clearCamHeadFade();
});
