/**
 * 剝蚵仔模擬器 兌換碼清單（推出新兌換碼時只要改這個檔案）。
 *
 * 新增一組兌換碼的步驟：
 *   1. 在專案根目錄執行：npm run hash-code -- 你的兌換碼
 *      （不分大小寫，空白會被忽略；例如 "oy 2026" 等同 "OY2026"）
 *   2. 把印出的那一行貼到下方 REDEEM_CODES 陣列裡，然後修改：
 *      - id：這組碼的永久識別名稱（存檔用它記錄「已兌換過」，也會出現在統計後台）。
 *            不要把兌換碼本身寫進 id；上線後不要改、也不要重複使用。
 *      - reward：獎勵，可同時給多種：
 *            money: 金額                     例 { money: 500 }
 *            items: ['商品 id', ...]         刀／傘等雜貨店商品，直接擁有（id 見 src/main.ts 的 KNIVES、UMBS 等）
 *            pearls: [白, 粉, 金, 烏]          各給幾顆珍珠，會登錄進圖鑑，例 { pearls: [0, 0, 1, 0] }
 *            odd: { 奇物編號: 數量 }          奇物編號＝src/main.ts ODD 陣列的順序（從 0 開始），例 { odd: { 2: 1 } }
 *      - start / end（可省略）：活動期間，ISO 時間並寫時區，例 '2026-11-01T00:00:00+08:00'。
 *            未到 start 顯示「活動還沒開始」，過了 end 顯示「已經過期」。
 *      - label（可省略）：顯示在成功訊息裡的活動名稱。
 *   3. 推到 main，GitHub Pages 自動部署後就生效（約 1 分鐘）。
 *
 * 注意：這裡只放 SHA-256 雜湊，絕對不要放明碼。
 */
export type RedeemReward = { money?: number; items?: string[]; pearls?: number[]; odd?: Record<number, number> };
export type RedeemCodeDef = { id: string; hash: string; reward: RedeemReward; start?: string; end?: string; label?: string };

export const REDEEM_CODES: RedeemCodeDef[] = [
];
