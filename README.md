# Vibe Coding - 學習管理系統 (E-Learning System)

本專案是一個基於 Firebase 的現代化程式教學平台，結合了互動式課程、作業自動化、綠界金流 (ECPay)、硬體出貨管理以及多層級分潤架構。

---

## 📖 相關文件 (Documentation)
- **[📘 學生與導師指南](public/students.html)**：包含付款、導師指派、作業提交及師資申請流程。
- **[課前準備事項 (Preparation)](public/prepare.html)**：軟硬體環境準備與教材購買指引。
- **[🤝 Tutor x Student 互動層 MVP 規格](docs/tutor-student-interaction-mvp.md)**：自動評分之外的教學互動設計（卡點、提示階梯、成長軌跡、介入任務）。

---

## 🏗️ 系統架構 (System Architecture)

### 前端 (Frontend)
- **技術棧**: 原生 HTML5 / CSS3 (Vanilla CSS) / JavaScript (ES6+), TailwindCSS (部分組件)。
- **核心模組**:
  - `nav-component.js`: 跨頁面統一導覽與身份驗證狀態管理。
  - `course-shared.js`: 單元內容渲染、進度追蹤、GitHub Classroom 整合與作業提交邏輯。
- **數據通訊**: 透過 Firebase JS SDK 與 Firestore 及 Cloud Functions 交互。

### 後端 (Backend - Firebase)
- **Cloud Functions (Node.js 22)**:
  - **API 服務**: `initiatePayment`, `paymentNotify`, `verifyReferralLink`, `resolveAssignmentAccess`, `submitAssignment`, `getDashboardData` 等。
  - **指派與綁定**:
    - `paymentNotify`: 付款成功後依訂單 item 進行導師指派。
    - `bindTutorToUnit`: 學生以 Classroom 連結事後自助綁定導師。
  - **出貨處理**:
    - `markOrderShipped`: 管理員手動標記已出貨。
  - **定時任務 (Scheduled Functions)**:
    - `calculateMonthlySharing`: 每月 1 號結算分潤。
    - `remindAdminPendingAssignments`: 每日提醒未完成導師指派的訂單。
    - `remindAdminPendingShipments`: 每日提醒待出貨硬體訂單。
    - `checkTrialExpiration`: 每日檢查試用期到期提醒。
    - `checkCourseExpiration`: 每日檢查課程權限到期提醒。

### 數據庫結構 (Firestore)
- **`users`**: 核心使用者文件，角色僅 `admin` 與 `user`。
  - `unitAssignments`: 學生各單元對應導師 Email。
  - `tutorConfigs`: Tutor 資格狀態（Tutor 是單元授權狀態，不是角色）。
- **`orders`**: 訂單紀錄。
  - `items[itemId]` 內含 `referralLink` / `referredTutorEmail`（item 級推薦綁定）。
  - `fulfillmentStatus` / `logistics`（硬體出貨狀態與物流資訊）。
- **`activity_logs`**: 毫秒級學習行為追蹤（影片觀看、文件閱讀）。
- **`tutor_applications`**: 導師申請審核資料（由推薦/申請流程建立）。
- **`profit_ledger`**: 分潤計算明細。

---

## ✨ 平台特色 (Platform Highlights)

### 1. GitHub Classroom 深度整合
每個學習單元可設定專屬 Classroom 邀請連結。系統支援「事後綁定」，學生可在開始作業前建立與老師的關聯，提升購買後彈性。

### 2. 智慧型多層級分潤 (Recursive Sharing)
推薦系統支援遞迴式計算：
- **直接分潤**: 推薦老師獲得 20%。
- **上級獎勵**: 上級導師可獲得下級分潤額的 20%。

### 3. 硬體出貨工作流 (Hardware Logistics)
整合綠界 CVS 電子地圖，管理員可從後台標記出貨，並自動寄送出貨提醒。

### 4. 全自動 Email 通知系統
涵蓋付款、導師指派、作業繳交、老師評分、師資申請審核與管理員待辦提醒。

---

## 🚀 開發與部署 (DevOps)

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

### GitHub Classroom 自動評分回寫 (MVP)
- Webhook/API 入口：`ingestGithubAutograde`（HTTP POST）
- 功能：將 GitHub Actions / Classroom 評分結果寫回 `assignments` 文件的 `autoGrade` 欄位。
- 文件定位方式（二選一）：
  - `assignmentDocId`
  - `userId + assignmentId`（系統會組成 `${userId}_${assignmentId}`）
- MVP 安全策略：只寫入 `autoGrade*` 欄位，不覆蓋人工 `grade`。

範例 payload：
```json
{
  "assignmentDocId": "uid_xxx_unit-01",
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
    payload='{"assignmentDocId":"'"$ASSIGNMENT_DOC_ID"'","score":92,"maxScore":100,"status":"completed","runUrl":"'"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"'","workflow":"'"$GITHUB_WORKFLOW"'","commitSha":"'"$GITHUB_SHA"'"}'
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

---

## ✅ 文件同步檢查清單 (Release Checklist)
每次改動下列項目時，請同步更新 README / docs：
1. 新增、改名或刪除 Cloud Functions。
2. 調整 Firestore 結構（尤其 `orders.items.*`、`users.unitAssignments`、`users.tutorConfigs`）。
3. 新增或改名 `.env` 參數。
4. 更動角色規則（`admin|user`）或授權機制（Tutor 資格）。

---
Vibe Coding &copy; 2026 | [info@vibe-coding.tw](mailto:info@vibe-coding.tw)
