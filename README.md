# 台灣航空載客率數據分析網站

互動式數據分析儀表板，提供台灣航空載客率的完整視覺化分析。

## 🌟 功能特點

- ✈️ **互動式篩選**：機場、航點、時間範圍自由選擇
- 📊 **豐富圖表**：載客率趨勢、堆疊人數、YoY對比
- 📱 **響應式設計**：完美支援手機、平板、桌面
- 🎨 **現代美學**：暗色主題、漸層效果、流暢動畫
- 📋 **詳細數據**：航空公司月度數據表格

## 🚀 快速開始

### 使用演示數據（即開即用）

```bash
cd passenger_capacity
open index.html
```

網站會自動載入演示數據，您可以立即體驗所有功能。

### 使用真實數據

1. **轉換 XLS 為 CSV**
   - 使用線上工具：https://cloudconvert.com/xls-to-csv
   - 或使用 Excel/LibreOffice 另存為 CSV

2. **轉換 CSV 為 JSON**
   ```bash
   python3 convert_csv_to_json.py
   ```

3. **更新 app.js 以載入真實數據**
   編輯 `js/app.js` 中的 `loadData()` 函數，取消註解 fetch 相關代碼

4. **啟動本地伺服器**
   ```bash
   python3 -m http.server 8000
   ```

5. **訪問網站**
   打開瀏覽器訪問 `http://localhost:8000`

## 📂 專案結構

```
passenger_capacity/
├── index.html              # 主頁面
├── README.md              # 本文件
├── convert_csv_to_json.py # 數據轉換工具
├── css/
│   └── styles.css        # 樣式表
├── js/
│   ├── app.js           # 主應用邏輯
│   ├── charts.js        # 圖表渲染
│   └── table.js         # 表格功能
├── data/
│   └── flight_data.json # 數據文件
└── extracted/
    └── *.xls            # 原始 XLS 文件
```

## 🎯 功能說明

### 篩選器
- **台灣機場**：選擇出發機場
- **目的地航點**：根據機場動態更新
- **時間範圍**：2022-01 至 2025-10

### 圖表
1. **載客率趨勢**：各航空公司隨時間變化的載客率
2. **堆疊人數**：每月總載客人數（按航空公司堆疊）
3. **YoY對比**：年同比變化率（綠色=增長，紅色=下降）

### 數據表格
- 航空公司分頁切換
- 月度詳細數據
- 載客率顏色標誌（綠>藍>黃>紅）

## 💻 技術棧

- **前端**：HTML5, CSS3, JavaScript (ES6+)
- **圖表**：Chart.js 4.4.0
- **字體**：Noto Sans TC (Google Fonts)
- **設計**：響應式、暗色主題、CSS Grid/Flexbox

## 📱 響應式支援

- **桌面**（>768px）：完整多欄佈局
- **平板**（768px）：自適應調整
- **手機**（<480px）：單欄佈局、橫向滾動表格

## 🔧 數據格式

JSON 格式範例：

```json
{
  "year": 2024,
  "month": 1,
  "year_month": "2024-01",
  "airport": "桃園機場",
  "destination": "東京",
  "airline": "長榮航空",
  "flights": 120,
  "total_seats": 24000,
  "passengers": 20400,
  "load_factor": 85.0
}
```

## 📸 截圖

查看 `walkthrough.md` 獲取完整的功能演示和截圖。

## 🤝 貢獻
 
歡迎提交 Issue 和 Pull Request！
 
## 📄 授權
 
MIT License

## 🚀 專案部署與驗證 SOP（硬性防呆自動化）
在本專案進行任何功能修改或更新後，**必須**遵循以下嚴格的部署與驗證程序。為了防止忘記部署，我們已將驗證與部署物理性地嵌入 Git 工作流中：

1. **本地編譯與雙端網頁驗證**：
   - 執行 `npm run build` 生成全站靜態頁面與數據集，確保 `verify_seo.js` 測試通過。
   - 啟動本地伺服器手動確認**桌面版 (Desktop)** 與**行動版 (Mobile RWD)** 的視覺與互動效果。

2. **Code Review 與 CHANGELOG 紀錄**：
   - 更新專案根目錄的 `CHANGELOG.md`（符合 Rule #6 協作協議）。

3. **自動化 Git Push & 部署門檻（關鍵防呆）**：
   - 執行 `git add .`、`git commit` 提交變更。
   - 當您執行 `git push`（符合 Rule #7 協作協議）時，系統會自動觸發 **Git `pre-push` Hook**（位於 `.git/hooks/pre-push`）。
   - 該 Hook 會**強制執行 `npm run ship`**，依序完成： prereder -> SEO 檢測 -> Browser E2E 測試 -> `vercel --prod` 生產部署。
   - **防呆機制**：如果上述任一檢驗失敗，或者 Vercel 部署失敗，`git push` 會被**立刻阻斷**。這確保了「代碼庫 (GitHub) 與線上生產環境 (Vercel) 永遠同步，且不可能忘記部署」。
   - *(手動部署指令：您也可以直接執行 `npm run ship` 來手動進行全套驗證與生產部署)*

4. **線上生產環境即時驗證**：
   - 部署完成且 push 成功後，開啟 Vercel 生產環境網址，在雙端視角下再次檢驗線上功能是否完全正常。

 
---
 
**開發者**: Antigravity AI & 外勞芭
**最後更新日期**: 2026-06-10
