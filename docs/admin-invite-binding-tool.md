# Admin Invite Binding Lookup Tool

## Purpose
快速查詢某一條 GitHub Classroom 邀請連結目前在 Firestore 綁定到哪些課程單元，避免「連結有效但購物車判定不屬於該課程項目」這類問題難以排查。

## Entry Points
- Cloud Functions callable: `findClassroomInviteBinding`
- Cloud Functions HTTP (CORS-safe): `findClassroomInviteBindingHttp`
- Dashboard helper (admin): `adminFindInviteBinding()`

## Permission Model
- 僅 `role === admin` 可查詢。
- HTTP 版本需帶 Firebase ID token（Bearer）。

## Query Input
- `inviteCodeOrUrl`
  - 可輸入完整 URL：`https://classroom.github.com/a/xxxxx`
  - 或只輸入 invite code：`xxxxx`

## Output Fields
- `normalizedInvite`
- `totalMatches`
- `matches[]`:
  - `lessonDocId`
  - `courseId`
  - `title`
  - `unitKey`
  - `courseUnits`

## Operational Notes
1. 若 `totalMatches = 0`，表示該邀請連結尚未寫入 `metadata_lessons.githubClassroomUrls`。
2. 若查到單元但購物車仍報錯，請檢查：
   - 購物車項目 ID 是否為 `metadata_lessons` 文件 ID（例如 `ydb63bg`）
   - 單元是否包含在該課程 `courseUnits`
   - `githubClassroomUrls` 是否有 `.html` key 巢狀化資料型態
