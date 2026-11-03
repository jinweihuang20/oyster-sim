---
name: oyster-sim-dev
description: >-
  Develop and extend 剝蚵仔模擬器 (oyster-sim): Three.js gameplay, shop gear,
  oddities, locations, balance, WebAudio SFX, and save-compatible content.
  Use when adding features, tuning feel/economy, editing copy, or changing
  game systems in this project.
---

# oyster-sim 遊戲開發

台式夜市剝蚵模擬器。核心玩法：找縫 → 撬殼 → 點碗丟肉；可偷阿婆、撐傘擋殼、逛雜貨店、收集圖鑑。

專案硬事實（防幻覺）見 `.cursor/rules/oyster-sim-facts.mdc`（alwaysApply）。本 skill 負責「怎麼改」。

## 技術邊界

| 項目 | 約定 |
|------|------|
| 棧 | Three.js + Vite + TypeScript |
| 主邏輯 | 幾乎都在 `src/main.ts`（大檔；改玩法先搜現有區塊註解） |
| 週邊模組 | `redeem*`、`social`、`discord`、`update`、`inapp`、`backguard`、`nozoom` — 非玩法別塞進 main |
| 音效 | **全部 WebAudio 即時合成**，禁止加外部音檔 |
| 存檔 | `LS` wrapper → localStorage（預覽版有 `preview:` 前綴）；主鍵 `oyster-sim` |
| UI 文案 | 台語口吻／夜市阿婆語氣；短、口語、可吐槽 |
| 平台 | 手機點／滑 + 桌面滑鼠／Space；改操作必須兩邊都可用 |

開發指令：`npm run dev`／`npm run build`（`tsc --noEmit` + vite）。

## 開發守則

### 手感優先

- 撬殼綠區、指針速度、撬幾下、割手率、丟肉 0.8 秒俐落窗，改任何一項都要想連鎖影響。
- 道具必須有利有弊（見現有 `KNIVES`／`UMBS`／`BOWLS`／`SEATS`），不要做純強化。
- 新手保護（`newbie()`：`save.days < 3`）與教學（`tut`）路徑不要無意破壞。

### 存檔相容（硬規則）

- `ODD`（奇物）**只能接在陣列最後面**；存檔用索引，插入／刪除／重排會弄壞圖鑑。
- 新增存檔欄位：更新 `Save` type、`defaultSave()`、`loadSave()` 補預設；必要時升 `SAVE_V`。
- 珍珠 `RAR`／奇物 `odd` 計數長度要對得上陣列。

### 程式風格（貼近現況）

- 沿用短名 helper：`mat`、`mesh`、`rnd`、`pick`、`$`、`persist()`。
- 場景 mesh 多用 flatShading；顏色偏黃昏蚵寮（暖燈、紫灰霧）。
- 狀態機相位（`pick`／`twist`／`busy`…）改動時檢查 hint、教學字串、活動 `evRun` 特例。

### 平衡與經濟

- 入碗工錢：`DPAY`；完美／俐落另有加成；殼屑打折。
- 地點 `LOCS`：工錢倍率↑ → 難度權重更硬、阿婆更兇（`thr`／`ang`）。
- 商店內建價可被後台 `PX_URL` 覆寫；改價時保留合理 fallback。

### 不要做

- 不要為了「乾淨」大拆 `main.ts`，除非使用者明確要求重構。
- 不要引入外部音檔、大型 3D 資產管線（除非另開任務）。
- 不要靜默改既有奇物索引或玩家已擁有道具的 `id`。

---

## 功能流程

複製對應 checklist，做完打勾。

### 加新奇物（圖鑑）

```
- [ ] 只在 ODD 陣列「最末」追加一筆
- [ ] 填 name / css / w / price / emo 或 ic / tease / line / cry
- [ ] 活動限定加 ex: true，並確認掉落邏輯有擋一般池
- [ ] 稀有度用 w 對齊 rarOf（legend≤2、rare≤10…）
- [ ] 文案：夜市／台式吐槽；阿婆 cry 兩句左右
- [ ] npm run build；實機開殼抽幾次看 UI／toast
```

### 加新雜貨（刀／傘／盆／藥等）

```
- [ ] 在對應陣列追加（KNIVES / UMBS / BOWLS / MEDS…），id 唯一且穩定
- [ ] 每個數值有利有弊；desc 講清楚取捨
- [ ] 視覺：刀 blade 色、傘 look/size、盆 buildBowl 參數
- [ ] 確認 shop 列表渲染與 equipped 讀取走 id
- [ ] 價格與後台 key（若有）一致；失敗時用內建價
- [ ] 手機＋桌面各買一次、裝備進一班驗證數值有生效
```

### 加新蚵寮地點

```
- [ ] LOCS 追加：id / n / m / w / thr / ang / price / need / tint / d
- [ ] need＝解鎖所需累計入碗；與既有曲線銜接（別跳太大）
- [ ] tint 影響場景氛圍；d 一句介紹
- [ ] 解鎖 UI／toast／locSeen 有提到新地
- [ ] 實測：未達 need 鎖住；達標可進、難度與丟殼體感合理
```

### 調玩法／平衡

```
- [ ] 先定位常數：DIFF、PRY_*、DPAY、newbie、knifeNow 衍生函式
- [ ] 一次只動一條曲線（例如只改綠區或只改工錢）
- [ ] 用短班（60／120 秒）快速體感；對照新手局與老手局
- [ ] 若動到掉落：檢查保底（白珍珠／傳說 pity）
```

### 加／改音效

```
- [ ] 只在現有 SFX / tone / WebAudio helper 上延伸
- [ ] 接到 mix 通道（sfx / amb / music）；尊重 mute
- [ ] 禁止新增大檔 mp3/wav 依賴
```

### 改操作或 UI 提示

```
- [ ] 同時更新 COARSE（觸控）與滑鼠／鍵盤文案
- [ ] 教學字串（tut）與第一次 tip（如 meatTip）一併檢查
- [ ] 按鈕／點擊不要被 backguard 或 overlay 誤擋
```

---

## 改動落點速查

| 想改… | 大致位置（`src/main.ts` 內搜） |
|--------|--------------------------------|
| 難度／撬殼 | `DIFF`、`PRY`、`halfTwist`、phase `twist` |
| 珍珠／奇物 | `RAR`、`ODD`、開殼掉落、`persist` |
| 存檔 | `SAVE_V`、`Save`、`loadSave`、`defaultSave` |
| 刀傘盆位 | `KNIVES`、`UMBS`、`BOWLS`、`SEATS`、shop HTML |
| 地點 | `LOCS`、`locNow` |
| 阿婆台詞 | `GOSSIP`、`NAG_*`、`SCOLD_*`、`say`／`nag` |
| 偷／擋／丟 | `steal`、傘／reflect、shell throw |
| 活動 | `EvCfg`、`evRun` |
| 音效／廣播 | WebAudio 區塊、`Trk`、收音機 |
| 週邊系統 | 對應 `src/*.ts`，不要硬塞進場景迴圈 |

## 驗證底線

1. `npm run build` 通過  
2. 新存檔可玩；舊存檔（若相關）能讀、欄位有預設  
3. 觸控與滑鼠各走一輪主循環（拿蚵→撬→丟碗）  
4. 文案語氣仍像蚵寮，不像說明書  
