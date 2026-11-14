import * as THREE from 'three';
import { makePlayerAvatar, posePlazaHangArms, type PlayerRig } from '../dm/character';
import { rebuildAvatarMerged, NO_MERGE } from '../dm/avatarMerge';
import { makeMeshHelpers } from '../dm/mesh';
import { applyOutfitToRig, type OutfitIds } from './equipVisual';
import { EQUIP, isNoneId, type Slot } from './shopEquip';

/** 商店／衣櫃卡片的 3D 縮圖：共用一台離屏 renderer，依 id 快取 dataURL。只畫該件裝備本身。 */
const TW = 160;
const TH = 160;
const cache = new Map<string, string>();
let failed = false;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rig: PlayerRig | null = null;
const look = new THREE.Vector3();
const tmp = new THREE.Vector3();
const box = new THREE.Box3();
const meshBox = new THREE.Box3();
const queue: HTMLElement[] = [];
let ticking = false;
let io: IntersectionObserver | null = null;

function baseOutfit(slot: Slot, id: string): OutfitIds {
  return {
    hair: slot === 'hair' ? id : 'hr_basic',
    head: slot === 'head' ? id : 'hd_none',
    hand: slot === 'hand' ? id : 'hn_none',
    body: slot === 'body' ? id : 'bd_basic',
    legs: slot === 'legs' ? id : 'lg_basic',
    feet: slot === 'feet' ? id : 'ft_none',
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
    // 縮圖不需要合併網格，才好隱藏身體、只留下裝備
    av.outer.userData[NO_MERGE] = true;
    av.outer.traverse(o => { o.visible = true; });
    rebuildAvatarMerged(av);
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

function isMesh(o: THREE.Object3D): o is THREE.Mesh {
  return (o as THREE.Mesh).isMesh === true;
}

function matOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function under(o: THREE.Object3D, roots: THREE.Object3D[]) {
  let p: THREE.Object3D | null = o;
  while (p) {
    if (roots.includes(p)) return true;
    p = p.parent;
  }
  return false;
}

function hideObj(o?: THREE.Object3D | null) {
  if (o) o.visible = false;
}

function hideByMats(root: THREE.Object3D | undefined, mats: THREE.Material[]) {
  if (!root || !mats.length) return;
  const set = new Set(mats);
  root.traverse(o => {
    if (!isMesh(o)) return;
    if (matOf(o).some(m => set.has(m))) o.visible = false;
  });
}

function hideMeshesExceptUnder(root: THREE.Object3D, keep: THREE.Object3D[]) {
  const alive = keep.filter(Boolean);
  root.traverse(o => {
    if (!isMesh(o)) return;
    if (alive.length && under(o, alive)) return;
    o.visible = false;
  });
}

function isolateSlot(slot: Slot, itemId: string) {
  if (!rig) return;
  rig.outer.traverse(o => { o.visible = true; });
  hideObj(rig.weaponMount);
  hideObj(rig.handL);
  hideObj(rig.handR);

  const bodyDet = rig.torso.userData.eqBodyDet as THREE.Object3D | undefined;
  const bodyMats = rig.outfitMats.body;
  const legMats = rig.outfitMats.legs;
  const feetMats = rig.outfitMats.feet;

  if (slot === 'hair') {
    const keep: THREE.Object3D[] = [];
    const hairDet = rig.head.userData.eqHairDet as THREE.Object3D | undefined;
    if (hairDet) keep.push(hairDet);
    if (itemId !== 'hr_none') rig.head.traverse(o => { if (o.userData.baseHair) keep.push(o); });
    hideMeshesExceptUnder(rig.outer, keep);
    return;
  }

  if (slot === 'head') {
    hideMeshesExceptUnder(rig.outer, rig.hatG ? [rig.hatG] : []);
    return;
  }

  if (slot === 'body') {
    const keep = bodyDet ? [bodyDet] : [];
    // 花襯衫短袖掛在上臂，縮圖要一起拍
    if (itemId === 'bd_hawaii') {
      if (rig.upperL) keep.push(rig.upperL);
      if (rig.upperR) keep.push(rig.upperR);
    }
    const bikini = itemId === 'bd_bikini';
    const limb = [rig.head, rig.upperL, rig.lowerL, rig.upperR, rig.lowerR, rig.legL, rig.legR].filter(Boolean) as THREE.Object3D[];
    rig.outer.traverse(o => {
      if (!isMesh(o)) return;
      if (under(o, keep)) return;
      if (under(o, limb)) { o.visible = false; return; }
      if (!bikini && matOf(o).some(m => bodyMats.includes(m as THREE.MeshStandardMaterial))) return;
      o.visible = false;
    });
    return;
  }

  if (slot === 'hand') {
    hideMeshesExceptUnder(rig.outer, [rig.upperR, rig.lowerR].filter(Boolean));
    return;
  }

  if (slot === 'legs') {
    const keep = [rig.legL, rig.legR].filter(Boolean);
    const hipHost = [rig.torso];
    const headHost = [rig.head];
    rig.outer.traverse(o => {
      if (!isMesh(o)) return;
      if (under(o, keep)) return;
      if (matOf(o).some(m => legMats.includes(m as THREE.MeshStandardMaterial)) && under(o, hipHost) && !under(o, headHost)) return;
      o.visible = false;
    });
    hideByMats(rig.shinL, feetMats);
    hideByMats(rig.shinR, feetMats);
    return;
  }

  // 鞋子只拍右腳，比較大、也比較看得清楚
  hideMeshesExceptUnder(rig.outer, rig.shinR ? [rig.shinR] : []);
  hideByMats(rig.shinR, legMats);
}

function visibleWorldBox(root: THREE.Object3D, out: THREE.Box3) {
  out.makeEmpty();
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!isMesh(o) || !o.geometry) return;
    let p: THREE.Object3D | null = o;
    while (p) {
      if (!p.visible) return;
      p = p.parent;
    }
    o.geometry.computeBoundingBox();
    if (!o.geometry.boundingBox || o.geometry.boundingBox.isEmpty()) return;
    meshBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    out.union(meshBox);
  });
  return out;
}

function frameVisible(slot: Slot) {
  if (!rig || !camera) return;
  visibleWorldBox(rig.outer, box);
  if (box.isEmpty()) {
    camera.position.set(0.28, 1.1, 1.6);
    camera.lookAt(0, 1.0, 0);
    camera.updateProjectionMatrix();
    return;
  }
  box.getCenter(look);
  box.getSize(tmp);
  const maxDim = Math.max(tmp.x, tmp.y, tmp.z, 0.08);
  const fov = slot === 'feet' ? 32 : 34;
  camera.fov = fov;
  camera.aspect = TW / TH;
  camera.near = 0.08;
  camera.far = 20;
  const pad = slot === 'feet' || slot === 'head' || slot === 'hair' ? 1.28 : 1.36;
  const dist = (maxDim * 0.5 * pad) / Math.tan((fov * Math.PI / 180) / 2);
  if (slot === 'feet') camera.position.set(look.x + dist * 0.18, look.y + dist * 0.78, look.z + dist * 0.66);
  else if (slot === 'head' || slot === 'hair') camera.position.set(look.x + dist * 0.2, look.y + dist * 0.28, look.z + dist * 0.96);
  else camera.position.set(look.x + dist * 0.32, look.y + dist * 0.14, look.z + dist * 0.96);
  camera.lookAt(look);
  camera.updateProjectionMatrix();
}

/** 髮型幾何大改時遞增，避免縮圖快取還是舊拼湊版 */
const THUMB_V = 4;

function renderThumb(id: string): string | null {
  const key = `${id}@${THUMB_V}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (isNoneId(id)) return null;
  if (!ensure() || !renderer || !rig || !scene || !camera) return null;
  const item = EQUIP.find(e => e.id === id);
  if (!item) return null;
  applyOutfitToRig(rig, baseOutfit(item.slot, item.id));
  posePlazaHangArms(rig);
  rig.outer.position.set(0, 0, 0);
  rig.outer.rotation.set(0, Math.PI + 0.42, 0);
  isolateSlot(item.slot, item.id);
  frameVisible(item.slot);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  cache.set(key, url);
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
