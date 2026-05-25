# Platform Expansion Plan

## 1. Scope

This document consolidates:

1. Course architecture upgrade
2. I18N content repo MVP
3. Channel partner / revenue share parameterization

The goal is to keep one source of truth for the next-stage platform changes.

---

## 2. Course Architecture

### 2.1 Objectives

- Decouple routing and business logic from legacy HTML filenames.
- Improve readability of course/unit naming as the catalog grows.
- Prepare for multi-region, multi-language, and external instructor onboarding.
- Preserve current authorization, grading, and writeback during migration.

### 2.2 Core principles

1. Firestore remains the source of truth.
2. Stable IDs first; display naming can change before canonical IDs do.
3. Display labels and storage keys must be separated.
4. Migration must be staged with fallback and rollback paths.

### 2.3 Target data model additions

For `metadata_lessons`:

- `courseKey`
- `track`
- `level`
- `entryUnitId`
- `displayName`
- `i18n`
- `contentRef`

For `users`:

- `locale`
- `region`

### 2.4 Naming strategy

Short term:

- Hide technical prefixes like `-unit-` in the UI.
- Keep existing canonical `unitId` and `courseId` until migration is complete.

New naming examples:

- `car-starter-agent-mode`
- `drone-basic-flight-control`

### 2.5 Confirmed Taiwan file naming rules

1. Original preparation/unit files `*-unit-*.html`
   - Rename to `TW-common-*.html`
2. Original starter course files `start-*-unit-*.html`
   - Rename to `TW-car-starter-*.html`
3. Original basic course files `basic-*-unit-*.html`
   - Rename to `TW-car-basic-*.html`
4. Original advanced course files `advanced-*-unit-*.html`
   - Rename to `TW-car-advanced-*.html`

This naming rule is a planning target. Existing Firestore keys should migrate gradually.

### 2.6 `*-master-*` retirement

Conclusion:

- `*-master-*.html` can be removed in the new architecture.
- They should not be removed until their responsibilities are detached.

Current dependencies that must be removed first:

1. Entry pages such as `prepare.html`
2. `serveCourse` scope validation that still uses `classroomUrl/masterFile`
3. Frontend fallbacks that hardcode master filenames

Migration order:

1. Add `entryUnitId`
2. Switch entry pages to `entryUnitId`
3. Change `serveCourse` to validate by `courseKey + unit list`
4. Convert master pages into compatibility redirects
5. Remove master files after validation

---

## 3. I18N Content Repo MVP

### 3.1 Objectives

- Move course content into an external private content repo.
- Support `zh-TW` and `en` first.
- Keep current auth/token behavior unchanged.

### 3.2 External content repo structure

```text
content-repo/
  courses/
    zh-TW/
      TW-common-*.html
      TW-car-starter-*.html
      TW-car-basic-*.html
      TW-car-advanced-*.html
    en/
      EN-common-*.html
      EN-car-starter-*.html
      EN-car-basic-*.html
      EN-car-advanced-*.html
```

Current decision:

- `assignment-guide` and `tutor-guide` are not split into a separate repo area yet.
- For now they stay hidden inside course content.

### 3.3 Runtime lookup

`serveCourse` should resolve in this order:

1. `functions/private_courses_i18n/<query.lang>/<fileName>`
2. `functions/private_courses_i18n/<accept-language primary>/<fileName>`
3. `functions/private_courses_i18n/zh-TW/<fileName>`
4. `functions/private_courses/<fileName>`

### 3.4 Sync flow

MVP sync command:

```bash
scripts/sync_i18n_private_courses.sh \
  --source=/ABS/PATH/TO/content-repo \
  --locales=zh-TW,en
```

Release flow:

1. Update localized HTML in external content repo
2. Sync into this project
3. Deploy

---

## 4. Channel Partner And Revenue Share

### 4.1 Objectives

- Make tutor and agent revenue share ratios configurable.
- Support multi-market and multi-channel policies.
- Preserve future room for course development revenue share.

### 4.2 Role model

Roles:

- Tutor
- Agent
- CourseDev

Notes:

- Tutors may belong to an agent.
- The system distributes revenue by role instead of using a single bundled partner model.
- Current courses do not have an owner, so `CourseDev` share is reserved but not paid.

### 4.3 Confirmed initial parameters

- `tutorRate = 0.20`
- `agentRate = 0.20`
- `courseDevRate = 0.20` as reserved parameter only

Operational rules:

1. If a course has no owner, do not issue `courseDevRate`.
2. Taiwan can also have agents.
3. If a tutor has no agent, the agent share stays with the platform.
4. Upline revenue share can apply to both tutor and agent.
5. If there is no upline configured, do not issue upline share.
6. Margin guardrails should be adjustable based on real operating conditions, not hardcoded to a fixed threshold.

### 4.4 Firestore additions

New collection:

- `revenue_share_policies`

Recommended `orders` additions:

- `region`
- `channelType`
- `policyId`
- `pricingVersion`

### 4.5 Calculation changes

`calculateMonthlySharing` should:

1. Read the order's `policyId`
2. Load the policy snapshot
3. Calculate:
   - tutor share
   - agent share
   - course development share if applicable
   - upline share if applicable
4. Store ledger lines with `policySnapshot`

### 4.6 Admin MVP

Admin needs:

1. Policy CRUD
2. Enable/disable policy
3. Revenue simulation
4. Audit trail

---

## 5. Confirmed Decisions

1. Use `courseKey` as the new main course key.
2. Use pure display names such as `Agent Mode`.
3. `track` and `level` use fixed enums, not instructor-defined free text.
4. Keep guides embedded for now instead of splitting them out.
5. Remove `*-master-*` as soon as validation is complete.
6. Use role-based revenue share parameters instead of the old bundled partner wording.

---

## 6. Execution Roadmap

### Phase 0

1. Hide technical prefixes in UI
2. Group courses by `track` and `level`
3. Align naming and planning docs

### Phase 1

1. Add `courseKey/track/level/entryUnitId/contentRef`
2. Switch entry pages to `entryUnitId`
3. Start `zh-TW/en` content repo pilot
4. Add `revenue_share_policies`
5. Make monthly share calculation read policies

### Phase 2

1. Remove master-file dependency from `serveCourse`
2. Add admin revenue share management UI
3. Add simulation and warnings
4. Add order-level `region/channelType/policyId`

### Phase 3

1. Redirect and remove `*-master-*`
2. Gradually migrate legacy `unitId/courseId`
3. Expand to multi-market pricing/versioning
4. Support external instructors publishing through the standardized content pipeline

---

## 7. Risks

1. Authorization regressions during route migration
2. Grade writeback failures during ID migration
3. Content version drift between repo and deployment
4. Cache confusion after deploys
5. Revenue policy misconfiguration affecting margin

Controls:

1. Backward-compatible fallback while migrating
2. Ledger policy snapshots
3. Versioned content sync
4. Cache busting
5. Admin audit trail and simulation

---

## 8. Immediate Next Steps

1. Treat this file as the primary planning document.
2. Use it to drive implementation tasks in order: naming -> entry routing -> content repo -> revenue share policies.
3. Keep old planning docs only as compatibility pointers.

