import * as THREE from 'three';
import { makePlayerAvatar, posePlazaHangArms, type PlayerRig } from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { applyOutfitToRig, type OutfitIds } from './equipVisual';
import { EQUIP, type Slot } from './shopEquip';

/** 商店／衣櫃卡片的 3D 縮圖：共用一台離屏 renderer，依 id 快取 dataURL。 */
const TW = 144;
const TH = 120;
const cache = new Map<string, string>();
let failed = false;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rig: PlayerRig | null = null;
const look = new THREE.Vector3();
const tmp = new THREE.Vector3();
const queue: HTMLElement[] = [];
let ticking = false;
let io: IntersectionObserver | null = null;

function baseOutfit(): OutfitIds {
  return {
    head: 'hd_none',
    hand: 'hn_none',
    body: 'bd_basic',
    legs: 'lg_basic',
    feet: 'ft_none',
  };
}

function ensure(): boolean {
  if (failed) return false;
  if (renderer && scene && camera && rig) return true;
  try {
    const gl = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    });
    const ctx = gl.getContext();
    if (!ctx) {
      gl.dispose();
      failed = true;
      return false;
    }
    gl.setClearColor(0x000000, 0);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.setPixelRatio(1);
    gl.setSize(TW, TH, false);
    const sc = new THREE.Scene();
    sc.add(new THREE.AmbientLight(0xfff0e0, 0.65));
    sc.add(new THREE.HemisphereLight(0xfff5e8, 0x3a5568, 1));
    const sun = new THREE.DirectionalLight(0xffe4c0, 1.05);
    sun.position.set(1.8, 3.4, 2.6);
    sc.add(sun);
    const fill = new THREE.DirectionalLight(0xb8d0e8, 0.45);
    fill.position.set(-2, 1.2, -1);
    sc.add(fill);
    const cam = new THREE.PerspectiveCamera(32, TW / TH, 0.05, 20);
    const { M, add } = makeMeshHelpers(sc, true);
    const av = makePlayerAvatar({ shirt: 0xc45c26, hair: 0x222222, pants: 0x2a2a40 }, M, add, true);
    sc.add(av.outer);
    renderer = gl;
    scene = sc;
    camera = cam;
    rig = av;
    return true;
  } catch {
    failed = true;
    return false;
  }
}

function frameSlot(slot: Slot) {
  if (!rig || !camera) return;
  rig.outer.updateMatrixWorld(true);
  let dist = 1.3;
  let fov = 32;
  let lift = 0.06;
  if (slot === 'head') {
    rig.head.getWorldPosition(look);
    look.y += 0.05;
    dist = 0.92;
    fov = 34;
    lift = 0.04;
  } else if (slot === 'hand') {
    rig.upperR.getWorldPosition(look);
    rig.lowerR.getWorldPosition(tmp);
    look.lerp(tmp, 0.55);
    dist = 0.82;
    fov = 36;
    lift = 0.05;
  } else if (slot === 'body') {
    rig.torso.getWorldPosition(look);
    look.y += 0.02;
    dist = 1.52;
    fov = 30;
    lift = 0.04;
  } else if (slot === 'legs') {
    rig.legL.getWorldPosition(look);
    rig.legR.getWorldPosition(tmp);
    look.lerp(tmp, 0.5);
    look.y -= 0.1;
    dist = 1.4;
    fov = 32;
    lift = 0.04;
  } else {
    rig.shinL.getWorldPosition(look);
    rig.shinR.getWorldPosition(tmp);
    look.lerp(tmp, 0.5);
    look.y -= 0.3;
    dist = 0.88;
    fov = 36;
    lift = 0.2;
  }
  camera.fov = fov;
  camera.aspect = TW / TH;
  camera.near = 0.05;
  camera.far = 20;
  camera.position.set(look.x + 0.22, look.y + lift, look.z + dist);
  camera.lookAt(look);
  camera.updateProjectionMatrix();
}

function renderThumb(id: string): string | null {
  const hit = cache.get(id);
  if (hit) return hit;
  if (!ensure() || !renderer || !rig || !scene || !camera) return null;
  const item = EQUIP.find(e => e.id === id);
  if (!item) return null;
  const outfit = baseOutfit();
  outfit[item.slot] = item.id;
  applyOutfitToRig(rig, outfit);
  posePlazaHangArms(rig);
  rig.outer.position.set(0, 0, 0);
  rig.outer.rotation.set(0, Math.PI + 0.38, 0);
  frameSlot(item.slot);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  cache.set(id, url);
  return url;
}

function applyToEl(el: HTMLElement) {
  if (el.dataset.eqthumbDone) return;
  const id = el.dataset.eqthumb;
  if (!id) return;
  const url = renderThumb(id);
  if (!url) return;
  const svg = el.querySelector('svg');
  const w = Number(svg?.getAttribute('width') || 72);
  const h = Number(svg?.getAttribute('height') || 60);
  const img = document.createElement('img');
  img.className = 'slv';
  img.width = w;
  img.height = h;
  img.alt = '';
  img.draggable = false;
  img.src = url;
  el.replaceChildren(img);
  el.dataset.eqthumbDone = '1';
}

function tick() {
  const el = queue.shift();
  if (el) applyToEl(el);
  if (queue.length) requestAnimationFrame(tick);
  else ticking = false;
}

function enqueue(el: HTMLElement) {
  if (el.dataset.eqthumbDone || queue.includes(el)) return;
  queue.push(el);
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(tick);
  }
}

/** 把容器裡的 eqSvg 佔位換成 3D 縮圖（進畫面才畫，失敗就留舊圖示）。 */
export function hydrateEquipThumbs(root: ParentNode) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-eqthumb]'));
  if (!nodes.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    nodes.forEach(enqueue);
    return;
  }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io!.unobserve(e.target);
        enqueue(e.target as HTMLElement);
      }
    }, { root: null, rootMargin: '120px', threshold: 0.01 });
  }
  for (const el of nodes) {
    if (el.dataset.eqthumbDone) continue;
    io.observe(el);
  }
}
