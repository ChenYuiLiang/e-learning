# Autograde Full Automation

## Goal
Make GitHub Classroom grading write back to Vibe Coding automatically with no manual input for `assignmentDocId` or score submission.

## Current architecture
- `autograde-sync.yml` is deployed to each classroom bridge repo.
- Trigger modes:
  - `repository_dispatch` (preferred for exact score)
  - `workflow_run` (fallback; success=100, failure=0)

## Step 1: Configure per-repo mapping once
Prepare CSV from sample:
- [autograde-repo-mapping.sample.csv](/Users/roverchen/Documents/Apps/vibe-coding-tw/docs/examples/autograde-repo-mapping.sample.csv)

If you want to auto-fill mapping from Firestore assignments, generate one with:
```bash
node functions/scripts/export_autograde_mapping_from_firestore.js \
  --bridge-csv=docs/examples/classroom-bridge-sync-units-only.csv \
  --output=docs/examples/autograde-repo-mapping.firestore.csv
```

Then apply:
```bash
scripts/setup_autograde_repo_mapping.sh --dry-run docs/examples/autograde-repo-mapping.firestore.csv
scripts/setup_autograde_repo_mapping.sh --apply docs/examples/autograde-repo-mapping.firestore.csv
```

Run:
```bash
scripts/setup_autograde_repo_mapping.sh --dry-run /path/to/mapping.csv
scripts/setup_autograde_repo_mapping.sh --apply /path/to/mapping.csv
```

Accepted mapping formats:
1. `assignment_doc_id` (recommended)
2. `user_id + assignment_id` (fallback)

## Step 2: Ensure webhook secrets exist in every classroom repo
Required secrets:
- `VC_AUTOGRADE_URL`
- `VC_AUTOGRADE_TOKEN`

## Step 3: Choose score mode
### Mode A: Fully automatic fallback (already works)
- No grading workflow changes needed.
- `workflow_run` sends:
  - success -> score 100
  - non-success -> score 0

### Mode B: Exact score automatic (recommended)
In grading workflow, append a step that dispatches real score:

```yaml
- name: Dispatch exact score
  if: always()
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    SCORE="${{ steps.grader.outputs.score }}"
    MAX_SCORE="${{ steps.grader.outputs.max_score }}"
    STATUS="completed"
    [ "${{ job.status }}" != "success" ] && STATUS="failed"

    gh api repos/${{ github.repository }}/dispatches \
      -f event_type='autograde_result' \
      -F client_payload:='{"assignmentDocId":"${{ vars.VC_ASSIGNMENT_DOC_ID }}","score":'"${SCORE:-0}"',"maxScore":'"${MAX_SCORE:-100}"',"status":"'"$STATUS"'","runUrl":"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}","workflow":"${{ github.workflow }}","commitSha":"${{ github.sha }}"}'
```

## Validation checklist
1. Trigger one grading run in a classroom repo.
2. Confirm `Autograde Sync To Vibe Coding` runs automatically.
3. Confirm Firestore assignment fields updated:
- `autoGrade.score`
- `autoGrade.maxScore`
- `autoGradeUpdatedAt`
- `autoGradeSource`

## Troubleshooting
- If sync does not trigger:
  - confirm workflow name is included in `workflow_run.workflows` list in `.github/workflows/autograde-sync.yml`.
- If sync triggers but write-back fails:
  - verify `VC_AUTOGRADE_URL` / `VC_AUTOGRADE_TOKEN`.
  - verify mapping variable exists (`VC_ASSIGNMENT_DOC_ID` or `VC_USER_ID` + `VC_ASSIGNMENT_ID`).
