# Legacy ID Migration (Firestore)

## Purpose
Normalize historical legacy IDs to current canonical IDs in Firestore, so runtime logic can gradually remove compatibility branches safely.

## Script
- [migrate_legacy_ids_firestore.js](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/scripts/migrate_legacy_ids_firestore.js)

## Usage
Dry-run:
```bash
GOOGLE_CLOUD_PROJECT=e-learning-942f7 GCLOUD_PROJECT=e-learning-942f7 \
node functions/scripts/migrate_legacy_ids_firestore.js --dry-run
```

Apply:
```bash
GOOGLE_CLOUD_PROJECT=e-learning-942f7 GCLOUD_PROJECT=e-learning-942f7 \
node functions/scripts/migrate_legacy_ids_firestore.js --apply
```

Optional:
- `--limit=N` for small-batch rollout
- `--out=/tmp/report.json` for explicit report path

## Collections covered
- `users`
  - `unitAssignments` keys
  - `tutorConfigs` keys
  - `courseProgress` keys
- `orders`
  - `items` keys
  - `courseId`
- `assignments`
  - `courseId`, `unitId`
- `tutor_applications`
  - `unitId`
- `referral_links`
  - `unitId`
- `metadata_lessons`
  - `courseId`, `courseUnits[]`

## Report
Script outputs JSON report with:
- `summary.changed`
- `summary.updated`
- `summary.noop`
- `changes[]` with per-document patch preview

## Safety notes
1. Always run `--dry-run` first and review report.
2. Run in off-peak hours if applying to large datasets.
3. Keep report files for audit trail.
4. If key collisions occur in map-key migration, script keeps existing new-key value deterministically.

