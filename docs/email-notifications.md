# Email Notifications Spec
**Version**: 2026.05.13.V1  
**Objective**: Define all production email notifications, their triggers, recipients, and operational expectations.

## 1. Scope
This document covers email notifications implemented in:
- `functions/emailService.js`
- `functions/index.js`

It is the source of truth for:
- Trigger conditions
- Recipients
- Core payload/content
- Deep links
- Failure handling expectations

## 2. Notification Matrix
| Notification | Trigger | Recipient | Function | Deep Link |
| :--- | :--- | :--- | :--- | :--- |
| Welcome | Firebase Auth user created | New user | `sendWelcomeEmail` | `/prepare.html`, `/started.html`, `/dashboard.html` |
| Payment success | `paymentNotify` success | Student | `sendPaymentSuccessEmail` | `/dashboard.html?tab=overview` |
| Trial expiring | Scheduled check | Student | `sendTrialExpiringEmail` | `/dashboard.html` |
| Course expiring | Scheduled check | Student | `sendCourseExpiringEmail` | `/dashboard.html` |
| Tutor authorization granted | `authorizeTutorForCourse(add)` | Tutor | `sendTutorAuthorizationEmail` | `/dashboard.html?unitId=...&tab=assignments` |
| Assignment submitted | `submitAssignment` with `status=submitted` | Assigned tutor | `sendAssignmentNotification` | `/dashboard.html?...&tab=assignments` |
| Student linked to tutor | `upsertStudentUnitAssignment` flow | Student | `sendStudentLinkedToTutorEmail` | `/dashboard.html?unitId=...&tab=assignments` |
| Tutor linked to student | `upsertStudentUnitAssignment` flow | Tutor | `sendTutorLinkedToStudentEmail` | `/dashboard.html?unitId=...&tab=assignments` |
| New tutor application | `applyForTutorRole` / `submitTutorRecommendationInviteLink` | Admin | `sendAdminNewApplicationEmail` | `/dashboard.html?unitId=...&tab=admin` |
| Tutor application result | `decideTutorApplication` | Applicant | `sendApplicationResultEmail` | `/dashboard.html?unitId=...&tab=assignments` |
| Admin pending assignment reminder | Daily schedule | Admin | `sendAdminAssignmentReminder` | `/dashboard.html?tab=admin` |
| Admin pending shipment reminder | Daily schedule | Admin | `sendAdminShipmentReminder` | `/dashboard.html?tab=shipments` |
| Autograde result (student) | `ingestGithubAutograde` success | Student | `sendAutogradeResultToStudent` | `/dashboard.html?unitId=...&tab=assignments` |
| Autograde result (tutor) | `ingestGithubAutograde` success | Assigned tutor | `sendAutogradeResultToTutor` | `/dashboard.html?unitId=...&tab=assignments` |
| Order shipped | `markOrderShipped` success | Student | `sendOrderShippedEmail` | `/dashboard.html?tab=overview` |
| Tutor recommendation candidate | `recommendTutorForUnit` success | Candidate student | `sendTutorRecommendationCandidateEmail` | `/dashboard.html?unitId=...&tab=assignments&action=submitTutorInvite&applicationId=...` |
| Autograde failure alert | `ingestGithubAutograde` validation/runtime failure | Admin | `sendAutogradeFailureAlertEmail` | `/dashboard.html?tab=admin` |

## 3. Key Operational Rules
1. Links in email must be generated via `APP_BASE_URL` and include tab/unit context whenever possible.
2. Assignment emails must prefer `unitId + tab=assignments` deep links to reduce navigation friction.
3. Autograde writeback failures must notify admin with payload preview to speed incident triage.
4. Notification send failures should not block business transaction completion (current behavior: best-effort send with error logging).
5. Admin pending assignment reminder only lists `未指派老師的課程單元`（paid course units only），排除硬體項目與免費課程項目。

## 4. Deprecated / Legacy Notes
1. `sendGradingNotification` currently exists as a legacy template from manual grading flow.
2. Manual grading endpoint `gradeAssignment` is disabled; autograde is the active scoring path.

## 5. Environment Variables
- `MAIL_USER`
- `MAIL_PASS`
- `APP_BASE_URL`
- `ADMIN_EMAIL`

## 6. Runbook (Incident Quick Checks)
1. If no emails are sent:
   - Verify `MAIL_USER` and `MAIL_PASS`.
   - Check Cloud Functions logs for transporter/auth errors.
2. If autograde alert spam appears:
   - Check GitHub payload mapping (`userId+unitId`).
   - Verify `GITHUB_WEBHOOK_SECRET` signature setup.
3. If admin links open wrong tab:
   - Verify `APP_BASE_URL` and deep link query params in templates.
