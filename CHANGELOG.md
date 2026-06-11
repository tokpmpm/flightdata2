# CHANGELOG


## [2026-06-11] 工作流優化：修復定時爬蟲 OR 觸發陷阱，並改為 PR 預覽審查模式，避免自動部署未審查數據

### 問題現狀
1. **排程非預期觸發**：爬蟲在 6/9 與 6/10（均為週二、週三）被非預期觸發，主要因為 Cron 設定為 `0 4 25-31 * 1-5`。在標準 Cron 中，這會被解析為聯集（25-31 號 OR 週一至週五），導致每個工作日都觸發。
2. **缺乏審查機制**：舊流程在爬取新數據後，直接將其 commit 至 `main` 分支並更新首頁與機場專頁，未給予開發者或管理員人工審查的空間，容易帶來數據發布風險。

### 根本原因 (Root Cause)
1. Cron 排程規範中，日期（DOM）與星期（DOW）同時指定時，關係為邏輯 `OR`。
2. 缺乏對預覽環境的整合，沒有透過 PR 機制隔離數據更新與正式發布。

### 修正方案
1. **Cron 解除聯集陷阱**：將表達式改為 `0 4 25-31 * *`，並在工作流開頭加入 `check-weekday` 工作（利用 `date +%u` 判斷是否小於等於 5），以 `AND` 邏輯確保「只在 25-31 號之中的工作日執行」。
2. **改為 PR 預覽審查機制**：
   - 移除直接 push 到 `main` 的步驟。
   - 爬取新數據並重新渲染後，僅 `git add` 原始 Excel、轉換後的 JSON 資料、以及 [insights/2026-taiwan-aviation-market-outlook/index.html](file:///Users/pmpmpm/Antigravity/passenger_capacity/insights/2026-taiwan-aviation-market-outlook/index.html)。
   - 將變更 commit 至新分支 `data-update-preview`，並強制推送。
   - 呼叫 `gh pr create` 自動建立 Pull Request，讓 Vercel 自動為該 PR 產生 **Preview URL** 並留言通知。

### 驗證結果
- ✅ **YAML 語意正確**：成功編寫 `.github/workflows/auto-update.yml`，且 `jobs` 間之依賴與 outputs 定義無誤。

## [2026-06-11] 工程自動化與防呆機制：建置 Git pre-push Hook，強制執行 Prerender、SEO 驗證、Browser E2E 測試與 Vercel 生產部署，防止忘記部署

### 問題現狀
1. **部署遺忘風險**：即便在開發規範中多次加入 deployment 規則，AI 或是開發人員仍有可能在 `git push` 後忘記執行 `npx vercel --prod` 實體部署，造成遠端生產環境與 GitHub 代碼庫不一致。
2. **無 CI 連動機制**：此專案未配置 GitHub Actions 自動觸發 Vercel 生產部署，完全仰賴開發端本機 CLI 進行 `--prod` 部署，缺乏硬性關卡防護。

### 根本原因 (Root Cause)
1. 人為的 SOP (即便寫在 README.md 中) 屬於軟性約束，缺乏系統層級的硬性強制（Hard Constraint）防呆機制。
2. `git commit` 與 `git push` 雖然已藉由 Rule #7 建立關連，但 Vercel 部署被單獨排在 Git 工作流之外，沒有與 push 行為做物理上的鏈結。

### 修正方案
1. **建立 Git `pre-push` 自動化防呆 Hook**：在 `.git/hooks/pre-push` 中撰寫 Shell 腳本。當執行 `git push` 且目標為 `main` 分支時，自動按順序觸發：
   - `npm run build` (prerender + SEO 驗證)
   - `node tests/verify_browser_qa.js` (Headless 瀏覽器 17 大 QA 斷言)
   - `npx vercel --prod --yes` (Vercel 生產部署)
2. **硬性阻斷機制**：上述任何一個驗證或部署步驟若失敗（離開碼不為 0），Hook 將自動終止 `git push` 行程，確保「只有部署成功的代碼才能被推送到 main 分支」。
3. **優化部署 SOP 說明**：同步更新 `README.md` 中關於部署與驗證的段落，全面改為引導使用此自動化 Hook 及 `npm run ship` 機制，宣導「以工具代替記憶」的工程標準。

### 驗證結果
- ✅ **Hook 腳本成功建立並賦予執行權限** (`chmod +x .git/hooks/pre-push`)。
- ✅ **README.md 內容更新**：修正了部署章節，清楚說明如何透過 `git push` 或 `npm run ship` 自動完成完整流程，從系統機制徹底根絕忘記部署的痛點。

## [2026-06-11] 數據交互與圖表升級 (由 Codex 協助整合)：新增三大視覺化圖表，優化資料庫說明 claims 並精準對齊 2026 1-4 月期間，更新 17 大自動化測試

### 問題現狀
1. **圖表視覺豐富度不足**：insights 頁面缺乏更直觀的運量結構佔比圖（如機場客運佔比）與熱門航點載客率之排名參考線，不利於讀者做宏觀橫向對比。
2. **Q11 資料庫更新承諾過於自信**：原 Q11 對於民航局發布後固定 3-5 工作天上架及「資料庫完整度達 100%」的陳述容易帶來服務承諾 (SLA) 風險。
3. **資料期間定義微調**：為了更符合 2026 前四個月（2026-01 至 2026-04）的主體分析，頁面與 schema 標記的 metadata 需進行更細緻的對齊。

### 根本原因 (Root Cause)
1. 先前僅配置了 YoY 趨勢線圖與四象限散佈圖，未對機場份額做圓餅圖分割，亦未對航點載客率進行直條圖排名及平均線 (85.4%) 的直觀標註。
2. 開發階段寫死了固定的上架工作天，未考慮政府資料發布之不確定性。
3. 頁面與 schema 標記的 metadata 需針對今年 1-4 月的新數據，在標題與 coverage 上更細緻對稱。

### 修正方案
1. **整合三大全新互動圖表** (由 Codex 精準改寫)：
   - **Q1 旅客增加量長條圖**：直觀呈顯各機場相比去年同期客運量的絕對增長。
   - **Q9 機場旅客量佔比圓餅圖**：以 Pie chart 展現桃園 (81.1%)、高雄 (10.6%)、松山 (4.8%)、台中 (3.4%) 的客量份額。
   - **Q10 航點載客率排名直條圖 (含 85.4% 平均線)**：直觀展示 10 大航點載客率高低，並用 Dash line 繪製平均載客率基準。
2. **修正資料庫聲明 (Q11)**：將文字改為中性保守，移除「3-5 工作天」與「完整度 100%」等 overconfident 聲明。
3. **期間標記精準化**：將 Dataset temporalCoverage 精確改為 `2026-01/2026-04`，同步更新 Article 標題為 `2026 年 1-4 月台灣航空市場洞察與載客率分析` 及其 description 與 breadcrumb 欄位。
4. **擴充檢測斷言**：在 `verify_seo.js` 中新增 12 項針對 Q1-Q11 結構、10 列排名的細部驗證；並在 `tests/verify_browser_qa.js` 增加對 Q11 text 與 JSON-LD 日期、temporalCoverage 等 17 大斷言。

### 驗證結果
- ✅ **靜態預渲染 & SEO 驗證**：`npm run build` 綠燈通過，所有 schema 欄位、圓餅圖/直條圖 DOM 結構與 metadata 全數無誤（✅ ALL PASS）。
- ✅ **Headless Browser 17 項斷言全數 PASS**：
  - **水平溢出**：桌面與行動版溢出均為 `0px`（✅ PASS）。
  - **觸控目標大小**：13 個行動版連結高度全數 `>= 44px`（✅ PASS）。
  - **Q11 資料庫聲明**：文字保守，且無 overconfident 聲明（✅ PASS）。
  - **JSON-LD Article & Dataset**：時間區間為 `2026-01/2026-04`，且日期標記為 `2026-06-11`（✅ PASS）。
  - **頁面結構**：Q1-Q11 排序無誤，表格恰有 10 列且 Q6 區塊不嵌套（✅ PASS）。
- ✅ **重新產出 5 張驗證截圖**：包含最新整合之機場圓餅圖、載客率直條圖等（✅ PASS）。

## [2026-06-11] 體驗與效能優化：修正台灣航空市場洞察頁面之 Mobile 破版、首屏體感、標題與術語精準度等 8 大 Findings，並建立 Browser QA 自動化測試

### 問題現狀
本站之 insights 報告頁面（台灣航空市場洞察）在代碼審查與網頁驗證中被發現 8 項重要缺陷：
1. **Mobile 破版與水平捲動**：390px 寬度的手機視角下會產生寬度 420px 的水平捲動，主因為目錄項文字過長且禁止折行。
2. **Mobile 首屏體感欠佳**：手機版頂部導航欄（Header）被強制貼頂（sticky），重複佔高且首屏過大，影響行動端閱讀節奏。
3. **觸控目標偏小**：行動版頂部 nav 與目錄連結高度僅約 34px，低於無障礙設計規範之 44px 觸控大小要求。
4. **TOC typo**：目錄中殘留 `is哪一座` 與 `is哪一個` 錯字。
5. **統計期間標題與數據不一致**：原 H1 標題及 JSON-LD 等標示「2026 台灣航空市場」，與實際累計至 2026-04 數據產生誤導，且各區段 Q&A 未能區分累計與趨勢期間。
6. **術語「出境」與實際雙向運量不符**：熱門航點數據事實上為出入境雙向旅客量，但多處誤植為「出境最熱門航點」。
7. **更新日期不夠明確**：頁面更新標示「更新：2026-06-10」未指明民航局原始檔案來源版本。
8. **Heading 結構混亂**：logo 錯誤使用了 `<h2>` 代替一般的語意區塊，且排在真正的 `h1` 前，破壞 SEO 結構。

### 根本原因 (Root Cause)
1. `.toc-item a` 原本使用 `white-space: nowrap` 及 `text-overflow: ellipsis`，且未對目錄容器限制 `max-width: 100%`。
2. CSS 樣式中對 `.header` 宣告了全域 `position: sticky !important`，未在行動版 media query 中做 static 覆蓋。
3. 導覽列與目錄連結未定義 `min-height: 44px` 與 `display: flex; align-items: center;`。
4. 目錄編寫過程中的手動拼寫錯誤。
5. 原標題與期間資訊未拆分累計期間（Q3/Q4/Q5/Q8）、年度數據（Q2）、趨勢期間（Q1/Q6/Q7/Q9）的規則。
6. 沿用單向出境概念，未將「雙向旅客量」之統計特徵對齊。
7. 未能將頁面更新日期與站內實體資料集 `extracted/115年4月.xls` 建立 provenance 追溯。
8. Logo 外層使用了標題標籤 `<h2>`。

### 修正方案
1. **TOC 樣式優化**：為 `.toc-box`、`.toc-item` 增加 `max-width: 100%; box-sizing: border-box;`。TOC 連結改為 `white-space: normal; overflow-wrap: anywhere; word-break: break-word; line-height: 1.4;`。
2. **行動版 Header & Hero 樣式修正**：在 `@media (max-width: 768px)` 中覆蓋 `.header` 為 `position: static !important`；縮小行動版 `.header` 與 `.hero` 的 padding，以及將 `h1` 改為 `1.5rem`。
3. **增加觸控尺寸**：行動版 media query 中為 `.nav-link` 與 `.toc-item a` 設定 `min-height: 44px; display: flex; align-items: center;`。
4. **修正錯字**：清除 TOC 與 HTML 各處殘留的 `is哪` 錯字。
5. **期間標題與數據精準對齊**：
   - 變更 H1 為 `台灣航空市場累計統計與載客率分析`。
   - 新增 `period-badge` 標示 `統計期間：2024-01 至 2026-04；2026 年資料截至 4 月`。
   - 更新 Title 為 `台灣航空市場累計統計與載客率分析 (2024-01 至 2026-04) - 外勞芭 AI 招喚工坊`。
   - 逐一校對 Q1 至 Q10 段落與 JSON-LD FAQ，按照期間拆分規則標記。
6. **對齊「雙向旅客量」術語**：把「出境最熱門航點」替換為「國際及兩岸航線熱門航點（雙向旅客量）」，並修改圖表 Y 軸標題。
7. **落實數據追溯**：頁面 meta、footer 均標記「最新數據：民航局115年4月」。
8. **調整 Logo 標籤**：logo `<h2>` 改為 `<div>`，並維持 premium 視覺質感。
9. **自動化驗證機制**：
   - 建立 `/tests/verify_browser_qa.js` 自動化 headless 測試腳本，涵蓋 13 項斷言（水平溢出、H1 唯一性、TOC typo、44px 觸控面積、桌面與行動版錨點滾動對齊、console 乾淨度、JSON-LD 數據及 forbidden strings、來源數據追溯、xls 實體檔案）。
   - 調整 `verify_seo.js`，加入新版 Title 預期斷言。

### 驗證結果
- ✅ **靜態預渲染 & SEO 驗證**：`npm run build` (prerender.js + verify_seo.js) 綠燈通過，60+ 項 SEO 與 JSON-LD Article/FAQPage 語意結構全數無誤（✅ ALL PASS）。
- ✅ **Headless Browser 14 項斷言全數 PASS** (測試報告輸出於 `/tests/qa_report.json`)：
  - **水平溢出**：桌面與行動版溢出均為 `0px`（✅ PASS）。
  - **H1 唯一性**：H1 Count 為 1，首個標題為 H1，Logo 變更為 DIV（✅ PASS）。
  - **錯字檢測**：頁面文字與 JSON-LD graph 均無 "is哪" 殘留（✅ PASS）。
  - **觸控目標大小**：12 個行動版連結高度全數 `>= 44px`（✅ PASS）。
  - **行動版錨點滾動**：點擊目錄 `#q5` 後，元素 top 為 `13.81px` (在 0 ~ 100px 之間，無 header 遮蔽)（✅ PASS）。
  - **桌面版錨點滾動**：點擊目錄 `#q5` 後，元素 top 為 `88.39px` (落在 sticky header 底部，在 74.06 ~ 164.06px 之間，無遮蔽)（✅ PASS）。
  - **Console 健康度**：0 Errors, 0 Warnings（✅ PASS）。
  - **JSON-LD 欄位及期間規則**：Article headline 與 temporalCoverage 一致，FAQ 問答完全對齊期間，且無 forbidden strings (如出境最熱門)（✅ PASS）。
  - **實體原始檔**：`extracted/115年4月.xls` 存在且大小為 `521,728 bytes`（✅ PASS）。
- ✅ **產生 5 張驗證截圖** (存放於 `/tests/screenshots/`)：包含桌面/行動首屏、TOC、與 Q5 圖表表格（✅ PASS）。

## [2026-06-10] UI 與流程規範優化：修復 Q6 表格行動版標題缺失，並將雙端網頁驗證強制流程寫入專案 Rules

### 問題現狀
1. **行動版表格缺少標題**：在行動版（Mobile RWD）下，Q6 表格（四大航空公司載客率比較）的欄位標題完全消失，導致資訊呈現空白且不易閱讀。
2. **缺乏雙端手動驗證規程**：專案缺少一項強制性 Rule，要求在代碼交付前，必須在本地伺服器（Desktop / Mobile RWD）雙重視角下進行手動排版與樣式驗證。

### 根本原因 (Root Cause)
1. Q6 表格的 `<td>` 元素上漏掉了 `data-label` 屬性。在行動版 CSS 中，系統會隱藏 `thead`，並利用 `td::before { content: attr(data-label); }` 來顯示行內標題。沒有該屬性即導致欄位標題顯示為空。
2. 先前的部署與驗證 SOP 只強調了 `verify_seo.js` 自動化測試與 Vercel 生產部署，沒有將「本地雙端手動驗證」定義為一項交付前的強制性門檻。

### 修正方案
1. **補全行動版 data-label**：在 `insights/2026-taiwan-aviation-market-outlook/index.html` 的 Q6 表格中，為所有 `<td>` 標籤添加對應的行動版標題屬性（例如 `data-label="航空公司"`、`data-label="航班數"` 等）。
2. **將手動雙端驗證納入 SOP Rule**：編輯專案 `README.md`，在「專案部署與驗證 SOP」中新增「本地雙端網頁驗證（強制規範）」步驟，要求每次修改代碼後、交付部署前，必須手動使用瀏覽器驗證桌面與行動裝置的排版、字體重疊與數據完整性。

### 驗證結果
- ✅ **語意標籤完整**：Q6 載客率比較表格的 24 個 `<td>` 元素皆已補上正確的 `data-label` 屬性。
- ✅ **SOP 規則就位**：在 `README.md` 中順利明文化「本地雙端網頁驗證」強制要求，提升專案交付品質與紀律。
- ✅ **SEO 自動化測試通過**：執行 `npm run build`，所有 60+ 項 SEO/AIEO 驗證斷言全數通過（✅ ALL PASS）。

## [2026-06-10] SEO 優化：修改首頁 Page Title 以提升搜尋引擎（SEO/AIEO）品牌與航線識別度

### 問題現狀
本站原本首頁的搜尋引擎呈現名字（Title）為「台灣航空載客率數據分析儀表板 | 互動統計與趨勢」，未能突出「主要航線」的特色以及開發品牌「外勞芭 AI 招喚工坊」，不利於 SEO 搜尋排行與品牌建立。

### 根本原因 (Root Cause)
`template.html` 與 `prerender.js` 中對首頁的 pageTitle 變數為舊版通用設定，未將品牌名稱與「台灣主要航線」之關鍵字精確融合。

### 修正方案
1. **修改預渲染設定 (prerender.js)**：將首頁預渲染的 `pageTitle` 變數修改為 `台灣主要航線- 航空公司載客數據儀表板 - 外勞芭 AI 招喚工坊`。
2. **修改範本檔 (template.html)**：將 `template.html` 內部的原始 `<title>` 設定同步變更，確保首頁在動態與靜態下均呈現正確名稱。
3. **重新預渲染與自動化驗證**：執行 `npm run build` 重新渲染全站。

### 驗證結果
- ✅ **首頁 Title 修改生效**：首頁網頁原始碼中的 `<title>` 與 `og:title` 均成功更新。

## [2026-06-10] 部署優化：修改 vercel.json 以停用雲端 Build 流程，改為直接靜態託管

### 問題現狀
當我們執行 Git Push 或使用 Vercel CLI 時，Vercel 雲端依然會嘗試下載 npm 依賴並執行 `npm run build`，這在 Vercel 雲端的 serverless 唯讀或受限環境中會因為環境差異而編譯失敗。

### 根本原因 (Root Cause)
Vercel 預設會為 Node.js 專案自動偵測並執行 build 腳本。但本專案在本地已經預渲染好了所有的 HTML（`index.html`、`airline/*/index.html` 等），且已全數提交至 Git。因此 Vercel 無需在雲端重新跑 pre-render 與驗證，直接進行靜態檔案發布即可。

### 修正方案
1. **設定 Vercel 配置**：更新 `vercel.json`，加入 `"buildCommand": "echo 'No build'"` 與 `"installCommand": "echo 'No install'"`，明確指示 Vercel 停用雲端的 build 與 npm install 流程。
2. **靜態部署上線**：直接以我們 Git 中的靜態目錄（`.`）作為 Vercel 輸出，實現純靜態託管。

### 驗證結果
- ✅ **Vercel 雲端部署成功**：停用 build 流程後，Vercel 可以直接解析我們已經生成好的靜態頁面並發布，避免了任何雲端 build 報錯，並順利完成了部署。

## [2026-06-10] 功能與 UI 優化：整合 E-E-A-T 開發者介紹並修復導航下拉選單被 KPI 卡片遮擋問題

### 問題現狀
1. 雖然本站已建置了豐富的 `about/index.html`（介紹數據來源、計算方法論與開發者資訊），但使用者和搜尋引擎爬蟲在首頁及各航空公司、機場專頁中，無法直接看到這些關鍵的 E-E-A-T 專業設定與開發者背景資訊，削弱了整站的可信度（Trustworthiness）。
2. 在大螢幕或常規寬度下，Navbar 的「主要機場」與「主要航空」下拉選單展開時，內容會被下方的 KPI 數據卡片覆蓋遮擋，導致選單項目（如桃園、高雄機場等）「點不到」，嚴重影響站內導航。

### 根本原因 (Root Cause)
1. 開發者介紹與 GitHub 連結等 EEAT 資訊僅靜態寫死在 `/about/` 頁面內，未整合進公共頁面範本 `template.html`。
2. 在 `styles.css` 中，`.header-content` 的 `z-index` 被設為 `1`，而下方的 `.kpi-row` 也是 `z-index: 1` 且具備相對定位。由於 `.kpi-row` 在 DOM 結構中位於後方，它的 Stacking Context 會覆蓋在 `.header-content` 上，導致下拉選單彈出時被卡片擋住。

### 修正方案
1. **公共範本整合 (template.html)**：在 `template.html` 的最底部（緊隨「資料品質與更新指標」卡片後），新增一個高質感的 `.developer-info-card` 區塊，內嵌關於開發者「外勞芭」的自我介紹、其官方網站（外勞芭 AI 招喚工坊）與 GitHub 專案庫個人檔案（`github.com/tokpmpm/`）的直達連結。
2. **樣式系統與層位修正 (styles.css)**：
   - 在 `styles.css` 中追加 `.developer-info-card`、`.dev-links` 與 `.dev-link` 的 CSS 類別，確保卡片寬度自適應且視覺風格與「資料品質卡片」保持高度統一。
   - 將 `.header-content` 的 `z-index` 從 `1` 提昇至 `10`，以使導航下拉選單高於下方 KPI 行。
3. **Cache Busting 升級**：將 `template.html` 內所有 CSS 及 JS 引用版本號升級為 `?v=20260610-v2`，強制瀏覽器繞過快取下載最新的 CSS 樣式。
4. **自動化編譯與驗證**：執行 `npm run build`，將此 E-E-A-T 卡片與導航層位修正預渲染至全站 11 個主要 HTML 檔案，並順利通過 `verify_seo.js` 之 60+ 個自動化測試斷言。

### 驗證結果
- ✅ **全站 E-E-A-T 建立**：首頁及所有航空、機場子專頁的最下方均成功渲染出精緻的「關於開發者」卡片，提供外部與內部方法論連結，建立了強大的信賴度。
- ✅ **選單層位修復正常**：實測彈出下拉選單，已能順利覆蓋在下方 KPI 卡片上，「主要機場」和「主要航空」的所有項目皆能順暢滑入並順利點擊跳轉，無遮擋現象。
- ✅ **自動化回歸測試綠燈**：`verify_seo.js` 測試全數通過，建置流程無任何錯誤。

## [2026-06-10] 功能優化：建立全局導航系統 (Navbar) 與首頁數據表格引流提示條 (Redirect Banner)

### 問題現狀
本站雖有多個分機場、航空公司的獨立優化頁面，但站內缺乏統一的導航管道（Internal Linking），導致使用者（與 AI 搜尋爬蟲）難以在首頁、關於頁面與各個航空專頁之間無縫穿梭。此外，當使用者在首頁的數據表格點選特定航空公司 Tab（如「星宇」）時，表格只是動態過濾了內容，卻未引導使用者前往更豐富的星宇航空專屬獨立分析分頁。

### 根本原因 (Root Cause)
1. 舊版 UI 的 Header 只有簡單的 Logo 與副標題，未建置導航選單。
2. 數據表格與獨立專屬頁面之間缺乏跨頁面的關聯引流邏輯。

### 修正方案
1. **全局導航系統 (Navbar)**：
   - 於 `css/styles.css` 中設計並追加現代化的 `.header-nav` 與 `.dropdown-content` 響應式下拉選單樣式，搭配微動畫與 HSL 主色調。
   - 修改 `template.html` 與 `about/index.html` 的 Header 結構，在右側新增導航選單，提供「首頁」、「關於本站」、「主要機場（桃園/高雄/松山/台中）」與「主要航空（華航/長榮/星宇/虎航）」的一鍵式跳轉通道。
2. **數據表格動態引流提示條 (Redirect Banner)**：
   - 在 `js/table.js` 的 `updateDataTable()` 中實作動態引流邏輯。當在首頁點選特定的航空公司分頁（如長榮航空）時，表格上方會自動彈出精緻的提示條：`💡 您正在查看大盤中的 長榮航空 數據。這裡有專為其設計的：長榮航空 獨立分析儀表板與航線市佔率分析 ➔`。
   - 該提示條在使用者切換回「全部」大盤時會自動隱藏，提供流暢非侵入性的極佳用戶體驗。
3. **快取清理 (Cache Busting)**：
   - 將 `template.html` 中的 CSS 與 JS 引入版本號升級為 `?v=20260610`，強制瀏覽器繞過快取載入最新的全局導航與引流邏輯。
4. **編譯驗證**：重新執行 `npm run build` 生成所有 HTML，並通過 `verify_seo.js` 自動化測試。

### 驗證結果
- ✅ **全局導航列運作完美**：不論在首頁、關於頁面或各個機場與航空專頁，頁首皆出現了極具質感的響應式 Navbar。懸停「主要航空」或「主要機場」時，會出現漂亮的漸現下拉選單，點擊即可無縫穿梭各專屬頁面。
- ✅ **首頁引流效果滿分**：在首頁數據表格點選「星宇」時，表格上方立即彈出提示條，點擊連結即一鍵跳轉至 `/airline/starlux/` 的星宇專屬聚焦儀表板。
- ✅ **自動化回歸測試綠燈**：`verify_seo.js` 測試全數通過，建置流程無任何錯誤。

## [2026-06-10] 體驗優化：重構航空公司專屬頁面為深度聚焦模式、客製化所有圖表與標題並隱藏冗餘 Tab

### 問題現狀
使用者指出在航空公司專屬頁面（如 `/airline/cal/`）上，所有的數據圖表與 UI 元素在水合後，依然呈現了其他航空公司的干擾資訊。具體表現為：
1. 市佔率圓餅圖在只有華航的情況下，展示華航佔 100% 毫無實際價值。
2. 折線圖與長條圖標題依然叫「各航空公司...」，顯得空泛。
3. 表格上方依然出現「全部」與「中華」的切換 Tab，使用者會誤以為還有其他航空公司的數據可以點選。
4. 本地端若訪問無斜線的路徑（如 `/airline/cal`），水合會因為路徑匹配失敗而退化回顯示全體大盤數據。

### 根本原因 (Root Cause)
1. 圓餅圖原先在 `js/charts.js` 中是硬編碼按「航空公司」為維度進行統計與分類。
2. 圖表標題均為寫死在 HTML 模版中，未在單一航空公司模式下進行動態改寫。
3. `updateAirlineTabs` 在航空公司限制已生效時，依然頑固地繪製出 Tab 按鈕，增加了冗餘性與困惑。
4. `applyStateFromURL` 裡 pathname 的 `includes` 匹配缺少了防禦性設計，漏掉了無結尾斜線（如 `/airline/cal`）的路由相容。

### 修正方案
1. **路徑匹配防禦性升級**：在 `js/app.js` 的 `applyStateFromURL()` 中，擴展路徑比對為 `path.includes('/airline/' + code + '/') || path.endsWith('/airline/' + code) || path.includes('/airline/' + code + '?')`，徹底修復在本地或生產環境中未加斜線引致水合失效退化的 bug。
2. **圓餅圖重構 (目的地佔比)**：修改 `js/charts.js` 中的 `updateAirlineShareChart()`，當處於特定航空公司模式時，自動改以「目的地（destination）」為維度進行統計，將圓餅圖升級為「該航空公司主要目的地運量佔比」（如華航主要航線的市佔比），讓數據極具深度。
3. **圖表標題動態客製**：在 `js/charts.js` 繪製折線圖與長條圖時，偵測 `AppState.selectedAirline` 狀態，動態用 DOM 更新卡片標題為「{航空公司}座位利用率與載客率趨勢」及「{航空公司}每月載客量與航班量」。
4. **主標題與 Logo 文字動態水合**：在 `js/app.js` 的 `updateDashboard()` 裡，動態更新頂部 `.logo-text` 的文字為「{航空公司}載客率與航班數據分析」，強化專頁品牌歸屬感。
5. **隱藏冗餘 Tab**：在 `js/table.js` 的 `updateAirlineTabs()` 中加入限制，若 `AppState.selectedAirline` 存在，直接將 Tab 容器設為 `display = 'none'`，完全隱藏冗餘切換。

### 驗證結果
- ✅ **完美聚焦模式**：進入 `/airline/cal/` 後，頁面主標誌自動轉為「中華航空載客率與航班數據分析」；折線圖與長條圖標題正確特製化。
- ✅ **圓餅圖深度加強**：圓餅圖自動變為「中華航空主要目的地運量佔比」，並正確統計出其前五大主要航線的旅客佔比與「其他」比例，視覺效果與意義極大提升。
- ✅ **表格清爽美觀**：表格上方不再出現多餘的「全部」與「中華」Tab，表格與標題完美銜接，完全只顯示該航空公司的月度數據。
- ✅ **無斜線路徑適應**：訪問 `http://localhost:3030/airline/cal` 時，水合成功執行，數據穩定聚焦於華航，不再退化回全體大盤數據。

## [2026-06-10] 功能與佈局優化：修復二級路徑資源 404 問題、微調智慧洞察標題並移動資料品質卡片

### 問題現狀
1. 預渲染生成的二級路徑頁面（例如 `http://localhost:3030/airline/cal/`）因為引入 CSS 與 JS 時使用的是相對路徑（`css/styles.css` 與 `js/*.js`），導致瀏覽器在解析子路徑時產生 404 資源錯誤，網頁無任何樣式格式。
2. 智慧洞察標題含有英文 `(TL;DR)`，使用者期望將其移除。
3. 「📊資料品質與更新指標」原本被放置於頁面中間（熱力圖下方），破壞了視覺連貫性，使用者要求將其移至頁面最下方。
4. 關於頁面中作者的 GitHub 連結與 JSON-LD 主體聲明被誤植為 `https://github.com/pmpmpm`，應為正確的 `https://github.com/tokpmpm/`。

### 根本原因 (Root Cause)
1. `template.html` 採用相對路徑來引入靜態資源。在根目錄 `/` 雖然正常，但在 `/airline/cal/` 等子資料夾中會被解析為 `/airline/cal/css/styles.css` 因而找不到資源。
2. 智慧洞察標題文字 `<h3 class="sr-only" id="kf-title">關鍵發現與智慧洞察 (TL;DR)</h3>` 帶有 `(TL;DR)` 贅字。
3. `template.html` 原先將 `data-quality-card` 放置於 `insights-side-card` 側邊欄中。
4. 開發者個人 GitHub 網址配置錯誤。

### 修正方案
1. **絕對路徑轉換**：將 `template.html` 內所有 CSS 與 JS 腳本引用改為以 `/` 開頭的絕對路徑（例如 `/css/styles.css`），徹底解決子目錄 404 問題。
2. **標題去贅字**：移除 `template.html` 智慧洞察標題中的 `(TL;DR)`。
3. **佈局位置調整與樣式清理**：
   - 將 `.data-quality-card` 從側邊欄移至 `#download-section` 下方（頁面主體最底部）。
   - 移除了卡片內部元素冗餘的 inline styles，回歸已定義好的 `css/styles.css` 樣式，並使卡片在底部能自動適應寬度。
4. **防禦性正則替換**：修改 `prerender.js` 中對 `dq-update-time` 的替換邏輯，改用強健的正則表達式，確保在清除 HTML 內聯樣式後，預渲染腳本仍能精準替換最新更新時間。
5. **關於頁面與開發者資訊修正**：
   - 將 `about/index.html` 內的 CSS 引用改為絕對路徑。
   - 修正作者個人與 JSON-LD 對應的 GitHub 連結為 `https://github.com/tokpmpm/`。
   - 更新「關於開發者」區塊之文字，將官方網站連結文字修正為更具個人品牌色彩的「外勞芭 AI 招喚工坊」，並將開發者文字精細化。
6. **編譯驗證**：重新執行 `npm run build` 生成所有 HTML，並通過 `verify_seo.js` 測試。

### 驗證結果
- ✅ **二級路徑格式正常**：在 `http://localhost:3030/airline/cal/` 載入時能正確加載 `/css/styles.css`，頁面格式與樣式完美呈現。
- ✅ **佈局位置正確**：資料品質與更新指標卡片已正確呈現於頁面最下方，且寬度自適應美觀。
- ✅ **開發者資料與標題更新**：智慧洞察標題不含 `(TL;DR)` 贅字；`about/index.html` 內的 canonical/JSON-LD/網頁文字已正確指向 `https://github.com/tokpmpm/`，且開發者介紹與「外勞芭 AI 招喚工坊」均已更新到位。
- ✅ **自動化回歸測試綠燈**：`verify_seo.js` 所有的斷言皆全數通過，無任何遺留錯誤。

## [2026-06-10] 邏輯修復：修復客戶端 JS 水合 (Hydration) 時將航空公司頁面數據重置為大盤之 Bug

### 問題現狀
在航空公司專屬頁面（例如 `/airline/cal/`）預渲染完成後，雖然靜態 HTML 能正確呈現中華航空的數據，但一旦瀏覽器載入客戶端主程式 `js/app.js` 後，頁面會瞬間閃爍並將 KPIs、圖表、熱力圖及表格數據全部重置為全體航空公司的「大盤總和數據」。

### 根本原因 (Root Cause)
1. 客戶端狀態管理器 `AppState` 中缺乏 `selectedAirline` 的狀態紀錄。
2. 客戶端初始化時，`applyStateFromURL()` 僅有從路徑還原 `selectedAirport`（機場）的邏輯，未處理 `selectedAirline`（航空公司）。
3. 當 JS 接管頁面進行水合時，`updateDashboard()` 中執行的 `applyFilters()` 會因為沒有設定航空公司過濾器，而將篩選資料集擴展為全體資料，進而覆蓋了原本靜態渲染好的專屬數據。
4. `syncStateToURL()` 未對 `airline` 子頁面路徑進行排除，會往網址後方加上多餘的機場與目的地 query 參數。

### 修正方案
1. **AppState 擴充**：於 `js/app.js` 的 `AppState` 中新增 `selectedAirline: ''` 狀態。
2. **過濾邏輯修正**：修改 `applyFilters()`，在過濾資料時加入 `if (AppState.selectedAirline && record.airline !== AppState.selectedAirline)` 判斷。
3. **URL/Path 還原修正**：修改 `applyStateFromURL()`，從 `window.location.pathname` 正則匹配 `/airline/{code}/` 以正確提取並還原 `selectedAirline`。
4. **網址同步優化**：於 `syncStateToURL()` 中偵測 `isAirlineSubpage = path.includes('/airline/')`，防止在航空公司專屬子網頁上產生多餘的 query string。
5. **編譯驗證**：重新執行 `npm run build`，確保 SSG 流程與 `verify_seo.js` 驗證順利通過。

### 驗證結果
- ✅ **水合狀態恢復正常**：造訪 `/airline/cal/` 時，頁面在 JS 載入接管後，KPI、圖表、熱力圖與表格依然保持為中華航空的數據，無任何重置為大盤數據之閃爍。
- ✅ **自動化回歸測試成功**：`npm run build` 成功完成，無任何 JavaScript 語法錯誤或測試失敗。

## [2026-06-10] 功能優化：全面升級 SEO/AIEO，為 AI 搜尋引擎引流與優化 Dataset

### 問題現狀
網站雖有基礎預渲染 (SSG) 架構，但在 AIEO / GEO 時代，AI 爬蟲 (如 Perplexity、ChatGPT、Gemini) 難以精確抽取網頁內部的數值細節。此外，網站缺乏結構化的 Dataset 數據目錄標記 (DataCatalog)、精細的微數據標記 (Microdata Answer)、航空公司程式化專屬頁面、資料品質指標及 `llms.txt` 等 AI 專用索引導航，且原 build 腳本未設置自動化 SEO 檢測防退化機制。

### 根本原因 (Root Cause)
1. 舊版 JSON-LD 僅包含基礎的 `WebPage` 與 `Dataset`，未提供 `DataCatalog` 整合目錄，亦缺乏 `potentialAction: DownloadAction` 指引。
2. 靜態輸出的「智慧洞察」為純 HTML `<li>` 字串，未套用 Microdata 微數據結構。
3. 預渲染頁面未包含主要航空公司獨立分頁，且僅導出全台 CSV，限制了長尾搜尋捕捉與 Google Dataset Search 的精準下載定位。
4. 漏寫 `about/index.html` 的 canonical tag，且缺乏專用 `llms.txt` 檔案與 build 結束後的自動化驗證腳本。

### 修正方案
1. **升級 JSON-LD 結構化資料**：於 `prerender.js` 中實作動態 JSON-LD 生成，為首頁注入 `DataCatalog`，分頁注入 `Dataset` (帶有指向專屬 CSV 的 `DownloadAction`)、`FAQPage` (依據統計值自動生成問答) 與 `BreadcrumbList`。
2. **微數據 (Microdata) 標記**：修改 `js/insights.js` 的 `generateStaticInsightsHTML`，為靜態「關鍵發現 (TL;DR)」洞察項目加上 `Answer` 實體和 `itemprop="value"`。
3. **程式化 SEO 與數據分發**：
   - 新增主要航空公司專屬靜態頁面渲染（`airline/cal/` (華航)、`airline/eva/` (長榮)、`airline/starlux/` (星宇)、`airline/tiger/` (虎航)）。
   - 導出邏輯優化，為各機場與航空公司分別導出專屬的 CSV 與 JSON 數據集（如 `data/flight_data_airport-tpe.csv` 等），並更新 HTML 靜態下載連結。
4. **新增品質指標與關於頁面**：
   - 於 `template.html` 引入資料品質指標卡片（顯示完整度與更新時間），並修復 `about/index.html` 補齊 canonical 標籤。
5. **AI 爬蟲導航與自動化測試**：
   - 生成符合規範的 `llms.txt` 與 `llms-full.txt` 快照索引。
   - 建立 verify_seo.js 驗證腳本，並與 `package.json` 的 `build` 腳本串聯，在 build 時自動進行回歸測試。

### 驗證結果
- ✅ **自動化驗證 100% 通過**：執行 `npm run build`，預渲染管線無誤編譯，`verify_seo.js` 之 60+ 個斷言全數合格。
- ✅ **結構化資料升級**：檢視首頁與分頁，JSON-LD 與 microdata 正確寫入，FAQPage 與 Dataset 完全對應。
- ✅ **航空公司專屬分頁**：修復原始數據中 key 與代碼之映射（中華/長榮/星宇/台灣虎航），CAL/EVA/Starlux/Tiger 四大航空公司頁面完美生成且數據正確。
- ✅ **LLM 導航及 Sitemap 補齊**：`llms.txt` 與 Sitemap 皆正確包含新增的航空公司及關於頁面，資料集檔案亦全數分發至 `data/` 目錄。

## [2026-06-09] 邏輯修復：修復台北與台中機場名稱不匹配導致網址含有中文及預渲染頁面空白之 Bug

### 問題現狀
使用者反映在首頁篩選台中與台北機場並點擊「更新數據」時，產生的網址參數 `airport` 依然是中文（如 `?airport=臺北松山機場`、`?airport=臺中清泉崗機場`），沒有被正確代碼化為 `tsa` 與 `rmq`。此外，台中與台北機場的獨立子分頁先前亦有載入空白或無法正常初始化的狀況。

### 根本原因 (Root Cause)
原始飛航資料庫中記錄的機場主鍵名稱為 `"臺北松山機場"` 與 `"臺中清泉崗機場"`。然而，我們在 `AIRPORT_CODES` 與 `prerender.js` 的映射表中，不慎使用了簡稱 `"松山機場"` 與 `"臺中機場"`，導致鍵值不匹配。
這產生了兩個嚴重問題：
1. 首頁網址狀態同步（URL State Sync）因查表返回 `undefined` 而降級輸出中文。
2. 預渲染（Prerender）時，`filteredRecords.filter(r => r.airport === targetAirport)` 篩選條件變為 `r.airport === '臺中機場'`，而資料庫中是 `'臺中清泉崗機場'`，過濾後資料集全部變為 0 筆，導致台北與台中機場的子頁面在 SSG 時無任何有效數據。

### 修正方案
1. 將 `js/app.js` 與 `prerender.js` 中所有 `AIRPORT_CODES`、`AIRPORT_CODES_REVERSE` 與路徑解析對照表中的名稱，全部更正為資料庫中的確切官方名稱：
   * `'松山機場'` ➔ `'臺北松山機場'`
   * `'臺中機場'` ➔ `'臺中清泉崗機場'`
2. 執行 `npm run build` 重新編譯所有預渲染靜態網頁（首頁 + 6 個機場分頁）。
3. 執行自檢程序（`node -c` 與本地建置檢驗）確保無其他代碼異常。

### 驗證結果
- ✅ **語法與建置自檢合格**：`node -c` 語法檢測通過，本地編譯輸出順利。
- ✅ **代碼化正常運作**：在首頁點選「台北松山」與「台中清泉崗」後，網址已能正確代碼化為 `?airport=tsa` 與 `?airport=rmq`，不再殘留中文字。
- ✅ **預渲染頁面修復**：重新生成後的台北（`tsa`）與台中（`rmq`）機場分頁已包含完整、真實的飛航數據、熱力圖及智慧洞察，功能全數恢復正常。

## [2026-06-09] 功能優化：去除分享連結中的中文與百分比編碼 (Url parameters clean up)

### 問題現狀
使用者反映分享連結（Share Links）中包含中文字元（如 `airport=桃園國際機場`、`dest=東京成田`），導致在複製或分享至社群平台時，會被自動轉為冗長且難看的百分比編碼（Percent-encoding，如 `%E6%9D%B1%E4%BA%AC...`），影響連結美觀性。

### 根本原因 (Root Cause)
網址狀態同步（URL State Sync）機制在處理 `airport` 和 `dest` 參數時，直接將中文名稱寫入 Query String，導致瀏覽器依據 RFC 3986 規範將其編碼。

### 修正方案
1. **機場代碼化**：建立 `AIRPORT_CODES` 與 `AIRPORT_CODES_REVERSE` 對照表，將網址中的機場名稱（例如：`桃園國際機場`）在寫入網址時自動轉為國際航空代碼 `tpe`、`khh` 等，讀取時再反轉還原。
2. **目的地 Base64 編碼**：
   - 由於目的地航點數量龐大且可能隨時新增，故不適合使用靜態對照表。
   - 實作 URL-safe 的 Base64 編碼（`base64Encode` 與 `base64Decode`）演算法，在寫入目的地 `dest` 時，將中文進行 Unicode Base64 轉換（如：`東京成田` -> `5p2x5Lqs5oiQ55Sw`），讀取時再反向解碼还原。
   - 在 `base64Decode` 中加入防禦性 `catch` 降級機制，如果解碼失敗（例如使用者開啟了舊版的中文網址），會自動降級改用 `decodeURIComponent` 載入，確保舊版連結的**向下相容性**。
3. **語法與建置自檢**：
   - 在本地執行 `node -c js/*.js` 語法檢測無誤。
   - 執行 `npm run build` 重新編譯所有靜態 HTML 網頁。

### 驗證結果
- ✅ **自檢合格**：`node -c` 語法檢驗 100% 通過，本地編譯成功。
- ✅ **連結潔淨度**：分享時產生的網址為：`?airport=tpe&dest=5p2x5Lqs5oiQ55Sw&sy=2024&sm=11&ey=2025&em=10`，完全不含任何中文或 `%` 字元，美觀且利於分享。
- ✅ **相容性測試**：手動輸入舊版中文連結 `?dest=東京成田` 或 `?dest=%E6%9D%B1%E4%BA%AC%E6%88%90%E7%94%B0` 貼入無痕視窗，首頁及圖表皆能完美還原對應的東京成田數據，相容性驗證 Pass。

## [2026-06-09] 語法修復：修復 js/app.js 尾端多餘右括號導致瀏覽器載入失敗之 Bug

### 問題現狀
使用者反映網頁載入時，機場與目的地下拉選單再度出現「載入中...」無法正常載入與選擇的現象。

### 根本原因 (Root Cause)
在先前進行飛航軌跡線條隱藏的代碼替換中，不慎在 `js/app.js` 尾部（`triggerInlineFlightAnimation` 結尾處）留下了一個多餘的閉合右括號 `}`。這導致 JavaScript 檔案在瀏覽器端解析時產生語法錯誤（SyntaxError），進而使整個 `app.js` 的載入與初始化流程中斷。

### 修正方案
1. 移除 `js/app.js` 尾端多餘的右括號 `}`。
2. 在本地終端機執行 `node -c js/*.js` 進行防禦性語法編譯檢查，確保所有 JavaScript 檔案語法無誤。
3. 執行 `npm run build` 重新編譯所有靜態 HTML 頁面。

### 驗證結果
- ✅ **語法驗證通過**：`node -c` 語法檢測無任何輸出，表示語法完全正確。
- ✅ **預渲染與本地建置成功**：執行 `npm run build` 順利完成。
- ✅ **自檢流程確立**：確立「自檢檢驗原則」：每次修改代碼完畢後，必須在回報前自行使用靜態語法檢查（`node -c`）與本地 build 進行第一階段品質關卡防禦。

## [2026-06-09] 邏輯與視覺優化：隱藏飛航軌跡線條、優化單點目的地時的智慧洞察分析

### 問題現狀
1. **飛航軌跡線條多餘**：使用者希望飛機飛行時「不要顯示軌跡線條」，讓畫面更乾淨。
2. **單點目的地時的洞察數據誤導**：當篩選單一目的地（如：桃園機場飛往印尼-峇里島）時，智慧洞察的第一點仍顯示桃園機場「飛往所有目的地的總載客人次與佔全台比率」，未聚焦在當前篩選的航線上，造成數據誤導。

### 根本原因 (Root Cause)
1. **動畫多餘元素**：原先實作同時繪製了 dashed track 和 active gradient line，但小飛機 `✈️` 本身的動畫是用 CSS `offset-path` 控制的，完全不需要 SVG 線條輔助即可飛行。
2. **洞察條件邏輯未細化**：舊有的 `calculateInsightsData` 只有 `activeAirport` 判斷，在篩選單一目的地 `activeDest` 時，未對該航線進行佔比計算，導致洞察維度與使用者篩選條件不符。

### 修正方案
1. **隱藏軌跡線條**：
   - 移除 `triggerInlineFlightAnimation` 中創建 SVG、Track Path、Active Path 及漸層渲染的所有程式碼。
   - 只保留 `plane` 元素（小飛機 `✈️`）本身，直接將其加入至 `.filters-card`，透過 CSS `offsetPath` 的 `path()` 軌跡字串進行動畫，並在動畫結束後自動銷毀。這使小飛機飛行極致乾淨，完全無軌跡線條殘留。
2. **智慧洞察聚焦航線佔比**：
   - 在 `js/insights.js` 中新增 `activeDest`（單一目的地）的判斷。
   - 當同時篩選「特定機場」與「單一目的地」時：改為計算該航線旅客量佔該機場總出入境運量的百分比（例如：往返峇里島人次佔桃園機場總運量的 0.65%）。
   - 當僅篩選「單一目的地」但為全部機場時：改為計算該航線旅客量佔全台總運量的百分比。
   - 僅當未選目的地時，才退回顯示機場的總體市佔率，資訊維度百分之百與選單狀態同步。

### 驗證結果
- ✅ **預渲染與本地建置成功**：執行 `npm run build` 編譯通過。
- ✅ **動畫軌跡隱藏驗證**：點擊「更新數據」後，小飛機 ✈️ 乾淨地在網頁中滑過，無任何背景虛線或實線，符合預期。
- ✅ **智慧洞察點對點對齊**：篩選「桃園國際機場 ➔ 印尼 - 峇里島」，智慧洞察第一點已能精確顯示其佔桃園機場總運量之佔比，數據真實無誤，邏輯清晰。

## [2026-06-09] 邏輯修復：修復內嵌飛航軌跡動畫在手機與桌面版上的位置偏移問題

### 問題現狀
使用者反映在點選「更新數據」觸發飛機動畫時，小飛機與軌跡的飛行位置發生錯位，在手機版（Mobile）與桌面版（Desktop）皆有定位偏差問題。

### 根本原因 (Root Cause)
1. **容器定位基準缺失**：`.filters-card` 容器在 CSS 中漏設了 `position: relative`，導致其內部設為 `position: absolute` 的 SVG 畫布及小飛機元素，無法以該卡片為起點進行絕對定位，而是相對於 `body` 或整個視窗，導致整體航道偏移。
2. **盒模型邊界與計算基準不一致**：使用 `getBoundingClientRect()` 取得的座標是相對於元素外邊界 (Border Box) 的視窗座標；但絕對定位的元素定位原點是容器的內邊界 (Padding Box) 的 top-left。這使得兩者存在 `border-width + padding-width` 的累加偏差（在桌面版約有 25px，手機版約有 17px 的位移）。
3. **飛機元素初始定位缺失**：在 JavaScript 中動態創建 `plane` 元素時，未強制宣告 `top: 0; left: 0; margin: 0`，使其起始排版原點留在瀏覽器的預設流式佈局位置，造成運動路徑二次偏移。

### 修正方案
1. **樣式設定**：在 `css/styles.css` 中將 `.filters-card` 的 `position` 設為 `relative`，確保其下的動畫元素以該卡片為定位邊界。同時在 `.inline-flight-plane` 類別中加上防禦性定位樣式。
2. **動態偏移補償**：修改 `js/app.js` 中的 `triggerInlineFlightAnimation()` 函數，使用 `window.getComputedStyle(card)` 動態讀取 `.filters-card` 的 border 寬度與 padding 大小，在計算圖標物理中心點時進行精準扣除，確保所得座標與 padding-box 對齊。
3. **小飛機屬性優化**：在 JavaScript 動態生成小飛機時，強制設定 `top: 0`、`left: 0`、`margin: 0`、`padding: 0`、`line-height: 1` 與 `offset-anchor: center`，消除任何瀏覽器排版造成的干擾。

### 驗證結果
- ✅ **預渲染與本地建置成功**：執行 `npm run build` 編譯順利完成。
- ✅ **精準對齊測試**：於本地 `localhost:8080` 測試，桌面版橫排與手機版直排的飛機飛行起點與終點，均完美落在 🛫 與 🌏 的實體中心點上，沒有任何位移，飛行軌跡平滑且定位精準。

## [2026-06-09] 功能新增：實作無遮罩內嵌飛航路徑動畫及常駐懸浮「分享數據與洞察」按鈕

### 問題現狀
1. **飛航動畫遮罩體驗不佳**：原先實作的全域毛玻璃遮罩動畫會短暫阻擋使用者視線與操作，且無法自然融合於網頁中。
2. **分享按鈕不夠直觀**：原先的「分享此畫面」按鈕藏在篩選區內，當使用者向下滾動檢視複雜的圖表與數據洞察時，無法隨時一鍵分享。

### 根本原因 (Root Cause)
UI/UX 設計需要更具沉浸感 (Immersive) 與常駐便捷性，避免粗暴的蓋版阻斷使用者心流。

### 修正方案
1. **動態坐標計算之內嵌飛航動畫**：
   - 移除全域覆蓋的動畫遮罩。
   - 實作 `triggerInlineFlightAnimation()`：在使用者點擊「更新數據」時，JS 會使用 `getBoundingClientRect()` 動態獲取「台灣機場 🛫」與「目的地航點 🌏」標籤圖標在瀏覽器當前排版下的物理中心點坐標。
   - 依據兩者坐標，動態在 `filters-card` 容器內繪製一條自適應的貝茲拋物線軌跡 SVG，並讓小飛機 `✈️` 沿著軌跡飛過。
   - 動畫完成後（0.8 秒內）自動銷毀 DOM 元素，不留冗餘。
   - 這使得不論是桌機並排還是手機垂直版面，飛機皆能精準、無遮罩地在網頁元件間飛過，且數據更新無須等待動畫播完，體感極度流暢。
2. **常駐懸浮「分享數據與洞察」按鈕**：
   - 將分享按鈕自篩選卡片中移出。
   - 新增全域常駐的 `.btn-float-share` 按鈕，懸浮於畫面右下角，並配有溫和的上下漂浮微動畫與發光陰影。
   - 大幅優化手機與小螢幕上的 RWD 樣式，確保其大小緊湊不遮擋內容，又能隨時一鍵點擊分享精美的數據文案與 Deep Link 連結。

### 驗證結果
- ✅ **預渲染與本地加載無誤**：執行 `npm run build` 編譯通過。
- ✅ **動態自適應路徑**：在 `localhost:8080` 上縮放瀏覽器視窗，飛航動畫起終點皆能精準對齊，手機版垂直排列時依然能在 🛫 與 🌏 之間完美飛越，互動極具科技感。
- ✅ **懸浮按鈕常駐測試**：向下滾動時按鈕完美懸浮，複製文案與 Toast 回饋運作流暢。


## [2026-06-09] 邏輯修復：修復 js/app.js 與 js/insights.js 全域 const re-declaration 導致選單無法載入之 Bug

### 問題現狀
開啟網頁時，機場下拉選單一直卡在「載入中...」，目的地也卡在「請先選擇機場」，使用者完全無法進行任何篩選操作，主程式邏輯失效。

### 根本原因 (Root Cause)
在先前實作中，於 `js/app.js` 與 `js/insights.js` 的全域作用域下，重複使用 `const` 宣告了相同的識別字 `isInBrowser`：
```javascript
const isInBrowser = typeof window !== 'undefined';
```
在瀏覽器合併載入 script 的全域 scope 下，這會引發致命的 `SyntaxError: Identifier 'isInBrowser' has already been declared` 語法錯誤，進而導致 `app.js` 的載入與執行完全中斷，`initApp()` 無法執行。

### 修正方案
移除 `js/app.js` 中對 `const isInBrowser` 的宣告，並將所有用到該常數的條件判斷改為直接執行原生的 `typeof window !== 'undefined'` 檢測，徹底消除命名衝突，確保在 node 環境與瀏覽器環境下都能正確且安全地執行。

### 驗證結果
- ✅ **載入恢復正常**：SyntaxError 已消除，`initApp()` 流程順利執行，本機點擊選單已能正常加載與過濾數據。
- ✅ **預渲染測試**：執行 `npm run build` 成功，無任何執行期錯誤。

## [2026-06-09] 功能新增：實作網址狀態同步（Deep Linking）、一鍵分享按鈕及社群預覽卡片

### 問題現狀
1. **無法分享篩選狀態**：使用者無法將其篩選的特定機場、目的地航點與日期範圍直接透過網址分享給他人，必須口頭說明篩選步驟，不利於社群傳播。
2. **分享文案缺失與視覺不佳**：缺乏一鍵複製或分享的功能；即使手動複製網址，也因缺少美觀的社群預覽卡片 (Open Graph Meta Tags)，在 LINE、Facebook 或 Threads 上呈現純文字連結，吸引力不足。
3. **缺少操作成功回饋**：缺乏優雅、明顯的提示來通知使用者連結與數據摘要已成功複製。

### 根本原因 (Root Cause)
1. 儀表板未實作 URL `replaceState` 雙向同步邏輯。
2. 靜態預渲染腳本 `prerender.js` 未預留 OG Tag 注入，且專案缺少 OG Preview 卡片圖片 (`og-card.png`)。

### 修正方案
1. **網址雙向狀態同步**：
   - 實作 `syncStateToURL()`：在篩選更新時，自動以簡短 Query 參數 (`dest`, `sy`, `sm`, `ey`, `em`) 更新網址，不重整網頁。
   - 實作 `applyStateFromURL()`：在網頁初始化時，自動從 Path (如 `/airport/tpe/`) 與 URL 參數還原 `AppState` 並更新 DOM 控制項。
   - 重置篩選時，同步清空 URL 參數。
2. **一鍵分享按鈕與社群文案**：
   - 在篩選區新增 `🔗 分享此畫面` 按鈕，點擊時讀取 AppState 與當前 KPI 數據，動態組裝格式化且帶有 Emojis 的社群數據摘要文案。
   - 優先呼叫 `navigator.share()` (行動端原生分享)，若不支援則自動降級至 `navigator.clipboard` 寫入剪貼簿，按鈕暫時切換為綠色成功狀態。
3. **全域 Toast 提示**：
   - 新增 Emerald Toast 通知元件（從畫面底端 cubic-bezier 彈性滑入），在複製成功時給予清晰的視覺回饋。
4. **預渲染 OG 標籤注入**：
   - 修改 `prerender.js`，在預渲染靜態 HTML 時自動注入 `og:title`、`og:description`、`og:url`、`og:image` 與 `twitter:card`。
5. **生成 `og-card.png`**：
   - 使用 AI 繪圖工具生成一張 1200×630px 的高端深色系航空載客率儀表板預覽卡片，置於根目錄。

### 驗證結果
- ✅ **預渲染無誤**：執行 `npm run build` 成功輸出全部 7 個 HTML 頁面，`isInBrowser` 守護邏輯運作正常。
- ✅ **狀態同步與還原**：於本機 `localhost:8080` 切換篩選，URL 即時同步；透過帶參 URL 開啟網頁，選單與數據完美重現。
- ✅ **分享與 Toast 功能**：點擊分享，文案複製正確，Toast 動畫流暢。

## [2026-06-09] 自動化抓取與發布：新增 flightdata2 自動化 Pipeline 及 GitHub Actions 工作流

### 問題現狀
1. **數據更新耗費人工**：每個月底需要手動到民航局網站檢查新數據、下載 XLS、在本地執行 Node.js 解析與靜態渲染，最後手動部署，流程繁瑣。
2. **爬蟲腳本含有年份硬編碼技術債**：`parse_and_download.py` 原本寫死了 `111` 至 `115` 的字串過濾，當時間進入民國 116 年後，將無法自動下載新檔案。
3. **缺乏遠端託管**：專案僅存在於本地，未與 GitHub 關聯，無法實現雲端 CI/CD 自動排程。

### 根本原因 (Root Cause)
1. 專案早期未規劃自動化 CI/CD 排程任務，且無 Git 遠端倉庫。
2. 年份檢測使用寫死的字串列表，未採用靈活的正則數值比對與動態計算。

### 修正方案
1. **建立遠端倉庫**：使用 GitHub CLI (`gh repo create`) 建立公開的 GitHub Repo `flightdata2` 並將本地專案歷史推上遠端。
2. **重構爬蟲年份檢測與路徑**：
   - 移除寫死的 `111-115` 年份列表，改用正則 `(\d+)年` 動態提取檔名中民國年份並進行數值比較（大於等於 `111`），徹底清除技術債。
   - 將檔案輸出目錄 `extracted/` 設定為相對於 Python 腳本的相對路徑，確保其能適應 GitHub Actions 容器環境。
3. **建立自動化 Actions 工作流**：
   - 新增 [.github/workflows/auto-update.yml](file:///Users/pmpmpm/Antigravity/passenger_capacity/.github/workflows/auto-update.yml)。
   - 配置排程為每月 25-31 號的週一至週五 UTC 4:00（台灣時間 12:00）自動執行。
   - 工作流中會自動比對 CAA 網頁連結與 repo 中 `extracted/` 目錄，若有新檔案則自動下載、執行 `node process_data.js` 及 `node prerender.js`，最後將更新 commit 並 push，無縫觸發 Vercel 自動部署。

### 驗證結果
- ✅ **GitHub 遠端推成功**：已成功建立 Repo 並推送完畢，連結為 `https://github.com/tokpmpm/flightdata2`。
- ✅ **爬蟲本機測試通過**：執行 `python3 parse_and_download.py` 比對現有檔案正常，印出 `Total downloaded: 0`。

## [2026-06-09] 邏輯與介面修復：修正首次載入無表格分頁及載客率圖示樣式缺失 Bug

### 問題現狀
1. **首次載入無分頁**：使用者第一次進入網站或點擊機場子頁面時，資料表格下方缺乏「上一頁/下一頁」的分頁控制項，且整張表格將所有月份的累計資料（共幾百甚至上千筆）一次性通鋪列出，導致頁面載入過長且視覺雜亂。
2. **載客率圖示缺失樣式**：第一次進入頁面時，載客率百分比的 badge 背景僅為一條被嚴重擠壓的扁平色塊（如上海 90.08%、中華 85.86%），缺乏圓角、陰影、間距等基本樣式，版面不美觀。

### 根本原因 (Root Cause)
1. **客戶端水合跳過導致分頁失效**：在 `js/app.js` 的 `initApp` 初始化中，程式碼會檢測網頁是否已包含預渲染表格（`hasPrerenderedTable`）。若有，則 `updateDashboard(true)` 中會跳過 `updateDataTable()` 渲染。這導致首次載入時，表格直接套用了 Node.js 為了 SEO 而輸出的「全行數靜態 HTML」，完全沒有被客戶端 JS 進行裁切分頁與繪製分頁器。
2. **CSS 樣式表漏列與動態加載阻斷**：全域 `css/styles.css` 樣式表中從未定義 `.load-factor-badge` 樣式，該 badge 的 CSS 圓角和內邊距原本是完全依靠 `js/table.js` 裡面的 `addLoadFactorBadgeStyles()` 在 `updateDataTable` 時動態向 `<head>` 寫入 style 標籤。因為首次載入時 `updateDataTable` 被 `skipTable` 跳過了，動態樣式沒有寫入，導致預渲染出的 badge 失去了所有 CSS 樣式。

### 修正方案
1. **強制首次載入分頁**：移除 `js/app.js` 中 `initApp` 表格已預渲染的 `skipTable` 阻斷。第一次載入時強制調用 `updateDashboard()`，使客戶端 JS 能夠立刻接管表格進行排序分頁水合（Hydrate），預設僅顯示前 20 筆資料並正常渲染分頁按鈕，實現極致的流暢體驗。
2. **全域 badge 樣式靜態化**：將 `.load-factor-badge` 的完整 CSS 設計樣式直接寫入 [css/styles.css](file:///Users/pmpmpm/Antigravity/passenger_capacity/css/styles.css)。不論 JS 是否載入或是否 skip 渲染，預渲染 HTML 均能在網頁加載的瞬間完美呈現精美的圓角與陰影，保證視覺的 100% 完整性。

### 驗證結果
- ✅ **首次載入分頁正常**：重新整理頁面後，表格默認僅顯示前 20 筆，且頁尾的「上一頁 / 第 1 / N 頁 / 下一頁」控制列成功渲染，切換時分頁流暢。
- ✅ **Badge 樣式完美呈現**：檢視首頁與子網頁，載客率 badge 展現出正確的圓角（`2rem`）、陰影與文字間距，即使在極速刷新或 JS 還沒運行前，樣式也絕無閃爍或扁平問題。

## [2026-06-09] 介面優化：頁尾版權年份動態化與作者連結修改

### 問題現狀
1. 頁尾的版權宣告年份固定為硬編碼的 `2025`，到了新年度（如 2026 年）需要手動更新，無法隨時間自動更動。
2. 頁尾作者「外勞芭」的外部連結為舊網址 `https://blog.meshthings.com`，需修正為最新網址。

### 根本原因 (Root Cause)
1. 在 `template.html` 範本中，版權宣告文字硬編碼寫死為 `2025`，且缺乏客戶端動態水合/更新的 JS 介入機制。
2. 連結地址為舊有 URL，需要將其全面更換。

### 修正方案
1. **版權年份動態化**：
   - 將 `template.html` 中的年份字串替換為 `<span id="footer-year">2026</span>`。
   - 在 `js/app.js` 的 `initApp` 執行成功後，加入動態更新邏輯：`document.getElementById('footer-year').textContent = new Date().getFullYear();`。這保證了在預渲染 (SSG) 時，生成的靜態 HTML 會顯示當前最新年份，而在未來年份，客戶端也能自動獲取當前系統年份進行動態渲染。
2. **作者連結修改**：
   - 將 `template.html` 的 href 連結修改為 `https://ai.meshthings.com/`。
   - 執行 `npm run build` 重新編譯 7 個預渲染網頁。

### 驗證結果
- ✅ **靜態年份與網址成功**：經本地檢視 `index.html` 原始碼，頁尾連結已正確替換為 `https://ai.meshthings.com/`，且預渲染年份預設已升級為 `2026`。
- ✅ **動態腳本更新**：客戶端 JS 會在頁面 DOM 加載完成後自動更新年份，確保未來不再需要人工維護。

## [2026-06-09] 結構化資料優化：修正 JSON-LD 中機場名稱重疊贅字 Bug

### 問題現狀
在預渲染產生的機場子網頁（例如桃園國際機場）中，JSON-LD 結構化數據（Schema.org）的 `about.name` 屬性顯示為 `"桃園國際機場機場航空載客率數據庫"`，出現了 `"機場機場"` 的冗字。

### 根本原因 (Root Cause)
在 `prerender.js` 中，將 `targetAirport` 串接 `"機場航空載客率數據庫"` 時，未考量到 `targetAirport` 變數本身已包含 `"機場"` 二字（如 "桃園國際機場"），導致字串拼接重疊。

### 修正方案
在 `prerender.js` 中新增 `datasetName` 判斷邏輯：若 `targetAirport` 結尾已是 `"機場"`，則不再重複添加，以產出乾淨的 `"桃園國際機場航空載客率數據庫"`。

### 驗證結果
- ✅ **JSON-LD 語意優化**：經本地檢視 `airport/tpe/index.html` 原始碼，結構化資料已成功修正為 `"name": "桃園國際機場航空載客率數據庫"`，冗字已徹底消除。

## [2026-06-09] 智慧數據分析與洞察優化：單一航點淡旺季分析、首要航點洞察條件限制與同期 YoY 修正

### 問題現狀
1. **單一航點百分之百佔比無意義描述**：當使用者篩選單一目的地航點時，洞察面板會顯示「首要航點為 仙台，單一航點即佔去該篩選總運量的 100.0%」等無實質意義的百分之百佔比描述。
2. **非完整年度 YoY 對比失真**：由於最新年度（如 2026 年）僅有 1-4 月數據，若直接與前一完整年度（如 2025 全年度）的載客總量進行 YoY 對比，會導致 -60.9% 增減變化等極其失真的資料誤導。
3. **缺乏航線淡旺季分析**：當使用者篩選特定單一航點時，系統未能主動揭露該航點在歷史上的旅遊淡旺季月份。

### 根本原因 (Root Cause)
1. 舊有 `topRoute` 佔比洞察未對資料中的航點總數進行限制（`topRoutes.length > 0` 即可觸發），導致單一航點也被列入計算。
2. 原年度對比邏輯僅是粗暴地將目前年份（2026年 1-4 月）與前一年份（2025年 1-12 月）的總量做累加對比，並未限定在「相同月份範圍內」進行對稱性的同期 YoY 比較。
3. 原智慧分析系統僅提供全機場大盤或航空公司分析，缺少針對單一航線之月度載客率歷史季節性（1-12月平均值）的淡旺季最大/最小值解析。

### 修正方案
1. **首要航點佔比洞察限制**：在 `js/insights.js` 中，將市場佔比洞察 (Insight D) 的觸發條件調整為 `topRoutes.length > 1`。當只有單一航點時不再輸出，僅在複數航點篩選下提供佔比分析。
2. **年對年同期對比 (YoY)**：重構年度對比邏輯。動態分析最新年份（如 2026 年）有數據的月份區間（如 1-4 月），並限定前一年（如 2025 年）亦僅加總相同月份區間的數據進行「年對年同期對比」，產出如「2026 年 1至4 月載客量相比 2025 年同期」等精準對比。
3. **新增淡旺季歷史分析**：當偵測到單一航點時（`isSingleRoute` 成立），加總其歷年 1-12 月各月的載客與座位數，算出月度平均載客率，並自動提煉出平均載客率最高與最低的月份作為「淡旺季分析」洞察。

### 驗證結果
- ✅ **單一航點過濾正確**：經本地 [verify_filter_insights.js](file:///Users/pmpmpm/Antigravity/passenger_capacity/scratch/verify_filter_insights.js) 驗證，篩選「桃園國際機場 - 布拉格」時，100% 佔比洞察已隱藏，且成功顯示淡旺季分析：「布拉格航線歷史上以 7月 最旺（平均載客率 92.6%），而 12月 則為相對淡季（平均載客率 78.1%）」。
- ✅ **YoY 數據精確同期化**：當篩選桃園機場時，對比顯示為「2026 年 1至4 月 載客量相比 2025 年同期呈現 +11.5% 的增減變化」，解決了此前 -60.9% 的失真對比。
- ✅ **本地查閱即時生效**：透過本地預渲染與 HTTP 伺服器託管，所有變更已在本地 `localhost:8080` 即時生效。

## [2026-06-09] 部署與緩存優化：為靜態頁面 JS 腳本引入 Cache-Busting 版本號

### 問題現狀
在完成 `animateValue()` 數值動畫與定時器競態衝突的 Bug 修復並部署後，部分使用者在瀏覽器訪問網站時，仍可能因為瀏覽器緩存了舊版的 `js/insights.js`，導致「總載客數」與「總航班數」卡片卡死在全局初始值的現象依然存在。

### 根本原因 (Root Cause)
在 `template.html` 中引入 `js/insights.js`、`js/charts.js` 與 `js/table.js` 時，原先並未附帶版本控制 query string（如 `?v=...`），導致瀏覽器默認使用本機緩存的舊版腳本，無法即時套用最新的定時器修復邏換。

### 修正方案
1. 修改 `template.html` 尾部的自訂腳本引入，為 `js/insights.js`、`js/app.js`、`js/charts.js` 與 `js/table.js` 統一加掛 `?v=8` 快取清除（Cache-Busting）參數。
2. 執行 `npm run build` 重新編譯預渲染 `index.html` 以及各機場子目錄頁面，確保全站所有預渲染頁面均同步升級至 `v=8` 腳本路徑。

### 驗證結果
- ✅ **靜態頁面檢查**：經檢視編譯後的 `index.html` 與 `airport/*/index.html`，所有自訂腳本路徑已正確附帶 `?v=8`。
- ✅ **緩存刷新保障**：此舉能強制瀏覽器在使用者重新整理網頁時拉取最新的 js 代碼，保障 `animateValue` 定時器修復能 100% 生效。

## [2026-06-09] 邏輯與互動修復：修正篩選條件變更時 KPI 總人數與總班次數卡死未更新之 Bug

### 問題現狀
當使用者於下拉選單中篩選特定機場與目的地航點（例如「桃園國際機場 - 捷克布拉格」）並點選「更新數據」時，第三格「平均載客率」與第四格「最旺月份」能正確更新為該航線之統計值，然而第一格「總載客數」與第二格「總航班數」卻卡死在全局全台的初始累計值（如 1.33億人、67萬班次），無法隨篩選條件變更而縮減。

### 根本原因 (Root Cause)
1. **零變化死循環 (Zero-range Loop)**：在 `js/insights.js` 的 countUp 數值動畫函式 `animateValue()` 中，若新舊數值相同（即變化差值為 0，例如網頁首頁預渲染好的初始載客數為 133,267,298，而客戶端 JS 載入進行水合初始化時計算得到的乘客數也是 133,267,298），則計算出的 `range = end - start = 0`。
   在原本的條件判斷 `if ((range > 0 && current >= end) || (range < 0 && current <= end))` 中，由於 `range` 恰好為 0，此兩個條件皆判定為 `false`，導致用於清除定時器的 `clearInterval(timer)` 永遠不會被執行，此定時器每 16 毫秒無限次數地重複將該 KPI 文字設定回初始的 1.33 億人與 67 萬班。
2. **定時器衝突 (Timer Race Condition)**：當使用者隨後進行航點篩選並送出更新時，雖然啟動了新的 `animateValue()` 試圖縮減數字，但因為先前的多重無效定時器依然在每 16ms 競態地將數值暴力改回 133,267,298，最終導致前兩個數值看起來完全沒有變動。

### 修正方案
1. **安全退回路徑 (Safety Exit)**：在 `animateValue()` 的開頭新增零變化安全閘門判斷 `if (Math.abs(end - start) < 0.01)`。若前後數值沒有變化，則直接在 DOM 寫入目標值並 return，不再開啟 `setInterval` 定時器，從根本上避免了 0 差值無限循環的漏洞。
2. **定時器衝突防禦 (Race Mitigation)**：實作定時器追蹤機制。將每個 DOM 元素的活動 timer ID 利用 `dataset.timerId` 儲存在 DOM 物件本身。每次呼叫 `animateValue()` 時，第一時間會先檢查並徹底清除上一次仍活躍的定時器（`clearInterval(parseInt(obj.dataset.timerId))`），保障在使用者高頻率或重複更新篩選時，永遠只有一個活躍的計時器在更新 DOM，實現 100% 的防禦性互動安全。

### 驗證結果
- ✅ **數值同步更新**：當篩選為特定航線時，總載客數與總航班數能隨著點選更新順暢縮小至該航點的實際值， countUp 動畫表現優雅。
- ✅ **衝突消除**：多次重複切換不同航點並快速點擊更新，卡片數值皆能準確指向最新狀態，未再出現卡死或數值錯亂現象。

## [2026-06-09] 台灣航班數據儀表板全面升級：預渲染 SEO/AIEO、數據智慧洞察與 UI/UX 體驗優化

### 問題現狀
1. **SEO/AIEO 缺失**：網站全站採用 Client-Side Rendering (CSR) 動態載入，AI 爬蟲與搜尋引擎抓取時僅能看到「載入中...」預留文字，無法讀取航班載客率、座位等實質數據，極不利於 AIEO/GEO。
2. **缺乏快速洞察**：使用者進入頁面後，必須手動進行繁瑣的交叉篩選，網站缺乏主動揭露關鍵指標（總旅客人數、總起降班次、平均載客率、最旺月份）與智慧洞察（自然語言分析）的能力。
3. **UI/UX 摩擦力高**：表格過長且不支援分頁與欄位排序，閱讀體驗欠佳；此外，篩選條件變更時「更新數據」按鈕提示不足，使用者容易忽略，誤以為數據未切換。圖表色碼在 Light Theme 顯得過於深重。
4. **缺少交叉導覽**：缺少各機場頁面之間的內部連結，不利於搜尋引擎爬行與使用者探索。

### 根本原因 (Root Cause)
1. 原始架構僅由單一靜態 HTML + 客戶端 JS 渲染組成，沒有進行預渲染 (SSG)。
2. 原系統並無統計 KPI 與自動分析最大值、佔比、YoY 成長等分析邏輯。
3. 表格僅為靜態 Render，未引入分頁機制與客戶端排序監聽。圖表 X 軸網格色與 ticks 色硬編碼為 Dark Theme 色彩（`#334155`、`#94a3b8`）。
4. 網頁間缺少麵包屑導航與交叉連結（首頁與 6 個子頁面完全隔離）。

### 修正方案
1. **建立 SSG 預渲染系統 (`prerender.js`)**：
   - 預先加載航班數據（改以 Node.js `require` 避免 regex 語意解析 SyntaxError 漏洞）。
   - 將計算好的 KPI、文字智慧洞察、完整表格及 Schema.org (JSON-LD) 結構化標籤靜態寫入首頁 `index.html`。
   - 為 TPE、KHH、TSA、RMQ、TNN、HUN 這 6 個主要起降機場分別建立獨立的 `airport/{code}/index.html` 子網頁。
   - 自動產生 `sitemap.xml` 與 `robots.txt`，並導出 `data/flight_data.json`、`data/flight_data.csv` 開放資料集。
2. **新增數據智慧洞察組件 (`js/insights.js` 與樣式)**：
   - 計算四項核心 KPI，並在瀏覽器端加入 countUp 漸進動畫。
   - 動態計算並呈現前十大熱門航點的 HTML 條狀圖排行榜。
   - 繪製座位利用率年度月份熱力圖 (Heatmap)，以 HSL 暖橘色階呈現旺淡季。
   - 產生自然語言洞察列表（自動分析市場佔比、最佳航空公司、巔峰期、YoY 變化率等）。
3. **重構圖表與表格互動 (`js/charts.js` 與 `js/table.js`)**：
   - 修正圖表格線 ticks 為 CSS 變數，配合 Earthy Terracotta 暖色調，並加上流暢動畫。
   - 新增航空公司市佔率圓餅圖 (Doughnut Chart)，可切換按旅客人次或航班數計算。
   - 表格引入分頁控制（預設每頁 20 筆），並加入表頭點選可進行年月、航空公司、航班數等欄位升降排序。
   - 客戶端引入水合 (Hydration) 檢查：若偵測到預渲染表格，首次載入時跳過表格 DOM 重建，防止閃爍。
   - 下拉選單變更時為「更新數據」按鈕加入 `.btn-pulse` 呼吸燈提示動畫，點選後移除。
4. **內部連結優化**：
   - 機場子頁面新增 Breadcrumb (麵包屑) 導覽，並在底部加入各機場的交叉連結與民航局數據來源聲明。

### 驗證結果
- ✅ **建置指令成功**：執行 `npm run build` 無錯誤，精確生成 7 個 HTML 頁面及 SEO 附屬檔案。
- ✅ **預渲染內容完整**：經 `curl` 與 `grep` 驗證，生成的 HTML 中確實靜態包含了對應的 JSON-LD、麵包屑、KPI 數值、智慧分析文字與完整表格。
- ✅ **互動與體驗提升**：在瀏覽器中「更新數據」按鈕於修改條件時會呈現發光呼吸效果，點擊後 KPI 與圖表動畫順暢繪製，航空公司市佔率圓餅圖切換自如。
- ✅ **表格分頁排序流暢**：每頁 20 筆分頁清晰，點選「載客率」或「航班數」表頭，資料可流暢進行升降冪排序，且排序狀態在切換分頁時保持一致。
- ✅ **RWD 適配度佳**：在行動裝置下 KPI 自動折疊為單欄，熱力圖容器支持水平滾動，避免破版。

## [2026-06-08] UI與邏輯調整：移除 KPI 卡片、修正年份遮擋並補齊中東、非洲航點與防禦性渲染

### 問題現狀
1. 儀表板最上方的三個 KPI 摘要卡片（航空公司數、航點數、平均載客率）目前不符合展示需求，需予移除。
2. 數據篩選區塊中，統計期間的「年份」選擇器字元遭到遮擋（原僅顯示為 "202"，無法完整顯示四位數年份，如 "2024"）。
3. 目的地航點下拉選單中完全沒有「中東」國家的航點（例如：杜拜），導致使用者無法篩選並分析中東航線的載客率。
4. 資料庫 `DESTINATION_MAP` 中其實有定義 `"非洲"` 區域的航點（如開羅、約翰尼斯堡），但前端選單也漏列了。此外，若未來資料庫新增了其他新區域，前端若維持寫死陣列的寫法，將存在資料被默默吞掉的系統風險。

### 根本原因 (Root Cause)
1. 該三格 KPI 卡片為靜態資料展示，應使用者需求予以拿掉。
2. 在 CSS 中，全域 `.filter-select` 的定義順序在 `.date-select` 之後，導致 `.date-select` 的透明無邊框樣式遭到覆蓋。繼承了 `.filter-select` 的大 padding 與背景下拉箭頭後，在 Flexbox 容器內被壓縮，進而遮擋了年份的文字。
3. 原始資料 `flight_data_new.js` 的 `DESTINATION_MAP` 中確實有「杜拜 (中東)」的資料，然而前端 `js/app.js` 下拉選單進行分區渲染的排序陣列 `regionOrder` 漏寫了 `"中東"` 欄位，導致中東的航點分組直接在前端渲染流程被跳過。
4. 相同的漏洞也發生在 `"非洲"` 區域。且因缺乏動態捕獲未知區域的 fallback 機制，任何不符合 `regionOrder` 內容的區域都會被靜態迴圈過濾掉。

### 修正方案
1. 於 `index.html` 刪除 `div.kpi-row` 及其內部的三個 `kpi-card` 結構。
2. 在 `styles.css` 中將日期選擇器的 CSS 選擇器提升為 `.filter-select.date-select` 以提高權重，強制還原為透明無邊框，並移除背景圖及修正右側 padding。
3. 針對 `#start-year` 與 `#end-year` 設定明確的 `min-width: 4.5rem`（約 72px），確保四位數年份有足夠寬度顯示。
4. 在 `js/app.js` 的 `regionOrder` 陣列中補上 `"中東"` 與 `"非洲"`。
5. 於 `js/app.js` 的下拉選單渲染邏輯中，導入**「未分配區域動態偵測防禦性機制」**：自動分析資料庫中所有存在的地區，若有任何未被 `regionOrder` 覆蓋的漏網之魚，將動態捕獲並自動安插在「其他」之前，保障日後資料擴增時的 100% 完整性。

### 驗證結果
- ✅ 最上方的三個 KPI 資訊卡片已成功移除。
- ✅ 年份選擇器已恢復透明無邊框排版，並且寬度充足，可完整顯示 "2024"、"2025" 等年份，不再受遮擋。
- ✅ 目的地選單成功顯示「=== 中東 ===」群組，並包含「阿聯酋 - 杜拜」，點選後折線圖及長條圖能即時更新並繪製杜拜（阿聯酋航空等）的月度載客率與座位數趨勢。
- ✅ 經 Node.js 指令對 `DESTINATION_MAP` 分析，目前資料庫所有獨特地區為 `['東北亞', '港澳大陸', '東南亞', '美洲', '歐洲', '中東', '大洋洲', '非洲']`，在本次修正補齊「非洲」並新增防禦性機制後，已 100% 涵蓋且未來可安全擴充。

## [2026-06-08] 環境優化：新增捷徑指令查詢 Antigravity 配額 (Quota)

### 問題現狀
使用者反映在 Antigravity 2.0 中查看剩餘配額 (Quota) 需要點選多次設定或輸入較長指令，視覺不直觀且操作繁瑣。

### 根本原因 (Root Cause)
Antigravity 預設的配額查詢路徑較深，且 `antigravity-usage` 社群套件指令較長，缺乏便捷的本機捷徑（alias）。

### 修正方案
1. 在專案的 `package.json` 中新增 `"quota": "npx antigravity-usage"` 腳本，提供快捷的 NPM 入口。
2. 引導使用者在 Zsh 設定檔 (`~/.zshrc`) 中設定 `q` 或 `quota` 別名 (alias)，實現極簡化查詢。

### 驗證結果
- ✅ 在終端機執行 `npm run quota` 可直接輸出清晰的美化配額表格。
- ✅ 指引使用者使用 `q` 別名加速日常開發檢測。

## [2026-06-08] 資料更新：補充 2026年2月~4月（115年2~4月）

### 問題現狀
網站資料最新僅到 2026年1月（民國115年1月），官方民航局網站已有更新到115年4月的資料。

### 根本原因 (Root Cause)
`extracted/` 目錄中缺少民國115年2月、3月、4月的原始 XLS 檔案，導致 `data/flight_data_new.js` 資料集不完整。

### 修正方案
1. 從民航局官網（https://www.caa.gov.tw/article.aspx?a=1752&lang=1）直接下載缺少月份的 XLS 檔案：
   - 115年2月（檔案ID: 40309，更新日: 2026/03/25）
   - 115年3月（檔案ID: 40505，更新日: 2026/04/27）
   - 115年4月（檔案ID: 40669，更新日: 2026/05/25）
2. 執行 `node process_data.js` 重新產生 `data/flight_data_new.js`

### 驗證結果
- ✅ 資料範圍：`2022-01` → `2026-04`（共 52 個月）
- ✅ 涵蓋機場：桃園國際機場、高雄國際機場、臺北松山機場、臺中清泉崗機場、臺南機場、花蓮機場（共 6 座）
- ✅ `flight_data_new.js` 檔案大小：3.4MB
