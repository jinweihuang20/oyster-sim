import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { applyOutfitToRig, normalizeOutfitIds, outfitKey } from '../shop/equipVisual';
import { makePlayerAvatar, posePlazaHangArms, posePlazaWalkSwingArms, type PlayerRig } from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { PILE_COUNT, SLOTS_PER_PILE, WALK_BOUND, pileCenter, seatPose, seatKey, type PlazaSeatRef } from './layout';
import { makeYardLikePile, makePlazaChair, makePlazaFloorMaps, makePlazaBigShed, CHAIR_SEAT_Y } from './props';
import type { PlazaAimTarget, PlazaPlayer, PlazaSnapshot } from './types';

type Remote = {
  /** Map key＝pid（同一人只留一具模型，重連換 connId 不複製） */
  key: string;
  /** 目前 Hub connectionId（丟殼／偷肉瞄準用） */
  connId: string;
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
  /** 坐下時面前的臉盆＋肉碗 */
  props: THREE.Group;
  bowlNode: THREE.Object3D;
  meatRoot: THREE.Group;
  meatMeshes: THREE.Mesh[];
  /** 手持蚵仔刀／蚵仔（掛 torso） */
  knife: THREE.Group;
  oyster: THREE.Group;
  tx: number; tz: number; tyaw: number;
  x: number; z: number; yaw: number;
  bob: number;
  /** 遠端丟殼甩臂剩餘秒數 */
  throwT: number;
  /** 目標／目前轉頭 */
  tLookYaw: number; lookYaw: number;
  tPitch: number; pitch: number;
  /** 工作姿勢附加的頭傾（再疊 look pitch） */
  headWorkX: number;
  /** 剛進場、座標尚不可信：先藏模型，避免從原點高速滑行 */
  awaitingPose: boolean;
};

const SHIRTS = [0xc45c26, 0x3a6ea5, 0x2f7d4a, 0x8a3a6a, 0x6a5a2a, 0x4a4a7a];
const HAIRS = [0x222222, 0x555555, 0x888888, 0x3a2a1a, 0xdddddd];

/**
 * 與死鬥 NPC 同一套 makePlayerAvatar，比例 1:1（不再縮放）。
 * 坐時髖略高於椅面：大腿 mesh 在髖下方，對齊 HIP 會整個人沉進椅子。
 */
const AVATAR_SCALE = 1;
const HIP_Y = 0.72;
/** 髖高於坐墊，讓大腿／屁股貼在椅面上 */
const SIT_HIP_LIFT = 0.14;
const SIT_ROOT_Y = (CHAIR_SEAT_Y + SIT_HIP_LIFT) / AVATAR_SCALE - HIP_Y;

const _hangDir = new THREE.Vector3();
const _hangUp = new THREE.Vector3(0, 1, 0);

export type PlazaWorldView = {
  root: THREE.Group;
  pileGroups: THREE.Group[];
  syncRoster: (snap: PlazaSnapshot, selfPid: string) => void;
  upsert: (p: PlazaPlayer, selfPid: string) => void;
  remove: (p: PlazaPlayer) => void;
  pruneSelf: (selfPid: string) => void;
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
  playThrowFx: (connId: string) => void;
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
        connId: r.connId || r.key,
        nick: r.nick,
        pileId: r.pileId,
        phase: r.phase || '',
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

  /** 遠端雨傘：跟本機一樣「往前開」擋殼，不是頭頂撐雨 */
  function makeRemoteUmb() {
    const g = new THREE.Group();
    g.visible = false;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.72, 5),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.85, flatShading: true }),
    );
    // 傘柄在近 y=0（手握處），傘面沿 +Y；整組再往前傾
    pole.position.set(0, 0.2, 0);
    g.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.2, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, side: THREE.DoubleSide, roughness: 0.7, flatShading: true }),
    );
    canopy.position.set(0, 0.58, 0);
    g.add(canopy);
    layoutRemoteUmb(g, true);
    return g;
  }

  function layoutRemoteUmb(g: THREE.Group, seated: boolean) {
    // 略偏右、壓低；rotation.x 把傘面轉向 -Z（正面擋來殼）
    if (seated) g.position.set(0.22, 0.9, -0.42);
    else g.position.set(0.22, 1.18, -0.48);
    g.rotation.set(-1.22, 0, -0.16);
  }

  /** 開傘：右臂往前伸握柄 */
  function poseUmb(r: Remote) {
    if (!r?.rig?.upperR || !r.rig?.lowerR || !r.rig?.head) return;
    if (r.seated) poseSit(r); else poseStand(r);
    placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.32, 0, 0.26, 0.28, -0.3, 0.24, 0.24, -0.55);
    r.headWorkX = -0.08;
    hideHold(r);
  }

  /** 簡易蚵仔刀＋蚵仔（遠端剝殼手持） */
  function makeRemoteHold(): { knife: THREE.Group; oyster: THREE.Group } {
    const knife = new THREE.Group();
    knife.visible = false;
    const handle = new THREE.Mesh(
      rcyl(0.012, 0.014, 0.09, 5),
      new THREE.MeshStandardMaterial({ color: 0x7a4a20, roughness: 0.85 }),
    );
    handle.rotation.z = Math.PI / 2;
    knife.add(handle);
    const blade = new THREE.Mesh(
      rboxEnv(0.1, 0.006, 0.022),
      new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 0.7, roughness: 0.3 }),
    );
    blade.position.set(-0.08, 0, 0);
    knife.add(blade);

    const oyster = new THREE.Group();
    oyster.visible = false;
    const bot = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0xe0dcd8, roughness: 0.85, flatShading: true }),
    );
    bot.scale.set(1.15, 0.45, 1);
    oyster.add(bot);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0xf0ecea, roughness: 0.85, flatShading: true }),
    );
    top.scale.set(1.1, 0.4, 0.95);
    top.position.set(0, 0.03, 0);
    oyster.add(top);
    return { knife, oyster };
  }

  function hideHold(r: Remote) {
    r.knife.visible = false;
    r.oyster.visible = false;
  }

  function placeHold(r: Remote, kx: number, ky: number, kz: number, ox: number, oy: number, oz: number, showOy: boolean) {
    r.knife.visible = true;
    r.knife.position.set(kx, ky, kz);
    r.knife.rotation.set(0.15, 0.9, 0.2);
    r.oyster.visible = showOy;
    if (showOy) {
      r.oyster.position.set(ox, oy, oz);
      r.oyster.rotation.set(0.2, 0.3, 0);
    }
  }

  const remoteMeatGeo = new THREE.SphereGeometry(0.03, 6, 5);
  remoteMeatGeo.scale(1.35, 0.55, 1);
  const remoteMeatMat = M(0xd8cbb0, { roughness: 0.35, flatShading: true });

  /** 坐下面前：紅臉盆＋裝肉碗（本地相對 outer，面向 -Z） */
  function makeRemoteProps(): { props: THREE.Group; bowlNode: THREE.Object3D; meatRoot: THREE.Group } {
    const props = new THREE.Group();
    props.visible = false;
    const basinMat = M(0xc84030, { side: THREE.DoubleSide, roughness: 0.55, flatShading: true });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.11, 12, 1, true), basinMat);
    basin.position.set(-0.3, 0.1, -0.52);
    props.add(basin);
    const basinFl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), M(0xa03028, { roughness: 0.65, flatShading: true }));
    basinFl.rotation.x = -Math.PI / 2;
    basinFl.position.set(-0.3, 0.045, -0.52);
    props.add(basinFl);
    // 盆裡幾顆殼示意
    for (let i = 0; i < 5; i++) {
      const a = i * 1.1, rr = 0.04 + (i % 3) * 0.02;
      const oy = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 5, 4),
        M(0xc8c2c0, { roughness: 0.8, flatShading: true }),
      );
      oy.scale.set(1.2, 0.55, 1);
      oy.position.set(-0.3 + Math.cos(a) * rr, 0.1, -0.52 + Math.sin(a) * rr);
      props.add(oy);
    }
    const bowlNode = new THREE.Group();
    const bowlMat = M(0x4a8ac0, { side: THREE.DoubleSide, roughness: 0.45, flatShading: true });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.09, 12, 1, true), bowlMat);
    wall.position.y = 0.045;
    bowlNode.add(wall);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), M(0x3a6a98, { roughness: 0.5, flatShading: true }));
    fl.rotation.x = -Math.PI / 2;
    bowlNode.add(fl);
    bowlNode.position.set(0.34, 0.06, -0.68);
    props.add(bowlNode);
    const meatRoot = new THREE.Group();
    meatRoot.position.set(0.34, 0.12, -0.68);
    props.add(meatRoot);
    return { props, bowlNode, meatRoot };
  }

  function syncRemoteMeats(r: Remote) {
    const n = Math.min(8, Math.max(0, r.count | 0));
    while (r.meatMeshes.length < n) {
      const m = new THREE.Mesh(remoteMeatGeo, remoteMeatMat);
      const i = r.meatMeshes.length;
      const a = i * 2.3, rr = 0.02 + (i % 4) * 0.015;
      m.position.set(Math.cos(a) * rr, (i % 3) * 0.02, Math.sin(a) * rr);
      r.meatRoot.add(m);
      r.meatMeshes.push(m);
    }
    for (let i = 0; i < r.meatMeshes.length; i++) r.meatMeshes[i].visible = i < n;
  }

  const _head = new THREE.Vector3();
  const _bowl = new THREE.Vector3();

  function headWorld(r: Remote, out = _head) {
    r.rig.head.getWorldPosition(out);
    return out;
  }

  function bowlWorld(r: Remote, out = _bowl) {
    if (r.seated && r.props.visible) {
      r.bowlNode.getWorldPosition(out);
      out.y += 0.06;
      return out;
    }
    const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
    out.set(r.x + fx * 0.5, r.seated ? 0.52 : 0.7, r.z + fz * 0.5);
    return out;
  }

  /**
   * 臂段沿 +Y；固定 restLen，只跟方向走。
   * 舊版用端點距離去 scale 會在相位切換時橡皮筋忽長忽短。
   */
  function placeArmSeg(seg: THREE.Group, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    if (!seg) return;
    const base = (seg.userData.restLen as number) || 0.26;
    _hangDir.set(bx - ax, by - ay, bz - az);
    const raw = _hangDir.length();
    if (raw < 1e-6) {
      seg.position.set(ax, ay - base * 0.5, az);
      seg.quaternion.identity();
      seg.rotation.set(0, 0, 0);
      seg.scale.set(1, 1, 1);
      return;
    }
    _hangDir.multiplyScalar(1 / raw);
    seg.position.set(ax + _hangDir.x * base * 0.5, ay + _hangDir.y * base * 0.5, az + _hangDir.z * base * 0.5);
    seg.quaternion.setFromUnitVectors(_hangUp, _hangDir);
    seg.rotation.setFromQuaternion(seg.quaternion);
    seg.scale.set(1, 1, 1);
  }

  /** 上臂→實際肘→下臂，肘點用上臂固定長，避免兩段脫節／拉長 */
  function placeArmChain(
    upper: THREE.Group, lower: THREE.Group,
    shx: number, shy: number, shz: number,
    elx: number, ely: number, elz: number,
    wrx: number, wry: number, wrz: number,
  ) {
    const uLen = (upper.userData.restLen as number) || 0.26;
    const lLen = (lower.userData.restLen as number) || 0.24;
    _hangDir.set(elx - shx, ely - shy, elz - shz);
    if (_hangDir.lengthSq() < 1e-8) _hangDir.set(0, -1, 0); else _hangDir.normalize();
    const e2x = shx + _hangDir.x * uLen, e2y = shy + _hangDir.y * uLen, e2z = shz + _hangDir.z * uLen;
    placeArmSeg(upper, shx, shy, shz, e2x, e2y, e2z);
    _hangDir.set(wrx - e2x, wry - e2y, wrz - e2z);
    if (_hangDir.lengthSq() < 1e-8) _hangDir.set(0, -1, 0); else _hangDir.normalize();
    placeArmSeg(lower, e2x, e2y, e2z, e2x + _hangDir.x * lLen, e2y + _hangDir.y * lLen, e2z + _hangDir.z * lLen);
  }

  const hangArms = (r: Remote, sit = false) => posePlazaHangArms(r.rig, sit);
  const swingArms = (r: Remote, swing: number) => posePlazaWalkSwingArms(r.rig, swing);

  /** makePlayerAvatar 預設 torso.y=0.92、髖=0.72；勿覆寫成 0 否則頭身壓進腳 */
  const TORSO_Y = 0.92;

  /** 坐下丟殼：右手往前甩（肩→肘→腕連續） */
  function poseThrow(r: Remote) {
    if (!r?.seated || !r.rig?.upperR || !r.rig?.lowerR || !r.rig?.head) return;
    poseSit(r);
    placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.32, 0, 0.28, 0.22, -0.2, 0.3, 0.18, -0.42);
    r.headWorkX = -0.12;
    hideHold(r);
  }

  function applyHeadLook(r: Remote) {
    if (!r.rig?.head) return;
    // 坐下：lookYaw＝相對座位；走動：lookYaw 多為 0（身體跟 yaw），pitch 第一人稱會同步
    r.rig.head.rotation.x = r.headWorkX + r.pitch * 0.85;
    r.rig.head.rotation.y = r.lookYaw;
  }

  function playThrowFx(connId: string) {
    if (!connId) return;
    try {
      let r: Remote | undefined;
      for (const x of remotes.values()) {
        if (x.connId === connId || x.pid === connId || x.key === connId) { r = x; break; }
      }
      if (!r || !r.seated) return;
      r.throwT = 0.55;
      poseThrow(r);
    } catch { /* 遠端已離場／骨架異常時略過甩臂 */ }
  }

  /** 坐下：大腿貼椅面、小腿下垂；略後仰離蚵堆 */
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
    // 大腿近水平貼坐墊，小腿垂下
    r.rig.legL.rotation.set(1.25, 0.06, 0.08);
    r.rig.legR.rotation.set(1.25, -0.06, -0.08);
    r.rig.shinL.rotation.set(-1.35, 0, 0);
    r.rig.shinR.rotation.set(-1.35, 0, 0);
    r.rig.torso.rotation.x = -0.06;
    r.rig.torso.position.y = TORSO_Y - 0.02;
  }

  function poseStand(r: Remote) {
    hangArms(r, false);
    r.rig.outer.scale.setScalar(AVATAR_SCALE);
    r.rig.root.scale.set(1, 1, 1);
    r.rig.root.position.set(0, 0, 0);
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
    r.rig.torso.position.y = TORSO_Y;
  }

  function applyActionPose(r: Remote) {
    if (r.throwT > 0) { poseThrow(r); applyHeadLook(r); return; }
    if (r.umb) { poseUmb(r); applyHeadLook(r); return; }
    const ph = (r.phase || '').toLowerCase();
    if (r.seated) {
      poseSit(r);
      if (ph === 'twist' || ph === 'pry') {
        // 左手握蚵、右手持刀撬
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.14, 0.2, -0.26, -0.08, 0.14, -0.4);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.16, 0.18, -0.22, 0.02, 0.12, -0.38);
        placeHold(r, 0.02, 0.12, -0.38, -0.08, 0.14, -0.4, true);
        r.headWorkX = 0.12;
      } else if (ph === 'seam') {
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.14, 0.2, -0.24, -0.08, 0.14, -0.38);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.14, 0.18, -0.2, 0.0, 0.12, -0.36);
        placeHold(r, 0.0, 0.12, -0.36, -0.08, 0.14, -0.38, true);
        r.headWorkX = 0.1;
      } else if (ph === 'aim' || ph === 'toss') {
        // 左手托肉／蚵往前，右手刀收一點
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.16, 0.22, -0.28, -0.1, 0.16, -0.44);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.2, 0.22, -0.12, 0.18, 0.12, -0.28);
        placeHold(r, 0.18, 0.12, -0.28, -0.1, 0.16, -0.44, true);
        r.headWorkX = -0.05;
      } else if (ph === 'empty') {
        // 空手殼：右手持殼要丟
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.2, 0.22, -0.1, -0.18, 0.1, -0.22);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.2, 0.24, -0.22, 0.16, 0.18, -0.4);
        placeHold(r, 0.16, 0.18, -0.4, 0, 0, 0, false);
        r.oyster.visible = true;
        r.oyster.position.set(0.16, 0.2, -0.42);
        r.headWorkX = -0.08;
      } else if (ph === 'scoop' || ph === 'pick') {
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.18, 0.16, -0.22, -0.14, 0.08, -0.36);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.18, 0.16, -0.18, 0.14, 0.08, -0.32);
        placeHold(r, 0.14, 0.08, -0.32, 0, 0, 0, false);
        r.headWorkX = 0.08;
      } else if (ph === 'crab') {
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.12, 0.22, -0.2, -0.06, 0.18, -0.34);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.12, 0.22, -0.2, 0.06, 0.18, -0.34);
        placeHold(r, 0.06, 0.18, -0.34, -0.06, 0.18, -0.34, true);
        r.headWorkX = 0.15;
      } else {
        // busy／其他：刀具在側、暫無蚵
        placeHold(r, 0.2, 0.12, -0.22, 0, 0, 0, false);
        r.headWorkX = 0.04;
      }
    } else {
      poseStand(r);
      hideHold(r);
      r.headWorkX = 0;
    }
    applyHeadLook(r);
  }

  function findRemoteByPid(pid: string): Remote | undefined {
    const direct = remotes.get(pid);
    if (direct) return direct;
    for (const [k, r] of remotes) {
      if (r.pid === pid || r.key === pid) {
        if (k !== pid) {
          remotes.delete(k);
          r.key = pid;
          remotes.set(pid, r);
        }
        return r;
      }
    }
    return undefined;
  }

  function ensure(p: PlazaPlayer, selfPid: string): Remote | null {
    if (!p || !p.pid || p.pid === selfPid) return null;
    const pid = p.pid;
    // 以 pid 為唯一 key；掃掉同 pid 的舊 connId key／重複分身
    let r = findRemoteByPid(pid);
    if (!r && p.connId) {
      const legacy = remotes.get(p.connId);
      if (legacy) {
        remotes.delete(p.connId);
        legacy.key = pid;
        legacy.pid = pid;
        remotes.set(pid, legacy);
        r = legacy;
      }
    }
    // 再建新模型前，清掉同 pid 殘留（避免 Map 裡一具、場景裡多具）
    if (r) {
      for (const x of [...remotes.values()]) {
        if (x !== r && x.pid === pid) destroyRemote(x);
      }
    }
    if (!r) {
      const look = hashLook(pid);
      const rig = makePlayerAvatar(look, M, add, LO);
      applyOutfitToRig(rig, normalizeOutfitIds({
        head: p.head, hand: p.hand, body: p.body, legs: p.legs, feet: p.feet,
      }));
      root.add(rig.outer);
      const x = p.x ?? 0, z = p.z ?? 0, yaw = p.yaw ?? 0;
      rig.outer.scale.setScalar(AVATAR_SCALE);
      const umbMesh = makeRemoteUmb();
      const { props, bowlNode, meatRoot } = makeRemoteProps();
      const { knife, oyster } = makeRemoteHold();
      rig.outer.add(umbMesh);
      rig.outer.add(props);
      rig.torso.add(knife);
      rig.torso.add(oyster);
      // Joined 常帶 (0,0)；未入座時先藏，等第一次可信座標再顯示
      const awaitingPose = !p.seated && Math.hypot(x, z) < 0.2;
      r = {
        key: pid, connId: p.connId || '', pid, rig, tag: ensureTag(p.nick || '剝蚵人'), bubble: ensureBubble(), bubUntil: 0,
        pileId: p.pileId, slot: p.slot, phase: p.phase, count: p.count, nick: p.nick,
        seated: !!p.seated, moving: !!p.moving, umb: !!p.umb, umbMesh,
        props, bowlNode, meatRoot, meatMeshes: [], knife, oyster,
        tx: x, tz: z, tyaw: yaw, x, z, yaw, bob: 0, throwT: 0,
        tLookYaw: 0, lookYaw: 0, tPitch: 0, pitch: 0, headWorkX: 0,
        awaitingPose,
      };
      remotes.set(pid, r);
      r.props.visible = r.seated;
      if (r.seated) syncRemoteMeats(r);
      hangArms(r, r.seated);
      if (awaitingPose) { rig.outer.visible = false; r.tag.style.display = 'none'; }
    }
    if (p.connId) r.connId = p.connId;
    return r;
  }

  function applyPose(p: PlazaPlayer, selfPid: string) {
    const r = ensure(p, selfPid); if (!r) return;
    const wasSeated = r.seated;
    const prevPile = r.pileId, prevSlot = r.slot;
    r.pileId = p.pileId; r.slot = p.slot; r.phase = p.phase || r.phase; r.count = p.count ?? r.count;
    r.seated = !!p.seated; r.moving = !!p.moving;
    r.umb = !!p.umb;
    r.tLookYaw = Number.isFinite(p.lookYaw) ? Math.max(-1.6, Math.min(1.6, p.lookYaw!)) : 0;
    r.tPitch = Number.isFinite(p.pitch) ? Math.max(-1.4, Math.min(0.85, p.pitch!)) : 0;
    // 走動時身體已朝 yaw；頭左右相對量通常為 0（由傳送端決定是否鎖 pitch）
    r.umbMesh.visible = r.umb;
    if (r.umb) layoutRemoteUmb(r.umbMesh, r.seated);
    r.props.visible = r.seated;
    if (r.seated) syncRemoteMeats(r);
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
        // 進場／瞬移：目標離現況太遠就直接貼上，避免從 (0,0) 高速滑行
        snapRemoteIfFar(r);
        revealRemoteIfReady(r);
      }
    }
    if (r.seated && r.awaitingPose) revealRemoteIfReady(r);
    {
      const next = normalizeOutfitIds({
        head: p.head, hand: p.hand, body: p.body, legs: p.legs, feet: p.feet,
      });
      if (r.rig.outfitKey !== outfitKey(next)) applyOutfitToRig(r.rig, next);
    }
    applyActionPose(r);
    paintOcc();
  }

  /** 距離過大視為瞬移（新進廣場、重連），不走插值 */
  function snapRemoteIfFar(r: Remote, maxDist = 2.8) {
    if (Math.hypot(r.tx - r.x, r.tz - r.z) <= maxDist) return;
    r.x = r.tx; r.z = r.tz; r.yaw = r.tyaw;
  }

  function revealRemoteIfReady(r: Remote) {
    if (!r.awaitingPose) return;
    // 已入座，或座標離開原點附近 → 可視
    if (!r.seated && Math.hypot(r.tx, r.tz) < 0.2) return;
    r.x = r.tx; r.z = r.tz; r.yaw = r.tyaw;
    r.awaitingPose = false;
    r.rig.outer.visible = true;
    r.tag.style.display = '';
  }

  function upsert(p: PlazaPlayer, selfPid: string) { applyPose(p, selfPid); }

  function destroyRemote(r: Remote) {
    root.remove(r.rig.outer); r.tag.remove(); r.bubble.remove();
    // 只刪「指向同一具模型」的 key，避免誤刪同 pid 的另一筆
    for (const [k, x] of [...remotes]) {
      if (x === r) remotes.delete(k);
    }
  }

  function remove(p: PlazaPlayer) {
    const byPid = p.pid ? findRemoteByPid(p.pid) : undefined;
    const r = byPid
      || (p.connId ? remotes.get(p.connId) : undefined)
      || [...remotes.values()].find(x => (!!p.connId && x.connId === p.connId) || (!!p.pid && x.pid === p.pid));
    if (!r) return;
    // 同 pid 可能還有殘留分身，一次清乾淨
    const pid = r.pid || p.pid;
    destroyRemote(r);
    if (pid) {
      for (const x of [...remotes.values()]) {
        if (x.pid === pid) destroyRemote(x);
      }
    }
    paintOcc();
  }

  /** 清掉誤生的「自己」遠端模型（重連分身） */
  function pruneSelf(selfPid: string) {
    if (!selfPid) return;
    for (const r of [...remotes.values()]) {
      if (r.pid === selfPid || r.key === selfPid) destroyRemote(r);
    }
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
    if (opts.pid) r = remotes.get(opts.pid);
    if (!r && opts.connId) {
      for (const x of remotes.values()) { if (x.connId === opts.connId) { r = x; break; } }
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

  function setPhase(p: PlazaPlayer) { applyPose(p, /* 勿用空字串，否則會把「自己」建成遠端分身 */ '\0'); }

  function syncRoster(snap: PlazaSnapshot, selfPid: string) {
    pruneSelf(selfPid);
    const alive = new Set<string>();
    for (const p of snap?.players ?? []) {
      if (!p.pid || p.pid === selfPid) continue;
      alive.add(p.pid);
      applyPose(p, selfPid);
    }
    for (const [k, r] of [...remotes]) {
      // 不在 roster、或 key 不是正規 pid、或誤生的自己 → 刪
      if (r.pid === selfPid || k === selfPid || !alive.has(r.pid) || k !== r.pid) destroyRemote(r);
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
  const _tagHead = new THREE.Vector3();
  const now = () => performance.now();

  type PinSt = { d?: string; x?: number; y?: number };
  const pinMap = new WeakMap<HTMLElement, PinSt>();
  function placeHud(el: HTMLElement, x: number, z: number, yWorld: number, camera: THREE.Camera, yOff = 0) {
    _v.set(x, yWorld, z).project(camera);
    const sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight + yOff;
    const behind = _v.z > 1 || sx < -80 || sx > innerWidth + 80 || sy < -40 || sy > innerHeight + 40;
    const display = behind ? 'none' : 'block';
    let c = pinMap.get(el); if (!c) { c = {}; pinMap.set(el, c); }
    if (c.d !== display) { c.d = display; el.style.display = display; }
    if (display === 'none') return;
    const rx = Math.round(sx), ry = Math.round(sy);
    if (c.x === rx && c.y === ry) return;
    c.x = rx; c.y = ry;
    el.style.left = `${rx}px`;
    el.style.top = `${ry}px`;
  }

  /** 名字／氣泡錨在頭骨上方（勿用估算身高，坐下／走路會偏到胸口或腳邊） */
  function placeAboveHead(el: HTMLElement, r: Remote, camera: THREE.Camera, yLift: number, yOff = 0) {
    r.rig.head.getWorldPosition(_tagHead);
    placeHud(el, _tagHead.x, _tagHead.z, _tagHead.y + yLift, camera, yOff);
  }

  function tick(dt: number, camera: THREE.Camera) {
    const k = Math.min(1, dt * 10);
    const t = now();
    for (const r of remotes.values()) {
      snapRemoteIfFar(r);
      r.x += (r.tx - r.x) * k;
      r.z += (r.tz - r.z) * k;
      let dy = r.tyaw - r.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      r.yaw += dy * k;
      r.lookYaw += (r.tLookYaw - r.lookYaw) * Math.min(1, dt * 10);
      r.pitch += (r.tPitch - r.pitch) * Math.min(1, dt * 10);
      if (!r.seated && r.moving) {
        r.bob += dt * 10;
        const swing = Math.sin(r.bob) * 0.55;
        r.rig.legL.rotation.x = swing; r.rig.legR.rotation.x = -swing;
        r.rig.shinL.rotation.x = Math.max(0, -swing * 0.5); r.rig.shinR.rotation.x = Math.max(0, swing * 0.5);
        r.rig.root.position.y = Math.abs(Math.sin(r.bob * 2)) * 0.03;
        if (r.throwT <= 0) { swingArms(r, swing); hideHold(r); }
      } else if (!r.seated) {
        r.rig.legL.rotation.x *= 0.8; r.rig.legR.rotation.x *= 0.8;
        r.rig.shinL.rotation.x *= 0.8; r.rig.shinR.rotation.x *= 0.8;
        r.rig.root.position.y *= 0.8;
        if (r.throwT <= 0) { hangArms(r, false); hideHold(r); }
      }
      if (r.throwT > 0) {
        r.throwT -= dt;
        poseThrow(r);
        if (r.throwT <= 0) { r.throwT = 0; applyActionPose(r); }
      }
      applyHeadLook(r);
      // 坐下略往前（負＝朝蚵堆），避免後背穿出椅背
      const back = r.seated ? -0.08 : 0;
      const ox = r.x + Math.sin(r.yaw) * back;
      const oz = r.z + Math.cos(r.yaw) * back;
      r.rig.outer.position.set(ox, 0, oz);
      r.rig.outer.rotation.y = r.yaw;
      r.rig.outer.updateMatrixWorld(true);
      placeAboveHead(r.tag, r, camera, 0.22);
      if (r.bubUntil > t) placeAboveHead(r.bubble, r, camera, 0.38, -6);
      else if (r.bubble.style.display !== 'none') r.bubble.style.display = 'none';
    }
    if (selfBubUntil > t) {
      const headY = selfSeated ? CHAIR_SEAT_Y + SIT_HIP_LIFT + 0.95 : 1.72;
      const back = selfSeated ? -0.08 : 0;
      const ox = selfX + Math.sin(selfYaw) * back;
      const oz = selfZ + Math.cos(selfYaw) * back;
      placeHud(selfBubble, ox, oz, headY, camera, -6);
    } else if (selfBubble.style.display !== 'none') selfBubble.style.display = 'none';
  }

  function dispose() {
    for (const r of [...remotes.values()]) destroyRemote(r);
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

  return { root, pileGroups, syncRoster, upsert, remove, pruneSelf, applyPose, setPhase, highlight, highlightNear, hitPile, aimTargets, showChat, setSelfPose, playThrowFx, tick, dispose };
}

export function tickPlazaTags(view: PlazaWorldView | null, camera: THREE.Camera, dt = 0.016) {
  if (!view) return;
  view.tick(dt, camera);
}
