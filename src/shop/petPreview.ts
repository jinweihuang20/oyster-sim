/** 寵物 3D 檢視：全畫面 overlay，可拖曳旋轉；離開點叉或背景 */
import * as THREE from 'three';
import { findPet, makeOysterBaby } from './pets';

let el: HTMLDivElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let mesh: THREE.Group | null = null;
let raf = 0;
let lastT = 0;
let yawUser = 0, yawAuto = 0;
let dragging = false;
let dragX = 0, dragLastYaw = 0;
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function close() {
  if (raf) cancelAnimationFrame(raf); raf = 0;
  if (renderer) { renderer.dispose(); renderer.domElement.remove(); renderer = null; }
  scene = null; camera = null; mesh = null;
  el?.remove(); el = null;
}

function bindPointer(canvas: HTMLCanvasElement) {
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    dragging = true; dragX = e.clientX; dragLastYaw = yawUser;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragX;
    yawUser = dragLastYaw + dx * 0.012;
  });
  const end = (e: PointerEvent) => { if (dragging) { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ } } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function loop(now: number) {
  raf = 0;
  if (!renderer || !scene || !camera || !mesh) return;
  const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
  lastT = now;
  if (!dragging && !reduceMotion) yawAuto += dt * 0.6;
  // 初始 yaw 加 π 讓模型面向相機（模型前方為 -z）
  mesh.rotation.y = Math.PI + yawUser + yawAuto;
  renderer.render(scene, camera);
  raf = requestAnimationFrame(loop);
}

export function openPetPreview(petId: string) {
  close();
  const p = findPet(petId); if (!p) return;
  el = document.createElement('div');
  el.id = 'petPreview';
  // z-index 要壓過廣場 UI（#plazaTags 8800、plazaMode 下 #top/#stats 9100）、設定/兌換碼（13000–13100），
  // 僅低於寵物提示 toast（13200）。
  el.style.cssText = 'position:fixed;inset:0;z-index:13500;background:rgba(10,10,18,0.78);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box;touch-action:none';
  el.innerHTML = `
    <div style="color:#fff;font-weight:700;font-size:18px">${p.n} <small style="opacity:.75;font-weight:400">拖曳旋轉</small></div>
    <div id="petPvHost" style="width:min(80vw,340px);aspect-ratio:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden"></div>
    <div style="color:#d5d5d5;font-size:13px;max-width:360px;text-align:center;line-height:1.5">${p.desc}</div>
    <button id="petPvClose" style="min-width:120px;padding:10px 16px;background:#d9952b;color:#2a1600;font-weight:700;border:none;border-radius:8px;cursor:pointer">關閉</button>
  `;
  document.body.appendChild(el);
  const host = el.querySelector('#petPvHost') as HTMLDivElement;
  const btn = el.querySelector('#petPvClose') as HTMLButtonElement;
  btn.onclick = close;
  el.addEventListener('click', e => { if (e.target === el) close(); });
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    host.replaceChildren(renderer.domElement);
    bindPointer(renderer.domElement);
    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xfff0e0, 0.65));
    scene.add(new THREE.HemisphereLight(0xfff5e8, 0x3a5568, 1));
    const sun = new THREE.DirectionalLight(0xffe4c0, 1.15);
    sun.position.set(1.6, 2.4, 2.2); scene.add(sun);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
    camera.position.set(0, 0.17, 0.95);
    camera.lookAt(0, 0.13, 0);
    if (petId === 'pt_oyster_baby') mesh = makeOysterBaby();
    if (mesh) { mesh.scale.setScalar(1.5); scene.add(mesh); }
    yawUser = 0; yawAuto = 0; lastT = 0;
    raf = requestAnimationFrame(loop);
  } catch {
    close();
  }
}

export function closePetPreview() { close(); }
