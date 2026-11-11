import { HQ_SEAT_SLOT } from './plaza/layout';
import { qtyHtml, bindQty, getQty, resetQty } from './shop/qty';
import {
  initUpdate, postDiscordFeedback, installBackGuard, rbox, rboxEnv, crease, rcyl, setGeoLowDetail,
  importMove, escapeInApp, type Save, type Life, LIFE_KEYS, SAVE_V, START_MONEY,
  defaultSave, loadSave as loadSaveFrom, writeSave, todayKey, dayDiff, installNoZoom,
  eco, fetchEconomy, syncEconomyTables,
  cloudInit, cloudBoot, cloudTouch, cloudFlush, cloudMakeLink, cloudClaimLink, installCloudLifecycle, onCloudStatus,
} from './core';
import {
  createSkyDome, SHELL_GEOS, HALF_GEOS, greyPick, shellM, basinShellM, BASIN_SHELL_COLS,
  makeAma as makeAmaMesh, GOSSIP, PEEK, NAG_GIVEUP, NAG_STAB, NAG_CRACK, NAG_SLIP,
  SCOLD_HIT, SCOLD_SHELL, SCOLD_STEAL, GRUDGE, TURN_CHAT, PRAISE, NPC_DIFF_T, NPC_DEF, type NpcDef,
  DIFF, DIFF_W, LOCS, SEATS, type Seat,
  initWalkSeat, initWalkJoy, standUp, sitDown, walkStep, plazaEnterWalkPose,
  walking, nearSeat, walkPos, walkKeys, joy, walkMotion, walkTune,
  setWalking, setNearSeat, clearWalkInput,
  makeWorldLabel, renderSceneWithLocalAvatarOnTop, invalidateLocalAvatarCache, type WorldLabel,
  initYardScene, shedAnim, applyShedLook, showLand, getShedG, LAND,
} from './world';
import {
  checkCode, REDEEM_MESSAGES, type RedeemCodeDef, applyOutfitToRig, headTopLift,
  syncEqPreview, refreshEqPreview, stopEqPreview, ODD,
  type Slot, type Fx, type Eq, SLOTS, EQUIP, SETS,
  initMeds, initMedsUi, MEDS, medT, medM, medA, tickMeds, drawMeds, useMed, renderMedList, renderMedShop,
  initYardShop, GEAR, COSMETICS, KNIVES, UMBS, BOWLS, FLAG_PRICE_ITEMS,
  gearOn, knifeNow, umbNow, bowlNow, petNow, makeOysterBaby,
  fetchPrices, px, pxHtml, pxCd, openShopPx, payFor,
  ensureStarterWeapons, ownsWeapon, ownedWeaponIds, weaponNow,
  renderShop, getShopNewIds,
  initClothUi, eqOwned, setEquip, equipNow, wornIds, setsOn, slOn, fxAll, walkSpeedNow, stealHoldSeconds,
  migrateEquip, SCARED, applySleeve, sleeveGold, eqTex, eqSvg, figSvg,
  renderEquip, renderClothShop, shareOutfit, askSet, openEquip,
} from './shop';
import {
  Social, initAnnounce, featAnnounce, featDots, initFeedback, openFb, fbShow,
  initAchievements, achS, AS, ACHS, achTitle, achAdd, achBump, achShiftGot, clearAchShiftGot,
  achCheck, achDot, achOpen, achShift, type AchSave,
  type EvCfg, type EvOdd,
  initEvents, setEvShown, evMeat, evHud, evFinish, evLeft, evRender, evFetch, evFetchFrom,
  evStart, evAgain, evLbOpen, evCfg, evSkew, evShown,
  initSurvey, setSvPrompted, svFetch, svAlert, svRender, svOpen, svList, svPrompted,
  initTutorial, tut, TUT, tutMeat, tutGo, tutStart, tutEnd,
  initPersist, persist, initDaily, renderDaily, openDaily, claimDaily, checkReturn,
  initGifts, checkGifts, giftAlert, giftBadge, giftMsg, giftLabel, applyGift, renderGifts,
} from './meta';
import { ROOM_ENABLED, bindRoom, openRoomCreate, openRoomJoin, closeRoom, isRoomActive, roomSyncScore, roomRemainSec, currentRoomSnap, roomTick, roomTrySit, roomStandWalk, roomNearPrompt, roomSeated, roomWalkBodies } from './room';
import * as THREE from 'three';
import { openDeathmatch, isDeathmatchActive, shopWeapons, WEAPON_DEFS, isWeaponId, openWeaponPreview, closeWeaponPreview, weaponPreviewCss, DM_PRESETS, type WeaponId, type DmMode } from './deathmatch';
import {
  makePlayerAvatar, posePlazaHangArms, posePlazaWalkSwingArms, posePlazaWalkCycle, plazaGaitRate, posePlazaJump,
  posePlazaSit, posePlazaStand, posePlazaSmokeSit, easeSmokePuff, placePlazaArmChain,
  clearPlazaSmokeCig, ensurePlazaSmokeCig, getPlazaSmokeCig, posePlazaCarryHold,
  plazaJumpHeight, PLAZA_JUMP_DUR, applyPlazaBodyPose as applyBodyPose, type PlayerRig,
} from './dm/character';
import { makeMeshHelpers } from './dm/mesh';
import {
  plazaNearShed, SHED_DOORS, shedReturnSpawn, shedName,
  openPlaza, closePlaza, isPlazaActive, tickPlaza, plazaSetSelfBody, plazaReportEarn, plazaMySeat, plazaScoopWeights, plazaShiftStarted,
  plazaWalkBound, plazaWalkRect, plazaWalkClamp, plazaPileObs, plazaWalkBodies, plazaResolveEnterSpawn, plazaNearSeat, plazaNearPrompt, plazaCarrying, plazaTrySit, plazaStandWalk, plazaSeated, plazaSittingBusy,
  plazaHitPile, plazaMyPileOrigin, pileIsGrill, isSmokePile,
  plazaConnId, plazaAimTargets, plazaThrowAt, plazaShellFx, plazaShellReflect, plazaShellBlocked, plazaShellHit, plazaMoonNpc, plazaPlayThrowFx, plazaSendPuff, plazaStealFrom, plazaZhErr,
  plazaGrillPlace, plazaGrillFlip, plazaGrillTake, plazaGrillNearest, plazaGrillUpsertLocal, plazaGrillRemoveLocal,
  plazaEndCleanup, plazaHideChrome, plazaFocusChat, plazaCloseChat, plazaChatIsOpen,
  plazaToggleMap, plazaCloseMap, plazaMapIsOpen, plazaLeaveAskIsOpen, plazaCloseLeaveAsk, seatPose, plazaPushOutfit, plazaPushCosmetics,
  plazaRefreshFlagUi, plazaTrySetFlagText, plazaTryShowFlag, plazaTryRemoveFlag, plazaTryUpgradeFlag, plazaTrySelectFlag,
  type PlazaAimTarget, type PlazaShellEvent, type PlazaShellHitEvent, type PlazaGrillTakenEvent,
} from './plaza';
import { openShedDoorPanel, closeShedDoorPanel } from './plaza/shedDoorUi';
import { makeFpCigarette, makeExhalePuff, spawnAshSpeck, type FpCigarette, type CharcoalFireFx } from './plaza/fireFx';
import { GOLD_SMOKE_TINT, encodeCosmetics } from './plaza/cosmetics';
import { makeYardFloorMaps, GRILL_GRATE_Y, GRILL_NET_R } from './plaza/props';
import { registerBrightRenderer, setSceneBrightness, clampBright, BRIGHT_DEF } from './world/sceneBrightness';
import { initAudio, audio, applyMix, duckAmb, SFX, crackSound, ding, STATIONS, tone, noise, ac, sfxG, hasBgmTrack, musDebug } from './audio';
import {
  $, on, toast, initDomToast, tickToast,
  esc, bootQuiet, menuModalBusy, calTipOff, calTipCheck, initMenu, newDecor, newDots, newAnnounce,
} from './ui';
installNoZoom();
{ const s = document.createElement('style'); s.textContent = weaponPreviewCss(); document.head.appendChild(s); }
const LS_P = __PREVIEW__ ? 'preview:' : '';
const LS = { getItem: (k: string) => localStorage.getItem(LS_P + k), setItem: (k: string, v: string) => localStorage.setItem(LS_P + k, v), removeItem: (k: string) => localStorage.removeItem(LS_P + k) };
if (__PREVIEW__) document.addEventListener('DOMContentLoaded', () => { const t = document.createElement('div'); t.textContent = '預覽版'; t.style.cssText = 'position:fixed;left:0;bottom:0;z-index:99999;background:#d8402f;color:#fff4dc;font:bold 12px sans-serif;padding:2px 8px;pointer-events:none;box-shadow:2px -2px 0 #1b2a3a'; document.body.appendChild(t); });


// ---------- 基本設定 ----------
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // 截圖測試用
const SHIFT = 180;
let shiftLen = SHIFT; // 臨時工 60／120 秒
// 活動場景：後台排定的限時活動設定（只在活動那一工有值，收工就清掉，不會沿用舊設定）
/* EvOdd from eventsTypes */
/* EvCfg from eventsTypes */
let evRun: EvCfg | null = null, evToken: string | null = null, evLastId: number | null = null, evBusy = false;
/** 廣場多人：無 NPC、座位由 Hub 權威；進場先走動再坐下開剝 */
let plazaMode = false;
function setPlazaMode(v: boolean) {
  plazaMode = v;
  document.body.classList.toggle('plazaMode', v);
  updBaseFov();
  applyPlazaShadowMode();
  // 進／出廣場同時切 lamp.castShadow（applyEcoGfx 內部會讀 plazaMode）
  try { applyEcoGfx(); } catch { /* applyEcoGfx 尚未定義時忽略 */ }
}
let plazaPayWait: Promise<number> | null = null;
/** 廣場休閒：第一次坐下起算遊玩秒數（給結算／後端 softCap） */
let plazaPlayAt = 0;
/** 廣場坐下暫時開第三人稱（不寫入存檔偏好） */
let plazaForceTp = false;
let plazaHomeHide: THREE.Object3D[] = [];
/** 臨時工扣薪：見 eco.tempCut（後台可改） */
const COARSE = matchMedia('(pointer: coarse)').matches;
/** 啟動時讀省電（mix 稍後才完整載入；antialias 只能建 renderer 時定一次） */
const bootEco = (() => {
  try { const raw = JSON.parse(LS.getItem('oyster-mix') || '{}') || {}; if (typeof raw.eco === 'boolean') return raw.eco; } catch { /* */ }
  return COARSE;
})();
// 手機／省電：方塊取代圓角、圓柱少段（需在建場景幾何前）
setGeoLowDetail(bootEco || COARSE);
const canvas = $('c') as HTMLCanvasElement;
// 移動端／省電：mediump、關 AA、low-power GPU；一般 high-performance（powerPreference 僅建 renderer 時生效）
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !bootEco,
  powerPreference: bootEco ? 'low-power' : 'high-performance',
  precision: bootEco ? 'mediump' : 'highp',
  preserveDrawingBuffer: !!SHOT,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = bootEco ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
// 明亮溫暖晴天：暖日光＋柔藍天（去夢核灰／死板硬邊感）
scene.background = new THREE.Color(0xa8d0e8);
scene.fog = new THREE.Fog(0xd8e4dc, 18, 52);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
camera.rotation.order = 'YXZ';
scene.add(camera);
// 第三人稱另用一台鏡頭，遊戲邏輯照舊用 camera
const tpCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 200); let tpOn = false;
function viewCam() { return tpOn ? tpCam : camera; }
const SEAT0 = new THREE.Vector3(0, 1.05, 2.0), SEAT = SEAT0.clone();
camera.position.copy(SEAT);

type SurfMat = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
const mat = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}): SurfMat => {
  if (bootEco || COARSE) {
    const rest = { ...o } as Record<string, unknown>;
    for (const k of ['roughness', 'metalness', 'flatShading', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap', 'envMap', 'envMapIntensity']) delete rest[k];
    return new THREE.MeshLambertMaterial({ color: c, ...rest });
  }
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, flatShading: false, ...o });
};
function mesh(g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], parent: THREE.Object3D = scene) {
  const x = new THREE.Mesh(g, m); if (p) x.position.set(...p); x.castShadow = true; x.receiveShadow = parent === scene; parent.add(x); return x;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
// ---------- 場景：漁港邊的工寮（明亮溫暖） ----------
const hemi = new THREE.HemisphereLight(0xfff2e4, 0x7a9a78, 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8c4, 1.15); sun.position.set(-3, 11, -5); scene.add(sun);
const lamp = new THREE.PointLight(0xffe8c8, 14, 10, 1.6); lamp.position.set(0, 2.55, 0); lamp.castShadow = true; lamp.shadow.bias = -0.003; lamp.shadow.normalBias = 0.03; lamp.shadow.mapSize.set(bootEco ? 512 : 1024, bootEco ? 512 : 1024); scene.add(lamp);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc });
const yardFloor = makeYardFloorMaps(matchMedia('(pointer: coarse)').matches ? 256 : 384);
const ground = mesh(new THREE.PlaneGeometry(14, 14), bootEco || COARSE
  ? new THREE.MeshLambertMaterial({ map: yardFloor.map, color: 0xd8d2c4 })
  : new THREE.MeshStandardMaterial({
    map: yardFloor.map, roughnessMap: yardFloor.rough, color: 0xd8d2c4, roughness: 0.92, metalness: 0.02,
  })); ground.rotation.x = -Math.PI / 2; // 水泥地（貼皮）
// 柱仔頂的指針時鐘（跟著裝置時間）
const clockG = new THREE.Group(); clockG.position.set(3.5, 2.35, -3.5); scene.add(clockG); clockG.lookAt(0, 2.0, 2.0); clockG.translateZ(0.09);
mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), mat(0x6a4a2a), [0, 0, -0.02], clockG).rotation.x = Math.PI / 2;
mesh(new THREE.CircleGeometry(0.26, 24), mat(0xfff6dc, { emissive: 0xfff0c8, emissiveIntensity: 0.35 }), [0, 0, 0.01], clockG);
for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, L = i % 3 ? 0.03 : 0.06; mesh(new THREE.BoxGeometry(i % 3 ? 0.012 : 0.02, L, 0.005), mat(0x222222), [Math.sin(a) * (0.23 - L / 2), Math.cos(a) * (0.23 - L / 2), 0.015], clockG).rotation.z = -a; }
const hand = (len: number, w: number, c: number, z: number) => { const p = new THREE.Group(); p.position.z = z; clockG.add(p); mesh(new THREE.BoxGeometry(w, len, 0.006), mat(c), [0, len / 2 - 0.02, 0], p); return p; };
const clkH = hand(0.14, 0.022, 0x1a1a1a, 0.02), clkM = hand(0.2, 0.014, 0x1a1a1a, 0.026), clkS = hand(0.21, 0.006, 0xc0392b, 0.032);
mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8), mat(0x111111), [0, 0, 0.035], clockG).rotation.x = Math.PI / 2;
function updClock() { const d = new Date(), sec = d.getSeconds(), m = d.getMinutes() + sec / 60, h = (d.getHours() % 12) + m / 60; clkS.rotation.z = -sec / 60 * Math.PI * 2; clkM.rotation.z = -m / 60 * Math.PI * 2; clkH.rotation.z = -h / 12 * Math.PI * 2; }
updClock(); setInterval(updClock, 1000);
// 港口：碼頭、水、漁船（工寮用；進廣場會藏起，改用廣場北側碼頭船）
const harborDock = mesh(rboxEnv(14, 0.3, 3), mat(0x8a9088), [0, -0.15, -5.8]);
const water = mesh(new THREE.PlaneGeometry(80, 40), bootEco || COARSE
  ? new THREE.MeshLambertMaterial({ color: 0x4a98b8 })
  : new THREE.MeshStandardMaterial({ color: 0x4a98b8, roughness: 0.24, metalness: 0.18 }), [0, -0.5, -27]); water.rotation.x = -Math.PI / 2;
const skyDome = createSkyDome({ radius: 46, lo: matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 900px)').matches });
scene.add(skyDome.mesh);
const boats: THREE.Group[] = [];
const flagCols = [0xd03030, 0x2a5ad0, 0xf0c020, 0x30a050];
for (let i = 0; i < 5; i++) {
  // 船在碼頭外側水上（勿壓到工寮地／廣場走道）
  const g = new THREE.Group(); g.position.set(-8 + i * 4 + rnd(-0.5, 0.5), -0.45, -11.2 - (i % 2) * 2.4); g.rotation.y = rnd(-0.3, 0.3); scene.add(g);
  const hull = mesh(rboxEnv(3.2, 0.7, 1.1), mat([0xe8e8e0, 0x2a6ab0, 0xd8d0b0][i % 3]), [0, 0.35, 0], g);
  mesh(rboxEnv(3.25, 0.12, 1.15), mat(0xb03030), [0, 0.05, 0], g); void hull;
  mesh(rboxEnv(1.0, 0.6, 0.8), mat(0xf0f0e8), [0.6, 1.0, 0], g);
  mesh(rcyl(0.03, 0.03, 2.2, 4), mat(0x333333), [-0.6, 1.8, 0], g);
  for (let k = 0; k < 3; k++) mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ color: flagCols[(i + k) % 4], side: THREE.DoubleSide }), [-0.42, 2.7 - k * 0.3, 0], g);
  mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: [0xffe0a0, 0xff6040, 0x60ff80][i % 3] }), [0.6, 1.4, 0], g);
  boats.push(g);
}

// 中央蚵殼山（殼幾何／貼圖見 shells.ts）
const shellGeo = SHELL_GEOS[0], halfGeo = HALF_GEOS[0];
const shellMat = shellM(0xe8e4e0);
// 點擊撈蚵用：必須保留 mesh 參考（crease 後不再是 ConeGeometry，不能事後 find）
const pileHit = mesh(crease(new THREE.ConeGeometry(0.9, 0.55, 10)), mat(0x7a8ca0, { roughness: 0.95, emissive: 0x0a1018, emissiveIntensity: 0.12 }), [0, 0.27, 0]);
const pileMat = shellM(0xffffff); const pile = new THREE.InstancedMesh(shellGeo, pileMat, 260); pile.castShadow = !bootEco; pile.renderOrder = 0;
{ const d = new THREE.Object3D(); for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.0, h = Math.max(0, 0.55 * (1 - r / 0.95)); d.position.set(Math.cos(a) * r, h + 0.03, Math.sin(a) * r); d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); d.updateMatrix(); pile.setMatrixAt(i, d.matrix); pile.setColorAt(i, new THREE.Color(greyPick())); } }
scene.add(pile);
const pileSpot = () => { const a = Math.random() * 6.28, r = rnd(0.2, 0.7); return new THREE.Vector3(Math.cos(a) * r, 0.5 * (1 - r) + 0.05, Math.sin(a) * r); };
/** 蚵堆表面高度（與 InstancedMesh 堆形一致）＋墊高，讓碗像放在堆上 */
function pileSurfY(wx: number, wz: number, ox = 0, oz = 0) {
  const rad = Math.hypot(wx - ox, wz - oz);
  // 廣場蚵山略高／略陡（對齊 makeYardLikePile）；工寮中央堆用較緩曲線
  const crest = plazaMode
    ? Math.max(0, 0.58 * (1 - rad / 0.92)) + 0.03
    : Math.max(0, 0.55 * (1 - rad / 0.95)) + 0.03;
  return Math.max(0.16, crest + 0.08);
}
/** 取圓盤範圍內最高堆面，避免盆底卡進坡面殼堆 */
function pileSurfYMax(wx: number, wz: number, radius: number, ox = 0, oz = 0) {
  let y = pileSurfY(wx, wz, ox, oz);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    y = Math.max(y, pileSurfY(wx + Math.cos(a) * radius, wz + Math.sin(a) * radius, ox, oz));
  }
  return y;
}
function markBowlDrawOrder(root: THREE.Object3D) {
  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.renderOrder = 2; if (m.material) { const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const mat of mats) { const mm = mat as THREE.Material & { depthTest?: boolean }; mm.depthTest = true; } } } });
}

// 玩家前面：生蚵臉盆、裝肉的碗（點碗丟肉）；略靠近堆心，之後再依堆面抬高
const BASIN_H = 0.18;
const BASIN_R_TOP = 0.33;
const BASIN_R_BOT = 0.26;
/** 可撿蚵相對臉盆中心的高度：貼近盆底內側（勿用正值漂出盆緣） */
const BASIN_OY_Y = -BASIN_H / 2 + 0.048;
const basinMesh = mesh(new THREE.CylinderGeometry(BASIN_R_TOP, BASIN_R_BOT, BASIN_H, 16, 1, true), mat(0xc84030, { side: THREE.DoubleSide, roughness: 0.55 }), [-0.35, 0.1, 1.28]);
{
  // 臉盆底部（開管圓柱否則從上看穿空）
  const fl = new THREE.Mesh(
    new THREE.CylinderGeometry(BASIN_R_BOT * 0.98, BASIN_R_BOT * 0.98, 0.014, 16),
    mat(0xa03028, { side: THREE.DoubleSide, roughness: 0.7 }),
  );
  fl.position.y = -BASIN_H / 2 + 0.007;
  basinMesh.add(fl);
}
const BASIN0 = new THREE.Vector3(-0.35, 0.1, 1.28), BASIN = BASIN0.clone();
const basinOy: THREE.Mesh[] = [];
// 裝飾殼易與可撿蚵仔混淆（拿了還留在盆裡），改隱藏；可撿的是 basinOy
const basinShells = new THREE.InstancedMesh(shellGeo, pileMat, 1); basinShells.visible = false;
const seatRig = new THREE.Group(); scene.add(seatRig); seatRig.add(basinMesh, basinShells);
markBowlDrawOrder(basinMesh);
// 裝肉碗貼臉盆右側：間距約兩顆蚵殼短邊（短邊≈0.1）
const BOWL0 = new THREE.Vector3(0.35, 0.12, 1.22), BOWL = BOWL0.clone(); let BOWL_R = 0.17;
const bowlG = new THREE.Group(); seatRig.add(bowlG); const BOWL_L = BOWL0.clone();
const _liftPos = new THREE.Vector3(), _liftQ = new THREE.Quaternion(), _liftS = new THREE.Vector3(), _liftM = new THREE.Matrix4();
function buildBowl(b: { r: number; h: number; color: number; metal?: number }) {
  bowlG.clear(); const bot = b.r * 0.72;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(b.r + 0.03, bot, b.h, 22, 1, true), new THREE.MeshStandardMaterial({ color: b.color, side: THREE.DoubleSide, roughness: b.metal ? 0.25 : 0.45, metalness: b.metal ?? 0 }));
  wall.position.y = b.h / 2; bowlG.add(wall);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(b.r + 0.03, 0.012, 6, 24), wall.material); rim.rotation.x = Math.PI / 2; rim.position.y = b.h; bowlG.add(rim);
  // 實心底（薄圓柱，避免只剩一層圓片看不見／穿幫）
  const fl = new THREE.Mesh(
    new THREE.CylinderGeometry(bot * 0.98, bot * 0.98, 0.014, 18),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color).multiplyScalar(0.72), metalness: b.metal ?? 0, roughness: 0.55, side: THREE.DoubleSide }),
  );
  fl.position.y = 0.007;
  bowlG.add(fl);
  bowlG.position.set(BOWL_L.x, 0, BOWL_L.z); BOWL.y = Math.max(0.08, b.h - 0.02);
  markBowlDrawOrder(bowlG);
}
const bowlMeat: THREE.Mesh[] = [], splats: THREE.Mesh[] = [];
const meatMat = mat(0xd8cbb0, { roughness: 0.3, metalness: 0.1 }), splatMat = mat(0x8a8680, { roughness: 0.6 });
const meatGeo = new THREE.SphereGeometry(0.035, 8, 6); meatGeo.scale(1.4, 0.6, 1);

// ---------- 寵物（商店新分類：站在玩家右肩） ----------
/** petAnchor 直接掛 scene，每幀由 updatePetAnchor() 把它放到當前「玩家右肩世界位置」 */
const petAnchor = new THREE.Group();
petAnchor.rotation.order = 'YXZ'; // 躺姿要先轉 Y 再翻 X
scene.add(petAnchor);
let petMesh: THREE.Group | null = null;
let petCurId: string | null = null;
/** 蓄積秒數；AFK 期間不累積 */
let petAcc = 0;
/** 寵物睡覺狀態（AFK 時 true，掛機符號顯示） */
let petSleeping = false;
let petBob = 0;
function refreshPet() {
  const p = petNow();
  const wantId = p?.id ?? null;
  if (wantId === petCurId) return;
  if (petMesh) { petAnchor.remove(petMesh); petMesh = null; }
  petCurId = wantId;
  petAcc = 0; petSleeping = false;
  if (!wantId) return;
  if (wantId === 'pt_oyster_baby') petMesh = makeOysterBaby();
  if (petMesh) {
    // 肩上較小一隻，才不會蓋住頭
    petMesh.scale.setScalar(0.7);
    petAnchor.add(petMesh);
  }
  // 廣場模式下，也把寵物放到 cosmetics 字串，讓別人看得到
  if (isPlazaActive()) void plazaPushCosmetics();
}
function setPetSleeping(v: boolean) {
  if (petSleeping === v) return;
  petSleeping = v;
  const slp = (petMesh?.userData as any)?.sleep as THREE.Object3D | undefined;
  if (slp) slp.visible = v;
}

// ---------- 阿婆 ----------
const skin = 0xe8bc98;
const makeAma = (top: number, hair: number) => makeAmaMesh(top, hair, { mat, mesh, skin });
type Npc = ReturnType<typeof makeAma> & { name: string; rate: number; chatty: number; peek: boolean; count: number; pause: number; look: number; bubble: WorldLabel; bubT: number; lean: number;
  cyc: number; dur: number; ev: number; mood: number; angry: number; distract: number; turnDir: number; windup: number; w0?: number; warned?: boolean; throwCd: number; stuck: THREE.Mesh | null; baseY: number; basinN?: number; scoopT?: number; clutch?: number; grudge?: number; gAt?: number; tag: WorldLabel; tagTxt?: string; calm?: number; gIcon?: THREE.Sprite; gBar?: THREE.Sprite; bump?: THREE.Object3D; bumpT?: number; oy: THREE.Group; top: THREE.Mesh; meat: THREE.Mesh; bowl: THREE.Vector3; bowlMeat: THREE.Mesh[]; bowlM?: THREE.Object3D };
const npcs: Npc[] = [];
function makeNpc(d: NpcDef) {
  const a = makeAma(d.top, d.hair); const ang = Math.PI / 2 + d.a; const r = d.r ?? 1.9;
  a.g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); a.g.lookAt(0, 0, 0); a.g.rotateY(Math.PI); scene.add(a.g);
  const oy = new THREE.Group(); oy.position.set(0, -0.15, -0.32); a.armL.add(oy);
  mesh(halfGeo, shellM(0xe0dcd8), [0, 0, 0], oy);
  const meat = mesh(meatGeo, meatMat, [0, 0.025, 0], oy);
  const top = mesh(HALF_GEOS[npcs.length % 6], shellM(greyPick()), [0, 0.04, 0], oy);
  const kn = new THREE.Group(); kn.position.set(0, -0.18, -0.34); a.armR.add(kn);
  mesh(rboxEnv(0.03, 0.03, 0.09), mat(0x7a4a20), [0, 0, 0], kn);
  mesh(rboxEnv(0.02, 0.006, 0.09), mat(0xd0d0d8, { metalness: 0.8, roughness: 0.25 }), [0, 0, -0.09], kn);
  const bowlL = new THREE.Vector3(0.32, 0, -0.42); const bowl = a.g.localToWorld(bowlL.clone());
  const npcBowlY = pileSurfY(bowl.x, bowl.z);
  const npcBowlH = 0.1;
  const bowlM = mesh(new THREE.CylinderGeometry(0.13, 0.09, npcBowlH, 14, 1, true), mat(0xdddddd, { side: THREE.DoubleSide }), [bowl.x, npcBowlY + npcBowlH / 2, bowl.z]);
  {
    const fl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.012, 14),
      mat(0xb8b8b8, { side: THREE.DoubleSide, roughness: 0.55 }),
    );
    fl.position.y = -npcBowlH / 2 + 0.006;
    bowlM.add(fl);
  }
  markBowlDrawOrder(bowlM);
  bowl.y = npcBowlY + 0.05;
  // 掛 scene、每幀對齊頭世界座標（勿掛 head，轉頭會把 +Y 偏移帶歪）
  const tag = makeWorldLabel(d.name, 'name', { worldH: 0.2 });
  tag.sprite.visible = false; scene.add(tag.sprite);
  const bubble = makeWorldLabel(' ', 'bubble', { worldH: 0.32 });
  bubble.sprite.visible = false; scene.add(bubble.sprite);
  npcs.push({ ...a, tag, name: d.name, rate: d.rate, chatty: d.chatty, peek: d.peek, count: 0, pause: 0, look: 0, bubble, bubT: 0, lean: 0, cyc: Math.random(), dur: d.rate, ev: 0, mood: 0, angry: 0, distract: 0, turnDir: 1, windup: 0, throwCd: rnd(15, 30), stuck: null, baseY: 0, oy, top, meat, bowl, bowlMeat: [], bowlM });
}
for (const d of NPC_DEF) makeNpc(d);
function say(n: Npc, t: string, dur = 3.2) {
  if (ac) SFX.murmur([300, 230, 380][npcs.indexOf(n)] ?? 300);
  // force：同一句／連續講話也要蓋掉舊貼圖
  n.bubble.setText(t, true);
  n.bubble.setOpacity(1);
  n.bubble.sprite.visible = true;
  n.bubT = dur;
}
const _warnRel = new THREE.Vector3(), _warnFwd = new THREE.Vector3(), _tagHit = new THREE.Vector3();
/** 點名牌開 tip（螢幕距離，比 Sprite raycast 穩） */
function hitNpcTag(cx: number, cy: number): Npc | null {
  let best: Npc | null = null, bestD = 56;
  for (const n of npcs) {
    if (!n.tag.sprite.visible || !n.g.visible) continue;
    n.tag.sprite.getWorldPosition(_tagHit); _tagHit.project(viewCam());
    if (_tagHit.z > 1) continue;
    const sx = (_tagHit.x * .5 + .5) * innerWidth, sy = (-_tagHit.y * .5 + .5) * innerHeight;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}
let lastNag = '';
function nag(lines: string[]) {
  if (!npcs.length) return;
  if (Math.random() > (evRun ? Math.max(1, seatNow().nag) : seatNow().nag) * fxAll().nag) return;
  let t = pick(lines); while (t === lastNag && lines.length > 1) t = pick(lines); lastNag = t;
  const n = npcs.find(x => x.peek && Math.random() < 0.5) ?? pick(npcs); if (!n) return;
  n.look = 2.5; say(n, t, 3);
}

// ---------- 玩家的雙手（掛佇鏡頭） ----------
const handRig = new THREE.Group(); camera.add(handRig);
const sleeve = mat(0x3a5a8a), shirtCuff = mat(0xe8e4d8);
const handSkin = mat(skin), cuffMat = mat(0x3a6fc0); cuffMat.visible = false;
const fingerMeshes: THREE.Mesh[] = [];
function applyGloves() {
  const g = gearOn('glove');
  handSkin.color.set(g ? 0xe8e4d8 : skin);
  if (handSkin instanceof THREE.MeshStandardMaterial) handSkin.roughness = g ? 1 : 0.85;
  cuffMat.visible = g;
  fingerMeshes.forEach(f => f.scale.set(g ? 1.25 : 1, g ? 1.2 : 1, g ? 1.05 : 1));
  applyGlasses();
}
function applyGlasses() { const g = gearOn('glasses'); (seamMark.material as THREE.MeshBasicMaterial).color.set(g ? 0xe8a050 : 0x7a4a1e); seamMark.scale.setScalar(g ? 1.7 : 1); seamGlow.scale.setScalar(g ? 1.6 : 1); document.getElementById('vign')?.classList.toggle('on', g && state === 'play'); }
function makeHand(s: number) {
  const h = new THREE.Group();
  mesh(rcyl(0.05, 0.065, 0.7, 8), sleeve, [0, 0, 0.32], h).rotation.x = Math.PI / 2; // 長前臂延伸到畫面角落，兩手呈 A 字
  mesh(rbox(0.11, 0.05, 0.13), handSkin, [0, 0, -0.1], h);
  mesh(rcyl(0.068, 0.068, 0.06, 8), shirtCuff, [0, 0, 0.66], h).rotation.x = Math.PI / 2;
  mesh(rcyl(0.062, 0.062, 0.035, 8), cuffMat, [0, 0, -0.03], h).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const f = mesh(rbox(0.022, 0.03, 0.07), handSkin, [-0.04 + i * 0.026, -0.01, -0.19], h); f.userData.finger = true; }
  const th = mesh(rbox(0.03, 0.03, 0.07), handSkin, [s * -0.06, 0, -0.12], h); th.rotation.y = s * 0.6; th.userData.finger = true;
  return h;
}
const handL = makeHand(-1), handR = makeHand(1);
[handL, handR].forEach(h => h.children.forEach(c => { const m = c as THREE.Mesh; if (m.material === handSkin && m.userData.finger) fingerMeshes.push(m); }));
const HL = new THREE.Vector3(-0.16, -0.24, -0.42);
handL.position.copy(HL); handL.rotation.set(0.4, -0.5, 0.3);
handR.position.set(0.2, -0.26, -0.45); handR.rotation.set(0.3, 0.5, -0.2);
handRig.add(handL, handR);
let knifeK = 0; const _kt = new THREE.Vector3(), _kg = new THREE.Vector3(), _ko = new THREE.Vector3(0.05, 0.015, 0);
const knife = new THREE.Group(); handR.add(knife); knife.position.set(-0.02, 0.03, -0.18); knife.rotation.set(0, 0.9, 0);
mesh(rcyl(0.018, 0.02, 0.11, 6), mat(0x7a4a20), [0, 0, 0], knife).rotation.z = Math.PI / 2;
mesh(rboxEnv(0.1, 0.006, 0.025), mat(0xd0d0d8, { metalness: 0.8, roughness: 0.25 }), [-0.1, 0, 0], knife);
const oyster = new THREE.Group(); handL.add(oyster); oyster.position.set(0.02, 0.05, -0.16);
const shellBotMat = shellM(0xe0dcd8), shellTopMat = shellM(0xf0ecea);
const shellBot = mesh(halfGeo, shellBotMat, [0, -0.01, 0], oyster);
const meatInHand = mesh(meatGeo, meatMat, [0, 0.015, 0], oyster);
/** 烤蚵鉸鏈：上殼一邊連接下殼，繞此軸掀開 */
const grillHinge = new THREE.Group(); oyster.add(grillHinge);
const shellTop = mesh(halfGeo, shellTopMat, [0, 0.025, 0], oyster);
const barnacles: THREE.Mesh[] = [];
// 難度硬塊＝藤壺／石灰質附著：火山口形（頂端有洞）的低面數旋轉體，共用一個幾何和材質
const BARN_GEO = (() => { const g = new THREE.LatheGeometry([[0, 0.004], [0.0035, 0.005], [0.0042, 0.016], [0.0068, 0.0175], [0.0105, 0.009], [0.0135, 0.002], [0.0142, -0.004]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
  const p = g.attributes.position; let r = 3; const rn = () => (r = (r * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.006) { const k = 1 + (rn() - 0.5) * 0.35; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } g.computeVertexNormals(); const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const y = p.getY(i), rr = Math.hypot(p.getX(i), p.getZ(i)); const d = rr < 0.0045 ? 0.25 : y > 0.012 ? 0.8 : 1; col[i * 3] = d; col[i * 3 + 1] = d * 0.92; col[i * 3 + 2] = d * 0.85; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; })();
const BARN_MAT = mat(0x9a7a64, { vertexColors: true, roughness: 0.6, emissive: 0x0a0c10, emissiveIntensity: 0.12 });
const BARN_N = [0, 4, 8, 14], BARN_S = [0.8, 0.9, 1.15, 1.4];
// 一群一群長：先挑幾個群中心，每群 1～4 顆大小不一、彼此擠在一起
function placeBarn(list: THREE.Object3D[], dd: number, y = 0.045) {
  const n = Math.min(list.length, BARN_N[dd]); let ci = 0, cx = 0, cz = 0, left = 0;
  list.forEach((b, i) => { b.visible = i < n; if (i >= n) return;
    if (left <= 0) { cx = rnd(-0.07, 0.07); cz = rnd(-0.045, 0.045); left = 1 + Math.floor(Math.random() * (dd + 1)); ci++; }
    left--; const sc = BARN_S[dd] * rnd(0.55, 1.25); b.position.set(cx + rnd(-0.014, 0.014) * BARN_S[dd], y - 0.002 + Math.random() * 0.004, cz + rnd(-0.012, 0.012) * BARN_S[dd]);
    b.scale.set(sc * rnd(0.85, 1.15), sc * rnd(0.7, 1.2), sc * rnd(0.85, 1.15)); b.rotation.set(rnd(-0.35, 0.35), rnd(0, 6.28), rnd(-0.35, 0.35)); });
}
mesh(new THREE.CircleGeometry(0.075, 14), mat(0xeeeae4, { roughness: 0.35, metalness: 0.15 }), [0, 0.008, 0], oyster).scale.set(1.25, 0.9, 1); (oyster.children[oyster.children.length - 1] as THREE.Mesh).rotation.x = -Math.PI / 2;
for (let i = 0; i < 16; i++) barnacles.push(mesh(BARN_GEO, BARN_MAT, [0, 0.02, 0], shellTop)); // 藤壺長在上蓋：撬開後跟著上蓋一起移走
const seamMark = mesh(new THREE.BoxGeometry(0.042, 0.016, 0.016), new THREE.MeshBasicMaterial({ color: 0x7a4a1e }), [0, 0.012, 0], oyster);
const seamRing = mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 24), new THREE.MeshBasicMaterial({ color: 0xd8ff80, transparent: true, opacity: 0, depthWrite: false }), [0, 0.02, 0], oyster); seamRing.rotation.x = Math.PI / 2; seamRing.visible = false;
let sweet = false, sweetT = 0;
const seamGlow = mesh(new THREE.BoxGeometry(0.062, 0.026, 0.026), new THREE.MeshBasicMaterial({ color: 0xffc878, transparent: true, opacity: 0, depthWrite: false }), [0, 0.012, 0], oyster);
// 縫提示後畫，避免被手擋住；不可把手／刀的 depthWrite 關掉，否則工寮桌面和牆會蓋住第一人稱雙手
seamMark.renderOrder = seamGlow.renderOrder = seamRing.renderOrder = 12;
// 縫提示對準刀時正好在第一人稱拿刀的手底下；手會寫深度（見 4ea3c9e），透明提示永遠在不透明物之後畫，renderOrder 擋不住。
// 縫在朝鏡頭那半邊就關深度測試，直接蓋在手／刀／蚵殼上；轉到背面再恢復，避免穿透蚵仔看到背面的縫。
const _seamW = new THREE.Vector3(), _seamO = new THREE.Vector3(), _seamC = new THREE.Vector3();
let seamOnTop = false;
function syncSeamOnTop(cam: THREE.Camera) {
  const par = seamGlow.parent ?? oyster;
  seamGlow.getWorldPosition(_seamW); par.getWorldPosition(_seamO); cam.getWorldPosition(_seamC);
  const on = _seamW.sub(_seamO).dot(_seamC.sub(_seamO)) > 0;
  if (on === seamOnTop) return;
  seamOnTop = on;
  for (const o of [seamMark, seamGlow, seamRing]) (o.material as THREE.Material).depthTest = !on;
}
const shimmer = mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0, 0], oyster);
const pearlMesh = mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.3 }), [0, 0.05, 0], oyster);
pearlMesh.visible = false;
const leanFaces: THREE.Group[] = [];
for (const s of [-1, 1]) { const f = makeAma(s < 0 ? 0x3a9a6a : 0xe86878, s < 0 ? 0x444444 : 0xc8c8c8).head; f.removeFromParent(); f.rotation.y = Math.PI; f.scale.setScalar(1.3); camera.add(f); f.userData.s = s; f.position.set(s * 1.2, 0.05, -0.75); leanFaces.push(f); }

// ---------- 音效（全部 WebAudio 即時合成，無外部音檔） ----------
type Mix = { master: number; amb: number; sfx: number; mute: boolean ; music: number; gore: boolean; stats: boolean; feed: boolean; sens: number; invX: boolean; invY: boolean; eco: boolean; rotTip: boolean; bright: number };
const MIX_DEF = { master: 0.8, amb: 0.6, sfx: 0.8, mute: false, music: 0.35, gore: true, stats: true, feed: true, sens: 1, invX: false, invY: false, eco: COARSE, rotTip: true, bright: BRIGHT_DEF };
const mix: Mix = (() => { let raw: any = {}; try { raw = JSON.parse(LS.getItem('oyster-mix') || '{}') || {}; } catch { raw = {}; }
  const m: any = { ...MIX_DEF }; for (const k of Object.keys(MIX_DEF) as (keyof typeof MIX_DEF)[]) if (typeof raw[k] === typeof MIX_DEF[k]) m[k] = raw[k]; m.bright = clampBright(m.bright); return m; })();
/** 廣場陰影不每幀重算（約 4 次／秒）；工寮仍每幀更新 */
let plazaShadowAcc = 0;
function applyPlazaShadowMode() {
  if (mix.eco) {
    renderer.shadowMap.autoUpdate = false;
    return;
  }
  if (plazaMode) {
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    plazaShadowAcc = 0;
  } else {
    renderer.shadowMap.autoUpdate = true;
  }
}
/** 熱切省電：關陰影、降 DPR；antialias／precision 僅啟動時套用 */
function applyEcoGfx() {
  // 手機：省電 1.25×／一般 1.5×（與 resize 一致）；桌面上限 2×（手機 DPR 常 2-3，再多等於燒電不加清晰度）
  const dprCap = COARSE ? (mix.eco ? 1.25 : 1.5) : (mix.eco ? 1.5 : 2);
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  // 廣場靠自發光＋烘焙暖光，關掉整條 shadow pipeline：每個像素的 shader 不再做 shadow 取樣（這是手機最大的像素端耗電來源之一）
  renderer.shadowMap.enabled = !mix.eco && !plazaMode;
  // 手機非省電：PCF 軟陰影在行動 GPU 太貴，改 Basic
  renderer.shadowMap.type = mix.eco ? THREE.BasicShadowMap : (COARSE ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap);
  // 廣場模式工寮燈已經 intensity=0，castShadow 保持 true 會每 0.25s 跑全場 depth pass
  lamp.castShadow = !mix.eco && !plazaMode;
  const map = mix.eco ? 512 : 1024;
  lamp.shadow.mapSize.set(map, map);
  lamp.shadow.map?.dispose();
  lamp.shadow.map = null;
  applyPlazaShadowMode();
  try { updSky(); } catch { /* 啟動時 sky／mix 尚未就緒 */ }
}
applyEcoGfx();
registerBrightRenderer(renderer);
setSceneBrightness(mix.bright);
// ---------- 匿名統計（無個資；可於設定關閉） ----------
const STATS_URL = 'https://game-status.gwtech.org/e';
const statsId = (() => { try { let v = LS.getItem('oyster-stats-id'); if (!v) { v = crypto.randomUUID(); LS.setItem('oyster-stats-id', v); } return v; } catch { return 'anon-' + Math.random().toString(36).slice(2, 14); } })();
cloudInit(statsId, LS);
importMove().then(async moved => {
  if (moved) return;
  const pulled = await cloudBoot();
  if (pulled) return;
  escapeInApp(statsId);
});
installCloudLifecycle();
let statsSid = '';
const statsDevice = COARSE ? 'mobile' : 'pc';
function track(t: string, d: Record<string, unknown> = {}) {
  if (!mix.stats || SHOT) return;
  try {
    const body = JSON.stringify({ game: 'oyster-sim', id: statsId, platform: 'web', version: __BUILD__, test: __PREVIEW__ || params.get('stattest') === '1', events: [{ t, sid: statsSid || statsId, ts: Date.now(), dev: statsDevice, ...d }] });
    fetch(STATS_URL, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' }).catch(() => { });
  } catch { }
}

const radioSt = () => ((save.radioSt ?? 0) % STATIONS.length + STATIONS.length) % STATIONS.length;
function pickTrack(): string {
  if (isDeathmatchActive()) return 'dm';
  if (state !== 'play' || tut) return 'temple';
  if (plazaMode || (save.loc === 'plaza' && !shedTrip)) return 'plaza';
  if (gearOn('radio')) return STATIONS[radioSt()].id;
  if (evRun) return 'event';
  const id = locNow().id; return hasBgmTrack(id) ? id : 'home';
}
initAudio({
  getMix: () => mix,
  persistMix: () => { try { LS.setItem('oyster-mix', JSON.stringify(mix)); cloudTouch(); } catch { } },
  pickTrack,
  rnd,
});
(window as any).__mus = musDebug;

// ---------- 難度、珍珠、奇物、存檔 ----------
/** 好友房：房間指定場景（不看自己有沒有解鎖） */
let roomLoc: string | null = null, roomPlay = false;
/** 從廣場北碼頭走進工寮：這一趟的地點（不改主選單選的地點），結束回廣場 */
let shedTrip: { loc: string } | null = null;
/** 廣場已有收入時先結算，結算畫面按「前往」再去工寮 */
let pendingShed: { loc: string; len: number } | null = null;
const locNow = () => (roomLoc ? LOCS.find(l => l.id === roomLoc) : undefined) ?? (shedTrip ? LOCS.find(l => l.id === shedTrip!.loc) : undefined) ?? LOCS.find(l => l.id === save.loc && (l.need === 0 || save.locs?.includes(l.id))) ?? LOCS[0];
const locW = () => locNow().w;
const RAR = [
  { name: '白珍珠', color: 0xf4f1ea, css: '#f4f1ea', w: 70, price: 200, emo: '⚪', tease: '最常見的珍珠，多剝幾顆就有' },
  { name: '粉珍珠', color: 0xf3b5c8, css: '#f3b5c8', w: 20, price: 600, emo: '🩷', tease: '聽說有粉紅色的，很漂亮' },
  { name: '金珍珠', color: 0xf2c440, css: '#f2c440', w: 8, price: 1800, emo: '🟡', tease: '金光閃閃的…有人說過' },
  { name: '黑珍珠', color: 0x22202a, css: '#3a3548', w: 2, price: 6000, emo: '⚫', tease: '傳說中的黑色寶貝，剝一輩子才看到一次' },
];
const dexN = () => save.dex.filter(x => x).length + save.odd.filter(x => x).length;
const rarOf = (w: number) => w <= 2 ? 'legend' : w <= 10 ? 'rare' : w <= 20 ? 'uncommon' : 'common';
// 入碗工錢／俐落加給：預設見 eco（後台「賺錢設定」可改）
const DSHORT = ['易', '普', '硬', '超硬'];
let meatPay = 0, dCnt = [0, 0, 0, 0];
// 新手保護：生涯收工未滿 3 班 → 只出易／普通、綠區 +30%、割手率 -40%
const newbie = () => !tut && save.days < 3;
// 統計：本班各難度 [開殼, 插刀失敗, 割手, 殼碎]、收工原因
let dStat = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], endReason = 'time';
const dstatStr = () => dStat.flat().join(',');
// ----- 存檔（型別／讀寫見 save.ts；寫入門面見 meta/persist） -----
function loadSave(): Save { return loadSaveFrom(LS); }
const save: Save = loadSave();
initPersist({
  write: () => writeSave(LS, save),
  cloudTouch,
  achCheck,
});
initDaily({
  getSave: () => save,
  persist,
  renderDex: () => renderDex(),
  track,
  giftMsg: (ok, title, lines) => giftMsg(ok, title, lines),
  menuModalBusy: () => !!menuModalBusy(),
  rarOf,
  legendSync: () => legendSync(),
  legendPick: () => legendPick(),
  legendTotal: () => legendTotal(),
  audio,
  tone,
});
persist();
let dry = 0;
const itemW = (x: { w?: number; weight?: number }) => x.weight ?? x.w ?? 0;
const wpick = (arr: { w?: number; weight?: number }[]) => { let r = Math.random() * arr.reduce((s, x) => s + itemW(x), 0); for (let i = 0; i < arr.length; i++) { r -= itemW(arr[i]); if (r < 0) return i; } return 0; };
// 幸運值：每點 找著機率 ×(1+0.12×luck)；非普通物件權重 ×(1+0.15×luck)，傳說最多 ×1.3
const luckNow = () => Math.max(0, (knifeNow().luck || 0) + medA('luck') + fxAll().luck);
const luckW = (arr: { w?: number; weight?: number }[], l: number) => arr.map(x => { const w = itemW(x); return { w: w <= 2 ? w * Math.min(1.3, 1 + 0.15 * l) : w <= 20 ? w * (1 + 0.15 * l) : w }; });
// 傳說保底：連續 LEGEND_PITY 顆沒開到傳說（黑珍珠／傳說奇物，不含活動限定），下一次中奇物必定是傳說奇物（優先沒收集過的）
const LEGEND_PITY = 600;
let pityHit = false;
const LEGEND_ODD = ODD.map((o, i) => ({ o, i })).filter(x => x.o.weight > 0 && x.o.weight <= 2 && !x.o.limited).map(x => x.i);
const legendTotal = () => (save.dex[3] ?? 0) + LEGEND_ODD.reduce((a, i) => a + (save.odd[i] ?? 0), 0);
function legendSync() { const n = legendTotal(); if (save.legendN === undefined || n !== save.legendN) { if (save.legendN !== undefined && n > save.legendN) save.legendDry = 0; save.legendN = n; } }
function legendPick() { const miss = LEGEND_ODD.filter(i => !(save.odd[i] > 0)); const L = miss.length ? miss : LEGEND_ODD; return L[Math.floor(Math.random() * L.length)]; }
function rollFind(): { kind: 'pearl' | 'odd' | 'none'; i: number } {
  legendSync(); save.legendDry = (save.legendDry ?? 0) + 1; const pity = save.legendDry >= LEGEND_PITY;
  const l = luckNow(), f = 1 + 0.12 * l;
  const p = (1 / 50 + Math.max(0, dry - 40) * 0.01) * f * fxAll().pearl;
  if (Math.random() < p) { dry = 0; return { kind: 'pearl', i: wpick(luckW(RAR, l)) }; }
  // 新手：普通／少見（權重 ≥20）額外 +1.5 倍機率 → 合計約 ×2.5；稀有／傳說不加
  const common = (arr: { w?: number; weight?: number }[]) => luckW(arr, l).map((x, i) => ({ w: itemW(arr[i]) >= 20 ? x.w : 0 }));
  if (newbie() && Math.random() < p * 1.5) { dry = 0; return { kind: 'pearl', i: wpick(common(RAR)) }; }
  dry++;
  if (Math.random() < (1 / 24) * f) { if (pity) { pityHit = true; return { kind: 'odd', i: legendPick() }; } return { kind: 'odd', i: wpick(luckW(ODD, l)) }; }
  if (newbie() && Math.random() < (1 / 24) * f * 1.5) { if (pity) { pityHit = true; return { kind: 'odd', i: legendPick() }; } return { kind: 'odd', i: wpick(common(ODD)) }; }
  // 保底：第一班到第 5 顆還沒找到東西 → 給一顆白珍珠
  if (!tut && save.days === 0 && opened >= 4 && !dayPearls.length && !dayOdd.length) { dry = 0; return { kind: 'pearl', i: 0 }; }
  return { kind: 'none', i: 0 };
}

// 奇物模型
const oddMeshes: THREE.Object3D[] = ODD.map((o, i) => {
  const g = new THREE.Group(); oyster.add(g); g.position.set(0, 0.05, 0); g.visible = false;
  if (i === 0) { mesh(new THREE.BoxGeometry(0.07, 0.02, 0.03), mat(0xe89a9a), [0, 0, 0], g); for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.011, 0.018, 0.012), mat(0xffffff), [-0.028 + k * 0.014, 0.017, -0.01], g); }
  if (i === 1) mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 16), mat(0xb0b0b8, { metalness: 0.7, roughness: 0.3 }), [0, 0, 0], g);
  if (i === 2) { const r = mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), mat(0xf2c440, { metalness: 0.9, roughness: 0.2 }), [0, 0.01, 0], g); r.rotation.x = 1.2; mesh(new THREE.OctahedronGeometry(0.01), mat(0xffffff, { roughness: 0.1 }), [0, 0.034, 0], g); }
  if (i === 3) { const b = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xd04a2a), [0, 0, 0], g); b.scale.y = 0.5; for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.016, 6, 5), mat(0xe05a3a), [s * 0.045, 0.005, -0.03], g); for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), mat(0xc04a2a), [s * 0.04, -0.005, -0.01 + k * 0.015], g); } }
  if (i >= 4) { const c = parseInt(o.color.slice(1), 16), M = mat(c, { roughness: 0.5 });
    if (o.name.includes('發票')) { const b = mesh(new THREE.BoxGeometry(0.05, 0.002, 0.07), M, [0, 0.005, 0], g); b.rotation.z = 0.15; }
    else if (o.name.includes('銅板')) for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 14), mat(c, { metalness: 0.8, roughness: 0.3 }), [k * 0.02 - 0.02, k * 0.004, k % 2 * 0.01], g);
    else if (o.name.includes('鎖匙')) { mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 12), mat(c, { metalness: 0.8 }), [-0.02, 0, 0], g).rotation.x = Math.PI / 2; mesh(new THREE.BoxGeometry(0.04, 0.004, 0.008), mat(c, { metalness: 0.8 }), [0.012, 0, 0], g); }
    else if (o.name.includes('吸管')) mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), M, [0, 0.01, 0], g).rotation.z = Math.PI / 2.4;
    else if (o.name === '紅包') { mesh(new THREE.BoxGeometry(0.04, 0.006, 0.065), M, [0, 0.005, 0], g); mesh(new THREE.BoxGeometry(0.016, 0.007, 0.016), mat(0xf2c440, { metalness: 0.7 }), [0, 0.006, 0], g); }
    else if (o.name.includes('平安符')) { mesh(new THREE.BoxGeometry(0.03, 0.004, 0.05), mat(0xe8b030), [0, 0.005, 0], g); mesh(new THREE.BoxGeometry(0.02, 0.005, 0.012), mat(0xc0302a), [0, 0.006, 0.012], g); }
    else if (o.name === '筊杯') for (const sx of [-1, 1]) { const h = mesh(new THREE.SphereGeometry(0.022, 10, 6, 0, Math.PI), M, [sx * 0.018, 0.008, 0], g); h.scale.set(0.6, 1, 1.4); h.rotation.set(-Math.PI / 2, 0, sx * 0.3); }
    else if (o.name.includes('電鍋')) { mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.035, 16), M, [0, 0.018, 0], g); mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 16), mat(0xf4f0e8), [0, 0.038, 0], g); mesh(new THREE.SphereGeometry(0.006, 6, 4), mat(0x222222), [0, 0.044, 0], g); }
    else if (o.icon) { const b = mesh(new THREE.SphereGeometry(0.028, 10, 8), M, [0, 0.012, 0], g); b.scale.y = 0.55; mesh(new THREE.BoxGeometry(0.02, 0.012, 0.02), mat(0xffffff, { roughness: 0.3 }), [0, 0.026, 0], g); }
    else { mesh(new THREE.BoxGeometry(0.055, 0.003, 0.075), mat(0xffe07a, { emissive: 0x806010, roughness: 0.3 } as any), [0, 0.005, 0], g); }
  }
  return g;
});
// 紅白雨傘（傳統菜市仔款）
const umb = new THREE.Group(); camera.add(umb); umb.visible = false;
var umb3Ready = false, umbSlow = 1; let umbSize = 1, umbS = 0, umbLook = 'stripe';
function buildUmb(look: string, size: number) {
  while (umb.children.length) umb.remove(umb.children[0]); umbSize = size; umbLook = look; if (umb3Ready) build3Umb();
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const x = cv.getContext('2d')!;
  const pal: Record<string, string[]> = { stripe: ['#c8302a', '#f4f0e8'], clear: ['#cfe6ff', '#e4f2ff'], navy: ['#1f2b4a', '#24335a'], beach: ['#e83a3a', '#f6c33a', '#3ab0e8', '#5ac85a'], temple: ['#b0141a', '#e8b030'], gold: ['#8a1420', '#d4af37'] };
  const cols = pal[look] ?? pal.stripe; for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * 32, 0, 32, 32); }
  if (look === 'temple' || look === 'gold') { x.fillStyle = look === 'gold' ? '#ffe9a0' : '#ffe28a'; x.fillRect(0, 26, 256, 6); }
  if (look === 'gold') { x.fillStyle = '#f3d56a'; x.fillRect(0, 0, 256, 5); }
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: look === 'clear' ? 0.1 : look === 'gold' ? 0.45 : 0.8, metalness: look === 'gold' ? 0.35 : 0, transparent: look === 'clear', opacity: look === 'clear' ? 0.45 : 1 });
  const c = mesh(new THREE.ConeGeometry(0.9 * size, 0.35 * size, look === 'temple' || look === 'gold' ? 24 : 16, 1, true), m, [0, 0, 0], umb); c.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), mat(look === 'gold' ? 0xe8c040 : look === 'temple' ? 0xd8a020 : 0x6a4a2a), [0, -0.05, 0.35], umb).rotation.x = Math.PI / 2;
}
buildUmb('stripe', 1);
umb.position.set(0, 0, -0.75);

// ---------- 遊戲狀態 ----------
let tapAim = false, tossT0 = 0; const TAP_HINT = '肉在刀尖上！點一下碗（或碗附近）丟進去，越快越俐落';
type Phase = 'pick' | 'scoop' | 'seam' | 'twist' | 'aim' | 'empty' | 'crab' | 'busy'
  | 'grillPlace' | 'grillCook' | 'grillFlip' | 'grillTake';
let state: 'menu' | 'play' | 'end' = 'menu';
const syncShiftUi = () => document.body.classList.toggle('onShift', state === 'play');
syncShiftUi();
let phase: Phase = 'busy';
let hp = 100, stabs = 0, flinch = 0, handPain = false;
let timeLeft = SHIFT, count = 0, bowlBonus = 0, cracked = 0, opened = 0, missed = 0, abandoned = 0, perfects = 0, dayPearls: number[] = [], dayOdd: number[] = [];
let reflects = 0, wasteShells = 0, thrown = 0, lost = 0, blockStreak = 0;
let steals = 0, caught = 0, penalty = 0, meatHits = 0, shellHits = 0, blocks = 0, hitsTaken = 0, crackedNow = false;
let holding = false, hold = 0, diff = 1, slowmo = 0, shake = 0, pearlShow = 0;
let rot = 0, seamA = 0, lastTick = 0, progress = 0, tension = 0, strokeDir = 0, strokeLen = 0, strokePeak = 0, crabShakes = 0, lastKeyT = 0, lastKey = '';
let find: ReturnType<typeof rollFind> = { kind: 'none', i: 0 };
/** 烤蚵：放上烤網後等待開口 */
let grillCookT = 0, grillCookDur = 3.5;
/** 烤位臉盆／肉碗：往座位側外移，勿與矮爐重疊 */
const BASIN0_GRILL = new THREE.Vector3(-0.58, 0.08, 1.72);
const BOWL0_GRILL = new THREE.Vector3(0.58, 0.1, 1.66);
const GRILL_OY0 = new THREE.Vector3(0, GRILL_GRATE_Y + 0.04, 0.55);
const GRILL_HINGE_Z = 0.055;
const GRILL_OPEN_MAX = (18 * Math.PI) / 180; // 與共烤可掀縫對齊，勿開到像已掀
const _grillHit = new THREE.Vector3();
const _grillPlane = new THREE.Plane();
const plazaOnGrill = () => {
  const s = plazaMySeat();
  return !!(plazaMode && s && pileIsGrill(s.pileId));
};
const isGrillPhase = (p = phase) => p === 'grillPlace' || p === 'grillCook' || p === 'grillFlip' || p === 'grillTake';
function basinHome() { return plazaOnGrill() ? BASIN0_GRILL : BASIN0; }
function bowlHome() { return plazaOnGrill() ? BOWL0_GRILL : BOWL0; }
function oysterToHand() {
  grillDetachHinge();
  if (oyster.parent !== handL) { oyster.parent?.remove(oyster); handL.add(oyster); }
  oyster.position.set(0.02, 0.05, -0.16);
  oyster.rotation.set(0, 0, 0);
  oyster.scale.setScalar(1);
}
/** 上殼掛回 oyster（非鉸鏈） */
function grillDetachHinge() {
  grillHinge.rotation.set(0, 0, 0);
  if (shellTop.parent === grillHinge) {
    oyster.add(shellTop);
    shellTop.position.set(0, 0.025, 0);
    shellTop.rotation.set(0, 0, 0);
  }
  if (seamMark.parent === grillHinge) {
    oyster.add(seamMark);
    oyster.add(seamGlow);
    oyster.add(seamRing);
  }
}
/** 開烤：上殼改掛鉸鏈，一邊相連慢慢掀 */
function grillAttachHinge() {
  grillHinge.position.set(0, 0.012, GRILL_HINGE_Z);
  grillHinge.rotation.set(0, 0, 0);
  if (shellTop.parent !== grillHinge) {
    grillHinge.add(shellTop);
    shellTop.position.set(0, 0.012, -GRILL_HINGE_Z);
    shellTop.rotation.set(0, 0, 0);
  }
  // 縫標記跟著上殼邊緣
  if (seamMark.parent !== grillHinge) {
    grillHinge.add(seamMark);
    grillHinge.add(seamGlow);
    grillHinge.add(seamRing);
  }
  seamMark.position.set(0, 0.02, -GRILL_HINGE_Z * 0.3);
  seamGlow.position.copy(seamMark.position);
  seamRing.position.set(seamMark.position.x, 0.025, seamMark.position.z);
}
function oysterToGrill(cx?: number, cy?: number) {
  grillDetachHinge();
  if (oyster.parent !== seatRig) { oyster.parent?.remove(oyster); seatRig.add(oyster); }
  seatRig.updateMatrixWorld(true);
  const origin = plazaMyPileOrigin();
  let lx = GRILL_OY0.x, ly = GRILL_GRATE_Y + 0.04, lz = GRILL_OY0.z;
  if (origin) {
    const pileL = seatRig.worldToLocal(origin.clone());
    lx = pileL.x;
    lz = pileL.z;
    ly = pileL.y + GRILL_GRATE_Y + 0.04;
    if (cx != null && cy != null && Number.isFinite(cx + cy)) {
      const cam = viewCam();
      cam.updateMatrixWorld();
      ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), cam);
      _grillPlane.set(new THREE.Vector3(0, 1, 0), -(origin.y + GRILL_GRATE_Y));
      if (ray.ray.intersectPlane(_grillPlane, _grillHit)) {
        seatRig.worldToLocal(_grillHit);
        const dx = _grillHit.x - pileL.x, dz = _grillHit.z - pileL.z;
        const d = Math.hypot(dx, dz);
        const r = Math.min(d, GRILL_NET_R);
        const k = d > 1e-5 ? r / d : 0;
        lx = pileL.x + dx * k;
        lz = pileL.z + dz * k;
        ly = pileL.y + GRILL_GRATE_Y + 0.04;
      }
    }
  }
  oyster.position.set(lx, ly, lz);
  oyster.rotation.set(0.05, rnd(-0.15, 0.15), 0);
  oyster.scale.setScalar(1.15);
}
let umbT = 0, stealT = 0, stealNpc: Npc | null = null, rotKey = 0, emptyT = 0;
let yaw = 0, pitch = -0.85, tYaw = 0, tPitch = -0.85;
const timers: { t: number; f: () => void }[] = [];
const later = (t: number, f: () => void) => timers.push({ t, f });
const flyers: { m: THREE.Object3D; p0: THREE.Vector3; p1: THREE.Vector3 | (() => THREE.Vector3); t: number; dur: number; h: number; end?: () => void }[] = [];
const fly = (m: THREE.Object3D, p0: THREE.Vector3, p1: THREE.Vector3 | (() => THREE.Vector3), dur: number, h: number, end?: () => void) => { scene.add(m); m.position.copy(p0); flyers.push({ m, p0, p1, t: 0, dur, h, end }); };
const gauge = $('gauge'), fill = $('fill'), zone = $('zone'), label = $('label'), hint = $('hint'), toastEl = $('toast');
initDomToast(toastEl, {
  isPlazaMode: () => plazaMode,
  onPlazaToast: () => { Social.placeFeed(); },
});
let inZ0 = '';
function setInZ(z: string) { if (z === inZ0) return; const was = inZ0; inZ0 = z; gauge.classList.toggle('inZ', !!z); gauge.classList.toggle('inP', z === 'p'); $('gtag').textContent = z === 'p' ? '完美！' : z ? '現在！' : '';
  if (z && !was) { navigator.vibrate?.(15); tone(z === 'p' ? 1320 : 990, 0.04, 0.06, 'triangle'); } }
const IDEAL = 0.75; let PERF0 = 0.7, PERF1 = 0.8;
const HINTS: Record<Phase, string> = {
  pick: COARSE ? '看自己的紅臉盆，點一顆蚵仔（或點自己的手）拿起來（小顆比較好撬，黑又粗的比較硬）' : '看自己的紅臉盆，點一顆蚵仔（或按 Space）拿起來（小顆比較好撬，黑又粗的比較硬）',
  scoop: '撈蚵仔中…',
  seam: COARSE ? '按住 ◀ ▶ 或拖蚵仔來轉，找殼縫；縫對準刀尖時點一下蚵仔插刀（拖其他地方是看四周）' : '滾輪／A D 轉蚵仔找殼縫，縫對準刀尖時點一下（或 Space）插刀',
  twist: COARSE ? '看指針來回擺動，走到綠區時點一下螢幕撬一下；撬夠次數殼就打開。點在紅區太用力會把殼弄碎' : '看指針來回擺動，走到綠區時點一下滑鼠（或按 Space）撬一下；撬夠次數殼就打開。點在紅區太用力會把殼弄碎',
  aim: '肉在刀尖上！點一下碗（或碗附近）丟進去，0.8 秒內點有「俐落」+$1，2 秒沒點會自己進碗',
  empty: COARSE ? '空殼：按「丟殼」對準阿婆丟過去，或者等一下自動丟掉' : '空殼：F／右鍵／「丟殼」對準阿婆丟過去，或者等一下自動丟掉',
  crab: COARSE ? '螃蟹夾手了！快狂點螢幕把牠甩掉！' : '螃蟹夾手了！快連點（滑鼠／Space）把牠甩掉！',
  busy: '',
  grillPlace: COARSE ? '點烤網放上這顆（不拿刀）；放完再拿下一顆。空手才能掀殼／拿肉' : '點烤網放上這顆（不拿刀）；放完再拿下一顆。空手才能掀殼／拿肉',
  grillCook: '等烤網上的蚵仔開口…',
  grillFlip: '點烤開的蚵仔掀上殼（比手速；手上有東西不行）',
  grillTake: '點掀好的蚵仔拿肉（比手速；手上有東西不行）',
};
/** 丟殼／偷蚵準心：工寮與廣場同一套——瞄到碗→手掌「偷!」，可下手時 hot */
function updReticle() {
  const el = $('reticle');
  if (state !== 'play') { on('reticle', false); el.classList.remove('hot', 'steal'); return; }
  // 烤位也延續丟殼（空殼）／準心；撬縫只在工寮／剝蚵堆
  const canThrow = phase === 'empty' || phase === 'seam';
  let stealReady = false, stealHot = false;
  if (!walking) {
    if (plazaMode) {
      if (plazaSeated() && performance.now() >= plazaStealBanUntil) {
        const pt = plazaStealTgt ?? plazaStealAimTarget();
        // 同工寮：只要瞄到碗就換手掌；hot＝沒被看＋規則允許（烤位同樣可偷）
        stealReady = !!pt;
        stealHot = !!plazaStealTgt || (!!pt && !plazaWatchingMe(pt) && !plazaStealCanTarget(pt));
      }
    } else if (evRun?.steal !== 'no_steal') {
      const tgt = stealNpc ?? stealTarget();
      stealReady = !!stealNpc || !!tgt;
      stealHot = !!stealNpc || (!!tgt && freeToSteal(tgt));
    }
  }
  const locked = document.pointerLockElement === canvas && phase !== 'busy';
  const show = stealReady || canThrow || phase === 'pick' || locked;
  on('reticle', show);
  let throwHot = false;
  if (canThrow && !stealReady) {
    if (plazaMode) throwHot = !!plazaThrowTarget();
    else {
      for (const n of npcs) {
        const p = worldOf(n.head).project(viewCam());
        if (p.z < 1 && Math.abs(p.x) < 0.25 && Math.abs(p.y) < 0.45) { throwHot = true; break; }
      }
    }
  }
  el.classList.toggle('steal', !!stealReady);
  el.classList.toggle('hot', !!stealReady ? stealHot : (show && throwHot));
  const lab = el.querySelector('.retStealLab');
  if (lab) lab.textContent = stealReady ? '偷!' : '';
}
function setPhase(p: Phase) {
  if (p !== 'seam') { seamRing.visible = false; sweet = false; }
  phase = p; holding = false; hold = 0; fill.style.marginLeft = '0'; zone.style.left = ''; zone.style.width = ''; if (p === 'twist') { needleStart = performance.now(); combo = 0; pryHits = 0; } gauge.classList.remove('on', 'aim', 'tw'); setInZ('');
  tapAim = p === 'aim'; if (tapAim) tossT0 = performance.now(); bowlRing.visible = tapAim; syncBasinRing();
  if (tapAim && !tut && state === 'play' && !LS.getItem('meatTip')) { LS.setItem('meatTip', '1'); later(0.1, () => toast(matchMedia('(pointer: coarse)').matches ? '往上拖畫面找阿婆，點她可以把肉丟過去（不算錢）' : '轉過去用滑鼠點阿婆，可以把肉丟過去（不算錢）', '#ffd76a')); }
  if (p === 'aim' && !tapAim) gauge.classList.add('aim'); if (p === 'twist') gauge.classList.add('tw', 'on');
  updReticle(); on('giveUp', (p === 'seam' || p === 'twist' || p === 'grillPlace') && state === 'play'); on('prog', p === 'twist' || p === 'crab');
  on('rotL', p === 'seam'); on('rotR', p === 'seam');
  // 烤位延續丟殼（空殼 phase）；剝蚵刀烤位一律不拿
  on('throwBtn', (p === 'seam' || p === 'empty') && state === 'play');
  knife.visible = !plazaOnGrill();
  if (plazaOnGrill()) knifeK = 0;
  if (p !== 'busy') hint.textContent = tapAim ? TAP_HINT : HINTS[p];
  const d = DIFF[diff];
  if (p === 'aim') { const TW = tut ? 0.12 : 0; zone.style.left = `${(PERF0 - TW) * 100}%`; zone.style.width = `${(PERF1 - PERF0 + 2 * TW) * 100}%`; $('diff').textContent = crackedNow ? '⚠ 有殼屑' : ''; }
  if (p === 'twist') { zone.style.left = `${d.lo * 100}%`; zone.style.width = `${(d.hi - d.lo) * 100}%`; progress = 0; strokeDir = 0; strokeLen = 0; strokePeak = 0; }
  if (p === 'grillPlace') $('diff').textContent = '共烤';
  else if (!isGrillPhase(p) && p !== 'aim') { /* keep */ }
  if (!isGrillPhase(p) && p !== 'busy') grillDetachHinge();
  if (p === 'seam' || p === 'twist') updDiff();
  else if (p !== 'aim' && p !== 'grillCook') $('diff').textContent = '';
}
function updDiff() { const d = DIFF[diff], el = $('diff'); el.style.color = d.css; el.textContent = `難度：${d.n}${phase === 'twist' ? `・要撬 ${pryNeed()} 下` : ''}${crackedNow ? '・⚠ 有殼屑' : ''}`; }
function goPick() {
  if (state !== 'play' || walking) return;
  if (evRun?.steal === 'steal_only') { oyster.visible = false; setPhase('busy'); hint.textContent = '本活動只能用偷的：趁阿婆轉頭聊天，偷她碗裡的肉'; return; }
  oysterToHand();
  oyster.visible = false; setPhase('pick');
  // 烤位：臉盆空了自動補滿；先對齊盆座標再補，蚵才會在盆裡
  if (plazaOnGrill() && !basinOy.length) {
    liftSeatPropsOntoPile();
    fillBasin(false);
  }
  if (!basinOy.length) {
    hint.textContent = plazaMode ? '臉盆空了！點面前的蚵仔堆撈一把' : '臉盆空了！轉頭看中間的蚵殼山，點一下撈一把';
  } else if (plazaOnGrill()) {
    hint.textContent = '點臉盆內的蚵仔放上烤網；烤開的搶掀／搶拿';
  }
}
function holdOyster(dd: number) {
  if (state !== 'play' || walking) return;
  if (saltNext && !tut) { saltNext = false; if (dd > 1) dd = Math.random() < 0.5 ? 0 : 1; toast('🧂 粗鹽搓過，這顆比較好開', '#cfc3ff'); drawMeds(); }
  diff = tut ? 0 : dd; const d = DIFF[diff];
  oysterToHand();
  oyster.visible = true; oyster.rotation.set(0, 0, 0); rot = rnd(0, 6.28); crackedNow = false;
  seamA = rnd(0, 6.28); const r = 0.115; seamMark.position.set(Math.cos(seamA) * r, 0.012, Math.sin(seamA) * r); seamMark.rotation.y = -seamA + Math.PI / 2; seamGlow.position.copy(seamMark.position); seamGlow.rotation.copy(seamMark.rotation); seamRing.position.set(seamMark.position.x, 0.02, seamMark.position.z); sweet = false;
  seamMark.scale.set(1, 1, 1);
  const grill = plazaOnGrill();
  seamMark.visible = seamGlow.visible = !grill;
  shellTop.visible = true; shellTop.position.set(0, 0.025, 0); shellTop.rotation.set(0, 0, 0); meatInHand.visible = true; meatInHand.material = meatMat; pearlMesh.visible = false; oddMeshes.forEach(m => m.visible = false);
  { const base = [0xffffff, 0xeeeae8, 0xdcd6d4, 0xc8c2c0][diff]; shellTopMat.color.setHex(base); shellBotMat.color.setHex(base).multiplyScalar(0.92); const gi = Math.floor(Math.random() * 6); shellTop.geometry = HALF_GEOS[gi]; shellBot.geometry = HALF_GEOS[(gi + 3) % 6]; }
  placeBarn(barnacles, diff, 0.032);
  meatsLeft = 1; showExtra();
  // 烤位：開獎改在搶到肉時（同剝殼桌）；拿起待烤時不抽，以免白耗保底
  find = (tut || grill) ? { kind: 'none', i: 0 } : rollFind();
  if (grill) setPhase('grillPlace');
  else setPhase('seam');
  void d;
}

/** 防連點：放／掀／拿同一時間只送一次 */
let grillPlaceBusy = false;
let grillRaceBusy = false;
function grillPlaceOnNet(cx?: number, cy?: number) {
  if (phase !== 'grillPlace' || state !== 'play' || grillPlaceBusy) return;
  grillPlaceBusy = true;
  void (async () => {
    try {
      const origin = plazaMyPileOrigin();
      if (!origin) { toast('請先坐烤位', '#ff8a7a'); return; }
      seatRig.updateMatrixWorld(true);
      let lx = 0, lz = 0, onNet = false;
      if (cx != null && cy != null && Number.isFinite(cx + cy)) {
        const cam = viewCam();
        cam.updateMatrixWorld();
        ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), cam);
        _grillPlane.set(new THREE.Vector3(0, 1, 0), -(origin.y + GRILL_GRATE_Y));
        if (ray.ray.intersectPlane(_grillPlane, _grillHit)) {
          lx = _grillHit.x - origin.x;
          lz = _grillHit.z - origin.z;
          const d = Math.hypot(lx, lz);
          if (d <= GRILL_NET_R * 1.08) { onNet = true; if (d > GRILL_NET_R && d > 1e-5) { lx *= GRILL_NET_R / d; lz *= GRILL_NET_R / d; } }
        }
      }
      if (!onNet) { toast('點烤網上想放的位置', '#ffd76a'); return; }
      const r = await plazaGrillPlace(lx, lz, diff);
      if (!r.ok) { toast(r.err === 'grill_overlap' ? '這裡太擠了，換個空位放' : (plazaZhErr(r.err) || '放不上烤網'), '#ff8a7a'); return; }
      if (r.oyster) plazaGrillUpsertLocal(r.oyster);
      oysterToHand();
      oyster.visible = false;
      SFX.whoosh();
      toast('放上了，再從臉盆拿一顆', '#ffd76a');
      // 放完要再去拿，不自動接下顆
      setPhase('busy');
      later(0.25, goPick);
    } finally {
      grillPlaceBusy = false;
    }
  })();
}
/** 手上有蚵／肉／空殼等就不准掀殼、拿肉 */
function grillHandsBusy() {
  if (oyster.visible) return true;
  return phase === 'grillPlace' || phase === 'aim' || phase === 'empty'
    || phase === 'grillTake' || phase === 'grillFlip' || phase === 'scoop'
    || phase === 'seam' || phase === 'twist' || phase === 'crab';
}
/** 搶掀／搶拿（一次只處理一顆；手上有東西不可） */
async function grillRaceAt(cx: number, cy: number) {
  if (!plazaOnGrill() || state !== 'play' || walking || grillRaceBusy) return false;
  const o = plazaGrillNearest(cx, cy, viewCam());
  if (!o) return false;
  if (grillHandsBusy()) {
    toast('手上還拿著東西，先放完／丟完再掀殼或拿肉', '#ffb08a');
    return true;
  }
  if (o.state === 'open') {
    grillRaceBusy = true;
    setPhase('grillFlip');
    // 樂觀更新：立刻變已掀，避免連點再掀下一顆／同一顆
    plazaGrillUpsertLocal({ ...o, state: 'flipped' });
    try {
      const r = await plazaGrillFlip(o.id);
      if (!r.ok) {
        if (r.err !== 'gone') plazaGrillUpsertLocal(o); // 還原；伺服器已沒有這顆就不要放回去，免得留下拿不走的殘影
        toast(plazaZhErr(r.err) || '掀不到', '#ff8a7a');
        if (state === 'play') { setPhase('busy'); later(0.2, goPick); }
        return true;
      }
      if (r.oyster) plazaGrillUpsertLocal(r.oyster);
      SFX.creak();
      toast('掀掉上殼！再點一次拿肉', '#9be37a');
      // 短冷卻後才可再點（拿肉或掀別顆）
      setPhase('busy');
      later(0.45, () => { if (state === 'play') goPick(); });
      return true;
    } finally {
      later(0.5, () => { grillRaceBusy = false; });
    }
  }
  if (o.state === 'flipped') {
    grillRaceBusy = true;
    setPhase('grillTake');
    plazaGrillRemoveLocal(o.id); // 樂觀拿掉，防連拿
    try {
      const r = await plazaGrillTake(o.id);
      if (!r.ok) {
        if (r.err !== 'gone') plazaGrillUpsertLocal(o); // 還原；伺服器已沒有這顆就不要放回去，免得留下拿不走的殘影
        toast(plazaZhErr(r.err) || '被別人搶走了', '#ff8a7a');
        if (state === 'play') { setPhase('busy'); later(0.2, goPick); }
        return true;
      }
      applyGrillTakeWin(r.count, o.diff);
      return true;
    } finally {
      later(0.55, () => { grillRaceBusy = false; });
    }
  }
  return false;
}
function applyGrillTakeWin(serverCount?: number, takenDiff?: number) {
  oysterToHand();
  oyster.visible = true;
  shellTop.visible = false;
  seamMark.visible = false;
  seamGlow.visible = false;
  meatInHand.visible = true;
  meatInHand.material = meatMat;
  pearlMesh.visible = false;
  oddMeshes.forEach(m => m.visible = false);
  { const l = luckNow(), r = Math.random(); meatsLeft = tut ? 1 : r < 0.02 + 0.0025 * l ? 3 : r < 0.10 + 0.0075 * l ? 2 : 1; showExtra();
    if (meatsLeft > 1) { if (meatsLeft === 3) dayMulti3++; else dayMulti2++; later(0.25, () => toast(meatsLeft === 3 ? '三仁！' : '雙仁！', '#ffd76a')); } }
  const md = Math.max(0, Math.min(3, takenDiff ?? diff));
  crackSound(); shake = 0.18; opened++; dStat[md][0]++;
  if (typeof serverCount === 'number') count = serverCount;
  else count++;
  // 比照剝殼桌：搶到肉可開珍珠／奇物（含傳說保底）
  find = tut ? { kind: 'none', i: 0 } : rollFind();
  toast('搶到了！丟進碗裡', '#9be37a');
  setPhase('busy');
  if (find.kind === 'pearl') {
    revealPearl(find.i);
    later(2.5, () => { pearlMesh.visible = false; if (state === 'play') setPhase('aim'); });
  } else if (find.kind === 'odd') {
    revealOdd(find.i);
  } else {
    later(0.12, () => { if (state === 'play') setPhase('aim'); });
  }
  updHud();
}
function onPlazaGrillTaken(e: PlazaGrillTakenEvent) {
  const me = plazaConnId();
  if (e.byConnId && me && e.byConnId === me) {
    // 自己的 GrillTake 回傳已處理；廣播僅補同步
    return;
  }
  if (plazaOnGrill() && e.byNick) toast(`${e.byNick} 搶走一顆烤蚵`, '#ffb08a');
}
function grillAct(cx?: number, cy?: number) {
  const x = cx ?? innerWidth / 2, y = cy ?? innerHeight / 2;
  if (phase === 'grillPlace') { grillPlaceOnNet(cx, cy); return; }
  void grillRaceAt(x, y);
}

// 每次上工隨機換阿婆衣服顏色與花樣
const CLOTH = [0xe05a4a, 0x3f8ad0, 0x4fad6b, 0xe09830, 0x4a9ab8, 0xe07090, 0x2f9a9a, 0xc89040, 0x5a8fc0, 0xe0c341];
function dressAma(n: Npc) {
  const pick = () => CLOTH[Math.floor(Math.random() * CLOTH.length)]; const base = pick(); let acc = pick(); if (acc === base) acc = 0xf4ecd8;
  const kind = Math.floor(Math.random() * 4), cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d')!;
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0'); x.fillStyle = hex(base); x.fillRect(0, 0, 64, 64); x.fillStyle = hex(acc);
  if (kind === 1) for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 64, 6);
  else if (kind === 2) for (let y = 4; y < 64; y += 16) for (let i = 4; i < 64; i += 16) { x.beginPath(); x.arc(i + (y % 32 ? 8 : 0), y, 3.5, 0, 7); x.fill(); }
  else if (kind === 3) for (let k = 0; k < 7; k++) { const cx = Math.random() * 64, cy = Math.random() * 64; for (let a = 0; a < 5; a++) { x.beginPath(); x.arc(cx + Math.cos(a * 1.26) * 4, cy + Math.sin(a * 1.26) * 4, 3, 0, 7); x.fill(); } x.fillStyle = '#ffe680'; x.beginPath(); x.arc(cx, cy, 2, 0, 7); x.fill(); x.fillStyle = hex(acc); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1); tex.colorSpace = THREE.SRGBColorSpace;
  const m = n.body.material as THREE.MeshStandardMaterial; m.map?.dispose(); m.map = tex; m.color.set(0xffffff); m.needsUpdate = true;
  for (const a of [n.armL, n.armR]) { const sl = a.children[0] as THREE.Mesh; (sl.material as THREE.MeshStandardMaterial).color.set(base); }
  const PANTS = [0x3a5068, 0x4a5a68, 0x5a4a3a, 0x2a5a78, 0x4a6a5a, 0x586070]; (n.pants as THREE.MeshStandardMaterial).color.set(PANTS[Math.floor(Math.random() * PANTS.length)]);
}
let nightShift = false, walkHintShown = false, saltNext = false;
function drawRadio() { const b = document.getElementById('radioBtn'); if (!b) return; const show = state === 'play' && !tut && !plazaMode && save.shop.owned.includes('radio'); b.style.display = show ? '' : 'none'; const on = gearOn('radio'); b.classList.toggle('off', !on); b.innerHTML = COARSE ? '<i class="ic ic-radio"></i><i class="led"></i>' : `<i class="ic ic-radio"></i> ${on ? STATIONS[radioSt()].n : '關'}`; b.title = on ? `收音機：${STATIONS[radioSt()].n}` : '收音機：關（點按鈕切換）'; }
// 收音機按鈕循環：關 → 懷舊歌謠台 → 廣播電台 → 台語老歌 → 關
function toggleRadio() { if (!save.shop.owned.includes('radio') || state !== 'play' || tut || plazaMode) return; save.gear = save.gear ?? {};
  if (!gearOn('radio')) { save.gear.radio = true; save.radioSt = 0; } else if (radioSt() < STATIONS.length - 1) save.radioSt = radioSt() + 1; else save.gear.radio = false;
  if (gearOn('radio')) achAdd('radio', STATIONS[radioSt()].id); persist(); achCheck(); drawRadio(); toast(gearOn('radio') ? `收音機：${STATIONS[radioSt()].n}（阿婆心情好，但丟殼預警會變晚）` : '收音機關掉：聽得到丟殼預警了', '#cfc3ff'); }
const isNight = () => { const h = new Date().getHours(); return h >= 20 || h < 5; };
// 天色跟著玩家裝置的時間（黎明／白天／黃昏／夜晚，平滑過渡）
// 時, 天空, 霧, 半球光, 強度, 太陽 — 清爽晴天為主，黎明／黃昏略暖但不髒
const SKY: [number, number, number, number, number, number][] = [
  [0, 0x182838, 0x203040, 0xb0c4d8, 0.62, 0.16], [5, 0x283848, 0x304858, 0xc0d4e4, 0.65, 0.24],
  [6.5, 0xf2c8a0, 0xe8b890, 0xffeed8, 0.82, 0.7], [9, 0x88c0e4, 0xc8dce8, 0xfff4ea, 1.05, 1.15],
  [12, 0x78b4e0, 0xc0d8e8, 0xfff6ee, 1.1, 1.22], [16, 0x88bce0, 0xc8dce4, 0xfff2e8, 1.0, 1.05],
  [18, 0xe89868, 0xd89060, 0xffe4c8, 0.75, 0.65], [19.5, 0x345068, 0x3c5870, 0xb0c4d8, 0.64, 0.26],
  [24, 0x182838, 0x203040, 0xb0c4d8, 0.62, 0.16]];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const _skySun = new THREE.Vector3();
function updSky() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60; let i = 0; while (SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], f = (h - a[0]) / (b[0] - a[0]);
  const L = (k: number) => _c1.setHex(a[k]).lerp(_c2.setHex(b[k]), f).getHex();
  try { showLand(); } catch { /* 尚未初始化 */ } const tn = locNow().tint; (scene.background as THREE.Color).setHex(L(1)); (scene.fog as THREE.Fog).color.setHex(L(2)); if (tn !== null) { _c2.setHex(tn); (scene.background as THREE.Color).lerp(_c2, 0.22); (scene.fog as THREE.Fog).color.lerp(_c2, 0.22); } hemi.color.setHex(L(3));
  hemi.intensity = a[4] + (b[4] - a[4]) * f; sun.intensity = a[5] + (b[5] - a[5]) * f;
  // 穹頂：天頂更深、地平更亮，雲量依時段；避開夢核平板色塊
  const skyHex = L(1), night = isNight(), dawnDusk = (h >= 5 && h < 8) || (h >= 17 && h < 20);
  const zenith = _c1.setHex(skyHex).lerp(_c2.setHex(night ? 0x0c1828 : 0x3a90c8), night ? 0.4 : 0.55).getHex();
  const horizon = _c1.setHex(skyHex).lerp(_c2.setHex(night ? 0x1a2838 : 0xe4f0f8), 0.5).getHex();
  skyDome.setColors(zenith, horizon, L(2));
  skyDome.setSun(_skySun.copy(sun.position).normalize(), Math.min(1.15, sun.intensity / 1.15));
  skyDome.setClouds(mix.eco ? 0 : night ? 0.1 : dawnDusk ? 0.38 : 0.56);
  try { applyShedLook(); } catch { /* 尚未初始化 */ }
  refreshEconomyLabels();
}

/** 夜班％／俐落加給等文案（不重畫整塊地點卡） */
function refreshEconomyLabels() {
  const pct = Math.round(eco.nightMult * 100);
  const nn = document.getElementById('nightNote');
  if (nn) {
    nn.innerHTML = isNight()
      ? `<i class="ic ic-moon"></i> 🌙 現在是夜班時段：這一工收入 +${pct}%`
      : `<i class="ic ic-moon"></i> 夜班加成 +${pct}%（晚上 8 點到早上 5 點上工）`;
  }
  const nv = document.querySelector('#nightTag .hudV');
  if (nv) nv.innerHTML = `<i class="ic ic-moon"></i>+${pct}%`;
  const tossTip = document.getElementById('tipToss');
  if (tossTip) tossTip.innerHTML = `<b>丟肉</b>：殼打開後碗會亮起來，點一下碗（或碗附近）蚵仔肉就飛進去，不會丟歪；0.8 秒內點有「俐落」+$${eco.quickBonus}，2 秒沒點也會自己進碗`;
  HINTS.aim = `肉在刀尖上！點一下碗（或碗附近）丟進去，0.8 秒內點有「俐落」+$${eco.quickBonus}，2 秒沒點會自己進碗`;
}

/** 後台經濟設定套用後，重刷開場 UI（地點倍率／上工費／圖鑑售價／夜班文案） */
function refreshEconomyUi() {
  syncEconomyTables(LOCS, RAR);
  refreshEconomyLabels();
  try { renderDaily(); } catch { /* */ }
  try { renderLocs(); } catch { /* */ }
  try { renderDex(); } catch { /* */ }
}

// 工寮遠景／蚵寮本體（見 world/yardScene）
initYardScene({
  scene,
  mesh,
  mat,
  locNow: () => locNow(),
  ground,
  hemi,
  sun,
  lamp,
  water,
});

type Crew = { name: string; hair: number; look: 'ama' | 'agong' | 'dajie' | 'fisher' | 'ama2'; pal: number[] };
const CREW: Record<string, Crew[]> = {
  home: [{ name: '快手阿桃', hair: 0x999999, look: 'ama', pal: [] }, { name: '講話阿春', hair: 0x333333, look: 'ama', pal: [] }, { name: '好奇阿嬌', hair: 0xcccccc, look: 'ama', pal: [] }],
  wanggong: [{ name: '漁夫阿伯', hair: 0x555555, look: 'fisher', pal: [0x2a4a7a, 0x3a6a9a, 0xe8e0c8] }, { name: '燈塔阿公', hair: 0xdddddd, look: 'agong', pal: [0xe8e8e0, 0x6a7a8a, 0x8a5a3a] }, { name: '海口阿嬤', hair: 0xaaaaaa, look: 'ama2', pal: [0x4a6a9a, 0xc8d8e8, 0x2a5a7a] }],
  dongshi: [{ name: '碼頭大姐', hair: 0x2a1a10, look: 'dajie', pal: [0xe07a4a, 0xf0c050, 0xd04a6a] }, { name: '蚵棚阿伯', hair: 0x444444, look: 'fisher', pal: [0x6a5a3a, 0x8a7a4a, 0x4a4a3a] }, { name: '愛聊阿嬤', hair: 0xbbbbbb, look: 'ama2', pal: [0xc06a8a, 0xe0a0b0, 0x8a4a6a] }],
  budai: [{ name: '鹽田阿公', hair: 0xeeeeee, look: 'agong', pal: [0xf0f0f0, 0xc8c8c0, 0x6a6a5a] }, { name: '大廠組長大姐', hair: 0x1a1a1a, look: 'dajie', pal: [0x3a7a5a, 0x2a5a4a, 0xe8e8d8] }, { name: '老師傅阿伯', hair: 0x666666, look: 'fisher', pal: [0x4a4a5a, 0x5a5a6a, 0x7a6a4a] }],
};
const crewHats: THREE.Object3D[] = [];
function applyCrew() {
  const id = locNow().id, set = CREW[id] ?? CREW.home;
  showLand();
  crewHats.forEach(h => h.removeFromParent()); crewHats.length = 0;
  npcs.forEach((n, i) => {
    const c = set[i % set.length], nm = i < set.length ? c.name : evExtraName(i - set.length) ?? c.name; n.name = nm; n.tag.setText(nm); n.tagTxt = nm;
    const head = n.g.children.find(o => o instanceof THREE.Group && Math.abs(o.position.y - 1.02) < 0.01) as THREE.Group | undefined; if (!head) return;
    const hair = head.children[1] as THREE.Mesh, bun = head.children[2] as THREE.Mesh;
    (hair.material as THREE.MeshStandardMaterial).color.setHex(c.hair); (bun.material as THREE.MeshStandardMaterial).color.setHex(c.hair);
    bun.visible = c.look === 'ama' || c.look === 'ama2'; hair.scale.set(1, c.look === 'agong' ? 0.6 : 1, 1);
    let hat: THREE.Object3D | null = null;
    if (c.look === 'fisher') { hat = new THREE.Group(); mesh(rcyl(0.16, 0.16, 0.08, 12), mat(c.pal[2] ?? 0xe8e0c8), [0, 0, 0], hat); mesh(rboxEnv(0.16, 0.015, 0.12), mat(c.pal[0]), [0, -0.035, 0.14], hat); hat.position.set(0, 0.12, 0); }
    else if (c.look === 'agong') { hat = mesh(new THREE.ConeGeometry(0.3, 0.14, 14), mat(0xd8c080), [0, 0.16, 0]); } // 斗笠
    else if (c.look === 'dajie') { hat = mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 16), mat(c.pal[1]), [0, 0.06, 0]); hat.rotation.x = Math.PI / 2; } // 髮箍
    else if (c.look === 'ama2') { hat = mesh(new THREE.SphereGeometry(0.165, 10, 6, 0, Math.PI * 2, 0, 1.2), mat(c.pal[1]), [0, 0.03, 0]); } // 頭巾
    if (hat) { head.add(hat); crewHats.push(hat); }
    if (c.pal.length) { const m = n.body.material as THREE.MeshStandardMaterial; const base = c.pal[Math.floor(Math.random() * 2)]; m.map?.dispose(); m.map = null; m.color.setHex(base); m.needsUpdate = true; for (const a of [n.armL, n.armR]) ((a.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(base); }
  });
}
updSky(); showLand(); applyCrew(); setInterval(updSky, 30000);
function startDay() { if (performance.now() < guardUntil) return; inputGuard();
  nightShift = isNight(); updSky();
  $('nightTag').style.display = nightShift && !plazaMode ? '' : 'none';
  if (nightShift && !plazaMode) later(1.5, () => toast(`🌙 夜班上工！這一工收入 +${Math.round(eco.nightMult * 100)}%`, '#b8c8ff'));
  if (isRoomActive()) { npcs.length = 0; ALL_NPCS.forEach(n => { n.g.visible = false; n.tag.sprite.visible = false; n.bubble.sprite.visible = false; }); stools.forEach(g => { g.visible = false; if (g.userData.tag) g.userData.tag.visible = false; }); }
  else { moonReset(); npcs.forEach(dressAma); applyCrew(); }
  if (walking && !plazaMode && !isRoomActive()) { setWalking(false); on('seatCard', false); on('joy', false); handRig.visible = true; stools.forEach(g => g.userData.tag.visible = false); tYaw = yaw = 0; tPitch = pitch = -0.85; }
  state = 'play'; syncShiftUi(); clearAchShiftGot(); handPain = false; for (const k in medT) delete medT[k]; drawMeds(); timeLeft = shiftLen; hp = 100; dayCombo = 0;
  if (plazaMode && !plazaPlayAt) plazaPlayAt = performance.now();
  statsSid = crypto.randomUUID?.() ?? statsId + '-' + Date.now();
  if (!tut) {
    if (plazaMode) { const s = plazaMySeat(); track('plaza_start', { seat: s ? `p${s.pileId}s${s.slot}` : 'plaza', loc: locNow().id, mode: 'plaza' }); }
    else track('start', { seat: save.seat ?? 'door', loc: locNow().id });
  }
  const sidNow = statsSid; const pingT = setInterval(() => { if (tut || state !== 'play' || statsSid !== sidNow || document.hidden) { if (statsSid !== sidNow || state !== 'play') clearInterval(pingT); return; } track('ping'); }, 60_000);
  count = bowlBonus = cracked = opened = missed = abandoned = perfects = stabs = steals = caught = penalty = meatHits = shellHits = blocks = hitsTaken = reflects = wasteShells = thrown = lost = blockStreak = 0; dayPearls = []; dayOdd = []; meatPay = 0; dCnt = [0, 0, 0, 0]; dStat = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; endReason = 'time'; dayMulti2 = dayMulti3 = 0; meatsLeft = 1; showExtra();
  plazaStealBanUntil = 0; plazaStealCatches = 0; plazaStealPairCd.clear(); stopPlazaSteal();
  dayMaxGrudge = 0; npcs.forEach(n => { n.count = 0; n.mood = 0; n.angry = 0; n.distract = 0; n.windup = 0; n.grudge = 0; n.gAt = 0; n.calm = 0; n.clutch = 0; n.throwCd = rnd(15, 30); if (n.stuck) { n.stuck.removeFromParent(); n.stuck = null; } });
  [...bowlMeat, ...splats].forEach(m => scene.remove(m)); bowlMeat.length = 0; splats.length = 0;
  ['overlay', 'result', 'dex'].forEach(i => $(i).classList.remove('show')); on('umbBtn', true); on('medBtn', !tut); on('quitBtn', !tut); drawRadio(); applyGloves(); applySleeve(); drawMeds(); clearBasinOysters(); fillBasin(false); if (!(isRoomActive() && walking)) goPick(); if (!SHOT && !tut && !matchMedia('(pointer: coarse)').matches) canvas.requestPointerLock?.(); updHud();
}
/** HUD dirty：避免每幀寫 DOM／innerHTML 觸發強制重排 */
const hudPrev = { hpW: '', hpPct: '', timerLab: '', timer: '', count: -1, pearls: -1, stats: '' };
function updHud() {
  const hpW = `${hp}%`;
  if (hudPrev.hpW !== hpW) { hudPrev.hpW = hpW; ($('hpFill') as HTMLElement).style.width = hpW; }
  const hpPct = String(Math.round(hp));
  if (hudPrev.hpPct !== hpPct) { hudPrev.hpPct = hpPct; const hpEl = document.getElementById('hpPct'); if (hpEl) hpEl.textContent = hpPct; }
  const timerLab = $('timer').previousElementSibling as HTMLElement | null;
  const labTxt = plazaMode || (roomPlay && currentRoomSnap()?.endMode !== 'timed') ? '模式' : '剩餘';
  if (timerLab && hudPrev.timerLab !== labTxt) { hudPrev.timerLab = labTxt; timerLab.textContent = labTxt; }
  const timerTxt = plazaMode
    ? '休閒'
    : roomPlay
    ? (currentRoomSnap()?.endMode === 'timed' ? (() => { const s = roomRemainSec(); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; })() : '好友房')
    : (() => { const s = Math.max(0, Math.ceil(timeLeft)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; })();
  if (hudPrev.timer !== timerTxt) { hudPrev.timer = timerTxt; $('timer').textContent = timerTxt; }
  if (hudPrev.count !== count) { hudPrev.count = count; $('count').innerHTML = `<i class="ic ic-oyster"></i> ${count}`; }
  const pearlN = dayPearls.length + dayOdd.length;
  if (hudPrev.pearls !== pearlN) { hudPrev.pearls = pearlN; $('pearls').innerHTML = `<i class="ic ic-pearl"></i> ${pearlN}`; }
  evHud();
  const statsKey = `${opened}|${count}|${cracked}|${steals}|${caught}`;
  if (hudPrev.stats !== statsKey) {
    hudPrev.stats = statsKey;
    const cell = (lab: string, icon: string, val: string | number, warn = false) =>
      `<span class="stCell${warn ? ' warn' : ''}" title="${lab}"><span class="stL">${lab}</span><span class="stI" aria-hidden="true"><i class="ic ic-${icon}"></i></span><b class="stV">${val}</b></span>`;
    $('statsT').innerHTML =
      cell('開殼', 'knife', opened) +
      cell('入碗', 'bowl', count) +
      cell('殼屑', 'oyster', cracked, cracked > 0) +
      cell('偷／被抓', 'run', `${steals}/${caught}`, caught > 0);
  }
}
function worldOf(o: THREE.Object3D) { return o.getWorldPosition(new THREE.Vector3()); }
function nagFrom(n: Npc, lines: string[], dur = 3) { let t = pick(lines); if (t === lastNag && lines.length > 1) t = lines[(lines.indexOf(t) + 1) % lines.length]; lastNag = t; n.look = dur; say(n, t, dur); }
// ----- 血 -----
const drops: { m: THREE.Mesh; v: THREE.Vector3 }[] = [], decals: { m: THREE.Mesh; t: number }[] = [];
const dropGeo = new THREE.SphereGeometry(0.005, 6, 4), dropMat = new THREE.MeshBasicMaterial({ color: 0xe0182a });
const decalGeo = new THREE.CircleGeometry(1, 10);
const wound = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), new THREE.MeshBasicMaterial({ color: 0xa00818, transparent: true })); wound.position.set(0.03, 0.06, -0.02); wound.rotation.set(-1.2, 0, 0.4); wound.visible = false; handL.add(wound);
let woundT = 0;
function emojiSprite(t: string, sz = 0.18) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 64, 70); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.setScalar(sz); return sp; }
function npcHurt(n: Npc, power = 1) {
  n.clutch = rnd(3, 5) * power; n.pause = Math.max(n.pause, n.clutch); n.windup = 0; SFX.aia(); later(0.15, () => tone(380, 0.6, 0.12, 'sawtooth', 0, 220)); say(n, pick(['哎唷喂啊！我的頭！', '要命喔！流血了啦！', '你這孩子！丟我的頭！']));
  if (n.bump) n.head.remove(n.bump);
  n.bump = mix.gore ? new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xd86a5a)) : emojiSprite('🩹', 0.14); n.bump.position.set(0.02, 0.12, 0.03); n.head.add(n.bump); n.bumpT = 20;
  if (!mix.gore) { const st = emojiSprite('💫', 0.22); st.position.set(0, 0.2, 0); n.head.add(st); later(2.5, () => n.head.remove(st)); return; }
  bleed(Math.round(18 * power), worldOf(n.head).add(new THREE.Vector3(0, 0.1, 0)), false);
}
function bleed(n: number, at?: THREE.Vector3, me = true) {
  if (!mix.gore) { if (me) { const b = $('aid') as HTMLElement; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } return; }
  const o = at ?? new THREE.Vector3(); if (!at) { handL.getWorldPosition(o); o.y += 0.05; }
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(dropGeo, dropMat); m.position.copy(o); m.scale.setScalar(rnd(0.6, 1.6)); scene.add(m); drops.push({ m, v: new THREE.Vector3(rnd(-0.8, 0.8), rnd(0.8, 2), rnd(-0.9, 0.2)) }); }
  if (me) { woundT = 8; wound.visible = true; }
}
function landY(p: THREE.Vector3) { if (Math.hypot(p.x - BOWL.x, p.z - BOWL.z) < BOWL_R + 0.03) return BOWL.y + 0.06; if (Math.hypot(p.x - BASIN.x, p.z - BASIN.z) < 0.3) return 0.15; if (Math.hypot(p.x, p.z) < 0.9) return 0.15 * (1 - Math.hypot(p.x, p.z) / 0.9) + 0.01; return 0.005; }
function updBlood(dt: number) {
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.v.y -= 9 * dt; d.m.position.addScaledVector(d.v, dt); const y = landY(d.m.position);
    if (d.m.position.y <= y) {
      scene.remove(d.m); drops.splice(i, 1);
      // 約一半落地不留痕，留下的也偏小滴
      if (Math.random() < 0.45) {
        const c = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0xb01020, transparent: true, opacity: 0.7, depthWrite: false }));
        c.rotation.x = -Math.PI / 2; c.position.set(d.m.position.x, y + 0.003, d.m.position.z);
        c.scale.setScalar(rnd(0.007, 0.014)); scene.add(c); decals.push({ m: c, t: 10 });
      }
    }
  }
  for (let i = decals.length - 1; i >= 0; i--) { const d = decals[i]; d.t -= dt; (d.m.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, d.t / 5); if (d.t <= 0) { scene.remove(d.m); decals.splice(i, 1); } }
  if (woundT > 0) { woundT -= dt; (wound.material as THREE.MeshBasicMaterial).opacity = Math.min(1, woundT / 3); if (woundT <= 0) wound.visible = false; }
}
/** 畫面邊框紅暈（死鬥 #dmEdge 同款：閃一下再淡出） */
function flashHurt() {
  const e = $('hurt') as HTMLElement;
  e.classList.remove('on');
  void e.offsetWidth;
  e.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => e.classList.remove('on')));
}
function hurt(dmg: number, txt: string) {
  react3('ouch');
  if (tut || evRun?.infHp) dmg = 0;
  dmg *= medM('dmg') * fxAll().dmg;
  hp = Math.max(0, hp - dmg);
  shake = 0.3; flashHurt(); SFX.aia(); toast(txt, '#ff9a8a'); updHud();
  // 廣場休閒：被丟到別強制收工（玩家常回報成「閃退」）
  if (hp <= 0 && state === 'play') {
    if (plazaMode) { hp = 1; return; }
    handPain = true; setPhase('busy'); later(0.8, endDay);
  }
}

// ----- 0. 提蚵仔／撈蚵仔 -----
const ray = new THREE.Raycaster();
function makeBasinOyster(dd: number) {
  const m = new THREE.Mesh(SHELL_GEOS[Math.floor(Math.random() * 6)], basinShellM(BASIN_SHELL_COLS[dd] ?? BASIN_SHELL_COLS[0]));
  m.scale.setScalar(DIFF[dd].scale * 0.95);
  m.userData.diff = dd;
  m.castShadow = true;
  m.renderOrder = 2; // 蓋過殼堆，避免埋進堆裡難認
  const bl: THREE.Mesh[] = []; for (let i = 0; i < BARN_N[dd]; i++) { const b = new THREE.Mesh(BARN_GEO, BARN_MAT); m.add(b); bl.push(b); } placeBarn(bl, dd, 0.04);
  return m;
}
const basinCap = () => plazaMode ? 15 : 20;
/** 臉盆本地座標（子物件），蚵仔永遠跟盆走 */
function basinSlotLocal(i: number) {
  const a = i * 2.4, r = 0.045 + (i % 4) * 0.038;
  return new THREE.Vector3(Math.cos(a) * r, BASIN_OY_Y + Math.floor(i / 6) * 0.032, Math.sin(a) * r);
}
function syncBasinWorld() {
  basinMesh.updateMatrixWorld(true);
  BASIN.copy(basinMesh.localToWorld(new THREE.Vector3(0, BASIN_OY_Y, 0)));
}
function layoutBasinOysters() {
  basinOy.forEach((m, i) => {
    if (m.parent !== basinMesh) basinMesh.add(m);
    m.position.copy(basinSlotLocal(i));
  });
  syncBasinWorld();
}
/** 每次清盆 +1；還在飛的舊蚵落地時發現代數不同就丟掉，避免清盆後又冒出來 */
let basinGen = 0;
function clearBasinOysters() {
  basinGen++;
  for (const m of basinOy) m.removeFromParent();
  basinOy.length = 0;
}
/** 廣場入座／換位／重連回座：盆子換成這桌難度、補滿；不給錢、不算顆數 */
function plazaRefillBasin() {
  if (!plazaMode) return;
  if (phase === 'scoop') { on('prog', false); setPhase('busy'); later(0.3, goPick); }
  if (plazaOnGrill()) liftSeatPropsOntoPile();
  clearBasinOysters();
  fillBasin(false);
  if (phase === 'pick' && !plazaOnGrill()) hint.textContent = '點臉盆內的蚵仔';
}
function fillBasin(animate: boolean) {
  const n = basinCap();
  syncBasinWorld();
  const weights = plazaMode ? plazaScoopWeights() : (newbie() ? [50, 50, 0, 0] : locW());
  const gen = basinGen;
  for (let i = 0; i < n; i++) {
    const m = makeBasinOyster(wpick(weights.map(w => ({ w }))));
    const local = basinSlotLocal(i);
    m.rotation.set(rnd(-0.2, 0.2), rnd(0, 6), rnd(-0.2, 0.2));
    basinOy.push(m);
    if (animate) {
      let p0: THREE.Vector3;
      if (plazaMode) {
        const origin = plazaMyPileOrigin();
        p0 = origin
          ? origin.clone().add(new THREE.Vector3(rnd(-0.35, 0.35), 0.35 + rnd(0, 0.2), rnd(-0.35, 0.35)))
          : BASIN.clone().add(new THREE.Vector3(rnd(-0.25, 0.25), 0.35, rnd(-0.25, 0.25)));
      } else p0 = pileSpot();
      const slotW = basinMesh.localToWorld(local.clone());
      fly(m, p0, slotW, 0.4 + i * 0.05, 0.4, () => {
        if (gen !== basinGen) { m.removeFromParent(); return; }
        basinMesh.add(m);
        m.position.copy(local);
      });
    } else {
      basinMesh.add(m);
      m.position.copy(local);
    }
  }
}
function hitsOyster(cx: number, cy: number) { camera.updateMatrixWorld(); viewCam().updateMatrixWorld(); ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), viewCam()); return ray.intersectObject(oyster, true).length > 0; }
const _pickScr = new THREE.Vector3();
/** 螢幕上距點擊最近的臉盆蚵（maxPx 內）；用世界座標投影，第三人稱／抬盆也準 */
function nearestBasinOyster(cx: number, cy: number, maxPx: number) {
  const cam = viewCam();
  let best: THREE.Mesh | null = null, bestD = maxPx;
  for (const m of basinOy) {
    if (!m.visible) continue;
    m.getWorldPosition(_pickScr).project(cam);
    if (!(_pickScr.z < 1) || !Number.isFinite(_pickScr.x + _pickScr.y)) continue;
    const d = Math.hypot((_pickScr.x + 1) / 2 * innerWidth - cx, (1 - _pickScr.y) / 2 * innerHeight - cy);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}
/** 點在紅臉盆／亮圈附近（比對單顆蚵寬鬆，對齊 nearBowl 手感） */
function nearBasin(cx: number, cy: number) {
  const cam = viewCam();
  const p = BASIN.clone().project(cam);
  if (!(p.z < 1) || !Number.isFinite(p.x + p.y)) return false;
  const bx = (p.x + 1) / 2 * innerWidth, by = (1 - p.y) / 2 * innerHeight;
  const loose = COARSE || tpOn;
  const r = Math.max(loose ? 170 : 140, Math.min(innerWidth, innerHeight) * (loose ? 0.28 : 0.22));
  return Math.hypot(bx - cx, by - cy) < r;
}
function pickAt(cx: number, cy: number) {
  if (phase !== 'pick' || state !== 'play') return;
  // 與偷肉／丟碗一樣：先對齊本幀鏡頭，避免點選落空
  if (!tpOn) {
    camera.rotation.set(pitch, yaw + flYaw + (walking ? 0 : seatYaw), 0);
    camera.updateMatrixWorld();
  }
  const cam = viewCam();
  cam.updateMatrixWorld();
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), cam);
  const hit = ray.intersectObjects(basinOy, true)[0];
  if (hit) { let o: THREE.Object3D = hit.object; while (!basinOy.includes(o as THREE.Mesh)) o = o.parent!; grab(o as THREE.Mesh); return; }
  // 點到臉盆本體 → 拿最近一顆
  if (basinOy.length && ray.intersectObject(basinMesh, true).length) {
    const near = nearestBasinOyster(cx, cy, 1e9);
    if (near) { grab(near); return; }
  }
  const loose = COARSE || tpOn;
  const pickR = Math.max(loose ? 160 : 120, Math.min(innerWidth, innerHeight) * (loose ? 0.26 : 0.18));
  let best = nearestBasinOyster(cx, cy, pickR);
  if (best) { grab(best); return; }
  // 點在臉盆亮圈附近也算拿蚵（玩家常點盆不點殼）
  if (basinOy.length && nearBasin(cx, cy)) {
    best = nearestBasinOyster(cx, cy, 1e9);
    if (best) { grab(best); return; }
  }
  if (plazaMode) {
    // 烤位空盆直接補滿；其餘座位：點自己面前蚵堆撈
    if (!basinOy.length) {
      if (plazaOnGrill()) {
        liftSeatPropsOntoPile();
        fillBasin(false);
        hint.textContent = '點臉盆內的蚵仔放上烤網；烤開的搶掀／搶拿';
        return;
      }
      const hitId = plazaHitPile(ray);
      const mine = plazaMySeat()?.pileId;
      if (hitId == null || mine == null || hitId === mine) { scoop(); return; }
      toast('請點自己面前這一堆蚵仔', '#ffb08a'); return;
    }
  } else if (ray.intersectObject(pileHit, false).length || ray.intersectObject(pile, false).length) { scoop(); return; }
  hint.textContent = basinOy.length ? '點臉盆內的蚵仔' : (plazaMode ? '臉盆空了！點面前的蚵仔堆撈一把' : '臉盆空了！點中間的蚵殼山撈一把');
}
function grab(m: THREE.Mesh) {
  basinOy.splice(basinOy.indexOf(m), 1); setPhase('busy'); reach = 0.35; tone(500, 0.05, 0.08, 'triangle'); noise(0.05, 1200, 0.2);
  const from = new THREE.Vector3();
  m.getWorldPosition(from);
  m.removeFromParent();
  scene.add(m);
  m.position.copy(from);
  fly(m, from.clone(), () => worldOf(oyster), 0.3, 0.05, () => { scene.remove(m); noise(0.04, 2500, 0.25); holdOyster(m.userData.diff); });
}
function scoop() { if (basinOy.length >= basinCap()) return; setPhase('scoop'); scoopT = scoopDur = 1.5 * seatNow().scoop; noise(0.6, 900, 0.3); noise(0.6, 1600, 0.2); }
let reach = 0, scoopT = 0, scoopDur = 1.5;
// ----- 1. 找縫 -----
const scr = (o: THREE.Object3D) => { const p = worldOf(o).project(camera); return new THREE.Vector2(p.x * innerWidth, p.y * innerHeight); };
const knifeTip = knife.children[1] as THREE.Object3D;
function seamErr() { const c = scr(oyster), m = scr(seamMark).sub(c), k = scr(knifeTip).sub(c); let d = Math.atan2(m.y, m.x) - Math.atan2(k.y, k.x); d = Math.atan2(Math.sin(d), Math.cos(d)); return d; }
function tryInsert() {
  if (phase !== 'seam') return;
  const d = DIFF[diff];
  if (Math.abs(seamErr()) < tolNow()) { noise(0.06, 3000, 0.4); tone(320, 0.08, 0.2, 'triangle', 0, 200); toast('插進去了！', '#9be37a'); seamGlow.visible = false; seamRing.visible = false; sweet = false; setPhase('twist'); }
  else if (Math.random() < slipNow()) { stabs++; dStat[diff][1]++; dStat[diff][2]++; flinch = 0.6; nag(NAG_STAB); hint.textContent = '刀子滑掉，割到手了！'; setPhase('busy'); bleed(16); hurt((10 + diff * 5) * (gearOn('glove') ? 0.5 : 1), gearOn('glove') ? '哎呀！（有手套）' : '哎呀！'); if (hp > 0) later(0.7, () => setPhase('seam')); }
  else { dStat[diff][1]++; tone(140, 0.08, 0.2, 'square'); hint.textContent = '沒對準縫，刀子滑開了！再找找看'; if (Math.random() < 0.3) nag(NAG_SLIP); shake = 0.08; }
}
// ----- 2. 扭手腕 -----
function twistInput(dx: number, dtMs: number) { if (swipePhase()) return;
  if (Math.abs(dx) < 0.5) return;
  const dir = Math.sign(dx), speed = Math.abs(dx) / Math.max(1, dtMs) * 1000 / (innerWidth * 2.2);
  tension = Math.max(tension, Math.min(1.2, speed));
  if (phase === 'crab') { if (dir !== strokeDir && strokeLen > innerWidth * 0.04) { crabShakes++; SFX.creak(); if (crabShakes >= 6) crabOff(); } if (dir !== strokeDir) strokeLen = 0; strokeDir = dir; strokeLen += Math.abs(dx); return; }
  if (phase !== 'twist') return;
  if (dir !== strokeDir) { if (strokeDir !== 0 && strokeLen > innerWidth * 0.05) halfTwist(strokePeak); strokeDir = dir; strokeLen = 0; strokePeak = 0; }
  strokeLen += Math.abs(dx); strokePeak = Math.max(strokePeak, tension);
}
const PRY = [{ w: 0.3, sp: 0.8 }, { w: 0.22, sp: 1.05 }, { w: 0.2, sp: 1.35 }, { w: 0.135, sp: 1.7 }];
let pryHits = 0;
const PRY_NEED = [2, 3, 4, 5], PRY_C = 0.55, PRY_RED = 0.86;
let needleStart = 0, combo = 0, dayCombo = 0;
function applyUmb() { const u = umbNow(); buildUmb(u.look, u.size); }
// ----- 位仔（換位） -----
const seatNow = () => SEATS.find(x => x.id === save.seat) ?? SEATS[0];
const seatGround = (st: Seat) => new THREE.Vector3(-Math.sin(st.a) * st.r, 0, Math.cos(st.a) * st.r);
let seatYaw = 0;
const stools = SEATS.map(st => { const g = new THREE.Group(); const p = seatGround(st); g.position.copy(p);
  mesh(rcyl(0.17, 0.17, 0.05, 12), mat(0x3a7ac0), [0, 0.4, 0], g); for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]]) mesh(rcyl(0.02, 0.02, 0.4, 5), mat(0x2a5a90), [x, 0.2, z], g);
  const tag = emojiSprite('🪑', 0.3); tag.position.y = 0.9; tag.visible = false; g.add(tag); g.userData.tag = tag; scene.add(g); return g; });
function applySeat(id: string) {
  const old = seatRig.matrixWorld.clone().invert(); save.seat = id; const st = seatNow();
  seatRig.rotation.y = -st.a; seatRig.position.copy(seatGround(st).multiplyScalar((st.r - 2) / st.r || 0)); seatRig.updateMatrixWorld(true); seatYaw = -st.a;
  const M = seatRig.matrixWorld.clone().multiply(old);
  // 臉盆蚵是 basinMesh 子物件，跟 seatRig 走；只轉場景上的碗肉
  bowlMeat.forEach(m => m.position.applyMatrix4(M));
  SEAT.copy(seatRig.localToWorld(SEAT0.clone())); applyBowl();
}
/** 廣場：把座椅／鏡頭綁到指定世界座標（面向 yaw） */
function applyPlazaSeatPose(pos: THREE.Vector3, yaw: number) {
  const old = seatRig.matrixWorld.clone().invert();
  seatYaw = yaw; seatRig.rotation.y = yaw;
  seatRig.position.set(pos.x - Math.sin(yaw) * SEAT0.z, 0, pos.z - Math.cos(yaw) * SEAT0.z);
  seatRig.updateMatrixWorld(true);
  const M = seatRig.matrixWorld.clone().multiply(old);
  bowlMeat.forEach(m => m.position.applyMatrix4(M));
  SEAT.copy(seatRig.localToWorld(SEAT0.clone())); applyBowl();
  setPlazaSeatPropsVisible(true);
}
/** 廣場走動時藏臉盆／肉碗（否則會留在剛離開的椅子旁） */
function setPlazaSeatPropsVisible(v: boolean) {
  seatRig.visible = v;
  for (const m of basinOy) m.visible = v;
  for (const m of bowlMeat) m.visible = v;
  for (const m of splats) m.visible = v;
  if (!v) { bowlRing.visible = false; basinRing.visible = false; }
}
/** 臉盆／肉碗貼蚵堆表面，避免被殼遮住；烤位改貼地並外移，勿與爐干涉 */
function liftSeatPropsOntoPile() {
  let ox = 0, oz = 0;
  const onGrill = plazaOnGrill();
  if (plazaMode) {
    const o = plazaMyPileOrigin();
    if (o) { ox = o.x; oz = o.z; }
  }
  const homeB = basinHome();
  seatRig.updateMatrixWorld(true);
  const b = bowlNow();
  // 烤位：碗底貼地；一般蚵堆：取碗底附近堆面並略降（整圈 max 會抬太高）
  const bowlW = seatRig.localToWorld(new THREE.Vector3(BOWL_L.x, 0, BOWL_L.z));
  const bowlFloorWant = onGrill
    ? 0.02
    : pileSurfYMax(bowlW.x, bowlW.z, Math.max(0.12, b.r * 0.55), ox, oz) - 0.06;
  const bowlLocal = seatRig.worldToLocal(new THREE.Vector3(bowlW.x, bowlFloorWant, bowlW.z));
  bowlG.position.set(BOWL_L.x, bowlLocal.y, BOWL_L.z);
  BOWL.copy(seatRig.localToWorld(new THREE.Vector3(BOWL_L.x, bowlLocal.y + Math.max(0.08, b.h - 0.02), BOWL_L.z)));

  const basW = seatRig.localToWorld(new THREE.Vector3(homeB.x, 0, homeB.z));
  // 一般蚵堆：只取盆底附近堆面（勿用整圈外緣 max，坡上會把左盆抬太高）
  const basFloorWant = onGrill
    ? 0.02
    : pileSurfYMax(basW.x, basW.z, BASIN_R_BOT * 0.55, ox, oz) - 0.05;
  const basCenterWant = basFloorWant + BASIN_H / 2;
  const basLocal = seatRig.worldToLocal(new THREE.Vector3(basW.x, basCenterWant, basW.z));
  const dy = basLocal.y - basinMesh.position.y;
  basinMesh.position.set(homeB.x, basLocal.y, homeB.z);
  if (Math.abs(dy) > 1e-5) {
    for (let i = 0; i < basinShells.count; i++) {
      basinShells.getMatrixAt(i, _liftM);
      _liftM.decompose(_liftPos, _liftQ, _liftS);
      _liftPos.y += dy;
      _liftM.compose(_liftPos, _liftQ, _liftS);
      basinShells.setMatrixAt(i, _liftM);
    }
    basinShells.instanceMatrix.needsUpdate = true;
  }
  layoutBasinOysters();
}
function applyBowl() {
  const b = bowlNow(), S = seatNow(); BOWL_R = b.r * (newbie() ? 1.2 : 1); const pw = (b.perf + S.perf) * (newbie() ? 1.4 : 1); PERF0 = IDEAL - pw / 2; PERF1 = IDEAL + pw / 2;
  const home = bowlHome();
  BOWL_L.set(SEAT0.x + (home.x - SEAT0.x) * b.dist * S.bowl, home.y, SEAT0.z + (home.z - SEAT0.z) * b.dist * S.bowl); buildBowl(b);
  liftSeatPropsOntoPile();
}
const pryW = () => Math.min(0.6, Math.min(1.6, 1 + 0.15 * pryHits) * PRY[diff].w * knifeNow().green * medM('green') * (newbie() ? 1.3 : 1));
const PRY_SLOW = 0.56; // 整體放慢（0.8→0.56，再慢 30%）
const prySp = () => PRY[diff].sp * PRY_SLOW * (gearOn('glove') ? 1.05 : 1) * knifeNow().speed * medM('speed') * fxAll().speed;
const pryNeed = () => Math.max(1, PRY_NEED[diff] + knifeNow().steps);
const tolNow = () => DIFF[diff].tol * knifeNow().seam * (gearOn('glasses') ? 1.25 : 1);
const slipNow = () => tut ? 0 : Math.min(0.9, DIFF[diff].slip * knifeNow().stab * medM('slip') * (newbie() ? 0.6 : 1));
function applyKnife() { ((knife.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(knifeNow().blade); const k = knifeNow(); (knife.children[1] as THREE.Mesh).scale.set(k.id === 'point' ? 1.2 : k.id === 'harbor' ? 1.12 : 1, 1, k.id === 'wide' ? 1.7 : k.id === 'point' ? 0.6 : k.id === 'harbor' ? 0.82 : 1); }

initYardShop({
  getSave: () => save,
  persist,
  track,
  esc,
  getAc: () => ac,
  SFX,
  applyKnife,
  applyUmb,
  applyBowl,
  applyGloves,
  drawRadio,
  onCosmeticsChange: () => refreshPlazaCosmetics(),
  onPetChange: () => refreshPet(),
  getPlayerId: () => statsId,
  getNick: () => myName(),
  toast,
  onFlagChange: () => plazaRefreshFlagUi(),
  setFlagText: (text) => plazaTrySetFlagText(text),
  showFlag: (on) => on ? plazaTryShowFlag() : plazaTryRemoveFlag(),
  upgradeFlag: (track, from) => plazaTryUpgradeFlag(track, from),
  selectFlag: (track, level) => plazaTrySelectFlag(track, level),
  clearBowlMeat: () => { if (bowlMeat.length) { bowlMeat.forEach(m => scene.remove(m)); bowlMeat.length = 0; } },
  renderClothShop,
  renderMedShop,
  renderItemShop: () => renderItemShop(),
  shopTabs: () => shopTabs(),
  getShopTab: () => shopTab,
  newDecor: () => newDecor(),
  shellGeos: SHELL_GEOS,
  pileMat,
});

const PRY_GRACE = 0.04;
// 等速來回（三角波）；視覺佮判定用同一時間公式（事件 timeStamp）
const needle = (ms = performance.now()) => {
  const u = (((ms - needleStart) / 1000) * prySp()) % 1;
  return u < 0.5 ? u * 2 : 2 - u * 2;
};
(window as any).__sim = () => ({ t: SHIFT - timeLeft, c: npcs.map(n => n.count), names: npcs.map(n => n.name) });
(window as any).__dbg = { warn: () => { const n = npcs[npcs.length - 1]; if (n) { n.throwCd = 999; windUp(n); n.windup = (window as any).__wu ?? 60; n.w0 = n.windup; } }, state: () => ({ state, phase, walking, paused: (globalThis as any).__paused }) };
(window as any).__pryReset = (d = 2) => { diff = d; progress = 0; crackedNow = false; setPhase('twist'); };
(window as any).__pry = () => { if (phase !== 'twist') return null; const f = prySp(), per = 1000 / f, th = (PRY_C / 2) * per; const el = (performance.now() - needleStart) % per; return { wait: ((th - el) % per + per) % per, phase, progress }; };
function pryFx(ok: boolean, txt: string) { gauge.classList.remove('hit', 'miss'); void gauge.offsetWidth; gauge.classList.add(ok ? 'hit' : 'miss'); const pp = $('ppop'); pp.textContent = txt; pp.className = ''; void pp.offsetWidth; pp.className = ok ? 'ok' : 'bad'; }
function pry(ms = performance.now()) {
  if (phase === 'crab') { crabShakes++; tone(600 + crabShakes * 40, 0.05, 0.1); strokeDir = -strokeDir || 1; flinch = 0.3; if (crabShakes >= 8) crabOff(); return; }
  if (phase !== 'twist') return;
  const n = needle(ms), w = pryW() + PRY_GRACE * 2; (window as any).__pryLog = ((window as any).__pryLog || []).concat([[+n.toFixed(3), Math.abs(n - PRY_C) <= w / 2]]); strokeDir = -strokeDir || 1; tension = 0.9;
  const need = pryNeed();
  if (n > PRY_RED) { combo = 0; progress += 1 / need; SFX.creak(); pryFx(false, '碎！'); if (!crackedNow) { crackedNow = true; dStat[diff][3]++; noise(0.1, 4000, 0.5); noise(0.25, 6000, 0.3); shake = 0.15; toast('太大力，殼碎掉了！', '#ffa860'); meatInHand.material = splatMat; nag(NAG_CRACK); updDiff(); } }
  else if (Math.abs(n - PRY_C) <= w / 2) { progress += 1 / need; pryHits++; /* 撬中後指針從目前位置繼續滑，不再跳回起點 */ combo++; if (combo > dayCombo) dayCombo = combo; if (combo > save.life.bestCombo) { save.life.bestCombo = combo; persist(); } SFX.creak(); tone(1500, 0.04, 0.12, 'square'); tone(2200, 0.05, 0.08, 'triangle', 0.03); shake = 0.05; const k = Math.round(progress * need); pryFx(true, `✓ ${k}/${need}${combo >= 2 ? `　連擊 x${combo}` : ''}`); hint.textContent = combo >= 3 ? '讚！功夫真好！' : '好！再一下'; }
  else { if (!(Math.random() < fxAll().keep)) combo = 0; tone(140, 0.12, 0.12, 'triangle'); noise(0.06, 300, 0.2); pryFx(false, '✗ 沒中'); hint.textContent = '時機不對，等指針走到綠區再點'; tension = 0.3; return; }
  shellTop.rotation.z = -progress * 0.4;
  if (progress >= 0.999) openOyster();
}
function halfTwist(peak: number) {
  const d = DIFF[diff];
  if (peak < d.lo) { hint.textContent = '力氣不夠，再用力一點！'; return; }
  progress += 1 / d.need; SFX.creak();
  if (peak > d.hi && !crackedNow) { crackedNow = true; dStat[diff][3]++; noise(0.1, 4000, 0.5); noise(0.25, 6000, 0.3); shake = 0.15; toast('殼碎掉了！', '#ffa860'); meatInHand.material = splatMat; nag(NAG_CRACK); updDiff(); }
  else hint.textContent = HINTS.twist;
  shellTop.rotation.z = -progress * 0.4;
  if (progress >= 0.999) openOyster();
}
function keyTwist(k: string) { if (swipePhase()) return;
  const now = performance.now(), dt = now - lastKeyT; lastKeyT = now;
  if (k === lastKey) return; lastKey = k;
  const t = Math.min(1.2, 220 / Math.max(80, dt)); tension = Math.max(tension, t);
  if (phase === 'crab') { crabShakes++; tone(600 + crabShakes * 40, 0.05, 0.1); if (crabShakes >= 6) crabOff(); return; }
  if (phase === 'twist' && dt < 1500) halfTwist(t); else if (phase === 'twist') hint.textContent = '再快一點！';
}
let meatsLeft = 1, dayMulti2 = 0, dayMulti3 = 0; const extraMeat: THREE.Object3D[] = [];
function showExtra() {
  if (!extraMeat.length && meatInHand.parent) for (let k = 0; k < 2; k++) { const e = meatInHand.clone(); e.position.x += (k ? -1 : 1) * 0.028; e.position.z += 0.012; e.scale.multiplyScalar(0.85); meatInHand.parent.add(e); extraMeat.push(e); }
  extraMeat.forEach((e, k) => e.visible = k < meatsLeft - 1);
}
function openOyster() {
  { const l = luckNow(), r = Math.random(); meatsLeft = tut ? 1 : r < 0.02 + 0.0025 * l ? 3 : r < 0.10 + 0.0075 * l ? 2 : 1; showExtra();
    if (meatsLeft > 1) { if (meatsLeft === 3) dayMulti3++; else dayMulti2++; later(0.3, () => { toast(meatsLeft === 3 ? '三仁！一顆有三塊肉！' : '雙仁！一顆有兩塊肉！', '#ffd76a'); tone(880, 0.12, 0.15, 'triangle'); tone(1320, 0.18, 0.12, 'triangle', 0.1); if (meatsLeft === 3) tone(1760, 0.22, 0.12, 'triangle', 0.2); }); } }
  crackSound(); shake = 0.25; opened++; dStat[diff][0]++; setPhase('busy'); seamMark.visible = false;
  if (crackedNow) cracked++;
  shellTop.visible = false;
  const top = new THREE.Mesh(halfGeo, shellTopMat); fly(top, worldOf(oyster), pileSpot(), 0.6, 0.5, () => scene.remove(top));
  if (find.kind === 'pearl') { revealPearl(find.i); later(2.5, () => { pearlMesh.visible = false; setPhase('aim'); }); }
  else if (find.kind === 'odd') revealOdd(find.i);
  else later(0.2, () => setPhase('aim'));
  updHud();
}
/** 奇物展示世代：點螢幕可跳過阿婆湊近觀看 */
let oddShowGen = 0, oddShowI = -1;
function oddShowActive() { return oddShowI >= 0 && oddShowI !== 3 && pearlShow > 0; }
function skipOddShow() {
  if (!oddShowActive()) return false;
  const i = oddShowI;
  oddShowGen++;
  oddShowI = -1;
  pearlShow = 0;
  slowmo = 0;
  label.classList.remove('on');
  leanFaces.forEach(f => { f.visible = false; });
  if (i >= 0) oddMeshes[i].visible = false;
  if (state === 'play' && phase === 'busy') setPhase('aim');
  return true;
}
function revealOdd(i: number) { react3('cheer');
  const o = ODD[i]; dayOdd.push(i); save.odd[i]++; const wasPity = pityHit; pityHit = false; if (rarOf(o.weight) === 'legend' && !o.limited) { save.legendDry = 0; save.legendN = legendTotal(); } persist(); Social.report(rarOf(o.weight) === 'legend' ? 'legend' : 'odd', i); track('find', { kind: 'odd', item: 'odd-' + i, rarity: rarOf(o.weight), ...(wasPity ? { pity: 1 } : {}), seat: save.seat ?? 'door', knife: knifeNow().id, luck: luckNow(), dex: dexN() }); oddMeshes[i].visible = true;
  const gen = ++oddShowGen;
  oddShowI = i === 3 ? -1 : i;
  slowmo = 1.8; pearlShow = 2.2; SFX.jingle(i !== 3);
  label.innerHTML = `${o.name}！<small>${o.line}</small><small>${save.odd[i] === 1 ? '🆕 第一次找到！' : `你的第 ${save.odd[i]} 個`}</small>`; label.style.color = o.color; label.classList.add('on');
  npcs.forEach((n, k) => { n.look = 2.4; say(n, o.cry[k % o.cry.length], 2.4); });
  if (i === 3) { later(0.6, () => { if (gen !== oddShowGen) return; flinch = 1; SFX.pinch(); bleed(8); hurt(4, '夾！'); crabShakes = 0; strokeDir = 0; strokeLen = 0; setPhase('crab'); }); }
  else later(2.2, () => {
    if (gen !== oddShowGen) return;
    oddShowI = -1;
    oddMeshes[i].visible = false;
    setPhase('aim');
  });
}
function crabOff() {
  const c = oddMeshes[3]; c.visible = false; const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xd04a2a)); m.scale.y = 0.5;
  fly(m, worldOf(oyster), new THREE.Vector3(rnd(-1, 1), 0.02, rnd(0.3, 1.5)), 0.6, 0.4, () => { later(3, () => scene.remove(m)); });
  toast('甩掉了！', '#9be37a'); setPhase('busy'); later(0.4, () => setPhase('aim'));
}
// ----- 3. 點碗丟肉 -----
function aimPoint() {
  const cam = viewCam();
  const dir = cam.getWorldDirection(new THREE.Vector3());
  const t = dir.y < -0.05 ? (BOWL.y - cam.position.y) / dir.y : 6;
  const p = cam.position.clone().addScaledVector(dir, t);
  const off = p.sub(cam.position).setY(0); if (off.length() > 3) off.setLength(3);
  return cam.position.clone().add(off).setY(BOWL.y);
}
const bowlRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0xf2b705, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
bowlRing.rotation.x = -Math.PI / 2; bowlRing.visible = false; scene.add(bowlRing);
/** 空手拿蚵：紅臉盆（有蚵）／蚵堆（臉盆空）脈衝圈，同丟肉碗亮圈 */
const basinRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0xf2b705, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
basinRing.rotation.x = -Math.PI / 2; basinRing.visible = false; scene.add(basinRing);
function syncBasinRing() {
  const show = state === 'play' && phase === 'pick' && !walking && seatRig.visible;
  if (!show) { basinRing.visible = false; return; }
  basinRing.visible = true;
  const k = 1 + 0.12 * Math.sin(performance.now() / 120);
  if (basinOy.length) {
    basinRing.position.set(BASIN.x, Math.max(0.12, BASIN.y - 0.02), BASIN.z);
    basinRing.scale.setScalar(0.36 * k);
  } else if (plazaMode) {
    const o = plazaMyPileOrigin();
    if (!o) { basinRing.visible = false; return; }
    basinRing.position.set(o.x, 0.55, o.z);
    basinRing.scale.setScalar(0.95 * k);
  } else {
    basinRing.position.set(0, 0.55, 0);
    basinRing.scale.setScalar(0.95 * k);
  }
}
const fx: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
const fxGeo = new THREE.SphereGeometry(0.012, 5, 4);
function burst(at: THREE.Vector3, n: number, color: number, up: number) {
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color, transparent: true })); m.position.copy(at); scene.add(m); const a = Math.random() * 6.28, r = rnd(0.2, 0.6); fx.push({ m, v: new THREE.Vector3(Math.cos(a) * r, rnd(0.6, 1) * up, Math.sin(a) * r), t: 0.6 }); }
}
function tickFx(dt: number) {
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t -= dt; f.v.y -= 4 * dt; f.m.position.addScaledVector(f.v, dt); (f.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.t / 0.6); if (f.t <= 0) { scene.remove(f.m); fx.splice(i, 1); } }
  if (bowlRing.visible) { const k = 1 + 0.12 * Math.sin(performance.now() / 120); bowlRing.position.set(BOWL.x, BOWL.y + 0.02, BOWL.z); bowlRing.scale.setScalar(BOWL_R * k); }
  syncBasinRing();
}
function nearBowl(x: number, y: number) {
  const p = BOWL.clone().project(viewCam()); if (p.z > 1) return false;
  const bx = (p.x + 1) / 2 * innerWidth, by = (1 - p.y) / 2 * innerHeight;
  return Math.hypot(bx - x, by - y) < Math.max(150, Math.min(innerWidth, innerHeight) * 0.28);
}
function toss(tapped: boolean) {
  if (phase !== 'aim' || !tapAim || state !== 'play') return;
  const el = (performance.now() - tossT0) / 1000, quick = tapped && el <= 0.8;
  setPhase('busy'); meatInHand.visible = false;
  const wasCracked = crackedNow, md = diff;
  const from = worldOf(oyster), m = new THREE.Mesh(meatGeo, wasCracked ? splatMat : meatMat);
  const land = new THREE.Vector3(BOWL.x + rnd(-0.06, 0.06), BOWL.y - 0.04 + Math.min(bowlMeat.length, 40) * 0.0015, BOWL.z + rnd(-0.06, 0.06));
  SFX.whoosh(); if (quick) { perfects++; $('gtag').textContent = ''; }
  fly(m, from, land, 0.45, 0.3, () => {
    count++; evMeat(); bowlBonus += bowlNow().bonus + fxAll().bowl; const pv = Math.max(wasCracked ? 1 : 0, (wasCracked ? Math.max(1, Math.round(eco.dpay[md] * eco.crumbRate)) : eco.dpay[md]) - (shiftLen < SHIFT ? eco.tempCut : 0)) + (quick ? eco.quickBonus : 0); meatPay += pv; dCnt[md]++; bowlMeat.push(m); if (bowlMeat.length > 60) scene.remove(bowlMeat.shift()!);
    burst(land.clone().setY(BOWL.y + 0.02), 8, 0xbfe4f2, 1);
    if (!wasCracked) burst(land.clone().setY(BOWL.y + 0.05), 6, 0xffd23a, 1.4);
    if (quick) { tone(980, 0.06, 0.18, 'triangle', 0, 520); tone(1568, 0.08, 0.1, 'sine', 0.05); } else SFX.plop();
    toast(`${quick ? '俐落！' : wasCracked ? '入碗（有殼屑）' : '入碗！'} +$${pv} ${DIFF[md].n}`, quick ? '#f2b705' : DIFF[md].css); { const n = pick(npcs); if (n && Math.random() < 0.15) say(n, pick(PRAISE), 2); }
    updHud();
  });
  later(0.35, () => { if (meatsLeft > 1 && state === 'play') { meatsLeft--; showExtra(); meatInHand.visible = true; meatInHand.material = meatMat; setPhase('aim'); hint.textContent = `還有 ${meatsLeft} 塊肉！點碗繼續丟`; } else { meatsLeft = 1; showExtra(); emptyT = 2.2; setPhase('empty'); } });
}
let shellsOut = 0;
function discardShell() {
  if (phase !== 'empty') return;
  shellsOut++; oyster.visible = false;
  const from = worldOf(oyster);
  const to = plazaMode
    ? (() => { const o = plazaMyPileOrigin(); return o ? o.clone().setY(0.35) : pileSpot(); })()
    : pileSpot();
  const sh = new THREE.Mesh(halfGeo, shellBotMat);
  fly(sh, from, to, 0.6, 0.5, () => scene.remove(sh));
  if (plazaMode) void plazaShellFx(from, to);
  setPhase('busy'); later(0.5, goPick);
}
// ----- 丟肉：拿著肉時點阿婆，把肉丟到她頭上（不算入碗、不算錢）-----
function bowlScrPt() { const p = BOWL.clone().project(viewCam()); return p.z > 1 ? null : [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
function npcAtScr(x: number, y: number): Npc | null {
  const R0 = Math.max(56, Math.min(innerWidth, innerHeight) * 0.11); let best: Npc | null = null, bd = Infinity;
  for (const n of npcs) {
    const h = worldOf(n.head), pts = [h, h.clone().add(new THREE.Vector3(0, -0.22, 0)), h.clone().add(new THREE.Vector3(0, -0.45, 0))];
    for (const w of pts) { const p = w.project(viewCam()); if (p.z > 1) continue; const d = Math.hypot((p.x + 1) / 2 * innerWidth - x, (1 - p.y) / 2 * innerHeight - y); if (d < R0 && d < bd) { bd = d; best = n; } }
  }
  if (!best) return null;
  const b = bowlScrPt(); if (b && Math.hypot(b[0] - x, b[1] - y) < bd) return null; // 比較靠近碗就照舊丟碗
  return best;
}
function throwMeatAt(n: Npc) {
  if (phase !== 'aim' || !tapAim || state !== 'play') return;
  setPhase('busy'); meatInHand.visible = false;
  const m = new THREE.Mesh(meatGeo, crackedNow ? splatMat : meatMat); SFX.whoosh();
  fly(m, worldOf(oyster), () => worldOf(n.head), 0.45, 0.35, () => { meatOnHead(n, m); persist(); });
  later(0.35, () => { if (meatsLeft > 1 && state === 'play') { meatsLeft--; showExtra(); meatInHand.visible = true; meatInHand.material = meatMat; setPhase('aim'); hint.textContent = `還有 ${meatsLeft} 塊肉！點碗繼續丟`; } else { meatsLeft = 1; showExtra(); emptyT = 2.2; setPhase('empty'); } });
}
function meatOnHead(n: Npc, m: THREE.Mesh) {
  meatHits++; addGrudge(n, 25); if (n.stuck) n.stuck.removeFromParent(); m.removeFromParent(); m.position.set(0, 0.15, 0); m.scale.setScalar(1.6); n.head.add(m); n.stuck = m;
  later(8, () => { if (n.stuck === m) { m.removeFromParent(); n.stuck = null; } });
  toast(`肉彈命中${n.name}！`, '#ffb070'); SFX.splat();
  anger(n, SCOLD_HIT, 0.85); updHud();
}
function anger(n: Npc, lines: string[], retaliate: number) {
  n.angry = 2.5; n.mood = Math.max(n.mood, 35); nagFrom(n, lines, 3); tone(220, 0.3, 0.2, 'square');
  if (Math.random() < retaliate) later(0.6, () => windUp(n));
}
const stunned = (n: Npc) => (n.clutch ?? 0) > 0;
const freeToSteal = (n: Npc) => n.distract > 0 || stunned(n);
let dayMaxGrudge = 0;
function addGrudge(n: Npc, v: number) { if (v > 0) v *= (evRun ? Math.max(1, medM('grudge')) * Math.max(1, locNow().ang) : medM('grudge') * locNow().ang * (gearOn('radio') ? 0.7 : 1)) * (evRun?.angerX ?? 1); const g0 = n.grudge ?? 0; n.grudge = Math.max(0, Math.min(100, g0 + v)); if (v > 0) { n.gAt = performance.now(); if (g0 < 60 && n.grudge >= 60 && state === 'play') toast(`${n.name}很生氣！會更常丟你（一陣子不惹她就會消氣）`, '#ff7a6a'); } dayMaxGrudge = Math.max(dayMaxGrudge, n.grudge); }
function grudgeUI(n: Npc) {
  if (!n.gIcon) { n.gIcon = emojiSprite('💢', 0.12); n.gIcon.position.set(-0.1, 0.32, 0); n.head.add(n.gIcon); const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3b2f, depthTest: false })); bar.center.set(0, 0.5); bar.position.set(-0.03, 0.32, 0); n.head.add(bar); n.gBar = bar; }
  const g = n.grudge ?? 0; n.gIcon.visible = n.gBar!.visible = g > 4; n.gIcon.scale.setScalar(0.12 + g * 0.0015); n.gBar!.scale.set(0.006 + g * 0.0032, 0.035, 1);
  (n.gBar!.material as THREE.SpriteMaterial).color.setHSL(0.12 - g * 0.0012, 1, 0.5);
}
function plazaThrowTarget(): PlazaAimTarget | null {
  let best: PlazaAimTarget | null = null, bestScore = 1e9;
  const cam = viewCam();
  for (const t of plazaAimTargets()) {
    if (t.carriedBy || !t.seated || t.phase === 'carried') continue;
    if (!t?.connId || !t.head || ![t.head.x, t.head.y, t.head.z].every(Number.isFinite)) continue;
    const p = new THREE.Vector3(t.head.x, t.head.y, t.head.z).project(cam);
    if (p.z >= 1 || !Number.isFinite(p.x + p.y)) continue;
    const s = Math.abs(p.x) * 1.2 + Math.abs(p.y);
    if (Math.abs(p.x) < 0.32 && Math.abs(p.y) < 0.5 && s < bestScore) { best = t; bestScore = s; }
  }
  return best;
}
/** 廣場偷肉：讀條／同堆冷卻寫死；罰金／禁偷／碗少門檻見 eco */
const PLAZA_STEAL_PAIR_MS = 4000;
const PLAZA_BUSY_PHASE = /^(seam|twist|pry|crab|scoop|grillplace|grillcook|grillflip|grilltake)$/i;
let plazaStealBanUntil = 0;
let plazaStealCatches = 0;
const plazaStealPairCd = new Map<string, number>();

function plazaStealCanTarget(t: PlazaAimTarget): string | null {
  const mine = plazaMySeat();
  if (!mine || t.pileId !== mine.pileId) return '只能偷同一堆的人';
  if (t.count < eco.plazaStealMinCount) return '對方碗裡太少，先別偷';
  if (t.umb) return '對方撐著傘，偷不到';
  if (PLAZA_BUSY_PHASE.test(t.phase || '')) return '對方正在撬殼，下手不了';
  const cd = plazaStealPairCd.get(t.connId) ?? 0;
  if (performance.now() < cd) return '同一個目標要隔一下再偷';
  return null;
}
/** 準心是否對準碗（工寮／廣場共用同一套投影判定） */
const _stealBowl = new THREE.Vector3();
const _stealEdge = new THREE.Vector3();
const _stealRight = new THREE.Vector3();
function bowlOnReticle(bx: number, by: number, bz: number, bowlR = 0.16, slack = 1.65) {
  // 判定多在 camTick 之前：先把 FP 鏡頭對齊本幀 yaw/pitch
  if (!tpOn) {
    camera.rotation.set(pitch, yaw + flYaw + (walking ? 0 : seatYaw), 0);
    camera.updateMatrixWorld();
  }
  const cam = viewCam();
  cam.updateMatrixWorld();
  _stealBowl.set(bx, by, bz).project(cam);
  if (!(_stealBowl.z < 1) || !Number.isFinite(_stealBowl.x + _stealBowl.y)) return false;
  const cx = _stealBowl.x, cy = _stealBowl.y;
  _stealRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
  _stealEdge.set(bx, by, bz).addScaledVector(_stealRight, bowlR).project(cam);
  let r = Math.hypot(_stealEdge.x - cx, _stealEdge.y - cy) * slack;
  // 第三人稱略放寬；其餘與工寮一致
  const minR = tpOn ? 0.1 : 0.08;
  const maxR = tpOn ? 0.22 : 0.16;
  r = Math.min(maxR, Math.max(minR, r));
  return Math.hypot(cx, cy) <= r;
}
/** 準心瞄到誰的碗（同工寮 stealTarget：不先擋規則，按偷時再檢查） */
function plazaStealAimTarget(): PlazaAimTarget | null {
  if (performance.now() < plazaStealBanUntil) return null;
  for (const t of plazaAimTargets()) {
    if (t.carriedBy || !t.seated || t.phase === 'carried') continue;
    if (bowlOnReticle(t.bowl.x, t.bowl.y, t.bowl.z)) return t;
  }
  return null;
}
/** 可開偷的目標：瞄中＋通過規則 */
function plazaStealTarget(): PlazaAimTarget | null {
  const t = plazaStealAimTarget();
  if (!t || plazaStealCanTarget(t)) return null;
  return t;
}
/** 對方水平視線對目標點的 cos（>0.7 ≈ ±45° 內）。 */
function plazaGazeCos(t: PlazaAimTarget, tx: number, tz: number) {
  const ox = Number.isFinite(t.head?.x) ? t.head.x : t.x;
  const oz = Number.isFinite(t.head?.z) ? t.head.z : t.z;
  const dx = tx - ox, dz = tz - oz;
  const len = Math.hypot(dx, dz) || 1;
  const gaze = t.yaw + (t.lookYaw ?? 0);
  const fx = -Math.sin(gaze), fz = -Math.cos(gaze);
  return (fx * dx + fz * dz) / len;
}
/**
 * 不可偷／會被抓：
 * 1) 對方視野裡還有自己裝蚵的碗 → 別人偷不到
 * 2) 對方正看著你 → 你（被看的）不能偷對方
 * 對方視野沒碗、也沒看你 → 可偷
 */
function plazaWatchingMe(t: PlazaAimTarget) {
  // 自己的碗還在視野（±45°；distract lookYaw≥0.85 時會離開）
  if (t.count >= 1 && Number.isFinite(t.bowl.x + t.bowl.z) && plazaGazeCos(t, t.bowl.x, t.bowl.z) > 0.7) return true;
  // 正看著我（座位），被看的不能偷
  return plazaGazeCos(t, SEAT.x, SEAT.z) > 0.7;
}
function plazaOnStealCaught(nick: string) {
  caught++;
  penalty += eco.plazaStealPen;
  plazaStealCatches++;
  if (plazaStealCatches >= eco.plazaStealBanN) {
    plazaStealBanUntil = performance.now() + eco.plazaStealBanMs;
    plazaStealCatches = 0;
    const sec = Math.round(eco.plazaStealBanMs / 1000);
    toast(`${nick} 抓到你！罰 $${eco.plazaStealPen}・偷太多次先禁 ${sec} 秒`, '#ff8a7a');
  } else {
    toast(`${nick} 抓到你偷了！罰 $${eco.plazaStealPen}`, '#ff8a7a');
  }
  shake = 0.2; SFX.sting(); updHud();
}
/** 廣場飛殼／受擊世代：離開廣場後作廢延遲回呼，避免關場後還跑 hurt */
let plazaShellGen = 0;
/** 廣場被丟殼預警：和工寮阿婆一樣先蓄力約 1 秒、亮 ⚠ 方向＋提示，再飛過來 */
type PlazaWarn = { e: PlazaShellEvent; left: number; w0: number; warned: boolean; gen: number };
const plazaWarns: PlazaWarn[] = [];
const PLAZA_WINDUP = 1.0;
let plazaThrowToMe: { e: PlazaShellEvent; at: number } | null = null;
function plazaWarnStart(e: PlazaShellEvent) {
  const w: PlazaWarn = { e, left: PLAZA_WINDUP, w0: PLAZA_WINDUP, warned: !gearOn('radio'), gen: plazaShellGen };
  if (w.warned) SFX.alert();
  plazaWarns.push(w);
}
/** 每幀：倒數、收音機晚亮、時間到才飛殼並在落地時結算 */
function plazaWarnTick(dt: number): PlazaWarn | null {
  let show: PlazaWarn | null = null;
  for (let i = plazaWarns.length - 1; i >= 0; i--) {
    const w = plazaWarns[i];
    if (w.gen !== plazaShellGen || !plazaMode) { plazaWarns.splice(i, 1); continue; }
    w.left -= dt;
    if (!w.warned && w.left <= Math.min(w.w0, Math.max(0.5, w.w0 * 0.5))) { w.warned = true; SFX.alert(); }
    if (w.left <= 0) {
      plazaWarns.splice(i, 1);
      const gen = w.gen;
      try { plazaFlyShell(w.e); } catch { /* 動畫失敗也要結算 */ }
      later(0.55, () => { if (gen !== plazaShellGen) return; resolvePlazaInbound(w.e); });
      continue;
    }
    if (w.warned && (!show || w.left < show.left)) show = w;
  }
  return show;
}
function plazaShellCoordsOk(e: PlazaShellEvent) {
  return [e.fromX, e.fromY, e.fromZ, e.toX, e.toY, e.toZ].every(Number.isFinite);
}
function plazaFlyShell(e: PlazaShellEvent, onArrive?: () => void) {
  if (!plazaShellCoordsOk(e)) return;
  if (flyers.length > 40) return; // 連丟時節流，避免手機 WebGL 爆掉
  const sh = new THREE.Mesh(halfGeo, shellBotMat);
  const from = new THREE.Vector3(e.fromX, e.fromY, e.fromZ);
  const me = plazaConnId();
  // 打向自己＋第一人稱：跟工寮阿婆丟殼一樣追鏡頭，才看得到殼飛過來
  const atMeFp = !!(me && e.toConnId === me) && !tpv;
  const to: THREE.Vector3 | (() => THREE.Vector3) = atMeFp
    ? () => camera.position.clone().add(new THREE.Vector3(0, -0.05, 0))
    : new THREE.Vector3(e.toX, e.toY, e.toZ);
  try { SFX.whoosh(); } catch { /* */ }
  fly(sh, from, to, 0.55, atMeFp ? 0.4 : 0.35, () => { try { scene.remove(sh); onArrive?.(); } catch { /* */ } });
}
function resolvePlazaInbound(e: PlazaShellEvent) {
  if (!plazaMode || state !== 'play' || !isPlazaActive()) return;
  if (!plazaShellCoordsOk(e)) return;
  try {
    const U = umbNow(), up = umbT > 0 && umbAge() >= U.open, covered = up && Math.random() < U.cover;
    if (up && !covered) toast('傘縫裡鑽進來了！', '#ff9a8a');
    if (covered && umbAge() - U.open < U.perf) {
      reflects++; blockStreak++; umbHit3(new THREE.Vector3(e.toX, e.toY, e.toZ)); SFX.boing(); tone(1800, 0.08, 0.15, 'square');
      toast(`完美反彈！砸回 ${e.fromNick || '別人'}！✨`, '#ffe36a'); shake = 0.08;
      const from = { x: e.toX, y: e.toY, z: e.toZ };
      const back = { x: e.fromX, y: e.fromY, z: e.fromZ };
      const sh = new THREE.Mesh(halfGeo, shellBotMat);
      fly(sh, new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(back.x, back.y, back.z), 0.4, 0.15, () => { scene.remove(sh); SFX.hitNpc(); });
      // 通知原丟殼者：被反彈砸中（工寮反彈打中阿婆同概念）
      if (e.fromConnId) void plazaShellReflect(e.fromConnId, from, back);
    } else if (covered) {
      blocks++; blockStreak++; SFX.boing(); toast(`擋住 ${e.fromNick || '別人'} 的殼！`, '#9be37a');
      if (e.fromConnId) void plazaShellBlocked(e.fromConnId);
    } else {
      blockStreak = 0; hitsTaken++;
      const splat = document.getElementById('splat');
      if (splat) { splat.style.opacity = '1'; later(0.9, () => { splat.style.opacity = '0'; }); }
      hurt(8, `${e.fromNick || '別人'} 丟中你了！`); hitInHand();
      reportPlazaShellHit();
    }
    updHud();
  } catch (err) { console.error('plaza inbound', err); }
}
/** 自己丟的殼被對方完美反彈打回來（無法再擋，等同工寮反彈打中阿婆） */
function resolvePlazaReflectHit(e: PlazaShellEvent) {
  if (!plazaMode || state !== 'play' || !isPlazaActive()) return;
  try {
    blockStreak = 0; hitsTaken++;
    const splat = document.getElementById('splat');
    if (splat) { splat.style.opacity = '1'; later(0.9, () => { splat.style.opacity = '0'; }); }
    hurt(8, `${e.fromNick || '別人'} 把殼反彈回來砸中你了！`); hitInHand();
    reportPlazaShellHit();
    updHud();
  } catch (err) { console.error('plaza reflect hit', err); }
}
/** 自己丟的殼被對方雨傘擋住（非完美反彈，只提示） */
function resolvePlazaBlocked(e: PlazaShellEvent) {
  if (!plazaMode || state !== 'play' || !isPlazaActive()) return;
  toast(`${e.fromNick || '別人'} 擋住了你的殼！`, '#ffcf8a');
}
/** 本機被砸頭部世界座標（給全場噴血對齊） */
function plazaSelfBleedPos() {
  const p = new THREE.Vector3();
  if (tpv && plazaMe) {
    plazaMe.head.getWorldPosition(p); p.y += 0.08; return p;
  }
  if (tpv) {
    meHead.getWorldPosition(p); p.y += 0.08; return p;
  }
  p.copy(camera.position); p.y -= 0.02; return p;
}
function reportPlazaShellHit() {
  const p = plazaSelfBleedPos();
  void plazaShellHit({ x: p.x, y: p.y, z: p.z });
}
/** 廣場遠端可見：略大於一般 bleed，方便遠看；仍受 mix.gore 控制 */
function plazaBleedBurst(at: THREE.Vector3) {
  if (!mix.gore) return;
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.copy(at).add(new THREE.Vector3(rnd(-0.03, 0.03), rnd(-0.02, 0.04), rnd(-0.03, 0.03)));
    m.scale.setScalar(rnd(0.85, 1.9));
    scene.add(m);
    const sp = rnd(0.7, 1.5);
    const a = rnd(0, Math.PI * 2);
    drops.push({
      m,
      v: new THREE.Vector3(Math.cos(a) * sp * rnd(0.4, 0.9), rnd(0.9, 2.2), Math.sin(a) * sp * rnd(0.4, 0.9)),
    });
  }
}
/** 廣場任何人被殼砸中：全場（含本人）噴血 */
function resolvePlazaShellHitFx(e: PlazaShellHitEvent) {
  if (!plazaMode || !isPlazaActive()) return;
  if (![e.x, e.y, e.z].every(Number.isFinite)) return;
  plazaBleedBurst(new THREE.Vector3(e.x, e.y, e.z));
  try { SFX.hitNpc(); } catch { /* */ }
}
let plazaStealTgt: PlazaAimTarget | null = null;
function startPlazaSteal() {
  if (state !== 'play' || umbHeld || !plazaSeated()) return;
  if (performance.now() < plazaStealBanUntil) {
    toast(`偷被抓太多次，還要再等 ${Math.ceil((plazaStealBanUntil - performance.now()) / 1000)} 秒`, '#ffb08a');
    return;
  }
  // 同工寮：先對準碗；規則不符只 toast，被看著＝當場抓包
  const aimed = plazaStealAimTarget();
  if (!aimed) return;
  const why = plazaStealCanTarget(aimed);
  if (why) { toast(why, '#ffb08a'); return; }
  const t = aimed;
  plazaStealTgt = t; stealT = 0; SFX.sneak();
  if (plazaWatchingMe(t)) {
    plazaStealTgt = null; stealT = 0;
    plazaOnStealCaught(t.nick);
    void plazaStealFrom(t.connId, true);
  }
}
function stopPlazaSteal() { plazaStealTgt = null; stealT = 0; on('prog', phase === 'twist' || phase === 'crab' || phase === 'scoop'); }
async function finishPlazaSteal(t: PlazaAimTarget) {
  stopPlazaSteal();
  if (t.count < eco.plazaStealMinCount) { toast('對方碗裡太少，先別偷', '#ffb08a'); return; }
  const r = await plazaStealFrom(t.connId, false);
  if (!r.ok || !r.steal) { toast(plazaZhErr(r.err), '#ffb08a'); return; }
  if (r.steal.caught) {
    plazaOnStealCaught(t.nick);
    return;
  }
  count = r.steal.fromCount;
  meatPay += eco.dpay[eco.yardStealDiff] ?? eco.dpay[1]; steals++; evMeat();
  plazaStealPairCd.set(t.connId, performance.now() + PLAZA_STEAL_PAIR_MS);
  const m = new THREE.Mesh(meatGeo, meatMat);
  const from = new THREE.Vector3(t.bowl.x, t.bowl.y, t.bowl.z);
  fly(m, from, BOWL.clone().add(new THREE.Vector3(rnd(-0.08, 0.08), 0.06, rnd(-0.08, 0.08))), 0.5, 0.3, () => bowlMeat.push(m));
  SFX.sneak(); toast(`偷到 ${t.nick} 一顆！`, '#c9a0ff'); updHud();
}
// ----- 6. 擲殼仔 -----
/** 對人丟殼才算 thrown（和平主義）；丟地上／殼堆不算 */
function noteHostileThrow() {
  thrown++;
  if (phase === 'seam') { abandoned++; wasteShells++; }
}
function throwShell() {
  if (state !== 'play' || (phase !== 'empty' && phase !== 'seam')) return;
  const from = worldOf(oyster); oyster.visible = false;
  const sh = new THREE.Mesh(halfGeo, shellBotMat); SFX.whoosh();
  if (plazaMode) {
    try {
      const finite3 = (v: THREE.Vector3) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
      if (!finite3(from)) { scene.remove(sh); setPhase('busy'); later(0.6, goPick); return; }
      const pt = plazaThrowTarget();
      if (pt?.connId && pt.head && Number.isFinite(pt.head.x) && Number.isFinite(pt.head.y) && Number.isFinite(pt.head.z)) {
        noteHostileThrow();
        const to = new THREE.Vector3(pt.head.x, pt.head.y, pt.head.z);
        fly(sh, from, to, 0.5, 0.3, () => { try { scene.remove(sh); shellHits++; SFX.hitNpc(); toast(`丟向 ${pt.nick}！`, '#ffb070'); updHud(); } catch { /* */ } });
        void plazaThrowAt(pt.connId, from, to);
      } else {
        // 沒瞄人：當丟地上／殼堆，不破和平
        if (phase === 'seam') { abandoned++; wasteShells++; }
        const a = aimPoint(); a.y = 0.02;
        if (!finite3(a)) a.set(from.x, 0.02, from.z - 1);
        fly(sh, from, a, 0.6, 0.5, () => later(2, () => scene.remove(sh)));
        void plazaShellFx(from, a);
      }
    } catch (err) {
      console.error('plaza throw', err);
      try { scene.remove(sh); } catch { /* */ }
    }
    setPhase('busy'); later(0.6, goPick);
    return;
  }
  let target: Npc | undefined;
  const cam = viewCam();
  for (const n of npcs) { const p = worldOf(n.head).project(cam); if (p.z < 1 && Math.abs(p.x) < 0.25 && Math.abs(p.y) < 0.45) target = n; }
  if (target) {
    noteHostileThrow();
    const t = target;
    fly(sh, from, () => worldOf(t.head), 0.5, 0.3, () => { scene.remove(sh); shellHits++; SFX.hitNpc(); toast(`丟中${t.name}！`, '#ffb070'); anger(t, SCOLD_SHELL, 0.6); addGrudge(t, 35); npcHurt(t); updHud(); });
  } else {
    // 沒準星瞄人：丟地上，不再隨機「丟歪打中」（會冤枉破和平）
    if (phase === 'seam') { abandoned++; wasteShells++; }
    const a = aimPoint(); a.y = 0.02;
    fly(sh, from, a, 0.6, 0.5, () => later(2, () => scene.remove(sh)));
  }
  setPhase('busy'); later(0.6, goPick);
}
// ----- 7. 阿婆擲殼仔 + 雨傘 -----
function windUp(n: Npc) { if (n.windup > 0 || state !== 'play' || stunned(n)) return; n.windup = Math.max(0.45, 1.0 - (n.grudge ?? 0) * 0.005); n.w0 = n.windup; n.warned = !gearOn('radio'); n.look = 1.6; if (n.warned) SFX.alert(); }
// 收音機開著：預警變晚（剩一半時間才出現，至少 0.5 秒）
const warnLead = (n: Npc) => Math.min(n.w0 ?? n.windup, Math.max(0.5, (n.w0 ?? n.windup) * 0.5));
function npcThrow(n: Npc) {
  if (stunned(n)) return;
  const shots = (n.grudge ?? 0) >= 90 ? 3 : 1;
  if (shots > 1) { addGrudge(n, -35); say(n, '看我連環殼！', 2); }
  for (let i = 0; i < shots; i++) later(i * 0.4, () => throwOne(n));
}
function throwOne(n: Npc) {
  if (state !== 'play') return;
  const sh = new THREE.Mesh(pick(HALF_GEOS), shellM(greyPick())); const from = worldOf(n.head); SFX.whoosh();
  fly(sh, from, () => camera.position.clone().add(new THREE.Vector3(0, -0.05, 0)), 0.55, 0.4, () => {
    const U = umbNow(), up = umbT > 0 && umbAge() >= U.open, covered = up && Math.random() < U.cover;
    if (up && !covered) toast('傘傷細，殼仔對邊仔鑽入來！', '#ff9a8a');
    if (covered && umbAge() - U.open < U.perf) { // 拄開好的時陣 = 完美反彈
      reflects++; blockStreak++; umbHit3(sh.position); SFX.boing(); tone(1800, 0.08, 0.15, 'square'); toast('完美反彈！✨', '#ffe36a'); shake = 0.08;
      fly(sh, sh.position.clone(), () => worldOf(n.head), 0.4, 0.15, () => { scene.remove(sh); SFX.hitNpc(); addGrudge(n, Math.round(20 * U.reflect)); npcHurt(n, U.reflect); });
    } else if (covered) { umbHit3(sh.position); scene.remove(sh); blocks++; blockStreak++; SFX.boing(); toast('擋住了！啵嗯～', '#9be37a'); say(n, pick(['怎麼會有雨傘啦！', '狡怪喔你！', '什麼時候拿出來的！']), 2.5); }
    else { scene.remove(sh); blockStreak = 0; hitsTaken++; ($('splat') as HTMLElement).style.opacity = '1'; later(0.9, () => ($('splat') as HTMLElement).style.opacity = '0'); hurt(8, '哎唷！被丟中了！'); hitInHand(); }
    if (blockStreak >= 3 && !evRun) { blockStreak = 0; npcs.forEach((m, i) => { m.calm = 45; if (i === 0) later(0.8, () => say(m, `這個${myName()}真勇敢……`, 3)); }); toast('阿婆們怕你了，暫時比較少丟', '#9fe0ff'); achBump('sc'); }
    updHud();
  });
}
function hitInHand() {
  if (phase === 'twist' || phase === 'seam') {
    if (Math.random() < 0.5) { lost++; abandoned++; const sh = new THREE.Mesh(shellGeo, shellTopMat); oyster.visible = false; const a = worldOf(oyster); fly(sh, a, a.clone().setY(0.02).add(new THREE.Vector3(rnd(-0.3, 0.3), 0, -0.3)), 0.5, 0.2, () => later(3, () => scene.remove(sh))); toast('蚵仔掉到地上了！', '#ff9a8a'); progress = 0; shellTop.rotation.z = 0; setPhase('busy'); later(0.8, goPick); }
    else if (phase === 'twist') { progress = 0; shellTop.rotation.z = 0; combo = 0; toast('撬到一半，殼又合回去了…', '#ff9a8a'); }
  }
}
let umbHeld = false, umbTired = false;
// 按住開傘、放開就收；沒有冷卻。撐太久（超過該傘的「可撐」秒數）手會痠自動收起，要放開再按。
function openUmbrella() { if (state !== 'play' || umbHeld || umbTired) return; const u = umbNow(); umbHeld = true; umbT = umbLen = u.open + u.dur; umb.visible = true; SFX.pop(); $('umbBtn').classList.add('held'); }
function closeUmbrella() { umbTired = false; if (!umbHeld && umbT <= 0) return; umbHeld = false; umbT = 0; $('umbBtn').classList.remove('held'); }
let umbLen = 0.9;
const umbAge = () => umbLen - umbT;
// ----- 4. 偷蚵仔 -----
function stealTarget() {
  for (const n of npcs) {
    if (bowlOnReticle(n.bowl.x, n.bowl.y, n.bowl.z, 0.16)) return n;
  }
  return null;
}
function startSteal() {
  if (plazaMode) { startPlazaSteal(); return; }
  if (state !== 'play' || umbHeld || evRun?.steal === 'no_steal') return; const n = stealTarget(); if (!n) return; stealNpc = n; stealT = 0; SFX.sneak(); if (!freeToSteal(n)) caughtBy(n);
}
function stopSteal() {
  if (plazaMode) { stopPlazaSteal(); return; }
  stealNpc = null; stealT = 0; on('prog', phase === 'twist' || phase === 'crab' || phase === 'scoop');
}
function caughtBy(n: Npc) {
  caught++; stopSteal(); penalty += eco.yardStealFine;
  n.distract = 0; n.pause = 0; addGrudge(n, 20); anger(n, SCOLD_STEAL, 0.5); toast(`被抓到了！罰 $${eco.yardStealFine}`, '#ff8a7a'); shake = 0.2; SFX.sting(); updHud();
}
function stealOne(n: Npc) {
  if (n.count <= 0) { toast('碗裡沒肉了'); stopSteal(); return; }
  n.count--; count++; evMeat(); meatPay += eco.dpay[eco.yardStealDiff] ?? eco.dpay[1]; steals++; addGrudge(n, 12); const m = new THREE.Mesh(meatGeo, meatMat);
  const lm = n.bowlMeat.pop(); if (lm) scene.remove(lm);
  fly(m, n.bowl.clone(), BOWL.clone().add(new THREE.Vector3(rnd(-0.08, 0.08), 0.06, rnd(-0.08, 0.08))), 0.5, 0.3, () => bowlMeat.push(m));
  SFX.sneak(); toast('偷到一顆！', '#c9a0ff'); updHud();
}
function lifeHtml() { const L = save.life, w = L.opened + L.wasteShells ? Math.round((L.missed + L.wasteShells) / (L.opened + L.wasteShells) * 100) : 0;
  const tl = Object.entries(save.titles).map(([k, v]) => `${k} ×${v}`).join('、') || '（猶無）';
  return `<h3>生涯紀錄</h3><p style="font-size:13px;line-height:1.6">工作 ${save.days} 天・累積收入 $${save.money}・最佳 ${save.best} 顆<br>開殼 ${L.opened}・入碗 ${L.inBowl}・浪費率 ${w}%・殼屑 ${L.cracked}<br>完美／俐落 ${L.perfects}・最長連擊 ${L.bestCombo}・放棄 ${L.abandoned}・割手 ${L.stabs}<br>偷 ${L.steals}/被抓 ${L.caught}・丟中阿婆 ${L.shellHits}・被丟中 ${L.hitsTaken}・擋 ${L.blocks}・反彈 ${L.reflects}<br>稱號：${tl}</p>`; }
let lastPay = { gross: 0, pen: 0, earn: 0 }, nameWait = false;
function endDay() { inputGuard(); if (document.pointerLockElement) document.exitPointerLock();
  if (tut) { tutEnd(false); return; }
  if (state === 'end') return; state = 'end'; if (plazaMode) plazaShellGen++; syncShiftUi(); setTimeout(giftAlert, 1500); setPhase('busy'); closeUmbrella(); on('umbBtn', false); on('medBtn', false); on('quitBtn', false); on('camBtn', false); $('radioBtn').style.display = 'none'; document.getElementById('vign')?.classList.remove('on'); $('medList').classList.remove('show'); on('stealBtn', false); stopSteal();
  const all = [{ name: `你（${esc(myName())}）`, count, me: true }, ...npcs.map(n => ({ name: n.name, count: n.count, me: false }))].sort((a, b) => b.count - a.count);
  const temp = shiftLen < SHIFT, worked = endReason !== 'quit' && count >= eco.workedMinCount, queen = all[0].me && !temp && worked;
  const pearlMoney = dayPearls.reduce((s, r) => s + RAR[r].price, 0) + dayOdd.reduce((s, r) => s + ODD[r].price, 0);
  const titles: string[] = []; let bonus = 0;
  if (!plazaMode && !roomPlay) {
    if (thrown === 0 && !temp && worked) { titles.push(`🕊 和平${esc(myName())}（+$${eco.peaceBonus}）`); bonus = eco.peaceBonus; }
    if (worked && shellHits >= 3 && shellHits > hitsTaken) titles.push('👊 工寮霸主');
    if (worked && blocks + reflects >= 3 && blocks + reflects > hitsTaken) titles.push('☂ 雨傘大師');
  }
  const LC = locNow(), base0 = meatPay + perfects * eco.perfectPay + bowlBonus + pearlMoney, locBonus = Math.round(base0 * (LC.m - 1)), nightBonus = nightShift ? Math.round((base0 + locBonus) * eco.nightMult) : 0;
  const ev = evRun, evDone = !!ev && endReason !== 'quit' && !handPain, evEarly = evDone && endReason === 'early', evCash = ev && evDone ? Math.max(0, ev.bonus) + (evEarly ? Math.max(0, ev.earlyBonus) : 0) : 0;
  const earn = Math.max(0, base0 + locBonus + nightBonus + bonus - penalty) + evCash; lastPay = { gross: base0 + locBonus + nightBonus + bonus + evCash, pen: penalty, earn };
  const waste = opened + wasteShells ? Math.round((missed + wasteShells) / (opened + wasteShells) * 100) : 0;
  const durSec = plazaMode && plazaPlayAt
    ? Math.max(1, Math.round((performance.now() - plazaPlayAt) / 1000))
    : Math.round(shiftLen - Math.max(0, timeLeft));
  const seatLabel = plazaMode ? (() => { const s = plazaMySeat(); return s ? `p${s.pileId}s${s.slot}` : 'plaza'; })() : (save.seat ?? 'door');
  if (!plazaMode && !roomPlay) save.days++;
  tickTrial(); autoUnlock(); save.best = Math.max(save.best, count); if (queen && !plazaMode && !roomPlay) { save.queen++; titles.unshift('👑 今日剝蚵冠軍'); }
  const L = save.life; L.opened += opened; L.inBowl += count; L.missed += missed; L.wasteShells += wasteShells; L.cracked += cracked; L.perfects += perfects; L.abandoned += abandoned; L.stabs += stabs; L.steals += steals; L.caught += caught; L.meatHits += meatHits; L.shellHits += shellHits; L.hitsTaken += hitsTaken; L.blocks += blocks; L.reflects += reflects; L.lost += lost;
  if (!plazaMode && !roomPlay) {
    for (const tt of titles) { const k = tt.replace(/（.*）/, ''); save.titles[k] = (save.titles[k] ?? 0) + 1; }
    achShift({ worked, temp, waste, cracked, steals, caught, hitsTaken, thrown, ev, evDone, evEarly, cnt: count });
  }
  const evHtml = ev ? evFinish(ev, evDone, evEarly) : '';
  const creditLocal = () => {
    save.money += lastPay.earn; persist();
    if (!tut && !SHOT) Social.addPlayIncome(Math.max(0, lastPay.earn), { oysters: count, pearls: save.dex.reduce((a, b) => a + b, 0) });
  };
  if (roomPlay) {
    persist();
    plazaPayWait = null;
    track('room_end', { loc: locNow().id, item: 'room', count, earn, dur: durSec, reason: endReason });
  } else if (plazaMode) {
    persist();
    track('plaza_end', { loc: locNow().id, item: 'plaza', count, opened, missed, perfects, cracked, earn, pearls: dayPearls.length + dayOdd.length, waste, combo: dayCombo, dur: durSec, seat: seatLabel, reason: handPain ? 'hand' : endReason, dstat: dstatStr(), mode: 'plaza' });
    plazaPayWait = plazaReportEarn(earn, count, durSec).then(payout => {
      lastPay.earn = payout;
      creditLocal();
      const note = payout !== earn ? `<p style="color:#9be37a">廣場結算 $${payout}（本機試算 $${earn}）</p>` : `<p style="color:#9be37a">廣場結算 $${payout}</p>`;
      $('resBody')?.insertAdjacentHTML('beforeend', note + `<p style="font-size:13px;opacity:.8">身上共有 $${save.money}</p>`);
      return payout;
    });
  } else {
    plazaPayWait = null;
    creditLocal();
    track('day', { loc: locNow().id, item: 't' + shiftLen, count, opened, missed, perfects, cracked, steals, caught, shellHits, earn, pearls: dayPearls.length + dayOdd.length, waste, combo: dayCombo, maxAnger: Math.round(dayMaxGrudge), double: dayMulti2, triple: dayMulti3, dur: durSec, dex: dexN(), seat: seatLabel, reason: handPain ? 'hand' : endReason, dstat: dstatStr() });
  }
  $('resTitle').textContent = plazaMode ? (handPain ? '🩹 手痛收工' : '廣場休息一下～') : ev ? (evEarly ? `${ev.name}・提前完工！` : evDone ? `${ev.name}・完工` : `${ev.name}・提早收工`) : handPain ? '🩹 手痛收工' : queen ? '👑 今日剝蚵冠軍！' : '收工了～';
  const nightPct = Math.round(eco.nightMult * 100);
  const crumbPct = Math.round(eco.crumbRate * 100);
  const dpayHint = eco.dpay.map((p, i) => `${DSHORT[i]}$${p}`).join('・');
  const plazaEarnHtml = `<p>蚵仔 ${count} 顆 = $${meatPay}（${dCnt.map((c, i) => `${DSHORT[i]}×${c}`).join(' ')}）` +
    `${perfects ? `<br>完美／俐落 ${perfects} 次 × $${eco.perfectPay}` : ''}${bowlBonus ? `<br>臉盆加價 +$${bowlBonus}` : ''}` +
    `<br>珍珠／奇物 ${dayPearls.length + dayOdd.length} 件 = $${pearlMoney}` +
    `${penalty ? `<br>罰款／扣價 -$${penalty}` : ''}${locBonus ? `<br>${LC.n} 工錢 ×${LC.m}：+$${locBonus}` : ''}${nightBonus ? `<br>🌙 夜班加成 +${nightPct}%：+$${nightBonus}` : ''}` +
    `<br><b style="font-size:20px">這趟收入 $${earn}</b>（待伺服器確認）</p>` +
    `<p style="font-size:13px;opacity:.8">玩了約 ${Math.floor(durSec / 60)} 分 ${durSec % 60} 秒</p>`;
  const yardEarnHtml = `<p>蚵仔 ${count} 顆 = $${meatPay}（${dCnt.map((c, i) => `${DSHORT[i]}×${c}`).join(' ')}）<br><small>每顆 ${dpayHint}，殼屑 ${cracked} 顆只算 ${crumbPct}%${temp ? `，臨時工抽成 -$${eco.tempCut}／顆` : ''}</small>${perfects ? `<br>完美／俐落 ${perfects} 次 × $${eco.perfectPay}` : ''}${bowlBonus ? `<br>臉盆加價 +$${bowlBonus}` : ''}<br>珍珠／奇物 ${dayPearls.length + dayOdd.length} 件 = $${pearlMoney}<br>罰款／扣價 -$${penalty}${locBonus ? `<br>${LC.n} 工錢 ×${LC.m}：+$${locBonus}` : ''}${nightBonus ? `<br>🌙 夜班加成 +${nightPct}%：+$${nightBonus}` : ''}${bonus ? `<br>和平獎金 +$${bonus}` : ''}<br><b style="font-size:20px">今日收入 $${earn}</b></p>` +
    `<p style="font-size:13px;opacity:.8">累積收入 $${save.money}・最佳紀錄 ${save.best} 顆・拿冠軍 ${save.queen} 次</p>`;
  $('resBody').innerHTML = evHtml + (plazaMode ? '' : all.map((a, i) => `<div class="row"><span>${i + 1}. ${a.name}</span><b>${a.count} 顆入碗</b></div>`).join('')) +
    `<p style="font-size:14px">開殼 ${opened}・入碗 ${count}・無入 ${missed}・浪費率 <b>${waste}%</b><br>殼屑 ${cracked}・完美／俐落 ${perfects}・放棄 ${abandoned}・割手 ${stabs}` +
    (plazaMode ? '' : `<br>偷 ${steals}・被抓到 ${caught}・肉丟中阿婆 ${meatHits}・殼丟中阿婆 ${shellHits}<br>雨傘擋 ${blocks}・完美反彈 ${reflects}・被丟中 ${hitsTaken}・丟殼 ${thrown}・蚵仔掉地上 ${lost}`) +
    `</p>` + (!plazaMode && titles.length ? `<p style="font-size:18px"><b>${titles.join('　')}</b></p>` : '') +
    (plazaMode ? plazaEarnHtml : yardEarnHtml) +
    `<p>${plazaMode ? '廣場休閒模式，不趕時間，想剝就剝～' : caught >= 2 ? '阿婆們：「明天你自己坐一邊！」' : waste >= 30 ? '阿婆們：「地上都是蚵仔肉，明天準一點！」' : queen ? '阿婆們：「哎唷，今天被你贏走了！」' : `${all[0].name}：「明天再來拚喔～」`}</p>`;
  if (achShiftGot.length && !plazaMode) $('resBody').insertAdjacentHTML('afterbegin', `<div class="resAch"><b><i class="ic ic-trophy"></i> 這一工達成的成就</b><ul>${achShiftGot.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
  if (ev) { evLastId = ev.id; evRun = null; evToken = null; shiftLen = SHIFT; } else evLastId = null;
  const againBtn = $('again');
  if (againBtn) { againBtn.style.display = plazaMode ? 'none' : ''; againBtn.innerHTML = `<i class="ic ic-again"></i> 再次上工`; }
  // 廣場結算：藏廣場 UI／再次上工；等伺服器入帳前標示結算中
  if (plazaMode) {
    plazaEndCleanup();
    clearPlazaLeaveUi();
    on('quitBtn', false); on('standBtn', false); on('throwBtn', false); on('umbBtn', false); on('stealBtn', false); on('sitBtn', false); on('giveUp', false); on('medBtn', false); on('camBtn', false);
    const menuBtn = $('resMenu');
    if (menuBtn) { menuBtn.innerHTML = pendingShed ? `<i class="ic ic-pin"></i> 前往 ${shedName(pendingShed.loc)} 上工` : `<i class="ic ic-home"></i> 回主選單`; (menuBtn as HTMLButtonElement).disabled = true; }
    void plazaPayWait?.then(() => {
      const b = $('resMenu') as HTMLButtonElement | null;
      if (b) b.disabled = false;
    }).catch(() => {
      const b = $('resMenu') as HTMLButtonElement | null;
      if (b) b.disabled = false;
    });
  }
  if (!plazaMode) { const mb = $('resMenu'); if (mb) mb.innerHTML = shedTrip ? `<i class="ic ic-pin"></i> 回廣場` : `<i class="ic ic-home"></i> 回主選單`; }
  if (!roomPlay) $('result').classList.add('show'); $('resEvLb')?.addEventListener('click', () => evLbOpen(ev!.id)); if (ac) SFX.endJingle(queen && !handPain && !plazaMode);
}
function revealPearl(r: number) { react3('cheer');
  sleeveGold(); dayPearls.push(r); save.dex[r]++; if (r === 3) { save.legendDry = 0; save.legendN = legendTotal(); } persist(); Social.report('pearl', r); track('find', { kind: 'pearl', item: 'pearl-' + r, rarity: rarOf(RAR[r].w), seat: save.seat ?? 'door', knife: knifeNow().id, luck: luckNow(), dex: dexN() }); renderDex();
  slowmo = 2.6; pearlShow = 2.6;
  (pearlMesh.material as THREE.MeshStandardMaterial).color.setHex(RAR[r].color);
  (pearlMesh.material as THREE.MeshStandardMaterial).emissive.setHex(r === 3 ? 0x302050 : RAR[r].color).multiplyScalar(0.25);
  pearlMesh.visible = true; ding(r);
  label.innerHTML = `${RAR[r].name}！<small>${save.dex[r] === 1 ? '🆕 第一次找到！' : `你的第 ${save.dex[r]} 個`}</small><small>${['阿婆們都轉頭來看了！', '哇～粉紅色的，好漂亮！', '金光閃閃，今天發了！', '黑珍珠！！整個漁港都轟動了！'][r]}</small>`;
  label.style.color = RAR[r].css === '#3a3548' ? '#c9b8ff' : RAR[r].css; label.classList.add('on');
  const cries = ['哎唷！珍珠！', '給我看看！', '好運喔你！', '老天爺保佑！'];
  npcs.forEach((n, i) => { n.look = 2.6; say(n, cries[(i + r) % cries.length], 2.6); });
}
function renderDex() {
  const RZ: Record<string, string> = { common: '普通', uncommon: '少見', rare: '稀有', legend: '傳說' };
  const all = [
    ...RAR.map((r, i) => ({ name: r.name, color: r.css, weight: r.w, price: r.price, tease: r.tease, emoji: r.emo as string | undefined, icon: undefined as string | undefined, line: undefined as string | undefined, has: save.dex[i] ?? 0 })),
    ...ODD.map((o, i) => ({ name: o.name, color: o.color, weight: o.weight, price: o.price, tease: o.tease, emoji: o.emoji, icon: o.icon, line: o.line, has: save.odd[i] ?? 0 })),
  ];
  const item = (x: typeof all[number]) => { const rr = rarOf(x.weight); return `<div class="dexItem ${x.has ? '' : 'locked'}">${x.has ? `<div class="dot" style="background:${x.color};box-shadow:0 0 8px ${x.color}">${x.icon ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1e1a16" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${x.icon}</svg>` : (x.emoji ?? '')}</div>` : '<div class="dot unk" aria-hidden="true">?</div>'}<div><b>${x.has ? x.name : '？？？'}</b>${x.has ? ` <span class="dexN">×${x.has}</span>` : ''} <span class="rb r-${rr}">${RZ[rr]}</span><br><small>${x.has ? `收集 ${x.has} 件・值 ${x.price}${x.line ? `<br>「${x.line}」` : ''}` : `💭 ${x.tease}`}</small></div></div>`; };
  const got = all.filter(x => x.has).length;
  const per = (['common', 'uncommon', 'rare', 'legend'] as const).map(r => { const xs = all.filter(x => rarOf(x.weight) === r); return `<span class="rb r-${r}">${RZ[r]} ${xs.filter(x => x.has).length}/${xs.length}</span>`; }).join(' ');
  $('dexList').innerHTML = `<div class="dexProg"><b>已收集 ${got} / ${all.length} 種</b>・累計挖到 <b>${all.reduce((a, x) => a + x.has, 0)}</b> 個<div class="dexBar"><i style="width:${got / all.length * 100}%"></i></div>${per}</div>` +
    '<h3>珍珠</h3>' + all.slice(0, RAR.length).map(item).join('') + '<h3>奇物</h3>' + all.slice(RAR.length).map(item).join('') + lifeHtml();
}
renderDex();

// ---------- 操作 ----------
let down: { x: number; y: number; id: number; drag: boolean; yaw: number; pitch: number; tp?: number; rotMode: boolean; lx: number; lt: number; swiped?: boolean } | null = null;
/** 廣場坐下：第三人稱不轉頭；第一人稱左右 ±90°；工寮仍用 YAW */
const PLAZA_SIT_YAW = Math.PI / 2;
const yl = () => {
  if (walking) return 1e9;
  // 廣場第三人稱坐下：鏡頭可 360° 繞轉（身體朝向另鎖 seatYaw）
  if (plazaMode) return tpv ? 1e9 : PLAZA_SIT_YAW;
  return YAW;
};
const pitchLo = () => P0;
const pitchHi = () => plazaMode && !walking ? 0.55 : P1;
/** 廣場第三人稱（走動／坐下）：鏡頭俯仰用 tpPitch，不改 pitch（避免同步到遠端點頭） */
const plazaTpOrbitPitch = () => plazaMode && tpv;
/** @deprecated alias — 舊名仍給讀碼用 */
const plazaTpWalkLockPitch = () => plazaTpOrbitPitch();
const PLAZA_WALK_PITCH = -0.2; let tpPitch = 0.41; let walkMovingT = 0; const tpPitchFree = () => performance.now() - walkMovingT > 200;

/** 手機環視：只轉鏡頭、不轉角色朝向／移動方向；放開後約 0.3 秒轉回身後 */
const FL_YAW_MAX = 150 * Math.PI / 180, FL_RETURN = 0.3;
let flHeld = false, flPtr = -1, flDragId = -1, flYaw = 0, flRet = 0, flRetFrom = 0;
let flDown: { x: number; y: number; yaw: number; tp: number; pitch: number } | null = null;
let pinchOn = false;
function flWrap(a: number) { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; }
function flPaintBtn() { document.getElementById('lookBtn')?.classList.toggle('held', flHeld); }
function flBeginHold(e: PointerEvent) {
  if (state !== 'play') return;
  // 廣場坐下第三人稱：把已繞出去的鏡頭差轉進 flYaw，放開才會回到角色背後
  if (!walking && plazaMode && tpv) {
    flYaw = clamp(flWrap((yaw + flYaw) - seatYaw), -FL_YAW_MAX, FL_YAW_MAX);
    yaw = tYaw = seatYaw;
  }
  flHeld = true; flPtr = e.pointerId; flRet = 0; flPaintBtn();
  try { (e.currentTarget as HTMLElement | null)?.setPointerCapture(e.pointerId); } catch { }
  flDragId = e.pointerId;
  flDown = { x: e.clientX, y: e.clientY, yaw: flYaw, tp: tpPitch, pitch: tPitch };
}
function flStartDrag(e: PointerEvent) {
  flDragId = e.pointerId;
  flDown = { x: e.clientX, y: e.clientY, yaw: flYaw, tp: tpPitch, pitch: tPitch };
}
function flApplyDrag(e: PointerEvent) {
  if (!flDown || pinchOn) return;
  const dx = e.clientX - flDown.x, dy = e.clientY - flDown.y;
  const k = 0.006 * mix.sens;
  const xS = mix.invX ? -1 : 1;
  flYaw = clamp(flDown.yaw - dx * k * xS, -FL_YAW_MAX, FL_YAW_MAX);
  if (plazaTpOrbitPitch() && tpPitchFree()) tpPitch = clamp((flDown.tp ?? tpPitch) + dy * k * 0.8, 0.05, 1.1);
  else if (!plazaTpOrbitPitch()) {
    tPitch = clamp(flDown.pitch - dy * k * (mix.invY ? -1 : 1), pitchLo(), pitchHi());
    pitch = tPitch;
    if (!tpv) { camera.rotation.set(pitch, yaw + flYaw + (walking ? 0 : seatYaw), 0); camera.updateMatrixWorld(); }
  }
}
function flRelease() {
  if (!flHeld && flPtr < 0 && !flDown) return;
  flHeld = false; flPtr = -1; flDragId = -1; flDown = null; flPaintBtn();
  if (Math.abs(flYaw) < 1e-4) { flYaw = 0; flRet = 0; return; }
  flRetFrom = flYaw; flRet = FL_RETURN;
}
function flTick(dt: number) {
  if (flHeld) return;
  if (flRet <= 0) { flYaw = 0; return; }
  flRet = Math.max(0, flRet - dt);
  const u = 1 - flRet / FL_RETURN, k = u * u * (3 - 2 * u);
  flYaw = flRetFrom * (1 - k);
  if (flRet <= 0) flYaw = 0;
}
function placeLookBtn() {
  const btn = document.getElementById('lookBtn');
  if (!btn) return;
  const show = COARSE && state === 'play';
  btn.classList.toggle('on', show);
  if (!show) {
    if (flHeld) flRelease();
    btn.style.right = ''; btn.style.bottom = '';
    return;
  }
  const ids = ['poseBtn', 'jumpBtn', 'crouchBtn', 'lieBtn', 'umbBtn', 'puffBtn', 'throwBtn', 'stealBtn', 'flagBtn', 'flagPullBtn'];
  let minL = Infinity, maxB = 0;
  const consider = (el: HTMLElement | null) => {
    if (!el) return;
    if (el.id === 'lookBtn' || el.id === 'camBtn' || el.id === 'rotL' || el.id === 'rotR') return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    if (r.right < innerWidth * 0.45) return;
    minL = Math.min(minL, r.left);
    maxB = Math.max(maxB, r.bottom);
  };
  for (const id of ids) consider(document.getElementById(id));
  const box = document.getElementById('btns');
  if (box) for (const el of Array.from(box.querySelectorAll('button')) as HTMLElement[]) consider(el);
  if (!isFinite(minL) || maxB <= 0) { btn.style.right = ''; btn.style.bottom = ''; return; }
  btn.style.right = Math.max(8, innerWidth - minL + 8) + 'px';
  btn.style.bottom = Math.max(8, innerHeight - maxB) + 'px';
}
const YAW = 1.25, P0 = -1.05, P1 = 0.15;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const swipePhase = () => phase === 'twist' || phase === 'crab';
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (state !== 'play') return; audio().resume(); if (umbHeld) { hint.textContent = '撐著傘不能剝蚵，先放開雨傘'; return; }
  // 奇物展示：點一下跳過阿婆湊近觀看
  if (skipOddShow()) return;
  if (moonAimOn) { down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, yaw: tYaw, pitch: tPitch, tp: tpPitch, rotMode: false, lx: e.clientX, lt: performance.now() }; return; }
  if (swipePhase()) { pry(e.timeStamp); if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) canvas.requestPointerLock(); return; }
  if (!walking && !plazaMode && e.button === 0) {
    const tipNpc = hitNpcTag(e.clientX, e.clientY);
    if (tipNpc) { npcTip(tipNpc); return; }
  }
  if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  // 按住環視鈕時：這根或另一根手指只轉鏡頭，不轉角色、也不當剝殼點選
  if (flHeld && e.pointerId !== flPtr) { flStartDrag(e); return; }
  if (walking) { down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: true, yaw: tYaw, pitch: tPitch, tp: tpPitch, rotMode: false, lx: e.clientX, lt: performance.now() }; return; }
  if (e.button === 2) { throwShell(); return; }
  // 坐下：預設先當轉視角（跟走動一樣跟手）；點蚵／點網靠 pointerup 小位移仍算點
  down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: true, yaw: tYaw, pitch: tPitch, tp: tpPitch, rotMode: e.pointerType !== 'mouse' && phase === 'seam' && hitsOyster(e.clientX, e.clientY), lx: e.clientX, lt: performance.now() };
});
let lastMoveT = performance.now();
window.addEventListener('pointermove', e => {
  const now = performance.now();
  if (e.pointerType === 'mouse' && state === 'play' && !(moonAimOn && down)) {
    if (swipePhase()) { lastMoveT = now; return; }
    lastMoveT = now;
    if (document.pointerLockElement === canvas) {
      const k = 0.0022 * mix.sens;
      // 桌面 Pointer Lock：yaw 減＝往右看（與死鬥／觸控 FPS 同向）；反轉左右再開 invX
      const xS = mix.invX ? -1 : 1;
      yaw = tYaw = clamp(tYaw - e.movementX * k * xS, -yl(), yl());
      if (plazaTpWalkLockPitch()) { pitch = tPitch = PLAZA_WALK_PITCH; if (tpPitchFree()) tpPitch = clamp(tpPitch + e.movementY * k * 0.8, 0.05, 1.1); }
      else pitch = tPitch = clamp(tPitch - e.movementY * k * (mix.invY ? -1 : 1), pitchLo(), pitchHi());
      camera.rotation.set(pitch, yaw + flYaw + (walking ? 0 : seatYaw), 0); camera.updateMatrixWorld();
    }
    return;
  }
  if (flHeld && flDown && e.pointerId === flDragId) { flApplyDrag(e); return; }
  if (!down || down.id !== e.pointerId) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  // 曾滑出點選死區就記住：放開時即使滑回原處也不當點（避免轉視角後誤拿蚵）
  if (!down.swiped && Math.hypot(dx, dy) > 16) down.swiped = true;
  if (swipePhase() && !moonAimOn) return;
  if (down.rotMode) { rot += (e.clientX - down.lx) * 0.012; down.lx = e.clientX; rotTipTouch(); if (Math.abs(dx) > 8) { down.drag = true; rotTipDragged(); } return; }
  // 拿蚵觸控：微滑才升格「認真拖」，其餘坐下已 drag 立刻轉頭
  const dragSlop = phase === 'pick' && e.pointerType !== 'mouse' ? 16 : 0;
  if (dragSlop > 0 && !down.drag && Math.hypot(dx, dy) > dragSlop) { down.drag = true; holding = false; hold = 0; gauge.classList.remove('on'); }
  if (phase === 'pick' && e.pointerType !== 'mouse' && Math.hypot(dx, dy) <= dragSlop) {
    // 仍在點選死區：先別轉頭，避免點蚵被帶走
  } else if (down.drag) {
    // 手機／觸控拖曳：維持 FPS（指右＝往右看）；勿與桌面滑鼠共用同一符號
    const k = 0.006 * mix.sens;
    const xS = mix.invX ? -1 : 1;
    tYaw = clamp(down.yaw - dx * k * xS, -yl(), yl());
    if (plazaTpWalkLockPitch() && tpPitchFree()) tpPitch = clamp((down.tp ?? tpPitch) + dy * k * 0.8, 0.05, 1.1);
tPitch = plazaTpWalkLockPitch() ? PLAZA_WALK_PITCH : clamp(down.pitch - dy * k * (mix.invY ? -1 : 1), pitchLo(), pitchHi());
    // 坐下／拖曳立刻上鏡頭（與 Pointer Lock 同手感，不等到下幀）
    yaw = tYaw; pitch = tPitch;
    camera.rotation.set(pitch, yaw + flYaw + (walking ? 0 : seatYaw), 0);
    camera.updateMatrixWorld();
  }
});
function release() { if (!holding) return; const h = hold; holding = false; hold = 0; gauge.classList.remove('on'); void h; }
const up = (e: PointerEvent) => {
  if (flHeld && e.pointerId === flPtr) { flRelease(); return; }
  if (flDown && e.pointerId === flDragId) { flDown = null; flDragId = -1; return; }
  if (moonAimOn && down && down.id === e.pointerId) { const d = down; down = null; if (!d.drag) moonTapAt(e.clientX, e.clientY); return; }
  if (down && down.id === e.pointerId && walking) { down = null; return; }
  if (!(down && down.id === e.pointerId)) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  // 坐下已預設 drag：小位移仍當點選（拿蚵觸控門檻較寬）
  const tapKeep = phase === 'pick' && e.pointerType !== 'mouse' ? 48 : 14;
  const asTap = moved < tapKeep && !(phase === 'pick' && e.pointerType !== 'mouse' && down.swiped);
  if (asTap) {
    if (isGrillPhase() || (plazaOnGrill() && (phase === 'pick' || phase === 'empty' || phase === 'busy'))) {
      const lk = document.pointerLockElement === canvas;
      const tx = lk ? innerWidth / 2 : e.clientX, ty = lk ? innerHeight / 2 : e.clientY;
      if (phase === 'grillPlace') grillAct(tx, ty);
      else void grillRaceAt(tx, ty).then(hit => {
        if (!hit && phase === 'pick') {
          if (e.pointerType === 'mouse') pickAt(innerWidth / 2, innerHeight / 2);
          else pickAt(e.clientX, e.clientY);
        }
      });
    }
    else if (phase === 'seam') tryInsert();
    else if (phase === 'empty' && tut && TUT[tut.i].id === 'empty') discardShell();
    else if (phase === 'pick') {
      if (e.pointerType === 'mouse') pickAt(innerWidth / 2, innerHeight / 2);
      else pickAt(e.clientX, e.clientY);
    } else if (phase === 'aim' && tapAim) {
      const lk = document.pointerLockElement === canvas;
      const tx = lk ? innerWidth / 2 : e.clientX, ty = lk ? innerHeight / 2 : e.clientY;
      const tn = tut && !tutMeat() ? null : npcAtScr(tx, ty);
      if (tn) throwMeatAt(tn);
      else if (tutMeat()) hint.textContent = '點一下阿婆，把肉丟過去';
      else if (nearBowl(tx, ty)) toss(true);
      else hint.textContent = '點碗或碗附近就能丟進去';
    } else release();
  } else release();
  down = null;
};
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
let tpDist = 3.6; const clampTp = (v: number) => Math.min(6.5, Math.max(1.8, v));
const tpZoomOn = () => tpv && state === 'play';
canvas.addEventListener('wheel', e => { if (tpZoomOn()) { tpDist = clampTp(tpDist + e.deltaY * 0.003); e.preventDefault(); } }, { passive: false });
{ let pd = 0; const dist = (ts: TouchList) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  canvas.addEventListener('touchstart', e => { if (e.targetTouches.length === 2 && e.touches.length === 2) { pd = dist(e.targetTouches); pinchOn = true; if (tpZoomOn()) { down = null; if (flDragId !== flPtr) { flDown = null; flDragId = -1; } } } }, { passive: true });
  canvas.addEventListener('touchmove', e => { if (pd > 0 && e.targetTouches.length === 2 && e.touches.length === 2 && tpZoomOn()) { const nd = dist(e.targetTouches); tpDist = clampTp(tpDist * pd / nd); pd = nd; } }, { passive: true });
  canvas.addEventListener('touchend', e => { if (e.targetTouches.length < 2) { pd = 0; pinchOn = false; } }, { passive: true }); }
canvas.addEventListener('wheel', e => { if (phase === 'seam' && !tpv) { rot += e.deltaY * 0.004; e.preventDefault(); } }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.key === 'Escape') {
    if (closeTopModal()) { e.preventDefault(); e.stopPropagation(); return; }
  }
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
  // V＝視角（第三人稱／第一人稱）；收音機改點按鈕
  if (e.code === 'KeyV' && !e.repeat && state === 'play' && !tut) { setTpv(!tpv); return; }
  // 廣場：M 開／關地圖（與道具快捷對調）
  if (state === 'play' && plazaMode && isPlazaActive() && !e.repeat && e.code === 'KeyM') {
    e.preventDefault();
    if (document.pointerLockElement) document.exitPointerLock();
    plazaToggleMap();
    return;
  }
  // 藥品／道具：N（原 M）
  if (state === 'play' && !tut && e.code === 'KeyN') { const L = $('medList'); if (document.pointerLockElement) document.exitPointerLock(); L.classList.toggle('show'); if (L.classList.contains('show')) renderMedList(); return; }
  if (state === 'play' && $('medList').classList.contains('show') && /^Digit[1-9]$/.test(e.code)) { const own = MEDS.filter(m => (save.meds[m.id] ?? 0) > 0); const m = own[+e.code.slice(5) - 1]; if (m) { useMed(m.id); renderMedList(); } return; }
  if (tut && e.code === 'Enter' && TUT[tut.i].next) { $('tutNext').click(); return; }
  // 廣場：Enter 開聊天
  if (state === 'play' && plazaMode && isPlazaActive() && !e.repeat && (e.code === 'Enter' || e.key === 'Enter')) {
    e.preventDefault();
    if (document.pointerLockElement) document.exitPointerLock();
    plazaFocusChat();
    return;
  }
  if (state !== 'play') return; audio().resume();
  if (walking) {
    if (e.code === 'Space' && (plazaMode || isRoomActive())) { e.preventDefault(); if (!e.repeat) plazaJump(); return; }
    if ((e.code === 'KeyC' || e.code === 'KeyZ') && (plazaMode || isRoomActive())) { if (!e.repeat) plazaPose(e.code === 'KeyC' ? 'crouch' : 'lie'); return; }
    walkKeys.add(e.code);
    if (e.code === 'KeyE') {
      if (plazaMode) void plazaTrySit();
      else if (isRoomActive()) void roomTrySit();
      else if (nearSeat) sitDown(nearSeat.id);
    }
    return;
  }
  if (e.code === 'KeyG') { standUp(); return; }
  if (e.code === 'Space' && plazaMode && walking) { if (!e.repeat) plazaJump(); return; }
  if (e.code === 'Space' && !e.repeat && umbHeld) { hint.textContent = '撐著傘不能剝蚵，先放開雨傘'; return; }
  if (e.code === 'Space' && !e.repeat) { if (phase === 'grillPlace') toast('點烤網上想放的位置', '#ffd76a'); else if (plazaOnGrill() && (phase === 'pick' || phase === 'empty' || phase === 'busy')) void grillRaceAt(innerWidth / 2, innerHeight / 2); else if (phase === 'pick') pickAt(innerWidth / 2, innerHeight / 2); else if (isGrillPhase()) grillAct(); else if (phase === 'seam') tryInsert(); else if (swipePhase()) pry(e.timeStamp); else if (phase === 'aim' && tapAim) { if (!tutMeat()) toss(true); } else if (phase === 'aim') { holding = true; hold = 0; } }
  if (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    const l = e.code === 'KeyA' || e.code === 'ArrowLeft';
    if (phase === 'seam') rotKey = l ? -1 : 1; else if (!e.repeat && swipePhase()) keyTwist(l ? 'L' : 'R');
  }
  if (e.code === 'KeyQ') giveUp();
  if (e.code === 'KeyF') throwShell();
  if (e.code === 'KeyR' && !e.repeat) openUmbrella();
  if (e.code === 'KeyT' && !e.repeat) startPuff();
  if (e.code === 'KeyE' && !e.repeat) startSteal();
});
window.addEventListener('keyup', e => { walkKeys.delete(e.code); if (e.code === 'Space') release(); if (/Key[AD]|Arrow(Left|Right)/.test(e.code)) rotKey = 0; if (e.code === 'KeyE') stopSteal(); if (e.code === 'KeyR') closeUmbrella(); if (e.code === 'KeyT') endPuff(); });
// 換畫面後 350ms 內忽略點擊，防止放開觸發後的合成 click 穿透到新畫面同位置的按鈕
let guardUntil = 0;
function inputGuard() { guardUntil = performance.now() + 350; }
for (const ev of ['click', 'pointerup']) document.addEventListener(ev, e => { if (performance.now() < guardUntil && (e.target as HTMLElement)?.closest?.('button,a,.panel')) { e.stopPropagation(); e.preventDefault(); } }, true);
// 手機：一般按鈕放開才觸發，移動超過 12px 視為滑動不算按；按住型（雨傘、方向）維持按下即觸發
const btn = (id: string, f: () => void, upF?: () => void) => {
  const el = $(id);
  if (upF || !COARSE) { el.addEventListener('pointerdown', e => { e.stopPropagation(); audio().resume(); f(); }); if (upF) { el.addEventListener('pointerup', upF); el.addEventListener('pointerleave', upF); } return; }
  let sx = 0, sy = 0, st = 0, ok = false;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); audio().resume(); sx = e.clientX; sy = e.clientY; st = performance.now(); ok = true; });
  el.addEventListener('pointermove', e => { if (ok && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) ok = false; });
  el.addEventListener('pointercancel', () => ok = false);
  let fired = 0;
  el.addEventListener('pointerup', e => { e.stopPropagation(); if (ok && performance.now() - st < 800) { fired = performance.now(); f(); } ok = false; });
  // iOS 偶爾吃掉 pointerup（或被別的觸控搶走）：補一個 click 備援，700ms 內已觸發過就不重複
  el.addEventListener('click', e => { e.stopPropagation(); if (performance.now() - fired > 700) { fired = performance.now(); f(); } });
};
btn('giveUp', giveUp); btn('radioBtn', toggleRadio); btn('quitBtn', () => {
  if (state !== 'play' || tut) return; if (document.pointerLockElement) document.exitPointerLock();
  const toPlaza = !!shedTrip && !plazaMode && !isRoomActive();
  const bm = $('backMenu'), h = bm.querySelector('h2'), p = bm.querySelector('p');
  if (h) h.innerHTML = toPlaza ? '<i class="ic ic-pin"></i> 回廣場' : '<i class="ic ic-home"></i> 回主選單';
  if (p) p.innerHTML = toPlaza ? '確定要回廣場嗎？<br>這一工賺的照算。' : '確定要回主選單嗎？<br>這一工賺的照算。';
  $('bmGo').innerHTML = toPlaza ? '<i class="ic ic-pin"></i> 回廣場' : '<i class="ic ic-home"></i> 回主選單';
  bm.classList.add('show');
});
$('bmStay').onclick = () => $('backMenu').classList.remove('show');
$('bmGo').onclick = () => { void (async () => {
  $('backMenu').classList.remove('show'); if (state !== 'play' || tut) return;
  if (isRoomActive()) { await closeRoom(true); return; }
  const wasPlaza = plazaMode;
  if (wasPlaza && !plazaShiftStarted()) {
    returnToMainMenu(async () => {
      plazaShellGen++; setPlazaMode(false); plazaPlayAt = 0; plazaHideYard(false);
      await closePlaza().catch(() => 0); applySeat(save.seat ?? 'door');
      clearPlazaLeaveUi();
      void refreshPlazaOnlineAfterLeave();
    });
    return;
  }
  endReason = 'quit'; endDay();
  $('result').classList.remove('show');
  const P = lastPay;
  const showPay = () => {
      if (!(P.gross || P.pen)) return;
      const r = (ic: string, l: string, v: string, c = '') => `<div class="row"><span><i class="ic ic-${ic}"></i> ${l}</span><b${c}>${v}</b></div>`;
      $('psBody').innerHTML = r('oyster', '收入', `+$${P.gross}`) + (P.pen ? r('warn', '罰款／扣價', `-$${P.pen}`, ' style="color:#ff8a7a"') + r('coin', '淨收入', `$${P.earn}`) : '') + `<p style="font-size:14px;opacity:.85">已入帳，身上共有 $${save.money}</p>`;
      $('paySum').classList.add('show');
  };
  // 從廣場進來的工寮：提早下班直接回廣場門口
  if (!wasPlaza && shedTrip) { returnToPlazaFromShed(); setTimeout(showPay, 900); return; }
  returnToMainMenu(async () => {
    if (wasPlaza) {
      await plazaPayWait?.catch(() => 0); setPlazaMode(false); plazaPayWait = null; plazaPlayAt = 0; plazaHideYard(false);
      await closePlaza().catch(() => 0); applySeat(save.seat ?? 'door'); clearPlazaLeaveUi();
      void refreshPlazaOnlineAfterLeave();
    }
  }, {
    then: showPay,
  });
})(); };
$('psOk').onclick = () => { $('paySum').classList.remove('show'); if (nameWait) { nameWait = false; setTimeout(namePrompt, 300); } }; btn('standBtn', standUp); btn('sitBtn', () => { if (plazaMode) void plazaTrySit(); else if (isRoomActive()) void roomTrySit(); else if (nearSeat) sitDown(nearSeat.id); }); btn('throwBtn', throwShell); btn('umbBtn', openUmbrella, closeUmbrella); for (const ev of ['pointercancel', 'lostpointercapture', 'touchend', 'touchcancel']) $('umbBtn').addEventListener(ev, closeUmbrella); addEventListener('blur', closeUmbrella); document.addEventListener('visibilitychange', () => { if (document.hidden) closeUmbrella(); }); $('umbBtn').addEventListener('contextmenu', e => e.preventDefault()); btn('puffBtn', startPuff, endPuff); for (const ev of ['pointercancel', 'lostpointercapture', 'touchend', 'touchcancel']) $('puffBtn').addEventListener(ev, endPuff); addEventListener('blur', endPuff); document.addEventListener('visibilitychange', () => { if (document.hidden) endPuff(); }); $('puffBtn').addEventListener('contextmenu', e => e.preventDefault()); btn('stealBtn', startSteal, stopSteal);
{ const sb = $('stealBtn'); sb.addEventListener('pointerdown', e => { try { sb.setPointerCapture(e.pointerId); } catch { } });
  for (const ev of ['pointercancel', 'lostpointercapture', 'touchend', 'touchcancel']) sb.addEventListener(ev, stopSteal);
  window.addEventListener('pointerup', stopSteal); window.addEventListener('pointercancel', stopSteal); window.addEventListener('blur', stopSteal); document.addEventListener('visibilitychange', stopSteal); }
// 手機：次要按鈕放左下一排（不收選單）
if (matchMedia('(pointer:coarse)').matches) {
  const L = $('btnsL');
  for (const id of ['radioBtn', 'medBtn', 'standBtn']) L.appendChild($(id));
  // 左下角固定列：回主選單 ＋ 右側放棄這顆
  const corner = document.createElement('div');
  corner.id = 'btnsCorner';
  $('hud').appendChild(corner);
  corner.appendChild($('quitBtn'));
  corner.appendChild($('giveUp'));
  // 視角：直向掛統計列右側；橫向掛上方狀態列右側
  $('camBtn').classList.add('hudCam');
  const placeCamBtn = () => {
    const cam = $('camBtn');
    const land = matchMedia('(orientation: landscape)').matches;
    const host = land ? $('top') : $('stats');
    if (cam.parentElement !== host) host.appendChild(cam);
  };
  placeCamBtn();
  matchMedia('(orientation: landscape)').addEventListener('change', placeCamBtn);
  addEventListener('orientationchange', () => setTimeout(placeCamBtn, 60));
}
else $('btns').insertBefore($('radioBtn'), $('medBtn'));
btn('rotL', () => rotKey = -1, () => rotKey = 0); btn('rotR', () => rotKey = 1, () => rotKey = 0);
// ----- 徛起來行路、換位 -----
// walking／walkPos 等狀態與 standUp／sitDown／walkStep 在 world/walkSeat
initWalkSeat({
  $, on, COARSE, clamp,
  getState: () => state, getPhase: () => phase,
  walkSpeedMul: walkSpeedNow,
  isPlazaMode: () => plazaMode, plazaSeated, plazaStandWalk, plazaPileObs, plazaWalkBodies, getJumpY: () => jumpY, plazaWalkBound, plazaWalkRect, plazaWalkClamp, plazaNearSeat, plazaNearPrompt, plazaMySeat, seatPose,
  isRoomMode: () => isRoomActive(), roomSeated, roomStandWalk, roomWalkBodies, roomNearPrompt,
  setPlazaSeatPropsVisible, oyster, shellGeo, shellTopMat, shellTop, handRig, SEAT, BASIN, BOWL, getBowlR: () => BOWL_R,
  seatGround, seatNow,
  getSeatYaw: () => seatYaw, setSeatYaw: v => { seatYaw = v; },
  getYaw: () => yaw, setYaw: v => { yaw = v; },
  getTYaw: () => tYaw, setTYaw: v => { tYaw = v; },
  getPitch: () => pitch, setPitch: v => { pitch = v; },
  getTPitch: () => tPitch, setTPitch: v => { tPitch = v; },
  getTpv: () => tpv, setTpv: v => { tpv = v; }, saveTpv: () => !!save.tpv,
  drawCamBtn, drawRadio, applySeat, getSaveSeat: () => save.seat, persist, track, toast, SFX, later, goPick, setPhase, stopSteal,
  fly, worldOf, pileSpot, nag, pick, say, getNpcs: () => npcs,
  bumpAbandoned: () => { abandoned++; },
  setProgress: v => { progress = v; }, setCombo: v => { combo = v; }, setTension: v => { tension = v; }, setRotKey: v => { rotKey = v; },
  hint, stools, scene,
});
initWalkJoy();

function giveUp() {
  if (state !== 'play' || (phase !== 'seam' && phase !== 'twist' && phase !== 'grillPlace')) return;
  abandoned++; oysterToHand(); setPhase('busy'); oyster.visible = false; gauge.classList.remove('hit', 'miss', 'hitHold');
  later(0.05, () => { progress = 0; combo = 0; crackedNow = false; tension = 0; shellTop.rotation.z = 0; shellTop.rotation.x = 0; rotKey = 0; grillCookT = 0; });
  const sh = new THREE.Mesh(shellGeo, shellTopMat); fly(sh, worldOf(oyster), pileSpot(), 0.6, 0.6, () => scene.remove(sh));
  // 先排 goPick，避免 nag／特效出錯卡在 busy 拿不到下一顆
  later(0.6, goPick);
  hint.textContent = '丟掉了…'; try { nag(NAG_GIVEUP); } catch { /* 廣場無 NPC 等 */ } updHud();
}
// 入碗數達標自動解鎖地點（不用錢）
function autoUnlock() { const tot = save.life.inBowl ?? 0; save.locs ??= []; for (const l of LOCS) if (l.need && tot >= l.need && !save.locs.includes(l.id)) { save.locs.push(l.id); persist(); Social.report('port', LOCS.indexOf(l)); track('buy', { item: 'loc-' + l.id, price: 0 }); toast(`📍 新地點解鎖：${l.n}`); } }
const isPlazaPicked = () => save.loc === 'plaza';
function syncStartUi() {
  const start = $('start');
  const temp = $('tempRow');
  if (isPlazaPicked()) {
    start.innerHTML = '進入廣場'; start.classList.add('plazaGo');
    if (temp) temp.style.display = 'none';
  } else {
    start.innerHTML = '開始剝蚵'; start.classList.remove('plazaGo');
    if (temp) temp.style.display = 'flex';
  }
}
let plazaOnlineN: number | null = null;
let plazaOnlineAt = 0;
let plazaOnlineOk = false;
async function refreshPlazaOnline(force = false) {
  if (!force && plazaOnlineOk && performance.now() - plazaOnlineAt < 12_000) return plazaOnlineN;
  try {
    const base = import.meta.env.DEV ? 'http://127.0.0.1:8787/s' : 'https://game-status.gwtech.org/s';
    const r = await fetch(`${base}/plaza`, { mode: 'cors', cache: 'no-store' }).then(x => x.ok ? x.json() : null).catch(() => null);
    const raw = r?.online ?? r?.Online;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      plazaOnlineN = Math.max(0, raw | 0);
      plazaOnlineAt = performance.now();
      plazaOnlineOk = true;
    }
  } catch { /* 後端沒開就算了 */ }
  return plazaOnlineN;
}
function plazaCountLabel() {
  if (plazaOnlineN == null) return '多人一起剝蚵，隨便坐、無倒數，離開再結算';
  return plazaOnlineN > 0
    ? `目前 <b>${plazaOnlineN}</b> 人在廣場・隨便坐、無倒數`
    : '目前沒人・隨便坐、無倒數，離開再結算';
}
function plazaHeadCountTxt() {
  if (plazaOnlineN == null) return '休閒多人・不趕時間';
  return plazaOnlineN > 0
    ? `目前 ${plazaOnlineN} 人在內・休閒多人・不趕時間`
    : '目前沒人・休閒多人・不趕時間';
}
/** 把廣場人數寫進主畫面地點卡（不重繪整排，避免打斷點選） */
function paintPlazaOnlineUi() {
  const el = document.getElementById('locPick');
  if (!el || plazaOnlineN == null) return;
  const n = plazaOnlineN;
  const btn = el.querySelector('.locPlaza');
  const card = el.querySelector('.locPlaza .lm');
  const ld = el.querySelector('.locPlaza .ld');
  const head = el.querySelector('.locHead small');
  if (btn) btn.classList.toggle('live', n > 0);
  if (card) card.innerHTML = `<i class="pzDot" aria-hidden="true"></i>${n} 人在線`;
  if (ld) ld.innerHTML = plazaCountLabel();
  if (isPlazaPicked() && head) head.textContent = plazaHeadCountTxt();
}
async function syncPlazaOnlineUi(force = false) {
  const n = await refreshPlazaOnline(force);
  if (n != null) paintPlazaOnlineUi();
  return n;
}
/** 離開廣場後：等斷線再強制重抓人數（含短延遲重試，避免幽靈連線） */
async function refreshPlazaOnlineAfterLeave() {
  if (plazaOnlineN != null && plazaOnlineN > 0) {
    plazaOnlineN = Math.max(0, plazaOnlineN - 1);
    paintPlazaOnlineUi();
  }
  plazaOnlineOk = false;
  await syncPlazaOnlineUi(true);
  for (const ms of [350, 1200]) {
    await new Promise(r => setTimeout(r, ms));
    if (state !== 'menu') return;
    await syncPlazaOnlineUi(true);
  }
}
function renderLocs(opts?: { forcePlazaOnline?: boolean }) { autoUnlock();
  const el = $('locPick'); const tot = save.life.inBowl ?? 0;
  const seen = save.locSeen ?? (save.locSeen = ['home']);
  const plazaCur = isPlazaPicked();
  const cl = plazaCur ? null : locNow();
  const isNew = (l: typeof LOCS[number]) => !seen.includes(l.id) && save.locs!.includes(l.id);
  const anyNew = LOCS.some(isNew);
  const headTxt = plazaCur
    ? `<b><i class="ic ic-pin"></i> 上工地點：🦪 蚵仔廣場</b><small>${plazaHeadCountTxt()}</small>`
    : `<b><i class="ic ic-pin"></i> 上工地點：${cl!.n} ×${cl!.m.toFixed(1)}</b>${anyNew ? '<span class="nb">NEW</span>' : ''}<small>👉 點下面的卡片換地點${COARSE ? '（左右滑看更多）' : ''}</small>`;
  const pzN = plazaOnlineN;
  const pzLive = pzN != null && pzN > 0;
  const plazaCard = `<button class="loc locPlaza ${plazaCur ? 'cur' : ''}${pzLive ? ' live' : ''}" data-loc="plaza"><span class="pzTag">多人</span><span class="ln">🦪 蚵仔廣場</span><span class="lm">${pzN != null ? `<i class="pzDot" aria-hidden="true"></i>${pzN} 人在線` : '連線中…'}</span><small>點一下選這裡</small><small class="ld">${plazaCountLabel()}</small></button>`;
  const roomCard = ROOM_ENABLED
    ? `<div class="loc locRoom"><span class="pzTag">好友</span><span class="ln">好友房</span><small class="ld">開一間房間，和朋友在同一個場景剝蚵</small><span class="rmBtns"><button type="button" data-room="create">開房間</button><button type="button" data-room="join">加入房間</button></span></div>`
    : '';
  el.innerHTML = `<div class="locHead">${headTxt}</div><div class="locRow">` + plazaCard + roomCard + LOCS.map(l => {
    const own = l.need === 0 || save.locs!.includes(l.id), cur = !plazaCur && cl!.id === l.id, nw = isNew(l) ? '<span class="nb">NEW</span>' : '';
    const head = `<span class="ln">${own ? '' : '🔒 '}${l.n}</span>${nw}<span class="lm">工錢 ×${l.m.toFixed(1)}</span>`;
    if (own) return `<button class="loc ${cur ? 'cur' : ''}" data-loc="${l.id}">${head}<small>點一下選這裡</small><small class="ld">${l.d}</small></button>`;
    const pr = l.price ? px('loc-' + l.id, l.price) : 0;
    return `<button class="loc locked" ${pr ? `data-lbuy="${l.id}"` : 'disabled'}>${head}<small><i class="ic ic-lock"></i> 解鎖條件：入碗 ${tot}/${l.need} 顆</small>${pr ? `<small class="lbuy">花 $${pr} 提早解鎖</small>` : ''}<small class="ld">${l.d}</small></button>`;
  }).join('') + '</div>';
  const mark = (id?: string) => { if (id && !seen.includes(id)) { seen.push(id); persist(); } };
  el.querySelectorAll<HTMLButtonElement>('button.loc').forEach(b => b.addEventListener('click', () => mark(b.dataset.loc || b.dataset.lbuy), { capture: true }));
  requestAnimationFrame(() => el.querySelector('.loc.cur')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  if (ROOM_ENABLED) el.querySelectorAll<HTMLButtonElement>('[data-room]').forEach(b => b.onclick = ev => {
    ev.stopPropagation(); audio();
    if (b.dataset.room === 'join') openRoomJoin(); else openRoomCreate();
  });
  // 未解鎖卡：按一次顯示確認，四秒內再按一次才扣錢
  el.querySelectorAll<HTMLButtonElement>('button[data-lbuy]').forEach(b => b.onclick = async () => {
    const id = b.dataset.lbuy!; const l = LOCS.find(x => x.id === id); const tag = b.querySelector<HTMLElement>('.lbuy');
    if (!l || !tag) return;
    if (!b.classList.contains('confirm')) {
      b.classList.add('confirm'); tag.textContent = `確定花 $${px('loc-' + id, l.price)} 解鎖？再按一次`;
      setTimeout(() => { if (b.isConnected && b.classList.contains('confirm')) { b.classList.remove('confirm'); tag.textContent = `花 $${px('loc-' + id, l.price)} 提早解鎖`; } }, 4000);
      return;
    }
    b.classList.remove('confirm');
    if (await buyLocEarly(id)) { save.loc = id; persist(); renderLocs(); updSky(); syncStartUi(); }
  });
  el.querySelectorAll<HTMLButtonElement>('[data-loc]').forEach(b => b.onclick = () => {
    save.loc = b.dataset.loc;
    persist(); renderLocs();
    updSky();
    syncStartUi();
  });
  syncStartUi();
  syncPlazaGuideHint();
  void syncPlazaOnlineUi(!!opts?.forcePlazaOnline);
}
renderLocs({ forcePlazaOnline: true });
void fetchEconomy().then(ok => { if (ok) refreshEconomyUi(); });
setInterval(() => {
  if (state !== 'menu' || !$('overlay')?.classList.contains('show')) return;
  void syncPlazaOnlineUi(true);
}, 20_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state === 'menu' && $('overlay')?.classList.contains('show')) void syncPlazaOnlineUi(true);
});
let achFromRes = false; // 從收工畫面打開成就，關掉後回到收工畫面
btn('rAch', () => { achFromRes = true; $('result').classList.remove('show'); achOpen(); });
const ITEMS = [{ id: 'moon', n: '把你媽的愛送上月球', price: 5000, good: '選一位鄰居，發射飛彈鐵拳把對方送上月球，這一工都不會再出現', bad: '每一工最多用 2 個，下一工對方會回來' }];

// 主選單／雜貨新品／簽到提示／禮物信箱（見 ui/menu、meta/gifts）
const shopKeys = () => [...KNIVES.filter(k => k.price > 0).map(k => 'knife-' + k.id), ...UMBS.filter(u => u.price > 0).map(u => 'umb-' + u.id), ...BOWLS.filter(b => b.price > 0).map(b => 'bowl-' + b.id), ...GEAR.map(g => 'gear-' + g.id), ...COSMETICS.map(g => 'gear-' + g.id), ...FLAG_PRICE_ITEMS.map(g => 'gear-' + g.id), ...EQUIP.filter(e => e.price > 0).map(e => 'cloth-' + e.id), ...MEDS.map(m => 'med-' + m.id), ...ITEMS.map(i => 'item-' + i.id)];
const shopName = (k: string) => { const [c, ...r] = k.split('-'); const id = r.join('-'); const L: any[] = c === 'knife' ? KNIVES : c === 'umb' ? UMBS : c === 'bowl' ? BOWLS : c === 'gear' ? [...GEAR, ...COSMETICS, ...FLAG_PRICE_ITEMS] : c === 'cloth' ? EQUIP : c === 'med' ? MEDS : ITEMS; return L.find(x => x.id === id)?.n ?? id; };
let shopTab = 0;
initMenu({
  getState: () => state,
  isTut: () => !!tut,
  getSave: () => save,
  LS,
  Social,
  giftAlert,
  svAlert,
  featAnnounce,
  shopKeys,
  shopName,
  getShopTab: () => shopTab,
  getShopNewIds,
  KNIVES, UMBS, BOWLS, GEAR, EQUIP, MEDS, ITEMS,
  openDaily,
});
initGifts({
  getSave: () => save,
  persist,
  track,
  renderDex: () => renderDex(),
  renderDaily,
  getState: () => state,
  isTut: () => !!tut,
  bootQuiet: () => !!bootQuiet(),
  LS,
  audio,
  tone,
  RAR,
  ITEMS,
  svAlert,
  featAnnounce,
  newAnnounce,
});

const MOON_MAX = 2;
let moonUsed = 0, moonAimOn = false, punchT = 0;
// ---------- 道具：把你媽的愛送上月球 ----------
const MOON_SVG = `<svg viewBox="0 0 64 40" width="72" height="45" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M2 14h8M0 20h12M2 26h8"/><path d="M14 13l6 3v8l-6 3z"/><path d="M20 14h18v12H20z"/><path d="M24 14l-3-6h6l3 6M24 26l-3 6h6l3-6"/><path d="M38 12h12a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6H38z"/><path d="M44 12v6M50 12v6M44 22h10"/><path d="M40 28v-4h4"/><path d="M58 8l4-4M60 20h4M58 32l4 4"/></svg>`;
const ALL_NPCS = npcs.slice();
const NPC_HOME = ALL_NPCS.map(n => ({ p: n.g.position.clone(), r: n.g.rotation.clone() }));
// 活動場景可以有 1～50 個阿婆：多的第一次用到才建立，平常隱藏
const EV_EXTRA: NpcDef[] = [
  { name: '阿蘭姨', rate: 5.5, chatty: 0.4, peek: false, top: 0x8a5a2a, hair: 0x555555, a: 2.6 },
  { name: '阿珠姨', rate: 6.2, chatty: 0.5, peek: true, top: 0x3a5a9a, hair: 0x888888, a: -2.6 },
  { name: '阿秀', rate: 4.8, chatty: 0.2, peek: false, top: 0x9a3a6a, hair: 0x222222, a: 2.25, r: 2.9 },
  { name: '阿玉', rate: 6.8, chatty: 0.6, peek: false, top: 0x4a7a3a, hair: 0xaaaaaa, a: -2.25, r: 2.9 },
  { name: '阿美', rate: 5.2, chatty: 0.3, peek: true, top: 0xa06a2a, hair: 0x444444, a: Math.PI, r: 2.9 },
  { name: '阿月', rate: 7.0, chatty: 0.5, peek: false, top: 0x5a3a8a, hair: 0xbbbbbb, a: 1.55, r: 2.9 },
  { name: '阿花', rate: 4.5, chatty: 0.2, peek: false, top: 0x2a6a7a, hair: 0x333333, a: -1.55, r: 2.9 },
  { name: '阿雪', rate: 6.0, chatty: 0.4, peek: true, top: 0x8a2a2a, hair: 0xdddddd, a: 2.7, r: 2.9 },
  { name: '阿金', rate: 5.0, chatty: 0.3, peek: false, top: 0x6a6a2a, hair: 0x666666, a: -2.7, r: 2.9 },
];
// 第 13 個以後：外圈一圈一圈排（避開正前方視線），名字不重複
function evExtraName(k: number): string | undefined {
  const n = ['阿蘭姨', '阿珠姨', '阿秀', '阿玉', '阿美', '阿月', '阿花', '阿雪', '阿金', '阿英', '阿琴', '阿梅', '阿蓮', '阿霞', '阿鳳', '阿娟', '阿惠', '阿芳', '阿敏', '阿麗', '阿萍', '阿桂', '阿娥', '阿菊', '阿香', '阿貞', '阿綢', '阿嬋', '阿碧', '阿滿', '阿招', '阿好', '阿罔', '阿市', '阿緞', '阿錦', '阿燕', '阿琪', '阿霜', '阿瑞', '阿彩', '阿蕊', '阿秋', '阿冬', '阿春姨', '阿夏', '阿杏', '阿梨'];
  return n[k];
}
const EV_RINGS = [{ r: 3.8, n: 12 }, { r: 4.7, n: 15 }, { r: 5.6, n: 18 }];
for (let ri = 0, k = EV_EXTRA.length; ri < EV_RINGS.length; ri++) {
  const { r, n } = EV_RINGS[ri], a0 = 1.35, span = 2 * (Math.PI - a0);
  for (let j = 0; j < n && k < 47; j++, k++) {
    const a = a0 + span * (j + 0.5) / n, ang = a > Math.PI ? a - 2 * Math.PI : a;
    EV_EXTRA.push({ name: evExtraName(k)!, rate: 4.5 + (k * 37 % 30) / 10, chatty: (k * 13 % 6) / 10, peek: k % 4 === 0, top: [0x8a5a2a, 0x3a5a9a, 0x9a3a6a, 0x4a7a3a, 0xa06a2a, 0x5a3a8a, 0x2a6a7a, 0x8a2a2a, 0x6a6a2a][k % 9], hair: [0x555555, 0x888888, 0x222222, 0xaaaaaa, 0xdddddd][k % 5], a: ang, r });
  }
}
function evEnsure(n: number) { while (ALL_NPCS.length < n && ALL_NPCS.length - NPC_DEF.length < EV_EXTRA.length) { makeNpc(EV_EXTRA[ALL_NPCS.length - NPC_DEF.length]); const x = npcs.pop()!; ALL_NPCS.push(x); NPC_HOME.push({ p: x.g.position.clone(), r: x.g.rotation.clone() }); } }
type MoonFx = (dt: number) => boolean;
const moonFx: MoonFx[] = [];
function moonReset() {
  moonFx.length = 0; moonUsed = 0; moonAimEnd();
  const N = plazaMode ? 0 : (evRun ? Math.max(1, Math.min(50, evRun.npc)) : NPC_DEF.length); if (N > 0) evEnsure(N);
  npcs.length = 0; ALL_NPCS.forEach((n, i) => { const use = i < N; if (n.bowlM) n.bowlM.visible = use; if (!use) { n.g.visible = false; n.tag.sprite.visible = false; n.bubble.sprite.visible = false; n.windup = 0; n.throwCd = 999; return; } npcs.push(n); n.g.position.copy(NPC_HOME[i].p); n.g.rotation.copy(NPC_HOME[i].r); n.g.scale.setScalar(1); if (!n.g.parent) scene.add(n.g); n.g.visible = true; n.tag.sprite.visible = true; delete n.g.userData.moon; });
}
function moonGone(n: Npc) {
  const i = npcs.indexOf(n); if (i >= 0) npcs.splice(i, 1);
  n.windup = 0; n.warned = false; n.throwCd = 999; n.distract = 0; n.look = 0; n.bubT = 0; n.grudge = 0; n.bubble.setOpacity(0); n.bubble.sprite.visible = false; n.tag.sprite.visible = false; n.g.userData.moon = 1;
  if (stealNpc === n) stopSteal(); if (hint.textContent?.includes(n.name)) hint.textContent = '';
}
const moonAimEl = document.createElement('div'); moonAimEl.id = 'moonAim';
moonAimEl.innerHTML = '<div class="maTip">選一個要送上月球的人</div><button class="maX" aria-label="取消">✕</button>';
document.body.appendChild(moonAimEl);
moonAimEl.querySelectorAll('.maX').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); }));
moonAimEl.querySelector('.maX')!.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); moonAimEnd(); });
function moonStart() {
  if (state !== 'play' || tut || !(save.meds.moon > 0)) return;
  if (plazaMode) { plazaMoonStart(); return; }
  if (moonUsed >= MOON_MAX) { toast(`這一工已經送 ${MOON_MAX} 位上月球了，下一工再用`, '#ffb08a'); return; }
  if (!npcs.length) { toast('旁邊已經沒有人了', '#ffb08a'); return; }
  $('medList').classList.remove('show'); if (document.pointerLockElement) document.exitPointerLock();
  moonAimOn = true; moonAimEl.classList.add('on', 'pz'); ensureMoonEnd(); moonAimEl.querySelectorAll('.maT').forEach(b => b.remove());
  for (const n of npcs) { const b = document.createElement('button'); b.className = 'maT'; b.innerHTML = `<svg viewBox="0 0 40 40" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3"><circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="3"/><path d="M20 1v10M20 29v10M1 20h10M29 20h10"/></svg><span>${esc(n.name)}</span>`; (b as any)._n = n;
    b.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); moonFire(n); }); moonAimEl.appendChild(b); }
  moonAimPos();
}
function moonTapAt(x: number, y: number) { let best: Npc | null = null, bd = 70; moonAimEl.querySelectorAll<HTMLElement>('.maT').forEach(b => { const r = b.getBoundingClientRect(); const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y); if (d < bd) { bd = d; best = (b as any)._n; } }); if (best) moonFire(best); }
let plazaAimOn = false;
/** 本地剛發射飛彈：略過 NpcMoon 回聲的飛彈特效／提示 */
let localMoonFxUntil = 0;
function ensureMoonEnd() { if (!moonAimEl.querySelector('.maEnd')) { const eb = document.createElement('button'); eb.className = 'maEnd'; eb.textContent = '結束瞄準'; eb.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); }); eb.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); moonAimEnd(); }); moonAimEl.appendChild(eb); } }
function plazaMoonStart() {
  $('medList').classList.remove('show'); if (document.pointerLockElement) document.exitPointerLock();
  plazaAimOn = true; moonAimEl.classList.add('on', 'pz'); ensureMoonEnd(); moonAimEl.querySelectorAll('.maT').forEach(b => b.remove());
  plazaAimTick();
}
function plazaAimTick() {
  if (!plazaAimOn) return;
  if (!plazaMode || state !== 'play' || !(save.meds.moon > 0)) { moonAimEnd(); return; }
  const cam = viewCam(); const seen = new Set<string>();
  for (const t of plazaAimTargets(true)) {
    if (!t.isNpc || t.phase === 'moon') continue;
    const p = new THREE.Vector3(t.head.x, t.head.y + 0.25, t.head.z).project(cam);
    if (!(p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95)) continue;
    seen.add(t.connId);
    let b = moonAimEl.querySelector<HTMLElement>(`.maT[data-c="${t.connId}"]`);
    if (!b) {
      b = document.createElement('button'); b.className = 'maT'; b.dataset.c = t.connId; for (const [k, v] of [['margin', '-24px 0 0 -40px'], ['padding', '0'], ['color', '#e0302a'], ['backdrop-filter', 'none'], ['-webkit-backdrop-filter', 'none'], ['animation', 'none'], ['filter', 'none'], ['display', 'flex'], ['align-items', 'center'], ['justify-content', 'center'], ['outline', 'none']]) b.style.setProperty(k, v, 'important');
      b.innerHTML = '<svg viewBox="0 0 40 40" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="20" cy="20" r="13"/><path d="M20 3v8M20 29v8M3 20h8M29 20h8"/></svg>';
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); });
      b.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); const tt = (b as any)._t; if (tt) plazaMoonFire(tt); });
      moonAimEl.appendChild(b);
    }
    (b as any)._t = t; b.style.left = `${(p.x * .5 + .5) * innerWidth}px`; b.style.top = `${(-p.y * .5 + .5) * innerHeight}px`;
  }
  moonAimEl.querySelectorAll<HTMLElement>('.maT').forEach(b => { if (!seen.has(b.dataset.c || '')) b.remove(); });
  const tip = moonAimEl.querySelector<HTMLElement>('.maTip'); if (tip) tip.textContent = seen.size ? '點阿婆身上的準心發射' : '視野裡沒有阿婆，走走看';
}async function plazaMoonFire(t: { connId: string; nick: string; head: { x: number; y: number; z: number } }) {
  if (!plazaAimOn || !(save.meds.moon > 0)) return;
  moonAimEnd();
  const p0 = viewCam().localToWorld(new THREE.Vector3(0.18, -0.18, -0.45));
  const r = await plazaMoonNpc(t.connId, { x: p0.x, y: p0.y, z: p0.z });
  if (!r.ok) { toast(r.err === 'gone' ? '阿婆已經飛走了' : plazaZhErr(r.err), '#ffb08a'); return; }
  save.meds.moon--; achS().st.pzmoon = (achS().st.pzmoon ?? 0) + 1; persist(); achBump('moon'); drawMeds(); track('item_use', { item: 'moonpunch' });
  localMoonFxUntil = performance.now() + 2500;
  if (ac) { SFX.whoosh(); tone(220, 0.5, 0.15, 'sawtooth', 0.05, 900); }
  toast(`把你媽的愛送上月球！目標：${t.nick}`, '#ffd25a');
  plazaMissileFx(p0, new THREE.Vector3(t.head.x, t.head.y, t.head.z));
}
function plazaMissileFx(p0: THREE.Vector3, p1: THREE.Vector3) {
  const mis = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xe8b896), [0, 0, -0.08], mis).scale.set(1, 0.85, 1.1);
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.22, 10), mat(0xc83a2a, { metalness: 0.4 }), [0, 0, 0.08], mis).rotation.x = Math.PI / 2;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 8), new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.9, fog: false })); flame.rotation.x = -Math.PI / 2; flame.position.z = 0.3; mis.add(flame);
  scene.add(mis); mis.position.copy(p0);
  let t = 0, smokeT = 0; const dur = 0.7;
  moonFx.push(dt => {
    t += dt; const k = Math.min(1, t / dur);
    const pos = new THREE.Vector3().lerpVectors(p0, p1, k); pos.y += Math.sin(k * Math.PI) * 0.25; mis.lookAt(pos.clone().multiplyScalar(2).sub(mis.position)); mis.position.copy(pos);
    flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    if ((smokeT -= dt) <= 0) { smokeT = 0.04; const s = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.7 })); s.position.copy(flame.getWorldPosition(new THREE.Vector3())); scene.add(s); let st = 0; moonFx.push(d => { st += d; s.scale.setScalar(1 + st * 2.2); (s.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - st); if (st >= 0.7) { scene.remove(s); return false; } return true; }); }
    if (k < 1) return true;
    scene.remove(mis);
    if (ac) { noise(0.6, 900, 0.7, 80); tone(70, 0.5, 0.4, 'sine', 0, 35); }
    const ex = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 1, fog: false })); ex.position.copy(p1); scene.add(ex);
    let et = 0; moonFx.push(d => { et += d; ex.scale.setScalar(1 + et * 9); (ex.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - et / 0.45); if (et >= 0.45) { scene.remove(ex); return false; } return true; });
    return false;
  });
}
function moonAimEnd() { moonAimOn = false; plazaAimOn = false; moonAimEl.classList.remove('pz'); moonAimEl.querySelectorAll('.maT').forEach(b => b.remove()); moonAimEl.classList.remove('on'); }
function moonAimPos() {
  const cam = viewCam(); moonAimEl.querySelectorAll<HTMLElement>('.maT').forEach(b => { const n = (b as any)._n as Npc; const p = worldOf(n.head).project(cam); if (p.z > 1) { p.x = -Math.sign(p.x || 1); p.y = -0.6; }
    b.style.display = ''; b.style.left = `${clamp((p.x * .5 + .5) * innerWidth, 36, innerWidth - 36)}px`; b.style.top = `${clamp((-p.y * .5 + .5) * innerHeight, 90, innerHeight - 60)}px`; });
}
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#fff6b0'); g.addColorStop(1, 'rgba(255,240,150,0)'); x.fillStyle = g; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 9 : 32; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); return new THREE.CanvasTexture(c); })();
const smokeGeo = new THREE.SphereGeometry(0.05, 6, 5);
function moonFire(n: Npc) {
  if ((n as any)._pz) { plazaMoonFire((n as any)._pz); return; }
  if (!moonAimOn || !npcs.includes(n) || !(save.meds.moon > 0)) return;
  moonAimEnd(); save.meds.moon--; moonUsed++; persist(); achBump('moon'); drawMeds(); track('item_use', { item: 'moonpunch' });
  moonGone(n); punchT = 0.5; if (ac) { SFX.whoosh(); tone(220, 0.5, 0.15, 'sawtooth', 0.05, 900); }
  toast(`把你媽的愛送上月球！目標：${n.name}`, '#ffd25a');
  // 飛彈鐵拳
  const mis = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xe8b896), [0, 0, -0.08], mis).scale.set(1, 0.85, 1.1);
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.22, 10), mat(0xc83a2a, { metalness: 0.4 }), [0, 0, 0.08], mis).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const f = mesh(new THREE.BoxGeometry(0.008, 0.09, 0.07), mat(0xeeeeee), [0, 0, 0.17], mis); f.rotation.z = i * Math.PI / 2; f.position.x = Math.cos(i * Math.PI / 2 + Math.PI / 2) * 0.05; f.position.y = Math.sin(i * Math.PI / 2 + Math.PI / 2) * 0.05; }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 8), new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.9, fog: false })); flame.rotation.x = -Math.PI / 2; flame.position.z = 0.3; mis.add(flame);
  scene.add(mis);
  const p0 = camera.localToWorld(new THREE.Vector3(0.18, -0.18, -0.45)); mis.position.copy(p0);
  let t = 0, smokeT = 0; const dur = 0.7;
  moonFx.push(dt => {
    t += dt; const k = Math.min(1, t / dur); const p1 = worldOf(n.head);
    const pos = new THREE.Vector3().lerpVectors(p0, p1, k); pos.y += Math.sin(k * Math.PI) * 0.25; mis.lookAt(pos.clone().multiplyScalar(2).sub(mis.position)); mis.position.copy(pos);
    flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    if ((smokeT -= dt) <= 0) { smokeT = 0.04; const s = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.7 })); s.position.copy(flame.getWorldPosition(new THREE.Vector3())); scene.add(s); let st = 0; moonFx.push(d => { st += d; s.scale.setScalar(1 + st * 2.2); (s.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - st / 0.9); s.position.y += d * 0.3; if (st >= 0.9) { scene.remove(s); return false; } return true; }); }
    if (k < 1) return true;
    scene.remove(mis); moonHit(n); return false;
  });
}
function moonHit(n: Npc) {
  shake = 0.6; if (ac) { noise(0.6, 900, 0.7, 80); tone(70, 0.5, 0.4, 'sine', 0, 35); tone(500, 0.12, 0.15, 'square', 0, 120); }
  const hp0 = worldOf(n.head);
  const ex = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 1, fog: false })); ex.position.copy(hp0); scene.add(ex);
  const ex2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5020, transparent: true, opacity: 0.9, fog: false })); ex2.position.copy(hp0); scene.add(ex2);
  let et = 0; moonFx.push(dt => { et += dt; ex.scale.setScalar(1 + et * 9); ex2.scale.setScalar(1 + et * 6); (ex.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - et / 0.45); (ex2.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - et / 0.4); if (et >= 0.45) { scene.remove(ex, ex2); return false; } return true; });
  const away = n.g.position.clone().sub(camera.position).setY(0).normalize();
  const vel = away.multiplyScalar(9).setY(2.2); const spin = new THREE.Vector3(rnd(6, 10), rnd(4, 8), rnd(5, 9));
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthTest: false, fog: false, opacity: 0 })); star.scale.setScalar(0.01); scene.add(star);
  let lt = 0; const FLY = 2.2, END = 3.2; const pitch0 = tPitch, follow = false;
  moonFx.push(dt => {
    lt += dt;
    if (follow && state === 'play') { const d = n.g.position.clone().sub(camera.position); const want = lt < END - 0.4 ? Math.min(0.12, Math.atan2(d.y, Math.hypot(d.x, d.z))) : pitch0; tPitch += (want - tPitch) * Math.min(1, dt * 4); }
    if (lt < FLY) { vel.y += dt * 3.5; n.g.position.addScaledVector(vel, dt); n.g.rotation.x += spin.x * dt; n.g.rotation.y += spin.y * dt; n.g.rotation.z += spin.z * dt; n.g.scale.setScalar(Math.max(0.05, 1 - lt / FLY * 0.95)); star.position.copy(n.g.position).y += 0.5; }
    else if (n.g.parent) scene.remove(n.g);
    const sk = lt < FLY - 0.4 ? 0 : lt < FLY ? (lt - FLY + 0.4) / 0.4 : Math.max(0, 1 - (lt - FLY) / (END - FLY));
    (star.material as THREE.SpriteMaterial).opacity = sk; star.scale.setScalar((0.6 + 0.5 * Math.abs(Math.sin(lt * 18))) * 1.4 * Math.max(sk, 0.01)); star.material.rotation = lt * 3;
    if (lt === lt && lt > FLY && lt - dt <= FLY && ac) { tone(1800, 0.08, 0.1, 'triangle'); tone(2600, 0.12, 0.08, 'triangle', 0.08); }
    if (lt >= END) { scene.remove(star); if (follow && state === 'play') tPitch = pitch0; return false; } return true;
  });
}
/** 寵物位置：躺=右側同躺；坐=頭頂；走動=身後彈跳。給 petTick 參考 */
let petWalkingMode = false;
let petLyingMode = false;
/** 身後距離平滑：走動 1.0m，靜止湊近到 0.4m */
let petDistCur = 1.0;
/** 把 petAnchor 擺到當前玩家世界位置／朝向。頭頂 ≈ feet+1.78；身後 +0.55、離地 0.3；躺姿 → 右手邊同躺 */
function updatePetAnchor() {
  if (!petMesh) return;
  let bx = 0, by = 0, bz = 0, byaw = 0, isWalk = false, isLie = false;
  if (walking) {
    bx = walkPos.x; by = jumpY; bz = walkPos.z; byaw = yaw;
    isLie = bodyPose === 'lie';
    isWalk = !isLie;
    if (isLie) byaw = bodyYaw; // 躺著的身體朝向用 bodyYaw
  } else if (plazaMode) {
    const mine = plazaMySeat();
    const pose = mine ? seatPose(mine.pileId, mine.slot) : { pos: new THREE.Vector3(SEAT.x, 0, SEAT.z), yaw: seatYaw };
    bx = pose.pos.x; by = 0; bz = pose.pos.z; byaw = pose.yaw;
  } else {
    // 工寮坐著剝蚵
    bx = SEAT.x; by = 0; bz = SEAT.z; byaw = seatYaw;
  }
  petWalkingMode = isWalk;
  petLyingMode = isLie;
  if (isLie) {
    // 躺姿：pet 放到玩家右手邊，和玩家一樣躺著面朝天
    // 玩家躺著時 outer.rotation=(π/2, bodyYaw, 0)；右手邊 = (cos(bodyYaw), 0, -sin(bodyYaw))
    const rx = Math.cos(byaw), rz = -Math.sin(byaw);
    const sideDist = 0.4;
    petAnchor.position.set(bx + rx * sideDist, by + 0.08, bz + rz * sideDist);
    petAnchor.rotation.set(Math.PI / 2, byaw, 0);
  } else if (isWalk) {
    // 身後：玩家臉向 -z（yaw=0），身後 = +z；轉成世界 (sin,cos)；高度貼地（彈跳由 petMesh.position.y 疊加）
    // 靜止時 pet 湊近到 0.4m，走動時拉開到 1.0m，用 lerp 平滑過渡
    const movingRecent = performance.now() - walkMovingT < 200;
    const target = movingRecent ? 1.0 : 0.4;
    petDistCur += (target - petDistCur) * 0.08;
    const s = Math.sin(byaw), c = Math.cos(byaw);
    petAnchor.position.set(bx + s * petDistCur, by, bz + c * petDistCur);
    petAnchor.rotation.set(0, byaw, 0);
  } else {
    // 坐著：髮蓋頂 ≈ y=1.44，位置往臉前 0.1m；戴帽子要再抬 headTopLift 量，否則被帽頂擋到
    const s = Math.sin(byaw), c = Math.cos(byaw);
    const fwd = 0.1;
    const hatLift = headTopLift(equipNow('head').id);
    petAnchor.position.set(bx - s * fwd, by + 1.44 + hatLift, bz - c * fwd);
    petAnchor.rotation.set(0, byaw, 0);
  }
}

/** 寵物每幀：工寮剝蚵／廣場都會動；玩家 10 秒沒操作就睡著暫停；累積到 tickSec 丟一塊肉進碗（只有工寮才真的入碗） */
function petTick(dt: number) {
  if (!petMesh || !petCurId) return;
  const p = petNow(); if (!p) return;
  // 位置先更新，不論啟用與否（才不會從舊位置閃現）
  updatePetAnchor();
  // 只在真的在玩的時候運作；廣場模式必須坐在剝蚵桌（不是烤位、不是抽菸區）才會產出
  const show = state === 'play' && !isPaused() && !tut;
  const plazaShellSeat = (() => {
    if (!plazaMode || !isPlazaActive()) return false;
    const s = plazaMySeat();
    if (!s) return false;
    return !pileIsGrill(s.pileId) && !isSmokePile(s.pileId);
  })();
  const canProduce = show && (!plazaMode || plazaShellSeat);
  petAnchor.visible = show;
  if (!show) { petAcc = 0; setPetSleeping(false); return; }
  // AFK：距上次任何輸入 10 秒 → 睡著暫停
  const idleMs = performance.now() - lastInteractAt;
  const afk = idleMs > 10000;
  setPetSleeping(afk);
  // 真的在走（身後、最近 200ms 有位移）→ 高頻彈跳；躺著不動；其他（站著／坐著／睡覺）→ 微漂浮
  const actuallyMoving = petWalkingMode && (performance.now() - walkMovingT < 200);
  if (petLyingMode) {
    petMesh.position.y = 0;
  } else if (actuallyMoving && !afk) {
    petBob += dt * 7;
    petMesh.position.y = Math.abs(Math.sin(petBob)) * 0.2;
  } else {
    petBob += dt * (afk ? 0.6 : 2.2);
    petMesh.position.y = Math.sin(petBob) * (afk ? 0.006 : 0.012);
  }
  if (afk || !canProduce) return;
  petAcc += dt;
  if (petAcc >= p.fx.tickSec) {
    petAcc = 0;
    petDropMeat(p);
  }
}
/** 寵物提示：右下角小膠囊，不搶大 toast 的戲 */
let _petToastHost: HTMLElement | null = null;
function petToast(text: string, color = '#9be37a') {
  if (!_petToastHost) {
    _petToastHost = document.createElement('div');
    _petToastHost.id = 'petToasts';
    document.body.appendChild(_petToastHost);
  }
  const host = _petToastHost;
  // 太多同時出現就併最舊幾個刪掉，保 UI 乾淨
  while (host.childElementCount > 3) host.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = 'petToast';
  el.textContent = text;
  el.style.color = color;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 350); }, 1600);
}

/** 寵物丟一塊肉到碗裡：沿用普通「拋肉入碗」流程（count/dCnt/meatPay/碗堆） */
const _petFrom = new THREE.Vector3();
function petDropMeat(p: NonNullable<ReturnType<typeof petNow>>) {
  if (flyers.length > 40) return;
  petAnchor.getWorldPosition(_petFrom); _petFrom.y += 0.04;
  const m = new THREE.Mesh(meatGeo, meatMat);
  const land = new THREE.Vector3(
    BOWL.x + rnd(-0.06, 0.06),
    BOWL.y - 0.04 + Math.min(bowlMeat.length, 40) * 0.0015,
    BOWL.z + rnd(-0.06, 0.06),
  );
  const md = p.fx.meatDiff;
  fly(m, _petFrom.clone(), land, 0.5, 0.3, () => {
    count++; evMeat();
    const pv = Math.max(0, eco.dpay[md] - (shiftLen < SHIFT ? eco.tempCut : 0));
    meatPay += pv; dCnt[md]++;
    bowlMeat.push(m); if (bowlMeat.length > 60) scene.remove(bowlMeat.shift()!);
    SFX.plop();
    petToast(`${p.n.replace(/^\S+\s/, '')} ＋1 ${DIFF[md].n}  +$${pv}`);
    updHud();
  });
}
function moonTick(dt: number) {
  for (let i = moonFx.length - 1; i >= 0; i--) if (!moonFx[i](dt)) moonFx.splice(i, 1);
  if (punchT > 0) { punchT = Math.max(0, punchT - dt); const k = Math.sin((1 - punchT / 0.5) * Math.PI); handR.position.z -= k * 0.35; handR.position.y += k * 0.08; handR.position.x -= k * 0.06; }
  if (moonAimOn) { if (state !== 'play') moonAimEnd(); else moonAimPos(); } plazaAimTick();
}
function renderItemShop() {
  const it = ITEMS[0]; const own = save.meds[it.id] ?? 0;
  $('shopList').insertAdjacentHTML('beforeend', `<h3><i class="ic ic-moon"></i> 道具</h3><p style="font-size:12px;opacity:.8">消耗品：上工時按「藥品/道具」使用，沒用完的會留著。</p><div class="itemCard"><div class="itemIc">${MOON_SVG}</div><div class="itemTx"><b>${it.n}</b><small style="color:#9be37a">${it.good}</small><small style="color:#ff8a7a">${it.bad}</small><small>持有 ${own}</small>${pxCd('item-' + it.id)}</div><div class="buyRow">${qtyHtml('item-' + it.id)}<button data-ibuy="${it.id}" ${save.money < px('item-' + it.id, it.price) ? 'disabled' : ''}>${pxHtml('item-' + it.id, it.price)}</button></div></div>`);
  $('shopList').querySelectorAll('button[data-ibuy]').forEach(b => {
    const i = ITEMS.find(x => x.id === b.getAttribute('data-ibuy'))!; const k = 'item-' + i.id;
    bindQty(b.closest('.itemCard')!, k, () => px(k, i.price), () => save.money, b as HTMLButtonElement);
    (b as HTMLButtonElement).onclick = async () => {
      const pr = await payFor(k, i.price, i.n); if (pr == null) return;
      const n = Math.min(getQty(k), Math.floor(save.money / pr)); if (n < 1) return;
      save.money -= pr * n; save.meds[i.id] = (save.meds[i.id] ?? 0) + n; persist(); track('buy', { item: k, price: pr * n, qty: n });
      if (ac) SFX.jingle(); if (n > 1) toast(`買了 ${n} 個${i.n}`, '#9be37a');
      resetQty(k); renderShop(); drawMeds();
    };
  });
}
(window as any).__moon = { get npcs() { return npcs.map(n => n.name); }, get used() { return moonUsed; }, get aim() { return moonAimOn; }, get fx() { return moonFx.length; }, throwCd: () => npcs.map(n => n.throwCd), windUpAll: () => ALL_NPCS.forEach(n => n.throwCd = 0) };
const go = (len: number) => {
  if (isPlazaPicked()) { launchPlaza(); return; }
  const begin = () => enterWorkShed(() => { evRun = null; shiftLen = len; audio(); if (!save.tutDone) tutStart(); else startDay(); });
  if (!save.tutDone) ensureNameThen(begin); else begin();
};
$('t60').onclick = () => go(60); $('t120').onclick = () => go(120);
function launchDeathmatch(mode: DmMode) {
  $('overlay').classList.remove('show');
  openDeathmatch({ audio: () => audio(), sfxOut: () => sfxG, gore: () => mix.gore, makeAma: (t, h) => makeAma(t, h), shellGeos: SHELL_GEOS, shellMat: pileMat, greyPick, barnGeo: BARN_GEO, barnMat: BARN_MAT, placeBarn, umb: umbNow(), model: (() => { const m = umb.clone(true); m.visible = true; m.scale.setScalar(1); return m; })(), grantOdd: (i) => { if (!Number.isInteger(i) || i < 0 || i >= ODD.length || ODD[i].limited) return null; save.odd[i] = (save.odd[i] ?? 0) + 1; if (rarOf(ODD[i].weight) === 'legend') { save.legendDry = 0; save.legendN = legendTotal(); } persist(); Social.report(rarOf(ODD[i].weight) === 'legend' ? 'legend' : 'odd', i); track('find', { kind: 'odd', item: 'odd-' + i, rarity: rarOf(ODD[i].weight), via: 'dm' }); return { name: ODD[i].name, line: ODD[i].line, n: save.odd[i], color: ODD[i].color }; }, ownedWeapons: ownedWeaponIds(), equippedWeapon: weaponNow(), setEquippedWeapon: (id) => { if (!isWeaponId(id) || !ownsWeapon(id)) return; save.shop.equipped.weapon = id; persist(); },     grantMoney: (amount, via) => { const n = Math.max(0, Math.floor(amount)); if (!n) return; save.money += n; persist(); Social.addPlayIncome(n); track('dm_reward', { amount: n, via, mode: via === 'dm-horde' ? 'horde' : 'ffa', money: save.money }); },
    reportMatchStart: (m) => {
      statsSid = crypto.randomUUID?.() ?? statsId + '-dm-' + Date.now();
      track('dm_start', { item: 'dm-' + m, mode: m });
    },
    reportMatchEnd: (info) => {
      track('dm_end', { item: 'dm-' + info.mode, mode: info.mode, kills: info.kills, waves: info.wavesCleared, earn: info.payout, reason: info.reason, dur: info.durationSec });
      const scores: { dmKills?: number; dmWaves?: number } = {};
      if (info.mode === 'ffa') scores.dmKills = Math.max(0, info.kills);
      else scores.dmWaves = Math.max(0, info.wavesCleared);
      Social.submit(scores);
    },
  }, () => { returnToMainMenu(() => { duckAmb(); }); }, DM_PRESETS[mode]);
  duckAmb();
}
$('oDmFfa').onclick = () => launchDeathmatch('ffa');
$('oDmHorde').onclick = () => launchDeathmatch('horde');
function plazaHideYard(hide: boolean) {
  if (hide) {
    plazaHomeHide = [];
    const baseCone = typeof pileHit !== 'undefined' ? pileHit : null;
    const landGs = Object.values(LAND);
    // 工寮木柱／厝頂／時鐘／碼頭漁船／水體／地標也藏：否則穿廣場走道；廣場改用北側碼頭船
    for (const o of [pile, ground, water, baseCone, getShedG(), clockG, harborDock, ...boats, ...landGs, ...stools, ...ALL_NPCS.map(n => n.g)]) {
      if (!o || (o as any).__plazaHid) continue;
      (o as any).__plazaHid = o.visible; o.visible = false; plazaHomeHide.push(o);
    }
    ALL_NPCS.forEach(n => { n.tag.sprite.visible = false; n.bubble.sprite.visible = false; });
    camera.far = 90; camera.updateProjectionMatrix();
    tpCam.far = 120; tpCam.updateProjectionMatrix();
    // 依當下時間套天色（勿強制白天，否則 30s 後 updSky 會突然跳變）
    updSky();
    const f = scene.fog as THREE.Fog; f.near = 20; f.far = 64;
  } else {
    for (const o of plazaHomeHide) { o.visible = !!(o as any).__plazaHid; delete (o as any).__plazaHid; }
    plazaHomeHide = [];
    stools.forEach(g => { g.visible = true; });
    setPlazaSeatPropsVisible(true);
    if (plazaForceTp) { plazaForceTp = false; tpv = !!save.tpv; drawCamBtn(); }
    camera.far = 50; camera.updateProjectionMatrix();
    tpCam.far = 200; tpCam.fov = 58; tpCam.updateProjectionMatrix();
    updSky();
  }
}

function applyLocalGoldSmoke() {
  const tint = gearOn('goldPipe') ? GOLD_SMOKE_TINT : undefined;
  fpCig?.setSmokeTint(tint);
  if (plazaMe) getPlazaSmokeCig(plazaMe)?.setSmokeTint(tint);
}
function refreshPlazaCosmetics() {
  applyLocalGoldSmoke();
  if (isPlazaActive()) void plazaPushCosmetics();
  try { Social.syncTitle(); } catch { /* Social 尚未初始化時略過 */ }
}
/** 吸菸區第一人稱手持菸 */
let fpCig: FpCigarette | null = null;
let smokeSitActive = false;
function ensureFpCigarette() {
  if (fpCig) return fpCig;
  fpCig = makeFpCigarette({ lowDetail: COARSE });
  // 夾在右手指尖：以「手在嘴邊」那一格反推菸在手上的位置，讓舉到嘴邊時濾嘴剛好含在嘴（畫面下緣正中）、菸頭朝前微上
  const hand = new THREE.Object3D();
  hand.position.set(PUFF_FP_MOUTH.x, PUFF_FP_MOUTH.y, PUFF_FP_MOUTH.z);
  hand.rotation.set(PUFF_FP_MOUTH.rx, PUFF_FP_MOUTH.ry, PUFF_FP_MOUTH.rz);
  hand.scale.setScalar(PUFF_FP_HAND_SCALE);
  hand.updateMatrix();
  const cigAtMouth = new THREE.Object3D();
  cigAtMouth.position.set(0.004, -0.04, -0.07);
  cigAtMouth.rotation.set(0.14, 0.06, 0);
  cigAtMouth.updateMatrix();
  const local = hand.matrix.clone().invert().multiply(cigAtMouth.matrix);
  local.decompose(fpCig.group.position, fpCig.group.quaternion, fpCig.group.scale);
  handR.add(fpCig.group);
  applyLocalGoldSmoke();
  return fpCig;
}
function setSmokeSitHands(on: boolean) {
  smokeSitActive = on;
  if (on) {
    const cig = ensureFpCigarette();
    cig.group.visible = true;
    knife.visible = false;
    oyster.visible = false;
    handRig.visible = !tpv;
  } else {
    if (fpCig) fpCig.group.visible = false;
    handL.visible = true;
    handR.visible = true;
    handR.scale.setScalar(1);
    knife.visible = true;
    const sleeve = handR.children[0] as THREE.Mesh | undefined;
    const cuff = handR.children[2] as THREE.Mesh | undefined;
    if (sleeve) { sleeve.position.set(0, 0, 0.32); sleeve.scale.set(1, 1, 1); }
    if (cuff) cuff.position.set(0, 0, 0.66);
    // oyster 可見度由 phase 管；站起後 handRig 會藏
  }
}
function disposeFpCigarette() {
  if (!fpCig) return;
  fpCig.group.parent?.remove(fpCig.group);
  fpCig.dispose();
  fpCig = null;
  smokeSitActive = false;
}

/** 吸菸區「抽一口」：FP／TP 分階段動作＋手持菸／吐煙 */
const PUFF_HOLD_MAX = 5;
const PUFF_MIN_HOLD = 0.3;
const PUFF_UP_SEC = 0.7;
const PUFF_DOWN_SEC = 0.5;
const PUFF_AWAY_SEC = 0.12;
let puffHeld = false;
let puffT = 0;
/** 0＝膝上 → 1＝嘴邊 */
let puffAnimT = 0;
/** 放開後先離嘴 1→0 */
let puffAwayT = 0;
let puffStrength = 0;
let puffReleaseAt = 0;
/** 吐煙瞬間頭微前傾 */
let puffExhaleHeadT = 0;
let puffCamPitch = 0;
let puffAshCD = 6 + Math.random() * 4;
let puffFlickT = 0;
const puffExhales: { fx: CharcoalFireFx; age: number; life: number; world?: boolean }[] = [];
const puffAshes: { tick: (dt: number) => boolean; dispose: () => void }[] = [];
// FP：膝上／弧頂／嘴邊／離嘴外推
const PUFF_FP_REST = { x: 0.30, y: -0.48, z: -0.36, rx: 1.05, ry: 0.45, rz: 0.25 };
const PUFF_FP_MID = { x: 0.1, y: -0.3, z: -0.15, rx: 1.0, ry: 0.1, rz: -0.3 };
// 嘴邊：手從右下斜舉上來，指尖夾菸在嘴前；手掌與前臂在畫面右下外
const PUFF_FP_MOUTH = { x: 0.011, y: -0.15, z: -0.008, rx: 1.15, ry: 0, rz: -0.9 };
/** 抽菸時右手縮小，舉到嘴邊只佔畫面右下約四分之一 */
const PUFF_FP_HAND_SCALE = 0.6;
const PUFF_FP_AWAY = { x: 0.04, y: -0.2, z: -0.05, rx: 1.0, ry: 0.0, rz: -0.7 };
const PUFF_FP_L = { x: -0.38, y: -0.58, z: -0.32, rx: 1.25, ry: -0.35, rz: 0.55 };

function clearPuffExhales() {
  for (const e of puffExhales) {
    try { e.fx.group.parent?.remove(e.fx.group); } catch { /* */ }
    e.fx.dispose();
  }
  puffExhales.length = 0;
  for (const a of puffAshes) a.dispose();
  puffAshes.length = 0;
}
function cancelPuff(opts?: { keepAnim?: boolean }) {
  const wasHeld = puffHeld;
  const heldMs = Math.round(Math.min(PUFF_HOLD_MAX, puffT) * 1000);
  puffHeld = false;
  puffT = 0;
  puffStrength = 0;
  puffReleaseAt = 0;
  puffAwayT = 0;
  puffExhaleHeadT = 0;
  if (!opts?.keepAnim) { puffAnimT = 0; puffCamPitch = 0; }
  const b = document.getElementById('puffBtn');
  const c = document.getElementById('puffCd');
  if (b) { b.classList.remove('held', 'low'); b.style.removeProperty('--p'); }
  if (c) c.textContent = '';
  // 離座／取消：通知遠端放下（舊服無方法時 catch 略過）
  if (wasHeld && plazaMode) void plazaSendPuff(false, heldMs);
}
function startPuff() {
  if (state !== 'play' || !smokeSitActive || puffHeld) return;
  puffHeld = true;
  puffT = 0;
  puffReleaseAt = 0;
  puffAwayT = 0;
  puffFlickT = 0;
  $('puffBtn').classList.add('held');
  $('puffBtn').classList.remove('low');
  if (plazaMode) void plazaSendPuff(true, 0);
}
function endPuff() {
  if (!puffHeld) return;
  const held = puffT;
  puffHeld = false;
  const b = $('puffBtn'), c = $('puffCd');
  b.classList.remove('held', 'low');
  c.textContent = '';
  b.style.removeProperty('--p');
  puffAwayT = 0;
  const holdMs = Math.round(Math.min(PUFF_HOLD_MAX, held) * 1000);
  if (plazaMode) void plazaSendPuff(false, holdMs);
  if (held < PUFF_MIN_HOLD || !smokeSitActive) {
    puffStrength = 0;
    puffReleaseAt = 0;
    return;
  }
  puffStrength = Math.min(1, held / PUFF_HOLD_MAX);
  puffReleaseAt = performance.now();
}
function spawnExhalePuff(strength: number) {
  if (!smokeSitActive || strength <= 0) return;
  const sc = 0.35 + strength * 1.15;
  const fx = makeExhalePuff({ scale: sc, count: Math.round(6 + strength * 8), seed: 5100 + Math.floor(Math.random() * 4000), reach: tpv && plazaMe ? strength : undefined, tint: gearOn('goldPipe') ? GOLD_SMOKE_TINT : undefined });
  puffExhaleHeadT = 1;
  if (tpv && plazaMe) {
    plazaMe.head.updateMatrixWorld(true);
    const mouth = plazaMe.head.localToWorld(new THREE.Vector3(0, -0.08, -0.16));
    const yaw = plazaMe.outer.rotation.y;
    fx.group.position.copy(mouth);
    fx.group.rotation.y = yaw;
    scene.add(fx.group);
    puffExhales.push({ fx, age: 0, life: 3.6, world: true });
  } else {
    fx.group.position.set(0, -0.085, -0.05); // 嘴巴在眼睛下方，煙從畫面下緣往前上方吐出
    camera.add(fx.group);
    puffExhales.push({ fx, age: 0, life: 3.6, world: false });
  }
}
function puffVisualK() { return easeSmokePuff(puffAnimT); }
function puffInhaleK() {
  return puffHeld && puffAnimT >= 0.98 ? 1 : (puffHeld && puffAnimT > 0.7 ? (puffAnimT - 0.7) / 0.3 : 0);
}
function puffBezier(a: number, m: number, b: number, u: number) {
  const o = 1 - u;
  return o * o * a + 2 * o * u * m + u * u * b;
}
function tickPuffUi(rdt: number) {
  const show = smokeSitActive && state === 'play';
  on('puffBtn', show);
  if (!show) {
    if (puffHeld || puffReleaseAt || puffAnimT > 0) cancelPuff();
    if (plazaMe) clearPlazaSmokeCig(plazaMe);
    return;
  }
  // 本機 TP avatar 手持菸
  if (plazaMe) ensurePlazaSmokeCig(plazaMe, COARSE);
  applyLocalGoldSmoke();

  if (puffHeld) {
    puffT = Math.min(PUFF_HOLD_MAX, puffT + rdt);
    const rem = PUFF_HOLD_MAX - puffT;
    const b = $('puffBtn'), c = $('puffCd');
    b.style.setProperty('--p', `${((rem / PUFF_HOLD_MAX) * 100).toFixed(1)}%`);
    c.textContent = `${rem.toFixed(1)}s`;
    b.classList.toggle('low', rem < 1.2);
    puffAnimT = Math.min(1, puffAnimT + rdt / PUFF_UP_SEC);
    puffAwayT = Math.max(0, puffAwayT - rdt / 0.2);
  } else {
    // 放開：一邊放下一邊略離嘴，不再先彈回嘴邊
    puffAnimT = Math.max(0, puffAnimT - rdt / PUFF_DOWN_SEC);
    puffAwayT = puffAnimT > 0 ? Math.min(1, puffAwayT + rdt / PUFF_AWAY_SEC) : 0;
  }
  // 吸氣鏡頭微仰
  const inhale = puffInhaleK();
  const wantCam = inhale * 0.045; // ~2.5°
  puffCamPitch += (wantCam - puffCamPitch) * Math.min(1, rdt * 6);
  puffExhaleHeadT = Math.max(0, puffExhaleHeadT - rdt / 0.45);

  if (puffReleaseAt && performance.now() - puffReleaseAt >= 1000) {
    const s = puffStrength;
    puffReleaseAt = 0;
    puffStrength = 0;
    spawnExhalePuff(s);
  }
  for (let i = puffExhales.length - 1; i >= 0; i--) {
    const e = puffExhales[i];
    e.age += rdt;
    e.fx.tick(performance.now() * 0.001, rdt);
    if (e.age >= e.life) {
      try { e.fx.group.parent?.remove(e.fx.group); } catch { /* */ }
      e.fx.dispose();
      puffExhales.splice(i, 1);
    }
  }
  // idle 彈烟灰
  if (!puffHeld && puffAnimT < 0.05 && puffFlickT <= 0) {
    puffAshCD -= rdt;
    if (puffAshCD <= 0) {
      puffFlickT = 1;
      puffAshCD = 6 + Math.random() * 4;
      spawnPuffAsh();
    }
  }
  if (puffFlickT > 0) puffFlickT = Math.max(0, puffFlickT - rdt / 0.28);
  for (let i = puffAshes.length - 1; i >= 0; i--) {
    if (!puffAshes[i].tick(rdt)) { puffAshes[i].dispose(); puffAshes.splice(i, 1); }
  }
  // 菸頭亮度
  const tipBoost = inhale * 1.2 + (puffHeld ? 0.35 : 0);
  if (fpCig && !tpv) fpCig.setTipBoost(tipBoost);
  if (plazaMe) {
    const cig = getPlazaSmokeCig(plazaMe);
    if (cig) {
      cig.setTipBoost(tipBoost);
      cig.tick(performance.now() * 0.001, rdt);
    }
  }
}
function spawnPuffAsh() {
  if (tpv && plazaMe) {
    const cig = getPlazaSmokeCig(plazaMe);
    if (!cig) return;
    const local = new THREE.Vector3(0.02, 0.02, -0.2);
    puffAshes.push(spawnAshSpeck(cig.group, local));
  } else if (fpCig && !tpv) {
    puffAshes.push(spawnAshSpeck(fpCig.group, new THREE.Vector3(0, 0.01, -0.09)));
  }
}
/** 吸菸座 FP：左手下垂；右手分階段抽烟 */
function applySmokeSitFpHands() {
  if (!smokeSitActive || tpv) return;
  // 第一人稱只顯示朝前的香菸：雙手模型藏起來，菸仍跟著右手軌跡
  handL.visible = false; // 左手垂在膝邊，第一人稱看不到
  handR.visible = true;
  handL.position.set(PUFF_FP_L.x, PUFF_FP_L.y, PUFF_FP_L.z);
  handL.rotation.set(PUFF_FP_L.rx, PUFF_FP_L.ry, PUFF_FP_L.rz);
  const u = puffVisualK();
  const away = puffAwayT;
  const inhale = puffInhaleK();
  const flick = Math.sin(puffFlickT * Math.PI);
  const bob = inhale > 0.2 ? Math.sin(performance.now() * 0.0035) * 0.005 * inhale : 0;
  const R = PUFF_FP_REST, M = PUFF_FP_MID, B = PUFF_FP_MOUTH, A = PUFF_FP_AWAY;
  let x = puffBezier(R.x, M.x, B.x, u);
  let y = puffBezier(R.y, M.y, B.y, u) + bob;
  let z = puffBezier(R.z, M.z, B.z, u);
  let rx = puffBezier(R.rx, M.rx, B.rx, u);
  let ry = puffBezier(R.ry, M.ry, B.ry, u);
  let rz = puffBezier(R.rz, M.rz, B.rz, u);
  if (away > 0.01) {
    // 離嘴偏移乘上舉手程度：越放下越淡，不會跳
    const t = away * u;
    x += (A.x - B.x) * t;
    y += (A.y - B.y) * t;
    z += (A.z - B.z) * t;
    rx += (A.rx - B.rx) * t;
    ry += (A.ry - B.ry) * t;
    rz += (A.rz - B.rz) * t;
  }
  if (flick > 0.01 && u < 0.2) {
    x += flick * 0.04; y -= flick * 0.02; rz += flick * 0.15;
  }
  // 吸氣肩微抬
  y += inhale * 0.012;
  handR.position.set(x, y, z);
  handR.rotation.set(rx, ry, rz);
  handR.scale.setScalar(PUFF_FP_HAND_SCALE);
  // 嘴邊把袖管往肘側／下拉，減少畫面裡的前臂
  const sleeve = handR.children[0] as THREE.Mesh | undefined;
  const cuff = handR.children[2] as THREE.Mesh | undefined;
  if (sleeve) {
    sleeve.position.set(0, -u * 0.1, 0.32 + u * 0.42);
    sleeve.scale.set(1, 1, 1 - u * 0.25);
  }
  if (cuff) cuff.position.set(0, -u * 0.06, 0.66 + u * 0.35);
}

/** 廣場坐下：強制第一人稱（不寫入存檔偏好；站起再還原） */
function plazaEnsureFpView() {
  if (!tpv) { drawCamBtn(); return; }
  plazaForceTp = false;
  tpv = false;
  drawCamBtn();
}
/** 離開廣場時清掉座落卡／搖桿等 HUD，避免殘留到主選單或其他工寮 */
function clearPlazaLeaveUi() {
  setNearSeat(null);
  setWalking(false);
  clearWalkInput();
  on('seatCard', false);
  on('joy', false);
  on('standBtn', false);
  on('sitBtn', false);
  setSmokeSitHands(false);
  cancelPuff();
  clearPuffExhales();
  disposeFpCigarette();
  if (plazaMe) clearPlazaSmokeCig(plazaMe);
  handRig.visible = true;
  document.body.classList.remove('plazaRoam', 'plazaSmokeSit');
  const info = document.getElementById('seatInfo');
  if (info) info.innerHTML = '';
  const sit = document.getElementById('sitBtn');
  if (sit) sit.innerHTML = '<i class="ic ic-chair"></i> 坐這裡<span class="key"> (E)</span>';
  const kb = document.getElementById('joyK');
  if (kb) kb.style.transform = '';
}
function showPlazaLoading(show = true) {
  let el = document.getElementById('plazaLoad');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'plazaLoad';
      el.innerHTML = `<div class="pzLoadTitle">蚵仔廣場</div><div class="pzLoadSub">正在入場…</div><div class="pzLoadBar" aria-hidden="true"><i></i></div><button type="button" id="plazaLoadCancel">取消</button>`;
      document.body.appendChild(el);
      el.querySelector('#plazaLoadCancel')!.addEventListener('click', () => {
        returnToMainMenu(async () => {
          setPlazaMode(false); plazaPlayAt = 0;
          plazaHideYard(false);
          if (isPlazaActive()) await closePlaza(true).catch(() => 0);
          applySeat(save.seat ?? 'door');
          clearPlazaLeaveUi();
          void refreshPlazaOnlineAfterLeave();
        });
      });
    }
    const sub = el.querySelector('.pzLoadSub'); if (sub) sub.textContent = '正在入場…';
    el.classList.add('on');
  } else {
    el?.classList.remove('on');
  }
}
/** 進一般工寮的等待畫面（至少 1 秒） */
let shedLoadGen = 0;
function showShedLoading(show = true) {
  let el = document.getElementById('shedLoad');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'shedLoad';
      el.innerHTML = `<div class="shedLoadTitle">蚵寮工寮</div><div class="shedLoadSub">正在進場…</div><div class="shedLoadBar" aria-hidden="true"><i></i></div>`;
      document.body.appendChild(el);
    }
    const title = el.querySelector('.shedLoadTitle');
    if (title) title.textContent = locNow().n || '蚵寮工寮';
    const sub = el.querySelector('.shedLoadSub'); if (sub) sub.textContent = '正在進場…';
    el.classList.add('on');
  } else {
    el?.classList.remove('on');
  }
}
/** 回主畫面轉場（工寮／廣場／死鬥／教學皆走這條） */
let menuLoadGen = 0;
function showMenuLoading(show = true) {
  let el = document.getElementById('menuLoad');
  if (show) {
    document.getElementById('plazaLoad')?.classList.remove('on');
    document.getElementById('shedLoad')?.classList.remove('on');
    if (!el) {
      el = document.createElement('div');
      el.id = 'menuLoad';
      el.innerHTML = `<div class="menuLoadTitle">剝蚵仔</div><div class="menuLoadSub">正在回主畫面…</div><div class="menuLoadBar" aria-hidden="true"><i></i></div>`;
      document.body.appendChild(el);
    }
    const sub = el.querySelector('.menuLoadSub'); if (sub) sub.textContent = '正在回主畫面…';
    el.classList.add('on');
  } else {
    el?.classList.remove('on');
  }
}
/** 任意場景回主畫面：先秀轉場，再打開主選單（至少約 0.9 秒） */
function returnToMainMenu(work?: () => void | Promise<void>, opts?: { then?: () => void }) {
  const gen = ++menuLoadGen;
  shedTrip = null; pendingShed = null; closeShedDoorPanel();
  const at = performance.now();
  showMenuLoading(true);
  for (const id of ['result', 'backMenu']) $(id).classList.remove('show');
  void (async () => {
    try { await work?.(); }
    finally {
      state = 'menu'; syncShiftUi();
      renderLocs({ forcePlazaOnline: true });
      $('overlay').classList.add('show');
      $('overlay').scrollTop = 0;
      const wait = Math.max(0, 900 - (performance.now() - at));
      setTimeout(() => {
        if (gen !== menuLoadGen) return;
        showMenuLoading(false);
        opts?.then?.();
      }, wait);
    }
  })();
}
function enterWorkShed(run: () => void) {
  if (plazaMode || isPlazaActive() || SHOT) { run(); return; }
  showShedLoading(true);
  ['overlay', 'result', 'dex', 'settings', 'shop'].forEach(id => $(id).classList.remove('show'));
  const gen = ++shedLoadGen;
  const at = performance.now();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    // 進工寮一律第一人稱，並看向前方 NPC
    if (tpv) setTpv(false);
    try { run(); } finally {
      yaw = tYaw = 0; pitch = tPitch = -0.22;
      const wait = Math.max(0, 1000 - (performance.now() - at));
      setTimeout(() => { if (gen === shedLoadGen) showShedLoading(false); }, wait);
    }
  }));
}
// ---------- 廣場北碼頭 → 工寮（上工完回廣場） ----------
const locOwned = (l: typeof LOCS[number]) => l.need === 0 || (save.locs ?? []).includes(l.id);
/** 花錢提早解鎖地點（金錢在本機存檔；價格可由後台價目表覆寫 loc-xxx） */
async function buyLocEarly(id: string): Promise<boolean> {
  const l = LOCS.find(x => x.id === id);
  if (!l || !l.price) return false;
  save.locs ??= [];
  if (locOwned(l)) return true;
  const name = shedName(id);
  const pr = await payFor('loc-' + id, l.price, name);
  if (pr == null) {
    toast(save.money < px('loc-' + id, l.price) ? `錢不夠，解鎖${name}要 $${px('loc-' + id, l.price)}` : '價格剛更新，請再按一次', '#ffb08a');
    return false;
  }
  save.money -= pr; save.locs.push(id); persist();
  track('buy', { item: 'loc-' + id, price: pr });
  Social.report('port', LOCS.indexOf(l));
  if (ac) SFX.jingle();
  toast(`已解鎖：${name}`, '#9be37a');
  return true;
}
const SHED_SHIFTS = () => [
  { len: SHIFT, label: '正常班', sub: `${Math.round(SHIFT / 60)} 分鐘` },
  { len: 60, label: '臨時工', sub: '1 分鐘' },
  { len: 120, label: '臨時工', sub: '2 分鐘' },
];
function openShedDoor(loc: string) {
  const l = LOCS.find(x => x.id === loc);
  if (!l || !plazaMode || state !== 'play') return;
  const own = locOwned(l);
  openShedDoorPanel({
    name: shedName(loc),
    mult: l.m,
    desc: l.d,
    unlocked: own,
    needText: `入碗 ${save.life.inBowl ?? 0}/${l.need} 顆解鎖`,
    price: l.price ? px('loc-' + loc, l.price) : null,
    money: save.money,
    settleFirst: plazaShiftStarted(),
    shifts: SHED_SHIFTS(),
    onShift: (len) => goShedFromPlaza(loc, len),
    onUnlock: () => buyLocEarly(loc),
    stillNear: () => plazaMode && plazaNearShed() === loc,
  });
}
function goShedFromPlaza(loc: string, len: number) {
  if (!plazaMode || state !== 'play') return;
  const l = LOCS.find(x => x.id === loc);
  if (!l || !locOwned(l)) return;
  // 廣場已開工：先跑廣場結算畫面，主按鈕改成「前往 XX 上工」
  if (plazaShiftStarted()) { pendingShed = { loc, len }; endReason = 'quit'; endDay(); return; }
  void leavePlazaForShed({ loc, len });
}
/** 離開廣場（同回主選單的收尾），記住回程站位在該工寮門口，接著照原本流程上工 */
async function leavePlazaForShed(trip: { loc: string; len: number }) {
  pendingShed = null;
  closeShedDoorPanel();
  showShedLoading(true);
  for (const id of ['result', 'backMenu']) $(id).classList.remove('show');
  await plazaPayWait?.catch(() => 0);
  plazaShellGen++;
  setPlazaMode(false); plazaPayWait = null; plazaPlayAt = 0;
  plazaHideYard(false);
  plazaHideChrome(true);
  await closePlaza().catch(() => 0);
  applySeat(save.seat ?? 'door');
  clearPlazaLeaveUi();
  // closePlaza 會記下目前站位（圈內）；改成門口外一步、面向廣場
  const sp = shedReturnSpawn(trip.loc);
  if (sp) { save.plazaSpawn = sp; persist(); }
  shedTrip = { loc: trip.loc };
  state = 'menu'; syncShiftUi();
  enterWorkShed(() => {
    evRun = null; shiftLen = trip.len; audio(); updSky();
    if (!save.tutDone) tutStart(); else startDay();
  });
}
/** 工寮結算後回廣場：站在剛剛那間工寮門口 */
function returnToPlazaFromShed() {
  shedTrip = null; pendingShed = null;
  for (const id of ['result', 'backMenu']) $(id).classList.remove('show');
  state = 'menu'; syncShiftUi();
  shiftLen = SHIFT; updSky();
  launchPlaza();
}
function launchPlaza() {
  if (isDeathmatchActive() || isPlazaActive()) return;
  // 先蓋住工寮場景，連線完成再進廣場
  showPlazaLoading(true);
  $('overlay').classList.remove('show');
  openPlaza({
    id: statsId,
    nick: () => myName(),
    toast: (t, c) => toast(t, c),
    audio: () => audio(),
    scene,
    camera: () => viewCam(),
    bubbles: $('bubbles'),
    shellGeo,
    shellMat: pileMat,
    applySeatPose: (pos, yaw) => applyPlazaSeatPose(pos, yaw),
    getPhase: () => phase,
    // 可丟殼且準星瞄到人：同步 throwAim，遠端播左手舉殼
    getSyncPhase: () => jumpT > 0 ? 'jump' : bodyPose && walking ? bodyPose : ((phase === 'empty' || phase === 'seam') && plazaThrowTarget() ? 'throwAim' : phase),
    getCount: () => count,
    getWalkXZ: () => (walking ? { x: walkPos.x, z: walkPos.z } : { x: SEAT.x, z: SEAT.z }),
    getYaw: () => (!walking ? seatYaw : (plazaMode && bodyPose === 'lie' ? bodyYaw : yaw)),
    // 坐下第一人稱：yaw＝相對座位轉頭；第三人稱／走動：lookYaw＝0（躺／繞鏡頭不轉身體）
    getLookYaw: () => (walking || tpv ? 0 : yaw),
    getPitch: () => (tpv ? 0 : pitch),
    getTpv: () => tpv,
    getOutfit: () => ({
      head: equipNow('head').id,
      hand: equipNow('hand').id,
      body: equipNow('body').id,
      legs: equipNow('legs').id,
      feet: equipNow('feet').id,
    }),
    getCosmetics: () => encodeCosmetics({
      goldSmoke: gearOn('goldPipe'),
      cushion: gearOn('seatCush'),
      nameFrame: gearOn('nameFrame'),
      pet: petNow()?.id ?? '',
    }),
    ownsFlag: () => save.shop.owned.includes('plazaFlag'),
    getMoving: () => {
      if (!walking) return false;
      if (joy.x * joy.x + joy.y * joy.y > 0.04) return true;
      for (const c of walkKeys) if (/Key[WASD]|Arrow/.test(c)) return true;
      return false;
    },
    getUmb: () => umbHeld || umbT > 0,
    getEco: () => mix.eco,
    hasOwnPet: () => !!petNow(),
    selfHatLift: () => headTopLift(equipNow('head').id),
    getPlazaSpawn: () => save.plazaSpawn,
    persistPlazaSpawn: (spawn) => { save.plazaSpawn = spawn; persist(); },
    shedUnlocked: (loc) => { const l = LOCS.find(x => x.id === loc); return !!l && locOwned(l); },
    shedPromptInfo: (loc) => {
      const l = LOCS.find(x => x.id === loc); const name = shedName(loc);
      if (!l) return name;
      return locOwned(l) ? `${name}・工錢 ×${l.m.toFixed(1)}` : `${name}　入碗 ${save.life.inBowl ?? 0}/${l.need} 顆解鎖`;
    },
    openShedDoor: (loc) => openShedDoor(loc),
    onShellThrow: (e) => {
      // 自己丟的已經在本地飛過；別人的殼（含打向自己）播飛行動畫＋甩臂
      try {
        if (e.fromConnId && e.fromConnId === plazaConnId()) return;
        if (!plazaMode || !isPlazaActive()) return;
        plazaPlayThrowFx(e.fromConnId);
        if (e.toConnId && e.toConnId === plazaConnId()) {
          // 打向自己：一般丟殼會接著收到 ShellInbound，改成先預警再飛；反彈回來的沒有 Inbound，稍等後照常飛
          const rec = { e, at: performance.now() };
          plazaThrowToMe = rec;
          const gen = plazaShellGen;
          later(0.15, () => { if (gen !== plazaShellGen || plazaThrowToMe !== rec) return; plazaThrowToMe = null; plazaFlyShell(e); });
          return;
        }
        plazaFlyShell(e);
      } catch (err) { console.error('plaza shell throw', err); }
    },
    onShellInbound: (e) => {
      // 飛行動畫約 0.55s 後結算；世代號避免離開廣場後還結算
      plazaThrowToMe = null; // 這顆由預警流程負責飛＋結算
      if (!plazaMode || !isPlazaActive()) return;
      plazaWarnStart(e);
    },
    onShellReflectHit: (e) => {
      // 反彈飛回約 0.4s；視覺走 ShellThrow，這裡結算傷害＋提示
      const gen = plazaShellGen;
      later(0.4, () => { if (gen !== plazaShellGen) return; resolvePlazaReflectHit(e); });
    },
    onShellBlocked: (e) => { resolvePlazaBlocked(e); },
    onShellHit: (e) => { resolvePlazaShellHitFx(e); },
    onNpcMoon: (e: any) => {
      const me = plazaConnId();
      const byId = String(e?.byConnId ?? e?.ByConnId ?? '');
      // 本地發射者已在 plazaMoonFire 播過飛彈／提示，略過回聲避免重播
      if (performance.now() < localMoonFxUntil) return;
      if (me && byId && byId === me) return;
      plazaMissileFx(new THREE.Vector3(e.fromX, e.fromY, e.fromZ), new THREE.Vector3(e.toX, e.toY, e.toZ));
      if (e.by) toast(`${e.by} 把阿婆送上月球了`, '#ffd25a');
    },
    onGrillTaken: (e) => { try { onPlazaGrillTaken(e); } catch (err) { console.error(err); } },
    onStealResult: (e) => {
      const me = plazaConnId();
      if (!me) return;
      if (e.toConnId === me && !e.caught) {
        const lostN = Math.max(0, count - e.toCount);
        count = Math.max(0, e.toCount);
        for (let i = 0; i < lostN; i++) { const lm = bowlMeat.pop(); if (lm) scene.remove(lm); }
        toast(`${e.fromNick} 偷走你一顆！（短暫不會再被偷）`, '#ff8a7a');
        shake = 0.12; SFX.sting();
        updHud();
      } else if (e.caught && e.fromConnId !== me && e.toConnId === me) {
        toast(`${e.fromNick} 想偷你被抓了`, '#9be37a');
      }
    },
    track: (t, d) => track(t, d),
    persist: () => persist(),
    grantMoney: (amount, via) => {
      const n = Math.max(0, Math.floor(amount));
      if (!n) return;
      save.money += n;
      persist();
      track('plaza_reward', { amount: n, via, money: save.money });
    },
    onPayout: () => { /* 結算走 plazaReportEarn */ },
    onExit: () => {
      void (async () => {
        showPlazaLoading(false);
        plazaShellGen++;
        if (state === 'play' && plazaMode && plazaShiftStarted()) { endReason = 'quit'; endDay(); return; }
        returnToMainMenu(async () => {
          setPlazaMode(false); plazaPlayAt = 0; plazaHideYard(false);
          await closePlaza().catch(() => 0); applySeat(save.seat ?? 'door');
          clearPlazaLeaveUi();
          void refreshPlazaOnlineAfterLeave();
        });
      })();
    },
    onEnterFail: () => {
      plazaShellGen++;
      returnToMainMenu(() => {
        setPlazaMode(false); plazaPlayAt = 0;
        plazaHideYard(false);
        applySeat(save.seat ?? 'door');
        clearPlazaLeaveUi();
        void syncPlazaOnlineUi(true);
      });
    },
    enterWalk: () => {
      setPlazaMode(true); plazaPlayAt = 0; evRun = null; shiftLen = SHIFT; timeLeft = SHIFT;
      plazaHideYard(true);
      state = 'play'; syncShiftUi();
      moonReset(); // 0 NPC
      // 入場用上次離開位置；坐著離開且椅被佔則站旁邊避開
      { const spawn = plazaResolveEnterSpawn(); walkPos.set(spawn.x, 1.55, spawn.z); tYaw = yaw = spawn.yaw; }
      tPitch = pitch = -0.18;
      plazaEnterWalkPose(false);
      drawRadio();
      on('quitBtn', true); on('camBtn', COARSE); on('seatCard', false);
      document.body.classList.add('plazaRoam');
      if (COARSE) { const cam = $('camBtn'); if (cam) { cam.classList.add('on'); cam.style.display = ''; } }
      showPlazaLoading(false);
      updHud();
      markPlazaVisited();
      toast('蚵仔廣場・休閒剝蚵，隨便坐、不趕時間', '#9be37a');
    },
    beginShift: () => {
      setPlazaMode(true); evRun = null; shiftLen = SHIFT; setWalking(false);
      document.body.classList.remove('plazaRoam');
      on('standBtn', true); on('joy', false); on('umbBtn', true); on('medBtn', true); on('seatCard', false);
      handRig.visible = true; tYaw = yaw = 0; tPitch = pitch = -0.42;
      plazaEnsureFpView();
      startDay();
      on('standBtn', true);
      hint.textContent = '休閒模式：點面前蚵堆撈蚵，想換堆按「換位置」。無倒數，離開再結算。';
      toast('坐下了！第一人稱可左右轉約 90° 看旁邊', '#9be37a');
    },
    resumeSit: () => {
      setWalking(false); setNearSeat(null); on('seatCard', false); on('joy', false); clearWalkInput();
      document.body.classList.remove('plazaRoam');
      handRig.visible = true; tYaw = yaw = 0; tPitch = pitch = -0.42;
      plazaEnsureFpView();
      on('standBtn', true); on('umbBtn', true); on('medBtn', true);
      // 換位：手上那顆（含撬到一半）放回原堆，盆子換成新桌難度並補滿
      oysterToHand(); oyster.visible = false; on('prog', false); setPhase('busy');
      plazaRefillBasin();
      toast('換位坐下，臉盆換成這桌的蚵仔', '#9fe0ff'); SFX.pop(); later(0.3, goPick);
    },
    refillBasin: () => { plazaRefillBasin(); },
    enterSmokeSit: () => {
      setWalking(false); setNearSeat(null); on('seatCard', false); on('joy', false); clearWalkInput();
      // plazaRoam 會藏剝蚵鈕；plazaSmokeSit 讓站起／回主選單與一般座位同款可見
      document.body.classList.add('plazaRoam', 'plazaSmokeSit');
      tYaw = yaw = 0; tPitch = pitch = -0.35;
      plazaEnsureFpView();
      setSmokeSitHands(true);
      on('standBtn', true); on('throwBtn', false); on('stealBtn', false);
      on('umbBtn', false); on('medBtn', true); on('quitBtn', true); on('camBtn', COARSE);
      if (COARSE) { const cam = $('camBtn'); if (cam) { cam.classList.add('on'); cam.style.display = ''; } }
      toast('吸菸區・休息一下', '#9be37a');
      hint.textContent = '吸菸區：按「換位置」站起來繼續逛；可按住「抽一口」';
      SFX.pop();
    },
    enterRestSit: (slot?: number) => {
      setWalking(false); setNearSeat(null); on('seatCard', false); on('joy', false); clearWalkInput();
      // 與吸菸座同款按鈕可見度（站起／回主選單），但不拿菸、不顯示抽一口
      document.body.classList.add('plazaRoam', 'plazaSmokeSit');
      tYaw = yaw = 0; tPitch = pitch = -0.3;
      plazaEnsureFpView();
      handRig.visible = false;
      on('standBtn', true); on('throwBtn', false); on('stealBtn', false);
      on('umbBtn', false); on('medBtn', true); on('quitBtn', true); on('camBtn', COARSE);
      if (COARSE) { const cam = $('camBtn'); if (cam) { cam.classList.add('on'); cam.style.display = ''; } }
      const hq = slot === HQ_SEAT_SLOT;
      toast(hq ? '競選總部・坐下歇一會兒' : '樸子腳・坐下歇一會兒', '#9be37a');
      hint.textContent = hq ? '競選總部門口：按「換位置」站起來繼續逛' : '樸子腳門口：按「換位置」站起來繼續逛';
      SFX.pop();
    },
    goWalk: () => {
      document.body.classList.add('plazaRoam');
      document.body.classList.remove('plazaSmokeSit');
      setSmokeSitHands(false);
      cancelPuff();
      clearPuffExhales();
      disposeFpCigarette();
      if (plazaMe) clearPlazaSmokeCig(plazaMe);
      plazaEnterWalkPose(true);
      on('camBtn', COARSE);
      if (COARSE) { const cam = $('camBtn'); if (cam) { cam.classList.add('on'); cam.style.display = ''; } }
    },
  });
}
$('start').onclick = () => {
  if (isPlazaPicked()) { launchPlaza(); return; }
  const begin = () => enterWorkShed(() => { evRun = null; shiftLen = SHIFT; audio(); if (!save.tutDone) tutStart(); else startDay(); });
  if (!save.tutDone) ensureNameThen(begin); else begin();
};
btn('again', () => {
  if (evLastId != null) { void evAgain(); return; }
  else if (plazaMode) return; // 廣場休閒：離開後回主選單，不跑再次上工
  else enterWorkShed(() => startDay());
});
btn('resMenu', () => {
  const menuBtn = $('resMenu') as HTMLButtonElement;
  if (menuBtn.disabled) return;
  menuBtn.disabled = true;
  $('result').classList.remove('show');
  const fromPlaza = plazaMode;
  const toShed = fromPlaza ? pendingShed : null;
  if (toShed) {
    void leavePlazaForShed(toShed).finally(() => { menuBtn.disabled = false; menuBtn.innerHTML = `<i class="ic ic-home"></i> 回主選單`; });
    return;
  }
  if (!fromPlaza && shedTrip) {
    returnToPlazaFromShed();
    menuBtn.disabled = false; menuBtn.innerHTML = `<i class="ic ic-home"></i> 回主選單`;
    return;
  }
  if (fromPlaza) menuBtn.innerHTML = `<i class="ic ic-home"></i> 結算中…`;
  returnToMainMenu(async () => {
    if (fromPlaza) {
      await plazaPayWait?.catch(() => 0);
      setPlazaMode(false); plazaPayWait = null; plazaPlayAt = 0;
      plazaHideYard(false);
      plazaHideChrome(true);
      await closePlaza().catch(() => 0);
      applySeat(save.seat ?? 'door');
      clearPlazaLeaveUi();
      void refreshPlazaOnlineAfterLeave();
    }
  }, {
    then: () => {
      const againBtn = $('again'); if (againBtn) againBtn.style.display = '';
      menuBtn.disabled = false;
      menuBtn.innerHTML = `<i class="ic ic-home"></i> 回主選單`;
    },
  });
});
$('dexBtn').onclick = () => { renderDex(); $('dex').classList.add('show'); };
$('eqBtn').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); eqPick = null; openEquip(); };
$('setBtn').onclick = () => { $('settings').classList.add('show'); void refreshTag(); };
$('calBtn').onclick = () => { calTipOff(); openDaily(); }; renderDaily(); calTipCheck(); document.addEventListener('visibilitychange', () => { if (!document.hidden) renderDaily(); });
if (params.get('bonusdone') === '1') { save.bonusDay = todayKey(); renderDaily(); }
setTimeout(checkReturn, 600);
$('resetSave').onclick = () => { if (confirm('確定要重置存檔？錢、圖鑑、生涯紀錄、設定都會清掉，無法復原。')) { LS.removeItem('oyster-sim'); LS.removeItem('oyster-mix'); location.reload(); } };
{
  const lab: Record<string, string> = { idle: '待命', syncing: '同步中…', ok: '已同步', err: '同步失敗', offline: '離線' };
  onCloudStatus((s, err) => { $('cloudStat').textContent = err ? `${lab[s] ?? s}（${err}）` : (lab[s] ?? s); });
  $('cloudSyncNow').onclick = async () => {
    const reloading = await cloudFlush();
    if (!reloading) toast($('cloudStat').textContent?.startsWith('已同步') ? '已同步到雲端' : '同步未完成，請稍後再試', '#9ad0ff');
  };
  $('cloudLink').onclick = async () => {
    const r = await cloudMakeLink();
    const box = $('cloudCode');
    if (!r.ok) { toast(r.err, '#ffb08a'); box.style.display = 'none'; return; }
    box.style.display = '';
    box.textContent = `連結碼：${r.code}（約 ${Math.round(r.ttlMs / 60000)} 分鐘內有效，另一台在「輸入連結碼」貼上）`;
    try { await navigator.clipboard?.writeText(r.code); toast(`已複製連結碼 ${r.code}`); } catch { toast(`連結碼：${r.code}`); }
  };
  $('cloudClaim').onclick = async () => {
    const code = prompt('輸入另一台產生的 6 碼連結碼（會覆蓋本機進度）');
    if (!code) return;
    if (!confirm('確定用雲端存檔覆蓋這台裝置的進度？')) return;
    const r = await cloudClaimLink(code);
    if (!r.ok) toast(r.err, '#ffb08a');
  };
}
$('shopBtn').onclick = () => { shopFromEquip = false; if (document.pointerLockElement) document.exitPointerLock(); openShopPx(); renderShop(); $('shop').classList.add('show'); };
$('shopBtn2').onclick = () => { shopFromEquip = false; openShopPx(); renderShop(); $('shop').classList.add('show'); };
$('shopClose').onclick = () => {
  $('shop').classList.remove('show');
  if (sleeveTry) { sleeveTry = null; applySleeve(); }
  if (shopFromEquip) {
    shopFromEquip = false;
    openEquip();
  }
};
applyKnife(); applyUmb(); applySeat(save.seat ?? 'door'); refreshPet();
$('pidLong').textContent = statsId;
let myTag = '', tagNoted = false;
const pidText = () => myTag ? `${Social.myNick()} #${myTag}` : '';
const refreshTag = () => Social.me().then(m => {
  if (m) myTag = m.tag;
  $('pidVal').textContent = pidText() || (m === null && !myTag ? '暫時連不上伺服器' : '讀取中…');
  ($('pidCopy') as HTMLButtonElement).style.display = myTag ? '' : 'none';
  if (m?.changed && !tagNoted) {
    tagNoted = true;
    $('tnBody').innerHTML = `<p>你的玩家號碼已更新為 <b>#${m.tag}</b>${m.oldTag ? `（原本是 #${m.oldTag}）` : ''}。</p><p style="font-size:14px;opacity:.85">原本的號碼跟其他玩家重複，為了排行榜和禮物不會弄錯人，系統幫你換了一個新號碼。錢和紀錄都不受影響。</p>`;
    $('tagNote').classList.add('show');
  }
});
$('tnOk').onclick = () => { $('tagNote').classList.remove('show'); Social.ackMe(); };
setTimeout(refreshTag, 1500);
$('pidCopy').onclick = () => {
  const txt = pidText(); if (!txt) return;
  const sel = () => { const r = document.createRange(); r.selectNodeContents($('pidVal')); const w = getSelection(); w?.removeAllRanges(); w?.addRange(r); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => toast('已複製'), () => { sel(); toast('已選取，請長按複製'); });
  else { sel(); try { document.execCommand('copy'); toast('已複製'); } catch { toast('已選取，請長按複製'); } }
};
$('setClose').onclick = () => $('settings').classList.remove('show');
for (const k of ['master', 'amb', 'sfx'] as const) { const el = $('v_' + k) as HTMLInputElement; el.value = String(mix[k]); el.oninput = () => { mix[k] = Number(el.value); applyMix(); if (k === 'sfx' && ac) SFX.plop(); }; }
for (const [id, key] of [['v_invX', 'invX'], ['v_invY', 'invY']] as const) { const c = $(id) as HTMLInputElement; c.checked = mix[key]; c.onchange = () => { mix[key] = c.checked; applyMix(); }; }
{ const mv = $('v_music') as HTMLInputElement; mv.value = String(mix.music); mv.oninput = () => { mix.music = +mv.value; applyMix(); }; }
{ const g = $('v_stats') as HTMLInputElement; g.checked = mix.stats; g.onchange = () => { mix.stats = g.checked; applyMix(); }; }
{ const g = $('v_feed') as HTMLInputElement; g.checked = mix.feed; g.onchange = () => { mix.feed = g.checked; applyMix(); }; }
{ const g = $('v_rotTip') as HTMLInputElement; g.checked = mix.rotTip; g.onchange = () => { mix.rotTip = g.checked; applyMix(); }; }
  { const g = $('v_gore') as HTMLInputElement; g.checked = mix.gore; g.onchange = () => { mix.gore = g.checked; applyMix(); }; }
{ const sv = $('v_sens') as HTMLInputElement; sv.value = String(mix.sens); sv.oninput = () => { mix.sens = +sv.value; applyMix(); }; }
document.addEventListener('pointerlockchange', () => { const l = document.pointerLockElement === canvas; on('lockHint', !l && state === 'play' && !matchMedia('(pointer: coarse)').matches); setPhase(phase); });
{ const m = $('v_mute') as HTMLInputElement; m.checked = mix.mute; m.onchange = () => { mix.mute = m.checked; applyMix(); }; }
{ const e = $('v_eco') as HTMLInputElement; e.checked = mix.eco; e.onchange = () => { mix.eco = e.checked; applyEcoGfx(); resize(); applyMix(); toast(mix.eco ? '已開省電：降解析・關陰影・簡材質／少燈・降面（重新整理後 AA／精度／GPU／網格才會變）' : '已關省電：柔和陰影（重新整理後抗鋸齒／GPU／網格才會變）', '#9be37a'); }; }
{ const el = $('v_bright') as HTMLInputElement; const pct = $('v_brightPct'); const syncBrightUi = () => { el.value = String(Math.round(mix.bright * 100)); pct.textContent = `${Math.round(mix.bright * 100)}%`; };
  const applyBright = (n: number, save: boolean) => { mix.bright = setSceneBrightness(n); syncBrightUi(); if (save) applyMix(); };
  syncBrightUi();
  el.oninput = () => applyBright(Number(el.value) / 100, true);
  $('v_brightReset').onclick = () => applyBright(BRIGHT_DEF, true);
}
window.addEventListener('pointerdown', () => audio(), { once: true });
$('dexClose').onclick = () => $('dex').classList.remove('show');

// ---------- 阿婆真正咧剝 ----------
function npcShuck(n: Npc, dt: number, t: number) {
  if (n.pause > 0 || n.distract > 0 || n.angry > 0) n.pause -= dt; else n.cyc += dt / n.dur;
  const c = n.cyc;
  const prying = c > 0.15 && c < 0.6 && n.pause <= 0 && n.distract <= 0;
  n.armR.rotation.x = n.windup > 0 ? -2.4 : n.angry > 0 ? -1.6 + Math.sin(t * 12) * 0.3 : prying ? -0.25 + Math.sin(t * 28) * 0.12 : -0.05;
  n.armR.rotation.z = prying ? Math.sin(t * 14) * 0.08 : 0;
  if ((n.scoopT ?? 0) > 0) { n.scoopT! -= dt; n.armL.rotation.x = n.armR.rotation.x = -0.9 + Math.sin(t * 8) * 0.2; n.body.rotation.x = 0.35; return; }
  if (n.bump && (n.bumpT = (n.bumpT ?? 0) - dt) <= 0) { n.head.remove(n.bump); n.bump = undefined; }
  if ((n.clutch ?? 0) > 0) { n.clutch! -= dt; n.armL.rotation.x = n.armR.rotation.x = -2.7; n.body.rotation.z = Math.sin(t * 18) * 0.08; return; }
  n.armL.rotation.x = n.angry > 0 ? -1.4 : c < 0.15 ? -0.4 * (1 - c / 0.15) : -0.15;
  if (c >= 0.6 && n.ev === 0) { n.ev = 1; n.top.rotation.z = -1.3; n.top.position.set(-0.05, 0.07, 0); }
  if (c >= 0.7 && n.ev === 1) { n.ev = 2; n.meat.visible = false; const m = new THREE.Mesh(meatGeo, meatMat);
    fly(m, worldOf(n.meat), n.bowl.clone().add(new THREE.Vector3(rnd(-0.06, 0.06), Math.min(n.bowlMeat.length, 30) * 0.002, rnd(-0.06, 0.06))), 0.35, 0.15, () => {
      n.count++; n.bowlMeat.push(m); if (n.bowlMeat.length > 25) scene.remove(n.bowlMeat.shift()!); }); }
  if (c >= 0.85 && n.ev === 2) { n.ev = 3; n.oy.visible = false; const sh = new THREE.Mesh(pick(HALF_GEOS), shellMat); fly(sh, worldOf(n.oy), pileSpot(), 0.5, 0.4, () => scene.remove(sh)); }
  if (c >= 1 && (n.basinN = (n.basinN ?? 6) - 1) <= 0) { n.basinN = 6; n.pause = 1.5; n.scoopT = 1.5; }
  if (c >= 1) { n.cyc = 0; n.ev = 0; n.dur = n.rate * NPC_DIFF_T[wpick(locW().map(w => ({ w })))] * rnd(0.9, 1.1); n.oy.visible = true; n.meat.visible = true; n.top.rotation.z = 0; n.top.position.set(0, 0.04, 0); }
}

// ---------- 主迴圈 ----------
let baseFov = 70, narrow = false, wideView = false;
/** 用畫布實際 CSS 盒徑算 buffer／相機比例（切 App 回來時 innerWidth 常短暫錯） */
function viewSize() {
  const cw = canvas.clientWidth | 0, ch = canvas.clientHeight | 0;
  if (cw > 1 && ch > 1) return { w: cw, h: ch };
  const vv = window.visualViewport;
  const w = Math.round(vv?.width || innerWidth || 1);
  const h = Math.round(vv?.height || innerHeight || 1);
  return { w: Math.max(1, w), h: Math.max(1, h) };
}
/** 水平視角 H（度）在目前比例下對應的垂直 FOV */
function vFovForH(hDeg: number, aspect = camera.aspect) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hDeg) / 2) / Math.max(0.1, aspect)));
}
/** 第三人稱 FOV：直向看廣一點，橫向逐步收窄；再壓住水平視角，免得寬螢幕兩側拉寬、看起來扁扁的 */
const TP_FOV = { walk: [68, 60, 96], plazaSit: [72, 64, 100], shedSit: [66, 58, 94] } as const;
function tpFovFor(mode: 'walk' | 'plazaSit' | 'shedSit') {
  const [vTall, vWide, hMax] = TP_FOV[mode];
  const t = Math.min(1, Math.max(0, (camera.aspect - 0.6) / (1.33 - 0.6)));
  return Math.round(Math.min(vTall + (vWide - vTall) * t, vFovForH(hMax)) * 10) / 10;
}
/** 第三人稱鏡頭距離倍率：很寬的螢幕稍微拉遠，補回收窄的視角 */
const tpDistK = () => (camera.aspect > 1.6 ? 1.05 : 1);
/** 第一人稱基準 FOV；廣場內水平視角最多 100°（工寮剝蚵維持原本） */
function updBaseFov() {
  baseFov = narrow ? 82 : 78;
  if (plazaMode) baseFov = Math.min(baseFov, vFovForH(100));
}
function resize() {
  const { w, h } = viewSize();
  // 回前景時 DPR 偶爾變；與省電上限對齊
  const dprCap = COARSE ? (mix.eco ? 1.25 : 1.5) : (mix.eco ? 1.5 : 2);
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  if (Math.abs(renderer.getPixelRatio() - dpr) > 1e-3) renderer.setPixelRatio(dpr);
  const bufW = renderer.domElement.width, bufH = renderer.domElement.height;
  const wantW = Math.max(1, Math.floor(w * dpr)), wantH = Math.max(1, Math.floor(h * dpr));
  if (bufW !== wantW || bufH !== wantH) renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  tpCam.aspect = camera.aspect;
  tpCam.updateProjectionMatrix();
  narrow = camera.aspect < 0.8;
  // 橫向寬螢幕：第三人稱眼高／注視點用（FOV 改由 tpFovFor 依比例連續計算）
  wideView = camera.aspect > 1.35;
  // 4:3 平板也用橫向 FOV，避免近鏡頭前臂過度放大
  updBaseFov();
  applyFpHandLayout();
}
/** 第一人稱手的畫面配置。camTick 每幀會重設 handRig，不可只寫在 resize。 */
function applyFpHandLayout() {
  // 近正方形橫向（iPad 4:3／3:2）：長前臂會穿過近剪裁面，投影後脹到畫面上方蓋住蚵仔縫
  const squatView = !narrow && camera.aspect <= 1.52;
  if (squatView) {
    handRig.position.set(0, -0.08, -0.20);
    handRig.scale.set(1, 1, 1);
  } else {
    handRig.position.set(0, 0, 0);
    handRig.scale.set(1, 1, 1);
  }
}
/** 切 App／旋轉後連跑兩幀，等 layout／visualViewport 穩定 */
function fixViewport() {
  resize();
  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(resize);
  });
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', () => { resize(); });
window.visualViewport?.addEventListener('scroll', () => { resize(); });
addEventListener('orientationchange', () => {
  setTimeout(fixViewport, 50);
  setTimeout(fixViewport, 280);
});
addEventListener('pageshow', () => { fixViewport(); });
resize();
const clock = new THREE.Clock(); const v = new THREE.Vector3();
let chatTimer = 2;
const warnEl = $('warn');
let pauseAt = 0;
// 只算真的畫得出來的面板（被隱藏的父層裡的 .show 不算，避免看不到的面板讓遊戲一直暫停）
const panelOpen = () => { for (const p of Array.from(document.querySelectorAll('.panel.show'))) if ((p as HTMLElement).getClientRects().length) return true; return false; };
const isPaused = () => state === 'play' && (document.hidden || panelOpen() || $('medList').classList.contains('show') || !!document.getElementById('npcTip')?.classList.contains('show'));
let frameErr = 0;
let frameSleeping = false;
let lastDrawAt = 0;
/** 手機最近一次操作時間；有輸入時維持 60fps，靜止約 1.5 秒後改 30fps */
let lastInteractAt = 0;
let mobilePtrHeld = 0;
function noteInteract(immediate = false) {
  lastInteractAt = performance.now();
  if (immediate) lastDrawAt = 0;
}
function mobileBusy(now: number) {
  if (now - lastInteractAt < 1500 || mobilePtrHeld > 0) return true;
  if (flHeld || flRet > 0 || Math.abs(flYaw) > 0.002) return true;
  if (down || holding || puffHeld || umbHeld) return true;
  if (joy.x * joy.x + joy.y * joy.y > 0.01) return true;
  for (const c of walkKeys) if (/Key[WASD]|Arrow/.test(c)) return true;
  if (walking && walkMotion.spd > 0.08) return true;
  if (jumpT > 0 || plazaCarrying() || plazaSittingBusy()) return true;
  if (Math.abs(tYaw - yaw) > 0.002 || Math.abs(tPitch - pitch) > 0.002) return true;
  // 翹殼滑桿／轉殼等短節奏：畫面需保持流暢，不能等到手指按下才升回 60
  if (phase === 'twist' || phase === 'crab' || phase === 'seam' || phase === 'scoop') return true;
  return false;
}
function scheduleFrame() {
  if (document.hidden) { frameSleeping = true; return; }
  frameSleeping = false;
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) mobilePtrHeld = 0;
  else {
    fixViewport();
    if (frameSleeping) { clock.getDelta(); lastDrawAt = 0; scheduleFrame(); }
  }
});
if (COARSE) {
  addEventListener('pointerdown', () => { mobilePtrHeld++; noteInteract(true); }, { capture: true });
  addEventListener('pointerup', () => { mobilePtrHeld = Math.max(0, mobilePtrHeld - 1); noteInteract(false); }, { capture: true });
  addEventListener('pointercancel', () => { mobilePtrHeld = Math.max(0, mobilePtrHeld - 1); noteInteract(false); }, { capture: true });
  addEventListener('pointermove', e => { if (mobilePtrHeld > 0 || e.buttons) noteInteract(false); }, { capture: true });
  addEventListener('keydown', () => noteInteract(true), { capture: true });
  addEventListener('keyup', () => noteInteract(false), { capture: true });
  addEventListener('orientationchange', () => noteInteract(true));
  addEventListener('resize', () => noteInteract(true));
  addEventListener('blur', () => { mobilePtrHeld = 0; });
}
// 主迴圈出錯也不能停：停了計時、暫停、預警都會卡住
function frame() { try { frameBody(); } catch (e) { if (frameErr++ < 3) console.error('frame', e); scheduleFrame(); } }
function frameBody() {
  if (document.hidden) {
    clock.getDelta();
    if (state === 'play' && !pauseAt) {
      pauseAt = performance.now(); holding = false; stopSteal(); closeUmbrella(); down = null; flRelease(); joy.x = joy.y = 0;
      $('pauseTag').classList.add('on');
    }
    frameSleeping = true; return;
  }
  const now = performance.now();
  const paused = isPaused();
  // 選單／暫停約 15fps；桌機遊玩 60fps。手機有操作／自身在動時 60fps，靜止 1.5 秒後 30fps 降溫
  const minMs = ((state !== 'play' && !isRoomActive()) || paused) ? 1000 / 15
    : (COARSE && !mobileBusy(now) ? 1000 / 30 : 1000 / 60);
  const since = now - lastDrawAt;
  if (since < minMs - 1.5) { scheduleFrame(); return; }
  // 餘數回扣：90Hz 等非整數倍螢幕平均仍接近 60fps
  lastDrawAt = since < minMs * 2 ? now - (since % minMs) * (since >= minMs ? 1 : 0) : now;
  if (isDeathmatchActive()) { clock.getDelta(); scheduleFrame(); return; }
  if (shedAnim.length) { const t = now / 1000; for (const f of shedAnim) f(t); }
  if (paused) {
    clock.getDelta(); if (!pauseAt) { pauseAt = now; holding = false; stopSteal(); closeUmbrella(); down = null; flRelease(); joy.x = joy.y = 0; $('pauseTag').classList.add('on'); }
    skyDome.tick(viewCam(), now / 1000);
    renderSceneWithLocalAvatarOnTop(renderer, scene, viewCam(), plazaMe?.outer); scheduleFrame(); return;
  }
  if (pauseAt) { const d = performance.now() - pauseAt; pauseAt = 0; needleStart += d; npcs.forEach(n => { if (n.gAt) n.gAt += d; }); lastMoveT += d; $('pauseTag').classList.remove('on'); clock.getDelta(); }
  const rdt = Math.min(clock.getDelta(), 0.05);
  if (plazaMode && !mix.eco && renderer.shadowMap.enabled) {
    plazaShadowAcc += rdt;
    if (plazaShadowAcc >= 0.25) {
      plazaShadowAcc = 0;
      renderer.shadowMap.needsUpdate = true;
    }
  }
  slowmo = Math.max(0, slowmo - rdt); const dt = rdt * (slowmo > 0.4 ? 0.3 : 1), t = clock.elapsedTime;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= rdt; if (timers[i].t <= 0) { const f = timers[i].f; timers.splice(i, 1); f(); } }
  flinch = Math.max(0, flinch - rdt);
  tickToast(rdt);
  tension = Math.max(0, tension - rdt * 1.6);
  if (umbHeld) { umbT = Math.max(0, umbT - rdt); if (umbT <= 0) { umbHeld = false; umbTired = true; $('umbBtn').classList.remove('held'); toast('手痠了，放開再重新撐傘', '#ffcf8a'); } } else umbT = 0; $('umbBtn').classList.toggle('cd', umbTired); { const b = $('umbBtn'), c = $('umbCd'); if (umbHeld) { const f = umbT / Math.max(0.1, umbLen); b.style.setProperty('--p', `${(f * 100).toFixed(1)}%`); c.textContent = `${umbT.toFixed(1)}s`; b.classList.toggle('low', umbT < 1.2); } else { c.textContent = ''; b.classList.remove('low'); } }
  tickPuffUi(rdt);
  const us = umbT > 0 ? Math.min(1, umbAge() / Math.max(0.1, umbNow().open + 0.05), umbT * 6) : 0; umbS = us; umb.visible = us > 0; umb.scale.setScalar(0.3 + 0.7 * us); umb.rotation.z = Math.sin(t * 20) * 0.05 * us;
  let warnNpc: Npc | null = null;
  if (state === 'play') {
    // 廣場休閒：不倒數、不自動收工
    if (!tut && !plazaMode && !roomPlay && !isRoomActive()) { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; endDay(); } }
    if (isRoomActive()) roomTick(rdt);
    if (roomPlay) roomSyncScore();
    hp = Math.min(100, hp + dt / 6 * medM('regen')); tickMeds(dt);
    if (phase === 'seam') {
      rotTipTick(rdt); if (rotKey) rotTipTouch(); rot += rotKey * rdt * 2.5; oyster.rotation.y = rot;
      const e = Math.abs(seamErr()), d = DIFF[diff], close = clamp(1 - e / (tolNow() * 3), 0, 1);
      (seamGlow.material as THREE.MeshBasicMaterial).opacity = gearOn('glasses') ? Math.min(1, 0.5 + 0.06 * Math.sin(performance.now() * 0.0042) + clamp(1 - e / (tolNow() * 5), 0, 1) * 0.5) : 0.24 + 0.06 * Math.sin(performance.now() * 0.0042) + close * 0.4;
      { const inZ = e < tolNow(), gl = gearOn('glasses') ? 1.6 : 1, gm = seamGlow.material as THREE.MeshBasicMaterial;
        if (inZ && !sweet) { sweetT = 0.25; navigator.vibrate?.(15); tone(1400, 0.05, 0.12, 'triangle', 0, 2100); }
        sweet = inZ; sweetT = Math.max(0, sweetT - rdt); const snap = sweetT / 0.25;
        gm.color.set(inZ ? 0xd8ff80 : 0xffc878); if (inZ) gm.opacity = gearOn('glasses') ? 1 : 0.8;
        seamGlow.scale.setScalar(gl * (inZ ? 1.5 + snap * 0.6 : 1));
        seamRing.visible = inZ && seamMark.visible; seamRing.scale.setScalar(1 + snap * 0.8); (seamRing.material as THREE.MeshBasicMaterial).opacity = 0.85 - snap * 0.4; syncSeamOnTop(viewCam()); }
      const tk = Math.floor(rot / 0.25); if (tk !== lastTick) { lastTick = tk; tone(1800 + close * 1200, 0.025, 0.03 + close * 0.08, 'square'); }
      knife.position.y = 0.03 + (e < tolNow() * 1.5 ? Math.sin(t * 50) * 0.004 : 0);
    } else if (phase !== 'twist') knife.position.y = 0.03;
    if (phase === 'twist') { if (SHOT === 'pry') needleStart = performance.now() - (PRY_C / 2) / prySp() * 1000; const n = needle(), w = pryW(); zone.style.left = `${(PRY_C - w / 2) * 100}%`; zone.style.width = `${w * 100}%`; fill.style.width = '28px'; fill.style.marginLeft = `calc(${n * 100}% - 14px)`; fill.style.background = 'transparent'; fill.style.color = n > PRY_RED ? '#ff5a4a' : Math.abs(n - PRY_C) <= w / 2 ? '#d8ffb0' : '#fff4dc'; setInZ(n <= PRY_RED && Math.abs(n - PRY_C) <= w / 2 ? 'z' : ''); }
    if (phase === 'twist' || phase === 'crab') { ($('progFill') as HTMLElement).style.width = `${(phase === 'crab' ? crabShakes / 6 : progress) * 100}%`; }
    if (phase === 'crab') hp = Math.max(1, hp - dt * 2);
    if (evRun?.infHp) hp = 100;
    updBlood(rdt);
    if (phase === 'scoop') { scoopT -= rdt; on('prog', true); ($('progFill') as HTMLElement).style.width = `${(1 - scoopT / scoopDur) * 100}%`; if (scoopT <= 0) { fillBasin(true); on('prog', false); later(0.6, goPick); setPhase('busy'); } }
    tickFx(rdt); if (phase === 'aim' && tapAim && down?.drag) tossT0 = performance.now() - 600; // 拖畫面找阿婆時先不自動入碗
    if (phase === 'aim' && tapAim && !tutMeat() && performance.now() - tossT0 > 2000) toss(false);
    if (phase === 'empty' && !(tut && (TUT[tut.i].id === 'empty' || TUT[tut.i].id === 'shell'))) { emptyT -= rdt; if (emptyT <= 0) discardShell(); }
    if (phase !== 'twist') setInZ('');
    // 偷蚵仔
    on('standBtn', !walking && (!plazaMode || plazaSeated()) && (!isRoomActive() || roomSeated()));
    // 吸菸區／樸子腳坐著：不剝蚵，藏左下臉盆與肉碗
    if (plazaMode && seatRig.visible && document.body.classList.contains('plazaSmokeSit')) setPlazaSeatPropsVisible(false);
    if (smokeSitActive) {
      // 第三人稱時藏手持菸；第一人稱顯示
      handRig.visible = !tpv;
      if (fpCig) {
        fpCig.group.visible = !tpv;
        if (!tpv) fpCig.tick(performance.now() * 0.001, rdt);
      }
    }
    // 電腦廣場隱藏視角鈕（用 V）；手機仍顯示
    on('camBtn', !(plazaMode || isRoomActive()) || COARSE);
    if (walking && !walkHintShown && npcs.some(n => (n.grudge ?? 0) > 5)) { walkHintShown = true; toast('起來走走，阿婆氣消得比較快', '#9be37a'); }
    if (plazaMode) {
      const banned = performance.now() < plazaStealBanUntil;
      // 同工寮：按鈕只在瞄到碗／讀條中出現
      const aim = walking || !plazaSeated() || banned ? null : plazaStealAimTarget();
      on('stealBtn', !!aim || !!plazaStealTgt);
      if (banned && !walking && plazaSeated() && phase !== 'busy') {
        hint.textContent = `偷被抓太多次，${Math.ceil((plazaStealBanUntil - performance.now()) / 1000)} 秒後才能再偷`;
      } else if (aim && !plazaStealTgt && phase !== 'busy') {
        // 提示句式對齊工寮（在看／可偷）
        const why = plazaStealCanTarget(aim);
        hint.textContent = plazaWatchingMe(aim)
          ? `${aim.nick}在看，不要偷…`
          : why
            ? `${aim.nick}：${why}`
            : `${aim.nick}沒注意！${COARSE ? '按住「偷」' : '按住 E／「偷」'}偷對方的肉`;
      }
      if (plazaStealTgt) {
        const live = plazaAimTargets().find(t => t.connId === plazaStealTgt!.connId);
        const bx = live?.bowl.x ?? plazaStealTgt.bowl.x;
        const by = live?.bowl.y ?? plazaStealTgt.bowl.y;
        const bz = live?.bowl.z ?? plazaStealTgt.bowl.z;
        const stillAim = bowlOnReticle(bx, by, bz, 0.18, 2.0);
        const why = live ? plazaStealCanTarget(live) : '對方離開了';
        const watch = plazaWatchingMe(live ?? plazaStealTgt);
        if (!stillAim || watch || why) {
          const t = plazaStealTgt; stopPlazaSteal();
          if (watch) {
            plazaOnStealCaught(t.nick);
            void plazaStealFrom(t.connId, true);
          } else if (why) toast(why, '#ffb08a');
        } else {
          if (live) plazaStealTgt = live;
          const plazaHold = stealHoldSeconds(fxAll(), 'plaza');
          stealT += dt; on('prog', true); ($('progFill') as HTMLElement).style.width = `${stealT / plazaHold * 100}%`;
          if (stealT >= plazaHold) { const t = plazaStealTgt; stealT = 0; void finishPlazaSteal(t); }
        }
      }
    } else {
    const tgt = walking || evRun?.steal === 'no_steal' ? null : stealTarget(); on('stealBtn', !!tgt); if (!tgt) stopSteal();
    if (tgt && !stealNpc && phase !== 'busy') hint.textContent = tgt.distract > 0 ? `${tgt.name}轉頭在聊天！${COARSE ? '按住「偷」' : '按住 E／「偷」'}偷對方的肉` : `${tgt.name}在看，不要偷…`;
    if (stealNpc) { if (!freeToSteal(stealNpc)) caughtBy(stealNpc); else { const yardHold = stealHoldSeconds(fxAll(), 'yard'); stealT += dt; on('prog', true); ($('progFill') as HTMLElement).style.width = `${stealT / yardHold * 100}%`; if (stealT >= yardHold) { stealT = 0; stealOne(stealNpc); } } }
    }
    updReticle();
    if (!plazaMode) {
    chatTimer -= dt * seatNow().nag; if (chatTimer <= 0) { chatTimer = 3 + Math.random() * 4; const n = pick(npcs);
      if (n && n.bubT <= 0 && n.windup <= 0) { if (n.mood > 0) say(n, pick(GRUDGE)); else if (Math.random() < 0.5) { n.distract = rnd(3, 5.5) * seatNow().steal; n.turnDir = Math.random() < 0.5 ? -1 : 1; say(n, pick(TURN_CHAT), n.distract); } else { say(n, pick(GOSSIP)); if (Math.random() < n.chatty) n.pause = 2.5; } } }
    for (const n of npcs) {
      n.distract -= dt; n.angry -= dt; n.mood -= dt;
      npcShuck(n, dt, t);
      n.grudge = Math.max(0, (n.grudge ?? 0) - (walking ? (performance.now() - (n.gAt ?? 0) > 2000 ? dt * 7.5 : 0) : performance.now() - (n.gAt ?? 0) > 8000 ? dt * 2.5 : 0) * (newbie() && !evRun ? 2 : 1)); n.calm = Math.max(0, (n.calm ?? 0) - dt); grudgeUI(n);
      if (n === npcs[0] && slOn('sl_89') && !tut && (scaredT -= dt) <= 0) { scaredT = rnd(8, 15); const m = pick(npcs); if (m.bubT <= 0) say(m, pick(SCARED)); }
      n.throwCd -= dt * (evRun ? Math.max(1, seatNow().throwM) * Math.max(1, locNow().thr) : seatNow().throwM * locNow().thr) * (n.calm! > 0 && !evRun ? 0.3 : (1 + n.grudge! / 25) * (n.mood > 0 ? 2 : 1) * 1) * (evRun?.throwX ?? 1); if (n.throwCd <= 0) { n.throwCd = rnd(20, 40); if (!tut && !(newbie() && !evRun && !((n.grudge ?? 0) > 0)) && !(Math.random() > fxAll().throw)) windUp(n); }
      if (n.windup > 0) { warnNpc = n; n.windup -= rdt; if (!n.warned && n.windup <= warnLead(n)) { n.warned = true; SFX.alert(); } if (n.windup <= 0) npcThrow(n); }
      if (n.peek && n.look <= 0 && n.distract <= 0 && Math.random() < dt * 0.05) { n.look = 2.5; say(n, pick(PEEK), 2.5); }
    }
    }
    updHud();
  }
  if (plazaMode) plazaSetSelfBody(walking ? lastPose : '', walking ? poseK : 0, walking ? jumpY : 0);
  tickPlaza(rdt);
  const pw = plazaWarnTick(rdt);
  // ⚠ 方向提示
  if (warnNpc && !warnNpc.warned) warnNpc = null;
  if (warnNpc || pw) {
    if (pw) _warnRel.set(pw.e.fromX, pw.e.fromY, pw.e.fromZ).sub(camera.position);
    else _warnRel.copy(warnNpc!.g.position).sub(camera.position);
    camera.getWorldDirection(_warnFwd);
    let a = Math.atan2(_warnRel.x, _warnRel.z) - Math.atan2(_warnFwd.x, _warnFwd.z);
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const wLeft = `${clamp(50 - a / 1.2 * 45, 6, 94)}%`;
    const wOp = (0.6 + 0.4 * Math.sin(t * 14)).toFixed(2);
    const wTxt = a > 0.5 ? '⚠◀' : a < -0.5 ? '▶⚠' : '⚠';
    if (!warnEl.classList.contains('on')) warnEl.classList.add('on');
    if (warnEl.style.left !== wLeft) warnEl.style.left = wLeft;
    if (warnEl.style.opacity !== wOp) warnEl.style.opacity = wOp;
    if (warnEl.textContent !== wTxt) warnEl.textContent = wTxt;
    hint.textContent = `${pw ? (pw.e.fromNick || '有人') : warnNpc!.name}要丟殼過來了！快${COARSE ? '按住「雨傘」' : '按住 R／「雨傘」'}！`;
  } else if (warnEl.classList.contains('on')) warnEl.classList.remove('on');
  for (const n of npcs) {
    n.look -= dt; n.bubT -= rdt;
    if (n.bubT <= 0 && n.bubble.sprite.visible) { n.bubble.setOpacity(0); n.bubble.sprite.visible = false; }
    const stand = n.angry > 0 || n.windup > 0 ? 1 : 0; n.baseY += (stand * 0.18 - n.baseY) * Math.min(1, rdt * 6); n.g.position.y = n.baseY;
    const tgtY = n.look > 0 || stand ? Math.atan2(camera.position.x - n.g.position.x, camera.position.z - n.g.position.z) - n.g.rotation.y : 0;
    const want = n.look > 0 || stand ? 1 : 0;
    n.lean += (want - n.lean) * Math.min(1, rdt * 4);
    n.head.rotation.set(n.pause > 0 ? -0.15 : 0.35 - n.lean * 0.3, 0, 0); n.body.rotation.x = n.lean * 0.15;
    const face = THREE.MathUtils.lerp(0, Math.atan2(Math.sin(tgtY + Math.PI), Math.cos(tgtY + Math.PI)), n.lean);
    n.head.rotation.y = n.distract > 0 && !stand ? n.turnDir * 1.3 : face;
    const g = n.grudge ?? 0;
    const tagTxt = n.name + (g >= 60 ? ' 😡' : g >= 25 ? ' 😠' : '');
    if (n.tagTxt !== tagTxt) { n.tagTxt = tagTxt; n.tag.setText(tagTxt); }
    const showTag = !tut && n.g.visible && !n.g.userData.moon;
    n.tag.sprite.visible = showTag;
    if (showTag) {
      n.head.getWorldPosition(_tagHit); _tagHit.y += 0.28;
      n.tag.sprite.position.copy(_tagHit);
    }
    if (n.bubble.sprite.visible) {
      n.head.getWorldPosition(_tagHit); _tagHit.y += 0.48;
      n.bubble.sprite.position.copy(_tagHit);
    }
  }
  boats.forEach((b, i) => { b.position.y = -0.45 + Math.sin(t * 0.8 + i) * 0.05; b.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.03; });
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.t += dt / f.dur; const k = Math.min(1, f.t);
    const p1 = typeof f.p1 === 'function' ? f.p1() : f.p1;
    if (!p1 || !Number.isFinite(p1.x + p1.y + p1.z) || !Number.isFinite(f.p0.x + f.p0.y + f.p0.z)) {
      flyers.splice(i, 1); try { scene.remove(f.m); } catch { /* */ } continue;
    }
    f.m.position.lerpVectors(f.p0, p1, k); f.m.position.y += Math.sin(k * Math.PI) * f.h;
    if (k < 1) f.m.rotation.x += dt * 8;
    else { flyers.splice(i, 1); try { f.end?.(); } catch (err) { if (frameErr < 3) console.error('flyer end', err); } }
  }
  pearlShow = Math.max(0, pearlShow - rdt);
  const pe = pearlShow > 0 ? Math.min(1, pearlShow * 2, (2.6 - pearlShow) * 4) : 0;
  if (pearlShow <= 0) label.classList.remove('on');
  (shimmer.material as THREE.MeshBasicMaterial).opacity = phase === 'twist' && find.kind === 'pearl' ? 0.2 + Math.sin(t * 8) * 0.1 : pe * 0.25;
  pearlMesh.rotation.y += rdt * 2;
  oyster.scale.setScalar(DIFF[diff].scale * (1 + pe * (narrow ? 0.25 : 0.6)));
  handL.position.set(HL.x + (narrow ? 0.12 : 0.05) * pe, HL.y + 0.06 * pe, HL.z);
  const restX = 0.75 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect + 0.3; // 平常囥佇畫面外
  leanFaces.forEach(f => { f.visible = pe > 0.02; f.position.x = f.userData.s * (restX + ((narrow ? 0.4 : 0.58) - restX) * pe); f.position.y = 0.05 - 0.08 * pe; f.rotation.z = -f.userData.s * 0.35 * pe; });
  // 手勢
  const tw = phase === 'twist' ? strokeDir * Math.min(1, tension) : 0;
  handR.position.y = -0.26; handR.rotation.z = -0.2 + tw * 0.4; handR.rotation.y = 0.5 + tw * 0.2; handR.position.x = 0.2 - (phase === 'twist' || phase === 'seam' ? 0.07 : 0);
  if (phase === 'crab') handL.position.x += Math.sin(t * 30) * 0.02;
  reach = Math.max(0, reach - rdt); const rk = Math.sin(Math.min(1, reach / 0.35) * Math.PI); handL.position.z -= rk * 0.18; handL.position.y -= rk * 0.12;
  if (phase === 'scoop') { const sk = Math.sin(t * 6); handL.position.z -= 0.2 + sk * 0.05; handR.position.z = -0.6 + sk * 0.05; handL.position.y += 0.05; } else handR.position.z = -0.45;
  applySmokeSitFpHands();
  // 找縫／撬殼：右手把刀尖帶到左手蚵仔的殼縫上（平滑靠近）
  { const want = !plazaOnGrill() && (phase === 'seam' || phase === 'twist') && oyster.visible ? 1 : 0; knifeK += (want - knifeK) * Math.min(1, rdt * 8);
    if (plazaOnGrill()) { knife.visible = false; knifeK = 0; }
    if (knifeK > 0.01) { handRig.updateMatrixWorld(true); const tip = knife.localToWorld(_kt.set(-0.15, 0, 0)), goal = handL.localToWorld(_kg.copy(oyster.position).add(_ko));
      handRig.worldToLocal(tip); handRig.worldToLocal(goal); handR.position.addScaledVector(goal.sub(tip), knifeK); }
    // 撬殼綠區／找縫對準：右手＋刀明顯顫動（刀尖鎖定後再抖，才看得到）
    const pryReady = phase === 'twist' && (() => { const n = needle(), half = pryW() / 2; return n <= PRY_RED && Math.abs(n - PRY_C) <= half; })();
    const seamReady = phase === 'seam' && Math.abs(seamErr()) < tolNow();
    if (pryReady || seamReady) {
      const jx = Math.sin(t * 55) * 0.0022, jy = Math.cos(t * 63) * 0.0018;
      handR.position.x += jx; handR.position.y += jy;
      handR.rotation.z += Math.sin(t * 50) * 0.012;
      knife.position.set(-0.02, 0.03 + Math.sin(t * 50) * 0.003, -0.18);
      knife.rotation.set(0, 0.9, Math.sin(t * 48) * 0.015);
    } else {
      knife.position.set(-0.02, 0.03, -0.18);
      knife.rotation.set(0, 0.9, 0);
    }
  }
  const ch = holding && phase === 'aim' ? Math.min(1, hold) : 0;
  if (!(smokeSitActive && !tpv)) {
    if (phase === 'aim' || ch) { handL.position.y += 0.05 + ch * 0.06; handL.position.z -= ch * 0.05; handL.rotation.x = 0.4 - ch * 0.5; } else handL.rotation.x = 0.4;
    if (flinch > 0) { handL.position.y -= flinch * 0.1; handL.rotation.z = 0.3 + flinch * 0.8; } else handL.rotation.z = 0.3;
  } else {
    applySmokeSitFpHands();
  }
  if (!swipePhase()) { yaw = tYaw; pitch = tPitch; }
  flTick(rdt);
  // 廣場坐下：TP 鎖 0；FP 夾在 ±90°
  if (plazaMode && !walking) yaw = tYaw = clamp(yaw, -yl(), yl());
  moonTick(rdt);
  petTick(rdt);
  shake = Math.max(0, shake - rdt);
  if (walking && bodyPose !== 'lie') walkStep(rdt); else if (walking) { walkMotion.spd = walkMotion.strafe = 0; } else { walkMotion.spd = walkMotion.strafe = 0; }
  let camPitch = pitch - pe * 0.08 + (smokeSitActive && !tpv ? puffCamPitch : 0), camRoll = 0;
  camera.position.copy(walking ? walkPos : SEAT);
  if (jumpY > 0) camera.position.y += jumpY;
  if (poseK > 0.001) camera.position.y -= poseK * (bodyPose === 'lie' || lastPose === 'lie' ? 1.2 : 0.55);
if (poseK > 0.001 && lastPose === 'lie' && plazaMode && walking && !tpv) camPitch = camPitch * (1 - poseK) + 1.35 * poseK;
  // 廣場第一人稱走路：死鬥同款頭晃（上下／側移／輕 roll）
  if (plazaMode && walking && !tpv) {
    const walkRef = 2.4;
    const tgt = walkMotion.spd > 0.4 ? Math.min(0.75, walkMotion.spd / walkRef) : 0;
    walkMotion.bobW += (tgt - walkMotion.bobW) * (1 - Math.exp(-(tgt > walkMotion.bobW ? 14 : 10) * rdt));
    if (walkMotion.spd > 0.4) walkMotion.bobPh += rdt * Math.min(walkMotion.spd, 4.5) * (Math.PI / 0.85);
    const w = walkMotion.bobW * walkMotion.bobW, sy = Math.sin(walkMotion.bobPh), cy = Math.cos(walkMotion.bobPh);
    const ox = cy * 0.012 * w, oy = sy * 0.02 * w, oz = -Math.abs(sy) * 0.005 * w;
    const rs = Math.sin(yaw), rc = Math.cos(yaw);
    camera.position.x += rc * ox - rs * oz; camera.position.y += oy; camera.position.z += -rs * ox - rc * oz;
    camPitch += cy * 0.005 * w;
    camRoll = sy * 0.007 * w + Math.max(-1, Math.min(1, walkMotion.strafe / walkRef)) * 0.018 * Math.min(1, walkMotion.bobW + 0.2);
  } else if (!walking) { walkMotion.bobW = 0; walkMotion.bobPh = 0; }
  camera.rotation.set(camPitch, yaw + flYaw + (walking ? 0 : seatYaw), camRoll);
  camera.updateMatrixWorld(); camTick(dt); umbArm(); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(shake * 0.03));
  camera.fov = baseFov - pe * (narrow ? 10 : 22); camera.updateProjectionMatrix();
  // 廣場關掉工寮中央點光（棚頂吊燈／環境光夠）；工寮內省電再壓亮度
  lamp.intensity = plazaMode
    ? 0
    : (mix.eco ? 18 : 26) + Math.sin(t * 1.3) * (mix.eco ? 0.5 : 1.0);
  skyDome.tick(viewCam(), t);
  renderSceneWithLocalAvatarOnTop(renderer, scene, viewCam(), plazaMe?.outer);
  scheduleFrame();
}
function plazaGuidePending() {
  return !!(save.plazaGuideSeen && !save.plazaVisited);
}
function markPlazaVisited() {
  if (save.plazaVisited) { syncPlazaGuideHint(); return; }
  save.plazaVisited = 1;
  persist();
  syncPlazaGuideHint();
}
function syncPlazaGuideHint() {
  const on = plazaGuidePending();
  document.body.classList.toggle('plazaGuideHint', on);
  const card = document.querySelector('.locPlaza');
  if (card) card.classList.toggle('plazaHint', on);
  const start = $('start');
  if (start) start.classList.toggle('plazaHint', on && isPlazaPicked());
}
function showPlazaGuide() {
  if (document.getElementById('plazaGuide')) return;
  save.plazaGuideSeen = 1;
  persist();
  const m = document.createElement('div');
  m.id = 'plazaGuide';
  m.className = 'giftMsg';
  m.innerHTML = `<div class="rdGot gmBox"><button class="gmX" type="button" aria-label="關閉"></button><b><i class="ic ic-pin"></i> 去廣場看看</b><p class="nmTx">廣場有其他玩家，可以插旗、接送座位任務，要去看看嗎？</p><div class="mbtns"><button class="gmNo" type="button">之後再說</button><button class="gmYes gmPri" type="button">前往廣場</button></div></div>`;
  const close = (go: boolean) => {
    m.remove();
    if (go) {
      save.loc = 'plaza';
      persist();
      renderLocs();
      syncStartUi();
      launchPlaza();
      return;
    }
    syncPlazaGuideHint();
    const card = document.querySelector('.locPlaza');
    card?.scrollIntoView({ block: 'nearest', inline: 'center' });
    setTimeout(() => { giftAlert(); svAlert(); featAnnounce(); newAnnounce(); }, 300);
  };
  m.querySelectorAll('.gmX,.gmNo').forEach(b => b.addEventListener('click', () => close(false)));
  m.querySelector('.gmYes')!.addEventListener('click', () => close(true));
  document.body.appendChild(m);
}
function maybePlazaGuide(first: boolean) {
  if (!first || save.plazaVisited || save.plazaSpawn || save.plazaGuideSeen) return;
  showPlazaGuide();
}

// ---------- 新手教學 ----------
initTutorial({
  $, on, COARSE, audio, getSave: () => save, persist, track, toast, startDay, syncShiftUi, renderLocs, renderDaily,
  setPhase, getPhase: () => phase, getState: () => state, setState: s => { state = s; },
  oyster, closeUmbrella, stopSteal,
  getWalking: () => walking, setWalking, clearWalkHud: () => { on('seatCard', false); on('joy', false); },
  handRig, stools, sitDown, standUp, discardShell, goPick, holdOyster,
  setProgress: v => { progress = v; }, setCrackedNow: v => { crackedNow = v; },
  seamGlow, seamRing, seamMark, shellTop, meatInHand, meatMat,
  setMeatsLeft: v => { meatsLeft = v; }, showExtra, setFind: v => { find = v as any; }, setEmptyT: v => { emptyT = v; },
  later, getMissed: () => missed, getCount: () => count, getThrown: () => thrown, getSteals: () => steals,
  getMeatHits: () => meatHits, getShellsOut: () => shellsOut, getUmbT: () => umbT,
  getNpcs: () => npcs, windUp, giftAlert, svAlert, featAnnounce, newAnnounce,
  returnToMainMenu,
  afterTutEnd: first => { maybePlazaGuide(first); },
});

$('oTut').onclick = () => { const run = () => enterWorkShed(() => tutStart()); if (!save.tutDone) ensureNameThen(run); else run(); };
let roomYardHidden = false;
function hideRoomYardExtras(hide: boolean) {
  roomYardHidden = hide;
  stools.forEach(g => {
    g.visible = !hide;
    if (g.userData.tag) g.userData.tag.visible = !hide;
  });
  ALL_NPCS.forEach(n => {
    n.g.visible = !hide;
    n.tag.sprite.visible = !hide;
    n.bubble.sprite.visible = false;
    if (hide) { n.windup = 0; n.throwCd = 999; }
  });
  if (hide) npcs.length = 0;
}
function enterRoomWalk(fromSeat: boolean) {
  oyster.visible = false; progress = 0; combo = 0; tension = 0; shellTop.rotation.z = 0; rotKey = 0; stopSteal(); setPhase('busy');
  setWalking(true); handRig.visible = false; setPlazaSeatPropsVisible(false);
  if (fromSeat) {
    walkPos.copy(SEAT).setY(1.55);
    walkPos.x += Math.sin(seatYaw) * 0.55;
    walkPos.z += Math.cos(seatYaw) * 0.55;
    tYaw = yaw = seatYaw;
  } else {
    walkPos.set(0, 1.55, 3.1);
    tYaw = yaw = 0;
  }
  tPitch = pitch = -0.2;
  $('diff').textContent = '';
  on('standBtn', false); on('umbBtn', false); on('medBtn', false); on('stealBtn', false); on('joy', true); on('camBtn', COARSE); on('seatCard', false); on('quitBtn', false);
  if (COARSE) { const cam = $('camBtn'); if (cam) { cam.classList.add('on'); cam.style.display = ''; } }
  hint.textContent = COARSE ? '好友房走走・靠近空位按「坐這裡」，也可抱起鄰居' : 'WASD 走動・E／「坐這裡」坐下・Space 跳躍・C 蹲下・Z 躺下';
}
bindRoom({
  id: statsId,
  nick: () => myName(),
  toast: (t, c) => toast(t, c),
  audio: () => audio(),
  canEnter: () => state === 'menu' && !tut && !isPlazaActive() && !isDeathmatchActive() && !isRoomActive(),
  getScene: () => scene,
  hideYardExtras: hideRoomYardExtras,
  enterWalk: () => {
    evRun = null;
    state = 'play';
    syncShiftUi();
    hideRoomYardExtras(true);
    enterRoomWalk(false);
    $('overlay').classList.remove('show');
    updHud();
  },
  applySeatPose: (x, z, seatY) => {
    applyPlazaSeatPose(new THREE.Vector3(x, 0, z), seatY);
    setWalking(false); setNearSeat(null); on('seatCard', false); on('joy', false); clearWalkInput();
    setPlazaSeatPropsVisible(true);
    handRig.visible = true; tYaw = yaw = 0; tPitch = pitch = -0.42;
    on('standBtn', true); on('umbBtn', roomPlay); on('medBtn', roomPlay);
    if (roomPlay) later(0.3, goPick);
    toast('坐下了', '#9fe0ff'); SFX.pop();
  },
  afterStand: () => enterRoomWalk(true),
  getWalkXZ: () => (walking ? { x: walkPos.x, z: walkPos.z } : { x: SEAT.x, z: SEAT.z }),
  getYaw: () => (!walking ? seatYaw : (bodyPose === 'lie' ? bodyYaw : yaw)),
  getLookYaw: () => (walking || tpv ? 0 : yaw),
  getPitch: () => (tpv ? 0 : pitch),
  getPhase: () => jumpT > 0 ? 'jump' : bodyPose && walking ? bodyPose : phase,
  getMoving: () => {
    if (!walking) return false;
    if (joy.x * joy.x + joy.y * joy.y > 0.04) return true;
    for (const c of walkKeys) if (/Key[WASD]|Arrow/.test(c)) return true;
    return false;
  },
  getUmb: () => umbHeld || umbT > 0,
  getOutfit: () => ({
    head: equipNow('head').id,
    hand: equipNow('hand').id,
    body: equipNow('body').id,
    legs: equipNow('legs').id,
    feet: equipNow('feet').id,
  }),
  getCosmetics: () => encodeCosmetics({
    goldSmoke: gearOn('goldPipe'),
    cushion: gearOn('seatCush'),
    nameFrame: gearOn('nameFrame'),
    pet: petNow()?.id ?? '',
  }),
  isWalking: () => walking,
  enterScene: (scene, then) => {
    roomLoc = scene; updSky();
    enterWorkShed(() => { state = 'menu'; syncShiftUi(); then(); });
  },
  applyScene: (scene) => {
    if (roomLoc !== scene) { roomLoc = scene; updSky(); }
    if (roomYardHidden) hideRoomYardExtras(true);
  },
  startPlay: () => {
    if (roomPlay) return;
    roomPlay = true; evRun = null; shiftLen = 24 * 3600;
    $('result').classList.remove('show');
    startDay();
    on('quitBtn', false);
    if (walking) { on('umbBtn', false); on('medBtn', false); }
  },
  finishPlay: () => {
    if (state === 'play') { endReason = 'time'; endDay(); }
    return { earn: Math.max(0, lastPay.earn), count, durSec: Math.max(1, Math.round(shiftLen - Math.max(0, timeLeft))) };
  },
  getCount: () => count,
  getEarn: () => Math.max(0, meatPay + perfects * eco.perfectPay + bowlBonus - penalty),
  grantPayout: (n) => {
    const v = Math.max(0, Math.floor(n));
    lastPay.earn = v;
    if (v > 0) { save.money += v; persist(); }
    track('room_reward', { amount: v, money: save.money });
    toast(`好友房結算 +$${v}（身上 $${save.money}）`, '#9be37a');
  },
  leaveScene: () => {
    const wasPlay = roomPlay;
    if (wasPlay && state === 'play') { endReason = 'quit'; endDay(); }
    $('result').classList.remove('show');
    roomPlay = false;
    hideRoomYardExtras(false);
    returnToMainMenu(() => { roomLoc = null; shiftLen = SHIFT; updSky(); applyCrew(); applySeat(save.seat ?? 'door'); });
  },
});
$('oRank').onclick = () => Social.open(); $('rRank').onclick = () => Social.open();
Social.init({ id: statsId, test: __PREVIEW__ || params.get('stattest') === '1', LS, nick: () => myName(), setNick: v => { const c = cleanName(v); save.name = c === '剝蚵人' ? undefined : c; persist(); drawName(); }, inTut: () => !!tut || !!SHOT, on: () => mix.feed && !SHOT, toast: t => toast(t, '#f2b705'),
  label: (k, i) => k === 'pearl' ? `剝到了${RAR[i]?.name ?? '珍珠'}！` : k === 'legend' ? `挖到傳說的「${ODD[i]?.name ?? '寶物'}」！` : k === 'odd' ? `開到「${ODD[i]?.name ?? '奇物'}」` : k === 'ach' ? `達成金牌成就「${ACHS[i]?.n ?? '成就'}」！` : `解鎖了新地點 ${(LOCS[i]?.n ?? '').replace(/^\S+\s/, '')}！`, title: () => achTitle(), foil: () => gearOn('nameFrame') });
Social.startPresence(() => state === 'play');
void Social.maybeAnnounceFirstPlay(() => !save.tutDone && (save.days ?? 0) < 1 && !SHOT);
$('tutReplay').onclick = () => { $('settings').classList.remove('show'); if (state === 'play' && !tut && !confirm('這一班會放棄，確定要重看教學嗎？')) return; if (state === 'play' && !tut) { state = 'menu'; syncShiftUi(); } const run = () => enterWorkShed(() => tutStart()); if (!save.tutDone) ensureNameThen(run); else run(); };
(window as any).__oy = { get phase() { return phase; }, get umb() { return { held: umbHeld, t: umbT, vis: umb.visible }; }, get tut() { return tut && TUT[tut.i].id; }, get npcN() { return npcs.length; }, needle: () => needle(), get pryW() { return pryW(); }, PRY_C, get hold() { return hold; }, PERF0, PERF1, seamErr: () => seamErr(), get walking() { return walking; }, get money() { return save.money; }, get state() { return state; }, bowlScr: () => { const v = BOWL.clone().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, nudge: (a: number, b: number) => { tYaw = clamp(tYaw + a, -yl(), yl()); tPitch = clamp(tPitch + b, pitchLo(), pitchHi()); }, basinScr: () => { const m = basinOy[0]; if (!m) return null; const v = worldOf(m).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, aimScr: () => { const v = aimPoint().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } };
// ---------- 截圖模式 ----------
if (SHOT) setTimeout(() => {
  startDay(); npcs.forEach((n, i) => { n.count = 5 + i * 3; n.throwCd = 999; });
  const look = (y: number, p: number) => { tYaw = yaw = y; tPitch = pitch = p; };
  const twistSetup = () => { diff = 2; setPhase('twist'); seamGlow.visible = false; progress = 0.6; tension = 0.5; strokeDir = 1; shellTop.rotation.z = -0.25; };
  if (SHOT === 'blood' || SHOT === 'aid') { if (SHOT === 'aid') mix.gore = false; later(0.3, () => { flinch = 0.6; bleed(16); hurt(15, '割到手了！'); }); }
  if (SHOT === 'npcblood' || SHOT === 'npcaid') { if (SHOT === 'npcaid') mix.gore = false; const n = npcs[0]; look(Math.atan2(-(worldOf(n.head).x - camera.position.x), -(worldOf(n.head).z - camera.position.z)), -0.2); later(0.2, () => npcHurt(n)); }
  if (SHOT === 'grudge') { look(0.15, -0.25); [30, 65, 100].forEach((g, i) => { npcs[i].grudge = g; grudgeUI(npcs[i]); }); npcs[2].angry = 99; say(npcs[2], '看我連環殼！', 99); }
  if (SHOT === 'reflect') { const n = npcs[2]; look(0.6, -0.3); n.windup = 0.25; later(0.62, () => { umbT = umbLen = 0.9; umb.visible = true; }); }
  if (SHOT === 'shop') { save.money = 600; save.shop.owned = ['basic', 'seam']; save.shop.equipped.knife = 'seam'; applyKnife(); openShopPx(); renderShop(); $('shop').classList.add('show'); }
  if (SHOT === 'bowl') { save.shop.equipped.bowl = params.get('b') || 'steel'; applyBowl(); look(0.35, -0.75); }
  if (SHOT === 'seat') { applySeat(params.get('s') || 'corner'); goPick(); }
  if (SHOT === 'walk') { later(0.1, () => { standUp(); walkPos.set(-1.1, 1.55, -2.35); tYaw = yaw = 3.09; tPitch = pitch = -0.5; }); }
  if (SHOT === 'dex') { renderDex(); $('dex').classList.add('show'); }
  if (SHOT === 'sleeves') { save.money = 20000; const sid = params.get('s') || 'sl_dragon'; for (const id of ['sl_flower', sid, 'hd_crown', 'bd_vest', 'ft_gold']) save.shop.owned.push(id); setEquip('hand', sid); if (params.get('set')) { setEquip('head', 'hd_crown'); setEquip('body', 'bd_vest'); setEquip('feet', 'ft_gold'); } applySleeve(); { const of = params.get('outfit'); if (of) { for (const id of of.split(',')) { const e = EQUIP.find(q => q.id === id); if (e) { save.shop.owned.push(id); setEquip(e.slot, id); } } applySleeve(); } } if (params.get('p') === 'shop') {
      const ctab = params.get('ctab');
      if (ctab === 'head' || ctab === 'hand' || ctab === 'body' || ctab === 'legs' || ctab === 'feet') clothTab = ctab;
      renderShop();
      const gs = Array.from(document.querySelectorAll<HTMLElement>('#shopList .stab'));
      const i = gs.findIndex(g => g.querySelector('.slGrid'));
      if (i >= 0) {
        shopTab = i;
        gs.forEach((g, idx) => { g.style.display = idx === i ? '' : 'none'; });
        document.querySelectorAll('#shopTabs button').forEach((b, idx) => b.classList.toggle('on', idx === i));
        $('shop').scrollTop = 0;
      }
      $('shop').classList.add('show');
    } if (params.get('p') === 'eq') { eqPick = 'hand'; renderEquip(); $('equip').classList.add('show'); } if (params.get('tpv')) { if (!params.get('outfit')) { for (const id of ['hd_hat', 'bd_rain', 'lg_rain', 'ft_boots']) { save.shop.owned.push(id); setEquip(EQUIP.find(e => e.id === id)!.slot, id); } setEquip('hand', 'sl_89'); applySleeve(); } setTpv(true); if (params.get('tpv') === 'cheer') later(0.5, () => react3('cheer')); }
  if (params.get('p') === 'name') { save.name = undefined; save.namePrompted = 0; namePrompt(); } }
  if (SHOT === 'settings') $('settings').classList.add('show');
  if (SHOT === 'fb' || SHOT === 'fbdone') { openFb('settings'); if (SHOT === 'fbdone') fbShow(true); }
  if (SHOT === 'pick') look(-0.25, -0.85);
  if (SHOT === 'scoop') { look(0, -0.5); clearBasinOysters(); scoop(); }
  const shotHold = () => holdOyster(2);
  if (SHOT !== 'pick' && SHOT !== 'scoop' && SHOT !== 'end') shotHold();
  if (SHOT === 'seam') { diff = 2; seamGlow.visible = true; rot = 0.3; }
  if (SHOT === 'prytest') twistSetup();
  if (SHOT === 'pry') { twistSetup(); later(0.05, () => { needleStart = performance.now() - Math.acos(1 - 2 * PRY_C) / (Math.PI * 2 * PRY[2].sp) * 1000 - 20000 / PRY[2].sp * 0; progress = 0.5; pryFx(true, '✓ 2/4　連擊 x2'); gauge.classList.add('hitHold'); hint.textContent = HINTS.twist; }); }
  if (SHOT === 'twist') { twistSetup(); later(0.05, () => { tension = 0.5; }); }
  if (SHOT === 'crack') { twistSetup(); halfTwist(1.1); }
  if (SHOT === 'hitnpc') { look(0.1, -0.25); later(0.05, () => { const m = new THREE.Mesh(meatGeo, meatMat); scene.add(m); meatOnHead(npcs[1], m); }); }
  if (SHOT === 'steal') { const n = npcs[2]; look(0.62, -0.62); n.distract = 99; n.turnDir = -1; say(n, TURN_CHAT[0], 99); later(0.1, () => { startSteal(); }); }
  if (SHOT === 'caught') { const n = npcs[2]; look(0.62, -0.62); later(0.1, () => { stealNpc = null; caughtBy(n); }); }
  if (SHOT === 'crab') { setPhase('busy'); seamMark.visible = false; shellTop.visible = false; revealOdd(3); }
  if (SHOT === 'throw') { look(0.1, -0.3); setPhase('empty'); emptyT = 99; later(0.05, throwShell); }
  if (SHOT === 'warning') { look(-0.3, -0.5); windUp(npcs[2]); npcs[2].windup = 99; }
  if (SHOT === 'umbrella') { look(0.6, -0.3); windUp(npcs[2]); npcs[2].windup = 0.3; later(0.25, () => { umbT = umbLen = 0.9; umb.visible = true; }); later(0.6, () => { umbT = 0.6; }); }
  if (SHOT === 'harbor') look(0, -0.05);
  if (SHOT === 'end') { count = 38; opened = 47; missed = 9; abandoned = 3; perfects = 12; cracked = 4; steals = 3; caught = 1; meatHits = 2; shellHits = 4; thrown = 5; blocks = 3; reflects = 2; lost = 1; hitsTaken = 1; penalty = 28; dayPearls = [0]; dayOdd = [1]; endDay(); }
}, 0);
frame();

// 開始／結算畫面嘛會當開雜貨店、圖鑑、設定
for (const [b, t] of [['oShop', 'shopBtn'], ['oDex', 'dexBtn'], ['oSet', 'setBtn'], ['rDex', 'dexBtn'], ['rSet', 'setBtn']] as const) $(b).onclick = () => ($(t) as HTMLButtonElement).click();
// 所有可關閉面板：頂端懸浮標題＋右上角 ✕（手機、電腦都一樣）
for (const [pid, cid] of [['shop', 'shopClose'], ['dex', 'dexClose'], ['settings', 'setClose'], ['redeem', 'rdClose'], ['fb', 'fbClose'], ['lb', 'lbClose'], ['equip', 'eqClose'], ['gift', 'giftClose'], ['paySum', 'psOk'], ['tagNote', 'tnOk'], ['evLb', 'evLbClose'], ['ach', 'achClose']] as const) {
  const pn = $(pid), h = pn.querySelector('h2')!, bar = document.createElement('div'); bar.className = 'ph';
  pn.insertBefore(bar, h); bar.appendChild(h); const x = document.createElement('button'); x.className = 'px'; x.textContent = '✕'; x.setAttribute('aria-label', '關閉');
  x.onclick = () => ($(cid) as HTMLButtonElement).click(); bar.appendChild(x);
  // 共用外框：標題列以外的內容包進 .pb（統一 16px 內距）
  const body = document.createElement('div'); body.className = 'pb';
  while (bar.nextSibling) body.appendChild(bar.nextSibling);
  pn.appendChild(body); pn.classList.add('sheet');
}
// 共用暗色背板：有可關閉面板開著時蓋住主畫面按鈕，避免露出、誤點
{
  const bd = document.createElement('div'); bd.id = 'pbd'; document.body.appendChild(bd);
  ['pointerdown', 'pointerup', 'click', 'touchstart'].forEach(t => bd.addEventListener(t, e => { e.stopPropagation(); }, { passive: true }));
  const sync = () => bd.classList.toggle('show', !!document.querySelector('.panel.sheet.show'));
  const mo = new MutationObserver(sync); document.querySelectorAll('.panel.sheet').forEach(p => mo.observe(p, { attributes: true, attributeFilter: ['class'] })); sync();
}

const NPC_TIP: Record<string, string> = {
  '快手阿桃': '剝蚵仔最快，很少轉頭聊天，所以很難偷她的肉。想贏今日剝蚵冠軍，主要對手就是她。',
  '講話阿春': '很愛聊天，常常轉頭跟別人講話，是最好偷肉的對象；但偷太多次她會記仇。',
  '好奇阿嬌': '很好奇，常常偷看你在做什麼，偷她的肉比較容易被抓到，要等她確實轉頭再動手。',
};
function npcTip(n: Npc) {
  const g = Math.round(n.grudge ?? 0), lv = g >= 60 ? '😡 很生氣' : g >= 25 ? '😠 有點生氣' : '🙂 心情還好';
  let el = document.getElementById('npcTip'); if (!el) { el = document.createElement('div'); el.id = 'npcTip'; el.className = 'panel'; document.body.appendChild(el); el.addEventListener('pointerdown', e => { e.stopPropagation(); el!.classList.remove('show'); }); }
  el.innerHTML = `<h3>${n.name}</h3><p>${NPC_TIP[n.name] ?? ''}</p><p>怒氣：<b>${g}</b> / 100（${lv}）</p><ul>
<li><b>會讓她生氣</b>：用殼丟中她（+35，丟歪打中 +30）、偷她的肉（+12，被抓到再 +20）。</li>
<li><b>越生氣越常丟你</b>：怒氣越高，她丟殼的頻率越高、準備時間越短；怒氣到 90 會連丟 3 顆殼。</li>
<li><b>怎麼讓她消氣</b>：8 秒內不要再丟她或偷她，之後怒氣每秒降 2.5。<b>起來走動</b>時氣消得快：只要 2 秒、之後每秒降 7.5。</li>
<li><b>被丟的時候</b>：看到 ⚠ 就趕快按住「雨傘」擋（電腦可按住 R；放開就收起來，撐傘時不能剝蚵）；連續擋下 3 次，阿婆們會暫時比較少丟。</li>
<li><b>真的被盯上</b>：可以按「換位置」（電腦按 G），換到比較不容易被丟中的位子。</li></ul><p style="opacity:.7;font-size:12px">點這裡關閉</p>`;
  el.classList.add('show');
}

// ---------- 兌換碼 ----------
function rewardText(d: RedeemCodeDef) {
  const r = d.reward, p: string[] = [];
  if (r.money) p.push(`$${r.money}`);
  for (const id of r.items ?? []) { const it = [...KNIVES, ...UMBS].find(x => x.id === id) as { n: string } | undefined; p.push(it ? it.n : id); }
  (r.pearls ?? []).forEach((n, i) => { if (n > 0 && RAR[i]) p.push(`${RAR[i].emo}${RAR[i].name}×${n}`); });
  for (const [k, n] of Object.entries(r.odd ?? {})) { const o = ODD[+k]; if (o && n > 0) p.push(`${o.emoji || ''}${o.name}×${n}`); }
  for (const [k, n] of Object.entries(r.meds ?? {})) { const m = MEDS.find(x => x.id === k); if (m && n > 0) p.push(`${m.emo}${m.n}×${n}`); }
  return p.join('、') || '（無）';
}
function rewardList(d: RedeemCodeDef) {
  const r = d.reward, li: string[] = [], row = (ic: string, t: string) => li.push(`<li><i class="ic ic-${ic}"></i> ${t}</li>`);
  if (r.money) row('coin', `工錢 $${r.money}`);
  if (r.trial) { const k = KNIVES.find(x => x.id === r.trial!.knife); if (k) row('knife', save.trial?.id === k.id ? `${k.n}（試用 ${r.trial.shifts} 班）` : `${k.n}（已擁有，改送等值工錢 $${TRIAL_REFUND}）`); }
  for (const id of r.items ?? []) { const it = [...KNIVES, ...UMBS].find(x => x.id === id); row('gift', it ? it.n : id); }
  for (const [k, n] of Object.entries(r.meds ?? {})) { const m = MEDS.find(x => x.id === k); if (m && n > 0) row('pill', `${m.n} ×${n}`); }
  for (const [k, n] of Object.entries(r.odd ?? {})) { const o = ODD[+k]; if (o && n > 0) row('book', `${o.name} ×${n}（已收進圖鑑）`); }
  (r.pearls ?? []).forEach((n, i) => { if (n > 0 && RAR[i]) row('pearl', `${RAR[i].name} ×${n}`); });
  return `<div class="rdGot"><b><i class="ic ic-gift"></i> 兌換成功${d.label ? `・${d.label}` : ''}</b><ul>${li.join('')}</ul></div>`;
}
const TRIAL_REFUND = 100;
function tickTrial() {
  const t = save.trial; if (!t) return;
  t.left--; if (t.left > 0) { setTimeout(() => toast(`${KNIVES.find(k => k.id === t.id)?.n ?? '試用刀'}試用剩 ${t.left} 班`, '#ffd76a'), 400); return; }
  delete save.trial; save.shop.owned = save.shop.owned.filter(x => x !== t.id);
  if (save.shop.equipped.knife === t.id) { save.shop.equipped.knife = 'basic'; applyKnife(); }
  setTimeout(() => toast('試用刀到期，已換回舊蚵刀；喜歡的話可以到雜貨店買斷', '#ffd76a'), 400);
}
function grant(d: RedeemCodeDef) {
  const r = d.reward;
  if (r.money) save.money += Math.max(0, Math.floor(r.money));
  for (const id of r.items ?? []) if (!save.shop.owned.includes(id)) save.shop.owned.push(id);
  (r.pearls ?? []).forEach((n, i) => { if (i < save.dex.length) save.dex[i] += Math.max(0, Math.floor(n)); });
  for (const [k, n] of Object.entries(r.odd ?? {})) if (+k < save.odd.length) save.odd[+k] += Math.max(0, Math.floor(n));
  for (const [k, n] of Object.entries(r.meds ?? {})) if (MEDS.some(m => m.id === k)) save.meds[k] = (save.meds[k] ?? 0) + Math.max(0, Math.floor(n));
  if (r.trial) { const k = KNIVES.find(x => x.id === r.trial!.knife); if (k) { if (save.shop.owned.includes(k.id)) save.money += TRIAL_REFUND; else { save.shop.owned.push(k.id); save.trial = { id: k.id, left: Math.max(1, r.trial.shifts) }; save.shop.equipped.knife = k.id; applyKnife(); } } }
  save.redeemed.push(d.id); persist();
}
{
  const msg = $('rdMsg'), inp = $('rdInput') as HTMLInputElement, sub = $('rdSubmit') as HTMLButtonElement;
  const open = () => { if (document.pointerLockElement) document.exitPointerLock(); msg.textContent = ''; msg.className = ''; inp.value = ''; $('redeem').classList.add('show'); setTimeout(() => inp.focus(), 50); };
  $('setRedeem').onclick = open;
  $('rdClose').onclick = () => { $('redeem').classList.remove('show'); inp.blur(); };
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true; sub.disabled = true;
    try {
      const res = await checkCode(inp.value, save.redeemed);
      if (!res.ok) { msg.textContent = REDEEM_MESSAGES[res.reason]; msg.className = 'bad'; return; }
      grant(res.def); msg.innerHTML = rewardList(res.def); msg.className = 'ok'; inp.value = '';
      track('redeem', { item: res.def.id }); if (ac) SFX.jingle(); try { renderDex(); } catch { }
    } finally { busy = false; sub.disabled = false; }
  };
  sub.onclick = go; inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}

initMeds({
  $: (id) => $(id), toast, track, persist,
  getSave: () => save, getState: () => state, isTut: () => !!tut, hasEvRun: () => !!evRun,
  getNpcs: () => npcs, grudgeUI, say,
  getHp: () => hp, setHp: (v) => { hp = v; }, updHud,
  getAc: () => ac, SFX,
  getItems: () => ITEMS, getMoonMax: () => MOON_MAX, getMoonUsed: () => moonUsed, moonStart,
  isPlazaMode: () => plazaMode,
  getSaltNext: () => saltNext, setSaltNext: (v) => { saltNext = v; },
  px, pxCd, pxHtml, payFor, renderShop,
});
initMedsUi();

// 第一次教學開始前取名字（只出現一次）；關面板後再進工寮／教學
let nameAfter: (() => void) | null = null;
function nameDismiss() {
  $('nameAsk').classList.remove('show');
  const f = nameAfter; nameAfter = null; f?.();
}
function namePrompt(after?: () => void) {
  if ($('paySum').classList.contains('show')) { nameWait = true; return; }
  if (save.name || tut) { after?.(); return; }
  nameAfter = after ?? null;
  save.namePrompted = 1; persist();
  ($('naIn') as HTMLInputElement).value = '';
  $('nameAsk').classList.add('show');
}
function ensureNameThen(next: () => void) {
  if (save.name) { next(); return; }
  namePrompt(next);
}
$('naOk').onclick = () => { if (cleanName(($('naIn') as HTMLInputElement).value) === '剝蚵人') { toast('請取一個自己的名字', '#f2b705'); ($('naIn') as HTMLInputElement).focus(); return; } const oldNick = myName(); const i = $('myName') as HTMLInputElement; i.value = ($('naIn') as HTMLInputElement).value; i.dispatchEvent(new Event('change')); if (myName() !== oldNick) try { void Social.announceRename(oldNick); } catch { /* */ } nameDismiss(); };
$('naSkip').style.display = 'none'; $('naSkip').onclick = () => { }; $('naClose').onclick = () => { };
($('naIn') as HTMLInputElement).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ($('naOk') as HTMLButtonElement).click(); } });
// 老玩家名字還是預設「剝蚵人」就要求改名
if (save.tutDone && !save.name) setTimeout(() => namePrompt(), 600);
{ const i = $('naIn'); for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']) i.addEventListener(ev, e => e.stopPropagation()); }
// ---------- 裝備狀態（UI 見 shop/clothUi）----------
let sleeveTry: string | null = null, scaredT = 10;
let clothTab: Slot = 'hand';
let eqPick: Slot | null = null;
let eqFromRes = false;
let shopFromEquip = false;

initClothUi({
  getSave: () => save,
  persist,
  track,
  getAc: () => ac,
  SFX,
  applyOutfit3: () => applyOutfit3(),
  renderShop,
  openShopPx,
  getShopTab: () => shopTab,
  setShopTab: (n) => { shopTab = n; },
  px, pxCd, pxHtml, payFor,
  syncEqPreview,
  stopEqPreview,
  myName: () => myName(),
  statsId,
  COARSE,
  sleeve,
  shirtCuff,
  getEqFromRes: () => eqFromRes,
  setEqFromRes: (v) => { eqFromRes = v; },
  setShopFromEquip: (v) => { shopFromEquip = v; },
  isEvRun: () => !!evRun,
  getSleeveTry: () => sleeveTry,
  setSleeveTry: (v) => { sleeveTry = v; },
  getClothTab: () => clothTab,
  setClothTab: (v) => { clothTab = v; },
  getEqPick: () => eqPick,
  setEqPick: (v) => { eqPick = v; },
});

migrateEquip(); persist(); applySleeve();
// ---------- 第三人稱視角 ----------
// eslint-disable-next-line no-var
var tpReady = false;
const pm = { head: mat(0xffffff), body: mat(0xffffff), legs: mat(0xffffff), feet: mat(0xffffff), skin: mat(skin) };
const me3 = new THREE.Group(); me3.visible = false; scene.add(me3);
const meTorso = new THREE.Group(); me3.add(meTorso);
mesh(rbox(0.36, 0.42, 0.22), pm.body, [0, 0.66, 0], meTorso);
const meSeatLegs = new THREE.Group(); me3.add(meSeatLegs);
mesh(rbox(0.34, 0.12, 0.36), pm.legs, [0, 0.42, -0.1], meSeatLegs);
for (const sx of [-0.09, 0.09]) { mesh(rcyl(0.055, 0.045, 0.32, 6), pm.legs, [sx, 0.2, -0.28], meSeatLegs); mesh(rbox(0.1, 0.05, 0.2), pm.feet, [sx, 0.03, -0.34], meSeatLegs); }
// 站著走路用的腿：髖關節為軸，前後擺
const meLeg = (sx: number) => { const g = new THREE.Group(); g.position.set(sx, 0.86, 0); me3.add(g); mesh(rcyl(0.065, 0.05, 0.8, 6), pm.legs, [0, -0.4, 0], g); mesh(rbox(0.11, 0.06, 0.22), pm.feet, [0, -0.83, -0.05], g); g.visible = false; return g; };
const meLegL = meLeg(-0.09), meLegR = meLeg(0.09); let walkPh = 0; const lastWalk = new THREE.Vector3(); let tpWas = false; const tpLook = new THREE.Vector3();
const meHead = new THREE.Group(); meHead.position.set(0, 1.02, 0); meTorso.add(meHead);
mesh(new THREE.SphereGeometry(0.15, 10, 8), pm.skin, [0, 0, 0], meHead);
mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, 1.3), pm.head, [0, 0.03, 0], meHead);
mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12), pm.head, [0, 0.06, 0], meHead);
const meArm = (s: number) => { const p = new THREE.Group(); p.position.set(s * 0.22, 0.84, 0); meTorso.add(p); mesh(rcyl(0.05, 0.045, 0.36, 6), sleeve, [0, -0.12, -0.12], p).rotation.x = 1.1; mesh(crease(new THREE.SphereGeometry(0.05, 6, 5)), pm.skin, [0, -0.2, -0.3], p); return p; };
const meArmL = meArm(-1), meArmR = meArm(1);
/** 第三人稱本機：與遠端同一套 makePlayerAvatar（廣場與工寮都用這套並套裝備） */
let plazaMe: PlayerRig | null = null;
function ensurePlazaMe(): PlayerRig {
  if (plazaMe) return plazaMe;
  const { M, add } = makeMeshHelpers(scene, matchMedia('(pointer: coarse)').matches);
  plazaMe = makePlayerAvatar({ shirt: 0xc45c26, hair: 0x222222, pants: 0x2a2a40 }, M, add, false);
  applyOutfitToRig(plazaMe, {
    head: equipNow('head').id, hand: equipNow('hand').id,
    body: equipNow('body').id, legs: equipNow('legs').id, feet: equipNow('feet').id,
  });
  posePlazaHangArms(plazaMe);
  plazaMe.outer.visible = false;
  scene.add(plazaMe.outer);
  return plazaMe;
}
let tpv = false, cheerT = 0, ouchT = 0;
function applyOutfit3() {
  for (const s of ['head', 'body', 'legs', 'feet'] as const) {
    const e = equipNow(s), m = pm[s];
    m.map?.dispose();
    if (e.id.endsWith('_none')) {
      if (s === 'body') {
        m.map = eqTex(e);
        m.map.repeat.set(1, 1);
        m.color.set(0xffffff);
      } else {
        m.map = null;
        m.color.set('#e8bc98');
      }
      m.emissive.set(0);
    } else {
      m.map = eqTex(e);
      m.map.repeat.set(1, 1);
      m.color.set(0xffffff);
      m.emissive.set(e.pat === 'neon' ? 0x3a1a50 : 0);
    }
    m.needsUpdate = true;
  }
  const hatOn = !equipNow('head').id.endsWith('_none');
  meHead.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material === pm.head) mesh.visible = hatOn;
  });
  // 廣場本機第三人稱 avatar 同步服飾
  const outfit = {
    head: equipNow('head').id, hand: equipNow('hand').id,
    body: equipNow('body').id, legs: equipNow('legs').id, feet: equipNow('feet').id,
  };
  if (plazaMe) { applyOutfitToRig(plazaMe, outfit); invalidateLocalAvatarCache(); }
  refreshEqPreview(outfit);
  if (isPlazaActive()) void plazaPushOutfit();
}
function setTpv(v: boolean) {
  if (flHeld) flRelease();
  flYaw = 0; flRet = 0;
  tpv = v;
  // 抽一口按住中切視角：保留倒數／動畫進度，只換 FP 手／TP avatar 呈現
  if (plazaForceTp) plazaForceTp = false; // 玩家手動切換，之後跟存檔偏好
  if (plazaMode && !walking) {
    // 第三人稱：鏡頭從角色背後開始繞；切回第一人稱：相對座位轉頭歸零
    if (v) yaw = tYaw = seatYaw;
    else yaw = tYaw = 0;
  }
  save.tpv = v ? 1 : 0; persist(); applyOutfit3(); drawCamBtn();
  const c = document.getElementById('tpvSel') as HTMLInputElement | null; if (c) c.checked = v;
}
function drawCamBtn() { const b = document.getElementById('camBtn'); if (!b) return; b.classList.toggle('tpOn', tpv); b.title = tpv ? '視角：第三人稱（V）' : '視角：第一人稱（V）'; }
function react3(kind: 'cheer' | 'ouch') { if (!tpReady) return; if (kind === 'cheer') cheerT = 1.4; else ouchT = 0.6; }
// 每幀：放好角色、把鏡頭拉到身後上方；手和蚵仔仍跟著鏡頭，操作不變
function camTick(dt: number) {
  if (!tpReady) return;
  const show = tpv && state === 'play';
  const enter = show && !tpWas; tpWas = show;
  // 第三人稱一律用廣場同一套 makePlayerAvatar（工寮坐下／走動也套目前穿的衣服）
  const usePlazaMe = show;
  tpOn = show;
  me3.visible = false;
  if (plazaMe) plazaMe.outer.visible = usePlazaMe;
  umbTick3(dt, show);
  if (show) { handRig.scale.setScalar(0.75); handRig.position.set(0, -0.04, 0); }
  else applyFpHandLayout();
  handL.children[0].visible = handR.children[0].visible = !show;
  if (!show) {
    if (plazaMe) plazaMe.outer.visible = false;
    // 第三人稱坐下／走動會把第一人稱手藏起來；切回第一人稱且仍坐著時要恢復，否則剝蚵雙手會消失。走動本來就沒有第一人稱手。
    if (!walking) handRig.visible = true;
    return;
  }
  const kk = enter ? 1 : 1 - Math.exp(-5 * dt);
  meSeatLegs.visible = !walking && !plazaMode; meLegL.visible = meLegR.visible = walking && !plazaMode;
  if (walking) {
    const sp = Math.hypot(walkPos.x - lastWalk.x, walkPos.z - lastWalk.z) / Math.max(dt, 1e-3); lastWalk.copy(walkPos); walkMovingT = sp > 0.3 ? performance.now() : walkMovingT;
    walkPh += plazaGaitRate(sp) * dt;
    handRig.visible = false;
    if (plazaMode) {
      // 廣場：死鬥同款 avatar，腳底 y=0、頭高 ≈1.5；第三人稱鎖俯仰，避免遠端跟著點頭
      pitch = tPitch = PLAZA_WALK_PITCH;
      const rig = ensurePlazaMe();
      // 剛從坐下站起：清掉坐姿髖偏移
      if (rig.root.position.y !== 0) posePlazaStand(rig);
      rig.outer.visible = true;
      rig.outer.position.set(walkPos.x, jumpY, walkPos.z);
      rig.outer.rotation.order = 'YXZ';
      // 躺著：身體朝向鎖 bodyYaw，鏡頭仍用 yaw 繞轉
      rig.outer.rotation.y = bodyPose === 'lie' ? bodyYaw : yaw;
      rig.outer.rotation.x = 0;
      if (jumpT > 0) {
        posePlazaJump(rig, PLAZA_JUMP_DUR - jumpT);
        posePlazaHangArms(rig);
        if (plazaCarrying()) posePlazaCarryHold(rig);
      } else {
        const amp = Math.min(1, sp / 1.2);
        const swing = posePlazaWalkCycle(rig, walkPh, Math.max(0.15, amp));
        // 走動維持輕微ㄑ字彎肘；停住才自然下垂
        if (sp > 0.12) posePlazaWalkSwingArms(rig, swing);
        else {
          posePlazaHangArms(rig);
          rig.torso.rotation.y *= 0.8; rig.torso.rotation.z *= 0.8; rig.torso.rotation.x *= 0.8;
        }
        if (plazaCarrying()) posePlazaCarryHold(rig);
        applyBodyPose(rig, lastPose, poseK);
      }
      const fx = -Math.sin(yaw + flYaw), fz = -Math.cos(yaw + flYaw);
      const dist = tpDist * tpDistK();
      const el = Math.min(1.1, Math.max(0.05, tpPitch)), hd = dist * Math.cos(el);
      const eyeY = wideView ? 1.55 : 1.4;
      const cp = new THREE.Vector3(walkPos.x - fx * hd, eyeY + dist * Math.sin(el) + jumpY * 0.35 - poseK * (lastPose === 'lie' ? 0.7 : 0.35), walkPos.z - fz * hd);
      { const CAP = 2.7, R = 10.9, hy = eyeY; if (cp.y > CAP) { const k = (CAP - hy) / (cp.y - hy); const ix = walkPos.x + (cp.x - walkPos.x) * k, iz = walkPos.z + (cp.z - walkPos.z) * k; if (Math.abs(ix) < R && Math.abs(iz) < R) { cp.x = ix; cp.z = iz; cp.y = CAP; } } }
      if (enter) tpCam.position.copy(cp); else tpCam.position.lerp(cp, kk);
      { const lt = new THREE.Vector3(walkPos.x + fx * 1.2, wideView && camera.aspect <= 1.6 ? 1.15 : 1.0, walkPos.z + fz * 1.2); if (enter) tpLook.copy(lt); else tpLook.lerp(lt, kk); tpCam.lookAt(tpLook); }
      { const f = tpFovFor('walk'); if (tpCam.fov !== f) { tpCam.fov = f; tpCam.updateProjectionMatrix(); } }
      tpCam.updateMatrixWorld(); return;
    }
    // 工寮走動：與廣場同一套 avatar／裝備
    const rig = ensurePlazaMe();
    if (rig.root.position.y !== 0) posePlazaStand(rig);
    rig.outer.visible = true;
    rig.outer.position.set(walkPos.x, jumpY, walkPos.z);
    rig.outer.rotation.order = 'YXZ';
    rig.outer.rotation.y = yaw;
    rig.outer.rotation.x = 0;
    if (jumpT > 0) {
      posePlazaJump(rig, PLAZA_JUMP_DUR - jumpT);
      posePlazaHangArms(rig);
    } else {
      const amp = Math.min(1, sp / 1.2);
      const swing = posePlazaWalkCycle(rig, walkPh, Math.max(0.15, amp));
      if (sp > 0.12) posePlazaWalkSwingArms(rig, swing);
      else {
        posePlazaHangArms(rig);
        rig.torso.rotation.y *= 0.8; rig.torso.rotation.z *= 0.8; rig.torso.rotation.x *= 0.8;
      }
    }
    const fx = -Math.sin(yaw + flYaw), fz = -Math.cos(yaw + flYaw);
    const z = tpDist * tpDistK() / 3.6;
    const ltx = walkPos.x + fx * 1.2, lty = jumpY + 0.9, ltz = walkPos.z + fz * 1.2;
    const cx0 = walkPos.x - fx * 2.9, cy0 = jumpY + 2.5, cz0 = walkPos.z - fz * 2.9;
    const cp = new THREE.Vector3(ltx + (cx0 - ltx) * z, lty + (cy0 - lty) * z, ltz + (cz0 - ltz) * z);
    if (enter) tpCam.position.copy(cp); else tpCam.position.lerp(cp, kk);
    { const lt = new THREE.Vector3(ltx, lty, ltz); if (enter) tpLook.copy(lt); else tpLook.lerp(lt, kk); tpCam.lookAt(tpLook); }
    { const f = tpFovFor('walk'); if (tpCam.fov !== f) { tpCam.fov = f; tpCam.updateProjectionMatrix(); } }
    tpCam.updateMatrixWorld(); return;
  }
  cheerT = Math.max(0, cheerT - dt); ouchT = Math.max(0, ouchT - dt);
  const up = cheerT > 0 ? Math.sin(Math.min(1, cheerT) * Math.PI) : 0;
  if (plazaMode) {
    // 廣場坐下：與走動同一 plazaMe／裝備；只套坐姿（吸菸座另套抽烟手勢）
    const rig = ensurePlazaMe();
    const mine = plazaMySeat();
    const pose = mine ? seatPose(mine.pileId, mine.slot) : { pos: new THREE.Vector3(SEAT.x, 0, SEAT.z), yaw: seatYaw };
    const back = -0.08;
    rig.outer.visible = true;
    rig.outer.position.set(pose.pos.x + Math.sin(pose.yaw) * back, 0, pose.pos.z + Math.cos(pose.yaw) * back);
    rig.outer.rotation.order = 'YXZ';
    rig.outer.rotation.y = pose.yaw;
    rig.outer.rotation.x = 0;
    const smoke = smokeSitActive || (mine ? isSmokePile(mine.pileId) : false);
    if (smoke) {
      if (smokeSitActive) {
        posePlazaSmokeSit(rig, {
          puffK: puffVisualK(),
          inhale: puffInhaleK(),
          away: puffAwayT,
          flick: puffFlickT,
        });
        // 吐煙時頭微前傾
        if (puffExhaleHeadT > 0 && rig.head) rig.head.rotation.x += puffExhaleHeadT * 0.06;
      } else posePlazaSmokeSit(rig, 0);
    } else {
      clearPlazaSmokeCig(rig);
      posePlazaSit(rig);
    }
    handRig.visible = false;
    const fx = -Math.sin(yaw + flYaw), fz = -Math.cos(yaw + flYaw);
    const dist = tpDist * tpDistK();
    const el = Math.min(1.1, Math.max(0.05, tpPitch)), hd = dist * Math.cos(el);
    const cp = new THREE.Vector3(SEAT.x - fx * hd, SEAT.y + 0.4 + dist * Math.sin(el), SEAT.z - fz * hd);
    const lt = new THREE.Vector3(SEAT.x + fx * 0.2, SEAT.y - 0.15, SEAT.z + fz * 0.2);
    if (enter) { tpCam.position.copy(cp); tpLook.copy(lt); } else { tpCam.position.lerp(cp, kk); tpLook.lerp(lt, kk); }
    { const f = tpFovFor('plazaSit'); if (tpCam.fov !== f) { tpCam.fov = f; tpCam.updateProjectionMatrix(); } }
    tpCam.lookAt(tpLook); tpCam.updateMatrixWorld();
    return;
  }
  // 工寮坐下：與廣場同一套 avatar，套目前穿的衣服
  const rig = ensurePlazaMe();
  rig.outer.visible = true;
  rig.outer.position.set(SEAT.x, 0, SEAT.z);
  rig.outer.rotation.order = 'YXZ';
  rig.outer.rotation.set(0, seatYaw, 0);
  posePlazaSit(rig);
  if (ouchT > 0) rig.torso.rotation.x += Math.sin(ouchT / 0.6 * Math.PI) * 0.35;
  if (up > 0.01) {
    rig.torso.position.y += up * 0.06;
    const cheer = (upper: THREE.Group, lower: THREE.Group, side: number) => {
      const shx = side * 0.22, shy = 0.30, shz = 0;
      const elx = shx + side * 0.08, ely = shy + 0.1 * up, elz = -0.12;
      const wrx = elx + side * 0.04, wry = ely + 0.32 * up, wrz = elz + 0.08 * up;
      placePlazaArmChain(upper, lower, shx, shy, shz, elx, ely, elz, wrx, wry, wrz);
    };
    cheer(rig.upperL, rig.lowerL, -1);
    cheer(rig.upperR, rig.lowerR, 1);
  }
  rig.head.rotation.y = yaw * 0.6;
  const h = seatYaw + yaw * 0.35 + flYaw, fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  {
    // 工寮：從背後斜 3/4 看，人在畫面中下、全身入鏡；距離跟走動同一套縮放
    const z = tpDist * tpDistK() / 3.6;
    const ltx = SEAT.x + fx * 0.8 + rx * 0.35, lty = SEAT.y - 0.2, ltz = SEAT.z + fz * 0.8 + rz * 0.35;
    const cx0 = SEAT.x - fx * 2.6 - rx * 1.5, cy0 = SEAT.y + 0.85, cz0 = SEAT.z - fz * 2.6 - rz * 1.5;
    const cp = new THREE.Vector3(ltx + (cx0 - ltx) * z, lty + (cy0 - lty) * z, ltz + (cz0 - ltz) * z);
    const lt = new THREE.Vector3(ltx, lty, ltz);
    if (enter) { tpCam.position.copy(cp); tpLook.copy(lt); } else { tpCam.position.lerp(cp, kk); tpLook.lerp(lt, kk); }
    { const f = tpFovFor('shedSit'); if (tpCam.fov !== f) { tpCam.fov = f; tpCam.updateProjectionMatrix(); } }
    tpCam.lookAt(tpLook); tpCam.updateMatrixWorld();
  }
  // 蚵仔與刀跟著角色的手（handRig 掛在 camera 底下，換算到角色胸前）
  camera.updateMatrixWorld(); const hp = new THREE.Vector3(SEAT.x + fx * 0.45, SEAT.y - 0.55 + up * 0.4, SEAT.z + fz * 0.45); camera.worldToLocal(hp); handRig.position.copy(hp).add(new THREE.Vector3(0, 0.24, 0.42)); handRig.scale.setScalar(0.6);
}
tpv = !!save.tpv; applyOutfit3(); drawCamBtn(); tpReady = true;
$('camBtn').onclick = () => setTpv(!tpv);
{
  const lb = document.getElementById('lookBtn');
  if (lb) {
    lb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio().resume(); flBeginHold(e); });
    lb.addEventListener('pointermove', e => { if (flHeld && e.pointerId === flDragId) flApplyDrag(e); });
    const end = (e: PointerEvent) => { if (e.pointerId === flPtr) flRelease(); };
    lb.addEventListener('pointerup', end);
    lb.addEventListener('pointercancel', end);
    lb.addEventListener('contextmenu', e => e.preventDefault());
  }
}
{ const c = document.getElementById('tpvSel') as HTMLInputElement | null; if (c) { c.checked = tpv; c.onchange = () => setTpv(c.checked); } }
// iOS：面板顯示後才重畫一次內容，避免隱藏時插入的 SVG 不上色
$('eqClose').onclick = () => { $('equip').classList.remove('show'); stopEqPreview(); if (eqFromRes) { eqFromRes = false; $('result').classList.add('show'); } };
$('rEquip').onclick = () => { eqFromRes = true; $('result').classList.remove('show'); eqPick = null; openEquip(); };
$('oEquip').onclick = () => { eqPick = null; openEquip(); };
function shopTabs() {
  const list = $('shopList'), kids = Array.from(list.children); const groups: HTMLElement[] = []; let cur: HTMLElement | null = null; const head = document.createElement('div');
  for (const k of kids) { if (k.tagName === 'H3') { cur = document.createElement('div'); cur.className = 'stab'; groups.push(cur); } (cur ?? head).appendChild(k); }
  list.innerHTML = ''; list.appendChild(head); groups.forEach(g => list.appendChild(g));
  const names = groups.map(g => g.querySelector('h3')!.textContent!.replace('剝殼刀', '刀具').replace('盆仔', '器具'));
  let bar = document.getElementById('shopTabs'); if (!bar) { bar = document.createElement('div'); bar.id = 'shopTabs'; const h = $('shop').querySelector('h2')!; h.after(bar); }
  shopTab = Math.min(shopTab, groups.length - 1);
  bar.innerHTML = names.map((n, i) => `<button data-tab="${i}" class="${i === shopTab ? 'on' : ''}">${n.replace(/^(\S+)\s+(.+)$/, '<span class="ti">$1</span><span class="tl">$2</span>')}</button>`).join('');
  groups.forEach((g, i) => { g.style.display = i === shopTab ? '' : 'none'; g.querySelector('h3')!.style.display = 'none'; });
  bar.querySelectorAll('button').forEach(b => (b as HTMLButtonElement).onclick = () => { shopTab = +b.getAttribute('data-tab')!; shopTabs2(groups, bar!); });
}
function shopTabs2(groups: HTMLElement[], bar: HTMLElement) { groups.forEach((g, i) => g.style.display = i === shopTab ? '' : 'none'); bar.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === shopTab)); $('shop').scrollTop = 0; newDecor(); }

// 手機返回鍵：關掉最上層的視窗；上工中不離開；主畫面連按兩次才離開（同核心回收）
function cleanName(v: string) { return [...v.replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').trim()].slice(0, 8).join('').trim() || '剝蚵人'; }
function myName() { return save.name ? cleanName(save.name) : '剝蚵人'; }
function drawName() { const n = myName(); const m = document.getElementById('meLine'); if (m) { m.textContent = ''; const u = document.createElement('i'); u.className = 'ic ic-user'; m.append(u); const b = document.createElement('span'); b.id = 'nameEdit'; b.setAttribute('role', 'button'); b.tabIndex = 0; b.title = '點一下改名字'; b.textContent = n; const g = document.createElement('i'); g.textContent = ' ✎'; b.append(g); b.onkeydown = e => { if (e.key === 'Enter') b.click(); }; b.onclick = () => { ($('setBtn') as HTMLButtonElement).click(); setTimeout(() => ($('myName') as HTMLInputElement).focus(), 50); }; m.append(b); } const i = document.getElementById('myName') as HTMLInputElement | null; if (i && document.activeElement !== i) i.value = save.name ? n : ''; }
{ const i = $('myName') as HTMLInputElement; const commit = () => { const v = cleanName(i.value); save.name = v === '剝蚵人' ? undefined : v; i.value = save.name ? v : ''; persist(); drawName(); };
  i.addEventListener('change', commit); i.addEventListener('blur', commit); i.addEventListener('input', () => { const v = cleanName(i.value); save.name = v === '剝蚵人' ? undefined : v; persist(); }); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); i.blur(); } });
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) i.addEventListener(ev, e => e.stopPropagation()); drawName(); }
// 面板可捲動提示：內容超出且還沒捲到底時，底部顯示 ⌄
document.querySelectorAll<HTMLElement>('.panel').forEach(pn => {
  const h = document.createElement('div'); h.className = 'scrollHint'; h.innerHTML = '<span><b>⌄</b></span>'; pn.appendChild(h);
  const upd = () => h.classList.toggle('on', pn.classList.contains('show') && pn.scrollHeight - pn.clientHeight - pn.scrollTop > 24);
  h.onclick = () => pn.scrollBy({ top: pn.clientHeight * 0.6, behavior: 'smooth' });
  pn.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd);
  new MutationObserver(() => requestAnimationFrame(upd)).observe(pn, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); upd();
});
// 上工中關掉／離開頁面：記一筆中途離開
addEventListener('pagehide', () => { if (state === 'play' && !tut) track('abandon', { reason: 'abandon', count, opened, dur: Math.round(shiftLen - Math.max(0, timeLeft)), loc: locNow().id, dstat: dstatStr() }); });
initFeedback({
  $: (id) => $(id),
  toast,
  getState: () => state,
  getLocId: () => locNow().id,
  getDays: () => save.days,
  statsId,
  statsUrl: STATS_URL,
  coarse: COARSE,
});
/** 關閉最上層可關視窗（ESC／手機返回共用）。主選單／結算不關。 */
function closeTopModal(): boolean {
  if (closeWeaponPreview()) return true;
  if (plazaLeaveAskIsOpen()) { plazaCloseLeaveAsk(); return true; }
  if (plazaMapIsOpen()) { plazaCloseMap(); return true; }
  if (plazaChatIsOpen()) { plazaCloseChat(); return true; }
  for (const id of ['giftMsg', 'newMsg', 'featMsg', 'svMsg']) {
    const m = document.getElementById(id);
    if (!m) continue;
    const btn = m.querySelector('.gmX, .gmNo, .gmOk') as HTMLElement | null;
    if (btn) btn.click(); else m.remove();
    return true;
  }
  const shown = (id: string) => !!document.getElementById(id)?.classList.contains('show');
  if (shown('npcTip')) { $('npcTip').classList.remove('show'); return true; }
  if (shown('medList')) { $('medList').classList.remove('show'); return true; }
  if (shown('hg')) { hgEnd(); return true; }
  // 由上到下：確認框／子面板先關
  for (const [id, close] of [
    ['backMenu', 'bmStay'], ['sv', 'svClose'], ['ach', 'achClose'], ['evLb', 'evLbClose'], ['lb', 'lbClose'],
    ['fb', 'fbClose'], ['redeem', 'rdClose'], ['equip', 'eqClose'], ['gift', 'giftClose'],
    ['shop', 'shopClose'], ['settings', 'setClose'], ['dex', 'dexClose'],
    ['nameAsk', 'naSkip'], ['paySum', 'psOk'], ['tagNote', 'tnOk'],
  ] as const) {
    if (shown(id)) { ($(close) as HTMLElement).click(); return true; }
  }
  return false;
}
installBackGuard(() => {
  if (closeTopModal()) return 'handled';
  if (isPlazaActive() && !plazaMode) {
    returnToMainMenu(async () => {
      await closePlaza().catch(() => 0); applySeat(save.seat ?? 'door'); clearPlazaLeaveUi();
      void refreshPlazaOnlineAfterLeave();
    });
    return 'handled';
  }
  if (state === 'play') { toast('上工中按返回不會離開；要收工請按「回主選單」或等時間到', '#ffcf8a'); return 'handled'; }
  return 'confirm-exit';
}, () => state === 'play' || isPlazaActive());

// ── 主畫面導覽（新玩家第一次看到主畫面時；阿婆逐一介紹按鈕）──
const HG: [string, string][] = [
  ['calBtn', '每天先點這個日曆簽到領上工費，有錢才好買工具喔。'],
  ['start', '準備好了就按這裡開始剝蚵。'],
  ['oShop', '雜貨店可以買刀子、手套跟各種好用的東西。'],
  ['oDex', '剝到的珍珠和稀奇東西，都會記在圖鑑裡。'],
  ['oRank', '排行榜看看今天誰最會剝，也可以幫人按讚。'],
  ['oAch', '做到各種厲害的事會解鎖成就，有獎金，還能換稱號。'],
  ['discordStart', '來蚵寮群組聊天，兌換碼常常在那裡公布。'],
  ['oSet', '音量、名字跟重看教學，都在設定裡。'],
  ['locPick', '這裡可以換漁港，剝得越多，能去的地方越多。'],
];
let hgI = -1;
function hgShow() {
  const steps = HG.filter(([id]) => { const e = document.getElementById(id); return e && e.offsetParent; });
  let box = document.getElementById('hg'); if (!box) { box = document.createElement('div'); box.id = 'hg'; box.innerHTML = '<div id="hgHole"></div><div id="hgCall"><div id="hgTxt"></div><div class="hgB"><button id="hgSkip">略過</button><button id="hgNext">下一步</button></div></div>'; document.body.appendChild(box);
    let downOk = false; const t0 = () => Number(box!.dataset.t || 0);
    box.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); downOk = performance.now() - t0() > 350; });
    box.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); });
    box.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); if (!downOk) return; downOk = false;
      if ((e.target as HTMLElement).closest('#hgSkip')) hgEnd(); else hgStep(hgI + 1, steps2()); });
  }
  const steps2 = () => steps; (box as any)._s = steps; hgStep(0, steps);
}
function hgStep(i: number, steps: [string, string][]) {
  const box = $('hg'); if (i >= steps.length) { hgEnd(); return; } hgI = i; box.dataset.t = String(performance.now()); box.classList.add('show');
  const el = $(steps[i][0]); el.scrollIntoView({ block: 'center' });
  requestAnimationFrame(() => { const r = el.getBoundingClientRect(), H = innerHeight, p = 6; const hole = $('hgHole');
    Object.assign(hole.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + p * 2 + 'px', height: Math.min(r.height, H * 0.4) + p * 2 + 'px' });
    $('hgTxt').innerHTML = '<b>阿婆</b><span class="hgN">' + (i + 1) + '/' + steps.length + '</span><br>' + steps[i][1];
    $('hgNext').textContent = i === steps.length - 1 ? '知道了' : '下一步';
    const c = $('hgCall'); const below = r.top + r.height / 2 < H / 2; c.style.top = below ? Math.min(r.bottom + 16, H - 170) + 'px' : ''; c.style.bottom = below ? '' : Math.min(H - r.top + 16, H - 170) + 'px'; });
}
function hgEnd() { const b = document.getElementById('hg'); if (b) b.classList.remove('show'); hgI = -1; inputGuard(); try { LS.setItem('oyster-homeguide', '1'); } catch { } }
function hgMaybe() { if ((save.days || 0) >= 1 || LS.getItem('oyster-homeguide')) { return; } if ($('overlay').classList.contains('show')) setTimeout(hgShow, 600); }
$('hgReplay').onclick = () => { $('settings').classList.remove('show'); if (state === 'play') { toast('收工回到主畫面後再看導覽喔', '#ffcf8a'); return; } $('overlay').classList.add('show'); setTimeout(hgShow, 400); };
hgMaybe();

initUpdate(() => state !== 'play' && !document.querySelector('.panel.show:not(#overlay):not(.overlay)'));
(window as any).__tpTest = () => { const p = BOWL.clone().project(viewCam()); const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight; return { tp: tpOn, x: Math.round(x), y: Math.round(y), hit: nearBowl(x, y), farMiss: nearBowl(x > innerWidth / 2 ? 5 : innerWidth - 5, 5) }; };
(window as any).__cheer = () => react3('cheer');
(window as any).__aim = () => setPhase('aim');
(window as any).__meat = { npcScr: () => npcs.map(n => { const p = worldOf(n.head).add(new THREE.Vector3(0, -0.15, 0)).project(viewCam()); return { name: n.name, x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, z: p.z }; }), at: (x: number, y: number) => npcAtScr(x, y)?.name ?? null, get hits() { return meatHits; }, get count() { return count; }, get pay() { return meatPay; }, get phase() { return phase; } };

// ---- 第三人稱雨傘：手舉起來撐一支立體傘（傘骨、傘面分片、把手），開合有動畫，被打中會晃 ----
const umb3 = new THREE.Group(); umb3.visible = false; me3.add(umb3);
const umb3Can = new THREE.Group(); umb3.add(umb3Can);
let umb3Open = 0, umb3Jolt = 0; const umbFx: { m: THREE.Mesh; t: number }[] = [];
function build3Umb() {
  while (umb3.children.length > 1) umb3.remove(umb3.children[1]); while (umb3Can.children.length) umb3Can.remove(umb3Can.children[0]);
  const pal: Record<string, number[]> = { stripe: [0xc8302a, 0xf4f0e8], clear: [0xcfe6ff, 0xe4f2ff], navy: [0x1f2b4a, 0x2a3c66], beach: [0xe83a3a, 0xf6c33a, 0x3ab0e8, 0x5ac85a], temple: [0xb0141a, 0xe8b030], gold: [0x8a1420, 0xd4af37] };
  const fancy = umbLook === 'temple' || umbLook === 'gold';
  const cols = pal[umbLook] ?? pal.stripe, N = fancy ? 12 : 8, R = 0.62 * umbSize, Hh = 0.24 * umbSize, clear = umbLook === 'clear';
  const metal = umbLook === 'gold' ? 0xe8c040 : umbLook === 'temple' ? 0xd8a020 : 0x8a8a90;
  const grip = umbLook === 'gold' ? 0xd4af37 : umbLook === 'temple' ? 0xb0141a : 0x5a3a1a;
  // 傘桿＋J 形把手
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), mat(metal), [0, 0.0, 0], umb3);
  const hd = mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 10, Math.PI), mat(grip), [0.05, -0.47, 0], umb3); hd.rotation.z = Math.PI;
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), mat(grip), [0, -0.42, 0], umb3);
  // 傘面：一片一片的三角面，每片顏色輪流
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, Hh, 0, Math.cos(a0) * R, 0, Math.sin(a0) * R, Math.cos(a1) * R, 0, Math.sin(a1) * R], 3)); g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: clear ? 0.1 : umbLook === 'gold' ? 0.42 : 0.8, metalness: umbLook === 'gold' ? 0.32 : 0, transparent: clear, opacity: clear ? 0.5 : 1, flatShading: true });
    umb3Can.add(new THREE.Mesh(g, m));
    // 傘骨
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.hypot(R, Hh), 4), mat(metal));
    rib.position.set(Math.cos(a0) * R / 2, Hh / 2, Math.sin(a0) * R / 2); rib.lookAt(new THREE.Vector3(Math.cos(a0) * R, 0, Math.sin(a0) * R).add(umb3.position)); rib.rotateX(Math.PI / 2); umb3Can.add(rib);
    mesh(new THREE.SphereGeometry(0.014, 5, 4), mat(metal), [Math.cos(a0) * R, -0.005, Math.sin(a0) * R], umb3Can);
  }
  if (fancy) { const fr = mesh(new THREE.CylinderGeometry(R, R, 0.08, N, 1, true), new THREE.MeshStandardMaterial({ color: umbLook === 'gold' ? 0xffe9a0 : 0xffe28a, side: THREE.DoubleSide, metalness: umbLook === 'gold' ? 0.4 : 0, roughness: 0.4 }), [0, -0.04, 0], umb3Can); void fr; }
  mesh(new THREE.ConeGeometry(0.02, 0.08, 6), mat(metal), [0, Hh + 0.04, 0], umb3Can);
  umb3Can.position.y = 0.42;
}
build3Umb(); umb3Ready = true;
function umbHit3(at: THREE.Vector3) {
  if (!umb3Ready || !tpOn) return; umb3Jolt = 0.3;
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.95, depthWrite: false }));
  // 打中的點：拉到傘面上
  umb3Can.updateMatrixWorld(); const c = new THREE.Vector3(0, 0.15, 0); umb3Can.localToWorld(c); f.position.copy(c).lerp(at, 0.25); scene.add(f); umbFx.push({ m: f, t: 0 });
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xd8d0c0, transparent: true })); p.position.copy(f.position); p.userData.v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(2.2); scene.add(p); umbFx.push({ m: p, t: 0 }); }
}
function umbTick3(dt: number, show: boolean) {
  if (!umb3Ready) return;
  // 第三人稱傘一律掛 plazaMe（工寮／廣場同一套）
  if (show) {
    const host = ensurePlazaMe().outer;
    if (umb3.parent !== host) host.add(umb3);
  } else if (umb3.parent !== me3) me3.add(umb3);
  for (let i = umbFx.length - 1; i >= 0; i--) { const e = umbFx[i]; e.t += dt; const v = e.m.userData.v as THREE.Vector3 | undefined;
    if (v) { e.m.position.addScaledVector(v, dt); v.y -= 6 * dt; } else e.m.scale.setScalar(1 + e.t * 9);
    (e.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - e.t / 0.4); if (e.t > 0.4) { scene.remove(e.m); umbFx.splice(i, 1); } }
  const want = umbS > 0 ? 1 : 0; umb3Open += Math.sign(want - umb3Open) * Math.min(Math.abs(want - umb3Open), dt / 0.2 / umbSlow);
  umb3Jolt = Math.max(0, umb3Jolt - dt);
  const vis = show && umb3Open > 0.01; umb3.visible = vis; if (show) umb.visible = false;
  if (!vis) return;
  // 傘面像真的傘一樣從收起的細長往外撐開
  const o = umb3Open, e = 1 - Math.pow(1 - o, 3); umb3Can.scale.set(0.12 + 0.88 * e, 1.6 - 0.6 * e, 0.12 + 0.88 * e);
  const j = umb3Jolt > 0 ? Math.sin(umb3Jolt * 60) * umb3Jolt * 1.2 : 0;
  const st = 0;
  // 往前開傘：傘面朝前（殼飛來的方向），手往前伸握柄，傘稍微壓低偏右，不擋住手上的蚵仔
  umb3.position.set(0.22, 0.95 + st + 0.05 * e, -0.38 - 0.12 * e + j * 0.12); umb3.rotation.set(-1.15 * e - 0.2 - j, 0, -0.18 + j * 0.5);
}
function umbArm() { if (!umb3Ready || !umb3.visible) return; const e = 1 - Math.pow(1 - umb3Open, 3); meArmR.rotation.x = 1.35 * e + 0.2; meArmR.rotation.z = -0.1; }
(window as any).__umb3 = { open: () => openUmbrella(), close: () => closeUmbrella(), throwAt: () => throwOne(npcs[2]), get o() { return umb3Open; }, set slow(v: number) { umbSlow = v; } };
// iOS WebKit：面板從 display:none 變成顯示時，捲動容器內未進入畫面的內容（SVG、按鈕）有時不會繪製，
// 直到下一次重畫。顯示後下一幀強制重排並觸發一次重繪。
new MutationObserver(ms => { for (const m of ms) { const el = m.target as HTMLElement;
  if (el.classList.contains('panel') && el.classList.contains('show') && !(m.oldValue || '').includes('show'))
    requestAnimationFrame(() => { void el.offsetHeight; el.style.opacity = '0.999'; requestAnimationFrame(() => { el.style.opacity = ''; }); }); } })
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });

initAnnounce({
  LS, LS_P, $: (id) => $(id), esc, bootQuiet: () => !!bootQuiet(), menuModalBusy: () => !!menuModalBusy(), Social,
  giftAlert, svAlert, newAnnounce,
});

(window as any).__pity = { LEGEND_PITY, LEGEND_ODD, get dry() { return save.legendDry ?? 0; }, set dry(v: number) { save.legendDry = v; }, roll: () => rollFind(), sync: () => legendSync(), give: (i: number) => { save.odd[i]++; }, odd: () => save.odd.slice() };

if ((navigator as any).standalone) document.documentElement.classList.add('iosApp');

/* events / survey extracted */
// 手機：對話框按鈕統一走 btn()（放開觸發＋click 備援），不只靠 onclick
if (COARSE) for (const id of ['bmGo', 'bmStay', 'psOk', 'tnOk']) { const el = $(id) as HTMLButtonElement; const f = el.onclick; if (!f) continue; el.onclick = null; btn(id, () => f.call(el, new PointerEvent('click'))); }
initEvents({
  $: (id) => $(id), persist, toast, track, esc, Social, ODD, rarOf, legendTotal, renderDex, renderLocs,
  audio, startDay: () => enterWorkShed(() => startDay()), later, endDay, achBump, AS, SHOT, SHIFT,
  returnToMainMenu,
  get save() { return save; }, get state() { return state; }, get tut() { return tut; },
  get count() { return count; }, set count(v) { count = v; },
  get timeLeft() { return timeLeft; }, get shiftLen() { return shiftLen; }, set shiftLen(v) { shiftLen = v; },
  get endReason() { return endReason; }, set endReason(v) { endReason = v; },
  get lastPay() { return lastPay; }, get statsSid() { return statsSid; },
  get evToken() { return evToken; }, set evToken(v) { evToken = v; },
  get evRun() { return evRun; }, set evRun(v) { evRun = v; },
  get evLastId() { return evLastId; }, set evLastId(v) { evLastId = v; },
  get evBusy() { return evBusy; }, set evBusy(v) { evBusy = v; },
});
initSurvey({
  $: (id) => $(id), persist, toast, esc, Social, SFX, LS, renderDaily, bootQuiet: () => bootQuiet(),
  get save() { return save; }, get state() { return state; }, get tut() { return tut; },
});
initAchievements({
  $: (id) => $(id), persist, toast, track, esc, btn, Social, ODD, LEGEND_ODD, setsOn, locNow, endDay,
  get save() { return save; }, get state() { return state; }, get tut() { return tut; },
  get count() { return count; }, get opened() { return opened; }, get perfects() { return perfects; },
  get steals() { return steals; }, get caught() { return caught; }, get meatHits() { return meatHits; },
  get blocks() { return blocks; }, get reflects() { return reflects; }, get shellHits() { return shellHits; },
  get nightShift() { return nightShift; },
  get achFromRes() { return achFromRes; }, set achFromRes(v) { achFromRes = v; },
});
function syncMenuBack() {
  const sh = $('overlay').classList.contains('show');
  document.body.classList.toggle('menuOn', sh);
}
new MutationObserver(() => {
  const sh = $('overlay').classList.contains('show');
  syncMenuBack();
  if (!sh) setSvPrompted(false);
  if (sh && !evShown) { evFetch(); svFetch(); }
  else if (sh && evShown) svAlert();
  setEvShown(sh);
}).observe($('overlay'), { attributes: true, attributeFilter: ['class'] });
syncMenuBack();
setEvShown($('overlay').classList.contains('show')); evFetch(); svFetch();
setInterval(() => { if ($('overlay').classList.contains('show') && evCfg) evRender(); if ($('overlay').classList.contains('show') && svList.length) svRender(); }, 30_000);
(window as any).__ev = { get run() { return evRun; }, get cfg() { return evCfg; }, get hp() { return hp; }, get npcs() { return npcs.length; }, get left() { return timeLeft; }, minDist: () => { let m = 99; for (let i = 0; i < npcs.length; i++) for (let j = i + 1; j < npcs.length; j++) m = Math.min(m, npcs[i].g.position.distanceTo(npcs[j].g.position)); return m; }, refetch: evFetch, meat: (k: number) => { for (let i = 0; i < k; i++) { count++; evMeat(); } updHud(); }, hurt: (d: number) => hurt(d, '測試') };

/** 開場 loading：自頁面開啟起至少 1 秒，且等首幀畫完再淡出 */
function dismissBoot() {
  const el = document.getElementById('boot');
  if (!el || el.classList.contains('out')) return;
  const bootAt = (window as any).__bootAt ?? performance.now();
  const wait = Math.max(0, 1000 - (performance.now() - bootAt));
  setTimeout(() => {
    if (!el.isConnected || el.classList.contains('out')) return;
    el.classList.add('out');
    el.setAttribute('aria-busy', 'false');
    const bye = () => el.remove();
    el.addEventListener('transitionend', bye, { once: true });
    setTimeout(bye, 700);
  }, wait);
}
requestAnimationFrame(() => requestAnimationFrame(dismissBoot));

// 主畫面顯示目前金額
{ let last = -1; const tick = () => { const v = save.money ?? 0; if (v !== last) { last = v; for (const id of ['menuMoneyV', 'shopMoneyV']) { const e = document.getElementById(id); if (e) e.textContent = '$' + v.toLocaleString('zh-TW'); } } }; tick(); setInterval(tick, 400); }


// ── 糖果鍵按鈕：依文字標記角色（CSS 見 style.css 末段「糖果鍵」）──
{
  const P = /^(開始|再來|領取|購買|買|確定|兌換|進入)/, D = /^(放棄|刪除|重置|重設|清除|登出)/;
  const tag = (root: ParentNode) => root.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
    const t = (b.textContent ?? '').trim(), k = b.classList.contains('px') || b.classList.contains('gmX') || t === '✕' ? 'x' : D.test(t) ? 'danger' : P.test(t) ? 'primary' : '';
    if ((b.dataset.key ?? '') !== k) { if (k) b.dataset.key = k; else delete b.dataset.key; }
  });
  let q = 0; tag(document);
  new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; tag(document); }); }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

// 雜貨店表格 → 卡片：把表頭文字標到每格 data-label（CSS 依此排成卡片）
{
  const lab = () => document.querySelectorAll<HTMLTableElement>('#shopList table.kt').forEach(t => {
    const hs = Array.from(t.rows[0]?.querySelectorAll('th') ?? []).map(h => h.textContent?.trim() ?? '');
    if (hs.length) t.rows[0].classList.add('ktHead');
    Array.from(t.rows).forEach(r => Array.from(r.cells).forEach((c, i) => { if (c.tagName === 'TD' && hs[i] && !c.dataset.label) c.dataset.label = hs[i]; }));
  });
  const sl = document.getElementById('shopList');
  if (sl) { new MutationObserver(lab).observe(sl, { childList: true, subtree: true }); lab(); }
}

// ── 手機提示：按住蚵仔左右拖可以轉動 ──
const ROT_TIP_KEY = 'rotTipDragN';
let rotTipN = (() => { try { return +(localStorage.getItem(ROT_TIP_KEY) ?? 0) || 0; } catch { return 0; } })();
let rotTipIdle = 0, rotTipUsed = false, rotTipCounted = false, rotTipWasSeam = false;
const _rtv = new THREE.Vector3();
function rotTipEl() { let t = document.getElementById('rotTip'); if (!t) { t = document.createElement('div'); t.id = 'rotTip'; t.innerHTML = '<span class="rtHand"></span><span class="rtTxt">按住蚵仔左右拖，可以轉動</span>'; document.body.appendChild(t); } return t; }
function rotTipHide() { document.getElementById('rotTip')?.classList.remove('on'); }
function rotTipTouch() { rotTipUsed = true; rotTipHide(); }
function rotTipDragged() { if (rotTipCounted) return; rotTipCounted = true; rotTipN++; try { localStorage.setItem(ROT_TIP_KEY, String(rotTipN)); } catch { } }
function rotTipTick(dt: number) {
  if (!rotTipWasSeam) { rotTipIdle = 0; rotTipUsed = false; rotTipCounted = false; }
  rotTipWasSeam = true;
  if (!COARSE || rotTipUsed || (!tut && !mix.rotTip)) return;
  rotTipIdle += dt; if (!tut && rotTipIdle < 3) return;
  const t = rotTipEl(); oyster.getWorldPosition(_rtv).project(viewCam());
  t.style.left = `${(_rtv.x + 1) / 2 * innerWidth}px`; t.style.top = `${(1 - _rtv.y) / 2 * innerHeight}px`; t.classList.add('on');
}
setInterval(() => { if (phase !== 'seam') { rotTipWasSeam = false; rotTipHide(); } }, 200);
// ── 教學第 1 步（手機）：畫面滑動轉視角提示 ──
setInterval(() => {
  const on = COARSE && !!tut && TUT[tut.i].id === 'grab';
  let t = document.getElementById('lookTip');
  if (!t) { if (!on) return; t = document.createElement('div'); t.id = 'lookTip'; t.innerHTML = '<span class="ltHand"></span><span class="ltTxt">在畫面上滑動，可以轉動視角</span>'; document.body.appendChild(t); }
  t.classList.toggle('on', on);
}, 200);

// ── 廣場跳躍（先微蹲再跳；phase "jump" 同步；高度見 plazaJumpHeight）──
let jumpY = 0, jumpT = 0;
function plazaJump() { if (!(plazaMode || isRoomActive()) || !walking || jumpT > 0 || bodyPose === 'lie') return; if (bodyPose) setBodyPose(''); jumpT = PLAZA_JUMP_DUR; }
// ── 廣場蹲／躺（走動時才可用；用 phase "crouch"／"lie" 同步）──
let bodyPose: '' | 'crouch' | 'lie' = '';
let lastPose: 'crouch' | 'lie' = 'crouch';
let poseK = 0; // 0 站 → 1 完全蹲／躺（平滑過渡）
/** 廣場躺著時鎖住的身體朝向（鏡頭可用 yaw 繞轉／張望） */
let bodyYaw = 0;
function setBodyPose(p: '' | 'crouch' | 'lie') {
  if (plazaMode && walking) {
    if (p === 'lie' && bodyPose !== 'lie') bodyYaw = yaw;
    // 起來：鏡頭對回身體朝向，避免突然轉向；之後移動再慢慢帶轉
    if (bodyPose === 'lie' && p !== 'lie') { yaw = tYaw = bodyYaw; }
  }
  bodyPose = p; if (p) lastPose = p;
  walkTune.mul = p === 'crouch' ? 0.5 : 1;
  document.getElementById('crouchBtn')?.classList.toggle('act', p === 'crouch');
  document.getElementById('lieBtn')?.classList.toggle('act', p === 'lie');
}
function plazaPose(p: 'crouch' | 'lie') { if (!(plazaMode || isRoomActive()) || !walking || jumpT > 0) return; setBodyPose(bodyPose === p ? '' : p); }
{
  const poseBtn = document.getElementById('poseBtn');
  const setPoseOpen = (v: boolean) => {
    document.body.classList.toggle('poseOpen', v);
    poseBtn?.classList.toggle('open', v);
  };
  poseBtn?.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    setPoseOpen(!document.body.classList.contains('poseOpen'));
  });
  document.getElementById('jumpBtn')?.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); plazaJump(); });
  for (const [id, p] of [['crouchBtn', 'crouch'], ['lieBtn', 'lie']] as const)
    document.getElementById(id)?.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); plazaPose(p); });
  let last = performance.now();
  const step = () => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (jumpT > 0) { jumpT = Math.max(0, jumpT - dt); jumpY = jumpT > 0 ? plazaJumpHeight(PLAZA_JUMP_DUR - jumpT) : 0; }
    if (!(plazaMode || isRoomActive()) || !walking) { jumpT = 0; jumpY = 0; if (bodyPose) setBodyPose(''); }
    // 躺著時一動（方向鍵／搖桿）就起來
    if (bodyPose === 'lie') { let mv = Math.abs(joy.x) > 0.15 || Math.abs(joy.y) > 0.15; for (const c of walkKeys) if (/Key[WASD]|Arrow/.test(c)) mv = true; if (mv) setBodyPose(''); }
    poseK += ((bodyPose ? 1 : 0) - poseK) * Math.min(1, dt * 10);
    placeLookBtn();
    const pz = plazaMode && walking && state === 'play';
    if (!pz) setPoseOpen(false);
    on('poseBtn', pz); on('jumpBtn', pz); on('crouchBtn', pz); on('lieBtn', pz);
    if (pz && state === 'play') on('medBtn', true);
    // 手機：藥品鈕疊在動作鈕（或展開後最上方的躺）之上；跳／蹲／躺改由 CSS 排
    if (pz && COARSE) {
      const ar = poseBtn!.getBoundingClientRect();
      const open = document.body.classList.contains('poseOpen');
      const topEl = open ? document.getElementById('lieBtn')! : poseBtn!;
      const top = topEl.getBoundingClientRect();
      const med = document.getElementById('medBtn')!;
      if (state === 'play') {
        const s = med.style, b = innerHeight - top.top + 8;
        s.setProperty('position', 'fixed', 'important');
        s.setProperty('right', (innerWidth - ar.right) + 'px', 'important');
        s.setProperty('left', 'auto', 'important');
        s.setProperty('top', 'auto', 'important');
        s.setProperty('width', ar.width + 'px', 'important');
        s.setProperty('height', ar.height + 'px', 'important');
        s.setProperty('bottom', b + 'px', 'important');
        s.setProperty('z-index', '30', 'important');
      }
      (window as any).__mbFix = 1;
    } else if ((window as any).__mbFix) {
      (window as any).__mbFix = 0;
      const s = document.getElementById('medBtn')!.style;
      for (const k of ['position', 'right', 'left', 'top', 'width', 'height', 'bottom', 'z-index']) s.removeProperty(k);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
