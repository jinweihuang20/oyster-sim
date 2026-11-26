/**
 * 魚類圖鑑的 3D 魚模型（程式產生、低面數、平面著色）：每種魚一個 BufferGeometry（頂點色），一個 mesh＝一個 draw call。
 * 外形照真實魚的資料做（體高／側扁、背鰭幾段、尾鰭叉形／新月形／圓形、斑紋顏色），參考：
 * FishBase、Fishes of Australia、FAO 物種表、臺灣生命大百科、Florida Museum Discover Fishes 等。
 * 座標：頭朝 +x、背朝 +y、總長正規化成 1（中心在原點）。只用 three 的 BufferGeometry，不碰 WebGL（可以在測試裡跑）。
 */
import * as THREE from 'three';
import hanguoyuImg from '../../assets/hanguoyu.jpg';

export type FishSpInfo = { id: string; name: string; tier: number };
/** 跟伺服器 PlazaWorld.FishTable 同順序 */
export const FISH_SPECIES: readonly FishSpInfo[] = [
  { id: 'kurodai', name: '黑鯛', tier: 0 }, { id: 'kisu', name: '沙梭', tier: 0 }, { id: 'aigo', name: '臭肚魚', tier: 0 },
  { id: 'aji', name: '竹莢魚', tier: 0 }, { id: 'hata', name: '小石斑', tier: 0 }, { id: 'isaki', name: '黃雞魚', tier: 0 },
  { id: 'tachiuo', name: '白帶魚', tier: 1 }, { id: 'suzuki', name: '鱸魚', tier: 1 }, { id: 'katsuo', name: '鰹魚', tier: 1 },
  { id: 'kanpachi', name: '紅甘', tier: 1 }, { id: 'torahata', name: '虎斑', tier: 1 }, { id: 'shiira', name: '鬼頭刀', tier: 1 },
  { id: 'gt', name: '浪人鰺', tier: 2 }, { id: 'tamakai', name: '龍膽石斑', tier: 2 }, { id: 'kajiki', name: '雨傘旗魚', tier: 2 }, { id: 'maguro', name: '黑鮪魚', tier: 2 },
  // 進階大物路亞（只能往後加，舊存檔照 id 對）
  { id: 'sawara', name: '土魠魚', tier: 1 }, { id: 'sugi', name: '海鱺', tier: 1 }, { id: 'aoriika', name: '大軟絲', tier: 1 }, { id: 'kouika', name: '花枝', tier: 1 },
  { id: 'kurokajiki', name: '黑皮旗魚', tier: 2 }, { id: 'mebachi', name: '大目鮪', tier: 2 },
  { id: 'shumoku', name: '雙髻鯊', tier: 3 }, { id: 'manbou', name: '翻車魚', tier: 3 },
  { id: 'hanguoyu', name: '韓國魚', tier: 0 },
  // 2026-11 新魚種（接在韓國魚後面）
  { id: 'madai', name: '嘉鱲', tier: 0 }, { id: 'bora', name: '烏魚', tier: 0 }, { id: 'fugu', name: '河豚', tier: 0 },
  { id: 'akahata', name: '紅鰷', tier: 1 }, { id: 'hirame', name: '比目魚', tier: 1 }, { id: 'kamasu', name: '金梭魚', tier: 1 }, { id: 'tako', name: '章魚', tier: 1 },
  { id: 'ei', name: '魟魚', tier: 2 }, { id: 'ryugu', name: '皇帶魚', tier: 2 },
  { id: 'manta', name: '鬼蝠魟', tier: 3 }, { id: 'jinbei', name: '鯨鯊', tier: 3 }, { id: 'daiouika', name: '大王烏賊', tier: 3 },
];
/** 稀有度名稱（0 普通、1 稀有、2 傳說、3 巨物） */
export const FISH_TIER = ['普通', '稀有', '傳說', '巨物'] as const;

/** 圖鑑說明（只寫外觀，不寫在哪裡釣、用什麼餌） */
export const FISH_DESC: Record<string, string> = {
  kurodai: '身體高、側扁，灰黑帶銀光，有幾條淡淡的暗色橫帶；鰓蓋上角一個黑點，胸鰭橘黃。',
  kisu: '細長近圓筒形、尖嘴，沙黃色背、白肚子；兩個背鰭，尾鰭邊緣偏暗。',
  aigo: '橢圓側扁、小嘴，橄欖褐色布滿淡藍白色小點；背鰭和臀鰭的硬棘有毒。',
  aji: '紡錘形，灰藍背、銀白肚；側線上一整排稜鱗，鰓蓋有黑斑，尾鰭黃色深叉。',
  hata: '身體粗壯、大嘴，灰褐底色布滿橘褐色小點，身上 5 條斜斜的暗色橫帶；尾鰭圓。',
  isaki: '長橢圓形，橄欖褐背、銀色肚，身體上半有 3 條縱帶（年輕時最明顯）；尾鰭叉形。',
  tachiuo: '像一條銀色緞帶，沒有尾鰭，尾巴尖細；背鰭從頭一路長到尾，嘴裡有利牙。',
  suzuki: '修長、下巴突出，暗銀色背、白肚；上半身散著黑色小圓點（七星鱸），兩個背鰭。',
  katsuo: '魚雷形，深藍紫色背、銀色肚子上 4～6 條黑色縱紋；背鰭後面一排小離鰭，尾鰭新月形。',
  kanpachi: '修長，藍灰背、銀白肚，身體中間一條琥珀色縱帶，從嘴經過眼睛有一條斜斜的暗帶。',
  torahata: '粗壯、大嘴，淡黃褐色布滿褐色小點，加上 5 列不規則的深褐色大斑塊；尾柄上有黑色鞍斑。',
  shiira: '額頭陡直（公魚更明顯），背鰭從頭一路到尾；藍綠色背、金黃色身體、散著藍色小點，尾鰭深叉。',
  gt: '身體高、頭部輪廓陡，銀灰到幾乎全黑；側線後段有粗大稜鱗，鐮刀形背鰭臀鰭、深叉尾。',
  tamakai: '石斑裡最大的一種，深灰褐色帶淡黃斑塊，鰭是黃色帶黑點；大嘴、圓尾。',
  kajiki: '長長的尖嘴，背上一片像傘的大帆（深藍帶黑點）；深藍背、銀白肚，身上一條條淺藍點組成的直紋。',
  maguro: '巨大魚雷形，黑藍色背、銀灰色肚；背鰭和臀鰭後面一排黃色小離鰭，胸鰭短，新月形尾鰭。',
  sawara: '細長的流線身形、尖頭利牙，銀藍色身體側面有一條條波浪狀的暗色直紋；背鰭和臀鰭後面一排小離鰭，尾鰭深叉。',
  sugi: '修長的魚雷形，頭又寬又扁；深褐色身體上兩條淡色縱帶從嘴邊一路延伸到尾巴，第一背鰭是一排短短的硬棘，尾鰭新月形。',
  aoriika: '半透明的米色到琥珀色外套膜，兩側長長的鰭從頭到尾連成一圈、會像裙擺一樣波動；大眼睛，8 隻腕和 2 隻長觸腕拖在後面。',
  kouika: '外套膜是寬寬的橢圓形，背上深褐色和白色交錯成斑馬紋；邊緣一圈皺皺的窄鰭，腕比較短，兩隻觸腕末端像小槳。',
  kurokajiki: '旗魚裡最壯碩的一種：長而粗的尖嘴，背鰭短而尖（沒有大帆）；鈷藍色背、銀白肚，身上一條條淡藍直紋，巨大新月形尾鰭。',
  mebachi: '身體又高又圓的鮪魚，眼睛特別大，胸鰭長長的延伸到背鰭後方；深藍背、銀白肚，黃色小離鰭鑲黑邊，新月形尾鰭。',
  shumoku: '頭部往兩側伸成 T 字形的槌頭，眼睛長在兩端；高高的鐮刀形第一背鰭，尾鰭上葉特別長；石板灰色背、白色肚子。',
  manbou: '像一個巨大的扁圓盤，沒有正常的尾巴，只有一圈波浪狀的舵鰭；背鰭和臀鰭又高又尖、上下對稱，皮膚銀灰帶斑駁花紋。',
  hanguoyu: '我跟你聊的是大海，你在跟我聊漱口杯？',
  madai: '身體高、側扁，背部高高拱起；全身粉紅帶玫瑰紅，身上散著一顆顆閃著藍光的小點，尾鰭叉形、邊緣偏暗。',
  bora: '流線的魚雷形，頭又寬又扁；背部暗灰、身體銀灰，側面有幾條淡淡的暗色縱紋；兩個小背鰭前後分得很開，尾鰭叉形。',
  fugu: '鼓起來像一顆圓滾滾的刺球：背上橄欖褐色帶深色斑點，肚子雪白鼓脹；胸鰭和尾鰭都小小的，眼睛圓亮。',
  akahata: '粗壯的石斑體形、大嘴，全身鮮豔的朱紅到珊瑚紅，身上幾條淡淡的暗色橫帶；鰭的邊緣鑲黃，尾鰭圓。',
  hirame: '扁平的橢圓形，像一片葉子；兩隻眼睛都長在朝上的那一面，上面是沙褐色帶深淺斑點，底下雪白；背鰭和臀鰭沿著身體邊緣圍成一圈。',
  kamasu: '又細又長的銀色身體，尖頭、下巴突出、滿口利牙；背上一排斜斜的暗色 V 字橫紋，兩個背鰭分得很開，尾鰭深叉。',
  tako: '圓鼓鼓的紅褐色頭部（其實是外套膜），皮膚帶淺色小斑點；8 隻長長的腕往四周彎曲散開，腕下一排排吸盤。',
  ei: '寬大的菱形扁平身體，胸鰭像兩片翅膀；背面石板褐色帶深色斑點，腹面淡白；後面拖著一條像鞭子的細長尾巴，尾上有一根硬棘。',
  ryugu: '銀色緞帶般超長的身體；頭上豎著一束鮮紅色的冠鬣，紅色背鰭從頭一路延伸到尾，腹鰭也是又細又長的紅色。',
  manta: '巨大的菱形雙翼，深藍到黑色的背上有兩塊白色肩斑，腹面雪白；頭前面伸出兩片像角的頭鰭，後面拖著細細的鞭尾。',
  jinbei: '巨大的鯊魚，頭又寬又扁、大嘴長在最前面；深石板藍的背上布滿淡白色斑點和格狀條紋，背鰭高聳，新月形大尾鰭。',
  daiouika: '巨大的烏賊，紅到橘紅色的魚雷形外套膜，尾端兩片大大的側鰭；眼睛又大又黑，8 隻粗壯的腕，加上 2 隻特別長的觸腕。',
};

/** 用照片顯示的魚（不建 3D 模型）；Vite 會把路徑編成對應 base（正式／預覽）的 URL */
export const FISH_PHOTO: Readonly<Record<string, string>> = { hanguoyu: hanguoyuImg };
export const isPhotoFish = (id: string) => !!FISH_PHOTO[id];

type Prof = readonly (readonly [number, number, number, number?])[]; // [t, 半高, 半寬, 中心 y]
type Fin = { t0: number; t1: number; h: number; shape: 'spiny' | 'soft' | 'falcate' | 'sail' | 'low' | 'ribbon'; col: number; spots?: number };
type Tail = { kind: 'fork' | 'lunate' | 'round' | 'trunc' | 'shark' | 'clavus' | 'none'; len: number; span: number; col: number; edge?: number; /** 水平的尾鰭（比目魚這種平躺的魚） */ flat?: boolean };
type Paint = (t: number, v: number, r: number) => number;
type Spec = {
  /** 尾鰭佔全長多少 */
  tailLen: number;
  prof: Prof;
  dorsal: Fin[]; anal: Fin[];
  pect: { t: number; len: number; col: number; v?: number }; pelv?: { t: number; len: number; col: number };
  tail: Tail;
  eye: { t: number; v: number; r: number; iris: number };
  paint: Paint;
  finlets?: { n: number; col: number };
  bill?: number;
  /** 尖嘴粗細（預設 0.008） */
  billW?: number;
  /** 稜鱗線（側線後段的硬鱗）顏色 */
  scutes?: number;
  /** 頭足類的側鰭（水平、左右各一片）：ruffle＝邊緣波浪數 */
  sideFin?: { t0: number; t1: number; w: number; col: number; edge?: number; ruffle?: number; oval?: boolean };
  /** 頭足類的腕（n 隻）＋2 隻觸腕（從身體尾端往後拖；tent 0＝沒有觸腕）；spread＝腕往四周散開多少（章魚）、seg＝每隻幾段 */
  arms?: { n: number; len: number; tent: number; col: number; tip: number; th: number; spread?: number; seg?: number };
  /** 河豚的刺：在 t0～t1 之間隨機長 n 根小錐 */
  spikes?: { n: number; len: number; col: number; t0: number; t1: number };
  /** 鬼蝠魟的頭鰭：頭前面兩片往前伸的角 */
  horns?: { len: number; col: number };
  /** 雙髻鯊的槌頭（T 字形頭）：半寬、前後長度；眼睛畫在兩端 */
  hammer?: { span: number; len: number; col: number; under: number };
};

// ---------- 顏色小工具 ----------
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function mix(a: number, b: number, k: number) { _c1.setHex(a); _c2.setHex(b); _c1.lerp(_c2, Math.max(0, Math.min(1, k))); return _c1.getHex(); }
const ss = (e0: number, e1: number, x: number) => { const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
/** 背深肚淺 */
const shade = (back: number, belly: number, split = 0, blend = 0.35) => (v: number) => mix(belly, back, ss(split - blend, split + blend, v));
/** 穩定亂數（同一點同一值） */
function hash(a: number, b: number, c = 0) { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** 斑點：(t,v) 切格子，每格一個隨機圓心 */
function spot(t: number, v: number, st: number, sv: number, r: number, seed = 1) {
  const gi = Math.floor(t / st), gj = Math.floor((v + 1) / sv);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const i = gi + di, j = gj + dj;
    const cx = (i + hash(i, j, seed)) * st, cy = (j + hash(j, i, seed + 7)) * sv - 1;
    const dx = (t - cx) / st, dy = (v - cy) / sv;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// ---------- 各魚種 ----------
const S: Record<string, Spec> = {
  // 黑鯛：體高側扁、背隆起；灰黑銀光＋淡暗橫帶；鰓蓋上角黑點；胸鰭橘黃、其他鰭暗灰；背鰭單一硬棘長；尾叉形
  kurodai: {
    tailLen: 0.2, prof: [[0, 0.006, 0.004, 0.0], [0.08, 0.08, 0.03, 0.01], [0.3, 0.2, 0.06, 0.02], [0.55, 0.17, 0.05, 0.0], [0.85, 0.07, 0.025, 0.0], [1, 0.045, 0.015, 0]],
    dorsal: [{ t0: 0.24, t1: 0.82, h: 0.1, shape: 'spiny', col: 0x4a4e55 }], anal: [{ t0: 0.6, t1: 0.82, h: 0.08, shape: 'soft', col: 0x5a5e66 }],
    pect: { t: 0.27, len: 0.2, col: 0xe09a3a }, pelv: { t: 0.32, len: 0.1, col: 0x4a4e55 },
    tail: { kind: 'fork', len: 0.2, span: 0.15, col: 0x4a4e55 }, eye: { t: 0.08, v: 0.35, r: 0.03, iris: 0xd8d0b0 },
    paint: (t, v) => {
      if (t > 0.15 && t < 0.19 && v > 0.45 && v < 0.75) return 0x111316; // 鰓蓋黑點
      let c = shade(0x30353d, 0xc8ccd2, -0.25, 0.4)(v);
      const bar = Math.sin((t - 0.18) * Math.PI * 2 / 0.11);
      if (t > 0.18 && t < 0.85 && v > -0.3 && bar > 0.55) c = mix(c, 0x1a1c20, 0.35);
      return c;
    },
  },
  // 沙梭：細長近圓筒、尖嘴；沙黃背白肚、體側淡藍縱帶；兩背鰭（第一短高、第二低長）；尾鰭微凹、邊緣暗
  kisu: {
    tailLen: 0.13, prof: [[0, 0.004, 0.004, -0.005], [0.1, 0.04, 0.035, 0], [0.35, 0.075, 0.065, 0], [0.7, 0.055, 0.045, 0], [1, 0.025, 0.018, 0]],
    dorsal: [{ t0: 0.3, t1: 0.44, h: 0.075, shape: 'spiny', col: 0xe6dcc4, spots: 0x8a6c4c }, { t0: 0.47, t1: 0.88, h: 0.04, shape: 'low', col: 0xece4d0 }],
    anal: [{ t0: 0.52, t1: 0.88, h: 0.035, shape: 'low', col: 0xf2ece0 }],
    pect: { t: 0.22, len: 0.1, col: 0xd8d0a8 }, pelv: { t: 0.32, len: 0.06, col: 0xf2ece0 },
    tail: { kind: 'trunc', len: 0.13, span: 0.08, col: 0xe2d8c0, edge: 0x6a5a48 }, eye: { t: 0.08, v: 0.3, r: 0.022, iris: 0xe8e0c8 },
    paint: (t, v) => { let c = shade(0xb4945e, 0xf2ede2, 0.05, 0.35)(v); if (Math.abs(v - 0.05) < 0.1 && t > 0.15) c = mix(c, 0x8aa4b8, 0.4); if (t < 0.2 && v > 0.4) c = mix(c, 0x7c6440, 0.4); return c; },
  },
  // 臭肚魚：橢圓側扁、小嘴鈍頭；橄欖褐到銀色，滿身淡藍白小點；側線起點下暗斑；背鰭臀鰭硬棘長
  aigo: {
    tailLen: 0.17, prof: [[0, 0.01, 0.006, -0.01], [0.07, 0.08, 0.03, 0.0], [0.3, 0.17, 0.05, 0.0], [0.6, 0.15, 0.045, 0.0], [0.88, 0.06, 0.02, 0], [1, 0.045, 0.014, 0]],
    dorsal: [{ t0: 0.18, t1: 0.88, h: 0.08, shape: 'spiny', col: 0x6a6a46 }], anal: [{ t0: 0.42, t1: 0.88, h: 0.07, shape: 'spiny', col: 0x7a7a5a }],
    pect: { t: 0.24, len: 0.13, col: 0x9a9a7a }, pelv: { t: 0.28, len: 0.08, col: 0x8a8a6a },
    tail: { kind: 'fork', len: 0.17, span: 0.13, col: 0x6a6a46 }, eye: { t: 0.1, v: 0.3, r: 0.028, iris: 0xd8c070 },
    paint: (t, v) => {
      let c = shade(0x5c5c34, 0xb8b8a4, -0.3, 0.45)(v);
      if (t > 0.2 && t < 0.28 && v > 0.2 && v < 0.5) return 0x2c2a1a;
      if (t > 0.06 && t < 0.95 && spot(t, v, 0.045, 0.16, 0.32, 3)) c = mix(c, 0xd6e6f0, 0.85);
      return c;
    },
  },
  // 竹莢魚：紡錘形；灰藍背銀白肚；鰓蓋黑斑；整排稜鱗；兩背鰭；尾鰭黃色深叉、尾柄細
  aji: {
    tailLen: 0.2, prof: [[0, 0.006, 0.005, -0.004], [0.1, 0.06, 0.04, 0], [0.35, 0.11, 0.06, 0], [0.7, 0.07, 0.04, 0], [1, 0.022, 0.016, 0]],
    dorsal: [{ t0: 0.3, t1: 0.43, h: 0.07, shape: 'spiny', col: 0x8a96a2 }, { t0: 0.46, t1: 0.92, h: 0.04, shape: 'low', col: 0x9aa6b2 }],
    anal: [{ t0: 0.54, t1: 0.92, h: 0.035, shape: 'low', col: 0xe8ecef }],
    pect: { t: 0.24, len: 0.18, col: 0x8a96a2 }, pelv: { t: 0.3, len: 0.07, col: 0xe8ecef },
    tail: { kind: 'fork', len: 0.2, span: 0.15, col: 0xe8c84a }, eye: { t: 0.08, v: 0.3, r: 0.034, iris: 0xe8e8e0 }, scutes: 0x9aa4ae,
    paint: (t, v) => { if (t > 0.16 && t < 0.2 && v > 0.4 && v < 0.7) return 0x101418; return shade(0x41618a, 0xe8ecf0, 0.15, 0.3)(v); },
  },
  // 小石斑（點帶石斑）：粗壯大嘴；灰褐底、橘褐小點；5 條斜暗帶往下分叉；背鰭連續；尾圓
  hata: {
    tailLen: 0.17, prof: [[0, 0.03, 0.02, -0.02], [0.07, 0.09, 0.07, 0], [0.3, 0.15, 0.09, 0.0], [0.65, 0.12, 0.07, 0.0], [1, 0.06, 0.03, 0]],
    dorsal: [{ t0: 0.28, t1: 0.85, h: 0.08, shape: 'spiny', col: 0x7a6a52, spots: 0xc06a2a }], anal: [{ t0: 0.62, t1: 0.85, h: 0.08, shape: 'soft', col: 0x7a6a52, spots: 0xc06a2a }],
    pect: { t: 0.25, len: 0.15, col: 0x8a7a62 }, pelv: { t: 0.29, len: 0.1, col: 0x6a5a44 },
    tail: { kind: 'round', len: 0.17, span: 0.1, col: 0x7a6a52 }, eye: { t: 0.09, v: 0.45, r: 0.027, iris: 0xc8a050 },
    paint: (t, v) => {
      let c = shade(0x847460, 0xe2d8c6, -0.4, 0.45)(v);
      const b = (t * 6.2 - v * 0.35) % 1;
      if (t > 0.18 && t < 0.95 && v > -0.55 && b > 0.0 && b < 0.22) c = mix(c, 0x4a3c2c, 0.55);
      if (spot(t, v, 0.04, 0.14, 0.3, 5)) c = mix(c, 0xc06a2a, 0.8);
      return c;
    },
  },
  // 黃雞魚：長橢圓；橄欖褐背、銀肚；上半 3 條縱帶；鰭灰褐帶黃；尾叉形
  isaki: {
    tailLen: 0.18, prof: [[0, 0.008, 0.006, -0.005], [0.1, 0.08, 0.045, 0], [0.35, 0.14, 0.065, 0.01], [0.7, 0.1, 0.05, 0], [1, 0.04, 0.02, 0]],
    dorsal: [{ t0: 0.28, t1: 0.85, h: 0.07, shape: 'spiny', col: 0x9a8e58 }], anal: [{ t0: 0.62, t1: 0.85, h: 0.06, shape: 'soft', col: 0xb0a060 }],
    pect: { t: 0.25, len: 0.15, col: 0xa89a5a }, pelv: { t: 0.3, len: 0.08, col: 0xb0a060 },
    tail: { kind: 'fork', len: 0.18, span: 0.13, col: 0x8a7e4a }, eye: { t: 0.09, v: 0.35, r: 0.028, iris: 0xd8d0b0 },
    paint: (t, v) => { let c = shade(0x56603e, 0xd6d8ce, -0.1, 0.4)(v); for (const s of [0.82, 0.5, 0.18]) if (Math.abs(v - s) < 0.08 && t > 0.08) c = mix(c, 0xc8a83a, 0.75); return c; },
  },
  // 白帶魚：緞帶形、沒有尾鰭、尾巴尖細；背鰭從頭到尾；銀色帶鋼藍
  tachiuo: {
    tailLen: 0, prof: [[0, 0.01, 0.004, -0.004], [0.04, 0.04, 0.012, 0], [0.12, 0.05, 0.014, 0], [0.5, 0.042, 0.012, 0], [0.85, 0.016, 0.006, 0], [1, 0.002, 0.002, 0]],
    dorsal: [{ t0: 0.06, t1: 0.97, h: 0.022, shape: 'ribbon', col: 0xe6e4c0 }], anal: [],
    pect: { t: 0.08, len: 0.04, col: 0xdde4ea }, tail: { kind: 'none', len: 0, span: 0, col: 0 },
    eye: { t: 0.025, v: 0.35, r: 0.012, iris: 0xe8e0a0 },
    paint: (t, v) => { if (t < 0.035 && v < 0.0 && v > -0.4) return 0x5a6068; return mix(0xd2dce6, 0xa8b8c8, ss(0.3, 0.9, v) + t * 0.2); },
  },
  // 鱸魚（七星鱸）：修長、下巴突出；暗銀背白肚；上半身黑色小圓點；兩背鰭；尾微叉
  suzuki: {
    tailLen: 0.17, prof: [[0, 0.008, 0.006, -0.01], [0.1, 0.07, 0.05, 0], [0.35, 0.12, 0.065, 0.01], [0.7, 0.085, 0.045, 0], [1, 0.04, 0.022, 0]],
    dorsal: [{ t0: 0.3, t1: 0.48, h: 0.08, shape: 'spiny', col: 0x5a6470, spots: 0x1a1c20 }, { t0: 0.52, t1: 0.74, h: 0.06, shape: 'soft', col: 0x6a7480 }],
    anal: [{ t0: 0.62, t1: 0.78, h: 0.05, shape: 'soft', col: 0xd0d6dc }],
    pect: { t: 0.24, len: 0.12, col: 0xb0b8c0 }, pelv: { t: 0.3, len: 0.08, col: 0xe0e4e8 },
    tail: { kind: 'fork', len: 0.17, span: 0.13, col: 0x5a6470 }, eye: { t: 0.09, v: 0.4, r: 0.025, iris: 0xd8d8c8 },
    paint: (t, v) => { let c = shade(0x4e5864, 0xe8ecf0, 0.0, 0.35)(v); if (v > 0.1 && t > 0.15 && t < 0.9 && spot(t, v, 0.05, 0.22, 0.24, 9)) c = 0x16181c; return c; },
  },
  // 鰹魚：魚雷形；深藍紫背、銀肚 4～6 條黑縱紋；第一背鰭、小第二背鰭、離鰭；尾新月形、尾柄細
  katsuo: {
    tailLen: 0.2, prof: [[0, 0.01, 0.008, -0.004], [0.1, 0.08, 0.065, 0], [0.35, 0.14, 0.11, 0], [0.7, 0.08, 0.06, 0], [0.95, 0.018, 0.022, 0], [1, 0.014, 0.02, 0]],
    dorsal: [{ t0: 0.28, t1: 0.45, h: 0.08, shape: 'spiny', col: 0x22284a }, { t0: 0.54, t1: 0.6, h: 0.05, shape: 'falcate', col: 0x2a3050 }],
    anal: [{ t0: 0.6, t1: 0.65, h: 0.04, shape: 'falcate', col: 0xc8ccd4 }],
    pect: { t: 0.24, len: 0.1, col: 0x2a3050 }, pelv: { t: 0.28, len: 0.06, col: 0x6a7080 },
    tail: { kind: 'lunate', len: 0.2, span: 0.2, col: 0x22284a }, eye: { t: 0.08, v: 0.3, r: 0.026, iris: 0xd8d8d0 },
    finlets: { n: 7, col: 0x3a4060 },
    paint: (t, v) => { let c = shade(0x262a58, 0xdce0e8, 0.25, 0.2)(v); if (v < 0.1 && v > -0.8 && t > 0.22 && t < 0.92) { const b = ((v + 0.8) / 0.9) * 4.5; if (b % 1 < 0.42) c = mix(c, 0x24263a, 0.85); } return c; },
  },
  // 紅甘：修長；藍灰背、銀白肚、中間琥珀色縱帶；嘴經眼睛到第一背鰭的斜暗帶；尾叉形
  kanpachi: {
    tailLen: 0.19, prof: [[0, 0.01, 0.007, -0.004], [0.1, 0.075, 0.05, 0], [0.35, 0.13, 0.07, 0], [0.7, 0.085, 0.045, 0], [1, 0.022, 0.018, 0]],
    dorsal: [{ t0: 0.3, t1: 0.38, h: 0.035, shape: 'spiny', col: 0x5a6068 }, { t0: 0.42, t1: 0.86, h: 0.07, shape: 'falcate', col: 0x6a6a5a }],
    anal: [{ t0: 0.6, t1: 0.86, h: 0.055, shape: 'falcate', col: 0xb8a060 }],
    pect: { t: 0.24, len: 0.12, col: 0x8a8a7a }, pelv: { t: 0.3, len: 0.09, col: 0xd8c070 },
    tail: { kind: 'fork', len: 0.19, span: 0.15, col: 0xa89050 }, eye: { t: 0.08, v: 0.35, r: 0.026, iris: 0xe0d8b8 },
    paint: (t, v) => {
      let c = shade(0x5a6270, 0xeef0f2, 0.1, 0.3)(v);
      if (Math.abs(v - 0.05) < 0.11 && t > 0.1) c = mix(c, 0xd8a040, 0.8);
      if (t < 0.32 && Math.abs(v - (0.1 + t * 2.6)) < 0.26 && v > 0.05) c = mix(c, 0x2a2a30, 0.8);
      return c;
    },
  },
  // 虎斑（老虎斑）：粗壯；淡黃褐、密褐點＋5 列深褐大斑；尾柄黑鞍斑；尾圓
  torahata: {
    tailLen: 0.16, prof: [[0, 0.03, 0.022, -0.02], [0.07, 0.1, 0.08, 0], [0.3, 0.17, 0.1, 0.0], [0.65, 0.13, 0.08, 0.0], [1, 0.065, 0.035, 0]],
    dorsal: [{ t0: 0.28, t1: 0.86, h: 0.085, shape: 'spiny', col: 0xa88a58, spots: 0x5a3e22 }], anal: [{ t0: 0.62, t1: 0.86, h: 0.08, shape: 'soft', col: 0xa88a58, spots: 0x5a3e22 }],
    pect: { t: 0.25, len: 0.15, col: 0xb89a62 }, pelv: { t: 0.29, len: 0.1, col: 0x8a6a42 },
    tail: { kind: 'round', len: 0.16, span: 0.11, col: 0xa88a58 }, eye: { t: 0.09, v: 0.45, r: 0.025, iris: 0xc8a050 },
    paint: (t, v) => {
      let c = shade(0xb4945c, 0xe0cfa4, -0.5, 0.4)(v);
      if (t > 0.88 && v > 0.4) return 0x1a1410;
      const blot = Math.sin(t * Math.PI * 2 * 5 + 0.8) * Math.sin((v + 1) * Math.PI * 1.6 + t * 4);
      if (t > 0.12 && t < 0.9 && blot > 0.45) c = mix(c, 0x5a3e22, 0.8);
      if (spot(t, v, 0.03, 0.11, 0.3, 11)) c = mix(c, 0x6a4a2a, 0.6);
      return c;
    },
  },
  // 鬼頭刀：額頭陡直；背鰭從頭到尾；藍綠背、金黃身體、藍點；尾深叉
  shiira: {
    tailLen: 0.18, prof: [[0, 0.06, 0.02, -0.02], [0.03, 0.12, 0.035, 0.0], [0.12, 0.14, 0.05, 0], [0.45, 0.11, 0.045, 0], [0.85, 0.045, 0.02, 0], [1, 0.022, 0.014, 0]],
    dorsal: [{ t0: 0.03, t1: 0.9, h: 0.06, shape: 'soft', col: 0x1a5a8a }], anal: [{ t0: 0.5, t1: 0.9, h: 0.05, shape: 'soft', col: 0xc8b040 }],
    pect: { t: 0.18, len: 0.11, col: 0xc8b040 }, pelv: { t: 0.2, len: 0.08, col: 0xd8c860 },
    tail: { kind: 'fork', len: 0.18, span: 0.15, col: 0xb8a040 }, eye: { t: 0.06, v: -0.05, r: 0.024, iris: 0xe8d8a0 },
    paint: (t, v) => {
      let c = mix(0xeee2a0, 0xd8b428, ss(-0.7, -0.2, v));
      c = mix(c, 0x1a7a8a, ss(0.35, 0.8, v));
      if (t > 0.08 && v > -0.6 && spot(t, v, 0.05, 0.2, 0.25, 13)) c = mix(c, 0x2a6ab0, 0.8);
      return c;
    },
  },
  // 浪人鰺：體高、頭陡；銀灰到深灰背；散黑點；側線後段粗稜鱗；鐮刀形第二背鰭臀鰭；尾深叉
  gt: {
    tailLen: 0.21, prof: [[0, 0.02, 0.01, -0.03], [0.04, 0.1, 0.04, 0.02], [0.25, 0.19, 0.07, 0.02], [0.55, 0.15, 0.06, 0], [0.88, 0.04, 0.025, 0], [1, 0.022, 0.02, 0]],
    dorsal: [{ t0: 0.28, t1: 0.36, h: 0.04, shape: 'spiny', col: 0x3a4048 }, { t0: 0.4, t1: 0.82, h: 0.12, shape: 'falcate', col: 0x3a4048 }],
    anal: [{ t0: 0.52, t1: 0.82, h: 0.1, shape: 'falcate', col: 0x5a6068 }],
    pect: { t: 0.24, len: 0.24, col: 0x7a8088 }, pelv: { t: 0.28, len: 0.08, col: 0x9aa0a6 },
    tail: { kind: 'fork', len: 0.21, span: 0.2, col: 0x3a4048 }, eye: { t: 0.07, v: 0.4, r: 0.028, iris: 0xd8d8c8 }, scutes: 0x5a6068,
    paint: (t, v) => { let c = shade(0x3e444c, 0xb6bcc2, 0.1, 0.45)(v); if (t > 0.15 && spot(t, v, 0.07, 0.3, 0.12, 17)) c = 0x14161a; return c; },
  },
  // 龍膽石斑：巨大；深灰褐＋淡黃斑塊；鰭黃色帶黑點；大嘴；尾圓
  tamakai: {
    tailLen: 0.15, prof: [[0, 0.04, 0.03, -0.025], [0.07, 0.11, 0.1, 0], [0.3, 0.16, 0.12, 0.0], [0.65, 0.13, 0.09, 0.0], [1, 0.07, 0.04, 0]],
    dorsal: [{ t0: 0.28, t1: 0.86, h: 0.07, shape: 'spiny', col: 0xd8b830, spots: 0x1a1810 }], anal: [{ t0: 0.62, t1: 0.86, h: 0.07, shape: 'soft', col: 0xd8b830, spots: 0x1a1810 }],
    pect: { t: 0.25, len: 0.14, col: 0xd8b830 }, pelv: { t: 0.29, len: 0.1, col: 0xc8a828 },
    tail: { kind: 'round', len: 0.15, span: 0.11, col: 0xd0b030 }, eye: { t: 0.09, v: 0.45, r: 0.022, iris: 0xc8a040 },
    paint: (t, v) => {
      let c = shade(0x403a30, 0x6a6250, -0.6, 0.4)(v);
      const b = Math.sin(t * 17 + Math.sin(v * 5) * 1.5) * Math.sin(v * 6 + t * 9);
      if (b > 0.4 && t > 0.06) c = mix(c, 0xc8b060, 0.75);
      return c;
    },
  },
  // 雨傘旗魚：長尖嘴、大帆背鰭（深藍黑點）；深藍背銀白肚；淺藍點組成的直紋；尾新月形
  kajiki: {
    tailLen: 0.17, prof: [[0, 0.012, 0.01, -0.01], [0.08, 0.06, 0.04, 0], [0.3, 0.085, 0.05, 0], [0.7, 0.055, 0.035, 0], [0.95, 0.016, 0.018, 0], [1, 0.012, 0.016, 0]],
    dorsal: [{ t0: 0.1, t1: 0.66, h: 0.26, shape: 'sail', col: 0x2a4c96, spots: 0x101c3a }, { t0: 0.86, t1: 0.9, h: 0.03, shape: 'falcate', col: 0x1a2a5a }],
    anal: [{ t0: 0.58, t1: 0.68, h: 0.05, shape: 'falcate', col: 0x8a9ab0 }],
    pect: { t: 0.18, len: 0.12, col: 0x2a3a6a }, pelv: { t: 0.2, len: 0.22, col: 0x1a2a5a },
    tail: { kind: 'lunate', len: 0.17, span: 0.2, col: 0x1a2a5a }, eye: { t: 0.06, v: 0.25, r: 0.018, iris: 0xd0d8e8 }, bill: 0.24,
    paint: (t, v) => {
      let c = shade(0x1c2a58, 0xe4e8f0, -0.1, 0.25)(v);
      const bar = (t * 18) % 1;
      if (t > 0.15 && t < 0.92 && v > -0.4 && bar > 0.35 && bar < 0.6 && ((Math.floor((v + 1) * 6) % 2) === 0)) c = 0x7ab8e8;
      return c;
    },
  },
  // 黑鮪魚：巨大魚雷形；黑藍背、銀灰肚帶淡斑；黃色離鰭鑲黑邊；短胸鰭；尾新月形
  maguro: {
    tailLen: 0.19, prof: [[0, 0.014, 0.012, -0.004], [0.1, 0.1, 0.085, 0], [0.38, 0.16, 0.13, 0], [0.72, 0.09, 0.075, 0], [0.95, 0.02, 0.028, 0], [1, 0.016, 0.024, 0]],
    dorsal: [{ t0: 0.3, t1: 0.46, h: 0.07, shape: 'spiny', col: 0x1a2038 }, { t0: 0.52, t1: 0.6, h: 0.07, shape: 'falcate', col: 0x8a8040 }],
    anal: [{ t0: 0.58, t1: 0.66, h: 0.06, shape: 'falcate', col: 0xa8a080 }],
    pect: { t: 0.24, len: 0.1, col: 0x1a2038 }, pelv: { t: 0.27, len: 0.06, col: 0x6a7080 },
    tail: { kind: 'lunate', len: 0.19, span: 0.22, col: 0x141a30 }, eye: { t: 0.08, v: 0.25, r: 0.022, iris: 0xc8ccd8 },
    finlets: { n: 8, col: 0xe0c040 },
    paint: (t, v) => { let c = shade(0x121a36, 0xc6cad4, 0.2, 0.25)(v); if (v < -0.05 && t > 0.3 && t < 0.85 && spot(t, v, 0.06, 0.2, 0.22, 19)) c = mix(c, 0xeef0f4, 0.6); return c; },
  },
  // 土魠魚（康氏馬加鰆）：細長流線、尖頭；銀藍身體上波浪狀暗色直紋；兩背鰭、離鰭；尾深叉
  sawara: {
    tailLen: 0.17, prof: [[0, 0.008, 0.006, -0.003], [0.1, 0.05, 0.035, 0], [0.35, 0.075, 0.045, 0], [0.7, 0.055, 0.035, 0], [0.95, 0.014, 0.014, 0], [1, 0.012, 0.014, 0]],
    dorsal: [{ t0: 0.25, t1: 0.42, h: 0.04, shape: 'spiny', col: 0x2a3a50 }, { t0: 0.5, t1: 0.6, h: 0.05, shape: 'falcate', col: 0x34465e }],
    anal: [{ t0: 0.56, t1: 0.64, h: 0.045, shape: 'falcate', col: 0xc8ccd4 }],
    pect: { t: 0.2, len: 0.08, col: 0x3a4a60 }, pelv: { t: 0.26, len: 0.04, col: 0xd0d4da },
    tail: { kind: 'fork', len: 0.17, span: 0.15, col: 0x3a4a60 }, eye: { t: 0.06, v: 0.3, r: 0.02, iris: 0xd8dce0 },
    finlets: { n: 9, col: 0x8a96a8 },
    paint: (t, v) => {
      let c = shade(0x2e4a6a, 0xe4e8ee, 0.05, 0.3)(v);
      if (v > -0.35 && t > 0.2 && t < 0.92 && Math.sin(t * 70 + Math.sin(v * 5) * 1.6) > 0.55) c = mix(c, 0x223448, 0.75);
      return c;
    },
  },
  // 海鱺（軍曹魚）：修長、頭寬扁；深褐色、兩條淡色縱帶；第一背鰭短硬棘；尾新月形
  sugi: {
    tailLen: 0.19, prof: [[0, 0.02, 0.03, -0.006], [0.08, 0.05, 0.075, 0], [0.3, 0.085, 0.085, 0], [0.65, 0.07, 0.06, 0], [0.95, 0.022, 0.02, 0], [1, 0.018, 0.016, 0]],
    dorsal: [{ t0: 0.22, t1: 0.36, h: 0.025, shape: 'spiny', col: 0x2a2018 }, { t0: 0.42, t1: 0.78, h: 0.07, shape: 'falcate', col: 0x2a2018 }],
    anal: [{ t0: 0.5, t1: 0.78, h: 0.055, shape: 'falcate', col: 0x3a3028 }],
    pect: { t: 0.2, len: 0.14, col: 0x2a2018, v: -0.3 }, pelv: { t: 0.3, len: 0.06, col: 0x4a3e30 },
    tail: { kind: 'lunate', len: 0.19, span: 0.17, col: 0x2a2018 }, eye: { t: 0.06, v: 0.25, r: 0.02, iris: 0xc8b890 },
    paint: (t, v) => {
      let c = shade(0x3a2a1c, 0xd8d0c0, -0.4, 0.4)(v);
      if (Math.abs(v - 0.3) < 0.08) c = mix(c, 0xe6dcc8, 0.8);
      if (Math.abs(v + 0.12) < 0.07 && t > 0.08) c = mix(c, 0xd8ccb4, 0.7);
      return c;
    },
  },
  // 大軟絲（萊氏擬烏賊）：半透明米色到琥珀色的長外套膜（頭朝 +x 的是外套膜尖端）；整片側鰭；大眼；8 腕＋2 觸腕往後拖
  aoriika: {
    tailLen: 0, prof: [[0, 0.012, 0.012, 0], [0.08, 0.06, 0.07, 0], [0.3, 0.095, 0.11, 0], [0.6, 0.095, 0.11, 0], [0.76, 0.08, 0.09, 0], [0.8, 0.055, 0.062, 0], [0.88, 0.068, 0.076, 0], [1, 0.045, 0.05, 0]],
    dorsal: [], anal: [],
    pect: { t: 0.9, len: 0, col: 0xe8d2a8 },
    tail: { kind: 'none', len: 0, span: 0, col: 0xe8d2a8 }, eye: { t: 0.88, v: 0.15, r: 0.03, iris: 0x7ab0a8 },
    sideFin: { t0: 0.02, t1: 0.77, w: 0.1, col: 0xecd8b4, edge: 0xf6ead4, ruffle: 9, oval: true },
    arms: { n: 8, len: 0.24, tent: 0.34, col: 0xe2c494, tip: 0xc89a68, th: 0.015 },
    paint: (t, v) => {
      let c = shade(0xd8b07a, 0xf4ead8, -0.2, 0.5)(v);
      if (v > -0.3 && spot(t, v, 0.04, 0.16, 0.3, 23)) c = mix(c, 0xa8744a, 0.55);
      if (t > 0.8) c = mix(c, 0xe0c090, 0.4);
      return c;
    },
  },
  // 花枝（虎斑烏賊）：寬橢圓外套膜；背上深褐白斑馬紋；邊緣皺皺的窄鰭；腕短、觸腕末端像小槳
  kouika: {
    tailLen: 0, prof: [[0, 0.04, 0.05, 0], [0.06, 0.1, 0.13, 0], [0.35, 0.125, 0.18, 0], [0.65, 0.115, 0.165, 0], [0.78, 0.08, 0.11, 0], [0.82, 0.065, 0.085, 0], [0.9, 0.072, 0.09, 0], [1, 0.045, 0.058, 0]],
    dorsal: [], anal: [],
    pect: { t: 0.9, len: 0, col: 0xd8c8b0 },
    tail: { kind: 'none', len: 0, span: 0, col: 0xd8c8b0 }, eye: { t: 0.89, v: 0.25, r: 0.026, iris: 0xd0b060 },
    sideFin: { t0: 0.03, t1: 0.78, w: 0.032, col: 0xd8c8b0, edge: 0xf4ece0, ruffle: 12 },
    arms: { n: 8, len: 0.15, tent: 0.22, col: 0xc8b090, tip: 0x8a6a4a, th: 0.018 },
    paint: (t, v) => {
      let c = shade(0x8a6a4a, 0xf0e8dc, -0.3, 0.4)(v);
      if (v > -0.15 && t < 0.8 && Math.sin(t * 44 + Math.sin(v * 4 + t * 9) * 1.4) > 0.15) c = mix(c, 0x3a2818, 0.82);
      else if (v > -0.15 && t < 0.8) c = mix(c, 0xf2ece2, 0.55);
      return c;
    },
  },
  // 黑皮旗魚（黑槍魚／藍槍魚）：比雨傘旗魚壯；長而粗的尖嘴；短尖背鰭（不是大帆）；鈷藍背、淡藍直紋；巨大新月形尾
  kurokajiki: {
    tailLen: 0.19, prof: [[0, 0.014, 0.012, -0.01], [0.08, 0.075, 0.055, 0], [0.3, 0.11, 0.07, 0], [0.65, 0.075, 0.05, 0], [0.95, 0.02, 0.022, 0], [1, 0.015, 0.018, 0]],
    dorsal: [{ t0: 0.1, t1: 0.2, h: 0.09, shape: 'falcate', col: 0x1a2c5a }, { t0: 0.2, t1: 0.62, h: 0.022, shape: 'low', col: 0x1a2c5a }, { t0: 0.86, t1: 0.9, h: 0.03, shape: 'falcate', col: 0x14244a }],
    anal: [{ t0: 0.58, t1: 0.68, h: 0.06, shape: 'falcate', col: 0x8a9ab0 }],
    pect: { t: 0.17, len: 0.2, col: 0x1a2c5a, v: -0.4 }, pelv: { t: 0.2, len: 0.08, col: 0x1a2a5a },
    tail: { kind: 'lunate', len: 0.19, span: 0.26, col: 0x14244a }, eye: { t: 0.06, v: 0.25, r: 0.02, iris: 0xd0d8e8 }, bill: 0.22, billW: 0.013,
    paint: (t, v) => {
      let c = shade(0x14306e, 0xe8ecf2, -0.05, 0.25)(v);
      const bar = (t * 14) % 1;
      if (t > 0.15 && t < 0.9 && v > -0.3 && bar > 0.4 && bar < 0.55) c = mix(c, 0x9ac8ee, 0.55);
      return c;
    },
  },
  // 大目鮪：體高、眼睛大、胸鰭長；深藍背銀白肚；黃色離鰭；尾新月形
  mebachi: {
    tailLen: 0.19, prof: [[0, 0.016, 0.014, -0.004], [0.1, 0.12, 0.095, 0], [0.36, 0.18, 0.13, 0], [0.7, 0.1, 0.08, 0], [0.95, 0.02, 0.028, 0], [1, 0.016, 0.024, 0]],
    dorsal: [{ t0: 0.28, t1: 0.44, h: 0.08, shape: 'spiny', col: 0x14204a }, { t0: 0.5, t1: 0.58, h: 0.09, shape: 'falcate', col: 0xb8a040 }],
    anal: [{ t0: 0.56, t1: 0.64, h: 0.085, shape: 'falcate', col: 0xc8b860 }],
    pect: { t: 0.24, len: 0.24, col: 0x14204a, v: -0.1 }, pelv: { t: 0.27, len: 0.06, col: 0x6a7080 },
    tail: { kind: 'lunate', len: 0.2, span: 0.24, col: 0x101a3a }, eye: { t: 0.085, v: 0.3, r: 0.038, iris: 0xc8ccd8 },
    finlets: { n: 8, col: 0xe8c838 },
    paint: (t, v) => { let c = shade(0x0e1c44, 0xd0d4dc, 0.15, 0.25)(v); if (Math.abs(v - 0.15) < 0.1 && t > 0.1 && t < 0.85) c = mix(c, 0x3a5ab0, 0.4); return c; },
  },
  // 雙髻鯊（丫髻鮫）：T 字形槌頭、眼睛在兩端；高鐮刀形第一背鰭；歪尾（上葉長）；石板灰背、白肚
  shumoku: {
    tailLen: 0.24, prof: [[0, 0.012, 0.03, 0], [0.06, 0.04, 0.045, 0], [0.3, 0.085, 0.07, 0], [0.55, 0.07, 0.055, 0], [0.85, 0.03, 0.025, 0], [1, 0.018, 0.016, 0.006]],
    dorsal: [{ t0: 0.28, t1: 0.38, h: 0.17, shape: 'falcate', col: 0x56626c }, { t0: 0.74, t1: 0.78, h: 0.03, shape: 'falcate', col: 0x56626c }],
    anal: [{ t0: 0.72, t1: 0.76, h: 0.03, shape: 'falcate', col: 0x8a949c }],
    pect: { t: 0.22, len: 0.17, col: 0x5a6670, v: -0.6 }, pelv: { t: 0.55, len: 0.05, col: 0x8a949c },
    tail: { kind: 'shark', len: 0.24, span: 0.2, col: 0x56626c }, eye: { t: 0.02, v: 0, r: 0, iris: 0xd8d0a0 },
    hammer: { span: 0.15, len: 0.07, col: 0x6a747e, under: 0xdfe4e8 },
    paint: (t, v) => shade(0x5e6a74, 0xe8ecef, -0.2, 0.25)(v),
  },
  // 翻車魚（曼波魚）：巨大扁圓盤；背鰭臀鰭又高又尖；沒有正常尾巴，只有波浪狀舵鰭；銀灰斑駁
  manbou: {
    tailLen: 0.1, prof: [[0, 0.07, 0.03, -0.01], [0.06, 0.2, 0.05, 0], [0.3, 0.3, 0.07, 0], [0.6, 0.28, 0.065, 0], [0.85, 0.22, 0.05, 0], [1, 0.19, 0.04, 0]],
    dorsal: [{ t0: 0.66, t1: 0.82, h: 0.32, shape: 'falcate', col: 0x7a838c }], anal: [{ t0: 0.66, t1: 0.82, h: 0.32, shape: 'falcate', col: 0x8a929a }],
    pect: { t: 0.3, len: 0.07, col: 0x8a929a, v: 0.1 },
    tail: { kind: 'clavus', len: 0.1, span: 0.2, col: 0x9aa2a8, edge: 0x6e767e }, eye: { t: 0.08, v: 0.25, r: 0.022, iris: 0xc8ccd0 },
    paint: (t, v) => {
      let c = shade(0x7c858e, 0xd8dde0, -0.2, 0.5)(v);
      if (spot(t, v, 0.07, 0.22, 0.4, 29)) c = mix(c, 0xe6eaec, 0.5);
      if (spot(t, v, 0.05, 0.16, 0.22, 31)) c = mix(c, 0x5e666e, 0.45);
      return c;
    },
  },
  // ---------- 2026-11 新魚種 ----------
  // 嘉鱲（真鯛）：體高側扁、背高拱；粉紅玫瑰紅、藍色亮點；尾叉形、後緣暗
  madai: {
    tailLen: 0.2, prof: [[0, 0.008, 0.005, -0.01], [0.08, 0.09, 0.03, 0.01], [0.3, 0.21, 0.06, 0.03], [0.55, 0.17, 0.05, 0.01], [0.85, 0.07, 0.025, 0], [1, 0.045, 0.015, 0]],
    dorsal: [{ t0: 0.22, t1: 0.82, h: 0.09, shape: 'spiny', col: 0xd8707a }], anal: [{ t0: 0.6, t1: 0.82, h: 0.07, shape: 'soft', col: 0xe89aa0 }],
    pect: { t: 0.27, len: 0.2, col: 0xf0a0a8 }, pelv: { t: 0.32, len: 0.1, col: 0xf0b8bc },
    tail: { kind: 'fork', len: 0.2, span: 0.16, col: 0xd8606c, edge: 0x6a2a30 }, eye: { t: 0.08, v: 0.35, r: 0.03, iris: 0xe8c890 },
    paint: (t, v) => { let c = shade(0xe0606c, 0xf8e4e4, -0.2, 0.45)(v); if (v > -0.2 && t > 0.12 && t < 0.88 && spot(t, v, 0.04, 0.14, 0.15, 41)) c = 0x5aa8e8; return c; },
  },
  // 烏魚（鯔）：魚雷形、頭寬扁；暗灰背銀灰身、淡暗縱紋；兩個小背鰭分很開；尾叉形
  bora: {
    tailLen: 0.18, prof: [[0, 0.02, 0.03, -0.004], [0.08, 0.055, 0.075, 0], [0.3, 0.095, 0.085, 0], [0.65, 0.075, 0.06, 0], [0.95, 0.025, 0.02, 0], [1, 0.02, 0.016, 0]],
    dorsal: [{ t0: 0.36, t1: 0.44, h: 0.06, shape: 'spiny', col: 0x3a4450 }, { t0: 0.6, t1: 0.68, h: 0.05, shape: 'soft', col: 0x3a4450 }],
    anal: [{ t0: 0.6, t1: 0.7, h: 0.04, shape: 'soft', col: 0xb8c0c8 }],
    pect: { t: 0.22, len: 0.1, col: 0x5a6470, v: 0.2 }, pelv: { t: 0.36, len: 0.06, col: 0xc8d0d6 },
    tail: { kind: 'fork', len: 0.18, span: 0.13, col: 0x4a5460 }, eye: { t: 0.05, v: 0.2, r: 0.022, iris: 0xd8d0b0 },
    paint: (t, v) => { let c = shade(0x3a4652, 0xe4e8ec, 0.0, 0.4)(v); const st = Math.abs((((v * 7) % 1) + 1) % 1 - 0.5); if (v > -0.3 && v < 0.7 && st < 0.08 && t > 0.1) c = mix(c, 0x5a6672, 0.5); return c; },
  },
  // 河豚（鼓起來）：圓球、滿身小刺；橄欖褐背深色斑、雪白肚；小胸鰭、小圓尾
  fugu: {
    tailLen: 0.12, prof: [[0, 0.06, 0.06, 0], [0.08, 0.2, 0.2, 0], [0.4, 0.3, 0.3, 0], [0.75, 0.2, 0.2, 0], [0.95, 0.06, 0.06, 0], [1, 0.04, 0.04, 0]],
    dorsal: [{ t0: 0.72, t1: 0.82, h: 0.05, shape: 'soft', col: 0x8a7a48 }], anal: [{ t0: 0.72, t1: 0.82, h: 0.04, shape: 'soft', col: 0xe8e0c8 }],
    pect: { t: 0.2, len: 0.07, col: 0xc8b070, v: 0 },
    tail: { kind: 'round', len: 0.12, span: 0.08, col: 0xa89060 }, eye: { t: 0.12, v: 0.4, r: 0.04, iris: 0x40c0a0 },
    spikes: { n: 56, len: 0.045, col: 0xe8e0c8, t0: 0.12, t1: 0.85 },
    paint: (t, v) => { if (v < -0.15) return 0xf6f4ee; let c = shade(0x6a6a30, 0xc8c08a, 0.25, 0.4)(v); if (spot(t, v, 0.08, 0.2, 0.28, 61)) c = 0x2e2c1a; return c; },
  },
  // 紅鰷（紅石斑類）：粗壯大嘴；朱紅到珊瑚紅、淡暗橫帶；鰭緣鑲黃；圓尾
  akahata: {
    tailLen: 0.17, prof: [[0, 0.012, 0.01, -0.012], [0.1, 0.1, 0.065, 0], [0.35, 0.14, 0.078, 0.005], [0.7, 0.1, 0.055, 0], [1, 0.05, 0.025, 0]],
    dorsal: [{ t0: 0.22, t1: 0.5, h: 0.07, shape: 'spiny', col: 0xc83020, spots: 0xf0c030 }, { t0: 0.5, t1: 0.8, h: 0.08, shape: 'soft', col: 0xd84030, spots: 0xf0c030 }],
    anal: [{ t0: 0.62, t1: 0.8, h: 0.07, shape: 'soft', col: 0xd84030 }],
    pect: { t: 0.25, len: 0.14, col: 0xe8783a }, pelv: { t: 0.3, len: 0.08, col: 0xe05a3a },
    tail: { kind: 'round', len: 0.17, span: 0.12, col: 0xc83a28, edge: 0xf0c030 }, eye: { t: 0.08, v: 0.35, r: 0.026, iris: 0xe8d080 },
    paint: (t, v) => { let c = shade(0xc8281c, 0xf0806a, -0.3, 0.4)(v); if (t > 0.15 && t < 0.92 && v > -0.4 && Math.sin((t - 0.15) * Math.PI * 2 / 0.13) > 0.7) c = mix(c, 0x7a1a14, 0.35); return c; },
  },
  // 比目魚（牙鮃）：平躺的扁橢圓（背朝上）；兩眼在上面；沙褐斑點、底下雪白；邊緣一圈鰭；水平圓尾
  hirame: {
    tailLen: 0.14, prof: [[0, 0.012, 0.03, 0], [0.08, 0.028, 0.12, 0], [0.35, 0.035, 0.2, 0], [0.7, 0.028, 0.15, 0], [0.92, 0.015, 0.05, 0], [1, 0.012, 0.035, 0]],
    dorsal: [], anal: [],
    pect: { t: 0.25, len: 0, col: 0xa08a64 },
    tail: { kind: 'round', len: 0.14, span: 0.08, col: 0x9a845e, flat: true }, eye: { t: 0.1, v: 0.92, r: 0.022, iris: 0xd8c890 },
    sideFin: { t0: 0.06, t1: 0.92, w: 0.05, col: 0xa08a64, edge: 0x8a7450, ruffle: 10, oval: true },
    paint: (t, v) => { if (v < 0) return 0xf4f2ec; let c = 0xa88c62; if (spot(t, v, 0.06, 0.2, 0.3, 71)) c = 0x6a5438; else if (spot(t, v, 0.05, 0.16, 0.22, 73)) c = 0xd8c8a0; return c; },
  },
  // 金梭魚（魣）：又細又長、尖頭；銀身、背上暗色 V 字橫紋；兩個背鰭分很開；尾深叉
  kamasu: {
    tailLen: 0.15, prof: [[0, 0.006, 0.005, -0.006], [0.06, 0.035, 0.03, 0], [0.3, 0.06, 0.045, 0], [0.7, 0.05, 0.035, 0], [0.95, 0.016, 0.014, 0], [1, 0.013, 0.012, 0]],
    dorsal: [{ t0: 0.36, t1: 0.44, h: 0.04, shape: 'spiny', col: 0x3a4a5a }, { t0: 0.66, t1: 0.74, h: 0.035, shape: 'soft', col: 0x3a4a5a }],
    anal: [{ t0: 0.66, t1: 0.74, h: 0.03, shape: 'soft', col: 0xc8d0d8 }],
    pect: { t: 0.2, len: 0.07, col: 0x8a96a2 }, pelv: { t: 0.4, len: 0.05, col: 0xd0d6dc },
    tail: { kind: 'fork', len: 0.15, span: 0.11, col: 0x4a5868 }, eye: { t: 0.07, v: 0.3, r: 0.016, iris: 0xd8dce0 },
    paint: (t, v) => { let c = shade(0x4a5a6a, 0xeef2f4, 0.05, 0.3)(v); if (v > 0.15 && t > 0.12 && t < 0.9 && (((t * 16 + Math.abs(v - 0.55) * 0.9) % 1) + 1) % 1 < 0.3) c = mix(c, 0x2a323a, 0.6); return c; },
  },
  // 章魚：圓鼓的紅褐色頭（外套膜）；8 隻長腕往四周彎曲散開；沒有觸腕
  tako: {
    tailLen: 0, prof: [[0, 0.06, 0.06, 0], [0.1, 0.16, 0.15, 0], [0.35, 0.2, 0.18, 0], [0.6, 0.15, 0.13, 0], [0.75, 0.09, 0.085, 0], [0.85, 0.1, 0.1, 0], [1, 0.08, 0.08, 0]],
    dorsal: [], anal: [],
    pect: { t: 0.9, len: 0, col: 0xb0543a },
    tail: { kind: 'none', len: 0, span: 0, col: 0xb0543a }, eye: { t: 0.8, v: 0.45, r: 0.03, iris: 0xe0c060 },
    arms: { n: 8, len: 0.75, tent: 0, col: 0xb0543a, tip: 0xe0a080, th: 0.035, spread: 0.22, seg: 8 },
    paint: (t, v) => { let c = shade(0x9a3a26, 0xd88a6a, -0.3, 0.5)(v); if (v > -0.3 && spot(t, v, 0.05, 0.16, 0.25, 81)) c = mix(c, 0xe8a888, 0.5); return c; },
  },
  // 魟魚：菱形扁平盤、背面石板褐帶斑點、腹面淡白；鞭狀長尾、尾上硬棘
  ei: {
    tailLen: 0, prof: [[0, 0.01, 0.04, 0], [0.08, 0.03, 0.2, 0], [0.25, 0.045, 0.36, 0], [0.42, 0.04, 0.22, 0], [0.5, 0.022, 0.06, 0], [0.55, 0.012, 0.014, 0], [1, 0.003, 0.003, 0]],
    dorsal: [{ t0: 0.58, t1: 0.62, h: 0.025, shape: 'falcate', col: 0x3a3028 }], anal: [],
    pect: { t: 0.2, len: 0, col: 0x6a5a4a },
    tail: { kind: 'none', len: 0, span: 0, col: 0x4a4038 }, eye: { t: 0.1, v: 0.85, r: 0.015, iris: 0x8a7a50 },
    paint: (t, v) => { if (t > 0.52) return 0x4a4038; if (v < 0) return 0xf0ece4; let c = 0x6a5a4a; if (spot(t, v, 0.06, 0.25, 0.25, 91)) c = 0x3e3228; return c; },
  },
  // 皇帶魚（地震魚）：超長銀色緞帶；頭上鮮紅冠鬣、紅色背鰭一路到尾；紅色細長腹鰭
  ryugu: {
    tailLen: 0, prof: [[0, 0.02, 0.01, 0], [0.05, 0.042, 0.012, 0], [0.2, 0.046, 0.012, 0], [0.7, 0.034, 0.01, 0], [1, 0.006, 0.004, 0]],
    dorsal: [{ t0: 0, t1: 0.06, h: 0.12, shape: 'falcate', col: 0xe0202a }, { t0: 0.07, t1: 1, h: 0.035, shape: 'ribbon', col: 0xe83a3a }], anal: [],
    pect: { t: 0.06, len: 0.03, col: 0xe0303a }, pelv: { t: 0.08, len: 0.12, col: 0xe0303a },
    tail: { kind: 'none', len: 0, span: 0, col: 0xc0ccd8 }, eye: { t: 0.03, v: 0.2, r: 0.014, iris: 0xd8d8d8 },
    paint: (t, v) => { let c = shade(0xb8c4d0, 0xf2f6f8, 0.2, 0.5)(v); if (t > 0.08 && spot(t, v, 0.03, 0.3, 0.2, 101)) c = 0x5a6a7a; return c; },
  },
  // 鬼蝠魟：巨大菱形雙翼；深藍黑背、白色肩斑、白腹；兩片往前伸的頭鰭；細鞭尾
  manta: {
    tailLen: 0, prof: [[0, 0.03, 0.08, 0], [0.06, 0.05, 0.2, 0], [0.28, 0.06, 0.62, 0], [0.45, 0.05, 0.25, 0], [0.58, 0.025, 0.06, 0], [0.64, 0.012, 0.012, 0], [1, 0.003, 0.003, 0]],
    dorsal: [{ t0: 0.5, t1: 0.55, h: 0.03, shape: 'falcate', col: 0x161c28 }], anal: [],
    pect: { t: 0.2, len: 0, col: 0x1a2232 },
    tail: { kind: 'none', len: 0, span: 0, col: 0x161c28 }, eye: { t: 0.03, v: 0.2, r: 0.014, iris: 0x8a90a0 },
    horns: { len: 0.09, col: 0x1a2232 },
    paint: (t, v) => {
      if (t > 0.6) return 0x161c28;
      if (v < 0) return Math.abs(v) < 0.12 ? 0x2a3242 : 0xf2f4f6;
      // 白色肩斑：頭兩側、靠近身體中線
      if (t > 0.08 && t < 0.3 && v > 0.8 && v < 0.95) return 0xe8ecef;
      return 0x1a2232;
    },
  },
  // 鯨鯊：頭寬扁、大嘴在最前面；深石板藍背、淡白斑點和格紋；高背鰭；大新月尾
  jinbei: {
    tailLen: 0.24, prof: [[0, 0.05, 0.09, -0.01], [0.06, 0.08, 0.12, 0], [0.3, 0.12, 0.12, 0.01], [0.6, 0.09, 0.08, 0], [0.85, 0.04, 0.035, 0], [1, 0.025, 0.02, 0.006]],
    dorsal: [{ t0: 0.38, t1: 0.5, h: 0.13, shape: 'falcate', col: 0x2a3a52 }, { t0: 0.72, t1: 0.76, h: 0.04, shape: 'falcate', col: 0x2a3a52 }],
    anal: [{ t0: 0.72, t1: 0.76, h: 0.03, shape: 'falcate', col: 0x5a6a80 }],
    pect: { t: 0.2, len: 0.2, col: 0x34465e, v: -0.6 }, pelv: { t: 0.55, len: 0.05, col: 0x5a6a80 },
    tail: { kind: 'shark', len: 0.24, span: 0.24, col: 0x2a3a52 }, eye: { t: 0.05, v: 0.1, r: 0.012, iris: 0x8a9098 },
    paint: (t, v) => {
      if (t < 0.025 && Math.abs(v) < 0.25) return 0x1a1e24;
      if (v < -0.25) return 0xe8ecef;
      let c = shade(0x34465e, 0x8a9aae, -0.15, 0.2)(v);
      if (spot(t, v, 0.035, 0.14, 0.25, 111)) c = 0xe8eef2;
      else if (t > 0.1 && ((t * 24) % 1) < 0.08) c = mix(c, 0xc8d4de, 0.7);
      return c;
    },
  },
  // 大王烏賊：巨大紅到橘紅色的魚雷形外套膜；尾端大側鰭；又大又黑的眼睛；8 隻粗腕＋2 隻特長觸腕
  daiouika: {
    tailLen: 0, prof: [[0, 0.01, 0.01, 0], [0.06, 0.045, 0.05, 0], [0.3, 0.07, 0.08, 0], [0.62, 0.075, 0.085, 0], [0.7, 0.06, 0.07, 0], [0.74, 0.05, 0.055, 0], [0.84, 0.07, 0.075, 0], [1, 0.05, 0.05, 0]],
    dorsal: [], anal: [],
    pect: { t: 0.9, len: 0, col: 0xc84a30 },
    tail: { kind: 'none', len: 0, span: 0, col: 0xc84a30 }, eye: { t: 0.84, v: 0.2, r: 0.04, iris: 0x3a4048 },
    sideFin: { t0: 0, t1: 0.3, w: 0.14, col: 0xc83a24, edge: 0xe0563a, oval: true },
    arms: { n: 8, len: 0.4, tent: 0.95, col: 0xc84a30, tip: 0xe07a50, th: 0.022, seg: 6 },
    paint: (t, v) => { let c = shade(0xb0301c, 0xf0a080, -0.2, 0.5)(v); if (v > -0.2 && spot(t, v, 0.04, 0.16, 0.25, 121)) c = mix(c, 0x8a2010, 0.6); return c; },
  },
};

export const fishModelIds = () => Object.keys(S);

// ---------- 產生幾何 ----------
function prof(p: Prof, t: number) {
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (t <= b[0] || i === p.length - 2) {
      const k = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0] || 1)));
      const e = k * k * (3 - 2 * k);
      return { h: a[1] + (b[1] - a[1]) * e, w: a[2] + (b[2] - a[2]) * e, y: (a[3] ?? 0) + ((b[3] ?? 0) - (a[3] ?? 0)) * e };
    }
  }
  return { h: 0, w: 0, y: 0 };
}

class Tris {
  pos: number[] = []; col: number[] = [];
  private c = new THREE.Color();
  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, hex: number) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.c.setHex(hex);
    // 頂點色要線性（材質會轉回 sRGB）
    const r = this.c.r, g = this.c.g, b = this.c.b;
    for (let i = 0; i < 3; i++) this.col.push(r, g, b);
  }
  quad(a: number[], b: number[], c: number[], d: number[], hex: number) { this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], hex); this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], hex); }
}

/** 身體段數（沿身長 × 一圈）：夠看出斑點、又不會太多面 */
export const FISH_SEG = { along: 30, around: 20 };

/** 產生一條魚的幾何（頂點色、平面著色用）；不認得的 id 回 null */
export function buildFishGeometry(id: string): THREE.BufferGeometry | null {
  const s = S[id]; if (!s) return null;
  const T = new Tris();
  const Lb = 1 - s.tailLen;
  const X = (t: number) => 0.5 - t * Lb;
  const N = FISH_SEG.along, M = FISH_SEG.around;
  // 身體：一圈一圈
  const ring = (t: number) => {
    const p = prof(s.prof, t); const out: number[][] = [];
    for (let j = 0; j < M; j++) { const a = (j / M) * Math.PI * 2; out.push([X(t), p.y + p.h * Math.sin(a), p.w * Math.cos(a)]); }
    return out;
  };
  const tAt = (i: number) => Math.pow(i / N, 1.08);
  let prev = ring(0);
  for (let i = 1; i <= N; i++) {
    const t0 = tAt(i - 1), t1 = tAt(i), cur = ring(t1);
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M;
      const vm = Math.sin(((j + 0.5) / M) * Math.PI * 2);
      const col = s.paint((t0 + t1) / 2, vm, hash(i, j));
      T.quad(prev[j], cur[j], cur[j2], prev[j2], col);
    }
    prev = cur;
  }
  // 嘴尖、尾柄封口
  { const p0 = prof(s.prof, 0), r0 = ring(0); const tip = [X(0) + 0.012, p0.y, 0]; for (let j = 0; j < M; j++) { const j2 = (j + 1) % M; T.tri(tip[0], tip[1], tip[2], r0[j2][0], r0[j2][1], r0[j2][2], r0[j][0], r0[j][1], r0[j][2], s.paint(0, Math.sin(((j + 0.5) / M) * Math.PI * 2), 0)); } }
  { const p1 = prof(s.prof, 1), r1 = prev; const c = [X(1) - 0.004, p1.y, 0]; for (let j = 0; j < M; j++) { const j2 = (j + 1) % M; T.tri(c[0], c[1], c[2], r1[j][0], r1[j][1], r1[j][2], r1[j2][0], r1[j2][1], r1[j2][2], s.paint(1, 0, 0)); } }
  // 稜鱗：側線後段一排凸起的硬鱗（薄長條，左右各一）
  if (s.scutes) for (const sd of [-1, 1]) {
    const K = 10;
    for (let k = 0; k < K; k++) {
      const ta = 0.5 + 0.48 * k / K, tb = 0.5 + 0.48 * (k + 0.8) / K;
      const pa = prof(s.prof, ta), pb = prof(s.prof, tb);
      const ya = pa.y + pa.h * 0.05, yb = pb.y + pb.h * 0.05;
      T.quad([X(ta), ya + 0.008, sd * (pa.w + 0.003)], [X(tb), yb + 0.008, sd * (pb.w + 0.003)], [X(tb), yb - 0.008, sd * (pb.w + 0.003)], [X(ta), ya - 0.008, sd * (pa.w + 0.003)], s.scutes);
    }
  }
  // 背鰭／臀鰭：沿基部的條帶
  const finStrip = (f: Fin, up: number) => {
    const K = 10;
    const top = (u: number) => {
      switch (f.shape) {
        case 'spiny': return 0.75 + 0.25 * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) - 0.2 * ss(0.55, 0.7, u) * (1 - ss(0.7, 0.95, u)) - 0.6 * ss(0.85, 1, u);
        case 'soft': return Math.sin(Math.min(1, u * 1.3 + 0.2) * Math.PI * 0.75) * (1 - 0.7 * ss(0.8, 1, u));
        case 'falcate': return (1 - u) * (1 - u) * 1.1 + 0.15 * (1 - u);
        case 'sail': return 0.35 + 0.65 * Math.sin(Math.min(1, u * 2.2) * Math.PI * 0.5) - 0.45 * ss(0.3, 0.85, u) - 0.45 * ss(0.85, 1, u);
        case 'low': return 0.85 - 0.3 * u;
        case 'ribbon': return 1;
      }
    };
    for (let k = 0; k < K; k++) {
      const ua = k / K, ub = (k + 1) / K;
      const ta = f.t0 + (f.t1 - f.t0) * ua, tb = f.t0 + (f.t1 - f.t0) * ub;
      const pa = prof(s.prof, ta), pb = prof(s.prof, tb);
      const ba = pa.y + up * pa.h * 0.94, bb = pb.y + up * pb.h * 0.94;
      const ha = Math.max(0.002, f.h * top(ua)), hb = Math.max(0.002, f.h * top(ub));
      // 帆往後倒一點
      const lean = f.shape === 'falcate' ? 0.35 : f.shape === 'sail' ? 0.12 : 0.15;
      const col = f.spots && hash(k, up * 7 + Math.round(f.t0 * 100)) > 0.55 ? f.spots : f.col;
      T.quad([X(ta), ba, 0], [X(tb), bb, 0], [X(tb) - hb * lean, bb + up * hb, 0], [X(ta) - ha * lean, ba + up * ha, 0], col);
    }
  };
  for (const f of s.dorsal) finStrip(f, 1);
  // 頭足類側鰭：水平的薄片，左右各一（邊緣波浪）
  if (s.sideFin) {
    const sf = s.sideFin, K = 14;
    for (const sd of [-1, 1]) for (let k = 0; k < K; k++) {
      const ua = k / K, ub = (k + 1) / K;
      const ta = sf.t0 + (sf.t1 - sf.t0) * ua, tb = sf.t0 + (sf.t1 - sf.t0) * ub;
      const pa = prof(s.prof, ta), pb = prof(s.prof, tb);
      const wf = (u: number) => sf.oval ? sf.w * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.04)), 0.7) : sf.w * Math.min(1, u * 8, (1 - u) * 8);
      const ruf = (u: number) => Math.sin(u * Math.PI * (sf.ruffle ?? 0)) * 0.008;
      const za = sd * pa.w * 0.9, zb = sd * pb.w * 0.9;
      const col = sf.edge && k % 2 === 1 ? sf.edge : sf.col;
      T.quad([X(ta), pa.y, za], [X(tb), pb.y, zb], [X(tb), pb.y + ruf(ub), zb + sd * wf(ub)], [X(ta), pa.y + ruf(ua), za + sd * wf(ua)], col);
    }
  }
  // 頭足類的腕＋觸腕：從身體尾端（頭）往 -x 拖，三角形斷面的細長條
  if (s.arms) {
    const A = s.arms, pe = prof(s.prof, 1), x0 = X(1) + 0.01, S = A.seg ?? 5, SP = A.spread ?? 0;
    const arm = (a: number, L: number, th: number, club: boolean, seed: number) => {
      const r0 = Math.min(pe.h, pe.w) * 0.75;
      let prevR: number[][] | null = null;
      for (let i = 0; i <= S; i++) {
        const u = i / S;
        // 章魚：腕往四周散開，尾端往外捲
        const rr = r0 * (1 - 0.55 * u) + SP * u * u * (1 + 0.3 * Math.sin(u * 4 + seed));
        const cx = x0 - L * u * (1 - 0.35 * SP * u), cy = pe.y + rr * Math.sin(a) + Math.sin(u * 3 + seed) * 0.012 * u, cz = rr * Math.cos(a) + Math.cos(u * 2.5 + seed) * 0.01 * u;
        const w = club && u > 0.7 ? th * 1.5 : th * (1 - 0.8 * u) + 0.0015;
        const ring = [0, 1, 2].map(j => { const b = (j / 3) * Math.PI * 2 + a; return [cx, cy + w * Math.sin(b), cz + w * Math.cos(b)]; });
        if (prevR) for (let j = 0; j < 3; j++) { const j2 = (j + 1) % 3; T.quad(prevR[j], ring[j], ring[j2], prevR[j2], u > 0.75 ? A.tip : A.col); }
        prevR = ring;
      }
      if (prevR) { const e = [x0 - L - 0.008, prevR[0][1], prevR[0][2]]; for (let j = 0; j < 3; j++) { const j2 = (j + 1) % 3; T.tri(prevR[j][0], prevR[j][1], prevR[j][2], prevR[j2][0], prevR[j2][1], prevR[j2][2], e[0], e[1], e[2], A.tip); } }
    };
    for (let k = 0; k < A.n; k++) arm((k / A.n) * Math.PI * 2 + 0.2, A.len * (0.85 + 0.15 * hash(k, 3)), A.th, false, k);
    if (A.tent > 0) { arm(-0.5, A.tent, A.th * 0.6, true, 11); arm(Math.PI + 0.5, A.tent, A.th * 0.6, true, 13); }
  }
  // 雙髻鯊的槌頭：頭前面一片往左右伸出去的扁平板，眼睛在兩端
  if (s.hammer) {
    const H = s.hammer, p = prof(s.prof, 0.02), y = p.y, th = 0.018, K = 8;
    const xf = X(0) + 0.012, xb = X(H.len);
    const edge = (u: number) => { const z = (u * 2 - 1) * H.span; const q = Math.abs(u * 2 - 1); return { z, f: xf - 0.018 * q * q, b: xb + (xf - xb) * 0.45 * Math.pow(q, 3), t: th * (1 - 0.45 * q) }; };
    for (let k = 0; k < K; k++) {
      const a = edge(k / K), b = edge((k + 1) / K);
      T.quad([a.f, y + a.t, a.z], [b.f, y + b.t, b.z], [b.b, y + b.t, b.z], [a.b, y + a.t, a.z], H.col);
      T.quad([a.f, y - a.t, a.z], [a.b, y - a.t, a.z], [b.b, y - b.t, b.z], [b.f, y - b.t, b.z], H.under);
      T.quad([a.f, y + a.t, a.z], [a.f, y - a.t, a.z], [b.f, y - b.t, b.z], [b.f, y + b.t, b.z], H.col);
      T.quad([a.b, y + a.t, a.z], [b.b, y + b.t, b.z], [b.b, y - b.t, b.z], [a.b, y - a.t, a.z], H.col);
    }
    for (const sd of [-1, 1]) {
      const e = edge(sd < 0 ? 0 : 1), ex = (e.f + e.b) / 2, ez = sd * (H.span + 0.004), r = 0.015;
      T.quad([e.f, y + e.t, sd * H.span], [e.f, y - e.t, sd * H.span], [e.b, y - e.t, sd * H.span], [e.b, y + e.t, sd * H.span], H.col);
      const P = [[ex + r, y, ez], [ex - r, y, ez], [ex, y + r, ez], [ex, y - r, ez], [ex, y, ez + sd * r], [ex, y, ez - sd * r * 0.3]];
      const F = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
      for (const f of F) { const a = P[f[0]], b = P[f[1]], c = P[f[2]]; T.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], 0x0c0d10); }
    }
  }
  // 河豚的刺：沿身體表面法線長出的小三角錐
  if (s.spikes) {
    const K = s.spikes;
    for (let k = 0; k < K.n; k++) {
      const t = K.t0 + (K.t1 - K.t0) * hash(k, 1, 5), a = hash(k, 2, 5) * Math.PI * 2, p = prof(s.prof, t);
      const P = [X(t), p.y + p.h * Math.sin(a), p.w * Math.cos(a)];
      let ny = Math.sin(a) / Math.max(1e-3, p.h), nz = Math.cos(a) / Math.max(1e-3, p.w); const nl = Math.hypot(ny, nz) || 1; ny /= nl; nz /= nl;
      const tip = [P[0], P[1] + ny * K.len, P[2] + nz * K.len], r = K.len * 0.3;
      // 底面三點：沿 x 跟（法線×x）
      const B = [0, 1, 2].map(m => { const th = (m / 3) * Math.PI * 2; return [P[0] + Math.cos(th) * r, P[1] - nz * Math.sin(th) * r, P[2] + ny * Math.sin(th) * r]; });
      for (let m = 0; m < 3; m++) { const b0 = B[m], b1 = B[(m + 1) % 3]; T.tri(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], tip[0], tip[1], tip[2], K.col); }
    }
  }
  // 鬼蝠魟的頭鰭：頭前面左右兩片往前伸
  if (s.horns) {
    const H = s.horns, p = prof(s.prof, 0.04), x = X(0.04), y = p.y;
    for (const sd of [-1, 1]) {
      const zi = sd * p.w * 0.45, zo = sd * p.w * 0.8;
      T.quad([x, y + 0.012, zi], [x + H.len, y + 0.004, zi * 0.9], [x + H.len * 0.9, y - 0.014, zo * 0.85], [x, y - 0.016, zo], H.col);
      T.quad([x, y + 0.012, zi], [x, y - 0.016, zo], [x + H.len * 0.9, y - 0.014, zo * 0.85], [x + H.len, y + 0.004, zi * 0.9], 0xe8ecef);
    }
  }
  for (const f of s.anal) finStrip(f, -1);
  // 離鰭（鮪魚類）：背／腹後段一排小三角
  if (s.finlets) {
    const n = s.finlets.n;
    for (let k = 0; k < n; k++) {
      const t = 0.68 + 0.3 * (k + 0.5) / n; const p = prof(s.prof, t); const sz = 0.018 * (1 - k / (n * 1.6));
      for (const up of [1, -1]) { const by = p.y + up * p.h * 0.92; T.tri(X(t) + sz * 0.5, by, 0, X(t) - sz * 0.6, by, 0, X(t) - sz * 0.9, by + up * sz * 1.2, 0, s.finlets.col); }
    }
  }
  // 胸鰭／腹鰭：身體兩側斜往後
  const paired = (t: number, len: number, col: number, vv: number, spread: number) => {
    const p = prof(s.prof, t);
    for (const sd of [-1, 1]) {
      const x = X(t), y = p.y + p.h * vv, z = sd * p.w * Math.cos(Math.asin(Math.max(-1, Math.min(1, vv))));
      T.tri(x, y + 0.018, z, x, y - 0.018, z, x - len, y - len * 0.25, z + sd * len * spread, col);
      T.tri(x, y - 0.018, z, x - len * 0.8, y - len * 0.45, z + sd * len * spread * 0.8, x - len, y - len * 0.25, z + sd * len * spread, col);
    }
  };
  if (s.pect.len > 0) paired(s.pect.t, s.pect.len, s.pect.col, s.pect.v ?? -0.25, 0.35);
  if (s.pelv) paired(s.pelv.t, s.pelv.len, s.pelv.col, -0.85, 0.25);
  // 尾鰭
  if (s.tail.kind !== 'none') {
    const pe0 = prof(s.prof, 1), flat = !!s.tail.flat;
    // 平躺的魚：尾鰭畫在水平面（用身體寬度當基部）
    const pe = flat ? { ...pe0, h: pe0.w } : pe0;
    const x0 = X(1), y0 = pe.y, L = s.tail.len, H = s.tail.span;
    let pts: number[][];
    switch (s.tail.kind) {
      case 'fork': pts = [[x0, y0 + pe.h], [x0 - L * 0.55, y0 + H * 0.6], [x0 - L, y0 + H], [x0 - L * 0.62, y0 + H * 0.15], [x0 - L * 0.45, y0], [x0 - L * 0.62, y0 - H * 0.15], [x0 - L, y0 - H], [x0 - L * 0.55, y0 - H * 0.6], [x0, y0 - pe.h]]; break;
      case 'lunate': pts = [[x0, y0 + pe.h], [x0 - L * 0.5, y0 + H * 0.45], [x0 - L * 0.95, y0 + H], [x0 - L * 0.55, y0 + H * 0.25], [x0 - L * 0.42, y0], [x0 - L * 0.55, y0 - H * 0.25], [x0 - L * 0.95, y0 - H], [x0 - L * 0.5, y0 - H * 0.45], [x0, y0 - pe.h]]; break;
      case 'round': pts = [[x0, y0 + pe.h], [x0 - L * 0.5, y0 + H * 0.85], [x0 - L * 0.85, y0 + H * 0.6], [x0 - L, y0 + H * 0.2], [x0 - L, y0 - H * 0.2], [x0 - L * 0.85, y0 - H * 0.6], [x0 - L * 0.5, y0 - H * 0.85], [x0, y0 - pe.h]]; break;
      // 鯊魚歪尾：上葉又長又高，下葉短
      case 'shark': pts = [[x0, y0 + pe.h], [x0 - L * 0.55, y0 + H * 0.55], [x0 - L, y0 + H], [x0 - L * 0.84, y0 + H * 0.78], [x0 - L * 0.45, y0 + H * 0.14], [x0 - L * 0.5, y0 - H * 0.12], [x0 - L * 0.36, y0 - H * 0.45], [x0 - L * 0.12, y0 - H * 0.2], [x0, y0 - pe.h]]; break;
      // 翻車魚的舵鰭：整個後緣一圈波浪
      case 'clavus': { pts = [[x0, y0 + pe.h]]; const n = 9; for (let k = 0; k <= n; k++) pts.push([x0 - L * (k % 2 ? 1 : 0.72), y0 + Math.max(H, pe.h * 0.95) * (1 - (2 * k) / n)]); pts.push([x0, y0 - pe.h]); break; }
      default: pts = [[x0, y0 + pe.h], [x0 - L * 0.6, y0 + H * 0.8], [x0 - L, y0 + H], [x0 - L * 0.93, y0], [x0 - L, y0 - H], [x0 - L * 0.6, y0 - H * 0.8], [x0, y0 - pe.h]];
    }
    const cx = x0 + 0.01, cy = y0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const outer = Math.min(Math.abs(a[0] - x0), Math.abs(b[0] - x0)) > L * 0.75;
      const tc = s.tail.edge && outer ? s.tail.edge : s.tail.col;
      if (flat) T.tri(cx, cy, 0, a[0], y0, a[1] - y0, b[0], y0, b[1] - y0, tc);
      else T.tri(cx, cy, 0, a[0], a[1], 0, b[0], b[1], 0, tc);
    }
  }
  // 尖嘴（旗魚）
  if (s.bill) {
    const p = prof(s.prof, 0.02); const x = X(0.02), y = p.y + 0.004, b = s.billW ?? 0.008, L = s.bill;
    const tip = [x + L, y - 0.004, 0];
    const q = [[x, y + b, 0], [x, y, b], [x, y - b, 0], [x, y, -b]];
    for (let k = 0; k < 4; k++) { const a = q[k], c = q[(k + 1) % 4]; T.tri(tip[0], tip[1], tip[2], a[0], a[1], a[2], c[0], c[1], c[2], 0x1a2440); }
  }
  // 眼睛：虹膜（淺色八角盤）＋黑瞳（小八面體），左右各一（雙髻鯊的眼睛畫在槌頭兩端）
  if (s.eye.r > 0) {
    const p = prof(s.prof, s.eye.t); const x = X(s.eye.t), y = p.y + p.h * s.eye.v;
    const zc = p.w * Math.cos(Math.asin(Math.max(-1, Math.min(1, s.eye.v))));
    for (const sd of [-1, 1]) {
      const z = sd * (zc + 0.002), r = s.eye.r;
      for (let k = 0; k < 8; k++) {
        const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2;
        T.tri(x, y, z, x + Math.cos(a0) * r, y + Math.sin(a0) * r, z, x + Math.cos(a1) * r, y + Math.sin(a1) * r, z, s.eye.iris);
      }
      const pr = r * 0.62, pz = z + sd * pr * 0.5;
      const P = [[x + pr, y, pz], [x - pr, y, pz], [x, y + pr, pz], [x, y - pr, pz], [x, y, pz + sd * pr * 0.6], [x, y, pz - sd * pr * 0.6]];
      const F = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
      for (const f of F) { const a = P[f[0]], b = P[f[1]], c = P[f[2]]; T.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], 0x0c0d10); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(T.col, 3));
  // 正規化：全長 1、置中
  g.computeBoundingBox();
  const bb = g.boundingBox!; const len = bb.max.x - bb.min.x || 1;
  g.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
  g.scale(1 / len, 1 / len, 1 / len);
  g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** 共用材質：頂點色、雙面（鰭是單片）、平面著色 */
let mat: THREE.MeshLambertMaterial | null = null;
export function fishMaterial() { return (mat ??= new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true })); }
/** 剪影（還沒釣過）：一樣外形、全暗 */
let silMat: THREE.MeshBasicMaterial | null = null;
export function fishSilMaterial() { return (silMat ??= new THREE.MeshBasicMaterial({ color: 0x55606b, side: THREE.DoubleSide })); }
/** 幾何快取（同一種魚只產生一次）；dispose 全部清掉 */
const cache = new Map<string, THREE.BufferGeometry>();
const photoMats = new Map<string, THREE.MeshBasicMaterial>();
const photoTexs = new Map<string, THREE.Texture>();

/** 照片魚的平面卡片（高＝1、寬依圖片比例，面向 +z）；給手上秀漁獲用 */
function photoFishGeometry(id: string): THREE.BufferGeometry | null {
  if (!FISH_PHOTO[id]) return null;
  let g = cache.get(id);
  if (g) return g;
  // 上傳圖 168×198
  const geo = new THREE.PlaneGeometry(168 / 198, 1);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  geo.computeVertexNormals();
  cache.set(id, geo);
  return geo;
}

export function fishPhotoMaterial(id: string): THREE.MeshBasicMaterial | null {
  if (!FISH_PHOTO[id]) return null;
  let m = photoMats.get(id);
  if (m) return m;
  try {
    const tex = new THREE.TextureLoader().load(FISH_PHOTO[id]);
    tex.colorSpace = THREE.SRGBColorSpace;
    photoTexs.set(id, tex);
    m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  } catch {
    m = new THREE.MeshBasicMaterial({ color: 0x8899aa, side: THREE.DoubleSide, transparent: true });
  }
  photoMats.set(id, m);
  return m;
}

/** 秀漁獲／圖鑑以外的 3D 場景：3D 魚或照片平面；認不得的 id 回 null，不會丟例外 */
export function makeFishMesh(id: string): THREE.Mesh | null {
  if (isPhotoFish(id)) {
    const geo = photoFishGeometry(id), mat = fishPhotoMaterial(id);
    if (!geo || !mat) return null;
    return new THREE.Mesh(geo, mat);
  }
  const geo = fishGeometry(id);
  if (!geo) return null;
  return new THREE.Mesh(geo, fishMaterial());
}

export function fishGeometry(id: string) {
  if (isPhotoFish(id)) return photoFishGeometry(id);
  let g = cache.get(id); if (!g) { const n = buildFishGeometry(id); if (!n) return null; g = n; cache.set(id, g); } return g;
}
export function disposeFishGeometries() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
  mat?.dispose(); mat = null;
  silMat?.dispose(); silMat = null;
  for (const m of photoMats.values()) m.dispose();
  photoMats.clear();
  for (const t of photoTexs.values()) t.dispose();
  photoTexs.clear();
}
