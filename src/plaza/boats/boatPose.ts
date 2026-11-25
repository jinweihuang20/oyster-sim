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
export type RiderOpts = { steer?: number; sway?: number; throwK?: number; smoke?: SmokeSitPoseOpts | null };
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
  if (pose === 'swim') {
    const ph = t * 4.2;
    rig.legL.rotation.set(0.25 + Math.sin(ph * 1.6) * 0.35, 0, 0.1);
    rig.legR.rotation.set(0.25 - Math.sin(ph * 1.6) * 0.35, 0, -0.1);
    rig.shinL.rotation.set(0.35, 0, 0); rig.shinR.rotation.set(0.35, 0, 0);
    // 蛙式：雙手在胸前往外畫圈
    const a = Math.sin(ph), b = Math.cos(ph);
    armTo(rig, -1, -0.18 - 0.2 * (1 + a) * 0.5, 0.28 + 0.06 * b, -0.42 - 0.12 * b, 0.12);
    armTo(rig, 1, 0.18 + 0.2 * (1 + a) * 0.5, 0.28 + 0.06 * b, -0.42 - 0.12 * b, 0.12);
    rig.torso.rotation.set(0.15 + swayX, 0, swayZ);
    rig.head.rotation.set(-0.55, 0, 0);
    return { dy: -1.12 + Math.sin(t * 2.4) * 0.04, rx: -0.85 };
  }
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
