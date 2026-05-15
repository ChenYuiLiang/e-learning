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
