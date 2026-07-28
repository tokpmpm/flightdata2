---
name: caa-monthly-data-update
description: >
  Use when the user asks to update flight data, add new month data, refresh CAA
  statistics, or mentions 民航局/載客率/月度更新/數據更新/flightdata2. Automates the
  full monthly data pipeline: XLS download → process → verify → build → deploy.
---

# 民航局月度載客率數據更新 (CAA Monthly Data Update)

> **適用場景**：使用者說「更新數據」、「新增 X 月資料」、「CAA 資料更新」、「flightdata2 數據更新」等。
> 此 Skill 封裝完整的月度數據更新管線，從下載 XLS 到部署上線一條龍自動化。

## ⚠️ 前置條件 (Prerequisites)

- 工作目錄：`/Users/pmpmpm/Antigravity/passenger_capacity`
- Node.js 已安裝且 `xlsx` 套件可用 (`npm install`)
- Vercel CLI 已登入 (`vercel whoami`)
- Git remote 已設定 (`origin` → `https://github.com/tokpmpm/flightdata2.git`)

---

## 🔄 執行流程 (Pipeline)

依序執行以下 7 個階段。**任何階段失敗必須停止，不得跳過。**

### Phase 1: 取得資料來源 (Acquire Source)

1. **確認資料月份**：詢問使用者要更新哪個月份（例如「115 年 7 月」），或從使用者訊息推斷。
2. **計算對應值**：
   - 民國年 → 西元年：`西元年 = 民國年 + 1911`
   - XLS 檔名格式：`{民國年}年{月份}月.xls`（例如 `115年7月.xls`）
3. **下載 XLS 檔案**：
   - 來源網址：`https://www.caa.gov.tw/article.aspx?a=1752&lang=1`
   - 使用瀏覽器或 curl 下載最新 XLS 附件
   - 存放路徑：`extracted/{民國年}年{月份}月.xls`
4. **驗證檔案**：確認檔案大小合理（通常 450KB～600KB），且能被 `xlsx` 套件正確讀取。

```bash
# 驗證 XLS 檔案可讀取
node -e "const XLSX=require('xlsx'); const wb=XLSX.readFile('extracted/115年7月.xls'); console.log('Sheets:', wb.SheetNames.length, wb.SheetNames);"
```

### Phase 2: 資料處理 (Process Data)

執行資料解析與轉換腳本，將所有 XLS 檔案重新解析為結構化 JavaScript 數據：

```bash
node process_data.js
```

**預期輸出**：
- 更新 `data/flight_data_new.js`（包含從最早月份到新月份的完整記錄）
- 終端顯示處理的檔案數量（如 55 files → 含新增的 1 個檔案）

**驗證要點**：
- 確認新月份的記錄筆數合理（過去幾個月約 370~380 筆/月）
- 確認涵蓋的機場數（通常 5~6 座）與航空公司數（通常 55~65 家）

### Phase 3: XLS vs JSON 比對驗算 (Cross-Verify)

```bash
node scripts/verify_xls_vs_json.js
```

**通過標準**：
- ✅ 全部月份的飛行架次、座位數、載客數誤差皆在 ±1% 以內
- ✅ 全期總計數據一致

**失敗處理**：
- 若出現 ⚠️ 警告，檢查 `process_data.js` 中的 `DESTINATION_MAP` 是否有未匹配的新航點
- 若新月份的載客率出現異常值（<50% 或 >99%），停止並報告使用者

### Phase 4: 靜態頁面預渲染與 SEO 驗證 (Build & Verify)

```bash
npm run build
```

此命令內部執行：
1. `node prerender.js`：生成全部靜態 HTML 頁面、CSV/JSON 資料集、sitemap.xml、robots.txt、llms.txt
2. `node verify_seo.js`：對所有公開頁面執行 SEO/AIEO 自動化驗證

**通過標準**：
- ✅ `🎉 All SEO/AIEO Verification checks passed successfully!`
- 每個頁面的「更新月份」必須等於該頁自身資料的最新月份（非全站最新月份）

**驗證項目清單**（verify_seo.js 自動檢查）：

| 項目 | 說明 |
|------|------|
| H1 唯一性 | 每頁恰好 1 個 `<h1>` |
| Title & Description | 非空、包含時效性關鍵字 |
| Canonical | 正確指向 `flightdata2.meshthings.com` |
| OG 標籤 | og:title, og:description, og:type, og:url, og:image |
| Twitter Card | twitter:card, twitter:title, twitter:description |
| JSON-LD | Dataset license = `https://data.gov.tw/license` |
| 更新月份一致性 | header-update-time ≤ 資料實際最新月份 |
| temporalCoverage | Dataset 起訖年月正確 |
| 下載檔案存在 | CSV/JSON 檔案路徑可存取 |

### Phase 5: 首頁數據驗算 (Homepage Verification)

```bash
node scripts/verify_homepage.js
```

**驗證項目**：KPI 卡片、月度明細、Top 10 航線/航司排行、載客率熱力圖、YoY 比較。

### Phase 6: 本地測試 (Local Preview)

```bash
node scripts/serve.js
```

- 啟動本地伺服器於 `http://localhost:3033`
- **必須告知使用者**伺服器已啟動，請使用者確認以下頁面：
  - 首頁：`http://localhost:3033/`
  - 新月份有資料的機場頁面（如桃園）：`http://localhost:3033/airport/tpe/`
  - 花蓮機場（資料可能未包含最新月份）：`http://localhost:3033/airport/hun/`
- **等待使用者確認無誤後**才進入下一階段

### Phase 7: CHANGELOG、Git Commit/Push 與部署 (Ship)

**Step 7a — 更新 CHANGELOG.md**（Rule #6 強制紀錄）：

在 `CHANGELOG.md` 頂端（`# CHANGELOG` 之後）新增記錄，格式如下：

```markdown
## [YYYY-MM-DD] 資料更新：新增 {西元年} 年 {月} 月（民國 {民國年} 年 {月} 月）載客率數據

### 問題現狀
flightdata2.meshthings.com 數據最後更新至 {上次月份}，CAA 民航局已發佈最新統計。

### 根本原因 (Root Cause)
CAA 民航局每月約 25-27 日發佈上月統計資料，需手動下載並整合至網站數據中。

### 修正方案
1. **下載新檔**：從 CAA 官網下載 `{民國年}年{月}月.xls` 至 `extracted/` 目錄。
2. **資料處理**：執行 `node process_data.js` 重新解析全部 XLS 檔案。
3. **靜態頁面重建**：執行 `npm run build` 重新生成所有靜態 HTML 頁面及資料集。

### 驗證結果
- ✅ 新增 {N} 筆航線紀錄
- ✅ 涵蓋 {N} 座機場、{N} 個航點、{N} 家航空公司
- ✅ XLS vs JSON 逐月比對全部通過（誤差 ±1% 以內）
- ✅ `npm run build` 全部 SEO/AIEO 驗證項目通過
- ✅ 本地伺服器使用者確認無誤
```

**Step 7b — 停止本地伺服器**（如仍在運行）。

**Step 7c — Git Add, Commit, Push**（Rule #7）：

```bash
# 精準 staging — 不要用 git add .
git add \
  CHANGELOG.md \
  "extracted/{民國年}年{月}月.xls" \
  data/ \
  prerender.js \
  verify_seo.js \
  index.html \
  airport/ \
  airline/ \
  about/index.html \
  insights/ \
  sitemap.xml \
  template.html \
  js/ \
  scripts/ \
  tests/qa_report.json \
  package.json \
  .gitignore

git commit -m "feat: 新增 {西元年} 年 {月} 月（{民國年}年{月}月）民航局航空載客率數據"

# Rule #7: commit 隱含 push
git push origin main
```

> **注意**：`git push` 會觸發 `.git/hooks/pre-push`，該 hook 自動執行：
> 1. `npm run build`（重建 + SEO 驗證）
> 2. `node tests/verify_browser_qa.js`（E2E 瀏覽器測試）
> 3. `npx vercel --prod --yes`（Vercel 生產部署）
>
> 三道關卡全部通過後，程式碼才會真正推送至 GitHub，且網站同步上線。

**若 pre-push hook 因 port 衝突 (EADDRINUSE:3033) 失敗**：
先停止背景的 `serve.js`，再重新 `git push origin main`。

---

## 📋 快速指令清單 (Quick Reference)

| 階段 | 指令 | 預期耗時 |
|------|------|----------|
| 資料處理 | `node process_data.js` | ~5s |
| XLS 比對 | `node scripts/verify_xls_vs_json.js` | ~3s |
| Build + SEO | `npm run build` | ~3s |
| 首頁驗算 | `node scripts/verify_homepage.js` | ~2s |
| 本地預覽 | `node scripts/serve.js` | 背景常駐 |
| 完整發佈 | `git push origin main` | ~2min (含 pre-push) |

---

## 🏗️ 專案關鍵檔案結構

```
passenger_capacity/
├── extracted/              # 原始 XLS 檔案（{民國年}年{月}月.xls）
├── process_data.js         # XLS → flight_data_new.js 轉換腳本
├── data/
│   ├── flight_data_new.js  # 主數據庫（結構: 所有→機場→目的地→航司→[記錄]）
│   ├── flight_data_all.json/csv    # 全站匯出
│   ├── flight_data_airport-{code}.json/csv  # 機場專屬
│   └── flight_data_airline-{code}.json/csv  # 航司專屬
├── prerender.js            # SSG 靜態頁面生成器
├── template.html           # HTML 模板
├── verify_seo.js           # SEO/AIEO 自動化驗證
├── scripts/
│   ├── verify_xls_vs_json.js   # XLS vs JSON 交叉驗算
│   ├── verify_homepage.js      # 首頁 KPI 驗算
│   └── serve.js                # 本地開發伺服器 (port 3033)
├── tests/
│   ├── verify_browser_qa.js    # Puppeteer E2E 測試
│   └── verify_ga4_events.js    # GA4 事件追蹤測試
├── index.html              # 首頁
├── airport/{code}/index.html   # 機場單頁 (tpe/khh/tsa/rmq/tnn/hun)
├── airline/{code}/index.html   # 航司單頁 (cal/eva/starlux/tiger)
├── about/index.html        # 關於頁面
└── CHANGELOG.md            # 變更紀錄
```

---

## 🚨 常見問題與排錯 (Troubleshooting)

### 問題 1: 新航點未被分類
**症狀**：`process_data.js` 輸出 `Unknown destination: XXX`
**解法**：在 `process_data.js` 的 `DESTINATION_MAP` 中新增對應的 region 與 country 映射。

### 問題 2: 花蓮/臺南機場沒有最新月份資料
**原因**：花蓮、臺南的國際航線班次較少，可能某些月份無航班。
**處理**：這是正常現象。`prerender.js` 已設計為依據各頁面自身資料的最新月份顯示更新日期。

### 問題 3: pre-push hook 因 EADDRINUSE 失敗
**原因**：`scripts/serve.js` 仍佔用 port 3033。
**解法**：先終止背景 serve.js 程序，再重新 `git push origin main`。

### 問題 4: XLS 格式異常
**症狀**：`verify_xls_vs_json.js` 出現大幅偏差
**排查**：
1. 用 `node -e` 讀取 XLS 確認 SheetNames 是否包含預期的 `36-1` 等工作表
2. 確認民航局是否改變了欄位位置或合計列位置
3. 必要時更新 `process_data.js` 的解析邏輯

### 問題 5: Vercel 部署失敗
**解法**：執行 `vercel whoami` 確認登入狀態，或 `vercel --prod` 手動部署。

---

## ✅ 完成確認清單 (Definition of Done)

- [ ] XLS 檔案已存放至 `extracted/` 且可正確讀取
- [ ] `node process_data.js` 成功產出更新的 `flight_data_new.js`
- [ ] `node scripts/verify_xls_vs_json.js` 全部月份誤差 ≤ ±1%
- [ ] `npm run build` 通過（`🎉 All SEO/AIEO Verification checks passed!`）
- [ ] `node scripts/verify_homepage.js` KPI 與明細正確
- [ ] 使用者在 `localhost:3033` 確認頁面正常
- [ ] `CHANGELOG.md` 已更新於頂端
- [ ] `git push origin main` 通過 pre-push hook 三道關卡
- [ ] 正式站 `flightdata2.meshthings.com` 已上線更新
