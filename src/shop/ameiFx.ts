/** 飼主被丟殼砸中後，阿妹慢半拍才在他頭上開傘（擋不住，殼已經打中） */
import * as THREE from 'three';

export const AMEI_ID = 'pt_amei';
/** 約半拍以後才開傘（殼已經打中） */
export const AMEI_UMB_DELAY = 0.38;
const OPEN = 0.16;
const HOLD = 1.15;
const CLOSE = 0.22;

function makeOverheadUmb(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ameiLateUmb';
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.48, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 }),
  );
  pole.position.y = 0.24;
  g.add(pole);
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.12, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xc45c4a, roughness: 0.7, side: THREE.DoubleSide }),
  );
  canopy.position.y = 0.46;
  canopy.name = 'canopy';
  g.add(canopy);
  g.userData.noMerge = true;
  g.visible = false;
  g.scale.setScalar(0.01);
  return g;
}

function beep(freq: number, dur = 0.08, vol = 0.08) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
    o.onended = () => { try { ac.close(); } catch { /* */ } };
  } catch { /* */ }
}

/**
 * 飼主被砸後，阿妹先縮一下，約 0.38 秒後才在飼主頭上撐開小傘，隨即收掉。
 * 這把傘不能擋殼，玩家照常受傷。回傳取消函式。
 */
export function playAmeiLateUmb(pet: THREE.Object3D, over: THREE.Object3D): () => void {
  const ud = pet.userData as { lateUmb?: THREE.Group; lateUmbStop?: () => void; body?: THREE.Object3D };
  ud.lateUmbStop?.();
  let umb = ud.lateUmb;
  if (!umb) umb = makeOverheadUmb();
  if (umb.parent && umb.parent !== over) umb.parent.remove(umb);
  if (umb.parent !== over) over.add(umb);
  ud.lateUmb = umb;
  const isCam = !!(over as THREE.Camera).isCamera;
  if (isCam) {
    umb.position.set(0, 0.2, -0.42);
    umb.rotation.set(-0.4, 0, 0);
  } else {
    umb.position.set(0, 0.32, 0);
    umb.rotation.set(0, 0, 0);
  }
  umb.visible = false;
  umb.scale.setScalar(0.01);

  const body = (ud.body as THREE.Object3D | undefined) ?? pet;
  const bodyY0 = body.position.y;
  const delay = AMEI_UMB_DELAY;
  const total = delay + OPEN + HOLD + CLOSE;
  let t = 0;
  let opened = false;
  let dead = false;

  const tick = (dt: number) => {
    if (dead) return false;
    t += dt;
    if (t < 0.22) {
      const k = Math.sin((t / 0.22) * Math.PI);
      body.position.y = bodyY0 - 0.025 * k;
      pet.rotation.z = -0.18 * k;
    } else {
      body.position.y = bodyY0;
      pet.rotation.z *= Math.max(0, 1 - dt * 8);
    }
    if (t >= delay) {
      if (!opened) {
        opened = true;
        umb!.visible = true;
        beep(880, 0.07, 0.07);
        beep(1320, 0.09, 0.05);
      }
      const u = t - delay;
      let s = 1;
      if (u < OPEN) s = 0.05 + 0.95 * (1 - (1 - u / OPEN) ** 2);
      else if (u < OPEN + HOLD) s = 1 + Math.sin((u - OPEN) * 14) * 0.04;
      else {
        const k = Math.min(1, (u - OPEN - HOLD) / CLOSE);
        s = Math.max(0.01, 1 - k);
      }
      umb!.scale.setScalar(s);
      umb!.rotation.z = (isCam ? 0 : 0) + Math.sin(t * 10) * 0.05;
    }
    if (t >= total) {
      umb!.visible = false;
      pet.rotation.z = 0;
      body.position.y = bodyY0;
      dead = true;
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

  const stop = () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    umb!.visible = false;
    pet.rotation.z = 0;
    body.position.y = bodyY0;
  };
  ud.lateUmbStop = stop;
  return stop;
}

export function isAmeiId(id: string | null | undefined): boolean {
  return id === AMEI_ID;
}
