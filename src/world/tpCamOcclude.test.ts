import { test, expect } from 'vitest';
import * as THREE from 'three';
import { tickTpCamOcclude, clearTpCamOcclude } from './tpCamOcclude';

function setup() {
  clearTpCamOcclude();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 50);
  camera.position.set(0, 1, 5);
  camera.updateMatrixWorld();
  const focus = new THREE.Vector3(0, 1, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.2), mat);
  mesh.position.set(0, 1, 2.5);
  scene.add(mesh);
  return { scene, camera, focus, mesh };
}

function opacityOf(mesh: THREE.Mesh) {
  const m = mesh.material as THREE.MeshBasicMaterial;
  return m.opacity;
}

test('切換視角 snap 時，擋到的牆立刻半透明，不會慢慢淡', () => {
  const { scene, camera, focus, mesh } = setup();
  tickTpCamOcclude(1 / 60, scene, camera, focus, true, true);
  expect(opacityOf(mesh)).toBeCloseTo(0.2, 5);
  clearTpCamOcclude();
});

test('沒有 snap 時，第一幀只淡一點', () => {
  const { scene, camera, focus, mesh } = setup();
  tickTpCamOcclude(1 / 60, scene, camera, focus, true, false);
  expect(opacityOf(mesh)).toBeGreaterThan(0.8);
  expect(opacityOf(mesh)).toBeLessThan(1);
  clearTpCamOcclude();
});

test('snap 關閉時立刻恢復不透明', () => {
  const { scene, camera, focus, mesh } = setup();
  tickTpCamOcclude(1 / 60, scene, camera, focus, true, true);
  expect(opacityOf(mesh)).toBeCloseTo(0.2, 5);
  tickTpCamOcclude(1 / 60, scene, camera, focus, false, true);
  expect(opacityOf(mesh)).toBe(1);
  clearTpCamOcclude();
});

test('廣場開啟時也掃 plazaSea（碼頭／步道），釣魚第三人稱才透得過場景', () => {
  clearTpCamOcclude();
  const scene = new THREE.Scene();
  const plaza = new THREE.Group(); plaza.name = 'plazaWorld'; scene.add(plaza);
  const sea = new THREE.Group(); sea.name = 'plazaSea'; scene.add(sea);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 50);
  camera.position.set(0, 1.5, 5);
  camera.updateMatrixWorld();
  const focus = new THREE.Vector3(0, 1, 0);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mesh.name = 'plazaDock';
  mesh.position.set(0, 1, 2.5);
  sea.add(mesh);
  scene.updateMatrixWorld(true);
  tickTpCamOcclude(1 / 60, scene, camera, focus, true, true);
  expect(opacityOf(mesh)).toBeCloseTo(0.2, 5);
  clearTpCamOcclude();
});
