/** 難度／地點／座位靜態表（價錢欄位隨地點帶走） */

export const DIFF = [
  { n: '易', css: '#9be37a', tol: 0.45, need: 2, lo: 0.12, hi: 0.85, slip: 0.1, scale: 0.7, rough: 0 },
  { n: '普通', css: '#f5d9a8', tol: 0.33, need: 3, lo: 0.18, hi: 0.72, slip: 0.2, scale: 0.85, rough: 2 },
  { n: '硬', css: '#ffa860', tol: 0.24, need: 5, lo: 0.25, hi: 0.62, slip: 0.35, scale: 0.95, rough: 4 },
  { n: '超硬', css: '#ff6a5a', tol: 0.17, need: 7, lo: 0.3, hi: 0.55, slip: 0.5, scale: 0.95, rough: 6 },
];
export const DIFF_W = [30, 40, 22, 8];

export type Loc = { id: string; n: string; m: number; w: number[]; thr: number; ang: number; price: number; need: number; tint: number | null; d: string };
export const LOCS: Loc[] = [
  { id: 'home', n: '🏠 自家蚵寮', m: 1, w: DIFF_W, thr: 1, ang: 1, price: 0, need: 0, tint: null, d: '熟悉的老位子，阿婆們都很和氣' },
  { id: 'wanggong', n: '⚓ 王功漁港', m: 1.2, w: [22, 40, 28, 10], thr: 1.2, ang: 1.15, price: 800, need: 60, tint: 0x5f8fb0, d: '海風大、硬殼多一點，阿婆稍微兇' },
  { id: 'dongshi', n: '🎡 東石漁人碼頭', m: 1.4, w: [14, 34, 36, 16], thr: 1.4, ang: 1.3, price: 2500, need: 200, tint: 0xe0b888, d: '觀光客多、蚵仔偏硬，阿婆丟殼更勤' },
  { id: 'budai', n: '🏭 布袋蚵寮大廠', m: 1.7, w: [8, 26, 40, 26], thr: 1.7, ang: 1.5, price: 6000, need: 500, tint: 0x90b0c0, d: '工錢最高，但蚵仔超硬、阿婆最兇' },
];

export type Seat = { id: string; n: string; a: number; r: number; scoop: number; bowl: number; perf: number; nag: number; throwM: number; steal: number; pro: string; con: string };
export const SEATS: Seat[] = [
  { id: 'door', n: '門口位', a: 0, r: 2.0, scoop: 1, bowl: 1, perf: 0, nag: 1, throwM: 1, steal: 1, pro: '平衡，什麼都普通', con: '—' },
  { id: 'pile', n: '蚵山邊', a: 0.85, r: 1.75, scoop: 0.55, bowl: 1.2, perf: 0, nag: 1, throwM: 1.25, steal: 1, pro: '撈蚵仔快 45%', con: '丟過來的殼多 +25%' },
  { id: 'bowl', n: '碗邊位', a: -0.85, r: 2.0, scoop: 1.4, bowl: 0.7, perf: 0.04, nag: 1, throwM: 1, steal: 1, pro: '就坐在碗旁邊，順手', con: '撈蚵仔慢 40%' },
  { id: 'gossip', n: '阿春邊仔', a: 2.5, r: 1.95, scoop: 1, bowl: 1, perf: 0, nag: 2, throwM: 1.3, steal: 1.6, pro: '阿婆聊天比較久，好偷 +60%', con: '唸你 ×2、殼仔 +30%' },
  { id: 'corner', n: '角落', a: -0.35, r: 2.7, scoop: 1.5, bowl: 1.25, perf: 0, nag: 0.5, throwM: 0.5, steal: 1, pro: '殼比較少 -50%、比較少人唸 -50%', con: '撈蚵仔慢 50%' },
];
