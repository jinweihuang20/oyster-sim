/**
 * 奇物圖鑑（主線／死鬥共用）。
 * 硬規則：只能在陣列「最末」追加；存檔用索引，禁止插入／刪除／重排。
 */
export type OddDef = {
  name: string;
  /** UI／網格用色（#rrggbb） */
  color: string;
  /** 掉落權重；愈小愈稀有（≤2 傳說、≤10 稀有…） */
  weight: number;
  price: number;
  /** 未收集時圖鑑提示 */
  tease: string;
  /** 找到時台詞 */
  line: string;
  /** 阿婆吐槽 */
  cry: string[];
  /** emoji 圖示（與 icon 二擇一） */
  emoji?: string;
  /** SVG path 內容（viewBox 0 0 24 24；與 emoji 二擇一） */
  icon?: string;
  /** 活動限定：一般池／死鬥掉落不抽 */
  limited?: boolean;
};

export const ODD: OddDef[] = [
  { name: '假牙', color: '#f0e8e0', weight: 30, emoji: '🦷', tease: '聽說有人在蚵裡挖到…會笑的東西', price: 50, line: '誰的假牙啦！？', cry: ['哎唷，那不是阿雄伯的嗎？', '笑死，假牙也會長蚵仔'] },
  { name: '古早硬幣', color: '#c08a40', weight: 30, emoji: '🪙', tease: '圓圓的、銀色的，老古董', price: 300, line: '日治時代的銀幣！', cry: ['古董喔！可以賣錢！', '我阿公以前也有收'] },
  { name: '金戒指', color: '#f2c440', weight: 10, emoji: '💍', tease: '某人的定情物遺落在海裡…', price: 2500, line: '金戒指！誰的定情物？', cry: ['金的耶！給我看看！', '這要不要報警？'] },
  { name: '小螃蟹', color: '#e05a3a', weight: 30, emoji: '🦀', tease: '小心，會夾手！', price: 0, line: '螃蟹夾手了！！', cry: ['快甩！快甩！', '哈哈哈，牠夾得好緊'] },
  { name: '統一發票', color: '#f4f4f0', weight: 24, price: 5, emoji: '🧾', tease: '溼溼的紙…上面有號碼', line: '誰的發票塞進蚵仔裡！', cry: ['快對對看有沒有中！', '溼答答的，號碼看不清了'] },
  { name: '幾枚銅板', color: '#c89a50', weight: 24, price: 20, emoji: '🪙', tease: '叮叮噹噹的零錢聲', line: '十塊、五塊…發財了！', cry: ['蚵仔也會存錢喔', '拿去買飲料'] },
  { name: '機車鎖匙', color: '#a8b0b8', weight: 16, price: 0, emoji: '🔑', tease: '某人一直在找的東西', line: '誰的機車鑰匙？！', cry: ['阿明找一整天了！', '快去廣播！'] },
  { name: '珍奶吸管', color: '#3a6ad8', weight: 16, price: 1, emoji: '🥤', tease: '粗粗的、塑膠的…海洋垃圾', line: '珍珠奶茶的粗吸管…', cry: ['海洋垃圾啦！', '不是那種珍珠啦'] },
  { name: '紅包', color: '#d8282a', weight: 9, price: 600, emoji: '🧧', tease: '紅紅的、過年才有', line: '紅包！裡面有錢！', cry: ['恭喜發財！', '分我一半啦'] },
  { name: '媽祖平安符', color: '#e8b030', weight: 7, price: 888, emoji: '🏮', tease: '有神明保佑的東西', line: '媽祖的平安符！', cry: ['媽祖保佑！', '今天一定好運'] },
  { name: '筊杯', color: '#c0302a', weight: 6, price: 400, emoji: '🌙', tease: '一對紅紅的半月', line: '一對筊杯！聖筊！', cry: ['問神明今天會不會贏', '笑死人了哈哈'] },
  { name: '大同電鍋公仔', color: '#e04a3a', weight: 4, price: 1200, emoji: '🍚', tease: '台灣人家家都有一台的…迷你版', line: '大同電鍋迷你公仔！', cry: ['收藏價值高喔！', '我家那台用三十年了'] },
  { name: '中獎發票', color: '#ffe07a', weight: 1, price: 8000, emoji: '🎫', tease: '傳說有人在蚵裡挖到千萬…', line: '中獎了！！是頭獎！', cry: ['快去領！快去領！', '請客！請客！'] },
  { name: '開港紀念蚵', color: '#c8443a', weight: 0, price: 0, emoji: '⚓', tease: '活動限定：開港紀念包才拿得到', line: '開港紀念，蚵仔大豐收！', cry: ['這顆是紀念的喔！', '開港大吉！'], limited: true },
  // 2026-11 新增 20 種怪奇物（只能接在最後面，存檔用索引）
  { name: '會說話的鹹酥雞', color: '#d8962a', weight: 22, price: 30, emoji: '', tease: '聞起來很香…好像還會講話', line: '一直說「加辣嗎？」', cry: ['不要辣，謝謝！', '鹹酥雞怎麼跑進蚵裡啦'], icon: "<path d='M6 9h12l-2 12H8z'/><path d='M9 9V6a3 3 0 0 1 6 0v3M10 14h.01M14 14h.01M10 17h4'/>" },
  { name: '插著吸管的蚵', color: '#b8b0a0', weight: 22, price: 15, emoji: '', tease: '有人在蚵裡留了一根管子', line: '好像有人先喝過了', cry: ['誰先喝的啦！', '蚵仔也可以外帶喔？'], icon: "<path d='M3 15c0-4 4-7 9-7s9 3 9 7-4 5-9 5-9-1-9-5z'/><path d='M13 12l5-10h3'/>" },
  { name: '迷你斑馬線', color: '#f4f4f0', weight: 22, price: 40, emoji: '', tease: '一條一條白白的…有誰在等', line: '有一隻螃蟹正在乖乖等紅燈', cry: ['好有交通道德', '綠燈了，快過！'], icon: "<path d='M3 20h18M3 4h18M6 7v10M10 7v10M14 7v10M18 7v10'/>" },
  { name: '會自己捲起來的海帶', color: '#4a8a4a', weight: 22, price: 25, emoji: '', tease: '軟軟的、綠綠的，會自己動', line: '捲成「謝謝光臨」四個字', cry: ['這海帶很有禮貌', '歡迎再來！'], icon: "<path d='M12 21c-4-3 4-6 0-9s4-6 0-9'/><path d='M7 21c-3-3 3-6 0-9M17 12c3-3-3-6 0-9'/>" },
  { name: '夾娃娃機的夾子', color: '#c0c8d0', weight: 22, price: 60, emoji: '', tease: '鐵做的，三根爪子', line: '裡面還夾著一顆更小的蚵', cry: ['保夾成功！', '這台機台好佛心'], icon: "<path d='M12 2v7M8 9h8M8 9l-3 6 3 4M16 9l3 6-3 4M12 9v9'/><circle cx='12' cy='19' r='2'/>" },
  { name: '珍珠奶茶的珍珠', color: '#a07858', weight: 14, price: 120, emoji: '', tease: '黑黑圓圓的…不像珍珠', line: '這顆不是我生的。', cry: ['蚵仔說不是牠的', '拿去配奶茶啦'], icon: "<circle cx='12' cy='13' r='7'/><path d='M9 11a3 3 0 0 1 3-2M12 6V2'/>" },
  { name: '迷你麥克風', color: '#8a8a98', weight: 14, price: 200, emoji: '', tease: '小小的，好像想唱歌', line: '一拿出來就自己開始唱〈愛拚才會贏〉', cry: ['三分天註定！', '七分靠打拚！'], icon: "<rect x='9' y='2' width='6' height='11' rx='3'/><path d='M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8'/>" },
  { name: '里長的名片', color: '#f0e6c8', weight: 14, price: 150, emoji: '', tease: '一張小紙片，上面印著頭銜', line: '背面寫著「有事找我」', cry: ['里長伯人真好', '水溝不通也可以找嗎？'], icon: "<rect x='2' y='6' width='20' height='12'/><circle cx='8' cy='12' r='2'/><path d='M13 10h6M13 14h4'/>" },
  { name: '會發熱的暖暖包', color: '#e87a4a', weight: 14, price: 100, emoji: '', tease: '摸起來…怎麼是溫的？', line: '在海裡泡了不知道多久，還是熱的', cry: ['好暖喔，借我握一下', '品質太好了吧'], icon: "<rect x='5' y='5' width='14' height='16'/><path d='M9 2c-1 1 1 2 0 3M12 2c-1 1 1 2 0 3M15 2c-1 1 1 2 0 3M9 13h6'/>" },
  { name: '小烏龜', color: '#5a9a5a', weight: 14, price: 0, emoji: '', tease: '慢吞吞的，背著一個家', line: '自己慢慢爬出蚵殼走了', cry: ['慢走喔～', '不要跑太快'], icon: "<path d='M4 15a8 6 0 0 1 16 0z'/><path d='M20 13h2M5 15l-1 3M19 15l1 3M9 15l-1 3M15 15l1 3M9 11l3-2 3 2'/>" },
  { name: '迷你神明', color: '#e8b030', weight: 5, price: 1500, emoji: '', tease: '坐得很端正，好像在保佑誰', line: '一尊小小的土地公，坐得很端正', cry: ['快拜一下！', '福德正神保佑'], icon: "<circle cx='12' cy='6' r='3'/><path d='M7 21v-8l5-3 5 3v8zM5 21h14M10 16c1 1 3 1 4 0'/>" },
  { name: '摺好的紅包', color: '#d8282a', weight: 5, price: 3, emoji: '', tease: '紅紅的、摺得很整齊', line: '裡面是 3 塊錢和一張「謝謝」', cry: ['三塊也是心意', '哈哈哈，好有禮貌'], icon: "<rect x='6' y='2' width='12' height='20'/><path d='M6 8l6 4 6-4'/><circle cx='12' cy='15' r='2'/>" },
  { name: '會響的手機', color: '#8ab0d8', weight: 5, price: 800, emoji: '', tease: '裡面傳出鈴聲…', line: '來電顯示「阿母」', cry: ['快接！是阿母！', '阿母找你吃飯啦'], icon: "<rect x='7' y='2' width='10' height='20'/><path d='M11 18h2M3 7c-1 2-1 4 0 6M21 7c1 2 1 4 0 6'/>" },
  { name: '一副假睫毛', color: '#e0a8c0', weight: 5, price: 600, emoji: '', tease: '彎彎的、黑黑的兩條', line: '比蚵還要漂亮', cry: ['好會畫喔', '借我戴一下'], icon: "<path d='M2 12c3-3 6-3 9 0M13 12c3-3 6-3 9 0M3 11l-1-3M6 9.5l-1-3M9 10l1-3M14 11l-1-3M17 9.5l-1-3M20 10l1-3'/>" },
  { name: '迷你漁船', color: '#3a7ac0', weight: 5, price: 1200, emoji: '', tease: '小小的，有船帆', line: '裡面坐著更小的阿伯在補網', cry: ['阿伯辛苦了！', '今天有沒有漁獲？'], icon: "<path d='M3 15h18l-3 5H6z'/><path d='M12 15V3l6 9h-6'/>" },
  { name: '一整碗蚵仔煎', color: '#e86a4a', weight: 1, price: 6000, emoji: '', tease: '熱熱的…還有醬汁的味道', line: '熱騰騰的，還附醬', cry: ['蚵仔煎自己出來了！', '分我一口啦'], icon: "<path d='M3 11h18a9 9 0 0 1-18 0z'/><path d='M9 20h6M8 3c-1 2 1 3 0 5M12 3c-1 2 1 3 0 5M16 3c-1 2 1 3 0 5'/>" },
  { name: '另一個蚵', color: '#b8a890', weight: 1, price: 8000, emoji: '', tease: '蚵裡面…好像還有東西', line: '打開裡面還有一個蚵，裡面又有一個蚵……', cry: ['剝不完了啦！', '蚵中蚵中蚵'], icon: "<path d='M2 13c0-5 4-9 10-9s10 4 10 9-4 7-10 7S2 18 2 13z'/><path d='M7 13c0-2 2-4 5-4s5 2 5 4-2 3-5 3-5-1-5-3z'/><circle cx='12' cy='13' r='1'/>" },
  { name: '外星人名片', color: '#7ae0a0', weight: 1, price: 9999, emoji: '', tease: '不像是地球的東西', line: '聯絡方式是「看天上」', cry: ['外星人也剝蚵喔？', '快抬頭看看！'], icon: "<rect x='2' y='7' width='20' height='12'/><path d='M7 15c-2 0-2-5 0-5s2 5 0 5zM12 11h6M12 15h4M17 3l-2 4'/>" },
  { name: '過期的樂透彩券', color: '#f2d060', weight: 1, price: 0, emoji: '', tease: '六個號碼…好像哪裡不對', line: '對了六個號碼，但是是去年的', cry: ['差一年啦！！', '好可惜喔…'], icon: "<rect x='3' y='4' width='18' height='16'/><circle cx='8' cy='10' r='1.5'/><circle cx='12' cy='10' r='1.5'/><circle cx='16' cy='10' r='1.5'/><path d='M6 16h12M4 5l16 14'/>" },
  { name: '縮小的阿婆', color: '#d0a0b0', weight: 1, price: 10000, emoji: '', tease: '有人說…在蚵裡看到自己', line: '長得跟你一模一樣，正在剝更小的蚵', cry: ['那不是你嗎！？', '她也在剝蚵耶'], icon: "<circle cx='12' cy='5' r='3'/><path d='M8 21l1-8h6l1 8M9 13l-3 3M15 13l2 2M17 15l2-2'/>" },
];

export const rarOfOdd = (weight: number) => (weight <= 2 ? 'legend' : weight <= 10 ? 'rare' : weight <= 20 ? 'uncommon' : 'common');

/** 死鬥／一般池：排除活動限定 */
export const oddDropPool = (): number[] => {
  const idx: number[] = [];
  for (let i = 0; i < ODD.length; i++) if (!ODD[i].limited && ODD[i].weight > 0) idx.push(i);
  return idx;
};

/** 依權重抽一筆奇物索引 */
export function rollOddIndex(rng: () => number = Math.random): number {
  const pool = oddDropPool();
  let sum = 0;
  for (const i of pool) sum += ODD[i].weight;
  let r = rng() * sum;
  for (const i of pool) {
    r -= ODD[i].weight;
    if (r <= 0) return i;
  }
  return pool[pool.length - 1] ?? 0;
}
