/** 商店卡片的寵物 3D 縮圖：共用一台離屏 renderer，依 id 快取 dataURL（啟動後畫一次就夠） */
import * as THREE from 'three';
import { findPet, makeOysterBaby } from './pets';

const TW = 160, TH = 160;
const cache = new Map<string, string>();
let failed = false;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function ensure(): boolean {
  if (failed) return false;
  if (renderer && scene && camera) return true;
  try {
    const gl = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    });
    const ctx = gl.getContext();
    if (!ctx) { gl.dispose(); failed = true; return false; }
    gl.setClearColor(0x000000, 0);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.setPixelRatio(1);
    gl.setSize(TW, TH, false);
    const sc = new THREE.Scene();
    sc.add(new THREE.AmbientLight(0xfff0e0, 0.6));
    sc.add(new THREE.HemisphereLight(0xfff5e8, 0x3a5568, 1));
    const sun = new THREE.DirectionalLight(0xffe4c0, 1.1);
    sun.position.set(1.4, 2.2, 2.0);
    sc.add(sun);
    const cam = new THREE.PerspectiveCamera(32, TW / TH, 0.1, 10);
    cam.position.set(0, 0.17, 0.78);
    cam.lookAt(0, 0.13, 0);
    renderer = gl; scene = sc; camera = cam;
    return true;
  } catch {
    failed = true; return false;
  }
}

/** 離屏畫一次後回傳 dataURL；失敗回 null */
export function renderPetThumb(petId: string): string | null {
  const cached = cache.get(petId); if (cached) return cached;
  const p = findPet(petId); if (!p) return null;
  if (!ensure() || !renderer || !scene || !camera) return null;
  let mesh: THREE.Group | null = null;
  if (petId === 'pt_oyster_baby') mesh = makeOysterBaby();
  if (!mesh) return null;
  scene.add(mesh);
  // 面向相機（模型前方為 -z，相機在 +z 側），再微轉 ~10° 做 3/4 視角
  mesh.rotation.y = Math.PI + 0.18;
  try {
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    cache.set(petId, url);
    return url;
  } catch {
    return null;
  } finally {
    scene.remove(mesh);
    mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) (mat as THREE.Material).dispose();
      }
    });
  }
}
