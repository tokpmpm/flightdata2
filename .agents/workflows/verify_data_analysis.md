---
description: 資料分析自動驗證 (Data Analysis Verification Protocol)
---

# 資料分析自動驗證流程 (Data Analysis Verification Protocol)

## 目的
在每次更新原始資料 (例如 `flight_data_new.js` 等載客數據) 後，**必須**透過此 Workflow 執行自動化檢查，確保後續衍生出之分析報告、JSON 等不會有計算邏輯遺漏或資料掉階的問題。
此規則體現了 **Rule #4: Verify with Tests** 的精神。

## 時機點
只要原始數據 `data/` 內的檔案發生更動，或是修正了資料拋轉腳本 (`process_data.js`, `export_verified_data.js`)，就必須執行本流程。

## 執行步驟

1. **確認驗證腳本存在與否**
   如果專案尚未有對應此份分析報告的驗證腳本，需先撰寫一獨立不依賴業務邏輯的驗證工具 (例如 `verify_report.js` 或是對應的 Jest 檔案)。
   腳本必須具備：
   - 全域統計 (Global Total) 的查核
   - 隨機或指定項目抽樣（例如特定航空公司、特定航線總人次）
   
2. **自動執行驗證與檢查**
// turbo
   執行專案預設的驗證腳本：
   ```bash
   node verify_report.js
   ```

3. **審閱驗證輸出**
   - 若為 `✅ 驗證成功`，則可繼續進行產生 Final Report 或 Push Code。
   - 若出現 `❌ 驗證失敗` 或是發生 `Exception`，則**停止**所有的修改與產報表進度，退回 Review 原始資料抓取與轉換邏輯 (可能的原因如：來源格式變動、新航點、新航空公司處理邏輯未補上等)。

## Tech Lead 的叮嚀 (Rule #2 & Rule #4)
> 驗證用的統計腳本必須「從最原始的資料結構直接加總」，不可以重複使用產出報表的函式庫，以避免「因為分析報表邏輯寫錯，導致驗證腳本也跟著錯」的盲點！
