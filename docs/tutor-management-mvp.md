# Tutor Management & Authorization Minimum Viable Product (MVP)
**Version**: 2026.05.13.V1
**Objective**: Standardize the process for identifying, recommending, and authorizing qualified tutors to maintain teaching quality and platform integrity.

## 1. Protocol Overview
The Tutor Management MVP governs the lifecycle of a student's transition to a "Qualified Tutor" (合格導師). It relies on a peer-recommendation model followed by administrative oversight.

```mermaid
graph TD
    A[現有教師批改作業] -->|發現優秀學生| B[點擊 推薦此學生]
    B -->|建立申請紀錄| C(Firestore: tutor_applications)
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
| `PENDING` | Initial state after a recommendation or application is submitted. | Tutor clicks "Recommend Student" in Grading Modal. |
| `APPROVED` | Applicant is granted tutoring rights for a specific unit. | Admin clicks "Approve" in Admin Console. |
| `REJECTED` | Application is dismissed. | Admin clicks "Reject" in Admin Console. |

## 3. Workflow Implementation

### 3.1 Step 1: Recommendation (Tutor Action)
- **Interface**: Located within the Assignment Grading Modal (`#grading-modal`).
- **Function**: `window.submitTutorRecommendation()`.
- **Action**: Creates a document in the `tutor_applications` collection with `source: "tutor_recommendation"`.

### 3.2 Step 2: Administrative Review (Admin Action)
- **Interface**: The **Admin Console** tab (`#view-admin`) in the Dashboard.
- **Aggregation**: `getDashboardData` collects all applications where `status === 'pending'`.
- **Decision Logic**:
    - **Approval**: Calls `authorizeTutorForCourse` with `action: 'add'`. This updates the unit's authorized tutors list and sets the applicant's role (if necessary).
    - **Rejection**: Updates the application status to `rejected` and stops the process.

### 3.3 Step 3: Automated Onboarding (System Action)
- **Notification**: Calls `sendTutorAuthorizationEmail` via `emailService.js`.
- **Payload**: Includes the unit name, the tutor's dashboard link, and the **GitHub Classroom Invitation Link** for the specific unit.
- **Authorization**: The new tutor now has access to the **Assignments** and **Settings** tabs for the authorized unit to manage their future students.

## 4. Technical Integration Points

### Firestore Collections
- `tutor_applications`: Stores the history and status of all tutor requests.
- `tutor_configs`: Stores unit-level tutor authorizations and GitHub Classroom URLs.
- `users`: Tracks the `role` and `myTutorConfigs` for individual accounts.

### Cloud Functions
- `getDashboardData`: Aggregates pending applications for the admin view.
- `handleDecideApplication`: The primary endpoint for approving or rejecting applications.
- `authorizeTutorForCourse`: Handles the atomic updates to permissions and configuration files.

## 5. Security & Validation
- **Role Enforcement**: Only users with `role === 'admin'` can see or execute the `handleDecideApplication` logic.
- **Context Locking**: Tutors are authorized on a **per-unit** basis, ensuring they only manage content they are qualified for.
- **Traceability**: All recommendations are linked to the recommending tutor's UID for audit purposes.
