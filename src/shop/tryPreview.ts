import * as THREE from 'three';
import { makePlayerAvatar, posePlazaHangArms, type PlayerRig } from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { applyOutfitToRig, type OutfitIds } from './equipVisual';

/**
 * 商店服飾試穿：開啟時建一套 renderer，關閉時釋放。
 * 緩慢自轉，可用手指／滑鼠拖曳轉向。
 */
const YAW0 = Math.PI;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rig: PlayerRig | null = null;
let hostEl: HTMLElement | null = null;
let raf = 0;
let yawUser = 0;
let yawAuto = 0;
let dragging = false;
let lastX = 0;
let lastTs = 0;
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function placeRig() {
  if (!rig) return;
  rig.outer.scale.setScalar(1);
  rig.outer.position.set(0, 0, 0);
  rig.outer.rotation.set(0, YAW0 + yawUser + yawAuto, 0);
}

function frameCamera(aspect: number) {
  if (!camera) return;
  camera.fov = 30;
  camera.aspect = Math.max(0.3, aspect);
  camera.position.set(0, 1.0, 3.75);
  camera.near = 0.05;
  camera.far = 40;
  camera.lookAt(0, 1.02, 0);
  camera.updateProjectionMatrix();
}

function onPointerDown(e: PointerEvent) {
  dragging = true;
  lastX = e.clientX;
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  yawUser += (e.clientX - lastX) * 0.01;
  lastX = e.clientX;
}

function onPointerUp(e: PointerEvent) {
  dragging = false;
  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
}

function bindPointer(el: HTMLElement) {
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
}

function unbindPointer(el: HTMLElement) {
  el.removeEventListener('pointerdown', onPointerDown);
  el.removeEventListener('pointermove', onPointerMove);
  el.removeEventListener('pointerup', onPointerUp);
  el.removeEventListener('pointercancel', onPointerUp);
}

export function closeClothTryPreview() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (renderer) {
    unbindPointer(renderer.domElement);
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
  yawUser = 0;
  yawAuto = 0;
  dragging = false;
  lastTs = 0;
}

function ensure(host: HTMLElement) {
  if (renderer && scene && camera && rig && hostEl === host) return;
  closeClothTryPreview();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 3 / 4, 0.05, 40);
  frameCamera(3 / 4);
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
  placeRig();
  scene.add(rig.outer);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'clothTryCvs';
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
  bindPointer(renderer.domElement);
  hostEl = host;
  host.replaceChildren(renderer.domElement);
}

function loop(now: number) {
  raf = 0;
  if (!renderer || !scene || !camera || !rig || !hostEl?.isConnected) return;
  const shopOpen = !!document.getElementById('shop')?.classList.contains('show');
  if (!shopOpen || !document.getElementById('clothTry')) {
    document.getElementById('clothTry')?.remove();
    closeClothTryPreview();
    return;
  }
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016;
  lastTs = now;
  if (!dragging && !reduceMotion) yawAuto += dt * 0.45;
  placeRig();
  const w = hostEl.clientWidth, h = hostEl.clientHeight;
  if (w > 2 && h > 2) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    frameCamera(w / h);
  }
  renderer.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
  renderer.render(scene, camera);
  raf = requestAnimationFrame(loop);
}

export function openClothTryPreview(host: HTMLElement, outfit: OutfitIds) {
  ensure(host);
  if (!renderer || !rig) return;
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
  placeRig();
  if (!raf) raf = requestAnimationFrame(loop);
}
