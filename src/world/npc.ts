import * as THREE from 'three';
import { rboxNpc } from '../core/geo';

export type NpcMeshDeps = {
  mat: (c: number, o?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  mesh: (g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], parent?: THREE.Object3D) => THREE.Mesh;
  skin: number;
};

export type YardLook = 'ama' | 'ama2' | 'agong' | 'dajie' | 'fisher';

export type YardNpcMesh = {
  g: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  pants: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  armL: THREE.Group;
  armR: THREE.Group;
  hairTop: THREE.Mesh;
  hairBack: THREE.Mesh;
  bun: THREE.Mesh;
};

/**
 * 工寮 NPC：與玩家同款圓角方塊（偏胖）＋方塊頭；
 * 髮塊／包髻給 dressYardNpc 依角色開關。
 */
export function makeAma(top: number, hair: number, D: NpcMeshDeps): YardNpcMesh {
  const { mat, mesh, skin } = D;
  const g = new THREE.Group();
  const bodyM = mat(top);
  const pants = mat(0x3a5068);
  // 臉／頸／手專用：絕不可與前臂共用，否則上衫色會整臉變色
  const skinM = mat(skin);
  const hairM = mat(hair);
  const sole = mat(0xf6f2ea);
  const strap = mat(0x3a6fc0);

  // 整體抬高，椅腳貼地、人不要沉進地板（對齊玩家凳面約 y0.4）
  const Y = 0.12;
  mesh(rboxNpc(0.34, 0.08, 0.34), mat(0xd45a4a), [0, 0.28 + Y, 0.02], g);
  for (const [x, z] of [[0.11, 0.11], [-0.11, 0.11], [0.11, -0.11], [-0.11, -0.11]] as const) {
    mesh(rboxNpc(0.04, 0.28 + Y, 0.04), mat(0xb84838), [x, (0.28 + Y) / 2, z], g);
  }

  const body = mesh(rboxNpc(0.5, 0.44, 0.32), bodyM, [0, 0.66 + Y, 0.02], g);
  mesh(rboxNpc(0.14, 0.07, 0.14), skinM, [0, 0.92 + Y, 0.01], g);
  mesh(rboxNpc(0.5, 0.14, 0.44), pants, [0, 0.38 + Y, -0.12], g);
  const shinG = rboxNpc(0.12, 0.28, 0.12);
  for (const sx of [-0.12, 0.12]) {
    mesh(shinG, pants, [sx, 0.18 + Y, -0.34], g);
    mesh(rboxNpc(0.05, 0.05, 0.05), skinM, [sx, 0.06 + Y, -0.36], g);
    mesh(rboxNpc(0.11, 0.04, 0.2), sole, [sx, 0.03 + Y, -0.4], g);
    mesh(rboxNpc(0.11, 0.03, 0.035), strap, [sx, 0.055 + Y, -0.46], g);
    mesh(rboxNpc(0.06, 0.045, 0.055), skinM, [sx, 0.045 + Y, -0.48], g);
  }

  const head = new THREE.Group(); head.position.set(0, 1.06 + Y, 0.02); g.add(head);
  mesh(rboxNpc(0.3, 0.3, 0.3), skinM, [0, 0, 0], head);
  for (const s of [-1, 1]) mesh(rboxNpc(0.042, 0.08, 0.052), skinM, [s * 0.172, 0.0, 0.01], head);
  const hairTop = mesh(rboxNpc(0.32, 0.1, 0.32), hairM, [0, 0.12, 0], head);
  const hairBack = mesh(rboxNpc(0.32, 0.12, 0.1), hairM, [0, 0.02, 0.12], head);
  const bun = mesh(rboxNpc(0.14, 0.12, 0.14), hairM, [0, 0.14, 0.16], head);
  for (const s of [-1, 1]) mesh(rboxNpc(0.055, 0.055, 0.006), mat(0x111111), [s * 0.075, 0.02, -0.155], head);
  mesh(rboxNpc(0.11, 0.035, 0.006), mat(0xa04040), [0, -0.08, -0.155], head);

  // 手臂：沿本地 -Y 串接；肩 group.rotation.x 控制抬臂
  // 0=垂下，≈1.05=前下剝蚵，≈2.6=向上舉
  // 蚵／刀掛在手附近：本地 (0, -0.42, 0)
  const arm = (s: number) => {
    const p = new THREE.Group();
    p.position.set(s * 0.26, 0.82 + Y, -0.02);
    p.rotation.x = 1.05;
    g.add(p);
    const upper = mesh(rboxNpc(0.1, 0.2, 0.1), mat(top), [0, -0.1, 0], p);
    upper.userData.yardSleeveMesh = 1;
    const fore = mesh(rboxNpc(0.085, 0.18, 0.085), mat(skin), [0, -0.28, 0], p);
    fore.userData.yardForearm = 1;
    const hand = mesh(rboxNpc(0.095, 0.09, 0.1), skinM, [0, -0.4, 0], p);
    hand.userData.yardHand = 1;
    return p;
  };
  return { g, body, head, pants, armL: arm(-1), armR: arm(1), hairTop, hairBack, bun };
}

function clearAcc(parent: THREE.Object3D, key: string) {
  const old = parent.userData[key] as THREE.Object3D | undefined;
  old?.removeFromParent();
  const g = new THREE.Group();
  parent.add(g);
  parent.userData[key] = g;
  return g;
}

function setHairColor(n: YardNpcMesh, hex: number) {
  for (const m of [n.hairTop, n.hairBack, n.bun]) {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.map = null;
    mat.color.setHex(hex);
    mat.needsUpdate = true;
  }
}

function paintMesh(m: THREE.Mesh | undefined, hex: number) {
  if (!m) return;
  // 保險：若誤傳到臉／手（yardHand），不改色
  if (m.userData.yardHand) return;
  const sm = m.material as THREE.MeshStandardMaterial;
  sm.map = null;
  sm.color.setHex(hex);
  sm.needsUpdate = true;
}

function forearmMesh(a: THREE.Group) {
  return a.children.find(c => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).userData.yardForearm) as THREE.Mesh | undefined;
}

function setBodySolid(n: YardNpcMesh, hex: number, sleeveHex?: number) {
  const bm = n.body.material as THREE.MeshStandardMaterial;
  bm.map?.dispose();
  bm.map = null;
  bm.color.setHex(hex);
  bm.needsUpdate = true;
  const sc = sleeveHex ?? hex;
  for (const a of [n.armL, n.armR]) {
    paintMesh(sleeveMesh(a), sc);
    // 長袖感：前臂也同上衣色（短袖稍後由 bareArms 改回皮膚）
    paintMesh(forearmMesh(a), sc);
  }
}

function setBodyFloral(n: YardNpcMesh, base: number, accent: number, kind: number, initTex?: (t: THREE.Texture) => void) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d')!;
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
  x.fillStyle = hex(base); x.fillRect(0, 0, 64, 64); x.fillStyle = hex(accent);
  if (kind === 1) for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 64, 6);
  else if (kind === 2) for (let y = 4; y < 64; y += 16) for (let i = 4; i < 64; i += 16) { x.beginPath(); x.arc(i + (y % 32 ? 8 : 0), y, 3.5, 0, 7); x.fill(); }
  else if (kind === 3) for (let k = 0; k < 7; k++) {
    const cx = Math.random() * 64, cy = Math.random() * 64;
    for (let a = 0; a < 5; a++) { x.beginPath(); x.arc(cx + Math.cos(a * 1.26) * 4, cy + Math.sin(a * 1.26) * 4, 3, 0, 7); x.fill(); }
    x.fillStyle = '#ffe680'; x.beginPath(); x.arc(cx, cy, 2, 0, 7); x.fill(); x.fillStyle = hex(accent);
  } else {
    for (let y = 2; y < 64; y += 14) for (let i = 2; i < 64; i += 14) {
      x.beginPath(); x.arc(i + (y % 28 ? 5 : 0), y, 2.2, 0, 7); x.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  initTex?.(tex);
  const bm = n.body.material as THREE.MeshStandardMaterial;
  bm.map?.dispose();
  bm.map = tex;
  bm.color.set(0xffffff);
  bm.needsUpdate = true;
  for (const a of [n.armL, n.armR]) {
    paintMesh(sleeveMesh(a), base);
    paintMesh(forearmMesh(a), base);
  }
}

function setPants(n: YardNpcMesh, hex: number) {
  n.pants.color.setHex(hex);
  n.pants.needsUpdate = true;
}

function sleeveMesh(a: THREE.Group) {
  return a.children.find(c => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).userData.yardSleeveMesh) as THREE.Mesh | undefined
    ?? (a.children[0] as THREE.Mesh);
}

/** 汗衫短袖：上臂留衣袖色，前臂＋手露皮膚；絕不縮放手臂幾何 */
function bareArms(n: YardNpcMesh, skinHex: number, shirtHex: number) {
  for (const a of [n.armL, n.armR]) {
    const sl = sleeveMesh(a);
    if (sl) {
      sl.scale.set(1, 1, 1);
      sl.position.set(0, -0.1, 0);
      paintMesh(sl, shirtHex);
    }
    const fore = forearmMesh(a);
    if (fore) {
      fore.scale.set(1, 1, 1);
      fore.position.set(0, -0.28, 0);
      paintMesh(fore, skinHex);
      fore.visible = true;
    }
  }
}

function resetArms(n: YardNpcMesh) {
  for (const a of [n.armL, n.armR]) {
    const sl = sleeveMesh(a);
    if (sl) {
      sl.scale.set(1, 1, 1);
      sl.position.set(0, -0.1, 0);
    }
    const fore = forearmMesh(a);
    if (fore) {
      fore.scale.set(1, 1, 1);
      fore.position.set(0, -0.28, 0);
      fore.visible = true;
    }
  }
}

const AMA_TOPS = [0xe05a4a, 0x3f8ad0, 0x4fad6b, 0xe09830, 0x4a9ab8, 0xe07090, 0x2f9a9a, 0xc89040, 0x5a8fc0, 0xe0c341];
const AMA_PANTS = [0x3a5068, 0x4a5a68, 0x5a4a3a, 0x2a5a78, 0x4a6a5a, 0x586070];
/** 與 makeAma 身體抬高量一致，配件 Y 跟著加 */
const YARD_Y = 0.12;

/**
 * 依角色名氣質套穿著（可浮誇）：阿嬤花布圍裙、阿伯汗衫、阿公斗笠、大姐髮箍等。
 */
export function dressYardNpc(
  n: YardNpcMesh,
  look: YardLook,
  hair: number,
  pal: number[],
  D: NpcMeshDeps,
  initTex?: (t: THREE.Texture) => void,
) {
  const { mat, mesh, skin } = D;
  const bodyAcc = clearAcc(n.g, 'yardBodyAcc');
  const headAcc = clearAcc(n.head, 'yardHeadAcc');
  for (const a of [n.armL, n.armR]) {
    const ex = a.userData.yardSleeve as THREE.Object3D | undefined;
    ex?.removeFromParent();
    a.userData.yardSleeve = undefined;
  }
  resetArms(n);
  setHairColor(n, hair);
  n.bun.position.set(0, 0.14, 0.16);
  n.bun.scale.set(1, 1, 1);
  n.hairTop.scale.set(1, 1, 1);
  n.hairBack.scale.set(1, 1, 1);

  if (look === 'ama' || look === 'ama2') {
    // 鄉土阿嬤：花布衫、袖套、圍裙、包髻；造型誇張但像市場買菜的人
    n.bun.visible = true;
    n.hairTop.visible = true;
    n.hairBack.visible = true;
    n.hairTop.scale.set(1.15, 1.05, 1.15);
    n.hairBack.scale.set(1.2, 1.15, 1.25);
    n.bun.scale.set(1.35, 1.25, 1.35);
    n.bun.position.set(0, 0.16, 0.2);
    const base = pal[0] ?? AMA_TOPS[(Math.random() * AMA_TOPS.length) | 0];
    let acc = pal[1] ?? AMA_TOPS[(Math.random() * AMA_TOPS.length) | 0];
    if (acc === base) acc = 0xf4ecd8;
    setBodyFloral(n, base, acc, look === 'ama2' ? 3 : ((Math.random() * 4) | 0), initTex);
    setPants(n, AMA_PANTS[(Math.random() * AMA_PANTS.length) | 0]);
    const hairM = mat(hair);

    // 後頸散落幾綹白髮（不貼頭皮）
    mesh(rboxNpc(0.08, 0.14, 0.06), hairM, [-0.14, -0.02, 0.16], headAcc).rotation.z = 0.35;
    mesh(rboxNpc(0.08, 0.14, 0.06), hairM, [0.14, -0.02, 0.16], headAcc).rotation.z = -0.35;
    // 髻上插一支塑膠花／簪
    mesh(rboxNpc(0.04, 0.16, 0.04), mat(0xc84a5a), [0.08, 0.22, 0.18], headAcc).rotation.z = -0.45;
    mesh(rboxNpc(0.07, 0.05, 0.07), mat(0xffe8a0), [0.12, 0.28, 0.16], headAcc);

    // 寬鬆圍裙（略鼓出軀幹）＋大口袋
    mesh(rboxNpc(0.42, 0.38, 0.06), mat(0xf0ebe0), [0, 0.58 + YARD_Y, -0.2], bodyAcc);
    mesh(rboxNpc(0.05, 0.24, 0.04), mat(0xd8d0c4), [-0.11, 0.8 + YARD_Y, -0.18], bodyAcc).rotation.z = 0.18;
    mesh(rboxNpc(0.05, 0.24, 0.04), mat(0xd8d0c4), [0.11, 0.8 + YARD_Y, -0.18], bodyAcc).rotation.z = -0.18;
    mesh(rboxNpc(0.14, 0.12, 0.05), mat(0xe4ddd0), [-0.1, 0.48 + YARD_Y, -0.24], bodyAcc);
    mesh(rboxNpc(0.14, 0.12, 0.05), mat(0xe4ddd0), [0.1, 0.48 + YARD_Y, -0.24], bodyAcc);
    // 腰間掛一條擦手巾
    mesh(rboxNpc(0.08, 0.2, 0.04), mat(0x4a8ac8), [0.22, 0.42 + YARD_Y, -0.08], bodyAcc).rotation.z = 0.2;

    // 深藍袖套蓋住前臂（蚵寮標配）
    for (const a of [n.armL, n.armR]) {
      paintMesh(forearmMesh(a), base);
      const cover = mesh(rboxNpc(0.12, 0.16, 0.12), mat(0x2a3a6a), [0, -0.28, 0], a);
      a.userData.yardSleeve = cover;
    }
    // 小玉耳環
    for (const s of [-1, 1]) mesh(rboxNpc(0.04, 0.05, 0.04), mat(0x5aaa6a), [s * 0.18, -0.06, 0], headAcc);

    if (look === 'ama2') {
      // 市集花頭巾：蓋頂、兩角垂肩，髻還露一點
      const scarf = pal[1] ?? 0xc8d8e8;
      mesh(rboxNpc(0.38, 0.08, 0.38), mat(scarf), [0, 0.18, 0.02], headAcc);
      mesh(rboxNpc(0.12, 0.22, 0.06), mat(scarf), [0.2, 0.02, 0.06], headAcc).rotation.z = 0.55;
      mesh(rboxNpc(0.12, 0.22, 0.06), mat(scarf), [-0.2, 0.02, 0.06], headAcc).rotation.z = -0.55;
      mesh(rboxNpc(0.1, 0.08, 0.08), mat(pal[2] ?? 0xe8c050), [0.16, 0.1, -0.02], headAcc);
    }
    return;
  }

  if (look === 'fisher') {
    // 阿伯：白汗衫＋短褲感＋漁夫帽，短袖露臂
    n.bun.visible = false;
    n.hairTop.scale.set(1, 0.7, 1);
    n.hairBack.scale.set(0.9, 0.7, 0.7);
    const shirt = pal[1] ?? 0xf0ebe0;
    const accent = pal[0] ?? 0x2a4a7a;
    setBodySolid(n, shirt, shirt);
    bareArms(n, skin, shirt);
    setPants(n, pal[0] ?? 0x3a3a48);
    // 汗衫領口／肩線
    mesh(rboxNpc(0.28, 0.05, 0.32), mat(0xe8e2d6), [0, 0.9 + YARD_Y, 0.02], bodyAcc);
    // 肩上擦汗毛巾
    mesh(rboxNpc(0.22, 0.06, 0.08), mat(accent), [0.22, 0.88 + YARD_Y, 0.05], bodyAcc).rotation.z = -0.4;
    mesh(rboxNpc(0.06, 0.2, 0.08), mat(0xf5f0e4), [0.28, 0.72 + YARD_Y, 0.05], bodyAcc);
    // 漁夫帽
    mesh(rboxNpc(0.28, 0.1, 0.28), mat(pal[2] ?? 0xe8e0c8), [0, 0.18, 0], headAcc);
    mesh(rboxNpc(0.34, 0.04, 0.34), mat(accent), [0, 0.12, 0], headAcc);
    mesh(rboxNpc(0.12, 0.03, 0.16), mat(accent), [0, 0.1, -0.18], headAcc);
    return;
  }

  if (look === 'agong') {
    // 阿公：淺色汗衫／polo＋斗笠＋稀白髮
    n.bun.visible = false;
    n.hairTop.scale.set(1, 0.45, 1);
    n.hairBack.scale.set(0.85, 0.5, 0.6);
    const shirt = pal[0] ?? 0xe8e8e0;
    setBodySolid(n, shirt, shirt);
    bareArms(n, skin, shirt);
    setPants(n, pal[1] ?? 0x5a5a68);
    // 胸前口袋
    mesh(rboxNpc(0.12, 0.1, 0.03), mat(pal[2] ?? 0x8a5a3a), [0.12, 0.72 + YARD_Y, -0.18], bodyAcc);
    // 吊帶感
    mesh(rboxNpc(0.05, 0.42, 0.03), mat(0x5a4030), [-0.12, 0.7 + YARD_Y, -0.17], bodyAcc).rotation.z = 0.12;
    mesh(rboxNpc(0.05, 0.42, 0.03), mat(0x5a4030), [0.12, 0.7 + YARD_Y, -0.17], bodyAcc).rotation.z = -0.12;
    // 斗笠（扁錐改方塊堆疊）
    mesh(rboxNpc(0.5, 0.05, 0.5), mat(0xd8c080), [0, 0.2, 0], headAcc);
    mesh(rboxNpc(0.28, 0.08, 0.28), mat(0xc8b070), [0, 0.26, 0], headAcc);
    mesh(rboxNpc(0.12, 0.06, 0.12), mat(0xb89850), [0, 0.32, 0], headAcc);
    return;
  }

  // 大姐：碼頭／工廠那種「有打理過」的鄉土——鄉土燙、亮色衫、寬褲、髮夾
  n.bun.visible = false;
  n.hairTop.scale.set(1.35, 1.2, 1.3);
  n.hairBack.scale.set(1.4, 1.35, 1.45);
  const top = pal[0] ?? 0xe07a4a;
  const accent = pal[1] ?? 0xf0c050;
  const hot = pal[2] ?? 0xd04a6a;
  setBodySolid(n, top, hot);
  // 大姐短袖：前臂露膚
  bareArms(n, skin, hot);
  setPants(n, 0x2a3548);
  const hairM = mat(hair);

  // 鄉土燙：整頂鼓一圈，像安全帽式捲髮，不完全貼頭
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(rboxNpc(0.11, 0.1, 0.11), hairM, [
      Math.sin(a) * 0.2,
      0.05,
      Math.cos(a) * 0.18,
    ], headAcc);
  }
  // 前額固定那一排硬瀏海
  mesh(rboxNpc(0.26, 0.08, 0.08), hairM, [0, 0.08, -0.18], headAcc);
  // 側邊夾一支亮色髮夾
  mesh(rboxNpc(0.12, 0.04, 0.05), mat(accent), [0.2, 0.1, -0.06], headAcc).rotation.z = -0.3;
  mesh(rboxNpc(0.05, 0.05, 0.05), mat(hot), [0.26, 0.1, -0.06], headAcc);

  // 略寬的亮色下擺（像長版衫蓋住胯，不是蓬蓬裙）
  mesh(rboxNpc(0.56, 0.16, 0.4), mat(top), [0, 0.4 + YARD_Y, 0], bodyAcc);
  // 胸前假兩件／領口
  mesh(rboxNpc(0.22, 0.08, 0.3), mat(0xf5f0e8), [0, 0.88 + YARD_Y, 0.02], bodyAcc);
  // 玉鐲
  mesh(rboxNpc(0.08, 0.04, 0.08), mat(0x6aba7a), [0.22, 0.72 + YARD_Y, -0.12], bodyAcc);
  // 小金耳環（克制）
  for (const s of [-1, 1]) mesh(rboxNpc(0.045, 0.06, 0.045), mat(0xe0b040), [s * 0.19, -0.06, 0], headAcc);
}

export const GOSSIP = [
  '你們知道嗎，巷尾的阿雄又換工作了', '今天的蚵仔好肥喔！', '我孫子說要讀博士，我都聽不懂', '聽說今天有人剝到黑珍珠喔', '剝快一點，等一下菜市場要收了',
  '這次颱風沒來，蚵仔超讚', '我年輕時一天剝兩千顆呢', '你媳婦有回來嗎？', '珍珠喔～越剝越有機會啦', '蚵仔煎攤老闆說要加訂',
  '啊～腰好痠，休息一下', '昨天電視那齣好好看', '金色的珍珠，一輩子只看過一次', '今天有幾顆硬得像石頭',
];
export const PEEK = ['欸，你那顆是不是有東西？', '我看看～', '你剝多少了？'];
export const NAG_GIVEUP = ['這麼快就放棄喔？', '硬的才有肉啦，再試試看！', '年輕人沒耐性喔～', '那顆可以剝啦，好浪費！', '放棄？我們那時候才不敢這樣', '唉，蚵仔也是有生命的呢'];
export const NAG_STAB = ['哎唷！慢慢來啦！', '刀子很利，小心點！', '流血了啦，快按一下', '別那麼急，手比較要緊', '你這樣是要去醫院喔？'];
export const NAG_CRACK = ['殼屑都跑進肉裡了啦！', '那麼大力是要拆房子喔？', '有殼屑的蚵仔沒人要買啦', '小心扭，別用蠻力'];
export const NAG_SLIP = ['縫都沒找到，還硬插！', '先找縫啦，傻孩子', '刀子不是這樣用的'];
export const SCOLD_HIT = ['誰丟的！？', '蚵仔肉黏在我頭上啦！', '你是故意的吧！', '我頭髮剛洗的耶！'];
export const SCOLD_SHELL = ['要命喔！丟殼！', '你皮在癢喔？', '好啊，你來啊！', '跟你說，我年輕時是投手呢'];
export const SCOLD_STEAL = ['抓到了！偷蚵仔賊！', '你在幹嘛！我的蚵仔！', '還來！加倍還來！', '左鄰右舍也敢偷！'];
export const GRUDGE = ['哼，我不想跟你講話', '某人喔，手腳不乾淨', '我會記住的', '今天真倒楣，坐你旁邊'];
export const TURN_CHAT = ['欸欸，你聽我說…', '阿春，你知不知道…', '跟你說一個秘密', '那個阿雄喔…'];
export const PRAISE = ['好功夫！', '真的很準喔！', '那顆丟得真漂亮！'];
export const NPC_DIFF_T = [0.75, 1, 1.3, 1.6];
export const NPC_DEF = [
  { name: '快手阿桃', rate: 4.2, chatty: 0.1, peek: false, top: 0xe87840, hair: 0x8a8a8a, a: -1.9 },
  { name: '講話阿春', rate: 7.5, chatty: 0.6, peek: false, top: 0x3a9a6a, hair: 0x444444, a: Math.PI },
  { name: '好奇阿嬌', rate: 5.8, chatty: 0.3, peek: true, top: 0xe86878, hair: 0xc8c8c8, a: 1.9 },
];
export type NpcDef = { name: string; rate: number; chatty: number; peek: boolean; top: number; hair: number; a: number; r?: number };
