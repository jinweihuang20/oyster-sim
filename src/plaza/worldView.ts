import * as THREE from 'three';
import { makePlayerAvatar, type PlayerRig } from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { PILE_COUNT, SLOTS_PER_PILE, WALK_BOUND, pileCenter, seatPose, seatKey, type PlazaSeatRef } from './layout';
import { makeYardLikePile, makePlazaChair, makePlazaFloorMaps, makePlazaBigShed, CHAIR_SEAT_Y } from './props';
import type { PlazaAimTarget, PlazaPlayer, PlazaSnapshot } from './types';

type Remote = {
  key: string;
  pid: string;
  rig: PlayerRig;
  tag: HTMLElement;
  bubble: HTMLElement;
  bubUntil: number;
  pileId: number;
  slot: number;
  phase: string;
  count: number;
  nick: string;
  seated: boolean;
  moving: boolean;
  umb: boolean;
  umbMesh: THREE.Group;
  tx: number; tz: number; tyaw: number;
  x: number; z: number; yaw: number;
  bob: number;
};

const SHIRTS = [0xc45c26, 0x3a6ea5, 0x2f7d4a, 0x8a3a6a, 0x6a5a2a, 0x4a4a7a];
const HAIRS = [0x222222, 0x555555, 0x888888, 0x3a2a1a, 0xdddddd];

/**
 * 死鬥 avatar 站立頭頂 ≈1.5m；第三人稱本體走路頭 ≈1.05、坐下被相機錨點拉高。
 * 0.75 會顯得過矮，略縮到 0.92 對齊走路身高，坐時髖仍對齊椅面。
 */
const AVATAR_SCALE = 0.92;
const HIP_Y = 0.72;
const SIT_ROOT_Y = CHAIR_SEAT_Y / AVATAR_SCALE - HIP_Y;

export type PlazaWorldView = {
  root: THREE.Group;
  pileGroups: THREE.Group[];
  syncRoster: (snap: PlazaSnapshot, selfPid: string) => void;
  upsert: (p: PlazaPlayer, selfPid: string) => void;
  remove: (p: PlazaPlayer) => void;
  applyPose: (p: PlazaPlayer, selfPid: string) => void;
  setPhase: (p: PlazaPlayer) => void;
  highlight: (pileId: number | null, slot: number | null) => void;
  highlightNear: (seat: PlazaSeatRef | null) => void;
  hitPile: (raycaster: THREE.Raycaster) => number | null;
  /** 坐下遠端玩家的瞄準點（丟殼／偷肉） */
  aimTargets: () => PlazaAimTarget[];
  /** 頭頂氣泡：最後一句聊天，約 5 秒 */
  showChat: (opts: { connId?: string; pid?: string; nick?: string; text: string; self?: boolean }) => void;
  setSelfPose: (x: number, z: number, yaw: number, seated: boolean) => void;
  tick: (dt: number, camera: THREE.Camera) => void;
  dispose: () => void;
};

export type PlazaWorldOpts = {
  shellGeo: THREE.BufferGeometry;
  shellMat: THREE.Material;
  lowDetail?: boolean;
};

export function createPlazaWorldView(
  scene: THREE.Scene,
  bubblesHost: HTMLElement,
  opts: PlazaWorldOpts,
): PlazaWorldView {
  const LO = !!opts.lowDetail;
  const root = new THREE.Group(); root.name = 'plazaWorld'; scene.add(root);
  const { M, add } = makeMeshHelpers(scene, LO);
  const remotes = new Map<string, Remote>();
  const seatMeshes = new Map<string, THREE.Mesh>();
  const pileGroups: THREE.Group[] = [];
  let nearKey: string | null = null;

  // 水泥廣場貼皮（分格對齊蚵堆）
  const floorMaps = makePlazaFloorMaps(LO ? 384 : 512);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorMaps.map,
    roughnessMap: floorMaps.rough,
    roughness: 0.92,
    metalness: 0.02,
    color: 0xffffff,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALK_BOUND * 2.4, WALK_BOUND * 2.4), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = !LO;
  root.add(floor);

  for (let i = 0; i < PILE_COUNT; i++) {
    const c = pileCenter(i);
    const pile = makeYardLikePile(opts.shellGeo, opts.shellMat, i, LO ? 70 : 110);
    pile.position.copy(c);
    root.add(pile);
    pileGroups.push(pile);

    for (let s = 0; s < SLOTS_PER_PILE; s++) {
      const pose = seatPose(i, s);
      const { group, pad } = makePlazaChair(pose.pos.x, pose.pos.z, pose.yaw, M, add);
      root.add(group);
      seatMeshes.set(seatKey(i, s), pad);
    }
  }

  // 廣場大棚（鏽鐵皮＋外圈木柱，避開堆／椅；工寮原棚進場仍隱藏）
  root.add(makePlazaBigShed(M, add, LO).group);

  function hitPile(raycaster: THREE.Raycaster): number | null {
    const hits = raycaster.intersectObjects(pileGroups, true);
    if (!hits.length) return null;
    let o: THREE.Object3D | null = hits[0].object;
    while (o) {
      if (typeof o.userData.pileId === 'number') return o.userData.pileId as number;
      o = o.parent;
    }
    return null;
  }

  function aimTargets(): PlazaAimTarget[] {
    const out: PlazaAimTarget[] = [];
    for (const r of remotes.values()) {
      if (!r.seated || r.pileId < 0) continue;
      const h = headWorld(r, new THREE.Vector3());
      const b = bowlWorld(r, new THREE.Vector3());
      out.push({
        connId: r.key,
        nick: r.nick,
        x: r.x, z: r.z, yaw: r.yaw,
        seated: true,
        count: r.count,
        umb: r.umb,
        head: { x: h.x, y: h.y, z: h.z },
        bowl: { x: b.x, y: b.y, z: b.z },
      });
    }
    return out;
  }

  function hashLook(pid: string) {
    let h = 0; for (let i = 0; i < pid.length; i++) h = (h * 31 + pid.charCodeAt(i)) | 0;
    return { shirt: SHIRTS[Math.abs(h) % SHIRTS.length], hair: HAIRS[Math.abs(h >> 3) % HAIRS.length], pants: 0x2a2a40 };
  }

  // 獨立圖層，避免被 #bubbles z-index:0 或廣場 UI 蓋住
  const tagsHost = document.createElement('div');
  tagsHost.id = 'plazaTags';
  tagsHost.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tagsHost);
  void bubblesHost;

  const selfBubble = document.createElement('div');
  selfBubble.className = 'plazaChatBub';
  selfBubble.style.display = 'none';
  tagsHost.appendChild(selfBubble);
  let selfBubUntil = 0;
  let selfX = 0, selfZ = 0, selfYaw = 0, selfSeated = false;

  function ensureTag(nick: string) {
    const tag = document.createElement('div');
    tag.className = 'plazaTag';
    tag.textContent = nick;
    tagsHost.appendChild(tag);
    return tag;
  }

  function ensureBubble() {
    const el = document.createElement('div');
    el.className = 'plazaChatBub';
    el.style.display = 'none';
    tagsHost.appendChild(el);
    return el;
  }

  function makeRemoteUmb() {
    const g = new THREE.Group();
    g.visible = false;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.55, 5),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.85, flatShading: true }),
    );
    pole.position.set(0.18, 1.35, -0.05);
    g.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.18, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, side: THREE.DoubleSide, roughness: 0.7, flatShading: true }),
    );
    canopy.position.set(0.18, 1.62, -0.05);
    g.add(canopy);
    return g;
  }

  const _head = new THREE.Vector3();
  const _bowl = new THREE.Vector3();

  function headWorld(r: Remote, out = _head) {
    r.rig.head.getWorldPosition(out);
    return out;
  }

  function bowlWorld(r: Remote, out = _bowl) {
    // 面前矮桌高度：角色朝向 -Z（yaw）
    const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
    out.set(r.x + fx * 0.5, r.seated ? 0.52 : 0.7, r.z + fz * 0.5);
    return out;
  }

  /** 廣場不持槍：藏槍架；臂段從持槍 IK 改回自然垂掛（否則會伸進蚵堆只剩腳） */
  function hangArms(r: Remote, sit = false) {
    r.rig.weaponMount.visible = false;
    r.rig.handL.visible = false;
    r.rig.handR.visible = false;
    const hang = (upper: THREE.Group, lower: THREE.Group, side: number) => {
      upper.scale.set(1, 1, 1);
      lower.scale.set(1, 1, 1);
      upper.position.set(side * 0.22, 0.28, 0);
      lower.position.set(side * 0.22, 0.02, sit ? 0.04 : 0.02);
      upper.rotation.set(sit ? 0.55 : 0.12, 0, side * 0.12);
      lower.rotation.set(sit ? 0.35 : 0.18, 0, 0);
      upper.quaternion.setFromEuler(upper.rotation);
      lower.quaternion.setFromEuler(lower.rotation);
    };
    hang(r.rig.upperL, r.rig.lowerL, -1);
    hang(r.rig.upperR, r.rig.lowerR, 1);
  }

  /** 坐下：髖對椅面、略後仰離蚵堆；大腿前擺、小腿下垂 */
  function poseSit(r: Remote) {
    hangArms(r, true);
    r.rig.outer.scale.setScalar(AVATAR_SCALE);
    r.rig.root.scale.set(1, 1, 1);
    r.rig.root.position.y = SIT_ROOT_Y;
    r.rig.legL.scale.set(1, 1, 1);
    r.rig.legR.scale.set(1, 1, 1);
    r.rig.shinL.scale.set(1, 1, 1);
    r.rig.shinR.scale.set(1, 1, 1);
    r.rig.torso.scale.set(1, 1, 1);
    r.rig.legL.rotation.set(1.15, 0.08, 0.1);
    r.rig.legR.rotation.set(1.15, -0.08, -0.1);
    r.rig.shinL.rotation.set(-1.25, 0, 0);
    r.rig.shinR.rotation.set(-1.25, 0, 0);
    // 略後仰，身體不要埋進面前蚵堆
    r.rig.torso.rotation.x = -0.12;
    r.rig.torso.position.y = 0.02;
  }

  function poseStand(r: Remote) {
    hangArms(r, false);
    r.rig.outer.scale.setScalar(AVATAR_SCALE);
    r.rig.root.scale.set(1, 1, 1);
    r.rig.root.position.y = 0;
    r.rig.legL.rotation.set(0, 0, 0);
    r.rig.legR.rotation.set(0, 0, 0);
    r.rig.shinL.rotation.set(0, 0, 0);
    r.rig.shinR.rotation.set(0, 0, 0);
    r.rig.legL.scale.set(1, 1, 1);
    r.rig.legR.scale.set(1, 1, 1);
    r.rig.shinL.scale.set(1, 1, 1);
    r.rig.shinR.scale.set(1, 1, 1);
    r.rig.torso.scale.set(1, 1, 1);
    r.rig.torso.rotation.x = 0;
    r.rig.torso.position.y = 0;
  }

  function applyActionPose(r: Remote) {
    const ph = r.phase;
    if (r.seated) {
      poseSit(r);
      if (ph === 'twist' || ph === 'pry') {
        r.rig.head.rotation.x = 0.15;
        r.rig.upperR.position.set(0.22, 0.3, -0.05);
        r.rig.upperR.rotation.set(0.9, 0, -0.1);
        r.rig.lowerR.position.set(0.22, 0.08, -0.12);
        r.rig.lowerR.rotation.set(0.55, 0, 0);
        r.rig.upperR.quaternion.setFromEuler(r.rig.upperR.rotation);
        r.rig.lowerR.quaternion.setFromEuler(r.rig.lowerR.rotation);
      } else if (ph === 'seam') {
        r.rig.head.rotation.x = 0.1;
        r.rig.upperR.rotation.set(0.7, 0, -0.08);
        r.rig.upperR.quaternion.setFromEuler(r.rig.upperR.rotation);
      } else if (ph === 'aim' || ph === 'toss') {
        r.rig.upperL.position.set(-0.22, 0.32, -0.08);
        r.rig.upperL.rotation.set(1.0, 0, 0.1);
        r.rig.lowerL.position.set(-0.22, 0.1, -0.16);
        r.rig.lowerL.rotation.set(0.4, 0, 0);
        r.rig.upperL.quaternion.setFromEuler(r.rig.upperL.rotation);
        r.rig.lowerL.quaternion.setFromEuler(r.rig.lowerL.rotation);
        r.rig.head.rotation.x = -0.05;
      } else if (ph === 'scoop' || ph === 'pick') {
        r.rig.upperL.rotation.set(0.75, 0, 0.12);
        r.rig.upperR.rotation.set(0.6, 0, -0.1);
        r.rig.upperL.quaternion.setFromEuler(r.rig.upperL.rotation);
        r.rig.upperR.quaternion.setFromEuler(r.rig.upperR.rotation);
        r.rig.head.rotation.x = 0.08;
      } else {
        r.rig.head.rotation.x = 0.05;
      }
    } else {
      poseStand(r);
      r.rig.head.rotation.x = 0;
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
      rig.outer.scale.setScalar(AVATAR_SCALE);
      const umbMesh = makeRemoteUmb();
      rig.outer.add(umbMesh);
      r = {
        key, pid: p.pid || '', rig, tag: ensureTag(p.nick || '剝蚵人'), bubble: ensureBubble(), bubUntil: 0,
        pileId: p.pileId, slot: p.slot, phase: p.phase, count: p.count, nick: p.nick,
        seated: !!p.seated, moving: !!p.moving, umb: !!p.umb, umbMesh,
        tx: x, tz: z, tyaw: yaw, x, z, yaw, bob: 0,
      };
      remotes.set(key, r);
      hangArms(r, r.seated);
    } else if (p.pid) r.pid = p.pid;
    return r;
  }

  function applyPose(p: PlazaPlayer, selfPid: string) {
    const r = ensure(p, selfPid); if (!r) return;
    const wasSeated = r.seated;
    const prevPile = r.pileId, prevSlot = r.slot;
    r.pileId = p.pileId; r.slot = p.slot; r.phase = p.phase || r.phase; r.count = p.count ?? r.count;
    r.seated = !!p.seated; r.moving = !!p.moving;
    r.umb = !!p.umb;
    r.umbMesh.visible = r.umb;
    if (p.nick && p.nick !== r.nick) { r.nick = p.nick; }
    r.tag.textContent = r.seated ? `${r.nick} · ${r.count}` : r.nick;
    if (r.seated && p.pileId >= 0) {
      const pose = seatPose(p.pileId, p.slot);
      r.tx = pose.pos.x; r.tz = pose.pos.z; r.tyaw = pose.yaw;
      r.x = pose.pos.x; r.z = pose.pos.z; r.yaw = pose.yaw;
    } else {
      // 剛站起：若封包座標異常（0,0 或離座位太遠），先站在椅後再跟 Sync
      if (wasSeated && prevPile >= 0) {
        const pose = seatPose(prevPile, prevSlot);
        const standX = pose.pos.x + Math.sin(pose.yaw) * 0.55;
        const standZ = pose.pos.z + Math.cos(pose.yaw) * 0.55;
        const nx = typeof p.x === 'number' ? p.x : standX;
        const nz = typeof p.z === 'number' ? p.z : standZ;
        const far = Math.hypot(nx - pose.pos.x, nz - pose.pos.z) > 3.5;
        r.x = r.tx = far ? standX : nx;
        r.z = r.tz = far ? standZ : nz;
        r.yaw = r.tyaw = typeof p.yaw === 'number' && !far ? p.yaw : pose.yaw;
      } else {
        if (typeof p.x === 'number') r.tx = p.x;
        if (typeof p.z === 'number') r.tz = p.z;
        if (typeof p.yaw === 'number') r.tyaw = p.yaw;
      }
    }
    applyActionPose(r);
    paintOcc();
  }

  function upsert(p: PlazaPlayer, selfPid: string) { applyPose(p, selfPid); }

  function remove(p: PlazaPlayer) {
    const key = p.connId || p.pid;
    const r = remotes.get(key);
    if (!r) return;
    root.remove(r.rig.outer); r.tag.remove(); r.bubble.remove(); remotes.delete(key);
    paintOcc();
  }

  function showChat(opts: { connId?: string; pid?: string; nick?: string; text: string; self?: boolean }) {
    const text = (opts.text || '').trim();
    if (!text) return;
    const until = performance.now() + 5000;
    if (opts.self) {
      selfBubble.textContent = text.length > 40 ? text.slice(0, 39) + '…' : text;
      selfBubble.style.display = 'block';
      selfBubUntil = until;
      return;
    }
    let r: Remote | undefined;
    if (opts.connId) r = remotes.get(opts.connId);
    if (!r && opts.pid) {
      for (const x of remotes.values()) { if (x.pid === opts.pid) { r = x; break; } }
    }
    if (!r && opts.nick) {
      for (const x of remotes.values()) { if (x.nick === opts.nick) { r = x; break; } }
    }
    if (!r) return;
    r.bubble.textContent = text.length > 40 ? text.slice(0, 39) + '…' : text;
    r.bubble.style.display = 'block';
    r.bubUntil = until;
  }

  function setSelfPose(x: number, z: number, yaw: number, seated: boolean) {
    selfX = x; selfZ = z; selfYaw = yaw; selfSeated = seated;
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
      if (!alive.has(k)) { root.remove(r.rig.outer); r.tag.remove(); r.bubble.remove(); remotes.delete(k); }
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
  const now = () => performance.now();

  function placeHud(el: HTMLElement, x: number, z: number, yWorld: number, camera: THREE.Camera, yOff = 0) {
    _v.set(x, yWorld, z).project(camera);
    const sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight + yOff;
    const behind = _v.z > 1 || sx < -80 || sx > innerWidth + 80 || sy < -40 || sy > innerHeight + 40;
    el.style.display = behind ? 'none' : 'block';
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
  }

  function tick(dt: number, camera: THREE.Camera) {
    const k = Math.min(1, dt * 10);
    const t = now();
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
      // 坐下略往後移，避免身體埋進蚵堆
      const back = r.seated ? 0.22 : 0;
      const ox = r.x + Math.sin(r.yaw) * back;
      const oz = r.z + Math.cos(r.yaw) * back;
      r.rig.outer.position.set(ox, 0, oz);
      r.rig.outer.rotation.y = r.yaw;
      const headY = r.seated ? CHAIR_SEAT_Y + 0.78 * AVATAR_SCALE : 1.5 * AVATAR_SCALE;
      placeHud(r.tag, ox, oz, headY, camera);
      if (r.bubUntil > t) placeHud(r.bubble, ox, oz, headY + 0.18, camera, -28);
      else if (r.bubble.style.display !== 'none') r.bubble.style.display = 'none';
    }
    if (selfBubUntil > t) {
      const headY = selfSeated ? CHAIR_SEAT_Y + 0.78 * AVATAR_SCALE : 1.5 * AVATAR_SCALE;
      const back = selfSeated ? 0.22 : 0;
      const ox = selfX + Math.sin(selfYaw) * back;
      const oz = selfZ + Math.cos(selfYaw) * back;
      placeHud(selfBubble, ox, oz, headY + 0.18, camera, -28);
    } else if (selfBubble.style.display !== 'none') selfBubble.style.display = 'none';
  }

  function dispose() {
    for (const r of remotes.values()) { root.remove(r.rig.outer); r.tag.remove(); r.bubble.remove(); }
    remotes.clear();
    selfBubble.remove();
    tagsHost.remove();
    scene.remove(root);
    floorMaps.map.dispose();
    floorMaps.rough.dispose();
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry && !m.userData.sharedGeo && m.geometry !== opts.shellGeo) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(x => { if (x !== opts.shellMat) x.dispose(); });
      else if (mat && mat !== opts.shellMat) mat.dispose();
    });
  }

  return { root, pileGroups, syncRoster, upsert, remove, applyPose, setPhase, highlight, highlightNear, hitPile, aimTargets, showChat, setSelfPose, tick, dispose };
}

export function tickPlazaTags(view: PlazaWorldView | null, camera: THREE.Camera, dt = 0.016) {
  if (!view) return;
  view.tick(dt, camera);
}
