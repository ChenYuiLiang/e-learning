# Autograde Full Automation

## Goal
Make GitHub Classroom grading write back to Vibe Coding automatically with no manual input for score submission.

## Current architecture (Webhook Based)
- 自動評分系統已全面轉移至 GitHub Classroom 內建的 Autograding Webhook 機制。
- Workflow 定義與觸發條件由各 Classroom / bridge repo 維護，這個 root repo 不包含 `autograde-and-sync.yml`。
- GitHub Classroom Autograding 會在學生 Push 程式碼時自動觸發測試。
- 評分完成後，Classroom 會發送 Webhook (HTTP POST) 到平台的 `ingestGithubAutograde` 雲端函式。
- Backend:
  - `ingestGithubAutograde` 接收 webhook 後，會解析 payload 並將分數回寫至 `assignments` 集合的 `autoGrade` 欄位。
  - `submitAssignment` 在學生第一次開始作業時即建立 `assignments/{docId}`，規則為：`docId = userId_assignmentId`。
  - **Admin TutorMode 特例**：Admin 在 TutorMode 測試作業入口時，前端不會自動送出 `status=started`，避免誤觸學生付款授權檢查與產生測試噪音紀錄。
  - `ingestGithubAutograde` 採 `unitId-first` 對應：使用 `userId + unitId` 自動定位該單元最新作業。
  - 系統會透過 Webhook 內的 repository 等資訊自動解析並比對學生的作業記錄。若配對失敗或存在多筆相同的作業記錄，會回傳錯誤並發送管理員通知信。

## Step 1: Configure Autograding in GitHub Classroom
1. 進入 GitHub Classroom，選擇您的 Assignment。
2. 進入 Assignment 的編輯頁面 (Edit Assignment)。
3. 在 Autograding 區塊，設定好您的自動測試規則 (Tests)。

## Step 2: Configure the Webhook
1. 在同一頁面或 Classroom 的設定中，找到 Webhook 設定。
2. 設定 Payload URL 為您的 `ingestGithubAutograde` 端點 (例如: `https://asia-east1-e-learning-942f7.cloudfunctions.net/ingestGithubAutograde`)。
3. Content type 設定為 `application/json`。
4. 在 Secret 欄位填寫與 Firebase `.env` 中 `GITHUB_WEBHOOK_SECRET` 相同的值。
5. 儲存設定。

## Validation checklist
1. 學生在 Classroom repo 推送 (push) 程式碼。
2. 進入該 repo 的 Actions 頁籤確認 Autograding 成功執行。
3. 進入 Vibe Coding 的 Dashboard 或是 Firebase Firestore `assignments` 集合，確認以下欄位已更新：
   - `autoGrade.score`
   - `autoGrade.maxScore`
   - `autoGradeUpdatedAt`
   - `autoGradeSource`
4. 到該學生作業 repo 的 Settings -> Secrets and variables -> Actions -> Variables，確認有：
   - `VC_USER_ID`
   - `VC_UNIT_ID`

## New Repo Bootstrap (Classroom student repos)
當 GitHub Classroom 產生新的學生 repo 時，Template 不會自動繼承 Secrets。建議使用批次腳本補齊設定：

1. 準備 mapping CSV（含 header）：
   - `repo,unit_id,user_id`
2. 先 dry-run：
   - `scripts/bootstrap_classroom_repo_autograde.sh --dry-run <csv_path>`
3. 正式套用：
   - `scripts/bootstrap_classroom_repo_autograde.sh --apply <csv_path>`

腳本行為：
- 會依 `unit_id` 套用對應模板：
  - `scripts/workflow-templates/<unit_id>.yml`
  - 找不到則 fallback `scripts/workflow-templates/default.yml`
- 套用位置：`repo/.github/workflows/autograde-and-sync.yml`
- 會寫入 Variables：
  - `VC_USER_ID`
  - `VC_UNIT_ID`
- Secrets 檢查：
  - 若 repo 已有 `VC_AUTOGRADE_URL` + `VC_AUTOGRADE_TOKEN`：通過
  - 若缺少且有提供環境變數 `VC_AUTOGRADE_URL_VALUE` / `VC_AUTOGRADE_TOKEN_VALUE`：自動寫入
  - 若缺少且未提供環境變數：報表標記 `missing_secrets`（需由 org-level shared secret 或手動補齊）

### Firestore source-of-truth scope (important)
- `unit_id`、課程結構、授權與作業紀錄來源皆以 Firestore 為準。
- `VC_USER_ID` + `VC_UNIT_ID` 可直接由課程/使用者關聯取得，不依賴單一 task doc。
- `missing_mapping` 不代表錯誤，代表目前缺少 `user_id` 或 `unit_id` 對應資料。
- 建議策略：
  1. 新 repo 先補齊 workflow + secrets。
  2. 等學生首次建立作業後，回寫邏輯會依 `userId + unitId` 自動定位最新作業。

## Low-cost automation strategy (recommended)
為避免浪費 GitHub Actions，建議採用「事件驅動 + 每日補漏」：

1. 事件驅動（主流程）
   - 建立 `repository_dispatch` 事件：`classroom_repo_created`
   - payload 至少帶：`repo`, `unit_id`
   - 可選帶：`user_id`
   - 收到事件後只處理「單一新 repo」，成本最低

2. 每日補漏（保險）
   - 排程 workflow 每日跑一次
   - 只處理 Firestore 匯出中「已具 mapping」的 repo（非全量硬跑）

對應 workflow：
- `.github/workflows/autograde-bootstrap-automation.yml`
- `.github/workflows/autograde-bridge-daily-audit.yml`（每日稽核 104 bridge repos 的 workflow/secrets/variables 一致性）
- 需要在此管理 repo 的 Secrets 設定：
  - `VC_AUTOGRADE_URL`
  - `VC_AUTOGRADE_TOKEN`

## Auto-generate token and distribute (secure flow)
若要避免手動建立 token，可使用腳本自動生成並分發到所有目標 repos：

1. 先 dry-run（不寫入）：
   - `scripts/generate_and_distribute_autograde_token.sh --dry-run docs/examples/autograde-repo-mapping.firestore.csv`

2. 正式執行（會生成新 token 並寫入每個 repo 的 `VC_AUTOGRADE_TOKEN`）：
   - `scripts/generate_and_distribute_autograde_token.sh --apply docs/examples/autograde-repo-mapping.firestore.csv`

3. 會輸出兩個檔案：
   - 報表（/tmp/*.csv）
   - token 檔（/tmp/*.txt，權限 600）

4. 將同一 token 同步設到系統後端驗簽來源（例如 Cloud Functions / Secret Manager）後，分數回寫才會通過驗簽。

## Troubleshooting
- 如果評分未觸發：
  - 檢查 GitHub Actions 是否因額度限制或設定錯誤未執行。
- 如果評分成功但 Vibe Coding 未更新：
  - 檢查 Webhook Secret 是否相符。
  - 檢查 Firebase Functions Log (`ingestGithubAutograde`) 是否有報錯。
  - 確認學生的 GitHub 帳號與 Vibe Coding 帳號的連結狀態，或 repository 命名是否正確。
