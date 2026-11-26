/**
 * 魚類圖鑑的 3D：共用一個離屏 WebGLRenderer（要用才開、關圖鑑就 release），畫到 2D canvas／縮圖 dataURL。
 * 一條魚＝一個 mesh（fishModel.ts），一次只畫一條；縮圖記憶體快取；檢視器可以拖曳旋轉，停住就不重畫。
 */
import * as THREE from 'three';
import { fishGeometry, fishMaterial, fishSilMaterial, disposeFishGeometries } from './fishModel';

let R3: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let cam: THREE.PerspectiveCamera | null = null;
let mesh: THREE.Mesh | null = null;
let glLost = false, glBroken = false;
const thumbs = new Map<string, string>();

function ensure(w: number, h: number) {
  if (glBroken) throw new Error('no webgl');
  if (!R3) {
    const cv = document.createElement('canvas');
    try { R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }); }
    catch (e) { glBroken = true; throw e; }
    // 只認目前這個 canvas 的事件（release 時 forceContextLoss 的事件會晚一點才到，不能算到新的 renderer 頭上）
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); if (R3?.domElement === cv) glLost = true; }, false);
    cv.addEventListener('webglcontextrestored', () => { if (R3?.domElement === cv) glLost = false; }, false);
    R3.setPixelRatio(1);
    R3.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x7d8896, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(1.5, 3, 4); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xdfeaff, 0.7); rim.position.set(-2, 1.5, -3); scene.add(rim);
    cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    mesh = new THREE.Mesh(undefined, fishMaterial()); scene.add(mesh);
  }
  if (glLost || R3.getContext().isContextLost()) throw new Error('webgl lost');
  const s = R3.getSize(new THREE.Vector2());
  if (s.x !== w || s.y !== h) R3.setSize(w, h, false);
  return { R: R3, S: scene!, C: cam!, M: mesh! };
}

/** 畫一條魚（yaw＝繞直立軸、pitch＝俯仰）；sil＝沒釣過的剪影 */
function shoot(id: string, w: number, h: number, yaw: number, pitch: number, sil: boolean) {
  const { R, S, C, M } = ensure(w, h);
  const geo = fishGeometry(id); if (!geo) throw new Error('no fish');
  M.geometry = geo; M.material = sil ? fishSilMaterial() : fishMaterial();
  M.rotation.set(0, yaw, 0); M.rotation.z = 0;
  // 魚身長 1：鏡頭距離依畫面比例，整條魚都在畫面內（翻車魚這種比長度還高的也要整隻放得下）
  const asp = w / h; C.aspect = asp;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox!, tall = (bb.max.y - bb.min.y) * 1.12;
  const fitW = 1.18 / asp, d = Math.max(1.05, fitW, tall) / (2 * Math.tan((C.fov * Math.PI) / 360));
  C.position.set(0, Math.sin(pitch) * d, Math.cos(pitch) * d); C.lookAt(0, 0, 0); C.updateProjectionMatrix();
  R.setClearColor(0x000000, 0); R.clear();
  R.render(S, C);
  return R.domElement;
}

/** 縮圖 dataURL（記憶體快取）；WebGL 不能用就回空字串（呼叫端顯示文字） */
export function fishThumb(id: string, sil: boolean): string {
  const k = id + (sil ? ':s' : '');
  const hit = thumbs.get(k); if (hit != null) return hit;
  try { const url = shoot(id, 160, 100, 0.32, 0.22, sil).toDataURL('image/png'); thumbs.set(k, url); return url; }
  catch { return ''; }
}

/** 可拖曳旋轉的 3D 檢視；回傳 stop()。沒在動就不重畫；canvas 被拿掉自己停 */
export function mountFishViewer(canvas: HTMLCanvasElement, id: string, sil: boolean): () => void {
  const ctx = canvas.getContext('2d'); if (!ctx) return () => {};
  let yaw = 0.35, pitch = 0.2, drag = false, lx = 0, ly = 0, idle = true, raf = 0, dirty = true, stopped = false, broke = false;
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    const k = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.max(160, Math.min(720, Math.round(w * k))), ph = Math.max(100, Math.min(480, Math.round(h * k)));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; dirty = true; }
  };
  const paint = () => {
    dirty = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try { if (broke) throw new Error('broke'); ctx.drawImage(shoot(id, canvas.width, canvas.height, yaw, pitch, sil), 0, 0); }
    catch { broke = true; ctx.fillStyle = '#5a6a7a'; ctx.font = `${Math.round(canvas.height * 0.12)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('這台裝置看不到 3D', canvas.width / 2, canvas.height / 2); }
  };
  const draw = () => {
    if (stopped) return;
    if (!canvas.isConnected) { stop(); return; }
    raf = requestAnimationFrame(draw);
    if (idle && !broke) { yaw += 0.008; dirty = true; }
    if (dirty) paint();
  };
  const down = (e: PointerEvent) => { drag = true; idle = false; lx = e.clientX; ly = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } };
  const move = (e: PointerEvent) => { if (!drag) return; yaw += (e.clientX - lx) * 0.012; pitch = Math.max(-0.9, Math.min(1.2, pitch + (e.clientY - ly) * 0.008)); lx = e.clientX; ly = e.clientY; dirty = true; };
  const up = () => { drag = false; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.style.touchAction = 'none';
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { fit(); if (dirty && !stopped) paint(); }) : null;
  ro?.observe(canvas);
  fit(); paint(); draw();
  function stop() {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(raf); ro?.disconnect();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
  }
  return stop;
}

/** 關圖鑑：放掉 WebGL（手機上同時開太多 context 會被收掉）；縮圖 dataURL 留著 */
export function releaseFish3d() {
  if (!R3) return;
  try { R3.dispose(); R3.forceContextLoss(); } catch { /* */ }
  R3 = null; scene = null; cam = null; mesh = null; glLost = false;
  disposeFishGeometries();
}
/** 除錯：renderer 有沒有開著、快取幾張縮圖 */
export const fish3dDbg = () => ({ live: !!R3, thumbs: thumbs.size });
