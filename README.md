# Vibe Coding - 學習管理與分潤系統 (E-Learning & Profit Sharing System)

本專案是一個基於 Firebase 的現代化程式教學平台，結合了互動式課程、作業自動化、綠界金流 (ECPay) 以及多層級分潤架構。

## 🏗️ 系統架構 (System Architecture)

### 前端 (Frontend)
- **技術棧**: 原生 HTML5 / CSS3 (Vanilla CSS) / JavaScript (ES6+), TailwindCSS (部分組件)。
- **渲染與導航**: 使用自定義的 `nav-component.js` 與 `course-shared.js` 實現跨頁面統一導引與進度追蹤。
- **數據通訊**: 透過 Firebase JS SDK 直接與 Firestore 與 Cloud Functions 交互。

### 後端 (Backend)
- **平台**: Firebase (Google Cloud Platform)。
- **Cloud Functions (Node.js 22)**:
    - **`asia-east1` 區域**: 提供高性能、低延遲的亞太地區服務。
    - **API 服務**: 包含 `initiatePayment` (綠界支付)、`verifyReferralLink` (老師作業連結驗證)、`getDashboardData` (各項數據導出) 等。
    - **定時任務 (Scheduled Functions)**:
        - `calculateMonthlySharing`: 每月 1 號自動計算並分配推薦利潤。
        - `remindAdminPendingAssignments`: 每日提醒尚未完成老師指派的已付款單元。
        - `remindAdminPendingShipments`: 每日提醒待出貨的實體教材訂單。
        - `checkTrialExpiration`: 每日檢查試用期即將到期帳號並寄送提醒。
        - `checkCourseExpiration`: 每日檢查課程到期前 7 天/1 天並寄送提醒。
- **數據庫 (Firestore)**:
    - `users`: 使用者角色（實務上含 `admin`, `user`, `student`）、UID 與權限映射。
    - `activity_logs`: 毫秒級追蹤學生觀看影片、閱讀文件的學習時數。
    - `orders`: 支付訂單；老師作業連結與導師關係綁在各個 `items[itemId]` 上，而非整張訂單。
    - `profit_ledger`: 自動化產出的月度分潤清單。

## ✨ 核心特色 (Key Features)

### 1. 互動式學習追蹤 (Learning Tracker)
- **影片時數**: 紀錄 YouTube/Video 播放秒數，確保學生確實觀看。
- **文檔閱讀**: 追蹤文件閱讀時間，防止跳過基礎知識。
- **學習儀表板**: 學生與老師可即時查看每日、每週的學習累積。

### 2. GitHub Classroom 作業系統
- **深度整合**: 每個單元可設定專屬 Github Classroom 邀請連結。
- **批改與反饋**: 老師可直接在 Dashboard 預覽作業進度、給予 0-100 評分並撰寫文字建議。
- **老師推薦制**: 學生不再自行申請合格教師，改由授課老師在「評分作業」對話框中推薦，交由管理員審核。

### 3. 多層級分潤與推薦 (Profit Sharing)
- **老師作業連結 (Referral Link)**: 學生結帳時輸入老師提供的 GitHub Classroom 作業連結；連結只會套用到對應的課程/單元 item。
- **遞迴計算 (Recursive Sharing)**: 
    - 直接推廣者獲得 20% 分潤。
    - 其上級導師可獲得後者分潤金額的 20%，直到根結點 (Admin)。
- **自動連動指派 (Cascade Assignment)**：當學生輸入特定單元的推薦連結並購買「全套課程」時，系統會自動將該老師指派為該課程包下 **所有單元** 的負責人（前提是該老師具備全單元認證）。
- **為期一年**: 對於每位學生，分潤追蹤在初始訂閱後一年內有效。

### 4. 程式載體車子平台 (Hardware Platform)
- **實體商品銷售**: 整合課程與硬體 (入門款/進階款)。
- **物流整合**: 支援 7-11 門市電子地圖選取與收件人資訊蒐集。
- **出貨管理工作流**:
    - **自動追蹤**: 系統自動識別包含實體商品的訂單並標記為 `PENDING` 出貨狀態。
    - **管理員提醒**: 每日定時掃描未出貨訂單並寄送 Email 提醒管理員。
    - **一鍵標記**: 管理員可在後台直接查看收件門市資訊並在寄出後標記為 `SHIPPED`。
    - **學生端狀態**: 學生可即時在儀表板查看實體教材的物流準備狀態。

## 🛠️ 操作使用說明 (Usage Guide)

### 0. 付款、老師指派、作業與推薦的正式流程
1. 學生在 `cart.html` 結帳前可輸入老師提供的 GitHub Classroom 作業連結。
2. 前端先呼叫 `verifyReferralLink` 驗證老師作業連結，成功後會把該連結綁到對應的購物車 item，並記錄該 item 的 `referralLink` / `referredTutorEmail`。
3. 綠界付款成功後，`paymentNotify` 會：
   - 將訂單標記為 `SUCCESS`
   - 保留各 item 的 `referralLink` / `referredTutorEmail`
   - **自動連動指派 (Cascade Assignment)**：逐 item 檢查推薦連結，若推薦連結對應單元 A，且該 item 為包含單元 A 的全套課程項目，則自動將該項目的 **所有單元** 通通指派給該位老師 (`users/{uid}.unitAssignments[{unitId}] = teacherEmail`)，確保學生學習路徑不中斷。
   - 自動寄出付款成功、老師指派成功的 email 通知
4. 學生在課程頁或 Dashboard 點擊作業時，前端不再直接讀第一個 Classroom URL，而是先呼叫 `resolveAssignmentAccess`：
   - 若未付款：不開放作業入口
   - 若已付款但尚未完成老師指派：不開放作業入口
   - 若已付款且已指派老師：回傳該老師對應的 GitHub Classroom 連結
5. 學生透過該入口開始作業後，`submitAssignment` 才允許建立作業紀錄；若該單元需要老師指派但尚未指派，後端會拒絕寫入。
6. 只有該筆作業的 `assignedTeacherEmail` 對應老師，或 admin，才可以：
   - 評分
   - 推薦學生成為合格教師
7. 老師推薦學生時，會建立 `tutor_applications` 待審資料並寄送 admin 通知；admin 核准/拒絕後，系統再寄結果通知。

### 對於導師與管理員 (Admin/Teacher)
1. **進入 Dashboard**: 登入後點擊右上角「儀表板」。
2. **作業批改**:
    - 在「作業 (Assignments)」標籤中查看所有學生提交。
    - 點擊「✍️ 評分」按鈕輸入分數與評語。
    - 若學生表現成熟，可在同一個評分對話框中點擊「老師推薦成為合格教師」。
3. **分潤管理**:
    - 在整合後的設定/分潤區塊中查看您的月度累積佣金與當前使用的老師作業連結。
4. **權限授予**: 管理員可在 `view-admin` 控制台授權特定 Email 成為教師。
5. **出貨管理**: 
    - 在「管理員控制台」查看「待出貨管理」區塊。
    - 確認訂單項目與收件資訊（如 CVS 門市）。
    - 實體寄出後，點擊「標記為已出貨」以更新狀態並通知學生。

### 對於一般使用者 (General User)
1. **選購課程**: 在 `cart.html` 加入課程或硬體。
2. **推薦連結驗證**: 結帳前輸入或點擊老師的 GitHub Classroom 連結。
3. **提交作業**:
    - 付款成功且老師指派完成後，點擊作業入口會自動導向該老師提供的 GitHub Classroom。
    - 完成實作後，將 Repo / Demo 連結貼回提交視窗。
    - 系統會寄送作業繳交通知給對應老師；老師評分後，使用者也會收到評分通知信。

## 🔧 教師與管理員進階功能 (Teacher & Admin Advanced Features)

### 1. 教師後台管理功能
- **GitHub Classroom 連結管理**: 可針對各別學習單元 (Unit) 設定專屬的作業繳交連結。
- **學生進度分析**: 即時查看學生的學習時數、影片點閱率及作業繳交歷史紀錄。
- **互動式評分系統**: 直接在儀表板對學生作業進行評分、提供技術反饋或退回重改。

### 2. 精確的權限委派
- **Email 直接授權**: 管理員只需輸入教師的 Google 帳號 Email，即可快速開通特定課程的管理權限。
- **單元層級控制**: 教師僅能存取其獲准管理之單元的學生資料，且只能批改自己被指派之學生作業。

### 4. Email 通知與 Callback 規則
- **付款成功**: 寄送課程付款成功通知。
- **老師指派成功**: 同步寄送給學生與老師，連結回對應單元的 Dashboard。
- **學生繳交作業**: 寄送給該筆作業的 `assignedTeacherEmail`。
- **老師完成評分**: 寄送給學生，連結回對應單元的 `Assignments` 分頁。
- **老師推薦學生成為合格教師**: 寄送給 admin，連結回 `Dashboard?tab=admin`。
- **申請審核結果**: 寄送給申請者，核准後可直接回對應單元 Dashboard。

### 3. 深層連結 (Deep Linking) 技術
- **URL 直接導航**: 支援在網址後方加上標籤 (如 `#assignment-guide`) 直接跳轉至特定段落。
- **標準化錨點**: 所有單元的課程概述、資源區、範例程式、實作任務皆設有固定錨點。

## 📅 平台演進紀錄 (Platform Evolution)

### 2026 大更新
- **全單元指引標準化**: 所有 Basic (00-10) 與 Advanced (01-15) 單元皆已補齊「作業指引」與「講師手冊」。
- **Firebase V2 架構遷移**: 升級後端 API 至 V2，大幅提升部署速度與系統穩定度。
- **Hero 資源管理系統**: 標準化各單元 `window.RESOURCES` 與檔案存取路徑。
- **UI/UX 優化**: 導入玻璃卡片設計、沉浸式實作體驗、以及全螢幕專注模式。

## 🚀 開發與部署 (DevOps)

### 環境變數
`functions/.env` 包含：
- `MAIL_USER` / `MAIL_PASS`: 告警與通知郵件發送。
- `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV`: 綠界金流密鑰。
- `ECPAY_API_URL` / `ECPAY_LOGISTICS_MAP_URL`: 綠界付款與物流地圖 API 端點。

### 部署命令
```bash
# 全域部署
firebase deploy --project e-learning-942f7

# 僅部署函數
firebase deploy --only functions --project e-learning-942f7
```

---
Vibe Coding &copy; 2026 | info@vibe-coding.tw
