# Template Org Migration Runbook

本文件定義 GitHub Classroom 架構下的模板遷移與日常維運方式。

## 1. 目前架構（建議）

- Source layer: `template` repos（教材內容來源）
- Publish layer: `bridge` repos（GitHub Classroom starter code 實際指向）
- Student layer: student repos（學員接受邀請後建立）

> 若 Classroom assignment 的 starter code 已指向 bridge repo，學生拿到的是 bridge 當下內容，而非 template 直接內容。

## 2. 何時需要改 Starter Code 指向

一般不需要改。

只在以下情境才改：
- 更換 org（例如 `vibe-coding-classroom` -> `vibe-coding-template`）
- 更換 repo 命名規則
- 分權或資安需求要求隔離來源 org

## 3. 日常更新流程（不改 starter code）

1. 編輯 template repo 內容
2. 執行 bridge sync（template -> bridge）
3. 合併 bridge PR
4. 新一批學生接受邀請後拿到新內容

## 4. 無停機遷移流程（需要改 org 時）

1. 建立新 template org（例如 `vibe-coding-template`）
2. 將 template repos mirror 至新 org
3. 更新 sync CSV 中 `template_repo` 指向新 org
4. 跑 bridge sync 驗證
5. 抽樣 3 個單元做 E2E（accept invite -> push -> autograde）
6. 再批次更新 GitHub Classroom assignment 的 starter code 指向（如必要）

## 5. 驗證清單

- bridge repo 是否含最新 README / tutor-guide / tests
- `VC_AUTOGRADE_URL` / `VC_AUTOGRADE_TOKEN` secrets 是否齊全
- 學生 push 後 `assignments.autoGrade.score` 是否更新
- Dashboard 是否能正確開啟作業入口

## 6. 風險與避免方式

- 風險：誤以為改 template 會立即影響學生
  - 避免：必須完成 template -> bridge 同步與 merge
- 風險：starter code 指向過早切換造成課中混亂
  - 避免：先雙軌驗證，再分批切換
- 風險：舊資料夾帶入無效 invite URL
  - 避免：前端 + 後端都驗證 `https://classroom.github.com/a/...`

