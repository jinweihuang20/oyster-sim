import * as THREE from 'three';
import { makePlayerAvatar, type PlayerRig } from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { PILE_COUNT, SLOTS_PER_PILE, pileCenter, seatPose, seatKey } from './layout';
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
};

const SHIRTS = [0xc45c26, 0x3a6ea5, 0x2f7d4a, 0x8a3a6a, 0x6a5a2a, 0x4a4a7a];
const HAIRS = [0x222222, 0x555555, 0x888888, 0x3a2a1a, 0xdddddd];

export type PlazaWorldView = {
  root: THREE.Group;
  syncRoster: (snap: PlazaSnapshot, selfPid: string) => void;
  upsert: (p: PlazaPlayer, selfPid: string) => void;
  remove: (p: PlazaPlayer) => void;
  setPhase: (p: PlazaPlayer) => void;
  highlight: (pileId: number | null, slot: number | null) => void;
  dispose: () => void;
};

export function createPlazaWorldView(scene: THREE.Scene, bubblesHost: HTMLElement, LO = false): PlazaWorldView {
  const root = new THREE.Group(); root.name = 'plazaWorld'; scene.add(root);
  const { M, add } = makeMeshHelpers(scene, LO);
  const remotes = new Map<string, Remote>();
  const seatMeshes = new Map<string, THREE.Mesh>();
  const pileMats: THREE.MeshStandardMaterial[] = [];

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
    const label = document.createElement('div');
    // 座位標記
    for (let s = 0; s < SLOTS_PER_PILE; s++) {
      const pose = seatPose(i, s);
      const stool = add(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), M(0x3a7ac0), [0, 0.4, 0], root);
      stool.position.set(pose.pos.x, 0.4, pose.pos.z);
      const pad = add(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 10), M(0x5a9ad0, { transparent: true, opacity: 0.35 }), [0, 0.02, 0], root, false);
      pad.position.set(pose.pos.x, 0.02, pose.pos.z);
      seatMeshes.set(seatKey(i, s), pad);
    }
    root.add(g);
    void label;
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

  function placeRemote(r: Remote) {
    const pose = seatPose(r.pileId, r.slot);
    r.rig.outer.position.set(pose.pos.x, 0, pose.pos.z);
    r.rig.outer.rotation.y = pose.yaw;
    r.rig.root.position.y = 0.05;
    // 簡易坐姿：腿彎
    r.rig.legL.rotation.x = -1.1; r.rig.legR.rotation.x = -1.1;
    r.rig.shinL.rotation.x = 1.2; r.rig.shinR.rotation.x = 1.2;
    r.rig.torso.rotation.x = 0.12;
  }

  function upsert(p: PlazaPlayer, selfPid: string) {
    if (!p || p.pid === selfPid || p.pileId < 0) return;
    const key = p.connId || seatKey(p.pileId, p.slot);
    let r = remotes.get(key);
    if (!r) {
      const look = hashLook(p.pid || key);
      const rig = makePlayerAvatar(look, M, add, LO);
      root.add(rig.outer);
      r = { key, rig, tag: ensureTag(p.nick || '剝蚵人'), pileId: p.pileId, slot: p.slot, phase: p.phase, count: p.count, nick: p.nick };
      remotes.set(key, r);
    } else {
      r.pileId = p.pileId; r.slot = p.slot; r.phase = p.phase; r.count = p.count;
      if (p.nick && p.nick !== r.nick) { r.nick = p.nick; r.tag.textContent = p.nick; }
    }
    placeRemote(r);
    paintOcc();
  }

  function remove(p: PlazaPlayer) {
    const key = p.connId || seatKey(p.pileId, p.slot);
    const r = remotes.get(key);
    if (!r) return;
    root.remove(r.rig.outer); r.tag.remove(); remotes.delete(key);
    paintOcc();
  }

  function setPhase(p: PlazaPlayer) {
    const key = p.connId;
    const r = remotes.get(key);
    if (!r) { upsert(p, ''); return; }
    r.phase = p.phase; r.count = p.count;
    r.tag.textContent = `${r.nick} · ${r.count}`;
    // 輕動畫：busy 時微點頭
    r.rig.head.rotation.x = p.phase === 'twist' || p.phase === 'seam' ? 0.15 : 0;
  }

  function syncRoster(snap: PlazaSnapshot, selfPid: string) {
    const alive = new Set<string>();
    for (const p of snap?.players ?? []) {
      if (p.pid === selfPid) continue;
      alive.add(p.connId);
      upsert(p, selfPid);
    }
    for (const [k, r] of [...remotes]) {
      if (!alive.has(k)) { root.remove(r.rig.outer); r.tag.remove(); remotes.delete(k); }
    }
    paintOcc(snap);
  }

  function paintOcc(snap?: PlazaSnapshot) {
    const taken = new Set<string>();
    if (snap) for (const p of snap.players) taken.add(seatKey(p.pileId, p.slot));
    else for (const r of remotes.values()) taken.add(seatKey(r.pileId, r.slot));
    for (const [k, m] of seatMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const busy = taken.has(k);
      mat.color.setHex(busy ? 0xc45c26 : 0x5a9ad0);
      mat.opacity = busy ? 0.55 : 0.28;
    }
  }

  function highlight(pileId: number | null, slot: number | null) {
    for (const [k, m] of seatMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const mine = pileId != null && slot != null && k === seatKey(pileId, slot);
      if (mine) { mat.emissive?.setHex(0x224400); mat.opacity = 0.7; }
      else if (mat.emissive) mat.emissive.setHex(0x000000);
    }
  }

  // 每幀更新名牌螢幕位置（由外部 tick 呼叫也可；這裡用簡易 billboard via CSS in main tick）
  const _v = new THREE.Vector3();
  function tickTags(camera: THREE.Camera) {
    for (const r of remotes.values()) {
      _v.set(r.rig.outer.position.x, 1.55, r.rig.outer.position.z).project(camera);
      const x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight;
      const behind = _v.z > 1;
      r.tag.style.display = behind ? 'none' : '';
      r.tag.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    }
  }
  (root as any).tickTags = tickTags;

  function dispose() {
    for (const r of remotes.values()) { root.remove(r.rig.outer); r.tag.remove(); }
    remotes.clear();
    scene.remove(root);
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[]; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose?.(); }
    });
    pileMats.length = 0;
  }

  return { root, syncRoster, upsert, remove, setPhase, highlight, dispose };
}

export function tickPlazaTags(view: PlazaWorldView | null, camera: THREE.Camera) {
  if (!view) return;
  const fn = (view.root as any).tickTags as ((c: THREE.Camera) => void) | undefined;
  fn?.(camera);
}
