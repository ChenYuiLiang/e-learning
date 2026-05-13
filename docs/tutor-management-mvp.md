# Tutor Management & Authorization Minimum Viable Product (MVP)
**Version**: 2026.05.13.V1
**Objective**: Standardize the process for identifying, recommending, and authorizing qualified tutors to maintain teaching quality and platform integrity.

## 1. Protocol Overview
The Tutor Management MVP governs the lifecycle of a student's transition to a "Qualified Tutor" (合格導師). It relies on a peer-recommendation model followed by administrative oversight.

```mermaid
graph TD
    A[學生 Push 並產生自動評分] -->|達推薦門檻| B[導師點擊 推薦此學生]
    B -->|建立申請紀錄| C(Firestore: tutor_applications)
    C -->|寄候選通知| C1[學生收到被推薦通知]
    C -->|status: PENDING| D{管理員收到 Email}
    D -->|登入後台| E[進入 合格教師 分頁]
    E -->|查看申請資料| F{管理員審核}
    F -->|核准 Approve| G[自動發送 授權成功郵件]
    F -->|拒絕 Reject| H[紀錄存檔不授權]
    G -->|內容包含| I[GitHub Classroom 招生連結]
    G -->|權限更新| J[新教師可管理該單元]
```

## 2. Application & Recommendation Lifecycle
| State | Description | Trigger |
| :--- | :--- | :--- |
| `PENDING` | Initial state after a recommendation or application is submitted. | Tutor clicks "Recommend Student" in assignment workflow. |
| `APPROVED` | Applicant is granted tutoring rights for a specific unit. | Admin clicks "Approve" in Tutor Admin tab. |
| `REJECTED` | Application is dismissed. | Admin clicks "Reject" in Tutor Admin tab. |

## 3. Workflow Implementation

### 3.1 Step 1: Recommendation (Tutor Action)
- **Interface**: Located within assignment workflow actions in Dashboard.
- **Function**: `window.submitTutorRecommendation()`.
- **Action**: Creates a document in the `tutor_applications` collection with `source: "tutor_recommendation"`.
- **Gate**: Requires valid `autoGrade.score` and score threshold check on backend.
- **Notification**:
  - Sends admin notification via `sendAdminNewApplicationEmail`.
  - Sends candidate-facing notification via `sendTutorRecommendationCandidateEmail`.

### 3.2 Step 2: Administrative Review (Admin Action)
- **Interface**: The **Tutor Admin** tab (`#view-admin`) in the Dashboard.
- **Aggregation**: `getDashboardData` collects all documents in `tutor_applications` where `status === 'pending'`.
- **Decision Logic**:
    - **Approval**: `decideTutorApplication` updates `tutor_applications` status and writes `users.tutorConfigs[unitId].authorized = true`.
    - **Rejection**: `decideTutorApplication` updates `tutor_applications` status to `rejected`.

### 3.3 Step 3: Automated Onboarding (System Action)
- **Notification**: Calls `sendTutorAuthorizationEmail` via `emailService.js`.
- **Payload**: Includes the unit name, the tutor's dashboard link, and the **GitHub Classroom Invitation Link** for the specific unit.
- **Authorization**: The new tutor now has access to the **Assignments** and **Settings** tabs for the authorized unit to manage their future students.

## 4. Technical Integration Points

### Firestore Collections
- `tutor_applications`: Source of truth for all tutor requests and review status.
- `tutor_configs`: Stores unit-level tutor authorizations and GitHub Classroom URLs.
- `users`: Tracks `tutorConfigs`; `tutorApplications` is a legacy-compatible snapshot.

### Cloud Functions
- `getDashboardData`: Aggregates pending applications for the admin view.
- `decideTutorApplication`: The primary endpoint for approving or rejecting applications.
- `recommendTutorForUnit`: Creates recommendation applications and validates auto-grade threshold.

## 5. Security & Validation
- **Role Enforcement**: Only users with `role === 'admin'` can see or execute the `handleDecideApplication` logic.
- **Context Locking**: Tutors are authorized on a **per-unit** basis, ensuring they only manage content they are qualified for.
- **Traceability**: All recommendations are linked to the recommending tutor's UID for audit purposes.

## 6. Related Specs
- `docs/email-notifications.md` (notification matrix and runbook)
