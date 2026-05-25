# Platform Expansion Plan

## 1. Scope

This document consolidates:

1. Course architecture upgrade
2. Content quality standardization
3. I18N content repo MVP
4. Channel partner / revenue share parameterization

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
   - Rename to `tw-common-*.html`
2. Original starter course files `start-*-unit-*.html`
   - Rename to `tw-car-starter-*.html`
3. Original basic course files `basic-*-unit-*.html`
   - Rename to `tw-car-basic-*.html`
4. Original advanced course files `advanced-*-unit-*.html`
   - Rename to `tw-car-advanced-*.html`

This naming rule is a planning target. Existing Firestore keys should migrate gradually.

### 2.6 `*-master-*` retirement

Conclusion:

- `*-master-*.html` can be removed in the new architecture.
- They should not be removed until their responsibilities are detached.

**Completed removals (2025-05):**

- `01-master-getting-started.html` — removed; prepare units now use `prepare-*` naming directly.
- `02-master-ai-agents.html` — removed; three child units replaced by `prepare-04/05/06-*.html`.
- `03-master-wifi-motor.html` — removed; child units migrated to `prepare-07/08/09-*.html`.

**Remaining master files** (still in use by `start`, `basic`, `adv` courses):

- `start-*-master-*.html` (5 files)
- `basic-*-master-*.html` (10 files)
- `adv-*-master-*.html` (15 files)

Dependencies that must be removed before retiring the remaining masters:

1. Entry pages such as `prepare.html` ← **partially done**: prepare courses no longer use master files
2. `serveCourse` scope validation that still uses `classroomUrl/masterFile`
3. Frontend fallbacks that hardcode master filenames

Migration order:

1. Add `entryUnitId`
2. Switch entry pages to `entryUnitId`
3. Change `serveCourse` to validate by `courseKey + unit list`
4. Convert master pages into compatibility redirects
5. Remove master files after validation

### 2.7 Completed file renames (2025-05)

The original `0x-unit-*.html` naming was migrated to a `prepare-NN-*` sequential scheme:

| Old filename | New filename |
|---|---|
| `01-unit-developer-identity.html` | `prepare-01-developer-identity.html` |
| `01-unit-vscode-online.html` | `prepare-02-vscode-online.html` |
| `01-unit-vscode-setup.html` | `prepare-03-vscode-setup.html` |
| `02-unit-agent-mode.html` | `prepare-04-agent-mode.html` (rewritten) |
| `02-unit-vibe-coding.html` | `prepare-05-vibe-coding.html` (rewritten) |
| `02-unit-web-agents.html` | `prepare-06-web-agents.html` (rewritten) |
| `03-unit-github-classroom.html` | `prepare-07-github-classroom.html` |
| `03-unit-motor-ramping.html` | `prepare-08-motor-ramping.html` (rewritten) |
| `03-unit-wifi-setup.html` | `prepare-09-wifi-setup.html` (rewritten) |

Frontend rename:

| Old filename | New filename |
|---|---|
| `public/started.html` | `public/start.html` |

### 2.8 New tooling files

| File | Purpose |
|---|---|
| `functions/scripts/seed-emulator.js` | Seed Firestore emulator with course metadata and test data |
| `public/js/firebase-local.js` | Auto-detect and connect to local Firebase emulator |
| `functions/private_courses/_add_quiz.py` | Batch script used for inserting quizzes (build-time only) |

---

## 3. Content Quality Standardization (Completed 2025-05)

### 3.1 Objectives

- Bring all 104 course unit files to a consistent MS Learn-style format.
- Ensure every unit has rich educational content, not boilerplate.
- Add knowledge quizzes to all unit files for learner self-assessment.

### 3.2 MS Learn format standard

All unit files now follow a consistent structure:

- Sidebar navigation with progress tracking
- Breadcrumbs linking to course listing
- Content pages using semantic CSS classes: `.ms-note`, `.ms-tip`, `.ms-warning`, `.ms-important`, `.ms-steps`, `.ms-table`, `.ms-code`
- Knowledge quiz page with 4 topic-specific multiple-choice questions, answer validation, and explanations
- Summary page with key takeaways

### 3.3 Phase 1 — Critical defect fixes (adv 50 files)

| Issue | Files affected | Resolution |
|---|---|---|
| Empty index page descriptions | 13 files (adv-01 ~ adv-05) | Filled with topic-specific 1-2 sentence descriptions |
| Unreadable fonts (`text-[8px]`/`[9px]`/`[10px]`) | 38 files | Replaced with `text-[13px]` |
| Task card footer text overflow | 50 files | Added CSS truncation rule |
| H1 titles with emoji/numbering/time | 50 files | Cleaned to topic-only titles |
| Boilerplate intro paragraphs | 50 files | Replaced with topic-specific content |

### 3.4 Phase 2 — Content enrichment (basic 30 + adv 50 = 80 files)

| Task | Files | Details |
|---|---|---|
| Rewrite boilerplate intros and scenarios | 80 files | Unique, topic-specific introductions |
| Fix fonts, footer overflow, H1 format | basic 30 files | Same fixes as adv Phase 1 |
| Rewrite generic learning objectives | basic 30 files | Specific, measurable, action-verb-based outcomes |
| Expand teaching pages | 240 pages across 80 files | From 1-3 sentences to full MS Learn-style content with tables, code examples, callouts, and step-by-step instructions |
| Remove raw Tailwind from content | 80 files | Replaced with MS Learn CSS components |

### 3.5 Phase 3 — Knowledge quizzes (basic 30 + adv 50 = 80 files)

- Inserted a quiz page (4 topic-specific questions) into each file between Lab and Summary.
- Updated JavaScript `UNITS` array, navigation links, progress indicators, and sidebar badges.
- Added `submitQuiz` / `resetQuiz` functions with answer validation and explanations.

### 3.6 Phase 4 — Polish start + prepare (24 files)

| Task | Files | Details |
|---|---|---|
| Add knowledge quiz | start 15 files | 4 topic-specific questions per unit |
| Full content rewrite | `prepare-08-motor-ramping.html` | PWM, BLE binary communication, DataView, ramping algorithms |
| Full content rewrite | `prepare-09-wifi-setup.html` | BLE, Web Bluetooth API, NVS, TextEncoder |
| Quality verification | `prepare-01` ~ `prepare-07` | Already met standards; no changes needed |

### 3.7 Post-polish fixes (2025-05)

- **Start unit styling alignment**: All 15 start unit files updated to match prepare/basic/adv format (top nav brand/label, sidebar module-label hidden, breadcrumb with real module titles).
- **JS init crash in `prepare-08` and `prepare-09`**: `init()` referenced `window.RESOURCES` before it was defined in a later `<script>` block, causing a `TypeError` that prevented breadcrumb and navigation from initializing. Fixed with a defensive `if (window.RESOURCES)` guard.

### 3.8 Remaining content issues

- **46 adv files missing video/doc URLs**: `adv-02` through `adv-15` have empty `video` and `doc` fields in `window.RESOURCES`. Only `adv-01` (3 units) and `adv-04-filter-algorithms` have actual URLs. These require user-provided YouTube and Google Docs links.

---

## 4. I18N Content Repo MVP

### 4.1 Objectives

- Move course content into an external private content repo.
- Support `zh-TW` and `en` first.
- Keep current auth/token behavior unchanged.

### 4.2 External content repo structure

```text
content-repo/
  courses/
    zh-TW/
      tw-common-*.html
      tw-car-starter-*.html
      tw-car-basic-*.html
      tw-car-advanced-*.html
    en/
      en-common-*.html
      en-car-starter-*.html
      en-car-basic-*.html
      en-car-advanced-*.html
```

Current decision:

- `assignment-guide` and `tutor-guide` are not split into a separate repo area yet.
- For now they stay hidden inside course content.

### 4.3 Runtime lookup

`serveCourse` should resolve in this order:

1. `functions/private_courses_i18n/<query.lang>/<fileName>`
2. `functions/private_courses_i18n/<accept-language primary>/<fileName>`
3. `functions/private_courses_i18n/zh-TW/<fileName>`
4. `functions/private_courses/<fileName>`

### 4.4 Sync flow

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

## 5. Channel Partner And Revenue Share

### 5.1 Objectives

- Make tutor and agent revenue share ratios configurable.
- Support multi-market and multi-channel policies.
- Preserve future room for course development revenue share.

### 5.2 Role model

Roles:

- Tutor
- Agent
- CourseDev

Notes:

- Tutors may belong to an agent.
- The system distributes revenue by role instead of using a single bundled partner model.
- Current courses do not have an owner, so `CourseDev` share is reserved but not paid.

### 5.3 Confirmed initial parameters

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

### 5.4 Firestore additions

New collection:

- `revenue_share_policies`

Recommended `orders` additions:

- `region`
- `channelType`
- `policyId`
- `pricingVersion`

### 5.5 Calculation changes

`calculateMonthlySharing` should:

1. Read the order's `policyId`
2. Load the policy snapshot
3. Calculate:
   - tutor share
   - agent share
   - course development share if applicable
   - upline share if applicable
4. Store ledger lines with `policySnapshot`

### 5.6 Admin MVP

Admin needs:

1. Policy CRUD
2. Enable/disable policy
3. Revenue simulation
4. Audit trail

---

## 6. Confirmed Decisions

1. Use `courseKey` as the new main course key.
2. Use pure display names such as `Agent Mode`.
3. `track` and `level` use fixed enums, not instructor-defined free text.
4. Keep guides embedded for now instead of splitting them out.
5. Remove `*-master-*` as soon as validation is complete.
6. Use role-based revenue share parameters instead of the old bundled partner wording.

---

## 7. Execution Roadmap

### Phase 0 — Content & naming groundwork ✅ Completed 2025-05

1. ~~Hide technical prefixes in UI~~
2. ~~Group courses by `track` and `level`~~
3. ~~Align naming and planning docs~~
4. Migrate prepare-course files from `0x-unit-*` to `prepare-NN-*` naming ✅
5. Remove 3 legacy master files (`01-master`, `02-master`, `03-master`) ✅
6. Rename `started.html` → `start.html` ✅
7. Enrich all 104 course files to MS Learn standard ✅
8. Add knowledge quizzes to all 95 unit files ✅
9. Add `seed-emulator.js` and `firebase-local.js` for local dev ✅
10. Align start unit files to match prepare/basic/adv styling ✅
    - Top nav: `Vibe Coding Learn` → `Vibe Coding` + rocket icon, nav label linked to `/start.html`
    - Sidebar: hide `module-label` via `display: none`
    - Breadcrumb: replace generic `Start 03`/`入門課程單元` with actual module titles
11. Fix `prepare-08` and `prepare-09` JS init crash (`window.RESOURCES` accessed before definition) ✅

### Phase 1

1. Add `courseKey/track/level/entryUnitId/contentRef`
2. Switch entry pages to `entryUnitId`
3. Start `zh-TW/en` content repo pilot
4. Add `revenue_share_policies`
5. Make monthly share calculation read policies
6. Fill 46 missing video/doc URLs in advanced course files

### Phase 2

1. Remove master-file dependency from `serveCourse`
2. Add admin revenue share management UI
3. Add simulation and warnings
4. Add order-level `region/channelType/policyId`

---

## 7. Implementation Checklist

### 7.1 Data model and Firestore

- [ ] Add `courseKey` to `metadata_lessons`
- [ ] Add `track` to `metadata_lessons`
- [ ] Add `level` to `metadata_lessons`
- [ ] Add `entryUnitId` to `metadata_lessons`
- [ ] Add `contentRef` to `metadata_lessons`
- [ ] Add `locale` to `users`
- [ ] Add `region` to `users`
- [ ] Add `region` to `orders`
- [ ] Add `channelType` to `orders`
- [ ] Add `policyId` to `orders`
- [ ] Add `pricingVersion` to `orders`
- [ ] Create `revenue_share_policies` collection

### 7.2 Content routing and serving

- [x] Add locale-aware content lookup in `serveCourse`
- [x] Add old-filename -> new-filename fallback for i18n content paths
- [ ] Replace `classroomUrl/masterFile` scope validation with `courseKey + unit list`
- [ ] Make `entryUnitId` the primary course entry target
- [ ] Convert `*-master-*` pages into compatibility redirects
- [ ] Remove `*-master-*` dependencies from token generation and entry links

### 7.3 External content repo MVP

- [x] Create `sync_i18n_private_courses.sh` MVP tool
- [x] Add `--dry-run` support
- [x] Add stale-file detection
- [x] Add optional stale-file deletion via `--apply-delete`
- [ ] Create external private content repo
- [ ] Add first `zh-TW` pilot content
- [ ] Add first `en` pilot content
- [ ] Define publish SOP: update repo -> sync -> deploy
- [ ] Verify fallback order with one migrated unit

### 7.4 Naming migration

- [x] Confirm new lowercase naming examples
- [x] Create old filename -> new filename mapping table
- [x] Create old `unitId` -> `contentRef` mapping table
- [ ] Hide `-unit-` technical prefixes in all UI surfaces
- [ ] Update `prepare.html` and related entry pages to use new metadata-driven names

Reference artifacts:

- `docs/examples/content-filename-mapping.csv`
- `docs/examples/unit-contentref-mapping.csv`
- `docs/examples/master-retirement-mapping.csv`
- `docs/examples/metadata-lessons-migration-template.csv`

### 7.5 Revenue share system

- [ ] Store role-based revenue share policies in Firestore
- [ ] Add tutor share calculation by policy
- [ ] Add agent share calculation by policy
- [ ] Reserve `courseDevRate` support without payout when no owner exists
- [ ] Add upline share calculation for tutor
- [ ] Add upline share calculation for agent
- [ ] Persist `policySnapshot` into ledger records
- [ ] Add admin policy CRUD
- [ ] Add admin revenue simulation UI

### 7.6 Validation and pilot rollout

- [ ] Pick 1 `tw-common-*` unit as pilot
- [ ] Pick 1 `tw-car-starter-*` unit as pilot
- [ ] Verify course open flow
- [ ] Verify authorization scope
- [ ] Verify dashboard lesson entry
- [ ] Verify assignment-guide and tutor-guide rendering
- [ ] Verify autograde and writeback are unaffected
- [ ] Remove `*-master-*` only after pilot validation succeeds

---

## 8. Immediate Next Steps

1. Create the filename mapping tables
2. Add the new metadata fields in Firestore planning
3. Refactor `serveCourse` authorization away from `masterFile`
4. Prepare 1-2 pilot units for external private repo migration

### Phase 3

1. Redirect and remove remaining `*-master-*` (30 files)
2. Gradually migrate legacy `unitId/courseId`
3. Expand to multi-market pricing/versioning
4. Support external instructors publishing through the standardized content pipeline

---

## 8. Risks

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

## 9. Immediate Next Steps

1. Treat this file as the primary planning document.
2. Use it to drive implementation tasks in order: naming → entry routing → content repo → revenue share policies.
3. Keep old planning docs only as compatibility pointers.
4. Collect 46 missing video/doc URLs for advanced course files from content owners.
