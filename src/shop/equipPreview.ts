import * as THREE from 'three';
import { makePlayerAvatar, posePlazaHangArms, type PlayerRig } from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { applyOutfitToRig, type OutfitIds } from './equipVisual';

export type EqSlot = 'head' | 'hand' | 'body' | 'legs' | 'feet';

/**
 * 裝備頁全身預覽。
 * 固定透視取景（角色腳≈0、帽頂≈1.85），不再用 bbox fit（易算錯只剩上半身）。
 */
const YAW0 = Math.PI;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rig: PlayerRig | null = null;
let hostEl: HTMLElement | null = null;
let raf = 0;
let yawT = 0;
const _v = new THREE.Vector3();
const _box = new THREE.Box3();
const _tmp = new THREE.Vector3();

function placeRig(yaw: number) {
  if (!rig) return;
  rig.outer.scale.setScalar(1);
  rig.outer.position.set(0, 0, 0);
  rig.outer.rotation.set(0, yaw, 0);
}

/** 全身入鏡：畫面中人物偏下，腳靠近地墊陰影 */
function frameCamera(aspect: number) {
  if (!camera) return;
  camera.fov = 30;
  camera.aspect = Math.max(0.3, aspect);
  // 對準略高讓人偏下靠陰影；略拉遠避免腳被裁切
  camera.position.set(0, 1.0, 3.75);
  camera.near = 0.4;
  camera.far = 40;
  camera.lookAt(0, 1.02, 0);
  camera.updateProjectionMatrix();
}

function hatWorldCenter(out: THREE.Vector3) {
  if (!rig) return out.set(0, 1.55, 0);
  rig.outer.updateMatrixWorld(true);
  if (rig.hatG.children.length) {
    _box.setFromObject(rig.hatG);
    if (!_box.isEmpty()) return _box.getCenter(out);
  }
  return rig.head.getWorldPosition(out).add(_tmp.set(0, 0.16, 0));
}

function disposePreview() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  if (rig) {
    scene?.remove(rig.outer);
    rig = null;
  }
  scene = null;
  camera = null;
  renderer = null;
  hostEl = null;
}

function ensure() {
  if (renderer && scene && camera && rig) return;
  disposePreview();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 160 / 300, 0.4, 40);
  frameCamera(160 / 300);
  scene.add(new THREE.AmbientLight(0xfff0e0, 0.6));
  scene.add(new THREE.HemisphereLight(0xfff5e8, 0x3a5568, 1));
  const sun = new THREE.DirectionalLight(0xffe4c0, 1.05);
  sun.position.set(1.8, 3.4, 2.6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb8d0e8, 0.4);
  fill.position.set(-2, 1.2, -1);
  scene.add(fill);
  const { M, add } = makeMeshHelpers(scene, true);
  rig = makePlayerAvatar({ shirt: 0xc45c26, hair: 0x222222, pants: 0x2a2a40 }, M, add, true);
  posePlazaHangArms(rig);
  placeRig(YAW0);
  scene.add(rig.outer);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'eqFig';
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
}

function worldToStagePct(world: THREE.Vector3, stage: HTMLElement, fig: HTMLElement): { x: number; y: number } | null {
  if (!camera) return null;
  _v.copy(world).project(camera);
  if (!Number.isFinite(_v.x) || !Number.isFinite(_v.y)) return null;
  const fr = fig.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  if (fr.width < 2 || fr.height < 2 || sr.width < 2 || sr.height < 2) return null;
  const px = fr.left + (_v.x + 1) * 0.5 * fr.width;
  const py = fr.top + (1 - _v.y) * 0.5 * fr.height;
  return {
    x: ((px - sr.left) / sr.width) * 100,
    y: ((py - sr.top) / sr.height) * 100,
  };
}

function anchorWorld(slot: EqSlot, out: THREE.Vector3): THREE.Vector3 {
  if (!rig) return out.set(0, 1, 0);
  rig.outer.updateMatrixWorld(true);
  switch (slot) {
    case 'head':
      return hatWorldCenter(out);
    case 'body':
      return rig.torso.getWorldPosition(out).add(_tmp.set(0, 0.06, 0));
    case 'hand': {
      const a = rig.lowerR.getWorldPosition(_tmp);
      const b = rig.upperR.getWorldPosition(out);
      return out.copy(a).add(b).multiplyScalar(0.5);
    }
    case 'legs': {
      const a = rig.legL.getWorldPosition(_tmp);
      const b = rig.legR.getWorldPosition(out);
      return out.copy(a).add(b).multiplyScalar(0.5).add(_tmp.set(0, -0.14, 0));
    }
    case 'feet': {
      const a = rig.shinL.getWorldPosition(_tmp);
      const b = rig.shinR.getWorldPosition(out);
      return out.copy(a).add(b).multiplyScalar(0.5).add(_tmp.set(0, -0.32, 0));
    }
  }
}

function updateGuideDom() {
  if (!rig || !camera || !hostEl) return;
  const stage = hostEl.closest('.eqStage') as HTMLElement | null;
  if (!stage) return;
  for (const s of ['head', 'hand', 'body', 'legs', 'feet'] as EqSlot[]) {
    const p = worldToStagePct(anchorWorld(s, _v), stage, hostEl);
    if (!p) continue;
    const hit = stage.querySelector<HTMLElement>(`.eqHit[data-slot="${s}"]`);
    if (hit) { hit.style.left = `${p.x}%`; hit.style.top = `${p.y}%`; }
  }
}

function loop() {
  raf = 0;
  if (!renderer || !scene || !camera || !rig || !hostEl?.isConnected) return;
  if (!document.getElementById('equip')?.classList.contains('show')) return;
  const w = hostEl.clientWidth, h = hostEl.clientHeight;
  yawT += 0.01;
  placeRig(YAW0 + Math.sin(yawT) * 0.04);
  if (w > 2 && h > 2) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    renderer.setSize(w, h, false);
    frameCamera(w / h);
  }
  renderer.render(scene, camera);
  updateGuideDom();
  raf = requestAnimationFrame(loop);
}

export function syncEqPreview(host: HTMLElement, outfit: OutfitIds) {
  // 換 DOM 節點時重建，避免舊 canvas／相機狀態殘留
  if (hostEl && hostEl !== host) disposePreview();
  ensure();
  if (!renderer || !rig) return;
  hostEl = host;
  host.replaceChildren(renderer.domElement);
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
  placeRig(YAW0);
  if (!raf) raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => {
    if (hostEl && hostEl.clientWidth > 2) {
      frameCamera(hostEl.clientWidth / hostEl.clientHeight);
      updateGuideDom();
    }
  });
}

export function refreshEqPreview(outfit: OutfitIds) {
  if (!rig || !hostEl?.isConnected) return;
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
  placeRig(YAW0);
  updateGuideDom();
}

export function stopEqPreview() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/** 離屏畫出與裝備預覽相同構圖的角色（透明底，不含格子）。 */
export function snapshotEqPreview(outfit: OutfitIds, w: number, h: number): HTMLCanvasElement | null {
  ensure();
  if (!scene || !camera || !rig) return null;
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
  placeRig(YAW0);
  const restoreCam = () => {
    if (hostEl && hostEl.clientWidth > 2) frameCamera(hostEl.clientWidth / hostEl.clientHeight);
  };
  const blit = (src: HTMLCanvasElement) => {
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(src, 0, 0, w, h);
    return out;
  };
  try {
    const snap = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    snap.setClearColor(0x000000, 0);
    snap.setPixelRatio(1);
    snap.setSize(w, h, false);
    frameCamera(w / h);
    snap.render(scene, camera);
    const out = blit(snap.domElement);
    snap.dispose();
    snap.domElement.remove();
    restoreCam();
    return out;
  } catch {
    if (!renderer) { restoreCam(); return null; }
    frameCamera(w / h);
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    const out = blit(renderer.domElement);
    if (hostEl && hostEl.clientWidth > 2) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
      renderer.setSize(hostEl.clientWidth, hostEl.clientHeight, false);
    }
    restoreCam();
    return out;
  }
}
