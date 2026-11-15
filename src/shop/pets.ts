/** 寵物：剝蚵時的被動產出夥伴。只有一隻在線上，買了可開關 */
import * as THREE from 'three';
import { rbox } from '../core/geo';

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


function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(rbox(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** 阿康：方塊風格（與玩家／NPC 相同的圓角方塊），右耳少一截，捲尾、項圈；四隻腳可走步伐 */
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
  const sparkM = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const bodyG = new THREE.Group();
  bodyG.name = 'akangBody';
  // 長方身體：淺米黃背、白胸腹（對齊照片剪影）
  box(0.12, 0.10, 0.22, tanM, 0, 0.138, 0.02, bodyG);
  box(0.105, 0.055, 0.19, whiteM, 0, 0.09, 0.01, bodyG);
  box(0.095, 0.07, 0.07, whiteM, 0, 0.118, -0.08, bodyG);
  box(0.07, 0.05, 0.055, tanM, 0, 0.172, -0.105, bodyG);

  // 項圈：細褐金方塊帶＋小吊牌（不用環體）
  box(0.092, 0.016, 0.072, collarM, 0, 0.168, -0.105, bodyG);
  box(0.016, 0.012, 0.01, goldM, 0, 0.168, -0.142, bodyG);
  box(0.014, 0.018, 0.004, goldM, 0, 0.152, -0.148, bodyG);

  const headG = new THREE.Group();
  headG.name = 'akangHead';
  headG.position.set(0, 0.205, -0.148);
  box(0.10, 0.09, 0.09, tanM, 0, 0, 0, headG);
  box(0.055, 0.045, 0.06, tanM, 0, -0.012, -0.065, headG);
  box(0.022, 0.016, 0.016, darkM, 0, 0.0, -0.1, headG);
  box(0.038, 0.016, 0.022, mouthM, 0, -0.028, -0.088, headG);
  box(0.02, 0.008, 0.03, tongueM, 0, -0.032, -0.106, headG);
  for (const s of [-1, 1]) {
    box(0.022, 0.024, 0.008, darkM, s * 0.028, 0.014, -0.046, headG);
    box(0.007, 0.007, 0.004, sparkM, s * 0.024, 0.02, -0.051, headG);
  }

  // 立耳：薄方塊堆成錐形；右耳較短、耳尖外側缺一角
  const addEar = (x: number, notched: boolean) => {
    const eg = new THREE.Group();
    if (!notched) {
      box(0.03, 0.04, 0.016, tanM, 0, 0.02, 0, eg);
      box(0.02, 0.045, 0.014, tanM, 0, 0.058, 0, eg);
      box(0.016, 0.055, 0.004, pinkM, 0, 0.028, -0.008, eg);
    } else {
      box(0.03, 0.032, 0.016, tanM, 0, 0.016, 0, eg);
      // 上段偏內側，外側缺一截
      box(0.016, 0.022, 0.014, tanM, x > 0 ? -0.006 : 0.006, 0.04, 0, eg);
      box(0.016, 0.038, 0.004, pinkM, x > 0 ? -0.004 : 0.004, 0.022, -0.008, eg);
    }
    eg.position.set(x, 0.04, 0.0);
    eg.rotation.z = x > 0 ? -0.22 : 0.22;
    eg.rotation.y = x > 0 ? 0.12 : -0.12;
    headG.add(eg);
    return eg;
  };
  addEar(-0.042, false);
  addEar(0.042, true);

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

  // 捲尾：3–4 節方塊往上再彎到背上，內側偏白
  const tailG = new THREE.Group();
  tailG.position.set(0, 0.17, 0.13);
  const tailSegs: { pos: [number, number, number]; rotX: number; size: [number, number, number]; white?: boolean }[] = [
    { pos: [0, 0.008, 0.008], rotX: -0.4, size: [0.052, 0.042, 0.06] },
    { pos: [0, 0.04, 0.03], rotX: -1.05, size: [0.056, 0.044, 0.058] },
    { pos: [0, 0.078, 0.02], rotX: -1.95, size: [0.054, 0.042, 0.054], white: true },
    { pos: [0, 0.09, -0.028], rotX: -2.7, size: [0.046, 0.038, 0.05], white: true },
  ];
  for (const s of tailSegs) {
    const sg = new THREE.Group();
    sg.position.set(...s.pos);
    sg.rotation.x = s.rotX;
    box(s.size[0], s.size[1], s.size[2], tanM, 0, 0, 0, sg);
    if (s.white) box(s.size[0] * 0.72, s.size[1] * 0.45, s.size[2] * 0.85, whiteM, 0, -s.size[1] * 0.28, 0, sg);
    tailG.add(sg);
  }
  bodyG.add(tailG);
  g.add(bodyG);

  const makeLeg = (x: number, z: number, hind: boolean) => {
    const lg = new THREE.Group();
    lg.position.set(x, 0.12, z);
    const upper = box(0.032, 0.055, 0.036, hind ? whiteM : tanM, 0, -0.028, 0, lg);
    const lower = box(0.028, 0.05, 0.03, whiteM, 0, -0.076, 0, lg);
    const paw = box(0.034, 0.018, 0.046, whiteM, 0, -0.112, 0.006, lg);
    lg.userData.lower = lower;
    lg.userData.paw = paw;
    void upper;
    g.add(lg);
    return lg;
  };
  const legs = {
    fl: makeLeg(-0.048, -0.088, false),
    fr: makeLeg(0.048, -0.088, false),
    hl: makeLeg(-0.052, 0.09, true),
    hr: makeLeg(0.052, 0.09, true),
  };

  const restLegX = { fl: 0, fr: 0, hl: 0, hr: 0 };

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
    const k = 1 - Math.exp(-12 * st.dt);
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
      legs.fl.rotation.x = lerp(legs.fl.rotation.x, restLegX.fl, k);
      legs.fr.rotation.x = lerp(legs.fr.rotation.x, restLegX.fr, k);
      legs.hl.rotation.x = lerp(legs.hl.rotation.x, restLegX.hl, k);
      legs.hr.rotation.x = lerp(legs.hr.rotation.x, restLegX.hr, k);
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
