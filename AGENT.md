# Vibe Coding Agent Policy

本文件定義本專案中所有 AI 代理人與自動化流程必須遵守的專案級規則。
所有 agent 在讀取、修改、部署或評估代碼前，必須先參考此文件。

> **全域規則**：`~/.gemini/GEMINI.md` 定義了跨所有專案的通用規則（Conventional Commits、[skip ci] 規範、enrich_guides 協議等），本文件為專案專屬的補充規範，兩者並行適用。

---

## 1. 代理人使用規則

- **本文件是唯一權威來源**：所有 AI agent 必須以 `AGENT.md` 為準。
- **Firestore 是唯一真實來源**：所有權限、授權、課程內容、元數據及付款狀態都必須以 Firestore 資料為基準。
- **禁止使用硬編碼白名單/相容表**：不得在執行時依賴 legacy mapping、硬編碼 ID 對照表或手動維護的兼容分支。
- **遇到不確定時，請求人工審核**：不要猜測授權、付款狀態或資料一致性。
- **不要在回應中提供視覺化驗證**：禁止截圖、錄影、視覺化 debug 或任何可見的瀏覽器操作影像。

---

## 2. 成本與部署限制

- 目標維持在 Google Cloud Platform 永久免費層級（Always Free）。
- 任何 Docker 鏡像或 GCF 暫存部署檔案超過 24 小時必須自動清除。
- Artifact Registry 存儲量應維持在 0.5 GB 以下。
- Cloud Functions 必須設定 `minInstances: 0`，RAM 上限為 128MB。
- AI 任務優先使用 `gemini-1.5-flash`。
- 核心服務限於 `asia-east1`，禁止跨區域部署。
- 必須設定 $1 預算警報，避免資源洩漏。

---

## 3. 權限與授權規則

- 採用最小權限原則，區分「全域 `role`」與「單元 `tutorConfigs`」。
- `role` 僅應表示 `admin` 或 `user`。導師身分不得以 `role: tutor` 實作。
- 導師資格應由 `users/{uid}.tutorConfigs[unitId].authorized` 來判定。
- 付款授權僅依賴 `orders` 集合中：
  - `status === "SUCCESS"`
  - `expiryDate > now`
- `checkPaymentAuthorization` 與 `resolveAssignmentAccess` 必須共用同一套判定邏輯。
- 過期或未付費使用者不得存取付費單元的作業指引與設定介面。
- 比對任何單元 ID 時，必須先做歸一化處理，例如移除 `.html` 後綴。
- 課程卡片僅在該課程下所有關聯單元 `authorized: true` 時才視為「已開通」。

---

## 4. 元資料與前台顯示規範

- 所有前台課程標題、價格、核心內容、圖示等元資料必須以 Firestore 中的 `metadata_lessons` 為唯一依據。
- 嚴禁在 HTML 中硬編碼過時資料。
- 實體商品 `isPhysical === true` 且有價格時，前台銷售頁面必須顯示「🛒 加入購物車」與價格，不得自動跳轉為「進入課程」。

---

## 5. 儀表板與介面行為規則

- 單元視角（`unitId` 存在）時：
  - 隱藏 Overview 標籤。
  - 儀表板分頁順序應為 `Admin Console -> Assignments -> Settings`。
- 全站視角（無 `unitId`）時：
  - 預設導向 Overview。
- 非付費/過期用戶在單元視角下應看到鎖定提示，不得顯示 Assignments/Settings 內容。
- 管理員在 Tutor Mode OFF 時，必須完全模擬一般學員，不得保留特權。
- 管理員在 Tutor Mode ON 時，僅顯示 Settings；OFF 時，僅顯示 Assignments。
- 單元內點擊作業時：
  - 合格導師：不提供 GitHub Classroom 連結，僅顯示通用繳交對話框。
  - 已付費且有效學生：導向 `unitAssignments[unitId]` 的 GitHub Classroom assignment URL。
  - 未付費或已過期學生：只顯示通用對話框。
- 隱藏獨立 Earnings 分頁，所有財務資訊必須整合進 Settings。
- 作業列表中嚴禁顯示單元標題或課程分類；顯示格式為：上方 `unitId`、下方 `Assignment Title`。
- 單元視角比對 `unitId` 時，應對 `.html` 後綴與常見前綴具容錯性。
- 不應以 `courseId` 精確匹配來排除符合 `unitId` 的作業記錄。
- 管理員全站視野時，Overview/Assignments/Admin 的內容不受 Tutor Mode 切換影響。

---

## 6. 推薦連結與分潤整合規則

- 導師推廣一律使用 GitHub Classroom 原始連結，禁止中間跳轉頁或短網址。
- 合格導師預設分潤為 20%，系統應支援針對個別導師調整。
- 學員結帳時，如果輸入推薦連結，系統必須解析並綁定對應 `unitId`。
- `verifyReferralLink` 必須解析 GitHub Classroom 連結，並回傳對應內部 `unitId`，以便購物車綁定正確產品。
- 結帳成功後，應在訂單與學員資料中寫入 `referredByTutor`。
- 連結匹配時必須執行 ID 歸一化，移除 `.html` 等後綴。

---

## 7. 資料庫維護規範

- 禁止手動將使用者 `role` 設為 `tutor`。
- 所有設定資料應透過 `users.tutorConfigs` 儲存，`course_configs` 已廢棄。
- 屬性過期判定必須使用 `expiryDate.toMillis() > now.toMillis()`。
- 發現資料不一致時，優先進行資料遷移，禁止新增執行期 fallback。

---

## 8. AI 代理人開發與驗證原則

- AI agent 必須在背景完成驗證，不得向使用者展示瀏覽器截圖或錄影。
- 所有驗證結果應以簡短文字總結呈現，避免無關細節。
- 使用者看到的輸出應以「結果屬實」為主，非操作過程描述。

---

## 9. GitHub Repo 與 Actions 規則

- Push 到 **`vibe-coding-classroom/*`** 下的任何 repo 時：
  - commit message **必須**包含 `[skip ci]`，避免觸發無學生提交檔案的 workflow。
- Push 到 **`vibe-coding-template/*`** 下的任何 repo 時：
  - commit message **必須**包含 `[skip ci]`，避免觸發 `classroom.yml` / `autograde-sync-vibe-coding.yml`。
- 避免自動化推送觸發大量不必要的 workflow 執行。

```
# ✅ 正確
git commit -m "docs: update README [skip ci]"

# ❌ 錯誤 — 會觸發 Actions 並造成失敗
git commit -m "docs: update README"
```

---

## 10. 開發與部署流程

- 任何功能更新、Bug 修復或設定調整完成後，
  1. `git add .`
  2. `git commit`
  3. `git push`
  4. `firebase deploy`
- 確保生產環境與最新程式碼同步。

---

> 本文件是本專案 AI agent 的正式工作手冊，任何其他 agent 或訓練資料若要引用專案規則，請一律參考 `AGENT.md`。
> 
> 最後更新：2026-05-21
