import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { applyOutfitToRig, normalizeOutfitIds, outfitKey, headTopLift } from '../shop/equipVisual';
import { makeOysterBaby } from '../shop/pets';
import {
  AMA_LOOKS, AMA_SCALE, AMA_SIT_LIFT, AMA_CARRY_TILT, AMA_CARRY_Y, AMA_CARRY_FWD, AMA_CARRY_ROLL, AMA_CARRY_LIE_BACK, AMA_CARRY_LIE_Y,
  amaCarrySide, pickAmaLook, amaShirtHex,
  dressPlazaAma, dressPlazaAber, applyAmaAppearance,
} from './amaLook';
import {
  makePlayerAvatar, posePlazaHangArms, posePlazaWalkSwingArms, posePlazaWalkCycle, plazaGaitRate, posePlazaJump,
  posePlazaSit, posePlazaStand, posePlazaSmokeSit, posePlazaCarried, posePlazaCarryHold, easeSmokePuff,
  clearPlazaSmokeCig, getPlazaSmokeCig, ensurePlazaSmokeCig,
  plazaJumpHeight, PLAZA_JUMP_DUR, posePlazaStallKeeper, applyPlazaBodyPose, type PlayerRig,
  PLAZA_SIT_ROOT_Y,
} from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { makePlazaShedRow } from './shedRow';
import { PILE_COUNT, SLOTS_PER_PILE, NPC_SLOTS_PER_PILE, WALK_BOUND, PLAZA_LAMP_XZ, pileCenter, seatPose, seatKey, pileHasNpc, pileIsGrill, pileIsRemoved, isSmokePile, isLeisurePile, isRestPile, isMgPile, MG_PILE_ID, MG_DECK_Y, SMOKE_PILE_ID, smokeNpcSeatPose, isPlazaAber, plazaGroundY, type PlazaSeatRef } from './layout';
import { makeYardLikePile, makePlazaGrill, makePlazaFloorMaps, makePlazaBigShed, CHAIR_SEAT_Y, PLAZA_ROOF_Y } from './props';
import { makeInstancedPlazaChairs, makeInstancedPads, type ChairPose } from './instancedProps';
import { bakeStaticLighting } from './bakeLighting';
import { mergeStaticMeshes, countMeshes } from './mergeStatic';
import { makePlazaAmbiance, PLAZA_STALL_SITES } from './ambiance';
import { makePlazaSmokeArea } from './smokeArea';
import { buildMgMounts, aimMgMount, MgFxSystem, type MgHitTarget } from './mgGun';
import { makePlazaCafe } from './cafe';
import { makePlazaSeafood } from './seafood';
import { makePlazaHq } from './hq';
import { createGrillView, type PlazaGrillView } from './grillView';
import { makeCigSmoke, makeExhalePuff, spawnAshSpeck, type CharcoalFireFx } from './fireFx';
import { makeWorldLabel, type WorldLabel } from '../world/worldLabel';
import type { PlazaAimTarget, PlazaPlayer, PlazaSnapshot, PlazaSeatWish } from './types';
import { pileDiffOf, DEFAULT_PILE_DIFFS, PILE_DIFF_NAMES } from './pileDiff';
import { plazaDisplayName } from './types';
import { GOLD_SMOKE_TINT, parseCosmetics } from './cosmetics';
import { createPlazaFlagView } from './flagView';
import type { PlazaFlagState } from './flags';

type Remote = {
  /** Map key＝pid（同一人只留一具模型，重連換 connId 不複製） */
  key: string;
  /** 目前 Hub connectionId（丟殼／偷肉瞄準用） */
  connId: string;
  pid: string;
  rig: PlayerRig;
  tag: WorldLabel;
  bubble: WorldLabel;
  bubUntil: number;
  pileId: number;
  slot: number;
  phase: string;
  count: number;
  nick: string;
  /** 社群 #號碼 */
  numTag: string;
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
  cigSmoke?: CharcoalFireFx;
  /** 遠端丟殼甩臂剩餘秒數 */
  throwT: number;
  /** 目標／目前轉頭 */
  tLookYaw: number; lookYaw: number;
  tPitch: number; pitch: number;
  /** 工作姿勢附加的頭傾（再疊 look pitch） */
  headWorkX: number;
  /** 抽一口把菸舉到嘴邊的程度 0..1；越接近 1 越不套鏡頭俯仰／轉頭，嘴才對得到菸 */
  smokeK?: number;
  /** 剛進場、座標尚不可信：先藏模型，避免從原點高速滑行 */
  awaitingPose: boolean;
  isNpc?: boolean;
  carriedBy?: string;
  cosmetics?: string;
  /** 遠端「抽一口」：舉臂／吸氣／吐煙 */
  puff?: {
    held: boolean;
    animT: number;
    awayT: number;
    holdMs: number;
    /** performance.now：逾時自動放下 */
    autoEndAt: number;
    /** 放開後排程吐煙（0＝無） */
    releaseAt: number;
    exhaled: boolean;
  };
};

const SHIRTS = [0xc45c26, 0x3a6ea5, 0x2f7d4a, 0x8a3a6a, 0x6a5a2a, 0x4a4a7a];
const HAIRS = [0x222222, 0x555555, 0x888888, 0x3a2a1a, 0xdddddd];
/** 廣場阿婆外觀（花布衫、袖套、白髮包髻、駝背）見 amaLook */

/**
 * 玩家 1:1；阿婆見 AMA_SCALE。
 * 坐時髖略高於椅面：大腿 mesh 在髖下方，對齊 HIP 會整個人沉進椅子。
 */
const AVATAR_SCALE = 1;
/** 髖高於坐墊，讓大腿／屁股貼在椅面上（數值見 character.PLAZA_SIT_*） */
const SIT_HIP_LIFT = 0.14;
const SIT_ROOT_Y = PLAZA_SIT_ROOT_Y;

const _hangDir = new THREE.Vector3();
const _hangX = new THREE.Vector3();
const _hangZ = new THREE.Vector3();
const _hangMat = new THREE.Matrix4();

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
  /** 共烤網上蚵仔 */
  grill: PlazaGrillView;
  syncFlags: (list: PlazaFlagState[]) => void;
  /** 坐下遠端玩家的瞄準點（丟殼／偷肉） */
  aimTargets: (leisureNpc?: boolean) => PlazaAimTarget[];
  /** 走動碰撞用：遠端 `[x, z, radius, isLie]`；isLie=1 時跳躍夠高可越过 */
  walkBodies: () => [number, number, number, number][];
  moonLaunch: (connId: string, delayMs?: number, fromX?: number, fromZ?: number) => void;
  /** 頭頂氣泡：最後一句聊天，約 5 秒 */
  showChat: (opts: { connId?: string; pid?: string; nick?: string; text: string; self?: boolean }) => void;
  setSelfPose: (x: number, z: number, yaw: number, seated: boolean, smoke?: boolean, connId?: string) => void;
  setSelfBody: (pz: string, pk: number, jy: number) => void;
  setSelfCushion: (on: boolean, pileId: number, slot: number) => void;
  playThrowFx: (connId: string) => void;
  /** 遠端抽一口：start 舉臂吸氣；end 放下並依 holdMs 吐煙 */
  applyRemotePuff: (opts: { connId?: string; pid?: string; start: boolean; holdMs: number }) => void;
  tick: (dt: number, camera: THREE.Camera) => void;
  /** 鏡頭更新後呼叫：木牆／厝頂淡化（需當幀 camera／focus） */
  tickTpOcclude: (dt: number, camera: THREE.Camera, focus?: THREE.Vector3) => void;
  setSeatWishes: (list: PlazaSeatWish[], selfConnId?: string) => void;
  /** 北碼頭工寮門口：鎖定／玩家站在圈內 */
  setShedDoorState: (loc: string, st: { locked: boolean; active: boolean }) => void;
  /** 機關槍座架 */
  mgMounts: THREE.Group[];
  aimMg: (slot: number, yaw: number, pitch: number) => void;
  mgFx: MgFxSystem;
  mgHitTargets: () => MgHitTarget[];
  dispose: () => void;
};

export type PlazaWorldOpts = {
  shellGeo: THREE.BufferGeometry;
  shellMat: THREE.Material;
  lowDetail?: boolean;
  /** 省電：執行中動態降燈／炭火／遠距角色 */
  eco?: () => boolean;
  /** 第三人稱：厝頂／牆淡化僅在 TP 需要 */
  getTpv?: () => boolean;
  /** 自己裝備了寵物（坐姿時寵物在頭頂、聊天泡泡要讓位） */
  hasOwnPet?: () => boolean;
  /** 自己頭上帽子高出髮蓋頂的量（公尺）；有寵物+坐姿時聊天泡泡要再多抬這麼多 */
  selfHatLift?: () => number;
  /** 遠端進場時預編譯著色器，避免準心第一次掃到才卡 */
  getRenderer?: () => THREE.WebGLRenderer | null | undefined;
  /** 正確預熱（含 hidden 臉盆）；優先於 getRenderer.compile */
  warmGpu?: (root: THREE.Object3D) => void;
};

export function createPlazaWorldView(
  scene: THREE.Scene,
  bubblesHost: HTMLElement,
  opts: PlazaWorldOpts,
): PlazaWorldView {
  const LO = !!opts.lowDetail;
  const MOBILE = matchMedia('(pointer: coarse)').matches;
  const root = new THREE.Group(); root.name = 'plazaWorld'; scene.add(root);
  const { M, add } = makeMeshHelpers(scene, LO);
  const remotes = new Map<string, Remote>();
  const seatMeshes = new Map<string, THREE.Mesh>();
  const pileGroups: THREE.Group[] = [];
  const chairsRoot = new THREE.Group();
  chairsRoot.name = 'plazaChairs';
  root.add(chairsRoot);
  const chairPoses: ChairPose[] = [];
  let nearKey: string | null = null;
  let padTaken = new Set<string>();
  const cushions = new Map<string, THREE.Group>();
  function makeSeatCushion() {
    const g = new THREE.Group();
    g.name = 'seatCushion';
    const fabric = new THREE.MeshStandardMaterial({ color: 0x8a1820, roughness: 0.82, metalness: 0.08 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.38, metalness: 0.55, emissive: 0x3a2808, emissiveIntensity: 0.18 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.034, 0.38), fabric);
    g.add(pad);
    const tw = 0.016, th = 0.01;
    const rim: [number, number, number, number, number, number][] = [
      [0.40, th, tw, 0, 0.018, 0.182],
      [0.40, th, tw, 0, 0.018, -0.182],
      [tw, th, 0.348, 0.192, 0.018, 0],
      [tw, th, 0.348, -0.192, 0.018, 0],
    ];
    for (const [w, h, d, x, y, z] of rim) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gold);
      m.position.set(x, y, z);
      g.add(m);
    }
    const dia = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.09), gold);
    dia.rotation.y = Math.PI / 4;
    dia.position.y = 0.02;
    g.add(dia);
    return g;
  }
  function disposeCushion(g: THREE.Group) {
    root.remove(g);
    g.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(x => x.dispose());
      else mat?.dispose();
    });
  }
  function syncCushion(key: string, on: boolean, pileId: number, slot: number) {
    const existing = cushions.get(key);
    if (!on || pileId < 0 || slot < 0) {
      if (existing) { disposeCushion(existing); cushions.delete(key); }
      return;
    }
    const pose = seatPose(pileId, slot);
    const g = existing ?? makeSeatCushion();
    if (!existing) { root.add(g); cushions.set(key, g); }
    g.position.set(pose.pos.x, CHAIR_SEAT_Y + 0.04, pose.pos.z);
    g.rotation.set(0, pose.yaw, 0);
  }

  // 水泥廣場貼皮（分格對齊蚵堆）
  const floorMaps = makePlazaFloorMaps(LO ? 256 : 512);
  const floorMat: THREE.Material = LO
    ? new THREE.MeshLambertMaterial({ map: floorMaps.map, color: 0xffffff })
    : new THREE.MeshStandardMaterial({
      map: floorMaps.map,
      roughnessMap: floorMaps.rough,
      roughness: 0.92,
      metalness: 0.02,
      color: 0xffffff,
    });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALK_BOUND * 2.4, WALK_BOUND * 2.4, LO ? 36 : 48, LO ? 36 : 48), floorMat);
  floor.name = 'plazaFloor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = !LO;
  root.add(floor);

  const fireFx: CharcoalFireFx[] = [];
  for (let i = 0; i < PILE_COUNT; i++) {
    if (pileIsRemoved(i)) continue;
    const c = pileCenter(i);
    // 南排烤蚵台；其餘沿用工寮蚵山（InstancedMesh）
    const pile = pileIsGrill(i)
      ? makePlazaGrill(opts.shellGeo, opts.shellMat, i, LO)
      : makeYardLikePile(opts.shellGeo, opts.shellMat, i, LO ? 96 : 210);
    pile.position.copy(c);
    root.add(pile);
    pileGroups.push(pile);
    const fx = pile.userData.fireFx as CharcoalFireFx | undefined;
    if (fx) fireFx.push(fx);

    const seatN = SLOTS_PER_PILE + (pileHasNpc(i) ? NPC_SLOTS_PER_PILE : 0);
    for (let s = 0; s < seatN; s++) {
      const pose = seatPose(i, s);
      chairPoses.push({ x: pose.pos.x, z: pose.pos.z, yaw: pose.yaw, key: seatKey(i, s) });
    }
  }

  // 廣場大棚（鏽鐵皮＋外圈木柱；厝頂／高樑可第三人稱半透明）
  const bigShed = makePlazaBigShed(M, add, LO);
  root.add(bigShed.group);
  const tpOccludeMats = bigShed.tpOccludeMats;
  let tpOccludeK = 0;
  const _tpOccRay = new THREE.Raycaster();
  const _tpOccFrom = new THREE.Vector3();
  const _tpOccDir = new THREE.Vector3();
  // 外圈夜市攤／烤肉區（氣氛；碰撞見 plazaStallObstacles）
  const ambiance = makePlazaAmbiance(M, add, LO);
  root.add(ambiance.group);

  // 西側棚外吸菸區（座位 pileId=SMOKE_PILE_ID）
  const smokeArea = makePlazaSmokeArea(M, add, LO);
  root.add(smokeArea.group);
  for (const [k, pad] of smokeArea.seatPads) seatMeshes.set(k, pad);
  chairPoses.push(...smokeArea.chairPoses);
  // 蚵仔機關槍：烤區旁高台＋槍座
  const mgMounts = buildMgMounts(root, LO);
  for (let i = 0; i < mgMounts.length; i++) {
    const pad = mgMounts[i].children.find(c => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry.type === 'CircleGeometry') as THREE.Mesh | undefined;
    if (pad) seatMeshes.set(seatKey(MG_PILE_ID, i), pad);
  }
  const mgFx = new MgFxSystem(opts.shellGeo, opts.shellMat, LO);
  root.add(mgFx.root);

  // 東南角多那芝咖啡外觀＋門口吸菸區（座位 pileId=CAFE_SMOKE_PILE_ID）
  const cafe = makePlazaCafe(M, add, LO);
  root.add(cafe.group);
  for (const [k, pad] of cafe.seatPads) seatMeshes.set(k, pad);

  // 多那芝北側海產店「樸子腳」外觀＋門口座位（pileId=SEAFOOD_PILE_ID，純坐）
  const seafood = makePlazaSeafood(M, add, LO);
  root.add(seafood.group);
  for (const [k, pad] of seafood.seatPads) seatMeshes.set(k, pad);

  // 樸子腳北側「聯合競選總部」組合屋外觀（無座位、無點光）
  const hq = makePlazaHq(M, add, LO);
  root.add(hq.group);

  // 北側碼頭工寮街：四間工寮＋門口圓圈（無燈）
  const shedRow = makePlazaShedRow(M, add, LO);
  root.add(shedRow.group);

  const plazaChairs = makeInstancedPlazaChairs(chairPoses, M, LO);
  chairsRoot.add(plazaChairs.group);

  // 合併靜態桌椅／棚架／攤位（略過選位墊、炭火、吊扇、薄煙；店面小零件留給遠景 LOD）
  const padSet = new Set<THREE.Object3D>([...seatMeshes.values()]);
  const skipMerge = (m: THREE.Mesh) => {
    if (padSet.has(m)) return true;
    if (m.userData.tpOcclude) return true;
    let p: THREE.Object3D | null = m;
    while (p) {
      if (p.name === 'charcoalFire' || p.name === 'plazaCeilingFan' || p.name === 'cigSmoke' || p.name === 'seatCushion' || p.name === 'shedRing' || p.name === 'shedLock' || p.name === 'shedWheel' || p.name === 'plazaTpOcclude') return true;
      p = p.parent;
    }
    return false;
  };
  const meshBefore = countMeshes(root);
  mergeStaticMeshes(chairsRoot, { skip: skipMerge, name: 'chairsMerged' });
  mergeStaticMeshes(bigShed.group, { skip: skipMerge, name: 'shedMerged' });
  // 厝頂／樑另合，保留可調 opacity 的材質
  mergeStaticMeshes(bigShed.tpOcclude, { name: 'shedRoofMerged' });
  for (const pile of pileGroups) mergeStaticMeshes(pile, { skip: skipMerge, name: 'pileMerged' });
  mergeStaticMeshes(ambiance.group, { skip: skipMerge, name: 'ambianceMerged' });
  mergeStaticMeshes(smokeArea.group, { skip: skipMerge, name: 'smokeMerged' });
  mergeStaticMeshes(cafe.group, { skip: skipMerge, name: 'cafeMerged' });
  mergeStaticMeshes(seafood.group, { skip: skipMerge, name: 'seafoodMerged' });
  mergeStaticMeshes(hq.group, { skip: skipMerge, name: 'hqMerged' });
  mergeStaticMeshes(shedRow.group, { skip: skipMerge, name: 'shedRowMerged' });
  root.userData.mergeStats = { meshesBefore: meshBefore, meshesAfter: countMeshes(root) };

  root.updateMatrixWorld(true);
  const extraPadPoses: ChairPose[] = [];
  const _padW = new THREE.Vector3();
  const _padE = new THREE.Euler();
  const _padQ = new THREE.Quaternion();
  const _padS = new THREE.Vector3();
  for (const [key, mesh] of [...seatMeshes]) {
    mesh.updateWorldMatrix(true, false);
    mesh.matrixWorld.decompose(_padW, _padQ, _padS);
    _padE.setFromQuaternion(_padQ, 'YXZ');
    // 機關槍高台：強制貼在甲板面上（甲板頂＝DECK_Y+0.12，圓圈不可再低）
    const py = key.startsWith(`${MG_PILE_ID}:`) ? Math.max(_padW.y, MG_DECK_Y + 0.14) : _padW.y;
    extraPadPoses.push({ x: _padW.x, y: py, z: _padW.z, yaw: _padE.y, key });
    mesh.removeFromParent();
    seatMeshes.delete(key);
  }
  const extraPads = extraPadPoses.length ? makeInstancedPads(extraPadPoses, M, LO) : null;
  if (extraPads) root.add(extraPads.mesh);
  bakeStaticLighting(root, {
    includeDirect: LO,
    sunDir: new THREE.Vector3(-3, 11, -5),
    lampXZ: PLAZA_LAMP_XZ,
    lampY: PLAZA_ROOF_Y - 0.55,
    lampPool: true,
  });
  const allPads = extraPads ? [plazaChairs.pads, extraPads] : [plazaChairs.pads];
  const paintInstancedPads = (taken: Set<string> | null) => {
    for (const api of allPads) {
      for (const k of api.keys()) {
        api.setPad(k, { busy: taken ? taken.has(k) : false, highlight: nearKey != null && k === nearKey });
      }
      api.apply();
    }
  };

  // 遠景細節裁切：建築小零件（窗框、桌上小物、菸蒂…）與貼圖招牌，鏡頭離建築夠遠就不畫
  type DetailLod = { box: THREE.Box3; small: THREE.Object3D[]; signs: THREE.Object3D[]; smallOn: boolean; signOn: boolean };
  const detailLods: DetailLod[] = [];
  {
    const padSet = new Set<THREE.Object3D>([...cafe.seatPads.values(), ...seafood.seatPads.values()]);
    const sph = new THREE.Sphere(), sc = new THREE.Vector3();
    for (const g of [cafe.group, seafood.group, hq.group]) {
      g.updateMatrixWorld(true);
      const d: DetailLod = { box: new THREE.Box3().setFromObject(g), small: [], signs: [], smallOn: true, signOn: true };
      const walk = (o: THREE.Object3D) => {
        if (o.userData.noLod || padSet.has(o)) return;
        const m = o as THREE.Mesh;
        if (m.isMesh && o.visible && !(m as any).isInstancedMesh) {
          const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
          const geo = m.geometry;
          o.getWorldScale(sc);
          // 招牌＝有貼圖的細長平面（高 ≤ 0.8 m）；整面店面貼圖牆不算，避免遠看破洞
          const pg = geo as THREE.PlaneGeometry;
          if (mat?.map && geo.type === 'PlaneGeometry' && pg.parameters.height * sc.y <= 0.8) { d.signs.push(o); return; }
          if (mat?.map) { for (const c of o.children) walk(c); return; }
          if (!geo.boundingSphere) geo.computeBoundingSphere();
          sph.copy(geo.boundingSphere!);
          if (sph.radius * Math.max(sc.x, sc.y, sc.z) < 0.3) { d.small.push(o); return; }
        }
        for (const c of o.children) walk(c);
      };
      walk(g);
      detailLods.push(d);
    }
  }
  let lodT = 0;
  const _lodP = new THREE.Vector3();
  /** 鏡頭到建築外框的水平距離；小零件 >25 m、招牌 >40 m 不畫（±2 m 緩衝免閃） */
  function tickDetailLod(dt: number, cx: number, cz: number) {
    if ((lodT -= dt) > 0) return;
    lodT = 0.25;
    for (const d of detailLods) {
      _lodP.set(cx, (d.box.min.y + d.box.max.y) / 2, cz);
      d.box.clampPoint(_lodP, _lodP);
      const dist = Math.hypot(_lodP.x - cx, _lodP.z - cz);
      const smallOn = d.smallOn ? dist < 27 : dist < 23;
      const signOn = d.signOn ? dist < 42 : dist < 38;
      if (smallOn !== d.smallOn) { d.smallOn = smallOn; for (const o of d.small) o.visible = smallOn; }
      if (signOn !== d.signOn) { d.signOn = signOn; for (const o of d.signs) o.visible = signOn; }
    }
  }

  // 攤位老闆（純客戶端，不經伺服器）：站在攤台後方、面向廣場中心
  const stallKeepers: { rig: PlayerRig; ph: number; lines: string[]; bub: WorldLabel | null; next: number; until: number; li: number }[] = [];
  const KEEPER_LINES: Record<string, string[]> = {
    bbq: ['烤肉喔！剛烤好的！', '香腸一支三十，兩支五十五！', '來喔來喔，烤玉米也有！', '要辣的跟我說喔～'],
    'drink-s': ['冰涼的青草茶喔！', '剝蚵剝到口渴了吧？來一杯！', '冬瓜茶、楊桃汁，現倒現喝！', '大杯的才三十喔！'],
  };
  PLAZA_STALL_SITES.filter((s) => KEEPER_LINES[s.id]).forEach((site, idx) => {
    const look = AMA_LOOKS[(idx * 3 + 1) % AMA_LOOKS.length];
    const rig = makePlayerAvatar({ shirt: amaShirtHex(look), hair: look.hair, pants: look.pants }, M, add, LO, true);
    dressPlazaAma(rig, look);
    posePlazaHangArms(rig, false);
    applyAmaAppearance(rig);
    const out = Math.atan2(site.x, site.z);
    const back = site.kind === 'cart' ? 0.6 : 0.68;
    rig.outer.position.set(site.x + Math.sin(out) * back, 0, site.z + Math.cos(out) * back);
    rig.outer.rotation.y = out;
    rig.outer.userData.skipTpOcclude = true;
    root.add(rig.outer);
    stallKeepers.push({ rig, ph: idx * 1.7, lines: KEEPER_LINES[site.id], bub: null, next: 3 + idx * 4, until: 0, li: idx });
  });

  // 吸菸區氣氛阿伯（純客戶端、固定椅；不可入座／不可瞄準；與遠端抽一口同套 pose）
  type SmokeNpc = {
    rig: PlayerRig;
    tag: WorldLabel;
    phase: 'idle' | 'up' | 'hold' | 'down';
    animT: number;
    awayT: number;
    holdT: number;
    holdDur: number;
    nextAt: number;
    releaseAt: number;
    holdMs: number;
    flickT: number;
    ashCD: number;
    ashes: { tick: (dt: number) => boolean; dispose: () => void }[];
    exhales: { fx: CharcoalFireFx; age: number; life: number; yaw: number }[];
  };
  const smokeNpcPose = smokeNpcSeatPose();
  const smokeNpcRig = makePlayerAvatar(
    { shirt: 0x4a6a8a, hair: 0x8a8a8a, pants: 0x3a3a48 },
    M, add, LO, true,
  );
  dressPlazaAber(smokeNpcRig);
  smokeNpcRig.outer.scale.setScalar(AVATAR_SCALE);
  smokeNpcRig.outer.position.set(smokeNpcPose.pos.x, 0, smokeNpcPose.pos.z);
  smokeNpcRig.outer.rotation.order = 'YXZ';
  smokeNpcRig.outer.rotation.y = smokeNpcPose.yaw;
  // 坐下根節點高度（與遠端坐姿一致）
  smokeNpcRig.root.position.y = SIT_ROOT_Y;
  posePlazaSmokeSit(smokeNpcRig, 0);
  smokeNpcRig.outer.userData.skipTpOcclude = true;
  root.add(smokeNpcRig.outer);
  const smokeNpcTag = ensureTag('阿伯', true);
  smokeNpcTag.sprite.position.set(smokeNpcPose.pos.x, CHAIR_SEAT_Y + SIT_HIP_LIFT + 0.95, smokeNpcPose.pos.z);
  smokeNpcTag.sprite.visible = true;
  const smokeNpc: SmokeNpc = {
    rig: smokeNpcRig,
    tag: smokeNpcTag,
    phase: 'idle',
    animT: 0,
    awayT: 0,
    holdT: 0,
    holdDur: 1.2,
    nextAt: performance.now() * 0.001 + 2.5 + (Math.abs(hashPid('smoke-npc-aber')) % 40) * 0.05, // ~2.5–4.5s 首抽
    releaseAt: 0,
    holdMs: 0,
    flickT: 0,
    ashCD: 5 + (Math.abs(hashPid('smoke-npc-aber')) % 30) * 0.1,
    ashes: [],
    exhales: [],
  };
  function smokeNpcRandHoldSec() {
    // 8–15s idle 間隔（決定論種子疊時間）
    const h = Math.abs(hashPid('smoke-npc-aber') + ((performance.now() / 1000) | 0));
    return 8 + (h % 70) / 10; // 8.0–14.9
  }
  function tickSmokeNpc(dt: number, tSec: number, eco: boolean, cx: number, cz: number) {
    const sn = smokeNpc;
    const dist2 = (sn.rig.outer.position.x - cx) ** 2 + (sn.rig.outer.position.z - cz) ** 2;
    const far = eco && dist2 > 20 * 20;
    const hide = eco && dist2 > 60 * 60;
    sn.rig.outer.visible = !hide;
    sn.tag.sprite.visible = !hide;
    if (far) return;
    ensurePlazaSmokeCig(sn.rig, LO);
    const cig = getPlazaSmokeCig(sn.rig);
    if (cig) cig.tick(tSec, dt);

    const now = performance.now();
    if (sn.phase === 'idle') {
      if (now * 0.001 >= sn.nextAt) {
        sn.phase = 'up';
        sn.animT = 0;
        sn.awayT = 0;
        sn.holdT = 0;
        sn.holdDur = 0.9 + (Math.abs(hashPid('smoke-hold') + (now | 0)) % 12) / 10; // 0.9–2.0s
        sn.holdMs = 0;
        sn.releaseAt = 0;
      } else {
        // idle 偶發彈烟灰
        if (!LO) {
          sn.ashCD -= dt;
          if (sn.ashCD <= 0 && sn.flickT <= 0) {
            sn.flickT = 1;
            sn.ashCD = 6 + (Math.abs(hashPid('ash') + (now | 0)) % 40) / 10;
            if (cig) sn.ashes.push(spawnAshSpeck(cig.group, new THREE.Vector3(0.02, 0.02, -0.2)));
          }
        }
      }
    } else if (sn.phase === 'up') {
      sn.animT = Math.min(1, sn.animT + dt / 0.7);
      if (sn.animT >= 1) { sn.phase = 'hold'; sn.holdT = 0; }
    } else if (sn.phase === 'hold') {
      sn.holdT += dt;
      sn.holdMs = Math.min(5000, Math.round(sn.holdT * 1000));
      sn.animT = 1;
      if (sn.holdT >= sn.holdDur) {
        sn.phase = 'down';
        sn.awayT = 0;
        sn.releaseAt = now;
      }
    } else if (sn.phase === 'down') {
      // 放開：一邊放下一邊略離嘴，不再先彈回嘴邊
      sn.animT = Math.max(0, sn.animT - dt / 0.5);
      sn.awayT = sn.animT > 0 ? Math.min(1, sn.awayT + dt / 0.12) : 0;
      if (sn.releaseAt && now - sn.releaseAt >= 1000) {
        const ms = sn.holdMs;
        sn.releaseAt = 0;
        if (ms >= 300) {
          const strength = Math.min(1, ms / 5000);
          const sc = 0.35 + strength * 1.15;
          const fx = makeExhalePuff({
            scale: sc,
            count: LO ? Math.round(4 + strength * 4) : Math.round(6 + strength * 8),
            seed: 7200 + (Math.abs(hashPid('exh') + (now | 0)) % 4000),
            reach: strength,
          });
          sn.rig.head.updateMatrixWorld(true);
          const mouth = sn.rig.head.localToWorld(new THREE.Vector3(0, -0.08, -0.16));
          const yaw = sn.rig.outer.rotation.y;
          fx.group.position.copy(mouth);
          fx.group.rotation.y = yaw;
          root.add(fx.group);
          sn.exhales.push({ fx, age: 0, life: 3.6, yaw });
        }
      }
      if (sn.animT <= 0.001 && sn.awayT <= 0.001 && !sn.releaseAt) {
        sn.phase = 'idle';
        sn.nextAt = now * 0.001 + smokeNpcRandHoldSec();
      }
    }
    if (sn.flickT > 0) sn.flickT = Math.max(0, sn.flickT - dt / 0.28);
    const inhale = sn.phase === 'hold' ? 1 : (sn.phase === 'up' && sn.animT > 0.7 ? (sn.animT - 0.7) / 0.3 : 0);
    posePlazaSmokeSit(sn.rig, {
      puffK: easeSmokePuff(sn.animT),
      inhale,
      away: sn.awayT,
      flick: Math.sin(sn.flickT * Math.PI),
    });
    if (cig) cig.setTipBoost(inhale * 1.2 + (sn.phase === 'hold' || sn.phase === 'up' ? 0.35 : 0));

    for (let i = sn.ashes.length - 1; i >= 0; i--) {
      if (!sn.ashes[i].tick(dt)) { sn.ashes[i].dispose(); sn.ashes.splice(i, 1); }
    }
    for (let i = sn.exhales.length - 1; i >= 0; i--) {
      const e = sn.exhales[i];
      e.age += dt;
      e.fx.tick(tSec, dt);
      if (e.age >= e.life) {
        try { e.fx.group.parent?.remove(e.fx.group); } catch { /* */ }
        e.fx.dispose();
        sn.exhales.splice(i, 1);
      }
    }
    // 名牌跟頭
    const headY = CHAIR_SEAT_Y + SIT_HIP_LIFT + 0.95;
    sn.tag.sprite.position.set(sn.rig.outer.position.x, headY, sn.rig.outer.position.z);
  }

  // 南排共烤：伺服器同步的烤網上蚵仔
  const grill = createGrillView(root);
  const flags = createPlazaFlagView(root);

  // 蚵堆桌種牌：四種文案共用貼圖，各桌獨立 material 以便距離淡出
  const pileDiffTemplates: WorldLabel[] = PILE_DIFF_NAMES.map(name =>
    makeWorldLabel(name, 'name', { worldH: 0.26, depthTest: true, nameTone: 'sign' }),
  );
  type PileDiffSprite = { pileId: number; kind: number; sprite: THREE.Sprite };
  const pileDiffSprites: PileDiffSprite[] = [];
  const PILE_DIFF_LABEL_Y = 0.88;
  const PILE_DIFF_FADE_START = 8;
  const PILE_DIFF_FADE_END = 14;

  function makePileDiffSprite(pileId: number, kind: number): THREE.Sprite | null {
    if (kind < 0 || kind >= pileDiffTemplates.length) return null;
    const tmpl = pileDiffTemplates[kind];
    const mat = (tmpl.sprite.material as THREE.SpriteMaterial).clone();
    const sprite = new THREE.Sprite(mat);
    sprite.center.copy(tmpl.sprite.center);
    sprite.scale.copy(tmpl.sprite.scale);
    sprite.renderOrder = tmpl.sprite.renderOrder;
    const c = pileCenter(pileId);
    sprite.position.set(c.x, PILE_DIFF_LABEL_Y, c.z);
    sprite.name = `pileDiff:${pileId}`;
    return sprite;
  }
  for (let i = 0; i < PILE_COUNT; i++) {
    const kind = pileDiffOf(i, DEFAULT_PILE_DIFFS);
    const sprite = makePileDiffSprite(i, kind);
    if (!sprite) continue;
    root.add(sprite);
    pileDiffSprites.push({ pileId: i, kind, sprite });
  }
  function applyPileDiffs(diffs?: number[] | null) {
    for (const s of pileDiffSprites) {
      const kind = pileDiffOf(s.pileId, diffs);
      if (kind === s.kind) continue;
      if (kind < 0) { s.sprite.visible = false; s.kind = -1; continue; }
      s.sprite.visible = true;
      const oldMat = s.sprite.material as THREE.SpriteMaterial;
      const mat = (pileDiffTemplates[kind].sprite.material as THREE.SpriteMaterial).clone();
      mat.opacity = oldMat.opacity;
      s.sprite.material = mat;
      oldMat.dispose();
      s.kind = kind;
    }
  }
  function tickPileDiffSigns(cx: number, cz: number) {
    const span = PILE_DIFF_FADE_END - PILE_DIFF_FADE_START;
    // 自己坐著時不顯示難度牌（擋視線；坐下提示已帶難度）
    const hideAll = selfSeated;
    for (const s of pileDiffSprites) {
      if (s.kind < 0 || hideAll) { s.sprite.visible = false; continue; }
      const d = Math.hypot(s.sprite.position.x - cx, s.sprite.position.z - cz);
      let a = 1;
      if (d >= PILE_DIFF_FADE_END) a = 0;
      else if (d > PILE_DIFF_FADE_START) a = 1 - (d - PILE_DIFF_FADE_START) / span;
      s.sprite.visible = a > 0.02;
      (s.sprite.material as THREE.SpriteMaterial).opacity = a;
    }
  }
  function disposePileDiffSigns() {
    for (const s of pileDiffSprites) {
      s.sprite.removeFromParent();
      (s.sprite.material as THREE.SpriteMaterial).dispose();
    }
    pileDiffSprites.length = 0;
    for (const t of pileDiffTemplates) t.dispose();
  }


  // 一盞真正的點光源放在廣場正中央、高掛屋頂下，照亮整個廣場；四盞吊燈外觀靠自發光＋烘焙暖光
  const plazaLights: THREE.PointLight[] = [];
  const roofLamps: THREE.PointLight[] = [];
  const roofLampBaseI = LO ? 9 : 10;
  {
    // 廣場半徑約 12 m，distance 原本 26 m 會讓 shader 多算一大圈其實看不到的像素
    const pl = new THREE.PointLight(0xffe2b8, roofLampBaseI, 14, 0.7);
    pl.position.set(0, PLAZA_ROOF_Y - 0.35, 0);
    pl.castShadow = false;
    pl.visible = true;
    root.add(pl);
    plazaLights.push(pl);
    roofLamps.push(pl);
  }
  const _firePos = new THREE.Vector3();
  let fireThrottle = 0;

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

  const _aimH = new THREE.Vector3(), _aimB = new THREE.Vector3();
  function aimTargets(leisureNpc = false): PlazaAimTarget[] {
    const out: PlazaAimTarget[] = [];
    for (const r of remotes.values()) {
      const carried = !!(r.carriedBy || (r.phase || '') === 'carried');
      if (carried && r.isNpc && (r.phase || '') !== 'moon') {
        const h = headWorld(r, _aimH);
        const b = bowlWorld(r, _aimB);
        out.push({
          connId: r.connId || r.key,
          nick: plazaDisplayName(r.nick, r.numTag),
          pileId: r.pileId,
          phase: r.phase || 'carried',
          x: r.x, z: r.z, yaw: r.yaw,
          lookYaw: r.tLookYaw,
          seated: false,
          count: r.count,
          umb: r.umb,
          isNpc: r.isNpc,
          carriedBy: r.carriedBy,
          head: { x: h.x, y: h.y, z: h.z },
          bowl: { x: b.x, y: b.y, z: b.z },
        });
        continue;
      }
      // 被放在原地站著的阿婆：只給飛彈瞄
      const standNpc = leisureNpc && r.isNpc && !r.seated && !carried && (r.phase || '') === 'stand';
      if (standNpc) {
        const h = headWorld(r, _aimH);
        out.push({
          connId: r.connId || r.key,
          nick: plazaDisplayName(r.nick, r.numTag),
          pileId: -1,
          phase: 'stand',
          x: r.x, z: r.z, yaw: r.yaw,
          lookYaw: r.tLookYaw,
          seated: false,
          count: r.count,
          umb: r.umb,
          isNpc: true,
          head: { x: h.x, y: h.y, z: h.z },
          bowl: { x: h.x, y: h.y, z: h.z },
        });
        continue;
      }
      // 休息座（吸菸區／咖啡廳／樸子腳）只給飛彈瞄阿婆，不給丟殼／偷
      if (!r.seated || r.pileId < 0 || (isLeisurePile(r.pileId) && !(leisureNpc && r.isNpc)) || (r.phase || '') === 'moon') continue;
      const h = headWorld(r, _aimH);
      const b = bowlWorld(r, _aimB);
      out.push({
        connId: r.connId || r.key,
        nick: plazaDisplayName(r.nick, r.numTag),
        pileId: r.pileId,
        phase: r.phase || '',
        x: r.x, z: r.z, yaw: r.yaw,
        // 偷肉「在看」用同步目標角，勿用插值中的 lookYaw（會跟伺服器 distract 脫節）
        lookYaw: r.tLookYaw,
        seated: true,
        count: r.count,
        umb: r.umb,
        isNpc: r.isNpc,
        head: { x: h.x, y: h.y, z: h.z },
        bowl: { x: b.x, y: b.y, z: b.z },
      });
    }
    return out;
  }

  function moonLaunch(connId: string, delayMs = 0, fromX?: number, fromZ?: number) {
    for (const r of remotes.values()) {
      if ((r.connId || r.key) !== connId) continue;
      const rj = r as any;
      const now = performance.now();
      // 本地樂觀發射後伺服器 NpcMoon 回聲會再叫一次：飛行中／已排程勿重設 mt／mz
      // （否則會用已位移的 outer.position 重算方向，本地射手看到的軌跡就歪了）
      if (rj.mt && now < rj.mt + 1800) continue;
      const o = r.rig.outer.position;
      rj.mt = now + delayMs;
      rj.mz = fromX == null || fromZ == null ? Math.random() * 6.28 : Math.atan2(o.x - fromX, o.z - fromZ);
    }
  }

function hashPid(pid: string) {
    let h = 0; for (let i = 0; i < pid.length; i++) h = (h * 31 + pid.charCodeAt(i)) | 0;
    return h;
  }
  function hashLook(pid: string, isNpc = false) {
    const h = hashPid(pid);
    if (isNpc) {
      const a = pickAmaLook(pid);
      return { shirt: amaShirtHex(a), hair: a.hair, pants: a.pants };
    }
    return { shirt: SHIRTS[Math.abs(h) % SHIRTS.length], hair: HAIRS[Math.abs(h >> 3) % HAIRS.length], pants: 0x2a2a40 };
  }

  void bubblesHost;

  const selfBubble = makeWorldLabel(' ', 'bubble', { worldH: 0.36 });
  selfBubble.sprite.visible = false;
  root.add(selfBubble.sprite);
  let selfBubUntil = 0;
  let selfX = 0, selfZ = 0, selfYaw = 0, selfSeated = false, selfSmoke = false;
  let selfCig: CharcoalFireFx | null = null;
  const _tagHead = new THREE.Vector3();

  /** 掛在 root（勿掛 head）：轉頭時本地 +Y 會歪掉 */
  function ensureTag(nick: string, isNpc = false) {
    const tag = makeWorldLabel(nick, 'name', {
      worldH: 0.24,
      nameTone: isNpc ? 'npc' : 'player',
    });
    tag.sprite.visible = false;
    root.add(tag.sprite);
    return tag;
  }

  function tickKeeperBubble(k: (typeof stallKeepers)[number], tSec: number) {
    if (tSec >= k.next) {
      if (!k.bub) k.bub = ensureBubble(true);
      k.bub.setText(k.lines[k.li++ % k.lines.length], true);
      k.bub.setOpacity(1);
      k.until = tSec + 3.5;
      k.next = tSec + 9 + Math.random() * 6;
    }
    if (!k.bub) return;
    const on = tSec < k.until;
    k.bub.sprite.visible = on;
    if (on) { const p = k.rig.outer.position; k.bub.sprite.position.set(p.x, 1.95, p.z); }
  }

  function ensureBubble(isNpc = false) {
    const el = makeWorldLabel(' ', 'bubble', { worldH: 0.36, nameTone: isNpc ? 'npc' : 'player' });
    el.sprite.visible = false;
    root.add(el.sprite);
    return el;
  }

  function placeAboveHead(sprite: THREE.Sprite, head: THREE.Object3D, yLift: number) {
    head.getWorldPosition(_tagHead);
    sprite.position.set(_tagHead.x, _tagHead.y + yLift, _tagHead.z);
  }

  /** 遠端雨傘共用材質／幾何（每人一份會在第一次開傘入鏡時卡） */
  const remoteUmbPoleMat = LO
    ? new THREE.MeshLambertMaterial({ color: 0x6a4a2a })
    : new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.85, flatShading: true });
  const remoteUmbCanopyMat = LO
    ? new THREE.MeshLambertMaterial({ color: 0xc0392b, side: THREE.FrontSide })
    : new THREE.MeshStandardMaterial({ color: 0xc0392b, side: THREE.DoubleSide, roughness: 0.7, flatShading: true });
  const remoteUmbPoleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.72, LO ? 4 : 5);
  const remoteUmbCanopyGeo = new THREE.ConeGeometry(0.45, 0.2, LO ? 6 : 10, 1, true);
  /** 遠端雨傘：跟本機一樣「往前開」擋殼，不是頭頂撐雨 */
  function makeRemoteUmb() {
    const g = new THREE.Group();
    g.userData.noMerge = true;
    g.visible = false;
    const pole = new THREE.Mesh(remoteUmbPoleGeo, remoteUmbPoleMat);
    // 傘柄在近 y=0（手握處），傘面沿 +Y；整組再往前傾
    pole.position.set(0, 0.2, 0);
    g.add(pole);
    const canopy = new THREE.Mesh(remoteUmbCanopyGeo, remoteUmbCanopyMat);
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
    placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.26, 0.32, -0.3, 0.24, 0.28, -0.55);
    r.headWorkX = -0.08;
    hideHold(r);
  }

  const remoteHoldWood = LO ? new THREE.MeshLambertMaterial({ color: 0x7a4a20 }) : new THREE.MeshStandardMaterial({ color: 0x7a4a20, roughness: 0.85 });
  const remoteHoldSteel = LO ? new THREE.MeshLambertMaterial({ color: 0xd0d0d8 }) : new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 0.7, roughness: 0.3 });
  const remoteHoldShell = LO
    ? new THREE.MeshLambertMaterial({ color: 0xe0dcd8 })
    : new THREE.MeshStandardMaterial({ color: 0xe0dcd8, roughness: 0.85, flatShading: true });
  const remoteHoldShellTop = LO
    ? new THREE.MeshLambertMaterial({ color: 0xf0ecea })
    : new THREE.MeshStandardMaterial({ color: 0xf0ecea, roughness: 0.85, flatShading: true });
  const remoteHoldSeg = LO ? 5 : 7;
  const remoteHoldBotGeo = new THREE.SphereGeometry(0.055, remoteHoldSeg, LO ? 4 : 5);
  const remoteHoldTopGeo = new THREE.SphereGeometry(0.05, remoteHoldSeg, LO ? 4 : 5);

  /** 簡易蚵仔刀＋蚵仔（遠端剝殼手持；材質共用避免每人首次入鏡卡頓） */
  function makeRemoteHold(): { knife: THREE.Group; oyster: THREE.Group } {
    const knife = new THREE.Group();
    knife.userData.noMerge = true;
    knife.visible = false;
    const handle = new THREE.Mesh(rcyl(0.012, 0.014, 0.09, LO ? 4 : 5), remoteHoldWood);
    handle.rotation.z = Math.PI / 2;
    knife.add(handle);
    const blade = new THREE.Mesh(rboxEnv(0.1, 0.006, 0.022), remoteHoldSteel);
    blade.position.set(-0.08, 0, 0);
    knife.add(blade);

    const oyster = new THREE.Group();
    oyster.userData.noMerge = true;
    oyster.visible = false;
    const bot = new THREE.Mesh(remoteHoldBotGeo, remoteHoldShell);
    bot.scale.set(1.15, 0.45, 1);
    oyster.add(bot);
    const top = new THREE.Mesh(remoteHoldTopGeo, remoteHoldShellTop);
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
  // 遠端臉盆／肉碗共用材質＋幾何：每人一份會在準心第一次掃到時才編譯著色器→卡一下
  const remoteBasinMat = M(0xc84030, { side: THREE.DoubleSide, roughness: 0.55, flatShading: true });
  const remoteBasinFlMat = M(0xa03028, { roughness: 0.65, flatShading: true });
  const remoteBasinOyMat = M(0xc8c2c0, { roughness: 0.8, flatShading: true });
  const remoteBowlMat = M(0x4a8ac0, { side: THREE.DoubleSide, roughness: 0.45, flatShading: true });
  const remoteBowlFlMat = M(0x3a6a98, { roughness: 0.5, flatShading: true });
  const remoteBasinGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.11, 12, 1, true);
  const remoteBasinFlGeo = new THREE.CircleGeometry(0.16, 12);
  const remoteBasinOyGeo = new THREE.SphereGeometry(0.035, 5, 4);
  const remoteBowlWallGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.09, 12, 1, true);
  const remoteBowlFlGeo = new THREE.CircleGeometry(0.1, 12);

  /** 坐下面前：紅臉盆＋裝肉碗（貼蚵堆坡面，renderOrder 高於殼堆） */
  function makeRemoteProps(): { props: THREE.Group; bowlNode: THREE.Object3D; meatRoot: THREE.Group } {
    const props = new THREE.Group();
    props.userData.noMerge = true;
    props.userData.sharedGeoMat = true;
    props.visible = false;
    const markTop = (o: THREE.Object3D) => {
      o.traverse(x => {
        const m = x as THREE.Mesh;
        if (m.isMesh) m.renderOrder = 2;
      });
    };
    // 座椅離堆心 ~1.38；盆／碗再往 -Z（堆心）靠並抬高，像擱在蚵山上
    const basin = new THREE.Mesh(remoteBasinGeo, remoteBasinMat);
    // 臉盆左、裝肉碗右；兩盆間距 ≈ 兩顆蚵殼短邊
    const basinX = -0.28, basinZ = -0.58;
    basin.position.set(basinX, 0.2, basinZ);
    props.add(basin);
    const basinFl = new THREE.Mesh(remoteBasinFlGeo, remoteBasinFlMat);
    basinFl.rotation.x = -Math.PI / 2;
    basinFl.position.set(basinX, 0.145, basinZ);
    props.add(basinFl);
    // 盆裡幾顆殼示意
    for (let i = 0; i < 5; i++) {
      const a = i * 1.1, rr = 0.04 + (i % 3) * 0.02;
      const oy = new THREE.Mesh(remoteBasinOyGeo, remoteBasinOyMat);
      oy.scale.set(1.2, 0.55, 1);
      oy.position.set(basinX + Math.cos(a) * rr, 0.2, basinZ + Math.sin(a) * rr);
      props.add(oy);
    }
    const bowlNode = new THREE.Group();
    const wall = new THREE.Mesh(remoteBowlWallGeo, remoteBowlMat);
    wall.position.y = 0.045;
    bowlNode.add(wall);
    const fl = new THREE.Mesh(remoteBowlFlGeo, remoteBowlFlMat);
    fl.rotation.x = -Math.PI / 2;
    bowlNode.add(fl);
    const meatX = basinX + 0.2 + 0.2 + 0.13; // 盆緣 + 兩短邊 + 肉碗半徑
    bowlNode.position.set(meatX, 0.22, basinZ);
    props.add(bowlNode);
    const meatRoot = new THREE.Group();
    meatRoot.position.set(meatX, 0.3, basinZ);
    props.add(meatRoot);
    markTop(props);
    return { props, bowlNode, meatRoot };
  }
  // 共用臉盆／碗材質進場先暖：否則第一個坐下的人被準心掃到才編譯
  if (opts.warmGpu) {
    try {
      const w = makeRemoteProps();
      w.props.visible = true;
      root.add(w.props);
      opts.warmGpu(w.props);
      root.remove(w.props);
    } catch { /* */ }
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
      seg.scale.set(1, 1, 1);
      return;
    }
    _hangDir.multiplyScalar(1 / raw);
    seg.position.set(ax + _hangDir.x * base * 0.5, ay + _hangDir.y * base * 0.5, az + _hangDir.z * base * 0.5);
    // 與 character.placePlazaArmSeg 同：鎖扭轉，避免近垂直時上臂翻轉
    _hangX.set(1, 0, 0);
    _hangX.addScaledVector(_hangDir, -_hangX.dot(_hangDir));
    if (_hangX.lengthSq() < 1e-8) {
      _hangX.set(0, 0, 1);
      _hangX.addScaledVector(_hangDir, -_hangX.dot(_hangDir));
    }
    _hangX.normalize();
    _hangZ.crossVectors(_hangX, _hangDir).normalize();
    _hangX.crossVectors(_hangDir, _hangZ).normalize();
    _hangMat.makeBasis(_hangX, _hangDir, _hangZ);
    seg.quaternion.setFromRotationMatrix(_hangMat);
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
    placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.28, 0.26, -0.2, 0.3, 0.22, -0.42);
    r.headWorkX = -0.12;
    hideHold(r);
  }

  function applyHeadLook(r: Remote) {
    if (!r.rig?.head) return;
    // 坐下：lookYaw＝相對座位；走動：lookYaw 多為 0（身體跟 yaw），pitch 第一人稱會同步
    // 抽菸舉手時手臂是照「頭不俯仰」對準嘴；鏡頭俯仰（坐著多半低頭 -0.35）會把嘴往下帶，菸就變成在鼻子前面
    const sk = Math.min(1, Math.max(0, r.smokeK ?? 0));
    r.rig.head.rotation.x = r.headWorkX + r.pitch * 0.85 * (1 - sk);
    r.rig.head.rotation.y = r.lookYaw * (1 - sk);
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

  const remoteExhales: { fx: CharcoalFireFx; age: number; life: number; yaw: number }[] = [];
  const REMOTE_PUFF_UP = 0.7;
  const REMOTE_PUFF_DOWN = 0.5;
  const REMOTE_PUFF_AWAY = 0.12;
  const REMOTE_PUFF_TIMEOUT_MS = 6000;
  const REMOTE_PUFF_MIN_HOLD_MS = 300;

  function findRemoteForPuff(connId?: string, pid?: string): Remote | undefined {
    if (pid) {
      const byPid = findRemoteByPid(pid);
      if (byPid) return byPid;
    }
    if (connId) {
      for (const x of remotes.values()) {
        if (x.connId === connId || x.key === connId) return x;
      }
    }
    return undefined;
  }

  function clearRemotePuff(r: Remote) {
    r.puff = undefined;
    r.smokeK = 0;
  }

  function applyRemotePuff(opts: { connId?: string; pid?: string; start: boolean; holdMs: number }) {
    const r = findRemoteForPuff(opts.connId, opts.pid);
    if (!r) return;
    const aberOk = isAberRemote(r) && !r.carriedBy && (r.phase || '') !== 'carried' && (r.phase || '') !== 'moon'
      && (r.seated || (r.phase || '') === 'stand');
    if (!(aberOk || (r.seated && isSmokePile(r.pileId)))) return;
    const now = performance.now();
    const holdMs = Math.max(0, Math.min(5000, opts.holdMs | 0));
    if (opts.start) {
      r.puff = {
        held: true,
        animT: r.puff?.animT ?? 0,
        awayT: 0,
        holdMs: 0,
        autoEndAt: now + REMOTE_PUFF_TIMEOUT_MS,
        releaseAt: 0,
        exhaled: false,
      };
      return;
    }
    // end
    const animT = r.puff?.animT ?? 1;
    r.puff = {
      held: false,
      animT,
      awayT: 0,
      holdMs,
      autoEndAt: 0,
      releaseAt: holdMs >= REMOTE_PUFF_MIN_HOLD_MS ? now : 0,
      exhaled: holdMs < REMOTE_PUFF_MIN_HOLD_MS,
    };
  }

  function tickAberAshes(r: Remote, cig: { group: THREE.Object3D }, dt: number) {
    type Ash = { tick: (dt: number) => boolean; dispose: () => void };
    const st = ((r as any)._aberAsh ??= { cd: 5 + Math.random() * 4, ashes: [] as Ash[] });
    st.cd -= dt;
    if (st.cd <= 0) {
      st.cd = 6 + Math.random() * 5;
      st.ashes.push(spawnAshSpeck(cig.group, new THREE.Vector3(0.02, 0.02, -0.2)));
    }
    for (let i = st.ashes.length - 1; i >= 0; i--) {
      if (!st.ashes[i].tick(dt)) { st.ashes[i].dispose(); st.ashes.splice(i, 1); }
    }
  }

  /** 吸菸座的阿婆／阿伯：每隔一陣子自己抽一口（純前端，各玩家時間點不同步） */
  function tickNpcAutoPuff(r: Remote) {
    const now = performance.now();
    const st = ((r as any)._npcPuff ??= { next: now + 3000 + Math.random() * 9000, endAt: 0, hold: 0 });
    if (st.endAt) {
      if (now >= st.endAt) {
        st.endAt = 0;
        applyRemotePuff({ connId: r.connId || r.key, start: false, holdMs: st.hold });
        st.next = now + 9000 + Math.random() * 14000;
      }
      return;
    }
    if (now < st.next || r.puff) return;
    st.hold = 1200 + Math.random() * 3800;
    st.endAt = now + st.hold;
    applyRemotePuff({ connId: r.connId || r.key, start: true, holdMs: 0 });
  }

  function spawnRemoteExhale(r: Remote, holdMs: number) {
    if (holdMs < REMOTE_PUFF_MIN_HOLD_MS || !r.rig?.head) return;
    const strength = Math.min(1, holdMs / 5000);
    const sc = 0.35 + strength * 1.15;
    const gold = !r.isNpc && parseCosmetics(r.cosmetics).goldSmoke;
    const fx = makeExhalePuff({ scale: sc, count: Math.round(6 + strength * 8), seed: 6100 + Math.floor(Math.random() * 4000), reach: strength, tint: gold ? GOLD_SMOKE_TINT : undefined });
    r.rig.head.updateMatrixWorld(true);
    const mouth = r.rig.head.localToWorld(new THREE.Vector3(0, -0.08, -0.16));
    const yaw = r.rig.outer.rotation.y;
    fx.group.position.copy(mouth);
    fx.group.rotation.y = yaw;
    root.add(fx.group);
    remoteExhales.push({ fx, age: 0, life: 3.6, yaw });
  }

  function isAberRemote(r: { pid?: string; nick?: string; isNpc?: boolean }) {
    return !!r.isNpc && isPlazaAber(r);
  }
  function aberLeisureSmoke(r: Remote) {
    return isAberRemote(r) && r.seated && (isLeisurePile(r.pileId) || (r.phase || '') === 'smoke' || (r.phase || '') === 'rest');
  }
  function aberMouthSmoke(r: Remote) {
    if (!isAberRemote(r)) return false;
    if (r.carriedBy || (r.phase || '') === 'carried' || (r.phase || '') === 'moon') return false;
    if (aberLeisureSmoke(r)) return false;
    return !!r.seated || (r.phase || '') === 'stand';
  }
  function tickRemotePuff(r: Remote, dt: number) {
    const pf = r.puff;
    if (!pf) return;
    const leisure = (r.seated && isSmokePile(r.pileId)) || aberLeisureSmoke(r);
    const mouth = aberMouthSmoke(r);
    if (!leisure && !mouth) { clearRemotePuff(r); return; }
    const now = performance.now();
    if (pf.held && pf.autoEndAt && now >= pf.autoEndAt) {
      // 缺 end：逾時自動放下（不吐煙）
      pf.held = false;
      pf.releaseAt = 0;
      pf.exhaled = true;
      pf.autoEndAt = 0;
    }
    if (pf.held) {
      pf.animT = Math.min(1, pf.animT + dt / REMOTE_PUFF_UP);
      pf.awayT = Math.max(0, pf.awayT - dt / 0.2);
    } else {
      pf.animT = Math.max(0, pf.animT - dt / REMOTE_PUFF_DOWN);
      pf.awayT = pf.animT > 0 ? Math.min(1, pf.awayT + dt / REMOTE_PUFF_AWAY) : 0;
    }
    if (pf.releaseAt && !pf.exhaled && now - pf.releaseAt >= 1000) {
      pf.exhaled = true;
      pf.releaseAt = 0;
      spawnRemoteExhale(r, pf.holdMs);
    }
    const inhale = pf.held && pf.animT >= 0.98 ? 1 : (pf.held && pf.animT > 0.7 ? (pf.animT - 0.7) / 0.3 : 0);
    if (leisure) {
      posePlazaSmokeSit(r.rig, {
        puffK: easeSmokePuff(pf.animT),
        inhale,
        away: pf.awayT,
      });
      // 與 posePlazaSmokeSit 內手的進度同一條曲線
      r.smokeK = easeSmokePuff(easeSmokePuff(pf.animT));
      r.headWorkX = r.rig.head.rotation.x;
      r.knife.visible = false;
      r.oyster.visible = false;
    }
    if (!pf.held && (mouth || (pf.animT <= 0.001 && pf.awayT <= 0.001)) && pf.exhaled) clearRemotePuff(r);
  }

  function tickRemoteExhales(dt: number) {
    for (let i = remoteExhales.length - 1; i >= 0; i--) {
      const e = remoteExhales[i];
      e.age += dt;
      e.fx.tick(performance.now() * 0.001, dt);
      if (e.age >= e.life) {
        try { e.fx.group.parent?.remove(e.fx.group); } catch { /* */ }
        e.fx.dispose();
        remoteExhales.splice(i, 1);
      }
    }
  }

  /** 坐下：大腿貼椅面、小腿下垂；略後仰離蚵堆 */
  function poseSit(r: Remote) { posePlazaSit(r.rig); }
  function poseStand(r: Remote) { posePlazaStand(r.rig); }

  function applyActionPose(r: Remote) {
    try {
    if (r.throwT > 0) { poseThrow(r); applyHeadLook(r); return; }
    if (r.umb) { poseUmb(r); applyHeadLook(r); return; }
    const ph = (r.phase || '').toLowerCase();
    if (r.carriedBy || ph === 'carried') {
      posePlazaCarried(r.rig);
      hideHold(r);
      r.headWorkX = 0.1;
      (r as any)._loco = 'carried';
      applyHeadLook(r);
      return;
    }
    if (anyoneCarriedBy(r.connId) && !r.seated) {
      posePlazaCarryHold(r.rig);
      hideHold(r);
      r.headWorkX = 0;
      applyHeadLook(r);
      return;
    }
    if (r.seated && isMgPile(r.pileId)) {
      // 機關槍：站姿操作，槍管跟 look／pitch
      poseStand(r);
      r.rig.root.position.y = 0;
      hideHold(r);
      r.headWorkX = 0;
      (r as any)._loco = 'mg';
      const mount = mgMounts[Math.max(0, r.slot)] ?? mgMounts[0];
      if (mount) aimMgMount(mount, r.lookYaw || 0, r.pitch || 0);
      applyHeadLook(r);
      return;
    }
    if (r.seated) {
      poseSit(r);
      (r as any)._loco = (ph === 'smoke' || isSmokePile(r.pileId)) ? 'smoke' : 'sit';
      if ((ph === 'rest' || isRestPile(r.pileId)) && !isAberRemote(r)) {
        // 樸子腳門口純坐：雙手自然垂放，無刀無蚵
        r.knife.visible = false;
        r.oyster.visible = false;
        r.headWorkX = 0;
      } else if (ph === 'smoke' || isSmokePile(r.pileId) || (isAberRemote(r) && (ph === 'rest' || isRestPile(r.pileId)))) {
        // 抽烟 idle：右手近嘴、無刀無蚵；進行中的抽一口由 tickRemotePuff 驅動
        if (!r.puff) posePlazaSmokeSit(r.rig);
        r.knife.visible = false;
        r.oyster.visible = false;
        r.headWorkX = -0.04;
      } else if (ph === 'twist' || ph === 'pry') {
        // 左手握蚵、右手持刀撬
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.14, 0.26, -0.26, -0.08, 0.2, -0.4);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.16, 0.24, -0.22, 0.02, 0.18, -0.38);
        placeHold(r, 0.02, 0.12, -0.38, -0.08, 0.14, -0.4, true);
        r.headWorkX = 0.12;
      } else if (ph === 'seam') {
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.14, 0.26, -0.24, -0.08, 0.2, -0.38);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.14, 0.24, -0.2, 0.0, 0.18, -0.36);
        placeHold(r, 0.0, 0.12, -0.36, -0.08, 0.14, -0.38, true);
        r.headWorkX = 0.1;
      } else if (ph === 'grillplace' || ph === 'grillflip' || ph === 'grilltake') {
        // 烤蚵：伸手往烤網放／掀／取
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.12, 0.24, -0.32, -0.06, 0.18, -0.48);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.12, 0.24, -0.28, 0.06, 0.18, -0.44);
        placeHold(r, 0.0, 0.1, -0.46, -0.06, 0.12, -0.48, ph !== 'grilltake');
        r.knife.visible = false;
        r.headWorkX = 0.14;
      } else if (ph === 'grillcook') {
        // 等烤開：蚵在烤網上，雙手擱桌邊
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.2, 0.22, -0.18, -0.18, 0.16, -0.28);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.2, 0.22, -0.18, 0.18, 0.16, -0.28);
        r.knife.visible = false;
        r.oyster.visible = true;
        r.oyster.position.set(0, 0.02, -0.55);
        r.oyster.rotation.set(0.15, 0.2, 0);
        r.headWorkX = 0.18;
      } else if (ph === 'aim' || ph === 'toss') {
        // 左手托肉／蚵往前，右手刀收一點
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.16, 0.28, -0.28, -0.1, 0.22, -0.44);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.2, 0.28, -0.12, 0.18, 0.18, -0.28);
        placeHold(r, 0.18, 0.12, -0.28, -0.1, 0.16, -0.44, true);
        r.headWorkX = -0.05;
      } else if (ph === 'throwaim') {
        // 準星瞄到人：左手高舉拿殼，全場可見要丟
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.24, 0.54, -0.16, -0.18, 0.68, -0.3);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.16, 0.2, -0.08, 0.14, 0.12, -0.2);
        r.knife.visible = false;
        r.oyster.visible = true;
        r.oyster.position.set(-0.18, 0.6, -0.32);
        r.oyster.rotation.set(0.45, -0.25, 0.35);
        r.headWorkX = -0.16;
      } else if (ph === 'empty') {
        // 空手殼：右手持殼要丟
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.2, 0.28, -0.1, -0.18, 0.16, -0.22);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.2, 0.3, -0.22, 0.16, 0.24, -0.4);
        placeHold(r, 0.16, 0.18, -0.4, 0, 0, 0, false);
        r.oyster.visible = true;
        r.oyster.position.set(0.16, 0.2, -0.42);
        r.headWorkX = -0.08;
      } else if (ph === 'scoop' || ph === 'pick') {
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.18, 0.22, -0.22, -0.14, 0.14, -0.36);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.18, 0.22, -0.18, 0.14, 0.14, -0.32);
        placeHold(r, 0.14, 0.08, -0.32, 0, 0, 0, false);
        r.headWorkX = 0.08;
      } else if (ph === 'crab') {
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.33, 0, -0.12, 0.28, -0.2, -0.06, 0.24, -0.34);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.33, 0, 0.12, 0.28, -0.2, 0.06, 0.24, -0.34);
        placeHold(r, 0.06, 0.18, -0.34, -0.06, 0.18, -0.34, true);
        r.headWorkX = 0.15;
      } else {
        // busy／其他：刀具在側、暫無蚵
        placeHold(r, 0.2, 0.12, -0.22, 0, 0, 0, false);
        r.headWorkX = 0.04;
      }
      // 烤位不拿剝蚵刀（含 pick／aim／empty）
      if (pileIsGrill(r.pileId)) r.knife.visible = false;
    } else {
      // 走動中勿每次 Sync 都 poseStand：會把腿／走路相位洗成站姿，遠端看起來像滑行
      const loco = (r as any)._loco as string | undefined;
      const phL = (r.phase || '').toLowerCase();
      // 只在離開坐／菸／飛彈後重置站姿；勿看 root.y（走路 bob 也會抬髖）
      const needStand = !!(r as any)._stoodUp || loco === 'sit' || loco === 'smoke' || loco === 'moon' || loco === 'carried';
      if (needStand) {
        poseStand(r);
        (r as any)._stoodUp = false;
      }
      hideHold(r);
      r.headWorkX = 0;
      (r as any)._loco = phL === 'jump' ? 'jump' : (phL === 'moon' ? 'moon' : 'walk');
    }
    applyHeadLook(r);
    } finally {
      if (r.isNpc && !isAberRemote(r)) applyAmaAppearance(r.rig);
    }
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
    // 已移除的蚵堆（舊版伺服器仍會送那堆的阿婆）：不畫、清掉殘留
    if ((p.isNpc || pid.startsWith('npc-')) && p.pileId != null && pileIsRemoved(p.pileId)) {
      const old = findRemoteByPid(pid);
      if (old) destroyRemote(old);
      return null;
    }
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
      const isNpc = !!(p.isNpc || pid.startsWith('npc-'));
      const aber = isNpc && isPlazaAber(p);
      const look = hashLook(pid, isNpc);
      const rig = makePlayerAvatar(aber ? { shirt: 0x4a6a8a, hair: 0x8a8a8a, pants: 0x3a3a48 } : look, M, add, LO, isNpc);
      if (isNpc) {
        if (aber) dressPlazaAber(rig);
        else {
          dressPlazaAma(rig, pickAmaLook(pid), pid);
          applyAmaAppearance(rig);
        }
      } else {
        applyOutfitToRig(rig, normalizeOutfitIds({
          head: p.head, hand: p.hand, body: p.body, legs: p.legs, feet: p.feet,
        }));
      }
      root.add(rig.outer);
      rig.outer.userData.skipTpOcclude = true; // 遠端角色不參與鏡頭透視淡化
      const x = p.x ?? 0, z = p.z ?? 0, yaw = p.yaw ?? 0;
      rig.outer.scale.setScalar(isNpc && !aber ? AMA_SCALE : AVATAR_SCALE);
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
        key: pid, connId: p.connId || '', pid, rig,
        tag: ensureTag(isNpc ? (p.nick || (aber ? '阿伯' : '阿婆')) : plazaDisplayName(p.nick, p.tag), isNpc), bubble: ensureBubble(isNpc), bubUntil: 0,
        pileId: p.pileId, slot: p.slot, phase: p.phase, count: p.count, nick: p.nick || (isNpc ? (aber ? '阿伯' : '阿婆') : '剝蚵人'),
        numTag: isNpc ? '' : (p.tag || '').replace(/^#/, ''),
        seated: !!p.seated, moving: !!p.moving, umb: !!p.umb, umbMesh,
        props, bowlNode, meatRoot, meatMeshes: [], knife, oyster,
        tx: x, tz: z, tyaw: yaw, x, z, yaw, bob: 0, throwT: 0,
        tLookYaw: 0, lookYaw: 0, tPitch: 0, pitch: 0, headWorkX: 0,
        awaitingPose,
        isNpc,
        carriedBy: p.carriedBy || '',
        cosmetics: p.cosmetics || '',
      };
      remotes.set(pid, r);
      r.props.visible = r.seated && !isLeisurePile(r.pileId);
      if (r.seated && !isLeisurePile(r.pileId)) syncRemoteMeats(r);
      hangArms(r, r.seated);
      if (awaitingPose) { rig.outer.visible = false; r.tag.sprite.visible = false; }
      // visible=false 的臉盆／人 compile 會跳過 → 強制打開預熱，避免準心第一次瞄到才卡
      if (opts.warmGpu) {
        const wasOuter = rig.outer.visible;
        const wasProps = r.props.visible;
        const wasTag = r.tag.sprite.visible;
        rig.outer.visible = true;
        r.props.visible = true;
        r.tag.sprite.visible = true;
        try { opts.warmGpu(rig.outer); } catch { /* */ }
        rig.outer.visible = wasOuter;
        r.props.visible = wasProps;
        r.tag.sprite.visible = wasTag;
        if (awaitingPose) { rig.outer.visible = false; r.tag.sprite.visible = false; }
      }
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
    const wasCarried = !!r.carriedBy;
    r.carriedBy = p.carriedBy || '';
    if (wasSeated && !r.seated) { (r as any)._stoodUp = true; clearRemotePuff(r); }
    if (wasCarried && !r.carriedBy) (r as any)._stoodUp = true;
    r.umb = !!p.umb;
    r.tLookYaw = Number.isFinite(p.lookYaw) ? Math.max(-1.6, Math.min(1.6, p.lookYaw!)) : 0;
    r.tPitch = Number.isFinite(p.pitch) ? Math.max(-1.4, Math.min(0.85, p.pitch!)) : 0;
    // 走動時身體已朝 yaw；頭左右相對量通常為 0（由傳送端決定是否鎖 pitch）
    r.umbMesh.visible = r.umb;
    if (r.umb) layoutRemoteUmb(r.umbMesh, r.seated);
    r.props.visible = r.seated && !isLeisurePile(r.pileId);
    if (r.seated && !isLeisurePile(r.pileId)) syncRemoteMeats(r);
    if (p.nick && p.nick !== r.nick) r.nick = p.nick;
    if (p.isNpc != null) r.isNpc = !!p.isNpc;
    if (!r.isNpc && p.tag) r.numTag = String(p.tag).replace(/^#/, '');
    {
      const label = r.isNpc ? r.nick : plazaDisplayName(r.nick, r.numTag);
      r.tag.setText(r.seated && !isLeisurePile(r.pileId) ? `${label} · ${r.count}` : label);
    }
    if (!r.isNpc && p.cosmetics !== undefined) r.cosmetics = p.cosmetics || '';
    const cos = parseCosmetics(r.cosmetics);
    r.tag.setNameFrame(!r.isNpc && cos.nameFrame);
    syncCushion(r.pid || r.key, !r.isNpc && r.seated && cos.cushion, r.pileId, r.slot);
    // 寵物：掛／拆到遠端右肩；NPC 不帶寵物
    syncRemotePet(r, r.isNpc ? '' : cos.pet);
    if (r.carriedBy) {
      r.seated = false;
      r.pileId = -1;
      r.slot = -1;
      if (typeof p.x === 'number') r.tx = p.x;
      if (typeof p.z === 'number') r.tz = p.z;
      if (typeof p.yaw === 'number') r.tyaw = p.yaw;
      snapRemoteIfFar(r, 6);
      revealRemoteIfReady(r);
    } else if (r.seated && p.pileId >= 0) {
      const pose = seatPose(p.pileId, p.slot);
      r.tx = pose.pos.x; r.tz = pose.pos.z; r.tyaw = pose.yaw;
      r.x = pose.pos.x; r.z = pose.pos.z; r.yaw = pose.yaw;
      (r as any)._wh = []; (r as any)._walkOn = false;
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
    if (!r.isNpc) {
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
    r.tag.sprite.visible = true;
  }

  function upsert(p: PlazaPlayer, selfPid: string) { applyPose(p, selfPid); }

  /** 遠端寵物：依 petId 掛／拆模型到 rig.shoulderR */
  function syncRemotePet(r: Remote, petId: string) {
    const curId: string = (r as any)._petId ?? '';
    const curMesh: THREE.Group | undefined = (r as any)._petMesh;
    if (curId === petId) return;
    if (curMesh) { r.rig.shoulderR?.remove(curMesh); (r as any)._petMesh = undefined; }
    (r as any)._petId = petId;
    if (!petId) return;
    let mesh: THREE.Group | null = null;
    if (petId === 'pt_oyster_baby') mesh = makeOysterBaby();
    if (!mesh) return;
    mesh.scale.setScalar(0.7);
    // 掛到 outer（自然跟著玩家 x/z/yaw），再由 updateRemotePet 控制 local 位置
    r.rig.outer.add(mesh);
    (r as any)._petMesh = mesh;
    (r as any)._petBob = 0;
  }

  /** 遠端寵物逐幀：躺=右側同躺；坐=頭頂；站／走=身後（真的在走才彈跳） */
  function updateRemotePet(r: Remote, dt: number) {
    const mesh = (r as any)._petMesh as THREE.Group | undefined;
    if (!mesh) return;
    // 機關槍座：不顯示寵物
    if (r.seated && isMgPile(r.pileId)) { mesh.visible = false; return; }
    mesh.visible = true;
    const seated = !!r.seated;
    const lying = !seated && (r.phase === 'lie');
    const moving = !seated && !lying && !!(r as any)._walkOn;
    const bob0 = (r as any)._petBob ?? 0;
    const bob = bob0 + dt * (moving ? 7 : 2.2);
    (r as any)._petBob = bob;
    if (lying) {
      // 躺姿：mesh 是 outer 的 child。outer 已 R_y(bodyYaw)*R_x(π/2)：
      //   outer local +X → 世界右手邊；outer local -Z → 世界 +Y（上）
      // pet 自動繼承 outer 旋轉 → pet 臉 (local -Z) 指向世界 +Y（朝天），pet 頭 (local +Y) 指玩家頭方向 ✓
      // 位置：右手邊 x=0.4、略離地（outer 本身 lying 時 y=+0.16；再給 z=+0.07 將 pet 下壓貼地）
      mesh.position.set(0.4, 0, 0.07);
      mesh.rotation.set(0, 0, 0);
    } else if (seated) {
      // 髮蓋頂 ≈ y=1.44（坐姿 root.y=-0.16）；z=-0.1 往臉前靠
      // 戴帽子要再抬 headTopLift 量，否則被帽頂擋到
      const headId = (r.rig.outfitKey ?? '').split('|')[0] ?? '';
      const hatLift = headTopLift(headId);
      mesh.position.set(0, 1.44 + hatLift + Math.sin(bob) * 0.015, -0.1);
      mesh.rotation.set(0, 0, 0);
    } else {
      // 站著／走動都在身後貼地；彈跳只在實際位移時才加；靜止時湊近
      const y = moving ? Math.abs(Math.sin(bob)) * 0.2 : Math.sin(bob) * 0.008;
      const targetDist = moving ? 1.0 : 0.4;
      const curDist = (r as any)._petDist ?? targetDist;
      const nextDist = curDist + (targetDist - curDist) * 0.08;
      (r as any)._petDist = nextDist;
      mesh.position.set(0, y, nextDist);
      mesh.rotation.set(0, 0, 0);
    }
  }

  function destroyRemote(r: Remote) {
    if (r.cigSmoke) { root.remove(r.cigSmoke.group); r.cigSmoke.dispose(); r.cigSmoke = undefined; }
    syncCushion(r.pid || r.key, false, -1, -1);
    syncRemotePet(r, '');
    clearPlazaSmokeCig(r.rig);
    const ashes = (r as any)._aberAsh?.ashes as { dispose: () => void }[] | undefined;
    if (ashes) for (const a of ashes) { try { a.dispose(); } catch { /* */ } }
    root.remove(r.rig.outer); r.tag.dispose(); r.bubble.dispose();
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
    const short = text.length > 40 ? text.slice(0, 39) + '…' : text;
    if (opts.self) {
      selfBubble.setText(short, true);
      selfBubble.setOpacity(1);
      selfBubble.sprite.visible = true;
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
    r.bubble.setText(short, true);
    r.bubble.setOpacity(1);
    r.bubble.sprite.visible = true;
    r.bubUntil = until;
  }

  let seatWishes: PlazaSeatWish[] = [];
  let wishSelfConn = '';
  const wishMarks = new THREE.Group();
  wishMarks.name = 'seatWishMarks';
  root.add(wishMarks);
  const wishMarkMats: THREE.Material[] = [];
  const wishMarkGeos: THREE.BufferGeometry[] = [];
  function clearWishMarks() {
    while (wishMarks.children.length) {
      const c = wishMarks.children[0];
      wishMarks.remove(c);
    }
    for (const m of wishMarkMats) m.dispose();
    wishMarkMats.length = 0;
    for (const g of wishMarkGeos) g.dispose();
    wishMarkGeos.length = 0;
  }
  function makeWishMark(w: PlazaSeatWish) {
    const g = new THREE.Group();
    const pose = seatPose(w.pileId, w.slot);
    g.position.set(pose.pos.x, 0.04, pose.pos.z);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2a5a86, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const ringGeo = new THREE.RingGeometry(0.2, 0.28, 28);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0x2a5a86, transparent: true, opacity: 0.92, depthWrite: false });
    const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6);
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 0.28;
    g.add(shaft);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xe8f2fa, transparent: true, opacity: 0.95, depthWrite: false });
    const pinGeo = new THREE.OctahedronGeometry(0.07, 0);
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.y = 0.62;
    g.add(pin);
    wishMarkMats.push(ringMat, shaftMat, pinMat);
    wishMarkGeos.push(ringGeo, shaftGeo, pinGeo);
    g.userData.pulse = 0;
    return g;
  }
  function setSeatWishes(list: PlazaSeatWish[], selfConnId = '') {
    seatWishes = Array.isArray(list) ? list.slice() : [];
    if (selfConnId) wishSelfConn = selfConnId;
    clearWishMarks();
    for (const w of seatWishes) wishMarks.add(makeWishMark(w));
  }
  function wishForRemote(r: Remote): PlazaSeatWish | undefined {
    return seatWishes.find(w => w.npcConnId === r.connId || (!!w.npcPid && !!r.pid && w.npcPid === r.pid));
  }
  function wishBubbleText(w: PlazaSeatWish): string {
    const left = Math.max(0, Math.ceil((w.expiresAt - Date.now()) / 1000));
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, '0');
    let line = (w.line || '好想換位子').trim();
    if (w.carrierConnId && w.carrierConnId !== wishSelfConn) line += '　已有人在送';
    line += `　${mm}:${ss}`;
    if (line.length > 44) line = line.slice(0, 43) + '…';
    return line;
  }

  let selfConnId = '';
  function anyoneCarriedBy(connId?: string) {
    if (!connId) return false;
    for (const o of remotes.values()) if (o.carriedBy === connId) return true;
    return false;
  }
  /** 自己的蹲／躺程度與跳躍高度（main 每幀餵），抱著的阿婆跟著調高度 */
  let selfBody = { pz: '', pk: 0, jy: 0 };
  function setSelfBody(pz: string, pk: number, jy: number) { selfBody = { pz, pk, jy }; }
  type CarrierPose = { x: number; z: number; yaw: number; pz: string; pk: number; jy: number };
  function findCarrierPose(connId: string): CarrierPose | null {
    if (selfConnId && connId === selfConnId) return { x: selfX, z: selfZ, yaw: selfYaw, ...selfBody };
    for (const o of remotes.values()) {
      if (o.connId === connId) {
        const oj = o as any;
        let jy = 0;
        if (oj.jt) { const el = (performance.now() - oj.jt) / 1000; if (el >= 0 && el < PLAZA_JUMP_DUR) jy = plazaJumpHeight(el); }
        return { x: o.x, z: o.z, yaw: o.yaw, pz: oj.pz || '', pk: oj.pk || 0, jy };
      }
    }
    return null;
  }
  function setSelfCushion(on: boolean, pileId: number, slot: number) {
    syncCushion('__self__', on, pileId, slot);
  }

  function setSelfPose(x: number, z: number, yaw: number, seated: boolean, smoke = false, connId = '') {
    selfX = x; selfZ = z; selfYaw = yaw; selfSeated = seated; selfSmoke = !!(seated && smoke);
    if (connId) selfConnId = connId;
    if (selfSmoke && !selfCig) {
      selfCig = makeCigSmoke({ count: LO ? 3 : 5, seed: 9901, scale: 0.7 });
      root.add(selfCig.group);
    }
    if (selfCig) selfCig.group.visible = selfSmoke;
  }

  function setPhase(p: PlazaPlayer) { applyPose(p, /* 勿用空字串，否則會把「自己」建成遠端分身 */ '\0'); }

  function syncRoster(snap: PlazaSnapshot, selfPid: string) {
    applyPileDiffs(snap?.pileDiffs);
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
    padTaken = taken;
    paintInstancedPads(taken);
  }

  function highlight(pileId: number | null, slot: number | null) {
    nearKey = pileId != null && slot != null ? seatKey(pileId, slot) : null;
    paintInstancedPads(padTaken);
  }

  function highlightNear(seat: PlazaSeatRef | null) {
    highlight(seat?.pileId ?? null, seat?.slot ?? null);
  }

  const now = () => performance.now();

  function applyTpOcclude(dt: number, camera: THREE.Camera, focus?: THREE.Vector3) {
    // 木頭牆／厝頂：鏡頭↔玩家之間有擋到才淡（輕量；其他建築由 tickTpCamOcclude 處理）
    try {
      if (!opts.getTpv?.()) {
        if (tpOccludeK > 0.001) {
          tpOccludeK = 0;
          for (const raw of tpOccludeMats) {
            const m = raw as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
            m.opacity = 1; m.transparent = true; m.depthWrite = true;
          }
        }
        return;
      }
      let want = 0;
      if (focus) {
        _tpOccFrom.copy(camera.position);
        const span = _tpOccFrom.distanceTo(focus);
        if (span > 0.35) {
          const hitBetween = (a: THREE.Vector3, b: THREE.Vector3) => {
            _tpOccDir.subVectors(b, a);
            const len = _tpOccDir.length();
            if (len < 0.35) return false;
            _tpOccDir.multiplyScalar(1 / len);
            _tpOccRay.set(a, _tpOccDir);
            _tpOccRay.near = 0.08;
            _tpOccRay.far = Math.max(0.05, len - 0.08);
            return _tpOccRay.intersectObject(bigShed.tpOcclude, true).length > 0;
          };
          if (hitBetween(_tpOccFrom, focus) || hitBetween(focus, _tpOccFrom)) want = 1;
        }
      }
      tpOccludeK += (want - tpOccludeK) * Math.min(1, dt * 7);
      const op = 1 - tpOccludeK * 0.8;
      for (const raw of tpOccludeMats) {
        const m = raw as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
        m.opacity = op;
        m.transparent = true;
        m.depthWrite = op > 0.82;
      }
    } catch (e) {
      console.error('applyTpOcclude', e);
    }
  }

  function tick(dt: number, camera: THREE.Camera) {
    const eco = !!opts.eco?.();
    const cx = camera.position.x, cz = camera.position.z;
    // 木牆淡化改由 tickTpOcclude 在 camTick 之後呼叫（否則 focus／鏡頭是上一幀）
    shedRow.tick(dt, eco);
    tickPileDiffSigns(cx, cz);
    const FAR2 = 20 * 20, HIDE2 = 60 * 60, FIRE2 = 14 * 14;
    // 燈數固定，只調亮度，不開關 visible（three.js 增減燈會重編著色器）
    // 省電：吊燈改靠外觀球自發光，關掉動態點光
    for (const pl of roofLamps) pl.intensity = roofLampBaseI;
    tickDetailLod(dt, cx, cz);

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
      const rj = r as any;
      const dist2 = (r.x - cx) * (r.x - cx) + (r.z - cz) * (r.z - cz);
      const far = eco && dist2 > FAR2;
      if ((r.phase || '') === 'jump' && !r.seated) { if (!rj.jt) rj.jt = performance.now(); }
      let jumpElapsed = -1;
      if (rj.jt) {
        jumpElapsed = (performance.now() - rj.jt) / 1000;
        if (jumpElapsed >= PLAZA_JUMP_DUR) {
          if ((r.phase || '') !== 'jump') rj.jt = 0;
          jumpElapsed = -1;
        }
      }
      // 遠距：只更新座標，略過走路／甩臂細動畫
      if (!far) {
        // 平滑速度：用 ~200ms 視窗位移（單幀 lerp 殘差常→0，會誤判成沒在走）
        const nowMs = performance.now();
        type Hist = { t: number; x: number; z: number };
        let hist = rj._wh as Hist[] | undefined;
        if (!hist) { hist = []; rj._wh = hist; }
        hist.push({ t: nowMs, x: r.x, z: r.z });
        while (hist.length > 1 && nowMs - hist[0].t > 220) hist.shift();
        let moveSp = 0;
        if (hist.length >= 2) {
          const a = hist[0], b = hist[hist.length - 1];
          const dtH = (b.t - a.t) * 0.001;
          if (dtH > 0.04) moveSp = Math.hypot(b.x - a.x, b.z - a.z) / dtH;
        }
        // 仍朝目標插值時補一點「接近速度」，避免視窗內幾乎貼齊目標卻其實在走
        const toT = Math.hypot(r.tx - r.x, r.tz - r.z);
        if (toT > 0.04) moveSp = Math.max(moveSp, Math.min(2.8, toT * 8));
        // 遲滯：避免 Sync 間閃爍站／走
        let walkOn = !!rj._walkOn;
        if (walkOn) walkOn = moveSp > 0.08 || !!r.moving;
        else walkOn = moveSp > 0.22 || !!r.moving;
        rj._walkOn = walkOn;
        const gaitSp = walkOn ? Math.max(moveSp, r.moving ? 0.9 : 0.55) : moveSp;
        const walkAmp = Math.min(1, gaitSp / 1.2);
        // mid 仍播走路（只在 far 省）；否則中距會整段滑行無跨步
        const wantWalk = !r.seated && jumpElapsed < 0 && walkOn;
        if (!r.seated && jumpElapsed >= 0) {
          posePlazaJump(r.rig, jumpElapsed);
          if (r.throwT <= 0) { hangArms(r, false); hideHold(r); }
          rj._loco = 'jump';
        } else if (wantWalk) {
          // 阿婆跨步較慢、步伐較小（廣場 NPC 多半坐下，若座標移動仍用這套）
          if (r.isNpc) {
            r.bob += Math.min(gaitSp, 1.6) * dt * 2.6;
          } else {
            r.bob += plazaGaitRate(gaitSp) * dt;
          }
          const swing = posePlazaWalkCycle(r.rig, r.bob, Math.max(0.2, r.isNpc ? walkAmp * 0.55 : Math.max(0.25, walkAmp)));
          // 走動一律輕微ㄑ字彎肘擺臂（勿切回直臂下垂）
          if (r.throwT <= 0) { swingArms(r, swing); hideHold(r); }
          rj._loco = 'walk';
        } else if (!r.seated) {
          r.rig.legL.rotation.x *= 0.8; r.rig.legR.rotation.x *= 0.8;
          r.rig.shinL.rotation.x *= 0.8; r.rig.shinR.rotation.x *= 0.8;
          r.rig.root.position.y *= 0.8;
          r.rig.torso.rotation.y *= 0.8; r.rig.torso.rotation.z *= 0.8;
          // 阿婆每幀會再疊駝背角；用衰減會越疊越彎成 90 度，站著時直接歸零讓駝背只疊一次
          r.rig.torso.rotation.x = (r.isNpc && !isAberRemote(r)) ? 0 : r.rig.torso.rotation.x * 0.8;
          if (r.throwT <= 0) { hangArms(r, false); hideHold(r); }
          rj._loco = 'walk';
        }
        if (r.throwT > 0) {
          r.throwT -= dt;
          poseThrow(r);
          if (r.throwT <= 0) { r.throwT = 0; applyActionPose(r); }
        } else if (r.puff && (r.seated || isAberRemote(r))) {
          tickRemotePuff(r, dt);
        }
        applyHeadLook(r);
        if (!r.seated && anyoneCarriedBy(r.connId)) posePlazaCarryHold(r.rig);
      } else if (r.throwT > 0) {
        r.throwT = Math.max(0, r.throwT - dt);
      } else if (r.puff && (r.seated || isAberRemote(r))) {
        tickRemotePuff(r, dt);
      }
      // 坐下略往前（負＝朝蚵堆），避免後背穿出椅背
      const back = r.seated ? -0.08 : 0;
      let ox = r.x + Math.sin(r.yaw) * back;
      let oz = r.z + Math.cos(r.yaw) * back;
      let oy = (jumpElapsed >= 0 ? plazaJumpHeight(jumpElapsed) : 0) + plazaGroundY(r.x, r.z);
      let rotX = 0;
      let rotZ = 0;
      if (r.carriedBy && (r.phase || '') !== 'moon') {
        const car = findCarrierPose(r.carriedBy);
        // 抱的人蹲：整個人往下 0.4；躺：阿婆橫趴在對方胸口（身體往面向反方向倒）；跳：一起跳
        const lk = car && car.pz === 'lie' ? car.pk : 0;
        const ck = car && car.pz === 'crouch' ? car.pk : 0;
        const tilt = AMA_CARRY_TILT + (Math.PI / 2 - AMA_CARRY_TILT) * lk;
        if (car) {
          const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
          const sx = Math.cos(car.yaw), sz = -Math.sin(car.yaw);
          // 模型原點在腳底：前傾後髖會沿角色 +Z（＝抱人者右方）移出，往回扣才會橫躺在胸口
          const side = amaCarrySide(tilt);
          const fwd = AMA_CARRY_FWD * (1 - lk) - AMA_CARRY_LIE_BACK * lk;
          r.x = r.tx = car.x + fx * fwd - sx * side;
          r.z = r.tz = car.z + fz * fwd - sz * side;
          r.yaw = r.tyaw = car.yaw + Math.PI / 2;
        }
        ox = r.x; oz = r.z;
        oy = AMA_CARRY_Y + (AMA_CARRY_LIE_Y - AMA_CARRY_Y) * lk - 0.4 * ck + (car ? car.jy : 0);
        rotX = tilt; rotZ = AMA_CARRY_ROLL * (1 - lk);
        posePlazaCarried(r.rig);
      } else if (!r.seated && anyoneCarriedBy(r.connId)) {
        posePlazaCarryHold(r.rig);
      }
      if (r.isNpc && !isAberRemote(r) && r.seated && !(r.carriedBy && (r.phase || '') !== 'moon')) {
        oy += AMA_SIT_LIFT;
      }
      if (r.isNpc && !isAberRemote(r)) applyAmaAppearance(r.rig);
      r.rig.outer.position.set(ox, oy, oz);
      r.rig.outer.rotation.order = 'YXZ';
      r.rig.outer.rotation.y = r.yaw;
      r.rig.outer.rotation.x = rotX;
      if (!far) {
        { const ph = r.seated ? '' : (r.phase || ''); const want = ph === 'crouch' || ph === 'lie' ? 1 : 0; if (want) rj.pz = ph; rj.pk = (rj.pk ?? 0) + (want - (rj.pk ?? 0)) * 0.18; if (rj.pk > 0.001 && rj.pz && !r.moving) { r.rig.legL.rotation.x = r.rig.legR.rotation.x = 0; r.rig.shinL.rotation.x = r.rig.shinR.rotation.x = 0; } if (rj.pk > 0.001 && rj.pz) applyPlazaBodyPose(r.rig, rj.pz, rj.pk); }
      }
      { const now = performance.now(); const mu = rj.mt ? (now - rj.mt) / 1800 : -1; const inMoon = (r.phase || '') === 'moon'; r.rig.outer.rotation.z = rotZ;
        if (mu >= 0 && mu < 1) { r.rig.outer.position.x += Math.sin(rj.mz) * 22 * mu; r.rig.outer.position.z += Math.cos(rj.mz) * 22 * mu; r.rig.outer.position.y += 22 * mu; r.rig.outer.rotation.x = mu * 14; r.rig.outer.rotation.z = mu * 9; r.rig.outer.visible = true; rj.mh = true; }
        else if (inMoon && !(mu < 0 && rj.mt && now < rj.mt)) { r.rig.outer.visible = false; rj.mh = true; }
        else if (rj.mh && !inMoon) { r.rig.outer.visible = true; rj.mh = false; rj.mt = 0; }
        else if (mu >= 1 && !inMoon) { rj.mt = 0; rj.mh = false; r.rig.outer.visible = true; } }
      // 省電遠距：隱藏模型（碰撞仍用 x/z）
      if (eco && dist2 > HIDE2 && !rj.mh && (r.phase || '') !== 'moon') r.rig.outer.visible = false;
      else if (!(eco && dist2 > HIDE2) && !rj.mh && (r.phase || '') !== 'moon' && !r.awaitingPose) r.rig.outer.visible = true;
      // 寵物逐幀：坐著→頭頂；走動→身後彈跳
      updateRemotePet(r, dt);
      // 這幀下面馬上要讀 head 世界座標排名牌，更新 matrix；渲染器之後本來也會再更新一次，不用 force
      r.rig.outer.updateMatrixWorld();
      const show = r.rig.outer.visible && !r.awaitingPose && !rj.mh;
      r.tag.sprite.visible = show;
      // 有寵物且坐著時寵物會停在頭上（y≈1.44），名牌 / 聊天泡泡要往上讓位
      // 戴帽子時寵物再抬 headTopLift，名牌同步加抬，否則被帽頂＋寵物一起擋到
      const petOnHead = !!(r as any)._petMesh && !!r.seated;
      const remoteHeadId = petOnHead ? ((r.rig.outfitKey ?? '').split('|')[0] ?? '') : '';
      const remoteHatLift = headTopLift(remoteHeadId);
      const tagLift = petOnHead ? 0.52 + remoteHatLift : 0.22;
      const bubLift = petOnHead ? 0.72 + remoteHatLift : 0.42;
      if (show) placeAboveHead(r.tag.sprite, r.rig.head, tagLift);
      if (r.bubUntil > t && show) {
        placeAboveHead(r.bubble.sprite, r.rig.head, bubLift);
        r.bubble.sprite.visible = true;
      } else {
        const w = r.isNpc ? wishForRemote(r) : undefined;
        if (w && show) {
          const txt = wishBubbleText(w);
          if ((r as any)._wishLine !== txt) {
            (r as any)._wishLine = txt;
            r.bubble.setText(txt, true);
            r.bubble.setOpacity(1);
          }
          placeAboveHead(r.bubble.sprite, r.rig.head, bubLift);
          r.bubble.sprite.visible = true;
        } else {
          if ((r as any)._wishLine) (r as any)._wishLine = '';
          if (r.bubble.sprite.visible) r.bubble.sprite.visible = false;
        }
      }
    }
    if (selfBubUntil > t) {
      const headY = selfSeated ? CHAIR_SEAT_Y + SIT_HIP_LIFT + 0.95 : 1.72;
      const back = selfSeated ? -0.08 : 0;
      const ox = selfX + Math.sin(selfYaw) * back;
      const oz = selfZ + Math.cos(selfYaw) * back;
      // 坐著且有寵物（在頭頂）時，聊天泡泡再往上讓一截；戴帽子再加抬
      const selfPetOnHead = selfSeated && !!(opts.hasOwnPet?.() ?? false);
      const selfHatLift = selfPetOnHead ? (opts.selfHatLift?.() ?? 0) : 0;
      const bubLift = selfPetOnHead ? 0.42 + selfHatLift : 0.12;
      selfBubble.sprite.position.set(ox, headY + bubLift, oz);
      selfBubble.sprite.visible = true;
    } else if (selfBubble.sprite.visible) selfBubble.sprite.visible = false;
    if (wishMarks.children.length) {
      const pulse = 1 + 0.08 * Math.sin(t * 0.004);
      for (const c of wishMarks.children) c.scale.setScalar(pulse);
    }
    grill.tick(t);
    const tSec = t * 0.001;
    // 手機／省電：煙、咖啡、旗幟約 15Hz；桌機非省電仍每幀
    const throttleFx = MOBILE || eco;
    let runFx = true;
    let fdt = dt;
    if (throttleFx) {
      fireThrottle += dt;
      runFx = fireThrottle >= 1 / 15;
      fdt = fireThrottle;
      if (runFx) fireThrottle = 0;
    }
    if (runFx) {
      for (const f of fireFx) {
        f.group.getWorldPosition(_firePos);
        const fd2 = (_firePos.x - cx) * (_firePos.x - cx) + (_firePos.z - cz) * (_firePos.z - cz);
        if (eco && fd2 > FIRE2) continue;
        f.tick(tSec, fdt);
      }
      ambiance.tick(tSec, fdt);
      smokeArea.tick(tSec, fdt);
      cafe.tick(tSec, fdt);
      flags.tick(fdt, camera);
      if (!eco) bigShed.tick(fdt);
      tickRemoteExhales(fdt);
    }
    // 遠端吸菸：手持菸（掛腕）＋菸頭薄煙；不再用頭側飄煙以免看起來沒拿菸
    type SmokeJob = { r: Remote; cig: NonNullable<ReturnType<typeof getPlazaSmokeCig>>; dist2: number; aber: boolean };
    const smokeJobs: SmokeJob[] = [];
    for (const r of remotes.values()) {
      const wantSeat = r.seated && (isSmokePile(r.pileId) || (r.phase || '') === 'smoke');
      const wantAber = isAberRemote(r) && !r.carriedBy && (r.phase || '') !== 'carried' && (r.phase || '') !== 'moon'
        && (r.seated || (r.phase || '') === 'stand');
      const want = wantSeat || wantAber;
      if (want && r.isNpc && (isSmokePile(r.pileId) || wantAber)) tickNpcAutoPuff(r);
      if (want) {
        ensurePlazaSmokeCig(r.rig, LO, aberMouthSmoke(r) ? 'mouth' : 'hand');
        const cig = getPlazaSmokeCig(r.rig);
        if (cig) {
          cig.setSmokeTint(!r.isNpc && parseCosmetics(r.cosmetics).goldSmoke ? GOLD_SMOKE_TINT : undefined);
          const dx = r.x - cx, dz = r.z - cz;
          smokeJobs.push({ r, cig, dist2: dx * dx + dz * dz, aber: wantAber && !LO });
        }
      } else {
        clearPlazaSmokeCig(r.rig);
      }
      // 舊頭側煙：隱藏（保留物件以免重配額抖動；離場 destroy 會清）
      if (r.cigSmoke) r.cigSmoke.group.visible = false;
    }
    if (runFx) {
      smokeJobs.sort((a, b) => a.dist2 - b.dist2);
      const cap = MOBILE ? 4 : smokeJobs.length;
      for (let i = 0; i < smokeJobs.length && i < cap; i++) {
        const s = smokeJobs[i];
        s.cig.tick(tSec, fdt);
        if (s.aber) tickAberAshes(s.r, s.cig, fdt);
      }
    }
    // 本機第三人稱 avatar 的菸由 main plazaMe 掛載；此處 selfCig 僅作後備薄煙，坐下吸菸時關掉避免重複
    if (selfCig) {
      selfCig.group.visible = selfSmoke && !selfSeated;
      if (selfCig.group.visible) {
        const headY = 1.72;
        selfCig.group.position.set(
          selfX - Math.sin(selfYaw) * 0.12 + Math.cos(selfYaw) * 0.08,
          headY,
          selfZ - Math.cos(selfYaw) * 0.12 - Math.sin(selfYaw) * 0.08,
        );
        if (runFx) selfCig.tick(tSec, fdt);
      }
    }
    for (const k of stallKeepers) {
      const dx = k.rig.outer.position.x - cx, dz = k.rig.outer.position.z - cz;
      const kd2 = dx * dx + dz * dz;
      if (eco) {
        k.rig.outer.visible = kd2 <= HIDE2; if (kd2 > FAR2) continue;
        k.rig.outer.visible = true;
      }
      k.rig.torso.rotation.y = Math.sin(tSec * 0.5 + k.ph) * 0.15;
      if (!eco) posePlazaStallKeeper(k.rig, tSec, k.ph);
      applyAmaAppearance(k.rig);
      tickKeeperBubble(k, tSec);
    }
    let serverAber = false;
    for (const r of remotes.values()) {
      if (isAberRemote(r)) { serverAber = true; break; }
    }
    if (serverAber) {
      smokeNpc.rig.outer.visible = false;
      smokeNpc.tag.sprite.visible = false;
    } else {
      tickSmokeNpc(dt, tSec, eco, cx, cz);
    }
  }

  /** 站立／蹲／躺／跳躍的遠端：擋路（不推擠）；坐下、尚未現身：不擋；躺＝isLie */
  function walkBodies(): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    for (const r of remotes.values()) {
      if (r.seated || r.awaitingPose || !r.rig.outer.visible) continue;
      if (r.carriedBy || (r.phase || '') === 'carried' || (r.phase || '') === 'moon') continue;
      const ph = r.phase || '';
      if (ph === 'lie') {
        // outer.Rx=+π/2 後身體沿 +Z 倒地，再經 yaw 變成 (sin,cos)＝面向的反方向（頭在腳後方）
        const bx = Math.sin(r.yaw), bz = Math.cos(r.yaw);
        for (const [t, rr] of [[0, 0.34], [0.35, 0.38], [0.7, 0.4], [1.05, 0.36], [1.35, 0.32]] as const)
          out.push([r.x + bx * t, r.z + bz * t, rr, 1]);
      } else if (ph === 'crouch') {
        out.push([r.x, r.z, 0.45, 0]); // 蹲時膝蓋前伸，略加大
      } else {
        out.push([r.x, r.z, 0.38, 0]);
      }
    }
    return out;
  }

  function dispose() {
    shedRow.dispose();
    clearWishMarks();
    root.remove(wishMarks);
    for (const m of [
      remoteMeatMat, remoteBasinMat, remoteBasinFlMat, remoteBasinOyMat, remoteBowlMat, remoteBowlFlMat,
      remoteHoldWood, remoteHoldSteel, remoteHoldShell, remoteHoldShellTop,
      remoteUmbPoleMat, remoteUmbCanopyMat,
    ]) { try { m.dispose(); } catch { /* */ } }
    for (const g of [
      remoteMeatGeo, remoteBasinGeo, remoteBasinFlGeo, remoteBasinOyGeo, remoteBowlWallGeo, remoteBowlFlGeo,
      remoteHoldBotGeo, remoteHoldTopGeo, remoteUmbPoleGeo, remoteUmbCanopyGeo,
    ]) { try { g.dispose(); } catch { /* */ } }
    for (const e of remoteExhales) {
      try { e.fx.group.parent?.remove(e.fx.group); } catch { /* */ }
      e.fx.dispose();
    }
    remoteExhales.length = 0;
    for (const a of smokeNpc.ashes) a.dispose();
    smokeNpc.ashes.length = 0;
    for (const e of smokeNpc.exhales) {
      try { e.fx.group.parent?.remove(e.fx.group); } catch { /* */ }
      e.fx.dispose();
    }
    smokeNpc.exhales.length = 0;
    clearPlazaSmokeCig(smokeNpc.rig);
    try { root.remove(smokeNpc.rig.outer); } catch { /* */ }
    try { smokeNpc.tag.dispose(); } catch { /* */ }
    for (const r of [...remotes.values()]) destroyRemote(r);
    remotes.clear();
    disposePileDiffSigns();
    flags.dispose();
    grill.dispose();
    for (const f of fireFx) f.dispose();
    fireFx.length = 0;
    smokeArea.ambientSmoke.dispose();
    cafe.dispose();
    seafood.dispose();
    hq.dispose();
    if (selfCig) { root.remove(selfCig.group); selfCig.dispose(); selfCig = null; }
    for (const g of cushions.values()) disposeCushion(g);
    cushions.clear();
    for (const pl of plazaLights) { root.remove(pl); pl.dispose(); }
    plazaLights.length = 0;
    selfBubble.dispose();
    scene.remove(root);
    floorMaps.map.dispose();
    floorMaps.rough.dispose();
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry && !m.userData.sharedGeo && m.geometry !== opts.shellGeo) m.geometry.dispose();
      if (m.userData.sharedMat) return;
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(x => { if (x !== opts.shellMat) x.dispose(); });
      else if (mat && mat !== opts.shellMat) mat.dispose();
    });
  }

  function aimMg(slot: number, yaw: number, pitch: number) {
    const m = mgMounts[Math.max(0, Math.min(mgMounts.length - 1, slot))];
    if (m) aimMgMount(m, yaw, pitch);
  }
  function mgHitTargets(): MgHitTarget[] {
    const out: MgHitTarget[] = [];
    for (const r of remotes.values()) {
      if (r.isNpc || r.awaitingPose) continue;
      out.push({
        connId: r.connId,
        x: r.rig.outer.position.x,
        y: r.rig.outer.position.y + (r.seated ? 1.1 : 1.0),
        z: r.rig.outer.position.z,
        seated: !!r.seated,
      });
    }
    return out;
  }
  const _dispose = dispose;
  function disposeAll() {
    mgFx.dispose();
    _dispose();
  }
  return {
    root, pileGroups, syncRoster, upsert, remove, pruneSelf, applyPose, setPhase, highlight, highlightNear, hitPile, grill,
    syncFlags: flags.sync, aimTargets, walkBodies, moonLaunch, showChat, setSelfPose, setSelfBody, setSelfCushion,
    playThrowFx, applyRemotePuff, setSeatWishes, setShedDoorState: shedRow.setDoorState,
    mgMounts, aimMg, mgFx, mgHitTargets, tick,
    tickTpOcclude: (dt, camera, focus) => applyTpOcclude(dt, camera, focus),
    dispose: disposeAll,
  };
}

export function tickPlazaTags(view: PlazaWorldView | null, camera: THREE.Camera, dt = 0.016) {
  if (!view) return;
  view.tick(dt, camera);
}
