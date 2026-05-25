# Database Schema (Firestore)

本文檔記錄 Vibe Coding 平台 Firestore 結構，基於目前線上系統實作。

## 1. `users` 集合 (核心)
儲存所有使用者（學生 / 導師 / 管理員）的個人資料、權限與學習狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `uid` | string | Firebase Auth UID。 |
| `email` | string | 使用者 Email。 |
| `name` / `displayName` | string | 顯示名稱。 |
| `photoURL` | string | 頭像連結。 |
| `role` | string | 系統角色：僅 `admin` 或 `user`。 |
| `tutorConfigs` | map | Tutor 單元授權狀態。Key 為 unitId，常見欄位：`authorized`, `assignmentUrl`, `courseId`, `updatedAt`。 |
| `tutorApplications` | array | 該使用者申請紀錄快照（部分流程使用）。 |
| `hasPendingApplication` | boolean | 是否有待審導師申請。 |
| `unitAssignments` | map | 學生單元指派導師。Key = unitId，Value = tutorEmail。 |
| `unitAssignmentMeta` | map | 學生單元綁定資訊。Key = unitId，常見欄位：`tutorUid`, `tutorEmail`, `promotionCode`, `linkedAt`。 |
| `promotionCode` | string | Tutor 專屬 Promotion code（全域唯一）。 |
| `courseProgress` | map | 學習進度聚合資料。 |
| `orders` | array | 主要為 Dashboard 聚合回傳欄位，非主要持久化來源（實際訂單以 `orders` 集合為準）。 |
| `updatedAt` | timestamp | 最後更新時間。 |
| `createdAt` / `joinedAt` | timestamp | 建立時間。 |

> 註：Tutor 不是 `role`，而是 `tutorConfigs[unitId].authorized === true` 的狀態。

---

## 2. `orders` 集合
儲存綠界付款訂單與後續履約狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `orderNumber` | string | 系統訂單編號（如 `VIBE...`）。 |
| `uid` | string | 購買者 UID。 |
| `amount` | number | 交易金額。 |
| `status` | string | 目前主流程實際寫入 `PENDING`, `SUCCESS`（`FAILED` 保留為擴充狀態）。 |
| `items` | map | 訂單項目。Key 為 itemId，value 可含 `name`, `price`, `quantity`, `isPhysical`。 |
| `gateway` | string | 付款閘道（例如 `ECPAY`）。 |
| `paidAt` | timestamp | 付款完成時間。 |
| `paymentDate` | string | 金流回傳付款時間字串。 |
| `expiryDate` | timestamp | 課程權限到期時間。 |
| `fulfillmentStatus` | string | 出貨狀態（如 `PENDING`, `SHIPPED`）。 |
| `logistics` | map | 物流資料（門市/收件資訊）。 |
| `logisticsMissing` | boolean | 實體商品訂單付款後物流資料不完整時的警示旗標。 |
| `ecpayTradeNo` | string | 綠界交易編號。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

> 購物車不再輸入 Promotion code / 推薦連結。  
> 導師綁定在作業頁進行，並寫入 `users.unitAssignments` 與 `users.unitAssignmentMeta`。
> 實體商品下單會在 `initiatePayment` 驗證物流必要欄位（收件人、電話、門市/地址）；若歷史資料或例外流程造成缺漏，`paymentNotify` 會標記 `logisticsMissing=true` 供後台追蹤。

---

## 3. `metadata_lessons` 集合
儲存課程與單元元資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `courseId` | string | 課程唯一識別碼。 |
| `title` | string | 課程/單元標題。 |
| `courseUnits` | array | 該課程包含的單元 HTML 檔列表。 |
| `price` | number | 價格（0 代表免費）。 |
| `category` | string | 課程類別（如 `prepare`, `start`, `basic`, `advanced`）。 |
| `isPhysical` | boolean | 是否為實體商品。 |
| `orderWeight` | number | 排序權重。 |

> 重要：課程授權判斷（包含免費課程 `price=0`）以 `metadata_lessons` 為唯一來源（Source of Truth）。
> 不再依賴硬編碼單元白名單。
> 所有執行期資料比對（包含邀請連結、課程授權、單元歸屬）都必須直接查 Firestore，禁止使用程式碼內相容名單或 fallback 白名單。
>
> 2026-05-16 更新：
> - `ai-agents-vibe.courseUnits` 已切換為 `02-unit-agent-mode.html`, `02-unit-web-agents.html`, `02-unit-vibe-coding.html`
> - `github-classroom.courseUnits` 已整併為 `03-unit-github-classroom.html`

### `metadata_lessons` 規劃中欄位（Platform Expansion Plan）

下列欄位尚屬下一階段規劃，作為課程架構升級與外部內容倉遷移使用：

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `courseKey` | string | 新的穩定課程主鍵，取代對 HTML 檔名的直接依賴。 |
| `track` | string | 課程主軸，例如 `common`、`car`。 |
| `level` | string | 課程層級，例如 `common`、`starter`、`basic`、`advanced`。 |
| `entryUnitId` | string | 課程入口單元 ID，用於取代 `*-master-*` 頁面的進入責任。 |
| `contentRef` | string | 對應外部內容倉的內容路徑，例如 `courses/zh-TW/tw-car-starter-html5-basics.html`。 |
| `i18n` | map | 可選的多語內容設定，例如各語系內容路徑或語系可用性資訊。 |

參考模板：
- `docs/examples/metadata-lessons-migration-template.csv`

---

## 4. `assignments` 集合
儲存學生作業提交與評分狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `userId` / `uid` | string | 學生 UID。 |
| `userEmail` / `studentEmail` | string | 學生 Email。 |
| `courseId` | string | 課程識別碼。 |
| `unitId` | string | 單元 ID。 |
| `assignmentTitle` | string | 作業標題。 |
| `assignmentId` | string | 作業識別碼（常與 `userId` 組合成文件 id）。 |
| `assignmentUrl` | string | 學生提交連結（GitHub / Demo）。 |
| `studentNote` | string | 學生備註。 |
| `assignedTutorEmail` | string | 該作業對應導師。 |
| `currentStatus` | string | `started` / `submitted` / `graded`。 |
| `grade` | number | 分數。 |
| `tutorFeedback` | string | 導師評語。 |
| `autoGrade` | map | GitHub 自動評分結果（常見欄位：`score`, `maxScore`, `status`, `source`, `runUrl`, `workflow`, `commitSha`, `repository`, `actor`, `summary`, `updatedAt`）。 |
| `autoGradeSource` | string | 自動評分來源（MVP 為 `github_actions`）。 |
| `autoGradeUpdatedAt` | timestamp | 最近一次自動評分更新時間。 |
| `autoGradeRaw` | map | 原始分數/狀態回寫快照（便於追蹤 webhook payload）。 |
| `submissionHistory` | array | 作業歷程（START / SUBMIT / GRADE / AUTO_GRADE）。 |
| `submittedAt` / `updatedAt` | timestamp | 提交/更新時間。 |

作業 docId 規則與回寫關聯：
- 建議固定使用 `assignments/{userId_assignmentId}`。
- `submitAssignment` 第一次寫入時即建立該 docId（至少 `currentStatus=started`）。
- `ingestGithubAutograde` 採 `unitId-first`：以 `userId + unitId` 解析同單元最新作業並回寫分數。
- Admin TutorMode 測試入口不會自動建立 `started` 紀錄，避免觸發學生付款授權檢查。
- 若某單元尚未有任何學生建立 assignment 紀錄，該單元在 bootstrap 匯出時會顯示 `missing_mapping`（屬預期），待首次 assignment 建立後即可由補漏流程自動補齊。

---

## 5. `tutor_applications` 集合
儲存導師資格申請審核資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `userId` | string | 申請者 UID。 |
| `userEmail` | string | 申請者 Email。 |
| `unitId` | string | 申請單元。 |
| `status` | string | `awaiting_candidate_link`, `pending`, `approved`, `rejected`。 |
| `source` | string | 來源（如 `tutor_recommendation`）。 |
| `recommendedByUid` | string | 推薦者 UID（推薦流程）。 |
| `recommendedByEmail` | string | 推薦老師 Email。 |
| `recommendedFromAssignmentId` | string | 由哪筆 assignment 推薦而來。 |
| `recommendedAt` | timestamp | 推薦建立時間（推薦流程）。 |
| `candidateClassroomInviteUrl` | string | 候選學生提交的 GitHub Classroom 邀請連結。 |
| `candidateLinkSubmittedAt` | timestamp | 候選學生完成連結提交時間。 |
| `appliedAt` | timestamp | 申請時間。 |
| `adminMessage` | string | 管理員審核回覆。 |
| `resolvedAt` | timestamp | 審核完成時間。 |
| `resolvedByUid` | string | 審核管理員 UID。 |

---

## 6. `profit_ledger` 集合
儲存導師分潤計算明細。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `tutorEmail` | string | 分潤歸屬導師。 |
| `studentUid` | string | 訂單對應學生 UID。 |
| `orderId` | string | 關聯訂單 ID。 |
| `orderItemId` | string | 關聯訂單項目 key。 |
| `orderAmount` | number | 該項目金額（單價 x 數量）。 |
| `shareAmount` | number | 分潤金額。 |
| `level` | number | 分潤層級。 |
| `referralLink` | string | 對應推薦連結（若有）。 |
| `period` | string | 計算月份（YYYY-MM）。 |
| `calculatedAt` | timestamp | 本次計算寫入時間。 |
| `idempotencyKey` | string | 冪等鍵（`period+orderId+orderItemId+level+tutorEmail` 雜湊），避免重跑重複入帳。 |

> 分潤公式、上線鏈條與月結規則詳見 `docs/recursive-sharing.md`。

---

## 7. `activity_logs` 集合
儲存毫秒級的學習行為追蹤數據（由 `logActivity` API 寫入）。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `uid` | string | 執行行為的使用者 UID。 |
| `courseId` | string | 課程識別碼。 |
| `action` | string | 行為類型（如 `VIDEO`, `DOC`, `PAGE_VIEW`；目前 `PAGE_VIEW` 寫入已停用）。 |
| `duration` | number | 持續時間（秒）。 |
| `metadata` | map | 額外參數（如 `videoId`, `percentComplete`）。 |
| `timestamp` | timestamp | 記錄時間。 |

---

## 8. `referral_links` 集合
儲存導師推薦/綁定用 GitHub Classroom URL 索引。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `tutorEmail` | string | 該推薦連結所屬導師 Email。 |
| `tutorName` | string | 導師名稱。 |
| `unitId` | string | 連結對應單元 ID。 |
| `normalizedUrl` | string | 正規化後的 GitHub URL。 |
| `createdAt` | timestamp | 建立時間。 |

---

## 9. `metadata_settings` 集合
系統全域設定（目前已使用：`tutor_terms`）。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `content` | string | 設定內容（例：合格教師條款）。 |
| `updatedAt` | timestamp | 設定更新時間。 |

---

## 10. 遷移備註 (Migration Notes)
1. 角色已統一為 `admin` 與 `user`，歷史 `student` 角色需遷移為 `user`。
2. 申請/推薦/審核流程以 `tutor_applications` 為單一真實來源（Source of Truth）；`users.tutorApplications` 僅作歷史快照，不得作為執行期判斷來源。
3. 單元 key 含 `.html` 時，Firestore update 請使用 `FieldPath` 或一致正規化，避免 dot-in-key 巢狀化問題。
4. 禁止新增白名單、相容名單、legacyMap 類型的執行期判斷層；需先完成 Firestore 資料遷移再上線。
5. `courseId` 建議統一採用課程主頁檔名（page URL），例如：`01-master-getting-started.html`、`02-master-ai-agents.html`。
6. 若要從舊 `courseId`（短碼/舊字串）遷移至 page URL，請使用：
   - `node functions/scripts/migrate_courseid_to_page_url.js --dry-run`
   - `node functions/scripts/migrate_courseid_to_page_url.js --apply`
   - 來源映射會以 `metadata_lessons.classroomUrl` 的檔名為準，並同步更新 `orders`、`assignments`、`users.courseProgress`、`users.tutorConfigs` 的課程層 key。

---

## 11. 師生互動與卡點支援欄位 (Active)
以下為 Tutor x Student 互動層 MVP 實際啟用之資料欄位。

### `assignments` 擴充欄位
| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `learningState` | string | 學習狀態：`new`, `in_progress`, `blocked`, `coaching`, `resolved`。 |
| `latestBlocker` | map | 最近卡點（例：`type`, `note`, `createdAt`）。 |
| `hintLevelUsed` | number | 最近提示層級（`0~3`）。 |
| `attemptSummary` | string | 學生嘗試摘要。 |
| `nextAction` | string | Tutor 指定下一步。 |

### `assignment_coaching_logs` 集合 (歷史指導紀錄)
| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `assignmentId` | string | 關聯作業。 |
| `studentUid` | string | 學生 UID。 |
| `tutorEmail` | string | 指導導師。 |
| `hintLevel` | number | 提示層級（`1/2/3`）。 |
| `blockerType` | string | 卡點類型（`concept/debug/environment`）。 |
| `coachNote` | string | 結構化教學回饋。 |
| `createdAt` | timestamp | 建立時間。 |

### `assignment_interventions` 集合 (系統自動監控警示)
| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `assignmentId` | string | 關聯作業。 |
| `studentUid` | string | 學生 UID。 |
| `studentEmail` | string | 學生 Email。 |
| `triggerScore` | number | 觸發介入時分數。 |
| `threshold` | number | 觸發門檻。 |
| `status` | string | `open`, `in_progress`, `resolved`。 |
| `ownerTutorEmail` | string | 負責導師。 |
| `createdAt` / `resolvedAt` | timestamp | 建立與完成時間。 |
