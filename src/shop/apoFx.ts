/** 阿珀貓拳：超長貓掌從阿珀伸到阿婆，命中顯示「啪」，空碗再嫌棄地甩爪 */
import * as THREE from 'three';
import { makeWorldLabel } from '../world/worldLabel';

export type ApoPunchOpts = {
  empty?: boolean;
  onHit?: () => void;
  onDone?: () => void;
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
  anchor.add(paw);
  const hitAt = 0.28;
  const hold = 0.12;
  const retract = 0.22;
  const shake = opts.empty ? 0.45 : 0;
  const total = hitAt + hold + retract + shake;
  let t = 0;
  let hit = false;
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
    _inv.copy(anchor.matrixWorld).invert();
    _local.copy(worldTo()).applyMatrix4(_inv);
    const len = Math.max(0.12, _local.length());
    const use = Math.min(reach, len);
    if (len > 1e-4) _local.multiplyScalar(1 / len);
    else _local.set(0, 0, -1);
    _quat.setFromUnitVectors(_up, _local);
    paw.position.set(0, 0, 0);
    paw.quaternion.copy(_quat);
    if (wag) paw.rotateZ(wag);
    paw.scale.set(1, use, 1);
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
        const root = sceneRoot(anchor);
        label = makeWorldLabel('啪', 'bubble', { worldH: 0.32 });
        label.setOpacity(1);
        label.sprite.position.copy(worldTo()).y += 0.18;
        root.add(label.sprite);
        labelT = 0.55;
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
      anchor.remove(paw);
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
    anchor.remove(paw);
    if (label) {
      label.sprite.parent?.remove(label.sprite);
      try { label.dispose(); } catch { /* */ }
    }
  };
}

function sceneRoot(o: THREE.Object3D) {
  let p: THREE.Object3D = o;
  while (p.parent) p = p.parent;
  return p;
}

/** 頭晃：把剩餘秒數寫進 userData.apoHit，由呼叫端每幀疊加旋轉 */
export function apoHitSeconds(): number { return 0.85; }
