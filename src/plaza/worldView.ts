import * as THREE from 'three';
import { makePlayerAvatar, type PlayerRig } from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { PILE_COUNT, SLOTS_PER_PILE, WALK_BOUND, pileCenter, seatPose, seatKey, type PlazaSeatRef } from './layout';
import type { PlazaPlayer, PlazaSnapshot } from './types';

type Remote = {
  key: string;
  rig: PlayerRig;
  tag: HTMLElement;
  pileId: number;
  slot: number;
  phase: string;
  count: number;
  nick: string;
  seated: boolean;
  moving: boolean;
  tx: number; tz: number; tyaw: number; // 目標
  x: number; z: number; yaw: number; // 插值中
  bob: number;
};

const SHIRTS = [0xc45c26, 0x3a6ea5, 0x2f7d4a, 0x8a3a6a, 0x6a5a2a, 0x4a4a7a];
const HAIRS = [0x222222, 0x555555, 0x888888, 0x3a2a1a, 0xdddddd];

export type PlazaWorldView = {
  root: THREE.Group;
  syncRoster: (snap: PlazaSnapshot, selfPid: string) => void;
  upsert: (p: PlazaPlayer, selfPid: string) => void;
  remove: (p: PlazaPlayer) => void;
  applyPose: (p: PlazaPlayer, selfPid: string) => void;
  setPhase: (p: PlazaPlayer) => void;
  highlight: (pileId: number | null, slot: number | null) => void;
  highlightNear: (seat: PlazaSeatRef | null) => void;
  tick: (dt: number, camera: THREE.Camera) => void;
  dispose: () => void;
};

export function createPlazaWorldView(scene: THREE.Scene, bubblesHost: HTMLElement, LO = false): PlazaWorldView {
  const root = new THREE.Group(); root.name = 'plazaWorld'; scene.add(root);
  const { M, add } = makeMeshHelpers(scene, LO);
  const remotes = new Map<string, Remote>();
  const seatMeshes = new Map<string, THREE.Mesh>();
  let nearKey: string | null = null;

  const floor = add(new THREE.PlaneGeometry(WALK_BOUND * 2.4, WALK_BOUND * 2.4), M(0x5e5e58, { roughness: 0.95 }), [0, 0.002, 0], root, false);
  floor.rotation.x = -Math.PI / 2;

  const shellM = M(0xd8d0c8, { roughness: 0.92 });
  for (let i = 0; i < PILE_COUNT; i++) {
    const g = new THREE.Group();
    const c = pileCenter(i);
    g.position.copy(c);
    const cone = add(new THREE.ConeGeometry(0.85, 0.7, 10), shellM, [0, 0.35, 0], g, true);
    cone.rotation.y = i * 0.3;
    for (let k = 0; k < 5; k++) {
      const bit = add(new THREE.SphereGeometry(0.12 + (k % 3) * 0.03, 6, 4), M(0xcfc6bc), [
        Math.sin(k * 1.7) * 0.35, 0.15 + (k % 2) * 0.08, Math.cos(k * 2.1) * 0.35,
      ], g, false);
      bit.scale.set(1.2, 0.7, 1);
    }
    for (let s = 0; s < SLOTS_PER_PILE; s++) {
      const pose = seatPose(i, s);
      const stool = add(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), M(0x3a7ac0), [0, 0.4, 0], root);
      stool.position.set(pose.pos.x, 0.4, pose.pos.z);
      const pad = add(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 10), M(0x5a9ad0, { transparent: true, opacity: 0.35 }), [0, 0.02, 0], root, false);
      pad.position.set(pose.pos.x, 0.02, pose.pos.z);
      seatMeshes.set(seatKey(i, s), pad);
    }
    root.add(g);
  }

  function hashLook(pid: string) {
    let h = 0; for (let i = 0; i < pid.length; i++) h = (h * 31 + pid.charCodeAt(i)) | 0;
    return { shirt: SHIRTS[Math.abs(h) % SHIRTS.length], hair: HAIRS[Math.abs(h >> 3) % HAIRS.length], pants: 0x2a2a40 };
  }

  function ensureTag(nick: string) {
    const tag = document.createElement('button');
    tag.className = 'ntag plazaTag';
    tag.textContent = nick;
    tag.style.pointerEvents = 'none';
    bubblesHost.appendChild(tag);
    return tag;
  }

  function poseSit(r: Remote) {
    r.rig.root.position.y = 0.05;
    r.rig.legL.rotation.x = -1.1; r.rig.legR.rotation.x = -1.1;
    r.rig.shinL.rotation.x = 1.2; r.rig.shinR.rotation.x = 1.2;
    r.rig.torso.rotation.x = 0.12;
  }

  function poseStand(r: Remote) {
    r.rig.root.position.y = 0;
    r.rig.legL.rotation.x = 0; r.rig.legR.rotation.x = 0;
    r.rig.shinL.rotation.x = 0; r.rig.shinR.rotation.x = 0;
    r.rig.torso.rotation.x = 0;
  }

  function applyActionPose(r: Remote) {
    const ph = r.phase;
    if (r.seated) {
      poseSit(r);
      // 剝蚵動作示意
      if (ph === 'twist' || ph === 'pry') {
        r.rig.head.rotation.x = 0.2;
        r.rig.upperR.rotation.x = -0.6; r.rig.lowerR.rotation.x = -0.4;
      } else if (ph === 'seam') {
        r.rig.head.rotation.x = 0.12;
        r.rig.upperR.rotation.x = -0.35;
      } else if (ph === 'aim' || ph === 'toss') {
        r.rig.upperL.rotation.x = -0.8;
        r.rig.head.rotation.x = -0.05;
      } else if (ph === 'scoop' || ph === 'pick') {
        r.rig.upperL.rotation.x = -0.5; r.rig.upperR.rotation.x = -0.3;
        r.rig.head.rotation.x = 0.1;
      } else {
        r.rig.head.rotation.x = 0.08;
        r.rig.upperL.rotation.x = 0; r.rig.upperR.rotation.x = 0;
        r.rig.lowerR.rotation.x = 0;
      }
    } else {
      poseStand(r);
      r.rig.head.rotation.x = 0;
      r.rig.upperL.rotation.x = 0; r.rig.upperR.rotation.x = 0;
    }
  }

  function ensure(p: PlazaPlayer, selfPid: string): Remote | null {
    if (!p || p.pid === selfPid) return null;
    const key = p.connId || p.pid;
    let r = remotes.get(key);
    if (!r) {
      const look = hashLook(p.pid || key);
      const rig = makePlayerAvatar(look, M, add, LO);
      root.add(rig.outer);
      const x = p.x ?? 0, z = p.z ?? 0, yaw = p.yaw ?? 0;
      r = {
        key, rig, tag: ensureTag(p.nick || '剝蚵人'),
        pileId: p.pileId, slot: p.slot, phase: p.phase, count: p.count, nick: p.nick,
        seated: !!p.seated, moving: !!p.moving,
        tx: x, tz: z, tyaw: yaw, x, z, yaw, bob: 0,
      };
      remotes.set(key, r);
    }
    return r;
  }

  function applyPose(p: PlazaPlayer, selfPid: string) {
    const r = ensure(p, selfPid); if (!r) return;
    r.pileId = p.pileId; r.slot = p.slot; r.phase = p.phase || r.phase; r.count = p.count ?? r.count;
    r.seated = !!p.seated; r.moving = !!p.moving;
    if (p.nick && p.nick !== r.nick) { r.nick = p.nick; }
    r.tag.textContent = r.seated ? `${r.nick} · ${r.count}` : r.nick;
    if (r.seated && p.pileId >= 0) {
      const pose = seatPose(p.pileId, p.slot);
      r.tx = pose.pos.x; r.tz = pose.pos.z; r.tyaw = pose.yaw;
      r.x = pose.pos.x; r.z = pose.pos.z; r.yaw = pose.yaw;
    } else {
      if (typeof p.x === 'number') r.tx = p.x;
      if (typeof p.z === 'number') r.tz = p.z;
      if (typeof p.yaw === 'number') r.tyaw = p.yaw;
    }
    applyActionPose(r);
    paintOcc();
  }

  function upsert(p: PlazaPlayer, selfPid: string) { applyPose(p, selfPid); }

  function remove(p: PlazaPlayer) {
    const key = p.connId || p.pid;
    const r = remotes.get(key);
    if (!r) return;
    root.remove(r.rig.outer); r.tag.remove(); remotes.delete(key);
    paintOcc();
  }

  function setPhase(p: PlazaPlayer) { applyPose(p, ''); }

  function syncRoster(snap: PlazaSnapshot, selfPid: string) {
    const alive = new Set<string>();
    for (const p of snap?.players ?? []) {
      if (p.pid === selfPid) continue;
      alive.add(p.connId || p.pid);
      applyPose(p, selfPid);
    }
    for (const [k, r] of [...remotes]) {
      if (!alive.has(k)) { root.remove(r.rig.outer); r.tag.remove(); remotes.delete(k); }
    }
    paintOcc(snap);
  }

  function paintOcc(snap?: PlazaSnapshot) {
    const taken = new Set<string>();
    if (snap) for (const p of snap.players) { if (p.seated && p.pileId >= 0) taken.add(seatKey(p.pileId, p.slot)); }
    else for (const r of remotes.values()) { if (r.seated && r.pileId >= 0) taken.add(seatKey(r.pileId, r.slot)); }
    for (const [k, m] of seatMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const busy = taken.has(k);
      mat.color.setHex(busy ? 0xc45c26 : 0x5a9ad0);
      mat.opacity = busy ? 0.55 : 0.28;
    }
  }

  function highlight(pileId: number | null, slot: number | null) {
    nearKey = pileId != null && slot != null ? seatKey(pileId, slot) : null;
    for (const [k, m] of seatMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat.emissive) continue;
      const mine = nearKey != null && k === nearKey;
      mat.emissive.setHex(mine ? 0x336610 : 0x000000);
      if (mine) mat.opacity = 0.75;
    }
  }

  function highlightNear(seat: PlazaSeatRef | null) {
    highlight(seat?.pileId ?? null, seat?.slot ?? null);
  }

  const _v = new THREE.Vector3();
  function tick(dt: number, camera: THREE.Camera) {
    const k = Math.min(1, dt * 10);
    for (const r of remotes.values()) {
      r.x += (r.tx - r.x) * k;
      r.z += (r.tz - r.z) * k;
      let dy = r.tyaw - r.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      r.yaw += dy * k;
      if (!r.seated && r.moving) {
        r.bob += dt * 10;
        const swing = Math.sin(r.bob) * 0.55;
        r.rig.legL.rotation.x = swing; r.rig.legR.rotation.x = -swing;
        r.rig.shinL.rotation.x = Math.max(0, -swing * 0.5); r.rig.shinR.rotation.x = Math.max(0, swing * 0.5);
        r.rig.root.position.y = Math.abs(Math.sin(r.bob * 2)) * 0.03;
      } else if (!r.seated) {
        r.rig.legL.rotation.x *= 0.8; r.rig.legR.rotation.x *= 0.8;
        r.rig.root.position.y *= 0.8;
      }
      r.rig.outer.position.set(r.x, 0, r.z);
      r.rig.outer.rotation.y = r.yaw;
      _v.set(r.x, r.seated ? 1.35 : 1.7, r.z).project(camera);
      const x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight;
      const behind = _v.z > 1;
      r.tag.style.display = behind ? 'none' : '';
      r.tag.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    }
  }

  function dispose() {
    for (const r of remotes.values()) { root.remove(r.rig.outer); r.tag.remove(); }
    remotes.clear();
    scene.remove(root);
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[]; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose?.(); }
    });
  }

  return { root, syncRoster, upsert, remove, applyPose, setPhase, highlight, highlightNear, tick, dispose };
}

export function tickPlazaTags(view: PlazaWorldView | null, camera: THREE.Camera, dt = 0.016) {
  if (!view) return;
  view.tick(dt, camera);
}
