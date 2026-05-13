# GitHub Classroom 單元 Repo 協作改善流程

## 目標
讓每個課程單元以「整個 repository」為協作對象，持續改善教學與評分品質。  
協作範圍包含：
- `README.md`（學生任務與提交規範）
- `tutor-guide.md` / `.github/tutor_guide.md`（導師引導與介入策略）
- `test/`、`.github/workflows/`、範例程式與附件模板（驗收與教學支援）

系統對應：
- `Dashboard > Assignments`：顯示 `README.md`
- `Dashboard > Settings`：導師區優先讀取 `tutor-guide.md`

## 角色
- `Student (user)`: 提出閱讀卡點、提交需求不清、驗收標準模糊等問題。
- `Tutor`: 提供教學可用性建議，確保指引可執行。
- `Admin`: 維護規範一致性，審核與合併。

## 建議工作流
1. 開 Issue（使用 `README 改進提案` 模板）
2. 在對應課程 repository 建立 PR（可同時修改 README、tutor guide、測試/範例）
3. 依 PR template 完成一致性檢查
4. 至少 1 位 Tutor + 1 位 Admin Review 後 merge
5. merge 後在課堂公告或群組同步「本次單元 repo 改動重點」

### 流程圖：提案到合併
```mermaid
flowchart TD
    A["Student / Tutor / Admin 發現問題"] --> B["建立 Issue（Unit Repo 改進提案）"]
    B --> C["指派負責人與優先級"]
    C --> D["建立 PR（README / tutor-guide / tests/workflows）"]
    D --> E["CI / Autograde / 文件自檢"]
    E --> F{"審查通過？"}
    F -- "否" --> G["回到 PR 修正"]
    G --> E
    F -- "是" --> H["Tutor Review + Admin Review"]
    H --> I["Merge 到 main"]
    I --> J["發布更新重點（課堂/社群）"]
```

## 內容改版原則
- 聚焦可執行：學生看完 README 應知道「現在要做什麼」。
- 教學可介入：導師看完 tutor guide 應知道「何時、如何介入」。
- 驗收可重現：測試與 workflow 能穩定驗證同一標準。
- 明確提交物：列出必交檔案、命名規則、關鍵驗收字串。
- 明確評分標準：自動評分條件、通過門檻、常見失敗原因。
- 降低歧義：避免模糊詞，時間、檔案、步驟盡量具體。
- 小步改版：一次只改一個主題，降低審查與回滾成本。

## 推薦節奏
- 每週固定 1 次單元 repo 維護時段（30-60 分鐘）
- 每次最多處理 3-5 個高影響提案
- 優先順序：
  1. 影響提交正確性的問題
  2. 影響自動評分通過率的問題
  3. 影響新手理解成本的問題

## 完成定義 (Definition of Done)
- README / tutor-guide / 測試或 workflow 的必要更新已合併到 `main`
- PR checklist 全部勾選完成
- 至少一位 Tutor 驗證「新手可依 README 完成提交，導師可依 tutor-guide 有效介入」
- 公告已同步（課堂或社群）

## 變更治理
若改動涉及下列高風險範圍，需同步開系統變更議題，不只停留在 repo 文檔修改：
- Firestore 欄位/結構
- Dashboard 作業流程
- Autograde payload 與 webhook 規格
- 權限模型（admin/user、tutor status）

### 流程圖：內容治理邊界
```mermaid
flowchart LR
    A["Unit Repo 改動提案"] --> B{"改動類型"}
    B --> C["README.md<br/>學生任務與提交規範"]
    B --> D["tutor-guide.md / .github/tutor_guide.md<br/>導師引導與介入策略"]
    B --> E["tests/ + .github/workflows/<br/>驗收與自動評分一致性"]
    B --> F["系統層變更<br/>Firestore / Dashboard / Webhook / 權限"]

    C --> G["走 Repo PR 流程"]
    D --> G
    E --> G
    F --> H["同步建立系統變更議題"]
    H --> I["系統 PR + 風險評估 + 部署驗證"]
```
