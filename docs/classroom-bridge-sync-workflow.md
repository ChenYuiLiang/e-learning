# Classroom 中間層 Repo 同步流程

## 目的
將中間層 Classroom repo（例如 `vibe-coding-classroom-...`）從 canonical template repo 同步更新，避免學生後續接受作業時仍拿到舊內容。

目前建議來源/發佈分工：
- `template_repo`: `vibe-coding-template/*`（source）
- `bridge_repo`: `vibe-coding-classroom/vibe-coding-classroom-*`（publish）

## 工具
- `scripts/sync_classroom_bridge_repos.sh`
- 範例 CSV: `docs/examples/classroom-bridge-sync-sample.csv`

## CSV 欄位
- `bridge_repo`: 中間層 repo（`org/repo`）
- `template_repo`: 原始 template repo（`org/repo`）
- `base_branch`: 中間層目標分支（預設 `main`）
- `template_branch`: template 來源分支（預設 `main`）

## 執行
```bash
# 先 dry-run
scripts/sync_classroom_bridge_repos.sh --csv docs/examples/classroom-bridge-sync-sample.csv

# 確認後正式執行
scripts/sync_classroom_bridge_repos.sh \
  --csv docs/examples/classroom-bridge-sync-sample.csv \
  --apply \
  --pr-label classroom-bridge-sync
```

## 狀態說明
- `opened`: 已建立同步 PR
- `noop`: 已是最新
- `conflict`: 需人工解衝突
- `error`: clone/push/pr 建立失敗

## 注意
1. 這只更新中間層 repo，不會自動更新既有學生 repo。
2. 既有學生 repo 請再跑 `scripts/sync_classroom_repos.sh` 回補。
3. 同步完成後，請用測試帳號重新接受 assignment 驗證 starter 內容。
4. 若 bridge 先有修正，請同步回 template 開 PR/issue；template 合併後再重跑 bridge sync，避免雙方長期漂移。

## 今日執行補充（2026-05-15）
1. 常見失敗：`non-fast-forward` push rejected
   - 原因：同名同步分支已存在且遠端較新。
   - 建議：改用新的分支名（例如加上 timestamp）重推，避免覆蓋既有 PR 討論脈絡。
2. 常見失敗：`refusing to merge unrelated histories`
   - 代表 bridge 與 template 無共同祖先，不能直接 merge 策略同步。
   - 建議改走 manual-sync（以檔案對齊建立獨立 PR）流程。
3. `classroom-bridge-sync` label 不存在時
   - PR 可先建立，不阻塞同步；後續再於 repo 建立 label 即可。

## 單元任務更新後的同步檢查清單（2026-05-21）

當某個課程單元（例如 `03-unit-github-classroom`）更新了作業任務時，需一併同步以下項目：

### 1. Template Repo（`vibe-coding-template/<unit_id>`）
- [ ] 更新 `README.md`（學生任務說明）
- [ ] 更新 `tutor-guide.md`（導師指引）
- [ ] 更新 `tests/` 目錄與 `.github/workflows/classroom.yml` 的評分條件（若有）

### 2. Vibe Coding 後台（`vibe-coding-tw`）
- [ ] 更新 `functions/private_courses/<unit_id>.html` 的 `assignment-guide` 和 `tutor-guide` 隱藏區塊（使用 `scripts/enrich_guides.py --apply` 自動同步）
- [ ] 更新 `scripts/workflow-templates/<unit_id>.yml` 的評分邏輯（對應新提交檔案格式與分數分配）

### 3. Bridge Repo 同步
- 確認 bridge repo 是否在 `classroom-bridge-unrelated-r2.csv` 中（status=unrelated）
- 若是（例如 `03-unit-github-classroom`），**不能使用標準 merge 策略**，必須改走 **manual-sync（檔案對齊）流程**：
  1. 在本地建立一個對 bridge repo 的新 branch
  2. 手動複製 template 新版本的 `README.md`、`tutor-guide.md`、`tests/`、`.github/workflows/` 等檔案
  3. 開 PR 讓 Admin Review 後 merge
- 若是 `noop` 狀態，可直接跑標準同步腳本

### 4. Bootstrap 腳本
- 若 workflow 評分邏輯有改動（例如 `submission/` 目錄的提交檔案名稱改變），需重新 bootstrap 受影響的學生 repo：
  ```bash
  scripts/bootstrap_classroom_repo_autograde.sh --dry-run docs/examples/autograde-repo-mapping.apply-ready.csv
  scripts/bootstrap_classroom_repo_autograde.sh --apply docs/examples/autograde-repo-mapping.apply-ready.csv
  ```

> **注意**：`03-unit-github-classroom` 的 bridge repo 確認為 `unrelated` 狀態，任何 template 更新都必須走 manual-sync PR 流程，不可使用自動化腳本直推。
