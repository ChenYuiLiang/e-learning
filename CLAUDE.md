# Vibe Coding E-Learning Platform

Firebase 程式教學平台，整合 GitHub Classroom、綠界金流（ECPay）、多層級分潤與自動評分。

**Agent 行為規範見 `AGENT.md`（唯一權威來源）**

## 快速操作

```bash
# 安裝後端依賴
cd functions && npm install

# 本地模擬器（Hosting + Functions + Firestore）
firebase emulators:start --project e-learning-942f7

# 種子資料（Emulator 重啟後必跑）
cd functions && node scripts/seed-emulator.js

# 詳細步驟（含 ngrok）見 docs/local-development.md

# 部署
firebase deploy --project e-learning-942f7                    # 全部
firebase deploy --only functions --project e-learning-942f7   # 僅後端
firebase deploy --only hosting --project e-learning-942f7     # 僅前端
```

## 結構

```
public/             # 前端（Vanilla HTML/JS）
  js/               # 共用模組（nav-component.js、course-shared.js、footer-component.js）
  *.html            # 各頁面（index、auth、dashboard、cart、course pages…）
functions/          # Cloud Functions (Node.js 22)
  index.js          # 全部 Function 定義
  emailService.js   # Email 通知服務
  private_courses/  # 私有課程內容（安全分發）
  scripts/          # 工具腳本
  .env              # 環境變數（金流、郵件、webhook）
docs/               # 規格文件
scripts/            # Classroom 同步 shell 腳本
```

## 環境變數（`functions/.env`）

| 類別 | 變數 |
|------|------|
| 金流 | `ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_API_URL`、`ECPAY_LOGISTICS_MAP_URL` |
| 郵件 | `MAIL_USER`、`MAIL_PASS` |
| 站點 | `APP_BASE_URL`（預設 `https://vibe-coding.tw`）、`ADMIN_EMAIL` |
| GitHub | `GITHUB_WEBHOOK_SECRET` |
| 物流查詢 | `ECPAY_LOGISTICS_QUERY_URL`（選填） |

## 關鍵文件

- `AGENT.md` — Agent 規則（權限模型、Firestore First 原則、GitHub [skip ci] 規範）
- `docs/database.md` — Firestore 集合結構
- `docs/email-notifications.md` — Email 通知規格
- `docs/recursive-sharing.md` — 分潤公式

## 重要原則（摘自 `AGENT.md`）

- **Firestore First**：權限、授權、付款狀態以 Firestore 為準，禁止硬編碼白名單。
- **角色只有 `admin` / `user`**：導師資格由 `users.tutorConfigs[unitId].authorized` 判定。
- **付款授權**：`orders.status === "SUCCESS"` 且 `expiryDate > now`。
- **ID 歸一化**：比對 unitId 時移除 `.html` 後綴。
- **GCP 免費層**：`minInstances: 0`、RAM ≤ 128MB、僅 `asia-east1`。
- **Git commit 到 classroom repo 必須加 `[skip ci]`**，避免觸發 autograde workflow。
- Firebase 專案 ID：`e-learning-942f7`
