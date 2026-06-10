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

## 🚀 專案部署與驗證 SOP
在本專案進行任何功能修改或更新後，**必須**遵循以下嚴格的部署與驗證程序：
1. **本地編譯與驗證**：
   - 執行 `npm run build` 生成全站靜態頁面與數據集。
   - 確保 `verify_seo.js` 的 60+ 個自動化測試斷言全數合格。
2. **Code Review 與 CHANGELOG 紀錄**：
   - 更新專案根目錄的 `CHANGELOG.md`，記錄此次修改的「紀錄時間」、「問題現狀」、「根本原因 (Root Cause)」、「修正方案」與「驗證結果」（符合 Rule #6 協作協議）。
3. **GitHub Push & Vercel 部署**：
   - 執行 `git add .`、`git commit` 提交變更。
   - 連帶執行 `git push origin HEAD`（符合 Rule #7 協作協議）。
   - 執行 `npx vercel --prod --yes`，將本地渲染好之靜態檔案目錄直接打包部署至 Vercel，避開雲端受限環境的重 build 報錯。
4. **線上生產環境即時驗證**：
   - 部署完成後，**必須**使用瀏覽器開啟 Vercel 生產環境網址，手動檢驗功能（例如導航選單是否可正常點選、頁面最下方的開發者卡片與品質指標是否渲染正確、航空公司數據是否順利過濾且圓餅圖維度正確）。
   - 確認線上功能完全正常後，方可對外回報交付。
 
---
 
**開發者**: Antigravity AI & 外勞芭
**最後更新日期**: 2026-06-10
