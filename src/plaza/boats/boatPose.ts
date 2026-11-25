/** 船上／水裡的人物姿勢（自己和遠端共用）：坐駕駛座握舵柄、坐冰桶、坐甲板、游泳。 */
import { placePlazaArmChain, posePlazaSmokeSit, type PlayerRig, type SmokeSitPoseOpts } from '../../dm/character';

export type RiderPose = 'drive' | 'sit' | 'deck' | 'swim';

function armTo(rig: PlayerRig, side: number, hx: number, hy: number, hz: number, bendOut = 0.1) {
  const sx = side * 0.22, sy = 0.33, sz = 0;
  const ex = (sx + hx) / 2 + side * bendOut, ey = (sy + hy) / 2 - 0.1, ez = (sz + hz) / 2 + 0.04;
  placePlazaArmChain(side < 0 ? rig.upperL : rig.upperR, side < 0 ? rig.lowerL : rig.lowerR, sx, sy, sz, ex, ey, ez, hx, hy, hz);
}

/**
 * 套姿勢（只動關節）。回傳外框要加的 y（相對座位點／水面）與前傾 rx。
 * steer：-1～1 轉彎時身體傾；sway：0～1 被打中晃；throwK：0～1 丟殼甩臂
 */
export type RiderOpts = { steer?: number; sway?: number; throwK?: number; smoke?: SmokeSitPoseOpts | null; /** 游泳：0＝原地踩水、1＝自由式前進（呼叫端平滑） */ swim?: number };
/**
 * smoke：在船上抽菸＝跟吸菸區同一套坐姿抽菸（右手夾菸、抽一口舉到嘴邊）；
 * 駕駛改用左手握舵柄，乘客左手照船上姿勢放。游泳不能抽。
 */
export function poseRider(rig: PlayerRig, pose: RiderPose, t: number, o: RiderOpts = {}) {
  const steer = o.steer ?? 0, sway = o.sway ?? 0, thr = o.throwK ?? 0;
  rig.weaponMount.visible = false; rig.handL.visible = false; rig.handR.visible = false;
  rig.root.position.set(0, 0, 0);
  rig.legL.rotation.z = 0.08; rig.legR.rotation.z = -0.08;
  const swayZ = sway * Math.sin(t * 16) * 0.22, swayX = sway * 0.3;
  if (pose === 'swim') return poseSwim(rig, t, o.swim ?? 0, swayX, swayZ);
  const smoke = o.smoke ?? null;
  let smokeHeadX = 0;
  // 軀幹基準高度（抽菸吸氣會往上加一點，要每幀從基準算，不然越疊越高）
  const torsoY = (rig.torso.userData.boatBaseY ??= rig.torso.position.y) as number;
  rig.torso.position.y = torsoY;
  if (smoke) {
    posePlazaSmokeSit(rig, smoke);
    rig.root.position.set(0, 0, 0);
    smokeHeadX = rig.head.rotation.x;
    rig.weaponMount.visible = false; rig.handL.visible = false; rig.handR.visible = false;
  }
  // 坐姿腿：駕駛座／冰桶＝小腿垂下；甲板＝腿伸直往前
  const deck = pose === 'deck';
  for (const th of [rig.legL, rig.legR]) th.rotation.x = 1.5;
  for (const sh of [rig.shinL, rig.shinR]) sh.rotation.set(deck ? -0.08 : -1.42, 0, 0);
  if (smoke) {
    // 右手交給抽菸姿勢；左手：駕駛＝往右後方握舵柄，甲板＝撐甲板，冰桶＝放大腿（抽菸姿勢原樣）
    if (pose === 'drive') armTo(rig, -1, 0.02, -0.16, 0.3 + steer * 0.08, 0.14);
    else if (deck) armTo(rig, -1, -0.34, -0.36, 0.05, 0.04);
  } else if (pose === 'drive') {
    // 右手往後下握舵柄、左手放膝上
    armTo(rig, 1, 0.36, -0.12, 0.18 + steer * 0.08, 0.12);
    armTo(rig, -1, -0.26, -0.05, -0.42, 0.05);
  } else if (deck) {
    // 手撐在身體兩側的甲板上
    armTo(rig, -1, -0.34, -0.36, 0.05, 0.04);
    armTo(rig, 1, 0.34, -0.36, 0.05, 0.04);
  } else {
    armTo(rig, -1, -0.2, -0.08, -0.4, 0.05);
    armTo(rig, 1, 0.2, -0.08, -0.4, 0.05);
  }
  if (thr > 0) {
    // 丟殼：右手從肩後往前甩
    const f = Math.sin(Math.PI * thr);
    armTo(rig, 1, 0.24, 0.45 + 0.2 * f, 0.15 - 0.6 * (1 - thr), 0.08);
  }
  rig.torso.rotation.set(-0.1 + swayX, steer * -0.25, -steer * 0.2 + swayZ);
  // 抽菸時頭的俯仰交給抽菸姿勢（菸要對準嘴）
  rig.head.rotation.set(smoke ? smokeHeadX : 0.04, steer * -0.35, 0);
  return { dy: 0.07 - 0.72, rx: 0 };
}

/** 自由式時身體幾乎水平（外框繞 X 軸前趴；臉朝下、背朝上）；踩水時接近直立 */
export const SWIM_RX = -1.42, TREAD_RX = -0.22;
/**
 * 游泳時寵物站的位置（人物外框座標）：自由式＝背的中間（軀幹 y≈1.1、背面 z≈+0.17）；
 * 踩水（人幾乎直立、只露頭）＝站在頭頂（跟坐著同一套：寵物原點 1.44），不然會泡在水裡
 */
export function swimPetSpot(k: number, groundPet = false) {
  k = Math.max(0, Math.min(1, k));
  // 貼地型寵物（阿康）模型原點就在腳底，要再壓低一點才會踩在背上
  const g = groundPet ? 0.08 : 0;
  return { y: lerp(1.44 + (groundPet ? 0.1 : 0), 1.06, k), z: lerp(-0.06, 0.17 - g, k) };
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const _h = [0, 0, 0], _e = [0, 0, 0];
/**
 * 游泳：k＝0 原地踩水（頭露出水面、雙手在身前慢慢划、腿慢慢踩）；k＝1 自由式（身體水平臉朝下、
 * 左右手輪流過頭划水、打水、每兩次划手往右側轉頭換氣）。中間平滑混合，不會跳。只動關節，不加 draw call。
 */
function poseSwim(rig: PlayerRig, t: number, k: number, swayX: number, swayZ: number) {
  k = Math.max(0, Math.min(1, k));
  const cyc = t * 1.35 * Math.PI * 2 / 2.2; // 一次完整划手（左右各一下）≈ 1.6 秒
  // 換氣：每兩個划手循環轉頭一次（右手划到後半時轉頭、回到前方前轉回）
  const br = Math.sin(cyc / 2) > 0 ? Math.max(0, Math.sin(cyc - 0.4)) : 0;
  // 身體沿長軸滾動（跟著划手），踩水時不滾
  const roll = Math.sin(cyc) * 0.38 * k;
  for (const side of [-1, 1]) {
    // 自由式手的路徑（軀幹座標：+y＝往頭頂前伸、−z＝肚子那面＝水下、+z＝背那面＝出水）
    // φ 0→π：前伸 → 水下拉 → 推到大腿；π→2π：手肘高高出水往前還原
    const ph = cyc + (side < 0 ? Math.PI : 0);
    const c = Math.cos(ph), sn = Math.sin(ph);
    const pull = sn > 0;
    const fx = side * (0.2 + (pull ? 0.02 : 0.1 * -sn)), fy = 0.33 + 0.46 * c, fz = pull ? -0.36 * sn : 0.3 * -sn;
    const fex = side * (0.3 + (pull ? 0 : 0.12 * -sn)), fey = 0.33 + 0.24 * c, fez = pull ? -0.24 * sn : 0.34 * -sn;
    // 踩水：雙手在胸前水平畫小圈（掌心向下慢慢搖）
    const tp = t * 2.1 + (side < 0 ? 0 : Math.PI);
    const tx = side * (0.32 + 0.08 * Math.sin(tp)), ty = 0.22 + 0.03 * Math.cos(tp), tz = -0.3 - 0.07 * Math.cos(tp);
    const tex = side * 0.36, tey = 0.2, tez = -0.12;
    _h[0] = lerp(tx, fx, k); _h[1] = lerp(ty, fy, k); _h[2] = lerp(tz, fz, k);
    _e[0] = lerp(tex, fex, k); _e[1] = lerp(tey, fey, k); _e[2] = lerp(tez, fez, k);
    placePlazaArmChain(side < 0 ? rig.upperL : rig.upperR, side < 0 ? rig.lowerL : rig.lowerR, side * 0.22, 0.33, 0, _e[0], _e[1], _e[2], _h[0], _h[1], _h[2]);
  }
  // 腿：自由式＝快速小幅上下打水（一次划手打 6 下）；踩水＝慢慢交替踩
  const kick = Math.sin(cyc * 3), tread = Math.sin(t * 2.4);
  rig.legL.rotation.set(lerp(0.3 + tread * 0.28, kick * 0.26, k), 0, lerp(0.14, 0.05, k));
  rig.legR.rotation.set(lerp(0.3 - tread * 0.28, -kick * 0.26, k), 0, lerp(-0.14, -0.05, k));
  rig.shinL.rotation.set(lerp(-0.55 - Math.max(0, tread) * 0.35, -0.12 - Math.max(0, -kick) * 0.22, k), 0, 0);
  rig.shinR.rotation.set(lerp(-0.55 - Math.max(0, -tread) * 0.35, -0.12 - Math.max(0, kick) * 0.22, k), 0, 0);
  rig.torso.rotation.set(swayX, roll, swayZ);
  // 頭：踩水看前方；自由式臉朝下微看前，換氣時往側邊轉出水面
  rig.head.rotation.set(lerp(0.05, 0.28, k), lerp(0, 1.15 * br, k) - roll * 0.6, 0);
  const bob = Math.sin(t * 2.4) * lerp(0.035, 0.015, k);
  return { dy: lerp(-1.12, -0.24, k) + bob, rx: lerp(TREAD_RX, SWIM_RX, k) };
}
