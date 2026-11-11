/** 寵物：剝蚵時的被動產出夥伴。只有一隻在線上，買了可開關 */
import * as THREE from 'three';

export type PetFx = {
  /** 每多少秒給一塊肉 */
  tickSec: number;
  /** 一次給的顆數（之後擴充，目前都 1） */
  perTick: number;
  /** 肉的難度（對應 eco.dpay index）：0=簡單 */
  meatDiff: 0 | 1 | 2 | 3;
};
export type Pet = {
  id: string;
  n: string;
  price: number;
  desc: string;
  /** 短效果字串（寫在卡片上給玩家看） */
  eff: string;
  fx: PetFx;
};

/** 已上架的寵物。新增新寵物在這裡加一筆即可 */
export const PETS: Pet[] = [
  {
    id: 'pt_oyster_baby',
    n: '🥟 蚵仔寶寶',
    price: 3000,
    desc: '剛孵化的小蚵仔，會跟著你每 10 秒生出一塊簡單蚵仔肉丟進碗裡。你站著不動超過 10 秒牠會睡著，動一下才會醒過來繼續工作。',
    eff: '每 10 秒碗裡 +1 塊簡單蚵仔肉（掛機自動暫停）',
    fx: { tickSec: 10, perTick: 1, meatDiff: 0 },
  },
];

export const defaultPetId = 'pt_oyster_baby';
export const findPet = (id: string | undefined | null): Pet | undefined =>
  id ? PETS.find(p => p.id === id) : undefined;

/** 建立蚵仔寶寶模型：圓胖奶白身＋大眼＋粉頰＋小嘴＋兩隻小手兩隻小腳＋張開的扇形貝殼底座（參考 Q 版蚵仔娃娃） */
export function makeOysterBaby(): THREE.Group {
  const g = new THREE.Group();
  const cream = 0xfaf1e4; // 奶白
  const shellColor = 0xece2cf; // 殼色略帶米黃
  const ridgeColor = 0x5a4a3a; // 殼邊紋路深色
  const cheek = 0xf0a6a6; // 粉紅頰
  const mouthCol = 0x3a1a18; // 嘴巴深褐
  const eyeCol = 0x111111;
  // ─ 貝殼：底盤（寶寶坐在這）＋後方扇形背板（整片）
  const shellMat = new THREE.MeshStandardMaterial({
    color: shellColor, roughness: 0.6, metalness: 0.04,
    flatShading: true, side: THREE.DoubleSide,
  });
  void ridgeColor;
  // 底盤：扁盤形（寶寶坐這）
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  bot.scale.set(1.0, 0.22, 1.0);
  bot.position.y = 0.012;
  bot.rotation.x = Math.PI;
  g.add(bot);
  // 背景扇形貝殼：單一片半球幾何（phi 11 段 + flatShading 自然產生扇形稜紋）
  // phi 0..π 只取半邊，形成 D 形殼面，往身體後方彎曲
  const back = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 11, 3, 0, Math.PI, 0, Math.PI / 2),
    shellMat,
  );
  back.scale.set(1.1, 1.1, 0.55); // 加寬、加高、壓扁深度 → 像扇面不是圓罩
  back.position.set(0, 0.012, 0.09);
  g.add(back);
  // ─ 身體：圓胖奶白球（微扁橢圓）
  const bodyMat = new THREE.MeshStandardMaterial({ color: cream, roughness: 0.45, metalness: 0.05, emissive: 0x2a1a14, emissiveIntensity: 0.05 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), bodyMat);
  body.scale.set(1.0, 0.95, 1.0);
  body.position.y = 0.11;
  g.add(body);
  // ─ 兩隻小手（身體兩側小橢球）
  const limb = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), bodyMat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m;
  };
  limb(-0.1, 0.08, 0.02, 1.0, 1.1, 0.9); // 左手
  limb(0.1, 0.08, 0.02, 1.0, 1.1, 0.9);  // 右手
  // 兩隻小腳
  limb(-0.055, 0.03, 0.07, 0.95, 0.75, 1.3); // 左腳
  limb(0.055, 0.03, 0.07, 0.95, 0.75, 1.3);  // 右腳
  // ─ 眼睛：大黑眼＋白色高光
  const eyeMat = new THREE.MeshStandardMaterial({ color: eyeCol, roughness: 0.25, metalness: 0.3 });
  const eyeGeo = new THREE.SphereGeometry(0.025, 14, 10);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.035, 0.145, -0.088);
  eyeR.position.set(0.035, 0.145, -0.088);
  eyeL.scale.set(0.9, 1.1, 0.7);
  eyeR.scale.set(0.9, 1.1, 0.7);
  g.add(eyeL, eyeR);
  // 眼睛高光（大＋小 兩顆）
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sparkBig = new THREE.SphereGeometry(0.008, 8, 6);
  const sparkSm = new THREE.SphereGeometry(0.0045, 6, 5);
  const sL = new THREE.Mesh(sparkBig, sparkMat); sL.position.set(-0.042, 0.153, -0.108);
  const sR = new THREE.Mesh(sparkBig, sparkMat); sR.position.set(0.028, 0.153, -0.108);
  const sL2 = new THREE.Mesh(sparkSm, sparkMat); sL2.position.set(-0.03, 0.14, -0.108);
  const sR2 = new THREE.Mesh(sparkSm, sparkMat); sR2.position.set(0.04, 0.14, -0.108);
  g.add(sL, sR, sL2, sR2);
  // ─ 粉頰（兩個扁橢圓）
  const cheekMat = new THREE.MeshBasicMaterial({ color: cheek, transparent: true, opacity: 0.85 });
  const cheekGeo = new THREE.SphereGeometry(0.014, 10, 8);
  const cL = new THREE.Mesh(cheekGeo, cheekMat); cL.position.set(-0.07, 0.11, -0.085); cL.scale.set(1.0, 0.55, 0.3); g.add(cL);
  const cR = new THREE.Mesh(cheekGeo, cheekMat); cR.position.set(0.07, 0.11, -0.085); cR.scale.set(1.0, 0.55, 0.3); g.add(cR);
  // ─ 小嘴（微笑 U 形 ≈ 扁 Torus 片段近似）
  const mouthMat = new THREE.MeshStandardMaterial({ color: mouthCol, roughness: 0.4 });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0035, 6, 12, Math.PI), mouthMat);
  mouth.rotation.set(Math.PI, 0, 0);
  mouth.position.set(0, 0.11, -0.104);
  g.add(mouth);
  // ─ 睡覺符號（預設隱藏，掛機時顯示）
  const zMat = new THREE.MeshBasicMaterial({ color: 0xc8d4e8, transparent: true, opacity: 0.9 });
  const sleepG = new THREE.Group(); sleepG.name = 'petSleep';
  const z1 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.005), zMat);
  z1.position.set(0.09, 0.26, -0.05);
  const z2 = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.005), zMat);
  z2.position.set(0.12, 0.3, -0.05);
  sleepG.add(z1, z2);
  sleepG.visible = false;
  g.add(sleepG);
  g.userData.sleep = sleepG;
  g.userData.body = body;
  g.userData.shell = bot;
  g.name = 'pet_oyster_baby';
  return g;
}
