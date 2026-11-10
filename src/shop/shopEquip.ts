export type Slot = 'head' | 'hand' | 'body' | 'legs' | 'feet';
export type Fx = { bowl?: number; keep?: number; speed?: number; pearl?: number; nag?: number; throw?: number; dmg?: number; luck?: number };
export type Eq = { id: string; slot: Slot; n: string; price: number; eff: string; base: string; pat: string; fx: Fx };
export const SLOTS: [Slot, string][] = [['head', '頭'], ['hand', '手'], ['body', '衣服'], ['legs', '褲子'], ['feet', '鞋子']];
export const NONE_ID: Record<Slot, string> = { head: 'hd_none', hand: 'hn_none', body: 'bd_none', legs: 'lg_none', feet: 'ft_none' };
export const isNoneId = (id?: string | null) => !!id && (id === 'none' || id.endsWith('_none'));
export const EQUIP: Eq[] = [
  { slot: 'head', id: 'hd_basic', n: '花布頭巾', price: 0, eff: '基本款', base: '#c84a5a', pat: 'flower', fx: {} },
  { slot: 'head', id: 'hd_hat', n: '斗笠', price: 3000, eff: '殼比較難砸到臉，被丟殼的機率 -10%', base: '#d8b46a', pat: 'plain', fx: { throw: 0.9 } },
  { slot: 'head', id: 'hd_fisher', n: '漁夫帽', price: 9000, eff: '帽簷壓低，阿婆唸你的機率 -10%', base: '#4a6a8a', pat: 'plain', fx: { nag: 0.9 } },
  { slot: 'head', id: 'hd_helmet', n: '工地安全帽', price: 20000, eff: '受到的傷害 -15%', base: '#ffb21a', pat: 'plain', fx: { dmg: 0.85 } },
  { slot: 'head', id: 'hd_crown', n: '廟會金冠', price: 60000, eff: '珍珠率 +5%', base: '#e8b830', pat: 'dragon', fx: { pearl: 1.05 } },
  { slot: 'hand', id: 'hn_basic', n: '素色袖套', price: 0, eff: '基本款', base: '#3a5a8a', pat: 'plain', fx: {} },
  { slot: 'hand', id: 'sl_flower', n: '碎花袖套', price: 3000, eff: '每碗多拿 $1', base: '#e86a8a', pat: 'flower', fx: { bowl: 1 } },
  { slot: 'hand', id: 'sl_rain', n: '防水雨衣袖套', price: 8000, eff: '翹殼沒中的懲罰減半（一半機率保住連擊）', base: '#ffd21a', pat: 'rain', fx: { keep: 0.5 } },
  { slot: 'hand', id: 'sl_89', n: '89包手袖套', price: 8989, eff: '刺青太兇，阿婆主動丟殼的機率剩 ×0.2，旁邊的人會小聲議論', base: '#d9a77a', pat: 'tattoo', fx: { throw: 0.2 } },
  { slot: 'hand', id: 'sl_camo', n: '迷彩袖套', price: 15000, eff: '比較不顯眼，阿婆唸你、干擾的機率 -30%', base: '#5a6b3a', pat: 'camo', fx: { nag: 0.7 } },
  { slot: 'hand', id: 'sl_neon', n: '螢光運動袖套', price: 30000, eff: '翹殼指針慢 5%', base: '#39ff9a', pat: 'neon', fx: { speed: 0.95 } },
  { slot: 'hand', id: 'sl_dragon', n: '金線刺繡龍袖套', price: 80000, eff: '珍珠率 +8%，開到珍珠手臂閃金光', base: '#8a1420', pat: 'dragon', fx: { pearl: 1.08 } },
  { slot: 'body', id: 'bd_basic', n: '舊 T 恤', price: 0, eff: '基本款', base: '#e8e4d8', pat: 'plain', fx: {} },
  { slot: 'body', id: 'bd_rain', n: '雨衣', price: 5000, eff: '受到的傷害 -10%', base: '#ffd21a', pat: 'rain', fx: { dmg: 0.9 } },
  { slot: 'body', id: 'bd_vest', n: '廟會背心', price: 15000, eff: '每碗多拿 $1', base: '#c82a2a', pat: 'plain', fx: { bowl: 1 } },
  { slot: 'body', id: 'bd_boss', n: '漁港老大夾克', price: 40000, eff: '氣場夠，被丟殼的機率 -20%', base: '#1e2a3a', pat: 'tattoo', fx: { throw: 0.8 } },
  { slot: 'body', id: 'bd_sequin', n: '亮片表演服', price: 70000, eff: '幸運 +1（比較會開到珍珠、奇物）', base: '#b84ad8', pat: 'neon', fx: { luck: 1 } },
  { slot: 'body', id: 'bd_bikini', n: '比基尼', price: 8888, eff: '海邊味，每碗多拿 $1', base: '#e84a5c', pat: 'flower', fx: { bowl: 1 } },
  { slot: 'legs', id: 'lg_basic', n: '工作褲', price: 0, eff: '基本款', base: '#4a4a52', pat: 'plain', fx: {} },
  { slot: 'legs', id: 'lg_rain', n: '雨褲', price: 4000, eff: '受到的傷害 -10%', base: '#ffd21a', pat: 'rain', fx: { dmg: 0.9 } },
  { slot: 'legs', id: 'lg_flower', n: '花褲', price: 12000, eff: '每碗多拿 $1', base: '#e86a8a', pat: 'flower', fx: { bowl: 1 } },
  { slot: 'legs', id: 'lg_camo', n: '迷彩褲', price: 25000, eff: '阿婆唸你的機率 -15%', base: '#5a6b3a', pat: 'camo', fx: { nag: 0.85 } },
  { slot: 'feet', id: 'ft_basic', n: '藍白拖', price: 0, eff: '基本款', base: '#2a5ab0', pat: 'plain', fx: {} },
  { slot: 'feet', id: 'ft_boots', n: '雨鞋', price: 3000, eff: '站得穩，翹殼沒中有兩成機率保住連擊', base: '#ffd21a', pat: 'plain', fx: { keep: 0.2 } },
  { slot: 'feet', id: 'ft_work', n: '工作靴', price: 18000, eff: '翹殼指針慢 3%', base: '#6a4a2a', pat: 'plain', fx: { speed: 0.97 } },
  { slot: 'feet', id: 'ft_gold', n: '金色拖鞋', price: 50000, eff: '珍珠率 +4%', base: '#e8b830', pat: 'plain', fx: { pearl: 1.04 } },
  { slot: 'head', id: 'hd_none', n: '不穿', price: 0, eff: '不戴帽子或頭巾，露出頭髮', base: '#e8bc98', pat: 'plain', fx: {} },
  { slot: 'hand', id: 'hn_none', n: '不穿', price: 0, eff: '不穿袖套，手臂是膚色', base: '#e8bc98', pat: 'plain', fx: {} },
  { slot: 'body', id: 'bd_none', n: '不穿', price: 0, eff: '不穿衣服，上身膚色並貼著 X 字胸貼', base: '#e8bc98', pat: 'plain', fx: {} },
  { slot: 'legs', id: 'lg_none', n: '不穿', price: 0, eff: '不穿長褲，改成簡單內褲', base: '#e8bc98', pat: 'plain', fx: {} },
  { slot: 'feet', id: 'ft_none', n: '不穿', price: 0, eff: '打赤腳', base: '#e8bc98', pat: 'plain', fx: {} },
];
export const defaultEquipId = (slot: Slot) => EQUIP.find(e => e.slot === slot && e.price === 0 && !isNoneId(e.id))!.id;
export const SETS: { id: string; n: string; need: string[]; eff: string; fx: Fx }[] = [
  { id: 'typhoon', n: '颱風天套', need: ['hd_hat', 'bd_rain', 'lg_rain', 'ft_boots'], eff: '被丟殼的機率再 -30%、受到的傷害再 -10%', fx: { throw: 0.7, dmg: 0.9 } },
  { id: 'temple', n: '廟會套', need: ['hd_crown', 'bd_vest', 'sl_dragon', 'ft_gold'], eff: '珍珠率再 +5%、每碗再多 $2', fx: { pearl: 1.05, bowl: 2 } },
  { id: 'army', n: '迷彩套', need: ['hd_helmet', 'sl_camo', 'lg_camo', 'ft_work'], eff: '阿婆唸你的機率再 -30%', fx: { nag: 0.7 } },
];