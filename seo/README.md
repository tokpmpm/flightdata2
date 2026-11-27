# flightdata2 SEO 週度閉環

流程定義：`.claude/skills/seo-weekly-review/SKILL.md`。角色：`.claude/agents/seo-*.md`。

| 檔案 | 用途 | 進 git |
|---|---|---|
| `seo/reviews/YYYY-Www.md` | 每週紀錄 | 是 |
| `seo/experiments.csv` | 實驗紀錄表（一次只有一個 running） | 是 |
| `seo/snapshots/YYYY-MM-DD/` | GSC／GA4 原始表格與稽核 JSON | 否（repo 公開） |
| `scripts/seo_audit_remote.js` | 正式站技術稽核 | 是 |

`seo/` 與 `.claude/` 不在 `scripts/build_dist.js` 白名單內，不會發布到正式站。

## 實驗狀態
`proposed` → 使用者同意並上線 → `running`（填 start_date、review_2w、review_4w）→ `kept`／`reverted`／`retest`

## 每週紀錄範本

```markdown
# SEO 週報 YYYY-Www（YYYY-MM-DD）

## 摘要
- GSC 28 天：點擊／曝光／CTR／排名（日期區間）；7 天：…
- GA4 28 天：工作階段、自然搜尋占比（日期區間）
- 技術稽核：FAIL n／WARN n
- 進行中實驗：…
- 本週修改：E00x 或「本週不改」

## 1. 技術稽核
## 2. 數據分析（低 CTR／黃金距離／低曝光／品牌詞／互相搶排名／意圖不符）
## 3. 實驗回看
## 4. 本週唯一修改（改前基準、原值、新值、回復方法、回看日）
## 5. 審查結果
## 6. 需要使用者決定
```
