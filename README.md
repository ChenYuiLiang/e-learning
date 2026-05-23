# Vibe Coding - 網路教學平台 (E-Learning System)

本專案是一個基於 Firebase 的現代化程式教學平台，結合了互動式課程、作業自動化、綠界金流 (ECPay)、硬體出貨管理以及多層級分潤架構。

---

## ✨ 平台特色 (Platform Highlights)

### 1. GitHub Classroom 深度整合
每個學習單元可設定專屬 Classroom 邀請連結。系統支援「事後綁定」：學生在作業頁輸入 Tutor Promotion code 後，才會綁定導師與單元作業連結。  
學生每次點擊作業都會先出現導師綁定對話框；Promotion code 可留白（會使用系統預設導師），若有輸入則必須是該單元合格導師的 code 才能通過。

### 2. 智慧型多層級分潤 (Recursive Sharing)
推薦系統支援遞迴式計算：
- **直接分潤**: 推薦老師獲得 20%。
- **上級獎勵**: 上級導師可獲得下級分潤額的 20%。
- **上級鏈條來源**: 目前由 `users.tutorEmail` 作為上線導師 Email 欄位；若未設定，鏈條將回退至平台帳號。

### 3. 硬體出貨工作流 (Hardware Logistics)
整合綠界 CVS 電子地圖，管理員可從後台標記出貨，並自動寄送出貨提醒。

### 4. 全自動 Email 通知系統
涵蓋付款、導師指派、作業提交、GitHub 自動評分結果更新（學生與導師）、自動評分異常告警（Admin）、出貨完成通知、師資申請審核與管理員待辦提醒（含被推薦候選通知）。

---

## 📖 相關文件 (Documentation)
- **[📈 估值模型 (Valuation Model)](docs/investor/valuation-model.md)**：市場大小、三年情境、公司估值與系統估值框架（含可調參數 CSV）。
- **[🧭 融資計劃 (Funding Roadmap)](docs/investor/funding-roadmap.md)**：F/Angel 到 Seed/Pre-A 再到 A round 的里程碑與 KPI 規劃。
- **[⚖️ 開發與營運規範 (Project Rules)](AGENT.md)**：包含零元帳單規範、權限模型、ID 歸一化準則與開發 SOP。
- **[🗄️ Firestore 結構文件](docs/database.md)**：集合、欄位與遷移備註（以實作為準）。
- **[✉️ Email 通知規格](docs/email-notifications.md)**：通知觸發條件、收件者、深連結與異常告警規範。
- **[📘 學生操作指南](public/students.html)**：包含付款、導師指派、作業提交及師資申請流程。
- **[🧑‍🏫 導師操作指南](public/tutors.html)**：導師端日常操作與協作流程說明。
- **[課前準備事項 (Preparation)](public/prepare.html)**：軟硬體環境準備與教材購買指引。
- **[🚚 物流管理 MVP](docs/logistics-mvp.md)**：硬體訂單出貨流程與 Admin Logistics 分頁規格。
- **[✅ 合格教師管理 MVP](docs/tutor-management-mvp.md)**：申請、推薦、審核與授權流程。
- **[💸 多層級分潤規格](docs/recursive-sharing.md)**：分潤公式、上線鏈條、冪等與對帳流程。
- **[🤝 導師與學生的互動層 MVP](docs/tutor-student-interaction-mvp.md)**：自動評分之外的教學互動設計（卡點、提示階梯、成長軌跡、介入任務）。
- **[🧩 單元 Repo 協作改善流程](docs/unit-repo-collaboration-workflow.md)**：學生、導師、管理員共同迭代 README、tutor-guide 與測試/流程設定的提案與審核流程。
- **[🤖 Autograde 全自動化](docs/autograde-full-automation.md)**：批次設定 `userId+unitId` 對應、workflow 觸發策略與分數回寫模式。
- **[🔄 Classroom 學生 Repo 同步 PR 流程](docs/classroom-sync-pr-workflow.md)**：template 更新後，批次對學生作業 repo 開同步 PR（含 dry-run 與衝突處理）。
- **[🧱 Classroom 中間層同步流程](docs/classroom-bridge-sync-workflow.md)**：批次將 `vibe-coding-classroom-*` 中間層 repo 從 canonical template repo 同步更新。
- **[🛡️ Classroom 安全檢查](docs/classroom-safety-preflight.md)**：發佈前檢查 starter repo 是否含解答/教師專用檔案，避免外洩。

### 📦 Archive / 歷史遷移文件
- **[🧭 Dashboard Legacy 遷移計畫](docs/dashboard-legacy-migration-plan.md)**：舊欄位相容、ID 歸一化與遷移策略（歷史遷移紀錄）。
- **[🧹 Firestore Legacy ID 遷移](docs/legacy-id-migration.md)**：舊課程/單元 ID 批次轉換為新 canonical ID（歷史遷移紀錄）。

---

## 🏗️ 系統架構 (System Architecture)

### 前端 (Frontend)
- **技術棧**: 原生 HTML5 / CSS3 (Vanilla CSS) / JavaScript (ES6+), TailwindCSS (部分組件)。
- **核心模組**:
  - `nav-component.js`: 跨頁面統一導覽、純 CSS Hover 注入與身份驗證狀態管理。
  - `footer-component.js`: 全站底欄渲染與相對路徑解析中心。
  - `course-shared.js`: 單元內容渲染、進度追蹤、GitHub Classroom 整合與作業提交邏輯。
- **數據通訊**: 透過 Firebase JS SDK 與 Firestore 及 Cloud Functions 交互。

### 後端 (Backend - Firebase)
- **Cloud Functions (Node.js 22)**:
  - **API 服務**: 
    - `initiatePayment` / `paymentNotify`: 綠界金流整合與付款回寫（實體商品需通過物流資料驗證；缺漏會標記 `logisticsMissing`）。
    - `getLogisticsMapParams` / `mapReply`: 綠界物流電子地圖整合。
    - `verifyReferralLink` / `verifyPromoCode`: 推薦連結與折扣碼驗證。
    - `resolveAssignmentAccess`: 判定使用者是否有權存取特定單元的作業指引。
    - `submitAssignment`: 作業紀錄建立與正式提交。
    - `ingestGithubAutograde`: GitHub Classroom 自動評分結果回寫。
    - `getDashboardData`: 提供儀表板統計與作業 Feed 數據。
    - `serveCourse`: 安全分發私有單元內容。
    - `logActivity`: 毫秒級學習行為追蹤 API。
  - **權限與導師管理**:
    - `setUserRole`: 管理員設置使用者全域角色。
    - `authorizeTutorForCourse` / `getTutorConfigs` / `saveTutorConfigs`: 導師單元授權與設定管理。
    - `applyForTutorRole` / `decideTutorApplication`: 導師申請與審核工作流。
    - `recommendTutorForUnit` / `submitTutorRecommendationInviteLink`: 導師主動推薦流程與連結綁定。
    - `bindTutorByPromotionCode` / `bindTutorToUnit` / `assignStudentToTutor`: 學生與導師的單元級綁定。
    - `precheckGithubClassroomAccess`: 檢查學生是否已完成組織授權防呆機制。
    - `checkPaymentAuthorization`: 確認單元存取權限並核發安全 Token。
  - **系統輔助工具 (Utilities)**:
    - `findClassroomInviteBinding` / `findClassroomInviteBindingHttp`: 管理員查詢綁定狀態用。
  - **出貨處理**:
    - `markOrderShipped`: 管理員手動標記已出貨。
  - **定時任務 (Scheduled Functions)**:
    - `calculateMonthlySharing`: 每月 1 號結算分潤。
    - `remindAdminPendingAssignments`: 每日提醒「學生本人」尚未完成導師綁定的付費單元。
    - `remindAdminPendingShipments`: 每日提醒待出貨硬體訂單。
    - `checkTrialExpiration` / `checkCourseExpiration`: 權限到期自動檢核與提醒。

### 數據庫結構 (Firestore)
- **`users`**: 核心使用者文件，角色僅 `admin` 與 `user`。
  - `unitAssignments`: 學生各單元對應導師 Email。
  - `tutorConfigs`: 單元授權狀態 (Status)，非全域角色。比對時強制執行 **ID 歸一化** (移除 `.html`)。
  - `tutorMode`: 管理員專用開關，開啟時模擬導師視角，關閉時模擬學員視角（遵循 `AGENT.md` 規範）。
- **`orders`**: 訂單紀錄。
  - `items[itemId]` 為購買項目本身（導師綁定不在購物車階段處理）。
  - `fulfillmentStatus` / `logistics`（硬體出貨狀態與物流資訊）。
  - `logisticsMissing`（實體商品付款後物流資料不完整時的警示旗標）。
- **`activity_logs`**: 學習行為追蹤（主要欄位：`courseId`, `action`, `duration`, `metadata`, `timestamp`）。
- **`tutor_applications`**: 導師申請審核資料（由推薦/申請流程建立）。
- **`referral_links`**: GitHub Classroom 推薦/綁定連結索引（導師身份驗證與關聯回填）。
- **`metadata_settings`**: 全域設定（目前包含 `tutor_terms`）。
- **`profit_ledger`**: 分潤計算明細。

> 課程授權判斷（含免費課程）以 Firestore `metadata_lessons` 為單一真實來源；
> 課程單元鍵值異動請先更新 `metadata_lessons.courseUnits`，再部署程式碼。
>
> **Firestore First 原則（強制）**：
> - 所有「資料比對 / 權限判斷 / 邏輯驗證 / 寫入儲存」一律以 Firestore 為準。
> - 禁止在前端或後端維護硬編碼白名單、相容名單、舊 ID 對照表作為執行期判斷依據。
> - 若資料不一致，先修 Firestore 資料與遷移腳本，不新增 fallback 白名單邏輯。

---

## 🚀 開發與部署 (DevOps)

### 腳本工具與自動化
- 新流程請以 `scripts/sync_classroom_repos.sh`、`scripts/sync_classroom_bridge_repos.sh` 與 `docs/` 現行規格為準。

### 環境變數 (`functions/.env`)
- 金流：
  - `ECPAY_MERCHANT_ID`
  - `ECPAY_HASH_KEY`
  - `ECPAY_HASH_IV`
  - `ECPAY_API_URL`
  - `ECPAY_LOGISTICS_MAP_URL`
- 郵件：
  - `MAIL_USER`
  - `MAIL_PASS`
- 站點與通知：
  - `APP_BASE_URL`（email 連結基底，預設 `https://vibe-coding.tw`）
  - `ADMIN_EMAIL`（管理員通知信收件人；未設定時 fallback 至 `MAIL_USER`）
- GitHub 自動評分：
  - `GITHUB_WEBHOOK_SECRET`（用於驗證 `ingestGithubAutograde` 的 `X-Hub-Signature-256`）
- 物流資料回補：
  - `ECPAY_LOGISTICS_QUERY_URL`（選填；預設 `https://logistics.ecpay.com.tw/Helper/QueryLogisticsTradeInfo/V5`）

### GitHub Classroom 自動評分回寫 (MVP)
- Webhook/API 入口：`ingestGithubAutograde`（HTTP POST）
- 功能：將 GitHub Actions / Classroom 評分結果寫回 `assignments` 文件的 `autoGrade` 欄位。
- 運作機制：直接在 GitHub Classroom 作業設定中配置 Webhook，指向 `ingestGithubAutograde` 端點。
- Workflow 定義與觸發條件由各 Classroom / bridge repo 維護，這個 repo 只負責後端回寫與同步腳本，不包含該 workflow 檔案。
- 觸發策略（省額度）：
  - 預設建議手動 `workflow_dispatch`
  - 若要 push 觸發，需滿足其一：
    - Repo variable `VC_AUTOGRADE_ON_PUSH=true`
    - commit message 含 `[autograde]`
- 文件定位方式：`userId + unitId`（單元層級綁定，自動定位同單元最新作業）
- MVP 安全策略：只寫入 `autoGrade*` 欄位，不覆蓋人工 `grade`。

### GitHub Classroom 學生 Repo 同步（建議）
- 工具腳本：`scripts/sync_classroom_repos.sh`
- 目的：template repo 更新後，批次建立學生 repo 同步 PR。
- 操作文件：`docs/classroom-sync-pr-workflow.md`
- 先 dry-run，再 `--apply` 正式開 PR。

範例 payload：
```json
{
  "userId": "uid_xxx",
  "unitId": "01-unit-developer-identity.html",
  "score": 92,
  "maxScore": 100,
  "status": "completed",
  "runUrl": "https://github.com/org/repo/actions/runs/123",
  "workflow": "autograde",
  "commitSha": "abc123"
}
```

範例 GitHub Actions（呼叫 Cloud Function）：
```yaml
- name: Send auto grade to Vibe Coding
  env:
    VC_AUTOGRADE_URL: ${{ secrets.VC_AUTOGRADE_URL }}
    VC_AUTOGRADE_TOKEN: ${{ secrets.VC_AUTOGRADE_TOKEN }}
  run: |
    payload='{"userId":"'"$VC_USER_ID"'","unitId":"'"$VC_UNIT_ID"'","score":92,"maxScore":100,"status":"completed","runUrl":"'"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"'","workflow":"'"$GITHUB_WORKFLOW"'","commitSha":"'"$GITHUB_SHA"'"}'
    sig="sha256=$(printf %s "$payload" | openssl dgst -sha256 -hmac "$VC_AUTOGRADE_TOKEN" | sed 's/^.* //')"
    curl -sS -X POST "$VC_AUTOGRADE_URL" \
      -H "Content-Type: application/json" \
      -H "X-Hub-Signature-256: $sig" \
      -d "$payload"
```

### 部署命令
```bash
# 全域部署
firebase deploy --project e-learning-942f7

# 僅部署後端函式
firebase deploy --only functions --project e-learning-942f7

# 僅部署前端
firebase deploy --only hosting --project e-learning-942f7
```

### CI/CD 自動化流程 (GitHub Actions)
1. **PR 預覽部署 (`firebase-hosting-pull-request.yml`)**
   - 觸發時機：發起 Pull Request 時。
   - 用途：部署到 Preview Channel，提供審核網址。
2. **正式上線部署 (`firebase-hosting-merge.yml`)**
   - 觸發時機：合併至 `main` 時。
   - 用途：部署 Hosting 與 Functions 至生產環境。

> 注意：本 repo 的 GitHub Actions 只涵蓋 Firebase 部署，Classroom / bridge repo 內的 autograde workflow 定義由外部 repo 維護，並不在此 repository 中。

---

## ✅ 文件同步檢查清單 (Release Checklist)
每次改動下列項目時，請同步更新 README / docs：
1. 新增、改名或刪除 Cloud Functions。
2. 調整 Firestore 結構（尤其 `orders.items.*`、`users.unitAssignments`、`users.tutorConfigs`）。
3. 新增或改名 `.env` 參數。
4. 更動角色規則（`admin|user`）或授權機制（Tutor 資格）。

---
Vibe Coding &copy; 2026 | [info@vibe-coding.tw](mailto:info@vibe-coding.tw)
