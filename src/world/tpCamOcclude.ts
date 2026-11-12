/**
 * 第三人稱透視：僅當物件位在「鏡頭 → 玩家」之間時半透明。
 * 射線掃描節流（約 12Hz），透明度每幀插值；避免坐下環視時每幀全場 raycast 卡頓。
 */
import * as THREE from 'three';

const FADE_SPEED = 7;
const FADE_DEPTH = 0.82;
const MAX_HITS = 16;
const SCAN_GAP = 1 / 12;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

type MatSnap = {
  mat: THREE.Material & {
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    side: THREE.Side;
    needsUpdate: boolean;
  };
  depthWrite: boolean;
  side: THREE.Side;
  primed: boolean;
};

type FadeRec = { mesh: THREE.Mesh; snaps: MatSnap[]; k: number };

const ray = new THREE.Raycaster();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const dir = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const aim = new THREE.Vector3();
const faded = new Map<THREE.Mesh, FadeRec>();
const want = new Set<THREE.Mesh>();
const ignoreRoots: THREE.Object3D[] = [];
let scanAcc = SCAN_GAP;

const SKIP_NAME = new Set([
  'skyDome', 'sky', 'cigSmoke', 'charcoalFire', 'avatarCigarette', 'seatCushion',
  'shedRing', 'shedLock', 'shedWheel', 'mgFx', 'mgBullet', 'mgCasing', 'mgFlash',
  'plazaPad', 'worldLabel', 'handRig', 'petAnchor', 'plazaTpOcclude', 'plazaFloor',
]);

export function setTpCamOccludeIgnore(roots: THREE.Object3D[]) {
  ignoreRoots.length = 0;
  for (const r of roots) if (r) ignoreRoots.push(r);
}

function underIgnored(o: THREE.Object3D): boolean {
  for (const root of ignoreRoots) {
    let p: THREE.Object3D | null = o;
    while (p) {
      if (p === root) return true;
      p = p.parent;
    }
  }
  return false;
}

function skipObject(o: THREE.Object3D): boolean {
  if (underIgnored(o)) return true;
  if (o.userData?.skipTpOcclude || o.userData?.tpOcclude) return true;
  if ((o as THREE.Light).isLight) return true;
  if ((o as THREE.Sprite).isSprite) return true;
  if ((o as THREE.InstancedMesh).isInstancedMesh) return true;
  let p: THREE.Object3D | null = o;
  while (p) {
    if (p.userData?.skipTpOcclude || p.userData?.tpOcclude) return true;
    const n = p.name || '';
    if (SKIP_NAME.has(n)) return true;
    p = p.parent;
  }
  return false;
}

function isGroundHit(h: THREE.Intersection): boolean {
  if (h.point.y < 0.28) return true;
  const ny = h.normal ? h.normal.y : (h.face ? h.face.normal.y : 0);
  return ny > 0.55 && h.point.y < 0.55;
}

function prepareSnaps(mesh: THREE.Mesh): MatSnap[] | null {
  const cached = mesh.userData._tpOccSnaps as MatSnap[] | undefined;
  if (cached) return cached;
  const raw = mesh.material;
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  const snaps: MatSnap[] = [];
  const cloned: THREE.Material[] = [];
  for (const m of list) {
    if (!m || !('opacity' in m)) return null;
    const c = m.clone() as MatSnap['mat'];
    c.transparent = true;
    c.opacity = 1;
    c.side = THREE.DoubleSide;
    // 延後 needsUpdate：第一次真的淡化時才重編著色器，避免掃到新牆整批卡頓
    snaps.push({ mat: c, depthWrite: m.depthWrite !== false, side: m.side, primed: false });
    cloned.push(c);
  }
  mesh.material = Array.isArray(raw) ? cloned : cloned[0];
  mesh.userData._tpOccSnaps = snaps;
  return snaps;
}

function applyWallStyle(rec: FadeRec) {
  const op = 1 - rec.k * 0.8;
  for (const s of rec.snaps) {
    if (!s.primed && rec.k > 0.02) {
      s.mat.needsUpdate = true;
      s.primed = true;
    }
    s.mat.opacity = op;
    s.mat.transparent = true;
    s.mat.depthWrite = op > FADE_DEPTH;
    s.mat.side = THREE.DoubleSide;
  }
}

function restoreRec(rec: FadeRec) {
  for (const s of rec.snaps) {
    s.mat.opacity = 1;
    s.mat.transparent = true;
    s.mat.depthWrite = s.depthWrite;
    s.mat.side = s.side;
  }
}

export function clearTpCamOcclude() {
  for (const rec of faded.values()) {
    try { restoreRec(rec); } catch { /* */ }
  }
  faded.clear();
  want.clear();
  scanAcc = SCAN_GAP;
}

export function tickTpCamOcclude(
  dt: number,
  scene: THREE.Scene,
  camera: THREE.Camera,
  focus: THREE.Vector3,
  enabled: boolean,
) {
  try {
    tickInner(dt, scene, camera, focus, enabled);
  } catch (e) {
    console.error('tpCamOcclude', e);
    clearTpCamOcclude();
  }
}

function collectRoots(scene: THREE.Scene, camera: THREE.Camera): THREE.Object3D[] {
  const plaza = scene.getObjectByName('plazaWorld');
  if (plaza) return [plaza];
  const roots: THREE.Object3D[] = [];
  for (const c of scene.children) {
    if (c === camera || underIgnored(c)) continue;
    if ((c as THREE.Camera).isCamera) continue;
    roots.push(c);
  }
  return roots;
}

function addHits(roots: THREE.Object3D[], maxAdd: number) {
  if (maxAdd <= 0) return 0;
  const hits = ray.intersectObjects(roots, true);
  let n = 0;
  for (const h of hits) {
    if (n >= maxAdd) break;
    const mesh = h.object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) continue;
    if (skipObject(mesh)) continue;
    if (isGroundHit(h)) continue;
    if (!prepareSnaps(mesh)) continue;
    want.add(mesh);
    n++;
  }
  return n;
}

function castBundle(roots: THREE.Object3D[], a: THREE.Vector3, b: THREE.Vector3, left: number): number {
  dir.subVectors(b, a);
  const len = dir.length();
  if (len < 0.35) return left;
  dir.multiplyScalar(1 / len);
  right.crossVectors(dir, WORLD_UP).normalize();
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  up.crossVectors(right, dir).normalize();
  const offsets: [number, number][] = [
    [0, 0],
    [0.4, 0], [-0.4, 0],
    [0, 0.35],
  ];
  for (const [ox, oy] of offsets) {
    if (left <= 0) break;
    aim.copy(b).addScaledVector(right, ox).addScaledVector(up, oy);
    dir.subVectors(aim, a);
    const dlen = dir.length();
    if (dlen < 0.35) continue;
    dir.multiplyScalar(1 / dlen);
    ray.set(a, dir);
    ray.near = 0.08;
    ray.far = Math.max(0.05, dlen - 0.08);
    left -= addHits(roots, left);
  }
  return left;
}

function scanWant(scene: THREE.Scene, camera: THREE.Camera, focus: THREE.Vector3) {
  want.clear();
  from.copy(camera.position);
  to.copy(focus);
  if (from.distanceTo(to) < 0.35) return;
  const roots = collectRoots(scene, camera);
  let left = MAX_HITS;
  left = castBundle(roots, from, to, left);
  if (left > 0) castBundle(roots, to, from, left);
}

function tickInner(
  dt: number,
  scene: THREE.Scene,
  camera: THREE.Camera,
  focus: THREE.Vector3,
  enabled: boolean,
) {
  const kk = Math.min(1, dt * FADE_SPEED);
  if (!enabled) {
    want.clear();
    scanAcc = SCAN_GAP;
    if (!faded.size) return;
    for (const [mesh, rec] of [...faded]) {
      rec.k = Math.max(0, rec.k - kk);
      if (rec.k <= 0.001) { restoreRec(rec); faded.delete(mesh); }
      else applyWallStyle(rec);
    }
    return;
  }

  scanAcc += dt;
  if (scanAcc >= SCAN_GAP) {
    scanAcc = 0;
    scanWant(scene, camera, focus);
  }

  for (const mesh of want) {
    let rec = faded.get(mesh);
    if (!rec) {
      const snaps = mesh.userData._tpOccSnaps as MatSnap[] | undefined;
      if (!snaps) continue;
      rec = { mesh, snaps, k: 0 };
      faded.set(mesh, rec);
    }
    rec.k = Math.min(1, rec.k + kk);
    applyWallStyle(rec);
  }
  for (const [mesh, rec] of [...faded]) {
    if (want.has(mesh)) continue;
    rec.k = Math.max(0, rec.k - kk);
    if (rec.k <= 0.001) { restoreRec(rec); faded.delete(mesh); }
    else applyWallStyle(rec);
  }
}
