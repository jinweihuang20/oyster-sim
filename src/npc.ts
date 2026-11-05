import * as THREE from 'three';
import { rbox, crease, rcyl } from './geo';

export type NpcMeshDeps = {
  mat: (c: number, o?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial;
  mesh: (g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], parent?: THREE.Object3D) => THREE.Mesh;
  skin: number;
};

/** 阿婆 3D 人偶（不含座位／台詞邏輯） */
export function makeAma(top: number, hair: number, D: NpcMeshDeps) {
  const { mat, mesh, skin } = D;
  const g = new THREE.Group();
  mesh(rcyl(0.17, 0.17, 0.3, 8), mat(0xd45a4a), [0, 0.15, 0.05], g);
  const body = mesh(rcyl(0.2, 0.3, 0.55, 8), mat(top), [0, 0.6, 0], g);
  const pants = mat(0x3a5068); mesh(rbox(0.42, 0.14, 0.45), pants, [0, 0.35, -0.15], g);
  const shinG = rcyl(0.055, 0.045, 0.3, 6), sole = mat(0xf6f2ea), strap = mat(0x3a6fc0);
  for (const sx of [-0.1, 0.1]) {
    mesh(shinG, pants, [sx, 0.17, -0.34], g); mesh(rcyl(0.04, 0.04, 0.05, 6), mat(skin), [sx, 0.04, -0.35], g);
    mesh(rbox(0.09, 0.02, 0.2), sole, [sx, 0.01, -0.4], g); mesh(rbox(0.095, 0.03, 0.035), strap, [sx, 0.035, -0.45], g);
    mesh(crease(new THREE.SphereGeometry(0.035, 6, 4, 0, Math.PI * 2, 0, 1.6)), mat(skin), [sx, 0.025, -0.47], g);
  }
  const head = new THREE.Group(); head.position.set(0, 1.02, 0); g.add(head);
  mesh(crease(new THREE.SphereGeometry(0.15, 10, 8)), mat(skin), [0, 0, 0], head);
  mesh(crease(new THREE.SphereGeometry(0.155, 10, 8, 0, Math.PI * 2, 0, 1.4)), mat(hair), [0, 0.02, 0.02], head);
  mesh(crease(new THREE.SphereGeometry(0.07, 8, 6)), mat(hair), [0, 0.1, 0.13], head);
  for (const s of [-1, 1]) mesh(crease(new THREE.SphereGeometry(0.018, 6, 4)), mat(0x222222), [s * 0.05, 0.02, -0.14], head);
  mesh(rbox(0.06, 0.012, 0.01), mat(0xa04040), [0, -0.06, -0.145], head);
  const arm = (s: number) => {
    const p = new THREE.Group(); p.position.set(s * 0.2, 0.8, -0.02); g.add(p);
    mesh(rcyl(0.045, 0.04, 0.38, 6), mat(top), [0, -0.12, -0.12], p).rotation.x = 1.1;
    mesh(crease(new THREE.SphereGeometry(0.05, 6, 5)), mat(skin), [0, -0.2, -0.3], p);
    return p;
  };
  return { g, body, head, pants, armL: arm(-1), armR: arm(1) };
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
