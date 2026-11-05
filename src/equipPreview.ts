import * as THREE from 'three';
import { makePlayerAvatar, posePlazaHangArms, type PlayerRig } from './dm/character';
import { makeMeshHelpers } from './dm/mesh';
import { applyOutfitToRig, type OutfitIds } from './equipVisual';

/**
 * 裝備頁人物預覽：與廣場第三人稱同款 makePlayerAvatar。
 * 正交相機對齊 viewBox 160×300 部位指引；lift 把腳抬離地板，帽頂仍在 frustum 內。
 */
export const EQ_FIG = {
  w: 160, h: 300,
  /** 世界 Y：腳底略高於 bottom，帽頂略低於 bottom+height */
  bottom: 0.04, height: 2.16,
  scale: 1.08,
  lift: 0.2,
} as const;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let rig: PlayerRig | null = null;
let hostEl: HTMLElement | null = null;
let raf = 0;
let yawT = 0;

function frameCamera(cam: THREE.OrthographicCamera) {
  const { bottom, height, w, h } = EQ_FIG;
  const midY = bottom + height / 2;
  const halfH = height / 2;
  const halfW = halfH * (w / h);
  cam.left = -halfW;
  cam.right = halfW;
  cam.top = midY + halfH;
  cam.bottom = midY - halfH;
  cam.near = 0.1;
  cam.far = 40;
  cam.position.set(0, midY, 5);
  cam.lookAt(0, midY, 0);
  cam.updateProjectionMatrix();
}

function placeRig() {
  if (!rig) return;
  rig.outer.scale.setScalar(EQ_FIG.scale);
  rig.outer.position.set(0, EQ_FIG.lift, 0);
}

function ensure() {
  if (renderer && scene && camera && rig) {
    placeRig();
    return;
  }
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  frameCamera(camera);
  scene.add(new THREE.AmbientLight(0xfff0e0, 0.55));
  scene.add(new THREE.HemisphereLight(0xfff5e8, 0x3a5568, 0.95));
  const sun = new THREE.DirectionalLight(0xffe4c0, 1.05);
  sun.position.set(1.6, 3.2, 2.4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb8d0e8, 0.35);
  fill.position.set(-2, 1.2, -1);
  scene.add(fill);
  const { M, add } = makeMeshHelpers(scene, true);
  rig = makePlayerAvatar({ shirt: 0xc45c26, hair: 0x222222, pants: 0x2a2a40 }, M, add, true);
  placeRig();
  posePlazaHangArms(rig);
  scene.add(rig.outer);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'eqFig';
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
}

function loop() {
  raf = 0;
  if (!renderer || !scene || !camera || !rig || !hostEl?.isConnected) return;
  if (!document.getElementById('equip')?.classList.contains('show')) return;
  const w = hostEl.clientWidth, h = hostEl.clientHeight;
  if (w > 0 && h > 0) {
    const pr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    frameCamera(camera);
  }
  yawT += 0.01;
  // 正面朝鏡頭；極小晃動
  placeRig();
  rig.outer.rotation.y = Math.PI + Math.sin(yawT) * 0.06;
  renderer.render(scene, camera);
  raf = requestAnimationFrame(loop);
}

/** 掛到裝備舞台並套上當前穿搭；可重入（renderEquip 重畫 DOM 後再掛） */
export function syncEqPreview(host: HTMLElement, outfit: OutfitIds) {
  ensure();
  if (!renderer || !rig) return;
  if (hostEl !== host) {
    hostEl = host;
    host.replaceChildren(renderer.domElement);
  } else if (renderer.domElement.parentElement !== host) {
    host.replaceChildren(renderer.domElement);
  }
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
  placeRig();
  if (!raf) raf = requestAnimationFrame(loop);
}

export function refreshEqPreview(outfit: OutfitIds) {
  if (!rig || !hostEl?.isConnected) return;
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
  placeRig();
}

export function stopEqPreview() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}
