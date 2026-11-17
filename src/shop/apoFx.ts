/** 阿珀貓拳：超長貓掌從阿珀伸到阿婆，命中顯示「啪」，空碗再嫌棄地甩爪 */
import * as THREE from 'three';
import { makeWorldLabel } from '../world/worldLabel';

export type ApoPunchOpts = {
  empty?: boolean;
  /** 命中後爪子帶一顆偷來的蚵仔，出拳結束或中斷時一定摘掉（遠端同步用） */
  carryMeat?: boolean;
  onHit?: () => void;
  onDone?: () => void;
  /** 爪子掛到場景，不跟被藏起來的寵物一起消失；仍每幀從肩膀世界座標伸到目標 */
  worldSpace?: boolean;
};

const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

function makePaw(): THREE.Group {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x8d7358, roughness: 0.62, metalness: 0.04 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.62, metalness: 0.04 });
  const pad = new THREE.MeshStandardMaterial({ color: 0xc9898a, roughness: 0.45, metalness: 0.02 });
  const claw = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4, metalness: 0.05 });
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 1, 8), fur);
  arm.position.y = 0.5;
  g.add(arm);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.08, 8), stripe);
  ring.position.y = 0.62;
  g.add(ring);
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), fur);
  paw.scale.set(1.15, 0.7, 1.25);
  paw.position.y = 1.02;
  g.add(paw);
  const bean = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), pad);
  bean.scale.set(1.3, 0.5, 1.1);
  bean.position.set(0, 1.0, 0.04);
  g.add(bean);
  for (const x of [-0.028, 0, 0.028]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 6), claw);
    c.position.set(x, 1.06, 0.04);
    c.rotation.x = Math.PI;
    g.add(c);
  }
  g.userData.noMerge = true;
  return g;
}

function slapBeep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(220, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ac.currentTime + 0.08);
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.16);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.16);
    o.onended = () => { try { ac.close(); } catch { /* */ } };
  } catch { /* 靜音或鎖定時略過 */ }
}

/**
 * 貓拳從阿珀肩膀連出去，一直伸到阿婆再縮回。爪子掛在 anchor（肩膀）上，不會脫節。
 * empty：打空碗，縮回後再嫌棄地甩爪。
 * to 可每幀重算，阿婆移動時仍連在身上。
 */
export function playApoPunch(
  anchor: THREE.Object3D,
  to: THREE.Vector3 | (() => THREE.Vector3),
  opts: ApoPunchOpts = {},
): () => void {
  const paw = makePaw();
  const worldSpace = !!opts.worldSpace;
  const root = sceneRoot(anchor);
  if (worldSpace) {
    paw.frustumCulled = false;
    paw.traverse(o => { o.frustumCulled = false; });
    root.add(paw);
  } else {
    anchor.add(paw);
  }
  const hitAt = 0.28;
  const hold = 0.12;
  const retract = 0.22;
  const shake = opts.empty ? 0.45 : 0;
  const total = hitAt + hold + retract + shake;
  let t = 0;
  let hit = false;
  let meat: THREE.Mesh | null = null;
  const carryMeat = !!opts.carryMeat && !opts.empty;
  let label: ReturnType<typeof makeWorldLabel> | null = null;
  let labelT = 0;
  let dead = false;
  const _to = new THREE.Vector3();
  const _from = new THREE.Vector3();
  const _local = new THREE.Vector3();
  const _inv = new THREE.Matrix4();
  let restLen = 0.22;

  const worldTo = () => {
    const v = typeof to === 'function' ? to() : to;
    _to.copy(v);
    return _to;
  };

  const place = (reach: number, wag = 0) => {
    anchor.updateWorldMatrix(true, false);
    if (worldSpace) {
      anchor.getWorldPosition(_from);
      _local.copy(worldTo()).sub(_from);
    } else {
      _inv.copy(anchor.matrixWorld).invert();
      _local.copy(worldTo()).applyMatrix4(_inv);
    }
    const len = Math.max(0.12, _local.length());
    const use = Math.min(reach, len);
    if (len > 1e-4) _local.multiplyScalar(1 / len);
    else _local.set(0, 0, -1);
    _quat.setFromUnitVectors(_up, _local);
    if (worldSpace) paw.position.copy(_from);
    else paw.position.set(0, 0, 0);
    paw.quaternion.copy(_quat);
    if (wag) paw.rotateZ(wag);
    paw.scale.set(1, use, 1);
    if (meat) {
      if (meat.parent !== paw) paw.add(meat);
      meat.position.set(0, 1.02, 0.07);
      // 手臂用 scale.y 拉長，蚵仔要反縮才不會被拉成一條
      meat.scale.set(1, 1 / Math.max(0.08, use), 1);
    }
  };

  const tick = (dt: number) => {
    if (dead) return false;
    t += dt;
    anchor.updateWorldMatrix(true, false);
    anchor.getWorldPosition(_from);
    const dist = Math.max(0.35, _from.distanceTo(worldTo()));
    if (t <= hitAt) {
      const k = t / hitAt;
      const e = 1 - (1 - k) * (1 - k);
      place(restLen + (dist - restLen) * e);
    } else if (t <= hitAt + hold) {
      place(dist);
      if (!hit) {
        hit = true;
        slapBeep();
        label = makeWorldLabel('啪', 'bubble', { worldH: 0.32 });
        label.setOpacity(1);
        label.sprite.position.copy(worldTo()).y += 0.18;
        root.add(label.sprite);
        labelT = 0.55;
        if (carryMeat && !meat) meat = makeStealMeat();
        try { opts.onHit?.(); } catch { /* */ }
      }
    } else if (t <= hitAt + hold + retract) {
      const k = (t - hitAt - hold) / retract;
      const reach = dist + (restLen - dist) * k;
      const wag = opts.empty && k > 0.55 ? Math.sin(k * 18) * 0.35 : 0;
      place(reach, wag);
    } else if (opts.empty && t <= total) {
      const k = (t - hitAt - hold - retract) / shake;
      place(restLen, Math.sin(k * 22) * 0.7 * (1 - k));
    } else {
      place(restLen);
    }
    if (label) {
      labelT -= dt;
      label.sprite.position.copy(worldTo()).y += 0.18 + (0.55 - Math.max(0, labelT)) * 0.25;
      if (labelT <= 0) {
        label.sprite.parent?.remove(label.sprite);
        try { label.dispose(); } catch { /* */ }
        label = null;
      }
    }
    if (t >= total && !label) {
      disposeStealMeat(meat); meat = null;
      paw.parent?.remove(paw);
      dead = true;
      try { opts.onDone?.(); } catch { /* */ }
      return false;
    }
    return true;
  };

  let prev = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    if (tick(dt)) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    disposeStealMeat(meat); meat = null;
    paw.parent?.remove(paw);
    if (label) {
      label.sprite.parent?.remove(label.sprite);
      try { label.dispose(); } catch { /* */ }
    }
  };
}

function makeStealMeat() {
  const geo = new THREE.SphereGeometry(0.035, 8, 6);
  geo.scale(1.4, 0.6, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.3, metalness: 0.1 });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.apoSteal = true;
  return m;
}

function disposeStealMeat(m: THREE.Mesh | null) {
  if (!m) return;
  m.parent?.remove(m);
  try { m.geometry.dispose(); } catch { /* */ }
  const mat = m.material;
  if (Array.isArray(mat)) mat.forEach(x => { try { x.dispose(); } catch { /* */ } });
  else if (mat) { try { mat.dispose(); } catch { /* */ } }
}

function sceneRoot(o: THREE.Object3D) {
  let p: THREE.Object3D = o;
  while (p.parent) p = p.parent;
  return p;
}

/** 頭晃：把剩餘秒數寫進 userData.apoHit，由呼叫端每幀疊加旋轉 */
export function apoHitSeconds(): number { return 0.85; }
