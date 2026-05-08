# Vibe Coding - 學習管理與分潤系統 (E-Learning & Profit Sharing System)

本專案是一個基於 Firebase 的現代化程式教學平台，結合了互動式課程、作業自動化、綠界金流 (ECPay) 以及多層級分潤架構。

---

## 📖 相關文件 (Documentation)
- **[🛠️ 操作使用說明 (Usage Guide)](usage-guide.md)**：包含完整的付款、導師指派、作業提交及師資申請流程。
- **[課前準備事項 (Preparation)](public/prepare.html)**：軟硬體環境準備與教材購買指引。

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
    - **API 服務**: 包含 `initiatePayment` (金流)、`verifyReferralLink` (推薦驗證)、`getDashboardData` (管理數據) 等。
    - **自動化指派**: `bindTutorToUnit` (事後自助綁定) 與 `paymentNotify` 中的 **Cascade Assignment** (全單元連動指派) 邏輯。
    - **定時任務 (Scheduled Functions)**:
        - `calculateMonthlySharing`: 每月 1 號結算分潤。
        - `remindAdminPendingAssignments`: 每日提醒未指派導師的訂單。
        - `remindAdminPendingShipments`: 每日提醒待出貨硬體訂單。
        - `checkCourseExpiration`: 檢查課程權限到期提醒。

### 數據庫結構 (Firestore)
- **`users`**: 核心使用者文件。角色分為 `admin` 與 `user`。
    - `unitAssignments`: 記錄學生各單元所指派的導師 Email。
- **`tutorConfigs`**: 導師資格狀態。記錄特定帳號在各單元的指導授權與對應的 Classroom 連結。
- **`orders`**: 訂單紀錄。包含實體商品出貨狀態與購買時的推薦資訊。
- **`activity_logs`**: 毫秒級學習行為追蹤（影片觀看、文件閱讀）。

---

## ✨ 平台特色 (Platform Highlights)

### 1. GitHub Classroom 深度整合
每個學習單元可設定專屬的 Classroom 邀請連結。系統支援「事後綁定」，學生可在開始作業前才建立與老師的關聯，大幅提升購買後的彈性。

### 2. 智慧型多層級分潤 (Recursive Sharing)
推薦系統不只是單層分潤，支援遞迴式計算：
- **直接分潤**: 推薦老師獲得 20%。
- **上級獎勵**: 該老師的上級導師獲得其分潤額的 20%，直到系統根節點。

### 3. 硬體出貨工作流 (Hardware Logistics)
整合綠界 CVS 電子地圖，管理員可從專屬後台一鍵標記出貨，並自動寄送物流狀態通知信。

### 4. 全自動 Email 通知系統
覆蓋了從付款、老師指派、作業繳交、老師評分到師資申請審核的所有關鍵節點，確保學習反饋零延遲。

---

## 🚀 開發與部署 (DevOps)

### 環境變數 (`functions/.env`)
需配置以下密鑰：
- `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`: 綠界金流密鑰。
- `MAIL_USER`, `MAIL_PASS`: Nodemailer 通知郵件帳號。

### 部署命令
```bash
# 全域部署
firebase deploy --project e-learning-942f7

# 僅部署指定功能的 Cloud Functions (例如新增的自助綁定功能)
firebase deploy --only functions:bindTutorToUnit --project e-learning-942f7
```

---
Vibe Coding &copy; 2026 | [info@vibe-coding.tw](mailto:info@vibe-coding.tw)
