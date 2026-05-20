# Vibe Coding: 核心開發規則與營運規範 (Project Rules)

本文件定義 Vibe Coding 平台的營運成本規範、權限模型與開發準則。

---

## 1. 零元帳單營運規範 (GCP Zero-Cost Rules)
致力於維持在 **Google Cloud Platform (GCP) 永久免費層級 (Always Free Tier)** 之內。

### 1-A. 存儲與鏡像管理 (Storage Cleanup)
- **規則**: 超過 24 小時的 Docker 鏡像與部署暫存檔 (gcf-sources) 必須自動刪除。
- **目標**: 確保 Artifact Registry 存儲量低於 **0.5 GB** 免費額度。

### 1-B. 算力與 AI 配置 (Compute & AI)
- **規則**: 函數 `minInstances` 恆設為 **0**，記憶體上限為 **128MB**。
- **AI 策略**: 採用「Flash 優先」策略，所有 AI 任務優先調用 **`gemini-1.5-flash`**。

### 1-C. 監控與預警 (Monitoring)
- **警報**: 帳單必須設定 **$1 預算警告**，防止任何資源洩漏。
- **地區**: 核心服務鎖定於 `asia-east1` (台灣)，嚴格禁止跨區域部署。

---

## 2. 系統權限與角色規範 (Access Control)
採用「最小權限原則」，區分「全域角色 (Roles)」與「單元狀態 (Status)」。

### 2-A. 全域角色 (Global Roles)
1. **管理員 (Admin)**: 系統最高權限，可檢閱所有數據。
    - **導師模式 (Tutor Mode: ON)**: 切換為教師視角，可依教師規則檢視與管理單元內容、指派作業、修改 GitHub Classroom 連結。
    - **學員視角模擬 (Tutor Mode: OFF)**: **管理員身分不具備特權 (No Override)**。其行為與權限模擬一般學員：非合格導師且未付費（或已過期）者，嚴禁存取收費單元之作業連結與設定內容。
2. **一般使用者 (Standard User)**: `role` 欄位為空或為 `user`。存取權限僅依據購買狀態與單元合格授權。

### 2-B. 支付與過期檢核 (Paywall & Expiry)
- **付費判定**: 系統必須以 `orders` 集合中 `status === "SUCCESS"` 且 `expiryDate > now` 的有效訂單作為唯一付費依據。
- **規則**: **已過期 (Expired)** 或 **新用戶 (Free)** 嚴禁造訪付費單元 (Paid Units) 的任何作業 (Assignments) 指引與設定 (Settings)。
- **實作要求**: `checkPaymentAuthorization` 與 `resolveAssignmentAccess` 必須共用同一套有效訂單與到期判定邏輯，禁止前端自行推測繳費狀態。

### 2-C. 實體產品與課程元數據 (Physical Products & Metadata)
- **實體產品決策**: 凡 `isPhysical` 為 `true` 且有價格的卡片（如：開發平台裝置），無論使用者是否具備管理員權限，在前台銷售頁面（Prepare, Basic, Advanced 等）必須優先顯示 **「🛒 加入購物車」** 與價格，嚴禁管理員在 Tutor Mode 下自動跳轉為「進入課程」。這是為了確保銷售 UI 的正確性與購買流程的測試完整。
- **單一資料來源**: 所有前台展示的課程標題、價格、核心內容、圖示等元數據，必須以 **Firestore 的 `metadata_lessons` 為唯一準則**，嚴禁在 HTML 中硬編碼過時的資料。

### 2-D. ID 歸一化與授權比對規範 (ID Normalization & Authorization Rules)
- **歸一化原則 (Normalization Rule)**: 由於課程元數據 (Metadata) 可能包含 `.html` 副檔名，而 Firestore 的 `tutorConfigs` 鍵值通常為純 ID，系統在執行任何權限比對前，**必須**統一執行歸一化處理（例如：移除 `.html` 後綴）。
- **課程卡片開通門檻 (Course Card Unlock)**: 對於課程整體的存取權限（如首頁或 Dashboard 的課程卡片），必須滿足該課程下**所有 (EVERY)** 關聯單元均已在 `tutorConfigs` 中標記為 `authorized: true`，系統才可將該卡片判定為「已開通 (Opened)」。
- **實作要求**: 後端 `isTutorFullyQualifiedForCourse` 與 `checkPaymentAuthorization` 必須強制執行上述歸一化比對，防止因後綴不一致導致的授權失效。
- **禁止名單規則**: 嚴禁以硬編碼白名單、相容名單、legacy 對照表作為執行期權限判斷依據。所有判斷必須直接查 Firestore canonical 資料。

---

## 3. Dashboard 分頁規劃 (V13.0)

### 3-A. 分頁職能矩陣 (Functional Matrix)

| 分頁 (Tab) | 單元視角 (Unit Context) | 全局視角 (Global View) | 存取對象 (Access) |
| :--- | :--- | :--- | :--- |
| **概覽 (Overview)** | ❌ 隱藏 (Hide) | ✅ 顯示 (營運概覽) | Admin Only (Global) |
| **管理員控制台 (Admin Console)** | ✅ 顯示 | ✅ 顯示 | Admin Only |
| **作業 (Assignments)** | ✅ 條件顯示 | ✅ 顯示 (全站 Feed) | Qualified Tutor (Tutor Mode OFF) / Paid Student |
| **課程設定 (Settings)** | ✅ 條件顯示 | ❌ 隱藏 | Qualified Tutor (Tutor Mode ON) |

### 3-B. 導航行為準則
- **進入單元 (Has UnitId)**: 優先導向 **Assignments** 指標。為了視覺專注，**Overview 標籤必須隱藏**。
- **全站視野 (No UnitId)**: 導向 **Overview**。這是管理員的全站儀表板入口。
- **鎖定邏輯**: 非付費/過期用戶在「學員視角」下，即便強行造訪 Assignments/Settings，系統應呈現「🔒 鎖定狀態」或「請先續費」字樣。
- **單元分頁順序**: 當 `unitId` 存在時，分頁順序必須為 `Admin Console -> Assignments -> Settings`。
- **合格導師切換規則**: 若使用者在 `users/{uid}.tutorConfigs[unitId].authorized === true`，則 `Tutor Mode: OFF` 僅顯示 `Assignments`；`Tutor Mode: ON` 僅顯示 `Settings`。
- **付費學生規則**: 若使用者對該單元所屬課程具有有效訂單且尚未過期，則顯示 `Assignments` 分頁。
- **未付費/已過期規則**: 若使用者對該單元未繳費或已過期，則單元視角下不顯示 `Assignments` / `Settings` 分頁。
- **課文作業入口規則**:
  - 合格導師: 點擊本文作業區時，不提供 GitHub Classroom 連結，僅顯示通用繳交對話框。
  - 已付費未到期學生: 點擊本文作業區時，必須導向其 `unitAssignments[unitId]` 對應輔導老師的 GitHub Classroom assignment URL。
  - 未付費或已過期學生: 點擊本文作業區時，只顯示現有通用對話框，不得顯示 GitHub Classroom assignment URL。

### 3-C. Overview 與分頁展示規範 (Global View Immunity - V13.6)
- **管理員全局豁免**: 當管理員處於「全站視野 (No UnitId)」下時，所有儀表板分頁（Overview, Assignments, Admin）必須保持顯示狀態，且內容（如學員名單、作業列表）**不受「導師模式 (Tutor Mode)」切換的影響**。
- **目標**: 確保管理員即便在關閉導師模式時，依然能維持 100% 的站點營運檢閱能力（如 Overview 中的總數統計與全站作業 Feed），只有在進入特定單元視角時，才套用權限模擬邏輯。

---

## 4. 資料庫維護準則 (Maintenance)
1. **禁止手動更改 Role**: 禁止將使用者 `role` 改為 `tutor`（導師是 Status 而非 Role）。
2. **單一事實來源**: 所有設定資料必須透過 `users` 集合中的 `tutorConfigs` 字段存儲，`course_configs` 集合已廢棄。
3. **過期檢核**: 後端 `checkPaymentAuthorization` 必須包含 `expiryDate.toMillis() > now.toMillis()` 的判定邏輯。
4. **Firestore First（強制）**: 所有資料比對、驗證、儲存都以 Firestore 為唯一真實來源；若發現歷史資料鍵值不一致，必須走資料遷移，不可新增白名單/相容分支。

---

## 5. Tutor Dashboard 介面精簡規範 (V13.5 UI Consolidation)
為了最大化教學管理效率，儀表板採取「單一任務中心」佈局。

### 5-A. 「課程設定 (Settings)」標籤整合佈局
在具備單元視角 (Unit Context) 時，Settings 分頁必須依序包含下列區塊 (不可隨意更動順序)：
1. **Classroom Links (作業連結設定)**: URL 邀請連結設置區。
2. **Integrated Assignments (本單元作業批改)**: 顯示該單元的學生繳交名單表格。
3. **Financial Dashboard (分潤紀錄與老師作業連結)**: 
    - 需包含「累積總分潤」與「該單元專屬老師作業連結」。
    - 需包含「分潤明細 (Ledger)」表格。
4. **Tutor Guides / Attachments (教學指引與附件)**:
    - 位於分頁最底部。
    - 僅顯示導師專用指引 (Tutor Guide) 與補充附件 (Attachments)。

### 5-B. 介面元素刪減準則 (UI Exclusion Rules)
為了維持介面清爽且專注於任務，下列元素**嚴禁顯示**：
- **移除 「合格教師狀態 (Teaching Team)」表格**: 不再顯示管理員/導師清單。
- **隱藏 「學生作業引導 (Assignment Guide)」**: Settings 分頁不顯示給學生的引導文字（僅保留導師批改指南）。
- **取消 「分潤 (Earnings)」獨立分頁**: 該分頁按鈕必須隱藏/移除，所有財務數據統一整合至 Settings 分頁。

### 5-D. 介面欄位簡約規範 (UI Minimalism)
- **核心規則**: 在作業列表 (Assignments Table) 的欄位中，**嚴禁**顯示單元標題 (Unit Title) 或課程分類 (Course Category)。
- **顯示佈局**: 
  - **上方 (Top)**: 顯示 `unitId` (Slug 格式)，採小字灰色設計 (`text-[10px] text-gray-400`)。
  - **下方 (Bottom)**: 顯示「作業標題 (Assignment Title)」，採粗體深色設計 (`font-bold text-gray-800`)。
- **目的**: 保持介面資訊密度適中，確保導師能透過 ID 快速對應底層檔案。

### 5-E. 作業顯示與單元規範 (Unit-Centric Assignment Visibility)
為了確保測試與開發的靈活性，作業列表的顯示邏輯必須遵守下列準則：
- **單元視角下的角色模擬 (Role Simulation in Unit Context)**：當管理員 (Admin) 處於單元視角 (Unit Context) 且進入「Integrated Assignments」表格時，**嚴禁具備全域特權**。系統必須依據「導師模式 (Tutor Mode)」開關進行 100% 擬真切換：
    - **輔導老師模式 OFF (學員視角)**：僅顯示管理員自己的測試作業（遵循 `isOwnAssignment` 邏輯）。
    - **輔導老師模式 ON (老師視角)**：僅顯示指派給該管理員（作為導師）的學生作業。管理員自己的作業在此模式下應被隱藏。
- **單元識別相容性 (Unit ID Normalization)**：系統在比對 `unitId` 時，必須對 `.html` 後綴與 `start-` 等導學前綴具有容錯性。只要核心 Slug 一致，即應視為同一單元的作業並在儀表板中合併顯示。
- **取消 CourseId 強制過濾**：在具備 `unitId` 的單元視議下，只要 `unitId` 符合，即應顯示作業。禁止因為 `courseId` 欄位不精確匹配而篩除符合單元條件的紀錄。

### 5-F. 作業列表情境行為規範 (Context-Aware Table Rules)
為了優化不同情境下的操作效率，作業列表的點擊行為與欄位顯示必須遵循：
1. **全域視野 (No UnitId)**：
   - **分頁**: 主要 Assignments 標籤。
   - **操作欄位**: 隱藏。
   - **行為**: 點擊作業列 (Row Click) 直接開啟 **評分視窗 (Grading Modal)**。
2. **單元視野 (With UnitId)**：
   - **分頁**: 主要 Assignments 標籤。
   - **操作欄位**: 隱藏。
   - **行為**: 點擊作業列 (Row Click) 開啟學員提供的 **外部作業連結 (assignmentUrl)**。
3. **單元視野 - 整合批改 (With UnitId)**：
   - **分頁**: Settings 標籤內的 Integrated Assignments 表格。
   - **操作欄位**: 顯示 (包含「評分」按鈕)。
   - **行為**: 點擊「評分」按鈕或作業列開啟 **評分視窗 (Grading Modal)**。

### 5-G. 推薦分潤與作業連結整合規範 (Integrated Referral & Link Rules)
本系統將作業邀請連結 (assignmentUrl) 與老師作業連結 (Referral Link) 進行功能整合，以簡化推廣流程並強化產學連結：

1. **唯一推廣媒介 (Unified Medium)**：
   - 廢除傳統隨機字串老師作業連結。導師推廣時，一律分享其個人在 `tutorConfigs` 中設定的 **GitHub Classroom 原生連結**。
   - **連結限制**：必須使用原始 GitHub Classroom 網址，嚴禁使用任何中間跳轉頁 (Middle-man Link) 或短網址，以確保資訊純粹。

2. **分潤與折扣機制**：
   - **標準分潤**：合格輔導老師預設享成交金額之 **20%** 作為分潤。
   - **彈性設定**：系統架構需支持未來可針對特定導師調整個別分潤比例。

3. **推薦關聯邏輯**：
   - **資格限定**：學員購買課程時，僅能關聯且輸入「已取得該課程全單元認證」之合格導師所屬連結。
   - **解析機制 (V15.6)**：`verifyReferralLink` 在接收 GitHub Classroom 連結後，會透過 `referral_links` 索引識別匹配的內部 **Unit ID** 與導師。
   - **對應傳回**：後端處理後，必須將識別出的內部 `unitId` 回傳給前端作為 `courseId` 欄位，確保購物車能正確執行 `addInviteItem` 並將連結與對應產品綁定。
   - **ID 容錯**：比對過程強制執行歸一化（移除 `.html`），確保推薦連結在任何 ID 格式下皆能穩定工作。

4. **系統追蹤與寫入**：
   - 結帳流程解析連結後，應將導師 ID 寫入訂單與學員的 `referredByTutor` 欄位，作為後續分潤計算之唯一指標。

5. **招生工具 UI 佈局 (V15.4)**：
   - **並列優先**：在寬螢幕下，招生工具 (Invite Tools) 必須採用「左右並列」佈局。左側顯示 QR Code 與兩個主要動作按鈕（複製連結/發送郵件），右側顯示「報名通知書」文案區。
   - **目的**：減少垂直滾動，確保導師能同時檢視實體連結工具與對應的行銷文案。

---

## 6. AI 開發與驗證準則 (AI Development & Verification)
本區塊定義 AI 代理人（Coding Agent）在開發過程中的行為準則，核心目標是「極致效率」與「最小化使用者審閱負擔」。

### 6-A. 視覺化過程禁令 (Visual-Free Protocol)
- **核心規則**: **嚴禁**向使用者提供或展示任何視覺化的驗證、除錯或排查過程。這包括：
    - 瀏覽器操作錄影 (Browser Recording)
    - 頁面截圖 (Screenshot)
    - 任何顯示瀏覽器內部狀態的視覺化報告
- **自主驗證**: AI 代理人應在後台 (Background) 獨立使用 `browser_subagent` 或其他工具完成功能驗證。使用者只需看到「結果屬實」的文字總結。
- **效率優先**: 極致減少使用者的視覺資訊過載，確保溝通僅限於程式邏輯與業務決策。

---

## 7. 開發與部署流程 (Development & Deployment)

### 7-A. 三位一體同步原則 (Triple Sync Rule)
- **核心規則**: 任何功能開發、Bug 修復或配置更動完成後，**必須**緊接著執行代碼同步與環境部署。
- **標準 SOP**:
    1. **Git Sync**: `git add .` -> `git commit` -> `git push`。確保 remote 程式庫為最新狀態。
    2. **Firebase Deploy**: `firebase deploy`。確保生產環境（Hosting & Functions）與最新的代碼邏輯一致。
- **目標**: 杜絕環境漂移 (Environment Drift)，確保開發代理人 (AI Agent) 隨時能在最新的生產環境基礎上進行下一次迭代。

---

## 8. GitHub 儲存庫維護與 Actions 規範 (GitHub Repo Operations)

### 8-A. 批次修改與 Actions 安全機制 (Batch Repo Updates & Actions Protection)
- **核心規則**: 當 AI 代理人 (Agent) 批次修改 `vibe-coding-template` 或 `vibe-coding-classroom` 組織底下的 GitHub 儲存庫時，**必須在執行任何檔案修改/新增/刪除前，先將相關儲存庫的 GitHub Actions 權限設定為 Disabled**。
- **恢復機制**: 修改全部完成後，**必須立刻將 Actions 權限重新啟動 (Enabled)**，以確保學生作業的自動評分機制正常運作。
- **目的**: 避免因批量推送代碼或變更檔案，觸發大量不必要的 GitHub Actions 工作流，造成 API 請求浪湧與資源耗損。

---
*最後更新日期: 2026-05-20 (V18.0 - Tutor Guide Migration & GitHub Actions Rule)*
