import * as THREE from 'three';
import { PlazaClient } from './hubClient';
import {
  PILE_COUNT, SLOTS_PER_PILE, PLAZA_CAPACITY, WALK_BOUND, SIT_DIST, plazaWalkBounds, plazaClampWalk, plazaCafeObstacles,
  seatPose, seatKey, nearestFreeSeat, nearestFreePlaceSeat, pileObstacles, pileCenter, randomWalkSpawn, resolveWalkSpawn,
  isSmokePile, isLeisurePile, isRestPile, isMgPile, plazaSmokeObstacles, isPlazaAber, SMOKE_PILE_ID, SMOKE_ABER_SLOT,
  MG_PILE_ID, MG_SIT_PRICE, MG_SIT_AMMO, MG_SIT_MS,
  type PlazaSeatRef, type PlazaSpawnMemory,
  SHED_DOORS, shedDoorAt, plazaShedObstacles,
} from './layout';
import { plazaShedPosts } from './props';
import { shedName } from './shedRow';
import { plazaStallObstacles } from './ambiance';
import { buildPlazaMapMarkers, drawPlazaMap } from './map';
import { createPlazaWorldView, tickPlazaTags, type PlazaWorldView } from './worldView';
import type { PlazaAimTarget, PlazaChat, PlazaPlayer, PlazaShellEvent, PlazaShellHitEvent, PlazaSnapshot, PlazaStealEvent, PlazaGrillOyster, PlazaGrillTakenEvent, PlazaSeatWish, PlazaSeatWishEnd } from './types';
import { plazaDisplayName, normSeatWishEnd } from './types';
import { postDiscordPlazaChat, postDiscordPlazaPresence } from '../core/discord';
import { plazaSoftCapClient } from '../core/economy';
import { myTag } from '../meta/social';
import { achCheck, achS } from '../meta/achievements';
import { parseCosmetics } from './cosmetics';
import { clipFlagText, flagErrText, flagPlantPos, flagSlowText, type PlazaFlagState } from './flags';
import { pileDiffOf, pileDiffName, parsePileDiffs, weightsFor, PILE_DIFF_MIXED } from './pileDiff';

export type PlazaDeps = {
  id: string;
  nick: () => string;
  toast: (t: string, c?: string) => void;
  audio: () => void;
  scene: THREE.Scene;
  camera: () => THREE.Camera;
  /** 遠端進場預編譯著色器用 */
  renderer?: THREE.WebGLRenderer;
  /** 預熱遠端角色／臉盆進 GPU（visible=false 也要先暖，否則準心第一次掃到才卡） */
  warmGpu?: (root: THREE.Object3D) => void;
  bubbles: HTMLElement;
  /** 與工寮同款蚵殼幾何／材質 */
  shellGeo: THREE.BufferGeometry;
  shellMat: THREE.Material;
  /** 連上後進廣場自由走動 */
  enterWalk: () => void;
  /** 第一次坐下：開始無 NPC 剝蚵工班 */
  beginShift: (pileId: number, slot: number) => void;
  /** 已在工班中再坐下（換位） */
  resumeSit: (pileId: number, slot: number) => void;
  /** 重連後搶回原位：盆子換成這桌難度並補滿（手上那顆照舊） */
  refillBasin?: () => void;
  /** 吸菸區坐下：不開剝蚵工班 */
  enterSmokeSit: (slot: number) => void;
  /** 樸子腳門口等純坐座位：不抽菸、不開工班 */
  enterRestSit: (slot: number) => void;
  /** 蚵仔機關槍座：上機；fromMeat＝用碗內蚵肉當子彈（發射才扣碗） */
  enterMgSit: (slot: number, expireAt: number, ammo: number, fromMeat?: boolean) => void;
  /** 讀取／扣除金錢（機關槍付費） */
  getMoney: () => number;
  spendMoney: (n: number, reason: string) => boolean;
  /** 扣除／退回碗內庫存當子彈（不重算本趟入碗結算數；負數＝退庫存） */
  spendBowlMeat: (n: number, reason: string) => boolean;
  /** 站起恢復走動（不結束工班） */
  goWalk: () => void;
  applySeatPose: (pos: THREE.Vector3, yaw: number) => void;
  getPhase: () => string;
  /** 同步用相位（可含 throwAim 等表現態；預設同 getPhase） */
  getSyncPhase?: () => string;
  /** 本趟入碗結算數（換座位不重算） */
  getCount: () => number;
  /** 碗內尚可動用（機關槍子彈／同步給別人偷） */
  getBowlStock: () => number;
  getWalkXZ: () => { x: number; z: number };
  getYaw: () => number;
  getMoving: () => boolean;
  /** 是否正撐傘（同步給其他人） */
  getUmb: () => boolean;
  /** 坐下時左右轉頭（相對座位）；第一人稱走動也可送，第三人稱走動為 0 */
  getLookYaw?: () => number;
  /** 機關槍槍管用：含環視 flYaw，需與鏡頭一致 */
  getAimYaw?: () => number;
  /** 視角俯仰；第三人稱走動鎖 0，其餘照本機 */
  getPitch?: () => number;
  /** 是否第三人稱（走動時用來決定要不要鎖頭／俯仰同步） */
  getTpv?: () => boolean;
  /** 目前五件裝備 id（進場／換裝同步） */
  getOutfit?: () => { head: string; hand: string; body: string; legs: string; feet: string };
  /** 目前廣場外觀旗標（進場／開關後同步） */
  getCosmetics?: () => string;
  /** 本機是否已買廣場旗幟 */
  ownsFlag?: () => boolean;
  /** 機關槍：遠端開火／自己被打／廣場提示 */
  onMgFire?: (e: import('./hubClient').PlazaMgFireEvent) => void;
  onMgHit?: (e: import('./hubClient').PlazaMgHitEvent) => void;
  onPlazaAlert?: (e: { kind?: string; text: string; nick?: string; connId?: string; expireAt?: number; ammo?: number }) => void;
  /** 機關槍時間到被伺服器踢下 */
  onMgExpired?: () => void;
  /** 別人丟殼飛過（含打向自己，先播飛行動畫） */
  onShellThrow?: (e: PlazaShellEvent) => void;
  /** 殼飛到自己：結算擋／中 */
  onShellInbound?: (e: PlazaShellEvent) => void;
  /** 自己丟的殼被對方完美反彈打回來 */
  onShellReflectHit?: (e: PlazaShellEvent) => void;
  /** 自己丟的殼被對方雨傘擋住（非完美反彈） */
  onShellBlocked?: (e: PlazaShellEvent) => void;
  /** 有人被殼砸中：全場噴血 */
  onShellHit?: (e: PlazaShellHitEvent) => void;
  onNpcMoon?: (e: any) => void;
  /** 偷肉結果（含自己被偷） */
  onStealResult?: (e: PlazaStealEvent) => void;
  /** 共烤蚵同步 */
  onGrillUpsert?: (o: PlazaGrillOyster) => void;
  onGrillRemove?: (id: string, byConnId: string, byNick: string) => void;
  onGrillTaken?: (e: PlazaGrillTakenEvent) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  onPayout: (clamped: number, meta: { oysters: number; dur: number; raw: number }) => void;
  /** 廣場任務獎金（送座位等），走跟死鬥一樣的入帳路徑 */
  grantMoney?: (amount: number, via: string) => void;
  persist?: () => void;
  onExit: () => void;
  /** 入場時連不上後端：不要進廣場，回主選單 */
  onEnterFail?: (err?: string) => void;
  /** 讀取上次離開廣場的站位 */
  getPlazaSpawn?: () => PlazaSpawnMemory | null | undefined;
  /** 離開時寫入站位（坐著離開會帶 pileId/slot） */
  persistPlazaSpawn?: (spawn: PlazaSpawnMemory) => void;
  /** 省電模式（廣場簡化／降負載） */
  getEco?: () => boolean;
  /** 北碼頭工寮：是否已解鎖、提示文字、站在圈內按「進入」 */
  shedUnlocked?: (loc: string) => boolean;
  shedPromptInfo?: (loc: string) => string;
  openShedDoor?: (loc: string) => void;
  /** 自己裝備了寵物（坐姿時寵物在頭頂、聊天泡泡要讓位） */
  hasOwnPet?: () => boolean;
  /** 自己頭上帽子高出髮蓋頂的量（公尺）；有寵物+坐姿時聊天泡泡要再多抬這麼多 */
  selfHatLift?: () => number;
};

let active = false;
/** 已成功進場並公告過（離場才再公告；重連／連線失敗不重複） */
let plazaIoAnnounced = false;
let client: PlazaClient | null = null;
let view: PlazaWorldView | null = null;
let ui: HTMLElement | null = null;
let myPile: number | null = null;
let mySlot: number | null = null;
let snap: PlazaSnapshot | null = null;
let seatWishes: PlazaSeatWish[] = [];
const paidWishIds = new Set<string>();
let phaseTimer = 0;
let deps: PlazaDeps | null = null;
let seated = false;
let shiftStarted = false;
let near: PlazaSeatRef | null = null;
let nearCarry: { connId: string; nick: string } | null = null;
let nearPlace: PlazaSeatRef | null = null;
/** 站在哪間工寮的門口圓圈內 */
let nearShed: string | null = null;
/** 新伺服器 Join 會帶 carryNpc；舊服沒有則不顯示抱起／放下 */
let carryNpcOk = false;
/** 新伺服器 Join 會帶 flags 陣列；舊服沒有則不顯示插旗 */
let flagOk = false;
let flagList: PlazaFlagState[] = [];
let myFlagText: string | null = null;
let plantBusy = false;
let sittingBusy = false;
/** 本機機關槍是否用碗內蚵肉當子彈（重連還原用；買彈夾後清掉） */
let mgFromMeat = false;
/** 斷線後手動重連 timer */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let netDown = false;
/** 聊天縮小時未讀數；打開後清零 */
let chatUnread = 0;
let chatPeekTimer: ReturnType<typeof setTimeout> | null = null;

export const isPlazaActive = () => active;
export const plazaSeated = () => seated;
export const plazaSittingBusy = () => sittingBusy;
export const plazaShiftStarted = () => shiftStarted;
export function plazaMySeat() { return myPile != null && mySlot != null ? { pileId: myPile, slot: mySlot } : null; }
/** 坐下撈一把時用的桌種權重；無座或非剝蚵堆當綜合 */
export function plazaScoopWeights(): number[] {
  const seat = plazaMySeat();
  const kind = pileDiffOf(seat ? seat.pileId : -1, snap?.pileDiffs);
  return weightsFor(kind < 0 ? PILE_DIFF_MIXED : kind);
}

/** @deprecated 對稱邊界；走動請用 plazaWalkRect */
export function plazaWalkBound() { return WALK_BOUND; }
export function plazaWalkRect() { return plazaWalkBounds(); }
/** 東延咖啡前庭夾限（在矩形夾限之後呼叫） */
export function plazaWalkClamp(p: { x: number; z: number }) { plazaClampWalk(p); }
export function plazaPileObs(): [number, number, number][] {
  const out = pileObstacles();
  for (const p of plazaShedPosts()) out.push([p.x, p.z, 0.22]);
  for (const o of plazaStallObstacles()) out.push(o);
  for (const o of plazaShedObstacles()) out.push(o);
  for (const o of plazaSmokeObstacles()) out.push(o);
  for (const o of plazaCafeObstacles()) out.push(o);
  return out;
}
/** 走動時遠端玩家碰撞圓 `[x,z,r,isLie]`（擋路不推擠；坐下略過） */
export function plazaWalkBodies(): [number, number, number, number][] {
  return view?.walkBodies() ?? [];
}
/** 入場障礙：棚柱＋攤位 */
function plazaSpawnExtraObs(): [number, number, number][] {
  const posts: [number, number, number][] = plazaShedPosts().map(p => [p.x, p.z, 0.22]);
  return [...posts, ...plazaStallObstacles(), ...plazaSmokeObstacles(), ...plazaCafeObstacles()];
}

/** 入場隨機站位（避開蚵堆／棚柱／攤位，面向中心） */
export function plazaRandomSpawn() {
  return randomWalkSpawn(plazaSpawnExtraObs());
}

/** 目前有人坐的座位（入場用；不含自己，因尚未坐下） */
function occupiedSeatKeys(): Set<string> {
  const t = new Set<string>();
  for (const p of snap?.players ?? []) {
    if (p.carriedBy || (p.isNpc && (p.phase || '') === 'moon')) continue; // 被抱走／飛彈飛走的阿婆讓出座位
    if (!p.seated || p.pileId < 0 || p.slot < 0) continue;
    t.add(seatKey(p.pileId, p.slot));
  }
  return t;
}

/** 入場站位：優先上次離開位置；坐著離開且椅被佔則站旁邊避開 */
export function plazaResolveEnterSpawn() {
  return resolveWalkSpawn(deps?.getPlazaSpawn?.() ?? null, {
    extraObs: plazaSpawnExtraObs(),
    takenSeats: occupiedSeatKeys(),
  });
}
const CARRY_DIST = 0.95;

function myCarriedNpc(): PlazaPlayer | null {
  const cid = client?.connectionId ?? '';
  if (!cid) return null;
  return snap?.players.find((p) => p.isNpc && p.carriedBy === cid) ?? null;
}

export function plazaCarrying() { return !!myCarriedNpc(); }

/** 抱著的阿婆不是自己放下就不見了：抱太久被放在原地，提示一下 */
let carryWatchId = '';
let carryPlacing = false;
function checkCarryLost() {
  const n = myCarriedNpc();
  if (n) { carryWatchId = n.connId; return; }
  if (!carryWatchId) return;
  const id = carryWatchId;
  carryWatchId = '';
  if (carryPlacing) return;
  const p = snap?.players.find((x) => x.connId === id);
  if (p && (p.phase || '') === 'stand') deps?.toast(`抱太久手痠了，${npcWho(p)}先放在原地站著`, '#ffb08a');
}

function npcWho(p?: { pid?: string; nick?: string } | null) {
  return p && isPlazaAber(p) ? '阿伯' : '阿婆';
}

function seatLabel(pileId: number, slot: number) {
  if (pileId === SMOKE_PILE_ID && slot === SMOKE_ABER_SLOT) return '吸菸區・阿伯的位子';
  if (pileId === 100) return `吸菸區・座 ${slot + 1}`;
  if (pileId === 101) return `多那芝吸菸區・座 ${slot + 1}`;
  if (pileId === 102) return `樸子腳・座 ${slot + 1}`;
  if (isMgPile(pileId)) {
    const meats = deps?.getBowlStock() ?? 0;
    return meats > 0
      ? `蚵仔機關槍・座 ${slot + 1}　碗內 ${meats} 顆可當子彈`
      : `蚵仔機關槍・座 ${slot + 1}　花 $${MG_SIT_PRICE}／${MG_SIT_AMMO} 發`;
  }
  if (slot >= SLOTS_PER_PILE) return `第 ${pileId + 1} 堆・阿婆座 ${slot - SLOTS_PER_PILE + 1}${pileDiffSeatSuffix(pileId)}`;
  return `第 ${pileId + 1} 堆・座 ${slot + 1}${pileDiffSeatSuffix(pileId)}`;
}

function pileDiffSeatSuffix(pileId: number): string {
  const name = pileDiffName(pileDiffOf(pileId, snap?.pileDiffs));
  return name ? `（${name}）` : '';
}

export type PlazaNearPrompt = {
  kind: 'sit' | 'carry' | 'place' | 'shed';
  info: string;
  btn: string;
  /** 按鈕線條圖示 class（預設椅子） */
  icon?: string;
  /** 第二顆按鈕（機關槍：碗內蚵肉當子彈） */
  altBtn?: string;
  altIcon?: string;
  shedLoc?: string;
  pileId?: number;
  slot?: number;
};

/** 機關槍上機：money＝付錢滿彈；meat＝碗內蚵肉當子彈；auto＝有肉優先用肉 */
export type PlazaMgPay = 'money' | 'meat' | 'auto';

export function plazaNearPrompt(): PlazaNearPrompt | null {
  if (!active || seated) return null;
  if (nearShed) {
    const name = shedName(nearShed);
    if (carryNpcOk && myCarriedNpc()) return { kind: 'shed', info: `${name}　抱著人不能進去`, btn: '先放下再進去', icon: 'ic-lock', shedLoc: nearShed };
    const open = deps?.shedUnlocked?.(nearShed) ?? true;
    return {
      kind: 'shed',
      info: deps?.shedPromptInfo?.(nearShed) ?? name,
      btn: open ? `進入 ${name}` : `解鎖 ${name}`,
      icon: open ? 'ic-pin' : 'ic-lock',
      shedLoc: nearShed,
    };
  }
  if (carryNpcOk && myCarriedNpc()) {
    if (!nearPlace) return null;
    const w = seatWishes.find(x => x.npcConnId === myCarriedNpc()!.connId);
    const atTarget = !!(w && w.pileId === nearPlace.pileId && w.slot === nearPlace.slot);
    return { kind: 'place', info: atTarget ? `送到這裡：${seatLabel(nearPlace.pileId, nearPlace.slot)}` : seatLabel(nearPlace.pileId, nearPlace.slot), btn: atTarget ? '送到這裡' : '放這裡', pileId: nearPlace.pileId, slot: nearPlace.slot };
  }
  if (carryNpcOk && nearCarry) {
    const carry = nearCarry;
    const w = seatWishes.find(x => x.npcConnId === carry.connId);
    const info = w ? (w.carrierConnId && w.carrierConnId !== plazaConnId() ? '已有人在送' : (w.line || `${carry.nick}　站旁邊就能抱起來`)) : `${carry.nick}　站旁邊就能抱起來`;
    return { kind: 'carry', info, btn: carry.nick === '阿伯' ? '抱起阿伯' : '抱起阿婆' };
  }
  if (near) {
    const mg = isMgPile(near.pileId);
    return {
      kind: 'sit',
      info: seatLabel(near.pileId, near.slot),
      btn: mg ? `花錢 $${MG_SIT_PRICE}` : '坐這裡',
      icon: mg ? 'ic-coin' : undefined,
      altBtn: mg ? '用我的蚵仔肉' : undefined,
      altIcon: mg ? 'ic-oyster' : undefined,
      pileId: near.pileId,
      slot: near.slot,
    };
  }
  return null;
}

export function plazaNearSeat() { return nearPlace ?? near; }
/** 目前站在哪間工寮門口（沒有則 null） */
export function plazaNearShed() { return active && !seated ? nearShed : null; }
/** 點擊射線打到哪一堆（給補蚵用） */
export function plazaHitPile(raycaster: THREE.Raycaster): number | null {
  return view?.hitPile(raycaster) ?? null;
}
/** 自己坐下的那堆中心（補蚵飛出起點） */
export function plazaMyPileOrigin(out = new THREE.Vector3()) {
  if (myPile == null || isLeisurePile(myPile)) return null;
  return pileCenter(myPile, out);
}

export function plazaConnId() { return client?.connectionId ?? ''; }

/** 坐下遠端玩家瞄準點 */
export function plazaAimTargets(leisureNpc = false): PlazaAimTarget[] {
  return view?.aimTargets(leisureNpc) ?? [];
}

export async function plazaThrowAt(
  targetConnId: string,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.throwAt(targetConnId, from.x, from.y, from.z, to.x, to.y, to.z);
}

/** 飛殼純視覺（丟空／丟地上），其他人看得到 */
export async function plazaShellFx(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.shellFx(from.x, from.y, from.z, to.x, to.y, to.z);
}

/** 完美反彈：殼飛回原丟殼者並造成傷害 */
export async function plazaShellReflect(
  originalThrowerConnId: string,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.shellReflect(originalThrowerConnId, from.x, from.y, from.z, to.x, to.y, to.z);
}

/** 一般擋下：通知原丟殼者 */
export async function plazaShellBlocked(originalThrowerConnId: string) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.shellBlocked(originalThrowerConnId);
}

/** 飛彈鐵拳炸阿婆（伺服器先到先算） */
/** 離線測試用本機阿婆（只在連不到伺服器時出現，其他人看不到） */
const LOCAL_AMA = 'local-ama';
let localAmaOn = false, localAmaMoonUntil = 0;
function localAmaPlayer(phase: string) {
  return normPlayer({ connId: LOCAL_AMA, pid: 'npc-local', isNpc: true, nick: '阿婆', pileId: 1, slot: SLOTS_PER_PILE, seated: true, phase });
}
setInterval(() => {
  const want = !!(active && netDown && view);
  if (want && !localAmaOn) { localAmaOn = true; localAmaMoonUntil = 0; view!.upsert(localAmaPlayer('pick'), '\0'); }
  else if (!want && localAmaOn) { localAmaOn = false; try { view?.remove(localAmaPlayer('pick')); } catch { /* ignore */ } }
  else if (localAmaOn && localAmaMoonUntil && Date.now() > localAmaMoonUntil) { localAmaMoonUntil = 0; view!.setPhase(localAmaPlayer('pick')); }
}, 500);
export async function plazaMoonNpc(connId: string, from: { x: number; y: number; z: number }) {
  if (connId === LOCAL_AMA) {
    if (!localAmaOn || localAmaMoonUntil) return { ok: false as const, err: 'gone' };
    localAmaMoonUntil = Date.now() + 30_000; view?.setPhase(localAmaPlayer('moon')); view?.moonLaunch(connId, 700, from.x, from.z);
    void from; return { ok: true as const };
  }
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  const r = await client.moonNpc(connId, from.x, from.y, from.z);
  if (r.ok) view?.moonLaunch(connId, 700, from.x, from.z);
  return r;
}

/** 被殼砸中：廣播噴血點給廣場所有人 */
export async function plazaShellHit(at: { x: number; y: number; z: number }) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.shellHit(at.x, at.y, at.z);
}

/** 機關槍開火（伺服器扣彈並廣播彈道） */
export async function plazaMgFire(
  from: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.mgFire(from.x, from.y, from.z, dir.x, dir.y, dir.z);
}

/** 機關槍命中走動玩家 */
export async function plazaMgHit(targetConnId: string, at: { x: number; y: number; z: number }) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.mgHit(targetConnId, at.x, at.y, at.z);
}

/** 機關槍買彈夾（客戶端先扣款再呼叫） */
export async function plazaMgReload() {
  if (!client?.connected) return { ok: false as const, err: 'no_conn', ammo: 0 };
  const r = await client.mgReload();
  if (r.ok) mgFromMeat = false; // 之後改付費彈，不扣碗
  return r;
}

/** 本機瞄準機關槍管 */
export function plazaAimMg(slot: number, lookYaw: number, pitch: number) {
  view?.aimMg(slot, lookYaw, pitch);
}

/** 機關槍特效系統（子彈／火花／彈殼） */
export function plazaMgFx() {
  return view?.mgFx ?? null;
}

export function plazaMgMount(slot: number) {
  return view?.mgMounts[slot] ?? null;
}

export function plazaMgHitTargets() {
  return view?.mgHitTargets() ?? [];
}

/** 是否正坐在機關槍座 */
export function plazaOnMg() {
  return !!(seated && myPile != null && isMgPile(myPile));
}

/** 遠端丟殼甩臂 */
export function plazaPlayThrowFx(connId: string) {
  view?.playThrowFx(connId);
}

/** 吸菸區抽一口同步；離線／未連線不送；舊伺服器無方法時 invoke catch 略過 */
export async function plazaSendPuff(start: boolean, holdMs = 0) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn' };
  return client.plazaPuff(start, holdMs);
}

export async function plazaStealFrom(targetConnId: string, caught = false) {
  if (!client?.connected) return { ok: false as const, err: 'no_conn', steal: undefined };
  return client.stealFrom(targetConnId, caught);
}

/** 共烤：放生蚵上烤網（lx/lz 相對堆心） */
export async function plazaGrillPlace(lx: number, lz: number, diff: number) {
  if (myPile != null && view?.grill.tooClose(myPile, lx, lz)) return { ok: false as const, err: 'grill_overlap', oyster: undefined };
  if (!client?.connected) {
    // 離線單機烤：本機建一顆，烤熟／掀殼由烤網畫面自己推進
    if (myPile == null) return { ok: false as const, err: 'no_seat', oyster: undefined };
    const now = Date.now(), d = Math.max(0, Math.min(3, diff | 0));
    const oyster: PlazaGrillOyster = { id: 'off' + Math.random().toString(36).slice(2, 10), pileId: myPile, lx, lz, state: 'cooking', placedAt: now, openAt: now + 20000 + d * 800, ownerConnId: '', ownerNick: deps?.nick() ?? '', diff: d };
    return { ok: true as const, err: undefined, oyster };
  }
  return client.grillPlace(lx, lz, diff);
}
export async function plazaGrillFlip(oysterId: string) {
  if (!client?.connected) return { ok: true as const, err: undefined, oyster: undefined }; // 離線：本機已樂觀翻面
  return client.grillFlip(oysterId);
}
export async function plazaGrillTake(oysterId: string) {
  if (!client?.connected) return { ok: true as const, err: undefined, oyster: undefined, count: (deps?.getBowlStock() ?? 0) + 1 }; // 離線單機烤
  return client.grillTake(oysterId);
}
/** 點擊／最近可搶的共烤蚵（同堆 open／flipped） */
export function plazaGrillNearest(cx: number, cy: number, cam: THREE.Camera) {
  if (myPile == null || !view) return null;
  return view.grill.nearestAtPile(myPile, cam, cx, cy);
}
export function plazaGrillHit(raycaster: THREE.Raycaster) {
  return view?.grill.hit(raycaster) ?? null;
}
/** 本機樂觀更新（防連掀／連拿搶點） */
export function plazaGrillUpsertLocal(o: PlazaGrillOyster) {
  view?.grill.upsert(o);
}
export function plazaGrillRemoveLocal(id: string) {
  view?.grill.remove(id);
}

const ERR_ZH: Record<string, string> = {
  taken: '這個位子有人了',
  full: '廣場滿了，等有人離開再來',
  bad_seat: '位子不對',
  not_joined: '還沒連上廣場',
  no_seat: '請先選位子',
  slow: '太快了，稍等一下',
  connect_fail: '連不上廣場伺服器',
  join_fail: '進廣場失敗',
  already_paid: '這一工已經結過算了',
  bad_token: '場次失效，請重新進廣場',
  no_target: '對方不在了',
  target_walk: '對方站起來了',
  bad_target: '不能對自己',
  empty: '碗裡沒肉了',
  throw_fail: '丟殼失敗',
  steal_fail: '偷失敗',
  other_pile: '只能偷同一堆的人',
  newcomer: '剛坐下要先剝一會才能偷',
  protected: '對方碗裡太少，先別偷',
  umb: '對方撐著傘，偷不到',
  busy: '對方正在撬殼，下手不了',
  immune: '對方剛被偷過，先等等',
  pair_cd: '同一個目標要隔一下再偷',
  victim_cap: '對方這分鐘被偷太多次了',
  steal_ban: '偷被抓太多次，先冷靜一下',
  watching: '阿婆正看著你，偷不到',
  grill_full: '烤網滿了，先等別人拿走',
  off_grill: '要點在烤網上',
  not_grill: '這裡不是烤蚵位',
  not_ready: '還沒烤開',
  no_mg: '不在機關槍座位上',
  no_ammo: '子彈打光了，先買彈夾',
  mg_time: '機關槍時間到了',
  target_seated: '對方坐著打不到',
  bad_dir: '瞄準方向不對',
  money: '錢不夠',
  already_flipped: '上殼掀掉了',
  need_flip: '先掀上殼再拿',
  gone: '被別人搶走了',
  carrying: '抱著阿婆時不能這樣',
  already_carry: '已經抱著一位阿婆了',
  seated: '請先站起來再抱阿婆',
  notcarrier: '不是你抱著的',
  carried: '阿婆正被抱著',
  notnpc: '這不是阿婆',
  far: '再靠近一點才能抱起阿婆',
  carry_fail: '抱不起來',
  place_fail: '放不下',
  wrong_pile: '只能動自己這堆烤網上的',
};

export function plazaZhErr(e?: string) { return (e && ERR_ZH[e]) || e || '失敗了'; }
function zhNpcErr(e: string | undefined, who: string) {
  const table: Record<string, string> = {
    carrying: `抱著${who}時不能這樣`,
    already_carry: '已經抱著一位了',
    seated: `請先站起來再抱${who}`,
    notcarrier: '不是你抱著的',
    carried: `${who}正被抱著`,
    notnpc: `這不是${who}`,
    far: `再靠近一點才能抱起${who}`,
    carry_fail: '抱不起來',
    place_fail: '放不下',
  };
  return (e && table[e]) || plazaZhErr(e);
}
function zhErr(e?: string) { return plazaZhErr(e); }

function forceResetPlazaLocal() {
  active = false; seated = false; shiftStarted = false; netDown = false; plazaIoAnnounced = false;
  chatUnread = 0; hideChatPeek();
  clearReconnectTimer();
  const old = client; client = null;
  if (old) void old.disconnect({ depart: false });
  try { view?.dispose(); } catch { /* */ }
  view = null;
  try { ui?.remove(); } catch { /* */ }
  ui = null;
  myPile = null; mySlot = null; snap = null; seatWishes = []; paidWishIds.clear();
  deps = null; near = null; nearShed = null; nearCarry = null; nearPlace = null;
  carryNpcOk = false; flagOk = false; flagList = []; myFlagText = null;
  removeFlagBtn();
  teardownPlayersChrome();
  syncPlazaPeopleHud();
}

export function openPlaza(D: PlazaDeps) {
  // 上次入場半殘（active 卡住）時同步清掉再進，避免按鈕沒反應
  if (active) forceResetPlazaLocal();
  active = true; seated = false; shiftStarted = false; plazaIoAnnounced = false; deps = D;
  myPile = null; mySlot = null; snap = null; seatWishes = []; paidWishIds.clear(); near = null; nearShed = null; nearCarry = null; nearPlace = null; carryNpcOk = false; flagOk = false; flagList = []; myFlagText = null; sittingBusy = false; mgFromMeat = false;
  D.audio();
  try {
    client = new PlazaClient();
    view = createPlazaWorldView(D.scene, D.bubbles, {
      shellGeo: D.shellGeo,
      shellMat: D.shellMat,
      // 手機或省電：少幾何／少燈；執行中仍可依 getEco 再降動態負載
      lowDetail: matchMedia('(pointer: coarse)').matches || !!D.getEco?.(),
      eco: () => !!D.getEco?.(),
      getTpv: () => !!D.getTpv?.(),
      hasOwnPet: () => !!D.hasOwnPet?.(),
      selfHatLift: () => D.selfHatLift?.() ?? 0,
      getRenderer: () => D.renderer,
      warmGpu: root => D.warmGpu?.(root),
    });
    buildUi();
    wireClient(D);
    void boot(D);
  } catch (e) {
    console.error('openPlaza', e);
    active = false;
    client = null;
    try { view?.dispose(); } catch { /* */ }
    view = null;
    try { ui?.remove(); } catch { /* */ }
    ui = null;
    deps = null;
    teardownPlayersChrome();
    D.onEnterFail?.('open_fail');
  }
}

async function abortEnter(D: PlazaDeps, err?: string) {
  active = false; seated = false; shiftStarted = false; netDown = false;
  clearReconnectTimer();
  syncPlazaPeopleHud();
  await client?.disconnect();
  client = null;
  view?.dispose(); view = null;
  ui?.remove(); ui = null;
  myPile = null; mySlot = null; snap = null; seatWishes = []; paidWishIds.clear(); near = null; nearShed = null; nearCarry = null; nearPlace = null; carryNpcOk = false; flagOk = false; flagList = []; deps = null;
  removeFlagBtn();
  D.onEnterFail?.(err);
}


function applySeatWishes(list: PlazaSeatWish[] | undefined | null) {
  seatWishes = Array.isArray(list) ? list.slice() : [];
  view?.setSeatWishes?.(seatWishes, plazaConnId() || '');
}

function upsertSeatWish(w: PlazaSeatWish) {
  const i = seatWishes.findIndex(x => x.wishId === w.wishId || x.npcConnId === w.npcConnId);
  if (i >= 0) seatWishes[i] = w; else seatWishes.push(w);
  view?.setSeatWishes?.(seatWishes, plazaConnId() || '');
}

function applySeatWishEnd(e: PlazaSeatWishEnd) {
  seatWishes = seatWishes.filter(x => x.wishId !== e.wishId && x.npcConnId !== e.npcConnId);
  view?.setSeatWishes?.(seatWishes, plazaConnId() || '');
  const me = plazaConnId();
  if (e.reason === 'done' && e.carrierConnId && me && e.carrierConnId === me && e.wishId && !paidWishIds.has(e.wishId)) {
    paidWishIds.add(e.wishId);
    const pay = Math.max(0, Math.floor(e.pay || 0));
    if (pay > 0) {
      deps?.grantMoney?.(pay, 'seat-wish');
      deps?.toast(`送到了，拿到 $${pay.toLocaleString('zh-TW')}`, '#9be37a');
    } else if (e.capped) {
      deps?.toast('今日獎金已達上限', '#ffd76a');
    } else {
      deps?.toast('送到了', '#9be37a');
    }
    const st = achS().st;
    const tot = Math.max(st.seatdel ?? 0, e.total || 0, (st.seatdel ?? 0) + 1);
    st.seatdel = tot;
    achCheck();
    deps?.persist?.();
    deps?.track?.('seat_wish', { pay, capped: !!e.capped, total: tot, fast: !!e.fast });
  }
}

async function boot(D: PlazaDeps) {
  try {
  setHud('連線中…');
  const r = await client!.connect(D.id, D.nick());
  if (!active || !client) return; // 入場中被取消
  if (!r.ok) {
    // 連不上也照樣進廣場：先離線逛，背景持續重連
    netDown = true;
    const why = (r.err || '').trim();
    // preview／本機常見：CORS（請用 localhost 勿用 127.0.0.1）或正式 hub 被擋
    D.toast(why ? `廣場連不上（${why}），先離線逛` : '廣場暫時連不上，先離線逛，連上會自動同步', '#ffb08a');
    D.enterWalk();
    showRoamUi();
    setHud('離線中　可以先坐下自己剝、自己烤');
    syncPlazaPeopleHud();
    setNetBanner(why ? `連線失敗：${why}` : '連線失敗，正在重連…');
    scheduleManualReconnect(3000);
    return;
  }
  snap = r.snap ?? null;
  carryNpcOk = !!(r as any).carryNpc;
  applyJoinFlags((r as any).flags);
  if (snap) view?.syncRoster(snap, D.id);
  applySeatWishes((r as any).wishes);
  if (r.grills) view?.grill.syncAll(r.grills);
  applyChatHistory(r.chat);
  void plazaPushOutfit();
  // 先 enterWalk（掛 plazaMode／plazaRoam）再 sync，否則玩家鈕不會掛上
  D.enterWalk();
  showRoamUi();
  setHud(`${plazaHudPeople(snap)}　隨便坐、不趕時間`);
  syncPlazaPeopleHud();
  if (!plazaIoAnnounced) {
    plazaIoAnnounced = true;
    const online = snap?.occupied ?? snap?.players?.filter((p) => !p.isNpc).length ?? null;
    void postDiscordPlazaPresence(D.nick(), 'join', { online, tag: myTag() });
  }
  } catch (e) {
    console.error('plaza boot', e);
    if (!active) return;
    // 進場例外：仍放行離線逛，避免卡在「正在入場」
    netDown = true;
    D.toast('廣場入場異常，先離線逛', '#ffb08a');
    try { setHud('離線中　可以先坐下自己剝、自己烤'); } catch { /* */ }
    try { D.enterWalk(); showRoamUi(); syncPlazaPeopleHud(); setNetBanner('連線異常，正在重連…'); } catch { void abortEnter(D, 'boot_fail'); return; }
    scheduleManualReconnect(3000);
  }
}

/** 把本機目前裝備推到廣場（進場／換裝／重連後） */
export async function plazaPushOutfit() {
  if (!client?.connected || !deps?.getOutfit) return;
  const o = deps.getOutfit();
  await client.setOutfit(o.head, o.hand, o.body, o.legs, o.feet);
  await plazaPushCosmetics();
}

export async function plazaPushCosmetics() {
  if (!client?.connected || !deps?.getCosmetics) return;
  await client.setCosmetics(deps.getCosmetics());
}

function clearReconnectTimer() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function scheduleManualReconnect(delayMs = 3000) {
  clearReconnectTimer();
  if (!active || !client) return;
  reconnectTimer = setTimeout(() => { void doManualReconnect(); }, delayMs);
}

async function doManualReconnect() {
  reconnectTimer = null;
  if (!active || !client || !deps) return;
  setNetBanner(`連線中斷，正在重連…`);
  const r = await client.tryManualReconnect();
  if (!active) return;
  if (r.ok) {
    carryNpcOk = !!(r as any).carryNpc;
    applyJoinFlags((r as any).flags);
  }
  if (!r.ok) {
    setNetBanner(`重連失敗，稍後再試…`);
    deps.toast('廣場重連失敗，持續嘗試中', '#ffb08a');
    scheduleManualReconnect(Math.min(20000, 4000 + Math.random() * 2000));
  }
}

function flashNetOk(msg: string) {
  setNetBanner(msg, true);
  setTimeout(() => { if (!netDown) setNetBanner(null); }, 2200);
}

async function restoreAfterRejoin(s?: PlazaSnapshot, chat?: PlazaChat[], grills?: PlazaGrillOyster[], flags?: PlazaFlagState[], wishes?: PlazaSeatWish[]) {
  if (!deps || !client) return;
  netDown = false;
  clearReconnectTimer();
  syncSeatChrome();
  // 重連後先清掉可能殘留的「自己」遠端分身，再套 roster
  view?.pruneSelf(deps.id);
  if (s) {
    snap = normalizeSnap(s);
    view?.syncRoster(snap, deps.id);
  }
  if (wishes) applySeatWishes(wishes);
  if (grills) view?.grill.syncAll(grills);
  applyJoinFlags(flags);
  // 補離線期間錯過的聊天
  applyChatHistory(chat);
  void plazaPushOutfit();
  // 斷線期間座位已被清掉：若本地還坐著，試著搶回原位
  if (seated && myPile != null && mySlot != null) {
    const r = await client.claimSeat(myPile, mySlot);
    if (r.ok) {
      if ((r as any).token) client.token = (r as any).token;
      if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
      if (isMgPile(myPile) && mySlot != null) {
        const info = (r as any).mg as { expireAt?: number; ExpireAt?: number; ammo?: number; Ammo?: number } | undefined;
        const ammo = typeof info?.ammo === 'number' ? info.ammo : (typeof info?.Ammo === 'number' ? info.Ammo : MG_SIT_AMMO);
        const rawExp = Number(info?.expireAt ?? info?.ExpireAt ?? 0);
        const expireAt = Number.isFinite(rawExp) && rawExp > Date.now() + 2000 ? rawExp : (Date.now() + MG_SIT_MS);
        deps.enterMgSit(mySlot, expireAt, ammo, mgFromMeat);
      } else if (shiftStarted && !isLeisurePile(myPile)) deps.refillBasin?.();
      flashNetOk('已重連，位子還在');
      deps.toast('已重連，位子還在', '#9be37a');
      setHud(plazaHudPeople(snap));
      return;
    }
    // 位子被佔：站起來繼續逛
    myPile = null; mySlot = null; seated = false;
    view?.highlight(null, null);
    syncSeatChrome();
    deps.goWalk();
    flashNetOk('已重連');
    deps.toast(r.err === 'taken' ? '已重連，原位子有人了，請另找空位' : '已重連，請重新找位子坐下', '#ffd76a');
    setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
    return;
  }
  flashNetOk('廣場已重新連線');
  deps.toast('廣場已重新連線', '#9be37a');
  if (!seated) setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
}

function wireClient(D: PlazaDeps) {
  client!.setHandlers({
    onRoster: (s) => {
      snap = normalizeSnap(s);
      view?.syncRoster(snap, D.id);
      checkCarryLost();
      syncPlazaPeopleHud();
      // 機關槍 90 秒到期：先 goWalk（仍有 myPile 算高台離座點），再清座位
      if (seated && myPile != null && isMgPile(myPile)) {
        const me = snap.players.find(p => (!!p.pid && p.pid === D.id) || (!!client?.connectionId && p.connId === client.connectionId));
        if (me && !me.seated) {
          D.onMgExpired?.();
          D.goWalk();
          seated = false; myPile = null; mySlot = null; mgFromMeat = false;
          view?.highlight(null, null);
          syncSeatChrome();
          D.toast('機關槍時間到了', '#ffb08a');
          setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
          return;
        }
      }
      if (!netDown && !seated) setHud(`${plazaHudPeople(snap)}　靠近空位坐下`);
    },
    onJoined: (p) => {
      const n = normPlayer(p);
      // 休眠重連同 pid：只更新，不當新進場（避免「離開／進來」連跳）
      const existed = !!(snap && n.pid && snap.players.some(x => x.pid === n.pid));
      view?.applyPose(n, D.id);
      if (snap) {
        const i = snap.players.findIndex(x => x.connId === n.connId || (!!n.pid && x.pid === n.pid));
        if (i < 0) snap.players.push(n); else snap.players[i] = { ...snap.players[i], ...n };
        snap.occupied = snap.players.filter((x) => !x.isNpc).length;
      }
      syncPlazaPeopleHud();
      if (!existed && !n.isNpc && n.pid && n.pid !== D.id) D.toast(`${plazaDisplayName(n.nick, n.tag)} 進來廣場了`, '#9fe0ff');
    },
    onLeft: (p) => {
      const n = normPlayer(p);
      view?.remove(n);
      if (snap) {
        snap.players = snap.players.filter(x => x.connId !== n.connId && !(n.pid && x.pid === n.pid));
        snap.occupied = snap.players.filter((x) => !x.isNpc).length;
      }
      syncPlazaPeopleHud();
      if (!n.isNpc && n.pid && n.pid !== D.id) D.toast(`${plazaDisplayName(n.nick, n.tag)} 離開廣場了`, '#ffb08a');
    },
    onSeatChanged: (p) => { mergePlayer(normPlayer(p)); view?.applyPose(normPlayer(p), D.id); },
    onPose: (p) => { const n = normPlayer(p); mergePlayer(n); view?.applyPose(n, D.id); },
    onPhase: (p) => { const n = normPlayer(p); mergePlayer(n); view?.applyPose(n, D.id); },
    onChat: (m) => pushChat(normChat(m)),
    // 阿婆氣泡：比照工寮 say，只顯示頭上字、不進聊天窗／角標／Discord
    onNpcSay: (m) => {
      const n = normChat(m);
      if (!n.text) return;
      view?.showChat({ connId: n.connId || undefined, pid: n.pid || undefined, nick: n.nick, text: n.text });
    },
    onSeatWish: (w) => { upsertSeatWish(w); },
    onSeatWishEnd: (e) => { applySeatWishEnd(e); },
    onShellThrow: (e) => { try { D.onShellThrow?.(e); } catch (err) { console.error('onShellThrow', err); } },
    onShellInbound: (e) => { try { D.onShellInbound?.(e); } catch (err) { console.error('onShellInbound', err); } },
    onShellReflectHit: (e) => { try { D.onShellReflectHit?.(e); } catch (err) { console.error('onShellReflectHit', err); } },
    onShellBlocked: (e) => { try { D.onShellBlocked?.(e); } catch (err) { console.error('onShellBlocked', err); } },
    onNpcMoon: (e) => { try { view?.moonLaunch(e.connId, 700, e.fromX, e.fromZ); D.onNpcMoon?.(e); } catch (err) { console.error('onNpcMoon', err); } },
    onShellHit: (e) => { try { D.onShellHit?.(e); } catch (err) { console.error('onShellHit', err); } },
    onMgFire: (e) => { try { D.onMgFire?.(e); } catch (err) { console.error('onMgFire', err); } },
    onMgHit: (e) => { try { D.onMgHit?.(e); } catch (err) { console.error('onMgHit', err); } },
    onPlazaAlert: (e) => { try { D.onPlazaAlert?.(e); } catch (err) { console.error('onPlazaAlert', err); } },
    onStealResult: (e) => { try { D.onStealResult?.(e); } catch (err) { console.error('onStealResult', err); } },
    onGrillUpsert: (o) => {
      const prev = view?.grill.get(o.id)?.state;
      view?.grill.upsert(o);
      if (o.state === 'open' && prev !== 'open' && myPile === o.pileId)
        D.toast('有蚵烤開了！搶掀上殼', '#ffd76a');
      try { D.onGrillUpsert?.(o); } catch (err) { console.error('onGrillUpsert', err); }
    },
    onGrillRemove: (id, byConnId, byNick) => {
      view?.grill.remove(id);
      try { D.onGrillRemove?.(id, byConnId, byNick); } catch (err) { console.error('onGrillRemove', err); }
    },
    onGrillTaken: (e) => {
      view?.grill.remove(e.oyster.id);
      try { D.onGrillTaken?.(e); } catch (err) { console.error('onGrillTaken', err); }
    },
    onPlazaPuff: (e) => {
      const me = client?.connectionId ?? '';
      if (e.connId && me && e.connId === me) return; // 忽略自己回聲
      view?.applyRemotePuff(e);
    },
    onReconnecting: (attempt) => {
      if (!active) return;
      netDown = true;
      setNetBanner(`連線不穩，正在重連（第 ${attempt} 次）…`);
      if (attempt === 1) D.toast('廣場連線中斷，正在重連…', '#ffb08a');
    },
    onSocketReconnected: () => {
      if (!active) return;
      setNetBanner('連上了，正在回到廣場…');
    },
    onFlagUpsert: (f) => { upsertFlag(f); },
    onRejoined: (s, chat, grills, flags, wishes) => { if (active) void restoreAfterRejoin(s, chat, grills, flags, wishes); },
    onRejoinFail: (err, attempt) => {
      if (!active) return;
      netDown = true;
      setNetBanner(`重連中（第 ${attempt ?? '?'} 次）…`);
      D.toast(zhErr(err) || '重連失敗，繼續嘗試', '#ffb08a');
    },
    onClose: () => {
      if (!active) return;
      netDown = true;
      setNetBanner('連線中斷，正在重連…');
      D.toast('廣場連線中斷，正在重連…', '#ffb08a');
      scheduleManualReconnect(1500);
    },
  });
}

function normalizeSnap(s: any): PlazaSnapshot {
  const players: PlazaPlayer[] = (s?.players ?? s?.Players ?? []).map(normPlayer);
  // occupied = 真人在場人數（不含阿婆）；優先用後端 Occupied
  const rawOcc = s?.occupied ?? s?.Occupied;
  const humanN = players.filter((p) => !p.isNpc).length;
  const occupied = typeof rawOcc === 'number' ? rawOcc
    : (humanN > 0 ? humanN : players.length);
  return {
    players,
    pileCount: s?.pileCount ?? s?.PileCount ?? PILE_COUNT,
    slotsPerPile: s?.slotsPerPile ?? s?.SlotsPerPile ?? SLOTS_PER_PILE,
    occupied,
    capacity: s?.capacity ?? s?.Capacity ?? PLAZA_CAPACITY,
    pileDiffs: parsePileDiffs(s?.pileDiffs ?? s?.PileDiffs),
  };
}

/** HUD：目前在場幾人（不含阿婆） */
function plazaHudPeople(s?: PlazaSnapshot | null) {
  const humans = s?.players?.filter((p) => !p.isNpc) ?? [];
  const n = humans.length > 0 ? humans.length : (s?.occupied ?? 0);
  const cap = s?.capacity ?? PLAZA_CAPACITY;
  return `廣場休閒・目前 ${n} 人（可坐 ${cap}）`;
}
function mergePlayer(n: PlazaPlayer) {
  if (!snap || !n) return;
  const i = snap.players.findIndex(x => (!!n.connId && x.connId === n.connId) || (!!n.pid && x.pid === n.pid));
  if (i < 0) snap.players.push(n);
  else snap.players[i] = { ...snap.players[i], ...n };
}

function normPlayer(p: any): PlazaPlayer {
  const carriedBy = String(p?.carriedBy ?? p?.CarriedBy ?? '') || undefined;
  const rawSeated = !!(p?.seated ?? p?.Seated ?? ((p?.pileId ?? p?.PileId ?? -1) >= 0));
  const seated = rawSeated && !carriedBy;
  const pid = p?.pid ?? p?.Pid ?? '';
  const isNpc = !!(p?.isNpc ?? p?.IsNpc) || String(pid).startsWith('npc-');
  return {
    connId: p?.connId ?? p?.ConnId ?? '',
    pid,
    nick: p?.nick ?? p?.Nick ?? (isNpc ? '阿婆' : '剝蚵人'),
    tag: isNpc ? undefined : (String(p?.tag ?? p?.Tag ?? '').replace(/^#/, '') || undefined),
    pileId: carriedBy ? -1 : (p?.pileId ?? p?.PileId ?? -1),
    slot: carriedBy ? -1 : (p?.slot ?? p?.Slot ?? -1),
    phase: p?.phase ?? p?.Phase ?? 'idle',
    count: p?.count ?? p?.Count ?? 0,
    joinedAt: p?.joinedAt ?? p?.JoinedAt ?? 0,
    x: Number(p?.x ?? p?.X ?? 0),
    z: Number(p?.z ?? p?.Z ?? 0),
    yaw: Number(p?.yaw ?? p?.Yaw ?? 0),
    seated,
    moving: !!(p?.moving ?? p?.Moving),
    umb: !!(p?.umb ?? p?.Umb),
    lookYaw: Number(p?.lookYaw ?? p?.LookYaw ?? 0),
    pitch: Number(p?.pitch ?? p?.Pitch ?? 0),
    head: p?.head ?? p?.Head ?? 'hd_basic',
    hand: p?.hand ?? p?.Hand ?? 'hn_basic',
    body: p?.body ?? p?.Body ?? 'bd_basic',
    legs: p?.legs ?? p?.Legs ?? 'lg_basic',
    feet: p?.feet ?? p?.Feet ?? 'ft_basic',
    cosmetics: (p?.cosmetics ?? p?.Cosmetics) == null ? undefined : String(p.cosmetics ?? p.Cosmetics ?? ''),
    isNpc,
    carriedBy,
  };
}
function normChat(m: any): PlazaChat {
  return {
    connId: m?.connId ?? m?.ConnId ?? '',
    pid: m?.pid ?? m?.Pid ?? '',
    nick: m?.nick ?? m?.Nick ?? '?',
    tag: String(m?.tag ?? m?.Tag ?? '').replace(/^#/, '') || undefined,
    text: m?.text ?? m?.Text ?? '',
    pileId: m?.pileId ?? m?.PileId ?? null,
    at: m?.at ?? m?.At ?? Date.now(),
    via: String(m?.via ?? m?.Via ?? '') || undefined,
  };
}

function takenSet(exceptMine = true) {
  const t = new Set<string>();
  for (const p of snap?.players ?? []) {
    if (exceptMine && deps && p.pid === deps.id) continue;
    if (p.carriedBy || (p.isNpc && (p.phase || '') === 'moon')) continue; // 被抱走／飛彈飛走的阿婆讓出座位
    if (!p.seated || p.pileId < 0 || p.slot < 0) continue;
    t.add(seatKey(p.pileId, p.slot));
  }
  return t;
}

function buildUi() {
  ui = document.createElement('div');
  ui.id = 'plazaRoot';
  ui.innerHTML = `
<style>
/* 高於 #plazaTags(8800)、#seatCard(8900)，聊天窗不被人名／座位指示蓋住 */
#plazaRoot{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:inherit}
#plazaRoot *{box-sizing:border-box}
/* 人數提示改走遊戲 #top；此層僅保留作內部狀態字串，預設隱藏以免蓋住 HUD */
#pzHud{display:none}
#pzNet{display:none;pointer-events:none;position:absolute;top:calc(env(safe-area-inset-top) + 108px);left:50%;transform:translateX(-50%);max-width:min(86vw,360px);background:rgba(80,28,12,.92);border:2px solid #ffb08a;border-radius:12px;padding:8px 14px;font-weight:900;font-size:14px;color:#ffe0c0;text-align:center;line-height:1.35;z-index:4;box-shadow:0 4px 14px #0008}
#pzNet.on{display:block}
#pzNet.ok{background:rgba(20,48,28,.92);border-color:#9be37a;color:#d8ffc8}
/* 右下：避開上方狀態列、左下搖桿／聊天 */
/* 離開廣場：跟地圖同一組，排在地圖正下方 */
#pzLeftFabs{pointer-events:none;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;top:calc(env(safe-area-inset-top) + 118px);bottom:auto;z-index:2;display:flex;flex-direction:column;align-items:stretch;gap:8px}
#pzLeftFabs>button{pointer-events:auto;position:static;min-width:48px;height:44px;padding:0 12px;border:1.5px solid rgba(232,246,255,.35);border-radius:12px;background:rgba(32,72,96,.48);color:#e8f6ff;font-weight:900;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.22);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px}
#pzLeftFabs>button:active{background:rgba(32,72,96,.62)}
#pzLeftFabs>button .ic{background:currentColor}
#pzX.hide{display:none}
@media (pointer:fine){#pzLeftFabs{top:calc(env(safe-area-inset-top) + 14px);left:calc(env(safe-area-inset-left) + 10px);z-index:2}#pzLeftFabs>button{height:44px}}
@media (pointer:coarse) and (orientation:landscape){
  #pzLeftFabs{top:calc(env(safe-area-inset-top) + 4px);left:calc(env(safe-area-inset-left) + 8px);gap:6px;z-index:2}
  #pzLeftFabs>button{height:40px;min-width:44px;padding:0 10px;font-size:13px}
}
#pzLeaveAsk{display:none;pointer-events:auto;position:absolute;inset:0;z-index:8;align-items:center;justify-content:center;padding:24px;background:rgba(8,10,12,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#pzLeaveAsk.open{display:flex}
#pzLeaveAsk .pzLeaveBox{width:min(92vw,360px);padding:22px 20px 16px;border-radius:16px;background:rgba(22,28,36,.82);border:1px solid rgba(255,255,255,.22);box-shadow:0 8px 28px rgba(0,0,0,.35);color:#f2f4f7;text-align:center}
#pzLeaveAsk .pzLeaveBox p{margin:0 0 16px;font-size:17px;font-weight:800}
#pzLeaveAsk .pzLeaveBtns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
#pzLeaveAsk .pzLeaveBtns button{pointer-events:auto;min-width:96px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.10);color:#f2f4f7;font-weight:800;font-size:15px}
#pzLeaveAsk .pzLeaveBtns #pzLeaveOk{background:rgba(42,90,134,.85);border-color:rgba(232,246,255,.4)}
#pzLeaveAsk .pzLeaveBtns button:active{background:rgba(255,255,255,.2)}
#pzLeaveAsk .pzLeaveBtns #pzLeaveOk:active{background:rgba(42,90,134,1)}
/* 聊天放左側，避開右下雨傘／丟殼／偷 */
#pzChatFab{pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 168px);z-index:3;min-width:48px;height:44px;padding:0 12px;border:0;border-radius:12px;background:#d9952b;color:#2a1600;font-weight:900;font-size:14px;box-shadow:2px 2px 0 #1b1208}
#pzChatFab .pzBadge{display:none;position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#e23b2f;color:#fff;font-size:11px;font-weight:900;line-height:18px;text-align:center;box-shadow:0 1px 0 #1b1208;pointer-events:none}
#pzChatFab.hasUnread .pzBadge{display:block}
#pzChatFab.hasUnread{animation:pzFabPulse .9s ease-in-out 2}
@keyframes pzFabPulse{0%,100%{transform:scale(1)}40%{transform:scale(1.06)}}
#pzChatPeek{display:none;pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 220px);max-width:min(70vw,280px);background:rgba(20,12,6,.92);border:2px solid #d9952b;border-radius:12px;padding:8px 10px;color:#fff6d8;font-size:12px;line-height:1.35;z-index:3;cursor:pointer;box-shadow:2px 2px 0 #1b1208}
#pzChatPeek.on{display:block}
#pzChatPeek b{color:#ffd23f;font-weight:900}
#pzChat{display:none;pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 10px);right:auto;bottom:calc(env(safe-area-inset-bottom) + 220px);width:min(58vw,260px);max-width:calc(100vw - 24px);background:rgba(20,12,6,.88);border:2px solid #d9952b;border-radius:12px;padding:8px;color:#fff6d8;z-index:3}
#pzChat.open{display:block}
/* 電腦：聊天鈕靠左下；視窗／預覽叠在鈕上方（離開已改到地圖下方） */
@media (pointer:fine){
  #pzChatFab{bottom:calc(env(safe-area-inset-bottom) + 18px);height:44px}
  #pzChatPeek{bottom:calc(env(safe-area-inset-bottom) + 70px)}
  #pzChat{bottom:calc(env(safe-area-inset-bottom) + 70px)}
}
/* 電腦寬螢幕：聊天窗加寬，方便看長句 */
@media (pointer:fine) and (min-width:900px){
  #pzChat{width:min(36vw,420px)}
  #pzChatPeek{max-width:min(36vw,420px)}
  #pzLog{height:88px}
}
@media (pointer:coarse) and (orientation:landscape){
  #pzChatFab{bottom:calc(env(safe-area-inset-bottom) + 120px)}
  #pzChatPeek{bottom:calc(env(safe-area-inset-bottom) + 172px);max-width:min(42vw,240px)}
  #pzChat{bottom:calc(env(safe-area-inset-bottom) + 172px);width:min(42vw,240px)}
}
#pzChatHd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:12px;font-weight:800;color:#ffd23f}
#pzChatMin{pointer-events:auto;background:transparent;border:0;color:#ffd23f;font-size:18px;line-height:1;padding:2px 6px;font-weight:900}
#pzLog{height:64px;overflow:auto;font-size:12px;line-height:1.35;margin-bottom:6px}
#pzRow{display:flex;gap:6px}
#pzRow input{flex:1;min-width:0;border-radius:8px;border:2px solid #6b3a12;background:#1a1008;color:#fff6d8;padding:6px 8px;font-size:14px}
#pzRow button{pointer-events:auto;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;padding:8px 12px}
@media (max-width:420px){#pzChat{width:min(72vw,240px)}#pzLog{height:52px}}
/* 地圖：左下聊天上方；開圖時全螢幕半透明＋中央畫布 */
/* 左上：狀態列（#top／#stats）下方 */
/* z-index 低於聊天／離開；狀態列另在 style.css 抬到 plazaRoot 之上 */
/* 直向手機：狀態列下方；桌面／橫向：與 #top 同一列左側（地圖-狀態列） */
/* 地圖／離開樣式見 #pzLeftFabs */
#pzMap{display:none;pointer-events:auto;position:absolute;inset:0;z-index:6;background:rgba(8,10,12,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px)}
#pzMap.open{display:flex;flex-direction:column;gap:10px}
#pzMapHd{display:flex;align-items:center;justify-content:space-between;gap:10px;width:min(92vw,420px);color:#ffe6b0;font-weight:900;font-size:16px}
#pzMapHd button{pointer-events:auto;background:#d9952b;color:#2a1600;border:0;border-radius:10px;font-weight:800;padding:8px 14px;font-size:14px}
#pzMapCvs{width:min(92vw,min(72vh,420px));height:min(92vw,min(72vh,420px));max-width:100%;border-radius:14px;border:2px solid rgba(217,149,43,.65);box-shadow:0 8px 28px #000a;background:#1a2218;touch-action:none;aspect-ratio:1;flex:0 1 auto}
#pzMapLeg{width:min(92vw,420px);display:flex;flex-wrap:wrap;gap:8px 14px;font-size:12px;color:#d8e0d0;font-weight:700}
#pzMapLeg span{display:inline-flex;align-items:center;gap:5px}
#pzMapLeg i{width:10px;height:10px;border-radius:50%;display:inline-block}
/* 桌面／手機橫向：地圖盡量撐滿可視區（預留標題＋圖例） */
@media (pointer:fine),(pointer:coarse) and (orientation:landscape){
  #pzMap{padding:calc(env(safe-area-inset-top) + 8px) 12px calc(env(safe-area-inset-bottom) + 8px);gap:8px}
  #pzMapHd,#pzMapLeg{width:min(96vw,calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 84px));max-width:96vw}
  #pzMapCvs{
    width:min(96vw,calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 84px));
    height:min(96vw,calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 84px));
    max-width:96vw;
    max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 84px);
  }
}
</style>
<div id="pzLeftFabs">
<button id="pzMapFab" type="button" aria-label="地圖"><i class="ic ic-pin"></i> 地圖<span class="key"> (M)</span></button>
<button id="pzX" type="button" aria-label="離開廣場"><i class="ic ic-exit"></i> 離開</button>
</div>
<div id="pzLeaveAsk" role="dialog" aria-modal="true" aria-label="確定離開廣場？">
  <div class="pzLeaveBox">
    <p>確定離開廣場？</p>
    <div class="pzLeaveBtns">
      <button id="pzLeaveOk" type="button">確定</button>
      <button id="pzLeaveNo" type="button">取消</button>
    </div>
  </div>
</div>
<div id="pzHud">準備中…</div>
<div id="pzNet" role="status" aria-live="polite"></div>
<button id="pzChatFab" type="button" aria-label="聊天">聊天<span class="key"> (ENTER)</span><span class="pzBadge" aria-hidden="true">0</span></button>
<button id="pzChatPeek" type="button" aria-label="打開聊天"></button>
<div id="pzChat">
  <div id="pzChatHd"><span>廣場聊天</span><button id="pzChatMin" type="button" aria-label="縮小">–</button></div>
  <div id="pzLog"></div>
  <div id="pzRow"><input id="pzIn" maxlength="80" placeholder="跟廣場打招呼…"/><button id="pzSend" type="button">送</button></div>
</div>
<div id="pzMap" role="dialog" aria-label="廣場地圖">
  <div id="pzMapHd"><span>廣場地圖</span><button id="pzMapClose" type="button">關閉</button></div>
  <canvas id="pzMapCvs" width="420" height="420" aria-hidden="true"></canvas>
  <div id="pzMapLeg">
    <span><i style="background:#5ad0ff"></i>你</span>
    <span><i style="background:#ff7a6a"></i>走動</span>
    <span><i style="background:#ffb060"></i>坐下</span>
    <span><i style="background:#b45a28;border-radius:2px"></i>烤台</span>
    <span><i style="background:#464e3e;border-radius:2px"></i>蚵堆</span>
  </div>
</div>`;
  document.body.appendChild(ui);
  ui.querySelector('#pzX')!.addEventListener('click', () => plazaAskLeave());
  ui.querySelector('#pzLeaveNo')!.addEventListener('click', () => plazaCloseLeaveAsk());
  ui.querySelector('#pzLeaveOk')!.addEventListener('click', () => {
    plazaCloseLeaveAsk();
    plazaLeaveNow();
  });
  ui.querySelector('#pzLeaveAsk')!.addEventListener('click', (e) => {
    if (e.target === ui!.querySelector('#pzLeaveAsk')) plazaCloseLeaveAsk();
  });
  const chat = ui.querySelector('#pzChat') as HTMLElement;
  const fab = ui.querySelector('#pzChatFab') as HTMLElement;
  const peek = ui.querySelector('#pzChatPeek') as HTMLElement;
  const inp = ui.querySelector('#pzIn') as HTMLInputElement;
  fab.addEventListener('click', () => {
    if (chat.classList.contains('open')) plazaCloseChat();
    else plazaFocusChat();
  });
  peek.addEventListener('click', () => plazaFocusChat());
  ui.querySelector('#pzChatMin')!.addEventListener('click', () => plazaCloseChat());
  ui.querySelector('#pzSend')!.addEventListener('click', sendChat);
  inp.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Enter') { ke.preventDefault(); sendChat(); }
    if (ke.key === 'Escape') { ke.preventDefault(); plazaCloseChat(); }
  });
  ui.querySelector('#pzMapFab')!.addEventListener('click', () => plazaToggleMap());
  ui.querySelector('#pzMapClose')!.addEventListener('click', () => plazaCloseMap());
  ui.querySelector('#pzMap')!.addEventListener('click', (e) => {
    if (e.target === ui!.querySelector('#pzMap')) plazaCloseMap();
  });
  chatUnread = 0;
  plazaCloseChat();
  plazaCloseMap();
  hideChatPeek();
}

function scrollChatLogToEnd() {
  const log = ui?.querySelector('#pzLog') as HTMLElement | null;
  if (!log) return;
  log.scrollTop = log.scrollHeight;
}

function setChatOpen(open: boolean) {
  const chat = ui?.querySelector('#pzChat') as HTMLElement | null;
  const fab = ui?.querySelector('#pzChatFab') as HTMLElement | null;
  if (!chat || !fab) return;
  chat.classList.toggle('open', open);
  fab.style.opacity = open ? '0.55' : '1';
  if (open) {
    chatUnread = 0;
    hideChatPeek();
    syncChatBadge();
    // 縮小時 display:none，展開後才有正確 scrollHeight；雙 rAF 等 layout
    requestAnimationFrame(() => requestAnimationFrame(scrollChatLogToEnd));
  }
}

function syncChatBadge() {
  const fab = ui?.querySelector('#pzChatFab') as HTMLElement | null;
  const badge = fab?.querySelector('.pzBadge') as HTMLElement | null;
  if (!fab || !badge) return;
  const n = chatUnread;
  fab.classList.toggle('hasUnread', n > 0);
  badge.textContent = n > 99 ? '99+' : String(n);
  fab.setAttribute('aria-label', n > 0 ? `聊天，${n} 則未讀` : '聊天');
}

function hideChatPeek() {
  if (chatPeekTimer) { clearTimeout(chatPeekTimer); chatPeekTimer = null; }
  ui?.querySelector('#pzChatPeek')?.classList.remove('on');
}

/** 縮小中：短暫預覽最新一句，點了開聊天 */
function showChatPeek(nick: string, text: string) {
  const peek = ui?.querySelector('#pzChatPeek') as HTMLElement | null;
  if (!peek || plazaChatIsOpen()) return;
  const short = text.length > 36 ? text.slice(0, 35) + '…' : text;
  peek.innerHTML = `<b>${escChat(nick)}</b> ${escChat(short)}`;
  peek.classList.add('on');
  if (chatPeekTimer) clearTimeout(chatPeekTimer);
  chatPeekTimer = setTimeout(() => { chatPeekTimer = null; peek.classList.remove('on'); }, 4200);
}

function escChat(s: string) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Enter／點聊天：打開並直接打字 */
export function plazaFocusChat() {
  if (!active || !ui) return false;
  setChatOpen(true);
  const inp = ui.querySelector('#pzIn') as HTMLInputElement | null;
  if (!inp) return true;
  // 下一幀 focus，避開 pointer lock 剛退出／按鍵還在冒泡
  requestAnimationFrame(() => {
    try { inp.focus({ preventScroll: true }); } catch { inp.focus(); }
  });
  return true;
}

export function plazaCloseChat() {
  const inp = ui?.querySelector('#pzIn') as HTMLInputElement | null;
  if (inp && document.activeElement === inp) inp.blur();
  setChatOpen(false);
  return true;
}

export function plazaChatIsOpen() {
  return !!ui?.querySelector('#pzChat')?.classList.contains('open');
}


function applyJoinFlags(raw: PlazaFlagState[] | undefined) {
  if (!Array.isArray(raw)) {
    flagOk = false;
    flagList = [];
    view?.syncFlags?.([]);
    syncFlagBtn();
    return;
  }
  flagOk = true;
  flagList = raw.filter(f => f.planted && f.k);
  view?.syncFlags?.(flagList);
  syncFlagBtn();
}

function upsertFlag(f: PlazaFlagState) {
  if (!f.k) return;
  const i = flagList.findIndex(x => x.k === f.k);
  if (!f.planted) {
    if (i >= 0) flagList.splice(i, 1);
  } else if (i >= 0) flagList[i] = f;
  else flagList.push(f);
  view?.syncFlags?.(flagList);
}

function ensureFlagBtn() {
  if (document.getElementById('flagBtn')) return;
  const b = document.createElement('button');
  b.id = 'flagBtn';
  b.type = 'button';
  b.innerHTML = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2.2 3.6L17 11H6"/></svg><span>插旗</span>';
  b.addEventListener('click', () => { void plantMyFlag(); });
  (document.getElementById('btns') || document.body).appendChild(b);
  const pb = document.createElement('button');
  pb.id = 'flagPullBtn';
  pb.type = 'button';
  pb.innerHTML = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2.2 3.6L17 11H6"/><path d="M14 15l5 5M19 15l-5 5"/></svg><span>收旗</span>';
  pb.addEventListener('click', () => { void pullMyFlag(); });
  b.after(pb);
}

function removeFlagBtn() {
  document.getElementById('flagBtn')?.remove();
  document.getElementById('flagPullBtn')?.remove();
}

let pullBusy = false;
async function pullMyFlag() {
  if (!deps || pullBusy) return;
  pullBusy = true;
  try {
    const r = await plazaTryRemoveFlag();
    if (!r.ok) { deps.toast(r.err === 'not_planted' ? '你的旗還沒插在廣場上' : r.err === 'nosup' ? '這台伺服器還沒開放收旗' : flagSlowText(r.err, r.waitMs, 'remove'), '#ffb08a'); return; }
    deps.toast('旗收起來了，文字和升級都會保留', '#9be37a');
    deps.track('flag_pull', {});
  } finally { pullBusy = false; }
}

export async function plazaTryShowFlag() {
  if (client?.connected) {
    const r = await client.showFlag();
    if (r.ok && r.flag) upsertFlag(r.flag);
    return { ok: !!r.ok, err: r.err, mine: r.flag ?? null, waitMs: r.waitMs };
  }
  return { ok: false as const, err: 'no_conn', mine: null };
}

export async function plazaTryRemoveFlag() {
  if (client?.connected) {
    const r = await client.removeFlag();
    if (r.ok && r.flag) upsertFlag(r.flag);
    return { ok: !!r.ok, err: r.err, mine: r.flag ?? null, waitMs: r.waitMs };
  }
  return { ok: false as const, err: 'no_conn', mine: null };
}

function syncFlagBtn() {
  const show = active && flagOk && !seated && !netDown && !!deps?.ownsFlag?.();
  if (show) ensureFlagBtn();
  const b = document.getElementById('flagBtn');
  if (b) b.classList.toggle('on', show);
  document.getElementById('flagPullBtn')?.classList.toggle('on', show);
}

async function plantMyFlag() {
  if (!deps || !client) return;
  if (!flagOk) { deps.toast(flagErrText('nosup'), '#ffb08a'); return; }
  if (!deps.ownsFlag?.()) return;
  if (!client.connected) { deps.toast(flagErrText('no_conn'), '#ffb08a'); return; }
  if (seated) { deps.toast(flagErrText('seated'), '#ffb08a'); return; }
  if (plantBusy) return;
  plantBusy = true;
  try {
    const feet = deps.getWalkXZ();
    const yaw = deps.getYaw();
    const p = flagPlantPos(feet.x, feet.z, yaw);
    // 不帶文字：伺服器會保留已儲存的旗面文字（避免被名字蓋回去）
    const text = myFlagText ?? '';
    let r = await client.plantFlag(p.x, p.z, yaw, text);
    if (!r.ok && r.err === 'seated' && !seated) {
      // 本機已站著但伺服器還記著座位：先釋座、送出目前位置再插一次
      await client.leaveSeat();
      const lockLook = deps.getTpv?.() ?? false;
      const now = deps.getWalkXZ();
      const yaw2 = deps.getYaw();
      await client.sync(now.x, now.z, yaw2, 'walk', deps.getBowlStock(), false, deps.getUmb(),
        lockLook ? 0 : (deps.getLookYaw?.() ?? 0), lockLook ? 0 : (deps.getPitch?.() ?? 0));
      const p2 = flagPlantPos(now.x, now.z, yaw2);
      r = await client.plantFlag(p2.x, p2.z, yaw2, text);
    }
    if (!r.ok) { deps.toast(flagSlowText(r.err, r.waitMs, 'plant'), '#ffb08a'); return; }
    if (r.flag) {
      myFlagText = r.flag.text;
      upsertFlag(r.flag);
    }
    deps.toast('旗插好了', '#9be37a');
    deps.track('flag_plant', {});
  } finally {
    plantBusy = false;
  }
}

export function plazaRefreshFlagUi() {
  syncFlagBtn();
}

export async function plazaTrySetFlagText(text: string) {
  if (client?.connected) {
    const r = await client.setFlagText(text);
    if (r.ok && r.flag) {
      myFlagText = r.flag.text;
      if (r.flag.planted) upsertFlag(r.flag);
    }
    return { ok: !!r.ok, err: r.err, mine: r.flag ?? null, waitMs: r.waitMs };
  }
  return { ok: false as const, err: 'no_conn', mine: null };
}

export async function plazaTryUpgradeFlag(track: string, from?: number) {
  if (client?.connected) {
    const r = await client.upgradeFlag(track, from);
    if (r.ok && r.flag?.planted) upsertFlag(r.flag);
    return { ok: !!r.ok, err: r.err, mine: r.flag ?? null, waitMs: r.waitMs };
  }
  return { ok: false as const, err: 'no_conn', mine: null };
}

export async function plazaTrySelectFlag(track: string, level: number) {
  if (client?.connected) {
    const r = await client.selectFlag(track, level);
    if (r.ok && r.flag?.planted) upsertFlag(r.flag);
    return { ok: !!r.ok, err: r.err, mine: r.flag ?? null, waitMs: r.waitMs };
  }
  return { ok: false as const, err: 'no_conn', mine: null };
}

function showRoamUi() {
  syncSeatChrome();
}

/** 走動才顯示離開；坐下改用遊戲內 quit／換位置。上方狀態一律用遊戲 #top／#stats */
function syncSeatChrome() {
  const leave = ui?.querySelector('#pzX') as HTMLElement | null;
  if (leave) leave.classList.toggle('hide', seated);
  syncFlagBtn();
}

function setHud(t: string) {
  const el = ui?.querySelector('#pzHud'); if (el) el.textContent = t;
  syncSeatChrome();
  syncPlazaPeopleHud();
}

/** 廣場人數顯示在遊戲 #stats 的 #onHud（人數圖示），坐下／閒逛皆可見 */
function syncPlazaPeopleHud() {
  const h = document.getElementById('onHud');
  const nEl = document.getElementById('onHudN');
  if (!h || !nEl) return;
  // 手機橫向矮螢幕 #stats 會藏起來：在 #top 另放一份廣場人數（CSS 只在橫向顯示）
  let top = document.getElementById('pzTopOn');
  const topBar = document.getElementById('top');
  if (!top && topBar) {
    top = document.createElement('span');
    top.id = 'pzTopOn';
    top.className = 'hudItem';
    const svg = h.querySelector('svg');
    top.innerHTML = `${svg ? svg.outerHTML : ''}<span class="hudV" id="pzTopOnN">0</span>`;
    const shop = topBar.querySelector('#shopBtn');
    topBar.insertBefore(top, shop);
  }
  if (!active) {
    top?.classList.remove('on');
    delete h.dataset.plaza;
    h.style.display = 'none';
    h.removeAttribute('title');
    h.setAttribute('aria-label', '目前線上人數');
    teardownPlayersChrome();
    return;
  }
  const n = snap
    ? (typeof snap.occupied === 'number' ? snap.occupied : snap.players.filter((p) => !p.isNpc).length)
    : 0;
  const cap = snap?.capacity ?? PLAZA_CAPACITY;
  h.dataset.plaza = '1';
  h.style.display = '';
  nEl.textContent = String(n);
  h.title = `廣場目前 ${n} 人（可坐 ${cap}）`;
  h.setAttribute('aria-label', h.title);
  if (top) {
    top.classList.add('on');
    const tn = top.querySelector('#pzTopOnN');
    if (tn) tn.textContent = String(n);
    top.title = h.title;
    top.setAttribute('aria-label', h.title);
  }
  // 等 plazaMode 再掛玩家鈕，避免入場 loading 期間搬 #camBtn 出錯卡住
  if (document.body.classList.contains('plazaMode') || document.body.classList.contains('plazaRoam')) {
    try {
      placePlayersChrome();
      if (document.getElementById('pzPlayersWrap')?.classList.contains('open')) paintPlayersDrop();
    } catch (e) { console.error('placePlayersChrome', e); }
  }
}

const PZ_PLAYERS_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.1 5 2.4 5 5.8"/></svg>`;

function escHtml(s: string) {
  return s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

let playersDropTab: 'plaza' | 'friends' = 'plaza';

async function paintPlayersDrop() {
  const drop = document.getElementById('pzPlayersDrop');
  if (!drop) return;
  const fr = await import('../meta/friends');
  await fr.refreshFriendIds();
  const data = await fr.loadFriends();
  const selfId = deps?.id ?? '';
  const humans = (snap?.players ?? []).filter(p => !p.isNpc);
  const others = humans
    .filter(p => p.pid !== selfId)
    .slice()
    .sort((a, b) => plazaDisplayName(a.nick, a.tag).localeCompare(plazaDisplayName(b.nick, b.tag), 'zh'));
  const selfSnap = humans.find(p => p.pid === selfId);
  const selfName = plazaDisplayName(deps?.nick?.() ?? selfSnap?.nick, myTag() || selfSnap?.tag);
  const selfMeat = deps?.getBowlStock?.() ?? selfSnap?.count ?? 0;

  const tabs = `<div class="pzPTabs" role="tablist">
    <button type="button" class="pzPTab${playersDropTab === 'plaza' ? ' on' : ''}" data-pzptab="plaza">廣場</button>
    <button type="button" class="pzPTab${playersDropTab === 'friends' ? ' on' : ''}" data-pzptab="friends">好友</button>
  </div>`;

  let body = '';
  if (playersDropTab === 'plaza') {
    const rows = [
      { name: `${selfName}（你）`, meat: selfMeat, self: true, act: '' },
      ...others.map(p => {
        const mark = fr.friendMark(p.tag);
        const name = plazaDisplayName(p.nick, p.tag) + (mark || '');
        return { name, meat: p.count | 0, self: false, act: fr.friendActionBtn('', p.tag, p.nick) };
      }),
    ];
    body = rows.map(r =>
      `<div class="pzPRow${r.self ? ' self' : ''}"><span class="pzPName">${escHtml(r.name)}</span><span class="pzPMeat"><i class="ic ic-oyster"></i> ${r.meat}</span>${r.act || ''}</div>`,
    ).join('') || '<div class="pzPEmpty">廣場還沒有其他人</div>';
  } else {
    const friends = data?.friends ?? [];
    const plazaByTag = new Map(humans.map(p => [String(p.tag || ''), p]));
    body = friends.length ? friends.map(f => {
      const inPz = plazaByTag.get(String(f.tag || ''));
      const meat = inPz ? (inPz.count | 0) : null;
      const loc = f.online ? (inPz ? '廣場中' : (f.whereZh || '線上')) : '離線';
      return `<div class="pzPRow"><span class="pzPName">${escHtml(f.nick)} <small>#${escHtml(f.tag)}</small></span>
        <span class="pzPLoc">${escHtml(loc)}${meat != null ? ` · <i class="ic ic-oyster"></i> ${meat}` : ''}</span></div>`;
    }).join('') : '<div class="pzPEmpty">還沒有好友</div>';
  }

  drop.innerHTML = tabs + body;
  drop.querySelectorAll('[data-pzptab]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    playersDropTab = (b as HTMLElement).dataset.pzptab as 'plaza' | 'friends';
    void paintPlayersDrop();
  }));
  fr.bindFriendActions(drop, () => { void paintPlayersDrop(); });
}

function closePlayersDrop() {
  const wrap = document.getElementById('pzPlayersWrap');
  const btn = document.getElementById('pzPlayersBtn');
  wrap?.classList.remove('open');
  btn?.setAttribute('aria-expanded', 'false');
}

export function plazaPlayersIsOpen() {
  return !!document.getElementById('pzPlayersWrap')?.classList.contains('open');
}

export function plazaClosePlayers() { closePlayersDrop(); }

function onPlayersDocPointer(e: Event) {
  const wrap = document.getElementById('pzPlayersWrap');
  if (!wrap?.classList.contains('open')) return;
  if (e.target instanceof Node && wrap.contains(e.target)) return;
  closePlayersDrop();
}

let playersOrientBound = false;
function ensurePlayersChrome() {
  let cluster = document.getElementById('pzCamCluster');
  if (!cluster) {
    cluster = document.createElement('div');
    cluster.id = 'pzCamCluster';
  }
  let wrap = document.getElementById('pzPlayersWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'pzPlayersWrap';
    wrap.innerHTML = `<button id="pzPlayersBtn" type="button" aria-label="廣場玩家 (Tab)" aria-expanded="false" aria-haspopup="listbox" title="廣場玩家 (Tab)">${PZ_PLAYERS_SVG}<span>玩家</span><span class="key"> (Tab)</span></button><div id="pzPlayersDrop" role="listbox" aria-label="廣場玩家列表"></div>`;
    const btn = wrap.querySelector('#pzPlayersBtn') as HTMLButtonElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      plazaTogglePlayers();
    });
    document.addEventListener('pointerdown', onPlayersDocPointer, true);
  }
  if (wrap.parentElement !== cluster) cluster.insertBefore(wrap, cluster.firstChild);
  if (!playersOrientBound) {
    playersOrientBound = true;
    const reloc = () => { if (active) placePlayersChrome(); };
    matchMedia('(orientation: landscape)').addEventListener('change', reloc);
    matchMedia('(pointer: fine)').addEventListener('change', reloc);
    addEventListener('orientationchange', () => setTimeout(reloc, 80));
  }
  return cluster;
}

/** 開／關廣場玩家下拉（按鈕與 Tab） */
export function plazaTogglePlayers() {
  if (!active) return;
  placePlayersChrome();
  const wrap = document.getElementById('pzPlayersWrap');
  const btn = document.getElementById('pzPlayersBtn');
  if (!wrap || !btn) return;
  const open = !wrap.classList.contains('open');
  if (open) {
    plazaCloseMap();
    plazaCloseChat();
    paintPlayersDrop();
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  } else closePlayersDrop();
}

function placePlayersChrome() {
  if (!active) { teardownPlayersChrome(); return; }
  const cluster = ensurePlayersChrome();
  cluster.classList.add('on');
  const cam = document.getElementById('camBtn');
  const land = matchMedia('(orientation: landscape)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  // 電腦／橫向：掛 #top（狀態列可見）；直向手機：跟視角鈕一起在 #stats
  const host = document.getElementById(fine || land ? 'top' : 'stats');
  if (!host) return;
  if (coarse && cam && !fine) {
    if (cam.parentElement !== cluster) {
      if (cluster.parentElement !== host) {
        if (cam.parentElement === host) host.insertBefore(cluster, cam);
        else host.appendChild(cluster);
      } else if (cam.parentElement === host) {
        host.insertBefore(cluster, cam);
      }
      cluster.appendChild(cam);
    } else if (cluster.parentElement !== host) {
      host.appendChild(cluster);
    }
  } else if (cluster.parentElement !== host) {
    host.appendChild(cluster);
  }
}

function teardownPlayersChrome() {
  closePlayersDrop();
  document.removeEventListener('pointerdown', onPlayersDocPointer, true);
  const cluster = document.getElementById('pzCamCluster');
  const cam = document.getElementById('camBtn');
  if (cluster && cam && cam.parentElement === cluster) {
    cluster.parentElement?.insertBefore(cam, cluster);
  }
  document.getElementById('pzPlayersWrap')?.remove();
  cluster?.remove();
}

/** 連線狀態條：坐下時也顯示（不跟 #pzHud 一起藏） */
function setNetBanner(t: string | null, ok = false) {
  const el = ui?.querySelector('#pzNet') as HTMLElement | null;
  if (!el) return;
  if (!t) { el.classList.remove('on', 'ok'); el.textContent = ''; return; }
  el.textContent = t;
  el.classList.add('on');
  el.classList.toggle('ok', ok);
}

function nearestCarryNpc(wx: number, wz: number) {
  let best: { connId: string; nick: string; dist: number } | null = null;
  for (const p of snap?.players ?? []) {
    if (!p.isNpc) continue;
    if ((p.phase || '') === 'moon' || p.carriedBy) continue;
    // 坐著看座位；被放在原地站著的看她本人位置
    const sit = p.seated && p.pileId >= 0 && p.slot >= 0;
    if (!sit && (p.phase || '') !== 'stand') continue;
    const pos = sit ? seatPose(p.pileId, p.slot).pos : { x: p.x, z: p.z };
    const d = Math.hypot(wx - pos.x, wz - pos.z);
    if (d > CARRY_DIST) continue;
    if (!best || d < best.dist) best = { connId: p.connId, nick: p.nick || '阿婆', dist: d };
  }
  return best;
}

function markCarryUnsupported(err?: string) {
  if (/does not exist|MethodDoesNotExist|Unknown hub method|not be found|does not contain/i.test(err || '')) {
    carryNpcOk = false;
  }
}

/** 走動時更新附近空位／可抱的阿婆（資訊只走遊戲 #seatCard） */
export function plazaUpdateNear(wx: number, wz: number) {
  if (!active || seated) {
    near = null; nearCarry = null; nearPlace = null; nearShed = null;
    view?.highlightNear(null);
    return null;
  }
  near = null; nearCarry = null; nearPlace = null;
  // 工寮門口圓圈在碼頭上，離座位很遠：站進圈內就只提示進工寮
  nearShed = shedDoorAt(wx, wz);
  if (nearShed) { view?.highlightNear(null); return null; }
  if (carryNpcOk && myCarriedNpc()) {
    const n = nearestFreePlaceSeat(wx, wz, takenSet(true), SIT_DIST);
    nearPlace = n ? { pileId: n.pileId, slot: n.slot } : null;
    view?.highlightNear(nearPlace);
    return nearPlace;
  }
  if (carryNpcOk) {
    const c = nearestCarryNpc(wx, wz);
    const s0 = c ? nearestFreeSeat(wx, wz, takenSet(true), SIT_DIST) : null;
    // 空位和阿婆都在範圍內：看哪個比較近
    if (c && !(s0 && s0.dist < c.dist)) {
      nearCarry = { connId: c.connId, nick: c.nick };
      view?.highlightNear(null);
      return null;
    }
  }
  const n = nearestFreeSeat(wx, wz, takenSet(true), SIT_DIST);
  near = n ? { pileId: n.pileId, slot: n.slot } : null;
  view?.highlightNear(near);
  return near;
}

async function plazaDoCarry(npcConnId: string): Promise<boolean> {
  if (!deps || !client?.connected) { deps?.toast('還沒收好連線', '#ffb08a'); return false; }
  sittingBusy = true;
  try {
    const r = await client.carryNpc(npcConnId);
    if (!r.ok) {
      markCarryUnsupported(r.err);
      const who = nearCarry?.nick === '阿伯' ? '阿伯' : '阿婆';
      deps.toast(r.err === 'taken' ? '已有人在送' : zhNpcErr(r.err, who), '#ff8a7a');
      return false;
    }
    deps.toast('抱起來了，靠近空位再放下', '#9be37a');
    return true;
  } finally { sittingBusy = false; }
}

async function plazaDoPlace(seat: PlazaSeatRef): Promise<boolean> {
  if (!deps || !client?.connected) { deps?.toast('還沒收好連線', '#ffb08a'); return false; }
  const npc = myCarriedNpc();
  if (!npc) { deps.toast('沒有抱著阿婆', '#ffb08a'); return false; }
  const who = npcWho(npc);
  sittingBusy = true;
  carryPlacing = true;
  try {
    const r = await client.placeNpc(npc.connId, seat.pileId, seat.slot);
    if (!r.ok) {
      markCarryUnsupported(r.err);
      deps.toast(zhNpcErr(r.err, who), '#ff8a7a');
      if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
      return false;
    }
    if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
    const deliver = normSeatWishEnd((r as any).deliver);
    if (deliver) applySeatWishEnd(deliver);
    else deps.toast(`${who}坐好了`, '#9be37a');
    return true;
  } finally { sittingBusy = false; carryPlacing = false; checkCarryLost(); }
}

/** 嘗試坐附近空位（E／按鈕）；機關槍可指定付錢或用蚵肉 */
export async function plazaTrySit(mgPay: PlazaMgPay = 'auto'): Promise<boolean> {
  if (!deps || !active || seated || sittingBusy) return false;
  if (nearShed) {
    if (carryNpcOk && myCarriedNpc()) { deps.toast('抱著人不能進工寮，先放下', '#ffb08a'); return false; }
    deps.openShedDoor?.(nearShed);
    return false;
  }
  if (carryNpcOk && myCarriedNpc()) {
    const seat = nearPlace ?? (() => {
      const n = nearestFreePlaceSeat(deps!.getWalkXZ().x, deps!.getWalkXZ().z, takenSet(true), SIT_DIST);
      return n ? { pileId: n.pileId, slot: n.slot } : null;
    })();
    if (!seat) { deps.toast(`靠近空位再放下${npcWho(myCarriedNpc())}`, '#ffb08a'); return false; }
    return plazaDoPlace(seat);
  }
  if (carryNpcOk && nearCarry) return plazaDoCarry(nearCarry.connId);
  const seat = near ?? nearestFreeSeat(deps.getWalkXZ().x, deps.getWalkXZ().z, takenSet(true), SIT_DIST);
  if (!seat) { deps.toast('靠近空的藍色板凳再坐', '#ffb08a'); return false; }
  sittingBusy = true;
  const mg = isMgPile(seat.pileId);
  let paidMgMoney = false;
  /** 用碗內蚵肉當子彈：彈藥＝目前庫存；發射時才從碗扣 */
  let meatAmmo = 0;
  try {
    if (mg) {
      const meats = deps.getBowlStock();
      const wantMeat = mgPay === 'meat' || (mgPay === 'auto' && meats >= 1);
      if (wantMeat) {
        if (meats < 1) {
          deps.toast('碗裡沒有蚵仔肉，改花錢解鎖或先去剝一些', '#ffb08a');
          return false;
        }
        meatAmmo = meats;
      } else {
        if (deps.getMoney() < MG_SIT_PRICE) {
          deps.toast(`花錢上機要 $${MG_SIT_PRICE}（${MG_SIT_AMMO} 發），你錢不夠`, '#ffb08a');
          return false;
        }
        if (!deps.spendMoney(MG_SIT_PRICE, 'mg-sit')) {
          deps.toast(`花錢上機要 $${MG_SIT_PRICE}（${MG_SIT_AMMO} 發），你錢不夠`, '#ffb08a');
          return false;
        }
        paidMgMoney = true;
      }
    }
    const smoke = isSmokePile(seat.pileId);
    const first = !shiftStarted;
    // 蚵肉＝顆數；付錢＝MG_SIT_AMMO（伺服器 mgAmmo≤0 也會給付費發數）
    const claimAmmo = meatAmmo > 0 ? meatAmmo : MG_SIT_AMMO;
    const offlineAmmo = claimAmmo;
    // 離線：先在本機坐下；重連後 restoreAfterRejoin 會向伺服器補登記座位
    const r = !client?.connected
      ? { ok: true as const, err: undefined, snap: undefined, mg: mg ? { expireAt: Date.now() + MG_SIT_MS, ammo: offlineAmmo } : undefined }
      : first || myPile == null
      ? await client.claimSeat(seat.pileId, seat.slot, meatAmmo > 0 ? meatAmmo : 0)
      : await client.changeSeat(seat.pileId, seat.slot, meatAmmo > 0 ? meatAmmo : 0);
    if (!r.ok) {
      if (paidMgMoney) deps.spendMoney(-MG_SIT_PRICE, 'mg-sit-refund');
      deps.toast(zhErr(r.err), '#ff8a7a');
      if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
      return false;
    }
    if (r.snap) { snap = normalizeSnap(r.snap); view?.syncRoster(snap, deps.id); }
    if ((r as any).token && client) client.token = (r as any).token;
    myPile = seat.pileId; mySlot = seat.slot;
    const pose = seatPose(seat.pileId, seat.slot);
    deps.applySeatPose(pose.pos, pose.yaw);
    view?.highlight(seat.pileId, seat.slot);
    seated = true; near = null;
    syncSeatChrome();
    if (mg) {
      const info = (r as any).mg as { expireAt?: number; ExpireAt?: number; ammo?: number; Ammo?: number } | undefined;
      const ammo = typeof info?.ammo === 'number' ? info.ammo : (typeof info?.Ammo === 'number' ? info.Ammo : offlineAmmo);
      const fromMeat = meatAmmo > 0;
      mgFromMeat = fromMeat;
      // expireAt 必須是未來時間；0／缺欄位時用本機 90 秒，避免一上機就被踢
      const rawExp = Number(info?.expireAt ?? info?.ExpireAt ?? 0);
      const expireAt = Number.isFinite(rawExp) && rawExp > Date.now() + 2000 ? rawExp : (Date.now() + MG_SIT_MS);
      if (fromMeat) deps.toast(`碗裡 ${ammo} 顆蚵肉當子彈・發射才扣碗`, '#ffd76a');
      else deps.toast(`付 $${MG_SIT_PRICE} 上機・${ammo} 發（不扣碗內蚵肉）`, '#ffd76a');
      deps.enterMgSit(seat.slot, expireAt, ammo, fromMeat);
    } else if (smoke) deps.enterSmokeSit(seat.slot);
    else if (isRestPile(seat.pileId)) deps.enterRestSit(seat.slot);
    else if (first) { shiftStarted = true; deps.beginShift(seat.pileId, seat.slot); }
    else deps.resumeSit(seat.pileId, seat.slot);
    return true;
  } finally { sittingBusy = false; }
}

/** 站起：釋座並恢復走動（工班繼續） */
export async function plazaStandWalk() {
  if (!deps || !active || !seated) return;
  // 先 goWalk（仍留著 myPile／mySlot 算站起點），再清座位並通知伺服器
  seated = false;
  mgFromMeat = false;
  deps.goWalk();
  myPile = null; mySlot = null;
  view?.highlight(null, null);
  setHud(`${plazaHudPeople(snap)}　靠近空位坐下，不趕時間`);
  syncSeatChrome();
  await client?.leaveSeat();
  // 立刻把站起後座標推出去，避免遠端還停在椅上或飛向舊 Sync 點
  if (client?.connected && deps) {
    const p = deps.getWalkXZ();
    const lockLook = deps.getTpv?.() ?? false;
    void client.sync(
      p.x, p.z, deps.getYaw(), 'walk', deps.getBowlStock(), false, deps.getUmb(),
      lockLook ? 0 : (deps.getLookYaw?.() ?? 0),
      lockLook ? 0 : (deps.getPitch?.() ?? 0),
    );
  }
}

function sendChat() {
  const input = ui?.querySelector('#pzIn') as HTMLInputElement | null;
  if (!input || !client) return;
  const t = input.value.trim(); if (!t) return;
  input.value = '';
  void client.chat(t, false).then(r => { if (!r.ok) deps?.toast(zhErr(r.err), '#ff8a7a'); });
}

function chatRowKey(m: PlazaChat) {
  return `${m.at}|${m.pid || ''}|${m.nick}|${m.text}`;
}

function chatTagOf(m: PlazaChat) {
  if (m.tag) return m.tag;
  if (!m.pid || !snap) return '';
  const p = snap.players.find(x => x.pid === m.pid);
  return p?.tag || '';
}

function appendChatRow(m: PlazaChat) {
  const log = ui?.querySelector('#pzLog'); if (!log) return;
  const row = document.createElement('div');
  row.dataset.ck = chatRowKey(m);
  const where = m.pileId != null ? `[堆${m.pileId + 1}] ` : '';
  row.textContent = `${where}${plazaDisplayName(m.nick, chatTagOf(m))}：${m.text}`;
  log.appendChild(row);
  while (log.childElementCount > 40) log.firstChild?.remove();
  log.scrollTop = log.scrollHeight;
}

/** 進場／重連：用伺服器近期紀錄覆寫聊天窗（補離線空窗；不彈泡泡） */
function applyChatHistory(msgs?: PlazaChat[] | null) {
  const log = ui?.querySelector('#pzLog'); if (!log) return;
  if (!msgs?.length) return;
  const normalized = msgs.map(normChat).filter(m => m.text && m.via !== 'npc' && !(m.pid && m.pid.startsWith('npc-')));
  if (!normalized.length) return;
  log.innerHTML = '';
  for (const m of normalized) appendChatRow(m);
}

function pushChat(m: PlazaChat) {
  // 阿婆若誤走 Chat：只出氣泡，不進聊天窗
  if (m.via === 'npc' || (m.pid && m.pid.startsWith('npc-'))) {
    if (m.text) view?.showChat({ connId: m.connId || undefined, pid: m.pid || undefined, nick: m.nick, text: m.text });
    return;
  }
  const log = ui?.querySelector('#pzLog'); if (!log) return;
  const key = chatRowKey(m);
  // 與歷史回放重複則略過（避免重連後又收到同則即時包）
  if (Array.from(log.children).some(el => (el as HTMLElement).dataset.ck === key)) return;
  appendChatRow(m);
  const isSelf = Boolean(deps && (m.pid === deps.id || (!!m.connId && m.connId === client?.connectionId)));
  view?.showChat({ connId: m.connId || undefined, pid: m.pid || undefined, nick: m.nick, text: m.text, self: isSelf });
  // 僅發言端送 Discord；來自 Discord 的勿回貼（訊息已在頻道裡），避免迴圈
  if (isSelf && m.text && m.via !== 'discord')
    void postDiscordPlazaChat(m.nick || '剝蚵人', m.text, { pileId: m.pileId, tag: myTag() });
  // 縮小中：角標＋短暫預覽（不自動展開，避免打斷剝蚵）
  if (!isSelf && !plazaChatIsOpen()) {
    chatUnread = Math.min(99, chatUnread + 1);
    syncChatBadge();
    showChatPeek(plazaDisplayName(m.nick, m.tag) || '誰', m.text || '');
  }
}

/** 手機直向坐著時：聊天鈕移到「藥品／道具」正上方；地圖鈕固定 CSS 位置，坐下不改 */
let fabB = '';
function placeChatFab() {
  if (!ui) return;
  const portraitPhone = matchMedia('(pointer:coarse) and (orientation:portrait)').matches;
  let b = '';
  if (seated && portraitPhone) {
    const med = document.getElementById('medBtn');
    const r = med?.getBoundingClientRect();
    if (r && r.height > 0) b = `${Math.round(innerHeight - r.top + 8)}px`;
  }
  if (b === fabB) return;
  fabB = b;
  const fab = ui.querySelector('#pzChatFab') as HTMLElement | null;
  const peek = ui.querySelector('#pzChatPeek') as HTMLElement | null;
  const chat = ui.querySelector('#pzChat') as HTMLElement | null;
  const up = b ? `calc(${b} + 52px)` : '';
  if (fab) fab.style.bottom = b;
  if (peek) peek.style.bottom = up;
  if (chat) chat.style.bottom = up;
  // 地圖鈕不跟坐下位移；清掉可能殘留的 inline top/bottom
  const mapFab = ui.querySelector('#pzMapFab') as HTMLElement | null;
  if (mapFab) { mapFab.style.bottom = ''; mapFab.style.top = ''; }
}

function refreshPlazaMap() {
  if (!ui || !deps || !plazaMapIsOpen()) return;
  const cvs = ui.querySelector('#pzMapCvs') as HTMLCanvasElement | null;
  if (!cvs) return;
  const p = deps.getWalkXZ();
  const markers = buildPlazaMapMarkers(snap?.players ?? [], {
    pid: deps.id,
    x: p.x,
    z: p.z,
    yaw: deps.getYaw(),
    seated,
    nick: deps.nick(),
  });
  const wishPins = seatWishes.map(w => {
    const pose = seatPose(w.pileId, w.slot);
    const who = (w.npcNick || '阿婆').slice(0, 2);
    return { x: pose.pos.x, z: pose.pos.z, label: who };
  });
  drawPlazaMap(cvs, markers, wishPins);
}

export function plazaMapIsOpen() {
  return !!ui?.querySelector('#pzMap')?.classList.contains('open');
}
export function plazaLeaveAskIsOpen() {
  return !!ui?.querySelector('#pzLeaveAsk')?.classList.contains('open');
}
export function plazaCloseLeaveAsk() {
  ui?.querySelector('#pzLeaveAsk')?.classList.remove('open');
}
function plazaAskLeave() {
  if (!ui) return;
  plazaCloseMap();
  plazaCloseChat();
  closePlayersDrop();
  ui.querySelector('#pzLeaveAsk')?.classList.add('open');
}
function plazaLeaveNow() {
  if (shiftStarted) deps?.onExit();
  else { const exit = deps?.onExit; void closePlaza(true).then(() => exit?.()); }
}
export function plazaCloseMap() {
  ui?.querySelector('#pzMap')?.classList.remove('open');
}
export function plazaToggleMap() {
  if (!ui) return;
  const panel = ui.querySelector('#pzMap') as HTMLElement | null;
  if (!panel) return;
  if (panel.classList.contains('open')) { plazaCloseMap(); return; }
  plazaCloseChat();
  closePlayersDrop();
  panel.classList.add('open');
  refreshPlazaMap();
}

/** 自己蹲／躺／跳的程度，給抱著的阿婆調高度 */
export function plazaSetSelfBody(pz: string, pk: number, jy: number) { view?.setSelfBody(pz, pk, jy); }

/** 鏡頭／tpLook 更新後呼叫：木牆厝頂半透明（必須在 camTick 之後） */
export function tickPlazaTpOcclude(dt: number, camera: THREE.Camera, focus: THREE.Vector3) {
  if (!active || !view) return;
  view.tickTpOcclude(dt, camera, focus);
}

export function tickPlaza(dt: number) {
  if (!active || !deps) return;
  // walkPos（非鏡頭）驅動 zone streamer／視距；setSelfPose 寫入 view 後 tick 內串流
  const p = deps.getWalkXZ();
  const smokeSit = seated && myPile != null && isSmokePile(myPile);
  const restSit = seated && myPile != null && isRestPile(myPile);
  const mgSit = seated && myPile != null && isMgPile(myPile);
  view?.setSelfPose(p.x, p.z, deps.getYaw(), seated, smokeSit, client?.connectionId ?? '');
  {
    const cushOn = seated && parseCosmetics(deps.getCosmetics?.() || '').cushion;
    view?.setSelfCushion(seated && cushOn, myPile ?? -1, mySlot ?? -1);
  }
  // 本機機關槍：槍管跟鏡頭（含環視），避免大角度時槍管／準心分家
  if (mgSit && mySlot != null) {
    const lockLook = !!(deps.getTpv?.() ?? false);
    const lookYaw = lockLook ? 0 : (deps.getAimYaw?.() ?? deps.getLookYaw?.() ?? 0);
    const pitch = lockLook ? 0 : (deps.getPitch?.() ?? 0);
    view?.aimMg(mySlot, lookYaw, pitch);
  }
  tickPlazaTags(view, deps.camera(), dt);
  // 子彈飛行／命中（本機子彈才回報 MgHit；環境彈痕所有人都算）
  if (view?.mgFx) {
    const hit = view.mgFx.tick(dt, view.mgHitTargets(), plazaPileObs());
    if (hit && client?.connected) {
      void client.mgHit(hit.target.connId, hit.at.x, hit.at.y, hit.at.z);
    }
  }
  if (!seated) plazaUpdateNear(p.x, p.z);
  else nearShed = null;
  if (view) for (const d of SHED_DOORS) view.setShedDoorState(d.loc, { locked: !(deps.shedUnlocked?.(d.loc) ?? true), active: nearShed === d.loc });
  placeChatFab();
  if (plazaMapIsOpen()) refreshPlazaMap();
  if (!client?.connected) return;
  phaseTimer += dt;
  // ~10Hz 同步位置＋動作
  if (phaseTimer >= 0.1) {
    phaseTimer = 0;
    const yaw = deps.getYaw();
    const sp = deps.getSyncPhase?.();
    const phase = seated
      ? (mgSit ? 'mg' : smokeSit ? 'smoke' : restSit ? 'rest' : (sp ?? deps.getPhase()))
      : (sp === 'jump' || sp === 'crouch' || sp === 'lie' ? sp : 'walk');
    const moving = !seated && deps.getMoving();
    // 第三人稱（走動／坐下／躺著繞鏡頭）：鎖 look，身體朝向用 yaw；第一人稱坐下仍同步轉頭
    const lockLook = !!(deps.getTpv?.() ?? false);
    const lookYaw = lockLook ? 0 : (deps.getLookYaw?.() ?? 0);
    const pitch = lockLook ? 0 : (deps.getPitch?.() ?? 0);
    void client.sync(p.x, p.z, yaw, phase, deps.getBowlStock(), moving, deps.getUmb(), lookYaw, pitch);
  }
}

/** 收工／結算時藏廣場 UI（離開鈕、聊天、地圖），避免擋結果面板 */
export function plazaHideChrome(hide = true) {
  if (!ui) return;
  if (hide) { plazaCloseMap(); plazaCloseLeaveAsk(); }
  ui.style.display = hide ? 'none' : '';
}

export async function plazaReportEarn(raw: number, oysters: number, durationSec: number): Promise<number> {
  if (!client || !deps) return Math.max(0, Math.floor(raw));
  const r = await client.reportEarn(Math.floor(raw), oysters, durationSec);
  if (!r.ok) {
    deps.toast(zhErr(r.err) + '（暫用本機結算）', '#ffb08a');
    return Math.max(0, Math.min(plazaSoftCapClient(oysters, durationSec), Math.floor(raw)));
  }
  deps.track('plaza_reward', { amount: r.payout, via: 'plaza' });
  return r.payout;
}

export async function closePlaza(leaveSeat = true) {
  if (!active) return;
  const nick = deps?.nick() ?? '剝蚵人';
  const online = snap?.occupied ?? snap?.players?.filter((p) => !p.isNpc).length ?? null;
  const announceLeave = plazaIoAnnounced;
  // 先記住離開站位（含坐著離開的椅旁點），再清狀態
  if (deps?.persistPlazaSpawn) {
    if (seated && myPile != null && mySlot != null) {
      const pose = seatPose(myPile, mySlot);
      deps.persistPlazaSpawn({
        x: pose.pos.x + Math.sin(pose.yaw) * 0.55,
        z: pose.pos.z + Math.cos(pose.yaw) * 0.55,
        yaw: pose.yaw,
        pileId: myPile,
        slot: mySlot,
      });
    } else {
      const p = deps.getWalkXZ();
      deps.persistPlazaSpawn({ x: p.x, z: p.z, yaw: deps.getYaw() });
    }
  }
  active = false; seated = false; shiftStarted = false; netDown = false; plazaIoAnnounced = false;
  chatUnread = 0; hideChatPeek();
  clearReconnectTimer();
  syncPlazaPeopleHud();
  if (leaveSeat) await client?.leaveSeat();
  await client?.disconnect({ depart: true });
  client = null;
  view?.dispose(); view = null;
  ui?.remove(); ui = null;
  myPile = null; mySlot = null; snap = null; seatWishes = []; paidWishIds.clear(); deps = null; near = null; nearShed = null; nearCarry = null; nearPlace = null; carryNpcOk = false; flagOk = false; flagList = []; myFlagText = null;
  removeFlagBtn();
  if (announceLeave) void postDiscordPlazaPresence(nick, 'leave', { online: online != null ? Math.max(0, online - 1) : null, tag: myTag() });
}

export function plazaEndCleanup() {
  plazaHideChrome(true);
}
