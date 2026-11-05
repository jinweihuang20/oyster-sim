import * as THREE from 'three';
import { makePlayerAvatar, posePlazaHangArms, type PlayerRig } from './dm/character';
import { makeMeshHelpers } from './dm/mesh';
import { applyOutfitToRig, type OutfitIds } from './equipVisual';

/** 裝備頁人物預覽：與廣場第三人稱本機同一套 makePlayerAvatar + outfit */
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rig: PlayerRig | null = null;
let hostEl: HTMLElement | null = null;
let raf = 0;
let yawT = 0;

function ensure() {
  if (renderer && scene && camera && rig) return;
  scene = new THREE.Scene();
  // 全身＋帽子留白：略遠、視線略偏低，避免頭頂被裁
  camera = new THREE.PerspectiveCamera(34, 160 / 300, 0.1, 40);
  camera.position.set(0, 0.88, 3.65);
  camera.lookAt(0, 0.68, 0);
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  yawT += 0.012;
  // avatar 正面朝 −Z；相機在 +Z，需轉 π 才面向鏡頭
  rig.outer.rotation.y = Math.PI + Math.sin(yawT) * 0.38;
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
  if (!raf) raf = requestAnimationFrame(loop);
}

export function refreshEqPreview(outfit: OutfitIds) {
  if (!rig || !hostEl?.isConnected) return;
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
}

export function stopEqPreview() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}
