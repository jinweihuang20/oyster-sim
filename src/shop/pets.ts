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
  {
    id: 'pt_akang',
    n: '阿康',
    price: 3333,
    desc: '作者的狗狗，淺米黃的台灣犬混種，尾巴捲在背上，右耳少了一截。會跟著你，每 10 秒生出一塊簡單蚵仔肉丟進碗裡。超過 10 秒沒動作會睡著，動一下就會醒來繼續工作。',
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

export type PetAnimState = {
  /** 正在走動（四腳步伐）；false 則閒置或睡覺 */
  walk: boolean;
  /** 走路速度（公尺／秒），用來調步伐快慢 */
  speed: number;
  sleep: boolean;
  dt: number;
};

/** 坐著時是否站在頭上（阿康改站腳邊，蚵仔寶寶維持頭上） */
export function petRidesHead(id: string | null | undefined): boolean {
  return id === 'pt_oyster_baby';
}

/** 場景裡的縮放：蚵仔寶寶較小以免擋頭，阿康站腳邊用原尺寸 */
export function petWorldScale(id: string | null | undefined): number {
  return id === 'pt_akang' ? 1 : 0.7;
}

/** 商店／預覽鏡頭：讓不同體型都框得剛好 */
export function petPreviewFrame(id: string): { pos: THREE.Vector3; look: THREE.Vector3; fov: number; dist?: number } {
  if (id === 'pt_akang') {
    return { pos: new THREE.Vector3(0.18, 0.2, 0.72), look: new THREE.Vector3(0, 0.13, 0), fov: 32 };
  }
  return { pos: new THREE.Vector3(0, 0.17, 0.95), look: new THREE.Vector3(0, 0.13, 0), fov: 30 };
}

export function petThumbFrame(id: string): { pos: THREE.Vector3; look: THREE.Vector3; fov: number } {
  if (id === 'pt_akang') {
    return { pos: new THREE.Vector3(0.16, 0.18, 0.62), look: new THREE.Vector3(0, 0.12, 0), fov: 34 };
  }
  return { pos: new THREE.Vector3(0, 0.17, 0.78), look: new THREE.Vector3(0, 0.13, 0), fov: 32 };
}

/** 依 id 建立寵物模型；未知 id 回 null */
export function makePet(id: string): THREE.Group | null {
  if (id === 'pt_oyster_baby') return makeOysterBaby();
  if (id === 'pt_akang') return makeAkang();
  return null;
}

export function tickPetAnim(mesh: THREE.Group, st: PetAnimState) {
  const fn = mesh.userData.tickAnim as ((m: THREE.Group, s: PetAnimState) => void) | undefined;
  fn?.(mesh, st);
}

function stdMat(color: number, extra?: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.04, ...extra });
}

function makeEarGeo(notched: boolean): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  if (!notched) {
    s.moveTo(0, 0);
    s.lineTo(0.03, 0.008);
    s.lineTo(0, 0.082);
    s.lineTo(-0.03, 0.008);
    s.closePath();
  } else {
    // 右耳較短，耳尖缺一角（從外側切掉一塊）
    s.moveTo(0, 0);
    s.lineTo(0.03, 0.008);
    s.lineTo(0.02, 0.03);
    s.lineTo(0.032, 0.026);
    s.lineTo(0.006, 0.05);
    s.lineTo(-0.024, 0.012);
    s.closePath();
  }
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.01);
  return geo;
}

/** 阿康：淺米黃台灣犬混種，右耳少一截，捲尾、項圈；四隻腳可走步伐 */
export function makeAkang(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pet_akang';
  const tan = 0xe2c28a;
  const white = 0xf4efe6;
  const earIn = 0xe8b4a8;
  const dark = 0x1a1a1a;
  const tongueCol = 0xe8899a;
  const collarBr = 0x8b5a2b;
  const collarGold = 0xc9a05a;
  const mouthCol = 0x3a1a18;
  const tanM = stdMat(tan);
  const whiteM = stdMat(white);
  const darkM = stdMat(dark, { roughness: 0.3, metalness: 0.2 });
  const pinkM = stdMat(earIn, { roughness: 0.45 });
  const tongueM = stdMat(tongueCol, { roughness: 0.4 });
  const collarM = stdMat(collarBr, { roughness: 0.5, metalness: 0.15 });
  const goldM = stdMat(collarGold, { roughness: 0.35, metalness: 0.55 });
  const mouthM = stdMat(mouthCol, { roughness: 0.5 });

  const bodyG = new THREE.Group();
  bodyG.name = 'akangBody';
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 12), tanM);
  torso.scale.set(1.25, 0.95, 1.55);
  torso.position.set(0, 0.125, 0.02);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), whiteM);
  chest.scale.set(1.05, 0.9, 1.4);
  chest.position.set(0, 0.095, -0.02);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), tanM);
  haunch.scale.set(1.35, 1.05, 1.15);
  haunch.position.set(0, 0.12, 0.085);
  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), tanM);
  neck.scale.set(1.05, 1.1, 1.2);
  neck.position.set(0, 0.175, -0.09);
  bodyG.add(torso, chest, haunch, neck);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 20), collarM);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.172, -0.1);
  bodyG.add(collar);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.008), goldM);
  buckle.position.set(0, 0.172, -0.15);
  bodyG.add(buckle);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.003), goldM);
  tag.position.set(0, 0.155, -0.155);
  bodyG.add(tag);

  const headG = new THREE.Group();
  headG.name = 'akangHead';
  headG.position.set(0, 0.205, -0.135);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), tanM);
  head.scale.set(0.95, 0.92, 1.05);
  headG.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), tanM);
  muzzle.scale.set(0.95, 0.75, 1.25);
  muzzle.position.set(0, -0.012, -0.048);
  headG.add(muzzle);
  const muzzleW = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), whiteM);
  muzzleW.scale.set(1, 0.7, 1.1);
  muzzleW.position.set(0, -0.02, -0.058);
  headG.add(muzzleW);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), darkM);
  nose.position.set(0, -0.006, -0.088);
  headG.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), mouthM);
  mouth.scale.set(1.15, 0.55, 0.8);
  mouth.position.set(0, -0.028, -0.07);
  headG.add(mouth);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), tongueM);
  tongue.scale.set(0.9, 0.45, 1.65);
  tongue.position.set(0, -0.033, -0.084);
  headG.add(tongue);
  const eyeGeo = new THREE.SphereGeometry(0.011, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, darkM);
  const eyeR = new THREE.Mesh(eyeGeo, darkM);
  eyeL.position.set(-0.022, 0.012, -0.05);
  eyeR.position.set(0.022, 0.012, -0.05);
  eyeL.scale.set(1, 1.1, 0.7);
  eyeR.scale.set(1, 1.1, 0.7);
  headG.add(eyeL, eyeR);
  const sparkM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sL = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 5), sparkM);
  const sR = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 5), sparkM);
  sL.position.set(-0.025, 0.016, -0.058);
  sR.position.set(0.019, 0.016, -0.058);
  headG.add(sL, sR);

  const addEar = (x: number, notched: boolean) => {
    const eg = new THREE.Group();
    const geo = makeEarGeo(notched);
    const ear = new THREE.Mesh(geo, tanM);
    const inner = new THREE.Mesh(geo.clone(), pinkM);
    inner.scale.set(0.72, 0.72, 0.45);
    inner.position.z = 0.0035;
    eg.add(ear, inner);
    eg.position.set(x, 0.032, 0.006);
    eg.rotation.z = x > 0 ? -0.28 : 0.28;
    eg.rotation.y = x > 0 ? 0.15 : -0.15;
    headG.add(eg);
    return eg;
  };
  addEar(-0.03, false);
  addEar(0.03, true);

  const zMat = new THREE.MeshBasicMaterial({ color: 0xc8d4e8, transparent: true, opacity: 0.9 });
  const sleepG = new THREE.Group(); sleepG.name = 'petSleep';
  const z1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.005), zMat);
  z1.position.set(0.07, 0.1, -0.02);
  const z2 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.005), zMat);
  z2.position.set(0.1, 0.13, -0.02);
  sleepG.add(z1, z2);
  sleepG.visible = false;
  headG.add(sleepG);
  bodyG.add(headG);

  const tailG = new THREE.Group();
  tailG.position.set(0, 0.145, 0.13);
  const tailPts: [number, number, number, number, THREE.Material][] = [
    [0, 0.00, 0.00, 0.028, tanM],
    [0, 0.04, 0.025, 0.03, tanM],
    [0, 0.085, 0.03, 0.032, tanM],
    [0, 0.12, 0.005, 0.03, tanM],
    [0, 0.125, -0.04, 0.026, tanM],
    [0, 0.1, -0.075, 0.022, whiteM],
  ];
  for (const [x, y, z, r, m] of tailPts) {
    const sph = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
    sph.position.set(x, y, z);
    tailG.add(sph);
  }
  g.add(bodyG);
  bodyG.add(tailG);

  const makeLeg = (x: number, z: number, hind: boolean) => {
    const lg = new THREE.Group();
    lg.position.set(x, 0.118, z);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), hind ? whiteM : tanM);
    upper.scale.set(0.85, 1.75, 0.9);
    upper.position.set(0, -0.038, 0);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), whiteM);
    lower.scale.set(0.8, 1.55, 0.85);
    lower.position.set(0, -0.078, 0);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), whiteM);
    paw.scale.set(1.05, 0.72, 1.15);
    paw.position.set(0, -0.118, 0.008);
    lg.add(upper, lower, paw);
    lg.userData.lower = lower;
    lg.userData.paw = paw;
    g.add(lg);
    return lg;
  };
  const legs = {
    fl: makeLeg(-0.05, -0.085, false),
    fr: makeLeg(0.05, -0.085, false),
    hl: makeLeg(-0.055, 0.09, true),
    hr: makeLeg(0.055, 0.09, true),
  };

  const rest: {
    bodyY: number; bodyX: number; bodyZ: number;
    headX: number; tailY: number;
    legX: Record<string, number>;
  } = {
    bodyY: 0, bodyX: 0, bodyZ: 0, headX: 0, tailY: 0,
    legX: { fl: 0, fr: 0, hl: 0, hr: 0 },
  };

  const tickAnim = (_m: THREE.Group, st: PetAnimState) => {
    const ud = g.userData as { t?: number; phase?: number };
    ud.t = (ud.t ?? 0) + st.dt;
    if (st.sleep) {
      sleepG.visible = true;
      bodyG.position.y = -0.042;
      bodyG.rotation.x = 0.18;
      bodyG.rotation.z = 0;
      headG.rotation.x = 0.4;
      const tuck = 1.05;
      legs.fl.rotation.x = tuck;
      legs.fr.rotation.x = tuck;
      legs.hl.rotation.x = tuck * 0.85;
      legs.hr.rotation.x = tuck * 0.85;
      tailG.rotation.y = Math.sin((ud.t) * 1.2) * 0.06;
      return;
    }
    sleepG.visible = false;
    const lerp = (cur: number, to: number, k: number) => cur + (to - cur) * k;
    const k = 1 - Math.exp(-Math.min(20, 12) * st.dt);
    if (st.walk) {
      const spd = Math.max(0.7, st.speed);
      ud.phase = (ud.phase ?? 0) + st.dt * spd * 5.6;
      const a = Math.sin(ud.phase);
      const b = Math.sin(ud.phase + Math.PI);
      const swing = 0.55;
      legs.fl.rotation.x = a * swing;
      legs.hr.rotation.x = a * swing;
      legs.fr.rotation.x = b * swing;
      legs.hl.rotation.x = b * swing;
      bodyG.position.y = Math.abs(Math.sin(ud.phase * 2)) * 0.012;
      bodyG.rotation.z = a * 0.05;
      bodyG.rotation.x = 0.04;
      headG.rotation.x = -0.06;
      tailG.rotation.y = Math.sin(ud.phase * 2.2) * 0.4;
    } else {
      const br = Math.sin((ud.t) * 2.2);
      bodyG.position.y = lerp(bodyG.position.y, br * 0.006, k);
      bodyG.rotation.z = lerp(bodyG.rotation.z, 0, k);
      bodyG.rotation.x = lerp(bodyG.rotation.x, 0, k);
      headG.rotation.x = lerp(headG.rotation.x, br * 0.03, k);
      legs.fl.rotation.x = lerp(legs.fl.rotation.x, rest.legX.fl, k);
      legs.fr.rotation.x = lerp(legs.fr.rotation.x, rest.legX.fr, k);
      legs.hl.rotation.x = lerp(legs.hl.rotation.x, rest.legX.hl, k);
      legs.hr.rotation.x = lerp(legs.hr.rotation.x, rest.legX.hr, k);
      tailG.rotation.y = Math.sin((ud.t) * 5) * 0.28;
    }
  };

  g.userData.sleep = sleepG;
  g.userData.body = bodyG;
  g.userData.head = headG;
  g.userData.tail = tailG;
  g.userData.legs = legs;
  g.userData.tickAnim = tickAnim;
  g.userData.groundPet = true;
  g.userData.worldScale = 1;
  return g;
}
