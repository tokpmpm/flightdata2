---
name: seo-weekly-review
description: flightdata2 每週 SEO 閉環：技術稽核 → 讀 GSC／GA4 → 一次只做一項可回復修改 → 審查 → 記錄 → 回看上期實驗。使用者說「跑 SEO 週報」「seo weekly」「本週 SEO review」「回看 title 實驗」或排程觸發時使用。
---

# flightdata2 每週 SEO review

方法：seo-coach 閉環（https://github.com/akseolabs-seo/seo-coach）。改前記錄基準並確認索引 → 讀查詢／SERP／承接頁 → 一次只做一項低風險、可回復的修改 → 2–4 週後用同長度窗口比較 → 保留／回復／重測。每個判斷都要標證據來源；健康也是結果。

## 節奏
- **每週一次**（建議週一）。GSC 有 2–3 天延遲，日期以 GSC 顯示的區間為準。
- 每月 CAA 發布、正式站上線後的那一週，加看月報頁是否被索引。
- 每個實驗：上線後 **2 週初看**、**4 週結論**，都用 28 天 vs 前 28 天。

## 輸入
| 輸入 | 怎麼取得 |
|---|---|
| 正式站 | `node scripts/seo_audit_remote.js`（自動） |
| GSC | 內建瀏覽器（使用者已登入），見下方擷取方法 |
| GA4 | 內建瀏覽器，property 544120077 |
| 進行中實驗 | `seo/experiments.csv` |
| 上週紀錄 | `seo/reviews/` 最新一份 |

## 步驟

### 0. 準備
- 在 repo 根目錄、最新的 `origin/main` 上工作（另開分支，不在 main 上 commit）。
- 讀 `seo/experiments.csv`，找出 `status=running` 的實驗與其回看日。

### 1. 技術稽核 → agent `seo-tech-auditor`
`node scripts/seo_audit_remote.js --json seo/snapshots/<YYYY-MM-DD>/audit.json`
輸出：問題清單（新／已修好／持續）。

### 2. 取數據並分析 → 主對話取數，agent `seo-data-analyst` 分析
用內建瀏覽器（`mcp__Claude_Browser__*`）讀取，**不要下載檔案、不要建 Google Cloud 服務帳戶**。

**GSC**：開
`https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Ameshthings.com&page=*flightdata2.meshthings.com&num_of_days=28&metrics=CLICKS%2CIMPRESSIONS%2CCTR%2CPOSITION`
（週報再開一次 `num_of_days=7`）。用 `javascript_tool` 把每頁顯示列數改成 500 並讀表格：

```js
const lb=document.querySelector('[aria-label="Number of rows per page"]'); lb&&lb.click();
await new Promise(r=>setTimeout(r,800));
[...document.querySelectorAll('[role="option"]')].find(o=>o.textContent.trim()==='500')?.click();
await new Promise(r=>setTimeout(r,2500));
[...document.querySelectorAll('table')].map(t=>[...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>c.innerText.trim().replace(/\s+/g,' ')).join('\t')).join('\n')).join('\n=====\n')
```
再點 `PAGES` 分頁（`[role="tab"]` 文字為 PAGES）讀網頁表。頁面頂端的 Total clicks／impressions／CTR／position 也要記，日期區間從圖表說明讀。
要比較前一期：在 GSC 日期選單選「比較」，或改 `num_of_days` 後分別讀。

**GA4**：
- 流量來源：`https://analytics.google.com/analytics/web/#/p544120077/reports/explorer?params=_u..nav%3Dmaui&r=lifecycle-traffic-acquisition-v2`
- 網頁：`…&r=all-pages-and-screens`
等 6–7 秒載入後用 `javascript_tool` 讀 `table` 的 `innerText`；日期區間在頁面上方。

把原始表格存成 `seo/snapshots/<YYYY-MM-DD>/{gsc-queries-28d,gsc-pages-28d,gsc-queries-7d,ga4-channels,ga4-pages}.tsv`。**snapshots 已 gitignore**（repo 是公開的，原始查詢數據不提交），紀錄裡只放摘要與實驗目標頁的數字。

若使用者未登入或頁面要求登入：停下，請使用者在瀏覽器窗格登入，紀錄標「GSC／GA4 待提供」，其他步驟照跑。

### 3. 回看進行中實驗
對每個 `running` 實驗：到期（≥ 2 週）就用同長度窗口比較目標頁與目標查詢，寫入紀錄；到 4 週給結論：
- **保留**：目標指標改善且曝光 ≥ 100、排名沒掉
- **回復**：目標指標變差，或排名明顯下降
- **重測**：樣本太小或同期有干擾（CAA 發布、季節、改版）
更新 `experiments.csv` 的 `result`、`status`。

### 4. 選本週唯一修改 → agent `seo-content-strategist`
- 有 `running` 且未到 4 週結論的實驗 → **本週不改**。
- 否則提出一項：目標頁、原值、新值、依據、預期指標、回復方法。
- 改前基準（目標頁 28 天點擊／曝光／CTR／排名、主要查詢）寫進紀錄與 `experiments.csv`（`status=proposed`）。

### 5. 審查 → agent `seo-reviewer`
退回就修紀錄再審，直到通過。

### 6. 記錄與交付
- 寫 `seo/reviews/<YYYY>-W<週>.md`（範本見 `seo/README.md`）。
- 修改本身（例如改 `prerender.js` 的單頁 title）**要使用者同意**才實作，另開分支與 PR；合併與正式站發布照既有流程（不會自動部署，見 repo 的 release 流程）。
- PR 合併並發布後，把 `experiments.csv` 該列改成 `running`，填 `start_date`、`review_2w`、`review_4w`。
- commit 紀錄並開 PR；不合併、不部署、不 push main。

## 輸出
- `seo/reviews/<YYYY>-W<週>.md`
- `seo/experiments.csv` 更新
- 給使用者的 5 行摘要：本週數字、技術問題、實驗回看、本週提案（或不改）、需要使用者決定的事

## 限制
- 不讀、不輸出 `.env` 或 secrets；不下載 GSC／GA4 匯出檔。
- 不改 CAA 抓取與統計邏輯。
- 寄信、改 Vercel 設定、建排程等對外動作先問使用者。
