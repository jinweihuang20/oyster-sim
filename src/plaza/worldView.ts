import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import { applyOutfitToRig, normalizeOutfitIds, outfitKey } from '../shop/equipVisual';
import {
  makePlayerAvatar, posePlazaHangArms, posePlazaWalkSwingArms, posePlazaWalkCycle, posePlazaJump,
  posePlazaSit, posePlazaStand, posePlazaSmokeSit,
  plazaJumpHeight, PLAZA_JUMP_DUR, posePlazaStallKeeper, applyPlazaBodyPose, type PlayerRig,
  PLAZA_SIT_ROOT_Y,
} from '../dm/character';
import { makeMeshHelpers } from '../dm/mesh';
import { PILE_COUNT, SLOTS_PER_PILE, NPC_SLOTS_PER_PILE, WALK_BOUND, PLAZA_LAMP_XZ, pileCenter, seatPose, seatKey, pileHasNpc, pileIsGrill, isSmokePile, SMOKE_PILE_ID, type PlazaSeatRef } from './layout';
import { makeYardLikePile, makePlazaGrill, makePlazaChair, makePlazaFloorMaps, makePlazaBigShed, CHAIR_SEAT_Y, PLAZA_ROOF_Y } from './props';
import { makePlazaAmbiance, PLAZA_STALL_SITES } from './ambiance';
import { makePlazaSmokeArea } from './smokeArea';
import { createGrillView, type PlazaGrillView } from './grillView';
import { makeCigSmoke, type CharcoalFireFx } from './fireFx';
import { makeWorldLabel, type WorldLabel } from '../world/worldLabel';
import type { PlazaAimTarget, PlazaPlayer, PlazaSnapshot } from './types';
import { plazaDisplayName } from './types';

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
  /** 剛進場、座標尚不可信：先藏模型，避免從原點高速滑行 */
  awaitingPose: boolean;
  isNpc?: boolean;
};

const SHIRTS = [0xc45c26, 0x3a6ea5, 0x2f7d4a, 0x8a3a6a, 0x6a5a2a, 0x4a4a7a];
const HAIRS = [0x222222, 0x555555, 0x888888, 0x3a2a1a, 0xdddddd];
/** 廣場阿婆農婦裝：依 pid 抽一套，頭巾／斗笠／漁夫帽混搭 */
type AmaFarmLook = {
  shirt: number;
  hair: number;
  pants: number;
  /** 頭巾／斗笠染色（斗笠偏草黃） */
  headTint: number;
  head: 'hd_basic' | 'hd_hat' | 'hd_fisher';
  hand: 'sl_flower' | 'hn_basic' | 'sl_rain';
  legs: 'lg_basic' | 'lg_flower';
  feet: 'ft_basic' | 'ft_boots';
  apron: boolean;
  bun: boolean;
};
const AMA_LOOKS: AmaFarmLook[] = [
  // 橘衫＋紅花頭巾＋圍裙＋藍白拖
  { shirt: 0xe87840, hair: 0x8a8a8a, pants: 0x3a5068, headTint: 0xc84a5a, head: 'hd_basic', hand: 'sl_flower', legs: 'lg_basic', feet: 'ft_basic', apron: true, bun: true },
  // 綠衫＋斗笠＋花褲＋雨鞋
  { shirt: 0x3a9a6a, hair: 0x444444, pants: 0x2a3848, headTint: 0xd8b46a, head: 'hd_hat', hand: 'sl_flower', legs: 'lg_flower', feet: 'ft_boots', apron: true, bun: true },
  // 粉衫＋藍花頭巾、白髮、無圍裙
  { shirt: 0xe86878, hair: 0xc8c8c8, pants: 0x4a4a52, headTint: 0x5a7ab0, head: 'hd_basic', hand: 'hn_basic', legs: 'lg_basic', feet: 'ft_basic', apron: false, bun: true },
  // 茄紫衫＋斗笠＋素袖＋工作褲
  { shirt: 0x8a4a7a, hair: 0x666666, pants: 0x3a4050, headTint: 0xc9a56a, head: 'hd_hat', hand: 'hn_basic', legs: 'lg_basic', feet: 'ft_basic', apron: true, bun: false },
  // 芥黃衫＋漁夫帽＋碎花袖
  { shirt: 0xc9a24a, hair: 0x555555, pants: 0x4a5540, headTint: 0x4a6a8a, head: 'hd_fisher', hand: 'sl_flower', legs: 'lg_basic', feet: 'ft_boots', apron: false, bun: true },
  // 青色衫＋黃頭巾＋花褲
  { shirt: 0x2a8a8a, hair: 0xaaaaaa, pants: 0x3a5068, headTint: 0xe0b040, head: 'hd_basic', hand: 'sl_flower', legs: 'lg_flower', feet: 'ft_basic', apron: true, bun: true },
  // 酒紅衫＋斗笠＋雨衣袖＋雨鞋（像剛從外面進來）
  { shirt: 0xa04050, hair: 0x777777, pants: 0x2a2a38, headTint: 0xb89550, head: 'hd_hat', hand: 'sl_rain', legs: 'lg_basic', feet: 'ft_boots', apron: true, bun: true },
  // 天藍衫＋粉頭巾、無髻、拖鞋
  { shirt: 0x4a8aba, hair: 0x3a2a1a, pants: 0x5a4a3a, headTint: 0xe86a8a, head: 'hd_basic', hand: 'hn_basic', legs: 'lg_flower', feet: 'ft_basic', apron: false, bun: false },
  // 橄欖綠＋斗笠＋花褲、無圍裙
  { shirt: 0x6a7a3a, hair: 0xbbbbbb, pants: 0x3a3a48, headTint: 0xe0c078, head: 'hd_hat', hand: 'sl_flower', legs: 'lg_flower', feet: 'ft_basic', apron: false, bun: true },
  // 藕粉衫＋花頭巾＋圍裙＋雨鞋
  { shirt: 0xd89090, hair: 0x999999, pants: 0x4a5568, headTint: 0xc86a5a, head: 'hd_basic', hand: 'sl_flower', legs: 'lg_basic', feet: 'ft_boots', apron: true, bun: true },
  // 深灰藍＋漁夫帽＋素袖工作褲
  { shirt: 0x4a5a6a, hair: 0xdddddd, pants: 0x2a3040, headTint: 0x3a5a7a, head: 'hd_fisher', hand: 'hn_basic', legs: 'lg_basic', feet: 'ft_basic', apron: true, bun: true },
  // 橙紅衫＋斗笠＋碎花袖＋藍白拖
  { shirt: 0xd06030, hair: 0x6a6a6a, pants: 0x3a4860, headTint: 0xd0a860, head: 'hd_hat', hand: 'sl_flower', legs: 'lg_basic', feet: 'ft_basic', apron: true, bun: true },
];

/**
 * 與死鬥 NPC 同一套 makePlayerAvatar，比例 1:1（不再縮放）。
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
  /** 坐下遠端玩家的瞄準點（丟殼／偷肉） */
  aimTargets: () => PlazaAimTarget[];
  /** 走動碰撞用：遠端 `[x, z, radius, isLie]`；isLie=1 時跳躍夠高可越过 */
  walkBodies: () => [number, number, number, number][];
  moonLaunch: (connId: string, delayMs?: number, fromX?: number, fromZ?: number) => void;
  /** 頭頂氣泡：最後一句聊天，約 5 秒 */
  showChat: (opts: { connId?: string; pid?: string; nick?: string; text: string; self?: boolean }) => void;
  setSelfPose: (x: number, z: number, yaw: number, seated: boolean, smoke?: boolean) => void;
  playThrowFx: (connId: string) => void;
  tick: (dt: number, camera: THREE.Camera) => void;
  dispose: () => void;
};

export type PlazaWorldOpts = {
  shellGeo: THREE.BufferGeometry;
  shellMat: THREE.Material;
  lowDetail?: boolean;
  /** 省電：執行中動態降燈／炭火／遠距角色 */
  eco?: () => boolean;
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

  const fireFx: CharcoalFireFx[] = [];
  for (let i = 0; i < PILE_COUNT; i++) {
    const c = pileCenter(i);
    // 南排烤蚵台；其餘沿用工寮蚵山（InstancedMesh）
    const pile = pileIsGrill(i)
      ? makePlazaGrill(opts.shellGeo, opts.shellMat, i, LO)
      : makeYardLikePile(opts.shellGeo, opts.shellMat, i, LO ? 140 : 210);
    pile.position.copy(c);
    root.add(pile);
    pileGroups.push(pile);
    const fx = pile.userData.fireFx as CharcoalFireFx | undefined;
    if (fx) fireFx.push(fx);

    const seatN = SLOTS_PER_PILE + (pileHasNpc(i) ? NPC_SLOTS_PER_PILE : 0);
    for (let s = 0; s < seatN; s++) {
      const pose = seatPose(i, s);
      const { group, pad } = makePlazaChair(pose.pos.x, pose.pos.z, pose.yaw, M, add);
      root.add(group);
      seatMeshes.set(seatKey(i, s), pad);
    }
  }

  // 廣場大棚（鏽鐵皮＋外圈木柱，避開堆／椅；工寮原棚進場仍隱藏）
  const bigShed = makePlazaBigShed(M, add, LO);
  root.add(bigShed.group);

  // 外圈夜市攤／烤肉區（氣氛；碰撞見 plazaStallObstacles）
  const ambiance = makePlazaAmbiance(M, add, LO);
  root.add(ambiance.group);

  // 西側棚外吸菸區（座位 pileId=SMOKE_PILE_ID）
  const smokeArea = makePlazaSmokeArea(M, add, LO);
  root.add(smokeArea.group);
  for (const [k, pad] of smokeArea.seatPads) seatMeshes.set(k, pad);

  // 攤位老闆（純客戶端，不經伺服器）：站在攤台後方、面向廣場中心
  const stallKeepers: { rig: PlayerRig; ph: number; lines: string[]; bub: WorldLabel | null; next: number; until: number; li: number }[] = [];
  const KEEPER_LINES: Record<string, string[]> = {
    bbq: ['烤肉喔！剛烤好的！', '香腸一支三十，兩支五十五！', '來喔來喔，烤玉米也有！', '要辣的跟我說喔～'],
    'drink-s': ['冰涼的青草茶喔！', '剝蚵剝到口渴了吧？來一杯！', '冬瓜茶、楊桃汁，現倒現喝！', '大杯的才三十喔！'],
    seafood: ['現撈的喔！新鮮的！', '蚵仔煎、蚵仔湯，好吃又便宜！', '今天的蝦子很大隻喔！', '來看看，不買沒關係！'],
  };
  PLAZA_STALL_SITES.filter((s) => KEEPER_LINES[s.id]).forEach((site, idx) => {
    const look = AMA_LOOKS[(idx * 3 + 1) % AMA_LOOKS.length];
    const rig = makePlayerAvatar({ shirt: look.shirt, hair: look.hair, pants: look.pants }, M, add, LO);
    dressPlazaAma(rig, look);
    posePlazaHangArms(rig, false);
    const out = Math.atan2(site.x, site.z);
    const back = site.kind === 'bbqSit' ? 1.05 : site.kind === 'cart' ? 0.6 : 0.68;
    rig.outer.position.set(site.x + Math.sin(out) * back, 0, site.z + Math.cos(out) * back);
    rig.outer.rotation.y = out;
    rig.outer.scale.setScalar(AVATAR_SCALE);
    root.add(rig.outer);
    stallKeepers.push({ rig, ph: idx * 1.7, lines: KEEPER_LINES[site.id], bub: null, next: 3 + idx * 4, until: 0, li: idx });
  });

  // 南排共烤：伺服器同步的烤網上蚵仔
  const grill = createGrillView(root);

  // 四堆一盞實際點光（對齊吊燈外觀；不投影以免 4 燈吃效能）
  const plazaLights: THREE.PointLight[] = [...ambiance.lights];
  const roofLamps: THREE.PointLight[] = [];
  const roofLampBaseI = LO ? 7 : 9.5;
  for (const [x, z] of PLAZA_LAMP_XZ) {
    const pl = new THREE.PointLight(0xffe2b8, roofLampBaseI, LO ? 13 : 15, 1.35);
    pl.position.set(x, PLAZA_ROOF_Y - 0.55, z);
    pl.castShadow = false;
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

  function aimTargets(): PlazaAimTarget[] {
    const out: PlazaAimTarget[] = [];
    for (const r of remotes.values()) {
      if (!r.seated || r.pileId < 0 || isSmokePile(r.pileId) || (r.phase || '') === 'moon') continue;
      const h = headWorld(r, new THREE.Vector3());
      const b = bowlWorld(r, new THREE.Vector3());
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
      const a = AMA_LOOKS[Math.abs(h) % AMA_LOOKS.length];
      return { shirt: a.shirt, hair: a.hair, pants: a.pants };
    }
    return { shirt: SHIRTS[Math.abs(h) % SHIRTS.length], hair: HAIRS[Math.abs(h >> 3) % HAIRS.length], pants: 0x2a2a40 };
  }

  /** 依變體套農婦裝：頭巾／斗笠／漁夫帽、袖口、褲、鞋、圍裙皆可不同 */
  function dressPlazaAma(rig: PlayerRig, ama: AmaFarmLook) {
    applyOutfitToRig(rig, {
      head: ama.head,
      hand: ama.hand,
      body: 'bd_basic',
      legs: ama.legs,
      feet: ama.feet,
    });
    const mats = rig.outfitMats;
    if (!mats) return;
    for (const m of mats.body) {
      m.map = null;
      m.color.setHex(ama.shirt);
      m.emissive.setHex(0);
      m.needsUpdate = true;
    }
    for (const m of mats.hair) {
      m.map = null;
      m.color.setHex(ama.hair);
      m.emissive.setHex(0);
      m.needsUpdate = true;
    }
    // 素色工作褲才蓋色；花褲保留碎花貼圖
    if (ama.legs === 'lg_basic') {
      for (const m of mats.legs) {
        m.map = null;
        m.color.setHex(ama.pants);
        m.emissive.setHex(0);
        m.needsUpdate = true;
      }
    }
    if (ama.feet === 'ft_basic') {
      // 藍白拖：鞋面藍、鞋底米白
      if (mats.feet[0]) {
        mats.feet[0].map = null;
        mats.feet[0].color.setHex(0x2a5ab0);
        mats.feet[0].needsUpdate = true;
      }
      if (mats.feet[1]) {
        mats.feet[1].map = null;
        mats.feet[1].color.setHex(0xf6f2ea);
        mats.feet[1].needsUpdate = true;
      }
    }
    if (rig.hatG) {
      const tint = new THREE.Color(ama.headTint);
      rig.hatG.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (mesh.isMesh && mat?.color) mat.color.copy(tint);
      });
      // 只有花布頭巾打側結；斗笠／漁夫帽不加
      if (ama.head === 'hd_basic' && !rig.hatG.userData.amaKnot) {
        const knotM = new THREE.MeshStandardMaterial({ color: ama.headTint, roughness: 0.8 });
        const knot = new THREE.Mesh(rboxEnv(0.08, 0.06, 0.1), knotM);
        knot.position.set(0.14, 0.12, 0.02);
        knot.rotation.z = 0.4;
        rig.hatG.add(knot);
        rig.hatG.userData.amaKnot = 1;
      }
    }
    if (ama.apron && !rig.torso.userData.amaApron) {
      const apronM = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.92 });
      const strapM = new THREE.MeshStandardMaterial({ color: 0xe4ddd0, roughness: 0.9 });
      const apron = new THREE.Mesh(rboxEnv(0.26, 0.34, 0.03), apronM);
      apron.position.set(0, 0.02, -0.13);
      rig.torso.add(apron);
      for (const s of [-1, 1] as const) {
        const strap = new THREE.Mesh(rboxEnv(0.028, 0.2, 0.02), strapM);
        strap.position.set(s * 0.09, 0.28, -0.1);
        strap.rotation.z = s * 0.18;
        rig.torso.add(strap);
      }
      const pocket = new THREE.Mesh(rboxEnv(0.1, 0.08, 0.02), strapM);
      pocket.position.set(0.06, -0.06, -0.145);
      rig.torso.add(pocket);
      rig.torso.userData.amaApron = 1;
    }
    if (ama.bun && !rig.head.userData.amaBun) {
      const bunM = new THREE.MeshStandardMaterial({ color: ama.hair, roughness: 0.85 });
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bunM);
      // 斗笠下髮髻略往後，避免穿模
      bun.position.set(0, ama.head === 'hd_hat' ? 0.06 : 0.12, ama.head === 'hd_hat' ? 0.14 : 0.12);
      rig.head.add(bun);
      rig.head.userData.amaBun = 1;
    }
  }

  void bubblesHost;

  const selfBubble = makeWorldLabel(' ', 'bubble', { worldH: 0.36, depthTest: false });
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
      depthTest: false,
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
    const el = makeWorldLabel(' ', 'bubble', { worldH: 0.36, depthTest: false, nameTone: isNpc ? 'npc' : 'player' });
    el.sprite.visible = false;
    root.add(el.sprite);
    return el;
  }

  function placeAboveHead(sprite: THREE.Sprite, head: THREE.Object3D, yLift: number) {
    head.getWorldPosition(_tagHead);
    sprite.position.set(_tagHead.x, _tagHead.y + yLift, _tagHead.z);
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

  /** 坐下面前：紅臉盆＋裝肉碗（貼蚵堆坡面，renderOrder 高於殼堆） */
  function makeRemoteProps(): { props: THREE.Group; bowlNode: THREE.Object3D; meatRoot: THREE.Group } {
    const props = new THREE.Group();
    props.visible = false;
    const markTop = (o: THREE.Object3D) => {
      o.traverse(x => {
        const m = x as THREE.Mesh;
        if (m.isMesh) m.renderOrder = 2;
      });
    };
    // 座椅離堆心 ~1.38；盆／碗再往 -Z（堆心）靠並抬高，像擱在蚵山上
    const basinMat = M(0xc84030, { side: THREE.DoubleSide, roughness: 0.55, flatShading: true });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.11, 12, 1, true), basinMat);
    // 臉盆左、裝肉碗右；兩盆間距 ≈ 兩顆蚵殼短邊
    const basinX = -0.28, basinZ = -0.58;
    basin.position.set(basinX, 0.2, basinZ);
    props.add(basin);
    const basinFl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), M(0xa03028, { roughness: 0.65, flatShading: true }));
    basinFl.rotation.x = -Math.PI / 2;
    basinFl.position.set(basinX, 0.145, basinZ);
    props.add(basinFl);
    // 盆裡幾顆殼示意
    for (let i = 0; i < 5; i++) {
      const a = i * 1.1, rr = 0.04 + (i % 3) * 0.02;
      const oy = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 5, 4),
        M(0xc8c2c0, { roughness: 0.8, flatShading: true }),
      );
      oy.scale.set(1.2, 0.55, 1);
      oy.position.set(basinX + Math.cos(a) * rr, 0.2, basinZ + Math.sin(a) * rr);
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
    const meatX = basinX + 0.2 + 0.2 + 0.13; // 盆緣 + 兩短邊 + 肉碗半徑
    bowlNode.position.set(meatX, 0.22, basinZ);
    props.add(bowlNode);
    const meatRoot = new THREE.Group();
    meatRoot.position.set(meatX, 0.3, basinZ);
    props.add(meatRoot);
    markTop(props);
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
  function poseSit(r: Remote) { posePlazaSit(r.rig); }
  function poseStand(r: Remote) { posePlazaStand(r.rig); }

  function applyActionPose(r: Remote) {
    if (r.throwT > 0) { poseThrow(r); applyHeadLook(r); return; }
    if (r.umb) { poseUmb(r); applyHeadLook(r); return; }
    const ph = (r.phase || '').toLowerCase();
    if (r.seated) {
      poseSit(r);
      if (ph === 'smoke' || isSmokePile(r.pileId)) {
        // 抽烟 idle：右手近嘴、無刀無蚵
        posePlazaSmokeSit(r.rig);
        r.knife.visible = false;
        r.oyster.visible = false;
        r.headWorkX = -0.04;
      } else if (ph === 'twist' || ph === 'pry') {
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
      } else if (ph === 'grillplace' || ph === 'grillflip' || ph === 'grilltake') {
        // 烤蚵：伸手往烤網放／掀／取
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.12, 0.18, -0.32, -0.06, 0.12, -0.48);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.12, 0.18, -0.28, 0.06, 0.12, -0.44);
        placeHold(r, 0.0, 0.1, -0.46, -0.06, 0.12, -0.48, ph !== 'grilltake');
        r.knife.visible = false;
        r.headWorkX = 0.14;
      } else if (ph === 'grillcook') {
        // 等烤開：蚵在烤網上，雙手擱桌邊
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.28, 0, -0.2, 0.14, -0.18, -0.18, 0.08, -0.28);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.28, 0, 0.2, 0.14, -0.18, 0.18, 0.08, -0.28);
        r.knife.visible = false;
        r.oyster.visible = true;
        r.oyster.position.set(0, 0.02, -0.55);
        r.oyster.rotation.set(0.15, 0.2, 0);
        r.headWorkX = 0.18;
      } else if (ph === 'aim' || ph === 'toss') {
        // 左手托肉／蚵往前，右手刀收一點
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.3, 0, -0.16, 0.22, -0.28, -0.1, 0.16, -0.44);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.2, 0.22, -0.12, 0.18, 0.12, -0.28);
        placeHold(r, 0.18, 0.12, -0.28, -0.1, 0.16, -0.44, true);
        r.headWorkX = -0.05;
      } else if (ph === 'throwaim') {
        // 準星瞄到人：左手高舉拿殼，全場可見要丟
        placeArmChain(r.rig.upperL, r.rig.lowerL, -0.22, 0.32, 0, -0.24, 0.5, -0.16, -0.18, 0.64, -0.3);
        placeArmChain(r.rig.upperR, r.rig.lowerR, 0.22, 0.3, 0, 0.16, 0.14, -0.08, 0.14, 0.06, -0.2);
        r.knife.visible = false;
        r.oyster.visible = true;
        r.oyster.position.set(-0.18, 0.6, -0.32);
        r.oyster.rotation.set(0.45, -0.25, 0.35);
        r.headWorkX = -0.16;
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
      // 烤位不拿剝蚵刀（含 pick／aim／empty）
      if (pileIsGrill(r.pileId)) r.knife.visible = false;
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
      const isNpc = !!(p.isNpc || pid.startsWith('npc-'));
      const look = hashLook(pid, isNpc);
      const rig = makePlayerAvatar(look, M, add, LO);
      if (isNpc) {
        dressPlazaAma(rig, AMA_LOOKS[Math.abs(hashPid(pid)) % AMA_LOOKS.length]);
      } else {
        applyOutfitToRig(rig, normalizeOutfitIds({
          head: p.head, hand: p.hand, body: p.body, legs: p.legs, feet: p.feet,
        }));
      }
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
        key: pid, connId: p.connId || '', pid, rig,
        tag: ensureTag(isNpc ? (p.nick || '阿婆') : plazaDisplayName(p.nick, p.tag), isNpc), bubble: ensureBubble(isNpc), bubUntil: 0,
        pileId: p.pileId, slot: p.slot, phase: p.phase, count: p.count, nick: p.nick || (isNpc ? '阿婆' : '剝蚵人'),
        numTag: isNpc ? '' : (p.tag || '').replace(/^#/, ''),
        seated: !!p.seated, moving: !!p.moving, umb: !!p.umb, umbMesh,
        props, bowlNode, meatRoot, meatMeshes: [], knife, oyster,
        tx: x, tz: z, tyaw: yaw, x, z, yaw, bob: 0, throwT: 0,
        tLookYaw: 0, lookYaw: 0, tPitch: 0, pitch: 0, headWorkX: 0,
        awaitingPose,
        isNpc,
      };
      remotes.set(pid, r);
      r.props.visible = r.seated && !isSmokePile(r.pileId);
      if (r.seated && !isSmokePile(r.pileId)) syncRemoteMeats(r);
      hangArms(r, r.seated);
      if (awaitingPose) { rig.outer.visible = false; r.tag.sprite.visible = false; }
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
    r.props.visible = r.seated && !isSmokePile(r.pileId);
    if (r.seated && !isSmokePile(r.pileId)) syncRemoteMeats(r);
    if (p.nick && p.nick !== r.nick) r.nick = p.nick;
    if (p.isNpc != null) r.isNpc = !!p.isNpc;
    if (!r.isNpc && p.tag) r.numTag = String(p.tag).replace(/^#/, '');
    {
      const label = r.isNpc ? r.nick : plazaDisplayName(r.nick, r.numTag);
      r.tag.setText(r.seated && !isSmokePile(r.pileId) ? `${label} · ${r.count}` : label);
    }
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

  function destroyRemote(r: Remote) {
    if (r.cigSmoke) { root.remove(r.cigSmoke.group); r.cigSmoke.dispose(); r.cigSmoke = undefined; }
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

  function setSelfPose(x: number, z: number, yaw: number, seated: boolean, smoke = false) {
    selfX = x; selfZ = z; selfYaw = yaw; selfSeated = seated; selfSmoke = !!(seated && smoke);
    if (selfSmoke && !selfCig) {
      selfCig = makeCigSmoke({ count: LO ? 3 : 5, seed: 9901, scale: 0.7 });
      root.add(selfCig.group);
    }
    if (selfCig) selfCig.group.visible = selfSmoke;
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

  const now = () => performance.now();

  function tick(dt: number, camera: THREE.Camera) {
    const eco = !!opts.eco?.();
    const cx = camera.position.x, cz = camera.position.z;
    const FAR2 = 20 * 20, MID2 = 12 * 12, FIRE2 = 14 * 14;
    // 省電：只留兩盞對角吊燈、關掉攤位動態燈
    for (let i = 0; i < roofLamps.length; i++) {
      const on = !eco || (i === 0 || i === 3);
      roofLamps[i].visible = on;
      roofLamps[i].intensity = on ? (eco ? roofLampBaseI * 0.85 : roofLampBaseI) : 0;
    }
    for (const L of ambiance.lights) L.visible = !eco;

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
      const mid = eco && dist2 > MID2;
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
        // 用實際位移估速度，擺手／跨步跟本機一樣依速度縮放（勿固定全速 bob）
        const lx = rj._lx as number | undefined, lz = rj._lz as number | undefined;
        const moveSp = (lx == null || lz == null) ? 0 : Math.hypot(r.x - lx, r.z - lz) / Math.max(dt, 1e-3);
        rj._lx = r.x; rj._lz = r.z;
        const walkAmp = Math.min(1, moveSp / 1.2);
        const wantWalk = !r.seated && jumpElapsed < 0 && (r.moving || walkAmp > 0.12) && !mid;
        if (!r.seated && jumpElapsed >= 0) {
          posePlazaJump(r.rig, jumpElapsed);
          if (r.throwT <= 0) { hangArms(r, false); hideHold(r); }
        } else if (wantWalk) {
          r.bob += Math.min(moveSp, 3) * dt * 5;
          const swing = posePlazaWalkCycle(r.rig, r.bob, Math.max(0.2, walkAmp));
          // 走動一律輕微ㄑ字彎肘擺臂（勿切回直臂下垂）
          if (r.throwT <= 0) { swingArms(r, swing); hideHold(r); }
        } else if (!r.seated) {
          r.rig.legL.rotation.x *= 0.8; r.rig.legR.rotation.x *= 0.8;
          r.rig.shinL.rotation.x *= 0.8; r.rig.shinR.rotation.x *= 0.8;
          r.rig.root.position.y *= 0.8;
          r.rig.torso.rotation.y *= 0.8; r.rig.torso.rotation.z *= 0.8; r.rig.torso.rotation.x *= 0.8;
          if (r.throwT <= 0) { hangArms(r, false); hideHold(r); }
        }
        if (r.throwT > 0) {
          r.throwT -= dt;
          poseThrow(r);
          if (r.throwT <= 0) { r.throwT = 0; applyActionPose(r); }
        }
        applyHeadLook(r);
      } else if (r.throwT > 0) {
        r.throwT = Math.max(0, r.throwT - dt);
      }
      // 坐下略往前（負＝朝蚵堆），避免後背穿出椅背
      const back = r.seated ? -0.08 : 0;
      const ox = r.x + Math.sin(r.yaw) * back;
      const oz = r.z + Math.cos(r.yaw) * back;
      const jy = jumpElapsed >= 0 ? plazaJumpHeight(jumpElapsed) : 0;
      r.rig.outer.position.set(ox, jy, oz);
      r.rig.outer.rotation.order = 'YXZ';
      r.rig.outer.rotation.y = r.yaw;
      r.rig.outer.rotation.x = 0;
      if (!far) {
        { const ph = r.seated ? '' : (r.phase || ''); const want = ph === 'crouch' || ph === 'lie' ? 1 : 0; if (want) rj.pz = ph; rj.pk = (rj.pk ?? 0) + (want - (rj.pk ?? 0)) * 0.18; if (rj.pk > 0.001 && rj.pz && !r.moving) { r.rig.legL.rotation.x = r.rig.legR.rotation.x = 0; r.rig.shinL.rotation.x = r.rig.shinR.rotation.x = 0; } if (rj.pk > 0.001 && rj.pz) applyPlazaBodyPose(r.rig, rj.pz, rj.pk); }
      }
      { const now = performance.now(); const mu = rj.mt ? (now - rj.mt) / 1800 : -1; const inMoon = (r.phase || '') === 'moon'; r.rig.outer.rotation.z = 0;
        if (mu >= 0 && mu < 1) { r.rig.outer.position.x += Math.sin(rj.mz) * 22 * mu; r.rig.outer.position.z += Math.cos(rj.mz) * 22 * mu; r.rig.outer.position.y += 22 * mu; r.rig.outer.rotation.x = mu * 14; r.rig.outer.rotation.z = mu * 9; r.rig.outer.visible = true; rj.mh = true; }
        else if (inMoon && !(mu < 0 && rj.mt && now < rj.mt)) { r.rig.outer.visible = false; rj.mh = true; }
        else if (rj.mh && !inMoon) { r.rig.outer.visible = true; rj.mh = false; rj.mt = 0; }
        else if (mu >= 1 && !inMoon) { rj.mt = 0; rj.mh = false; r.rig.outer.visible = true; } }
      // 省電遠距：隱藏模型（碰撞仍用 x/z）
      if (far && !rj.mh && (r.phase || '') !== 'moon') r.rig.outer.visible = false;
      else if (!far && !rj.mh && (r.phase || '') !== 'moon' && !r.awaitingPose) r.rig.outer.visible = true;
      if (!far) r.rig.outer.updateMatrixWorld(true);
      const show = r.rig.outer.visible && !r.awaitingPose && !rj.mh;
      r.tag.sprite.visible = show;
      if (show) placeAboveHead(r.tag.sprite, r.rig.head, 0.22);
      if (r.bubUntil > t && show) {
        placeAboveHead(r.bubble.sprite, r.rig.head, 0.42);
        r.bubble.sprite.visible = true;
      } else if (r.bubble.sprite.visible) r.bubble.sprite.visible = false;
    }
    if (selfBubUntil > t) {
      const headY = selfSeated ? CHAIR_SEAT_Y + SIT_HIP_LIFT + 0.95 : 1.72;
      const back = selfSeated ? -0.08 : 0;
      const ox = selfX + Math.sin(selfYaw) * back;
      const oz = selfZ + Math.cos(selfYaw) * back;
      selfBubble.sprite.position.set(ox, headY + 0.12, oz);
      selfBubble.sprite.visible = true;
    } else if (selfBubble.sprite.visible) selfBubble.sprite.visible = false;
    grill.tick(t);
    const tSec = t * 0.001;
    // 省電：炭火約 15Hz，且只動鏡頭附近
    fireThrottle += dt;
    const runFire = !eco || fireThrottle >= 1 / 15;
    if (runFire) {
      const fdt = eco ? fireThrottle : dt;
      fireThrottle = 0;
      for (const f of fireFx) {
        f.group.getWorldPosition(_firePos);
        const fd2 = (_firePos.x - cx) * (_firePos.x - cx) + (_firePos.z - cz) * (_firePos.z - cz);
        if (eco && fd2 > FIRE2) continue;
        f.tick(tSec, fdt);
      }
      ambiance.tick(tSec, fdt);
      smokeArea.tick(tSec, fdt);
    } else {
      // 吸菸薄煙仍低頻更新
      smokeArea.tick(tSec, dt);
    }
    // 遠端抽烟煙：掛在頭側
    for (const r of remotes.values()) {
      const want = r.seated && (isSmokePile(r.pileId) || (r.phase || '') === 'smoke');
      if (want && !r.cigSmoke) {
        r.cigSmoke = makeCigSmoke({ count: LO ? 3 : 5, seed: 4400 + (r.pileId * 17 + r.slot), scale: 0.65 });
        root.add(r.cigSmoke.group);
      }
      if (r.cigSmoke) {
        r.cigSmoke.group.visible = want;
        if (want) {
          r.rig.head.getWorldPosition(_firePos);
          r.cigSmoke.group.position.set(_firePos.x + 0.08, _firePos.y + 0.02, _firePos.z - 0.06);
          r.cigSmoke.tick(tSec, dt);
        }
      }
    }
    if (selfCig) {
      selfCig.group.visible = selfSmoke;
      if (selfSmoke) {
        const headY = selfSeated ? CHAIR_SEAT_Y + SIT_HIP_LIFT + 0.95 : 1.72;
        selfCig.group.position.set(
          selfX - Math.sin(selfYaw) * 0.12 + Math.cos(selfYaw) * 0.08,
          headY,
          selfZ - Math.cos(selfYaw) * 0.12 - Math.sin(selfYaw) * 0.08,
        );
        selfCig.tick(tSec, dt);
      }
    }
    bigShed.tick(dt);
    for (const k of stallKeepers) {
      if (eco) {
        const dx = k.rig.outer.position.x - cx, dz = k.rig.outer.position.z - cz;
        if (dx * dx + dz * dz > FAR2) { k.rig.outer.visible = false; continue; }
        k.rig.outer.visible = true;
      }
      k.rig.torso.rotation.y = Math.sin(tSec * 0.5 + k.ph) * 0.15;
      if (!eco) posePlazaStallKeeper(k.rig, tSec, k.ph);
      tickKeeperBubble(k, tSec);
    }
  }

  /** 站立／蹲／躺／跳躍的遠端：擋路（不推擠）；坐下、尚未現身：不擋；躺＝isLie */
  function walkBodies(): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    for (const r of remotes.values()) {
      if (r.seated || r.awaitingPose || !r.rig.outer.visible) continue;
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
    for (const r of [...remotes.values()]) destroyRemote(r);
    remotes.clear();
    grill.dispose();
    for (const f of fireFx) f.dispose();
    fireFx.length = 0;
    smokeArea.ambientSmoke.dispose();
    if (selfCig) { root.remove(selfCig.group); selfCig.dispose(); selfCig = null; }
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

  return { root, pileGroups, syncRoster, upsert, remove, pruneSelf, applyPose, setPhase, highlight, highlightNear, hitPile, grill, aimTargets, walkBodies, moonLaunch, showChat, setSelfPose, playThrowFx, tick, dispose };
}

export function tickPlazaTags(view: PlazaWorldView | null, camera: THREE.Camera, dt = 0.016) {
  if (!view) return;
  view.tick(dt, camera);
}
