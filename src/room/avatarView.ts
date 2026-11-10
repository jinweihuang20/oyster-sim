import * as THREE from 'three';
import { applyOutfitToRig, normalizeOutfitIds, outfitKey } from '../shop/equipVisual';
import { pickAmaLook, amaShirtHex, dressPlazaAma, applyAmaAppearance } from '../plaza/amaLook';
import {
  makePlayerAvatar, posePlazaHangArms, posePlazaWalkSwingArms, posePlazaWalkCycle, posePlazaJump,
  posePlazaSit, posePlazaStand, posePlazaCarried, posePlazaCarryHold, applyPlazaBodyPose, type PlayerRig,
} from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { makeWorldLabel, type WorldLabel } from '../world/worldLabel';
import { roomPhysicalSeats, roomSeatPose } from './seats';
import type { RoomBody } from './types';

type Remote = {
  key: string;
  connId: string;
  pid: string;
  rig: PlayerRig;
  tag: WorldLabel;
  isNpc: boolean;
  seated: boolean;
  moving: boolean;
  phase: string;
  meat: number;
  tx: number; tz: number; tyaw: number;
  x: number; z: number; yaw: number;
  lookYaw: number; tLookYaw: number;
  carriedBy: string;
  bob: number;
};

export function createRoomAvatarView(scene: THREE.Scene, selfPid: () => string) {
  const root = new THREE.Group();
  root.name = 'roomAvatars';
  scene.add(root);
  const { M, add } = makeMeshHelpers(scene, false);
  const remotes = new Map<string, Remote>();
  const stools: THREE.Group[] = [];
  let stoolTotal = 0;

  function makeStool() {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), M(0x3a7ac0));
    top.position.y = 0.4;
    g.add(top);
    for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), M(0x2a5a90));
      leg.position.set(x, 0.2, z);
      g.add(leg);
    }
    root.add(g);
    return g;
  }

  function layoutStools(humanSeats: number, npcCount: number) {
    const total = roomPhysicalSeats(humanSeats, npcCount);
    while (stools.length < total) stools.push(makeStool());
    stools.forEach((g, i) => {
      if (i >= total) { g.visible = false; return; }
      const p = roomSeatPose(i, total);
      g.visible = true;
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.yaw;
    });
    stoolTotal = total;
  }

  function occupiedSlots(bodies: RoomBody[]) {
    const taken = new Set<number>();
    for (const b of bodies) if (b.seat >= 0) taken.add(b.seat);
    return taken;
  }

  function hashLook(pid: string, isNpc: boolean) {
    return pickAmaLook(pid + (isNpc ? ':npc' : ''));
  }

  function ensure(b: RoomBody): Remote {
    const key = b.pid || b.connId;
    let r = remotes.get(key);
    if (r) {
      r.connId = b.connId;
      return r;
    }
    const look = hashLook(key, b.isNpc);
    const pal = { shirt: amaShirtHex(look), hair: look.hair, pants: look.pants };
    const rig = makePlayerAvatar(pal, M, add, false, b.isNpc);
    if (b.isNpc) { dressPlazaAma(rig, look); applyAmaAppearance(rig); }
    else {
      applyOutfitToRig(rig, normalizeOutfitIds({
        head: b.head, hand: b.hand, body: b.body, legs: b.legs, feet: b.feet,
      }));
    }
    root.add(rig.outer);
    const tag = makeWorldLabel(b.isNpc ? b.nick : `${b.nick}${b.tag ? ' #' + b.tag : ''}`, 'name', { worldH: 0.28, depthTest: false, nameTone: b.isNpc ? 'npc' : 'player' });
    root.add(tag.sprite);
    r = {
      key, connId: b.connId, pid: b.pid, rig, tag, isNpc: b.isNpc,
      seated: b.seated, moving: b.moving, phase: b.phase, meat: b.meat,
      tx: b.x, tz: b.z, tyaw: b.yaw, x: b.x, z: b.z, yaw: b.yaw,
      lookYaw: b.lookYaw, tLookYaw: b.lookYaw, carriedBy: b.carriedBy, bob: 0,
    };
    remotes.set(key, r);
    return r;
  }

  function applyPose(b: RoomBody) {
    if (b.pid && b.pid === selfPid()) return;
    const r = ensure(b);
    r.connId = b.connId;
    r.pid = b.pid;
    r.isNpc = b.isNpc;
    r.seated = b.seated;
    r.moving = b.moving;
    r.phase = b.phase;
    r.meat = b.meat;
    r.carriedBy = b.carriedBy;
    r.tx = b.x; r.tz = b.z; r.tyaw = b.yaw; r.tLookYaw = b.lookYaw;
    if (!b.isNpc) {
      const next = normalizeOutfitIds({ head: b.head, hand: b.hand, body: b.body, legs: b.legs, feet: b.feet });
      if (r.rig.outfitKey !== outfitKey(next)) applyOutfitToRig(r.rig, next);
    }
    const label = b.isNpc ? `${b.nick}${b.seated && b.meat ? '・' + b.meat + ' 顆' : ''}` : `${b.nick}${b.tag ? ' #' + b.tag : ''}${b.meat ? '・' + b.meat + ' 顆' : ''}`;
    r.tag.setText(label);
  }

  function applyBodies(bodies: RoomBody[]) {
    const keep = new Set<string>();
    for (const b of bodies) {
      if (b.pid && b.pid === selfPid()) continue;
      const key = b.pid || b.connId;
      keep.add(key);
      applyPose(b);
    }
    for (const [k, r] of [...remotes]) {
      if (keep.has(k)) continue;
      r.rig.outer.removeFromParent();
      r.tag.sprite.removeFromParent();
      remotes.delete(k);
    }
  }

  function poseOf(r: Remote, t: number) {
    const carried = !!r.carriedBy;
    if (carried) {
      posePlazaCarried(r.rig);
      return;
    }
    if (r.seated) {
      posePlazaSit(r.rig);
      posePlazaHangArms(r.rig, true);
      const peel = /pick|seam|twist|empty|aim/.test(r.phase);
      if (peel) r.rig.head.rotation.x = -0.25 + Math.sin(t * 3 + r.bob) * 0.04;
      return;
    }
    if (r.phase === 'jump') {
      posePlazaJump(r.rig, 0.4);
      return;
    }
    if (r.phase === 'crouch' || r.phase === 'lie') {
      applyPlazaBodyPose(r.rig, r.phase === 'lie' ? 'lie' : 'crouch', 1);
      return;
    }
    if (r.moving) {
      r.bob += 0.18;
      posePlazaWalkCycle(r.rig, r.bob, 0.45);
      posePlazaWalkSwingArms(r.rig, r.bob);
    } else {
      posePlazaStand(r.rig);
      posePlazaHangArms(r.rig, false);
    }
  }

  function tick(dt: number) {
    const t = performance.now() / 1000;
    for (const r of remotes.values()) {
      const k = Math.min(1, dt * 10);
      r.x += (r.tx - r.x) * k;
      r.z += (r.tz - r.z) * k;
      let dy = r.tyaw - r.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      r.yaw += dy * k;
      r.lookYaw += (r.tLookYaw - r.lookYaw) * k;
      const sitY = r.seated && !r.carriedBy ? 0.02 : 0;
      r.rig.outer.position.set(r.x, sitY, r.z);
      r.rig.outer.rotation.y = r.yaw;
      r.rig.outer.visible = true;
      poseOf(r, t);
      const carrying = [...remotes.values()].some(o => o !== r && o.carriedBy && (o.carriedBy === r.pid || o.carriedBy === r.connId));
      if (carrying && !r.seated) posePlazaCarryHold(r.rig);
      if (r.rig.head) r.rig.head.rotation.y = r.lookYaw;
      r.tag.sprite.position.set(r.x, (r.seated ? 1.55 : 1.85) + (r.carriedBy ? 0.35 : 0), r.z);
      r.tag.sprite.visible = true;
    }
  }

  function walkBodies(): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    for (const r of remotes.values()) {
      if (r.seated && !r.carriedBy) out.push([r.x, r.z, 0.35, 0]);
      else if (!r.carriedBy) out.push([r.x, r.z, 0.32, r.phase === 'lie' ? 1 : 0]);
    }
    for (let i = 0; i < stoolTotal; i++) {
      const s = stools[i];
      if (s?.visible) out.push([s.position.x, s.position.z, 0.28, 0]);
    }
    return out;
  }

  function nearSeat(x: number, z: number, bodies: RoomBody[]) {
    const taken = occupiedSlots(bodies);
    let best = -1, bd = 0.85;
    for (let i = 0; i < stoolTotal; i++) {
      if (taken.has(i)) continue;
      const p = stools[i];
      if (!p?.visible) continue;
      const d = Math.hypot(x - p.position.x, z - p.position.z);
      if (d < bd) { bd = d; best = i; }
    }
    return best >= 0 ? { slot: best, dist: bd } : null;
  }

  function nearNpc(x: number, z: number, bodies: RoomBody[]) {
    let best: RoomBody | null = null, bd = 1.4;
    for (const b of bodies) {
      if (!b.isNpc || b.carriedBy) continue;
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function dispose() {
    for (const r of remotes.values()) {
      r.rig.outer.removeFromParent();
      r.tag.sprite.removeFromParent();
    }
    remotes.clear();
    for (const g of stools) g.removeFromParent();
    stools.length = 0;
    root.removeFromParent();
  }

  return { layoutStools, applyBodies, applyPose, tick, walkBodies, nearSeat, nearNpc, dispose, root };
}

export type RoomAvatarView = ReturnType<typeof createRoomAvatarView>;
